# FN06 HUMAN 능력 보고 보관 계약 — 구현 범위 후보 r2

상태: DRAFT / NOT_ADOPTED. 이 문서는 결정용 구체 후보이며 제품·API·SQL·정책의 채택이나 실행 승인이 아니다.

부모: docs/work_packages/FN06_CAPABILITY_REPORT_PERSISTENCE_PROPOSAL.md SHA256 3AE123551CB1CE2D437F538578993F39E8ED150BBE33F3A273818D8798BF5C81. 원문·기존 질문은 보존한다. PMO의 2026-10-26 구체화 요청을 반영한다. 현재 소스 checkpoint f12f8764447ab37b707cd32e810bf4ab2faf09a1 기준의 기존 계약 소비와 신규 delta를 구분한다.

## 1. 목적·허용할 후보 범위

Anvil이 코딩 도구의 능력에 관한 사람의 주장·근거·제한을 자기 소유 자료로 보관하고 고정 조회하는 경로다. 후보 ref/문서 확인/사람의 VERIFIED 주장을 실제 실측·현재 적합·실행 허가로 바꾸지 않는다.

이번 채택 후보는 HUMAN 입력 DTO/parser·원자 저장/고정 GET·UI11 작성/조회·미적용 forward SQL 파일·fakeDB/주입 합성 transport 검증만이다. 실제 DB/역할·grant/정책 부여·credential/키·CONNECTOR/TRUSTED_PROBE·OS/native/socket·실Agent/비용·서비스·격리PG QA·Oracle는 제외한다. 부모 §6의 실제 새 PG 검증은 이번 요청에 포함하지 않는다. 향후 실제 검증이 없으면 실제 보관/접근·동시성은 NOT_RUN이다.

초기 대상은 기존 CONNECTION_CANDIDATE/ENVIRONMENT_CANDIDATE의 현재 정확 버전뿐이다. 등록 연결/환경과 같은 권위로 취급하지 않는다. 저장해도 C1의 CAPABILITY_UNVERIFIED/NOT_AUTHORIZED·기존 실행 차단은 유지한다. UI04 prepareExecution 자동 저장·능력 적합 해제는 별도 후속이다.

## 2. 정확 쓰기 계약 delta

기존 ProjectCommand envelope에 신규 operation recordCapabilityReport를 추가하는 제안이다. schemaVersion=1, projectId, commandId, clientId, controlGeneration은 기존 문법, targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null이다. 권한상 새 연산이므로 별도 명시 AUTO 정책을 요구하고 기존 정책에 자동 추가하지 않는다. REQUIRE_APPROVAL/비null approvalRef는 CAPABILITY_APPROVAL_NOT_CONNECTED/412로 거절한다.

payload는 추가 키 없이 다음 9개다.

| 필드 | 정확 값·검사 |
|---|---|
| connectionRef | 기존 VersionRef {id,version,contentHash}; 같은 프로젝트 CONNECTION_CANDIDATE의 현재 head/hash·유효 기한 |
| environmentRef | 같은 문법, ENVIRONMENT_CANDIDATE 현재 head/hash·유효 기한 |
| tool | {product,version,adapterVersion}; 각 1~200 UTF-16 문자·well-formed·비어 있지 않음 |
| observedAt | null 또는 과거/현재 UTC ISO 시각. null은 관측 시각 미확인이며 recordedAt으로 대체하지 않음 |
| expiresAt | 미래 UTC ISO 시각; §7 제안 한도 및 두 후보·현재 정책의 최단 만료 이하 |
| supersedesRef | null 또는 같은 프로젝트·동일 연결/환경 fullref 쌍을 보관한 기존 보고서의 정확 ref |
| capabilities | 아래 고정6개를 각각1회, 순서와 원주장 보존·누락/중복/미등록 코드 거절 |
| reason | 1~20000 문자·well-formed·비어 있지 않음 |
| schemaVersion | 1 |

