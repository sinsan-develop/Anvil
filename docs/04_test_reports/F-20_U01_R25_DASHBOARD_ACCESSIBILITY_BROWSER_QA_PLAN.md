# F-20/U-01 R25 Dashboard 접근성 브라우저 QA Implementation Plan

> **작업자 필수 절차:** 승인된 WorkInstruction과 ACTIVE dual lease가 발급된 뒤 테스트 우선으로 순차 실행한다. R25는 기존 U-01 범위의 좁은 QA이며 메뉴 인수나 새 기능 승인이 아니다.

**Goal:** 현재 연결된 Dashboard 카드의 인증 전·로딩·빈 결과·오류·저장·철회 흐름에서 키보드와 상태 안내가 실제 Chromium에 정직하게 나타나는지 검증한다.

**Architecture:** 기존 PG15/OIDC/HTTPS/Chromium opt-in 하네스에 접근성 관측만 추가한다. 제품·공개 API·DB·권한 계약은 바꾸지 않으며 실패 시 실제 결함을 보고하고 R25 테스트를 느슨하게 만들지 않는다.

**Tech Stack:** Node 24, Playwright Chromium 1.62.1, pytest, 기존 PostgreSQL 15 격리 QA.

**Spec:** `Anvil_설계서_v2.md` §29.1~29.2, `Anvil_작업계획서_v1.md` U-01, `Anvil_통합검증매트릭스_v1.md` §6.11, `Anvil_테스트계획서_v1.md` §10.8, `docs/04_test_reports/F-20_U01_POST_R20_COVERAGE_REVIEW.md`.

## Global Constraints

- 단일 기존 branch `codex/f18-wsl-ops`; 새 branch·main 병합 금지. Local 개발→사설 Git push→WSL-server의 같은 clean SHA에서만 실제 QA를 판정한다.
- C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락, Production `NOT_EXECUTED`를 유지한다.
- 브라우저는 same-origin 상대 경로만 호출하고 Secret·내부 주소·오류 본문을 DOM·로그·증거에 남기지 않는다.
- 임시 QA 자원은 생성 전 경계와 정리 방법을 `WORK_STATUS`에 기록하고, 사용 뒤 정확한 신원·실경로를 확인해 잔류 0으로 닫는다.
- 단지 자동 테스트의 PASS를 독립 Tester의 E-SHOT/E-NET/E-API/E-EVT 또는 전체 7상태 인수로 승격하지 않는다.

## Review Focus

1. 인증 전 401: 보호 카드가 빈 0건/성공으로 보이거나 저장 내용이 노출되지 않아야 한다 — Task 1 브라우저 상태·본문 단언.
2. 로딩 중 키보드: sidebar toggle의 Tab/Enter와 포커스가 상태 갱신 중에도 유지되어야 한다 — Task 1 전후 포커스 단언.
3. 빈 결과와 503 오류: 스크린리더용 `aria-live` 상태가 두 결과를 구분하고 오류 본문이 보이지 않아야 한다 — Task 2 카드별 DOM 단언.
4. 독립 카드: 한 Dashboard 실패가 Provider/Alerts의 관측 상태를 덮어쓰지 않아야 한다 — Task 2 기존 R24 오류 단계 회귀.
5. 권한 철회: 403 이후 저장 Alert/Next Actions 행이 남거나 키보드로 접근되지 않아야 한다 — Task 2 revoke DOM·focus 단언.

---

### Task 1: 인증 전·초기 로딩 키보드/상태 안내

**Files:**
- Modify: `tests/browser/f20-u01-oidc-browser-pg15.mjs`
- Modify: `tests/integration/test_f20_u01_oidc_browser_pg15.py`
- Modify: `docs/04_test_reports/F-20_U01_R25_DASHBOARD_ACCESSIBILITY_BROWSER_QA_RESULT.md`

**Interfaces:** 기존 하네스의 `--audit-self-test` 및 opt-in fact 계약을 확장하되 기존 R23/R24 fact 이름과 의미는 보존한다. 새 fact는 boolean `r25PreAuthAccessible`, `r25LoadingKeyboardStable` 둘만 허용한다.

- [ ] 기존 하네스의 인증 전/초기 요청 보류 stage에 두 fact의 실패 단언과 Python whitelist 검사를 먼저 추가한다.
- [ ] `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`와 focused pytest가 새 단언 때문에 예상 RED인지 확인한다.
- [ ] 보호 카드의 `aria-live`/BLOCKED·본문 비노출, sidebar Tab/Enter 전후 focus·expanded 상태를 기존 실제 browser flow에 최소 추가한다. selector·문구는 실제 DOM을 기준으로 한다.
- [ ] 자기검증·비 opt-in pytest를 다시 실행해 GREEN을 확인한다.

### Task 2: 빈 결과·오류·저장/철회 접근성 회귀

**Files:** Task 1과 같은 정확3파일.

**Interfaces:** Task 1의 기존 flow를 이어 사용한다. 새 fact는 boolean `r25EmptyErrorDistinct`, `r25RevokedRowsInaccessible` 둘만 허용한다.

- [ ] 빈 0건·한 Dashboard GET 503·저장·revoke stage의 `aria-live`/행 제거/비밀 본문 거부 단언과 Python whitelist 검사를 먼저 추가한다.
- [ ] 자기검증과 focused pytest에서 신규 단언의 예상 RED를 확인한다.
- [ ] 기존 R23/R24의 실제 API·DB·DOM·Network 검사, 한 요청 오류 주입과 `finally` 해제, same-origin/Secret 감사를 유지한 채 접근성 관측을 구현한다. 403 뒤 stale 행의 focusable descendant가 0인지 확인한다.
- [ ] 자기검증·비 opt-in pytest·console 전체/typecheck/lint/build·G-05·diff check를 실행하고 exact3 diff 및 미검증을 결과보고서에 기록한다.
- [ ] Main이 exact3 독립 검토→같은 branch commit/private push→WSL-server clean 동일 SHA 격리 PG15/OIDC/Chromium opt-in을 수행하고 PNG/Network·임시 자원 잔여 0을 확인한다.

## 자체 검토와 인수 경계

R25가 PASS해도 Project/Environment/기간 필터·새로고침 시각, 운영 상태 공개 read model, quota/cancel/reconnect 실데이터, 전 화면 접근성 및 정식 독립 Tester 증거는 별도 미충족이다. 제품 결함 발견 시 테스트 기대값을 변경해 PASS시키지 않고 Main에게 사실·영향을 보고해 승인된 범위의 별도 제품 WorkInstruction으로 분리한다. rollback은 R25 exact3 테스트·보고서만 정상 Git revert하며 원장 과거 원문·제품·지속 DB는 수정하지 않는다.
