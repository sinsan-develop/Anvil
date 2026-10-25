# FN14 인계 준비 기록 저장·조회 계약 후보

- 상태: **DRAFT / NOT_ADOPTED**, 2026-10-21, Project Main 어울. 이 파일은 직접 채택 판단용이며 구현 지시·새 API 활성화·SQL 작성/적용·권한 부여가 아니다.
- 근거: 설계 §8.2, FUNCTION_WORK FN14, INTERFACES §13.5. 기준 코드 6f5b646f093d302013a2bdbe3b572ee1198ed163.
- 기존 B는 caller 없는 합성 계산뿐이다. 본 후보는 별도 영속객체/명령/조회권을 추가하는 delta다. 준비기록을 정식 TransferManifest로 바꾸거나 원 binding을 동결하지 않는다.
- 2026-10-25 문서 보완: PMO 허용 범위는 이 기존 후보의 상세화·독립 정적 검토다. 아래 보완도 **코드/SQL/API/권한 계약 채택 전 후보**이며 이번 변경은 이 문서 한 파일뿐이다. 기존 9절과 operation/GET/2표 구성을 유지한다.

## 1. 결정 범위와 제외

권장: 아래 준비전용 저장·조회 계약과 **미적용 forward SQL·코드·합성검증**만 한 건으로 채택한다. 실제 개발 DB 적용·사용자 정책 부여·서비스 반영·원문 외부전송·유료 호출은 별도다.
대안: 저장 없이 기존 B 계산을 유지하면 새 계약은 없지만 사용자는 준비본을 다시 열 수 없다. 정식 prepareTransfer 전체 구현은 동결/회수·능력/이해검수까지 필요하므로 이 후보의 대체 구현으로 축소하지 않는다.

준비기록은 과거 시점의 자료 선택과 공백을 남긴다. 현재 상태 확인·중지/회수·안전·대상 능력 보증·새 역할 연결·이전/재개 권한이 아니다. 확정/이전 상태로 전환하는 연산은 이 후보에 없다.

### 1.1 기존 기준과 이번 명확화 delta

기존 기준은 createTransferPreparationRecord/정확 GET/새2표·현재 명시 정책·원자 저장/replay·회수 후 노출 차단이다. 이번 delta는 키/대응/실패 조건의 구체화다. 정식 prepareTransfer/TransferDraft/TransferManifest의 생성·저장으로 이름을 바꾸지 않는다. API의 record는 **준비기록 원문 JSON**이며 출처 본문 원문이 아니다.

기존 FN06/FN08 P1은 해당 제안의 명시 실행 연산·합성 resolver·fakeDB/가짜 transport 범위다. 같은 검증 방법이 본 후보의 새 영속객체·project operation·GET·읽기정책 승인까지 뜻하지 않는다. 본 후보는 기존 HUMAN OWNER를 승격하는 것이 아니라 **새 연산과 보호 metadata 노출 권한을 정의**하므로 별도 채택이 필요하다. 이번 문서 보완 승인으로 코드/SQL 작성·fakeDB 제품 구현을 시작하지 않는다. 실제 DB/정책 부여·Agent·새 writer·세션 교체·이전 확정은 계속 제외한다.

## 2. 정확한 operation·route·입력

새 project operation **createTransferPreparationRecord**를 기존 POST `/api/v1/projects/:projectId/commands`에 추가하는 후보다. 새 GET은 **/api/v1/projects/:projectId/transfer-preparations/:id/versions/1** 하나다. 목록/검색/다운로드/공유 API는 추가하지 않는다.

POST 외피는 기존 ProjectCommand의 exact 키다:
`{schemaVersion:1,projectId,commandId,clientId,controlGeneration,operation:"createTransferPreparationRecord",targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload}`.
actorId/로그인 세션·credentialGeneration은 요청값이 아니라 서버 인증 결과다.

payload exact 키:
`{assignmentRef,contextRef,roleRef,oldBindingRef,targetConnectionRef,intentExpiresAt,reason}`.
- assignmentRef 필수, 나머지 ref는 명시 null 허용. 모든 ref는 `{id:UUID,version:양의정수,contentHash:SHA256소문자64}`. contextRef가 null이면 CONTEXT_NOT_COLLECTED다.
- reason은 비어 있지 않은 유효 Unicode 문자열, UTF8 최대4096bytes. intentExpiresAt은 UTC ISO이며 새 저장 시 서버시각보다 뒤/최대30분 이내다. 전체 JSON 최대2MiB, 추가 키·inline body·caller snapshot/checkpoint·권한/성공 flag는422.
- baselineRefs/예산/context 항목/출처상태/능력은 caller가 넣지 않는다. 서버가 고정 assignment/context에서 도출한다. caller ref는 조회 권한·존재·관계·hash를 증명하지 않는다.
- 선택 role/oldBinding/targetConnection의 exact 보호 reader나 소속 판정이 없으면 신규 저장412 SOURCE_VERIFIER_NOT_CONNECTED다. UUID 형식 통과로 저장하지 않는다. 없는 선택은 null·미수집 gap으로 보관 가능하다.

## 3. server-derived metadata·교차 귀속

