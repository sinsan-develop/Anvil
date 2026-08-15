"""Crash-safe same-filesystem progress and HANDOFF exporter."""

from __future__ import annotations

from enum import Enum
from hashlib import sha256
import json
import os
from pathlib import Path, PurePosixPath
from uuid import uuid4

from packages.outbox.models import OutboxStatus
from packages.persistence.progress_outbox_repository import ProgressOutboxRepository

from .models import ProgressSnapshot


class ProgressPersistenceError(RuntimeError):
    code = "PROGRESS_PERSISTENCE_ERROR"


class UnsafeExportPath(ProgressPersistenceError):
    pass


class SimulatedCrash(ProgressPersistenceError):
    pass


class CrashPoint(str, Enum):
    AFTER_DB_COMMIT_BEFORE_REPLACE = "FI-01"
    DURING_REPLACE = "FI-02"
    AFTER_REPLACE_BEFORE_ACK = "FI-03"


def _digest(content: bytes) -> str:
    return f"sha256:{sha256(content).hexdigest()}"


class AtomicProgressExporter:
    def __init__(self, root: Path, repository: ProgressOutboxRepository) -> None:
        self._root = root
        self._repository = repository

    def _target_directory(self, export_uri: str) -> Path:
        pure = PurePosixPath(export_uri)
        if pure.is_absolute() or not pure.parts or any(part in ("", ".", "..") for part in pure.parts):
            raise UnsafeExportPath("export_uri must be a canonical root-relative directory")
        if pure.suffix or len(pure.parts) < 2:
            raise UnsafeExportPath("export_uri must identify an owner directory, not a file alias")
        root = self._root.resolve()
        cursor = root
        for part in pure.parts:
            cursor = cursor / part
            if cursor.exists() and cursor.is_symlink():
                raise UnsafeExportPath("symlink components are forbidden")
        target = root.joinpath(*pure.parts)
        try:
            target.resolve(strict=False).relative_to(root)
        except ValueError as error:
            raise UnsafeExportPath("export target escapes the configured root") from error
        target.mkdir(parents=True, exist_ok=True)
        if target.is_symlink():
            raise UnsafeExportPath("export target must not be a symlink")
        return target

    @staticmethod
    def _write_temp(target: Path, content: bytes) -> Path:
        temporary = target.with_name(f".{target.name}.{uuid4().hex}.tmp")
        with temporary.open("xb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        if _digest(temporary.read_bytes()) != _digest(content):
            temporary.unlink(missing_ok=True)
            raise ProgressPersistenceError("temporary file checksum mismatch")
        return temporary

    @classmethod
    def _restore(cls, target: Path, previous: bytes | None) -> None:
        if previous is None:
            target.unlink(missing_ok=True)
            return
        temporary = cls._write_temp(target, previous)
        os.replace(temporary, target)

    def export(self, outbox_id: str, *, crash_at: CrashPoint | None = None) -> ProgressSnapshot:
        try:
            return self._export_once(outbox_id, crash_at=crash_at)
        except SimulatedCrash:
            raise
        except UnsafeExportPath:
            self._repository.mark_persistence_error(outbox_id)
            raise
        except Exception as error:
            self._repository.mark_persistence_error(outbox_id)
            raise ProgressPersistenceError("progress export stopped before acknowledgement") from error

    def _export_once(self, outbox_id: str, *, crash_at: CrashPoint | None = None) -> ProgressSnapshot:
        receipt = self._repository.outbox_by_id(outbox_id)
        if receipt.status is OutboxStatus.ACKNOWLEDGED:
            snapshots = getattr(self._repository, "snapshots_for")(receipt.request.owner_type, receipt.request.owner_id)
            return next(item for item in snapshots if item.event_sequence == receipt.request.event_sequence)
        if crash_at is CrashPoint.AFTER_DB_COMMIT_BEFORE_REPLACE:
            raise SimulatedCrash("FI-01 after DB commit and before replace")

        request = receipt.request
        target_directory = self._target_directory(request.export_uri)
        json_path = target_directory / "progress.json"
        handoff_path = target_directory / "BUILD_HANDOFF.md"
        if json_path.resolve() == handoff_path.resolve():
            raise UnsafeExportPath("progress and HANDOFF targets must not alias")
        payload = {
            "owner_type": request.owner_type.value,
            "owner_id": request.owner_id,
            "event_sequence": request.event_sequence,
            "status": request.status,
            "last_event_id": request.last_event_id,
            "next_safe_action": request.next_safe_action,
            "payload_hash": request.payload_hash,
        }
        json_bytes = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
        handoff_bytes = (
            "# BUILD HANDOFF\n\n"
            f"- owner_type: `{request.owner_type.value}`\n"
            f"- owner_id: `{request.owner_id}`\n"
            f"- event_sequence: `{request.event_sequence}`\n"
            f"- status: `{request.status}`\n"
            f"- last_event_id: `{request.last_event_id}`\n"
            f"- next_safe_action: `{request.next_safe_action}`\n"
            f"- payload_hash: `{request.payload_hash}`\n"
        ).encode("utf-8")
        json_temp = self._write_temp(json_path, json_bytes)
        handoff_temp = self._write_temp(handoff_path, handoff_bytes)
        previous_json = json_path.read_bytes() if json_path.exists() else None
        previous_handoff = handoff_path.read_bytes() if handoff_path.exists() else None
        replaced_json = False
        replaced_handoff = False
        try:
            os.replace(json_temp, json_path)
            replaced_json = True
            if crash_at is CrashPoint.DURING_REPLACE:
                raise SimulatedCrash("FI-02 during the paired file replace")
            os.replace(handoff_temp, handoff_path)
            replaced_handoff = True
            if _digest(json_path.read_bytes()) != _digest(json_bytes) or _digest(handoff_path.read_bytes()) != _digest(handoff_bytes):
                raise ProgressPersistenceError("published progress checksum mismatch")
        except Exception:
            if replaced_json:
                self._restore(json_path, previous_json)
            if replaced_handoff:
                self._restore(handoff_path, previous_handoff)
            json_temp.unlink(missing_ok=True)
            handoff_temp.unlink(missing_ok=True)
            raise
        if crash_at is CrashPoint.AFTER_REPLACE_BEFORE_ACK:
            raise SimulatedCrash("FI-03 after replace and before snapshot/ack")

        snapshot = ProgressSnapshot(
            snapshot_id=f"snapshot-{uuid4().hex}",
            outbox_id=outbox_id,
            owner_type=request.owner_type,
            owner_id=request.owner_id,
            event_sequence=request.event_sequence,
            payload_hash=request.payload_hash,
            json_hash=_digest(json_bytes),
            handoff_hash=_digest(handoff_bytes),
            export_uri=request.export_uri,
            created_at=request.created_at,
        )
        return self._repository.record_snapshot_and_ack(outbox_id, snapshot)
