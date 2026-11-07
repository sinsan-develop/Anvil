# FN16 POSIX safe-handle 내부 구현 상세 후보

상태: **상세설계 후보 / 구현·실행 0 / 2026-10-28**. 이번 산출물은 문서 한 파일이다. Native 코드·컴파일·로드·설치·실제 파일 probe·키·DB·서비스 실행을 허가하거나 완료한 기록이 아니다.

## 1. 기준과 유지할 보장

- 원 계약: `docs/contracts/FN16_INSTALLATION_RESOURCE_PORTABLE_KEY_CANDIDATE.md`, SHA256 `5A6819E626F2FF4104862988C07230A00676D07F06A25658BC9344746335D053`, 특히 §3·§7·§8. 원문과 수치는 변경하지 않는다. 원문의 후보 머리글과 후속 채택 기록은 구분한다.
- 채택 근거: `docs/approvals/FN16_INSTALLATION_RESOURCE_DIRECT_APPROVAL_20261028.json`, SHA256 `3FAD0CE959F9972E0DA1C131FFA5FB07521B2381343D3D590A6957BCFE33CBDF`. 이번 Main 전달 PMO 결정은 내부 상세설계만 허용한다.
- P02 `docs/contracts/TECH_DECISIONS.md`의 Node 서버와 파일 보관 구성을 유지한다. 기존 export/spool의 path·stat 보호를 FN16 handle 보장의 증거로 전용하지 않는다.
- 원 보장은 서비스 전용 owner·root 0700, 링크/특수 파일/상위 이탈/중복 root 거절, 사용 직전 root·부모·파일 정체성/권한/용량 재검사, UUID 자식만 허용, 기존 파일 교체·삭제 금지다. Probe는 새 파일 최대 1KiB·0600, envelope는 canonical UTF-8 최대 16KiB다.
- 안전한 handle 경계가 미검증이면 UNCONFIGURED/UNVERIFIED와 실사용 차단을 유지한다. 공개 API·DB 계약·Secret 전달 조건·실제 App의 Secret 입력 비제공은 바꾸지 않는다.

## 2. 기술 선택 후보와 한계

후보는 기존 Node 프로세스 내부의 소형 **Linux Node-API 모듈**이다. 새 daemon·외부 helper process·관리자 권한·capability 부여를 요구하지 않는다. Native 소스, 빌드 산출물과 로드 경로는 후속 exact WI 대상이며 아직 생성하지 않는다.

Node 공개 fs는 FileHandle의 read/write/stat/sync를 제공하지만 open/link/rename/unlink는 경로 기반이다. 로컬 타입에서도 dirfd 상대 공개 연산을 확인하지 못했다. O_NOFOLLOW는 마지막 성분만 보호한다. 따라서 JS realpath 재대조나 `/proc/self/fd` 문자열 우회만으로 원 계약 충족을 선언하지 않는다.

첫 검증 대상 후보는 Linux의 로컬 파일시스템이다. Linux 커널·libc·CPU·Node-API 버전·마운트 종류·필수 syscall/flag의 정확한 조합은 실제 시험 전에 고정한다. Windows/SMB/NFS/다중 서버 쓰기는 원 계약대로 미지원이다. 다른 POSIX도 독립 근거 없이 지원으로 올리지 않는다.

## 3. 내부 타입와 FD 수명

기존 `installation-resource-catalog.ts`의 RootHandle/VaultRootHandle/ProbeHandle 포트와 DTO는 유지한다. Bridge의 FD와 경로는 서버 내부 전용이며 브라우저·DB·로그에 전달하지 않는다.

| 내부 객체 후보 | 결박과 수명 |
|---|---|
| RootCapability | installation/slot/profile, 예상 dev·ino, 실제 owner/mode, root와 조상 directory FD 묶음, 프로세스 내부 세대·OPEN/CLOSING/CLOSED 상태. JS에서 임의 정수 FD를 제출하지 못하는 opaque 객체 |
| FileCapability | 생성 root capability·서버 UUID·dev/ino·현재 파일 FD·생성 시도 식별·게시 상태. 다른 root의 handle이나 재사용된 정수 FD는 거절 |
| PendingOperation | 시작 시 root/file 세대와 작업 소유자를 고정. close와 직렬화하고 진행 중 연산 종료 전 OS FD를 반환하지 않음 |
| FailureReceipt | 비밀 없는 단계·확정/불명 효과·보존 필요 여부. raw path/bytes/errno 상세를 공개 오류에 포함하지 않음 |

