# FN07 normal Query 소유와 SDK 출력 보호 기록 — 미채택 A안

기준은 main `6b3cb086`, 기술 검토 `FN07_NORMAL_SDK_QUERY_OWNER_TECHNICAL_REVIEW_20261116.md` SHA256 `37C6AECFBA7BC42748A4596117ED8B2E41E597B7A39BA5BF6BC2C618E7DBCDAA`다. 이 문서는 신산님의 결정에 앞서 제안하는 계약이다. 제품 구현·실제 실행 승인 상태는 각각 `SOURCE_GO0`, `ACTUAL_EXECUTION0`이다.

## 1. 기존 계약과 결정할 차이

P3 §3.1의 내구 수신·현재성·permit, FN08 normal SEND §5~6의 명시 선택·원문 검산·dispatch 단발, normal STOP §5의 원 owner 협력 중지를 유지한다. 기존 Query 생성·인계 WI는 **합성** bootstrap의 첫 입력·단일 iterator·SID 검산을 구현했다. PR141은 기존 normal polling을 같은 번들에서 조립했다. 두 결과 모두 실제 normal Query 생산자를 제공하지 않는다.

A안에서 결정할 변경은 다음과 같다.

| 항목 | 현재 제품 | 채택할 경우 |
|---|---|---|
| normal START | wire의 `responseRef`가 필수이며 `RESPONSE_RECORDED`를 공급자 응답으로 투영 | 원 worker의 준비 인수는 새 로컬 종단으로 보관. 기존 필수 관측 ACK와 원 종단을 함께 대조. 이때 Query 생성 0회 |
| 첫 SEND | 원 permit·dispatch 시도를 소비하는 전용 wire까지 연결 | 명시 선택한 원 첫 SEND에서만 같은 worker가 Query를 생성. 첫 yield와 init 보호 정착을 각각 검산한 새 로컬 종단 |
| SDK 출력 | codec은 동기 capture·digest, spool은 명령 관측 요약·연속 ACK를 담당 | 원 iterator의 실제 출력을 세션별 보호 기록으로 저장·재판독한 뒤 fullref 발급. 일반 assistant/result도 독립 저장 대상 |
| OS 소유 | normal의 독립 child 소유 관측 생산자 부재 | 이번 A안의 `processRef=null`. 실행 중·종료·writer 해제 판단은 별도 근거 필요 |

## 2. START 준비 수락과 명령 이력

