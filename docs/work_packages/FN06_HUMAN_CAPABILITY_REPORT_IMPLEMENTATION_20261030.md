# FN06 HUMAN 능력보고 r2 source 구현·UI11 상세 업무 WI — 2026-10-30

## 1. 근거·담당·기준
- 직접 승인 docs/approvals/FN06_HUMAN_CAPABILITY_REPORT_SOURCE_DIRECT_APPROVAL_20261030.json SHA256 7B22897F025CCEEE434C1923B80E2EC1D00EED5AFE5D1AE69D040AFA7255FA36.
- 채택 계약 docs/work_packages/FN06_CAPABILITY_REPORT_HUMAN_STORAGE_CANDIDATE_R2.md SHA256 6546808480650288302FB6AAF674AE35D7A72744E2C85A693D6BB13AA2E6B7F8 전체가 상세 기준이다. 당시 DRAFT/NOT_ADOPTED는 이력이며 현재 직접 승인으로 정확r2 source 범위가 채택됐다.
- WORK_PLAN FN06/UI11의 사람 능력주장 보관·고정조회 기능. 실제 능력 실측·C1 허가 해제/전체FN06·Stage·계획 인수 아님.
- 시작 HEAD64642dfbbb2e76b3b6fb36a365c3719bbebcb11e/기존 codex/av3-stage-b·Main WORK_STATUS dirty·보호 untracked8 보존. 기존Primary 단일 writer, 기존Reviewer 읽기검수, Main 관리/문서/검수/통합. 새세션/branch/자동화0·Main활성writer제품수정0·Primary문서/commit/push0.

## 2. 정확 쓰기 allowlist15
기존5/시작SHA256(Main85aaf1·d38baf):
|경로|SHA256|
|---|---|
|apps/server/modules/access/project-command.ts|6DE5B3D31FEA8D953D8E49A418C0EE14720B7E760EA71C57354FF8CE5DF09318|
|apps/server/modules/projects/routes.ts|474C89F3BB870D998B3B884025DB4EC089F7119C8C9C8A271FEA0F47F40BF583|
|apps/web/src/App.tsx|EC383A2650D681E4E20B750768C07E3F73F1521427F5D1C93784B8DD71FFD96D|
|apps/web/src/features/connections/ConnectionsPage.tsx|E91B6017C68B0736C2A5142F4CA07ED2B4DF7A9AB203A030419D503A61B1DADD|
|apps/web/src/features/connections/policy-editor-profile.ts|AE7520D836F9C26E4AF18226459943377C646AA6397B5FE5CE50E4A6AE17AB69|
신규10/Main부재확인:
- apps/server/modules/connections/capability-report-input.ts
- apps/server/modules/connections/project-capability-reports.ts
- apps/web/src/features/connections/capability-report-api.ts
- apps/web/src/features/connections/CapabilityReportsPanel.tsx
- db/migrations/0057_capability_reports_human_claim.sql.pending
- tests/unit/FN06/capability-report-input.test.ts
- tests/unit/FN06/capability-reports.test.ts
- tests/unit/UI11/capability-report-api.test.ts
- tests/browser/UI11/capability-reports-dom.test.ts
- tests/browser/UI11/capability-reports-dom-harness.tsx
현재inventory최대0056/0057부재를Main이확인해0057로고정한다. 기존SQL/후보입력·artifact저장소/실행Authority/공통API·생성schema변경0. 추가필수경로는정확소비선·이유를Main에보고후허용한다. 정책profile는새op명시선택만추가·실정책자동부여0.

