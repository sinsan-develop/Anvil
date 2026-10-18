# A3 절대 source library compile 실행안 — 준비본

Main 어울 · 2026-10-18. **실제 실행창 없음 / compiler·catalog·QA·소비 파일 생성 0.** 실행안 검수는 실행 승인이 아니다. 원 후보 `01a82a1e0b7e8f47635d0a530fc40f0867cdb1de`와 그 이후 UI03 게시의 권한을 자동 상속하지 않는다.

## 1. 목적과 현재 결정

UI04의 실소스 허용 범위는 신뢰 관측·기준선 원본을 필요로 한다. 과거 CS1504의 원인을 확정하지 않은 상태에서, 같은 검증 C#에 대해 상대 source 대신 절대 source 인자만 쓰는 library compile 한 번의 실행안을 준비한다. 성공해도 DLL load/OS source 관측·신뢰승격·baseline·실제 Agent 준비가 아니다.

PMO `A3_ABSOLUTE_SOURCE_COMPILE_01`은 원 질문의 권장 A만 선택했고, 실제 실행안/게시 fullSHA·hash의 안전 대조 후 **새 유한창을 별도 결박**하라고 했다. 후속 보호경로 예외는 사용자 질문 turn01a14d16-b71a-72f2-aca0-117d3c0fccc9의 게시 권장 A에 대한 별도 위임 결정으로 전달됐다(03:38:55Z→03:49:46Z, 최신4turn 직접답변/중지/거절 없음은 PMO 확인). 정확 신규 QA와 QA 밖 소비 메타1개만 아래처럼 반영했다. 원 질문은 결정 완료이며 위임 재사용·중복 질문은 하지 않는다. **경로 예외는 실제 실행창이 아니다. 현재 창은 없다.**

## 2. 실행기와 정확 준비 증거

| 파일 | SHA256 / 상태 |
|---|---|
| scripts/run-source-read-absolute-compile.ps1 | CCB691F90423CB51B51097E2F0F7B3365FCF00BEB9042289CC39FB6D9C87DE8F · 준비/한정 정적 검수 |
| scripts/source-read-absolute-flow.ps1 | EE66AFFEBF755C7C12FDCD14C0D5CBFF75D6F5290604457E11A2F9DA778ADB32 |
| tests/unit/FN08/absolute-compile-flow.test.ts | 6D581F5E6727AD3FAEEBFDCE7FE0350C60F320C16CF905EB410BE03BBA85C90F |
| 기존 scripts/source-read-absolute-compile.ts | 081977C0E2B0C5744F8CE383216CAC24441EC41FA12EC7A9C7739E9BCB4A424D · 기존 순수 후보 불변 |
| 기존 scripts/source-read-compile-diagnostics.ps1 | 5A4B808ABA9D5E63F7EDB31C7B16DADF9F3BFE0A83FF0BEB5DBA45C39555BD18 · 불변 |
| 기존 apps/connector/native/SourceReadObserver.cs | 3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC · 불변 |

기존 strict csc/BCL3 hash·version·TrustedInstaller 고정3leaf 예외와 그 외 link 예외0은 원 결정문 그대로다. 실행기의 게시 fullSHA는 검수 후 실제 Git/private 결과로 결박하며 문서 자체의 hash나 caller boolean으로 승인하지 않는다.

합성 준비 증거는 함수 부재 RED2, runner 부재 RED1, ACL/늦은 취소 RED2, 소비 후 만료 RED1, 레이아웃 Plan RED1, 빠른 종료 exe 미관측 RED1 및 새 보호경로 RED1 → 최신 **7 PASS/27464.8203ms**, typecheck0/PS2 구문오류0/diff0다. 기존 JSON 전달이 ISO 문자열을 DateTime으로 바꾼 시험 오류1은 실제 타입을 확인한 뒤 전달부 `-DateKind String`만 고쳤다. 실제 binding의 문자열·만료 기준은 완화하지 않았다. PowerShell의 괄호 없는 문자열 결합/배열이 단일 문자열·잘못된 경로 목록을 만든 사실도 합성으로 확인해 실제 생성·검사·정리가 같은 `Get-A3ExecutionLayout`을 소비하도록 보완했다. 종료한 compiler도 실제 exe 관측이 없으면 정리 소유권으로 인정하지 않는다.

