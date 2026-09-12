from __future__ import annotations

import json
from dataclasses import replace
import threading

import pytest

from packages.api import DelegationLifecyclePort
from packages.api.common import ApiContractError, ApplicationRequest, SessionPrincipal
from packages.orchestration import DeveloperLifecycleService, LifecycleStatus
from tests.orchestration.test_developer_lifecycle_c04 import CapabilityRunner
from tests.orchestration.test_delegation_packet import (
    packet,
    packet_parent_egress,
    packet_parent_permission,
)


HASH = "sha256:" + "a" * 64


@pytest.mark.parametrize("operation", ["steer", "cancel", "resume"])
@pytest.mark.parametrize("missing", ["target", "version", "both"])
def test_r6_port_requires_target_and_version_for_every_mutation(operation, missing):
    service = _service()
    if operation == "resume":
        service.request_checkpoint("api-session", idempotency_key="r6-pause")
    bodies = {
        "steer": {"instruction": "inspect"}, "cancel": {"reason": "owner command"},
        "resume": {"packetHash": packet().packet_hash, "expectedResumeEpoch": 0},
    }
    before = service.current("api-session")
    request = _request(
        f"POST /api/delegations/{{id}}:{operation}", body=bodies[operation],
        expected_version=before.state_version, idempotency_key="r6-mutation",
    )
    request = replace(
        request,
        target_hash=None if missing in {"target", "both"} else request.target_hash,
        expected_version=None if missing in {"version", "both"} else request.expected_version,
    )
    with pytest.raises(ApiContractError) as error:
        DelegationLifecyclePort(service)(request)
    assert error.value.status_code == 400
    assert service.current("api-session") == before


def test_r6_get_does_not_require_mutation_preconditions():
    request = replace(
        _request("GET /api/delegations/{id}", idempotency_key=None),
        target_hash=None, expected_version=None,
    )
    assert DelegationLifecyclePort(_service())(request).status_code == 200