## 3. 기능 단위 업무·불변
1. 신규 recordCapabilityReport는기존ProjectCommand·targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null이다. 전용 ProjectCapabilityReports.command가authenticated→OWNER/현재제어→기존reauthUntil→현재명시AUTO/DENY/정책기한→replay를소유한다. REQUIRE_APPROVAL/non-nullref는CAPABILITY_APPROVAL_NOT_CONNECTED/412,규칙없으면거절. 범용ProjectPolicyRepository의earlyreplay동작은바꾸지않고reauth를callback뒤로미루지않는다.
2. r2정확claim9키·capability6키·고정6code·정확ref/UTF8MIME/한도/자유문자/시각/비밀표식/HTTPS자격정보없음을그대로검증한다. tool필드200·reason/limitations20000·URL2048·입력/snapshot UTF8각2MiB·근거항목20/전체unique20·기한최대2h/두후보와정책최단기한·nullable observedAt미래거절. 새자동연장/문서URL접속0·허용TAB/LF/CR·배열순서/null시각/원주장문자열자동치환0.
3. 새쓰기에서는기존연결/환경후보현재head/hash·정확종류/프로젝트/만료를검산하고supersedes는동일fullref쌍의기존보고정확ref만허용한다. 일반등록/신뢰를같은권위로바꾸지않는다. 원문evidence는현재회원/보호파일/READY·격리·bytes/hash/UTF8·최대2MiB 검증실패시저장거절한다.
4. 근거검증은가능하면기존 ProjectDocuments.originalText(db,pid,ArtifactRef)의보호검사를그대로소비한다. 이메서드는자체회원검사없으므로authenticated transaction+projectMember가선행한다. 내부#artifact→ArtifactStore.read/assertStoredArtifactReadable의보호경로·link/owner·metadata/격리·민감/bytes/hash를우회하거나중복provider로대체하지않는다. 실제제품원문IO는이번시험에서실행하지않고fakeDB/주입합성port와실class의경계를기록한다.
5. claimHash=H(canonicalJson(claim)),snapshot은r2정확16키/외부ReportRef다. sourceAssurance=HUMAN_CLAIM/bindingKind=CANDIDATE_ONLY·reportedBy인증user/client,recordedAt transaction ISOms. 실행/관측관련3ref=null,서버capabilities고정6순서모두measurement.state/controlLevel=UNVERIFIED·두false. 사람VERIFIED/DIRECT도원주장으로만보존·일반command receipt를실측receipt로복사0.
6. APPLIED data.status=CAPABILITY_REPORT_RECORDED/ref/snapshot/effectiveForExecution=false/dispatchPerformed=false. report/evidence/command/receipt/audit는같은transaction으로보관한다. exactreplay는현재인증/제어/reauth/정책을먼저통과한뒤원row·claim/snapshot/receipt를검산해같은ref만반환한다. 후보가나중변경됐다고원보고를새로생성하지않는다. 같은ID다른hash409,다른ID는별도보고·자동dedup0.
7. 고정 GET /api/v1/projects/:projectId/capability-reports/:id/versions/1,빈query/no-store·현재HUMAN cookie회원만. 과거조회에현재controller/reauth/쓰기정책요구0,권한상실/타프로젝트/미존재404·원형/claim/report/receipt손상503. 응답은r2정확7키·currentnessIssues는snapshot/hash밖. 항상이슈 CANDIDATE_ONLY/HUMAN_CLAIM_UNVERIFIED를포함하며후보head/만료·report만료·근거소실/격리/hash불일치·검증불가를정확분리한다. 근거상태판별불가는CURRENTNESS_UNAVAILABLE·정상간주0. rawevidencebytes/storagekey/비밀반환0·effectiveForExecution항상false.
8. 미적용0057은r2두표/PK·unique/FK·supersedes null3동시성/종류·fullhash·project/actor/client/현재제어/reauth/AUTO·receipt원명령·snapshot검사를작성한다. evidence행과claim6항목의양방향exact동일/전체unique20·READY/currentmetadata·원report/command귀속을deferred최종검사한다. 부분report/evidence/receipt만COMMIT불가. UPDATE/DELETE/TRUNCATE방어/권한선언은신규두표만·기존표/역할/적용SQL변경0·확장설치0. SQLnull/type/숫자reason·조건값null도failclosed. 실제DDL/GRANT/SQL실행0이며source검사를PG원자성PASS로표현하지않는다.

## 4. UI11 화면 단위 업무·상세 시안
기존ConnectionsPage내보조panel로연결하고새menu/route/대시보드를만들지않는다. App소유버퍼로화면이동/연결실패뒤입력·고정원명령을보존한다. user/client/project/정확대상쌍과bindingId로귀속하고owner epoch/실client교체/같은clientABA/late응답·실digest를검사한다. 기존등록·신뢰·정책UI/다른buffer동작은유지한다.

