# FN07 normal SDK 생산자 구현 명세

**목표.** 첫 SEND의 dispatch를 포함한 세 번째 원장 행이 정상 닫힌 뒤 고정 SDK의 `query({prompt,options})`를 호출하고, 그 동기 hook에서 원 CLI 자식을 생성한다. 네 번째 행은 원 입력 yield와 정착된 init 증거가 모인 후 기존 coordinator가 기록한다. 이후 같은 Query에 입력을 제공하고 출력·STOP을 기존 원장에 연결한다. 이 문서는 소스 작성 계획이다. 설치 이미지, 실제 모델 수락 및 Windows 실행 검증은 미확인이다.

**구성.** 데스크톱의 기존 등록 주체 아래 새 SDK 실행의 등록 owner·START·Query·iterator·collector를 최초부터 한 Node worker isolate에서 발급한다. 별도 제어 루프가 전용 native 감독과 통신한다. Win32 Job, 보유한 이미지·디렉터리·프로세스·스레드 핸들, 한정된 파이프가 실제 실행 경계다. 기술은 기존 CJS/TypeScript·Node worker_threads/stream·Windows C#·기존 RAM 시험을 사용한다.

**근거.** 기준 main `19e0430705f667593972524ed7c1c1c4e3cf1b66`, WI `EBA7836B91796A6DB4C0213D1114029E2623677816AB4E6D4E116244993A6EEB`. WORK_PLAN FN07/FN08, 86A461 §2–5의 준비·첫 입력/세션 init·출력·종료, 9E98 §2–6의 등록 계보·슬롯 후 배정·합산 예산·유한 거래를 사용한다. 3BB87678은 일반 Qwt→aT→cT 호출과 같은 Query 반환, 호출자의 환경에 대한 SDK 버전 대입을 확인했다. SDK 기본 CLI 파일명·설치 지문과 cT의 실제 입력 소비 시점은 확정하지 않았다. `770175 UNKNOWN|IMAGE|IMAGE_SIZE`에서 PATH 후보의 크기 방향이나 실행 출처를 추론하지 않는다.

## 공통 제약과 검수 초점

최초 START는 준비 수락이다. Query 생성은 원 FIRST 3행의 strict-close 후이며 일회 permit·READY·dispatch·원 기한을 유지한다. 동기 hook은 Promise를 반환할 수 없다. 세션 init만으로 명령 응답을 기록하지 않는다. 원 normal host의 10초/64frame 및 2MiB 본문, normal 공동 256MiB와 원 UNKNOWN 차단은 그대로다. 생성과 장기 stdio는 별도 목적이며 기존 자격 host 창을 붙들거나 연장하지 않는다. 새 서버 endpoint·로그인 주체·범용 spawn·공개 renderer IPC·권한 DB행을 추가하지 않는다.

1. **누가 어떤 파일을 실행하는가.** 원 등록/peer·배포 계보·SDK 전이 모듈·runtime·CLI·cwd/env 대조 실패는 import/spawn 0이다(A/D).
2. **재개할 정확한 자식인가.** 생성 성공 직후 원 핸들을 먼저 확보하고 Job·이미지·시도·기한이 맞아야 그 스레드를 한 번 재개한다(B).
3. **동기 hook을 누가 깨우는가.** 차단된 SDK isolate 밖에서 취소·현재성·늦은 응답을 수거한다. 다른 owner의 핸들을 닫지 않는다(B/C).
4. **관측은 어느 Query에 속하는가.** 원 Query·iterator 각 하나, 첫 yield+init, 후속 원 입력·보호 저장, session-only/격리 및 STOP 이력의 의미를 유지한다(C/D).
5. **포화·취소·종료불명을 어떻게 남기는가.** credit·바이트 한도·기한·정상 EOF와 실제 exit를 분리하고 UNKNOWN 뒤 재생성·장부 해제·긍정 cursor 0을 검증한다(B/D).

## 닫힌 경로와 책임

아래는 다음 배정 대상이다. 지시서·현황은 Main 소유다. 기존 소비자(generic wire, first-send-owner, normal-sdk-session-output, polling)에는 공개 옵션/예외를 추가하지 않는다.

