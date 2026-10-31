# FN18 개발용 설치 산출물 생성·검산

2026-11-01 / Main 어울 / 기존 Primary 단일 writer

기술 방법 보완: 원 WI2BA0612A의 feature/8경로/실행 제외는 동일하다. Main de19ac에서 고정 Forge core8.0.1 make의 providedForgeConfig/outDir 지원을 실제 코드로 확인했다(make.js SHA ce4eb0ca5ba5f3bf40add373796a81c07bb2dd546e0d77d274827bde795866d5). CLI가 지원하지 않는 별도 config 인자를 전달하지 않고 아래 자체 child entry의 공개 core API로 연결한다. 새 dependency/공개 계약/권한을 추가하는 변경이 아닌 내부 호출 방법 정정이다.

## 1. 기존 계획과 이번 단위

FUNCTION_WORK FN18의 ‘설치 산출물 생성/검증용 환경 시험’과 WORK_PLAN §실행 범위의 ‘제품 코드·패키지 산출물 개발’을 수행한다. TD-01 Electron 선택과 현재 Forge8.0.1/Electron45.1.0을 유지한다. 기존 Shell WI의 installer 제외는 당시 단위의 경계이며 실제 사용자 설치를 새로 허가하는 문구가 아니다.

이번 목표는 **개발용 installer artifact 생성기·검산기와 실제 생성 증거**다. 설치 프로그램 자체를 실행하지 않는다. 산출물은 항상 **NOT_RELEASE / DO_NOT_INSTALL**, 설치·서명 신뢰·안전 업데이트·rollback·제거·동일 서버 로그인·실행기 회수/안전 종료는 미구현 또는 미검증으로 구분한다. artifact 파일이 생겼다고 설치형 제품 또는 FN18을 완료하지 않는다. 기존 기능을 생략해 완료 기준을 낮추는 대체물이 아니라, 남은 FN18 구성요소의 한 단위다.

실제 DB·권한·키/서명 인증서·서비스·Agent·사용자/백업 대상 자료·OS 설치/등록·실제 업데이트/제거·외부 배포는 변경/실행하지 않는다. 기존 Shell main/shell/preload/policy·기존 package 산출물·SDK·userData를 수정하거나 실행하지 않는다. 설치 생명주기/서명·적용 gate는 후속 미완료로 명시한다.

## 2. 정확 허용 8경로

기준 `codex/av3-stage-b` / `ac649dc3aa1de91efcc142ff19534b9b8546a47a`. Main f91e52에서 기존4 지문과 신규4 부재를 확인했다.

| 기존 | 시작 SHA256 |
|---|---|
| apps/desktop/package.json | E36DF197F0F895AB420CEDCF85FF634DD58DA73986A6E930BF9FF5B6E82B4614 |
| apps/desktop/package-lock.json | 59297F90D5106290AC5873EF3211BE29D52EA2730DAC114F4E1354DA0699265B |
| apps/desktop/tsconfig.json | E8992528481E6BC579805BA9CFD7F9EEDE38019B830655F7B71A0A6A51D03724 |
| docs/desktop/README.md | 2BA86475C38CCA7648191E3F0975A4D374B12A34F3DF3874BD6F3E53223BB44D |

신규:

1. apps/desktop/forge.installer-development.config.cjs
2. apps/desktop/scripts/make-installer-development.cjs
3. apps/desktop/scripts/verify-installer-development.cjs
4. tests/desktop/installer-development.test.cjs

기존 forge.config.cjs SHA9236140F5A214FCFC3CD291738C2AF66CA541040C140896210F74ABE0D46EBD4와 root package/lock·제품 main/shell·서버/Web·기존 시험·보호3을 보존한다. tsconfig는 새 config 검사를 포함하는 최소 보완만 한다. 추가 경로/의존성은 실제 필요를 Main에 먼저 제출한다. Main은 제품/시험을 직접 쓰지 않으며 경로는 실제 rg 목록/위 신규 literal만 사용한다.

## 3. 고정 도구와 단계 GO

