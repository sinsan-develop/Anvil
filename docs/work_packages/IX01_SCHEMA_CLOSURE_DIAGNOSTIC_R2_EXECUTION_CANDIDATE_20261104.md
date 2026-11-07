# IX01 수정 SQL 정의 설치 — r2 실행 후보
2026-11-04 · Main 어울

**미승인 / 소스 검수 중 / 실제 실행 금지**

첫 단발 실행은0035 정의 설치에서22P02로 실패했다. 설치 역할 권한은 회수됐고 QA 컨테이너와 새 checkout은 별도 조회에서도 부재를 확인했다. 감사 원장만 보존했다. 첫 승인은 소진됐으며 이 문서는 그 승인을 재사용하지 않는다.

## 목적과 고정 범위
수정된 SQL의 정의가 새 빈 PG15에서 설치되는지 한 번 확인한다. 기존 서비스·데이터 복구나 실제 API/화면·RLS·Agent/사용자 인수를 수행하는 실행이 아니다.

- SQL 기준:7e9ab984d2dad98fed208a2473853409dde927b9.
- 첫 실행 대비 SQL 변경:0035/0071/0072의 JSON 추출 결과를 먼저 묶는 괄호 총8바이트. 다른103개 원문은 같은지 source 검수에서 대조한다. 원D2/Git/첫FAILED·원장3은 보존한다.
- index106개는 표시 목록이다.0031의 중복 pending 원형을 제외한 명시105개만 같은 순서로 선택한다. compact orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef, 합계2376115B다. 선택 순서는 기존 r4의 고정 JSON 배열을 그대로 따른다.
- driver code SHA·새 index SHA·bootstrap/회수 SQL/hash는 소스 동결·Main 독립 검수 후 채운다. 값이 비어 있는 동안 실행 질문·실행을 하지 않는다.
- 진단 출력에는 검증된 psql 접두의 안전 정수 statementEndLine만 추가한다. 문장 끝 위치이며 함수 내부 원인 행이라고 단정하지 않는다. 오류문장·SQL본문·DETAIL/CONTEXT·Secret은 계속 버린다.

## 새 전용 자원
| 대상 | 고정 값과 처리 |
|---|---|
| 실행 장소 | 기존 SSH WSL-server, daon/UID1000. 예상 daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/Name SINSAN. 실행 전 다르면 생성하지 않는다. |
| source | 신규 /home/daon/anvil-ix01-ddl-20261104-r2-qa. 검수된 code SHA를 기존 private Git으로 받아 clean·지문·owner/realpath/link를 확인한다. |
| PG | 신규 anvil-ix01-ddl-pg-20261104-r2-a1 / DB anvil_v3_ix01_ddl_20261104_r2_a1. slot1 단1회. 원 r1 이름·감사 경로는 재사용하지 않는다. |
| image | 기존 cache sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build·기존 image 변경0. |
| 격리 | network none/포트0/hostbind·named·anonymous volume0. PGDATA256MiB·socket16MiB·tmp16MiB의 tmpfs만. read-only root·999:999·capdropALL·no-new-privileges·pids64·memory512MiB·CPU1·log-driver none. |
| 역할 | 그 새 빈 cluster 안의 installer만 설치 구간 CREATEROLE. NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS 유지. app/reader는 비특권이며 원0066/0073에서만 reader를 생성한다. |
| 인증·키 | Docker 내부 Unix socket trust·TCP listen 비활성화(listen_addresses 빈 값). 암호·키·인증서·실제 로그인 생성0. 기존 인증 설정 변경0. |
| 감사 | 신규 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r2 및 빈 docker-config. directory0700/원장0600·O_EXCL·단일link·현재uid를 검산한다. 비밀 없는 원장은 보존한다. |
| Node | 기존 등록 /opt/node-v24.22.1-linux-x64/bin/node, root:root/0755/126879696B/SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb. 부재/차이면 자동 설치·대체하지 않는다. |

