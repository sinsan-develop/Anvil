# FN16 보호 설치 파일 읽기 — 내부 구현 지시

2026-10-29 / Main 어울 / source·메모리 합성 / 기준54b994ca2937f4d37d99ecaab404b497ab5bdb80

## 근거와 범위
직접승인3FAD0CE9/계약5A6819 §3·상세안§7/10의 설치 catalog와 고정 artifact 읽기 선행을 구현한다. 실제 설정파일·키·DB·서비스·권한·native 로드는 실행하지 않는다. 기존 native 슬롯 쓰기/삭제 구현과 기본 UNCONFIGURED는 그대로 둔다. 신뢰된 서버 호출만 쓰는 내부 source이며 공개 API/환경변수 탐색/자동 설치가 아니다.

정확 허용2경로: 신규 `apps/server/modules/backups/installation-resource-protected-files.ts`, `tests/unit/FN16/installation-resource-protected-files.test.ts`. 기존 fn16_primary 단일 writer, 처음 TEST_ONLY 후 Main RED 확인 뒤 제품. Main은 문서·검수·통합만 맡는다.

## 내부 방법과 인터페이스
- 제품 함수는 Node fs의 실제 읽기 본문을 제공한다. 합성 검증은 같은 본문의 fs/runtime 관측 경계를 메모리로 대체하되 기본 제품 경로에서 성공 stub·검증 bool을 받지 않는다. 인터페이스 상세는 시험을 쓰기 전에 Main에 한 번 제시한다.
- 입력은 신뢰된 내부의 닫힌 고정 descriptor: 절대 정규 경로, 예상 dev/ino(uint64 decimal), 예상 SHA256, 정확 sizeBytes와 kind(CATALOG|ARTIFACT). 파일 위치는 입력으로만 받으며 생성/검색/fallback/권한보정0. 입력 전체를 복사·고정하고 IO 전 검증한다. CATALOG 최대1MiB, ARTIFACT 최대16MiB, 읽기 chunk64KiB는 내부 자원상한이며 기존 사용자 파일/키 수치를 바꾸지 않는다. 경로4095bytes/성분255bytes/256성분·NUL/dot/dotdot/빈성분 거절.
- Linux x64/Node24.22.1/NAPI>=8, 비root 서비스 UID, ext4와 검증된 자기 procfs만 후보지원한다. 런타임 미지원/관측불가는 IO 또는 로드 성공으로 승격하지 않는다. 실제지원은 후속 Linux 검증 전 미확인이다.
- 보호 파일과 모든 부모는 root uid0, group/other write0, 특수권한/setuid/setgid/sticky 없는 일반 디렉터리/파일이어야 한다. 최종파일은 regular/nlink1/정확size/identity, 서비스UID 소유·writable 설치트리 거절. root-owned 보호 설치파일에만 적용하며 writable TARGET/KEY_VAULT는 이 reader로 열지 않는다.
- '/'의 보유 FD에서 시작하고, 검증한 자기 procfs의 `/proc/self/fd/<heldParent>/<singleComponent>`로 성분별 O_NOFOLLOW/O_DIRECTORY/O_CLOEXEC(open의Node기본수명 포함)와 최종파일 O_RDONLY/O_NOFOLLOW/O_NONBLOCK을 사용한다. 부모/자식 fstat 및 현재 이름의 no-follow identity 연결과 mount를 앞뒤 대조한다. 원래 전체 경로로 재open/require하지 않는다. Node 공개fs에 openat이 없으므로 이 procfs FD방식의 동일성은 실제 Linux 경합시험 전 미확인으로 명시한다. 문자열 realpath만으로 보호증명0.
- 동일 열린 file handle에서 boundedread/hash를 확인하고 크기변화·EOF불일치·mtime/ctime·identity/owner/mode/부모연결변화를 거절한다. 반환 cap은 opaque 내부소유이며 외부에 raw fd/path/bytes를 자동공개하지 않는다. catalog는 복사된 bytes를 명시 소비하고 artifact는 동일FD pin을 유지한 제한 callback으로만 후속loader에 전달한다. callback 경로가 검증된 FD에 속함을 검사하며 callback 후 재검사 실패는 성공으로 반환하지 않는다. 이 단계에서 dlopen 자체는 구현/호출하지 않는다.
- currentness 검사는 고정 descriptor·보유FD/부모/이름/현재 bytes hash를 재대조한다. 관측실패 뒤 영구차단하고 자동재활성화/재open0. 동시에 같은 cap의 read/current/pin은 유한 단일 작업으로 직렬화하거나 busy거절(무한queue0), dispose는 즉시신규차단·수락작업drain·열린 자기FD역순회수만1회. partialopen 실패도확인된 자기FD만회수. close오류는재시도0·UNKNOWN 보존, callback/dlopen 결과를 언로드했다고표시0.
- 오류는 새 AuthFailure INPUT_INVALID400/RESOURCE_UNVERIFIED412/RESOURCE_PROCESSING409/RESOURCE_STATE_UNKNOWN503로 한정하고 원path/errno/message/stack/cause/bytes를 노출하지 않는다. FD번호 재사용에 따른 다른객체close·파일unlink/rename/chmod/chown/write0.

