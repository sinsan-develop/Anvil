# FN09 실행 START 원자료·논리 세션 결박 후보

- 상태: **DRAFT_DECISION_SUPPORT / CODE_GO0 / SOURCE_GO0 / ACTUAL_EXECUTION0**.
- 작성 시 문서 HEAD: 43ffc89d342655da06217ee5e5e57263e844b761. 실제 관련 source 기준은 FN10 통합 fc45abea98fedf12d4b56d7be1cbd43a67b4ac07 이후 현재 원문이다.
- 목적: 기존 실제 보호 저장자료에서 stage 요청·확정 임무·등록 준비·Anvil 논리 세션을 교차검산하고, 서버 실행 식별과 token 없는 credential 예약을 불변 원자료로 생산·보호 조회한다. SDK init/child/OS writer/실제 생성 허가 없이 앞선 provenance 공백을 닫는 기능이다.
- 이 문서1만 소유한다. 기존 계약·제품·시험·SQL·현황·타인/보호 자료 변경0. 실제 DB/SQL/GRANT·키·권한·서비스·SDK/Agent·실파일/사용자자료 조사·공개 SDK 재조회·실행0. 제안 literal과 원형은 채택 전이며 기존 승인의 유일한 해석이 아니다.
- r2 이력: 원 r1 30875B/4F11F35305AFBAC076FDB130D9933C03B5092C27F3C8BAAA05FDB69F266F6EEC는869eefe4에 보존됐다. 통제 §371에 따라 재접속·취소 이력의 ref 발견 공백과 assignment 고정버전 보호목록1을 추가한다. SOURCE_GO0/ACTUAL_EXECUTION0 유지이며 새 조회 의미도 채택 전이다.

## 1. 기존 생산으로 확보되는 원자료

| 원 producer·정확 접점 | 기존 원형/실제 보호 | 이번 기능에서의 사용 |
|---|---|---|
| `scheduling/stage-queue.ts:20–24,58–74,82` | startStage 입력 stageRef/methodologyApplicationRef/mode/startNodeRef/endBoundaryRef/baselineRefs/budgetRef/reason. queue_requests의 requestRef/version/hash·snapshot·command/receipt/audit 검산. WAITING/CANCELLED만 존재 | 선택 WAITING의 exact 원행과 최신 head를 읽어 원 임무의 application/node·기준/예산과 대조. 기존 assignmentRef=null·slotReserved/dispatch false 보존 |
| `assignments/project-assignment-confirmations.ts:67–101` | 확정 snapshot exact11: draftRef/definition/reviewRefs/reason/confirmedBy/confirmedAt/contentConfirmed/readinessIssues/ready/executionAuthorized/dispatchPerformed | contentConfirmed=true와 원 검토/명령 관계 검산. drafts.current/decision으로 현재성 별도 확인. 내용 확정을 실행 준비 완료로 쓰지 않음 |
| `assignments/assignment-input.ts:10–20` | definition.taskRef={planRef,taskCode,applicationRef,nodeId}, baselineRefs·allowedScopes·환경/예산·역할/목표 | 선택 stage의 application/node와 정확 결박. 문자열 비슷함·명시 task를 임의 추론하지 않음 |
| `assignments/responsible-sessions.ts:170–245` | bindResponsibleSession이 role_bindings와 agent_sessions를 같은 command/receipt로 생산. binding의 assignmentRef/roleRef/connectionRef/sessionRef/generation·RESERVED·externalSessionHandleRef=null. readBinding은 양쪽 hash/원 명령 관계 검산 | 새 논리 SID를 만들지 않고 원 binding과 별도 sessionRef를 그대로 도출. 현재 role binding head와 현재 임무/등록 정의 재검산 |
| `executions/project-execution-preparations.ts:64–151` | prepareExecution 등록 intent13·basisRefs/latestInstructionRefs/checkedAt/missingConditions/NOT_AUTHORIZED/preparedBy/false flags/options exact5. 실제 assignment/binding/context/정의/환경 보호 reader 소비 | 원 preparationRef와 전체 snapshot/hash·intent의 같은 assignment/binding/context/정의/환경을 검산. read 반환 NOT_RECHECKED를 current로 전용하지 않음 |
| `executions/preparation-input.ts:20–47` | 원 보호 Claude 정의로부터 options={format:CLAUDE_QUERY_DATA_V1,mediaType:application/json,body,utf8Bytes,contentHash} 생산 | optionsRef는 원 preparationRef의 채택 목적 투영, 원문 bytes/hash는 별도. 임의 artifact ref·context hash와 교체하지 않음 |
| `access/project-command.ts`, `executions/runtime-policy.ts` | 현재 HUMAN Session/H·project/member/control·정책·원 receipt/audit. 현재 한도 정책 보호 읽기 | 새 원자료 등록에 필요한 명시 프로젝트 정책을 검사. authorizeRuntimePolicy의 EXECUTION target은 신규 executionId 발급/권한을 대신하지 않음 |

등록 준비에는 CAPABILITY_UNVERIFIED/BUDGET_POLICY_UNVERIFIED/SOURCE_AUTHORIZATION_UNVERIFIED/HOST_OS_FENCE_UNVERIFIED 등이 원문으로 남는다. 새 원자료는 이것들을 지우지 않는다. 준비의 connection/environment current는 실제 보호 정의/환경을 다시 읽어 검산할 수 있지만 capability 지원·실행 예산·OS fence를 VERIFIED로 만들 수는 없다.

### 참조와 세대의 정확 구분

