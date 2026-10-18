# A3 System.Core 참조 단일변수 후보 — 결정 지원

Main 어울 · 2026-10-18 · **실행 없는 준비 / 실제 compiler·QA·새 소비 파일 0**

## 원인 근거와 한계

1. 실제 exact7e413ede의 단1회 compile은 exit1/CS0246이다. 비밀 없는 영수증에 정확 형식명이 없으므로 HashSet을 그 missing type으로 확정하지 않는다. 원 결과·소비 이력은 [실제 결과](../04_test_reports/AV3/FN08/A3_ABSOLUTE_SOURCE_COMPILE_01_RESULT.md)에 보존한다.
2. 같은 고정 C#82행은 `HashSet<string>(StringComparer.OrdinalIgnoreCase)`를 사용한다. /noconfig·/nostdlib+와 명시 참조 mscorlib/System만인 실행안에는 System.Core가 없다.
3. [Microsoft API 문서](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1?view=netframework-4.8.1)와 [공식 .NET Framework 구현](https://github.com/microsoft/referencesource/blob/main/System.Core/System/Collections/Generic/HashSet.cs)은 이 형식을 System.Core에 연결한다. **누락 참조는 강한 가설**이며 이번 실행에서 오류가 사라지는지는 아직 검증하지 않았다.
4. 추가 assembly의 읽기 관측: `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll`, 1551104bytes, version `4.8.9363.0 built by: NET481REL1LAST_25H2_B`, SHA256 **8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D**, Archive·HardLink·Targetnull·TrustedInstaller. hash/metadata를 읽었을 뿐 load/reflection/실행하지 않았다.

## Main 권장안과 대안

- **A 권장:** C#·csc·기존 BCL·기준·flags/cwd/절대 source를 유지하고 고정 System.Core 참조1개만 추가한다. 중복 경로를 거절하는 보안 로직을 바꾸지 않으며 별도 설치/다운로드도 없다. library compile만 새 단1회로 확인하고 생성 DLL은 실행하지 않는다. 성공해도 actual source OS 관측·신뢰/baseline·Agent 완료가 아니다.
- **B:** 추가 참조 대신 C#의 중복 검사 자료구조를 변경한다. 코드의 대소문자 동등성·중복 거절을 재증명해야 하고 원인 대조에 source 변경 변수를 더하므로 이번에는 선택하지 않는다.
- **C:** 수정 없이 같은 실패를 반복하거나 컴파일러를 교체한다. 원인 근거가 늘지 않거나 더 많은 변수가 바뀌므로 선택하지 않는다.
- A는 새 assembly leaf 예외·새 정확 QA/메타 경로·새 실제 명령/게시 SHA/유한창의 결정이 필요하다. 원 소진 허가를 재사용하지 않는다. 미실행 전에는 되돌릴 부수효과가 없으며 이후 정리는 이번 QA만, 소비 이력은 보존한다.

## 순수 후보와 시험

- `scripts/source-read-core-reference-candidate.ts` SHA256 **40F93C610F201583D50978A4C083B83837AEC250A3802B75B9FD1F9D0D8F90B9**.
- `tests/unit/FN08/source-read-core-reference-candidate.test.ts` SHA256 **6C5BA0F61B3A741FC850C8B04866C14645F2D0E77EB637E54B7DAFFEC1786959**.
- 함수 부재 RED3/139.6534ms→새3+직접 소비한 기존4=7PASS/1006.7095ms, typecheck0/diff0. 최초 음성 test가 함수 부재 AssertionError를 거절로 세는 시험 결함1은 선행 존재 검사로 고쳤고 최초 음성 PASS를 유효 근거로 세지 않았다.
- 새 QA 환경의 `comparisonArgs`10개에 System.Core reference index8만 추가해 args11개로 비교한다. 새 QA·메타경로 때문에 역사적 실행 argv와 완전히 같다고 주장하지 않는다. 실제 두 번 A/B 실행을 제안하는 것도 아니다.
- candidateOnly=true, executionAuthorized/processStarted/osVerified/baselineConfirmed/callerFactsVerified=false. hash/path caller 입력·commandHash는 실제 OS/승인 증명이 아니다. Proxy/getter/추가필드/변조 hash/QA 겹침을 거절하고 객체·argv·환경은 freeze한다. 기존 runner/flow/builder/C#는 불변이다.

## 실제 수행 전에 필요한 정확 경계

새 candidate의 run은 `a3-core-reference-compile-01`이다. 제안 전용 QA는 **D:\Project\Anvil\.av3-data\a3-core-reference-compile-01-qa/{bin,temp}**, QA 밖 메타는 **a3-core-reference-compile-01.consumed.json 1개**다. 현재 만들지 않았다. Main/현재 사용자 소유·보호 부모 본인/SYSTEM ACL·nonlink·부재/배타성, 각 생성·수집 전 기한, CreateNew 소비 Write/Flush 후 재검사, actual PID/exe/start/읽기 종료 후 정확 개별 정리를 새 실행기·검수에 연결해야 한다.

소진 실행기의 명령을 이 후보로 사용하지 않는다. 새 실제 runner·독립 검토·clean/private exact SHA/hash·외부 결정/유한창과 플랫폼 심사를 갖추기 전 실행0이다. 유효창은 최대30분·compile capture15초/합16KiB·단1회/재시도0를 유지한다. OS 동기 호출 전체의 시간 상한이나 메모리 완전 소거를 주장하지 않는다. 기존 소비메타는 보존하며 새 후보/창 자동승계0, DLL load/native/실 source 관측·신뢰승격/Agent/DB/계정/Secret/인증서/ACL수리/서비스/Oracle/main 변경은 제외한다.

전체 계획은 미완료다. Main이 다음 실행 없는 준비와 독립 승인 기능을 선정해 이어가며 PMO에는 위 경계의 필요한 결정·지원만 요청한다.
