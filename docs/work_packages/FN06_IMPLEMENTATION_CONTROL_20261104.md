# FN06 source 구현 Main 접합 기록

2026-11-04 · 기존 직접 채택과56경로를 상속 · 실제 실행 GO0

## 1. S2 N event cap과 예약 M의 구분 확인

Primary의기존 nativeLimits.event4MiB 재사용보정2PASS를수거했다. event방어cap과command2MiB를혼용하지않는것은필요하다. 다만보고된M이실제예약량인지입력최대허용검사인지는구분해야한다. 현재builder의N항목별typed max/예약bytes와방어cap을Main에게메타데이터로반환한다. 부모계상의후속5개wrapper1398/1121/1707/1539/3228B·합계8993B와달라졌으면실제source원형/escaping/projection차분을설명한다. 전역event4MiB를각항목의예약량으로무조건넣어정상입력을불필요하게거절하거나반대로과소예약하면안된다.

원기존guard가생산할수있는CONTEXT_INVALIDATED등실패분기의실제event와slot/typedM대응도확인한다. 없는정상fixture를만들거나기존cap을낮추지않으며필요한경우정확typed최대보완을Main에게반환한다. 이는확정결함판정이나S2중단지시가아니며독립quota/guard구현은계속한다.

## 2. S4 보호 current 공급의 최소 접합 방향

읽기조사결과기존HUMAN고정조회는ATTEMPTED/미CONFIRMED때DELIVERY_UNCONFIRMED상태만돌려정확current tuple을공급하지못한다. 원server의freshHost/hostCurrent→기존native Bearer전용current route는정확tuple을생산하며그경로자체에DELIVERY_CONFIRMED선행조건은없다. 실제desktop조립caller는아직없다.

Main은새public endpoint를먼저늘리는대신허용새client/HTTPS파일의별도보호closure에서기존고정Bearer current GET을실제소비하는방향을선택한다. receiver가보유한원native opaque43은closure안에서만쓰고renderer/IPC/일반JSON에반환하지않는다. 실제기존route·인증형식·authority/owner·pinned origin/CA/hostname·기한/단발예산을source상수와실제producer로검산한다. 새로운caller URL/헤더목적을일반포트로열지않는다.

이것은동일native channel.current를호출하는안이아니다. 그것을owner.read에연결하면protect→slot.readMaterial→owner.read로재귀하므로금지한다. 보호 current를원low-level HTTPS driver로직접공급하고실제slot getChannel의private생존증거와별도로검산한다. ACK전challenge/consume/sign을수용증명의전제로호출하지않는다.

profile의새purpose/prefix와기존channel profile을그냥cast하면안된다. 실제기존endpoint권위·원native authority/metadata의profile fullref·TLS자료가동일검증경계로이어지는지명시적으로대조한다. 이기존소비로닫히지않아새public응답/정책/필드가필요하다면현재부재근거와최소delta를Main에게먼저반환한다. 없는current를상태bool이나성공callback으로만들지않는다. source실제조립은아직미완료이며실제네트워크/DB/helper실행은0이다.

## 3. 불변 plan과 단계별 선예약의 경계 검산

Primary가 Window 준비 시에는 원 command/intent가 아직 없다는 점을 확인했다. 부모 계상 문서 3절은 실제 fixed intent에 따른 N 초기량과 원 native 인증 Tx 선예약을 요구하고, wire의 예약 접점은 Window 이전·Offer/ARM·native Tx로 구분한다. 이 두 사실을 함께 유지해야 한다.

현재 불변 plan의 maxBytes를 사후 덮어쓰거나 기존 source의 방어 cap을 정상 예약량으로 확정하지 않는다. Window 초기 확보량과 Offer/ARM의 실제 원문 확정 후 필요한 추가 확보량, 원 native Tx의 N 실제 전환을 각각 어느 기존 행/함수/잠금이 소유하는지 표로 제시한다. 불변 plan을 보존하면서 부모가 허용한 수치 summary 전이만으로 닫히는지, 불가능하다면 정확히 어떤 채택 조항끼리 충돌하는지 반환한다. 새 schema/plan 의미를 임의 추가하지 않는다.

이 검산 중에도 독립된 profile 보호·digest·유한 ticket/phase guard·기존 collector 접합의 구현은 계속한다. 현재 작성 중 공백은 완료나 정식 실패로 세지 않는다. 실제 DB/권한/키/서비스/Agent/컴파일 실행은 계속 0이다.

## 4. 계상 담당의 독립 읽기 지원

담당 remaining_execution_dependencies는 3절의 단계별 예약 문제만 독립 검토한다. 부모 계상 문서 3·5·11·13절, wire의 예약 접점, 채택 WI에서 Window 최초 생성 당시의 불변 plan과 원 command 확정 이후 N 예약의 관계를 대조한다. 실제 작성 중 코드를 결함으로 확정하거나 수정하지 않는다. 기존 공개 원형·일곱 표·plan 불변성을 바꾸지 않고 허용된 수치 전이만으로 닫을 수 있는지 문서 근거를 반환한다. 불가능하면 충돌 조항과 최소 결정 사항을 구분한다. Primary의 표 제출과 합쳐 Main이 판정한다. 반복 전수검사·시험 재실행·문서/제품 쓰기·실환경 실행은 0이다.

