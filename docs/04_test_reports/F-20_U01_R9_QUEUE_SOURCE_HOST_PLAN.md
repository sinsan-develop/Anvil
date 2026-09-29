# F-20/U-01 R9 Queue source host 연결 계획

## 판정과 목적

승인된 U-01 Dashboard 실제 read model의 내부 연결 단위다. R8의 범위 고정 PostgreSQL Queue snapshot을 기존 OIDC process의 `OperationsService`에 연결하되, 공개 API·permission·DB schema·UI 계약은 바꾸지 않는다. U-01/F-20 전체 수락이나 C30 차단 해제가 아니다.

## 기준과 설계

- 현재 `create_oidc_process_app()`는 `OperationsSources()` 빈 source를 한 번 주입하며, `OperationsService.snapshot()`/`detect()`는 생성 당시 source를 계속 사용한다. R8 `ScopedQueueSource`는 한 transaction의 불변 관측치다. 따라서 bootstrap에서 한 번 로드하면 값이 영구히 낡는다.
- 기존 `OperationsService` 생성자에 선택적 trusted `source_loader`를 추가하고, `snapshot()`와 명시적 host `detect()` 각각의 호출 시 새 `OperationsSources`를 얻는다. 기존 고정 source 주입·alert/audit GET 계약은 보존한다. HTTP GET가 `detect()`를 호출하지 않는다.
- OIDC process host의 trusted Engine·이미 권한 고정된 project/environment를 캡처한 loader만 R8 `load_scoped_queue_source()`를 호출한다. 다른 scope 입력을 HTTP에서 받지 않는다. 각 호출은 자체 read-only repeatable-read snapshot이다.
- `legacy_unscoped_present` 또는 DB 오류·100건 초과 시 성공/완전한 0건으로 반환하지 않는다. 안정적 코드로 fail closed하고 SQL/credential/payload/token을 오류에 포함하지 않는다. Queue health는 별도 신호가 없으면 계속 `UNKNOWN`; 연결만으로 `HEALTHY`가 아니다.

## 정확한 제품 범위와 검증

1. `packages/observability/service.py`: 선택적 source loader와 호출 시점·형식·오류 봉인.
2. `apps/api/anvil_api/oidc_process.py`: trusted scope·Engine에서 Queue loader 연결.
3. `tests/observability/test_f20_u01_r9_queue_host.py`: 두 번 읽으면 새 snapshot, scope 고정, legacy/DB/limit fail-closed, GET audit/alerts 비변경.
4. `tests/api/test_f20_u01_r9_oidc_queue_host.py`: process wiring 및 기존 host/authorization 회귀.
5. `docs/04_test_reports/F-20_U01_R9_QUEUE_HOST_RESULT.md`: 정확한 RED/GREEN·실제 검증·미검증·rollback.

제품 변경 전 canonical WorkInstruction·Invocation과 유효한 worker/write dual lease를 새 epoch에 발급하고 G-05 PASS를 확인한다. 단일 Developer writer가 위 exact5만 수정한다. Main은 계획·통제·검증·Git을 소유한다. 로컬 RED→GREEN 및 기존 F-13/OIDC 인접 테스트 후 같은 branch에 사설 push하고, WSL-server 격리 checkout의 동일 SHA에서 PostgreSQL 15 실제 두 시점 읽기·scope/legacy/실패 경계를 검증한다. 생성 임시 자원의 이름·소유·수명·정리를 실행 전에 `WORK_STATUS`에 기록한다.

## 제외와 중단 경계

새 Dashboard/Operations 공개 endpoint, 화면, Worker/Budget/Provider source, 건강 신호 생성, 실행 claim/complete/fail, DB migration, Secret·권한·운영 배포, ysna-server/Production은 제외한다. 새 공개 API 또는 인증 계약 변경이 필요하다고 확인되면 본 R9를 확장하지 않고 별도 변경 경계로 분리한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, U-01/F-20 미수락, main 미병합·신규 branch 금지를 유지한다.
