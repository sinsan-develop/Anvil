# FN07 최초 Query 내부 생성·owner 인계 구현 WI

상태: MAIN_INTERNAL_REVIEW / PRODUCT_GO0. Main 어울, 2026-11-06.
이 문서는 승인 계획 안의 내부 소스 단위를 구체화한다. 실제 SDK/OS 실행이나 새 권한 계약 승인이 아니다.

## 1. 근거·분류·범위

- WORK_PLAN FN07/함수 카드, 계획 SHA256 AC6BF5087160A2FBF94A49CB959D24E6C205B6CDF6943720670BA8EA76C875C6.
- SDK 고정 codec WI: FN07_CLAUDE_SDK_MESSAGE_NORMALIZATION_IMPLEMENTATION_20261101.md / C69DF128D2A66F3AB5C8373DE2482D7A22E5B3153714FA571B00644E654FB8AE. 고정0.3.224의 객체 API를 재해석하지 않는다.
- PMO 01a054f5-c2b4-7af0-b31a-c8148ef74642의 turn 01a1afd8-04f2-76f3-b682-c1c5f0037a2d, cursor18은 제시된 source-only 조건에 한해 private factory·단발 생성/UNKNOWN 재생성0·동일 Query/iterator·init 전 관측 보존·기존 owner 인계를 계획 안 내부 구현으로 판단했다.
- 현재 NativeOwnerHandle은 state/query/close 준비용이며 SDK SpawnedProcess의 입출력/종결 핸들이 아니다. 준비 permit의 codingAgentExecutionAuthorized:false를 전용하지 않는다.
- 실제 process driver·도구 중재·prompt 전달 권위·원 SID 출처·영속 Claude claim은 이번 단위에서 새로 발행하지 않는다. 새 의미가 반드시 필요하면 정확 차이를 Main에게 반환하고 그 항목만 별도 결정한다.
- 구현 결과는 내부 생성 lifecycle 소스/합성 검증이다. 실제 첫 Claude Query·코딩 Agent 기능/프로세스 보호·FN07/Stage 완료로 표시하지 않는다. 기존 owner를 다시 포장만 하지 말고 최초 생성 호출/미확정·관측 보존·소유 인계의 미구현 동작을 구현한다.

## 2. 정확 소유와 시작 기준

기준 HEAD cd70081690aceea400897cd6bd4d4bd77f89692c / branch codex/av3-stage-b.
기존 Primary 한 명이 아래 신규2 경로만 소유한다. Main은 동시에 이 코드를 수정하지 않는다.
1. apps/connector/adapters/secondary/sdk-query-factory.ts — 현재 ABSENT.
2. tests/unit/FN07/claude-sdk-query-factory.test.ts — 현재 ABSENT.

불변 소비자:
- secondary/sdk-session-owner.ts 13515B / DBE89D575671910F9FFFBDFFE9D94CED656619B189D5EA17F85ABF675450A2FF.
- secondary/start-options.ts 5620B / 7C25908126195726F529F9FD1ADC19D061201A4C669D8AB5494B98E7C9CC598E.
- 기존 codec/schemas·runtime receiver·공통 DTO·서버/DB/SQL/package/lock·native source는 수정하지 않는다.
- 기존 보호 untracked3와 다른 dirty는 수정/stage하지 않는다. 문서/결과/현황은 Main 소유다.
- 추가 파일/소비자 수정이 필요하면 먼저 이유·영향·대안을 Main에게 반환한다.

## 3. 최소 내부 API와 입력 경계

신규 SyntheticClaudeSdkQueryFactory의 외부 wire/DB/API는 만들지 않는다. 내부 생성자/메서드 이름의 경미 조정은 가능하나 아래 의미는 고정한다.

생성자에는 실제 SyntheticMaterialReceiver·원 START envelope, 기존 expectedSessionId, 명시 SYNTHETIC_ONLY driver/current, clock/expiresAt/유한 limits를 받는다. context는 원 envelope.context에서 얻어 기존 codec 형상으로 검산한다. caller의 다른 context·임의 Options를 신뢰하지 않는다.

open(attemptId, {signal,expiresAt})은 현재 검산 후 실제 readClaudeStartOptions로 원 수신 bytes/ref/hash를 검산한다. 원 key·contextBundleRef/optionsRef·materialReceiptRef·envelopeHash와 paramsHash를 고정해 driver에 전달하는 private 요청에 결박한다. model/maxTurns/maxBudgetUsd 이외 SDK 옵션이나 budget 허가를 생성하지 않는다.

