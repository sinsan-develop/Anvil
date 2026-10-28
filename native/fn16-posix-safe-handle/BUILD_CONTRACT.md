# FN16 Linux native 파일 포트 — 빌드·수명·검수 계약

2026-10-29 / WI `docs/work_packages/FN16_NATIVE_FILE_PORT_IMPLEMENTATION_20261029.md` SHA256 `C6E59B3E1F9B0C3B99EDEDB5563B3735FB6F497C515527C92F4EDF8E89C462BF` / 원 계약5A6819E6·직접승인3FAD0CE9·관리 adapter 기준1ec256ec.

**현재 상태: 계약·통합시험·C 제품·빌드 정의 소스 작성. 컴파일·로드·실제 FS 검증은 아직 0이다.** 이 문서의 실행 형태는 후속 exact 실행안을 대신하지 않는다. 실제 catalog/키/DB/서비스를 생성·변경하지 않는다.

## 1. 고정 초기화와 반환 구조

Addon의 export는 `createInstallationResourceNativePort(snapshot)` 함수 한 개다. 초기화는 모든 slots를 먼저 유한 메모리 검증·복사하고, 전체 검증 성공 뒤에만 port를 반환한다. 파일을 열거나 경로를 탐색하지 않으므로 initializer 실패의 부분 FD는 0이다. 이후 openRoot 중간 실패는 이미 연 자기 부모/root FD만 역순으로 단발 회수하고 부분 소유권을 성공 등록하지 않는다. 입력은 아래의 닫힌 구조다.

```ts
{ schemaVersion: 1, installationId: UUID,
  slots: [{ binding: InstallationPosixBinding, absoluteRoot: string }] }
```

`InstallationPosixBinding`은 기존 `installation-resource-posix.ts` 타입 그대로이며 `slotId, installationId, purpose, profileRef, expectedRootIdentity, ownerUid`를 포함한다. 각 binding의 installationId는 최상위와 같아야 한다. 알려지지 않은 필드·중복 slot/root identity·중복 absoluteRoot·변조 profile을 거절한다. 문자열/숫자/배열을 native 소유로 복사하며 원 JS 객체 변경은 영향을 주지 않는다. absoluteRoot는 보호된 설치자가 제공하는 서버 내부 값이다. 공개 API·사용자 path 입력·환경변수 탐색 경로로 제공하지 않는다.

반환 객체의 own 함수는 아래 12개뿐이며 모두 Promise를 반환한다. 동기 인수 오류도 고정 오류의 rejected Promise로 통일한다. initializer의 구조 오류만 동기 고정 오류다. 별도 경로 명령·raw FD·권한 설정·임의 로더·fault-injection API는 없다.

| 연산 | 정확 입력 | 성공 결과 |
|---|---|---|
| openRoot | binding | opaque root capability |
| inspectRoot | root | `{binding,generation,root,parents}` |
| create | root, `{fileId,bytes,exclusive:true,noFollow:true,mode:384}` | `{capability,observation}` |
| open | root, fileId, `{noFollow:true}` | `{capability,observation}`; 생성 소유권 없음 |
| stat | root, file | `{generation,file}` |
| read | root, file, maxBytes | 새 Uint8Array |
| sync | root, file | void |
| remove | root, file, expectedIdentity | `{identity,removed:true}` |
| publish | root, file, expectedIdentity, `{fileId,exclusive:true,noFollow:true}` | `{identity,fileId,exclusive:true,temporaryRemoved:true}` |
| fsyncParent | root | void |
| closeFile | root, file | void |
| closeRoot | root | void |

Observation의 기존 닫힌 필드는 TS 타입과 같다. 공통 inspection은 `{identity:{device,inode},kind,symlink,uid,gid,mode}`이고, root에는 `availableBytes,availableInodes`, file에는 `bytes`만 추가한다. device/inode는 실제 stat의 정규 10진 문자열, mode는 실제 permission의 3자리 8진 문자열이다. 부모는 신뢰 anchor부터 root 직전까지의 실제 관측 목록이다. expected binding을 실제 관측치 대신 복사해 VERIFIED로 만들지 않는다. generation은 native가 발급하며 안전 정수 범위 안에서 유지한다.

## 2. 유한 입력·작업 범위

아래 값은 native 자원 방어를 위한 **내부 구현 상한 후보**다. 프로젝트의 TARGET8/key32/wrapping32·intent 수명·키 수명 등 기존 제품 수치를 바꾸지 않는다. Main 구조 검토로 고정한 뒤 구현하며 자동 증액은 없다.

