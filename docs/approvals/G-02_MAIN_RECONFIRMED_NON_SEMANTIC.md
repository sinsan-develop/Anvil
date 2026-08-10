# G-02 Main Reconfirmed Non-Semantic Binding

- binding_id: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001`
- binding_revision: `3`
- package_id: `G-02`
- finding_refs: `G02-DEF-001`, `G02-DEF-002`
- work_instruction_id: `WI-G-02-20260810-001`
- work_instruction_revision: `3`
- work_instruction_sha256: `FB21506565A1D0FBF5CAE2DEB9593C3A811E29DAA9B18954D591CFA80E19F1A4`
- parent_baseline_id: `BASELINE-G-01-20260810-001`
- parent_baseline_ref: `docs/baselines/G-01_BASELINE_RECORD.md#sha256=8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B`
- derived_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- derived_baseline_ref: `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- reconfirmed_by: `Main Agent 어울`
- recorded_by: `governance-decision-writer Subagent`
- recorded_at: `2026-08-10T12:35:36.0485175+09:00`
- root_human_approval_ref: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- root_human_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- decision_approval_ref: `APPROVAL-20260810-G02-DECISIONS-001`
- decision_subject_hash: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- semantic_diff: `NONE`
- status: `REVISION_3_ACTIVE_AWAITING_INDEPENDENT_TESTER`

## 판정

`MAIN_RECONFIRMED_NON_SEMANTIC` — revision 2에서 `G02-DEF-001`을 해결한 권위 문서 hash를 그대로 유지하고, revision 3에서 `G02-DEF-002`가 지적한 canonical parent/root/derived baseline 필드만 보완했다. 기능 범위·요구사항·중요 위험의 변경은 없다.

## Canonical parent-child 계보

```text
BASELINE-G-01-20260810-001
  + root_human_approval_id=APPROVAL-20260810-INTEGRATED-BASELINE-001
  + G-02 decision approval=APPROVAL-20260810-G02-DECISIONS-001
  + approval_mode=MAIN_RECONFIRMED_NON_SEMANTIC
  -> BASELINE-G-02-DERIVED-20260810-001
```

파생 기준선 artifact는 `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md`다. binding과 파생 기준선의 실제 file hash는 EvidenceManifest가 동일 target 안에서 함께 고정한다.

## 변경 전·후 binding

| Artifact | 변경 전 revision / SHA-256 | 변경 후 revision / SHA-256 | 의미 변경 |
|---|---|---|---|
| `Anvil_작업계획서_v1.md` | v1.3 / `A88FCA548143B4C5208E106EBDF6009E438806547513A7C89F50A9E922C5C335` | v1.4 / `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | `NONE` |
| `Anvil_통합검증매트릭스_v1.md` | v1.1 / `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` | v1.2 / `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | `NONE` |
| `Anvil_테스트계획서_v1.md` | v1.2 / `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` | v1.3 / `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | `NONE` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | v1.3 / `71006092D9A1A6F97DD47ECB2436C5986A3632A27CC1C7942D921911490A8C74` | v1.4 / `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` | `NONE` |

모든 변경 전 content hash의 기존 binding은 무효화한다. 변경 후 artifact는 이 binding에서 위 root human approval의 범위를 상속하며, G-02 결정값은 별도 decision approval subject의 범위를 그대로 유지한다.

## 유지 불변식

- Work Package: 97개 유지
- AV ID: 255개, CON 불변식 21개, 고유 실행 ID 234개 유지
- DIR: DIR-1=A-15, DIR-2=C-15, DIR-3=E-11, 조건부 DIR-X 및 DIR-3 유지 계약 변경 없음
- 테스트 범위·ID·레벨·심각도·종료 기준 변경 없음
- D1~D8·D10 `HUMAN_CONFIRMED`, D9 `BENCHMARK_POLICY_CONFIRMED`
- Q-02 `RESERVED_NOT_DEFINED`; 새 요구사항 없음
- 제품 코드·Git·서버·DB·배포 변경 없음

## 영향

- 영향 있음: 문서 revision, 활성 승인 상태, 짝 문서 version/hash, 현재 진행 상태, 증거 target
- 영향 없음: 제품 동작, 공개 API, 데이터, 보안·권한, 비용 한도, 배포·복구 계약, Package/AV/DIR 구조

## 조치

파생 DesignBaseline과 DecisionRecord·EvidenceManifest·CompletionReport·progress/HANDOFF를 새 target으로 재생성한다. revision 2 권위 문서와 Developer ACK는 변경하지 않는다. 독립 Tester PASS 전에는 G-02 최종 합격 상태나 G-03 착수를 기록하지 않는다.
