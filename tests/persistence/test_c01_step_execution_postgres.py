"""실제 PostgreSQL에서만 검증하는 실행 트랜잭션 불변식."""
from concurrent.futures import ThreadPoolExecutor
import runpy
from pathlib import Path
from threading import Event, Lock
from uuid import uuid4

from sqlalchemy import create_engine, text
import pytest


# 독립 수용 테스트의 격리 DB/승인된 Run 생성 fixture를 재사용한다.
contract = runpy.run_path(str(Path(__file__).parents[1] / "verification/test_c01_l3_independent_acceptance.py"))


def test_reservation_and_event_are_committed_before_provider_call():
    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        path, body, headers = contract["_request"](authority, uuid4().hex)

        class InspectingProvider(contract["DeterministicProvider"]):
            def generate(self, request):
                engine = create_engine(dsn)
                try:
                    with engine.connect() as session:
                        status = session.execute(text("SELECT status FROM budget_reservations WHERE reservation_id=:id"), {"id": body["reservationId"]}).scalar_one()
                        count = session.execute(text("SELECT count(*) FROM run_events WHERE run_id=:run AND event_type='BUDGET_RESERVED'"), {"run": authority.run_id}).scalar_one()
                    assert status == "RESERVED" and count == 1
                finally:
                    engine.dispose()
                return super().generate(request)

        with contract["_client"](dsn, InspectingProvider()) as client:
            result = client.post(path, json=body, headers=headers)
        assert result.status_code == 200, result.text


def test_unknown_receipt_is_null_and_replay_does_not_reexecute():
    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        provider = contract["DeterministicProvider"](known_usage=False)
        path, body, headers = contract["_request"](authority, uuid4().hex)
        with contract["_client"](dsn, provider) as client:
            first = client.post(path, json=body, headers=headers)
            second = client.post(path, json=body, headers=headers)
        assert first.status_code == second.status_code == 409
        assert first.json() == second.json() and len(provider.calls) == 1
        engine = create_engine(dsn)
        try:
            with engine.connect() as session:
                receipt = session.execute(text("SELECT actual_cost,actual_tokens,is_authoritative_final FROM budget_usage_receipts WHERE reservation_id=:id"), {"id": body["reservationId"]}).mappings().one()
            assert receipt == {"actual_cost": None, "actual_tokens": None, "is_authoritative_final": False}
        finally:
            engine.dispose()


@pytest.mark.parametrize("failed_event", ["BUDGET_RESERVED", "USAGE_RECONCILED"])
def test_event_write_failure_rolls_back_its_budget_transaction(monkeypatch, failed_event):
    from packages.persistence.event_repository import SqlAlchemyEventWriter
    original = SqlAlchemyEventWriter.append

    def fail_selected(self, **arguments):
        if arguments["event_type"] == failed_event:
            raise RuntimeError("injected event write failure")
        return original(self, **arguments)

    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        provider = contract["DeterministicProvider"]()
        path, body, headers = contract["_request"](authority, uuid4().hex)
        monkeypatch.setattr(SqlAlchemyEventWriter, "append", fail_selected)
        with contract["_client"](dsn, provider) as client:
            failed = client.post(path, json=body, headers=headers)
            assert failed.status_code == 500
            monkeypatch.setattr(SqlAlchemyEventWriter, "append", original)
            if failed_event == "USAGE_RECONCILED":
                replay = client.post(path, json=body, headers=headers)
                assert replay.status_code == 409 and len(provider.calls) == 1
        engine = create_engine(dsn)
        try:
            with engine.connect() as session:
                reservation = session.execute(text("SELECT status FROM budget_reservations WHERE reservation_id=:id"), {"id": body["reservationId"]}).scalar_one_or_none()
                usage_count = session.execute(text("SELECT count(*) FROM budget_usage_receipts WHERE reservation_id=:id"), {"id": body["reservationId"]}).scalar_one()
            assert usage_count == 0
            if failed_event == "BUDGET_RESERVED":
                assert reservation is None and len(provider.calls) == 0
            else:
                assert reservation == "RESERVED" and len(provider.calls) == 1
        finally:
            engine.dispose()


