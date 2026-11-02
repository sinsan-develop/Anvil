# FN06 ENROLL-01 — 설치형 등록·증명·사람 확인 연결 WI r2

2026-11-02. PRE_DISPATCH_REVIEW. 코드 쓰기는 Main의 독립 검토와 명시 dispatch 뒤 기존 Primary 한 명만 수행한다.

## 기준과 업무 경계

- 직접 승인: r5 A source-only. docs/contracts/FN06_DESKTOP_TRUST_ENROLLMENT_OWNER_CANDIDATE_20261102.md SHA256 F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6. 승인기록7B8E5A34D69D85A69FEE2AEA3F69643427B4781BF2454E8B2FA37D2EA9AA75A3.
- 계획 FUNCTION_WORK FN06, 설계 §9.1~2·AV3-F13/F14, r5 §3/7/8/9/10/12. 기존 첫 단위 KEY_READY의 코드 f9346d1d, 결과tail 98eb34c2d30617a4eebc4c5888a16930630e17c9에서 이어간다. 기존 codex/av3-stage-b, 새 branch/세션/자동화0.
- 한 업무: **KEY_READY → 명시 pair → 원 hint/등록ID 선보관 → 고정 HUMAN 조회 → enroll → 등록 proof 서명/prove → HUMAN 대기 → 명시 CHECK_CURRENT의 확인/거절 구분**. 실제 설치/키/서버 동작을 완료라고 보고하지 않는다.
- ISSUE/credential 저장·복구·native mapping/권위/서명은 후속이다. r5에 정의된 READY_TO_ISSUE 표시는 사람 확인 관측일 뿐 ISSUE 실행 허가/완료가 아니다. trust-act ISSUE·RESTORE_VERIFY는 이번에도 거절한다.
- 기존 Web UI11 등록/확인/거절/회수와 서버 계약은 재구현하지 않는다. 새 공개 API·DB/migration·정책/권한·인증/키/서비스 변경0. 실제 C# 컴파일/RunAll/OS/helper/Agent·실자료/백업조사·P03R3 실행0. 시험은 메모리 합성으로 한정하며 FS QA는 생성하지 않는다.

## 정확 쓰기 범위 — 기존9·신규2

| 기존 경로 | 시작 SHA256 |
|---|---|
| apps/desktop/src/trust-enrollment-owner.cjs | F9A61ACA296D7D803B7027849F912D373C03008DD5BB8F4449F83B307F2A98A1 |
| apps/desktop/src/shell.cjs | 686EA797C7E1429538BBEFF23943EE292537911B444500775838329E66AFDE7A |
| apps/desktop/src/policy.cjs | 345704AB29430AB99C92FBE09876D85D149B45FE60F3B632C5A202AED12EE376 |
| apps/desktop/src/settings.html | 1C6BABC6AE2B65C32018C5C06F7097850FEC9B0A898FA71361E7D060D1116BB9 |
| apps/desktop/src/settings.js | 12F7E7BA6B28D00AD06E42E5E487A4CA8856521B0438D4E979E3223EF45CB62A |
| apps/connector/native/DesktopTrustKeyHostSource.cs | E4D03ECCC9B61F88F8A4627B14427216CF0D526BEA235C20271172C656C238B3 |
| apps/connector/native/DesktopTrustKeyBindingStoreSource.cs | 6063E3781D1E3128509306A66146F3C0A4933549D3EF87A7FD1DC36D1A54BD3F |
| tests/desktop/desktop-trust-owner.test.cjs | 19BD7864AF9E71069D89340BBB308F7AFC6E8C273634398A50AFAFCF3A4980FE |
| tests/native/FN06/DesktopTrustKeyHostSourceTests.cs | 33A1F8FB756BF978D65B4BBD5429AD6E5A70232FF6532F1314A7AF1FE80A24B4 |

신규(조사 시 부재): apps/desktop/src/trust-registration-client.cjs; tests/desktop/desktop-trust-registration.test.cjs.

Main은 문서/WORK_STATUS/Git만, Reviewer는 읽기 전용이다. Primary가 이11경로를 소유하며 다른 code writer0. 다른 파일 쓰기가 필수면 정확 의존과 최소 대안을 Main에게 반환하고 범위를 바꾸기 전 쓰지 않는다. 보호 untracked3·기존 fixture·root dirty 보존. 기존 preload의 네 method를 그대로 소비한다.

## 구현 계약

