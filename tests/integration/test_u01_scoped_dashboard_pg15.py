"""Opt-in, read-only PG15 smoke for the Task2 scoped audit owner."""

import os
from datetime import datetime, timezone

import pytest

from packages.api.scoped_dashboard import read_scoped_dashboard
from packages.persistence.operations_repository import PostgresOperationsRepository


@pytest.mark.skipif(not os.environ.get("ANVIL_TEST_POSTGRES_DSN"),
                    reason="isolated WSL-server PG15 DSN not configured")
def test_empty_isolated_pair_is_complete_without_creating_rows():
    # This smoke intentionally performs no writes. Main supplies the isolated
    # migrated PG15 and confirms its exact Git SHA before enabling it.
    owner = PostgresOperationsRepository(os.environ["ANVIL_TEST_POSTGRES_DSN"])
    result = read_scoped_dashboard("u01-opt-in-empty-project", "u01-opt-in-empty-environment",
                                   "1d", datetime.now(timezone.utc), owner)
    assert result["occurrences"]["criticalDetected"]["count"] == 0
    assert result["current"]["unresolvedCritical"] == []
