# A-05 Decision Board

`STATIC_ONLY`; canonical L4/L7 및 Event는 `RUNTIME_DEFERRED / NOT_EXECUTED`, `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`다.

열은 DECISION_REQUIRED, CONFIRMED, HOLD, FUTURE_EXTENSION, REVIEW, SUPERSEDED다. 카드에는 decision_id, required, subject_ref/hash, question/input, options, selected_option, reason, evidence_refs, impact, actor_id/role, status/time, supersedes_id, lineage, next_action이 있다.

CONFIRMED는 authenticated human actor, `DECISION_DECIDE`, exact subject hash, selection, reason이 모두 필요하다. Agent는 CONFIRMED를 만들 수 없다. 불일치는 `HUMAN_ACTOR_REQUIRED`, `SUBJECT_HASH_MISMATCH`, `PERMISSION_DENIED`로 차단한다.

HOLD와 FUTURE_EXTENSION은 CarryoverItem의 source_decision_id, reason, risk, target_revision, review_at, next_action으로 보존한다. superseded 기록은 삭제하지 않고 lineage는 acyclic이어야 하며 carryover target이 존재해야 한다. 위반은 `CARRYOVER_MISSING` 또는 `DECISION_LINEAGE_INVALID`다.

설명은 i-icon의 tooltip/popover로 reason과 next_action을 제공하며 상시 설명 박스를 두지 않는다.
