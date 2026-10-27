# FN05 지식 공유요청 A안 구현 작업지시서

> subagent-driven-development와 TDD를 적용한다. 구현은 fn05_share_request_impl 한 명, Main은 관리·검수·통합한다.

목표: 고정 지식 버전·명시 프로젝트 대상·목적의 요청을 출발측에 보관하고 본인이 보호 목록/고정 상세를 재조회한다. 요청 보관은 실제 공유가 아니다.

기준: 승인된 후보 docs/contracts/FN05_KNOWLEDGE_SHARE_REQUEST_CANDIDATE.md SHA F60EEE63D28E65949B41BEA1F67D5B70F61767F84141E67A9F1CCBAC8A226B47. 직접승인 call_84af3084e4294486a1514f370614dbb3/item0 ‘A안 계약·source-only 구현 승인’, 기록 FN05_KNOWLEDGE_SHARE_REQUEST_SOURCE_20261028.json SHA FD0A5A0B961CE4638E91436D47F64F8D77AABE3DD1DD79C2094EDC8555B65377. 작업계획 Stage B FN05/UI10의 부분업무이며 전체완료가 아니다.

## 시작·소유권

기존 codex/av3-stage-b / 제품기준9bebd8c0. Main소유 승인·이WI·manifest·현황 문서 변화와 제품 변화를 분리한다. 정확17허용파일/기존4raw·신규13부재 및 보호12는 동명 SOURCE_MANIFEST.json을 따른다. 다른 source·기존SQL/knowledge.ts/guard·정책편집기·dependency·설정·보호untracked8 변경0. 새branch/worktree/commit/push는 구현자가 하지 않는다. Main이검수후일반checkpoint게시한다. Git sandbox 오류는 환경경계이며 ACL/config수정이나 우회·반복0; 필요elevated 고정git -C와 login:false만 쓴다.

## 계약을 구체화한 Main 판단

- 저장 RECORDED_ONLY/version1 불변, 현재검사 METADATA_ELIGIBLE/UNAVAILABLE는 동적 투영. 입력 versionRefs/explicitTargets/purpose만, 배열1..200·목적비공백20000 UTF16/공통본문2MiB, 중복/자기대상/commonScopeId/extra key 거절. 현재head PROPOSED/CONFIRMED만 허용하고 미확정을 승격하지 않는다.
- source OWNER/currentclient/control·명시 유효AUTO 정책과 실제 source bytes/hash/격리/민감검사를 재사용. target READ_PROJECT는 기존 ProjectsRepository의 실제 활성회원 읽기 의미이며 새 role/권한문자열을 만들지 않는다. 동일transaction에서 활성회원/미회수·project.version/보관상태를 실제조회하고 callerflag를믿지않는다. target 쓰기0. 승인ref nonnull 또는 REQUIRE_APPROVAL은 inspectPending 포함 generic ProjectApprovals.authorize/consume보다 앞서 KNOWLEDGE_SHARE_APPROVAL_NOT_CONNECTED 412. 새승인생성0.
- source/target UUID 정렬 잠금→controller→policy→head/원문 순서를 기존호출과 대조한다. 저장직전 인증/세션·정책기한·현재source/target/원문을재확인한다. 불명/기한/경합/오류는 전체rollback. 기존txn/세션검사를우회하지않는다. readonly경로에도출발접근·createdBy=본인선필터, 현재source/target대조실패시는 최소ref/state/일반불가코드/false효과만. 목록/직접ID/cursor·다른actor·late응답에서목적/target이름/건수·원문을노출하지않는다.
- requestKnowledgeShare 공통명령·exact해시/receipt/audit append-only와 새0051 pending모델을 연결한다. 같은명령재확인도과거상세result_ref를그대로재생하지말고현재보호투영,다른payload충돌. 저장/목록/고정상세에모두 integrity/hash 및 receipt귀속검사. 새table RLS/guard/불변/원자receipt결박은pending안에서만 정의하고 기존SQL/적용manifest를변경하지않는다. 실제SQL compile/DML/RLS실행은NOT_RUN.
- GET /api/v1/projects/:projectId/knowledge-share-requests 및 /api/v1/projects/:projectId/knowledge-share-requests/:id/versions/1?contentHash=… 로 명시연결한다. 기존 relative same-origin helper를 사용한다. cursor는서명 namespace/actor/project/filter/limit 결박. wire validator는닫힌키·hash·ref·정확target/범위·효과false를검사한다.
- UI10 기존 지식상세/허가프로젝트선택→목적입력→명시요청보관→본인목록/고정조회. 현재project/session/client/control/선택ref 문맥이바뀌면late응답을버리고pending/uncertain원명령을덮지않는다. 응답유실은원명령명시재확인,입력수정/취소로불명명령소실금지. POST실패를공유성공으로보이지않게한다. 간결한한국어 UI·기존화면표준·미지원common을준수한다.

