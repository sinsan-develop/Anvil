"""F-12 owner selection contract; no live network, browser, or persistence."""

from concurrent.futures import ThreadPoolExecutor

import pytest

from packages.provider_catalog.models import Snapshot, canonical, digest
from packages.provider_catalog.service import ProviderCatalog
from tests.provider_catalog.test_provider_catalog_f01 import profile, observation


HASH = "sha256:" + "a" * 64


def catalog(project="project", environment="test"):
    return ProviderCatalog(project_id=project, environment_id=environment, broker_policy_hash=HASH)


def select(owner, handle, baseline, approval="approval-1"):
    return owner.select_profile(handle, expected_version=baseline.to_dict()["version"],
        expected_selection_hash=baseline.content_hash,
        approved_profile_hash=handle.content_hash, human_approval_id=approval)


def test_initial_and_replacement_selection_are_owner_cas_and_keep_old_run_pin():
    owner = catalog()
    initial = owner.profile_selection()
    assert initial.to_dict() == {"version": 0, "profile_id": None, "profile_hash": None}
    old = owner.register_profile("old", profile(), human_approval_id="approval-1")
    first = select(owner, old, initial)
    pinned = owner.pin_run("run-before-switch", old)
    assert first.to_dict() == {"version": 1, "profile_id": "old", "profile_hash": old.content_hash}
    new = owner.register_profile("new", profile(approved_paths=["src/**", "docs/**"]),
        human_approval_id="approval-2")
    second = select(owner, new, first, approval="approval-2")
    assert second.to_dict() == {"version": 2, "profile_id": "new", "profile_hash": new.content_hash}
    assert owner.current_profile() == (second, new)
    assert owner.pin_run("run-before-switch", old) == pinned
    with pytest.raises(ValueError, match="RUN_SNAPSHOT_IMMUTABLE"):
        owner.pin_run("run-before-switch", new)
    assert owner.pin_run("run-after-switch", new).to_dict()["profile_hash"] == new.content_hash


def test_selection_rejects_stale_version_hash_and_wrong_approval_without_mutating_owner():
    owner = catalog()
    initial = owner.profile_selection()
    old = owner.register_profile("old", profile(), human_approval_id="approval-1")
    first = select(owner, old, initial)
    new = owner.register_profile("new", profile(approved_paths=["src/**", "docs/**"]),
        human_approval_id="approval-2")
    audit_before = owner.audit().to_dict()
    with pytest.raises(ValueError, match="PROFILE_SELECTION_CONFLICT"):
        select(owner, new, initial, approval="approval-2")
    with pytest.raises(ValueError, match="PROFILE_SELECTION_CONFLICT"):
        owner.select_profile(new, expected_version=1, expected_selection_hash=initial.content_hash,
            approved_profile_hash=new.content_hash, human_approval_id="approval-2")
    with pytest.raises(ValueError, match="PROFILE_APPROVAL_MISMATCH"):
        select(owner, new, first, approval="approval-1")
    with pytest.raises(ValueError, match="PROFILE_APPROVAL_MISMATCH"):
        owner.select_profile(new, expected_version=1, expected_selection_hash=first.content_hash,
            approved_profile_hash=old.content_hash, human_approval_id="approval-2")
    assert owner.current_profile() == (first, old)
    assert owner.audit().to_dict() == audit_before


def test_profile_owner_validation_rejects_foreign_and_forged_handles_without_audit_write():
    owner = catalog()
    other = catalog()
    foreign = other.register_profile("foreign", profile(), human_approval_id="approval-1")
    own = owner.register_profile("owned", profile(), human_approval_id="approval-1")
    before = owner.audit().to_dict()
    with pytest.raises(ValueError, match="HANDLE_INVALID"):
        owner.validate_profile(foreign)
    with pytest.raises(ValueError, match="HANDLE_INVALID"):
        owner.validate_profile(Snapshot("PROFILE", "owned", own.content_hash, "{}"))
    assert owner.validate_profile(own) == own
    with pytest.raises(ValueError, match="HANDLE_INVALID"):
        select(owner, foreign, owner.profile_selection())
    assert owner.audit().to_dict() == before


def test_competing_profile_selection_has_one_winner_and_one_conflict():
    owner = catalog()
    baseline = owner.profile_selection()
    a = owner.register_profile("a", profile(), human_approval_id="approval-1")
    b = owner.register_profile("b", profile(approved_paths=["docs/**"]), human_approval_id="approval-2")

    def attempt(pair):
        handle, approval = pair
        try:
            return select(owner, handle, baseline, approval=approval).to_dict()["profile_id"]
        except ValueError as error:
            return str(error)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, [(a, "approval-1"), (b, "approval-2")]))
    assert sum(value in {"a", "b"} for value in results) == 1
    assert results.count("PROFILE_SELECTION_CONFLICT") == 1
    assert owner.profile_selection().to_dict()["version"] == 1


def test_selection_does_not_invoke_hostile_evidence_object_callbacks():
    owner = catalog()
    baseline = owner.profile_selection()
    handle = owner.register_profile("profile", profile(), human_approval_id="approval-1")
    calls = []
    class Hostile:
        def __eq__(self, other):
            calls.append("eq")
            return True
    with pytest.raises(ValueError, match="PROFILE_APPROVAL_MISMATCH"):
        owner.select_profile(handle, expected_version=0, expected_selection_hash=baseline.content_hash,
            approved_profile_hash=Hostile(), human_approval_id="approval-1")
    assert calls == []
    assert owner.profile_selection() == baseline


def test_decision_validation_requires_exact_owner_stored_payload_without_audit_write():
    owner = catalog()
    approved = owner.register_profile("profile", profile(), human_approval_id="approval-1")
    blocked = owner.evaluate_egress(request_id="request-1", snapshot=approved,
        provider_id="openai", purpose="generate", paths=["src/a.py"], content_kind="code",
        observation=observation(training=True))
    before = owner.audit().to_dict()
    assert owner.validate_decision(blocked, "EGRESS_DECISION") == blocked
    modified = {**blocked.to_dict(), "decision": "ALLOW"}
    forged = Snapshot("DECISION", blocked.record_id, digest(modified), canonical(modified))
    with pytest.raises(ValueError, match="HANDLE_INVALID"):
        owner.validate_decision(forged, "EGRESS_DECISION")
    with pytest.raises(ValueError, match="HANDLE_INVALID"):
        owner.validate_decision(blocked, "BROKER_DECISION")
    assert owner.audit().to_dict() == before