## 5. S4 current의 profile/TLS 대응 읽기 지원

담당 remaining_stage_b_dependencies는 2절에서 확인한 기존 native Bearer current GET을 새 최초 수신의 보호 closure에서 소비할 때 필요한 정확 대응만 읽기 조사한다. 기존 native HTTPS driver의 profile 목적·origin·path/prefix·CA/hostname·authority profileRef/metadata와 채택 first-receive Profile/Head 원형을 비교한다. 같은 등록/설치의 서로 다른 profile 목적을 cast하거나 caller URL을 허용하지 않고 기존 API를 소비할 수 있는지, 정확 필드와 생산자 근거를 반환한다. 가능하면 허용 파일 내 최소 조립 위치를 제시하고, 불가능하면 새 계약이 필요한 실제 차이만 보고한다. 이전 HUMAN/slot 공급선 조사 자체를 반복하지 않으며 작성 중 새 client의 부재를 결함으로 세지 않는다. 쓰기·시험·네트워크·실파일/키 조사·실환경 실행은 0이다.

## 6. S4 profile/TLS 대조 반환

기존 channel은 identity.channelProfileRef와 source CA/expiry를 묶는다(native-preparation-client.ts:6, native-preparation-https.ts:38/48). 새 Profile은 목적 NATIVE_CHANNEL_PROFILE, nativePrefix /api/v1/native-first-receive, caPem/caSha256/serverName 및 보호 HEAD/anchor를 가진다. 같은 등록/설치만으로 두 ref가 같다는 근거는 없다.

기존 current 주소는 native-preparation-https.ts:67의 고정 /api/v1/connector/native-preparations/{authorityId}/current이며 서버 project-native-preparations.ts:88/91은 hostSource origin host와 authority.channelProfileRef 일치를 검산한다. 보호 NativePreparationCurrentSource mapping의 binding.channelProfileRef가 current→authority/hostSource로 연결되는 실제 원 producer는 존재한다. 새 PROFILE/HEAD와 그 mapping의 대응은 아직 증명되지 않았다.

S4에서는 실제 보호 producer가 정한 원 channel ref/원 CA 및 새 수신 profile의 관계를 명시적으로 검산해야 한다. 새 profile의 CA나 ref를 원 native 것으로 cast하지 않는다. 기존 HTTPS의 hostname/CA/rejectUnauthorized/agent:false를 유지하고 caller URL·범용 path를 열지 않는다. 정확 대응이 없으면 공급 포트/현재 조립의 실제 차이를 반환하며 새로운 공개 권위를 임의로 만들지 않는다. 이는 작성 중 코드의 확정 결함이나 새 endpoint 추가 지시가 아니다.

## 7. S2 예약 계산 6함수 동결 읽기 검수

Primary가 아래 SQL 함수 본문만 동결했다. 같은 0076 파일의 다른 목적 writer·최종 역완결·원 native 접합은 계속 작성하므로 전체 파일 지문 변경 자체를 불안정이나 결함으로 세지 않는다.
대상 파일: db/migrations/0076_native_first_receive.sql.pending
함수: fn76_slot_actuals, fn76_rl_remaining, fn76_native_pending, fn76_native_remaining, fn76_reservation_remaining, fn76_reservation_refresh.
중간 제출 파일 지문907AA298CC2807BF10E50C9EDD5BABC1F63CE56056822218E08EDB3051B0246D는 시점 참고이며 이후 파일 전체의 불변 주장용이 아니다. 검토 전후 여섯 함수의 실제 본문 지문을 대조한다. 관련 기존 typed 계산은 apps/server/modules/executions/native-first-receive-store.ts에 있으나 파일 동결 대상은 아니므로 변경이 있으면 같은 시점의 상관 관계로만 판정한다.

담당 A remaining_execution_dependencies: fn76_native_pending/native_remaining/reservation_remaining 중심으로 부모 typed N의8978B, CONFIRMED 뒤6474→4767→3228→0, 실제 Binding/원 authority_complete/event 순서, 단계별 수명·미발생량/자기비용·UNKNOWN hold를 검토한다. 입력 방어 cap을 예약량으로 재사용하거나 namespace ceiling−actual로 불필요 hold/조기 해제를 만드는 구체 반례만 반환한다.

담당 B remaining_stage_b_dependencies: fn76_slot_actuals/rl_remaining/reservation_refresh 중심으로 물리 slot 소유·정확 project/window·원행과 불변 filled slot의 actual, 가변 head/ticket growth, 단계에서 도달 가능한 R/L remaining, 요약 actual/remaining과 회계 차분을 검토한다. 기존 사용자 자료는 읽지 않고 source만 본다.

부모 기준은 FN06_PHASED_RESERVATION_INTERNAL_DETAIL_20261104.md와 채택 wire/account/WI다. 아직 없는 목적 writer·원 native private Tx 선예약·전체 deferred closure·실PG의 부재는 Primary가 미완료로 명시했으므로 이번 계산 함수의 확정 결함으로 세지 않는다. 이 함수들이 요구하는 선행을 향후 writer가 충족해야 한다는 인수 조건은 별도 반환한다. 기대 조건을 가정해 가짜 PASS로 만들지 않는다.
쓰기/시험/PG/권한/키/서비스/Agent/컴파일/원격 조회0. 이미 완료한 codec/profile 검사를 다시 하지 않는다. 추정 경로/glob을 사용하지 않고 위의 정확한 기존 파일과 확인된 참조만 읽는다.
## 8. 예약 계산 검토 반환과 기존 이벤트 순서 확인

