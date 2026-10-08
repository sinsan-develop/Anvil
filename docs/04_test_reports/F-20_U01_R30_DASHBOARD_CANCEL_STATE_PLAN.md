# F-20/U-01 R30 Dashboard 조회 취소 상태 구현 계획

> 기존 승인 설계 §29.2·작업계획 U-01·통합검증매트릭스 §6.11·테스트계획 §10.8의 공통 `cancel` 상태를 분리 실행한다. 제품 write는 별도 WorkInstruction과 유효한 worker/write fencing token 발급 전 금지한다.

**목표:** 사용자가 진행 중인 Dashboard 조회를 취소하면 브라우저의 해당 GET만 중단하고 `CANCELLED`를 정직하게 표시한다. 백엔드 Run/Task 취소, 서버 rollback 또는 데이터 변경으로 표현하지 않는다.

**구조:** 기존 same-origin `GET /api/dashboard/operations`와 공개 응답/권한 계약은 그대로 둔다. `Shell`의 현재 `AbortController`·identity guard를 재사용해 새 조회 시작 전 stale 데이터를 지우고, 취소 버튼으로 abort→state 전환→수동 새로고침 회복을 구현한다. route 이탈 abort는 화면의 사용자 취소로 오인하지 않는다.

**기술:** React/TypeScript, Node console tests, 기존 Playwright/PG15/OIDC/HTTPS browser harness와 Python exact evidence, G-05.

## 전역 경계

- 기존 `codex/f18-wsl-ops` branch/격리 worktree만 사용한다. main 병합·새 branch·ysna/Production 제외.
- 제품 변경은 Dashboard client/UI와 해당 테스트·증거만 허용한다. 공개 API/schema, DB, 인증·권한, Secret, Provider, backend Run/Task lifecycle, 운영 자원은 변경하지 않는다.
- `CANCELLED`는 **브라우저 조회 요청 취소**만 뜻한다. 마지막 성공 payload의 보호 행·링크·관측 시각, 정상/0건/PASS를 남기지 않는다. 취소 직후 버튼·키보드 조작은 추가 GET을 만들지 않는다.
- 취소 이전 요청의 늦은 성공/실패가 `CANCELLED`나 후속 200 결과를 덮어쓰지 않아야 한다. 후속 수동 조회는 기존 엄격 응답 검증을 통과한 결과만 표시한다.
- 기존 401/403 `BLOCKED`, 429 `QUOTA`, 500/503·전송/형식 오류 `UNAVAILABLE`, loading/empty, R23~R29 증거와 same-origin/Secret 검사를 삭제·완화하지 않는다.
- 로컬 변경→검증된 checkpoint/private `development` push→WSL-server 동일 clean SHA의 fresh 격리 PG15/OIDC/HTTPS/Chromium 검증→전용 자원 신원 확인·잔여0으로 종료한다. R30 절편 PASS는 전체 U-01/F-20 acceptance가 아니다.

## 위험과 대응 테스트

1. 진행 중 조회 취소가 백엔드 취소처럼 보임: 버튼·상태 문구에 Dashboard 조회만 명시하고 API mutation0을 단언한다.
2. 취소 전 저장 행/관측 시각 누출: 기존 저장 Next Action 이후 held GET→취소에서 보호 행/이전 시각 제거를 실제 DOM으로 확인한다.
3. 중복·늦은 요청 경합: held GET1, disabled refresh 중복 클릭0, 취소 뒤 늦은 응답 무시, 후속 수동200 GET1과 최신 값 표시를 확인한다.
4. route 이탈/401/403/429/500/503 회귀: 기존 분류·abort guard와 접근성/키보드·same-origin·Secret 검사를 유지한다.
5. Playwright 취소 race: route 해제/fulfill 실패를 비밀 없는 진단으로 처리하고 실제 증거의 request/response·DOM 값을 엄격히 대조한다.

## 작업 순서

### Task 1 — 클라이언트 상태와 버튼

**파일:** `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`.

- [ ] `CANCELLED` 전용 화면과 취소 버튼을 요구하는 focused 테스트를 RED로 실행한다.
- [ ] Dashboard GET `LOADING` 동안만 키보드 조작 가능한 `대시보드 조회 취소` 버튼을 표시한다. 클릭 시 현재 controller만 abort하고 identity/in-flight guard를 안전하게 해제해 `CANCELLED`로 전환한다. route 이탈 cleanup은 이 버튼 동작이 아니다.
- [ ] 관측 시각/Queue/Health/Next Actions는 `조회 취소`와 보호 데이터 없음으로 표시하되 독립 Provider/Critical Alerts와 Database API 준비 정보는 유지한다.
- [ ] 취소 후 수동 새로고침은 한 GET200 결과로 회복한다. 401/403/429/500/503와 기존 상태·접근성 회귀, console/typecheck/lint/build/G-05/diff check를 실행한다.

### Task 2 — WSL 실제 브라우저 전이와 strict 증거

**파일:** `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R30_DASHBOARD_CANCEL_STATE_RESULT.md`.

- [ ] 저장된 Next Action 뒤 Dashboard GET 한 건을 결정론적으로 보류하고 취소 버튼을 실제 클릭한다. GET1·same-origin·`CANCELLED`·행/관측 시각 제거·독립 카드 보존·늦은 응답 무시·Secret 비노출을 단언한다.
- [ ] 같은 세션 후속 수동 GET200으로 새 응답의 실제 관측 시각/저장 행이 회복되고 기존 403 철회까지 이어짐을 확인한다.
- [ ] 새 browser evidence는 기존 R6/R23~R29 소유 key와 충돌하지 않는 고정 key/type/value만 추가한다. Python negative RED→GREEN과 기존 엄격 검사 전량 유지.
- [ ] Developer는 로컬 비 opt-in 검증·전용 임시출력 정리, Main은 동일 clean SHA WSL-server PG15/OIDC/HTTPS/Chromium opt-in·1920×1080 PNG/Network 별도 검토·전용 자원 정리를 맡는다. 주입된 취소는 실제 서버 Run 취소 증거가 아니다.

### Task 3 — Main 검토와 통제 종료

- [ ] Main은 exact writer diff/명령/출력과 Critical/Important finding을 독립 검토하고 필요한 테스트를 재실행한다.
- [ ] WORK_STATUS와 canonical progress/HANDOFF에 R30 절편 결과·미검증·자원 잔여를 기록한다. C30 `OPEN_BLOCKING`, F-20/U-01 `REWORK_IN_PROGRESS`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED` 유지.
- [ ] 유효 lease를 write→worker 순서로 회수하고 G-05·Git/private/WSL same-SHA를 검증한다. branch 병합·삭제/신규 branch는 전체 인수 전 하지 않는다.

Rollback: R30 exact scope만 정상 Git revert하고 R29 검증·Event 원문 prefix를 보존한다. 공개 API/DB/auth/지속 데이터 변경은 없어야 한다.
