# FN07 원 SEND 첫 입력 bootstrap 소스 작업지시서

- 상태: MAIN_INTERNAL_REVIEW / SOURCE_GO0.
- 기준 HEAD: ffc19dff2cd0f26f6db8d34d2bd8eab78402d7d7, codex/av3-stage-b.
- 범위: 원 명시 SEND의 첫 입력 소비·동일 owner 장부 인계에 관한 내부 소스/합성 검증.
- 실제 SDK/Agent·DB·권한·키·서비스·사용자 원문 실행 제외.

## 1. 목적과 기존 승인 경계

원 START는 context/options 두 ref를 전달하고, 사용자 지시는 별도로 저장·선택된 SEND에 있다. 현재 factory는 init 뒤 owner를 인계하므로 첫 입력이 필요한 SDK 경로를 실제로 연결하지 못한다. 새 prompt 생성이나 START context 자동변환 대신 원 SEND 문장만 명시 선택해 첫 Query 입력으로 한 번 소비하는 내부 순서 확장이다.

기존 actual receiver·공통 instruction client/permit 소비·fact reader·codec을 사용한다. Codex thread/claim/RPC/response barrier·전용 송신 journal은 전용하지 않는다. 준비 authority를 실제 실행 permit으로 만들지 않는다. 실제 init 이전 세션/OS/source/current 공급자는 여전히 미완료이며 명시 합성 자료가 미구성/거절이면 닫는다.

기존 후보의 process-profile·실제 driver/tool·SESSION claim 원형은 채택되지 않았다. 이 WI는 이를 구현하지 않고 원 첫 입력의 출처·단발 yield·인계 후 재공급 차단만 구현한다. 실제 기능·FN07 전체 완료가 아니다.

## 2. 정확한 소유와 변경 사유

기존 Primary 한 명이 다음 정확8 경로만 수정한다.

1. 신규 apps/connector/adapters/secondary/instruction-bootstrap.ts
2. 신규 tests/unit/FN07/claude-instruction-bootstrap.test.ts
3. 기존 apps/connector/adapters/secondary/sdk-query-factory.ts
4. 기존 tests/unit/FN07/claude-sdk-query-factory.test.ts
5. 기존 apps/connector/adapters/secondary/sdk-session-owner.ts
6. 기존 tests/unit/FN07/claude-sdk-session-owner.test.ts
7. 기존 apps/connector/adapters/secondary/session-coordinator.ts
8. 기존 tests/unit/FN07/claude-session-coordinator.test.ts

기존 factory/owner/coordinator 수정은 첫 입력 stream의 생성 시도 결박과 실제 소비 근거 인계 때문이다. 기본 bootstrap 없는 기존 동작·guard·기한·입출력 알고리즘은 유지한다. bridge·codec·receiver·공통 client/permit/server·공개 schema/SQL/package/native는 수정하지 않는다. Main은 같은 제품을 수정하지 않고 지시/검수/통합만 맡는다.

기준 소스는 factory ACACF14D, owner 1F032A5B, coordinator 96AA3134, bridge 760336AC다. 시작 시 전체 지문과 HEAD/index·신규2 부재·관련 없는 보호3을 재검산한다. 추가 경로가 꼭 필요하거나 새 공개/권한/영속 의미가 요구되면 쓰기 전에 정확한 모순을 반환한다.

## 3. 명시 선택과 원 자료·현재성

SyntheticClaudeInstructionBootstrap은 원 START envelope와 별도 원 SEND의 commandRef/pageResultRef/envelope/grantRef/expiresAt 선택, 실제 SyntheticMaterialReceiver, 실제 SyntheticInstructionClientAuthority, 고정 선언 sessionBindingRef·기대 SID, clock/timeout·원 signal을 받는다. 선택은 허가가 아니며 새로운 명령을 만들지 않는다.

선택 원 envelope는 기존 bounded reader로 복사·고정한다. START와 SEND의 context 전체·등록·실행 세대가 같고 SEND sessionBindingRef는 고정 선언 ref와 같아야 한다. 기대 SID는 기존 caller 값으로 유지하며 여기서 새 UUID/원 SID를 발급하지 않는다.

실제 receiver.instruction의 정확 9키·원 key/envelope/ref/영수증/길이/SHA/UTF-8을 재검산한다. 문장을 trim/요약/보완·다른 문서와 합치거나 새 지시를 붙이지 않는다. 빈 값·불량 UTF-8·원 user 외피까지 포함한 기존 상한 초과·비밀 표식/원 receiver 거절은 입력 전에 닫는다. 성공 메서드 override나 가짜 receiver는 허용하지 않는다.

