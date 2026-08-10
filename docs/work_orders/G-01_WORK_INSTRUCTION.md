# G-01 WorkInstruction — 설계 기준선 등록

- work_instruction_id: `WI-G-01-20260810-001`
- package_id: `G-01`
- owner: `Main Agent 어울`
- approval_ref: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- validation_ids: `AV-CON-016`
- validation_method: `RV`
- status: `ACTIVE`

## 목표

승인된 Anvil 권위 문서와 내부·외부 참조 source의 path, version, SHA-256, 권위, 적용 범위, 현재 불일치를 하나의 BaselineRecord와 Source Inventory로 고정한다.

## 포함 범위

- 승인 기록과 기준선 hash 검증
- 로컬 권위 문서 및 MoaWorks 원본의 SHA-256 등록
- 설계서 0.1.1의 공식 URL source 목록 등록
- Git 미초기화, 제품 코드 없음, 서버·DB 미변경 상태 기록
- D1~D10 승인 효력과 G-02 이관 항목 기록
- `AV-CON-016` 설계 리뷰용 EvidenceManifest 작성

## 제외·금지 범위

- Git 초기화, branch/worktree 생성, commit, push
- 제품 scaffold·코드·테스트 코드 작성
- WSL-server·ysna-server·PostgreSQL 변경
- 외부 문서 원본 수정
- D1~D10·Q-01~Q-06의 임의 재결정

## 허용 파일

- `docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md`
- `docs/baselines/G-01_BASELINE_RECORD.md`
- `docs/baselines/G-01_SOURCE_INVENTORY.md`
- `docs/evidence/manifests/G-01_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-01_COMPLETION_REPORT.md`
- `docs/test_reports/G-01_TEST_REPORT.md`
- `docs/progress/build-progress.json`
- `docs/progress/BUILD_HANDOFF.md`
- 이 WorkInstruction과 짝 InvocationPrompt

## 완료조건

1. 승인 대상 로컬 artifact의 실제 SHA-256과 등록값이 전부 일치한다.
2. 각 source의 권위·적용 범위·보존 위치·revision 상태가 기록된다.
3. 불일치·미확정·외부 URL revision은 숨기지 않고 상태와 다음 조치를 가진다.
4. Anvil이 Claude Code/Codex/Hermes 등을 복제하지 않고 운영 제어면·증거·인간 통제를 제공한다는 `AV-CON-016` 리뷰가 기록된다.
5. EvidenceManifest가 동일 target hash와 산출물 hash를 묶는다.
6. 독립 Tester가 고정 revision을 검토하기 전에는 `ACCEPTED`로 표시하지 않는다.

## 보고 계약

Main Agent는 `판정 → 판단 이유 → 조치` 형식으로 CompletionReport를 작성한다. 미실행·BLOCKED·외부 revision 미고정은 PASS로 표시하지 않는다.
