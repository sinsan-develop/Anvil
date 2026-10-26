# N4 R1 원 C 보고 전송·수집 구현 계획

> Agent 작업자는 `superpowers:subagent-driven-development` 절차로 이 업무를 수행한다. Main은 내부 상세·검수·통합을 맡고 단일 writer가 소스를 작성한다.

개정 r2: r1의 독립 scoped spec C0/I2/M0에서 ACK 전 EOF 의미와 C측 상위 예산 소비 지점을 고정했다. r1 SHA256은 `7BC2CB1C41156F85968FDAA2417A111725EBA04CB0ABB936B8ED0FD1568F853A`다. 재검수 전 해소를 주장하지 않는다.

## 목표와 승인 경계

원 launcher가 만든 standalone C의 fixture 전 handshake부터 기존 Cleanup/Snapshot9/Capture, 보고 전송·원 collector 보존·ACK·원 C 종료 관측·회수까지 한 호출선으로 연결한다. payload getter나 새 미연결 helper만 추가하고 업무를 마치지 않는다.

- 기준 branch/checkpoint: `codex/av3-stage-b` / `38f8746c458177cc5549c482ea71ecb6f8b3ce79`.
- 부모: `docs/work_packages/N4_R1_PENDING_REPORT_SOURCE.md` SHA256 `4C209B66B0E319B02D195DCC531DE00DA6667F1194D51C55309C20D1452C01F2`, `N4_DEVELOPMENT_RECOVERY_PROPOSAL.md` SHA256 `D6228FE2951D23C6511517635FAF4880DA61231812F3C5D17075CDC17CF9D7CF`.
- 새 직접승인②: userMessage `01a17002-c88d-7213-8c28-ad45238d1d84`, turn `01a17002-c814-7721-b496-af58f3d6f8d9`, UTC2026-10-24T22:23:12Z. 신규 보호 source/adapter/시험 작성 범위다. P1의 별도 읽기 실행창은 소진·만료됐으며 재사용하지 않는다.
- 이 계획은 Main의 내부 wire/소유 상세 결정이다. 공개 제품 API·DB·권한·실행 승인이나 새 실행 권위 공급자를 만들지 않는다. 10/22 FN06 native A의 미확인 승인 출처와 혼용하지 않는다.
- 실제 compiler/C# parser·C# 시험 실행·Assembly load·handle/pipe/process/fixture/ACL·cert/trust·DB/서비스/Agent 실행은 하지 않는다. 실행 없는 PS AST 문법 점검과 diff 검사는 source 검수이며 C# 검증이 아니다. source 작성·독립 정적 검수와 실제 동작 검증을 분리한다.

## 파일과 현재 기준

| 경로 | 책임 / 기준 SHA256 |
|---|---|
| `scripts/development-recovery-path-guard.cs` | 원 launcher/collector/client와 pending producer 실제 연결. 기준 `45B81D0E35765B1A49909123B8B262B5CC9A50B90859285E80DB22BBDFB71A45` |
| `scripts/development-recovery-host.ps1` | CHILD_PIN_LIFETIME 전용 원 launcher loader/소비. 기준 `B1B72F61F79906F816FB005322B600F66772D05A5C3D88CFE313516DB373A1A7` |
| `tests/native/FN06/StandaloneReportPayloadSourceTests.cs` | 기존 strict payload 검사 회귀 source. 기준 `87D1FB4EE70D38D008C5D1B77C69F2FDA585B3662BCC3338EB7388161704BD97` |
| `tests/native/FN06/StandaloneReportTransportSourceTests.cs` | 신규 미래 native 시험 source. 기존 파일이 있으면 덮지 않고 보고 |

Main이 이 계획·원 source 카드·WORK_STATUS/WORK_PLAN을 소유한다. writer는 위 제품2/시험2만 수정한다. entry.ts, 기존 역할2/3 guardian/worker 본문·G/W frame/op/step/argv/fixture 의미, R0 compiler, 기존 false gate/QAmax2, 보호8 및 다른 업무는 변경하지 않는다. 같은 native 파일의 C측 공통 Fresh·I/O/cleanup polling에 상위 예산을 추가 소비하는 최소 수정은 아래 범위로 허용한다.

## 불변 조건

