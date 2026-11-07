# FN10 사람 판단 기록·철회·보호 조회·화면 연결 작업지시서
- 일자: 2026-11-06
- 상태: 상세 실행안 / SOURCE_GO0 — 독립 검토 후 Main이 정확 해시에 GO를 결박한다.
- 상위: WORK_PLAN FN10/UI04, 신산님의 확정 문서 묶음 별도 선택 및 source-only 계속 지시.
- 시작 checkpoint: 5903adfad9bb93880a8ff29fb61f1700637bd5ae.
- 후보: FN10_HUMAN_DECISION_CANDIDATE.md 7DF8D313243A7F98B4A8CC99D2673C41B35811423D4C4DAB8449C82125A5F76E.
- 내부 저장 기술: FN10_NODE_DECISION_STORAGE_INTEGRATION_TECHNICAL_20261106.md E4016AE354EF146B5F49A685C8DA28ADDF463573C5F35B95469810B645E13951.
- 인수된 입력: source6A7221E2/testBC2C83C0, Main46PASS. 그대로 재사용하며 완료 단위를 다시 구현하지 않는다.
- 책임: 기존 Primary 단일 writer, Main 관리·독립 검수·통합. 실제 DB/권한/키/서비스/SDK/Agent 실행은 제외한다.

## 1. 사용자 단위와 제외
Workbench에서 실제 적용본의 USER 역할 HUMAN/DECISION 노드를 고르고, 확정 설계·plan과 근거 문서의 정확 버전·판단값·이유를 선택한다. 명시 기록→재조회→정정→철회→역사 고정 조회를 같은 실제 source/명령/저장/응답/UI로 연결한다. 준비 입력·수신 DTO만 만들고 저장을 완료했다고 하지 않는다.

basis는 같은 record/revoke Tx에서 발급해 불변 decision version 안에 함께 보관한다. 별도 basis 발급 API·전역 pointer·설계 기준 활성화·노드 완료·평가/분기·queue 전이·Agent 실행·자동 정책 부여는 없다. 실제 사용자 자료·artifact 파일/백업 조사도 없다.

## 2. 정확 쓰기 허용목록 — 제품12·시험/fixture7
신규 제품6:
1. apps/server/modules/scheduling/node-decision-sources.ts
2. apps/server/modules/scheduling/node-decision-store.ts
3. apps/server/modules/scheduling/project-node-decisions.ts
4. db/migrations/0080_node_decisions.sql.pending
5. apps/web/src/features/workspace/node-decision-api.ts
6. apps/web/src/features/workspace/NodeDecisionPanel.tsx

기존 제품6:
7. apps/server/modules/access/project-command.ts
8. apps/server/modules/projects/project-storage-quota.ts
9. apps/server/modules/projects/routes.ts
10. apps/web/src/App.tsx
11. apps/web/src/features/workspace/WorkspacePage.tsx
12. apps/web/src/features/connections/policy-editor-profile.ts

신규 시험/fixture7:
13. tests/unit/FN10/node-decision-sources.test.ts
14. tests/unit/FN10/node-decision-store.test.ts
15. tests/unit/FN10/node-decision-routes.test.ts
16. tests/unit/FN10/node-decision-schema.test.ts
17. tests/unit/FN10/node-decision-quota.test.ts
18. tests/unit/UI04/node-decision-flow.test.ts
19. tests/unit/FN10/node-decision-fixture.ts

입력 기존2·기존 migration·control-grant/repository·다른 문서/plan/정책 writer·SessionDetailPage·일반 Web API를 수정하지 않는다. 기존 writer의 project 잠금 재사용으로 닫고 광범위 리팩터링을 하지 않는다. 꼭 필요한 추가 경로/계약 차이는 쓰기 전에 Main에게 근거를 반환하되 영향을 받지 않는 구현을 계속한다. Main 문서·보호3·다른 작업자 변경을 보존한다. commit/push·새 세션/branch/worktree/자동화0이다.

