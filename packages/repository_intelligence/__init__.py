"""Reusable read-only Repository Intelligence adapter."""

from .errors import ScanError
from .models import ScanLimits, ScanRequest, ScanResult
from .scanner import scan_repository

__all__ = ["ScanError", "ScanLimits", "ScanRequest", "ScanResult", "scan_repository"]