1. `NormalClaudeStartWire.send`는 현재 원 자료·permit·current 검산 뒤 `{transport,responseRef,processRef}`만 받는다. A안은 worker가 그 START를 실제로 인수한 경우에만 비공개 일회 준비증표를 반환하는 별도 분기를 둔다. 증표는 같은 worker 인스턴스, 실행세대, 원 START key/envelopeHash·receivedRef·localAttemptRef·permit.ref와 자료의 contextBundleRef/optionsRef에 결박한다. 복제한 JSON, 다른 worker·시도 또는 준비 전 자료 ref만으로 이 분기에 진입할 수 없다. 증표는 Query 생성·SDK init·OS 소유를 증명하지 않는다.
2. `NormalStartCoordinator.#rows/#run`의 기존 `attempt-<START commandId>` 3번째 행에 `START_READY_RECORDED`를 허용한다. 기존 snapshot 필드 순서·검산 규칙을 사용한다. key/envelopeHash/grantRef/receivedRef는 원 1행, previousRef와 permit은 원 2행과 일치하고, responseRef/processRef는 둘 다 null이다. 단발 증표를 이 거래에서 소비해 행을 append·sync·재판독하고 정상 닫힘을 확인한다. 행 자체의 `{id,version:1,contentHash}`가 준비영수증이다. 원 START 회수 규칙을 완화하지 않고, 신규 목적에서 close 불명을 성공으로 통과시키지 않는다.
3. **권장 A안은 준비 수락을 로컬 종단에만 둔다.** P3 §3.1은 RECEIVED→permit→wire를, 혼합 polling WI §3.4~5는 해당 item의 *필수 관측* 전체에 대한 ACK를 요구한다. 같은 WI §3.2도 `SEND_DISPATCH_ATTEMPTED`를 로컬에만 남긴다. 조사한 계약에서 worker 준비 수락 자체를 서버에 보내라는 별도 요구는 확인되지 않았다. 기존 `reconcile`의 `RECEIVED`, `PREPARED/NONE`(permit 전 자료 수신), `START_ATTEMPTED`, `PERMIT_RECORDED`는 그대로 발행·재생한다. 그 뒤 worker가 실제로 준비를 인수한 3번째 행은 로컬 종료 조건에만 사용한다. 기존 `RESPONSE_RECORDED → PROVIDER_RESPONSE_RECEIVED/UNVERIFIED_PROVIDER_CLAIM` 이력도 원 의미를 유지한다.
4. `NormalStartPolling.run`은 **로컬 준비 종단의 정상 정착·동일 부모 확인**과 **서버 필수 관측 전체의 ACK coverage**를 각각 요구한다. `NormalObservationSpool.record/coverage`에서 원 발생 시각·ref로 중복/연속 digest를 검산한다. 준비 경로에서 마지막 필수 사건은 `PERMIT_RECORDED`의 spool 행 ref다. 로컬 준비행 ref는 서버 ACK의 대상이 아니다. permit ACK만 있고 로컬 종단이 없거나, 로컬 종단만 있고 마지막 필수 관측까지 ACK되지 않으면 cursor를 승격하지 않는다. 여러 batch의 첫 POST 성공으로 대체하지 않는다. 서버에는 permit까지의 사실과 이후 실제 SDK 관측만 표시할 수 있다. 화면에서 worker 준비를 서버 확인 상태로 표시하는 기능은 이 방식으로 제공할 수 없다. 기존 normal 상태·SDK 응답 표시는 확대하지 않는다.
5. 준비 이후 ACK 유실은 기존 원행·시각으로 복구한다. 중도 시도, 불완전 기록, 현재성 상실 또는 정착 불명은 UNKNOWN이며 재인수·permit 재발급·Query 생성 0회다. 재시작 때 완전한 준비행은 **역사**만 복원한다. 새 프로세스에서 같은 이름·PID·sessionBindingRef를 재제출해 live worker를 얻을 수 없다.

**공개 대안이 필요한 경우.** 같은 `PREPARED/NONE`을 두 번 발행하면 spool에서 다른 발생으로 구별해도 서버의 `normal-observations.ts`는 ref 형상만 검산하고 로컬 행을 역조회하지 않는다. `observation-journal-api.ts`는 현재 `SYNTHETIC_ONLY/PROVIDER_CLAIM_ONLY`를 읽으며 `ObservationJournalPages`는 유형 옆에 ‘공급자 주장’을 표시한다. worker 인수 자체를 원격에서 식별·ACK·표시하는 기능을 선택한다면 `PREPARED/WORKER_START_READY`라는 새 공개 조합, 서버/SQL guard, normal 보호조회·UI의 ‘worker 준비 수락 · SDK 실행 미확인’, 이 신규 spool 행까지의 coverage를 함께 채택해야 한다. 이 대안은 기존 승인에서 자동 파생되지 않으며 권장 A안의 필수 API 변경으로 두지 않는다.

## 3. 첫 SEND, 세션, 원 handle

A안의 새 생성 시점은 저장된 첫 SEND를 명시 선택하고, 동일 세대·START 준비영수증·논리 sessionBindingRef·수신 원문/parts·원 SEND localAttemptRef/permit/proof를 검산한 뒤다. `NormalInstructionCoordinator.dispatch`가 `SEND_DISPATCH_ATTEMPTED`를 먼저 정착시킨다. 살아 있는 원 worker만 같은 원 생성 시도에 Query와 iterator 하나를 소유한다. 신규 세션의 계획 SDK SID를 생성 전 보호 결박하고 같은 Query에서 실제 읽은 init SID와 대조한다. Anvil 논리 fullref와 SDK SID를 각각 보관하며 PID를 이 결박의 대용으로 사용하지 않는다.

