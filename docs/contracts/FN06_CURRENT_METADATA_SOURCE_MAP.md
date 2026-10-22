# FN06 현재 metadata 원자료·소유 관측 경계

## 2026-10-23 D1 응답 목적의 명시 7필드 투영

- `apps/connector/runtime/sent-process-current-archive.ts`의 `SyntheticSentProcessCurrentArchive`는 기존 `SyntheticSentProcessArchive`를 구현하지만 기본 resolve source는 null이다. 내부 source는 서버 current resolver의 합성 BASIS_ONLY를 반환하는 계약이며 실제 RPC/서버/producer는 아직 등록하지 않았다.
- 입력 선택의 envelope/원 시도·permit·부모/지시 hash와 anchor/binding을 고정하고 source 결과의 전 false 표식·실제 공급자 미확인 목록을 요구한다. 같은 응답의 전후 두 조회만 허용하며 request/관측 ID 재사용, head ID 교체/세대 회귀, 범위 변경, timeout/취소/late 응답을 거절한다.
- 반환은 기존 7필드 `{anchor,binding,anchorHeadRef,bindingHeadRef,revoked,readAt,expiresAt}`만이다. 이 명시 투영은 사실의 osFence 상태나 writerState를 바꾸지 않는다. 기존 `SyntheticSentProcessEvidence`의 별도 서버 현재성/OS observer 대조가 그대로 필요하며 결과는 SYNTHETIC_MATCHED와 권한 false다. 최상위 BASIS_ONLY를 무조건 archive로 쓰는 경로는 여전히 거절된다.
- 실제 current resolver 코드의 fake-DB 결과를 두 번 투영한 시험과 기존 응답 consumer/별도 합성 observer 시험은 구분한다. 둘을 실제 DB·OS·Agent 종단 검증으로 부르지 않는다. 실제 fresh producer/현재 권위·source WRITE 격리·키/서비스 활성화는 미완료다.

## 2026-10-23 D1 current resolver — 새 관측 원자료의 합성 대조

- 새 `ownership-current-resolver.ts`는 입력 scope와 `{preparationRef,selection}`을 소비하며 원 AUTO 준비/현재 HUMAN·정책/등록을 같은 transaction에서 읽는다. 기본 fresh 포트는 null/connect0다.
- 서버가 DB clock의 `notBefore`, 유한 기한(최대10초), readId, exact selection/selectionHash를 만든다. 합성 `observeAndAccept` 포트는 query만 가능한 같은 transaction facade를 받는다. 자체 BEGIN/COMMIT/release는 허용하지 않는다. **실 producer는 아직 없으며 기존 own-transaction issuer/archive를 그대로 중첩 호출해 이 포트를 구현한 것이 아니다.**
- 포트가 반환한 새 request/observation fullref를 DB 원본과 대조한다. CURRENT request/observation 시각은 server read 시작보다 엄격히 뒤여야 한다. 저장 chain 최대200과 head를 원 준비부터 재구성하고 회수/UNKNOWN·다른 세대·원 binding/nonce/등록키 서명·최종 현재 권한/slot/기한을 검사한다. 이전 관측에 새 readId만 붙이는 것은 거절한다.
- 무응답/취소/pending query 뒤 producer 실패는 연결을 정상 재사용하지 않고 폐기를 요청한다. 닫힌 facade는 늦은 DB 호출을 차단한다. 실제 PG 폐기/잠금 해제 효과는 미검증이며 COMMIT 시도 후 불확정은 UNKNOWN이다.
- 반환은 `SYNTHETIC_OWNERSHIP_CURRENT_BASIS_ONLY`이며 inner `archive`가 기존 anchor/binding 7필드 **후보**다. 최상위 BASIS_ONLY를 기존 `SyntheticSentProcessEvidence`에 넘기면 거절하는 소비 반례를 확인했다. 명시 assembler/실제 fresh producer·등록·현재 OS/실writer·회수/출처/source WRITE 공급자가 아직 없어 이 후보를 VERIFIED_CURRENT/OWNED로 승격하지 않는다.
- 실제 DB/SQL 적용·native/helper/OS·키·서비스·Agent 실행0. REQUIRE_APPROVAL 미연결 차단/선택변이 NOT_EXECUTED·SQLpendingM1/원 QA 실패를 보존한다.

