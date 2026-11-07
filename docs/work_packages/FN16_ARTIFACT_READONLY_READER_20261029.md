# FN16 원문 보관소 readonly reader — source 작업지시

2026-10-29 · Main 어울 · codex/av3-stage-b / ff0aca9c1b47fcdc9e37e5372bfb3a59d8ea70ba

## 목적과 허용 범위
설계 §10.4/FUNCTION_WORK FN16에 따라 단일 artifact byte verifier의 필수 reader를 실제 Node 파일 연산 본문으로 구현한다. 현재 승인된 FN16 source/합성 범위의 내부 기술 구현이며 새 공개 API·권한·DB/설정·runtime 활성화가 아니다. 기존 설치 catalog/root-owned reader/native/ArtifactStore는 변경하지 않는다. 실제 파일·키·DB·서비스·P03 실행0, 합성 IO만 사용한다. 이번 코드 존재나 합성 PASS를 실제 Linux 안전성·현재 권한·전체 백업 완료로 보고하지 않는다.

정확 신규2경로:
- apps/server/modules/backups/artifact-readonly-reader.ts
- tests/unit/FN16/artifact-readonly-reader.test.ts

기존 fn16_primary 단독 writer, Main 관리/검수/통합, fn16_review 읽기 독립검수. Git/관리문서는 Main만 변경한다. 기존 보호 미추적 자료는 제외한다.

## API·기준 입력
createArtifactReadonlyReader(binding:unknown,deps?:{io?:ProtectedFileIo;runtime?:()=>ArtifactReaderRuntime})는 ArtifactByteReader와 dispose():Promise<void>를 제공한다. factory는 파일 IO0, 검증한 binding을 보관한다. 기존 설치 reader의 ProtectedFileIo/Observation과 byte verifier의 Reader/Ref/Handle은 type-only import할 수 있다. 검증 함수·소유 규칙·기존 수치의 변경/자동 fallback은 없다.

binding은 exact own-data {absoluteRoot,expectedRootIdentity:{device,inode},ownerUid}. descriptor 값을 각 객체1회만 snapshot·freeze한다. root는 절대 POSIX 경로, UTF8 4095bytes 이하/성분255bytes/깊이256 이하, 빈 성분·`.`·`..`·NUL·끝 slash·root `/`는 거절한다. identity는 unsigned uint64 decimal canonical 문자열이다. ownerUid는 1~uint32max. root pin은 신뢰한 서버 내부 caller가 주입하며 이 함수가 설정·허가를 생성하지 않는다. actual root 설정/출처 확인은 후속 활성화 전제다.

runtime은 {platform,arch,node,uid,euid,pid}, linux/x64·Node >=24.18.0 <25·uid=euid=ownerUid>0·양수 PID만 지원한다. prerelease/불명 버전과 현재 runtime 변화는 거절한다. source root 위 조상까지 local ext4, /proc는 procfs만 지원한다. 다른 환경은 미지원이며 권한 변경이나 우회 mount를 만들지 않는다.

open의 exact ref는 {projectId,artifactId,bytes,contentHash}, 소문자 UUIDv1~8·bytes0~20MiB 안전정수·SHA25664hex다. 경로는 binding과 서버 형식 blobs/projectId/artifactId로만 계산하며 사용자 파일명/storageKey 입력은 없다. caller ref와 signal의 의미를 열린 handle 수명 내 보존하고 ref는 descriptor snapshot한다.

## 실제 IO·검사
기본 IO는 fs.open/lstat/statfs/readlink와 FileHandle.stat({bigint:true})/read(position,maxBytes)/close다. write/mkdir/chmod/unlink·readFile·process spawn·환경변수 fallback은 없다. 합성시험만 IO/runtime을 주입한다. Linux O_RDONLY|O_NOFOLLOW|O_NONBLOCK, 디렉터리는 O_DIRECTORY를 추가한다. Linux 상수나 지원 근거가 없으면 지원한다고 가장하지 않는다.

`/`부터 chain FD를 보유하고 각 자식은 자기 parent FD에서 계산한 /proc/self/fd/N/성분으로만 연다. /proc magic0x9fa0, /proc/self의 PID, fd/fdinfo 디렉터리 소유·현재 연결, fdinfo의 단일 mnt_id/ino, mountinfo의 해당 ID fstype ext4·device 및 held FD statfs0xef53를 대조한다. fdinfo 최대8192bytes, mountinfo 최대1048576bytes+1 초과 탐지이며 무한 metadata read0. decode/구조 불명은 거절한다. 새 FD의 숫자·opaque handle 유효성/중복을 확인하고 관측용 FD도 소유 집합에 포함해 단발 회수한다.

