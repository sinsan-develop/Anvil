# FN02 정식 개발 PG metadata 관측 결과

## 2026-10-25 새 직접승인 관측 — 이전 기록과 별도

- 승인 원문01a17002-c88d-7213-8c28-ad45238d1d84, P1-20261025-072312-01. source f8fe81e57998263425efa66211ae2c3908e4d5b7의 기존 probe 단1회 a02537 exit0/OBSERVED_METADATA_ONLY. DB anvil_v3_development, app 역할 anvil_v3_app, server_version_num150018, readOnly=true, productRowsRead=0. UNTIL2026-10-24T22:35:51.113572Z. configHash56af96763702f0afeaf0e8aec29f58fb06ad911d8b98483333bfed51b4c17299·Secret/DSN/본문출력0.
- 실제 마이그레이션46행, 0012_assignment_drafts·0013_assignment_confirmation·0014_context_preparation·0015_project_baselines·0016_execution_preparation·0017_execution_authority·0031_empty_project_methodology_application은 기록에 없다. 고정8객체 중 project_methodologies/r/application_command_column=false만 관측됐고 나머지7객체는 결과에 없다. 아래 10/20 checksum표는 과거 관측으로 유지하며 이번 결과와 전체46 checksum을 독립 자동 비교했다고 주장하지 않는다. metadata 일치/부재는 전체객체·데이터/권한·기능 검수증거가 아니다.
- 등록 신규 Git root/uid1000/0700/clean e00b66, 공개lock npm ci(ignore-scripts/noaudit/nofund)102packages exit0 5116da. 실제1회 읽기 후 fe1ced owner1000·내부의존성링크13/외부0/관련process0 확인하고 exact 신규root 제거·PG보존. WORK_STATUS의 별도SSH 부재확인과 연결한다. DB변경·migration/seed·계정/정책/Secret·cert/trust/APIWeb/Agent0. source/시험 준비 승인과 실제schema적용은 구분한다.

## 판정

2026-10-20 / Main 어울 / source `a66829686dba7d218ca78821951ada5f550413b7` / 기존 branch `codex/av3-stage-b`.

**OBSERVED_METADATA_ONLY**. 기존 PG 단1회 기동·고정 metadata READ ONLY 조회 exit0. 실제 migration46이며 신규6개 및0031은 미적용이다. API/Web는 재개하지 않았고 사용자 기능·전체FN02/Stage 완료가 아니다. metadata의 일치가 실제 모든 객체 정의의 인증은 아니다.

## 범위·source 검수

- [실행범위](../../../work_packages/FORMAL_PG_SCHEMA_READ_ONLY_EXECUTION.md) E5C20176CA5FD779C2B9196BC057C2CD36BEC925928F12F22D9510629C4E3B3C. PMO 위임판정 issued2026-10-20T11:19:08Z/expires11:39:08Z, 신규start마감11:36:08Z. 소진옛허가 재사용0·이번 플랫폼 승인 거절0.
- probe E03478D44C99E98EC768889865D17262C6C4989EA63A14D391BB374F5FAADF2B/test F21B16A970E550561BC71557D9921E265C3E0C63CD948EB319A9898A42C7DD03. 원 독립C0/I1/M0(늦은만료검사)→신규지연2RED/원4PASS→6PASS203.1526ms·typecheck0·scopedC0/I0/M0. 단위음성은fake/helper이며실제만료IO물리중단증거아니다.
- `node scripts/development-schema-probe.ts --plan` exit0/configReads0/databaseAccess0. Git local/private exact a668·main f976ed5e 불변·제외6 보존.

## 실제 실행·신원

1. 등록새Git/cache 부재·부모realpath/nonlink/UID1000, 정식PG exited0/소비자 PG만1/network다른연결0/3830·5546 listener0 확인.
2. 사설Git exact a668를 새 전용 경로로 가져옴/clean/source hash 일치. Node24.21.0·lockfile `npm ci --ignore-scripts --no-audit --no-fund --cache <등록cache>` exit0/102packages. npm새버전notice만 관측·자동업데이트0.
3. `/usr/bin/docker --host unix:///var/run/docker.sock start <fullID>` 단1회 exit0. fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/SINSAN, image594290e9·volume/network/port 정의 유지. StartedAt2026-10-20T11:21:54.792276193Z/PID2624802·새ready marker1. rawlogs전송0. 정상PG보존/stop·retry0. PG자체WAL/통계쓰기0주장아님.
4. source고정 probe `--read-only`를 subprocess30초상한/UNTIL11:39:08Z로실행, exit0/stderrBytes0. 기존app.json은메모리소비/configHash56af96763702f0afeaf0e8aec29f58fb06ad911d8b98483333bfed51b4c17299·Secret/DSN출력0. DB anvil_v3_development/role anvil_v3_app/version150018/readOnlytrue/nonSuper/noBypass, BEGIN READ ONLY와고정SELECT/두manifest동일/COMMIT 확인.
5. 고정8객체 중 project_methodologies r/application_command_id 없음만 관측. assignment_drafts·execution_preparations·agent_sessions·executions·execution_grants·writer_claims·execution_commands는 부재. 계정/제품내용행0·DDL/DML/seed·권한/Secret·APIWeb/Agent변경0.

