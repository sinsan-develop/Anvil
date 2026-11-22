# FN09 고정 범위 원문 — native 검산·수송 작업지시

기준: `bcb1e539e3bb4dda9cb1dd8752c7873d00a4b638`. 승인 근거는 최초 이해 검토 A안 `FN09_NORMAL_INITIAL_UNDERSTANDING_RESPONSE_CANDIDATE.md` §3–5, SHA256 `9ED4E1C28953B905D99D22A38AF5B51F57E5DED46BD481B7AE3B2520468DF588`이다. 등록 수송 WI §4–5와 native 읽기 감독·DISCOVERY 결과 전송 WI의 원 소유/종결 경계를 재사용한다. 이 문서는 source·미적용 SQL·RAM 구현 순서를 한정하며 새로운 사용자 정책이나 실제 실행 승인이 아니다. 이번 작성 소유는 이 문서 하나다.

## 1. 닫을 사용자 연결과 확인된 입력

동선은 `현재 보호 메타 조회 → 사람이 연속 구간 선택 → 기존 명령으로 고정 범위 요청 저장 → 같은 등록 실행기의 명시 획득 → 원 보호 prefix의 정상 읽기/종결 → 선택 원문 불변 보관 → HUMAN 보호 조회 → 6기준 검토/기존 승인·저장·이력`이다. SESSION_ONLY를 개별 SEND 귀속·자동 MATCH·WORK 허가로 바꾸지 않는다.

별도 서버 작성자가 확인한 HUMAN 입력은 기존 `readNormalUnderstandingResponse` command의 다음 payload다. 기준 commit에 이미 connector 수송까지 구현되었다는 뜻이 아니다.

```text
{assignmentRef,preparationRef,selection:{
  requestRef,resultRef,initConfirmationRef,tailRef,firstSequence,lastSequence,
  ranges:[{outputRef,sequence,payloadDigest,textBlocks,textBytes}]
}}
```

`selection.requestRef/resultRef`는 선택의 근거인 원 DISCOVERY 요청/정착 결과이고, 저장 응답의 새 `requestRef`와 혼용하지 않는다. 같은 command의 정확 재확인은 새 요청을 만들지 않는다. 확인된 응답은 APPLIED의 `data.status=NORMAL_UNDERSTANDING_RANGE_REQUESTED`, 새 `requestRef`, `PENDING_SOURCE/sourceAvailable:false/selectionAvailable:false`, 원 `expiresAt`다. 이 상태는 원문 준비·공개·선택 보관 완료가 아니다.

**connector GET/nonce/획득 영수증/POST envelope는 아직 미확정이다.** 서버 작성본의 정확 request snapshot/hash·원 DISCOVERY 근거·범위·현재성·만료를 확정한 뒤 TS/native decoder를 함께 결박한다. 예전 `NormalUnderstandingResponseRequest` 내부 형상이나 DISCOVERY_ACQUIRED를 새 wire로 간주하지 않는다. 목적 provider와 receipt 완결이 없으면 기존 503을 유지한다.

## 2. 원 소스에서 재사용할 것과 실제 공백

| 실제 경로/기준 위치 | 재사용 및 필요한 차이 |
|---|---|
| `apps/connector/runtime/normal-understanding-response-source.ts:92–160` | 원 chain/init/prefix·고정 tail, 앞/뒤 ref, 연속 선택과 ASSISTANT_TEXT/textHash 검산은 유지. 원 request/acquisition·선택 근거 fullref를 수송 결과와 정확 결박한다. |
| `apps/connector/runtime/normal-owned-spool-profile.ts:662–689` | DISCOVERY에는 native 재검산/close/비공개 seal이 있으나 SELECT는 TS projection 반환뿐이다. 기존 SELECT의 실제 worker 호출에 목적별 native 종결과 단회 seal을 연결한다. raw projection을 signer 권위로 받지 않는다. |
| `apps/connector/native/NormalExecutionSpoolProfileSource.cs:272–432` | 보호 fd/경로·row hash·START/init·summary·관리 원장·binding lock 검산과 원 child 종료를 재사용. 현 `ReadUnderstandingOutput/ReadDelegatedUnderstanding`은 DISCOVERY_METADATA 전용이다. 선택 요청 원값에서 고정 prefix 및 제한 text projection을 독립 도출하는 분기를 추가한다. |
| `apps/connector/native/NormalUnderstandingReadSupervisorSource.cs:33–59` | 같은 고정 image/출생·Anvil peer/epoch·원 handle·IO 종결·exit0·단회 Consume 유지. child stdout은 기존 유계 requestHash/bodyHash/ref 결과만, 원문 0. |
| `apps/connector/native/NormalExecutionCredentialSource.cs:378–418,520–530` | 제한 SDK parser, 같은 CLOSE의 단회 PREPARE, proof/nonce/bodyHash, PREPARED/SEND_STARTED를 재사용. 현재 SEND의 DISCOVERY_METADATA 양성 목록을 느슨하게 만들지 않고 확정된 SELECT 목적만 분리한다. 일반 Call의 raw POST 금지는 유지한다. |
| `apps/desktop/src/trust-enrollment-owner.cjs:176–239`, `apps/desktop/scripts/native-proof-runtime-entry.mts:145–172` | 같은 등록 owner·physical lease·slot, HOST_REQUEST_VALIDATED 뒤 원 물리 종료가 있는 경우만 전송 가능. 기존 명시 SELECT worker 호출에 붙이며 자동 poll/재시도·일반 IPC 우회는 없다. |

