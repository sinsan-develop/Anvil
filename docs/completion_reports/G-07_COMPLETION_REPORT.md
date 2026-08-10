# G-07 CompletionReport — 권위 기준선 독립 정규화

- result_status: `COMPLETED`
- review_state: `ACCEPTED`
- package_id: `G-07`
- work_instruction_id: `WI-G-07-20260810-002`
- work_instruction_sha256: `1D51FBBB450BB677BDAD3BFB30DF04BBAB44C9F6472404735B08858A27C3B0FA`
- invocation_artifact_id: `INV-G-07-20260810-002`
- invocation_sha256: `504C747A5A078D8D7E06DE736FB01F187948B78868B4ABD11A13D0C3F4A8A873`
- baseline_git_commit: `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8`
- baseline_upstream: `origin/main` / `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8`
- environment: `ENV-LOCAL`
- assigned_verification: `AV-GATE-026 / L2`
- mapping_hash: `AE9838B35B430703E16255B6C34C084B7F917B063171BD98F61460F8CFA8F8AF`

## 판정

`ACCEPTED / GATE_REVIEW` — 권위 문서 5개와 G-01~G-06 accepted evidence를 수정하지 않고 실제 Markdown/JSON parser로 97 Package, 255 unique AV ID, 미집행 0, 역색인 97/97, §49.17 20/20 exact trace를 재계산했다. 독립 Tester가 `AV-GATE-026 PASS`, blocking finding 0을 확인했고 Main Agent가 revision 2를 최종 수락했다. 별도 Phase G Gate record 전에는 G Gate 완료 또는 A-01 시작으로 승격하지 않는다.

## 판단 이유

1. revision 2 invocation의 WorkInstruction SHA-256 `1D51FBBB...B0FA`와 실제 파일이 일치했다. revision 1 전체 회귀에서 발견된 projection-aware 회귀 3건만 Main의 비의미 revision 2 허용 범위로 수정했다.
2. 설계 v2.6, 작업계획 v1.4, 매트릭스 v1.2, 테스트계획 v1.3, 운영규칙 v1.5의 실제 SHA-256이 WorkInstruction 결박값과 모두 일치했다.
3. 작업계획 Markdown에서 Package 97개와 dependency를 직접 파싱했고 unique 97, unknown dependency 0, cycle 0을 확인했다.
4. 매트릭스 §6에서 AV 255개를 직접 파싱했고 unique 255, CON 21·실행 234, 미할당·미집행 0을 확인했다. §8 Package 역색인은 97행·unique 97·누락/초과 0이다.
5. 설계서 §49.17 20개 번호, 매트릭스의 source/Package/evidence, Phase Gate, G-06 scenario JSON의 AV/Package/Gate/evidence를 대조했다. wrong-but-nonempty AV·Package·Gate·evidence mutation은 각각 안정 reason code로 거부됐다.
6. DIR-1=A-15 누적 22, DIR-2=C-15 누적 49, 조건부 `DIRX-LRN-CRITICAL`, DIR-3=E-11 누적 73과 `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`를 대조했다. 실제 DIR에는 도달하지 않았다.
7. Local→WSL-server PostgreSQL 15→격리 PostgreSQL 18 RC→ysna-server/`envil.sinsan.kr`와 Git-only commit/tag·ReleaseManifest 승격을 대조했다. 서버·DB·배포는 실행하지 않았다.
8. G-05 accepted evidence는 immutable R2 manifest, G-06은 immutable R3 manifest로 고정했다. G-01~G-06 최종 독립 TestReport의 PASS, manifest target=delivered와 Git file provenance를 확인했다.
9. stale `a70daa4` progress/HANDOFF repository projection은 sequence 14 `REPOSITORY_RECONCILED` Event로 현재 관측 `23bc001`에 정합화했다. 이 Event는 과거 `GIT_PUSH`를 소급 주장하지 않는다.
10. G-07 active lineage valid failure는 0이고 historical accepted failure는 G-05 1회·G-06 1회, 합계 2로 분리했다.
11. 독립 TestReport SHA-256 `8F3C8CF31FA31DA7908F308953BFDDC9141327AB46D70AD4909CEFD540270DAF`와 byte-exact immutable R2 manifest SHA-256 `7967674B6CBDA114ADF530C98B94BFB062888278F05AF7A9A775EA64EBE46320`을 sequence 19 acceptance event에 결박했다.

## TDD·적대 mutation