## 3. 명령과 원 데이터
recordNodeDecision/revokeNodeDecision만 원 exact11로 기존 project commands에 연결한다. ordinaryDocumentOperations에는 넣지 않아 현재 OWNER 경계를 유지한다. 원 control/client/credential·DENY 우선·별도 쓰기/읽기 정책·미지원 REQUIRE/approval 거절은 유지하며 실제 사용자 정책을 자동 만들지 않는다.

record payload는 인수된 exact7, revoke는 exact3와 basisSelection exact3를 그대로 쓴다. 선언은 원 보호 application에서 서버가 다시 도출한다. 브라우저 선언/현재성/권한 주장을 신뢰하지 않는다. 외피에 기한 키를 새로 추가하지 않는다.

새 basis snapshot의 exact 원형은 후보 §9.3을 따른다. decision snapshot exact는 다음으로 고정한다.
{schemaVersion:1,purpose:'HUMAN_NODE_DECISION',projectId,nodeRef,declarationHash,basisRef,decisionType:'ENUM_STRING_V1',value,reason,sourceDocumentRefs,previousRef,status,actor,commandId,recordedAt}
actor는 {kind:'HUMAN',userId,clientId,credentialGeneration,controlGeneration}. commandId는 외부 원 request.commandId이며 DB FK의 serverCommandId와 혼동하지 않는다. basis도 같은 외부 commandId·원 actor·원 Tx 시각에 결박한다. ref.id는 stream ID, version은1부터 증가, hash는 위 원 snapshot의 canonical hash다. basisRef/hash·decision hash는 자기 참조 없이 순서대로 계산한다.

revoke는 원 head의 value/sourceDocumentRefs/declaration을 서버가 읽어 보존하고 새 이유·선택 basis·actor·REVOKED 상태의 새 version을 만든다. 과거 이유/값은 원 version에 남긴다. 같은 stream의 application/node는 바뀌지 않는다. ACTIVE→정정 ACTIVE→REVOKED→별도 명시 ACTIVE 재기록을 정확 head CAS로 처리한다.

원 source는 같은 access/db/actor/project의 실제 ProjectMethodologies/ProjectDocuments/ProjectWorkPlans와 실제 ArtifactStore 경계를 소비한다. 선택 AF02·plan·서버 도출 AF04·근거 문서의 정확 hash/목적/확정/최신 적합 검토·현재 head/적용/접근/격리를 검산한다. plan 목록의 DRAFT는 저장형식이므로 currentConfirmationValid와 구분한다. 실제 보호 메서드를 성공 lambda로 대체하지 않는다.

신규 기록의 fresh 검사와 역사 조회를 분리한다. 과거 application은 정확 불변 원행·실제 readApplicationSnapshot helper로 검산할 수 있으며 현재 application을 과거 ref로 꾸미지 않는다. 역사에는 최신 head/새 적용본/새 confirmed pointer 조건을 소급하지 않되 현재 읽기권·원 source 접근/격리·원 저장/감사/해시 관계를 모두 검사한다.

## 4. ID·원 명령·같은 Tx
project-command의 기존 비공개 예약 패턴을 FN10 목적에 한정 확장한다. 원 serverCommandId·operationId·authorizationReceiptId·auditEventId를 reserve 전에 한 번 고정하고 원 요청/주체/연산에 결박된 private capability로만 소비한다. caller가 지정한 내부 ID나 평범한 객체는 받지 않는다.

persistProjectReceipt는 이 목적의 private 예약만 한 번 받아 R.id=commands.id=serverCommandId로 보존한다. 기존 활성화/FN09 분기는 그대로 유지하며 예약을 잘못된 operation/actor/db/요청에서 쓰지 못한다. command와 receipt/audit의 실제 원 컬럼·scope digest/관계를 재사용하고 별도 가짜 영수증을 만들지 않는다.