|단위|제품 경로|작성할 접점|
|---|---|---|
|A|신규 `apps/desktop/scripts/normal-sdk-worker-build.cjs`, 기존 `apps/desktop/scripts/desktop-runtime-profile.cjs`|고정 릴리스 입력만 받는 `buildSdkWorkerPackage`와 package 생성 접점. 승인된 정본이 없으면 선택 기능을 패키징하지 않고 그 사실을 구분한다. 기존 SDK/Node·CLI 설치나 npm 다운로드를 수행하지 않는다.|
|A/B|신규 `apps/connector/native/NormalSdkWorkerPackageSource.cs`, `NormalSdkChildHostSource.cs`(같은 디렉터리), 기존 `apps/desktop/scripts/desktop-trust-key-host-build.cjs`|동일 보호 host의 명시 compile closure에 두 source를 포함한다. 기존 preparation worker manifest/컴파일 입력의 목적 검사는 그대로 둔다.|
|B|기존 `apps/connector/native/DesktopTrustKeyHostSource.cs`, `NormalExecutionCredentialSource.cs`(같은 디렉터리)|등록된 원 peer와 현재 slot/record를 검사하는 별도 목적의 단발 인계. 일반 NORMAL_SPOOL/SIGN_PREPARATION 프레임에는 새 효과가 없다.|
|A/D|기존 `apps/desktop/src/shell.cjs`, `trust-enrollment-owner.cjs`(같은 디렉터리)|기존 등록 시작점과 createProfileExecutionClients에 연결. 제품 옵션/renderer가 원 worker 파일·검사 함수·native port를 선택할 수 없다.|
|C/D|신규 `apps/desktop/src/normal-sdk-worker-entry.cjs`, `normal-sdk-child-bridge.cjs`(같은 디렉터리), 기존 `apps/desktop/scripts/native-proof-runtime-entry.mts`|격리 bootstrap, 실제 SDK 로더·동기 hook·원 stdio broker, 등록 bundle의 assemble. WorkerSdkPorts 외부 주입 경로를 제품 normal 생산자로 선택하지 않는다. 기존 main bundle export 및 합성 시험 entry는 보존한다.|
|시험|신규 `tests/desktop/normal-sdk-worker-package.test.cjs`, `normal-sdk-child-bridge.test.cjs`, `normal-sdk-worker-journey.test.cjs`(같은 디렉터리)|각각 A 계보·패키지, B/C 프로토콜·C# 정적 순서, D 동일 owner·전체 여정. 같은 파일에서 RAM/정적 성격을 명시한다.|

`native-worker-build.cjs`·`NativePreparationWorkerProvenanceSource.Acquire`의 유일한 목적은 OwnershipEvidenceWorker.exe다. `OwnershipEvidenceProcessOwnerSource.ProcessStartup.CreateSource/ProcessOwner.Dispose`의 원 handle 현재성·회수를 참고한다. `OwnershipHost.Prepare`는 별도 합성 대상의 사후 attach 방식이다. SDK 경로는 `CodexHandshakeHost.Launch/Members/ObserveExit/StopExact`의 HANDLE_LIST+JOB_LIST 동시 생성 패턴을 쓴다. 그 예제의 Codex argv/env/15초/고정 INIT 프로토콜을 이식하지 않는다.

## A. 패키지와 최초 owner

**인터페이스.** `buildSdkWorkerPackage(release: FixedSdkDistributionInputs): SdkPackageManifest`. release는 사전에 고정된 배포 입력과 SDK/CLI 의존 목록·각 바이트 지문만 포함한다. 빌드 시 최종 부모 exe/ASAR/header는 입력도 출력도 아니다. 이 셋은 패키징 완료 후 native의 원 부모 검산에서만 인증한다. 임의 입력 JSON을 verified로 변환하는 export는 제공하지 않는다. manifest는 `{purpose:'NORMAL_SDK_WORKER', packageRef, buildRef, sdkVersion:'0.3.224', workerEntry, brokerEntry, runtime, sdkEntry, modules[], cli}`. 파일 항목은 정규 상대경로·길이·SHA256·종류로 닫는다. `cli`는 정확히 IMAGE(image) 또는 SCRIPT(runtime,script)다. 위 shape는 새 목적의 **비공개 배포 데이터**다. 원 공개 SDK tar 1110841B/고정 SHA512 및 sdk.mjs 1145192B/SHA256 70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5는 기존 판독을 재사용한다. d.ts는 실행 파일로 취급하지 않는다.

