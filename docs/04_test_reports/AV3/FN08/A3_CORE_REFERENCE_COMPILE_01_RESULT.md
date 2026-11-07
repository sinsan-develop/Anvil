# A3 Core 참조 추가 단1회 결과

Main 어울 · 2026-10-18 · **PASS_LIBRARY_COMPILE_ONLY / OS source 관측·Agent·전체 기능 완료 아님**

## 결박과 명령

- 실행 branch `codex/av3-stage-b`, exact **d8134bb3079fcca07d7009c336eedb9ff54b4c1e**, 실제 직전/직후 local/private 동일·clean. main **f976ed5e29e14b13e12729d5b1ccf98f050f2210** 불변.
- PMO가 선택A를 실제 실행안/전체diff·실hash와 대조해 DecisionId `A3_CORE_REFERENCE_COMPILE_01` / run `a3-core-reference-compile-01`, **2026-10-18T04:29:55Z~04:59:55Z**(13:29:55~13:59:55KST)에 결박했다. 연장/재시도0·단1회. 정본 WORK_STATUS에 자원/소유/이유/수명/정리를 먼저 등록했다.
- runner **37A9B39B8B19B7F6CFBD6799C881EBE9B1839DBB78FEE6D7FA9C6C6359219E25**, coreflow **D6B66FFE63F1AB6BFC864E9214066915703781F054DBD704FD615180C3A9BFFF**. C# **3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC**·csc/기존 BCL/flags/cwd/절대 source는 보존하고 고정 System.Core 참조1개만 추가했다. 새 QA 출력/TMP 위치는 이전 실행과 다르므로 역사적 argv와 완전히 같은 A/B라고 주장하지 않는다.
- Core 고정leaf **8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D**, 1551104bytes, version4.8.9363.0, Archive/HardLink/Targetnull/TrustedInstaller를 실제 preflight에서 대조했다. 기존 ACL·설치/환경을 고치지 않았다.

실제 당시 명령이며 재실행 허가가 아니다:

```powershell
pwsh -NoProfile -NonInteractive -File scripts/run-source-read-core-reference-compile.ps1 -Apply -Commit d8134bb3079fcca07d7009c336eedb9ff54b4c1e -ScriptHash 37A9B39B8B19B7F6CFBD6799C881EBE9B1839DBB78FEE6D7FA9C6C6359219E25 -DecisionId A3_CORE_REFERENCE_COMPILE_01 -IssuedAt 2026-10-18T04:29:55Z -ExpiresAt 2026-10-18T04:59:55Z
```

## 실제 결과·원 영수증

- tool/compiler exit0, failure/cleanupFailure null. csc PID **54120**, 실제 exe 관측 true, 시작 **2026-10-18T04:31:08.2129541Z**. 기록 구간 **1038.671ms**는 시작~수집/신원 대조 포함이며 순수 compiler CPU/실행 시간은 아니다.
- DLL **14336bytes**, SHA256 **017C35C233D119B4F95A30D528003B6569AF58C7236FBC6AF536A0B14CD90A8A**, loaded=false. 확인 후 QA 정리로 제거했다. 다시 만들 수 있는 시험 산출물이며 후속 load 권한/보존 artifact가 아니다.
- stdout/stderr 각0bytes, 각각 SHA256 **e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855**, EOF complete true / limitHit·timedOut false / memoryCleanupComplete true. 진단[]/sourceOpenFailure null. 원문 저장/출력0.
- DLL load/nativeFunctionsInvoked/osSourceObservations/actualAgentCalls/databaseWrites/serviceChanges 전부0.