같은 원 authenticated PoolClient에서 project/member/control/policy 잠금→원 source current→ID 예약/비용 admission/reserve→basis/version/head와 원 receipt/audit→settle 순서를 수행한다. 기존 project 잠금을 먼저 소비해 문서·plan·적용·정책/회원/제어 변경과 직렬화한다. 첫 head 부재도 같은 project 경계에서 처리한다. 새로운 전역 lock나 존재하지 않는 격리 전환 writer를 만들지 않는다.

원 ProjectPolicyRepository의 FN10 목적 branch에서 generic projectReplay가 원문을 먼저 반환하지 않도록 연결한다. exact replay도 현재 읽기/출처 보호와 원 receipt·domain 완결을 검사하고 새 ID/행/감사/예약/비용을 만들지 않는다. 다른 payload 재사용·다른 head CAS는 충돌이며 자동 대체 명령0이다.

## 5. schema·quota
새 pending0080에 node_decision_heads/node_decision_versions와 source 관계·basis 보관·원 request/receipt/audit/R의 exact FK/hash·불변/직접DML 거절·양방향 deferred 완결을 정의한다. 신규 role이 필수라고 가정하지 않고 기존 보호 owner/설치 계약을 재사용한다. 과거 SQL 파일을 수정하거나 pending을 적용하지 않는다.

head 최소열과 불변 version1/previousRef의 before/after 재현, FN10 sealed headProjections·역사 비용 불변·최신 head guard는 E4016AE3의 식을 구현한다. 과거 완결을 현재 head로 재계산하지 않는다. version 행의 cursor tie-break에는 실제 고유 serverCommandId를 사용할 수 있으며 ref.id=stream ID와 구분한다.

NODE_DECISION 내부 목적·정확 원 plan/part·M/B/R 자기비용 고정점·U/H/O·기존10GiB·coverage와 actual/held 일치를 구현한다. 실제 복제되는 basis/result/receipt/audit·R projection은 실제대로 세고 원문 body를 중복 계상하지 않는다. 기존 FN09 목적/소계로 위장하거나 새 actual 소계를 중복 더하지 않는다. 음수 head 차분을0으로 고치지 않는다.

FN10 reserve/settle RPC2만 앱 진입으로 한정하고 private helper EXECUTE는 닫는 미적용 SQL을 작성한다. 기존 quota_plan_valid/quota_settled_complete·목적 CHECK를 forward에서 목적 한정 확장하고 다른 목적은 기존 검산에 위임한다. 공개 quota current/reserve/start는 FN10 내부 목적을 계속 거절한다. 실제 GRANT/권한 실행0이다.

같은 db/query/actor/txid·원 요청과 ID·lease·최단기한·IO_STARTED→SETTLED CAS를 검사한다. 기존 account 분모/상한/producer를 줄이지 않는다. 새 cap·유료 정책·알림/승인소비0이다. schema literal/hash 결박이 기존 runtime guard에 필요하면 새0080 원문과 정확히 결박하고 옛0077 proof를 위장하지 않는다.

## 6. 저장 뒤 보호와 불명
원 COMMIT tag/release 확정 전에는 성공 반환이나 후행 보호 조회로 진행하지 않는다. 같은 repository·원 token으로 새 authenticated 보호 조회를 하며 원 actor/client/credential/Session·원 요청/저장 refs를 private 문맥으로 비교한다. 앞 Tx와 같은 PoolClient를 요구하지 않는다. 이 private 반환 문맥은 caller result나 boolean으로 위조할 수 없어야 한다.

현재 OWNER/member·readNodeDecisions 정책과 반환의 설계/AF04/근거 전체 보호·domain/receipt/audit/hash 관계를 최종 검사한다. 역사 replay에 현재 controller/head CAS를 소급하지 않는다. 후행 조회도 COMMIT/release까지 성공해야 원 결과를 반환한다. 보호 거절이면 원 version/receipt는 유지하고 본문 전체를 숨긴다.