## 검수·한계
같은 FD 읽기·pin, 정체성/owner/mode/부모·mount/procfs·ABI변경, symlink/FIFO/과대/부분읽기/크기변동, hash불일치, 입력alias, pendingdispose/late결과·단발close/close불명·원오류비노출을 메모리합성으로 확인한다. node --test 신규파일·typecheck·diff·독립 C/I0, 기존 native15 재실행0. compiler/라이브러리/서비스UID 격리·다른정상writer분리·실제 root 설치보호는 이 helper 하나로 보장하지 않으며 bootstrap/실제설치의 남은 선행이다. 운영 root/관리자 전체공격방어 또는 새로운 면책을 채택하지 않는다.

실제 생성자원0. rollback은 신규 helper source revert이며 기존자료·키·DB삭제0. 다음 bootstrap의 manifest wire/installer evidence/실제 load 결박은 별도 내부설계 단위로 기록하고 운영 활성화와 분리한다.

근거: Node24 process.dlopen 및 fs 공식 문서, Linux proc_pid_fd(5)/acl(5). API 제공은 실제 FD경합/보호 PASS의 증거가 아니다.
## 고정 내부 인터페이스와 mount 관측
Main 채택: `openProtectedInstallationFile(descriptor, {io?,runtime?}) → Promise<ProtectedFileCapability>`. descriptor의 정확필드는 `{absolutePath,expectedIdentity:{device,inode},expectedSha256,sizeBytes,kind:'CATALOG'|'ARTIFACT'}`다. 기본IO는실제Node fs이며 합성시험은 open/fstat/lstat/statfs/read/readlink/close와 runtime(platform/arch/node/napi/uid/euid/pid)의 관측만대체한다. cap의own공개메서드는 `readCatalog():Promise<Uint8Array>`, `withArtifactFile<T>(callback:(heldFdPath:string)=>Promise<T>):Promise<T>`, `assertCurrent():Promise<void>`, `dispose():Promise<void>`다. CATALOG/ARTIFACT 목적을교차사용하지않으며callback은신뢰된서버내부소비자전용,경로문자열보관/이탈을언어적으로방지한다는주장0. callback실행후불명은503·재실행0,이전근거거절412. 해당본문에서는native호출0.

`statfs=0xEF53`만으로ext4라하지않는다. 검증한자기procfs의 `/proc/self/fdinfo/<heldFD>`를최대8KiB, `/proc/self/mountinfo`를최대1MiB로bounded읽고 fdinfo.mnt_id와mountinfo의정확entry/fstype=ext4를대조한다. 중복/파싱불명/초과/누락/현재성변경은거절한다. 이관측도새임의파일입력이나shell실행을허용하지않으며필요한자기proc경로만내부생성한다. proc용임시읽기handle도누락없이단발회수한다. 실제Linux관측과dlopen결박은여전히미실행이다.