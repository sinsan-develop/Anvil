# FN08 owner 소유 spool profile — A안 후보 r2

상태: 미채택. 기존 제품/시험 읽기로 구체화한 직접 결정 후보이며 제품 코드 GO나 실제 파일/권한/키/DB/서비스/Agent 실행 승인이 아니다. 근거는 WORK_PLAN FN06/FN08/FN16, P3 실행기 §3.1, TECH_DECISIONS의 spool1GiB와 기존 normal/SEND 내구 계약이다.

## 1. 문제·대안·결정 범위

현재 normal 파일 저장소는 제공받은 절대 root의 채널을 검산하지만, 실제 등록 owner가 실행 세대별 root를 발급·재개하는 호출자는 없다. 기존 비권위 수신함은 자체 root/maxBytes만 검사하고 native 준비 원장도 자체64MiB만 제한한다. 이것만으로 같은 설치의 합산 spool1GiB를 입증하지 못한다.

- **A 권장:** 현재 r5 root 신원당 보호 profile을 한 번 발급하고, 등재 writer의 namespace별 유한 배정·예약과 owner 내부 Node I/O를 연결한다. 자료를 native IPC로 옮기지 않아 기존3MiB행/64MiB채널을 유지할 수 있다. 새 보호 저장 목적·표식·내부 host 제어·기존 writer의 새 예약 거절 조건이 추가된다.
- **B:** 설치자가 별도 profile/디렉터리 배정을 미리 발급한다. 현재 설치 producer가 없어 추가 설치 권위·인계 계약을 먼저 정해야 하며 이번 source 범위로 바로 구현하지 않는다.

A 채택은 아래13제품·8시험 경로의 source·합성검증을 허용하는 제안이다. 실제 root/ACL/키/기존 파일/DB/서비스/설치/C#/SDK/Agent·P03 실행, 기존 프로젝트 차단 해제는 포함하지 않는다.

## 2. 신뢰와 최초 profile 발급

1. DesktopTrustKeyRootSource.Open의 exclusive CreateDirectoryW 성공과 Keep의 소유자/DACL/reparse/보유 handle 검산 이후에만 새 profile 전용 일회 증표를 만든다. 앞선 Inspect 부재값인 root.Created만으로는 발급하지 않는다. native-journal.v1용 TakeJournalCreationPermit을 재사용하지 않는다.
2. 고정 목적은 ANVIL_OWNED_SPOOL_PROFILE_V1, namespace는 owned-spool-profile.v1이다. profile은 root/SID·발급 nonce/profileId·roster/caps·형식버전을 보호 기록한다. 당시 등록/실행이 아직 없을 수 있으므로 최초 profile 자체를 실행 권위로 쓰지 않는다.
3. 이는 **현재 root 신원당 최초**일 뿐 설치 생애 최초를 증명하지 않는다. 전체 root 소실 후 재생성이 가능하다는 한계를 유지한다. 기존 root에서 profile이 없거나 손상됐다고 초기화하지 않고 새 기능만 UNSUPPORTED/UNKNOWN으로 닫는다. 기존 r5 등록/binding API와 준비 원장의 기존 검사 자체를 낮추지 않는다.
4. profile 발급 이후 APPEND_RECORD REGISTERED의 기존 SPKI·credentialMatched·원입력 검산 및 store.Append 성공 원행 접점에서만 등록 lineage를 보호 결박한다. 등록은 성공했지만 profile 결박이 불명이면 기존 등록을 실패로 바꾸지 않고 새 profile 작업만 거절한다. 복사된 과거 등록/slot·불완전 복원·원 profile/배정/tail 없는 과거 실행을 새 profile에 자동 도입하지 않는다. 분별할 원 근거가 없으면 거절한다. 임의 caller 선언/세대번호/시각만으로 최초 사용을 판단하지 않는다.
5. REGISTERED owner의 epoch·원 binding/context·현재 HUMAN의 installation/registration fullref·키/SPKI fingerprint·connector를 기존 방식으로 재검산한다. normal slot의 recordHash·원 grant fullref/실행 scope·credential세대/기한을 private LoadSlot/Record 검사로 확인한다. 원 port/credential/키/서명을 외부로 export하지 않는다. profile 최초 metadata 발급과 native 준비 writer는 이 normal slot을 선행 요구하지 않는다.

