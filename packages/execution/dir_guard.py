"""Canonical design-intent review transition guard."""

from __future__ import annotations

from dataclasses import replace

from .models import DIRStatus, DesignIntentReview


_TRANSITIONS: dict[DIRStatus, frozenset[DIRStatus]] = {
    DIRStatus.DIR_HOLD: frozenset({DIRStatus.REPORTING}),
    DIRStatus.REPORTING: frozenset({DIRStatus.WAITING_OWNER_DIRECTION}),
    DIRStatus.WAITING_OWNER_DIRECTION: frozenset({DIRStatus.CLEARED}),
    DIRStatus.CLEARED: frozenset(),
}


class DIRGuard:
    def transition(
        self,
        review: DesignIntentReview,
        target: DIRStatus,
        *,
        owner_direction_event_id: str | None = None,
        authenticated_owner: bool = False,
    ) -> DesignIntentReview:
        if target not in _TRANSITIONS[review.status]:
            raise ValueError(f"DIR transition {review.status.value} -> {target.value} is not allowed")
        if target is DIRStatus.CLEARED:
            if not isinstance(owner_direction_event_id, str) or not owner_direction_event_id.strip():
                raise ValueError("owner direction event is required to clear DIR")
            if not authenticated_owner:
                raise ValueError("authenticated owner is required to clear DIR")
        return replace(review, status=target, owner_direction_event_id=owner_direction_event_id)

    def recurrent_drift(
        self,
        cleared_review: DesignIntentReview,
        new_review_id: str,
        new_subject_hash: str,
        causation_event_id: str,
    ) -> DesignIntentReview:
        if cleared_review.status is not DIRStatus.CLEARED:
            raise ValueError("recurrent drift requires a previously cleared review")
        return DesignIntentReview(
            review_id=new_review_id,
            dir_type=cleared_review.dir_type,
            status=DIRStatus.DIR_HOLD,
            subject_hash=new_subject_hash,
            causation_event_id=causation_event_id,
        )
