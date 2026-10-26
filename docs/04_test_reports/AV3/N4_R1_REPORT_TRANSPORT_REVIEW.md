# N4 R1 보고 전송 소스 독립 검수 — 최초 후보

판정: 보완 필요. 전체 호출선 검수 C0/I2/M0, 시간예산·소유 한정 검수 C0/I2/M0이다. 중복을 제외한 통합 지적은 Important4이며 실행 PASS가 아니다.

## 고정 대상

내부 작업계획 r2 E09C9923DEFD249BF4E241B3837736459EC7154B1D45C13611F8815B6B077A0F, 기준 d938c00e5c18e55810c74cbb1eb11c6fda2f8b85.

| 소유 파일 | 검수 작업원문 SHA256 |
|---|---|
| scripts/development-recovery-path-guard.cs | 8BAFA84084D625DBB65F7664300CAAE67C5E0F555EBB0A869F75D04B185F631B |
| scripts/development-recovery-host.ps1 | 1EA9445DDC3309E67B201231D214968B70D82DA6EE6624BBAE59E1C2E951D2E6 |
| tests/native/FN06/StandaloneReportTransportSourceTests.cs | 4C37672508292277DB4789F535CFB1B11D32101A6ED8A3EDCF87692BDFA27629 |
| tests/native/FN06/StandaloneReportPayloadSourceTests.cs | 11AA0104E79A160BD83278D12FAF9AFF4306009C02BB0C297A5DEA0A5CB9F0A2 |

Main1b8c1c는 4hash 일치·엄격 diffcheck exit0·실행 없는 PS AST errors0을 확인했다. C# 구문·타입·실행 검증이 아니다. 기존 Git 개행 정책에 따른 작업원문/게시 blob 차이를 별도로 대조해야 한다.

## 확인된 지적

- I1 / guard.cs:943–945: CreateProcessW 실패 시 nonzero raw.Process/Thread 정보가 createUnknown bool 이외에는 소실된다. 원 소유자의 private 상태에 실패 반환 구조체와 사실을 보존하고, 유효 handle로 채택하거나 임의 close하지 않는다. 실패+비영 raw 보존·후속 정리 차단의 미래 반례가 필요하다.
- I2 / guard.cs:1120→1117/1141→1863–1864: 상위 예산 실패가 새 native 효과뿐 아니라 Snapshot9/Capture까지 차단하여 report를 null로 남긴다. 원 C 경로에 한정하여 정리 불명 상태와 메모리 Snapshot9/private Capture를 보존한다. 전송·close는 같은 예산으로 거절하고 일반 null 경로는 유지한다. 예산 실패 후 native 정리0·보고 보존의 미래 반례가 필요하다.
- I3 / guard.cs:738 및1422/1426→1430→1625→1631: Remaining의 UTC 역행·일시적인 기한 초과 실패가 고정되지 않아, 시계 복원 후 ParentBudget을 다시 통과하고 TerminateJobObject 등의 새 효과로 진행할 수 있다. 원 예산 객체에 실패 latch를 두어 최초 모순·만료 후 모든 검사/채택을 거절한다. 같은 객체에 정상→실패→정상 sample을 넣어 STOP/fallback/close0·원 자원 보존을 확인하는 미래 반례가 필요하다. 현재 개별 순수 함수 거절 시험과 다르다.
- I4 / guard.cs:53/418–419/1347/1414–1415/1540/1650–1655: KernelHandle.ReleaseHandle이 close 실패를 false로 흡수하므로 unknown bool 누적만으로는 후속 원 자원 close를 멈추지 못한다. event close 실패에도 참조를 null로 버리고 pipe close가 이어지는 경로가 있다. 원 run이 연결된 경우 close 불명을 고정하고 후속 회수를 중단하며 원 참조/raw 관측값을 보존한다. 일반 null 경로는 유지한다. 최초/중간 close의 false·내부 예외에서 후속 close0·UNKNOWN/원 참조 보존의 미래 반례가 필요하다.

## 검수 범위와 다음 조치

전체 검수는 지정4 diff와 launcher→bootstrap→C→fixture/probe→Cleanup/Snapshot/Capture→collector→ACK→exit/회수를 읽었다. strict Reader.End 뒤 deep 보존/ACK, ACK 뒤 EOF 및 기존 gate/QAmax2에서는 추가 확정 지적이 없었다.

한정 검수는 상위 예산의 실제 전달, 기존75/70초 선행·전체60초 상한 보존을 소스에서 확인했다. pending OVERLAPPED의 terminal 확인 전 해제하는 신규 경로는 이번 범위에서 발견하지 못했다. 이는 실제 OS 정당성 보장이 아니다.

