# FN06 Ownership compile-only 실제 실행 결과 — 2026-10-27

## 판정

**FAIL_VERIFICATION / COMPILER_ATTEMPT_CONSUMED / COMPILE_RESULT_UNKNOWN.** 실제 compiler1회는 시작됐으나 실행이미지 관측과 종료코드/진단 수집이 실패했다. C# 컴파일 성공도 소스 결함도 확정하지 않는다. 출력DLL은 후속 조회에서 없었다. 실제OS/Agent/전체FN06/Stage/작업계획은 미완료다.

## 승인·정확 입력

직접응답 call_ed1ed8eac53848b68e70c595604a2fdc ‘위 범위 컴파일 1회 승인’. 원 승인창은05:02:17.000Z~05:32:17.000Z, native12/tool4/manifestD6DE65F1·library1회/compiler15초/진단16KiB/동일QA·DLLload/Agent/Job/PInvoke/키/DB/서비스0다. 원 source게시a8a1과최초결정9ED533B5는Git에보존했다.

첫 wrapper9e45c6은OUTER_RESULT_UNKNOWN/exit1이었다. QA/marker부재와같은actualprefix재현으로컴파일전timestamp해석실패/소비0근거를확보했다. 원stderr원문을회수하지못했으므로이실행의UNKNOWN은유지한다. -DateKind String 국소보완은 d24379 RED1→ac863a GREEN1·type구문0·독립C0/I0이며native12/args/한도/기한/권한은불변이다. source76a852225a72c51aff21c8c21ba1141785a3cca8/runner1414DF1742DAB290C4BC7797AE4021AFE41D3019123D83B1B89629A2CAC90B6C에기존미사용범위만비의미재결박한근거는 docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_RECONFIRMATION.md에있다. runtime결정SHA79EE60696619D0A61AC558EEC63F4B38E53D421391B29949421A085C9EDBCD4F이며기존시각/단발은연장하지않았다. 플랫폼은이근거를대조한1248d4 실행을허용했다.

## 실제 명령·반환

명령: node scripts/run-fn06-ownership-compile-only.ts --apply

1248d4: 8.257초/exit1. 아래는도구반환상태이며rawcompiler stdout/종료코드가아니다.

| 항목 | 실제 반환/관측 |
|---|---|
| status/failure | FAIL_COMPILE_ONLY / OWNERSHIP_COMPILE_ONLY_IDENTITY_UNKNOWN |
| oneUseConsumed / actualCompilerExecuted | true / true |
| compiler PID / startTicks | 45592 / 639286750602461192 |
| expectedExe | C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe |
| observedExe / exeObserved | null / false |
| PowerShell host PID / startTicks | 54068 / 639286750589768922 |
| exitCode / capture / output | null / null / null |
| finalization | readsSettled=true/processExited=true/canDisposeProcess=true |
| stop | stopRequested=false, stopIdentityChecked=false, IDENTITY_OR_CHILD_UNKNOWN |
| cleanupFailure / qaRootAbsent | OWNERSHIP_COMPILE_ONLY_CLEANUP_PRESERVED / false |
| wrapper memoryCleanupComplete | true라는보고·전체메모리소거보장아님 |
| 생성 DLL load / Agent / 생성 라이브러리 nativeFunctions / DB / service | false / 0 / 0 / 0 / 0 |

반환phase=PREFLIGHT였으나processStarted/actualCompilerExecuted=true가같이있다. 단계명만으로컴파일전실패/횟수미사용으로오인하지않는다. marker생성/프로세스시작증거가있으므로이1회는소진이다. 실제실행추가0·marker리셋0이다.

## 후속 읽기와 정확 QA 정리

1ff350 2026-10-27T05:19:28.4687575Z: 기록PID45592/54068둘다부재·정확QA참조csc/pwsh/node0. 전용QA는src의입력사본12+빈bin/temp+root만존재했고DLL은없었다. 사본모든raw지문은manifest와동일,owner SINSAN/cyhuh·nonlink였다. 원본소스가아닌이번새QA의사본이다.

소비marker는447bytes/SHA45C21C7DCD8177A4E3F316B271A223F235C108132E9980D839C0E6DA924D6C60/ownerSINSAN/cyhuh. 내용은원candidate·executionCommit76a85222·승인만료를결박한다. 읽기cmdlet의날짜재해석표시와marker rawbytes/hash는구별한다.

7a6d55는같은기록PID/QA관련process0·manifestD6/정확16항목·전체owner/link/절대prefix·각사본hash를fresh확인하고입력사본12와빈디렉터리4만개별정리했다. 2026-10-27T05:22:13.9848467Z rootfalse/소비marker보존. 79eb36별도조회도rootfalse·marker동일SHA다. 원본native12·부모ACL·소비기록·다른process/DB/서비스를삭제/종료하지않았다. 삭제를C#컴파일PASS로해석하지않는다.

## 원인·검수의 한계와 다음

확정한것은실제csc시작뒤이미지신원관측경계에서실패했고diag/exit수집에이르지못했다는점이다. 빠른종료와OS조회오류중어느것인지,실제C#오류유무는미확정이다. 이미지미관측을위조된정상값/요청경로로대체하거나기존PASS기준을낮추지않는다.

다음은원신원미확정의FAIL기준은유지하면서기록된본인프로세스의종료/유한진단을유실하지않게하는source국소보완을검토한다. 실제추가compiler/native/Agent실행은소진된이결정으로하지않는다. 새범위가필요하면정확source/hash/목적·한도/새자원/정리와필요행위를구체화해직접결정을받는다. FN16/PG지원안과독립계획작업은계속한다.

보존·복구는안전한sourcecheckpoint와소유변경후속revert이며기존DB/볼륨/키/서비스를초기화하지않는다. 소비marker는새실행권한이아니며자동삭제/재사용하지않는다.
