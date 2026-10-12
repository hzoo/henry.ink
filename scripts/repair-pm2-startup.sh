#!/bin/bash
# Configuration only: never adopt the running PM2 daemon or change its saved apps.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C SYSTEMD_PAGER=cat
unset SYSTEMD_UNIT_PATH SYSTEMD_BUS_ADDRESS SYSTEMD_BUS_REMOTE SYSTEMD_BUS_MACHINE

usage() {
    cat <<'EOF'
Usage: bash scripts/repair-pm2-startup.sh [--check|--dry-run|--apply]

Default: read-only check and print the proposed drop-in. Run locally on the VPS.
--apply requires root; backs up, validates, installs, and daemon-reloads only.
Existing drop-ins (including a previous repair) require manual review.
Run without concurrent systemd edits; daemon-reload is manager-wide.

This does NOT fix live supervision. Maintenance-window adoption or a planned
reboot is still required. Reconcile saved versus running apps separately first:
the PM2 daemon manages unrelated apps too. This helper never runs pm2 save,
starts/stops/restarts/kills services, grants sudo, or changes boot enablement.
EOF
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

mode=check
if (( $# > 1 )); then usage >&2; exit 2; fi
case "${1:---check}" in
    --check|--dry-run) ;;
    --apply) mode=apply ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
esac
[[ $mode != apply || $EUID == 0 ]] || die '--apply requires root; no writes made.'

unit=pm2-henry.service
base=/etc/systemd/system/$unit
dropdir=$base.d
dropin=$dropdir/90-henry-home.conf
pm2=/home/henry/.bun/install/global/node_modules/pm2/bin/pm2
for command in systemctl systemd-analyze stat cmp mktemp install ln; do
    command -v "$command" >/dev/null || die "Required command unavailable: $command"
done

proposal() {
    printf '%s\n' '[Service]' 'Environment=HOME=/home/henry' \
        'Environment=PM2_HOME=/home/henry/.pm2' 'PIDFile=/home/henry/.pm2/pm2.pid'
}

# Read one manager snapshot, not a mixture of properties from separate queries.
properties=LoadState,FragmentPath,DropInPaths,NeedDaemonReload,UnitFileState,ActiveState,SubState,MainPID,ControlPID,User,Type,PIDFile,Environment,EnvironmentFiles,EnvironmentFile,PassEnvironment,UnsetEnvironment,RootDirectory,RootImage,ExecStart,ExecStop,ExecReload,ExecStartPre,ExecStartPost,ExecStopPost
snapshot() { systemctl --system show "$unit" --all --property="$properties"; }
property() {
    local key=$1 data=$2
    printf '%s\n' "$data" | awk -v key="$key" '
        index($0, key "=") == 1 { count++; print substr($0, length(key) + 2) }
        END { if (count != 1) exit 1 }
    '
}
expect() {
    local actual
    actual=$(property "$1" "$current") || die "Missing/duplicate property: $1"
    [[ $actual == "$2" ]] || die "Unexpected $1: $actual (expected: $2)"
}

check_environment_files() {
    # systemd 252 prints no row for an empty EnvironmentFiles array, even --all.
    # Accept absence only here; reject either spelling if populated or duplicated.
    printf '%s\n' "$current" | awk '
        /^EnvironmentFiles?=/ {
            key = substr($0, 1, index($0, "=") - 1)
            if (++seen[key] > 1 || $0 != key "=") bad = 1
        }
        END { exit bad }
    ' || die 'Unexpected EnvironmentFile/EnvironmentFiles configuration.'
    # The verified base is the only source (drop-ins and stale state are refused).
    # Do not infer safety from a missing/unsupported property alone.
    awk '
        /^[[:space:]]*[#;]/ { next }
        {
            line = line $0
            if (sub(/\\$/, " ", line)) next
            if (line ~ /^[[:space:]]*EnvironmentFiles?[[:space:]]*=/ ||
                line ~ /^[[:space:]]*\.include([[:space:]]|$)/) bad = 1
            line = ""
        }
        END { if (line != "") bad = 1; exit bad }
    ' "$base" || die 'EnvironmentFile directive or unsupported include/continuation in base unit.'
}

check_disk() {
    local paths path directory permissions
    [[ -f $base && ! -L $base ]] || die "Expected a regular, non-symlink unit: $base"
    # Root-owned, non-writable configuration parents avoid unsafe install targets.
    for path in /etc /etc/systemd /etc/systemd/system "$base"; do
        [[ ! -L $path ]] || die "Symlink requires manual review: $path"
        [[ $(stat -c %u "$path") == 0 ]] || die "Not root-owned: $path"
        permissions=$(stat -c %a "$path")
        (( (8#$permissions & 0022) == 0 )) || die "Group/world-writable: $path"
    done
    paths=$(systemd-analyze --system unit-paths) || die 'Cannot enumerate system unit paths.'
    [[ -n $paths ]] || die 'Empty system unit path list.'
    while IFS= read -r path; do
        [[ $path == /* ]] || die "Unexpected unit search path: $path"
        # Include global and dash-prefix drop-ins, even if not yet daemon-reloaded.
        for directory in "$path/service.d" "$path/pm2-.service.d" "$path/$unit.d"; do
            [[ ! -e $directory && ! -L $directory ]] || die "Existing override directory requires manual review: $directory"
        done
    done <<< "$paths"
    [[ ! -e $dropdir && ! -L $dropdir ]] || die "Existing drop-in directory: $dropdir"
}

check_baseline() {
    local key value token home_seen=0 pm2_seen=0
    expect LoadState loaded
    expect FragmentPath "$base"
    expect DropInPaths ''
    expect NeedDaemonReload no
    expect UnitFileState enabled
    expect ActiveState inactive
    expect SubState dead
    expect MainPID 0
    expect ControlPID 0
    expect User henry
    expect Type forking
    expect PIDFile /root/.pm2/pm2.pid
    check_environment_files
    for key in PassEnvironment UnsetEnvironment RootDirectory RootImage; do
        expect "$key" ''
    done
    # Do not eval systemctl's serialized environment. Refuse complex/unknown forms.
    value=$(property Environment "$current")
    local -a environment
    read -r -a environment <<< "$value"
    for token in "${environment[@]}"; do
        case "$token" in
            PM2_HOME=/root/.pm2) pm2_seen=$((pm2_seen + 1)) ;;
            HOME=/home/henry) home_seen=$((home_seen + 1)) ;;
            PATH=*) [[ $token != *[\"\'\\]* ]] || die 'Quoted PATH requires manual review.' ;;
            *) die "Unexpected environment key: ${token%%=*}" ;;
        esac
    done
    (( pm2_seen == 1 && home_seen <= 1 )) || die 'Unexpected HOME/PM2_HOME entries.'
    for key in ExecStart ExecStop; do
        value=$(property "$key" "$current")
        local action=resurrect
        [[ $key != ExecStop ]] || action=kill
        # One unprefixed command only; trailing fields are systemd execution metadata.
        local prefix="{ path=$pm2 ; argv[]=$pm2 $action ; ignore_errors=no ; "
        [[ $value == "$prefix"*' }' ]] || die "Unexpected $key: $value"
        value=${value#"$prefix"}
        value=${value%' }'}
        [[ $value != *'{'* && $value != *'}'* ]] || die "Multiple commands in $key"
    done
}

check_disk
current=$(snapshot) || die 'Cannot read system manager properties.'
check_baseline
before=$current
printf 'Known inactive, enabled baseline verified. Proposed %s:\n' "$dropin"
proposal
if [[ $mode == check ]]; then
    printf '\nRead-only: no files written or configuration reloaded.\n'
    printf 'Staged systemd-analyze validation runs only with --apply as root.\n'
    usage
    exit 0
fi

umask 077
backup=$(mktemp -d /etc/systemd/system/.pm2-henry-backup.XXXXXXXX)
printf 'Backup/staging directory (retained): %s\n' "$backup"
install -m 600 "$base" "$backup/original.service"
printf '%s\n' "$before" > "$backup/properties.before"
mkdir "$backup/staged" "$backup/staged/$unit.d"
install -m 644 "$backup/original.service" "$backup/staged/$unit"
proposal > "$backup/staged/$unit.d/90-henry-home.conf"
chmod 644 "$backup/staged/$unit.d/90-henry-home.conf"

# A trailing colon retains system paths for dependencies. Nothing is executed.
if ! SYSTEMD_UNIT_PATH="$backup/staged:" systemd-analyze --system verify \
    "$backup/staged/$unit" > "$backup/validation.log" 2>&1; then
    cat "$backup/validation.log" >&2
    die 'Staged validation failed; live configuration untouched.'
fi
# Some systemd versions report parser warnings without a failing exit status.
[[ ! -s $backup/validation.log ]] || {
    cat "$backup/validation.log" >&2
    die 'Validation emitted diagnostics; refusing installation.'
}
check_disk
cmp -s "$base" "$backup/original.service" || die 'Unit changed during staging.'
current=$(snapshot)
[[ $current == "$before" ]] || die 'Manager properties changed during staging.'

directory_created=no
installed=no
complete=no
cleanup() {
    local status=$?
    trap - EXIT HUP INT TERM
    if [[ $complete != yes ]]; then
        printf 'Repair failed; reverting only this helper\047s drop-in. Backup: %s\n' "$backup" >&2
        if [[ $installed == yes && ( -e $dropin || -L $dropin ) ]]; then
            if [[ ! -L $dropin && $dropin -ef $backup/publish.conf ]] \
                && cmp -s "$dropin" "$backup/staged/$unit.d/90-henry-home.conf"; then
                if rm -- "$dropin"; then
                    systemctl --system daemon-reload || printf 'ERROR: rollback daemon-reload failed; manual review required.\n' >&2
                else
                    printf 'ERROR: drop-in removal failed; manual review required.\n' >&2
                fi
            else
                printf 'ERROR: drop-in changed externally; not removing it. Manual review required.\n' >&2
            fi
        fi
        if [[ $directory_created == yes ]]; then rmdir "$dropdir" 2>/dev/null || true; fi
        (( status != 0 )) || status=1
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -m 755 "$dropdir"
directory_created=yes
# Atomic, no-clobber publication on the same filesystem; do not overwrite a race.
install -m 644 "$backup/staged/$unit.d/90-henry-home.conf" "$backup/publish.conf"
installed=yes
ln "$backup/publish.conf" "$dropin"
systemctl --system daemon-reload
current=$(snapshot)
expect PIDFile /home/henry/.pm2/pm2.pid
expect DropInPaths "$dropin"
expect NeedDaemonReload no
check_environment_files

old_environment=$(property Environment "$before")
new_environment=$(property Environment "$current")
normalize_environment() { printf '%s\n' "$1" | tr ' ' '\n' | sort; }
expected_environment=${old_environment/PM2_HOME=\/root\/.pm2/PM2_HOME=\/home\/henry\/.pm2}
if [[ " $old_environment " != *' HOME=/home/henry '* ]]; then
    expected_environment="$expected_environment HOME=/home/henry"
fi
[[ $(normalize_environment "$new_environment") == "$(normalize_environment "$expected_environment")" ]] \
    || die 'Reloaded environment does not match the proposed change.'
unchanged_properties() { printf '%s\n' "$1" | sed '/^Environment=/d; /^PIDFile=/d; /^DropInPaths=/d'; }
[[ $(unchanged_properties "$before") == "$(unchanged_properties "$current")" ]] \
    || die 'Unexpected property or runtime-state change after daemon-reload.'
cmp -s "$base" "$backup/original.service" || die 'Base unit changed during installation.'
cmp -s "$dropin" "$backup/staged/$unit.d/90-henry-home.conf" || die 'Drop-in changed during installation.'
complete=yes
printf '\nBoot configuration staged and loaded; service remains enabled but inactive.\n'
printf 'Live PM2 supervision is NOT repaired. Maintenance-window adoption or a planned\n'
printf 'reboot is still required, after separately reconciling saved versus running apps.\n'
printf 'No PM2 commands or service lifecycle actions were performed. Backup: %s\n' "$backup"