- roleBindingRef = role_bindings의 ref. sessionBindingRef = 그 원 binding.snapshot.sessionRef이며 agent_sessions 원행의 ref다. 두 ref는 다른 자료다.
- 기존 SEND 소비 `execution-instruction-queue.ts:43`은 sessionBindingRef를 fact.agentSession.sessionRef와 비교한다. SDK session_id·planned UUID와는 다른 Anvil 논리 참조다.
- H = 현재 HUMAN credentialGeneration, 실행 lifecycle generation = executionGeneration, E = 실행 credentialGeneration, role binding generation = binding version의 독립 세대다. H3/E1 정상이며 서로 같아야 한다는 규칙0이다.
- `execution-challenge-store.ts:71–74`의 E1 생산은 grantRef를 가진 SYNTHETIC_RESERVED_NO_TOKEN뿐이다. `execution-credential-reservation-read.ts`와 material basis helper는 그 기존 예약의 reader이며 actual/새 목적 예약 producer가 아니다. 이를 수정해 실제 token 예약으로 부르지 않는다.

## 2. 새 목적과 사용자 명령·조회

권장 새 owner-purpose는 **EXECUTION_START_ORIGIN**이다. 이것은 ‘선택된 실제 원자료에 실행 식별을 배정하고 후속 사용자가 같은 자료를 부모로 식별할 수 있게 하는 기록’이며 실행 grant/credential 발급/예산 사용·OS writer 권위가 아니다. 기존 준비 기록만 복제하지 않고, 정확 stage request와 assignment/preparation/binding을 단일 원본 및 새 실행 식별에 처음 결박한다.

기존 `/api/v1/projects/:projectId/commands`의 operation **registerExecutionStartOrigin**을 제안한다. 원 ProjectCommand exact11 유지, targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null이며 payload exact는 다음이다.

```text
{stageRequestRef:VersionRef,assignmentRef:VersionRef,
 preparationRef:VersionRef,roleBindingRef:VersionRef,reason:string}
```

reason은 기존 안전 문자열·2MiB/canonical 깊이 계약을 재사용한다. caller의 executionId/각 generation/credentialId·값·context/options 대체·SDK SID·current boolean·원문을 받지 않는다. source refs는 원 서버 reader에서만 도출한다.

명시 정책 제안은 HUMAN OWNER의 registerExecutionStartOrigin, 별도 readExecutionStartOrigins다. 기존 record/prepare/startStage/authorizeExecution 정책을 자동 전용하지 않고 정책 편집 목록에도 선택지로만 추가한다. 읽기 정책은 반환에 포함되는 assignment/context/정의/환경·원 source의 현재 보호 조회를 대체하지 않는다. 신규 일회 승인 연결은 이번 최소안에 포함하지 않으므로 REQUIRE_APPROVAL/approvalRef는 효과 전 명확412이며 AUTO 정상 경로는 실제 저장까지 제공한다. 사용자 정책 자동 부여0이다.

새 URI가 필수인 기술 원리는 없으나, 기존 응답의 exact DTO를 보존하면서 원본 선택·UNKNOWN 뒤 exact 재조회와 재접속 뒤 이력 발견을 제공하는 최소안에서는 보호 GET2를 고정한다.

```text
GET /api/v1/projects/:projectId/execution-start-origins/:id/versions/:version
GET /api/v1/projects/:projectId/assignments/:id/versions/:version/execution-start-origins
```

exact version GET은 query/body 없음이다. 목록 GET은 아래 §2.1의 cursor 하나만 허용한다. 둘 다 HUMAN 세션 쿠키·현재 host·Bearer 거절·same-origin/no-store·익명/타프로젝트 비노출을 집행한다. GET2·명령의 공개 의미는 신규 채택 대상이며 현재 등록된 API로 보고하지 않는다. 기존 책임/준비 응답에 origin 키를 몰래 넣지 않는다.

### 2.1 assignment 고정버전의 보호 이력 발견

실제 현재 queue GET은 WAITING_ONLY이고 취소 이력을 제외한다. 기존 preparation/responsible-session 응답에는 originRef가 없다. 따라서 exact origin GET1과 메모리 receipt만으로는 재접속 뒤 취소된 요청의 origin ID를 찾을 수 없다. 새 목록1은 이 공백을 닫기 위한 **추가 공개 조회 의미**다. 총계·다른 사용자 전용 자료·다른 assignment의 자료를 열지 않는다.

목록 params exact는 `{projectId:UUID,id:UUID,version:양의 안전정수 문자열}`이며 id/version은 assignment의 정확 버전이다. query exact는 `{cursor?:string}`다. cursor 생략은 첫 페이지, 빈 문자열·추가 query·배열/중복 값·불량 길이/형상은400이다. pageSize는 기존 preparation-history와 같은20으로 고정하며 caller limit/sort/filter를 받지 않는다. body 없음이다. cursor는 기존 상한4096자와 기존 ProjectListCodec의 유한 만료를 재사용하고 기한을 연장하지 않는다.

response exact 제안:

```text
{projectId,assignmentRef:VersionRef,
 items:[{ref:VersionRef,stageRequestRef:VersionRef,recordedAt:ISO8601}],
 nextCursor:string|null,currentness:"NOT_RECHECKED",
 credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,
 writerReservationPerformed:false}
```

원 assignmentRef는 실제 보호 reader가 읽은 원 confirmed fullref이며 route의 id/version과 exact다. 각 ref는 원 origin S의 hash/ref, stageRequestRef/recordedAt은 같은 원 S의 저장값이다. Q/token/실행 current·reason/Options body·secret를 목록에 추가하지 않는다. 다른 assignment의 origin을 섞거나 현재 자료로 원 snapshot/ref를 다시 계산하지 않는다. NOT_RECHECKED는 origin의 현재 사용 가능성을 인증하지 않는다는 뜻이다. 항목의 원 저장 관계/현재 읽기 보호는 검사한다.

