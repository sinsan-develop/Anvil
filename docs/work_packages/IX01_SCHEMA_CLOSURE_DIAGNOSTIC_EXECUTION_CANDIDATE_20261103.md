# IX01 schema 의존 한정 진단 — 실제 실행 후보
2026-11-03 · Main 어울

**NOT_APPROVED / NOT_READY_TO_RUN**. 이 문서는 준비 중인 실제 실행 범위를 보여준다. source 구현 승인이나 기존53개 시험을 새 DB 실행 승인으로 해석하지 않는다.

## 목적·필요성
현재 프로젝트 생성과 파일 저장은 quota_adopt_creation/최신 quota_complete에 연결된다. 기존53개에 없는0042·0058·0059·0072·0073 및 metadata 정의의 설치 선행을 확인해야 한다.
새 빈 PG에서 선택한 고정 SQL의 정의 설치가 어디서 실패하는지 확인한다. 원 SQL을 바꾸거나 guard/권한을 낮추지 않는다. DDL 설치 성공도 함수 runtime/RLS·실제 문서 여정·IX01 합격은 아니다.

## 실행 전 반드시 채울 결박
- 검수된 driver code commit/hash: 미정. source 구현·독립 검수 후 고정한다.
- SQL baseline: d2f6ab8c74fad09f26319f77b3acb80afe3f927b.
- tracked SQL allowlist106개: 생성 중. index raw hash·총bytes를 검수 후 고정한다. 표시는 적용 순서가 아니다.
- slot별 선택 순서/원문 digest: 미정. 확인된 의존 DAG를 근거로 명시하고, 허가된 index 밖 추가/본문 변경0. 다음 slot은 앞 결과와 정리 증거를 대조한 뒤에만 선택한다.
- 실행 입력/원 기한/hash 및 정확 code SHA의 새 빈 Git checkout: 미정. 기존 인증만 사용하며 실제 key/credential 설정 변경0.
이 항목이 비어 있으면 실행 요청·실행을 하지 않는다.

## 새 전용 자원 후보
| 대상 | 환경·소유·제한·정리 |
|---|---|
| 실행 장소 | 기존 WSL-server Anvil 개발 대상·Linux 비root daon/UID1000. 예상 Docker daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e는 과거 기록이므로 실제 전 다르면 중단 |
| source checkout | 신규 /home/daon/anvil-ix01-ddl-20261103-r1-qa. 기존 경로/자료 재사용0. 검수된 code SHA를 기존 private Git에서 받음. 종료 뒤 owner/realpath/link/dirty를 재검산해 새 소유 source만 정리 |
| PG image | 기존 cache sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. pull/build/갱신0, 부재/불일치면 생성 전 중단 |
| 컨테이너 | 신규 anvil-ix01-ddl-pg-20261103-r1-a1/a2/a3. 동시1·각 slot 일회·전체 창≤30분/slot≤10분. 앞 slot UNKNOWN/미정리 시 다음0 |
| 격리 | network none/포트0/hostbind·named·anonymous volume0. PGDATA/socket/tmp는 명시 tmpfs만. read-only root·UID999:999·capdropALL·no-new-privileges·pids64·memory512MiB·CPU1 |
| DB/역할 | 신규 anvil_v3_ix01_ddl_20261103_r1_a1/a2/a3. 빈 합성 DB와 기존 QA source와 일치하는 비 superuser app/migrator 역할만. 오류 회피용 권한 상승0. Docker 내부 socket만 사용하며 기존 사용자·DB·비밀번호/키를 읽거나 바꾸지 않음 |
| 소진·감사 | 신규 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261103-r1. owner/link/0700·파일0600/O_EXCL·원 입력hash/기한·fullID를 보존. 비밀 없는 소진 원장은 의도 보존하고 잔여0 주장과 구분 |
| toolchain | 기존 Bash/Git/Docker/기존 Node24 내장 모듈. Node24 실제 존재는 아직 미확인이며 없으면 자원 생성 전 중단. 자동 설치/fallback0 |

