"""AV-LRN-002/003: host catalog에서 immutable next-run snapshot을 만든다."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib
import json
import pytest

NOW = datetime(2026, 9, 16, tzinfo=timezone.utc)
A, B = "a" * 64, "b" * 64


@pytest.fixture
def s():
    return importlib.import_module("packages.knowledge.snapshots")


def scope(s, project="p1"):
    return s.MemoryScope("u1", "project", project)


def bases():
    return [dict(source_id=kind.lower(), kind=kind, version=1, content_hash=A)
            for kind in ("SOUL", "USER", "MEMORY", "PROJECT_INSTRUCTION", "SKILL_CATALOG")]


def source(**changes):
    result = dict(source_id="mem1", kind="MEMORY", version=1, content_hash=A,
                  scope="project", user_id="u1", project_id="p1", status="ACTIVE", source_status="ACTIVE",
                  activation_id="activation1", activation_actor="human1", activated_at=NOW)
    result.update(changes)
    return result


def setup(s, sources=None):
    repo = s.LearningSnapshotRepository()
    repo.publish(scope(s), base_sources=bases(), sources=[source()] if sources is None else sources, now=NOW)
    session = repo.create_session("session1", scope(s), now=NOW, request_id="session-create")
    return repo, session


def create(repo, s, task="task1", run="run1", now=NOW, revision="rev1", request="task-create"):
    return repo.create_task_run("session1", task, run, revision, scope(s), now=now, request_id=request)


def test_session_and_task_bind_sources_versions_hashes(s):
    repo, session = setup(s)
    task = create(repo, s)
    assert session.session_id == "session1" and len(session.source_hashes) == 5
    assert len(session.content_hash) == 64
    assert task.session_snapshot_hash == session.content_hash
    assert task.task_id == "task1" and task.run_id == "run1"
    assert task.source_versions[0]["source_id"] == "mem1"
    assert task.source_versions[0]["activation_actor"] == "human1"
    assert task.instruction_versions[0]["kind"] == "PROJECT_INSTRUCTION"
    assert task.blocked_sources == ()


def test_new_task_and_run_cutoff_but_resume_frozen(s):
    repo, session = setup(s)
    first = create(repo, s)
    cutoff = NOW + timedelta(minutes=1)
    repo.publish(scope(s), base_sources=bases(), sources=[source(), source(source_id="skill1", kind="SKILL",
                 activation_id="activation2", activated_at=cutoff)], now=NOW + timedelta(seconds=1))
    before = create(repo, s, task="task2", run="run2", now=NOW + timedelta(seconds=2), request="before")
    after = create(repo, s, task="task2", run="run3", now=cutoff, request="after")
    assert len(before.source_versions) == 1
    assert before.blocked_sources[0]["reason"] == "LEARNING_ACTIVATION_FUTURE"
    assert len(after.source_versions) == 2
    assert len({first.snapshot_id, before.snapshot_id, after.snapshot_id}) == 3
    assert len({first.content_hash, before.content_hash, after.content_hash}) == 3
    resumed = repo.resume_task_run("session1", "task1", "run1", scope(s), expected_hash=first.content_hash)
    assert s.to_primitive(resumed) == s.to_primitive(first)
    assert repo.get_session("session1", scope(s)) == session


def test_order_independence_and_force_mutation_isolated(s):
    inputs, refs = [source(), source(source_id="skill1", kind="SKILL")], bases()
    left, right = s.LearningSnapshotRepository(), s.LearningSnapshotRepository()
    left.publish(scope(s), base_sources=refs, sources=inputs, now=NOW)
    right.publish(scope(s), base_sources=refs[::-1], sources=inputs[::-1], now=NOW)
    a = left.create_session("session1", scope(s), now=NOW, request_id="create")
    b = right.create_session("session1", scope(s), now=NOW, request_id="create")
    x, y = create(left, s), create(right, s)
    assert s.to_primitive(a) == s.to_primitive(b)
    assert s.to_primitive(x) == s.to_primitive(y)
    inputs[0]["activation_actor"] = "changed"
    refs[0]["content_hash"] = B
    object.__setattr__(x, "content_hash", B)
    object.__setattr__(a, "base_sources", ())
    with pytest.raises(TypeError):
        y.source_versions[0]["activation_actor"] = "tamper"
    assert left.get_session("session1", scope(s)) == b
    assert left.resume_task_run("session1", "task1", "run1", scope(s), expected_hash=y.content_hash) == y


@pytest.mark.parametrize("change,reason", [
    ({"status": "PENDING"}, "LEARNING_PENDING"),
    ({"activation_id": None, "activation_actor": None, "activated_at": None}, "LEARNING_NOT_APPROVED"),
    ({"activated_at": NOW + timedelta(seconds=1)}, "LEARNING_ACTIVATION_FUTURE"),
    ({"status": "REVOKED"}, "LEARNING_REVOKED"),
    ({"status": "QUARANTINED"}, "LEARNING_QUARANTINED"),
    ({"source_status": "REVOKED"}, "LEARNING_SOURCE_REVOKED"),
    ({"source_status": "QUARANTINED"}, "LEARNING_SOURCE_QUARANTINED"),
])
def test_blocked_sources_have_structured_evidence_without_inclusion(s, change, reason):
    repo, _ = setup(s, [source(**change)])
    result = create(repo, s)
    assert result.source_versions == ()
    assert result.blocked_sources[0] == dict(source_id="mem1", version=1, content_hash=A, reason=reason)


def test_source_revocation_affects_only_next_snapshot(s):
    repo, _ = setup(s)
    old = create(repo, s)
    later = NOW + timedelta(seconds=1)
    repo.publish(scope(s), base_sources=bases(), sources=[source(source_status="REVOKED")], now=later)
    new = create(repo, s, task="task2", run="run2", now=later, request="new")
    assert new.source_versions == () and new.blocked_sources[0]["reason"] == "LEARNING_SOURCE_REVOKED"
    assert repo.resume_task_run("session1", "task1", "run1", scope(s), expected_hash=old.content_hash) == old


def test_resume_wrong_hash_scope_or_owner_denied(s):
    repo, _ = setup(s)
    old = create(repo, s)
    with pytest.raises(s.SnapshotError, match="LEARNING_SNAPSHOT_MISMATCH"):
        repo.resume_task_run("session1", "task1", "run1", scope(s), expected_hash=B)
    for current_scope, task in [(scope(s, "p2"), "task1"), (scope(s), "other")]:
        with pytest.raises(s.SnapshotError):
            repo.resume_task_run("session1", task, "run1", current_scope, expected_hash=old.content_hash)


def test_task_revision_requires_exact_host_authorization_and_cannot_replay(s):
    repo, _ = setup(s)
    old = create(repo, s)
    later = NOW + timedelta(seconds=1)
    with pytest.raises(s.SnapshotError, match="LEARNING_REVISION_AUTHORIZATION_REQUIRED"):
        create(repo, s, run="run2", revision="rev2", now=later, request="revision")
    repo.authorize_revision("session1", "task1", "rev1", "rev2", scope(s), actor="human1",
                            now=NOW, expires_at=NOW + timedelta(minutes=5))
    new = create(repo, s, run="run2", revision="rev2", now=later, request="revision")
    assert new.task_revision_id == "rev2" and new.revision_authorization["actor"] == "human1"
    assert repo.resume_task_run("session1", "task1", "run1", scope(s), expected_hash=old.content_hash) == old
    with pytest.raises(s.SnapshotError, match="LEARNING_TASK_REVISION_STALE"):
        create(repo, s, run="run3", revision="rev1", now=later, request="old-revision")


@pytest.mark.parametrize("change,reason", [
    ({"kind": "SOUL"}, "INVALID_LEARNING_SOURCE"), ({"version": 0}, "INVALID_LEARNING_SOURCE"),
    ({"version": True}, "INVALID_LEARNING_SOURCE"), ({"content_hash": "not-hash"}, "INVALID_LEARNING_HASH"),
    ({"scope": "global"}, "INVALID_MEMORY_INPUT"), ({"status": "BAD"}, "INVALID_LEARNING_SOURCE"),
    ({"source_status": "BAD"}, "INVALID_LEARNING_SOURCE"),
    ({"activated_at": NOW.replace(tzinfo=None)}, "INVALID_MEMORY_TIME"),
    ({"activation_actor": "password=FAKE_TEST_ONLY"}, "SECRET_LIKE_INPUT"),
    ({"source_id": "postgresql://user:FAKE_TEST_ONLY@db.test/name"}, "SECRET_LIKE_INPUT"),
])
def test_invalid_source_publish_is_atomic(s, change, reason):
    repo, session = setup(s)
    with pytest.raises(s.SnapshotError) as error:
        repo.publish(scope(s), base_sources=bases(), sources=[source(**change)], now=NOW + timedelta(seconds=1))
    assert error.value.reason == reason and "FAKE" not in str(error.value)
    assert repo.get_session("session1", scope(s)) == session
    assert len(create(repo, s).source_versions) == 1


def test_duplicate_identity_version_and_conflicting_hash_fail(s):
    repo, _ = setup(s)
    for records in ([source(), source()], [source(), source(content_hash=B)], [source(content_hash=B)]):
        with pytest.raises(s.SnapshotError, match="LEARNING_SOURCE_CONFLICT"):
            repo.publish(scope(s), base_sources=bases(), sources=records, now=NOW + timedelta(seconds=1))
    assert len(create(repo, s).source_versions) == 1


def test_new_pending_version_does_not_restore_old_active_version(s):
    repo, _ = setup(s, [source(), source(version=2, content_hash=B, status="PENDING")])
    result = create(repo, s)
    assert result.source_versions == ()
    assert {x["reason"] for x in result.blocked_sources} == {"LEARNING_SUPERSEDED_VERSION", "LEARNING_PENDING"}


def test_concurrent_create_replay_has_one_canonical_and_failed_request_reusable(s):
    repo, _ = setup(s)
    def attempt(_):
        try:
            return create(repo, s)
        except s.SnapshotError as error:
            return error.reason
    with ThreadPoolExecutor(max_workers=4) as pool:
        result = list(pool.map(attempt, range(8)))
    assert sum(not isinstance(x, str) for x in result) == 1
    assert result.count("REQUEST_REPLAY") == 7
    with pytest.raises(s.SnapshotError):
        create(repo, s, task="task2", run="run2", now=NOW.replace(tzinfo=None), request="retry")
    assert create(repo, s, task="task2", run="run2", request="retry").run_id == "run2"


def test_missing_session_base_and_scope_drift_block(s):
    repo = s.LearningSnapshotRepository()
    with pytest.raises(s.SnapshotError, match="SESSION_SOURCES_REQUIRED"):
        repo.publish(scope(s), base_sources=bases()[:-1], sources=[], now=NOW)
    with pytest.raises(s.SnapshotError, match="LEARNING_SCOPE_DENIED"):
        repo.publish(scope(s), base_sources=bases(), sources=[source(project_id="p2")], now=NOW)


def test_future_or_stale_catalog_clock_blocked(s):
    repo, _ = setup(s)
    with pytest.raises(s.SnapshotError, match="LEARNING_CATALOG_STALE"):
        repo.publish(scope(s), base_sources=bases(), sources=[], now=NOW - timedelta(seconds=1))
    with pytest.raises(s.SnapshotError, match="INVALID_MEMORY_TIME"):
        create(repo, s, now=NOW - timedelta(seconds=1))
    json.dumps(s.to_primitive(create(repo, s)))


def test_base_reference_identity_hash_cannot_be_rebound(s):
    repo, session = setup(s)
    refs = bases()
    refs[0]["content_hash"] = B
    with pytest.raises(s.SnapshotError, match="LEARNING_SOURCE_CONFLICT"):
        repo.publish(scope(s), base_sources=refs, sources=[source()], now=NOW + timedelta(seconds=1))
    assert repo.get_session("session1", scope(s)) == session
    assert create(repo, s).session_snapshot_hash == session.content_hash


@pytest.mark.parametrize("at", [NOW - timedelta(seconds=1), NOW + timedelta(minutes=1)])
def test_revision_grant_half_open_time_and_failed_request_reusable(s, at):
    repo, _ = setup(s)
    create(repo, s)
    repo.authorize_revision("session1", "task1", "rev1", "rev2", scope(s), actor="human1",
                            now=NOW, expires_at=NOW + timedelta(minutes=1))
    with pytest.raises(s.SnapshotError):
        create(repo, s, run="run2", revision="rev2", now=at, request="revision")
    assert create(repo, s, run="run2", revision="rev2", now=NOW, request="revision").task_revision_id == "rev2"


def test_later_run_preserves_revision_authorization_lineage(s):
    repo, _ = setup(s)
    create(repo, s)
    repo.authorize_revision("session1", "task1", "rev1", "rev2", scope(s), actor="human1",
                            now=NOW, expires_at=NOW + timedelta(minutes=1))
    second = create(repo, s, run="run2", revision="rev2", request="revision")
    third = create(repo, s, run="run3", revision="rev2", request="later")
    assert third.revision_authorization == second.revision_authorization


def test_same_task_cannot_create_a_backdated_run(s):
    repo, _ = setup(s)
    create(repo, s, now=NOW + timedelta(minutes=1))
    with pytest.raises(s.SnapshotError, match="INVALID_MEMORY_TIME"):
        create(repo, s, run="run2", now=NOW, request="backdate")


def test_concurrent_distinct_request_ids_cannot_replace_one_run(s):
    repo, _ = setup(s)
    def attempt(index):
        try:
            return create(repo, s, request="request-" + str(index))
        except s.SnapshotError as error:
            return error.reason
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(attempt, range(8)))
    winners = [x for x in results if not isinstance(x, str)]
    assert len(winners) == 1 and results.count("LEARNING_SNAPSHOT_EXISTS") == 7
    assert repo.get_task_run("session1", "task1", "run1", scope(s)) == winners[0]


def test_approval_after_creation_only_enters_next_snapshot(s):
    pending = source(status="PENDING", activation_id=None, activation_actor=None, activated_at=None)
    repo, _ = setup(s, [pending])
    old = create(repo, s)
    later = NOW + timedelta(seconds=1)
    repo.publish(scope(s), base_sources=bases(), sources=[source(activated_at=later)], now=later)
    new = create(repo, s, task="task2", run="run2", now=later, request="new")
    assert old.source_versions == () and len(new.source_versions) == 1
    assert repo.get_task_run("session1", "task1", "run1", scope(s)) == old


def test_source_partial_activation_and_invalid_reference_fail_closed(s):
    repo = s.LearningSnapshotRepository()
    with pytest.raises(s.SnapshotError, match="INVALID_LEARNING_ACTIVATION"):
        repo.publish(scope(s), base_sources=bases(), sources=[source(activation_actor=None)], now=NOW)
    for change in ({"version": 0}, {"kind": "BAD"}, {"content_hash": "bad"}):
        refs = bases()
        refs[0].update(change)
        with pytest.raises(s.SnapshotError):
            repo.publish(scope(s), base_sources=refs, sources=[], now=NOW)
    with pytest.raises(s.SnapshotError, match="SESSION_SOURCES_REQUIRED"):
        repo.create_session("session1", scope(s), now=NOW, request_id="retry")
    repo.publish(scope(s), base_sources=bases(), sources=[], now=NOW)
    assert repo.create_session("session1", scope(s), now=NOW, request_id="retry").session_id == "session1"