- 기존 CHILD_PIN_LIFETIME 8argv, old5 우회 거절, C role1/GW role2/library role3 구분을 보존한다.
- `observerSlot`은 생성 전 launcher-local 최소 observer handle의 상관값으로 명확히 한다. 현재 ctor의 metadata 검사를 handle 채택으로 바꾸지 않는다. C-local 복제 슬롯은 원 suspended C 생성 후 bootstrap으로 전달한다. 명령행 patch·HANDLE_LIST/상속 전환·외부 PID reopen은 하지 않는다.
- `launcherTicks`는 원 launcher의 Windows FILETIME 생성 tick이다. UTC window의 DateTime tick과 구분한다.
- 원 Snapshot 9행/빈행·행당8필드·필드256 raw UTF-16 code unit·16KiB payload와 고립 surrogate를 그대로 보존한다. 기존 직렬화를 JSON/요약/대체 문자로 바꾸지 않는다.
- 형식 helper `QaFixedFrame`/`QaFixedPayload`는 원문 재사용한다. 기존 G/W channel의 role/op/step·body·timeout은 변경하지 않는다.
- frame4096/payload4048, channel 총32768bytes, 송·수신별 seq1..8을 유지한다.
- 원 launcher의 전체60000ms/원 UTC 잔여예산을 넘지 않는다. 기존 Fresh의 UTC 여유75초/starting70초 선행을 삭제하거나 전체 실행75초로 확대하지 않는다. 새 frame/report/cleanup 시간창·재전송·재접속·reportId 재발급은 없다.
- 외부 exact C/launcher artifact trust는 여전히 미연결이다. metadata/hash/공급자 주장·소스 타입이 실행 권위가 아니다. 4false, PS 최초 throw, entry 실제 throw, 실제 QAmax2 및 실제 C/G/W3 cap 차이의 미채택 상태를 유지한다.

## 내부 보고 wire 결정

보고 전용 role은 4(C_REPORT), 5(ORIGINAL_COLLECTOR)다. op은 1 HELLO, 2 READY, 3 DATA, 4 END, 5 FINAL_ACK, 6 BOOTSTRAP_ACK다. 다른 role/op는 해당 상태에서 거절한다. 기존 G/W parser를 확장하지 않고 별도 보고 상태기계가 같은 frame 형식 helper만 소비한다.

binding은 아래 ASCII 문자열의 SHA256으로 고정한다. 필드는 기존 문법으로 검증하고 invariant·UTC `o`·소문자 hex·고정 순서를 사용한다. 두 슬롯은 x64 양수 범위이며 0/-1/-2를 거절한다. 이 binding은 상관·무결성 값이며 권위가 아니다.

`ANVIL.QA.C_REPORT.CHANNEL.V1|run|commit|issued:o|until:o|reportId|observerSlot:x16|launcherFileTime:decimal`

| 순서 | 송신 / seq | payload |
|---|---|---|
| HELLO | C / 1 | empty |
| READY | collector / 1 | 아래48bytes bootstrap |
| BOOTSTRAP_ACK | C / 2 | READY payload SHA25632. C의 실제 observer/server peer 검증 뒤만 전송 |
| DATA | C / 3..7 | 원 payload의 순서 있는 1~5청크. 마지막 외4048bytes, 마지막1~4048bytes |
| END | C / chunkCount+3 | totalBytes u32 + chunkCount u32 + 전체 payload SHA25632, 정확40bytes |
| FINAL_ACK | collector / 2 | END와 같은 정확40bytes. strict 수집·private deep 보존 뒤만 전송 |

READY little-endian layout: C-local observer slot u64(0), launcher PID u32(8), launcher creation FILETIME i64(12), launcher-local observer 상관값 u64(20), 원 QA started UTC ticks i64(28), 원 QA deadline UTC ticks i64(36), 현재 remainingMilliseconds u32(44). 합계48bytes다. UTC 값은 정확 UTC로 검증하고 FILETIME과 변환 없이 혼용하지 않는다.

launcher FILETIME은 양수 canonical decimal이며 `DateTime.FromFileTimeUtc`가 수용하는 범위인지 별도로 검사한 뒤 실제 `GetProcessTimes`의 원 FILETIME과 같은 단위로 정확 대조한다. 기존 ctor의 `DateTime.MaxValue.Ticks` 이하 검사만으로 FILETIME 유효성을 대신하지 않는다. 범위 검사로 얻은 UTC 값이 원 raw FILETIME이나 실행 신뢰를 대체하지 않는다.

