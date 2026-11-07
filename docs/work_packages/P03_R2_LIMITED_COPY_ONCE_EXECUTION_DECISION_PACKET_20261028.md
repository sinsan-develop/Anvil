# P03 R2 보호 사본 — 실제 1회 실행 결정 packet

2026-10-28 · Main 어울 · **새 실제 실행 결정 요청 후보 / 실행 승인 아님**

## 요청 목적과 현재 경계

보존 중인 R1과 별도의 R2 고정 대상에 원 PG volume의 bytes 및 선정 metadata 사본을 만드는 단1회의 실제 효과와 잔여 위험을 결정받기 위한 문서다. 이 packet 작성·source 검수·PMO source-only 채택은 실제 실행 승인이 아니다. 새 actual 직접답변과 그 정확 기록이 확인되기 전 신규 QA checkout·원격 관측·grant/nonce·volume/helper·cp/TERM·환경 효과는 모두0이다. 승인 전 NOOP/plan/probe를 명목으로 환경을 먼저 조회·생성하지 않는다.

실행자는 Main 어울 한 명이다. source 구현 담당자나 다른 Agent가 실행하지 않는다. 실제 승인 여부·정확 대상/위험이 불명확하면 실행하지 않고 필요한 결정만 요청한다. 이 문서는 issuedAt/expiresAt/runInstance/새 decision SHA를 만들거나 이미 수락받았다고 표시하지 않는다.

## 원 R1·기존 권한 보존

원 실행 packet `P03_LIMITED_COPY_ONCE_EXECUTION_DECISION_PACKET_20261028.md`(Main 식별 C2B1)와 원 source `367d9d49daeee08a319431853006db0647129910`/controller LF `605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8`는 과거 증거로 보존한다. 원 actual 결정 SHA `337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0`의 단발 승인은 소진됐고 새 R2 실행에 재사용하지 않는다. 과거 source 승인5398/54922·옛 R2 조사/위험 수락도 이번 actual을 승인하지 않는다.

Main fbe8b8의 원 R1 결과는 NOT_COMPLETE/create-volume/COPY_VOLUME_IDENTITY, consumed=true/copyCreated=true/helpers0/cp 미도달이다. [원 실제 결과](../04_test_reports/AV3/P03_LIMITED_COPY_ONCE_20261028_RESULT.md) SHA `7E365AC623FF97700C91BDA2F8A8CFB0DDF5899581BC92342914FB46CB89272C`를 따른다. 원 R1 사본 `anvil-v3-pgdata-recovery-20261027-r1`과 `/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1`의 grant/consumed/receipt는 삭제·비우기·덮기·재사용하지 않는다. source 교정과 합성 PASS로 원 actual 실패를 성공으로 바꾸지 않는다.

원 R1 생성 관측에서 copy volume의 `anvil.instance`는 `cef316aec47f84f6d3e0f27f1e1c939a`, `anvil.source-instance`는 `dc22a0629e79f259dcd935845e88e58e`였다. 보존 대상 ledger의 정확 경로는 `/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1`이다. 이 값은 원 실패 당시 식별 근거이며 지금 새 실측을 했다는 뜻은 아니다. R2의 새 nonce·instance는 아직 생성하지 않았다.

R2가 새로 실제 승인되어 실행되면 보존 중인 R1에 더해 **새 volume1개가 추가**된다. 실패/부분 R2도 보존하여 저장소 공간을 계속 차지한다. 지금 R1/R2의 현재 사용량·가용 공간·대상 부재를 관측했다는 뜻은 아니다. 추가 공간과 보존 책임을 이번 actual 판단에 포함한다.

## 실행할 source의 정확 고정

