# FN14 인계 준비 기록 저장·조회 계약 후보

- 상태: **DRAFT / NOT_ADOPTED**, 2026-10-21, Project Main 어울. 이 파일은 직접 채택 판단용이며 구현 지시·새 API 활성화·SQL 작성/적용·권한 부여가 아니다.
- 근거: 설계 §8.2, FUNCTION_WORK FN14, INTERFACES §13.5. 기준 코드 6f5b646f093d302013a2bdbe3b572ee1198ed163.
- 기존 B는 caller 없는 합성 계산뿐이다. 본 후보는 별도 영속객체/명령/조회권을 추가하는 delta다. 준비기록을 정식 TransferManifest로 바꾸거나 원 binding을 동결하지 않는다.

## 1. 결정 범위와 제외

권장: 아래 준비전용 저장·조회 계약과 **미적용 forward SQL·코드·합성검증**만 한 건으로 채택한다. 실제 개발 DB 적용·사용자 정책 부여·서비스 반영·원문 외부전송·유료 호출은 별도다.
대안: 저장 없이 기존 B 계산을 유지하면 새 계약은 없지만 사용자는 준비본을 다시 열 수 없다. 정식 prepareTransfer 전체 구현은 동결/회수·능력/이해검수까지 필요하므로 이 후보의 대체 구현으로 축소하지 않는다.

준비기록은 과거 시점의 자료 선택과 공백을 남긴다. 현재 상태 확인·중지/회수·안전·대상 능력 보증·새 역할 연결·이전/재개 권한이 아니다. 확정/이전 상태로 전환하는 연산은 이 후보에 없다.

## 2. 정확한 operation·route·입력

새 project operation **createTransferPreparationRecord**를 기존 POST `/api/v1/projects/:projectId/commands`에 추가하는 후보다. 새 GET은 **/api/v1/projects/:projectId/transfer-preparations/:id/versions/1** 하나다. 목록/검색/다운로드/공유 API는 추가하지 않는다.

POST 외피는 기존 ProjectCommand의 exact 키다:
`{schemaVersion:1,projectId,commandId,clientId,controlGeneration,operation:"createTransferPreparationRecord",targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload}`.
actorId/로그인 세션·credentialGeneration은 요청값이 아니라 서버 인증 결과다.

payload exact 키:
`{assignmentRef,contextRef,roleRef,oldBindingRef,targetConnectionRef,intentExpiresAt,reason}`.
- assignmentRef 필수, 나머지 ref는 명시 null 허용. 모든 ref는 `{id:UUID,version:正整数,contentHash:SHA256소문자64}`. contextRef가 null이면 CONTEXT_NOT_COLLECTED다.
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

## 4. 불변 저장 형태·hash

