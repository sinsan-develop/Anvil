# IX01 TC01 설치 전용 실행 후보

기준: `63eca8358fc3e94eeda0772f4dc59767acd4b8b9`. 상태: **SOURCE_ONLY / 실행 외피 미완성 / 실제 실행 미승인**. 이 문서는 새 설치 전용 실행의 차이와 확정할 항목만 고정한다. 승인 ID·시각·시도·소진 기록 및 미구현 실행 파일 지문을 생성하지 않는다.

## 1. 유지하는 승인과 이번 결정

[조건부 재개안](IX01_CONDITIONAL_RESUMPTION_PLAN.md) §1의 Windows 한정 진단, 부모 외피 SHA256 `44ED1B9A16471E91C334530815DB23BA27643ADCB6D5360A77559B28772978D7`, 부록 실행본문 5,460B/SHA256 `357F720A88251869B322CF2015EC9BFF03B0142C51DDA4472D18CF2ED1C1619E`와 네 source pin은 변경하지 않는다. 기존 승인요청의 효력을 이 문서로 대체하거나 재발급하지 않는다. 해당 진단의 채택·수거는 원 기록으로 판단하며 이 문서는 실행됐다고 가정하지 않는다.

기존 J3 검증 횟수와 0095 역할 생성·회수 승인은 다시 요청하지 않는다. 이번 설치는 J3/0095/0101·PG·Docker·서비스·Agent를 실행하지 않으며, 이후 통합 시험 승인도 대신하지 않는다. 기존 subnet metadata/관측 SSH의 횟수와 60초 의미는 유지하고 그 소진 기록을 설치에 돌려 쓰지 않는다.

결정 범위는 아래 세 차이를 묶은 **새 시도 설치 1회와 사후 목록 후보 수거**다. 현재는 실행 명령/외피와 원 승인 자료가 미완성이므로 이 문서만으로 실행을 요청하거나 시작할 수 없다.

| 차이 | 현재 소스로 고정된 범위 | 실행안 확정 전에 남는 것 |
| --- | --- | --- |
| 새 root/ref·명령·적재 | 아래 namespace, Node/npm recipe, 명시 receiver/native factory | 정확 배포 방식·고정 Linux bootstrap 파일과 SHA, pre-import 적재 closure 및 실제 SSH 명령 SHA |
| 보호 승인·배타 소진·원 입력 | `TC01_DEPENDENCY_PREPARATION`, 시도/HEAD/lock/recipe/source·승인/소진 digest 비교 | 원 승인 파일 위치·닫힌 원문 형상·독립 기대 지문, 같은 감독의 신규 exclusive 기록 및 현재 도구/원 lock 공급 |
| registry 설치·목록 수거 | 설치 최대600초/전체30분, 원 프로세스 출력64KiB, 사후 유한 파일 목록 | 실제 registry 다운로드·새 경로 쓰기와 SSH 1회 채택, 외부 자원/기한 감독과 UNKNOWN 보존 인수 |

## 2. 실제 소비 위치와 실행 명령의 확정 부분

- [receiver:42](../../scripts/qa-fn03-tc01-dependency-carrier-entry.ts) `createTc01DependencyCarrierEntry`: 독립 expected binding 대조 → `takeLockBytes` 원 HEAD/lock 바이트 1회 → 기존 intake. 반환은 같은 시도의 후보 또는 고정 UNKNOWN이다.
- [native:60](../../scripts/qa-fn03-tc01-dependency-native-ports.ts) `createTc01DependencyNativePorts`: 명시 controller 후 실제 Node fs/spawn을 공급한다. `verify:83`, `prepare:87`, `start:92`는 준비 경로·부재·원 신원을 재검산하고 시작한다. 원 child/두 stream을 캡처하고 정상 종결 뒤만 읽기를 연다. 기본 factory 생성 자체는 효과0이다.
- [preparation:50](../../scripts/qa-fn03-tc01-dependency-preparation.ts) → [intake:31](../../scripts/qa-fn03-tc01-dependency-intake.ts) → [evidence:42](../../scripts/qa-fn03-tc01-dependency-evidence.ts): umask 제한, 원 설치 종결·사후 검사 뒤 같은 HEAD/lock의 전체 파일 목록 후보를 만든다.
- [sender:54](../../scripts/qa-fn03-tc01-dependency-carrier-supervisor.ts)와 [wire:86/97](../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts): listener/timer 선등록, 원 stdin finish·stdout end·정상 close 및 정확 binding/정규형 검산을 재사용한다. 실제 SSH 생성/승인 기록 구현은 이 함수들에 없다.

