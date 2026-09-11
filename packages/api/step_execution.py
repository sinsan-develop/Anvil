"""승인된 Step 실행의 PostgreSQL 트랜잭션 경계.

예약/첫 이벤트를 먼저 commit하고 adapter를 호출한다. 중단된 호출을 자동으로
재실행하지 않으며, 재전송은 영속 이벤트의 요청 hash와 결과를 사용한다.
"""
from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json

from sqlalchemy import text

from packages.budget.models import BudgetRequest, UsageReceipt
from packages.llm_gateway import GatewayRequest, GatewayResponse, NativeAgentAdapter, TokenUsage, UsageProvenance
from packages.persistence.event_repository import SqlAlchemyEventWriter
from packages.persistence.intervention_budget_repository import (
    AtomicReservationRejected, ReconciliationConflict, SqlAlchemyInterventionBudgetRepository,
)

from .common import ApiContractError, ApplicationRequest, ApplicationResponse


EXECUTE_KEY = "POST /api/runs/{id}/steps/{stepId}:execute"
BACKENDS = ("CLAUDE", "CODEX", "LOCAL")
REQUEST_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["requestId", "reservationId", "budgetId", "backend", "provider", "model", "pricingVersion", "forecastCost", "forecastTokens", "prompt", "expectedStateVersion", "reason"],
    "properties": {
        "requestId": {"type": "string"}, "reservationId": {"type": "string"},
        "budgetId": {"type": "string"}, "backend": {"type": "string", "enum": list(BACKENDS)},
        "provider": {"type": "string"}, "model": {"type": "string"},
        "pricingVersion": {"type": "string"}, "forecastCost": {"type": "string"},
        "forecastTokens": {"type": "integer", "minimum": 0}, "prompt": {"type": "string"},
        "expectedStateVersion": {"type": "integer", "minimum": 0}, "reason": {"type": "string"},
    },
}
EVENT_RECEIPT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["eventId", "type", "sequence", "timestamp", "actor", "correlationId", "causationId", "idempotencyKey"],
    "properties": {
        "eventId": {"type": "string"}, "type": {"type": "string"},
        "sequence": {"type": "integer", "minimum": 1}, "timestamp": {"type": "string", "format": "date-time"},
        "actor": {"type": "object", "additionalProperties": False, "required": ["type", "id"],
                  "properties": {"type": {"type": "string"}, "id": {"type": "string"}}},
        "correlationId": {"type": "string"}, "causationId": {"type": ["string", "null"]},
        "idempotencyKey": {"type": "string"},
    },
}
SUCCESS_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["runId", "stepId", "requestId", "reservationId", "backend", "result", "finalUsage", "provenance", "eventReceipts"],
    "properties": {
        "runId": {"type": "string"}, "stepId": {"type": "string"}, "requestId": {"type": "string"},
        "reservationId": {"type": "string"}, "backend": {"type": "string", "enum": list(BACKENDS)},
        "result": {"type": "object"},
        "finalUsage": {"type": "object", "additionalProperties": False, "required": ["inputTokens", "outputTokens", "totalTokens"],
                       "properties": {"inputTokens": {"type": "integer", "minimum": 0}, "outputTokens": {"type": "integer", "minimum": 0}, "totalTokens": {"type": "integer", "minimum": 0}}},
        "provenance": {"type": "string"}, "eventReceipts": {"type": "array", "minItems": 1, "items": EVENT_RECEIPT_SCHEMA},
    },
}
CONFLICT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["code", "requestId", "reservationId", "eventReceipts"],
    "properties": {
        "code": {"type": "string"}, "requestId": {"type": "string"}, "reservationId": {"type": "string"},
        "eventReceipts": {"type": "array", "items": EVENT_RECEIPT_SCHEMA},
    },
}


def execute_openapi() -> dict:
    return {"openapi_extra": {
        "x-anvil-permission": "run:execute",
        "requestBody": {"required": True, "content": {"application/json": {"schema": REQUEST_SCHEMA}}},
        "responses": {
            "200": {"description": "Step executed.", "content": {"application/json": {"schema": SUCCESS_SCHEMA}}},
            "409": {"description": "Execution conflict or usage reconciliation required.", "content": {"application/json": {"schema": CONFLICT_SCHEMA}}},
        },
    }}


def _hash(value) -> str:
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


