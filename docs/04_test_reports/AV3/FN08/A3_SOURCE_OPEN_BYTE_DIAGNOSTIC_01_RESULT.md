# A3 소스 열기 byte 진단 01 결과

Main 어울 · 2026-10-18. **실제 컴파일 FAIL / 직접 원인 미확정 / 이번 허용1회 소진**. 진단 관측 추가를 기능 완료나 컴파일 성공으로 승격하지 않는다.

## 결정·기준·실행

- PMO의 신산님 직접 10분 위임 확인: 사용자 실제 게시2026-10-17T20:50:24Z → 결정21:06:55Z/16분31초·최신8turn 새 직접답변/중지/거절 없음. 새 후보38157ad4c756d4670ad305aa740abd09e72febeb를 별도 결박, 창21:06:55Z~21:36:55Z·compiler최대15초/단1회·재시도/연장0이다. 과거ba3/50b나 앞선 실제 실패의 승계를 하지 않았다.
- 실행 직전 local/private exact·clean/mainf976ed5e29e14b13e12729d5b1ccf98f050f2210 불변, source3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC/helper5A4B808ABA9D5E63F7EDB31C7B16DADF9F3BFE0A83FF0BEB5DBA45C39555BD18 및 고정 compiler/BCL3 hash/version·OS3leaf만의 정확 예외/부모·source/QA strict nonlink·보호10/N4·기존 runtime을 확인했다.
- 같은 상대 source·library flags: csc.exe /nologo /noconfig /nostdlib+ /target:library /debug- /optimize+ /reference:<고정 mscorlib> /reference:<고정 System> /out:<등록 bin/SourceReadObserver.dll> apps/connector/native/SourceReadObserver.cs. ProcessStartInfo의 기존 cwd/UseShellExecute=false/CreateNoWindow=true·전용 TMP/TEMP, 참조·timeout 불변이다. source/compiler 복사·절대 source 인자 전환0이다.
- BaseStream bytes 합16KiB, 표준 Win32Exception2/3/5/32/33/123의 부모 메모리 UTF8/현재ANSI 대조·고정 순수함수만 사용했다. actual 전 수집 loop의 비UTF8 보존·합16KiB 상한·빈EOF·timeout 합성 MemoryStream4범주 PASS는 compiler/실OS catalog/file0의 준비 증거로 구분한다. 구문검사 parseErrors0도 실제 성공 증거가 아니다.

## 실제 원결과

~~~json
{"scope":"LIBRARY_COMPILE_BYTE_DIAGNOSTIC_ONLY","commit":"38157ad4c756d4670ad305aa740abd09e72febeb","status":"FAIL","failure":"A3_COMPILE_EXIT_NONZERO","cleanupFailure":null,"started":true,"exitCode":1,"elapsedMs":126.7833,"compiler":{"pid":73148,"exe":"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe","startUtc":"2026-10-17T21:09:21.2444013Z"},"diagnosticCodes":[{"code":"CS1504","severity":"error"}],"byteDiagnostic":{"kind":"A3_COMPILE_DIAGNOSTIC_INPUT","inputExitCode":1,"complete":true,"diagnosticLimitHit":false,"stdout":{"sha256":"36e94d0b5dbef80b7c4e3de7e3424a857a11441f138f5c8abdf5f2e6f08cf93c","capturedBytes":153},"stderr":{"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","capturedBytes":0},"diagnostics":[{"code":"CS1504","severity":"error"}],"sourceOpenFailure":{"fileRole":"SOURCE_BASENAME_ELSEWHERE","osReason":"UNKNOWN"},"executionAuthorized":false,"actualExecutionVerified":false},"byteCapture":{"stdout":{"sha256":"36e94d0b5dbef80b7c4e3de7e3424a857a11441f138f5c8abdf5f2e6f08cf93c","capturedBytes":153},"stderr":{"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","capturedBytes":0},"limitHit":false,"complete":true},"captureComplete":true,"captureLimitHit":false,"output":null,"qaRootAbsent":true,"dllLoaded":false,"nativeFunctionsInvoked":0,"osSourceObservations":0,"actualAgentCalls":0,"databaseWrites":0,"serviceChanges":0}
~~~

