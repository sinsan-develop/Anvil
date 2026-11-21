# FN09 최초 이해 탐색 — 원 native reader 감독 구현 지시

기준: `c6d82d01e970893e1477f977a9386864e4a03560`, branch `codex/av3-fn09-native-supervision` (같은 물리 worktree의 변경을 보존하여 Main이 분리). 승인 A안 `9ED4E1C28953B905D99D22A38AF5B51F57E5DED46BD481B7AE3B2520468DF588`, 수송 WI `6B023555A95A82B2FDA72A32B0EF7C87040740A309052B601C2019E84440B772`. PMO는 기존 검산된 Anvil.exe/ASAR root에서 고정 reader로 목적을 한정한 내부 위임의 source/RAM 구현을 확인했다. 실제 실행·설치·서명·POST·DB 적용 승인이 아니다.

## 1. 이번 완료 경계

기존 `NORMAL_SPOOL_CLOSE`의 understanding 목적에서 원 등록/slot/획득/요청 및 현재 source를 검사한다. 같은 보호 native 감독이 고정 reader의 원 process handle을 보유하고, 원 파일·관리 원장 read 종료 → 원 결과 수거 → 원 child exit0 → 같은 보호 원장 재검산을 구별한다. 이 근거는 일회 소비할 수 있는 내부 상태이며 일반 caller의 digest/boolean/과거 등록만으로 만들 수 없다. 기존 일반 close, SDK_READ_CLOSED 쓰기 continuation, signer, result POST는 변경하지 않는다.

부모 정책은 임의 native helper를 허용하지 않는다. 감독은 원 Anvil.exe/ASAR/host의 실제 peer/이미지/생성 instance를 유지한다. 고정 reader는 같은 설치 host의 목적 mode와 정확 원 부모 process·상속 endpoint만 검사한다. caller가 PID/path/argv/새 root를 선택하지 않는다. 기존 native 프레임에 TS contextEpoch 자체는 없으므로 새 숫자를 인증 근거로 만들지 않는다. 기존 원 channel/lease, Anvil process 생성 instance, 등록/credential generation, slot, attempt, 업무 요청 및 획득 fullref로 결박하고 TS owner epoch guard를 대체하지 않는다.

## 2. 원 잠금과 절차

현재 profile `Log`는 관리 원장과 anchor를 FileShare.None으로 함께 잡는다. 이 잠금을 가진 채 child가 같은 파일을 열게 하지 않는다. 부모의 단회 시작 기록과 원 snapshot 고정 뒤 잠금을 정상 해제하고, reader는 생성·append 없는 기존 root/profile 읽기로만 들어간다. 종료 뒤 부모가 다시 같은 원장을 잡아 시작/할당/등록/slot/summary·획득·기한을 대조한 다음에만 완료를 기록한다. 새로운 진행 중 목적 상태를 다른 정상 output writer가 무시하지 않도록 원 할당 경계에서 거절한다. 외부 결과값을 기존 관리 예약의 쓰기 권위로 취급하지 않는다.

원 management+anchor 64MiB, 암호화 entry 32KiB, 기존 예약 잔량을 유지한다. SDK 본문/전체 metadata는 원장에 넣지 않는다. 기존 scope/prefix/chain/init/tail/원 UTF8·바이트 SHA 검산을 재사용하고 전역 canonical/parser의 숫자 의미를 바꾸지 않는다. 관리행 부분 append/anchor, 원 fd/stream/process close 불명은 UNKNOWN이며 자동 재시도·새 authority·성공 추정이 없다.

## 3. 작성 경로와 검증