## 3. 외부 결정과 실제 명령 경계

실제 실행 전 Main은 PMO 원 메시지의 policy/run, exact 게시 commit·아래 script hash, 신규 QA/소비 파일 대상, issued/expires와 허용 범위를 직접 대조하고 플랫폼 안전 심사를 받는다. 실행기는 이 외부 메시지를 인증하지 않는다. `Read-A3AbsoluteBinding`은 입력 형식·최대30분/현재성·작업 여유만 검사하며 `executionAuthorized:false`를 유지한다.

실행창이 정해지기 전 다음은 **실행 불가능한 명령 양식**이다. 꺾쇠 부분은 새 결정의 literal 값으로만 대체하며 현재 시각으로 임의 채우지 않는다.

```powershell
pwsh -NoProfile -NonInteractive -File scripts/run-source-read-absolute-compile.ps1 -Apply -Commit <새_결정의_fullSHA> -ScriptHash CCB691F90423CB51B51097E2F0F7B3365FCF00BEB9042289CC39FB6D9C87DE8F -DecisionId A3_ABSOLUTE_SOURCE_COMPILE_01 -IssuedAt <새_결정의_UTC> -ExpiresAt <새_결정의_UTC>
```

`-Plan`은 조기 반환하고 실제 compiler/OS catalog/소비/QA/권한 변경을 하지 않는다. 미결박 `-Apply`는 `FAIL_BEFORE_MUTATION`으로 닫힌다. 두 경로만 실제 시험했으며 유효 Apply는 실행하지 않았다.

## 4. ACL 실제 관측과 정확 신규 경로 예외

- 기존 `D:\tmp\anvil-v3-stage-b`는 상속 ACL이며 여러 다른 주체에 쓰기·삭제 허용이 있다. owner 일치는 격리 증명이 아니다. 이 경로는 이번 실행 대상에서 제외한다. 기존 ACL을 고치거나 검사를 생략하지 않는다.
- 기존 `D:\Project\Anvil\.av3-data`는 owner=현재 사용자·보호 ACL·본인/SYSTEM FullControl만인 것을 읽기 관측했다. 후속 예외의 정확 대상 **신규 `D:\Project\Anvil\.av3-data\a3-absolute-source-compile-01-qa/{bin,temp}`만** runner와 Plan에 반영했다. 원 pure builder는 역사적 후보로 불변이며 이번 실제 명령을 발급하는 도구로 사용하지 않는다. 실제 생성 전 새 부모/자식 owner·제한 ACL/nonlink·배타성을 다시 확인하고 정확 정리해야 한다. 새 후보·검수·hash/게시 fullSHA 및 유한창 결박 전 생성하지 않는다.
- 소비 메타데이터 제안은 QA 밖 **신규 `.av3-data/a3-absolute-source-compile-01.consumed.json` 한 개**다. `CreateNew`/독점 handle로 쓰기 전에 소비하고, 실패·시작 불가도 소비 상태를 보존한다. 승인/Secret·원문은 넣지 않고 policy/run/commit/hash/시각만 저장한다. 부모/파일의 실제 제한 ACL·owner/link를 검증하며 기존 계정/ACL/키를 변경하지 않는다. 기존 파일을 덮거나 자동 삭제하지 않는다. 이것은 QA 잔여0에 숨길 파일이 아니라 의도적으로 보존할 재실행 방지 이력이다. 아직 생성하지 않았다.

## 5. 실제 한 번의 순서

