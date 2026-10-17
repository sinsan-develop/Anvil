# A3 소스 열기 실패의 최소 진단 결정

Main 어울, 2026-10-18. **실제 측정은 미승인·미실행**. 기존 실패를 고치거나 반복 성공시키는 요청이 아니라 파일 역할/OS 이유의 관측 공백만 좁히는 결정이다.

## 사실과 읽기 대조

- 실제 compiler 후보9fd0d263의 최초1회는 CS1504/exit1/90.036ms·DLL0·정확 정리/독립 부재. 실패 보존 checkpoint c6b12b38b56e56d80f37fc7f4560a06399887506, `docs/04_test_reports/AV3/FN08/A3_NATIVE_COMPILE_02_RESULT.md`. 과거 창/실행은 재사용하지 않는다.
- Main의 현재 C# 입력 읽기:13435bytes/hash **3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC**, strict UTF8 유효/BOM없음/NUL0·FileInfo/비link/비reparse/현재 사용자 소유·ASCII 절대경로93자·Main runspace/.NET cwd 동일. **compiler의 당시 접근·해석 경로/잠김·문법 호환을 입증하지 않는다.**
- 성공한 기존 helper build는 절대 source·EXE·기본 참조/PowerShell 호출, 실패 A3는 상대 source·library·고정 참조/ProcessStartInfo다. 여러 조건이 달라 절대경로 변경을 원인 해결로 단정하거나 임의 적용하지 않는다.
- 실제 수집기는 StreamReader의 문자 변환 후 CS코드/행만 남겨 raw byte 수/hash·source 역할/OS 이유를 사후 복원할 수 없다. 현재 raw는 보존하지 않았다. 기존 FN06 normalizer는 다른 Host.cs/정책/hash에 고정되어 실행 binding과 source 표기를 그대로 재사용하지 않는다.

## 준비 후보 — 실행 권한 아님

- 승인계획 FN06/FN08 내부 QA준비로 `scripts/source-read-compile-diagnostics.ps1`의 **Get-A3CompileDiagnostic 순수 함수**와 `tests/unit/FN08/source-read-compile-diagnostics.test.ts`만 작성했다. 프로세스/파일/네트워크/환경/실 OS catalog를 읽지 않는다. 기존 제품 source·서버/SQL/Web·FN06 normalizer/실행기는 변경하지 않는다.
- 소유된 stdout/stderr bytes 합16KiB·진단32개, 입력 종료/완전성·정확1건 CS1504에서만 분류한다. 고정 source명 SourceReadObserver.cs와 caller의 expected 절대경로를 비교하며 slash만 맞추고 case/./../미지원 layout은 자동 정규화하지 않는다.
- 반환 fileRole: `SOURCE_LITERAL | SOURCE_ABSOLUTE | SOURCE_BASENAME_ELSEWHERE | OTHER_SOURCE | UNKNOWN`. osReason: `ACCESS_DENIED | SHARING_VIOLATION | NOT_FOUND | OTHER_OS_REASON | UNKNOWN`. 복수/불완전/상한/상충은 UNKNOWN, CS1504 없거나 exit0이면 이유를 발명하지 않는다. 반환은 코드/분류·capturedBytes/해시·한계 flags만, 경로·파일명·원문/문구·base64/실 catalog·stack0이다. `executionAuthorized:false/actualExecutionVerified:false` 고정이며 caller의 합성 입력을 실제 프로세스 증거로 인증하지 않는다.
- 함수는 제공된 catalog byte만 비교하고 실제 catalog를 만들지 않는다. 복사 bytes는 finally에서 비우고 caller 원본은 보존한다. 실제 수집 caller가 자기 raw/catalog를 finally에서 비워야 한다. **관리 문자열의 즉시 zero/완전한 메모리 소거는 보장하지 않는다.**
- 초기 함수 부재 exit1/범주 미도달과 실제 행동 RED8/기존6PASS를 구별한다. 분류 보완14+부모15PASS 뒤 stderr/충돌/상한/case 음성4 추가로 **18범주+부모19PASS/983.6219ms/FAIL0/SKIP0·type/diff0**. 합성 JSON/stdin을 받은 PowerShell 자식1개의 순수 함수 시험뿐이며 compiler·실 source 관측/OS catalog·파일 QA 자원·Agent0이다. 기존35/UI04 검사는 반복하지 않았다.
- 독립 읽기 원검수 C0/I1/M1: 중복 구분자·구간 끝점/끝공백의 모호한 경로 분류와 stderr 보존/hash 대칭 검사가 부족했다. Main은 새 음성6건 RED(부모 포함 fail7/pass18) 뒤 expected/추출경로에 같은 보수적 구간 검사를 적용하고 stderr도 독립 byte수/hash·원본 불변을 검사했다. 최초 보완의 Unicode 범위 IgnoreCase가 정상 ASCII까지 거절한 회귀1회(fail20/pass5)는 순수 문자열 대조로 원인을 확인하여 명시 ASCII case-sensitive 검사로 바로잡았다. 최종 직접 명령 `node --test --test-reporter=spec tests/unit/FN08/source-read-compile-diagnostics.test.ts`는 **24범주+부모25PASS/1129.5481ms·fail/skip0**, `npm run typecheck`·`git diff --check` exit0. 원검수와 Main 보완을 구분하며 새 독립 C0/I0로 승격하지 않는다.
- `SOURCE_BASENAME_ELSEWHERE`는 유효한 다른 **경로 문자열**의 분류일 뿐 실제 파일 객체·위치/동일성을 입증하지 않는다. 중복/빈 구간·./..·끝점/끝공백은 expected 입력이면 고정 오류, 추출값이면 UNKNOWN이며 정규화/파일 접근0이다.
- 최종 후보 SHA256: helper **5A4B808ABA9D5E63F7EDB31C7B16DADF9F3BFE0A83FF0BEB5DBA45C39555BD18**, test **3879174418A3E1C5628D6CA6BE1DF859A8C4EF80FD2D779E7F6AE57E4C8A4654**. actual 수집기/실제 OS catalog는 아직 실행하지 않았으며, 안전 commit/private clean·정확 binding과 새 필요결정 전 실제 측정0이다. 실제 collector EOF/상한/정리·실문구 일치/실패 원인·원문 메모리 완전 소거는 이 순수시험의 검수 범위 밖이다.