writer별 진입권위를 구분한다. 최초 profile metadata는 배타 생성의 별도 목적 증표와64MiB 관리 영역 안의 고정 create-new 유보를 쓴다. native 준비의 IssueFreshRoot는 기존 journal 전용 발급 증표·root/peer와 profile 예약을 사용하며 등록/실행 authority를 선행 요구하지 않는다. 이후 OPEN/APPEND·ACTIVE lock은 기존 등록/authority 검사를 유지하고 원 UNSUPPORTED를 해제하지 않는다. normal 실행세대 배정만 REGISTERED·원 slot 뒤에 열린다. 새 receipt wrapper는 같은 REGISTERED owner/HUMAN·고정 project/connector namespace에 제한하되 normal execution credential은 요구하지 않고 비권위 데이터로만 저장한다. 기존 raw 수신 API는 보존하며 profile 거절을 그 API로 우회하지 않는다.

## 3. 최초 양성 순서와 기존 보호 저장 관측

순서는 profile발급 → 기존 등록 및 실행기 보호 저장 관측/credential교환 → 원 보호slot검산 → 실행세대배정 → 쓰기전예약 → Node I/O다. 현재 storage.observe의 입력/대조에는 신규 normal allocationId나 디렉터리가 없으며, 이 후보에서 그것을 선행 요구해 순환을 만들지 않는다. 기존 관측은 grant/등록/reservation/scope/key/credential세대·evidence를 검산하며 역할을 credential만으로 한정하지 않는다. 실제 공급자가 없으면 기존412이고 후보가 성공 근거를 만들어 대체하지 않는다.

서버 START permit의 실행세대당1회·SEND의명령당1회는 새 localAttemptRef의 재발급을 막는 기존 안전망이다. 이것을 로컬 최초사용/소실 판별이나 실제 wire 확인/복구로 과장하지 않는다.

## 4. 배정·재개와 owner 내부 결과

- normal 배정 tuple은 현재 profileId·SID/root 신원·설치/등록 fullref·projectId·connectorId·executionId·executionGeneration이다. 재개는 원 배정의 grant fullref/record lineage와 새 slot도 대조하며 같은 세대에 다른 grant를 묵시 도입하지 않는다. credential 갱신세대나 만료시각은 배정ID에 넣지 않는다. 같은 tuple은 원 배정을 재개하고 다른 실행세대는 별도 배정이다. 준비/receipt 배정은 위의 목적별 권위와 고정 namespace에 따르며 normal tuple을 억지로 요구하지 않는다.
- 보호 배정/예약/채널 확정표식은 Node 자료 디렉터리 밖의 별도 고정 관리 위치에 둔다. Node 원장의 닫힌 채널 이름 목록에 관리 파일을 섞지 않는다. allocationId와 마지막 확정 count/tailHash/byte수를 현재 원행과 함께 검산한다. root나 마지막 행이 사라져도 새 빈 저장소를 발급하지 않는다.
- normal 최초배정은 원 profile·등록 lineage·검산된 slot 아래 create-new 배타로만 한다. 표식만/디렉터리만·신원교체·미정산예약·불명잠금/쓰기·owner상실은 UNKNOWN/UNSUPPORTED로 보존한다. 자동삭제/자동reset/잠금탈취/ACL수리/다른 host 재시도는 없다.
- native는 원 부모/root handle을 보유하고 같은 owner 내부의 비직렬화 포트만 Node 저장소에 연결한다. 외부 입력/renderer/HTTP 응답에 경로나 범용 파일 포트를 제공하지 않는다. 같은 번들의 목적 factory가 기존 intake/spool/coordinator/polling 구성요소를 내부 조립하며 raw store/withLease를 외부에 내주지 않는다. 이는 자동 start나 새 CURRENT/wire 생산자가 아니다. Node dev/ino와 native 파일ID를 같은 문자열로 가정하지 않는다. 검산된 동일 canonical root와 보유 handle 수명 안에서 Node 최초 root stamp를 결박하고 매 거래 이를 다시 검사한다. 연결 근거를 만들 수 없는 플랫폼은 mutation 전에 거절한다.
- 내부 상태는 ALLOCATED/RESUMED/CAPACITY_EXCEEDED/UNSUPPORTED/UNKNOWN으로 구분한다. 앞의 두 상태도 실행허가나 실제 내구성 합격이 아니다.

