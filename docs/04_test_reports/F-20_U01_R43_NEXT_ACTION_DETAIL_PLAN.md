# F-20/U-01 R43 Next Actions 상세 원인 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Anvil의 단일 `developer-primary` dual-lease·Main 통제 규칙이 우선한다.

**Goal:** Dashboard의 Next Actions 이동 버튼이 실제로 확인된 상세 원인으로만 이동하고, 미연결 메뉴 placeholder로 향하지 않게 한다.

**Architecture:** 기존 `/api/dashboard/operations`의 동일 응답에 있는 action과 alert를 현재 엄격 파서 기준으로 유일하게 대응시킨다. 유효한 alert의 code/source/impact/발생시각/evidence hash를 Dashboard 안의 읽기 전용 상세 대상으로 투영하고, 버튼은 same-page fragment로 그 대상으로 이동한다. 대응이 없거나 모호하면 링크를 만들지 않고 확인 불가를 표시한다. 공개 API·DB·권한·라우트는 변경하지 않는다.

**Tech Stack:** React/TypeScript, Node test, 기존 Python/Playwright/OIDC/격리 PostgreSQL 15 브라우저 하네스.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` §6.11, `Anvil_테스트계획서_v1.md` §10.8.

## Global Constraints

- 현재 `codex/f18-wsl-ops` 하나만 유지한다. 준비 기준 clean/private HEAD `bda78f11`, G-05 seq2060, worker/write lease null, C30 `RECOVERED_WITH_QUARANTINED_HISTORY`이나 수락 false, Release `DEFER`다.
- Main은 계획·WorkInstruction·canonical lease/Event/progress/HANDOFF/Git/WSL QA를 맡고, Developer는 유효한 두 fencing token으로 exact5만 단독 수정한다.
- Developer exact5: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R43_NEXT_ACTION_DETAIL_RESULT.md`.
- 기존 `deep_link` 필드는 API 계약대로 검증·보존하지만 미구현 메뉴로 연결하지 않는다. 새 fetch, 공개 API 필드, alert 확인 쓰기, 인증 우회, demo 데이터는 추가하지 않는다.
- Windows local 개발→기존 private branch 정확 SHA push→WSL-server clean 동일 SHA에서 격리 PG15/OIDC/HTTPS/Chromium 검증→전용 자원 신원 확인·정리 순서를 지킨다. ysna-server/Production과 main 병합·신규 branch는 범위 밖이다.
- browser/network 증거의 PASS는 R43 절편 한정이며 U-01/F-20 전체 인수·정식 전체 E-SHOT/E-NET·PG18·Provider 실측으로 승격하지 않는다.

## Review Focus

- 동일 action에 alert 후보가 둘이거나 action 자체가 중복되면 둘 다 상세 링크가 없어야 한다. Task 1의 모호성 음성 테스트로 고정한다.
- alert의 필드 누락·시각 오류·미래 snapshot이면 과거 alert 정보를 원인처럼 보여주지 않아야 한다. Task 1의 파서 음성 테스트로 고정한다.
- 외부 URL·query/fragment·미구현 메뉴 deep link는 브라우저 이동 대상이 될 수 없다. Task 1의 링크 테스트로 고정한다.
- 인증 전·권한 철회 후에는 이전 상세 내용과 fragment 목적지가 남지 않아야 한다. Task 2의 실제 DOM/Network 테스트로 고정한다.
- 상세 정보는 같은 응답의 검증된 경고만 표시하고 다른 alert 페이지나 새 요청과 섞이지 않아야 한다. Task 2의 API/DOM 일치 테스트로 고정한다.

---

### Task 1: 같은 Dashboard snapshot의 상세 원인 대상으로 이동

**Files:**
- Modify: `apps/web/src/console/App.tsx` (`dashboardNextActions`, `NextActionsCard`)
- Test: `apps/web/tests/f15-console.test.mjs`

**Interfaces:**
- Consumes: 현재 `NextAction`/`ALERT_FIELDS`, `dashboardNextActions(value, alerts, snapshotTime)`와 `DashboardQueueState`.
- Produces: `NextActionRow.detail`은 유일하게 검증된 alert의 code/source/impact/observedAt/evidenceHash 또는 `null`; `NextActionsCard`는 detail이 있는 행에만 `#next-action-detail-N` 내부 링크와 같은 id의 읽기 전용 상세를 제공한다.