7절의 한정 결과는 A C0/I1, B 확정 C/I0·인수 checkpoint1이다.
I1: 현재 fn76_native_pending은 CREATED→ATTEMPTED→CONFIRMED→CHALLENGE만 허용한다. 기존0071 history와 project-native-preparations의 hostChallenge는 CONFIRMED 선행을 요구하지 않아 CREATED/ATTEMPTED/CHALLENGE가 성립할 수 있다. 기존 authority_complete를 통과해도 새 계산기가 거절할 수 있다. 미작성 writer 부재와 다른 실제 입력 호환 차이다.
Main 원칙은 기존 허용 순서와 legacy guard를 몰래 강화하지 않는 것이다. 순서 때문에 새 guard를 바꾸거나 기존 API를 좁히는 대신 계산기를 기존의 실제 유효 사건과 맞춰야 한다. 정확한 기존 의존·횟수 범위를 아래 읽기 지원으로 먼저 확정한다. Primary는 이 결론 전 순서 제한으로 우회하지 않으며 독립 broker/다른 writer 접합은 계속한다.

담당 A remaining_execution_dependencies는 기존0071 history 및 현재 hostChallenge/hostProof/hostConsume의 정확 실제 생산 조건을 대조한다. CONFIRMED 전 허용 사건·ATTEMPTED 선행·proof/consume의 선행·kind별 반복 가능/최대 실제 발생 수를 표로 반환한다. 현재 N7와 후속5 상계가 실제 허용 생산을 덮는지도 구분한다. 같은 event-kind 중복이 가능한지를 추측으로 채우지 않는다. 기존 정상 예시와 기존 guard가 거절하는 예시를 대조하고 source 근거만 반환한다. 실제 PG실행/기존 SQL변경/새 policy 결정0.

B checkpoint: fn76_rl_remaining은 개별 ticket의 stage/finished_at가 아니라 window 전체 terminal만 보므로 종료된 REJECTED/CONSUMED ticket의 불필요 growth·후속 slot을 유지할 수 있다. 목적 writer가 종료 ticket에 더 쓸 수 있는 칸과 도달 불가능한 칸을 정할 때, immutable finished ticket은 growth0이고 불가능한 미발생 slot은0인지 실제 계약으로 닫아야 한다. 아직 writer가 없으므로 완성 구현의 확정 I로 세지 않았으며 인수 조건으로 남긴다.
새 BINDING 이전 private Tx 선확보·원행/요약 producer·양방향 deferred closure·실PG는 계속 미완료다. 현재 검토를 전체 S2 합격으로 승격하지 않는다. 추가 코드 writer0, 실제 DB/권한/키/서비스/Agent/컴파일0이다.
## 9. N 순서 호환 I1의 Main 보완 판정

8절 실제 생산 조건 조사로 기존 경로가 CONFIRMED 단일 직렬 순서가 아님을 확인했다. Main은 기존 guard/API를 강화하는 안을 채택하지 않는다. 현재 승인된 source 구현 안에서 새 예약 계산과 접합 시점을 기존 유효 생산과 맞추는 보완을 수행한다. 여섯 함수의 읽기 동결을 해제하며 동일 Primary만 수정한다.

- DELIVERY_ATTEMPTED는 최대1, CONFIRMED/UNCONFIRMED는 합쳐 최대1이고 같은 deliveryId의 ATTEMPTED가 필요하다.
- CHALLENGE는 원 bearer/current/authority/target/nonce 조건 아래 최대1이다. API/history 자체는 ATTEMPTED나 CONFIRMED 선행을 요구하지 않는다. 정상 공급자는 ATTEMPTED COMMIT 뒤 token을 전달하므로 정상 수신자가 그 뒤 CONFIRMED 저장 전에 호출할 수 있다. 그 이전 token 획득을 정상 사례로 주장하지 않는다.
- PROOF는 별도 hostProof가 아니라 hostConsume 내부에서 challenge와 원 request/target/nonce·등록서명·기한을 검산한 뒤 생성한다. CONSUME는 같은 Tx의 바로 다음 sequence이며 proofRef/previousRef가 정확 일치한다. 각각 최대1이고 같은 소비 재조회는 REPLAY_ONLY이다.
- 따라서 CREATED/ATTEMPTED/CHALLENGE/PROOF/CONSUME/CONFIRMED와 CREATED/ATTEMPTED/UNCONFIRMED/CHALLENGE/PROOF/CONSUME의 기존 조건 충족 사례를 새 계산기가 임의 거절하지 않아야 한다. delivery outcome이 UNCONFIRMED라는 사실만으로 아직 가능한 CHALLENGE/PROOF/CONSUME를0으로 해제하지 않는다.
- 실제 채워진 kind와 기존 의존 관계를 기준으로 missing-slot 비용을 계산한다. 원 현재 조건이 여전히 가능한 후속은 유지한다. 종료/불가로 해제하려면 실제 소유 원행과 guard 근거가 있어야 하며 caller bool·상태명 하나로 대신하지 않는다.
- N7/CREATED 이후5행 상계는 현재 실제 producer의 kind별 최대1에서 유지된다. 새 ACK v1인 bound window만8978B를 쓰고 legacy 일반 ACK 최대폭8993B 경로와 섞지 않는다. CONTEXT_INVALIDATED는 schema가 허용하지만 현 append producer가 확인되지 않았으므로 이번에 생산자/slot을 임의 추가하지 않는다. 미래 연결 시 별도 차분 검토가 필요하다.
- PROOF만 있는3228B는 같은 Tx의 논리적 중간 투영일 수 있으나 정상 독립 COMMIT 상태가 아니다. 기존 producer의 pair가 만들어지는 도중 quota projection이 전체 완료 검사를 너무 일찍 요구해 유효 Tx를 깨지 않는지도 접합 시 확인한다. 최종 원 authority_complete/history와 deferred 무결성은 그대로 요구하고 불완전 pair COMMIT은 계속 거절한다. 투영 계산과 실행/저장 권위 인증을 섞지 않는다.

