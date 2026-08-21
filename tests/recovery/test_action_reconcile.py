from __future__ import annotations

import pytest

from packages.recovery.models import ActionAttempt, ActionStatus, ReconciliationClass
from packages.recovery.service import reconcile_action


def test_success_and_authoritative_receipt_are_confirmed_without_retry() -> None:
    completed = ActionAttempt("action-1", "step-1", ActionStatus.SUCCESS, "idem-1", "receipt-1")
    sent = ActionAttempt("action-2", "step-2", ActionStatus.REQUEST_SENT, "idem-2")

    assert reconcile_action(completed).classification is ReconciliationClass.CONFIRMED_SUCCESS
    received = reconcile_action(sent, authoritative_receipt_ref="receipt-2")
    assert received.classification is ReconciliationClass.CONFIRMED_SUCCESS
    assert received.retry_allowed is False


@pytest.mark.parametrize("fault_round", range(3))
def test_before_send_is_safe_retry_but_after_send_without_receipt_requires_review(
    fault_round: int,
) -> None:
    prepared = ActionAttempt("action-1", "step-1", ActionStatus.REQUEST_PREPARED, "idem-1")
    sent = ActionAttempt("action-2", "step-2", ActionStatus.REQUEST_SENT, "idem-2")

    before = reconcile_action(prepared)
    after = reconcile_action(sent)

    assert before.classification is ReconciliationClass.SAFE_RETRY
    assert before.retry_allowed is True
    assert after.classification is ReconciliationClass.MANUAL_REVIEW
    assert after.retry_allowed is False
    assert fault_round in range(3)
