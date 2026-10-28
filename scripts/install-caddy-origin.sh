#!/usr/bin/env bash
# Usage: install-caddy-origin.sh [--check|--apply] BUNDLE_DIRECTORY
# HTTPS-only cleanup: requires an already valid origin certificate and CF Strict.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
umask 077
mode=--check
case ${1:-} in --check|--apply) mode=$1; shift ;; esac
[[ $# == 1 ]] || { echo "Usage: $0 [--check|--apply] BUNDLE_DIRECTORY" >&2; exit 2; }
die() { echo "ERROR: $*" >&2; exit 1; }
[[ $mode != --apply || $EUID == 0 ]] || die '--apply requires root'
bundle_uid=$UID
[[ $mode != --apply ]] || bundle_uid=${SUDO_UID:-$UID}
[[ $bundle_uid =~ ^[0-9]+$ ]] || die 'Invalid invoking user ID'
live=/etc/caddy/Caddyfile
bundle=$(realpath -ms -- "$1")
work= stage= phase=checking

# Bundle ancestors may also belong to the invoking user; live stays root-only.
safe_path() {
  local path=$1 allowed=${2:-0} owner bits
  while :; do
    [[ ! -L $path && -e $path ]] || die "Missing path or symlink: $path"
    read -r owner bits < <(stat -c '%u %a' -- "$path")
    [[ $owner == 0 || $owner == "$allowed" ]] && (( (8#$bits & 0022) == 0 )) || die "Unsafe ownership/permissions: $path"
    [[ $path != / ]] || break
    path=$(dirname -- "$path")
  done
}
service_ready() {
  [[ $(systemctl show caddy.service -p ActiveState --value) == active &&
     $(systemctl show caddy.service -p SubState --value) == running &&
     $(systemctl show caddy.service -p NeedDaemonReload --value) == no &&
     -z $(systemctl show caddy.service -p Job --value) ]] || die 'Caddy inactive or service reload/job pending'
  [[ $(systemctl show caddy.service -p User --value) == caddy &&
     $(systemctl show caddy.service -p Group --value) == caddy ]] || die 'Unexpected Caddy service identity'
  local reload
  reload=$(systemctl show caddy.service -p ExecReload --value)
  [[ $reload == *'argv[]=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force ;'* &&
     $reload != *'} {'* ]] || die 'Unexpected Caddy reload command'
}
active_matches_disk() {
  python3 - "$live" <<'PY'
import http.client, json, subprocess, sys
connection = http.client.HTTPConnection("127.0.0.1", 2019, timeout=5)
try:
    disk = json.loads(subprocess.check_output([
        "/usr/bin/caddy", "adapt", "--adapter", "caddyfile", "--config", sys.argv[1]
    ], timeout=10))
    connection.request("GET", "/config/")
    response = connection.getresponse()
    if response.status != 200:
        raise ValueError(f"admin GET returned HTTP {response.status}")
    active = json.loads(response.read())
    if json.dumps(active, sort_keys=True) != json.dumps(disk, sort_keys=True):
        raise ValueError("active Caddy config differs from disk; rollback baseline unsafe")
except (OSError, ValueError, subprocess.SubprocessError, http.client.HTTPException) as error:
    sys.exit(f"ERROR: active-config verification failed: {error}")
finally:
    connection.close()
PY
}
https_health() {
  local status
  status=$(curl --noproxy '*' --silent --show-error --max-time 10 --output /dev/null \
    --write-out '%{http_code}' --resolve api.henry.ink:443:127.0.0.1 \
    https://api.henry.ink/api/health) || die 'Verified origin HTTPS health request failed'
  [[ $status == 200 ]] || die "Origin HTTPS health returned $status, expected 200"
}
retired_http_checks() {
  local result
  result=$(curl --noproxy '*' --silent --show-error --max-time 10 --output /dev/null \
    --write-out '%{http_code} %{redirect_url}' --header 'Host: api.henry.ink' \
    http://127.0.0.1/api/health) || die 'HTTP redirect check failed'
  [[ $result == '308 https://api.henry.ink/api/health' ]] || die "Unexpected API HTTP response: $result"
  curl --noproxy '*' --silent --show-error --max-time 10 \
    --header 'Host: arena.henry.ink' http://127.0.0.1/api/health \
    --output "$work/arena-response" || die 'Retired alias check failed'
  [[ ! -s $work/arena-response ]] || die 'Retired alias still returns a response body'
}
matches() {
  safe_path "$live"
  [[ -f $live ]] && cmp -s -- "$1" "$live"
}
prepare_stage() {
  stage=$(mktemp /etc/caddy/.Caddyfile.XXXXXXXX) || return 1
  install -o 0 -g "$live_group" -m "$live_mode" -- "$1" "$stage" || return 1
  cmp -s -- "$1" "$stage" || die 'Staging copy mismatch'
}
rollback() {
  echo 'Reload/health failed; attempting guarded rollback.' >&2
  prepare_stage "$work/Caddyfile.before" || return 1
  matches "$work/Caddyfile.candidate" || { echo 'Live config changed; NOT rolling back. Backups retained.' >&2; return 1; }
  mv -fT -- "$stage" "$live" || return 1
  stage=
  systemctl reload caddy.service || { echo 'Rollback reload failed; backups retained.' >&2; return 1; }
  echo 'Previous config restored and reloaded; backups retained.' >&2
}
cleanup() {
  local rc=$?
  trap - EXIT HUP INT TERM
  if [[ $phase == installed ]]; then
    rc=1
    (trap '[[ -z $stage ]] || rm -f -- "$stage"' EXIT; rollback) || echo "Rollback incomplete; inspect $work" >&2
  fi
  [[ -z $stage ]] || rm -f -- "$stage"
  if [[ $mode == --check && -n $work ]]; then rm -rf -- "$work"; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
safe_path "$bundle" "$bundle_uid"
safe_path "$live"
[[ -d $bundle && -f $live ]] || die 'Expected bundle directory and plain live Caddyfile'
service_ready
if [[ $mode == --apply ]]; then
  # Advisory only: external editors must honor this lock to close the compare/rename race.
  exec 9< /etc/caddy
  flock -n 9 || die 'Another installer holds the Caddy directory lock'
  work=$(mktemp -d /etc/caddy/.origin-install.XXXXXXXX)
  chown root:caddy "$work"
  chmod 0750 "$work"
  echo "Retained backup directory: $work"
else
  work=$(mktemp -d /tmp/caddy-origin-check.XXXXXXXX)
fi
safe_path "$bundle/SHA256SUMS" "$bundle_uid"
[[ -f $bundle/SHA256SUMS ]] || die 'Manifest must be a plain file'
cp --no-dereference -- "$bundle/SHA256SUMS" "$work/SHA256SUMS"
[[ ! -L $work/SHA256SUMS && -f $work/SHA256SUMS ]] || die 'Manifest changed to a non-plain file'
declare -A seen=()
pattern='^([[:xdigit:]]{64}) [ *]([[:alnum:]][[:alnum:]._-]*)$'
while IFS= read -r line || [[ -n $line ]]; do
  [[ $line =~ $pattern ]] || die 'Manifest must contain SHA256 hashes and simple sibling filenames'
  name=${BASH_REMATCH[2]}
  [[ $name != SHA256SUMS && -z ${seen[$name]:-} ]] || die "Duplicate/reserved manifest filename: $name"
  seen[$name]=1
  safe_path "$bundle/$name" "$bundle_uid"
  [[ -f $bundle/$name ]] || die "Not a plain file: $name"
  cp --no-dereference -- "$bundle/$name" "$work/$name"
  [[ ! -L $work/$name && -f $work/$name ]] || die "Source changed to a non-plain file: $name"
done < "$work/SHA256SUMS"
[[ ${seen[Caddyfile.before]:-} && ${seen[Caddyfile.candidate]:-} ]] || die 'Manifest must cover before and candidate'
(cd "$work" && sha256sum --check --strict SHA256SUMS) || die 'Bundle hash verification failed'
matches "$work/Caddyfile.before" || die 'Live config differs from reviewed before file'
active_matches_disk
https_health
(cd "$work" && /usr/bin/caddy adapt --adapter caddyfile --config "$work/Caddyfile.candidate" > /dev/null)
if [[ $mode == --check ]]; then
  echo 'Check passed: hashes, disk/active baseline, service state, syntax and verified origin HTTPS; no live changes.'
  exit 0
fi
read -r live_group live_mode < <(stat -c '%g %a' -- "$live")
# All reviewed companions are available to validation; the baseline stays root-only.
for name in "${!seen[@]}"; do
  [[ $name != Caddyfile.before ]] || continue
  chown root:caddy "$work/$name"
  chmod 0640 "$work/$name"
done
home=$(getent passwd caddy | cut -d: -f6)
[[ $home == /* ]] || die 'No absolute HOME in passwd for caddy'
(cd "$work" && HOME="$home" runuser -u caddy -- /usr/bin/caddy validate \
  --adapter caddyfile --config "$work/Caddyfile.candidate")
prepare_stage "$work/Caddyfile.candidate"
service_ready
active_matches_disk
matches "$work/Caddyfile.before" || die 'Live config drifted before installation'
phase=installed
mv -fT -- "$stage" "$live"
stage=
systemctl reload caddy.service || die 'Caddy reload failed'
https_health
retired_http_checks
matches "$work/Caddyfile.candidate" || die 'Live config drifted after reload'
active_matches_disk
phase=healthy
echo "Applied; verified HTTPS health, API HTTP redirect and retired alias checks passed. Backups: $work"
echo 'No Cloudflare mode or DNS change made by this helper. Port 80 remains available for ACME and other sites.'
