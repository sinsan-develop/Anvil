# FN03 원문 내용 관측 소스의 컴파일 전용 실행안

상태 `DRAFT / NOT_APPROVED / EXECUTION_GO0`. 기존 FN03 B 채택은 native 소스와 합성 시험 소스 작성까지 허용한다. 이번 별도 결정 대상은 고정 입력 두 개의 DLL 컴파일 단 1회다. 이 문서와 소스 체크포인트는 실행 권한을 부여하지 않는다.

## 1. 고정 입력과 사전 검산

- 후보 ID `FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_01`. [부모 후보](FN03_NATIVE_CONTENT_COMPILE_ONLY_EXECUTION_CANDIDATE_20261107.md) 10,061B, SHA256 `01203E641DA2BC4DA720E3EA5F7143D0718661CF9702927D83B1148B71366285`.
- 원 소스 기준 `93bca154cdc64527d320d2a7b9aad1b7d381f75a`. `apps/connector/native/SourceContentObserver.cs` 39,004B, SHA256 `C714C4C16DFF65794D9B7B40D7D0B3DCDFA34849E33ACF211EB1A06CD04E4482`. `tests/native/FN03/SourceContentObserverSourceTests.cs` 17,557B, SHA256 `8806E2A72C35449429E07BFA217D06D10B3FE25345E8D97473A3257B5723AB08`.
- `scripts/run-fn03-native-content-compile-only.ps1` 30,518B, SHA256 `ED564C5CB4DFB5AE4C11306AA05175B15967679926756C19E0857C970CC3ACD2`. Main은 제출 직전 이 파일과 이 문서를 포함한 정확 로컬 커밋과 두 파일의 원본 지문을 결정 요청에 함께 적는다. 실행 전 같은 커밋·지문을 확인한다. 원격 게시 또는 배포는 별도 범위다.
- PowerShell `C:\Program Files\PowerShell\7\pwsh.exe` 7.6.9, 301,360B, SHA256 `2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233`. 기존 지정 Windows `csc.exe`와 세 BCL의 경로·크기·지문은 부모 §3 그대로이며 현재 읽기 전용 조회에서 일치했다. 실행 전 각 파일과 상위 경로의 신원 및 Windows 지정 네 파일의 TrustedInstaller 소유를 다시 검산한다.
- 부모 §3의 서명 선행은 이번 결정에서 명시 채택하는 경우에 한해 동일 바이트의 역사 관측을 사용한다. 기준 `93bca154cdc64527d320d2a7b9aad1b7d381f75a:docs/WORK_STATUS.md:6947,6950`의 2026-10-17 `Valid/Microsoft`, compiler 4.8.9221.0, SHA256 `46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00`이다. 이번에는 현재 동일 바이트·소유자·경로를 검산했다. 새 Authenticode·신뢰 또는 인증서 상태 조회는 미실행이며 `authenticodeObserved=false`를 유지한다. 명시 채택이나 동일 바이트 근거가 없으면 marker 생성 전에 차단한다.

## 2. 승인과 정확 호출