- [ ] **Step 1: 실패 테스트 작성.** 유일한 동일 응답 alert에서는 조치와 별개로 상세 원인 내부 링크와 code/source/impact/발생시각/evidence hash가 나타나고, `/operations` 같은 placeholder 링크는 나타나지 않는다고 단언한다. 후보 0·2, 중복 action, malformed alert, 미래 snapshot, 외부/query/미지 deep link는 상세 링크가 없고 확인 불가라고 단언한다. HTML escaping과 기존 경과시간/다른 카드 불변도 확인한다.
- [ ] **Step 2: RED 확인.** `node --test apps/web/tests/f15-console.test.mjs`에서 신규 상세 단언이 예상 실패하고 기존 테스트가 계속 실행됨을 기록한다.
- [ ] **Step 3: 최소 구현.** `dashboardNextActions`의 기존 유일·유효 후보 판단을 재사용해 `detail`만 투영한다. `NextActionsCard`는 동일 카드 내 고유 ordinal fragment 링크와 실제 상세 요소를 렌더링하며, detail null이면 링크 없이 확인 불가를 보인다. `safeMenuLink`가 다른 소비자가 없다면 제거한다. 새 HTTP 요청/route/state mutation은 만들지 않는다.
- [ ] **Step 4: GREEN·회귀.** `node --test apps/web/tests/f15-console.test.mjs`, Web typecheck/lint/build, G-05와 diff check를 실행한다. 새 상세 렌더링 때문에 기존 알려진-menu href 기대 테스트가 깨지면 정상 요구와 구별해 새 실제 상세 계약으로만 갱신한다.

### Task 2: 실제 Chromium 이동·차단 증거

**Files:**
- Modify: `tests/browser/f20-u01-oidc-browser-pg15.mjs`
- Modify: `tests/integration/test_f20_u01_oidc_browser_pg15.py`
- Modify: `docs/04_test_reports/F-20_U01_R43_NEXT_ACTION_DETAIL_RESULT.md`

**Interfaces:**
- Consumes: Task 1의 `#next-action-detail-N` DOM 및 기존 R6 저장 alert/Next Actions/API/권한 철회 harness.
- Produces: 원본 alert·비밀을 내보내지 않는 boolean/count 중심 R43 브라우저 증거와 테스트 결과.

- [ ] **Step 1: 실패 브라우저 단언 작성.** 저장 alert를 가진 Dashboard에서 Next Action의 내부 링크를 실제 클릭해 URL이 same-origin Dashboard fragment이고 대응 상세 code/source/impact/evidence가 같은 저장 alert와 일치하는지 확인한다. 미구현 `/operations`로 이동하지 않으며, 인증 전·철회 후 상세와 링크가 없음을 확인한다.
- [ ] **Step 2: RED 확인.** 기존 Node browser self-test 및 Python 비 opt-in 집중 시험으로 R43 신규 단언의 구현 전 실패를 기록한다.
- [ ] **Step 3: browser harness 최소 구현·GREEN.** 기존 R6/ R20~R42 Network·Secret·상태별 PNG와 요청 목록 증거는 보존하고 R43 boolean/count만 추가한다. Node self-test, Python 비 opt-in, G-05, diff check를 실행한다.
- [ ] **Step 4: Main 독립 검증·checkpoint.** 단일 writer exact5 diff·로컬 결과를 Main이 검토하고 필요한 수정은 같은 writer에게만 되돌린다. 정확 파일을 기존 branch에 commit/private push한 뒤 WSL-server clean 동일 SHA에서 격리 PG15/OIDC/HTTPS/Chromium opt-in과 PNG·Network를 검증한다. 전용 프로세스·DB/container·checkout·evidence를 식별해 제거하고 잔여0을 기록한다.
- [ ] **Step 5: 통제 종료.** Main은 결과보고서·WORK_STATUS, G-05, Event seq/dual lease 회수, private checkpoint를 완료한다. R43만 좁게 완료하고 U-01/F-20은 미수락·Release `DEFER`로 유지한다.

## Self-Review

- §29.2의 클릭 후 상세 원인과 Next Actions 필드는 Task 1, 실제 클릭·Network·차단은 Task 2에 배정했다. 필터·Health 6종·Critical 확인·독립 전체 인수는 이 절편 밖의 U-01 잔여 작업으로 명시한다.
- 제품 파일 4개와 결과보고서 1개의 책임은 분리되어 있고 Task 2는 Task 1의 DOM 계약만 소비한다.
- 공개 API·DB·권한·라우트 변경 없이 현재 응답의 검증된 사실만 보여준다. detail을 만들 수 없으면 미구현 목적지로 보내지 않는다.
