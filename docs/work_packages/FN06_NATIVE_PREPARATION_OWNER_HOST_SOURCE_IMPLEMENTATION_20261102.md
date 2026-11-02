# FN06 native 준비 helper Host·부모 peer·종료 source 작업지시서

2026-11-02 / Main 어울 / 기존 Primary 단일 writer / 기존 r2 내부 A

## 1. 목적·기준

원 r2 A §79/96/177, INTERFACES §14.3와 owner source0caad4eaf86377eb47f3262dd8abe957e04970ec을 이어간다. 실제 helper entry→고정 부모 basis resource→OS pipe peer/보유 부모 process instance·package 파일 검산→기존 dispatcher→유한 frame loop→EOF/finally 동일 owner 정리의 source를 구현한다. 아직 없는 entry를 가정한 가짜 build 생산을 먼저 완료하지 않는다. build producer는 이 source 폐쇄가 생긴 뒤 후속으로 작성한다.

코드·합성 검증만이다. 실제 C#compile/실행·helper/OS API/native/프로세스·DB/권한/키/서비스/Agent·실자료/백업조사·P03R3 실행0이다. 새 store/API/권한/키/신뢰 root·등록 승격·재시작 holder 복구는 추가하지 않는다. 현재 source-only/기본 미등록과 실제 지원 미확인을 유지한다.

Main은 단순한 단방향 build를 선정했다: parent package 먼저 완성/검산→그 부모 basis를 helper에 정상 내장/compile→helper 전체 hash→새 physical factory namespace의 contentHash로 고정→기존 보호 server/current와 parent image supplier가 동일 fullref/hash 소비. 부모 ASAR에 helper hash를 넣지 않으며 normalized slot/PE patcher를 만들지 않는다. 이 단위는 build/배포를 실행하지 않는다.

## 2. 정확10 허용 경로

신규7:
1. apps/connector/native/NativePreparationOwnerParentBasisSource.cs
2. apps/connector/native/NativePreparationOwnerPeerSource.cs
3. apps/connector/native/NativePreparationOwnerHostSource.cs
4. tests/native/FN06/NativePreparationOwnerParentBasisSourceTests.cs
5. tests/native/FN06/NativePreparationOwnerPeerSourceTests.cs
6. tests/native/FN06/NativePreparationOwnerHostSourceTests.cs
7. tests/unit/FN06/native-preparation-owner-host.test.ts

기존3의 최소 연결:
8. apps/connector/native/NativePreparationOwnerBridgeSource.cs — Host가 같은 dispatcher를 생성/소비하도록 필요한 internal parsing/검산 접점만. 기존 owner·시간·UNKNOWN 의미 불변.
9. apps/connector/runtime/native-preparation-owner-launcher.ts — Windows child의 유한 비동기 표준입출력에 필요한 overlapped stdio 연결만.
10. tests/unit/FN06/native-preparation-owner-launcher.test.ts — 같은 stdio 동작·직접 영향 반례만.

기존 Primary만 이10경로를 수정하고 Main은 문서·관리·검수·통합한다. 다른 담당/보호 untracked3·old QA Host/Main/build·소진 compile-only 실행안·원 C# Job source/SQL/SDK/과거 fixture·공개 API/상위 r2 parser는 읽기 재사용하며 수정하지 않는다. 필요 경로가 더 생기면 정확 delta를 반환하고 임의 확장0이다. commit/push/docs는 Main 소유다.

## 3. 고정 resource의 부모 basis

자기 assembly의 고정 이름 private embedded resource `Anvil.Native.NativePreparationOwner.ParentBasis.v1` 한 개만 읽는다. 외부 파일/assembly 참조·중복/추가 resource·부재·불명·과대/불완전 UTF-8·중복 key·여분 필드를 거절한다. stdout/CLI/env/일반 파일에서 basis/root/PID/hash를 선택하지 않는다. 없으면 기본 거절이며 placeholder/hash0으로 성공하지 않는다.

