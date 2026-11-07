# FN18 새 package 실행 제한·ASAR 무결성 source 보완

2026-11-02 / Main 어울 / 기존 FN18·TM09/TM11·INTERFACES §14.3 구현 상세 / SOURCE·합성검증

## 1. 근거·Main 판단

WORK_PLAN의 FN18과 설계 Windows 설치형·THREAT_MODEL TM09/TM11·INTERFACES §14.3은 목적별 IPC/renderer 격리와 package 출처·무결성·구성된 신뢰/서명 기준을 요구한다. 현재 forge.config.cjs는 asar:true/SDK prePackage만 있고 fuse 정책이 없다. main.cjs의unsafe argv 거절은 Electron 자체의Node 환경/inspect 기능이 시작되기 전의 보호를 대신하지 못한다.

이번은 그 기존 요구의 package 생산·검산 구현이다. 공개HTTP/사용자권한/키·신뢰root/보호저장형식/서버자료계약·실제실행허가를 새로 채택하지 않는다. 악성동일사용자·메인코드주입 전체를 새 필수gate로 추가하지 않고, 이것을 방어완료라고도 하지 않는다. nativeowner admission 최초신뢰점·실행중 코드/peer/caller·recipientACK는 별도 미구현/미정이며 fuse검산만으로 VERIFIED_PREPARATION_SUPPORTED/실제OPEN을 열지 않는다.

공식근거: https://www.electronjs.org/docs/latest/tutorial/fuses · https://www.electronjs.org/docs/latest/tutorial/asar-integrity · https://www.electronforge.io/config/plugins/fuses . ASAR integrity는 Windows>=30, 현 Forge/Packager는 header hash를 산출하며 fuse 활성화가 필요하다. 새builder/SDK교체0이다. source 대조의 기존 Electron45.1.0/Forge8.0.1/Packager20.3.0/ASAR4.3.1을 유지한다.

## 2. 정확7경로·단일writer

기존 Primary만 다음7경로를 소유한다. Main 제품쓰기0·기존 Reviewer 읽기. 새agent/chat/branch/예약0.

1. apps/desktop/package.json
2. apps/desktop/package-lock.json
3. apps/desktop/forge.config.cjs
4. 신규 apps/desktop/scripts/verify-package-hardening.cjs
5. apps/desktop/scripts/make-installer-development.cjs
6. 신규 tests/desktop/package-hardening.test.cjs
7. tests/desktop/installer-development.test.cjs — 실제로 바뀐 source/tool pin·config/소비선만 최소보완. 기존 fixture bytes/판정 기준은 유지.

기존 forge.installer-development.config의base spread·SDK scripts/ZIP/.cache/sdk-dist·과거artifact/PE·ZIP fixture·서명·원실행안/영수증·보호untracked3는 수정/복구/삭제하지 않는다. root package/lock·다른자료수정0. 추가경로/의존성버전변경이 필요하면 Main에게 정확충돌을 반환한다. commit/push/docs쓰기는 Main이 한다.

## 3. 구현 계약

- 기존 Forge 기본config에 공식 FusesPlugin을 넣고 RunAsNode=false, EnableNodeOptionsEnvironmentVariable=false, EnableNodeCliInspectArguments=false, EnableEmbeddedAsarIntegrityValidation=true, OnlyLoadAppFromAsar=true의5개를 정확히 고정한다. 다른fuse/실제cookie/Secret설정을 임의변경0이다. 기존SDK prePackage/asar/이름/offlineZIP/prune·기본설정/현재unsafeArg거절·rendererIPC는 보존한다. 개발installer config도 같은플러그인/검산hook을 상속해야 하며 새로운debug우회0이다. rawSDK 원본을바꾸지 않고 새package 복사본에만 plugin이 적용된다.
- 의존성은 공식metadata로 확인한 @electron-forge/plugin-fuses=8.0.1(SHA512 H1mbQgRfyWkudz4nsDWVOXK15DodVYIKNXGmR+OZJhSBQTirLWlPYqG+JR3OnnDtdSklb/nsllogh2SGt151VA==), @electron/fuses=2.1.3(SHA512 LoKJUXNiJ4JM8IIrUltSHI+8pkogaGj5wmJx81jE/Wk3g2w1/kfMbTEKNoY5kitGE8hiC12h32R/1SlywFtxXg==)를 desktop devDependency로 exact고정한다. plugin은 fuses ^2.1.3 peer, Node>=22.13.0/22.12.0이며현Node24.22.1과정합한다. verifier가직접사용하면 이미lock에있는 @electron/asar=4.3.1, resedit=2.0.3을동일버전direct devDependency로명시가능하다. 기존모든version/resolved/integrity는보존하고새2패키지/루트direct승격외불필요한lock재계산을하지않는다. Packager/ASAR/resedit의설치source를확인해정확export/API를소비한다.
- 새 verifier는 포장된 Anvil.exe의5fuse와 resources/app.asar 및 Windows 내장 Integrity/ElectronAsar 자료를 읽기만 대조한다. flags만으로무결성완료를판정0이다. 정확고정ASAR경로/sha256/유일정상resource·원ASARheader hash/필요한형식과생산자버전·중복/확장/오염/깨진PE/UTF8/과대/링크·경로이탈/읽기중교체를기존유한file/total한도에서검사한다. 현재Packager20.3.0 resedit.js의producer와 ASAR4.3.1 getRawHeader를직접대조하며새PEparser/빌더를무작정직접재작성하지않는다. 부재/불일치는닫힌고정오류·native권위0이다. 실제파일/프로세스를독점/인증했다고주장하지않는다.
- 새검산을Forge package완료와bounded maker의실제소비앞에연결한다. 검산실패/불명에서는maker/installer제작호출0이다. source/toolFiles에는실제로추가사용한verifier/시험·plugin/fuses/필요parser runtime파일을기존pin방식으로포함하며, 새모듈을검증하기전임의실행하지않는다. 기존Plan/manifest 외부형식·역사검증/영수증은보존한다. 과거실행안은새source/tool pin과맞지않으므로재사용하지않는다.
- 기존 INSTALLER_NATIVE_ISOLATION_NOT_VERIFIED/default actualbuild 차단은 유지한다. 새서명·CA·인증서·runtime trustrecord·nativeconsumer등록·supported상태·실제설치/업데이트/배포를생산하지않는다. 결과는 package시점설정/관측source이며사용자보안인수·nativeadmission성공이아니다.

