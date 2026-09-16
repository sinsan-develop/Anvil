"""D-01 in-process API-shaped adapter, not an HTTP endpoint.

The trusted host binds the caller's scope and curated_write capability at
construction after its own authentication/curation. Request payload cannot grant
either. Instruction bindings likewise come from the host instruction chain, not
raw agent messages. D-06 owns approval workflow; no claim of HTTP auth is made.
"""
from datetime import datetime
from packages.knowledge.memory import (
    Instruction, MemoryError, MemoryRepository, MemoryScope, _scan, _scope_key, _text, _time, to_primitive,
)


class KnowledgeMemoryAPI:
    def __init__(self, repository, scope, *, curated_write=False):
        if type(repository) is not MemoryRepository or type(curated_write) is not bool:
            raise MemoryError("INVALID_MEMORY_INPUT")
        self._scope = MemoryScope(*_scope_key(scope))
        self._repository = repository
        self._curated_write = curated_write

    def _entry_payload(self, payload):
        expected = (self._scope.user_id, self._scope.scope, self._scope.project_id)
        if (payload.get("user_id"), payload.get("scope"), payload.get("project_id")) != expected:
            raise MemoryError("MEMORY_SCOPE_DENIED")
        result = dict(payload)
        for key in ("created_at", "last_verified_at", "expires_at"):
            value = result.get(key)
            if key == "expires_at" and value is None:
                continue
            if type(value) is not str:
                raise MemoryError("INVALID_MEMORY_TIME")
            try:
                result[key] = datetime.fromisoformat(value)
            except ValueError:
                raise MemoryError("INVALID_MEMORY_TIME") from None
        return result

    def request(self, operation, payload, *, now, request_id=None):
        try:
            _time(now)
            if type(payload) is not dict or type(operation) is not str:
                raise MemoryError("INVALID_MEMORY_INPUT")
            _scan(payload)
            mutating = operation in ("add", "version")
            if mutating:
                if not self._curated_write:
                    raise MemoryError("CURATED_WRITE_REQUIRED")
                _text(request_id)
                _scan(request_id)
            if operation in ("propose", "add", "version"):
                value = dict(payload)
                expected_hash = value.pop("expected_hash", None) if operation == "version" else None
                value = self._entry_payload(value)
                if operation == "version":
                    body = self._repository.version(value, expected_hash=expected_hash, now=now, request_id=request_id)
                elif operation == "add":
                    body = self._repository.add(value, now=now, request_id=request_id)
                else:
                    body = self._repository.propose(value, now=now)
            elif operation in ("get", "list", "capacity", "conflicts", "resolve-context"):
                required = {"get": {"kind", "entry_id"}, "list": {"kind"}, "capacity": {"kind"},
                            "conflicts": set(), "resolve-context": {"kind", "instructions"}}[operation]
                if set(payload) != required:
                    raise MemoryError("INVALID_MEMORY_INPUT")
                if operation == "conflicts":
                    body = self._repository.conflicts(self._scope)
                elif operation == "resolve-context":
                    raw = payload["instructions"]
                    if type(raw) is not list:
                        raise MemoryError("INVALID_MEMORY_INPUT")
                    instructions = []
                    for item in raw:
                        if type(item) is not dict or set(item) != {"instruction_id", "priority", "instruction_key", "statement"}:
                            raise MemoryError("INVALID_MEMORY_INPUT")
                        instructions.append(Instruction(**item))
                    body = self._repository.resolve_context(payload["kind"], self._scope, instructions=instructions, now=now)
                elif operation == "get":
                    body = self._repository.get(payload["kind"], self._scope, payload["entry_id"], now=now)
                else:
                    body = getattr(self._repository, operation)(payload["kind"], self._scope, now=now)
            else:
                raise MemoryError("UNKNOWN_MEMORY_OPERATION")
            return dict(status=201 if mutating else 200, body=to_primitive(body))
        except MemoryError as error:
            status = 400
            if error.reason in ("MEMORY_SCOPE_DENIED", "CURATED_WRITE_REQUIRED"):
                status = 403
            elif error.reason == "MEMORY_NOT_FOUND":
                status = 404
            elif error.reason in ("REQUEST_REPLAY", "MEMORY_VERSION_CONFLICT", "MEMORY_DUPLICATE", "MEMORY_CAPACITY_EXCEEDED"):
                status = 409
            return dict(status=status, body=dict(reason=error.reason, details=dict(error.details)))
