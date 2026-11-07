# FN05 프로젝트 간 지식 공유 — 최소 실사용 계약 후보

- 상태: **DRAFT / NOT_ADOPTED**. 구현·SQL·새 API·권한 변경의 기준으로 채택하지 않는다.
- 일자/담당: 2026-10-21 / Project Main 어울.
- 근거: WORK_PLAN Stage B FN05/UI10, FUNCTION_WORK FN05, 설계 §8.1·§11.11, INTERFACES §10.3의 requestKnowledgeShare 대표 요구와 §10.1의 기존 일회 승인 계약.
- 목적: 프로젝트 지식을 사용자가 소유하고 필요한 곳에 재사용하되, 요청을 보관한 것을 공유·사용자 승인·수신으로 속이지 않는다.
- 이번 문서는 PMO가 요구한 자료·공개/권한 delta 판단용이다. 제품 코드는 변경하지 않았고 실제 DB/Agent/외부 전송은 0이다.

## 1. 현재 구현과 정확한 delta

현재 projects/routes.ts의 명령 enum/dispatch와 knowledge.ts에는 requestKnowledgeShare가 없다. 대표 명세는 versionRefs·explicitTargets(project/common)·purpose·approvalRef?를 제시하지만, 요청자의 사적 초안인지 대상에게 보이는 요청인지와 승인자가 누구인지 정의하지 않았다.

ProjectApprovals의 consumableOperations는 현재 uploadArtifact·candidateOperations·trustRegistrationOperations다. requiredDecider는 요청한 HUMAN이고 client/control도 원 요청과 결박된다. 이를 대상 프로젝트 소유자의 승인이나 교차 프로젝트 공유 허가로 재사용할 수 없다. 현재 승인 ID를 새 공유 명령에 넣어도 허용되지 않는다.

새로 결정할 사항은 요청 payload의 불변 저장, source 쪽 조회 ACL, 대상 UUID 보관, 새 명령/정책 연산이다. 아래 A안은 대상 프로젝트를 읽지 않으나 새 영속 자료·공개 계약이라는 사실은 남는다. 실제 공유·대상 수신·승인권 부여와는 별개다.

## 2. 대안과 권장

| 안 | 대상 노출/권한 | 장단점·가역성 |
|---|---|---|
| A 출발 소유자의 사적 요청 초안 | 대상 UUID는 사용자가 입력한 불투명 선언만 보관. 대상 조회/존재 확인/알림/승인 0 | 실제 내용과 목적을 먼저 검토할 수 있고 새 교차 권한이 없다. 대상 유효성·공유는 미완료다. 철회 사건으로 사용 중단 가능, 기록 자동 삭제는 하지 않음 |
| B 양쪽 프로젝트에 요청 전달 | source의 명시 승인 뒤 최소 요청 metadata를 target의 허가된 승인자에게 전달 | 실사용 공유에 가까우나 metadata 전달 자체가 자료 반출이다. 대상별 노출·승인·철회/회수의 새 계약이 필요하며 이미 본 metadata를 되돌릴 수 없음 |

**이전 제안 이력:** A 선행 채택 권장은 2026-10-21 PMO에서 채택하지 않았다. §3~6의 A는 대안 비교용으로만 보존하며 구현하지 않는다. 후속 최소 실제 B 여정은 §7에 정의하되 여전히 NOT_ADOPTED다. 공통스코프·외부 서비스는 B에서도 제외한다.

## 3. A안 exact DTO 후보

아래 모든 object는 명시 필드 외 추가 키를 거절한다. JSON 본문 2MiB 상한과 기존 UUID/VersionRef/hash·유효 Unicode·known-secret 검사를 재사용한다. 링크나 본문 속 지시를 실행하지 않는다.

### 3.1 명령

기존 PROJECT command envelope를 사용하되 operation은 후보다. actor/client/controlGeneration은 인증 세션/서버 제어 상태와 대조하고 baselineRefs=[], approvalRef=null이다.

- requestKnowledgeShare: targetId=null, expectedVersion=0.
  payload={versionRefs:VersionRef[1..20],explicitTargets:{kind:'PROJECT',projectId:UUID}[1..20],purpose:string,expiresAt:UTC_ISO}.
- withdrawKnowledgeShareDraft: targetId=requestId, expectedVersion=현재 requestRef.version.
  payload={requestRef:VersionRef,reason:string}.

중복 versionRef/대상·source와 같은 target·빈 목적을 거절한다. purpose/reason은 1..20000자, expiresAt는 서버 now보다 뒤이고 최대24시간 이내로 제안한다. 24시간은 기존 정책으로 가장하지 않는 **이번 수치 결정 후보**다. 불변 expiresAt를 개정/재시도로 연장하지 않는다. commonScopeId·client가 선언한 승인자/상태/권한/제목/hash 대체·직접 원문은 거절한다.