원 call/Session/policy 예산의 최소값을 모든 await 뒤 재검산하고 취소/timeout/늦은 결과를 성공시키지 않는다. 내부 미정착 query/Pool 점유의 정리와 외부 응답 정착은 구분한다. 기한을 연장하거나 즉시 회수를 주장하지 않는다. 마지막 관측과 HTTP 마지막 byte까지의 원자적 권한 회수를 보장하지 않는다.

명확한 전송 전 거절, POST 불명, receipt 후 GET 실패를 구분한다. COMMIT/정산/후행 보호가 불명이어도 자동 새 명령·예약·보상삭제/철회0이다. DB 오류/원문/비밀을 오류 메시지에 반사하지 않는다.

## 7. 공개 읽기·응답 exact
GET2를 다음으로 고정한다.
1. /api/v1/projects/:projectId/node-decisions
   필수 query applicationId/applicationVersion/applicationHash/nodeId, 선택 cursor/limit(1~50,기본50). 다른 키는 거절.
2. /api/v1/projects/:projectId/node-decisions/:id/versions/:version
   id는stream ID·version은정규양의안전정수. 임의 query0.

application fullref와 node를 고정하며 과거 application도 역사 조회할 수 있다. 목록은 recordedAt·고유 원 serverCommandId로 결정적으로 정렬한다. 같은 stream/ref.id와 같은 시각이 겹쳐도 version 누락/중복이 없어야 한다. cursor Position.at/id는 이 실제 순서값에 대응한다.

기존 ProjectListCodec을 새 목적 서명 prefix와 내부 filter hash로 재사용한다. 내부 filter.query에 project/application/node·현재 client/credential/Session 범위를 canonical로 결박하고 actorId·limit·만료 검산을 유지한다. 기존 codec/일반 filter를 수정하지 않으며 cursor에 값/이유/원문을 넣지 않는다.

고정 조회 view exact:
{projectId,ref,snapshot,basisRef,basisSnapshot,headRef,historyVerification:'STORED_DECISION_VERIFIED',humanDecisionRecorded:true,completionAccepted:false,runtimeStateVerified:false,automaticTransitionPerformed:false,executionAuthorized:false,dispatchPerformed:false}
headRef는같은stream의보관head일뿐현재적용/실행권위가아니다.
목록 exact:
{projectId,selection:{applicationRef,nodeId},items:위view[],nextCursor}
총계/VIEWER메타데이터0. 한도는최대50이며기존응답byte한도에맞춰더적게반환할때도cursor는마지막실제반환행에결박한다. 빈결과/다음쪽/같은시각case를검산한다.

POST의기존공통result/operationId/commandId/status/APPLIED/시간형식은유지한다. data exact는기존ref에snapshot/basisRef/basisSnapshot/humanDecisionRecorded와위false flags를추가한것이다. 동적headRef를과거receipt에새로덮어쓰지않는다. 같은명령replay는원result를보존한다. APPLIED는판단저장사실이며작업완료가아니다.

교차project/존재는404·현재접근상실403·옛제어/버전/선택불일치409·선언미지원/미연결412·형상422를기존기준과맞춘다. POST후 DECISION_READ_UNAVAILABLE/DECISION_PROTECTION_NOT_CONNECTED는미저장증거가아니며receipt 존재/내용을오류에싣지않는다.

## 8. UI04 실제 연결
Panel은Workbench의선택단계아래에둔다. selectedStage.applicationId와현재fullref가맞을때기존 readWorkspaceMethodology로같은원graph를보호재조회하고실제kind/role확인뒤표시한다. 이름만보고HUMAN이라고추정하지않는다. 확정Agent임무·실행준비·SessionDetailPage를선행으로추가하지않는다.