`<attempt>`는 새로 승인된 동일 UUID 자리다. 아래는 경로 관계이며 실행 가능한 상수 치환본이 아니다.

| 역할 | 정확 후보 경로 |
| --- | --- |
| sourceRoot/cwd | `/home/daon/anvil-fn03-tc01-<attempt>-qa` |
| preparationRoot | `/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-<attempt>-dependency-preparation` |
| cache | preparationRoot + `/npm-cache` |
| 빈 설정 2개 | preparationRoot + `/npm-user.conf`, `/npm-global.conf` |
| 계속 부재인 실행 receipt/artifact | `/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-<attempt>`, `/tmp/fn03-tc01-<attempt>` |

고정 application은 `/opt/node-v24.22.1-linux-x64/bin/node`, 첫 argv는 `/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js`다. 이어지는 순서는 `ci`, `--ignore-scripts`, `--no-audit`, `--no-fund`, `--bin-links=false`, `--omit=dev`, `--include=optional`, `--userconfig=<고정 user 설정>`, `--globalconfig=<고정 global 설정>`, `--cache=<고정 cache>`, `--registry=https://registry.npmjs.org/`이다. shell=false, stdin ignore/stdout pipe/stderr pipe이며 추가 argv·명령/상속 환경을 받지 않는다.

설치 자식 env는 preparation의 정확 14개 값만 사용한다: 고정 PATH, LANG/LC_ALL=`C.UTF-8`, HOME=preparationRoot, GIT_CONFIG_NOSYSTEM/ATTR_NOSYSTEM/NO_REPLACE_OBJECTS/NO_LAZY_FETCH=`1`, GIT_CONFIG_SYSTEM/GLOBAL=`/dev/null`, GIT_CONFIG_COUNT/OPTIONAL_LOCKS/TERMINAL_PROMPT=`0`, GIT_PAGER=`cat`. WSL bootstrap의 빈 env 후보와 이 npm 자식 env, Windows SSH에 실제 필요한 최소 env는 서로 다르다. Windows 빈 env의 접속 호환은 미입증이다.

이 recipe는 실행 채택 전 후보다. omit=dev는 runtime 설치용이며 이후 graph 조사 도구의 dev 의존성을 설치했다고 주장하지 않는다. `source.entry='scripts/qa-fn03-tc01-dependency-intake.ts'`는 wire의 고정 식별자이고 CLI/bootstrap 파일이 아니다.

## 3. 한 외피에서 닫을 순서와 중단점