현재 `readExecutionPreparationPage`와 브라우저 `readPreparationHistoryPage`의 fullref/hash 대조·20건·서명 cursor 방식을 재사용한다. origin 고유 purpose 도메인은 `EXECUTION_START_ORIGIN_HISTORY_V1`로 제안하고, ProjectListCodec 서명 입력/필터에는 projectId·assignment **전체 ref**·현재 actorId/clientId/H credentialGeneration/humanSessionId·pageSize20·`recorded_at DESC,origin_id DESC`·이 purpose를 결박한다. 권한/정책은 페이지마다 실제로 다시 검사하며 cursor 자체를 읽기 권위로 쓰지 않는다. 제어 변경 뒤에도 현재 읽기권이 있으면 역사를 찾을 수 있도록 원 쓰기 제어 세대를 새 조회 권위로 요구하지 않는다. 현재 로그인/H/Session이 바뀌면 옛 cursor는 CURSOR_INVALID400이고 새 첫 페이지부터 읽는다.

원 정렬은 DB의 `(recorded_at,origin_id)` 내림차순이며 같은 시각은 origin_id로 결정한다. 다음 페이지 조건은 원 tuple보다 작은 값이다. SQL은 기존 방식으로21행을 관측해 다음쪽 존재를 판정하되, 최대20개의 **실제 반환 항목**만 보호 검산·투영한다. 원 timestamp의 SQL cursor 위치를 정확 보존하며 ISO 문자열로의 임의 반올림으로 위치를 바꾸지 않는다. nextCursor는 마지막 실제 반환 행의 tuple을 사용한다. 전체 canonical response의 외피·구분자·nextCursor까지2MiB를 검산하고, byte 한도로 항목을 줄이면 cursor 역시 마지막 실제 반환 행으로 다시 만든다. 항목 자체를 반환할 수 없는 오염/과대 자료는 기존 준비 목록 오류 원칙에 맞춰503 PAGE_TOO_LARGE로 거절하고 빈 성공으로 숨기지 않는다. 빈 정상 집합만 items=[]/nextCursor=null이다.

목록은 CANCELLED 요청·원본/Q 만료·옛 제어·옛 binding을 **현재성 이유로 필터링하지 않는다**. 같은 assignment의 원 저장 관계가 유효하고 현재 readExecutionStartOrigins 및 원 assignment/preparation/책임·출처 보호가 허용되면 역사 ref를 발견할 수 있다. 신규 등록/후속 사용용 fresh WAITING·최신 binding·원 작성자의 현재 H/Session 일치를 역사 목록에 소급하지 않는다. 현재 조회 권한/출처 접근이 거절되거나 무결성이 깨지면 페이지 전체를 비노출 오류로 거절하며 item skip·부분 성공·총계로 존재를 누설하지 않는다. 실제 소유 관계에 따른 조회 범위를 넓혀 다른 사용자/프로젝트를 공개하지 않는다.

위조/다른 purpose·project/assignment ref·actor/client/H/Session·만료 cursor는 CURSOR_INVALID400이다. 잘못된 params/query는400, 무인증401, 현재 읽기/출처 보호는 기존403/404 비노출 의미, 원 hash/관계 오염은503 고정 오류다. 목록 노출이 exact GET의 보호를 대신하지 않으며 선택 시 원 ref/hash를 들고 exact GET을 다시 소비한다. 보호 GET 거절 때 앞 목록/원문을 성공 원본으로 재사용하지 않는다.

## 3. 불변 원본과 token 없는 E 사전예약

원본 payload S exact 제안:

```text
{schemaVersion:1,purpose:"EXECUTION_START_ORIGIN",projectId,originId,
 execution:{executionId,executionGeneration:1},
 stageRequestRef,assignmentRef,preparationRef,roleBindingRef,sessionBindingRef,
 taskRef:{planRef,taskCode,applicationRef,nodeId},
 connectionRef,environmentRef,contextBundleRef,
 options:{preparationRef,format:"CLAUDE_QUERY_DATA_V1",utf8Bytes,contentHash},
 basisRefs,sourceScopes,latestInstructionRefs,
 observedPolicyRef,budgetPolicyRef,
 subject:{kind:"HUMAN",userId,clientId,humanSessionId,
          credentialGeneration,controlGeneration},
 executionCredential:{credentialId,credentialGeneration:1},
 sourceObservations:[{kind,ref,observationHash}],
 unresolvedChecks,reason,recordedAt,expiresAt,
 credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,
 writerReservationPerformed:false}
```

sourceObservations.kind의 제안 고정집합은 STAGE_REQUEST/ASSIGNMENT/RESPONSIBLE_BINDING/LOGICAL_SESSION/PREPARATION/METHODOLOGY_APPLICATION/CONNECTION_DEFINITION/ENVIRONMENT_VERSION/CONTEXT_BUNDLE/PERMISSION_POLICY/LIMIT_POLICY다. ref는 해당 실제 원문 VersionRef이고 observationHash는 그 원문을 임의 정정하지 않고 대조한 해시다. 개별 문서/계획/sourceRoot/관측의 refs는 basisRefs/sourceScopes·원 보호 자료에 포함되므로 별도 포괄 current=true 표식을 만들지 않는다. 어떤 reader가 fullref를 주지 않으면 가짜 ref를 만들지 말고 실제 원 명령/불변 버전의 정확 참조 생산을 구현해야 한다.

unresolvedChecks는 원 preparation.missingConditions를 보존하고 새로 확인되지 않은 ACTUAL_RUNTIME_NOT_OBSERVED/SDK_SESSION_NOT_CLAIMED/EXECUTION_CREDENTIAL_NOT_ISSUED를 명시한다. 원 policy/정의/환경을 재조회했어도 원 준비 snapshot/hash를 새 값으로 갱신하지 않는다. S는 관측한 저장 관계의 증거이지 기존 ServerExecutionFactV1의 전12 checks VERIFIED_CURRENT인 실제 실행 fact가 아니다.

원 E예약 payload Q exact 제안:

