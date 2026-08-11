# A-05 Design Baseline

`STATIC_ONLY / STATIC_CONTRACT_PASS`; Browser/API/DB/Event/Runtime/Deploy는 모두 `NOT_EXECUTED`이며 canonical L4/L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. 정적 SVG는 `E-SHOT_STATIC_NOT_RUNTIME_UI`, Event는 `E-EVT_NOT_EXECUTED`다.

DesignSpecification은 id, version, status, content_hash, source_decision_refs, scope/out_of_scope, screen_flow, operational_flow, testable_completion_conditions, unresolved_required_decisions, source_evidence_valid를 가진다. DesignBaseline은 id, version, baseline_hash, specification id/hash, approved_by, approved_at, invalidated_at을 가진다.

승인은 unresolved required decision 0, valid source evidence, authenticated human의 `DESIGN_APPROVE`, exact specification hash를 모두 요구한다. 미충족이면 APPROVAL_BLOCKED와 `REQUIRED_DECISION_UNRESOLVED`, `SOURCE_EVIDENCE_INVALID`, `DESIGN_SPECIFICATION_HASH_MISMATCH`, reason, next_action을 표시한다.

APPROVED baseline은 immutable이다. Specification 또는 hash가 바뀌면 기존 approval은 `APPROVAL_INVALIDATED`로 무효화하고 기존 baseline을 보존한 채 새 revision과 새 approval을 요구한다. 승인 baseline을 직접 변경하면 `APPROVED_BASELINE_MUTATION`으로 거부한다. A-05에서는 Execute·Apply를 열지 않는다.
