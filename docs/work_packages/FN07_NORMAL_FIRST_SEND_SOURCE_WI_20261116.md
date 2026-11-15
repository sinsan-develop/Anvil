# FN07 첫 SEND 소유·두 증거 종단 — 소스 구현 지시서

수정 r2: 독립 지시서 대조에서 누락된 기존 채택 조건 두 가지를 명시한다. 계획 SDK SID는 생성 호출 전에 원 시도에 고정하고, 첫 사용자 메시지는 iterable 전체에서 총 한 번만 제공한다. 새 계약이나 권한을 추가하는 수정은 아니다.

## 기준·단위

직접 채택된 FN07 계약86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E §2~6, WORK_PLAN FN07/FN08을 따른다. 같은 branch `codex/av3-fn07-normal-query-output`의 START 준비 체크포인트 c43610ca와 출력 소비자 체크포인트 4fdfebe000b4e6abbd0fd87528d69a45a3cbb243을 연결한다. 기존 Primary가 단일 writer, Main이 관리·검수·통합을 맡는다. 다른 사람의 변경을 되돌리지 않는다.

이 단위는 첫 SEND의 소유·입력 경계 제공·세션 init 정착과 로컬 종단/ACK를 연결한다. 실제 SDK module/query/hook·child와 보호 profile/배정 공급자를 만든 것으로 표시하지 않는다. 가상의 기본 SDK driver나 SYNTHETIC_ONLY를 normal로 바꾸어 기능을 완료시키지 않는다. 후속 SEND와 STOP의 남은 소비 연결도 작업현황에서 숨기지 않는다.

## 소유 경로

제품 7개:

1. `apps/connector/adapters/secondary/normal-start-wire.ts`
2. `apps/connector/runtime/normal-start-coordinator.ts`
3. `apps/connector/adapters/secondary/normal-instruction-wire.ts`
4. `apps/connector/runtime/normal-instruction-coordinator.ts`
5. `apps/connector/runtime/normal-start-polling.ts`
6. 신규 `apps/connector/runtime/normal-first-send-owner.ts`
7. `apps/desktop/scripts/native-proof-runtime-build.cjs`

시험 5개:

1. 신규 `tests/unit/FN07/normal-first-send-owner.test.ts`
2. `tests/unit/FN08/normal-claude-start-wire-journey.test.ts`
3. `tests/unit/FN08/normal-instruction-wire-journey.test.ts`
4. `tests/unit/FN08/normal-instruction-polling-journey.test.ts`
5. `tests/desktop/native-proof-runtime-build.test.cjs`

결과서: `docs/04_test_reports/AV3/FN07_NORMAL_FIRST_SEND_SOURCE_RESULT_20261116.md`.

출력 소비자·codec·SEND store·spool·STOP·서버·SQL은 읽고 재사용한다. 수정이 꼭 필요하면 이유와 영향을 Main에게 알려 범위를 조정한다. WORK_STATUS·WORK_CHECK·WORK_PLAN은 Main만 갱신한다. 정적 CJS source는 43→46(신규 owner·출력 소비자·기존 codec 추가) 예상이며 실제 그래프를 대조한다. 17 exports·builtin4·2MiB·import 효과0을 유지하고 새 SDK/fs/네트워크 모듈을 넣지 않는다.

## 구현 불변식

