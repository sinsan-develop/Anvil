# FN09 이해검토 일회 승인 연결 source 구현 WI — 2026-10-30

## 근거·담당·시작
- 직접 승인 docs/approvals/FN09_UNDERSTANDING_REVIEW_SOURCE_DIRECT_APPROVAL_20261030.json SHA256 B7E7AE96EFD2E5CE1377D351FF56F1F5DDF346A8DD7A19A1238A9785B785FFAB.
- 채택 결정안 docs/work_packages/FN09_UNDERSTANDING_REVIEW_APPROVAL_DECISION_PACKET_20261030.md r1 SHA256 6DA65EB62DCDF0BD08079F4F89513370AF77FECD5FE83B4ED331B03D554D2578 전체가 기준이다. DRAFT는 작성당시 이력이며 현재 직접승인이 우선한다.
- WORK_PLAN FN09/FN11/UI05/UI08의 이해검토 REQUIRE_APPROVAL 미연결 구현. 전체 기능/Stage/계획 인수 아님. 시작 HEADe87a6ebe85d4a85c8dc085ff1ed86dec48a16efc, 기존 codex/av3-stage-b·Main WORK_STATUS dirty·보호 untracked8 보존.
- 기존 Primary 단일 code writer, 기존 Reviewer 읽기검수, Main 문서·관리·검수·통합. Primary commit/push/문서쓰기0, Main 활성writer 코드수정0. 새세션/branch/자동화0.

## 정확 코드·시험 allowlist18
기존10/시작SHA256(Main96e753·37c1fd 확인):
|경로|SHA256|
|---|---|
|apps/server/modules/access/project-command.ts|5A49F4AB8A131198FB3CAD8004981AFBBAB39C7241997D9A78053AD10C703AA3|
|apps/server/modules/approvals/approval-input.ts|F8B1CAF1CF21EC6D69673F2C6EEAAA3ED7C202ADF70634663B89647E18EAFF72|
|apps/server/modules/approvals/project-approvals.ts|B6A8CF7432A66E6EDC513FA3547A721605E5088FAB4DD41FB24EFCCE826F9CE2|
|apps/server/modules/executions/execution-understanding.ts|FDF63998F1A6B16C1CE9A9C921AAC5D43553726A697B78866BC196FB7E9CE03D|
|apps/server/modules/executions/execution-understanding-store.ts|44D0672A19E24B4098AB49DBA63C2246D3EBA65001BF36B38F8502D320882DF8|
|apps/web/src/features/session-detail/understanding-review-write.ts|F43343ABC147137E5A8916D44570DCD98C2F69C81BAA1477981E529B3C18DCB5|
|apps/web/src/features/session-detail/understanding-history-api.ts|CB980B39AED56170716DDBABDEB275A4FBFDCB8D6A14BADCA91F04EF82D13902|
|apps/web/src/features/session-detail/UnderstandingReviewEditor.tsx|9A77BD1E3C3B2F523E8343FD6767EF295288386F8863C304A3180405E0C1BCBC|
|apps/web/src/features/decisions/api.ts|1E48AB49B0BE40F52404FCD8323E4C8A38A34C569DD39EF0878DDC3364DBC8BC|
|apps/web/src/features/decisions/ApprovalsPage.tsx|06AC5CCC3815A04891331AA7BFC04094CA8B75C746CF9677DF414802CD708B8F|
신규8/Main부재 확인:
- apps/server/modules/approvals/understanding-review-approval-candidate.ts
- apps/web/src/features/decisions/understanding-review-approval-api.ts
- db/migrations/0056_understanding_review_one_time_approval.sql.pending
- tests/unit/FN09/understanding-review-approval.test.ts
- tests/unit/UI05/understanding-review-approval.test.ts
- tests/unit/UI08/understanding-review-approval-api.test.ts
- tests/browser/UI08/understanding-review-approval-dom.test.ts
- tests/browser/UI08/understanding-review-approval-dom-harness.tsx
기존 routes/적용SQL/공통runtime·생성schema·recovery helper는 수정0. 추가필수파일은 exact소비선/이유를Main에 먼저 보고한다. 현재recovery는 prepareUnderstandingReview 위임을 보존하고 기존시험으로 검증한다.