## 선택지

- **A 권장 — 같은 명령의 새 진단1회:** 고정 source/compiler/참조·명령/timeout은 그대로 두고 raw byte 수집과 순수 분류만 보강한다. 정보 추가가 목적이며 성공 보장/원인 수정은 아니다. 아래 한정 출력 계약과 actual 범위를 별도 승인받는다.
- **B 보류:** native 미검증/실제 연결 공백을 유지하고 다른 독립 승인 계획 기능을 Main이 계속한다. 새 compiler 위험/진단 진도는 없다.
- **C 비권장:** source를 절대경로로 바꾸거나 복사해 컴파일한다. 입력/경로 조건이 달라 원인 관측 없이 우회할 수 있으므로 이번에는 요청하지 않는다.

## A의 정확 actual 범위

1. 실제 수행 전 검수된 새 **local/private exact clean fullSHA**와 helper hash를 제출한다. C# source와 compiler/BCL은 아래 고정값 그대로다. 승인 전달 시 새 고정30분 창, 실제 compiler 최대15초·단1회/자동 재시도·연장0. 과거 실패를 소급하거나 관측 없이 다음 시도를 하지 않는다.
2. 새 Main/현재 사용자 소유 `D:\tmp\anvil-v3-stage-b\a3-source-open-diagnostic-01/{bin,temp}`, 산출 `bin/SourceReadObserver.dll`1개만. raw/진단/원문 파일0, compiler·source 복사0. root 부재/실경로·모든 부모/QA nonlink·owner·Git/source/compiler·보호10hash/N4receipt/Node54212·relay26052의 exe/start·단일127.0.0.1:3830·기한을 직전 대조한다.
3. 고정 compiler `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` version 숫자4/8/9221/0 **및** FileVersion `4.8.9221.0 built by: NET481REL1LAST_25H2`, hash **46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00**. 같은폴더 mscorlib **11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C**, System **2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71**. 3leaf FileInfo/Archive/HardLink/Target null/비reparse/TrustedInstaller owner 전부 동시일치만 허용하고 **그외 OS leaf·부모/source/QA link 예외0**이다.
4. `/nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<고정 mscorlib> /reference:<고정 System> /out:<새 등록 DLL> apps/connector/native/SourceReadObserver.cs`만, child cwd는 현재 승인 source 기준, UseShellExecute=false/CreateNoWindow=true·child TMP/TEMP만 등록 temp. `/utf8output`·source 절대경로 치환·참조/timeout 변경0이다.
5. stdout/stderr는 **BaseStream byte 수집 합16KiB**·owned PID/exe/start/직접child를 검사한다. 초과/미종료는 정확 owned process만 기존 조건으로 회수하며 불명은 보존 보고한다. 표준 OS 이유 catalog는 **현재 부모 process 메모리에서만** Win32Exception 코드2/3/5/32/33/123의 문구를 UTF8/현재 ANSI bytes로 만들고 함수에 준다. catalog의 실제 문구/byte/base64·임의 source 경로·오류 원문·stack·raw capture 파일은0이다. 이 제한된 OS 표준문구 읽기는 이번 **새 필요결정**에 명시된 범위이며 과거 승인을 상속하지 않는다.
6. 새 고정 hash의 위 순수 PS 함수를 같은 부모에서만 소비한다. Node·다른 helper/native 실행0. 실제 receipt는 compiler 독립 PID/exit/time과 별도로 input-only 분류·stdout/stderr capturedBytes/hash·EOF/상한/진단코드·허용 role/reason enum만 기록한다. source 경로 원문/해시·OS 문구는 외부 반환하지 않는다. UNKNOWN/분류불가·bytes 잘림이면 원인 미확정 유지·추가 raw 저장/재시도0이다.
7. 정상/실패 모두 정확 compiler/직접child·QA 사용process0→root/owner/nonlink/정확 파일목록/hash 확인→이번 DLL·임시파일/빈폴더만 정리→별도 root 부재·보호/runtime 불변을 확인한다. 예상 밖/미종료/신원 불명은 광역 kill/delete 없이 보존·보고한다. caller의 소유 raw/catalog byte buffers는 finally clear, 임시 관리문자열 소거 한계는 유지한다.
8. DLL load/실행/reflection/Add-Type/PInvoke·실 source OS 관측·링크 fixture·키/DPAPI·계정/권한/Secret·실 token/등록/정책·DB/서비스·Agent/외부 비용·Oracle/main 변경0. compile 성공도 관측/ABI/flag/Agent/제품 완료가 아니다. 실제 source 열기/읽기 원인이 나와도 해당 수리는 자동 허용하지 않는다.