| 단계 | 명령 | Exit | 실제 결과 |
|---|---|---:|---|
| RED | `python -m unittest tests.tooling.test_g07_baseline` | 1 | validator 파일 부재 `FileNotFoundError`; 기능 부재로 예상 실패 |
| GREEN | `python -m unittest tests.tooling.test_g07_baseline` | 0 | 초기 10 tests PASS |
| reconciliation RED | `python -m unittest ...test_repository_reconciliation_and_failure_lineages_are_explicit` | 1 | `progress_reconciliation` 부재로 예상 실패 |
| reconciliation GREEN | 동일 test와 전체 G-07 suite | 0 | 11 tests PASS |
| manifest RED/GREEN | `python -m unittest tests.tooling.test_g07_baseline.G07BaselineTests.test_manifest_binds_actual_evidence_bytes` | 1 → 0 | validator 부재를 먼저 확인한 뒤 실제 bytes/hash 재계산 검증 구현 |
| revision 2 scoped RED | `python -m unittest tests.tooling.test_project_progress` | 1 | stale WI v1 projection과 detached digest 불일치를 재현 |
| revision 2 scoped GREEN | 동일 suite | 0 | 23 tests PASS; all-category fixture와 현재 G-07 projection 검증 |
| final full regression | `python -m unittest tests.tooling.test_g07_baseline tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | 83 tests PASS |

거부한 mutation은 authority hash/version drift, Package duplicate/unknown dependency/cycle, AV duplicate/uncovered, 역색인 Package duplicate, scenario wrong AV/Package/Gate/evidence, fixture false PASS, DIR 누적·상태 drift, domain/PG/Git-only drift, accepted provenance 누락이다. source를 수정하거나 성공값을 하드코딩해 parser 결과를 덮지 않았다.

## G Gate 회귀 경계

- `AV-FLOW-003`: G-04 independent revision 2 PASS evidence trace
- `AV-STAT-015`, `AV-STAT-016`: G-05 immutable R2 independent PASS evidence trace
- `AV-CON-016(RV)`: G-01 independent PASS evidence trace
- `AV-GATE-026`: 독립 Tester `PASS`; Main Agent G-07 `ACCEPTED`
- `SKIPPED`, `BLOCKED`, `NOT_EXECUTED`, fixture/static 결과는 Gate PASS로 집계하지 않았다.
- 별도 Phase G regression, Gate TestReport, `PHASE_GATE_DECIDED` record 전 A-01을 시작하지 않는다.

## 변경 파일과 영향 범위

- `scripts/check_g07_baseline.py`: stdlib Markdown/JSON/Git provenance validator
- `tests/tooling/test_g07_baseline.py`: TDD·mutation·reconciliation tests
- `tests/tooling/test_project_progress.py`: 현재 projection을 기준으로 historical G-06 acceptance와 mutation을 검증하도록 최소 수정
- `tests/fixtures/g05/progress-events-all-categories.json`: `REPOSITORY_RECONCILED` event-category fixture 추가
- `docs/validation/G-07_BASELINE_VERIFICATION_REPORT.{json,md}`: 실제 parser 결과
- `docs/evidence/manifests/G-07_EVIDENCE_MANIFEST.json`: delivered evidence binding
- `docs/progress/**`, `docs/progress/BUILD_HANDOFF.md`: 현재 Git projection, failure lineage, G-07 상태
- 본 CompletionReport

권위 문서, G-01~G-06 WorkInstruction/TestReport/manifest/anchor, 제품 API/UI/DB/runtime은 수정하지 않았다.

## 미검증·NOT_EXECUTED

- §49.17 runtime scenario 20건: `NOT_EXECUTED`
- FI-01~FI-08 실제 fault injection: `NOT_EXECUTED`
- 제품 API/UI/browser/Network/DB/Docker/WSL/Production/배포/Release: `NOT_EXECUTED`
- 독립 Tester의 G-07 적대 재구성: PASS, TestReport에 기록
- Phase G Gate record, A-01: 금지·미실행

## 기존 기능 유지와 rollback

G-03~G-06 tooling 전체 회귀를 fresh 실행해 기존 계약을 확인한다. 실패 시 G-07 신규 허용 경로와 G-07 progress/HANDOFF 정합화 변경만 되돌리며, 권위 문서와 G-06 이전 immutable evidence는 수정·삭제하지 않는다.

## 조치

별도 Phase G regression과 독립 Gate TestReport를 수행한 뒤 Main Agent가 Gate evidence를 판정한다. Developer는 G Gate 완료, commit/push, A-01 시작을 수행하지 않는다.
