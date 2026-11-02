# FN06 native 준비 현재 source의 등록·writer 원장 실조회 구현

- 날짜 2026-11-02 / r2 / Main 어울 / 구현 담당 fn16_primary_recovered 한 명
- 계획 연결 WORK_PLAN FN06/FN08 native 준비의 실제 options/current 생산. 선행 code3eba28f9·검수기록004f3b65011e73a7e37767cf5a7439cfb31d64de.
- 정본 r2 FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085 및 직접 source 승인 기록9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567의 내부 생산·검산 구현이다. 새 공개 계약/DDL/권한/실제 환경 변경 승인이 아니다.

## 1. 정확 허용5

1. 신규 apps/server/modules/executions/native-preparation-current-source.ts
2. 신규 tests/unit/FN06/native-preparation-current-source.test.ts
3. 기존 apps/server/modules/executions/project-writer-authority.ts
4. 기존 apps/server/modules/connections/project-registration-reads.ts
5. 기존 apps/server/modules/executions/project-native-preparations.ts — 원 내부 source 호출 budget 전달만.

기존2의 수정은 원 검산을 중복 구현하지 않는 서버 내부 재사용 접점과 그 직접 호출만이다. 기존 public reader operation·권한·응답·모델/역사 재생/replay·저장 방식은 바꾸지 않는다. 다른 경로가 필수이면 이유/정확 delta를 Main에 반환한다. 타인 변경·보호3·기존 SQL/원 fixture/SDK·physical factory8은 읽기만 한다. Main은 관리·문서·검수·Git 통합, Primary만 제품 writer다.

## 2. 실제 구현할 조회와 책임

신규 source는 호출자 소유 authenticated PoolClient transaction에서만 기존 NativePreparationSource.options/current를 생산한다. BEGIN/COMMIT/별도 Pool·실 DB 접속·기본 서비스 등록은 하지 않는다. 실행 가능한 SQL SELECT와 기존 원장/등록 복원을 실제 함수 호출선에 연결하고 테스트에서 SQL을 직접 소비한다. parser나 새 wrapper만 추가하고 단위 완료라 하지 않는다.

현재 session ID·actor/client의 auth_sessions/users/clients 현재 행·세대·sessionIsActive, projectMember OWNER/비보관, project_control의 단독 제어·같은 actor/client·세대, currentPolicy/authorizeMaterial, clock_timestamp를 대조한다. 원 TX 안에서 현재성 검산을 반복하며 명령의 caller 선언으로 사용자/세대/시각을 채우지 않는다.

writer 내부 접점은 options의 readNativePreparationAuthority와 current의 정확 원 prepareNativeBoundary 명령 두 닫힌 사용으로 제한한다. 임의 operation 입력으로 권한을 고르는 generic getter는 만들지 않는다. native 정책 아래 필요한 최소 projection만 반환하고 기존 공개 readProjectWriterAuthority·등록 reader의 별도 operation을 새 선행으로 요구하지 않는다. raw SQL 조회 권한/HTTP 경로를 추가하지 않는다.

project_writer_authority_heads FOR UPDATE의 단일 head, project_writer_authority_events의 project별 epoch/sequence 및 최대10001 제한, 기존 #load/#proofs·checkWriterChain/verifyHistoricalHead를 재사용한다. 원 PROJECT commands/authorization_receipts/audit_events의 정확 실제 서버 command ID 관계·각1행·request_hash·operation/target·actor/client·policy/scopeDigest·원 승인 소비/역사 시각을 복원한다. actor를 현재 요청자로 바꿔 역사 proof를 재생성하거나 승인 재소비를 요구하지 않는다. 없는 head/두 ACCEPTED bootstrap 관측/BOUNDARY_ESTABLISHED를 합성하지 않는다.

