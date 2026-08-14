# B-03 R2 WorkInstruction — actual local design-flow verification bridge

- artifact_id: `WI-B-03-20260814-002`
- package/status: `B-03 / REWORK_IN_PROGRESS`
- executor: `developer-primary-b03`
- baseline_git_commit: `f9fbf64f2f6f135050b69afe47e6bed3aabeea3b`
- source_tester_report: `docs/test_reports/B-03_INDEPENDENT_TEST_REPORT.md`
- source_tester_report_sha256: `F55282DD30362AB1D76580442932D910C899CB771BFBC4DF1708C7F4F0AF474D`
- blocked_classification: `VERIFICATION_ENVIRONMENT_GAP / NOT_VALID_FAILURE`
- valid_failure_count: `0`
- assigned: `AV-FLOW-001`
- environment: `ENV-LOCAL / LOCAL_ONLY`

## 판정 → 판단 이유 → 조치

**판정: 좁은 R2 runtime-evidence 보완.** B-03 R1의 domain/repository/API contract에 제품 결함은 없지만, B-03에 이미 배정된 CRITICAL `AV-FLOW-001`의 실제 L4+L7 `E-SHOT`·`E-EVT`가 미실행되어 Tester가 `BLOCKED`로 판정했다.

**판단 이유:** 기존 B-03 WorkInstruction은 실제 local UI/API 흐름을 완료 조건으로 명시했다. 따라서 실행 가능한 local-only verification bridge 제공은 새 기능·요구·중요 위험이 아니라 승인 범위 안의 내부 구현 순서 보완이다. 기존 `apps/web`의 same-origin local server 경계를 재사용하되, A-14 Workbench와 분리된 design-flow route가 실제 B-03 `DesignLineageService`를 호출해야 한다. fixture·mock·정적 화면만으로 PASS를 만들 수 없다.

**조치:** 모호한 intent → 복수 proposal → 인증된 사람 decision → specification/baseline의 실제 흐름과, 결정 전 baseline 생성 거부를 브라우저와 API에서 실행한다. 정상·오류·BLOCKED 3종 screenshot과 actor/type/UTC/id가 포함된 실제 event sequence를 고정한다.

## 구현·안전 경계

- 기존 B-03 R1 15-path 및 Tester report는 byte-frozen이다.
- `apps/web/server.mjs`의 기존 Host/Origin/CSRF/same-origin 보호를 재사용한다. 기존 A-14 Workbench 동작은 유지한다.
- 새 UI는 별도 `/design-flow` local route로 둔다. 브라우저 코드는 same-origin 상대 경로만 호출한다.
- API bridge는 실제 `packages.design.service.DesignLineageService`를 호출하고, 응답의 상태와 audit events를 UI에 전달한다. test-only fixture나 JS 재구현으로 대체하지 않는다.
- 인증된 사람 decision 전 baseline/실행 요청은 거부되고 화면에 BLOCKED로 표시되어야 한다.
- E-SHOT은 정상·오류·BLOCKED 최소 3종, E-EVT는 event id/type/UTC/actor 및 순서를 포함한다.
- B-11의 canonical route registry, SSE, production auth middleware, 공개 API 확정, 운영 배포는 구현하거나 완료로 주장하지 않는다. 이 bridge는 `LOCAL_VERIFICATION_ONLY`다.
- 실제 shared/WSL/production DB, provider, 외부 API, production, deploy, server direct patch는 금지한다.

## Developer exact file-level write allowlist (15)

- `apps/web/server.mjs`
- `apps/web/design-flow.html`
- `apps/web/src/api/design-flow-client.js`
- `apps/web/src/app/design-flow.js`
- `apps/web/src/styles/design-flow.css`
- `packages/api/design_runtime.py`
- `tests/browser/b03/design-flow-runtime.test.mjs`
- `tests/design/test_runtime_bridge.py`
- `docs/evidence/runtime/B-03_FLOW_NORMAL.png`
- `docs/evidence/runtime/B-03_FLOW_ERROR.png`
- `docs/evidence/runtime/B-03_FLOW_BLOCKED.png`
- `docs/evidence/runtime/B-03_FLOW_EVENT_SEQUENCE.json`
- `docs/validation/B-03_DESIGN_LINEAGE_VALIDATION_R2.md`
- `docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R2.json`
- `docs/completion_reports/B-03_COMPLETION_REPORT_R2.md`

그 밖의 authority, progress/HANDOFF, B-03 R1 산출물, Tester report, B-04, dependency/config, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline, report hash, epoch-2 worker/write fencing token과 exact 15-path를 검증한다.
2. 실제 service가 없는 응답, 단일 proposal, 미인증 decision, decision 전 baseline 열림, same-origin 위반, screenshot/event 누락을 먼저 RED로 고정한다.
3. 최소 bridge 구현 후 browser actual flow, design/domain/persistence 회귀, 기존 tooling을 실행한다.
4. E-SHOT 3종과 E-EVT를 동일 target EvidenceManifest에 결박하고 실제 실행 명령·exit code를 기록한다.
5. actual browser/API가 실행되지 않으면 `BLOCKED`/`NOT_EXECUTED`를 유지하며 PASS로 승격하지 않는다.
6. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-03 acceptance와 B-04 시작은 금지한다.
