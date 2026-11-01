# UI11 후보 목록 탐색 source 작업지시서 — 2026-11-01

담당: 기존 Primary, Main 검수·통합. 기준 HEAD b15050e7779047bf5f81b0a6891b1c50bf362a83 / codex/av3-stage-b. 기존 보호 untracked3 보존.

## 목적·권한
승인된 UI11 도구·환경 후보 조회의 이전 페이지 복귀·현재 요청 페이지 명시 재조회를 완성한다. INTERFACES §356~358과 기존 listCandidates의 kind/limit/cursor/응답을 그대로 사용한다. ConnectionDefinition 채택·실제 등록/READY 판정·새 공개/저장/권한 계약은 아니다. 최신 신산님 source·화면·합성 검증 지시 안의 내부 구현이다.

## 단일 writer 허용2
- apps/web/src/features/connections/ConnectionsPage.tsx — 시작 SHA256 17943D1EEBAC4F9DF011EDA2AC0C43F19172BE809A9D5C0A9FBF69ECD0E772DD
- tests/unit/UI11/connection-candidate-pagination.test.ts — 신규
Main은 이 두 경로를 수정하지 않는다. 기존 API/서버/SQL/CSS/다른 화면·완료 기능 수정0.

## 동작
1. 성공한 요청 cursor 이력을 화면 내부에 보관, 첫→다음→이전 GET을 명시 버튼으로 수행한다. 목록은 현재 조회이며 고정 snapshot이라고 표시하지 않는다.
2. 실패한 요청 cursor/복귀 위치를 잃지 않고 같은 페이지를 명시 재조회한다. 자동 재시도·쓰기 POST0. 성공 전 다음/이전 위치를 성공으로 확정하지 않는다.
3. project/user/session client/kind/API client 변화와 unmount는 목록 탐색 상태를 분리하고 지연 응답/오류/401이 새 문맥에 반영되지 않도록 한다. A→B→A 복귀도 옛 응답을 복원하지 않는다.
4. 후보 입력/준비·PENDING/UNKNOWN 원명령·App buffer/onChange의 기존 의미 보존. 목록 read 기능이 초안/명령을 초기화하거나 자동 등록하지 않는다. NOT_READY/NOT_RECHECKED 유지.
5. 이전/다음/재조회 버튼은 loading 중 중복 요청하지 않고 기존 상세 열기/작성/필터 동작을 보존한다.

## 검증·반환
실제 React component와 기존 공개 API를 소비하는 합성 시험으로 먼저 실제 누락 RED를 확인 후 최소 구현한다. 정상 양방향·실패 동일cursor 재조회/자동0·필터/주체/client 변경·늦은 응답·ABA·POST0·초안/UNKNOWN 보존을 확인한다. 기존 candidate API 집중시험과 Web typecheck를 필요한 범위로 실행한다. 기존 도구만 사용·새 의존성/실서비스/네트워크/DB/키/Agent/사용자 파일 조사0. 완료된 unrelated 회귀 재실행0.

결과: 변경 전후 diff, 정확 명령·exit·사례수·hash, 오류·미검증·자원/handle0을 반환한다. 시험환경 문제와 제품 반례를 구분한다. 제품 source-only 검수이며 실DB/served/사용자인수·전체UI11/WORK_PLAN은 미완료로 남긴다. commit/push는 Main만 수행한다.
