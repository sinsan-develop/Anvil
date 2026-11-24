# FN08 Windows 보호 설치 정착·재시작 판독 Source WorkInstruction

- 문서 상태: `SOURCE_WORK_INSTRUCTION_DRAFT_FOR_MAIN_REVIEW`
- 작성 기준: 2026-11-24
- 기준 commit: `f930a8a225897d329da4778c0686c71769d10d54`
- 목적: 기존 FN08 보호 설치의 같은 등록·root·한도·키·ACL·수명 안에서 설치 정착 사실과 프로세스 중단·재시작 판독을 source·합성 수준으로 구체화한다.
- 비목적: 실제 Windows 동작 입증, 장치 전원 상실 보장, 과거 요청 성공 복구, 새 실행 권위 발급, `RequireDurability` 개방

## 1. 기준 소스와 고정 지문

| 대상 | SHA-256 | 이번 문서에서의 역할 |
|---|---|---|
| `apps/connector/native/NativeWorkerInstallationRootSource.cs` | `1454AF53CD835B75CB76A0F298FC39E18EE7006858005FDB89818DB04765981B` | 고정 KnownFolder root, SID·ACL·non-link·root identity와 원 handle 수명 |
| `apps/connector/native/NativeWorkerInstallationStoreSource.cs` | `AA947282BABB8A135E48AE735C31A48FEDEE1EE8F111FED7D0E43E7CC87758A7` | `installations.v1`/`.previous`/`.next`/`.lock`, worker write·readback, CAS, UNKNOWN, 8 MiB/512 revision 한도 |
| `apps/connector/native/NativePreparationJournalKernel.cs` | `0384EBE7AA96D35845CF8086E8DB54BCE74EF59E6F1AF12F1E72CC57DF419B32` | 삭제하지 않는 고정 marker와 append-only 상태 체인의 참고 패턴. 설치 권위·예산으로 재사용하지 않음 |
| `apps/connector/native/NormalExecutionSpoolProfileSource.cs` | `0582707D2680D80F638377E29BB88247FE25D06CC6AEC6C86F8F5C1A63BAD813` | 별도 preparation 예약·정산의 참고 패턴. 설치 metadata 예산이나 권위로 전용하지 않음 |
| `docs/work_packages/FN08_WORKER_DEPLOYMENT_HANDOFF_SOURCE_IMPLEMENTATION_20261114.md` | `608FF04741370B69D3098333747257D147330CE3D670CB581D94554CA1F56486` | 기존 FN08 설치 계약과 source-only/실제 OS 미검증 경계 |

기준 소스에서 `WindowsNativeWorkerInstallationKernel.RequireDurability()`는 항상 `NATIVE_WORKER_INSTALLATION_UNSUPPORTED`를 발생시킨다. 본 작업은 이 guard를 열지 않는다. 작성할 source가 있어도 실제 지원·설치·재시작 복구가 활성화됐다고 표시하지 않는다.

## 2. 현재 결손과 판정

현재 `Release()`는 다음 순서를 사용한다.

1. 최신 `INSTALLED` revision, worker identity·hash·bytes, root와 `installations.v1`을 재검산한다.
2. 원 `.lock` handle을 닫고 close 결과를 확인한다.
3. 같은 lock identity를 다시 열어 delete-by-handle로 삭제한다.
4. root metadata를 정착하고 `.lock` 부재를 확인한다.

이 경로는 한 프로세스 안의 정상 반환에는 유용하지만, 삭제된 lock은 재시작 후의 지속 근거가 아니다. 특히 다음 두 crash는 동일한 디스크 상태를 만들 수 있다.

- 마지막 close·root 정착을 마치고 호출자에게 응답하기 직전 crash
- 호출자가 응답을 받은 직후 crash

따라서 marker가 있어도 다음 두 축을 합치지 않는다.

| 축 | 재시작 후 가능한 판정 | 금지되는 승격 |
|---|---|---|
| artifact 정착 사실 | 같은 보호 root에서 exact container·descriptor·worker bytes·file identity와 지속 marker를 현재 다시 검산하면 `ARTIFACT_SETTLED_CURRENTLY_VERIFIED` 후보 | 과거 요청 성공, 과거 caller 응답 수신, 실행 허가, 소유권 복구 |
| 과거 요청 결과 | 기존 원장에 기록된 상태를 그대로 유지하며 close/응답 경계가 불명하면 `UNKNOWN` | marker만으로 `SUCCESS`, replay 완료 또는 one-shot 재사용 |