props는 client/projectId/session/applicationRef/nodeId/participation/controlState/storage/onAuthenticationLost를기본으로하며App이buffers와CAS를소유한다. user/client/CSRF·project/application/node·control·transport·선택refs가바뀌면옛원문과늦은응답을숨긴다. UNKNOWN원명령은원문맥key에보존하고새선택에재귀속/자동삭제하지않는다.

기존문서목록→고정조회→pinned form의AF02확인, 기존plan목록→고정조회/confirmation결과로실제확정자료를선택한다. plan목록DRAFT표시만으로미확정이라고거절하지않는다. sourceDocumentRefs도실제보호조회자료에서선택하며freeform UUID/path 입력을정상흐름으로두지않는다.

서버input는Node전용이므로Webruntime에import하지않는다. 기존wireHash/browserCanonical을소비하는미리보기제한추출을신규API에두고동일fixture/hash를서버와대조한다. C1·Cf·정렬/무변형·32/200B기준을그대로유지한다. 미리보기는권한/current가아니며서버재검산을생략하지않는다.

기존정책편집기에3연산선택지만추가하며자동허용/정책생성0이다. 현재control/정책부재는명확한사용자상태로표시한다. 스타일은기존12px/공통class·보조i를사용하고새Dashboard/화면개편을하지않는다.

POST전실패와POST후불명을분리한다. POST후검산된receipt없음/보호실패는원명령/body/ID를유지한다. 일반4xx를모두미저장으로처리하지않는다. 검산된receipt를GET보다먼저보존하고GET실패에는원ref로만재조회한다. 중복POST/새basis/새명령자동발행0이다.

## 9. TDD·검증
실제보호클래스·공통command/receipt/quota경계를메모리SQL/ArtifactStore모델로소비한다. protected 성공메서드대역·current=true lambda·원guard완화는없다. 실제사용자파일/DB/계정/키/서비스를만들지않는다.

필수정상: 실제문서/plan검토·확정/application원행→UI선택→record v1→정정v2→철회v3→별도v4→목록/고정조회·replay0. 별도basis요청/활성화/Agent0.

중요음성:
- 권한/회원/control/Session·정확ref/hash/양식/최신검토/격리·교차project·신규와역사조건차이.
- 원예약ID/Tx/query/actor·다른purpose·receipt/audit/R 누락/위조·headCAS·완결·직접DML.
- v3뒤v1/v2 비용불변·전체Δ=head·version자릿수/시각동일·before/after/previous/version1/실제head만변조·coverage/U/H/O/상한/고정점자기비용.
- COMMIT불명/후행auth거절·queryHOLD/취소/기한/역행clock/늦은결과·내부점유/반환원문0.
- Panel/App/API의선택ABA·transport/client전환·POST전거절/POST후보호거절·receipt뒤GET실패/추가POST0·서버/브라우저declarationhash동일.
- 목록cursor의다른user/client/app/node/limit·만료/변조/동시각·추가query·50/byte경계.

신규시험과직접영향을받는기존command/receipt/replay·quota·doc/plan/application·Workspace/graph의필요인접만선택하고typecheck/build/diff를확인한다. 불변bootstrap/profile·전체회귀를반복하지않는다. pending SQL형상/권한정의검사는실제PG/GRANT/trigger/경합PASS가아니다.

## 10. 제출·인수
안정된소스는부분동결/지문으로독립검토하고작성중시험은Main이읽지않는다. 기존Primary가정확19경로·시작/끝HEAD/rawhash·실제RED/준비오류·명령/exit/fail/skip·미검증·live/pending0을제출하고writer를반환한다. 실제차이없는완료파일은다시고치지않는다.

Main은독립C/I0와fresh직접검증뒤정확소유파일만localcheckpoint한다. source-only 구현을실제DB적용·served/브라우저/사용자인수·전체FN10/계획완료로승격하지않는다. rollback은이번소유변경의정상revert이며실제환경복구0이다.
