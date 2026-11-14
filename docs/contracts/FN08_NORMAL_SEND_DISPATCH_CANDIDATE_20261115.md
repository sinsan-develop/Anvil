# FN08 normal SEND 저장·자료 전달·일회 소비 후보 A

상태: 미채택 후보. 제품 구현 지시나 실제 실행 승인이 아니다.
기준: PR114 main `12f4b58a7111c400bbc7a4c98f103a7ad9653831`, 작업계획 FN07/FN08 및 채택 D1. 기존 normal START/permit과 합성 SEND는 보존한다.

## 1. 목적과 이번 차이

이미 저장·허가된 사용자 지시를 normal 실행 명령으로 보관하고, 같은 실행기의 명령 조회·보호 자료 조회·명령별 일회 permit으로 연결한다. START 맥락 전체를 새 지시로 만들지 않는다. 이 서버 연결은 실제 Query 생성·도구 실행·중지 완료와 다르다.

새 의미는 normal SEND 판별값, 원 START 부모 결박, 등록된 SEND 원문에만 한정한 보호 읽기, SEND별 normal permit이다. 새로운 endpoint·역할·일반 원문 조회 권한·별도 admission·표는 추가하지 않는다. 실제 SQL 적용·권한 부여·키·서비스·SDK/Agent 실행은 제외한다.

## 2. 기존 HUMAN 명령과 원 주체

기존 프로젝트 commands POST의 `queueExecutionCommand`를 사용한다. `targetId=executionId`, `expectedVersion=executionGeneration`, `baselineRefs=[]`, `approvalRef=null`을 유지한다. payload는 기존 SEND 형상인 `grantRef/sessionBindingRef/instructionRef/partsRef/permissionPolicyRef/budgetPolicyRef/reason`이다. START payload와 닫힌 union으로 구분하고 혼합·추가·누락을 거절한다.

명시 normal SEND 앱 설정이 없으면 등록하지 않는다. 현재 HUMAN user/client/session/credential/control 5개 값이 원 grant 주체와 모두 같아야 한다. 현재 회원·제어·정책·등록·ACTIVE grant·SEND_INSTRUCTION 허용·IDLE·source 접근·예산을 검산한다. 최근 회수 연산의 다른 OWNER 또는 EXPIRED 허용을 가져오지 않는다. 기존 DENY/REQUIRE_APPROVAL 거절과 별도 승인 없는 경로는 유지한다.

## 3. 불변 저장 및 응답

| 위치 | 값 |
|---|---|
| snapshot transport | `NORMAL_PROTECTED` |
| snapshot state | `NORMAL_INSTRUCTION_QUEUED` |
| HUMAN receipt 외피 | 기존 `APPLIED` |
| receipt data.status | `NORMAL_INSTRUCTION_QUEUE_STORED` |
| queue/receipt flags | `executionAuthorized:false`, `dispatchPerformed:false` |
| outbox | 기존 `EXECUTION_NORMAL` / `PENDING` |
| envelope operation | 기존 `SEND_INSTRUCTION` |
| envelope payload | 기존 `{sessionBindingRef,instructionRef,partsRef}` |

기존 instruction intent의 scope/requestHash/currentBinding/reservationRef/reason/queuedAt/expiresAt을 유지한다. receipt data.ref는 SEND record ref, data.snapshot은 불변 intent다. 다른 완료 flag를 새로 참으로 만들지 않는다.

서버가 같은 grant의 유일 원 START command/receipt/audit/outbox를 읽어 `currentBinding.parentStart={commandRef,envelopeHash,authorizationReceiptRef}`를 파생한다. caller는 부모를 선언하지 않는다. project/execution/generation/grant·등록·assignment·논리 session·connection/environment/capability/source scopes를 비교한다. 원 START fact의 agentSession.sessionRef가 SEND sessionBindingRef와 같아야 한다. SDK SID는 이 값이 아니다.

SEND context.authorizationReceiptRef와 context.budgetRef는 SEND 자신의 영수증·예약이다. START의 영수증·예약 또는 원 grant fact의 budget과 같다고 강제하지 않는다.