## 실제 migration ID/checksum — 두 관측 동일46

| ID | SHA256 |
|---|---|
|0000_environment|6ebbb9c580d54a50e0431806ee982244cbe134613354f8c3a8cd4f547e30178d|
|0001_projects_access|353d28d657794d47b84db0c8a4d9481c8ebc9bf73278614578c6cf5cfd4c3643|
|0001_source_declarations|246fd20284f998ac8d1c1cbea1570372f7d6a204dad885ea41112eeda5b3c025|
|0002_builtin_condition_contract|eb2ad7f988be2564b0d5fffa79657060b7c60cdb22c891e7d0a412463821b3a9|
|0002_methodologies|0453854b9925f5ff2eeed15babfb5dda8446fbb751b3e7caf0378a98d6dbcd34|
|0002_project_methodology_revisions|f816147a1454b428af090b0feb93e496b60cb4eaba7f5979fccdf919fc353e68|
|0003_document_confirmations|58ebdd39cddb67cbbf4fa2f21bea42848dfa7e0851297bd7592f8b3ce36e9fd5|
|0003_document_imports|c9ffa0c09d8597e410a9b85ead5b1aad3413df82e7f6efa2169ad514fa001afb|
|0003_document_proposals|93cb063a0214f2197afca309ed3d4482a0ea8bac765b9e72f42b110bdb6f542a|
|0003_document_stage_bindings|5ec9965d55ad7968d5dac7a2cf90f388b6e3bf6e1a1e74913d32bb8d1c4041e1|
|0003_documents|51637420526c3bdae9c9b1ae3a020f2fd5c964125f67cd680b646eb191a0f59b|
|0003_project_artifacts|78a0457fda6c394605ca46a7b6aec761aec6de0a84f47450b9cda326dac9ccd8|
|0003_project_document_reviews|f1ba53b79b95a02867822743748ead6f6dafff039a506651a26368d7b922de75|
|0003_project_documents|748e8f07ffa2b1093e1141504e8a5134332518a9bf56ec04584e59e84e7a4292|
|0004_design_change_proposals|2cafd54f19dade5780c0f9dab652999c65ed1b072bafe3e64b701935ea7b7d70|
|0004_design_change_source_binding_fix|1ec0d32d45a770998be2da36d2eab7cd557f16314ee41618676bcefea704b95a|
|0004_design_change_sources|02b4f223f482ebe2dedd8090eb725d93f953f0afac47702fe3d31f21609b0e69|
|0004_design_impact_review_operator_fix|c3d5cb62a7f5615db0325f9008031f61c6d16a225bc2ef241defcadbc75c002b|
|0004_design_impact_reviews|e99067f14f8fa1d5ba775c3c6e4096ecf4a20483651d0e777776a74e4589275c|
|0004_design_index|d0d6ef9221a46c96c4e6f033d6a14e22cc07b26a8bcb1949d67dbb8e574aea6a|
|0004_trace_links|31b8f7525bf8e07c4e6e13644ea97715b39e57cb9400a7fece8cbaccf1d0d51c|
|0004_work_plan_confirmation|8c899de2c7c5e673a8915fd2ebd83e78b32e0d87d4828b50cd76dd499b03a249|
|0004_work_plan_drafts|9ea544780d61cf7b5914b9db597eadba2291fb487f42a373d695f053b8e8610e|
|0005_artifact_quarantine|27480ec2d09bc14bf88196e7d45104bfac107f7fa362760246d0b49eaf043ad5|
|0005_conversations|8241d4e6321d8798ecc8e78d83eae1147a3c8ff7110cdd86370cab3b73be98dc|
|0005_knowledge_changes|03dc6518781e35af3a06c28d7ee18d05936b2ebc9e513cbc0b100495b36c24fe|
|0005_knowledge_confirmation|35bd5b9a3f6109881f0f22b1a06957114ea714556e03700678c7e1ba3d353766|
|0005_knowledge_drafts|42efe15b4ebe3a860364ef85d92631fcf85c71f7143738026155e5814893153a|
|0005_project_constitutions|71f4674b279ffea063e3291c392ac822ab4367a0393834079b79caeea29dd765|
|0006_connection_candidate_guard_alias_fix|b9642ef359ea0ed71bb0d65551feeac9a287930a2ec81ed643f3e327d0204aa0|
|0006_connection_candidates|327af229e0a2f88f1e763e83ddebd3c522cf3cda2d2d43e9355ef2c8bc8b280d|
|0006_host_trust_challenge_protocol_fix|a57c5432f0eff9152889b4dd7e23409e8dbc1cadd8b34426e0a6b3b012b15f3c|
|0006_host_trust_registrations|3027636015d284462a4f974ad792175851ef28f05c73117fd4a813853e329020|
|0008_source_read_observation|26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185|
|0008_source_root_registry|d9d27d2c92e31e6c5e50bf18762786d2cad2b47a28905bc8f0f15fa2cec72403|
|0011_authorization|b5922fe31715076e7cdb1f6485f9ea5af4554c90fb957fb3b3a2c42ea22b9a21|
|0011_draft_method_reviews|a7aad194c8dff3a29ec502f1e94b0e4728bb5c087aba02390f11a75c3765efaf|
|0011_one_time_approval_consumption|9eab1fcba2586bf87f202cefc39f300e152e1415c8339692438074b3b800b29d|
|0011_one_time_approval_decisions|727c586254d34bd454986bf899cfc53429682e751deb36555b5bdae19a1f141a|
|0011_one_time_approval_requests|be0c422f5e9f4f3869e076d6331436b6bf944abf11865aa62d0e7aaa48ce1b5c|
|0011_project_creation|0ad0e1e9d429afe65014492d1cb07e629df56c081d3643233c3f32ba5ff3fb95|
|0011_project_policy_control|e186f87e8ba04548d5559900f5afabd9aead16b61808b066b868eaa6ea669020|
|0011_user_common_content_reviews|0009cfe2c02b92a4e930d538ce5c0c5d67215c6d89aca6c1a4345868ccbc4f01|
|0011_user_common_control|ea3043a71f4d1557bf9620ac06f88274ed7227629fe2b1bfab00e7409d16563c|
|0011_user_common_forms|b1bb3b65bd7f9616bb6f79e456c27c042da4a2dfdfc8f3a6167e4cd06480044a|
|0011_user_common_method_reviews|9e480e3bd4da152befdbb2bca8a2f5e1b3cdf0ed43336c5b210090f7ff02fea2|