모든 자유 입력 문자열(tool3종·reason·limitations·documentation.source 포함)은 기존 candidate-input.ts text 검사와 같이 well-formed와 길이/비어 있지 않음 및 금지 제어문자 `/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/` 부재를 검사한다. U+0000처럼 JSONB에 보관할 수 없는 원문은 CAPABILITY_REPORT_INPUT_INVALID/422로 거절하며 원주장을 자동 삭제·치환·정규화하지 않는다. 허용된 TAB/LF/CR과 나머지 원문 bytes는 그대로 보존한다. 시각은 기존 instant 검사와 같은 `YYYY-MM-DDTHH:mm:ss.sssZ`이며 실제 Date 파싱 및 toISOString 동일성을 모두 요구한다.
각 capability의 정확 키는 code,documentation,submittedMeasurementState,requestedControlLevel,evidenceRefs,limitations다.

- code: 기존 INSTRUCTION_SESSION, STATE_ORIGINAL, RESULT_EVIDENCE, TOOL_APPROVAL, STOP_RECLAIM, PATH_WRITE_CONTROL.
- documentation: null 또는 {source,observedAt,versionCompatibility}. source는 자격정보 없는 HTTPS URL, 최대2048자; observedAt은 현재보다 미래가 아닌 UTC 시각; versionCompatibility는 CONFIRMED/UNVERIFIED/UNSUPPORTED라는 사람의 문서 주장이다. URL은 서버가 접속하거나 근거 본문으로 자동 수집하지 않는다.
- submittedMeasurementState: VERIFIED/UNVERIFIED/UNSUPPORTED. requestedControlLevel: DIRECT/ISOLATED/OBSERVED_ONLY/UNVERIFIED. 두 값은 원주장으로만 보존한다.
- evidenceRefs: 기존 artifact ref의 정확 {artifactId,bytes,contentHash,mediaType} 배열. 같은 항목 중복 금지, 프로젝트 귀속/READY/UTF-8 plain·markdown·최대2MiB/현재 보호 읽기·bytes/hash/격리 확인. 원문은 payload에 넣지 않는다. 항목당20개/전체 unique20개는 신규 제안 한도다.
- limitations: 1~20000 문자·well-formed·비어 있지 않음. 미확인과 남은 한계를 사람이 작성한다.
- 원문·URL·이유는 기존 의심 비밀 표식 검사에서 SUSPECTED면 CAPABILITY_SENSITIVE_CONTENT_SUSPECTED/412다. 자동 삭제·키 폐기·격리 해제는 없다. 완전한 비밀 검출을 주장하지 않는다.

추가 reportedBy/sourceAssurance/bindingKind/recordedAt/probeRunRef/authorizationReceiptRef/executableObservationRef·서버 측 판정/실행 true를 payload로 보내면422다. fileRef 전체/배열/원숫자·null·원문 claim은 구조화 복제해 불변 보관한다.

## 3. 서버 산출 snapshot·원주장 분리

- claim은 정확 payload 전체이며 claimHash=기존 canonicalJson(claim)의 SHA256이다. 입력 배열 순서나 제출 시각을 임의 정규화해 원명령 hash를 바꾸지 않는다.
- snapshot 정확 키: schemaVersion=1,projectId,reportId,version=1,claim,claimHash,reportedBy,sourceAssurance,bindingKind,recordedAt,executableObservationRef,probeRunRef,authorizationReceiptRef,capabilities,executionAuthorized,dispatchPerformed.
- reportedBy={kind:HUMAN,userId:인증actorId,clientId:인증clientId}, sourceAssurance=HUMAN_CLAIM, bindingKind=CANDIDATE_ONLY. observedAt/기한/대상/도구는 claim에서 조회한다. recordedAt은 서버 transaction 기준 밀리초 시각이다.
- executableObservationRef/probeRunRef/authorizationReceiptRef는 모두 null이다. 이 보고 자체의 일반 command authorization receipt와 실제 도구 실행의 receipt를 혼동하지 않는다.
- 서버 capabilities는 고정6 code 순서로 {code,measurement:{state:UNVERIFIED},controlLevel:UNVERIFIED}만 계산한다. 사람의 VERIFIED/UNSUPPORTED·DIRECT 주장도 서버 판정으로 승격하지 않는다.
- executionAuthorized=false/dispatchPerformed=false를 고정한다. contentHash=기존 canonicalJson(snapshot)의 SHA256, ReportRef={id:reportId,version:1,contentHash}를 외부에 둔다. 자기 contentHash를 자기 snapshot에 넣지 않는다.
- 쓰기 응답은 기존 APPLIED receipt/data={status:CAPABILITY_REPORT_RECORDED,ref,snapshot,effectiveForExecution:false,dispatchPerformed:false}. 서버 report/claim/행·명령/receipt·감사는 한 transaction으로 저장하며 일부만 commit하지 않는다.

