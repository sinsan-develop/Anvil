# FN06 native 준비 관리형 fake 검증 실행 결정 후보

- 작성일: 2026-11-02 / 작성: 독립 Reviewer 어울 / 실행 소유자 후보: Project Main 어울.
- 상태: EXECUTION_CANDIDATE / NOT_APPROVED / 실행 승인 아님. 현재 compiler 0·RunAll 0·임시 자원 생성 0.
- 현재 제품 C# 14개와 시험 C# 4개, 고정 entry 1개, 총 19개 입력의 컴파일 1회와 관리형 fake 시험 실행 1회를 제안한다. 아직 이 19개를 컴파일하지 않았으며 구문·참조·런타임 성공을 주장하지 않는다.
- 원 후보 FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md SHA256 5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085 98행 및 승인 FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md SHA256 9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567 15행은 실제 compiler/native 실행을 제외한다. 따라서 아래 정확 실행을 포함하는 별도 직접 실행 결정이 먼저 필요하다. 과거 signer의 1회 컴파일 허가는 재사용하지 않는다.
- 기존 source 구현·후속 source 개발은 본 실행 결정의 대기가 아니다. 제품·기존 시험·WORK_STATUS·계획은 수정하지 않는다.

## 1. 호출선과 제외

고정 entry는 아래 네 RunAll만 호출한다. Bridge는 명시 fake owner·시계, Basis는 Resources/MemoryStream, Peer는 모든 OS·파일·프로세스 메서드를 대체한 Kernel, Host는 명시 resource/kernel/owner/clock·보류 stream·timer를 사용한다. 기본 WindowsNativeOwnerKernel/CreateEmptyJobSource/OwnAssemblyResources는 선택하지 않는다.

일반 CLR 시작·메모리 SHA·정규식·경로 문자열·Stopwatch·Task.Delay/스레드 스케줄링·표준 진단 출력은 이번 관리형 실행에 포함된다. 이를 OS syscall 0이나 실제 키·OS 보호 검증이라고 부르지 않는다. 부분 클래스 폐쇄 때문에 P/Invoke·프로세스 함수 선언이 함께 컴파일되지만 시험 호출선에서 실행하지 않는다.

실제 Job/PInvoke/제품 프로세스 생성·회수/HostMain/Worker/키·CNG/실파일 fixture/DB·권한·서비스·Agent·실자료·P03R3는 0이다. 검증용 exe 프로세스 1회만 별도 결정 대상이다. QA OwnershipHost.cs/OwnershipEvidenceWorker.cs/PreparationInput은 입력에 넣지 않는다. Reflection/Assembly.Load/자동 시험 검색/외부 테스트 러너/분석기/서명/쉘/helper 프로토콜 연결은 0이다.

## 2. 입력 18개 실제 지문

2026-11-02 현재 읽기 검산값이다. source checkout은 Main이 별도 관리하며 내부 위치를 외부 보고에 싣지 않는다. 승인 후 전용 root의 src/<아래 basename>으로 바이트 그대로 복사한다. basename은 모두 유일하다. 복사 전 원본과 복사 후 bytes/SHA가 아래와 같아야 하며 변경 시 새 기준 자동 채택·재시도 0이다.

