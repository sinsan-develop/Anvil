# A-02 설명 인터페이스 계약

## 고정 계약

| field | value |
|---|---|
| entry_point | `i-icon` |
| short_content_surface | `tooltip` |
| complex_content_surface | `popover` |
| required_content | `reason + next_action` |
| persistent_explanation_box_allowed | `false` |
| hover_only_allowed | `false` |
| focus_path_required | `true` |
| keyboard_access_required | `true` |
| escape_closes | `true` |
| focus_returns_to_trigger | `true` |

## 사용 흐름

1. 사용자가 pointer 또는 keyboard focus로 `i-icon`에 진입한다.
2. 짧은 문맥은 tooltip으로 표시한다.
3. 복합 내용은 Enter/Space로 popover를 열고 `reason`과 `next_action`을 함께 제시한다.
4. Escape로 닫고 focus를 trigger에 돌려준다.

상태 표현은 `icon + status_label + short_description`이 기본이며 색상 단독 표현은 금지한다. 이 계약의 evidence는 `STATIC_ONLY / E-SHOT_STATIC_NOT_RUNTIME_UI`이고 canonical 결과는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. `AV-UI-001`, `AV-UI-002`의 실제 L4 동작은 A-14/A Gate에서 확인한다.
