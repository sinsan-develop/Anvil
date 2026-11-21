# FN09 최초 이해응답 — 목적 한정 등록 수송 구현 지시 r1

기준: `643f8e36`. 근거: 신산님이 채택한 A안 `docs/contracts/FN09_NORMAL_INITIAL_UNDERSTANDING_RESPONSE_CANDIDATE.md`, SHA256 `9ED4E1C28953B905D99D22A38AF5B51F57E5DED46BD481B7AE3B2520468DF588`; 채택 기록 `docs/WORK_STATUS.md:22165–22179`. 후보의 역사적 DRAFT 표시는 원본 보존한다. 이 문서는 승인된 A안 안의 내부 순서·소유 경로를 구체화하며 실제 DB·권한·서비스·SDK·Agent 실행 승인이 아니다. 이번 작성 소유는 이 문서 하나다.

## 1. 지금 닫을 연결과 완료 구분

기존 보호 출력 생산자는 `normal-sdk-session-output.ts`이며 `NormalOwnedSpoolProfile`의 같은 등록/slot/FIRST attempt에만 원 스풀을 보유한다. 첫 A안 reader `normal-understanding-response-source.ts:40–108`는 원 prefix·init·chain·고정 tail 및 선택 text를 검산하지만, 아직 production private reader와 HUMAN 선택 요청을 공급받지 않는다. 이를 네트워크 raw SDK reader로 공개하지 않는다.

완료 동선은 `HUMAN의 현재 임무/CONTEXT_REVIEW 선택과 명시 요청 → 등록 executor의 목적 GET → 원 owner의 고정 범위 읽기·정상 close → 그 요청의 서명된 결과 POST → 같은 요청의 불변 보관 → HUMAN 보호 조회·6기준 매핑 → 기존 reviewUnderstanding/별도 승인·이력`이다. claim은 탐색 근거이며 응답 자체가 아니다. SESSION_ONLY를 개별 SEND 응답 또는 자동 MATCH/WORK 허가로 바꾸지 않는다.

첫 코드 단위는 아래 §7의 **현재 목적 공급자에 결박한 challenge 검산 경로**다. 완전한 목적 handler·포트가 없으면 새 target의 challenge 발행도 닫는다. 그 합격만으로 출력 수송·보관·최초 검토 또는 운영을 완료했다고 하지 않는다. 후속 단위는 현재 private owner에 실제 붙는 수송을 포함해야 하며, 출처 없는 normal boolean/provider를 추가하는 것으로 대체하지 않는다.

## 2. 기존 원 경계와 정확 변경점

| 기준 소스 | 재사용 / 목적별 추가 |
|---|---|
| `apps/server/http/connector-auth.ts:5–16` | av3ex1_ Bearer의 단일 raw Authorization, 대소·정확 값, Cookie 혼합 금지를 유지. routeOptions.url의 POST/GET 양성 목록에 아래 두 경로만 각각 추가한다. 일반 prefix 허용 금지. |
| `apps/server/modules/executions/execution-proof.ts:25–29,109–137` | executionTarget, normalRequestPath/Target, challenge 및 request signature가 동일 literal path를 검산. P-256/publicKey fingerprint, grant fullref, credentialGeneration, requestId, nonce, issuedAt 결박 유지. |
| `apps/connector/runtime/normal-credential-bootstrap-client.ts:104–124` | NormalOwnedCredentialPort/#call의 같은 owner·channel·credentialMetadata 및 GET/POST allowlist에만 추가. 기존 프레임/IPC/응답 상한 유지. |
| `apps/connector/native/NormalExecutionCredentialSource.cs:72,286–293` | Target/Call 경계도 같은 method/path/query/body 및 2MiB 본문 한도를 검산. caller 경로·env·SID·스풀 경로 일반화 금지. |
| `apps/server/modules/executions/normal-request-challenge.ts:10–25`; `normal-exchange-challenge.ts:30–53,82–146` | 실제 TLS/Host/Bearer, credential 조회, readCurrent, 정상 등록 proof 및 기한을 재사용. 동일 credential의 live nonce 1개 제한을 해제하지 않는다. |
| `db/migrations/0090_normal_observations.sql.pending:100–137` | 최종 normal_request_challenge_valid의 method/path/query/bodyHash 양성 목록도 새 forward에서 목적 경로만 추가해야 한다. TS만 통과시켜도 실제 저장은 닫혀 있다. |
| `db/migrations/0097_normal_instruction_dispatch.sql.pending:550–573,805–811` | 최종 normal_command_consumption_valid와 receipt trigger kind 양성 목록은 현재 새 수송을 수용하지 않는다. 기존 observations/permit kind로 위장하지 않는다. 목적 영수증 검산과 같이 forward에서만 확장한다. |
| `apps/server/app.ts:68,76–95` | Fastify 전체 bodyLimit 2MiB 및 strict Ajv 유지. 새 route에서 상향하지 않는다. 기존 명시 옵션 조립 구조를 사용하며 main의 미공급 상태를 성공으로 치환하지 않는다. |

