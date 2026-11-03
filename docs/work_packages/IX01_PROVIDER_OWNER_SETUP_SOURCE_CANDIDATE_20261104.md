# IX01 provider owner 설치 선행 source 보완 후보

2026-11-04 · DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0

## 목적·승인 차이

원 R4의0037/42501/statementEndLine22 실제 실패는 보존한다. 원SQL을 고치거나 preflight/security boundary를 우회하지 않고, 기존0037이 요구한 별도 설치 역할과 원자 migration transaction을 IX01 진단 도구에 연결하는 최소 source 후보이다. 이 문서는 구현 지시나 실제 새 역할/권한/QA 실행 승인이 아니다.

고정 R4 bootstrap에는 anvil_v3_provider_claim_writer와 임시 membership이 없다. 원0037에 이미 승인된 설치계약을 진단 source2에 구현하는 것은 기존 계획 안의 내부 보완이며, 새 public API/제품 SQL/auth 권한 계약을 요구하지 않는다. Main이 source2의 정확 WI를 발행하면 실제 권한 실행 승인 대기를 이유로 코드 준비를 전면 중단할 필요는 없다. 현재 이 담당자의 권한은 신규 문서2 작성뿐이므로 아직 코드를 쓰지 않는다. 반면 추가 역할·membership을 실제 새 cluster에서 준비하는 행위는 소진된 R4 실행 승인 밖이므로, 보완 code·역할/Tx/회수/새 자원을 고정한 별도 실제 실행 승인이 필요하다.

## 원 계약·누락

- db/migrations/0037_provider_session_claims.sql.pending:5~22: 별도 owner 준비와 한 migration transaction 요구.
- 같은 파일:12~19: owner 존재·NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, migrator ADMIN membership1, app 비회원, 기존 소유/ACL·타 membership 부재.
- 같은 파일:260~269·383~399: 최소 목적 DML/함수 소유권, 임시 schema CREATE 회수, app의 정확 함수 EXECUTE, migrator membership 회수·postflight를 원SQL 자체가 담당한다.
- scripts/provider-claim-schema-isolated-qa.ts:19~20: 전용 역할 준비 및0037 전체 명시 transaction의 기존 실행 source 선례. 그 실제 QA를 다시 실행하거나 기존 자원을 재사용하지 않는다.
- scripts/qa-ix01-schema-closure.sh:97·100~126·run/psql/roles 연결: 현재 bootstrap은 migrator/app만, 역할 검산 집합은 두 reader만,0037 전용 Tx 인자도 없다.

## 정확 source 후보2·보존 대상

1. scripts/qa-ix01-schema-closure.sh: 정확0037 선택에만 역할 준비·phase별 metadata·원자 실행·정착 후 회수 조립.
2. tests/unit/IX01/schema-closure-controller.test.ts: 실제 공통 builder/run/역할 검산/호출선의 pure 반례와 상태 전이를 검증.

SQL0037·다른SQL·원 index106/선택105·원장/packet·제품 코드는 불변이다. 세부 내부 signature는 구현 WI에서 고정한다. 임의 새 공개 입력/결과키·일반 권한관리 framework·기존 역할 인수는 추가하지 않는다.

## 최소 상태·안전 조건 제안

PRISTINE에는 기존 깨끗한 cluster만 허용한다. 정확0037 선택이 확인된 경우에만 bootstrap의 명시 별도 준비 단계에서 원 NOLOGIN/NOINHERIT writer를 생성하고 migrator에게 ADMIN membership1을 제공한다. app membership/SET ROLE·bypass·superuser·키/비밀번호 추가0이다. 동명 role·예상 밖 소유/ACL/membership은 인수하지 않고 거절한다. 실제 준비 SQL과 hash·역할표는 다음 source WI에서 고정한다.

INSTALLER 검산에는 새 고정 역할의 실제 속성·원 membership·grantor를 결박한다. 기존 PG15 system12+bootstrap/migrator/app3+provider owner1+원reader2의 최종 이름 집합은 최대18이지만, 단순 숫자 상향이나 임의 role 수용으로 구현하지 않는다. 각 phase/정확 selected·attempted/completed에 따른 지명 집합과 membership만 검산한다. provider role과 기존 reader의 권한·생성원·회수 시점을 혼합하지 않는다.