첫 입력의 async iterable은 승인된 첫 지시 원문에서 만든 사용자 메시지를 단 한 번 반환한다. owner는 원 iterable의 실제 yield 여부와 원 Query의 init 관측을 따로 추적한다. 순서는 SDK가 보장한다고 가정하지 않는다. 둘 다 원 기한 내에 같은 생성에 결박돼야 세션 대응을 확정한다.

| 증거 | 허용하는 주장 |
|---|---|
| 원 dispatch 행·permit | 명시 시도와 해당 허가가 존재함 |
| 원 iterable의 첫 yield | SDK 호출 경계에서 소비자가 요청한 해당 입력을 제공함. 원격 수락 여부 미확인 |
| 같은 iterator의 `system/init` 보호 fullref | 계획 SID가 일치한 해당 SDK 세션의 초기화 메시지를 원 worker가 관측함 |
| 후속 assistant/result의 보호 fullref | 같은 세션에서 검산한 해당 SDK 출력·공급자 주장. 귀속은 `SESSION_ONLY` |
| observation ACK | 서버에 해당 요약의 연속 저장이 확인됨 |

**첫 SEND 전용 종단.** 같은 worker·START 준비행·세대에서 원 첫 SEND의 dispatch 행을 유일한 Query 생성 시도로 결박한다. 동시에 선택한 다른 SEND의 permit은 두 번째 생성 권한을 주지 않는다. `NormalInstructionWire.send`의 신규 private 분기는 원 Query에 넘긴 iterable이 실제로 첫 메시지를 내준 뒤에만 원 지시·SDK 입력 digest·dispatchAttemptRef에 결박한 일회 입력증표를 받는다. §4의 init 확인행을 재판독한 증표도 같은 Query·시도·계획 SID에 속해야 한다. 어느 쪽이 먼저 도착해도 두 증표를 모두 검산해야 한다. 단독 init ref나 호출자가 복제한 결과 객체는 이 분기에 들어갈 수 없다.

`NormalInstructionCoordinator.dispatch`는 기존 3번째 `SEND_DISPATCH_ATTEMPTED` 바로 뒤에 신규 목적의 4번째 행 `FIRST_SEND_INPUT_AND_INIT_RECORDED`를 허용한다. 기존 key/envelopeHash/grantRef/receivedRef/sessionBindingRef/permit/proofResultRef, 원 localAttemptRef·dispatchAttemptRef·previousRef를 재검산하고 신규 목적에만 startReadyRef, 첫 입력 증표의 불변 요약(원 시도와 입력 digest), initConfirmationRef를 결박한다. 이 행의 responseRef/processRef는 null이다. 기존 행 판독과 기존 wire 결과의 exact 형상은 그대로 둔다. 신규 private 결과를 generic `{transport,responseRef,processRef}`로 변환해 `RESPONSE_RECORDED`에 전달하는 경로는 두지 않는다.

이 로컬 종단은 **원 입력을 호출 경계에서 제공했고 같은 SDK 세션의 초기화 메시지를 관측했다**는 영수증이다. 원격 수락·명령별 답변·작업 완료는 미확인이다. polling은 이 4번째 행의 sync·재판독·정상 닫힘과 같은 SEND의 기존 필수 관측 전체에 대한 보호 ACK coverage가 모두 확인된 뒤에만 cursor를 진행한다. 기존 3번째 dispatch는 계속 로컬에만 남고 신규 종단도 command별 `PROVIDER_RESPONSE_RECEIVED`를 만들지 않는다. 어느 증표라도 빠지거나 정착이 불명이면 UNKNOWN을 보존하고 cursor·재생성·재전송은 0이다. 역사 재생은 원 행·시각과 기존 spool ACK만 복구한다. 후속 SEND는 살아 있는 같은 Query의 입력 포트만 쓴다. 시간상 인접한 assistant/result의 명령별 귀속은 미확인으로 둔다.

## 4. 일반 출력의 보호 Sink와 fullref

