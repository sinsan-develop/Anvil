"""D-06 host-context API adapter; trusted capture와 실제 HTTP는 노출하지 않는다."""
from packages.knowledge.candidates import CandidateRepository, CandidateError, fields
from packages.knowledge.memory import to_primitive


class LearningCandidatesAPI:
    def __init__(self, repository, context):
        if type(repository) is not CandidateRepository:
            raise CandidateError("CANDIDATE_HOST_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            repo, ctx = self.repository, self.context
            if operation == "create":
                fields(payload, "proposal expected_version")
                result = repo.create(ctx, payload["proposal"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation == "query":
                fields(payload, "candidate_id")
                result = repo.query(ctx, payload["candidate_id"], now=now)
            elif operation in ("evaluate", "request-approval", "approve", "activate"):
                fields(payload, "candidate_ref expected_version")
                method = getattr(repo, operation.replace("-", "_"))
                result = method(ctx, payload["candidate_ref"], expected_version=payload["expected_version"], request_id=request_id, now=now)
            elif operation in ("rollback", "quarantine"):
                fields(payload, "candidate_ref expected_version reason evidence_ref")
                result = getattr(repo, operation)(ctx, payload["candidate_ref"], expected_version=payload["expected_version"], reason=payload["reason"], evidence_ref=payload["evidence_ref"], request_id=request_id, now=now)
            elif operation == "use":
                fields(payload, "activation_id selection_id expected_selection_hash")
                result = repo.register_use(ctx, payload["activation_id"], payload["selection_id"], expected_selection_hash=payload["expected_selection_hash"], request_id=request_id, now=now)
            else:
                raise CandidateError("INVALID_CANDIDATE_INPUT")
            return dict(status=201 if operation == "create" else 200, body=to_primitive(result))
        except CandidateError as error:
            status = 403 if "AUTHORITY" in error.reason or "APPROVAL_REQUIRED" in error.reason or "HOST_REQUIRED" in error.reason else 404 if error.reason.endswith("NOT_FOUND") else 400
            return dict(status=status, body=dict(reason=error.reason))
