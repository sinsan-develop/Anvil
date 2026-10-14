# 2026-10-14 현재 정식 WSL 개발 화면

- 2026-10-14 M22 Git 최종 확인: `/srv/anvil-wsl/repo`는 `f3ccab1a8cb5f0422279acb2034a0d80d68ed193` exact detached/clean으로 이동했다. 이는 Git 자료 갱신만이며 서비스·DB 변경은 없다. 현재 실행 API/Web source는 C20 `f03348ac680e624ee0ca41e2b97ca07b38aff677`, issuer는 C15로 유지한다. 아래 후보의 서비스 전환은 미실행이며 이를 M22 실행 배포로 해석하지 않는다.

- Queue 격리 이상 후속 후보: C22 `511806ee4f8d7dcd8d08082b0d4651d7ede6d21c`, M22 `f3ccab1a8cb5f0422279acb2034a0d80d68ed193`/`deploy/wsl/U01ScopedQueueQuarantineReleaseManifest.json`. 새 API image `sha256:6c5edefa5fc3d4038e51aa7140b4b53a9294414875af73f9d9bcd5e3aa54ac17`·Web `sha256:949aaeabd0daf44caa9341b1b2c8ddfb8409e4c2b3a8e1da0aeb3784bd0627fc`는Git exact C22빌드·분리빈PG15/0021/OIDC/HTTPS/Chromium의실제repository격리1→인가API→LATE화면·기간/만료소거·철회차단을확인한후보이다. 정식 API/Web 서비스 전환은 실행 안전심사에서 명시승인부재로 거부되어 아직 미반영이며, 아래 C20 공개 API/Web·issuerC15/정식 DB0021·Secret/권한/망은 그대로다. 후보의 격리시험을 정식 개발 화면 반영으로 혼동하지 않는다. 정식 Git M21→M22 fetch 상태는 별도 최종 조회로 기록한다. 실제서비스 전환 승인 답변 전 재시도/우회0; 원격 일회성 QA root/container/port는 정확정리/독립잔여0이고 후보 image와 기존 rollback만 보존한다. 전체U01 NOT_ACCEPTED/Release DEFER·기존DC019 불변.

