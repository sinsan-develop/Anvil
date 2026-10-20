# FN02 정식 schema 반영 준비 — 실행 불가 후보

2026-10-20 / Main 어울 / 기준 `1a2d5bfd1cb2a71a5e07c48273cdcb6adcce9dc4` 이후 code-only 후보.

## 경계와 완료할 기능

- 목표는 기존 승인 FN02/UI03의 빈 프로젝트 방법론 명시 적용과 임무·맥락·시작 기준선·실행 준비의 실제 저장 연결이다. 이 문서는 새로운 제품 기능/자동 승인/실제 Agent 실행을 추가하지 않는다.
- 실제 정식 PG는 2026-10-20T11:21:54.792276193Z 시작 후 running/PG15.18이며 고정 READ ONLY 관측은46개다. API/Web3830=0/PG5546=1은 해당 관측 시점의 값이다. 이후 live 재확인은 하지 않았다.
- **기존0012 정식 실행의 안전 거절·직접 질문 미답변은 미해소**다. 다른 실행기로 같은 행위를 우회하지 않는다. 이전 단발 metadata 창은 이 후보의 백업·DDL·추가 조회 허가가 아니다.
- 현재 준비 범위: source/기존 결과서 대조, `scripts/fn02-development-adoption-plan.ts --plan`, 로컬 단위시험, 문서 보완. 별도새판정아래도구/fs와migrator READ ONLY metadata는각1회실행·정리완료했고추가접속허가는아니다. 백업·DDL·서비스·Secret/권한의실제변경은0이다. `--apply`/`--apply-schema-only` 등은거절하며backup/DDL orchestrator/runner는외부등록하지않았다.

## 고정 반영 차이 — 자동 실행이 아닌 제안 순서

기존46 ID/checksum은 [실제 관측 결과](../04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md)의 표를 보존한다. code-only planner는 이 표와 현재 source46이 다르거나 누락/추가/중복이면 거절하며, 관측의 현재성을 인증하지 않는다.

| 제안 순서 | Migration | SHA256 | 누적 수 |
|---|---|---|---|
|1|0012_assignment_drafts|1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133|47|
|2|0013_assignment_confirmation|fe064af94b23185066047f8e202806cd4c3a7fe69ab7855bd2d2f6b961ae7cca|48|
|3|0014_context_preparation|7c8fa1c83400e711d341e3710f765fa29af5fa6c821adf594ce195172194ec97|49|
|4|0015_project_baselines|3e5eea0f94186f0cc28819d435e85c4fec97569dda3bef7751ad420ed9d3b6ec|50|
|5|0016_execution_preparation|612be372c2a82f201c072dde62e7c1222ff96168172edf22a11226e7291fe91d|51|
|6|0017_execution_authority|40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3|52|
|7|0031_empty_project_methodology_application|e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6|53|

- 첫6개는 임무 초안/확정·맥락 패킷·프로젝트 시작 기준선·실행 준비/권한 저장 계약이다. 새 table/function/trigger 및 기존 app-role에 대한 GRANT/REVOKE가 포함된다. 특히0017에는 실행 원장 INSERT 권한과 guard가 있으므로 **무해한 metadata 추가·권한 변경0이라고 설명하지 않는다**. 실제 사용자 정책 자동 부여·계정 생성·Agent 호출은 별개다.
-0031은 새 적용 명령과 저장 보호/receipt·CAS/7원장 이력·동시성 guard를 바꾼다. 기존46/소스 SQL/pending 원문은 덮어쓰지 않는다. SQL hash가 달라지면 후보를 조용히 추종하지 않고 실패한다.
- 제안은 한 migration TX에서46→53(기존 migration advisory lock과 고정순서/각기록 확인) 후 단1회 COMMIT이다. planner는 이 순서의 before/after 수와 manifest hash만 계산한다. 실제 TX/DDL/COMMIT 코드는 현재 없다. 중간47~52를 성공 checkpoint로 만들거나 실패를 지나쳐 적용하지 않는다.

