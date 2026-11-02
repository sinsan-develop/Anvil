# FN06 native 준비 원시도 owner bridge source 작업지시서

2026-11-02 / Main 어울 / 기존 Primary 단일 code writer

## 1. 목적·승인 경계

기존 승인 r2 A(5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085) §79/96/177와 INTERFACES §14.3의 내부 연결이다. 원 ticket 소비→같은 원시도 helper/channel 소유→C# private Job owner의 생성/조회/닫기·불명 보존을 하나의 source 업무로 구현한다. 새 공적 API/표/권한/키/신뢰 root·등록 승격은 만들지 않는다. 코드·합성검증만이며 실제 DB/권한/키/서비스/Agent/실자료/P03R3·C#컴파일/helper/native/OS 실행은 제외한다.

현재 원 full context·단발 ticket·journal·소비 receipt는 구현돼 있다. C# primitive는 unnamed Job private owner/ReadEmpty/Dispose/LocalHandleCloseConfirmed를 제공한다. 두 계층 사이의 실제 소유 lifecycle을 연결하며 임의 true/반환값 포장만으로 완료하지 않는다. product 공급자/부트스트랩/admission이 없으면 기본 미등록·거절을 유지한다. FN18 package bytes 관측을 실행 중 부모/peer 인가로 승격하지 않는다.

## 2. 정확8 허용 경로 — r2 내부 원기한 전달 보완

신규6과 원기한 전달용 기존2만 허용한다. 기존 Primary는 아래8만 수정하고 Main은 문서·관리·검수·통합한다.

1. apps/connector/runtime/native-preparation-owner-bridge.ts
2. apps/connector/runtime/native-preparation-owner-launcher.ts
3. apps/connector/native/NativePreparationOwnerBridgeSource.cs
4. tests/unit/FN06/native-preparation-owner-bridge.test.ts
5. tests/unit/FN06/native-preparation-owner-launcher.test.ts
6. tests/native/FN06/NativePreparationOwnerBridgeSourceTests.cs
7. apps/connector/runtime/native-preparation-client.ts — 원 run budget의 내부 전달만
8. apps/connector/runtime/native-preparation-factory-consumer.ts — 실제 원 ticket/문맥·factory/lifetime에 private budget 결박만

기존 client/factory-consumer는 원10초·authority/current/challenge/permit의 계속 축소되는 budget을 전달하는 내부 접점만 수정한다. 기존 flat/context 반환·wire/outcome·기한/guard·발급/소비 의미는 보존한다. C# Job source/old Host/Run/build/compile-only 계획·기존 SQL/SDK/fixture/보호untracked3는 수정하지 않는다. root package/자동실행 hook/새 dependency/새서비스/원격연결을 추가하지 않는다. 기존 소스 재사용으로 닫을 수 없는 경로가 나오면 정확 차이를 Main에 반환하고 임의 범위를 늘리지 않는다.

## 3. 원 ticket·owner 소비

- bridge는 기존 NativeFactoryPort의 exact source-only 경계를 유지하고 실제 invoke에서 같은 factory 객체로 consumeNativeFactoryCallContext를 await한다. 실제 private ticket 이외의 JSON·가짜 capability·다른 factory·재소비·미완료 await는 생성 전 거절한다.
- 원 authority/receipt/consumeRecordRef/permit·preparation/writer/localAttempt/factory fullref·request/scope hash를 고정한다. 임의 다른 원문/기한·이미 전달한 객체 변조를 사용하지 않는다.
- 원시도 OPEN latch는 첫 native 전송 전에 고정하며 원 helper/channel·holder를 private 소유한다. 재조회/오류/신호/Promise timeout 뒤 OPEN 재전송·새 helper 자동 재생성0이다.
- QUERY_EMPTY와 CLOSE_OWNER는 같은 원시도 private 소유 객체에만 허용한다. 공개 history/holder UUID는 capability가 아니다. factory 외부 결과는 기존 exact {state}만 유지한다. source 관측을 writer ACTIVE/Agent 실행권위로 바꾸지 않는다.

## 4. launcher와 C# 소비의 실제 source

launcher는 인터페이스만 추가하지 않고, 고정된 supplier 입력을 검산한 뒤 shell:false·windowsHide:true·전용 stdio로 직접 생성한 원 ChildProcess/stream 객체를 보유하는 구체 코드를 갖춘다. import/constructor는 IO0이고 테스트는 명시 fake spawn/FS/streams/clock만 사용한다. 일반 호출자의 경로/환경/STATUS_ONLY등록에서 승인 image를 추론하지 않는다. supplier의 함수/객체·원 image 기준·channel 교체를 거절한다. OS가 parent/peer를 인증했다거나 caller hash만으로 admission을 증명했다고 하지 않는다. 부트스트랩의 실제 보호 공급자가 없으면 실행 가능한 기본 factory로 등록하지 않는다.

