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


## LIMITED 별도 경로 최종 연결 초안 — 승인 전 메모리 검토본

기존 strict --apply·scope P03_PROTECTED_COPY_R1·독립 evidence/원 parser·실패 자동 전환0을 보존한다. 명시 --apply-limited-risk만 새 scope P03_PROTECTED_COPY_LIMITED_RISK_R1, 정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028, 후보 FFC3F2A… 및 새 사안별 수락/run/원본·사본 instance/decision/최종 commit·controller·shell hash/최초 승인창에 결박한다. 내부 수락 선언과 digest는 외부 사람 승인을 인증하지 않는다.

Node CLI는 모든 const/함수 정의 뒤 마지막 진입점에서 새 runner로 분기한다. shell도 마지막 dispatcher에서 새 rolemode/carrier만 limited parser에 보내며, strict 실패에서 limited 함수를 호출하지 않는다. source/default는 PREPARATION_ONLY다. 새 helper/capability/설치는 없다. 사용자 직접 승인5398byte runtime adapter(A1FE8953…)는 그대로 보존한다.

고정 도구의 파일 부재는 성공한 /usr/bin 열거의 ENTRY0에서만 UNAVAILABLE/NOT_INSTALLED로 분류한다. 파일/canonical/hash/실행·help의 오류 또는 stderr는 ERROR로 중단한다. help가 완결됐지만 필요한 기능이 없을 때만 REQUIRED_FEATURE_UNSUPPORTED다. AVAILABLE이면 모든 원본/사본 경로에서 실제 ACL 기본3항목과 빈 xattr를 확인하며 PRESENT/ERROR/PRESERVATION_FAILED는 계속 거절한다. UNAVAILABLE로 선택한 항목만 UNVERIFIED_TOOL_UNAVAILABLE로 남기고 basic 선정 metadata를 비교한다.

실제 limited runtime은 audit/원본RO/신규 사본 root·identity를 검사하고 source entry의 monotonic 시간을 먼저 고정한다. 외부 host 최초600초·helper timeout500초를 유지하며 내부 cp deadline은 entry+475초, 관측/wait 정리는 entry+500초 이내로 둔다. scan 뒤에 budget을 재설정하지 않는다. 예상 필요량 max(논리,관측 regular 할당)+32MiB, fresh free bytes >= 예상량+128MiB, inode >= entries+100을 cp 전 요구한다. 복제 중/종료 직후는 128MiB·inode threshold와 최대10초 fresh 관측을 요구한다. 실제 hardquota/예약이 아니며 helper의 builtin timer tick은 최대5초 후보다. 부하·도구 지연이 10초를 넘으면 실패로 latch한다.

실제 cp는 원 PID·PPID·/proc 시작지문을 저장하고 동일 Bash child job만 wait/reap한다. TERM은 identity 재확인 뒤 해당 PID에 최대1회, unknown PID에는 보내지 않는다. 익명 FD timed read 및 즉시 wait한 timer child를 사용하여 디스크 FIFO·새 도구를 만들지 않고 FD를 명시 닫는다. 최초 위반은 cp 종료/늦은 성공으로 지우지 않으며 종료·wait·timer/pipe 불명이면 성공 수집0·부분 사본/불명 helper 보존이다. 빠른 cp가 최초 지문 수집 전에 끝나는 경우는 사실을 만들지 않고 fail-closed한다. 실행 중 종료된 원 child는 자기 job의 정상 reap이 확인되는 경우에만 완료로 처리한다.

원본 전후/사본의 raw NUL 내용·선정 metadata 비교와 private bounded stderr/manifest를 유지한다. 성공 enum은 COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY이며 writerFullyControlled=false/hardQuotaVerified=false/pointInTimeConsistencyProven=false/postgresStarted=false다. 원 full container ID는 host inspect가 확인하며 helper의 nullable ID를 그 문맥에서만 결합한다. 이 결합을 helper 관측이나 writer/quota 증명으로 표시하지 않는다.