참조 지식은 source 프로젝트의 현재 head/version/hash, 최신 적합 내용검토·별도 확정이 유효하고 EXCLUDED/SUPERSEDED/격리/known-secret 의심이 아니어야 한다. 원문 검사는 기존 source 보호 reader로 하며 새로운 raw GET나 대상 프로젝트 reader를 열지 않는다. 제목/본문 복사 대신 정확 ref만 보관한다.

성공 후보는 기존 APPLIED receipt의 data={status:'SHARE_DRAFT_STORED',ref:VersionRef} 또는 철회의 SHARE_DRAFT_WITHDRAWN이다. 성공은 사적 보관/철회만 뜻하며 대상 수신·공유 허가·복사는 0이다. 전체 요청 snapshot은 별도 exact GET에서만 반환한다.

### 3.2 조회

- GET /api/v1/projects/:projectId/knowledge-share-drafts?limit&cursor
  응답={items:{ref,state:'DRAFT_PRIVATE'|'WITHDRAWN',expiresAt,recordedAt}[],hasMore,nextCursor,observedAt}.
- GET /api/v1/projects/:projectId/knowledge-share-drafts/:id/versions/:version
  응답={ref,snapshot:{projectId,requesterUserId,versionRefs,explicitTargets,purpose,expiresAt,previousRef,event:'CREATED'|'WITHDRAWN',reason,recordedAt},eligibility:{state:'UNVERIFIED'|'RECHECK_REQUIRED'|'EXPIRED'|'WITHDRAWN'},targetValidation:'NOT_PERFORMED',delivery:'NOT_SENT',approval:'NOT_REQUESTED',transferAuthorized:false,observedAt}.

created snapshot의 previousRef=null/reason=purpose, withdrawn은 정확 앞 ref·고정 원 요청 필드를 보존하고 reason만 새 철회사유로 추가한다. snapshot hash는 canonicalJson snapshot 기준이다. eligibility는 공유 가능 판정이 아니며 정상 읽기만으로 현재성 재검증/승인을 만들지 않는다. 자동 만료는 읽기 projection이지 불변 역사 변경이 아니다. 만료와 무관하게 권한이 남은 작성자는 과거 원문을 읽을 수 있다.

목록은 본인의 source 프로젝트 사적 요청만 반환한다. cursor는 actor/project/limit/view에 결박한다. 목적·원 refs·대상 UUID는 목록에 넣지 않고 상세에서만 반환한다. source 원 제목/본문/해당 지식의 출처 본문·대상 이름/존재/소유자·계정 정보는 두 응답에 모두 없다. target ID를 키로 하는 검색/목록/수신함 API는 만들지 않는다. 상세 조회에서도 purpose/reason의 현 known-secret 검사를 적용하며 의심 시 값 없는412로 상세를 제한한다. 자동 마스킹을 완전 보호로 주장하거나 원본을 삭제하지 않는다.

## 4. 주체·권한·실패 경계

| 단계 | source 검사 | target 검사/노출 |
|---|---|---|
| 초안 작성 | 현재 인증 HUMAN/OWNER·current client/control·명시 AUTO 정책의 새 연산. source exact 지식/원문·보호 검사 | UUID 문법/중복/동일 source만 검사. target DB 조회·존재 확인·알림/승인 0 |
| 목록/상세 | 현재 세션 + source 현 OWNER + request.requesterUserId=actor. 읽기는 current writer 제어를 요구하지 않음 | 입력했던 UUID만 같은 작성자에게 상세로 반환. 새 정보 없음 |
| 철회 | 현재 OWNER/client/control·requesterUserId=actor·별도 철회 연산 정책·현재 exact requestRef/CAS. 다른 작성자는 변경 없이 동일404 | target reader/명령 0 |
| B의 전달/대상 승인 | **미채택**. §7에서 source 공개 허가/정확 metadata payload를 후보로 구체화 | 양쪽 OWNER/current client/control·정책·결정/전달범위의 §7 후보는 아직 승인되지 않음 |

A안에는 target 승인자 자체가 없고 기존 FN11 requestApproval/decideApproval/consume에 연결하지 않는다. A안 정책이 REQUIRE_APPROVAL이면 현재 미연결412로 거절하며 AUTO 규칙만으로 보관 가능하다는 제안이다. 정책을 사용자에게 자동 부여하지 않는다. 자동 보관이 공유의 자동 승인이 되는 것은 아니다.

타 source 프로젝트·다른 작성자의 request ID/버전·원문 접근은 같은 404이고 이름/건수/존재를 노출하지 않는다. 타 target 프로젝트 ID는 사적 선언으로만 보관해 existent/nonexistent 모두 같은 처리이며 그 차이로 404/성공을 구별하지 않는다. A안에서 target membership 조회를 추가하면 안 된다. B안이라면 양쪽 권한 없는 대상의 동일404와 그 경계가 새로 필요하므로 A에서 빌려오지 않는다.