CREATEROLE은 DB 하나만의 권한이 아니다. 다른 비superuser 역할·멤버십까지 영향을 줄 수 있으므로 새 빈 전용 cluster의 격리 자체가 경계다. 기존 PGDATA·volume·socket·실사용자/권한을 물리지 않는다. bootstrap 관리자가 원 SQL을 대신 설치하거나 reader를 선생성하지 않는다.

## 실행·정리와 불명 결과
새 직접 허가 수신 뒤30분 이내 준비·실행하며 PG 작업 예산은10분이다. 실행 직전1회 고정한 issuedAt/기한·소유 instance·공개 plan/owner 원문 hash를 감사에 남긴다. 해시는 사람 승인을 대신하지 않는다.

원 의도 저장→create fullID/label/image/mount/network/port 검산→start/ready→pristine/bootstrap/installer role 검산→명시105 원문 설치→명확 정착 뒤 role 회수/검산→fullID 재검산→stop --time5/rm→별도 부재 확인 순서다. stop은5초 후 새 QA에 SIGKILL할 수 있다. source checkout도 새 소유·Git clean·사용 프로세스와 실제 경로를 재검산한 경우만 제거한다. 감사는 의도 보존하며 QA 잔여와 구분한다.

생성·COMMIT·회수·종료 결과 불명 또는 신원 차이는 UNKNOWN이다. 자동 후속 mutation/삭제·재시도·다음slot은 하지 않는다. 자원이30분 뒤 남을 수 있으며 그때 정확 소유 검토와 추가 조치를 보고한다. 실패를 성공으로 추정하거나 검사하지 않은 정리를0으로 보고하지 않는다.

## 제외와 결정
기존 정식/복구 DB·P03 R3/원 volume·실사용자/회원/권한·실제 key/Secret/CA·API/Web 서비스·Agent/LLM 비용·ysna/Oracle·운영 변경은 제외한다. 단순 정의 설치 통과도 실제 함수/RLS/문서 여정·IX01/전체 계획 통과가 아니다.

권장안은 위 새 QA 한 번만 실행해 보정 후 설치와 다음 오류를 실제로 확인하는 것이다. 대안은 source-only를 유지해 실제 PG 미확인을 남기는 것이다. 현재는 어느 실행도 승인되지 않았다.

## r2 — 동결 소스·SQL 결박과 직접 결정 요청
판정: SOURCE_VERIFIED / EXECUTION_DECISION_REQUIRED / ACTUAL_R2_NOT_RUN. 앞의 미정 code/index/SQL 값은 아래로 고정한다. 실제 실행은 아직 승인되지 않았다.

| 항목 | 정확 값 |
|---|---|
| branch | codex/av3-stage-b |
| 실제 실행 Git SHA | 9c3674fa33802cefe35960e61974edaa73864b61 |
| SQL baseline | 7e9ab984d2dad98fed208a2473853409dde927b9 |
| driver SHA256 | 2B555A8EBA685B9C8E9D0C4B709B394C2BC9988D0F24B69F6CC0E4A4A4DF0C12 |
| unit SHA256 | 38E7554CA70AAD8E1D1AC89154362218F9D7D81ED465ABB63C4DE5CADC2EBE4D |
| 새 index SHA256 | 11B2FA7EDD34149D609B8C837888324E77EF856E459B8F93EA5AE19BE4E3D005 |
| index 확인 |106 Git blob 일치·103 불변·0035/0071/0072만 총8B 증가 |
| 선택 |105개/2376115B·compact orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef |
| slot/previousHash |1/null. 추가slot·재시도0 |
| 소유 instance |9c3674fa33802cefe35960e61974edaa, 비밀 아닌 식별값 |
| 게시 검수 |62280c의소유45010→329683 exit0,정확8/rawindex일치·private exact·clean·main/보호3 불변 |
| Main 독립 검수 |9e5a8b39PASS/skip0/469.4384ms,0072d4→31431/cf1fac type/Bash구문0,aedc83→42880/a997ce SQL/index/선택 대조0 |

