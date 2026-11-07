# FN07 Claude driver·process·도구 공급 경계 후보

- 상태: DRAFT_DECISION_SUPPORT / SOURCE_GO0 / ACTUAL_EXECUTION0.
- 기준: WORK_PLAN FN07, INTERFACES §12.3, CAPABILITIES §4, 현황 §312.
- 목적: 합성 세션 조정 이후 실제 기능을 막는 미정 의미를 한정한다. 기존 작업계획 승인을 취소하거나 실제 SDK/OS 실행을 요청하는 문서가 아니다.

## 1. 확인된 현재 상태

실제 receiver→Options→factory→owner→SEND bridge→coordinator의 메모리 조립과 별도 선택된 첫 SEND의 bootstrap 결박은 구현됐다(35247729, Main 직접110). 보호 profile 선언 선택도 실제 reader의 메모리 검증으로 인수했다(f9b78821, Main 직접69). 각 수치는 서로 다른 단위이며 합산하지 않는다. 첫 입력의 실제 yield와 같은 START/Query/SID/선언 ref·입력 상한을 검산하지만 실제 SDK 수락·OS process·도구 권위는 증명하지 않는다. 실제 SDK driver/process 공급·원 SID의 실제 생성/보호 claim·도구 결정·서버/화면 연결·계정 교체는 미완료다. 추가 내부 래퍼로 이를 대체하지 않는다.

기존 START envelope/실행 fact는 context·H/E·등록·정책·예산·현재성의 근거를 제공한다. 원 Options는 model/maxTurns/maxBudgetUsd만 제공한다. 환경과 command profile의 program/argsTemplate/workingDirectory/secretSlots는 선언이며 검증된 실행파일·실경로·env 허용이 아니다. 기존 NativeOwnerHandle과 준비 authority는 실제 SDK SpawnedProcess·coding 실행 permit이 아니다.

## 2. 재사용할 원 계약

- 원 command/envelope/실행 세대·등록·sourceScopes·현재 fact와 예산·최단기한.
- 원 수신 bytes/ref/hash 및 model/maxTurns/maxBudgetUsd의 닫힌 데이터 선택.
- 단발 시도·동일 요청 재조회/상이 결박 충돌·UNKNOWN 뒤 자동 재생성 금지.
- 원 process/Query/iterator·늦은 handle 보존·명시 소유 정리 및 비밀 없는 결과.
- 원 Anvil 일회 결정·현재 정책/범위/기한 재검산과 실제 tool 요청의 정확 결박.
- 권한 우회 금지. SDK interrupt/close/result 정착과 실제 OS/writer 회수 구분.

기존 Codex claim의 provider/RPC 필드나 준비 permit을 이름만 바꿔 재사용하지 않는다. 합성 성공 current·빈 tools·permissionMode·데이터상의 예산을 실제 허가로 바꾸지 않는다.

## 3. 후보 A — 검산된 생성 입력과 동일 process 소유

권장 방향은 원 START/시도·실행 fact·수신 Options·고정 기대 SID·검산된 process-profile 자료·최단기한·원 signal을 한 번 결박하는 것이다. 임의 SDK Options·env/argv·prompt 문자열을 외부 입력으로 받지 않는다.

process-profile 자료에는 선택된 원 profileRef/버전과 연결·환경·host/sourceRoot, 실행파일 정체성/버전/hash, 실제 cwd와 원 mapping/관측 근거, 허용 argv/env의 닫힌 변환 결과 및 현재성/기한이 필요하다. 이 자료를 어느 기존 보호 producer가 만들고 검산할지는 아직 미확정이다. caller 선언만으로 적합하게 만들지 않는다.

실제 driver는 고정 SDK의 공식 spawn hook을 사용해 같은 원 child의 stdin/stdout/stderr·exit/error·종료 요청을 하나의 소유 단위로 연결해야 한다. 생성 시도 이후 결과 불명은 새 child를 만들지 않고 원 시도/늦은 handle을 보존한다. SDK가 반환한 SID를 원 기대 SID 대신 자동 채택하지 않는다.

이 후보는 새로운 실행 permit을 임의 발급하는 안이 아니다. 실제 생성 시도의 원 허가/비용·process source 근거가 없는 경우 실행 연결은 거절한다. SDK default spawn·준비 helper·고정 QA launcher로 우회하지 않는다. 소스 검증에서는 명시 메모리 공급자를 쓸 수 있지만 그 결과는 false/UNVERIFIED이며 실제 process가 아니다.