같은 project 잠금/인증 거래에서 현재 주체·원 grant/START를 검산하고 replay를 판별한다. 새 명령만 STOP fence·IDLE·예산/저장량 예약·자료 등록을 거쳐 command/receipt/audit/reservation/execution command/material/outbox를 함께 저장한다. COMMIT 전에 원 graph·현재성·최단기한을 다시 대조한다. 외부 원문 공급은 잠금을 유지한 임의 비동기 callback으로 호출하지 않으며 기존 보호 read 거래 경계를 따른다.

같은 commandId/hash는 현재 조회 권한 아래 원 receipt를 반환한다. BUSY 자체로 원 replay를 막지 않지만 새 예약/전달은 없다. 같은 ID의 다른 hash는 기존 conflict다. 다른 commandId는 새 명시 SEND로서 새 current/IDLE/예산 검사를 거친다. 기한은 기존 SEND의 DB now+30초 및 HUMAN/정책/grant/current/fact의 최솟값이며 replay로 늘리지 않는다. COMMIT 결과 불명은 기존 503/reconcile-first를 보존하고 새 ID·예약을 자동 생성하지 않는다.

## 4. 명령 페이지와 정확 자료 읽기

기존 execution commands GET의 `{sequence,commandRef,envelope,materials}` 외피, audit server_sequence, 50+1 조회·2MiB·고정 page receipt·credential 결박 cursor를 유지한다. START 분기는 그대로다. SEND materials는 다음 단일 그룹이다.

```text
{manifestRef,groups:[{kind:"INSTRUCTION",payloadRef:partsRef,
 sourceRef,sourceBytes,contentHash,mediaType,
 parts:[{materialId,partIndex,byteOffset,utf8Bytes,contentHash}]}]}
```

group.payloadRef와 각 material snapshot.payloadRef는 기존 등록 의미대로 모두 partsRef다. 원 manifest source.partsRef와 envelope partsRef를 exact 대조하고, instructionRef는 envelope 및 manifest source의 원 instruction 결박에서 따로 검사한다. 두 ref를 같다고 요구하거나 대체하지 않는다. 기존 0062 descriptor 구조의 normal 전용 sourceKind는 `PROTECTED_INSTRUCTION_REFERENCE_V1`이다. 기존 `SYNTHETIC_REFERENCE_ONLY_V1` 판독은 바꾸지 않는다. 자료를 START의 두 그룹으로 포장하거나 중복 복제하지 않는다. mediaType·byte/hash는 실제 원 생산값을 사용하고 임의 text 값으로 바꾸지 않는다.

기존 command/material GET을 사용한다. 응답 외피·canonical base64url bytes·no-store·부분 hash/offset·2MiB 한도는 유지하고 저장 receipt kind는 `NORMAL_INSTRUCTION_MATERIAL`이다. 매 읽기/재조회에 원 등록 command/grant/manifest/material/parts, 원문 정정·제외·격리·권한·기한과 원 bytes를 재검산한다. 변한 bytes를 원 receipt로 반환하지 않는다.

보호 읽기 범위는 등록된 그 SEND의 정확 instruction/parts뿐이다. 원 ProjectContextSources의 USER_INSTRUCTION 검산을 재사용하되, START context 전용 D2 표식을 SEND에 그대로 전용하지 않는다. 전용 내부 표식은 현재 execution credential·grant·원 SEND command/receipt/manifest/fullref/parts뿐 아니라 원 conversationId/messageId에도 결박한다. ProjectConversations.readMessageCore 진입까지 정확 대상 검산을 유지하며 프로젝트가 같다는 이유로 다른 대화/메시지에 재사용하지 않는다. 일반 문서/대화 조회에는 사용하지 않는다. 실제 사용자 원문 조회/전송은 이번 실행에서 하지 않는다. callback 성공값이나 JSON ref 자체를 보호 원천으로 인정하지 않는다.

USER_INSTRUCTION bodyRef의 원문 형식은 기존 ProjectDocuments.originalText가 허용하는 `text/plain;charset=utf-8` 또는 `text/markdown;charset=utf-8`을 그대로 보존한다. 합성 descriptor의 `text/plain|application/json` 목록을 normal 원문에 그대로 적용하거나 원문 형식을 바꾸지 않는다.

## 5. 명령별 permit

기존 `/commands/:commandId/permit` POST의 명시 SEND 분기다. 본문은 기존 `{envelopeHash,localAttemptRef,sourceObservationRefs,osOwnershipRef}`이며 TLS/실행 Bearer·EXECUTION_REQUEST challenge/proof·정확 target/body·현재 등록·nonce 소비를 유지한다. 새 서명 목적은 없다.