| 번호 | 저장소 상대경로 | bytes | SHA256 |
|---|---|---:|---|
| 1 | apps/connector/native/OwnershipEvidenceJobFactorySource.cs | 8387 | 960B59F6D96096FBFD7B61219A40FEB3F53D263CAE05010633BFB9BDB28DF70E |
| 2 | apps/connector/native/OwnershipEvidenceJobAssignmentSource.cs | 8819 | A9AAC6D4003ACC20D5CF3DFAE321536673FB3079AE922B2AD0108657504B1156 |
| 3 | apps/connector/native/OwnershipEvidenceProcessStartupSource.cs | 11812 | E4D89DF08A972F4B92C1E3E991D193FBD9F8CD5C3731759492F1DCAEC2C7A58C |
| 4 | apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs | 14659 | E93D5185DB75C9EB68F97BE2C7E1B071248552DC2DC17C50AF255362EF81BFD0 |
| 5 | apps/connector/native/OwnershipEvidenceWorkerInputSource.cs | 5458 | 18B728E200628C154FEFB7E1E37932710B897A8763A48BEFBCE7DD4617D358F7 |
| 6 | apps/connector/native/OwnershipEvidencePreparedFactsSource.cs | 3883 | E694C6E176726CACD52DECF78A90975224DE540C8878232E206BDE0893B226DA |
| 7 | apps/connector/native/OwnershipEvidenceImageOwnerSource.cs | 7895 | 87F027C30FA2C62E17567D3C7B5801CF1D390E88C38149CB7A2F4503087541EE |
| 8 | apps/connector/native/OwnershipEvidenceImageBindingSource.cs | 5750 | 542F3ED8E6F30B736FDE3662BF2501CDB93E4DFBDE832701C70B5204458F9802 |
| 9 | apps/connector/native/OwnershipEvidenceRootSource.cs | 12994 | C1213018DAE0C37D3D468A55D9DA74AE1E707F5499B645DEE3C190AF7CE9E4AF |
| 10 | apps/connector/native/OwnershipEvidenceHost.cs | 35353 | C21CC141EE808A43AC6861FF99769393FEF226EEF1DA7685BA84BEEDD8E5C490 |
| 11 | apps/connector/native/NativePreparationOwnerBridgeSource.cs | 11236 | CAE4B38EF9A618FBFC49270F9B11CBA659C32411CBCF7F29D230C1EAD8D853F3 |
| 12 | apps/connector/native/NativePreparationOwnerParentBasisSource.cs | 3700 | A3E065F7DE77007E253A35D2EDE6A9332CD20A5F42D9BF02DC9A904D8BD278C3 |
| 13 | apps/connector/native/NativePreparationOwnerPeerSource.cs | 16351 | A41E6DC7E1AE22F665E24D611B2A8DC229B14D877118E09A8885238799987F6F |
| 14 | apps/connector/native/NativePreparationOwnerHostSource.cs | 7715 | 14E876AC3D83F3D1A1FC59D6CFF193BB1BD6494708AE6CDFFC2FE006C36C55F1 |
| 15 | tests/native/FN06/NativePreparationOwnerBridgeSourceTests.cs | 9808 | 06BCFFE029E5AB6D3160DCB60B63436F6231960649E9E0E55D412E52C6F1515D |
| 16 | tests/native/FN06/NativePreparationOwnerParentBasisSourceTests.cs | 2610 | 850017ADC575D73E8403B3EB7A03465C81F7C83651BBD6E29FF13731CB7F1A97 |
| 17 | tests/native/FN06/NativePreparationOwnerPeerSourceTests.cs | 4193 | A7375B7BC368F4FD3CD3DB800E586FFCADC2B9B728C0FEE1347561D49642609D |
| 18 | tests/native/FN06/NativePreparationOwnerHostSourceTests.cs | 15407 | 152D70CD8A0C3F389CEDE85B1788D2C0CC046FE4E95445BE467C94461B29C5AD |

## 3. 신규 고정 entry 19번

UTF-8 BOM 없음·LF·마지막 LF 1개. 지금 별도 entry 파일은 생성하지 않는다. 승인 후 src/NativePreparationManagedFakeValidationEntry.cs 한 곳에만 생성하고 아래 SHA를 재검산한다. 인자 없이 네 RunAll을 순서대로 호출하고 Host Task를 완전히 기다린다. 첫 실패에서 중단하고 예외 원문/stack/환경값은 출력하지 않는다.

~~~csharp
internal static class NativePreparationManagedFakeValidationEntry
{
    private static int Main(string[] args)
    {
        if (args.Length != 0) return 2;
        try
        {
            NativePreparationOwnerBridgeSourceTests.RunAll();
            NativePreparationOwnerParentBasisSourceTests.RunAll();
            NativePreparationOwnerPeerSourceTests.RunAll();
            NativePreparationOwnerHostSourceTests.RunAll().GetAwaiter().GetResult();
            System.Console.WriteLine("MANAGED_FAKE_VALIDATION_PASS");
            return 0;
        }
        catch
        {
            System.Console.Error.WriteLine("MANAGED_FAKE_VALIDATION_FAILED");
            return 1;
        }
    }
}
~~~

entry bytes: 697 / SHA256: 390690DCA5B5E790A29EB414DD4BF2B6D752464E05DBFE8E6708F076B787ED37

전용 /main은 NativePreparationManagedFakeValidationEntry다. 성공 표식은 관리형 fake 검증에 한정한다. suite 내부 단언 수·RunAll 4개·exe 실행 1회를 합산하여 시험 수로 만들지 않는다.

## 4. compiler와 참조 4개