`NormalSdkWorkerPackageSource.Acquire(OriginalPeer peer, OriginalRegistration registration, VersionRef packageRef, FixedProfileSelection profile, Deadline end) → OwnedSdkPackage`. 이 서명의 Original/Owned 타입은 실제 보유 객체를 뜻한다. 원 설치 디렉터리와 부모 디렉터리의 물리경로·재분석/링크·소유·변경 금지, 각 파일 바이트와 배포 기록을 대조해 원 핸들을 보유한다. closure 밖 import/require, 런타임 검색 경로·추가 loader/execArgv, 코드로 해석될 환경 재정의는 거절한다. 배포가 고정한 전이 모듈 목록/Node builtin 목록만 사용한다. ESM 표준 로더가 경로를 다시 열 때까지 원 디렉터리와 파일의 교체·변경을 막을 수 있는 보호/공유모드를 유지하고 검산한다. asar는 원 패키지 해시/헤더를 검산하며 외부 파일은 각 원 핸들을 유지한다. 검산된 설치 근거가 없는 상태에는 `SDK_PACKAGE_UNAVAILABLE`을 반환한다. 사전에 선택한 고정 CLI의 이름/해시를 임의 입력하지 않는다.

`shell.createShell`의 **등록 전** 고정 bootstrap이 원 worker를 만든다. 기존 등록된 main 소유권을 복제하지 않는다. SDK 경로가 선택된 신규 등록은 기존 등록 요청을 전용 worker의 `createTrustEnrollmentOwner` 한 곳으로만 전달한다. shell은 원 origin/연결세대 변경·invalidate/cancel과 기존 UI용 상태만 전달/표시한다. 즉시 무효화되는 epoch와 원등록 동작의 확인 회신을 사용하고 표시값으로 자격 발급을 진행하지 않는다. 물리 native 채널은 동일 desktop 프로세스의 검산된 원 peer와 해당 worker의 고정 entry/전용 endpoint를 대조해야 한다. 동일 PID만으로 isolate를 식별할 수 없다. 원 broker가 만든 전용 port를 검산된 entry에만 건네고, native는 원 등록 세션에서 기원한 단발 인계와 원 package를 별도로 대조한다. 원 owner·slot·READY·WeakMap은 isolate 안에서 최초 생성한다. 과거 등록을 자동 이전하거나 레거시 등록 경로를 새 목적으로 재사용하지 않는다.

- [ ] RED: `node --test --test-name-pattern="패키지|등록" tests/desktop/normal-sdk-worker-package.test.cjs`. 잘못된 목적·교차 peer·추가 모듈·mutable 경로·배포 미기록 및 기존 등록 객체 재사용에서 load 0.
- [ ] 빌드 목적/A의 검산·최초 bootstrap을 연결한 후 같은 명령. 교체 없는 IMAGE/SCRIPT 합성 배포에서만 다음 B의 lease를 요청할 수 있음을 확인한다.

## B. 한 자식의 native 권위와 byte session

**A의 실제 호출자.** `desktop-runtime-profile.cjs::readOwnedPackageProfile()`의 현재 기본값은 null이다. 이 값을 임의 manifest로 교체하지 않는다. 보호 빌드의 `createDesktopTrustPackageProducer`가 **최종 ASAR 생성 전** SDK manifest와 고정 JS entry/의존을 함께 포함하고, 기존 native parent release 검산이 최종 ASAR/header를 먼저 인증하는 순서를 쓴다. manifest 내부에는 자기 ASAR의 최종 해시를 넣지 않는다. 외부 runtime/CLI는 해당 인증된 ASAR 안 manifest가 고정한 경로와 다이제스트로만 연다. forge가 기존 hooks를 통해 이를 호출하는 경우에만 SDK 목적을 활성화한다. 원 release 증거 없는 일반 개발 패키지는 SDK 목적 미지원이다. 형상만 맞는 객체를 만들거나 런타임 입력으로 미등록 빌드를 활성화할 수 없다.

