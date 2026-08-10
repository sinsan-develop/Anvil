# G-07 통합 기준선 독립 정규화 검증 보고서

- validator_status: `PASS`
- package_status: `ACCEPTED_AWAITING_PHASE_G_GATE`
- mapping_hash: `AE9838B35B430703E16255B6C34C084B7F917B063171BD98F61460F8CFA8F8AF`
- G Gate readiness: `ACCEPTED_AWAITING_PHASE_G_GATE`

## 판정

`ACCEPTED / GATE_REVIEW` — 독립 Tester PASS와 Main Agent 수락을 증거화했다. 별도 Phase G Gate 결정 전에는 Gate 완료 또는 A-01 READY가 아니다.

## 재계산 결과

- Package: `97` / unique `97` / 역색인 `97`
- AV: `255` / unique `255` / executable `234` / constitutional `21`
- 미할당 또는 미집행 AV: `0`
- §49.17 trace: `20/20`

## 권위 기준선

| path | version | SHA-256 |
|---|---|---|
| `Anvil_설계서_v2.md` | `v2.6` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `v1.4` | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` |
| `Anvil_통합검증매트릭스_v1.md` | `v1.2` | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` |
| `Anvil_테스트계획서_v1.md` | `v1.3` | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `v1.5` | `7D5E2AD0F272CBA1052EA8A21622F1E16438ABAB9AA4AAB7A1D34374B4FFB5F3` |

## DIR·환경·배포

- DIR-1=A-15 누적 22, DIR-2=C-15 누적 49, 조건부 DIR-X, DIR-3=E-11 누적 73을 parser로 대조했다.
- Local→WSL-server PostgreSQL 15→격리 PostgreSQL 18 RC→ysna-server/`envil.sinsan.kr`와 Git-only 승격 계약을 대조했다.

## G Gate 경계

- G-04 `AV-FLOW-003`, G-05 `AV-STAT-015/016`, G-01 `AV-CON-016(RV)`의 기존 독립 PASS evidence를 재결박했다.
- `AV-GATE-026`은 G-07 Developer 검증까지만 완료됐고 독립 Tester PASS와 Main ACCEPTED 전에는 Gate PASS로 집계하지 않는다.
- §49.17 20건은 `DESIGN_LOCKED / NOT_EXECUTED`이며 runtime·제품 PASS가 아니다.

## 오류

- 없음

## 미검증 범위

- `runtime_scenarios_20`
- `fault_injections_8`
- `product_api_ui_db_wsl_production`
- `g_gate_completion`

## 조치

독립 Tester가 동일 revision을 적대 재검증한 뒤 Main Agent가 G-07 수락과 G Gate 판정을 별도로 수행한다. A-01은 시작하지 않는다.
