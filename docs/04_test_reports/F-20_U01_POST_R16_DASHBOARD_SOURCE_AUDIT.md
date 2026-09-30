# F-20/U-01 R16 이후 Dashboard source·C30 경계 감사

## 판정

`READ_ONLY_AUDIT_COMPLETE; U01_F20_NOT_ACCEPTED`. R16의 scoped Run 집계는 내부 순수 결과이며 현재 Dashboard의 운영 카드나 공개 응답에 반영되지 않는다. C30 Event 원문 사고는 계속 `OPEN_BLOCKING`이고 ReleaseDecision은 `DEFER`다. 이 감사는 제품·Event·DB·API·브라우저를 변경하거나 수락을 판정하지 않는다.

## 확인 근거

- 기준 checkout: 기존 `codex/f18-wsl-ops` / `83156663d83f0f64468470b4675846fa9ea5653a`, 추적 ref `development/codex/f18-wsl-ops`, 시작 Git clean. R16 종료 Event seq1890, worker/write lease null. 로컬·사설 원격·WSL-server 격리 QA checkout 동일 SHA와 G-05 PASS는 R16 종료 기록에 있다.
- 설계 §29.2는 6개 Health 카드, 실행 중·승인 대기·BLOCKED 등 2행 카드, 우선순위·대상·이유·경과시간·작동하는 이동을 가진 Next Actions를 요구한다. `apps/web/src/console/App.tsx`의 2행은 현재 `UNAVAILABLE` 문구이며 Next Actions 항목은 렌더링하지 않는다.
- `packages/persistence/operations_run_read.py`는 인가된 Project/Environment 범위의 Run을 100행 한도로 읽고, `packages/observability/run_status_summary.py`는 그 결과의 ACTIVE/WAITING_APPROVAL/BLOCKED를 내부 집계한다. 현재 `apps/api/anvil_api/oidc_process.py`의 Operations source loader는 Queue만 주입한다. `packages/observability/projection.py`의 `OperationsSources` 및 `packages/api/operations.py`의 Dashboard 공개 envelope에는 Run/Agent 상태 필드가 없다. 따라서 R16 PASS를 화면·공개 API PASS로 승격하지 않는다.
- 현재 `OperationsService.snapshot()`의 Next Actions는 저장 Alert의 priority/reason/target/action/deep_link만 파생하고 경과시간이 없다. `/operations/workers`, `/operations/queue`, `/operations/cost` 링크는 현재 App의 실제 원인 상세 화면이 아니다. 이들을 작동하는 이동 버튼으로 표시하면 설계의 금지조건을 위반한다.
- C30 사고 원인 commit `14c8c5743890c4a8a58686b9430144a55b1317e`은 `docs/progress/progress-events.json`을 대량 재직렬화했다. R5e 결과의 역사 prefix 3,994,695 bytes/SHA `BDB3AA...`와 현재 같은 prefix 4,022,935 bytes/SHA `50195E...`는 다르다. R5e 검증은 차이를 탐지하고 CRITICAL 차단을 유지할 뿐 원문을 복원하지 않았다. 현 raw 원장·역사 Git blob·고정 manifest를 묶어 고치는 일은 독립 복구 설계와 파괴/계약 영향 판정 없이 실행하지 않는다.

## 영향·다음 안전 작업

1. 기존 branch에서 U-01의 내부 authoritative source 연결을 한 단위씩 진행하되 Run/Agent/Queue/Worker 수를 서로 대체하지 않는다. 다음 후보는 R12/R16의 Run 읽기·집계가 host에서 실제 인가 범위를 유지하는지 확인하는 **내부** binding 계획이다. 공개 JSON/API·UI·권한·DB schema를 건드리지 않는 경계로 먼저 분리한다.
2. 공개 Dashboard 계약·화면 연결과 Next Actions 이동은 기존 응답/route/권한 및 검증 영향이 확인된 별도 단위로 설계한다. 필요한 변경이 승인된 U-01 범위를 넘거나 중요 위험을 바꾸는 경우에만 변경 승인을 요청한다. 작동하지 않는 링크는 만들지 않는다.
3. C30 원장 복구는 현 사고 Event·원본 Git blob·후속 24개 semantic Event·digest/manifest·rollback을 모두 고려한 별도 복구 절차가 필요하다. 그 전에는 CRITICAL/blocking/DEFER, F-20 미수락, main 병합·새 branch 금지를 유지한다.

이번 감사에서 실행한 것은 설계/계획, R5e/R16 결과, 실제 소스, Git commit 통계와 상태의 읽기뿐이다. 테스트 신규 실행·WSL runtime/DB/브라우저/Production 변경은 0이다. 이전 R16 동일 SHA 59 PASS는 내부 Python 범위로만 유효하다.
