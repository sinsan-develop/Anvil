"""C-01 설계 선행 독립 수락 시나리오.

구현 열람 전 작성: 설계 47.15, 47.18-19, 49.6 / 계획 C-01 /
AV-AGT-002, AV-AGT-003, AV-OPS-011 / 테스트 계획 3.2-3.3.
아래 시나리오와 기대값을 먼저 고정하고 공개 API 연결부만 후속 작성한다.
실제 Provider, DB, runtime backend 연결을 증명하지 않는 fixture 검증이다.
"""

import json
import re

import pytest


LIFECYCLE = (
    "probe_capabilities", "start", "stream_events", "request_checkpoint",
    "steer", "stop", "collect_result",
)
OPAQUE_REFS = {
    "task_graph": {"reference": "graph:independent", "unrecognized": [17]},
    "permission": {"reference": "permission:read-only", "future": {"v": 4}},
    "evidence": ["artifact:prior-step", {"digest": "opaque-hash"}],
    "resume": {"checkpoint": "checkpoint:prior", "completed": ["step:done"]},
}


@pytest.mark.parametrize("backend", ["Claude", "Codex", "Local"])
def test_backend_exchange_retains_opaque_recovery_and_authority_references(subject, backend):
    """AV-AGT-002 / AV-OPS-011: backend를 바꿔도 참조 의미를 재작성하지 않는다."""
    result = subject.lifecycle_roundtrip(backend, OPAQUE_REFS)
    assert set(LIFECYCLE).issubset(result["public_protocol_methods"])
    assert result["protocol_conformance"] is True
    assert result["called_methods"] == list(LIFECYCLE)
    assert result["packet"] == OPAQUE_REFS
    assert result["result"] == OPAQUE_REFS
    assert result["checkpoint"]["resume"] == OPAQUE_REFS["resume"]
    assert result["events"][0]["evidence"] == OPAQUE_REFS["evidence"]


def test_model_call_observes_a_prior_reservation_and_emits_safe_ordered_receipts(subject):
    """AV-AGT-003: 예약 이후 호출, 실제 사용 정산 이후 증거가 반환되어야 한다."""
    result = subject.step("success")
    assert result["reservation_seen_during_call"] is True
    assert result["provider_calls"] == 1
    assert result["final_usage"] == {"input_tokens": 7, "output_tokens": 3}
    assert result["usage_provenance"] == "provider_reported"
    assert result["remaining_reservations"] == 0
    assert [event["type"] for event in result["events"]] == [
        "BUDGET_RESERVED", "USAGE_RECONCILED",
    ]
    assert re.fullmatch(r"request:[0-9a-f]{32}", result["request_id"])
    assert all(event["request_id"] == result["request_id"] for event in result["events"])
    assert all(isinstance(event["cost"], str) for event in result["events"])
    receipt_text = json.dumps(result["events"], sort_keys=True)
    for forbidden in ("INDEPENDENT_PROMPT_CANARY", "INDEPENDENT_SECRET_CANARY", "credential"):
        assert forbidden not in receipt_text


def test_a_denied_step_budget_never_reaches_the_provider(subject):
    """AV-AGT-003: 상한 초과 요청을 보내고 Provider 진입 0회를 확인한다."""
    result = subject.step("budget_denial")
    assert result["denied"] is True
    assert result["provider_calls"] == 0
    assert result["remaining_reservations"] == 0


def test_reexecuting_the_same_step_cannot_create_a_second_provider_side_effect(subject):
    """AV-AGT-003 / 설계 47.18.11: 같은 Step의 두 번째 요청은 예약 경계에서 거절된다."""
    result = subject.step("duplicate")
    assert result["first_provider_calls"] == 1
    assert result["second_provider_calls"] == 0
    assert result["second_denied"] is True
    assert result["remaining_reservations"] == 0


def test_explicitly_empty_capabilities_remain_empty_and_explain_unsupported_work(subject):
    """C-01 probe: 비어 있는 capability를 기본 지원 capability로 승격하지 않는다."""
    result = subject.capabilities()
    assert result["supported"] == []
    assert result["unsupported_reason"]
    assert result["repeated_probe"] == result["first_probe"]
    assert result["provider_calls"] == 0