- Main e2bfe3/879898/63b490 게시: private branch `codex/av3-stage-b`, exact commit `8e9292d83c4ebe857919480b0d3468a0f7c1eaa3`, exact13 local/private 동일·tracked clean·보호 untracked8·main f976 불변 확인. 이는 source 기준선이며 실제 실행·main 통합·배포·DB 수용 증거가 아니다.
- controller Git LF SHA256 `532621070134EC7AE63151DEE3F25EFD7D49456CC7481E4C79401157E1695261`.
- shell Git LF SHA256 `CF6B604C2EBB3DC8552C9F341934CC00A5F7970AD8B2F17C1435DF6B14C0A9C8`.
- 새 R2 후보 `docs/contracts/P03_PG_COPY_LIMITED_RISK_R2_BINDING_CANDIDATE_20261028.md` SHA `467A5FFF50C0C22D76F283AF144A312E8BA7D805AA5E5F12AF52870FB63064AF`. 부모 FFC3 원문 보존. source 내부 candidate 결박은 이 SHA의 lowercase 값이다.
- PMO source-only 채택 기록 `docs/approvals/P03_R2_BINDING_SOURCE_PMO_20261028.json` SHA `3A7094B80EA33B315A5FEBE7A161C93FB8444B8F9BE8833BFFF2EBAB9A81A978`. 새 actual 권한0이다.
- protocol scope `P03_PROTECTED_COPY_LIMITED_RISK_R1`, policy `P03_COPY_LIMITED_RISK_POLICY_R1_20261028`, 명시 mode `--apply-limited-risk`를 유지한다. 접미사 R1은 protocol 버전이며 원 R1 리소스 재사용 허가가 아니다. strict --apply나 자동 fallback은 실행하지 않는다.
- source 결과 `P03_R2_BINDING_SOURCE_RESULT_20261028.md` SHA `D6F2B914685682CA64CC41189D99C79B5E53D987B8D58EC9D51A2DEAA8BB9B1F`: Main dbe2df/51d6aa 직접3 단일111PASS/10104.8899ms·type99af51/Git Bash-n5e543f exit0, 독립 제품2/test3 C0/I0/M0. 이 시험은 가짜 ports·Bash source 합성이며 실제 Linux/helper/cp/IO/FD/timer/ACLpartial 동적 검수가 아니다.

후보 SHA를 source에 반영한 뒤 exact commit/controller/shell 지문을 이 별도 packet에 결박했다. source가 이 packet hash를 다시 요구하는 순환은 만들지 않는다. 실행 시 최신 HEAD로 바꾸거나 과거367/605 source를 선택하지 않는다.

## 새 실제 승인 후 생성 전 고정 등록

모든 대상은 WSL-server의 daon UID1000/GID1000 전용이다. 승인 후 같은 단발 창에서 Main이 생성 직전 realpath/상위 owner/mode/link·각 대상 부재·도구/daemon/image/원본 신원·기존 서비스 영향을 대조한다. 충돌·불명·권한 부족이면 사용·삭제·대체·경로 치환 없이 중단한다. 아래 표는 등록이지 현재 관측 결과가 아니다.

| 대상 | 정확 literal·권한·효과·보존/회수 |
| --- | --- |
| 새 source QA | `/home/daon/anvil-v3-pgcopy-20261028-r2-src`, daon1000:1000/0700. 새 빈 일반 Git checkout에 위 private exact commit만 가져온다. `.git`은 디렉터리이며 hooks/fsmonitor 비활성 등 controller의 고정 Git 설정과 검사를 그대로 따른다. 정상 종료 뒤 정확 소유 QA만 회수, 신원/회수 불명은 보존·보고 |
| 새 ledger | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r2`, daon1000:1000/0700. `grant.json`/`consumed.json`/`receipt.jsonl`0600·regular/nonlink/nlink1·보호 owner. O_EXCL/fsync·receipt 동일 inode append. 소비/감사는 보존·재사용0 |
| 원 source volume | `anvil-v3-development-pgdata`, instance `dc22a0629e79f259dcd935845e88e58e`, CreatedAt `2026-10-16T03:53:33+09:00`, local driver/scope 및 원 labels exact. `/var/lib/postgresql/data` RO/nocopy. 변경/삭제/PG 시작0 |
| 새 R2 volume | `anvil-v3-pgdata-recovery-20261028-r2`, local/새 run nonce/source-instance labels. 새 빈 root만0:0/0755→999:999/0700. 성공·실패·부분 모두 보존, 자동삭제0 |
| tools helper | `anvil-v3-pgcopy-tools-20261028-r2`, UID999:999/cap0, 원본·사본 mount0, 선언 PGDATA는 private tmpfs. 도구 검수 후 정상 자기 helper만 회수 |
| init helper | `anvil-v3-pgcopy-init-20261028-r2`, UID0:0/CHOWN만. 원본 mount0, 새 사본 RW/nocopy. 새 빈 root1곳 chmod/chown만·재귀0 |
| copy helper | `anvil-v3-pgcopy-20261028-r2`, UID999:999/cap0, 원본 RO·사본 `/anvil-recovery-copy` RW/nocopy, `/anvil-copy-audit` private tmpfs32MiB/0700 |

helper 공통: image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, pull never; daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`; network none/포트 publish0/read-only rootfs/no-new-privileges/cap-dropALL/pids32/memory256MiB/CPU0.5. 원본/사본 volume driver/options·mount 경로/RO/RW/nocopy 및 fullID/name/nonce/image/user/caps/argv/실 close를 대조한다. helper는 각 role create/start 최대1, 전체 최대3이다.

## 새 grant·실행자·시간창

새 actual 직접답변으로 정한 최초 승인 시각부터 최대30분을 준비/실행 창과 QA 목표 최대수명으로 고정한다. issuedAt/expiresAt은 그 답변 뒤에만 생성하며 expiresAt은 최초승인+30분을 넘지 않는다. 준비 지연으로 창을 새로 시작·연장하지 않는다. 새 runInstance lowercase32hex nonce 및 새 actual 결정기록 SHA·위 commit/controller/shell·Node/Git/Docker 지문으로만 grant를 신규 생성한다. 지금 값/파일은 만들지 않는다.

