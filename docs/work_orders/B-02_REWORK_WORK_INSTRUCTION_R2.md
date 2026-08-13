# B-02 Rework WorkInstruction Revision 2

## Artifact envelope

- artifact_id: `WI-B-02-20260814-002`
- artifact_type: `rework_work_instruction`
- package_id / revision: `B-02 / 2`
- artifact_status / package_status: `approved / ACTIVE`
- executor: `developer-primary-b02`
- baseline_git_commit: `0abd0a830432956fc3da18740edbfd07488e3847`
- predecessor WI: `docs/work_orders/B-02_WORK_INSTRUCTION.md` / `6349CAB4525762319B6677F3B32A051358C1CC4B4D36672808AA24C3C4448821`
- predecessor evidence: `docs/evidence/manifests/B-02_EVIDENCE_MANIFEST.json` / `7D2C102C5ACAC4C49278D2B2262C863CEB459F4528FA789CAC8EEBD740E2B77E`
- source Tester report: `docs/test_reports/B-02_INDEPENDENT_TEST_REPORT.md` / `1B2F3A70056BB50AAA01229A86EC6D8A5B2B74B5A797B35FC4E505AAAED419F1`
- failure fingerprint: `BLK-B02-001-COMPLETION-RUNTIME-FIELD-SEMANTICS`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`; 기능 범위·요구사항·중요 위험 변경: `NONE`

## 목적과 고정 경계

`BLK-B02-001`만 수정한다. PostgreSQL 15/18의 `server_version_num` 값 `150017`/`180004`를 TCP port가 아닌 정확한 의미의 필드로 기록한다. R1 persistence source, migration, 실제 격리 runtime 결과와 Tester report는 동결한다.

## 필수 수정과 검증

1. 의미 오류를 재현하는 assertion을 `tests/persistence/test_postgres_compatibility.py`에 먼저 추가해 intended RED를 확인한다.
2. R2 evidence에는 `postgresql15_server_version_num=150017`, `postgresql18_server_version_num=180004`를 사용한다. 실행 port를 새로 주장하지 않는다.
3. R2 validation/completion에는 R1 실제 격리 migration cycle PASS와 자원 정리 사실을 보존하고, runtime 재실행을 요구하거나 주장하지 않는다.
4. persistence 전체, domain 14, tooling 282, standalone 4종과 exact/raw/target/self-reference=false를 검증한다.

## Developer exact file-level write allowlist

- `tests/persistence/test_postgres_compatibility.py`
- `docs/validation/B-02_DATABASE_FOUNDATION_VALIDATION_R2.md`
- `docs/evidence/manifests/B-02_EVIDENCE_MANIFEST_R2.json`
- `docs/completion_reports/B-02_COMPLETION_REPORT_R2.md`

R1 exact15와 completion successor, Tester report, authority, progress/HANDOFF, WorkInstruction, migration/source/config 및 다른 package는 수정 금지다.

## 완료조건과 금지

- epoch-2 worker/write fencing token과 exact 4 paths를 시작 전에 확인한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.
- 완료 성공은 `COMPLETED_PENDING_INDEPENDENT_RETEST`; Main acceptance가 아니다.
- B-02 acceptance, B-03, commit/push, 실제 runtime 재실행, API·UI·browser·provider·production·deploy를 수행하지 않는다.