old lease의 시간 만료만으로 소유 해제를 확정하지 않는다. 현재 host가 보호 root·identity를 다시 검산하고, 원 lock/marker에 대한 OS handle 신원과 동시 writer 배제를 확보해야 한다.

## 3. 후보 비교와 권장안

### 3.1 후보 A — 삭제하지 않는 고정 정착 marker와 현재 OS 배타 검산

권장안이다. 기존 `.lock`을 성공 시 삭제되는 일회 파일로 쓰지 않고, 같은 설치 namespace와 기존 8 MiB metadata 예산 안의 고정 정착 marker로 유지한다. marker는 다음 역할만 가진다.

- OS 배타 handle을 가진 현재 writer의 단일성 확인
- exact root/SID/marker identity와 bounded append-only 상태 체인 보존
- `installations.v1`의 정착된 container hash 및 해당 `INSTALLED` row/worker 사실 결박
- 새 host가 marker를 배타적으로 열고 동일 facts를 read-only로 재검산할 시작점 제공

marker의 최소 canonical row는 아래 닫힌 필드만 허용한다.

```text
schemaVersion
purpose = NATIVE_WORKER_INSTALLATION_SETTLEMENT_V1
sid
rootIdentity
sequence
previousHash
attemptId
state = ACTIVE | INSTALLATION_SETTLED
baseContainerHash
installedContainerHash
installationRef
normalBindingRef
descriptorRef
workerHash
workerBytes
workerFileIdentity
workerDirectoryIdentity
markerFileIdentity
```

규칙:

- `ACTIVE`는 효과 전의 exact base container와 marker identity를 기록한다.
- 두 state는 위 필드 집합을 똑같이 사용한다. `ACTIVE`의 `installedContainerHash`·installation/binding/descriptor/worker 필드는 canonical `null`이다. `baseContainerHash=null`은 기존 current/previous가 모두 없음을 검산한 첫 설치에서만 허용하며, 그 밖의 `ACTIVE`에서는 non-null exact current hash여야 한다. `INSTALLATION_SETTLED`는 같은 `attemptId`의 `ACTIVE.baseContainerHash`를 exact 승계한다. final에서는 일반 설치의 `normalBindingRef`와 위 검산된 첫 설치의 `baseContainerHash`만 `null`일 수 있고 나머지는 모두 non-null exact 값이어야 한다.
- `INSTALLATION_SETTLED`는 worker write·flush·readback, `INSTALLED` CAS, container/previous readback, worker/root metadata 정착이 모두 끝난 뒤 같은 `attemptId`로 기록한다.
- marker는 registration/package/build/head 원문을 복제하지 않는다. `installedContainerHash`로 exact canonical container를 고정하고, `installationRef`의 id/version/contentHash로 그 container 안의 유일한 `INSTALLED` row를 찾는다. 이어 row의 `factoryRef`·`descriptorRef`·`rootId`·`workerHash`·`bytes`·`headRef`·`bundle`·`fileIdentity`·시간을 모두 검산한다. `bundle`에서는 원 `packageRecord.ref`, `buildReceipt.ref`, descriptor의 package/build/factory/root/worker 결박을 설치 당시와 같은 canonical hash·교차 참조 규칙으로 다시 검산하되, 과거 source TTL이나 외부 current 조회를 재요구하지 않는다. normal 설치는 `normalBindingRef`로 같은 container의 exact `NORMAL_START_WORKER_INSTALLATION_BINDING_V1` row를 찾고 registration scope/package ref·installationRef를 재검산한다. 해당 binding이 없는 일반 설치에는 registration을 추정하지 않는다.
- `workerDirectoryIdentity`는 descriptor content hash로 계산한 고정 directory의 actual identity다. marker의 worker file identity만 맞거나 filename+worker hash만 같은 경우에는 정착 판독을 거절한다.
- `INSTALLATION_SETTLED`는 과거 lock close나 caller 응답을 뜻하지 않는다. `CLOSED`, `DELIVERED`, `SUCCESS` 같은 상태명을 추가하지 않는다.
- marker 체인은 canonical bytes·DPAPI 보호·SHA-256 previous chain·strict UTF-8·exact field set으로 검산한다. marker row는 설치 원장의 512 revision을 다시 소비하지 않는다. 물리 marker bytes는 container/previous/next와 함께 기존 8 MiB metadata 총량에 합산한다. marker attempt 수는 설치 원장의 기존 최대 이력 512를 넘지 않고, attempt당 `ACTIVE`와 final row 두 개만 허용한다. 첫 `ACTIVE` write 전에 두 row의 최대 canonical/cipher bytes와 기존 64 KiB 여유를 함께 admission하여 후행 final 정착분까지 예약 계산한다. 실패로 `ACTIVE`만 남으면 실제 소비 bytes는 보존되며 다음 명시 attempt가 전체 한도와 최대 이력을 다시 계산한다.
- marker가 이미 있으면 삭제·덮어쓰기·새로 생성하지 않는다. 현재 root/SID/identity, 닫힌 체인, 마지막 state, container/worker facts를 모두 검산하고 share 0의 exact handle을 획득한 경우에만 현재 관측을 계속한다.
- `ACTIVE`로 끝나거나 partial line/cipher, sequence/hash/identity 불일치, size 초과, close 불명, 다른 writer 충돌이면 `UNKNOWN`이며 자동 삭제·재설치·새 claim은 0이다.

