# FN08 자료·실행 credential namespace 내부 연결 복구 작업지시서

2026-11-06 / r2 / Main 어울 / 내부 구현 보완 / TEST_ONLY 및 PRODUCT_GO 전 source 쓰기0

> 기존 Primary만 구현하고 Main은 관리·검수·통합한다. subagent-driven-development 방식으로 같은 담당자에게 순차 배정한다. 이 문서는 실제 DB·권한·키·서비스·Agent 실행 승인이 아니다.

## 목표·구조·기준

목표는 같은 원 grant의 HUMAN 자격 세대 H와 별도 실행 예약 세대 E를 각각 검산하여, H=3/E=1에서도 기존 구체 보호 wrapper가 START/SEND의 등록 자료를 안전하게 읽도록 연결하는 것이다. 공개 입력·응답·operation·descriptor·과거 snapshot/hash·영속 열을 추가하거나 바꾸지 않는다.

기존 코드가 이미 분리된 두 namespace를 같은 자료 scope 포함식에 넣어 연결을 막는 문제를 복구한다. 원 HUMAN current와 실행 예약 검사는 둘 다 유지하며 어느 한쪽을 다른 값으로 덮어쓰지 않는다. 실행 예약을 HUMAN 세대로 만들거나, 숫자1 제한만 완화하거나, 예약을 새로 생산해서 성공시키는 구현은 금지한다.

기술은 기존 Node24/TypeScript·PostgreSQL 미적용 정의·메모리 합성 시험이며 새 의존성을 설치하지 않는다.

- 설계/계획: docs/design/Anvil_설계서_v3_초안.md, docs/WORK_PLAN.md의 FN06/FN08 기존 안전한 자료 전달·별도 실행 credential 범위.
- 기존 계약: docs/contracts/FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md §6(원 grant에 서버가 예약한 실행 credential 세대), docs/contracts/INTERFACES.md의 HUMAN 세대와 실행 세대 구분.
- START 부모 승인 C82C16EB3AAE2035B8273392549130702167396ACD34095A4617E2D21B6A228B / 채택8AE16D6CAB5334FAC4548688777AE44560997BB0D0C78816CB340A114A7E4384.
- SEND 부모 승인 docs/work_packages/FN08_MATERIAL_REGISTRATION_SOURCE_DIRECT_APPROVAL_20261031.md:1358B/FB59E8C7A040D69CF9D11D8E753A3F5573647BE430E8A95E950EC2BABACABE6C.
- source 기준 b0f22d00dd441d521390388e3e7b8db525f8a2c8, 후속 문서 checkpoint88ea0e6e5d5fe0ea640f1479a9f38b59d6a2e3bd. §264의 Main 소유 현황 변경은 보존한다.

## Main 범위 판단

이 보완은 기존 두 namespace 계약을 복구하는 내부 버그 수정이다. 새 권한/허용 연산·공개 API/응답·저장 필드·credential 발급·실제 환경 변경이 없어 기존 승인 계획의 구현·시험 범위에서 진행한다. 기존 전체 scope 포함식의 삭제만으로 허용을 넓히는 것은 이 판단 범위가 아니다. 같은 원 grant의 실제 예약 E와 원 HUMAN H를 각각 완결 검산하는 대체식이 필수다.

독립 WI 검토에서 새 공개/승인/인증 허용·저장 의미가 실제로 추가돼야 한다는 근거가 나오면 정확 차이만 Main에게 반환한다. 후보를 승인으로 전용하거나 사용자 재승인 대기를 먼저 만들지 않는다. 제품 GO 전 이 판단과 허용 파일을 재검토한다.

## 단일 writer·정확 허용12

기존 Primary만 아래 경로를 작성한다. Main은 이 경로의 제품/시험/SQL을 쓰지 않는다. 타인의 변경·보호 비추적3·Main 문서는 되돌리지 않는다. 새 agent/chat/branch/worktree/자동화0. Primary commit/push0.

기존 제품3:
1. apps/server/modules/executions/execution-instruction-material-store.ts — 8000B/84B9842D3CE252D1578B1D586DA8238C9BE263EFCB45A290B0C77600B8D461DC.
2. apps/server/modules/executions/execution-material-registration-store.ts — 18301B/20C915CBF2F8AB8C52655D98C62CD8820DADABEBC71568DCCC587D036CFD9257.
3. apps/server/modules/executions/execution-start-material-registration-store.ts — 25954B/D9E9AD4A6619029661C1E6F0A09FBC3F5791C96080AB0DE6C67BD427DAA26C0F.

신규 제품/SQL2:
4. apps/server/modules/executions/execution-material-credential-basis.ts — 두 namespace의 원 저장 관계만 읽는 내부 helper.
5. db/migrations/0079_material_credential_namespace_binding.sql.pending — 기존 binding 완결 함수의 forward 보완만.