신규 저장 transaction에서 현재 보호 reader로 다음을 검사한다.
1. assignment는 같은 project의 불변 확정본/hash이며 현재 draft와 일치한다. context가 있으면 같은 project·동일 assignment fullref·manifest hash·그 임무의 baselineRefs/budgetRef를 exact 대조한다. context currentCheck CHANGED/UNAVAILABLE는 대체하지 않고 gap으로 남긴다.
2. roleRef가 있으면 project의 정확 RoleVersion이다. oldBindingRef가 있으면 roleRef 필수, binding의 project/role fullref와 exact 일치해야 한다. assignment와 role의 관계는 서버가 보관한 임무-책임 연결 증거로 판정한다. ownerRole 문자열의 이름 일치만으로 채택하지 않는다. 해당 증거 미구현은412, 다른 project/role 또는 접근 불가는 동일404다.
3. targetConnectionRef는 같은 project의 사용자가 현재 조회할 수 있는 연결 등록 version/hash다. 다른 project 연결/계정 원문으로 대체하지 않는다. 등록 사실은 실제 능력·계정 가용성 확인이 아니다. 미지원 사실은 TARGET_UNSUPPORTED, 능력 미검증은 TARGET_CAPABILITIES_UNVERIFIED다. credential/token/pathHint·실행 handle은 복사하지 않는다.
4. context sourceBindings의 문서/지식/사용자 지시 ref 각각은 기존 보호 reader와 그 현재 접근권을 검사한다. 접근 불가면 전체 새 저장을 동일404로 거절한다. 허용된 출처의 누락/제외/보호 상태는 본문 없이 비밀 없는 gap 코드만 보존한다. raw context snapshot·reason·대화본문을 복제하지 않는다.
5. checkpoint/실제 파일 차이·스풀/프로세스/중지/쓰기회수는 이번에는 수집하지 않는다. completed/unfinished를 caller가 제출하거나 context 문자열에서 사실로 추출하지 않는다. 해당 필드는 저장하지 않고 CHECKPOINT_NOT_COLLECTED/SOURCE_DIFFS_UNCOLLECTED/STOP_UNVERIFIED/WRITER_RECLAIM_UNVERIFIED를 보존한다.

권한 오류는 유효한 누락 gap으로 축소하지 않는다. 미지원·미수집과 타 프로젝트 접근 거절을 구분한다. 정상 ref의 현재 본문까지 검증하지 않았다면 ORIGINAL_BYTES_UNCOLLECTED를 해제하지 않는다.

### 3.1 설계의 6개 이해 항목과 기존 7개 맥락 code

설계 §6.2와 context-input.ts의 대응이다. **7개는 gap code가 아니라 맥락 slot code**다. DTO에 새 code나 6항목 대상 응답/판정/이해합격 필드를 추가하지 않는다.

| 설계 항목 | 기존 requiredContext code | 이번 수집 가능 사실 | 미수집/미확인 |
|---|---|---|---|
| 목적·이유 | PURPOSE_REASON | 고정 context의 slot 선택·포함/누락 metadata | 목적 이해·임무 이유의 의미 적합 |
| 기준·권한 | RULES_SCOPE, LATEST_INSTRUCTIONS | 각 slot 고정 출처 ref·포함/제외 상태 | 지시 이해·실제 전달/실행 권한 |
| 유지할 결정 | DECISIONS_REASON | 결정 출처 고정 ref·누락 여부 | 내용·이유 이해·결정 번복 없음 |
| 현재 위치 | CURRENT_POSITION | 선택 출처 ref·metadata 상태 | completed/unfinished·세부 진행·반복 금지 작업 |
| 실제 차이·공백 | ACTUAL_GAPS | slot 선택·포함/누락과 수집기 gap | 실제 소스 차이·checkpoint·스풀·중지/쓰기 회수 |
| 다음 행동 | NEXT_ACTION | 출처 ref·포함/누락 metadata | 행동/완료·중지 조건 이해·수용 |

contextRef=null이면 7개 모두 NOT_COLLECTED와 CONTEXT_NOT_COLLECTED다. context가 있으면 slot의 모든 항목 INCLUDED일 때만 METADATA_ONLY, 하나라도 누락/제외/보호 미포함이면 MISSING_OR_EXCLUDED다. 7개 code는 기존 순서로 정확 한 번씩 저장한다. METADATA_ONLY는 내용 완비/이해 합격이 아니다. 부족 slot이 있으면 단일 CONTEXT_REQUIRED_MISSING을 남기고 어느 slot인지는 requiredContext로 구분한다. 동적 CONTEXT_REQUIRED_MISSING:<code> 문자열은 이 후보 DTO에 넣지 않는다.

출처와 slot의 대응은 정확 contextRef를 기존 보호 reader로 재조회해 확인하며 union sourceRefs에서 본문/slot을 역추정하지 않는다. 본문/bodyRef 새 영속화·반환0이다. 원문은 **기존 해당 종류의 reader가 exact ref를 현재 권한으로 허용할 때만** 별도 조회한다. USER_INSTRUCTION은 고정 conversationId/MessageRef만 사용하고 새 원문 endpoint·거절된 provider를 연결하지 않는다. 필요한 보호/관계 reader가 없으면 선택 ref가 있는 새 저장·GET/replay는412 SOURCE_VERIFIER_NOT_CONNECTED이며 참조만 공개하는 우회도 없다.

## 4. 불변 저장 형태·hash

### 4.1 verifier 접점 계약표 — 실제 연결 전, 합성 port 후보

공통 입력 T는 호출자가 소유한 동일 transaction의 PoolClient, 현재 인증 actor(actorId/clientId/credentialGeneration/authSession), projectId, exact fullref, 현재 쓰기/읽기 policy fullref다. 정책·현재 제어·출처 잠금은 아래 reader가 모두 제공한다고 가정하지 않고 §6 표에서 별도 검사한다. 아래 함수는 **기존 source 접점**이지 이번 새 operation의 연결 승인이나 호출 실행 증거가 아니다. 현재 source-only 후보는 synthetic adapter만 사용한다.