### 허용 diff를 확정할 source 대조 목록

아래는 고정 SQL 본문에서 읽은 주요 대상이며 자동 SQL 파서/실DB 객체 검증이 아니다. 실제 실행 전에는 함수 signature·trigger·index·constraint·권한의 전체 정의를 SQL hash와 함께 고정해야 한다.

| SQL | 신규 table | 기존 객체에 대한 핵심 변화 |
|---|---|---|
|0012|assignment_drafts, assignment_draft_versions|새 초안의 SELECT/INSERT/UPDATE와 불변 버전 SELECT/INSERT·guard. 기존 사용자 정책/계정 자동 생성 없음|
|0013|assignment_content_reviews, assignment_versions|새 검토/확정 이력 SELECT/INSERT·UPDATE/DELETE 금지·검증 함수/guard|
|0014|context_bundles, context_items|새 맥락 묶음/항목 SELECT/INSERT·불변 이력/완전성 검증|
|0015|baseline_drafts, baseline_draft_versions, baseline_content_reviews, baseline_heads|기존 project_baselines.source_snapshot_ref의 NOT NULL 제거, nullable metadata7개·legacy/FEATURE_STATUS_V1 CHECK/FK/UNIQUE/index와guard추가·기존table app-role INSERT허용/UPDATE·DELETE거절. 기존 행의 신규 metadata는 NULL로 보존한다는 SQL 계약이며 실제 기존 행 보존은 미검증|
|0016|project_roles, agent_sessions, role_bindings, execution_preparations|새 프로젝트 논리 역할/세션/준비 table의 SELECT/INSERT·guard. PostgreSQL 실제 계정/role을 생성하는 기능은 아님|
|0017|limit_policy_versions, usage_reservations, executions, execution_grants, writer_claims, execution_commands|새 원장 SELECT 및 최종 INSERT권한·초기 실행 graph/불변성 guard. 초기 REVOKE만 보고 최종 INSERT 허용을 누락하지 않는다|
|0031|없음|기존 project_methodologies.application_command_id UNIQUE/FK 및 적용guard/지연완전성 추가, initial_project_methodology_guard trigger의명시적교체(기존함수본문은보존), commands의완전성/불변guard추가, 앞서생긴7개이력table에project lock trigger추가|

새 table은합20개이며, 이 표 밖의 기존 객체 변화가 발견되면 source/정확 SQL과 대조해야 한다. 특히 기존 project_baselines·project_methodologies·commands의 구조/trigger 변화는 '대상외 불변'에서 숨기지 않는다.0031의 DO 블록이 생성하는7개 trigger도 단순 CREATE행 검색만으로 누락하지 않는다.

## 기존 증거를 재사용할 범위

### 보존 대상과 snapshot·잠금의 최소 제안 — 실행0

고정81표는기존46의source등록부 assignmentDevelopmentBaselineNames에서가져온기대목록이다. 최신metadata는표수81만관측했고현재이름전체가같다고인증한것은아니다. 계획출력도 liveNamesVerified false로유지한다. 정식실행전실제집합/열목록/타입·소유/ACL·정의가다르면dump/DDL0이다. 이름목록의sorted JSON SHA256은0212665828281ced090d33d1c73888cd439b54eacac24bc4bcaebc1e30b306a6으로고정한다.

