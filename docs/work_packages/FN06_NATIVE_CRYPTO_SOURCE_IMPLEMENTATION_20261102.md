# FN06 r2 준비 credential·ID·nonce 내부 crypto 생산 — source 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 내부 생산 포트 구현 / SOURCE_ONLY_MODEL

## 근거·경계

원 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085·직접승인9B10475C…6E17567을 유지한다. ProjectNativePreparations는 credential 포트의ID/세대/digest·별도 acceptSecret을 받고 원check·digest대조·동일Tx저장·commit후전달·finally소거를 이미 수행한다. 실제 공급자/기본 등록은 없다. 기존 registration-protocol/source-read-protocol의 Node randomBytes32/randomUUID/digest 생성 방식을 native 전용 내부 생산에 재사용한다. 기존 등록용prefix/표·목적/수명·원문반환을 가져오지 않는다.

이번은 암호 난수·ID·nonce 생성의 concrete source이며 인증/정책·현재권위/보호 delivery/ACK를 생산하는 코드가 아니다. 기본 app 등록·실제 generation/키·DB·서비스 호출0이다. 원 HTTP/credential 형식·저장2표/승인/권한을 변경하지 않는다.

## 정확2경로·소유

기존 Primary 단일writer(현재 signer5 소유 반환·검수 checkpoint 후에만 이 단위 GO), Main제품쓰기0·Reviewer읽기전용.

1. 신규 apps/server/modules/executions/native-preparation-crypto-source.ts — 기존 NativePreparationSource.allocate/credential 및 NativePreparationHostSource.nonce에 조립 가능한 내부 crypto source. app/coordinator/SQL 수정0·import/constructor I/O0.
2. 신규 tests/unit/FN06/native-preparation-crypto-source.test.ts — 명시 deterministic 난수/UUID/clock 대역·기존 실제 coordinator의 합성 PoolClient/소비 선을 포함하는 집중 시험.

기존 보호untracked3·다른writer자료·원r2/승인/WI·기존시험 불변, 추가경로는 구현 전 Main에게 반환한다. commit/push/Main 문서 변경0.

## 닫힌 동작

- 기존 타입의 함수만 제공하며 options/current·기본 성공을 만들어 전체 NativePreparationSource로 위장하지 않는다. 필요한 나머지 보호 공급자가 부재이면 기존 app 미등록/거절을 유지한다. 노출 transport는 SOURCE_ONLY_MODEL이며 실제 사용 가능/VERIFIED를 반환하지 않는다.
- 기본 생산 함수는 Node crypto randomBytes(32)/randomUUID이며 import/객체 생성만으로 호출0이다. 검증은 모든 난수/UUID/clock 포트를 명시 대역으로 제공한다. 실제 Secret 생성/키 파일·DB·네트워크·서비스0. 원 포트 getter/함수 변경·잘못 반환을 닫힌 오류로 처리하며 raw 예외/난수/credential을 로그/오류에 넣지 않는다.
- allocate는 기존 prepare5/challenge1/consume4/delivery시도2·결과1의 소비를 모두 보존한다. 허용 count는 정확 {1,2,4,5}이며 각 길이의 원UUID를 반환하고 형식/배치 내 중복을 대조한다. 잘못 count·UUID/중복은 실패, 자동 재시도0이다. nonce는 독립32byte 난수의 canonical base64url43이다. 기존 등록 av3ct1_/source-read av3sr1_ 접두사를 붙이지 않는다.
- credential 입력은 기존 registrationRef/channelProfileRef/expiresAt 및 별도 acceptSecret callback 그대로다. own data 필드·exact refs·정규ISO·현재양수/원120초이내 기한을 검산한다. 유효 callback이 없으면 난수 생성 전에 거절하며 실제 channel readiness/현재 세션 인증이 됐다고 주장하지 않는다. coordinator의 보호 check가 이 함수를 감싸고 실제권위/정책·current 최단기한을 결정한다.
- native credential은 새 randomUUID 한 개와 별도32byte 난수→접두사없는 opaque43이다. ID별 최초 generation=1이며 이미 존재한ID를 갱신/세대reset하는 기능은 없다. 원 authority를 새로 발급·갱신/재전달하지 않는다. 저장 충돌을 감추는 자동 재시도0이다. credentialDigest는 opaque43의 ASCII바이트 SHA256 lowerhex이며 random32 자체의digest가 아니다.
- 원값을 private 임시 byte에 담고 동기 acceptSecret에 별도 수명 한정 view/복사본을 딱1회 전달한 뒤 own 임시 난수/opaque bytes를 finally에서 소거한다. callback이 자기 복사본을 만드는 것은 기존 coordinator 책임이며 수명 뒤 source-owned alias를 계속 사용할 수 없다. 소거를 관리문자열/외부복사본 완전 제거로 주장하지 않는다. 반환은 정확 credentialId/credentialGeneration/credentialDigest뿐이며 rawsecret/plaintext getter·DB저장/파일0이다.
- 입력 검산 후/비밀 전달 직전·반환 직전에 clock·포트 동일성과 원 expiresAt를 확인한다. callback 실패/기한소진·포트 교체는 생성물 폐기와 고정오류이며 두 번째 callback/난수 재생성·자동복구0이다. clock역행/잘못clock은 실패. 원코디네이터의10초 budget과 만료를 새120초/10초로 늘리지 않으며 이 primitive는 새 timer/async 작업을 만들지 않는다.

## 검증·제출

실제 ProjectNativePreparations의 기존 source 조립에 새 crypto 함수를 전달한 합성 PoolClient 시험에서 원 receipt/intent·authority·credentialDigest/비밀copy·commit후 전달로 연결되는 행동 RED→GREEN을 확보한다. 기존 coordinator 검사를 생략한 별도 모형만으로 통합완료라고 하지 않는다. 기존 source-only 동기 callback interface와 맞지 않는 Promise/alias·기한보호가 필요하면 새계약을 임의추가하지 말고 정확 충돌을 반환한다.

기존 다섯 소비 지점의 count1/2/4/5와 nonce/credential 생성의 정확 길이·domain/digest·입력/포트 무효·부재callback은난수0·callback throw/late/clock회귀/소거·오류비노출/단발성을 집중확인한다. 같은 원 명령 replay는 기존 coordinator가 crypto/delivery를 재호출하지 않음을 검증하되 기존 replay구현을 변경하지 않는다. 기존 전체server/host/UI/client/HTTPS 전수 반복0·선정 직접영향만, typecheck/diff check를 수행한다. 실제난수엔트로피·실DB/TLS/보호recipient/서버발급은NOT_RUN이다.

Primary는 정확2SHA·diff·실제명령/exit·RED/준비오류·합성 대역 명시·소거/콜수·미검증·writer반환을 보고한다. Main fresh/독립 C0/I0 후 통합하며 전체FN06/작업계획완료로 승격0이다.

## 제외·복구

실제 비밀/키/CA·DB/DDL/권한·서비스·네트워크·C#/helper/compiler/OS·Agent·실자료/백업조사·P03R3 실행0. 새 QA 파일/자원0·메모리만. 실제 보호current/profile·delivery/ACK/recipient·keymapping·nativefactory는 별도 미구현으로 유지한다. source rollback은 별도commit 정상revert 후보, 실제환경영향0이다.

## 사전 검토 보완

초안 C39BB6F5의 C0/I1은 allocate를 prepare5만의 유일소비로 오인한 부분이다. 실제 원 coordinator의 prepare5/challenge1/consume4/delivery2·1을 보존하도록 허용 집합과 소비 검증을 정정했다. public/저장/권한/실제효과 변경0·제품 GO전이다.