## 완료할 동작·계약
1. 원 reviewUnderstanding ProjectCommand(null approvalRef)의11필드 전체와 payload6필드(bundleRef/responseRef/subjectBindingRef/criteriaVersion1/items6/reason)를 불변후보로 보관한다. 원targetId=executionId/expectedVersion=양수executionGeneration,baselineRefs=[]를 유지한다. 6코드·source/responsePart refs·판단/이유와기존비밀거절/2MiB를동일하게검사한다.
2. requestApproval.payload는 details와 candidatePayload를 사용하며 이 연산 candidatePayload는 전체 원 ProjectCommand다. ActionScope.payloadHash는 그 원명령 payload의hash, 후보전체원명령hash/원 requestApproval.request_hash와구분한다. 원승인요청hash는전체후보를포함하며 후보자체재봉인만으로 원형권위를 만들지 않는다. 요청/후보는같은transaction, 기존 GET /approvals/:id의 candidateUnderstanding 반환을보호검산한다. 신규route0.
3. 이연산만 ActionScope.targetRef=null은 실행원형hash 미보유이며 expectedVersion은양수generation. 고유candidateCommandId→불변원command의실행tuple→원요청payload/hash 간접결박. generic targetRef.id 비교예외도정확이연산만이며 candidate/원요청/주체/commandId/client/control/tuple/hash를모든경계에서대조한다. 가짜실행hash/새전역target필드0·다른연산null/0의미불변.
4. 승인전null원command와승인후실approvalRef원command hash를분리한다. 소비시승인ref만정확추가되고나머지는전체동일함을확인한다. 다른명령/실행/세대/client/control/후보/만료/회수/재사용거절·DENY/현재정책/예산미확인유지. requestApproval의대상정책검사도보관원candidate를검증한정확연산scope를사용하고단순요청targetnull/0을실행tuple로오인하지않는다.
5. 기존 HUMAN인증/단독제어/명시정책·replay·전후currentBinding/현재source·수신/6기준·기한검사를유지한동일transaction에서일회소비/receipt/audit→understanding_reviews append. 실제응답/실행producer없으면승인으로우회0. SYNTHETIC_ONLY·executionAuthorized=false/dispatchPerformed=false를보존하며실제WORK/Agent dispatch·자동판정0.
6. 원history parser와 PG 보호조회는NULL AUTO/approved 원형을별도정확검산한다. 기존JOIN의approval NULL조건을그냥지워연결누락행을숨기지않는다. 신규0056미적용SQL은기존적용guard/0055wrapper 의미를보존하면서후보↔요청·결정↔소비↔원명령/receipt/audit↔검토/sequence·previousRef/currentBinding 최종양방향완결·불변성을보호한다. 소비시review행미존재와최종COMMIT완결을분리한즉시/deferred검사. AUTO승인없음보존·미적용SQL source검사만/실DB원자성PASS주장0.
7. UI08에원실행ID/generation/hash미보유·6판단/모든근거/이유·원command/hash를표시한다. UI05입력/불명명령보존·승인요청→별도UI08결정→같은원명령에만결박·명시재개→고정이력재조회/replay를연결한다. 편집후다른명령에옛승인재사용0·자동전송0. user/client/control/fullcandidate·sameclientABA·latejson/실제digest반환지연·403에옛본문즉시숨김. 브라우저에Node Buffer/crypto함수를반출하거나polyfill추가0.

## TDD·검수 순서
- 최초RED로실제차단과신규후보부재를구분·실행한다. 서버 actual class/공유메모리transaction,ApiClient/실DOM합성transport로정상원요청→보호GET→별도결정→소비→history/replay와AUTO쌍을검증한다.
- 후보정합재봉인/원requestApprovalhash불일치·targetID/gen/client/control/원payload/원commandId변경·임의approvalRef/만료/회수/DENY·전후current변경/수신누락/6기준근거불일치/부분실패/미완결양방향·SQL NULL/잘못type 반례를포함한다. 원명령두hash의잘못된replay허용/선제차단둘다확인.
- UI05/08전체후보/실행tuple표시·동일불명원command보존·명시resume·다른편집승인차단·403/주체전환/ABA·lateJSON/실digest·저장후재조회실패와후속재확인/nonGET자동0을실DOM에서확인. 실제부모어디까지렌더했는지정확히명시.
- 신규unit3/DOM와직접인접기존understanding/recovery/history/store/FN11승인/FN09준비승인/decoder만실제존재경로로선정. npm run build(내부typecheck)·git diff --check·변경전적용SQL불변. 같은검사불필요반복/기대값완화0.
- Primary정확명령/exit·diff/18hash·오류/미검증/QA회수제출·writer해제→독립C/I→같은Primary보완→Mainfresh검증·정확잔여0→Main기존branch checkpoint/private게시. Stage실gate미달PR/main병합0.

## QA 사전등록·제외·복구
- 신규 D:/tmp/anvil-v3-stage-b/fn09-understanding-approval-20261030-01, 담당 기존Primary/Main순차. Main37c1fd 부재확인. 매실행직전신규빈경로/부모realpath·link·owner/부재재확인. 목적Vite메모리bundle·실Edge/메모리API,server listener/port·DB·Agent0. 매실행최대30분.
- 전체setup outertry/finally·환경변수원복·정확context/browser회수·소유marker/link/realpath확인후자기자원만정리·별도잔여0. launch시도전종료미확정표시,launch/close불명은강제kill/삭제0·실패/보존/보고. 물리불명경계미실행은NOT_RUN.
- 실제DB접속/적용/GRANT·정책/계정/키/Secret/인증서·서비스/Agent/Job·비용·Oracle/운영0. 실제응답·OS공급자/실제 baseline전환0. FN06 HUMAN R2 채택0. DB/BEGIN·COMMIT/RLS/경합·실HTTP/served·사용자인수는미검증. 승인된미적용0056만작성한다.
- 동일근본원인3회는같은시도중단/Main보고·추측경로/ACL변경/안전심사우회0. Main은WORK_STATUS/PLAN에단계/담당/변경/시험/오류/미검증/다음을기록한다. rollback은한정18경로Gitrevert,실제DB/runtime변경없음. 보호8·기존dirty·과거실패보존.
