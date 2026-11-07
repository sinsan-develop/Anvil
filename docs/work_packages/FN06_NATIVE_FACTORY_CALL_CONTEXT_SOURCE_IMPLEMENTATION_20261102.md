# FN06 native factory 일회 ticket의 원본 문맥 결박 — source 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 안의 내부 소비 상세화 / **SOURCE_ONLY · 실제 효과 제외**

## 1. 필요한 다음 연결과 범위 판단

원 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085 §10.3/177의 소유 일회 ticket·동일 authority/lease/등록/factory/localAttempt/소비/permit 연결을 유지한다. Main50ca45에서 현재 client의 private #caps는 permit snapshot p만 담고 factory ticket.consume()도 그 flat snapshot만 반환함을 확인했다. 실제 C# factory 연결에는 authority에서 도출할 lease·등록·세대 및 원 fullref/snapshot이 필요하지만 임의 입력으로 다시 조립하면 안 된다.

이번 구현은 **검증된 원본 문맥을 같은 프로세스의 일회 ticket에 결박하는 내부 helper**다. 새 HTTP/DB/credential/키·정책/사용자 명령/권한·C# bridge wire를 만들지 않는다. 기존 flat consume()와 outcome·wire는 보존한다. 원 승인/원 WI bytes는 수정하지 않는다. 실제 peer/package/채널 소유·native holder 인계는 별도 미정·미구현이며 이것으로 해결됐다고 주장하지 않는다.

## 2. 정확 경로·담당

기존 Primary 단일 writer가 아래3경로만 수정/생성한다. Main 제품쓰기0·기존 Reviewer read-only. 타인 편집·보호 untracked3·기존 SQL·다른 제품/시험을 복구·수정하지 않는다. 새 agent/chat/branch/worktree/예약0.

1. apps/connector/runtime/native-preparation-client.ts — 현재 이미 검증한 원 authority·receipt·consumeRecordRef·permit의 복사본을 기존 consumer에 내부 문맥으로 전달한다. ATTEMPTED 저장/원 current/기한·replay/UNKNOWN 순서를 바꾸지 않는다.
2. apps/connector/runtime/native-preparation-factory-consumer.ts — private context 결박·검산과 모듈 private 발급 ticket registry, source factory가 한 번만 문맥을 소비하는 helper를 제공한다. 기존 consume()는 flat permit snapshot·한 번 소비 의미를 유지한다.
3. tests/unit/FN06/native-factory-call-context.test.ts — 실제 NativePreparationClient→consumer 발급 ticket→새 helper→명시 fake factory 소비와 변조·위조/복사·await·수명 음성을 검증한다. 실제 C#/compiler/helper/OS/파일·DB·키·서비스·Agent는 실행하지 않는다.

## 3. 내부 문맥과 소비 불변식

- 내부 문맥은 정확 authority {ref,snapshot}, consume receipt {ref,snapshot}, consumeRecordRef, factory permit {ref,snapshot}의 원본 결박이다. lease/epoch/등록/factory/preparation/head/localAttempt/requestHash/scope/기한은 이들 원형에서 도출하며 중복 선언값으로 덮지 않는다. 추가 id·새 자격/권위·새 purpose를 생산하지 않는다.
- 기존 r2 parser/정규hash/fullref·exact shape·false flags를 사용해 상호 ref/tuple/기한을 재검산한다. consumer의 expectedFactoryRef와 authority.scope.nativeFactoryRef·flat permit material을 일치시킨다. 문맥은 원 client가 이미 검증한 응답에서만 만들어지며 불일치/누락은 새 helper에서 거절한다.
- registry는 같은 모듈 안에서 consumer가 실제 발급한 ticket의 객체 정체성에만 결박한다. 발급자를 외부에 열지 않는다. source factory용 helper는 등록 ticket만 소비하고 임의 {consume:fn}/JSON/복제·다른 factory·동일값 다른 객체는 원 consume/getter를 실행하지 않고 거절한다.
- helper는 원 ticket.consume()의 current/기한·receiver·단발 검사를 우회하지 않는다. 원 consume를 성공적으로 await한 뒤에만 일치하는 동결 문맥을 반환한다. 중복/동시 소비·원 flat consume 뒤 helper·helper 뒤 flat consume를 새 권위로 만들지 않는다. await 뒤 active/기한/port/ref guard와 consumer 종료·unawaited pending의 폐기를 유지한다.
- registry entry는 한 번 진입 시 재사용 차단하고 consumer finally·오류/취소에 회수한다. 불명 소비는 재발급하지 않는다. weak registry/명시 revoke로 누적 강한 전역 기록·파일·DB 저장을 만들지 않는다.
- 기존 context 없는 합성 소비자와 flat consume() 경로의 의미는 유지할 수 있으나, 새 문맥 helper는 완전한 원 문맥 없이는 UNAVAILABLE다. 실제 NativePreparationClient는 원 문맥을 항상 제공한다. 기존 tests/기대값을 낮추거나 바꾸지 않는다.
- 동결 문맥은 **권위를 식별하는 데이터**이며 raw JSON 자체가 native OPEN 권위가 아니다. registry는 source 프로세스 안의 ticket provenance만 검산한다. Anvil 부모/package·OS peer·protected bootstrap을 증명하지 않으며 실제 native bridge에 자동 연결하지 않는다. bearer·private key·credential digest·원 서명입력을 문맥/일반 결과/로그에 추가하지 않는다.

## 4. 구현·검증

1. 현재 Git/원 r2·이 WI·정확3경로를 확인하고 기존 #caps→consumer 호출에서 끊긴 문맥 소비의 반례를 먼저 확인한다. 올바른 기존 동작을 깨뜨리거나 loader 준비 오류를 기능 RED로 세지 않는다.
2. 최소 구현 후 실제 client와 새 helper의 원본 authority/lease/등록/fullrefs 소비·fake factory1, fake/복제/변조 ticket0·다른 문맥/기한/동시·중복/guard/미정착 소비 뒤 native 후속0을 집중 확인한다. 같은 snapshot을 다시 hash해도 다른 원 tuple은 거절한다.
3. node --test 신규파일과 직접 변경 영향의 native-preparation-client.test.ts를 검증한다. 기존 server/UI/App/journal/HTTPS 전수는 불변이면 반복하지 않는다. 필요하면 HTTPS 실제 client 정상1만 직접 영향으로 선정한다. tsc --noEmit -p tsconfig.base.json·diff check를 실행한다.
4. Primary는 정확3SHA/diff·명령exit·반례·오류·미실행·registry/handle 수명·writer 반환을 제출한다. Main fresh 검증·독립 C0/I0 뒤 정확 checkpoint/private 게시한다. 실제 native bridge/holder/실행 완료와 전체 계획 완료로 승격하지 않는다.

## 5. 제외·잔여·복구

실네트워크/TLS·CA/키·파일 조사/작업·DB/권한·서비스/native/C#·compiler/helper·OS·Agent·실자료/백업·P03R3 실행0. 실제 native peer/package/channel 소유 producer와 C# holder OPEN/QUERY/CLOSE·관측/불명 회수 계약은 여전히 미정이다. 일반 Node PID·경로/hash·verified:true 또는 raw JSON을 실제 Anvil 부모/권위라고 주장하지 않는다. 전체 FN06/FN08/Stage/계획 완료·PR/main병합·배포·인수0. source는 별도 commit의 정상 revert 후보로 보존한다.