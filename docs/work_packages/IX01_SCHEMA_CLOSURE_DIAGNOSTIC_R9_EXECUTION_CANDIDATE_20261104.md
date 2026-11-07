# IX01 R9 SQL 정의 설치 단1회 실행 후보

2026-11-04 · NOT_APPROVED / 실제 실행 금지 / R9 자원 생성0

## 목적·원 실패 이력

원 R8 실제 slot1은2ed711 exit1/code2224224f/SQLfed86a51에서0074_project_membership_versions.sql.pending 정의 설치가 SQLSTATE42601/diagnostic null/statementEndLine110로 FAILED/CLEANED였다. 오류 원문 전체는 미수집이므로 직접 원인행·메시지를 확정하지 않는다. Main5aac01은2026-11-04T01:44:14.320Z 별도 exactID/name/source 부재·실행자원잔여0 및 감사 보존을 확인했다. 원R7의0071/42601 FAILED/CLEANED·c12a6a 잔여0, 원R6의0069/42883 FAILED/CLEANED·c07b3e 잔여0, 원R5의 최종PID1·0037 설치/회원 회수 통과 및0039 FAILED·잔여0, 원R4 FAILED·R3 UNKNOWN·R1/R2 실패와 감사를 보존한다. R9은 새 빈 QA에서0074 한 문자 보완 이후 정의 설치를 단1회 확인하는 미승인 후보다. 직전 소진 승인은 R8이며 그 승인·slot·기한을 재사용하지 않는다.

## 고정 코드·변경·선택

- 실행 code: a7527b79b3d4db38f82838abdbbf03ded103205e
- SQL sourceHead: a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb
- instance: a7527b79b3d4db38f82838abdbbf03de (code.slice(0,32) 직접 계산·32hex 검산)
- slot1 / previousHash=null / 단1회. 추가slot·자동재실행0.
- 표시index106 / 중복0031 pending 제외 명시105 / 2376141B / orderHash 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef
- R8 SQLfed86 대비0074 회원 완결식의 old.content_hash)))))));를 old.content_hash))))));로 고쳐 닫는 괄호 한 문자만 삭제했다. SQL0074 raw SHA256 E3DBD7FA537705C94CB34BC5D93AA643D6CA4B7E4C6E6C5155F186EE88416941/33601B이며 부모33602B 대비-1B다. 역삽입하면 부모67696FDD raw와 완전히 동일하다. 서비스 project-memberships.ts의 membershipChecksum은 정확 새SQL hash literal 하나만 갱신했고 원 행수1/동일값/64길이 검사·guard는 불변이다. 이는 source 갱신일 뿐 실제 schema_migrations·서버·DB에 적용하지 않았다. 이전0071 한 문자·0069 wrapper/ACL 순서·0039 내장SHA256 보완을 보존한다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733|
|tests/unit/IX01/schema-closure-controller.test.ts|49322|314c7adbecbce4d306b8134946b10e328cca723d17cd5811183a73b7b057175a|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R9.tsv|15981|4c186b4cae4d54124af89bace1c955ab2db8c80605360bb908f212dd3b339aa8|

후행 문서 commit을 실행 code로 대체하지 않는다. 승인 후 실행 전 local/private exact·source clean·전체 hash/선택을 검산한다. 현재 실제 issuedAt/planHash/ownerHash/절대기한은 미발급이다. plan18키/owner6키·공개 결과shape는 원 driver 그대로다. 부모56/noEmit·환경50·native44·회원16·R9직접3와Main1 검증은 결과보고의 각 분모로 구분하며 PG GREEN으로 승격하지 않는다.

공개 plan은 정확18키: schemaVersion, purpose, sourceHead, executionHead, indexHash, orderHash, slot, issuedAt, expiresAt, slotExpiresAt, uid, cwd, instance, daemon, image, selected, previousHash, receiptOwnerHash. owner 원문은 정확6키: schemaVersion, purpose, uid, sourceHead, issuedAt, expiresAt. plan/owner hash는 수신 UTF-8 원문 bytes 분모이며 canonical 재직렬화 hash로 치환하지 않는다. 실제 값/시각은 새 직접 승인 뒤에만 발급한다.

## 새 전용 자원·고정 환경

