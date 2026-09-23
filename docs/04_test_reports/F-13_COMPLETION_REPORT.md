# F-13 Developer 완료보고 — Operations read model/API R1 + 독립 review 재작업 2회

## 판정

`COMPLETED` — 첫 독립 review `REWORK C1/I4`의 5개 결함과 재검토의 새 `Important 1`(100건 뒤 오래된 미해결 alert 접근 불가)을 같은 WorkInstruction exact9/lease에서 재작업하고 로컬 계약을 재검증해 Main Agent에 인계한다. 정식 `FAILURE_REPORT`는 아니다. F-13 최종 acceptance, 실제 PostgreSQL/브라우저/배포 검증을 뜻하지 않는다.

## 기준과 시작 상태

- 담당 `developer-primary-f13-r1`; branch `codex/f13-operations-read-model`; 시작 HEAD `a386011646b406535bfe4a5f2937493b6d510d88`; 시작 `git status --short --branch`는 branch/upstream 표시 외 clean이었다.
- main 기준 `a612fdac2c7eabbb381e8da9d3111d797460f9bf`.
- SHA-256 실측: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; A-11 catalog `8EC87BDDB3107F572EF73AA534D6119D783CB408E22F4192477D25FB270DC109`.
- canonical worker `worker-lease-f13-r1-20260924-001`, write `write-lease-f13-r1-20260924-001`: ACTIVE, actor/scope/execution fencing 연결, 2026-09-24 19:45 KST 만료. 제품 변경은 두 lease의 exact9 경로 안이다. 시작/종료 `G-05 project progress contract: PASS sequence=1450 reporting=AUTO_CONTINUE` (exit 0).

## 변경 파일과 기능

- `packages/observability/models.py`: 독립 health/alert/deployment 상태와 evidence/detail 경계. 불완전 RELEASED 신호를 거부한다.
- `packages/observability/projection.py`: Queue `get`/`quarantine`, Lease `active_worker`/`active_writes`, Budget `snapshot`/`reservation`/`dispatch_receipt`, Provider `list` 등 기존 공개 owner read만 조합한다. 누락·stale·expiry, queue retry/quarantine, fencing epoch/scope, 비용 예약/usage/reconcile, Monitoring을 구분한다. 토큰·payload·원문 내부 endpoint는 projection하지 않는다. owner가 제공하지 않는 priority/capability/drain/heartbeat는 `UNKNOWN`이다.
- `packages/observability/service.py`: host 주입 repository의 `load`/원자 `append(expected_sequence)`만 alert·audit 상태의 원천으로 사용하고 새 서비스 인스턴스가 같은 repository에서 복원한다. 별도 host 호출 `detect()`가 worker expiry, quarantine, `UNKNOWN`/`LATE`/`EXPIRED`/error count health, 비용 미정/할당 중단을 근거와 함께 탐지한다. GET 경로는 탐지를 실행하지 않는다. acknowledge와 resolve는 서로 다른 전이이며 actor/시각/승인 ID/정규식 `sha256` hash를 감사 이벤트로 남긴다.
- `packages/api/operations.py`, `packages/api/registry.py`, `packages/api/runtime.py`: canonical `GET /api/operations/alerts`, `GET /api/operations/audit` 두 경로, 별도 read permission, project/environment/role 검사, 명시 주입된 owner에만 결선. alerts는 bounded `{alerts, next_before_sequence}`만 반환하고 `x-alert-before-sequence` 헤더로 오래된 미해결 alert까지 페이지 조회한다. budget/worker/health projection은 노출하지 않는다. audit도 최신 100건과 `x-audit-before-sequence` 이전 페이지 계약이다. 미결선은 501. 명령 route는 추가하지 않았다.
- `packages/observability/models.py`: `//evil-host/path` 같은 protocol-relative 링크 거부와 same-origin 상세 경로 검사, evidence hash 검증.
- `tests/observability/test_f13_operations.py`, `tests/api/test_f13_operations_api.py`: owner 상태, UNKNOWN/stale, quarantine/expiry, token 비노출, 비용 불확정 및 quota, smoke만으로 RELEASED 불가, alert dedupe/ack/resolve/audit, owner 재인스턴스 복원, GET 순수 조회/권한, audit 페이지와 100건 상한, 정규화 및 protocol-relative 차단을 검증.
- 이 보고서. Main 소유 control/progress 파일은 수정하지 않았다.

