# FN03 컴파일 전용 02 후보

상태 `DRAFT / NOT_APPROVED / EXECUTION_GO0`. 01에서 컴파일러는 시작되지 않았다. [01 실제 결과](../04_test_reports/AV3/FN03_NATIVE_CONTENT_COMPILE_ONLY_ACTUAL_RESULT_20261107_01.md)와 승인 레코드를 보존한다.

## 1. 변경 이유와 범위

기존 PowerShell 7.6.9에서 `Environment.ProcessPath`는 `pwsh.exe`를, `Environment.GetCommandLineArgs()[0]`은 `pwsh.dll`을 반환했다. 01은 둘 다 `pwsh.exe`여야 한다고 검사해 승인 파일 읽기 전에 사전 차단됐다. 02는 실제 프로세스 경로와 관리 런타임의 첫 인자를 구분한다. PowerShell 이미지와 나머지 인자의 대조는 유지한다.

- 프로세스 이미지 `C:\Program Files\PowerShell\7\pwsh.exe`, 301,360B, SHA256 `2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233`.
- 관리 진입 파일 `C:\Program Files\PowerShell\7\pwsh.dll`, 157,480B, SHA256 `682C403FD13E667FF9C67F28750C8FEDEC8AD60F962662D83642B48A6C3F2154`. 관측 당시 SYSTEM 소유, 링크·reparse 없음. 실행 전 경로·지문·파일 종류·상위 경로를 재검산한다.
- 호스트 인자 7개는 관리 런타임이 반환한 첫 인자와 나머지 `-NoProfile -NonInteractive -File <고정 실행체> -ApprovalSha256 <고정 승인 레코드 해시>` 순서를 정확히 비교한다. 외부에서 시작하는 실행 파일은 지정 `pwsh.exe`다.
- 입력 C# 2개, compiler 및 참조 3개, 지정 옵션 17개와 자식 환경 제한, 원 Process의 두 출력 수집, `result.json` 및 보존 조건은 [01 고정 실행안](FN03_NATIVE_CONTENT_COMPILE_ONLY_FIXED_PACKET_20261107.md)을 따른다. 경로만 아래 02의 새 전용 QA로 바뀐다. 01의 역사 서명 채택은 01에 귀속되므로, 02에서 같은 근거를 쓰려면 이번 결정의 범위에도 포함해야 한다.

## 2. 단발 자원과 결과

- 새 후보 `FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_02`. 새 QA `D:\Project\Anvil\.av3-data\fn03-content-compile-20261107-02`, 같은 상위의 `fn03-content-compile-20261107-02.consumed.json`, 새 승인 레코드 `docs/approvals/FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_02.json`을 각각 고정한다. 기존 01 승인·결과를 수정하거나 재사용하지 않는다.
- 승인 후 최대 30분, 컴파일 최대 1회, 결과 관측 15초와 진단 16KiB. compiler를 시작하기 전에 정확 보호 경로와 배타 marker를 검산한다. marker 또는 QA 신원이 불명일 때 재호출하지 않는다. 시작했다면 원 세션의 종료, 비어 있는 stderr, 잘림 없는 단일 stdout 및 저장 영수증을 대조한다. 불명은 정착을 기다리고 전용 산출물을 보존한다. 자동 종료·삭제·재시도는 하지 않는다.
- 실행체 `scripts/run-fn03-native-content-compile-only.ps1` 31,962B, SHA256 `FC575A2B24A291CAB342ABEEE0F9EC6914B37D8DFF7020EB79DDE4CFF909CF09`. 기존 승인 JSON의 `host`에 `commandLineAssembly`를 추가하며 하위 정확 세 키 `path`, `bytes`, `sha256`는 §1의 DLL과 일치해야 한다. 01의 나머지 형식과 입력·tool·역사 서명 근거는 보존한다. Main은 이 문서와 실행체를 포함한 정확 로컬 커밋과 두 원본 지문을 결정 요청 및 외부 사전검사에 결박한다. 이 후보 문서만으로 실제 실행하지 않는다.
- 검증은 DLL 컴파일까지다. DLL 로드·실행, C# 시험·PInvoke·실파일 검증, 키·DB·권한·서비스·Agent 실행과 원격 쓰기는 제외한다.
