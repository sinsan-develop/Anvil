# G-01 CompletionReport

- package_id: `G-01`
- work_instruction_id: `WI-G-01-20260810-001`
- actor: `Main Agent 어울`
- result_status: `COMPLETED`
- main_preliminary_verdict: `PRELIMINARY_ACCEPT`
- evidence_manifest: `docs/evidence/manifests/G-01_EVIDENCE_MANIFEST.json`
- evidence_manifest_sha256: `3C68E04B123C3961023F02EA9E6768F7DF5F8E621A0F15237BC4EEB990284D4B`
- target_hash: `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C`

## 판정

`PRELIMINARY_ACCEPT` — G-01의 BaselineRecord와 Source Inventory 작성이 완료되어 독립 Tester 진입 조건을 충족했다. 최종 `ACCEPTED`는 아니다.

## 판단 이유

1. 통합 승인 subject와 7개 로컬 권위 artifact, MoaWorks 원본의 SHA-256을 고정했다.
2. 선행 Anvil 자료와 Forge·LogicForge·OrcheFlow는 canonical 설계가 아닌 contextual source로 분리했다.
3. 공식 개념 근거 18개 URL은 별도 Subagent가 read-only로 확인했고 모두 HTTP 200이었다.
4. root Git 미초기화, 참조 repository dirty 상태, LogicForge local remote 부재, 공개 revision marker가 없는 URL을 숨기지 않고 mismatch로 기록했다.
5. `AV-CON-016`에 대해 Anvil의 고유 책임과 Native Agent Adapter 경계를 설계 근거로 정리했다.

## 생성 파일

- `docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md`
- `docs/work_orders/G-01_WORK_INSTRUCTION.md`
- `docs/work_orders/G-01_INVOCATION_PROMPT.md`
- `docs/baselines/G-01_BASELINE_RECORD.md`
- `docs/baselines/G-01_SOURCE_INVENTORY.md`
- `docs/evidence/manifests/G-01_EVIDENCE_MANIFEST.json`
- 이 보고서

## 수행 검증

| 검증 | 결과 |
|---|---|
| 로컬 권위 artifact SHA-256 재계산 | 승인·progress 기준선과 일치 |
| MoaWorks 원본 SHA-256 | `0C033D...B77D` 일치 |
| Backup 참조 Git HEAD/tree/status | 3개 snapshot과 dirty 상태 기록 |
| 공식 URL audit | 18/18 HTTP 200, revision marker 기록 |
| EvidenceManifest JSON parse | PASS |
| Git/worktree | root Git 미초기화 확인, 생성하지 않음 |

## 미실행·제한

- 제품 코드·단위/통합/E2E 테스트: G-01 비범위
- WSL-server·ysna-server·DB 접속 및 변경: G-01 비범위
- Git 초기화·commit·push: G-01 금지 범위
- 공식 문서 본문 content hash: 공개 ETag가 없는 source는 URL·수집일만 고정

## 기존 기능 유지

제품 코드가 없고 기존 권위 문서 본문은 수정하지 않았다. Backup과 외부 MoaWorks 원본도 읽기 전용으로 보존했다.

## Rollback

G-01에서 새로 만든 artifact와 progress Event만 제거하면 이전 `DOCUMENT_SYNC_REVIEW` 상태로 돌아갈 수 있다. 승인된 설계·계획·검증·운영 문서는 rollback 대상이 아니다.

## 조치

독립 Tester가 고정 target hash와 `AV-CON-016`을 검토해 `docs/test_reports/G-01_TEST_REPORT.md`로 판정한다. PASS 전에는 G-02를 시작하지 않는다.