| 대상 | 실제 기존 함수·파일 / T 외 입력 | 확인하는 사실·남는 verifier 공백 | 후보의 유한 실패 매핑·null 처리 |
|---|---|---|---|
| assignment | assignments/project-assignment-confirmations.ts의 ProjectAssignmentConfirmations.read(db,actor,pid,id,version), project-assignment-drafts.ts의 ProjectAssignmentDrafts.current(db,actor,pid,draftRef) | 확정 snapshot/검토·receipt·hash와 현재 draft. 호출자가 받은 ref를 요청 fullref와 별도로 exact 대조해야 한다. 전이/회수 잠금 전체는 미입증 | 필수 null/형식422 INPUT_INVALID, 미존재/접근404 NOT_FOUND, 정확 hash/기준 불일치409 VERSION_CONFLICT, 원 integrity503→아래 통합 오류 |
| context | context/project-contexts.ts의 ProjectContexts.read(db,actor,pid,id,1) | stored manifest/items/receipt 검증, 동일 assignment·baseline/budget는 추가 exact 대조. **이 read는 내부 sources.resolve로 원문도 읽으므로 metadata-only reader가 아니다.** 이번 실제 연결0, 합성 결과만 사용. 별도 보호 metadata verifier/잠금 미확정은 NOT_CONNECTED | optional null→7 slot NOT_COLLECTED/CONTEXT_NOT_COLLECTED. 선택 후 접근거절은 전체404, 관계/hash409, reader/안전한 수집 port 부재412 SOURCE_VERIFIER_NOT_CONNECTED. currentCheck UNAVAILABLE를 접근권 확인의 대용으로 쓰지 않음 |
| role | assignments/responsible-sessions.ts의 ResponsibleSessions.readRole(db,actor,pid,id,1) | 예약 역할 snapshot/receipt/project. 선택 assignment와 그 role의 보관 관계·현재성은 이 함수만으로 입증되지 않음. 별도 관계 verifier 미확정이면 미연결 | null→ROLE_NOT_SELECTED. 관계 port 부재412, 타 project/역할·접근거절404, 요청 fullref/hash 불일치409, integrity503 |
| oldBinding | 같은 파일 ResponsibleSessions.readBinding(db,actor,pid,id,version) | 예약 binding 및 session snapshot·role/connection 참조를 검증. 실제 writer 회수나 세션 가동 보증0. 요청 roleRef/assignmentRef와의 exact 관계·회수 잠금 port는 별도 | null→OLD_BINDING_NOT_COLLECTED. binding 선택에 role null은422 INPUT_INVALID. 불일치409/타귀속404, verifier 부재412. 정상 예약도 STOP/WRITER gap 유지 |
| target | connections/project-candidates.ts의 ProjectConnectionCandidates.read(db,actor,pid,id,version) | CANDIDATE_STORED 불변 원문/명령·kind·만료를 확인. CONNECTION_CANDIDATE만 선택. 실제 등록 연결/Agent 능력 verifier는 아님. §3의 '연결 등록'을 이 보관 후보로 자동 치환하지 않음 | null→TARGET_NOT_SELECTED. 실제 연결 등록 ref의 reader 부재412; 합성 port도 미검증 능력은 TARGET_CAPABILITIES_UNVERIFIED. 접근거절404/hash409. 문서 보고만으로 TARGET_UNSUPPORTED/지원합격을 만들어내지 않음 |
| DOCUMENT_VERSION | documents/project-documents.ts의 ProjectDocuments.version(db,actor,pid,id,version); originalText(db,pid,artifactRef)는 version의 보호 결박 뒤에만 기존 접점 | version도 보호 artifact bytes를 읽는다. originalText는 actor 입력이 없어 독립 인가함수로 사용 불가. 문서 fullref·body exact 보호가 필요한 실제 adapter는 이번 미연결, 본문 저장/노출0 | 권한/격리 ARTIFACT_QUARANTINED/보호거절은 준비 저장·GET/replay 전체404. 미설정 저장소/허용 reader 부재412. hash/원문 integrity503, 형식422. null 출처는 context의 명시 미선택 slot에서만 gap |
| KNOWLEDGE_VERSION | knowledge/knowledge.ts의 ProjectKnowledge.read(db,actor,pid,id,version) | project/entry·불변hash·body·상태/검토·보호 검사를 수행. 본문까지 읽는 기존 경로이며 이번 실제 호출0. 상태 EXCLUDED/SUPERSEDED와 권한거절을 구분 | 현재 허용된 상태 metadata만 EXCLUDED gap에 반영 가능. 보호거절/KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED는 전체404, integrity503. adapter 부재412. sourceRef가 있으면 optional처럼 조용히 누락 불가 |
| USER_INSTRUCTION | knowledge/conversations.ts의 ProjectConversations.readMessage(db,actor,pid,conversationId,messageId) | 저장 row/snapshot hash·조회 CID·HUMAN·body 보호를 검사하지만 USER_MESSAGE도 반환하며 요청 MessageRef/hash를 인자로 받지 않는다. 선택 MessageRef exact/hash·선택 CID·USER_INSTRUCTION kind의 추가 대조는 별도 verifier 책임이다(context/context-sources.ts의 resolve에서 readMessage 결과를 대조하는 선례). 이 추가 verifier는 미연결·합성 adapter만 가능하다. 새 FN14 원문 GET/대체 provider를 만들지 않으며 DD166F 등 기존 특정 거절 범위는 BLOCKED다 | context에 선택 없으면 slot gap. 선택 있는데 허용된 verifier가 없으면412, 다른 CID/접근/격리404, hash/내용 integrity503. message에 가짜 version을 붙이지 않음 |

위 표의 내부 원오류를 응답에 그대로 반사하지 않는다. 인증401 AUTH_REQUIRED, 현재 정책/제어403 PROJECT_OPERATION_DENIED/PROJECT_CONTROL_REQUIRED, 미설정412 PERMISSION_POLICY_UNCONFIGURED, 입력422 INPUT_INVALID, 관계/hash409 VERSION_CONFLICT, 보호거절404 NOT_FOUND, 미연결412 SOURCE_VERIFIER_NOT_CONNECTED, 손상/알 수 없는 reader 오류503 PREPARATION_INTEGRITY_FAILED의 유한 후보로 정규화한다. 기한410 INTENT_EXPIRED·경쟁409 CONCURRENT_CHANGE·멱등409 IDEMPOTENCY_CONFLICT·승인미연결412 PREPARATION_APPROVAL_NOT_CONNECTED는 각 기존 절 조건에만 사용한다. raw 메시지/상태·출처ref를 에러에 반사하지 않는다. sourceRef별 verifier가 하나라도 미연결/거절이면 나머지 metadata/receipt까지 전체 미반환이다.

