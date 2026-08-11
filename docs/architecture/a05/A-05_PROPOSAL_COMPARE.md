# A-05 Proposal Compare

`STATIC_ONLY / STATIC_CONTRACT_PASS`이며 실제 Browser/API/DB/Event/Runtime/Deploy는 `NOT_EXECUTED`다. canonical L4/L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`, 증거 한정자는 `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`다.

Proposal Set은 `proposal_set_id`, version, status, subject_hash, source_intent_ref를 표시한다. `READY`는 최소 2개 대안이 title, summary, pros, cons, fit_conditions, cost, uncertainty, risks, evidence_refs, assumptions를 모두 갖고 evidence가 유효할 때만 가능하다. 그 외에는 `PROPOSAL_SET_NOT_READY`, `PROPOSAL_MINIMUM_NOT_MET`, `PROPOSAL_FIELD_MISSING`, `PROPOSAL_EVIDENCE_MISSING`과 reason·next_action을 표시한다.

Agent recommendation과 reason은 추천일 뿐 `is_selected=false`, `is_approved=false`다. 사람의 `SELECT`만 exact subject hash와 함께 Design refinement를 열며 Execute는 열지 않는다. `REQUEST_REVISION`, `HOLD`, `REQUEST_DIFFERENT_APPROACH`는 Execute를 닫고 새 set 또는 CarryoverItem으로 연결한다. `VIEW_EVIDENCE`는 A-04의 360px `ON_DEMAND` i-icon tooltip/popover drawer를 사용한다.

상태는 DRAFT, GENERATING, READY, REVISION_REQUIRED, HELD, ERROR, BLOCKED, PERMISSION_DENIED를 구분하며 색상만으로 표현하지 않는다.