실제 새 RED→최소 보완→GREEN에 위의 유효 interleaving과 UNCONFIRMED 뒤 유효 후속, 중복 outcome/challenge·challenge 없는 proof·깨진 pair의 거절을 포함한다. 이전 UNCONFIRMED→0 기대는 기존 실제 생산을 충분히 반영하지 못한 작성 중 가정이므로 바뀌는 기대와 source 근거를 명시한다. 테스트를 삭제하거나 원 guard·권한·최종 무결성을 낮춰 통과시키지 않는다. Main은 새 코드가 동결 제출되면 해당 수정분만 재검수한다. 실제 PG·DB·권한·키·서비스·Agent·컴파일 실행은 계속0이다.
## 10. 종료 ticket의 미래 비용 계약 읽기 지원

담당 B remaining_stage_b_dependencies는 7~8절 checkpoint를 닫기 위해 채택 문서의 ticket 종료 후 허용 변경만 읽기 대조한다.
정확 부모 경로는 docs/contracts/FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md, docs/contracts/FN06_NATIVE_FIRST_RECEIVE_ACCOUNTING_PROPOSAL_20261104.md, docs/contracts/FN06_PHASED_RESERVATION_INTERNAL_DETAIL_20261104.md다.
REJECTED/CONSUMED/finished_at가 확정된 ticket에 이후 mutable 열 갱신이나 PROOF_EVIDENCE/CONSUME_REPLAY/감사 등 어느 고정 slot을 더 쓸 수 있는지 표로 반환한다. 같은 ticket의 슬롯과 다른 phase/공유 security aggregate의 실제 비용을 구분한다. OPEN 등이 실패하면 이후 phase 도달을 어떤 원형/규칙이 막는지, 명시 규칙이 없는 부분은 무엇인지 구분한다.
현재 작성 중 목적 writer의 부재를 결함으로 단정하지 않고 부모 원문에서 확정 가능한 조건과 실제 미정인 조건만 반환한다. 새로운 공개 의미·nonce 재사용·행slot 추가를 제안 구현하지 않는다. 코드/문서/시험 수정과 실제 환경 실행은0이다. 경로 추정 없이 위 정확 파일만 읽는다. 현재 Primary의 단독 구현은 계속한다.
## 11. N 순서 호환 수정분 재검수

수행자 보고: store 시험의 유효 interleaving/UNCONFIRMED 후속2RED→2GREEN/165.8836ms/exit0, SQL 결박/중간 투영과 최종 완결 분리2RED→2GREEN/163.8882ms/exit0, root noEmit0.
정확 명령은 node --test --test-name-pattern='CONFIRMED 뒤에도|원 native의 CONFIRMED 전' tests/unit/FN06/native-first-receive-store.test.ts 및 node --test --test-name-pattern='SQL N 순서표|N 중간 예약 투영' tests/unit/FN06/native-first-receive-schema.test.ts다. 결과 key는 fn06_native_interleaving_red/green, fn06_native_sql_interleaving_red/green, fn06_interleaving_typecheck다. 아직 Main 독립 실행이나 실제 PG 결과가 아니다.
Primary는 fn76_native_pending/fn76_native_remaining/fn76_native_binding_final 세 본문을 다시 동결했다. 다른 함수·목적 writer·HUMAN 입력·ARM header·broker는 계속 작성한다.
담당 A remaining_execution_dependencies는 9절 I1과 수정분의 새 손상만 읽기 재검수한다. 실제 기존 의존표·UNCONFIRMED 후속·중복/깨진 pair 거절, 비용 중간 투영과 최종 authority_complete/deferred trigger의 분리 및 bound/legacy 범위를 확인한다. 최종 pair COMMIT 실제 PG PASS를 주장하지 않는다. 전후 세 본문 지문을 대조하며 전체 파일 변화는 다른 writer 작업으로 구분한다. source/table/integrity 완성 전 부재는 명시 인수 조건으로 남기고 확정 결함과 구분한다. 쓰기·시험·실환경0.

## 12. 종료 ticket 미래 비용의 Main 내부 판정

