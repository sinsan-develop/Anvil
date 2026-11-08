# FN03 관리 원문 생산자 기술 WI 준비 — 미채택/코드 GO0

> 담당 구현자는 기존 Primary 한 명이다. 채택·기술동결 뒤 subagent-driven-development/TDD 흐름으로 업무별 구현·검수하며, Main은 관리·독립 검수·통합을 맡는다. 지금은 준비 문서이고 구현 명령이 아니다.

- **목표:** 관리 정책의 원 envelope와 불변 출처·정확 저장량을 실제 코드 경로에서 보존하고 전용 내부 reader로 재조회한다.
- **구조:** 기존 인증·PROJECT 제어/정책을 재사용하고 목적 RPC 한 번이 R/E/O/C/A/U를 같은 Tx로 저장한다. 현재 권한 검산과 과거 불변 완결 검산을 분리한다.
- **기술:** 기존 TypeScript·Node/Fastify·PostgreSQL 미적용 forward, 현재 React 정책 선택값과 Node 합성시험. 새 라이브러리/도구 도입0.
- **명세:** FN03_SOURCE_CONTENT_MANAGEMENT_ORIGIN_PRODUCER_CANDIDATE_20261108.md의 cbefc3e3와 채택 패킷239845d6. 원문·기한·10GiB·목적/권한·source-only 제외 범위는 모든 단계에 적용한다.
- **검수 초점:** 원문 없는 과거·잠금 대기 후 만료/시각 역행·새 세션의 역사조회·다른 Tx/교체 query·10GiB 직전과 정수 자릿수 증가를 각 소유 시험에서 고정한다. 모두 후보 준비 조건이며 통과 증거가 아니다.


기준 후보 cbefc3e3736301e9a49b8b26db41fcc3c0cedbb0a052c9e0cdaedde0b93c5230·결정 패킷239845d61699c4987aeb11a05046a115f323c1bee1949ca38837fcd6d48a6eaf는 그대로 보존한다. 새 권한/원문/비용의 의미를 바꾸는 문서가 아니라, 해당 후보가 이미 요구한 구현 전 정확 RPC/ACL/DAG/잠금·Mtemplate 검수의 준비 기록이다. 아직 함수 시그니처/열 ACL이 완결되지 않았고 제품/SQL 작성·실제 실행 GO가 아니다.

## 1. 인증과 잠금 조사
기존 AccessRepository 실제 인증은 token/CSRF소유 검증과user/session/client행잠금을 한다. 현재FN77 approval_context는 auth→project/member/control→현재permission_policy head FOR SHARE 후account FOR UPDATE다. 이 권한정책head와신규source_content_policy_events의최신head는다른행이다. candidate의account뒤정책head를권한정책head로오독해기존순서를뒤집지않는다. 새source event head만account뒤에고정할수있는지모든호출선과같은Tx로검토중이다. 현단계에서교착없음을확정하지않는다.

## 2. 구현 전 해결할 시각 모순
기존 projectMaterialReceipt는 commands.completed_at=now(),serverReceivedAt=transaction_timestamp()여서Tx시작시각이다. 새관리E/O.recordedAt를잠금뒤freshclock으로발급하고부모계약E.recordedAt≤O.recordedAt≤C.completedAt를적용하면기존genericreceipt와모순될수있다. Tx시작시각을E/O에대입해우회하면대기중저장된previous head보다과거시각이될수있다. 이문제는실SQL실패재현이아닌원소스대조에서확인한구현선행finding이다.

해결기술후보는이새목적의producer/RPC에서잠금후실DBclock을캡처해E/O를발급하고,목적한정C/A/U완료시각도freshDBclock으로기록하는것이다. 기존일반receipt의시각·정책·동작은변경하지않는다. 같은Tx/원command/receipt/audit·R정착을유지하고genericpersist를중첩호출해두번저장하지않는다. max(old,now)같은인위시각이나부적합Tx시작시각으로일치시키지않으며실clock역행/수명위반은명확거절/rollback한다. 정확한원authorization재사용·purpose완료함수/RPC시그니처와호출선은현재기존Primary읽기검토중이다.

후보의CM결과exact9/receipt·audit형상과E≤O≤C시각관계·목적/권한·원문/보존·기존10GiB계상은불변이다. 이는그관계를지키기위한내부구현선택이지만기술WI독립검토·시험전해소로판정하지않는다. 코드/DDL/DB/권한/키/서비스·Agent·SSH·실자료실행0이다.

## 3. 다음 기술 완료조건
정확쓰기목록·RPC인자/역할별열ACL·함수DAG·각잠금행/순서·같은XID/원callback기한·원계보완결·예약/실정산5행/M상계template·시각/동시성음성을고정하고독립C/I를닫는다. 후보직접채택과이기술동결이둘다있을때만기존Primary단일writer에코드·미적용SQL·합성검증을배정한다. nonce/native서명·실파일/LINK·실제DB/GRANT등은포함하지않는다.