C#는 기존 Job primitive를 실제 호출하는 내부 dispatcher/owner 상태를 구현한다. 원 owner 하나를 private 보유하고 ReadEmpty·Dispose·close확인을 정확히 소비한다. 아직 기존 Main/Run/build에는 연결하지 않는다. 임의 stdin JSON을 제품 native 실행권위로 채택하지 않는다. 내부 dispatcher의 신뢰된 생성 경계와 외부 wire parsing을 분리하고, 생명주기 source가 존재한다는 이유로 standalone helper가 완성됐다고 하지 않는다. 실제 executable entry/build/package·OS admission 공급자는 잔여로 명시한다.

내부 frame은 OPEN_EMPTY/QUERY_EMPTY/CLOSE_OWNER만 허용하고 schemaVersion/purpose/bridgeRunId/sequence/requestId/bindingHash/callExpiresAt/remainingMs/payload를 exact 검산한다. 원 tuple과 같은 holder/sequence를 결박하며 최대64KiB/엄격UTF8/완전frame·추가출력/종료/단절을 유한하게 검사한다. 필요한 세부 필드는 기존 full context와 canonical hash를 소비하는 최소 내부 형식으로 정하고 결과서에 명시한다. 새 공개 저장 계약이 아니다.

## 5. 시간·불명·정리

원 전체10초와 authority/permit/channel 최소 wall기한·단조 잔여를 함께 적용한다. 단계마다 재시작/뒤로간시계/지연된 remainingMs로 연장하지 않는다. C# 동기 kernel 호출은 결과 수용기한을 검사할 뿐 강제취소를 보장하지 않는다. 기존 owner120초 상한을 원 r2 연장에 사용하지 않는다.

NEW→OPENING→OWNED→CLOSING→CLOSED_CONFIRMED를 기본으로 하되 전송 후 timeout/오류/단절/미정착/늦은결과는 UNKNOWN을 보존한다. UNKNOWN을 정상응답/exit로 자동해제하지 않는다. 같은 살아있는 owner의 명시 QUERY/CLOSE와 소유 정리만 분리한다. 정리 budget을 새로 반복 발급하지 않으며 일반 kill/새process연결/재시작holder복구/외부handle회수를 추가하지 않는다. LocalHandleCloseConfirmed는 해당 owner의 로컬handle 닫기만 의미하며 writer회수·외부복제handle 부재 증거가 아니다.

## 6. RED→GREEN·검수·제출

실제 NativePreparationClient→발급 ticket→새 bridge→새 launcher 코드를 통과하는 메모리 프로세스/stream 시험을 만든다. C# 쪽은 명시 fake owner/clock의 시험 source를 작성하고 실제 C# 실행증거와 구분한다. TS 메모리 상대 모델을 C# 실행성공이라고 하지 않는다.

정상 OPEN1→QUERY→CLOSE, 잘못된 ticket/factory·동시/재OPEN·잘못된순서/holder/binding·frame상한/UTF8·기한/시계후퇴·OPEN응답유실/child단절/늦은frame·close불명/미정착·관련자원중복정리0을 핵심 반례로 검증한다. 원 journal/receipt와 source-only 관측 false를 유지한다. 새 테스트의 기대값만 맞추는 getter/가짜 current 지원0이다.

파일시스템 QA/실spawn/realcrypto/native실행0·메모리 포트만으로 우선 수행한다. 실제 자원이 필요하면 생성 전 Main에 이름/owner/수명/정리를 요청한다. 기존 시험/기준 삭제·완화0이다. 동일 근본원인3회면 추가수정 중단→정식실패/지문/writer반환→Main판정이다.

Primary는 정확8SHA/diff·RED/GREEN 실제명령/exit·type/인접검증·오류/한계·자원0·writer반환을 제출한다. Main fresh/독립C0/I0 전 코드완료·private게시하지 않는다. 전체FN06/FN08/계획완료와 실제원시도OS admission/도구실행은 미완료로 남긴다. source복구는 정상revert이며 실제환경rollback0이다.
### r2 보완 — 원기한 전달의 실제 선행

기존 private context에는 원 deadline/remaining/guard가 없다. 신규6만으로 그 값이 있다고 가정하지 않는다. client의 run 최초10초/authority와 current/challenge/permit의 계속 축소되는 단조 deadline·최소 wall기한을 기존 consumer의 추가 내부 인자로 전달한다. consumer는 실제 발급 ticket과 같은 factory/lifetime에만 private registry로 결박하고 await 전후 stable을 확인한다. context 소비 뒤 새 bridge가 원 budget을 읽되 raw JSON/다른 factory/다른 ticket/위조 문맥/consumer finally 이후 읽기는 거절한다. 새 bridge의 OPEN/정상 QUERY에는 이 원 budget이 필수이고 누락을 새10초/성공으로 대체하지 않는다. 기존 budget 없는 flat/context 소비의 호환은 유지한다. 새 공개 wire/API·표·권한·키가 아니라 원 상한을 지키기 위한 내부2경로 최소 보완이다. 독립 검토 후 해당2 writer를 확장하며 그 전 수정0이다.