원 QA deadline은 `min(originalUntil, originalQaStartedUtc + 60000ms)`다. remaining은 launcher의 최초 monotonic clock과 현재 UTC에서 더 짧은 값이며0/초과/역행·모순을 거절한다. C는 검증된 peer의 bootstrap을 받은 뒤에도 HELLO 전송 이후 자신의 경과시간을 보수적으로 차감해 예산을 단축만 한다. 이후 신규 효과·단계와 I/O/정리/exit의 대기 예산은 상위 남은 값과 min 결합한다. 이미 시작된 동기 kernel 호출이나 하위 worker가 물리적으로 상한 안에 반드시 종료한다고 주장하지 않는다. 이 수명 전달이 기존 QAmax2나 실행 gate를 열지 않는다.

### C측 예산 연결점

- 원 `QaStandalonePinRun`이 private `QaStandaloneBudget`을 소유한다. `RequireCurrentBudget()`/`RemainingMilliseconds()`는 권위를 반환하지 않고 기한을 단축·거절하는 내부 검사다. C의 최초 clock을 READY 뒤 재시작하지 않는다.
- `QaOwnedRunHost.Execute`의 child-pin handshake 뒤 `QaFixtureOwner.Begin(..., originalRun)`→`QaFixtureLease.Begin(..., failureCase, originalRun)`으로 원 run만 내부 전달한다. 일반 case의 null 동작은 보존한다. `QaFixtureLease.Fresh`, `CheckEntry`/`OpenAction`, `CleanupOwned`/`ReleaseHandlesWithoutDelete`의 신규 효과 직전·반복에서 같은 예산을 검사한다. 만료 catch에서 원 pins를 계속 해제해 정리 성공을 만들지 않는다.
- 이미 optional originalRun을 받는 `QaProcessProbe.Begin`은 imageSpec뿐 아니라 같은 원 run을 보유한다. `Fresh`는 기존 UTC 여유75초/starting70초·local60초 조건을 유지하면서 inherited budget을 추가 대조한다. `QaOwnedRunHost.CleanupOriginalOwner`도 같은 원 예산만 소비한다.
- C측 `QaOriginalWorkerChannel.Io`의 event wait, `CloseOriginalAfterExit`의 pending loop, `RequestOriginalStop`/`RequestGuardianStop`의 원 과정 대기, `QaProcessProbe.StopOwnedQaAndObserve`의 종료 요청 직전·대기, `CloseAfterObservedExit`의 channel/transfer/image/job close 직전이 실제 소비 지점이다. 기존25ms/5000ms/45000ms/15000ms 등 상한과 parent 잔여의 min만 허용하며 별도 cleanup15초를 더하지 않는다.
- 원 역할2/3 `QaFixedPinWorker`/guardian body나 별도 OwnedRuntime는 이 변경 대상이 아니다. G/W 메시지와 단계 의미를 보고용으로 바꾸지 않는다.
- 만료/호출/close 불명은 신규 작업·재시도·임의 close 없이 원 Process/Thread/Job/image pin·미완료 I/O owner와 자료를 보존한다. 물리 종료·정리 완료를 관측하지 못하면 UNKNOWN이며 외부 watchdog만으로 하위 예산 준수를 입증했다고 하지 않는다.

## 원 소유와 실제 호출선