인증 만료401, 현재 제어/정책 없음은 기존 코드의412/403, 형식422, 동일 key 다른 payload/옛 ref는409다. 내용 접근 권한보다 자세한 오류를 먼저 반환하지 않는다. known-secret 거절 오류에는 값/본문/민감 path를 넣지 않는다.

## 5. 불변 저장·변경·실패

- 신설 테이블 후보: source-scoped request identity(id,projectId,requesterUserId,headVersion)와 append-only request versions(snapshot/hash,actor/client/command/정책/시각). 기존 지식/대상자료/정책 테이블은 수정하지 않는다.
- created는 v1, 철회는 v2이며 이미 철회된 요청을 되살리지 않는다. 본문/목적/대상 수정은 새 요청이다. 구요청 수정/재사용 금지, 과거 본문/승인/공유 흔적을 삭제하지 않는다.
- 원지식이 개정/제외/격리·재검토되거나 source 정책/소유가 바뀌면 과거 snapshot은 보존하되 후속 사용은 재검토/거절한다. 요청 snapshot을 새 head로 자동 갱신하지 않는다. 아직 실제 transfer 연산이 없어 현재성=허가가 되는 분기도 없다.
- 처리 순서는 현재 인증/제어·현 연산 정책/source OWNER·요청자(기존 요청일 때) 확인 → 동일 commandId/requestHash 조회 → 존재하면 원 receipt 반환이다. 회수된 권한·다른 작성자로 replay 자료를 내주지 않는다. 동일 명령이 없을 때 requestKnowledgeShare 신규 작성에는 최초 기한/source head·상태/내용 적격성을 적용하고, withdrawKnowledgeShareDraft 신규 철회에는 현재 작성자·권한과 요청 head/ref/hash·버전 CAS를 적용한다. 철회에는 원지식의 현재 head/적격성이나 요청 미만료를 요구하지 않는다. 따라서 저장 후 기한 경과·지식 개정은 응답유실한 원 receipt 확인을 막지 않지만, receipt가 현재 공유 적격성을 뜻하지 않는다. 명령 ID가 같고 payload가 다르면409이며 재작성으로 처리하지 않는다. 만료된 사적 요청도 적법한 작성자는 새 철회 명령으로 철회할 수 있다.
- head row lock·exact ref/hash·기대 version CAS와 command/receipt/audit/version append를 같은 transaction으로 처리한다. 동시 철회 1건만 전환, 나머지는409 또는 동일 명령 replay다. 감사/저장 실패 전체 rollback.
- DB guard로 app의 직접 DML/UPDATE·DELETE를 거절하고 정확 APPLIED 명령/actor/client/control·현 정책/receipt와 source FK를 묶는다. JSON 표시를 실제 guard 검수로 대체하지 않는다.
- 승인 소비/공유/전달 부작용은 항상0. 요청을 보관했다는 사실과 새 metadata at-rest 저장은 있다. rollback은 기능 비활성화/후속 migration이며 audit·기존 지식 삭제는 하지 않는다. 보존된 사적 대상 UUID/목적을 완전히 회수했다고 주장하지 않는다.

## 6. 검수와 남은 결정

필수 후보 검수:
1. 원 exact version/본문 보호·상태/정책·현재주체 검사 뒤 사적 보관→같은 명령 재확인→exact 목록/원문 재조회.
2. target 유효/무효/다른사용자소유 모두 target DB 조회·계정/이름 조회·응답 차이·전달0.
3. 타 source/requester/version 직접 ID, cursor 변조·교차 사용자, 만료 세션·옛 control/정책 회수 거절/자료노출0.
4. source 정정/제외/격리·hash 변조, 알려진 비밀, 미승인 approvalRef/REQUIRE_APPROVAL의 소비0.
5. 동시 작성 replay/중복·철회CAS/감사 실패 rollback·직접DML 거절·이력 보존.
6. UI는 '나만 보관/대상 확인 안 함/아직 보내지 않음'을 표시. stored를 sent/approved로 표시하지 않음. 실패/응답유실의 입력·동일명령 보존.
7. 실제 격리 PG/API/UI, 정식DB/served, 외부전송·사용자인수는 각각 별도 기록. 현재 본문은 설계 검토뿐이며 시험 PASS0이다.

**A안 판정 이력:** PMO는 A 선행 채택을 권하지 않았으며 미채택을 유지했다. 20 refs/20 targets/24시간은 결정·승인된 정책이 아니다. 아래 B를 원 공유 요구에 맞춰 구체화하되 제품 구현/실제 공개는 여전히 미허가다.

## 7. B안 최소 실제 공유 여정 — 후속 결정 후보

