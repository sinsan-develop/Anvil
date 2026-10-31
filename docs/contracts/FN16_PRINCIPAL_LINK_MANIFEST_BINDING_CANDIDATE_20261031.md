# FN16 PRINCIPAL_LINK·고정 manifest member 결박 후보

2026-10-31 / Primary 어울 / **NOT_ADOPTED · 구현/실행 GO0**
대표 DOCUMENT_VERSION 논리형식 SHA924D7359 §10과 직접채택 E561FC13은 기준으로 존재한다. 아래 새 export codec·관측·입력 계약은 그 채택에 자동 포함되지 않는다. 문서만 작성하며 제품/SQL/시험·실DB/권한/키/사용자파일/서비스/Agent 실행은 0이다.

## 1. 실제 근거와 선택
| 안 | 관계 주장의 범위 | 추가 관측·보존 차이 |
| --- | --- | --- |
| A COMMAND_FK_DERIVED | 선택 command의 actor_id/client_id 복합FK와 해당 receipt/audit의 주체·scopeDigest 일치에서 관계를 유도 | clients 행은 관측/반출하지 않음. 당시 command에 저장된 주체 결박을 보존하지만 독립 clients 관계 관측은 아님 |
| B SAME_OBSERVATION_CLIENT_LINK | A에 더해 동일 고정 DB 관측의 clients(id,user_id) 2열 관계를 선택 command와 대조 | 계정이 아닌 opaque 역사 관계만 추가 관측. 실제 계정행/credential 반출0. 추가 export codec/선택조회·manifest 결박이 필요 |
**권장 제안은 B**다. 원 client↔user 관계를 독립 관측으로 구별해 보존하기 때문이다. 비용/범위가 작은 A도 가능하나 B의 관측과 같은 보증으로 표시하지 않는다. 둘 다 역사적 사람의 실재·동일성, 진짜 서버의 서명/진위, 현재 로그인·권한 이전을 보증하지 않는다.
근거: `0001_projects_access.sql:9~12` clients의 user_id·복합 UNIQUE; `0011_authorization.sql:17~30,58~80` command 복합FK·receipt·audit; `project-command.ts:113~116` 원주체/명령/digest 동시 생산.

## 2. export 원record — 계정 없는 exact projection 제안
아래 UUID/hash/VersionRef는 기존 검증 의미를 재사용한다. key는 순서가 고정된 배열, Hash는 기존 canonicalJson/contentHash의 SHA256이다. object는 명시 키만 허용하고 null/생략을 구분한다. 원 projection과 namespace를 덧붙인 역사 참조는 서로 다른 객체다.
```text
principalRecord = {kind:'SOURCE_PRINCIPAL_LINK_V1', originProjectId:UUID,
 userId:UUID, clientId:UUID, basis:'COMMAND_FK_DERIVED'|'SAME_OBSERVATION_CLIENT_LINK',
 commandKey:[UUID], receiptKey:[UUID], auditKey:[positiveSafeSequence,UUID],
 clientRelationKey:null|[UUID,UUID]}
clientRelationRecord = {kind:'SOURCE_CLIENT_USER_RELATION_V1', userId:UUID, clientId:UUID}
```
commandKey는 내부 commands.id, auditKey는 server_sequence/event_id, clientRelationKey는 [userId,clientId] 순서다. A의 clientRelationKey는 반드시 null이고 관계 record를 요구하지 않는다. B는 정확 쌍의 관계 record가 필수다. 관계 record의 원관측은 clients의 id/user_id 2열만 읽어 대응시킨다.
userId/clientId는 문서 원 authorRef.userId/clientId 및 선택 command actor_id/client_id와 모두 같아야 한다. principalRecord만의 값 일치나 basis 태그는 관측 증명이 아니다. 역사 ref는 기존 제안 `{namespaceHash,recordKind:'PRINCIPAL_LINK',key:[userId,clientId],recordHash:H(principalRecord)}`에 이 명령별 주장을 연결한다. 여러 명령의 같은 쌍은 명령별 proof가 다르므로 원record를 덮거나 같은 hash로 가정하지 않는다. 명령별 member key는 다음 절의 복합키로 구별한다.
로그인명/표시명/이메일·client label·상태/role/serverOwner·credential_generation·password/hash·session/token/CSRF·실키·기기정보는 허용키에 없으며 반출0이다. 원 users/clients 행이나 가짜 FK 계정을 만들지 않는다. opaque UUID는 익명성을 보증하지 않는다. 계정 제외와 문서 원문 내 비밀검사는 별개이며 새 비밀탐지 기준을 만들지 않는다.

