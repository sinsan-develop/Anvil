"""D12 read-only authenticated adapter. HTTP/authority issuance 없음."""
from packages.knowledge.learning_journey import LearningJourney, JourneyError, fields
from packages.knowledge.memory import to_primitive


class LearningJourneyAPI:
    def __init__(self, journey, context):
        if type(journey) is not LearningJourney: raise JourneyError("JOURNEY_REPOSITORY_MISMATCH")
        self.journey,self.context=journey,context

    def request(self, operation, payload, *, now):
        try:
            repo,ctx=self.journey,self.context
            if operation=="query": fields(payload,""); result=repo.query(ctx,now=now)
            elif operation=="list": fields(payload,"limit cursor"); result=repo.list(ctx,**payload,now=now)
            elif operation in ("detail","lineage"):
                fields(payload,"node_id snapshot_hash"); result=getattr(repo,operation)(ctx,**payload,now=now)
            elif operation=="skill-explanation": fields(payload,"invocation_id"); result=repo.skill_explanation(ctx,**payload,now=now)
            elif operation=="hook-replay": fields(payload,"receipt_hash"); result=repo.hook_replay(ctx,**payload,now=now)
            elif operation=="menu-projection": fields(payload,"name snapshot_hash"); result=repo.menu(ctx,**payload,now=now)
            else: raise JourneyError("INVALID_JOURNEY_INPUT")
            return dict(status=200,body=to_primitive(result))
        except JourneyError as error: return dict(status=400,body=dict(reason=error.reason))
