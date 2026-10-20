# FN05 공유 요청 보관·조회 최소 계약 후보

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

**권장: A만 먼저 채택 여부 결정.** UI 명칭은 '공유 요청 초안 · 나만 보관'이다. PENDING/DELIVERED/APPROVED/SHARED 같은 대상 수신을 암시하는 상태는 쓰지 않는다. B·공통스코프·외부 서비스·실제 복사/전달은 이번 후보의 구현 범위가 아니다. 이 권장은 신산님/PMO 결정 전 제품 기준이 아니다.

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
| B의 전달/대상 승인 | **미채택**. source 공개 허가/정확 metadata payload부터 별도 정의 필요 | 양쪽 OWNER/current client/control·정책을 각각 검사할 계획이나 승인자·전달범위는 아직 미결정 |

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

**필요 결정:** A를 별도의 사적 공유 초안으로 제품에 채택할지, 또는 요청 자체를 B의 source 공개승인/target 수락과 한 업무로 구현할지. A 채택 시 20 refs/20 targets/24시간·source OWNER+본인 조회·AUTO만 허용 경계를 함께 결정한다. 대표 명세의 requestKnowledgeShare를 사적 초안으로 구체화하는 의미 변화는 명시적으로 검토해야 한다. 결정 전 라우트/SQL/권한/TDD 제품구현0, 기존 direct 질문/거절·FN06 r2는 해제되지 않는다.

