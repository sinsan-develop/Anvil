"""D13 authenticated in-process adapter, not HTTP or host authority minting."""
from packages.knowledge.learning_e2e import LearningE2E,LearningE2EError
from packages.knowledge.learning_journey import fields
from packages.knowledge.memory import MemoryError,to_primitive


class LearningE2EAPI:
    def __init__(self,harness,context):
        if type(harness) is not LearningE2E: raise LearningE2EError("E2E_AUTHORITY_MISMATCH")
        self.harness,self.context=harness,context

    def request(self,operation,payload,*,now):
        try:
            if operation=="execute": fields(payload,"scenario_id stage"); value=self.harness.execute(self.context,payload["scenario_id"],payload["stage"],now=now)
            elif operation=="query": fields(payload,"scenario_id"); value=self.harness.query(self.context,payload["scenario_id"],now=now)
            elif operation=="dir-x": fields(payload,"scenario_id"); value=self.harness.dir_x(self.context,payload["scenario_id"],now=now)
            else: raise LearningE2EError("INVALID_LEARNING_E2E_INPUT")
            return dict(status=200,body=to_primitive(value))
        except MemoryError as error: return dict(status=400,body=dict(reason=error.reason))
