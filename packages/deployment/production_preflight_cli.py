"""Read-only F-18 local/WSL preflight; never authorizes Production deployment."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import fields
from pathlib import Path

from packages.deployment.deploy_approval import DeployApprovalSubject
from packages.deployment.promotion_preflight import (
    APPROVED_DEVELOPMENT_REMOTE, validate_existing_checkout, verify_approval_release,
)
from packages.deployment.release_manifest import ReleaseExpectations


_MAX_JSON_BYTES = 16384
_MAX_KEY_BYTES = 8192
_APPROVAL_FIELDS = frozenset({
    "environment_id", "release_manifest_hash", "migration_plan_hash", "rollback_plan_hash",
})
_EVIDENCE_FIELDS = frozenset({"git_commit", "runtime_image_digest", "image_digests"})
_EXPECTED_FIELDS = frozenset(field.name for field in fields(ReleaseExpectations))


class _InputError(ValueError):
    pass


class _SafeParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise _InputError("INPUT_INVALID")


def _read_limited(path: Path, limit: int) -> bytes:
    with path.open("rb") as stream:
        raw = stream.read(limit + 1)
    if not raw or len(raw) > limit:
        raise _InputError("INPUT_INVALID")
    return raw


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise _InputError("INPUT_INVALID")
        result[key] = value
    return result


def _reject_constant(value: str) -> None:
    raise _InputError("INPUT_INVALID")


def _json_object(path: Path, *, required: frozenset[str], optional: frozenset[str] = frozenset()) -> dict:
    raw = _read_limited(path, _MAX_JSON_BYTES)
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs, parse_constant=_reject_constant)
    if not isinstance(value, dict) or not required <= value.keys() or not value.keys() <= required | optional:
        raise _InputError("INPUT_INVALID")
    return value


def _parser() -> _SafeParser:
    parser = _SafeParser(description="F-18 read-only local/WSL preflight")
    for name in (
        "checkout", "manifest", "trusted-public-key", "expected-observations",
        "wsl-evidence", "approval-subject",
    ):
        parser.add_argument("--" + name, required=True, type=Path)
    for name in (
        "trusted-fingerprint", "observed-environment-id", "migration-plan-hash", "rollback-plan-hash",
    ):
        parser.add_argument("--" + name, required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    try:
        args = _parser().parse_args(argv)
        expected_data = _json_object(args.expected_observations, required=_EXPECTED_FIELDS)
        if expected_data["source_git_remote"] != APPROVED_DEVELOPMENT_REMOTE:
            raise _InputError("SOURCE_REMOTE_NOT_APPROVED")
        expected = ReleaseExpectations(**expected_data)
        evidence = _json_object(
            args.wsl_evidence, required=_EVIDENCE_FIELDS - {"image_digests"},
            optional=frozenset({"image_digests"}),
        )
        if "image_digests" in evidence:
            images = evidence["image_digests"]
            if not isinstance(images, dict) or set(images) != {"web", "api", "worker"}:
                raise _InputError("INPUT_INVALID")
        approved_data = _json_object(args.approval_subject, required=_APPROVAL_FIELDS)
        approval = DeployApprovalSubject(**approved_data)
        release = verify_approval_release(
            _read_limited(args.manifest, _MAX_JSON_BYTES),
            trusted_public_key_pem=_read_limited(args.trusted_public_key, _MAX_KEY_BYTES),
            trusted_fingerprint=args.trusted_fingerprint, expected=expected,
        )
        decision = validate_existing_checkout(
            release, evidence, approval, args.observed_environment_id,
            args.migration_plan_hash, args.rollback_plan_hash, args.checkout,
        )
        if not decision.ready:
            print(f"F18_LOCAL_PREFLIGHT_FAILED:{decision.reason_code}", file=sys.stderr)
            return 2
        print(f"F18_LOCAL_PREFLIGHT_PASS:{decision.subject_hash}:PRODUCTION_CAPABILITY_NOT_VERIFIED")
        return 0
    except Exception:
        print("F18_LOCAL_PREFLIGHT_FAILED:INPUT_OR_MANIFEST_NOT_VERIFIED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
