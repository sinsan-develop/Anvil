# FN18 정확 HTTPS 서버의 동일 WebUI를 여는 Windows 개발 Shell

## 1. 목적·승인 안의 한정 단위
- TD-01 A(Electron Windows 설치형)·WORK_PLAN FN18·INTERFACES §설치형의 내부 구현이다. 정확 HTTPS 서버를 사용자가 선택해 기존 WebUI/로그인을 사용하는 실제 클라이언트, 오류/창닫기·재표시/명시 client종료, 개발 실행디렉터리 패키지를 만든다. 새 공개 서버·인증/권한·Agent 계약은 없다.
- 전체 FN18 완료가 아니다. **실제 서버/TLS/DB·사용자인수, 실제 installer/사용자 설치·서명·업데이트/rollback, 실행기·spool/checkpoint 회수·안전종료, 원격 팝업/파일 다운로드/브라우저 권한 기능**은 별도 미완료/미검증으로 남긴다. 마지막 세 기능을 정상 지원한다고 표시하지 않는다. 빈창/stub/가짜 연결을 완료로 삼지 않는다.
- 기준 HEAD bd716e36513472be42f654fe2551838c2d4b2adf(직전 제품1f2fe20f), 기존 codex/av3-stage-b. 보호untracked8/다른dirty 보존·기존Primary 단일writer/Reviewer 읽기/Main관리·검수·통합. root package/lock·서버/WebUI/connector/native/키·실DB/서비스 변경0. 새세션·branch·자동화0.
- 공개 서버 origin 설정과 좁은 로컬 IPC 구체화/정확SDK pin은 기존 설계의 구현 방법이다. 임의 파일/명령·토큰/Secret 접근, OS 권한/인증서 예외, 실제 Agent 실행을 추가하지 않는다.

## 2. 정확 신규 allowlist18
Main2b10ff의 기존17 후보/도구경로 부재 확인과 source실목록을 소비한다. settings.css 추가1은 생성 전 Leaf 부재를 확인한다. 모두 신규이며 기존파일을 덮지 않는다.
```text
apps/desktop/package.json
apps/desktop/package-lock.json
apps/desktop/.gitignore
apps/desktop/tsconfig.json
apps/desktop/forge.config.cjs
apps/desktop/src/main.cjs
apps/desktop/src/shell.cjs
apps/desktop/src/policy.cjs
apps/desktop/src/preload.cjs
apps/desktop/src/settings.html
apps/desktop/src/settings.js
apps/desktop/src/settings.css
apps/desktop/scripts/prepare-sdk.cjs
apps/desktop/scripts/verify-sdk.cjs
tests/desktop/shell-policy.test.cjs
tests/desktop/shell-electron-qa.cjs
tests/desktop/fixtures/qa-main.cjs
docs/desktop/README.md
```
- CJS는 Electron main/sandbox preload의 실행 형식이며 별도 TS7 checkJs/strict/noEmit 검사로 제품 JS를 검증한다. root TS7·Node24/npm11/전체 의존성/lock 및 기존 웹 디자인은 바꾸지 않는다. root 기존 compiler node_modules/typescript/bin/tsc의 실제 존재는 Main2b10ff 확인했다. Node/DOM JSDoc·Electron SDK 타입을 쓰고 @ts-nocheck/무검사 우회0.
- 제품 main과 실제 QA main-entry는 같은 shell.cjs를 소비한다. production에는 QA env 활성화·모의 성공·TLS/보안 우회·임의 평가 IPC를 넣지 않는다. QA transport/격리 userData/관측·창 위치는 테스트 entry에서만 준비한다.
- README1만 Primary가 실행방법·지원/미지원·미검증을 작성한다. Main의 WI/결과/WORK_PLAN/WORK_STATUS/DEVELOPMENT_ENVIRONMENT는 Primary수정0. 추가경로·directdep 필요시 쓰기 전에 소비선/이유를 Main에 보고한다.

