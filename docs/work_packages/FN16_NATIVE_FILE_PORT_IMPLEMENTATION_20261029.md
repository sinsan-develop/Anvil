# FN16 Linux native 파일 연산 구현 지시서

2026-10-29 / Main 어울 / 기존 계약의 내부 source 구현 / 기준1ec256ec

## 권한·목표
직접 승인3FAD0CE9·원계약5A6819E6·상세안0988E7A2§10을 따른다. 기존 관리 adapter의 NativePort12연산을 실제 Linux syscall 소스로 구현한다. native라는 이유로 새 사용자 기능/재승인 경계를 만들지 않는다. 이번 작성은 소스·빌드 정의·검수 시험 준비까지다. 실제 키/catalog·DB·서비스·P03 실행, 새 설치·권한 부여는 제외한다. native compile/load 및 격리 FS 시험은 아래 별도 exact 실행안이 준비되기 전 실행하지 않는다.

## 정확 허용4경로
1. native/fn16-posix-safe-handle/addon.c
2. native/fn16-posix-safe-handle/binding.gyp
3. native/fn16-posix-safe-handle/BUILD_CONTRACT.md
4. tests/integration/FN16/installation-resource-posix-native.test.ts

기존 primary 단일 writer. Main은 코드 동시수정0, 계약/WI/현황/Git 소유. 기존 TS adapter/기본 catalog/서비스 main을 수정하거나 자동 로드·config 활성화하지 않는다. 다른 파일이 필요하면 최소 소비선과 이유를 Main에 먼저 제시한다. 새 패키지·daemon·helper서비스·임의 다운로드·V8/private Node API·chmod/chown·capability 추가0.

## 내부 API와 파일 의미
- C Node-API8 초기화 export 한 개로 서버 내부 보호 catalog snapshot을 받아 기존 InstallationResourceNativePort와 동형인 객체를 제공한다. 초기화 함수 이름·입력 닫힌 구조·오류/수명은 BUILD_CONTRACT에 정확히 기록한다. 실제 catalog 파일을 만들거나 runtime 환경변수로 경로를 탐색하지 않는다.
- 고정 registry에서 installationId/slotId/profileRef/expectedRootIdentity/ownerUid/purpose를 실제 absoluteRoot와 결박한다. openRoot(binding)에 사용자 path를 새로 받지 않는다. 관측치를 입력 binding에서 복사해 성공시키지 말고 실제 fstat/statvfs 등으로 얻는다.
- 연산12개는 openRoot/inspectRoot/create/open/stat/read/sync/remove/publish/fsyncParent/closeFile/closeRoot. 기존 TS 타입과 닫힌 관측 shape를 유지하며 rawFD·임의 경로 연산·일반 rename/copy/delete를 노출하지 않는다.
- root/file은 위조·타port/타root·옛세대로 재사용할 수 없는 native 소유 capability다. N-API type-tag/내부 등록 또는 동등한 검증된 소유 방식을 사용한다. async 작업은 필요한 객체와 bytes를 소유하며 완료 전 FD/메모리를 해제하지 않는다. root·file close는 단발이며 불명 FD 번호를 재시도하지 않는다. finalizer/환경 종료는 자기 FD 회수만 하고 파일 삭제·성공 판정을 하지 않는다.
- 기존 Node 프로세스 내 비동기 완료를 사용하며 main event loop에서 무제한 fsync 등을 기다리는 구조는 피한다. 진행 작업/drain/종료 취소의 정확 수명을 기록한다. 문자열/배열/bytes/경로 길이·깊이와 진행 작업에는 유한 검사를 두고 임의 대기열을 만들지 않는다.
- 같은 실제 root identity는 다른 slot 또는 native-port 인스턴스가 동시에 별도 writer로 소유하지 못하게 한다. 현재 프로세스 registry/mutex를 OS 전체 writer 차단으로 주장하지 않는다. service 전용 owner·단일 프로세스·다른 정상 writer 분리와 부모 보호는 설치 evidence 및 실제 검증 전제이며 미확인은 실사용 차단이다.