## 5. 용량과 모든 writer 참여

총량 범위는 **현재 SID/설치의 단일 활성 profile에 등재된 모든 프로젝트·실행세대**다. 물리 디스크 전체·타 SID·과거 미관리 root/고아 파일을 조사하거나 합산했다고 주장하지 않는다.

| 고정 writer/관리 영역 | profile 합산 상한 |
|---|---:|
| NORMAL_EXECUTION의 intake/attempt/observations/acks | 256MiB |
| UNVERIFIED_RECEIPT_INBOX | 512MiB |
| NATIVE_PREPARATION | 기존64MiB |
| 배정·예약·표식·잠금 등 관리 영역 | 64MiB |
| 미배정 여유 | 128MiB |

896MiB의 배정 합은 기존1GiB 안에 있다. 여유128MiB를 자동 전용하거나 관리 자료를 무제한으로 두지 않는다. 이는 새 profile 전용 수치 제안이며 기존 파일·기존 API의 단독 상한을 소급 변경하지 않는다. normal의 파일3MiB/채널64MiB·10000행과 native 준비 원장의 기존 ciphertext64MiB/authority10000/원형행2MiB 검사를 동시에 유지한다.

새 native 보호 예산 원장이 각 namespace의 모든 project/root·현재 점유·유한 예약·미정산 기록을 관리한다. 첫 lock create 등 모든 mutation 전에 예약하며 canonical+newline/base64 실저장 bytes·부분본·관리기록·UNKNOWN 잔류를 포함한다. 관리 영역도 사전 유보하되 재귀 예약하지 않는다. 관측→ACK 중첩 동안 전역 예산 lock을 계속 보유하지 않는다. 원 예약/정산 기록은 append-only로 남긴다. 미확인 점유를0으로 세지 않는다.

native의 정산 사실과 Node의 응답 수신은 별개다. 모든 Node I/O가 종료되고 해당 거래의 신규 I/O 진입이 봉인됐다는 신뢰된 내부 포트의 증거, 실제 원행/파일·신원·보호 요약 대조를 모두 충족해 native 정산이 확정된 경우에만 입증된 미사용 차액을 반환한다. 늦은 I/O 가능성·모호한 차액·native 정산 자체의 불명은 최악 예약을 계속 차지한다. native 확정 응답을 Node가 잃으면 Node 작업은 UNKNOWN이며 새 작업/dispatch를 허용하지 않는다. native 정산으로 Node의 수신이나 Agent 성공을 추론하지 않는다. 응답 수신 여부의 완전 탐지나 무한 ACK 절차를 요구하지 않는다. 별도 보호 재개 근거 없이 새 host에서 미정산 예약을 반환하거나 재시도하지 않는다.

미등록/미관리 writer가 같은 profile 정책 안에서 병행할 수 있으면 활성화/신규 쓰기를 거절한다. 기존 root 검색/자동 이관과 raw-root 수신함으로의 fallback은 없다. 기존 독립 raw API의 의미는 보존하되 profile의 보장 근거로 사용하지 않는다. 새 owner wrapper만 정확한 namespace와 예약에 참여한다. 기존 비권위 수신함의4096B/1024건·중복검산·executionAuthorized:false/dispatchPerformed:false는 유지하며 수신을 실행권위로 승격하지 않는다.

native 준비 writer도 profile 활성 시 최초 ACTIVE lock·issue·Release CLOSED 등 mutation의 예약에 참여한다. 용량/미정산 때문에 새 준비가 거절될 수 있다는 **새 실패 조건**을 포함한다. 기존 RequireDurabilitySupport와 Windows 준비 경로의 미지원/READY 차단을 해제하지 않는다. profile 없는 기존 모드에 이 계약을 소급 적용하지 않는다.

## 6. I/O와 유한 수명

자료 I/O와 기존 원행 전체검산/file.sync/readback은 같은 owner의 Node가 수행한다. native IPC는 profile/배정·예약·정산 등 소수 유한 제어만 보내며 요청/응답65536B·64frame·원10초를 유지한다. 행마다 IPC를 호출하거나3MiB/64MiB 자료를 프레임에 싣지 않는다. 정확 채널 요약은 보호 색인에서 목적별 조회하고 전체목록을 한 프레임에 밀어 넣지 않는다.