[Forge 공식 문서](https://www.electronforge.io/config/makers/squirrel.windows)는 Squirrel maker가 Setup.exe/full.nupkg/RELEASES를 생성한다고 정의한다. 생성과 설치를 구분한다. source-out 분리는 Forge의 별도 config `outDir`을 사용하고 기존 out을 덮지 않는다. 기존 공통 packager 설정·SDK 검산 hook을 소비하며 기존 package 명령을 바꾸지 않는다.

새 직접 devDependency는 **@electron-forge/maker-squirrel 8.0.1**만 추가한다. Main bee8e1 공식 registry 관측:

- tarball `https://registry.npmjs.org/@electron-forge/maker-squirrel/-/maker-squirrel-8.0.1.tgz`
- integrity `sha512-V6QrJvvmX2xbITXP1+/bXYe2hkMM7BYnQ8vzVHDOca2P6pn68MZsCSewqm8wiBIBSEeYuRhrztvV8aMlJ5n5Mg==`
- engine Node>=22.13.0. 현 고정 Node24로 충족한다.
- core-utils/maker-base/shared-types8.0.1, optional electron-winstaller ^5.3.0. 범위 표기는 실제 실행 지문이 아니다. lock의 정확 resolved version/integrity·전이 dependency·lifecycle/실행 바이너리를 제출하고 고정한다. latest 자동 추종/기존 Electron·Forge 갱신0.

**단계 A — source/TDD:** 허용8 안에서 구성·생성기·검산기·의미 있는 음성 시험을 구현한다. 초기 부재/import 오류는 제품의 실행 실패 증거로 부풀리지 않는다. 새 output 존재/경계/link·원 artifact hash·manifest/RELEASES·불명 종료 보존 등 행동을 TDD한다. config 없음/잘못된 인자·sign/publish/install 요청은 child 실행 전에 거절한다. 새 module은 strict checkJs/noEmit으로 검사하며 우회 주석/빈 성공0이다.

**단계 B — 의존성 준비:** source와 package/lock 초안을 Main에게 먼저 제출한다. Main이 정확 신규 cache/빈 npm config/수명·정리를 등록하고 GO한 뒤에만 npm lock/install을 수행한다. ignore-scripts·공식 registry·전용 빈 user/global config·유한 시간/용량·허용 환경을 사용한다. root deps/설정·사용자 credential·실제 키/서명 변수 전달0, audit 자동수정0. 기존 SDK는 검증된 local archive를 재사용하며 새 SDK 다운로드/업그레이드0. 전이 lock/출처·native tool hash/실행 경로를 소동결해 제출한다.

**단계 C — 실제 artifact build:** Main source/lock·toolchain 검수와 exact source commit/private 게시, 새 output/tmp의 literal·owner·수명·정리 등록 뒤 별도 Main GO한다. GO 전 native compiler/maker 실행0. build 도구만 실행하며 생성된 Setup.exe/Update.exe·설치된 앱·updater를 기동하지 않는다. source 변경/도구 지문 불일치·기존 output 존재는 실패다. 불명 결과를 자동 재시도하지 않는다. 기본 한도는 의존성 준비10분·실제 build15분, stdout/stderr 각각64KiB, artifact 한 파일1GiB·새 output/tmp 합계4GiB다. 이는 검사/중단 한도이며 OS hard quota를 설정했다는 뜻이 아니다. 무감시 시간·용량 초과를 허용하거나 child 종료 확인 없이 정리하지 않는다.

## 4. 생성기·검산기

- 기존 desktop package identity/런타임/userData·persist:anvil-web 의미는 변경하지 않는다. 새 maker의 이름/파일명은 개발 전용 후보를 구분하고 canonical 제품 설치 identity로 확정하지 않는다. 설치·업데이트 생명주기 처리가 없는 현재 Shell을 ‘설치 지원 완료’로 표시하지 않는다.
- 별도 config는 기존 packager 설정과 local SDK verify hook을 그대로 소비한다. 원 config/기존 out은 보존한다. publishers/remoteReleases/autoUpdater·서명·인증서 옵션을 연결하지 않는다. 새 output은 Main이 등록한 새 빈 경로만 사용하며 검산 없는 `--from-package`/오래된 산출물 재사용0이다.
- entry는 명시 동작만 한다. import/require만으로 다운로드·쓰기·child 실행0. 고정 Node로 허용 make-script 자체의 전용 child 모드를 shell:false/windowsHide로 호출하고, child가 기존 CLI의 dependency로 실제 resolve한 core8.0.1 공개 make API를 별도 forgeConfig/outDir와 함께 소비한다. CLI의 미지원 인자나 기본 config로 fallback하지 않는다. 동적 import는 고정 검산 entry URL만 사용하고 설치 source/lock·모듈 버전/hash 및 실제 API의 config/outDir 소비를 실행 전 검산한다. exports가 막은 package.json subpath를 resolve한다고 가정하지 말고 실제 entry의 제한된 package 범위에서 metadata를 찾는다. 추정 vendor leaf·임의 command/flags·shell 문자열 조립0. child 환경은 Windows/Node 동작에 필요한 allowlist와 등록 tmp/output만 전달하며 signing/token/proxy credential/NODE_OPTIONS를 이어받거나 로그에 출력하지 않는다.
- 작업 root/하위 경계·nonlink/regular/nlink/owner 표식·source/toolchain 지문을 검사한다. 기존 파일을 overwrite/clean하지 않는다. child stdout/stderr는 유한 길이와 비밀 없는 오류 코드로 수집하고 raw user 환경을 기록하지 않는다. 시간/출력/용량 한계와 자식 종료 확인을 갖추며, timeout·종료 불명은 산출물·소유 증거를 보존하고 Main에 보고한다. 공유 process/unknown PID 강제 종료0이다.
- 새 artifact만 생성 후 exact 목록·크기/hash를 재검산한다. Setup의 PE 형식, nupkg의 파일 형식과 RELEASES filename/size/hash 대응을 확인한다. 예상 외 delta/MSI/파일·손상/연결 불일치는 거절한다. 형식/hash 검사는 서명 신뢰나 실제 설치 성공을 증명하지 않는다.
- 생성 manifest는 repo-relative source 목록/hash·정확 source commit·SDK/lock/toolchain·명령/exit·artifact 목록/bytes/hash·유한 관측 시각만 담는다. 절대 source 작업 경로·사용자 환경/Secret를 복사하지 않는다. `releaseStatus:NOT_RELEASE`, `applicationAllowed:false`, 설치 생명주기/서명/실제 설치·업데이트/제거·호환성/복구의 미완료 상태를 명시한다. 다른 산출물의 PASS/정상 설치 flag를 주입할 수 없다.
- runtime 설치/적용 gate를 새로 켜지 않는다. source/신뢰/서명·자료 보존/실행 중 교체·rollback 검증이 미정인 상태는 기존 계약대로 적용 불가다. 현재 단위가 이를 충족했다고 주장하지 않는다.

## 5. 검수·보고

새 시험은 실제 생성/검산 함수와 명시 메모리 FS/child 모델을 사용해 무명령 require, unsafe root·기존 output/링크·tampered source/SDK/lock·허용되지 않은 sign/publish/install/credential, child 실패/불명·산출물 누락/변조·RELEASES 불일치·외부 파일 혼입·NOT_RELEASE 보존을 검사한다. 제어 가능한 fixture를 실제 installer 실행 증거로 승격하지 않는다. disk fixture가 필요하면 생성 전에 Main의 정확 자원 등록을 요청한다.

직접 인접은 기존 desktop shell-policy와 strict typecheck 범위다. Web/DB 전수검사·기존 native 화면/SDK 전체 검사를 코드 불변인데 반복하지 않는다. 새 도구/산출물에 필요한 출처·SDK 검산은 기존 hook을 재사용한다. 실제 build 후 artifact 공급망 검산·자원 회수와 소유 증거를 제출한다. 생성된 후보는 개발용 보존 경로·미지원/미검증을 문서화하되 실행을 안내하지 않는다.

실제 명령·exit·지문/diff·준비 오류/제품 오류·미실행·잔류 resource/live handle과 writer 반환을 보고한다. Main fresh·독립 C/I0 후 소유 파일만 기존 branch에 통합한다. rollback은 source commit 정상 revert와 확인된 새 개발 산출물만의 정확 회수이며 사용자 설치/자료는 변경하지 않는다. 실제 설치·서명·업데이트·안전 종료·FN08/15/16 및 전체 FN18/계획은 별도 미완료로 유지한다.
