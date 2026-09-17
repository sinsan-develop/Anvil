"""Manual bytes interchange adapter; no HTTP wiring or host authority endpoints."""
from packages.agent_team.external_verifier import ExternalVerifierAdapter


class ExternalVerificationAPI:
    def __init__(self,adapter,*,actor_id,context_id,session_id,target_hash,execution_fence):
        if type(adapter) is not ExternalVerifierAdapter:raise ValueError("HOST_AUTHORITY_REQUIRED")
        self._adapter=adapter
        self._auth=dict(actor_id=actor_id,context_id=context_id,session_id=session_id,target_hash=target_hash,execution_fence=execution_fence)

    def request(self,operation,payload,*,now):
        try:
            shapes={"export":{"bundle_id","handoff_id","expires_at"},"import":{"authorization_id","response_bytes"},"project":{"bundle_id"},"resolve":{"bundle_id","artifact_id"}}
            if type(payload) is not dict or operation not in shapes or set(payload)!=shapes[operation]:raise ValueError("REQUEST_INVALID")
            auth={**self._auth,"now":now}
            if operation=="export":body={"bytes":self._adapter.export_bundle(**payload,**auth)}
            elif operation=="import":body=self._adapter.import_bundle(**payload,**auth)
            elif operation=="project":body=self._adapter.project(**payload,**auth)
            else:body={"bytes":self._adapter.resolve_artifact(**payload,**auth)}
            return {"status":200,"body":body}
        except (ValueError,TypeError,KeyError,AttributeError):return {"status":400,"body":{"reason":"EXTERNAL_VERIFICATION_DENIED"}}