현재 이름은 동일 parent FD에서 nofollow 임시 FD로 재열어 held FD와 dev/ino/mount를 대조한다. `/`와 root 위 부모는 directory·uid0 또는 ownerUid·mode&0o7022=0. source root/blobs/project 디렉터리는 ownerUid/정확0700, 파일은 ownerUid/정확0600·regular/nlink1·size=ref.bytes<=20MiB다. root는 pin dev/ino 일치, 그 아래는 root와 같은 device/mount여야 한다. symlink/FIFO/하드링크·bind mount·불명 대상은 거절한다. 현재 파일의 size/mtime/ctime도 처음 관측과 동일해야 한다.

open/read의 앞뒤 runtime/proc/chain/파일 관측과 원 signal·read signal 취소를 대조한다. read는 안전정수1~65536, 내부 순차 offset와 min(요청,선언remaining+1)로 위치 지정한다. 요청 초과 응답은 복사/offset 갱신 전에 거절하며 양수 short read는 정상, 0은EOF다. EOF에서 선언bytes와의 일치/hash/marker 판단은 기존 byte verifier가 수행한다. 소유권·경로·현재성 오류 또는 IO오류 뒤 reader는 poison되어 추가 read/open을 거절한다. payload buffer는 private 복사본으로 반환하고 FD/경로/원오류는 노출하지 않는다.

## 생명주기·실패 의미
한 reader의 open은 열린 handle 전체 수명 동안1개, 동시에 read1개다. 두번째 open/read는 고정 BUSY로 거절하며 정상 진행 중인 소유 작업을 임의 취소하지 않는다. close는 closing을 먼저 고정하고 이미 접수한 read가 settle할 때까지 기다린 뒤 자기 FD를 역순 정확1회 close한다. 반복 close는 동일 Promise를 반환한다. dispose는 신규 open을 막고 진행 open/read를 drain하여 부분/반환 handle의 자기 FD를 회수한다. 자기 Promise await 순환·진행 IO를 Promise.race로 버리는 회수는 금지한다. 부분 open 실패도 소유 FD를 회수한다. close가 실패해도 다른 자기 FD의 회수는 계속하며 불명 FD를 재close/숫자 kill하지 않는다. 원자료 삭제0.

고정 오류: INPUT_INVALID/400, ARTIFACT_READER_UNSUPPORTED/412, ARTIFACT_READER_UNVERIFIED/412, ARTIFACT_READER_IO_FAILED/503, ARTIFACT_READER_CLEANUP_FAILED/503, ARTIFACT_READER_BUSY/409, ARTIFACT_READER_CLOSED/409, ARTIFACT_READER_CANCELLED/409. 외부 Error/AuthFailure의 message·cause를 그대로 신뢰/반환하지 않는다. cleanup불명은 우선 보고한다. close/dispose가 정상이어도 미실행 파일 안전성·복원 성공을 판정하지 않는다.

임의 IO promise 강제 종료/같은UID 악성writer·특권OS 완전 방어·ACL 전수보장·실제FS 내구성은 이번 보장이 아니다. sourceStabilityVerified=false 및 authorityVerified=false는 byte verifier에서 그대로 유지한다. 현재 DB 귀속·격리·로그인/OWNER/세대 재검사 orchestration과 실제 root 주입/런타임 연결은 별도 미완료다.

## 수행·검수
1. TEST_ONLY 신규 시험1파일: 공개 fake IO/관측만, 정상 reader+byte verifier 조합, factory IO0/ref snapshot, root pin/runtime/owner/mode/파일규칙, path/symlink/FIFO/hardlink/mount변경, 성장·축소/과대응답/short, 부분open·취소·late read/동시open/read·close/dispose drain·단발회수/회수실패/raw오류비노출. actual IO 호출은0이다.
2. Main node --test tests/unit/FN16/artifact-readonly-reader.test.ts 의 미구현 RED 확인 뒤 같은 primary 제품 GO. 기존 완료시험을 반복하지 않고 새 조합에서 소비하는 연결만 확인한다.
3. 신규 시험·npm run typecheck·git diff --check, 독립 C/I0 검수. 수정 시 관련 반례만 추가·재검증, 원 실패/기대값 유지. 실제 Linux·경합·FS·사용자 백업 검증은 NOT_RUN.
4. Main WORK_STATUS/결과·Git checkpoint로 기록. rollback은 신규2파일의 검토된 revert이고 실제 root/원문/키/DB/서비스 삭제가 아니다.

상태: 독립 WI 검수 전, source/시험 작성0.
