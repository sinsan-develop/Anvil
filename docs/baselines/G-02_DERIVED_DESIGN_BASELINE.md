# G-02 Derived DesignBaseline

- baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- baseline_type: `DERIVED_DESIGN_BASELINE`
- package_id: `G-02`
- parent_baseline_id: `BASELINE-G-01-20260810-001`
- parent_baseline_ref: `docs/baselines/G-01_BASELINE_RECORD.md`
- parent_baseline_sha256: `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- root_human_approval_ref: `docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md`
- root_human_approval_sha256: `94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7`
- root_human_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- decision_approval_id: `APPROVAL-20260810-G02-DECISIONS-001`
- decision_approval_ref: `docs/approvals/APPROVAL-20260810-G02-DECISIONS-001.md`
- decision_approval_sha256: `40D01092F1DBEA6BB3860A154630FE2AF5CF9DEBD0C6F5BC531EE8FDC43C2DB6`
- decision_subject_hash: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- approval_mode: `MAIN_RECONFIRMED_NON_SEMANTIC`
- binding_id: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001`
- binding_ref: `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md`
- work_instruction_id: `WI-G-02-20260810-001`
- work_instruction_revision: `3`
- work_instruction_sha256: `FB21506565A1D0FBF5CAE2DEB9593C3A811E29DAA9B18954D591CFA80E19F1A4`
- semantic_diff: `NONE`
- derived_by: `Main Agent 어울`
- recorded_by: `governance-decision-writer Subagent`
- derived_at: `2026-08-10T12:35:36.0485175+09:00`
- status: `ACTIVE_AWAITING_INDEPENDENT_TESTER`

## 판정

`DERIVED / MAIN_RECONFIRMED_NON_SEMANTIC` — G-01 승인 기준선에서 G-02 revision 2 권위 문서 집합으로 이어지는 parent-child 계보를 생성한다. 설계서 v2.6의 content hash, 기능 범위, 요구사항과 중요 위험은 변경하지 않는다.

## 설계 기준선 불변

| Artifact | Version | SHA-256 | 파생 영향 |
|---|---|---|---|
| `Anvil_설계서_v2.md` | v2.6 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | 변경 없음 |

## Authority 파생 binding

| Artifact | Parent revision / SHA-256 | Derived revision / SHA-256 | semantic diff |
|---|---|---|---|
| `Anvil_작업계획서_v1.md` | v1.3 / `A88FCA548143B4C5208E106EBDF6009E438806547513A7C89F50A9E922C5C335` | v1.4 / `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | `NONE` |
| `Anvil_통합검증매트릭스_v1.md` | v1.1 / `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` | v1.2 / `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | `NONE` |
| `Anvil_테스트계획서_v1.md` | v1.2 / `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` | v1.3 / `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | `NONE` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | v1.3 / `71006092D9A1A6F97DD47ECB2436C5986A3632A27CC1C7942D921911490A8C74` | v1.4 / `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` | `NONE` |

## 영향과 근거

- 영향 있음: 승인 계보 식별자, 파생 baseline artifact, binding·manifest·completion·progress/HANDOFF hash와 target
- 영향 없음: 제품 동작, 공개 API, 데이터, 보안·권한, 비용 한도, 배포·복구 계약, 테스트 범위·ID·레벨·심각도·종료 기준
- 근거: `G02-DEF-002`가 `parent_baseline_id`와 파생 DesignBaseline 부재를 `AV-SAFE-033` 위반으로 판정했다.
- 승인 범위: root human approval과 G-02 decision approval을 대체하거나 확대하지 않는다.

## 유지 불변식

- Work Package 97개
- AV ID 255개(CON 21개, 고유 실행 234개)
- DIR-1=A-15, DIR-2=C-15, DIR-3=E-11, 조건부 DIR-X와 DIR-3 유지
- D1~D8·D10 `HUMAN_CONFIRMED`, D9 `BENCHMARK_POLICY_CONFIRMED`
- Q-02 `RESERVED_NOT_DEFINED`
- Revision 2 권위 문서 4개와 Developer ACK의 content/hash 변경 없음

## 조치

EvidenceManifest가 parent BaselineRecord, 두 사람 승인, 두 실패 TestReport, binding, 이 derived baseline과 revision 2 authority/ACK를 한 canonical target으로 고정한다. 독립 Tester PASS 전에는 G-02 최종 합격 상태를 기록하지 않는다.