```text
{schemaVersion:1,purpose:"EXECUTION_START_ORIGIN_CREDENTIAL_RESERVATION",
 credentialId,credentialGeneration:1,projectId,originRef,
 executionId,executionGeneration:1,sessionBindingRef,roleBindingRef,
 state:"RESERVED_NOT_ISSUED",reservedAt,expiresAt,
 credentialIssued:false,executionAuthorized:false,dispatchPerformed:false}
```

Q는 token/secret/digest를 포함하지 않는다. grantRef가 아직 없으며 기존 execution_credentials의 grantRef 기반 synthetic row와 다른 목적이다. 나중에 실제 credential 발급이 필요하면 실제 admission/grant와 이 원본/Q의 관계·scope·서명/회수를 별도 검산하는 producer가 필요하다. Q 자체를 bearer나 발급 승인으로 사용할 수 없다.

서버는 처음에 originId/executionId/credentialId와 자기 serverCommandId·operationId·authorizationReceiptId·auditId를 원 목적 제한 factory로 선고정한다. **S의 credential ID/gen→originHash=H(canonicalJson(S))/originRef→Q의 후행 originRef/reservationHash→자기 receipt/audit 저장 관계** 순서다. S에는 reservationRef/hash·자기 receipt/auditRef/scopeDigest/resultRef를 넣지 않는다. 자기 receipt target=originRef이고 scopeDigest가 그 target을 포함해도 S가 역참조하지 않아 비순환이다. 응답에 Q/ref를 부가하되 S에 다시 넣어 hash를 수선하지 않는다.

공통 receipt.data 제안은 `{ref:originRef,snapshot:S,reservation:{ref:reservationRef,snapshot:Q},originRecorded:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,writerReservationPerformed:false}`다. 원 result/receipt/audit·domain/R 관계를 양방향 검산한다. 원 부모 stage/prepare/bind command의 receipt는 각각 기존 자료의 증빙이지 실제 생성 허가가 아니다.

## 4. 현재성·취소·중복·새 세대 규칙

최소안은 **동일 stage request 스트림에 원본 하나**를 발급하는 것으로 제안한다. 이는 프로젝트 전체 건수 cap이 아니라 그 요청과 실행 식별의 단발 association이다. 같은 command/hash replay는 원 결과, 다른 command가 같은 request에 새 원본을 만들면409다. 이것이 기존 WAITING의 의미에 새 연결 유일성을 추가하므로 채택 대상으로 분리한다.

이 단위에서는 executionGeneration=1/E credentialGeneration=1을 새 서버 executionId/credentialId의 최초 세대로만 발급한다. H나 role binding version으로부터 복사하지 않는다. 동일 origin/credential의 갱신·rotation·generation 증가 명령은 제공하지 않는다. 원본이 만료/취소/현재성 상실됐다고 자동 새 세대를 생산하지 않는다. 새 원본이 필요하면 사용자가 기존 요청 취소를 확정하고, 새 startStage 요청과 현재 자료를 명시 선택해 별도 register 명령을 보낸다. 새 request는 새 executionId/credentialId의 최초 세대이며 이전 ID의 세대 재활성화가 아니다. 향후 같은 실행 lifecycle의 재시도/복구·E 재발급은 별도 정확 계약 전0이다.

원본/Q는 불변이다. 현재 사용 가능성은 저장의 state 문자열을 믿지 않고, 원 stage 요청의 최신 head가 여전히 선택 WAITING인지·현재 app/assignment/binding/준비·정의/환경/출처·작성 주체의 H/제어/원 Session·정책이 그대로인지 보호 reader로 다시 확인한다. queue 취소·새 binding·정의/환경 변경·권한/Session 회수·기한 만료로 원본은 **후속 사용 불가**다. 실제 token 회수/OS 중지를 수행했다고 표시하지 않는다. 현재성 원인이 사라져도 한 번 취소/만료된 요청이나 예약을 되살리지 않는다. 원 binding version/참조와 계속 같아야 하며 ABA로 옛 원본을 현재 결박으로 재사용하지 않는다.

역사 GET은 현재 사용 가능 여부와 다르다. 현재 읽기권/원출처 보호를 통과한 같은 프로젝트 사람은 원 불변 snapshot/receipt를 역사 자료로 읽을 수 있다. 원 작성자의 옛 H와 현재 조회자의 새 H가 다르다는 이유만으로 역사를 훼손하지 않는다. 반대로 후속 admission의 **현재 사용**에는 원 subject/Session/제어/H·source와 예약의 최소기한을 exact 재검산한다. 역사 응답을 현재 허가로 채택하지 않는다.

응답의 제안 관측 외피는 `{historyVerification:"STORED_START_ORIGIN_VERIFIED",currentness:"MATCHED"|"STALE",currentIssues,observedAt,validUntil,executionAuthorized:false,dispatchPerformed:false}`다. 보호 권한/출처 접근을 잃으면 부분 원문/ref/과거 receipt를 섞지 않고 기존 비노출 오류를 반환한다. STALE는 읽을 수 있으나 후속 사용이 안 되는 정확 원자료의 상태이며 OWNER/write만으로 본문을 공개하지 않는다. caller가 currentness를 보내 검사를 대신할 수 없다.

역사 GET의 validUntil은 **현재 조회자 Session/읽기 정책**의 응답 보호기한이다. 이미 만료된 S/Q의 원 expiresAt과 구분하므로 원본 만료 뒤 역사 읽기를 막거나 반대로 역사 읽기로 원본을 재허가하지 않는다. 원본 currentness는 그 원 expiresAt·원 subject/자료로 별도 STALE 판정한다.

