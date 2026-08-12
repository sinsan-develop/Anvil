# A-13 Rework WorkInstruction Revision 2

## Artifact envelope

- artifact_id: `WI-A-13-20260812-002`
- artifact_type: `rework_work_instruction`
- package_id / revision: `A-13 / 2`
- artifact_status / package_status: `approved / ACTIVE`
- created_by: `main-agent-eoul`
- created_at: `2026-08-12T14:00:00+09:00`
- executor: `developer-primary-a13`
- predecessor WI: `docs/work_orders/A-13_WORK_INSTRUCTION.md` / `88B142690358661F456C715378B9AFACE5340FC4EBED90D567E07C8B58384835`
- source Tester report: `docs/test_reports/A-13_TEST_REPORT.md` / `90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`; semantic diff: `NONE`

## 목적과 고정 경계

`A13-TST-BLK-001`, `A13-TST-BLK-002`만 수정한다. 기능 범위·요구사항·중요 위험을 변경하지 않는다. repository scanner core와 G-06 fixture zero-delta 증거는 보존하며 실제 사용자 저장소·브라우저·API·DB·WSL·서버·운영·배포·DIR을 실행하지 않는다.

## 필수 수정

1. clean committed target과 uncommitted Main completion projection을 구분하면서 frozen predecessor manifest와 successor checker/test binding을 모두 검증한다.
2. 공식 checker CLI의 bundle 검증이 evidence manifest validator를 반드시 호출하고 오류를 exit nonzero로 전달한다.
3. 두 finding을 재현하는 hostile regression을 RED로 확인한 뒤 최소 수정한다.
4. fresh focused와 full tooling `263/263`, A-13 CLI hostile manifest nonzero, A-01~A-13/project/G-07/Phase-G 회귀를 실행한다.

## Developer write scope

- `scripts/check_a13_repository_scan.py`
- `tests/tooling/test_a13_repository_scan.py`
- `docs/evidence/manifests/A-13_EVIDENCE_MANIFEST_R2.json`
- `docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md`
- `docs/completion_reports/A-13_COMPLETION_REPORT.md`

`packages/repository_intelligence/**`, G-06 fixture, architecture catalog, predecessor WI/evidence/completion manifest, Tester report, progress/HANDOFF와 위 목록 밖 모든 파일은 수정 금지다.

## 완료조건

- Tester 두 finding의 RED→GREEN 및 hostile evidence를 기록한다.
- revision-2 successor manifest에 current raw/target/delivered/self-reference=false를 결박한다.
- 결과는 `COMPLETED_PENDING_INDEPENDENT_RETEST`이며 Main acceptance를 주장하지 않는다.
- commit/push/deploy와 A-14 구현을 수행하지 않는다.
