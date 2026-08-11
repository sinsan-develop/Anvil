# A-04 Session Workbench

- contract_surface_id: `WORKBENCH_SESSION_SHELL`
- classification: `STATIC_ONLY`
- package verdict: `STATIC_CONTRACT_PASS`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`

## 화면 구성

1920×1080 기준 상단에는 `project`, `branch`, `baseline`, `environment`를 놓는다. 본문은 `Conversation`, `Current Work`, `Evidence·Decision` 세 pane을 Progressive Disclosure로 제공하며 고정된 12개 독립 화면을 강제하지 않는다.

행동은 `stop`, `revision_request`, `plan_approve`, `apply_approve`, `discard`로 분리한다. 현재 capability가 없는 행동은 숨기지 않고 disabled 상태와 `reason`, `next_action`을 함께 표시한다.

## 요구사항 확인

`objective`, `acceptance_criteria`, `included_scope`, `excluded_scope`, `protected_scope`, `assumptions`, `questions`를 서로 다른 field로 유지한다. 각 항목은 `confirm`, `edit`, `reject`, `hold`, `view_evidence`를 제공하며 하단에는 `request_reanalysis`, `confirm_requirements`가 있다.

`confirm_requirements`는 다음을 모두 충족할 때만 활성화한다.

- objective가 존재한다.
- acceptance_criteria가 1개 이상이다.
- mandatory unanswered question이 0개다.
- assumptions가 모두 user-confirmed다.

Agent guess는 confirmed fact와 분리하고 결과·위험을 바꾸는 추측은 질문으로 전환한다. 오류 뒤에도 draft와 input을 보존한다.

## 상태와 노출

Phase와 Run status를 합치지 않는다. `WAITING`, `BLOCKED`, `INTERRUPTED`, `SKIPPED`는 success나 completed가 아니다. Project view 권한은 control mode·approval·apply 권한을 자동 부여하지 않는다.

secret 값, raw internal endpoint, loopback endpoint, unauthorized full path, shell/CLI 원문은 기본 화면에 노출하지 않는다. 근거는 masked reference로 연결한다.

> 이 문서는 정적 계약이다. Browser/API/DB/Network/Docker/deploy는 `NOT_EXECUTED`다.