- snapshot 전체 slot 최대64, installation/slot/profile UUID는 기존 형식, hash는 소문자 SHA256 64자, 정수는 JS 안전 정수 범위. identity는 선행 0 없는 unsigned 10진 문자열(0만 예외), 최대20자리.
- absoluteRoot UTF-8 최대4095바이트, 구성 성분 최대256·성분당255바이트. 절대 경로만, 빈 중간 성분/dot/dotdot/NUL·심볼릭 링크 금지. 루트 `/` 자체는 슬롯으로 허용하지 않는다.
- fileId는 서버 UUID 단일 성분, create bytes 1~16384, read maxBytes 1~16385. Probe 1KiB 제한은 기존 store가 추가로 지킨다. byte 배열은 큐 투입 전에 복사한다.
- 하나의 로드된 addon에서 진행/대기 async work 합계 최대32, 실제 root 소유·예약 최대64, 열린 file 및 생성/열기 예약 합계 최대256. libuv 대기까지 상한에 포함하며 별도 무한 작업 큐·자동 재시도는 없다. 초과는 작업 생성 전에 거절한다.
- 부모 FD 수는 슬롯의 경로 깊이 안에서 제한한다. 배열/FD·reference 할당 실패는 얻은 자기 자원만 회수하고 더 진행하지 않는다. 실제 최장 syscall 시간을 강제로 보증하는 수치는 만들지 않는다.

## 3. Native 소유·비동기 수명

C Node-API8의 type-tag와 private registry로 port/root/file을 결박한다. capability에는 raw FD를 JS 숫자로 노출하지 않는다. 위조 object·다른 port/root의 file·닫힌 세대는 거절한다. 같은 실제 dev/ino root는 하나의 로드된 addon의 프로세스 registry에서 별도 slot 또는 다른 port 인스턴스에 이중 소유되지 않는다. 보호된 단일 artifact 로더가 아직 없으므로 다른 바이너리 사본까지 전역 통제했다고 주장하지 않는다.

`napi_async_work`의 execute에서 blocking syscall을 수행하고 complete에서 Promise 결과와 JS 값을 만든다. worker에서 Node-API의 JS 조작 함수를 호출하지 않는다. 각 work는 필요한 port/root/file/native buffer를 소유하고, JS 인수 reference와 내부 reference count는 complete까지 유지한다. root별 FIFO에서 하나의 async work만 예약하고 complete 후 다음 작업을 예약한다. worker가 다른 worker의 완료나 root mutex를 잡고 close를 기다리지 않는다. 프로세스 소유권 표의 짧은 mutex 외에 blocking wait를 넣지 않는다. admission cap은 FIFO 대기 work도 포함한다.

remove와 publish는 같은 file의 상호 배타적 terminal mutation이다. close도 시작 전 단발 표식을 고정한다. 진행 work가 끝나기 전 FD를 닫거나 재사용하지 않는다. closeFile은 자기 진행 work를 기다린 뒤 OS close를 한 번만 수행하고 같은 capability의 반복 close는 같은 완료 상태/Promise를 돌려준다. closeRoot는 아직 열린 file이 있으면 거절하고, 준비된 정상 경로에서는 관리 adapter가 file을 먼저 닫은 후 호출한다. 닫힘 불명은 숫자 FD로 재시도하지 않는다. 파일 작업 효과 UNKNOWN과 FD close 결과 UNKNOWN은 별도 상태이며, 작업이 거절되거나 파일 효과가 불명이어도 모든 자기 FD의 close 성공은 별도로 확정할 수 있다. root 소유권 tombstone은 실제 FD 회수 불명에만 결박한다. close를 받아들인 capability는 CLOSING으로 먼저 바꾸어 신규 작업을 거절하고 이미 받은 work만 drain한다. process root registry의 소유권은 해당 root/file/조상 FD의 회수가 모두 확정된 뒤에만 해제한다. close 불명인 항목은 tombstone으로 남겨 프로세스가 살아 있는 동안 다른 port의 재소유를 허용하지 않는다.

