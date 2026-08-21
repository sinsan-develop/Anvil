"""Persistence port and deterministic in-memory recovery repository."""

from __future__ import annotations

from threading import RLock
from datetime import datetime
import hashlib
from typing import Protocol, runtime_checkable

from packages.recovery.models import (
    RecoveryAuditEvent,
    RecoveryDecision,
    RecoveryFaultCounters,
    RecoveryInput,
    RecoveryStatus,
    ActionAttempt,
    ActionReconciliation,
    ActionStatus,
    ReconciliationClass,
    ResumeLease,
    ResumeReceipt,
    StaleRecoveryFencingToken,
)


@runtime_checkable
class RecoveryRepository(Protocol):
    def load(self, run_id: str) -> RecoveryInput: ...

    def save_decision(self, decision: RecoveryDecision) -> None: ...

    def append_audit(self, event: RecoveryAuditEvent) -> None: ...


class InMemoryRecoveryRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self._inputs: dict[str, RecoveryInput] = {}
        self._decisions: dict[str, RecoveryDecision] = {}
        self._audits: dict[str, list[RecoveryAuditEvent]] = {}
        self._leases: dict[str, ResumeLease] = {}
        self._receipts: dict[str, ResumeReceipt] = {}

    def seed(self, source: RecoveryInput) -> None:
        with self._lock:
            self._inputs[source.run_id] = source

    def load(self, run_id: str) -> RecoveryInput:
        with self._lock:
            return self._inputs[run_id]

    def save_decision(self, decision: RecoveryDecision) -> None:
        with self._lock:
            self._decisions[decision.run_id] = decision

    def decision(self, run_id: str) -> RecoveryDecision | None:
        with self._lock:
            return self._decisions.get(run_id)

    def append_audit(self, event: RecoveryAuditEvent) -> None:
        with self._lock:
            self._audits.setdefault(event.run_id, []).append(event)

    def audit_events(self, run_id: str) -> tuple[RecoveryAuditEvent, ...]:
        with self._lock:
            return tuple(self._audits.get(run_id, ()))

    def set_current_lease(self, lease: ResumeLease) -> None:
        with self._lock:
            current = self._leases.get(lease.run_id)
            if current is not None and (
                lease.worker_epoch <= current.worker_epoch or lease.write_epoch <= current.write_epoch
            ):
                raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
            self._leases[lease.run_id] = lease

    def commit_resume(
        self, run_id: str, lease: ResumeLease, checkpoint_id: str
    ) -> ResumeReceipt:
        with self._lock:
            current = self._leases.get(run_id)
            if current != lease or lease.run_id != run_id:
                raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
            existing = self._receipts.get(run_id)
            proposed = ResumeReceipt(run_id, lease.worker_epoch, checkpoint_id)
            if existing is not None:
                if existing != proposed:
                    raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN")
                return existing
            self._receipts[run_id] = proposed
            return proposed


