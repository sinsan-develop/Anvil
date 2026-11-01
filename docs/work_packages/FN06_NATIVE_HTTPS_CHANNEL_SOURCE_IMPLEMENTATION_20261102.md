# FN06 native 준비 HTTPS 전송 adapter — source 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 안의 내부 구체 전송 구현 / **SOURCE_ONLY · 실제 효과 제외**

## 1. 목표·근거·범위 판단

r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085 §61/121/125/127의 고정 HTTPS origin/channelProfileRef·새 목적 opaque bearer·current/challenge/consume·8proof/P1363 header·redirect0을 기존 NativeOwnedChannel의 구체 전송 코드로 연결한다. 기존 client는 포트만 소비하며 native HTTPS adapter가 없다. 기존 observation/trust HTTPS 코드는 참고만 하고 수정·복제 도메인 승격하지 않는다.

Main 판단: 원 wire/권위/키 발급·DB·사용자 데이터 계약을 바꾸지 않는 내부 driver/포트 배치 구현이다. 보호 profile/current·credential·signer 공급자는 source 의존성으로 명시하고 실제 구현/권위 검증이 없음을 유지한다. caller의 verified:true나 임의 CA/signer 문자열을 실제 보호 완료로 표시하지 않는다. r2에 없는 SPKI pin/새 TLS registry·키 경로/Secret 발급·등록 스키마는 추가하지 않는다. 원 승인/원 WI bytes는 보존한다.

## 2. 정확 경로·담당

기존 Primary 단일 writer, Main 제품쓰기0·기존 Reviewer read-only. 신규2만:

1. apps/connector/runtime/native-preparation-https.ts — 실제 Node HTTPS driver를 사용할 수 있는 NativeOwnedChannel source adapter. import/constructor socket·파일 IO0, 기본 등록0, SOURCE_ONLY_MODEL.
2. tests/unit/FN06/native-preparation-https.test.ts — 명시 request/보호 공급자 대역·clock/timer와 실제 NativePreparationClient의 정상·실패 소비. 실제 네트워크/CA·키·파일·DB·서비스·Agent를 사용하지 않는다.

기존 제품/시험·SQL·보호 untracked3는 읽기만 하고 복구·수정하지 않는다. 공유 코드베이스의 타인 변경을 존중한다. 새 agent/chat/branch/worktree/예약0. 추가 경로나 새 계약 필요 시 구현 전에 정확 차이를 Main에 반환한다.

## 3. 생성·보호 의존성

- 정합 hash의 원 authority와 기존 NativeChannelIdentity, 고정 origin/정확 profileRef와 CA material·profile 현재성/기한 보호 포트, 정확 NATIVE_PREPARATION_ONLY/등록 fullref/세대/기한에 결박된 opaque bearer, 원 hostPublicKeyFingerprint·등록·authority에 결박된 보호 signer 포트만 명시 주입한다.
- 이 내부 의존성은 실제 보호 공급자 구현을 대신하지 않는다. 부재/불일치/회수·만료는 요청/서명0으로 거절한다. 생산 권위나 신뢰 profile을 자동 생성·VERIFIED 판정하지 않는다. bearer 형식은 기존 server/r2 경계와 대조하고 새 prefix·일반 credential 재사용 규칙을 만들지 않는다.
- 안정된 own 함수 current/challenge/sign/consume와 불변 identity를 제공해 기존 client 동일성 검사를 소비한다. 공급자 getter/함수·identity 교체·await 뒤 문맥 변경을 거절하며 사용자 객체를 암묵적으로 동결/권한 변경하지 않는다. 실제 Secret/raw키 경로를 읽지 않는다.

## 4. 구현 조건

- current GET·challenge POST·consume POST는 원 authority의 정확 상대 경로와 canonical body, 빈 query hash, 8proof canonical base64url/P1363 header만 생성한다. cookie/query/임의 origin·추가 header/redirect/자동 retry0. 서명 입력은 원 목적·authority/세대·challenge/target/body에 결박해 임의 bytes의 범용 signer가 되지 않게 한다.
- Node HTTPS는 rejectUnauthorized:true·명시 CA·기본 hostname 검사·agent:false를 유지한다. TLS 검사 우회0. sign/current profile·credential 소유 포트 부재를 가짜 성공으로 채우지 않는다.
- 첫 호출의 원 AbortSignal과 단조 시작점을 결박하고 후속 호출마다 예산을 재시작하지 않는다. 전체10초와 authority/profile/credential/signer 최소 기한을 적용한다. 비정상/후퇴 clock·기한 만료/abort·await 뒤 변경은 후속 요청/서명0, 늦은 응답은 폐기한다.
- 응답2MiB/엄격 UTF-8·중복 JSON/header·정확 status/code를 제한하며 unknown/raw 오류를 비밀 없는 고정 오류로 닫는다. bearer·sign입력·CA 원문·raw 오류를 결과·로그에 넣지 않는다. 원 response/stream/close/error/timeout 수명과 소유 timer/listener를 정확히 회수하며 늦은 error도 미처리 예외로 남기지 않는다. 유지할 수밖에 없는 수동 late-error listener가 있으면 조건·소유/정리를 명시하고 listener0으로 과장하지 않는다.
- 실제 Client→새 adapter→고정 request driver의 exact wire/응답→원 journal/fake factory1을 직접 연결한다. 별도 adapter 단독 stub만 시험하고 client 소비 완료로 보고하지 않는다. 원 replay·응답 유실·abort/기한/현재성 오류 뒤 추가 factory0·자동 재송신0을 보존한다.

## 5. 실행·검수 순서

1. 현재 branch/HEAD·위 두 미존재 경로·r2/이 WI를 대조한다. 기존 실제 source 공급자 부재와 새 전송 구현을 구분한다.
2. 새 concrete 소비의 실제 행동 반례 RED→최소 GREEN, 정확 wire·목적/등록/profile/기한·header·서명 입력·redirect/oversize/중복JSON·late/abort·정리의 중요한 실패를 집중 검증한다. 모든 request/clock/보호 포트는 고정 합성 대역이다.
3. 신규 node --test와 직접 영향 기존 client의 필요한 조건만 선정한다. 기존 server63/UI17+보완1/App2/journal12는 불변이면 반복하지 않는다. tsc --noEmit -p tsconfig.base.json·diff check를 수행한다.
4. Primary는 정확2SHA/변경·실제명령exit/RED·준비오류·미실행·handle/타이머/리스너 회수와 writer 반환을 Main에 제출한다. Main fresh 검증·기존 Reviewer scoped C0/I0 후 정확 파일만 checkpoint/private 게시한다. source 범위 미검증을 실제 지원/인수로 승격하지 않는다.

## 6. 제외·잔여·복구

실네트워크/TLS handshake·CA/실키·Secret·파일 조사/작업·DB/권한·서비스/native/OS/helper/compiler·Agent·실자료/백업·P03 R3 실행0. 실제 보호profile/현재회수/credential 전달·등록 signer·issuer/factory/START/SEND/STOP와 실제 journal 등록은 여전히 미구현/미연결이다. 전체 FN06/FN08/Stage/계획 완료·PR/main병합·배포·사용자 인수0. 복구는 별도 source commit의 정상 revert 후보이며 기존 자료·DB·서비스 복구를 실행하지 않는다.