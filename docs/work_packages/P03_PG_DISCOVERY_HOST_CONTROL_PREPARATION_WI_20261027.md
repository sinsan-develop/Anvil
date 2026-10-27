# P03 RO metadata QA host 제어 준비 WI

2026-10-27 · Main 어울 · 기준6d584a619c457218d7b40e94e58358264270943a.

## 목적·권한·재사용 판단
보존 DB 복구에 필요한 구조metadata 조사는 shell/집계가 준비됐으나 host60초/합계8KiB·단발·자원신원·정리 제어가없어NOT_EXECUTION_READY다. 이공백만 source-only로보완한다. 공개API/DB/schema/정책/사용자권한·실제QA실행승인을추가하지않는다.
실제SSH/WSL/Docker/volume/PG/SQL/Secret/서비스/Agent/C#/pwsh실행0. 새실행효과는구체화뒤신산님최신지시/기존승인범위/플랫폼정확심사를대조하며,파일의허가문자열이외부승인을인증하지않는다.
기존 scripts/provision-development.ts는top-level CLI와Secret/DB초기생성경로라import/실행하지않는다. FN03전용guard/자원제어는다른root/network/PG를고정하므로재사용실행0. scripts/development-resource-guards.ts의순수assertResourceAbsent만필요하면import해재사용할수있고기존파일은수정0이다.

## 단일 writer 허용3신규파일
1. scripts/p03-pg-discovery-host.ts
2. tests/unit/P03/pg-recovery-discovery-host.test.ts
3. docs/work_packages/P03_PG_DISCOVERY_HOST_EXECUTION_PLAN_20261027.md
기존shell/unit/원실행안·provision/FN03guard/보호8/native/approval/marker/정본현황은수정0. 새branch/worktree/채팅/자동화/commit/push0. 일반runner/백그라운드daemon/다른프로젝트제어로확장하지않는다.

## 환경·고정 후보
실제controller는WSL-server의Linux/uid1000·새Git exactSHA QA source에서만apply하도록한다. Windows에서의import/default/--plan은순수제안만/FS mutation·Docker0이다. source QA root 후보 /home/daon/anvil-v3-pgdiscovery-20261027-r2-src, 새비밀없는grant/consumed/receipt root후보 /home/daon/.local/share/anvil-v3-pgdiscovery-20261027-r2. 아직생성0·기존디렉터리/Secret/정식checkout을수정하지않는다. sourceGit준비·종료후정확source정리와receipt보존은Main절차로계획에명시한다.
현재known WSL Node literal /opt/node-v24.21.0-linux-x64/bin/node 및과거SHA7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c는실행전fresh대조가필요한역사profile다. 설치/다른Node·호스트자동탐색0. import/test에서실환경조회하지않는다.
helper name anvil-v3-pgdiscovery-20261027-r2; image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/pullnever; 원volume anvil-v3-development-pgdata(instance dc22a0629e79f259dcd935845e88e58e,project v3/owner P03,driver local); daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e. sourceScript Git기준6d584a61/raw156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B.
원shell/실제metadata범위는R2/원실행안그대로: uidgid999는조사주체일뿐실PGUID확정0,sourceRO/volume-nocopy/networknone/publish0/rootfsRO/capdropALL/no-newprivs/pids32/memory128MiB/CPU0.2/내부55초/entry100000. 전체metadata phase는preflight부터정리까지60초단일monotonic budget,deadline매단계재설정0. 시작전잔여55초+정리reserve가없으면start0·이한계를계획에명확히정한다. kernel대기/불명상태까지강제종료보장0이다.