## 오류·회수·한계

- 최초 보조문서 검색에서 Windows wildcard 경로/부재 디렉터리로rg exit1. 실제 docs/work_packages·04_test_reports 경로로 좁혀 exit0. 권한변경/DB재시도0.
- 사후 정의rawhash가1회 a72162b0af5a9714dac4fa2edbfdaa752d3770bf52677e91ece77c122f248514로 관측됐다. 숨기거나 기존hash를소급교체하지않았다. 안전필드전체와후속읽기의원배열/역배열hash를계산하여 **Mounts 두 항목의 배열 순서만으로1eb2552c/a72162b0 두값이 대응**함을 확인했다. 후속원배열은1eb/역배열a721이었다. mount필드·ID/image/labels/network/port/restart 변경명령0이며 mount배열순서에취약한관측hash임을남긴다. 향후계약정규화는별도명시하고이번raw불일치를지우지않는다.
- 전용Git/cache의exactSHA/clean·UID1000/nonlink·같은device/inode·lsof열린process0·파일별hash를대조한뒤개별unlink/빈rmdir로회수했다. 7386files/1060dirs/13links/360237848bytes, inventorySHA c5ba1b03276d8a15d87d263a22b142fce64345fef93203fdaf7220c5133d00e5. 별도SSH조회exit0으로등록두경로부재확인. 정식PG는running/동일StartedAt,3830listener0·5546listener1이다. 정상기동의5546생성은예정효과이며'포트변경0'으로숨기지않는다.
- 미실행: 누락6개/0031 적용·rollback/backup·제품본문/계정·API/Web·실제화면·Agent. 원정지원인도미확정이다. 다음은고정실제46을입력으로 기존6개선행의채택/실행계약·복구범위를대조하여정식반영을진행하는것이며이조회허가만으로DDL하지않는다.