내부 canonical JSON exact8: schemaVersion=1, purpose=NATIVE_PREPARATION_PARENT_PACKAGE_BASIS, physicalNamespace=ANVIL_NATIVE_OWNER_FACTORY_V1, factoryId(UUID), factoryVersion(양의 safeinteger), parentExeHash/parentAsarHash/parentHeaderHash(각 SHA256 소문자64). 전체8KiB 이하·숫자/문자열 canonical 검산·복제 불변을 적용한다. helperHash는 자기 참조이므로 이 resource에 넣지 않는다. 원천은 후속 build producer가 실제 FN18 검산·원 snapshot으로 생산할 값이며, 현재 임의 JSON이 실제 승인 기준이라고 하지 않는다.

## 4. 실제 peer·부모 instance·파일 보유 source

기본 경로는 실제 GetStdHandle/GetFileType/GetNamedPipeInfo/GetNamedPipeServerProcessId를 소비한다. stdin/stdout의 client 끝·byte pipe·동일한 server PID를 확인하며 GetNamedPipeClientProcessId를 child PID 증거로 쓰지 않는다. caller PID나 일반 부모 경로 문자열로 대체0이다. 공식 문서상 실제 상속 client handle 동작·sharing은 물리 검증 전 NOT_RUN으로 남긴다.

그 PID의 최소 조회·생존 관측용 process handle을 보유하고 생성시각/생존·QueryFullProcessImageNameW와 pipe peer 전후를 교차검사한다. PID 재사용·부모 종료·바뀐 instance·관측 불명은 폐기한다. 권한/ACL/token을 변경하거나 VM write/원격 thread/다른 process를 제어하지 않는다.

원 image에서 도출한 Anvil.exe와 resources/app.asar의 실제 regular file handle을 읽기·교체 방지 공유 조건으로 보유하고 basis hash를 대조한다. caller path/root를 받지 않는다. 경로이탈/reparse·다른 bytes·읽기 중 교체·불안정 identity·최종 경로 불일치를 거절하며, 필요한 공유 조건을 얻지 못하면 지원으로 표시하지 않는다. exe/ASAR는 기존 유한 파일·전체 한도를 지키며 streaming hash/원 ASAR header 한도를 적용한다. kernel/파일 조회가 미정착하면 늦은 결과로 admission을 재개하지 않는다.

이 결합은 원 process instance·보유 package 파일과 기존 Electron fuse/embedded ASAR loader 기준의 source 관측이다. 실행 중 메모리/과거 loaded ASAR 전체·모든 악성 동일 사용자 주입까지 입증했다고 하지 않는다. 반대로 이 더 강한 성질을 새 필수 gate로 발명하지 않는다. source 결과/실제 지원·권위를 구분한다.

## 5. startup·Host·원 dispatcher

새 standalone Main은 인자0·고정 resource→peer lease 검산이 먼저이며 첫 stdin OPEN 자체가 인가/신뢰 기준은 아니다. 같은 원 채널에서만 OPEN을 읽고 exact context의 factory id/version과 helper 자신의 전체 image hash를 원 authority.nativeFactoryRef에 대조한다. 같은 private peer lease가 유효한 동안에만 기존 dispatcher를 생성/소비한다. raw context의 목적/false/기한·fullref 결박과 원 frame/canonical/sequence 검산을 유지하고 다른 factory/holder/채널을 거절한다.

전체 startup은 최초 local10초 상한 안에서 시작하며 첫 frame의 원 callExpiresAt/remainingMs로 더 축소한다. 로컬10초를 원 준비 기한 연장으로 쓰거나 단계마다 reset하지 않는다. 부모 검산·입출력·각 await 뒤·Dispatch 전후에 원 peer/clock/기한을 다시 확인한다. OPEN 후 EOF/잘린 frame/오류/부모 종료는 같은 dispatcher의 Dispose로 이어지며 새 OPEN/새 helper/재접속0이다.