## 실행·중단·정리
1. 승인·고정 입력·source/기한·대상/이름 부재·image/declared VOLUME·원장/owner를 검산한다.
2. 일회 의도를 남긴 뒤 create fullID를 획득하고 label/image/mount/port/network/자원 한도를 시작 전 재검산한다.
3. 새 PG의 준비와 합성 역할을 확인하고 선택 순서만 원 Git SQL bytes로 적용한다. 중복/미선택 파일·inline SQL/임의 경로·자동 전체 설치0.
4. 최초 실패의 code/대상과 bounded≤16KiB 비밀 없는 출력을 보존하고 즉시 그 slot을 끝낸다. SQL file≤30초/metadata command≤10초, source file≤2MiB/총≤16MiB.
5. 확인된 원장·create fullID·label/image·mount/port/network가 모두 일치하는 새 QA만 종료·제거한다. 필요 시 새 일회 QA container에 한정한 강제 제거를 실제 승인 문구에 명시한다. 기존 서비스/PID/volume/네트워크/host path는 대상0.
6. create/COMMIT/종료 결과 불명·출력 소실·신원 불일치는 보존/보고하며 성공·미전달로 추정하거나 다른 이름으로 재시도하지 않는다. cleanup 부재도 별도 조회로 확인한다.

## 영향·제외·선택
기존 정식/복구 DB·P03 R3/원 volume·실사용자/회원/권한·실제 key/Secret/CA·API/Web 서비스·Agent/LLM 비용·ysna/Oracle·외부 배포는 전부 제외한다. 이 실행은 그 상태를 복구하거나 변경하지 않는다.
권장 A는 최대3개의 일회 slot으로 서로 다른 명시 후보 순서만 진단하는 안이다. 더 작은 B는 slot1 한 번/10분만 허용하고 결과 후 추가 판단한다. C는 실제 실행 없이 source 검토를 유지하되 SQL runtime 미확인을 남긴다. 모두 현재 미승인이다.

현재 사용자 조치를 요청하지 않는다. 검수된 code/index/첫 선택 순서·입력hash와 정확한 명령을 채운 뒤 기존 source-only 경계를 벗어나는 **새 임시 PG 기동·합성 DB/DDL 실행·한정 정리**만 별도로 결정받는다.

## r2 — 실제 실행 선행 미충족 보완 (2026-11-03)
- 이전 후보 SHA D48D8B5F49DC24449BF7E33140947CBFB4E68E51F80B06C3E82A952058B246F6는 역사 snapshot이다. 판정 NOT_APPROVED / NOT_READY_TO_RUN을 유지한다. 앞 표의 runtime/수명 설명은 아래 정정에 따른다.
- code3은 동결됐으나 아직 이 후보에 게시 SHA를 결박하지 않았다. SQL index raw SHA dc8b5fc0fc6fc980ec28c7c5dc367bee2cbaf1b20f877c06ff6e97851d286045,106 Git blob 지문/크기를 Main4509c1에서 대조했다.
- 전체 후보는 기존 manifest53의 실제 builder 순서+최초 추가 이력 및 직접 FK/ALTER/alias를 대조한 후행52=105개다. 0031_empty_project_methodology_application.sql.pending 1개는 이미 prefix의 .sql과 같은 정의이므로 제외한다. 순서 hash(JSON.stringify(selected), UTF-8, 끝개행없음)는 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef/5420B, SQL 합2376107B. 순서의 PG 실제 타당성·미정 간선0을 보장하지 않는다.
- 비특권 bootstrap 유지 시0065까지96개 후보의 orderHash는98a6f1bac74eba21ff2825de5f5a493349b0141174e2f5954edc2836eb1a26dc/SQL1816707B이다. 이는 최신 collector0073/0074를 제외하므로 전체 IX01 실행 준비가 아니다. 검증 범위를 줄여 전체 합격으로 바꾸지 않는다.
- 0066은 CREATEROLE 또는 superuser 및 reader role 부재를 강제하며0073도 같은 선행을 요구한다. 현재 bootstrap NOCREATEROLE/NOSUPERUSER과 충돌한다. 알려진 권한 거절을 시험으로 반복하거나 SQL/guard/권한을 바꾸지 않는다. 이후105 후보 실행은 새 일회 QA 역할 선행의 정확한 결정이 필요하며 아직 미채택이다.
- 원장 아래 신규 빈 docker-config/0700, owner.json/0600 및 열린 부모 directory FD 검산이 필요하다. source/원장 생성 자체도 아직 실행하지 않았다. 전용 root의 소진 감사는 보존 대상으로서 QA 잔여0과 구분한다.
- 새 PG는 암호/키/Secret 생성 없이 내부 Unix-only local trust/host reject/listen_addresses 빈 값이며 Docker log-driver none을 고정한다. 외부 포트·network·로그 전달0을 source로 의도했으나 실제 inspect 검증은 NOT_RUN이다.
- Node는 개발환경 과거 등록의 /opt/node-v24.22.1-linux-x64/bin/node root:root/0755/126879696B/SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb를 실행 전 확인한다. 현재 WSL 존재 확인/설치0이며 부재·차이면 생성0으로 중단한다.
- UNKNOWN이면 자동 mutation·정리·다음 slot0이다. 자원은 원기한을 넘겨 남을 수 있고 수동 소유 검토가 필요하므로 '30분 안에 무조건 정리0'으로 요청/보고하지 않는다. 실제 허가 질문에는 이 제한과 임시 QA의 정확한 종료·제거 범위를 밝힌다.
- 현재는 PMO에0065까지96 한정안과 전체105의 역할 선행 판단을 요청했다. 이것이 신산님의 source-only/실제 DB·권한·키·서비스·Agent 제외를 해제하지 않는다. 실행 입력·원 기한·code SHA·선택안이 미정이므로 지금 실제 실행 승인 질문도 하지 않는다.