expiresAt은 발급 당시 원 HUMAN Session idle/absolute·현재 명시 정책·한도 정책 등 **실제로 기한을 가진 허가/자료의 최소**다. 기한 없는 확정 문서/계획/논리 session에 TTL을 창조하지 않는다. 원 call 처리 deadline은 별도이며 그 처리 timeout을 영구 원본 수명으로 혼동하지 않는다. read/use마다 현재 허가 수명으로 더 줄일 수 있지만 S/Q의 원 expiresAt은 늘리거나 다시 쓰지 않는다. 요청 cancel은 그 기한과 무관하게 즉시 후속 사용을 막고 기존 취소 API/명령 자체를 바꾸지 않는다.

## 5. 같은 Tx의 실제 보호·생산·후행 조회

| 순서/공유 잠금 | 실제 함수·필수 검산 | 실패 경계 |
|---|---|---|
| 인증·project/member/control→정책 | AccessRepository.authenticated/currentProjectController/currentPolicy와 새 명시 연산 정책. 원 Session/H·현재 제어·반환 read 보호 | 정책보다 project 잠금 먼저, 다른 operation/로그인·재인증 규칙 변경0 |
| 원 명령 replay | projectReplay 뒤 origin/Q/receipt/audit·원 보호 조회 | 동일 hash 원 결과만, 새 R/ID/credential 예약0. 원 head CAS·fresh WAITING/최신 binding을 역사 replay에 새로 부과하지 않음 |
| stage 요청 exact 최신 잠금 | ProjectStageQueue의 기존 #view 검산을 재사용하는 목적 한정 readRequest(db,actor,pid,ref) 추가 후보 | 현재 read는 WAITING 목록 요약이므로 임의 summary를 원 snapshot으로 신뢰0. 취소/다른 ref/head 거절 |
| 임무·binding·준비 | ProjectAssignmentConfirmations.read+decision/drafts.current, ResponsibleSessions.readBinding/role head, ProjectExecutionPreparations.read | 같은 assignment/connection/context/application/node·root 임무 지원범위·등록분기·RESERVED·externalSessionHandleRef=null 검산 |
| 원 정의/환경·context/source/기준 | 실제 ProjectConnectionDefinitions/ProjectEnvironments·ProjectContexts와 원 보호 documents/plans/methodology/source readers | 현재 head/MATCHED와 원 ref/hash, 계획/기준/검토·원 source 접근·격리·sourceScopes 포함관계 재검산. stale metadata를 참으로 채우지 않음 |
| ID/원본/예약·저장량 | S/ref 고정→Q/hash→동일 PoolClient reserve→공통 receipt/도메인 insert→settle | 같은 actor/query/txid·원 request/ID/plan/수명. 관계 누락·actual 초과 전체 거절 |
| 최종 현재 재검산→COMMIT/release | 원 stage 취소·정책/제어/임무/binding/자료 변경 경로와 같은 project/행 잠금. guard/기한은 await 뒤 재검산 | callback/COMMIT/rollback/release 불명은 성공 원문 반환0·새 요청0 |
| 확정 뒤 새 인증 조회 | 원 결과/원본/Q/실제 보호 읽기를 새 authenticated에서 대조 | 확정 저장 뒤 권한 상실은 원행 삭제 없이 응답 비노출. receipt/ref의 클라이언트 보존과 본문 표시 분리 |

현재 ResponsibleSessions/준비 reader의 주입 가능한 Pick을 그대로 성공 대역으로 써서는 안 된다. 신규 service는 하나의 실제 access·원 routes 구성으로 실제 보호 클래스들을 만들고 필요한 prototype/own-data 함수·query 포트·actor/세대·txid를 캡처/검산한다. 외부 call/선택 refs는 getter/Proxy를 실행하기 전에 안전 사본으로 고정한다. 유한 취소/타이머는 외부 Promise 정착과 실제 DB work·Pool 회수 시점을 구분하며 pending이 남으면 새 중첩 work를 자동 허용하지 않는다.

현재 ProjectStageQueue에는 readRequest가 없고 read()는 목록 요약뿐이다. 기존 private #view의 원 command/receipt/audit 검산을 재사용하는 `readRequest(db,actor,pid,ref)`를 같은 파일에 목적 한정 추가해 원 snapshot/최신 head를 반환한다. 신규 등록과 사용은 WAITING/head exact를 검사하고, 역사 관계 읽기는 원 version/저장 관계만 읽는다. 이를 위해 새 공개 stage GET을 추가할 필요는 없다.

현재 ProjectExecutionPreparations.read는 원 snapshot/등록 Options 보호를 수행하나 NOT_RECHECKED로 반환하며 내부 #registeredOptions(...,false)는 역사 대조다. 같은 파일의 목적 한정 `readStartOriginSources(db,actor,pid,ref,mode,guard)` 접점을 제안한다. mode=FRESH에서는 실제 원 read와 #registeredOptions(...,true), assignment/draft·binding head/context/정의·환경의 전후 관측을 소비한다. mode=HISTORY에서는 원 불변 준비/Options와 현재 보호 접근을 검사하되 최신 binding/current definition head를 원 저장 관계로 치환하지 않는다. 새 metadata를 원 준비 snapshot에 넣지 않으며 성공 proof boolean·private field 공개·authorize=false로 우회하지 않는다. 정확 signature의 mode/반환 형상은 이 의미 안에서 WI의 내부 기술 배치로 고정한다.

교차 검산의 제안 exact 관계는 stage.input.methodologyApplicationRef/startNodeRef와 assignment.definition.taskRef.applicationRef/nodeId 동일, preparation.intent.assignmentRef/roleBindingRef와 선택 refs 동일, preparation.intent.connectionRef와 binding.connectionRef 동일, sessionBindingRef와 그 원 binding.sessionRef 동일다. stage baselineRefs는 각각 assignment.definition.baselineRefs 및 preparation.basisRefs에 실제 포함돼야 하며 서로 다른 목적의 VersionRef를 임의 동치로 만들지 않는다. 현재 등록 준비의 options hash/bytes는 보호 정의에서 재도출한 원 Options와 동일해야 한다. 이 관계가 기존 유효 입력에서 성립하지 않으면 성공fixture로 메우지 않고 해당 의미 차이를 WI 전에 좁혀 보고한다.