**인터페이스.** `IssueChildLease(OriginalRegisteredPeer, CurrentSlotOwner, FirstSendAttempt, OwnedSdkPackage, SourceRootBinding, EnvironmentBinding, Deadline) → OriginalLease`. 기존 credential `LoadSlot/Record`, grant·registration·slot fullref, project/execution/generation, command/dispatchAttemptRef, READY 및 FIRST3의 원 worker 발급근거, 계획 SID digest, connection/environment/profile fullref, 보호 cwd/env와 원 기한에 묶는다. first-send JS의 원 private 검산을 호출선에서 유지하고 **native가 검증하지 못하는 JS JSON digest만으로 lease를 발급하지 않는다**. 원 정상 등록/slot 세션 중 맺은 일회 인계를 양쪽 endpoint에 묶고 정상 예약과 중복 없는 first attempt 키를 대조한다. 원 root/배정·원 command proof를 재판독할 수 없으면 생성 0. 짧은 자격 host는 정식 인계 뒤 닫고, 별도 고정 native supervisor가 장기 private session을 맡는다. 이 supervisor도 같은 package/원 peer·절대 deadline·원등록 상실을 검산한다.

`NormalSdkChildHostSource.Open(OriginalLease lease, ObservedHookSpec spec) → OwnedChild`. spec의 정확 키는 command/args/cwd/env/signal의 취소 결박이다. 무제한 caller command·환경을 전달하지 않는다. protected profile에 귀속한 모델/한도/SID/초기 CONTEXT_REVIEW 툴 거절 및 확인된 SDK 버전별 argv 토큰 순서와 값을 독립 생성해 대조한다. 경로는 잠근 cwd·CLI의 원 신원과 비교한다. IMAGE는 원 PE가 application이고 SCRIPT는 잠근 runtime이 application, script는 고정 위치의 argv 한 항목이다. 알려지지 않은 옵션/환경 키, 중복/빈 우회키·환경 상속·shell·PATH 탐색을 거절한다. 환경 proof는 기존 environmentRef의 허용 자료를 검산된 host에서 해석하며 env 원문과 secret은 로그/receipt에 기록하지 않는다. 보호 sourceRoot/env와 선택된 대상·해시의 신뢰 가능한 배포 연결이 없으면 `SDK_CONFIGURATION_UNAVAILABLE`이다.

원 시도 단발 선점 → stdin/stdout/stderr 자식끝만 상속 허용 → 정원 1·kill-on-close Job을 startup 속성에 원자 결박 → 고정 이미지 suspended 생성 → 반환한 process/thread를 즉시 소유 → 이미지/Job membership=1·시작 시각/원thread·grant/기한 재검산 → Resume 1 → 실제 READY. 생성 후 사후 attach 우회는 없다. 취소·오류·resume 반환 불명은 원 child 정리 전용이다. 정상 STOP은 원 Query cooperative interrupt 우선, 완료·writer 해제·OS 종료를 추론하지 않는다. `ObserveExit`는 원 process signaled+exitCode, 별도 Job membership/EOF를 기록한다. 정확한 종료/flush를 확인하지 못하면 UNKNOWN, 재생성 0.

- [ ] RED: `node --test --test-name-pattern="원 자식|재개|회수" tests/desktop/normal-sdk-child-bridge.test.cjs`. 교차 lease·부정 spec·만료 생성 0, suspended 직후/재개 직전 취소는 resume 0, 자기 handle만 회수.

**인계/물리 종료.** 현재 `DesktopTrustKeyHostSource.Main`은 인자 0개만 받는다. 별도 고정 모드 `--normal-sdk-child`만 추가하고, 인자만으로 실행권을 주지 않는다. 원 등록 host가 검산된 동일 helper의 전용 supervisor를 띄워 단발 인계 pipe의 자식 끝만 명시적으로 상속한다. supervisor는 원 인계 endpoint·원 peer PID/생성시각/부모 이미지·등록/slot 원본을 확인한다. broker용 전용 duplex pipe도 원 현재 SID와 해당 desktop peer로 제한하며 임의 renderer 경로나 PID 입력을 받지 않는다. 원 host의 정상 인계·수령 확인 전에 실패하면 원 종료/UNKNOWN 규칙을 적용하고 같은 lease를 재발행하지 않는다. 짧은 host와 다른 프로세스에 있는 CLI의 HANDLE_LIST에는 이 인계/제어 pipe를 넣지 않는다. supervisor의 lease 만료·registration/slot 소실·desktop peer 종료는 별도 감독 루프에서 신규 쓰기를 차단한다. 기존 host/session 메서드의 예산을 장기 존속시키지 않는다.
- [ ] B를 구현한 후 같은 명령. 실제 C# 소스의 고정 application/handle list/atomic job/pin/resume/exit 순서를 정적 검산한다. 합성 상태기계의 성공을 Win32 성공으로 기록하지 않는다.

