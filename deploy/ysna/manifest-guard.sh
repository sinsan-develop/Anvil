#!/usr/bin/env bash
set -euo pipefail

validate_release_manifest() {
  local manifest="$1" repo="$2" expected="$3"
  [[ -f "$manifest" ]] || { echo 'ReleaseManifest.json missing' >&2; return 20; }
  python3 - "$manifest" "$expected" <<'PY'
import json, sys
path, expected = sys.argv[1:]
with open(path, encoding="utf-8") as stream:
    doc = json.load(stream)
if doc.get("status") != "APPROVED_FOR_DEPLOYMENT":
    raise SystemExit("release manifest is not approved")
source = doc.get("source", {})
if source.get("commit") != expected or source.get("working_tree") != "CLEAN":
    raise SystemExit("release manifest source mismatch")
authority = doc.get("authority", {})
if not authority.get("successor_binding"):
    raise SystemExit("approved successor binding is missing")
binding_sha = authority.get("successor_binding_sha256", "")
if len(binding_sha) != 64 or any(c not in "0123456789abcdefABCDEF" for c in binding_sha):
    raise SystemExit("successor binding hash is invalid")
PY
  git -C "$repo" cat-file -e "$expected^{commit}"
  git -C "$repo" merge-base --is-ancestor "$expected" "origin/main" || {
    echo 'release commit is not reachable from origin/main' >&2; return 21;
  }
}
