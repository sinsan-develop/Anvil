# FN07 원 SEND 자료·secondary owner 내부 연결 작업지시서

- 상태: MAIN_INTERNAL_REVIEW / SOURCE_GO0. 사전 기술 검토 후 Main의 별도 GO로 시작한다.
- 작성일: 2026-11-06
- 범위: 소스·메모리 합성 검증. 실제 SDK/Agent·DB·권한·키·서비스 실행 제외.
- 기준 HEAD: 74f70196c8548657ed1584e721a37c1977c6b8ee, 기존 codex/av3-stage-b.

## 1. 목적과 승인 범위

WORK_PLAN의 FN07 두 번째 Agent 연결을 진행한다. 원 SEND 명령에 이미 저장·선택·수신된 지시 문장을 기존 SDK owner의 입력에 연결하는 내부 구현이다. 새 지시 내용·최초 prompt를 생성하거나 START context를 자동 송신하지 않는다. 같은 실행의 실제 receiver·원 envelope·원 owner를 대조하는 소스 단위로, 실제 prompt 전달 권위나 외부 실행을 발급하지 않는다.

기존 읽기 전용 담당자는 admission.readInstruction이 provider와 무관한 원 commandRef/envelope/grant/최단기한을 반환하지만 sendInstruction은 Primary 전용임을 확인했다. Primary transport의 Codex claim·RPC 응답·journal을 Claude에 재사용하지 않는다. 기존 Primary는 실제 receiver.instruction과 기존 owner.sendInstruction을 잇는 내부 bridge 및 boolean identity 검사 하나가 가능하다고 확인했다.

이번에는 일반 admission·공개 API·서버 저장·SQL·Primary transport를 수정하지 않는다. 선택 producer와 실제 sessionBindingRef↔SID/current 보호 생산자는 외부 명시 합성 입력으로 남긴다. 이 구현이 실제 사용자 명령 전송·서버 승인·첫 Claude 세션 완성이라는 뜻은 아니다.

## 2. 단일 writer와 정확한 허용 목록

기존 Primary 한 명만 다음 네 제품/시험 경로를 수정한다.

1. 신규 apps/connector/adapters/secondary/instruction-bridge.ts
2. 신규 tests/unit/FN07/claude-instruction-bridge.test.ts
3. 기존 apps/connector/adapters/secondary/sdk-session-owner.ts
4. 기존 tests/unit/FN07/claude-sdk-session-owner.test.ts

Main은 위 파일을 함께 수정하지 않는다. 다른 파일이 꼭 필요하면 쓰기 전에 이유와 정확한 경로를 반환한다. 새 public/storage/auth 의미가 실제로 필요하면 차이를 분리하고 임의 구현하지 않는다.

시작 기준: 기존 owner는 13515B/DBE89D575671910F9FFFBDFFE9D94CED656619B189D5EA17F85ABF675450A2FF다. 기존 factory는 16133B/ACACF14DD16378F1EFD95DD241D190432E47D54C9F724D46BDF97F603E2B4F19다. 원 owner 변경 사유는 bridge가 caller의 성공 current만 믿지 않고 실제 private context/SID와 교차검산할 내부 접점이 없기 때문이다. 변경은 이 boolean 검사 추가에 한정하고 기존 입력·관측·중지·정리 알고리즘과 반환 의미는 유지한다. 기존 시험도 기대값을 낮추지 않는다.

Main 소유 문서는 이 WI·WORK_STATUS·구현 통제 기록과 별도 결과서다. 관련 없는 보호 중인 untracked 3파일은 그대로 보존하며 stage하지 않는다. 새 branch·worktree·chat·자동화·실행기는 만들지 않는다.

## 3. 내부 구성과 실제 소비