## 4. 정확 제품/시험 소유 후보 — 아직 GO0
기존제품4:
- apps/server/modules/access/project-command.ts
- apps/server/modules/projects/routes.ts
- apps/server/modules/projects/project-storage-quota.ts (새 내부목적의 읽기/정합·전용quota접점에 필요한 경우만; 일반QuotaPart의외부발급허가확대0)
- apps/web/src/features/connections/policy-editor-profile.ts
신규제품4:
- apps/server/modules/documents/source-content-policy-management-origin-input.ts
- apps/server/modules/documents/source-content-policy-management-origin-store.ts
- apps/server/modules/documents/source-content-policy-management-storage.ts
- apps/server/modules/documents/project-source-content-policy-management.ts
신규미적용SQL1:
- db/migrations/0083_source_content_policy_management_origins.sql.pending
신규시험5:
- tests/unit/FN03/source-content-management-origin-input.test.ts
- tests/unit/FN03/source-content-management-origin-service.test.ts
- tests/unit/FN03/source-content-management-origin-schema.test.ts
- tests/unit/FN03/source-content-management-origin-storage.test.ts
- tests/unit/UI11/source-content-management-policy.test.ts
정확14경로중새경로는착수직전부재를재검산한다. 기존wire/evidence/proof·0040원SQL·일반source자료·기타제품은읽기재사용하며수정0. 추가필수경로는쓰기전Main에근거반환,다른writer/사용자변경되돌리기0이다. 정책선택화면은두명시목적선택만추가하고새관리원문일반다운로드/HTTPread endpoint·native관측화면을임의만들지않는다. 이는전체실사용화면완료범위가아님을보고한다.

## 5. RPC 시그니처 후보와 원자료
두app-executable SECURITY DEFINER 목적RPC만제안하며PUBLIC은차단한다.

```
fn03_source_content_management_commit(
 s uuid,a uuid,c uuid,p uuid,q jsonb,policy jsonb,ids jsonb,
 expected_tx text,observed_until timestamptz
) returns jsonb
fn03_source_content_management_read(
 s uuid,a uuid,c uuid,p uuid,control_generation bigint,policy jsonb,
 selection jsonb,expected_tx text
) returns jsonb
```
q는원ProjectCommand전체고정사본,policy는현재permission fullref,ids는서버발급exact6(serverCommandId,operationId,authorizationReceiptId,auditEventId,policyEventId,originId)다. s/a/c/expected_tx/기한·ids는실Access callback과실DB에서만유도하며caller payload에추가하지않는다. R.id는serverCommandId와같다. observed_until은실DB최소기한을더줄이는상한일뿐인증proof아니다. selection은originRef/policyEventRef/managementCommandId exact3. expected_tx는실xid문자열로대조하고JS Number로변환하지않는다.

commit결과의서버내bundle은기존result/정확refs/R·planHash/transactionId를목적별exactparser로검산하고공개로는기존CM result만반환한다. read는원문포함보호bundle을서버내inspector까지만제공하고일반반환은기존후보exact5/UNVERIFIED다. define생성의내부원행완결검산은해당write목적이고별도사용자의read허가로가장하지않는다. 명시read는현재read AUTO를따로검사한다. 생성성공을read허가부여로바꾸지않는다.

ProjectPolicyRepository.command의실인증/현재제어/권한판정과같은거래를재사용하며새material분기에서는commit RPC만1회호출한다. 이RPC가R/E/O/C/A/U를원자작성·정산하므로generic projectMaterialReceipt/persist의추가호출0이다. material앞genericreplay즉시반환에는새목적역사bundle검산을먼저연결한다. current관리AUTO검산과역사저장policy/ref·actor/명령/hash를분리하고역사actual이현재정책/기한으로재귀하지않는다.

## 6. 목적역할·열 ACL 동결 후보
역할은후보의anvil_v3_source_content_management_owner만사용한다. 일반app/PUBLIC원표직접권한·이역할membership/SETROLE0이며내부helper EXECUTE0는app/PUBLIC기준이다. 새역할은필요한정확helper만EXECUTE한다.

|대상|새목적역할한정권한후보|
|---|---|
|fn01_active(uuid,uuid,uuid)|EXECUTE,원함수/기존app권한불변|
|auth_sessions|SELECT(id,user_id,client_id,credential_generation,idle_expires_at,absolute_expires_at,reauth_until,revoked_at);auth행잠금은원fn01_active책임|
|projects|SELECT(id,archived_at),행잠금용UPDATE(id)만|
|project_members|SELECT(project_id,user_id,participation,revoked_at),행잠금용UPDATE(participation)만|
|project_control|SELECT(project_id,actor_id,client_id,generation,revoked_at),행잠금용UPDATE(generation)만|
|permission_policies|SELECT(project_id,id,head_version),FOR SHARE용UPDATE(head_version)만|
|permission_policy_versions|SELECT(project_id,policy_id,version,rules_json,reason,review_refs,content_hash)|
|project_storage_accounts|SELECT(project_id,coverage_state,generation,used_bytes,held_bytes),UPDATE(used_bytes,held_bytes,updated_at)|
|project_storage_reservations|정확원행비용/역완결SELECT·필수행INSERT,UPDATE(phase,start_fence,started_at,settled_bytes,server_command_id,authorization_receipt_id,scope_digest,settled_at)만;plan/hash/원r/수명덮기0|
|E/O/C/A/U|정확5행저장열INSERT/역완결SELECT. Oexact9·기존E/C/A/U전체물리행투영포함,과거UPDATE/DELETE/TRUNCATE0|

목적역할의원표SELECT가기존RLS를우회하는지DDL검수에서각표정책과대조하고미확인표는임의USING(true)로열지않는다. E/O에만새역할한정SELECT/INSERT정책·policy_events trigger1개교체를허용한다. C/A/U·R의기존보호guard가새목적을허용할필요가있으면0083의한정dispatcher/역완결분기에서기존함수로위임하는정확후행만추가하고다른목적을완화하지않는다. 권한표의열이실schema와다르거나추가필요하면쓰기전Main이정확delta를대조한다. 위UPDATE권한은RPC의행잠금용이며해당임의UPDATE문을함수에추가하는허가가아니다.

