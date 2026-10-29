# FN16 본인 소비 초안의 내부 조합 연결 WI — 2026-10-29

상태: r2 사전검수/코드GO전. 기준 codex/av3-stage-b 46cea72f88abfa83f7fd23471824052db8376faa. 계획 FN16 source-only 승인 안의 한정 연결이다. Main 관리·검수·통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기다.

## 1. 정확 허용4코드·수정 이유

- apps/server/modules/backups/project-inventory-composition.ts (원SHA C27123E4DC6C8D61ABCC413EC97B33AD358DFF6DD2BF3963313C39930CCC5EAF): 실제 collectProjectCreationDraftInventory만 24번째 고정 profile로 추가.
- tests/unit/FN16/project-inventory-composition.test.ts: 기존23 단언 보존·신규 실제 수집/metadata/guard/합집합·음성 반례.
- tests/unit/FN16/project-inventory-composition-schema.test.ts: 고정24 import/명시profile·원경계 정적 검수.
- tests/unit/FN16/project-inventory-artifact-verification.test.ts: 직접 소비자의 신규 빈 본인초안 query fixture/실제 refs 소비에 꼭 필요한 정합 보완만. 필요없으면 미변경으로 남긴다.

다른 collector/helper/원문검증 제품·SQL·route/API/정책·보호8·새 일반도구·문서/Git 수행자쓰기0. Main만 WI/결과/계획/현황을 기록한다. 실제 원문IO/DB/키/서비스/Agent/등록/백업실행0이며 합성만 한다.

## 2. 정확 원결과 profile·권위

본인초안 원source A695586AE98A48A0693D316F61B31D6395BAE509BAE551720F4FCD0D57FC800D는 standalone(access,token,value,signal)이고 instanceof 요구가 없다. 기존 guarded.authenticated(token,null,…)와 현재 동일세션/최소기한/OWNER 경계를 유지하여 실제 함수를 호출한다. 반환을 공급자callback/성공boolean/주입proof로 바꾸지 않는다.

정확 원hash9필드는 kind,projectId,drafts,selections,adoptions,artifacts,evidence,issues,externalDependencies 이며 inventoryHash로 대조한다. kind PROJECT_CREATION_DRAFT_INVENTORY_V1·scope OWN_CONSUMED_PROJECT_DRAFT_SELECTED_ADOPTIONS_ONLY와 false/NOT_STORED/NOT_COLLECTED/NOT_PERFORMED의 실제 선언을 검수·보존한다. 본인 소유이며 이 프로젝트에 소비된 초안/선택된 첨부 귀속만 수집한 범위다. 다른creator·다른프로젝트/미소비/미선택·전체초안은 포함하지 않는다.

이 결과에는 observation 객체가 없다. 새 profile만 정확히 명시적으로 구분하여 component.observation=null 및 관측객체 미반출을 표시한다. RR/동일snapshot 값을 가짜로 붙이지 않는다. 기존23의 observation.isolation/readOnly/snapshot 검사는 그대로 유지하고 관측요건을 전체에 완화하지 않는다. 원DTO에 신규 observation을 추가하거나 reader를 고치지 않는다.

가짜 draft VersionRef/provider/namespace를 만들지 않는다. 새 component는 실제 resultDigest/원9필드hash·rowCounts·제한선언을 보존한다. 기존23 field/hash/profile·참조/의존관계·오류마스킹·관측 의미를 바꾸지 않는다.

## 3. artifacts·한도·미완료

새 artifacts[].ref만 원 addArtifact 경로로 합집합에 넣는다. 기존문서/대화 등과 동일ID·tuple이면1개/출처추가, bytes/hash/mediaType 상충은 전체503, unique fileCount·선언inputBytes 초과는413이다. READY/검사표식은 metadata일뿐 실제bytes/비밀무노출 PASS가 아니며 blobVerification NOT_PERFORMED를 유지한다. 실제 반복byte 누적을 이 선언 합계와 혼동하지 않는다.

metadata 사용량·총기한·최소세션기한·동일session/owner start/end·취소/실패 회수와 비밀 없는 오류를 유지한다. 원profile의 미반출관측 예외로 빈결과/일부실패를 합격시키지 않는다. combined PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS 미수집 umbrella는 제거하지 않고 수집한 본인소비부분만 표시한다. atomicSnapshotVerified/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false와 나머지미수집 유지.

보호참조A의23미연결 채택경계·기능초안/검토채택의 실제instance+CSRF/반복bytes별도계약·FN15실factory부재·미채택158E10BC는 이번에 건드리지 않는다. 새proxy cast/instanceof우회·enabled/migration gate·공개쓰기/설정활성화0이다.

## 4. RED→GREEN·제출

24번째 실제본인초안 부재를 먼저 RED로 확인한다. 실제 원수집기와 명시query fixtures/원 command·receipt·선택/귀속 검산을 거치는 정상/빈본인자료·타creator/타project/미소비배제·tuple충돌/중복/수량·bytes한도·원hash대조·observation미반출·기존23관측/미수집false 보존·마지막guard 취소/기한/권한상실을 확인한다. 모든미지원query를[]로반환하는fixture 완화0, 명시 신규빈표 지원만 허용한다.

고정23→24에 따른 예상count/마지막boundary 횟수는 실제신규호출 차이로 계산하고, 기존취소조건을 삭제하거나검사를느슨하게하지 않는다. 직접소비 verifyProjectInventoryArtifacts도 실제현재보호를통과하고 신규artifact를누락하지않는지 확인한다. 제품consumer가고정길이를요구하지않으면수정하지않는다.

검증은 지정composition 행동/schema·직접 project-inventory-artifact-verification 행동/schema와 원 project-creation-draft-inventory 행동/schema의 필요한회귀만, type/diff·독립C0/I0·Main집중검증이다. 전체23하위·지난기준선48/58/201을중복전수실행하지않는다. 원문포트는메모리합성, 실제PG/SQL/FS/키서비스/Agent/브라우저/백업복원/사용자인수미실행을명시한다. 정확변경파일/hash·RED/GREEN/실패·미검증을제출후writer해제하고,Main이정확allowlist만같은branch게시한다.
r2 Main 내부 검수 보완(부모WI9C14328F): 원 own-draft는 inspectionStatus UNKNOWN/SUSPECTED를 정상metadata로 보존하지만 원issues에는 표식을 만들지 않는다. 신규profile에서 NO_KNOWN_MARKER가 아닌 정확 열거 상태를 ref 결박 ARTIFACT_INSPECTION_UNKNOWN 파생issue로 조합에 보존한다. 이를 원source가발급한issue/원9필드hash의일부라고주장하지않고 원collector/hash·consumer/helper는변경하지않는다. 뒤 현재검사가NO_KNOWN으로바뀌어도 최초차단이유를지우지않으며 다른자료와공유된동일artifact도원문IO0 반례로검사한다. unknown상태를안전PASS로바꾸거나재검사로기존의심을해제하지않는다. NOT_STORED 선언도신규profile에만명시보존하고기존23 whitelist 의미를확대하지않는다.