정상 경로는 명시 close를 수행하고 중복 close는 OS close를 반복하지 않는다. close 실패/불명은 FD 번호만으로 재시도하지 않는다. 최종화는 누수 방지 보조일 뿐, 파일 삭제·성공 판정·DB 확정을 수행하지 않는다. 프로세스 종료 뒤 capability는 재사용하지 않고 catalog부터 재검증한다.

현재 store의 probe 정리는 close 뒤 remove를 호출한다. 후속 구현은 이 순서를 그대로 정수 FD에 매핑하면 안 된다. (a) remove 검증까지 내부 소유 FD를 유지하는 별도 수명, 또는 (b) store 내부 순서를 검토해 remove 후 close로 정합시키는 방안을 WI에서 고정한다. 어느 쪽도 inode 비교와 삭제의 원자성 문제를 해결한 것으로 보지 않는다.

## 4. Root·부모 교체 방어

1. 보호된 installer catalog를 입력으로만 읽는다. 서비스가 root/config를 생성하거나 chmod/chown하여 검사 결과를 맞추지 않는다.
2. 신뢰 anchor에서 각 경로 성분을 directory FD 상대 no-follow로 연다. `openat`의 성분별 `O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`와 `fstat`을 사용하거나, 동일 보장이 검증된 openat2 resolve 제약을 사용한다. 지원하지 않는 syscall을 path 방식으로 몰래 대체하지 않는다.
3. root dev/ino와 예상 identity, 각 부모의 연결 관계·현재 보호 속성을 확인한다. UUID 단일 성분만 후속 자식 이름으로 받으며 slash, dot, 사용자 path를 허용하지 않는다.
4. 생성·읽기·게시·정리 직전과 결과 확정 전에 held FD 및 조상 연결을 재검사한다. 교체/링크/권한/용량 불명은 새 작업과 사용을 차단한다. 이미 발생한 파일 효과는 UNKNOWN·보존 대상이다.

**보장 구분:** dirfd는 경로가 바뀌어도 고정 directory 객체에 연산을 묶는 수단이다. 조상 경로가 동시에 변경될 수 있을 때 전후 재검사가 모든 순간의 경로 연결을 원자적으로 보증하는 것은 아니다. 원 계약의 부모 교체 방어와 정확히 어떤 불변식을 만족하는지 경쟁 시험·독립 검수 전에는 미충족이다. 사후 감지만으로 VERIFIED를 만들지 않는다.

## 5. 같은 inode 배타 게시와 내구성

- UUID 임시 파일을 held root에서 exclusive/no-follow·0600으로 생성한다. 부분 쓰기는 끝까지 확인하고 최대 길이를 넘기지 않는다. 파일 sync→정확 바이트 재읽기/hash→동일 dev/ino·파일 종류·owner/mode 확인 순서를 유지한다.
- 기본 후보는 열린 source FD를 대상으로 `linkat`하여 새 UUID 최종 이름을 배타 생성하는 방식이다. 최종 이름 존재 시 거절하며 overwrite/일반 rename fallback은 없다. 생성된 최종 이름을 다시 no-follow 열어 held source와 같은 dev/ino인지 대조한다.
- `linkat(..., AT_EMPTY_PATH)`는 통상 capability 요구가 있으므로 권한 추가 없는 기본안으로 채택하지 않는다. Linux의 `/proc/self/fd/<heldFD>`와 `AT_SYMLINK_FOLLOW` 방식은 공식 문서상 대안이지만, 정확한 procfs·FD 수명·동일 mount·파일 link 상태를 확인해야 하는 **검증 후보**다. 이는 임의 사용자 symlink 허용이 아니다. 조건 미충족은 사용 불가이며 capability를 자동 부여하지 않는다.
- 파일 sync와 게시 후 root directory FD fsync를 별도로 확인한다. 둘 중 실패/불명 또는 게시 후 DB commit 불명은 원 계약대로 UNKNOWN·파일 보존·사용 차단이다. 파일과 DB를 하나의 transaction으로 표현하지 않는다.
- 임시 이름 제거는 아래 자기 삭제 문제와 동일하다. 게시가 성공했다고 임시 별칭을 무검사 삭제하거나 제거 성공을 추정하지 않는다. 후보를 실제 연결하기 전에 임시 별칭 수명·불명 정리와 현재 store의 성공 반환 조건을 함께 고정한다.