정상 loop는 기존 OPEN_EMPTY/QUERY_EMPTY/CLOSE_OWNER·64KiB exact frame/reply만 처리한다. context/sourceScopes/임의 명령을 추가하지 않고 stdout은 protocol만, 원 오류/비밀/stack 출력0이다. 종료는 실제 닫힘 관측·원 owner 정리 결과와 구분하고 UNKNOWN을 성공 exit/CLOSED로 축약하지 않는다. Dispose 불명은 동일 owner를 보존한 불명이지 writer 회수 완료가 아니다. kernel/native synchronous 호출의 강제취소를 보장하지 않는다.

## 6. 유한 비동기 입출력의 실제 연결

Main은 고정 Node24.22.1 공식 child_process source에서 `overlapped`가 child 표준 handle에 FILE_FLAG_OVERLAPPED를 주는 방식임을 확인했다. launcher는 이 private native helper에만 stdio ['overlapped','overlapped','overlapped']를 사용한다. shell:false/windowsHide:true·직접 원 ChildProcess/stream 소유와 원 deadline·UNKNOWN 보존은 그대로다. 일반 Agent/다른 launcher/서비스를 바꾸지 않는다.

C#은 겹친 IO handle에 맞는 FileStream/유한 비동기 경로를 사용한다. Console.ReadLine의 동기 무한대기나 Task.Run timeout만으로 실제 IO가 회수됐다고 하지 않는다. 원 read/write·timer/미정착 buffer/handle의 소유와 늦은 callback의 후속 Dispatch 금지를 명시한다. timeout/Cancel 요청과 실제 IO 완료/소거를 구분하며, 미정착은 UNKNOWN으로 남긴다. 같은 소유 IO의 제한 정리만 허용하고 Thread.Abort/일반 process kill/외부 handle 회수로 우회0이다. 불가능한 runtime/API 조합은 지원이라고 하지 말고 정확 근거를 반환한다.

공식 근거:
- https://raw.githubusercontent.com/nodejs/node/v24.22.1/doc/api/child_process.md (`options.stdio`)
- https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.-ctor?view=netframework-4.8.1 (SafeFileHandle/isAsync·동기 handle 비동기 오용)
- https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-getnamedpipeinfo
- https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeserverprocessid

## 7. 검증·증거·반환

C# Basis/Peer/Host의 실제 로직을 fake kernel/file/stream/clock/owner 포트에 연결하는 실행 가능한 시험 source를 작성하되 이 단위에서는 compile/실행하지 않는다. 단순 verified:true 대역만으로 검산을 대체하지 않는다. C# 시험 source는 작성/정적 검토와 runtime NOT_RUN을 구분한다.

Node 시험은 실제 Client/bridge/launcher의 overlapped 설정·원 budget/current→명시 C# 상대 모델→정상/불명/EOF 흐름을 확인한다. 이 모델의 PASS를 C# 실행 증거로 표시하지 않는다. 기존 owner21/client/context의 직접 영향만 선정하고 동일 불변 전수 반복0이다.

정상/부모basis 없음·중복/잘못된 hash·pipe 유형/다른 server/부모 종료·PID 재사용·image/ASAR 교체·peer 검산 후 변경·첫 frame 전 만료·잘못된 factory·EOF/부분 frame/추가 stdout·write/read 미정착·Dispose 실패·늦은 callback/중복 정리·helper 자동재시작0을 반례로 삼는다. false 지원·도구 실행권위 상승0이다.

실제 FS/OS/프로세스/C#compile/키DB서비스 실행0·메모리 포트만, QA 자원0을 우선한다. 추가 실제 자원이 필요하면 생성 전 Main에 정확 대상/owner/수명/정리를 요청한다. 동일 근본원인3회는 정식보고/동결·writer 반환이며 원인을 쪼개지 않는다.

Primary는 정확10SHA/diff·각 명령/exit·RED/GREEN과 준비오류·C# 미실행·잔여/자원0·writer 반환을 제출한다. Main fresh·독립 C0/I0·정확 stage/commit/private게시 후 다음 build-source 단위로 진행한다. source 복구는 정상 revert이고 실제 환경 rollback0이다. 전체 FN06/FN08/44업무 완료는 여전히 별도다.