GC finalizer는 자기 native reference를 줄이는 역할이며 live work의 FD를 즉시 해제하지 않는다. GC만 된 열린 cap의 FD는 명시 close 또는 환경 종료까지 보존한다. FD/예약 한도는 확정 close 때 한 번 반납한다. 닫힌 wrapper 보관 수나 과거 조회 총횟수에 적용하지 않는다. 실제 FD 회수 불명의 예약과 root tombstone은 반납하지 않는다. 닫힌 record 자체는 wrapper GC 뒤 prune에서 회수한다. port에는 FD가 없으므로 wrapper 보관 수의 전역 64 제한은 두지 않으며, snapshot당 slots64는 그대로 유지한다. 환경 종료 async cleanup hook은 신규 admission을 차단한다. 이미 받은 유한 FIFO 작업은 취소했다고 가장하지 않고 완료까지 drain하며, teardown complete에서는 JS 값/Promise를 만들거나 resolve하지 않는다. drain 뒤 미리 생성한 cleanup async work가 자기 FD만 단발 회수한다. 종료 hook을 remove한 뒤에도 wrapper finalizer의 참조가 끝날 때까지 C 상태를 유지한다. 파일 삭제·게시 성공·DB 확정을 하지 않는다. 정상 앱 종료는 기존 store.dispose→관리 adapter.dispose의 명시 경로를 우선한다. 관리 adapter도 확정 file close 뒤 Map과 native cap 참조를 해제하고, 닫힌 public handle과 같은 close Promise는 유지한다. 회수 실패는 참조와 실패 결과를 보존하며 실제 root close 확정 뒤에만 root cap을 해제한다.

C heap은 Env·Port와 slots·Root·File·Work 및 복사 bytes의 실제 sizeof/길이를 `napi_adjust_external_memory`로 등록하고 정확 free 때 대응량을 한 번 차감한다. JS ArrayBuffer 등 Node가 관리하는 메모리는 중복 등록하지 않는다. 반환된 런타임 합계는 자체 사용량으로 해석하지 않으며 별도 ledger로 과차감을 막는다. accounting 오류는 신규 작업을 fail-closed 처리한다. worker는 이 API를 호출하지 않고 env 스레드/finalizer에서 계산한다. finalizer가 env 없이 VM 파기 중 호출되면 무효 env API를 부르지 않고 C ledger/할당만 회수한다. GC 재진입 중 같은 record를 이중 해제하지 않도록 prune을 보호한다. 외부 메모리 등록은 GC 힌트이며 강제 GC·고정 C 메모리 상한·즉시 회수 보장이 아니다. 닫힌 cap을 JS가 계속 보유해도 실제 열린 FD 예약을 소진하지 않는 의미를 native 300회 file/65회 root 반복 시험으로 검증할 예정이다.

신규 root/file syscall 성공 뒤 JS capability/결과 생성에 실패하면 원 결과는 UNKNOWN으로 남기고, admission 때 미리 준비한 회수 async work가 해당 작업의 정확 자기 FD만 닫는다. 원 work/root/file/버퍼는 회수 complete까지 유지한다. CLOSE의 queue 거절도 execute 미실행을 확인한 동일 회수 경로를 따른다. CLOSE의 Promise/async-work 준비 자체가 실패해도 이미 확보한 Work를 root FIFO에 남기고 CLOSING으로 고정한다. Promise가 없어도 선접수 작업 drain이 끝난 FIFO head에서만 회수를 수행한다. 회수 queue 자체가 실패하면 그 FIFO head의 최후 경로로 해당 자기 FD의 OS close만 event loop에서 한 번 호출한다. 이 예외는 fsync/read/write/unlink를 수행하지 않으며, close의 시간 상한을 새로 보증하지 않는다. close 결과가 불명이면 재시도 없이 tombstone을 남긴다. 이 희귀 실패 경로의 실제 주입 검증은 NOT_RUN이다.

## 4. 파일 연산과 실패 창

