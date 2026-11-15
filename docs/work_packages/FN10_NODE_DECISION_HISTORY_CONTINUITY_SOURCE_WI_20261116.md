# FN10/UI04 사람 판단 이력 페이지 연속성

기준 maincd99965403239074f1c4d11f93d6edddcc834e70, branch codex/av3-ui04-decision-history-continuity. 기존 FN10_NODE_DECISION_STORAGE_WEB_SOURCE_IMPLEMENTATION_20261106의 목록 계약은 페이지 사이 중복/누락0과 마지막 실제 반환행의 cursor를 규정한다. Primary 제품 단독 writer, Main 기록·검수·통합, 독립 검수 읽기 전용.

현재 더보기 handler는 요청 시작 때 실행 잠금/busy를 설정하지 않아 같은 cursor의 지연 GET2개가 동일 이력을 중복 append할 수 있다. 오류 때 이력만 비우고 cursor는 남겨 다음 재시도가 첫 페이지 없는 목록을 만들 수 있다. 기존 계약 안에서 화면 연속성을 복원한다.

- 같은 문맥의 더보기는 동기 실행 잠금으로 한 번만 진행한다. 현재 selection/context와 원 cursor가 여전히 맞는 응답만 순서대로 적용한다. 지연 응답으로 cursor가 후퇴하거나 같은 버전이 두 번 표시되지 않아야 한다.
- 조회 실패 후 민감한 이력은 기존 거절 의미대로 숨기고 stale cursor를 다시 사용하지 않는다. 사용자의 명시 재조회는 첫 페이지부터 일관된 목록을 복구한다. 실패를 성공으로 표시하거나 자동 재시도/자동 다음쪽 이동을 하지 않는다.
- 사용자/client/project/application fullref/node/transport/기한·문맥 전환/왕복/닫기 뒤 늦은200/401은 현재 목록/인증/저장 버퍼에 반영하지 않는다. 기존 판단 작성/승인·POST·권한/고정조회 동작은 보존한다.
- 제품 apps/web/src/features/workspace/NodeDecisionPanel.tsx와 시험 tests/unit/UI04/node-decision-flow.test.ts의2경로만 변경한다. 타인 편집을 되돌리지 않는다. 새 API/저장/권한/DB/키/서비스/실자료/SDK/Agent/P03/root 배정 변경은 없다.

기존 실제 React RAM fixture에서 지연 cursor의 연속 클릭·응답 유실/거절 후 재조회·문맥 변경 늦은 응답을 RED→GREEN으로 검증한다. GET1/버전별 표시1/정확 cursor·실패 후 stale cursor0·첫 페이지 재조회·POST추가0을 단언한다. 기존 저장/고정조회 직접 영향 검사·루트 type·웹 메모리 build·diff를 선택하며 동일 검사 불필요 반복과 기대값 완화는 하지 않는다. 최종2지문·정확 명령/exit/개수·실행 종단/미검증을 반환한다. 실제 DB/브라우저/전체 FN10/UI04 완료가 아니다. rollback은2경로 한정 diff 역적용이다.
