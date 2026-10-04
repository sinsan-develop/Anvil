# F-20/U-01 R44 Health 상세 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. 이 프로젝트에서는 Main이 단일 Developer의 canonical dual lease와 검증을 관리한다.

**Goal:** Dashboard Health 6종 중 실제 같은 snapshot의 신호·원인·증거가 유일하게 검증된 카드에서만 같은 페이지의 상세 원인으로 이동한다.

**Architecture:** 기존 `GET /api/dashboard/operations`의 health/alerts만 소비한다. 응답의 `detail_path`를 브라우저 이동 URL로 사용하지 않고, 신호와 저장 alert의 component/code/evidence가 같은 snapshot에서 유일하게 결합될 때만 고정 fragment와 읽기 전용 상세를 만든다. 미연결·모호·미검증 상태는 링크 없이 이유를 표시한다.

**Tech Stack:** React/TypeScript console, Node console test, 기존 Python/Chromium OIDC/HTTPS/PG15 opt-in harness.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` §6.11, `Anvil_테스트계획서_v1.md` §10.8.

## Global Constraints

- 기존 `codex/f18-wsl-ops` 브랜치만 사용하고 `main`·다른 브랜치·ysna/Production은 변경하지 않는다.
- 제품 write는 새 canonical worker/write lease를 받은 단일 Developer만 수행한다. Main은 control/Event/progress/HANDOFF/Git을 소유한다.
- 새 공개 API·route·DB/schema·auth/권한·fetch·비용·배포·설계 범위 변경은 하지 않는다. 현재 source가 없는 Health를 정상이나 완료로 표기하지 않는다.
- 브라우저는 same-origin fragment만 이동한다. `detail_path`·evidence hash·원본 secret을 URL에 넣지 않는다.
- 로컬 개발→승인된 private Git push→WSL-server clean 동일 SHA의 격리 PG15/OIDC/HTTPS/Chromium 실제 opt-in→전용 자원만 신원 확인 후 정리한다.
- R44 절편 PASS를 U-01/F-20 전체 인수·PG18·Provider·Production PASS로 승격하지 않는다. ReleaseDecision `DEFER`를 유지한다.

## Review Focus

- source gap, UNKNOWN, loading, 권한 차단, 철회 시 상세 링크·내용이 사라지는가.
- 서로 다른 component 또는 동일 component의 중복 alert가 우연히 결합되지 않는가.
- 위조 `detail_path`의 외부 URL·인코딩·역슬래시·query·fragment가 브라우저 URL이나 DOM에 나타나지 않는가.
- 신호의 상태·관측시각·오류수와 alert의 code/cause/impact/evidence가 정확히 같은 응답에 속하는가.
- 정상 Health에 원인 alert가 없는 것을 거짓 원인으로 표시하지 않고, 과거 alert를 현재 상태로 오인하지 않는가.

## 파일 경계

- Developer exact5: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R44_HEALTH_DETAIL_RESULT.md`.
- Main: 이 계획, WorkInstruction/Invocation, control projection·Event/progress/HANDOFF, `docs/WORK_STATUS.md`, Git/WSL QA.

### Task 1: Health 신호와 원인 결합

- [ ] RED: 여섯 component의 양성 신호와 저장 alert의 정확한 code/source/evidence 결합, 중복·불일치·위조·미연결 음성 사례를 console test에 추가한다.
- [ ] RED 실행: `npm run web:test`에서 신규 단언이 구현 전 실패하고 기존 회귀 원인을 분리한다.
- [ ] 최소 구현: 현재 snapshot의 검증된 Health 신호와 유일한 저장 alert만 detail view model로 만든다. 기존 상태·시각·오류 수 표현과 Next Actions R43 계약은 유지한다.
- [ ] GREEN: `npm run web:test`, Web typecheck/lint/build, `git diff --check`; secret·내부 URL 노출 0을 확인한다.

### Task 2: 실제 카드 클릭과 차단 증거

- [ ] RED: 기존 Chromium harness의 R35 Database `HEALTHY/0` QA 관측은 보존하고, 별도 격리 QA Health 신호 1건으로 실제 저장 Health alert를 만든 뒤 그 카드 상세 클릭→same-page fragment→원인 필드 API↔DOM 일치와 인증 전·철회 후 상세 0을 단언한다. 기존 R43 경고 선택·순서와 R35 Database 증거를 오염시키지 않도록 새 신호의 선택/검증을 독립시킨다. Python 수집은 boolean/count만 받아들인다.
- [ ] GREEN: Node browser audit self-test와 Python 비 opt-in 집중 시험을 통과하고 기존 Network/Secret/PNG 계약을 보존한다.
- [ ] Main 독립 검토 후 정확 제품 SHA를 private push하고 WSL-server clean 동일 SHA·전용 격리 자원에서 PG15/OIDC/HTTPS/Chromium opt-in을 실행한다. 실패는 실패로 기록하고 원인 진단·재검을 분리한다.
- [ ] 전용 PG/container/checkout/venv/evidence/secret/browser 임시 자원만 정확 신원·경로·link 확인 후 제거하고 잔여 0을 확인한다.
- [ ] 결과보고서·WORK_STATUS에 실제 명령/종료코드·변경 파일·검증/미검증·오류횟수·rollback을 기록한다. Main은 write→worker lease 순서로 회수하고 G-05 통과 후 같은 브랜치 checkpoint/private push한다.

## 비범위 및 잔여

Project/Environment/기간 필터, Health 실제 6종 source 생성, 운영 카드 4~6, Critical acknowledge 공개 API/UI, 독립 전체 U-01 acceptance는 이 절편에 포함하지 않는다. 이 기능들의 현재 server 계약 공백은 `docs/WORK_STATUS.md`의 2026-10-05 read-only 조사로 추적한다. R44의 긍정 클릭은 격리 QA에서 실제 저장된 Health alert로 입증하되 이를 전체 운영 Health source 연결로 오인하지 않는다.
