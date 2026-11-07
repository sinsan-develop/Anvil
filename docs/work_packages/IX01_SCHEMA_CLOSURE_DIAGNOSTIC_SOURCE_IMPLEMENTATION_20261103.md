# IX01 schema 의존 진단 source 구현 계획
> 수행 방식: superpowers:subagent-driven-development를 적용하되 신산님 지시대로 기존 Primary만 재사용한다. Main은 문서·검수·통합을 맡는다.

**목표:** 고정 Git의 SQL source를 새 격리 PG에 한정해 진단할 실행 도구를 준비한다. 현재 실제 실행은 금지한다.
**구조:** 기존 QA의 소유 resource 검산/수명/정리 원형을 재사용하는 한정 Bash driver와 순수 unit, source allowlist다. 범용 migration/배포 시스템을 새로 만들지 않는다.
**기술:** 기존 Git·Bash·Docker CLI·psql(PG image 내장), 기존 Node unit 도구. 의존성 설치/갱신0.
**근거:** WORK_PLAN/INTEGRATION_WORK IX01, IX01_ACTUAL_JOURNEY_TEST_SOURCE_PREPARATION_RESULT_20261103.md 및 현재 quota DAG 조사. 기존 실제 QA source를 참고하며 수정하지 않는다.

2026-11-03 · Main 어울. **SOURCE_ONLY / ACTUAL_EXECUTION_NOT_AUTHORIZED**.

## 허용 경로·소유
기준 codex/av3-stage-b, HEAD d2f6ab8c74fad09f26319f77b3acb80afe3f927b. 기존 Primary의 code/data writer 정확3개:
1. scripts/qa-ix01-schema-closure.sh
2. tests/unit/IX01/schema-closure-controller.test.ts
3. docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261103.tsv

다른 source·SQL·기존 QA·보호3·Main 문서는 수정하지 않는다. 추가 경로/의존성이 필요하면 쓰기 전 반환한다.

## 전역 제한
- SQL 기준 commit은 위 d2f6ab8c다. git ls-tree로 확인한 tracked .sql/.sql.pending106개만 path/id/raw SHA256/bytes 목록으로 고정한다. Git blob을 읽으며 사용자 파일·실제 환경·Secret을 읽지 않는다.
- allowlist의 정렬은 표시 순서일 뿐 적용 순서가 아니다. driver는 별도 명시 선택 순서/그 digest가 없으면 거절한다. 106개를 기본 자동 적용하지 않는다.
- 이 도구는 원 SQL bytes 그대로의 DDL 정의 설치 의존 진단이다. schema_migrations에 가짜 완료를 쓰거나 SQL envelope/조건을 고쳐 통과시키지 않는다. 일부 정의 설치가 SQL runtime/RLS/IX01/기능 PASS가 아니다.
- 기존 권한/키/서비스·P03 R3/원 볼륨/사용자 자료/Agent·ysna/Oracle·제품 네트워크에는 접근하지 않는다.
- 기본/import/--plan은 DB·Docker·SSH·자원 생성0. 실제 mode는 명시 실행 입력과 외부 플랫폼·사용자 승인 뒤에만 가능하며 지금은 실행하지 않는다. 영구 null scaffold 대신 검산 가능한 실행 입력을 갖춘다. 입력 hash 자체는 사람 승인 증명이 아니다.

