# IX01 R3 SQL 정의 설치 단1회 실행 후보

2026-11-04 · 미승인 / 실제실행금지 / 코드SHA동결전결정질문금지

R2는0035에서42601로실패했고회수·정리잔여0/감사보존했다. 이승인은소진됐다. R3는같은PL/pgSQL IF/CASE구문군0035+추가10파일11곳의괄호만보정한뒤전체정의설치를한번확인하는새범위다. 실제오류의직접원인은원문미수집으로미확정이며source검수를PG통과로승격하지않는다.

## 고정소스
- 실행code: PENDING_CODE
- SQL baseline:0a647daa66103ada3bd5e949b64f407c3e7b5687
- driver SHA256:12459df3203ed856021a5341fd0472894ee7dff8716898eba7c6c47629c7864e
- unit SHA256:bf64ec5496141c87122fb39dc3a52b9eac2a210e0b38dc128e7d87c590859dfe
- index docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R3.tsv SHA256:d6b4b8abb1e070cfc70f1f6fe79034dae22d3fd0b3cd9982c73417d29e88a4da
- index106 Gitblob,중복0031 pending제외명시105/2376139B/order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef. 이전R2 SQL기준대비0035+2B/추가10파일22B,그밖불변.
- Main f2070c39PASS/skip0/405.6222ms,23278c106blob/선택대조/driver결박외변경0. type/Bash-n은Primary위결과보고참조.

## 새전용자원·수명
기존SSH WSL-server/daonUID1000/SINSAN,daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e. 새source /home/daon/anvil-ix01-ddl-20261104-r3-qa,receipt /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r3/빈docker-config/owner.json/slot-a1.intent.json/slot-a1.result.json. directory0700/원장0600·단일link/nonlink/현재uid/부모realpath를검산한다. 감사는의도보존한다.

새PG anvil-ix01-ddl-pg-20261104-r3-a1 /DB anvil_v3_ix01_ddl_20261104_r3_a1 /owner IX01_DDL_20261104_R3. slot1/previousHashnull/단1회,추가slot·자동재실행0. cacheimage sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f만사용/pull·build0. 등록Node24 e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb/root:root0755/126879696B만사용. 생성직전부재·소유·링크·이미지·기존서비스영향을확인한다.

networknone/port0/hostbind·named·anonymousvolume0,read-onlyroot/999:999/capdropALL/no-new-privileges/pids64/memory512MiB/CPU1/lognone. tmpfs PGDATA256MiB/socket16MiB/tmp16MiB만. 내부Unixsockettrust/TCP listen비활성화. 기존HBA/인증키/계정변경0,최종HBA전체reject를관측했다고주장하지않는다.

새빈cluster installer만설치구간CREATEROLE(NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS유지),app/reader비특권. CREATEROLE은DB하나보다넓은cluster권한이므로기존volume/DB/사용자를연결하지않는다. bootstrap관리자가원SQL을대신실행하거나reader선생성·guard우회하지않는다.

새직접승인수신후30분이내준비·실행,PG예산10분. 실행직전issuedAt/절대기한·slotExpiresAt/min(now+10분,전체기한)·공개instance/plan/ownerhash를한번고정한다. 기한연장0. 원의도O_EXCL→create fullID/label/image/mount/port확인→start/ready→pristine/bootstrap/installer검산→명시105원문설치→명확정착뒤권한회수/검산→fullID재검산→stop5/rm→별도부재확인. stop5뒤QA에SIGKILL할수있다. source는정확owner/realpath/link/clean/사용프로세스확인뒤등록소유폴더만정리한다.

생성/SQL/COMMIT/권한회수/정리불명·신원차이는UNKNOWN이며자동후속mutation/삭제/재시도/다음slot0. 자원이기한뒤남을수있고정확소유검토와추가조치를보고한다. 비밀없는감사3은보존한다. 원문오류/SQL/DETAIL/CONTEXT/Secret출력0,허용SQLSTATE/단일안전정수statementEndLine만(원인행확정아님).

## 제외·판정
기존정식/복구DB·권한·사용자·키·Secret·인증서·서비스·Agent/LLM비용·실자료조사·P03 R3·Oracle/ysna/운영변경0. 단순정의설치성공은함수/DML/RLS/API/UI/IX01/사용자인수PASS아니다. 현재실행승인없음.

## bootstrap/회수/관측SQL
bootstrap SHA256 c490086bb002d86799fcf12e42e69df23aff145af38e13245ec740c6dde62c5e
```sql
BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE anvil_v3_ix01_ddl_20261104_r3_a1 FROM PUBLIC;GRANT CONNECT ON DATABASE anvil_v3_ix01_ddl_20261104_r3_a1 TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;
```

회수는현재멤버십검산뒤기존revokeSql의0/fn15/fn16/둘다4변형만. SHA256순서 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5 / 10df64294c159ae5c0a0f7376a78c15fc703c9b1f11f8ce038eeaeb3a9b44df6 / 4990526c6cd10894cde5132680921f594a5e831e05fe59177dfb39a9ec05ba11 / 8a8d58d31e4c2bd260fec6f59d362d1d03b1595d0278397f36a5946facc76992. roleMetadataSql SHA256 23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1. 권한회수불명은후속조회/stop/rm0.

### 명시 선택105
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
