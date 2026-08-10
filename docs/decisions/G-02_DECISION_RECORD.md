# G-02 DecisionRecord — 결정 확정

- package_id: `G-02`
- work_instruction_id: `WI-G-02-20260810-001`
- work_instruction_revision: `3`
- work_instruction_sha256: `FB21506565A1D0FBF5CAE2DEB9593C3A811E29DAA9B18954D591CFA80E19F1A4`
- approval_ref: `APPROVAL-20260810-G02-DECISIONS-001`
- approval_subject_hash: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- parent_approval_ref: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- decision_authority: `신산님`
- parent_baseline_id: `BASELINE-G-01-20260810-001`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- derived_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- non_semantic_binding: `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md#sha256=8332635C9CE92B085AFFDF1B235F48945605DC87FA7294DA5FF88A589C95D03D`
- derived_baseline: `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md#sha256=E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- record_status: `REVISION_3_CORRECTED_AWAITING_INDEPENDENT_TESTER`

## 1. 판정

`HUMAN_CONFIRMED / REVISION_3_CORRECTED` — G-02 승인 기록의 D1~D10 계보와 Q-01, Q-03~Q-06 결정을 그대로 유지하고 Q-02를 `RESERVED_NOT_DEFINED`로 고정한다. `G02-DEF-001`의 authority 정규화는 유지하며, `G02-DEF-002`의 canonical parent/root/derived baseline 계보만 보완했다. 이 기록은 독립 Tester의 최종 합격 선언이 아니다.

## 2. D1~D10 승인 계보

| 결정 | 상태 | 계보·효력 |
|---|---|---|
| D1~D8 | `HUMAN_CONFIRMED` | G-02 승인 기록에 따라 통합 기준선 승인을 상속한다. |
| D9 | `BENCHMARK_POLICY_CONFIRMED` | benchmark 전에 제품을 선택하지 않는 정책을 유지하며 특정 제품을 확정하지 않는다. |
| D10 | `HUMAN_CONFIRMED` | G-02 승인 기록에 따라 통합 기준선 승인을 상속한다. |

상속 경로는 `APPROVAL-20260810-G02-DECISIONS-001` → `APPROVAL-20260810-INTEGRATED-BASELINE-001`이다. 이 문서는 승인된 결정의 의미를 완화하거나 확대하지 않는다.

## 3. Q-01~Q-06 결정

| ID | 승인 결정 | 상태 |
|---|---|---|
| Q-01 | Anvil 자체 테스트 스택은 `pytest + Playwright + JSON Schema + OpenAPI diff`, 대상 저장소 검증 도구는 Project Profile 기반 가변 도구로 분리한다. | `HUMAN_CONFIRMED` |
| Q-02 | 원문에 정의가 없으므로 새 요구사항을 발명하지 않는다. | `RESERVED_NOT_DEFINED` |
| Q-03 | Phase E 이전 독립 Tester는 개발 작업과 분리된 독립 Subagent 세션이 담당한다. | `HUMAN_CONFIRMED` |
| Q-04 | `RS-CRITICAL` 목표 시간을 30분으로 유지한다. | `HUMAN_CONFIRMED` |
| Q-05 | Golden set 기대값 변경 승인자는 Owner인 신산님으로 유지한다. | `HUMAN_CONFIRMED` |
| Q-06 | 초기 결함 대장은 Markdown을 정본으로 사용하고 관련 기능 구현 후 DB·화면으로 이관한다. 이관 전후 provenance와 ID를 보존한다. | `HUMAN_CONFIRMED` |

## 4. revision과 approval binding

| 항목 | 값 |
|---|---|
| 변경 전 revision | `v1.1` |
| 변경 전 SHA-256 | `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` |
| G-02 결정 반영 revision | `v1.2` |
| G-02 결정 반영 SHA-256 | `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` |
| revision 2 비의미 정규화 | `v1.3` |
| revision 2 SHA-256 | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` |
| 새 approval subject | `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91` |

각 content hash 변경은 직전 binding을 무효화한다. 테스트계획 v1.3과 작업계획 v1.4·매트릭스 v1.2·운영규칙 v1.4는 `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001`로 재확정됐으며, root human approval과 G-02 decision approval의 범위를 넓히지 않았다.

Canonical 계보는 `BASELINE-G-01-20260810-001` → `BASELINE-G-02-DERIVED-20260810-001`이다. `root_human_approval_id`는 `APPROVAL-20260810-INTEGRATED-BASELINE-001`, G-02 결정 승인은 `APPROVAL-20260810-G02-DECISIONS-001`이며 approval mode는 `MAIN_RECONFIRMED_NON_SEMANTIC`이다.

| 활성 권위 Artifact | revision | SHA-256 |
|---|---|---|
| `Anvil_작업계획서_v1.md` | v1.4 | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` |
| `Anvil_통합검증매트릭스_v1.md` | v1.2 | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` |
| `Anvil_테스트계획서_v1.md` | v1.3 | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | v1.4 | `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` |

## 5. 영향 범위

- Revision 2 변경: 활성 권위 문서의 revision, 승인 상태 표현, 상호 기준선 version/hash, 승인 binding과 증거 target
- Revision 3 변경: binding canonical 필드, 파생 DesignBaseline, DecisionRecord와 증거 target
- 유지: 테스트 범위, AV ID, 테스트 레벨, 심각도, 97개 Package, 255개 ID, DIR-1/2/3·DIR-X 계약
- 금지 유지: Q-02 요구사항 발명, 제품 코드·Git·서버·DB·배포 작업

## 6. 조치

독립 Tester가 두 실패 TestReport를 보존한 새 target에서 parent BaselineRecord, root/decision approval, binding, 파생 DesignBaseline, revision 2 고정 authority hash와 `AV-SAFE-033`을 재계산한다. `AV-GATE-026`의 97 Package·255 ID·DIR·역색인도 회귀 확인한다. PASS 전에는 G-02 최종 합격 상태를 기록하지 않는다.
