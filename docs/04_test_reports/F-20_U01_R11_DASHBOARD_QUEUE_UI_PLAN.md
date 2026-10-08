# F-20/U-01 R11 Dashboard Queue 읽기 화면 계획

## 판정·범위

승인된 U-01 Dashboard의 UI 연결을 한 단위로 진행한다. R10의 인증된 `GET /api/dashboard/operations`를 브라우저 same-origin 상대 경로로 읽고, 현재 고정 `UNAVAILABLE`인 Queue 카드에 scoped 행 수와 source 연결 상태만 표시한다. API·DB·권한·기존 alert/Provider/Database 카드 계약을 변경하지 않는다. Project/Run/Agent 전체 집계나 Next Actions 완성, U-01/F-20 수락으로 승격하지 않는다.

## 화면 계약

- 요청은 `credentials: same-origin`, `Accept: application/json`, `AbortSignal`을 사용한다. 401/403은 `BLOCKED`, 5xx/네트워크/비정상 JSON/계약 위반은 `UNAVAILABLE`이며 원문 오류·payload·내부 URL은 렌더하지 않는다.
- 성공 envelope와 snapshot은 R10의 명시적 필드만 검사한다. Queue는 최대 100행의 배열이어야 하고 `source_gaps`는 제한된 고유 component 이름의 배열이어야 한다. UI에는 job 행 원문을 출력하지 않는다.
- `source_gaps`에 `queue`가 있으면 건강 관측은 `UNKNOWN`이라고 표시한다. Queue 배열의 건수는 `범위 내 관측 N건`으로만 표시하며, `source_gaps`에 `queue`가 없더라도 소유 source의 완전성·실제 0건·HEALTHY를 주장하지 않는다. 이 수는 처리 성공률·Worker 건강·전체 시스템 Queue 수가 아니다.
- Database readiness·Provider 등록·Critical Alerts의 기존 경로/권한/표시는 유지한다. React 텍스트 escaping을 사용하고 raw HTML은 넣지 않는다. 1920×1080/12px 카드 레이아웃·기존 스타일을 보존한다.

## TDD·검증

정확한 제품 범위는 `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R11_DASHBOARD_QUEUE_UI_RESULT.md` 세 경로로 제한한다. 먼저 same-origin URL·권한/오류·malformed/secret body·source gap·0/양수 count·기존 카드 회귀 RED를 만들고 GREEN을 확인한다. 이어 `test:console`, typecheck, lint, build, 기존 API 인접 회귀를 실행한다. Main 독립 diff/테스트 후 사설 개발 branch push→WSL-server 동일 SHA pull→격리 브라우저에서 실제 API/Network 검증과 임시 자원 제거를 수행한다. 검증하지 못한 브라우저/OIDC/기타 U-01 read model은 미검증으로 남긴다.

## 제외·rollback

신규 API/BFF route, DB schema/지속 데이터, 인증·권한 수정, Queue mutation, Worker/Budget/Provider source 신규 연결, 다른 메뉴, 새 branch, main 병합, `/srv` 기존 서비스 및 ysna/Production은 제외한다. 회귀 시 이 세 제품 경로의 R11 diff만 되돌리고 R10 API checkpoint를 유지한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락은 유지한다.