**저장 권위와 쓰기 순서.** `SDK_SESSION_OUTPUT`는 original native 등록 owner가 소유하는 전용 보호 채널이다. 원 등록 fullref·활성 profile/배정·slot/원 grant·project/execution/generation과 살아 있는 private worker의 동일성을 검산한 내부 포트만 읽고 append한다. caller가 제출한 SID·경로·ref는 이 포트를 열 수 없다. 동일 owner가 원 Query의 동일 iterator에서 `next()` 하나씩 읽는다. `schemas.ts`의 유계 plain-data 판독과 `ClaudeSdkMessageCodec.normalize`의 동기 capture를 그대로 쓴다. 동기 슬롯은 이번 입력의 검산 결과만 받는다. codec의 RECORDED는 메모리 결과이며 임의 thenable 호출이나 비동기 저장을 수행하지 않는다. 별도 owner 생산자가 슬롯과 유계 원 메시지 복사본을 대조해 append·sync·재판독한다. 한 건을 정착시키기 전에 다음 `next()`를 호출하지 않는다.

**init 전 출력과 후행 연결.** 최초 scope는 원 등록/배정, 세대, START 준비행·첫 SEND dispatch fullref, 논리 sessionBindingRef, 생성 전에 고정한 계획 SID의 digest, 원 worker가 **그 Query를 한 번 발급한 시도**다. live Query/iterator는 원 owner가 보유한다. 저장된 시도 ref로 handle을 재생성할 수 없다.

1. 같은 iterator에서 init 전 도착한 assistant/result와 실제 init 자체를 각각 불변 `OUTPUT_PENDING_SESSION` 행으로 보호 저장한다. 행은 목적·버전, 위 scope, 연속 순번·previousRef, observedAt, SDK 메시지 식별·family, payloadDigest, 전체 유계 원 SDK 메시지의 canonical bytes와 격리 판정을 담는다. 내부 저장 ref는 신규 UUID/version 1/canonical snapshot SHA256이다. 재판독에서 전체 bytes와 payloadDigest를 대조한다. 이 단계는 확인된 세션 fullref를 전제로 하지 않으며 일반 정상 출력 영수증을 외부에 발급하지 않는다.
2. 동일 Query의 실제 init에서 관측한 SID가 계획 SID와 일치하면 별도 불변 `SESSION_INIT_CONFIRMED` 행을 append한다. 원 owner와 생성 시도, init 저장 ref, 계획·관측 SID digest, 첫 순번부터 init까지의 끝 순번/개수/tail fullref 및 순서대로 검산한 행 ref·내용해시의 연속 digest를 결박한다. 원 범위 전체의 순번·부모·내용해시와 끝행을 보호 재판독하고 확인행 자체도 sync·재판독한 뒤 연결한다. 이전 원행의 상태나 bytes를 고치지 않는다. 이 확인행이 §3의 initConfirmationRef다. init이 먼저 관측되어도 첫 yield 증거까지 만들어지지는 않는다.
3. 확인 뒤의 새 출력은 같은 scope·확인행·연속 부모에 결박한다. 확인 전 행은 **원행 fullref와 그것을 덮는 확인행**을 함께 검산한 경우에만 `SESSION_ONLY` 정상 요약의 근거로 쓴다. 반환되는 ref는 이 실제 SDK 출력 한 건을 가리킨다. SDK가 개별 SEND의 입력수락이나 답변을 보증한다고 투영하지 않는다. SID 불일치, init 유실, 앞부분 소실·교체, owner/기한 상실 시 이미 쓴 원행과 예약을 보존하고 해당 출력을 격리한 채 UNKNOWN으로 닫는다. 새 iterator로 원행을 채우지 않는다.

**내용, 중복, 격리.** assistant와 success/error result의 메시지 블록 순서와 결과/오류를 포함한 유계 원 메시지 전체를 계획 SID와 원 Query 발급에 묶어 저장한다. init의 요약만 남기거나 일부 텍스트만 받은 경우 일반 출력 저장 성공을 보고하지 않는다. 지원하는 stream_event는 독립 순번을 가지며 partial을 최종 메시지로 합성하지 않는다. SDK 식별·같은 scope·동일 canonical bytes 중복은 기존 원행을 재판독한다. init 미확인 중에는 중복에도 내부 ref만 유지한다. 확인 후 일반 영수증은 같은 ref를 쓴다. 같은 식별에 다른 bytes·부모 충돌·tail 소실·close 불명은 UNKNOWN이다.