- 신규 `apps/connector/native/NormalUnderstandingReadSupervisorSource.cs`
- 기존 `DesktopTrustKeyHostSource.cs`, `DesktopTrustKeyPeerSource.cs`, `DesktopTrustKeyRootSource.cs`, `DesktopTrustKeyBindingStoreSource.cs`, `NormalExecutionSpoolProfileSource.cs`, `NormalExecutionCredentialSource.cs`
- 기존 `apps/desktop/scripts/desktop-trust-key-host-build.cjs` SOURCE_FILES 한 행
- 신규 `tests/unit/FN09/normal-understanding-native-supervision.test.ts`
- 기존 `tests/desktop/normal-execution-credential-owner.test.cjs`, `tests/desktop/desktop-trust-key-host-build.test.cjs`

Main이 `OpenExistingForUnderstanding`의 최소 Root 변경과 final live 검산을 위한 Credential callback, builder 직접 시험의 정확 목록 추가를 허용했다. 같은 물리 worktree에서 이 범위만 변경한다. 실제 native 검증 전 readiness를 발급하지 않는다.

검증은 source에서 추출한 유계 순수 조건의 RAM 대조, 고정 호출·금지 분기의 정적 검사, 기존 RAM owner/host fixture, TypeScript noEmit와 diff check다. C# compile/실행, OS 파일·process·키·권한·DB·서비스·SDK·Agent·SSH는 실행하지 않는다. 소스 검사 및 RAM 결과를 실제 native 종료 입증으로 승격하지 않는다.

## 4. 실패 및 후속

다른 부모/image/birth/목적/등록/slot/원 channel, stale expiry, 여분 입력, 중복 시작/소비, body/summary/refs 변경, 원 결과 이전 EOF, exit 비정상·불명, 부분 파일·anchor, 회수 실패를 거절한다. UNKNOWN의 원 handle은 소유자가 보존하며 임의 PID 재획득·다른 프로세스 종료·추가 조회로 성공을 만들지 않는다.

후속 목적 signer는 이 단위의 실제 원 종료 근거와 원 bodyHash를 독립 소비해야 한다. 아직 서버 custody/등록 result POST, HUMAN 보호 조회·선택 및 normal review 완료를 주장하지 않는다. 기존 503/raw 목적 차단은 그 연결이 끝날 때까지 유지한다.

## 5. 검수 보완과 실제 구현 경계

