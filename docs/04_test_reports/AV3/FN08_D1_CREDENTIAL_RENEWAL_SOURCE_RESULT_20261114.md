# D1 같은 grant credential 재교환 — 소스 검수

- 판정: 소스·합성 검수. 전체 D1/작업계획 및 실제 사용 완료 아님.
- 기준: PR102 main `09cc58b89a54006c84c27985e39b0e5202cf51e0`, `codex/av3-d1-credential-renewal`.
- 승인 근거: `docs/contracts/FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md` §3.1 단계3·§3.2 같은 grant 재교환 채택. 실제 DB/권한/키/보호 파일/서비스/Agent/native 컴파일 제외.
- 담당: 기존 developer_primary 단일 writer. Main 어울 검수·통합; d2_scope_audit 및 d2_preflight 읽기 독립 검수.

## 변경 동작

기존 token 만료 후에만 같은 grant·예약·credential 세대에서 새 receipt를 발급한다. 최대15분과 grant/storage 기한을 유지한다. 과거 packet은 해당 원 receipt의 UNKNOWN으로 수렴하며 token을 다시 전달하지 않는다.

새 미적용 0091은 기존 once-only index를 비중첩 검산으로 대체한다. project→grant 직렬화, READ COMMITTED 외 거절, BEFORE 및 지연 검사, 기존 digest UNIQUE·receipt 불변성·원 guard를 보존한다. 이전 SQL은 수정하지 않았다.

native는 grant+직전 receipt로 결정되는 INSERT-only marker를 네트워크 전에 기록한다. receipt별 보호 슬롯과 이전 슬롯 hash/ref·CA·scope 체인을 검산한다. 기존 grant ID 슬롯 읽기를 유지하며 만료 예외는 갱신의 이전 metadata 검사에 한정한다. 응답 유실·부분 저장·종료 불명 후 자동 재교환하지 않는다. 실제 DPAPI/파일 내구성은 미검증이다.

runtime과 REGISTERED owner는 명시 renew로 새 포트를 반환한다. 이전 포트의 만료는 바뀌지 않는다. 기존 단일 active·owner/current·root·10초·64-frame·UNKNOWN 검사를 유지한다. 새로운 공개 endpoint/응답 필드, grant 수명 연장, 일반 서명 기능 확대는 없다.

## 검증

| 수행자·범위 | 결과 | 한계 |
|---|---|---|
| Main 교환 여정·SQL 정적·bootstrap 3파일 |14P/0F/0SKIP,7191.3781ms|SQL은 문자열 검사, 서버 DB는 RAM fixture|
| Main owner·native 2파일 |15P/0F/0SKIP,1753.1614ms|실제 제품 owner/bundle+합성 host, C#은 정적 검사|
| Main 갱신 신규2·기존 START1 |3P/0F/0SKIP,19290.7259ms|아래 ACK 시험공백 보완 전 결과|
| Main 동결 제품 루트 typecheck |exit0|desktop 전체 타입검사와 구분|
| 구현자 최종 루트 typecheck |exit0|Main 추가 호출은 무출력 지연으로 Ctrl-C exit1; 별도 미검증 기록|
| 구현자 ACK 보완 집중 |1P/0F/0SKIP,15733ms|합성 여정|
| Main 최종 ACK delta 집중 |1P/0F/0SKIP,30004.7916ms|실제 native/DB 실행 아님|

명령은 `node --experimental-test-module-mocks --test --test-reporter=spec`와 해당 FN08 시험, owner/native는 `node --test --test-reporter=spec`, 타입검사는 `tsc --noEmit -p tsconfig.base.json`이다. 정확 실행 파일·결과는 WORK_STATUS에 누적했다. 중복 실행 수를 신규 검사 수로 합산하지 않는다.

## 발견·보완

- 독립 I1: REPEATABLE READ의 오래된 snapshot에서 잠금만으로 비중첩을 보장하지 못함. READ COMMITTED 외 거절로 소스 C0/I0 재검토. 실제 PG 격리/동시성 검증 아님.
- 독립 M1: 갱신 전 ACK 완료로 갱신 후 sync가 기존 ACK만 반환. pending5를 갱신 후 실제 observations POST로 보내 새 credentialRef→challenge→소비 receipt→ACK를 검산하도록 보완, C0/I0/M0 재검토.
- 첫 여정429는 RAM quota fixture의 purpose 필터 누락. 실제 SQL 조건과 일치시켰다.
- ACK 보완 중 단언 실패는 증명 receipt와 ACK ref를 직접 비교한 오류. receipt.ackRef 경유 계약으로 정정했다. 실패를 소급 PASS하지 않는다.
- old cursor 거절은 만료와 credential scope 불일치의 복합 조건이며 특정 검사 분기 단독 증거가 아니다.

## 미검증·복구·다음

실제 PostgreSQL/trigger·경합·C# 컴파일·DPAPI·Windows 저장/복구·TLS·사용자 화면·Agent 실행은 미검증이다. 개발 DB에는 0091을 적용하지 않았다. 새 credential을 사용한 source 여정은 JS 합성 HTTPS와 RAM 저장을 사용한다.

복구는 이 소스 묶음의 일반 revert다. 미적용 SQL이므로 실제 DB rollback 작업은 없다. 다음은 채택된 D1 단계3의 polling→자료 내구 수신→START coordinator→관측 ACK 조합이며, 실제 adapter 전송·환경 적용·1건 실측과 구분한다.