## r3 — 권장 단발105 후보의 구체 범위 (source 검수 전)
- PMO 기술 의견은② 전체 후보 준비를 권장하며 실제 실행 승인이 아니다. 이 r3의 권장 실행안은 **slot1 단 한 번**으로 좁힌다. 앞 r1의 최대3 slot 권장은 이 후보의 요청 범위가 아니다. 두 번째/세 번째 실행과 실패 후 재시도는 별도 결정 전0이다.
- 새 빈 전용 cluster의 installer만 설치 구간 CREATEROLE을 갖는 source를 기존 Primary가 준비 중이다. CREATEROLE은 cluster의 다른 비superuser role 변경/멤버십까지 가능한 권한이며 DB 하나만의 권한이라고 설명하지 않는다. 기존 cluster/PGDATA/volume·hostsocket·network/port·기존 role/계정·키·서비스에 이 권한을 적용하지 않는다.
- 원0066/0073의 role 생성/선행 검사는 그대로 둔다. reader 선생성·동명 role 인수·superuser/BYPASSRLS 전환0. 원 SQL 자체가 reader→installer 멤버십을 회수하는 점도 metadata로 대조하고, 정착 후 일회 installer CREATEROLE 회수·속성 검산→정확 새 QA 종료/제거를 수행할 source만 준비한다. bootstrap/회수 SQL과 metadata 기준·hash는 최종 검수 뒤 아래에 결박한다.
- 대상은 기존 WSL-server/daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/Name SINSAN/daon UID1000, 신규 source /home/daon/anvil-ix01-ddl-20261103-r1-qa, 신규 container anvil-ix01-ddl-pg-20261103-r1-a1, 신규 DB anvil_v3_ix01_ddl_20261103_r1_a1이다. cache PG15 SHA594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f 외 pull/build/기존 image·container·volume 변경0이다.
- 신규 원장 /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261103-r1 및 그 아래 빈 docker-config만0700·daon 소유로 준비하는 안이다. owner.json/slot-a1.intent.json/slot-a1.result.json은0600·O_EXCL·단일link·원 입력/기한 결박으로 비밀 없이 보존한다. 기존 경로·내용이면 자동인수/덮어쓰기/삭제0, 새 실제 생성도 아직0이다.
- 준비·실행 전체 창은 최초 실제 허가 수신 뒤30분 이내이며 PG slot의 실행 예산은10분 이내다. 실행 직전 issuedAt/만료를 한 번 고정하고 instance(비밀 아닌 소유 식별값)·owner원문hash·plan원문hash를 만든 뒤 변경/재소진하지 않는다. 이 시간/소유 식별값은 위 정확 대상·순서·code/정리 범위를 넓히지 않는다. 입력hash는 사람 승인을 대신하지 않는다.
- 허가된 원문 실행은 env -i로 시작한 Bash --noprofile --norc의 scripts/qa-ix01-schema-closure.sh --run 한 번이다. ANVIL_IX01_DDL_OPT_IN=EXACT_PLAN_APPROVED와 공개 계획 JSON/그rawSHA256만 넘긴다. Node24 과거 등록 지문·Git clean/exact executionHead·SQL baseline/index/selected SHA·원장/부모FD·daemon/image·name부재·VOLUME/격리 일치 전에는 create0이다. Node나image 부재/차이는 자동 설치·fallback 없이 중단한다.
- 원장 의도 저장→create fullID 검산→start→ready→정확 bootstrap·role 검산→아래105 원문 순서 설치→정착 후 일회 권한 회수·검산→fullID 소유 재검산→stop --time 5→rm→별도 부재 확인 순서이다. Docker stop은5초 안에 종료되지 않으면 새 QA에 SIGKILL할 수 있다. 이 종료/제거 허가는 **정확 새 일회 container**에만 필요하며 이름만으로 다른 자원을 채택하지 않는다.
- network none/포트0/hostbind·named·anonymous volume0/tmpfs only·read-only root·999:999·capdropALL/no-new-privileges·pids64/memory512MiB/CPU1/log-driver none을 유지한다. Unix-only local trust/host reject/listen_addresses 빈 값이며 암호·키·Secret 생성0이다.
- UNKNOWN/신원 차이/원장·회수·COMMIT 불명에서는 후속 mutation/자동정리/재시도/다음slot0. 자원이30분 뒤 남을 수 있음을 허가 요청에 밝히고 수동 소유 검토를 요청한다. 검사하지 못한 정리를0으로 보고하지 않는다. 성공·명확 실패의 확인된 신규 source 경로만 owner/realpath/nonlink/dirty 재검산 뒤 정리하고 원장 감사는 보존한다.
- 기존 정식/복구 DB·P03R3·원 volume·실사용자/정책·키/Secret/CA·API/Web·Agent/LLM/Oracle/ysna·운영 전부 제외한다. DDL 정의 설치만으로 문서 여정/실RLS/IX01/기능/전체 계획 PASS가 아니다.