예산 참조는 별도 목적 대조가 필수다. stage-queue.start는 input.budgetRef를 ProjectLimitPolicies.resolveCurrent(...,{kind:PROJECT,projectId})로 읽는다. 등록 준비의 intent.budgetPolicyRef는 원 입력·확정 임무의 budgetRef에서 보존되며 원 준비는 BUDGET_POLICY_UNVERIFIED를 남긴다. 따라서 UUID/필드명만 보고 이미 같은 종류라고 단정하지 않는다. FRESH 원자료 producer는 두 원 ref를 실제 한도정책 reader로 각각 해소해 현재 PROJECT 범위/APPLIED·원 subject/정책·만료/실제 fullref를 검산하고, **같은 목적임이 검증된 뒤** 이 요청/준비의 예산 정책 일관성을 exact 대조한다. 다른 목적/미연결이면 명확 source mismatch/미검증으로 거절하며 참조를 자동 바꾸지 않는다. 적합 같은 프로젝트 한도 원자료의 정상 경로는 실제 producer/reader로 검수한다. 역사 조회는 원 ref/hash·현재 접근 보호를 유지하되 옛 예산이 지금도 APPLIED/미만료여야 한다는 조건을 소급하지 않는다. 실행 사용량 예약·실제 지불 허가는 여전히 별개다.

## 6. 최소 저장 구조·계상과 미적용 SQL

기술적으로 새 일반 표/endpoint가 유일한 방법은 아니다. 다만 현재 executions/credential/grant의 synthetic 제약·공개 의미를 바꾸지 않고 최소 기능을 닫기 위해 **단일 purpose 표 execution_start_origins 안에 S와 Q를 함께 보관하는 안**을 권장한다. 별도 일반 credential 표·새 key·token 저장은 만들지 않는다. 이 새 보관/유일성 의미 자체는 채택 대상이다.

제안 열은 project_id/origin_id/version(1)/content_hash/snapshot_json, stage_request_id 및 선택 request version/hash, execution_id/execution_generation, credential_id/credential_generation, reservation_hash/reservation_json, server_command_id/recorded_at다. origin_id·execution_id·credential_id의 원 목적 유일성과 (project,stage_request_id) 유일성을 검산한다. 과거 row update/delete0, 원 S/Q hash·원 command/receipt/audit 및 자기 R의 양방향 deferred 완결을 건다. 현재성을 위한 새 전역 active pointer는 만들지 않고 기존 source의 현재 head/취소/기한으로 결정한다.

계상은 기존 project 10GiB 및 U/H/O·coverage/account·같은 Tx reservation 계약을 보존한다. 새 operation/part_kind 후보는 registerExecutionStartOrigin/EXECUTION_START_ORIGIN이다. 실제 origin row의 S+Q와 관계열 비용 P, 자기 command(C)/authorization receipt(A)/audit(U), reservation(R) 자기비용을 각 한 번 포함한다. 원 assignment/prepare/context/Options body는 참조만 보관하므로 원문 bytes를 복제 비용처럼 중복 계상하지 않는다. 별도 token·알림 행0이다.

canonical-pair 비용과 최소 유한 고정점 r >= P+C+A+U+costR(r)를 같은 actor/원 request/coverageGeneration/ID/projection 전체 plan에 봉인하고, planHash만 제외한 전체 canonical hash로 검산한다. admission은 원 잠금 아래 U+H+O+r <= 10GiB, settle은 원 actual/자기비용과 관계를 다시 읽어 A_actual <= r·정확 원 Tx/기한/CAS를 검산한다. 여기 A_actual과 authorization 행 약자 A를 혼동하지 않도록 WI/코드는 구분한다. 기존 무필터 held/SETTLED 집계에 새 R가 이미 들어가면 소계를 중복 추가하지 않는다. replay는 reserve/charge0, 실패는 원 transaction 원자성을 유지한다.

현재 migration 실제 목록의 마지막은 0080_node_decisions.sql.pending이다. 이 후보의 forward 번호 제안은 **0081_execution_start_origins.sql.pending**이며 WI 고정 시 다른 담당자의 번호 예약 여부를 재대조한다. 기존 SQL 수정0. 전용 reserve/settle RPC2·operation/part_kind CHECK 정확 분기·plan/settled dispatcher·양방향 domain/command/R/account 완결과 owner/search_path·PUBLIC/helper EXECUTE 회수·app 정확RPC2만의 미적용 DDL을 포함한다. 기존 공개 quota_current/reserve/start에 새 내부 목적을 열지 않는다. 실제 설치·GRANT 적용0이다.

## 7. UI05 실제 사용자 흐름과 오류 보존

UI05에서 작업 화면의 기존 선택 임무로 SessionDetailPage에 들어와 실제 확정 GET의 confirmed ref를 공급한다. 새 Panel은 `readStageQueue`의 requestRef/순번/이유에서 WAITING 요청을 명시 선택한다. 현 목록에는 application/node 원문이 없으므로 선택 시점에는 ‘임무 연결 미검산’으로 표시하고 저장 전 같은 Tx readRequest에서 실제 교차검산한다. summary만으로 같은 node라고 꾸미지 않는다.