def _service() -> DeveloperLifecycleService:
    service = DeveloperLifecycleService()
    service.start(
        packet(),
        session_id="api-session",
        baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert service.wait("api-session").status.value == "RUNNING"
    return service


def _request(
    endpoint_key: str,
    *,
    body: dict[str, object] | None = None,
    idempotency_key: str | None = "api-command-1",
    expected_version: int | None = 2,
    target_hash: str | None = None,
    reason: str | None = "owner command",
) -> ApplicationRequest:
    headers = {} if idempotency_key is None else {"idempotency-key": idempotency_key}
    return ApplicationRequest(
        endpoint_key=endpoint_key,
        resource_id=packet().delegation_id,
        path_parameters={"id": packet().delegation_id},
        body={} if body is None else body,
        headers=headers,
        principal=SessionPrincipal(
            "owner-1",
            "owner",
            "csrf",
            frozenset({"delegation:read", "delegation:steer", "delegation:cancel", "delegation:resume"}),
            frozenset({"project-1"}),
            frozenset({"env-local"}),
        ),
        request_id="request-1",
        expected_version=expected_version,
        target_hash=packet().packet_hash if target_hash is None else target_hash,
        reason=reason,
        authorized_project_id="project-1",
        authorized_environment_id="env-local",
    )


def test_framework_neutral_port_projects_get_steer_resume_and_cancel():
    service = _service()
    port = DelegationLifecyclePort(service)

    read = port(_request("GET /api/delegations/{id}", idempotency_key=None))
    assert read.status_code == 200
    assert read.body["objective"]["status"] == "REFERENCE_ONLY"
    assert read.body["allowed_commands"] == ["STEER", "CHECKPOINT_PAUSE", "STOP"]
    assert read.body["handoff"] == {
        "session_id": "api-session",
        "delegation_id": packet().delegation_id,
        "status": "RUNNING",
        "checkpoint": None,
        "raw_result": None,
    }

    steered = port(_request(
        "POST /api/delegations/{id}:steer",
        body={"instruction": "run the focused test"},
        idempotency_key="api-steer-1",
    ))
    assert steered.status_code == 200
    assert steered.body["current_action"] == "STEER"

    service.request_checkpoint("api-session", idempotency_key="api-pause-1")
    resumed = port(_request(
        "POST /api/delegations/{id}:resume",
        body={"packetHash": packet().packet_hash, "expectedResumeEpoch": 0},
        idempotency_key="api-resume-1",
        expected_version=5,
    ))
    assert resumed.status_code == 200
    assert resumed.body["status"] == "RUNNING"
    assert resumed.body["resume_epoch"] == 1

    cancelled = port(_request(
        "POST /api/delegations/{id}:cancel",
        body={"reason": "owner requested stop"},
        idempotency_key="api-cancel-1",
        expected_version=6,
        reason="owner requested stop",
    ))
    assert cancelled.status_code == 202
    assert cancelled.body["status"] == "STOP_REQUESTED"
    json.dumps(cancelled.body, sort_keys=True, allow_nan=False)


def test_port_fails_closed_for_unknown_route_body_identity_and_idempotency():
    service = _service()
    port = DelegationLifecyclePort(service)

    with pytest.raises(ApiContractError) as error:
        port(_request("POST /api/delegations/{id}:steer", body={"instruction": "x"}, idempotency_key=None))
    assert (error.value.code, error.value.status_code) == ("IDEMPOTENCY_KEY_REQUIRED", 400)

    with pytest.raises(ApiContractError) as error:
        port(_request("POST /api/delegations/{id}:steer", body={"instruction": "x", "extra": True}))
    assert error.value.code == "INVALID_DELEGATION_COMMAND"

    wrong = _request("GET /api/delegations/{id}", idempotency_key=None)
    wrong = ApplicationRequest(
        wrong.endpoint_key,
        "other",
        {"id": "other"},
        wrong.body,
        wrong.headers,
        wrong.principal,
        wrong.request_id,
        wrong.expected_version,
        wrong.target_hash,
        wrong.reason,
        wrong.authorized_project_id,
        wrong.authorized_environment_id,
    )
    with pytest.raises(ApiContractError) as error:
        port(wrong)
    assert (error.value.code, error.value.status_code) == ("DELEGATION_NOT_FOUND", 404)

    with pytest.raises(ApiContractError) as error:
        port(_request("POST /api/delegations/{id}:takeover", body={}))
    assert error.value.code == "DELEGATION_ROUTE_INVALID"


def test_registry_has_exact_c04_routes_and_permissions_without_aliases():
    from packages.api.registry import canonical_api_registry

    routes = {
        endpoint.key: endpoint.permission
        for endpoint in canonical_api_registry().endpoints
        if endpoint.path.startswith("/api/delegations/")
    }
    assert routes == {
        "GET /api/delegations/{id}": "delegation:read",
        "POST /api/delegations/{id}:steer": "delegation:steer",
        "POST /api/delegations/{id}:cancel": "delegation:cancel",
        "POST /api/delegations/{id}:resume": "delegation:resume",
    }
    assert all("/steer" not in key and "/cancel" not in key and "/resume" not in key for key in routes)


def test_port_consumes_authority_version_target_and_reason_fail_closed():
    service = _service()
    port = DelegationLifecyclePort(service)
    base = _request(
        "POST /api/delegations/{id}:steer",
        body={"instruction": "x"},
        idempotency_key="strict-authority",
    )

    bad_principal = replace(base.principal, permissions=frozenset({"delegation:read"}))
    cases = (
        (replace(base, principal=bad_principal), "DELEGATION_PERMISSION_DENIED"),
        (replace(base, expected_version=3), "DELEGATION_VERSION_MISMATCH"),
        (replace(base, target_hash=HASH), "DELEGATION_TARGET_MISMATCH"),
        (replace(base, authorized_project_id="other-project"), "DELEGATION_SCOPE_DENIED"),
        (replace(base, authorized_environment_id="other-env"), "DELEGATION_SCOPE_DENIED"),
        (replace(base, reason=None), "DELEGATION_REASON_REQUIRED"),
    )
    for request, code in cases:
        with pytest.raises(ApiContractError) as error:
            port(request)
        assert error.value.code == code
    assert service.workbench("api-session").to_dict()["current_action"] is None


def test_cancel_reason_is_bound_to_same_key_fingerprint_and_runner_receipt():
    service = _service()
    port = DelegationLifecyclePort(service)
    first = _request(
        "POST /api/delegations/{id}:cancel",
        body={"reason": "first reason"},
        idempotency_key="cancel-reason-key",
        reason="first reason",
    )
    assert port(first).status_code == 202
    with pytest.raises(ApiContractError) as error:
        port(replace(first, body={"reason": "different reason"}, reason="different reason",
                     expected_version=3))
    assert error.value.code == "DELEGATION_COMMAND_CONFLICT"


def test_common_adapter_get_shape_does_not_require_mutation_preconditions():
    service = _service()
    request = replace(
        _request("GET /api/delegations/{id}", idempotency_key=None),
        target_hash=None,
        expected_version=None,
        reason=None,
    )
    response = DelegationLifecyclePort(service)(request)
    assert response.status_code == 200
    assert response.body["state_version"] == 2


def test_api_uses_monotonic_state_version_and_binds_audit_reason():
    service = _service()
    port = DelegationLifecyclePort(service)
    first = _request(
        "POST /api/delegations/{id}:steer",
        body={"instruction": "first"},
        idempotency_key="versioned-steer-1",
        expected_version=2,
        reason="audit first",
    )
    response = port(first)
    assert response.body["state_version"] == 3
    with pytest.raises(ApiContractError) as error:
        port(replace(first, body={"instruction": "second"},
                     headers={"idempotency-key": "versioned-steer-2"},
                     reason="audit second"))
    assert error.value.code == "DELEGATION_VERSION_MISMATCH"
    assert port(replace(
        first, body={"instruction": "second"},
        headers={"idempotency-key": "versioned-steer-2"},
        expected_version=3, reason="audit second",
    )).body["state_version"] == 4


def test_cancel_body_reason_and_audit_reason_are_independent_but_both_fingerprinted():
    service = _service()
    port = DelegationLifecyclePort(service)
    request = _request(
        "POST /api/delegations/{id}:cancel",
        body={"reason": "operator stop body"},
        idempotency_key="cancel-audit",
        reason="ticket audit reason",
    )
    assert port(request).status_code == 202
    with pytest.raises(ApiContractError) as error:
        port(replace(request, reason="different audit reason", expected_version=3))
    assert error.value.code == "DELEGATION_COMMAND_CONFLICT"


def test_api_version_check_and_command_reservation_are_atomic_across_operations():
    class BlockingSteerRunner(CapabilityRunner):
        def __init__(self):
            super().__init__()
            self.entered = threading.Event()
            self.release = threading.Event()

        def steer(self, session_id, instruction, idempotency_key):
            super().steer(session_id, instruction, idempotency_key)
            self.entered.set()
            assert self.release.wait(2)

    runner = BlockingSteerRunner()
    service = DeveloperLifecycleService(runner)
    service.start(
        packet(), session_id="api-session", baseline_hash=HASH,
        context_snapshot_hash=HASH,
        parent_permission_snapshot=packet_parent_permission(),
        parent_egress_profile=packet_parent_egress(),
    )
    assert service.wait("api-session").state_version == 2
    port = DelegationLifecyclePort(service)
    steer_request = _request(
        "POST /api/delegations/{id}:steer",
        body={"instruction": "atomic steer"}, idempotency_key="atomic-steer",
        expected_version=2, reason="audit atomic steer",
    )
    cancel_request = _request(
        "POST /api/delegations/{id}:cancel",
        body={"reason": "atomic cancel"}, idempotency_key="atomic-cancel",
        expected_version=2, reason="audit atomic cancel",
    )
    responses = []
    errors = []

    def invoke(name, request):
        try:
            responses.append((name, port(request).status_code))
        except ApiContractError as error:
            errors.append((name, error))

    owner = threading.Thread(target=invoke, args=("steer", steer_request))
    owner.start()
    assert runner.entered.wait(2)
    contender = threading.Thread(target=invoke, args=("cancel", cancel_request))
    contender.start()
    contender.join(2)
    runner.release.set()
    owner.join(2)

    assert not owner.is_alive() and not contender.is_alive()
    assert sorted(responses) == [("cancel", 202), ("steer", 200)]
    assert errors == []
    assert runner.stop_calls == [("api-session", "atomic-cancel", "atomic cancel")]
    final = service.session("api-session")
    assert final.status is LifecycleStatus.STOP_REQUESTED
    assert final.current_action == "STOP"


def test_delivered_api_replay_precedes_stale_version_and_target_checks():
    service = _service()
    port = DelegationLifecyclePort(service)
    request = _request(
        "POST /api/delegations/{id}:steer",
        body={"instruction": "stable replay"}, idempotency_key="replay-steer",
        expected_version=2, reason="audit replay",
    )
    first = port(request)
    replay = port(replace(request, expected_version=0, target_hash=HASH))
    assert replay == first

    with pytest.raises(ApiContractError) as conflict:
        port(replace(
            request, body={"instruction": "different"}, expected_version=0,
            target_hash=HASH,
        ))
    assert conflict.value.code == "DELEGATION_COMMAND_CONFLICT"


def test_cancel_and_resume_replay_precede_stale_version_and_target_checks():
    service = _service()
    port = DelegationLifecyclePort(service)
    cancel = _request(
        "POST /api/delegations/{id}:cancel",
        body={"reason": "operator cancel"}, idempotency_key="replay-cancel",
        expected_version=2, reason="audit cancel",
    )
    first_cancel = port(cancel)
    assert port(replace(cancel, expected_version=0, target_hash=HASH)) == first_cancel

    service = _service()
    checkpoint = service.request_checkpoint(
        "api-session", idempotency_key="api-replay-checkpoint",
    )
    port = DelegationLifecyclePort(service)
    resume = _request(
        "POST /api/delegations/{id}:resume",
        body={
            "packetHash": packet().packet_hash,
            "expectedResumeEpoch": checkpoint.resume_epoch,
        },
        idempotency_key="replay-resume",
        expected_version=checkpoint.state_version,
        reason="audit resume",
    )
    first_resume = port(resume)
    assert port(replace(resume, expected_version=0, target_hash=HASH)) == first_resume
