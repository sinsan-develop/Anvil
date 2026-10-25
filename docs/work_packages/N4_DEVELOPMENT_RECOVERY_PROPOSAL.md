# 마지막 검증 개발 서비스 복구 — 실행 전 제안

## 2026-10-25 두 가지 새 직접승인 반영

- 고립 host의 내부 원 진입 객체를 추가했다. 실제 Main·기존 false gate 뒤 프로세스당 일회 원 객체를 만들고 같은 스레드/run/commit/창·host1회·복제1회에만 사용한다. 공개 factory는 child-pin case를 받지 않으며 내부 원 객체를 외부 입력으로 채택하지 않는다. 이 소스는 다른 코드의 일반 spawn을 차단하는 장치나 새 실행권위가 아니다. 독립 현재 소스 정적 C0/I0/M0·실제 컴파일/native 동작/OS NOT_RUN, exclusive false 유지다. 아래 R0 단일 권장 d71/F81는 고정 snapshot이며 이 추가 소스를 자동 편입하거나 옛 답변의 적용 대상으로 바꾸지 않는다. 그 컴파일 결과도 후속 소스의 검증이 될 수 없다.

- child-pin 원소유 제어도owner→원pin→원probe→fixedchild→finally process회수확정뒤fixture정리로연결했다. exclusiveSpawn false/실standalone entry가현재factory생성전차단하며lifetime NOT_VERIFIED·정적C0/I0/M0만이다. 종료/close불명은fixture/원owner·pin보존, actualcompile/OS0. nativeF81A77B40B55F0FBEAE58C62649007377FAA7D38BF78946F8F48684930D65F49는직전6093/376과다른source여서아래단일컴파일후보를이코드checkpoint로현행화한다.

- 고립host Main 최소진입은실EntryAssembly/EntryPoint·고정argv/UTC·동일원hostfinally정리·NOT_ACCEPTANCE/exit2로작성했다. DLL/PS에서Main호출하면entry대조전QaAdapterfalse에서차단한다. finalLF 별칭은C#/PS경계의절대끝대조로보완했으며TS코드는이미거절하여수정0. native376F43B5CD549BED2A5610C190179910CE3B6FA6354F7651E87212CDFFB452D6는이전권장b6/1589와다른source이고R0정확후보를아래표에별도로갱신한다. 전용exe컴파일/실행·process-wide상속배제/guardian시험은여전히미승인·미검증이다.

- 실제loader source도 같은FileStream/private바이트의SHA→같은바이트Load→같은Assembly/publicsealedType/정확Create signature·return/instance에결박했다. hostraw0DCB746D1FC6FD0E6A5A51755E6E638DA03D1FD645ECD1E7631B4D66546D1646·현재literal차단/정적C0/I0/M0, actualload/OS NOT_RUN. caller와별개인정확외부실행결정/출처결박이없으면expectedSHA만으로차단해제불가이며새registry를구현하지않았다. R0는b6c41545/native1589한파일로유지, R0정리후R1에서재사용할DLL은없으므로actualR1artifact생성/등록은별도선행이다.

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