- 정상 계획 원본 등록·비영 승인 요청 확인: 내부 host source `88a56c30ff9eebc726fa1bf390462ab94eb771b7`(C21)/image `sha256:292fb9366eefe6cf88ebae17e578abc4019fef7a21031b5296b05c5d6b8f5967`, 정식Git/manifest `e92bc992ba7c0abd28ff027a52115f362aff09fa`(M21)/`deploy/wsl/U01PlanningSourceRegistrationReleaseManifest.json`. 공개API/Web C20·issuerC15는아래기존ID/image/DB0021/reader/Secret그대로이며혼합source를하나로표시하지않는다. 정상등록API가아닌호스트전용내부등록권한으로별도Task `u01-approval-source-qa-20261014`·실제typed계보→기존producer→요청 `91237c63-aaac-4a47-b89a-6c87487819d2`/감사1을저장하고인가GET/실제화면1건을확인했다. 기존Task1Run1은보존돼전역Task2/Run1·선택Task1/Run0이며사람approval/새Run0다. sourcegrant는회수됐고request생성권위는capability폐기/DB미회수·기존최대1h, 요청표시는2026-10-14 20:28:55KST까지로자동실행없음/만료이력화면미제공이다.
- 확인방법: [WSL 개발 화면](https://172.27.253.53:3770/)→재인증→`Anvil WSL 개발 / WSL 개발 환경`→`승인 요청 대기` 전체1건→`요청 목록` 펼쳐Task/계획/요청ID·만료시각확인. Chromium151에서API count·ID·planhash와 DOM count·ID·만료 대조·7d/1d·재조회·다른조합403/logout401·선택본문8secretCLEAR/sameorigin을확인했다. 만료후0은현재유효요청이없다는뜻이며성공승인/전체U01인수가아니다. 등록QA4경로/3container/5555port와localtemp는독립잔여0·hostimage/정상Task/원장/감사·root0600proof3는보존한다. 기존empty검증과아래배포내용은당시사실로남긴다.

- 실제 승인 요청 원장 반영: source `f03348ac680e624ee0ca41e2b97ca07b38aff677`(C20), manifest Git `8586eaa8052cfb46ffbafead8084b424a0365b27`(M20), `deploy/wsl/U01ApprovalRequestLedgerReleaseManifest.json`. API ID `a773c348b7c7111cff7a8a9165c09fa122b09b4685337a34126da067112723aa`/image `sha256:9938508bcdff673ed1dcb47f2f7ccedb7c170e0f5cf73ada6ee1086130e7b9c5`, Web ID `ccaf91d5dc99729be1b0aa1709866a4af01d119dbb84d97f710b1afd96bb6e77`/image `sha256:103252ad406f03e52ae2ad1799c9929e7e1ed2f5c96d50fe45ee4054c1069838`. 정식 Git M20 exact/clean·DB `0021_approval_requests`·strict CA ready 확인. 기존65테이블은 적용 직전/직후 schema·data 지문 exact이며 신규4테이블 행0·자동권위부여/승인/Run실행0이다. issuer 기존ID/image·reader권한·Secret/cert·보호파일hash·망정의 불변이며 아래 이전 배포 내용은 역사로 보존한다.
- 화면 확인: 재인증→`Anvil WSL 개발 / WSL 개발 환경` 선택→`승인 요청 대기`의 실제 원장 현재0건/원본·관측시각·빈안내. 7d/1d 변경·다른조합403·실제UI로그아웃/카드제거·세션false/조회401을 Chromium151에서 확인했다. 선택조합 Run0/Queue0이며 전역 DB의 Task1/Run1과 다르다. 첫 browserhelper의 전역/조합 Run 혼동 실패 뒤 실제 scoped read0으로 가정만 교정했고 제품·기존시험 기준은 변경하지 않았다. 선택auth/성공기능본문7 비밀CLEAR/sameorigin·정식비영가짜row0, 정식비영producer는 미검증(격리PG producer10P와 별도)·만료이력공개목록은 미제공·전체R6/U01인수/Release는 미충족이다.
- 복구와 증거: 직전API3c52b542/Web1497bbf9는 각각 `anvil-u01-approval-request-api-rollback-20261014`, `anvil-u01-approval-request-web-rollback-20261014`에 정지·망분리 보존하고 기존rollback5도 보존한다. backup `/srv/anvil-wsl/backups/u01-approval-request-c20-f03348ac` root0700/암호화덤프·키/proof0600을 유지한다. runtime의 approval-request private rollback·migration/config/deployment/browser proof는 root0600이다. 원본dump 자동복원·DBdowngrade 금지, 새 요청/감사 보존이 우선이며 old API로 돌리면0021 readiness불일치 가능성이 있어 roll-forward를 별도 판단한다. 일회migration/env/browser는 정리 marker와 별도 조회로 잔여를 확인한다. 기존 compose.env의 이전 image를 사용해 전체compose up하지 않는다.

- 승인 대기 Run 갱신: source `41f489253b6b4d02369b3db489bae755e02eeb18`(C19), 정식 manifest Git `639992c9e01de2bb151c639e91089c2c1aa31818`(M19), `deploy/wsl/U01WaitingApprovalRunReleaseManifest.json`. 현재 Web ID `1497bbf9b76b319bd82233267f58aebb542e6f21b76685e908e759b0b12b7b41`, image `sha256:467066b6dce412f74766262e60ec9b59b39c660a28fa1b5b5c8d4dbc76b3939b`. 정식 repo M19 detached/clean, APIissuer C15 source/image/ID·DB0020/권한/Secret/cert/망불변. 아래 이전Web 기록은당시사실로보존한다.
- 사용: 새로고침·재인증→개발조합선택→`승인 대기 Run`의수/RunID/원phase·관측시각확인. 실제Run0/대기0·빈안내/7d기간/실제복원/QueueAgent유지/로그아웃카드제거를Chromium151에서확인했다. 이수치는WAITING_APPROVAL인Run관측수이며승인요청객체수/승인처리기능이아니다. genericapprovalPending는UNAVAILABLE유지·실승인요청원장미구현/DC-U01-020, 비영실DB미확인. 대기2/ACTIVE1·escape·clock만료·중복은client반례로분리한다.
- 보존·정리: 직전988cb359는 `anvil-u01-waiting-approval-run-rollback-20261014`에정지망분리보존·이전388/c9/5d/f010불변. runtime root0700에WaitingApproval proof4 root0600/개발복구수명보존. 선택auth/기능본문9비밀CLEAR/sameorigin/oneuse정리·독립부재0·유지서비스3/strictCAready0020확인. 전체Compose재생성/DB합성TaskRun/승인객체쓰기0, 전체R6/U01인수/Release/Oracle/운영은미충족이다.

- Agent 소유권 상태 갱신: source `7967246da7468ee1463ded3665d6e110c878e776`(C18), 정식 manifest Git `fd552dd877151ccb1477700136a967ade66dbcd2`(M18), `deploy/wsl/U01AgentOwnerStatusReleaseManifest.json`. 새 Web ID `988cb3591fc9c61c0476e09984f030e6acff1ce261203d7b15686d310083cd41`, image `sha256:dddc1f7a589e4cf7da0f2a521cc306280f16f6c2015f62d825c2dc9bf0bc09cf`. 정식 repo M18 detached/clean, API/issuer의 C15 source/image/ID·DB0020/권한/Secret/cert/망 설정은 그대로다. 아래 이전 Web 기록은 당시 사실로 보존한다.
- 사용: 재인증→`Anvil WSL 개발 / WSL 개발 환경` 선택→`Agent 소유권 상태`에서 전체·유효(ACTIVE)·만료(EXPIRED)·회수(REVOKED) 및 관측 시각을 본다. 실제 DB 현재0건/API·화면일치·빈안내·30d변경/실제원본복원/로그아웃 뒤카드제거를Chromium151에서확인했다. 상태는관측시점의owner행수이지unique세션/실행Agent/Worker정상수/현재권한이아니다. 동일session복수3상태·동일상태2행·clock만료·invalid는client반례로분리했고실DB비영·개별owner식별은미확인/미구현, WorkerHealth는UNAVAILABLE다.
- 보존: 기존38857059는 `anvil-u01-agent-owner-status-rollback-20261014`로정지·망분리보존, 이전c9f67787/5d6a1f82/f0107aad도보존. root0600 Agent proof4개는기존root0700runtime아래개발복구수명까지유지한다. 선택본문10건비밀CLEAR/sameorigin, 일회성browser정리/독립부재0·유지서비스3/strictCAready0020확인. 기존Compose전체재생성/옛env재배포0·정식DB합성owner0, 전체R6/U01인수/Release/Oracle/운영은미충족이다.

- Queue 작업 목록 갱신: source `17c17e59a016ef007fddc0e71fdcaeebc8251977`(C17), 실제 manifest Git `2ab227a74cee181c607eaa115a4fb124288293dd`(M17), `deploy/wsl/U01QueueItemsReleaseManifest.json`. 새 Web ID `38857059689f441dbe6a52a71bfb76d5d9e3620d17dc14b1d28bb6e883666f29`, image `sha256:f0d91461b391a915f0c1195f9de17ece6bbe8be901e8c15079770786955c8256`. 정식 repo M17 detached/clean, API/issuer는 아래 C15 source/image/ID 그대로다. 이전 M16/currentWeb 기록은 역사로 보존한다.
- 사용: 재인증→조합 선택→현재 `Queue 작업`에서 전체 수/출처/관측시각과 작업 ID·원 상태 목록을 본다. 실제 개발 DB는 현재 0건으로 API·화면 일치를 확인했다. 비영4상태/escape/만료는 client시험으로 구분하며 비영 실제 DB 경로는 미확인이다. 정상 빈 목록과 원본 불완전·5분 만료의 UNAVAILABLE, Queue Health 미연결은 별개이며 `정상`/`대기 수`로 승격하지 않는다. 기간 변경·실제 다시조회·UI로그아웃 뒤 목록 제거를 Chromium151에서 확인했다.
- 복구·보존: 직전 Webc9f67787는 `anvil-u01-queue-items-rollback-20261014`로 정지·네트워크 분리 보존, 앞선 rollback5d6a1f82/f0107aad도 그대로다. 신규 root0600 queue-items proof4개는 기존 root0700 runtime 아래 개발/rollback 수명까지 유지한다. DB/권한/Secret/cert/망 설정·APIissuer ID는 별도 실측으로 보존 확인했고 일회성 browser는 정리·독립부재0이다. 기존 Compose 전체재생성/옛 env 재배포를 하지 말고 최신 manifest/image·현재 exactID 및 보존 컨테이너를 먼저 대조한다. Oracle/운영/전체U01인수·Release는 아직 아니다.

- 로그아웃 UI 갱신: source `d31d1225c297758fe702cedad6760c6748074d92`(C16), 실제 manifest Git `a1b4ccc85e90d0b1b0432bfd3174f993b82c4723`(M16), blob SHA256 `0EFC53C926CB10FC714490FFCD14CB12B2ED82F6762D29EE8E4295DFCDEEC61B`. 새 Web ID `c9f677874802c61a2d5fc74de1f17b9e11cd3489f04d37badb25fffe33b1bac4`, image `sha256:6be9d1a751bfa45a40f7e47c44402eb061923304be75c35f44fb002e199cfb4e`. API/issuer는 아래 C15 image·기존 ID 그대로이며 DB/권한·인증 자료·망 설정은 변경하지 않았다. 정식 repo는 M16 detached/clean이다.
- 사용: 재인증 후 화면 `로그아웃` 버튼으로 현재 세션을 종료한다. 실제 버튼→cookie 삭제·session false·API401·이전 카드 제거·재로그인/조회까지 Chromium151에서 확인했다. 새로고침하면 메모리 CSRF가 없어 `로그아웃하려면 재인증이 필요합니다`를 안내한다. 이때 재인증 후 로그아웃을 다시 누른다. CSRF를 storage에 보관하거나 무CSRF 요청하지 않는다. 기존 API 로그아웃만 확인했던 아래 기록은 과거 사실로 보존한다.
- 갱신·복구: 기존 Web5d6a1f82는 `anvil-u01-logout-rollback-20261014`로 정지·네트워크 연결 해제 상태로 보존했다. Compose가 동일 service label의 renamed old를 삭제하지 않도록 새 Web은 승인 Git profile의 동일 UID/RO/cap/IP/port/bind/env 키값 제약을 exact-ID Docker create로 반영했다. 기존 compose.env의 image를 그대로 사용해 전체 `compose up`하지 않는다. 후속 갱신은 최신 manifest/source·현재 Web ID를 대조해 Web만 갱신하며, rollback은 새 Web만 정확 회수→old 이름/기존2망 IP/alias 연결→start 순서다. API/issuer/DB 재생성·무조건 restore는 하지 않는다.
- 보호 proof: 기존 runtime root0700의 `logout-web-rollback.private.json`(첫 실패 보존), `logout-web-rollback-attempt02.private.json`, `logout-web-config-comparison-attempt02.json`, `logout-deployment-proof.json`, `logout-browser-proof.json`은 root0600. 환경변수 원문 순서는 달라도 중복 없는 전체 키·값은 exact이며 bind/entrypoint/cmd와 보호파일 hash·기존 서비스 ID/망 설정을 비교했다. 첫 중단과 복귀는 최종 성공으로 소급하지 않는다.
- 검증 범위: UI logout·reload CSRF 안내·재인증·client403 실패 안내·선택 body25 비밀보호·same-origin/SecureHttpOnly, 실제 서버 API401/종료·strictCA ready0020. client403은 브라우저 반례로 구분한다. 일회성 browser/configcheck 잔여0과 유지 서비스3/정지 rollback2를 독립 확인했다. 전체 R6·외부 SSO·전체 U01/Oracle/Production 미검증·과거 미진은 유지한다.

- 단계: 로컬·WSL-server 기능 구현. Oracle/ysna/Production/외부 공개는 미실행이며 승인 범위 밖이다. 아래 과거 환경 기록은 당시 사실로 보존한다.
- 화면: `https://172.27.253.53:3770/`. 개발 전용 self-signed 인증서(30일)이므로 브라우저 최초 경고는 이 개발 주소에 한해 확인한다. Windows 전역 CA 설치는 하지 않았다.
- 사용: 화면 아래 `재인증` 버튼으로 개발 테스트 SSO 팝업을 연다. 팝업 허용 후 조합에서 `Anvil WSL 개발 / WSL 개발 환경`을 선택한다. 토큰은900초 개발 한정이며 재인증으로 다시 시작한다. 실제 외부 SSO·사람 인증·운영 계정이 아니다.
- 권한: 고정 `anvil-wsl-development-reader`의 `dashboard:read`와 해당 한 조합만 허용한다. 등록 bootstrap actor에는 OIDC subject binding이 없다. 실제 Provider Secret은 복사하지 않았고 Telegram 설정은 비호출 합성 개발 자료다.
- 실제 확인: Chromium151.0.7922.34/1920×1080에서 재인증 버튼의 실제 팝업 로그인, DB HEALTHY·source/관측시각, BLOCKED/실행 중 Run API→화면 건수 일치, reload 후 재조회, 다른 조합403·CSRF 없는 logout403·정상 API logout/정보 제거를 확인했다. 테스트 조합에 Run은 없어 실제0건이며 가짜 Task/Run을 만들지 않았다. UI logout 버튼은 아직 없으며 API 검증과 구분한다.
- 보안 검증 범위: same-origin 전체 요청, Secure/HttpOnly/Strict cookie, DOM token 미노출, 인증 및 성공한 선택 기능 응답13개의 서버 비밀 미노출. 전체 background body/전체R6·외부SSO·전체U01 인수·PG18은 미검증/과거 실패 유지다.
- Git source `87aa6c5e8edf1e2e890c3cb69a74bdf5f4b94a84`(C15), actual manifest Git `e8da726a949a2a47ee2423bfc1045319a921572b`(M15), blob SHA256 `2BB90C4AC7C29B23DD998B1538412BF77287D3423D88E83161B2DFE9921A148E`. 정식 서버 repo `/srv/anvil-wsl/repo`는 M15 detached/clean이며 제품 이미지는 C15이다. Windows source 복사·서버 제품 patch0.
- 정식 이미지: Web `sha256:7a10d7e39c085e256c648899435ca09ba13515fbc394896e008a38e0410d9da6`, API `sha256:b0872180e6e72f06af00d7fc8f359fe2113fc5131a21fc6eba8d2c592e3d1f89`, issuer `sha256:cefb8b27a23bbb665e09a16bc3256e8db08e4f31e4c1fd0171273606a390f8f5`.
- 정식 컨테이너: `anvil-web` ID5d6a1f82…, `anvil-u01-development-api-1` ID3c52b542…, `anvil-u01-development-oidc-issuer-1` IDe2667673…. Web만 privateIP3770 HTTPS 게시, API/issuer 외부 port0. Anvil internal망 `anvil-u01-development-runtime` ID9b1487ca…·172.30.94.0/24·Web172.30.94.10; 공유 `proxy-network` 설정은 불변이다.
- 실행 도구: root는 Compose plugin 대신 기존 root0755 `/usr/local/bin/docker-compose` v5.1.1을 사용한다. source Compose `deploy/wsl/compose.u01-development.yml`, private env/인증자료 `/srv/anvil-wsl/runtime/u01-development-20261014` root0700·UID별0400 개별RO mount. 기존 `/srv/anvil-wsl/.env`와 SSH/Git/전역 인증 설정은 변경하지 않았다.
- DB: 기존 `anvil`/PG15.18에 승인된0013→0020을 적용했다. 원본50테이블의 이전컬럼 값·행수 fingerprint `A64D6369CD4E7180466B0C83E1F98E09FFDC586639DC3C2AF484C1BAEDF16942`가 백업·실제 복원·복원본0020·원본0020 뒤 모두 동일하다. 새 QA 등록은 정상 repository와 명시적 fixed identity를 사용하며 기존행 overwrite·임의 backfill0이다.
- 백업: `/srv/anvil-wsl/backups/u01-development-20261014-4b75c87f/attempt04` root0700/파일0600, 암호화 dump hash `F879160CD7357E08225FC569B5068DCF726715C30C895FD68AE15358B1061A08`; key/config 값은 문서·Git·로그에 없다. 앞선 실패 자료도 보호 상태로 보존한다. 복원용 PG15.18 image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`는 복구 기간 유지한다.
- 복구: 기존 ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`·image `sha256:c0254177b858d93457585d2c268f43b3386ca20c18a47e4af9460174320488e9`를 `anvil-u01-rollback-f0107aad-20261014`로 정지 보존했다. 새 컨테이너의 exact ID/image/project/service/port/mount를 확인한 뒤에만 회수하고, 원 DB 복구는 새 사용자 데이터 유무·기존컬럼 불변·검증된 백업을 먼저 대조한다. 옛 이미지를 새0020 DB에 무검증 재시작하거나 무조건 dump restore하지 않는다.
- 일회성 restore PG/net/dbcheck/dump/material-check/browser 자원은 종료·정리됐다. 정식3서비스/Anvil internal망·private runtime/backup·old rollback은 목적이 있는 유지 자원이다. 전체 U-01/Release 완료를 뜻하지 않는다.

# 2026-09-06 C-21 Provider Git-only 후보 결박 (seq530)

- 현재 로컬 source는 a6dca0da5a37e64491e91813895268e78ecb78b2(exact107), parent는 e4cccf3ce99e29005103cea3bd76fa0eede36f28이며 후속 control은 single direct-child exact12 / 누적 exact109 계약이다.
- candidate ref는 refs/remotes/origin/candidates/c21-wsl-exact107이며 이 작업에서 아직 게시하지 않았다. runtime guard는 BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE / exit22로 외부 실행을 차단한다.
- Windows 검증은 PATH 선두 C:/Program Files/Git/usr/bin, PYTHONUTF8=1, TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1을 사용한다. WindowsApps/bash.exe app alias는 사용하지 않는다. 테스트가 생성하는 Unix fixture는 LF로 고정한다.
- 아래 seq495 실제 WSL 증거는 당시 후보에 대한 역사 기록이다. 이번 candidate의 실제 WSL/Docker/DB/Provider/Telegram/ysna/main/commit/push는 NOT_EXECUTED다.

# 2026-09-05 C-21 WSL 실제 실행 상태 (seq495)

- 이 항목은 아래의 과거 준비/부분검증 기록을 삭제하거나 소급 수정하지 않고 후속 실행 사실만 추가한다.
- WSL Test/Staging에서 candidate `a342d62391a44b349733d1468ac3b180761155ab`의 PG15/PG18RC deploy·verify 2회, genuine `324eb169fedbce958d2e8cc29362deb7af433677` application rollback과 독립 관찰, candidate 복귀가 PASS다.
- cleanup 후 exact Compose project container/network/volume residue는 `0/0/0`; application current=candidate, previous=runtime324, checkout clean이다.
- `.env`는 mode 600/owner root/content unchanged이며 Secret 원문을 기록하지 않았다. Telegram·Provider·ysna·browser Network는 실행하지 않았다.

# Anvil 개발환경

> 2026-09-25 현재 작업계획 범위: 로컬 Windows에서 개발하고 승인 Git remote에 push한 정확한 commit을 `ssh WSL-server`가 Git으로 수신해 Test/Staging 및 별도 격리 운영 유사 검증에 사용한다. `ysna-server`/공개 운영 도메인·운영 DB·Production 배포/실측은 현재 계획 밖이다. 이 문서 아래의 과거 운영·ysna 기록은 역사적 증거이며 현재 작업 지시로 재활성화하지 않는다.

## seq494 로컬 검증 마감 / 2026-09-05

- 담당: Main 어울 관리, pg18_binding_resume 구현 후 seq494_local_finish가 단일 writer 인수. candidate a342d62391a44b349733d1468ac3b180761155ab, candidate56 / record12 / 누적58. Main의 최종 문서 검토·record commit·clean postcommit 검증은 아직 전이며 외부 실행은 하지 않는다.
- tooling 전체 139 PASS/471.73s/exit0은 직전 writer의 실제 결과를 Main에게서 인수했으며 중복 실행하지 않았다. 기존 harness session8103 최종 결과는 세션 소실로 미확인이고 제품 실패나 PASS로 계상하지 않는다.
- 인수 후 frozen harness만 1회 재실행: session96554, 80 PASS / 1 Compose parser SKIP / 428.42s / exit0. stdout·exit는 D:/tmp/anvil-seq494-harness-resume-6fa1d981bdb54491a32aab02a9375c66에 보존했다. SKIP는 로컬 parser 환경 한계이며 실제 WSL 검증 성공이 아니다. 프로세스 확인이 실행 후 이뤄진 인수 절차 누락은 기록했고 이전 suite 잔존 없이 현재 launcher/worker 한 쌍만 확인했다.
- Main 독립 B 검증: I1 보완 직전 핵심 Git/public READY/ABA 4 PASS/53.45s/exit0(session34066), 보완 후 runtime_next_action coherent 변조 거부 1 PASS/7.03s/exit0(session67752). Reviewer I1 해소 후 SPEC PASS / QUALITY APPROVED, Critical 0 / Important 0. 전체 검증 후 문서 마감 검토는 별도다.
- 정상 exact HOLD는 PASS하고 임의 dispatch·다른 HOLD·빈 문자열·필드 누락은 FAIL하는 계약을 유지한다. event494 canonical SHA 644592AE2E1FE61A074455358F786BC84AE4BA28D71D1EEF3AF87154B02314D2, derived2320 bytes/hash2A57298FA53B8D16AA399DEB9DE695620A20581B5FA85845B4C0EEE573647BE6 및 seq1~493·기존 approval/evidence는 변경하지 않는다.
- READY는 기술 준비 상태일 뿐 dispatch 허가가 아니다. runtime_next_action은 HOLD_EXTERNAL_EXECUTION_PENDING_SCOPE_RECONFIRMATION_AFTER_LOCAL_SEQ494_COMMIT 그대로다. private push·WSL·DB·실제 rollback/cleanup·Provider·Telegram·ysna·main 병합은 하지 않았다. 다음은 로컬 기록 마감 후 정확한 candidate/control/ref 및 실행 범위에 대한 외부 재개 조건 확인이다.

### 아래는 준비 당시의 누적 기록



## seq494 승인된 WSL QA 재개 사전 checkpoint / 2026-09-05

- Main 관리·단일 writer pg18_binding_resume. candidate `a342d62391a44b349733d1468ac3b180761155ab` / parent `ad3355baf0aa94da27b8cb6b5ee5a90215ee5994`, correction2 / candidate56 / record12 / post58. 기존 seq1~493·승인 원문·historical evidence 보존. 새 인간 승인을 작성하지 않고 기존 cleanup·ingress 승인 및 WI `52AA197F724F1D0AB59F061D187EFE3744ED86AFC52E5E504DA0E26C4BE04FF8`를 `MAIN_RESUMED_APPROVED_WSL_QA` derived로 연결한다.
- A 로컬 제품 검증: Producer focused7 PASS/22.23s, full76 PASS/1 Compose parser SKIP/363.15s(exit0), Main 독립7 PASS/35.19s, review SPEC PASS/QUALITY APPROVED C0/I0. B seq494 결박·전체 public READY 테스트는 아직 미실행이며 A helper 성공으로 대체하지 않는다.
- `READY_FOR_APPROVED_WSL_QA`는 기술적 준비 상태일 뿐 현재 실행 dispatch 권한이나 배포 성공이 아니다. 최신 PMO 지시는 이번 범위를 로컬 B494 검토·commit·clean postcommit까지만 제한했다. private push·WSL·DB·rollback·cleanup을 실행하지 않고 완료 후 외부 범위를 재확인한다. 현재 후보 push·배포·DB·실제 rollback·cleanup은 NOT_EXECUTED. Main의 predecessor3ref atomic FF push 및 Reviewer fresh clone/content validator/fsck0/residue0만 별도 확인됨. 실제 WSL은324/control3f52이며 ccf/5f8 배포 성공으로 기록하지 않는다.
- 기존 `.env` root:600과 `/srv/anvil-wsl/repo` root 소유권을 보존한다. 아래 자원·실행·정리 목록은 후속 외부 범위 재확인용 사전 계획이며 이번에는 실행하지 않는다. 후속 실행이 허용된 경우에만 Git-only candidate exact56와 그 direct-child control 및 raw manifest/action checksum을 검증한 뒤 Main이 bootstrap/control-runtime을 호출한다. bootstrap/control-runtime은 검증 전에도 제어 checkout·lock/active 경로를 만들 수 있어 read-only 검사로 부르지 않는다.
- 승인 자원: 프로젝트 `anvil-wsl-pg15`, `anvil-wsl-pg18rc`; 각 `anvil-db`, `anvil-web`, `anvil-ingress`(최대6 컨테이너). 기존 internal망 `anvil-wsl-pg15_anvil-wsl`, `anvil-wsl-pg18rc_anvil-wsl`은 internal=true. 승인 ingress-only non-internal망 `anvil-wsl-pg15_anvil-ingress`, `anvil-wsl-pg18rc_anvil-ingress` 두개는 ingress만 연결한다. app/DB outbound는 계속 차단한다.
- ingress image `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, user101/read-only/cap-drop ALL/no-new-privileges/tmpfs16m. `127.0.0.1:4770`, `127.0.0.1:4870` → ingress8080 → web3770, 원 Host/SSE 유지. ysna의 anvil-web:3770 단일 런타임이나 임시 UI Preview와 무관한 WSL 전용 QA ingress다.
- DB 볼륨은 `anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data` 두개만. PG15 mount `/var/lib/postgresql/data`, PG18RC mount `/var/lib/postgresql`. project/service/environment/cleanup-scope labels exact 및 anonymous volume0을 Main이 실측한다. 기존 PG15/18 image와 app image324 상태는 이전 read-only 증거이며 새 배포로 간주하지 않는다.
- 수명: C-21 WSL 검증 동안만 사용하고 성공 증거·복구 자료 보존 후 정리한다. Main 실행 순서는 pinned `control-runtime.sh deploy a342d62391a44b349733d1468ac3b180761155ab` → verify → genuine previous324 rollback → 실제 image/current/health/SSE/DB 독립 관측 → 후보 재배포·verify → cleanup. 각 action에 immutable control SHA/raw manifest/action checksum을 전달한다. rollback approved_commits는 `[candidate,324]`만 허용한다. 이전 dump/receipt는 재배포로 갱신되기 전 별도 보존한다.
- 정리 명령은 검증된 control의 `control-runtime.sh cleanup a342d62391a44b349733d1468ac3b180761155ab`(내부 cleanup.sh)이며, 양 프로젝트 label allowlist를 모두 확인한 뒤 서비스3종·비어 있는 전용망4개·지정 볼륨2개만 제거한다. 이미 없는 자원은 idempotent 처리하고 unrelated 자원/기존 `.env`/자료는 보존한다. Main 최종 Docker inspect/list로 지정 container/network/volume 및 restore scratch DB/cookie 잔류0을 검증한다. 실패 시 부분 상태를 각각 기록하고 전체 PASS를 선언하지 않는다.
- Telegram·Provider 실제 호출, ysna 실행, main 병합 제외. C-21 실제 검증 결과 후에만 별도 결과 event를 append하고 C-01은 독립 판정까지 차단한다. B finalizer는 현재 HEAD와 historical bytes를 검증하며 같은494 event만 재결박하고 다른494는 덮어쓰지 않는다.



## seq493 로컬 결박 검증 완료 / 2026-09-05

- 최종 producer 전체 tooling130 PASS/445.50s, harness69 PASS/1 Compose parser SKIP/399.44s(exit0, 각1회). Main 독립 critical3 PASS/36.72s와 historical raw239파일 감사 PASS, reviewer archive402/기존 validator AST 보존 PASS. 이는 로컬 개발·기록 검증이며 이번 WSL/서버 실행 결과가 아니다.
- 현재 local candidate5f8c301/parent48fbad8를 seq493 exact12로 결박했다. 실제 잔류 runtime324eb169/control3f52d26 및 이전 미배포 candidateccf5109/control48fbad8는 서로 다르다. 로컬 I-3 보완 완료와 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`/public guard22를 함께 유지한다.
- 같은 생성기+finalizer 재실행 결과12파일 hash 동일/이벤트493 byte 불변(exit0). 최종 Main 기록 검토에 인계하며 외부 push/merge/배포/DB/rollback/cleanup/Telegram/Provider는 하지 않았다.

### 아래는 seq493 준비 시점의 누적 상태

- 담당: Main 어울 관리, 단일 writer pg18_binding_resume. 제품 후보 `5f8c301e18c332e3353092dab9efe5c32d0fda84`, parent `48fbad8be35c7e826dd31363464c7c477d9ca9e8`, correction exact2. 내부 기록 예상 exact12, validated base 누적 candidate54 / record 후56.
- I-3 rollback approved_commits membership 누락은 기존 승인 계약의 제품 구현 결함으로 보완됐다. Producer focused10 PASS(21.78s), 전체 harness69 PASS/1 parser SKIP(346.77s, exit0), Main 독립 focused10 PASS(25.19s), SPEC PASS/QUALITY APPROVED는 로컬 제품 증거다. 새 seq493 결박 테스트는 아직 미완료이며 이전 결과로 대신하지 않는다.
- 직전 로컬 ccf5109 candidate/48fbad8 control은 미push·미배포. 실제 WSL 잔류는 candidate324eb169/control3f52d26이며 보조 internal transport의 API·SSE·Last-Event-ID·backup/restore 성공과 정식 localhost ingress 실패는 과거 증거 그대로 유지한다.
- 현재 gate는 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`. public guard는 고정 exit22로 실행을 거부한다. 제품 I-3의 로컬 보완과 외부 실행 허용은 별개이며 이번 기록 범위에서 push/merge/배포/실제 rollback/cleanup/DB/Telegram/Provider를 수행하지 않는다. C-21 완료나 C-01 시작으로 승격하지 않는다.
- 기존 seq1~492와 historical evidence/approval 원문은 보존하며 seq493 이벤트 단1개만 append한다. cleanup·ingress human approval hash를 유지하고 seq492 derived hash를 부모로 새 내부 구현 수정 binding을 연결한다. 원격 관측은 09:59의 3f52/324 확인이며 새 원격 관측으로 표현하지 않는다.
- 다음: seq493 정적 원문 검토 → focused RED/GREEN → tooling/harness 각1회 → checksum/계보/변조 거부 확인 및 Main 검토. 서버·네트워크·Secret 변경은 없다.


## 2026-09-05 seq492 최신 checkpoint

- 실제 WSL deployed candidate/control은 `324eb169fedbce958d2e8cc29362deb7af433677` / `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`다. PG15/PG18 migration 및 internal-bridge 보조 API/SSE/restore는 확인했지만 canonical host ingress/실제 rollback은 미완료다.
- local ingress 제품 후보는 `ccf5109d0640bf28c461e7754ad56e0821fd77be`, seq492 record 결박 대상이며 아직 push·배포하지 않았다. 기존 제품 review PASS 이후 I-3 rollback allowlist 누락이 발견되어 현재 `BLOCKED_IMPORTANT_I3`다.
- 새 control guard는 binding PASS와 runtime 허용을 분리하고 runtime 진입을 exit22로 거부한다. 실제 cleanup.sh 격리 fixture에서 Docker·파일 side effect0을 확인했으며 실제 서버 cleanup을 수행한 것은 아니다. 제품 rollback 보완 승인·검증 전 deploy/rollback/cleanup을 하지 않는다.
- 아래 과거 단계 설명과 당시 증거는 역사 기록으로 보존하며 위 최신 checkpoint를 현재 상태로 적용한다.

## Git 저장소 역할

- canonical Windows repository: `D:\Project\Anvil`
- 현재 C-21 worktree: `D:\tmp\anvil-c21-operational-execution`
- private development repository: `git@github-sinsan-develop:sinsan-develop/Anvil.git` (브라우저에서 Private 생성 확인)
- temporary `development` remote access: `VERIFIED`
- local remote 현황: `development`는 위 private Git SSH URL, `origin`은 아래 official HTTPS URL이다. remote 이름 전환은 아직 하지 않았다.
- latest private candidate ref: `candidates/c21-wsl-exact48` → `324eb169fedbce958d2e8cc29362deb7af433677`; control ref: `codex/c21-operational-execution` → `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`. Main push·fresh recovery PASS 및 로컬 development remote-tracking ref 대조 완료.
- 승인된 개발·테스트 범위의 private push는 Main이 검증 후 자동 진행한다. 이전 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`는 이미 해소된 과거 상태다.
- official release repository: `https://github.com/cyhuh7950/anvil.git`
- 전환 목표: private development=`origin`, official release=`release`
- official 저장소에는 실제 배포 allowlist만 clean RC branch로 반영하며 private 전체 history를 mirror하지 않는다.
- official main 직접 push, history rewrite, force push는 금지한다.

## WSL 개발 화면 반영 계획 / 2026-10-14

현재대화의 신산님 직접승인으로 기존 `anvil` 개발DB 백업·0013→0020 갱신과 테스트로그인·HTTPS/포트3770 연결을 진행한다. 승인/WI는 `APPROVAL-20261014-U01-WSL-DEVELOPMENT-RUNTIME-001.md` / `U-01_WSL_DEVELOPMENT_RUNTIME_WORK_INSTRUCTION.md`. 아래는 생성/전환 전 계획이지 완료 기록이 아니다.

정식 source는 기존 `/srv/anvil-wsl/repo`의 Git exact C15·사설 기존branch, source를 Windows에서복사하지않는다. 기존 `/srv/anvil-wsl/.env`·원데이터·currentimagec025와container복구수단을보존한다. backup root `/srv/anvil-wsl/backups/u01-development-20261014-4b75c87f` root0700/파일0600·암호화/키·복원비교, runtime `/srv/anvil-wsl/runtime/u01-development-20261014` private자료/cert/trust/env/actualmanifest. 둘은개발배포/복구자료수명으로보존, source/Git/보고서에비밀값0.

계획 서비스 `anvil-web`(기존전환·privateHTTPS3770), `anvil-u01-api`(internal3770), `anvil-u01-issuer`(internal8302)와 Anvil전용internal망 `anvil-u01-development-runtime`; 기존proxy-network설정/다른서비스수정0. 신규readonly QA계정/조합만권한부여하며외부SSO/운영인증아님. 처음테스트HTTPS 인증서경고가능·Windows전역CA자동설치0. 기존서비스는backup/복원·복사본migration/data보존확인전전환하지않는다. 일회성 restore/migration 자원literal은생성전에추가등록하고목적종료즉시정리/잔여0한다. 정확source/image/manifest·현재privateIP·owner/port/link·oldbackup tuple이확정되지않으면추측해실행하지않는다.

## WSL-server

- 역할: Anvil 개발·통합 QA/Test-Staging. ysna-server와 anvil.sinsan.kr는 별도 운영 전환 선언 전까지 사용자 인수검증 staging이다.
- SSH alias: `WSL-server`
- GitHub SSH alias: `github-sinsan-develop`. 신산님이 등록했다고 알린 기존 WSL key의 인증·private Git 읽기를 Main이 확인했다. 새 key 생성·등록은 필요하지 않으며 수행하지 않는다.
- repository-level read-only deploy key 속성은 독립 확인되지 않았다. 실제 인증 성공과 해당 권한 속성을 구분한다. root 실행에서 alias context가 필요한 경우 기존 key를 사용한 명시적 HostName github.com 옵션으로 처리했다.
- Windows private key를 WSL-server로 복사하지 않는다.
- 실제 endpoint, 사용자, key 원문과 Secret은 이 문서와 Git에 기록하지 않는다.

## C-21 현재 검증 기준

- candidate implementation: `324eb169fedbce958d2e8cc29362deb7af433677`; control `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`.
- 위 clean checkpoint의 local checker PASS sequence491. 이후 현재 현황/ingress 보완 문서·제품 변경은 아직 seq492 재결박 전이므로 과거 checker PASS를 현재 dirty 전체의 PASS로 사용하지 않는다.
- 관련 tooling6 PASS, harness48개 node PASS. PyYAML parser1개 skip은 Main WSL Compose 실제 두 target config 검증으로 별도 보완했다.
- 실제 PG15.19/PG18rc1 startup, named volume 각1개/anonymous0, migration `0013_task_bootstrap_authority` PASS.
- Main 보조 internal transport 실행 exit0: 두 target authenticated SSE·Last-Event-ID·same-origin API contract·backupRestore PASS. host loopback publish는 실패하여 정식 verify.sh/브라우저 ingress는 미충족이다.
- rollback은 previous image 기록 부재로 preflight에서 무변경 종료했다. 실제 application rollback은 아직 미검증이다.
- 2026-09-05 신산님이 WSL QA nginx ingress-only non-internal망 예외와 구현·검증을 승인했다. app/DB는 기존 internal망만 유지한다. ingress 자체 outbound 능력과 실제 외부호출 금지는 별개이며 실제 Provider·Telegram 호출/credential 사용은 계속 금지한다.
- ingress image 기준: Main이 기존 WSL image를 read-only 확인한 `nginx:1.28.3-alpine3.23`, exact `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, linux/amd64.
- WSL runtime root `/srv/anvil-wsl`, `.env`는 기존 서버 전용 파일 그대로 보존한다. candidate repository `/srv/anvil-wsl/repo`, control physical stage `/srv/anvil-wsl/control/stage.*`는 Git exact SHA로만 갱신한다.
- Telegram·Provider 실제 호출은 이번 C-21 WSL 검증에서 제외한다.

## Rollback

- remote 전환 전 기존 공식 URL과 refs를 보존한다.
- private remote 또는 SSH 검증 실패 시 기존 공식 remote 설정을 변경하지 않고 추가 remote만 제거해 원상 복귀한다.
- canonical root의 dirty/untracked 자료는 전환과 무관하게 보존한다.

### C-21 Provider WSL Git-only candidate local binding

- source=`a6dca0da5a37e64491e91813895268e78ecb78b2`, parent=`e4cccf3ce99e29005103cea3bd76fa0eede36f28`, candidate ref=`refs/remotes/origin/candidates/c21-wsl-exact107`이다.
- guard는 manifest Git blob checksum, source/control single direct-child, exact path hash, branch/upstream, clean tree를 fail-closed로 요구한다.
- 이 local Git-only binding은 push/WSL/Docker/DB/Provider/Telegram/ysna/main 실행 권한이 아니며 runtime gate는 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`다.
# C-21 Provider WSL execution-resume 준비 (2026-09-06)

- `d442d4584516e1a673fd2edde55a2fe1330e9394` 이후 exact14 control successor만 준비한다.
- 실행 대상은 기존 `WSL_SERVER_TEST_STAGING`, PostgreSQL 15 및 격리 PostgreSQL 18 RC다.
- 실제 runtime dispatch는 K direct-child commit과 Main exact binding 후에만 허용한다.
- 이 준비 단계에서는 WSL/Docker/DB/Provider/Telegram/ysna를 실행하지 않는다.
# C-21 seq542 WSL exact runtime binding

- Local push authority: remote `development` → `git@github-sinsan-develop:sinsan-develop/Anvil.git`.
- WSL fresh clone/fetch authority: remote `origin` → 같은 private Git URL. public origin은 push authority가 아니다.
- Application repository: `/srv/anvil-wsl/repo`, clean detached 상태.
- Observed initial tuple: HEAD/current `a342d62391a44b349733d1468ac3b180761155ab`, previous `324eb169fedbce958d2e8cc29362deb7af433677`.
- Candidate tuple: HEAD/current `a6dca0da5a37e64491e91813895268e78ecb78b2`, previous `324eb169fedbce958d2e8cc29362deb7af433677`.
- Rolled-back tuple: HEAD `a6dca0da5a37e64491e91813895268e78ecb78b2`, current/previous `324eb169fedbce958d2e8cc29362deb7af433677`.
- 위 tuple 및 필요한 image revision이 다르면 deploy/verify/rollback mutation 전에 중단한다.
# C-21 Workbench UI WSL Git-only candidate

- candidate source: `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- private candidate ref: `refs/heads/candidates/c21-wsl-exact187`
- private control CAS expected-old: `8d043e39f6066283821abe47b36fa83e5ecff8b5`
- 현재 단계: `GIT_ONLY_CANDIDATE_BOUND_PENDING_PRIVATE_ATOMIC_CAS`
- WSL 실행 전 새 candidate/control ref의 atomic CAS 게시와 재조회가 필수다.
- 실제 Provider 및 Telegram 실행은 이 후보의 검증 범위에서 제외한다.
