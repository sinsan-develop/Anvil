# FN09 기존 등록 정의 fixture 환경계상 응답 보완

- 상태: MAIN_TECHNICAL_ADDENDUM / TEST_ONLY_GO. 기존 승인 기능의 인접 검사 fixture 정합이며 새 제품·공개 API·DB/권한 계약을 추가하지 않는다.
- 기준: bbd20aa549b3ac6774712389727ec44b767f45c2의 FN09 source-only 단위. 이전 인접6FAIL과 CURRENT/BASELINE 동일 원인은 결과서/WORK_STATUS §407에 보존한다.
- 단일 writer: 기존 Primary. Main은 검수·통합을 맡고 같은 파일을 수정하지 않는다.
- 정확 허용1: tests/unit/FN09/registered-definition-responsible-session.test.ts. 시작 SHA256 349B2BCBF97E0D4406A3409555018AF9F7E50D92C0851F15107EC0A3A3451416. 제품23·기존 SQL·다른 시험·보호3/기록은 불변이다.

## 최소 변경

definitionFixture.db.query에 정확 SQL SELECT * FROM anvil.environment_configuration_account($1,$2,$3,$4) 분기만 추가한다. 인자는 [actor.authSession.id,actor.actorId,actor.clientId,pid]와 exact 대조한다. 원 mode.used/mode.heldBytes/mode.coverage를 used_bytes/held_bytes/coverage_state로 유지한다. 환경 자료가 미생산인 fixture의 environment_heads/environment_versions/environment_bytes/report_bytes/approval_candidates/approval_bytes는 십진문자열0, definition_bytes는 실제 rows.canonical_bytes를 BigInt로 합산한다. 새 complete:true·포괄 성공·쿼리 catch fallback을 만들지 않는다. 기존 조건/기대값/정책·권한/coverage·cap·replay·UNKNOWN 음성을 변경하지 않는다.

이는 실제 assertEnvironmentConfigurationCapacity의 EXISTING_WRITE 호출선이 요청하는 원 응답을 공급하는 보완이다. 계상 guard·인수 기준을 느슨하게 만들지 않는다. 명시 범위에 없는 추가 누락이 나오면 반복 수정하지 말고 정확 원인/호출선과 최소 diff를 Main에게 반환한다.

## 검증과 반환

1. 시작 HEAD/index/정확 hash·보호 파일 불변을 확인한다. 이전 실패는 이미841843으로 재현했으므로 같은 미수정 실패를 반복하지 않는다.
2. 이 분기 추가 후 수정이 정확 한 구간인지 diff와 원구간 역치환으로 확인한다. ErrorActionPreference Stop·쓰기 뒤 raw 확인 전에는 시험을 실행하지 않는다.
3. 기존 첫 정상1만 선택해 정상 진입을 확인하고 통과하면 해당 파일 전체만 실행한다. 신규 FN09 48·다른 인접4·build 전체는 제품이 불변이므로 반복하지 않는다. 필요한 타입/diff만 확인한다.
4. 새 hash/정확 diff·명령·exit/PASS/FAIL/SKIP·기존 기대값 불변·live0를 반환하고 writer를 돌려준다. 기존6FAIL은 과거 결과이며 새 결과로 소급 변경하지 않는다.

실제 DB/SQL 실행·권한·키·서비스·Agent/SDK·외부 요청·실자료 조사·commit/push/PR/병합0이다. 파일 자체의 모델 보완이 실제 환경계상/SQL 원자성/서비스 정상 증거는 아니다.