- 2026-10-21 PMO 판정: **A 선행 구현은 채택하지 않음**. A의 사적 보관은 본래 공유 요구를 완성하지 않으므로 §3~6은 비교 대안으로만 보존한다.
- 이 절의 B도 **DRAFT / NOT_ADOPTED**다. 코드·SQL·실권한/원문 공개 승인이 아니다. 공통스코프·외부 서비스·Agent 전달은 제외한다.
- 최초 범위 후보는 **지식 고정 버전 1개 → PROJECT 1개**의 완결 여정이다. 다중 항목/다중 대상은 별도 후속이며 전체 FN05 완료라고 하지 않는다. A의 20/20/24시간은 B의 기준이 아니다.

### 7.1 실제 흐름과 공개 시점

1. source OWNER가 기존 UI10의 고정 지식 원문을 읽고 target 프로젝트 UUID를 입력한다. 다른 프로젝트를 검색·발견하는 새 디렉터리/계정 목록은 만들지 않는다. UUID는 대상 소유자에게 사용자가 별도로 전달받은 주소이며 서버가 소유자/존재를 확인해 줬다는 뜻이 아니다. 기존 프로젝트 목록에 실제 조회 권한으로 보이는 프로젝트 ID만 선택할 수도 있지만, 그 목록을 비회원 대상 탐색으로 확대하지 않는다.
2. source 전용 미리보기에서 **공개할 metadata**와 **수락 후 복사할 원문 전체**를 각각 확인한다. 원문·제목·종류·바이트/hash는 기존 보호 reader에서 생성하며 클라이언트 입력으로 대체하지 않는다. 출처의 대화/첨부/다른 문서 원문·sourceRefs는 공유하지 않는다. 선택 원문 자체에 포함된 문구/링크는 그대로 보이므로 그 전체 공개에 대한 확인이며 완전 비밀 탐지를 보장하지 않는다.
3. source 현재 HUMAN/OWNER가 '이 대상 프로젝트의 각 조회 시점 현재 소유자에게 아래 metadata를 공개하고, 수락 시점 현재 소유자가 수락하면 이 원문을 복사하도록 승인'을 명시 확인한 **requestKnowledgeShare** 한 번으로 게시한다. 단순 초안 저장이 아니다. source 승인 전 target 목록/GET/알림에 나타나는 항목·건수는 0이다. 소유자가 바뀌면 과거 조회자도 metadata를 이미 봤을 수 있음을 source 확인 화면에 명시한다.
4. 게시 후 target의 현재 OWNER에게만 아래 승인된 metadata가 수신함에 나타난다. target 원문 GET는 아직 없다. 대상의 사람은 **미검토 자료를 제안 상태로 받아 나중에 내용 검토한다**는 범위로 ACCEPT 또는 REJECT한다. 이는 원문 내용이 적합하다는 검토가 아니다.
5. ACCEPT transaction에서 양쪽의 정확 허가·원문·상태를 다시 검사하고, source 공개 동의 1회 소비 + target 결정 + 대상 보호 Artifact/새 PROPOSED 지식 + 양쪽 감사 + 요청 상태를 함께 확정한다. 그 후 target는 자기 프로젝트의 기존 지식 GET로 복사본을 읽고 별도 내용 검토/확정·헌법 적용을 수행한다. 자동 확정/헌법 적용/임무 전달은 없다.
6. source는 자기 요청의 결과만 조회한다. target 승인자 이름·계정·다른 소유자/멤버 정보는 반환하지 않는다. target에 공개한 출발 지식·UUID·목적·hash는 source가 정확히 승인한 새 공개 범위다.

### 7.2 대상 존재와 metadata 누출

대상 UUID 직접 입력은 존재를 확인하는 기능이 아니다. 게시 저장은 target 프로젝트의 존재/소유자 조회 없이 **불투명 대상 주소**로 기록한다. 존재하지 않거나 타인이 소유한 ID도 source에게 같은 게시 receipt/미확인 대상 표시를 반환한다. 따라서 요청 행의 target 주소에는 존재 확인을 강제하는 target FK를 두지 않는 후보이며, 이 저장/권한 변화도 결정 대상이다.

target 수신함/원문 요청은 인증 → 해당 target 프로젝트 현 OWNER 접근을 먼저 검사한다. 권한 없는 project/request/version은 동일404이며 건수·제목·source UUID/hash도 반환하지 않는다. 자신의 target 프로젝트에서 source가 공개 승인한 수신 metadata를 보는 **새 전용 ACL**이 필요하다. 이를 source 프로젝트 일반 membership이나 source raw GET 권한으로 변환하지 않는다. target의 VIEWER는 이 후보에서 수신 목록/결정을 볼 수 없다.