읽기로 확인한 현재 지문이다. 다섯 파일 모두 일반 Archive이며 ReparsePoint가 아니다. 실행 직전 부모 경로와 파일의 nonlink·정확 bytes/hash를 다시 확인하고 불일치 시 중단한다. 기존 파일 수정·복구·다운로드 0이다.

| 정확 경로 | bytes | SHA256 |
|---|---:|---|

| C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe | 2569832 | 46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00 |
| C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll | 5445432 | 11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C |
| C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll | 3545264 | 2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71 |
| C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll | 1551104 | 8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D |
| C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Web.Extensions.dll | 1846016 | 5E6378EDC06F5A61920AAADB2ABA839DD3CF302D6192E08AACD4454BA4CFF0B3 |

## 5. 승인 후 전용 자원

후보 root: D:\tmp\anvil-v3-fn06-managed-fake-20261102-01. 지금 생성 0이다. 소유자는 Main/실행 사용자, 표식 ID는 b3af6537-6a8e-47d8-83d1-32c6ebd0258c다.

최초 직접 승인 UTC를 t0로 고정하고 t0+30분 종료 상한·연장/재생성/자동 재시도 0을 적용한다. 모든 await 뒤와 mutation/spawn 바로 앞에 원기한을 재검사한다. 부모 nonlink·root 부재·소유를 확인한 뒤만 생성한다. 기존 root/불명 소유/link가 있으면 변경·삭제하지 않고 중단한다.

허용 디렉터리는 root 및 src/out/tmp 세 개뿐이다. 허용 일반 파일은 owner.json 1개, src 고정19개, out/NativePreparationManagedFakeValidation.exe 1개로 최대21개/합계16MiB다. 정상 종료 시 tmp는 비어야 한다. 추가 .config/.local/.manifest/.pdb/응답 파일·로그·resource는 허용하지 않는다. 예상 밖 파일은 자동 삭제·allowlist 확대하지 않는다.

owner.json은 schemaVersion:1, 위 id, owner:"Main", 실행 사용자, approvedAt:t0, expiresAt:t0+30분, 이 문서 SHA, 입력19/도구5 manifest를 기록한다. 승인 시각/기한/지문은 생성 후 갱신하지 않는다. 파일은 exclusive create·sync/close·readback으로 검산한다. 원본18/entry/도구5의 파일·부모 nonlink 및 bytes/SHA·소유·경계·수명 검산 실패이면 compiler 시작 0이다.

## 6. 정확 명령·환경·예산

Main의 실행 supervisor는 명시 ProcessStartInfo를 사용한다. UseShellExecute=false, 고정 FileName·인자 배열·stdin 닫힘·stdout/stderr 비동기 수집이다. child 셸·프로필·PATH 검색은 없다. 두 child 환경은 Clear한 뒤 다음 네 값만 설정한다. 현재 사용자 환경에서 값을 읽지 않는다.

~~~text
SystemRoot=C:\Windows
WINDIR=C:\Windows
TEMP=D:\tmp\anvil-v3-fn06-managed-fake-20261102-01\tmp
TMP=D:\tmp\anvil-v3-fn06-managed-fake-20261102-01\tmp
~~~

PATH/COMSPEC/HOME/사용자 profile/credential/profiler 환경 상속 0이다. compiler cwd=root, runner cwd=root/out이다. 외부 config/추가 assembly를 두지 않는다. Framework의 일반 CLR/machine 설정까지 새로 격리·전수 조사했다거나 hostile-user 방어를 실증했다고 주장하지 않는다.

compiler FileName은 §4 csc.exe이며 인자는 다음 고정 옵션 뒤 §2 순서18개와 §3 entry를 각각 root/src/<basename>의 별도 절대 인자로 확장한 19개다. glob/열거/response file 0이다.

~~~text
/noconfig
/nostdlib+
/target:exe
/platform:x64
/debug-
/optimize+
/main:NativePreparationManagedFakeValidationEntry
/out:D:\tmp\anvil-v3-fn06-managed-fake-20261102-01\out\NativePreparationManagedFakeValidation.exe
/reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll
/reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll
/reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll
/reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Web.Extensions.dll
~~~

원본 대신 검산한 소유 복사본19만 컴파일한다. 추가 /resource,/keyfile,/analyzer,/unsafe,/recurse 등 옵션 0. /noconfig는 기본 csc.rsp, /nostdlib+ 및 정확 네 참조는 암묵 참조를 배제한다. compiler 자체의 시스템 신뢰를 새로 증명하지 않는다.

