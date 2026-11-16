# FN07 SDK 생산자 소스 중간 검증

**판정은 부분 구현이다.** 고정 배포 입력의 빌드 호출선, 원 등록·슬롯·정착된 행의 읽기, 격리 worker와 제어 포트 사이의 유한 스트림을 검증했다. 격리 worker의 최초 owner 발급, 첫 SEND의 SDK 로더·원 Query 생성, native 자식의 장기 감독·회수와 같은 Query의 출력·STOP까지의 전체 여정은 미완료다. 메시지 포트의 RAM 응답은 시험이 생성했다.

기준은 `codex/av3-normal-sdk-producer`, 제품 main `19e0430705f667593972524ed7c1c1c4e3cf1b66`, 구현 명세 `77A226A31781CA71A34DBE43318D8429A6F6EB1D67559BA7DF870B993AB3D98D`다. 최초 WI 지문은 `EBA7836B91796A6DB4C0213D1114029E2623677816AB4E6D4E116244993A6EEB`이다. Main이 원 FIRST3 정착 검산을 위해 13번째 제품 경로인 `NormalExecutionSpoolProfileSource.cs`를 배정한 최종 WI 지문은 `F6777B530E167C042595F8E0FC8EB0F0B8527805B6257325C0F94811CECB9FF2`이다. A/B/C 중간 범위의 실제 변경은 제품 8개와 시험 3개다. 관리 문서와 Git은 Main 소유다.

|부분|실제 연결과 검증 한계|
|---|---|
|배포|기존 데스크톱 패키지 생산자의 copy/post hook에 고정 자료 검산과 배포 경로를 연결했다. 빌드 입력은 최종 부모 exe/ASAR/header를 받지 않는다. native는 보유한 원 부모 프로세스, 승인된 ASAR와 header에서 manifest를 읽고 등재 파일의 경로·신원·바이트를 검산한다. 원 peer·보유 핸들 검산과 폐쇄 상태를 모든 실행 경로 getter에 적용했다. 닫기 false/예외에서도 나머지 원 핸들의 회수를 시도하고 실패 핸들과 원 객체를 보존해 host를 불명으로 끝낸다. 실제 패키지 빌드·설치·핸들 관측은 미실행이다. 전이 import/실제 loader 닫힘은 미검증이다.|
|보호 원행|전용 내부 판독이 기존 보안 프로필에서 등록·원 slot·배정·기한과 두 채널의 정산 및 원행 세 개를 각각 검산한다. 패키지 조회 후 원 등록·슬롯·원행을 재판독한다. 현 상태는 `SDK_CONFIGURATION_UNAVAILABLE`다. 기존 행은 이전 OS 생성 여부까지 증명하지 않는다. CS0819의 기존 `var` 다중 선언 한 곳을 두 선언으로 분리했다. 소스 순서와 표현을 검사했으며 C#은 컴파일하거나 실행하지 않았다.|
|스트림|SDK worker에서 한 번 발행한 요구를 유한 대기한다. hook 입력 지문만 제어 포트로 보내며 cwd·env·argv 원문은 보내지 않는다. stdin 2MiB 사전 예약, 64KiB 청크 및 ACK, stdout credit과 소비, 송수신 합계 256MiB, callback의 단발 정리·peer 소실·EOF/EXIT 구분을 구현했다. 원 native 권위를 확인하는 broker와 stderr 64KiB 배출은 후속이다. 정산·보호 저장·실행 권위는 이 수송 한도와 독립이다.|

## 검증

|최종 명령|관측|
|---|---|
|`node --test tests/desktop/normal-sdk-worker-package.test.cjs`|87e61d, 5 PASS/0 FAIL/0 SKIP, exit 0. 형상 RAM 및 배포/폐쇄 소스 정적검사.|
|`node --test tests/desktop/normal-sdk-worker-journey.test.cjs`|8c2c4e, 2 PASS/0 FAIL/0 SKIP, exit 0. C# 원행·현재성·권위 부재 시 비실행을 읽은 정적검사. 전체 SDK 여정은 미검증.|
|`node --test tests/desktop/normal-sdk-child-bridge.test.cjs`|bdaf61, 13 PASS/0 FAIL/0 SKIP, exit 0. Node 메모리 worker·MessageChannel·Writable/Readable, 합성 제어 응답. 이전 84c56b의 10 PASS는 보완 전 결과다. 원 SDK/Windows 자식 실행 0.|
|`node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false`|브리지 보완 후 41ebca, exit 0, 출력 0.|
|`node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false`|16a379 → 4834a1, exit 0, 출력 0.|