owner가 host종료·원기한·문맥상실을 관측한 뒤에는 새 I/O를 차단한다. lock/error 정리의 unlink와 정산도 새 I/O이므로 관측 뒤 실행하지 않고 이미 시작한 safe close만 끝낸다. 이미 시작한 Node I/O의 뒤늦은 완료를 원자적으로 취소한다고 주장하지 않으며 그 결과/미정산 예약은 UNKNOWN으로 보존한다. 다른 host로 이어서 기한을 연장하지 않는다. 동일 OS 사용자 공격 방어·Windows 부모metadata 완전정착·전원손실 복구 보증을 추가했다고 주장하지 않는다. 보호 원장·tail·자료 전체가 일관된 과거 시점으로 동반 복원된 경우의 완전 롤백 탐지도 보장하지 않는다. 실제 최대 입력의10초 내 완주는 미검증이다. 기존 normal/SEND 내구 한계를 명시한 채 실제 OS 검증과 구분한다.

### 같은 host의 중첩 저장·permit

attempt 잠금 안에서 intake/spool과 permit이 중첩되므로 두 번째 host open으로 우회하지 않는다. 비공개 AsyncLocalStorage ticket과 원 owner/profile/slot/grant/deadline에 결박한 목적 multiplexer가 같은 논리 거래만 원 host를 빌려 쓴다. ALS 존재만으로 허용하지 않으며 살아 있는 ticket·허용된 내부 요청·대여 중 직렬 상태를 매 await 검산한다. 반환된 대여권/분리된 늦은 작업·다른 scope/동시 open은 거절한다. 외부 current/wire/observer callback은 ticket 밖에서 호출하고 대여 권위를 자동 전달하지 않는다. 이러한 provider가 미지원이면 새 CURRENT를 만들어 대신하지 않는다.

대여는 한 protected request의 여러 frame을 직렬로 사용하며 close는 대여 반환만 뜻한다. Channel.operation이 성공해도 finally에서 local.abort 후 close하는 기존 수명과 구분하기 위해 내부 종료 disposition을 명시한다. HOST_REQUEST_VALIDATED와 OPERATION_UNKNOWN을 구분하고, 정상 borrower 수명 abort/close는 부모 host 종료·UNKNOWN으로 올리지 않는다. 원 외부 signal/기한·미완료 송수신 실패는 부모 거래의 UNKNOWN과 예약에 남긴다. 이후 client 검산 실패/최종 coordinator UNKNOWN도 목적 진입의 결과로 반영하며 저장된 사실을 성공으로 바꾸지 않는다. 기존 단독 host close/오류 의미는 유지한다.

중첩 전체는 원 host의10초·64frame **총합**을 사용한다. 자식마다 state/allocate/close를 재발급하거나 새10초 창을 열지 않는다. 정상 START의3회 reconcile에서 중복 관측 검산을 포함한 모든 물리 frame을 계수하며65번째는 발송 전에 거절한다.

## 7. 목적 한정 내부 형상·build

host에 NORMAL_SPOOL_PROFILE_STATE, NORMAL_SPOOL_ALLOCATE, NORMAL_SPOOL_RESUME, NORMAL_SPOOL_RESERVE, NORMAL_SPOOL_SETTLE, NORMAL_SPOOL_CLOSE의 닫힌 제어 연산을 추가한다. 목적별 profile/발급증표/등록·slot/배정·거래/예약과 원 source 증거를 native 내부 검사로 결박하고 caller가 path/최종잔량/권위를 선언하게 하지 않는다. 새 서버 endpoint·role·renderer IPC는 없다. profile 상태·배정ID만 알아서는 파일 접근권이 생기지 않는다. normal은 owner가 원 pair/port를 내부 보유할 때, 준비/receipt는 위에서 구분한 목적 권위에서만 내부 저장 포트를 구성한다.

native 정확 source목록26→27과 입력/helper/부모 지문 검산을 유지한다. 실제 compile·배포나 기존 HelperHash/등록 자동 갱신은 하지 않는다. JS 번들에는 목적 factory·기존 normal 구성요소와 SEND wire를 포함한 실제 의존 source만 개별 등재하며 정확 seen/EXPORTS/validateOutput·전후 hash/readback과2MiB출력 상한을 유지한다. 기존 crypto/https/util 외부목록에 실제 의존 node:fs,node:fs/promises,node:path,node:async_hooks,node:util/types만 추가하며 범용 path/fs/signer export는 하지 않는다. util/types는 util과 별도 specifier로 검사한다. 새 외부 모듈 허용도 직접 채택 범위다.

