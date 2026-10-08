# F-20/U-01 R29 Dashboard quota 상태 구현 계획

> 작업자: `developer-primary` 단일 writer. 이 계획은 기존 승인 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8의 quota 상태를 분리 실행한다. 제품 write는 별도 WorkInstruction·유효한 worker/write fencing token 발급 전 금지한다.

**목표:** Dashboard `GET /api/dashboard/operations`가 429를 반환할 때 실제 제한 상태를 일반 장애나 권한 거부로 오인하지 않고, 보호 데이터를 감춘 상태에서 수동 재조회로 회복한다.

**구조:** 기존 same-origin GET, 응답 사전, 인증·권한·API schema는 변경하지 않는다. 클라이언트의 Dashboard 상태 분류와 카드 문구에 quota만 추가하고, 기존 수동 새로고침 경로를 그대로 사용한다. 브라우저 검증은 WSL-server 격리 PG15/OIDC/HTTPS/Chromium에서 결정론적 429 장애 주입을 명확히 구분하여 수행한다.

**기술:** React/TypeScript, Node console tests, Playwright browser harness, Python integration evidence, canonical G-05.

**기준:** `Anvil_설계서_v2.md` §29.2; `Anvil_작업계획서_v1.md` U-01; `Anvil_통합검증매트릭스_v1.md` §6.11; `Anvil_테스트계획서_v1.md` §10.8; `docs/04_test_reports/F-20_U01_POST_R28_COVERAGE_REVIEW.md`.

## 전역 경계

- 기존 `codex/f18-wsl-ops` 브랜치와 격리 worktree만 사용한다. `main`/새 branch/ysna-server/Production은 제외한다.
- 제품 변경은 클라이언트의 상태 분류·문구와 해당 테스트/증거만 허용한다. 공개 API, DB/schema, 인증·권한, Secret, Provider, 운영 리소스는 변경하지 않는다.
- 429 error body·header·URL query·credential을 화면, stdout, 증거 파일에 복사하지 않는다. 401/403은 `BLOCKED`, 500/503과 전송 오류는 `UNAVAILABLE`을 유지한다.
- 429에서 기존 보호 행과 관측 시각을 성공 상태로 남기지 않는다. quota는 정상/0건/PASS가 아니다. 수동 재조회가 후속 200을 받으면 기존 엄격 응답 검증을 거친 값만 표시한다.
- 실제 429 경로는 결정론적 장애 주입임을 결과에 표시한다. 로컬 mock PASS를 실제 서버 quota enforcement PASS로 승격하지 않는다.
- 로컬 변경→안전한 commit/private `development` push→WSL-server Git exact SHA 격리 QA→임시자원 신원 확인·정리/잔여0 순서다. 전체 U-01/F-20 수락·C30 차단 해소는 이번 작업의 완료조건이 아니다.

## 검토 위험과 대응 테스트

1. 429 본문에 Secret이 있어도 읽기 후 폐기하고 UI·로그에 노출하지 않는다: Node negative test와 브라우저 Network/DOM audit.
2. 저장 Next Actions 뒤 429를 받으면 stale 보호 행과 이전 관측 시각이 사라진다: 실제 브라우저 전이 단언.
3. 401/403·500/503 분류가 quota와 섞이지 않는다: 기존 분류 회귀 + 신규 exact 테스트.
4. 429 후 수동 200 재조회가 실패한 이전 결과를 재사용하지 않는다: 연속 요청 수/최신 관측 시각/행 단언.
5. 중복 클릭과 키보드 활성화가 추가 GET을 만들거나 disabled 상태를 우회하지 않는다: 기존 R27 테스트 유지·해당 전이 회귀.

## 작업 순서

### Task 1: 로컬 상태 분류와 표시

**파일:** `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`.

- [ ] 429가 현재 `UNAVAILABLE`이 되는 것을 단일 focused 테스트로 RED 확인한다. 401/403·500/503, Secret body, 저장값 제거/관측 시각 문구를 함께 비교한다.
- [ ] `DashboardQueueState` 및 연계 카드 상태에 `QUOTA`를 추가한다. `loadDashboardQueue`는 429만 `QUOTA`로 분류하고, 다른 status·전송 오류/형식불량의 기존 fail-closed 동작은 그대로 둔다.
- [ ] Dashboard 관측 시각·Queue/Health/Next Actions 카드에 quota 전용 제한 문구를 표시한다. 보호 행/링크/정상·0건 상태를 노출하지 않는다.
- [ ] focused GREEN, console 전체, typecheck/lint/build, `git diff --check`, G-05를 실행하고 생성한 로컬 임시 출력만 신원 확인 후 정리한다.

### Task 2: 실제 브라우저 전이와 엄격 증거

**파일:** `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R29_DASHBOARD_QUOTA_STATE_RESULT.md`.

- [ ] 기존 R28 실제 경로를 유지하며 저장된 Next Actions 뒤 Dashboard GET 한 건에만 결정론적 429를 주입한다. 수동 버튼 → `QUOTA`/저장 행 제거/관측 시각 제한 표시/GET1을 단언한다.
- [ ] 같은 세션에서 후속 수동 GET200으로 회복하고 새 응답의 실제 관측 시각·행만 표시됨을 단언한다. 401/403 철회·Network same-origin·Secret 검사는 제거하지 않는다.
- [ ] 브라우저 evidence에 고정 키·bool/int/string 값만 추가한다. Python exact-key/type/value 계약 negative test를 먼저 RED로 실행하고 구현 뒤 GREEN으로 확인한다. 기존 R6/R23~R28 키 소유권을 중복 소비하지 않는다.
- [ ] 로컬 전체 관련 회귀와 WSL-server fresh 격리 PG15/OIDC/HTTPS/Chromium opt-in을 동일 clean SHA에서 실행한다. PNG/Network/API evidence와 오류·SKIP·미검증 범위를 분리하고 결과보고서에 남긴다.

### Task 3: Main 독립 검토·통제 종료

- [ ] Main은 exact writer diff/명령·출력과 Critical/Important finding을 독립 검토하고 필요한 검증을 재실행한다.
- [ ] 결과를 `docs/WORK_STATUS.md`와 canonical progress/HANDOFF에 누적한다. PASS라 해도 `F-20/U-01 REWORK`, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다.
- [ ] 유효 lease를 write→worker 순서로 회수하고 G-05, same-SHA Git, WSL 전용 자원 잔여0을 확인한다. 기존 브랜치 병합·삭제는 U-01/F-20 조건 충족 전 하지 않는다.

## Rollback

R29 제품/테스트 exact scope만 정상 Git revert하고 이전 R28 검증·원장 prefix를 보존한다. API/DB/schema/auth/Secret/지속 데이터 변경은 없어야 한다.