### 3.2 후보 B — 정착 파일만으로 권위를 복구하는 read-only 판독

단독 해법으로 채택하지 않는다. `installations.v1`과 worker file이 존재하고 hash가 맞더라도 같은 principal이 파일을 교체·재작성했는지, 과거 owner가 close와 응답을 마쳤는지를 그 사실만으로 증명할 수 없다.

허용되는 B의 범위는 A의 recovery reader다. 새 host는 다음을 모두 확인해야 artifact 정착 사실만 반환할 수 있다.

- 기존 고정 KnownFolder root, 현재 SID/SYSTEM ACL, non-link와 exact root identity
- 고정 marker의 actual file identity, strict chain과 마지막 `INSTALLATION_SETTLED`
- marker를 share 0으로 연 현재 OS handle과 같은 identity의 재관측
- `installations.v1`/`.previous`의 exact canonical chain과 marker의 container hash
- descriptor ref, worker hash·bytes·file identity 및 worker file readback
- `.next` 부재와 current container/head의 재검산

이 판독은 artifact의 현재 정합성만 반환한다. marker로 과거 permission·registration·one-shot·owner·caller response를 복원하지 않는다. 새 효과는 기존 경로의 fresh registration/purpose/generation, current authority/head, current lock, capacity와 one-shot 조건을 다시 통과해야 한다.

## 4. crashpoint 분류

| crashpoint | 지속 관측 후보 | 재시작 판정과 조치 |
|---|---|---|
| marker 최초 생성 전 | 기존 container/worker만 | 이번 attempt 증거 없음. 과거 요청을 성공으로 만들지 않는다. 새 명시 호출은 기존 fresh 조건 전체를 통과해야 한다. |
| marker create 중, 빈/부분 write, 첫 flush/readback 불명 | marker 존재·불완전 | `UNKNOWN`; 보존. 자동 truncate/delete/recreate/reinstall 0 |
| `ACTIVE` 정착 후, RESERVED append 전/중 | valid `ACTIVE` | `UNKNOWN`; 다른 writer 효과 0 |
| `.next` write/flush 또는 CAS·`.previous` 전환 중 | `ACTIVE`, `.next`/current/previous 조합 | exact 허용 조합 외 모두 `UNKNOWN`; 파일 이동·rollback 자동 실행 0 |
| worker file 생성·flush/readback 후, `INSTALLED` 전 | `ACTIVE`와 orphan worker 후보 | `UNKNOWN`; worker 삭제·채택·재설치 0 |
| `INSTALLED` container commit 후, marker final 전 | valid container와 `ACTIVE` | artifact가 존재해도 attempt 결과는 `UNKNOWN`; 실행/권위/자동 finalization 0 |
| `INSTALLATION_SETTLED` write·flush·readback 중 | partial 또는 불명 marker | `UNKNOWN`; container만으로 final state를 추정하지 않음 |
| marker final readback 후, 원 handle close 전/중 | exact final marker, 원 process 생존 여부 불명 | 새 host는 share 0 exact open 성공 전 아무것도 확정하지 않음. old request는 `UNKNOWN` |
| 원 handle close 후, 응답 직전 또는 직후 | 동일한 exact final marker·artifact | artifact 정착 사실만 current read로 검증. 두 crash를 구분하지 않으며 old request는 `UNKNOWN` |
| 새 host 판독과 다른 writer 동시 진입 | share/identity/current head 충돌 | 한 host만 exact 배타 handle을 가질 수 있어야 함. 실패·identity drift는 `UNKNOWN` |