새 namespace/table 후보 **anvil.transfer_preparation_records**, **anvil.transfer_preparation_record_versions**. 기존 transfers/role_bindings/제어/lease/문서표는 변경하지 않는다. 아직 SQL 없음.
- records: id UUID PK, project_id NOT NULL FK→anvil.projects(id), creator_user_id/creator_client_id NOT NULL 복합 FK→anvil.clients(user_id,id), version=1 고정, created_at NOT NULL. UNIQUE(project_id,id). FK는 ON DELETE RESTRICT 후보이며 기존 원본 cascade 삭제를 추가하지 않는다.
- versions: record_id/project_id NOT NULL 복합 FK `(project_id,record_id)`→records(project_id,id), version=1, snapshot_json, content_hash, command_id, policy_ref_json, created_at NOT NULL. PK(record_id,version), UNIQUE(project_id,command_id). `(project_id,command_id)`→기존 anvil.commands(project_id,id)는 **commands.id 내부 UUID**를 참조한다. application role UPDATE/DELETE 금지, 정상 command/receipt·같은 actor/project 결합 guard가 필요하다.
- snapshot exact 키: `{schemaVersion:1,id,projectId,version:1,kind:"TRANSFER_PREPARATION_RECORD",state:"PREPARATION_ONLY",assignmentRef,contextRef,roleRef,oldBindingRef,targetConnectionRef,baselineRefs,budgetRef,sourceRefs,requiredContext,gaps,reason,intentExpiresAt,observedAt,preparationStored:true,manifestStored:false,bindingFrozen:false,ready:false,resumeAuthorized:false,executionAuthorized:false,dispatchPerformed:false}`.
- sourceRefs는 최대207개 고유 출처의 exact union이다. DOCUMENT_VERSION/KNOWLEDGE_VERSION은 `{kind,ref:{id:UUID,version:양의정수,contentHash:SHA256},conversationId:null}`, USER_INSTRUCTION은 `{kind:"USER_INSTRUCTION",ref:{kind:"CONVERSATION",id:UUID,contentHash:SHA256},conversationId:UUID}`다. 후자는 기존 MessageRef이며 version을 추가하지 않는다. §2의 ref 규칙은 POST payload의 versionRef에 적용한다. CID는 고정 context sourceBinding에서 도출하고 id 역조회로 추측하지 않는다. 본문/bodyRef/URL·파일경로는 저장하지 않는다.
- requiredContext는 기존7 code가 정확히 한 번씩인 `{code,state:"NOT_COLLECTED"|"MISSING_OR_EXCLUDED"|"METADATA_ONLY"}[]`. 각 출처의 reason/본문을 포함하지 않는다.
- gaps는 중복 없는 고정 코드 최대256개. 허용 집합은 CONTEXT_NOT_COLLECTED/CHECKPOINT_NOT_COLLECTED/SOURCE_DIFFS_UNCOLLECTED/STOP_UNVERIFIED/WRITER_RECLAIM_UNVERIFIED/ORIGINAL_BYTES_UNCOLLECTED/TARGET_UNSUPPORTED/TARGET_CAPABILITIES_UNVERIFIED/ROLE_NOT_SELECTED/OLD_BINDING_NOT_COLLECTED/TARGET_NOT_SELECTED/CONTEXT_REQUIRED_MISSING/CONTEXT_EXCLUDED/CONTEXT_REDACTED/CONTEXT_CURRENTNESS_UNVERIFIED/RECORD_DURABILITY_UNVERIFIED/SOURCE_AUTHORIZATION_UNVERIFIED/UNDERSTANDING_UNREVIEWED/TRANSFER_CONFIRMATION_UNVERIFIED다. 임의 문자열·동적 suffix·기존 context.unverified 원문을 그대로 복사하지 않는다. CHECKPOINT_NOT_COLLECTED/SOURCE_DIFFS_UNCOLLECTED/STOP_UNVERIFIED/WRITER_RECLAIM_UNVERIFIED/ORIGINAL_BYTES_UNCOLLECTED/RECORD_DURABILITY_UNVERIFIED/SOURCE_AUTHORIZATION_UNVERIFIED/UNDERSTANDING_UNREVIEWED/TRANSFER_CONFIRMATION_UNVERIFIED는 이번 범위에서 항상 유지한다. durability는 transaction 저장 성공만으로 실행기 미전송 회수확인이 되지 않으므로 유지한다.
- content_hash는 canonicalJson(snapshot)의 SHA256. public fullref의 contentHash와 같다. row metadata는 snapshot hash 밖이지만 DB guard로 결합한다. 준비저장 true와 정식 manifest저장 false는 항상 함께 표시한다.

실제 키 근거는 0001_projects_access.sql의 projects(id)/clients(user_id,id), 0011_authorization.sql의 commands(id) PK·UNIQUE(project_id,id)다. 새2표 사이 FK/guard는 **새 제약 후보**이며 현재 존재한다고 주장하지 않는다. assignment/context/role/binding/target JSON fullref는 물리 FK가 아니다. 각 기존 키와 hash·소속/현재권한 검증을 확정할 때까지 verifier 미연결이며, 없는 복합 UNIQUE나 JSON 존재로 이를 대체하지 않는다.

기존 persistProjectReceipt 반환 `.id`를 versions.command_id에 넣는다. public receipt.commandId는 요청 외부 중복키이며 operationId/authorizationReceiptRef.id와도 다르다. 외부 commandId를 위 FK에 넣지 않는다. guard는 records creator/project와 commands actor_id/client_id/project_id·scope_kind=PROJECT/scope_id=project_id·operation/payload request_hash·expected_version=0/targetId=null·정확 policy_ref, APPLIED result_ref의 ref/record hash 및 authorization receipt/audit의 동일 연산을 결박한다. FK로 증명되지 않는 부분은 명시 guard/원자 검증 후보로 남긴다. snapshot에 receipt/최종 result hash를 넣지 않아 snapshot hash→receipt(ref)→snapshot 해시 순환을 만들지 않는다.

## 5. 현재 권한·조회 노출