## 6. 정확한 자기 삭제: 미충족 경계

`unlinkat(dirfd, name)`는 고정 부모에서 이름을 삭제하지만 **기대 inode와 같을 때만 삭제하는 원자적 syscall이 아니다**. fstatat 비교 후 unlinkat 사이에 동일 이름이 교체되면 다른 파일을 삭제할 수 있다. Native라는 이유로 이 간극이 사라지지 않는다.

| 구분 | 현재 판단 |
|---|---|
| 원 보장 | 자기 파일 정체성을 대조한 정리만 허용. 기존 파일 삭제 금지. 불명/정리 실패는 보존·UNKNOWN, 등록 성공 금지 |
| 설치 전제 | 서비스 전용 owner·0700 및 최초 단일 서버 프로세스는 원 계약에 있음. 실제 서비스 UID·부모 변경 권한·다른 writer 존재 여부는 아직 검증되지 않음 |
| 보장으로 사용 불가한 주장 | 앱 mutex만으로 외부 writer 차단, 같은 UID 악성 writer를 새 면책으로 제외, root 권한만으로 모든 조상 변경 차단 |
| 미충족 | 원 파일만 삭제된다는 경쟁 안전성을 현재 syscall 조합/설치 증거로 입증하지 못함. 불명 때 삭제하지 않는 것은 필요하지만 정상 probe의 정리 완료까지 입증하지는 못함 |

이는 원 계약에 없는 악의적 OS 관리자/root 또는 임의 같은 UID 공격의 완전 방어를 새 완료조건으로 추가하는 뜻이 아니다. 원래의 일반 OS/관리자 신뢰와 서비스 전용 owner·단일 서버 프로세스를 기준으로, 해당 설치에서 어떤 주체가 root/부모/자식 이름을 변경할 수 있는지 먼저 확인한다. 앱 mutex는 내부 writer만 직렬화한다. 다른 정상 프로세스·설치 도구가 같은 서비스 UID로 동시에 변경하지 않도록 실제 배치가 분리되어 있는지, root·부모 권한과 관리 절차로 그 전제가 유지되는지 확인해야 한다. 이 설치 근거로 보장이 성립하는 범위와 미충족 범위를 독립 검수하고, 확인 전 포괄적 면책이나 강화된 공격 모델을 임의 채택하지 않는다.

따라서 이 항목이 해결되지 않으면 등록·vault 실사용을 활성화하지 않는다. 다른 파일을 임의 rename하여 격리하거나 root를 새 위치로 이동하는 해결책도 이번 후보에 포함하지 않는다. 후속 판단은 원 보장의 유지 여부와 검증된 설치 보호를 대조해 내려야 하며, 보장을 낮추거나 추가 권한이 필요한 안은 별도 delta로 올린다. 원 계약 §5의 메모리 완전 소거 한계는 §3의 파일 삭제 보장을 면제하지 않는다.

### 6.1 불명 효과의 기존 인터페이스 연결

Bridge 내부 실패는 `{stage, effect:NONE|POSSIBLE|CONFIRMED, cleanup:NOT_ATTEMPTED|CONFIRMED|UNKNOWN}`로 구분하는 후보다. native errno·path·파일 bytes를 그대로 노출하지 않는다. TypeScript adapter는 권한/정체성 검사만으로 I/O 전에 거절한 경우와, 생성·게시·정리·sync·close의 결과가 불명인 경우를 구분한다. 후자는 기존 `AuthFailure('RESOURCE_STATE_UNKNOWN',503)`으로 연결하고 성공 반환·후속 publish·retry·unlink를 하지 않는다. `remove()`는 정확한 자기 정리 완료가 확인된 경우에만 resolve하며, 불명은 reject다. `fsyncParent()`도 확인된 성공만 resolve한다.