고정 executor 경로:

- GET `/api/v1/connectors/:cid/executions/:eid/understanding-response-read`
- POST `/api/v1/connectors/:cid/executions/:eid/understanding-response-read/:requestId/result`

`:cid/:eid/:requestId`는 원 검산한 canonical UUID다. routeOptions template와 실제 raw path를 각각 검산한다. `%`, 추가 segment, 다른 대소, query, trailing slash와 혼합 인증을 허용하지 않는다. GET은 body=null/query={}의 고정 hash, POST는 query={}와 **동일 업무 requestId 및 canonical 전체 bodyHash**를 사용한다. proof의 requestId와 업무 requestId는 역할이 다르므로 이름이 같다고 대체하지 않는다. HEAD 자동 등록도 열지 않는다.

## 3. 요청·현재성·nonce와 재확인

1. HUMAN 요청 생산은 기존 Access callback의 실제 인증·재인증·현재 OWNER/client/control 세대와 승인된 A안의 명시 PROJECT 읽기 목적을 검산한 뒤만 가능하다. DENY 우선, REQUIRE_APPROVAL 미지원은 유지한다. executor의 av3ex1_로 HUMAN 권한을 발급하지 않는다.
2. 업무 요청은 project/execution/generation/registration/assignment/slot/grant/START/FIRST attempt/session binding, CONTEXT_REVIEW bundle·subject·basis·필수 수신 근거와 원 선택 범위를 불변으로 결박한다. 원 SID 문자열·경로·도구 본문을 포함하지 않는다. 현재 등록 및 요청자가 서버에서 소유한 근거와 대조하며 caller가 넘긴 scope를 그대로 신뢰하지 않는다.
3. 같은 scope에 단일 in-flight 업무 요청만 둔다. 고정 범위/init/tail을 아직 선택·발급할 근거가 없으면 일반 latest를 추측하여 요청을 생성하지 않는다. UI 최초 범위 탐색과 요청 생산의 DB 원자성은 §7 후속 단위에서 연결해야 한다.
4. GET과 POST는 각각 기존 EXECUTION_REQUEST challenge/nonce/proof를 사용한다. 기존 live nonce 1개 제한·서명·정확 target·bodyHash·credentialRef를 보존한다. 기존 nonce를 다른 메서드/본문/업무 요청에 재사용하지 않는다.
5. `readCurrent`/`normal_exchange_current`의 원 주체·제어·grant·등록·credential generation·만료·회수·예산 및 잠금을 전후 재사용한다. 원 SQL `0084_normal_exchange_challenge.sql.pending:3–43`의 current row/lock을 별도 DTO/claim flag로 대신하지 않는다. 별도 HUMAN 읽기 정책과 맥락 현재성도 수송 시작과 결과 정착에서 재검산한다. 30초 및 모든 원 기한의 최솟값, 취소/owner 상실을 유지하고 연장하지 않는다.
6. `normal-command-pages.ts:150–199`의 같은 packet 재확인 방식은 재사용 가능하다: 원 challenge 소비 v2 + 영수증 hash/target/packetHash/credential/binding을 대조하고 같은 결과만 반환한다. 다만 새 목적의 영수증 kind·정확 선택 snapshot 검산이 먼저 필요하다. 기존 page의 wait/rollback/retry 루프는 복제하지 않는다.
7. 동일 packet의 명시 재확인도 현재 credential/current/HUMAN read 자격을 다시 확인한다. 원 요청/init/tail/범위/text/witness가 달라지면 충돌이며 새 snapshot을 덧붙이지 않는다. 과거 영수증은 새 허가가 아니다. 만료·중복·UNKNOWN 뒤 자동 재시도·nonce/업무 요청 재발급·후속 WORK는 없다. COMMIT 불명은 rollback 응답으로 정상화하지 않는다.