compiler 시작 순간 1회를 소비한다. 시작 기준 단조15초와 전체 승인 잔여 중 짧은 상한, stdout+stderr 합산16KiB다. 종료코드0·두 stream EOF·출력/handle 정착·입력/도구/표식/수명 재검산·output nonlink·전체16MiB 조건을 모두 만족해야 output bytes/SHA를 기록하고 runner로 진행한다. compiler 실패 시 runner 0, 자동 수정/재시도 0이다.

runner FileName은 검산한 output exe 정확 경로이며 인자는 빈 배열이다. 시작 순간 run 1회를 소비한다. 단조15초와 전체 승인 잔여 중 짧은 상한, stdout+stderr 합산16KiB다. exit0·stdout 정확 MANAGED_FAKE_VALIDATION_PASS와 줄바꿈 1개·stderr 빈값·두 stream EOF·handle 정착을 모두 확인해야 관리형 fake 성공이다. exit1/2·hang·출력 불일치·예상 밖 자원은 PASS가 아니다. 출력과 child 종료를 별도로 확인한다.

## 7. 불명 보존·정확 정리

시작 때부터 같은 Process 객체/handle을 보유한다. PID/시작 시각은 보조 관측만이다. 전역 프로세스 열거·이름/PID 재검색·kill/프로세스 트리 강제 종료·같은 명령 재실행은 하지 않는다. raw 예외/환경값 대신 고정 단계 코드로 기록한다.

timeout·출력 상한 초과·stream/종료 미정착·시작 여부 불명은 UNKNOWN이다. 감독 wait 종료를 child 종료로 선언하지 않는다. 같은 보유 handle의 상태만 후속 관측한다. input/output/소유 root와 미정착 handle을 보존하고 새 승인 없이 재실행하지 않는다. 30분 도달은 정상 회수 성공이 아니다. 보존 경로·소유자·마지막 상태/시각·다음 관측/새 결정 조건을 Main이 기록한다.

정상 종료 후 두 child와 출력이 모두 정착하고 자기 소유·nonlink·예상 목록·지문이 맞는 경우에만 정리한다. src 고정19개와 생성된 output을 개별 LiteralPath로 삭제하고 빈 src/out/tmp를 삭제한다. 다른 자원 회수를 확인할 때까지 owner.json을 보존한 뒤 마지막으로 owner.json과 root를 회수한다. 삭제 바로 전 경계·소유를 다시 검산한다. recursive delete/pattern/다른 셸 경로 전달 0이다. 예상 밖 항목·열린 handle·삭제 불명은 보존한다. 이후 독립 읽기로 정확 root와 명시 생성물의 부재를 확인한다.

## 8. 판정·독립 검토할 불확정점

새 결정 대상은 고정 source19/compiler1/reference4·전용 root/환경·1 compile+1 managed fake run·유한 관측/정상 회수뿐이다. 현재 승인이 아니며 실제 실행 0이다.

성공하더라도 이 19개가 해당 Framework compiler로 빌드되고 명시 fake 네 RunAll을 통과한 범위만 증명한다. 실제 native/Job/pipe peer·파일 공유/loaded ASAR·OS admission·실 factory/키·DB/RLS·서비스·Agent·내구성·전체 계획은 NOT_RUN/미완료다. JS51/type·정적 C0/I0를 C# 실행 PASS와 합산하지 않는다.

1. 18개 source와 entry의 C# 문법·Framework 참조 호환은 컴파일 전 미확인이다. 실패하면 자료 보존 후 기존 writer 경계로 수정하며 이 실행에서 자동 재시도하지 않는다.
2. 네 RunAll의 전체 분기/생성자 초기화가 고정 manifest의 명시 대역으로 닫히는지 독립 정적 검토를 결박한다. 새 실제 OS/파일 경로가 확인되면 runner 0으로 중단하고 compile-only DLL 등 정확 축소안을 별도 결정한다.
3. supervisor의 Environment.Clear·동일 handle·두 stream 유한 수집/EOF·단조15초·불명 보존/정상 회수 구현은 실행 전 구체 명령/스크립트로 독립 검토해야 한다. 이 문서는 supervisor 코드까지 검수됐다고 주장하지 않는다.
4. 실제 compiler/CLR의 시작·파일 생성 부수효과는 아직 관측하지 않았다. 예상 밖 출력은 자동 허용/삭제하지 않는다.
