"""Fail-closed process recovery and resume contracts."""

from .models import RecoveryDecision, RecoveryInput, RecoveryStatus

__all__ = ["RecoveryDecision", "RecoveryInput", "RecoveryService", "RecoveryStatus"]


def __getattr__(name: str):
    if name == "RecoveryService":
        from .service import RecoveryService

        return RecoveryService
    raise AttributeError(name)
