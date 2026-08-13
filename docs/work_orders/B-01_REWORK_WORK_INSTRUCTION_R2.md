# B-01 Rework WorkInstruction Revision 2

## Artifact envelope

- artifact_id: `WI-B-01-20260813-002`
- artifact_type: `rework_work_instruction`
- package_id / revision: `B-01 / 2`
- artifact_status / package_status: `approved / ACTIVE`
- executor: `developer-primary-b01`
- baseline_git_commit: `6735088c8ed919cba44256ded5c4c8d281e4a3f8`
- predecessor WI: `docs/work_orders/B-01_WORK_INSTRUCTION.md` / `C09132317703923FDABE89D1A7F1EA06660FCC123976E9286B4B061D0100194F`
- predecessor evidence: `docs/evidence/manifests/B-01_EVIDENCE_MANIFEST.json` / `BC89F69EF898B815DC0084D7373C0F8F833A8E371AEA4386A890F9FECD57DBED`
- source Tester report: `docs/test_reports/B-01_INDEPENDENT_TEST_REPORT.md` / `3215F8C1BF8BDFCED692C7AE86B7ABE0D26A8712C41B9E31B7C8481474BEEED8`
- failure fingerprint: `BLK-B01-001-RELEASE-GUARD-TYPE-AND-WHITESPACE-BYPASS`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`; semantic diff: `NONE`

## 목적과 고정 경계

`BLK-B01-001`만 수정한다. `USER_VALIDATION → APPLY_PENDING` RELEASE guard가 boolean `False`, float `0.0`, 공백-only target hash를 fail-closed 하도록 만든다. B-01의 기능 범위·요구사항·중요 위험과 기존 정상 전이 11건, 차단 코드 9건, immutable/pure reducer 계약은 변경하지 않는다.

## 필수 수정과 검증

1. 세 hostile 입력을 `tests/domain/test_reducer.py`에 먼저 추가하고 모두 intended RED임을 확인한다.
2. `blocking_defect_count`는 boolean을 배제한 strict integer zero만 허용한다.
3. target과 validation target은 canonical nonblank hash 문자열이며 서로 정확히 같을 때만 허용한다. 새 해시 알고리즘이나 위험 하향은 도입하지 않는다.
4. 최소 수정 후 hostile 3건, domain 전체 12+3건, dependency boundary, tooling 282건을 실행한다.
5. revision-2 evidence/completion/validation에 RED→GREEN, exact/raw/target/self-reference=false, 미실행 runtime 경계를 기록한다.

## Developer exact file-level write allowlist

- `packages/domain/reducer.py`
- `tests/domain/test_reducer.py`
- `docs/validation/B-01_DOMAIN_CORE_VALIDATION_R2.md`
- `docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R2.json`
- `docs/completion_reports/B-01_COMPLETION_REPORT_R2.md`

R1 exact 11의 나머지 파일, R1 manifest/completion/validation, Tester report, authority, progress/HANDOFF, WorkInstruction, 다른 package/app, dependencies/config, Git refs/index는 수정 금지다.

## 완료조건과 금지

- epoch-2 worker/write fencing token과 exact 5 paths를 시작 전에 확인한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.
- 완료 성공 상태는 `COMPLETED_PENDING_INDEPENDENT_RETEST`이며 Main acceptance를 주장하지 않는다.
- B-01 acceptance, B-02 시작, commit/push, 실제 API·DB·UI·browser·provider·WSL·production·deploy를 수행하지 않는다.