- exit1/CS1504 error1·stdout153bytes/EOF완전/잘림0·stderr0. 입력 전용 함수의 actualExecutionVerified:false는 실제 compiler를 실행하지 않았다는 뜻이 아니라 입력 분류기가 프로세스 신원을 인증하지 않는다는 뜻이다. 실제 프로세스는 별도 PID/exe/start/exit/time 영수증으로 구분한다.
- SOURCE_BASENAME_ELSEWHERE는 **유효한 다른 경로 문자열**과 같은 basename이라는 분류다. 기대 literal/절대경로와 다르다는 한정 관측이며 실제 어느 파일 객체인지·경로 해석 방식·ACL/잠김·인코딩/환경 원인을 확정하지 않는다. OS reason UNKNOWN이다. 실제 파일명/경로·오류 문구·catalog/raw/base64/stack은 출력·영구저장하지 않았고 사후 복원할 수 없다.
- output:null은 DLL 생성/유효성을 확인한 영수증이 없다는 뜻이다. 실행 중 DLL이 한때 존재하지 않았다는 독립 증거로 해석하지 않는다. 앞선 짧은 설명의 ‘DLL 미생성’ 표현보다 이 구분이 정확하다. DLL load/실행·PInvoke/실 source native 관측·Agent·DB/service 변경0이다.

## 정리·독립 후검사

- 새 D:\tmp\anvil-v3-stage-b\a3-source-open-diagnostic-01의 정확 owned compiler/직접child·QA사용process0과 등록 root/bin/temp 및 허용 산출물의 owner/nonlink·목록/hash를 대조해 정확 회수했다. cleanupFailure:null/rootAbsent:true. caller raw/catalog byte 배열과 MemoryStream buffer를 finally clear·dispose했고 관리 문자열의 즉시 완전 소거는 보장하지 않는다. 임의 원문 fallback 저장0·광역 kill/delete0이다.
- 별도 elevated 읽기 명령 exit0/2026-10-17T21:10:34.7136178Z: root 부재·compiler73148 부재·직접child0, 보호10+N4receipt11hash 일치, Node54212/relay26052 각각 고정 exe/start·단일127.0.0.1:3830 불변, Git38157ad4 tracked/untrackedclean·source/helperhash 불변이다.
- 기존 실패 동결자료/정식 DB/서비스·계정·권한·Secret·인증서·Oracle/main은 보존했다. 제거된 것은 재생성 가능한 이번 QA 전용 산출/빈폴더뿐이다. 현재 성공/실패로 과거 FAIL·소진 기록을 소급 변경하지 않는다.

## Main 판단·다음

- 동일 상대 source 재시도/추가 raw 수집은 하지 않는다. 현재 경로 문자열 불일치는 상대 인자 해석 차이의 가설을 지지할 뿐, 상대→절대 변경이 해결책임을 증명하지 않는다.
- 필요시 새로운 명령 계약은 기존 source의 검증된 절대 인자만 바꾸는 단일 변수 library compile1회로 별도 결정한다. 복사/ACL/환경 수리나 DLL 실행을 포함하지 않는다. 새 정확 commit/창/명령 결정 전 actual0이며 기존 창 잔여를 재사용하지 않는다.
- UI04 적용 snapshot GET 계약은 이 진단과 별도이고 아직 결정 전 구현0이다. Main은 승인된 계획의 남은 기능과 필요한 선행을 주도 대조하며 PMO 다음 작업 배정을 기다리지 않는다. 전체 FN06/FN08/UI04/Stage·실제 Agent·사용자 인수는 미완료다.