## 실제 실행안 후보의 고정 경계 — 아직 미승인
- 대상은 기존 WSL-server 개발 대상과 예상 Docker daemon ID e3349f1d-dbfc-478a-96d9-295bf6c6839e. 이 값은 과거 관측이며 실행 전 다르면 변경 없이 중단한다.
- 기존 cache PG15 image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build/기존 image 변경0. 부재/신원 불일치면 중단.
- 새 literal 컨테이너 anvil-ix01-ddl-pg-20261103-r1-a1/a2/a3 중 slot1~3만 후보. 동시1. 다음 slot은 앞 slot의 확인된 정리 뒤에만 허용하고 UNKNOWN 후 자동 재시도/대체0.
- network none, port publish0, bind/named/anonymous volume0. PGDATA와 필요한 socket/tmp는 명시 tmpfs만, UID/GID999:999·read-only root·cap-drop ALL/no-new-privileges·pids64·memory512MiB·CPU1.
- source image가 선언한 VOLUME의 목록과 tmpfs 덮임을 시작 전에 확인한다. create→fullID/label/image/mount/port/network 검산→start. 예상 밖 mount/기존 이름은 승인 범위 밖이며 보존·보고.
- 새 빈 DB anvil_v3_ix01_ddl_20261103_r1_a1/a2/a3와 합성 역할만 사용한다. 기존 QA bootstrap의 비 superuser app/migrator 권한을 보존하고, 오류를 없애려고 SUPERUSER/BYPASSRLS로 올리지 않는다.
- Docker 내부 local Unix socket만 사용한다. 실제 API/Web/Agent/Node 서비스·로그인/관리 키/CA·기존 DB/데이터를 사용하거나 만들지 않는다.
- 하나의 승인 창 최대30분·slot당 최대10분·selected files106 이하·동일 파일 중복0·file≤2MiB/총≤16MiB·metadata command≤10초/SQL file≤30초·출력≤16KiB. 불명·구문 오류/비의존 오류는 중단하고 동일 slot 재실행0.
- 일회 소진/의도·결과는 새 보호 원장 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261103-r1 아래 고정 slot 파일에 O_EXCL/0600·owner/link/hash·원 기한으로 보존하는 안이다. 부모/기존파일이 불명하면 중단. 범용 파일 조사·재귀 삭제0.
- cleanup은 소진 원장과 일치하는 정확 full container ID·label·image·mount·network 신원을 다시 확인한 새 QA만 대상이다. 별도 실제 승인안은 해당 새 일회 container의 정상 종료·필요 시 제거까지 명시한다. 다른 PID/container/volume/네트워크·host 경로 삭제0. UNKNOWN/미정착은 성공 정리로 보고하지 않는다.

## 작업·검수
- [ ] Task1: 기존 resource lifecycle을 읽어 실제 재사용을 정리하고 index106을 Git blob으로 생성한다. 순서 미정/진단용임을 header로 고정한다.
- [ ] Task2: driver의 명시 입력/selection·source hash/원 기한·default IO0·slot/UNKNOWN·소유검산·한정 DDL/정리 경계를 구현한다. CLI 실행/소비 기록 형식은 문서 반환에 명시한다.
- [ ] Task3: 순수/fake command port를 이용해 잘못된 owner/image/mount/기존이름·slot재사용/UNKNOWN·TTL·미선택/순서변조에서 효과0을 RED→GREEN으로 확인한다. SQL fake 모델이나 실제 Docker/PG/WSL은 실행하지 않는다. Git Bash를 --noprofile/--norc로 source하고 main side effect0을 검산할 수 있다.
- [ ] Task4: Bash -n·새 unit·root noEmit·diff만 실행한다. 실제 --run/DB/서비스/원장 파일 생성은0. 별도 실제 실행 계획의 채택/승인을 받기 전까지 NOT_RUN.
- [ ] Main 독립 검수 후 정확3 source/data와 소유 문서만 checkpoint한다. 실 실행 packet에는 그 code SHA·index/selected input SHA·자원 literal/소유·수명·정리·미검증을 고정한다.

## Review Focus
1. allowlist 표시순서를 적용순서로 쓰거나 caller inline SQL/임의 path를 실행하지 않음.
2. 원장/실제 resource 신원 불일치에서 생성·start·rm0. alias/name만으로 삭제하지 않음.
3. 일부 생성/timeout/출력 소실·COMMIT 불명에서 재실행/성공 승격0.
4. image VOLUME·mount·network/port 검산이 누락돼 기존 자원을 물리지 않음.
5. 읽기/정리 경로에 실제 Secret·사용자 파일·P03 원본이 섞이지 않음.