실제 compiler/C#parser/RunAll/Assembly/native/pipe/process/fixture/ACL/trust/DB/서비스/Agent 실행0, 검수자 변경0이다. 담당자는 쓰기를 해제했고 native4는 동결 상태다. 다음 UI 구현 담당만 단일 writer로 작업 중이며, 해당 자연 단위 종료 뒤 같은 N4 담당에게4지적의 최소 보완을 전달한다. Main은 제품을 수정하지 않는다. 미해결 지적을 남긴 채 합격·Stage 완료·실행 허가로 승격하지 않는다.

## 게시 전 보존 감사

Main137beb의기존Git개행정책대조에서native작업원문8BAFA840과저장blob5D7EF2D9(오브젝트79c95e5e)는CRLF→LF만다르다. 나머지3source는동일바이트다. 실제checkout/compile/OS는미실행이며round1담당은전역config오류로보완적용0에서종료했다. Important4는계속열려있다.

## 보완 round1 후보 — 재검수 전

원담당은I1~I4최소수정과관련미래시험source를작성하고writer를해제했다. native D3235B380633E005ABD475A5730B42C982AE64F4AB162F48538C6B77B4DD79F0, PS1EA9445DDC3309E67B201231D214968B70D82DA6EE6624BBAE59E1C2E951D2E6, transport시험1B8D86FAFA3B970E0EA984759C384EF27098563512CE5992825AE24EEB0E9B53, payload시험2AED0B860A39F55604DE55BC435239AC8895B85341DFB148A0313878BB4C963E다.

담당287fd1은소유4 strictdiff0/실행없는PS AST errors0·기존G/W/frame/OwnedRuntime텍스트불변·PS전체/R0/최초throw불변·4false/QAmax2/75·70선행유지를보고했다. Main은정확4hash·소유diff를대조하고같은PS해시의이미수행한구문검사를반복하지않는다. native+82/-37·payload시험+34·transport시험+43/-1이며기존반례는유지했다.

I1실패raw비소유기록,I2 UNKNOWN메모리Snapshot9→private Capture뒤전송거절,I3 Remaining/Adopt실패latch,I4 원CloseOriginal receipt/최초불명후효과차단과terminal event의성공후에만참조제거가담당의보완요지다. 미래시험은실제budget객체상태전이·첫/중간close false/예외·실패raw/정리차단·UNKNOWN Cleanup/Capture를다룬다.

실제C#parser/compiler/RunAll/Assembly/native/OS·DB/서비스/Agent 실행은제외그대로다. 해당미래시험을실행한TDD/PASS로표시하지않는다. 독립재검수는이후fixdiff와I1~I4의ADDRESSED/NOT_ADDRESSED·새파손만판정하며,현재4지적의해소를먼저선언하지않는다. native작업blob76d1a599와예정저장blob91a00935의기존개행차이는후속게시전별도감사한다.
## round1 한정 재검수 결과

원 전체호출선검수자는I1/I2 ADDRESSED·fix새C0/I0/M0,예산/소유검수자는I3/I4 ADDRESSED·fix새C0/I0/M1을제출했다. 지정4해시를시작/종료에대조했고변경/실행0이다. 실패raw는비소유로원owner에보존/후속정리차단,예산실패는UNKNOWN Snapshot9→private rows/payload보존뒤동일latch의Peer검사에서전송거절된다. Remaining/Adopt의영구faulted와실제STOP/fallback/close소비지점,Dispose전wrapper/raw 선등록·결과receipt·실패후전체budget차단,event성공뒤에만참조제거를source로확인했다.

M1은tests/native/FN06/StandaloneReportTransportSourceTests.cs:134–149의미래close시험이다. CompleteCloseObservation에결과를직접주입하여실제CloseOriginal→Dispose→receipt/channel event호출선이빠져도잡지못한다. 예산시험은실제budget객체상태전이를다루지만STOP/fallback자체를호출하지않는다. 해당연결은소스대조범위이며실행증거가아니다.

Main판정: 소스수정분의기존Important4는해소로인수하고M1은열린미래검증보완으로보존한다. 현재제품의추가C/I는없다. 현재계약의실행제외를그대로유지하며커널mock/구조개편을추가해사용자기능구현을지연시키지않는다. 미래직접호출선시험보완과실제native/OS 검증은아직미완료이며향후해당검수에반드시대조한다. 이판정은전체N4/FN06/FN08/Stage/계획완료가아니다.