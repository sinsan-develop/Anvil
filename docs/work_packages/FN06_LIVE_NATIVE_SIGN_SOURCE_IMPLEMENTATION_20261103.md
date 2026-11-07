# FN06 LIVE-NATIVE-SIGN-01 — 등록 원키의 native typed SIGN 보호 caller WI r1

2026-11-03. PRE_DISPATCH_REVIEW. 독립 검토·게시·Main 명시 dispatch 전 코드 GO0.

## 승인·업무 경계

- 직접 채택 r2 A: docs/contracts/FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085. 직접 승인 기록 docs/04_test_reports/AV3/FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md SHA9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567. 후보 제목의 과거 미채택 표시는 이력이며 직접 승인 범위만 적용한다.
- r5 A의 §7/12도 원 등록키·별도 NativeOnly 권위/current/profile를 검산하는 typed caller를 포함한다. r5 SHA F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6. FUNCTION_WORK FN06/FN08, 설계 §9.1~2의 기존 승인 source-only 범위다.
- 기준 codex/av3-stage-b ea3d903874f40c3c3321d953d439dc3c5be651fb, ISSUE code3e99e04e·결과e758fb9c/5AC41337의같은실행 REGISTERED 원행에서 이어간다. 복구 bootstrap 후보43EBD866은 미채택·직접 결정 대기이며 이 업무의 선행이나 승인으로 사용하지 않는다.
- 한 논리 업무: **살아 있는 owner의 REGISTERED 원행 → 보호 mapping.resolve → owned helper exchange → 같은 기존 키 Load → NativePreparationProofSource.Sign → 원 request/P256 서명 검산**. 기존 typed signer/HTTPS private context의 실제 소비선까지 연결한다. 새 facade/가짜 ready:true만 반환하는 것으로 끝내지 않는다.
- NativeOnly 발급·보호 전달/recipient·보호 current/profile의 실제 공급자 및 desktop의 connector TS runtime 전체 배송 조립은 별도 남는다. 이 업무만으로 실제 native 준비·Agent 연결/실행 완료라고 하지 않는다. 보호 공급자 기본값은 미등록/UNAVAILABLE이다.

## 정확 허용5 — 모두 기존

| 경로 | 시작 SHA256 |
|---|---|
| apps/desktop/src/trust-enrollment-owner.cjs | 5D3790F9B6A81929AFA32DD6D7981384CAAF679CD17CCD0DB4F741209BA95812 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | 13AF7D0127742E0D1F884F127764DD3DF899D9DC671413159E4A28198C40EEE4 |
| tests/desktop/desktop-trust-registration.test.cjs | 81FF1752793970DCFC24E5EF2B59BADB0A4755DCDD0CDC7C4DA5F2321810C076 |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 44CB98FD1E491228A155217B73CDF67206DA6EAC6D0B832A308F5751B98DD1FE |
| tests/unit/FN06/native-preparation-proof-signer.test.ts | 45FDB38E883527F4A0DFEDFABBCC61703254D15BA7A31D2CC9BE1BC251549661 |

기존 Primary 한 명이 code writer, Main은 docs/현황/Git, Reviewer는 읽기만. 새 agent/chat/branch/자동화0. 타인 dirty·보호untracked3·기존fixture 보존. 추가 파일이 필수면 최소 이유/대안을 Main에 반환하고 revision 전 쓰지 않는다. 실제 키/DB/권한/서비스·C#compile/RunAll/OS/helper/Agent/네트워크/실자료/백업/새QA/P03R3 실행0. 시험은 명시 메모리·공개 고정 벡터만이다.

## 원 계약을 지키는 연결