등록은 기존 connector_registrations JOIN connectors JOIN commands의 실제 row·생성 결과·scope/registrationRef/connectorRef·host 공개키 지문·소유자/client/세대·만료/회수와 connector_basis_current를 재사용 검산한다. 기존 #record의 검산을 최소 추출해 public reader가 같은 검사/권한을 유지하도록 한다. 원 등록 REGISTRATION_STATUS_ONLY/ACTIVE_STATUS_ONLY는 base 등록 사실이며 이것만 native 허가로 승격하지도, 모든 base 등록을 거절하는 새 blacklist로 사용하지도 않는다. 새 NATIVE_ONLY credential의 목적 분리는 기존 r2 소비자에서 유지한다.

## 3. 보호 mapping·현재 단계·수명

물리 artifact/catalogue만으로 registrationRef/nativeFactoryRef/sourceScopeHash/channelProfileRef의 현재 관계를 만들지 않는다. 그 실제 보호 공급자는 여전히 미구현이다. 기존 r2 필드만 사용하는 서버 내부 명시 mapping 포트는 허용하되 새 공개 DTO/영구 저장/설정파일/서명 purpose/정책 operation을 정의하지 않는다. verified:true 같은 caller 플래그·STATUS_ONLY token·과거 RESERVED ref만으로 성공시키지 않는다. 필요 계약이 이 범위를 벗어나면 임의 생성하지 않고 정확 delta를 반환한다.

같은 원 db/actor/project 및 검산된 writer projection·현재 budget을 명시 공급자에 넘기고 결과의 등록/factory/scope/profile fullref·키 지문·관측/만료·evidence refs를 DB 원 등록/원장 및 immutable physical catalogue와 대조한다. 공급자 함수/고정 binding·입력/await 뒤 값 교체·추가키/getter/이상시각·최소기한 변경을 거절한다. 공급자가 없으면 기존503/거절이며 빈 items 성공으로 지원 부재를 숨기지 않는다. 이 포트를 합성 주입한 시험은 실제 보호 생산자 완성이 아니다.

최초 options/prepare 직전 선택은 정확 EMPTY_AT/RECLAIMED_AT만 허용한다. prepare가 저장·예약된 뒤 host current는 그 원 prepare가 만든 RESERVED tuple을 검산해야 하며 원 baseline을 현재 head로 바꾸지 않는다. 다른 명령의 RESERVED·변조된 head·scope·등록·control/profile/factory는 거절한다.

source의 각 await 뒤 원 tuple·공급자·현재 actor/control/등록/정책·최소기한을 다시 확인한다. 원 작업 전체 최대10초/외부 최소기한을 단계별 새 budget으로 늘리지 않는다. underlying query/공급자 종료 미확인은 성공·다시 시도·중복 mutation으로 바꾸지 않는다. 이 단위는 SELECT/검산이며 명령/원장/권한 쓰기를 추가하지 않는다.

기존 NativePreparationCryptoSource의 allocate/credential은 명시 내부 조립으로 재사용할 수 있다. 테스트는 합성 crypto 포트만 사용하며 새 random/key primitive·비밀 전달·실발급을 작성하거나 호출하지 않는다. protected mapping/crypto 미등록은 fail-closed다. 제품 main.ts·route/desktop 자동 활성화는 이 단위에 포함하지 않는다.

## 4. TDD·독립 검수

실 schema와 같은 row로 정상 bootstrap/BOUNDARY_ESTABLISHED·원 command/receipt/audit/일회 소비·현재 OWNER/control·등록/키 세대·scope를 복원하고, 실제 ProjectNativePreparations/service options 및 current caller까지 연결한다. exact NATIVE_ONLY와 보호 mapping은 명시 합성으로만 제공한다. 정상 fixture에 실제 스키마에 없는 verified/factory 필드를 끼워 통과하지 않는다.

중요 음성은 proof 누락/중복·다른 project/actor/operation/target·request_hash·원 승인 소비·head/epoch/chain 변조·bootstrap 부재·현재 session/control/등록·키 지문·scope/profile/factory 변경·DENY/기한·mapping 부재/함수 교체/getter·await 뒤 변경·다른 명령 RESERVED·최소기한 소진이다. 역사 승인과 fresh 현재성을 분리한다. 보호 mapping 부재가 실제 actor/policy 조회 자체를 생략하는 우회가 되지 않아야 한다.