이 초안은 아직 파일 저장·실제 실행 승인이 아니다. 구체 source/허용5 payload 전체 독립 검토 및 직접 확인 뒤만 저장·합성검증한다. 실제 provider/grant/소비/관측·cp/TERM/컨테이너/PG/DB/서비스/Agent 실행은 별도이며 현재0이다. 실제 image의 optional 도구/OS proc/job/FD semantics·성능은 NOT_RUN이고 합성 시험으로 승격하지 않는다.


## 직접 승인 후 source 저장·합성검수 기록 — 2026-10-28

위 메모리 초안 절은 승인 전 검토 시점의 원문이다. 이후 신산님 직접답변 call_fdbf857397d643229bdef3f913d404ee/item0 ‘남은 source 묶음·필수 검수 보완 승인’과 기록 docs/approvals/P03_LIMITED_REMAINING_SOURCE_20261028.json(F64CDBAA…)에 따라 지정5 안의 source 저장·합성검증을 수행했다. 실제 실행 권한은 여전히 없다.

- 실제 저장 shell: 54922bytes / SHA256 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC. 승인 adapter5398bytes/A1FE8953…를 보존했고 생산 함수14개는 각 정의1회·override0이다. strict 함수 원문23499bytes/460AAAF1… 및 기존 strict dispatcher case는 그대로다.
- deadline8 반례는 제품 변경 전 0PASS8FAIL/skip0/exit1(1090.1973ms)이었고, source 저장 후 같은 선택 명령에서 8PASS0FAIL/skip0/exit0(775.8063ms)이었다. initial sample 후 시작 직전, DONE 판정 전, DONE 최종 sample 후에 동일 최초 source/전체 deadline을 재검사한다.
- `node --test tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts`: 한 명령에서 84PASS0FAIL/skip0/exit0, 10105.287ms. 합성 ports/library의 새 LIMITED41과 직접 영향 strict43만 증명한다.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`: exit0. 고정 Git Bash `--noprofile --norc -n scripts/pg-recovery-copy.sh`: exit0.

실제 image의 도구 존재·hardmetadata, OS proc/job/timer FD, 실제 cp/PID/TERM·신호·컨테이너/volume/grant/PG/DB/서비스/Agent는 NOT_RUN이다. ACL 마지막 비개행 partial 거절은 limited scan의 완결 조건을 정적으로 검토했지만, 실제 scan은 private 파일 IO가 필수여서 이번 무파일·새 자원0 조건의 동적 시험은 NOT_RUN이다. shell의 새 limited dispatcher는 source 정의 순서와 binding 연결을 정적으로 확인했으며 실제 실행 모드를 호출하지 않았다. 합성 PASS는 실제 복제·권한·복구 완료나 사용자 실행 승인을 뜻하지 않는다. Main fresh 검증·독립 source 검수는 별도다.


추가 필수 호출선 합성검수: `node --test --test-name-pattern='LIMITED 마지막호출선' tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts`에서 7PASS0FAIL/skip0/exit0, 870.3595ms였다. 세 limited rolemode의 invalid carrier를 검사할 때는 메모리 stdin 안의 모든 실도구·probe/init/runtime 함수에 fake sentinel을 명시 주입해 실제 진입0을 확인했다. helper raw fullID=null은 host 원 fullID의 전후 inspect 문맥에서만 결합하고 known 다른ID/host 신원불명은 거절·부분사본보존했다. 최초 신원확인 후 proc 소실은 원 job DONE/CLOSED/REAPED가 모두 확인될 때만 수락했고 미회수·open·최초 identity 실패는 성공수집0이었다. 이들은 가짜 ports/clock/cp/proc/TERM/wait/dispose이며 실제 OS 관측·신호가 아니다. 위 84개 결과와 이번7개 결과는 별도 명령의 실제 출력이다. 두 시험 파일의 이전 전체 bytes를 append prefix로 보존했고 제품 source는 04FE…로 불변이다. 추가 시험 후 타입검사도 exit0이었다.
