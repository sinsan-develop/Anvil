#!/usr/bin/env bash
set -euo pipefail

ROOT="${ANVIL_DEPLOY_ROOT:?ANVIL_DEPLOY_ROOT is required}"
: "${ANVIL_DATABASE_URL:?ANVIL_DATABASE_URL is required}"
RELEASE="${ANVIL_RELEASE_COMMIT:?ANVIL_RELEASE_COMMIT is required}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo 'full release SHA required' >&2; exit 2; }

case "$ANVIL_DATABASE_URL" in
  postgresql+psycopg2://*)
    LIBPQ_DATABASE_URL="postgresql://${ANVIL_DATABASE_URL#postgresql+psycopg2://}"
    ;;
  postgresql://*|postgres://*)
    LIBPQ_DATABASE_URL="$ANVIL_DATABASE_URL"
    ;;
  *)
    echo 'ANVIL_DATABASE_URL must use a PostgreSQL scheme' >&2
    exit 22
    ;;
esac

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
  if ! PGDATABASE="$LIBPQ_DATABASE_URL" "$host_pg_dump" \
      --format=custom --no-owner --no-acl --file="$tmp" 2>/dev/null; then
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
  [[ "$ANVIL_DATABASE_URL" != *$'\n'* && "$ANVIL_DATABASE_URL" != *$'\r'* ]] || {
    echo 'ANVIL_DATABASE_URL contains an unsupported line break' >&2
    exit 19
  }
  if ! printf '%s\n' "$LIBPQ_DATABASE_URL" | docker exec -i -u postgres shared-db sh -ceu '
      IFS= read -r PGDATABASE
      export PGDATABASE
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