기존 인증/프로젝트 멤버/정책 helper의 검사를 약화하지 않는다. **새 쓰기/읽기 operation을 기존 AUTO 정책에 자동 추가하지 않는다.**
- POST: 현재 HUMAN 로그인·미만료 session/credential·actor.client 일치, project OWNER·현재 단독제어 및 exact controlGeneration, 현재 명시 정책의 createTransferPreparationRecord AUTO 허용 필요. DENY 우선, 무정책412/허용없음403. REQUIRE_APPROVAL 또는 approvalRef nonnull은412 PREPARATION_APPROVAL_NOT_CONNECTED로 거절, 기존 일회승인을 임의 소비하지 않는다.
- GET: 현재 HUMAN 로그인·현재 client/credential·project OWNER이며 creator_user_id=actor인 기록만 허용. 별도 현재 readTransferPreparationRecord AUTO 정책 필요. 제어 미보유여도 읽기만 허용하지만 타 작성자/VIEWER에 공개하지 않는다. GET에 쓰기 grant나 구 generation을 재사용하지 않는다. 새 기기라도 현재 인증 client로 조회하되 원 creator client는 이력일 뿐 권한으로 승계하지 않는다.
- POST replay도 위 POST 현재권한과 GET 읽기정책/creator 검사 모두 통과해야 과거 receipt/data를 반환한다. 새 POST 역시 읽기정책을 요구하여 저장 직후 결과 노출과 GET의 권한이 어긋나지 않게 한다.
- reason·fullref·출처관계·gaps·receipt 역시 보호 metadata다. 응답 직전 출처 각각의 현재 보호상태/접근권을 다시 검사한다. 하나라도 회수/격리되면 body·ref·reason·건수·receipt 전부 미반환(동일404). snapshot을 편집/마스킹해 원 hash로 반환하지 않는다.
- source가 새 버전으로 바뀌어도 과거 버전이 여전히 열람 가능하면 과거 준비본 조회는 허용한다. 이는 현재 적합/재사용 허가가 아니다. 과거 본문을 이 GET으로 열지 않고 기존 원문 API의 최신 보호검사를 별도로 거친다.
- 인가 전 타 project/작성자/id/version/source의 상세 차이는 동일404; 인증401·현재주체 제어/정책403/412는 기존 공통 코드. 오류/log/audit에는 reason/원문/민감 경로를 반사하지 않는다. 캐시 no-store, URL/query에 본문/이유를 넣지 않는다.

GET와 replay는 저장 snapshot뿐 아니라 commands.result_ref 안의 과거 receipt도 현재 출처권한 검사 전 직렬화/반환하지 않는다. 원문 차단 뒤 recordRef/targetId/개수/이유·부분 성공·receipt만 반환하는 경로도 금지한다. 원문 보존은 계속하되 해당 요청의 보호 metadata 응답은0이다. verifier 자체 미연결412와 확인된 접근 거절404를 혼동해 참조 존재를 공개하지 않는다. 실제 actor/member/credential·정책·출처 회수/격리 mutation과 조회 transaction의 충돌 잠금이 입증되지 않으면 이 경로는 미연결로 둔다. fakeDB의 순차 성공은 그 잠금 보장이나 실제 PG 권한 격리를 입증하지 않는다.

## 6. 새 명령·exact replay·동시성·기한

한 transaction에서 순서를 분리한다.
1. 크기/형식→현재 인증·멤버/OWNER·client/제어세대/쓰기와읽기정책 및 보호 조회 권한 확인. 권한/정책 회수 뒤 command row를 읽어 존재·내용을 노출하지 않는다.
2. project/actor/외부 commandId로 기존 command를 탐색한다. 실제 UNIQUE는 `(scope_kind,scope_id,actor_id,operation,command_id)`이며 project/actor/commandId만의 DB UNIQUE는 없다. 기존 projectReplay처럼 이 범위에 복수 operation이 나타나면409로 거절한다. 신규 writer들 간 commandId 재사용을 직렬화할 공통 잠금이 보장되지 않으면 후보를 연결하지 않는다. 있으면 operation·canonical requestHash·원 actor/client/controlGeneration이 exact 같은 APPLIED만 채택한다. result_ref의 준비기록·hash/creator 및 현재 조회보호를 검사한 뒤 원 receipt를 반환한다. 새 CAS/원 intent 기한/assignment 최신 head는 여기서 다시 적용하지 않는다. 이력 재확인은 현재 적합으로 승격하지 않는다. 서로 다른 payload/client/세대는409다.
3. 새 command일 때는 **적격성 판단 전에** project→control→policy→source 종류/id 오름차순으로 head/보호·관계 행을 잠근다. source 식별을 위한 사전 읽기는 잠금대상 탐색에만 쓰며 값/권한을 확정하지 않는다. PostgreSQL READ COMMITTED에서 잠금 대기가 끝난 뒤 별도 SELECT로 현재 행/관계를 다시 읽고 현재 인증·멤버/OWNER·client/제어세대·쓰기/읽기정책·출처 보호를 재검사한다. 이후에만 intentExpiresAt/정확 최신 assignment·context 관계/선택ref 및 target 귀속/expectedVersion=0·targetId=null·현재 baseline을 검증하여 canonical refs/current policy fullref를 고정한다. 잠금 전 값과 다르면409·전체 rollback이며 오래된 검증값을 저장하지 않는다.
4. 잠금은 transaction 종료까지 유지한다. 해당 정책/권한회수·head 변경·격리/귀속 변경의 **모든** mutation 경로도 같은 상위 보호 행과 같은 순서의 충돌 잠금을 사용해야 한다. 삽입/회수로 판정이 바뀌는 관계는 기존 행 부재에도 project/부모 head 잠금으로 직렬화한다. 이 보장이 없는 source verifier는412 SOURCE_VERIFIER_NOT_CONNECTED다. replay도 원 결과 반환 전에 같은 방식으로 현재권한/보호를 잠금 후 재검사하되 과거 intent기한/최신head CAS는 적용하지 않는다. deadlock/직렬화충돌은 전체 rollback·409 CONCURRENT_CHANGE이며 자동재전송0이다.
5. records/version+command APPLIED+authorization receipt+audit를 원자 저장한다. receipt status APPLIED는 준비기록 저장만 뜻하며 data flags를 고정한다. 감사·hash·guard·receipt 실패는 전부 rollback, 반쪽기록/승인소비0.
6. 같은 command 동시 요청은 unique 충돌 후 현재권한부터 재검사해 exact APPLIED replay로만 돌려준다. 다른 command는 독립 새 준비본이다(준비본 생성은 role 상태 CAS/동결이 아니다). 새 요청의 입력 최신성 경쟁은409이고 기존것을 덮지 않는다.