실제 SyntheticInstructionClientAuthority.current와 consume을 사용한다. 원 current의 provider 부분을 Codex 전용 형상으로 해석하지 않고, bootstrap 내부의 닫힌 현재 자료로 요구한다. 필드는 transport/commandRef/envelopeHash/materialReceiptRef/instructionContentHash/sessionBindingRef/grantRef/localAttemptRef/sourceObservationRefs/osOwnershipRef/fact/checkedAt/expiresAt로 한정한다. extra/getter/Proxy는 거절한다.

fact는 기존 readServerExecutionFactV1로 검산하고 원 context/H/E/등록·현재 agentSession.sessionRef·grant/writer·정책·예산·source/OS 근거를 원 현재 fact/selection/자료와 대조한다. executionFactChecks와 WORK 이해검토·CONTEXT_REVIEW READ 조건은 기존 공통 permit 규칙과 같게 소비한다. 형상 적합이 실제 공급자의 진위나 현재 권위를 증명하지 않는다는 false 경계를 유지한다.

localAttemptRef는 실제로 고정된 같은 bootstrap 시도와 결박돼야 하며 caller가 임의 ref를 넣어 성공을 선언하지 못한다. 동일 수명 내 원 시도 ref/hash를 만들고 consume 전에 보존하는 유한 명시 합성 시도 저장 포트를 둘 수 있다. 메모리 장부의 내용을 proof/OS/서버 확인 사실로 바꾸지 않는다. 원 proof/source/OS/current의 실제 검산은 기존 client/permit 경로가 담당하며 실패/불명은 차단한다.

bindingHash는 원 START/SEND·선택·원 자료·context/세션·시도·current의 불변 결박으로 계산한다. checkedAt/기한 변화는 상계를 줄이되 다른 fact/refs로 바뀌면 거절한다. 실제 authority.consume(envelope,원attemptRef,bindingHash)의 원 결과/permitRef/key/grant/기한을 재검산한다. consume 전후 current를 대조하고 더 짧은 기한만 유지한다. 기존 client가 실제 보호 근거를 확보하지 못하면 실패하며 raw 성공 fixture를 실제 권위로 표시하지 않는다.

### 3.1 비순환 시도·current·bindingHash의 정확 순서

순서는 선택/원자료 검산 → 선행 시도 snapshot 고정·메모리 보존 → current 전후 검산과 consume → 단발 stream 노출/실제 yield → Query/init/owner 인계다. 후행 permit/yield/init/결과나 bindingHash를 선행 시도 snapshot에 넣지 않는다.

시도 snapshot은 정확히 {schemaVersion:1,kind:'CLAUDE_BOOTSTRAP_ATTEMPT',attemptDigest,startCommandId,startEnvelopeHash,sendCommandRef,pageResultRef,sendCommandId,sendEnvelopeHash,grantRef,materialReceiptRef,instructionRef,partsRef,instructionContentHash,contextDigest,sessionBindingRef,sessionDigest,createdAt,expiresAt}다. attemptDigest는 원 factory attemptId의 canonical hash, contextDigest/sessionDigest는 고정 기대값의 canonical hash다. createdAt은 원 단조 clock 관측, expiresAt은 이 시점에 이미 알려진 START/SEND/선택/호출/인스턴스 최소기한이다.

localAttemptRef는 {id:새 UUID,version:1,contentHash:hash(snapshot)}다. 같은 bootstrap 수명에서 원 snapshot/ref를 먼저 private 메모리 한 건으로 보존한 뒤 authority.current에 원 material metadata와 함께 전달한다. current/consume 실패 뒤 ref를 바꾸거나 시도를 초기화하지 않는다. 별도 외부 durable 저장/재시작 보장은 없으며 actual client verifier/permit source는 이 메모리 시도와 원 proof를 독립 대조하는 명시 합성 공급자다. 단순 ref 문자열을 실제 OS/서버 증거로 인정하지 않는다.

current exact 필드의 localAttemptRef는 이 원 ref와 같아야 한다. current.fact는 원 fact reader로 검산한다. 불변 factBinding은 {checkedAt,expires,...factBinding}=fact처럼 checkedAt·expires만 제외한 나머지다. current의 checkedAt/expiresAt 및 fact.checkedAt/fact.expires는 매 관측 시 현재성/최단기한에 사용하지만 bindingHash에 넣지 않는다. 다른 fact 필드·원 refs·OS/source 근거는 바뀌면 거절한다.