## 2026-10-23 D1 요청 발행 source — 합성/실권위 구분

- `ownership-request-issuer.ts`의 `SyntheticPgOwnershipRequestIssuer`는 현재 AUTO 원준비 receipt reader를 같은 transaction에서 전후 소비하고 project 준비 slot·exact tail/head 및 서버 nonce/request 저장·COMMIT 후 반환을 조립한다. 기본 evidence 포트는 null이며 연결 전에 UNAVAILABLE다. 공개 route/operation/실제 공급자 등록은 없다.
- 내부 포트 입력은 purpose `OWNERSHIP_SYNTHETIC_PREPARED_INPUTS`, transport `SYNTHETIC_ONLY`, exact scope/preparationRef, writer `{claim:SYNTHETIC_NONE,generation,evidenceRef,predecessorRef,reclaimRef}`, candidate `{anchor,sourceRef,rootId,hostHash,workerHash,runId,processGeneration}`, checkedAt/expiresAt·실행/송신 false다. predecessor/reclaim은 둘 다 null 또는 둘 다 fullref다. 이는 실제 lease NONE/회수·후보 출처 진위가 아니며 bare NONE/REAL·실권한 true를 거절한다.
- 현재 근거는 provider await 뒤 DB clock으로 검사한다. 최초·최종 정확 writer/candidate와 원준비 정책/등록/원 기록이 같아야 하며 저장 요청 수명은 최종 근거 기한을 넘지 못한다. 최초/BINDING 뒤 CURRENT도 원 head/anchor를 유지한다.
- 성공 purpose는 `SYNTHETIC_OWNERSHIP_REQUEST_COMMIT_ONLY`; `preparationAuthorized/observationRequestAuthorized/executionAuthorized/dispatchPerformed` 모두 false, missingEvidence는 `VERIFIED_WRITER_NONE_OR_RECLAIM,CANDIDATE_PROVENANCE`다. 실제 writer 권한·Agent 전달/실행이 아니다.
- BEGIN 취소/포트 변경은 rollback, rollback 불명은 연결폐기/ROLLBACK_UNCONFIRMED, COMMIT 시도 후 오류·취소·응답 손실·release 실패는 COMMIT_UNKNOWN이며 자동 재발행0이다. COMMIT 지연 client elapsed 검사는 보수적 보조 검사이며 SQLpending M1의 서버 COMMIT 기한 보장을 해결하지 않는다.
- 기존 REQUIRE_APPROVAL 미연결 차단과 범용 allowlist는 그대로다. 실제 승인 발급/소비·DB SQL/권한/키·native/OS·서비스·Agent 실행은 하지 않았다. 합성 시험·source 일부를 FN06 완료로 표시하지 않는다.

## 후속 source 보완 — 응답 예약 미생성

아래 표는 조사 당시 구현의 기록이다. 후속 source에서 기존 current는 유지하고 명시 currentReadOnly를 분리했다. 응답용 Bound 조회는 이 포트를 필수로 요구하며 PG 분기는 같은 현재 검사를 공유하되 정확히 존재하는 credential 예약만 읽는다. 부재 때 생성하지 않고 거절하며, 기존 current()를 읽기 전용으로 위장 호출하지 않는다. 실제 DB/OS 검증은 아직 없다.

PMO는 권장 A를 내부 SYNTHETIC_ONLY source 계약/소비·합성 반례 범위로 선택했다. OS 소유 기록과 command/permit 사건 결박을 분리해 원 osFence anchor의 fullref/hash를 보존하고 순환 self-hash를 만들지 않는다. 원 보관 fullref와 별도 일회 OBSERVE를 대조하는 상세 계약은 다음 선행이며 실제 보관/관측/서버 수용 포트 부재를 명시한다. 실제 권한·native/OS·등록/키/root/ACL·DB/Agent 실행 승인은 아니다.

- 기준: `codex/av3-stage-b`의 `d614956b92964049ee16ec898046868726a359fa` 이후 읽기 조사. 상태: **현재성 공급자 부분 구현 / 실제 OS 소유 관측 연결 미구현**.
- 이 문서는 기존 승인 source 조사와 결정 요청이다. 새 권한·공개 API·SQL/schema·실행·기존 거절을 해제하지 않는다.