기한은 신규 의도 접수용이다. 만료 후 새 저장은410 INTENT_EXPIRED, 원 APPLIED의 적법한 결과 재확인은 허용한다. 준비본은 만료 후에도 보호 이력으로 보존하고 GET에 intentExpired=true/usableForTransfer=false를 별도 응답한다.
불확실한 네트워크 응답은 UI UNKNOWN이다. 자동재전송/새 command 생성0. 사용자가 명시 재확인할 때 **같은 commandId와 동일 payload**를 보존해 재전달하며, 이는 위 순서로 미저장이라면 새 저장이 될 수 있음을 표시한다. 만료·옛세대이면 자동갱신하지 않는다.

### 6.1 잠금·회수 계약표 — 기존 mutation 개편 승인 아님

아래는 §6 순서를 실제 접점과 대조한 **합성 transaction port 순서 명세**다. 인증 prefix(u/s/c 잠금)를 먼저 수행한 뒤 project/member→control(POST만)→policy→source 종류/id 정렬의 부모/head/보호/관계 행 순서다. 기존 인증 메서드를 임의 재작성하거나 표의 잠금을 이미 구현됐다고 주장하지 않는다. 모든 관련 mutation의 충돌 규약이 입증되지 않은 행은 NOT_CONNECTED다.

| 의존 | 확인한 기존 reader·mutation 접점 | 필요한 충돌 상위행·잠금 후 재읽기 / 현재 한계 |
|---|---|---|
| actor/session/client/credential | access/repository.ts의 authenticated/#lockedSession는 users/auth_sessions/clients를 FOR UPDATE OF u,s,c. logout은 auth_sessions FOR UPDATE·회수, changePassword/recover는 사용자/credential generation·세션 회수 | 기존 인증 잠금 prefix를 유지하며 현재시각/만료·revoked/generation 재검사. logout/changePassword/recover 등 모든 회수와 정확 순서 호환·재인증 만료시점 보장은 이 표만으로 입증 안 됨. 합성은 잠금 대기 후 만료/회수 주입, 실제 adapter 미연결 |
| 회원/project/control | access/project-command.ts projectMember(lock=true)는 projects/project_members FOR UPDATE, currentProjectController는 추가 project_control FOR UPDATE. projects/repository.ts createProject가 최초 회원/control 생성 | pid 부모→해당 회원→control의 현재 OWNER/client/generation 재읽기. 현재 조사 source의 일반 회원회수/제어이전 mutation 제공자는 확인되지 않음. FN15 미구현/없는 행을 안전으로 보지 않고 모든 mutation 규약 확정 전 미연결. GET는 현재 읽기권만, control 보유를 요구하지 않음 |
| 명시 정책 | project-command.ts currentPolicy는 permission_policies FOR SHARE, ProjectPolicyRepository.command의 savePermissionPolicy 분기가 head 저장/개정 | project/control 뒤 permission_policies 부모 및 정확 policy version을 읽고 쓰기/읽기 AUTO·DENY·기한 재검사. 정책 최초 부재/생성도 project 부모에서 직렬화해야 함. 기존 helper만으로 새 read operation·회수 경쟁 전체 보장0 |
| assignment/context head·관계 | project-assignment-drafts.ts save/current, project-assignment-confirmations.ts confirm/read; context/project-contexts.ts save/read | assignment 부모/head→고정 version·검토 관계→context 부모/항목을 source 순서로 잠금 후 재읽기. 현재 read의 일반 SELECT는 새 보호 잠금을 대신하지 않음. assignment와 role 관계 생성/삭제의 공통 상위행 규약 미확정→미연결 |
| DOCUMENT·artifact 격리 | project-documents.ts save/version/#artifact, 기존 documents/artifacts 행 조회 | documents 부모/head·정확 version·artifacts 보호행을 동일 transaction에서 잠금/재읽기. 실제 blob 수명/격리 mutation 전체의 충돌 함수는 이번 조사로 확인되지 않음. DB 행 잠금만으로 외부 bytes 불변을 보장하지 않으며 새 실제 adapter 미연결 |
| KNOWLEDGE·지시 supersession | knowledge/knowledge.ts save/correct/exclude/review/confirm, conversations.ts append/readMessage | knowledge_entries 부모/head·버전/event, conversations 부모/고정 message·supersedes 관계의 삽입도 공통 부모 잠금으로 직렬화. 현재 읽기/새 지시 삽입이 모두 같은 잠금 순서를 지킨다는 보장 없음. currentConstitutionRecord의 적용 관계도 포함해야 하며 미연결 |
| role/binding/target 귀속 | responsible-sessions.ts define/bind/readRole/readBinding, project-candidates.ts command/read | role 부모→binding/session 관계, candidate 부모/head/만료를 정확 fullref로 재읽기. 실제 연결 등록·새세션 교체/회수 mutation은 이 예약 경로와 다름. 없는 verifier/잠금 port는 미연결이며 새 세션 생성0 |
| 외부 commandId/replay·응답 | project-command.ts projectReplay/persistProjectReceipt, 기존0011 UNIQUE는 operation 포함 | 실제 키는 (scope_kind,scope_id,actor_id,operation,command_id). 교차operation의 같은 외부키는 별도 project/actor/외부키 탐색·충돌 직렬화 규약이며 기존 UNIQUE가 해결하지 않음. 모든 writer 공통 잠금 미입증이면 미연결. GET/replay는 잠금 후 현재권한 재검사까지 serializer 호출0·receipt/ref/count0. 과거 intent/최신head CAS는 replay에 재적용하지 않음 |

회수와 응답의 선형화 경계는 현재권한 재검사·보호 metadata 응답값 확정까지 같은 transaction의 충돌 잠금을 유지하는 지점이다. commit 뒤 이미 허가된 응답의 네트워크 전달을 회수할 수 있다는 주장은 하지 않는다. fakeDB는 순서와 금지 serializer 호출만 검증하고 실제 PG 대기/동시성·모든 mutation 경로의 잠금 준수를 증명하지 않는다.