- 추가 허용: `DesktopTrustKeyRootSource.cs`의 `OpenExistingForUnderstanding`는 기존 owner/ACL/nonlink/retained identity 검산을 재사용하고 create/permit/fallback을 허용하지 않는다. `NormalExecutionCredentialSource.cs`는 기존 정상 CLOSE 목적에만 원 live Record/slot 재검산 callback을 붙인다. `tests/desktop/desktop-trust-key-host-build.test.cjs`는 원 30개 목록을 유지하면서 새 source 1행과 수량 31만 대조한다.
- 고정 reader mode는 원 native supervisor가 만든 local named pipe의 client-end만 받는다. 원 Anvil pipe의 `PipeFlags==0`, 두 endpoint의 같은 kernel server PID 검산은 유지한다. 부모는 exact3 client handles와 원자적 private Job 목록으로 같은 EXE를 suspended 생성·검산 후 1회 재개한다. child가 원 pipe parent와 실제 process ancestry에서 확인한 Anvil.exe/ASAR는 기존 고정 ParentBasis에 다시 결박된다. 다른 helper/PID/path/argv/임의 root는 선택할 수 없다.
- stdin wrapper는 raw native write handle을 대신 닫지 않는다. 부모가 Flush/Dispose 뒤 원 write handle을 한 번 닫아 EOF를 만들고 stdout/stderr EOF·원 child signaled exit0·원 handle 회수가 끝나야 봉인을 만든다. private Job은 active-process 1, 원 parent 종료 시 kill-on-close이며 SDK 실행용 Job과 섞지 않는다. timeout·부분 생성·종결 불명에서는 성공 봉인과 자동 재시도가 없고, 원 IO/handle을 보유한다. 부모 자체 종료 때의 Job 제한은 exit0의 관측 증거가 아니며 UNKNOWN을 유지한다.
- full slot에는 `av3ex1_` bearer가 있으므로 child frame/원장 read basis에 전체 slot 또는 registered record를 넣지 않는다. 부모가 원 record/slot hash를 계산하고, 보호 STARTED에 exact readBasis(필수 ID/ref/scope·최단 기한과 해시)만 봉인한다. child는 그 DPAPI 원 행·원 anchor 및 SLOT_ID/PICKUP/allocation에 대조하고 최소 projection으로 기존 OutputScope/원 SDK row/hash/chain 검산을 재사용한다. SID·본문·경로·token·키는 child 응답에 없다.
- pickup/slot/credential/registration 최단 기한은 잠긴 START에서 도출하여 부모 wall+monotonic budget을 모든 output body Inspect 전에 Tighten한다. child에는 같은 절대기한·남은 시간이 전달되며 파일 조각과 최종 CLOSE도 그 예산을 적용한다. 기존 global Canonical은 변경하지 않고 Windows FILETIME만 새 내부 frame의 정확 decimal string으로 운반한다.
- 같은 execution generation의 미완결 START는 기한/slot 갱신 뒤 새 pickup에도 거절한다. 정상 완료된 같은 key의 명시 replay는 기존 read-only 대조를 유지한다. 원 근거를 삭제·수정하거나 UNKNOWN을 복구하지 않는다.
- 추가 허용된 `DesktopTrustKeyBindingStoreSource.cs`의 목적 한정 `WithUnderstandingReadGuard`는 기존 `io.Lock`과 `ReadOwned`를 사용한다. child 정상 종료 후 binding lock→spool Log/anchor 순서로 원 등록 snapshot·slot을 보유/대조하고 CLOSED Append를 수행한다. 일반 `Record/Read`는 자기 lock을 거절하므로 guard 내부에서는 그 원 snapshot만 소비한다. 기존 Append는 binding lock을 해제한 다음 spool BindRegistration을 호출하며, 일반 기존 경로는 변경하지 않는다. lock/next 충돌·회수·교체·종결 불명은 UNKNOWN이고 callback/정상 반환을 차단한다. 이는 두 원장의 일반 원자적 현재성을 발급하지 않으며 CLOSED는 물리 읽기·종결 사실이다. 후속 signer는 별도 current 등록/자격을 다시 검산해야 한다.
- reader의 fd 신원은 기존 owner/ACL/nlink에 더하여 final path가 원 protected root의 exact 경로인지 검사한다. generic writer의 기존 경로 검산은 바꾸지 않는다.
- 이 구현의 RAM 검증은 C# 원 조건식 추출 및 source 구조, 기존 registered owner의 모의 transport 회귀이다. 실제 Windows API/pipe/job/DPAPI/프로세스 신원·자식 수거와 C# 컴파일은 실행하지 않았다. SDK 실행, 최초 등록 자동 실행, result 서명/POST 및 서버 custody 활성화는 없다.

## 6. 이번 source/RAM 확인

- 직접 native supervision source/RAM 13/13 PASS. I2 본문 접근 전 기한 및 I4 binding lock guard의 부재를 먼저 RED 2건으로 확인했다.
- 빌더 고정 source 목록 1/1 PASS, 루트 `tsc --noEmit -p tsconfig.base.json` exit0, `git diff --check` exit0.
- 기존 owner의 FN09 집중 25건은 24 PASS/1 FAIL. SELECT `CLOSE_UNKNOWN`의 RAM 파일 전후 전체 동일성 단언이 실패했으며 해당 fixture/TS 로직은 기준과 동일하다. 정확 그 1건의 격리 1회는 PASS였다. 전체 세트를 통과로 승격하지 않는다. 원인 확정이나 기존 시간/기대값 변경은 하지 않았다.
- 실제 C#·Windows pipe/job/DPAPI·동시 owner lock 및 실제 child 수명은 미검증이다. 후속 등록 signer 소비와 서버 custody는 이 변경으로 열리지 않는다.