## 4. private 읽기와 등록 proof의 출처

`normal-owned-spool-profile.ts:333–417`의 `#outputPorts`는 원 owner와 native reserve/resume/settle의 실제 producer 소비선이다. `normal-start-file-store.ts:83–145`의 `outputExclusive`는 private journal brand, strict close, 실제 원 fd/신원·연속 행·길이 검사를 한다. 같은 profile의 `#openRoot` 및 native SPOOL_CLOSE 정상 결과까지 끝나야 읽기 완료다. 파일 store close 하나만 전체 owner close로 승격하지 않는다.

새 읽기는 기존 outputSource의 등록 worker/source/slot 메모리와 현재 output origin에 결박한다(`normal-owned-spool-profile.ts:421–491`). 일반 `exclusive('sdk-session-output')`, caller가 만든 journal 또는 public raw reader를 열지 않는다. 새 요청 ticket은 같은 등록·slot·FIRST attempt·scope·기한의 원 source만 단회 소비한다. 다중 callback, body 완료 전 반환, close 불명, 중간 owner/lease/cancel/expiry 상실은 결과를 봉인하지 않는다. read 동안 producer와 같은 output 잠금 경계를 유지하고 고정 tail 이후 append는 선택 prefix를 바꾸지 않는다. 기존 reserve/read-close의 `SDK_READ_CLOSED` challenge는 쓰기 continuation이며 HUMAN read 권위로 재해석하지 않는다.

최초 reader가 이미 검산하는 canonical SDK 원문·SID digest·init confirmation·prefixDigest·sequence/previousRef·tail 및 exact ASSISTANT_TEXT 선택을 원 owner 안에서 수행한다. 원 canonical SDK body 전체를 서버로 보내기 위해 reader의 64MiB prefix를 네트워크 DTO로 바꾸지 않는다. 선택 text와 그 위치·참조·payload digest를 내보내되 원 SDK object, raw base64 rows, init cwd, SID, 도구 입력/출력·비밀은 내보내지 않는다. 허용 literal text라도 A안의 비밀/미지원 내용 제외 조건을 통과하지 못하면 송신하지 않는다.

중요한 출처 차이: 선택 text만으로 원 canonical SDK row/payload hash를 서버가 재계산할 수 없다. 원 prefix 검산·정상 close를 완료한 **같은 private source의 일회 결과**가 동일 등록 요청의 서명 대상에 결박됐음을 제품 호출선에서 보장해야 한다. 일반 caller가 text/base64와 자가 hash를 만들어 정상 credential signer에 넣는 경로는 이 조건을 충족하지 않는다. 기존 registered proof가 인증하는 것은 등록 주체와 서명 bytes이며, 그 자체로 private 파일 읽기 사실은 아니다.

따라서 후속 구현은 private 결과 ticket → exact POST preparation/bodyHash → 같은 owner native credential call의 실제 소비를 함께 연결한다. 원 close 증거가 없는 generic `verified:true`/interface 반환을 정상 marker로 받지 않는다. 이 결박의 실제 형태·회수 위치를 코드/정적 native 검사로 확인하기 전에는 정상 공급자 옵션을 main에 켜지 않는다.

## 5. 유계 수송과 불변 custody