0037은 원문 hash를 보존한 채 해당 파일에만 psql --single-transaction 같은 정확 실행 경계로 감싼다. 다른 파일·이미 BEGIN/COMMIT을 가진0066/0073에 일괄 옵션을 덧씌우지 않는다. 명령 builder/runtime까지 정확 migration path와 raw hash를 결박하고 stdin에 줄을 추가해 statementEndLine을 조용히 바꾸지 않는 방안을 권장한다. 실제 psql 실행 의미·정착은 미래 실제 검증 전까지 미검증이다.

0037 성공 시 원SQL이 임시 membership/schema CREATE를 이미 회수한 상태를 검산한다. 명확한 Tx 실패 시 원자 rollback 뒤의 정확 현재 metadata에 따라 준비 단계에 남은 원 membership만 회수하고 installer CREATEROLE을 회수한다. 회수할 membership이 이미 없으면 정상으로 취급한다. SQL/COMMIT/역할 관측/회수 결과 불명은 추가 query·mutation·cleanup·재시도0이다. 실패 때문에 새 역할을 자동 drop하거나 원guard를 건너뛰지 않는다.

## 명시105의 추가 설치 역할/Tx 한정 조사

전체105의 literal CREATE ROLE·OWNER TO·owner preflight·별도 provisioning·원자 Tx 요구를 읽기 검색했다. 이는 실제 PG 의존 폐쇄나 동적 SQL 전수 parser 증명이 아니다.

| 이름·범위 | 직접 근거 | 선행/불확실성 |
|---|---|---|
| anvil_v3_provider_claim_writer | 0037:5~22·387~399 | 별도 준비 누락이 확인됨. 원SQL은 role을 생성하지 않음. 이 후보의 유일한 새 역할 준비 대상 |
| anvil_v3_fn16_export_reader_owner | 0066:3·14~15·41·65 | 파일 자체 BEGIN/COMMIT, 비특권 NOLOGIN role 생성·ADMIN 회원·회수. 기존 IX01의 CREATEROLE/source 검산 대상이며 선생성 금지. R4는 미도달 |
| anvil_v3_fn15_reader_owner | 0073:3·12~13·1249·1277 | 파일 자체 BEGIN/COMMIT, 비특권 NOLOGIN role 생성·ADMIN 회원·회수. 기존 대상이며 선생성 금지. R4는 미도달 |
| anvil_v3_migrator / anvil_v3_app | 기존 bootstrap·기존 owner 이전들 | 기존 새 cluster 역할. 새 SUPERUSER/BYPASS/전역 권한을 주지 않음 |

정적 OWNER TO의 고정 이름은 위 provider/두 reader/migrator 집합이었다. 추가 별도 role 이름은 이번 literal 조사에서 확인하지 못했다. 0053/0054의 provisioning 주석은 default CRUD 회수 설명이며 추가 role 생성 근거가 아니다. 일반 SQL 함수/트리거/컬럼의 transitive 의존과 dynamic statement의 실제 성공을 증명한 것은 아니다. 이후 새 별도 준비가 확인되면 이름·원문을 보고한 뒤 허용범위를 정하며 자동 권한 추가0이다.

## 제안 TDD·판정·다음 조치

기존46은 부모 증거로 보존한다. 새 pure RED는 원 provider 준비 누락, 다른 selected에서 생성0, 동명/LOGIN/INHERIT·app membership·임의 ACL/소유 거절, installer phase의 정확 owner/member,0037에만 원자 Tx 인자, 실제 raw hash/행번호 보존, 성공 후 membership 부재 정상, 명확 rollback/부분 실패와 UNKNOWN 뒤 후속효과0을 구분한다. actual 공유 run/builder/parser/roles를 소비하고 최하단 exec만 fake로 둔다. 문자열 존재만으로 PG GREEN을 만들지 않는다.

source2 보완의 필수 검수는 pure focused/직접 영향·필요 noEmit/Bash-n/diff와 정확 SQL·역할·회수 원문/hash다. 실제 DB·role/GRANT·WSL/Docker·키·서비스·Agent/P03R3·새 QA는 NOT_RUN이며, source 검수 후 새 code/namespace/선택/역할 준비·Tx/회수·UNKNOWN/기한/정리 범위를 별도 실행 packet으로 고정해 직접 승인을 받아야 한다. 원 R4 소진 승인을 재사용하지 않는다.
