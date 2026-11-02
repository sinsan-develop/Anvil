# FN06 native 준비 helper Host·부모 peer·종료 source 결과

2026-11-02 / Main 어울 / 기존 Primary·Reviewer

## 판정

**소스 작성·정적 검수 및 JS 연결 검증 한정. C# 동작·실제 native·전체 계획 완료 아님.** WI r2 SHA85F950FFCE29507C40FB6463419D4B1A533ED9AFF340E2CD26D861865A5479EA, 시작 cb3b8e3f751e34d30b86e1e127f63f2647880dd4/기존 codex/av3-stage-b. code **c66fa5653b3da80a37153a18eac5e29491dfff7e** 정확11파일/408추가21삭제. Main32d26f는 최종11SHA·raw/index bytes 동일·정확11 staged diff0을 확인했다. 관련없는 자료·보호 untracked3·기존 SQL/SDK/old QA Host·소진 compile 허가는 보존했다.

## 구현·검증 범위

새 C# Main→자기 고정 embedded resource exact8 부모 basis→실제 Windows pipe peer·보유 parent process instance/image·원 package 파일 hash→첫 OPEN의 원 factory fullref/자기 helper hash→기존 dispatcher→유한 async frame loop와 EOF/finally 같은 owner 정리의 source를 연결했다. 일반 stdin·CLI·env의 PID/path/hash를 trust 기준으로 선택하지 않는다. resource가 없거나 관측이 불명이면 기본 거절이다.

parent basis는 후속 build 생산자가 FN18의 실제 verifier·원 snapshot으로 생산할 값이다. 부모 exe/ASAR/header hash를 고정한 뒤 helper를 정상 compile하고 최종 helper 전체 hash를 새 physical factory ref로 소비하는 단방향 순서를 사용한다. 부모 ASAR에 helper hash를 다시 넣거나 normalized-slot/PE patcher를 만들지 않았다. 아직 실제 build/basis/factory 공급·제품 등록은 없다.

runtime resource 검사는 자기 assembly·정확 이름/embedded·manifest-contained·외부 file/assembly 없음이다. private visibility는 CLR API가 직접 노출하지 않으므로 조회했다고 주장하지 않으며, 후속 고정 /resource:...,private·최종 helper 전체 hash의 build 조건으로 구분한다.

Peer source는 stdio client 끝·같은 named-pipe server PID·보유 process handle/생성시각/생존·image와 읽기 보유 package 파일을 교차검사한다. GetNamedPipeClientProcessId를 child 신원으로 쓰지 않는다. 이는 source 관측 설계이며 실제 상속 handle API 성공·sharing/loader·이미 로드된 메모리나 원 ASAR 전체의 강한 증명은 NOT_RUN/미보장이다. 이를 새 필수 gate로 발명하거나 파일 hash 하나로 actual admission을 선언하지 않는다.

launcher는 이 helper에만 overlapped stdio와 새 SystemRoot/WINDIR allowlist env·고정 helperdir cwd를 사용한다. 부모 profiling/AppDomainManager/credential 환경과 미허용 getter를 읽거나 전달하지 않는다. 정확 helperExe+'.config'/'.local'/'.manifest'는 부재만 허용하며 어떤 종류든 존재하거나 관측 불명이면 거절·삭제0이다. 원 current/budget·supplier/image를 await 뒤 재확인한다. 이 부재 snapshot을 TOCTOU 완전 차단·OS 진위·machine/GAC 신뢰 증명이라고 하지 않는다.

미정착 read/write는 실제 Task 정착까지 원 buffer/handle 소유를 보존하고 늦은 결과로 재Dispatch하지 않는다. CleanupAttempted는 실제 Dispose 직전에만 관측하며 Host finally의 자동 두번째 정리를 막는다. EOF 첫 정리와 기존 public Dispose의 명시 재시도 의미를 구분하고 UNKNOWN을 성공 exit/CLOSED로 바꾸지 않는다.

## 검증·실패·재작업

| 근거 | 결과 |
|---|---|
| Primary308dfb→bfca90 | 실제 launcher pipe/overlapped 불일치 RED exit1→해당1PASS exit0 |
| Primary68205a | 1PASS/2FAIL, 기존 재시도 UNKNOWN 반환을 reject로 잘못 기대한 준비 단언. 실제 원시도 재실행0 조건은 유지 |
| Primaryb8f961 | Node 직접3파일27PASS/315.36ms·type0 |
| Main **b16789** | 정확11SHA 확인 후 JS5파일 **51PASS/fail0/skip0/453.8997ms**, root type/diff exit0 |
| 독립 1차 | **C0/I2 REWORK**, C# 정적 근거이며 runtime FAIL 관측 아님 |
| Mainade02b·재검수 | 보정3SHA/JS4불변·diff0, 독립 scoped **C0/I0** |

