# F-20/U-01 R24 Dashboard Empty/Error Browser QA Implementation Plan

> **작업자 필수 절차:** 승인된 WorkInstruction과 dual lease 발급 뒤 테스트 우선으로 각 항목을 순차 실행한다. 이 문서는 승인된 U-01의 좁은 QA 계획이며 제품 인수나 새 범위 승인이 아니다.

**목표:** R23에서 검증한 Dashboard의 실제 Chromium 경로에 빈 결과와 조회 오류를 추가해 화면·요청·Network의 정직한 상태 표현을 검증한다.

**구성:** 기존 PG15/OIDC/HTTPS/Chromium opt-in 하네스를 재사용한다. 실제 빈 저장 결과와 테스트 전용 결정론적 요청 실패를 서로 분리해 검증하고, 제품 UI/API/DB 계약은 바꾸지 않는다.

**기술:** Python pytest opt-in, Playwright Chromium, Node 24, PostgreSQL 15, 기존 same-origin BFF.

**근거:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `Anvil_통합검증매트릭스_v1.md` §6.11, `Anvil_테스트계획서_v1.md` §10.8, `docs/04_test_reports/F-20_U01_POST_R20_COVERAGE_REVIEW.md`.

## 공통 제약

- 단일 기존 branch `codex/f18-wsl-ops`만 사용한다. 새 branch, main 병합, Production/ysna-server 작업은 제외한다.
- Local 개발→사설 branch push→WSL-server Git 동일 SHA의 격리 QA 순서를 유지한다.
- C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락을 보존한다.
- 실제 빈 응답과 주입된 오류를 구분한다. 오류 주입은 브라우저 테스트 경계에만 두며 제품 코드로 넣지 않는다.
- 요청·응답·증거에 Secret·내부주소를 노출하지 않고, 임시 자원은 사전 기록·정확한 신원 확인 뒤 정리한다.

## 주요 검토 위험

1. 빈 저장소의 `0건`을 조회 실패에서 재사용하지 않는가 — Task 1의 실 DB 빈 결과와 Task 2의 주입 오류를 각각 단언한다.
2. 인증 전 401을 빈 결과로 해석하지 않는가 — Task 1에서 기존 pre-auth 차단 단언을 유지한다.
3. 오류 본문이나 Secret이 DOM·Network 증거에 남지 않는가 — Task 2에서 화면 텍스트와 전체 요청을 감사한다.
4. 실패한 한 카드가 다른 독립 카드의 관측 결과를 덮어쓰지 않는가 — Task 2에서 카드별 상태를 단언한다.
5. 주입이 정상 저장 alert/revoke 경로에 새지 않는가 — Task 2 뒤 R23 경로를 같은 실행에서 회귀한다.

---

### Task 1: 실제 빈 저장 결과

**파일:** `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, R24 결과보고서.

**입력:** 기존 OIDC session, 빈 Critical Alerts/Next Actions 조회가 가능한 격리 PG15 상태.

**출력:** `emptyCriticalAlerts=true`, `emptyNextActions=true`, `emptyIsObserved=true`의 비밀 없는 QA fact.

- [ ] 빈 DB의 실제 응답을 받았을 때 두 영역만 관측된 `0건`으로 표시하고 pre-auth 401은 `BLOCKED`로 남는 자기검증/pytest 단언을 먼저 작성한다.
- [ ] 자기검증을 실행해 신규 단언의 예상 RED를 확인한다.
- [ ] 기존 브라우저 하네스에 인증 직후·저장 alert 생성 전의 빈 조회 단계를 최소 추가한다.
- [ ] 자기검증·비 opt-in pytest GREEN과 기존 console 전체/typecheck/lint/build를 실행한다.

### Task 2: 결정론적 조회 오류와 독립 카드

**파일:** Task 1과 같은 브라우저/pytest 파일, R24 결과보고서.

**입력:** Task 1의 정상 세션. 테스트 경계에서 한 Dashboard 조회 응답만 결정론적으로 실패시킨다.

**출력:** `errorIsNotZero=true`, `independentCardsPreserved=true`, `errorBodyHidden=true`, `r23Regression=true`의 비밀 없는 QA fact.

- [ ] 오류가 `0건`/`HEALTHY`로 표시되지 않고 다른 독립 카드가 유지되며 원문 본문이 숨겨지는 단언을 먼저 작성한다.
- [ ] 자기검증을 실행해 예상 RED를 확인한다.
- [ ] Playwright route의 정확한 한 요청에만 테스트 전용 오류를 주입하고, 해제·drain을 `finally`에서 보장한다.
- [ ] R23의 loading/키보드/저장 alert→Next Actions→권한 철회 회귀와 same-origin/Secret 감사가 GREEN인지 확인한다.
- [ ] Main 독립 diff·로컬 검증 뒤 동일 SHA를 WSL-server에서 opt-in 실행하고 DOM·API·Network 증거와 전용 자원 잔류 0을 기록한다.

## 자체 검토와 인수 경계

Task 1은 실제 빈 DB를, Task 2는 주입 오류를 증명한다. 둘 모두 PASS하더라도 quota/cancel/reconnect, 필터·새로고침, 운영 카드 공개 read model, 전체 키보드·접근성, 독립 Tester E-SHOT/E-NET/E-API/E-EVT 및 C30은 별도 미충족이다. R24는 U-01 전체 또는 F-20 최종 인수로 승격하지 않는다. 회귀 시 R24 테스트·보고서만 되돌리며 제품·DB 지속 데이터 변경은 없다.