1. 기존 begin 결과와 보호 record의 binding/attempt/pendingKeyId/key/SPKI/fingerprint·origin을 재검증한다. begin은 helper를 닫았으므로 pair/current는 새 단발 owned channel을 원 record에 연결하고 PUBLIC_KEY로 같은 키를 검산한다. CREATE0·새 binding/새 키 우회0. 기본 배송 profile/보호 공급자 부재는 UNAVAILABLE을 유지한다.
2. Main 기술 선택: 배송 CJS 내부 adapter에서 현재 소유 remoteSession의 Session.fetch를 고정 경로만 소비한다. transport는 renderer에서 주입/선택하지 않는다. 현재 origin·view·세션/인증 관측·epoch를 Main이 결박한다. HUMAN GET은 정확 /api/v1/projects/<projectIdHint>/connector-registrations/<registrationId>, query/body/임의URL/redirect/프로젝트 탐색0. 같은 HTTPS origin만, 표준 TLS 검증 유지, cookie/CSRF 원문 getter/export·인증서 우회/임의CA0. 기존 trust-https.ts의 QA용 고정3830/CA인자·새10초를 제품에 복제하지 않는다.
3. enroll/prove는 r5§3의 기존 정확 endpoint/DTO만. 입력 code43·nonce32bytes 등 원 canonical 규칙 그대로. 응답 stream/본문 유한 상한은 기존 wire 16KiB, JSON/content-type·exact/own-data·ref/hash·scope/P256 검산. 실제 응답/세션/URL·서명·code를 renderer/오류/log에 노출0. 고정 안전 오류만 반환한다. 임의 HTTP/bytes 서명 포트0.
4. r5§7/8 순서를 지킨다. 원 hint/registrationId는 enroll 전 CAS 선보관, oneTimeCode/nonce/challenge/signature는 private 진행 메모리만. projectId는 hint이며 HUMAN exact/hash/scope.projectId/installationId/지문·기한 검산 뒤에만 검산값으로 저장한다. registrationExpiresAt은 검산한 HUMAN scope.expiresAt뿐, challenge/credential 기한 대체0.
5. 기존 registration-proof.ts 정확8필드 canonical과 기존 ProtectedStore.SIGN_PROOF primitive를 전용 owned Host의 보호 caller로 연결한다. 원 보호 record·key·등록/installation/scope·challenge/nonces·기한을 교차검산한다. 일반 SIGN/범용 bytes/NativePreparation 권위로 확장0. 기존 ProtectedStore.cs/legacy primitive는 수정하지 않는다. C# record validator·transition·원본 CAS는 r5 상태표에 필요한 PAIR_PENDING/PROOF_PENDING/HUMAN_PENDING/ISSUE_READY/REJECTED/REVOKED/EXPIRED/UNKNOWN만 좁혀 추가하고 이전 KEY 동작/한도/sidecar/불명 보존을 유지한다.
6. 별도 명시 pair/current 각각 원 요청 총10초 이내, catalogue/등록/challenge 최소기한으로 감소만 한다. effective wall/mono와 timer 축소·원 미정착 IO/자기 child 종료 소유를 유지한다. helper 진입마다 새10초/기한 초기화0. 매 await 뒤 원포트/epoch/origin/view/auth/기한 재검산, ABA·옛 finally가 현 latch 변경0.
7. requestId는 attempt 내 정확 canonical 요청에 결박하고 같은 요청 동시호출은 원 pending을 공유한다. 코드 포함 hash/journal은 private 메모리만. r5 최대256entry/attempt 포화 BUSY·자동정리/새attempt 우회0. 변이 출발 뒤 불명은 UNKNOWN과 원ID/단계를 보존하며 같은ID도 자동 enroll/prove 재전송0. 보호 저장 실패를 실패확정/새 키 허가로 바꾸지 않는다.
8. prove 원응답을 검산해 HUMAN_PENDING을 내구 보관하고 PROOFED_WAITING_HUMAN 표시한다. CHECK_CURRENT는 명시 클릭만·poll0. CONFIRMED의 원기준/기한을 재검산해 READY_TO_ISSUE, 검산된 REJECTED는 원ref/ID/키/기한·SERVER_REJECTED를 보존하고 issue/재등록0. 단순 오류code만으로 REJECTED 추정0. 회수/만료/기준변경도 r5 분류대로 폐기/불명과 구분한다.
9. 화면은 기존 접힘 trust영역 안에 프로젝트ID·등록ID·최초코드 입력/명시 pair·현재 확인 버튼·원상태/미확인기한을 추가한다. 기본12px·상한 내부 overflow·main만 높이결정·기존CSP/connect/종료/숨김 유지. 코드입력은 화면에 필요한 시간만 메모리, 제출/종료/epoch폐기 시 제거·저장0. renderer에 키/credential/plaintext cookie/root/hash선택권0.

## 필요한 검증·인수

- RED 먼저: 현재 pair 거절과 새 정상 종단 미지원 또는 중요한 실패 반례를 실제 assertion으로 확인한다. 구현을 그대로 모사한 얕은 통과시험으로 대체0.
- 메모리 정상: 실제 preload→IPC handler→owner→고정 transport→owned helper/PUBLIC/SIGN→store CAS→HUMAN 대기. 이어 별도 current의 CONFIRMED·REJECTED. 원KEY 흐름도 인접 회귀한다. 실제 source 메서드가 fake dependency를 소비해야 하며 가짜 ready:true 공급자를 제품 default로 넣지 않는다.
- 중요 실패: 잘못된 hint/project/installation/scope/ref/hash/키/nonce·틀린 content-type/oversize/redirect/off-origin; 저장전/효과후응답유실·불명·동일ID/다른내용/동시중복; ABA/늦은응답·원기한/timer축소·미정착 child; 재진입 CREATE0·code/서명/nonce 저장·오류노출0; REJECTED 후변이0. 실제OS·TLS·C# 실행은 NOT_RUN.
- C# 시험 source는 record정확형태/상태전이·부정형·원등록 proof 결박을 추가하고 컴파일/RunAll하지 않는다. 기존 통과 assertion/기준완화/시험삭제0.
- Primary: 구문/desktop type·선정 Node 핵심/인접검증·diff와 정확 명령/exit·소스hash/변경·미실행·문제계보를 반환한다. Main: 독립 scoped review/필요한 fresh핵심 검사→소유commit/private exactSHA·결과보고. 이미 불변인 verifier/build/QA01·02/전수 검증 반복0. 실제 효과·main merge0.

## 반환·복구

COMPLETED/FAILURE_REPORT/INCOMPLETE를 구분한다. 하나의 오류 계보3회 연속이면 중단해 Main 인수 판단에 필요한 원인/증거를 반환한다. 시험·권한/도구 실패를 C# 실제실패로 부풀리지 않는다. 복구는 exact 소유 diff를 정상 Git으로 검토하며 reset/force/타인변경삭제0. FN06/작업계획 전체 완료로 보고하지 않는다.
