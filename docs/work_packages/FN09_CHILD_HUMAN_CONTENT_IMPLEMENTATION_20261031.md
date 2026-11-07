# FN09 하위 HUMAN 내용검토·확정 r2 A — 구현 WI

상태 MAIN_GO / DIRECT_HUMAN_APPROVED. 승인 FN09_CHILD_HUMAN_CONTENT_SOURCE_DIRECT_APPROVAL_20261031.md SHA E49057622D68AD322766DD8C82659AC4BB3D6B395F1F571FA36A460EF960E602, r2 5880747B61C0D48C5D08F7F01CD8F43D6E6C30101CC73CB85485F623B5B0478D + 원r1 51F71890EDCE8668676A39AFD5A1A76DA71C5BB3FC26A60452F8464B8617BEBB를 따른다. 후보의 이전미채택은이력이며 현재직접승인으로구현한다.

## 목적·범위·역할
같은project의root부모아래한단계child를 HUMAN이내용검토→별도확정→과거원문조회할수있게source/UI/pending SQL·합성검증을연결한다. contentConfirmed는내용사실이며실행·세션/맥락·실위임·권한·예산/writer 허가는아니다. 기존root/null정상흐름·19소비선의root차단·10downstream SQL차단을유지한다.

- 기존Primary단일writer, Main동일code수정0/관리·검수·통합,기존Reviewer읽기. 새agent/chat/branch/worktree/예약0. Main문서/commit/push소유.
- 제품기준 codex/av3-stage-b / eb9590e73e1ed2dcceb34314247016e11b29f89c. 이WI/승인/현황control commit뒤실제HEAD를기록하고시작한다. 보호3/원5복구본·기존원문/SQL/지식·정상기능보존.
- 실제DB/SQL실행·정책/권한부여·키/Secret·사용자파일조사·서비스·Agent/하위실위임/운영/Oracle/main병합·기존project활성화/일반차단해제0. 기존quota/coverage와다른child실행guard는그대로다. 임시QA/listener/실PG/실browser생성0,합성만수행한다.

## 정확10경로
기존제품6:
1. apps/server/modules/access/project-command.ts — EA7E701A0EE77A835BFE9EC885E05A0C182DCCA02C5E0D9189593068A4CDEE0E
2. apps/server/modules/projects/routes.ts — EDC0AE67FDE61BD2383B16E474531BCA93CDF0CFDECCC0C9BB2BBE22C14FC757
3. apps/server/modules/assignments/project-assignment-drafts.ts — B3673F918A99DE432D2655A835786A9EA57ED5AE2EE142BA9902DD310C9D0A44
4. apps/server/modules/assignments/project-assignment-confirmations.ts — A89B344465E99BE69FE39A644064E122DCD376FE967F927A89DA4141AF7F6F64
5. apps/web/src/features/workspace/WorkspaceAssignments.tsx — 102CBD9CCB639499288E83A81CED36C89D19D0F7D41EFB4785723959079C9894
6. apps/web/src/features/workspace/AssignmentContentDecision.tsx — 5FEBE7EC8BD6B13865D8BBDD68B886267B3FE2A401B5C5862EFE815103AEF6D2
신규4:
7. tests/unit/FN09/child-human-content.test.ts
8. tests/unit/UI04/child-human-content.test.ts
9. tests/unit/FN09/child-human-content-schema.test.ts
10. db/migrations/0061_child_assignment_content.sql.pending
Main은0061prefix/새4부재를확인했다. 쓰기직전재확인하고충돌은보고한다. 추가파일/기존시험기대변경이필수면경로·기준/사유·영향을Main에먼저제시한다. 임의전체시험완화·skip·공통화·새dependency·전역CSS·공유parser/원0034수정0.

## Q1 HUMAN 전용 source 소비선
- 기존 confirmations.read()/decision()/drafts.current()와 shared assertAssignmentRoot 및 routes의기존assignmentConfirmations의존주입을root-only로보존한다. HUMAN전용 sibling(currentForContent/readContent/decisionContent 등)을사용해기존내용GET2와내용쓰기만선택한다. 새공개operation/endpoint/table/DTOfield/범용allowChild플래그0.
- currentForContent는기존#parent의root부모/정확head·현재기준·최신ACCEPTED/동일plan·node/environment/budget/recordingPolicy·baseline/능력/정확FILE범위부분집합을소비한다. 부모→child잠금·대기뒤최신재읽기후새검토/새확정각각에검사한다. discovery읽기를권한판정으로쓰지않고잠금뒤child/부모ref·head변화는현재거절로닫는다. 순환/self/손자/reparent·WRITE→READ/경로대소문자새추정0.
- child의현재exact draft/hash에기존HUMAN검토원형/판정/항목·이유·근거·주체·현재policy/command/receipt/audit를보존한다. 별도확정은정확최신ACCEPTED child검토가맞을때만한다. 사용자명시별도확인·기존auth/client/control/세션기한/명시정책을유지하고새child재인증gate·일회승인연결0. REQUIRE+null의공통412/AUTO+nonnull공통422/class도달nonnull412를하나로덮지않는다.
- historical read/decision은불변child원형/원receipt·현재프로젝트보호를검산하되부모새head/현재적합검사를적용하지않는다. 과거내용사실과현재부모적합/실행준비를구분하고root기본reader를HUMANreader로치환하지않는다.

