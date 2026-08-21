# Phase B Gate 권위문서 충돌 증거 패킷

## 1. 판정

- 상태: `BLOCKED / MATRIX_TESTPLAN_GATE_SCOPE_CONFLICT`
- 판정 시각: `2026-08-21T23:59:00+09:00`
- 기준 commit: `165a9bfff5e085bfec322c748e83464477642f8a`
- 기준 branch/upstream: `main / origin/main`
- 기준 상태: B-12 `ACCEPTED`, Phase B Gate `NOT_STARTED`, C-01 `BLOCKED_PENDING_B_GATE / NOT_STARTED`, worker/write lease `null`
- 금지한 동작: Phase B Gate WorkInstruction·lease·`PACKAGE_STARTED`·Gate PASS/FAIL 판정, C-01 시작, 제품 파일 수정, progress/HANDOFF/Event 수정

하위 문서의 검증 개수와 상위 Gate selector를 임의로 절충하면 요구사항을 변경하게 된다. 기존 승인·binding에서 이 충돌을 해소한 기록이 없으므로 Gate를 시작하거나 PASS로 판정할 수 없다.

## 2. 결박한 권위문서

| 문서 | SHA-256 | 관련 위치 |
|---|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | §44.2, §47.18-10~11 |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` | lines 380~389, Phase B Gate |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` | line 474, B Gate direct selector; lines 203~210, 546, 551, 573~574 |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` | line 392, `검증 ID 46건` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` | BLOCKED·증거 없는 PASS 금지 |
| `docs/progress/non-semantic-revision-bindings.json` | `6EEC08FF0812CB8E06C4103E4176C98B93A567AA050EBEADD59649177DFA02D3` | 현재 successor binding registry |

## 3. 충돌 재현

매트릭스 line 474의 B Gate selector를 범위 표기 그대로 펼치면 51개 slot이다.

| 범주 | selector | slot 수 | 정의 존재 수 | 문제 |
|---|---|---:|---:|---|
| STAT | `001~016`, `020~039`, `043` | 37 | 36 | `AV-STAT-029` 정의 없음 |
| SAFE | `002~005`, `025`, `028~029`, `033` | 8 | 8 | 없음 |
| UI | `016` | 1 | 1 | 없음 |
| OPS | `009` | 1 | 1 | 없음 |
| FLOW | `002`, `010~012` | 4 | 4 | 없음 |
| 합계 | — | **51** | **50** | 테스트계획의 **46건**과 불일치 |

정의가 존재하는 exact 50개는 다음과 같다.

```text
AV-STAT-001~016,
AV-STAT-020~028, AV-STAT-030~039, AV-STAT-043,
AV-SAFE-002~005, AV-SAFE-025, AV-SAFE-028~029, AV-SAFE-033,
AV-UI-016, AV-OPS-009,
AV-FLOW-002, AV-FLOW-010~012
```

추가로, 정의된 50개 중 아래 6개는 매트릭스의 책임 Package 역색인이 Phase B 이후에만 있다.

| 검증 ID | 정의 | 유일 책임 Package | Phase B Gate에서의 문제 |
|---|---|---|---|
| `AV-STAT-021` | dirty 저장소 충돌 시 원본 보존 후 사용자 선택 | `C-09` | C-01 전 Gate가 C-09 산출물을 선행 요구 |
| `AV-STAT-022` | 필수 도구 미설치 시 `BLOCKED TOOL_NOT_INSTALLED` | `C-14` | C-01 전 Gate가 C-14 산출물을 선행 요구 |
| `AV-STAT-023` | 테스트 DB/서비스 부재 시 Gate `BLOCKED` | `E-09` | Phase B Gate가 Phase E 산출물을 선행 요구 |
| `AV-STAT-024` | provider quota 소진 시 pause/checkpoint/next action | `E-08` | Phase B Gate가 Phase E 산출물을 선행 요구 |
| `AV-STAT-025` | 한도 소진 비실패·무승인 fallback 금지 | `E-08` | Phase B Gate가 Phase E 산출물을 선행 요구 |
| `AV-STAT-028` | 승인 만료·provider 실패 정책 처리 | `E-08` | Phase B Gate가 Phase E 산출물을 선행 요구 |

