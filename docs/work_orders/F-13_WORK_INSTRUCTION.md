# F-13 WorkInstruction — Operations/Observability read model 및 API

## 기준·결과

- 담당: `developer-primary-f13-r1`; branch `codex/f13-operations-read-model`; 시작 기준 main `a612fdac2c7eabbb381e8da9d3111d797460f9bf`.
- 정본 hash: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`.
- 상세 기준: `Anvil_작업계획서_v1.md` F-13, 설계 §15.4/16.2/19/29.2/29.10/47.13/49.17, `docs/architecture/a11/A-11_OPERATIONS_MONITORING_CATALOG.json` SHA-256 `8EC87BDDB3107F572EF73AA534D6119D783CB408E22F4192477D25FB270DC109`; 검증 AV-OPS-001~006 중 API/read-model 해당 부분.
- 목적: 기존 소유 객체의 확인된 상태를 Dashboard/Operations 조회용 projection으로 결합하고, 이상 탐지·alert dedupe/ack·감사·비용 예약/정산·배포 Monitoring을 source evidence와 함께 표시한다. `UNKNOWN`/stale/미연결을 정상으로 승격하지 않는다.

## R1 제품 write scope

1. `packages/observability/models.py` — 독립 health/alert/queue/worker/budget/deployment 상태와 공개 안전 필드.
2. `packages/observability/projection.py` — Queue, Lease, Budget, Provider, DB, Backend, Deployment 소유 관측값에서 snapshot 생성; 원천 상태 변경 금지.
3. `packages/observability/service.py` — source evidence가 있는 이상 탐지, alert dedupe와 actor가 있는 acknowledge/resolve, 감사 이력 및 next action 조정.
4. `packages/api/operations.py` — 인증·project/environment scope가 있는 Operations 조회 port. 확정 경로만 사용하고 미결정 command route는 생성하지 않는다.
5. `packages/api/registry.py` — 설계 §16.2에 명시된 `GET /api/operations/alerts`, `GET /api/operations/audit`만 canonical registry에 반영한다. 그 외 신규 공개 route 금지.
6. `packages/api/runtime.py` — host가 실제 소유자를 주입했을 때만 Operations port 결선; 소유자가 없으면 501/UNKNOWN으로 fail-closed.
7. `tests/observability/test_f13_operations.py` — 상태·staleness·fencing masking·quarantine·비용 lifecycle·alert dedupe/ack·Monitoring 전이 RED→GREEN.
8. `tests/api/test_f13_operations_api.py` — registry, project/environment/role 경계, 미결선 501, same-origin, 원문 token/Secret/내부 endpoint 비노출 RED→GREEN.
9. `docs/04_test_reports/F-13_COMPLETION_REPORT.md` — 실제 검증, 미검증, rollback을 기록.

위 경로 밖 제품 변경은 Main의 write lease revision 전까지 금지한다. Main은 control/progress 파일만 별도 소유한다. Developer는 commit·push·PR·merge를 하지 않는다.

## 구현·검증 계약

- QueueJob/QuarantinedJob, WorkerLease/WriteLease, BudgetSnapshot/Reservation/Reconciliation, ProviderStatus 등 기존 owner의 공개 read 계약을 재사용한다. shadow authority, 직접 내부 dict 조회, 가짜 healthy/default 비용 0 생성 금지. 현재 owner가 제공하지 않는 관측값은 `UNKNOWN`과 source gap으로 보존한다.
- health에는 observed_at·stale threshold·last check·error count·상세 링크를 둔다. stale/expired는 HEALTHY가 아니다. queue 우선순위·의존성·attempt/max·backoff·quarantine, worker epoch/expiry/conflict scope/drain·heartbeat를 표시하되 fencing token 원문은 노출하지 않는다.
- Alert는 detector rule revision·원인·영향·next action·deep link·dedupe key를 요구한다. acknowledge와 resolve는 다른 전이이며 resolve에는 근거가 필요하다. actor/time/approval ID/hash가 있는 append-only audit를 보존한다. 운영자가 결과를 강제로 성공 처리하는 기능은 만들지 않는다.
- 비용은 FORECAST→RESERVED→PROVIDER_REQUESTED→FINAL_USAGE_RECORDED→RECONCILED→REMAINDER_RELEASED를 구분한다. usage 미확정·quota 중단은 성공이나 0비용이 아니다. 배포는 PENDING~MONITORING~RELEASED 상태를 구분하고 smoke 단독으로 RELEASED를 만들지 않는다.
- 설계 §47.13이 v1 canonical endpoint 목록이라고 명시한 반면 §16.2는 Operations 그룹만 언급한다. R1에서는 §16.2의 정확한 두 조회 경로만 추가하고, alert acknowledge 등 미정 command 공개 route는 만들지 않는다. 내부 service의 ack 계약과 조회 projection을 검증하고 이 API 갭을 보고서의 미검증/후속 계약으로 기록한다. 기능 범위·요구사항·중요 위험 변경은 Main에 즉시 보고한다.
- 실제 U-01/U-10 화면, DB migration/backup/restore(F-14), 운영 배포/최종 Monitoring 판정(F-20), 라이브 Provider probe, Secret 값, WSL/Oracle 배포는 이 개발 write scope가 아니다. Main의 독립 검증은 별도다.
- TDD: 각 새 행위의 실패 테스트와 예상 실패를 먼저 기록하고 최소 구현 후 GREEN. 관련 `tests/queue tests/leases tests/budget tests/api tests/observability` 회귀, AST/compile, diff check, bare pytest 결과를 정확하게 보고한다. 기존 bare pytest collection 오류는 숨기거나 새 PASS로 승격하지 않는다.

## 완료보고

기준 hash·시작 HEAD/status, 실제 diff/파일, 명령/exit/결과, failure count, 미실행 및 외부 경계, 기존 동작 영향, rollback, progress/HANDOFF 갱신 여부를 `F-13_COMPLETION_REPORT.md`에 기록한다. Main의 독립 review와 G-05 및 branch lifecycle이 통과하기 전 F-13 acceptance를 주장하지 않는다.
