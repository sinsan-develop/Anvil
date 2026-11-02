# FN06 ISSUE-01 — 명시 발급·StatusOnly 보호 저장 연결 WI r1

2026-11-03. PRE_DISPATCH_REVIEW. Main의 독립 검토·게시·명시 dispatch 전에는 코드 GO0이다.

## 기준·책임·완료 경계

- r5 A source-only 직접 승인: docs/contracts/FN06_DESKTOP_TRUST_ENROLLMENT_OWNER_CANDIDATE_20261102.md SHA256 F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6. 승인기록7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3.
- FUNCTION_WORK FN06, 설계 §9.1~2·AV3-F13/F14, r5 §3/7/8/9/10/12. ENROLL-01 code6f8a8ebf→결과tail19869f1dce2e0938b59fc4f8aae317d45159a16e의기존 codex/av3-stage-b에서 이어간다. 결과서 A59F6F04C7A94E9E0E83AD1DA922E2731A776A33521C482BEEC129FA34FFC5D4·최종scoped C0/I0 및 Main33/직접3/type0은 소스·합성 선행 증거다. 실제 설치/키/서버 ready 증거가 아니다.
- 하나의 닫힌 업무: **같은 attempt의 원 HOST_PROOF private payload → 명시 ISSUE → 원키/현재 HUMAN CONFIRMED·catalogue 재검산 → ISSUE_PENDING 선내구 → 원 exchange CHALLENGE/두 등록proof 서명 → 최초 ISSUE 응답 검산 → StatusOnly STORE 최대1·digest/readback → REGISTERED CAS → 종료 확인**.
- REGISTERED는 등록 상태 조회용 credential 보관 이력이며 Agent 실행권한/실제 연결 완료가 아니다. 재시작 credential 사용·use-without-return·복구/native mapping·bearer 확대는 후속/제외다. 실제 DB·권한·키·서비스·C#compile/RunAll/helper·Agent·실자료/백업 조사·P03R3·네트워크·새QA 실행0. 시험은 메모리 합성 한정이다.
- 기존 Primary 단독 code writer. Main은 문서/현황/Git, Reviewer는 읽기만. 새 agent/chat/branch/자동화0. 허가 밖 변경·보호untracked3·root dirty·기존 fixture를 되돌리거나 삭제하지 않는다.

## 정확 허용9 — 모두 기존

| 경로 | 시작 SHA256 |
|---|---|
| apps/desktop/src/trust-enrollment-owner.cjs | 42237E776E1A3C5C3E48D0EB874CCFF2F1C85EAEE1243A128B9887FF864AF3EE |
| apps/desktop/src/trust-registration-client.cjs | 4767228A52C31BBA052BFAB579446C6355E7210D00C35192CC1C80D68845B28A |
| apps/desktop/src/policy.cjs | 89338B232EA26398F94354C8DD599A8B2C2897CDCDC99585B9C8195C1408E9E8 |
| apps/desktop/src/settings.html | 015488D44D76A0DB614371F46C1879718CD1FC4D3D0E9B6464D266F6A8875B98 |
| apps/desktop/src/settings.js | F5C810DCBC37D2BA1BE988E7D9DAC0B5407D234022E7F5503F033D78063EE623 |
| apps/connector/native/DesktopTrustKeyHostSource.cs | 0B055234694FE6AF030432AEDA7A42EA0D4CBA1772720640FF7CF0375AB214A9 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | 01CC167BC9ACA745EB705BC81B7917D0EF0D61049F8B3CA6A142A9C0B12434C0 |
| tests/desktop/desktop-trust-registration.test.cjs | 4BBE062A2D630A1E9A55081A920EB97FF4B0C7D241AB4912FCD08CCB4F19862F |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | DD95CCBE36687DB41B9CFEBF9259808091C3F4733C16ADAA1D89EB476E2E79A9 |

추가 파일이 필수면 이유/최소 대안을 Main에 반환하고 revision 전 쓰지 않는다. 기존 preload trustAct ISSUE·shell·generic host transport는 재사용하며 ProtectedStore.cs·서버/Web·SQL/DDL/계약 원문은 수정하지 않는다.

## 원 계약을 소비하는 구현