native는 원 SDK payload의 canonical **바이트 SHA**를 그대로 비교한다. 소수·지수 등을 C# 공통 Canonical로 재직렬화하여 다른 payloadDigest를 만들지 않는다. 제한 파서가 추출한 text/정수/ref만으로 TS와 동일한 SELECT projection 및 최종 envelope bodyHash를 독립 계산한다. 분류 또는 표시를 위해 원 bytes를 수정·마스킹하지 않는다.

고정 tail 이후 정상 append는 선택 prefix를 바꾸지 않는다. 따라서 요청의 고정 tail/fullref와 read 시작 때 현재 정착 summary를 별도로 검산한다. 최신 tail로 요청을 대체하거나 DISCOVERY의 전체 ranges/200 제한을 선택 밖 행에 그대로 적용하지 않는다. 선택 전 prefix의 필수 init/chain/hash 검산은 생략하지 않으며, 선택 내부의 미지원·격리·빈/혼합 block은 건너뛰지 않고 전체 선택을 거절한다.

## 3. 분류·비밀 및 유한 공개 경계

실제 분류 호출선은 `native-proof-runtime-entry.mts:180`의 `sdk` → `normal-owned-spool-profile.ts:597–609`의 캡처한 `sdk.classify` → `normal-first-send-owner.ts:183` → `normal-sdk-session-output.ts:186–205`다. 정확 ORDINARY 이외는 보호 격리행이다. 현재 production 분류 알고리즘/호출자의 공급은 미연결이며 normal FIRST는 `normal-owned-spool-profile.ts:620`에서 SDK_CONFIGURATION_UNAVAILABLE다. 합성 ORDINARY 반환을 운영 분류 근거로 사용하지 않는다. **공급 부재·불명은 실제 원문 송신을 차단한다.**

기존 `apps/server/storage/sensitive-inspection.ts:2–8`은 알려진 private-key/Bearer/비밀 대입 표식만 검사하며 `complete:false/KNOWN_PATTERNS_RAW_BYTES`다. normal 출력에 연결되어 있지 않고 무표식은 비밀 없음 인증이 아니다. 전체 SDK canonical JSON과 추출 text는 검사 대상이 다르므로 동등하다고 추정하지 않는다. 이번 WI는 새 classifier/표식 규칙/자동 삭제를 발급하지 않는다. 기존 규칙의 재사용은 순수 부분과 정확 대상 바이트·현재 공급 근거를 확인한 별도 내부 연결에서만 하며 서버 전체 의존성을 connector에 끌어오지 않는다.

공개 후보는 검산한 assistant text와 원 outputRef/sequence/blockIndex/payloadDigest/textHash 및 고정 범위 경계뿐이다. SYSTEM_INIT·tool/하위 agent/error·SDK 전체 object·SID·프로세스/경로·env/Secret은 제외한다. assistant-only 및 ORDINARY는 본문 내 비밀 부재 증명과 동일하지 않다. 필수 판정이 없으면 반환/봉인/송신 0이다.

선택 parts/ref 최대200, 순번 최대10000, 원 row3MiB/channel64MiB는 기존 private 검산 한도다. 선택 canonical 자료와 최종 proof/metadata 포함 HTTP 전체 2MiB를 각각 검산하고 초과는 잘라 성공시키지 않는다. 보호 관리행에는 목적/ref/scope/hash/시간/종결의 유계 증거만 저장하며 text·auth·bearer·전체 SDK 원문을 추가하지 않는다. child stdout·진단/로그에도 원문 0. TS의 원 소유 메모리와 승인된 목적 HTTPS 본문만 선택 원문을 운반한다. 기존 보호 row 저장 경계는 변경하지 않는다.

## 4. 독립 작성 단위와 완료 기준

다음은 순차 배정 후보이며 한 번에 전체 파일 쓰기 권한을 부여하지 않는다. 매 단위에서 정확 경로·서버 동결 wire를 Main이 대조하고 이전 단위 지문을 보존한다.