첫 module 부재와 실제 행동 RED를 구분한다. 신규 시험·직접 영향 기존 writer/등록/native caller 회귀·root typecheck·diff check를 선택해 수행한다. 기존 fixture/기대값/합격 기준 완화0. 변경되지 않은 전체 검사/브라우저·OS 시험을 반복하지 않는다. 기존 public reader 권한 불변/정상 동작을 직접 확인한다. 동결5 SHA/정확 실행명령·종료·count·오류 계보·미검증을 반환한 뒤 Main 독립 검증과 Reviewer C/I 검수를 받는다.

## 5. 제외·완료 의미

실제 DB/DDL/권한·키·파일 조사·서비스·Agent/native/compiler·P03R3 실행/새 QA root/새 의존성·새 branch/worktree·자동화는 0이다. 시험은 메모리 DB query/transaction·고정 합성 proof/current이며 실제 PG/원 권위/COMMIT/OS 증거가 아니다.

완료는 이 source의 실제 SELECT→기존 검산→원 caller 연결과 필요한 정상/실패/회귀 검증이다. 실제 보호 mapping/bootstrap 관측 생산자·credential/채널·제품 기본 조립·실 환경·FN06/FN08/전체 계획 완료를 뜻하지 않는다. 다음 미완료 생산/조립을 따로 남기고 source 검수로 대체하지 않는다. 동일 근본 원인3회면 추가 수정 중단·정식 FAILURE_REPORT로 Main에게 인계한다.
## 6. r2 기술 보완 이력·원 budget 전달

r1 SHA5A7BC52021468A1ABD01D309A8D749A63640BC528825333B5F796FEF0FCF4DD0의 독립 preflight C0/I0 뒤 Primary가 실제 source signature에 원 budget이 없음을 확인했다. options는 정책 조회 전에 이미 시작한 최대10초를 소비하며 current/host도 원 작업의 deadline을 공유한다. source가 새10초를 시작하는 방식은 불가하므로 정확 기존1경로를 추가했다. 이는 같은 r2 승인 내부 구현 접점의 기술 보완이며 공개 wire/DB/정책/한도 의미를 바꾸지 않는다. r1 검토를 r2 합격으로 상속하지 않고 scoped 재검토한다.

기존 project-native-preparations.ts의 original operation budget/check/signal·최소기한을 동일 source.options/current 호출에 전달한다. 내부 선택적 typed 인자 또는 동등 private lease를 사용할 수 있으나 HTTP/query/body/DTO에 budget을 추가하지 않는다. 기존 source 구현·모델 대역 호출 호환을 보존하고 새 concrete source는 원 lease가 없으면 성공을 만들지 않는다. options·HUMAN 준비·호스트 current/challenge/consume/delivery의 source 호출선에서 원기한을 reset하지 않고, mapping에도 같은 잔여/중단을 전달한다. 함수/lease 교체·원 operation 종료·await 뒤 만료면 늦은 결과로 성공/새 query/쓰기·grant를 만들지 않는다. abort 요청을 실제 외부 작업 종료로 보고하지 않는다.

source.options는 최초 HUMAN options뿐 아니라 호스트 #freshHost에서도 호출된다. 공개 options의 기존 EMPTY_AT/RECLAIMED_AT 차단은 유지하되 내부 RESERVED 재검산을 무조건 막지 않는다. 원 source.current에는 원 prepare 명령/선택과 그 원 RESERVED tuple이 대조돼야 한다. caller flag나 새 공개 mode로 이를 선택하지 않는다. wire/JSON parser·issuer/consume/replay·정책·기존 timer/한도 완화0이며 필요한 직접 회귀를 포함한다.

정확5 기존 시작 지문은 Primary 읽기 기록을 WORK_STATUS에 남긴다. 기존2 내부 검산 추출과 이1 budget 전달 외 재설계는 금지한다. 추가 경로가 또 필수이면 코딩 전에 근거를 반환한다. r2 재검토·Main 게시 뒤 단일 Primary에게 제품 GO를 전달한다.