따라서 가능한 수치는 서로 다른 계약을 뜻한다.

- selector slot: `51`
- 정의된 ID: `50`
- 현재 책임 Package가 B 이전 또는 B에 있는 정의된 ID: `44`
- 테스트계획 명시값: `46`

## 4. 승인·binding 전수 확인

다음 범위를 `PHASE_B_GATE`, `B Gate`, `46`, `50`, `AV-STAT-029`, `AV-STAT-021/022/023/024/025/028`로 검색했다.

- `docs/approvals/` 전체 9개 승인 문서
- `docs/progress/non-semantic-revision-bindings.json`
- `docs/progress/dir-checkpoints.json`, `failure-ledger.json`, `progress-events.json`, `BUILD_HANDOFF.md`
- `docs/decisions/`, `docs/evidence/manifests/`, `docs/governance/`
- 설계서·작업계획서·통합검증매트릭스·테스트계획서

결과: 이 46/50/51·undefined·post-B 책임 충돌을 정합화하거나 exact B Gate ID 집합을 승인한 owner decision/binding은 없다. 기존 승인은 통합 baseline, G-02 결정, autonomous execution, A-01 책임, A-15 UX, DIR-1 계속, WorkPlan v1.6, ysna 내부 배포에 관한 것이며 본 Gate selector를 변경하지 않는다.

## 5. 필요한 최소 Owner 결정

### 선택지 A — dependency-safe split (`추천`)

- Phase B Gate direct set을 현재 정의되고 B 이전/B에서 책임지는 exact 44개로 명시한다.
- `AV-STAT-021/022/023/024/025/028`은 현재 책임 Package와 해당 후속 Gate에서 필수 검증한다.
- 정의 없는 `AV-STAT-029`는 B Gate selector에서 제거하고, 필요하면 별도 요구사항으로 정의·배정한다.
- 테스트계획의 `46건`을 exact 44개 목록과 일치시키고, 후속 6개가 전체 검증에서 누락되지 않음을 명시한다.

판단 이유: 현재 구현 순서를 역전시키지 않고, 증거 없는 선행 PASS를 만들지 않으며, 후속 요구사항도 삭제하지 않는다.

### 선택지 B — matrix-strict 선행 구현

- B Gate 전에 post-B 6개 계약을 구현할 B Package를 추가하거나 기존 B Package 책임을 확장한다.
- `AV-STAT-029`를 새로 정의·배정해 selector 51개를 모두 구현하거나, 명시적으로 제거해 50개로 확정한다.

영향: Phase B 범위·작업순서·테스트 비용과 provider/approval 위험이 크게 증가한다.

### 선택지 C — exact 46 owner enumeration

- `46건`을 유지하려면 Owner가 포함할 exact 46개 ID와 제외/이관할 exact ID를 직접 확정한다.
- post-B 6개의 선행성 처리와 `AV-STAT-029`의 정의 여부를 함께 결정해야 한다.

영향: 숫자만 유지하는 결정은 불충분하며, exact 목록이 없으면 동일 충돌이 재발한다.

## 6. 영향 범위와 다음 안전 행동

- 영향 문서: 작업계획 Phase B Gate, 통합검증매트릭스 §7/§8 책임 역색인, 테스트계획 §10.3, 향후 Phase B Gate WorkInstruction·TestReport·DecisionRecord.
- 비영향: B-01~B-12 accepted 제품 bytes, B-12 독립 Tester 판정, 기존 DB migration/API/recovery 구현, A Gate/DIR-1 승인.
- 현재 안전 행동: Owner decision 전 Phase B Gate와 C-01을 시작하지 않고 이 증거 패킷만 handoff한다.
- rollback: 이 파일은 제품·progress·Event와 연결되지 않은 report-only artifact다. 채택 전에는 삭제만으로 원상복구된다.