## 5. Win32 primitive와 보장 한계

source 후보는 기존 private ACL과 handle 소유 모델 안에서 다음 primitive만 사용한다.

1. [`CreateFileW`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew)
   - 최초 marker writer는 현재 `CreatePrivateFileW`와 같은 access `0xC0000000`(`GENERIC_READ | GENERIC_WRITE`), share `0`, `CREATE_NEW`, flags `0x80200080`(`WRITE_THROUGH | OPEN_REPARSE_POINT | NORMAL`)와 non-inheritable private security descriptor를 사용한다. 이후 새 effect writer도 existing exact marker에 같은 access/share/flags를 사용하되 security descriptor를 다시 발급하지 않는다.
   - 재시작 read-only 판독은 existing exact marker에 최소 access `0x80000000`(`GENERIC_READ`), share `0`, flags `0x00200080`(`OPEN_REPARSE_POINT | NORMAL`)을 사용한다. 쓰기 권한을 요구하지 않으면서도 다른 reader/writer와 같은 동시 배제를 가져야 하며, 이 handle로 marker를 수정하지 않는다.
   - 기존 일반 read helper는 share `1`, 기존 delete/removal open은 access `0x80010000`·share `0`·flags `0x00200080`, parent directory 관측은 access `0x40000000`·share `7`·flags `0x02200000`이다. marker writer/read-only handle과 서로 바꿔 쓰지 않는다.
   - reparse를 따라가지 않는 기존 flag와 기존 SID/SYSTEM private descriptor 유지
   - open 전후 path·kind·link count·actual file identity·root identity 재검산
2. 기존 synchronous `WriteFile`/정확 길이·offset 제어
3. [`FlushFileBuffers`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)
   - marker, container, worker의 지정 file handle에서 buffered data 처리를 요청한다.
   - flush 후 같은 handle에서 exact bytes·length·identity readback
4. 기존 parent directory handle의 전후 identity 검산과 기존 정착 시도
5. original handle close 결과를 같은 프로세스에서만 관측하고, close 불명은 영구 `UNKNOWN`으로 보존

`FILE_FLAG_WRITE_THROUGH`의 근거는 이를 실제 사용한 `0x80200080` writer 요청과 그 요청에서 변경된 NTFS metadata에 한정한다. read/removal/directory handle에는 이 flag가 없으므로 같은 보장을 이월하지 않는다. `FlushFileBuffers`는 지정 file handle의 buffered data 처리 근거이며 일반 parent directory, rename/replace 순서 또는 namespace 전체의 durability 보장이 아니다. 현재 directory handle flush 시도와 `File.Move`/`File.Replace` 이후 정착은 source 후보일 뿐 실제 보장이 미검증이다. 하드웨어·장치 전원 상실 전체도 보장하지 않는다. volume 전체 flush에는 별도 volume handle과 권한이 필요하므로 이번 범위에서 사용·가정하지 않는다.

## 6. 기존 계약 보존

### 6.1 v1 container·reader·rollback

- `installations.v1`, `.previous`, worker descriptor/bytes/ref, 기존 revision 1 `RESERVED`와 revision 2 `INSTALLED` canonical bytes·hash는 변경하지 않는다.
- settlement marker는 sidecar facts이며 기존 row/ref hash에 포함하지 않는다.
- 기존 `ReadInstalled`의 exact bundle/head/worker identity 검산을 완화하지 않는다.
- marker를 모르는 구버전으로 code rollback하면 `.lock`을 held하지 않은 상태에서 기존 root entry 검사가 거절하므로 현 guard대로 fail closed한다. 이는 의도한 지원 제한이며 marker를 자동 삭제해 구버전 설치를 재개하지 않는다.
- rollback은 source 역적용이지 지속 artifact 삭제가 아니다. 데이터 정리·마이그레이션·재설치는 별도 승인 대상이다.

### 6.2 quota·소유·현재성

- marker 물리 bytes와 후행 final 정착 여유는 기존 installation metadata 8 MiB 계산에 포함한다. marker row를 설치 원장의 512 revision으로 이중 산정하지 않으며, marker attempt 수만 기존 최대 이력 512로 별도 유계화한다.
- package 64개, total worker 1 GiB, single worker 20 MiB 한도는 유지한다.
- 새 worker owner, 등록, purpose, generation, current descriptor/head, one-shot 소비와 기존 기한은 매 새 효과 전에 기존 경로에서 다시 검산한다.
- marker의 `attemptId`·상태·file identity는 metadata이며 approval·authority token이 아니다.
- old lease expiry, old command의 동일 hash, marker final state 중 어느 하나도 새 write 권한이 아니다.