## 7. 잠금·시각·함수 DAG
고정순서는auth users/session/client→project/member/control→현재permission_policyhead FOR SHARE→project quotaaccount FOR UPDATE→source_content policyeventhead/CAS다. 빈sourcehead도이미잠근project행으로직렬화한다. 최신DENY/REVOKED를빼고AUTO과거를찾지않는다. 기존FN75/77·현재quota와교차하는행을쓰기전잠금표로재검산한다. read는auth/project/current정책검사만수행하고account/R변경·fn01_lock_owner0이다.

잠금/CAS후실clock으로E/O불변시각/refs를확정하고purpose freshclock으로C.serverReceivedAt/completed_at을정한다. 물리INSERT는기존event→command FK때문에C/A/U먼저,E/O뒤순서다. 이는발급시각이며실COMMIT시각을증명하지않는다. 정산뒤와최종deferred검사에서actualclock/current·최소기한/비역행을다시검사한다. 일반receipt는불변이며Tx-start/max(old,now)인위보정0. COMMIT응답유실/후행기한초과는기존원ID/hash의UNKNOWN보존·명시재조회만허용한다.

함수DAG는currentcontext→봉인/maximum/예약→저장→역사5행rows/actual→settle→신규Tx finalguard다. history bundle/actual이currentcontext·quota전체complete로되돌아가면완결순환/과거만료거절이되므로금지한다. helpers는fn03_management_context/plan/rows/actual/maximum/reserve/settle/complete/history_bundle/final_guard의목적별역할로나누고정확시그니처·callee목록을0083작성전에Main에제출해동결한다. 일반quota_plan_valid/quota_settled_complete dispatcher는이목적만분기하고기존목적은원함수에위임한다. 원0040·기존적용SQL본문수정0이다.

## 8. 비용 template·TDD
후보의O/E/C/A/U정확5행+단일R식을사용한다. 원payload·추가물리generated열·nullable분기·원실제타입/escapedUTF8/복제횟수를고정한다. 시각은실projection27문자와비용용27문자상계를대조하고E.safe53/U.positivebigint상계의숫자/문자열타입을유지한다. 실제Mtemplate전체키/형식을보고서에동결하고의미검산에비용용sentinel을사용하지않는다. r/s최소고정점·B≤M/s≤r·잔여10GiB경계/decimal자릿수·미상계거절·중복0을검산한다.

먼저현재새관리operation거절/생산자부재RED를확인한다. 실제Access/ProjectPolicy/서비스·RPCadapter의거래호출선을소비하되DB/키는명시합성이다. 실제callback밖가짜actor/교체query·다른xid·사본/await변이·기한/회수·OWNER/AUTO/DENY/reauth·nonce범위미포함을검사한다. 정의의event/origin/C/A/U/R정상·CAS/부분/중복/원문·quota오염·read권한분리/replay·역사actor/currentactor·COMMIT불명·뒤새명령0·일반목적회귀를확인한다. schema시험은정적/미적용형식이며PG실행PASS가아니다.

Primary는정확14경로에서집중5시험과필요직접인접의보호SQL/정책/quota소비만선택하고type/diff를확인한다. 기존순수형상전체시험을진도용으로반복하지않는다. Main은필요Webmemorybuild/독립기술·코드검수/Git통합을맡는다. 첫단위의소스합격을전체FN03·원문실사용/nonce/native/LINK·전체계획완료로승격하지않는다.

## 9. 배정 조건
현재기술후보이며최종구현WI아니다. 고정후보/패킷의직접채택,이정확기술WI의RPC/각열ACL·함수callee·잠금/Mtemplate의미해소finding0,쓰기직전새경로부재/실HEAD·원파일지문대조를확인한뒤에만Main이단일Primary GO를발행한다. 새의미없으면기술동결자체를재승인사유로하지않는다. 승인전제품/SQL쓰기·실DB/GRANT/키/서비스·Agent·실자료/SSH0이다.

## 10. 사전 검토 반영: CHECK·schema·trigger 실행 역할
사전 기술 읽기 C0/I0는 미동결 항목을 합격 범위에서 제외한 판정이다. 다음 사항도 GO 전에 닫는다.

- 새 역할의 schema anvil USAGE를 명시한다. R/E/O/C/A/U 비용 함수는 to_jsonb(row)의 전체 물리행을 소비하므로 기본값·generated 열까지 포함한 SELECT가 필요하다. INSERT열만 SELECT하고 전체행 비용이 검산된다고 하지 않는다.
- 0059/0082의 R.operation·part_kind·purpose-pair CHECK를 0083에서 정확 새목적만 허용하도록 확장한다. quota_plan_valid/quota_settled_complete dispatcher 변경만으로 CHECK까지 열렸다고 보지 않는다. 일반 reserve의 기존operation/part 허가는 확장하지 않는다.
- E/O 즉시 INSERT guard는 INVOKER로 두어 목적RPC의 실current_user가 새NOLOGIN역할인지 검사한다. 원표 app/PUBLIC 직접INSERT권한0을 유지하며, 필요한private helper의EXECUTE는 이역할에만 허용한다. UPDATE/DELETE/TRUNCATE의 기존 거절을 그대로 둔다.
- C/A/U/R에 설치할 목적별 deferred final guard는 새역할 소유 SECURITY DEFINER·고정search_path로 실행한다. app invoker가 app/PUBLIC EXECUTE0 private helper를 직접 호출하게 만들지 않는다. 이 guard는 source목적의 새5행/R에만 작동하고 다른목적은 기존검사를 유지한다. 단순 current_user가definer로바뀐것을 end-user 인증proof로보지 않는다.
- 공통 quota dispatcher의 기존 owner·INVOKER/DEFINER·함수속성과 기존목적의 caller 의미는 보존한다. 새로운helper 호출에 필요한 EXECUTE는 실제정당한호출role에만명시하고 app/PUBLIC에일괄허용하지않는다. 구버전guard의역할조건을새wrapper의current_user로바꾸어다른목적이통과/실패하는우회를만들지않는다.

