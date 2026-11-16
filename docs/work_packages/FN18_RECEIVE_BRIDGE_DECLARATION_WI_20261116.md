# FN18 기존 수신 브리지의 화면·preload 타입 계약 연결 r7

## 근거와 책임

- FN18_DESKTOP_SHELL_IMPLEMENTATION_20261030의 데스크톱 타입 검증과 이미 채택·구현된 FN06 수신 화면/IPC 계약을 완성한다.
- 현 순수 desktop 타입 진단은 169건·exit1이며 원출력 SHA256 241145D004D9C824457667ED08D7646FB8E2DE55EEAAD898A63E02E8415325F6이다. 과거 169건과 개별 동일성은 원출력 부재로 미확인이다.
- settings.js의 trustApi 선언은 preload가 노출하고 화면이 이미 호출하는 nativeReceiveStatus/Begin/Refresh/Arm/Close를 빠뜨렸다. 해당 TS2339 5건을 먼저 보완했고, 같은 브리지의 preload TS7006 19건을 이어서 연결한다. 나머지 오류를 없었다고 표시하지 않는다.
- 같은 Stage E의 UI14 목록 재조회와 별도 소스 단위로 검수하고 한 Stage E 내부 보완 PR에 함께 통합한다. Main은 검수·통합, 기존 developer_primary는 단일 writer다. 다른 변경을 보존한다.

## 쓰기 범위

1. apps/desktop/src/settings.js — 기존 JSDoc 선언과 필요한 정적 typedef만.
2. apps/desktop/src/preload.cjs — 기존 JSDoc 매개변수 선언만.
3. docs/04_test_reports/AV3/FN18_RECEIVE_BRIDGE_DECLARATION_RESULT_20261116.md — 화면5건 결과 보존.
4. docs/04_test_reports/AV3/FN18_PRELOAD_RECEIVE_DECLARATION_RESULT_20261116.md — preload19건 별도 결과.
5. apps/desktop/src/native-first-receive-client.cjs — 원 수신 client JSDoc와 검산 후 키 식의 국소 정적 좁힘만.
6. docs/04_test_reports/AV3/FN18_NATIVE_RECEIVE_CLIENT_DECLARATION_RESULT_20261116.md — 수신 client 결과.
7. tests/desktop/desktop-trust-registration.test.cjs — 명시된 수신 계약 반례가 기존 시험에 없는 경우만.
8. apps/desktop/src/trust-enrollment-owner.cjs — 아래 r5 정적 계약 보완만.
9. docs/04_test_reports/AV3/FN18_TRUST_OWNER_DECLARATION_RESULT_20261116.md.
10. apps/desktop/src/shell.cjs — 아래 r7 수신 상태 계약만.
11. apps/desktop/src/policy.cjs — 기존 정수 검산 뒤 epoch 좁힘만.
12. docs/04_test_reports/AV3/FN18_SHELL_RECEIVE_DECLARATION_RESULT_20261116.md.
13. tests/desktop/shell-policy.test.cjs — 해당 경계의 기존 관측 시험이 부족한 경우만.

제품 실행문·IPC handler·설치 정의·TS config·package/lock·권한은 수정하지 않는다. 새 시험은 구현을 그대로 복제하지 않는다. 기존 시험에 실제 누락이 있으면 추가 경로 변경 전에 Main에게 근거를 반환한다.

## 보존과 검수

