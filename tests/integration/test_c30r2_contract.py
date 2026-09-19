"""C30R2 Task1 contract freeze; NOT repository/DB/runtime acceptance.

contract_fixture tests validate the machine-readable specification only.
product_contract tests deliberately remain RED until Task2 provides real DTOs
and the session-scoped repository. No fake repository, xfail or skip fallback.
"""
from dataclasses import fields, is_dataclass
import hashlib
import importlib
import importlib.util
import inspect
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
WI = ROOT / "docs/work_orders/C-30R2_WORK_INSTRUCTION.md"
MODULE = "packages.persistence.agent_team_owner_repository"
REPOSITORY = "SqlAlchemyAgentTeamOwnerRepository"
DTO_FIELDS = {
    "OwnerBinding": ("project_id", "environment_id", "session_id", "assignment_id",
        "generation", "actor_id", "context_id", "workspace_id", "baseline_hash",
        "target_hash", "assignment_hash", "execution_fence", "write_fence"),
    "OwnerComponent": ("kind", "schema_version", "canonical_json", "content_hash"),
    "PrincipalMapping": ("binding", "auth_session_hash", "auth_generation",
        "principal_actor_id", "principal_role", "permissions", "issued_at",
        "expires_at", "mapping_hash"),
    "OwnerSnapshot": ("binding", "owner_version", "policy", "results", "team",
        "moa", "principal_mappings", "created_at", "expires_at", "content_hash"),
    "ProjectionReceipt": ("receipt_id", "request_id", "request_hash", "binding",
        "owner_version", "owner_snapshot_hash", "principal_mapping_hash",
        "menu", "response_json", "response_hash", "created_at", "content_hash"),
    "RevocationReceipt": ("binding", "revoked_through_generation", "owner_version",
        "revoked_at", "reason", "request_id", "request_hash", "content_hash"),
}
METHOD_PARAMS = {
    "save_owner_snapshot": ("snapshot", "expected_version", "request_id"),
    "load_current_owner": ("binding", "principal", "expected_version"),
    "revoke_generation": ("binding", "expected_version", "request_id", "reason"),
    "save_receipt": ("binding", "principal", "receipt", "expected_version"),
    "load_receipt": ("binding", "principal", "request_id"),
}


def _spec():
    assert WI.is_file(), "C30R2_CONTRACT_NOT_DEFINED"
    text = WI.read_text(encoding="utf-8")
    payload = text.split("<!-- C30R2_CONTRACT_BEGIN -->", 1)[1].split(
        "<!-- C30R2_CONTRACT_END -->", 1)[0]
    return json.loads(payload.strip().removeprefix("```json").removesuffix("```").strip())


def _product():
    assert importlib.util.find_spec(MODULE) is not None, "C30R2_REPOSITORY_NOT_IMPLEMENTED"
    return importlib.import_module(MODULE)


@pytest.mark.parametrize("name", tuple(DTO_FIELDS))
def test_contract_fixture_row_fields_are_closed(name):
    assert _spec()["dto_fields"][name] == list(DTO_FIELDS[name])


@pytest.mark.parametrize("name", tuple(METHOD_PARAMS))
def test_contract_fixture_session_scoped_methods(name):
    assert _spec()["methods"][name] == list(METHOD_PARAMS[name])


@pytest.mark.parametrize("name,expected", [
    ("generation", {"start": 1, "step": 1, "rollback": "DENY", "revocation": "MONOTONIC_HIGH_WATER"}),
    ("fence", {"execution": "EXACT_CURRENT", "write": "EXACT_CURRENT_OR_READONLY_NULL", "clock": "DATABASE_UTC"}),
    ("restart", {"source": "COMMITTED_ROWS_ONLY", "cache_authority": False, "missing_component": "DENY"}),
    ("receipt", {"same_request": "EXACT_REPLAY", "different_payload": "DENY", "recheck_current_authority": True}),
    ("principal", {"source": "SERVER_AUTHENTICATED_SESSION", "permission": "tasks:read", "request_mint": False}),
    ("transaction", {"owner": "CALLER", "repository_commit": False, "partial_publish": False}),
])
def test_contract_fixture_security_decisions(name, expected):
    assert _spec()["invariants"][name] == expected


def test_contract_fixture_hash_binds_exact_synthetic_authority():
    spec = _spec()
    fixture = spec["binding_fixture"]
    assert set(fixture) == set(DTO_FIELDS["OwnerBinding"])
    assert fixture["generation"] == 1 and fixture["write_fence"] is None
    assert fixture["actor_id"] == "fixture-reader" and fixture["session_id"] == "fixture-session"
    raw = json.dumps(fixture, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    assert spec["binding_fixture_hash"] == "sha256:" + hashlib.sha256(raw).hexdigest()
    changed = dict(fixture, execution_fence="fixture-stale-fence")
    different = json.dumps(changed, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    assert hashlib.sha256(different).digest() != hashlib.sha256(raw).digest()


@pytest.mark.parametrize("name", tuple(DTO_FIELDS))
def test_product_contract_immutable_dto(name):
    dto = getattr(_product(), name, None)
    assert dto is not None and is_dataclass(dto), name
    assert tuple(field.name for field in fields(dto)) == DTO_FIELDS[name]
    assert dto.__dataclass_params__.frozen is True
    assert hasattr(dto, "__slots__")


@pytest.mark.parametrize("method", tuple(METHOD_PARAMS))
def test_product_contract_session_scoped_repository(method):
    cls = getattr(_product(), REPOSITORY, None)
    assert cls is not None, "C30R2_REPOSITORY_CLASS_MISSING"
    signature = inspect.signature(getattr(cls, method))
    assert tuple(signature.parameters) == ("self", "session", *METHOD_PARAMS[method])
    for name in METHOD_PARAMS[method]:
        assert signature.parameters[name].kind is inspect.Parameter.KEYWORD_ONLY
    optional = signature.parameters.get("expected_version")
    if method == "load_current_owner":
        assert optional.default is None
    elif optional is not None:
        assert optional.default is inspect.Parameter.empty


def test_product_contract_denials_are_structured():
    error = getattr(_product(), "OwnerContractError", None)
    assert error is not None and issubclass(error, ValueError)
    failure = error("OWNER_REVOKED")
    assert failure.code == "OWNER_REVOKED"
    assert str(failure) == "OWNER_REVOKED"