부모 계상과 wire는 확정된 같은 ticket의 재사용·새 nonce·새 개별 audit를 금지하고, 성공/거절 자식행·audit의 원 Tx 완결 및 동일 요청 새행0을 요구한다. Main은 목적 writer의 열 전이를 다음처럼 닫는다.
- REJECTED/CONSUMED와 finished_at 및 해당 분기의 실제 필요 자식행·result/evidence/replay/audit가 같은 원 Tx에서 완결된 뒤, 같은 ticket의 모든 열은 NULL까지 그대로 보존한다. 나중 NULL 보충이나 stage/result/ref/시간 덮어쓰기를 하지 않는다.
- producer는 필요한 실제 자식행·감사와 정확 ref를 먼저 완결하고 terminal stage/finished_at를 확정한다. 최종 역완결과 효과 전 확보·append/refresh/회계 차분의 같은 Tx 조건을 유지한다.
- 위의 확정 종료가 입증된 같은 ticket은 미래 growth0·도달 불가능한 미발생 slot remaining0이다. 필요한 실제 보관행은 actual에 그대로 남고 공간 확보를 위해 삭제하지 않는다. 미완결/오염을 종료로 가장해 해제하지 않는다.
- UNKNOWN은 확정 종료가 아니며 원행·hold를 유지한다. 새 nonce·재시도·자동회수0이다.
- 같은 ticket의 원결과 재조회와 종료 뒤 공격/충돌/포화 요청의 공유 security aggregate를 구분한다. 공유 actual/growth는 별도 계상하며 ticket의 해제로 지우거나 중복 산입하지 않는다.
- 다른 phase의 가능성은 실제 필수 ref와 채택된 전이로 개별 판정한다. STATE1 실패로 STATE2나 다른 phase를 자동 금지하지 않고, CLOSE 거절을 CLOSED로 만들지 않는다. 필요한 후속 회수/정착을 일반 terminal bool로 지우지 않는다.
이는 기존 단발/완결 정책의 내부 열 전이 상세이며 새 공개 입력·표·권한·기한·자동삭제를 추가하지 않는다. 같은 Primary가 기존 허용 파일에서 반례와 구현을 작성한다. 실제 DB 실행은0이다.

## 13. 필수 회귀 시험 한 파일 delta의 읽기 확인

Primary는 기존 tests/unit/UI11/preparation-policy.test.ts가 정확12 목록을 고정해 채택된 새 HUMAN3/read3와 불일치한다고 보고했다. 이 파일은 현재56 밖이므로 아직 수정하지 않는다. Main의 읽기 확인에서 파일은 tracked clean이며 SHA256 8E045C88A8EED438C59A2D39BCA6468416B7D3A7785D28B49D5DCF005F30EDB8이다.
시험의 실제 import는 apps/web/src/features/connections/policy-editor-profile.ts다. Main은 permissions 폴더로 잘못 추정한 조회를 중단했고 재실행하지 않는다.
담당 B remaining_stage_b_dependencies는 위 정확 source와 시험 및 채택 WI의 operation 목록만 읽어 기존12 보존·새6의 정확 이름/소비, 18목록 정합에 필요한 최소 test delta인지 확인한다. 기본 미선택·DENY·acknowledged=false, 다른 규칙 보존·각 disposition 정책 편집 왕복, 실제 실행/credential/자료의 요청0 거절을 유지하는지 구분한다. 정책을 작성하는 시험을 실제 native 권한·승인 소비 PASS로 해석하지 않는다.
이 단계는 읽기 확인이며 추가 파일 구현 GO가 아니다. source/API/권한 기능을 새로 더하거나 기대를 줄여 통과시키는 변경은 허용하지 않는다. 실제 코드 수정과 시험은0이고 Main이 증거를 보고 내부 필수검수 delta 여부를 판정한다.
## 14. N 수정분 인수·동결 해제와 필수 시험 delta

담당 A가 11절 수정분의 기존9절 I1을 ADDRESSED·수정 범위 C0/I0로 반환했다. 세 함수 전후 본문 SHA가 동일했다.
- fn76_native_pending: 866043FE489E5ED3E110E2E07A868CAB9872DA640E9687FAD5CB80C8595521FC
- fn76_native_remaining: 2DD8D842E62684502A5EC23730D38A683378B3F94963485AFDB96009CECFDE28
- fn76_native_binding_final: AAD41E17C3E7A2AAE3F99AE992321BAA69231096DCBE9B8338B8DEDAA823F91D
기존 valid interleaving·UNCONFIRMED 뒤6474B 유지와 소비 후 미생성 outcome1106B, 중간 투영의 원 hash/bytes/sequence/previousRef 대조와 최종 deferred authority_complete/reservation 검산을 확인했다. 실제 PG의 pair COMMIT/거절은 NOT_RUN이다. 이 세 함수 동결을 해제하고 목적 writer·선예약·전체 역완결·S3~S7을 계속한다.

13절 읽기 확인은 기존12 보존과 채택 HUMAN3/read3 정확6 추가가 필요한 기존 회귀 시험의 최소 정합이라고 반환했다. Main은 docs/contracts/FN06_REQUIRED_POLICY_TEST_PATH_DELTA_20261105.md SHA256 45349EE2BBF6E9E977C4FED9A5ECAAE00B67587864B712131AB047A68A39CBE8로 한 파일만 파생 허용했다. 기존56+정확시험1=57이며 제품/API/권한 의미는 추가하지 않는다. 수정 전 raw/clean 대조와 목록·시험명 외 단언 불변, 정확4개 정책 시험과 diff 증거를 제출한다. 원 source adoption의 bytes/hash는 보존한다.
## 15. 필수 정책 회귀 시험 delta 수정분 검수

