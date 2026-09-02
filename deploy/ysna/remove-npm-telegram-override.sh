#!/usr/bin/env bash
set -euo pipefail

npm_container="${NPM_CONTAINER:-nginx-proxy-manager}"
override_path="/data/nginx/custom/server_proxy.conf"
expected_sha="406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf"
backup_dir="${BACKUP_DIR:-$HOME/deploy/anvil/runtime/npm-custom-override-backup}"
backup_path="$backup_dir/server_proxy.conf"

mkdir -p "$backup_dir"
actual_sha="$(docker exec "$npm_container" sha256sum "$override_path" | awk '{print $1}')"
[[ "$actual_sha" == "$expected_sha" ]] || {
  echo "override hash mismatch; refusing removal" >&2
  exit 4
}

docker cp "$npm_container:$override_path" "$backup_path"
docker exec "$npm_container" rm -- "$override_path"
restore() {
  docker cp "$backup_path" "$npm_container:$override_path"
}

if ! docker exec "$npm_container" nginx -t; then
  restore
  docker exec "$npm_container" nginx -t
  docker exec "$npm_container" nginx -s reload
  echo "override removal rolled back after nginx test failure" >&2
  exit 10
fi
if ! docker exec "$npm_container" nginx -s reload; then
  restore
  docker exec "$npm_container" nginx -t
  docker exec "$npm_container" nginx -s reload
  echo "override removal rolled back after nginx reload failure" >&2
  exit 11
fi
echo "NPM Telegram internal override removed; backup=$backup_path"