source가 보는 요청 상태는 접수 사실만인 PUBLISHED_UNCONFIRMED이며 '대상 존재/읽음/수신 완료'가 아니다. 새로고침 때 target 존재/owner를 역조회하지 않는다. 유효한 target OWNER의 결정이 발생한 뒤에만 ACCEPTED/REJECTED라는 동의된 결과가 드러난다. 읽음 추적·push/메일·외부 알림은 이번 범위가 아니다. 존재 여부에 대한 상수시간 보장을 주장하지 않으며, 데이터 조회·에러/응답 경로로 존재를 직접 구별하지 않는 검수가 필요하다.

### 7.3 고정 공개 묶음과 exact DTO 후보

공통 envelope/UUID/VersionRef/canonical hash·본문2MiB·known-secret/Unicode·기존 purpose/reason 상한을 재사용한다. 아래 object에는 추가 키를 허용하지 않는다. 기존 GET가 지원하는 보호 원문만 사용하고 특정 거절된 새 대화 GET는 열지 않는다.

source 전용 **POST /api/v1/projects/:sourceId/knowledge-share-preview**는 읽기 전용·CSRF/origin·source OWNER 검사 후 아래 입력을 받는다. 새 공유 상태/승인·명령/원문 파일은 만들지 않는다.

- 입력={versionRef:VersionRef,targetProjectId:UUID,purpose:string,expiresAt:UTC_ISO}.
- 공개 묶음={sourceProjectId,versionRef,targetProjectId,knowledgeKind,title,purpose,body:{contentHash,bytes,mediaType},expiresAt,recipientRule:{metadata:'CURRENT_TARGET_OWNER_AT_READ',body:'CURRENT_TARGET_OWNER_ON_ACCEPTANCE'}}.
- 응답={disclosure,disclosureHash,bodyText,sourceBasis:{actorId,clientId,controlGeneration,policyRef},warning:'PREVIEW_NOT_PUBLISHED'}.
- disclosureHash는 공개 묶음 canonical hash다. bodyText는 source 사용자만 읽으며 그 바이트/hash가 일치해야 한다. preview 자체로 대상 존재/권한을 확인하지 않는다. 전체원문을 명시 렌더하며 화면 밖 내용을 숨긴 채 승인시키지 않는다.

source PROJECT 명령 **requestKnowledgeShare**:
- targetId=null, expectedVersion=0, baselineRefs=[], approvalRef=null.
- payload={versionRefs:[VersionRef],explicitTargets:[{projectId:UUID}],purpose:string,expiresAt:UTC_ISO,disclosureHash:string}.
- 서버가 미리보기와 동일한 고정 묶음을 보호 원문에서 다시 계산한다. 하나가 바뀌면409이며 재미리보기/사용자 재확인이 필요하다.
- source가 직접 HUMAN 공개 결정을 내리는 **새 도메인 동의 사건**을 저장한다. 기존 FN11 ApprovalRef를 소비하거나 정책 AUTO를 사람의 공개 승인으로 취급하지 않는다. AUTO는 이 명령 사용의 사전 권한일 뿐이며 별도 화면의 공개 확인을 생략하는 자동화가 아니다. 사람의 실제 클릭/이해를 서버가 완벽히 증명한다고 주장하지 않는다.
- 성공 data={status:'KNOWLEDGE_SHARE_PUBLISHED',requestRef,disclosureHash,targetState:'UNCONFIRMED'}. 공개 결정의 주체/client/control·policy/hash·기한을 불변 보관한다. 원문은 기존 보호 artifact의 정확 참조로 묶고 응답/audit/명령 JSON에 복제하지 않는다.

target PROJECT 명령 **decideKnowledgeShare**:
- targetId=shareRequestId, expectedVersion=현재 shareRequestRef.version, baselineRefs=[], approvalRef=null.
- payload={requestRef:VersionRef,disclosureHash:string,decision:'ACCEPT'|'REJECT',reason:string}.
- 현재 target HUMAN/OWNER/client/control·명시 정책 아래, 정확한 수신 metadata를 확인한 그 결정만 수행한다. ACCEPT는 원문 수신을 허용하는 별도 사람의 동의이고 내용 검수는 아니다. REJECT에는 source 원문을 읽거나 복사하지 않는다.
- 성공 data={status:'KNOWLEDGE_SHARE_ACCEPTED'|'KNOWLEDGE_SHARE_REJECTED',requestRef,decisionRef,receivedKnowledgeRef:VersionRef|null}. 기존 자료형의 knowledge sourceRefs에 가짜 DOCUMENT_VERSION/CONVERSATION을 넣지 않는다.

source PROJECT 명령 **withdrawKnowledgeShare**:
- targetId=requestId, expectedVersion=현재 requestRef.version, baselineRefs=[], approvalRef=null.
- payload={requestRef:VersionRef,reason:string}.
- 현재 source OWNER/client/control + 원 게시자 actor + 해당 명령 정책과 요청 CAS를 검사한다. 원지식 개정/만료는 미전달 요청의 철회를 막지 않는다. ACCEPTED 후 철회는 '전달 취소'로 성공시키지 않고409 ALREADY_TRANSFERRED를 반환한다. source 삭제/대상 복사본 회수는 수행하지 않는다.