```text
anvil.approval_consumptions, anvil.approval_decisions, anvil.approval_requests
anvil.artifacts, anvil.audit_events, anvil.auth_actions
anvil.auth_attempt_windows, anvil.auth_audit_events, anvil.auth_sessions
anvil.authoring_standard_versions, anvil.authorization_receipts, anvil.clients
anvil.commands, anvil.connection_candidate_versions, anvil.connection_candidates
anvil.connector_credentials, anvil.connector_registration_challenges, anvil.connector_registrations
anvil.connectors, anvil.constitution_applications, anvil.content_reviews
anvil.conversation_messages, anvil.conversations, anvil.delivery_outbox
anvil.design_change_impacts, anvil.design_changes, anvil.design_items
anvil.document_artifact_links, anvil.document_confirmations, anvil.document_import_selections
anvil.document_imports, anvil.document_proposal_selections, anvil.document_proposals
anvil.document_version_events, anvil.document_versions, anvil.documents
anvil.draft_audit_events, anvil.draft_methodology_reviews, anvil.form_definitions
anvil.form_reviews, anvil.form_versions, anvil.installation_claims
anvil.knowledge_entries, anvil.knowledge_events, anvil.knowledge_versions
anvil.methodology_definitions, anvil.methodology_reviews, anvil.methodology_versions
anvil.password_credentials, anvil.permission_policies, anvil.permission_policy_versions
anvil.plan_dependencies, anvil.plan_tasks, anvil.project_baselines
anvil.project_constitutions, anvil.project_control, anvil.project_drafts
anvil.project_events, anvil.project_members, anvil.project_methodologies
anvil.project_source_declarations, anvil.projects, anvil.recovery_credentials
anvil.schema_migrations, anvil.screen_regions, anvil.source_declaration_versions
anvil.source_declarations, anvil.source_read_challenges, anvil.source_read_credentials
anvil.source_read_grants, anvil.source_root_versions, anvil.source_roots
anvil.source_snapshots, anvil.trace_edges, anvil.user_common_audit_events
anvil.user_invitations, anvil.users, anvil.work_plan_confirmations
anvil.work_plan_versions, anvil.work_plans, anvil_qa.fixtures
```

- 표밖의함수/trigger/index/constraint/도메인·type/DB설정·owner/ACL/default privileges·extension정의·sequence상태·large object도full custom dump의보존범위다. 표fingerprint만으로이들을대신하지않는다. 기존source는auth_audit_events.server_sequence의identity를정의하므로기대sequence는 `anvil.auth_audit_events_server_sequence_seq`다. 실제목록/속성/소유권·의존을확인하기전현재DB에그하나만있다고단정하지않는다. 예상밖schema/객체·권한·sequence/extension이있으면자동제외/삭제하지않고정확차이를보고한다.
- 프로젝트의외부원문blob/보호config·DBcluster role/password·인증서는DBdump에포함되지않는다. 이번7SQL이그파일/cluster를변경하지않는다는범위를지키며원경로/원본은그대로보존한다. 전체프로젝트백업완료라고주장하지않는다.
- **A: backup 단계 제안** — 기존migration advisory xact lock과고정정렬81표 SHARE잠금을새RW/REPEATABLE READ TX에서획득한다(READ ONLY TX의강한LOCK허용을가정하지않음). 표잠금요청은고정목록순서/lock_timeout5초,타임아웃·이름/권한불명은rollback/DDL0. 새덤프전용TX에는데이터쓰기/권한변경을넣지않는다. 동일 exported snapshot에pg_dump와원본의81표count/hash·기존46/객체metadata를결박한다. snapshot발급후최대120초/단계전체180초·idle-in-TX180초안에종료하고넘으면backup불완전표시/rollback/DDL0이다. snapshot획득시점보다늦게끝난다른변경이있을가능성은B단계현재값재대조로처리하고'항상최신'이라고보장하지않는다.
- **표 외 sequence 주의** — sequence상태는MVCC snapshot·표SHARE잠금만으로고정되지않는다. 덤프전후각sequence의last_value/is_called/속성을별도비변경읽기로대조하고,정확복원값도비교해야한다. 다른sequence소비자가있거나지속적인중단을확인할수없으면DDL0이다. nextval/setval/ALTER SEQUENCE로검사를통과시키지않으며현재접속수0을미래보장으로쓰지않는다. 이quiescence전제의실제충족은아직미검증이다.
- **분리복원** — A완료/잠금해제후보호backup을앞서고정한none-network/tmpfsPG에복원해동일46·원래객체/owner/ACL·표count/hash·sequence/large-object보존을검수한다. DB18.5MB/가용550GB는사전관측이며최종생성전공간·메모리/소유권·대상부재를확인한다. tmpfs2GiB외에최소1GiB의메모리여유를확보하지못하면생성0/자동확대0이다. 복원실패는분리자원partial실패이지정식DB복구/다운그레이드명령이아니다.
- **B: 정식migration 단계 제안** — 새로운 READ COMMITTED TX에서같은migration advisory xact lock과동일정렬81표 SHARE잠금을획득한뒤A의기존46/객체·데이터보존지문과현재값을재대조한다. SHARE잠금대기전에잡힌옛MVCC snapshot으로현재값을검사하지않도록대조SELECT는잠금획득뒤의새READ COMMITTED snapshot을사용한다. 그사이변경/예상밖writer/sequence변화가있으면기존backup은과거시점자료로보존하고DDL0/자동새dump·retry0이다. 대조가맞아도별도직접결정없으면0이며,그후에만고정7SQL/기록을한TX로소비/검수/COMMIT하는제안이다. SHARE는일반DML을막지만관리자·독립sequence변경등을완전통제한다고주장하지않는다. 필요한ALTER가자기잠금에서승격하더라도다른reader때문에막히면lock5초/statement30초/전체10분상한에서rollback한다.
- **기존 행 비교** — old-column projection은A때관측/고정한기존열의순서·타입·표식별자로만만든다.0015/0031의새nullable열때문에to_jsonb(전체행)지문이달라지는것을원데이터손상으로혼동하지않고,기존열값count/hash를비교한다. schema_migrations는추가7행을별도검증하되과거46행의timestamp포함원본은정확기존ID목록으로필터해보존지문을비교한다. hash에의해본문을DB안에서읽으므로이역시새직접결정대상이며평문/개별row를Git·출력에넣지않는다.
- **완료·불명 처리** — 별도postcheck도기존열/허용DDLdiff·53·새20표의예상빈상태·권한/trigger/sequence를각각대조해야한다. COMMITUNKNOWN/종료불명·postcheck실패는자동재실행/restore-in-place/drop0·원backup/실상태보존·필요한새읽기결정으로분리한다. 지금source는고정계획/기대대상만출력하며이잠금·덤프·본문hash·복원·DDL경로를실행/등록하지않았다.