기존 시험2:
6. tests/unit/FN08/execution-start-material-registration-flow.test.ts — 45440B/7DDAABF7DC8CA6755BD6154270375F7C115BB5B0173CD7339740301644ABAED4.
7. tests/unit/FN08/execution-material-registration-store.test.ts — 24735B/53CAE34D78B9F72C24960C0AAC148CC18F3582B53E9ACD37E829246BF4CE73C5.

신규 시험/순수 fixture4:
8. tests/unit/FN08/execution-material-credential-basis.test.ts.
9. tests/unit/FN08/execution-material-credential-binding-schema.test.ts.
10. tests/unit/FN08/execution-material-credential-integration.test.ts.
11. tests/support/execution-material-credential-fixture.ts — 필요할 때만 사용하는 순수 합성 fixture. import 시 시험 등록·IO·전역 변경0이며 각 fixture 상태를 분리한다. 불필요하면 만들지 않아도 된다.

제품/시험 helper는 이 검산·합성 조립만 위한 것이며 일반 구조 개편·framework 도입이 아니다. 허용 밖 파일이 필요하면 정확 접점·최소 diff만 Main에게 반환한다. 기존0018/0062/0078과 과거 SQL, source descriptor/parser·basis/parts·receiver·공개 routes/credential 발급 코드는 수정하지 않는다.

## 복구할 검산식

- E scope: 기존 외부 EXECUTION proof/current의 mode/project/connector/execution/executionGeneration/grantRef와 실행 예약 세대.
- H scope: 위 공통 식별자를 그대로 유지하고 원 저장 grant fact.subject.credentialGeneration으로만 도출하는 자료 등록 scope.
- 두 scope의 공통 식별자는 정확 fullref로 같아야 한다. actor/client/Session·정책/제어·등록/host·현재 HUMAN H 검사와 최소기한은 보존한다.
- E는 같은 grant의 기존 execution_credentials 행·원 snapshot/hash·SYNTHETIC_RESERVED_NO_TOKEN·credentialIssued/executionAuthorized/dispatchPerformed=false·원 예약 시각에서 읽는다. 현재 구현의 E=1 제한은 그대로다. 없다면 거절하며 INSERT/새 예약/발급/자동 수선0.
- H는 caller가 E로 치환하거나 선언한 값이 아니라 원 fact에서 읽는다. 자료 descriptor·binding snapshot.scope·credential_generation·과거 hash는 H를 그대로 보존한다.
- 외부 proof의 E와 자료의 H를 같다고 요구하지 않는다. 그렇다고 세대 검사를 빼지 않으며 각 값의 원 저장 권위를 별도로 검산한다.

## 내부 포트·호출선

새 helper는 caller가 소유한 같은 PoolClient만 사용해 기존 grant fullref와 예약을 SELECT한다. 자체 connect/BEGIN/COMMIT·DML·키·토큰·source body 접근0. 내부 판독 입력은 EXECUTION 또는 MATERIAL namespace의 검증된 scope이며, 반환은 두 검증 scope·원 grant fact·기존 예약 근거만이다. 함수 이름은 readMaterialCredentialBasis로 고정하고 namespace 인자는 닫힌 EXECUTION/MATERIAL 값으로 받는다. caller가 tag를 골라도 실제 저장 grant/예약과 입력 scope를 대조해야 하며 권위 생성 포트가 아니다.

공통 PgInstructionMaterialStore:
1. 외부 E scope로 기존 challenge transaction을 연다.
2. callback 진입 전에 기존 currentReadOnly를 필수로 호출해 예약 존재와 현재 권위를 검사하고 H 매핑을 고정한다. currentReadOnly 부재는 거절하고 예약을 생산하는 current로 fallback하지 않는다.
3. 자료 전용으로 노출하는 challenges.current/currentReadOnly도 기존 읽기 전용 current에 결박한다. 일반 challenge 발급의 기존 예약 생산은 수정하지 않는다.
4. basis.current, parts.readPart, results.bind/read에는 같은 grant의 H scope만 전달한다. consumed replay의 results.read도 callback 처음부터 올바른 H를 사용한다.
5. 상위 SyntheticAuthenticatedMaterials와 generic materials·routes는 외부 E를 그대로 소비한다. receipt→binding→nonce 소비→최종 current/bytes→COMMIT 순서는 유지한다.
6. 매핑이 읽는 동안/마지막 await 뒤 바뀌거나 현재성·예약·source가 불명하면 거절한다. 새 scope로 재시도하거나 자료를 다시 등록하지 않는다.