- 대상: 기존 SSH WSL-server / daon UID1000 / SINSAN. 본 문서 작성에서 실제 접속0.
- source: /home/daon/anvil-ix01-ddl-20261104-r9-qa
- receipt: /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r9
- receipt 자식: 빈 docker-config / owner.json / slot-a1.intent.json / slot-a1.result.json. 디렉터리0700·파일0600·nlink1/nonlink/uid1000·부모 소유/쓰기권한·realpath를 검산한다. 감사3은 의도보존한다.
- container: anvil-ix01-ddl-pg-20261104-r9-a1
- database: anvil_v3_ix01_ddl_20261104_r9_a1 / owner label: IX01_DDL_20261104_R9
- daemon: e3349f1d-dbfc-478a-96d9-295bf6c6839e
- cached image: sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build/fallback0.
- 등록 Node: /usr/local/bin/node → /opt/node-v24.22.1-linux-x64/bin/node,uid/gid0:0·0755·126879696B·SHA256 e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb. Node 기동 전 현재성 불일치면 어떤 자원 생성 전에도 거절하며 자동설치0.

network none/port0/host bind·named·anonymous volume0/read-only root/999:999/capdrop ALL/no-new-privileges/pids64/memory512MiB/CPU1/log-driver none·empty options. tmpfs PGDATA256MiB/socket16MiB/tmp16MiB만 허용한다. Unix socket local trust·host reject initdb·listen_addresses 비활성화이며 최종 HBA 전체를 실관측했다고 주장하지 않는다. Docker는 새 빈 보호 config만 소비한다. Bash 기동 전 env -i 및 --noprofile/--norc,Node/Git/Docker 정제 child env로 사용자 preload·개인 config/include/fsmonitor/replace 혼용0이다.

## R5와 동일한 역할 준비·원자 transaction

정확0037 선택만 anvil_v3_provider_claim_writer NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS 생성과 migrator 임시 ADMIN membership1을 bootstrap transaction에 포함한다. app membership/SET ROLE·임의 role 인수·reader 선생성·관리자 migration 대행0이다. 동명 role·잘못된 속성/기존 소유·ACL/membership은 원preflight/strict metadata로 거절한다. 원0037과 제품 권한정책은 그대로이며 이번 SQL0074 닫는 괄호 한 문자 삭제 외 SQL은 변경하지 않는다.

provider owner·ADMIN membership 준비와0037 원자 transaction은 R5에서 이미 승인 범위에 포함돼 실행됐으며 이번에 새로 발명한 권한이 아니다. 그러나 직전 R8 단1회 승인과 기한은 소진됐으므로 새 R9 자원/정확 code의 실제 실행은 새 직접 승인 전 금지다. 기존 DB/사용자/정책 권한 변경은 계속 제외한다. 새 빈 cluster installer만 설치구간 CREATEROLE이며 NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS는 유지한다. CREATEROLE은 DB 하나보다 넓은 cluster 권한이므로 기존 DB/volume/사용자를 연결하지 않는다. bootstrap 관리자만 정확 역할 생성·회수를 하고 raw migration은 installer만 실행한다.

PRISTINE은 기존 깨끗한 role 집합이다. INSTALLER/SETTLED/REVOKED는 selected/attempted/completed와 결박한 정확 owner·속성·grantor·ADMIN membership·회수 상태를 검산한다. 원0066/0073 reader는 원SQL이 생성/회수하며 provider와 생성 주체/시점을 구분한다. 0037 성공 뒤 원SQL의 schema CREATE·membership 회수/postflight를 실행하는 원문 전체에 결박한다. role metadata가 ACL 전체를 직접 조회한 것처럼 표시하지 않는다.

원0037 전체만 exact path db/migrations/0037_provider_session_claims.sql.pending 및 고정 raw SHA256 eb4cc66e8d682f08225823e39bae5ad40f7af62b529d3774291e855f34536097과 함께 psql --single-transaction으로 실행한다. controller→ports.sql→psql/run이 원 bytes/hash를 소비한다. stdin을 덧붙이지 않아 statementEndLine 분모를 보존한다. 다른 SQL·이미 BEGIN/COMMIT인0066/0073에 일괄 transaction 옵션을 넣지 않는다.

## 원 기한·순서·UNKNOWN·정리

새 직접 승인 관측시점부터 전체 준비·실행30분의 절대기한을 고정한다. PG 예산10분·slotExpiresAt=min(실행직전+10분,전체기한),metadata 각10초/SQL 각30초/cleanup60초 여유를 보존한다. 승인이 오기 전에 시각을 임의 발급하지 않고 기한 연장0이다.