## 11. 내부 함수 DAG·plan 후보의 동결 표
다음은 목적 한정 함수분할 후보이다. 실제 SQL시그니처와역할·callee가일치하는지 독립검수해야 하며 이것만으로 GO가 아니다.

|함수/입력 후보|역할과 callee|
|---|---|
|fn03_management_context(s,a,c,p,g,op,policy,until)→jsonb|fn01_active·현재project/member/control·permissionhead/AUTO·DBclock/최소기한. account나historyactual을부르지않음|
|fn03_management_prepare(p,q,policy,ids,recorded_at,expected_tx)→jsonb|sourceevent 최신head/CAS·wire/원snapshot·발급refs/정확단일command식별. 아직5행저장아님|
|fn03_management_maximum(prepared,template)→bigint|후보의정확5행M투영/타입·nullable/시각/순번상계. actual/history/current권한호출0|
|fn03_management_rows(p,cid)→jsonb|불변5행O/E/C/A/U정확1:1·hash·원 receipt/audit관계. 현재정책/만료로과거를다시판정하지않음|
|fn03_management_actual(p,cid)→bigint|rows→기존canonical cost projection만호출. quota전체complete/currentcontext/settle호출0|
|fn03_management_reserve(s,a,c,p,q,policy,ids,tx,until,prepared)→jsonb|이미잠근context/계정·coverage재검산→maximum→기존R 최소고정점→새R reserve/IO_STARTED. caller비용0|
|fn03_management_settle(s,a,c,p,q,policy,ids,tx,until,reservation)→jsonb|잠금유지확인·actual→sealedR검산·s최소고정점→계정/R정착. 원r/plan/hash불변|
|fn03_management_complete(p,cid)→boolean|rows/actual·정확R(plan/ids/fence/금액/원기한형식)·B≤M/s≤r/고정점/양방향완결. currentcontext·quota전체complete로재귀0|
|fn03_management_history_bundle(p,cid)→jsonb|complete→불변5행/R보호bundle. 현재인가RPC밖에서호출불가,현재기한/주체로과거row를재작성0|
|fn03_management_final_guard()→trigger|새Tx의currentcontext/clock/수명·현재xid봉인→complete. 단순과거read/replay에서는이새Tx검사호출0|
|commit RPC|currentcontext→기존순서잠금→prepare/maximum/reserve→freshC/A/U·E/O쓰기→actual/settle/complete→최종DB검사. replay는현재인가→history_bundle만,추가R/5행0|
|read RPC|현재read인가/currentcontext→선택exact3→history_bundle→원inspector보호bundle. account변경·원writer발급·일반원문공개0|

R.plan은원body를불필요하게복제하지않는고정metadata로schemaVersion/purpose/projectId/actorId/clientId/authSessionId/credentialGeneration/controlGeneration/operation/externalCommandId/requestHash/permissionPolicyRef/originRef/policyEventRef/ids/coverageGeneration/authorizedUntil/transactionId/parts를봉인하는후보다. parts는단일key/kind/id/contentHash/bytes/reservedBytes/settledBytes이며후보의정확kind/purpose를사용한다. 추가복제가있으면그실bytes는R자기비용에포함한다.

authSessionId/credentialGeneration/transactionId는최초write의보호metadata이며역사read의현세션으로덮어쓰지않는다. currentread는새진짜인증문맥으로허가하고역사완결은원저장관계만확인한다. 신규Tx final guard는R.plan의원tx·세션/주체/명령을현재Tx와대조한다. 기존SETTLED R을read/replay한다고원tx와지금tx가같아야한다고요구하지않는다.

정확R plan형상·모든물리열template·목적체크·새함수시그니처/실callee·role EXECUTE matrix·현재/역사구분을한묶음으로검수한다. 함수가예상보다추가role/table필드를필요로하면쓰기전Main에반환하고이목록을조용히넓히지않는다.

## 12. 함수 타입과 업무별 실행 체크리스트 후보
다음은 신규helper의 타입 동결 후보이다. 11절callee와 함께 검수하고, 기존U/H/O6 helper의실존signature까지반환받은후최종GO판정한다.

```
fn03_management_context(uuid,uuid,uuid,uuid,bigint,text,jsonb,timestamptz) returns jsonb
fn03_management_prepare(uuid,jsonb,jsonb,jsonb,timestamptz,text) returns jsonb
fn03_management_maximum(jsonb,jsonb) returns bigint
fn03_management_rows(uuid,uuid) returns jsonb
fn03_management_actual(uuid,uuid) returns bigint
fn03_management_reserve(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz,jsonb) returns jsonb
fn03_management_settle(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz,jsonb) returns jsonb
fn03_management_complete(uuid,uuid) returns boolean
fn03_management_history_bundle(uuid,uuid) returns jsonb
fn03_management_final_guard() returns trigger
```

