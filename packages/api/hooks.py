"""D09 host-context adapter; capture/trust/execute endpoint 및 실제 HTTP 없음."""
from packages.knowledge.hooks import HookRegistry, HookError, fields
from packages.knowledge.memory import to_primitive


class HookAPI:
    def __init__(self, repository, context):
        if type(repository) is not HookRegistry:
            raise HookError("HOOK_HOST_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            repo, ctx = self.repository, self.context
            if operation == "candidate":
                fields(payload, "proposal")
                result = repo.candidate(ctx, payload["proposal"], request_id=request_id, now=now)
            elif operation == "register":
                fields(payload, "target")
                result = repo.register(ctx, payload["target"], request_id=request_id, now=now)
            elif operation == "query":
                fields(payload, "proposal_id")
                result = repo.query(ctx, payload["proposal_id"], now=now)
            elif operation == "version":
                fields(payload, "target")
                result = repo.version(ctx, payload["target"], now=now)
            elif operation == "match":
                fields(payload, "event")
                result = repo.match(ctx, payload["event"], now=now)
            elif operation == "merge":
                fields(payload, "capture_id")
                result = repo.merge(ctx, payload["capture_id"], now=now)
            elif operation == "fault-projection":
                fields(payload, "target kind")
                result = repo.fault_projection(ctx, payload["target"], payload["kind"], now=now)
            else:
                raise HookError("INVALID_HOOK_INPUT")
            return dict(status=201 if operation == "candidate" else 200, body=to_primitive(result))
        except HookError as error:
            return dict(status=403 if "AUTHORITY" in error.reason else 400, body=dict(reason=error.reason))
