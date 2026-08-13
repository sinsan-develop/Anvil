"""Framework-neutral request, response, and error contracts for B-03."""

from dataclasses import dataclass
from enum import Enum
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _required(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


class ContractErrorCode(str, Enum):
    HUMAN_APPROVAL_REQUIRED = "HUMAN_APPROVAL_REQUIRED"
    HASH_MISMATCH = "HASH_MISMATCH"
    IMMUTABLE_REVISION = "IMMUTABLE_REVISION"
    SCOPE_EXPANSION_REQUIRES_APPROVAL = "SCOPE_EXPANSION_REQUIRES_APPROVAL"
    SEMANTIC_CHANGE_REQUIRES_APPROVAL = "SEMANTIC_CHANGE_REQUIRES_APPROVAL"


@dataclass(frozen=True, slots=True)
class ApproveDesignRequest:
    specification_id: str
    target_content_hash: str
    root_human_approval_id: str
    actor_id: str

    def __post_init__(self) -> None:
        for value, field in ((self.specification_id, "specification_id"), (self.root_human_approval_id, "root_human_approval_id"), (self.actor_id, "actor_id")):
            _required(value, field)
        if not isinstance(self.target_content_hash, str) or not _HASH.fullmatch(self.target_content_hash):
            raise ValueError("target_content_hash must be canonical sha256")


@dataclass(frozen=True, slots=True)
class ApproveDesignResponse:
    baseline_id: str
    baseline_content_hash: str


@dataclass(frozen=True, slots=True)
class ContractError:
    code: ContractErrorCode
    message: str
