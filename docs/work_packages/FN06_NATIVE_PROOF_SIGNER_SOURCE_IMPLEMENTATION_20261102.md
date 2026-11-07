# FN06 r2 전용 proof 서명·원 예산 연결 — source 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 내부 구현 / SOURCE_ONLY_MODEL

## 근거와 범위

원 후보 SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, 직접 승인9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567, 원 WI3905A46EEE54AF75C1971C66A51A8D1AB5E6F2EA439462F4192F53FDA151C1F6을 보존한다. r2의 canonical8/native purpose/P256 proof와 원시도 전체10초를 기존 HTTPS·slot에서 typed signer로 이어가는 내부 구현이다. 공개 HTTP·DB·권한·키 저장 계약 변경0이다.

등록키 mapping·현재 caller/root·peer/package 보호 공급자는 부재다. 이번에는 보호 공급자를 가정한 성공을 등록하지 않으며 실제 호출 기본값은 UNAVAILABLE이다. C# primitive는 목적/내용 검산만 하며 키 사용 인가가 아니다. ProtectedStore.Main/Run/Load에 새 입력 연산을 연결하지 않고 기존 등록 전용 SIGN_PROOF·CREATE_KEY·DPAPI 형식은 보존한다.

## 담당·정확5경로

기존 Primary 단일 writer, Main 제품쓰기0, 기존 Reviewer 읽기 전용. 다음5경로만 수정/신규 생성한다.

1. apps/connector/runtime/native-preparation-https.ts — 원 sign에서만 발행/폐기하는 private registry context와 signer 내부 전달.
2. apps/connector/runtime/native-preparation-credential-slot.ts — 동일 context 객체를 원 sign 포트에 forwarding, 새 발급/복제/예산 갱신0.
3. apps/connector/runtime/native-preparation-proof-signer.ts — 신규 typed 서명 source codec/consumer. 기본 보호 mapping/exchange 부재, import/constructor I/O0.
4. apps/connector/native/NativePreparationProofSource.cs — 신규 닫힌 parser/canonical/P256 primitive. 기존 CngKey를 인자로 받는 source만, Main/Run/Load/build 연결0.
5. tests/unit/FN06/native-preparation-proof-signer.test.ts — 실제 client/slot/HTTPS source 흐름과 명시 합성 request·보호 mapping/exchange만 사용하는 집중 시험.

추가 경로 필요 시 정확 사유를 Main에게 반환한다. 기존 SQL/원 후보/승인/WI/보호 untracked3·다른 담당 변경·기존 시험은 수정하지 않는다. writer commit/push0, Main 검수 후 정확 staging. 새 agent/chat/branch/예약0.

## 구현 계약

