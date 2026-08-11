# A-05 Proposal·Decision·Design Baseline 정적 계약

## 목적과 판정

A-04 Workbench 안에서 복수 Proposal 비교, 사람 Decision, immutable Design Baseline과 Carryover·lineage를 정적 계약으로 확정한다.

- package: `STATIC_CONTRACT_PASS`
- AV: `AV-FLOW-001`
- canonical L4/L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`
- runtime owners: B-03 durable event, A-14/A Gate browser·click validation

## surfaces

### Proposal Compare

proposal set id/version/status/hash/source intent와 최소 두 proposal을 표시한다. 각 proposal은 title, summary, pros, cons, fit conditions, cost/uncertainty, risks, evidence refs, assumptions를 가진다. Agent recommendation은 reason과 함께 표시하되 selected/approved가 아니다.

Actions: SELECT, REQUEST_REVISION, HOLD, REQUEST_DIFFERENT_APPROACH, view evidence.

### Decision Board

Columns: DECISION_REQUIRED, CONFIRMED, HOLD, FUTURE_EXTENSION, REVIEW.

Fields: decision id, required, subject/hash, question/input, options, selected option, reason, source/evidence, impact, actor/role, status/time, supersedes id, lineage, next action.

CONFIRMED는 authenticated human actor와 exact subject hash가 필요하다. HOLD와 FUTURE_EXTENSION은 CarryoverItem으로 보존한다.

### Design Baseline

DesignSpecification id/version/status/content hash/source decision refs와 DesignBaseline id/version/hash/approved_by/approved_at/invalidated_at를 표시한다. scope/out-of-scope, screen flow, operational flow, testable completion conditions, unresolved required decisions, source evidence validity를 판정한다.

승인 baseline은 immutable이다. Specification/hash가 바뀌면 기존 approval은 invalidated되고 새 revision·approval이 필요하다.

### A-04 Context Drawer

impact, source/evidence/hash, decision history, reason, next action을 360px on-demand drawer에서 표시한다. 별도 상시 설명 화면을 만들지 않는다.

## edges and guards

- saved intent → proposal generation
- alternatives ready(minimum 2 + exact fields/evidence) → human decision
- human SELECT + subject hash → design refinement
- HOLD/REQUEST_REVISION/DIFFERENT_APPROACH → Execute closed + revision/new set
- unresolved required decision 또는 invalid source evidence → approval disabled + server guard reason
- authenticated human + exact spec hash → immutable baseline
- spec/hash change → approval invalidation/new revision
- superseded decision lineage와 carryover 보존
- A-05에서는 Execute edge를 열지 않는다.

## states and errors

- proposal: DRAFT, GENERATING, READY, REVISION_REQUIRED, HELD, ERROR, BLOCKED, PERMISSION_DENIED
- decision: DECISION_REQUIRED, CONFIRMED, HOLD, FUTURE_EXTENSION, REVIEW, SUPERSEDED
- design: PROPOSED, REFINING, REVIEW_READY, APPROVAL_BLOCKED, APPROVED, REJECTED, INVALIDATED

Reason codes: PROPOSAL_SET_NOT_READY, PROPOSAL_MINIMUM_NOT_MET, SOURCE_EVIDENCE_INVALID, REQUIRED_DECISION_UNRESOLVED, HUMAN_ACTOR_REQUIRED, SUBJECT_HASH_MISMATCH, DECISION_LINEAGE_INVALID, DESIGN_SPECIFICATION_HASH_MISMATCH, DESIGN_APPROVAL_BLOCKED, APPROVAL_INVALIDATED, STALE_STATE_VERSION, PERMISSION_DENIED.

## permissions

PROJECT_VIEW, PROPOSAL_REVIEW, DECISION_DECIDE, DESIGN_EDIT, DESIGN_APPROVE를 분리한다. Unauthorized control은 disabled + reason + next action이다. Agent는 proposal/recommendation만 제공하며 사람 결정을 대체하지 않는다.

## predecessors and safety

A-01 rail/DEC-CONCEPT, A-02 token/explanation, A-03 project/baseline/policy, A-04 Workbench/drawer를 exact hash로 소비한다. Secret, raw internal endpoint, localhost, unauthorized path를 노출하지 않는다. 실제 API/DB/event/browser/runtime은 구현하지 않는다.

## artifacts and hostile verification

Catalog, Proposal/Decision/Baseline Markdown 3개, static SVG 2개, checker/test/fixtures, validation, evidence manifest, completion report를 만든다. Checker는 proposal minimum/fields, recommendation≠decision, human/hash guards, unresolved approval block, hold/carryover, lineage cycle, immutable baseline/invalidation, predecessor/tokens/qualifier/permissions/secret, manifest integrity를 stable reason code로 거부한다.
