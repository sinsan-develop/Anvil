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

## 2026-10-18 후속 절대 source 후보 — 실제 실행 미승인·미실행

Main이 UI04의 허용 소스 범위 원본 연결을 대조한 결과, A3 §5의 기존 CONNECTOR_REPORTED/OS UNVERIFIED snapshot을 신뢰 관측·확정 baseline으로 대체할 수 없다. 없는 ref를 합성하거나 빈 scope 확정 기준을 완화하지 않는다. 기존 native 실패의 선행을 좁히기 위해 Main이 선택한 후속이다. PMO 02:48:15Z 회신은 다음 **순수 후보 준비만** 기존 승인 계획 범위로 확인했으며 실제 compiler 시작 권한을 만들지 않았다.

- `scripts/source-read-absolute-compile.ts` SHA256 `081977C0E2B0C5744F8CE383216CAC24441EC41FA12EC7A9C7739E9BCB4A424D`: 파일/OS/프로세스 접근 없는 builder. 전달된 path/hash는 호출자 주장일 뿐 현재 파일 신원 증명이 아니다. 깊은 freeze와 commandHash도 승인·실행 token이 아니다.
- 직접 시험 `tests/unit/FN08/source-read-absolute-compile.test.ts` SHA256 `C338AD49E654F648FCDDA6073E441EF075F1BF215800DAB000ECFC45BE87B4D5`: 부재 RED2→초기3 PASS 후 독립 I1(reflection 전 Proxy trap 실행)을 정상/revoked Proxy 음성 RED1(Missing expected exception)로 재현했다. `types.isProxy`를 모든 reflection 앞에서 거절하도록 최소 보완 후 정확 argv/단일 변경·고정 hash/별칭·범위확대/getter·Proxy trap0 거절, 기존 진단기 합성 byte 소비까지 **4 PASS/943.5871ms**, typecheck/diff exit0. 독립 scoped 재검토 원 I1 해소·새 C0/I0이며 검토자가 시험을 재실행한 것은 아니다. 합성 PowerShell 함수 호출만 있었고 compiler/실OS catalog/native0이다.
- 생성된 두 명령은 **동일 새 QA 경로/환경을 사용한 후보 대비**다. `previousArgs`는 과거 실행의 원 argv 영수증이 아니다. 10개 인자 중 index9만 상대 `apps/connector/native/SourceReadObserver.cs`에서 같은 검증 source의 절대 인자로 바뀐다. 고정 compiler/BCL·library 옵션·cwd·child TMP/TEMP·15초/합16KiB·1회/재시도0은 동일하다. 새 QA output/temp 경로가 역사적 실행 경로와 다르다는 점을 숨기지 않는다.
- 반환 `candidateOnly:true`, `executionAuthorized/processStarted/osVerified/baselineConfirmed/callerFactsVerified:false`. 실제 실행 함수나 승인 수집/파일 생성은 없다. 잘못된 source/compiler/BCL hash·별칭/UNC/장치/상위경로·QA 겹침·추가 인자/기한 변경 입력을 고정 오류로 거절한다. 이 구문 검사를 실제 realpath/link/owner/잠김 검증으로 승격하지 않는다.

### 별도 actual 결정이 필요한 정확 범위

1. 검수된 새 local/private exact clean fullSHA·builder/진단기 hash·기존 C# hash를 결박하고, 새 policy/run ID·유한 실행창을 새로 정한다. 앞선 어떤 창/실행권한도 재사용하지 않는다. 실제 승인 출처는 외부 지시와 대조하며 caller의 boolean/env/commandHash로 승인하지 않는다.
2. 후보 QA 이름은 `D:\tmp\anvil-v3-stage-b\a3-absolute-source-compile-01/{bin,temp}`, 산출 `bin/SourceReadObserver.dll` 한 개다. 아직 생성하지 않았다. 실제 승인 후 생성 직전 commentary/WORK_STATUS에 소유·수명·정리를 등록하고 root 부재·부모/모든 경로 strict nonlink/owner, source의 실제 경로·bytes/hash와 fixed compiler/BCL 신원/version/hash·보호11/runtime을 재검증한다. source/compiler 복사나 ACL/환경 수리는 하지 않는다.
3. 기존 source `3D10E396…3FFFBC`·compiler/BCL hash와 version·TrustedInstaller 고정3leaf 예외/그 외 reparse 예외0은 위 원계약과 동일하다. `/nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<고정 mscorlib> /reference:<고정 System> /out:<새 DLL> <동일 검증 source 절대 인자>`만 사용한다. UseShellExecute=false/CreateNoWindow=true, 같은 cwd, child TMP/TEMP 외 환경 추가·`/utf8output`·참조/옵션/timeout 변경0이다.
4. 실제 허용1회는 시작 전 배타 실행 영수증으로 소비를 보존해야 한다. 이 순수 builder만으로 1회 소비·현재성·OS/process 소유를 집행했다고 하지 않는다. 기존 BaseStream 합16KiB·EOF/상한·owned compiler PID/exe/start/직접child·기존 고정 진단기로 비밀 없는 code/role/reason·bytes/hash만 남긴다. 기존 메모리 표준 OS catalog 범위는 실제 새 결정에 다시 명시해야 하며 추가 raw/capture 파일·원문/실제 경로 반사0이다.
5. 성공/실패 모두 exact owned compiler/child·QA process0→root/owner/nonlink/정확 파일목록/hash→이번 DLL·임시파일/빈폴더만 정리→별도 root 부재·보호/runtime 불변 확인이다. 불명 신원·미종료·예상밖 산출은 광역 kill/delete 없이 보존 보고한다. 기존 실패를 소급 PASS로 바꾸지 않는다.
6. DLL load/실행/reflection/Add-Type/PInvoke·실 source 관측/verifier·SourceScope 신뢰승격·baseline 확정·Agent/DB/Secret/계정/권한/인증서·서비스·Oracle/main 변경은 포함하지 않는다. compile 성공도 소스 관측·원인 전체 확정이나 제품 완료가 아니다. 실패·UNKNOWN·시간/출력 상한이면 다음 시도를 자동 시작하지 않는다.

현재 요청은 위 exact 후보의 한정 검토와 **게시 commit 확정 뒤 새 library compiler 단1회에 필요한 별도 결정**이다. 실제 실행 명령과 preflight/배타 소비·정리의 실행 안전 대조 전 시작하지 않는다. Main은 이 경계와 별개인 승인 기능 구현을 계속한다.