driver는 명시 메모리 생성 포트다. transport:SYNTHETIC_ONLY와 고정 create 함수 정체성을 요구한다. 실제 query()/SDK import/native spawn/default driver를 제공하지 않는다. create의 private 요청은 검산된 Options 후보·원 context·expectedSessionId·관련 digest와 고정 기한만 포함한다. 이는 SDK wire/options 객체가 아니며 permission/cost/실행 권위는 false다.

current는 기존 owner의 private 현재성 형상을 재사용한다. CREATE_QUERY는 이 메모리 생성 단계의 내부 검산 목적일 뿐 서버 operation/실행 permit이 아니다. 기존 형상의 instructionDigest 자리에 hash(attemptId)를 결박하고 새 attemptDigest wire 필드를 만들지 않는다. 원 contextDigest/sessionDigest·attempt digest·checkedAt/expiresAt을 exact 대조하고 기존 owner의 SEND/OBSERVE/INTERRUPT 의미는 바꾸지 않는다. 필수 current 부재/오류/변경은 생성 전에 거절한다.

expectedSessionId는 기존 caller 기대값 그대로 소비한다. SDK가 반환한 다른 SID를 새 기대값으로 자동 채택하거나 Anvil ref/서버 claim으로 바꾸지 않는다. 고정 SID 요청이나 실제 SID 출처를 새로 발행하지 않는다. 이 출처/실행 진위는 여전히 미검증이다.

## 4. 단발 생성과 불명

- 각 factory 인스턴스의 동일 원 attempt는 driver.create를 최대1회 호출한다. 반복/동시 open은 같은 pending/결과를 사용하거나 보이는 BUSY/CONFLICT로 거절하며 새 Query를 만들지 않는다.
- 원 attempt의 다른 Options/envelope/context/기대 SID로 재사용을 금지한다. 종료 뒤 새 open으로 같은 factory를 재활용하지 않는다.
- driver 호출 전 확정 거절과 호출 이후 결과 불명을 구분한다. 호출 후 throw·기한/취소·포트 교체·불완전 Query는 UNKNOWN으로 보존하며 자동 재호출/대체 driver/fallback0이다.
- underlying Promise/iterator가 아직 끝나지 않았다면 외부 timeout만으로 lane/handle을 잊거나 다음 create를 허용하지 않는다. 늦게 반환한 동일 Query는 private cleanup 대상으로 보존하고 READY로 소급하지 않는다.
- 이 at-most-once 범위는 인스턴스 메모리다. 재시작/새 인스턴스까지 server durable 중복 방지를 했다고 주장하지 않는다. 영속 claim/실제 재실행은 제외다.
- 새 초기 prompt를 만들거나 owner.sendInstruction을 자동 호출하지 않는다. 실제 첫 입력 producer/권위가 없어 init이 오지 않는 경우는 UNKNOWN이다. init이 입력 전에 반드시 온다고 가정하지 않는다.

## 5. 단일 Query/iterator와 init 전 관측 인계

- 생성된 원 Query의 streamInput/asyncIterator/next/interrupt/close를 getter·Proxy 없이 캡처하고 이후 함수/객체 교체를 검사한다. 원 Query에서 iterator 획득은1회다.
- init이 첫 메시지라고 가정하지 않는다. 기존 boundedSdkObject/codec/schema로 메모리 관측을 검산하며 기대 SID 불일치·미지원/불명·EOF/timeout을 READY로 축약하지 않는다.
- 적합 init 이전의 지원 관측과 init을 순서대로 보관한다. 관측 원문은 보호된 메모리만 사용하고 일반 결과/오류에 답변·사용자 텍스트·cwd/설정·raw SDK/frame을 넣지 않는다.
- 유한 prefix는 최대1024개·총2MiB 이내, 단일 메시지는 기존 maxSdkObjectBytes와 caller의 더 작은 한도 이하다. 소진 시 조용한 축출/누락/요약/재생성 없이 UNKNOWN을 보존한다.
- 적합 init 관측 뒤 기존 SyntheticClaudeSdkSessionOwner를 실제로 생성해 인계한다. 별도 SDK Query나 두 번째 원 iterator를 생성하지 않는다.
- 필요하면 원 Query에 this를 보존해 위임하는 private facade와, prefix를 한 번 순서대로 내보낸 뒤 원 iterator로 이어지는 mux를 사용한다. 제품 Query 메서드를 덮어쓰지 않는다. facade는 같은 underlying Query/iterator 자원이며 새 공급자 세션이 아니다.
- owner의 첫 observe부터 prefix/init/후속 메시지가 유실·중복 없이 소비되는지 실제 owner/codec으로 검증한다. factory의 prefix 검증을 외부 관측/완료/claim 저장으로 중복 발행하지 않는다.
- 초기 input/output 세부 권위나 실제 process identity를 추측해 READY 조건을 채우지 않는다. 이 단위의 OWNER_AVAILABLE은 합성 owner 인계 상태이며 실제 실행/소유 검증이 아니다.