SEND/START registrar #proof:
- 원 receipt/challenge1/consumed2·requestId/proofHash·정확 target·resultRef/previousRef·서명 소비 관계는 그대로다.
- 기존 scope 전체 동등식은 공통 식별자 exact 일치 + 실제 예약 E + 자료 H 결박으로 교체한다.
- bind/read의 기존 snapshot·hash·한도 비용/총량·불변/소비 orphan 거절은 보존한다.
- 실제 예약 누락·다른 grant/version/hash·잘못된 E/H는 거절하고 어떤 성공 기본값도 만들지 않는다.

## 미적용 SQL0079

CREATE OR REPLACE로 기존 anvil.material_binding_complete(uuid,uuid)의 signature/owner/ACL/trigger 호출선을 유지한다. 새 표/열/행변환·기존 SQL 수정·SECURITY DEFINER·권한 확대·extension 도입0. 기존 proof/material/descriptor 완결과 역방향 trigger·프로젝트/grant 전체 이력 합산 guard는 보존한다.

기존 challenge.binding이 자료 scope 전체를 포함한다는 식 중 credential 값만 두 namespace로 분리한다. mode/project/connector/execution/executionGeneration/grantRef는 exact이고, 자료 세대·descriptor·binding scope는 H끼리 같아야 한다. challenge binding/request/publicChallenge의 E는 같은 grant의 기존 execution reservation 행/snapshot/hash/false flags와 같아야 한다. 원 grant의 H와 자료 세대도 별도로 검산한다. NULL/missing·다른 tuple·빈 성공을 허용하지 않는다.

역사 완결에는 현재 로그인·현재 시각을 새로 요구하지 않는다. fresh current는 원 Node transaction에서 검사한다. H=E=1의 기존 정상 이력은 그대로 읽고 H=3/E=1 새 관계도 원 예약이 있어야만 완결이다. 원 snapshot/hash나 과거 행을 수정해서 맞추지 않는다. 실제 SQL 설치/DB 접속은 하지 않는다.

## 실행 순서와 완료 조건

### 1. TEST_ONLY: 기존 실제 행동 RED

- [ ] Main의 TEST_ONLY 후 기존 START flow에 정상 H=3/E=1·기존 실제 예약·원 정책/등록·유효 P256 proof를 조립해 실제 구체 wrapper가 자료 H를 잘못 받는 실패를 재현한다.
- [ ] 기존 H=1/E=1 정상과 기존 외부 E=3 거절은 보존한다. 현재 사용자 세대를 1로 바꾸거나 registrar 성공 대역·빈 callback으로 통과시키지 않는다.
- [ ] module/export 부재·fixture SQL 미구성·가짜 current 오류를 기능 RED로 세지 않는다.
- [ ] Main은 기존 제품3 지문·행동 RED를 확인한 뒤 PRODUCT_GO를 발행한다. 그 전 제품/SQL/기존 SEND 시험 쓰기0. 신규 시험/fixture와 기존 START flow의 필요한 합성 조립만 TEST_ONLY 허용이다.

### 2. PRODUCT_GO: 내부 매핑·양쪽 소비

- [ ] 새 읽기 전용 helper와 공통 wrapper·두 registrar의 최소 접점을 구현한다.
- [ ] 실제 구체 Store의 START와 SEND H=3/E=1 정상 종단·원 descriptor/hash·14필드 응답을 확인한다.
- [ ] 예약 없음/잘못된 예약·grant/version/hash/E·caller H 치환·현재 다른 HUMAN/Session/세대는 body/receipt/binding/nonce/새 예약0으로 거절한다.
- [ ] 유효 서명의 다른 target/material·다른 connector/execution/grant, 등록/source/권한 회수와 최소기한을 보존한다.
- [ ] binding 실패/최종 current 만료/COMMIT 불명은 원 rollback/UNKNOWN과 추가 발급·자동 재전달0을 유지한다.
- [ ] 정상 consumed replay 추가 기록0, binding 없는 consumed orphan 사후 보충0을 확인한다.

### 3. SQL·직접 회귀·반환

- [ ] 새0079의 원/역완결·NULL/missing/tuple/두 namespace 모델과 기존 함수 signature/owner/ACL 보존을 정적·합성으로 검사한다. 실제 PG 증거로 확대하지 않는다.
- [ ] 변경·직접 영향 시험과 기존 materials/routes/queue·SEND/START 등록의 필요한 인접 회귀, type/diff만 실행한다. Web 제품 변경이 없으면 build를 반복하지 않는다.
- [ ] 기존 시험 본문/기대값을 보존하고 필요한 예약 원자료·fixture만 보강한다. H/E를 같게 바꾸거나 기준을 낮추지 않는다.
- [ ] 정확 변경 raw 지문·diff·실제 RED/명령/exit·미실행·오류·live/pending0·복구 범위를 Main에게 반환한다.

