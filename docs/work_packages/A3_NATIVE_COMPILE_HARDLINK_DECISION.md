# A3 compile-only 고정 OS HardLink 한정 처리 결정 요청

Main 어울, 2026-10-18. **현재 제안·미승인. 재실행0.** 목적은 이미 작성된 native library 소스의 구문/참조 호환 확인뿐이다. 다음 업무 배정을 요청하는 문서가 아니다.

## 사실·선택

- compile-01의 `A3_COMPILE_LINK_DENIED`는 compiler 실행 전 guard 거절이다. PID/DLL/QA root0이며 남은 과거 창을 재사용하지 않는다. 원 결과는 `docs/04_test_reports/AV3/FN08/A3_NATIVE_COMPILE_01_RESULT.md`.
- **A 권장:** 아래 정확 OS 3파일의 HardLink만 허용하고 새 창/새 root에서 compiler 단1회·최대15초. 파일 이동/OS·ACL 변경 없이 구문 확인이 가능하지만 실제 OS 관측 안전이나 host 연결은 증명하지 않는다.
- **B:** 컴파일 보류·native 미검증 유지. 새 compiler 실행 위험은 없으나 실제 Agent의 source 관측 선행은 남는다. 독립된 승인 계획 기능은 Main이 계속한다.

## A의 허용과 유지 조건

1. 실행 직전 새 안전 checkpoint의 full commit·local/private exact clean·main 불변을 결박한다. 제품 source는 `apps/connector/native/SourceReadObserver.cs` SHA256 **3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC**로 고정하며 내용/기대값 변경0이다.
2. 고정 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` version4.8.9221.0/hash **46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00**, 같은 폴더 `mscorlib.dll` hash **11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C**, `System.dll` hash **2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71**만 대상이다. 이 세 leaf에만 FileInfo/Archive/LinkType HardLink/Target null/ReparsePoint false/owner `NT SERVICE\TrustedInstaller`를 전부 요구한다. 하나라도 다르면 중단한다. **source·QA·모든 부모의 nonlink/비reparse 조건은 완화하지 않는다.** 다른 OS 파일·symlink/junction·compiler 복사/권한 변경은 허용하지 않는다.
3. 새 Main/현재 사용자 소유 `D:\tmp\anvil-v3-stage-b\a3-native-compile-02\{bin,temp}`만 생성, DLL은 `bin\SourceReadObserver.dll` 하나. 부재/실경로/전체 부모 nonlink·owner, source/compiler/BCL full hash, 보호10hash·Node54212/relay26052/exe/start·단일loopback3830을 직전 대조한다. 기존 환경/ACL/서비스/DB0이다.
4. 승인 전달 시점부터 새 고정30분 창을 기록한다. compiler 자체 최대15초, 단1회/자동 재시도·연장0. 명령은 `/nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<위 mscorlib> /reference:<위 System> /out:<등록 DLL> apps/connector/native/SourceReadObserver.cs`로 이전과 동일하다. child TMP/TEMP만 등록 temp, UseShellExecute=false/CreateNoWindow=true, owned handle/PID/exe/start·직접child, stdout/stderr16KiB 상한·외부에는 exit/CS숫자코드·행/고정실패만 남긴다.
5. 정상/실패 모두 owned compiler·직접child 종료/사용process0→정확 root/owner/nonlink/파일목록/hash 대조→이번 DLL·임시파일/빈 폴더만 정리→독립 root 부재를 확인한다. 예기치 않은 파일/소유 불명/미종료는 광범위 kill/delete 없이 보존·보고한다. 소스·고정compiler로 재생성 가능한 산출만 제거하며 기존 runtime/backup·원 실패 자료는 보존한다.
6. DLL load/실행·reflection/Add-Type/PInvoke/helper·실 소스 OS 관측·링크 fixture·키/DPAPI/Secret·실 token/등록/계정·정책/DB·서비스·Agent·비용/Oracle/main 변경0이다. compile PASS를 ABI/flag 실동작·OS 안전·Agent 지원·제품 완료로 승격하지 않는다. 새 실패·플랫폼 거절 시 자동 재위임/우회0.

필요한 정확 결정: **A의 고정 OS 3파일 HardLink 한정 처리와 새 compile-only 단1회**. 기존 원 실패와 준비 시험은 소급 PASS하지 않는다.