### 6.3 UNKNOWN과 정리

- `UNKNOWN` 또는 recovery mismatch에서는 marker, `.next`, `.previous`, container, worker를 자동 삭제·이동·완성하지 않는다.
- 동일 old command 재조회는 기존 불변 이력과 artifact 관측만 반환하며 새 effect를 수행하지 않는다.
- 새 명시 호출만 fresh 등록·purpose·generation·current lock·capacity·one-shot 조건을 거쳐 별도의 attempt를 시작할 수 있다.
- close 실패·identity drift·다른 writer 관측은 성공으로 재분류하지 않고 host-local sticky unknown과 지속 facts를 함께 보존한다.

## 7. 허용 source 단위와 구현 순서

이 WorkInstruction 채택 후에도 별도 writer 지시가 있어야 source를 수정한다. 권장 exact 범위는 다음 두 제품 경로와 기존 시험 두 경로 이내다.

```text
apps/connector/native/NativeWorkerInstallationStoreSource.cs
apps/connector/native/NativeWorkerInstallationRootSource.cs   # 기존 root API가 부족한 경우에만
tests/unit/FN06/native-worker-installation-native.test.ts
tests/desktop/native-worker-installation.test.cjs              # pure RAM crash matrix가 필요한 경우에만
```

### 7.1 현재 protected read 진입점과 연결 gate

현재 제품에는 Windows restart settlement를 읽는 offline shadow 경로가 없다.

- `apps/connector/native/NativeWorkerDeploymentSource.cs`의 `Read(...)`는 `store.ReadInstalled(...)`보다 먼저 `storage.RequireDurability()`를 호출한다.
- 같은 파일의 `WithNormalImageForPreparation(...)`과 `AcquireNormalImageForPreparation(...)`도 `store.ReadNormalBinding(...)`보다 먼저 `storage.RequireDurability()`를 호출한다.
- `apps/connector/native/NativeWorkerInstallationStoreSource.cs`의 `ReadInstalled(...)`와 `ReadNormalBinding(...)`은 `Open(false)`로 들어가며, Windows kernel의 `Open(bool create)` 첫 문장이 다시 `RequireDurability()`다.

따라서 현재 실제 호출선에서 classifier는 도달할 수 없고 기본 결과는 계속 `NATIVE_WORKER_INSTALLATION_UNSUPPORTED`다. 이번 WI는 outer gate 앞에서 filesystem read를 실행하도록 호출 순서를 바꾸지 않는다. 그런 변경은 default unsupported 경로에 새 OS read를 추가하므로 별도 exact source revision과 검수가 필요하다.

현재 허용되는 offline shadow는 `tests/desktop/native-worker-installation.test.cjs`의 pure RAM crash matrix뿐이다. 이 시험은 `TEST_ONLY_RESTART_SETTLEMENT_SHADOW` 계약으로 marker/container/worker facts를 메모리에서 분류하며 제품 helper·권위·실제 판독이 아니다. 실제 protected caller가 정해지지 않은 상태에서는 `NativeWorkerInstallationStoreSource.cs`에 도달 불가능한 parser/classifier helper를 추가하지 않는다.

향후 실제 source 연결을 허용할 때는 Task 1~3을 하나의 검수 단위로 묶는다. 제안된 private/internal 호출 모양은 `NativeWorkerInstallationStoreSource.InspectRestartSettlementSourceOnly(...)` → Windows kernel의 최소 read-only open/classifier이며, 호출자는 `NativeWorkerDeploymentSource.cs`의 목적 분리된 management read여야 한다. 이 이름·모양은 후보이고 현재 제품에 생성하지 않는다. 실제 caller는 기존 `Read`/normal preparation의 실행·image 반환 경로와 분리되어야 하며, artifact 관측만 반환하고 기존 `RequireDurability`·실행·설치 gate를 통과시키지 않아야 한다. 해당 caller와 소비자가 함께 승인·구현되지 않으면 Task 1은 합성 계약으로만 남고 Task 2~3 제품 source는 시작하지 않는다.

### Task 1 — 정착 marker model과 fail-closed classifier

