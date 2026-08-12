# A-14 Rework WorkInstruction Revision 2

## Artifact envelope

- artifact_id: `WI-A-14-20260812-002`
- artifact_type: `rework_work_instruction`
- package_id / revision: `A-14 / 2`
- artifact_status / package_status: `approved / ACTIVE`
- created_by: `main-agent-eoul`
- created_at: `2026-08-12T21:00:00+09:00`
- executor: `developer-primary-a14`
- predecessor WI: `docs/work_orders/A-14_WORK_INSTRUCTION.md` / `10421A71394CDC3903EF9BB03D1EDDECB1CA6240219F9E992AA5971D9B1E5F38`
- source Tester report: `docs/test_reports/A-14_TEST_REPORT.md` / `6A53A135F7362563846252D223376692938317F3A0C4E3EF07B5C767A201C768`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`; semantic diff: `NONE`

## 판정 -> 판단 이유 -> 조치

### 판정

`BLK-A14-002`는 동일 lineage의 첫 유효 제품 실패다. `BLK-A14-001`은 Windows sandbox ACL에 의한 `ENVIRONMENT_BLOCKED`이며 유효 제품 실패 횟수에는 넣지 않지만 A-14 acceptance 차단은 유지한다.

### 판단 이유

A-14 completion successor가 결박한 A-13 live checker/test의 raw bytes가 clean checkout에서 재현되지 않는다. 제품 Workbench 17개 경로는 이 finding의 원인이 아니며 동결한다. 실제 in-app browser 검증은 interaction 이전 ACL helper 실패로 미실행이다.

### 조치

1. clean checkout에서 A-13 successor evidence raw bytes/hash가 일치하는 RED를 먼저 재현하고 최소 수정한다.
2. 전체 tooling은 현재 보존된 finding 기준 `267/268`에서 시작하여 수정 후 전건 PASS를 목표로 한다.
3. ACL 차단이 해소된 환경에서 in-app browser 1920x1080 클릭·화면·console/storage/source·전체 Network를 재시도한다.
4. 브라우저 요청은 same-origin 상대 `/api/...`만 허용하며 production API/DB/SSE/provider/secret/egress/WSL/ysna/deploy/DIR은 `NOT_EXECUTED`로 유지한다.

## Developer write scope

- `scripts/check_a13_repository_scan.py`
- `tests/tooling/test_a13_repository_scan.py`
- `docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json`
- `docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md`
- `docs/completion_reports/A-14_COMPLETION_REPORT.md`

`apps/web/**`, `tests/browser/a14/**`, `tests/fixtures/a14/**`, A-14 architecture, predecessor WI/evidence/completion manifest, Tester report, progress/HANDOFF와 위 목록 밖 모든 파일은 수정 금지다. 제품 17개 경로 변경이 불가피하다는 새 증거가 생기면 구현하지 말고 `BLOCKED`로 보고한다.

## 완료조건

- `BLK-A14-002` RED→GREEN과 clean checkout 증거를 제출한다.
- in-app browser를 재시도하고 ACL 재발 시 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`를 그대로 기록한다.
- 결과는 `COMPLETED_PENDING_INDEPENDENT_RETEST`; Main acceptance와 A-15 시작을 주장하지 않는다.
- commit/push/deploy를 수행하지 않는다.