## Q2 두 내용 operation의 좁은 command·replay
- ProjectPolicyRepository에는두내용operation만소비하는sibling(assignmentContentCommand 등)을두어기존handler두곳에서명시선택한다. 기존 command()의다른operation·인증Tx/authorizeMaterial/error감사/반환의미는유지한다. 범용replayhook/공통권한framework·대규모리팩토링0,중복필수공통안전흐름은현재source와대조해검수가능하게구현한다.
- 현재auth/단독제어/현재명시policy·412/422층을먼저소비하고APPLIED면보호된요청의고정draft로child를판정한다. raw result의parent flag·현재childhead만믿지않는다. 분류자료없음/손상/권한거절을root로fallback0. child는정확원command/hash/보관review또는confirmation/receipt/audit·현재접근/동일입력을재검산한뒤원JSON을그대로반환한다. 새부모head/CAS·새latestreview를과거replay에재적용하지않는다.
- root/null정상replay와다른operationreplay는불필요하게강화/약화·변형하지않는다. 신규실패/감사·결과불명/동일명령의미는기존과같다. 원class/provider없으면성공을가정하지않고닫는다. 새일회승인/권한·자동재전송/새명령/현재제어세대자동갱신0.

## Q3 UI04 한정 연결
- WorkspaceAssignments child 내용패널만연결한다. 기존부모/child fullref·sourceverdict·최신child검토를표시하고명시검토저장/별도확정·원형GET/hash검산후성공을표시한다. 원문닫기/빈상태/저장중/거절/UNKNOWN·부모변경/주체·client·제어세대전환·pending/raw입력을구분/보존한다. 임의참조입력/새메뉴/대시보드0.
- child확정후 AssignmentContentDecision의책임자/맥락/실행준비패널과실행상세이동을마운트/호출하지않는다. 단순CSS숨김으로부작용남기지않는다. 기존root버퍼/연결정상은보존한다. staleparent의과거내용조회는허용하고'부모현재성재검사전·실행권한아님'으로표시한다.
- 명령앞뒤현재문맥·client객체/실transport·관측ABA·늦은JSON/nativehash/401·이탈을기존safe패턴으로폐기한다. 현재401만authcallback,상태불명을PASS/빈목록으로바꾸지않고같은command/body명시재확인을유지한다. 새UI framework/공통test추출0·기존Operate/12px/craft-floor읽기·UI2targetdetect. 기존impeccablecontext49c4db는세션1회완료/재init0.

## Q4 pending SQL와보존
- 0034원파일/assignment_root_reference·guard_child_assignment_draft_only의10downstream trigger(agent_sessions/role_bindings/context_bundles/execution_preparations/execution_grants/usage_reservations/executions/execution_commands/writer_claims/delivery_outbox)를보존한다. 신규0061에서review/version내용guard두곳만한정대체하고기존root분기·불변원문·정확parent현재검사·원command/receipt/audit·양방향완결/반쪽거절을검산한다. 새role/GRANT·실제적용/loader변경0.
- 실제기존schema의UUID/text·timestamp·JSON/null/type·키/FK/감사sequence/canonicalhash에대조해정상기록을거절하거나조용히손상을통과시키는분기를피한다. 정적구조단언만으로실SQL문법/trigger/FK/경합PASS주장0. 기존root원문·검토·확정삭제/재작성·down migration0.

## TDD·검수·제출
1. 실제제품producer/원class·same-memory원장으로정상한단계child HUMANreview→별도confirm→fixedGET의의미있는RED→GREEN. 새원문/parent/childref를자가재해시한관계위반·각쓰기직전부모head/review/basis변경·scope확대/타project/손자/부모누락/rolecontext실행0반례.
2. 현재auth/policy/client/control/기한·승인412/422/소비0·child APPLIED원고정증빙/무결성/분류실패/권한회수·과거parentstale후read/replay정상·freshwrite거절·root/null/다른ops회귀를검사한다. rawresult의parentnull변조로분류우회0,원record/receipt/audit0부분반환과원input/command/UNKNOWN보존.
3. 실제UI/기존API/원decoder를소형메모리DOM으로소비해정상child검토/명시확정/과거원문·부모 표시/해시검산·hidden후속패널read/write0·root정상·지연/문맥/원입력/재전송금지를검증한다. 실제browser/native select/PG/배포증거와구분한다.
4. 지정직접인접은assignment-confirmation-input.test.ts/store.test.ts/web.test.ts·assignment-parent.test.ts/parent-original.test.ts·assignment-policy.test.ts를내용확인후필요범위만선정한다. assignment-routes.test.ts 전체는실pg.Pool,assignment-content-qa.test.ts는workflow/spawn이므로실행0. 새메모리route연결시험으로대체해검증범위한계를명시한다. 완료FN02/FN14검사는불변이면반복0.
5. type/noEmit·메모리Web build(write:false/envDir:false)·diffcheck·원0034/sharedparser/보호3/원복구본지문보존. SQL정적검사와실제PG·제약/경합NOT_RUN을분리한다. exact10diff·정확명령exit·REDGREEN/오류횟수·hash/미검증/rollback을제출하고writer반환한다. Mainfresh·독립C/I0후소유파일만기존privatebranch통합·계속계획완료를주도한다. source합격을전체FN09/계획/실위임완료로승격0.
