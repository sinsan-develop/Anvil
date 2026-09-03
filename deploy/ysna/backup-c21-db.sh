#!/usr/bin/env bash
set -euo pipefail

ROOT="${ANVIL_DEPLOY_ROOT:?ANVIL_DEPLOY_ROOT is required}"
: "${ANVIL_DATABASE_URL:?ANVIL_DATABASE_URL is required}"
RELEASE="${ANVIL_RELEASE_COMMIT:?ANVIL_RELEASE_COMMIT is required}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo 'full release SHA required' >&2; exit 2; }

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
pg_dump --format=custom --no-owner --no-acl --dbname="$ANVIL_DATABASE_URL" --file="$tmp"
[[ -s "$tmp" ]] || { echo 'database backup is empty' >&2; exit 10; }
chmod 600 "$tmp"
pg_restore --list "$tmp" > "$LISTING.tmp.$$"
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
