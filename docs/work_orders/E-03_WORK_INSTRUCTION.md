# E-03 WorkInstruction — 수동 외부 검증 bundle

## 권위·기준선

- WI-E-03-R1-20260917-001, writer developer-primary-e03-r1.
- Main의 E-03 구현 및 start-control 위임. 선행 E-01/E-02 ACCEPTED, seq1080.
- clean baseline c9678884d8e44a53fc4ab7c070a2c84f29c4e481, branch codex/c09-execution-backends-r1.
- local/upstream 일치. remote는 Main의 `git ls-remote development refs/heads/codex/c09-execution-backends-r1` exit0 exact SHA 확인, source MAIN_LIVE_REMOTE_READ. worker 직접 remote 확인은 SSH alias DNS 제한으로 미실행이며 drift가 아니다.
- 계획 E-03; 설계 §46.8, §46.16-11, §47.15, §47.18-16/17/19; AV-AGT-002, AV-AGT-027, AV-OPS-011 전량; 테스트계획 §10.6 및 R-02 CRITICAL 원문 인용.

## 제품 exact6

- packages/agent_team/__init__.py
- packages/agent_team/external_verifier.py
- packages/api/external_verification.py
- tests/agent_team/test_external_verifier_e03.py
- tests/api/test_external_verification_e03.py
- docs/04_test_reports/E-03_COMPLETION_REPORT.md

control exact9: 본 WI, E-03_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e03-start.json, docs/evidence/manifests/E-03_START_MANIFEST.json. 시작+제품 최대 exact15, 다른 파일 변경 금지.

## 필수 계약·구현 경계

1. 기존 E-01 current assignment/result와 E-02 handoff/EvidenceManifest/explicit resolve를 재사용한다. 기존 packet/result/permission/evidence/resume 계약 및 owner schema 불변.
2. ExternalVerifierAdapter는 수동 copy/export/import bytes 계약이다. 실제 Claude/API 연결·자동 전송·worker/OS 실행·DB·HTTP wiring·UI·DAG/parallel·Git mutation 없음.
3. export는 current handoff authority, target/baseline/environment/toolchain 및 artifact refs/실제 bytes를 결박한 versioned immutable bundle이다. 기본 projection은 bounded metadata/refs만, 원문은 명시적 bundle artifact resolve로 복구한다.
4. import는 host가 exact response hash 및 독립 verifier actor/context/workspace/provider/backend provenance를 관찰·등록한 current authorization만 소비한다. payload self-mint/foreign/stale/fence/target/schema/hash/alias/replay/rebind를 fail-closed. 실패는 partial import 없이 처리한다.
5. Claude/Codex/Local native 결과는 동일 ResultEnvelope 정본으로 검증하고 native/backend/source/limitations를 보존한다. 수동 provenance는 실제 원격 provider 인증이나 실제 runtime 증거로 승격하지 않는다. 전달/형식검증과 독립 실행의 실제 PASS를 구분한다.
6. CRITICAL 검증 항목은 host의 canonical 설계 문서 bytes/hash에 존재하는 exact 조항+원문 인용+인용 hash가 bundle에 필수다. 인용 누락/다른 문서/조항/내용 변경은 거부한다.
7. bundle/원문/metadata의 secret-like 입력은 export/import 전에 값 비노출 오류로 거부한다. raw transcript는 bundle refs와 checksum으로만 복구하며 기본 projection에 본문을 넣지 않는다.
8. 결과는 사용자 승인/설계 변경/Main acceptance/Release/Apply/Step completion이 아니며 자동 상태 전이 0. E-03의 최종 합격은 사람 또는 별도 독립 세션이 판정한다.

## dual lease

- worker worker-lease-e03-r1-20260917-001 / execution e03-r1-execution-fence-epoch-1-c9678884d8e44a53
- write write-lease-e03-r1-20260917-001 / write e03-r1-write-fence-epoch-1-fc4ab7c070a2c84f
- issued 2026-09-17T10:23:00+09:00, expires 2026-09-17T22:23:00+09:00. 제품 mutation 전에 실제 host 시각/발효 및 seq1084 checker PASS를 확인한다.

## 순차 TDD·검증

- [ ] control RED: seq1080 불변 prefix, exact9/optional product6, dual fence, E03 IN_PROGRESS/E04 NOT_READY. GREEN 후 제품 시작.
- [ ] product RED: 정상 backend3종/수동 export/import/refs 복구; secret/tamper/schema/target/replay/foreign/stale/self-mint; CRITICAL 인용.
- [ ] 최소 구현 GREEN, tests/agent_team tests/orchestration tests/artifacts 및 관련 API 회귀.
- [ ] compileall exact modules/tests/control, git diff --check, exact15 확인.
- [ ] 완료보고: 판정→이유→조치, 기준 hash/명령·exit·수치/RED-GREEN/미검증/rollback. COMPLETED는 Developer 증거이며 acceptance 아님.

commit/push/acceptance/E-04 금지. 동일 유효 실패 3회 규칙 유지. 임의 scope 확장 금지.