-0012 기존 formal executor는46→47 한 개만 다룬다.0013~0017을 자동등록하거나 이번 거절을 해제하지 않는다.
- [등록 helper 실제 검수](../04_test_reports/AV3/FN02/FORWARD_REGISTRATION_RESULT.md)는 새 빈 격리52→53/rollback/실패종료/동시 재호출의 증거다. 정식46→53·현재 데이터/권한 보존·복구 증거가 아니다.
- 실제46 metadata 조회와 전용 경로 정리는 완료한 범위로 유지하며 같은 조회/격리 시험을 반복하지 않는다. 아래 backup/restore와 정확46→53 결합 검수는 **기존 시험과 다른 미검증 범위**다.

## 별도 실행 결정 전에 필요한 보존·복원 계약 초안

아래는 실행 제안이며 경로 생성/DB 조회/백업/복원 모두 미실행이다. 실제 역할의 덤프 권한/도구 설치 여부도 미확인이고 새 superuser·GRANT·Secret로 우회하지 않는다.

1. 대상은 기존 WSL-server PG fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba / image594290e9 / DB anvil_v3_development 한 개다. 정식 현재46의 정확 ID/checksum·예상 기존 객체·실제 active writer/공유 소비자를 새 허가 안에서 확인해야 한다. 서비스3830=0만으로 writer0을 단정하지 않으며 advisory lock도 일반 DML을 막지 않는다. 불명확하면 적용0/기존 자원 보존이다.
2. 최소 backup 제안: 단일 DB의 schema+data+함수/trigger/ACL/owner·migration 기록을 포함한 consistent custom dump와 비밀 없는 manifest/hash. cluster globals·SSH/인증서/보호 config 파일 원문은 복사하지 않는다. source/Git은 별도 checkpoint다. DB dump에는 사용자 본문·계정의 password hash/세션 등 민감 자료가 들어갈 수 있어 **새 데이터 열람·복사 승인 경계**이며 metadata 허가로 생성하지 않는다. 출력은 이름/hash/크기만, 본문·password/DSN/rawstderr0.
3. 보관 후보는 `/home/daon/.local/share/anvil-v3-development/backups/schema-adoption-01/{before.dump,manifest.json}` 한 묶음, 새 부모/파일 daon0700/0600·nonlink/실경로·Git/웹/공유경로 노출0이다. 기존 접근권한을 넓히지 않는다. 접속은 기존 승인된 migrator 설정만 메모리 소비하는 별도 범위이며 인자/로그에 credential을 쓰지 않는다. 단순한0600은 암호화가 아니며 암호화·키가 추가로 필요하면 별도 정확 결정을 먼저 받는다.
4. 수명은 복원 검수+다음 안정 checkpoint까지 필수 보존, 이후 사용자 명시 삭제 전까지 보존/자동삭제OFF다. 실행 window·timeout은 최종 후보/측정 크기·공간/도구를 확인한 **새** 유한 계약에 고정한다. 현재 날짜만으로 자동삭제하거나 이전20분 창을 연장하지 않는다. 실패 partial은 민감 자료로 격리 표시·정확 목록 보존하고 자동 덮어쓰기/삭제하지 않는다.
5. backup 성공은 파일 존재/pg_restore 목록만으로 판정하지 않는다. 동일 PG15 image의 새 전용 무공개·분리 network/빈 DB에 실제 복원 후46 ID/checksum·객체 정의/권한 및 보존 데이터의 비밀 없는 count/hash를 대조해야 한다. 이 작업은 실제 자료를 다른 DB에 복사하므로 별도 정확 대상/이름·소유·격리·수명·회수 결정을 받는다. 현재 새 복원 자원 생성0이다. 복원 계정/ACL 가정이 틀리면 자동 superuser/권한 변경 없이 중단한다.
6. 정상 source/postcheck는 새53 및 기존46/대상외 데이터·객체/권한 불변을 대조하되,0012~0017/0031이 명시적으로 바꾸는 객체·권한은 별도 허용 diff로 구분해야 한다. 그 목록과 exact source/실행 창·보호 역할/backup 성공 영수증이 고정되기 전 정식 실행은 허용하지 않는다.
7. COMMIT 전 오류는 같은 TX rollback/신규 세션의 복원된46 확인이 필요하다. **COMMITUNKNOWN**(응답 유실/연결종료/기한만료)은 rollback 성공/미적용으로 보고하지 않고 상태불명으로 보존한다. 자동 SQL replay·down migration·restore-in-place·table DROP0, 별도 허가된 읽기로46/53·정확 전체 지문과 원 기록을 대조한 뒤 결정한다. COMMIT 후 실패도 파괴적 자동 복원이 아니라 검토된 forward repair 또는 사용자 승인 복원으로 분리한다.