새 namespace/table 후보 **anvil.transfer_preparation_records**, **anvil.transfer_preparation_record_versions**. 기존 transfers/role_bindings/제어/lease/문서표는 변경하지 않는다. 아직 SQL 없음.
- records: id UUID PK, project_id(projects FK), creator_user_id, creator_client_id, version=1 고정, created_at. (id,project_id) unique.
- versions: record_id/project_id 복합 FK, version=1, snapshot_json, content_hash, command_id(기존 commands의 내부 id FK), policy_ref_json, created_at. PK(record_id,version), project/command unique. application role UPDATE/DELETE 금지, 정상 command/receipt·같은 actor/project 결합 guard가 필요하다.
- snapshot exact 키: `{schemaVersion:1,id,projectId,version:1,kind:"TRANSFER_PREPARATION_RECORD",state:"PREPARATION_ONLY",assignmentRef,contextRef,roleRef,oldBindingRef,targetConnectionRef,baselineRefs,budgetRef,sourceRefs,requiredContext,gaps,reason,intentExpiresAt,observedAt,preparationStored:true,manifestStored:false,bindingFrozen:false,ready:false,resumeAuthorized:false,executionAuthorized:false,dispatchPerformed:false}`.
- sourceRefs는 최대207개 고유 출처의 exact union이다. DOCUMENT_VERSION/KNOWLEDGE_VERSION은 `{kind,ref:{id:UUID,version:正整数,contentHash:SHA256},conversationId:null}`, USER_INSTRUCTION은 `{kind:"USER_INSTRUCTION",ref:{kind:"CONVERSATION",id:UUID,contentHash:SHA256},conversationId:UUID}`다. 후자는 기존 MessageRef이며 version을 추가하지 않는다. §2의 ref 규칙은 POST payload의 versionRef에 적용한다. CID는 고정 context sourceBinding에서 도출하고 id 역조회로 추측하지 않는다. 본문/bodyRef/URL·파일경로는 저장하지 않는다.
- requiredContext는 기존7 code가 정확히 한 번씩인 `{code,state:"NOT_COLLECTED"|"MISSING_OR_EXCLUDED"|"METADATA_ONLY"}[]`. 각 출처의 reason/본문을 포함하지 않는다.
- gaps는 중복 없는 고정 코드 최대256개. 위 코드 외 ROLE_NOT_SELECTED/OLD_BINDING_NOT_COLLECTED/TARGET_NOT_SELECTED/CONTEXT_REQUIRED_MISSING/CONTEXT_EXCLUDED/CONTEXT_REDACTED/CONTEXT_CURRENTNESS_UNVERIFIED/RECORD_DURABILITY_UNVERIFIED/SOURCE_AUTHORIZATION_UNVERIFIED/UNDERSTANDING_UNREVIEWED/TRANSFER_CONFIRMATION_UNVERIFIED다. durability는 transaction 저장 성공만으로 실행기 미전송 회수확인이 되지 않으므로 유지한다.
- content_hash는 canonicalJson(snapshot)의 SHA256. public fullref의 contentHash와 같다. row metadata는 snapshot hash 밖이지만 DB guard로 결합한다. 준비저장 true와 정식 manifest저장 false는 항상 함께 표시한다.

## 5. 현재 권한·조회 노출

기존 인증/프로젝트 멤버/정책 helper의 검사를 약화하지 않는다. **새 쓰기/읽기 operation을 기존 AUTO 정책에 자동 추가하지 않는다.**
- POST: 현재 HUMAN 로그인·미만료 session/credential·actor.client 일치, project OWNER·현재 단독제어 및 exact controlGeneration, 현재 명시 정책의 createTransferPreparationRecord AUTO 허용 필요. DENY 우선, 무정책412/허용없음403. REQUIRE_APPROVAL 또는 approvalRef nonnull은412 PREPARATION_APPROVAL_NOT_CONNECTED로 거절, 기존 일회승인을 임의 소비하지 않는다.
- GET: 현재 HUMAN 로그인·현재 client/credential·project OWNER이며 creator_user_id=actor인 기록만 허용. 별도 현재 readTransferPreparationRecord AUTO 정책 필요. 제어 미보유여도 읽기만 허용하지만 타 작성자/VIEWER에 공개하지 않는다. GET에 쓰기 grant나 구 generation을 재사용하지 않는다. 새 기기라도 현재 인증 client로 조회하되 원 creator client는 이력일 뿐 권한으로 승계하지 않는다.
- POST replay도 위 POST 현재권한과 GET 읽기정책/creator 검사 모두 통과해야 과거 receipt/data를 반환한다. 새 POST 역시 읽기정책을 요구하여 저장 직후 결과 노출과 GET의 권한이 어긋나지 않게 한다.
- reason·fullref·출처관계·gaps·receipt 역시 보호 metadata다. 응답 직전 출처 각각의 현재 보호상태/접근권을 다시 검사한다. 하나라도 회수/격리되면 body·ref·reason·건수·receipt 전부 미반환(동일404). snapshot을 편집/마스킹해 원 hash로 반환하지 않는다.
- source가 새 버전으로 바뀌어도 과거 버전이 여전히 열람 가능하면 과거 준비본 조회는 허용한다. 이는 현재 적합/재사용 허가가 아니다. 과거 본문을 이 GET으로 열지 않고 기존 원문 API의 최신 보호검사를 별도로 거친다.
- 인가 전 타 project/작성자/id/version/source의 상세 차이는 동일404; 인증401·현재주체 제어/정책403/412는 기존 공통 코드. 오류/log/audit에는 reason/원문/민감 경로를 반사하지 않는다. 캐시 no-store, URL/query에 본문/이유를 넣지 않는다.

## 6. 새 명령·exact replay·동시성·기한