SyntheticClaudeInstructionBridge는 명시 SYNTHETIC_ONLY로만 만든다. 입력은 실제 SyntheticMaterialReceiver, 실제 SyntheticClaudeSdkSessionOwner, 원 SEND_INSTRUCTION envelope, 기존 기대 SID와 고정 grantRef/선택 expiresAt, clock/timeout 및 caller signal/기한이다. 기존 타입/검산 함수를 재사용하고 기본 SDK/네트워크/OS 구현은 두지 않는다.

envelope는 bounded own 데이터 객체로 검산·복사·고정한다. START·다른 작업·다른 context/실행세대·등록·sessionBindingRef·instructionRef·partsRef·지시 mode를 추측해서 맞추지 않는다. 선택 grantRef는 원 envelope.context.authorizationReceiptRef와 같다고 가정하지 말고 기존 선택 메타데이터로만 보존한다. 선택 자체를 실행 허가로 표시하지 않는다.

원 receiver.instruction(envelope)의 실제 구현을 호출한다. 가짜 성공 read 포트로 대체하지 않는다. 정확 9키 {transport,key,envelopeHash,instructionRef,partsRef,materialReceiptRef,utf8Bytes,contentHash,bytes} 반환의 원 참조·길이·hash·bytes를 재대조한다. getter/Proxy·부분/손상·교차 명령/refs·불량 UTF-8·빈 문장·기존 상한 초과는 입력 전에 거절한다. 본문을 정정·trim·새 요약·접두 지시·추가 context로 바꾸지 않는다.

검산한 UTF-8 원문을 다음 공식 객체에만 담는다.
{type:'user',message:{role:'user',content:원문},parent_tool_use_id:null,session_id:기존 기대 SID}

instructionId는 원 envelope.commandId다. owner.sendInstruction의 실제 구현과 기존 codec/current/SEND 검사를 소비한다. 자동 observe·새 create·모드 전환·권한 도구 실행은 하지 않는다. 원 bytes 소유 복사본은 성공/실패 후 지우고 caller/receiver 보관본은 훼손하지 않는다.

## 4. 실제 owner identity와 중복

기존 owner에는 private contextDigest/sessionDigest와 caller의 기대 digest가 같은지 boolean으로 검산하는 내부 메서드 하나만 추가한다. raw SID·Query·iterator·원문을 반환하지 않는다. 기존 원 포트/종료·기한을 확인하며 권위·상태·수명을 새로 발급하거나 SDK를 호출하지 않는다. 검사에는 bridge가 고정한 예정 deadline도 전달해 원 owner의 private 상계를 넘으면 보수적으로 거절한다. private 만료 숫자를 노출하거나 가용 기한을 반복 탐색하지 않는다. 원 owner current가 더 짧아진 뒤에도 같은 검사를 다시 소비한다. bridge는 진짜 class private brand를 소비하는 원 메서드를 사용해 own override/가짜 class/subclass/getter·Proxy로 우회하지 못하게 하고, 각 await 전후 원 owner·refs·기한을 재확인한다.

중복은 적어도 같은 실제 owner 인스턴스의 동일 commandId에서 envelopeHash/선택 grantRef/원 refs/본문 hash/기한 결박이 바뀌면 거절해야 한다. 같은 문장·다른 refs를 owner의 본문 중복 검사로 대신 합격시키지 않는다. 여러 bridge 객체가 같은 owner를 공유해도 원 시도의 pending/result를 보존한다. 구현은 module-private WeakMap 등 유한 메모리 장부로 할 수 있다. owner당 1024개를 넘으면 새 입력을 거절하고 자동 축출/초기화·재사용하지 않는다. 이 장부는 재시작·모듈 재적재 이후 내구 보장이 아니다.

공급 전 거절은 실제 streamInput0이다. 공급 시도 후 UNKNOWN은 같은 command 재입력0이고 새 command로 우회 재시도하지 않는다. 원 owner의 inputBlocked 장벽도 유지한다. 원 시도 pending이 외부 취소/기한으로 UNKNOWN이 돼도 실제 underlying 작업이 끝났다고 표시하지 않고 같은 owner의 점유와 결과 불명을 보존한다. 자동 재생성·fallback은 없다.

