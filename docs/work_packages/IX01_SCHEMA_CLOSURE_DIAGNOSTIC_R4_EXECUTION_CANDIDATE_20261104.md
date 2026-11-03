# IX01 R4 SQL 정의 설치 단1회 실행 후보

2026-11-04 · NOT_APPROVED · 실제 실행 금지 · 모든 R4 자원 생성0

## 목적·원 이력

원 R3의 ROLE_PRISTINE/UNKNOWN을 임의 재시도하지 않는다. 원 R3는 별도 직접 정리 승인 후 7735be에서 실행자원 잔여0·감사보존을 확인했고 58f52018에 보존했다. 원 오류 직접원인은 미확정이다. R4는 별도 새 namespace에서 최종 PID1 관측·실공유 run 정제/진단 보완 code의 정의 설치를 단1회 확인하는 후보다. 과거 실행 승인·기한·slot을 재사용하지 않는다.

## 동결 코드·선택

- 실행 code: cd6b832289716e686d263b7f62a80a18499fb566
- SQL sourceHead: 0a647daa66103ada3bd5e949b64f407c3e7b5687
- instance: cd6b832289716e686d263b7f62a80a18 (실행 code.slice(0,32) 계산·길이32 검산)
- slot1 / previousHash=null. 추가 slot·같은 순서 재실행0.
- index106 / 명시105 / 2376139B / orderHash 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|33542|efb1c117e26cf3b57a1957c1342dbd1fda3c0a8190471eb7c66c4ad04a991189|
|tests/unit/IX01/schema-closure-controller.test.ts|37726|ba95b11848be9c76e2b0a612795da7bf8046a83a6960d4432b2ab08f1ff5db79|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R4.tsv|15981|d6b4b8abb1e070cfc70f1f6fe79034dae22d3fd0b3cd9982c73417d29e88a4da|

후행 문서 commit을 실행 code로 대체하지 않는다. 실행 전 local/private exact code·source clean·원 hash·순서를 다시 검산한다. 현재 planHash/ownerHash/issuedAt/절대기한은 미발급이며 사람 승인 증명을 source 상수로 대체하지 않는다. 준비/구현 검증은 위 R4 source 결과보고와 부모 readiness 결과보고를 참조한다.

## 새 전용 자원·격리

- 기존 SSH WSL-server / daon UID1000 / SINSAN만 대상으로 하는 후속 후보다. 이번 문서 작성에서 접속하지 않았다.
- source: /home/daon/anvil-ix01-ddl-20261104-r4-qa
- receipt: /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r4
- receipt 내부: 빈 docker-config / owner.json / slot-a1.intent.json / slot-a1.result.json. 디렉터리0700·원장0600·nlink1/nonlink/uid1000·부모 realpath/쓰기권한을 검산한다. 감사3은 의도 보존한다.
- container: anvil-ix01-ddl-pg-20261104-r4-a1
- DB: anvil_v3_ix01_ddl_20261104_r4_a1 / owner label: IX01_DDL_20261104_R4
- daemon: e3349f1d-dbfc-478a-96d9-295bf6c6839e
- 고정 cached image: sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build/fallback0.
- 등록 Node: /usr/local/bin/node → /opt/node-v24.22.1-linux-x64/bin/node, uid/gid0:0·0755·126879696B·SHA256 e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb. 기동 전 현재성 불일치면 자원 생성 전에 중단한다. 자동설치0.

network none/port0/host bind·named·anonymous volume0/read-only root/999:999/capdrop ALL/no-new-privileges/pids64/memory512MiB/CPU1/log-driver none·empty options. tmpfs PGDATA256MiB/socket16MiB/tmp16MiB만 허용한다. Unix socket local trust·host reject initdb·listen_addresses 비활성화이며 최종 HBA 전체를 실관측했다고 주장하지 않는다. Docker는 새 빈 보호 docker-config만 사용한다. Bash/Node/Git child env는 기존 고정 정제환경만 사용하고 사용자 preload/config/include/fsmonitor/replace를 혼용하지 않는다.

## 유한 실행 순서·권한 위험

새 직접 승인 수신 시점부터 30분을 전체 준비·실행의 절대기한으로 고정하고 그 안에 완료한다. 단, UNKNOWN이면 후속 mutation을 멈추므로 자원이 기한 뒤에도 보존될 수 있다. 실제 issuedAt/절대 deadline·slotExpiresAt=min(현재+10분,전체기한)·plan/owner hash를 한 번 고정하고 연장하지 않는다. metadata 각10초·SQL 각30초·cleanup60초 여유를 보존한다. 승인 질문 전에는 이 시각을 임의 발급하지 않는다.

소진 O_EXCL 의도→확정 create fullID/label/instance/image/격리 검산→start→최종 PID1 고정 읽기 관측→기존 pg_isready→목표 DB의 기존 pristine 역할 조회1회·strict 검산→bootstrap→installer 검산→명시105 raw 정의 설치→명확 정착 뒤 역할/멤버십 검산·CREATEROLE 회수→회수 후 검산→동일 fullID 재검산→stop5/rm→별도 부재 확인 순서다.