### 6.2 원자 저장 제약표 — 의사명세, SQL 미작성

순서는 잠금/현재 검증→canonical snapshot/ref 고정→records INSERT→기존 persistProjectReceipt로 command/authreceipt/audit 생성→versions INSERT→지연 양방향 검증→COMMIT 후보이다. 즉시 FK를 위해 versions.command_id는 이미 생성한 내부 commands.id를 사용한다. 기존0011의 commands↔authorization_receipts FK는 DEFERRABLE INITIALLY DEFERRED다. 아래 신규 guard/역방향 제약은 **존재하는 제약이 아니라 채택 대상**이며 기존 공유 guard 교체 승인이 아니다.

| 대상·조건 | 즉시 거절 후보 | 지연 COMMIT 검사·fakeDB 실패 주입 |
|---|---|---|
| records/version 식별·immutable | records PK(id), UNIQUE(project_id,id), projects(id) FK·clients(user_id,id) FK, version PK(record_id,version)·UNIQUE(project_id,command_id)·records(project_id,id) 및 commands(project_id,id) FK. version=1·hash 형식·정확 snapshot/권위 flags·id/project/ref 일치 CHECK/guard. UPDATE/DELETE app권한0+guard | records만 생기고 version 없는 orphan은 역방향 deferred guard로 commit 거절. 동일 snapshot 중복 저장을 허용해도 동일 command의2version/2record는 거절. fakeDB records INSERT 후 실패·version INSERT 누락 주입 |
| command APPLIED↔record/version | versions INSERT 때 내부 commands.id/project·actor/client=records creator·operation=createTransferPreparationRecord·expected_version=0·요청 targetId=null·request_hash/policy_ref 일치. 틀린 외부 UUID/내부 UUID·다른 project/actor/client/operation/hash는 즉시 guard 거절 | 새 operation의 APPLIED command당 정확1 version/record를 deferred 역방향 검사. receipt-only commit/다른 operation receipt에 record 붙이기/정확 result_ref.ref·record/hash 불일치 모두 commit 거절. 기존 commands의 operation 포함 UNIQUE 외 다른 UNIQUE를 가정하지 않음 |
| authorization receipt 양방향 | 기존0011 authreceipt.command_id UNIQUE, (scope_kind,scope_id,command_id)→commands(scope_kind,scope_id,id) 및 commands→authreceipt(scope_kind,scope_id,command_id,id)의 실제 deferred FK 사용. subject actor/client·exact policy/scope_digest·승인참조null은 신규 scoped guard | command APPLIED에 authreceipt 누락/다른 command·주체·정책·digest 결합은 commit 거절. 기존 FK만으로 JSON 주체/policy가 검증된다고 보지 않음. authreceipt 생성 직후 실패 주입→전부 rollback |
| audit 양방향 | 기존0011 audit_events PK(project_id,server_sequence), UNIQUE(event_id)·UNIQUE(project_id,event_id), (project_id,command_id)→commands(project_id,id) FK. 해당 operation/command/actor/client/target ref/policy·scope_digest/outcome=APPLIED/source_kind=HUMAN_COMMAND의 정확 대응은 guard 후보 | 해당 APPLIED command에 정확1 APPLIED 감사와 version 존재를 deferred 검사. 기존 audit에는 (project_id,command_id) UNIQUE가 없으므로 이를 FK 대상으로 쓰거나 '이미1건보장'이라 주장하지 않음. 감사 누락/중복/다른 operationId·target/hash/중간실패는 전체 rollback |
| transaction/권한 격리 | 동일 db/동일 transaction 밖 write·autocommit·분리 receipt 저장을 port에서 거절. app direct INSERT도 위 guard 통과 없이는0, UPDATE/DELETE0. 승인소비·binding/control mutation0 | COMMIT 전 어느 검증 실패도 command/authreceipt/audit/2표 전체 rollback. fakeDB는 각 단계 실패/지연 guard를 모사할 뿐 PG trigger/FK/app-role 직접DML 증거가 아님. 실제 SQL/실행 전까지 이 보장은 NOT_RUN·actual app 미연결 |

## 7. 정확한 응답·원문 보호·보존/rollback

POST는 기존 command receipt 외피 그대로 `{operationId,commandId,projectId,status:"APPLIED",targetId:id,version:1,data:{ref,record:snapshot,preparationStored:true,manifestStored:false},evidenceRefs:[],warnings:[],serverReceivedAt}`.
GET은 `{projectId,ref,record:snapshot,observedAt,currentStatus:{intentExpired:boolean,usableForTransfer:false,sourceCurrentness:"NOT_REVALIDATED"},preparationStored:true,manifestStored:false}`. GET의 observedAt은 이번 조회, snapshot.observedAt은 저장 관측이다. 최신 head/능력 적합 보증 없음.
UI 후속 연결 시 '인계 준비 기록을 보관함 — 아직 동결·이전·재개하지 않음'으로 표시한다. 이번 후보에는 화면 구현이 포함되지 않는다.

저장 데이터는 보호 DB/기존 인증 저장 경계에서만 관리하고 새 외부저장/전송/원문파일 복사0. 알려진 비밀표식 입력 reason은422, 탐지완전성 주장은 하지 않는다. 사후 의심 자료는 일반 조회 차단·기존 격리 정책을 따르고 immutable 원본/감사 자동삭제0. 원문이 회수되면 새 보관본에서 ref/이유만 꺼내주는 우회0.
기존 프로젝트 보존 정책을 적용하며 새 자동 purge·백업 대상/외부 반출0. 코드 revert/기능 비활성화는 가능하지만 **기존 영속 기록 삭제가 rollback은 아니다**. 생성기록은 보호 보존하며 실제 삭제/후속 schema 정리는 별도 명시 결정 없이는 하지 않는다.

## 8. 채택 후 최소 검수 계획 — 현재 실행0

