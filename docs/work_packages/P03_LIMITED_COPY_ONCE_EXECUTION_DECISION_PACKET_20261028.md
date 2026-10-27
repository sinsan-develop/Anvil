# P03 개발 원본 보호 사본 — 실제 1회 실행 결정안

2026-10-28 · Main 어울 · 결정 요청 후보 / 실행 승인 아님

## 목적·기존 승인과의 차이

정식 개발 PG가 없는 상태에서 원 volume을 보존하고 보호 사본을 만들어 후속 복구 검증의 선행을 확보한다. 기존 직접승인 call_9739f65e와 call_fdbf857은 코드 저장·합성 시험만 승인하고 실제 cp/PID 신호/container/volume/grant/PGDB/서비스를 명시 제외했다. 이번 차이는 새 Git checkout·보호 원장/grant·신규 volume1·helper3 생성과 원본 전체 읽기/새 사본 쓰기, 새 사본 빈 root 한 곳의 소유 초기화, 정확 자기 cp/helper의 제한 TERM/정상 회수라는 실제 효과다. 기존 승인·옛 R2 조사/위험수락은 재사용하지 않는다.

## 고정 source·검수

- private branch codex/av3-stage-b, source commit 367d9d49daeee08a319431853006db0647129910 (직접 부모8f8c76c9), 지정11경로 source checkpoint. 실제 private 동일·tracked clean·보호 untracked8 보존, private main f976ed5e 불변. source 기준선일 뿐 main 통합·배포·DB 기능 완료가 아니다.
- controller Git LF SHA256 605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8
- shell Git LF SHA256 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC
- 정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028 / scope P03_PROTECTED_COPY_LIMITED_RISK_R1 / 후보 FFC3F2A2979A7845C48B61946A32F0B142C698ED7C6E8004D3038BAD777670D3
- Main 단일 명령91 PASS(efe46f)·type688cab/Bash-n507b93 exit0·독립 실제 source C0/I0. 물리 Linux/proc/job/FD/timer/cp/ACLpartial 동적검수는 NOT_RUN. 상세 결과 docs/04_test_reports/AV3/P03_PG_COPY_LIMITED_RISK_SOURCE_RESULT_20261028.md.

## 생성 전 고정 등록

모든 대상은 WSL-server의 daon UID1000/GID1000 전용이다. 현재 부재를 확인했다는 뜻이 아니며, 승인 후 동일 단발창 안에서 생성 직전 realpath/상위 owner/mode/link·기존 대상 부재·실 daemon/image/volume identity/기존 서비스 영향을 확인한다. 충돌하면 사용·삭제·대체하지 않는다.

|대상|literal·owner·보존/회수|
|---|---|
|Git QA|/home/daon/anvil-v3-pgcopy-20261027-r1-src, daon1000:1000/0700, 위 private exact SHA의 새 빈 checkout. 실행 정상 종료 후 정확 소유 파일만 회수, 신원 불명은 보존|
|원장|/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1, daon1000:1000/0700. grant.json/consumed.json/receipt.jsonl 0600. 소비/감사 보존, 재사용0|
|원 volume|anvil-v3-development-pgdata, instance dc22a0629e79f259dcd935845e88e58e, CreatedAt 2026-10-16T03:53:33+09:00. /var/lib/postgresql/data RO/nocopy, 원본 변경/삭제0|
|새 volume|anvil-v3-pgdata-recovery-20261027-r1, local/신규 nonce/source instance label. 새 빈 root만0:0/0755→999:999/0700. 성공/실패/부분 모두 보존·자동삭제0|
|tools helper|anvil-v3-pgcopy-tools-20261027-r1, UID999:999, 원/사본 mount0, 선언 PGdata는 private tmpfs|
|init helper|anvil-v3-pgcopy-init-20261027-r1, UID0:0/CHOWN만. 원본mount0·새 사본 RW/nocopy, root1곳만 chmod/chown·재귀0|
|copy helper|anvil-v3-pgcopy-20261027-r1, UID999:999/cap0, 원RO·사본/anvil-recovery-copy RW/nocopy, /anvil-copy-audit tmpfs32MiB/0700|

helper 공통 image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/pull never, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, network none/publish0/read-only rootfs/no-new-privileges/cap-dropALL/pids32/memory256MiB/CPU0.5. 포트 생성0. 정확 fullID/name/nonce/image/user/caps/mount/실 close 대조 후 자기 정상 종료 helper만 rm. 불명 helper/부분 사본 강제삭제0, 원R2 원장 불변.

## 요청하는 실행·수락의 한계

최초 승인부터 최대30분 안의 새 runInstance/issuedAt/expiresAt·정확 decision SHA·위 commit/controller/shell·Node/Git/Docker 지문으로만 보호 grant를 생성한다. grant는 사람 승인의 서명이 아니며 externalUserApprovalVerified=false다. Git/Docker 지문은 실행 전 실파일에서 관측·고정하고 기대와 불일치/알 수 없으면 소비·mutation0이다. 원내용/Secret/개별경로·개별hash/DSN을 대화·stdout·Git에 출력하지 않는다. 원문은 helper private bounded tmpfs에만 둔다.

Node /opt/node-v24.21.0-linux-x64/bin/node SHA256 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c, numeric owner1001:1001/0755·부모·open inode/hash·proc 대조를 유지한다. 이 대조로 해소되지 않는 owner/loader/hash→실행 경합을 새 정확 run에 한해 수락할지 결정해야 한다.