조회 후보:
- GET /api/v1/projects/:projectId/knowledge-shares?view=OUTGOING|INCOMING&limit&cursor.
  응답={items:{requestRef,state,expiresAt,recordedAt}[],hasMore,nextCursor,observedAt}. OUTGOING은 현재 source OWNER이자 원게시자, INCOMING은 해당 target 현 OWNER만. 목록에는 원문/목적/제목을 넣지 않는다. cursor는 actor/project/view/limit에 결박한다.
- GET /api/v1/projects/:projectId/knowledge-shares/:requestId.
  응답={requestRef,disclosure,storedState,effectiveState,decisionRef:null|VersionRef,receivedKnowledgeRef:null|VersionRef,observedAt}.
  OUTGOING은 원게시자/현재 source OWNER, INCOMING은 해당 target 현재 OWNER·게시상태/기한·source 동의 유효성을 확인한 범위만 disclosure를 반환한다. source 응답의 receivedKnowledgeRef는 항상 null이며 target 내부 새 객체 ID를 공개하지 않는다. target 자신의 수락 결과에서만 대상 지식 ref를 반환한다. 본문·원 sourceRefs·계정·다른 멤버 정보는 없다. 철회/만료/무효화 뒤 target GET는 **새 공개를 하지 않고 값 없는412**로 제한한다. source의 적법한 역사 조회는 보존한다. 목록은 무효 요청 내용을 표시하지 않고 취소/미유효 카운트를 만들지 않는 후보다.
- GET /api/v1/projects/:targetProjectId/knowledge-share-decisions?limit&cursor.
  현재 target OWNER이자 해당 결정을 내린 actor에게만 {items:{requestId,decisionRef,decision:'ACCEPT'|'REJECT',decidedAt,receivedKnowledgeRef:VersionRef|null}[],hasMore,nextCursor,observedAt}를 반환한다. cursor는 actor/targetProject/view/limit에 결박한다. disclosure/원 sourceRefs/목적/제목/본문을 반환하지 않아 원 source 동의 무효화 뒤에도 본인의 결정·수신 ref라는 target 자체 역사를 확인할 수 있다. 권한을 잃은 옛 OWNER/타 작성자에게 행·건수0이다. 실제 수신본문은 target의 기존 knowledge GET 권한·격리 검사를 다시 적용한다.

### 7.4 양쪽 권한과 source 동의 유효성

정책 자동 부여/기존 read 권한 확대는 없다. source의 request/withdraw와 target의 decide는 각자 프로젝트의 정확 연산 정책을 요구한다. source·target 소유자가 달라도 동일 경계를 적용한다. 같은 사람이 양쪽 OWNER여도 원문 공개와 대상 수락은 각 프로젝트의 명시적 두 결정이다.

source 게시 때 고정한 actor/client/controlGeneration·정책 ref·원지식 ref·공개 묶음·source 인증 세션의 기한을 동의 근거로 보존한다. 요청 expiresAt는 source의 현재 인증 세션 절대기한과 허용 정책기한을 넘지 않는 값이어야 하며, 실제 사용 가능 기한은 두 세션/정책·동의 중 가장 이른 만료다. 새로운 24시간·전용 비용/호출 수치를 만들지 않는다. source 세션의 idle 만료/회수도 최종 전달을 막는다.

target ACCEPT는 target의 실제 로그인 주체를 기존 검사에 넣는다. source 검증을 위해 target 주체를 source OWNER로 위장하거나 가짜 AuthenticatedIdentity로 기존 authorizeMaterial을 호출하지 않는다. **서버 저장 source 동의의 현재 유효성 resolver**가 원 게시자의 멤버십/OWNER·원 control세대/client·세션 회수/기한·원 정책 current hash/disposition·원지식 현재 head/확정/비밀 상태를 검증해야 한다. 이 cross-project consent verifier는 현재 미구현인 **새 권한 집행 계약**이다. source 현재 제어가 이동했으면 동의 무효이고 새 게시가 필요하다. 원문은 같은 transaction에서 exact hash로 재검사한다.

기존 ProjectApprovals의 다른 연산용 승인/소비는 두 도메인 결정을 대신하지 않는다. 이 최소안은 별도 일회 도메인 동의·결정/소비를 쓰는 변경 후보다. 정책이 REQUIRE_APPROVAL인 경우 기존 승인 소비 연산에 몰래 추가하지 않고412로 미지원 표시한다. 해당 disposition 지원과 범용 승인 화면 UI08 통합은 별도 exact 계약/후속 범위다. 이 제한 때문에 원 요구를 전체 구현 완료라고 해서는 안 된다.

### 7.5 변경·철회·회수·비밀·이미 전달된 원문

