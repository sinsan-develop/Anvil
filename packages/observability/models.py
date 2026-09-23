"""Public, credential-free F-13 observation values."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import re


_EVIDENCE = re.compile(r"sha256:[0-9a-f]{64}\Z")
_DETAIL = re.compile(r"/[A-Za-z0-9/_-]+\Z")


class HealthState(str, Enum):
    HEALTHY = "HEALTHY"
    LATE = "LATE"
    EXPIRED = "EXPIRED"
    UNKNOWN = "UNKNOWN"


class AlertState(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class DeploymentState(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DEPLOYING = "DEPLOYING"
    SMOKE_TEST = "SMOKE_TEST"
    MONITORING = "MONITORING"
    RELEASED = "RELEASED"
    ROLLBACK_REQUIRED = "ROLLBACK_REQUIRED"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True, slots=True)
class HealthSignal:
    component: str
    state: str
    observed_at: datetime
    stale_after: timedelta
    error_count: int
    evidence_ref: str
    detail_path: str

    def __post_init__(self):
        if self.component not in {"database", "queue", "worker", "provider", "backend", "artifact_store"}:
            raise ValueError("HEALTH_COMPONENT_INVALID")
        if self.state not in HealthState._value2member_map_ or self.observed_at.tzinfo is None:
            raise ValueError("HEALTH_SIGNAL_INVALID")
        if self.stale_after <= timedelta(0) or type(self.error_count) is not int or self.error_count < 0:
            raise ValueError("HEALTH_SIGNAL_INVALID")
        if (type(self.evidence_ref) is not str or not _EVIDENCE.fullmatch(self.evidence_ref)
                or type(self.detail_path) is not str or self.detail_path.startswith("//")
                or not _DETAIL.fullmatch(self.detail_path)):
            raise ValueError("HEALTH_EVIDENCE_REQUIRED")


@dataclass(frozen=True, slots=True)
class DeploymentSignal:
    deployment_id: str
    state: str
    observed_at: datetime
    evidence_ref: str
    smoke_passed: bool = False
    monitoring_completed: bool = False
    owner_confirmed: bool = False
    critical_alerts: int | None = None

    def __post_init__(self):
        if (not self.deployment_id or self.state not in DeploymentState._value2member_map_
                or self.observed_at.tzinfo is None or not _EVIDENCE.fullmatch(self.evidence_ref)
                or type(self.critical_alerts) not in (int, type(None))
                or isinstance(self.critical_alerts, int) and self.critical_alerts < 0):
            raise ValueError("DEPLOYMENT_SIGNAL_INVALID")
        if (self.state == DeploymentState.RELEASED and
                not (self.smoke_passed and self.monitoring_completed and self.owner_confirmed
                     and self.critical_alerts == 0)):
            raise ValueError("DEPLOYMENT_RELEASE_EVIDENCE_REQUIRED")
