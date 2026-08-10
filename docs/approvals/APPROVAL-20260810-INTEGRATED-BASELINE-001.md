# Anvil 통합 기준선 승인 기록

- approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- decided_by: `신산님`
- decided_at: `2026-08-10`
- decision: `APPROVED`
- subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- scope: 설계서 v2.6, 작업계획서 v1.3, 검증문서 v1.1, 운영규칙 v1.3, D1~D10 진행 기준
- user_instruction: `승인해 작업 시작해`

## 승인 대상

| Artifact | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `A88FCA548143B4C5208E106EBDF6009E438806547513A7C89F50A9E922C5C335` |
| `Anvil_통합검증매트릭스_v1.md` | `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` |
| `Anvil_테스트계획서_v1.md` | `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` |
| `AGENTS.md` | `BFF4DB0D1C17EF0794666A56A3156C92A53E1EE1D54ADFFFEB462571AAEEE3EA` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `71006092D9A1A6F97DD47ECB2436C5986A3632A27CC1C7942D921911490A8C74` |
| `docs/onboarding/developer-primary-ack.md` | `282EED40F563B87373C8952111BA5834E1ACF48BDB0E05949E5370ED51AB4246` |
| `C:\Users\cyhuh\OneDrive\문서\AI 자료\MoaWorks_Subagent_단계적_적용_권고안.docx` | `0C033D15389AE00DAC27373D028DE7FF375EE2855925714804C55C741AC7B77D` |

## D1~D10 효력

- D1~D8·D10은 설계서 23장의 현재 권장안을 구현 진행 기준으로 승인한다.
- D9는 특정 제품을 미리 확정한 것이 아니라 고정 fixture benchmark 뒤 선택한다는 정책을 승인한다.
- G-02는 D1~D10을 다시 결정하지 않고 승인 계보를 ADR에 고정하며, Q-01~Q-06과 남은 검증 할당 결정을 처리한다.

## 변경 통제

대상 hash 변경 시 이 binding은 무효화한다. 기능 범위·요구사항·중요 위험 변경은 신산님 재승인, 나머지는 `MAIN_RECONFIRMED_NON_SEMANTIC` 계약을 따른다.
