"""PostgreSQL adapter for authority-bound, atomic Run creation."""
from __future__ import annotations
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any, Callable, Mapping
from uuid import uuid4
from sqlalchemy import text
from packages.domain.events import EventType
from packages.execution.run_creation import ActiveRunConflict, AuthorityMismatch, RunCreationCommand, RunCreationReceipt, TaskNotFound, TaskNotReady, TaskVersionConflict

def _hash(value: Mapping[str,Any]) -> str:
    raw=json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
    return "sha256:"+sha256(raw).hexdigest()

class SqlAlchemyRunCreationRepository:
    def __init__(self, session_factory: Callable[[],Any], *, run_id_factory: Callable[[],str]|None=None, clock: Callable[[],datetime]|None=None):
        self._sessions=session_factory; self._run_id=run_id_factory or (lambda: str(uuid4())); self._clock=clock or (lambda: datetime.now(timezone.utc))
    def create(self, command: RunCreationCommand) -> RunCreationReceipt:
        fingerprint=_hash({"taskId":command.task_id,"workInstructionId":command.work_instruction_id,"executionPlanId":command.execution_plan_id,"expectedStateVersion":command.expected_task_version,"projectId":command.project_id,"environmentId":command.environment_id,"permissionSnapshotHash":command.permission_snapshot_hash,"priorRunId":command.prior_run_id,"resumeCheckpointId":command.resume_checkpoint_id,"targetHash":command.target_hash,"actorId":command.actor_id,"reason":command.reason})
        session=self._sessions()
        try:
            with session.begin():
                task=session.execute(text("SELECT task_id, project_id, status, version FROM tasks WHERE task_id=:task_id FOR UPDATE"),{"task_id":command.task_id}).mappings().one_or_none()
                if task is None: raise TaskNotFound(command.task_id)
                if task["project_id"] != command.project_id: raise AuthorityMismatch("task project scope mismatch")
                replay=session.execute(text("SELECT run_id, creation_request_hash FROM runs WHERE task_id=:task_id AND idempotency_key=:key"),{"task_id":command.task_id,"key":command.idempotency_key}).mappings().one_or_none()
                if replay is not None:
                    if replay["creation_request_hash"] != fingerprint: raise AuthorityMismatch("idempotency fingerprint mismatch")
                    creation_event=session.execute(text("SELECT event_id, event_type FROM run_events WHERE run_id=:run_id AND sequence_no=1"),{"run_id":replay["run_id"]}).mappings().one_or_none()
                    if creation_event is None or creation_event["event_type"]!=EventType.TASK_CONFIRMED.value: raise AuthorityMismatch("idempotent Run is incomplete")
                    return RunCreationReceipt(replay["run_id"],command.task_id,"ANALYZING","ACTIVE",(str(creation_event["event_id"]),),True)
                if task["status"] != "CONFIRMED": raise TaskNotReady(command.task_id)
                if int(task["version"]) != command.expected_task_version: raise TaskVersionConflict(command.task_id)
                active=session.execute(text("SELECT run_id FROM runs WHERE task_id=:task_id AND status IN ('QUEUED','ACTIVE','WAITING_APPROVAL','BLOCKED','INTERRUPTED','PAUSED_USER','PAUSE_REQUESTED','PAUSED_QUOTA','WAITING_DECISION','AWAITING_EXCEPTION_REVIEW','CANCEL_REQUESTED') LIMIT 1"),{"task_id":command.task_id}).scalar_one_or_none()
                if active is not None: raise ActiveRunConflict(command.task_id)
                authority=self._authority(session,command,task["project_id"])
                self._continuation(session,command,authority)
                run_id=self._run_id()
                session.execute(text("INSERT INTO runs (run_id,task_id,baseline_id,phase,status,version,work_instruction_id,execution_plan_id,idempotency_key,creation_request_hash,environment_id,permission_snapshot_hash,prior_run_id,resume_checkpoint_id) VALUES (:run_id,:task_id,:baseline_id,'DRAFT','ACTIVE',1,:wi,:plan,:key,:fingerprint,:environment,:permission_hash,:prior,:checkpoint)"),{"run_id":run_id,"task_id":command.task_id,"baseline_id":authority["baseline_id"],"wi":command.work_instruction_id,"plan":command.execution_plan_id,"key":command.idempotency_key,"fingerprint":fingerprint,"environment":command.environment_id,"permission_hash":command.permission_snapshot_hash,"prior":command.prior_run_id,"checkpoint":command.resume_checkpoint_id})
                now=self._clock()
                event_payload={"artifact_type":"Task snapshot","conditions_satisfied":True,"questions_resolved":True,"scope_confirmed":True,"design_hash_approved":True,"work_plan_hash_approved":True,"design_specification_hash":authority["design_specification_hash"],"design_baseline_hash":authority["design_baseline_hash"],"work_plan_hash":authority["work_plan_hash"],"work_instruction_hash":authority["work_instruction_hash"],"execution_plan_hash":authority["plan_hash"],"permission_snapshot_hash":command.permission_snapshot_hash,"environment_id":command.environment_id,"reason":command.reason}
                event_id=self._append(session,command,run_id,EventType.TASK_CONFIRMED,1,None,event_payload,now)
                session.execute(text("UPDATE runs SET phase='ANALYZING',status='ACTIVE' WHERE run_id=:run_id AND version=2"),{"run_id":run_id})
                updated=session.execute(text("UPDATE tasks SET status='IN_PROGRESS',version=version+1 WHERE task_id=:task_id AND status='CONFIRMED' AND version=:version RETURNING version"),{"task_id":command.task_id,"version":command.expected_task_version}).scalar_one_or_none()
                if updated is None: raise TaskVersionConflict(command.task_id)
                return RunCreationReceipt(run_id,command.task_id,"ANALYZING","ACTIVE",(event_id,),False)
        finally:
            close=getattr(session,"close",None)
            if callable(close): close()
    @staticmethod
    def _authority(session,command,project_id):
        row=session.execute(text("""
            SELECT
                db.artifact_id AS baseline_id,
                db.content_hash AS design_baseline_hash,
                ds.content_hash AS design_specification_hash,
                wp.content_hash AS work_plan_hash,
                wi.content_hash AS work_instruction_hash,
                ep.plan_hash,
                ep.baseline_analysis_hash,
                ep.impact_analysis_hash,
                (SELECT count(*) FROM approval_records a
                 WHERE a.approval_id=db.root_human_approval_id
                   AND a.approval_type='DESIGN_SPECIFICATION'
                   AND a.subject_id=db.specification_id
                   AND a.subject_hash=ds.content_hash
                   AND a.authenticated_human AND a.status='ACTIVE'
                   AND a.expires_at>CURRENT_TIMESTAMP) AS db_ok,
                (SELECT count(*) FROM approval_records a
                 WHERE a.subject_id=wp.artifact_id AND a.subject_hash=wp.content_hash
                   AND a.approval_type='WORK_PLAN' AND a.authenticated_human
                   AND a.status='ACTIVE' AND a.expires_at>CURRENT_TIMESTAMP) AS wp_ok,
                (SELECT count(*) FROM approval_records a
                 WHERE a.subject_id=wi.artifact_id AND a.subject_hash=wi.content_hash
                   AND a.approval_type='WORK_INSTRUCTION' AND a.authenticated_human
                   AND a.status='ACTIVE' AND a.expires_at>CURRENT_TIMESTAMP) AS wi_ok,
                (SELECT count(*) FROM approval_records a
                 WHERE a.subject_id=ep.plan_id AND a.subject_hash=ep.plan_hash
                   AND a.approval_type='EXECUTION_PLAN' AND a.authenticated_human
                   AND a.status='ACTIVE' AND a.expires_at>CURRENT_TIMESTAMP) AS ep_ok
            FROM work_instructions wi
            JOIN iteration_plans ip ON ip.artifact_id=wi.iteration_plan_id AND ip.content_hash=wi.iteration_plan_hash
            JOIN work_plans wp ON wp.artifact_id=ip.work_plan_id AND wp.content_hash=ip.work_plan_hash
            JOIN design_baselines db ON db.artifact_id=wp.design_baseline_id AND db.content_hash=wp.design_baseline_hash
            JOIN design_artifacts ds ON ds.artifact_id=db.specification_id AND ds.artifact_type='DESIGN_SPECIFICATION'
            JOIN execution_plans ep ON ep.plan_id=:plan
                AND ep.source_work_instruction_id=wi.artifact_id
                AND ep.source_work_instruction_hash=wi.content_hash
            WHERE wi.artifact_id=:wi AND ep.status='APPROVED' AND db.project_id=:project
        """),{"wi":command.work_instruction_id,"plan":command.execution_plan_id,"project":project_id}).mappings().one_or_none()
        if row is None or row["plan_hash"]!=command.target_hash or any(int(row[key])<1 for key in ("db_ok","wp_ok","wi_ok","ep_ok")): raise AuthorityMismatch("artifact approval lineage mismatch")
        return row
    @staticmethod
    def _continuation(session,command,authority):
        if command.prior_run_id is None: return
        bindings=json.dumps({
            "design_specification":authority["design_specification_hash"],
            "design_baseline":authority["design_baseline_hash"],
            "work_plan":authority["work_plan_hash"],
            "work_instruction":authority["work_instruction_hash"],
            "execution_plan":authority["plan_hash"],
            "permission_snapshot":command.permission_snapshot_hash,
        },sort_keys=True,separators=(",",":"))
        valid=session.execute(text("""
            SELECT 1
            FROM runs prior
            JOIN checkpoints c ON c.checkpoint_id=:checkpoint AND c.run_id=prior.run_id
            JOIN artifacts state_artifact ON state_artifact.artifact_id=c.state_artifact_id
            WHERE prior.run_id=:prior
              AND prior.task_id=:task_id
              AND prior.baseline_id=:baseline_id
              AND prior.work_instruction_id=:work_instruction_id
              AND prior.execution_plan_id=:execution_plan_id
              AND prior.environment_id=:environment_id
              AND prior.permission_snapshot_hash=:permission_snapshot_hash
              AND prior.status IN ('CANCELLED','FAILED','SUCCEEDED','FINISHED_WITH_FAILURES','REJECTED','DISCARDED')
              AND c.pending_writes::jsonb='[]'::jsonb
              AND state_artifact.artifact_type='CHECKPOINT_STATE'
              AND state_artifact.run_id=prior.run_id
              AND state_artifact.project_id=:project_id
              AND state_artifact.content_hash=c.state_artifact_hash
              AND c.binding_hashes::jsonb=CAST(:binding_hashes AS jsonb)
              AND NOT EXISTS (
                  SELECT 1
                  FROM plan_steps ps
                  JOIN step_attempts sa ON sa.plan_step_id=ps.step_id
                  JOIN results result ON result.step_attempt_id=sa.attempt_id AND result.status='COMPLETED'
                  WHERE ps.run_id=prior.run_id
                    AND (
                        result.target_hash<>result.delivered_hash
                        OR NOT EXISTS (
                            SELECT 1 FROM artifacts output
                            WHERE output.run_id=prior.run_id AND output.step_id=ps.step_id
                              AND output.project_id=:project_id AND output.content_hash=result.delivered_hash
                        )
                        OR NOT EXISTS (
                            SELECT 1 FROM evidence_manifests evidence
                            WHERE evidence.run_id=prior.run_id
                              AND evidence.step_id=ps.step_id
                              AND evidence.project_id=:project_id
                              AND evidence.execution_plan_id=:execution_plan_id
                              AND evidence.execution_plan_hash=:execution_plan_hash
                              AND evidence.permission_snapshot_hash=:permission_snapshot_hash
                              AND evidence.target_hash=result.target_hash
                              AND evidence.delivered_artifact_hash=result.delivered_hash
                              AND evidence.design_baseline_hash=:design_baseline_hash
                              AND evidence.work_plan_hash=:work_plan_hash
                              AND evidence.work_instruction_hash=:work_instruction_hash
                              AND evidence.environment_id=:environment_id
                        )
                    )
              )
        """),{
            "prior":command.prior_run_id,"checkpoint":command.resume_checkpoint_id,
            "task_id":command.task_id,"baseline_id":authority["baseline_id"],
            "work_instruction_id":command.work_instruction_id,"execution_plan_id":command.execution_plan_id,
            "environment_id":command.environment_id,"permission_snapshot_hash":command.permission_snapshot_hash,
            "execution_plan_hash":authority["plan_hash"],
            "project_id":command.project_id,"binding_hashes":bindings,
            "design_baseline_hash":authority["design_baseline_hash"],"work_plan_hash":authority["work_plan_hash"],
            "work_instruction_hash":authority["work_instruction_hash"],
        }).scalar_one_or_none()
        if valid is None: raise AuthorityMismatch("continuation lineage mismatch")
    @staticmethod
    def _append(session,command,run_id,event_type: EventType,expected,causation,payload,now):
        event_value=event_type.value
        event_id=str(uuid4()); key=f"{command.idempotency_key}:{event_value.lower()}"; request_hash=_hash({"runId":run_id,"eventId":event_id,"type":event_value,"key":key,"payload":payload,"actor":command.actor_id})
        row=session.execute(text("SELECT * FROM anvil_append_run_event(:event_id,:run_id,:event_type,'HUMAN',:actor,:correlation,:causation,:key,:expected,:request_hash,CAST(:payload AS json),NULL,:created_at)"),{"event_id":event_id,"run_id":run_id,"event_type":event_value,"actor":command.actor_id,"correlation":command.correlation_id,"causation":causation,"key":key,"expected":expected,"request_hash":request_hash,"payload":json.dumps(payload,sort_keys=True,separators=(",",":")),"created_at":now}).mappings().one()
        return str(row["out_event_id"])
