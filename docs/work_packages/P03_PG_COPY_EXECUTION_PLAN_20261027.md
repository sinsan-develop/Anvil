# P03 보호 사본 실행안 준비 — 2026-10-27

상태: **SOURCE_PREPARATION_REVIEW / 실제 실행 승인 아님**. scope009EA669, WI DC5A3B33, PMO source준비 결정 D394B4의 구현 산출물이다. Main 검수·정확 commit/private 게시·새 실행 결정 전 아래 실제 행위를 실행하지 않는다. 현재 실제 writer/quota evidence producer는 채택되지 않아 system provider는 첫 Docker mutation·소비 전에 UNVERIFIED로 거절한다. 이 문서는 실행 가능한 외부 권한을 만들지 않는다.

## 구현과 관측 경계

- `scripts/p03-pg-copy-host.ts`의 import/default/plan/factory 생성은 FS/Git/Docker를 호출하지 않는다. 공개 접점은 FIXED_COPY, proposalCopy, parseCopyArguments, runCopyHost, createCopyDockerAdapter, createCopySystemPorts, parseCopyResult다.
- concrete system adapter는 신규 source/ledger 고정 경로의 owner/mode/canonical/부모·inode·O_NOFOLLOW/open handle·Node/proc/hash 전후, Git exact commit/clean/working bytes 대조, O_EXCL consume+fsync, 0600 receipt append+inode 대조를 구현한다. 이 코드를 이번에 실제 실행하거나 grant/원장을 만들지 않았다.
- 별도 `evidence.binding`은 현재 `{status:UNVERIFIED}`다. 일반 REQUIRE 문자열, 내부 grant, 과거 R2 acknowledgement, decisionDigest는 writer 통제/실할당 quota나 외부 사람 승인을 증명하지 않는다. 새 신뢰 producer의 실제 관측 경로·권위·작업창·대상 instance·재확인 방법이 채택되지 않으면 실제 apply는 진행하지 않는다. 이는 concrete FS/Docker adapter가 없는 skeleton과 구분되는 의도된 사전 거절이다.
- shell에는 실제 도구 검증/신규 root 초기화/copy 전 metadata·공간 gate/내용 및 선정 metadata manifest/복사/원본 전후·사본 cmp 호출선이 있다. 실제 image 도구 지원, filesystem 동작, DB 복구/무결성은 검증하지 않았다. 합성 확인 사실을 실제 관측으로 대체하지 않는다.

## 고정 대상·행위