## 8. 닫힌 구현 허용목록

제품13경로:
1. apps/connector/native/DesktopTrustKeyRootSource.cs
2. apps/connector/native/DesktopTrustKeyHostSource.cs
3. apps/connector/native/NativePreparationJournalKernel.cs
4. apps/connector/native/NormalExecutionCredentialSource.cs
5. apps/connector/native/NormalExecutionSpoolProfileSource.cs (신규)
6. apps/connector/runtime/normal-start-file-store.ts
7. apps/connector/runtime/receipt-inbox.ts
8. apps/desktop/src/trust-enrollment-owner.cjs
9. apps/desktop/scripts/desktop-trust-key-host-build.cjs
10. apps/desktop/scripts/native-proof-runtime-build.cjs
11. apps/desktop/scripts/native-proof-runtime-entry.mts
12. apps/connector/runtime/normal-owned-spool-profile.ts (신규)
13. apps/connector/runtime/normal-credential-bootstrap-client.ts

시험8경로:
1. tests/unit/FN08/normal-start-file-store.test.ts
2. tests/desktop/desktop-trust-registration.test.cjs
3. tests/unit/FN06/native-preparation-journal-native.test.ts
4. tests/desktop/normal-execution-credential-owner.test.cjs
5. tests/desktop/desktop-trust-key-host-build.test.cjs
6. tests/desktop/native-proof-runtime-build.test.cjs
7. tests/unit/FN08/normal-spool-profile.test.ts (신규)
8. tests/unit/FN08/normal-credential-bootstrap-client.test.ts

실파일/child를 사용하는 기존 receipt integration은 이번 실행 대상에서 제외하고 신규 RAM profile 시험에서 wrapper와 원 legacy 검산 기대값을 확인한다. 등록 RAM loader는 새 exact 외부목록을 대조하되 fs 모듈은 실제 I/O를 막는 RAM 대역만 제공하고 import 효과0을 검사한다.

Main의 WORK_STATUS/WORK_CHECK·WI/결과 기록은 별도다. 목록 밖 실제 의존이 발견되면 범위와 이유를 먼저 대조하고 승인된 source 범위를 임의 확대하지 않는다.

## 9. 검증·미검증·rollback

RAM에서 profile최초발급1회/기존root무표식·교체거절, 목적별 준비/receipt의 첫 진입과 normal slot 선행, 등록·키·grant·slot불일치, 동일세대재개/credential갱신·다른세대격리, root/마지막행·tail 소실/교체, 원예약후죽음/늦은I/O/정산응답유실, 두writer의잔여경합·미등록writer혼용거절을 검증한다. 실제 같은 번들의 coordinator가 중첩 store/spool+preparePermit/send를 거쳐 첫 START1회를 마치고 PERMIT/RESPONSE를 기록하는 양성에서, 처음 등록/키 확인부터 reserve/settle·중복 관측 검산·대여 반환/최상위종료까지 동일 host의 전체 물리frame을 세어64이하여야 한다. 정상 finally abort가 부모를 poison하지 않음, 외부callback/다른scope·반환된ticket/늦은자손 거절,65번째frame/원기한에서 새host/추가dispatch0을 단언한다.3MiB/64MiB/10000행과 각 namespace/1GiB 경계는 자료크기와 독립된 제어 전송 수를 포함해 검산한다. 실제 CJS 메모리 build의 폐쇄성·import효과0·기존 등록/normal/비권위/준비 guard 회귀와 타입/diff를 확인한다. C#source는 고정 목록·구조·합성 포트 검증이며 실제 compiler/PInvoke 실행을 포함하지 않는다.

합성 증거를 실제 Windows 파일·ACL·key/host·DB·Agent·사용자 인수로 승격하지 않는다. 실제 보호 저장 관측 공급자 미연결412·native 준비미지원은 유지한다. 범위 내 code/source 결과와 실제 기능 완료를 구분한다. rollback은 명시13제품/8시험의 역diff이고 실제 데이터 rollback은 이번 범위에 없다.