## 4. 쓰기·원명령 재확인·조회 접근

쓰기와 같은 명령 replay 모두 현재 로그인/CSRF→인증 actor/client·OWNER/단독제어 현재 세대→최근 재인증→현재 명시 AUTO 정책·DENY 우선/기한→원 requestHash 순서다. 기존 ProjectPolicyRepository.command는 domain callback 전에 replay할 수 있으므로 재인증 검사는 callback만이 아니라 replay 이전에 둔다. actor.reauthUntil > now를 사용하며 새 재인증 유효기간을 만들지 않는다. 기존 발급은 세션 절대만료와 재인증+5분 중 이른 값이다.

동일 commandId/동일 봉투 canonical hash는 같은 ref만 반환한다. 현재 권한·재인증을 통과한 뒤 저장 row·claimHash/contentHash·원 APPLIED receipt/resultRef를 다시 대조한다. 같은 ID 다른 hash는 기존 IDEMPOTENCY_CONFLICT/409, 같은 input의 다른 commandId는 별도 보고서이며 자동 dedup하지 않는다. supersedes는 기존 정정 대상의 보존 참조이지 head 수정/독점 정정 권한이 아니다.

고정 GET 제안: /api/v1/projects/:projectId/capability-reports/:id/versions/1. query 없음·no-store·현재 HUMAN cookie 회원만 지원한다. 현재 membership 회수/타project/미존재는 기존 projectMember의404다. 과거 보관 읽기에는 현재 control·재인증·쓰기 정책을 요구하지 않는다. 제어권 이전/보고 만료만으로 과거 원문을 숨기지 않는다. 세션 무효401, 무결성·원본 불일치는503이며 성공한 공백 응답으로 바꾸지 않는다.

응답 정확 키: projectId,ref,snapshot,currentnessIssues,effectiveForExecution:false,dispatchPerformed:false,checkedAt. snapshot/ref/원명령 receipt를 재검사하고 currentnessIssues는 과거 snapshot/hash 밖에 둔다. 보고 본문에 원 evidence bytes를 자동 포함하지 않는다. 근거 원문 열기는 기존 보호 파일 GET의 사용자 명시 동작만 사용한다.

## 5. 현재성의 정확 범위

현재성 issue는 CANDIDATE_ONLY, HUMAN_CLAIM_UNVERIFIED를 항상 포함한다. 추가 코드: CONNECTION_HEAD_CHANGED, ENVIRONMENT_HEAD_CHANGED, CONNECTION_EXPIRED, ENVIRONMENT_EXPIRED, REPORT_EXPIRED, EVIDENCE_UNAVAILABLE, EVIDENCE_QUARANTINED, EVIDENCE_HASH_MISMATCH, CURRENTNESS_UNAVAILABLE. 각 항목은 추가 키 없는 {code,target}이며 target은 null 또는 {kind,ref}다. kind=CONNECTION_CANDIDATE/ENVIRONMENT_CANDIDATE/REPORT이면 ref는 VersionRef, kind=ARTIFACT이면 ref는 위 ArtifactRef다. 코드와 target의 정확 조합으로 중복을 제거한다.