- 게시 전: preview/선택 변경은 미전달이며 상태를 바꾸지 않는다. 게시 후 목적/대상/본문 수정은 금지, 기존 미전달 요청을 철회하고 새 묶음을 사용자에게 다시 보여준 뒤 새 요청을 게시한다.
- 게시 후 원지식의 개정/사용제외/확정 무효화/격리·known-secret 의심 또는 source 권한·제어·정책 회수는 미전달 동의를 무효화한다. target의 새 상세 공개·ACCEPT는412, 어떤 원문도 복사하지 않는다. 이미 보인 metadata의 회수를 보장하지 않는다. target REJECT는 현재 target 권한과 요청 CAS만 검사하고 source 원문/세션의 계속 유효함을 요구하지 않는다.
- 게시 만료/철회·REJECT는 target의 미전달 원문 수신을 막는다. 재생/새 commandId로 되살리지 않는다. source의 적법한 과거 기록·감사는 남긴다. target은 자기가 내린 비밀 없는 decision ref/시각/결정 유형을 별도 자기 이력에서 볼 수 있어야 하지만, 무효 원문의 disclosure를 다시 열지 못한다.
- ACCEPTED 후 대상에는 새 PROPOSED 지식이 이미 존재한다. source 개정/제외/철회가 target 본문을 원격 삭제·덮거나 역사상 미전달로 바꾸지 않는다. 이후 자동 동기화는 없다. source/target가 이미 열어 읽거나 복사한 자료를 회수할 수 없다.
- 사후 known-secret 탐지 시 각 프로젝트의 기존 격리/사용제외·비밀 없는 알림/대응 절차를 따른다. 새 안전 판정을 만들거나 source가 target 자료를 삭제할 권한을 부여하지 않는다. 사용자가 필요한 계정/키 조치를 결정하며 이 공유 기능이 임의 실행하지 않는다.

### 7.6 일회 복사·저장·replay·동시성·실패

- 저장 후보: share request/disclosure의 불변 snapshot, source 동의, target 결정/일회 소비, target 지식 provenance의 별도 불변 연결과 감사. 기존 KnowledgeEntry.sourceRefs union을 바꾸지 않고 provenance를 별도 read-only 필드로 제공하는 **새 응답 계약**이 필요하다. 원 source 보호 원문 참조는 target raw GET 권한이 아니며 응답/감사에 실경로를 넣지 않는다.
- 복사 지식의 exact 구성 후보: 새 target id/version1, kind=공개한 원 kind, title=disclosure.title, contentRef=target 보호 artifact의 새 ref(바이트/hash/mediaType는 공개 body와 동일), sourceRefs=[], reason='프로젝트 공유 수신 · 요청 '+shareRequestId, scope={projectId:targetProjectId,stageRefs:[],taskRefs:[]}, relatedRefs=[]이다. author/createdBy는 실제 target 수락 HUMAN, 상태 PROPOSED/내용검토0/확정0/헌법적용0이다. source actor를 target 작성자로 위장하지 않는다. 기존 지식 ID를 덮지 않는다.
- 별도 provenance의 공개 exact 필드는 {sourceProjectId,sourceKnowledgeRef:VersionRef,shareRequestRef:VersionRef,disclosureHash,decisionRef:VersionRef,receivedAt:UTC_ISO}이며 수신한 target 지식 GET 권한 아래에서만 제공한다. source 제목/계정/actor/client/정책/비밀경로/원 sourceRefs는 이 객체에 추가하지 않는다. sourceProjectId/원 ref/hash는 공개 묶음에 포함돼 source가 승인한 범위다. provenance는 원 source raw GET 권한을 주지 않는다. ACCEPTED 후 target 자체 복사본/이 provenance 조회에 source 세션의 계속 유효함을 요구하지 않는다. target의 현재 지식 조회·격리 정책은 그대로 적용한다.
- 공통 현재 인증·해당 프로젝트의 현재 OWNER/원 명령 작성자·client/control·현재 연산 정책 및 request ID의 자기 권한 확인 → 같은 commandId/requestHash replay → 신규 처리 순서다. 역사 receipt 접근에는 source 동의/세션·지식의 현재 유효성이나 새 disclosure 공개 적격성을 요구하지 않는다. 예컨대 ACCEPT COMMIT/응답유실 후 source 세션이 만료돼도 target의 현재 권한이 남아 있으면 원 status/requestRef/decisionRef/receivedKnowledgeRef만 재확인한다. 본문/disclosure를 재전송하지 않는다. 신규 disclosure GET/신규 ACCEPT에만 source 현재성을 적용한다. 현재 자기 프로젝트 권한을 잃은 주체는 receipt도 보지 못한다. 다른 payload의 같은 ID는409다.
- 신규 request는 현재 source 내용/preview/hash/기한을, 신규 ACCEPT는 위 양쪽 현재 근거/요청 CAS/미소비를, 신규 REJECT는 현재 target 주체·권한/미결 요청 CAS를, 신규 withdraw는 현재 source 게시자·권한/요청 CAS를 각각 검사한다. ACCEPT와 withdraw/REJECT 경쟁은 하나만 terminal 전환한다.
- source/target 제어·정책/원지식·동의/요청을 **project UUID 오름차순의 일관된 잠금 순서**로 잠그고 검사와 복사/소비 사이에 교체되지 않게 한다. source 정정/제외/격리·내용검토/정책·멤버/제어 변경의 기존 writer도 같은 잠금 규약을 따르는지 확인해야 한다. 상호 배제가 보장되지 않으면 이 권한검사는 미연결이며 ACCEPT 성공을 열지 않는다. 그 규약을 맞추려는 변경도 정확 영향 범위를 따로 검토한다. 서버 시각을 final 직전에 다시 확인한다. 같은 DB transaction에서 요청/양쪽 감사/결정·소비·새 지식/artifact 연결을 원자 처리한다. target용 감사에 source actor를 target 사용자로 위장하지 않는다.
- 보호 파일의 새 target blob 생성이 DB transaction 밖이면 승인된 기존 ArtifactStore staging·원문 hash 검사·실패 정리 규칙을 소비해야 한다. DB 실패를 성공 receipt로 만들지 않고, 물리 파일 유실/잔류는 별도 복구 대상으로 기록한다. 동일 request 소비에 UNIQUE를 걸어 retry가 새 target 지식/복사본을 만들지 못하게 한다.
- target 수락 전 존재 FK는 없지만, ACCEPT 저장에는 실제 target membership/현재 제어·지식 FK/command/receipt·source 동의/원자료의 정확 참조를 요구한다. app의 직접 DML/UPDATE/DELETE로 동의·결정·소비·provenance를 조작하지 못하게 guard를 작성·검증해야 한다. 위 설계 문구 자체가 DB 무결성 PASS가 아니다.
- 응답유실은 입력/원 commandId를 보존하고 재확인한다. 4xx가 뒤늦게 와도 앞선 미확인 성공을 없던 일로 만들지 않는다. 감사/저장 실패는 양쪽 DB 쓰기를 rollback하고 실제 artifact 정리 결과를 따로 기록한다. 불변 역사/원지식은 삭제하지 않는다.