## 검증 증거

- TDD RED: observability 최초 누락 모듈 6 FAIL(exit 1), API canonical route/port 누락 5 FAIL(exit 1). 보강 RED는 queue priority/health evidence·detail 안전성 2 FAIL(exit 1). 각 결함의 최소 구현 후 GREEN.
- R1 review 재작업 RED: repository 필수/복원, GET 순수 조회·격리, health 이상, protocol-relative 링크, 감사 상한·페이지 11 FAIL/6 PASS(exit 1). audit 페이지 계약 추가 시 2 FAIL/5 PASS(exit 1). 승인 ID 누락 거부 1 FAIL(exit 1). 해당 결함을 순서대로 GREEN으로 바꿨다.
- `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/observability/test_f13_operations.py tests/api/test_f13_operations_api.py --basetemp C:\Users\cyhuh\AppData\Local\Temp\anvil-f13-rework-green-002`: 18 PASS, exit 0(승인 ID 보강 직전). 승인 ID 보강은 관련 전체 회귀에 포함된다.
- 같은 Python으로 `-B -m pytest -q -rs -p no:cacheprovider tests/queue tests/leases tests/budget tests/api tests/observability --basetemp C:\Users\cyhuh\AppData\Local\Temp\anvil-f13-rework-related-001`: 655 PASS, 6 SKIP, exit 0, 10.93s. SKIP 6건은 `tests/queue/test_durable_queue.py` 1, `tests/leases/test_worker_write_fencing.py` 1, `tests/budget/test_atomic_reservation.py` 4이며 모두 격리 PostgreSQL 18 DSN 미설정이다.
- 같은 Python으로 bare `-B -m pytest -q -p no:cacheprovider --basetemp C:\Users\cyhuh\AppData\Local\Temp\anvil-f13-rework-bare-001`: 16 collection ERROR, exit 1, 실행 테스트 미시작. `yaml` 미설치, fixture `src` import, 중복 `test_models`/`test_repository`/knowledge module 이름 등 main의 기존 collection 문제와 동일하다. PASS가 아니다.
- 재검토 Important1 RED: 실제 만료 WorkerLease 101개로 alert 101개를 만든 후 `GET /api/operations/alerts`의 이전 응답이 목록 100건만 반환해 오래된 critical 1건에 접근할 수 없음을 `test_alert_pages_reach_all_101_unresolved_critical_alerts_without_mutating_owner`에서 1 FAIL(exit 1)로 재현했다. GREEN은 detection sequence 기준 최신 100건 + `x-alert-before-sequence` 이전 페이지로 101개 ID 모두 조회, 순수 GET(동일 repository event tuple), fencing token 비노출, 잘못된 cursor 400이다. `apps`/`packages` 검색에서 이 경로의 기존 U-01/U-10 소비자는 0건이라 현재 화면 소비 계약 변경은 없다.
- 같은 Python으로 `-B -m pytest -q -p no:cacheprovider tests/observability/test_f13_operations.py tests/api/test_f13_operations_api.py --basetemp C:\Users\cyhuh\AppData\Local\Temp\anvil-f13-alert-page-green-001`: 19 PASS, exit 0, 1.34s.
- 같은 Python으로 `-B -m pytest -q -rs -p no:cacheprovider tests/queue tests/leases tests/budget tests/api tests/observability --basetemp C:\Users\cyhuh\AppData\Local\Temp\anvil-f13-alert-page-related-001`: 656 PASS, 6 SKIP, exit 0, 10.81s. SKIP 사유는 위와 같은 격리 PostgreSQL 18 DSN 미설정이다.
- alert pagination 변경 후 변경 Python 8파일 `AST_OK 8`, `git diff --check` exit 0, G-05 `PASS sequence=1450 reporting=AUTO_CONTINUE` exit 0. 정확한 3개 alert-page basetemp를 확인·제거했고 `F13_ALERT_PAGE_TEMP_RESIDUE=0` exit 0.
- 변경 Python 8파일 `ast.parse` 결과 `AST_OK 8`, `git diff --check` exit 0, 프로젝트 `.venv` Python `-B scripts/check_project_progress.py .`는 `G-05 PASS sequence=1450 reporting=AUTO_CONTINUE`, exit 0.
- 테스트용 exact `anvil-f13-rework-*` basetemp 7개는 경로 확인 뒤 정리했고 `F13_REWORK_TEMP_RESIDUE=0`, exit 0. 이전 R1 basetemp 10개도 잔류 0이다.

