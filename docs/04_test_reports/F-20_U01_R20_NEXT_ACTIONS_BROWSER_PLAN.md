# F-20/U-01 R20 Next Actions 브라우저 검증 구현 계획

> **작업자 지침:** 승인된 Anvil WorkInstruction과 단일 `developer-primary` writer를 사용한다. 아래 체크리스트는 R20 구현·검증 경계이며, 승인된 U-01 내부 작업에 별도 진행 승인을 요청하지 않는다.

**목표:** WSL-server 격리 PostgreSQL 15/OIDC 환경에서 R19 Next Actions 카드가 실제 Dashboard API, 저장된 경고, Chromium 화면과 일치하는지 확인한다.

**구조:** 제품 API/UI는 변경하지 않고 기존 R6 opt-in 브라우저 하네스를 확장한다. 합성 운영자에게 기존 `dashboard:read` 권한을 부여해 API의 `next_actions` 행과 저장 경고·화면을 대조하고, 권한 철회 후 `BLOCKED`와 과거 조치 제거를 확인한다. 기존 전체 요청 same-origin/비밀 노출 감사와 상태별 스크린샷 3장은 유지한다.

**기술:** Python pytest/FastAPI/SQLAlchemy, tmpfs PostgreSQL 15, 합성 HTTPS OIDC, Node Playwright/Chromium, Vite 화면.

**근거:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` §6.11, `Anvil_테스트계획서_v1.md` §10.8, R19 Next Actions 결과보고.

## 공통 제약

- 기존 `codex/f18-wsl-ops` 브랜치 하나만 사용한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER` 동안 main 병합·신규 브랜치·ysna-server·Production 작업을 하지 않는다.
- Developer 쓰기 권한은 `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md` 정확히 3개 파일이다. Main은 통제·현황·Git·WSL 자원만 담당한다.
- 제품 route·공개 API·schema·인증 계약·브라우저 UI·Secret·실계정은 바꾸지 않는다. 합성 `dashboard:read`는 테스트 fixture 권한에만 적용한다.
- loopback QA 브라우저 증거는 범위 한정 통합 검증이며 정식 전체 `E-SHOT`/`E-NET`, U-01/F-20 인수, C30 해소가 아니다.
- 로컬 개발→사설 브랜치에 정확한 제품 SHA push→clean WSL-server QA checkout 같은 SHA FF 후 런타임 검증 순서를 지킨다. 키 오류는 제품 실패로 분류하지 않되 미실행 검증을 PASS로 표시하지 않는다.

## 검토 초점

- `dashboard:read` 부재는 빈 조치 목록이 아니라 조회 차단으로 표시되어야 한다.
- 저장 경고가 있으면 API `next_actions`의 우선순위·이유·대상·조치·링크가 저장 경고와 일치하고 카드 텍스트에도 같은 값이 표시되어야 한다.
- 권한 철회 후 카드는 `BLOCKED`를 표시하고 이전 조치 행을 제거해야 한다. Alerts 상태도 별도로 확인한다.
- 잘못된 행이나 비밀 값이 있는 행은 브라우저 증거 성공으로 판정하지 않는다. 기존 R19 단위 테스트와 R6 비밀 감사를 보존한다.
- 전체 페이지 요청 URL이 시험 출처에 머물고 credential 누출이 없어야 한다. loopback 주소는 정식 전체 E-NET 수락 근거가 아니다.

---

### 작업 1: 실제 API·화면 대조

**파일:** `tests/integration/test_f20_u01_oidc_browser_pg15.py`와 `tests/browser/f20-u01-oidc-browser-pg15.mjs` 수정, R20 결과보고서 생성.

**인터페이스:** Python은 `before[0]` 저장 경고에서 도출한 기대 조치 값을 안전한 환경값으로 기존 Node 프로세스에 전달한다. Node는 `GET /api/dashboard/operations`와 기존 `section[aria-labelledby="next-actions-heading"]`를 확인하고, 원본 credential·URL 없이 제한된 boolean/count 사실만 `R6_RESULT`에 추가한다.