### 업무A: 원문/계약 입력과 목적 결박
소유는신규origin-input·기존project-command와신규input시험이다. 기존CM wire/정의·순수evidence는읽기재사용한다. 입력은원envelope/CM definition 및exact3선택,산출물은변이없는관리원문고정사본/정확ids/context 검산이며외부권한proof를만들지않는다.
- [ ] 원형부재/현재새operation거절을실현재경로RED로기록한다. 준비import오류는그대로구분한다.
- [ ] `node --test tests/unit/FN03/source-content-management-origin-input.test.ts`의정상원문/중복키·추가키/Proxy/getter·현재기한·타scope/ref·await변이·1MiB/2MiB경계음성을고정한다.
- [ ] 기존CM형상에새authority값/nonce/native서명목적을넣지않는최소입력연결을구현한다.
- [ ] 위집중을GREEN으로확인하고기존wire/evidence는변경없으면진도용재실행하지않는다.

### 업무B: 목적 역할·DB 저장·회계
소유는신규0083/origin-store/management-storage 및schema/storage시험이다. 원0040/0059/0075~82파일수정0,새forward의목적분기만작성한다. 산출물은정확5행/R·불변관계·역사bundle/current분리및유한M/r/s다.
- [ ] `node --test tests/unit/FN03/source-content-management-origin-schema.test.ts tests/unit/FN03/source-content-management-origin-storage.test.ts`로부재/기존미연결·권한/CHECK/DAG/실투영경계RED를기록한다.
- [ ] 정확함수/각열권한·현재역할/RLS·trigger INVOKER/DEFINER와새R CHECK·purpose dispatcher를목적한정으로작성한다.
- [ ] Mtemplate의원문복제/physical generated/null·시각27자·E.sequence/서버순번타입·r/s고정점·10GiB·부족예약/부분5행/중복/replay/UNKNOWN를합성검산한다.
- [ ] SQL정적검수는실PG구문/ACL/COMMIT PASS가아님을보고하며실행코드/runner의자동적용을추가하지않는다.

### 업무C: 실제 명령 caller·전용 내부조회·정책 선택
소유는기존routes/project-command/필요quota전용접점·policy-editor-profile와신규project-source-content-policy-management 및service/UI11시험이다. 새HTTPread endpoint·일반원문노출0. 실제Access 메서드/거래코드와명시합성PoolClient를소비하고임의성공callback/actorDTO로원인증을대체하지않는다.
- [ ] `node --test tests/unit/FN03/source-content-management-origin-service.test.ts tests/unit/UI11/source-content-management-policy.test.ts`에서실제기존route/정책선택의미연결RED를확인한다.
- [ ] callback/query/xid/원command 결박→목적commit1회→보호결과검산과기존CM공개결과를연결한다. replay는generic즉시반환전에역사bundle검산을거친다.
- [ ] 본인AUTO관리→실합성저장/비용정착→전용내부read/UNVERIFIED·독립read권한거절·현재/역사주체·잠금뒤fresh시각/역행·회수/기한·다른Tx/교체query·rollback/COMMIT불명추가효과0을검사한다.
- [ ] 기존일반목적/거절/승인·계상검사는직접영향사례만선택한다. 일반receipt시각/과거hash·원문/권한조건완화0이다.

### 업무D: 독립 검수·게시·통합
- [ ] 집중5파일·필요직접인접의정확명령/exit·RED/GREEN·준비오류/정식실패횟수·미검증과정리/knownhandle0을반환한다.
- [ ] Primary `npm run typecheck`/`git diff --check`,Main 필요Webmemorybuild를분담한다. 실제제품과전체테스트범위를혼동하지않는다.
- [ ] exact변경파일/rawmanifest·원문보존·DDL/권한/callee/DAG·quota/시각독립C/I를닫고writer를반환한다.
- [ ] Main은안전commit/privatepush→일반PR필수검증→허용main통합→merged한정smoke/remote복구ref확인→완료branch정리를한다. 새계약직접채택없는상태로제품을main에밀어넣지않는다.
- [ ] 이첫선행과전체관측producer/실제Agent제어·전체44업무완료를구분하고다음미완료업무로이어간다.

## 13. 실제 집계 callee와 금지된 우회
다음은 기존reader가 최종정의 원문을대조한 실존callee다. 새형상/허가함수로개명해추정하지않는다.

|집계|실존 signature|최종정의|
|---|---|---|
|FN15 U/H|fn15_storage_actual(uuid)→numeric / fn15_storage_future(uuid)→numeric|0073_control_handoff_acceptance.sql.pending:192/197|
|FN75 U/H|fn75_project_storage_actual_bytes(uuid)→bigint / fn75_project_storage_future(uuid)→bigint|0075_user_common_setup_definitions.sql.pending:267/270|
|FN76 U/H|fn76_storage_actual(uuid)→bigint / fn76_storage_future(uuid)→bigint|0076_native_first_receive.sql.pending:360/629|
|O6|fn09_registered_other_bytes(uuid)→numeric|0077_registered_execution_preparation_options.sql.pending:311|
|전체완결|quota_complete(uuid)→boolean|0073_control_handoff_acceptance.sql.pending:331|
|기저완결|quota_complete_before_source(uuid)→boolean|0076_native_first_receive.sql.pending:672|
|목적완결|quota_settled_complete(project_storage_reservations)→boolean|0082_fn09_origin_reuse_synthetic_start.sql.pending:656|
|원행canonical비용|fn75_cost(jsonb)→bigint|0075_user_common_setup_definitions.sql.pending|
|물리투영/예약고정점|fn09_registered_cost_projection(jsonb)→jsonb / fn09_registered_reservation_fixed_point(bigint,jsonb,bigint DEFAULT NULL)→bigint|0077_registered_execution_preparation_options.sql.pending|