2026-11-05 Primary가 파생45349EE2를 읽고 수정 전 raw8E045C88 동일을 확인했다. 정확 node --test tests/unit/UI11/preparation-policy.test.ts는 기존3P1F/595.207ms의 정확12 목록 불일치 뒤, 허용된 ops6·시험명2곳 정합 후4PASS/skip0/593.321ms/exit0와 diff check0을 제출했다. 결과 key fn06_policy_required_regression_red/green이다. 이는 정책 작성/저장 합성 검사이며 실제 권한·수신 실행이 아니다.

담당 B remaining_stage_b_dependencies는 같은 정확 시험 파일의 실제 diff만 읽기 검수한다. 수정 전후 ops 기존12 이름/상대순서 보존, 정확새6·18 전체비교, 시험명2곳 외 변경0, 기존 assertion/negative/기본 DENY/acknowledged=false/다른 규칙·원문/준비POST0·명시송신POST1·ops×3=54조합이 유지됐는지 확인한다. 테스트를 다시 실행하거나 source를 수정하지 않는다. 새 제품 코드 검토로 범위를 넓히지 않는다. 수정 전 기준은 C3 HEAD의 원파일 및 파생 판정의 raw8E045C88이다. 전후 현재 파일 지문과 검토 결과를 반환한다.
## 16. 정책 회귀 시험 delta 한정 인수

Primary는 새6 목록/시험명2곳 정합 뒤 정확 node --test tests/unit/UI11/preparation-policy.test.ts의4PASS/skip0/593.321ms/exit0와 diff check0를 제출했다.
담당 B가 현재 raw7B02263BBE551F08389152811A4E90B729D89E65C61B48C0064B2BA61274F020의 전후 동일 및 허용3지점만 역치환한 raw가 원8E045C88A8EED438C59A2D39BCA6468416B7D3A7785D28B49D5DCF005F30EDB8과 완전 일치함을 확인했다. 실제 수정분 C0/I0이며 기존12/각단언/negative/54조합은 보존됐다. 이 정확 test delta만 인수하며 실제 native 권한·전체UI11/S2/계획 인수로 확장하지 않는다.
Primary는 기존56+파생 시험1의57범위에서 계속 구현한다. 실제 DB·권한·키·서비스·Agent·컴파일·J3/P03 R3·Git 복구 제외는 그대로다.
## 17. Window·Offer·Close Node 저장 묶음 검수

2026-11-05 제출. 정확 node --test tests/unit/FN06/native-first-receive-routes.test.ts tests/unit/FN06/native-first-receive-store.test.ts tests/unit/FN06/native-first-receive-schema.test.ts 결과 key fn06_three_command_checkpoint_tests는36PASS/skip0/831.3303ms/exit0, node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json의 fn06_three_command_checkpoint_type은exit0다. 이후 새 전용 routes/app 등록의 app.inject3반례 RED→3PASS/1256.0981ms를 추가 제출했으나 이전36과 합산하지 않는다. 메모리 DB port와 실제 Node/HTTP handler 소비·SQL 형상 증거이며 SQL 본문/실PG/RLS/실제 서비스 기동 증거가 아니다.

정확 대상:
- apps/server/modules/executions/native-first-receive-service.ts: withNativeReceiveCommand, NativeFirstReceiveService.command
- apps/server/modules/executions/native-first-receive-input.ts: readNativeReceiveHumanCommand, receiveHumanCommandCanonical
- apps/server/modules/executions/native-first-receive-store.ts: prepareWindow/readCommandWindow/prepareOffer/insertOffer/prepareClose/insertClose/insertWindow, readOfferValue/readCloseValue
- apps/server/modules/executions/project-native-preparations.ts: ProjectNativePreparations.receiveOfferCurrent
위 본문은 Primary가 동결했다. 같은 파일의 다른 native/SQL 목적 writer는 계속 작성한다. 검토 전후 대상 본문 지문을 대조하고 전체 파일 변화 자체를 동결 위반으로 세지 않는다.
제출시점 raw: service09AD236E2FB1B9C0DCE5458D99FA30C6F609764806CA12E1E015756092DBE642, inputFAE7B50286E0EC53E34094BF05C556C283DC37445ED6D9B7E7C6EA8B548241BF, store19D16D15183BACA32A38C62EDF8B5F1559C04CF293B50DB893A242BE2A5C5C3A, 원adapterFF55DADC385C9D50B73AB7B8CE3F48F138705F3CEE3C657590C86023903B1ABA. 참고 시점값이고 전체 파일 영구 불변 주장은 아니다.
새 HUMAN 전용 routes는 apps/server/modules/executions/native-first-receive-routes.ts다. 앱 등록 경로는 채택 WI2절의 실제 목록/현재 import에서 확인하고 추정하지 않는다. 아직 작성 중 native OPEN/STREAM/ARM/ACK 경로나 나머지 목적 저장/전체 deferred의 부재는 이번 묶음의 확정 finding으로 세지 않는다.

