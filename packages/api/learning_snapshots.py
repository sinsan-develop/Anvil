"""D-02 in-process snapshot API, with host-bound scope and no catalog writes.

Only the authenticated host may construct this adapter. Activation actors and
revision grants are read from the repository's host publication seam, never
inferred from request payload. No HTTP server/authentication is implemented here.
"""
from packages.knowledge.snapshots import LearningSnapshotRepository, SnapshotError
from packages.knowledge.memory import MemoryError, MemoryScope, _scan, _scope_key, _time, to_primitive


class LearningSnapshotsAPI:
    def __init__(self, repository, scope):
        if type(repository) is not LearningSnapshotRepository:
            raise SnapshotError("INVALID_SNAPSHOT_INPUT")
        self._repository = repository
        self._scope = MemoryScope(*_scope_key(scope))

    def request(self, operation, payload, *, now, request_id=None):
        try:
            _time(now)
            fields = {
                "create-session": {"session_id"}, "get-session": {"session_id"},
                "create-task-run": {"session_id", "task_id", "run_id", "task_revision_id"},
                "get-task-run": {"session_id", "task_id", "run_id"},
                "resume-task-run": {"session_id", "task_id", "run_id", "expected_hash"},
            }
            if type(operation) is not str or operation not in fields or type(payload) is not dict:
                raise SnapshotError("INVALID_SNAPSHOT_INPUT")
            _scan(payload)
            if set(payload) != fields[operation]:
                raise SnapshotError("INVALID_SNAPSHOT_INPUT")
            method = getattr(self._repository, operation.replace("-", "_"))
            args = dict(payload, scope=self._scope)
            if operation.startswith("create-"):
                args.update(now=now, request_id=request_id)
            result = method(**args)
            return dict(status=201 if operation.startswith("create-") else 200, body=to_primitive(result))
        except MemoryError as error:
            status = 400
            if error.reason == "LEARNING_SNAPSHOT_NOT_FOUND":
                status = 404
            elif error.reason in ("REQUEST_REPLAY", "LEARNING_SNAPSHOT_EXISTS", "LEARNING_SNAPSHOT_MISMATCH"):
                status = 409
            elif error.reason in ("LEARNING_SCOPE_DENIED", "LEARNING_REVISION_AUTHORIZATION_REQUIRED", "LEARNING_TASK_REVISION_STALE"):
                status = 403
            return dict(status=status, body=dict(reason=error.reason, details=dict(error.details)))
