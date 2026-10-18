# A3 Core 참조 추가 library compile 실행안 — 준비본

> 후속 실제 결과: exactd8134bb3079fcca07d7009c336eedb9ff54b4c1e 단1회는 exit0/PASS_LIBRARY_COMPILE_ONLY였다. 시험 DLL/QA는 정리하고 소비 메타는 보존했다. [실제 결과](../04_test_reports/AV3/FN08/A3_CORE_REFERENCE_COMPILE_01_RESULT.md)를 따른다. 아래 창없음/actual0은 준비 당시 이력이며 재실행 허가가 아니다. M1은 공개 이월이고 native/관측·신뢰/baseline/전체 기능 PASS는 아니다.

Main 어울 · 2026-10-18 · **actual 실행창 없음 / 새 compiler·QA·소비 파일 생성0**

## 결정과 목적

PMO는 사용자 게시 turn01a14d37-8e48-7071-a13c-078a2c139971(04:14:50Z→04:25:45Z/10분55초, 최신5turn 새직접답변/중지/거절없음은 PMO 확인)의 별도 위임으로 게시 권장A만 선택했다. 이는 새 Core 고정leaf/참조1개·정확 새 QA/소비 경로와 검수 뒤 library1회 범위다. 실제 runner/게시 exact SHA·hash 안전 대조 뒤 **새 유한창**을 결박해야 한다. 이전 소비창을 재사용하거나 원 질문을 반복하지 않는다.

[원인·대안·순수 후보](A3_CORE_REFERENCE_COMPILE_PROPOSAL.md)의 강한 누락 참조 가설을 한 변수로 확인한다. C#·기존 compiler/BCL·옵션/cwd·절대 source는 보존한다. 과거 CS0246/CS1504 실패는 소급 PASS하지 않는다. 성공해도 DLL load/actual OS 관측·신뢰/baseline·Agent 준비가 아니다.

## 정확 준비 hash와 한정 검수

| 파일 | SHA256 |
|---|---|
| scripts/run-source-read-core-reference-compile.ps1 | 37A9B39B8B19B7F6CFBD6799C881EBE9B1839DBB78FEE6D7FA9C6C6359219E25 |
| scripts/source-read-core-reference-flow.ps1 | D6B66FFE63F1AB6BFC864E9214066915703781F054DBD704FD615180C3A9BFFF |
| tests/unit/FN08/core-reference-flow.test.ts | CE5977083B0AACFEF10BC1890BD5A4E87092AE55F7F159C3582B9DF71F015BCB |
| 기존 순수 Core 후보 | 40F93C610F201583D50978A4C083B83837AEC250A3802B75B9FD1F9D0D8F90B9 |
| 기존 bounded flow | EE66AFFEBF755C7C12FDCD14C0D5CBFF75D6F5290604457E11A2F9DA778ADB32 |

새 helper/runner 부재 RED3/1366.1738ms→새 policy/run 합성 binding·Plan·미결박 Apply **3PASS6611.9426ms**, typecheck0/PS2구문오류0/diff0. 유효 Apply는 수행하지 않았다. 원 bounded capture/ACL/정리 검사를 불변 코드로 소비했으며 그 시험을 불필요하게 반복하지 않았다.

독립 한정 정적 검토는 **C0/I0/M1**이다. M1은 직접 helper에 문자열 하나를 담은 배열 decisionId/runId를 주면 치환 전 문자열 타입을 확인하지 않는 형식 검사다. 실제 runner는 두 인자를 `[string]`으로 받고 외부 literal 결정은 Main이 별도 대조하므로 현재 실제 권한 우회로 확인되지 않았다. 이번에는 **미해결 Minor로 이월**하며 엄격한 임의 hashtable 타입 검증 완료라고 주장하지 않는다. 직접 호출을 외부 API로 노출하거나 권위 검증기로 재사용하지 않는다. 검토자 시험/실행 재수행0이다.

## 실제 명령 결박

아래는 아직 실행할 수 없는 양식이다. 새 결정의 literal fullSHA/issued/expires만 채우고 플랫폼 심사를 통과해야 한다. 현재 시각이나 caller boolean으로 창을 만들지 않는다.