## 6. 기한·취소·cleanup·반환

- clock 단조성·원 context/SID/포트 정체성을 각 await 전후 확인한다.
- 최초 open의 기한은 인스턴스/원 envelope/부모 call/현재성/timeout의 최솟값으로 한 번 고정하고 후속 current는 줄일 수만 있다. await마다 now+timeout으로 연장하지 않는다. timeoutMs는 기존 owner와 같이1~10000ms다.
- AbortSignal·미정착/늦은 완료·중복 close/초기화 중 close를 구분한다. 취소 후 underlying이 진행 중임을 숨기거나 자동 재생성하지 않는다.
- close는 원 private Query/iterator 또는 인계된 원 owner에만 수행한다. 원 목적을 잃은 새 Query·PID·계정·다른 세션을 닫지 않는다. 새 OS kill/PInvoke/Job/NativeOwnerHandle 전용0이다.
- 원 수명 뒤 cleanup은 기존 owner의 소유 close와 같은 제한된 별도 call budget으로 허용하되 실제 process 회수 완료라고 하지 않는다. pending create/next/close 불명은 보존한다.
- raw Query/iterator/초기 메시지는 일반 결과로 내보내지 않는다. 원 owner는 private caller용 접근자로만 제공하고 safe 상태/digest와 구분한다.
- 모든 일반 결과에 actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:UNVERIFIED를 유지한다. Options/SDK init/result·close 정착을 Anvil 승인/작업 완료/OS 회수로 바꾸지 않는다.

## 7. TDD·직접 검증

신규 모듈 부재 RED는 구조적 준비 증거로만 기록한다. 실제 함수의 의미 있는 행동 RED/GREEN을 별도 검산한다. RED를 만들려고 가짜 제품 구현을 넣지 않는다.

새 시험은 메모리만 사용하되 실제 receiver→readClaudeStartOptions→신규 factory→기존 owner/codec을 연결한다. 기존 실제 receiver fixture의 원 bytes/hash/두 그룹 검산을 재사용하고 helper 성공 메서드를 대체하지 않는다. driver/current/Query는 명시 합성 포트이며 실제 SDK/프로세스 진위가 아니다.

필수 정상/음성:
- 원 Options/ref/paramsHash와 기대 context/SID를 driver에1회 전달, 실제 owner 인계.
- assistant/stream 등 지원 관측이 init보다 먼저 온 뒤 순서/중복 없는 인계, 원 iterator 획득1회.
- 같은/다른 attempt의 동시·반복 open, 생성 뒤 throw/late resolve/취소/timeout/EOF·다른 SID/포트 교체/불량 Query.
- prefix 개수/bytes·메시지/식별 상한·getter/Proxy·비정상 객체·비밀 없는 결과/오류.
- 각 await 뒤 current/기한 변경, 원 budget 연장0.
- close 전/중/후·pending create/next·늦은 handle·원 close만1회/불명 보존.
- 원문/실행기 resource나 SDK를 실제 생성하지 않고 fake driver 호출 카운터·pending/handle·timer/listener 정착을 확인.

직접 명령은 신규 factory 시험, 기존 claude-start-options/claude-sdk-session-owner의 직접 인접, npm run typecheck, git diff --check를 선택한다. 기존 codec 전체/불변 전수·실 SDK/브라우저/부하를 반복하지 않는다.

## 8. 금지·제출·인수

실제 SDK/CLI import·설치/query/유료/Agent/OS 자식·네트워크/listener·계정/권한/키/DB/서비스/실자료·artifact 파일·native compile/PInvoke·provider 활성화·기존 프로젝트 차단 해제0이다. 테스트 명시 메모리 포트의 함수 호출만 허용한다.

새 실행 permit/도구 승인·prompt 전달 권위·원 SID 출처·공개/저장 계약이 반드시 필요해지면 이 WI를 임의 확대하지 말고 차이를 반환한다. 임시 tools[]/성공 current를 실제 코딩 기능 완성으로 세지 않는다.

기존 Primary는 변경2·시작/끝 raw·정확 명령/exit/skip·실제 RED/준비 오류·미검증·pending·cleanup·rollback을 제출하고 commit/push하지 않는다. Main은 독립 C/I0·직접 fresh 검증 후 소유 파일만 로컬 통합한다. 실제 실행/사용자 인수/전체 FN07·작업계획서 완료는 미검증이다. rollback은 신규2의 검토 후 정상 revert이며 현재 실행0이다.