## 3. SDK·출처·의존성·설치 순서
공식 registry metadata Main28478e, 공식 SHASUMS256 Maind3255a의 현재 관측을 고정한다. latest를 다시 따라 자동 업그레이드하지 않는다.
|대상|고정값|
|---|---|
|electron|45.1.0; host Node>=22.12.0|
|electron tarball|https://registry.npmjs.org/electron/-/electron-45.1.0.tgz|
|npm integrity|sha512-i7qKVAh/KR5v1pf56NhGGX2QYHcdjvLgS7koL6ui50c+zUDGLRunR95nXcTpHPURKOQ4GDBG8BmXiDgOQ8DD0A==|
|@electron-forge/cli|8.0.1; host Node>=22.13.0|
|forge tarball|https://registry.npmjs.org/@electron-forge/cli/-/cli-8.0.1.tgz|
|npm integrity|sha512-zbkmgt7vtL8OBY7YDwVizhCfAHJLpmQtA35iOKGWPpLWRZbGADVyIUZz3QZrbc2V81/BkrBerURIBXdd/fnyhQ==|
|Windows SDK zip|https://github.com/electron/electron/releases/download/v45.1.0/electron-v45.1.0-win32-x64.zip|
|zip SHA256|55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2|
|checksum 원문|https://github.com/electron/electron/releases/download/v45.1.0/SHASUMS256.txt|

1. desktop 전용 package/lock을 만들고 npm lock 생성/ci는 **ignore-scripts**, 공식 registry, 새 빈 userconfig/globalconfig·전용 cache, audit/자동 수정/기존 사용자 credential 전달0으로 고정한다. root package/lock/node_modules·사용자/global npm설정·계정은 변경하지 않는다. 새 child process는 허용 OS/Node 경로 변수만 전달하고 NODE_OPTIONS/실 auth/token/proxycredential·ELECTRON mirror 우회값을 이어받지 않는다. 값을 로그에 넣지 않는다.
2. 먼저 package/lock·prepare/verify script를 소동결해 Main에게 name/version/integrity·전이 resolved HTTPS/lock·경로/한도 검수 제출한다. 이 단계는 **SDK zip 다운로드·압축해제·exe 실행 전**이다. Main의 단계 GO 뒤 아래를 수행한다. 신산님에게 같은 개발 작업 재승인을 묻지 않는다.
3. 고정 공식 zip만 유한 다운로드(한 파일 최대500MiB·120초, 허용HTTPS GitHub release/공식asset redirect만·자격정보0)해 **SHA256 일치 전 압축해제/exe 실행0**. 결과불명/다른버전/HTTP/다른출처/해시불일치면 실패·보존/보고하며 mirror/검증 우회0. 기존 디렉터리/unknown 파일 덮기0. 실제Windows x64를 확인한다.
4. 검증된 SDK를 새 desktop 전용 dist에만 추출하고 설치 metadata/path를 문서화한다. source SDK/script를 읽어 정확 실행파일/버전·자기소유경로·zip 연계를 검증한다. 예상 밖 자동 lifecycle/추가 바이너리 다운로드를 하지 않는다. Forge도 검증된 electronZipDir/동등한 정확 local artifact만 소비하고 cache miss/추가 download 요구는 실패로 닫는다.
5. package의 **실제 Windows 실행디렉터리/asar·manifest/hash**를 생성한다. Setup.exe/설치·등록/서명·업데이트를 완료라고 하지 않는다. 개발용 framework 기본아이콘/브랜딩은 제품 최종아이콘 인수로 표시하지 않는다. 신규 브랜드/화면시안 생성0.
6. 설치/다운로드가 안전심사·환경에서 차단되면 해당행위를우회/반복하지 않고 정확오류/대상/필요지원을 Main에 보고한다. 패키지 source/unit 등 영향없는 작업은 계속한다. 같은근본실패3회 전 동일시도를중단한다.