현재 후보가 없어지거나 hash/head가 달라져도 검증 가능한 과거 snapshot은 보존하고 현재 issue를 표시한다. 프로젝트 읽기 권한 상실·보고/receipt 무결성 실패는 issue로 숨기지 않고 GET 자체를거절한다. 근거의 현재 유무/상태/hash 확인만 수행하며 근거 bytes를 응답하지 않는다. 보호 원본을 내부 검증할 수 없으면 CURRENTNESS_UNAVAILABLE이며 무조건 정상으로 처리하지 않는다.

현재성 issue가 적어도 effectiveForExecution는 항상 false다. 예산·필수 맥락/이해·Agent 권한·OS fence·실수신/실행은 이 자료만으로 충족되지 않는다. 기존 resolver/Authority의 true 조건을 바꾸거나 과거 SYNTHETIC_ONLY 준비를 backfill하지 않는다.

## 6. 미적용 DDL 변경 명세

새 forward migration 번호는 구현 착수 직전 실제 inventory에서 정한다. 기존 SQL은 수정하지 않는다. 다음 두 새 표와 guard만 제안하며 실제 DB/역할/grant 실행은 제외다.

| 표 | 컬럼·키·제약 |
|---|---|
| anvil.capability_reports | id uuid PK,project_id uuid NOT NULL,version bigint CHECK(version=1),connection_id uuid/connection_version bigint/connection_hash text,environment_id/version/hash,claim_json jsonb/claim_hash text,snapshot_json jsonb/content_hash text,supersedes_id/version/hash nullable,created_by uuid,client_id uuid,command_id uuid UNIQUE,created_at timestamptz. 모든 hash는소문자64hex,필수값NOT NULL,positive safeinteger,UNIQUE(project_id,id,version),UNIQUE(project_id,command_id) |
| anvil.capability_report_evidence | project_id uuid,report_id uuid,report_version bigint CHECK(=1),capability_code text의고정6 CHECK,artifact_id uuid,artifact_hash text,bytes bigint CHECK(0~2097152),media_type text의UTF8두종 CHECK. PK(project_id,report_id,report_version,capability_code,artifact_id) |

보고서는 projects·project_members(project_id,user_id)·clients(user_id,id)·commands(project_id,id) FK를 둔다. 후보 fullref의 FK는 실제 connection_candidate_versions(project_id,candidate_id,version)이며 kind/hash는 guard에서 별도로 대조한다. supersedes는 같은 표(project_id,id,version) self FK와 fullhash/동일대상쌍 guard, null3개 동시성을 CHECK한다. 근거 표는 보고서(project_id,id,version)·artifacts(project_id,id)의 실제 unique FK를 사용한다. ON DELETE RESTRICT·cascade0이다.

- INSERT guard: 원 command id/actor/client/project/controlGeneration·현재 control/OWNER/명시 정책과 authorization receipt·현재 auth/re-auth를 대조한다. APPLIED 결과 ref/claim/snapshot·false플래그/HUMAN/CANDIDATE_ONLY·원 payload/hash·6코드를 대조한다. JSON hash는 기존 anvil.assignment_draft_canonical와 PostgreSQL 내장 sha256/convert_to/encode의동일계산을사용하며새extension설치0이다.
- evidence INSERT와 DEFERRABLE INITIALLY DEFERRED constraint guard: claim내근거/6코드별행과양방향정확동일·READY/project/hash/bytes/mediaType·정확명령/보고귀속을검사한다. 보고행/근거행/원 receipt중일부만commit하면거절한다.
- 두새표는기존소스역할 anvil_v3_app에 SELECT/INSERT만선언한다. PUBLIC ALL,anvil_v3_app UPDATE/DELETE/TRUNCATE는회수하고UPDATE/DELETE/TRUNCATE방어trigger도둔다. 기존표·역할·기존grant를수정하거나role을만들지않는다.
- 현재실제DB에새표가있는지/실효grant·migration상태는조회하지않았다. 이DDL명세나미적용SQL을실제권한검증으로표현하지않는다.

## 7. 한도·실패 표