비밀·민감 원문을 포함한다고 판정한 bounded 메시지도 **원 bytes 전체의 보호 격리행**으로 저장하고 같은 순번·용량 검산에 포함한다. 모호한 내용은 격리를 유지한다. 세션 확인과 내용 공개 가능성은 독립 판정이다. init 확인으로 비밀을 해제하지 않는다. 격리행은 공개 영수증과 일반 Agent 재전달 대상에서 제외한다. private worker의 원 목적 재판독 외 일반 read/API/UI 열람을 제공하지 않는다. 일반 정상 요약에도 raw SID·본문·도구 인자·결과·env·키·stderr를 노출하지 않는다. codec은 모든 비밀을 판별하는 근거가 아니다. 보호 근거가 없음을 사전에 알면 Query 생성 전 미지원으로 닫는다. 이미 효과가 시작된 뒤 격리·보호 저장에 실패하면 기존 정착분만 보존하고 UNKNOWN으로 닫으며 새 읽기나 digest-only 성공 대체는 허용하지 않는다.

**용량과 선행 결정.** 기존 SDK 객체 2MiB(`maxSdkObjectBytes=2097152`), codec 식별 한도(최대 1024), 기존 파일 3MiB·채널 64MiB/10000행·SEND attempt 행집합 2MiB 및 원 호출 기한을 유지한다. 원문이 2MiB에 맞아도 metadata를 포함한 실제 행이 파일/채널 한도에 들어가는지 별도 검산한다. 데이터와 관리행 전체, 미확인·격리·init 확인행, 잠금·예약 및 불명 시 보존하는 최악 점유를 각각 선예약하고 실제 점유와 대조한다. 다음 입력의 exact 크기를 읽기 전 알 수 없으면 그 호출의 허용 최악분을 예약할 수 있을 때만 다음 메시지를 받는다. 기존 observations/acks 채널은 요약·ACK 전용이다. SEND 종단에는 원 SDK body를 내장하지 않는다. output 정착 후 별도 SEND 종단의 정착이 불명이면 output만 보존한다.

선행인 **미채택 보호 spool 후보 `9E98D4EA…CE9C4C`**는 현행 intake/attempt/observations/acks 네 채널만 열거한다. 이 SDK 후보의 별도 저장 변경은 같은 등록 writer `NORMAL_EXECUTION`의 **기존 256MiB 배정 안에** 제5 채널 `SDK_SESSION_OUTPUT`을 등록하는 것이다. 동일 profile의 모든 프로젝트/세대와 다섯 채널이 같은 예약 잔량을 사용하고 행·관리 비용을 차감한다. profile 관리원장의 별도 관리 비용도 그 배정 규칙을 따른다. 미정착·정산 불명은 원 최악 예약을 유지한다. 새 256MiB, 전체 1GiB 증액 또는 다른 writer 잔량 전용은 없다. 9E98 지문은 그대로 둔다. **9E98 선행 채택·해당 보호 기능·제5 채널 변경의 채택**이 함께 성립하기 전에는 배정 사용 0, SDK 보호 저장 미지원·미완료다. RAM에서의 형상 검증은 실제 보호 저장 지원과 별도로 기록한다.

## 5. 종료와 실제 실행 선행

원 owner는 생성 중/성공/불명 상태, Query·iterator·원 child의 실제 반환 여부와 원 기한을 보유한다. STOP은 기존 normal STOP 권위·현재성·원 session/stopScope를 만족하는 같은 owner만 cooperative interrupt를 단발 요청한다. close와 interrupt의 반환은 실제 종료나 작업 성공을 입증하지 않는다. 취소/기한 후 늦은 원 handle은 이 owner의 정리에만 사용한다. 원 child 결박·종료·flush가 검산되지 않으면 UNKNOWN, 자동재생성·자동 resume·복구를 위한 새 Query는 0회다. 기존 내구 행·정규 fullref가 있어도 live capability는 재발급하지 않는다.

