#!/usr/bin/env bash
set -euo pipefail

validate_release_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3" mode="${4:-deploy}"
  [[ "$manifest_ref" != -* ]] || { echo 'manifest ref must not begin with a dash' >&2; return 20; }
  [[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; return 20; }
  git -C "$repo" rev-parse --verify "$manifest_ref^{commit}" >/dev/null || {
    echo 'manifest ref is not a reachable commit' >&2; return 20;
  }
  local manifest_payload
  manifest_payload="$(git -C "$repo" show "$manifest_ref:deploy/ysna/ReleaseManifest.json")" || {
    echo 'ReleaseManifest.json missing from manifest ref' >&2; return 20;
  }
  ANVIL_MANIFEST_PAYLOAD="$manifest_payload" python3 - "$expected" "$mode" <<'PY'
import json, os, sys
expected, mode = sys.argv[1:]
doc = json.loads(os.environ["ANVIL_MANIFEST_PAYLOAD"])
if doc.get("status") != "APPROVED_FOR_DEPLOYMENT":
    raise SystemExit("release manifest is not approved")
source = doc.get("source", {})
if source.get("working_tree") != "CLEAN":
    raise SystemExit("release manifest source working tree is not clean")
if mode == "rollback":
    rollback_commits = doc.get("rollback", {}).get("approved_commits", [])
    if expected != source.get("commit") and expected not in rollback_commits:
        raise SystemExit("rollback commit is not approved by release manifest")
elif source.get("commit") != expected:
    raise SystemExit("release manifest source commit mismatch")
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