## 다음 완료조건

### 최소 읽기 전용 사전 확인 — 도구/fs 및 DB metadata 각1회 종료

**migrator metadata 후속 실측:** 별도판정11:57:38~12:07:38Z/source95086727의고정READ ONLY/close후exit0에서DB18505063bytes·other/active/unknown접속각0·표81/nonowner0/SELECT불가0/RLS0을관측했다. 기존보호config는메모리소비/hash a78daab0…만출력했고본문/계정행/새manifest·backup·DDL0이다. 등록두경로정확회수/별도부재·PG보존/3830=0/5546=1확인. 정상보호파일/DB조회·close만의양성증거이며미래writer0·dump/복원성공·실행허가아니다. 상세는[실제결과](../04_test_reports/AV3/FN02/BACKUP_READINESS_METADATA_RESULT.md)로고정하고원실행당시2BBF774A계약은95086727에보존한다. 아래도구조회직후기록은당시이력이다.

**도구/공간 부분만 후속 실측:** 별도PMO판정11:46:07~11:56:07Z 안에서11:48:04.600026Z(20:48KST) 단1회 tools/filesystem 관측exit0. 기존PG에각1회짧은version프로세스2개만실행했고pg_dump/pg_restore모두15.18(Debian15.18-1.pgdg13+1). Node실파일hash7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c, /usr/bin/docker실파일hash7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b. 보호root UID1000/0700/realpath/nonlink·가용550560096256bytes,제안backup경로/복원container부재. 동일PG running/StartedAt11:21:54.792276193Z·정의개별필드일치/raw1eb. daemon/안전정의/두version/복원이름부재5단계모두exit0·retry0. DB접속/config/Env/본문/로그/폴더·backup·복원·DDL0이며공간관측은미래예약이나dump가능판정이아니다. 이는도구조회직후이력이며migrator의별도후속실측은위요약을따른다.