### 3.1 고정 공개 포트 확인과 실제 수명 경계 — 2026-11-06

신산님 직접 승인 공개읽기1회의 a840aa는0.3.224 metadata/tarball과sdk.d.ts55627703/sdk.mjs70E00A3E 지문을 메모리 대조했다. SpawnOptions의원필드는command/args/cwd?/env/signal이고,SpawnedProcess는stdin/stdout·killed/exitCode/signalCode?·kill·exit/error on/once/off이다. 별도stderr필드는없다. 결과는docs/04_test_reports/AV3/FN07_PINNED_SDK_SPAWN_SOURCE_READ_20261106.md에있다. 역사sessionId→--session-id의구현근거는이번조회에서재검토하지않았다.

hook signal은즉시caller취소와같지않고stdin EOF·약2초정상종료유예뒤전달된다는주석을확인했다. 원caller취소/기한도달시입력차단·외부약속정착, SDK정상종료요청, 늦은child소유보존·실제exit확인을분리해야한다. 이확인으로Anvil의기존기한을늘리거나즉시kill/회수성공으로간주하지않는다.

원child의stderr는SDK반환포트에없는별도소유접점에서수집상한/비밀제거/종결을처리해야하며exit만으로수집완료를추정하지않는다. 실제child와Query/iterator/원시도의같은소유를검산하는producer는미연결이다. profile선언→실행파일/cwd/argv/env·Secret의현재성/허가생산도여전히미정이다. 이번형상확인만으로코드GO/실행권위/SESSION claim을만들지않고SDK원문을추가조회하지않는다.

## 4. 도구 요청과 Anvil 결정의 미정 대응

실제 SDK 도구 요청은 tool 이름/원 입력·tool/session/item의 원 식별·원 생성/실행 context와 최소기한에 결박돼야 한다. 결정 producer는 다음 대응을 명시해야 한다.

| 도구 효과 | 필요한 기존 근거 | 미정 사항 |
|---|---|---|
| 파일 읽기·쓰기 | sourceScopes의 정확 root/mapping/관측/baseline/FILE targets·권한 | SDK 실제 입력에서 경로/범위를 정정 없이 추출하는 규칙 |
| 명령·자식 process | command profile·허가된 인자·cwd·소유/회수 범위 | shell 문자열/확장·자식 효과의 허용 판정과 원 요청 결박 |
| 네트워크·MCP·동적 설정 | 명시 capability/정책·접근 대상·예산 | FILE scope로 도출할 수 없는 대상/효과 판정 |
| 사용자 결정 필요 | 정확한 일회 결정 receipt·기한·현재 사용자/제어 | 원 요청↔결정 후보·소비·동일 요청 재조회/충돌·취소/불명 |

SDK permissionMode나 init의 tools 목록은 Anvil 결정이 아니다. 알려지지 않은 요청은 허용으로 추정하지 않는다. 특정 도구를 미지원으로 둔 경우 해당 기능과 역할의 미완료를 화면/계획에 남기며 전체 기능 완료로 숨기지 않는다. 모든 기능을 생략한다는 결정이 아니라 안전한 실제 도구 대응이 구현돼야 한다는 요구다.

동일 요청에 결정이 적용됐는지 불명이면 중복 허용 응답을 자동 재발행하지 않는다. 명시 거절·취소·만료·판정 불명은 허용과 구분한다. 실제 SDK 응답 형식과 서버 receipt 소비를 연결하는 상세 원형은 아직 채택하지 않았다.

## 5. 별도 결정이 필요한 정확한 차이

기존 계획은 실제 Agent 통제와 도구 승인을 요구하지만 다음 상세 의미는 기존 채택 문서에서 확인되지 않았다.

1. 실제 생성 permit/시도를 검산된 process-profile·SDK hook과 결박하는 producer/consumer 계약.
2. 실제 tool 입력의 효과 분류·Anvil operation/경로/대상·일회 receipt 소비 대응.
3. 원 Query init SID를 원 생성 증거와 Anvil 책임 세션에 보호 결박하는 SESSION 원형.
4. 최초 입력의 원 자료·명시 호출·허가와 공급 시점, 신규 세션과 기존 세션 연결 각각의 SID 출처. 입력 전 init 미도착·다른 SID·생성 불명에서도 재생성하지 않는 순서.