class PostgresRecoveryRepository:
    """Durable recovery adapter; every recovery decision is reconstructed from PostgreSQL."""

    def __init__(self, dsn: str) -> None:
        if not isinstance(dsn, str) or not dsn.strip():
            raise ValueError("dsn is required")
        self._dsn = dsn

    def _connect(self):
        import psycopg

        return psycopg.connect(self._dsn)

    @staticmethod
    def _json(value: object):
        from psycopg.types.json import Jsonb

        return Jsonb(value)

    def persist_recovery_lineage(self, source: RecoveryInput) -> None:
        """Persist a complete immutable Run/event/checkpoint/action recovery lineage."""
        run_id = source.run_id
        task_id = f"task-{run_id}"
        artifact_id = f"artifact-{run_id}"
        storage_hash = source.checkpoint_hash.removeprefix("sha256:")
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,%s,%s,%s,%s,%s,'IN_PROGRESS')",
                (task_id, source.project_id, "repo-recovery", "Recovery", "Durable recovery", "system"),
            )
            connection.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-recovery','B','ACTIVE',%s)",
                (run_id, task_id, max(source.db_event_sequence, 1)),
            )
            for sequence, action in enumerate(source.actions, 1):
                connection.execute(
                    "INSERT INTO plan_steps(step_id,run_id,step_lineage_id,sequence) VALUES (%s,%s,%s,%s)",
                    (action.step_id, run_id, f"lineage-{action.step_id}", sequence),
                )
            connection.execute(
                "INSERT INTO run_events(event_id,run_id,sequence_no,event_type,actor_type,actor_id,"
                "correlation_id,causation_event_id,idempotency_key,expected_version,applied_version,"
                "request_hash,payload,blocked_code,created_at) VALUES "
                "(%s,%s,%s,'RECOVERY_CHECKPOINT','SYSTEM','recovery-bootstrap',%s,NULL,%s,%s,%s,%s,%s,NULL,CURRENT_TIMESTAMP)",
                (
                    f"event-{run_id}",
                    run_id,
                    source.db_event_sequence,
                    f"correlation-{run_id}",
                    f"recovery-bootstrap-{run_id}",
                    max(source.db_event_sequence - 1, 0),
                    source.db_event_sequence,
                    source.checkpoint_hash,
                    self._json({"checkpoint_id": source.checkpoint_id}),
                ),
            )
            connection.execute(
                "INSERT INTO artifacts(artifact_id,artifact_type,content_hash,byte_size,media_type,storage_ref,"
                "project_id,run_id,step_id,actor_id,created_at,source_artifact_ids) VALUES "
                "(%s,'CHECKPOINT_STATE',%s,0,'application/json',%s,%s,%s,NULL,'recovery-bootstrap',CURRENT_TIMESTAMP,%s)",
                (
                    artifact_id,
                    source.checkpoint_hash,
                    f"sha256/{storage_hash[:2]}/{storage_hash}",
                    source.project_id,
                    run_id,
                    self._json([]),
                ),
            )
            connection.execute(
                "INSERT INTO checkpoints(checkpoint_id,run_id,thread_id,graph_version,state_schema_version,"
                "source_event_sequence,next_nodes,pending_writes,state_artifact_id,state_artifact_hash,"
                "binding_hashes,actor_id,created_at) VALUES (%s,%s,%s,'1',1,%s,%s,%s,%s,%s,%s,'recovery-bootstrap',CURRENT_TIMESTAMP)",
                (
                    source.checkpoint_id,
                    run_id,
                    f"thread-{run_id}",
                    source.db_event_sequence,
                    self._json([]),
                    self._json([]),
                    artifact_id,
                    source.checkpoint_hash,
                    self._json({"target_hash": source.target_hash}),
                ),
            )
            connection.execute(
                "INSERT INTO recovery_runs(run_id,project_id,environment_id,db_event_sequence,"
                "progress_event_sequence,handoff_event_sequence,checkpoint_id,checkpoint_hash,target_hash,"
                "git_head,secret_reference,secret_status,capability_snapshot_hash,current_capability_hash,"
                "required_capabilities,current_capabilities) VALUES "
                "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    run_id,
                    source.project_id,
                    source.environment_id,
                    source.db_event_sequence,
                    source.progress_event_sequence,
                    source.handoff_event_sequence,
                    source.checkpoint_id,
                    source.checkpoint_hash,
                    source.target_hash,
                    source.git_head,
                    source.secret_reference,
                    source.secret_status,
                    source.capability_snapshot_hash,
                    source.current_capability_hash,
                    self._json(sorted(source.required_capabilities)),
                    self._json(sorted(source.current_capabilities)),
                ),
            )
            for action in source.actions:
                connection.execute(
                    "INSERT INTO recovery_action_attempts(action_id,run_id,step_id,status,idempotency_key,provider_receipt_ref) "
                    "VALUES (%s,%s,%s,%s,%s,%s)",
                    (
                        action.action_id,
                        run_id,
                        action.step_id,
                        action.status.value,
                        action.idempotency_key,
                        action.provider_receipt_ref,
                    ),
                )

    def load(self, run_id: str) -> RecoveryInput:
        from psycopg.rows import dict_row

        with self._connect() as connection:
            connection.row_factory = dict_row
            source = connection.execute(
                "SELECT * FROM recovery_runs WHERE run_id=%s", (run_id,)
            ).fetchone()
            if source is None:
                raise KeyError(run_id)
            rows = connection.execute(
                "SELECT * FROM recovery_action_attempts WHERE run_id=%s ORDER BY action_id",
                (run_id,),
            ).fetchall()
        return RecoveryInput(
            run_id=source["run_id"],
            project_id=source["project_id"],
            environment_id=source["environment_id"],
            db_event_sequence=source["db_event_sequence"],
            progress_event_sequence=source["progress_event_sequence"],
            handoff_event_sequence=source["handoff_event_sequence"],
            checkpoint_id=source["checkpoint_id"],
            checkpoint_hash=source["checkpoint_hash"],
            target_hash=source["target_hash"],
            git_head=source["git_head"],
            actions=tuple(
                ActionAttempt(
                    row["action_id"],
                    row["step_id"],
                    ActionStatus(row["status"]),
                    row["idempotency_key"],
                    row["provider_receipt_ref"],
                    ActionStatus(row["interrupted_from_status"])
                    if row["interrupted_from_status"]
                    else None,
                )
                for row in rows
            ),
            secret_reference=source["secret_reference"],
            secret_status=source["secret_status"],
            capability_snapshot_hash=source["capability_snapshot_hash"],
            current_capability_hash=source["current_capability_hash"],
            required_capabilities=frozenset(source["required_capabilities"]),
            current_capabilities=frozenset(source["current_capabilities"]),
        )

    def save_decision(self, decision: RecoveryDecision) -> None:
        payload = {
            "target_hash": decision.target_hash,
            "last_safe_checkpoint_id": decision.last_safe_checkpoint_id,
            "last_safe_checkpoint_hash": decision.last_safe_checkpoint_hash,
            "skipped_step_ids": list(decision.skipped_step_ids),
            "resumable_step_ids": list(decision.resumable_step_ids),
            "actions": [
                {
                    "action_id": item.action_id,
                    "step_id": item.step_id,
                    "classification": item.classification.value,
                    "retry_allowed": item.retry_allowed,
                    "authoritative_receipt_ref": item.authoritative_receipt_ref,
                }
                for item in decision.action_reconciliations
            ],
        }
        decision_id = hashlib.sha256(
            f"{decision.run_id}:{decision.evidence_hash}".encode()
        ).hexdigest()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO recovery_decisions(decision_id,run_id,event_sequence,status,evidence_hash,"
                "blocked_reason,next_action,decision_payload,observed_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (run_id,event_sequence,evidence_hash) DO NOTHING",
                (
                    decision_id,
                    decision.run_id,
                    decision.event_sequence,
                    decision.status.value,
                    decision.evidence_hash,
                    decision.blocked_reason,
                    decision.next_action,
                    self._json(payload),
                    decision.observed_at,
                ),
            )

    def decision(self, run_id: str) -> RecoveryDecision | None:
        from psycopg.rows import dict_row

        with self._connect() as connection:
            connection.row_factory = dict_row
            row = connection.execute(
                "SELECT * FROM recovery_decisions WHERE run_id=%s ORDER BY observed_at DESC LIMIT 1",
                (run_id,),
            ).fetchone()
        if row is None:
            return None
        payload = row["decision_payload"]
        return RecoveryDecision(
            run_id,
            RecoveryStatus(row["status"]),
            row["event_sequence"],
            payload["target_hash"],
            row["evidence_hash"],
            payload["last_safe_checkpoint_id"],
            payload["last_safe_checkpoint_hash"],
            tuple(payload["skipped_step_ids"]),
            tuple(payload["resumable_step_ids"]),
            tuple(
                ActionReconciliation(
                    item["action_id"],
                    item["step_id"],
                    ReconciliationClass(item["classification"]),
                    item["retry_allowed"],
                    item["authoritative_receipt_ref"],
                )
                for item in payload["actions"]
            ),
            row["blocked_reason"],
            row["next_action"],
            row["observed_at"],
        )

    def append_audit(self, event: RecoveryAuditEvent) -> None:
        identity = f"{event.run_id}:{event.event_type}:{event.reason or ''}"
        audit_id = hashlib.sha256(identity.encode()).hexdigest()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO recovery_audit_events(audit_event_id,run_id,event_type,actor_id,"
                "secret_reference,reason,occurred_at) VALUES (%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (audit_event_id) DO NOTHING",
                (
                    audit_id,
                    event.run_id,
                    event.event_type,
                    event.actor_id,
                    event.secret_reference,
                    event.reason,
                    event.occurred_at,
                ),
            )

    def record_action_boundary(
        self,
        run_id: str,
        action_id: str,
        *,
        status: ActionStatus,
        process_id: int,
        boundary: str,
    ) -> None:
        if status not in {ActionStatus.RUNNING, ActionStatus.REQUEST_PREPARED}:
            raise ValueError("only pre-send or running boundaries are accepted")
        with self._connect() as connection:
            connection.execute(
                "UPDATE recovery_runs SET process_status='RUNNING',process_id=%s WHERE run_id=%s",
                (process_id, run_id),
            )
            cursor = connection.execute(
                "UPDATE recovery_action_attempts SET status=%s,last_boundary=%s,boundary_count=boundary_count+1 "
                "WHERE run_id=%s AND action_id=%s",
                (status.value, boundary, run_id, action_id),
            )
            if cursor.rowcount != 1:
                raise KeyError(action_id)

    def record_provider_send(
        self,
        run_id: str,
        action_id: str,
        *,
        process_id: int,
        receipt_ref: str,
    ) -> None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT idempotency_key FROM recovery_action_attempts WHERE run_id=%s AND action_id=%s FOR UPDATE",
                (run_id, action_id),
            ).fetchone()
            if row is None:
                raise KeyError(action_id)
            inserted = connection.execute(
                "INSERT INTO recovery_provider_receipts(idempotency_key,run_id,action_id,receipt_ref) "
                "VALUES (%s,%s,%s,%s) ON CONFLICT (idempotency_key) DO NOTHING RETURNING receipt_ref",
                (row[0], run_id, action_id, receipt_ref),
            ).fetchone()
            if inserted is None:
                connection.execute(
                    "UPDATE recovery_action_attempts SET duplicate_request_count=duplicate_request_count+1 "
                    "WHERE action_id=%s",
                    (action_id,),
                )
                return
            connection.execute(
                "UPDATE recovery_runs SET process_status='RUNNING',process_id=%s WHERE run_id=%s",
                (process_id, run_id),
            )
            connection.execute(
                "UPDATE recovery_action_attempts SET status='REQUEST_SENT',last_boundary='AFTER_SEND_BEFORE_RESPONSE',"
                "boundary_count=boundary_count+1,send_count=send_count+1 WHERE action_id=%s",
                (action_id,),
            )

    def mark_process_interrupted(
        self, run_id: str, *, actor_id: str, observed_at: datetime
    ) -> None:
        with self._connect() as connection:
            changed = connection.execute(
                "UPDATE recovery_runs SET process_status='INTERRUPTED',process_id=NULL,"
                "interruption_count=interruption_count+1 WHERE run_id=%s AND process_status='RUNNING' RETURNING run_id",
                (run_id,),
            ).fetchone()
            if changed is not None:
                connection.execute(
                    "UPDATE recovery_action_attempts SET interrupted_from_status=status,status='INTERRUPTED' "
                    "WHERE run_id=%s AND status IN ('RUNNING','REQUEST_PREPARED','REQUEST_SENT')",
                    (run_id,),
                )
        if changed is not None:
            self.append_audit(
                RecoveryAuditEvent(run_id, "PROCESS_INTERRUPTED", actor_id, observed_at, reason="PROCESS_EXIT")
            )

    def authoritative_receipt(self, run_id: str, action_id: str) -> str | None:
        with self._connect() as connection:
            current = connection.execute(
                "SELECT provider_receipt_ref FROM recovery_action_attempts WHERE run_id=%s AND action_id=%s FOR UPDATE",
                (run_id, action_id),
            ).fetchone()
            if current is None:
                raise KeyError(action_id)
            if current[0] is not None:
                return current[0]
            receipt = connection.execute(
                "SELECT receipt_ref FROM recovery_provider_receipts WHERE run_id=%s AND action_id=%s",
                (run_id, action_id),
            ).fetchone()
            connection.execute(
                "UPDATE recovery_action_attempts SET receipt_lookup_count=receipt_lookup_count+1,"
                "provider_receipt_ref=%s WHERE action_id=%s",
                (receipt[0] if receipt else None, action_id),
            )
            return receipt[0] if receipt else None

    def mark_automatic_retry(self, run_id: str, action_id: str, evidence_hash: str) -> None:
        with self._connect() as connection:
            inserted = connection.execute(
                "INSERT INTO recovery_retry_receipts(run_id,action_id,evidence_hash) VALUES (%s,%s,%s) "
                "ON CONFLICT DO NOTHING RETURNING action_id",
                (run_id, action_id, evidence_hash),
            ).fetchone()
            if inserted is not None:
                connection.execute(
                    "UPDATE recovery_action_attempts SET automatic_retry_count=automatic_retry_count+1 "
                    "WHERE run_id=%s AND action_id=%s",
                    (run_id, action_id),
                )

    def fault_counters(self, run_id: str, action_id: str) -> RecoveryFaultCounters:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT r.interruption_count,a.boundary_count,a.send_count,a.receipt_lookup_count,"
                "a.automatic_retry_count,a.duplicate_request_count FROM recovery_runs r "
                "JOIN recovery_action_attempts a ON a.run_id=r.run_id WHERE r.run_id=%s AND a.action_id=%s",
                (run_id, action_id),
            ).fetchone()
        if row is None:
            raise KeyError(action_id)
        return RecoveryFaultCounters(*row)

    def audit_count(self, run_id: str, event_type: str) -> int:
        with self._connect() as connection:
            return connection.execute(
                "SELECT count(*) FROM recovery_audit_events WHERE run_id=%s AND event_type=%s",
                (run_id, event_type),
            ).fetchone()[0]

    def commit_resume(
        self,
        run_id: str,
        lease: ResumeLease,
        checkpoint_id: str,
        *,
        worker_lease_id: str,
        write_lease_id: str,
    ) -> ResumeReceipt:
        import psycopg

        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT (anvil_recovery_commit_resume(%s,%s,%s,%s,%s,%s,%s,%s)).checkpoint_id",
                    (
                        run_id,
                        worker_lease_id,
                        write_lease_id,
                        lease.worker_epoch,
                        lease.execution_fencing_token,
                        lease.write_epoch,
                        lease.write_fencing_token,
                        checkpoint_id,
                    ),
                ).fetchone()
        except psycopg.errors.RaiseException as exc:
            if "STALE_FENCING_TOKEN" in str(exc):
                raise StaleRecoveryFencingToken("STALE_FENCING_TOKEN") from exc
            raise
        return ResumeReceipt(run_id, lease.worker_epoch, row[0])