## C. 동기 hook과 격리된 실제 SDK 호출

`openOriginalQuery(request: Parameters<NormalFirstSendSource['create']>[0], prompt: AsyncIterable<unknown>, life: AbortSignal): Promise<AsyncIterable<unknown>>`는 WorkerSdkPorts.create 구현이다. 첫 SEND가 원 current와 strict-close를 마친 뒤 보호 package lease에서 원 ESM export를 1회 로드한다. 고정 SDK의 명시 옵션에 계획 SID·cwd·환경·실행파일/실행기·제한 args·원 signal에 결박한 AbortController, 동기 spawn hook과 CONTEXT_REVIEW deny 도구 콜백을 넣는다. `resume/continue/sessionStore` 분기는 사용하지 않는다. `query({prompt,options})`에는 원 workerInput 스트림을 그대로 넘긴다. 원 Query를 정상 반환한 뒤 포트의 Promise로 감쌀 수 있으나 SDK hook 자체는 동기다. Node worker는 환경 복사본을 가진다(SHARE_ENV 금지). 격리 worker 프로세스 환경에 대한 SDK 버전 대입이 controller 환경을 변경하지 않아야 한다. 패키지·origin/기한이 미검산이면 import/query/spawn 모두 0.

`spawnOriginalChild(options: SpawnOptions): SpawnedProcess`는 해당 시도 원 lease에 닫힌 함수다. 별도 제어 루프의 broker에 요청 한 번, 원 attempt별 1칸 SharedArrayBuffer에서 `PENDING→READY | FAILED | ABANDONED` 상태를 CAS한다. 원 worker만 잔여시간으로 `Atomics.wait`하며 main/broker는 기다리지 않는다. native가 READY를 발급하고 pipe 식별·원 generation을 검산한 후 state를 publish하고 notify한다. READY에 필요한 값은 worker가 막힌 동안 처리할 MessagePort 큐에 맡기지 않고 미리 발급한 동일 시도 전용 채널과 공유 상태에서 읽는다. 취소/timeout/peer 상실은 경쟁 CAS로 waiter를 깨우고, 이미 native가 효과를 냈으면 broker가 동기 반환의 성공 여부와 관계없이 원 handle을 수거한다. 재시도/OOB PID 선택 0.

동기 반환 객체의 stdin은 Writable, stdout은 Readable, killed/exitCode/signalCode와 kill(signal):boolean 및 exit/error on/once/off만 고정 SDK 선언대로 구현한다. kill은 폐쇄된 원 child에 한정해 native의 수락을 동일 원기한 안에서 확인한다. kill 반환으로 exit를 발급하지 않는다. 별도 stderr reader는 원 raw bytes를 공개하지 않고 상한 안에서 비운다. 통신은 원 session+방향+증가 순번에 고정한 `DATA/ACK/EOF/ERROR/EXIT` 및 단발 CLOSE로 한정한다. 순번 불일치·중복 종료·초과는 UNKNOWN, 추가 전송 0.

내부 수송 한도는 chunk 64KiB, 방향별 미확인 DATA 1개, stdin/stdout 각 1 credit(ACK/소비 전 다음 chunk 0), 단일 SDK 내용은 기존 2MiB, stderr 총 64KiB 후 초과 중단이다. CLI 송수신 누계는 **양방향 실제 데이터 합 256MiB/원 child 생애**에서 멈춘다. 이 수치는 신규 private transport의 독립 상한이다. 보호 저장 실잔량·최악예약은 별도로 기존 normal 256MiB 안에서 검산한다. 누계 한도가 아직 유효한 세션의 입력/출력을 제한하는 효과도 검수 대상이다. 장기 대기는 원 grant/worker의 남은 기한까지이고 짧은 native 제어창은 각 기존 10초/64frame을 유지한다. credit을 얻기 전 생산자의 다음 `read`나 무제한 JS postMessage를 실행하지 않는다. stream EOF·exit 순서는 별도 기록하고 포화된 SDK worker와 독립적으로 취소/종료를 수거한다. SDK에 노출한 Writable.write는 분할·복사·super.write 전에 바이트 길이와 미전송 큐를 예약한다. 대기/미확인 stdin 합은 기존 본문 상한 2MiB 안으로 닫고, 초과/미지원 입력은 원 시도를 회수한다. false를 무시한 반복 호출도 이 진입 검사를 거치며 ACK 대기 중 추가 DATA는 0이다.