아래요청은각별도새판정/유한binding/플랫폼심사를거쳐1회씩종료했다. 실제dump/DDL승인이아니며이전또는소비된창을추가작업에재사용하지않는다.

- host/대상: WSL-server daon/기존동일PG fullID·daemon/image·volume/network/5546. 시작/중지/정의 변경0. `/usr/bin/docker --host unix:///var/run/docker.sock exec <fullID> /usr/bin/pg_dump --version` 및 pg_restore --version 각1회만(새 일회 프로세스/DB접속0). `/opt/node-v24.21.0-linux-x64/bin/node`와기존도구의실경로/파일hash만,보호 root의statvfs가용bytes/기존복원후보경로·container명부재만확인한다. Config.Env/로그/파일본문/새폴더 생성0.
- DB 사전 확인이 필요하면 도구 확인과 분리하여 기존 `/home/daon/.local/share/anvil-v3-development/migrator.json` 한 파일만 O_NOFOLLOW/owner1000/0600/nonlink/size 검증으로메모리소비하는 새 범위가 필요하다. 기존 anvil_v3_migrator/127.0.0.1:5546/DB anvil_v3_development만,대체role/config0·키/DSN/rawerror출력0. 이 보호파일/역할은 앞선 app-role 조회와 다른 범위다.
- 제안 SQL은 BEGIN READ ONLY/statement5초·lock1초·idle10초 안에서 (a)current_database/current_user/server_version_num/transaction_read_only/pg_roles의현재역할superuser·bypass·create권한boolean (b)pg_database_size(current_database()) (c)pg_stat_activity의현재DB connection수와현재세션제외active/정보불명 수,SQL본문·query문자열/사용자명출력0 (d)pg_class/pg_namespace의anvil·anvil_qa table개수·owner일치/has_table_privilege(current_user,oid,'SELECT')/relrowsecurity·relforcerowsecurity만 읽는다. 본문/계정행·통계rowcount·dump·migration재조회0. 목록은진단boolean/count만전송하며불명확하면실행자격을추정하지않는다.
- 고정SQL/caller는 `scripts/fn02-backup-readiness.ts`에존재하며위별도판정95086727에서1회만실행했다. LinuxUID1000/Node고정실경로/private Git clean·exactSHA·고정root·보호config/O_NOFOLLOW·각await전후10분상한·close5초/성공출력전종료검사를갖는다. 관측은dumpCapability UNVERIFIED/executionAllowed false이며서비스/backup/DDL runner등록0이다. close실패/만료/파일교체의실제음성은여전히미검증이다.
- 사용한Git `/home/daon/deploy/anvil-v3-fn02-readiness-01` 및cache `/tmp/anvil-v3-fn02-readiness-01/npm-cache`는daon0700/1회생성·사용후회수완료/현재잔여0이며재생성허가아니다. 실행제어가samePG/daemon/image·정의/포트를별도대조했고caller자체는Docker를시작하지않았다. 외부30초/connect5·query5/기한·retry0의읽기만소비했고DB쓰기/backup/restore0·기존거절미해소를유지한다.