1. 같은 프로세스/owner/현재 epoch의 정상 REGISTERED 보호 record만 출발점이다. 원 attempt/binding·keyId/SPKI/지문·등록 fullref/scope/installation/project·고정 helper/profile/current·등록/credential 기한을 재검산한다. 재시작·record 부재·UNKNOWN·다른 사용자의 원행을 선언 JSON으로 등록하지 않는다. 원 slot/profile·별도 NativeOnly 권위가 없으면 닫는다.
2. 새 공개 IPC/HTTP/DB/저장형식·bearer 목적은 추가하지 않는다. main 내부 생산자만 기존 NativeProofMappingSource/NativeProofExchange 인터페이스에 연결한다. 원 SOURCE_ONLY_MODEL 표식을 실제 물리 권위/transport로 승격0. renderer/Agent가 binding/keyId/root/hash/authority/current/profile을 고르는 포트0. HUMAN GET은 등록 관계 확인에만 사용하며 NativeAuthority를 생산하지 않는다. StatusOnly token을 native bearer로 재사용0이다.
3. NativePreparationProofSigner의 consumeNativeProofSigningContext가 HTTPS 내부 WeakMap의 살아 있는 원 context/bytes/signal을 한 번 소비한 뒤 mapping.resolve/exchange에 도달하는 순서를 유지한다. raw JSON/복제/위조 context·getter/Proxy·바뀐 port/identity·다른 signal/bytes·종료 후 재사용은 helper 진입0이다. consume 후 factory ticket을 서명 선행 인가로 만들지 않는다.
4. 원 NativeHttpsBinding/현재 보호 profile·등록키를 교차 검산하는 구체 main 내부 source를 생산하되, 누락된 보호 supplier에 빈 성공 함수를 넣지 않는다. 현재성 source·origin/사용자/원 등록·지문·profile ref가 일치해야 한다. 비교용 scope/authority의 raw 입력만으로 검산 성공을 선언0. 소비 전후 동일 binding·key mapping을 관측하고 현재성이 바뀌면 닫는다.
5. 기존 createTrustOperation/owned key-host client의 보호 parent/peer/root·키 PUBLIC 검산을 재사용해 SIGN_NATIVE_PREPARATION_PROOF 분기를 연결한다. 전용 Host는 원 REGISTERED/원키/NativeOnly authority·목적·target/current 기한을 대조한 내부 gate에서만 기존 키를 열고 NativePreparationProofSource.Sign(frame,existingKey)에 전달한다. 기존 partial ProtectedStore 접점으로 키 Load를 재사용하되 원 ProtectedStore.cs/legacy Main/Run/파일형식·SIGN_PROOF는 바꾸지 않는다. 키/credential 평문 반환·범용 bytes SIGN·임의 path/command0.
6. 원 native request 정확8필드와 canonical 목적 도메인 NATIVE_PREPARATION_REQUEST_PROOF를 그대로 소비한다. 등록8필드 HOST_PROOF나 기존 EXECUTION_REQUEST_PROOF·writer NUL 도메인과 혼합0. challenge/current/authorityRef·credentialGeneration·nonce·method/path/query/body hash와 원 대상이 맞아야 한다. 응답은 기존 signer가 기대하는 keyId/publicKeySpki/fingerprint/requestHash/signature exact만, requestHash는 원 native request hash다. 실제 P256 SPKI/P1363/도메인 서명을 consumer가 검산한다.
7. 원 HTTPS context의 동적 remainingMs·고정 callExpiresAt과 authority/challenge/profile/mapping·등록/credential 기한의 최소값만 쓴다. 새 helper/Load/Sign에서10초를 재기산하지 않는다. Load 등 선행 시간이 소비되면 primitive에 남은 더 짧은 원예산을 넘기고 고정 끝시각을 연장하지 않는다. wall 후퇴/정체와 mono 경과·후행 최소기한·미정착 IO/child 회수·원 포트/epoch/ABA를 매 await 전후 검사한다.
8. catalog/current 회수·HUMAN 관계/등록 세대·key/profile 변경은 SIGN0 또는 원 결과 불명으로 닫는다. 원 signer context와 frame의 재사용/동시·서명 완료 후 재소비는 새 SIGN0. 등록·key 생성/STORE/ISSUE/START/SEND/준비 consume를 이 adapter가 임의 수행하지 않는다. native 준비의 실제 consume/journal/factory는 기존 client 계약이 소유한다. 기존 begin UNKNOWN 우회 차단·등록/발급·closeConfirmed/상태/비밀 비노출과기존 UI/CSP는 유지한다.

## 필요한 검증·반환

- 새 보호 caller 미연결 또는 중요한 반례의 실제 assertion RED를 먼저 확보한다. module 부재나 fake ready 불일치만으로 제품 결함을 대신하지 않는다.
- 메모리 정상은 같은 실행의 실제 등록·발급 REGISTERED source producer와 실제 Client→slot→HTTPS private context→기존 typed signer→새 owner mapping/exchange→원 key-host client/fake helper→서명 검산/원 consume를 연결한다. 기존 key 재사용·CREATE/STORE 추가0·source-only와 실제 OS/CNG 미검증을 분리한다. 기존 test helper 재사용은 구현 선택이나 넓은 공통화/전체 재작성은 하지 않는다.
- 다른 등록/key/profile/current·회수/만료·단축/정체 예산·ABA/늦은응답·원 context 부재/JSON위조/다른 signal·frame변조/다른도메인·종료 후 접근·서명 재사용·동시중복의 중요한 조건을 선정한다. 원 request·원행·UNKNOWN/미정착 handle/예산과 비밀 없는 오류를 보존한다.
- C#은 실제 Host 메모리 포트의 typed 분기·원 key/root/등록·frame/기한/목적 변조 거절과 기존 Load/Sign 호출선을 시험 source로 작성하고 컴파일/RunAll하지 않는다. CS0819 등 앞서 확인한 소스 구문 오류를 되풀이하지 않는다.
- 변경 CJS의 desktop type/구문, 변경 TS 시험에 필요한 root noEmit 타입·선정 native signer/직접 등록 인접·diff를 수행한다. 불변 전체/verifier/build/기존 QA 반복0. 기존 기준/기대값 완화·시험 삭제0. Source-only 결과를 실제 TLS/CNG/설치/Agent/전체FN06·계획 PASS로 승격0.
- 정확 명령/exit·RED/준비오류 계보·최종지문·live/미실행·잔여를 반환하고 writer를 돌려준다. 동일 근본 오류3회는 중단해 Main 판단에 필요한 증거를 반환한다. Main은독립scoped검수·필요한fresh핵심·소유checkpoint/privateexactSHA·결과기록을수행한다. 복구는정확소유diff의정상Git revert로검토·reset/force/타인변경삭제0이다.