1. **선택 획득과 원 native prefix 검산.** `normal-protected-get-client.ts`, `normal-owned-spool-profile.ts`, `normal-understanding-response-source.ts`, `NormalExecutionCredentialSource.cs`, `NormalExecutionSpoolProfileSource.cs`; supervisor 응답 exact 필드 변경이 꼭 필요할 때만 `NormalUnderstandingReadSupervisorSource.cs`. 서버의 실제 목적 획득이 있는 같은 slot/attempt/원 START만 read 가능. 요청 fullref/hash·선택 근거 resultRef·원 init/tail/범위는 보호 PICKUP/STARTED와 child requestHash에 포함되어야 한다. 모든 본문 접근 전에 원 최단 wall/monotonic 기한을 적용한다. 완료는 TS와 native가 같은 선택 bodyHash를 검산하고 원 fd/child exit0/parent 현재성 및 lock 회수까지 정상인 때의 비공개 결과다. 결과 없는 verifier만 추가하지 않는다.
2. **단회 준비·전송 소비.** 위 profile/credential과 `normal-credential-bootstrap-client.ts`, `native-proof-runtime-entry.mts`, `trust-enrollment-owner.cjs`의 기존 목적 메서드만 한정 변경. 원 CLOSE의 목적·request/acquisition·선택 원 source/hash와 PREPARED/packetHash를 결박하고 원 parent physical close 뒤 같은 slot의 SEND_STARTED를 정확 한 번 소비한다. 이전 DISCOVERY CLOSE나 과거 row 재조회에서 새 capability 발급 0. generic PREPARE/REQUEST/BEGIN 우회 0. 준비와 송신 host의 현재성·기한·취소를 각각 유지한다. 완료는 실제 caller에서 같은 원 bytes가 목적 frame에 들어가는 source/RAM 증거이며 서버 custody 성공을 대신하지 않는다.
3. **보호 보관·조회와 UI 소비(별도 서버/UI 작성).** `normal-understanding-read-{requests,acquisition,result,routes}.ts`, 목적 challenge·`0102_normal_understanding_responses.sql.pending`, UI04 `NormalUnderstandingDiscovery.tsx` 및 기존 이해 검토 소비선을 대조해 정확 경로를 별도 배정한다. 기존 metadata 정착을 text custody로 이름만 바꾸지 않는다. 동일 거래의 현재 HUMAN/OWNER/client/control/policy·등록/세대·원 요청/획득·nonce/receipt·정산·불변 선택 완결이 필요하다. 보호 조회 전까지 원문 공개 0. UI는 요청 대기/불명/보관 완료를 구별하고 같은 command 재확인만 제공한다. 새 보관의 실제 quota/ACL/불변성/FK 필요가 확인되지 않은 상태에서 표/역할/GRANT를 선결하지 않는다. normal 검토는 실제 responseRef/partRefs와 기존 6기준·승인/이력 검산이 연결될 때만 가능하다.

## 5. 필수 합성·정적 검수와 중단

| 직접 반례/정상 | 합격 기준 |
|---|---|
| 같은 원 prefix 정상 선택, 고정 tail 뒤 추가 출력 | 같은 before/after·parts·textHash·bodyHash, 새 출력/전체 대화/WORK 주장 0 |
| request/result/acquisition fullref, row/hash·scope·slot/attempt·START·init·tail·순번/블록 교체 | native read 또는 seal/서명/전송 전에 거절; 임의 TS digest/boolean 0 |
| 분류 부재/불명·격리·도구 혼합·필수 누락·한도/UTF8 초과 | 자동 삭제·스킵·기본 ORDINARY 없이 원문 송신 0 |
| callback0/2회·늦은 완료·owner/등록 회수·원 expiry100ms와 wall 정체 | 원 최단 wall/mono 유지, UNKNOWN 보존, 후속 준비/재시도 0 |
| fd/child/host close 불명, OPERATION_UNKNOWN/생략 disposition | 정상 CLOSE/단회 전송 가능 상태 발급 0; 관리행/예약 임의 회수 0 |
| 동일 원 준비 재입장·다른 packet·동시 SEND·chunk 오염 | 단회 소진, 추가 효과 0; 정확 원 packet의 서버 명시 재확인과 새 현재성 발급은 구별 |
| challenge/POST/정착 실패·COMMIT 불명 | 서버 원자 rollback 또는 UNKNOWN, 새 요청/nonce/원문 자동 생성 0 |

기존 직접 시험 `tests/unit/FN09/normal-understanding-response-source.test.ts`, `normal-understanding-native-supervision.test.ts`, `normal-understanding-read-transport.test.ts`, `tests/desktop/normal-execution-credential-owner.test.cjs`, `normal-understanding-result-owner.test.cjs`에서 적합한 RAM fixture를 재사용한다. 새 경계의 RED→GREEN, 기존 DISCOVERY/일반 명령 회귀, 타입·공백 검사를 한정 실행한다. 실제 native 자식/C#을 띄우는 케이스는 실행하지 않는다. C# source 문자열/상태 대역의 합격은 C# 실행·DPAPI·OS physical close의 실증이 아니다.

분류 공급, connector exact wire, native 독립 hash/종결, 서버 text custody 중 하나라도 미결박이면 해당 단계는 unavailable/기존 503이며 metadata 성공으로 대체하지 않는다. 구현 의미가 A안을 넘는 새 공개/권한/보관 정책을 요구하면 그 delta만 Main에 보고하고 임의 활성화하지 않는다. 실제 PG/ACL·보호 파일·키·native/SDK/Agent·서비스/SSH 실행과 운영 적용은 이 WI에 포함되지 않는다. 롤백은 각 순차 단위의 정확 diff이며 기존 DISCOVERY와 이미 저장된 원 근거를 변환·삭제하지 않는다.
