# FN18 NuGet ConfigFile 한정 도구 진단 실행안

2026-11-01 / Main 어울 / 원 FN18 단계C 검수의 제한된 개발 도구 진단. 아직 실행 GO 전.

## 목적·기준
제품 source/private checkpoint b15050e7779047bf5f81b0a6891b1c50bf362a83와 make rawSHA EA28FBD614FDC794BDB346929ED3E5AD30C29CEF67B3724C423667EA2BBBE2E2를 사용한다. 기존 실제 build 전 native guard는 그대로 닫혀 있다. 이 실행은 작은 합성 nuspec에서 고정 NuGet이 명시 설정 옵션을 실제 소비하는지 확인한다. core.make/Anvil 패키징/설치 gate를 호출·우회·해제하지 않으며 성공해도 완전한 native 격리/Anvil artifact/설치/전체FN18 PASS가 아니다.

원 FN18_DEVELOPMENT_INSTALLER_ARTIFACT_IMPLEMENTATION_20261101.md §3의 Main source/toolchain 검수·새 소유 자원 등록 후 별도 단계C GO로 수행할 개발 도구 검수다. 실제 DB/권한·키/서명·서비스·Agent·운영/외부 배포/설치·사용자/백업 자료 조사는 제외한다. 누락 runtime/권한/도구가 있어도 자동 설치·설정 변경·재시도하지 않는다.

## 고정 도구·정확 명령
- 고정 Node C:\Program Files\nodejs\node.exe v24.22.1. Windows current user SINSAN\cyhuh.
- repository-relative apps/desktop/node_modules/electron-winstaller/vendor/nuget.exe. 패키지5.4.4, 파일1664000B, SHA25661704F7DBE233980992F2A00EF9BAACF64A8B157D688A4A4BE6B7A2EAEA02828. e40914에서 실제 resolve/realpath/nonlink/nlink1/size/hash를 읽기 확인했다. 이 package version은 exe 자체 버전/옵션 지원의 실증이 아니다. 0791b3의 파일 리소스 metadata는 FileVersion2.8.50926.602/ProductVersion2.8.3이며 실제 CLI 실행 결과와 구분한다. 6c5beb는 CLR metadata v4.0.20926/flags3(x86 필요)와 기존 Framework4 x86/x64 clr.dll 존재를 읽기 확인했다. 이는 native 실행/설정 격리 PASS가 아니며 런타임 오류가 나도 설치·OS 설정 변경0이다.
- 정확히 최대2회, 동일 nuspec/payload를 각 새 output에서 실행한다. 정상 설정 실행이 알려진 성공일 때에만 예정된 음성 설정 실행을 진행한다. 그 외에는 중단·기록하고 자동 재시도0.
```
nuget.exe pack <root>/probe.nuspec -BasePath <root>/payload -OutputDirectory <root>/out-valid -NoDefaultExcludes -ConfigFile <root>/NuGet.valid.Config -NonInteractive
nuget.exe pack <root>/probe.nuspec -BasePath <root>/payload -OutputDirectory <root>/out-invalid -NoDefaultExcludes -ConfigFile <root>/NuGet.invalid.Config -NonInteractive
```
- nuspec은 Anvil.NativeConfigProbe/0.0.1/AnvilQA와 텍스트 probe.txt 하나만 담는다. 소스 프로젝트/실제 Anvil 파일/Assembly/project build/restore/include-referenced/서명·원격 옵션은 없다. NuGet을 설치하지 않으며 Squirrel/7z/Setup/Update/app/서비스·Agent는 기동하지 않는다. 실제 실행은 기존 NuGet.exe 최대2회뿐이다.