1. **원 private 문맥:** pair 성공 때 검산한 원 HOST_PROOF payload를 같은 attempt의 private 메모리에서 보유·소비한다. nonce/challenge/signature/token을 mapping·로그·공개 state·renderer로 보내지 않는다. 재시작/epoch 폐기·CLOSE·원 payload 부재는 재구성·자동 등록·새 키 없이 닫는다. private 문맥의 새 전역/renderer 주입 권한0.
2. **명시 발급과 예산:** ISSUE는 현재 ISSUE_READY·같은 원 attempt/epoch/requestId·기존 binding/key를 재검산한 명시 클릭만. 같은 원 record·PUBLIC SPKI/fingerprint·고정 HUMAN CONFIRMED/원scope/refs/등록기한·catalogue current를 재확인한다. 새 요청 총10초와 보관된 등록/credential·현재 catalogue/각 challenge 기한을 시작부터 최소값으로 감소만 시킨다. 동일 관측 wall/mono/timer·원 미정착 IO/child 소유·매 await 뒤 문맥/원 포트/기한 검산을 유지한다.
3. **원 exchange wire:** 기존 registration-protocol.ts:82~112와 trust-https.ts:42를 대조한다. 서버 exchange CHALLENGE는 소비된 원 HOST_PROOF payload의 serverNonce 등은 그대로, 새 clientNonce와 HUMAN 등록기한 expiresAt만 바꾼 원8필드 서명을 검사한다. 새 nonce는 원 nonce와 달라야 한다. 이를 범용 bytes/native 서명으로 바꾸지 않는다. 기존 고정 POST /api/v1/connectors/registrations/<원ID>/exchange에서 exact kind=CHALLENGE를 소비하고 응답 EXCHANGE_PROOF_REQUIRED·원ref/hash/scope·tuple·새 serverNonce/clientNonce/최소기한을 검산한다. catalogue 재확인 뒤 반환 원 challenge payload를 두 번째 서명해 exact kind=ISSUE를 한 번만 보낸다.
4. **원 발급 응답:** exact ISSUED·grants[]/executionAuthorized:false·scope REGISTRATION_STATUS_ONLY·credentialId UUID·av3ct1_ 정규32바이트 token·기한·원 registrationRef/connectorRef의 세대와 hash·상태/버전 증가를 검산한다. 등록/credential 기한을 혼동하지 않는다. 새 token을 임의 생성하거나 응답 없이 가짜 credential을 만들지 않는다.
5. **선내구와 보호 저장:** 첫 발급 변이 전 ISSUE_PENDING을 원 CAS/previousHash로 선보관한다. 최초 token은 기존 ProtectedStore STORE_CREDENTIAL primitive에 최대1회만 전달하고 반환 credentialId/digest를 원 token digest와 대조한 뒤 CREDENTIAL_MATCHES로 readback한다. 반환은 digest/일치만이며 plaintext 조회 포트0. 성공 원결과와 STORED credential metadata를 REGISTERED로 CAS 보관하고 원예산 안 CLOSED_CONFIRMED 뒤만 성공 표시한다. 기존 DPAPI/CreateNew/Flush primitive는 수정하지 않는다.
6. **전용 Host·Store:** 원 ISSUE_PENDING·binding/key/registration·고정 helper/current 소유 문맥에만 등록8필드 SIGN과 STORE/MATCH 내부 gate를 연결한다. 기존 primitive에는 그 연산의 정확 인자만 전달한다. 새 공개 key purpose/범용 SIGN/임의 경로/OS command0. C# exact record validator·역사 전이는 r5 표의 ISSUE_PENDING/REGISTERED 및 필요한 UNKNOWN의 credential null/STORED/STORE_UNKNOWN 조합만 좁혀 추가한다. 원키/ID/원scope·fullref/hash·등록기한·단조세대/기존KEY/ENROLL 비활성 상태·Read/sidecar/stickyUNKNOWN·저장한도/원행보존을 유지한다.
7. **불명과 중복:** CHALLENGE/ISSUE/STORE/CAS/close의 결과 유실·기한 소진은 원 attempt/정확 uncertainStep·이미 관측한 발급/보관 사실을 UNKNOWN으로 보존한다. 서버 ISSUED를 단순 실패로 숨기지 않는다. 같은 requestId도 새 ISSUE·새 STORE를 자동 재전송하지 않으며, 다른 내용 재사용/포화/이미 REGISTERED/UNKNOWN에서 새 발급0. 원 CLOSE/epoch 폐기 뒤 옛 finally가 현재 latch를 바꾸지 않는다. effect 표식은 같은 private ticket을 공유한다.
8. **화면:** 기존 trust 영역에 명시 발급 버튼·상태·등록기한/credential기한 구분·UNKNOWN/보관 미확인을 연결한다. READY_TO_ISSUE 관측만으로 자동 발급0. 원값 없는 기한은 미확인, raw token/서명/nonce/code 표시0. 기존 연결/종료/숨김·CSP·12px/overflow/main 높이 규칙을 유지하고 RESTORE_VERIFY/native는 차단한다.

## 최소 검증·반환

- 기존 ISSUE 미지원 또는 중요한 원 조립 공백을 실제 assertion RED로 먼저 확인한다. 시험의 fake 성공값으로 제품 factory/원 caller 누락을 가리지 않는다.
- 메모리 정상 종단: 실제 preload→handler→owner→고정 exchange adapter→owned SIGN/STORE/MATCH→REGISTERED CAS/closeConfirmed. CREATE 추가0·STORE1·원 clientNonce 갱신·원 serverNonce 유지/새 challenge 검산·버전/등록 세대 구분. 기존 pair/current와직접영향KEY 흐름은 선정 인접만 확인한다.
- 중요 실패: 원 payload 부재/다른tuple·nonce/scope/key/refs·HUMAN 미확인/거절/회수·catalogue 회수·원기한/후행 wall/ABA·동시중복. CHALLENGE/ISSUE/STORE/CAS/close 응답 유실과 STORE 성공/mapping 실패 뒤 재발급/재저장0. token은 renderer/mapping/오류/로그/재조회0·기존16KiB wire/1024row·16MiB/기본공급자미등록 유지.
- C#은 실제 Store/Host 메모리 포트의 정상·변조·호출 최대1·원행/UNKNOWN을 시험 source로 추가하고 실제 compile/RunAll은 하지 않는다. 작성된 시험을 실행 PASS로 부풀리지 않는다.
- Primary는 정확 명령·exit/진짜RED와준비오류/변경지문·미정착/자원0/미실행·잔여를 반환한다. 동일근본오류3회는중단해Main판단에반환한다. Main은독립scoped검수·필요한fresh핵심/인접·type/diff→소유checkpoint/privateexactSHA·결과서기록을진행한다. 불변verifier/build·이미정리한QA/전수회귀반복0.
- 기준/기대값 완화·시험삭제·실행 금지 경계 우회0. 전체FN06/Stage/계획 완료·실제 사용자 인수 선언0. 복구는정확소유diff의정상Git revert로검토하며reset/force/타인변경삭제0이다.
