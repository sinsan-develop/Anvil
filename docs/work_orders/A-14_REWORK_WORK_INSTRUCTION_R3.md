# A-14 Revision 3 Rework WorkInstruction

- artifact_id: `WI-A-14-20260813-003`
- package: `A-14`
- owner: `developer-primary-a14`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`
- status: `ACTIVE / REWORK_IN_PROGRESS / RETEST_REQUIRED`
- source report: `docs/test_reports/A-14_RETEST_REPORT_R3.md`
- source SHA-256: `D40A0FA0A64CF7FDA8DFBEF5605A3434941464614FD0BB3D3838385B00A30C69`
- baseline HEAD / upstream: `4d6b813af82047df40d1487ac011f6a542513713`
- worker epoch: `3`
- write epoch: `3`

## 목적과 고정 판정

독립 Tester R3의 유효 `FAILURE_REPORT / REWORK_REQUIRED`만 수정한다. 기능 범위·요구사항·중요 위험은 변경하지 않는다. `BLK-A14-001`은 `CLOSED`; `BLK-A14-002`는 `REOPENED CRITICAL`; stale scan/evidence/provider selection과 실제 `EMPTY/QUOTA/CANCEL/RECONNECT` 도달 부재는 각각 `MAJOR`로 유지한다. 사용자 WSL handoff는 Main evidence-only baseline이며 Developer가 수정하지 않는다.

## 수정 요구사항

1. 현재 committed seq161의 A-13 successor raw bytes/hash가 clean checkout에서 재현되도록 phase-aware successor selection을 고치고 targeted A-13+A-14 `26/26`을 복구한다.
2. fixture 선택 변경과 `BLOCKED/ERROR/PERMISSION_DENIED` 전이 시 이전 scan/result/evidence/provider selection을 초기화한다.
3. `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT`를 실제 UI interaction으로 도달 가능한 fixture/action route로 구현한다. fixture/mock는 production·실제 Provider PASS가 아니다.
4. browser fetch는 same-origin 상대 `/api/...`만 유지하고 secret/raw stack/server path/internal address를 노출하지 않는다.
5. 1920×1080 Codex in-app browser에서 상태 전이, Network, console, same-origin, hostile input을 실제 재검증하고 증거를 completion/validation/R3 manifest에 기록한다.

## Developer write lease exact paths

- `apps/web/src/app/workbench.js`
- `apps/web/src/features/workbench/workbench-state.js`
- `apps/web/tests/workbench.test.mjs`
- `tests/browser/a14/workbench-runtime.test.mjs`
- `tests/fixtures/a14/workbench-fixtures.json`
- `scripts/check_a13_repository_scan.py`
- `tests/tooling/test_a13_repository_scan.py`
- `scripts/check_a14_workbench_prototype.py`
- `tests/tooling/test_a14_workbench_prototype.py`
- `docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json`
- `docs/architecture/a14/A-14_WORKBENCH_PROTOTYPE.md`
- `docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json`
- `docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md`
- `docs/completion_reports/A-14_COMPLETION_REPORT.md`

## 불변·금지 경계

- 기존 A-14 product 17 paths 중 위 exact paths 밖의 파일은 수정하지 않는다.
- `docs/test_reports/A-14_RETEST_REPORT_R3.md`와 `docs/progress/WSL_ENVIRONMENT_MIGRATION_HANDOFF_2026-08-12.md`는 Main evidence-only이며 Developer write 금지다.
- accepted authority, A-01~A-13 product/evidence, `packages/repository_intelligence/**`, G-06 fixture, progress/events/HANDOFF/ledger, 관련 없는 파일은 수정하지 않는다.
- commit, push, deploy, DIR, A-14 acceptance, A-15 시작을 수행하지 않는다.

## TDD와 완료 증거

각 finding을 재현하는 RED를 먼저 확인하고 최소 구현으로 GREEN을 만든다. 정확한 명령·exit code·실제 결과, 변경 파일/diff, 미실행·SKIPPED·BLOCKED, browser/API/fixture 경계, 기존 기능 유지, 잔여 위험, rollback을 보고한다. full tooling은 Developer 수정 전 expected RED를 출발점으로 인정하지만 제출 시 project/G-07/Phase G/A-13/A-14와 전체 회귀를 fresh 실행하고 결과를 정직하게 기록한다.
