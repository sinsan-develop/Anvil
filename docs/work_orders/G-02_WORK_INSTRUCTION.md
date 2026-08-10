# G-02 WorkInstruction — 결정·검증 할당 확정

- work_instruction_id: `WI-G-02-20260810-001`
- revision: `3`
- previous_revision_sha256: `774225042E3061AD4375602B2B41BA6C401EB05D1D06181377DE18C70BB600E0`
- package_id: `G-02`
- owner: `Main Agent 어울`
- executor: `governance-decision-writer Subagent`
- approval_ref: `APPROVAL-20260810-G02-DECISIONS-001`
- approval_subject_hash: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- parent_approval_ref: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- validation_ids: `AV-SAFE-033`, `AV-GATE-026`
- validation_method: `AN + AU + RV`
- status: `REWORK_ACTIVE`
- rework_finding: `G02-DEF-002`

## 목표

신산님이 승인한 G-02 결정 묶음을 ADR/DecisionRecord와 validation allocation record로 고정하고, 테스트계획의 잠정 표현을 승인된 결정과 일치시키며, 변경된 문서 hash와 승인 계보를 증거로 묶는다.

## 포함 범위

- D1~D10의 기존 승인 효력과 G-02 결정 계보 기록
- Q-01, Q-03~Q-06의 승인값 기록
- 정의되지 않은 Q-02를 `RESERVED_NOT_DEFINED`로 명시하여 새 요구사항 발명 방지
- 과거 미할당 5건의 현재 Package 배정 확인
- `Anvil_테스트계획서_v1.md`를 v1.2로 올리고 잠정·미할당 표현을 승인 결과로 정합화
- content hash 변경으로 기존 binding이 무효화되고 새 approval binding이 적용됐다는 `AV-SAFE-033` 증거 작성
- 현재 97 Package·255 ID·DIR·역색인의 변경 없음 또는 실제 변경을 명시하는 `AV-GATE-026` 검토

## 제외·금지 범위

- 설계서·작업계획서·통합검증매트릭스의 의미 변경
- Git 초기화, branch/worktree 생성, commit, push
- 제품 scaffold·코드·테스트 코드 작성
- 서버·DB·배포 작업
- 승인된 결정의 임의 완화·확대
- Q-02에 새로운 요구사항 부여

## 허용 파일

- `docs/approvals/APPROVAL-20260810-G02-DECISIONS-001.md` (읽기 전용)
- `docs/work_orders/G-02_WORK_INSTRUCTION.md` (읽기 전용)
- `docs/work_orders/G-02_INVOCATION_PROMPT.md` (읽기 전용)
- `docs/decisions/G-02_DECISION_RECORD.md`
- `docs/decisions/G-02_VALIDATION_ALLOCATION.md`
- `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md`
- `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md`
- `Anvil_작업계획서_v1.md` (승인 상태·연계 문서 revision/hash·기준선 표기만 변경)
- `Anvil_통합검증매트릭스_v1.md` (승인 상태·연계 문서 revision·정규화 판정 표기만 변경)
- `Anvil_테스트계획서_v1.md`
- `docs/governance/ANVIL_OPERATING_RULES.md` (현재 기준선·상태 표기만 변경)
- `docs/onboarding/developer-primary-ack.md` (새 권위 hash 재온보딩 결과만 변경)
- `docs/evidence/manifests/G-02_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-02_COMPLETION_REPORT.md`
- `docs/progress/build-progress.json`
- `docs/progress/BUILD_HANDOFF.md`
- 독립 Tester 전용 `docs/test_reports/G-02_TEST_REPORT.md`

## 완료조건

