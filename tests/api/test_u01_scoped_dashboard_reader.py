"""Task2 scoped Dashboard reader contract over a complete Operations audit."""

from datetime import datetime, timedelta, timezone

import pytest

from packages.api.scoped_dashboard import DashboardSourceUnavailable, read_scoped_dashboard


def _detected(alert_id, at, *, level="critical"):
    critical = level == "critical"
    code = "WORKER_LEASE_EXPIRED" if critical else "BUDGET_RECONCILIATION_REQUIRED"
    source = "worker" if critical else "provider"
    category = "availability" if critical else "cost"
    cause = "Worker lease expiry observed" if critical else "Usage is not finalized"
    impact = "Run ownership cannot be trusted" if critical else "Budget exposure remains reserved"
    action = "REVIEW_WORKER_TAKEOVER" if critical else "RECONCILE_USAGE"
    deep_link = "/operations/workers" if critical else "/operations/cost"
    evidence = "sha256:" + "a" * 64
    return {"action": "DETECTED", "alert_id": alert_id, "actor_id": "system:detector",
            "at": at, "approval_id": None, "evidence_hash": evidence,
            "alert": {"alert_id": alert_id, "level": level, "source": source,
                      "category": category, "code": code, "related_entity_id": "entity-1",
                      "dedupe_key": f"f13-r2:project-a:test:{code}:entity-1",
                      "detector_rule_revision": "f13-r2", "cause": cause, "impact": impact,
                      "next_action": action, "deep_link": deep_link,
                      "evidence_hash": evidence, "status": "open", "owner_id": None,
                      "project_id": "project-a", "environment_id": "test", "observed_at": at}}


def _transition(action, alert_id, at):
    return {"action": action, "alert_id": alert_id, "actor_id": "operator",
            "at": at, "approval_id": "approval-1", "evidence_hash": "sha256:" + "a" * 64}


class AuditOwner:
    def __init__(self, events=()):
        self.events = events
        self.calls = []

    def load_complete(self, project_id, environment_id):
        self.calls.append((project_id, environment_id))
        return self.events


@pytest.mark.parametrize(("period_key", "observed_at", "start", "end"), [
    ("1d", "2024-03-01T00:00:00+00:00", "2024-02-29T15:00:00+00:00", "2024-03-01T15:00:00+00:00"),
    ("7d", "2024-03-01T00:00:00+00:00", "2024-02-23T15:00:00+00:00", "2024-03-01T15:00:00+00:00"),
    ("30d", "2024-03-01T00:00:00+00:00", "2024-01-31T15:00:00+00:00", "2024-03-01T15:00:00+00:00"),
])
def test_seoul_calendar_days_include_today_across_leap_day(period_key, observed_at, start, end):
    owner = AuditOwner()
    result = read_scoped_dashboard("project-a", "test", period_key,
                                   datetime.fromisoformat(observed_at), owner)
    assert result["period"] == {"key": period_key, "timeZone": "Asia/Seoul",
        "startUtc": start, "endUtc": end, "observedAt": observed_at}
    assert owner.calls == [("project-a", "test")]


def test_current_unresolved_critical_is_not_hidden_by_period_and_occurrence_is_bounded():
    owner = AuditOwner((
        (1, _detected("old", "2024-02-28T14:00:00+00:00")),
        (2, _detected("today", "2024-02-29T16:00:00+00:00")),
        (3, _detected("future", "2024-03-01T01:00:00+00:00")),
    ))
    result = read_scoped_dashboard("project-a", "test", "1d",
                                   datetime(2024, 3, 1, tzinfo=timezone.utc), owner)
    assert {row["alertId"] for row in result["current"]["unresolvedCritical"]} == {"old", "today"}
    assert result["occurrences"]["criticalDetected"]["count"] == 1
    assert result["occurrences"]["criticalDetected"]["status"] == "AVAILABLE"
    assert result["occurrences"]["runStarted"]["count"] is None
    assert result["sourceCompleteness"]["current"]["unresolvedCritical"]["complete"] is True
    assert result["sourceCompleteness"]["current"]["health"]["complete"] is False


@pytest.mark.parametrize("events", [
    ((1, _detected("a", "2024-02-29T16:00:00+00:00")),
     (3, _detected("b", "2024-02-29T17:00:00+00:00"))),
    ((1, _detected("a", "2024-02-29T16:00:00+00:00")),
     (2, _detected("a", "2024-02-29T17:00:00+00:00"))),
])
def test_gap_fails_closed_and_duplicate_alert_counts_once(events):
    owner = AuditOwner(events)
    observed = datetime(2024, 3, 1, tzinfo=timezone.utc)
    if events[1][0] == 3:
        with pytest.raises(DashboardSourceUnavailable):
            read_scoped_dashboard("project-a", "test", "1d", observed, owner)
    else:
        result = read_scoped_dashboard("project-a", "test", "1d", observed, owner)
        assert result["occurrences"]["criticalDetected"]["count"] == 1


def test_naive_clock_and_invalid_period_are_rejected_before_source_read():
    owner = AuditOwner()
    with pytest.raises(ValueError):
        read_scoped_dashboard("project-a", "test", "2d", datetime.now(timezone.utc), owner)
    with pytest.raises(ValueError):
        read_scoped_dashboard("project-a", "test", "1d", datetime(2024, 3, 1), owner)
    assert owner.calls == []