1. **적재 전:** 정확 새 source ref/배포·고정 bootstrap의 원 바이트·전체 정적 적재 closure를 외부 감독이 검산한다. 현재 표의 helper 몇 개만으로 closure 완료를 선언하지 않는다. 기존 current-journey의 `currentProfile` import는 schema 모듈까지 이어지므로 이 의존도 closure에 포함하되 SQL 실행은 하지 않는다. 이 설치 이전 단계가 설치될 node_modules를 선행으로 요구하는 순환을 만들지 않는다.
2. **원 승인/소진:** 신뢰된 외피가 보호 plan/approval 원문을 독립 기대 SHA로 읽고 목적·시도·HEAD·lock·recipe·source closure·절대창을 검산한다. wire의 `approvalSha256`/`consumptionSha256`를 자기 승인 근거로 채택하지 않는다. 원 소비 기록의 신규 exclusive 성공·flush·close·재검산을 가진 동일 감독만 다음 포트를 사용한다. 기존 기록을 덮거나 과거 `CONSUMED` 조회만으로 재사용하지 않는다. 정확 파일/형상은 아직 미구현이며 임의 경로를 정하지 않는다.
3. **원 tool/root/lock:** 현재 Linux/UID1000, 정확 sourceRoot·부모 보호·HEAD/clean 원소스·원 package/lock을 대조한다. 원 lock은 NOFOLLOW 원 fd와 전후 신원·길이·SHA 검산 후 같은 바이트로 `takeLockBytes`에 공급한다. [current-journey:318](../../scripts/qa-ix01-current-journey.ts) `plainFile`, :336 `createExclusive`, :346 `directoryPins`, :365 `tooling`, :371 `verifiedHost`의 구현 방식을 재사용할 수 있으나 이들은 private이고 옛 `fileInput:396`/`actualPorts:590`은 A14/Docker/DB 결박이므로 호출하지 않는다.
4. **준비/설치:** controller의 실제 승인·소진·tool/root/HEAD/lock 검사를 매 단계 유지한다. 새 preparationRoot/cache0700·빈 설정0600만 exclusive 준비하고 실행 receipt/artifact 및 source의 `.npmrc`/`node_modules` 부재를 확인한다. 시작 직전에 재검산한 뒤 원 Node 자식1개를 만든다. 원 umask 읽기→원값|077→원값 복구1회를 유지한다. 설치 제한은 준비부터600초, 전체는 같은 wall/mono 최대30분이며 더 짧은 승인창이 우선한다.
5. **정상 종결/관측:** 같은 원 child의 stdout/stderr end, exit(0,null), close(0,null), 사후 현재성까지 모두 확인한 뒤만 node_modules를 관측한다. 사후 관측은 파일 내용 SHA를 위해 파일 바이트를 읽되 반환/로그하지 않고 scratch를 소거한다. 원 64KiB 출력의 내용도 반환하지 않는다. 파일당16MiB·총256MiB·파일/디렉터리 각각20,000·manifest2MiB 상한, NOFOLLOW·단일 링크·UID/mode·전후 fd/tree 검산을 지킨다. 빈 디렉터리·링크·특수파일·변조/초과는 생략하지 않고 거절한다.
6. **송수신 종결:** 입력 canonical UTF-8+LF ≤16KiB, 결과 canonical UTF-8+LF ≤4MiB+16KiB(내부 manifest ≤2MiB)를 원 시도에 결박한다. sender의 로컬 `COLLECTED`는 후보의 정상 수거만 의미한다. receiver `CANDIDATE_ONLY/NOT_ISSUED`, reader `COMPARISON_ONLY`를 설치 provenance/TC01 PASS/다음 실행 권위로 바꾸지 않는다. bootstrap stdout framing·exit code와 원격 정상종결의 실제 대조는 고정 외피에서 아직 연결해야 한다.

각 단계의 불일치·오류·기한/종결 불명은 다음 단계0이다. 원 자식·새 경로·소진 기록은 보존하며 추가 조회·자동 retry·signal·삭제·chmod를 하지 않는다. 자기 timer/listener/fd와 임시 바이트만 원 소유로 회수한다. UNKNOWN 뒤 native error sink 최대3개와 원 close listener1개는 원 close까지 남는다. close 미도달은 외부 감독 인수 대상이며 자동 kill로 성공을 만들지 않는다. 성공에도 승인에 없는 설치 tree/cache 자동 삭제는 없다.

**한도 해석:** 256MiB/20,000은 사후 관측의 상한이다. 현재 npm 생성 중 다운로드 총량·디스크 쓰기를 그 수치로 제한하는 코드가 있다는 뜻은 아니다. 실제 고정 실행안은 새 경로의 허용 자원 범위와 전체 프로세스 수거 책임을 명시해야 하며, 현재 소스로 무제한 쓰기나 새 quota 권한을 승인했다고 간주하지 않는다.

## 4. SSH와 도구의 기존 근거 및 미확정

