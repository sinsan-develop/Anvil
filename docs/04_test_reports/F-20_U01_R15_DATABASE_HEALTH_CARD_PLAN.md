# F-20/U-01 R15 Database Health 카드 구현 계획

> **작업 담당자:** 이 계획과 설계서 §29.2를 읽고, `developer-primary` 단일 writer가 WorkInstruction의 exact scope에서 TDD로 구현한다.

**목표:** Dashboard Database 카드의 API 준비 상태와 실제 Database Health 관측 상태를 구분해, 준비 API만 성공한 경우를 건강 `HEALTHY`로 오인하지 않도록 한다.

**구조:** 기존 `/api/health/ready`는 migration readiness의 근거로 보존한다. R14의 한 번뿐인 same-origin `/api/dashboard/operations` 응답에서 `health.database`를 독립 검증해 카드의 건강 상태·마지막 점검·오류 수에 사용한다. R14의 Worker/Backend/Artifact Store 세 카드와 Queue·Provider·Alerts 경로는 변경하지 않는다.

**기술:** React/TypeScript, 기존 Node SSR console test, Windows local 개발 후 기존 private branch push 및 WSL-server 동일 SHA Node24 격리 QA. 설계 근거는 `Anvil_설계서_v2.md` §29.2, 계획 근거는 `Anvil_작업계획서_v1.md` U-01이다.

## 범위·판정

- 기존 `codex/f18-wsl-ops` R14 close HEAD `8d96ac65812a23440a992038ff2cb1b658c90e02`, G-05 seq1878, worker/write lease null, WSL-server 격리 checkout 동일 SHA·clean에서 시작한다. 신규 branch/worktree는 만들지 않는다.
- 승인된 U-01 Health 카드의 내부 UI 단위다. 기능 범위·요구사항·중요 위험, API/BFF route·공개 JSON field, 권한·Secret·DB schema·지속 데이터를 변경하지 않는다. 현 Dashboard 요청 1회와 readiness 요청 1회 외 fetch를 추가하지 않는다.
- `readiness !== READY`이면 Database의 주 상태는 `NOT CONNECTED`이며 어떤 Health 신호도 `HEALTHY`로 승격하지 않는다. readiness가 `READY`일 때만 검증된 Database 신호를 `HEALTHY/LATE/EXPIRED/UNKNOWN`으로 표시하고 migration head는 별도의 준비 근거로 남긴다. 빈 신호 또는 `database` source gap은 `UNKNOWN`; malformed/future snapshot·신호는 `UNAVAILABLE`; Operations 401/403은 `BLOCKED`, 5xx/전송 실패는 `UNAVAILABLE`다. 건강 상태 외에 점검시각·오류 수만 표시하고 evidence/hash/detail URL/raw body는 노출하지 않는다.
- Database 신호 검증은 R14의 정확한 7-field/시간/정수/evidence/same-origin detail-path 규칙을 재사용하되, Database 행 하나의 오류가 R14 세 카드의 판정을 새로 바꾸지 않도록 별도로 투영한다. Queue 관측 수 및 기존 세 카드의 결과를 보존한다. 작동하지 않는 상세 링크는 추가하지 않는다.
- 실제 DB health source의 생성·Provider 상태·Project/Run/Agent/환경 집계·운영 카드·Next Actions·브라우저 정식 E-SHOT/E-NET·F-20/U-01 acceptance·C30 해소·main 병합·ysna/Production은 제외한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`를 유지한다.

## 파일·검증 단위

1. 단일 Developer 제품 exact3: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R15_DATABASE_HEALTH_CARD_RESULT.md`. 기존 테스트의 readiness 의미를 건강 PASS로 승격하지 않고 기대값을 분리한다.
2. 먼저 실제 카드 렌더를 검증하는 정상/UNKNOWN·gap/NOT CONNECTED/401·403/5xx·전송/invalid·미래 관측 테스트를 RED로 실행한다. GREEN 후 `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`, G-05, diff check를 실행한다. 독립 Main diff·재실행 뒤 동일 제품 SHA를 WSL-server에서 Node24 테스트·typecheck·lint·build로 확인한다.
3. Main은 기존 통제 overlay 방식으로 R15 WI·worker/write lease 발급·회수, Event/progress/HANDOFF, 결과·임시자원 정리를 기록한다. QA 중 임시 자원은 생성 전 이름·환경·수명·정리를 WORK_STATUS에 기재한다. 정식 실제 브라우저/DB acceptance를 단위 테스트 PASS로 대체하지 않는다.

## 회귀·복구

- R14 세 카드 또는 Queue/Provider/Alerts의 표시·요청 변화, 준비 API 실패를 건강으로 오판, 민감값/내부 주소 노출, 새 API 계약이 나오면 같은 writer가 수정한다. 제품 회귀 시 R15 제품 exact2 diff만 제거하고 결과·실패 근거와 기존 R14 checkpoint는 보존한다.