### 고정 selected105 — JSON 배열 순서
SQL baseline d2f6ab8c74fad09f26319f77b3acb80afe3f927b, index SHA dc8b5fc0fc6fc980ec28c7c5dc367bee2cbaf1b20f877c06ff6e97851d286045, compact JSON.stringify(selected) UTF-8·개행없음5420B/orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef. 원 SQL 총2376107B/최대181052B. 중복0031 pending1개 제외. 아래 pretty JSON 표시는 읽기용이며 hash 대상은 같은 배열의 compact 표현이다. 순서의 실제 PG 타당성은 아직 미확인이다.
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

최종 code SHA·bootstrap/회수 SQL/hash·role 검산과 Main 독립 source 검수가 아직 미결이다. **NOT_APPROVED / NOT_READY_TO_RUN**을 유지하고 현재 사용자 실행 승인 질문0이다.

## r4 — 검수된 source 결박·직접 결정 요청안
판정: **SOURCE_VERIFIED / EXECUTION_DECISION_REQUIRED / ACTUAL_PREFLIGHT_NOT_RUN**. 앞 r1~r3의 code/SQL 미정은 아래 값으로 해소한다. 실제 실행은 여전히 미승인이다.

| 결박 | 정확 값 |
|---|---|
| 기존 개발 branch | codex/av3-stage-b |
| 실제 실행 checkout/code SHA | c84bdad14b1888281be2ee116031d573f9016193 |
| code parent | 10a00aad9b40a37f13a7a56b83d3b19824bf1833 |
| SQL source baseline | d2f6ab8c74fad09f26319f77b3acb80afe3f927b |
| driver SHA256 | 4750BAD4F26616807C7325E6967AA08212E3B4BE53ADFA3527D515D469BCB6D9 |
| unit SHA256 | 2FDCA333CC22D1DBAD856C09AF423801B42400144335E7902EBAE8F5EC635B62 |
| index SHA256 | DC8B5FC0FC6FC980EC28C7C5DC367BEE2CBAF1B20F877C06FF6E97851D286045 |
| selected105 compact orderHash | 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef |
| slot/previousHash | 1 / null, 추가 slot0·자동 재시도0 |
| 소유 instance | c84bdad14b1888281be2ee116031d573, 비밀 아닌 고정 식별값 |
| private exact | dbd9db의 소유 session39236→8a0fca exit0, exact SHA·main·보호3 불변·게시 시 tracked clean |
| Main 검수 | 08fb80 34PASS/0FAIL/skip0/398.5456ms, a9c9f2 noEmit/Bash-n exit0, e4aa3d/c47b5d 정적 미해결 C/I0, 실제 PG검증0 |
| 기존 접속 대상 | SSH WSL-server. 기존 scripts/link-development-db.ts:9의 등록 대상과 같으며 credential 설정/키 변경0. 실제 현재 접속/daemon/runtime 확인은 아직0 |

### 정확 bootstrap/회수·검산 SQL
hash 분모는 UTF-8·끝 개행 없음이다. 다음 bootstrap은 새 빈 cluster의 내부 Unix socket에서 초기 관리자 anvil_v3_bootstrap으로만 수행하며,105 원SQL의 실행 사용자는 anvil_v3_migrator이다. bootstrap 관리자가 원SQL을 대신 설치하지 않는다.
```sql
BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE anvil_v3_ix01_ddl_20261103_r1_a1 FROM PUBLIC;GRANT CONNECT ON DATABASE anvil_v3_ix01_ddl_20261103_r1_a1 TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;
```
bootstrap SHA256: **496caf4e72938b8129b8b52354afc7c0a8c8db8f2c39ed598716247b758ece8c**.

