#!/usr/bin/env bash
set -euo pipefail

ROOT="${ANVIL_DEPLOY_ROOT:?ANVIL_DEPLOY_ROOT is required}"
: "${ANVIL_DATABASE_URL:?ANVIL_DATABASE_URL is required}"
RELEASE="${ANVIL_RELEASE_COMMIT:?ANVIL_RELEASE_COMMIT is required}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo 'full release SHA required' >&2; exit 2; }

case "$ANVIL_DATABASE_URL" in
  postgresql+psycopg2://*|postgresql://*|postgres://*) ;;
  *)
    echo 'ANVIL_DATABASE_URL must use a PostgreSQL scheme' >&2
    exit 22
    ;;
esac
command -v python3 >/dev/null 2>&1 || {
  echo 'database backup requires python3 for safe connection parsing' >&2
  exit 23
}
if ! SERVICE_CONFIG="$(printf '%s' "$ANVIL_DATABASE_URL" | python3 -c '
import re
import sys
from urllib.parse import parse_qsl, unquote_to_bytes, urlsplit

sys.stdout.reconfigure(newline="\n")
raw = sys.stdin.read()
if re.search(r"%(?![0-9A-Fa-f]{2})", raw):
    raise ValueError("malformed percent escape")
parsed = urlsplit(raw)
if parsed.scheme not in {"postgresql+psycopg2", "postgresql", "postgres"} or parsed.fragment:
    raise ValueError("invalid scheme or fragment")

def decode(value):
    if value is None:
        return None
    result = unquote_to_bytes(value).decode("utf-8", "strict")
    if any(char in result for char in ("\x00", "\n", "\r")):
        raise ValueError("unsafe decoded control")
    return result

user = decode(parsed.username)
password = decode(parsed.password)
host = decode(parsed.hostname)
dbname = decode(parsed.path[1:] if parsed.path.startswith("/") else "")
try:
    port = parsed.port
except ValueError as exc:
    raise ValueError("invalid port") from exc
if not user or not host or not dbname or not (port is None or 1 <= port <= 65535):
    raise ValueError("missing required connection field")

allowed = {"sslmode", "connect_timeout", "application_name", "options"}
pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True) if parsed.query else []
seen = set()
for key, value in pairs:
    if key in seen or key not in allowed:
        raise ValueError("duplicate, unknown, or core override query")
    seen.add(key)
    if any(char in value for char in ("\x00", "\n", "\r")):
        raise ValueError("unsafe query control")

def quote(value):
    return "\x27" + value.replace("\\", "\\\\").replace("\x27", "\\\x27") + "\x27"

values = [("user", user)]
if password is not None:
    values.append(("password", password))
values.append(("host", host))
if port is not None:
    values.append(("port", str(port)))
values.append(("dbname", dbname))
values.extend(pairs)
print("[anvil_backup]")
for key, value in values:
    print(f"{key}={quote(value)}")
')"; then
  echo 'ANVIL_DATABASE_URL is invalid for safe backup connection' >&2
  exit 24
fi

BACKUP_DIR="$ROOT/backups/c21/$RELEASE"
EVIDENCE_DIR="$ROOT/evidence"
BACKUP="$BACKUP_DIR/anvil.dump"
LISTING="$BACKUP_DIR/anvil.restore-list.txt"
RECEIPT="$EVIDENCE_DIR/c21-db-backup.json"
mkdir -p "$BACKUP_DIR" "$EVIDENCE_DIR"
umask 077
rm -f "$RECEIPT"

tmp="$BACKUP.tmp.$$"
trap 'rm -f "$tmp" "$LISTING.tmp.$$"' EXIT

host_pg_dump="$(command -v pg_dump || true)"
host_pg_restore="$(command -v pg_restore || true)"
if [[ -n "$host_pg_dump" && -n "$host_pg_restore" ]]; then
  if ! printf '%s\n' "$SERVICE_CONFIG" | PGSERVICEFILE=/dev/fd/3 PGSERVICE=anvil_backup \
      "$host_pg_dump" --format=custom --no-owner --no-acl --file="$tmp" 3<&0 2>/dev/null; then
    echo 'database backup failed using host PostgreSQL client' >&2
    exit 13
  fi
  if ! "$host_pg_restore" --list "$tmp" > "$LISTING.tmp.$$" 2>/dev/null; then
    echo 'database backup restore-list validation failed using host PostgreSQL client' >&2
    exit 14
  fi
else
  command -v docker >/dev/null 2>&1 || {
    echo 'database backup requires host PostgreSQL clients or Docker' >&2
    exit 15
  }
  [[ "$(docker inspect --format '{{.State.Running}}' shared-db 2>/dev/null || true)" == true ]] || {
    echo 'database backup requires the running shared-db container' >&2
    exit 16
  }
  docker exec -u postgres shared-db pg_dump --version >/dev/null 2>&1 || {
    echo 'shared-db pg_dump is unavailable' >&2
    exit 17
  }
  docker exec -u postgres shared-db pg_restore --version >/dev/null 2>&1 || {
    echo 'shared-db pg_restore is unavailable' >&2
    exit 18
  }
  if ! printf '%s\n' "$SERVICE_CONFIG" | docker exec -i -u postgres shared-db sh -ceu '
      exec 3<&0
      export PGSERVICEFILE=/dev/fd/3 PGSERVICE=anvil_backup
      exec pg_dump --format=custom --no-owner --no-acl --file=-
    ' > "$tmp" 2>/dev/null; then
    echo 'database backup failed using shared-db PostgreSQL client' >&2
    exit 20
  fi
  if ! docker exec -i -u postgres shared-db pg_restore --list \
      < "$tmp" > "$LISTING.tmp.$$" 2>/dev/null; then
    echo 'database backup restore-list validation failed using shared-db PostgreSQL client' >&2
    exit 21
  fi
fi
[[ -s "$tmp" ]] || { echo 'database backup is empty' >&2; exit 10; }
chmod 600 "$tmp"
[[ -s "$LISTING.tmp.$$" ]] || { echo 'database backup restore list is empty' >&2; exit 11; }
mv -f "$LISTING.tmp.$$" "$LISTING"
chmod 600 "$LISTING"
mv -f "$tmp" "$BACKUP"
chmod 600 "$BACKUP"

bytes="$(wc -c < "$BACKUP" | tr -d '[:space:]')"
digest="$(sha256sum "$BACKUP" | cut -d' ' -f1)"
mode="$(stat -c '%a' "$BACKUP")"
[[ "$mode" == 600 ]] || { echo 'database backup must be mode 0600' >&2; exit 12; }
timestamp="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
receipt_tmp="$RECEIPT.tmp.$$"
printf '{"status":"BACKUP_VERIFIED","release_commit":"%s","bytes":%s,"sha256":"%s","restore_listable":true,"mode":"600","created_at":"%s","secret_values":"omitted"}\n' \
  "$RELEASE" "$bytes" "$digest" "$timestamp" > "$receipt_tmp"
chmod 600 "$receipt_tmp"
mv -f "$receipt_tmp" "$RECEIPT"
printf 'C-21 database backup verified: bytes=%s sha256=%s\n' "$bytes" "$digest"