담당 A remaining_execution_dependencies: 실제 currentGeneralProjectController/authorizeMaterial→보호 replay→begin→공통 persistProjectReceipt→목적 저장→end 소비의 현재 인증·정책·control·같은 actor/session·기한/await 경계·같은 원 Tx를 검토한다. 새 준비3의 REQUIRE_APPROVAL 거절과 원 기능 보존, caller 선언을 권위로 바꾸지 않는 private scope/brand lease, 늦은 실패/재조회에서 새 저장·효과가 생기지 않는지 확인한다. 호출된 SQL 목적 함수의 실제 원형과 Node 인자/actor 결박을 대조하되 실PG 권위 PASS를 주장하지 않는다. 최종 deferred가 ephemeral begin/end 상태에 잘못 의존하는 등 실제 호출선 반례가 있으면 반환한다.

담당 B remaining_stage_b_dependencies: exact HUMAN 입력/unknown·중복키/크기·원 native parser/commandHash·전용 Offer2293760·원 canonical/한도 불변, 대형 Offer의 공통 명령/결과/재조회 보존, close의 부모 전이·발급/종료 현재성 조건, replay의 정확 원문·기존 snapshot/hash·비밀 비노출을 검토한다. HUMAN 전용 route와 app 등록이 기존 인증/다른 API를 넓히지 않는지 확인한다. native 경로의 미래 구현 부재를 현재 통과로도 결함으로도 만들지 않는다.

공통: Primary 제출·기존 통과 기록을 현재 구현 증거로 자동 승격하지 않는다. 실제 반례·파일/함수·근거·최소 보완을 반환하며 작성 중 후행 의존은 인수 조건으로 구분한다. 읽기만 수행하고 파일/시험/SQL 수정·시험 재실행·Git 시도·실제 DB/권한/키/서비스/Agent/컴파일/원격 실행은0이다. 이전 math/profile/정책 시험을 반복하지 않는다. 경로는 위 실제 파일과 목록에서 확인한 것만 사용한다.
## 18. 최근 재인증 I1 보완 지시

2026-11-05 담당 A의 17절 검수는 C0/I1, 담당 B의 입력·재조회 검수는 C0/I0다. A는 HUMAN3 저장 경로의 최근 재인증 만료 검사가 빠졌다고 반환했다. Main은 고정 wire 13줄의 기존 최근 재인증 검사 유지와 231줄의 부모 재인증 기한 최솟값 조건을 실제 대조했다. 기존 36PASS와 HTTP 합성 통과를 이 결함의 면제나 전체 인수로 사용하지 않는다.

같은 Primary만 기존57 허용 경로에서 보완한다. withNativeReceiveCommand/command 및 직접 연결된 목적 SQL의 필요한 동결을 이 보완에 한해 해제한다. 기존 actor의 실제 재인증 기한과 원 등록의 최근 재인증 계약을 확인하여 HUMAN Window·Offer·Close의 권위 진입, await 후 다음 효과 전, 부모 최소 기한에 반영한다. 다른 인증·정책·OWNER/control·현재 등록·profile·writer·DENY·원 native 일회 승인 검사는 유지한다. AccessRepository나 일반 인증 구조를 바꾸거나 읽기 전용 API 전체에 새 조건을 임의 추가하지 않는다. SQL fn76_human_scope와 Window 후보의 connector_basis_current 호출 및 expires 계산도 해당 HUMAN 쓰기 조건을 보존하도록 대조한다. 작성 중 SQL은 실제 PG 검증으로 표현하지 않는다.

반례는 다른 조건이 모두 유효하지만 최근 재인증만 만료된 진입, await 중 만료되어 다음 저장 전에 거절되는 경우, 유효 기한의 정상 흐름, 보호 재조회가 권위 검사를 우회하지 않는 경우다. 원 실패 RED와 보완 GREEN의 정확 명령·출력·코드·지문을 제출한다. 동일 근본 원인의 첫 독립 검수 보완이며 정식 FAILURE_REPORT 횟수는0이다. 담당 A가 수정 본문을 독립 재검수하고 Main이 인수한다. 나머지 native 목적 저장·HTTP·소비 연결 구현은 계속하되 이번 결함을 감춘 채 완료로 선언하지 않는다.

Primary의 추가 profile GET 제출은 readProfile 부재/GET404 RED 뒤 HTTP·기한4PASS/1377.1498ms/exit0, key fn06_profile_get_http_green이다. REQUIRE_APPROVAL 조회0과 지연 만료 본문0은 합성 범위 증거이며 아직 Main 독립 인수 전이다. 원 command 동결 본문 보존 보고와 구분한다.

실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3·Git 복구 제외를 유지한다.
## 19. profile GET 오류 의미 I1 보완