## 생성 전 고정 자원·수명
- 새 root D:\tmp\anvil-v3-fn18-nuget-config-probe-20261101-01. 생성 직전 부재·parent realpath/link를 재검사한다. owner SINSAN\cyhuh·일회 marker nonce/sourceCommit/toolHash를 기록한다.
- 고정 파일: owner.json, probe.mjs, probe.nuspec, NuGet.valid.Config, NuGet.invalid.Config, payload/probe.txt, receipt.json. 예정 산출물은 out-valid/Anvil.NativeConfigProbe.0.0.1.nupkg 하나이며 음성 output은 없어야 한다. 추가 생성 파일은 같은 root 안에서만 목록화하고 검토 전 삭제하지 않는다.
- 고정 빈 디렉터리: payload, out-valid, out-invalid, tmp, profile, cache, plugins. cache 하위 NuGet/packages/http/plugin, profile의 AppData/Roaming/Local·home은 이 목적의 합성 실행기 환경이다. 실제 사용자 profile/config를 조사·복사하지 않는다.
- 생성부터15분 수명, 실제 진단 감독 전체120초·각 직접 child 최대30초(원15분보다 짧은 이 진단의 한도). 최초 guard에서 OS monotonic/UTC 최소기한을 고정하고 prep/두 명령이 예산을 공유한다. script source/hash·owner/realpath/link·tool hash/size·상속 없는 환경을 실행 직전 검산한다.
- stdout/stderr 각64KiB 계수/폐기, 원문/환경/credential/stack을 출력·저장하지 않는다. stderr는 메모리 상한 안에서 ‘지정한 잘못된 config/XML 오류’ 같은 고정 boolean으로만 분류한다. 소유 root는 최대128파일/64MiB만 관측하고 초과 시 불명·보존한다. 전체 SDK/의존성/실제 user 파일 전수 hash0.

## 환경·관측·중단
shell:false/windowsHide, cwd=root, stdin=ignore. SystemRoot/WINDIR/COMSPEC/PATHEXT/PROCESSOR_ARCHITECTURE/NUMBER_OF_PROCESSORS 등 Windows 동작 최소값만 복사하고 PATH는 고정 Node/System32/해당 도구 폴더만 둔다. TEMP/TMP/HOME/USERPROFILE/APPDATA/LOCALAPPDATA·NuGet packages/http/plugins/credential-provider 경로는 위 새 빈 root로 한정한다. 토큰/proxy/서명·NODE_OPTIONS·실제 계정값을 상속하지 않는다. 이는 OS filesystem/network sandbox가 설정됐다는 뜻이 아니다.

직접 child PID·spawn/exit/stdio close와 원 감독 함수를 관측한다. timeout/overflow/spawn-error/exit-close 불일치/소유 불명은 UNKNOWN/preserved로 남기고 다음 명령·자동 재시도·공유 PID kill·강제 정리0. observation timeout은 종료가 아니므로 같은 live handle부터 확인한다. 알려진 정상 종료에도 descendant/잔류가 의심되면 별도 근거 확인 전 정리하지 않는다.

## 판정·정리
정상 설정의 알려진 exit0·생성 nupkg의 새 파일/size/hash·음성 설정의 알려진 nonzero/설정 오류 boolean/추가 nupkg0을 각각 기록한다. 음성 실패가 다른 원인인지 확인할 수 없거나 잘못된 설정도 수락되면 옵션 소비는 UNDETERMINED/FAIL로 남긴다. 기대값을 바꾸거나 다른 명령을 즉석 추가하지 않는다.

결과 receipt는 CONFIGFILE_OPTION_PROBE_ONLY/NOT_ANVIL_ARTIFACT/NOT_INSTALLABLE과 실제 exit/byte/기한/hash만 담는다. 이 양성은 사용자·machine 설정/credential provider 미접근·Squirrel/하위프로세스·network/실제 Anvil 설치의 증명이 아니다. 기본 isolation guard는 해제하지 않는다. 알려진 모든 child 종료와 소유/marker/realpath/link·실제 파일 목록을 확인한 뒤 새 소유 파일·빈 디렉터리만 정리하고 독립 부재를 확인한다. 불명 자원은 보존·PMO 보고한다.

이 계획은 코드·공개/저장 계약 추가가 아니다. 정확 script와 자원 사전등록·독립 preflight 검토 후 Main이 최종 실행 GO를 기록하며, 실행 플랫폼이 거절하면 우회/같은 작업 재실행 없이 사유·필요 조치를 보고한다.