- 기존 preload·handler·native-first-receive-client의 인자 순서, nullable 범위, 참조 형상, 명확 성공/실패 응답을 원문에서 대조해 다섯 메서드의 선언을 연결한다. 확인한 응답 형상은 가능한 명시적 union/typedef로 표현한다. 새 any·index signature·ts-ignore/ts-nocheck·검사 제외/완화로 진단을 숨기지 않는다. 기존 any 전면 정리는 이번 범위가 아니다.
- JSDoc만 변경해 런타임 동작과 IPC 표면이 동일함을 diff로 확인한다. 새 메서드를 노출하거나 호출 경로를 추가하지 않는다.
- 같은 고정 TS7·desktop tsconfig·--noEmit 검사로 정확 다섯 TS2339 소실과 신규 진단0을 확인한다. 줄 이동은 별도로 구분하고 기존 나머지 진단은 파일/코드/메시지별 중복 건수로 대조한다. 164건이 남으면 전체 desktop 타입 검사는 계속 FAIL이다. 원진단은 QA 자료로 보관하고 Git에 사용자/환경 자료를 넣지 않는다.
- 기존 desktop-trust-registration의 해당 수신 화면 RAM 시험을 검사해 선택 실행한다. 실제 Electron·native 프로세스·SDK를 시작하는 시험은 실행하지 않는다. ROOT 타입과 main 대비 diff는 영향에 비례해 선택한다. 코드 불변의 UI14 시험을 다시 전수 실행하지 않는다.
- r2의 preload 범위는 수신 begin/status/refresh/arm/close의 기존 인자 17건과 onState 내부 리스너의 event·state 2건이다. 원 policy의 UUID/양의 epoch/정확 offerRef/version1/명시true/sender 검산에 맞는 타입을 원문으로 대조한다. listener 경계 값은 unknown을 사용하며 event를 전달하지 않는 기존 동작을 보존한다. 새 Electron 타입 import/shim·any·config 변경은 없다.
- 같은 검사에서 164개 기준의 정확 TS7006 19건 소실·신규0을 대조한다. 145개는 예상이며 실측 전 결과로 사용하지 않는다. electron TS2307은 별도 모듈 해석 실패로 남긴다. 기존 RAM IPC 5종 입력 검산과 화면→preload→main 시험을 선택 실행하고 JSDoc 외 실행문이 동일함을 증명한다. 이미 검증한 settings.js 제품과 결과는 보존한다.
- r3는 의존성 복원 뒤 기준104건/exit1, 원진단 SHA256 1E7F3828AE51C2C2F30D0859BD9509ECE3DF9C19773134B42630EADCAD7450EA를 사용한다. native-first-receive-client 48건 중 생성 runtime TS2307 1건은 별도이며 소스47건을 한 수신 client 계약 단위로 보완한다. 예상57건은 실측 전 결과가 아니다.
- 원 TypeScript NativeFirstReceiveHumanClient의 경계와 맞춰 화살표 함수 입력41건의 JSDoc를 실제 함수/인자에 연결한다. 검산 전 wire/source/receiver/ref는 unknown, ID는 string, epoch는 number, phase는 원 STREAM/ARM/STATE/CLOSE 리터럴과 연결한다. 새 권위/메시지/시도 상태를 발명하지 않는다.
- openedWindow는 기존 검산 후 보관하고 dispose 때 비우는 불투명 사본이므로 object|null로만 선언한다. 신뢰된 DTO 필드로 넓히지 않는다. 원 receiver 신원·소유 window·guard를 receiptBasis가 검산한 직후 WeakMap has/set의 두 키 식에서만 object JSDoc 좁힘을 허용한다. 공개 receiver 입력은 unknown이며 검산 전/일반 cast·새 mint·실행 helper는 금지한다. 타입 단언에 필요한 무효과 괄호 외 실행 표현을 바꾸지 않는다.
- 같은 TS7에서 정확41개 TS7006·openedWindow4개·키 TS2345 2개의 소실과 신규0을 대조한다. 나머지 진단/전체FAIL은 숨기지 않는다. 기존 RAM의 정상 수신·위조/교차 receiver·만료·dispose를 선택 실행하고 owned 주석/타입 단언을 역치환해 원 Git 실행문 바이트를 확인한다. 앞선 UI14·settings·preload를 전수 재실행하지 않는다.
- r4의 실행문 예외 한 곳: handoffReceiveDelivery catch는 첫 receiver 신원 검산이 실패한 경로도 포함한다. 그곳의 WeakMap.delete에는 object 검산 근거가 없으므로 검산 전 cast를 쓰지 않는다. receiver가 null이 아니고 typeof object일 때만 기존 key 삭제를 수행하는 최소 guard를 허용한다. 원 abortReceivePhase와 원 오류 throw는 무조건 유지한다. 원 map에는 원 object 신원 검산 뒤에만 키를 넣으므로 비객체 삭제는 기존에도 키 소실을 만들지 않는다. 함수/symbol 등 무효 입력과 정상 object의 정리·원 오류/봉인 의미가 같은지 기존 RAM 시험을 우선 재사용하고, 부족할 때만 지정 시험에 보완한다.
- 정확47건 소실 외 새 catch TS2345가 발견된 중간58건을 숨기지 않는다. 같은 코드·메시지 진단끼리 상쇄될 수 있으므로 수정 전후의 대상 소스 위치와 원 식을 함께 대조해 신규0을 판정한다. 주석/정적 좁힘과 명시 guard의 각 diff를 분리하고 그 외 실행 표현은 원문과 같음을 확인한다.
- r5는 수신 client 보완 뒤 실측57건을 기준으로 owner의43건 중 생성 runtime TS2307 3건을 남기고 소스40건을 한 등록 owner 계약 단위로 다룬다. 기존 state/client/slot/decoder/secret/signal/deadline의 실제 생성·폐기 수명과 nullable 범위에 맞게 JSDoc를 붙인다. 함수 입력·rawWindow 주석의 대상 일치, symbol 거절 뒤 descriptor 키 접근, 원 receiver 검산 predicate, callable 확인 뒤 aborted getter 호출, 선택형 closeCurrentSource를 정확히 표현한다.
- 외부 raw 입력은 unknown이며 검산 후 근거 없는 cast·새 any/index signature·가짜 생성물 선언·config 완화는 금지한다. 원 TypeScript 타입 참조가 새 전이 진단을 만들면 숨기지 않고 보고한다. JSDoc/predicate·검산 뒤 좁힘만 허용하고 새 실행문이 필요하면 위치·기존/변경 동작을 Main에게 먼저 반환한다.
- fresh는 주입 시계 호출 뒤의 현재 committed/credential을 사용해야 한다. 타입 오류를 없애려고 시계 호출 전 과거 committed를 저장해 재사용하지 않는다. 기존 현재성·만료·정리/zeroization·재시도 금지 조건을 보존한다. 착수 전57 대비 owner소스40 소실·기타진단 보존·신규0을 실측한다. 예상17은 결과가 아니다. 기존 등록/수신 RAM 수명 검사를 선택하고 앞선 UI14/주석 검사를 불필요하게 반복하지 않는다.
- r6는 owner의 실행문 예외 세 곳만 허용한다. (1) 이미 거절하는 symbol 키 검사를 ds[k] 접근보다 앞에 둔다. (2) PHASE의 현재 aborted descriptor/getter를 읽고 typeof function을 확인한 뒤 원 Reflect.apply를 호출한다. 부재/비함수는 기존 try/catch와 같은 CONTEXT_CHANGED 거절이며 OPEN의 signal.aborted 의미는 보존한다. (3) runtimeStable·주입 clock 이후 현재 committed의 null을 검사해 기존 보호 거절로 끝낸다. 원 credential 만료값은 그 시점의 현재 값이며 시계 전 과거 객체를 캐시하지 않는다.
- 위 세 지점 외 실행문은 보존한다. 기존 등록/수신 RAM 시험에서 symbol 자료 거절, PHASE getter 부재/비함수, 시계가 owner를 폐기한 재진입, 정상 등록/phase 수명을 검증한다. 기존 시험이 부족하면 이미 허용한 desktop-trust-registration.test.cjs에 관측 기반 반례만 보완한다. 서명/상태전환·외부호출을 늘리거나 원 오류/정리·zeroization·기한을 완화하지 않는다. 정적 편집과 명시 세 guard의 diff를 분리해 기록한다.
- r7는 실측17 중 shell12·policy1을 수신 IPC/상태 계약 단위로 보완한다. policy의 Number.isSafeInteger 검산을 통과한 우항 epoch 식만 number로 좁힌다. 순서·허용값·오류는 보존하며 선행 정수 검사를 생략하지 않는다.
- shell의 receiveCopy/receiveSame/receiveError는 입력unknown, emptyReceive의 이미 검산한 attempt/epoch는 string/number로 선언한다. private owned 상태는 원 main 생성과 폐기에 맞춰 resource/window/offer/armRef/expiresAt의 null을 포함한다. 기존 receive:any를 그대로 전파해 진단을 숨기지 않는다. receiveGuard를 모든 필드의 비-null predicate로 선언하거나 await 전 과거 소유 상태를 재사용하지 않는다.
- 원 상태 검산은 10개 phase를 허용하나 shell 매핑은8개다. 검산된 10개 유한 키와 선택적 값을 표현하고 CONFIRMED/UNCONFIRMED 두 상태의 기존 CONTEXT_CHANGED 거절을 유지한다. 새 성공 상태/화면 동작을 만들지 않는다. 실행문은 변경하지 않으며 추가 실행 guard가 필요하면 정확 위치·행동을 Main에게 먼저 반환한다.
- 같은 TS7에서 지정13개 원위치 소실·신규0·생성runtime TS2307 4개 보존을 실측한다. 예상4건은 결과가 아니다. 기존 RAM exact5 IPC·settings/preload/main·외부sender·늦은ARM/인증ABA의UNKNOWN을 선택 검증하고 미지원 두 phase의 거절이 기존 시험에 없으면 허용 경로에만 관측 반례를 보완한다. 정적편집/국소좁힘 외 원 실행문 바이트 동일성을 검산한다.
- 결과서에 정확 명령/exit/건수·원진단 지문·사라진 진단과 잔여·변경 지문·실행문 동일성·미검증·복구를 기록하고 쓰기를 반환한다.
- 실제 FS/사용자/백업 조사·DB·권한·키·서비스·SDK/Agent/C#·Electron 설치/패키징/앱 실행·추가 SDK 조회·종속성 설치는 하지 않는다.
- r8 실행문 예외는 원 work 생성/호출 이후 ARM 예약 직전 한 곳이다. owned.window가 null이면 기존 TypeError가 매핑하던 PROTECTION_UNAVAILABLE로 명시 거절하고 원 requests에는 등록하지 않는다. guard를 work 시작 전으로 이동하지 않으며 원 catch/finally/정리와 호출 순서를 유지한다. begin controller 생성 실패 후 ARM의 동일 거절·미등록·추가 서명/실행0을 관측 시험으로 검산한다. 다른 실행문 예외는 허용하지 않는다.