## 절대 제외

실제 원문복사/전송·대상쓰기·SHARED사건·수신알림·승인생성/소비·실제DB적용/정책부여/GRANT실행·서비스/Secret·실Agent/비용·P03실복사0. 새native/compiler/PG/컨테이너·네트워크·volume·포트0. 승인문서를현재도구실효과허가로확대하지않는다.

## 순차 작업·검수

- [ ] TEST_ONLY: 허용신규시험4+필요browser시험/harness만 작성. 정상원문/권한/원자저장·replay·본인읽기·권한/target/원문회수/변조·미지원/민감·approval연결0·late JSON/UNAVAILABLE누출0 반례. source변경0. Main이실제RED를확인한뒤구현GO.
- [ ] GREEN: 지정제품10/pendingSQL만 구현하고 해당시험·type·직접인접회귀. fakeDB/문서원문fake포트는합성으로명시. 실제SQL/DB미실행. 정적SQL검사는문법컴파일/트리거실행PASS로부르지않는다.
- [ ] UI 합성DOM: 허용두파일의 실제 KnowledgePage/Panel 소비경로를Vite로bundle하고mock만주입한다. 선택→보관→목록→고정조회·실패/응답유실/문맥변경·불가최소응답을검사한다. 실제served/DB인수아님. 별도QA GO전환경/자원생성0.
- [ ] 독립 검수·정확diff/허용범위·보호자료/hash·Main선택검사. Critical/Important는보완후재검수. 변경없는검사를불필요하게반복하지않는다.
- [ ] 결과문서: exact명령/exit/RED→GREEN·직접/인접/DOM각범위·실패·오류횟수·미실행·정리/rollback·다음기능을기록한다. 전체FN05/Stage/WORK_PLAN완료나실제공유PASS로표시하지않는다.

직접명령:

    node --test --test-reporter=spec tests/unit/FN05/knowledge-share-request-input.test.ts tests/unit/FN05/knowledge-share-requests.test.ts tests/unit/FN05/knowledge-share-request-sql.test.ts tests/unit/UI10/knowledge-share-request-api.test.ts
    node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
    node --test --test-reporter=spec tests/unit/FN05/knowledge-api.test.ts tests/unit/FN05/knowledge-state.test.ts tests/unit/FN05/knowledge-scope-store.test.ts

## 합성DOM 자원 사전등록(아직 생성0)

QA root D:/tmp/anvil-v3-fn05-share-request-dom-20261028-01, 하위bundle/browser만. Windows cyhuh 소유·현재세션·최초생성부터30분목표, 합성본문·가짜session/policy/원문만. 기존대상부재/realpath/부모junction·owner를생성직전확인하고충돌시사용/삭제0. 기존설치msedge headless·별도profile/serviceWorkers block, 전요청가로채기 가상origin https://anvil.invalid:3830/만 정적충족/나머지차단,실listener/서버/DB/포트0. 새설치/계정/인증서0. env ANVIL_FN05_SHARE_DOM_QA=1은정확해당테스트에만적용·정리. 브라우저timeout15000/default10000·테스트최대60000. 정상context close후등록root의소유파일/프로세스신원을확인해정확회수·별도부재확인,불명시보존/보고·강제기존프로세스종료0. 실제GO는source가검수가능해지고Main이별도로발행한다.

## 제출 상태

COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED를구분하고정식실패는같은원인/증거/변경/남은판단을모두제출한다. 현재예외/도구권한은제품실패로세지않고동일3회반복하지않는다. Main은전체계획완료까지이어가며이번승인으로P03결정을대체하지않는다.