## 검수 중점과 제외

검수 중점은 두 namespace의 caller 치환, 예약 없는 곳에서 current가 새 예약을 만드는 효과, consumed replay의 H 매핑 이전 조회, 역사/current 혼합, SQL 포함식 삭제만으로 권한을 느슨하게 만드는 오류다. 해당 정상/음성을 위 시험에서 직접 확인한다.

실제 DB/DDL/GRANT·권한/정책/회원·키/Secret/certificate·서비스/listener·SDK/Agent/유료 호출·파일/실자료 조사·C#컴파일·J3/P03R3·Oracle/운영·기존 프로젝트 차단 해제·Git 인증 복구는 제외한다. 메모리 합성만 허용하고 source-only 결과를 실제 원문 supplier·기본 app/실행 준비·전체 FN06/FN08/계획 완료로 올리지 않는다.

복구는 정확 허용 경로의 정상 Git revert만이며 실제 데이터/키/서비스 복구는 수행하지 않는다. Main은 독립 검수와 최소 fresh 검증 후 기존 branch local checkpoint를 보존하고 원격/Stage gate는 별도 실제 증거로 판단한다.


## r2 내부 보완 — 직접 영향 SEND 시험1 추가

부모 r1은13410B/SHA256 491F654EB94F4D040A80EED72949E7B0640AE66411BCD4C918C36183C094BA3E다. Main은 같은 namespace 복구의 직접 영향 시험 준비를 보강하는 내부 배치로 이 r2를 확정한다. 새 제품·공개·권한·저장 의미는 추가하지 않는다.

추가 허용12:
- tests/unit/FN08/execution-instruction-queue.test.ts — 123329B/SHA256 EFC66D603D6DA00452185637FA7D1AA748D9D2DB847EE52BDD72334E6B0AB5EC.

Main e2b7c4의 직접 caller3은 원 queue의 COMMIT 준비에서0PASS/3FAIL·2218.9182ms/exit1이었다. Main/독립 읽기는 정상 COMMIT tag 누락과 임의 scopeDigest/plannedAt 누락·원 예약 tuple 미구성을 확인했다. 기존원문과actual stack의 근거이며 baseline시험을 새로 실행했다고 하지 않는다. 기존 fixture 미구성으로 신규 제품 검사를 생략하거나 전체검수 PASS로 바꾸지 않는다.

보강 범위:
1. 기존 fixture의 정상 COMMIT literal에만 command:'COMMIT'을 명시한다. raw 거절/throw·응답 유실·명시 불량/undefined·ROLLBACK 경로는 성공으로 바꾸지 않는다. 필요한 중요한 실패 음성을 같은 파일에서 보존·추가한다.
2. 기존 material 경로의 grant는 원 fact의 초기 writerState:NONE 형태와 실제 planSyntheticExecutionGrant를 소비해 유효 plannedAt/scopeDigest/최종 hash·최소기한을 만든다. 실시간 SEND fact의 OWNED·원 actor/client/H·원명령/예약은 유지하고 가짜 hash 성공 대역은 없다.
3. 기존 예약 모델은 project/grant/version/E 열·canonical snapshot/hash를 갖추고 exact grant SELECT·동일 txid를 실제 요청 tuple에 맞게 응답한다. 모든 SELECT에 임의 성공·빈 결과를 주지 않는다.
4. 자료 소비 전 setup에서 기존 일반 PgChallengeStore의 실제 current 생산자로 E1을 정착시킨다. 측정 대상 자료 operation의 connect/release/key/trace·nonce·binding 효과는 setup과 분리하여 원 한 연결/rollback/단발 단언을 유지한다. 자료 currentReadOnly가 예약을 생산하는 fallback은 금지한다.
5. basis/parts/results의 내부 scope 단언은 삭제하지 않고, 원 저장 grant에서 도출한 H3 materialScope에 대해 exact deepEqual한다. 외부 proof/Store의 E1 단언은 그대로다. 기존 E를 내부 자료 scope로 기대하던 표현을 H로 바로잡는 것은 명시한 namespace 복구이며 비교를 느슨하게 하는 변경이 아니다.
6. 기존 SEND queue/permit basis와 각 시험의 읽기 횟수·rollback·성공false·단발·원명령 불일치 거절을 유지한다. 새 START 성공으로 SEND 검증을 대체하지 않는다. 기존 본문/기대값 중 실제 바뀐 것은 정확히 diff로 제출하고, 불변이라고 과장하지 않는다.
7. 실제 schema/DB·키/권한·서비스·Agent·실자료 조사0, 제품 허용5경로는 r1과 같고 전체 허용은12다. Main이 r2 독립 검토·추가1 GO를 전달하기 전 이 기존 시험을 수정하지 않는다.
