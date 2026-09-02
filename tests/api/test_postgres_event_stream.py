from __future__ import annotations

import pytest

from packages.api.common import ApiContractError
from packages.api.sse import PostgresEventStream


class _Result:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def one_or_none(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows


class _Session:
    def __init__(self):
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params):
        self.calls.append((str(query), params))
        if "event_id =" in str(query):
            return _Result([{"event_id": "evt-2", "run_id": "run-1", "sequence_no": 2}])
        return _Result([
            {"event_id": "evt-3", "run_id": "run-1", "sequence_no": 3, "event_type": "RUN_PAUSED", "payload": {"version": 3}},
        ])


def test_postgres_event_stream_reads_strict_successors_and_maps_json_payload() -> None:
    session = _Session()
    events = PostgresEventStream(lambda: session).events_after("run-1", "evt-2")
    assert [(event.event_id, event.sequence_no, event.payload) for event in events] == [("evt-3", 3, {"version": 3})]
    assert session.calls[1][1] == {"run_id": "run-1", "minimum_sequence": 2}


@pytest.mark.parametrize("cursor", [None, ""])
def test_postgres_event_stream_starts_at_sequence_zero(cursor) -> None:
    session = _Session()
    PostgresEventStream(lambda: session).events_after("run-1", cursor)
    assert session.calls[0][1] == {"run_id": "run-1", "minimum_sequence": 0}


def test_postgres_event_stream_rejects_unknown_or_cross_run_cursor() -> None:
    class InvalidSession(_Session):
        def execute(self, query, params):
            self.calls.append((str(query), params))
            return _Result([])

    with pytest.raises(ApiContractError, match="invalid"):
        PostgresEventStream(lambda: InvalidSession()).events_after("run-1", "missing")