class SqlAlchemyStepExecutionPort:
    def __init__(self, session_factory, adapters):
        if not callable(session_factory):
            raise ValueError("a database session factory is required")
        if (not isinstance(adapters, Mapping) or not adapters
                or any(key not in BACKENDS or not isinstance(value, NativeAgentAdapter)
                       for key, value in adapters.items())):
            raise ValueError("configured NativeAgentAdapter backends are required")
        self._sessions = session_factory
        self._adapters = dict(adapters)

    def _validate(self, request: ApplicationRequest) -> BudgetRequest:
        body = request.body
        invalid = ApiContractError("INVALID_STEP_EXECUTION", "The step execution request is invalid.")
        if set(body) != set(REQUEST_SCHEMA["required"]):
            raise invalid
        for name in set(body) - {"forecastTokens", "expectedStateVersion"}:
            value = body[name]
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise invalid
        for name in ("forecastTokens", "expectedStateVersion"):
            if type(body[name]) is not int or body[name] < 0 or body[name] > 2**63 - 1:
                raise invalid
        if body["backend"] not in BACKENDS or body["expectedStateVersion"] != request.expected_version:
            raise invalid
        for name, size in (("requestId", 128), ("reservationId", 128), ("budgetId", 128),
                           ("provider", 32), ("model", 256), ("pricingVersion", 128)):
            if len(body[name]) > size:
                raise invalid
        if not request.headers.get("idempotency-key") or not request.path_parameters.get("stepId"):
            raise invalid
        try:
            cost = Decimal(body["forecastCost"])
            if not cost.is_finite() or cost < 0 or cost >= Decimal("1000000000000") or cost != cost.quantize(Decimal("0.00000001")):
                raise invalid
        except InvalidOperation:
            raise invalid from None
        if body["backend"] not in self._adapters:
            raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "The execution backend is not configured.", 501)
        return BudgetRequest(body["reservationId"], body["budgetId"], request.resource_id,
            request.path_parameters["stepId"], body["requestId"], body["provider"], body["model"],
            body["pricingVersion"], cost, body["forecastTokens"])

    @staticmethod
    def _conflict(code, body, rows):
        return ApplicationResponse({"code": code, "requestId": body["requestId"],
            "reservationId": body["reservationId"],
            "eventReceipts": [SqlAlchemyEventWriter.receipt(row) for row in rows]}, 409)

    @staticmethod
    def _authority(session, request, budget_request):
        row = session.execute(text(
            "SELECT r.version,r.status,r.environment_id,t.project_id FROM runs r "
            "JOIN tasks t ON t.task_id=r.task_id WHERE r.run_id=:run FOR UPDATE OF r"
        ), {"run": budget_request.run_id}).mappings().one_or_none()
        if row is None:
            raise ApiContractError("RUN_NOT_FOUND", "The run does not exist.", 404)
        if (row["project_id"] != request.authorized_project_id
                or row["environment_id"] != request.authorized_environment_id):
            raise ApiContractError("PERMISSION_DENIED", "The run scope is not authorized.", 403)
        step = session.execute(text(
            "SELECT 1 FROM plan_steps WHERE step_id=:step AND run_id=:run"
        ), {"step": budget_request.step_id, "run": budget_request.run_id}).scalar_one_or_none()
        if step is None:
            raise ApiContractError("STEP_NOT_FOUND", "The step does not belong to this run.", 404)
        return row

    def __call__(self, request: ApplicationRequest) -> ApplicationResponse:
        budget_request = self._validate(request)
        body = request.body
        key = "step-execute:" + _hash(request.headers["idempotency-key"])
        fingerprint = _hash({"body": dict(body), "path": dict(request.path_parameters),
            "actor": request.principal.actor_id, "project": request.authorized_project_id,
            "environment": request.authorized_environment_id, "target": request.target_hash})
        common = {"run_id": budget_request.run_id, "actor_id": request.principal.actor_id,
                  "correlation_id": body["requestId"]}
        metadata = {"requestHash": fingerprint, "requestId": body["requestId"],
                    "reservationId": body["reservationId"], "stepId": budget_request.step_id,
                    "backend": body["backend"]}

        # Transaction A: 요청 잠금 → 예산 예약 → 이벤트, 모두 같은 commit.
        with self._sessions() as session:
            with session.begin():
                run = self._authority(session, request, budget_request)
                events = SqlAlchemyEventWriter(session)
                first = events.by_key(budget_request.run_id, key + ":reserved")
                final = events.by_key(budget_request.run_id, key + ":final")
                if first is not None or final is not None:
                    rows = [row for row in (first, final) if row is not None]
                    if rows[0]["payload"]["requestHash"] != fingerprint:
                        return self._conflict("IDEMPOTENCY_CONFLICT", body, rows)
                    if final is not None:
                        saved = dict(final["payload"]["response"])
                        saved["eventReceipts"] = [events.receipt(row) for row in rows]
                        return ApplicationResponse(saved, final["payload"]["statusCode"])
                    return self._conflict("USAGE_RECONCILIATION_REQUIRED", body, rows)
                budget = SqlAlchemyInterventionBudgetRepository(session)
                # A different HTTP key cannot acquire execution ownership from an
                # existing reservation/request, regardless of reservation status.
                if budget.lock_execution_identity(budget_request):
                    return self._conflict("IDEMPOTENCY_CONFLICT", body, [])
                if run["version"] != request.expected_version:
                    return self._conflict("OPTIMISTIC_VERSION_CONFLICT", body, [])
                if run["status"] != "ACTIVE":
                    return self._conflict("RUN_NOT_EXECUTABLE", body, [])
                try:
                    budget.reserve(budget_request)
                except AtomicReservationRejected:
                    denial = self._conflict("BUDGET_RESERVATION_FAILED", body, [])
                    final = events.append(**common, event_type="BUDGET_RESERVATION_FAILED",
                        causation_id=None, key=key + ":final", expected_version=run["version"],
                        payload={**metadata, "response": dict(denial.body), "statusCode": 409})
                    return self._conflict("BUDGET_RESERVATION_FAILED", body, [final])
                first = events.append(**common, event_type="BUDGET_RESERVED", causation_id=None,
                    key=key + ":reserved", expected_version=run["version"], payload=metadata)

        # 네트워크/credential 구성은 이 포트가 생성하지 않는다. 주입된 adapter만 호출한다.
        try:
            response = self._adapters[body["backend"]].generate(GatewayRequest(
                body["provider"], body["model"], body["prompt"], body["requestId"]))
            if (not isinstance(response, GatewayResponse) or response.request_id != body["requestId"]
                    or response.provider != body["provider"] or response.model != body["model"]):
                raise ValueError("adapter response identity mismatch")
        except Exception:
            # 외부 실행 여부가 불명확하면 예약을 유지한다. 예외 문자열은 영속화하지 않는다.
            response = GatewayResponse(body["requestId"], body["provider"], body["model"],
                "unavailable", TokenUsage(0, 0), UsageProvenance.UNKNOWN, "UNKNOWN")

        usage = response.final_usage
        known = response.usage_provenance is not UsageProvenance.UNKNOWN
        receipt = UsageReceipt("usage:" + _hash([budget_request.run_id, key]), body["reservationId"],
            body["requestId"], response.abort_status if response.abort_status in {"COMPLETED", "ABORTED"} else "UNKNOWN",
            Decimal(usage.total_tokens) / Decimal(100) if known else None,
            usage.total_tokens if known else None, None, None, response.usage_provenance.value)

        # Transaction B: 확정 사용량/NULL 영수증과 최종 이벤트를 원자적으로 commit.
        with self._sessions() as session:
            with session.begin():
                version = session.execute(text("SELECT version FROM runs WHERE run_id=:run FOR UPDATE"),
                                          {"run": budget_request.run_id}).scalar_one()
                budget = SqlAlchemyInterventionBudgetRepository(session)
                try:
                    budget.reconcile(receipt)
                except ReconciliationConflict:
                    budget.require_reconciliation(receipt)
                    result = self._conflict("USAGE_RECONCILIATION_REQUIRED", body, [])
                    event_type = "USAGE_RECONCILIATION_REQUIRED"
                else:
                    output = response.output_text
                    for sensitive in (body["prompt"], request.headers.get("x-credential-reference")):
                        if sensitive:
                            output = output.replace(sensitive, "[REDACTED]")
                    result = ApplicationResponse({
                        "runId": budget_request.run_id, "stepId": budget_request.step_id,
                        "requestId": body["requestId"], "reservationId": body["reservationId"],
                        "backend": body["backend"], "result": {"outputText": output, "status": receipt.abort_status},
                        "finalUsage": {"inputTokens": usage.input_tokens, "outputTokens": usage.output_tokens,
                                       "totalTokens": usage.total_tokens},
                        "provenance": response.usage_provenance.value,
                    }, 200)
                    event_type = "USAGE_RECONCILED"
                events = SqlAlchemyEventWriter(session)
                final = events.append(**common, event_type=event_type, causation_id=first["event_id"],
                    key=key + ":final", expected_version=version,
                    payload={**metadata, "statusCode": result.status_code, "response": dict(result.body)})
                payload = dict(result.body)
                payload["eventReceipts"] = [events.receipt(first), events.receipt(final)]
        return ApplicationResponse(payload, result.status_code)