U/H의base는R.SETTLED settled_bytes합 및R.RESERVED/IO_STARTED/UNKNOWN reserved_bytes합을각각구한SQL이다. 위U/H보조집계와O6를더하되손상helper오류를0원으로대체하지않는다. 같은project account행을FOR UPDATE로읽고coverage_state=VERIFIED/generation/cacheusedheld와재계산을검산한다.

quota_account(s,a,c,p)의최종0069정의는environment_configuration_context를호출하므로일반비용getter로재사용하지않는다. fn15_ordinary_quota_account(s,a,c,p,q)는upload/proposal/source-link등기존한정연산뿐이며새관리목적을그operation으로위장하지않는다. quota_current(s,a,c,p,q)의현재목적검산을새관리허가로자동확대하지않는다.

이미 quota_complete→quota_complete_before_source→quota_settled_complete→각purpose complete 호출이있다. 따라서새 fn03_management_complete/actual/history에서quota_complete를다시호출하지않는다. 필요한기존coverage/전체완결검산은신규R을생성하기전기존거래경계에서만수행하고,신규목적내부의U/H합산기로quota_complete를쓰지않는다. FN76 future의원plan/window잔여검사실패는멈춤사유다.

## 14. 물리열 template와 시각의 추가 확인
M/actual의기준은논리CM projection의필드수보다실제to_jsonb(물리행)이다. 초기0011/0040/0059및후속ALTER를대조한뒤다음집합을서로검산한다. 새0083이추가물리열을생성한다면그비용을조용히누락하지말고Main에반환해template/정확목록을동결한다.

- C에는논리명령증거에서제외되는draft_id와received_at도포함한다. PROJECT의draft_id=null도키/null 비용으로계상한다. 실제received_at와completed_at은별개다.
- A에는authorized_at가있다. 기존CM receipt모델의필드만골라물리비용을축소하지않는다.
- U는project_id/server_sequence/event_id/actor_ref/client_ref/command_id/operation_id/target_ref/policy_ref/approval_ref/outcome/reason_code/scope_digest/recorded_at/source_kind/correction_of를모두포함한다.
- E는기존source_content_policy_events의기본12열과generated previous_id/previous_version/previous_hash를포함한다. previous_ref의null/정확fullref분기를유지한다.
- O는후보exact9전체이며snapshot exact10은도출값일뿐별도물리저장하지않는다.
- R은0059의실제22열(id부터settled_at까지)전체와plan_json의실복제를포함한다. 원r/plan/hash·authorized_until은정산으로다시쓰지않는다.

C.received_at의기존Tx수신시각과새목적의fresh완료시각을섞지않는다. 새목적의E/O발급과C.serverReceivedAt/completed_at·U기록은부모CM의시각관계와맞도록정하고,기존일반목적의now()/transaction_timestamp()는유지한다. 실제물리시각27문자정규화와공개/원명령ISO시각형식은서로다르므로각층의원형식을그대로검사한다. 저장시각을물리COMMIT시각이라고표시하지않는다.

## 15. 외부 기술 근거와 미검증
PG15공식문서의[행 보안 정책](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)은RLS가SQL권한과별개로적용되고기본permissive정책들이OR로합쳐짐을설명한다. 따라서기존false정책을삭제해전체를열기보다명시purpose역할정책만추가하는후보이며,이문서인용이구현된역할/권한검산을대신하지않는다. 같은문서는TRUNCATE가RLS대상이아님도명시하므로별도권한/차단trigger를보존한다.