필요한 정확 결정은 **검수/clean exact binding 뒤 A의 새 byte 진단·표준 OS 문구 메모리 대조를 포함한 library compiler1회**다. Main이 업무/순서를 소유하고 PMO에는 이 필요한 경계 판단만 요청한다.

## 2026-10-18 A 단1회 종료 — 이 계약 재사용 금지

- PMO의 새exact38157ad4·21:06:55Z~21:36:55Z 결정으로21:09:21.2444013Z csc73148을 실제1회 실행,126.7833ms/exit1·CS1504 error1·stdout153bytes/완전EOF/상한미도달·stderr0이었다. 역할 SOURCE_BASENAME_ELSEWHERE/이유UNKNOWN은다른유효경로문자열+같은basename 분류이지실제다른파일·직접원인확정이아니다. output receipt:null/무load·정확QA정리·별도21:10:34Z보호11/Node·relay/단일3830/Git·source/helper불변을확인했다. 새승인도소진·잔여창재시도0이다.
- 정확 원JSON/조건/한계/표현 정정은 docs/04_test_reports/AV3/FN08/A3_SOURCE_OPEN_BYTE_DIAGNOSTIC_01_RESULT.md다. 이 관측으로 ACL/복사/환경 수리나 source 인자 변경을 승인하지 않는다. 필요시 절대 source만 바꾸는 별도 단일 변수 계약을 Main이 제안하며 새 결정 전 실행하지 않는다.