화면배치(기존12px/남색파랑/접힘설명·기존폼표준):
- 제목: 사람의 능력보고 / 보조문구: 사람의 주장 보관·실측 아님·실행 허가 없음.
- 대상행: 기존보호조회로선택한연결후보[id/v/hash/만료]와환경후보[id/v/hash/만료]. 잘못종류/프로젝트/이전head는저장거절. 임의가짜ref/실행대상자동등록0.
- 도구행: product/version/adapterVersion,관측시각(미확인=null 선택),기한(default30분제안/최대2h·최단기한이더짧으면그한도안),정정원ref(선택,기존원문대조).
- 6능력영역: 코드별사람의문서근거(null또는sourceHTTPS/관측/호환주장),제출측정주장3값·요청통제주장4값,근거ArtifactRef목록·한계. 빈값을가짜문서/VERIFIED로채우지않고모든필수입력을사람이확인한다. 자동URLfetch/probe0.
- 이유/저장영역: 원입력·대상fullref/미실측·권한불가를확인한뒤명시저장. 재인증/정책부재는정확오류를표시하고실정책생성0. pending/uncertain은원command/입력/근거를잠그고같은명령만명시재확인·자동재송신0. 성공receipt뒤반환ref의보호GET을재검산해야보관확인,재조회실패는결과미확인/원명령보존.
- 고정조회영역: 기존보고ID(버전1고정)/기존정확ref를명시입력→GET. 조회본문에는ref/hash·보관시각/기한·reportedBy/원주장과서버UNVERIFIED를나란히표시·currentnessIssues를별도표시·정정원ref·근거수동열기. expected fullref를입력했다면응답과정확대조한다. 목록/latest/search·자동report선택/prepareExecution저장0.
- 근거열기: 사용자가명시클릭할때만기존보호filesGET로열며보고DTO/초기렌더에rawbytes자동복제0. 늦은조회/권한오류/주체전환은이전본문을숨기고입력·미확인명령은보존한다.
정상/로딩/빈입력/오류·401/404·재인증필요/409/저장후읽기실패·과거보고만료/후보변경·근거불가상태를구분한다. 기록을없음/현재실행가능으로바꾸지않는다.

## 5. TDD·독립/Main 검수
- 최초RED는신규parser/연산/저장·GET/화면부재를실제로관측·의도부재와제품차단을분리한다. 동작GREEN은실class+fakeDB/주입합성transport의저장→보호GET/정정원보존→exactreplay로검증한다.
- 입력누락/추가·제어문자/U+0000/잘못6code·중복/교차프로젝트/반대종류·후보head/hash/기한·미래관측·비밀표식·원VERIFIED/DIRECT서버UNVERIFIED·evidence중복/초과/손상/격리·부분실패rollback·report/evidence/receipt정합변조·현재reauth만료replay차단/제어권/권한/정책회수·과거만료GET/issue와403/503분리를검사한다. 기준/기대값완화0.
- 신규unit3+직접인접candidate-input/candidate-api/candidate-policy/candidate-profile를실제존재경로로선정. 실UI11 DOM에서필수6주장입력→명시저장/고정조회·입력/불명pending보존/후속재확인·현재성분리·명시evidence열기·실client/ABA·lateJSON/실digest·401/404숨김/nonGET자동0을검증한다. 서버권한·실파일IO는합성대역범위를명시·전체App통합증거로확대0.
- npm run build(내부typecheck)·git diff --check·기존SQL/Authority불변. 같은코드완료검사전수반복0. 테스트비밀음성은명백한합성더미로작성·gitleaks/Hook/ignore/기대값우회0.
- Primary정확명령/exit·15hash/diff·오류/미실행·회수제출→writer해제→독립C/I→같은담당보완→Mainfresh집중검증/별도잔여0→기존branchcheckpoint/private게시. 필수실Stagegate미달PR/main병합0.

## 6. 합성 QA·기록·복구
- 신규 D:/tmp/anvil-v3-stage-b/fn06-capability-report-20261030-01,담당FN06 Primary/Main순차·메모리API/실Edge/메모리bundle용. Main d38baf 부재확인. 매실행직전부모realpath/link/owner·대상부재확인→새빈경로만생성,매실행최대30분. 실제DB/격리PG/SQL·제품원문IO/서비스listener/Agent0.
- 전체setup outertry/finally·환경원형복구·확정context/browser회수·marker/realpath/link검사후정확소유자원만정리·독립경로/프로세스잔여0. launch시도전미확정표시,launch/close결과불명은삭제/강제kill0·보존/실패/보고. 물리불명미실행은NOT_RUN.
- 실제계정/권한·grant·키/credential/Secret/인증서·DB적용/접속·서비스·Agent/Job·비용·CONNECTOR/TRUSTED_PROBE/native/socket·Oracle0. C1 Authority/true조건/보고latest/list/search/자동probe/자동prepare저장0. 같은근본오류3회면추가시도중단/Main보고·권한심사우회0·경로inventory→Leaf→읽기만.
- Main이WORK_STATUS/PLAN에단계·담당·변경·시험·오류·미검증·다음을누적한다. rollback은한정15경로source commit revert·신규표/실자료삭제·자동down migration0. 실제적용/운영복구는범위밖이며실DB/정식권한·동시성·실파일/Agent·served/사용자인수NOT_RUN을보존한다.