생성 전 부재·소유·고정 runtime/image 확인→의도 O_EXCL 소진→create fullID 확인→identity/image/격리 검산→start→최종 PID1 고정 읽기→기존 pg_isready→목표 DB pristine 역할 조회1회→선택 owner 포함 bootstrap→installer 검산→명시105 원문 설치→명확 정착 뒤 실제 남은 허용 membership만 회수·installer CREATEROLE 회수→회수 후 검산→exact fullID 재검산→stop5/rm→별도 부재 확인 순서다.

최종 관측은 확정 fullID에 대해 docker exec --user 999:999 <fullID> cat /proc/1/comm 고정 명령/경로만 사용한다. postgres 개행 원형을 최종으로, bash/docker-entrypoi 개행은 초기화로 분리해 기존40회/250ms·원기한 안에서만 관측한다. PID1 raw만 보존하고 다른 출력 trim은 유지한다. 별도 성공 SELECT는 없으며 기존 목표 DB roleMetadataSql 1회가 실제 접속 근거다. R8은 동일 image에서 최종 PID1 관측과0037 설치를 통과했으나 R9의 현재성은 미실행이며 동일 고정 읽기로 다시 검산한다.

명확0037 transaction 실패는 rollback 후 실제 남은 원provider membership만 회수한다. 이미 원SQL이 회수한 membership 부재는 정상이다. 일반 회수 SQL은 아래8변형 중 관측된 membership만 반영하며 불필요 DROP/보정/권한 확대0이다. SQL/COMMIT/role 관측/회수/create/정리 불명이나 timeout·신원변경은 UNKNOWN: 이후 query·mutation·stop/rm·재시도·다음slot0이다. create 응답 유실 때 이름/label로 소유를 채택하지 않는다. 자원이10분 뒤 남을 수 있으므로 무조건 수명을 보장하지 않으며 별도 소유검토·조치를 보고한다.

정착·소유확인 뒤 정상 stop5는 필요시 강제종료될 수 있다. source는 정확 owner/nonlink/clean/사용 프로세스 부재 확인 뒤 새 등록 폴더만 정리한다. 감사3은 보존한다. 임의 stderr/SQL/DETAIL/CONTEXT/Secret은 결과에 출력하지 않고 고정 역할진단5종·허용 SQLSTATE/identifier/statementEndLine만 보존한다. statementEndLine은 문장 끝이지 정확 원인행이 아니다.

## 제외·해석

R5와 동일한 provider준비/회수·격리·전체기한30분/PG10분·UNKNOWN조건을 보존한다. 새 R9 empty QA1회의 실제 role/GRANT/PG 실행은 이 정확packet/code로 새 직접 승인받기 전 금지다. 기존 정식/복구 DB·권한/사용자·정책·키/Secret/인증서·서비스·Agent/LLM비용·실자료·P03R3·운영/Oracle/ysna 변경0. 성공해도 raw 정의 설치 한정이며 함수/DML/RLS/API/UI·IX01·사용자인수 PASS가 아니다. 현재 모든R9자원 생성0·실행 NOT_APPROVED다.

## 동결 module 직접 생산 SQL 원문·SHA256

동결 driver module의 main을 비활성화하고 순수 bootstrapSql/roleMetadataSql/revokeSql 함수를 직접 호출한 문자열이다. 실제 SQL 실행·수작업 전사0. hash는 UTF-8 생산문자열 자체이며 추가 끝개행을 포함하지 않는다.

bootstrapSql(anvil_v3_ix01_ddl_20261104_r9_a1, selected105) · bytes 918 · SHA256 baf71cbc29ccf796ea1898d3dcb4686764d85f85834e08d95623678252729594
```sql
BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE anvil_v3_ix01_ddl_20261104_r9_a1 FROM PUBLIC;GRANT CONNECT ON DATABASE anvil_v3_ix01_ddl_20261104_r9_a1 TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;CREATE ROLE anvil_v3_provider_claim_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;GRANT anvil_v3_provider_claim_writer TO anvil_v3_migrator WITH ADMIN OPTION;COMMIT;
```

roleMetadataSql() · bytes 760 · SHA256 23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1
```sql
SELECT json_build_object('sessionUser',session_user,'currentUser',current_user,'roles',(SELECT COALESCE(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'login',rolcanlogin,'validUntil',rolvaliduntil) ORDER BY rolname),'[]'::json) FROM pg_catalog.pg_roles),'memberships',(SELECT COALESCE(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'adminOption',a.admin_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor))::text;
```

회수 변형 0 / 관측 membership 없음 · bytes 55 · SHA256 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;COMMIT;
```

회수 변형 1 / 관측 membership anvil_v3_fn15_reader_owner · bytes 112 · SHA256 10df64294c159ae5c0a0f7376a78c15fc703c9b1f11f8ce038eeaeb3a9b44df6
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;COMMIT;
```

