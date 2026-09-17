"""E02 framework-neutral adapter. No HTTP wiring and no host capture endpoint."""
from packages.agent_team.handoff import RoleHandoffService, HandoffError


class RoleHandoffAPI:
    def __init__(self,service,*,actor_id,context_id,session_id,target_hash,execution_fence):
        if type(service) is not RoleHandoffService: raise HandoffError("HOST_AUTHORITY_REQUIRED")
        self._service=service
        self._auth=dict(actor_id=actor_id,context_id=context_id,session_id=session_id,target_hash=target_hash,execution_fence=execution_fence)

    def request(self,operation,payload,*,now):
        try:
            required={"create":{"handoff_id","request_id","source_id","source_hash","recipient_id","predecessor_id","predecessor_hash","expires_at"},
                      "project":{"handoff_id"},"resolve":{"handoff_id","artifact_id"}}
            if type(payload) is not dict or operation not in required or set(payload)!=required[operation]: raise HandoffError("HANDOFF_API_INPUT_INVALID")
            auth={**self._auth,"now":now}
            if operation=="create":
                return {"status":201,"body":self._service.create_projection(**payload,**auth)}
            if operation=="project": return {"status":200,"body":self._service.project(payload["handoff_id"],**auth)}
            return {"status":200,"body":{"bytes":self._service.resolve(payload["handoff_id"],payload["artifact_id"],**auth)}}
        except (HandoffError,TypeError,ValueError): return {"status":400,"body":{"reason":"HANDOFF_REQUEST_DENIED"}}