Store는 이 503을 기존 intent UNKNOWN 감소·비밀 없는 상태 재조회에 연결해야 한다. 파일 효과 뒤 실패를 FAILED로 단순 분류하지 않으며 DB 기록도 불명일 때 성공 receipt를 만들지 않는다. 현재 UUID/원 intent/프로세스 내 소유 정보 중 확인된 증거만 보존하고, 새로운 공개 reconcile나 자동 orphan 삭제는 만들지 않는다. 프로세스 종료로 정보가 부족하면 정리했다고 추정하지 않는다. 이 연결은 후속 synthetic 시험 대상이며 아직 제품에 구현·연결하지 않았다.
## 7. ABI·바이너리 신원·지원 판정

Node-API C 인터페이스를 사용해 V8 내부 API 의존을 피하는 후보이며, 정확한 N-API 최소 버전은 build 설계 때 고정한다. 대상 OS/arch·libc·Node 버전·소스 commit/hash·컴파일러/flags·산출물 SHA256을 내부 manifest로 결박한다. JS loader는 고정된 보호 위치의 정확 artifact만 로드하며 사용자 경로·환경변수 탐색·자동 다운로드/컴파일·임의 native module 로드를 허용하지 않는다.

파일 hash 일치만으로 보호된 배포 위치나 로드 시 교체 방어가 증명되지는 않는다. loader/artifact/부모 보호와 로드 시점 정합을 별도로 검수한다. 미지원 ABI/OS/FS, binary 신원 불명, syscall 기능 불충족은 fail-closed다. 아직 정확 artifact·load·runtime 시험은 0이므로 지원 확정은 없다.

## 8. 후속 업무 단위·파일 후보·검수

아래는 후속 WI의 후보 목록이며 **이번 변경 허용은 이 문서 한 파일뿐**이다. Main이 exact allowlist를 확정하기 전 코드·시험·build 설정을 만들지 않는다.

| 업무 단위 | 파일 후보 | 검수와 종료 조건 |
|---|---|---|
| 내부 bridge·신원 경계 | 신규 `apps/server/modules/backups/installation-resource-posix.ts`, `native/fn16-posix-safe-handle/addon.c`, `native/fn16-posix-safe-handle/binding.gyp`, `native/fn16-posix-safe-handle/BUILD_CONTRACT.md` | 공개 API 없이 opaque handle·수명·identity·지원 거절을 정의. native compile/load는 별도 실제 실행 계획 대상 |
| Catalog와 store 정합 | 기존 `installation-resource-catalog.ts`, `installation-resource-store.ts` | 별도 안전 근거가 있는 adapter만 주입. 슬롯 중복/분리·root 현재성·publish/close/remove 효과와 UNKNOWN 정합. 삭제 미충족 상태에서 자동 활성화 금지 |
| 합성 계약 검수 | 신규 `tests/unit/FN16/installation-resource-posix.test.ts` | 세대/타 root/닫힌 handle/중복 close, 단기 쓰기·sync/게시/DB 불명, 지원 거절을 주입 시험. 실제 syscall 보장으로 승격하지 않음 |
| 실제 Linux 검수 계획 | 신규 `tests/integration/FN16/installation-resource-posix-native.test.ts` 후보 | 후속 exact 임시 root·UID·수명·정리 승인과 실제 artifact 필요. 지금 생성/실행 0 |

실제 검수에서 필요한 핵심 반례는 부모 rename/교체·중간 symlink·파일 특수형/owner/mode 변경, source leaf 교체와 final 이름 선점, 부분 쓰기·파일/부모 fsync 실패, close/FD 재사용, 삭제 직전 이름 교체·정리 실패다. 원 파일과 대체 파일의 정체성을 따로 관측하여 **타 파일 삭제 0, 기존 파일 overwrite 0, 불명 성공 0**을 확인한다. 일반 성공 흐름은 probe 생성→동기화→재읽기→정확 자기 정리, vault 불변 게시→고정 조회다. 전원손실 내구성은 정상 fsync 시험과 구분한다.

현재 코드·시험·빌드·native load·FS probe·실제 key/DB/service는 모두 NOT_RUN이며 원 계약 hash는 불변이다. 이 후보 완료는 native adapter 구현 완료나 FN16 실제 사용 완료가 아니다.

## 9. API 근거

