# F-20/U-01 R27 Dashboard 수동 새로고침 구현 계획

> For agentic workers: TDD RED→GREEN으로 아래 단일 절편을 구현한다. Anvil의 canonical dual lease·단일 `developer-primary`·Main 독립 QA가 실행 방식의 기준이다.

**Goal:** 사용자가 Dashboard operations를 수동으로 다시 조회하고 실제 관측값·오류·차단을 확인한다.

**Architecture:** 기존 same-origin `GET /api/dashboard/operations`와 `loadDashboardQueue`를 재사용한다. Dashboard 요청의 AbortController만 분리해 새로고침이 Provider·Alert·readiness를 중단하지 않게 하고, 재조회 시작 시 이전 Dashboard 보호값을 숨긴다.

**Tech Stack:** React/TypeScript, Node console tests, Playwright Chromium, WSL-server 격리 PG15/OIDC/HTTPS.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `Anvil_테스트계획서_v1.md` §10.8.

## 범위와 기준

- 기존 `codex/f18-wsl-ops`에서 순차 진행한다. 새 branch/main/ysna/Production 작업은 없다.
- 기존 API 응답·DB/schema·인증/권한·Secret·공개 계약을 변경하지 않는다. 브라우저 API는 same-origin 상대 경로만 사용한다.
- 수동 새로고침은 Dashboard operations에만 적용한다. `마지막 확인` readiness, Provider 및 Alert의 별도 조회 상태를 Dashboard 시각으로 둔갑시키거나 같이 갱신하지 않는다.
- Project/Environment/기간 필터, 운영 read model 확장, U-01 전체 상태·독립 Tester acceptance는 이 절편 밖이며 미충족으로 보존한다.
- canonical seq1956/worker·write null, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락을 출발 상태로 확인한다.

## Review Focus

1. 재조회 403: 이전의 저장된 Next Actions·시각이 화면에 남지 않는가.
2. 재조회 503/잘못된 응답: 이전 성공값을 현재 상태로 오인하지 않는가.
3. 연속 클릭·초기 로딩: Dashboard 요청 중복과 역전 결과가 없는가.
4. 다른 카드: 수동 재조회가 Provider·Alert·readiness를 중단하거나 갱신하지 않는가.
5. 브라우저 실제 클릭: same-origin Dashboard GET이 재발행되고 응답의 `observed_at`이 화면에 반영되는가.

## Task 1: Dashboard 수동 재조회

**Files:** `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_RESULT.md` (exact4).

**Interface:** 기존 `loadDashboardQueue(signal, request)`와 `DashboardQueueState`를 그대로 사용한다. Dashboard 머리말의 native `button`은 키보드로 작동하고 로딩 중 비활성이다.

- [ ] Step 1: console/browser 검증을 먼저 추가한다. 재조회 클릭→기존 GET 한 번 추가, 로딩에서 과거 값 제거, 성공 시 새 관측 시각, 401/403/503/invalid에서 차단·오류, Provider·Alert·readiness 독립, 연속 클릭 방지, 키보드 활성화를 단언한다. 기대값은 실제 응답 fixture·브라우저 저장 응답에서 독립 도출한다.
- [ ] Step 2: 새 테스트 RED를 실행해 누락된 수동 동작 때문인 실패를 기록한다.
- [ ] Step 3: App.tsx에서 Dashboard 요청만 독립 controller/ref로 관리하고 기존 loader 재사용, 머리말 버튼과 LOADING 전이를 구현한다. 단일 active 요청 및 unmount/route 변경 시 abort; 이전 응답이 새 상태를 덮지 않게 한다. 다른 카드·공개 계약을 바꾸지 않는다.
- [ ] Step 4: console 전체, browser `--audit-self-test`, typecheck/lint/build, Python 비 opt-in, G-05, `git diff --check` GREEN을 기록한다.
- [ ] Step 5: Main 독립 diff/로컬 검증, 같은 clean SHA private push→WSL-server pull/격리 PG15/OIDC/HTTPS/Chromium 실제 클릭·Network·화면 검증 및 정확한 임시자원 정리 뒤 보고서·상태·lease를 닫는다.

Rollback: R27 exact4만 정상 Git revert한다. 지속 데이터 migration은 없다.