회수 변형 2 / 관측 membership anvil_v3_fn16_export_reader_owner · bytes 119 · SHA256 4990526c6cd10894cde5132680921f594a5e831e05fe59177dfb39a9ec05ba11
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;
```

회수 변형 3 / 관측 membership anvil_v3_fn15_reader_owner, anvil_v3_fn16_export_reader_owner · bytes 176 · SHA256 8a8d58d31e4c2bd260fec6f59d362d1d03b1595d0278397f36a5946facc76992
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;
```

회수 변형 4 / 관측 membership anvil_v3_provider_claim_writer · bytes 116 · SHA256 a6bfd8fa4145906c02f4d92423e397e6a5043657db65a9da02e5cbfc4c80938d
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_provider_claim_writer FROM anvil_v3_migrator;COMMIT;
```

회수 변형 5 / 관측 membership anvil_v3_fn15_reader_owner, anvil_v3_provider_claim_writer · bytes 173 · SHA256 d8f1fb4b082219ce9df2120071082d362c0f5ad402493e13ab4bae3784d6ce03
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_provider_claim_writer FROM anvil_v3_migrator;COMMIT;
```

회수 변형 6 / 관측 membership anvil_v3_fn16_export_reader_owner, anvil_v3_provider_claim_writer · bytes 180 · SHA256 5edcb345fe49a6a7ed7838b2184b8b41dd266ecbf4436f527b1b39efc1bd6082
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_provider_claim_writer FROM anvil_v3_migrator;COMMIT;
```

회수 변형 7 / 관측 membership anvil_v3_fn15_reader_owner, anvil_v3_fn16_export_reader_owner, anvil_v3_provider_claim_writer · bytes 237 · SHA256 aee0f48fc3252639b8e3f515a6f332a9def2836e1c6f16529493a197c423e672
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_provider_claim_writer FROM anvil_v3_migrator;COMMIT;
```

8변형은 고정 함수가 허용한 세 역할 조합의 원문 목록이며 특정시점의 동시회원 존재 증명이 아니다. 정확 현재 metadata에 있는 회원만 회수하고 completed0037 provider회원·원reader의 이미 회수된 회원은 없어야 정상이다. 회수/COMMIT불명 후 query/stop/rm0이다.

## 명시 선택105 전체

