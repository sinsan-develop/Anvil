# F-20/U-01 R37 Provider 등록 상태 source 결선 계획

## 목표·승인 경계

승인된 설계 §29.2와 U-01의 Provider 실제 자료 연결 중, OIDC 호스트가 이미 받은 설정의 **등록 여부**만 기존 F-13 `OperationsSources.provider`에 연결한다. 이 값은 키 존재 여부이지 Provider 호출 성공·잔여 한도·모델 가용성·Health PASS가 아니다. 공개 Dashboard 필드 집합, 권한, URL, UI, DB schema, 인증, Secret 저장·전송, ysna/Production은 변경하지 않는다. 기존 branch `codex/f18-wsl-ops` 하나만 유지한다.

## 기존 경계

- `ProviderStatusService(environment)`는 canonical 9개 ID를 정해진 순서로 반환한다. 설정값 자체는 저장하거나 공개하지 않고 등록 여부만 `REGISTERED/MISSING`, 상태 `DEGRADED/NOT_CONFIGURED`, 건강 `NOT_CHECKED`로 표시하며 네트워크 호출0이다.
- `OperationsService.snapshot()`의 `source_loader`는 OIDC 호스트의 고정 Project/Environment 확인 후 현재 범위의 Queue를 조회한다. 현재 `OperationsSources.provider`는 비어 있어 Dashboard `providers=[]`이다.
- R36 Agent owner 요약은 명시적 내부 호출로만 남고 공개 응답·건강 카드에는 넣지 않는다. R37은 Provider HealthSignal을 만들지 않으므로 Provider Health 카드는 `UNKNOWN`/source gap을 유지한다.

## 단일 Developer exact4

1. `apps/api/anvil_api/oidc_process.py` — 기존 `load_queue_sources`의 scope 확인 이후 같은 요청의 `OperationsSources`에 `ProviderStatusService(environment)`를 넣는다. 환경의 키 값은 로그·오류·결과에 넣지 않는다. 승인 범위 밖 scope는 DB 조회·Provider source 생성 전 거부한다.
2. `tests/api/test_f20_u01_r37_provider_host_binding.py` — 첫 무설정 9개와 설정 변경 뒤의 fresh read, canonical 순서·안전 status, `NOT_CHECKED`/Health `UNKNOWN`, Secret 비노출, 다른 scope DB 미접근, 기존 Queue/Run/Agent/Alert 경로 불변을 RED→GREEN 검증한다.
3. `tests/integration/test_f20_u01_r37_provider_host_pg15.py` — Main만 실행하는 opt-in. 명시된 격리 PG15 target/role/DB/port를 fail-closed 검증하고 실제 OIDC 호스트의 Dashboard GET에서 9개 등록 상태·기존 JSON 계약·권한 차단·DB 조회 부작용0을 확인한다. 이 테스트만으로 브라우저 Network를 통과했다고 주장하지 않는다. 테스트는 컨테이너/DB/migration을 생성·삭제하지 않는다.
4. `docs/04_test_reports/F-20_U01_R37_PROVIDER_REGISTRATION_SOURCE_RESULT.md` — RED/GREEN, 명령·exit, 변경 전후 diff, 미검증, rollback, Main QA 대기 범위를 기록한다.

## 구현·검증 순서

1. canonical dual fencing lease와 exact4를 발급하고 단일 `developer-primary`에게만 제품 write를 맡긴다.
2. 로컬 테스트가 새 Provider host 결선 부재로 실패하는 것을 확인한 뒤 최소 구현한다. 집중 및 OIDC/Operations/Provider 기존 회귀, compile, G-05, diff-check를 실행한다. opt-in PG15은 로컬에서 명시 SKIP한다.
3. Main이 exact4 diff·민감정보/공개 계약을 독립 검토하고 같은 branch에 commit/private push한다. `WSL-server` 별도 exact-SHA checkout·tmpfs PG15/비관리자 전용 role·DB에서 opt-in을 수행한다. 정확 생성 자원을 확인해 정리하고 잔여0을 기록한다.
4. R37 write→worker lease를 append-only 종료한다. R37 PASS는 Provider 실연결·U-01/F-20 수락이 아니다. C30 `OPEN_BLOCKING`/DEFER를 유지한다.

## 검토 기준

- 설정 키가 있어도 `HEALTHY`·성공률·가용 모델·quota를 추정하지 않는다.
- Secret 값/DSN/내부 주소가 공개 응답, 오류, 로그, 보고서에 없다.
- 기존 Dashboard 필드 집합과 browser Network 경계가 바뀌지 않는다.
- 등록 상태가 현재 host의 설정을 반영하되 scope 거부와 Queue 실패는 기존 fail-closed 계약을 약화하지 않는다.