| 항목 | 고정 후보 |
|---|---|
| source | `/home/daon/anvil-v3-pgcopy-20261027-r1-src` |
| ledger | `/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1` |
| source volume | `anvil-v3-development-pgdata`, instance `dc22a0629e79f259dcd935845e88e58e`, CreatedAt `2026-10-16T03:53:33+09:00` |
| 보존 사본 | `anvil-v3-pgdata-recovery-20261027-r1`, local/신규 nonce/원본 instance label |
| tools/init/copy helper | `anvil-v3-pgcopy-tools-20261027-r1` / `anvil-v3-pgcopy-init-20261027-r1` / `anvil-v3-pgcopy-20261027-r1` |
| immutable image | `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, pull never |
| daemon | `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, `/usr/bin/docker --host unix:///var/run/docker.sock` |
| Node | `/opt/node-v24.21.0-linux-x64/bin/node`, SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c` |

이름 예약·부재·현재 identity를 관측했다는 뜻이 아니다. 하나라도 기존 대상과 충돌하면 사용/삭제하지 않는다.

모든 helper는 network none·publish0·read-only image rootfs·no-new-privileges·cap-drop ALL·pids32·memory256MiB·CPU0.5, stdin은 exact 승인 LF shell blob이다. tools는 UID999:999, 원본/사본 volume0, image 선언 PGdata는 private tmpfs로 덮는다. init은 UID0:0/cap CHOWN만, 원본 mount0/신규 사본 RW/nocopy·선언 PGdata의 private tmpfs는 UID0/GID0/0700, 빈 root directory·0:0/0755·nonlink를 확인한 뒤 그 root 하나만 chmod0700/chown999:999한다. 재귀 변경0이다. copy는 UID999:999/cap-add0·원 PGdata RO/nocopy·신규 사본 `/anvil-recovery-copy` RW/nocopy·`/anvil-copy-audit` private tmpfs32MiB만 사용한다.

Docker create 후에는 fullID/name/nonce/role/image/entrypoint/argv/user/caps/network/ports/HostConfig mount 및 실제 Mounts를 검사한다. 공식 inspect의 Source/Mode/Propagation은 volume inspect의 Mountpoint와 정확 대조한다. 추가 mount/type/target/이름/RW/propagation/모르는 Mounts 필드는 거절한다. 이 형태는 [Docker 공식 예시](https://docs.docker.com/engine/storage/volumes/)를 따른 합성 fixture이며 실제 daemon 실행 증거가 아니다.

## 한 실행안의 순서

1. exact Git/Node/FS/grant binding과 독립 writer/quota evidence를 대조한다. scope `P03_PROTECTED_COPY_R1`·run/source/copy instance·decisionDigest·사안별 evidenceHash·관측/만료창이 모두 같아야 한다. 요구조건은 ACL/xattr NONE_VERIFIED, writer CONTROLLED, 실제 quota allocation512MiB/reserve128MiB다. 현재 source는 미확인 수락 경로를 제공하지 않는다.
2. daemon/image/원본 identity/외부 소비자·helper·사본 이름 부재를 읽어 확인한다. grant를 다시 읽고 fingerprint/최초 승인창을 재확인한다. 원본을 변경하는 서비스를 중지하거나 권한을 확대하지 않는다. writer 통제가 없으면 새 복제 실행을 시작하지 않는다.
3. 최초 Docker mutation 전에 consume를 O_EXCL 단1회 쓰고 fsync한다. 최초 승인창 최대30분/정확 commit·controller/shell hash·nonce·이름/상한과 결박한다. 내부 소비는 외부 사람 승인 인증이 아니다(`externalUserApprovalVerified=false`). 재소비/재시도/창 연장0이다.
4. 새로운 사본 volume1을 만들고 owner/instance/source label·CreatedAt를 대조한다. tools helper1에서 도구 canonical/regular/nonlink/hash/필요기능을 검사한다. 과거 R2의 알려진8개 핵심 도구 지문을 새 helper에서 재대조한다. cp/sort/cmp/df 및 **getfacl/getfattr 후보2**, root 초기화 chmod/chown의 실제 존재/지문/기능은 아직 미관측이다. 설치/다운로드/대체 도구 사용0, 미존재/미지원은 UNVERIFIED로 닫는다.
5. init helper1은 새 빈 root 한 곳만 초기화한다. 실제 하위 자료가 있거나 uid/mode/link가 예상과 다르면 중단·보존한다.
6. copy helper create/inspect 후 외부 evidence를 다시 읽어 검사한다. 고정 argv carrier는 scope/run/sourceInstance/copyInstance/decisionDigest·ACL/xattr/quota/writer 요구조건·writer/quota evidenceHash만 담고 정적 stdin과 분리한다. grant·inspect Cmd와 정확히 같아야 한다. digest는 서명이 아니다.
7. copy 전 root/UID999/GID999/device·link/special/hardlink·중첩 mount·ACL/xattr·실제 available bytes/inodes를 관측한다. getfacl 기본3항목 외 ACL 또는 getfattr 속성이 있거나 상태를 확인할 수 없으면 이번 NONE 계약에서는 cp0이다. 원본 전 manifest를 보호 tmpfs에 만들고 정규화/부분 frame/중복/overflow/도구 exit·stderr/짧은 출력을 검사한다. allocation quota 관측은 host의 별도 검증된 외부 근거이며 df free space를 hardquota로 부르지 않는다.
8. 순수 gate를 통과한 뒤에만 `/usr/bin/cp --archive --no-dereference --one-file-system --preserve=all -- /var/lib/postgresql/data/. /anvil-recovery-copy/`를 호출한다. source RO는 writer 통제 증명이 아니다. ENOSPC/EDQUOT/timeout/도구 오류는 부분 사본 보존이다.
9. 원본 후/사본의 같은 내용·선정 metadata manifest를 반복 작성해 cmp한다. root/빈directory·raw 상대경로·UID/GID/mode/mtime nanosecond/파일길이·ACL/xattr 없음·파일 내용 hash를 결박한다. inode번호/할당blocks/읽기로 변하는 atime은 동등성 항목이 아니다. 파일명에 개행/탭/공백/비UTF8/쉘 문자도 NUL record의 원bytes로만 처리한다. manifest는 민감하므로 PGdata/Git/receipt/stdout에 쓰지 않는다.
10. 정상 exit/close와 같은 fullID/role/nonce/mount를 재확인한 자기 helper만 rm한다. 원본/사본 volume은 성공·실패 모두 보존한다. 외부 소비자와 양쪽 volume identity를 다시 관측하고 비밀 없는 receipt를 남긴다.

## 예산·오류·보존

전체600초/source500초/cleanup reserve25초는 최초 하나의 monotonic deadline에 결박한다. source start는 잔여525초 이상일 때만 가능하다. stage마다 재설정하지 않는다. source logical256MiB/entry100000은 자료 범위 guard이며 실제 할당 hardquota가 아니다. audit tmpfs32MiB는 manifest/정렬 임시파일/원문 stderr 전체의 실제 한도이며 부족하면 실패한다. 메타 stdout16KiB/control256KiB를 분리하고 overflow/encoding/stream/close 불명을 합격으로 바꾸지 않는다. kernel/daemon/미확정 IO까지 기한 내 강제 회수한다는 보장은 없다.

| 실패 시점 | 상태·다음 행동 |
|---|---|
| binding/evidence/preflight 전 | mutation0·소비0. 정확 부족 관측/결정만 다시 준비 |
| consume/receipt 불명 | 소비 nullable/pendingIO·다음 mutation0, 감사 원장 보존·자동 재시도0 |
| volume 생성/identity/init | 원본+새 volume 보존, created/foreign/정상 close 미확인 helper 삭제0 |
| copy/비교 불일치 | 부분 사본 보존·complete=false, PG 시작0 |
| deadline/stream/close 불명 | 확인된 자기 running helper만 TERM 최대1·유한 재관측; force/SIGKILL0 |
| cleanup/receipt 실패 | 신원·close·rm 결과 불명을 보존/필요조치로 보고; volume 삭제0 |

scan/cp/find/hash/sort/df/cmp의 원문 stderr는 private bounded tmpfs에 두고 각 명령의 exit·stderr·필수 출력 완결을 다음 단계 전에 확인하는 호출선을 구현했다. root-init/tool scalar 관측도 같은 exit/stderr/완결 조건에 연결했으며 아래 보완 증거와 실제 NOT_RUN을 구분한다. 보호 manifest는 정상 helper 제거 시 tmpfs와 함께 폐기된다. 미확인 helper를 강제로 지워 민감 자료 보존 의무를 숨기지 않는다. 출력은 닫힌 enum·집계·전체지문만 허용한다.

## 아직 실제 실행을 요청할 수 없는 조건

현재는 source 준비만이다. Main의 정확 source commit/hash 게시·독립 검수 뒤에도, 새 COPY run별 한정 owner/loader/hash-실행 경합 결정과 실제 신뢰 writer/quota evidence producer의 채택/검증이 필요하다. 실제 Git/Docker toolchain 신뢰·도구 후보의 immutable image 내 존재/기능·새 대상 부재/CreatedAt·할당/inode/quota·writer 작업창도 future preflight에서 확인해야 한다. 미채택 evidence를 fake fixture나 단순 파일의 선언으로 대체하지 않는다. 다른 위험수락 지원을 추가하려면 정확 사안/run/대상/decision binding을 별도 검토한다.

미래 실행 진입 명령은 Main이 **최종 exact commit/controller·shell hash와 새 실제 grant**를 결박한 후에만 확정한다:

    /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgcopy-20261027-r1-src/scripts/p03-pg-copy-host.ts --apply

지금 이 명령은 실행 금지이며 현재 system evidence에서는 사전 거절된다. PG 시작/SQL/schema/서비스 전환/Secret/Agent는 이 실행안 밖이다. rollback은 미적용 소스의 정상 revert뿐이며 과거 R2 원장·원본·사본·consume을 삭제해 되돌리지 않는다.


## stderr I1 보완 제출 — 실제 실행/독립 재검수 대기

- root-init 및 도구 canonical/hash/id/stat의 /dev/null 폐기·검사 없는 명령치환을 제거했다. library/framing의 stdin hash는 stdout/stderr/exit를 FD로 분리하고 후행 개행도 보존하는 파일 없는 capture를 사용한다. 각 문자열치환 전에 LC_ALL=C·read -r -d NUL·유한 -n raw guard를 통과해야 하며 NUL 또는 상한 도달은 거절한다. subshell pipefail로 guard 실패와 외부 종료상태를 전파한다. 실패한 stream은 고정 크기 chunk로 폐기하고 helper 전체 deadline을 유지하며, payload cap과 내부 status marker를 구분한다. runtime private wrapper의 byte 측정은 외부 stat을 다시 부르지 않는 Bash builtin이다. scalar는 타입/길이/종료개행/df 두줄 형식, NUL hash는 terminator·marker·원경로·정확 byte 수를 검사한다.
- tool canonical/hash를 확인한 배열만 JSON 렌더링에 사용하여 출력 도중 외부 명령 재실행이 없다. init UID0/CHOWN-only가 자신의 private tmpfs에만 stderr/제어 출력을 기록하며 원본 mount나 capability를 추가하지 않았다.
- 가짜 외부 명령/IO를 주입한 경고(빈 줄 stderr 포함)·실패 exit·짧은 hash·부분 scalar의 후속0, 실제 library framing 호출선의 원문 미노출을 파일/temp 없이 확인했다. 직전 전체 신규 합성/library 40 PASS/0 FAIL/skip0, 6775.8506ms·exit0였다. 이어 raw NUL 잔여 반례2는 각각 외부 stderr146bytes로 RED를 확인했고, 원문 raw guard를 추가한 최종 preparation/library 20 PASS/0 FAIL/skip0, 7964.6336ms·exit0를 확인했다. 변경되지 않은 host23은 이번에 반복하지 않았으며 최종 전체43 fresh PASS라고 표시하지 않는다. 실제 runtime/probe/init/copy 모드를 실행한 증거가 아니다.
- system FS/Git/Docker/consume/receipt는 concrete adapter 소스이며 실제 호스트에서 실행하지 않았다. evidence producer는 별도로 미채택되어 UNVERIFIED다. 이를 단순 grant 선언이나 fake ports로 대체하지 않는다. fresh 실제 도구/owner/metadata/볼륨/할당 관측은 모두 NOT_RUN이다.
- 최종 exact source commit/hash는 Main 게시 이후 별도 결박한다. local main/ref 상태를 추측하거나 이번 작성자가 변경하지 않았다.