1. **READY와 live owner.** START 거래가 정상 닫히고 후행 기한 검사를 통과한 신규 인수에서만 coordinator의 private 슬롯을 활성화한다. 원 wire·START key/envelopeHash·receivedRef·attempt/permit·grant·준비행 fullref를 고정한다. 외부의 wire+ref/JSON/callback으로 슬롯을 등록하지 않는다. 역사 준비행·취소·불명 닫힘은 live 슬롯을 만들지 않는다. 과거 START permit을 이후 SEND의 현재 실행 허가로 사용하지 않는다.
2. **첫 선택과 source 공급자.** 실제 SDK·등록/배정 공급자가 없는 기본 구성은 Query 생성 전 미지원으로 닫는다. 명시 주입 source 포트와 RAM 시험이 실제 SDK·권한의 증거는 아니다. source 포트를 실제 SDK 공개 서명이라고 가정하지 않는다. 원 READY·같은 worker·project/execution/generation·등록/grant 및 보호 SEND의 sessionBindingRef를 대조한다. START에 없는 sessionBindingRef를 만들어 넣지 않고 SEND 생산자가 검산한 원 값을 사용한다. SEND 고유 authorization/budget·원문·parts·현재성·permit·기한을 유지한다.
3. **단발 생성.** 원 3행 SEND_DISPATCH_ATTEMPTED가 append·sync·재판독된 뒤에만 원 일회 dispatch ticket을 소비한다. 같은 worker의 첫 시도를 외부 함수 호출 전에 선점하며 경쟁 SEND·callback 재진입이 두 번째 Query를 만들지 못한다. 생성 포트 호출 전에 계획 SDK SID digest를 원 생성 시도에 고정하고 관측한 init의 SID를 계획값으로 소급 채택하지 않는다. Query와 iterator는 각각 원 생성에서 한 번만 취득한다. 출력 소비자는 그 원 쌍을 재취득하지 않는다. 원 입력 iterable 전체에서 첫 사용자 메시지 제공은 총 한 번만 허용한다. 재취득·중복/경합 next가 두 번째 메시지를 내주지 못한다. 실제 첫 메시지를 내줄 때만 원 bytes·입력 digest·시도에 결박한 증거를 만든다. prepareUser나 Query 반환만으로 입력 제공을 인정하지 않는다.
4. **init과 결합.** owner가 직접 만든 같은 번들의 NormalSdkSessionOutput만 사용하고 원 인스턴스·원 메서드·원 일회 init 증거를 검산해 consumeInit한다. 복제한 확인행 fullref나 호출자가 넘긴 consumeInit 함수로 대체하지 않는다. init 선도착·yield 선도착 모두 원 기한 내 같은 생성 시도의 두 증거가 모여야 한다. 입력 제공은 SDK 호출 경계의 사실이며 원격 수락·지시 답변·업무 완료를 뜻하지 않는다. 일반 출력은 SESSION_ONLY, processRef는 null이다.
5. **새 네 번째 로컬 종단.** wire의 신규 private 결과는 JSON 복제 이전에 coordinator에서 한 번 소비한다. 3행 바로 뒤의 FIRST_SEND_INPUT_AND_INIT_RECORDED에서만 원 startReadyRef, local/dispatch 시도, 입력 digest 요약과 initConfirmationRef를 허용한다. 원 부모·세대·허가·proof·sessionBindingRef를 재검산하고 responseRef/processRef는 null이다. generic RESPONSE_RECORDED로 변환하거나 init ref를 명령 답변 ref로 넣지 않는다. append·sync·재판독·strict close·기한/취소의 후행 검사까지 마쳐야 성공한다. 출력만 정착하고 SEND 닫힘이 불명이면 출력은 보존하고 SEND는 UNKNOWN이다.
6. **관측과 cursor.** 3행 dispatch와 신규 4행을 공개 사건으로 보내지 않는다. 기존 SEND 필수 관측을 원 시각·ref로 재생하고 마지막 PERMIT_RECORDED의 spool ref를 반환한다. polling은 신규 로컬 종단 정상 정착과 그 ref까지의 연속 ACK를 모두 확인한 뒤 cursor를 진행한다. 한 증거·한 batch·ACK 응답 유실로 cursor를 올리지 않는다. 기존 RESPONSE/SEND·STOP 역사 의미는 보존한다.
7. **재시작·후속 수명.** 역사 새 종단은 원 행·관측·ACK만 복원한다. 새 worker·Query·입력 증거·재전송은 없다. 늦은 원 handle은 원 owner의 정리 대상으로만 유지한다. 불명·소유 상실·기한 뒤 자동 Query 생성·resume·성공 보상은 없다. 후속 입력은 같은 살아 있는 Query에만 제공할 수 있으며, 이 단위에서 안전한 소비 연결이 없는 후속 SEND/STOP을 가짜 응답으로 완료시키거나 실제 종료·writer 해제라고 표시하지 않는다. 남은 연결은 정확한 후속 업무로 기록한다.

## 검증·제외

필요한 반례를 먼저 RED로 확인한 뒤 RAM에서 양성·음성을 검증한다. READY 정상 닫힘/역사 구분, 동시·재진입 SEND의 Query/iterator 각각1회, 두 증거의 양방향 순서, 한 증거 누락·다른 owner/시도/SID·위조 결과, 출력 정착 뒤 SEND close 불명, 부분 ACK·응답 유실, 재시작 추가 생성/전송0, 기존 generic RESPONSE·SEND/STOP을 포함한다. 생성 포트 호출 시 계획 SID가 이미 원 시도에 고정됐는지, 다른 SID의 init에서 확인 증표·4행·cursor가 모두0인지 검사한다. 원 iterable을 재취득하거나 next를 중복·경합 호출해도 첫 지시 제공은 총1회여야 한다. 실제 원 지시 bytes와 유계 사용자 메시지의 보존도 확인한다. root 타입·정확46 source의 메모리 빌드·diff를 검사하고 같은 코드의 무관한 전체 검사는 반복하지 않는다.

실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C# 실행·추가 SDK 조회·P03 실행은 제외한다. 9E98의 실제 profile·제5채널·공유 예약 생산·desktop 활성화를 이 지시서로 허가하지 않는다. 결과서는 명령·종료 코드·건수·지문·미검증·남은 구현·rollback을 구분한다. 실제 도구가 일하는 기능 전체나 WORK_PLAN 완료를 선언하지 않는다.