- UTF-8 **전체 HTTP envelope** 2MiB 이하. text만 2MiB 뒤 proof/metadata를 추가해 넘지 않는다. 기존 reader의 선택 범위/부분 최대200·prefix 행10000/channel64MiB·row3MiB는 private 검산 상한이며 wire 상한을 늘리지 않는다.
- request snapshot/fullref, exact scope의 비밀 없는 binding, 고정 init/tail/범위·before/after 및 text parts의 원 outputRef/sequence/blockIndex/payloadDigest/textHash를 닫힌 형상으로 검산한다. 임의 key/중복·정규화 치환·다른 block·겹친 범위·빈 text/필수 부족은 거절한다. 수송 witness의 필드 목록은 구현 시작 시 현재 producer의 실제 산출에 맞춰 고정하며 없는 native witness 값을 invent하지 않는다.
- 동일 수신 거래에서 request 불변값·current·등록 proof·nonce와 원 선택 custody를 검산하고 목적 영수증/소비를 원자 정착한다. 원 스풀과 PG의 분산 원자성을 주장하지 않는다. 정착 전 source close 실패는 저장0, PG COMMIT 불명은 새 요청/선택 자동 생성0이다.
- 기존 `execution_challenges`/`execution_receipts`는 nonce/metadata 토대다. 선택 원문 영속화는 원 quota/소유/불변/FK·보호 조회 목적을 대조한 뒤 결정한다. 기존 표에 임의 raw를 넣거나 새 표/GRANT가 반드시 필요하다고 선결하지 않는다. 해당 DDL/정산 경계가 닫히기 전 receipt만으로 선택 원문 보관 성공을 발급하지 않는다.
- HUMAN 조회는 같은 현재 임무 선택의 권한과 역사 고정 참조를 분리한다. 역사 보관의 반환이 현 CONTEXT_REVIEW/current permission 또는 WORK를 발급하지 않는다. 기존 reviewUnderstanding/일회 승인/6기준 매핑·이력 검산은 그대로이며 normal marker에 실제 새 custody가 필수다.

## 6. 회귀·실패 검수표

| 합성/정적 조건 | 기대 |
|---|---|
| 실제 기존 challenge handler + 등록 proof의 새 GET/POST target | 목적 공급자·handler 완결 전 발행0. 공급된 실제 목적 현재성 검산과 exact target을 통과한 경우만 발행 경로 검산. 기존 경로·same-packet 의미 불변. |
| Cookie·중복 Authorization·다른 route·HEAD·교차 credential/등록/주체/세대 | source read 및 결과 저장0. 기존 auth 실패 의미 유지. |
| owner/slot/FIRST attempt·init/prefix/tail·메타 교차, self-hashed raw 또는 forged normal provider | 정상 선택 반환/POST0. 임의 공급 DTO를 신뢰하지 않음. |
| 원 callback 0/2회·늦은 callback·close 불명·기한/취소·lease 상실 | ticket 회수/정상 봉인0. 원 owner의 UNKNOWN 유지. |
| 전체 envelope 2MiB 경계·UTF-8·추가키·중복·빈/겹친/빠진 부분 | 한도 이내 정확형상만 수용. raw·경로·SID·도구/비밀 예외·로그 유출0. |
| 원 packet 재확인·tail/bytes 변경·동시 두 요청·정책/제어 전환 | 같은 현재 자격+같은 고정 결과만; 충돌/만료 후 새 요청·허가 발급0. |
| receipt/nonce/custody 일부 쓰기 및 COMMIT/ROLLBACK 불명 | 원자 rollback 또는 UNKNOWN. 정상 성공·자동 재시도·다음 명령0. |
| HUMAN 6기준 부족·다른 응답/기준/subject·최초 review CAS 경합 | 기존 검토/승인 거절. SESSION_ONLY로 SEND 귀속·MATCH/WORK를 만들지 않음. |

RAM 검수는 실제 credential/proof 함수·handler·private owner 호출의 source 경계를 통과시켜야 한다. 실제 PG 지연제약/ACL·native C#·SDK·등록 서비스·사용자 브라우저·Agent는 별도 미검증이며 합성 PASS로 대체하지 않는다.

## 7. 제안하는 순차 소유 파일과 첫 착수점

**S1 — 기존 production challenge verifier에 닫힌 목적 target 검산을 실제 연결.** 다음 파일의 정확 경로 인식과 목적 공급자 현재성 검산을 함께 연결한다. source/nonce 현재성·관측/permit 의미는 그대로다. 새 target의 문법 지원만으로 credential authorizer를 먼저 열지 않는다.