1. 모든 승인 결정이 `HUMAN_CONFIRMED`, Q-02가 `RESERVED_NOT_DEFINED`로 기록된다.
2. D1~D10 계보가 기존 승인과 모순 없이 연결된다.
3. 과거 미할당 5건의 현재 책임 Package와 AV ID가 명시되고 실제 매트릭스와 일치한다.
4. 테스트계획 v1.2의 테스트 스택·Tester·30분 목표·Golden set 승인자·결함 대장이 결정과 일치한다.
5. 테스트계획 변경 전/후 hash와 새 approval binding을 기록한다.
6. 97 Package·255 ID·DIR-1/2/3·DIR-X·Package 역색인이 유지되며 구 기준선 또는 미할당 ID가 0건인지 판정한다.
7. EvidenceManifest와 CompletionReport가 고정된 target/delivered hash를 제공한다.
8. 독립 Tester PASS 전에는 G-02를 `ACCEPTED`로 표시하지 않는다.

## Revision 2 보정 계약

독립 Tester의 `G02-DEF-001`에 따라 활성 권위 문서의 구 기준선과 `승인 대기` 표현을 제거한다. 의미·Package·AV ID·DIR·구현 기준값은 변경하지 않는다.

1. 작업계획서는 v1.4, 통합검증매트릭스는 v1.2, 테스트계획서는 v1.3, 운영규칙은 v1.4로 올린다.
2. 작업계획서의 문서 상태와 2.2 구현 기준선 상태를 승인 결과에 맞춘다. D9는 제품 확정이 아니라 `BENCHMARK_POLICY_CONFIRMED`로 표시한다.
3. 작업계획서·매트릭스·테스트계획의 상호 version/hash 참조와 운영규칙의 현재 기준선을 새 revision으로 맞춘다.
4. G-01 행이나 HANDOFF의 과거 v1.1 기록은 `historical` 계보임을 명확히 하며 현재 기준선으로 오인되지 않게 한다.
5. 변경 전/후 hash, semantic diff=`NONE`, 영향, root human approval을 `MAIN_RECONFIRMED_NON_SEMANTIC` binding으로 기록한다.
6. 새 권위 hash로 Developer read-only 재온보딩을 갱신한다.
7. EvidenceManifest·CompletionReport·progress/HANDOFF를 새 artifact 집합과 hash로 재생성한다.
8. 기존 Test Report는 실패 증거로 보존한다. 새 고정 target의 재검증은 별도 독립 Tester가 같은 보고서에 revision 2 절을 추가하거나 새 revision 보고서로 수행한다.

## Revision 3 보정 계약

독립 Tester의 `G02-DEF-002`에 따라 승인 범위 비확대의 canonical parent-child 계보를 완성한다. Revision 2의 권위 문서 내용과 hash는 변경하지 않는다.

1. `MAIN_RECONFIRMED_NON_SEMANTIC` binding에 `parent_baseline_id=BASELINE-G-01-20260810-001`과 `root_human_approval_id=APPROVAL-20260810-INTEGRATED-BASELINE-001`을 canonical 필드로 추가한다.
2. `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md`를 생성하고 고유 baseline ID, parent baseline, root human approval, G-02 decision approval, approval mode, semantic diff, authority old/new hash, 영향·근거·actor·시각을 고정한다.
3. 파생 baseline은 설계서 v2.6의 content hash와 기능 범위·요구사항·중요 위험을 변경하지 않으며, revision 2에서 확정한 권위 문서 hash를 그대로 참조한다.
4. 기존 실패 보고서 `G-02_TEST_REPORT.md`와 `G-02_TEST_REPORT_R2.md`는 변경하지 않고 새 EvidenceManifest에 감사 증거로 포함한다.
5. DecisionRecord·EvidenceManifest·CompletionReport·progress/HANDOFF를 새 binding·파생 baseline과 target으로 재생성한다. 테스트계획·작업계획·매트릭스·운영규칙·Developer ACK는 변경하지 않는다.
6. 새 독립 Tester 보고서는 `docs/test_reports/G-02_TEST_REPORT_R3.md`로 분리한다.

## 보고 계약

작업자는 기본적인 hash·문서 정합성 검사를 실행하고 `판정 → 판단 이유 → 조치` 형식으로 CompletionReport를 작성한다. 독립 Tester는 산출물과 승인 binding을 원문에서 재계산한다.