이 문서만으로 공개 API·서버 저장/SQL·인증 목적·권한·키·실제 실행을 추가하지 않는다. 새 표/키/인증 목적이 필수라고 단정하지 않으며 기존 구조의 재사용 가능성을 원형 확정 뒤 대조한다. SESSION 저장은 생성/도구 공급과 구분하고 TURN 귀속·응답 인수를 주장하지 않는다.

### 5.1 최초 입력·SID의 생성 선행

고정 SDK0.3.224의 Options.sessionId는 신규 conversation에 유효 UUID를 지정할 수 있고 실제 --session-id로 전달된다는 원 선언/구현 근거가 통제 §205에 있다. 계획 UUID를 사전에 고정하는 기술적 가능성과 실제 init에서 그 SID를 관측·검산한 사실은 다르다. 이 데이터 옵션을 현재 공개 Options 원문에 추가하거나 새 권위로 채택한 것은 아니다. 기존 세션 연결에는 실제 보관 SID/재개 근거가 별도로 필요하며 임의 UUID로 대체하지 않는다.

현재 factory는 생성 전에 expectedSessionId를 받고 init 관측 뒤 owner를 인계한다. init이 최초 입력보다 먼저 도착한다는 보장은 없다. 따라서 실제 생성 계약은 누가 어떤 이미 저장된 입력을 어떤 명시 호출·허가로 언제 공급하는지 닫혀야 한다. START context 전체를 새 prompt로 자동 전환하거나 합성 driver의 준비된 init으로 이 순환을 숨기지 않는다. 기존 CONTEXT_REVIEW 첫 SEND producer와 START/init/세션 binding의 순서를 실제 코드로 대조한 뒤 최소 원형을 정한다. 이 선행이 미정인 현재 후보는 코드 GO용 생성 계약이 아니다.

### 5.2 기존 첫 지시 producer의 실제 대조

ProjectInitialExecutionQueue의 START payload는 contextBundleRef/optionsRef 두 개다. 후속 instruction queue는 별도 HUMAN 명령의 grantRef/sessionBindingRef/instructionRef/partsRef를 현재 fact.agentSession.sessionRef·grant/writer/정책/예산과 대조해 SEND를 보관한다. 자료 등록 source는 지시 문장을 만들지 않으며 connector admission도 저장된 SEND를 명시 선택해 읽는다. CONTEXT_REVIEW는 READ 범위를 검사할 뿐 첫 문장을 자동 생성하지 않는다.

서버 SEND의 선행에 SDK init 관측이 명시돼 있지는 않으므로 모든 SDK 생성이 반드시 순환한다고 단정하지 않는다. 현재 구현의 START→init→READY→SEND 순서와, 첫 입력을 요구할 수 있는 실제 SDK 경로 사이의 빈 연결을 구분한다. source refs가 존재한다는 사실만으로 실제 지시 원문 producer·허가·세션 결박을 다 갖췄다고 보지 않는다.

최소 검토 방향은 이미 저장·허가된 SEND의 명시 선택을 같은 START 생성 시도의 첫 user 입력에 연결하는 것이다. 새 문장을 만들거나 context 전체를 자동 입력하지 않는다. 기존 SEND 보호 current/permit 소비를 실제로 재사용할 수 있는지, 무엇이 Codex 전용이라 바뀌어야 하는지를 먼저 대조한다. 이 절은 방향 검토이며 권한 발급·공개 payload 변경·구현 GO가 아니다.

## 6. 다음 조치와 검수

기존 담당자에게 후보의 모순·빠진 원 공급자·기존 승인과 새 의미의 차이를 독립 검토받는다. 확인된 내부 소스 구현 방법은 Main이 결정하되, 새 공개/권한/보호 저장 의미가 필요한 항목은 정확 원형·허용 파일·검수·rollback을 갖춘 한정 패킷으로 결정받는다. 단순히 계획 승인 범위라는 이유로 실제 키/비용/프로세스를 켜지 않는다.

코드 GO 전에는 생성 입력의 닫힌 값과 출처·실제 process 포트의 원 identity/종결·도구 요청/receipt의 정상·거절·UNKNOWN·중복·취소·기한 반례가 구체적이어야 한다. 소스 검증과 실제 유료 Agent/OS 실행 검증은 분리하며 미실행을 PASS로 올리지 않는다. 사용자가 직접 검토할 실제 세션 화면·오류·지원 능력도 후속 기능에 연결해야 한다.

현재 후보 작성·제품/시험 source 읽기만 허용하며 실제 SDK import/query·child/도구·DB/권한/키/서비스·실자료·배포 실행0이다. 기존 결과·관련 없는 보호 자료를 보존한다.