## 5. 기한·출력·경계

검산한 caller signal·expiresAt은 진입에서 복사·고정해 microtask/await/listener 정리에 같은 값을 쓴다. factory에서 발견한 가변 별칭 문제를 반복하지 않는다. 인스턴스·원 envelope·선택·caller·owner의 기한 중 최단만 사용하고 timeout은 1~10000ms다. clock은 역행하지 않는다. 외부 source/receiver await가 기한을 넘으면 owner 호출을 하지 않는다. 늦은 정착은 새 성공으로 바꾸지 않는다. 외부 취소 후 listener/timer를 회수한다.

결과는 비밀 없는 상태/원 ref·hash와 false flags만 반환한다. INPUT_METHOD_SETTLED는 원 메서드 정착일 뿐 모델 응답·업무 수락·완료·서버 기록이 아니다. actualExecutionVerified:false, executionAuthorized:false, dispatched:false, workAccepted:false, ownership:UNVERIFIED를 유지한다. bridge는 원 instruction/Options/SDK 오류·SID 원문을 일반 결과와 오류에 반사하지 않는다.

실제 sessionBindingRef와 Claude SID/Query의 보호 생산자, 서버의 실제 허가/이해검토/permit, 도구 중재·비용·process 회수는 미검증이다. 명시 합성 포트와 boolean identity 검사는 이 권위를 만들지 않는다. 기존 Codex RESPONSE_RECORDED/claim/관측 journal로 위장하지 않는다.

## 6. TDD·직접 검증

구조적 모듈 부재는 준비 RED로만 분리한다. 실제 행동 반례가 발생하면 원인·RED/GREEN을 별도로 보존한다.

신규 시험은 실제 receiver→원 bytes/refs→bridge→기존 owner/codec→메모리 Query streamInput을 연결한다. 정상 원문·한글/개행·최초/동일 시도·동시 호출·원 context/SID·최단기한과 false flags를 확인한다. owner/send/receiver 메서드를 성공 stub으로 바꾸지 않는다. current/Query는 명시 합성 포트만 쓴다.

중요 음성:
- 원 부분 누락/손상·다른 envelope/session/context/grant/refs·잘못된 UTF-8/빈 값/초과.
- 같은 owner의 두 bridge에서 같은 command/같은 문장·다른 refs나 grant 충돌.
- receiver/current HOLD·signal 별칭/접근자 교체·기한 만료·clock 역행·메서드 교체.
- 공급 전 거절0, 공급 후 UNKNOWN 재입력0, 미소비·throw·HOLD/늦은 정착.
- owner 종료/기한·가짜/다른 identity·getter/Proxy, 장부 상한·원문 비반사.
- 성공/실패 뒤 bytes 소유본 지움, receiver 원 bytes 보존, listener/timer/pending 경계.

직접 검증은 신규 bridge, 기존 owner·factory·start-options 및 직접 receiver 시험 중 영향받은 것만 선택한다. npm run typecheck·git diff --check를 함께 실행한다. 전수 codec/브라우저/기존 FN08 검사를 반복하지 않는다.

## 7. 제출과 인수

기존 Primary는 정확 변경4/전후 diff·raw hash·명령/exit/fail/skip·실제 RED/준비 오류·live/pending·미검증·rollback을 제출하며 commit/push하지 않는다. 독립 검토 C/I0와 Main fresh 검증 후 Main이 소유 파일만 로컬 checkpoint로 통합한다. 보호 자료·기존 SQL·실제 환경은 보존한다.

실제 SDK/CLI import/install/query·OS child/native/compile·네트워크/listener·실사용자 원문 조회/전송·DB/권한/키/서비스·Agent·실자료/백업 파일·J3/P03 R3·Oracle/운영 실행은 하지 않는다. 성공 합성 결과를 전체 FN07·Stage·계획 완료로 표시하지 않는다. rollback은 해당 내부 bridge와 identity 추가의 정상 revert이며 실제 환경 변경0이다.