- [ ] 계약 parser: 추가키·2MiB/4096bytes 초과·비밀/잘못ref/기한, 성공 flag/body 직접주입 거절.
- [ ] 정상 합성: exact 임무/context→공백 보존 저장→동일명령 replay→같은 hash GET. preparationStored=true/manifestStored=false·실행false.
- [ ] 교차project/role/binding/target·임무/context 기준/예산 자기재해시 불일치·출처조회거절, 미구현 verifier412, target 미지원 gap.
- [ ] 회수/만료session·옛client/세대·현재정책DENY/읽기권회수·출처격리 뒤 GET와 replay의 receipt/metadata/body 노출0.
- [ ] APPLIED 후 원의도 만료/새 source head: 현재 접근 가능하면 과거 exact replay, 새로운 command는 만료/최신성 거절. UNKNOWN 자동재전송0.
- [ ] 동시 exact command1저장/1receipt, 다른payload409·감사실패 전부 rollback·DB 직접 UPDATE/DELETE·반쪽 FK 거절.
- [ ] 코드의 pure/fake 결과, 격리 PG/API 검증, 정식DB 적용, 화면/실이전은 각각 구분한다. 이번 문서 검토를 어느 것의 PASS로도 표시하지 않는다.
- [ ] exact 응답 parser: §2 payload·§4 snapshot·§7 POST/GET의 추가/누락 키, public ref와 snapshot id/project/version/hash 불일치, 준비 true/manifest false와 다른 권위 flag, 7 slot 중복/누락/순서·미지 code, 동적 gap·본문/bodyRef·completed/unfinished 주입을 거절한다. 과거 snapshot을 현재 상태 flag로 재작성하지 않는다.
- [ ] fakeDB 반례: 내부 commands.id와 외부 commandId를 다르게 설정하고 정확 내부 FK/creator/policy/result hash를 검사한다. authorization receipt/audit/version 어느 단계 실패도2표·command APPLIED의 부분 commit0, 같은 외부키 다른 operation의 충돌, 없는 role-임무 관계 verifier·없는 부모 잠금은 미연결로 검증한다.
- [ ] 회수 경쟁 모사: 첫 확인 후 회원/정책/출처 보호가 바뀌면 잠금 후 재읽기에서 전체 중단한다. GET/replay는 response serializer에 들어가기 전에 거절하고 receipt/record/ref/건수 일부도 반환하지 않는다. 과거 source head 변경만 있고 exact 과거 원문 접근이 허용된 경우와 회수/격리를 구분한다. fakeDB는 호출 순서·분기만 입증하며 실제 PG lock/rollback·동시성·app role 직접 DML 차단은 NOT_RUN이다.
- [ ] 독립 정적 검토: 기존 operation/GET/2표·범위 불변, 6항목↔7 code·수집/미수집, 현재권한/회수/내부키·해시순환·원자성 후보를 수행자와 분리해 검토한다. 현재 이 문서는 검토 요청 가능한 후보일 뿐 독립 검토 PASS가 아니다.

이번 2026-10-25 문서 delta의 영향은 이 후보의 채택 판단에만 한정한다. 제품 route/operation/DTO/SQL/정책 목록·권한·WORK_PLAN/WORK_STATUS는 수정하지 않는다. 독립 검토의 지적·미해결 및 채택 전후 근거는 기존 절차의 기록으로 보존한다. 문서 보완 rollback은 이번 delta만 되돌려 기존9절 후보를 유지하는 것이며 검토/결정 이력을 지우지 않는다. 향후 코드 rollback도 §7의 불변 기록/감사 보호 보존 원칙을 따른다.

## 9. 필요한 한 건의 직접 결정

위 exact 문서를 기준으로 준비전용 영속객체·명령/조회·새 명시 정책 계약을 **미적용 SQL/코드/합성검증 범위**에서 채택할지 결정한다. 기존 FN14 전체를 재승인하는 질문이 아니다. 실제 DB/정책 부여·서비스·Agent/동결/실이전/재개는 제외한다. 승인 전 본 후보는 실행 기준이 아니다.

2026-10-25 현재 지원 결정은 상세계약 문서 보완·독립 정적 검토까지다. 위 채택 질문의 답으로 간주하지 않는다. 남은 채택 조건은 실제 reader/관계검증기의 정확 입력·결과/보호 잠금과 모든 회수 mutation의 충돌 규약, 기존 FK로 증명되지 않는 guard·역방향 receipt 원자 제약, 연산별 명시 정책과 코드/미적용 SQL·parser/fakeDB 구현 범위를 확정하는 것이다. 이를 입증하지 못하는 source는 미연결로 유지하며 실제 보호원문 신규 조회·DB 적용·서비스·Agent·세션 교체·이전 확정을 별도 승인 없이 수행하지 않는다.

채택 검토용 정확 파일 후보는 `apps/server/modules/transfers/preparation-record-input.ts`(exact DTO/parser), `preparation-record-verifiers.ts`(위 표의 transaction port·합성 adapter, 기본 NOT_CONNECTED), `preparation-record-store.ts`(동일transaction/권한·replay·2표/receipt 결박 port), `preparation-records.ts`(in-process 조합), `tests/unit/FN14/preparation-record-input.test.ts`·`preparation-record-store.test.ts`다. 모두 새 후보 이름이며 현재 존재/구현 완료를 뜻하지 않는다. 미적용 SQL 후보는 `db/migrations/FN14_transfer_preparation_records.sql.pending`이며 정식 순번/manifest 등록은 채택 뒤 충돌 확인 전까지 하지 않는다. 기존 접점은 위 표의 reader와 AccessRepository의 transaction·project-command의 receipt 생성이고, 기존 preparation-analysis.ts는 합성 분석 그대로 보존한다. 기존 DTO/operation 목록·app.ts/route/공유인증 mutation은 이번 source-only 후보에서 수정하지 않는다.

source-only 허용범위를 나중 채택하더라도 활성화는 **미적용 SQL 의사제약 구현·DTO/parser·transaction port/fakeDB·in-process 합성만**이다. 실제 app wiring/정책 부여/DB·socket·외부원문·Agent0, source port는 기본 NOT_CONNECTED다. synthetic fixture의 허용 결과를 실제 reader/권한 근거로 주입하거나 합성 성공을 사용자 준비기록 기능 완료로 세지 않는다. 위3표 보완은 독립 정적 재검토가 필요하며 현재 PASS를 주장하지 않는다.