def test_run_scope_is_checked_against_database_before_execution():
    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        provider = contract["DeterministicProvider"]()
        path, body, headers = contract["_request"](authority, uuid4().hex)
        engine = create_engine(dsn)
        try:
            with engine.begin() as session:
                session.execute(text("UPDATE runs SET environment_id='another-environment' WHERE run_id=:run"), {"run": authority.run_id})
            before = contract["_events"](dsn, authority.run_id)
            with contract["_client"](dsn, provider) as client:
                response = client.post(path, json=body, headers=headers)
            assert response.status_code == 403 and provider.calls == []
            assert contract["_events"](dsn, authority.run_id) == before
        finally:
            engine.dispose()


@pytest.mark.parametrize("known_usage", [True, False])
def test_terminal_reservation_cannot_reexecute_under_a_new_http_key(known_usage):
    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        provider = contract["DeterministicProvider"](known_usage=known_usage)
        path, body, headers = contract["_request"](authority, uuid4().hex)
        with contract["_client"](dsn, provider) as client:
            first = client.post(path, json=body, headers=headers)
            engine = create_engine(dsn)
            try:
                with engine.connect() as session:
                    current_version = session.execute(
                        text("SELECT version FROM runs WHERE run_id=:run"), {"run": authority.run_id}
                    ).scalar_one()
                    before_counts = session.execute(text(
                        "SELECT (SELECT count(*) FROM budget_reservations WHERE reservation_id=:reservation),"
                        "(SELECT count(*) FROM budget_usage_receipts WHERE reservation_id=:reservation),"
                        "(SELECT count(*) FROM run_events WHERE run_id=:run)"
                    ), {"reservation": body["reservationId"], "run": authority.run_id}).one()
            finally:
                engine.dispose()
            retry_body = {**body, "expectedStateVersion": current_version}
            retry_headers = {**headers, "idempotency-key": f"new-{uuid4().hex}",
                             "if-match": f'"{current_version}"'}
            retry = client.post(path, json=retry_body, headers=retry_headers)
        assert first.status_code == (200 if known_usage else 409)
        assert retry.status_code == 409 and retry.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert len(provider.calls) == 1
        engine = create_engine(dsn)
        try:
            with engine.connect() as session:
                after_counts = session.execute(text(
                    "SELECT (SELECT count(*) FROM budget_reservations WHERE reservation_id=:reservation),"
                    "(SELECT count(*) FROM budget_usage_receipts WHERE reservation_id=:reservation),"
                    "(SELECT count(*) FROM run_events WHERE run_id=:run)"
                ), {"reservation": body["reservationId"], "run": authority.run_id}).one()
            assert after_counts == before_counts
        finally:
            engine.dispose()


def test_concurrent_different_key_for_reserved_identity_invokes_adapter_at_most_once():
    with contract["_scratch_database"]() as dsn:
        authority = contract["_seed_authority"](dsn)
        entered, release, lock = Event(), Event(), Lock()

        class BlockingProvider(contract["DeterministicProvider"]):
            def __init__(self):
                super().__init__()
                self.attempts = 0

            def generate(self, request):
                with lock:
                    self.attempts += 1
                    attempt = self.attempts
                if attempt == 1:
                    entered.set()
                    assert release.wait(10), "first adapter call was not released"
                return super().generate(request)

        provider = BlockingProvider()
        path, body, headers = contract["_request"](authority, uuid4().hex)
        with contract["_client"](dsn, provider) as first_client, contract["_client"](dsn, provider) as second_client:
            with ThreadPoolExecutor(max_workers=1) as executor:
                pending = executor.submit(first_client.post, path, json=body, headers=headers)
                assert entered.wait(10), "first request did not reach the adapter"
                engine = create_engine(dsn)
                try:
                    with engine.connect() as session:
                        current_version = session.execute(
                            text("SELECT version FROM runs WHERE run_id=:run"), {"run": authority.run_id}
                        ).scalar_one()
                finally:
                    engine.dispose()
                retry_body = {**body, "expectedStateVersion": current_version}
                retry_headers = {**headers, "idempotency-key": f"concurrent-{uuid4().hex}",
                                 "if-match": f'"{current_version}"'}
                try:
                    retry = second_client.post(path, json=retry_body, headers=retry_headers)
                finally:
                    release.set()
                first = pending.result(timeout=10)
        assert first.status_code == 200
        assert retry.status_code == 409 and retry.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert provider.attempts == len(provider.calls) == 1