## 제어 계약
- import/기본/--plan은actual실행0/정적proposal만. CLI는--plan/--apply만받고host/path/image/command/UID/한도override플래그나환경변수로범위를넓히지않는다.
- run함수에명시주입하는FS/Git/Docker/clock ports와실제고정Docker adapter를분리한다. fake만있는반쪽executor로완료보고하지않는다. 기본factory는apply진입전에만생성하고시험은mock만쓴다.
- apply는Linux/uid1000·소유source/protectedroot realpath/nonlink/단일link/owner/mode·exactGitbranch/HEAD/승인된private원격/실행sourcehash·shellraw156/시간·고정scope/한도·소진부재를검사한다. protectedroot의고정grant.json만읽고임의파일/경로·다른C#승인을받아들이지않는다. 실제입력record작성은이번에0이다.
- grant는비밀없는실행binding일뿐사람승인증명아님을항상명시한다. 최대30분창/단1create/start와정확scope·source/실행commit/hash·수명/한도를검사한다. 현순서에서실행이승인됐다고기록하지않는다. 결과 externalUserApprovalVerified=false. 승인근거/플랫폼판정은Main이외부에서대조한다.
- 새consumed.json은CreateNew+동기화로첫원격mutating명령전단발을소비하고삭제/리셋/재시도하지않는다. 비밀없는진행receipt는정확scope/생성ID/상태/관측·정리/오류를같은신규protectedroot에남긴다. 변경/쓰기불명은false성공으로넘기지않는다.
- 고정 /usr/bin/docker를argv배열/shellfalse로만호출한다. targetdaemon은알려진local endpoint/daemonID로명시결박하고기존Dockercontext/config/SSH·user환경설정은변경하지않는다. 새볼륨/네트워크/pull/exec/PG초기화/DB/Secret명령은없다. 허용동작은knownpreflight,create1,inspect,그helperstart1,필요시자신helper SIGTERM1,정상종료확인후동일fullID rm1,부재/원volume보존관측이다. -f/-v/SIGKILL/다른Name·ID처리0.
- preflight에서helperliteral부재·daemon/imagefullID·image선언VOLUME1·원volume/label/createdAt/driver/options/소비자0을fresh대조한다. create후start전에는자기fullID외foreign소비자를허용하지않는다. 관측점으로기간중불변을증명했다고주장하지않는다. namedvolume의외부변경/암묵생성race를없앴다고주장하지말고post정체성불일치는start0/보존으로닫는다.
- create반환은64hexfullID만채택. fullID/name/고정labels+새runinstance 식별자·image/createdAt·UID/entrypoint/argv·network/ports·RO/caps/security/resource한도/Mounts1/원sourceRO를inspect해start전확인한다. 추가instance는비밀/인증key가아닌새QA식별자이며실제nonce/record생성은지금0. 원실행안3label에서의강화차이를새계획에명시한다.
- image/생성container의Env본문을출력하지않는다. 예상안전키/고정override만허용하고NODE_OPTIONS/NODE_PATH·Bashhook/동적loader·예상외keys는fail-closed다. PATH는고정 /usr/bin:/bin override만허용한다. 검사하지않은상속Env를안전하다고가정하지않는다. HOME/CODEX_HOME은덮지않고원Secret/계정환경을helper에전달하지않는다.
- actualstart는검증된같은fullID1회,exactGit shellblob만stdin으로보내고workingcopy/CRLF정규화/임의archive/directpatch로대체하지않는다. 필요한source획득은새QA의GitexactSHA만사용한다.
- helperraw stdout+stderr 합계8192bytes/시간초과는원문노출없이실패. control JSON도유한별도상한을명시하고왜rawmetadata상한과다른지숨기지않는다. 출력/로그/오류에는원파일명/본문/Env값/Secret/exception.message/임의payload를붙이지않는다. 단일strictJSON·닫힌status/ref/path/hash/수치만검사한다.
- 정상metadata와접수/실행/정리확인은별개다. partial/invalid/불명상태는PASS/complete=true로승격0. 검사된원보존필요true를오류때false로덮지않고미관측은생략/null. phase/finite errorcode/exit/signal·생성시도/관측을구분한다. Node/프로세스ID는권한proof가아니다.
- timeout/출력초과/단절/close불명에서는start재시도·다른helper생성0. fresh정체성/소유가맞고running인본체에만정상TERM1; 종료/신원불명은rm0·정확자원보존/다음조치보고. 정상종료·exact정체성재검사후rm(-f/-v없음)과별도부재·원volume보존을대조한다. 단순inspect nonzero를부재로오인하지않는다.
- sourceQA/protectedroot/receipt/다른자원은controller가일괄삭제하지않는다. sourceGit별도정리는Main의초기부재/동일inode/owner/Gitexact/무예상파일·link근거후에만,consumed/receipt는보존한다. 원볼륨/정식서비스/Secret/기존repo/다른프로젝트를변경하지않는다.