한 transaction에서 순서를 분리한다.
1. 크기/형식→현재 인증·멤버/OWNER·client/제어세대/쓰기와읽기정책 및 보호 조회 권한 확인. 권한/정책 회수 뒤 command row를 읽어 존재·내용을 노출하지 않는다.
2. project/actor/commandId unique key로 기존 command 확인. 있으면 operation·canonical requestHash·원 actor/client/controlGeneration이 exact 같은 APPLIED만 채택한다. result_ref의 준비기록·hash/creator 및 현재 조회보호를 검사한 뒤 원 receipt를 반환한다. 새 CAS/원 intent 기한/assignment 최신 head는 여기서 다시 적용하지 않는다. 이력 재확인은 현재 적합으로 승격하지 않는다. 서로 다른 payload/client/세대는409다.
3. 새 command일 때는 **적격성 판단 전에** project→control→policy→source 종류/id 오름차순으로 head/보호·관계 행을 잠근다. source 식별을 위한 사전 읽기는 잠금대상 탐색에만 쓰며 값/권한을 확정하지 않는다. PostgreSQL READ COMMITTED에서 잠금 대기가 끝난 뒤 별도 SELECT로 현재 행/관계를 다시 읽고 현재 인증·멤버/OWNER·client/제어세대·쓰기/읽기정책·출처 보호를 재검사한다. 이후에만 intentExpiresAt/정확 최신 assignment·context 관계/선택ref 및 target 귀속/expectedVersion=0·targetId=null·현재 baseline을 검증하여 canonical refs/current policy fullref를 고정한다. 잠금 전 값과 다르면409·전체 rollback이며 오래된 검증값을 저장하지 않는다.
4. 잠금은 transaction 종료까지 유지한다. 해당 정책/권한회수·head 변경·격리/귀속 변경의 **모든** mutation 경로도 같은 상위 보호 행과 같은 순서의 충돌 잠금을 사용해야 한다. 삽입/회수로 판정이 바뀌는 관계는 기존 행 부재에도 project/부모 head 잠금으로 직렬화한다. 이 보장이 없는 source verifier는412 SOURCE_VERIFIER_NOT_CONNECTED다. replay도 원 결과 반환 전에 같은 방식으로 현재권한/보호를 잠금 후 재검사하되 과거 intent기한/최신head CAS는 적용하지 않는다. deadlock/직렬화충돌은 전체 rollback·409 CONCURRENT_CHANGE이며 자동재전송0이다.
5. records/version+command APPLIED+authorization receipt+audit를 원자 저장한다. receipt status APPLIED는 준비기록 저장만 뜻하며 data flags를 고정한다. 감사·hash·guard·receipt 실패는 전부 rollback, 반쪽기록/승인소비0.
6. 같은 command 동시 요청은 unique 충돌 후 현재권한부터 재검사해 exact APPLIED replay로만 돌려준다. 다른 command는 독립 새 준비본이다(준비본 생성은 role 상태 CAS/동결이 아니다). 새 요청의 입력 최신성 경쟁은409이고 기존것을 덮지 않는다.

기한은 신규 의도 접수용이다. 만료 후 새 저장은410 INTENT_EXPIRED, 원 APPLIED의 적법한 결과 재확인은 허용한다. 준비본은 만료 후에도 보호 이력으로 보존하고 GET에 intentExpired=true/usableForTransfer=false를 별도 응답한다.
불확실한 네트워크 응답은 UI UNKNOWN이다. 자동재전송/새 command 생성0. 사용자가 명시 재확인할 때 **같은 commandId와 동일 payload**를 보존해 재전달하며, 이는 위 순서로 미저장이라면 새 저장이 될 수 있음을 표시한다. 만료·옛세대이면 자동갱신하지 않는다.

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

## 9. 필요한 한 건의 직접 결정

위 exact 문서를 기준으로 준비전용 영속객체·명령/조회·새 명시 정책 계약을 **미적용 SQL/코드/합성검증 범위**에서 채택할지 결정한다. 기존 FN14 전체를 재승인하는 질문이 아니다. 실제 DB/정책 부여·서비스·Agent/동결/실이전/재개는 제외한다. 승인 전 본 후보는 실행 기준이 아니다.