2026-11-05 담당 B의 새 profile GET 한정 검수는 C0/I1이다. 기존 profile reader가 최종 profile 만료 때 생산하는 NATIVE_RECEIVE_PROFILE_UNAVAILABLE/412가 새 전용 route의 known 목록에 없어503 NATIVE_RECEIVE_SOURCE_UNAVAILABLE로 바뀐다. 본문 비노출은 유지되나 채택된 오류 의미가 다르므로 기존 기대를 낮추지 않고 보완한다.
같은 Primary가 전용 route의 정확 code/status 한 항목을 연결하고, auth session은 유효하나 profile만 최종 만료되는 실제 GET 합성 반례의412·본문0을 RED→GREEN으로 검증한다. 다른 오류를 일반 허용하거나 상세 오류·비밀을 응답에 추가하지 않는다. 기존57 범위, 실제 실행 제외와 단일 writer를 유지한다. 검수 시 readProfile 본문8EF776D55E23317E14D53D6A6527FA831F8A934C69E171ED7EF014F0DEBE694A, routes C80EB41BF521C68E0EB7E8BD33A75F04A2A655B07B14F14B0BCF9C3C495EDA3A는 전후 동일했다. 수정 후 담당 B 독립 재검수를 받는다.
## 20. I1 수정분 제출과 독립 재검수

19절 담당 B는 I1 ADDRESSED·수정 범위 C0/I0를 반환했다. 정확 known 매핑 NATIVE_RECEIVE_PROFILE_UNAVAILABLE:412, 최종 freshness 만료 GET의412 및 exact code/requestId:null만 반환하는 검사를 확인했다. reader/readProfile 불변, REQUIRE_APPROVAL 조회0과 다른 만료·SELECT만 수행 기대를 유지했다. 전후 대상 지문 동일: known F856CCC2, readProfile8EF776D5, reader0D570D22, 시험B3413008. 시험 재실행/쓰기/Git/실환경0의 읽기 검수다.

18절 Primary는 실제 만료 거절 누락RED(exit1) 뒤 Node GREEN, SQL 형상 누락RED(exit1) 뒤 조건 보완을 제출했다. 정확 명령은 node --test --test-name-pattern='HUMAN3 SQL만 실제 최근 재인증' tests/unit/FN06/native-first-receive-schema.test.ts 및 node --test --test-name-pattern='HUMAN 세 명령은 최근 재인증|유효한 짧은 재인증|실제 HUMAN command scope|Window service는|Offer·Close service는' tests/unit/FN06/native-first-receive-routes.test.ts 이다. fn06_reauth_sql_and_direct_green: SQL1PASS/443.6819ms·Node5PASS/524.8976ms/exit0, fn06_reauth_type_exact_exit:noEmit exit0, diff check0이다. HUMAN3에만 실제 최근 재인증·basis true·Window least(a.reauth_until)를 연결하고 read3 확장은0이라고 보고했다.

제출 raw: service FAC7BA2B472D425F5A9567BA3314A50A88D1FAD14EDF0CF98694A8B0E2995637; route210CBD057DDEF6E6C478011914B163B5BA67D33CCD91F5818A266E0D47B30548; SQLF748AF0F6297EED471C13C16A1D6C92A81042297112C2476F4E6A54C4A8BC2F9; routes시험B3413008A18DE6E81C53F7341D31D5C4D3C35004F9ABEC2638A071F97C4280FC; schema시험B1CA074E581A1B8C692C912E9E2DE266850E2C5333D4C08E4F7C03564D4AB91B. Main은 A에게 정확 보완 본문·반례 읽기 재검수를 배정했다. 실제 PG 검증은0이고 S2/S3 목적 writer·N 선예약·S4~S7은 아직 미완료다. Main의 최소 직접 검증을 위한 짧은 대상 파일 동결을 요청했고 다른 허용 파일 구현은 계속한다.
## 21. 최근 재인증·profile 오류 보완 한정 인수와 동결 해제

담당 A가18절 I1 ADDRESSED·수정 범위 C0/I0를 반환했다. 실제 reauthUntil Date의 기한·객체 동일성·getTime 보존을 command entry/controller·policy await/replay/효과 전과 owned query IO 전후에서 유지하고, 부모 deadline 최솟값과 짧은 유효 기한 정상 흐름을 확인했다. SQL HUMAN3만 최근 재인증을 요구하며 Window basis recent=true와 expires reauth_until이 연결되고 profile/read3 일반 읽기 조건은 확대하지 않았다. 전후 대상 본문 지문은 with scope E1B04211DF4061E7236000B368F4471F5C9DE7BF8907C87D8D0DCFB09DD54EA3, command5CFFE408F71C5FA810BCE0DD56F9F10AF082DEEAE2F43B61AD2561E3328554CF, SQL HUMAN scope0C8D0EA13375729A52D47677A94B47A4B7CDA9E425FBC780472C341B3F75B58A, SQL Window candidateBE363D10690670574B2002DFBE0D1A4247138D37ED98580C33AF0A7A141A2BE8로 동일했다.

Main은 A/B 독립 수정분 C0/I0와83e279의 직접6PASS/871.8023ms·SQL형상1PASS/450.0471ms/모두skip0/exit0 및6파일 전후동일을 대조해18·19절 두 보완만 인수한다. 관련 본문 동결을 모두 해제하고 기존 단일 Primary가 S2/S3 목적 proof writer·N 효과 전 선예약·native 수신 후행 연결의 다음 미완료 단위를 계속한다. 이미 인수한 codec/profile/math/policy 최소 검사를 반복하지 않는다.

이는 source-only 구현·합성 검증 인수이며 실PG/Tx/RLS/native desktop/브라우저/Agent·전체계획 인수가 아니다. 실제 DB·권한·키·서비스·Agent·C# 컴파일·J3/P03 R3·Git 복구 제외를 유지한다. 정식 FAILURE_REPORT0이다.