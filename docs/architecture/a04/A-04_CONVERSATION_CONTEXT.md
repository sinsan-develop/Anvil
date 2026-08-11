# A-04 Conversation Request와 Context Drawer

- contract_surface_ids: `CONVERSATION_REQUEST`, `CONTEXT_DRAWER`
- classification: `STATIC_ONLY`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- qualifier: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`

## Conversation Request

요구사항 field는 `objective`, `acceptance_criteria`, `included_scope`, `excluded_scope`, `protected_scope`, `assumptions`, `questions`다. 사용자 행동은 `confirm`, `edit`, `reject`, `hold`, `view_evidence`, `request_reanalysis`, `confirm_requirements`, `stop`이다.

확정 guard는 objective 존재, criterion 1개 이상, mandatory unanswered 0, 모든 assumption의 user confirmation이다. 추측은 confirmed fact badge를 받을 수 없고 영향이 있으면 unanswered question으로 되돌린다.

## Context Drawer

Drawer는 A-02 계약대로 360px `ON_DEMAND`이며 `impact`, `source`, `evidence`, `hash`, `decision_history`, `reason`, `next_action`을 제공한다. 상시 설명 박스와 hover-only 상호작용은 금지한다.

설명은 `i-icon`에서 시작해 짧은 내용은 `tooltip`, 복합 내용은 `popover`로 표시한다. 키보드 접근과 focus path를 제공하며 Escape로 닫고 focus는 trigger로 반환한다. 상태는 `icon + status_label + short_description`이고 색상만으로 의미를 전달하지 않는다.

## 권한과 오류

`PROJECT_VIEW`, `CONTROL_MODE_MANAGE`, `APPROVAL_DECIDE`, `APPLY_DECIDE`, `SAFE_STOP`, `SAFE_RESUME`, `DISCARD_RESULT`는 독립 capability다. 권한 없는 행동은 disabled + reason + next_action이다. 오류 후 draft/input을 보존하고 raw stack·credential·내부 주소를 표시하지 않는다.

> 정적 specimen은 runtime UI 증거가 아니며 Browser/API/DB/runtime/deploy는 `NOT_EXECUTED`다.