bindingHash는 정확 {schemaVersion:1,kind:'CLAUDE_BOOTSTRAP_BINDING',localAttemptRef,commandRef,envelopeHash,materialReceiptRef,instructionContentHash,sessionBindingRef,grantRef,sourceObservationRefs,osOwnershipRef,factBinding}의 canonical hash다. commandRef/envelopeHash는 원 SEND이고 localAttemptRef의 snapshot을 통해 원 START/선택/기대 SID와 연결된다. sourceObservationRefs는 원 context sourceScopes의 중복 제거된 최초 순서로 정규화한 exact refs다. current가 같은 집합이 아니면 거절한다.

consume은 이 고정 localAttemptRef/bindingHash만 받는다. 전후 current에서 불변 결박은 같고 모든 기한은 줄어들기만 해야 한다. 후행 permitRef/결과·Query/iterator·yield/adoption 근거는 별도로 보관하며 시도 snapshot이나 ref/hash를 재작성하지 않는다.

## 4. 첫 입력 stream과 단발 소비 근거

검산한 원문만 공식 SDK user 객체로 만든다. type:user, message:{role:user,content:원문}, parent_tool_use_id:null, session_id:기존 기대 SID다. 원 commandId를 식별자로 사용한다. 새 prompt나 SDK Options를 자동 생성하지 않는다.

첫 입력은 private AsyncIterable로 제공한다. iterator 획득은1회, 실제 원 user yield는1회이며 이후 done이다. 실제 next 경로만 module-private 근거를 생성한다. 임의 register/markSent/완료 boolean·constructor 성공 영수증으로 근거를 만들 수 없다. 근거는 원 START/SEND·command/envelope/refs·본문/user digest·material receipt·원 attempt와 동일 create의 private identity에 결박한다.

중복 iterator/다른 create·다른 command/ref·취소·만료/current 변경은 입력을 추가 공급하지 않는다. permit 소비와 실제 yield는 별도 사실이다. 생성 전 거절·permit 소비 불명·미소비·yield 뒤 throw/불명은 각각 정직하게 남기고 재생성/재공급하지 않는다. 소유 bytes는 정상/실패/늦은 정착 뒤 지우고 원 receiver 보관본은 유지한다.

Query 생성 driver에 추가되는 것은 실제 이 단발 iterable뿐이며 임의 prompt·function/SDK 옵션은 받지 않는다. driver가 iterable을 소비하는 메모리 시험을 사용하되 실제 SDK import/query/child는 하지 않는다. 최초 입력을 소비하지 않은 driver가 init만 만들어도 owner를 인계하지 않는다. init이 첫 입력보다 먼저 와도 입력을 자동 채택하거나 새 prompt로 보완하지 않는다. init이 먼저 와도 같은 원 입력의 실제 yield를 기존 최소기한 안에서 기다릴 수 있으며, 이 경우 같은 init/prefix/Query를 보존해 정상 인계해야 한다. 단지 관측 순서가 다르다는 이유로 기한 내 적합한 동일 입력을 미지원으로 바꾸지 않는다. 기한 내 실제 yield가 끝내 없으면 UNKNOWN으로 닫고 새 Query/입력을 만들지 않는다.

## 5. 동일 Query/iterator와 owner 장부 인계

factory는 한 원 attempt와 create만 유지한다. bootstrap 없는 경로는 기존 동작 그대로다. bootstrap 경로는 동일 create의 실제 yield 근거·원 Query 반환·적합 init 관측을 모두 확인한 뒤 같은 Query/iterator/prefix를 기존 owner로 인계한다.

owner는 원 bootstrap 클래스의 private brand와 같은 시도의 미소비 근거를 실제로 검산·한 번 소비한다. caller가 만든 receipt/result 구조나 성공 bool은 받지 않는다. 원 commandId/user digest를 기존 private instruction 장부에 등록해 직접 owner 입력의 재공급을 막는다. 다른 문장/refs/시도는 충돌로 거절한다.

등록 결과는 별도 BOOTSTRAP_INPUT_YIELDED_ONLY 등의 비권한 상태로 구분한다. INPUT_METHOD_SETTLED/SDK 수락·turn완료·응답·업무인수로 위조하지 않는다. 같은 command의 직접 owner 호출은 원 고정 결과만 반환하고 streamInput0이며, 기존 bridge의 unusedCommandId 검사는 같은 명령을 거절해야 한다. bridge 자체는 수정하지 않는다.