다음은 **새 채택 대상 수치**이며 기존 CapabilityReport 정책이 아니다: command payload/snapshot 각각 UTF-8 2MiB,정확6능력,근거항목당20·전체unique20,이유/한계각20000자,tool필드각200자,URL2048자. 기한 기본제안30분·최대2시간이고 두후보/현재정책의최단기한이더짧으면그이하로만제출한다. observedAt은nullable·미래거절이며만료는필수미래유한값이다. 새자동연장·자동실측없다.

| 조건 | 동작 |
|---|---|
| 로그인/CSRF·현재주체/제어·OWNER/정책/재인증실패 | 기존인증/정책오류를그대로사용,재인증은기존REAUTHENTICATION_REQUIRED/412 |
| 추가키/잘못된6코드/원주장형식/한도/미래관측 | CAPABILITY_REPORT_INPUT_INVALID/422;과대HTTP본문은기존413 |
| 현재후보head/hash/정정대상모순 | CAPABILITY_REPORT_BINDING_CONFLICT/409 |
| 후보/정책기한·미지원승인/권한없는근거·격리/민감 | 기존 접근오류또는정확domain412;타project/미존재는404 |
| 저장원본/claim/snapshot/receipt조작 | CAPABILITY_REPORT_INTEGRITY_FAILED/503 |
| 같은명령다른내용 | 기존IDEMPOTENCY_CONFLICT/409 |

재인증코드는실제project-candidates.ts:30/기존project-command.ts:134의REAUTHENTICATION_REQUIRED와동일하다. 다른기존정책/접근오류는그대로전파하고신규고유domain코드만추가한다. 기존오류호환을몰래바꾸지않는다. 모든거절에서부분보고/근거행·승인소비·도구호출0을확인한다.

## 8. UI11 화면 업무 후보

현재프로젝트에서사용자가기존연결후보·환경후보의정확버전을조회/선택→사람주장입력→미실측고지와별도명시저장→반환정확ref고정조회로이어간다. 필수6항목각각문서근거/제출상태·통제주장/한계·기존보호artifactref를입력하고당시원주장과서버UNVERIFIED/실행불가를서로나눠보인다. 빈값을가짜문서/VERIFIED로자동채우지않는다.

저장전기존새재인증흐름/현재정책이없으면그이유를표시하고실사용자정책을만들지않는다. pending/uncertain에서는원command/입력/근거를보존하고같은명령만확인한다. 고정GET는보관시각/기한·현재성issue·과거원주장/서버판정·정정원ref·근거수동열기를표시한다. 목록/latest/search·자동probe·prepareExecution자동저장버튼은없다. 목록 API 대신 기존 보고 ID/정확ref를 명시 입력해 고정 GET로 조회하는 동선을 제공한다. 새 상세화된 화면시안/업무카드는 채택 후 이 정확 범위로 작성하고 Main이 단일 writer에 전달한다.

## 9. 채택 후 source·합성 검수·rollback

입력누락/중복·반대종류/교차project·미래/만료·비밀표식·원주장VERIFIED도서버UNVERIFIED,exactreplay/충돌·재인증만료replay차단·제어/권한회수·snapshot/근거누락/중간실패rollback·고정GET과거보존/접근회수·UI명시저장/같은명령확인을fakeDB/in-process/합성transport로검증한다. 미적용SQL은source/문법작성검토만하고실PG·SQL실행은하지않는다.

정식DDL동작/실DB·서비스·실측·사용자인수는NOT_RUN으로남긴다. rollback은신규operation/route/UI소비를기존안전거절상태로돌리는소유commit revert이며새표/자료삭제나자동down migration0이다. 실제적용후의자료/권한복구는별도영향·승인을거친다.

## 10. PMO 결정 요청

이r2의정확HUMAN쓰기/고정GET·서버판정분리/새2표·guard·새연산정책명/한도/UI11 및 source·미적용SQL·합성검수만채택할지판정한다. 실제DB/권한부여/CONNECTOR/TRUSTED_PROBE/native/실Agent/서비스는포함하지않는다. 미채택상태에서제품코드·SQL파일·기존정본계약개정/기존차단해제0이다. 기존사람질문복제·침묵을채택으로간주하지않는다.