### 정확 bootstrap·회수·관측 SQL
다음은 새 빈 cluster의 내부 Unix socket에서 초기 관리자 anvil_v3_bootstrap으로만 수행한다.105개 원문 설치 사용자는anvil_v3_migrator다. hash는UTF-8·끝개행없음 기준이다.
```sql
BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE anvil_v3_ix01_ddl_20261104_r2_a1 FROM PUBLIC;GRANT CONNECT ON DATABASE anvil_v3_ix01_ddl_20261104_r2_a1 TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;
```
bootstrap SHA256: **fbb2e5ea6cffd479b776bc0621404415dd7a61cad48beca37efdbf71cb415883**.

정착 후 현재 metadata에 남은 reader membership에 해당하는 아래4변형 중 하나만 쓴다. 이미 원SQL에서 회수됐으면 빈 membership 변형을 사용한다.
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;COMMIT;" — SHA256 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 10df64294c159ae5c0a0f7376a78c15fc703c9b1f11f8ce038eeaeb3a9b44df6
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 4990526c6cd10894cde5132680921f594a5e831e05fe59177dfb39a9ec05ba11
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 8a8d58d31e4c2bd260fec6f59d362d1d03b1595d0278397f36a5946facc76992

역할 관측 SQL SHA256: **23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1**.
```sql
SELECT json_build_object('sessionUser',session_user,'currentUser',current_user,'roles',(SELECT COALESCE(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'login',rolcanlogin,'validUntil',rolvaliduntil) ORDER BY rolname),'[]'::json) FROM pg_catalog.pg_roles),'memberships',(SELECT COALESCE(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'adminOption',a.admin_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor))::text;
```
pristine/installer/정착/회수 이후 같은 검증기를 쓴다. 예상 밖 role·superuser/BYPASSRLS·멤버십은 UNKNOWN이다. 현재 app·reader의 비특권과 installer의 NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS를 유지하고 설치 구간 CREATEROLE만 명확 정착 뒤 회수한다. 원0066/0073의 reader 생성과 자체 멤버십 회수 조건을 수정하거나 대신하지 않는다.

### 명시 선택105
아래 배열의 compact JSON.stringify UTF-8·개행없는 형태를 orderHash 분모로 쓴다. index 표시 순서로 자동 적용하지 않는다. SQL본문의 정확 분모는 위 새 baseline/index다.
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

### 실제 허가가 필요한 범위
새 source checkout·0700 원장/빈Docker config·0600 소진기록 준비, 새 PG15 container 단1회, 그 빈cluster의 합성role·일회installer CREATEROLE·명시105 정의 설치·정착 후 권한 회수/검산·정확 새QA 종료/제거만 요청한다. 첫 실행의 허가를 재사용하지 않는다.
허가 관측 뒤30분 내 준비·실행하고 PG 작업 예산10분을 지킨다. 실행 직전1회 정한 issuedAt/기한·owner/공개plan rawhash는 감사에 보존한다. 이 시간 파생은 code/대상/SQL/권한/slot을 넓히지 않으며 hash도 사람 허가를 대신하지 않는다.
UNKNOWN이면 자동 후속/삭제·재시도/추가slot0이다. 자원이 기한 뒤 남을 수 있어 정확 소유 검토와 추가 조치를 보고한다. stop --time5는 새QA에5초 뒤SIGKILL할 수 있다. 정리 후 source/fullID/등록이름 부재는 별도로 확인하고 비밀 없는 감사는 의도 보존한다.
기존DB·원volume/P03R3·실사용자/회원/권한·실제키/Secret/인증서·API/Web 서비스·Agent/LLM·Oracle/ysna·운영은 제외한다. 설치 성공도 실제RLS/여정/UI·IX01·전체계획 완료가 아니다.
