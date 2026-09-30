# F-20/U-01 R18 Run host 격리 PostgreSQL 15 QA 계획

## 목적·기준

승인된 U-01 Dashboard의 실제 Run read model을 위해 R17 OIDC host가 R12의 범위 지정 PostgreSQL 조회와 R16의 상태 요약을 정확히 연결하는지 검증한다. 시작 기준은 기존 `codex/f18-wsl-ops`의 `a4eed416f492f9e8be53ae9b922e68bcfa966359`, clean, G-05 seq1896 PASS, worker/write lease null이다. R12의 실제 PG15 조회 PASS와 R17의 동일 SHA Python 144 PASS/1 opt-in SKIP은 각각 유효하지만, 둘을 합쳐 R17 host의 실제 DB PASS로 표시하지 않는다.

## 범위·검증 계약

- 단일 Developer의 제품 write는 신규 opt-in 검증 `tests/api/test_f20_u01_r18_run_host_pg15.py`와 결과 `docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md` exact2뿐이다. 운영 코드·공개 API/BFF/JSON·UI·DB schema/migration·권한·Secret은 변경하지 않는다. 이 범위에서 결함이 드러나면 안정 실패를 기록하고 별도 영향 판정·WorkInstruction revision 없이 운영 코드를 고치지 않는다.
- 테스트는 `ANVIL_U01_R18_PG_DSN`과 `ANVIL_U01_R18_PG_ISOLATED=1`이 모두 있을 때만 실행한다. 둘 다 없으면 명시적 SKIP, 일부만 있거나 PostgreSQL 외 DSN·공유 5432·127.0.0.1 외 host·`anvil_u01_r18` 외 DB/role이면 DB 접속 전 거부한다. Secret 원문은 로그·결과·Git에 쓰지 않는다.
- WSL-server의 별도 PostgreSQL 15, migration head `0019_oidc_sessions`, 비-superuser·빈 전용 DB를 fail-closed preflight한다. 합성 Project/Environment와 Run을 정식 repository 경로로 seed한 후 `create_oidc_process_app`의 trusted scope에서 `operations_owner.run_summary()`를 두 시점에 호출한다. 해당 범위의 `ACTIVE`·`WAITING_APPROVAL`·`BLOCKED`만 배타 집계하고 교차 Project/Environment 자료는 제외하며, 잘못된 scope·legacy NULL·101행·DB 실패는 안정 비가용 오류다. Queue snapshot/alert/audit GET는 Run 요약 호출 전후에 변경되지 않아야 한다.
- 로컬에서는 잘못된 DSN/부분 opt-in 선행 거부와 기존 R17/R12 인접 테스트를 실행한다. WSL-server에는 로컬의 안전 commit을 사설 원격에 push한 정확한 SHA만 기존 격리 QA checkout으로 FF한다. 격리 PG 실측은 R18의 자체 개발 QA이지 정식 브라우저 E-SHOT/E-NET 또는 메뉴 acceptance가 아니다.

## 일회성 WSL-server 자원·수명

생성 전 read-only 확인에서 이름 `anvil-u01-r18-pg`, loopback `127.0.0.1:5548`, `/tmp/anvil-u01-r18-venv`, `/tmp/anvil-u01-r18-pytest`가 모두 비어 있다. cached `postgres:15` image를 고정 ID 확인 후 scope/SHA label·AutoRemove·DB data tmpfs·다른 bind/volume 0으로 단일 container를 만든다. PostgreSQL role/database는 `anvil_u01_r18`로 한정하고 합성 자격은 실행 환경에서만 전달한다. 전용 venv에는 pinned runtime/migration/test 의존성만 설치한다. QA 성공·실패·중단 시 container 정확한 ID/label/image/mount/port와 경로 realpath/소유자/link/활성 프로세스를 확인한 뒤 R18 자원만 제거하고 이름·port·venv·pytest 잔여0을 검증한다. 공유 DB/Docker/`/srv`·ysna/Production은 건드리지 않는다.

## 순서·완료 경계

1. Main이 본 계획 hash와 기존 기준 SHA를 WorkInstruction/Invocation에 결박하고 dual lease를 제품 exact2에만 발급한다. Developer는 RED→GREEN 및 인접 로컬 검증을 수행하고 결과를 보고한다. Main은 같은 제품 경로를 동시 수정하지 않는다.
2. Main이 diff·테스트·G-05를 독립 검토해 제품 checkpoint를 기존 branch에 commit/private push하고, WSL-server 기존 checkout을 동일 SHA로 FF한다. 격리 PG15에서 실제 host 검증과 인접 테스트를 실행하고 정확한 임시 자원을 정리한다.
3. 결과와 미검증을 WORK_STATUS에 기록하고 QA checkpoint/private push→WSL 동일 SHA 확인 후 write→worker 순서로 lease를 회수한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락, main 미병합·새 branch0을 유지한다.

회귀 시 R18 신규 테스트/결과만 정상 revert해 R12/R16/R17 제품 코드를 보존한다. 실제 PG15 결과가 PASS여도 공개 Dashboard 표시, 실제 브라우저, PostgreSQL 18 RC, 최종 F-20 수락이나 Production 증거로 승격하지 않는다.