coordinator는 명시 bootstrap 선택을 받아 START에 연결하고 원 첫 command의 소비 결과와 이후 SEND를 같은 수명에 결박한다. 새로운 START 공개 payload/서버 저장·자동 선택/대화 생성은 없다. bootstrap 미구성 기본경로는 그대로 유지한다. 초기 입력이 불명이면 같은/다른 command로 새 Query를 만들어 우회하지 않는다.

## 6. 상태·현재성·취소·false 경계

CREATE_ATTEMPTED, INPUT_YIELDED, QUERY_RETURNED, INIT_OBSERVED, OWNER_AVAILABLE, REJECTED/UNKNOWN은 서로 다른 관측이다. 임의 순서를 SDK 공식 보장처럼 가정하지 않는다. 불명 뒤 늦게 온 Query/입력/init이 과거 실패를 성공으로 소급하지 못하게 한다. 원 handle/underlying 점유는 정착까지 보존하고 명시 소유 정리만 소비한다.

caller/선택/envelope/현재 fact/client/permit/모듈의 기한 중 최단만 사용하고 timeout은1~10000ms다. call signal/expiresAt은 진입에서 복사·고정하고 각 await/yield 전후 재검산한다. 취소 뒤 listener/timer와 소유 bytes를 정리하며 기한 연장·자동 재시도는 없다. 원 Query/raw owner를 일반 결과에 내보내지 않는다.

모든 결과 actualExecutionVerified:false, executionAuthorized:false, dispatched:false, workAccepted:false, ownership:UNVERIFIED다. 원문/SID/SDK 오류/Options·Secret을 일반 출력에 반사하지 않는다. 실제 sessionBinding↔SID/보호process·현재권위·모델/비용/도구승인·서버claim·재시작내구 보장은 미완료다.

## 7. 직접 검증과 필수 반례

실제 receiver·authority/client·공통 permit 검산·factory·owner·bridge·coordinator를 사용한 메모리 조립을 적어도 한 정상/중요 음성에서 연결한다. 보호 server/store 원 검산을 성공함수로 대체한 시험만으로 인수하지 않는다. source/OS/proof의 실제 공급자는 명시 합성 대역임을 밝히며 실제 권위로 주장하지 않는다.

필수 반례:
- 원 선택/자료 누락·손상·교차 context/등록/세대/refs·currentfact/OS/source/permit/기한 불일치.
- 실제 consume 거절·불명·중복/다른attempt·포화, yield0·create0의 공급 전 거절.
- iterator미소비/이중획득/이중yield·yield후throw·init먼저후정상yield/미yield기한만료·다른SID·HOLD/취소/current축소/기한만료.
- 위조/다른create/다른owner/중복 근거 인계·직접 owner 같은 command 재공급0·다른본문 충돌·bridge 재공급0.
- underlying 늦은 handle·UNKNOWN 후 재생성0·단발 close·원 prefix/init 무손실·일반오류 비반사.
- bootstrap 없는 기존 경로의 동작·원 guards·한도·기한 유지.

구조적 부재 RED와 실제 행동 RED/GREEN을 구분하며 가짜 제품 RED를 만들지 않는다. 직접 시험은 변경8과 실제 사용한 공통 client/permit/receiver 인접만 선택하고 typecheck/diff를 실행한다. 변경 없는 전수·브라우저·실SDK·운영 검사는 반복하지 않는다.

## 8. 제출·인수·실행 제외

기존 Primary는 정확8·전후 diff/원 지문·명령/exit/fail/skip·RED/준비오류·live/pending/bytes/cleanup·미검증/rollback을 제출하고 writer를 반환한다. commit/push하지 않는다. Main의 독립 C/I0와 fresh 검증 후 소유 파일만 로컬 통합한다.

실제 SDK/CLI import/install/query·OS child/native/compile·도구·계정/비용·DB/권한/키/서비스·실사용자 원문·실자료/백업·J3/P03 R3·Oracle/운영 실행0이다. 새 public API/schema·서버 SQL/권한·실제 prompt 전송/claim을 만들지 않는다. 정확 범위 밖 필요는 Main에 반환한다. 전체 FN07/Stage/계획 완료로 승격하지 않는다.

rollback은 이 내부8경로 변경분과 해당 기록의 정상 revert이며 기존 관련 없는 자료는 보존한다.