[기존 carrier:7–16](../../scripts/qa-ix01-subnet-observation-carrier.ts)의 System32 OpenSSH/WSL-server, BatchMode/StrictHostKeyChecking, forwarding·proxy·local command·control socket 차단, UpdateHostKeys=no/AddKeysToAgent=no/VerifyHostKeyDNS=no를 유지한다. 원 설정의 Include/Match 효과와 실제 host trust를 CLI 값만으로 입증하지 않는다. 다른 도구/alias·임시 config·`ssh -G`·신뢰 자동 등록으로 우회하지 않는다.

옛 remote command는 `exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module`과 subnet payload에 결박됐다. 설치용 bootstrap/입력으로 이를 조용히 치환하지 않는다. 설치 SSH 최대1의 정확 client/argv/env/payload/command SHA와 30분·600초/출력 계약을 별도 확정한다. 기존 metadata/관측의 SSH 횟수를 소비하지 않으며 로컬 SSH close만으로 원격 설치 종료를 선언하지 않는다. [windows:49/77/100](../../scripts/qa-ix01-subnet-observation-windows.ts)의 원 handle·wx/flush/close/confirmClosed 방식은 참고 가능하나 `IX01_WINDOWS_TWO_PHASE` 소진/정상 반환을 설치 목적으로 전용하지 않는다.

원 `currentProfile:18–21`의 비교 pin은 다음과 같다. **현재 Linux 실측이나 전체 npm 모듈 무결성 입증은 아니다.**

| 도구 | 기존 SHA256/조건 |
| --- | --- |
| Node24.22.1 | `E32E2D16081CF644F88392934288086E7662529D0D43277C34F7AAD2207CFAFB`, 최대160MiB·0755 |
| npm CLI11.19.1 | `8E5F6F3429F8CDBE693CDC29904E9D5A7B127A494BD15C804BD54C7403BFCBE7`, 54B·0755 |
| npm package.json | `F6478D5600180A23F73E4217610C7709A71CEDB4AE13F6C3E15ECB457F5D4FD6`, 6597B·0644 |

54B CLI와 package.json 두 파일의 비교만으로 뒤에서 실행되는 npm 전체 모듈을 확인했다고 표시하지 않는다. 실제 공급자는 원 Node/npm의 기존 신원·버전 검산 범위를 실행안에 명시하고, bootstrap의 적재 closure를 별도로 고정해야 한다. 이 문서가 별도 패키지 관리자 DB/서명 조회를 새 필수 gate로 추가하지는 않는다.

## 5. 현재 Git LF 근거와 합성 검수

다음은 기준 commit의 `git show <HEAD>:<path>` 원바이트다. 설치 파일 manifest나 최종 실행 closure가 아니다. 아래 stem은 모두 `scripts/` 아래이며 이름 뒤 `.ts`를 붙인다.

| source stem | 바이트 | SHA256 |
| --- | ---: | --- |
| qa-fn03-tc01-dependency-native-ports | 18252 | `485f8fc220a8b956a8bfce0a413af1dc0cfb624dc900ab8e2c942c1c81519117` |
| qa-fn03-tc01-dependency-carrier-entry | 7948 | `97d272bc776cd54992ae8da246e840d609f53806406fd540e15feb811557e615` |
| qa-fn03-tc01-dependency-carrier-supervisor | 10196 | `d35fa25ebf1cc4e336aae92d23d49a1f349c4f7b8920aa508bd6a5b12dc976e9` |
| qa-fn03-tc01-dependency-carrier-wire | 8660 | `0fd5115f692ffbd7b3bac2cff100fdaef892d484d27b488e0c04edfa0240e4b9` |
| qa-fn03-tc01-dependency-preparation | 12133 | `dbedab6fe7467464b413844639e67b19259fef75131ad416c50e6bf087f6a602` |
| qa-fn03-tc01-dependency-intake | 6600 | `be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25` |
| qa-fn03-tc01-dependency-evidence | 9019 | `9d04f02138f92e7ed0d658b1d9c025989988642b053dcc909f66881567843268` |
| qa-ix01-current-journey | 64438 | `a3de404e3397741ceca76e61b766bb3cb240af83d765bf8a978dc4d9cff8a63b` |
| qa-ix01-subnet-observation-carrier | 8334 | `263fd78210e4bd2997da022510c0c1c1a5931c6b31649ea029f332d551c0c1ec` |
| qa-ix01-subnet-observation-windows | 14407 | `3dade4b79163e6ac79dece080d26a9f6ddb96789ec60f35ccffaa7ee17b737dc` |

