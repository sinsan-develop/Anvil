# FN06 신규 Ownership native — 중간 라이브러리 컴파일 D2 후보

## 판정 / 필요한 정확한 결정
- 작성 2026-10-23, Main 어울. **미승인·미실행 후보**다. D1 source 승인을 실제 compile 승인으로 해석하지 않는다.
- 권장: 아래 고정 source 4개를 시스템 csc 1회로 **DLL 컴파일만** 한다. 누적 source의 C# 구문/참조/경고를 더 큰 factory 구현 전에 확인하려는 중간 검증이다. 전체 Host/actual 권위 완성·실행 가능 후보·D3 준비 판정이 아니다.
- PMO에 요청하는 별도 실제 효과는 (1) exact 새 임시 디렉터리 1개와 그 디렉터리/자식에만 적용할 보호 ACL 생성, (2) exact csc 프로세스 최대1회, (3) exact 생성 소유 자료의 종료후 정리다. 승인 전 생성/ACL/컴파일0이다.
- 기존 미결 ProviderHandle source/runner/거절 및 보호 `FN06_NATIVE_COMPILE_ONLY_CANDIDATE.md`는 다른 대상으로 보존한다. 여기에는 포함/재사용/수정/재시도하지 않는다.

## 입력 고정
source checkpoint: `e12370642e77db9a28b677a3a325d5d2aef12568`, branch `codex/av3-stage-b`. 아래는 Windows 작업 바이트 raw SHA256이며 Git LF blob과 구분한다. 기존 branch의 해당 실제 파일 raw hash·tracked diff 부재와 Git 기준 source를 실행 직전에 대조한다. 변경되면 자동 재해석/재컴파일하지 않는다.

| 저장소 경로 | raw SHA256 |
|---|---|
| apps/connector/native/OwnershipEvidenceHost.cs | 14445D931618FE5132AA5C3D91BE9C6321A83A37D941AF01712916CC6499FBDC |
| apps/connector/native/OwnershipEvidenceWorker.cs | 4FFADB0DD6F04D274F02F2DD467F3279B220BD08D9F8A30DC7CEF535D380C1B9 |
| tests/native/FN06/OwnershipEvidenceHostSourceTests.cs | 2134B50A11BF41BF0A98285A8BB4EB2FABBF97AE6C1FFA6E9A3123F28D28CB78 |
| tests/native/FN06/OwnershipEvidenceWorkerSourceTests.cs | B76EEB9BD99B9AE26385E9F8418646115B36EC9BA7C5578A57E56D92009CCCF1 |

## 컴파일러 / 참조
모두 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\`의 기존 파일이다. 새 설치·업데이트·대체 compiler·NuGet/MSBuild0이다. csc metadata는 길이2569832/version4.8.9221.0이며 이 확인은 실행 결과가 아니다.

| 파일 | SHA256 |
|---|---|
| csc.exe | 46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00 |
| mscorlib.dll | 11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C |
| System.dll | 2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71 |
| System.Core.dll | 8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D |

## 임시 자원 / 보호 / 수명
- 새 exact root: `D:\tmp\anvil-v3-fn06-ownership-d2-compile-e1237064`. 현재 Test-Path=False. 부모 `D:\tmp`는 SINSAN\cyhuh 소유 nonlink이고 D:도 관측시 nonlink다. 생성 직전 부모·정확부재/link/owner/realpath를 재확인한다.
- D:\tmp ACL은 다른 사용자 Modify/Read 상속을 포함하므로 그대로 private source를 복사하지 않는다. **새 root 1개만** 상속차단·현재 실행 사용자 SID와 SYSTEM의 FullControl/ObjectInherit·ContainerInherit 보호 ACL로 원자 생성하는 것을 제안한다. 기존 부모·소스·공유 ACL/owner/계정은 변경하지 않는다. 안전한 생성/보호 확인이 불가하면 복사/compile 없이 중단한다.
- root 안에는 위 source4개를 basename 그대로 복사·각 raw hash 대조하며, 출력은 `OwnershipEvidenceSource.dll` 1개뿐이다. stdout/stderr는 프로세스에서 메모리 수집하고 결과서에 비밀 없는 진단을 남긴다. 키/Secret/DB/다른 소스/Backup0.
- 승인 시점부터30분 내 최대1회 실행·동일 turn에서 종료/정리한다. compiler30초 초과는 성공이 아니라 TIMEOUT/UNKNOWN이다. 사전 허용된다면 시작시 기록한 exact owned csc PID·StartTime·exe path를 다시 대조한 그 프로세스만 중지한다. 신원 대조 불가/예상밖 자원이면 다른 kill/재시작/강제삭제 없이 보고하고 보호 root를 보존한다.

## 정확 인자 / 제외
ProcessStartInfo는 exact csc 경로/UseShellExecute=false/CreateNoWindow=true·stdout/stderr redirect, shell/추가 환경/response file0으로 실행한다. 인자는 다음 고정 집합이다.

`/noconfig /nologo /nostdlib+ /target:library /debug- /optimize- /warn:4 /warnaserror+ /platform:anycpu /codepage:65001 /utf8output`

추가 인자는 exact root의 `/out:OwnershipEvidenceSource.dll`, 위 고정3개 framework DLL `/reference:...`, 복사된 source4개다. default rsp·추가source/analyzer/패키지/테스트 runner0이다. 입력 hash/부재/ACL 불일치 또는 compiler거절/실패면 다른compiler·target·경고완화·재실행으로 우회하지 않는다.

DLL/worker/helper/RunAll/정적initializer를 **실행·로드·호출하지 않는다**. P/Invoke·파일조회/프로세스/Job/thread worker생성/Agent·socket·실키/credential/인증서/기존서비스·DB/SQL·WSL/Oracle0. compiler1개 자체와 새 build root의 생성/정리만 예외 대상이다.

## 결과 / 정리 / 후속
- exit·실제 stdout/stderr·소요시간·출력 존재/길이/SHA를 기록한다. exit0이더라도 C# compile만 증명하며 native 시험실행/OS/권위/Agent는 NOT_RUN이다. source 미래시험은 컴파일만 되고 호출하지 않는다.
- 종료후 exact owner/nonlink/root 하위 및 예상 basename5개·자식부재를 검증해 생성소유 file4+DLL만 개별 삭제하고 빈 root만 삭제한다. 보호/예상목록 불일치면 재귀삭제하지 않는다. 독립 부재 확인후 종료 기록한다. source는 Git/checkpoint에 남아 재생성 가능하며 DLL은 폐기한다.
- 한 번 실패하면 source/진단은 기록하고 D1 source 보완은 기존 범위에서 계속한다. 새 raw hash의 재compile은 이 단발 허가를 재사용하지 않고 별도 exact 대조/결정을 따른다. 기존 Native/ProviderHandle 거절과 SQLpendingM1/REQUIRE/보호8은 유지한다.