원53 builder prefix와 별도 명시 선택을 유지한다. 파일번호 정렬이 의존 증명은 아니며 index는 표시용이다. schema_migrations 가짜 완료/ledger 등록0.
```json
[
  "db/migrations/0000_environment.sql",
  "db/migrations/0001_projects_access.sql",
  "db/migrations/0011_authorization.sql",
  "db/migrations/0003_documents.sql",
  "db/migrations/0002_methodologies.sql",
  "db/migrations/0002_builtin_condition_contract.sql",
  "db/migrations/0011_user_common_control.sql",
  "db/migrations/0011_user_common_forms.sql",
  "db/migrations/0011_user_common_content_reviews.sql",
  "db/migrations/0011_user_common_method_reviews.sql",
  "db/migrations/0011_project_creation.sql",
  "db/migrations/0011_draft_method_reviews.sql",
  "db/migrations/0011_project_policy_control.sql",
  "db/migrations/0003_project_artifacts.sql",
  "db/migrations/0003_project_documents.sql",
  "db/migrations/0003_project_document_reviews.sql",
  "db/migrations/0003_document_confirmations.sql",
  "db/migrations/0003_document_imports.sql",
  "db/migrations/0003_document_proposals.sql",
  "db/migrations/0004_design_index.sql",
  "db/migrations/0004_work_plan_drafts.sql",
  "db/migrations/0004_trace_links.sql",
  "db/migrations/0005_knowledge_drafts.sql",
  "db/migrations/0005_conversations.sql",
  "db/migrations/0005_knowledge_changes.sql",
  "db/migrations/0005_knowledge_confirmation.sql",
  "db/migrations/0005_artifact_quarantine.sql",
  "db/migrations/0004_work_plan_confirmation.sql",
  "db/migrations/0004_design_change_proposals.sql",
  "db/migrations/0004_design_impact_reviews.sql",
  "db/migrations/0004_design_impact_review_operator_fix.sql",
  "db/migrations/0004_design_change_sources.sql",
  "db/migrations/0004_design_change_source_binding_fix.sql",
  "db/migrations/0011_one_time_approval_requests.sql",
  "db/migrations/0011_one_time_approval_decisions.sql",
  "db/migrations/0011_one_time_approval_consumption.sql",
  "db/migrations/0005_project_constitutions.sql",
  "db/migrations/0001_source_declarations.sql",
  "db/migrations/0002_project_methodology_revisions.sql",
  "db/migrations/0003_document_stage_bindings.sql",
  "db/migrations/0006_connection_candidates.sql",
  "db/migrations/0006_connection_candidate_guard_alias_fix.sql",
  "db/migrations/0006_host_trust_registrations.sql",
  "db/migrations/0006_host_trust_challenge_protocol_fix.sql",
  "db/migrations/0008_source_root_registry.sql",
  "db/migrations/0008_source_read_observation.sql",
  "db/migrations/0012_assignment_drafts.sql",
  "db/migrations/0013_assignment_confirmation.sql",
  "db/migrations/0014_context_preparation.sql",
  "db/migrations/0015_project_baselines.sql",
  "db/migrations/0016_execution_preparation.sql",
  "db/migrations/0017_execution_authority.sql",
  "db/migrations/0031_empty_project_methodology_application.sql",
  "db/migrations/0018_execution_observation.sql",
  "db/migrations/0019_understanding_reviews.sql",
  "db/migrations/0020_execution_recovery.sql",
  "db/migrations/0021_execution_stop.sql",
  "db/migrations/0022_execution_grant_revocation.sql",
  "db/migrations/0024_execution_instruction_permits.sql",
  "db/migrations/0025_result_submissions.sql",
  "db/migrations/0026_result_review_criteria.sql",
  "db/migrations/0027_result_reviews.sql",
  "db/migrations/0028_result_rework_drafts.sql",
  "db/migrations/0032_document_source_links.sql",
  "db/migrations/0033_document_source_detach_approval.sql",
  "db/migrations/0034_assignment_parent_drafts.sql",
  "db/migrations/0035_work_plan_draft_approval.sql",
  "db/migrations/0036_stage_queue.sql",
  "db/migrations/0037_provider_session_claims.sql.pending",
  "db/migrations/0039_ownership_authority.sql.pending",
  "db/migrations/0040_source_content_hash.sql.pending",
  "db/migrations/0041_control_handoff_source.sql.pending",
  "db/migrations/0042_draft_artifact_storage.sql.pending",
  "db/migrations/0043_project_artifact_exports.sql.pending",
  "db/migrations/0044_project_artifact_export_approval.sql.pending",
  "db/migrations/0045_baseline_one_time_approval.sql.pending",
  "db/migrations/0046_context_one_time_approval.sql.pending",
  "db/migrations/0047_stage_start_one_time_approval.sql.pending",
  "db/migrations/0048_limit_policy_one_time_approval.sql.pending",
  "db/migrations/0049_responsible_session_one_time_approval.sql.pending",
  "db/migrations/0050_design_baseline_activations.sql.pending",
  "db/migrations/0051_knowledge_share_requests.sql.pending",
  "db/migrations/0052_approval_in_app_notifications.sql.pending",
  "db/migrations/0053_backup_references.sql.pending",
  "db/migrations/0054_backup_installation_resources.sql.pending",
  "db/migrations/0055_execution_preparation_one_time_approval.sql.pending",
  "db/migrations/0056_understanding_review_one_time_approval.sql.pending",
  "db/migrations/0057_capability_reports_human_claim.sql.pending",
  "db/migrations/0058_checkpoint_records.sql.pending",
  "db/migrations/0059_project_storage_quota.sql.pending",
  "db/migrations/0060_transfer_preparation_records.sql.pending",
  "db/migrations/0061_child_assignment_content.sql.pending",
  "db/migrations/0062_execution_material_registration.sql.pending",
  "db/migrations/0063_backup_policies.sql.pending",
  "db/migrations/0064_trace_artifact_links.sql.pending",
  "db/migrations/0065_connection_definitions.sql.pending",
  "db/migrations/0066_export_locked_metadata_reader.sql.pending",
  "db/migrations/0067_definition_capability_reports.sql.pending",
  "db/migrations/0068_registered_definition_reservations.sql.pending",
  "db/migrations/0069_environment_configuration.sql.pending",
  "db/migrations/0070_project_writer_authority.sql.pending",
  "db/migrations/0071_native_preparation_authority.sql.pending",
  "db/migrations/0072_document_source_observation.sql.pending",
  "db/migrations/0073_control_handoff_acceptance.sql.pending",
  "db/migrations/0074_project_membership_versions.sql.pending"
]
```