## 4. 유한 개발 의존성·시험 자원

신규 전용 D:\tmp\anvil-v3-fn18-fuse-deps-20261102-01(owner FN18/Primary, 공개NPM cache·빈user/global npmrc·로그)와 D:\tmp\anvil-v3-fn18-package-hardening-20261102-01(owner FN18/Primary, 새합성PE/ASAR·시험산출물)만 사용한다. 생성직전부재·절대경로/부모nonlink·owner등록후생성, 생성후최대60분/사용종료즉시소유exact정리·Main별도부재확인이다. 기존SDK/cache/사용자root/실제자료조사0이다. 이WI/WORK_STATUS·commentary사전등록뒤에만생성한다. 표준Node/NPM개발의존성준비·JS시험외 실제Electron/installer/nativehelper/Agent/C#/키/DB/서비스실행0이다.

의존성설치는 source/apps/desktop에서만 npm --ignore-scripts --no-audit --no-fund·고정registry/cache·새빈userconfig/globalconfig를사용해공개무인증으로한정한다. npm ci/전체node_modules삭제/--force/기존SDK다운로더·postinstall/nativeinstall실행0이다. 실제계정config/NPM_TOKEN/PAT/Secret을읽거나전달하지않고자식환경은필수도구/OS항목allowlist만준다. 필요한두패키지만추가하고기존버전·SDK·활용중toolcache를덮지않는다. package-lock-only선확인뒤필요한dev모듈만설치하는방식이며기존의존성변경/예상밖설치스크립트·권한/오류3연속/자원불명은Main에게정확보고·임의우회0이다. 새dependency모듈은정상개발의존성으로보존할수있고일회cache/fixture는정리한다.

새시험용PE/ASAR는공개라이브러리로만든합성bytes로명확히구분하며실행/로드하지않는다. 실제SDK/archive/역사fixture에flipFuses/재패치0이다. 라이브러리실제read/flip코드를시험할경우새소유합성fixture 복사본만대상이며실제품binary patch/packaging이아니다. 테스트중 Anvil.exe/Electron/Setup/Agent를실행하지않는다. 경로·파일수/bytes/시간을유한하게유지하고예상밖파일/미정착프로세스는보존·보고한다.

## 5. 구현·검수

실제Forgeconfig→plugin→새합성package 복사본의fuse생산→새verifier→maker소비앞차단의행동 RED→GREEN을확보한다. getter가임의true를돌려주는대역만으로전체검증완료라고하지않는다. readback은실제라이브러리/새PE·ASAR bytes로대조하고실제OS/loader변조거절은NOT_RUN으로구분한다.

정상/5개각반전·누락/불명wire·PE resource/hash/ASAR변조·다른package/경로/링크·extra/중복·한도·검산실패maker0·config상속·기존SDKhook유지·원source/toolpin거절을변경위험만큼검증한다. 과거fixture는읽기검산만하며새정책전용fixture를추가한다. 기존installer시험은영향범위만, desktop typecheck/구문·root typecheck 필요범위·diff check를선정한다. 같은불변검사반복0이다.

Primary는7SHA/diff·실제명령/exit·RED/준비오류·직접회귀·lock기존버전불변·실제효과제외/미실행·일회자원생성/소유정리·writer반환을제출한다. Main fresh·독립C0/I0·정확source/문서checkpoint/private게시까지진행한다. source복구는정상revert후보,실제설치/키/DB/서비스rollback발생0이다. 전체44업무/실제native지원/사용자인수완료를주장하지않는다.