## 4. 제품 기능·보안 경계
- 로컬 Shell 창과 WebContentsView의 원격 WebUI를 분리한다. 원격은 **sandbox/contextIsolation/webSecurity=true, nodeIntegration/nodeIntegrationInWorker/nodeIntegrationInSubFrames=false, preload 없음**. 원격Web에 Node/Electron/IPC/Secret/파일/명령 포트를 주지 않는다. 별도 프로젝트 DB·지식 원본을 만들지 않는다.
- 로컬 settings UI만 좁은 preload/IPC를 쓴다. 로컬 고정 custom URL과 **정확 own webContents/main-frame** sender를 검사한다. opaque origin의 null끼리 비교로 허용하지 않는다. IPC DTO는 get-state(null), connect({serverOrigin,replaceInvalidConfig:boolean}), client-quit({ackUnverifiedRuntime:true}) 및 비밀없는 상태 event 정도로 한정하고 임의 channel/fs/exec/eval/session handle0. native tray의 show는 Main 직접함수다.
- HTTPS origin만 저장한다. 사용자info/credentials·path(기본 / 외)/query/fragment·HTTP/data/file/제어문자/잘못Unicode/빈값·초과길이를거절한다. URL parser의정확origin 정규화·표시를명시하고dot-path정규화로임의경로를origin처럼통과시키지않는다. 저장은 schemaVersion1/serverOrigin의 공개 metadata뿐·사용자명/토큰/키0. 최초/재연결은 사용자 명시클릭, 자동연결·새 origin 추정0.
- 설정파일은 app.getPath(userData)의 고정이름에만 atomic 쓰기, 경로/link/regular/nlink·크기검사·unknown 덮기0. 손상 복구는 원문을 같은 소유범위에 보존한 사용자의 명시 교체만, unsafe대상/unknown 결과는 보존·실패한다. 키/계정/기존 다른앱 설정/ACL 변경0. QA는 실제 product userData를 사용하지 않는다.
- 초기/다른 origin 연결 전에 이전 WebUI를 안전하게 정리한다. **기존 Web beforeunload를 무시하거나 강제 파괴하지 않는다.** veto이면 기존 origin/입력·view 보존, 불명 종료이면 새 연결/종료 성공으로 승격0. config/연결 generation·view identity를 결박해 late load/다른 origin이 현재 UI/상태를 덮지 못한다. 연결 중 중복행위는 유한/명시 처리·자동 POST 재시도0.
- off-origin navigation/redirect/새창·다운로드·remote권한 요청을 기본 거절한다. certificate-error 예외/새 CA/ignore-certificate-errors/disable-web-security/no-sandbox/자동 shell.openExternal0. 이 때문에 설치형의 새창·다운로드·일부 권한 기능은 현재 미지원으로 사용자에게 안내하고 브라우저 전체 기능 동등이라고 주장하지 않는다. 기존 브라우저 WebUI는 변경하지 않는다.
- 연결오류/offline/TLS 분류·blocked 상태를 로컬 UI에서 표시한다. 화면 load는 로그인/서비스health·프로젝트현재성/Agent상태를 증명하지 않는다. 원격 WebUI의 기존 전용 로그인/cookie를 그대로 사용하고 LLM 계정/Secret를 Shell에 복사하지 않는다.
- 닫기는 hide·view/메모리 입력 유지, tray/명시 show로 같은 view 재표시한다. 명시 clientQuit만 native close를 시도하며 beforeunload veto는 종료취소다. 실행기/spool/checkpoint가 미연결이면 **미구현/확인불가·안전종료 미검증**으로 표시하고 Agent회수/작업완료/제어권해제 성공을 꾸미지 않는다. 숨김과 실제process종료를 구분한다.

## 5. 로컬 화면 상세 시안
기존 WebUI를 재설계하지 않는다. local chrome의 작은 연결영역만 기존12px/남색·파랑/접힘설명 기준으로 구성한다.
```text
Anvil 개발 클라이언트 · 설치형 Shell        [상태 i] [클라이언트 종료]
서버 기본주소 [ https://...                 ] [명시 연결/재연결]
상태: 미연결 / 연결중 / 화면불러옴(인증전) / 오류 / 닫힘미확인
기존 브라우저 WebUI 영역(동일서버·동일프로젝트·기존로그인)
```
- 잘못 입력/오류·로딩 뒤에도 사용자의 URL편집은보존하고 raw문자열을HTML로삽입/로그하지않는다. 연결 실패에 이전서버UI를 새서버처럼 표시하지 않는다. runtime회수·다운로드/팝업 미지원은 i/오류동작에서 짧게 알린다.
- 종료는 ‘앱 종료가 Agent 회수·서버 작업 종료 확인이 아님’을명시확인하고진행한다. veto/불명은살아있는원창을유지하고재표시/해결후명시재시도한다. 사용자에게파일·터미널로정상설정을편집하라고하지않는다.
- 제품/문서/오류모두한국어, native framework코드값은별도표시가능. 상태가없으면미확인으로남기고fakeDemo자료0.