- [ ] API 조치 행과 저장 경고/DOM 불일치 및 권한 부재를 거부하는 브라우저 하네스 자기검증 테스트를 먼저 작성하고 `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`에서 구현 부재 RED를 확인한다.
- [ ] 합성 OIDC 운영자 test role에만 `dashboard:read`를 부여한다. 저장 경고가 있을 때 Dashboard 200, 조치 정확히 1건, 경고 필드 일치, 카드의 우선순위·이유·대상·조치 텍스트를 단언한다. 원본 JSON은 표시하지 않는다.
- [ ] 기존 fixture의 role 철회로 `dashboard:read`를 제거한다. Dashboard 403, Next Actions `BLOCKED`, 이전 조치 행 없음, 기존 Critical Alerts 철회 검증 유지를 단언한다. pre-auth/error/BLOCKED 스크린샷·Network 수집을 보존한다.
- [ ] 로컬에서 Node 구문·자기검증과 Python 비 opt-in 집중 테스트, R19 console 전체 테스트·typecheck·lint·build를 실행한다. 정확한 종료 코드를 기록하고 생성한 build 출력만 신원 확인 후 제거한다.

### 작업 2: 동일 SHA WSL-server 격리 브라우저 검증

**파일:** QA 후 R20 결과보고서와 Main 소유 현황·통제 파일만 갱신한다. raw 증거는 통제 allowlist가 허용하는 정확한 경로에서만 보존한다.

**인터페이스:** 기존 R6 opt-in은 `ANVIL_F20_R6_PG_DSN`, `ANVIL_F20_R6_PG_ISOLATED=1`, `ANVIL_F20_R6_FRONTEND_DIST`, `ANVIL_F20_R6_BROWSER_COMMAND_JSON`을 사용한다. 컨테이너 guard는 `anvil-u01-r6-pg-<sha7>`, scope/SHA label, `postgres:15`, AutoRemove, loopback `127.0.0.1:5545`, data tmpfs `rw,size=256m`, bind/volume 0, 비-superuser DB/role `anvil_f20_r3a_<sha7>`을 요구한다.

- [ ] Main은 자원 생성 전 정확한 이름·환경·목적·수명·정리 방법을 `WORK_STATUS`에 기록한다. push된 SHA의 clean QA checkout에서 이름·5545 포트·pytest/TLS/evidence 경로·`node_modules`·`apps/web/dist` 부재를 확인한다.
- [ ] 작업 전용 Node 컨테이너로 화면을 빌드하고 격리 PG15만 시작해 전용 role/DB/migration을 적용한다. 합성 OIDC/Chromium opt-in은 전용 `--rm` 컨테이너, 1920×1080 viewport로 실행하며 진단 drain은 OFF로 둔다.
- [ ] 실제 API/DOM 사실, 스크린샷 3장과 전체 페이지 요청 URL 목록, 비밀 노출 검사, 정확한 SHA·명령 종료 코드를 확인한다. 스크린샷을 육안 대조한다. 첫 실패를 PASS로 바꾸지 말고 원인을 진단한 뒤 제한된 재시도만 수행한다.
- [ ] 전용 container/image/label/mount/port/path 소유권을 확인한 후 해당 PG/browser/node, pytest/TLS/evidence, 생성된 checkout 출력만 정리한다. 잔여0·checkout clean·G-05 PASS를 확인한다. 공유 `/srv`, `anvil-web`, 다른 DB/컨테이너, Production은 건드리지 않는다.
- [ ] R20 결과와 Main 현황·통제 checkpoint를 기존 브랜치에 commit/push하고 WSL QA checkout을 최종 SHA로 FF해 clean/G-05를 확인한 뒤 write→worker lease를 회수한다. U-01/F-20/C30 판정은 유지한다.

## 자체 검토

R20은 R19 Next Actions 부분만 확인한다. 운영 카드 6종, 화면 7상태 전량, 사용자 인수, 정식 전체 E-SHOT/E-NET, ReleaseManifest, rollback은 별도 U-01/F-20 Gate에 남긴다. 파일·자원 경계를 좁혀 공개 계약 변경 없이 검증할 수 있다.
