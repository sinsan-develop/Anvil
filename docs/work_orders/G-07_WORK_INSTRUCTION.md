# G-07 WorkInstruction — 통합 기준선·97 Package·255 AV·§49.17 독립 정규화 검증

## Artifact envelope

- artifact_id: `WI-G-07-20260810-002`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `G-07`
- version: `2`
- artifact_status: `approved`
- package_status: `ACTIVE`
- content_hash: `파일 저장 후 SHA-256으로 결박`
- source_artifact_ids: `BASELINE-G-02-DERIVED-20260810-001`, `Anvil-WorkPlan-v1.4`
- source_evidence_ids: `G-04_TEST_REPORT_R2`, `G-05_TEST_REPORT_R2`, `G-06_TEST_REPORT_R2`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-10T20:00:00+09:00`
- supersedes_artifact_id: `WI-G-07-20260810-001`

## Revision 2 — current projection 회귀 정합화

- supersedes_work_instruction_sha256: `CECE3C7A3A40E8A56313126D3F1C8D56F9CC08FE0E7FEE65389EA619A7792F6B`
- change_classification: `MAIN_RECONFIRMED_NON_SEMANTIC`
- reason: G-07의 비소급 `REPOSITORY_RECONCILED` event와 TEST_REVIEW projection이 추가되면서 G-05 전용 회귀가 과거 G-06 READY 상태와 event 집합을 하드코딩한 결함을 드러냈다.
- impact: 권위 문서·G-05/G-06 accepted evidence·제품 요구는 변경하지 않는다. 기존 progress test/fixture가 현재 projection과 새 canonical event를 동적으로 검증하도록 최소 수정한다.

## 승인·기준선 binding

- owner: `Main Agent 어울`
- executor: `developer-primary Subagent 1명`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- validation_matrix_sha256: `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
- test_plan_sha256: `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5`
- operating_rules_sha256: `7D5E2AD0F272CBA1052EA8A21622F1E16438ABAB9AA4AAB7A1D34374B4FFB5F3`
- baseline_git_commit: `23bc001`
- baseline_upstream: `origin/main`
- approval_scope: `G-07 권위 문서·Package/AV/§49.17/Gate 정합성 validator와 evidence만; 권위 문서 내용 수정 없음`

## 목표

현재 승인된 문서를 수정하지 않고, 설계 v2.6·작업계획 v1.4·매트릭스 v1.2·테스트계획 v1.3·운영규칙 v1.5가 동일한 97 Package, 255 AV ID, DIR 위치, §49.17 20 scenario, 환경·배포 계약을 가리키는지 독립 재계산한다. G-01~G-06의 accepted evidence와 G Gate 회귀 집합을 고정하고, 구 기준선·미할당·중복·누락을 0으로 만든다.

## 선행조건

1. G-01~G-06은 각각 독립 Tester PASS와 Main `ACCEPTED` evidence를 가진다.
2. Git `main` HEAD `23bc001`이 `origin/main`에 push됐다.
3. G-06 golden anchor와 immutable manifest, G-05 accepted manifests는 byte 불변이다.
4. Developer는 권위 문서를 수정하지 않고 validator/report/evidence 경로만 쓴다.

## 포함 범위

1. authority path/version/hash inventory와 drift 검사
2. 작업계획 97 Package ID·Phase·dependency·DIR 누적 위치 파서/검사
3. 매트릭스 255 unique AV ID·domain count·severity·Package 역색인 검사
4. 모든 AV ID가 최소 1개 Package에 할당되고 모든 97 Package가 역색인에 정확히 1행 존재하는지 검사
5. §49.17 20 scenario의 exact AV ID·Package·Gate·evidence trace와 G-06 scenario catalog 대조
6. DIR-1=A-15(22/97), DIR-2=C-15(49/97), 조건부 DIR-X=D Gate, DIR-3=E-11(73/97) 대조
7. Local→WSL-server PG15→격리 PG18 RC→ysna-server/`envil.sinsan.kr`, Git-only 승격 계약 대조
8. G-01~G-06 WorkInstruction/TestReport/EvidenceManifest/acceptance event/Git commit provenance 검사
9. G Gate regression suite와 baseline verification report/EvidenceManifest/CompletionReport/progress/HANDOFF

## canonical 검증 값

```text
design=v2.6 sha256:246D0487...A9A5
work_plan=v1.4 sha256:4DB8F5F5...F7475
matrix=v1.2 sha256:0A0CEA88...45D3
test_plan=v1.3 sha256:870BC8CA...DC5
package_total=97
av_id_total=255
unique_av_id_total=255
DIR-1=A-15 cumulative=22
DIR-2=C-15 cumulative=49
DIR-X=conditional after D Gate on DIRX-LRN-CRITICAL
DIR-3=E-11 cumulative=73
scenario_total=20
```

문서에서 실제 파싱한 값과 위 canonical 값이 다르면 하드코딩 값으로 덮지 말고 실패한다.

## G Gate 회귀 집합

- `AV-FLOW-003`: G-04 artifact reference/non-duplication·reconstruction
- `AV-STAT-015`, `AV-STAT-016`: G-05 progress 최소필드·전체 event contract
- `AV-GATE-026`: 본 G-07 전체 정규화 검증
- `AV-CON-016(RV)`: native coding loop 비복제 경계 재검토