### 복원 자원·실행 제한의 literal 후보 — 생성0

- 복원검수 container `anvil-v3-schema-restore-verify-pg-01`, image는동일PG15 digest6eb0add3…/image594290e9, `--network none`/publish0/추가bridge0/hostbind0/persistentvolume0, data는2GiB전용tmpfs다. 실제dump512MiB/원DB1GiB초과·가용공간이dump크기×3+2GiB미만이면이후실행0/자동확대0으로재판단한다. 임의큰운영DB를복제하지않는다.
- 일회admin `anvil_v3_restore_admin`과초기접속DB `anvil_v3_schema_restore_qa_01`은해당분리PG에만존재한다. 실제복원DB이름은원archive의 `anvil_v3_development`를**이분리PG안에서만**재생성한다(정식같은이름DB에는접속하지않음). 원소유권/ACL의복원을위해원source의anvil_v3_bootstrap/anvil_v3_migrator/anvil_v3_app 이름을**이분리PG에만 NOLOGIN**으로만들고회원/원password/key/실로그인·외부정책을복제하지않는다. 원dump의DB내용에는hash/세션이남을수있으나외부접속과API/Agent는없다. 원정식role/권한/Secret변경0. 복원PG만의역할생성도최종직접실행안에명시한다.
- 라벨 owner AV3_FN02_FORMAL_RESTORE_CANDIDATE/project v3·실행시새고정instance,PID/ID/image/소유·none-network/tmpfs/publish를생성전후확인한다. 준비후최대30분/복원최대10분/검수최대5분/회수2분후exactcontainer정상종료·등록전용tmpfs회수,남으면격리보존/보고·다른container/정식PG손대지않는다. host의backup은별도보존하여임시잔여0과혼동하지않는다.
- 실제검수는PG15 pg_restore `--create --exit-on-error --dbname=anvil_v3_schema_restore_qa_01`로원archive의DB명/DB자체ACL·설정/owner까지보존복원하는제안이다. 이미빈분리container에서만생성하며 `--clean`·원정식DB접속·no-owner/no-privileges0이다. 이복원은CREATE DATABASE를포함하므로single-transaction성공으로주장하지않으며실패partial은분리자원전체실패로기록/격리·회수한다. 복원후46 ID/checksum·pg_get_*객체정의/ACL/owner와각table의내용노출없는count/hash를원consistent snapshot과대조해야한다. 일회admin/초기접속DB등명시차이만분리한다. hash만들기에도본문을서버안에서읽으므로그범위는직접승인대상이다. 실제구동·복원가능성/정리PASS아직없다. 근거는[PostgreSQL15 pg_restore 공식문서](https://www.postgresql.org/docs/15/app-pgrestore.html)의create/owner/ACL계약이며source초안의DB다른이름/single-transaction안은검토중보정한것이다. 정식46→53migration한TX제안과분리PG전체복원의원자성은서로다르다.
- 향후정식반영은전체최대2시간의새단1회창(issued/expires는최종직접결정후literal발급),DB쓰기단계최대10분/lock5초/statement30초/COMMIT응답10초·만료/응답유실시UNKNOWN처리제안이다. 새창없음/원거절미해소면외부실행0. 차단을피하려명령을다른실행기에옮기지않는다. 단순길이초과를이유로자동연장하지않는다.

code-only planner의 source drift/관측 불일치·입력변조/명시모드 거절 음성 및 타입 검사, 독립 scoped 검토, 기존46 보존·복구의 남은 정확 결정/미검증 기록. 이것은 정식 반영이나 기능 완료의 완료조건을 대신하지 않는다. Main이 기존 승인 계획을 주도하며 PMO에는 이 실행 경계의 결정·지원만 요청한다.
