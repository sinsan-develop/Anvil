# 마지막 검증 개발 서비스 복구 — 실행 전 제안

## 2026-10-25 두 가지 새 직접승인 반영

- **C 쪽 G/JG source 연결**: C는 원 G 반환 Process/Thread flags0·image/SID/time/JC를 검증하고 그 원 peer에서만 고정 W_CREATED28-byte 슬롯을 소비한다. C로 성공 복제한 W process는 queryLimited/sync/dup(0x101040), JG는 QUERY4만이며 native 성공 copy를 원목록에 먼저 등록한다. W actual image/PID/생성시각/SID·**JC membership을 JG 복제보다 먼저 확인**한 뒤 JG membership/active1/limit0x2008을 대조한다. JC 밖 W에 C JG copy가 남아 G 유실 뒤 생존시키는 순서는 배제한다. observer Thread는 G만 소유하며 C는 원G참조에 결박된 Process copy만 갖는다. pin3/RESUME/W ACK·JG query 실제 close→C strong close/ARMED·W/G STOP82/JC0과 부분 회수 소비를 연결했고 snapshot은 G_BODY_NOT_CONNECTED를 명시한다. 실제 G body7argv/JG factory는 미작성으로 Main이 아직 거절하므로 전체flow 실행불가이며 native/OS/TDD는 NOT_RUN이다. query 권한 근거는 [IsProcessInJob](https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob), [Job 접근권한](https://learn.microsoft.com/en-us/windows/win32/procthread/job-object-security-and-access-rights)으로 대조했다. R0/4false/실QAmax2·실제자원0은불변이다.

- **A image/factory source 기반**: 후보 literal은 `D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\r1-artifacts\DevelopmentRecoveryQaController.exe`와 같은 root의 `DevelopmentRecoveryQaWorker.exe`다. 실제 생성/허용 등록이 아닌 source 후보이며 향후 실행 패킷의 exact 부재/owner/link/한도/정리 심사가 필요하다. C의 고정 own build resource `Anvil.Qa.Build.V1`는 role1+source commit40 ASCII+GW SHA25632(73bytes), GW는 role2+source commit40(41bytes), 다른case용 library는 role3+source commit40이다. EOF/역할/commit/entry literal을 대조하고 일반 Main/facade도 role2를 거절한다. 이는 권위·Secret·서명키·registry가 아니라 **무결성 metadata**이고, C own digest/resource 자체는 C의 외부 신뢰를 증명하지 못한다. 외부 exact invocation/실행 결정·C artifact/runner 검수 선행은 여전히 미연결이며 source snapshot도 그 사실을 고정 표시한다. 원 pinRun의 동일 spec만 두 image의 nonfollow/원 ID/DACL/해시 pin에 사용하고 현재 pin분기는 원 GW image·고정6argv/channel id·비상속 suspended 원생성/Job/관측에 연결했다. 현재 C→W 직접연결은 원 G/JG로 확장 전 중간source이며 C 무console·유한보고 수집도 미연결이다. 첫 I1 역할우회는 정적해소(C0/I0/M0), 파일명 I2는 literal 정본 대조로 오탐철회됐다. 실제 build/resource/nativeTDD·컴파일/로드/OS0·R0 d71/F81·4 false gate/실QAmax2 유지다.

- **child-pin 반증 control source**: 현재 same original fixture의 정상 open/공유거절/원 W 생존 전후/STOP82·Job0/사후 정상open을 실제 원 메서드 호출로 연결했다. raw NT 결과는 성공한 원 handle만 소유·회수하고 이상 출력/closeunknown은 보존한다. control3회/sequence1회이며 rename/delete/write0. scoped 정적 C0/I0/M0는 소스 일관성만 확인한 것이고 native/실sharing/OS는 NOT_RUN이다. 현재 fixedsleep ACK불가·고정 G/W factory 미연결을 숨기지 않으며 전체 support/계획 완료가 아니다.

- **고정 PIN_WORKER source 단계3 일부**: 원 action의 현 부모2+leaf1만 고정207-byte packet(slot8/volume8/ID16/attrs4/links4/size8/written8/dir1 ×3, count4+AB SHA25632)으로 보내며 worker는 수신 숫자를 곧바로 소유 close하지 않고 non-owning view의 원 run/OUTSIDE_WRITE/unselected 경로·ID·volume·종류·비상속/최소 읽기 접근을 실제 대조한다. 실제 leaf2bytes/hash 확인 후만 ACK. private same-entry PIN_WORKER 고정6argv와 한 local channel·고정 STOP 또는25초 wait만 있고 spawn/Job 채택/파일 수정0이다. STOP82/자연81/protocol83/내부·close불명84를 구분하고 C도 정상 STOP·요청124 fallback·실제 원 exit 코드를 별도로 snapshot에 보존한다. 독립 첫 I1은 이 receipt 구분으로 정적 해소(C0/I0/M0)했지만 native 동작/TDD·컴파일/OS는 NOT_RUN이다. 현재 fixed sleep factory는 새 worker/pipe id를 전달하지 않아 전체flow ACK 불가이며 새 G/W artifact/factory·원 G/JG·ARMED/keeper/유실/회수는 별도 미완료다. 이 body를 실행 준비완료나 R0 고정 대상/실 QAmax2 변경으로 해석하지 않는다.

- **원 W 채널 source 단계2**: 기존 native에 원 child에만 결박한 한 channel의 48-byte 고정 header/3단계 HELLO→원 slot 목록→count+SHA256 ACK·4096/frame/32768/channel/pin16을 실제 Connect/Read/Write로 소비하게 했다. peer PID는 원 process object의 ID/생존/SID/생성시각/Job과 매 메시지 전후 대조하며 외부 PID를 열지 않는다. exact OVERLAPPED만 CancelIoEx하고 실제 완료 전 native memory/event/pipe를 보존한다. same cleanupClock15초·closeUnknown 영구 보존·원 standalone의 retainedHost로 fixture/action GC 해제를 막는다. 독립 정적 C0/I0/M0는 이 부분 source 한정이고 current fixed sleep에는 client/이름 전달/프로토콜이 없어 유한 실패다. 실제 G/W/worker/factory·ARMED는 미연결, native parser/TDD·컴파일/OS는 NOT_RUN이다. 별도 실행 결정 없이 이 소스를 컴파일/로드/실 pipe·process 생성하지 않는다. 취소 요청≠완료 근거는 [CancelIoEx](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex), 연결 경합/overlapped 조건은 [ConnectNamedPipe](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-connectnamedpipe), 완료 관측은 [GetOverlappedResult](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getoverlappedresult)로 대조했다. source 작성 기준만 채택했으며 R0 d71/F81·실 QAmax2·4 false gate/실제 실행 미채택을 그대로 유지한다.

- 후속 PMO 대조로 아래 상세안을 **기존 승인② 세 파일의 source/test 작성 기준**으로 사용할 수 있음이 확인됐다. 실제 실행 계약·breakaway 총수3 제안은 미채택이며 기존 실제 maxProcesses2/실행 차단은 유지한다. 첫 단계로 기존 원 probe의 suspended 자식에 비상속 직접 pin 복제→원 target에서 검증 duplicate-back→검증 copy 실 close를 작성하고 inheritable QA 경로를 제거했다. 원 target/slot/성공을 원 목록에 남기며 remote 숫자를 C 핸들로 닫지 않는다. 실제 W ACK·고정 G/W/pipe/controller 전체는 아직 없으므로 source primitive 한정 정적 C0/I0/M0·native/OS NOT_RUN이다. 아래 '미채택'은 실제 실행 계약 구분이며 source 작성 기준 확인과 혼동하지 않는다. R0 d71/F81 고정은 그대로다.

- 고립 host의 내부 원 진입 객체를 추가했다. 실제 Main·기존 false gate 뒤 프로세스당 일회 원 객체를 만들고 같은 스레드/run/commit/창·host1회·복제1회에만 사용한다. 공개 factory는 child-pin case를 받지 않으며 내부 원 객체를 외부 입력으로 채택하지 않는다. 이 소스는 다른 코드의 일반 spawn을 차단하는 장치나 새 실행권위가 아니다. 독립 현재 소스 정적 C0/I0/M0·실제 컴파일/native 동작/OS NOT_RUN, exclusive false 유지다. 아래 R0 단일 권장 d71/F81는 고정 snapshot이며 이 추가 소스를 자동 편입하거나 옛 답변의 적용 대상으로 바꾸지 않는다. 그 컴파일 결과도 후속 소스의 검증이 될 수 없다.

- child-pin 원소유 제어도owner→원pin→원probe→fixedchild→finally process회수확정뒤fixture정리로연결했다. exclusiveSpawn false/실standalone entry가현재factory생성전차단하며lifetime NOT_VERIFIED·정적C0/I0/M0만이다. 종료/close불명은fixture/원owner·pin보존, actualcompile/OS0. nativeF81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49는직전6093/376과다른source여서아래단일컴파일후보를이코드checkpoint로현행화한다.

- 고립host Main 최소진입은실EntryAssembly/EntryPoint·고정argv/UTC·동일원hostfinally정리·NOT_ACCEPTANCE/exit2로작성했다. DLL/PS에서Main호출하면entry대조전QaAdapterfalse에서차단한다. finalLF 별칭은C#/PS경계의절대끝대조로보완했으며TS코드는이미거절하여수정0. native376F43B5CD549BED2A5610C190179910CE3B6FA6354F7651E87212CDFFB452D6는이전권장b6/1589와다른source이고R0정확후보를아래표에별도로갱신한다. 전용exe컴파일/실행·process-wide상속배제/guardian시험은여전히미승인·미검증이다.

- 실제loader source도 같은FileStream/private바이트의SHA→같은바이트Load→같은Assembly/publicsealedType/정확Create signature·return/instance에결박했다. hostraw0DCB746D1FC6FD0E6A5A51755E6E638DA03D1FD645ECD1E7631B4D66546D1646·현재literal차단/정적C0/I0/M0, actualload/OS NOT_RUN. caller와별개인정확외부실행결정/출처결박이없으면expectedSHA만으로차단해제불가이며새registry를구현하지않았다. R0는b6c41545/native1589한파일로유지, R0정리후R1에서재사용할DLL은없으므로actualR1artifact생성/등록은별도선행이다.

### 2026-10-25 R1 원 controller·고정 worker 상세안 — PMO 대조용, 미채택

이 절은 2d24e3e3 뒤의 **설계 구체화**다. 아래 타입·진입·메시지는 아직 구현되지 않았다. 새 원문/서비스/registry/broker/키/Agent 권위를 만들지 않는다. 기존 세 소스 파일 안에서만 구현할 권장안 한 개이며, PMO의 구체 delta 대조 전 프로토콜 채택·exe 산출·실행을 의미하지 않는다. R0 d71/F81 library snapshot은 그대로이고 새 exe의 컴파일·배포·실행 허가는 추가되지 않는다.

#### 1. 권장 구성과 중요한 차이

임시 inheritable 핸들을 만든 뒤 다른 thread의 spawn을 막으려 하지 않는다. **모든 QA process를 inherit=false로 suspended 생성하고, 이미 직접 생성한 원 자식 Process 핸들에 DuplicateHandle(inherit=false)로 선택 핸들을 직접 복제한다.** 각 복제 결과는 해당 target process에서만 유효하며, 고정 worker가 그 원 핸들을 직접 검증한 뒤 ACK한다. 이는 후보 방식이며 실제 효과는 OS 시험 전 미확인이다. HANDLE_LIST는 inheritable 핸들과 CreateProcess의 inherit=true를 요구하므로 이 새 경로에서는 쓰지 않는다. 근거: [UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute), [DuplicateHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle).

원소유 그래프는 기존 호출자 C → 새 guardian G → 새 고정 worker W다. C는 새 상시 서비스가 아니라 현재 한정 QA 호출 안의 native controller이며 fixture의 유일한 생성/정리 소유자이자 필요할 때의 keeper다. G/W는 같은 고정 exe의 서로 다른 내부 mode만 사용한다. C#·명령·PowerShell·스크립트 문자열/사용자 코드의 전달·컴파일·평가, 원격 메모리 쓰기·thread/APC 주입, 기존 process/외부 PID 인수는 없다.

| 원 객체 | 최초 생성·보관 | 전달·회수와 금지 |
|---|---|---|
| fixture와 생성 목록 | C의 기존 QaFixtureOwner/QaFixtureLease | 생성 사실·원 ID/hash/권한·상대 위치는 C 안에 유지. G에서 fixture를 새로 만들거나 직렬화 lease를 C가 채택하지 않음 |
| 선택 보호 핸들 | C의 원 QaChildPin/action | 원 source는 OpenAction이 만든 action.Parents와 action.Handle이다. ShareRead인 leaf action/ShareRead·ShareWrite인 parent action을 W에 최소 read/traverse·비상속 복제한다. share7인 정리용 entry.Pin.Handle을 보호 source로 쓰지 않음. C의 강한 pin 보존 여부는 case별 고정 |
| G Process/Thread | C가 CreateProcess의 원 반환을 즉시 원 목록에 선등록 | 원 image/SID/생성시간·Job·flags 검증 뒤 resume. 외부 PID로 다시 열지 않음 |
| W Process/Thread | G의 고정 factory 원 반환 | C는 원 G Process와 그 private channel의 고정 W 슬롯에서만 observer/transfer용 최소권한 복제를 얻음. G는 C의 소유 ACK 전 원 W를 닫거나 resume하지 않음 |
| 바깥 Job JC | C, G와 W를 수용하는 원 containment Job | kill-on-close·breakaway 불허, 두 active process 상한. G/W에 JC 핸들을 넘기지 않음. C의 종료·잔여 검수와 실패 회수에만 사용 |
| 안쪽 Job JG | G, W만 수용하는 원 Job | kill-on-close·breakaway 불허·active 1. C는 ARMED 전 QUERY-only 임시 복제본으로 원 W membership/설정을 검증한 뒤 close 성공을 확인하며 유실 시험 중에는 보관0. W에는 전달0. G가 유일한 JG 핸들을 가진 상태에서만 유실 행동 |
| G/W의 제한 channel | C가 case별 신규 로컬 named pipe 두 개를 최초 인스턴스로 생성 | 각 한 peer·비상속·원 Process와 peer PID 대조. 이름/nonce/메시지/handle 숫자는 그 자체로 소유나 허가가 아님 |

중첩 Job은 **JC에 G를 먼저 원자 결박하고 W를 JC/JG의 유효한 순서에 결박**한다. 실제 Windows의 nesting/기존 상위 Job 제약으로 생성이 실패하면 미확인 실패이며 기존 Job을 바꾸거나 suspended 뒤 사후 무방비 할당으로 우회하지 않는다. C는 JC를 계속 보유하므로 G 유실 뒤에도 그 원 바깥 Job의 active=0을 관측할 수 있다. JG의 마지막 핸들 종료와 JC의 active=0은 다른 사실이다. 파괴된 JG의 최종 count를 읽었다고 보고하지 않는다. 근거: [Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs), [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).

#### 2. 고정 worker·동적 주입 금지

- PMO의 2026-10-25 source 작성 기준 A: 같은 exact Git source·고정 compiler/참조에서 **C 전용 standalone exe 1개와 G/W 고정 winexe 1개**를 분리한다. 기존 controller library는 다른 case용이며 child-pin C의 실제 시작 주체가 아니다. C의 RequireStandaloneQaEntry/원 one-shot 검사를 DLL/PS 허용으로 완화하지 않는다. 두 exe 모두 창/console·동적코드 없는 고정 진입이며 C의 유한 보고 수집은 별도 원 소유로 정의한다(현재 Console 출력 body가 이 조건을 만족한 것으로 승격하지 않는다). G/W는 /target:winexe·x64 GUI subsystem2·고정 Main/고정 pipe만 사용한다. 향후 R1 실행 패킷에 artifact2개 각각의 image/provenance·원 Process/Thread·Job/channel 소유, 정확 source/hash/생성·강제종료·보고 수집/정리 delta를 명시해야 한다. 생성 literal 경로와 C 보고 수집 구현은 아직 미확정·미연결이며 source 작성 기준 결정이 실제 두 exe 빌드/산출·배포/실행 승인은 아니다. 새 경로 생성·exe build/등록·대체0, R0 d71/F81 target:library 고정·gatesfalse/실QAmax2를 유지한다.
- G/W 시작 전에 controller가 원 image 파일의 보호 pin·정확 해시/크기·정확 source artifact 관계를 검증한다. argv로 임의 exe/path/hash를 수용하지 않는다. mode는 GUARDIAN 또는 PIN_WORKER, protocolVersion=1만이며 고정된 run 결박과 channel 이름만 전달한다. 그 값들은 실행 권위가 아니다.
- W는 검증된 고정 핸들 목록의 종류·수·비상속 flags·GrantedAccess·원 ID/path/hash를 확인하고 최대25초의 고정 wait/ACK/close 또는 고정 STOP frame의 종료만 수행한다. 정상 wait 종료81·고정 STOP 종료82·protocol 거절83·내부 오류84를 구분하는 안이다. G의 강제종료 표식은0xA6710001, 예상 밖 test-W 강제종료 표식은0xA6710002로 제안한다. 이는 last-Job-close의 OS 종료 상태를 정한 것이 아니다. 프로세스 생성·shell·파일 수정/삭제·권한 변경·Job 핸들 수신·외부 DLL/모듈/사용자 스크립트 로딩 API는 없다.
- controller와 G도 새 QA 경로에서는 inherit=true 또는 임시 inheritable 복제를 사용하지 않는다. 기존 QA CopyForOriginalChild의 inherit=true 경로는 새 경로 채택 시 삭제하거나 무조건 차단하며 함께 활성화하지 않는다. production 경로는 별도 미등록 상태로 유지한다.
- 따라서 권장안의 process-wide 배제 방법은 '다른 thread가 없다고 믿기'가 아니라 **보호/통신/Job/원 Process 핸들 전부의 비상속 생성·복제와 모든 생성 경로의 inherit=false**다. 이를 적용한 코드·전체 호출부·실 OS 유출 음성을 대조하기 전 현재 exclusive gate는 false 그대로다. 같은 사용자 권한의 임의 코드 주입까지 막는 OS sandbox라고 주장하지 않는다.

#### 3. 제한 통신과 원 핸들 이전

C가 만드는 두 pipe는 case별 새 이름, FIRST_PIPE_INSTANCE·REJECT_REMOTE_CLIENTS·OVERLAPPED, 한 인스턴스, 현 사용자/SYSTEM만 접근하는 신규 객체 DACL로 한정한다. 기존 ACL/계정 변경은 없지만 실제 named IPC·신규 객체 DACL 생성은 실행 delta다. C는 연결 peer를 원 G/W Process 핸들의 GetProcessId·현재 생존·시각/SID와 대조한다. 다른 PID의 접속은 연결 종료/그 case 실패이며 process를 열거나 인수하지 않는다. first-instance 실패도 다른 이름 재시도로 바꾸지 않는다. [CreateNamedPipe](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea), [GetNamedPipeClientProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeclientprocessid).

고정 frame은 version·role·case·run 결박 digest·순번·정확 op·제한 payload만 가진다. 한 frame 최대4096 bytes/한 channel 총32768 bytes, pin 최대16개, 추가/중복 필드·알 수 없는 op·역순·재전송·역할 불일치·길이 초과는 실패다. 로그에는 handle 숫자/원문/환경값/Secret을 남기지 않고 고정 phase·수·상태만 남긴다. IPC nonce는 상관관계 표식이며 소유/승인 토큰이 아니다.

1. C가 JC·G channel·W channel과 원 G를 생성/선등록/검증한다. G는 비상속으로 시작하며 JC에 이미 들어 있어야 한다.
2. G의 HELLO를 C가 원 G peer로 대조한 뒤, G가 원 JG 및 원 W를 suspended/비상속으로 생성·선등록·JC/JG 소속과 원 image/SID/시각을 확인한다. JG는 생성 직후부터 kill-on-close가 설정돼야 하고 W 생성의 JOB_LIST에 원자 결박된다. 이 생성 방식의 성공·membership가 미확인되면 resume0이다.
3. G는 W_CREATED에 **자기 원 목록의 고정 W 슬롯과 JG query 슬롯**만 싣는다. C는 원 G process의 그 슬롯에서 최소 QUERY/SYNCHRONIZE/필요한 DUP_HANDLE 권한의 W 복제본과 QUERY-only JG 임시 복제본을 얻는다. 원 W ID/image/시각/SID·JC/JG membership, JG의 active 목록이 원 W 한 개·kill-on-close/breakaway 불허인지 직접 재검증한다. 원 반환과 다른 PID·재사용 슬롯/조회불명은 ACK0·실패다. 이는 일반 handle 숫자 입력 parser가 아니다.
4. C가 자기 원 pin에서 원 suspended W로 inherit=false·최소 read/traverse 복제를 수행하고 각 성공/실패/target 소유 슬롯을 즉시 원 목록에 기록한다. C의 W_CAPTURED/PINS_STAGED ACK 뒤에만 G가 **자기 원 W Thread**를 resume한다.
5. W가 자기 고정 channel에 연결하면 C가 원 W peer를 대조하고, C가 그 W에 직접 넣은 제한 pin 슬롯만 전달한다. W는 실제 핸들 검증 결과로 PIN_ACK를 돌려준다. ACK 유실·검증불명에는 phase를 되돌려 재복제하거나 다른 W를 만들지 않는다.
6. C는 자기 임시 JG query 복제본의 실제 close 성공·추가 JG 복제0, case가 정한 keeper/원 pin 닫기 동작을 확정한 다음에만 ARMED를 G에 보낸다. close unknown이면 guardian 유실 행동0이며 기존 JC 원소유 실패 회수로만 이동한다. 정상·실패 모두 같은 C/G/W 원 목록만 쓴다.

DuplicateHandle 실패 때 target 슬롯 획득 여부 불명·원 G 유실로 미확인된 원 W가 있을 수 있다. 임의 handle을 CloseHandle로 추정 회수하거나 DUPLICATE_CLOSE_SOURCE로 원 소유를 없애지 않는다. C는 자기 원 JC만 정지/관측하고, W/JC 종료가 확인되기 전 fixture/pin을 해제하거나 삭제하지 않는다. G가 소유한 W Thread는 C가 PID로 복원하지 않는다.

#### 4. case별 행동과 판정

| case | 실제 고정 행동 | 그 결과만으로 할 수 없는 주장 |
|---|---|---|
| CHILD_PIN_LIFETIME | 고정 unselected.txt의 원 ID에 대해 강한 pin 생성 전 DELETE-access open의 정상 control을 먼저 확인한다. W의 실제 pin ACK 뒤 C의 강한 action/복제본을 닫고, W가 실제 생존한 구간의 같은 open이 STATUS_SHARING_VIOLATION으로 거절되는지 확인한다. W 종료 뒤 같은 open 정상 control·원 ID/바이트 불변을 다시 확인하고 기존 C fixture 정리 | open 시험만 하며 rename/delete/write를 수행하지 않는다. C keeper pin이나 다른 원 handle이 같은 거절을 만든 경우 W 단독 증거가 아님. W 생존 전후 유효 표본·정상 control이 없거나 다른 오류면 INCONCLUSIVE |
| GUARDIAN_LOST | 이 case만 C가 원 보호 pin keeper로 남는다. 원 JG/W 독립 검증·C query 복제 close·W ACK 뒤, 자연 종료 시각까지 충분한 여유가 있는 원 G/W의 생존을 다시 확인하고 **원 G process만** 고정 종료 표식으로 강제 종료한다. 원 G의 표식/exit와 자연 종료 전 원 W exit·JC active0을 각각 관측한다. C는 W 종료 확인까지 keeper pin 유지 | G의 정상 Job close·자연 만료·worker crash를 guardian 유실 인과로 대체하지 않음. expected kill-on-close 종료 상태의 OS 기준이 미확정이면 INCONCLUSIVE. C 동시 유실/W 단독 생존/전체 P3 보호 합격은 아님 |
| BREAKAWAY_DENIED | JC 안의 G에서 정상 생성 control W를 먼저 원 JG에 결박·실행·종료/JC 상태 확인한 뒤, 같은 고정 실행 인자/Job 설정으로 CREATE_BREAKAWAY_FROM_JOB 한 flag만 다른 suspended 생성을 시도한다. 원 G의 JC membership·JC/JG breakaway 금지 설정을 보존 | 일반 access-denied 하나는 합격이 아님. control 실패/중간 설정 변경/다른 오류는 INCONCLUSIVE. 예상 밖 생성 성공은 즉시 FAIL·resume0이며 원 process/thread로 아래 별도 회수 |

guardian-loss에서 C keeper가 살아 있다는 전제와 W 단독 수명 case를 합쳐 '모든 host 유실에 안전'이라고 하지 않는다. 현재 P3의 host 의미와 keeper 배치에 대한 최종 대응은 별도 검토 대상이며 이 절이 기존 완료조건을 완화하지 않는다. 안쪽 JG의 마지막 핸들이 닫히면 해당 process 종료와 Job 소멸이 발생하므로, 관측용 JG 복제를 남기는 시험은 목적과 다르다. C가 보유한 **별개 JC**의 최종0·원 W exit와 각 pin 회수를 명시적으로 따로 보고한다.

GUARDIAN_LOST의 인과 판정은 추가로 다음을 모두 요구한다. C가 원 G에 TerminateProcess로 요청한 고정 종료 표식과 실제 GetExitCodeProcess가 일치하고, 요청 직전 원 G/W가 모두 살아 있으며, W의 고정 자연 종료 시각까지 최소10초가 남아 있어야 한다. 자연 종료의 보수적 하한은 C가 RESUME ACK를 보낸 원 monotonic 시각+25초이며 G/W가 보고한 시각으로 앞당기거나 창을 늘리지 않는다. 요청 전 W의 정상 STOP/종료 ACK가 있거나 요청 뒤 자연 만료를 넘겨 W exit를 관측하면 INCONCLUSIVE다. 원 W exit code·시각·G 표식을 원 handle에서 수집하되 exit0 하나로 인과/정상 정리를 주장하지 않는다. **last-Job-close의 기대 종료 상태는 현재 OS에서 미측정·공식 보장값 미확인**이므로 임의로0/124를 넣지 않는다. 별도 허가된 대조 시험/근거로 고정한 expected status와 시간 oracle이 없거나 crash와 구분할 근거가 부족하면 KILL_ON_CLOSE_STATUS_UNCHARACTERIZED/INCONCLUSIVE다. 이 미결을 기존 PASS 조건 삭제로 해소하지 않는다.

BREAKAWAY 예상 밖 생성 성공은 G가 그 원 CreateProcess 반환 Process/Thread를 즉시 자기 목록에 보존하고 **ResumeThread를 한 번도 호출하지 않은 상태**에서 처리한다. C의 원 G channel이 살아 있으면 C가 같은 고정 슬롯의 관측 복제를 확인하되 실패해도 G의 원 반환을 버리지 않는다. JC/JG membership와 무관하게 G는 그 **원 test-W Process 핸들 하나만** 고정 실패 종료 표식으로 TerminateProcess하고, 남은 종료 예산 안에서 원 process exit→원 Thread/Process close를 확인한다. 그 다음에만 원 JG/JC 종료/회수를 확인한다. 이 개별 원 자식 강제종료 효과도 향후 실제 실행 delta에 포함한다. G 유실·핸들/exit/close 불명에는 외부 PID를 열거나 JC 밖 프로세스를 이름으로 찾지 않고 PRESERVED_UNCONFIRMED·fixture 보존이다. JC active0만으로 JC 밖 test-W 회수를 대체하지 않는다.

원 코드의 SealFilesystemCases→TransitionOwnership은 생성 항목을 read/traverse·share READ/WRITE/DELETE로 전환하지만, QaChildPin 생성자는 별도로 OpenAction(entry,ReadData)을 만들고 기존 CopyForOriginalChild도 **action.Parents와 action.Handle**을 선택한다. 새 비상속 이전도 그 강한 원 source를 사용한다. entry.Pin.Handle/share7 복제로 대신하면 source 불일치·INCONCLUSIVE다. 새 CHILD_PIN_LIFETIME는 이 생성 사실만 믿지 않고 **같은 원 대상의 pin 없는 전후 정상 open control**을 요구한다. W 생존 확인은 denial 바로 전/후 원 W Process 핸들에서 수행하고, 사이에 종료가 걸리면 유효 표본으로 세지 않는다. open 성공 시 그 원 대상 ID를 확인하고 이번 open 핸들만 닫는다. 통과를 만들기 위해 기존 fixture의 DACL/공유/완료 기준을 바꾸지 않는다.

W의 실제 target slot도 직접 대조한다. C가 스스로 기록한 원 W target-slot 목록만 원 W Process에서 C로 제한 duplicate-back(inherit=false)하고 원 ID/volume/path·read/traverse 접근·flags0을 검증한다. 이 C의 임시 복제는 같은 보호 효과를 가질 수 있으므로 **실제 close 성공을 확인한 뒤에만** C의 강한 source 닫기·생존 중 open 시험·W 종료 뒤 control로 넘어간다. close unknown은 시험 중단/보존이다. W가 보내 준 임의 slot이나 새 PID는 수용하지 않는다. 이 검사는 동일 원 W target의 핸들 보유를 직접 확인하며 sharing oracle만으로 target liveness를 대신하지 않는다.

#### 5. 상태·실패·정리

| 고정 상태 | 다음 허용 동작과 실패 처리 |
|---|---|
| NOT_STARTED | 미등록 gate/새 실행 결정·정확 image/부재/한도 미충족이면 OS 획득0 |
| G_CAPTURED | C의 원 G/JC 목록만. channel peer/생성/시간 불명이면 ARMED0, 원 JC 회수 시도·관측 |
| W_CAPTURED_SUSPENDED | C의 원 W 복제·pin staging만. 부분 복제는 재시도/추가 W0, 원 JC/JG 종료 확인 전 fixture 보존 |
| PIN_ACKNOWLEDGED | 선택 case의 원 pin/keeper 정책과 close 확인. close unknown이면 ARMED0·영구 불명 latch |
| ARMED | 고정 case 행동1회만. 사용자 입력/다른 명령/기한 연장/전송 재발급0 |
| STOPPING | 새 생성/복제/시험 동작0. 정상 종료 요청은 결과가 아니며 원 process exit와 JC count를 실제 관측 |
| CLOSED 또는 PRESERVED_UNCONFIRMED | 성공한 원 handle close만 닫힘으로 기록. 후자는 원 목록·소유·미확인을 보존하고 PASS·잔여0·재시도 권한으로 바꾸지 않음 |

기존 UTC+monotonic·소유 thread·기준 run/commit/window를 유지한다. R1 전체30분 안에서 case당 준비/행동45초+종료 관측15초를 최대 예산으로 삼고, 시작 때 잔여75초 미만이면 생성0이다. G 생성5초·W ACK10초·W 고정 wait25초 한도는 이 예산 안에 포함한다. OVERLAPPED pipe는 기한에 같은 원 I/O만 취소/완료 관측하고, blocking kernel 호출의 물리적60초 종료를 보장하지 않는다. 기한/시계 역행·channel 유실 시 새 작업 없이 원 Job 회수/15초 관측, 미종료/미확인은 보존·보고한다.

BREAKAWAY control W는 readiness 확인 뒤 고정 STOP frame으로 종료를 요청하고 같은 원 process의 exit/Job 상태를 최대5초 안에 확인한 경우에만 다음 flag 시도를 한다. 이5초도45초 예산 안에 포함하며 control W의25초 자동 만료를 기다린 뒤 시험 창을 연장하지 않는다. 고정 STOP도 임의 명령이나 완료 ACK가 아니고, 시간 부족/종료 불명은 다음 W 생성0·INCONCLUSIVE다.

C는 원 G/W exit와 JC active0을 확인한 후 W에 전달한 pin의 원 source/action 목록, fixture 원 identity/DACL/hash, 고정 자원 목록을 재검증하고 기존 역순 정리를 수행한다. 열린 원 process/Job/handle·delete-pending·close unknown 또는 대상 불일치가 있으면 삭제0이다. 삭제는 기존 고정 fixture만, 재귀 sweep·외부 프로세스 kill·상위 ACL 수리0이다. G/W는 fixture 정리 권한이나 기존 DB/Secret/인증서/서비스 접근 권한을 받지 않는다.

#### 6. 기존 실행안 대비 정확 delta와 최소 구현 순서

- 기존 고정 pwsh sleep 대신 고정 exe의 G/W 두 role, C 내부 controller, 신규 두 로컬 named pipe·신규 IPC 객체 DACL, 직접 target-process 비상속 복제, 바깥/안쪽 unnamed Job 두 개가 추가된다. 실제 exe 산출/로드·pipe/Job/process 생성·원 G 강제종료·실제 정리 모두 **아직 별도 실행 결정 대상**이다.
- CHILD_PIN_LIFETIME/GUARDIAN_LOST는 G1+W1, 최대2 active/성공 생성2개를 제안한다. BREAKAWAY_DENIED는 유효한 동일환경 control과 예상 밖 성공의 안전 회수를 위해 **G1+control W1+시험 W 최대1, 성공 생성 최대3개·동시 active 최대2개**를 제안한다. 기존 '최대2'를 성공 생성 총수와 동시 수로 혼용하지 않으며, 이 한 case의 총수 변경도 미채택 delta다. 채택하지 않으면 control 없는 denial을 합격시키지 않고 해당 case를 INCONCLUSIVE/미지원으로 둔다.
- 구현 허용 경로 후보는 기존 scripts/development-recovery-path-guard.cs(원 controller/G/W·비상속 이전·상태·기한/정리), scripts/development-recovery-host.ps1(고정 artifact 검증/원 controller 호출), scripts/development-recovery-os-qa.ps1(고정 case·원 결과 소비) **세 파일뿐**이다. 새 public 실행 API/일반 원격 handle parser·임의 argv/환경 전달·권위 저장소/등록·기존 product/DB/TLS 수정은 없다.
- 소스 구체 순서는 ① 비상속 직접 복제와 원 target 수명 ② 고정 frame의 순서/길이/역할/원 peer 검증 ③ G/W 실제 제어와 ACK 유실·부분 획득 수습 ④ case 행동/control·정리 ⑤ exact 코드 정적 검토와 허가된 native 컴파일/OS 증거다. 각 단계는 같은 원 객체를 소비하며 검증 모의/선언만 추가해 실제 controller 구현으로 세지 않는다.
- 지금 가능한 검토는 원소유 그래프·실제 코드 delta 위치·메시지/실패 계약의 정적 대조다. 소스 작성 시 순수 입력 시험은 실제 parser/상태 소비를 시험하고, 미허가 native 동작을 문자열 테스트나 가짜 callback PASS로 대신하지 않는다. OS 증거가 없는 경계는 계속 NOT_RUN이다. 이 문서의 상태는 SOURCE_DESIGN_PROPOSED_NOT_ADOPTED이며 코드 구현/컴파일/OS 준비완료/전체 계획 완료가 아니다.

### 2026-10-25 R0 단일 컴파일 권장 패킷 — 실행 전 결정 자료

이전 미결 질문은 3d0ad83ab46e6ae544cd0b1a051e228ef5e8f7c7/native A5F592ADD89B13F09BCE0625868D175428020F7A041C0CC37195888970844271 한 건이다. 현재 권장 대상은 아래 **한 파일만**이며 옛 답변을 자동 이월하지 않는다. 사용자에게 질문을 반복하지 않고 PMO에 대상 차이와 결정 자료로 전달한다.

| 항목 | 고정 내용 |
|---|---|
| 권장 Git 기준 | d71eb50870b088f57e1648ee4a1eba36aa058557의 scripts/development-recovery-path-guard.cs 하나. 이전 b6/1589·6093/376 권장본은 원 pin-child 정리 의존 연결로 대체했으며 선택지는 한 개다. 이후 문서 commit은 소스 교체가 아니다 |
| Git blob / 원문 SHA256 / 크기 | 8d38a21bf18f5b6bed95c8582b87d12e090d95f3 / F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49 / 96953 bytes. 커밋된 Git stdout 원문 stream으로 계산하고 개행 재작성하지 않음 |
| 옛 후보 대비 실질 diff | native +167/-7줄. CLEANUP_UNKNOWN 보존·고정6 준비/실패4·원 owner/실제host finally 회수·Job 관측·공개 QA facade·standalone Main/실EntryAssembly·절대끝검사와 원pin→child→종료/회수확정뒤fixture정리 의존을 추가했다. Main은 /target:library에서 일반 메서드일 뿐 exe 생성/진입 실행0이고 기존 production/QA/원자DACL/상속배제 false gate는 열지 않음 |
| compiler | 기존 C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe, 앞선 읽기 지문46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00. 실행 직전 동일 파일·지문을 다시 대조, 다른 compiler/다운로드0 |
| 참조 | 같은 Framework64 v4.0.30319의 mscorlib.dll=11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C, System.dll=2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71, System.Core.dll=8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D. 62e422 읽기확인, 기존 파일 수정/복사0 |
| 신규 경로 | D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile. 실행 전 부재·기존 부모 realpath/link/소유·보호를 확인하고 기존 경로면 채택/덮기0 |
| 신규 파일 한도 | 위 경로의 development-recovery-path-guard.cs(정확96953 bytes), DevelopmentRecoveryPathGuard.dll, diagnostics.json 세 파일만. PDB/XML/package/cache/추가 소스0. DLL4MiB 초과면 실패·승격0이며 이 상한은 후검사 기준이고 파일시스템 quota를 생성하지 않음 |
| 결과 수집 | compiler exit code·경과·입출력 해시/크기·오류 ID/줄번호만, diagnostics 최대64KiB/256행. stream은 끝까지 drain하되 보관 초과는 잘림/초과 건수로 기록하고 임의 대형 원문 로그를 남기지 않음 |
| 창과 timeout | 전체600초 이하, compiler 관측 최대480초·나머지120초는 동일 compiler 원 process handle의 종료/진단/정리용. timeout이면 같은 compiler만 종료 요청하고 최대15초 exit 관측. 이 compiler 중단 효과도 **향후 정확 실행 결정에 포함할 항목**이며 현재 미실행. 종료 불명에는 파일 삭제/추가 kill·재시도0, 보존/보고 |
| 정확 정리 | compiler 종료 확인 뒤 생성 때 기록한 위3개 파일만 LiteralPath로 삭제하고 이번 생성 compile directory가 비었을 때만 비재귀 제거. 예상 밖 항목/identity·owner·realpath 불일치면 재귀 삭제0·보존/보고. bootstrap 부모도 이번 생성·비어있음이 확인된 경우에만 비재귀 회수. 기존 파일·보호8·DB·TLS·서비스 변경0 |
| 실제 제외 | 대상 DLL load/Add-Type·public facade 호출·OS 음성 fixture·native handle/Job/process 시험·Agent·네트워크·DB·권한수리·인증서/신뢰·서비스 시작0. compiler 자신의 CLR 실행·참조 metadata 읽기는 컴파일에 포함하되 대상 DLL 실행과 구분 |

예정 compiler 인자(기존 compiler의 프로세스1회·위 신규 compile cwd, 아직 실행하지 않은 명령):

```text
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /noconfig /nologo /nostdlib+ /target:library /platform:x64 /optimize- /debug- /warn:4 /errorreport:none /out:D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile\DevelopmentRecoveryPathGuard.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll /reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile\development-recovery-path-guard.cs
```

입력은 정본 Git의 위 exact blob을 새 파일에 CreateNew로 기록하고 원문 해시를 대조한다. source 내용을 로그로 출력하거나 다른 source·RSP·프로젝트 build를 컴파일하지 않는다. /noconfig·/nostdlib+로 자동 응답파일·암묵 참조를 배제한다. 진단/timeout/정리 runner도 실제 실행 전 source 검수를 받으며 이 표가 이미 구현·승인된 실행기를 뜻하지 않는다.

**잔여 bootstrap 위험:** 첫 컴파일에는 아직 검증된 native 보호기를 사용할 수 없으므로 부모 경로의 교체 경합을 원자적으로 막았다고 주장하지 않는다. 신규 leaf 보호/실행 전후 검사는 경합을 완전히 제거하지 않으며 생성·출력·정리에도 같은 잔여가 있다. 10분 안에 종료/identity를 확인하지 못하면 정리0를 보장하지 않고 실패·보존으로 보고한다. 기존 ACL 수리/다른 root 우회·R0 자동 재시도는 하지 않는다. 권장안은 옛 파일 대신 이 한 후보를 **컴파일 진단만** 대조하는 것이고 actual loader/OS 실행 결정은 분리한다.


- JOB_MEMBERSHIP host도 원 probe 생성→고정sleep→원Job관측→finally 같은probe종료/회수에 연결했다. 종료불명은 원handles보존/동일probe재관측, close최종성공·불명은 cache로재호출뒤집기0이다. source정적C0/I0/M0·native1589ACD63CC91840E217F2D38105A55D4324D97BF165A5F5C83707659FC4AB87/실compile·process·OS NOT_RUN. 보호host의 현재case는6filesystem+4failure+1Job이고 나머지3processcase는미지원이다. actualGate/loader·provenance와 OS검증은별도미완료로유지한다.

- 원 QaOwnedRunHost는 고정6filesystem 또는 고정4failure의 실제 메서드를 원 factory/owner에서 호출하고 finally 같은 객체를 정리한다. PS는 공개 QAfacade만 사용·오류뒤 같은host참조를 반환한다. 접근성I1 보정·소유/실패분기 정적C0/I0/M0, host차단 반례검사만 수행했으며 actualloader/OS는 NOT_RUN이다. native367B930CD8098C498DF9E15F5279C0F1CF89F7DBF7F1AF4CC4D39C1652D3CBB1/hostF799EAAF01BFC4C446245EF4BC301F14BF07D005CCC85023AC258E797B6A30D2는 옛R0후보와 다른 source다. 공개facade는 출처/승인 증명이 아니고 production내부타입·gate는 그대로다.

- 변경 영수증 recorded는 nativeStatus00000000만 허용하되 MUTATION_UNCONFIRMED+00000000을 성공으로 바꾸지 않는다. 반례 RED→GREEN/인접2검사·정적 C0/I0/M0, PS96A390B810CBA14E53D392B201D942874713C63215F4940CDDE5A1C0163EA8C1·native compile/OS NOT_RUN.

### 2026-10-25 남은 보호 흐름의 구체적 경계

| 미완료 | 실제 코드 근거 | 현재 판정·다음 선행 |
|---|---|---|
| native 컴파일 | development-recovery-path-guard.cs 전체 | 실제 C# 진단0회. 미결 R0는 exact3d0ad83a/A5 하나이며 새 source로 자동치환하지 않는다. 타입검사는 C# 컴파일 증거가 아니다 |
| 실제 loader/host·지속소유 | path-guard.cs ProductionAdapterConnected/QaAdapterConnected=false, os-qa.ps1 네 method literal throw | 원 owner 소스만 있다. 실제 assembly 출처·수명·외부 실행 계약은 미연결이며 타입이름이나 hash 입력을 권위로 바꾸지 않는다 |
| child pin·guardian-loss·keeper·breakaway | path-guard.cs QaExclusiveSpawnHostConnected=false, QaProcessProbe 및 MissingLifetimeEvidence | membership 관측 후보와 고정 sleep 소스만 있다. 프로세스 전체 상속 배제·guardian 유실 행동/관측은 미구현·실시험 NOT_RUN. 임의 host/새 실행 허가를 만들지 않는다 |
| DACL 원자복구·link/reparse 정리 | path-guard.cs QaDaclCompareAndRestoreConnected=false/RestoreKnownDaclMutation 및 원 관측 | 자동 원자복구·alias 삭제/reparse 제거는 미지원. 불명 보존을 정리0로 바꾸지 않는다. 기존 권한 수리·production 효과 변경0 |
| 실제 공유간섭·종료·잔여 | path-guard.cs MissingLifetimeEvidence/원 handle 정리 | source receipt·모의검사는 실 NTFS/Job·잔여 증거가 아니다. 별도 정확 실행 경계와 OS 관측이 필요하며 아직 수행하지 않는다 |

이 표는 보호 소스 전체 완료나 프로젝트 전체 중단 선언이 아니다. 확인된 독립 source 누락은 기존 승인②로 보완하되 컴파일·실 host/OS 검증을 추가 모의 helper·선언·문서로 대체하지 않는다. 새 지원 결정은 PMO에 정확 대상과 현재 후보 차이를 전달하며 사용자에게 기존 질문을 반복하지 않는다.

- 정리 영수증의 중간 DACL 상태와 삭제 전 복구실패/삭제결과 모순을 거절했다. 독립 source C0/I0/M0·반례11거절/보존4·인접3PASS는 parser 한정이다. PS4873940E7356DAF3E78CF5DBD30B646E83D6B4C7FFEEB5C6F34F59776B4C8323, native불변/compile·OS NOT_RUN. 실제 child 상속 배제·guardian-loss/keeper/breakaway 행동·loader/host/watchdog와 원자 정리는 미완료다. 실행 필요 항목을 source PASS로 숨기지 않는다.

- 원 factory owner는 외부 lease/handle 없이 같은 원 객체·불변 case/run/commit/창을 보관한다. 정리 전후에는 새 준비·시도를 막고 원 lease NOT_ATTEMPTED를 보존한다. PS 네 동작 literal throw는 유지하며 타입이름/BindingFacts는 실제 assembly 출처 증거가 아니다. native B95EA9519AA7B87A850A5D9870B04405C49993CD992CD50A4BB5F6E0A433BC03·PS DE6CA873BC675095893C571156613D9E425FE8D0D9ED6FE1A1CBF5CAAAB67EEF는 R0 미결3d0ad83a/A5와 다른 소스다. source 한정 정적 검토/소비시험을 실제 compile/OS/정리 합격으로 승격하지 않는다. 새 두 가지 승인 답변의 질문 연결 미확인으로 R0 이월/P1 재실행0이다.

- cleanup-unknown은 실제 close 사실을 바꾸지 않고 삭제 전 close-only의 QA aggregate만 불명으로 1회 주입한다. 원 실패4 receipt와 고정6case/7child 준비 소비를 연결하되 PS literal throw/모든 os/residue/execution false 유지다. 신규 source delta 정적 C0/I0/M0·최종 순수 소비4/type/PS AST/diff0은 native/OS 검증이 아니다. 현재 nativeE68F74957136F0065D8CD41BCBA98923DB2108D32995991339662EAFC678B8C5/PS59495DFC1301D7794AFF38C4D49A1CBA3ED572BC3F1D85720509768A96FF996C는 R0 미결 exact3d0ad83a/A5 후보와 구분하며 답변을 새 후보로 자동 이월하지 않는다. 실제compile/OS/정리·assembly provenance/원 factory·실host 등과 전체계획 미완료를 유지한다.

- 고정 QA 실패3 local 주입·원 Job membership 후보는 각 한정 정적 C0/I0/M0, nativeA5F592ADD89B13F09BCE0625868D175428020F7A041C0CC37195888970844271·compile/OS/실정리 NOT_RUN이다. 최초 R0 compile-only 추가 실행 결정 후보는 기존 C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe(385903 읽기 hash46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00), 새 D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01\compile 아래 DLL/PDB/비밀 없는 진단만·최대10분/로딩·native호출0이다. root는 현재 부재이고 생성/컴파일은 실행하지 않았다. source 승인②는 이 bootstrap 예외를 포함하지 않으며 원 parser Minor1·원자복구/실 host/잔여 행동과 전체 source/계획 미완료를 유지한다.

- child-pin 소유/명시 상속 후보는 run/commit/창/SID·원 ID/read/traverse-only·부분복제/close latch를 결박했지만 process-wide spawn 통제는 없다. 이에 inheritable 복제 전에 readonly false에서 차단하며 원 action만 회수한다. 한정 정적 C0/I0/M0는 이 차단 조치의 증거일 뿐 child상속/keeper/guardian-loss 지원 PASS가 아니다. native6C1CED59DCF005D8C66BFC2CD9ACFECFCE49E76EE11C087DB8019D91647C1A41·컴파일/OS/실프로세스 NOT_RUN, 전체 source/계획 미완료·새 broker/실행권위 생성0을 유지한다.

- hardlink/reparse 원관측 후보는 각 독립 C0/I0/M0 source-only다. 공통 links1/reparse 거절은 유지하며 고정 원 leaf 링크수2/ID/바이트 또는 selected 원directory ID/상대 reparse payload만 별도 대조한다. native72104DE12864D3995472783820C3C1DC11D5D040A26070C4691F028724D65A57·compile/OS/실정리 NOT_RUN, alias삭제/원자 reparse제거 증거0·close-only 보존, DACL 원자복구 차단/기존Minor1·I1/I3/host8case 미완료를 유지한다.

- DACL 원/의도 descriptor 관측과 파일용 SetSecurityInfo 후보·원 lease 정리 receipt 소비를 준비했다. readonly false에서 비원자 복구 write를 차단하므로 원자복구 지원 미완료·실 권한변경0이다. 독립 C0/I0/M1(불가능 일부 조합 parser 허용, 권위/합격 상승0), 순수 신규3/인접3·type/PS AST/diff0은 C# 검증이 아니다. native9884917631CD69124D5C36631B4C0E034293C6549D966708EEE36795A5266D13/PS8239FA36AD4D5CC2289AD6173191907E1AEB0C3FAD180F0A1B02635783FE7BF2·컴파일/OS/실정리 NOT_RUN, 원 I1/I3 전체·hardlink/reparse/host8case 미완료 유지다.

- OUTSIDE_WRITE writer 종료 확인 뒤 원 ID/예상바이트 재관측·no-op 거절 소스 보완은 한정 정적 C0/I0/M0다. native raw0AD7C807B297E85B79B96D3CD8C9B91DF912A7F37A8A8D317949F2BFCBFC31EA, 컴파일/OS/실정리 NOT_RUN·전체 source 준비완료가 아니다. 원 I1/I3/나머지8case·실 host 미완료를 유지한다.

- **2026-10-25 R1 공유간섭 source 보완**: seal의 최소 read/full-share 소유 handle과 일시 action/부모 보호 handle을 분리했다. 종료 실패 선반영 정적 I1은 성공 확인 뒤 Closed=true로 보정·한정 재검토 C0/I0/M0. native NOT_COMPILED/OS NOT_RUN·비간섭 UNRESOLVED이며 원 I1/I3/전체 source·계획 완료는 아니다. 불변22검사/P1 재실행0, 같은 승인②의 변경후 원 관측·정리/host 경계를 다음으로 계속한다. 현재 native raw8540379976E5F24220C35F5A1291545DD721FA2BDA6115952159418CE44C9B1D. 실제 컴파일·OS·서비스 변경 허가로 확대하지 않는다.

- PS pathname 본문은 제거했고 원 QaFixtureLease의 고정6행동을 호출하는 source로 대체했다. 결과는 원 case/행동/4문자열·상태만 대조하며 native/os false·guard NOT_EVALUATED·fixtureInterference UNRESOLVED·cleanupRequiredtrue다. R1 QaProcessProbe는 production과 분리한 fixed pwsh/.NET45초 sleep·최대2/atomic Job·원 process/시간/own-QA 종료 후보이고 host watchdog/물리시간한계·fixture pin상속/8case를 증명하지 않는다. 빈 Job 종료 오판은 no-process 결과와 정상획득 요구로 보정, delta 한정 독립 C0/I0/M0·PS 소비22/type/구문 exit0이다. native raw15634A98538F6C3F1564DA9123206E710662DCAF76B0D0CF7EFBC6A27478C92F/OS source4CAD835F0F14EA2034DA3D0CE5F02BA85114B5C334547CF07F88DC8FCAF55D7A. 실행 차단 유지·실컴파일/OS/권한0, fixture 공유간섭·변경후 readback/정리·실 assembly/binder 등 source/실증 잔여 때문에 전체 source 준비완료나 I1/I3 해결이 아니다.

- R1 전용 QaFixtureLease source 후보를 production과 분리했다. 기존 고정 base 원 부모 nofollow/owner·DACL→create-new run/marker→원 handle 목록·관측·보수적 delete/close-only 보존이며 외부 경로/owner/handle/PID 채택0이다. 입력은 R1/run/commit/30분 선언만 허용한다. 신규 정적 finding3건은 빈 부분획득 성공 금지·정확6case/7child seal·삭제 없이 닫기와 unknown latch로 보정했고 한정 재검토 C0/I0이다. 순수/기존source21/type/PS AST/diff0과 native 미컴파일/OS 미검증은 구분한다. PS mutation 연결·나머지8/실 host·OS/정리 증거가 없어 원 I1/I3 전체해결이 아니며 QaAdapterConnected=false/PS literal throw를 유지한다. native raw2A46B67A55E4F6FE12348EB5E5E64DEB7BCA21A0012938457272FEC040B45B03/OS source490DE7A0C5D6A75B7E1D10348F7E060F83F6B89B83F4326D8B871F2672E577FC. source $Now는 권위가 아니고 실행 선행이나 OS 관측 결과로 재사용하지 않는다.

- 독립 source 검토 C0/I5/M1: callback OS 효과를 0으로 단정하는 projection과 동적 함수 gate는 두 반례 RED→GREEN 보정했다. 현재 actualOsCases=null/osEffects=NOT_OBSERVED이며 본문 고정 throw로 실행을 차단한다. parent 원 경로 재생성·선택 경로의 symlink 교체·DACL 무변화 검출도 source 후보에 반영했으나 실제 NOT_RUN이다. owner/run/원 handle·TOCTOU와 부분 변경 정리 I2건은 미해결, 실제 branch/API/효과 M1은 미검증이다. adapter 전체 REWORK_REQUIRED이며 이 후보를 개방하지 않는다. 기존 native는 P2/P3·NODE/TUNNEL 전용이라 R1 QA fixture/원 process/clock seam은 아직 연결되지 않았다.

- OS filesystem adapter의 실제 변경 행동6종을 기존 시험 파일에 작성했다. factory는 I/O 없이 생성하고 모든 호출을 고정 미승인 오류로 차단한다. 고정 격리 root 안의 합성 대상만 기술했으며 원 handle 관측 없이 OS 거절을 guard PASS로 판정하지 않는다. 행동 본문/효과·setup/정리 NOT_RUN, 시간·프로세스·Job8종 행동/실 runner는 미구현이다. 직접18/type/PS AST/diff exit0은 source 차단/기존 모의검사 범위이고 실제 OS 증거가 아니다. source raw6F1B2DB01ACAEFA618CF0BDCA437E7128B95FBB9C5021913E6540502804A801C, 독립 source 검토 요청 중이다.

- 최신 source 주입 경계는 SOURCE_SIMULATION 전용이다. 플랫폼의 개별 정확 실행 승인은 helper 밖에 있으며 commit/run/기한/hash는 권위가 아닌 대상·수명 감사 정보다. 원 응답의 정확한 상관관계로만 모의 정리를 연결하고 획득/정리 유실·만료·입력 변조를 구분한다. 직접17건/type/Node/PS AST/diff exit0(dc5485→49cf0e), entry raw246DBC425CF4041482C129AE01093B415864471F95B5605E305BD25AA560F0CD/host E81430512F55FF18911A5D1B185109AAEDC86BF19144F6316F62BDF1A32925FE/native 6E1FE7A2A337DF8FE8B2F2B04474A2850F7CD32A9D5D4ACB84E817919CF30461. ProductionAdapterConnected=false는 미등록 상태일 뿐 승인·OS 안전 인증이 아니다. 실제 entry/launcher 차단 유지, 실 fixture 행동/adapter·runtime 집합/용량·독립 검토는 미완료다. 이 검사는 실컴파일·OS 음성·R0/P2/P3 실행을 허가하거나 입증하지 않는다.

- OS시험source 모의연결raw908FCA7C8BC29F2EEC63E48230EC1EEF0A807C21501C1F9884D0438B211BA591: 고정14case 순서/중간오류/재사용·오인권위거절은direct11/type/PS AST/diff로확인했다. actualOsCases0/osVerifiedfalse/executionAuthorizedfalse이며실OS행동/실권위adapter는미연결이다. 실제컴파일/OS·R0/P2P3허가를요청하거나사용하지않았다. source모의orchestration과실OS음성검수를혼동하지않는다.

- 후속source 검토: 선언파일목록의불변/canonical hash와획득기준기한·case alias/보호자료거절을직접9+기존TLS8/type/구문으로확인했다. native는P2/P3행위·기한분리,실size/hash pin→seal전start금지,중복parent재사용/4096상한,부분실패/Job멤버/기한전후검사/unknownclose재시도거절·caller bool강제종료입력제거로보정했지만컴파일/OS미검증이다. 새raw native8FB122D5308ACFC8D982D3ADF21B1FDCB47B41319247B764014F11D94AA85892/entry278F03AB02B131CD351E1C27583BE821E5D7922D63CE25684591A8A3DBBE0DE2/host88ADA14CEA7B86DE7BF71AC6C0E6C7D741AC3E87BFB8A70E3F96EDC3C41EF98F. 아래이전rawhash는이력이다. 실권위/OSrunner case연결·완성runtime파일관측·자원/시동·독립리뷰가남아있어source전체완료/R0실행준비PASS가아니다.

- 원문01a17002-c88d-7213-8c28-ad45238d1d84의두가지승인중P1은정식DB READ ONLY1회a02537로완료·허가소진했다. exactf8fe81e5/probeE03478D4·PG150018/app/migration46·후속7미적용·고정8객체중project_methodologies1행이다. 사용자자료/DDL/DML0, 신규전용root/cache는정확정리·별도SSH부재확인했다. 기존P1미승인문구는과거이력이며추가DB읽기허가는아니다.
- 신규보호source3/adapter·시험작성승인에따라후보를준비했다. 순수host/entry·기존TLS13/타입/PS AST/Node구문통과와C#정적대조만이며native NOT_COMPILED/NOT_OS_VERIFIED·실권위/기한환경/manifest/OSdispatch연결은미완료다. source-only구현은R0bootstrap예외/R1/실P2P3·cert/trust·Job실행승인이아니다. 기존prepare/start차단을해제하지않는다.
- 현재native SHA256 7DDF3588FA28999A0E7A594F6DBF2844F968F08BFE15F6FD3933023B91914C35, host E6BEC2E97ABA5368B45770C48D53F45594D4A1ABEA1A93DFCACC55AC76F6B39C, entry 3242E7164BA1373AB0FBA130DF5C21BBB8717FC0FE6CBDAF85DB3E20E60537B4, OS시험계획1348C7D72A70648DE24286B94EB357FD0C51BCBE25288C5C2F2AB87D58595607. native4096 retained handle후보한도는100000파일탐색가능성이나기동시간을보장하지않으며실제사용파일집합미확정/초과거절이다.

## 2026-10-25 재개 실행 패킷 — 현재 차이만 / 실행 승인 아님

신산님의 재개 지원 지시에 따라 기존 절차를 현재 소스와 대조했다. P1~P4 상태는 **PREPARED_NOT_AUTHORIZED**다. P0는 새 직접승인 ref `01a16fa9-a125-78b3-9ef4-8b32f4aa546c`로 단1회 수행·소진했다: StartedAt `2026-10-24T20:47:32.321123587Z`, 관측 `2026-10-24T20:47:46.405713Z`, running/readyMarkerCount1/restart0, **RUNNING_WITH_READY_LOG / DB_ACCESS_UNVERIFIED**, start1/stop0·성공 개발용 보존. 아래 P0 표의 정지 state는 실행 직전 증거이며 현재 state가 아니다. P0~P4는 독립 결정이며 하나의 승인으로 다른 단계를 열지 않는다. 아래 예전 N4의 source/PID/유효 CA/FinishedAt은 과거 이력으로 보존하고 현재 실행 값으로 재사용하지 않는다.

### 현재 고정 증거와 즉시 재사용할 것

- 코드 후보는 private 기존 branch의 commit `f16a878ca45c799d36f89771cda94f871b10ec4b`다. 마지막 제품 변경 c1b4c680 이후 이 commit까지 diff는 WORK_STATUS뿐이다. 현재 WSL 정식 checkout은 ff0fcd13695ae0affa2fd773dc96667e1d7c88f8/tracked clean이며 아직 후보가 아니다.
- 정본 폴더는 기존 codex/anvil-public-ui-preview와 미커밋/비추적 1057항목을 보존한다. 정본 checkout·기존 자료를 덮거나 정리해서 source guard를 통과시키지 않는다.
- Node `C:\Program Files\nodejs\node.exe` v24.18.0 / SHA256 `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`, package-lock `CA586E2DD02C11C41DA55A64AA4F07D3848936FE44DCA1897F8586AC4FB0F1D6`를 현물 대조했다. 기존 lock·공개 registry·설치 script 비활성 계약은 유지한다.
- 기존 `node scripts/fn02-development-adoption-plan.ts --plan`와 `node scripts/development-schema-probe.ts --plan`만 실행했다. 둘 다 exit0이고 DB접속·config본문 읽기·기동·SQL·새 자원0이다. 저장된 과거 관측을 소비한 첫 결과는 NOT_RECHECKED이며 현재 schema 관측이 아니다.

### P0 — 기존 PG 한 개 cold-start 단독 결정

| 항목 | 현재 exact 범위 |
|---|---|
| 주체·endpoint | WSL-server/daon, uid1000 확인, Docker unix:///var/run/docker.sock / daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e |
| 대상 | 이름 anvil-v3-development-pg / fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba / image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f |
| 현재 state | exited / Running=false / ExitCode255 / OOMKilled=false / RestartCount0 / StartedAt2026-10-20T11:21:54.792276193Z / FinishedAt2026-10-21T00:50:48.509394436Z. 아래 옛 FinishedAt10/18은 사용하지 않는다. |
| 정의 | network anvil-v3-development / ID d3253166eb1adc16fad8a22948b99321238860a74233e3e6318be027f248504e; volume anvil-v3-development-pgdata → /var/lib/postgresql/data RW; 기존 bootstrap-password → /run/secrets/bootstrap-password RO; 127.0.0.1:5546→5432/tcp. 본문/환경변수/비밀값 출력0. |
| 직전 검사 | 조회 성공·위 신원/정의/상태 일치와 Windows3830/5546 listener 부재를 새로 확인. 이미 running/다른 실행의 변경/권한오류면 시작0·보존. |
| 기동 | 직접 승인 게시시각 issuedAt/runId/ref를 고정한 30분 한 창, 마지막180초 새 start 금지. `docker --host unix:///var/run/docker.sock start <위 fullID>` 최대1회·자동 재시도0. WAL/데이터 디스크 쓰기는 발생할 수 있다. |
| 관측·성공 | 최대2분, 같은 신원과 이번 StartedAt 이후 ready 고정 marker를 원격에서 boolean/count로만 축약. 로그 원문·DB접속·SQL/pg_isready0. 성공은 RUNNING_WITH_READY_LOG / DB_ACCESS_UNVERIFIED이며 PG를 running으로 보존한다. |
| 실패·복귀 | 이번 run의 성공한 start/새 StartedAt과 동일 신원·정의가 확인될 때만 정상 SIGTERM stop 최대1회: `docker --host unix:///var/run/docker.sock container stop --signal=SIGTERM --timeout=-1 <위 fullID>`. 관측15초, 종료 미확인이면 STOP_UNCONFIRMED·보고, SIGKILL/kill/rm/재생성0. 소유 불명·start ACK 유실·다른 run 변경이면 추측 stop0. |
| 제외 | schema/seed/role/권한·DB본문 접속·Secret·TLS/신뢰·Windows API/Web/relay·Agent·Oracle/운영0. 소진 PG_ONLY_START_ONCE를 재사용하지 않는다. |

### P1 — 기존 schema 메타데이터 probe 단독 범위

PG running 이후의 별도 읽기 결정이다. 기존 `scripts/development-schema-probe.ts` (SHA256 E03478D44C99E98EC768889865D17262C6C4989EA63A14D391BB374F5FAADF2B)를 재사용한다. 고정 신규 Git source 경로 /home/daon/deploy/anvil-v3-schema-read-probe-01은 현재 부재다. 생성·Git exact 후보/의존성 준비·보호 app.json 참조 읽기·anvil_v3_app의 BEGIN READ ONLY/기한20분 이하·migration(id,checksum)/고정8객체·identity SELECT만 별도 범위로 대조한다. 본문·credential 출력/DDL/DML/role 변경0, 현재52/53개라고 추정하지 않는다. 이 P1의 단1회 명령은 별도 issuedAt/expiresAt/source SHA binding 뒤에만 준비한다.

### P2 — 새 TLS와 현재 사용자 신뢰 한 개

- 2026-10-25 source-only 보완: PMO 위임으로 prepare/start의 `-RecoveryTls`와 probe의 `--recovery-tls` 고정 경로 선택만 준비했다. 새 모드의 실제 생성/신뢰/기동/조회는 **DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED**로 I/O 이전 항상 거절한다. 옛 Fn08Runtime/UseVerifiedWslRelay와 새 모드는 결합 불가이며 보호 선행 구현·실행 승인은 여전히 없다. 신규7+기존runtime1 합성/AST 검사와 type/구문/diff만 확인했다. 현재 source SHA256: prepare `0923B6B6F282A804F4BBE81A794129964858FB190E0E5EC7C3AB12BED94DC8D9`, start `C53A3EC3B1216171CF459F5DEB95F158D39BE1AAD25341AEE1C36455C2CB7850`, probe `74476730DDDE1573EC97701A3AC66F5CF1D67AE3A2E98B6D9535C3624796D870`. 아래 예전 hash는 변경 전 대조 근거이며 새 실행 대상으로 사용하지 않는다.

- 새 대상은 `D:\Project\Anvil\.av3-data\dev-tls-20261025-01`이며 현재 부재다. 기존 dev-tls 파일·키·인증서·기존 신뢰/계정은 보존한다.
- 기존 `scripts/prepare-dev-https.ps1` SHA256 3572488721B0C3452802FADE225A1B0EE9B29DC2D982C855663F7156CE2B6BA2는 DataRoot 전체가 새 .av3-data여야 하므로 그대로 재실행 불가다.
- 필요한 최소 source delta는 최초 생성 모드를 유지한 채 승인된 새 TLS child만 생성하는 분기다. 그 leaf에만 현재 사용자+SYSTEM ACL/키 보호, CA RSA3072/leaf2048·SHA256/서버 EKU/7일·SAN localhost/127.0.0.1/172.27.253.53을 기존 방식대로 생성·검사한다. 현재 WSL 주소에 172.27.253.53이 있음을 확인했고 다른 Docker 주소를 SAN에 추가하지 않는다.
- 생성된 공개 subject/SAN/새 thumbprint를 대조한 **새 CA 하나만 CurrentUser/Root**에 추가·정확1 확인한다. LocalMachine·다른 trust·기존키 변경0, 키/비밀 Git·대화·로그0. 검증 종료/만료의 회수는 그 새 thumbprint만 별도 확인한다.
- 기존 N4의 ancestor 교체 방지 PATH_GUARD는 그대로다. 새 leaf 경로만 승인됐다고 parent 교체 안전·guard가 해결됐다고 주장하지 않으며 실제 생성 전 보호 선행도 대조한다. 아직 code delta 적용/인증서 생성·신뢰 변경0이다.

### P3 — exact source/build와 cold launcher 차이

- 기존 보호 후보 `D:\Project\Anvil\.av3-data\n4-recovery-01\artifacts`와 `...\runtime` 제안을 재사용한다. 아래 철회된 Dtmp source/artifact 경로를 새 이름으로 우회하지 않는다. 이번 조사에서 Dtmp 새 경로는 부재 확인만 했고 생성·추천0이다.
- source는 private Git exact f16a878c에서 실행 전용으로 가져오고 새 개발 branch/정본·자료 복사/서버 archive 배포0이다. 허용된 보호 source·의존성/cache·empty npm config·build·실행 수명/정리를 기존 N4 방식으로 고정해야 한다. 정본과 기존 미커밋은 보존한다.
- **미해결 선행:** 기존 문서의 ancestor OTHER 변경권한과 교체 방지 handle·source 불변 보호는 여전히 미구현/미허가다. leaf ACL만 보고 안전 판정하지 않는다. 정확 guard 구현·검수/사용 범위 결정을 먼저 받으며 기존 guard를 지우거나 옛 native compile 허가를 재사용하지 않는다.
- `start-development.ps1` SHA256 0CFDA44744520A6CE2F41EFCF10199E9FB0BF11A57668DFED1C1DFB39C43B1AC와 `check-development-https.ts` SHA256 9E61136053F703CC7935540DAD0E875D3842FC2187EC1FAF239C8710DB5DB4EA는 old dev-tls 경로 고정이다. 기본 runtime도 이미 존재한다.
- cold-start는 과거 프로세스 교체가 아니다. transition-ui11-development.ps1의 PID23836/relay26052·과거 source/build/hash/기동시각 전제를 사용하지 않는다. FN08Runtime/UseVerifiedWslRelay 예외로 과거 PID guard를 무력화하지 않는다.
- 최소 launcher delta는 승인된 새 TLS·신규 runtime의 고정 binding과 strict HTTPS probe의 같은 CA 참조다. 현재3830/5546 부재 조건에서 기본 launcher의 **본 run 소유 SSH loopback 터널+Node** 흐름을 재사용할 수 있는지 guard 검수 후 확정한다. 기존 auth.json/db-app.json 참조·origin/계정/권한/Secret은 변경하지 않는다.
- 후보 build는 exact source/lock/Node로 새 검증 후 index/JS/CSS hash와 Node/소유 PID·시각·3830 receipt를 실제 기록한다. 과거 ignored dist나 source-only build PASS를 실행 증거로 쓰지 않는다. 실제 기동 전 code/구문·보호/복구 검수와 명령·자원 범위 승인이 필요하다. 아직 source/경로 생성·새 build/기동0이다.

### P2/P3 보호 선행 exact 차이 — 2026-10-25 읽기 대조 / 새 계약 미채택

**현재 사실(71a262/6864e4, 조회 exit0):** 경로 D:\ → D:\Project → D:\Project\Anvil → .av3-data는 directory/reparse=false였다. 앞 세 경로에는 Authenticated Users 등의 Modify 또는 다른 주체의 변경 ACE가 있고, .av3-data는 SINSAN\cyhuh 소유·상속 차단·현재 사용자/SYSTEM FullControl(자식 상속 포함)이다. 두 신규 child는 부재다. 이는 ACL·이름 snapshot일 뿐 handle/file-ID 결박·사용 중 안전 증거가 아니다. 기존 ACL을 수정할 필요가 있다고 단정하지 않는다.

| 필요한 조건 | 기존 primitive / 재사용 판정 | 정확한 추가 차이 |
|---|---|---|
| 신규 child 생성 전 drive부터 .av3-data까지 같은 실체 고정 | ProviderHandleFiles.cs:58~78의 PinnedRoot는 ancestor handles에 FILE_SHARE_DELETE를 주지 않고 identity/final path를 대조한다. 그러나 provider-handles-v1 고정 root·현재 사용자만 허용(기존 SYSTEM ACE도 거절)·연산 한 번 수명으로 **직접 호출/권한 완화 재사용 불가** | 기존 계약 변경 대신 개발 복구 전용 고정 root와 수명의 별도 guard 계약 필요. 각 구성요소를 no-follow로 열고 volume/file-ID/final-path·reparse/종류·현재 parent handle과 자식의 결박을 검증하며, 실패/부분 획득은 역순 close. 단순 문자열 Contains/전체경로 재검사로 대체 불가 |
| parent-relative 열기와 동일 실체 재검사 | SourceReadObserver.cs:46~70의 Relative/NtCreateFile·GetFinalPathName/ID 패턴은 참고 가능. 하지만 Observe:79는 30초·200대상 상한이며 :109에서 모두 dispose한다. ACL 보장·새 child 생성·서비스 수명 보장은 없음 | 새 child 생성 전 부재를 pinned parent 기준으로 확인하고 새 child를 create-new로만 만들되 기존 current-user/SYSTEM 보호 상속 또는 생성 시 동일 제한 DACL을 **실제 대조**해야 한다. 기존 leaf/상위 ACL 수리·기존 파일 교체·오류를 부재로 간주0 |
| 원문/key/config의 read와 source/build 무결성 | ProtectedStore.cs:84 및 transition-ui11-development.ps1:30의 ancestor reparse/hash 검사는 순간 pathname 검사다. PinnedRoot의 file exclusive-open/identity 패턴은 provider 파일 전용이다 | 필요한 파일을 same-handle로 읽고 링크 수·ID·최종경로·권한·정확 manifest/hash를 검사한다. 새 TLS/명시 source/build 경로만 대상이며 기존 Secret 읽기는 승인된 런처의 필요 참조로만 별도 허가. Secret 본문/키 hash 보고0. source와 node_modules의 실제 사용 집합·추가 파일 주입 통제는 아직 규정되지 않았으므로 고정 source hash만으로 실행 승인 불가 |
| 보호 수명 | 기존 start-development는 ready receipt 이후 반환한다. using/finally에서 handle을 닫는 단순 함수 삽입으로는 Node가 남은 동안 경로를 보호하지 못함 | P2 생성·발급·trust 확인 전 구간과 P3 exact Node/자기 소유 tunnel의 전체 수명을 각각 덮는 guardian 소유권/종료 계약 필요. 부모 guard 유실 시 자식이 안전하게 종료되는지/정상 종료 순서·권한·관측을 검수해야 하며 부모 생존 polling만으로 안전을 주장하지 않음 |
| 권한과 실패 | ProviderHandleFiles는 provider credential/DPAPI 계약, SourceReadObserver는 별도 source-read 허가 계약으로 실제 복구 실행기를 대신하지 않음 | 새 개발 guard의 호출 권한·exact commit/hash·시각/수명·대상·잔여0 계약과 OS 부정 시험이 추가 결정 대상. 기존 helper/호스트 등록·서명/credential·옛 컴파일 허가 재사용0 |

**최소 추가 source 후보(작성/컴파일/호출0):** 개발 전용 `scripts/development-recovery-path-guard.cs` 1개와 기존 prepare/start/probe의 명시 adapter 연결, 해당 파일의 handle identity/수명/부분 실패 순수 시험 및 별도 허가된 OS 음성 QA. provider root/ACL 또는 기존 source-read 30초 상한을 바꾸는 공통화는 하지 않는다. 실제 컴파일 도구·assembly/output·호출 host·source 파일 전체 목록/한도·guardian 기간/종료 방식은 아직 exact 결정되지 않았으므로 지금 실행 명령이나 포괄 native 권한을 요청하지 않는다. 현재 source-only RecoveryTls 차단은 유지한다.

**실행/정리/복귀를 결정할 최소 범위:** 기존 D:\~.av3-data는 권한/내용 변경 없이 guard-only; 신규 dev-tls-20261025-01 및 n4-recovery-01의 지정 source/runtime만 create-new·소유 기록, 임의 경로 없음. P2 끝나면 해당 생성 guard를 닫고, P3는 자기 소유 Node/tunnel 종료가 확인된 뒤 역순 close한다. handle이 D:\ 또는 Project의 정상 rename/delete를 막을 수 있고, guardian 유실·정상 종료 지연은 서비스 영향이므로 실제 검수 전 무중단/안전 보장0. 실패 시 새 source/build를 현재본으로 승격하지 않고 소유 process/새 child만 정확 수습한다. 새 trust의 rollback은 새 CA thumbprint1 회수만, 기존 cert/root/key·DB·다른 process/상위 ACL 보존. 종료·소유가 불명하면 삭제/강제 kill0으로 남겨 보고한다.

**PMO에 필요한 결정:** 위 개발 전용 guard/guardian의 신규 source·수명/종료·OS 검증 계약을 별도로 구체화·채택할지, 아니면 현재 fail-closed 보존할지다. 기존 N4 PATH_GUARD 거절 해제·실행 승인으로 간주하지 않는다. 읽기 요청인 이번 단계에서는 새 native source/컴파일/handle·child·ACL·TLS/trust/서비스0이며 기존 불변 시험도 반복하지 않았다.

### 한정 권장안 1 — R0/R1→P2→P3(미채택·실행0)

**순서·독립성:** 최초 compile-only R0 → 격리 OS 음성 R1 → 단기 TLS 생성 P2 → 30분 앱 검수 P3다. P2는 P3 없이 독립 진행할 수 있지만 R0/R1·새 cert/trust 승인이 필요하다. P3는 P2의 유효 CA와 별도 DB/source 선행이 필요하다. P1 읽기는 전부와 독립이다. 아래 시간·한도는 새 제안이며 과거 허가의 연장/영구 서비스 복구가 아니다.

| 항목 | 한정 권장안 / 검수 조건 |
|---|---|
| 신규 source 후보 | scripts/development-recovery-path-guard.cs(고정 path·same-handle identity/DACL·원자 Job/선택 handle 수명), scripts/development-recovery-host.ps1(정확 run/기한·단계·증거/정리), scripts/development-recovery-entry.ts(기존 main과 own 만료 종료 요청) 3개. 기존 prepare/start/check adapter3개·P03 순수 시험1/OS runner1만 연결. 기존 main.ts의 SIGINT/SIGTERM→app.close/pool.end는 재사용한다. 신규 파일 작성0. |
| host/compiler | 기존 C:\Program Files\PowerShell\7\pwsh.exe 7.6.6/hash BFB46AF89433268872DDB43D1CA7A3F433452EE91ED356A9786940F90118E285. compiler=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe 4.8.9221.0/hash46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00. /noconfig /nostdlib+ /target:library /debug- /optimize+와 같은 폴더 mscorlib.dll/System.dll/System.Core.dll 절대 참조3개만. 해시는 각각11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C / 2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71 / 8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D(9a8409 읽기). 새 설치/Add-Type/자동 참조 검색0. |
| R0 bootstrap 대상 | 신규 D:\Project\Anvil\.av3-data\development-recovery-bootstrap-20261025-01 하나/30분·총16MiB·16파일. exact 승인 commit의 위 source·host/시험 입력만 Git 객체 대조 후 create-new, output은 같은 root DevelopmentRecoveryPathGuard.dll 하나. 부재/owner/nonlink/부모 보호상속·입출력SHA·컴파일exit를 대조하고 정확 DLL 바이트만 메모리 로드, provider/helper 등록0·다른 output 재시도0. |
| **R0 미해결 위험/결정** | guard 자체가 없는 최초 입력/출력 준비와 compiler의 pathname 열기에는 상위 교체 경쟁이 남는다. 열린 source 파일·hash·leaf ACL만으로 이를 제거했다고 하지 않는다. **이 bounded bootstrap 예외의 허용 여부 자체가 별도 사용자 결정점**이다. 미승인이면 R0=0, 기존 PATH_GUARD 허가/다른 폴더·ACL수리로 우회0. 이 위험을 감수한 compile 승인이 실제 TLS/앱 실행 승인도 아니다. |
| R1 OS 음성 | bootstrap 아래 os-qa 합성 directory/file/manifest만/30분·64파일·8MiB. reparse·부모교체·외부쓰기·ID/hash/링크/DACL변조·기한/clock역행·부분획득·guardian유실을 검사한다. child 수명은 기존 pwsh의 고정 종료/대기 동작 최대2프로세스/60초·새 unnamed Job 원자결박만. Secret/cert/DB·실Node/SSH0. 원 반환·자식exit/Job0·잔여0 실측 전 지원PASS0. |
| P2 범위 | 별도10분 창/CA·leaf각1/7일·기존SAN3개, 신규 dev-tls-20261025-01의 ca.cer/ca.cert.pem/ca.key.pem/server.cert.pem/server.key.pem/receipt.json 6파일·128KiB만. host의 원 native lease가 parent/child pins를 전체 발급·새 CurrentUserRoot1 확인까지 보유한다. 임의 CLI/직렬화 boolean을 lease로 인정0. 기존 auth/db/old TLS 읽기·수정0, 기존 Root/LocalMachine0. 실패 시 exact 새 CA thumbprint1만 회수·소유 새child 수습, 소유/신뢰 불명이면 자동삭제0. |
| P3 사용 파일 | 신규 n4-recovery-01/artifacts의 exact Git·lock 기반 apps/server/**, contracts/**, apps/web/dist/**, entry·node_modules/**·해석용 package.json을 **실제 파일별 ID/hash manifest**로 고정한다. 최대100000파일·2GiB. glob은 탐색 한도일 뿐 완성 목록이 아니며 현재 실제 파일집합은 미확정이다. 누락/추가동적읽기면 보완 전 실행0. 기존 auth.json/db-app.json·새TLS의 필요한 읽기만 별도 허가·본문출력0. 새 runtime receipt/log는16파일·8MiB. |
| P3 원 process/기한 | 별도30분 한 창·첫25분 안에 start1, Node24.18.0/hash9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE 1개·own SSH loopback5546 tunnel1개만. native 원 process/thread를 Job에 원자 할당한 상태로 만들고 owner/image/기한·선택 path pins를 대조한 뒤 resume. 외부 PID/옛relay인수0. entry는 만료30초 전 기존 SIGTERM callback으로 정상닫기를 요청, 15초 안에 원 process handle exit·Job active0을 확인한다. 요청만으로 완료/COMMIT확정0. |
| 유실/종료 경쟁 | Job handle은 host만, 필요한 path-pin 복제본만 원 자식의 제한 handle list로 보존·다른 상속/breakaway0. host가 사라져도 자식 종료까지 pins가 남고 kill-on-close가 작동하는지 **실제 OS 음성 검수 필수**, 미확인이면 P3 start0. 정상종료 미확인/만료/guard위반 시 그 새Job 자기소유 자식만 강제종료하는 위험을 별도 승인받고 15초 exit/Job0 관측. 실패는 TERMINATION_UNCONFIRMED, PG/다른process kill0. 강제종료로 진행 중 요청/COMMIT 결과가 불명일 수 있어 무손실 보장0. |
| 정리/rollback | R0/R1 완료 때 exactroot owner/link·생존 compile/시험process0 후 그 신규root만 정리·독립부재확인. P2 성공 자료는 개발용 보호보존·종료/만료 때 새CA1만 회수. P3는 ownNode/tunnel 종료·Job0 확인 뒤 pins 역순close, exact 새source/runtime만 기록된 정책으로 보존/정리한다. 신원·종료불명은 삭제/추정kill0. 기존CA/runtime·계정/정책·PG·상위ACL 보존. |

**결정 순서:** source/adapter/시험 계약 → 원 source/hash 검토 → R0 bootstrap 예외·compile-only → R1 OS QA → P2 cert/trust → P3 source/build·Job 강제종료 위험 포함 앱 검수의 각각 별도 실행 결정을 권장한다. 현재 신규 source hash/완성 manifest·host 실제 lease/Job 수명은 구현·검수 뒤 고정해야 한다. 현재 차단은 유지하고 이 문서만으로 새 native source/컴파일/handle/child/ACL/cert/trust/서비스를 실행하지 않는다.

### P4 — 46→53 schema 적용은 기동과 별도

기존 adoption plan이 현재 source에서 산출한 순서는 0012_assignment_drafts→0013_assignment_confirmation→0014_context_preparation→0015_project_baselines→0016_execution_preparation→0017_execution_authority→0031_empty_project_methodology_application이다. 저장 관측46 manifest hash da9a9e45107a822d2c56fff2f54878be6ba6dab6ff0f44dec58212c6eb8d7091, target53 hash 9b8962f66829d90fc8eb08cc918773566c94cd2ba62ae0bfed7e86549db6e4e1. 각 SQL checksum/중간 hash는 기존 --plan 결과로 재현한다.

**실제 실행기 공백:** `applyFn02MethodApplicationSchemaOnly`는 정확52 선행을 요구하고 **0031 한 개만** 적용한다. `ANVIL_MIGRATION_MODE=FN02_METHOD_APPLICATION_ONLY`를 46→53 전체 runner로 제시하지 않는다. 일반 migrate-development 모드는 forms/methodology/QA seed까지 하므로 이번 schema-only 재개 명령으로 사용하지 않는다.

현재 P1 관측·정확 백업/복원 검증/81표·비표 객체·기존 row/권한·기준 지문 보존과 7개 명시 실행/원자성·실패 rollback 범위를 별도 결정받는다. 기존0012 특정거절은 미해결이며 새 runner/이름으로 우회하지 않는다. 실제DDL/DML·정책·계정·승인/자료 전환0이다.

### 바로 진행한 결과와 결정 책임

Main은 위 source 추적·실제 PG 정의/WSL Git·Node/lock·신규 대상 부재·기존 두 plan-only 실행을 완료했다. 이는 서비스 복구/기능 수용 PASS가 아니다. PMO는 우선 **P0 한 개**의 정확 직접 결정을 처리하고 P1~P4를 묶지 않는다. Main은 결정·지원 도착 시 그 exact 범위를 직접 실행/검증하고, 다음 작업 배정을 기다리며 멈추거나 미승인 범위를 자동 실행하지 않는다.


## 2026-10-19 PG 단독 최소 복구 한정안 — 별도 결정 필요

이 절만 새 결정 대상이다. 기존 광범위 N4 source/build/경로 예외를 승인·재사용하거나 PATH_GUARD 거절을 해소하지 않는다. 상태는 **PROPOSED_NOT_AUTHORIZED**이며 runner 작성·start/stop 실행0이다.

| 항목 | 고정 한정안 |
|---|---|
| 대상 | WSL-server/daon, Docker `unix:///var/run/docker.sock`, daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`; 기존 PG `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, 이름 `anvil-v3-development-pg`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`만 |
| 기존 정의 | network `anvil-v3-development`/ID `d3253166eb1adc16fad8a22948b99321238860a74233e3e6318be027f248504e`, pgdata volume `anvil-v3-development-pgdata`, `127.0.0.1:5546→5432/tcp`, 기존 bootstrap-password bind는 읽기전용. 재생성·정의/내용 변경0 |
| 최초 창/횟수 | 직접 승인 게시시각을 최초 issuedAt으로 고정한 30분 한 창·start 최대1회/자동재시도0. 실제 승인 ref/runId/issuedAt/expiresAt은 현재 null이며 승인 뒤 단1회 고정·대조 전 실행0. 마지막180초에는 새 start 금지. 만료·거절·중지/새 답변은 즉시 우선하며 창 자동갱신0 |
| 직전 precheck | user/socket/daemon/fullID/image/name·mount/network/port·exited255/Finished2026-10-18T05:12:28.197325125Z/restart0·기존 Windows3830/5546 listener0을 다시 대조. 이미 running/다른 상태·정체성/정의 변경·권한 오류면 시작하지 않고 보존/보고. 값/키/DB본문 읽기0 |
| 단1회 start | `docker --host unix:///var/run/docker.sock start e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`. 정상 기동/WAL 복구의 기존 데이터 디스크 쓰기는 가능하며 물리 DB쓰기0을 보장하지 않음. 설정·schema·seed·SQL·권한 변경0 |
| 최대2분 관측 | 같은 daemon/fullID/image·StartedAt/RestartCount·State만 읽고, 이번 StartedAt 이후 container 로그에서 PostgreSQL의 ready 고정 marker 유무만 원격에서 boolean/count로 축약(로그 원문 전송/출력0). 새 healthcheck/exec/pg_isready·TCP/DB 접속·SQL0. 기존 healthcheck가 **none**이므로 성공도 `RUNNING_WITH_READY_LOG / DB_ACCESS_UNVERIFIED`일 뿐 health·인증·SQL·기능 PASS 아님. marker 부재/종료/관측불가면 실패/미확인 |
| 실패 때 정상 stop | 이번 run이 위 exited 기준에서 실제 시작한 같은 fullID·daemon/image·StartedAt/restart/정의 불변을 확인한 경우에만 `docker --host unix:///var/run/docker.sock container stop --signal=SIGTERM --timeout=-1 e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba` 정상stop 최대1회. stop도 정상 checkpoint/WAL 디스크 쓰기 가능. 다른 run 변경/소유 불명확이면 stop0 |
| 복귀 한계 | stop 요청 뒤15초까지만 관측. daemon의 정상종료 대기는 무기한일 수 있고 대기 SSH/stop 명령을 강제 종료하지 않는다. 종료를 확인하면 `STOPPED_AFTER_FAILED_START`; 아니면 `STOP_UNCONFIRMED`로 대상·미종료 helper 관측을 보존/보고. 원정지상태 복귀를 보장하거나 SIGKILL/재stop/삭제·volume복원/권한수리로 강행하지 않음 |
| 성공 보존·제외 | 성공한 동일 PG는 개발용 보존. API/Web·relay/새포트·실제 DB접속/SQL·migration/QA entity·계정/정책/Secret/cert·새 runner/설치·Agent/비용·FN01H4/FN05신규GET·Oracle/운영 변경0. 다른 계획 작업을 중단시키지 않음 |

필요한 직접 결정은 **이 절의 단1회 start·최대2분 상태/ready-log 관측·실패 때만 강제kill 없는 정상stop1회와 STOP_UNCONFIRMED 한계·startup/stop의 WAL 쓰기 위험·성공 개발용 보존**이다. 권장안은 이 한정안, 대안은 정지 상태 보존이다. 관측의 첫 Go-template range 오류는 SSH shell 변수 확장으로 발생했고, 변수 없는 기존 network JSON 읽기로 정정했다. Docker stop의 SIGKILL/무기한 대기는 이 문서의 공식 문서와 실제 설치 도움말로 대조했다. 새 실행기 작성이나 실제 명령 허가는 아직 없다.

상태: `PROPOSED_NOT_AUTHORIZED / PATH_GUARD_UNRESOLVED`, r2. 실행기 작성·자원 생성·실행 0. Main 어울, 2026-10-18. 최초 tmp안은 아래 ACL 대조로 철회했고 승인 대상으로 유지하지 않는다.

## 목적과 현재 사실

신규 제품 후보가 아니라 마지막 검증 source `6781703a8fd7d258aa7f972bb5f81acaf5c3d388`의 API/Web만 복구한다. 현재 개발 후보 branch와 사용자 자료는 유지한다. 계획 개발과 복구 지원은 분리한다.

- Windows3830/5546 LISTEN0, 이전 API54212/relay26052 부재. 정지 원인·주체 미확정.
- WSL 정식 Git `ff0fcd13695ae0affa2fd773dc96667e1d7c88f8` clean. 기존 PG 동일 fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, exited255/finished2026-10-18T05:12:28.197325125Z/OOMfalse/restart0.
- 기존 보호11hash·Node hash 유지, 지정 개발 CA의 실제 사용자 신뢰1·공개 인증서 유효. 비밀값은 읽거나 기록하지 않는다.
- 마지막 source/이전 rollback Git 객체는 있으나 현재 build는 새 후보다. 옛 N4 index/JS/CSS를 즉시 재사용할 수 없고 단순 Node 재시작은 복구가 아니다.
- 기존 N4 명령은 만료·단1회 소진·옛 PID/relay 전제이며 재실행하지 않는다. 기존 launcher도 runtime 존재/relay 부재로 현재 복구 명령이 아니다.

## 새 자원 제안 — 생성 전 별도 정확 허가 필요

1. 최초 tmp artifact안은 OTHER 쓰기/삭제 위험 때문에 철회했다. 기존 ACL 수리는 제안하지 않는다. **대체 예외 제안**은 기존 보호 부모 `.av3-data` 아래 신규 `n4-recovery-01/artifacts`와 `n4-recovery-01/runtime`뿐이며 아직 생성하지 않았다. 정확 공식 대상은 `D:\Project\Anvil\.av3-data\n4-recovery-01`이다. 마지막 Git source ZIP·source/build manifest·고정 lock 의존성·후보 build용 artifact이며 새 개발 정본/branch가 아니다. source 사용 중 삭제하지 않고 새 전환·검증 또는 CA 만료 전에 서비스 회수 후 정확 정리한다. runtime receipt/out/err는 복구 근거로 보존한다.
2. `.av3-data`·기존 N4 runtime은 상속 차단/current user+SYSTEM FullControl/nonlink를 실제 확인했으나, 상위 Project/Anvil 및 조사한 사용자 프로필·ProgramData 계열에 OTHER 변경 권한이 남아 있다. **보호 leaf만으로 상위 경로 교체 안전을 증명할 수 없다.** 선택 대안은 기존 ACL을 고치지 않고 정확 ancestor의 교체 방지 handle·source 파일 변경 방지/검증을 서비스 수명 동안 유지하는 guard 후보를 별도 설계·검수하는 것이다. 아직 guard 코드/컴파일/handle 생성0이며 옛 소진 native compile/assembly 허가를 재사용하지 않는다. 이 guard·신규 경로/보호 예외가 확정되기 전에는 대체 root도 실행 불가다. 다른 위치를 안전하다고 추정해 순회·생성하지 않는다.
3. PG는 위 기존 fullID만 사용한다. network/volume/bind/역할/설정은 기존 그대로이며 새 DB/container/seed/migration/Agent·Oracle/운영은 없다. source 파일을 WSL로 복사·archive 배포하지 않는다.

원 QA 경로 심사 거절·직접 확인 미답변은 이 제안으로 해소하지 않는다. 위 새 경로 허가가 모호하거나 거절되면 생성/대체 경로 재시도 0이다. 새 branch/세션/자동화/정본 재구성도 하지 않는다.

## 실행기를 작성할 경우의 명령·효과 계약

아래는 그대로 실행하는 스크립트가 아니다. 아직 runId·issuedAt·expiresAt·실행기 hash·허가 ref가 없으므로 모든 mutation은 비활성이다. PMO의 업무 배정이 아니라 복구의 정확 승인 경계만 필요하다.

| 단계 | 고정 명령·검사 계약 | 부수효과·거절 조건 |
|---|---|---|
| Source | 기존 local Git에서 `git archive --format=zip --output=<신규 복구 root>/source.zip 6781703a8fd7d258aa7f972bb5f81acaf5c3d388`, 해당 root/source에만 해제 | branch/HEAD 변경0. 생성 전 root 부재·모든 부모 실경로/link·owner·공간 검사. Git tree 경로·파일 hash와 해제본 대조. 현재 dirty 자료 덮기0 |
| Build | exact lock·기존 Node exe SHA256 `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`에서 아래 고정 의존성 명령·기존 `npm run build` | 새 의존성/자동수정0. 설치·build 실패면 PG/API 시작0. 실제 install/cache/registry 접근은 새 허가 전0 |
| Asset gate | N4 index SHA256 `1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216`, JS `923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9`, CSS `034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56`와 재현본 exact 대조 | 하나라도 불일치하면 새 후보를 옛 후보라 부르지 않고 중단/보고. 현재 개발 dist/원본 교체0 |
| PG | SSH WSL-server에서 기존 socket의 `docker --host unix:///var/run/docker.sock start <위 fullID>` | 실행 직전 fullID/image·기존 mount/network/port·종료 상태 재대조. 정상 기동/WAL 복구는 디스크를 쓸 수 있으므로 ‘물리 DB쓰기0’라고 주장하지 않음. schema/seed/권한 변경은 없음 |
| DB gate | 기존 app 설정만 소비해 READ ONLY 현재 migration46/ID·checksum·81표 지문을 과거 N4와 대조 | 신규 migration/QA entity/실사용자 쓰기0. 실제 지문이 다르면 보존/보고하며 과거 지문으로 덮지 않음. 불일치 상태 API 시작0 |
| Relay | PG start 후 기존 WSL localhost forwarding의 새 127.0.0.1:5546 소유자/exe/시각 확인 | 옛 PID26052 재사용 금지. 자동 복원되지 않으면 새 SSH tunnel/portproxy/WSL 설정을 대안으로 임의 생성하지 않고 그 단계만 보고 |
| API/Web | 복구 source의 `node --title=<새 runId에 묶인 제목> apps/server/main.ts`를 `Start-Process -WindowStyle Hidden`으로 실행 | exact 기존6환경·NO_ARTIFACT_ROOT만 child에 전달. TLS/auth/DB는 기존 보호 ref. 127.0.0.1:3830만, 기존 파일/CA/계정 변경0. 신규 runtime stdout/stderr·receipt, 새 PID/exe/owner/start/title 기록 |
| 후검사 | strict TLS health200, N4 index/JS/CSS 응답hash, 무자격 보호 API401, 실제 DB READ ONLY 지문·보호hash/새 PID·포트 재대조 | 실제 로그인/원문 저장·Agent·전체 사용자 여정 PASS로 승격하지 않음. 인증 우회·TLS 무시·timeout 확대0 |

## 실패와 복구 한계 — 확정 전 남은 정확 결정

- 이번 생성 API PID/연결만 신원을 재확인해 회수한다. 다른 프로세스·기존 컨테이너/volume/network/데이터/보호 이력 삭제0. 기존 프로세스 메모리를 복원한다고 약속하지 않는다.
- PG start 뒤 후검사/API 실패 시 **기존 PG를 정상 stop해 원 중단 상태로 돌릴지, 컨테이너·데이터를 보존한 running 상태로 둘지** 정확 허가가 필요하다. 대상은 이번 run이 exited 기준에서 직접 시작한 위 동일 fullID로 한정한다. 다른 run/사람이 변경했거나 실행 소유를 확인하지 못하면 stop하지 않는다. ‘신규 PID만 회수’와 ‘PG까지 중단 상태 복귀’를 동시에 무조건 성립한다고 쓰지 않는다.
- 설치된 Docker stop은 `--signal`/`--timeout`을 지원하며 기존 PG StopSignal은 SIGINT다(읽기 확인). 유한 timeout은 경과 후 SIGKILL하므로 **`docker stop --timeout=15`를 강제 종료 없는 명령이라 제시하지 않는다.** [Docker 공식 stop 문서](https://docs.docker.com/reference/cli/docker/container/stop/) 참조. 강제 종료 없는 대안은 `docker --host unix:///var/run/docker.sock container stop --signal=SIGTERM --timeout=-1 <위 fullID>`다. runner의 관측은15초로 제한하되 daemon의 정상 종료 대기는 무기한일 수 있다. 15초 안에 종료를 확인하지 못하면 STOP_UNCONFIRMED/실패로 보존·보고하고 SIGKILL/재시도/volume 복원·삭제를 하지 않는다. 따라서 유한 관측과 실제 유한 종료 보장을 구분하며 이 한계를 허가 질문에 포함해야 한다. 이 명령도 아직 미실행/미승인이다.
- 신규 root/권한·의존성 접근/유한 창과 exact 실행기·후검사·정리 명령은 허가 범위 대조 후 Main이 고정하고 독립 읽기 검수를 받는다. 이 문서 작성/검수는 실제 복구 승인이나 원 거절 해제가 아니다.

## 의존성 접근 고정안 — 실제 설치/전송 0

- 마지막 source의 package-lock v3 SHA256 `ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6`를 Git 객체에서 읽었다. packages146·resolved origin은 `https://registry.npmjs.org` 하나·전부 integrity 필드가 있다. Node24.18.0/npm11.12.1이며 source engines와 일치한다.
- 기존 `C:\Users\cyhuh\AppData\Local\npm-cache/_cacache`는 metadata상65개만 존재, 단순 OS/CPU 적합102개 중65개다. cache 바이트 integrity는 실행하지 않았고 offline 설치 가능이라고 주장하지 않는다. 기존 cache를 쓰거나 통째로 복사하지 않는다. install script 표식은 macOS용 fsevents1개였고 **모든 install/lifecycle script를 비활성**으로 제안한다.
- 허가를 구할 명령은 새 보호 artifact/source cwd의 `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --cache=<허가된 artifact>/npm-cache --userconfig=<허가된 artifact>/empty-user.npmrc --globalconfig=<허가된 artifact>/empty-global.npmrc`다. 빈 config2개·cache도 신규 대상이며 미생성이다. parent NPM_CONFIG_*·proxy/credential·NODE_OPTIONS/NODE_PATH/비표준 TLS override는 child에 승계하지 않고 고정 Node/npm만 사용하도록 정확 runner 계약을 검수한다.
- 전송은 lock에 있는 공개 패키지 이름/버전·정확 tarball/필요 registry metadata 요청과 기본 도구/OS 식별 정보만이며 프로젝트 원문/소스·실제 계정/Secret·audit POST는 제외한다. 응답 integrity는 npm lock 검사·정확 build/hash gate로 검증한다. registry의 접속로그 보관은 외부 운영정책이며 Anvil이 삭제한다고 보장하지 않는다. 설치 후 root script는 읽어 확인한 `build`(typecheck+고정 Vite)만 실행한다. lock 개정·upgrade/fund/audit fix·postinstall·유료 서비스·새 trust는 없다.

## 2026-10-25 R0 정확 호출 후보 — 미적용 delta·원 exec·보존 조건

**판정: 검토용 후보 구체화 / ACTUAL_NOT_AUTHORIZED / NOT_RUN.** 아래는 기존 R0 단일 컴파일 한 건의 추가 결정 자료다. 기존 이력·제품 source·첫 고정 throw·네 gate=false·실제 QA maxProcesses=2·역사 d71/F81 원문은 변경하지 않았다. 이 문서의 명령 예시는 실행하지 않았다. 실제 compiler/native/DLL load·파일 생성·보호 원문·DB/TLS/서비스/Agent·새 실행 host/QA/권한 변경은 0이다. 이전 표의 ‘생성한 세 파일 정리’는 현재 body가 성공 DLL까지 자동 회수한다는 뜻으로 재사용하지 않는다.

### 1. 읽기로 고정한 대상과 권장 진입

- 최초 검토 host는 `scripts/development-recovery-host.ps1`, raw **36,315 bytes / SHA256 D204FF0CA70ED57D2CEFA5DFF2909055E9B423D50E1A6BE961AD0C4DC408DF98 / LF / CR 0**였다. **D204/D28은 M1 보완 전의 역사 후보이며 최종 현재 실행값으로 재고정하지 않는다.** 현재 새 원/미적용 후보는 다음 표에 별도로 고정한다. `Invoke-DevelopmentRecoveryR0CompileSource` 첫 I/O 전의 `DEVELOPMENT_RECOVERY_R0_NOT_AUTHORIZED`는 유지한다. 직접 파일 실행은 마지막 top-level gate도 거절하므로, `-Plan`이나 새 CLI 옵션을 실제 실행 진입점으로 제시하지 않는다.
- 권장은 **정확 외부 실행 결정 → 같은 원 PowerShell exec에서 loose Git object를 메모리 복원 → 승인된 한 줄 delta의 host도 같은 원 FileStream에서 private byte[]로 취득·정확 hash 확인 → 엄격 UTF-8 decode한 고정 ScriptBlock을 dot-source → raw byte[]를 기존 함수에 정확 1회 전달**이다. `GetFileHash(path)` 뒤 같은 pathname을 다시 읽어 실행하지 않는다. runner 안에서 git.exe·별도 pwsh·cmd·shell wrapper를 만들지 않는다. DLL load/Add-Type/facade/현재 native로 교체도 없다. dot-source 자체는 실행 권위를 발급하지 않는다.
- 원 exec는 native가 아닌 PowerShell 부모이며 compiler의 직접 child만 1회다. 외부 실행 승인과 플랫폼 승인은 별도다. 승인 거절·권한 오류·경로/지문 불일치는 그대로 중단·보고하며 다른 host/위치/권한/명령으로 바꾸지 않는다. bool/JSON/nonce/digest를 새 승인 권위로 만들거나 상시 gate 우회 함수를 추가하지 않는다.

| M1 보완 제출 뒤 현재 검토 tuple | 원 exec 읽기 결과(d0aad0 exit0) |
|---|---|
| 현재 source raw | **36,404 bytes / LF·CR0 / B1B72F61F79906F816FB005322B600F66772D05A5C3D88CFE313516DB373A1A7**. 고정 source throw 유지. locale 단어 대신 고정 CS ID+진단 구분자 정규식/설명만 보완한 제출본이며 독립 scoped 검수 중 |
| 미적용 단1줄 delta | 동일 LF throw48 bytes 한 번만 삭제한 메모리 후보 **36,356 bytes / 8D03365E9A97A9A56BF320233D95010A07D4F3340EFD5362D3195ECCDB99DFAC**. 원 파일 변경0, 후보 PS AST 오류0, 실제 dot-source/Invoke0 |
| 별도 집중시험 | Main 인계 지문 **3F24630511989113BC9E490109E85596405C89E3819C095D79EAAFCF8028A1BC**. 이 작성자는 시험 실행/해당 파일 지문 확인을 수행하지 않았으며 Main 검수 근거와 구분 |

위 tuple을 exact 실행권위로 사용하지 않는다. 독립 검수 결과/외부 결정/원 exec 수명·전체 창/정리 계약은 여전히 선행이며 실제 실행 준비 PASS가 아니다.

**raw 취득 읽기 증거:** 현재 common Git root는 `D:\Project\Anvil\.git`이고 loose object `objects\8d\38a21bf18f5b6bed95c8582b87d12e090d95f3`가 실제 존재한다. 압축 30,236 bytes를 원 exec의 `ZLibStream`으로 메모리에서만 복원했다. 비압축 96,964 bytes의 앞 11 bytes는 정확 ASCII `blob 96953<NUL>`, body 96,953 bytes, 추가 비압축 byte EOF=true, 압축 stream Position=Length=30,236이었다. 비압축 header+body의 SHA1은 **8d38a21bf18f5b6bed95c8582b87d12e090d95f3**, body SHA256은 **F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49**였다. 별도 read-only `git ls-tree d71eb50870b088f57e1648ee4a1eba36aa058557 scripts/development-recovery-path-guard.cs`도 같은 blob의 commit 결박을 확인했다. raw source 본문 출력·실파일 생성·현재 native 읽어 대체는 0이다.

다음은 **새 8D0336 후보를 사용한 원 exec 취득·호출 검토 예시**다. 새 M1 독립 검수와 외부 exact 결정 전에는 실행하지 않는다. 새 제품 함수/스크립트 파일로 등록하지 않는다. 압축 object는 무제한 ReadAllBytes 대신 같은 원 FileStream에서 Length30236 확인→고정 배열 읽기→EOF/길이 재확인 후 메모리 복원한다. Git raw source는 문자열 변환/개행 재작성0이며 host만 hash 확인한 같은 private bytes를 엄격 UTF-8로 decode한다.

```powershell
$ErrorActionPreference='Stop'
$r0Object='D:\Project\Anvil\.git\objects\8d\38a21bf18f5b6bed95c8582b87d12e090d95f3'
$r0Compressed=[byte[]]::new(30236)
$r0ObjectStream=[IO.FileStream]::new($r0Object,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try {
 if($r0ObjectStream.Length -ne 30236){throw 'R0_OBJECT_CHANGED'}
 $r0Offset=0
 while($r0Offset -lt $r0Compressed.Length){
  $r0Read=$r0ObjectStream.Read($r0Compressed,$r0Offset,$r0Compressed.Length-$r0Offset)
  if($r0Read -le 0){throw 'R0_OBJECT_SHORT'}
  $r0Offset+=$r0Read
 }
 if($r0ObjectStream.ReadByte() -ne -1 -or $r0ObjectStream.Length -ne 30236){throw 'R0_OBJECT_EXTRA'}
} finally {$r0ObjectStream.Dispose()}
$r0Memory=[IO.MemoryStream]::new($r0Compressed,$false)
$r0Zlib=[IO.Compression.ZLibStream]::new($r0Memory,[IO.Compression.CompressionMode]::Decompress,$true)
$r0Expanded=[byte[]]::new(96964)
$r0Raw=[byte[]]::new(96953)
$r0Sha1=[Security.Cryptography.SHA1]::Create()
$r0Sha256=[Security.Cryptography.SHA256]::Create()
try {
 $r0Offset=0
 while($r0Offset -lt $r0Expanded.Length){
  $r0Read=$r0Zlib.Read($r0Expanded,$r0Offset,$r0Expanded.Length-$r0Offset)
  if($r0Read -le 0){throw 'R0_OBJECT_SHORT'}
  $r0Offset+=$r0Read
 }
 if($r0Zlib.ReadByte() -ne -1){throw 'R0_OBJECT_EXTRA'}
 $r0Zlib.Dispose()
 if($r0Memory.Position -ne $r0Memory.Length -or
    [Text.Encoding]::ASCII.GetString($r0Expanded,0,11) -cne "blob 96953`0") {throw 'R0_OBJECT_HEADER'}
 [Array]::Copy($r0Expanded,11,$r0Raw,0,96953)
 $r0Blob=[BitConverter]::ToString($r0Sha1.ComputeHash($r0Expanded)).Replace('-','').ToLowerInvariant()
 $r0Digest=[BitConverter]::ToString($r0Sha256.ComputeHash($r0Raw)).Replace('-','')
 if($r0Blob -cne '8d38a21bf18f5b6bed95c8582b87d12e090d95f3' -or
    $r0Digest -cne 'F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49'){throw 'R0_OBJECT_DIGEST'}
 # 새 8D0336 후보 예시. 독립 검수와 외부 exact 결정 전 호출 금지.
 $r0Host=Join-Path (Get-Location).ProviderPath 'scripts\development-recovery-host.ps1'
 $r0HostBytes=[byte[]]::new(36356)
 $r0HostStream=[IO.FileStream]::new($r0Host,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try {
  if($r0HostStream.Length -ne 36356){throw 'R0_HOST_CHANGED'}
  $r0Offset=0
  while($r0Offset -lt $r0HostBytes.Length){
   $r0Read=$r0HostStream.Read($r0HostBytes,$r0Offset,$r0HostBytes.Length-$r0Offset)
   if($r0Read -le 0){throw 'R0_HOST_SHORT'}
   $r0Offset+=$r0Read
  }
  if($r0HostStream.ReadByte() -ne -1 -or $r0HostStream.Length -ne 36356){throw 'R0_HOST_EXTRA'}
 } finally {$r0HostStream.Dispose()}
 $r0HostDigest=[BitConverter]::ToString($r0Sha256.ComputeHash($r0HostBytes)).Replace('-','')
 if($r0HostDigest -cne '8D03365E9A97A9A56BF320233D95010A07D4F3340EFD5362D3195ECCDB99DFAC'){throw 'R0_HOST_CHANGED'}
 $r0HostText=[Text.UTF8Encoding]::new($false,$true).GetString($r0HostBytes)
 $r0HostScript=[scriptblock]::Create($r0HostText)
 if($null -ne (Get-Variable -Name DevelopmentRecoveryR0Retain -Scope Script -ErrorAction Ignore)){throw 'R0_CLOSURE_ALREADY_PRESENT'}
 . $r0HostScript
 $r0RetainOriginal=(Get-Variable -Name DevelopmentRecoveryR0Retain -Scope Script).Value
 $r0ModuleOriginal=$r0RetainOriginal.Module
 $r0LifetimeOriginal=$r0ModuleOriginal.SessionState.PSVariable.GetValue('lifetime')
 if($r0LifetimeOriginal -isnot [hashtable] -or $r0LifetimeOriginal.Count -ne 2 -or
    !$r0LifetimeOriginal.ContainsKey('started') -or !$r0LifetimeOriginal.ContainsKey('retained') -or
    $r0LifetimeOriginal.started -isnot [bool] -or $r0LifetimeOriginal.started -or
    $null -ne $r0LifetimeOriginal.retained){throw 'R0_CLOSURE_SHAPE_UNKNOWN'}
 $r0SynchronousCallFinished=$false
 try {$r0Result=Invoke-DevelopmentRecoveryR0CompileSource -GitSourceBytes $r0Raw}
 finally {$r0SynchronousCallFinished=$true}
 # 결과는 §4의 축약 항목만 회수한다. 보존 결과면 §5의 원 host 수명 조건을 적용한다.
} finally {
 $r0Zlib.Dispose()
 $r0Memory.Dispose()
 $r0Sha1.Dispose()
 $r0Sha256.Dispose()
 [Array]::Clear($r0Raw,0,$r0Raw.Length)
 [Array]::Clear($r0Expanded,0,$r0Expanded.Length)
 [Array]::Clear($r0Compressed,0,$r0Compressed.Length)
 if($r0HostBytes){[Array]::Clear($r0HostBytes,0,$r0HostBytes.Length)}
}
```

위 PowerShell fence 내부를 UTF-8/no BOM/LF/마지막 개행 없음으로 고정한 **역사 부분 호출 프레임은 4,198 bytes / SHA256 10ECE1476C5C2D61BDCF073C3C46E24C426B4CD3D5AC50C345705A0C1E81B74A**이며 PS AST 오류0(12f1b3 exit0)이다. 이전3,419/6DED5B…은 원 closure 고정·동기 unwind 표식 추가 전 역사 프레임이다. fence·설명·별도 host 후속관측/보존/해제 계약은 프레임 hash에 포함하지 않았다. §6의 별도 완결 fence가 전체후보이며 이 부분 프레임만 실제 호출하지 않는다.

기존 ReadAllBytes 복원에 이어 고정 FileStream/Length30236/배열/EOF 읽기도 별도 read-only로 확인했다(3bdc78 exit0: compressed30236/expanded96964/양쪽EOF/같은blob SHA1). 고정 throw가 있는 B1 source의 strict decode/ScriptBlock dot-source는 §4.1의 cold closure 순수 probe로만 확인했으며 **throw 제거8D 후보의 실제 dot-source/R0 함수 호출 구간은 NOT_RUN**이다. 같은 private bytes의 hash→decode→ScriptBlock 고정은 host hash 확인 뒤 pathname을 다시 실행하는 경합을 없애지만 부모/leaf 신원·원 compiler 실행 경합을 해결하지 않는다. SHA/EOF 검사는 blob 원문을 고정하며 commit 작성자의 실행 권한, filesystem 고정, compiler 안전을 대신하지 않는다. objects가 pack으로 바뀌거나 경로/크기가 달라지면 git child·새 fetch·자동 다른 취득으로 대체하지 않고 패킷을 재고정한다.

### 2. 첫 throw와 외부 exact 결정의 연결 — 제안만 / 실제 적용 0

새 command·상시 helper·caller 권위 없이 현재 body를 시험하려면 다음 **단1줄 48 bytes 삭제**가 최소 delta다. 원 LF bytes 전체는 메모리 보관·독립 hash 확인하고 다른 줄/주석/기존 gate/QA tail을 바꾸지 않는다. 다음 patch는 제품에 적용하지 않았다.

```diff
 function Invoke-DevelopmentRecoveryR0CompileSource([byte[]]$GitSourceBytes) {
  # 이 고정 throw는 첫 I/O와 내부 I/O 함수 정의보다 앞선다. caller bool/JSON/digest는 제거 권위가 아니다.
- throw 'DEVELOPMENT_RECOVERY_R0_NOT_AUTHORIZED'
  # 아래는 검수할 실제 runner 본문이며 현재 실행 불가다. raw 취득/호출/종료 요청까지 별도 exact 실행 경계다.
```

- 역사 원 host raw **D204FF0C… / 36,315 bytes**에서 이 LF 한 줄만 뺀 역사 메모리 후보는 **D28D02297CB220E4C3C63615E19903AD028249F6D7454B5F3418CADD3C1424B0 / 36,267 bytes**였다. 이후 M1 제출본 B1B72F…/36,404와 미적용 후보8D0336…/36,356은 §1 표/호출 예시에 별도로 갱신했다. 후보 hash는 적용·컴파일·실행 검증이 아니며 새 독립 검수 전 최종 실행 패킷이 아니다.
- 실제 적용 여부는 PMO/신산님이 **d71/F81 raw 한 파일 + 이 host exact delta/hash + compiler 직접1회 + 원 compiler 종료 요청 최대1회 + 아래 잔여/보존·정리 조건**을 외부 직접 결정한 뒤 Main이 원 승인과 플랫폼 승인을 대조한다. 승인문에 null인 실행시각/기한을 Agent가 임의 발급해 권위로 삼지 않는다. 같은 결정을 R1/P2/P3·후속 native·새 process/QA에 이월하지 않는다.
- 실행 전 Main/독립 검수자는 M1 뒤 새 원 raw hash→단1줄 diff→후보 hash·기존 gates/tail 동일을 확인한다. 실행 1회 뒤 성공/실패/불명 모두 **다음 invocation 전에 원 throw를 같은 자리로 복원**하고 그 새 원 raw hash 일치를 확인한다. 역사 D204로 현재 M1 보완분을 덮어 복원하지 않는다. 복원 전 새 작업/재시도/commit·push 금지다. source 복원은 새 자원 정리 또는 원 process 종료를 뜻하지 않는다.
- 원 문서/source의 별도 변경이 끼면 전체 원본 덮기/무조건 restore하지 않는다. 원 hash 불일치로 중단하고 소유 writer와 exact diff를 대조한다. 원 바이트/원 branch commit은 보존한다. 메모리에 이미 정의된 함수는 디스크 복원만으로 차단되지 않으므로 원 closure의 `BEGIN` 1회 latch와 실행 host 소유를 유지하고, source 재정의·다른 runspace·새 host를 통한 재호출은 하지 않는다.
- **검수 M1 현지화 진단ID 누락**(`오류 CS1002` 등)은 별도 source 담당자가 지역화 단어 대신 `CS[0-9]{4,5}`+뒤 진단 구분자를 대조하도록 정규식/설명1줄씩 보완해 B1B72F…로 제출했다. 이 문서 작성자는 제품 수정/집중시험0이며 실제 compiler 출력은 미검증이다. 새 독립 검수 전 M1 해소 PASS를 대신 선언하지 않고 진단 entries=0을 오류 없음으로 해석하지 않는다. D204/D28은 역사값으로 보존한다.

### 3. 현재 body와 정확 실행 범위의 대조

| 항목 | 현재 body의 실제 행동 / 한계 |
|---|---|
| compiler·참조 | 기존 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` 1개와 mscorlib.dll/System.dll/System.Core.dll 3개만 고정 지문 대조·read pin. 앞 R0 표의 4지문 그대로. 다른 도구/다운로드/현재 native 자동치환 없음. 실제 CLR/OS/도구 추가 read는 미확인 |
| 인자 | 앞 R0 표의 정확 인자와 body가 일치: `/noconfig /nologo /nostdlib+ /target:library /platform:x64 /optimize- /debug- /warn:4 /errorreport:none`, 고정 `/out:...\DevelopmentRecoveryPathGuard.dll`, 절대 참조3, 역사 source 한 파일. 과거 `/optimize+` 또는 exe/R1 후보를 섞지 않음 |
| 원 process | `UseShellExecute=false`, hidden/no window, 새 compiler 직접 `Process.Start` 한 번. 반환한 Process/SafeHandle 확보 뒤만 원 handle 관측/종료 요청. 부분 시작·반환/SafeHandle 불명은 PID 재탐색/재open/추정 kill 없이 보존. compiler가 추가 child를 만들지 않는 OS 증거는 없음 |
| 최소 환경 | child 환경 Clear 후 `SystemRoot=C:\Windows`, `windir=C:\Windows`, `TEMP=TMP=...\compile` 네 항목만. PATH/CLR/COR/COMPLUS/부모 임의 환경 승계0. 이 설정은 compiler 외부 I/O·TEMP 추가 파일·OS 암묵 동작 배제 증명이 아님 |
| 창 | 원 함수 진입부터 UTC/monotonic 더 큰 소비값, compiler480,000ms·전체600,000ms. timeout 또는 원 process 확보 뒤 실패 시 같은 latch/최초 기한의 종료 요청 총1회·관측 최대15,000ms(남은 전체예산 이내). 새15초창·자동반복0. 취득/외부 delta·후검수 시간을 함수 예산에 포함했다고 주장하지 않음. 600초 외부벽과 충분한 선행 여유도 실행 직전 고정 필요 |
| drain·진단 | stdout/stderr 각각4096-byte 원 ReadAsync, 동시 관측. 각 stream EOF·exit·pending은 독립. raw 전체 hash/bytes/lines는 drain한 범위, 저장은 고정 ID/줄번호 최대200 entries·line buffer1024·초과 표기. 최종 JSON≤65,536 UTF-8 bytes/256행. EOF 불명 hash는 `NOT_FINAL_EOF_UNCONFIRMED`; raw source/파일명/exception/환경 로그0. M1 locale중립 source 제출·독립 검수 중, 실제 compiler 진단 미검증 |
| 경로·파일 | 신규 bootstrap/compile와 source/diagnostics는 자기 생성 목록·CreateNew 원 stream. source 정확96,953/F81 확인. compiler 전 DLL 부재, 뒤 목록은 세 고정 pathname 외 첫 항목/네번째에서 중단·보존. DLL0<크기≤4MiB는 후관측 조건, 세 파일 상한도 quota/sandbox가 아님 |
| 출력 귀속 | DLL은 compiler 후 생겼다는 사실/경로/hash로 원 생성 신원을 증명하지 않음. 원 body는 그 DLL을 owned로 채택하거나 자동 삭제하지 않고 `PRESERVED_UNCONFIRMED`. exit0/DLL존재 경로는 `OUTPUT_OWNERSHIP_UNCONFIRMED`로 catch되며 최종 status가 `RUN_UNCONFIRMED`일 수 있음. 성공 compile을 OS PASS/ready로 승격0 |
| 정리 | 종료+두 EOF+pending0 확인, 예상 밖 항목0, **DLL 부재·exit≠0인 실패**만 source/diagnostics hash/경로를 다시 대조한 뒤 자기 stream close→LiteralPath 삭제, 빈 compile/bootstrap 비재귀 삭제. 이조차 metadata 기반이며 native FileId 없음. 성공·불명·추가 항목·identity mismatch는 보존. 별도 재귀 삭제/unknown DLL 자동삭제0 |

body의 compiler exe 문자열 + ASCII 공백1 + 정확 `Arguments` 문자열을 개행/BOM 없이 UTF-8로 연결한 검토용 command는 **605 bytes / SHA256 AF7B14F2A7023266D74C0BD682DFA4303AE732C6F978D0D72E325BCCFACEE483**다. 이는 shell command를 실행한 hash가 아니라 고정 `ProcessStartInfo.FileName/Arguments`의 읽기 지문이다. 실제 Windows argv 분해/참조 read/컴파일 성공은 미검증이다.

### 4. 사람이 결정할 bootstrap 예외와 source 내부 미진

**bootstrap 예외로 명시해 결정할 사실:** stock PowerShell 부모/생성/정리 pathname 경합, 상위 경로 교체 위험, native FileId/원 DLL 귀속 미검증, compiler implicit I/O/TEMP/공유 호환 미확인, 동기 FileStream/ACL/열거/삭제의 호출 안 hard deadline 미입증이다. 현재 stopwatch 검사는 동기 I/O가 반환할 때만 갱신되므로 ‘600초면 모든 I/O가 반드시 끝난다’고 약속하지 않는다. 기존 ACL·상위 경로 수리/새 quota/sandbox/Job·native helper로 예외를 감추지 않는다. 이를 허용하지 않으면 이 후보를 실행하지 않고 동일 보호 범위 안 별도 source 보완안을 검토한다.

**사람 승인으로 해결됐다고 볼 수 없는 source/도구 선행:** (a) M1 현지화 진단ID 보완·검수와 exact 새 hash, (b) 아래 원 exec 보존/조건부 해제 계약, (c) 외부 전체600초/남은15초 관측이 실제 도구 호출 시간제한과 양립하는지, (d) 원상태 source 복원과 실행 1회 증거의 정확 소유/순서다. 이들은 실행 여부를 묻기 전에 Main이 검토 가능한 수준으로 확정해야 한다. 오류가 나면 명령을 바꾸어 즉시 반복하지 않는다.

**원 exec 수명:** 현재 불명 보존은 script closure가 Process/SafeHandle·원 ReadAsync·buffer·stream을 참조해 finalizer로 넘기지 않는 방식이다. 호출을 끝내고 원 PowerShell host가 사라지면 이 참조 보존은 유지되지 않는다. 따라서 미종료·pending·EOF 불명에 단발 `exec` 종료, 별도 pwsh child 추가, 600초 뒤 원 host 강제종료를 정상 정리로 제시하지 않는다. 권장 진입은 같은 원 PTY PowerShell host를 보존·후속관측할 수 있는 문맥이다. 아래 순수 hold probe는 이 도구의 짧은 입력대기만 확인했으며 실제 R0 수명 계약·원 process/read-task 보존 검증을 대신하지 않는다. 위 호출 예시 전체는 실행 준비 PASS가 아니다. host를 대기시키는 임의 무기한 loop/추가 process를 이번에 제품에 넣지 않는다.

Main의 초기 metadata(0f9d52/d41cdb/d23bb8)는 CommandLine.IndexOf가 검사문 본문 속 문자열까지 스스로 일치해 `-NonInteractive/Encoded`를 잘못 true로 판정한 검사 오류였다. **whole-argument GetCommandLineArgs 대조5e1d59가 이를 정정했다: argCount4 / NonInteractive=false / Encoded=false / Command=true. 15e84a는 NoProfile=true / NoLogo=false**다. ConsoleHost와 inputRedirected 일반 true/PTY false 관측을 이 잘못된 flag 판정과 섞지 않는다. 현재 도구의 원 host는 NoProfile/current tool -Command 호출이며 별도 pwsh child를 추가하는 예시가 아니다. 이 flag만으로 RootHost 안전·Read-Host/EnterNestedPrompt 지원을 추론하지 않는다.

Main 순수 probe 9ffe0d에서 **같은 원 PTY PowerShell host의 `Console.ReadLine` 입력대기**가 원 session을 유지했고 고정 `EXIT_R0_PURE_PROBE` 입력을 보낸 42e43c는 exit0/retained=true/targetResources=0이었다. 이 실제 hold/입력 증거는 위 검사 오류 정정 뒤에도 유효하며 실제 R0/native/Process/ReadAsync/파일 보존 검증과 구분한다. 입력 EOF/유실·도구 중단은 안전 종료 증거로 취급하지 않고 별도 지원 결정까지 원 host를 보존한다. Console loop/상시 helper는 **제품 source·실제 host에 미적용**이며, 연결한 loop는 **§6 문서의 비적용 후보에만** 있다.

**권장 외부 결정에 넣을 조건부 host 해제:** 성공 compiler의 DLL도 원 귀속은 불명이라 파일은 보존한다. 다만 R0 함수/finally의 모든 동기 I/O가 반환한 뒤 **원 compiler 확보 증거 + exitObserved=true + stdoutEof=true + stderrEof=true + stdoutPending=false + stderrPending=false**가 모두 확인된 경우에 한해, 파일을 그대로 두고 원 host/참조를 해제하는 행동을 외부 exact 결정에 포함할 수 있는 후보로 제시한다. 반환한 status/exit code/파일 귀속이 합격으로 바뀌는 조건이 아니고 actual 해제는 미승인·미검증이다. source 파일의 원 stream은 `FileMode.CreateNew/FileAccess.ReadWrite/FileShare.Read` 4인자, tool/DLL pin은 `Open/Read/Read` 4인자이며 **DeleteOnClose/FileOptions를 지정하지 않았다**. host 종료로 이 원 stream이 닫히는 것 자체가 파일 삭제 명령은 아니며 성공 DLL/진단/source가 자동 정리된다고 쓰지 않는다. 모든 동기 쓰기/Flush가 반환했는지와 원 결과 회수가 필요하고, OS handle close·실제 파일잔존/추가 compiler I/O는 별도 actual 후검수 대상이다. compiler 추가 child 부재를 이 조건으로 증명하지도 않는다.

위 조건 하나라도 미확인(부분 시작·원 compiler 종료 불명·EOF 불명·pending 포함)이면 **원 host의 Console.ReadLine 고정 입력 대기** 후보로 참조를 유지하고 새 eval/새 pwsh/추가 kill/600초 뒤 host 강제종료0으로 둔다. 입력만으로 종료를 허가하지 않으며 해제 조건을 충족하지 않은 고정 EXIT는 받아도 해제하지 않는 계약이 필요하다. 별도 지원 결정 전 재실행 금지다. 보존 기간의 상한/환경 강제 회수 가능성은 미확인으로 보고하고 유한 host 종료·잔여0를 약속하지 않는다. 이 분기와 위 조건부 해제는 기존 제품 body를 바꾸지 않는 원 exec 수명 패킷 제안이며 아직 실제 구현/실행하지 않았다.

### 4.1 원 host에서 뒤늦은 상태를 다시 관측하는 후보 — private 구조 결박 / 제품 적용0

고정 입력 대기만으로는 최초 pending/EOF 불명 뒤의 실제 상태를 갱신할 수 없다. 최소 후보는 **같은 원 host의 현재 exact Retain ScriptBlock.Module.SessionState에서 private `lifetime.retained`를 읽기만 하여 원 run/Process/SafeHandle/ReadAsync Task 포인터를 그대로 관측**하는 것이다. 새 공개 getter/권위·별도 process/새 owner·caller PID/handle/JSON은 받지 않는다. 임의 모듈/변수/명령 선택 입력도 없다. 위 프레임은 dot-source 전 같은 이름의 closure 부재와 exact candidate8D0336 bytes/hash를 확인하고, 직후 원 Retain/Module/lifetime을 참조로 고정한다. 없는 구조/형식·원 참조 변경/재정의는 `UNKNOWN`이며 새 closure/다른 경로/새 process로 대체하지 않는다. 이 결합은 source 내부 구조에 의존하므로 source hash/구조가 바뀌면 패킷 검수도 다시 필요하다.

**순수 가능성 probe 6a0eaf exit0:** source throw가 있는 현재 B1B72F…36,404 bytes를 같은 원 FileStream에서 bounded 읽기/hash→엄격 UTF8→메모리 ScriptBlock dot-source했다. 실제 R0 Invoke는0이다. cold Retain에 이 probe만의 `BEGIN/RETAIN`으로 합성 fakeRun/TaskCompletionSource sentinel을 놓은 뒤 `Module.SessionState.PSVariable.GetValue('lifetime')`가 hashtable/정확 keys started·retained이고 같은 lifetime/retained run/두 Task 참조임을 확인했다. pending/completed/faulted/canceled sentinel의 IsCompleted/IsFaulted/IsCanceled 구분과 EOF=false 불변을 확인했고 fake process를 실제 captured Process로 수용하지 않았다. 실제 child/target 파일/원문·ReadAsync/GetResult/Kill/Dispose0이며 **closure 접근의 기술적 가능성만** 확인했다. 실제 native pipe I/O/Task 종료·원 process의 후속 상태 보존은 미검증이다. probe의 fakeRun setter는 실제 실행 패킷에 넣지 않는다.

후속 순수 probe 990a00 exit0에서는 같은 B1 source AST의 원 run keys가 정확21개임을 확인하고 그 key 집합의 fakeRun을 사용했다. 첫 관측에서 미완료였던 같은 Task sentinel을 합성 producer만 완료시킨 뒤 같은 private retained run/Task 포인터로 다시 읽어 IsCompleted false→true를 확인했다. observer는 새 Read/GetResult를 하지 않았고 EOF는 false 그대로였다. null Task+EOFfalse는 UNKNOWN, 미확보 fake Process는 거절했다. 이는 고정 OBSERVE가 원 객체의 뒤늦은 managed 상태를 다시 읽을 수 있다는 순수 증거이며 실제 compiler·native I/O 종료 검증은0이다.

| 후속 관측 대상 | 읽기만 허용할 정확 조건 / 해석 |
|---|---|
| private 원 run | 고정한 Retain ScriptBlock·Module·lifetime이 모두 같은 참조, lifetime hashtable keys 정확 started/retained·started=true. `retained`는 원 run hashtable이고 첫 회수 뒤 같은 객체 참조여야 한다. 현재 run keys 정확21개: process/processHandle/originalProcessCaptured/startAttempted/exitObserved/exitCode/killAttempted/terminationDeadlineMono/reads/diagnostics/pins/owned/directories/source/status/cleanup/output/outputOwnership/extraItems/elapsedMs/diagnosticsWriteAttempted. 없거나 추가/형식 불일치는 UNKNOWN. 외부 객체를 이 원 자리로 채택하지 않음 |
| 원 compiler | private run의 originalProcessCaptured=true, process는 실제 Diagnostics.Process, processHandle은 실제 SafeProcessHandle·열려있음/유효함, 최초 고정한 같은 두 참조일 때만 **그 Process의 HasExited**를 읽는다. PID 검색/새 handle/재open/ExitCode 요청/Kill/Dispose0. stored exitObserved와 새 HasExited 결과는 별도 관측이며 run 필드에 쓰지 않음. 예외/미확보/닫힌 handle은 UNKNOWN |
| 원 read Task | reads가 정확 stdout/stderr 두 entry, entry는 stream/buffer/pending/eof 원 shape이며 원 stream·4096-byte 배열·Task 참조를 고정한다. pending이 Task면 그 같은 Task의 IsCompleted/IsFaulted/IsCanceled만 읽음. 새 Read/ReadAsync/GetResult/cancel/Dispose/버퍼출력0. pending=null은 해당 원 entry.eof=true와 diagnostics의 eof=true가 모두 확인된 경우만 이미 소비한 terminal로 인정. pending=null/eof=false 또는 구조/참조불명은 UNKNOWN |
| EOF와 terminal | completed/faulted/canceled는 **원 managed Task의 terminal metadata**이며 EOF·성공 read·진단 데이터 완전성·최종 hash를 뜻하지 않는다. Task완료 뒤 GetResult를 다시 하지 않으므로 EOF=false/미완성hash는 그대로 남는다. native I/O가 실제로 어떤 경로로 끝났는지의 OS 검증은0이며 `nativeIoCompletionVerified=true`로 승격하지 않음 |
| 원 함수 수명 | 원 Invoke가 반환하거나 stack unwind되어 wrapper finally에 도달한 사실만 `$r0SynchronousCallFinished=true`로 기록. 불러낸 helper·동기 I/O가 진행 중인 동안 입력대기/해제 판단에 진입하지 않음. 이 값은 시간 만료/EOF를 만들어내는 권위가 아님 |

§4의 첫 보수적 ‘두 EOF+pending0’ 해제 조건은 이 후속 관측 후보에서는 다음처럼 **정확 외부 결정의 조건부 대안**으로 세분한다. **원 synchronous call finished + 같은 원 compiler의 HasExited=true + 두 원 read가 각각 terminal**인 때만, 진단/EOF 불명과 파일 귀속불명을 그대로 기록한 채 **파일 보존·원 host 해제**를 제안할 수 있다. 여기서 terminal은 위 표의 ‘같은 원 Task.IsCompleted’ 또는 이미 소비된 EOF/null 조합만이며, task fault/cancel은 정상 EOF가 아니다. 실제 native I/O 수명 증거는 미실행이므로 이 조건의 허용 여부도 외부 exact 결정·독립 source 검수가 선행한다. 원 child 미종료/부분시작·Task미완료·Task미등록/null+EOFfalse·구조불명은 해제 불가로 원 host 참조를 유지한다. compiler 추가 child 부재·전체 시스템 잔여0·컴파일 데이터 합격을 이 대안으로 증명하지 않는다.

원 PTY 입력 후보는 고정 **`OBSERVE_R0_ORIGINAL` / `RELEASE_R0_ORIGINAL`** 두 token뿐이다. OBSERVE는 위 원 참조 metadata를 축약 출력하고 대기로 복귀한다. RELEASE도 먼저 같은 원 구조/참조/HasExited/Task metadata를 다시 읽고, 별도 exact 결정이 허용한 모든 해제 조건을 충족할 때만 원 host를 종료할 수 있는 후보이며 입력 자체는 권위가 아니다. 다른 입력/EOF/도구 입력 유실은 실행·해제하지 않고 UNKNOWN 보존/지원 요청으로 남긴다. 임의 eval·새 command/새 Invoke/재compile·추가 Read/GetResult/Kill/Dispose0, 파일 삭제0이다. 이 고정 token loop·read-only private 관측은 **문서 후보만**이며 제품/원 실행 프레임에 아직 적용하거나 실제 R0에서 시험하지 않았다.

### 5. 실제 실행 후 확인·정리·재차단 계획 — 아직 미실행

1. 원 호출의 `status/exitCode/exitObserved/killAttempted`, stdout/stderr의 EOF/pending, `cleanup`, output bytes/hash/ownership만 회수한다. `executionAuthorized=false/osVerified=false/implicitCompilerIoVerified=false/synchronousFileIoHardDeadlineVerified=false/realCompilerValidation=NOT_RUN`은 기존 source의 정직한 미검증 표식이며 실행 승인/결과 receipt로 임의 덮어쓰지 않는다. 실제 실행 여부/시각·원 compiler PID/원 handle 확보·exit/수집 범위는 별도 WORK_STATUS 증거로 남긴다. Process 객체나 원문을 JSON으로 통째로 출력하지 않는다.
2. 별도 read-only 후검수에서 bootstrap/compile·세 pathname의 부재/잔존, owner/nonlink/경로 관측, 추가 항목 유무, 원 handle의 exit와 양쪽 EOF/pending을 구분한다. compiler PID 검색 결과를 새 소유권으로 채택하지 않는다. 예상 밖 파일/새 DLL/부분시작/종료·EOF 불명은 `PRESERVED_UNCONFIRMED`; 새 실행/추가 kill/추정 close·delete/전체 tree 정리0으로 보고한다. 원 compiler 종료·양쪽 EOF/pending0까지 확인된 경우만 §4의 외부 exact 결정에 포함된 host 해제 후보를 대조하며, 파일 보존과 host 참조 보존을 같은 상태로 뭉뚱그리지 않는다.
3. body가 실패 자기 파일을 회수한 경우에도 잔여0은 독립 read-only 부재로만 판정한다. body가 성공 DLL 또는 미확인 참조를 보존한 경우 이를 잔여0로 쓰지 않는다. DLL의 신원·원 parent/파일 경합이 해결되지 않았는데 ‘이번 경로니까’ 삭제하지 않는다. 새로운 정리 허가는 대상·실체·소유·원 compiler 종료·원 스트림 상태를 확정한 뒤 별도 exact 결정이다.
4. §2의 원 throw/host raw 복원을 검수하고 원 source·기존 native/gates/QAmax2·보호8 불변을 확인한다. 현재 bootstrap 부재라는 원상태 복귀는 **자기 파일 정리가 검증된 분기에 한정**한다. 보존 분기는 디스크/host 잔류와 그 이유·소유·안전 관측·재개 조건을 기록하며 성공 복구로 표시하지 않는다. R0 library는 실행/승격하지 않는다.
5. 이후 실제 실행은 자동재시도하지 않는다. R1 OS fixture·loader/새 native·DB/TLS/P2/P3는 각각 별도 source/정확 결정과 gate로 남긴다. 플랫폼이 특정 실행을 거절하면 원 거절 이유를 보고하고 우회 설계를 적용하지 않는다.

**이번 검토 검증과 오류:** loose-object 원 exec 메모리 복원/EOF/SHA1/SHA256·host raw/단1줄 메모리 후보 hash는 읽기 검증 exit0이다. 첫 후보 산출은 CRLF를 가정해 정확 match0으로 중단1회했고 실제 LF를 확인해 메모리 계산만 수정했다(원문 수정0). 현재 Git 명령의 status는 세 번 `must be run in a work tree`로 실패해 같은 시도를 중단했다. branch ref `codex/av3-stage-b`/HEAD `2eb581db25b3ccad197c60ebf0b949896b8bebd1`과 d71 tree→blob은 읽었지만 현재 dirty 전체를 검증했다고 하지 않는다. 이 문서 append 외 변경·WORK_STATUS 수정·commit/push/branch 생성0이며 Main이 최종 dirty/문서 diff를 검수한다.

### 6. 원 observer·고정 token dispatcher를 연결한 완결 fence — 미적용 / 실제 Invoke0

앞 4,198-byte 프레임은 observer/dispatcher를 포함하지 않는 **역사 부분후보**로 보존한다. 아래는 원 입력 취득부터 원 Invoke 한 번, private 원 참조 최초 고정, 뒤늦은 원 Task 관측, 고정 Console 입력, 조건부 원 host 해제까지 연결한 별도 전체 후보다. 제품 파일/새 스크립트로 등록하거나 적용하지 않았다. local 함수는 이 원 host 안에서만 사용할 검토 대상이며 제품 공개 API·승인 권위가 아니다. 입력은 두 고정 token뿐이고 caller bool/PID/handle/JSON/명령/객체 입력은 없다.

**현재 전체 fence 지문:** 아래 PowerShell fence 내부 전체를 UTF-8/no BOM/LF/마지막 개행 없음으로 고정한 **20,474 bytes / SHA256 1E3F86B57AD57E6D11C9890BF8A1201C4DAABE574F2B50BD21D4BE7797B7E845**. 원 observer·dispatcher·결과 one-shot receipt·수명 출력·Console loop·원 Invoke 접속부가 모두 포함된다. PS AST 오류0, 같은 fence의 함수11개를 메모리 로드한 결과 receipt 집중30검사/실패0(51bf4e exit0)이다. 이전15,790/062CC3…·9함수/31검사는 결과 receipt가 빠진 독립검수 전 이력으로 보존한다. 지문·검사는 실행 권위/actual R0 PASS가 아니다.

**외부 선행:** 현재 B1 source와 아래 8D 한 줄 delta·전체 fence/hash·R0 scope·종료 요청·파일 보존·조건부 원 host 해제/UNKNOWN 유지에 대한 exact 외부 실행 결정과 플랫폼 승인이 모두 선행한다. 이 코드는 승인 parser/권위 발급기가 아니다. 외부 단1줄 source delta 적용·재차단은 §2대로 별도 소유자가 수행하며 아래 fence는 source를 쓰거나 throw를 제거하지 않는다. source가 아직 B1이면 크기/hash 불일치로 Invoke 전에 중단한다. 임의 실행 승인 bool을 넣어 활성화하지 않는다.

```powershell
$ErrorActionPreference='Stop'
function Test-R0FrameKeys($Value,[string[]]$Keys) {
 if($Value -isnot [hashtable] -or $Value.Count -ne $Keys.Count){return $false}
 foreach($key in $Keys){if(!$Value.ContainsKey($key)){return $false}}
 return $true
}
function Read-R0FrameFixed([string]$Path,[int]$Size) {
 $bytes=[byte[]]::new($Size)
 $stream=[IO.FileStream]::new($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try {
  if($stream.Length -ne $Size){throw 'R0_FRAME_FIXED_SIZE'}
  $offset=0
  while($offset -lt $Size){
   $count=$stream.Read($bytes,$offset,$Size-$offset)
   if($count -le 0){throw 'R0_FRAME_FIXED_SHORT'}
   $offset+=$count
  }
  if($stream.ReadByte() -ne -1 -or $stream.Length -ne $Size){throw 'R0_FRAME_FIXED_EXTRA'}
  return ,$bytes
 } finally {$stream.Dispose()}
}
function Get-R0FrameLifetime($Context) {
 if($Context.retain -isnot [scriptblock] -or $null -eq $Context.module -or
    ![object]::ReferenceEquals($Context.retain.Module,$Context.module)){throw 'R0_FRAME_ORIGIN_UNKNOWN'}
 $life=$Context.module.SessionState.PSVariable.GetValue('lifetime')
 if(![object]::ReferenceEquals($life,$Context.lifetime) -or
    !(Test-R0FrameKeys $life @('started','retained')) -or
    $life.started -isnot [bool] -or !$life.started){throw 'R0_FRAME_ORIGIN_UNKNOWN'}
 return ,$life
}
function Test-R0FrameDirectShape($Value) {
 if($Value -isnot [pscustomobject]){return $false}
 $keys=@('status','exitCode','exitObserved','killAttempted','stdoutEof','stderrEof','stdoutPending',
  'stderrPending','cleanup','output','outputOwnership','executionAuthorized','osVerified',
  'implicitCompilerIoVerified','bootstrapRace','synchronousFileIoHardDeadlineVerified','realCompilerValidation')
 $properties=@($Value.PSObject.Properties)
 if($properties.Count -ne $keys.Count){return $false}
 foreach($property in $properties){
  if($property.MemberType -ne [Management.Automation.PSMemberTypes]::NoteProperty -or $property.Name -cnotin $keys){return $false}
 }
 foreach($key in @('exitObserved','killAttempted','stdoutEof','stderrEof','stdoutPending','stderrPending',
   'executionAuthorized','osVerified','implicitCompilerIoVerified','synchronousFileIoHardDeadlineVerified')){
  if($Value.$key -isnot [bool]){return $false}
 }
 return $true
}
function New-R0FrameAnchor($Context) {
 $anchor=@{context=$Context;valid=$false;kind='UNKNOWN';run=$null;process=$null;handle=$null;
  captured=$false;startAttempted=$false;reads=@{};runKeys=@();direct=$null;directSnapshot=@{}}
 try {
  if(!$Context.finished){throw 'R0_FRAME_CALL_NOT_FINISHED'}
  $life=Get-R0FrameLifetime $Context
  if($null -eq $life.retained){
   # 이 분기는 동일 Invoke의 정상 직접 반환만 사용한다. 입력/JSON/재구성 객체 수용0.
   if(!$Context.normalReturn -or !(Test-R0FrameDirectShape $Context.direct)){throw 'R0_FRAME_DIRECT_UNKNOWN'}
   $d=$Context.direct
   if($d.cleanup -cne 'OWNED_FILES_REMOVED_NOT_OS_VALIDATED' -or !$d.exitObserved -or
      !$d.stdoutEof -or !$d.stderrEof -or $d.stdoutPending -or $d.stderrPending -or
      $null -ne $d.output -or $d.exitCode -isnot [int] -or $d.exitCode -eq 0 -or
      $d.status -cnotin @('COMPILE_FAILED','TIMEOUT') -or $d.executionAuthorized -or $d.osVerified -or
      $d.implicitCompilerIoVerified -or $d.synchronousFileIoHardDeadlineVerified){throw 'R0_FRAME_DIRECT_CONTRADICTION'}
   $anchor.direct=$d
   foreach($p in $d.PSObject.Properties){$anchor.directSnapshot[$p.Name]=$p.Value}
   $anchor.kind='SOURCE_ALREADY_DISPOSED';$anchor.valid=$true
   return ,$anchor
  }
  $run=$life.retained
  $keys=@('process','processHandle','originalProcessCaptured','startAttempted','exitObserved','exitCode',
   'killAttempted','terminationDeadlineMono','reads','diagnostics','pins','owned','directories','source',
   'status','cleanup','output','outputOwnership','extraItems','elapsedMs','diagnosticsWriteAttempted')
  if(!(Test-R0FrameKeys $run $keys) -or $run.originalProcessCaptured -isnot [bool] -or
     $run.startAttempted -isnot [bool] -or !(Test-R0FrameKeys $run.reads @('stdout','stderr')) -or
     $run.diagnostics -isnot [hashtable]){throw 'R0_FRAME_RUN_SHAPE_UNKNOWN'}
  $anchor.run=$run;$anchor.process=$run.process;$anchor.handle=$run.processHandle
  $anchor.runKeys=$keys
  $anchor.captured=$run.originalProcessCaptured;$anchor.startAttempted=$run.startAttempted
  foreach($name in @('stdout','stderr')){
   $r=$run.reads[$name];$d=$run.diagnostics[$name]
   if(!(Test-R0FrameKeys $r @('stream','buffer','pending','eof')) -or $r.stream -isnot [IO.Stream] -or
      $r.buffer -isnot [byte[]] -or $r.buffer.Length -ne 4096 -or $r.eof -isnot [bool] -or
      ($null -ne $r.pending -and $r.pending -isnot [Threading.Tasks.Task]) -or
      $d -isnot [hashtable] -or !$d.ContainsKey('eof') -or $d.eof -isnot [bool]){throw 'R0_FRAME_READ_SHAPE_UNKNOWN'}
   $anchor.reads[$name]=@{entry=$r;stream=$r.stream;buffer=$r.buffer;task=$r.pending;
    eof=$r.eof;diagnostic=$d;diagnosticEof=$d.eof}
  }
  $anchor.kind='RETAINED_ORIGINAL';$anchor.valid=$true
 } catch {$anchor.valid=$false;$anchor.kind='UNKNOWN'}
 return ,$anchor
}
function Get-R0FrameTaskMetadata($ReadAnchor) {
 $value=@{state='UNKNOWN';terminal=$false;faulted=$false;canceled=$false;eof=$ReadAnchor.eof;
  diagnosticEof=$ReadAnchor.diagnosticEof}
 $task=$ReadAnchor.task
 if($null -eq $task){
  if($ReadAnchor.eof -and $ReadAnchor.diagnosticEof){$value.state='CONSUMED_EOF';$value.terminal=$true}
  return ,$value
 }
 if($task -isnot [Threading.Tasks.Task]){return ,$value}
 $value.terminal=$task.IsCompleted;$value.faulted=$task.IsFaulted;$value.canceled=$task.IsCanceled
 if(!$value.terminal){$value.state='PENDING'}
 elseif($value.faulted){$value.state='FAULTED'}
 elseif($value.canceled){$value.state='CANCELED'}
 else{$value.state='COMPLETED_NOT_CONSUMED'}
 return ,$value
}
function Get-R0FrameObservation($Anchor) {
 $s=[pscustomobject]@{schemaVersion=1;state='UNKNOWN';originMatched=$false;sourceCallFinished=$false;
  provenance='UNKNOWN';originalCaptured=$false;childExitNow=$false;stdoutTask='UNKNOWN';stderrTask='UNKNOWN';
  stdoutTerminal=$false;stderrTerminal=$false;stdoutEof=$false;stderrEof=$false;
  stdoutDiagnosticEof=$false;stderrDiagnosticEof=$false;releaseEligible=$false;
  nativeIoVerified=$false;dataCompleteness='NOT_REEVALUATED';files='PRESERVED_OR_SOURCE_CLEANUP_UNRECHECKED'}
 try {
  if(!$Anchor.valid -or !$Anchor.context.finished){return $s}
  $c=$Anchor.context;$life=Get-R0FrameLifetime $c
  $s.sourceCallFinished=$true
  if($Anchor.kind -ceq 'SOURCE_ALREADY_DISPOSED'){
   if($null -ne $life.retained -or !$c.normalReturn -or
      ![object]::ReferenceEquals($c.direct,$Anchor.direct) -or !(Test-R0FrameDirectShape $c.direct)){return $s}
   foreach($key in $Anchor.directSnapshot.Keys){
    if($c.direct.$key -cne $Anchor.directSnapshot[$key]){return $s}
   }
   $s.originMatched=$true;$s.provenance='SAME_NORMAL_DIRECT_RETURN'
   $s.childExitNow=$true;$s.stdoutTask='SOURCE_EOF_DISPOSED';$s.stderrTask='SOURCE_EOF_DISPOSED'
   $s.stdoutTerminal=$true;$s.stderrTerminal=$true;$s.stdoutEof=$true;$s.stderrEof=$true
   $s.stdoutDiagnosticEof=$true;$s.stderrDiagnosticEof=$true
   $s.state='SOURCE_ALREADY_DISPOSED';$s.releaseEligible=$true
   return $s
  }
  $run=$life.retained
  if($Anchor.kind -cne 'RETAINED_ORIGINAL' -or ![object]::ReferenceEquals($run,$Anchor.run) -or
     !(Test-R0FrameKeys $run $Anchor.runKeys) -or
     ![object]::ReferenceEquals($run.process,$Anchor.process) -or
     ![object]::ReferenceEquals($run.processHandle,$Anchor.handle) -or
     $run.originalProcessCaptured -isnot [bool] -or $run.startAttempted -isnot [bool] -or
     $run.originalProcessCaptured -cne $Anchor.captured -or $run.startAttempted -cne $Anchor.startAttempted -or
     !(Test-R0FrameKeys $run.reads @('stdout','stderr'))){return $s}
  foreach($name in @('stdout','stderr')){
   $a=$Anchor.reads[$name];$r=$run.reads[$name];$d=$run.diagnostics[$name]
   if(!(Test-R0FrameKeys $r @('stream','buffer','pending','eof')) -or
      $r.eof -isnot [bool] -or $d -isnot [hashtable] -or !$d.ContainsKey('eof') -or $d.eof -isnot [bool] -or
      ![object]::ReferenceEquals($r,$a.entry) -or ![object]::ReferenceEquals($r.stream,$a.stream) -or
      ![object]::ReferenceEquals($r.buffer,$a.buffer) -or ![object]::ReferenceEquals($r.pending,$a.task) -or
      ![object]::ReferenceEquals($d,$a.diagnostic) -or $r.eof -cne $a.eof -or $d.eof -cne $a.diagnosticEof){return $s}
  }
  $out=Get-R0FrameTaskMetadata $Anchor.reads.stdout
  $err=Get-R0FrameTaskMetadata $Anchor.reads.stderr
  $s.originMatched=$true;$s.provenance='SAME_PRIVATE_RETAINED_REFERENCES'
  $s.stdoutTask=$out.state;$s.stderrTask=$err.state;$s.stdoutTerminal=$out.terminal;$s.stderrTerminal=$err.terminal
  $s.stdoutEof=$out.eof;$s.stderrEof=$err.eof;$s.stdoutDiagnosticEof=$out.diagnosticEof;$s.stderrDiagnosticEof=$err.diagnosticEof
  if(!$Anchor.captured -or !$Anchor.startAttempted -or $Anchor.process -isnot [Diagnostics.Process] -or
     $Anchor.handle -isnot [Microsoft.Win32.SafeHandles.SafeProcessHandle] -or
     $Anchor.handle.IsClosed -or $Anchor.handle.IsInvalid){return $s}
  $s.originalCaptured=$true
  # 원 Process/SafeHandle 확보 뒤 같은 Process에만 묻는다. 새 handle/PID/ExitCode 질의0.
  $s.childExitNow=$Anchor.process.HasExited
  $s.state='RETAINED_ORIGINAL_OBSERVED'
  $s.releaseEligible=$s.childExitNow -and $out.terminal -and $err.terminal
 } catch {$s.state='UNKNOWN';$s.releaseEligible=$false}
 return $s
}
function Invoke-R0FrameDispatch($Anchor,$Token) {
 $kind='INVALID'
 if($null -eq $Token){$kind='INPUT_UNAVAILABLE'}
 elseif($Token -is [string] -and $Token -ceq 'OBSERVE_R0_ORIGINAL'){$kind='OBSERVE'}
 elseif($Token -is [string] -and $Token -ceq 'RELEASE_R0_ORIGINAL'){$kind='RELEASE'}
 $summary=Get-R0FrameObservation $Anchor
 $action='HOLD'
 if($kind -ceq 'RELEASE' -and $summary.releaseEligible){$action='RELEASE_ORIGINAL_HOST_ONLY'}
 return [pscustomobject]@{inputKind=$kind;action=$action;summary=$summary}
}
function Write-R0FrameDecision($Decision) {
 $s=$Decision.summary
 $value=[ordered]@{schemaVersion=1;inputKind=$Decision.inputKind;action=$Decision.action;state=$s.state;
  originMatched=$s.originMatched;sourceCallFinished=$s.sourceCallFinished;provenance=$s.provenance;
  originalCaptured=$s.originalCaptured;childExitNow=$s.childExitNow;
  stdoutTask=$s.stdoutTask;stderrTask=$s.stderrTask;stdoutTerminal=$s.stdoutTerminal;stderrTerminal=$s.stderrTerminal;
  stdoutEof=$s.stdoutEof;stderrEof=$s.stderrEof;stdoutDiagnosticEof=$s.stdoutDiagnosticEof;stderrDiagnosticEof=$s.stderrDiagnosticEof;
  releaseEligible=$s.releaseEligible;nativeIoVerified=$false;dataCompleteness='NOT_REEVALUATED';
  files='PRESERVED_OR_SOURCE_CLEANUP_UNRECHECKED'}
 $json=ConvertTo-Json -InputObject $value -Compress -Depth 3
 if([Text.Encoding]::UTF8.GetByteCount($json) -gt 4096){throw 'R0_FRAME_SUMMARY_LIMIT'}
 Write-Output $json
}
function New-R0FrameResultOrigin($Context) {
 $origin=@{kind='NOT_OBSERVED';context=$Context;original=$null;retained=$null;runKeys=@()}
 try {
  if(!$Context.finished){return ,$origin}
  $life=Get-R0FrameLifetime $Context
  $origin.retained=$life.retained
  if($Context.normalReturn -and $null -ne $Context.direct){
   if(!(Test-R0FrameDirectShape $Context.direct)){return ,$origin}
   $origin.original=$Context.direct;$origin.kind='SAME_NORMAL_DIRECT_RETURN'
  } elseif($null -eq $Context.direct){
   $keys=@('process','processHandle','originalProcessCaptured','startAttempted','exitObserved','exitCode',
    'killAttempted','terminationDeadlineMono','reads','diagnostics','pins','owned','directories','source',
    'status','cleanup','output','outputOwnership','extraItems','elapsedMs','diagnosticsWriteAttempted')
   if(!(Test-R0FrameKeys $life.retained $keys)){return ,$origin}
   $origin.original=$life.retained;$origin.runKeys=$keys;$origin.kind='SAME_PRIVATE_RETAINED_RUN'
  }
 } catch {$origin.kind='NOT_OBSERVED';$origin.original=$null}
 return ,$origin
}
function Write-R0FrameResultOnce($State,$Origin) {
 if(!(Test-R0FrameKeys $State @('attempted')) -or $State.attempted -isnot [bool]){throw 'R0_FRAME_RESULT_STATE_INVALID'}
 if($State.attempted){throw 'R0_FRAME_RESULT_ALREADY_ATTEMPTED'}
 # 부분 출력/오류에도 같은 결과를 자동 재출력하지 않는다. 실행/해제 권위가 아닌 출력 latch다.
 $State.attempted=$true
 $v=[ordered]@{schemaVersion=1;recordType='R0_RESULT';provenance='NOT_OBSERVED';observation='NOT_OBSERVED';
  status='NOT_OBSERVED';exitCode=$null;killAttempted=$null;cleanup='NOT_OBSERVED';
  output=[ordered]@{bytes=$null;sha256=$null};outputOwnership='NOT_OBSERVED';
  compilerPid=$null;pidObservation='NOT_OBSERVED';redactedFields=0}
 $original=$null
 try {
  $c=$Origin.context;$life=Get-R0FrameLifetime $c
  if(![object]::ReferenceEquals($life.retained,$Origin.retained)){throw 'R0_FRAME_RESULT_ORIGIN_CHANGED'}
  if($Origin.kind -ceq 'SAME_NORMAL_DIRECT_RETURN' -and $c.normalReturn -and
     [object]::ReferenceEquals($c.direct,$Origin.original) -and (Test-R0FrameDirectShape $c.direct)){
   $original=$Origin.original;$v.provenance='SAME_NORMAL_DIRECT_RETURN'
  } elseif($Origin.kind -ceq 'SAME_PRIVATE_RETAINED_RUN' -and $null -eq $c.direct -and
     [object]::ReferenceEquals($life.retained,$Origin.original) -and (Test-R0FrameKeys $life.retained $Origin.runKeys)){
   $original=$Origin.original;$v.provenance='SAME_PRIVATE_RETAINED_RUN'
  }
 } catch {$original=$null}
 if($null -ne $original){
  $v.observation='OBSERVED_SCALARS'
  if($original.status -is [string] -and $original.status -cin @('COMPILE_FAILED','COMPILE_RETURNED_NOT_OS_VALIDATED','TIMEOUT','RUN_UNCONFIRMED')){
   $v.status=$original.status
  } else {$v.redactedFields++}
  if($null -eq $original.exitCode){$v.exitCode=$null}
  elseif(($original.exitCode -is [int] -or $original.exitCode -is [long]) -and
         $original.exitCode -ge [int]::MinValue -and $original.exitCode -le [int]::MaxValue){$v.exitCode=[int]$original.exitCode}
  else {$v.redactedFields++}
  if($original.killAttempted -is [bool]){$v.killAttempted=$original.killAttempted}else{$v.redactedFields++}
  if($original.cleanup -is [string] -and $original.cleanup -cin @('PRESERVED_UNCONFIRMED','OWNED_FILES_REMOVED_NOT_OS_VALIDATED')){
   $v.cleanup=$original.cleanup
  } else {$v.redactedFields++}
  if($original.outputOwnership -is [string] -and $original.outputOwnership -cin @('NOT_PROVEN_BY_PATHNAME','PRESERVED_UNCONFIRMED')){
   $v.outputOwnership=$original.outputOwnership
  } else {$v.redactedFields++}
  if($null -ne $original.output){
   if(Test-R0FrameKeys $original.output @('bytes','sha256')){
    $o=$original.output
    if(($o.bytes -is [int] -or $o.bytes -is [long]) -and $o.bytes -ge 0 -and $o.bytes -le 4194304){$v.output.bytes=[long]$o.bytes}
    else {$v.redactedFields++}
    if($o.sha256 -is [string] -and $o.sha256.Length -eq 64 -and $o.sha256 -cmatch '\A[A-F0-9]{64}\z'){$v.output.sha256=$o.sha256}
    else {$v.redactedFields++}
   } else {$v.redactedFields++}
  }
  if($v.redactedFields -gt 0){$v.observation='PARTIAL_REDACTED'}
 }
 # 원 객체/Process/Module/환경/source/diagnostic 본문은 직렬화하지 않는다.
 $json=ConvertTo-Json -InputObject $v -Compress -Depth 3
 if([Text.Encoding]::UTF8.GetByteCount($json) -gt 4096){throw 'R0_FRAME_RESULT_SUMMARY_LIMIT'}
 Write-Output $json
}
$r0Compressed=$null;$r0Expanded=$null;$r0Raw=$null;$r0HostBytes=$null
$r0Memory=$null;$r0Zlib=$null;$r0Sha1=$null;$r0Sha256=$null;$r0Context=$null;$r0Anchor=$null
$r0ResultOrigin=$null;$r0ResultWriteState=@{attempted=$false}
$r0CallAttempted=$false;$r0AuxCleanupFault=$false
try {
 if($null -ne (Get-Variable -Name DevelopmentRecoveryR0Retain -Scope Script -ErrorAction Ignore)){throw 'R0_FRAME_EXISTING_CLOSURE'}
 $r0Compressed=Read-R0FrameFixed 'D:\Project\Anvil\.git\objects\8d\38a21bf18f5b6bed95c8582b87d12e090d95f3' 30236
 $r0Memory=[IO.MemoryStream]::new($r0Compressed,$false)
 $r0Zlib=[IO.Compression.ZLibStream]::new($r0Memory,[IO.Compression.CompressionMode]::Decompress,$true)
 $r0Expanded=[byte[]]::new(96964);$r0Offset=0
 while($r0Offset -lt $r0Expanded.Length){
  $r0Count=$r0Zlib.Read($r0Expanded,$r0Offset,$r0Expanded.Length-$r0Offset)
  if($r0Count -le 0){throw 'R0_FRAME_OBJECT_SHORT'};$r0Offset+=$r0Count
 }
 if($r0Zlib.ReadByte() -ne -1){throw 'R0_FRAME_OBJECT_EXTRA'}
 $r0Zlib.Dispose()
 if($r0Memory.Position -ne $r0Memory.Length -or
    [Text.Encoding]::ASCII.GetString($r0Expanded,0,11) -cne ('blob 96953'+[char]0)){throw 'R0_FRAME_OBJECT_HEADER'}
 $r0Raw=[byte[]]::new(96953);[Array]::Copy($r0Expanded,11,$r0Raw,0,96953)
 $r0Sha1=[Security.Cryptography.SHA1]::Create();$r0Sha256=[Security.Cryptography.SHA256]::Create()
 $r0Blob=[BitConverter]::ToString($r0Sha1.ComputeHash($r0Expanded)).Replace('-','').ToLowerInvariant()
 $r0RawDigest=[BitConverter]::ToString($r0Sha256.ComputeHash($r0Raw)).Replace('-','')
 if($r0Blob -cne '8d38a21bf18f5b6bed95c8582b87d12e090d95f3' -or
    $r0RawDigest -cne 'F81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49'){throw 'R0_FRAME_OBJECT_HASH'}
 $r0HostPath=Join-Path (Get-Location).ProviderPath 'scripts\development-recovery-host.ps1'
 $r0HostBytes=Read-R0FrameFixed $r0HostPath 36356
 $r0HostDigest=[BitConverter]::ToString($r0Sha256.ComputeHash($r0HostBytes)).Replace('-','')
 if($r0HostDigest -cne '8D03365E9A97A9A56BF320233D95010A07D4F3340EFD5362D3195ECCDB99DFAC'){throw 'R0_FRAME_HOST_HASH'}
 $r0HostScript=[scriptblock]::Create([Text.UTF8Encoding]::new($false,$true).GetString($r0HostBytes))
 . $r0HostScript
 $r0Retain=(Get-Variable -Name DevelopmentRecoveryR0Retain -Scope Script).Value
 $r0Module=$r0Retain.Module
 $r0Lifetime=$r0Module.SessionState.PSVariable.GetValue('lifetime')
 if(!(Test-R0FrameKeys $r0Lifetime @('started','retained')) -or
    $r0Lifetime.started -isnot [bool] -or $r0Lifetime.started -or $null -ne $r0Lifetime.retained){throw 'R0_FRAME_COLD_SHAPE'}
 $r0Context=@{retain=$r0Retain;module=$r0Module;lifetime=$r0Lifetime;finished=$false;normalReturn=$false;direct=$null}
 $r0CallAttempted=$true
 try {
  # 입력/JSON이 아니라 이 동일 exact Invoke가 정상 반환한 객체만 그 자리에서 고정한다.
  $r0Context.direct=Invoke-DevelopmentRecoveryR0CompileSource -GitSourceBytes $r0Raw
  $r0Context.normalReturn=$true
 } catch {$r0Context.normalReturn=$false}
 finally {$r0Context.finished=$true}
 $r0ResultOrigin=New-R0FrameResultOrigin $r0Context
 $r0Anchor=New-R0FrameAnchor $r0Context
} catch {
 if(!$r0CallAttempted){Write-Output '{"schemaVersion":1,"state":"PREFLIGHT_FAILED_NO_INVOKE","action":"ABORT_NO_TARGET_STARTED"}';return}
 # Invoke 뒤 예외에는 host를 끝내지 않는다. 원 closure/context는 그대로 보존한다.
 $r0Anchor=@{context=$r0Context;valid=$false;kind='UNKNOWN'}
} finally {
 foreach($r0Aux in @($r0Zlib,$r0Memory,$r0Sha1,$r0Sha256)){
  if($null -ne $r0Aux){try{$r0Aux.Dispose()}catch{$r0AuxCleanupFault=$true}}
 }
 foreach($r0Bytes in @($r0Compressed,$r0Expanded,$r0Raw,$r0HostBytes)){
  if($null -ne $r0Bytes){
   try{if($r0Bytes -isnot [byte[]]){throw 'R0_FRAME_BUFFER_SHAPE'};[Array]::Clear($r0Bytes,0,$r0Bytes.Length)}
   catch{$r0AuxCleanupFault=$true}
  }
 }
}
if($r0AuxCleanupFault){$r0Anchor.valid=$false;$r0Anchor.kind='UNKNOWN'}
try{Write-R0FrameResultOnce $r0ResultWriteState $r0ResultOrigin}catch{<# 결과 출력은 총1회. 권위/RELEASE 입력으로 쓰지 않음 #>}
try{Write-R0FrameDecision (Invoke-R0FrameDispatch $r0Anchor 'OBSERVE_R0_ORIGINAL')}catch{<# 출력 실패도 원 host 보존 #>}
$r0InputUnavailableReported=$false
while($true){
 $r0Token=$null
 try {$r0Token=[Console]::ReadLine()} catch {$r0Token=$null}
 if($null -eq $r0Token){
  if(!$r0InputUnavailableReported){
   try{Write-R0FrameDecision (Invoke-R0FrameDispatch $r0Anchor $null)}catch{<# 출력 실패 보존 #>}
   $r0InputUnavailableReported=$true
  }
  # EOF/입력유실은 해제 권위가 아니다. 원 참조를 유지하며 busy spin/로그 누적0.
  [Threading.Thread]::Sleep(250)
  continue
 }
 $r0InputUnavailableReported=$false
 $r0Decision=Invoke-R0FrameDispatch $r0Anchor $r0Token
 $r0SummaryWritten=$false
 try{Write-R0FrameDecision $r0Decision;$r0SummaryWritten=$true}catch{<# 출력 실패에 해제하지 않음 #>}
 if($r0SummaryWritten -and $r0Decision.action -ceq 'RELEASE_ORIGINAL_HOST_ONLY'){break}
}
# 외부 exact 결정에 포함된 조건이 직전 재검증된 경우만 원 host를 반환한다.
# 파일 삭제/원 Process.Kill/새 Dispose/GetResult/재Invoke/다른 process 실행0.
```

이 fence의 정상 직접 반환 provenance는 원 source가 자기 파일 정리·finally Dispose를 모두 정상 반환한 경우에만 사용하는 메모리 수명 판단이다. exception·caller JSON·나중에 재구성한 객체·조합 모순·retained가 뒤에 바뀐 경우는 UNKNOWN/HOLD다. 정상 직접 반환/retained=null case는 새 중단점으로 무조건 HOLD하지 않지만 **파일 잔여0/OS PASS로 승격하지 않는다**. retained case는 최초 원 run/Process/SafeHandle/stream/buffer/Task를 고정한 뒤만 관측하며 다른 객체를 뒤늦게 채택하지 않는다. 입력 token은 실행·해제 권위가 아니고 외부 exact 결정이 위 조건부 원 host 종료를 포함해야 한다.

원 native read가 완료됐는지에 대한 OS 증거, 실제 Process.HasExited와 SafeHandle·원 pipe Task 동작, 실제 PTY 입력 유실 뒤 host 보존은 NOT_RUN이다. source/bootstrap의 이미 명시한 경합·암묵 I/O·hard deadline 잔여와 구분한다. 아래 순수 검사는 문서 후보 함수/dispatcher의 제어흐름만 검증하며 actual R0 실행 준비 PASS를 의미하지 않는다.

**순수 fixture 결과 6bc48f:** gated B1 cold closure와 fakeRun/MemoryStream/TaskCompletionSource sentinel만 사용했다. 같은 원 run/Task 고정과 늦은 terminal·EOFfalse 구분, fault/cancel terminal·null+EOFfalse UNKNOWN, Task/entry/run shape 교체 거절, fake Process의 HasExited getter 미호출을 확인했다. 고정 OBSERVE는 해제하지 않고 RELEASE도 원 조건 미충족이면 HOLD, 대소문자/임의 명령 문자열/기존 probe token/EOF는 고정 INVALID 또는 INPUT_UNAVAILABLE/HOLD다. 축약 summary1개·4KiB 이하·Process/Module 객체 비직렬화를 확인했다.

정상 직접 반환 분기는 fixture의 명시 합성 producer가 준 same object로 조건 분기만 시험했다. 정상 반환 fact가 없는 fakeDirectReturn, 나중에 JSON으로 재구성한 객체, pending 모순·필드 변조, 정상반환 fact 취소, 뒤늦은 retained 변경은 모두 해제 거절했다. 합성 정상 tuple의 조건부 RELEASE **결정값만** 확인했고 실제 host를 종료하지 않았다. 실제 source의 정상 cleanup/finally Dispose와 직접 반환 provenance는 현재 source의 연결 경로로 검토하며 실R0 증거로 승격하지 않는다.

실제 Invoke/csc/Process.HasExited/원 native read·Console dispatcher loop/원 host 해제/target process·file 생성은0이다. source main body와 Console loop는 순수 fixture에서 실행하지 않았고, 같은 fence에서 추출한 함수만 실행했다. source/도구 내부의 observer 연결 누락은 이 전체후보에서 해소했으며, 실제 런타임의 입력 유실/원 process·task/host 해제와 기존 source의 동기 I/O hard deadline은 여전히 미검증이다. 오류나 새로운 내부 미진을 bootstrap 예외로 간주해 승인에 넘기지 않고 독립 source 검수를 먼저 받는다.

#### 완결 fence 독립검수 뒤 재작업1 — 결과 회수 I1·문구 M1 보완

- Main이 전달한 독립 첫 판정은 C0/I1/M1이다. 583-byte 수명 summary에 status/exitCode/killAttempted/cleanup/output/outputOwnership 여섯 결과 필드가 없었고, source 정상 실패 정리에서 diagnostics.json까지 삭제하면 그 결과를 사후 회수할 수 없었다. 이를 bootstrap 예외로 넘기지 않고 실제 fence에 결과 receipt를 연결했다.
- Invoke의 동기 unwind 직후 **같은 정상 direct 원객체**를 New-R0FrameResultOrigin에 고정한다. direct가 없을 때만 같은 Retain/Module/lifetime의 원 retained run을 최초 고정한다. 나중에 바뀐 direct/run/구조는 수용하지 않는다. Write-R0FrameResultOnce가 표준 status/cleanup/ownership enum, int32 exitCode, bool killAttempted, output의 bytes0..4MiB·대문자64hex SHA256만 새 작은 JSON에 투영한다. original 객체/source/환경/Process/Module/exception/diagnostic 본문을 통째로 직렬화하지 않는다.
- 원 결과가 없으면 NOT_OBSERVED/null, 손상되거나 허용 형식 밖이면 PARTIAL_REDACTED/count로 표시한다. output에는 bytes/sha256 두 값만 있고 compilerPid=null/pidObservation=NOT_OBSERVED다. 현재 source가 반환하지 않는 PID를 다른 process 검색이나 역사값으로 만들지 않는다.
- one-shot latch는 첫 출력 시도 전에 기록한다. 부분 출력/직렬화/출력 오류 뒤 재시도0, 같은 state의 재호출은 고정 R0_FRAME_RESULT_ALREADY_ATTEMPTED로 거절한다. receipt는 최초 수명 summary 앞에서 한 번만 출력하며 OBSERVE/RELEASE token으로 다시 출력하지 않는다. receipt JSON/정정 count/결과 status는 원 host 해제·권한 판단 입력이 아니다. 기존 private 원 객체 observer·직접 정상 반환 provenance와 두 고정 token 기준은 그대로 유지했다.
- **51bf4e exit0 / 변경범위30검사·AST0:** 정상 실패 정리 direct 결과379 bytes, same retained 결과417 bytes, 120,000자 secret canary가 섞인 손상값도 원문비노출345 bytes였다. 여섯 필드·실제 허용 bytes/hash·4MiB 경계, 음수/초과/문자 크기 거절, hash 형식, output 추가 key/ScriptProperty getter 미평가, metadata 부재, 동일 원객체/shape 변경, 출력 중복 거절, 결과 JSON 변조가 RELEASE 판단을 바꾸지 않는 반례를 확인했다. 기존31 수명 검사는 코드 불변이라 다시 실행하지 않았다.
- 문구 M1은 “loop 없음”을 제품 source/실제 host 미적용·§6 문서 후보에만 존재로 정정했다. 별도 host metadata의 IndexOf 자기일치 오류와 whole-argument 정정5e1d59/15e84a도 위에 이력으로 남겼다. 이 정정은 RootHost 안전 판정이나 실제 R0 실행 증거가 아니다.
- 제품 source/고정 throw/QAmax2/gate·실행 token·동기 I/O/정리 계약 변경0. 실제 Invoke/csc/native·Console loop/원 host 해제/target process·file 생성0이며 새 독립 scoped 재검수가 필요하다.