## 3. 고정 source manifest에 요구하는 최소 member 입력
원 manifest 전체 형식을 새로 정의하지 않는다. 후속 등록 codec/adapter가 실제 고정 manifest에서 아래 member view와 원 projection을 추출·검산할 수 있어야 한다. 이것은 단독 성공 태그/호출자 임의 summary가 아니다.
```text
sourceManifestRef = {id:UUID,version:positiveSafeInteger,contentHash:Hash}
member = {recordKind, key, projectionHash:Hash}
suppliedMember = {member, projection}
```
sourceManifestRef의 version은 원 manifest의 형식/버전 계약에 결박돼야 하며 임의로 1을 부여하지 않는다. 실제 원 manifest codec/원문이 없으면 참조 hash만으로 검증하지 않는다. member는 원 manifest의 실제 구성원이어야 하고 supplied projection의 H와 projectionHash가 정확히 같아야 한다. 아래 표 외 추가 필드는 거절한다.
| recordKind / key | projection의 exact 필드 후보 |
| --- | --- |
| PRINCIPAL_LINK / [userId,clientId,internalCommandId] | §2 principalRecord 전체 |
| CLIENT_USER_RELATION / [userId,clientId] | §2 clientRelationRecord 전체(B만 필수) |
| PROJECT_COMMAND / [internalCommandId] | id,projectId,scopeKind,scopeId,actorId,clientId,operation,operationId,externalCommandId,state,controlGeneration,requestHash,policyRef,targetRef,authorizationReceiptId |
| AUTHORIZATION_RECEIPT / [receiptId] | id,scopeKind,scopeId,commandRecordId,subjectRef,policyRef,scopeDigest,approvalDecisionRef |
| AUDIT_EVENT / [serverSequence,eventId] | projectId,serverSequence,eventId,actorRef,clientRef,commandRecordId,operationId,targetRef,policyRef,approvalRef,outcome,sourceKind,correctionOf,scopeDigest |
command targetRef는 원 APPLIED result.data.ref에서 검산해 추출한 DOCUMENT_VERSION fullref이며 원문/원codec 없이 새로 조립하지 않는다. state는 APPLIED, scopeKind는 PROJECT, scopeId/projectId는 originProjectId여야 한다. subjectRef는 원 HUMAN userId/clientId, actorRef는 원 HUMAN userId이며 현재 조회자로 치환하지 않는다. 원 requestHash 자체의 전체 원명령 재구성은 이 최소 projection의 범위를 넘어 별도 미지원으로 남는다.
namespace는 기채택 형식의 originProjectId/sourceManifestHash를 사용하고 sourceManifestRef.contentHash가 sourceManifestHash와 같아야 한다. 원 manifest는 이 역사봉투 생성 전에 고정된다. **원 source member/projection에는 namespaceHash나 산출봉투 hash를 넣지 않는다.** 원 manifest 고정 후 namespaceHash를 역사 wrapper에만 부착해 순환 hash를 피한다. 새 산출 manifest와 원 source manifest를 동일 객체로 취급하지 않는다.