| 위치 | 값 |
|---|---|
| execution receipt kind | `NORMAL_INSTRUCTION_PERMIT` |
| instruction permit snapshot state | `NORMAL_INSTRUCTION_PERMITTED` |
| permit flags | `executionAuthorized:true`, `dispatchPerformed:false` |
| HTTP 응답 | 아래 기존 normal permit 외피/축약 permit 형상 |

```text
{transport:"NORMAL_PROTECTED",proofResultRef,
 permit:{ref,commandId,envelopeHash,issuedAt,expiresAt},
 cacheControl:"no-store",nonceConsumed:true,
 executionAuthorized:true,dispatchPerformed:false}
```

허가는 그 SEND의 입력 전달 한 번에만 해당한다. START 생성·임의 도구 효과는 허가하지 않는다. 기존 0024 execution_instruction_permits의 execution/generation/commandId별 UNIQUE·proof별 UNIQUE·기존 INSERT 권한·SEND50건/permit총2MiB를 유지한다. 크기 제한은 생성 후 `{complete:true,permits:[{ref,snapshot},…]}` 전체 canonical bytes에 적용한다. 0018 START의 실행세대당 UNIQUE는 절대로 바꾸지 않는다.

현재 writer OWNED·source observations·osOwnershipRef·이해 검토·자료/정책·IDLE 및 SEND 자신의 예약을 재확인한다. START 당시 사실로 대체하지 않는다. 원 current가 없으면 거절하며 실제 Query 생성으로 그 선행 current를 만들어 순환시키지 않는다. 외부 관측 공급은 normal START와 같이 거래 밖에서 수행하고 이후 거래에서 전부 재검산한다.

동일 packet 재조회는 원 nonce/receipt/permit만 반환한다. 다른 attempt/proof로 같은 SEND를 재소비하거나 만료를 연장하지 않는다. nonce/receipt/permit을 같은 거래로 저장하고 COMMIT 전 재검산한다. 결과 불명은 자동 재허가하지 않는다.

이 서버 범위는 SDK init을 선행으로 요구하지 않는다. 기존 bootstrap은 SEND 소비 후 driver.create, 이후 init 관측 순서다. 최초 SEND 명시 선택과 실제 Query/SDK SID·child 결박 구현은 후속 단위이며, 서버 permit 소비를 SDK 수락으로 표시하지 않는다.

## 6. 구현·검수 경계

재사용 저장소는 commands/authorization_receipts/audit_events, execution_commands, usage_reservations, delivery_outbox, material manifests/bindings/materials/proof_bindings, challenges/receipts, execution_instruction_permits다. 기존 SQL을 고치지 않고 다음 번호의 미적용 forward SQL로 normal 분기와 양방향 guard를 추가한다. 새 일반 GRANT/DEFINER는 포함하지 않는다.

예상 제품 접점: 신규 normal-instruction-command/materials/source/permit, 기존 app/projects routes/normal-command-pages/normal-start-materials/normal-start-permit 및 필요한 context-sources/read-access/conversations 내부 scope 접점이다. exact 파일 allowlist는 채택 후 기존 Primary의 WI에서 고정한다. 공개 형상·권한 범위를 더 늘려야 하면 그 delta를 먼저 분리한다.

필수 합성 여정은 실제 NormalInitialExecution 생산 결과→SEND 저장→page→정확 자료→명령별 permit→동일 packet replay다. 직접 반례는 다른 HUMAN5tuple/세대/원 START/등록/session, 재봉인한 관계 위조, BUSY 새 명령과 원 replay 차이, 자료 정정·격리, START/SEND 예약 혼동, nonce·command 경합, 부분 저장 rollback, COMMIT 불명, 만료·회수 후 신규 허가0이다. 기본 미등록·기존 synthetic/START 회귀를 검수한다.

소스 및 합성 시험만 구현한다. 실제 PG의 SQL/권한/잠금·사용자자료·키·서비스·SDK 설치/호출·Agent 실행·OS/writer 완료는 미검증으로 남긴다. 이 후보는 전체 FN07/FN08나 작업계획 완료를 선언하지 않는다. rollback은 명시 normal SEND 조립 해제와 해당 소스 commit revert이며, 미적용 SQL은 실제 DB rollback이 아니다.