def test_abort_does_not_erase_final_usage_or_its_provenance(subject):
    """설계 49.6: abort 결과에도 사용량·request ID와 순서 있는 정산 증거를 보존한다."""
    result = subject.step("abort")
    assert result["abort_signal_received"] is True
    assert result["aborted"] is True
    assert result["final_usage"] == {"input_tokens": 7, "output_tokens": 3}
    assert result["usage_provenance"] == "provider_reported"
    assert result["request_id"]
    assert [event["type"] for event in result["events"]] == [
        "BUDGET_RESERVED", "USAGE_RECONCILED",
    ]
    assert result["remaining_reservations"] == 0


def test_retry_after_and_unknown_usage_preserve_uncertainty_instead_of_fabricating_zero(subject):
    """설계 49.6: retry-after와 usage 출처를 전달하고 불명확한 비용은 미정산으로 남긴다."""
    result = subject.step("unknown_usage")
    assert result["retry_after_received"] == 23
    assert result["retry_after_returned"] == 23
    assert result["usage_provenance"] == "unknown"
    assert result["reconciliation_status"] == "USAGE_RECONCILIATION_REQUIRED"
    assert result["remaining_reservations"] == 1


# 공개 API 연결부: 위 독립 시나리오의 작성 완료 뒤에만 구현을 읽어 연결한다.

import asyncio
from copy import deepcopy
from dataclasses import asdict
from decimal import Decimal

from packages.budget.models import BudgetLimit
from packages.budget.service import BudgetService, UsageReconciliationRequired
from packages.llm_gateway import (
    DeterministicFakeAdapter, GatewayResponse, NativeAgentAdapter, TokenUsage,
    UsageProvenance,
)
from packages.orchestration import BudgetDenied, MainAgentKernel, NativeCodingAgentAdapter
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository


class _OpaqueBackend:
    """backend 실행이 아닌 public Protocol 교체 가능성만 시험하는 독립 fixture."""

    def __init__(self, backend):
        self.backend = backend
        self.calls = []

    async def probe_capabilities(self):
        self.calls.append("probe_capabilities")
        return {"backend": self.backend, "capabilities": ["read"]}

    async def start(self, packet):
        self.calls.append("start")
        self.packet = deepcopy(packet)
        return {"backend": self.backend, "packet": self.packet}

    async def stream_events(self, handle):
        self.calls.append("stream_events")
        yield {"evidence": deepcopy(handle["packet"]["evidence"])}

    async def request_checkpoint(self, handle):
        self.calls.append("request_checkpoint")
        return {"resume": deepcopy(handle["packet"]["resume"])}

    async def steer(self, handle, instruction):
        self.calls.append("steer")

    async def stop(self, handle, reason):
        self.calls.append("stop")
        return {"reason": reason}

    async def collect_result(self, handle):
        self.calls.append("collect_result")
        return deepcopy(handle["packet"])


class _ReceiptProvider:
    """네트워크 없이 제품 경계 진입 시점과 provider receipt를 관찰한다."""

    def __init__(self, budget, mode, abort_signal):
        self.budget = budget
        self.mode = mode
        self.abort_signal = abort_signal
        self.calls = 0
        self.reserved_before_call = False
        self.request = None
        self.response = None

    def probe(self, required=frozenset()):
        return DeterministicFakeAdapter().probe(required)

    def generate(self, request):
        self.calls += 1
        self.request = request
        reservation = self.budget.reservation("reservation:run:independent:step:one")
        snapshot = self.budget.snapshot("budget:independent")
        self.reserved_before_call = (
            reservation.request_id == request.request_id
            and reservation.status.value == "RESERVED"
            and snapshot.reserved_tokens == 20
            and snapshot.reserved_cost == Decimal("1.00")
            and snapshot.active_requests == 1
        )
        self.response = GatewayResponse(
            request_id=request.request_id,
            provider=request.provider,
            model=request.model,
            output_text="fixture observation",
            final_usage=TokenUsage() if self.mode == "unknown_usage" else TokenUsage(7, 3),
            usage_provenance=(
                UsageProvenance.UNKNOWN if self.mode == "unknown_usage"
                else UsageProvenance.PROVIDER_FINAL
            ),
            abort_status="ABORTED" if request.is_aborted() else "COMPLETED",
            retry_after=request.retry_after,
        )
        return self.response