G-07 Developer PASS는 Gate 합격이 아니다. 독립 Tester가 위 집합과 G-01~G-07 evidence를 검증하고 Main이 G-07을 ACCEPTED로 기록한 뒤에만 G Gate를 판정한다.

## 허용 경로

- `docs/baselines/G-07_*`
- `docs/validation/G-07_*`
- `scripts/check_g07_baseline.py`
- `tests/tooling/test_g07_baseline.py`
- `tests/fixtures/g07/**`
- `tests/tooling/test_project_progress.py`
- `tests/fixtures/g05/progress-events-all-categories.json`
- `docs/evidence/manifests/G-07_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-07_COMPLETION_REPORT.md`
- `docs/progress/**`
- 독립 Tester 전용 `docs/test_reports/G-07_TEST_REPORT*.md`

## 금지·제외 범위

- 설계서·작업계획서·매트릭스·테스트계획서·운영규칙·AGENTS.md 내용 수정
- G-01~G-06 artifact/TestReport/manifest/anchor 수정
- 문서 parser 결과를 맞추기 위한 source reformat/rewrite
- 제품 API/UI/DB/Provider/Docker/runtime 구현
- server/DB/WSL/ysna-server 접속, 배포, tag
- fixture/static 검증을 제품 runtime PASS로 승격

## TDD·적대 검증

1. 먼저 `tests/tooling/test_g07_baseline.py`를 작성하고 validator 부재 RED를 실제 관찰한다.
2. Markdown parser/contract checker를 최소 구현해 실제 authority 문서에서 값을 추출한다.
3. 다음 mutation을 모두 거부한다.
   - authority hash/version drift, 구 v1.1/v1.3 기준선 혼입
   - Package 누락·중복·구 ID·dependency unknown/cycle
   - AV ID 누락·중복·미할당, 97 Package 역색인 누락·중복
   - DIR 위치/누적 수/상태/trigger drift
   - §49.17 scenario AV/Package/Gate/evidence wrong-but-nonempty
   - 환경/production host/domain/PG version/Git-only deployment drift
   - G01~G06 accepted evidence/TestReport/manifest/hash/commit 누락·불일치
   - `SKIPPED|BLOCKED|NOT_EXECUTED|fixture`를 G Gate PASS로 집계
4. G-06/G-05/G-04/G-03 전체 회귀를 함께 실행한다.
5. baseline verification report는 파싱 수치, mapping hash, unresolved/unchecked 범위, Gate readiness를 기록한다.

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3"
  assigned_verification_ids: ["AV-GATE-026"]
  required_levels: ["L2"]
  required_evidence: ["E-ART", "E-DEC", "E-MAN", "E-GIT", "E-TEST"]
  tester_entry_conditions:
    - "G-01~G-06 ACCEPTED evidence와 G-07 report/manifest 존재"
    - "Main Agent PRELIMINARY_ACCEPT 및 고정 revision"
  package_exit_conditions:
    - "authority hash 일치, 97 Package, 255 unique AV, 미할당 0"
    - "97/97 Package 역색인, §49.17 20/20 exact trace"
    - "DIR 1/2/X/3·환경·Git-only 배포 계약 일치"
    - "G Gate 회귀 집합 PASS와 blocking defect 0"
  regression_suite: "tests.tooling.test_g07_baseline + G-06/G-05/G-04/G-03 tooling suites"
  fixture_ids: ["G07-AUTHORITY-MUTATIONS", "G07-TRACE-MUTATIONS", "G07-ACCEPTANCE-PROVENANCE"]
  environment: "ENV-LOCAL"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "실제 DIR 도달"
    - "권위 문서의 semantic drift 또는 accepted evidence 위조 발견"
    - "실제 secret 발견"
  evidence_manifest_required: true
  product_validation_criteria: []
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED/G Gate 금지"
  release_decision_required: false
```

## 완료조건

1. 권위 문서 5개 path/version/hash가 exact 일치한다.
2. 97 Package가 unique하고 dependency unknown/cycle 0이다.
3. 255 AV ID가 unique하며 미할당 0, Package 역색인 97/97이다.
4. §49.17 20/20 exact AV/Package/Gate/evidence trace가 문서와 G-06 catalog에서 일치한다.
5. DIR-1/2/X/3 위치·누적·trigger와 환경/배포 계약이 일치한다.
6. G-01~G-06 accepted evidence/TestReport/manifest/Git provenance가 일치한다.
7. G Gate 회귀 집합과 전체 tooling 회귀가 PASS한다.
8. mock/fixture/NOT_EXECUTED가 제품 PASS로 집계되지 않는다.
9. baseline verification report와 EvidenceManifest target/delivered가 일치한다.
10. 독립 Tester PASS 전 `ACCEPTED`, G Gate 완료, A-01 시작을 금지한다.

## rollback 경계

실패 시 G-07 신규 허용 경로와 G-07 progress/HANDOFF 변경만 되돌린다. 권위 문서와 G-06 이전 immutable evidence는 수정·삭제하지 않는다.

## 보고 계약

Developer는 CompletionReport에만 `판정 → 판단 이유 → 조치`를 기록한다. 파싱 수치/hash, mutation 결과, G Gate regression, target/delivered, SKIPPED/BLOCKED/NOT_EXECUTED/미검증 범위를 포함한다. routine 진행은 신산님에게 보고하지 않는다.