## TDD·검수
TEST_ONLY먼저신규명시unit에fake FS/Git/Docker/clock과실제adapter의fake child로동작을검사한다. defaultplan0효과·승인/기한/소진/변조거절·잘못된daemon/image/volume/env/추가mount/foreign소비자·1create/start·정상수집/소유정리·낙관적unknown false금지·timeout/8KiB/close/승인만료·foreign/미종료삭제금지·원volume불변/재시도0을필요범위로검증한다. 단순guard복제·실제없는TODO/하드코딩성공을쓰지않는다.
실Docker/SSH/WSL/volume/sourceQA/protectedrecord/PG/Secret/PS/C#·실node다른프로그램실행0. 신규Nodeunit·type/구문/diff만,기존단위/PS/C#시험반복0·localBash재실행도이번0이다. Docker command adapter는fake spawn만으로출력/한도/인자·실제handler경로를검증한다.
MainfreshRED전제품코드작성0. source3완료뒤동결해rawhash·정확명령/결과·실행한분야/NOT_RUN·오류/남은준비조건을보고한다. 독립C/I0·private게시뒤에만실행경계를구체대조하며현재실행권한을만들지않는다. rollback은소유3정상revert·원자료/승인/marker/자원삭제0이다.

## Main 내부 제어 보완 — 2026-10-27
독립 예비검수는 단일 deadline 밖의 FS 대기와 timeout 후 client/pipe 생존을 지적했다. 같은 고정 Docker/Git 명령을 시작한 원 spawn handle에만 SIGTERM 최대1·stdio close/destroy를 source-only 내부 제어로 허용한다. helper 자체의 정상 TERM 신원검사는 별개이며 PID 탐색·전역 kill·SIGKILL·unref·새 daemon·실제 프로그램 실행은 허용하지 않는다. 늦은 FS 완료 뒤 다음 mutation을 차단하고 미확정 소비/쓰기는 pendingIO·보존 필요로 기록한다. 60초가 kernel 종료/진행중 IO 소거를 보장한다고 주장하지 않는다. 이는 허용 source3의 정확 효과를 닫는 내부 보완이며 실제 QA/원 volume/기존 컴파일 재실행 승인이나 범위 확대가 아니다. 기존 순수 parseWireJson으로 중복 JSON 키도 거절한다. 원 환경·자원·출력/시간 한도·단발·허용3은 유지한다.

## 관측 profile·PMO 한정 Node source 후보 보완 — 2026-10-27
74bfc1/ba0213/e94e53 현재읽기근거와PMO의한정결정에따라image기본PATH는PGbin을포함한정확관측값으로만교정한다. helperPATH고정override·unknownEnv/EXPOSE대조·실게시0는불변이다. 기존Nodepath/hash의소유uidgid1001:1001/0755만명시source-only후보로고정하며실행uid1000을유지한다. 부모/·opt는0:0/0755,versionroot/bin은1001:1001/0755·canonical/nonlink를대조한다. 원파일handle의메타데이터/hash전후와procselfexe/부모전후일치로교체를탐지하되경합전체/loader라이브러리신뢰를증명하지않는다. UID0/임의UIDfallback·설치/chown/ACL변경/다른runtime검색0이다.
현재getent1001은NOT_FOUND이며소유주체미해결/향후UID할당·교체위험을OWNER_UNRESOLVED_RESIDUAL_RISK로유지한다. grant닫힌필드에 numericOwnerRiskAcknowledgement=P03_UID1001_OWNER_UNRESOLVED_REPLACEMENT_RISK_ACCEPTED_FOR_THIS_RUN 한정literal을필수로추가하며누락/false/임의값은Docker0이다. 이record는사람승인을인증하지않고Main이정확외부실행결정을대조한뒤에만생성할수있다. 현재생성/실행승인0이다. 실factory의purehelper연결·독립literalfixture/변조반례를같은허용3에추가하며새파일/실도구실행0·한도/소비/RO/보존기준불변이다. 이는미확인owner를안전하다고완화하는것이아니라실제효과결정에잔여위험을드러낸source후보이며실행준비완료주장0이다.