## 미검증과 잔여 위험

- API/owner는 로컬 계약이다. 같은 주입 repository를 공유하는 새 `OperationsService`에서 alert 상태와 actor/시각/승인 ID/hash 감사 복원은 테스트 PASS다. 실제 PostgreSQL durable adapter·프로세스 재시작/멀티 인스턴스·DB/컨테이너 결선은 `NOT_EXECUTED`다. 이 구현은 저장소 인터페이스만 제공하며 PG durable adapter를 생성하지 않았다.
- 실제 `apps/api/anvil_api/asgi.py:56`은 `create_runtime_app()`을 무인자 호출하고, 현재 `packages`/`apps`에 `operations_owner` 주입 caller가 없다. 따라서 실제 운영 기본 Operations 두 GET 경로는 501이며 synthetic TestClient의 명시 owner 200을 운영 API PASS로 승격하지 않는다. 주기적 host detector 호출도 아직 없다.
- DB/backend/deployment 및 priority/capability/drain/heartbeat는 해당 source가 관측을 제공하지 않으면 `UNKNOWN`/source gap이다. 이 값을 건강함/비용 0/배포 완료로 승격하지 않는다.
- alert acknowledge/resolve는 내부 owner 계약만 검증했다. §47.13 canonical command가 미확정이라 공개 command API는 없다. audit API는 최신 100건과 `x-audit-before-sequence` 이전 페이지 계약이며 owner repository가 전체 이력을 보유한다.
- 실제 U-01/U-10 화면, 브라우저 Network, WSL-server 정식 DB/컨테이너, PG18, 실제 Provider, Oracle/운영 배포는 `NOT_EXECUTED`. bare pytest 16 collection ERROR와 PG18 DSN 6 SKIP는 관련 656 PASS의 한계다. Main 독립 재review, G-05 최종, PR/main 병합, merged-main smoke 전 acceptance가 아니다.
- 기존 Queue/Lease/Budget/Provider owner mutation은 없다. 관련 회귀 656 PASS/6 SKIP. 제품 diff exact9의 신규 read 경로와 명시 owner binding만 영향을 받는다.

## 실패 횟수·rollback·다음 조치

- 동일 근본 원인 정식 `FAILURE_REPORT` 0회. R1 독립 review는 `REWORK C1/I4`였으며 이번 수정은 같은 WI/lease의 비정식 재작업이다. TDD RED는 예정된 실패 테스트다. 도구 PATH의 `python` 부재 1회는 절대경로 Python으로 해소했다.
- rollback: Main이 F-13 branch의 이 작업 diff 9경로를 검토한 후 필요 시 해당 commit/PR을 병합하지 않으면 기존 main 동작이 유지된다. 이미 적용한 branch에서 되돌릴 때 Main의 검증된 F-13 변경 commit에 대해 정상 revert를 수행한다. 사용자 dirty/untracked와 다른 worktree는 보존했다.
- 다음: Main 독립 spec/quality review와 추가 필수 gate를 실행하고, 지속 감사/모니터링 host 결선의 실제 경계를 검토한다. 완료 뒤 Main이 commit·push·PR/병합·merged-main smoke 및 branch/worktree 정리를 소유한다.
- `docs/progress/build-progress.json`과 `docs/progress/BUILD_HANDOFF.md`는 Main 소유이므로 Developer가 변경하지 않았다. Main이 검토 결과로 갱신한다.