반환은 파일/hash·정확 명령/exit·원 RED/실패·보완·미실행과 실제 실행안의 남은 결정을 구분한다. 이 source 준비를 제품 기능 추가나 IX01/전체 계획 완료로 세지 않는다.

## r2 — 동결 source 검수 정합 (2026-11-03)
- r1 SHA BA51AE1F24D10D38A9FC68BE27A385E7E5821A6CCE6BC616CDC341DB594454F7은 이전 snapshot이다. 경로3/SQL baseline/실제 실행 제외는 유지한다. Main 내부 구현 명료화이며 제품 계약·권한을 변경하지 않는다.
- Task1~4 source 준비와 Main 독립 검수는 수행했다. 실제 Docker/WSL/PG/DDL/원장 생성·정리 검수는 NOT_RUN이다.
- --run은 기존 등록 /opt/node-v24.22.1-linux-x64/bin/node의 root 소유/0755/126879696B/SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb를 Bash에서 먼저 검산한다. 이는 과거 개발환경 등록값이며 현재 WSL 존재를 확인한 것이 아니다. 자동 설치/대체0. source/default/--plan에서는 이 runtime 파일을 조사하지 않는다.
- Bash는 BASH_ENV 없는 --noprofile/--norc로 시작하고, Node/child 환경은 allowlist만 전달한다. Docker는 보호 원장 아래 새 빈 docker-config/0700만 쓴다. Git 외부 include/filter/fsmonitor/replace/alternates와 외부 common dir를 거절하고, 부모 nonlink/owner/mode/realpath/inode와 열린 directory FD를 child/원장 IO 전에 다시 검산한다. 기존 Git/Docker 설정 변경0.
- 새 QA는 password/Secret 생성0, Docker 내부 Unix local trust/host reject/listen_addresses 빈 값이다. 외부 접속 가능한 인증 우회가 아니다. --log-driver none 및 inspect LogConfig exact none/빈 설정을 요구한다. daemon info는 ID/Name 두 필드만 받아 원문 proxy/registry 정보를 수집하지 않는다.
- actual psql은 verbose SQLSTATE와 SHOW_CONTEXT=never를 사용하고 실제 builder/parser를 같은 unit에서 검산한다. 출력은 알려진 code/누락 identifier만 보존하며 SQL/임의 stderr/예외 원문을 반환하지 않는다.
- UNKNOWN에서는 생성 응답을 이름으로 대신 채택하거나 후속 mutation/자동 정리/다음 slot을 하지 않는다. 자원이 10분 기한을 넘어 남을 수 있으며 별도 수동 소유 검토가 필요하다. 10분은 실행 예산이지 모든 오류에서 자원 자동 소멸 보장이 아니다.
- 다음 slot은 앞 결과 CLEANED/확정 의존 SQLSTATE/다른 명시 순서에서만 가능하다. 구문/권한/UNKNOWN/동일순서 자동 반복0.
- index106은 표시 목록이다. 같은0031의 .sql/.pending 중복 때문에 둘을 함께 설치하지 않는다. 실제 builder53 prefix+후행52=105 전체 후보와0065까지96 prefix는 별도 명시 후보이며, 어느 쪽도 아직 실행 허가가 아니다.
- 0066/0073 원문은 migrator CREATEROLE을 요구한다. 현재 NOCREATEROLE bootstrap을 통과시키려고 수정/권한 상승하지 않는다. 전체105 설치 선행은 미충족이며 이 known conflict를 실제 예상 RED 반복으로 소비하지 않는다.
- Main 독립 5766b6 신규 unit27 PASS/fail0/skip0/319.7137ms/exit0, ada30b root noEmit+Bash -n exit0, 4509c1 index106 고정 Git blob SHA/bytes 및105/96 순서 digest 대조 exit0이다. 원문 SQL 실행0이다.

