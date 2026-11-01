# FN06 native 준비 credential private 휘발 slot — source 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 안의 내부 비밀 수명 연결 / **SOURCE_ONLY · 실제 효과 제외**

## 1. 근거·기능 단위·범위 판단

원 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085 §63/141은 서버 digest·DELIVERY_ATTEMPTED 내구 commit·전달최대1/불명 재전달 금지를 정하고, §143/147의 내구 원장은 PREPARED/FACTORY_ATTEMPTED다. 수신 준비 credential의 영속 설치·장애 후 복구 의무는 대조한 원문에 없다. Primary 읽기와 기존 secret-store/ProtectedStore의 등록 전용·평문 반환 없음도 대조했다.

이번 단위는 이미 정의한 delivery6metadata와 별도 opaque bytes를 원 authority에 결박해 private 메모리에서만 보관하고 기존 NativePreparationHttpsChannel 내부에 공급하는 **휘발 slot**이다. 새 저장 파일/DB/키·plaintextRead API·C# 명령/기존StatusOnly 형식·서명 의미를 바꾸지 않는다. credential purpose/HTTP wire도 기존 r2다. Main은 내부 메모리/파일 배치 선택으로 판단하며 원 승인/원 WI bytes를 보존한다.

**ACK 경계:** 이 slot은 보호 sender/recipient·peer/package를 인증하거나 ackRef를 생성하지 않는다. accept는 내부 데이터 수용일 뿐 CONFIRMED/UNCONFIRMED·수신receipt·durable 설치·Native OPEN 권위가 아니다. 원 r2의 보호 수신자/ackRef 계약은 미정으로 유지한다. 실제 전달 endpoint/producer·기본 등록을 만들지 않는다.

## 2. 정확 경로·담당

기존 Primary 단일 writer, Main 제품쓰기0·기존 Reviewer read-only. 신규2만:

1. apps/connector/runtime/native-preparation-credential-slot.ts — 원 authority/identity에 결박한 credential private 메모리 slot과 기존 HTTPS channel의 내부 protection 조립. 기본 미등록/SOURCE_ONLY_MODEL·import/constructor I/O0.
2. tests/unit/FN06/native-preparation-credential-slot.test.ts — 명시 request/profile/sign 대역과 실제 NativePreparationClient→slot→기존 HTTPS channel→원 journal/fakefactory의 집중 검증.

기존 코드/시험·SQL·보호 untracked3·다른 담당 변경은 읽기만 하고 수정·복구하지 않는다. 새 agent/chat/branch/worktree/예약0. 추가 경로/새 계약이 필요하면 구현 전 Main에 정확 이유를 반환한다.

## 3. 내부 동작·수명

- 생성 시 원 authority {ref,snapshot}의 정규hash·exact r2 원형과 NativeChannelIdentity의 origin/등록 fullref·profile·목적/세대를 검산·고정한다. 한 slot은 한 원 authority만 담당하며 재바인딩/자동 재발급0이다.
- accept 입력은 r2의 정확6개 authorityRef/credentialId/credentialGeneration/registrationRef/channelProfileRef/expiresAt와 별도 Uint8Array다. 식별5값은 원 authority/identity와 exact 일치해야 한다. expiresAt는 원 authority 만료 이내의 유효한 전달 최소기한이며 authority보다 짧을 수 있다. slot은 전달된 기한을 고정해 유지하고 upstream 정책/세션의 보호 검산을 대신했다고 주장하지 않는다. 정확 중복은 동일 delivery6와 비밀에만 한정하며 후속 accept로 기한을 갱신하지 않는다. 비밀은 기존 native opaque43 허용 문자·길이와 대조하고 새 prefix/정규화 규칙을 만들지 않는다. 원 caller bytes를 바꾸지 않고 자기 private 복사본만 보관한다.
- 같은 원 tuple/같은 비밀은 기존 상태만 유지하고 수명·channel·단조 시작점을 갱신하지 않는다. 다른 tuple/비밀은 원 값을 덮지 않고 고정 오류로 거절한다. 만료 뒤 수용/새 사용·종료 slot 재사용0이다.
- 원 기한·단조 clock/UTC 후퇴를 검사하고 기한을 늘리지 않는다. 재시작/새 slot에 비밀이 없으면 UNAVAILABLE이며 자동 복구/재전달·재발급·factory 재호출을 하지 않는다. 이는 서버/원시도 journal 내구성을 대체하지 않는다.
- public raw secret getter/새 plaintextRead/직렬화·로그·정상 결과·ACK를 제공하지 않는다. accept 결과는 ACK가 아니며 CONFIRMED/ackRef를 만들지 않는다. slot 복사본은 종료/만료 시 소거를 시도하되 관리 문자열/이미 전달된 복사본의 완전 메모리 소거를 보장하지 않는다.
- 같은 slot의 channel은 한 객체로 고정해 다시 얻어도 원시도의10초/동일signal 예산을 새로 만들지 않는다. 비밀이 없거나 source 의존성이 없으면 channel 사용을 거절한다. constructor/getChannel/accept는 자동 request·서명을 만들지 않는다.
- profile/current·등록 signer는 실제 구현이 없는 명시 source 의존성이다. 기존 NativeHttpsBinding과 비밀 없는 base material(binding/ca/profileExpiresAt/signerExpiresAt), 고정 sign 포트를 전달받아 원 binding/함수·getter/await 뒤 변경을 검사한다. bearer/credentialExpiresAt는 slot이 원 비밀/기한에서만 공급한다. 임의 CA·verified:true를 실제 검증이라고 표시하지 않는다. 기존 SIGN_PROOF를 범용 signer로 완화하지 않는다.
- slot 비밀은 자신이 만든 private protection closure를 통해서만 기존 HTTPS channel에 공급한다. 해당 closure/포트는 외부에 반환하지 않는다. 종료/만료·문맥 회수 뒤 캐시된 channel의 새 read/sign/request를 막도록 소유 포트를 회수·무효화하고 await 뒤에도 확인한다. 이미 출발한 network를 취소·서버권위를 회수했다고 주장하지 않는다. 미정착/늦은 결과는 기존 유한 원 예산 안에서 실패/UNKNOWN으로 정착하며 새 요청/factory0을 보존한다.