- 실제 결정 원문에서 후보·실행 커밋·서명 근거·정확 호출·보존 범위·기한을 대조한 뒤에만 Main이 고정 `docs/approvals/FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_01.json`을 작성한다. 그 로컬 기록은 원 승인 검산용이다. UTF-8 바이트 지문을 `ApprovalSha256`에 결박한다. 발행부터 최대 30분, 컴파일 최대 1회다. 기록의 `issuedAt`과 `expiresAt`은 UTC 밀리초 형식이며 동일 기한을 연장하지 않는다.
- 승인 기록은 실행체 `Read-Approval`의 고정 22개 키를 정확히 사용한다. `authorization=APPROVED_COMPILE_ONLY`, `maximumRuns=1`, `compilerSignatureBasis.kind=HISTORICAL_AUTHENTICODE_EXACT_BYTES`, `acceptance=EXPLICITLY_ACCEPTED_IN_DECISION_SOURCE` 및 §1의 정확 역사 증거를 검산한다. `decisionId`와 `decisionSourceRef`는 실제 승인 원문의 식별자다. 미발행 상태에서 예시·합성 승인 레코드를 실행 입력으로 만들지 않는다.
- 외부 호출은 지정 `pwsh.exe`에 `-NoProfile -NonInteractive -File <검산한 실행체 절대경로> -ApprovalSha256 <승인 레코드의 대문자 SHA256>` 순서로 한 번만 전달한다. 새 호스트가 받은 실제 인자 7개를 실행체가 대조한다. 프로필·도트소싱·추가 인자·스크립트 검색 경로를 사용하지 않는다. 호출 도구는 로그인 셸 초기화를 사용하지 않으며, 해당 호출의 `PSModulePath`를 기존 `C:\Program Files\PowerShell\7\Modules`로만 지정한다. 사용자·시스템 영구 환경은 변경하지 않는다. 외부 도구 세션은 실행 결과의 최초 수집에 쓰고, 실행 중 기한 도달만으로 세션을 중지하지 않는다.
- `D:\Project\Anvil\.av3-data\fn03-content-compile-20261107-01`과 같은 상위의 `fn03-content-compile-20261107-01.consumed.json`을 고정한다. 실행체가 소유·ACL·비링크·정확 대상 부재를 검산한다. ACL 변경은 제외한다. marker를 배타적으로 생성하고 flush·재조회한 뒤 새 QA와 고정 `src`, `bin`, `temp`를 준비한다. marker 생성 시도 뒤에는 재실행하지 않는다.
- compiler는 부모 §4에 명시한 순서로 정확 17개 인자를 직접 받는다. `Q`는 이 절의 전용 QA 경로, `B`는 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319`이며 `Q`와 `B`는 실행체의 고정 절대경로로만 치환한다. 작업 폴더는 `Q`, 출력은 `bin/SourceContentObserverSource.dll`이다. 자식 환경에는 `SystemRoot`, `WINDIR`, 전용 `TEMP`, `TMP`만 전달한다.

```text
/noconfig /nologo /nostdlib+ /target:library /debug- /optimize- /warn:4 /warnaserror+ /platform:anycpu /codepage:65001 /utf8output
/out:Q\bin\SourceContentObserverSource.dll
/reference:B\mscorlib.dll
/reference:B\System.dll
/reference:B\System.Core.dll
Q\src\SourceContentObserver.cs
Q\src\SourceContentObserverSourceTests.cs
```

## 3. 원 프로세스와 결과 인수

- 같은 Process의 두 pipe 읽기를 image 관측 전에 시작한다. 관측·판정 한도는 15초와 승인 잔여 중 짧은 쪽이다. stdout/stderr 합산 16,384B, 개별 읽기 4,096B, 비밀 없는 CS 코드·위치 128개로 제한한다. `PASS_COMPILE_ONLY`는 원 PID·시작·image, exit 0, 양쪽 EOF, 유효한 진단, 전후 입력 일치와 단일 DLL 지문을 모두 요구한다. DLL은 바이트 지문만 확인한다.
- Main이 `PASS_COMPILE_ONLY`를 인수하려면 원 호스트가 정상 종료 코드 0을 반환하고, stderr가 비어 있고, 잘림 없는 단일 stdout JSON이 전용 `result.json`과 일치해야 한다. 줄 끝 개행만 제외한다. marker 원본 지문, 후보·승인·커밋·실행체 지문 및 원 Process 식별 결과도 대조한다. 결과는 배타 생성·flush·재조회 후 출력한다. 수집 손실, 식별·기한·종료·pipe 미정착, 영수증 쓰기 또는 비교 불명은 `UNKNOWN`으로 보존한다. 진단 불명에서 성공·실패를 추정하지 않는다.
- 15초는 관측 한도다. 미정착이면 먼저 결과 보존을 시도하고 원 프로세스 및 읽기 작업이 정착할 때까지 같은 호스트가 대기한다. 호스트 반환이나 compiler 종료에 상한을 보장할 수 없다. 도구는 원 세션의 핸들로만 수집하고, 시간 초과로 신호·종료·재실행하지 않는다. 이 실행안은 파일 자동 삭제·정리를 포함하지 않으며 marker·QA·영수증·DLL을 보존한다. 실제 결과 뒤 정확 소유·종료·범위를 확인할 수 있을 때만 후속 정리를 별도로 판단한다.
- 컴파일만으로 C# 합성 시험 실행, 실제 Windows ABI, PInvoke, 원문 관측·취소·LINK·서비스 연동 또는 FN03 완료를 판정할 수 없다. DLL 로드·실행, `RunAll`, 실제 사용자 자료 조사, DB·권한·키·서비스·SDK·Agent 실행은 제외한다.