## 6. QA·자원 사전등록
|literal/대상|owner·목적·수명·정리|
|---|---|
|apps/desktop/node_modules|기존Primary/Main·고정개발SDK/의존성·후속개발용 보존/gitignore·기존rootdeps불변|
|apps/desktop/.cache|같은담당·고정공식SDK zip/검증원장·개발cache 보존/gitignore·추측삭제0|
|apps/desktop/out|같은담당·한정개발 실행디렉터리·검수용보존/gitignore·설치/등록0|
|D:/tmp/anvil-v3-stage-b/fn18-shell-toolchain-20261030-01|새빈npmconfig/cache/다운로드진단·최대24h/작업종료후소유확인정리·user/global config0|
|D:/tmp/anvil-v3-stage-b/fn18-shell-qa-20261030-01|매실행fresh격리userData/메모리응답·최대30분·확정child exit/stdio/ownedprocess0후정리|
|D:/Project/Anvil/.av3-data/v3-development/fn18-shell-20261030-01|검증된개발artifact/비밀없는manifest만·인수검토용보존·서명/설치본아님·기존형제키/DB/자료0|
- Main2b10ff는첫5소스/도구/QA경로부재를확인했다. 최종위root/artifact 및추가path는생성직전실제부재·parent realpath/link/owner·용량을재검사하고기존대상있으면덮지말고보고한다. 새desktop 개발resource총2GiB 범위/충분한free확인·내려받는zip500MiB상한,스크립트대상경로상한을유지한다.
- ElectronQA는 **검증SDK exe + QA전용 main-entry/stdio JSONL**만 사용한다. Playwright _electron/CDP/inspector/remote-debugging-port·server listener/서비스0. 자기소유Electron/renderer만식별하고unknown종료는강제kill/경로삭제0·보존/실패/보고한다. root/다른Electron/Codex프로세스0.
- 실제 BrowserWindow/WebContentsView·제품shell·기존WebUI bundle을 메모리HTTPS/명시응답으로 렌더한다. 모든미등록네트워크는차단·DNS/실서버접속0. 메모리HTTPS는실TLS검증아님·TLS오류분류주입/정적검수와실핸드셰이크NOT_RUN을구분한다.
- 창은 QA전용 배치/비초점·화면밖·초기hidden으로 사용해 사용자작업을가리지않는다. 실제native show/hide가검증되면그범위만보고, tray메뉴/물리시각/포커스·packaged exe직접기동을실행못하면미검증으로분리한다. 보안옵션/TLS/권한을QA때완화0.
- setup전체outertry/finally·소유marker/realpath/link/확정child종료/stdio/환경원형복구 후 정확자원만정리·Main별도잔여0. 물리launch/close불명은NOT_RUN/FAIL·강제종료로PASS0. appdata/캐시/쿠키는새QA경로만·실계정/원문0.

## 7. TDD·검수·증거
- policy/settings/IPC 입력·frame 검사 단위 RED→GREEN 및 실제Shell 연결동작을 검증한다. 신규module부재는동작조건0으로분리하고 유의미한음성(HTTP/userinfo/원경로/다른frame/nullorigin·원문손실/unsafe file)과실제품소비선을확인한다. 기준/기대값완화·gitleaks/Hook/캐시우회0.
- 실제SDK QA: 최초원문없는설정·명시정확origin/동일WebUI/로그인오류·다른origin/팝업/다운로드/remote Node·IPC0·local sender/input거절, offline/load 오류·명시재연결, 입력hide→show보존, beforeunload취소·정상client종료/소유process exit를확인한다. unsupported/native 미확인는소스단위합격으로승격0.
- 새전용 typecheck(checkJs strict)+node --check·policy test·native QA/manifest/hash·Forge실제package 생성과정확메타데이터를검증한다. SDK로packagedfactory를실행한것과packagedAnvil.exe main-entry 직접기동/사용자설치는별개다. 직접기동미실행은NOT_RUN으로기록한다. root표준type/build/diff는실제영향이있는범위만필요대로선정·기존완료기능전수반복0.
- 개발artifact에는source-file hash/lockhash/SDKziphash·플랫폼/구성/파일목록·bytes/hash와NOT_RELEASE/UNSIGNED_DEV를기록한다. 프로젝트원본/사용자userData·키가들어가지않도록실목록을대조한다. absolute내부source경로를PMO/외부보고에넣지않는다.
- Primary exact18hash/명령exit·SDK/lock검증·어떤native동작실행/미실행/오류/회수·다른버퍼/브라우저불변·README제출→writer해제→독립C/I→같은담당보완→Mainfresh검증/별도잔여0→기존branch checkpoint/private. README는Main검수후canonical문서에반영한다.
- 실제DB/SQL/GRANT·정책/계정/키/인증서·기존서비스·Agent/Job·비용·Oracle/운영·installer/OS등록/autorun/서명업데이트0. rootprivilege/ACL변경/CA예외/실서버0. 전체FN18/Stage/계획완료·PR/main병합0. rollback은한정source revert·자기소유개발cache/QA만확인정리이며실사용자앱/자료삭제0.