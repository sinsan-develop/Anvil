# WorkInstruction — F-20/U-01 R18 Run host 격리 PostgreSQL 15 QA

- 담당: `developer-primary-f20-u01-r18`; 분류: 승인된 U-01 내부 Run host의 실제 DB 검증 추가. 기능 범위·요구사항·중요 위험 변경 없음.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R18 계획 SHA-256 `94B93303DB6A2832BE7393AECCE452B2BD54E861B96D1CBE82D4791A072A6D87`. Dispatch는 본 WI·Invocation의 기존 branch commit/private push→WSL-server 동일 SHA 및 canonical 신규 epoch dual lease ACTIVE 확인 뒤에만 한다.

## 목표와 exact2 write scope

1. `tests/api/test_f20_u01_r18_run_host_pg15.py`: WSL-server opt-in 실제 PostgreSQL 15 단일 테스트를 추가한다. 두 환경변수 모두 미설정은 SKIP, 부분 설정·비격리/공유 DSN은 DB 접근 전 거부한다. 허용 DSN은 `postgresql+psycopg`/`postgresql`, host `127.0.0.1`, port `5548`, role/database `anvil_u01_r18`, query 없음이고 `ANVIL_U01_R18_PG_ISOLATED=1`이어야 한다. 연결 후 major15·비-superuser·migration head0019·대상 기본 테이블의 빈 상태를 확인한 뒤에만 합성 자료를 저장한다. 기존 repository 경로로 Project/Task/Run을 만들고 trusted `create_oidc_process_app`의 Operations owner에서 빈 조회→범위 내 `ACTIVE`·`WAITING_APPROVAL`·`BLOCKED` 3건→교차 scope 제외를 두 시점 관측한다. 잘못된 scope는 DB 접근 전 거부, legacy NULL 또는 101행/DB 오류는 요약 성공이 아닌 안정 비가용이다. 조회 전후 Run/Queue/audit 저장 수 불변과 비밀 원문 비노출을 검증한다. 테스트 teardown은 자신이 삽입한 합성 row만 정리하며 WSL의 전체 임시 DB/container 제거는 Main 담당이다.
2. `docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md`: 기준 branch/HEAD/status·hash/dual lease·변경 exact2, 로컬 RED/GREEN/인접 테스트의 명령/exit/실제 결과, opt-in 실제 PG 미실행, 기존 기능 영향·rollback·Main 후속을 기록한다. 실제 WSL 증거는 Main이 WORK_STATUS에 별도로 기록한다.

## 실행·검증 경계

- 먼저 DSN guard의 부분 설정·공유 host/port/DB/role 거부를 RED→GREEN으로 검증한다. 실제 PG 경로는 로컬에서 SKIP으로만 남기고 WSL에서 Main이 동일 SHA로 수행한다. 기존 R12/R16/R17·OIDC/Queue/API 인접 회귀를 실행하고 SKIP을 PASS로 세지 않는다.
- 운영 제품 코드, 공개 Dashboard API/BFF/JSON·UI, 인증/권한·Secret, migration/schema, 지속 데이터, 기존 Event/progress/HANDOFF는 변경하지 않는다. 실제 검증에서 제품 결함이 드러나면 원인·증거·남은 작업을 보고하고 운영 코드를 임의 수정하지 않는다.
- 작업 전 authority hash·Git HEAD/dirty·G-05·dual fencing token/만료/exact2를 확인한다. Main 소유 WORK_STATUS와 기존 dirty/untracked를 보존한다. Developer는 commit/push/PR/merge, WSL-server·Docker·DB·ysna/Production 접근을 수행하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. C30 `OPEN_BLOCKING`/DEFER, U-01/F-20 미수락, main 미병합·새 branch 금지를 유지한다.