I1: work()가 pending IO Task를 반환한 뒤 remaining/timer 공급자가 throw하면 finally가 원 buffer 소거·EndIO/peer 해제를 먼저 하는 결함이었다. 보정은 finally 한 곳에서 operation.IsCompleted를 판단해 pending이면 ObserveLate로 정확히 한 번 소유를 넘기고, 실제 정착 뒤 소거/EndIO한다. 기한 진행 pending·timer factory throw의 C# 음성 시험 source를 추가했다.

I2: C# 정상 fixture의 두 drive-relative 경로를 정상 drive-absolute 경로로 고쳤다. 같은 Kernel을 쓰는 Host 시험도 이 보정을 소비한다. 이3파일만 바뀌었고 다른8지문·JS본문은 불변이다. 따라서 JS51을 다시 반복하지 않았고, **그 결과를 C# 보정 실행 증거로 확대하지 않는다.** C# brace/구분자 균형·리터럴 확인은 준비 보조일 뿐 컴파일 검사나 RunAll PASS가 아니다. 같은 근본원인3회 실패는 없었다.

정확 Main 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-owner-host.test.ts tests/unit/FN06/native-preparation-owner-launcher.test.ts tests/unit/FN06/native-preparation-owner-bridge.test.ts tests/unit/FN06/native-preparation-client.test.ts tests/unit/FN06/native-factory-call-context.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p tsconfig.base.json
git diff --check
```

Node의 관리 상대는 실제 JS Client/bridge/launcher의 protocol/IO/종료를 확인하는 명시 fake child다. C# 알고리즘을 JS로 복제해 실행한 증거가 아니며, C# Basis/Peer/Host의 fake kernel/file/stream 시험 source는 작성만 했다. **C# compile/RunAll·실제 OS/native/helper 실행은 전부 NOT_RUN**이다.

## 최종 SHA256

| 파일 | SHA256 |
|---|---|
| apps/connector/native/NativePreparationOwnerParentBasisSource.cs | A3E065F7DE77007E253A35D2EDE6A9332CD20A5F42D9BF02DC9A904D8BD278C3 |
| apps/connector/native/NativePreparationOwnerPeerSource.cs | A41E6DC7E1AE22F665E24D611B2A8DC229B14D877118E09A8885238799987F6F |
| apps/connector/native/NativePreparationOwnerHostSource.cs | 14E876AC3D83F3D1A1FC59D6CFF193BB1BD6494708AE6CDFFC2FE006C36C55F1 |
| tests/native/FN06/NativePreparationOwnerParentBasisSourceTests.cs | 850017ADC575D73E8403B3EB7A03465C81F7C83651BBD6E29FF13731CB7F1A97 |
| tests/native/FN06/NativePreparationOwnerPeerSourceTests.cs | A7375B7BC368F4FD3CD3DB800E586FFCADC2B9B728C0FEE1347561D49642609D |
| tests/native/FN06/NativePreparationOwnerHostSourceTests.cs | 152D70CD8A0C3F389CEDE85B1788D2C0CC046FE4E95445BE467C94461B29C5AD |
| tests/unit/FN06/native-preparation-owner-host.test.ts | B688EBC97F3F2C7496110EFFE6553C7269545AA70FAE94CD4E200ECC170B5874 |
| apps/connector/native/NativePreparationOwnerBridgeSource.cs | CAE4B38EF9A618FBFC49270F9B11CBA659C32411CBCF7F29D230C1EAD8D853F3 |
| apps/connector/runtime/native-preparation-owner-launcher.ts | 728A2C40CB5D5BF16E7D7F1740C3EE1CA637E6240D3CD1548879F9E1A5997EC3 |
| tests/unit/FN06/native-preparation-owner-launcher.test.ts | 43F13C58A843B6C13A0549DCED2817C454207C45D630658A5CA809145E1F1C10 |
| tests/unit/FN06/native-preparation-owner-bridge.test.ts | BA970B53F6DE6C178A31377309F49E9626D6D991476550E84499DA7FFC50E13D |

## 남은 선행·복구

실제 spawn·FS/OS 포트·키·DB·권한·서비스·Agent·실자료/P03R3 실행0, QA 자원0·live tool/session0이다. Node가 개발 소스/시험을 읽어 실행한 범위와 제품 helper 실행을 구분한다. 실제 부모 basis/build producer·helper 최종 hash의 physical factory/current/image 공급·제품 bootstrap/등록·Windows API/loader/sharing/정리 효과와 사용자 인수는 미완료다.

다음은 존재하는 source 폐쇄14(기존 Job partial10+새 Basis/Peer/Host3+dispatcher1)를 정확 build 입력과 출력 resource/hash 검산에 연결한다. QA Main/Worker를 넣거나 기존 소진 compile 허가를 재사용하지 않는다. build/manifest 존재만으로 준비 가능 true를 만들지 않는다. source 복구는 c66fa565의 정상 revert 후보이고 실제 환경 rollback0이다. 전체 FN06/FN08/44업무 완료와 main 통합은 별도다.