### 7.7 필수 검수·결정 경계

1. 서로 다른 source/target OWNER의 source exact preview→공개 확인→target metadata→사람 ACCEPT→새 PROPOSED 지식 exact GET까지 실제 여정을 확인한다. 같은 OWNER의 두 프로젝트도 별도 두 결정이며 자동 승인 0이다.
2. source 승인 전 target 목록/건수·상세0, 수락 전 원문0, 승인된 metadata 외 raw sourceRefs/계정/원문0, target VIEWER/타 프로젝트/직접 ID·cursor 거절0을 확인한다.
3. 없는 target과 다른 소유자의 target에 대해 source 게시 응답의 존재/소유자 노출0과 target DB lookup0을 검증한다. 잘못 입력한 UUID로 다른 유효 프로젝트 소유자에게 공개될 위험을 source 확인 화면에 명시하고 자동 대상 보정을 하지 않는다.
4. source 개정/제외/비밀·source 세션/제어·정책 회수와 target 세션/제어·정책 교체의 전/중간 경쟁, 만료 직전, ACCEPT/withdraw/REJECT 경합·중복/replay, 직접 DML·감사 실패·파일 실패/잔류를 확인한다.
5. 실제 raw 본문 이전과 target provenance/원자료권한의 분리를 검증한다. 과거 수락본 자동삭제/동기화0, 완전 회수·완전 비밀탐지 보장0. 새 데이터의 보호·보존/복구도 검수한다.
6. 현재 이 문서는 후보 검토만 수행했으며 코드/SQL/실제 권한/전송/시험 PASS0이다. 격리 PG/API/브라우저·정식 served/사용자인수는 별도이고 기존 거절/직접 질문·r2 경계를 해제하지 않는다.

**한 번에 판단할 정확한 delta:** (a) 불투명 target UUID에 대한 blind publication과 현재 target OWNER 수신 ACL, (b) 사용자 source 공개동의+target 수락 및 cross-project consent 현재성 검증, (c) 원문을 target PROPOSED 지식으로 일회 복사·별도 provenance/감사/물리 원문 보호, (d) 지원 정책을 AUTO 사전허가+명시 HUMAN 도메인 결정으로 제한하고 기존 범용 ApprovalRef를 미소비하는 최초 범위. 모두 새 공개/자료·권한 의미이므로 PMO 판단 후 필요한 직접 결정만 묻는다. B 전체를 포괄 승인받은 것으로 해석하지 않으며 A를 우회 선행 구현하지 않는다.

