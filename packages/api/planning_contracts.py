"""Framework-neutral planning approval guard contracts."""

from dataclasses import dataclass
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


class ApprovalErrorCode(str, Enum):
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    APPROVAL_EXPIRED = "APPROVAL_EXPIRED"
    APPROVAL_INVALIDATED = "APPROVAL_INVALIDATED"
    APPROVAL_TYPE_MISMATCH = "APPROVAL_TYPE_MISMATCH"
    SUBJECT_HASH_MISMATCH = "SUBJECT_HASH_MISMATCH"
    NONSEMANTIC_RECONFIRMATION_REJECTED = "NONSEMANTIC_RECONFIRMATION_REJECTED"


@dataclass(frozen=True, slots=True)
class ApprovalGuardRequest:
    subject_id: str
    subject_hash: str
    approval_type: str

    def __post_init__(self) -> None:
        if not isinstance(self.subject_id, str) or not self.subject_id.strip() or self.subject_id != self.subject_id.strip():
            raise ValueError("subject_id must be a canonical non-empty string")
        if not isinstance(self.subject_hash, str) or not _HASH.fullmatch(self.subject_hash):
            raise ValueError("subject_hash must be a canonical lowercase sha256 hash")
        if self.approval_type not in {"PLAN", "SCOPE_CHANGE", "APPLY", "DEPLOY", "DESTRUCTIVE"}:
            raise ValueError("approval_type is unsupported")


@dataclass(frozen=True, slots=True)
class ApprovalGuardResponse:
    allowed: bool
    status: str
    error_code: ApprovalErrorCode | None = None
