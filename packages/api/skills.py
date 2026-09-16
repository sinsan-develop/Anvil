"""D-07 authenticated host-context adapter. HTTP/파일/승인 발급 경로 없음."""
from packages.knowledge.skills import SkillRepository, SkillError, fields
from packages.knowledge.memory import to_primitive


class SkillsAPI:
    def __init__(self, repository, context):
        if type(repository) is not SkillRepository:
            raise SkillError("SKILL_HOST_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            repo, ctx = self.repository, self.context
            if operation == "catalog":
                fields(payload, "selection_ref scope")
                result = repo.catalog(ctx, payload["selection_ref"], scope=payload["scope"], now=now)
            elif operation == "match":
                fields(payload, "selection_ref scope task limit")
                result = repo.match(ctx, payload["selection_ref"], scope=payload["scope"], task=payload["task"], limit=payload["limit"], now=now)
            elif operation == "select":
                fields(payload, "selection_ref skill_ref task mode")
                result = repo.select(ctx, payload["selection_ref"], payload["skill_ref"], task=payload["task"], mode=payload["mode"], request_id=request_id, now=now)
            elif operation == "load-l1":
                fields(payload, "invocation_ref")
                result = repo.load_l1(ctx, payload["invocation_ref"], now=now)
            elif operation == "load-l2":
                fields(payload, "invocation_ref path kind content_hash")
                result = repo.load_l2(ctx, payload["invocation_ref"], path=payload["path"], kind=payload["kind"], content_hash=payload["content_hash"], now=now)
            elif operation == "record-use":
                fields(payload, "invocation_ref outcome evidence_ref")
                result = repo.record_use(ctx, payload["invocation_ref"], outcome=payload["outcome"], evidence_ref=payload["evidence_ref"], request_id=request_id, now=now)
            else:
                raise SkillError("INVALID_SKILL_INPUT")
            return dict(status=200, body=to_primitive(result))
        except SkillError as error:
            status = 403 if "AUTHORITY" in error.reason or "HOST_REQUIRED" in error.reason else 400
            return dict(status=status, body=dict(reason=error.reason))