고정 SDK 0.3.224의 공개 6구간에서 확인한 spawn hook 동기 반환과 SDK가 쓰는 stdin/stdout, 제한된 argv/env·PermissionResult 선언만 기존 근거로 유지한다. 실제 normal module import/query 호출, 원 child·Query와 같은 owner의 생산, 보호 실행구성·허용 argv/env 전체·tool decision은 미연결이다. CanUseTool 전체 선언·실제 소비가 미확인이고 SDK 반환 포트 자체에 별도 stderr가 없다는 점도 유지한다. 이 후보를 실제 도구 허가·새 admission·OS CURRENT·키·권한·실행 승인으로 쓰지 않는다.

## 6. 후속 source 단위와 합성 인수 기준

- START와 공개 요약. `normal-start-wire.ts`, `normal-start-coordinator.ts`, `normal-start-polling.ts`, `normal-observation-spool.ts`, 서버 `normal-observations.ts` 의 기존 의미를 대조한다. 권장안의 서버/SQL 변경은 0이며 공개 대안을 채택할 때만 후속 guard를 추가한다. 신규 준비 증표 위조/재사용 거절, Query 0, 자료 PREPARED 단 한 건과 로컬 worker 종단의 분리·permit ACK만 존재할 때 cursor 0, 일반 provider 응답 0, 불완전 시도 UNKNOWN, 끊긴 ACK 복구·부분 ACK cursor 0, 기존 RESPONSE 이력·기존 SEND/STOP 의미를 시험한다.
- 첫 입력과 소유. 별도 normal owner/driver가 기존 `NormalInstructionWire.send`와 `NormalInstructionCoordinator.dispatch`의 일회 증표를 소비한다. init 선도착/첫 yield 선도착, 다른 SID·다른 worker·다른 부모/기한, 늦은 child, STOP/close race와 재시작을 RAM으로 시험한다. 정상 1 Query·1 iterator·1 첫 입력, 불명 후 추가 생성 0을 단언한다. synthetic factory를 normal로 등록하지 않는다.
- 출력 저장. init 외 실제 형상의 assistant와 success/error result 각각에 대해 보호 본문을 읽고 canonical digest·scope·기한·원 fullref를 대조한다. 동일/상이 중복, 누락·위조·교체·한도 초과, sync/readback/close 불명, output만 정착한 경우, credential·scope 상실 후 추가 저장 0을 검사한다. 공개 요약에서 본문·SID·도구 원문 유출 0, session-only 사건의 SEND별 답변 분류 0, 독립 OS 근거 없는 processRef=null을 확인한다. codec의 동기 capture·thenable 거절과 기존 원장 호환 시험을 보존한다.

- 신규 종단 회귀. init 단독, yield 단독, 임의 generic responseRef, 다른 시도의 두 증표, 부분 ACK는 모두 cursor 0이다. 양쪽 증거의 도착 순서를 바꿔도 같은 생성 시도의 정상 정착·전부 ACK 뒤에만 진행한다. 과거 RESPONSE 행은 원 방식으로 재생한다.
- 선행 출력·quota 회귀. init 전 assistant와 error result를 순서대로 정착시켜 정상 영수증 0을 확인한다. 올바른 init의 후행 확인으로 원행 bytes/refs 불변과 SESSION_ONLY 연결을 대조한다. init 유실·틀린 SID·앞 순번 교체·격리 민감 원문·원 owner 교체를 각각 거절한다. 기존 네 채널과 경쟁하는 마지막 예약, 데이터는 맞지만 관리행이 넘는 경계, profile 부재/미등록, 정착 불명의 최악 예약 보존을 RAM으로 검산한다.

남은 직접 결정은 normal 첫 SEND의 생성 시점·원 worker 소유·첫 yield와 init 정착을 함께 증명하는 새 종단, START 준비 수락의 새 저장 의미(원격 식별을 요구할 때만 별도 공개 reason), 세션 출력의 보호 본문 범위·채널/권한 격리·합산 예약·fullref 발급 의미다. SDK 실제 호출·운영 저장·실제 Agent 검증은 이 후보의 결과가 아니다.