등록 준비는 기존 `readPreparationHistoryPage`의 assignment 고정버전 페이지(20건/서명 cursor)에서 ref를 선택하고 `readPreparationOriginal`의 exact GET으로 원 body/hash·등록 분기를 확인한다. role binding은 `readResponsibleSessionState`의 bindings와 기존 exact role-binding GET으로 선택/대조한다. sessionRef는 원 binding에서만 도출해 별도로 표시하며 SDK SID라고 표기하지 않는다. 기존 `listAssignmentDrafts`는 확정 임무 목록이 아니므로 그것만으로 confirmed를 만들지 않는다. 현재 확정 임무·기존 준비/책임 source를 재사용하므로 새 freeform UUID 입력이나 새 범용 assignment 목록 API는 필요 없다. 실제 경로/secret/새 UUID/새 실행 세대 입력0이다. 선택 출처가 준비되지 않으면 해당 기존 저장 화면으로 이동하고 자동 fake ref를 만들지 않는다.

‘START 원자료 등록 준비’는 선택/현재 ref를 고정하고, ‘명시 저장’이 실제 command 한 건을 보낸다. 저장 후 원 executionId·최초 generation/E예약 ID·원본 hash/원 선택 관계와 미검증 조건을 보여준다. 문구는 ‘원자료 저장·credential 미발급’이며 WAITING→RUNNING/실제 실행·writer확보/준비완료 표시는 바꾸지 않는다. 기존 StageStart/StageQueue와 임무·등록 준비 화면에 최소 연결하되 실행/SDK 버튼은 추가하지 않는다.

App은 project/user/client/Session/control/transport·선택 request/임무별 원 packet과 commandId/body를 CAS로 보존한다. POST가 확정 receipt를 받으면 후행 보호 GET보다 먼저 보존한다. POST 전 명확 거절은 미송신으로, COMMIT/HTTP 불명은 원 command 보존으로, receipt 뒤 GET403은 저장된 원결과의 원문 숨김/동일 ref 재조회로 구분한다. 자동 재명령/새 executionId 발급0이다. 주체/선택 이탈·복귀/늦은 응답에는 새 보호 관측 전 cached 본문0이며 receipt를 다른 문맥에 재귀속하지 않는다.

취소는 원 stage request의 기존 cancelQueuedRequest를 명시 실행한다. 새 등록 명령이 먼저 잠금을 얻어 저장됐다 해도 취소 확정 뒤 원본의 후속 사용은 실패해야 한다. 원본을 삭제하거나 token/OS를 회수했다고 표시하지 않는다. 역사 GET은 정확 ref와 현재 보호를 통과할 때만 허용한다.

재접속/취소 뒤에는 같은 assignment 고정버전의 신규 보호 이력 목록을 명시 조회해 원 originRef를 선택하고 exact GET으로 S/Q를 다시 읽는다. 원 receipt를 메모리에 보유했을 때만 가능한 우회가 아니라 실제 저장 목록→원 고정조회 왕복이다. 옛 요청이 WAITING 목록에서 사라져도 이 경로로 역사를 찾는다. 앞 페이지/새 페이지·assignment/actor/client/H/Session/transport 전환 및 보호 거절 때 목록과 본문을 숨기고, 새 보호 관측 전 cached origin을 현재 자료로 표시하지 않는다. 목록 cursor 만료/주체 변경은 새 첫 페이지 조회로만 복구하며 명령을 다시 보내지 않는다.

## 8. 최소 영향 후보·필수 검수

다음은 구현 가능한 최소 역할 배치 제안이며 이 문서가 writer 권한을 발급하지 않는다.

- 신규 server: `apps/server/modules/executions/execution-start-origin-input.ts`, `execution-start-origin-sources.ts`, `execution-start-origin-store.ts`, `project-execution-start-origins.ts`. sources는 실제 보호 reader와 원 현재성·세대/교차 refs, store/service는 같은 Tx S/Q·후행 보호를 소유한다. helper 함수가 적으면 적합한 내부 합침은 Main의 기술 선택이다.
- 기존 server5: `apps/server/modules/scheduling/stage-queue.ts`의 exact 내부 readRequest, `apps/server/modules/executions/project-execution-preparations.ts`의 같은 Tx readStartOriginSources, `apps/server/modules/access/project-command.ts`의 새 목적 한정 ID/정책 분류, `apps/server/modules/projects/project-storage-quota.ts`, `apps/server/modules/projects/routes.ts`. 원 repository/control-grant/synthetic START/기존 SQL은 수정하지 않는 안이다.
- 신규 SQL: 위0081 forward1. 실행을 위한 새 표/권한을 실제 적용하는 작업과 분리한다.
- Web 후보: 신규 `apps/web/src/features/session-detail/execution-start-origin-api.ts`, `apps/web/src/features/session-detail/ExecutionStartOriginPanel.tsx`; 기존 `apps/web/src/features/session-detail/SessionDetailPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/features/connections/policy-editor-profile.ts`에서 실제 UI05 장착·선택 confirmed 공급·원 command buffer·정책 옵션을 연결한다. SessionDetailPage는 실제 장착에 필요한 기존 경로다. origin storage는 별도 prop으로 전달해 공용 CriteriaEditorProps를 넓히지 않는 안이다. 기존 StageQueuePanel은 취소 UI로 그대로 병행하고 새 Panel이 기존 stage-queue-api를 소비하므로 해당 파일 수정은 필수 아니다. 임무/준비/책임·preparation-history의 기존 API와 DTO는 변경하지 않는다.
- 시험 후보7: `tests/unit/FN09/execution-start-origin-input.test.ts`, `tests/unit/FN09/execution-start-origin-sources.test.ts`, `tests/unit/FN09/execution-start-origin-store.test.ts`, `tests/unit/FN09/execution-start-origin-routes.test.ts`, `tests/unit/FN09/execution-start-origin-quota.test.ts`, `tests/unit/FN09/execution-start-origin-schema.test.ts`, `tests/unit/UI05/execution-start-origin-flow.test.ts`. 신규 순수 메모리 fixture1은 `tests/unit/FN09/execution-start-origin-fixture.ts`로 제안한다. 기존 시험 import로 test 등록을 일으키지 않고 각 factory의 DB/행/버퍼 상태를 분리한다.