1. 새 정확 결정·기한 → 파생 sourceRoot와 Git toplevel 동일/기존 branch·exact HEAD·tracked/untracked clean·private 동일/main 불변 → script/flow/builder/진단기/C# hash와 source owner·strict link → fixed csc/BCL 신원·version/hash/정확 예외를 대조한다.
2. 보호11 파일 hash·기존 Node54212/relay26052의 exe/start·단일127.0.0.1:3830을 확인한다. QA/소비 파일 부재와 보호 부모의 실제 ACL을 대조한다. 새 승인/경로가 없거나 넓은 권한이면 mutation 전에 닫힌다.
3. deadline 검사 → CreateNew 소비 기록 Write/Flush(true) → deadline 재검사 → QA 생성(각 디렉터리 전 deadline/생성 후 ACL) → deadline 재검사 → 허용 Win32Exception2/3/5/32/33/123 메모리 UTF8/ANSI catalog(각 항목 전 deadline) 순서다. 중간 만료면 다음 단계로 가지 않고 소비 이력은 보존한다.
4. compiler literal args는 `/nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<fixed mscorlib> /reference:<fixed System> /out:<등록 bin DLL> <같은 검증 source 절대경로>` 10개다. 같은 cwd·UseShellExecute=false/CreateNoWindow=true·child TMP/TEMP만 등록 경로, 최대15초·합16KiB·단1회/재시도0이다. source/compiler 복사·참조/옵션/시간 변경0이다. 새 packet의 상대/절대 대비는 같은 새 QA 환경에서 source만 다르며 역사적 원 argv 영수증이 아니다.
5. kernel Process handle에 묶인 PID/start·실제 module exe를 관측한다. 너무 빠른 종료로 exe 관측이 없으면 요청 exe와 구분해 실패로 남긴다. stdout/stderr는 BaseStream bytes로 수집하고 원문/경로/capture 파일 대신 count/hash/EOF/상한·code/role/reason만 남긴다. DLL은 존재·길이/hash만 읽으며 load하지 않는다.
6. timeout/상한에서는 동일 handle/PID/exe/start로 확인한 본인 root만 종료한다. 다른 PID·자식은 자동 kill하지 않으며 자식/신원 불명은 보존·보고한다. 읽기 종료 전 공유 buffer를 zero하지 않는다. 미완료 읽기는 private cleanup lease로 유지하고 source 종료/pipe dispose/유한 대기 후 모든 task 종료를 확인해 마지막 zero를 한다. 늦거나 불명인 읽기는 `memoryCleanupComplete:false`/cleanup 미확인으로 남기며 완전 소거를 주장하지 않는다. 관리 문자열·OS의 메모리 완전 소거를 보장하지 않는다.
7. 본인 compiler 종료·직접자식/QA 사용process0 → QA owner/link·허용 DLL/temp의 전체 hash·목록 → 이번 파일/빈폴더만 개별 정리 → root 부재·보호/runtime·Git/private 동일을 대조한다. unknown은 광역 kill/delete 없이 보존한다. 소비 파일은 남긴다. 별도 명령으로 root/PID/자식/보호/runtime을 재확인한 뒤 실제 결과·실패·미확인과 소비 이력을 WORK_STATUS에 기록한다.

## 6. 현재 한계·제외

초기 독립 검토 C0/I3의 제한 ACL, 만료 후 부수효과, 늦은 ReadAsync 재기록과 후속 I1 빠른 종료 exe 미관측 정리 우회를 RED→GREEN으로 보완했다. 마지막 identity·새 경로·기존3지적의 한정 정적 재검토는 C0/I0/신규M0이며 검토자 시험 재실행0이다. 이는 actual 안전 실행 판정이 아니다. 합성 MemoryStream/PowerShell 관리 Stream·단계 callback은 실제 Windows pipe·ACL 생성·프로세스 시작/빠른 종료/강제 종료·동시 PID 재사용·OS 취소·실제 정리 증거가 아니다. 동기 OS 호출 자체가 무응답일 때의 전체 실행 시간 상한도 확인하지 못했다. compiler capture 15초와 모든 OS 호출의 전체 상한을 혼동하지 않는다.

DLL load/실행/reflection/Add-Type/PInvoke, 실제 source OS 관측/verifier, 신뢰승격/baseline, Agent·DB·실제 계정/정책·Secret/인증서·서비스·Oracle/main 변경, 기존 ACL 수리, 기존 실패 소급 PASS는 제외한다. 정식0012의 원 안전 거절·원 직접 질문 미답변·적용0은 별도 보존하며 우회하지 않는다.