grant의 Git/Docker 지문은 각 `/usr/bin/git`·`/usr/bin/docker` 실제 정규 nonlink 파일과 root 소유/no group-or-other-write·parent·전후 inode/hash에서 관측하여 고정한다. 알 수 없거나 불일치하면 consume/첫 mutation0으로 닫는다. 신규 source QA와 ledger 및 부모의 owner/mode/realpath/link 검사는 controller 그대로 유지한다. 기존 인증 수단만 사용하며 Secret/계정/키/권한을 만들거나 고치지 않는다. raw 원본·DSN·개별 경로/내용/개별hash·Secret을 대화/stdout/Git에 출력하지 않는다.

Node `/opt/node-v24.21.0-linux-x64/bin/node`, SHA `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`, numeric owner1001:1001/0755와 `/`·`/opt` root0:0/0755, Node directory/bin1001:1001/0755·정규/nonlink/nlink1·open 전후 inode/hash·/proc/self/exe 대조를 유지한다. 이 검사로 해소되지 않는 numeric owner/loader/hash→실행 경합은 새 exact run별 위험 수락이 필요하다.

limitedAcceptance는 scope/policy/candidateSha256/runInstance/sourceInstance/copyInstance/commit/controllerSha256/shellSha256/decisionSha256/issuedAt/expiresAt/delta의 닫힌 객체다. sourceInstance는 고정 원본, copyInstance=새 runInstance이며 시각/소스/결정 지문은 top-level grant와 동일하다. delta는 다음 원 의미를 유지한다.

- writerFullyControlled=`NOT_PROVEN_ACCEPTED_FOR_THIS_RUN`
- hardQuota=`NOT_ENFORCED_ACCEPTED_FOR_THIS_RUN`
- acl/xattr=`UNAVAILABLE_ONLY_BASIC_METADATA_ACCEPTED`
- numericOwner1001=`NEW_EXACT_RUN_RISK_ACCEPTED`

새 decisionSha256은 이 실제 효과와 위험을 승인한 새 기록의 SHA다. 후보·이 packet·source 승인·옛337E·옛 수락으로 치환하지 않는다. grant는 사람 승인 서명이 아니며 결과의 externalUserApprovalVerified=false를 유지한다. closed key/enum·grant/evidence canonical 시각·nonce/labels·원 source identity·처음/후속 신원 검사를 완화하지 않는다.

승인 후 Main이 사용할 정확 entry(현재 실행금지):

```text
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgcopy-20261028-r2-src/scripts/p03-pg-copy-host.ts --apply-limited-risk
```

위 고정 checkout에서 단1회만 진입한다. 생성 전 source tracked clean·working controller/shell의 Git LF blob 일치·branch/remote/development/commit 및 ledger/grant를 확인한다. 첫 실제 mutation 전에 O_EXCL 단발 consume/fsync와 감사 기록을 수행한다. copyVolume/helper names 부재·source consumer0 및 최소 실행 잔여를 확인하고, old R1 경로·이름·candidate/grant는 재사용하지 않는다. 실패 뒤 수동 분해 실행·직접 cp·guard 우회·다른 mode로 전환·동일 grant 재실행은 없다.

## 수락할 위험4와 한도

1. writer 완전통제·시점 일관성은 미입증이다. Docker source 소비자0·원본 RO·원본 전후/사본 bytes·선정 metadata 일치가 모든 writer 부재나 일관된 DB snapshot을 증명하지 않는다.
2. filesystem hardquota는 미강제다. 논리/할당/가용량 guard와 감시는 hardquota의 대체 입증이 아니며 검사 사이 증가·공유 저장소 고갈·즉시 중단 불가 위험이 남는다. 보존 중인 R1에 새 R2/부분사본 공간이 추가된다.
3. ACL/xattr는 도구 미설치 또는 필요한 기능 미지원일 때만 미확인 수락 대상이다. 도구 존재 시 속성 없음 검증을 요구하고 이미 속성 존재·조회 오류·부분출력·stderr·보존 실패는 계속 거절한다.
4. Node numeric owner1001과 owner/loader/hash→실행 경합의 잔여 위험은 이번 exact run에 한해 새로 판단한다. 기존 검사나 옛 위험 수락을 현재 완전 통제 증거로 바꾸지 않는다.

불수락이면 실행하지 않고 writer 통제·별도 격리/quota 등의 대안을 별도 결정한다. 현재 대상의 실제 공간·파일권한·도구/서버 상태·실측 증거는 아직 없다. 승인 후 실제 전제 검사를 통과하지 못하면 중단하며 문서의 고정값만으로 확인됐다고 하지 않는다.