위 경계는 **제품15(신규7/기존8) + 시험/fixture8 = 총23 제안 경로**다. server 신규4+기존5, SQL신규1, Web신규2+기존3으로 제품15다. 위 실제 경로 집합을 정본으로 삼고 WI에서 중복/생략 없이 manifest를 고정한다. 새 목록은 같은 신규 service/store/API/Panel 안에 구현하므로 별도 제품 파일을 추가하지 않는다.

정상은 실제 startStage 저장→실제 확정 assignment/registered prepare/binding producer→새 sources·같은 Tx command/S/Q/계상→COMMIT 후 새 보호조회→실제 UI05/App의 원 packet 저장과 exact GET이다. 실제 ArtifactStore는 OS fs import만 격리 메모리 대역으로 공급하고 ProjectDocuments/ProjectContexts/정의·환경 등 보호 메서드 성공 override0이다. 실제 새 origin 생산을 기존 prepare 응답 대역으로 대신하지 않는다.

중요 음성은 다음을 필수로 한다.

- 같은 node의 다른 application/plan/task·임무/준비/binding/connection/context/options ref/hash 교차, 등록/후보 분기 혼동, child 임무의 현재 미지원은 기존 거절 보존.
- stale head·새 binding·등록 정의/환경 변경·source 격리·정책/제어/원 Session/H 회수·소스 current callback 중 변이·alias/getter/prototype/query 포트/txid 교체·시간 역행/만료.
- H3와 최초 E1 및 role binding version의 독립 정상, 외부 execution/E/credential ID 주입·예약 없음·사후예약·다른 originRef의 Q·synthetic grant E예약 전용 거절.
- 두 동시 command의 같은 request 1승/1충돌, 동일 command/hash replay 효과0·다른 payload409, 취소와 등록의 직렬화·취소 뒤 사용거절, 새 원본 자동 발급0.
- S→Q→자기 receipt 관계의 hash 순환/누락·같은 비용 다른 actor/op·예산 정책/저장량 projection/plan 세대/ID/actual·역완결·app ACL 목적 검산.
- 원 query HOLD/abort의 외부 UNKNOWN과 늦은 Pool 회수·COMMIT tag/응답 유실 뒤 성공 반환/후행 auth/자동 명령0, receipt 뒤 GET 보호 거절의 원행 보존.
- UI 실제 App CAS·선택 refs/주체/control/transport 이탈·복귀403/늦은 응답 본문0·원 command/receipt 선보존·동일 ref 재조회·추가 POST0.
- 재접속 뒤 목록→원 originRef 선택→exact GET의 실제 저장 왕복, 취소/만료/옛 제어·새 binding 뒤에도 현재 역사 읽기권으로 ref 발견·현재 사용은 STALE, 과거 S/Q hash 불변.
- origin 목록의20건/끝 페이지/같은 recordedAt의 ID 정렬·실제 마지막 행 cursor, 전체 response byte 상한, 위조·다른 purpose/project/assignment 전체ref/actor/client/H/Session/만료 cursor·추가 query 거절, 권한/출처 회수 시 목록·본문/부분 결과0·총계0.

형상/메모리 SQL·DOM·type/build PASS는 실제 PG 설치/trigger/RLS/잠금/COMMIT·실 HTTP/served 브라우저·권한·Agent 검증과 분리한다. 이 후보는 아직 제품/시험 실행을 하지 않는다.

## 9. 필요한 결정과 이 기능 뒤 남는 것

PMO/source-only 채택 결정은 다음 **새 데이터/권한 의미**를 묶어 판단할 수 있다: registerExecutionStartOrigin/readExecutionStartOrigins와 HUMAN OWNER·명시 정책, stage request와 원본의 단발 association, token 없는 새 E 사전예약 목적, 이 단위에서 rotation 없이 취소/만료 후 새 요청만 허용하는 규칙, 원 보호 snapshot/S/Q·exact GET와 **assignment 고정버전 역사 발견 목록 GET1 추가**의 정확 공개·보관 의미. r1 대비 새 공개 delta는 이 목록이며 기존 책임/준비 응답/권한·실행 의미는 넓히지 않는다. 동시 명령·취소·원명령/receipt·출처 보호를 기존 계약보다 완화하지 않는다.

새 임의 상한·유료정책·실제 token 발급·writer/OS권위·실제 SDK 생성 승인·전역 active pointer는 이 결정에 포함하지 않는다. 같은 Tx quota/ID·단일 row S/Q 배치·forward 함수/ACL·파일 합침·시험 포트는 그 의미 안에서 Main이 고정할 내부 기술 선택이다. 원본문/관계·원 비용에 맞추는 과정은 새 사용자 비용정책을 묻는 일이 아니다.

이 기능이 끝나면 native 구성 관측과 admission이 **현재 살아 있는 부모 START 원자료·실행 식별·Anvil 논리 session/E예약**을 실제 보호 조회로 선택할 수 있다. 그러나 기존 DispatchEnvelope START_SESSION·actual grant/credential 발급·실제 첫 SEND permit·SDK init SID/SESSION mapping·실행 fence/process·도구 결정·예산 사용/실측은 별도다. 기존 FN07 후보의 ‘실제 부모 START envelope/실행 허가’가 자동 충족됐다고 하지 않는다. 후속 계약은 여기 originRef를 어떤 실제 envelope/허가의 부모로 소비하는지 명시해야 한다.

FN10의 실제 현재 runtime/선행 완료/평가대상 공급자도 아직 완결되지 않는다. 다만 원 요청과 임무/논리 세션·실행 식별을 보호된 불변 관계로 생산하는 첫 provenance 공백은 실제로 닫힌다. 저장양성까지 구현한 뒤에만 그 부분 기능을 보고하며, 준비 기록의 이름 변경이나 항상412인 래퍼를 진도로 삼지 않는다.
