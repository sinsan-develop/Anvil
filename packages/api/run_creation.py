"""Canonical POST /api/tasks/{taskId}/runs application adapter."""
from __future__ import annotations
from hashlib import sha256
import json
from packages.execution.run_creation import ActiveRunConflict, AuthorityMismatch, RunCreationCommand, RunCreationService, TaskNotFound, TaskNotReady, TaskVersionConflict
from .common import ApiContractError, ApplicationRequest, ApplicationResponse

_KEYS = {"workInstructionId","executionPlanId","expectedStateVersion","priorRunId","resumeCheckpointId"}
def _required_text(body, key):
    value=body.get(key)
    if not isinstance(value,str) or not value.strip() or value != value.strip() or len(value) > 128: raise ApiContractError("INVALID_RUN_CREATION",f"{key} is required.")
    return value


def _optional_id(body, key):
    value=body.get(key)
    if value is None:
        return None
    if not isinstance(value,str) or not value.strip() or value != value.strip() or len(value) > 128:
        raise ApiContractError("INVALID_RUN_CREATION",f"{key} is invalid.")
    return value

class RunCreationPort:
    def __init__(self, service: RunCreationService): self._service=service
    def __call__(self, request: ApplicationRequest):
        if set(request.body) != _KEYS: raise ApiContractError("INVALID_RUN_CREATION","The Run creation body does not match the canonical contract.")
        if request.body.get("expectedStateVersion") != request.expected_version: raise ApiContractError("EXPECTED_VERSION_MISMATCH","Expected resource versions do not match.",409)
        prior_run_id = _optional_id(request.body,"priorRunId")
        resume_checkpoint_id = _optional_id(request.body,"resumeCheckpointId")
        try:
            permission_snapshot={"actorRole":request.principal.actor_role,"environmentId":request.authorized_environment_id,"permissions":sorted(request.principal.permissions),"projectId":request.authorized_project_id}
            permission_snapshot_hash="sha256:"+sha256(json.dumps(permission_snapshot,sort_keys=True,separators=(",",":")).encode()).hexdigest()
            command=RunCreationCommand(None,request.path_parameters["taskId"],_required_text(request.body,"workInstructionId"),_required_text(request.body,"executionPlanId"),request.expected_version,request.authorized_project_id,request.authorized_environment_id,permission_snapshot_hash,prior_run_id,resume_checkpoint_id,request.principal.actor_id,request.request_id,request.headers["idempotency-key"],request.target_hash,request.reason)
        except (TypeError, ValueError) as error:
            raise ApiContractError("INVALID_RUN_CREATION","The Run creation request is invalid.") from error
        try: receipt=self._service.create(command)
        except TaskNotFound as e: raise ApiContractError("TASK_NOT_FOUND","The task was not found.",404) from e
        except TaskVersionConflict as e: raise ApiContractError("TASK_VERSION_CONFLICT","The task version changed.",409) from e
        except TaskNotReady as e: raise ApiContractError("TASK_NOT_READY","The task is not ready to start.",409) from e
        except AuthorityMismatch as e: raise ApiContractError("RUN_AUTHORITY_MISMATCH","Approved Run authority could not be verified.",409) from e
        except ActiveRunConflict as e: raise ApiContractError("ACTIVE_RUN_EXISTS","The task already has an active Run.",409) from e
        body={"runId":receipt.run_id,"phase":receipt.phase,"status":receipt.status,"eventStreamUrl":f"/api/runs/{receipt.run_id}/events"}
        return ApplicationResponse(body,202)
