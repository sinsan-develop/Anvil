# A3 native compile-02 결과 — 실제 컴파일 FAIL

Main 어울, 2026-10-18. **실제 compiler 1회 FAIL / DLL 미생성 / 등록 QA 정리·독립 부재 확인**. 원 compile-01/02 사전검사 실패와 실제 실행을 구별한다.

## 기준·허용·보정

- 실행 source/local·private clean **9fd0d263bb4e73c738737d570f1e581fc4616d4c** / codex/av3-stage-b, main **f976ed5e29e14b13e12729d5b1ccf98f050f2210** 불변. UI04 후보 이후 native source·compiler/BCL은 불변이다.
- PMO AV3-PMO-A3-NATIVE-COMPILE-HARDLINK: 실제 요청 turn01a14b79-2a8e-77f1-ac93-f209f7ee5eb4 완료20:07:33Z→실clock20:21:48Z/14분15초·최신6turn 답변/중지/거절/수정 부재에 따른 직접 위임 권장A. 고정창 **2026-10-17T20:21:48Z~20:51:48Z**, compiler15초/실제1회/연장·자동재시도0.
- `apps/connector/native/SourceReadObserver.cs` SHA256 **3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC**. 고정 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` SHA **46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00**, 같은폴더 mscorlib **11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C**, System **2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71**. 각3leaf FileInfo/Archive/HardLink/Target null/비reparse/TrustedInstaller owner 전부 동시 일치, source·QA·모든 부모 nonlink 조건은 유지했다.
- 최초02 사전검사는 `A3_COMPILE_COMPILER_VERSION_INVALID`/started:false·PID/DLL/root0로 끝났다. Main이 FileVersion 표시 전체를 숫자 문자열과 비교한 오류다. 실제표시 `4.8.9221.0 built by: NET481REL1LAST_25H2`, 숫자4/8/9221/0 및 fullhash는 승인 대상과 같았다. 보호10/runtime gate 전 중단이며 이 실패를 C# 실패/권한 거절로 부르지 않는다.
- Main은 자동 재시도하지 않고 즉시 최소 판단을 요청했다. PMO가 실제 compiler0·같은파일/해시/clean/부재를 독립 확인한 뒤, **숫자4component와 고정 전체표시 동시일치로만 보정하는 이번 명시1회**를 기존 승인표현 보정으로 회신했다. 새 보안예외/창/횟수/명령/범위 확대0이다. 그 보정 뒤 모든 사전조건을 다시 통과한 실제 최초 compiler1회가 아래 결과다.

## 명령·원 결과

고정 csc에 `/nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<고정 mscorlib> /reference:<고정 System> /out:<등록 bin/SourceReadObserver.dll> apps/connector/native/SourceReadObserver.cs`만 전달했다. UseShellExecute=false/CreateNoWindow=true, child TMP/TEMP만 등록temp, owned handle·exe/PID/start·stdout/stderr16KiB 상한·15초를 검사했다. raw 출력/실제 source 파일명·OS 문구를 외부나 파일에 보관하지 않았다.

```json
{"scope":"LIBRARY_COMPILE_ONLY","commit":"9fd0d263bb4e73c738737d570f1e581fc4616d4c","status":"FAIL","failure":"A3_COMPILE_EXIT_NONZERO","cleanupFailure":null,"started":true,"exitCode":1,"elapsedMs":90.036,"compiler":{"pid":63852,"exe":"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe","startUtc":"2026-10-17T20:26:22.4408281Z"},"diagnosticCodes":[{"code":"CS1504","line":null}],"output":null,"qaRootAbsent":true,"dllLoaded":false,"nativeFunctionsInvoked":0,"osSourceObservations":0,"actualAgentCalls":0,"databaseWrites":0,"serviceChanges":0}
```

- exec 최종 exit1. **90.036ms는 compiler 관측 시간**이며 SSH/실행기 전체 대기나 timeout이 아니다. PID63852의 고정exe/start를 기록했고 직접child 잔류0·정확 owned process 종료 후 정리했다. 실제 compiler 추가호출0이다.
- [Microsoft CS1504 설명](https://learn.microsoft.com/en-us/dotnet/csharp/misc/cs1504)은 소스 열기/읽기 실패 범주다. 이번 정제 출력은 코드/행만 보존했으므로 **실제 파일 역할·OS 이유는 미확정**이다. ACL·잠김·인코딩·다른 파일·제품 문법 오류로 단정하거나 원문을 복원하지 않는다.
- 과거 FN06의 같은 compiler CS1504/OTHER_SOURCE·UNKNOWN 기록을 읽기 전용으로 찾았다. 다른 실행·source의 당시 증거이므로 이번 직접 원인으로 확정하지 않고 과거 승인/실행을 재사용하지 않는다.

## 정확 정리·독립 후검사

- 신규 Main/현재사용자 소유 `D:\tmp\anvil-v3-stage-b\a3-native-compile-02/{bin,temp}`만 만들었다. DLL/output은0이다. 정상 종료/직접child0·사용process0, 등록 실경로/전체목록·owner/nonlink·file hash 조건 뒤 이번 빈폴더만 제거했다. cleanupFailure:null·qaRootAbsent:true이며 **별도 읽기 Test-Path false, compiler63852 부재**를 재확인했다.
- 독립 elevated 읽기: **보호10 hash mismatch0**. Node54212/exe `C:\Program Files\nodejs\node.exe`/start2026-10-17T19:08:16.5819440Z, relay26052/exe `C:\Program Files\WSL\wslrelay.exe`/start2026-10-15T12:28:17.5262970Z, 단일127.0.0.1:3830/소유54212는 불변이다.
- N4 receipt SHA **50459C537F84E4E9DB8B1DD35F3301638B1843EAB05A8928B7DEAEE1B5F74F92** 동일. 기존 runtime/backup/원 실패자료는 보존했고 DLL load/실행·reflection/Add-Type/PInvoke/helper·OS source 관측·키/DPAPI/권한·실token/등록·계정/정책·DB/서비스·Agent/비용/Oracle/main 변경0이다.

## 판단·다음

- 이번 실제 compiler1회는 소진됐고 남은 창 재사용/자동 재시도0이다. C# 구문/참조 호환조차 통과로 표시하지 않으며 ABI/flag/실OS·host/키/TLS/Agent·FN06/FN08/UI11/Stage/사용자 인수는 미완료다. UI04의 별도 unit8/합성browser5와 실제 served 미반영도 이 실패로 덮거나 완료 승격하지 않는다.
- Main 책임으로 기존 source/현재 정상화 코드·최소 읽기 증거를 대조하여 필요한 파일 역할/OS 이유의 관측 공백을 먼저 좁힌다. 진단 없는 compiler 반복·확인되지 않은 ACL/OS/서비스 수리나 source/compiler 복사로 우회하지 않는다. 새 실제 실행/진단 범위가 필요하면 정확 대상·허용 진단·자원·수명/정리를 갖춘 필요한 결정만 PMO에 요청한다. 다음 업무 배정 대기가 아니다.
- 제품 코드/테스트 변경0이므로 기존35·UI04완료 검사는 반복하지 않았다. 결과·사전검사 오류·정리/미검증을 같은 branch의 문서 checkpoint로 보존한다. 성공이라고 소급하지 않는다.