[PG15 SELECT 권한](https://www.postgresql.org/docs/15/sql-select.html)은행잠금절에대상표의최소한열UPDATE권한도필요함을명시한다. 위열ACL은잠금조건을명시하기위한것이지임의데이터변경권한을app에주는안이아니다. 실제PostgreSQL설치·권한부여·ACL경쟁·COMMIT시험은NOT_RUN이다.

## 16. 후속 ACL·비용 helper 선행 finding
기존 Primary의 정확 원문 읽기는 0082의 quota_plan_valid/quota_settled_complete가 SECURITY DEFINER임을 확인했다. 기존 dispatcher의 owner·security mode를 바꾸지 않으며, 새 private plan/complete를 호출하는 실제 기존 owner의 EXECUTE edge까지 명시해야 한다. app/PUBLIC에 private helper를 열어 오류를 우회하지 않는다. INVOKER 즉시 trigger가 private complete를 직접 호출하는 방식도 쓰지 않는다. 정확 signature/실제 owner 확인과 전체 transitive callee ACL matrix는 아직 최종 동결 전이다.

0077의 fn09_registered_reservation_fixed_point(bigint,jsonb,bigint)는 reservation_cost를 거쳐 cost_projection 및 kind=R인 registered_cost와 fn01_json을 호출한다. 첫 fixed_point만 권한을 주는 matrix는 충분하지 않다. 실제 각 함수의 security mode와 caller를 검산해 필요한 edge만 허용해야 한다. E/O/C/A/U actual은 후보대로 fn75_cost 기반이며 registered_cost에 새 O/E kind를 덧붙여 대체하면 기존 kind whitelist와 충돌한다. 기존 함수 whitelist를 완화하거나 논리행으로 물리비용을 대체하지 않는다.

이 finding은 정적 기술 준비이며 코드/SQL/실DB/권한 실행 증거가 아니다. 후보 cbefc3e3·패킷239845d6의 고정 내용과 미채택 GO0는 유지한다. 구현 전 private helper 전이·finalguard·lock 및 물리 M template을 독립 검수한다.

## 17. 물리 M template의 정확 열·분기 제안
기존 reader가 실제 초기 정의와 후속 ALTER를 대조했다. 아래 O만 신규 제안이고 나머지는 기존 열 목록이다. 비용 계산/실SQL 검증은 아직 수행하지 않았다.

|행|물리열 전체|정의 근거|
|---|---|---|
|O 9|project_id,id,version,management_command_id,policy_event_ref,request_json,request_hash,recorded_at,content_hash|후보 §2, 신규0083 정의 대상|
|E 15|project_id,id,version,sequence,subject_user_id,disposition,snapshot_json,content_hash,previous_ref,management_command_id,recorded_at,expires_at,previous_id,previous_version,previous_hash|0040:5~13, 마지막3열은 저장 생성열|
|C 21|id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at|0011:17~26|
|A 9|id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at|0011:58~63|
|U 16|project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of|0011:71~77|
|R 22|id,project_id,actor_id,client_id,external_command_id,operation,command_hash,part_key,part_kind,plan_json,plan_hash,reserved_bytes,settled_bytes,phase,start_fence,authorized_until,server_command_id,authorization_receipt_id,scope_digest,created_at,started_at,settled_at|0059:16~29|

0077:111~123의 cost_projection은 최상위 version/generation/*_version/*_generation/server_sequence/reserved_bytes/settled_bytes/start_fence만 정수 문자열로 정규화한다. E.sequence는 숫자이고 U.server_sequence는 문자열이다. 중첩 snapshot/result/plan에는 같은 정규화가 재귀 적용되지 않는다. 따라서 숫자값을 임의 문자열로 바꿔 비용을 축소하지 않는다.

UUID/hash/원wire·발급ID/정책·previous refs와 원 payload는 준비 단계 실값을 사용한다. 잠금 뒤 확정 sequence도 실값을 쓸 수 있다. 아직 확정되지 않은 E.sequence 상계는 숫자9007199254740991, U.server_sequence 상계는 정규화된 문자열9223372036854775807이며 실제 복제 위치마다 계상한다. 이 상계는 인증/권위 증거가 아니다.

O.recorded_at·E.recorded_at/expires_at·C.received_at/completed_at·A.authorized_at·U.recorded_at·R.authorized_until/created_at/started_at/settled_at은 비null 물리투영을 UTC27자 형식으로 제한하고 실제 정산도 그 범위를 검사한다. 미확정 비용에만 같은27자 ASCII 상계를 사용한다. C.result_ref.serverReceivedAt 등 중첩 공개시각은 기존 공개ISO 원형 그대로이며 물리열 sentinel을 넣지 않는다.

PROJECT C.draft_id·승인없는 C.approval_consumption_id/payload_ref·A.approval_decision_ref·U.approval_ref/correction_of는 명시null 키 비용을 포함한다. E.previous_ref/생성3열은 최초null 또는 실제 이전fullref의 정확 분기를 쓴다. R 금액은 0..10737418240의 실제 r/s 후보이며 RESERVED/IO_STARTED/SETTLED 각 phase/start_fence/started_at/settled_at/server_command/receipt/digest 분기로 비교한다(0077:126~147).

C.result_ref는 부모CM06 외곽exact10/data exact9 전체를 투영하며 evidenceRefs/warnings=[]·권위4값false·새event/previous fullref·sequence/상태문자열도 포함한다. A.subject_ref={kind:HUMAN,userId,clientId}와 U.actor_ref={kind:HUMAN,userId}를 혼용하지 않는다. M은 이5행 상계의 합, B는 실제5행 합이고 R자기비용은 별도 고정점이다. 0075:156~165 fn75_cost에서 실제로 존재하지 않는 request_canonical/snapshot_canonical/_canonical_result_ref 열을 가상 추가하지 않는다.

후속 ALTER 대조에서 이 기존 C/A/U/E/R의 추가 물리열은 확인되지 않았고 제약 확장이 주였다. 새0083 작성시 목록 밖 물리/canonical열을 추가하면 이 표로 완료라고 주장하지 말고 실제 복제비용을 다시 고정한다. 최종 M JSON 전체·고정점 함수 전이 ACL 및 동시성/기한 검수 전에는 동결 완료나 코드GO로 표시하지 않는다.

## 18. principal별 EXEC 전이와 finalguard 고정 제안
Primary의 0075/0077/0082·0040 읽기 결과를 반영한다. 아래는 코드 전에 검수할 정확 호출안이며 실제 catalog/ACL/PG는 NOT_RUN이다.

### 기존 dispatcher 보존
exact regprocedure는 anvil.quota_plan_valid(jsonb), anvil.quota_settled_complete(anvil.project_storage_reservations)다. 0082의 둘 다 SECURITY DEFINER이므로 후속 설치 검산은 pg_proc의 proowner/proacl/prosecdef/provolatile/proconfig를 각각 확인·보존해야 한다. 동일 signature CREATE OR REPLACE라면 기존 owner/ACL 보존 여부를 검산한다. rename/delegate를 쓰면 rename 전 owner OID를 보존하고 새 dispatcher에 복원한다. 고정 owner 이름을 추정하지 않는다. 새 private validator/역사complete의 EXECUTE는 실제 기존 dispatcher owner에만 허용한다. 그 owner가 app 또는 예기치 않은 속성이면 app helper권한 확대로 우회하지 않고 중단한다.

### 새 목적 역할의 INVOKER 전이
다음 edge를 목적 역할의 effective principal에서 전부 검산한다. root 하나만 허용하고 하위 helper를 누락하지 않으며 app/PUBLIC에는 새 private EXECUTE0이다.

```
fn01_hash(jsonb) → fn01_json(jsonb) → 자기 재귀
fn75_cost(jsonb) → fn01_json(jsonb)
  → [실제 canonical 보조열이 있을 때] fn75_json_projection(text)
    → fn75_string_end(bytea,integer)
fn09_registered_reservation_fixed_point(bigint,jsonb,bigint)
  → fn09_registered_reservation_cost(jsonb,text,bigint,bigint)
    → fn09_registered_cost_projection(jsonb)
    → fn09_registered_cost(jsonb,text,jsonb) → fn01_json(jsonb)
```

fn09_registered_cost의 kind whitelist P/C/A/U/K/R은 그대로다. E/O 비용은 fn75_cost(cost_projection(실물행))이고 R fixed-point만 kind=R/pairs=NULL이다. C/P canonical pairs를 요구하는 registered_cost에 부모5행을 억지로 넘기지 않는다. 실제 보조canonical열이 없는 원행에 가상열을 넣어 조건부 분기를 만들지도 않는다.

### collector의 DEFINER 경계
새 역할이 직접 호출할 root는 fn15_storage_actual(uuid),fn15_storage_future(uuid),fn75_project_storage_actual_bytes(uuid),fn75_project_storage_future(uuid),fn76_storage_actual(uuid),fn76_storage_future(uuid),fn09_registered_other_bytes(uuid)다. 각 root 내부는 그 함수의 실제 owner principal이며 하위 callee를 새 목적 역할에 무차별 GRANT하지 않는다. matrix의 edge마다 caller effective owner OID와 callee regprocedure·security mode·기존 ACL을 대조한다. 기존 collector 내부 권한이 부족하면 필요한 정확 edge를 반환하며 임의로 원래 정책을 확장하지 않는다.

주요 내부 전이는 FN15 actual/future→fn15_control_storage_actual(uuid,uuid)/fn15_cost_bytes(jsonb)/fn15_physical_projection(jsonb)→fn15_cost_encode(jsonb,text)/fn01_json(jsonb), FN75 actual→fn75_project_storage_actual(uuid)+위cost전이, FN76 actual→fn76_l_rows(uuid)/fn76_r_rows(uuid)/fn01_json(jsonb)다. FN76 future는 fn76_aggregate_max(jsonb)/fn76_profile_future(uuid)/fn76_projection_bytes(text,jsonb)/fn76_reservation_remaining(anvil.native_receive_storage_reservations) 및 기존metadata계상을 소비한다. other_bytes는 기존6표 소계이며 다른 인증/저장 허가를 생산하지 않는다.

### E CHECK의 암묵적 호출
0040 INSERT CHECK는 source_read_canonical_json(jsonb) 재귀, source_read_hash(jsonb)→canonical, source_read_iso(timestamptz), source_read_ref(jsonb)→source_read_exact(jsonb,text[])를 호출한다. RPC 본문 밖 CHECK도 새 역할의 실효권한 matrix에 포함하며 app/PUBLIC 원권한을 넓히지 않는다.

### 신규 private helper·신규 Tx 최종 검산
최소 후보는 fn03_management_plan_valid(jsonb)→boolean,fn03_management_complete(uuid,uuid)→boolean,fn03_management_current_final(uuid,uuid,text)→void,fn03_management_final_guard()→trigger다. 새 목적 역할이 이 함수 owner이며 기존 plan dispatcher→plan_valid, 기존 settled dispatcher→역사complete, 목적RPC/read→역사complete, 목적DEFINER deferredtrigger→신규Tx current_final의 edge를 고정한다. INVOKER 즉시 rowtrigger는 private helper를 직접 호출하지 않는다.

finalguard는 E/O/R의 JOIN 성공행만 수집하지 않는다. 이번 Tx의 defineSourceContentPolicy C 자체를 수집해 C만 있고 E/O/R이 없는 불완결도 거절한다. 역사complete는 현재세션·정책·기한으로 되돌아가지 않고 신규 C분기에만 sameTx/R·최소기한을 최종 강제한다. 전체matrix/시그니처·M전체JSON·동시성/시각 독립검수 전 최종동결 주장은 하지 않는다.

### §18 사전 M1 정합화
독립 사전 C0/I0/M1은 11·12절 complete의 void와18절 boolean 후보 불일치다. 내부 helper는 fn03_management_complete(uuid,uuid) RETURNS boolean으로 통일한다. 기존 settled dispatcher는 해당 boolean을 반환하며 NULL은false로 닫는다. commit/read/history_bundle/current_final에서 완결성 진행조건은 반환값 IS TRUE이고 false/NULL이면 해당 거래를 거절한다. 예외를 잡아 정상false/0원/성공 bundle로 바꾸지 않는다. current_final은 신규Tx context/xid/기한 검산과 이완결 조건을 강제하며 RETURNS void, deferred final_guard는 그 호출 성공 뒤에만 trigger를 종료한다. 따라서 void 호출로 complete의 실패를 무시하는 경로를 허용하지 않는다. 이 정합화는 기존 후보의 불완결 거절 의미를 바꾸지 않는 내부 타입 선택이며 아직 전체시그니처/M/ACL 동결이나 구현 승인이 아니다.
