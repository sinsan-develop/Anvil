"""D-02 scope-bound API: host metadata는 request payload가 대체하지 못한다."""
from datetime import datetime, timedelta, timezone
import importlib
import pytest

NOW = datetime(2026, 9, 16, tzinfo=timezone.utc)


@pytest.fixture
def api():
    s = importlib.import_module("packages.knowledge.snapshots")
    module = importlib.import_module("packages.api.learning_snapshots")
    repo = s.LearningSnapshotRepository()
    scope = s.MemoryScope("u1", "project", "p1")
    refs = [dict(source_id=kind.lower(), kind=kind, version=1, content_hash="a" * 64)
            for kind in ("SOUL", "USER", "MEMORY", "PROJECT_INSTRUCTION", "SKILL_CATALOG")]
    repo.publish(scope, base_sources=refs, sources=[], now=NOW)
    return module.LearningSnapshotsAPI(repo, scope)


def task(**changes):
    value = dict(session_id="session1", task_id="task1", run_id="run1", task_revision_id="rev1")
    value.update(changes)
    return value


def test_session_task_get_resume_and_json_alias(api):
    session = api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    assert session["status"] == 201
    result = api.request("create-task-run", task(), now=NOW, request_id="t")
    assert result["status"] == 201
    saved = result["body"]["content_hash"]
    result["body"]["instruction_versions"][0]["version"] = 999
    resumed = api.request("resume-task-run", {"session_id": "session1", "task_id": "task1", "run_id": "run1",
                         "expected_hash": saved}, now=NOW)
    assert resumed["status"] == 200 and resumed["body"]["instruction_versions"][0]["version"] == 1
    assert api.request("get-session", {"session_id": "session1"}, now=NOW)["body"] == session["body"]


@pytest.mark.parametrize("injected", [
    {"activation_actor": "self"}, {"sources": []}, {"catalog_hash": "b" * 64},
    {"revision_authorized": True}, {"scope": "user"}, {"user_id": "foreign"},
])
def test_payload_cannot_grant_activation_revision_or_scope(api, injected):
    api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    result = api.request("create-task-run", {**task(), **injected}, now=NOW, request_id="t")
    assert result["status"] == 400 and result["body"]["reason"] == "INVALID_SNAPSHOT_INPUT"
    assert api.request("get-task-run", {"session_id": "session1", "task_id": "task1", "run_id": "run1"}, now=NOW)["status"] == 404


def test_revision_and_resume_substitution_denied(api):
    api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    api.request("create-task-run", task(), now=NOW, request_id="t")
    result = api.request("create-task-run", task(run_id="run2", task_revision_id="rev2"), now=NOW, request_id="new")
    assert result["body"]["reason"] == "LEARNING_REVISION_AUTHORIZATION_REQUIRED"
    substituted = api.request("resume-task-run", {"session_id": "session1", "task_id": "task1", "run_id": "run1",
                             "expected_hash": "b" * 64}, now=NOW)
    assert substituted["body"]["reason"] == "LEARNING_SNAPSHOT_MISMATCH"


@pytest.mark.parametrize("bad", [None, [], {"session_id": " "}, {"session_id": "api_key=FAKE_TEST_ONLY"}])
def test_malformed_api_does_not_consume_request_or_echo_value(api, bad):
    response = api.request("create-session", bad, now=NOW, request_id="same")
    assert response["status"] == 400 and "FAKE" not in str(response)
    assert api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="same")["status"] == 201


def test_request_replay_and_wrong_scope(api):
    first = api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    assert first["status"] == 201
    second = api.request("create-session", {"session_id": "session2"}, now=NOW, request_id="s")
    assert second["status"] == 409 and second["body"]["reason"] == "REQUEST_REPLAY"


def test_wrong_bound_scope_and_resume_catalog_payload_rejected(api):
    s = importlib.import_module("packages.knowledge.snapshots")
    module = importlib.import_module("packages.api.learning_snapshots")
    api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    result = api.request("create-task-run", task(), now=NOW, request_id="t")
    other = module.LearningSnapshotsAPI(api._repository, s.MemoryScope("u1", "project", "p2"))
    assert other.request("get-task-run", {"session_id": "session1", "task_id": "task1", "run_id": "run1"}, now=NOW)["status"] == 404
    replacement = api.request("resume-task-run", {"session_id": "session1", "task_id": "task1", "run_id": "run1",
                              "expected_hash": result["body"]["content_hash"], "sources": []}, now=NOW)
    assert replacement["status"] == 400


def test_replay_cannot_reset_by_constructing_new_adapter(api):
    module = importlib.import_module("packages.api.learning_snapshots")
    api.request("create-session", {"session_id": "session1"}, now=NOW, request_id="s")
    another = module.LearningSnapshotsAPI(api._repository, api._scope)
    result = another.request("create-session", {"session_id": "session2"}, now=NOW, request_id="s")
    assert result["body"]["reason"] == "REQUEST_REPLAY"