최종 프로세스 관측 명령은 fixed fullID에 대한 docker exec --user 999:999 <확정 fullID> cat /proc/1/comm 이며 경로나 명령을 입력받지 않는다. postgres 개행 원형만 최종으로, bash/docker-entrypoi 개행은 초기화 관측으로 취급한다. 기존40회/250ms·원기한 안에서만 관측한다. 고정 image의 실제 프로세스 형식은 아직 NOT_RUN이다. 별도 성공용 SELECT는 없고 목표 DB의 기존 roleMetadataSql 1회가 실제 접속 근거다. PID1은 raw, 다른 출력 trim은 기존대로이며 역할 오류는 원 run 경계에서만 고정 진단으로 변환한다.

새 빈 cluster의 bootstrap 관리자만 최초 역할 생성/회수를 수행한다. raw migration은 NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS installer가 실행하며 설치 구간만 CREATEROLE이다. app/reader는 비특권이며 원0066/0073이 reader를 생성한다. reader 선생성/동명 역할 인수/guard 우회/관리자가 migration 대신 실행0. CREATEROLE은 DB 하나보다 넓은 cluster 권한이므로 기존 DB/volume/사용자를 절대 연결하지 않는다.

## UNKNOWN·정리·제외

생성 응답/SQL/COMMIT/역할 회수/정리 불명·timeout·신원차이는 UNKNOWN이다. 자동 후속 mutation/재조회/삭제/재시도/다음 slot0. create fullID 소유 미확정 때 이름/label로 채택하지 않는다. 자원은10분 뒤에도 남을 수 있으며 정확 소유 검토와 별도 조치가 필요하다. 명확 정착·소유 검산 뒤에만 정상 회수/stop/rm을 수행한다. stop5는 이후 강제종료될 수 있으므로 실제 요청 범위에 명시한다. source는 exact owner/nonlink/clean/사용 프로세스 부재 확인 뒤 등록한 새 소유 폴더만 정리하고 감사3은 보존한다.

고정 역할 진단은 ROLE_QUERY_TIMEOUT / ROLE_QUERY_REJECTED / ROLE_QUERY_OUTPUT_REJECTED / ROLE_METADATA_REJECTED / ROLE_QUERY_UNKNOWN만 허용한다. DDL은 기존 SQLSTATE·허용 identifier·단일 안전정수 statementEndLine(문장 끝 위치, 정확 원인행 아님)만 보존한다. 임의 stderr/SQL/DETAIL/CONTEXT/Secret 원문은 결과에 출력하지 않는다.

기존 정식/복구 DB·사용자/권한/정책·키/Secret/인증서·서비스·Agent/LLM 비용·실자료·P03R3·운영/Oracle/ysna 변경은 제외한다. 성공하더라도 raw 정의 설치 한정이며 함수/DML/RLS/API/UI/IX01/사용자인수 PASS가 아니다. 모든 R4 자원은 아직 생성0이며 실제 실행 미승인이다.

## 정확 bootstrap·관측·회수 SQL

bootstrap SHA256 56655e52ea2fc4cf23473084990b94320f527ea81997b644ccbdf3b712c472e5
```sql
BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE anvil_v3_ix01_ddl_20261104_r4_a1 FROM PUBLIC;GRANT CONNECT ON DATABASE anvil_v3_ix01_ddl_20261104_r4_a1 TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;
```

roleMetadataSql SHA256 23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1
```sql
SELECT json_build_object('sessionUser',session_user,'currentUser',current_user,'roles',(SELECT COALESCE(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'login',rolcanlogin,'validUntil',rolvaliduntil) ORDER BY rolname),'[]'::json) FROM pg_catalog.pg_roles),'memberships',(SELECT COALESCE(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'adminOption',a.admin_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor))::text;
```

회수 대상 없음 · SHA256 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;COMMIT;
```

회수 대상 anvil_v3_fn15_reader_owner · SHA256 10df64294c159ae5c0a0f7376a78c15fc703c9b1f11f8ce038eeaeb3a9b44df6
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;COMMIT;
```

회수 대상 anvil_v3_fn16_export_reader_owner · SHA256 4990526c6cd10894cde5132680921f594a5e831e05fe59177dfb39a9ec05ba11
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;
```

회수 대상 anvil_v3_fn15_reader_owner, anvil_v3_fn16_export_reader_owner · SHA256 8a8d58d31e4c2bd260fec6f59d362d1d03b1595d0278397f36a5946facc76992
```sql
BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;
```

관측·회수 원문은 UTF-8/추가 끝개행 없음의 생산 문자열을 hash했다. 현재 원SQL이 reader membership을 이미 회수했다면 없는 membership을 오류로 보지 않으며 실제 현재 metadata에 존재하는 위4변형 중 하나만 사용한다. 회수 COMMIT 불명이면 후속 role 조회/stop/rm0.

## 명시 선택105 전체

다음 순서는 기존53 builder prefix와 별도 명시 선택을 보존한 진단 후보이며 파일번호 정렬이 의존 증명이 아니다. schema_migrations 가짜 완료/ledger 등록은 하지 않는다.
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