writer 완전통제·시점 일관성은 미입증이다. Docker 소비자0·원본 전후/사본 세 번의 bytes/선정 metadata 일치만 확인하며 원본RO가 다른 writer 부재를 증명하지 않는다. hardquota는 미강제이며 공유 저장소 고갈/검사 사이 증가/즉시중단 불가 위험이 남는다. ACL/xattr는 도구 미설치/필요 기능 미지원인 경우만 미확인 수락 후보이며 이미 속성 존재·조회오류·부분출력·보존실패는 계속 거절한다. 이 잔여 위험이 불수락이면 실제 quota/격리 저장소·writer 통제의 별도 대안을 택하고 이번 실행은 하지 않는다.

전체600초/source500초/회수 reserve25초, source 시작 잔여525초 이상. logical256MiB/entries100000/관측할당512MiB guard, 예상max(logical,allocation)+32MiB에 free128MiB 여유·inode entries+100 요구. 감시는 최대10초 주기·같은 최초 deadline, 여유128MiB 미만/불명·오류는 제한 TERM/보존. stdout16KiB/control256KiB/audit32MiB. kernel/daemon/IO 불명까지600초 강제회수 보장0. SIGKILL/force/retry/창연장0.

승인 후 실행 진입은 위 exact checkout에서 고정 env/PATH와 Node로 scripts/p03-pg-copy-host.ts --apply-limited-risk 단1회다. 현재는 실행하지 않는다. 각 role 최대create/start1, 최초mutation 전 O_EXCL 단발 consume/fsync·감사. 원본 전후/사본 결과 불일치·기한·출력/신원/회수 불명은 NOT_COMPLETE·PG시작0이다.

## 성공의 의미·다음 승인 제외

성공 enum COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY, writerFullyControlled=false/hardQuotaVerified=false/pointInTimeConsistencyProven=false/postgresStarted=false를 그대로 보고한다. 복사 성공을 DB 무결성/복구·API·화면·전체P03/WORK_PLAN 완료로 바꾸지 않는다. 사본에서의 PG기동/SQL/schema·정식 서비스 복구·기존권한/Secret/CA/인증서·Oracle/운영·실Agent/비용은 이번 결정 범위 밖이다. rollback은 서비스 미변경·원본/새부분사본 보존이며 원본복원/데이터 불변을 약속하지 않는다.

PMO 요청: source 검수·위 정확 실제효과/잔여위험/검증/보존을 대조해 위임 가능 부분만 판단하고, 별도 사람 결정이 필요한 부분은 이 후보의 정확 차이만 요청한다. 다음 업무 배정이나 전체개발 대기는 요청하지 않는다.

## 실행 봉투·수명·관리 책임 보완

이 문서는 기존 실행안의 strict 명령을 대체하는 별도 LIMITED 결정 후보다. 실행자는 Main 어울이며 WSL의 daon1000:1000로 새 빈 QA를 mkdir0700·private Git fetch/정확 commit checkout·tracked clean/정확 Git LF 두 지문 대조, ledger mkdir0700·grant0600 신규 배타 생성까지 담당한다. 다른 계정/권한 확대·기존경로 재사용·수정은 없다. 최초 승인시각부터30분을 준비/실행 창과 QA 목표 최대수명으로 등록하고, 만료 뒤 새 실행/연장은 없다. 기한 내 안전회수 불명이면 강제삭제하지 않고 실제 잔여·소유자·후속 정확 조치를 보고한다. 이때 목표수명 준수 실패를 숨기지 않는다.

limitedAcceptance는 scope/policy/candidateSha256/runInstance/sourceInstance/copyInstance/commit/controllerSha256/shellSha256/decisionSha256/issuedAt/expiresAt/delta의 닫힌 객체다. runInstance는 승인 후 새 nonce이며 copyInstance와 같고, 시각/소스/결정 지문은 최상위 grant와 정확히 같다. sourceInstance는 위 dc22…다. delta는 writerFullyControlled=NOT_PROVEN_ACCEPTED_FOR_THIS_RUN, hardQuota=NOT_ENFORCED_ACCEPTED_FOR_THIS_RUN, acl/xattr=UNAVAILABLE_ONLY_BASIC_METADATA_ACCEPTED, numericOwner1001=NEW_EXACT_RUN_RISK_ACCEPTED다. decisionSha256은 실제 이 효과를 승인한 새 결정기록의 SHA256이며 현재 문서 hash·코드승인·옛 R2 수락으로 치환하지 않는다. 지금 nonce/시각/결정/grant를 생성하거나 실제 수락했다고 기록하지 않는다.

정확 호출(아직 실행금지): /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgcopy-20261027-r1-src/scripts/p03-pg-copy-host.ts --apply-limited-risk

종료 후 Main은 앞 실행과 별도 읽기 명령으로 등록 helper3의 이름/fullID 부재, 원/사본 name·instance·CreatedAt·labels와 소비자, source QA 회수·ledger 보호모드/소비기록·사본보존을 확인한다. 원장·새/부분 사본은 후속 복구 결정까지 Main 관리하에 보존하고 자동삭제0. 회수가 불가능한 등록 helper/QA는 이유와 실제 소유신원·잔여를 PMO에 보고하며 사본/원장 삭제를 rollback으로 하지 않는다. 독립 읽기 확인 미실행은 NOT_RUN으로 남긴다.
