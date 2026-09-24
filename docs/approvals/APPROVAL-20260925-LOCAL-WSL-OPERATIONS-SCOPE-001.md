# 2026-09-25 Local·WSL-server 운영 유사 검증 범위 변경 기록

- approval_id: `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`
- decided_by: `신산님`
- decision: `APPROVED_BY_DIRECT_INSTRUCTION`
- semantic_classification: `HUMAN_APPROVED_FUNCTION_SCOPE_AND_IMPORTANT_RISK_CHANGE`
- parent_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- user_instruction: `작업계획서에서 ysna-server 운영 검증은 제외하거나 WSL-server운영검증으로 변경해`
- selected_option: F-18~F-20의 현재 필수 검증을 WSL-server의 분리된 운영 유사 환경으로 변경한다. Local 개발→Git push→WSL-server exact Git 수신·테스트 흐름을 유지한다.

## 승인된 영향 범위

| Artifact | 새 SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` v2.8 | `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712` |
| `Anvil_작업계획서_v1.md` v1.7 | `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB` |
| `Anvil_통합검증매트릭스_v1.md` v1.5 | `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6` |
| `Anvil_테스트계획서_v1.md` v1.6 | `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014` |
| `AGENTS.md` | `C57A84A841E5D09767AE618BBE6283FE82E09F1532AFB22AD76E9BB3EA0A1757` |
| `docs/governance/ANVIL_OPERATING_RULES.md` v1.7 | `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0` |
| `docs/DEVELOPMENT_ENVIRONMENT.md` | `F84D0FBC06C3B5EC9EC9E3E757E24247DF121E6CC261E73E3135BBF9164AEFF2` |

## 판정 경계

- 기존 완료 Package의 결과·증거·승인은 소급 변경하지 않는다. F-18/F-19/F-20의 향후 새 검증만 이번 revision에 따른다.
- `ysna-server`, `shared-db` 운영 DB, `envil.sinsan.kr` 공개 도메인, 실제 Production DeployApproval·Monitoring·사용자 운영 인수 및 `RELEASED`는 현재 작업계획의 필수 검증·완료조건에서 제외한다.
- WSL-server Test/Staging과 별도 격리 운영 유사 target을 구분하고 동일 Git commit·digest·ReleaseManifest, PG18 전용 DB/role, 실제 브라우저 Network, Provider/egress/secret, backup/restore/rollback과 Monitoring을 검증한다. 임시 합성·fixture PASS는 정식 WSL 통합 PASS로 승격하지 않는다.
- F-20은 WSL 범위에서 독립 Tester 합격을 판단할 수 있으나 Production 상태는 `NOT_EXECUTED`, ReleaseDecision은 `DEFER`이며 `RELEASED`로 표시하지 않는다. 장래 Production Release는 별도 계획·승인·검증이 필요하다.
- 계획 변경은 완료 증거의 기준을 좁히는 의미 변경이다. 과거 승인 hash를 새로운 범위의 승인으로 가장하거나 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 분류하지 않는다.