## 기존 원자료와 실제로 확인하는 범위

| 원자료 / 코드 | 현재 확인 범위 | 현재 metadata에 그대로 채택할 수 없는 부분 |
|---|---|---|
| `apps/server/modules/executions/execution-challenge-store.ts`의 기존 tx current | DB의 현재 HUMAN/session/client, project/control·명시 정책/예산, grant 회수/만료, host key 결박을 같은 tx에서 재대조 | source/OS는 저장 grant binding이다. current는 credential 예약이 없으면 INSERT도 수행하므로 일반적인 읽기 전용 source로 오인하지 않는다. 이번 실제 DB 실행은 없다. |
| `execution-instruction-store.ts`의 current | 주입된 `SyntheticInstructionQueueFacts.current`를 소비 | concrete facts resolver는 조사한 제품 코드에서 발견되지 않았다. 저장 snapshot을 현재 fact로 복사하지 않는다. |
| `provider-send-current.ts`의 응답 전용 조회 | 위 계약의 basis와 원 THREAD/permit/소비 nonce·주체/기한을 결박 | 주입 fact/OS 제공자의 진위까지 새로 만들지 않는다. |
| `execution-material-receiver.ts`의 instructionSource | 기존 수신 부분/원 receipt/바이트·해시를 다시 읽는다 | 보관 자료의 일치가 OS 소유권·현재 쓰기 허가가 아니다. |
| `execution-observations.ts`와 observation store/spool | 원장 무결성·연속 ACK와 공급자 주장 저장/조회 | 모든 기록은 `PROVIDER_CLAIM_ONLY`, ACK는 `writerReleaseVerified:false`다. STARTED/HEARTBEAT/STOPPED를 현재 OWNED·회수 완료로 승격하지 않는다. |
| `runtime/windows-host.ts`의 `openOwnershipQaHost` / `native/OwnershipHost.cs` | 고정 QA의 Job/process identity와 OBSERVE 형식 구현 | 실행은 고정 2026-10-17 만료 lease·QA run/profile/path에 묶여 있다. 현재 프로젝트/Agent로 전용·자동 실행하지 않는다. `fileSandboxVerified:false`이며 process 관측을 파일 쓰기 격리 증명으로 쓰지 않는다. |
| `execution-instruction-client.ts`의 verifier | current/permitCurrent 소비 인터페이스 | concrete 구현/실제 OS 관측-서버 osFence evidenceRef 매핑은 발견되지 않았다. |

## 필요한 정확한 결정

권장 A: **내부 source 계약만 상세화**한다. 기존 `OwnedProcessRef`의 run/generation/job/PID/startTicks/executableHash와 현재 프로젝트/실행·세션/원시도·osFence evidenceRef를 어떤 보관 레코드와 독립 OBSERVE 결과로 대조할지 정한다. 기존 QA host를 전용하거나 새 호스트를 실행하지 않는다. OS 관측 부재·불일치·오래됨·중지/회수·다른 세대는 metadata 생성 실패로 남긴다. `fileSandboxVerified:false`로 자료 쓰기 격리를 인증하지 않는다. 이 계약 작성/소비 source와 합성 반례까지 먼저 진행하고 실제 host/native/등록·root/ACL·키·DB/Agent 실행은 별도 정확 범위로 유지한다.

대안 B: OS current 제공자는 미구현 상태로 보존하고, 이미 존재하는 서버/자료·보호세션 연결을 부분 구현으로 남긴 채 독립 승인 기능을 진행한다. 실제 Agent 연결 준비 완료는 주장하지 않는다.

금지 대안: pre snapshot 복사, 기존 provider 관측/QA 과거 PASS의 현재 OWNED 승격, 만료 QA lease·옛 PID/Job 재사용, 원장/검사 기준 완화는 선택지가 아니다.

현재 확인은 파일 읽기와 참조 검색뿐이다. 실제 OS/helper/native/서비스/DB/Agent 호출·권한 변경0이며, 이 조사 결과를 실제 소유 관측 PASS로 기록하지 않는다.