## 4. 구현·검수

1. 정확2경로 미존재/현재 Git·원 r2와 이 WI를 대조한다. 기존 raw material/source 의존성의 미구현과 slot 기능을 구분한다.
2. 실제 client→새 slot의 정확 accept→기존 HTTPS channel의 명시 driver→원 journal→private ticket/fakefactory1을 연결하는 반례 RED→최소 GREEN을 확보한다. 별도 slot 단독 모형만 검사하고 연결 완료로 보고하지 않는다.
3. authority보다 짧은 합법 전달 기한 수용·authority 초과 기한 거절·원본 bytes alias/복사·정확중복과 상반 tuple/비밀·재시작/부재·expiry/clock·재바인딩/getter/await변경·종료 전후/late 보호 read/sign/response·동일 channel/예산 유지·비밀 비노출·ACK0을 집중 검증한다. 보호 source 없는 경우도 명시 request 대역으로 실네트워크0을 보장한다.
4. node --test 신규파일과 실제 변경 직접 영향만 선정한다. 기존 server/UI/App/journal/HTTPS/client 전수는 불변이면 반복하지 않는다. 필요하면 HTTPS 정상1만 직접 소비선으로 검증한다. tsc --noEmit -p tsconfig.base.json·diff check를 수행한다.
5. Primary는 정확2SHA/diff·실제명령/exit·반례/오류·미실행·timer/listener/비밀수명·writer 반환을 제출한다. Main fresh·독립 C0/I0 뒤 정확 source checkpoint/private 게시한다. 실제 보호 수신/ACK·실제 지원/인수·전체 계획 PASS로 승격하지 않는다.

## 5. 제외·잔여·복구

실네트워크/TLS·CA/키·Secret 파일/저장·C# 서명/helper/compiler·OS·DB/권한·서비스/native·Agent·실자료/백업·P03R3 실행0. 명시 request/profile/sign 합성 대역만 사용한다. 실제 보호 sender/recipient·ackRef 공급자·profile current·등록 signer/issuer/factory·journal 제품등록·native bridge/holder는 여전히 미구현/미정이다. source 데이터 수용은 출처 인증이나 native 권위가 아니며 기존 평문 반환 금지와 실제 효과 제외를 유지한다. source 복구는 별도 commit의 정상 revert 후보, 실제 자료/키/DB·서비스 삭제/변경0이다.

## 사전 검토 보완

초안 FCDF2D80…B61EAE0의 독립 C0/I1은 expiresAt까지 원 authority와 exact 동등으로 오해할 문구였다. 실제 coordinator의 current 최소기한은 authority보다 짧을 수 있으므로 식별5 exact·전달expiry 상한/고정·동일6중복과 정상짧은기한/초과거절 반례로 명확히 했다. 원 r2/기존 wire·권한/실제 효과는 불변이고 제품 GO 전이다.