루트 `package.json`은 976B/`281575a15bdfc1204c4df3390d260117a874d274281320016779c8207a8a345c`, `package-lock.json`은 76254B/`ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6`다. 새 bootstrap 추가 뒤 sourceHead와 전체 closure는 다시 동결해야 한다. 이 기존 HEAD를 수정된 실행본으로 가장하지 않는다.

[WORK_STATUS](../WORK_STATUS.md)의 「IX01 격리 설치의 Node 실행 포트와 원 프로세스 종료 조건」에 직접9통과 `278f55`, 앞선 인접46통과 `83431d`, 최종 좁은 타입 exit0 `1d0548`, Main 직접3통과 `e20c90`가 있다. RAM receiver→native→intake→후보 정상 경로, 권한/플랫폼 실패, 준비 경로 충돌, exact command 변경, pre-spawn 경로 재검산, 초과/역순/만료, 원 umask 복구와 UNKNOWN 뒤 오류 수신을 확인했다. 이는 실제 설치/다운로드·배포·SSH·원장 정착 검수가 아니다. 이번 문서 작성에서 해당 시험을 반복 실행하지 않았다.

## 6. 실행안 확정과 반환

다음 구현 위치는 **고정 Linux bootstrap 한 곳**이다. 거기서 원 승인/소진·source/tool/lock 공급자를 검산하고 native factory와 receiver를 직접 조립하며, 같은 원 Windows 감독이 strict SSH 한 번과 원 수거를 담당해야 한다. 현재 보호 원문/소진 공급자 및 고정 bootstrap 파일·배포/적재 방식·command SHA가 없으므로 파일명을 꾸며 호출 명령을 제공하지 않는다. 이들은 기존 helper를 더 감싸는 문제가 아니라 실제 효과 전 외부 원본을 공급하는 남은 접점이다.

Main은 이 접점의 소스와 현재 운영 근거를 고정한 뒤, §1 세 차이만 포함한 하나의 정확 설치 실행 결정을 받는다. 승인 문구/기한/원 소진 기록이 확정되기 전 native 호출0이다. 기존 Windows §1·J3/0095는 다시 묻지 않으며 이번 단계에 0101/PG/Docker/서비스/Agent 효과를 추가하지 않는다. 문서 rollback은 이 신규 파일 제거뿐이고 과거 실행안·소진 기록·소스는 보존한다.

## 7. 후속 소스 연결

`4c44da5d`에서 설치 전용 보호 plan/approval의 원문 검산과 별도 `-dependency-consumption`의 신규 배타 intent를 연결했다. plan은 exact14, approval은 exact9, intent는 exact7 canonical JSON(LF 없음)이며 원 생성 fd와 동일한 readback만 허용한다. 기존 TC01 및 준비용 경로와 분리한다.

[Linux 적재 진입점](../../scripts/qa-fn03-tc01-dependency-linux-entry.ts)은 `4c44da5d`의 원 소스 13파일을 고정한다. 실행 12파일에는 외부 패키지가 없고 기존 loader를 재사용한다. 최초 Node·bootstrap·pre-hook 신원과 같은 HEAD의 원바이트는 외부의 `verifyBootstrap`·`takeSourceFiles`가 제공해야 한다. 실제 보호 승인 원본 및 OS 포트 공급도 남았다. 위 소스 연결만으로는 실제 CLI나 실행안을 확정할 수 없다. §1의 기존 승인 및 실행 제외 범위는 그대로 적용한다.