- [Node 24 fs 공식 문서](https://nodejs.org/docs/latest-v24.x/api/fs.html): FileHandle과 path 기반 공개 연산. 로컬 `node_modules/@types/node/fs.d.ts`, `fs/promises.d.ts`도 대조했다.
- [Linux open(2)](https://man7.org/linux/man-pages/man2/open.2.html): O_NOFOLLOW의 마지막 성분 경계, directory FD 상대 접근.
- [Linux link(2)](https://man7.org/linux/man-pages/man2/link.2.html): 배타 link 생성, AT_EMPTY_PATH의 capability 및 procfs 기반 대안.
- [Linux unlink(2)](https://man7.org/linux/man-pages/man2/unlink.2.html): unlinkat의 이름 삭제·dirfd 해석. expected inode 조건 삭제 API가 아님.

## 10. Main 내부 결정 — 2026-10-29

원 계약/직접 승인의 내용은 유지한다. 아래는 원 보장을 구현할 내부 선택이며 실제 설치·키·DB·서비스 허가가 아니다.

1. **Probe 수명:** store는 `remove → fsyncParent → close`를 사용한다. remove는 열린 자기 handle/정체성만 받는다. 실패 시 이미 시도한 remove/close를 다시 실행하지 않으며, 아직 시도하지 않은 close만 finally에서 한 번 수행한다. 정체성을 얻지 못한 파일은 삭제하지 않는다. remove/sync/close 불명은 등록 성공 없이 UNKNOWN이다. Main 합성 반례35584f 4건 모두 기존 close 선행으로 실패했다.
2. **회수 소유자:** catalog가 root/조상 FD를 소유하고 file handle은 root에 귀속한다. dispose는 단발 Promise로 신규 대여/연산을 차단하고 진행 연산을 drain한 뒤 남은 자기 file의 close와 root/조상 close만 수행한다. dispose는 파일 삭제·성공 판정·FD번호 재시도를 하지 않는다. store는 업무 단위 종료와 함께 catalog 회수를 await할 수 있어야 한다. 현재 projects/routes.ts의 async onClose는 반환 Promise를 기다릴 수 있다. config hot-reload는 추가하지 않고 기존 catalog를 완전히 닫은 뒤 새 인스턴스를 설치하는 내부 lifecycle만 정의한다.
3. **게시:** `publish`의 성공은 같은 열린 inode의 final 배타 link와 자기 temporary alias 제거가 모두 확인된 상태다. 그 뒤 store가 기존 `fsyncParent → close`를 확인한다. 단계별 실패/불명에는 final/tmp를 추측 삭제하지 않고 UNKNOWN을 보존한다. create/source 검증 실패도 열린 FD만 닫고 미확정 파일은 보존한다. 이 의미를 internal port에 명시하며 일반 rename/copy fallback을 추가하지 않는다.
4. **최초 구현·검증 대상:** Linux x64, kernel 4.18 이상, glibc 2.28 이상, Node 24의 기존 프로젝트 허용 범위 안에서 exact 24.22.1, C Node-API 8, local ext4 및 검증된 procfs를 선택한다. Node의 지원표와 Node-API 문서는 후보 조합의 근거이며 이 Anvil 모듈의 실측 PASS가 아니다. 실제 지원은 정확 binary/compiler/FS/설치 보호·경쟁 검증 receipt가 생긴 뒤에만 선언한다. Windows/NFS/SMB/다른 FS/다른 조합은 아직 사용 불가다. 새 패키지 설치·다운로드·빌드·native 로드는 이번 문서로 실행하지 않는다.

설치 조건을 확인할 책임은 설치 담당자이며, 신뢰되는 서버 내부 evidence에 exact root/parent identity·owner/mode, service UID, 단일 서버와 다른 정상 writer의 root 사용 분리, parent 변경 주체, binary/loader 경로 보호를 결박해야 한다. 런타임이 현재 identity·권한·mount 및 evidence 일치를 재검사한다. 사용자 체크박스·환경변수 true·mutex만으로 이 evidence를 대체하지 않는다. 불명은 UNVERIFIED이며 원 계약의 보장을 낮추는 면책이 아니다.

근거: [Node v24.22.1 Node-API](https://raw.githubusercontent.com/nodejs/node/v24.22.1/doc/api/n-api.md), [Node 24 플랫폼 표](https://raw.githubusercontent.com/nodejs/node/v24.x/BUILDING.md). Node-API 8의 ABI 선택과 Node의 Linux 최소 플랫폼을 참고했으며 native/FS 검증은 미실행이다.