def test_more_than_one_alert_page_remains_complete_and_current_is_separate():
    events = tuple((index, _detected(f"alert-{index}", "2024-02-29T16:00:00+00:00"))
                   for index in range(1, 122))
    owner = AuditOwner(events)
    result = read_scoped_dashboard("project-a", "test", "1d",
                                   datetime(2024, 3, 1, tzinfo=timezone.utc), owner)
    assert result["occurrences"]["criticalDetected"]["count"] == 121
    assert len(result["current"]["unresolvedCritical"]) == 121


def test_resolved_alert_leaves_current_but_detected_occurrence_remains():
    owner = AuditOwner(((1, _detected("alert-1", "2024-02-29T16:00:00+00:00")),
                        (2, _transition("ACKNOWLEDGED", "alert-1", "2024-02-29T17:00:00+00:00")),
                        (3, _transition("RESOLVED", "alert-1", "2024-02-29T18:00:00+00:00"))))
    result = read_scoped_dashboard("project-a", "test", "1d",
                                   datetime(2024, 3, 1, tzinfo=timezone.utc), owner)
    assert result["current"]["unresolvedCritical"] == []
    assert result["current"]["nextActions"] == []
    assert result["occurrences"]["criticalDetected"]["count"] == 1


def test_partial_queue_source_cannot_claim_zero():
    from types import SimpleNamespace

    result = read_scoped_dashboard("project-a", "test", "1d",
        datetime(2024, 3, 1, tzinfo=timezone.utc), AuditOwner(),
        {"queue": SimpleNamespace(job_ids=(),
            observed_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
            legacy_unscoped_present=True, get=lambda _id: None)})
    assert result["current"]["queue"]["status"] == "UNAVAILABLE"
    assert result["current"]["queue"]["count"] is None
    assert result["sourceCompleteness"]["current"]["queue"]["complete"] is False


def test_cross_pair_and_unknown_transition_fail_closed():
    observed = datetime(2024, 3, 1, tzinfo=timezone.utc)
    bad_pair = _detected("alert-1", "2024-02-29T16:00:00+00:00")
    bad_pair["alert"]["project_id"] = "other-project"
    for events in (((1, bad_pair),),
                   ((1, _transition("RESOLVED", "unknown", "2024-02-29T16:00:00+00:00")),)):
        with pytest.raises(DashboardSourceUnavailable):
            read_scoped_dashboard("project-a", "test", "1d", observed, AuditOwner(events))


def test_malformed_resolve_and_direct_resolve_cannot_hide_current_critical():
    detected = _detected("alert-1", "2024-02-29T16:00:00+00:00")
    malformed = {"action": "RESOLVED", "alert_id": "alert-1",
                 "at": "2024-02-29T17:00:00+00:00"}
    direct = _transition("RESOLVED", "alert-1", "2024-02-29T17:00:00+00:00")
    for transition in (malformed, direct):
        with pytest.raises(DashboardSourceUnavailable):
            read_scoped_dashboard("project-a", "test", "1d",
                datetime(2024, 3, 1, tzinfo=timezone.utc),
                AuditOwner(((1, detected), (2, transition))))


def test_warning_next_action_remains_current_outside_period_without_critical():
    result = read_scoped_dashboard("project-a", "test", "1d",
        datetime(2024, 3, 1, tzinfo=timezone.utc),
        AuditOwner(((1, _detected("warning-1", "2024-02-27T16:00:00+00:00",
                                   level="warning")),)))
    assert result["current"]["unresolvedCritical"] == []
    assert result["current"]["nextActions"] == [
        {"alertId": "warning-1", "action": "RECONCILE_USAGE"}]
    assert result["sourceCompleteness"]["current"]["nextActions"]["complete"] is True


def test_utc_aware_observation_is_required():
    with pytest.raises(ValueError):
        read_scoped_dashboard("project-a", "test", "1d",
            datetime(2024, 3, 1, tzinfo=timezone(timedelta(hours=9))), AuditOwner())


def test_complete_scoped_run_queue_agent_sources_are_current_only_not_period_counts():
    from types import SimpleNamespace

    observed = datetime(2024, 3, 1, tzinfo=timezone.utc)
    run = SimpleNamespace(run_id="run-1", status=SimpleNamespace(value="RUNNING"),
                          phase=SimpleNamespace(value="EXECUTING"))
    queue = SimpleNamespace(job_id="job-1", status=SimpleNamespace(value="READY"))
    source_observed = datetime(2024, 3, 1, 0, 0, 1, tzinfo=timezone.utc)
    sources = {
        "run": SimpleNamespace(run_ids=("run-1",), observed_at=source_observed,
                               get=lambda _id: run),
        "queue": SimpleNamespace(job_ids=("job-1",), observed_at=observed,
                                 legacy_unscoped_present=False, get=lambda _id: queue),
        "agent": SimpleNamespace(agents=(SimpleNamespace(session_id="agent-1", status="ACTIVE"),),
                                 observed_at=observed),
    }
    result = read_scoped_dashboard("project-a", "test", "1d", observed,
                                   AuditOwner(), sources)
    assert result["current"]["run"]["count"] == 1
    assert result["current"]["queue"]["count"] == 1
    assert result["current"]["agent"]["count"] == 1
    assert result["sourceCompleteness"]["current"]["run"]["complete"] is True
    assert result["occurrences"]["runStarted"]["count"] is None