- 패키지 초기 모듈 부재 8a83dd 뒤 RAM 2건을 통과했다. 폐쇄 상태 반례 bc5a65 1 FAIL → a868d0 4 PASS, 닫힘 불명 반례 a1e715 1 FAIL → 최종 5 PASS. 중첩 getter·Proxy trap 0은 기존 입력 검사에 대한 방어 시험이다.
- 전송 초기 모듈 부재 493753 → 2256e4 2 PASS. kill 비정상 반환 92e286 및 소비 전 다음 DATA 처리 1c21c5를 각각 수정했다. 이전 6/7/9 PASS는 최종 결과에 중복 합산하지 않았다. desktop 초기 타입 4건(931341) 보완 후 명령 경로 오류 c13475를 정본 경로로 바로잡았다.
- 실제 DB·권한·키·사용자 자료·서비스·SDK/Agent·C#/CLI 실행, Win32 Job/pipe, 패키징, 추가 SDK/SSH 조회, 모델 호출 및 사용자 인수는 미실행이다. 설치 관측 부재와 실행 구성 발급 주체의 계약 부재를 분리했다. cwd/env 보호 계약 후보 `4091F826`은 검증 시점 미채택이다.
- 복구 단위는 이 브랜치의 목적별 소스·시험이다. Main이 보존하는 기준 commit과 원 배포/등록 경로를 사용한다. 외부 DB·파일·프로세스에 대한 복구 조치는 발생하지 않았다.

## 동결 파일 SHA256

C 재작업의 선행 명령 `node --test --test-name-pattern='입력 TypedArray|stdio DATA|초기 signal|격리 RAM worker' tests/desktop/normal-sdk-child-bridge.test.cjs`는 64e4ea, 4 FAIL, exit 1이었다. 서로 다른 세 원인을 보완했다. ① 입력 예약은 TypedArray 내부 바이트 길이를 사용하고 예약한 크기의 배열에 복사한다. 자체 길이 0인 실제 2MiB+1 입력은 DATA 없이 거절하며, 작은 유효 입력의 길이·buffer·constructor getter와 Proxy trap 호출은 0이었다. ② 원 worker/lifetime/스트림 신호는 Proxy와 자체 aborted/listener 재정의를 먼저 차단하고 내부 슬롯을 검산한다. listener 등록·해제에는 원 EventTarget 메서드를 사용한다. ③ DATA마다 64KiB 이하인 독립 backing만 전송한다. 역방향 DATA도 0 offset과 실제 backing 길이를 대조한다. 이 증거는 JS 스트림 경계에 한정된다.

|파일|SHA256|
|---|---|
|`apps/desktop/scripts/normal-sdk-worker-build.cjs`|`E808304B1B14CAB52A14848DB1B32F84E383E5E71A9AD24080E39C320EAE45FC`|
|`apps/desktop/scripts/desktop-runtime-profile.cjs`|`687468F8563D775D821762BDEC27383FD609A9521C29ECF630C4EC94BB5DDF3D`|
|`apps/connector/native/NormalSdkWorkerPackageSource.cs`|`6986DD763B336E52625263323455BD39FE5A0812D87AD80EE69EB3DF6457D179`|
|`apps/connector/native/DesktopTrustKeyHostSource.cs`|`827520B3283FA40B73E09E95DFB3B14CE9E434D644C833E87960053814CBE88B`|
|`apps/connector/native/NormalExecutionCredentialSource.cs`|`244EA6CC0A5915C41D4E525849F9690DE3FC02479A510A760F17BD507649729D`|
|`apps/connector/native/NormalExecutionSpoolProfileSource.cs`|`58D2CE34B16AE196E4AA246DFC5AC0BDCC73F3CD4B9AEF2EDFB2751FBCF4A36D`|
|`apps/desktop/scripts/desktop-trust-key-host-build.cjs`|`A23567896B7C829D9869F9605737EE0370B5673D0AFAFB8BFDA51210E593964B`|
|`apps/desktop/src/normal-sdk-child-bridge.cjs`|`BB1BA226A560B98C10F2202F74FD64E00E2CFDF7C6C454F71E1AB7E1D056F871`|
|`tests/desktop/normal-sdk-worker-package.test.cjs`|`0EEF1B7BE07738B1F47BD1799BF8337F12788DDC6CC877BA37AFB482A58BBBFA`|
|`tests/desktop/normal-sdk-worker-journey.test.cjs`|`F9D55D33CEB1BF09F54938170A6E0A039805EA3B339F2390C520F7A60316087B`|
|`tests/desktop/normal-sdk-child-bridge.test.cjs`|`8FE1E74D49210D7B9050F04416D2E884DD14D52C6A206DFD2B45BDE51BF708DC`|