1. 원 launcher는 기존 false/exact-trust 차단을 먼저 유지하고, 고정 image/source resource를 원 handle로 pin한다. reportId 한 번, 최초 한 pipe, 원 Job/observer를 준비하는 본문을 작성한다. 외부 caller의 PID/handle/Job/authority bool은 받지 않는다.
2. 원 C를 비상속·suspended·원 JOB_LIST로 생성한다. 반환 Process/Thread를 검증보다 먼저 원 목록에 등록한다. flags0·PID·image·SID·생성시각·Job membership을 실제 원 객체로 대조한다.
3. 최소 observer 권한은 query-limited+SYNCHRONIZE `0x101000`이며 DUP_HANDLE/TERMINATE를 넣지 않는다. C-local 비상속 복제 성공/slot을 즉시 원 목록에 기록한다. 원 C Process의 DUP_HANDLE을 이용한 duplicate-back 검사·검증 copy close 성공 후에만 resume한다.
4. collector는 원 C peer를 확인한 뒤 READY를 보낸다. C는 raw slot을 비소유 view로만 조사하고 PID/time/SID/flags/GrantedAccess·pipe server PID·원 argv 상관값을 대조한 후에만 소유 채택한다. `GetNamedPipeServerProcessId` 선언 추가는 필요하며 기존 client PID API와 구분한다. 실패하면 fixture 전 차단한다.
5. 기존 원 Execute/Cleanup/Snapshot9/Capture가 같은 private 보고 client를 소비한다. strict Reader의 공통 검사 경로만 최소 확장하고 ValidateOriginal의 기존 의미·반례를 유지한다.
6. collector는 완전 payload·END 상관과 순번/청크/한도·9행을 검사하고 strict payload `Reader.End()`의 정확 소진을 확인한 뒤 private 원 rows/payload에 deep 보존하고 ACK한다. ACK 전에 pipe EOF를 기다리지 않는다. 완전 END 전 pipe EOF는 실패이며 정상 pipe 종료/원 C exit 확인은 FINAL_ACK 이후 회수 단계다. ACK 실패는 수집 사실과 ACK_UNCONFIRMED를 분리하며 원 자료를 버리지 않는다. 성공 명칭도 COLLECTED_NOT_OS_VERIFIED로 한정한다.
7. 원 C exit/Job 상태를 확인한 뒤 같은 원 handle/I/O만 회수한다. CancelIoEx 요청은 완료가 아니다. 같은 OVERLAPPED가 terminal로 확인될 때까지 data/event/pipe를 보존하고, 종료/close 불명은 원 owner에 보존한다. 새 경로·PID reopen·임의 close·정리 성공 합성은 없다.
8. PS는 CHILD_PIN_LIFETIME에만 별도 고정 standalone launcher facade를 소비한다. 기존 일반 library Create 경로와 child-pin 거절은 유지한다. 새로운 loader/Invoke도 최초 실행 차단을 유지하고 entry.ts에는 억지 R1 호출을 추가하지 않는다.

### 내부 facade·loader 결정

새 QA source facade는 public sealed `DevelopmentRecoveryQaStandaloneLauncher`의 `Create(string runId,string commit,DateTime issued,DateTime until,string expectedControllerSha256)`·`Execute()`·`Cleanup()`으로 한정한다. caller의 PID/handle/Job/authority bool을 받지 않는다. PS 전용 loader는 고정 ControllerImage를 동일 stream/bytes/hash로 확인해 그 동일 bytes만 로드하는 본문을 준비한다. 실제 로드는 실행하지 않는다.

이 facade의 source resource 검사는 role1 controller를 위한 별도 metadata 판독 경로이며 role2/3을 거절한다. role1 원 C의 기존 EntryAssembly/Main 선행과 role3 일반 library Create의 의미를 바꾸지 않는다. expectedControllerSha256는 같은 바이트 대조값일 뿐 외부 exact artifact 실행 신뢰가 아니다. 최초 PS throw와 외부 exact trust 미연결·기존 false gate를 그대로 유지하며 metadata 일치만으로 원 객체·프로세스를 발급하지 않는다.

## 수행·검수 순서

- [ ] writer가 현재 실제 타입/서명에 대응한 파일 diff 계획을 제시하고 Main이 위 binding/facade·C측 예산 소비와 대조한다. Main 판정과 독립 spec 재검수 전 제품 작성은 하지 않는다.
- [ ] 미래 native 반례 source를 먼저 준비한다. 실제 compiler/RunAll 실행 권한이 없으므로 RED/GREEN을 주장하지 않는다.
- [ ] launcher/collector/client와 기존 pending producer 및 PS 소비를 한 업무로 연결한다. 원 frame helper/G/W/기존 gate/상한을 보존한다.
- [ ] source 자체 검토로 실제 생성→선등록→검증→사용→종료 관측→회수 순서와 잘못된 peer/slot·부분쓰기/프레임·초과/중복/EOF·ACK 유실·기한/close 불명 보존을 대조한다.
- [ ] 독립 reviewer가 전체 소유 diff와 실제 호출선을 검수한다. source-only C/I/M과 compiler/OS/실기능 NOT_RUN을 분리한다.
- [ ] Main이 허용 파일·전후 hash/diff·미래 시험 source·미실행과 rollback을 기록하고 기존 branch에 안전 보존한다. source-only 결과를 FN06/FN08/R1/전체 계획 완료로 승격하지 않는다.

rollback은 소유 commit의 일반 revert/연결 비활성화다. 실제 원문·DB·권한·키·서비스 변경은 없으며 과거 source/검수/실패 이력을 삭제하지 않는다.
