"""Deterministic, in-memory end-to-end fixture for the C-15 contracts.

The package is deliberately a backend/API-shaped harness.  It does not start
an HTTP server and never calls a provider, database, browser, or deployment.
"""

from .harness import (
    E2EError,
    E2EResponse,
    E2EProjection,
    SyntheticE2EHarness,
    run_synthetic_e2e,
)

__all__ = ["E2EError", "E2EResponse", "E2EProjection", "SyntheticE2EHarness", "run_synthetic_e2e"]
