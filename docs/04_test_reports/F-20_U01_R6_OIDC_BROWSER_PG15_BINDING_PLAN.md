# F-20/U-01 R6 — OIDC·브라우저·저장 경고 통합 검증 Implementation Plan (DRAFT)

> 실행 담당자는 정식 R6 WorkInstruction·epoch18 dual lease·G-05 PASS 뒤 이 계획의 단일 테스트 작업을 RED→GREEN으로 수행한다.

**Goal:** 격리 WSL-server에서 동일 Chromium context의 OIDC 인증 쿠키로 실제 PostgreSQL 15 저장 Critical Alert를 Dashboard에서 읽고, 권한 철회 때 보호 데이터를 지우는 흐름을 검증한다.

**Architecture:** 기존 OIDC ASGI factory에 격리 PG15의 `OperationsService`와 빌드된 `apps/web/dist`를 주입해 같은 HTTPS origin에서 API와 UI를 제공한다. 임시 HTTPS IdP는 기존 테스트의 인증 흐름만 합성하고, Playwright가 한 context에서 authorization/callback·cookie·화면 조회를 이어간다. 제품 endpoint·role 계약·DB migration은 변경하지 않는다.

**Tech Stack:** Python pytest/FastAPI/uvicorn/SQLAlchemy/psycopg, PostgreSQL 15 migration `0019_oidc_sessions`, Vite React build, Node 22/Playwright 1.62.1 Chromium.

**Spec:** `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_설계서_v2.md` §29.2, `Anvil_통합검증매트릭스_v1.md` U-01, 현 R5 결과보고서.

## Global Constraints

- 기존 `codex/f18-wsl-ops` 브랜치만 사용한다. 새 브랜치·main 병합·ysna-server/Production은 제외한다.
- 로컬에서 테스트 코드를 작성·검증하고 private Git push 후 `ssh WSL-server`의 clean 격리 checkout에서 exact SHA를 받는다.
- 기존 공개 API·권한/role·DB schema/migration·제품 UI/서비스 동작은 변경하지 않는다. synthetic 인증 자료는 격리 시험에서만 쓴다.
- R5 epoch17 write→worker를 순서대로 회수하고 epoch18 exact3가 유효하기 전 제품 테스트 파일을 쓰지 않는다.
- WSL 일회성 container/DB/role/port/path는 생성 전에 이름·소유·수명·정리법을 `WORK_STATUS`에 기록하고, 완료·실패 모두 지정 자원만 제거해 잔류0을 확인한다.
- 격리 E2E PASS는 정식 WSL entity/checkout, 로그인 화면 클릭, 사용자 인수, U-01/F-20 완료나 C30 사고 해소를 뜻하지 않는다.

## Review Focus

- 인증 전 저장 Alert GET은 401이며 화면에 보호 기록이 남지 않는다.
- 동일 context에서 callback 뒤 HttpOnly/Secure session cookie가 설정되고 저장 Alert가 API와 화면에 일치한다.
- 권한 철회 후 GET 403 및 재표시에서 이전 Critical text가 남지 않는다.
- 브라우저의 앱 API 요청은 same-origin 상대 경로이고 DB DSN·token·fencing 값이 응답/화면에 누출되지 않는다.
- HTTPS IdP/API listener, PG container/DB/role, Playwright container, build/temp path는 실패 시에도 지정 대상만 정리된다.

## Task 1: 기존 계약을 연결한 격리 E2E

**Files:**
- Create: `tests/integration/test_f20_u01_oidc_browser_pg15.py` — opt-in 대상 검증, PG seed/alert, synthetic HTTPS OIDC/API host, Node 검사 호출 및 cleanup.
- Create: `tests/browser/f20-u01-oidc-browser-pg15.mjs` — 단일 Playwright context 인증→Dashboard→권한 철회/Network 증거.
- Create: `docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_RESULT.md` — 명령·exit·실측·미검증·rollback.

**Interfaces:** Python 테스트는 WSL 격리 DSN와 opt-in marker를 환경에서 받아 기존 R3a PG15 guard와 같은 범위만 허용한다. Node 스크립트는 synthetic HTTPS API/IdP URL, CA 경로, test alert code, 검사 완료 후 권한 철회 signal을 시험 프로세스에서 전달받되 Secret 원문을 출력하지 않는다. 임시 서버 시작·정리 소유권은 Python 테스트 하나에 둔다.

- [ ] **Step 1: 실패하는 통합 계약 검사 작성.** 인증 전 401, callback 이후 session+저장 Alert+화면, 403 이후 보호 text 제거, same-origin/비밀 비노출을 명시한다. 로컬에서는 opt-in 부재가 명시적 SKIP이고 WSL 전용 대상 없이 PASS라고 쓰지 않는다.
- [ ] **Step 2: RED 확인.** 명시한 실제 테스트/브라우저 경로가 구현 전 예상 원인으로 실패하는 것을 실행 출력으로 기록한다.
- [ ] **Step 3: 기존 factory와 fixture를 재사용해 최소 harness 구현.** `tests/api/test_oidc_asgi_binding.py`의 PG preflight/seed 및 `tests/integration/f18_oidc_live_host.py`의 인증서/listener 패턴을 참조한다. 새 public route/권한/schema는 만들지 않는다.
- [ ] **Step 4: 로컬 GREEN과 인접 회귀.** Python syntax/test opt-in skip, Node syntax, 기존 R3a PG 테스트·R5 Node 테스트·G-05 및 diff를 실행한 범위대로 보고한다.
- [ ] **Step 5: Main 독립 검토 후 exact3만 commit/push.** WSL-server에서 같은 SHA·clean을 확인한다.
- [ ] **Step 6: 사전 기록된 일회성 PG15/브라우저/빌드 자원으로 실제 통합 E2E 실행.** migration head, role, 실제 request/response/DOM/Network, WSL 실행 SHA를 확인한다.
- [ ] **Step 7: 지정 자원만 정리하고 잔류0·postclean G-05를 확인해 결과보고서와 현황을 마감한다.**

## 판정 경계

이 작업의 합격은 격리 E2E 검증의 합격뿐이다. R6 뒤에도 Dashboard의 다른 Health/Next Actions/ack, 정식 WSL 검증, U-01/F-20 독립 수락과 C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`는 별도 상태다.