- [ ] RED: `node --test --test-name-pattern="동기 hook|한도|늦은" tests/desktop/normal-sdk-child-bridge.test.cjs`. Promise 반환·65KiB 분할·동시 DATA·총량/credit·취소와 늦은 READY·없는 stderr 필드를 검사한다.
- [ ] 실제 고정 import와 원 child 북마크를 가진 C 구현 후 같은 명령. 시험에서는 고정 소스 및 RAM module/stream만 대조한다. 실제 SDK import/CLI/native spawn은 0.

원 prompt는 `normal-first-send-owner.ts`가 첫 입력과 후속 입력에 각각 발급하는 `type:user`, `message.role:user`, 원 전체 `message.content`, `parent_tool_use_id:null`, 계획 `session_id` 형상을 그대로 전달한다. 입력을 미리 읽어 새 iterable로 복사하면 원 yield 시점·현재성 검산을 잃으므로 수용하지 않는다.

## D. 기존 첫 SEND, 보호 저장, 후속 SEND와 STOP

worker의 원 `createProfileExecutionClients→createWorkerStartPolling` 경로에서 내부 생산자의 `WorkerSdkPorts`를 assemble하여 `OwnedSpoolRuntime.outputSource→NormalInstructionWire.forFirstSend`를 통과한다. 동일 Query/iterator를 worker 밖으로 반환하지 않는다. 재시작 시에는 기존 원장·원 관측 ACK만 소비한다. 첫 yield+확인된 init 보호정착 후 FIRST4행, 후속 yield 후 LIVE4행, 일반 출력은 원 SESSION_ONLY/격리·공유예약/strict 재판독 규칙을 유지한다. STOP은 별도 현재 OS witness/stopScope 검산과 attempt 정착 뒤 원 interrupt 최대 1회다. witness가 없으면 기존 거절/호출 0. native의 보유 핸들을 독립 CURRENT로 임의 발급하지 않는다.

- [ ] RED: `node --test tests/desktop/normal-sdk-worker-journey.test.cjs`. 실제 조립 경로의 RAM 대역에서 자동 START query 0, FIRST3 뒤 1, iterator1, 첫 yield+init→후속 원입력→보호 output→STOP을 확인한다. 권위 없는 입력, 다른 owner, 취소·유실·재시작은 생성/다른 handle 정리 0.
- [ ] GREEN/회귀: 위 신규 3시험을 함께 실행하고 기존 `node --experimental-strip-types --experimental-test-module-mocks --test tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts`, `node --test tests/desktop/native-proof-runtime-build.test.cjs`, `npm run typecheck`, `git diff --check development/main` 결과를 단위별 기록한다. 실제 OS/native가 없는 RAM에서 생산자 실행 성공으로 보고하지 않는다.

## 자기검토·경계 및 복구

A에서 원 package/registration, B에서 native lease/child, C에서 실제 SDK 원 Query, D에서 기존 원장/ACK를 발급한다. 코드에 동일한 이름의 검증 콜백을 추가해 이 사슬을 대신할 수 없다. 기존 same-process peer 표식만으로 어느 JS isolate/어느 CLI 파일인지 증명할 수 없으므로 원 bootstrap private channel·보호 package·native 원등록 검산 세 가지를 결합한다. 기존 auth·spool 목적을 그대로 쓰며 별도 SDK child용 인계·수명은 실제로 **새 native 실행 효과**다. 배포에 신뢰할 수 있는 manifest·CLI·승인 cwd/env가 없으면 미지원 상태이며, 새 signing root나 실행허가 DB행을 받는 것으로 가정하지 않는다. 이 조건이 source 설계로 표현되는 것과 사용자의 실제 실행·외부비용·설치 승인은 별개다.

기존 등록·합성/증거 worker·기존 SDK 미연결 경로는 보존한다. 신규 목적 선택을 닫으면 추가 생성은 0이고 이미 발생한 원 child·미정산 spool·UNKNOWN 및 원 증거를 지우지 않는다. 이번 단계는 문서 한 파일, 제품·시험 수정과 실제 관측/설치/조사·실행 0이다. 다음 구현 기록은 기존 Primary가 Main에게 반환하고 Main이 WORK_STATUS 및 독립 검수·Git 통합을 관리한다.