```json
{"processStarted":true,"cleanupFailure":null,"serviceChanges":0,"externalDecisionAuthenticatedByTool":false,"osSourceObservations":0,"qaCreated":true,"actualAgentCalls":0,"elapsedMs":1038.671,"output":{"bytes":14336,"loaded":false,"sha256":"017C35C233D119B4F95A30D528003B6569AF58C7236FBC6AF536A0B14CD90A8A"},"commit":"d8134bb3079fcca07d7009c336eedb9ff54b4c1e","byteCapture":{"stderr":{"capturedBytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"timedOut":false,"complete":true,"memoryCleanupComplete":true,"stdout":{"capturedBytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"limitHit":false},"exitCode":0,"decisionId":"A3_CORE_REFERENCE_COMPILE_01","oneUseConsumed":true,"databaseWrites":0,"failure":null,"status":"PASS_LIBRARY_COMPILE_ONLY","byteDiagnostic":{"kind":"A3_COMPILE_DIAGNOSTIC_INPUT","inputExitCode":0,"complete":true,"diagnosticLimitHit":false,"stdout":{"capturedBytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"stderr":{"capturedBytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"diagnostics":[],"sourceOpenFailure":null,"executionAuthorized":false,"actualExecutionVerified":false},"runId":"a3-core-reference-compile-01","phase":"COMPILE","nativeFunctionsInvoked":0,"compiler":{"requestedExe":"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe","startUtc":"2026-10-18T04:31:08.2129541Z","exeObserved":true,"pid":54120,"exe":"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"},"dllLoaded":false,"qaRootAbsent":true}
```

## 정확 정리·소비 보존과 독립 후검사

- 신규 `D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa/{bin,temp}`만 생성/정리했다. runner qaRootAbsent true이며 별도 **04:31:57Z(13:31:57KST)** 읽기에서 QA root 부재·PID54120 부재·그 시작 이후 직접자식0을 확인했다.
- QA 밖 신규 **a3-core-reference-compile-01.consumed.json 1개**는 CreateNew 소비 시각 **2026-10-18T04:31:08.0985698Z**, consumed true/실행권위 false, hash **F08B9BBA5CAFCFC1337D5447FC93FA8C5C1056C57848490E6DFB0A497791E3BC**로 보존했다. owner 본인/nonlink·본인/SYSTEM 정확 Allow FullControl2032127을 독립 대조했다. 부모도 본인/protected true다.
- 이전 소비메타 **0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4**는 불변이다. 기존 보호11+이전 소비1의12hash 전부 독립 일치. 의도적으로 보존하는 새 소비1을 QA잔여0에 숨기지 않고, 기존 소비를 합하면 이번 계열의 메타2개가 남는다. 어느 것도 삭제·재사용하지 않는다.
- Node54212/exe `C:\Program Files\nodejs\node.exe`/start **2026-10-17T19:08:16.5819449Z**, relay26052/exe/start **2026-10-15T12:28:17.5262971Z**, 단일127.0.0.1:3830·Git/private/main 불변을 독립 확인했다.
- 이번 제거 대상은 재생성 가능한 시험 DLL/temp/빈 QA 폴더뿐이다. 원본/계정/Secret/인증서/DB/서비스/기존 ACL 변경0이다.

## 해석·미검증·다음 작업

같은 C#에 Core 참조를 보완한 실행에서 library compile이 성공했다. C#의 HashSet 사용과 공식 assembly 근거에 맞는 결과지만, 이전 CS0246 영수증에 없었던 정확 형식명을 복원한 것은 아니다. 원 [절대 source 실패](A3_ABSOLUTE_SOURCE_COMPILE_01_RESULT.md)와 그 이전 CS1504 실패를 소급 PASS하지 않는다.

M1(직접 coreflow hashtable의 policy/run 배열형식 공백)은 공개 이월이다. 실제 runner는 string 매개변수·외부 literal 결박 조건으로 실행했으며 임의 입력 검증이나 일반 권위 검증 완료로 보고하지 않는다. OS 동기 호출 전체 시간 상한, 메모리 완전 소거, 실제 관측/adaptor·grant host 통합·취소/경로교체/escape 음성·신뢰/baseline·UI04 허용소스 정상흐름·FN08/FN09 전체·served·사용자 인수는 미검증/미완료다.

다음은 기존 SourceReadNativeAdapter와 permit/host 계약을 읽기 대조해 최소 연결 후보를 Main이 선정한다. 실제 DLL load/native 호출·새 source QA는 별도 정확 범위/결정 전0이며 새 compile/소진창 재사용0이다. 정식0012 원 차단/원 질문 미답변·적용0과 Main 계획 완료 책임/PMO 업무배정대기0은 유지한다.