회수 SQL은 아래4가지 중 실제 정착 metadata에 남은 정확 reader membership에 해당하는 하나만 허용한다. 원SQL에서 이미 회수했으면 빈 membership 변형을 사용한다. 원문/role/SQL을 임의로 추가하지 않는다.
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;COMMIT;" — SHA256 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 10df64294c159ae5c0a0f7376a78c15fc703c9b1f11f8ce038eeaeb3a9b44df6
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 4990526c6cd10894cde5132680921f594a5e831e05fe59177dfb39a9ec05ba11
- "BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;COMMIT;" — SHA256 8a8d58d31e4c2bd260fec6f59d362d1d03b1595d0278397f36a5946facc76992

공유 metadata SQL SHA256: **23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1**. pg_roles의 이름/속성·pg_auth_members의 role/member/grantor/admin만 조회하며 password/원문/사용자 자료는 읽지 않는다. 대상은 새 빈 QA cluster뿐이다.
```sql
SELECT json_build_object('sessionUser',session_user,'currentUser',current_user,'roles',(SELECT COALESCE(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'login',rolcanlogin,'validUntil',rolvaliduntil) ORDER BY rolname),'[]'::json) FROM pg_catalog.pg_roles),'memberships',(SELECT COALESCE(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'adminOption',a.admin_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor))::text;
```
검산은 pristine→installer→정착→revoked 네 경계다. PG15 고정 system12종/기본 membership3과 bootstrap을 검산하고, installer/app 및 원0066/0073 reader 두 역할 외의 새 role/예상 밖 membership을 거절한다. app/reader는 NOSUPERUSER/NOCREATEROLE/NOBYPASSRLS, installer는 NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS를 유지하며 설치 구간 CREATEROLE만 정착 후 회수한다. 원SQL이 이미 회수한 reader membership 부재는 정상이다. metadata 불일치/회수 결과 불명은 UNKNOWN·stop/rm 포함 후속 mutation0이다.

### 시간·입력과 실제 요청 범위
- 이 문서의105 선택·위 exact code/SQL·slot1·resource literal은 고정이다. 미래 실제 허가 수신 뒤30분 내 준비·실행하고 PG 작업 예산은10분이다. issuedAt/만료시각은 허가 전 미리 소진시키지 않고 실행 직전1회 고정하며,18필드 공개 plan/owner marker의 원문 SHA256을 소진 의도/결과에 남긴다. 시간 파생/원장hash 계산이 새 대상/SQL/권한/slot을 허가하지 않는다. 입력hash 자체는 사람 승인 증거가 아니다.
- 허용 여부를 직접 결정받을 것은 **새 전용 source checkout·보호 소진원장/빈 Docker config 생성, 새 PG15 container1회 기동, 합성 role/일회 installer CREATEROLE·원SQL105 정의 설치, 정착 후 해당 권한 회수/metadata 검산과 exact 신규 QA 종료·제거**이다. 기존 DB·role/권한·키·서비스 변경 제외는 유지한다.
- 성공/명확 실패 뒤에는 fullID/소유/label/image/mount/port/network 검산한 신규 QA만 정리한다. stop --time5는 새 QA에5초 후 SIGKILL할 수 있음을 포함한다. Git source 경로는 새로 만든 사실·UID/realpath/link/dirty와 process 사용0을 확인한 경우만 정리하며 원장 감사는 보존한다. UNKNOWN은 자동정리/재실행하지 않으므로 자원이 기한을 넘겨 남을 수 있고, 그때 정확 소유 검토와 추가 조치를 보고한다.
- 이것은 최신 SQL 정의 설치 의존을 확인하는 한정 실행이며 DB복구/실서비스·문서여정/Agent/IX01/전체계획 합격이 아니다. 실제 PGparser/권한회수/cleanup/자원 잔여 검수는 아직 NOT_RUN이다.
- 선택 A(권장): 위 단발 실제 QA만 허용해 정의 설치 오류/다음 선행을 실제로 확인한다. 원상 복구는 새 QA 폐기로 가능하나 UNKNOWN에서는 자동 삭제하지 않는다. 선택 B: source-only를 유지해 실제 실행은 하지 않고 SQL/runtime 미확인을 남긴다. 기존 서비스/DB/키/Agent는 어느 선택에서도 제외한다.