전체 monotonic600초/source500초/회수 reserve25초·source 시작 잔여525초 이상을 유지한다. logical256MiB/entries100000/관측 할당512MiB guard, 예상 max(logical,allocation)+32MiB 및 추가 free reserve128MiB·inode entries+100을 요구한다. audit tmpfs32MiB/stdout16KiB/control256KiB, 최대10초 관측 간격·같은 최초 deadline이다. 여유/관측 불명·위반이면 정확 자기 cp identity/PID/parent/starttime만 확인해 TERM 최대1·유한 wait/회수·보존한다. SIGKILL/force/retry/창 연장0이다. kernel/daemon/IO 불명까지600초 내 강제 회수·0손실을 보장하지 않는다.

## 목표 검증·성공 의미

목표는 source 전/후와 copy의 bytes·RAW_PATH·TYPE·UID·GID·MODE·MTIME_NANOSECONDS·REGULAR_LENGTH 선정 metadata 일치뿐이다. raw path/NUL framing과 entry/logical 합계·지문·종결/출력 cap·ACL/xattr 분기·공간 guard·monitor identity/위반 latch/정상 wait·FD/timer 종료를 검사한다. mismatch/오류/부분출력·기한·신원·실 close/회수 불명은 NOT_COMPLETE로 보고하고 부분사본을 보존한다.

성공 enum은 `COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY`, writerFullyControlled=false/hardQuotaVerified=false/pointInTimeConsistencyProven=false/postgresStarted=false를 유지한다. 시각 source 교정의 정상 offset/fraction 지원은 metadata 표현 검사이며 실제 Docker version 확인이나 새 container nano 실측 증거가 아니다.

사본에서 PostgreSQL 시작·PG/SQL/schema·정식 DB/서비스 복구·DB 무결성·API/UI·기존 인증/권한/Secret/CA/certificate·Oracle/운영·실 Agent/비용은 이번 결정 범위 밖이다. 기존 서비스·원본 volume·기존 컨테이너를 중지/재시작/변경하지 않는다. 복사 성공을 전체 P03/WORK_PLAN 완료·운영 수용으로 바꾸지 않는다.

## 종료·보존·rollback 책임

Main은 정확 fullID/name/nonce/image/user/caps/mount·실 close와 exited/ExitCode0를 대조한 **자기 정상 종료 helper만** 정상 rm한다. 신원/종료 불명·부분 실패를 강제 삭제하지 않는다. 새 source QA도 등록 경로와 소유 파일·링크 이탈/새 자료를 대조해 안전하게 회수 가능한 것만 정상 회수한다. grant·consumed·receipt ledger와 성공/실패/부분 R2 volume은 후속 복구 결정까지 Main 관리하에 보존하고 자동삭제0이다. 원 R1은 계속 별도 보존한다.

실행 후 별도 읽기 확인으로 등록 helper3의 name/fullID 부재, 원/사본 name·instance·CreatedAt·labels와 source/copy consumers, source QA 회수, ledger owner/0700·각파일0600/소비·감사 기록·사본 보존을 확인한다. 독립 읽기 확인 미실행은 NOT_RUN으로 남긴다. 이 확인 권한을 새로운 복제/쓰기·임의 전역 프로세스/환경 조사로 넓히지 않는다.

최초 승인+30분 목표 QA 수명 안에 안전 회수 불명이면 강제 삭제·실행창 연장 없이 실제 잔여/소유자/이유·필요한 정확 후속 조치를 PMO에 보고한다. 목표수명 미준수를 숨기지 않는다. 제한 실패·오류와 원 복제/후속 정리 결과를 분리한다. rollback은 서비스 미변경·원본/새 부분사본/원장 보존이며 원본 복원·데이터 무변경 보장이나 volume/ledger 삭제가 아니다.

## 결정 요청·미검증

PMO는 source 검수·위 정확 새 실제 효과/추가 저장공간·위험4·검증/기한/보존 책임을 대조해 위임 가능 부분만 판단하고 별도 사람 결정이 필요한 부분을 이 packet의 정확 차이로 요청한다. 새 actual 직접 승인과 기록이 확인되기 전 실행하지 않는다. 다음 업무 배정이나 전체 개발 대기를 요청하는 문서가 아니다.

현재 실제 R2 자원 부재·도구/daemon/image/원본 현재성·공간/권한·물리 Linux/cp/프로세스/FD/timer/복제/회수는 NOT_RUN이다. packet 작성만 완료했으며 nonce·issued/expires·grant·원격 관측·QA/volume/helper·cp·PG/SQL/서비스 작업0이다. 별도 독립 packet 검토를 거쳐 결정 전제·허용 범위를 확정한다.