## 실제 파일 연산의 필수 보장
- root는 신뢰 anchor부터 각 성분 no-follow directory FD로 열고 모든 부모의 identity/연결/소유·mode를 실제 대조한다. 생성/읽기/게시/정리 직전과 결과 확정 전에 held FD와 부모 연결을 다시 확인한다. 사용자 파일 이름은 서버 UUID 단일 성분만.
- create는 wx/no-follow/0600, 최대16KiB, 부분 쓰기와 EINTR을 정확히 처리한다. Probe의1KiB 계약은 store가 소비하며 파일·parent sync는 별개다. 읽기는 bounded length와 정체성/종류/owner/mode를 확인한다. 조회한 기존 파일은 생성소유 tmp가 아니다.
- publish는 열린 source와 같은 inode를 final UUID로 배타 link한 뒤 정확 final identity·자기tmp 이름 귀속을 확인하고 자기tmp alias를 정리한다. 둘 모두 확인될 때만 resolve하고 store가 이후 parent sync/close를 수행한다. final 선점·source 교체·부분 게시 불명은 overwrite/추측삭제/재실행0이다.
- AT_EMPTY_PATH를 위한 capability를 요구하지 않는다. /proc/self/fd의 heldFD와 linkat AT_SYMLINK_FOLLOW 대안을 쓰면 실제 procfs/FD수명/동일inode를 검사하고 일반 symlink 허용으로 확대하지 않는다.
- remove는 열린 생성소유 tmp의 exact root/identity/현재 이름만 정리한다. 조회 파일·게시 final·다른 객체는 제거0. unlinkat의 expected-inode 원자성 한계를 설치 writer 전제로 숨기지 않고 BUILD_CONTRACT에 구분한다. Native라는 이유로 검증 완료를 주장하지 않는다.
- native 에러는 비밀 없는 고정 오류만 내보내며 errno/path/bytes/원 예외 상세를 공개 반환하지 않는다. 파일효과 뒤 불명은 보존하고 성공 receipt/자동복구를 만들지 않는다. 부분 create/publish/close 실패 때 무엇이 남는지 명시한다.

## 지원·빌드·검수
- 최초 대상 Linux x64/Node24(NAPI8)/kernel>=4.18/glibc>=2.28/local ext4+procfs. 현재 WSL 읽기에서 기존 root소유 Node24.22.1/header·gcc13·ext4를 확인했지만 모듈 지원 PASS는 아니다. Windows/NFS/SMB/다중서버 쓰기/그밖 조합은 미검증·미지원으로 구분한다.
- 빌드 정의는 명시적 실행만 허용하고 install/postinstall·자동 빌드/다운로드0. 고정 compiler/header·flags·소스commit/hash·binaryhash·런타임/FS 관측을 후속 실행안에 결박한다. 런타임이 임의 .node를 탐색하거나 자동 로드하지 않는다.
- integration 시험은 공개 합성 bytes와 exact QA root 아래 marker만 사용하도록 먼저 작성한다. 정상 probe/불변 게시·기존 조회, 타root/위조cap/닫힘, symlink/parent 교체/선점·partial효과, dispose/FD수명·기존 파일 보존을 직접 관측한다. 실제 운영 경로/키/DB/서비스를 사용하지 않는다. 미실행을 skip PASS로 표시하지 않는다.
- 먼저 테스트와 소스 구조를 제출하고 Main이 실제 실행안을 고정하기 전 컴파일/로드/FS 실행0. source를 작성했다는 사실을 native syntax/build/OS PASS로 승격하지 않는다. source-only 독립 검수 후 정확 QA 이름·도구·공개fixture·수명·정리·중단 조건과 기존 승인/위임 범위를 대조한다. 불필요한 사용자 재승인 대신 실제 범위 밖 효과가 있을 때만 구체적으로 요청한다.

## 결과와 다음 단계
제품 API/DB/화면 계약은 유지된다. 이4파일은 검증 전 미활성 소스다. 이후 실제 loader의 보호된 binary 신원과 catalog 공급 연결을 완성해야 하며 현재 실제 App Secret 입력/전체 백업·복원·FN16 완료가 아니다. rollback은 source revert, 기존 자료/키/DB/서비스 변화0.
