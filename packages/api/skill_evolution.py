"""D08 host context API projection; capture/정책 발급/실제 HTTP 없음."""
from packages.knowledge.skill_evolution import SkillEvolutionRepository, EvolutionError, fields
from packages.knowledge.memory import to_primitive


class SkillEvolutionAPI:
    def __init__(self, repository, context):
        if type(repository) is not SkillEvolutionRepository:
            raise EvolutionError("EVOLUTION_HOST_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            repo, ctx = self.repository, self.context
            if operation == "propose":
                fields(payload, "proposal")
                result = repo.propose(ctx, payload["proposal"], request_id=request_id, now=now)
            elif operation in ("query", "archive"):
                fields(payload, "evolution_id")
                result = repo.query(ctx, payload["evolution_id"], now=now)
                if operation == "archive" and result["candidate"]["action"] != "ARCHIVE":
                    raise EvolutionError("EVOLUTION_NOT_ARCHIVE")
            elif operation in ("evaluate", "approve", "activate"):
                fields(payload, "target")
                result = getattr(repo, operation)(ctx, payload["target"], request_id=request_id, now=now)
            elif operation == "record-pilot":
                fields(payload, "target pilot_id")
                result = repo.record_pilot(ctx, payload["target"], payload["pilot_id"], request_id=request_id, now=now)
            elif operation == "rollback":
                fields(payload, "target evidence_ref")
                result = repo.rollback(ctx, payload["target"], evidence_ref=payload["evidence_ref"], request_id=request_id, now=now)
            else:
                raise EvolutionError("INVALID_EVOLUTION_INPUT")
            return dict(status=201 if operation == "propose" else 200, body=to_primitive(result))
        except EvolutionError as error:
            return dict(status=403 if "AUTHORITY" in error.reason else 400, body=dict(reason=error.reason))