- 기존 sign(bytes,signal)에 선택 내부 문맥을 추가하되 기존2인자 포트의 의미를 유지한다. context 발행자는 HTTPS의 검산된 원 sign 경로 한 곳이다. private WeakMap의 객체 정체성으로만 원 authority/ref·challenge·request8·exact domain bytes·원 signal·동적 remaining을 결박한다. 외부 raw JSON/clone/getter/선언 budget·keyId로 capability를 발행하지 않는다. 이것은 same-process provenance이며 native/OS caller 인증이 아니다.
- context remaining은 원 channel의 동일 단조 deadline과 최소 authority/challenge/profile/credential/signer 만료를 매번 읽는다. 새로운10초 timer0. 원 timeout/abort/외부 sign 종료의 finally에서 즉시 폐기한다. 각 await 뒤·exchange 직전·응답 검산 뒤 현재/remaining/signal을 재검산한다. 늦은 preflight가 helper/exchange에 진입하지 못하고 늦은 성공은 버린다. 재시도/자동 새 context0.
- typed signer는 context에 묶인 원 bytes만 수용한다. keyId는 별도 호출자 인자가 아니라 명시 보호 mapping source의 원 binding/등록 세대·fingerprint 검산 결과로만 얻는다. mapping/exchange 의존성 부재·변경/getter·실패는 고정 비밀 없는 오류다. 선언값 검산을 실제 등록/caller/root 보호 인증으로 보고하지 않는다. 실제 source는 기본 미등록이며 테스트는 모든 포트를 명시 대역으로 제공한다. 실제 child_process/spawn·키 파일 접근을 구현/실행하지 않는다.
- 내부 typed exchange의 고정 operation은 SIGN_NATIVE_PREPARATION_PROOF, 입력은 keyId/원 authority{ref,snapshot}/challenge/request/원 remainingMs이며 canonical JSON으로 닫는다. 공개 HTTP나 기존 ProtectedStore 연산 추가가 아니다. bytes/내용/registration/authority세대·nonce·consume method/path·빈 queryHash=nativeHash({})·bodyHash=nativeHash({schemaVersion:1,authorityRef,localAttemptRef})를 대조한다. remainingMs는 현재 양수·최대10000이되 원 남은 값 이하로만 전달한다.
- 서명 대상은 nativeRequestProofBytes의 canonical {purpose:'NATIVE_PREPARATION_REQUEST_PROOF',request} UTF8다. requestHash는 nativeHash(request8)이며 wrapper hash가 아니다. 응답은 exact {keyId,publicKeySpki,fingerprint,requestHash,signature}. P256 SPKI와 fingerprint/원 keyId·requestHash, canonical base64url64B P1363을 대조하고 공개키로 원 bytes 서명도 검증한다. 다른 목적·잘못 키/서명·원문 echo/추가 필드·오염 JSON을 거절한다. 임의 서명 API/비밀 반환0.
- C# source는 canonical typed 요청만 strict하게 읽고 duplicate/extra/noncanonical·잘못형/크기/깊이를 닫는다. 원 authority hash/ref·challenge/request/consume-body·기한/remaining과 원 key의 P256 fingerprint를 검산하고 같은 domain bytes의 SHA256만 서명한다. 새 키 생성/저장·키 위치 지정·Load/DPAPI·credential 접근0. 임의 bytes signer0. C# runtime/canonical/crypto parity는 실제 실행 전 NOT_RUN이며 TS 대역 검증으로 승격하지 않는다.
- 기존 status/등록 서명·factory/원장·HUMAN/UI/HTTP·source 권한은 그대로다. 종료 요청/timeout을 CNG/kernel/helper 회수 완료로 주장하지 않는다. 실제 실행기 연결·보호 caller/root/mapping·원 hostkey 접근은 후속 미구현이다.

## 검증·반환

먼저 실제 NativePreparationClient→slot→HTTPS→신규 typed signer→명시 exchange→원 consume/journal/private fakefactory의 실패 반례를 실행해 RED를 확보한다. 원 public RFC6979 P256 예제키는 메모리 합성에만 사용 가능하며 새 실제 키 생성/파일·Secret 읽기0이다.

정상1회, 임의/위조/clone context0, wrong-domain/hash/SPKI/signature, expiry/원예산 소진/abort, mapping await 뒤 변경·소진, 늦은 응답, 동일 context 재사용/동시 호출·slot 전달의 정체성·context 폐기/추가 호출0을 필요한 범위로 검사한다. 기존 HTTPS/slot 불변 전수 반복 대신 변경 전달선의 정상·timeout 대표만 선택하고 tsc --noEmit -p tsconfig.base.json·diff check를 수행한다. 모든 테스트는 명시 request 대역이고 실제 네트워크0이다.

Primary는 정확5SHA/diff·명령/exit·RED→GREEN·준비 오류와 제품 실패·타이머/미정착 상태·미검증·writer 반환을 보고한다. Main fresh 검증·독립 C0/I0 뒤 통합한다. 기존 helper build script는 신규 C# source를 포함하지 않으며 의도적으로 실제 활성화하지 않는다.

## 제외·잔여

실제 DB·SQL 적용/권한·키/CA/Secret·실자료/백업 파일 조사·네트워크·C#/compiler/helper/CNG/DPAPI/OS·서비스/native/Agent·P03R3 실행0이다. 새로운 임시 파일/QA root 생성0·메모리 시험만 허용한다. 실제 보호 profile/current·recipient/ACK·issuer·native factory/owner bridge·실제 키 mapping은 미구현이며 source와 실제 기능/인수를 구분한다. 전체 작업계획 완료가 아니다. rollback은 source commit의 정상 revert 후보이며 사용자 자료나 실제 환경 변경0이다.
