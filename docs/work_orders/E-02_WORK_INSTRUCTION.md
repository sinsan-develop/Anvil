# E-02 WorkInstruction — 구조화 역할 handoff와 증거 전달

## 판정·권위

- WI-E-02-R1-20260917-001; E-01 ACCEPTED, seq1071.
- baseline 99861ccb18fb9555ddbfb6ef8c4c9b79fc46c449; branch codex/c09-execution-backends-r1.
- Main의 승인된 E-02 구현 dispatch. 설계 §46.8·46.16-11·47.18-17·49.10, 계획 E-02, AV-AGT-026/027, AV-FLOW-017, 테스트계획 §10.6.
- writer developer-primary-e02-r1. Main이 시작 control 작성도 위임했다. 새 기능 범위·요구·중요 위험 변경 없음.

## 제품 exact6 / control 분리

- packages/agent_team/__init__.py
- packages/agent_team/handoff.py
- packages/api/role_handoff.py
- tests/agent_team/test_handoff_e02.py
- tests/api/test_role_handoff_e02.py
- docs/04_test_reports/E-02_COMPLETION_REPORT.md

control exact9: 이 WI, E-02_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e02-start.json, docs/evidence/manifests/E-02_START_MANIFEST.json.

## 필수 계약

1. RoleHandoff/v1은 id/version/hash, project/session/run/step/attempt 계보, DEVELOPER_TO_REVIEWER 또는 REVIEWER_TO_TESTER, predecessor id/hash, source result id/hash, sender/recipient assignment id/hash, target+baseline, manifest id/hash+environment/toolchain, bounded summary, artifact id/hash/bytes/media type, issued/expires/fence를 immutable 결박한다.
2. host-only registry가 source result/manifest/artifact metadata를 capture한다. payload self-mint/spoof/foreign/stale 권위를 거부한다.
3. 정상 D→R 뒤 현재 검증된 Reviewer result와 exact predecessor가 있어야 R→T가 가능하다. stage skip/replay/rebind/foreign session-target-context-workspace/fence를 거부한다.
4. Manifest target/delivered, environment/toolchain 및 raw checksum/target/environment를 actual artifact metadata+bytes와 대조한다. 누락·hash/size/media drift·alias mutation은 fail-closed다.
5. 기본 projection은 bounded summary와 immutable ref만 반환하고 raw transcript/stdout/stderr/body/content/log 본문과 무제한 context 합류를 금지한다.
6. explicit resolve는 current recipient authority, membership, target/manifest/hash/bytes/media를 재검증한 exact bytes만 반환한다. 임의 path/URL/foreign/missing ref/traversal은 거부한다.
7. 동일 요청은 동일 receipt, 동일 key 다른 payload는 conflict다. 실패 시 partial handoff를 남기지 않는다.
8. Developer report 또는 mock/fixture/static/build/SKIPPED/BLOCKED를 Tester 독립 PASS로 승격하지 않는다. 전달과 검증을 구분하고 Main acceptance/Step completion/Release/Apply/worker 실행은 자동 생성하지 않는다.
9. 실제 HTTP wiring/U-05 UI/Provider/DB/network/DAG/parallel은 NOT_EXECUTED/NOT_INTEGRATED다.
10. 기존 schemas/APIs를 유지한다. 실제 정보 없는 mandatory manifest field에 임의 hash를 넣지 않으며 입력 거부 또는 honest unverified/block으로 처리한다.

정본은 packages.artifacts.evidence.EvidenceManifest/RawArtifactChecksum이다. ArtifactStore/metadata 검사, ResultEnvelope/EvidenceReference/validate_result, lifecycle raw artifact, E-01 current assignment/result validators를 재사용한다. packages.verification.gates.EvidenceManifest는 변경·통합·seal 발급하지 않는다. 실제 artifact 저장소 연결 대신 주입된 adapter의 계약을 시험한다.

## dual lease

- worker worker-lease-e02-r1-20260917-001 / execution e02-r1-execution-fence-epoch-1-99861ccb18fb9555
- write write-lease-e02-r1-20260917-001 / write token e02-r1-write-fence-epoch-1-ddbfb6ef8c4c9b79
- issued 2026-09-17T09:36:00+09:00; expires 2026-09-17T21:36:00+09:00.
- path_scope는 제품 exact6. 시작 seq1072~1075 checker PASS 후 제품 mutation한다.

## 검증·보고

10개 경계 TDD RED→GREEN, 신규 focused 두 파일, tests/agent_team tests/orchestration tests/artifacts 및 관련 API, compileall exact modules/tests/control, git diff --check. 판정→이유→조치 형식으로 기준선/변경/정확한 명령·exit·수치/RED-GREEN/미검증/rollback을 보고한다. COMPLETED는 Developer evidence이며 최종 합격이 아니다. E-02는 사람 또는 외부 독립 세션이 검증한다. 같은 유효 실패 3회 규칙을 유지한다. commit/push/E-03/제품 외 변경·외부 실행을 금지한다.