- root는 `/`의 신뢰 directory FD에서 각 성분을 `openat(O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC)`로 연다. 각 부모의 fstat와 이름 연결을 확인하고 root의 actual dev/ino·owner/gid/mode·mount·statvfs 용량을 대조한다. 원 계약의 service 전용 owner/0700·부모 보호/정상 writer 분리 설치 근거가 미확인이면 실제 사용 승격을 하지 않는다.
- create/open/stat/read/sync/remove/publish의 전후에 root·부모와 관련 file의 held FD/current name 관계를 재검사한다. 반환 바이트는 길이 제한 및 파일 정체성을 확인한 독립 복사본이다. root와 file 관측은 fstat 등 실제 OS 결과이며 외부 bool 하나로 통과하지 않는다.
- 기존 파일 open은 O_NONBLOCK도 지정해 FIFO writer 대기 전에 held FD 종류를 검사하고 일반 파일이 아니면 거절한다. 시험의 FIFO fixture는 Main 실행안 아래 기존 `/usr/bin/python3 -I`의 `os.mkfifo`로 정확 QA 경로 한 개에만 생성하며, 제품 API나 외부 실행 포트로 노출하지 않는다.
- create는 `openat(O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600)` 뒤 실제 mode 확인, 부분 write/EINTR 처리, 길이 상한을 따른다. umask를 전역 변경하거나 chmod로 결과를 맞추지 않는다. 자기 cap을 반환하지 못한 실패는 확보한 FD만 닫고 미확정 이름은 보존한다.
- publish는 열린 source FD에서 `/proc/self/fd/<fd>`를 대상으로 `linkat(...,AT_SYMLINK_FOLLOW)`하여 final UUID를 배타 생성한다. 실제 procfs와 source FD identity를 대조하고 AT_EMPTY_PATH용 capability를 요구하지 않는다. final identity를 source inode와 대조한 후 자기 tmp 이름의 귀속을 확인해 제거한다. final 선점은 overwrite하지 않는다. final link와 tmp 정리가 모두 확인돼야 resolve한다. 이후 부모 fsync/파일 close는 기존 store가 확인한다.
- remove는 열린 생성소유 tmp만 대상으로 한다. 기존 open으로 읽은 파일·게시 final·타 root/identity·교체된 이름은 삭제하지 않는다. 이름과 identity 검사 뒤 unlinkat 사이에는 원자적 expected-inode 조건이 없다는 한계가 남는다. Native·mutex만으로 OS 전체 경쟁 방어를 입증하지 않으며 원 계약의 설치 전제와 검증 범위를 대조한다. 새로운 악성 OS/root 공격 방어를 완료조건으로 추가하지도 않는다.
- 부분 create는 파일이 남을 수 있다. 부분 publish는 tmp와 final 두 이름이 남을 수 있다. parent fsync/close 불명은 내구성 성공이 아니다. native는 불명 뒤 mutation을 재실행하거나 자동 unlink하지 않고 자기 FD만 회수한다. adapter는 파일 효과의 불명을 기존 RESOURCE_STATE_UNKNOWN503/intent UNKNOWN·사용 차단으로 처리한다. 파일과 DB transaction을 합쳤다고 하지 않는다.

## 5. 고정 오류

Native 오류는 `Error`의 message와 `code`가 동일한 닫힌 코드만 사용한다: `INPUT_INVALID`, `RESOURCE_UNVERIFIED`, `RESOURCE_PROCESSING`, `RESOURCE_LIMIT`, `RESOURCE_STATE_UNKNOWN`. cause·errno·absoluteRoot·file bytes·원 시스템 메시지를 넣지 않는다. JS stack에는 native가 입력 내용을 삽입하지 않는다. 현재 TS adapter는 native 호출의 거절을 새 고정 UNKNOWN 오류로 정규화하며 raw 객체를 재사용하지 않는다.

인수/소유/지원 검사 거절과 syscall 효과 불명은 native 내부에서 구분한다. 실패 후 기록이 확정되지 않으면 성공 observation을 만들지 않는다. 일반 rename/copy/삭제 fallback은 없다.

## 6. 빌드 구조와 후속 실행 결박

예정 `binding.gyp` target 이름은 `fn16_posix_safe_handle`, source는 `addon.c` 하나, `NAPI_VERSION=8`, `_GNU_SOURCE`, C11·PIC·pthread·일반 compiler warning을 명시한다. V8/private Node API·C++ wrapper 의존 패키지는 사용하지 않는다. install/postinstall이나 자동 node-gyp/헤더 다운로드를 추가하지 않는다.

첫 검증 후보는 Linux x64, kernel>=4.18, glibc>=2.28, 기존 package 범위 Node>=24.18.0<25, Node-API8, local ext4와 procfs다. exact Node/compiler/header·binary path/hash는 Main이 기존 설치를 대조한 별도 실행안에서 고정한다. Node24.22.1 관측을 새 설치 요구로 해석하지 않는다. 지원표/기존 도구 존재는 이 addon의 compile/load/FS PASS가 아니다.

후속 실행안은 source commit·addon.c/binding.gyp hash, 기존 compiler/header 신원, 정확 flags와 output, binary SHA256, runtime/FS/owner·QA 수명·정리와 중단 조건을 묶는다. 통합시험의 require는 exact QA binary hash를 확인한 뒤 한 파일만 로드한다. 제품 로더의 보호 신원·실제 catalog 공급은 별도 미완료다.

## 7. 통합시험 실행 경계

