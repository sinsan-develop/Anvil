# F-20/U-01 R3a — 기존 Operations Alerts 읽기 owner 연결 계획 (DRAFT)

## 판정과 근거

- 목적은 승인된 U-01 Dashboard의 실제 read source 중 **기록된 경고** 한 경로를 OIDC 호스트에 연결하는 것이다. R1 Database와 R2 Provider 등록 상태 외의 Dashboard 전체 수락을 주장하지 않는다.
- canonical API에는 이미 `GET /api/operations/alerts`와 `operations:alerts:read` 권한이 있으며 `OperationsPort`는 `ApplicationRequest`의 authorized project/environment와 principal 소속을 owner의 고정 scope와 대조한다. `OperationsService.alert_page()`는 해당 scope의 `OperationsRepository.load()`만 읽고 detector/audit append를 실행하지 않는다.
- 현재 `create_oidc_process_app()`의 trust 입력은 호스트 프로세스에 고정된 project/environment 한 쌍을 제공한다. 그러나 `create_oidc_asgi_app()`은 `create_runtime_app()`에 `operations_owner`를 전달하지 않아 OIDC 실제 경로는 owner 부재 501이다. `PostgresOperationsRepository`는 같은 scope의 `operations_audit_events`를 지속 DB에서 읽지만 host 주입형이다.
- `OperationsSources`의 queue/lease/budget/health 입력은 여전히 미연결이다. DB에 기록된 경고가 0건이어도 감지기 실행·시스템 건강·Critical Alert 부재까지 증명하지 않는다.

## 경계

- R3a는 기존 route·permission·response schema·DB schema·migration을 변경하지 않는다. OIDC 프로세스가 이미 검증한 DB 설정과 고정 scope로 `OperationsService`/`PostgresOperationsRepository`를 생성해 기존 factory chain으로 명시 주입한다. 별도의 환경변수·Secret·계정·public route를 추가하지 않는다. DSN은 응답·상태·로그에 넣지 않는다.
- 일반 `create_oidc_asgi_app()` 호출자는 기존처럼 owner를 선택 주입할 수 있고, owner 부재는 계속 501이다. 호스트 경로의 바인딩은 인증된 `operations:alerts:read` principal과 같은 project/environment에만 200을 허용한다. 미인증 401, 권한 부재·타 scope 403, DB 실패는 성공/빈 배열로 위장하지 않는다.
- R3a는 기록된 경고 read API의 실제 동작만 닫는다. detector 구동, 경고의 완전성/신선도, Queue·Worker·Budget owner, 새 Next Actions read route, acknowledge mutation, Dashboard UI 및 U-01/F-20 전체 수락은 제외한다. `ysna-server`/Production, main 병합과 신규 branch도 제외한다.

## 구현·검증 순서

1. 현재 epoch13 R2b write→worker lease를 순서대로 append-only 회수한다. R3a exact-path WorkInstruction/Invocation, 새 worker/write token·expiry, 원본 Event prefix와 C30 `OPEN_BLOCKING`/release `DEFER` 유지 음성을 준비하고 G-05로 검증한다. clean checkpoint를 기존 branch 원격에 push한 후 단일 writer에게만 제품 경로를 부여한다.
2. RED 테스트에서 기존 OIDC 호스트의 Alerts 501, 정상 scope 200 목표, 미인증 401, 권한 부재·타 project/environment 403, 저장소 오류의 fail-closed, GET audit mutation 0, 응답·로그 Secret 노출 0을 구분한다. 기존 API registry와 `OperationsPort` 계약은 보존한다.
3. 최소 GREEN: `apps/api/anvil_api/oidc_process.py`가 고정 scope와 DB 설정에서 owner를 만들고, `apps/api/anvil_api/asgi.py`의 구성형/직접 OIDC factory가 기존 `create_runtime_app(operations_owner=...)`으로 전달한다. 기존 `ANVIL_DATABASE_URL`이 `postgresql://`이면 그대로 사용하고 SQLAlchemy의 `postgresql+psycopg://`/`postgresql+psycopg2://` 표기이면 driver 접미사만 제거해 동일 psycopg 연결 문자열로 전달한다. 인증정보·host·DB 이름은 변경·출력하지 않는다. 일반 factory의 명시 owner가 없으면 기존 501 동작을 보존한다.
4. 단일 writer 결과와 Main 독립 diff에서 API registry/permission/DB migration 변경 0, 정식 실패 횟수, rollback을 검토한다. 로컬 집중 테스트·G-05·관련 회귀를 실행하고 같은 branch의 정확한 SHA만 push한다.
5. `ssh WSL-server`의 Git 수신 exact SHA에서 정식 QA 범위의 실제 PostgreSQL audit row와 OIDC principal/role을 사용해 API 200·401·403·DB 장애를 검증한다. 해당 QA scope에 경고 기록이 없으면 `alerts: []`를 **기록 조회 결과**로만 보고하고 detector 정상/경고 0으로 승격하지 않는다. 임시 프로세스·DB/role·fixture·checkout은 이름·소유·수명·정리 경로를 실행 전 기록하고 완료 뒤 정확한 대상을 검사·제거한다. 정식 전체 suite와 skip/warning은 별도로 보고한다.

## 예상 제품 경로·rollback

- 후보: `apps/api/anvil_api/oidc_process.py`, `apps/api/anvil_api/asgi.py`, 해당 OIDC process/ASGI/API 테스트, R3a 결과 보고서. 최종 exact-path lease 전에 테스트 경로를 고정한다. 다른 제품 파일은 포함하지 않는다.
- rollback은 R3a commit만 후속 정상 Git commit으로 되돌려 OIDC의 기존 owner 부재 501로 복귀하는 것이다. DB schema·지속 데이터·기존 Event를 되돌리지 않는다.

## 미해결 사전 점검

- 로컬 synthetic DSN의 `psycopg.conninfo.make_conninfo()` 확인에서 `postgresql://`은 ACCEPTED, `postgresql+psycopg://`은 `ProgrammingError`로 거부됐다. 따라서 위 driver 접미사 제거를 명시적 음성/정상 테스트로 고정하고 실제 Secret 원문은 테스트 출력에 기록하지 않는다. WSL-server 실제 DB 연결은 아직 미검증이다.
- 계획 범위를 넘어서는 공개 API·permission/role 계약·DB schema 변경이 필요해지면 그 항목의 구현을 중단하고 영향·대안을 분리 보고한다. 나머지 승인된 읽기 전용·테스트 작업은 계속한다.