- [ ] 먼저 synthetic RED를 추가한다: partial/ACTIVE/final marker, hash·sequence·identity·field-set 변조, cross-root/SID/container/worker, 8 MiB/512 경계
- [ ] 현재 scope에서는 pure RAM test-owned parser/classifier로 계약을 고정한다. 실제 caller 승인 없이 제품 parser/helper를 추가하지 않는다.
- [ ] public DTO/API/권한을 만들지 않고 `RequireDurability`는 계속 최초 효과 전에 throw하게 유지한다.
- [ ] final marker가 있어도 old request는 `UNKNOWN`이라는 별도 assertion을 둔다.
- [ ] Task 1 단독 통과를 제품 source 완료로 표시하지 않는다.

### Task 2 — persistent marker의 private Win32 source

- [ ] `CREATE_NEW`/existing exact open, share 0, private ACL, non-inherit, no-reparse, actual identity의 static contract RED를 추가한다.
- [ ] `ACTIVE`와 `INSTALLATION_SETTLED`의 append/flush/readback/identity 재검산 source를 작성한다.
- [ ] 원 marker handle을 목록에 먼저 보관하고 partial acquisition·write·close 실패에서 handle/reference를 잃지 않는다.
- [ ] volume handle, 새 privilege, 새 key, 외부 path, caller raw handle을 추가하지 않는다.
- [ ] Task 3의 실제 internal caller·소비 projection이 같은 변경 단위에 없으면 이 제품 source를 추가하지 않는다.

### Task 3 — 재시작 read-only recovery와 v1 호환

- [ ] final marker + exact container/previous/worker facts의 양성 RAM fixture를 추가한다.
- [ ] marker missing/ACTIVE/partial, `.next` 존재, current head drift, 다른 identity/writer, old lease expiry-only 반례를 추가한다.
- [ ] 반환 projection을 `artifact current verification`과 `old request UNKNOWN`으로 분리한다.
- [ ] existing v1 `ReadInstalled`, previous fallback와 normal binding readback이 바뀌지 않았음을 검산한다.
- [ ] 목적 분리된 실제 internal caller, Windows read-only open, classifier와 소비 projection을 한 diff에서 검수한다. 기존 execution/image 경로의 앞단 `RequireDurability`는 유지한다.

### Task 4 — crash matrix·독립 검수

- [ ] §4의 모든 crashpoint를 deterministic synthetic case로 고정한다.
- [ ] 반복 호출·교차 owner·교차 root·same hash 다른 file identity·close unknown에서 효과 0을 확인한다.
- [ ] source diff, exact SHA, focused static/synthetic 결과와 미실행 actual Windows 범위를 보고한다.
- [ ] 독립 reviewer가 marker로 authority 또는 past response가 복구되지 않는지 재검수한다.

## 8. 완료조건과 미검증

Source 단계 완료조건:

- marker/container/worker/root의 canonical binding과 모든 crashpoint의 fail-closed synthetic evidence
- Task 1~3의 실제 protected read-only 연결 단위. 합성 classifier만 있거나 unreferenced product helper만 있으면 `SOURCE_CONTRACT_ONLY`이며 제품 완료가 아님
- 기존 v1 reader·rollback 판독, quota, owner/current/one-shot 계약의 정적 회귀 0
- public API·DB·권한·key·role·lifetime·cleanup 효과 확대 0
- `RequireDurability()`와 실제 producer default-off 유지
- 독립 검수 Critical/Important 0

다음은 이 작업으로 PASS가 되지 않는다.

- 실제 C# compile/load
- 실제 Windows filesystem, NTFS metadata, handle sharing·close, process restart
- device power-loss·filesystem/controller cache 내구성
- 실제 key/DPAPI, DB, 서비스, Agent, HTTPS
- actual installer 지원 또는 `RequireDurability` 개방
- 과거 caller가 성공 응답을 받았다는 증명

## 9. 별도 승인 경계

아래가 필요해지면 source 작업을 멈추고 변경 이유·영향·대안을 보고한다.

- 새 public API/DTO 또는 caller가 선택하는 path/handle
- 새 role·permission·key·certificate·volume handle/privilege
- installation metadata 8 MiB/512 revision 또는 worker quota 확대
- marker 보존 기간·root lifetime·cleanup 정책 변경
- 자동 repair/delete/reinstall 또는 old UNKNOWN을 SUCCESS로 바꾸는 정책
- 실제 OS 실행, 실제 설치 활성화, `RequireDurability` guard 개방

이 문서의 권장안은 기존 보호 root 안의 source·합성 설계를 구체화할 뿐, 실제 Windows 설치 지원·재시작 복구·사용자 인수를 승인하거나 완료로 판정하지 않는다.