`tests/integration/FN16/installation-resource-posix-native.test.ts`는 실제 native syscall 시험 소스다. 최초 후보 QA root literal은 `/home/daon/anvil-v3-fn16-native-qa-20261029-01`이며 **아직 등록/생성/실행하지 않았다**. Main의 실행안과 다르면 두 파일의 literal을 검토해 함께 변경하고 hash를 다시 고정한다.

실행은 `ANVIL_FN16_NATIVE_QA_ROOT`가 위 literal과 정확히 같고, 그 root의 `execution-manifest.json`이 다음 닫힌 값들을 갖출 때만 가능하다: schemaVersion1, purpose=`FN16_NATIVE_ISOLATED_QA`, rootIdentity, ownerUid, ownerGid, expiresAt, binarySha256, addonSourceSha256, bindingSourceSha256. 이 파일은 승인 자체가 아니라 실행안의 관측 결박이다. root와 manifest는 해당 사용자 소유·0700/0600, binary는 그 root의 `build/fn16_posix_safe_handle.node` 고정 경로다. root/manifest/binary의 링크·identity/hash를 대조한다. env/manifest가 없으면 실패하며 skip PASS를 만들지 않는다.

시험은 새 `cases` 하위만 만들고 공개 합성 바이트를 사용한다. 자신의 새 fixture 외 파일은 수정하지 않는다. 시험 자체는 recursive delete를 하지 않고 자기 capability만 닫으며, Main이 실행안에 따라 정확 잔여물을 독립 확인·정리한다. 실패 시 fixture를 보존한다.

직접 관측 범위: 정상 probe/불변 게시/실제 inode·바이트/기존 조회, final 선점·타 port/root/위조/닫힌 capability, symlink·부모 경로 교체·현재 이름 교체 거절/기존 파일 보존, 관리 adapter dispose 전후 `/proc/self/fd`에서 해당 QA root에 귀속된 FD 존재/잔여0, 직접 native close의 선접수 read drain·신규 작업 차단·동일 close Promise, 중간 부모 rename 후 생성 거절을 관측한다. FD 관측은 해당 경로의 열린 handle에 한하며 프로세스 전체 FD 무누수 보장으로 확대하지 않는다. 입력 snapshot·bounded read도 해당 흐름에서 검사한다.

**현재 NOT_RUN:** 모든 native 실행. 특히 link 성공 직후 unlink/fsync/close를 강제로 실패시키는 deterministic fault injection, 전원손실·임의 순간 경쟁의 완전 방어는 아래 시험만으로 증명하지 않는다. 별도 승인되지 않은 native fault API나 특권 도구를 추가하지 않는다. 사전 이름 교체 반례를 원자적 unlink 경합 검증으로 바꾸어 보고하지 않는다. 합성 adapter에서 통과한 partial/UNKNOWN 반례와 실제 OS 관측은 별도 기록한다.

## 8. 명시적 단일 compiler 명령 후보

아래 명령은 실행하지 않았다. Main 실행안이 source checkout·header/tool 신원·output 부재·QA 만료를 먼저 결박한 뒤 사용한다. `QA`는 §7 고정 경로이며 output 외 프로젝트 파일을 쓰지 않는다. npm install/node-gyp/header 다운로드는 없다.

```sh
/usr/bin/x86_64-linux-gnu-gcc-13 -std=c11 -O2 -fPIC -shared -Wall -Wextra -Wpedantic -pthread -DNAPI_VERSION=8 -D_GNU_SOURCE -I/opt/node-v24.22.1-linux-x64/include/node native/fn16-posix-safe-handle/addon.c -lm -o /home/daon/anvil-v3-fn16-native-qa-20261029-01/build/fn16_posix_safe_handle.node
```

Linux Node가 제공하는 Node-API symbols를 로드 시 해석한다. 기존 header와 동일 Node 범위에서만 검증하며 binary hash는 실행 manifest에 기록한다. 이 명령 표기는 컴파일 승인/성공 증거가 아니다.

수명 보완 기준: `docs/work_packages/FN16_NATIVE_HANDLE_RETENTION_CORRECTION_20261029.md` SHA256 `B09AED75F26625630BC658458E74EC52784825C1B2F559CA71A8AAB44CF046DB`. 별도 공개 API·정책 수치·실제 catalog 변경은 없다. [Node 24 공식 Node-API 문서](https://raw.githubusercontent.com/nodejs/node/v24.22.1/doc/api/n-api.md#napi_adjust_external_memory)의 external-memory 의미와 basic-env finalizer 허용 범위를 따른다. 현재 반복 native 시험·accounting 실패 주입은 NOT_RUN이다.