- `apps/server/http/connector-auth.ts`
- `apps/server/modules/executions/execution-proof.ts`
- `apps/server/modules/executions/normal-exchange-challenge.ts`: 새 두 target에서만 완전한 목적 handler/포트와 실제 현재 요청 근거를 요구. 공급 부재·미결박이면 challenge/receipt 쓰기 전 거절; 기존 target은 기존 분기를 그대로 사용. 새 포트의 boolean 자기 주장이나 GUC 단독으로 허가하지 않는다.
- `apps/connector/runtime/normal-credential-bootstrap-client.ts`
- `apps/connector/native/NormalExecutionCredentialSource.cs`
- 새 forward `db/migrations/0102_normal_understanding_response_transport.sql.pending` 후보: 착수 때 번호 미점유를 재확인하며 최신 normal_request_challenge_valid의 목적 target 조건은 실제 목적 요청/receipt 완결과 결박되어야 한다. 현재성 거래 근거가 아직 없으면 새 target 허용 SQL은 활성 상태로 추가하지 않고 기존 거절을 보존한다. 기존 migration 파일은 변경하지 않는다. receipt 활성화는 S3의 완결과 함께만 한다.
- 직접 기존 시험 `tests/unit/FN08/execution-proof.test.ts`, `normal-request-challenge-journey.test.ts`, `normal-request-challenge-sql.test.ts`, `normal-credential-bootstrap-client.test.ts`, `tests/unit/FN06/normal-execution-credential-native.test.ts`; 실제 prehandler를 경유한 허용/혼합 인증 거절도 기존 RAM handler harness에서 검산한다.

이 단위의 production caller는 `normal-exchange-challenge.ts`의 실제 challenge route → `verifyNormalCommandChallengeRequest` → `normal_request_challenge_valid`다. 목적 target을 인식하더라도 read/result handler·정확 요청/현재성 포트가 아직 없으면 challenge 발행부터 실패로 닫힌다. 목적 공급자를 단순 등록했다고 활성화하지 않고 실제 같은 요청·원 binding·기한 검산을 요구한다. 새 GET/POST를 성공 stub으로 등록하지 않는다. S1 완료 증거는 경로/검산 정합과 미공급 발행0·기존 target 결과 불변으로 제한한다.

**S2 — 원 producer부터 private 정상 읽기·봉인 결과까지.** `normal-owned-spool-profile.ts`, `normal-start-file-store.ts`(기존 private read 재사용만으로 충분하면 변경0), `normal-understanding-response-source.ts`(원 prefix 검사 의미 유지), `normal-protected-get-client.ts`, `normal-protected-post-client.ts`, `native-proof-runtime-entry.mts` 및 필요한 native private close/sign 소비 경로를 별도 배정한다. actual worker 등록 → 명시 read request → 같은 owner read/close → one-shot result ticket → proof POST의 최소 수직 소비를 한 단위로 검수한다. 이 단계는 실제 dispatcher/SDK를 새로 활성화하지 않는다. server 모듈을 connector가 통째로 import하도록 의존성을 넓히지 않고 순수 reader의 소비 위치는 구현 전 좁혀 고정한다.

**S3 — 요청·수신·custody의 실제 거래 및 UI 최초 선택.** 신규 목적 route/service, `app.ts` 명시 조립, S1 forward의 목적 receipt/nonce 완결, 기존 이해 store/current resolver와 UI04 최초 선택 호출을 순차 배정한다. HUMAN request producer, scope별 단일 in-flight, 정상 source만의 custody 및 보호 조회가 모두 필요하다. 역사 receipt만으로 현재 read를 대체하지 않는다. 새 테이블/역할의 필요는 이 단계의 기존 표/정산/ACL 대조 결과로 정하고 임의 보조 저장을 먼저 만들지 않는다. 마지막에 기존 understanding review/approval 시험과 최초 선택→보관→검토→고정 이력 RAM 흐름을 연결한다.

이번 문서에서 S2/S3의 미확정 구현 필드나 SQL 설치 권한을 발급하지 않는다. 이미 채택된 A안 내부 구현을 이어가되 실제 producer/guard에 닿지 않는 verifier 반복으로 완료를 표시하지 않는다. Main이 S1 허용 경로와 시험 범위를 고정한 뒤 단일 writer로 착수한다.

## 8. rollback과 현재 산출물

이번 변경은 본 문서 한 파일이다. 제품/SQL/시험/권한 변경 및 실제 실행0. S1 이후 rollback은 해당 forward가 미적용인 source 상태에서 정확 diff 역적용이며 기존 경로·hash·승인 이력은 보존한다. 실제 SQL 적용 또는 보호 자료 정착 이후 rollback/자료 보존은 적용 실행안에서 별도로 검산하며 삭제를 기본값으로 두지 않는다. WORK_STATUS/CHECK·Git은 Main 소유다.