## 4. 검증 순서·충돌·누락
1. 닫힌 key/type/안전정수와 허용 비반출 projection을 검사한다. 구조오류는 REJECTED, 원문값을 오류에 노출하지 않는다. 현재 인증/접근은 별도이며 원주체를 현재 계정으로 위장하지 않는다.
2. 고정 sourceManifestRef/실제 manifest 원문·version codec의 hash를 검산하고 member의 실제 소속을 대조한다. 최신 manifest/command/clients 조회로 누락을 메우지 않는다. 각 projectionHash와 supplied projection의 hash를 직접 비교한다.
3. 같은 namespace 안에서 (recordKind,key)의 누락/중복/상반 hash를 거절한다. 서로 다른 namespace는 자동 합치지 않는다. 같은 쌍의 명령별 PRINCIPAL_LINK member는 command별 key로 구별하고, 문서 역사 참조가 선택한 정확 commandKey와 대응시킨다. 관계 쌍 참조 하나만으로 명령별 주장을 임의 선택하지 않는다.
4. command↔문서 fullref/원author/client↔receipt subject↔audit actor/client/operationId/targetRef/policy를 대조한다. D=H{projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef}와 receipt/audit scopeDigest가 정확히 같아야 한다. 내부command ID와 외부명령 UUID를 혼동하지 않는다.
5. 선택 command의 원 receipt가 정확1이고 원 PRIMARY HUMAN_COMMAND/APPLIED/correctionOf=null audit가 정확1인지 확인한다. 고정 관측에서 해당 command의 대상 receipt/audit 전부를 빠짐없이 선택했다는 capture 완결 근거가 필요하다. 공급된 배열 길이1이나 manifest의 자기주장만으로 DB에 다른 증빙이 없었다고 증명하지 않는다. approvalRef/decision의 대응은 해당 원codec이 없으면 미지원이다.
6. B는 같은 고정 DB 관측의 clients 2열 projection이 command의 원쌍과 같고 실제 manifest member임을 확인한다. A는 이 독립 관측을 수행했다고 표시하지 않는다. 현재 사용자의 동일 UUID·이름이나 다른 시점의 관계로 대체하지 않는다.

## 5. 결과 의미와 실제 지원 선행
내부 projection hash/관계 값의 일치는 `INTERNAL_MATCH`로만 구별할 것을 제안한다. 원 manifest의 실제 member 결박은 별도 검사다. 둘의 성공을 역사적인 사람/서버 진위의 증명으로 승격하지 않는다. 기채택 history checks로 연결하는 exact adapter 의미도 새 채택 대상이다.
수행하지 않은 capture/출처 검사는 NOT_RUN, 실제 원record/member가 없으면 MISSING, exact codec/관측 생산자가 없으면 UNSUPPORTED, 값·hash 모순은 MISMATCH다. 필요한 원문/폐쇄가 모두 지원되기 전에는 내부 일치를 principalRelation/sourceBinding의 VERIFIED로 바꾸지 않는다. 실제 bytes 검산·전체 복원/권한은 별도 미지원·false를 유지한다.
`project-control-ledger-inventory.ts:51,75~89`는 원행 derivedMetadataHash/별도 projectionHash를 갖지만 주체를 REDACTED로 내보내고 원payload/result를 반출하지 않는다. `project-inventory-composition.ts:149~151`도 component digest/현재 읽기 제약이며 비원자·불완전이다. 이 summary를 위 원record로 재사용/재봉인하지 않는다. `file-manifest.ts:9,18~20,54~58`의 선택파일 hash도 DB/capture 출처 인증이 아니다.
현재 확인한 backup module 목록·위 조회/생산 접점에는 이 원manifest/member·동일관측·현재통제 capture의 불변 receipt/job을 연결하는 helper가 없다(전 저장소 전체부재 주장 아님). 이를 성공 callback·새 능력 태그로 대체하지 않는다. 실제 SUPPORTED의 선행은 exact export codec, 선택자료의 동일 고정관측/누락 없는 proof 선택 producer, 원 manifest 실제 구성원 hash 검산, 현재 통제 capture의 범위/식별/결과를 원manifest에 결박하는 근거다. 새 외부 서명서버·키서비스는 제안하지 않는다.

## 6. 필요한 정확 결정
- A의 command 유도 관계만 보존할지, 권장 B의 동일관측 2열 관계를 추가 보존할지 선택. B 선택도 실제 DB 읽기 GO가 아니다.
- §2~3의 비반출 source projection/member 키와 문서 PRINCIPAL_LINK 쌍 참조↔명령별 member 대응을 채택할지 결정. 기존 공개 DTO/표/API 변경은 이 문서에 포함하지 않는다.
- 원manifest version/codec·고정관측/capture 완결 근거의 구체 후속 계약과 현재 접근/보존 경계를 확정할지 결정. 미확정이면 MISSING/UNSUPPORTED/NOT_RUN 유지; 자가 hash를 진위로 격상0.
제품 수치·암호외피·job 저장형식·새 권한/schema·실제 수입/복원은 함께 설계하거나 승인하지 않는다. 이 후보는 구현 완료가 아니며 정확 채택 후 별도 최소 WI가 필요하다.