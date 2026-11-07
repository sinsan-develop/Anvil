# A3 절대 source library compile 단1회 결과

Main 어울 · 2026-10-18 · **FAIL / 컴파일 exit1 / OS 소스 관측·Agent 실행 아님**

## 판정과 실행 결박

- branch `codex/av3-stage-b`, 실행 exact **7e413ede652b83285d5eba283ea8546e40f78a29**. 실제 직전/직후 local/private 동일·tracked/untracked clean, main **f976ed5e29e14b13e12729d5b1ccf98f050f2210** 불변.
- PMO 04:00:50Z는 미사용 ff019 결박을 이 SHA로 대체했다. DecisionId `A3_ABSOLUTE_SOURCE_COMPILE_01`, run `a3-absolute-source-compile-01`, issued **2026-10-18T03:55:29Z**, expires **2026-10-18T04:25:29Z**, 연장0·단1회/재시도0.
- 실행기 SHA256 **CCB691F90423CB51B51097E2F0F7B3365FCF00BEB9042289CC39FB6D9C87DE8F**, flow **EE66AFFEBF755C7C12FDCD14C0D5CBFF75D6F5290604457E11A2F9DA778ADB32**. 기존 builder/진단기/C#·csc/BCL·옵션/작업폴더 불변. 실제 절대 source만 전달했고 복사하지 않았다.
- 정본 WORK_STATUS에 실제 자원·이유/소유/수명/정리를 먼저 등록하고 실행 source의 exact clean은 유지했다. 이 결과 기록은 실행 후 별도 문서 checkpoint다.

실제 명령(당시 실행 기록이며 **재실행 명령이 아님**):

```powershell
pwsh -NoProfile -NonInteractive -File scripts/run-source-read-absolute-compile.ps1 -Apply -Commit 7e413ede652b83285d5eba283ea8546e40f78a29 -ScriptHash CCB691F90423CB51B51097E2F0F7B3365FCF00BEB9042289CC39FB6D9C87DE8F -DecisionId A3_ABSOLUTE_SOURCE_COMPILE_01 -IssuedAt 2026-10-18T03:55:29Z -ExpiresAt 2026-10-18T04:25:29Z
```

## 실제 결과

- tool/child exit **1**, failure **A3_COMPILE_EXIT_NONZERO**, cleanupFailure **null**.
- 실제 csc PID **28620**, 시작 **2026-10-18T04:01:53.7743326Z**, 요청·실관측 exe 모두 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`. 실제 exe 관측 true. 기록 elapsed **1347.4671ms**는 실행기의 시작~수집/신원 대조 구간이며 순수 compiler CPU/실행 시간이라고 주장하지 않는다.
- stdout **180 bytes**, SHA256 **31b37143b21761b8f43aa2034e3ee375c7f0b5235b0e504169c1c810964d5d64**. stderr **0 bytes**, SHA256 **e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855**.
- EOF complete true / limitHit false / timedOut false / memoryCleanupComplete true. 상한은 capture15초·합16KiB이며 동기 OS 호출 전체의 시간 상한 증거는 아니다.
- 비밀 없는 진단은 **error CS0246 1종**, sourceOpenFailure **null**. 원문은 출력/파일로 보존하지 않았다. 이번 코드 분류에서 CS1504가 없다는 사실만 확인했으며, 이전 실패의 직접 원인 확정·물리 파일 동일성 전체 증명·source 관측 PASS로 승격하지 않는다.
- output **null**은 검증된 DLL 영수증이 없다는 뜻이지 DLL이 어떤 시점에도 없었다는 증명은 아니다. DLL load false / nativeFunctionsInvoked0 / osSourceObservations0 / actualAgentCalls0 / databaseWrites0 / serviceChanges0.

## 소비와 정확 정리·독립 후검사

- 신규 QA `D:\Project\Anvil\.av3-data\a3-absolute-source-compile-01-qa/{bin,temp}`는 실제 생성·정리됐다. runner qaRootAbsent true이며 별도 **04:02:36Z** 읽기에서 root 부재·PID28620 부재·해당 시작 이후 직접자식0 확인.
- QA 밖 **`D:\Project\Anvil\.av3-data\a3-absolute-source-compile-01.consumed.json` 한 개는 의도적으로 보존**한다. CreateNew·독점 Write/Flush, consumed true·executionAuthorizedByReceipt false, exact commit/runner/run/window를 담은 메타데이터다. 소비 시각 **2026-10-18T04:01:53.5735071Z**, SHA256 **0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4**. 원문/Secret/승인 발급 기능은 없고 QA잔여0에 숨기지 않는다. 이 파일/창을 삭제하거나 재사용하지 않는다.
- 별도 부모 ACL은 owner=본인, protected true, 본인/SYSTEM 정확 Allow FullControl2032127만 확인했고 기존 ACL 변경0이다. 소비파일은 owner 본인/nonlink 확인, 실제 생성 시 runner의 엄격 ACL 검사도 통과했다.
- 별도 읽기에서 보호11 hash 전부 고정값 일치. Node **54212**, exe `C:\Program Files\nodejs\node.exe`, startUTC **2026-10-17T19:08:16.5819449Z**, 단일 **127.0.0.1:3830**, relay **26052**, exe/start **2026-10-15T12:28:17.5262971Z** 불변.
- 첫 독립 후검사에서 PowerShell AST 경로 탐색 오류1로 보호 hash 목록이 빈 결과였다. 이를 전체보호 PASS로 세지 않고, 고정 실행기 literal11개만 읽는 별도 후검사를 수행해 11개 일치를 확인했다. compile 재실행·파일/권한 수리0.
- 읽기 조사 중 Windows rg의 shell glob 경로1건은 오류123이며 재컴파일/권한 변경을 하지 않았다.

## 근거 해석·남은 작업

이번 실행은 절대 source로 진단이 CS0246까지 도달한 **컴파일 실패**다. 어떤 type이 없는지는 비밀 없는 현재 영수증에 없으므로 실제 진단 원문/타입을 복원한 것처럼 말하지 않는다. 정적 C#에는 HashSet 사용과 고정 참조2개가 보이지만, 이를 이번 정확 missing type으로 확정하지 않는다. 다음 최소 원인 대조·수정 후보는 Main이 계획 범위에서 준비하되 새 source/reference/hash의 실제 compile은 이번 소진 창을 상속하지 않는다.

실제 OS source 관측/verifier·baseline/신뢰승격·UI04 허용 소스 정상 경로·FN08/FN09 전체·서비스 반영·사용자 인수는 미완료다. 기존 CS1504 실패와 정식0012 원 심사 거절/원 질문 미답변·적용0을 소급 변경하거나 우회하지 않는다. DLL/native/Agent/DB/계정/Secret/인증서/ACL수리/서비스/Oracle/main 변경0이다. Main이 승인 계획의 다음 미완료를 주도하며 PMO의 업무 배정을 기다리지 않는다.
