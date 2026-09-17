# E-01 WorkInstruction — 독립 Reviewer·Tester 역할 계약

## 1. 판정·권위

- ID: WI-E-01-R1-20260917-001. 선행 D Gate ACCEPTED, seq1062.
- 기준 Git: b820867f95d2941e378e5b78e3f31f67ace081b8; branch codex/c09-execution-backends-r1.
- Main의 E-01 구현 지시로 확정. 기능 범위·요구사항·중요 위험 변경 없음, 새 사람 승인 요청 없음.
- 설계 §8.1, §8.2, §39.2, §46.16-6, §48.9, §49.1; 계획 E-01; AV-AGT-030, AV-SAFE-022; 테스트계획 §10.6.
- 제품 구현자 developer-primary-e01-r1. 시작 control은 Main 명시적 위임으로 동일 writer가 작성한다.

## 2. 제품 exact6

- packages/agent_team/__init__.py
- packages/agent_team/role_contracts.py
- packages/agent_team/role_results.py
- tests/agent_team/test_role_contracts_e01.py
- tests/agent_team/test_role_results_e01.py
- docs/04_test_reports/E-01_COMPLETION_REPORT.md

시작 control exact9는 이 파일, E-01_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e01-start.json, docs/evidence/manifests/E-01_START_MANIFEST.json이다. 제품과 control scope를 혼합하지 않는다.

## 3. 필수 계약

1. Reviewer는 repo diff/requirements/quality read-only. 모든 mutation·write/delete/patch를 금지한다.
2. Tester 기본 read-only. 테스트 쓰기는 explicit test_write_grant + canonical test scope + 유효 write lease/fence가 모두 맞을 때만 가능하다. 제품 경로 쓰기와 우회를 거부한다.
3. 기존 PermissionSnapshot/DataEgressProfile/validate_packet narrowing을 재사용한다. child path/action/tool/backend/egress 확대와 parent denial/protection 완화는 fail-closed다.
4. AgentDefinition은 role, read/write/prohibited scope, permission ceiling, budget limits(calls/tokens/cost/duration), result schema, required evidence, persistent_memory=none, immutable version/hash를 갖는다.
5. RoleAssignment은 actor/context/thread/workspace/target/baseline, 구현 actor/context/workspace와의 독립성, parent/effective permission+egress hash, budget, expiry/fence, definition hash를 결박한다. 동일 구현 actor 또는 context 또는 workspace는 독립 검증이 아니다. 다른 모델만으로 독립성을 인정하지 않는다.
6. host가 등록한 current assignment만 권위다. payload self-registration/role spoof/foreign session/stale definition/target/fence를 거부한다.
7. 역할별 result schema 교차 제출을 거부한다. evidence는 target/context/hash에 결박한다. Developer completion report 재인용만으로 Tester PASS는 불가하며 독립 실행 evidence를 요구한다.
8. SKIPPED/BLOCKED/mock/static/build를 실제 PASS로 승격하지 않는다. 결과 제출은 Main acceptance/Release/Apply/Step completion을 자동 생성하지 않는다.
9. reserved human authority(approve/merge/deploy/delete/bypass 등), worker launch/provider/external IO/handoff/DAG/parallel/API/UI는 금지 또는 NOT_EXECUTED다.
10. 기존 permission_snapshot/v1, delegation_packet/v1, subagent_result/v1 및 TeamOrchestrator 호환성을 유지한다.

## 4. 시작 lease

- worker: worker-lease-e01-r1-20260917-001
- execution token: e01-r1-execution-fence-epoch-1-b820867f95d2941e
- write: write-lease-e01-r1-20260917-001
- write token: e01-r1-write-fence-epoch-1-378e5b78e3f31f67
- issued_at: 2026-09-17T08:33:00+09:00
- expires_at: 2026-09-17T20:33:00+09:00
- 두 lease의 제품 path_scope는 §2 exact6만이다. canonical 시작 projection PASS 후에만 제품 mutation을 한다.

## 5. 검증·완료

TDD RED→GREEN. focused 새 두 test, tests/agent_team tests/orchestration 관련 회귀, compileall 제품 exact modules, git diff --check를 실행한다. 테스트 쓰기를 허용하는 DTO는 실제 OS 실행 권한이 아니며 host-only in-memory trust seam 경계를 명시한다. 실제 worker sandbox·Provider/DB/HTTP/UI 실행은 NOT_EXECUTED다.

완료보고는 판정→판단 이유→조치, 기준선/변경/RED-GREEN/정확한 명령·exit·수치/미검증/rollback과 canonical seq/lease 상태를 기록한다. 결과는 COMPLETED|FAILURE_REPORT|INCOMPLETE|BLOCKED|CANCELLED다. Developer evidence는 최종 합격이 아니며 E-01은 사람 또는 구현과 분리된 외부 독립 세션이 검증한다. commit/push, control 외 역사 변경, E-02 이후 구현은 금지한다.
