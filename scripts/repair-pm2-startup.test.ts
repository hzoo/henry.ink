import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Run a sandboxed copy with fake systemd commands, never the host's manager.
const source = readFileSync(new URL("./repair-pm2-startup.sh", import.meta.url), "utf8");
const fixtures: string[] = [];
afterEach(() => {
    for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function fixture(overrides: Record<string, string | undefined> = {}, extraDirectives = "") {
    const root = mkdtempSync(join(tmpdir(), "repair-pm2-test-"));
    fixtures.push(root);
    const etc = join(root, "etc");
    const units = join(etc, "systemd/system");
    const bin = join(root, "bin");
    mkdirSync(units, { recursive: true });
    mkdirSync(bin);
    const base = join(units, "pm2-henry.service");
    const dropin = `${base}.d/90-henry-home.conf`;
    const pm2 = "/home/henry/.bun/install/global/node_modules/pm2/bin/pm2";
    // Debian 12 omits empty EnvironmentFiles and Exec* arrays even with --all.
    // Keep scalar/string-list empties explicit, matching observed VPS output.
    const properties: Record<string, string | undefined> = {
        LoadState: "loaded", FragmentPath: base, DropInPaths: "", NeedDaemonReload: "no",
        UnitFileState: "enabled", ActiveState: "inactive", SubState: "dead", MainPID: "0",
        ControlPID: "0", User: "henry", Type: "forking", PIDFile: "/root/.pm2/pm2.pid",
        Environment: "PATH=/usr/bin:/bin PM2_HOME=/root/.pm2",
        PassEnvironment: "", UnsetEnvironment: "", RootDirectory: "", RootImage: "",
        ExecStart: `{ path=${pm2} ; argv[]=${pm2} resurrect ; ignore_errors=no ; pid=0 ; status=0/0 }`,
        ExecStop: `{ path=${pm2} ; argv[]=${pm2} kill ; ignore_errors=no ; pid=0 ; status=0/0 }`,
        ExecReload: `{ path=${pm2} ; argv[]=${pm2} reload all ; ignore_errors=no ; pid=0 ; status=0/0 }`,
        ...overrides,
    };
    writeFileSync(join(root, "properties"), Object.entries(properties).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}\n`).join(""));
    writeFileSync(base, `[Service]\nUser=henry\nType=forking\nEnvironment=PM2_HOME=/root/.pm2\nPIDFile=/root/.pm2/pm2.pid\nExecStart=${pm2} resurrect\nExecReload=${pm2} reload all\nExecStop=${pm2} kill\n${extraDirectives}`);
    const original = readFileSync(base, "utf8");
    const executable = (name: string, body: string) => writeFileSync(join(bin, name), `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
    executable("stat", 'case "$2" in %u) echo 0;; %a) echo 644;; *) exit 99;; esac');
    executable("ln", `
if [[ \${RACE_DROPIN:-0} == 1 ]]; then
    printf '# concurrent configuration\\n' > "$2"
    exit 1
fi
exec /bin/ln "$@"`);
    executable("systemctl", `
printf 'systemctl %s\\n' "$*" >> "$FIXTURE/calls"
case "$*" in
  '--system show '*)
    if [[ -f "$FIXTURE/reloaded" && -f "$DROPIN" ]]; then
      sed -e 's|^PIDFile=.*|PIDFile=/home/henry/.pm2/pm2.pid|' \\
          -e "s|^DropInPaths=.*|DropInPaths=$DROPIN|" \\
          -e 's|PM2_HOME=/root/.pm2|PM2_HOME=/home/henry/.pm2 HOME=/home/henry|' \\
          -e "s|^User=henry|User=\${POST_USER:-henry}|" "$FIXTURE/properties"
    else cat "$FIXTURE/properties"; fi ;;
  '--system daemon-reload')
    touch "$FIXTURE/reloaded"
    if [[ \${CHANGE_DROPIN:-0} == 1 && -f "$DROPIN" ]]; then echo '# external edit' >> "$DROPIN"; fi
    if [[ \${FAIL_RELOAD:-0} == 1 && -f "$DROPIN" ]]; then exit 1; fi ;;
  *) echo 'Forbidden systemctl action' >&2; exit 99 ;;
esac`);
    executable("systemd-analyze", `
printf 'systemd-analyze %s\\n' "$*" >> "$FIXTURE/calls"
case "$*" in
  '--system unit-paths') printf '%s\\n' "$UNITS" ;;
  '--system verify '*)
    [[ ! -e "$DROPIN" ]]
    [[ "$SYSTEMD_UNIT_PATH" == "\${3%/*}:" ]]
    cmp "$3" "$UNITS/pm2-henry.service"
    diff "\${3}.d/90-henry-home.conf" "$FIXTURE/expected"
    [[ \${NOISY_VERIFY:-0} != 1 ]] || echo 'Parser warning'
    [[ \${FAIL_VERIFY:-0} != 1 ]] ;;
  *) exit 99 ;;
esac`);
    const expected = "[Service]\nEnvironment=HOME=/home/henry\nEnvironment=PM2_HOME=/home/henry/.pm2\nPIDFile=/home/henry/.pm2/pm2.pid\n";
    writeFileSync(join(root, "expected"), expected);
    const script = join(root, "repair.sh");
    writeFileSync(script, source
        .replace("export PATH=/usr/sbin:/usr/bin:/sbin:/bin", `export PATH='${bin}':/usr/bin:/bin`)
        .replaceAll("/etc", etc)
        .replace("$EUID", "$REPAIR_TEST_UID"));
    return {
        root, units, base, dropin, original, expected,
        run(args: string[] = [], env: Record<string, string> = {}) {
            const result = Bun.spawnSync(["/bin/bash", script, ...args], {
                env: { ...process.env, FIXTURE: root, UNITS: units, DROPIN: dropin, REPAIR_TEST_UID: "0", ...env },
            });
            expect(readFileSync(base, "utf8")).toBe(original);
            return { status: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
        },
        calls() { try { return readFileSync(join(root, "calls"), "utf8"); } catch { return ""; } },
    };
}

test("default and explicit checks perform no configuration writes or reload", () => {
    const f = fixture();
    for (const args of [[], ["--check"], ["--dry-run"]]) {
        const result = f.run(args, { REPAIR_TEST_UID: "1000" });
        expect(result.status).toBe(0);
        expect(result.output).toContain("Read-only");
        expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
    }
    expect(f.calls()).not.toContain("daemon-reload");
    expect(f.calls()).not.toContain(" verify ");
});

test("Debian 12 omitted empty arrays pass dry-run and apply without inventing properties", () => {
    const f = fixture();
    const snapshot = readFileSync(join(f.root, "properties"), "utf8");
    expect(snapshot).not.toMatch(/^(EnvironmentFiles?|ExecStartPre|ExecStartPost|ExecStopPost)=/m);
    expect(f.run(["--dry-run"]).status).toBe(0);
    expect(f.run(["--apply"]).status).toBe(0);
});

test("explicit empty EnvironmentFiles remains supported", () => {
    expect(fixture({ EnvironmentFiles: "" }).run().status).toBe(0);
});

for (const key of ["User", "PassEnvironment", "UnsetEnvironment", "RootDirectory", "RootImage"]) {
    test(`missing ${key} is not treated as an empty optional list`, () => {
        const f = fixture({ [key]: undefined });
        expect(f.run(["--apply"]).status).toBe(1);
        expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
    });
}

for (const value of ["/etc/custom.env (ignore_errors=no)", "\nEnvironmentFiles="]) {
    test(`reject populated or duplicated EnvironmentFiles: ${JSON.stringify(value)}`, () => {
        const f = fixture({ EnvironmentFiles: value });
        expect(f.run(["--apply"]).status).toBe(1);
        expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
    });
}

test("singular EnvironmentFile output cannot bypass the check", () => {
    const f = fixture({ EnvironmentFile: "/etc/custom.env (ignore_errors=no)" });
    expect(f.run(["--apply"]).status).toBe(1);
    expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
});

for (const directive of [
    "EnvironmentFile=/etc/custom.env\n", "  EnvironmentFile = -/etc/custom.env\n",
    "EnvironmentFile=\n", "EnvironmentFile\\\n =/etc/custom.env\n", ".include /etc/custom.conf\n",
]) {
    test(`missing EnvironmentFiles still rejects disk directive ${JSON.stringify(directive)}`, () => {
        const f = fixture({}, directive);
        expect(f.run(["--apply"]).status).toBe(1);
        expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
        expect(f.calls()).not.toContain("daemon-reload");
    });
}

test("apply requires explicit flag and root", () => {
    const f = fixture();
    expect(f.run(["--apply"], { REPAIR_TEST_UID: "1000" }).status).toBe(1);
    expect(f.run(["--apply", "--check"]).status).toBe(2);
    expect(f.run(["--unknown"]).status).toBe(2);
    expect(f.calls()).toBe("");
    expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
});

test("apply backs up, validates before publication, and only daemon-reloads", () => {
    const f = fixture();
    const result = f.run(["--apply"]);
    expect(result.output).toContain("supervision is NOT repaired");
    expect(result.status).toBe(0);
    expect(readFileSync(f.dropin, "utf8")).toBe(f.expected);
    const backup = readdirSync(f.units).find((name) => name.startsWith(".pm2-henry-backup."))!;
    expect(readFileSync(join(f.units, backup, "original.service"), "utf8")).toBe(f.original);
    expect(f.calls().match(/systemctl --system daemon-reload/g)?.length).toBe(1);
    expect(f.calls().indexOf(" verify ")).toBeLessThan(f.calls().indexOf("daemon-reload"));
    expect(f.run(["--apply"]).status).toBe(1); // Never overwrite a previous drop-in.
});

for (const [key, value] of Object.entries({
    User: "root", PIDFile: "/unexpected/pid", Environment: "PM2_HOME=/unexpected",
    EnvironmentFiles: "/etc/custom.env (ignore_errors=no)", PassEnvironment: "HOME",
    UnsetEnvironment: "HOME", DropInPaths: "/run/unknown.conf", NeedDaemonReload: "yes",
    ActiveState: "active", UnitFileState: "disabled", MainPID: "123", ExecStart: "/bin/false",
})) {
    test(`refuse unexpected ${key} without writes`, () => {
        const f = fixture({ [key]: value });
        expect(f.run(["--apply"]).status).toBe(1);
        expect(readdirSync(f.units)).toEqual(["pm2-henry.service"]);
        expect(f.calls()).not.toContain("daemon-reload");
    });
}

for (const directory of ["service.d", "pm2-.service.d", "pm2-henry.service.d"]) {
    test(`refuse on-disk ${directory}, even if manager has not loaded it`, () => {
        const f = fixture();
        mkdirSync(join(f.units, directory));
        expect(f.run(["--apply"]).status).toBe(1);
        expect(f.calls()).not.toContain("daemon-reload");
    });
}

for (const flag of ["FAIL_VERIFY", "NOISY_VERIFY"]) {
    test(`${flag} leaves live configuration untouched`, () => {
        const f = fixture();
        expect(f.run(["--apply"], { [flag]: "1" }).status).toBe(1);
        expect(readdirSync(f.units)).not.toContain("pm2-henry.service.d");
        expect(f.calls()).not.toContain("daemon-reload");
    });
}

const reloadFailures: Record<string, string>[] = [{ FAIL_RELOAD: "1" }, { POST_USER: "root" }];
for (const env of reloadFailures) {
    test(`rollback on ${Object.keys(env)[0]} removes only the new drop-in`, () => {
        const f = fixture();
        const result = f.run(["--apply"], env);
        expect(result.status).toBe(1);
        expect(result.output).toContain("reverting only this helper");
        expect(readdirSync(f.units)).not.toContain("pm2-henry.service.d");
        expect(f.calls().match(/systemctl --system daemon-reload/g)?.length).toBe(2);
    });
}

for (const flag of ["RACE_DROPIN", "CHANGE_DROPIN"]) {
    test(`${flag}: never remove another writer's configuration`, () => {
        const f = fixture();
        const result = f.run(["--apply"], { [flag]: "1" });
        expect(result.status).toBe(1);
        expect(result.output).toContain("not removing it");
        expect(readFileSync(f.dropin, "utf8")).toContain(flag === "RACE_DROPIN" ? "concurrent" : "external edit");
        expect(f.calls().match(/systemctl --system daemon-reload/g)?.length ?? 0).toBe(flag === "RACE_DROPIN" ? 0 : 1);
    });
}
