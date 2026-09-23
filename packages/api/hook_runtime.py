"""D10 host-context API; HTTP 및 authority 발급 endpoint 없음."""
from packages.knowledge.hook_runtime import HookRuntime, HookRuntimeError
from packages.knowledge.hooks import fields, HookError
from packages.knowledge.memory import to_primitive


class HookRuntimeAPI:
    def __init__(self, runtime, context):
        if type(runtime) is not HookRuntime: raise HookRuntimeError("HOOK_RUNTIME_HOST_REQUIRED")
        self.runtime, self.context = runtime, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            repo, ctx = self.runtime, self.context
            if operation == "query":
                fields(payload, "target"); value = repo.query(ctx, payload["target"], now=now)
            elif operation == "shadow":
                fields(payload, "target event input expected_version")
                value = repo.shadow(ctx, payload["target"], payload["event"], payload["input"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation in ("pilot", "activate", "rollback"):
                fields(payload, "target expected_version")
                value = getattr(repo, operation)(ctx, payload["target"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation == "trust":
                fields(payload, "target mode expected_version")
                value = repo.trust(ctx, payload["target"], mode=payload["mode"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation == "quarantine":
                fields(payload, "target reason expected_version")
                value = repo.quarantine(ctx, payload["target"], reason=payload["reason"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation == "run":
                fields(payload, "selection_id event input")
                value = repo.run(ctx, payload["selection_id"], payload["event"], payload["input"], now=now)
            elif operation == "export":
                fields(payload, ""); value = repo.export_state(ctx, now=now)
            elif operation == "import":
                fields(payload, "checkpoint"); value = repo.import_state(ctx, payload["checkpoint"], now=now)
            else: raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT")
            return dict(status=200, body=to_primitive(value))
        except (HookRuntimeError, HookError) as error:
            return dict(status=400, body=dict(reason="INVALID_HOOK_RUNTIME_INPUT" if error.reason == "INVALID_HOOK_INPUT" else error.reason))