class _PublicApiSubject:
    def lifecycle_roundtrip(self, backend, packet):
        async def exercise():
            adapter = _OpaqueBackend(backend)
            await adapter.probe_capabilities()
            handle = await adapter.start(packet)
            events = [event async for event in adapter.stream_events(handle)]
            checkpoint = await adapter.request_checkpoint(handle)
            await adapter.steer(handle, {"instruction": "read remaining work"})
            await adapter.stop(handle, "independent fixture completed")
            result = await adapter.collect_result(handle)
            return {
                "public_protocol_methods": [name for name in dir(NativeCodingAgentAdapter) if not name.startswith("_")],
                "protocol_conformance": isinstance(adapter, NativeCodingAgentAdapter),
                "called_methods": adapter.calls,
                "packet": adapter.packet,
                "result": result,
                "events": events,
                "checkpoint": checkpoint,
            }
        return asyncio.run(exercise())

    def capabilities(self):
        provider = DeterministicFakeAdapter(capabilities=set())
        adapter = NativeAgentAdapter(provider)
        first = adapter.probe({"text_generation"})
        repeated = adapter.probe({"text_generation"})
        return {
            "supported": sorted(first.capabilities),
            "unsupported_reason": first.unsupported_reasons,
            "first_probe": first,
            "repeated_probe": repeated,
            "provider_calls": provider.calls,
        }

    def step(self, mode):
        budget = BudgetService(InMemoryInterventionBudgetRepository())
        budget.create_budget(BudgetLimit("budget:independent", Decimal("4.00"), 100, 1))
        abort_signal = (lambda: True) if mode == "abort" else None
        provider = _ReceiptProvider(budget, mode, abort_signal)
        kernel = MainAgentKernel(NativeAgentAdapter(provider), budget)
        arguments = {
            "run_id": "run:independent", "step_id": "step:one",
            "budget_id": "budget:independent", "provider": "LOCAL", "model": "fixture",
            "input_text": "INDEPENDENT_PROMPT_CANARY credential=INDEPENDENT_SECRET_CANARY",
            "forecast_tokens": 101 if mode == "budget_denial" else 20,
            "forecast_cost": Decimal("1.00"),
            "abort_signal": abort_signal,
            "retry_after": "23" if mode == "unknown_usage" else None,
        }
        output = {"denied": False, "reconciliation_status": None}
        result = None
        try:
            result = kernel.run_step(**arguments)
        except BudgetDenied as error:
            output["denied"] = error.code == "BUDGET_RESERVATION_FAILED"
        except UsageReconciliationRequired as error:
            output["reconciliation_status"] = error.code
        if mode == "duplicate":
            output["first_provider_calls"] = provider.calls
            output["second_denied"] = False
            try:
                kernel.run_step(**arguments)
            except BudgetDenied as error:
                output["second_denied"] = (
                    error.code == "BUDGET_RESERVATION_FAILED"
                    and "bound to another request" in str(error)
                )
            output["second_provider_calls"] = provider.calls - output["first_provider_calls"]
        response = result.response if result else provider.response
        events = [event.to_dict() for event in result.evidence] if result else []
        # 정규화는 API 필드명·enum 표시만 변환하며 결과나 기대값을 생성하지 않는다.
        for event in events:
            event["type"] = event.pop("event_type")
        output.update({
            "provider_calls": provider.calls,
            "reservation_seen_during_call": provider.reserved_before_call,
            "remaining_reservations": budget.snapshot("budget:independent").active_requests,
            "events": events,
        })
        if response is not None:
            output.update({
                "final_usage": asdict(response.final_usage),
                "usage_provenance": {
                    "PROVIDER_FINAL": "provider_reported", "UNKNOWN": "unknown",
                    "ABORT_CONFIRMED": "abort_confirmed",
                }[response.usage_provenance.value],
                "request_id": response.request_id,
                "aborted": response.abort_status == "ABORTED",
                "abort_signal_received": provider.request.abort_signal is abort_signal and abort_signal is not None,
                "retry_after_received": int(provider.request.retry_after) if provider.request.retry_after else None,
                "retry_after_returned": int(response.retry_after) if response.retry_after else None,
            })
        if output["reconciliation_status"] is None and result is not None:
            output["reconciliation_status"] = result.evidence[-1].status
        return output


@pytest.fixture
def subject():
    return _PublicApiSubject()