## r3 — 전용 빈 cluster installer 선행 source 보완 (2026-11-03)
- source checkpoint10a00aad9b40a37f13a7a56b83d3b19824bf1833 / private79b024 exact·tracked clean·main/보호3 불변. r2 SHA55212D93438EA39BAA0EE4040048D8561C84EC1A82133EB44A510D3103466D2C는 이전 snapshot이다.
- PMO는0066/0073 원문을 직접 대조하고, 별도 전용 빈 cluster의 installer CREATEROLE 선행을 명시한 전체105 실행 후보 준비를 권장했다. 실제 실행 승인이 아니며 신산님 최신 실제 DB·권한·키·서비스·Agent 제외를 유지한다. 96 한정안으로 최신 IX01 준비를 대신하지 않는다.
- CREATEROLE은 DB 한정이 아니라 cluster 전체 비superuser role 변경/멤버십 위험이 있다. source에서는 실행 대상이 새 빈 격리 cluster뿐임을 그대로 고정하고, 실제 실행은 exact code·bootstrap SQL/hash·전후 role 검산·정리/UNKNOWN 범위로 한 번 별도 결정받아야 한다. 기존 DB/role/SQL guard/reader 선생성/role 자동인수0이다.
- 기존 Primary의 이번 writer는 scripts/qa-ix01-schema-closure.sh 및 tests/unit/IX01/schema-closure-controller.test.ts 정확2개뿐이다. index106/제품/SQL/문서/설정은 변경하지 않는다. Main은 같은 코드 쓰기0이다.
- 신규 QA bootstrap 선언을 원 SQL이 요구하는 installer에만 CREATEROLE/NOSUPERUSER/NOCREATEDB/NOBYPASSRLS로 정합하고 app·reader는 NOCREATEROLE/NOSUPERUSER/NOBYPASSRLS를 유지한다. 이는 미승인 실제 mode의 코드 준비일 뿐 실제 role 생성/GRANT0이다.
- 실제 psql builder를 통한 bootstrap 직후 role 속성/멤버십의 비밀 없는 명시 metadata 검산을 추가한다. bootstrap/app/migrator 및 원0066/0073 reader 두 역할 이외의 새 비system role·예상 밖 superuser/BYPASSRLS/멤버십은 효과를 계속하지 않고 UNKNOWN으로 보존한다. source에 역할 허용표·검산 기준과 정확 bootstrap/revoke SQL/hash를 반환한다.
- 정의 설치 완료 또는 명확한 SQL 거절로 정착했을 때만, 소유 cluster를 다시 확인해 installer CREATEROLE과 이 일회 설치로 생긴 reader 역할 멤버십을 정확 회수하고 전후 metadata를 확인한 뒤 기존 fullID 정상 stop/rm 경계를 따른다. 일부 설치 실패/role 미생성도 처리하되 기존 source SQL이나 검수 기대값을 완화하지 않는다. 회수/metadata/COMMIT 결과 불명은 UNKNOWN·추가 mutation/다음 slot0이다.
- 원 기한·출력한도/비밀0·parent FD·정제 child환경·현재 role0·image/mount/network/port/log none·slot 단발/후속조건은 유지한다. 실제 host/key/runtime/DB/Docker/권한/서비스/Agent/원장 조사·생성·실행0이다.
- 먼저 기존 비특권 bootstrap이0066 선행을 충족하지 않는 source 반례와 잘못된 role/멤버십·회수불명 음성을 작성하고, 같은 2파일만 RED→GREEN·기존27 인접보존·noEmit/Bash-n/diff 검수한다. 실제 PG parser/DDL/role/cleanup은 NOT_RUN으로 남긴다. 완료시 동결2와 index불변/자원0/handle0을 반환한다.