```powershell
pwsh -NoProfile -NonInteractive -File scripts/run-source-read-core-reference-compile.ps1 -Apply -Commit <새_결정의_fullSHA> -ScriptHash 37A9B39B8B19B7F6CFBD6799C881EBE9B1839DBB78FEE6D7FA9C6C6359219E25 -DecisionId A3_CORE_REFERENCE_COMPILE_01 -IssuedAt <새_UTC> -ExpiresAt <새_UTC>
```

Main은 외부 policy/run·정확 SHA/hash·경로·시각·범위를 대조한다. 도구의 binding 형식 검사·metadata·commandHash는 외부 승인 인증이 아니다. local/private clean/mainf976 불변을 실제 직전/후 확인하며 새 SHA나 창으로 자동 승계하지 않는다.

## 이전 실행안 대비 변화와 실제 순서

- [이전 실행안](A3_ABSOLUTE_SOURCE_COMPILE_EXECUTION_PLAN.md)의 Git/source·고정compiler/BCL·본인/SYSTEM 보호 ACL·owner/nonlink·기한·CreateNew/Flush·실제 kernel PID/exe/start·유한 byte 수집/종료후 zero·불명보존/개별 정리 경계를 그대로 쓴다. 이전 runner/flow/C#는 수정하지 않았다.
- 새 고정 `System.Core.dll`만 hash **8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D**·1551104bytes·정확 version `4.8.9363.0 built by: NET481REL1LAST_25H2_B`·Archive/HardLink/Targetnull/TrustedInstaller 예외로 검사한다. 이 leaf 외 예외를 늘리지 않는다.
- 이전 QA 밖 `D:\Project\Anvil\.av3-data\a3-absolute-source-compile-01.consumed.json`은 hash **0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4**와 ACL 검사 대상으로 보호한다. 기존 보호11+이 기록1=12개 hash를 pre/post 확인한다. 삭제·변경·재사용하지 않는다.
- 새 QA는 **D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa/{bin,temp}**, QA 밖 소비 메타는 **a3-core-reference-compile-01.consumed.json 1개**다. Main/현재 Windows 사용자 소유·그 새 유한창만 사용, 생성 전 부재/배타성·보호 부모와 생성한 자식의 제한 ACL/nonlink/owner를 대조한다. 현재 생성0이다.
- 새 wrapper는 새 policy/run만 선택하고 기존 ≤30분·현재성/최소여유 검사를 재사용한다. consumes CreateNew/Write/Flush 뒤, 각 QA 생성·catalog 수집 전 기한을 다시 검사한다. 중간 만료도 소비 이력은 남기며 재시도0이다.
- 실제 args는 Plan과 같은 순수 argv 함수를 쓴다. /reference System.Core 한 개를 index8에 추가한11개다. 새 QA 환경의 counterfactual10개와 비교하는 것이며 역사적 argv 영수증이나 실제 A/B두회 제안이 아니다. 같은 cwd·UseShellExecute=false·child TMP/TEMP만 새QA, capture≤15초/합16KiB/단1회·재시도0 유지.
- 허용 OS reason catalog는 2/3/5/32/33/123의 UTF8/ANSI 메모리뿐이며 원문 byte를 파일/대화로 출력하지 않는다. 생성 DLL은 존재/길이/hash만 읽고 load하지 않는다.
- 실제 root PID/exe/start·직접자식/읽기 종료 후 QA의 전체hash/owner/nonlink·허용목록을 확인해 이번 파일·빈폴더만 개별 제거한다. 새 소비 메타1개는 별도 보존한다. 불명 exe/자식·미완료 읽기/예상외 산출은 광역kill/delete 없이 보존·보고한다. 별도 root/PID/자식/보호12/runtime/Git 후검사로 결과를 대조한다.

실제 Core/compiler·ACL 상속·프로세스/pipe 취소·정리/보호 불변·컴파일 성공·OS 호출 전체 상한은 아직 미검증이다. DLL/native/실 source 관측·신뢰승격/Agent/DB/계정/Secret/인증서/기존 ACL수리/서비스/Oracle/main 변경은 제외한다. 정식0012 차단을 우회하지 않는다. Main은 기능·준비의 증거를 구분하고 승인 계획을 계속 주도한다.
