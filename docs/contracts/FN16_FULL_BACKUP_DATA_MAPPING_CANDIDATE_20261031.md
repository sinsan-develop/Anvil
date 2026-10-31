# FN16 전체 백업 자료·schema·producer 매핑 후보 — A1 확보 근거

- 작성일: 2026-10-31 / 담당: Primary 어울.
- 상태: **CANDIDATE / 제안 매핑 NOT_ADOPTED / A1 부분 조사 기록**. 전체 A1 완료나 A1~A6 구현 승인이 아니다.
- 읽기 기준: source HEAD `cc1fa2a6111f68c189c413f949e8312f4d4d2a5e`, 기존 작업 branch 유지. 제품·SQL·시험 실행 없이 원문을 대조했다.
- 이번 허용 변경은 이 문서 1개다. 실제 DB·권한·키·사용자 파일 조사·서비스·Agent·복원 실행 및 기존 프로젝트 차단 해제는 없다.
- Main 우선순위 조정에 따라 추가 전수조사를 중단하고 확보한 근거를 고정했다. 아래의 미확인 사항은 후속 A1 대조가 필요하다. 표의 제안 포함 범위는 새 공개 백업 형식이나 전체 coverage 발급 계약이 아니다.

## 1. 기준과 해석

| 기준 | 적용 범위 |
| --- | --- |
| `docs/design/Anvil_설계서_v3_초안.md:542` §10.4 및 §10.5 | 원문·버전·지식·대화·승인/실행 이력·첨부와 비밀을 제외한 연결 참조. 실제 목록/bytes/hash/제외 이유, 별도 키 이전, 복원 검증 선행. 격리/의심 자료 제한과 원본 hash 보존을 적용한다. |
| `docs/work_packages/FUNCTION_WORK.md:199` FN16 | 원본 반출·검증 복원 여정. 선택 파일 검사나 수동 정책 저장을 전체 FN16 완료로 바꾸지 않는다. |
| 수동 정책 r2 `docs/work_packages/FN16_MANUAL_POLICY_STORAGE_R2_DECISION_20261031.md` SHA256 `53D2ED423629B6402BAAD1D42AAC5998A6F57AA6A4B15A0BB500AC158883FA0E` | 후속 직접 승인 `00B3FC72B8B85FD1EACEB143C8DC42B4686561768FD8D214413F5B82DB693902` 및 WI `03094CEDBABAF1AD937CD0B42379F38117D5461729989EDE6C7A690BF8FF802F`로 저장/조회 구현됨. 원 후보의 NOT_ADOPTED 표기만으로 현재 미채택이라고 판정하지 않는다. 전체 공급·backup/job/복원은 별개다. |
| 범위 후보 `docs/work_packages/FN16_FULL_BACKUP_VERIFICATION_SCOPE_DECISION_20261031.md` SHA256 `A6776EE4A757F45DAE06534EC407B11DEEF2D625A1EC19517DFE9D6199A594F2` | A1 자료 매핑 → A2 동시 관측/실 bytes → A3 암호화 묶음/A4 검증 복원 → A5 수동 job → A6 검증 프로필. 전체 여정을 내부 include 투영으로 대체하지 않는다. |
| 실제 자료군 입력 `apps/server/modules/backups/backup-policy-input.ts:6` | `documents, conversations, knowledge, decisions, plans, results, artifacts` 7개. `:7,14`의 sourceSelection은 현재 정확히 `{kind:'NONE'}`다. |

표기: **S**는 저장소의 `.sql` 정의, **P**는 `.sql.pending` 정의다. 어느 표기도 실제 DB 적용 사실을 뜻하지 않는다. 실제 적용 이력/현재 데이터는 조사하지 않았다. pending은 이 작업에서 적용·실행하지 않는다. schema는 달리 적지 않으면 `anvil`이다. 경로 뒤 `:숫자`는 확보한 원문 줄 근거다.

**기본 등록**은 root composition에 selector가 있다는 뜻이다. 각 행/변형의 지원·원문 완전성·bytes 검증·복원 가능성을 보장하지 않는다. **선택 feature**, **독립 collector**, **미등록**, **행 변형 거절**, **정책 명시 제외**를 서로 구분한다.

## 2. 자료군7 제안 매핑 — NOT_ADOPTED

현재 root composition은 정책 include7을 입력받지 않는다. `project-inventory-composition.ts:70,102,148~150`은 이미 ref 충돌·중복·의존성·한도를 계산하지만, 이 자료군 분류나 암호화/복원 기능을 제공하지 않는다. 같은 자료가 여러 군의 근거가 될 수 있으므로 중복 bytes/원문 보존 규칙은 A2/A3에서 별도로 고정해야 한다.

| 정책 자료군 | 현재 연결할 수 있는 자료와 collector | 포함을 검토할 불변 역사·참조 | 민감/권한 제외와 비밀 없는 대체 | 실제 공백/다음 판단 |
| --- | --- | --- | --- | --- |
| documents | Document, ProjectMethodology, MethodologyApplication; Knowledge의 헌법 적용 관계와 구분 | 문서/양식/기준/방법론 버전·원문, 검토·확정·적용·source link·import/proposal 선택 및 artifact fullref | storage_key/절대 경로 대신 기존 artifact id/bytes/hash/mediaType. 공통 사용자 원문은 현재 수집된 정확 참조 범위만 | 전체 공통 자료 이력/최근 후보 원문까지 수집했다고 할 수 없음. 공통 자료 권한·원문 보존 범위 후속 대조 |
| conversations | Conversation | conversation/message 순서·원문·작성 사실·첨부 참조 | 계정/로그인/외부 Agent 비공개 세션 제외. 기존 비식별 주체 참조와 누락 사유 사용 | 공개 대화 기록과 실제 Agent 지시·실행은 다름. 미참조 첨부는 별도 공백 |
| knowledge | Knowledge | 지식 모든 버전/이벤트, 내용검토, 헌법 적용 이력/현재 pointer의 역사적 의미 | 원문 내 민감 자료는 기존 보호 기준 적용. 원문을 임의 마스킹한 뒤 기존 hash로 복원 가능하다고 하지 않음 | share request 표 미등록. 전체 사용자 공통 자료/감사는 별도 공백 |
| decisions | ApprovalHistory, DesignChange/Trace, Assignment, ResultReviewHistory, Baseline, Notification, ControlLedger 및 선택 feature의 결정 근거 | 승인만이 아니라 내용검토/확정, 설계 변경·영향 검토, 결과 판정/재작업, 기준선 채택, 별도 인계/정책 결정의 원문과 계보 | 현재 권한·소비 가능한 승인/제어·writer를 재발급하지 않음. 사실 ref/원문 hash/원결정 시각으로 보존 | approval/audit만 decisions 전체의 대체가 아님. 후보 원문·child 내용 이력·최근 정책/인계 기록의 등록 공백 존재 |
| plans | WorkPlan, Assignment, ResponsibleSession, ContextPreparation, StageBudget | 계획 모든 버전/카드/의존/검토/확정, 임무 원문·부모 fullref, 역할/세션/문맥·준비·한도/queue 관계 | Agent 계정·session credential·활성 제어/실행권한 제외. 보관 사실과 재연결 필요 참조만 | child 내용 이력 명시 거절. 승인된 prepare 변형과 일부 승인 scope decoder가 최신 producer와 불일치 |
| results | ResultSubmission, ResultReviewHistory, Observation, UnderstandingPermit, ExecutionControl | 제출 원문/기준/검토/재작업, 관측·수신·이해검토/permit·실행 명령의 과거 증빙 | WORKER_CLAIM을 서버 실측 권위로 바꾸지 않음. credential/재전송 가능한 challenge 제외, outbox를 자동 재개하지 않음 | 보고/중지·checkpoint·인계 기록 등 최근 표/별도 이력의 포함 범위 미등록 또는 후속 대조 |
| artifacts | 각 collector가 실제 참조하는 artifacts + 현재 bytes 검증기 | 정확 artifact ref, 원 bytes/해시/mediaType, 원문·결과·근거와 귀속 관계 | storage locator/절대 root/키는 제외. 격리/의심 상태를 지우거나 NO_KNOWN_MARKER를 비밀 부재로 승격하지 않음 | 모든 physical artifacts를 조회하지 않음. 미참조·실패/격리·checkpoint bytes/중복 보관 전체는 별도 매핑 필요 |

## 3. 기본 24 collector의 실제 selector·원DDL·producer

공통 접두사: collector는 `apps/server/modules/backups/`, producer는 `apps/server/modules/`다. 표의 열거는 해당 collector selector에서 확보한 범위이며, 전체 table의 모든 열/주체/프로젝트를 무조건 반출한다는 뜻이 아니다. 명령·receipt·audit 원문은 각 collector가 고른 operation/관계 범위다. 각 행의 민감 제외는 §5의 원문/hash 보존 원칙을 함께 적용한다.

| # / collector 근거 | 실제 table·DDL 근거 | producer·codec 접점 | 포함 역사/관계와 제외/대체·한계 |
| --- | --- | --- | --- |
| 1 Document `document-inventory.ts:19~35,54,201` | documents/document_versions/document_artifact_links/document_version_events (S `0003_project_documents.sql:1,8,25,31`), artifacts (S `0003_project_artifacts.sql:1`), import/selections (`0003_document_imports.sql:2,14`), proposal/selections (`0003_document_proposals.sql:1,13`), confirmation (`0003_document_confirmations.sql:2`), content_reviews (`0011_user_common_content_reviews.sql:1`), source links/events (`0032_document_source_links.sql:4,15`), standards/forms (`0003_documents.sql:2,10,25`), methodology表 | `documents/project-documents.ts:187,189`; imports `readApplicationSnapshot`, `readStageNodeRef`, `readDocumentSourceLinkHistory` (`document-inventory.ts:7~9`) | 원문/모든 버전/검토·확정/선택 관계. artifact selector는 storage_key 제외. 정확 ref와 hash 보존, 공통 자료 전체 아님. |
| 2 Conversation `conversation-inventory.ts:12,42,106` | conversations/messages S `0005_conversations.sql:1,7`, artifacts | `knowledge/conversations.ts:37,39`; `readConversationInput` (`:5`) | 원문·순서·첨부 참조. 외부 비공개 Agent 대화/계정 제외. CONVERSATION_HISTORY_ONLY, bytes 미검증. |
| 3 Knowledge `knowledge-inventory.ts:15,52,172` | entries/versions/events S `0005_knowledge_drafts.sql:1,8,21`; constitution_applications/project_constitutions S `0005_project_constitutions.sql:2,11`; content_reviews/artifacts/commands/receipt/audit | `knowledge/knowledge.ts:49,50,95`; knowledge-entry/state/reviews decoder (`:5~7`) | 지식 원문/변경·헌법 적용/검토. 비밀 검사 기준 추가 없음. share request와 전체 공통 자료는 미등록. |
| 4 WorkPlan `work-plan-inventory.ts:14,46,143` | plans/versions/tasks/dependencies S `0004_work_plan_drafts.sql:2,8,24,31`; confirmations S `0004_work_plan_confirmation.sql:2`; content_reviews/commands/audit | `traceability/work-plans.ts:71,73`; `analyzeWorkPlanCards/planText`, review decoder (`:5~6`) | 카드·의존·원문·검토/확정의 역사. 현재 승인/실행권한 복원 없음. execution evidence NOT_CONNECTED. |
| 5 DesignTrace `design-trace-inventory.ts:13` | design_items/screen_regions S `0004_design_index.sql:1,11`; trace_edges S `0004_trace_links.sql:1`; commands | `traceability/design-index.ts:53`, `traceability/traces.ts:56` | 설계 항목·화면 영역·trace fullref. 실제 소스 tree/파일을 포함한 것으로 해석하지 않음. |
| 6 DesignChange `design-change-inventory.ts:16` | changes/impacts S `0004_design_change_proposals.sql:2,10`; commands; 후속 sources/impact review 정의 | `traceability/design-changes.ts:58`; `readDesignChangeSources/readImpactReview` (`:6~7`) | 변경 이유·영향 판정과 원자료. 경로/외부 자료 민감 내용은 기존 보호. 해당 변경 근거가 전체 decisions는 아님. |
| 7 Baseline `baseline-inventory.ts:12` | activations/current/rechecks P `0050_design_baseline_activations.sql.pending:12,22,26`; commands | `traceability/baseline-activations.ts:60`; `readBaselineActivationRecord` (`:5`) | 채택·재검산/현재 pointer를 과거 사실로 보존. 활성화 권한 재발급 없음. draft/decision feature와 별개. |
| 8 ProjectMethodology `project-methodology-inventory.ts:15` | definitions/versions/reviews/project_methodologies S `0002_methodologies.sql:1,14,24,32`; content_reviews/commands/audit | project method review/application decoder (`:6,8`) | 정확 방법론 버전/검토·적용. 전체 사용자 공통 라이브러리/감사 포함 주장 없음. producer 전체 mutation별 열 대조는 후속. |
| 9 MethodologyApplication `methodology-application-inventory.ts:12` | project_methodologies/commands/audit | `readApplicationSnapshot` (`:5`); 기존 프로젝트 적용 producer 소비 | 적용 당시 snapshot/원명령. 공통 원문·최신 방법론으로 덮어쓰지 않음. 정확 producer의 상세 줄 대조는 후속. |
| 10 Notification `notification-inventory.ts:13,130~131` | notifications/reads P `0052_approval_in_app_notifications.sql.pending:3,17`; approval_requests/commands/receipt/audit | `notifications/approval-notification-producer.ts:33`; `readApprovalDetails/current consumableOperations` (`:5~6`) | 보관 알림·읽음과 원승인 요청 귀속. push subscription secret/실채널 제외. 후보 전체 payload 표를 읽지는 않음. 현재 operation decoder 사용과 후보 원문 지원을 혼동하지 않음. |
| 11 Assignment `assignment-inventory.ts:14,137~155` | drafts/versions S `0012_assignment_drafts.sql:2,9`; reviews/confirmed versions S `0013_assignment_confirmation.sql:2,10`; parent S0034·child content P0061; commands/receipt/audit | `assignments/project-assignment-drafts.ts:97`; confirmations `:172,180,184,200`; input/review/confirmation codec (`:5~6`) | child draft 관계 일부 지원, **child 내용 검토/확정 row는 현재 거절**(§7). 계정/현재 실행권한 제외. 같은 표 지원을 모든 row variant 지원으로 해석하지 않음. |
| 12 ResponsibleSession `responsible-session-inventory.ts:15` | roles/sessions/bindings S `0016_execution_preparation.sql:2,12,22`; assignment_versions/approval3/commands/receipt/audit | `assignments/responsible-sessions.ts:145,233,234`; role/binding/assignment/approval decoder (`:5~8`) | 담당 역할·세션/임무·승인 계보. Agent 계정/credential/활성 writer 복원 제외, 역사 ref만. |
| 13 ContextPreparation `context-preparation-inventory.ts:18,130,139,145,164,201` | bundles/items S `0014_context_preparation.sql:2,12`; preparations S `0016_execution_preparation.sql:186`; assignment/binding/approval3/commands/receipt/audit | `context/project-contexts.ts:34`, `executions/project-execution-preparations.ts:80`; context/preparation/approval codec (`:5~11`) | 문맥 선택·준비 원문/의존. 기존 downstream child root-only 차단은 유지 대상. 최신 승인 prepare 변형 검산 공백은 §7. 외부 root/credential 제외. |
| 14 ExecutionControl `execution-control-inventory.ts:18` | executions/grants/writer_claims/commands/reservations S `0017_execution_authority.sql:156,170,178,186,197`; revocations S `0022_execution_grant_revocation.sql:3`; delivery_outbox/commands/receipt/audit S0011 | `executions/execution-commands.ts:113`; server fact/queue/reservation/recovery/stop/revocation decoder (`:8~14`) | 명령·예약·회수·배달 사실을 보관. 실행 credential/active writer/재배달·권한 재개 제외. delivery_outbox 전체 전역 수집 아님. |
| 15 StageBudget `stage-budget-inventory.ts:17` | stage_runs/queue_requests S `0036_stage_queue.sql:2,9`; limit_policy_versions/reservations/grants/commands S0017; approval3/commands/receipt/audit | `scheduling/stage-queue.ts:72`; execution/queue/reservation/approval/runtime-policy decoder (`:8~13`) | 당시 한도 정책/queue·예약. 현재 잔여나 허가를 재계산한 전체 snapshot 아님. 현재 비용권한을 복원하지 않음. |
| 16 Observation `observation-inventory.ts:15` | observations/acknowledgements/results/receipts S `0018_execution_observation.sql:20,228,237,327`; grants/commands | `executions/execution-observation-store.ts:33`; fact/queued/instruction/stop decoder (`:8~13`) | 보관 수신·관측/결과, 실제 측정과 worker 주장 구분. token/challenge 재활성화 자료 제외. |
| 17 UnderstandingPermit `understanding-permit-inventory.ts:17,120,133` | understanding_reviews S `0019_understanding_reviews.sql:4`; start_permits S `0018_execution_observation.sql:369`; instruction_permits S `0024_execution_instruction_permits.sql:4`; commands/grants/reservations/receipts/감사 | `executions/execution-understanding-store.ts:31`; understanding history/실행 codec (`:8~15`) | 이해검토·permit 과거 원문과 귀속. 최신 승인 review command의 approvalRef 변형과 불일치(§7). permit을 새 실행 허가로 복원하지 않음. |
| 18 ResultSubmission `result-submission-inventory.ts:12,48,133` | submissions S `0025_result_submissions.sql:3`; commands/receipt/audit | `results/project-result-submissions.ts:39`; `readSubmittedResultRecord` (`:5`) | 원제출/근거 fullref. sourceKind WORKER_CLAIM, execution reference verification NOT_PERFORMED. 실측 권위/실행 성공으로 승격하지 않음. |
| 19 ResultReviewHistory `result-review-history-inventory.ts:14` | criteria/reviews/reworks S `0026_result_review_criteria.sql:3`, `0027_result_reviews.sql:3`, `0028_result_rework_drafts.sql:3`; submissions/commands/receipt/audit | `results/project-result-reviews.ts:52`, `project-result-reworks.ts:60`; source-scope/result decoder (`:6~7`) | 기준·판정·재작업 원문과 제출 관계. 승인/감사만으로 이 원문을 대체할 수 없음. 근거 bytes는 별도. |
| 20 PermissionPolicy `permission-policy-inventory.ts:11` | policies/versions S `0011_authorization.sql:1,6`; commands/receipt/audit | `access/project-command.ts:214`; source-scope decoder (`:7`) | 당시 정책/버전·근거. 보관 policy가 현재 유효 권한이라는 의미 없음. 복원 시 활성 권한 자동 적용 제외. |
| 21 ApprovalHistory `approval-history-inventory.ts:10,14,50` | requests/decisions/consumptions S `0011_authorization.sql:32,42,50`; commands/receipt/audit | `approvals/project-approvals.ts:90`; 자체 닫힌 snapshot/proof decoder | 정확 요청/결정/소비 계보. 새 후보 표 원문 전체 미수집, target-null/양수 generation 변형 공백(§7). 현재 승인 재사용 권위 없음. |
| 22 ProjectControlLedger `project-control-ledger-inventory.ts:10,55` | commands/authorization_receipts/audit_events S `0011_authorization.sql:17,58,71` | `access/project-command.ts`의 persistProjectReceipt 공통 저장 | 일반 operation 사실/receipt/감사와 비식별 주체. 각 operation의 원객체·후보·결과 payload/관계까지 자동 수집하지 않음. 인증 Secret/현재 제어권 제외. |
| 23 ConnectionCandidate `connection-candidate-inventory.ts:11` | candidates/versions S `0006_connection_candidates.sql:2,9`; commands/receipt/audit | `connections/candidate-input.ts`의 input/readiness/capability decoder (`:7` import) | 연결/환경 후보 원문과 변경 이력. 실제 connectors/등록/credential/전역 source root 설정 전체는 아님. safe 후보 ref만, Secret/접속 수행 없음. |
| 24 ProjectCreationDraft `project-creation-draft-inventory.ts:11` | project_drafts S `0001_projects_access.sql:64`; selection versions/selections/creation/upload intents/adoptions P `0042_draft_artifact_storage.sql.pending:8,19,26,33,55`; artifacts/commands/receipt/draft_audit/audit | `projects/draft-artifacts.ts`, `draft-artifact-files.ts`, `repository.ts`; `contracts/draft-artifacts` codec (`:7` import) | 현재 보호된 자기 초안/선택/귀속 일부. 생성 내부 PROJECT command와 원 upload command를 구별. 모든 소유자의 미완료 초안/실패 staging/개인 quota를 완전 수집하지 않음. |

## 4. 기본 외 선택 feature·독립 collector

| 접점 | 현재 실제 범위·관계 | 제외/남은 범위 |
| --- | --- | --- |
| `project-inventory-composition.ts:117` ControlHandoffOwnHistory | 명시 `controlHandoffHistorySource` + `control-handoff/control-handoff-pg.ts`의 내부 source binding 필요. `control-handoff-history-inventory.ts:8`은 P0041의 requests/summaries/commands/receipts/audits (`0041_control_handoff_source.sql.pending:61,86,109,141,146`) | 기본 24에 자동 포함되지 않음. own/protected 역사이고 현재 controller 변경·수락/인계 실행을 발급하지 않음. raw credential/제어 복구 제외. |
| `source-root-history-inventory.ts:12`; composition 선택 문맥 | source_roots/versions + 명령 증빙, S `0008_source_root_registry.sql:2,9`. producer `connections/project-source-roots.ts:37` | sourceRootHistory 명시 활성 시 제한 역사. 실제 root bytes/현 OS 접근·source grant/credential/원본 설정 전체 지원 아님. 절대 path는 그대로 portable root가 아님. |
| `project-inventory-composition.ts:141~145` FeatureBaselineDraftHistory/DecisionHistory | `projects/project-baselines.ts:325,436`의 draft/decision inventory. S `0015_project_baselines.sql:2,9,19,49`; head/version·검토·채택 관계, 공유 read budget | CURRENT_SOURCE_METADATA_ONLY·MATCHED_METADATA/CHANGED/UNAVAILABLE 관측. 실제 bytes/원본 전체 검증 또는 atomic snapshot 아님. 기본 notCollected 문구를 삭제할 근거가 아님. |
| `backup-reference-history-inventory.ts:11,30` | P `0053_backup_references.sql.pending:4,11,24`의 references/versions/events와 명령/승인 증빙; 기존 runtime backup-reference decoder | 독립 collector는 존재하나 root 24의 호출로 연결되어 있지 않음. 실 키/비밀 root는 제외, 보호 ref/hash/버전만. 구현 부재와 root 미등록을 구분한다. |

## 5. 민감열·원문·권한 복원 금지

1. **계정/Secret 자체 비반출:** S `0001_projects_access.sql:1~53`의 users/clients 계정 상세, password_credentials.argon2_phc, auth_sessions의 token_digest/csrf_digest, installation/recovery/invitation secret, auth attempt/action의 인증 식별 자료는 전체 자료군에 자동 편입하지 않는다. 과거 사실의 기존 비식별 주체 ref와 재연결 필요 사유만 후보로 남긴다. 사용자 UUID가 있다고 계정 복원을 허용하지 않는다.
2. **연결/실행 credential 비반출:** connectors/registrations/challenges/credentials, source_read_grants/challenges/credentials/snapshots, execution_credentials/challenges는 모든 열을 문서 원문처럼 내보낼 수 없다. 실제 credential/token/code/protected signature 및 재활성화 자료는 제외한다. 정확 민감열별 대체 DTO는 후속 A1/A2 대조 대상이며 여기서 새 형식을 정하지 않는다.
3. **키 자체 비반출:** P0054의 installation_resource_intents/key_wrappings/key_states/root_roles는 key 가용성/등록 역사와 실제 key bytes를 구별한다. 실제 키 또는 key 이전에 필요한 보호 묶음을 일반 backup 본문에 포함하지 않는다. 기존 안전한 key/ref/version/hash와 별도 보호 이전 참조만 검토한다. 키 metadata가 있다는 이유로 key 가용/전체 coverage 성공을 발급하지 않는다.
4. **locator와 bytes 구분:** artifacts.storage_key, 절대 root/path/device/handle은 원본문이 아니며 portable 경로 권위도 아니다. 기존 ArtifactRef의 project/id/bytes/hash/mediaType과 허용된 provenance를 사용한다. 미참조/소실/격리/해시 불일치는 0bytes로 추정하지 않는다.
5. **원문 변경과 hash:** 원본을 임의 마스킹하고 원 contentHash로 복원 가능하다고 할 수 없다. 기존 §10.5대로 대체 원문은 새 식별/hash/계보와 별도 결정이 필요하다. 원문 비반출이면 제외 이유/원참조를 남기되 필수 원문 공백이 사라지는 것은 아니다. known-pattern 검사에서 NO_KNOWN_MARKER여도 detector의 complete=false 한계가 남는다.
6. **역사와 현재 권한:** project_members/control, role/session/binding, grants/writer_claims/permits, approval/consumption, policies, quota VERIFIED/예약, outbox는 과거 사실/관계로 읽을 수 있더라도 현재 실행·제어·승인·writer·재전송·초기화 권한으로 복원하지 않는다. 복원 후 재연결/재승인/검증 경계는 A4에서 고정해야 한다.

## 6. 현재 있지만 root collector에 직접 등록되지 않은 자료

아래는 확보한 selector와 실제 DDL/producer의 차이다. generic commands/audit에 operation 문자열이 남는 것과 해당 표의 원문·모든 버전·관계가 수집되는 것은 다르다. 새 자료군 배치는 모두 NOT_ADOPTED다.

| 현재 자료·정의 | 실제 producer 근거 | 보존 검토 대상·민감 제외·현재 공백 |
| --- | --- | --- |
| HUMAN capability_reports/evidence P `0057_capability_reports_human_claim.sql.pending:2,19` | `connections/project-capability-reports.ts:74` | connection/environment fullpair·claim/snapshot·supersedes·evidence artifact refs. HUMAN 주장을 실측 capability로 승격하지 않음. 원문/근거별 실제 bytes와 격리 상태 별도. |
| checkpoint_records P `0058_checkpoint_records.sql.pending:3,17` | `checkpoints/project-checkpoints.ts:94` | assignment fullref·previous chain/single successor·snapshot/preparedHash/contentHash·record_text·공유 audit 순번. 복원 writer 권한 없음. root 참조/bytes 폐쇄에 포함되지 않음. |
| project_storage_accounts/reservations P `0059_project_storage_quota.sql.pending:3,16` | `projects/project-storage-quota.ts`, protected quota 함수 | coverage/fencing generation·원명령/part/phase·원 receipt·정산 계보. 복원 시 VERIFIED나 RESERVED/IO_STARTED/UNKNOWN을 새 실행 가능 상태로 자동 발급하지 않음. 현재 physical usage 조사 없음. |
| transfer_preparation_records/versions P `0060_transfer_preparation_records.sql.pending:3,8` | `transfers/preparation-record-store.ts:41` | creator/read 권한과 source-only/inprocess snapshot/history. 인계 manifest/수락/제어 전환 완료 아님. root 미등록. |
| execution_material_manifests/materials/proof_bindings P `0062_execution_material_registration.sql.pending:2,11,22` | `executions/execution-material-registration-store.ts:39` | 정확 SEND 원 internal created_command_id·grant 전버전·manifest/part/receipt 관계. 현재 SYNTHETIC_REFERENCE_ONLY_V1, 원문/USER_INSTRUCTION 실전송 권위 아님. source/credential Secret 제외. |
| backup_policies/versions/candidates P `0063_backup_policies.sql.pending:4,9,21` | `backups/backup-policy-store.ts:44`; `approvals/backup-policy-approval-candidate.ts:30` | include7·MANUAL·NONE·정확 보호 ref4·previous·원승인/소비·head/version 역사. root 미등록. 실제 키/자료/coverage 공급 발급 없음. |
| 별도 원승인 후보 표 | `approvals/work-plan-approval-candidate.ts:44`, `design-activation-approval-candidate.ts:22`, `execution-preparation-approval-candidate.ts:29`, `understanding-review-approval-candidate.ts:25` | S0035 work_plan_approval_candidates / P0050 design_activation_approval_candidates / P0055 execution_preparation_approval_candidates / P0056 understanding_review_approval_candidates. 정확 candidate 원문/원 request hash와 최종 command/소비의 관계. ApprovalHistory가 후보 표 전체를 보관하지 않음. |
| knowledge_share_requests P `0051_knowledge_share_requests.sql.pending:3` | `knowledge/project-knowledge-share-requests.ts:86` | 공유 요청 원문/상태·정확 version/결정 관계. 공유 권한을 복원하지 않음. 기본 Knowledge selector에 없음. |
| project_artifact_exports P `0043_project_artifact_exports.sql.pending:26` | 기존 선택 원문 export 경로 | 선택 결과/manifest·원 artifact hash/소비 관계. 전체 backup 아님. root 미등록; producer 상세 열/역사 대조 후속. |
| backup_references/versions/events 및 installation resources P0053/P0054 | `backups/installation-resource-store.ts:215,216,235,236,295` 및 독립 reference history collector | 보호 root/검증/retention/key 참조의 역사. root24 미등록. key/raw root 비반출. 선택파일 프로필 공급은 이미 구현되어 재개발 대상 아님. |
| provider_session_claims/proofs/revocations P0037; execution_ownership 이력5표 P0039; source_content policy/requests/observations/verifications P0040 | 현재 claim/ownership/source-content 모듈 | 현 등록/selector 포함 여부 전체는 후속 대조. source 보관과 실 Agent·source 권한 활성화 구분. Secret·현재 authority는 제외. |
| 실제 connector/source 등록과 credential S0006/S0008 | `connections/project-registrations.ts:36,37`, `registration-protocol.ts:103`, `project-source-read-grants.ts:72`, `source-read-protocol.ts:137,191` | ConnectionCandidate와 SourceRootHistory만으로 전체 등록/검증 이력·실 root bytes를 대체할 수 없음. 민감열 대체는 §5/후속 대조. |
| 미참조 artifacts·실패/격리/미확정 보관·staging/중복; draft quota/intents/events P0042 | `projects/draft-artifacts.ts`, `draft-artifact-files.ts`, `repository.ts` | 현재 refs 기반 artifact 검증은 모든 physical 보관소 전수 수집이 아님. 원가입/copy/adoption·원upload와 생성 command 구분. 실제 OS/사용량 조사나 누락 0 추정 없음. |
| current 권한 자료/전역 공통 자료·project_events 등 | S0001 access, S0011 authorization/user_common_control 및 실제 각 producer | 역사 fact/비식별 주체 ref와 활성 계정/권한을 분리해야 함. ProjectControlLedger/부분 outbox 지원을 전역 전체로 승격하지 않음. 정확 전체 열/관계 매핑 미완. |

## 7. 같은 표여도 최신 row variant가 지원되지 않는 실제 경계

### 7.1 child HUMAN 내용 이력 — 확인된 직접 불일치

- 실제 producer `assignments/project-assignment-confirmations.ts:172~200`의 `reviewContent()`/`confirmContent()`는 child에 대해 `assignment_content_reviews`와 `assignment_versions`에 저장한다. review snapshot은 기존 review 형식(`reviewedBy/reviewedAt/independence:'NOT_CLAIMED'`), confirmation은 draftRef/definition/reviewRefs/reason/confirmedBy/confirmedAt/contentConfirmed/readinessIssues 및 **ready/executionAuthorized/dispatchPerformed=false**를 보존한다.
- 현재 `backups/assignment-inventory.ts:137~146`은 해당 snapshot의 일반 형식 검산과 별개로 `definition.parentAssignmentRef!==null`이면 거절한다. `:25` 기본 오류는 **ASSIGNMENT_INVENTORY_INTEGRITY_FAILED /503**이다. `:155`의 parent draft 관계 일부 지원은 child review/confirmation 지원의 증거가 아니다.
- 따라서 같은 표를 selector에 넣었다는 이유로 child 원문 전체를 수집했다고 할 수 없다. 현재 정상 child 내용 이력이 있는 자료에서 이 분기에 도달하면 composition이 성공한 부분 출력으로 자동 우회하는 것이 아니라 거절될 수 있다. 이는 원문 코드 조건의 정적 대조 결과이며 이번 문서 작업에서 실제 데이터/시험을 실행한 결과는 아니다.
- 기존 pure input/confirmation codec을 재사용할 수 있지만, child historical read는 exact parent fullref·당시 근거·원명령/receipt/audit·순번 검산이 필요하다. 부모 현재성 변화를 과거 무결성 손상으로 오인하거나 root execution reader를 풀어서는 안 된다.
- **최소 내부 수정 후보:** `apps/server/modules/backups/assignment-inventory.ts`와 관련 원문/선언 대조 및 집중 메모리 시험. 실제 허용 3경로는 별도 WI로 Main이 고정한다. 기존 `confirmations.read()` root-only와 downstream 차단, 공개 DTO·새 operation/권한·SQL 변경을 전제로 하지 않는다.
- 현재 출력의 `PROJECT_ASSIGNMENT_HISTORY_ONLY` 명칭과 child draft 지원은 내부 수집 누락 가능성의 근거다. 반면 명시 non-null 거절이 존재하므로 원래 inventory 계약의 root-only 제한 여부를 최종 WI에서 대조해야 한다. 이 문서만으로 공개 출력 의미 확대를 승인하지 않는다. child payload를 새 authority로 변환하거나 기존 hash 형식을 바꾸지 않는 지원인지 구분한다.

### 7.2 추가로 관측한 행 변형 차이 — 후속 범위

| 원문 접점 | 실제 차이·출력 영향 | 보존할 경계 |
| --- | --- | --- |
| `context-preparation-inventory.ts:130,139,145,201` | approval 근거 helper의 허용 operation이 buildTaskContext이고, prepareExecution 검산은 approvalRef=null 경로를 소비한다. 최신 일회 승인 prepare 원문/소비 행과 충돌할 수 있다. 기본 오류 CONTEXT_PREPARATION_INVENTORY_INTEGRITY_FAILED503 | 기존 AUTO/root 정상과 child downstream 금지는 유지. 승인 candidate 전체 원문 누락도 별도 문제이며 단순 null 제거로 해결하지 않음. |
| `understanding-permit-inventory.ts:120,133` | reviewUnderstanding 원명령을 approvalRef:null로 재구성하는 기존 경로. 최신 approved review 원명령과 정확 hash가 달라질 수 있음 | 현재 auth/과거 원승인·소비 fullref/원command 검산 보존. 이번 실제 실행 없음. |
| `approval-history-inventory.ts:50` | targetRef=null이면 expectedVersion=0을 요구한다. reviewUnderstanding의 target=null/양수 generation 특별 scope와 불일치 | APPPROVAL_HISTORY 전체 정상으로 승격하지 않음. 기본 오류는 `:14` APPROVAL_HISTORY_INVENTORY_INTEGRITY_FAILED503. 다른 operation 기준을 넓히지 않음. |

위 3개를 묶어 수정하거나 지금 source 검사를 실행하지 않는다. child 한정 단위가 먼저이며 나머지는 독립 선행/계약 대조 대상이다.

## 8. 기존 notCollected9를 유지한 해석

정확 상수는 `project-inventory-composition.ts:63`이다. 일부 feature가 생겨도 문자열을 제거하거나 whole pass로 바꾸지 않는다.

| 정확 값 | 현재 사실에 따른 분류 |
| --- | --- |
| UNRECORDED_APPROVAL_TRANSITIONS | 기록되지 않은 전이를 복원/추론할 수 없음. 원요청/결정/소비 일부 지원과 별개인 필수 공백. |
| WHOLE_USER_COMMON_MATERIAL_AND_AUDIT | 참조된 양식/방법론/기준 일부는 수집하지만 사용자 공통 전체 원문/감사 미지원. |
| CONNECTION_REGISTRATION_SOURCE_ROOT_SETTINGS | 후보/선택 source-root 역사는 부분 지원. 실제 등록·credential·설정 전체와 OS bytes는 아님. 민감 자료 제외도 별도. |
| PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS | 자기 초안 첨부 일부·선택 인계/기준선 feature 지원. 전체 소유자·모든 원문·실 bytes의 완전 지원 아님. |
| KNOWLEDGE_SHARE_REQUESTS | 기본 Knowledge selector에 별도 공유 요청 없음. |
| EXPORT_BACKUP_PROTECTED_REFERENCE_HISTORY | 독립 reference history collector 존재, root24 미등록. 선택 export와 전체 backup 이력 구분. |
| UNREFERENCED_RESULT_ATTACHMENTS_CHECKPOINT_BYTES | 참조된 artifact 검증과 별개. 미참조/결과 근거/checkpoint 원문·bytes의 폐쇄 미완. |
| SOURCE_AND_UNCOMMITTED_FILES | 현재 정책 sourceSelection NONE에 따라 source 본문은 명시 제외. 이 제외를 다른 8개 공백 해소로 쓰지 않음. 향후 포함 선택/실 OS 수집은 별도 계약. |
| BLOB_VERIFICATION_ENCRYPTED_ARCHIVE_RESTORE | 별도 현재 artifact bytes 검증은 존재하나 composition 기본 blobVerification NOT_PERFORMED. 전체 암호화 묶음/DB restore/관계 비교 지원 아님. |

## 9. 재사용 가능한 실제 검산과 아직 없는 전체 여정

| 기존 접점 | 실제 보장 범위 | 전체 검증과의 차이 |
| --- | --- | --- |
| `project-inventory-composition.ts:102~103,128,148~151` | exact ref/scope 충돌, artifact metadata 충돌/중복, 기존 의존성 상태 EXACT_REFERENCE_PRESENT/COLLECTED_REFERENCE_ABSENT/NOT_COLLECTED/EXTERNAL_UNSUPPORTED, 한도 및 compositionHash | child 결과 전체가 아닌 resultDigest/originalHash/rowCounts/관측/issue 요약이 최종 출력에 들어간다. **digest만으로 전체 원문을 복원할 수 없다.** atomicSnapshotVerified/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed는 false다. |
| `artifact-current-verification.ts:138,143,182,186,281,300~340` | 기존 보호 관측/같은 세션·owner 재검사, composition ARTIFACT ref에 대한 현재 metadata·원 bytes 검산. root/feature read budget도 존재 | 모든 physical blob/DB와 같은 시각의 snapshot 증명 아님. 실제 실행하지 않았으며 미참조 자료는 별도. 이 알고리즘을 새 wrapper로 재개발하지 않는다. |
| `artifact-byte-verification.ts:5~12,35` | SUPPLIED_ARTIFACT_BYTES_ONLY, bytes/hash 일치, known-pattern marker 검사 및 handle.close 경계 | authorityVerified/sourceStabilityVerified/restorable=false. 실제 파일 권위/완전 비밀 부재/전체 artifact 집합 증명 아님. |
| `document-inventory-input.ts:4,26` | metadataBytes/inputBytes/fileCount/deadlineMs의 닫힌 입력/안전 정수 검산 | 인증/실 IO/whole coverage 제공 아님. |
| `file-manifest-input.ts`, `file-manifest.ts:58,134` | 선택 상대 경로/versionRef/required/ignored/포함·제외 이유/classification, 독립 baseline/hash의 실제 선택파일 manifest 비교 | DB table/행/관계 전체 manifest가 아님. 기존 선택파일 공급 재개발 대상 아님. |
| `file-bundle.ts:24`, `file-restore-validation.ts:27` | 기존 선택파일 복사·plain manifest와 fresh 검증 폴더 비교 | 전체 DB schema/data 복원, 정책 그룹7 폐쇄, 암호화 bundle 형식/키 가용성/현재 권한 복원 지원 아님. |
| `portable-key-envelope.ts:19,41,50` | 기존 key envelope crypto/wrap/unwrap 인터페이스 | key envelope가 전체 자료 암호화 bundle은 아니다. actual key 이전/가용성 확인이나 A3/A4 완료를 의미하지 않는다. |
| `project-backups-input.ts:7,10,17` | SELECTED_DOCUMENT_ARTIFACT_EXPORT, 한 document/artifact, includeSource=false | PROJECT_DB_SNAPSHOT/PROJECT_SOURCE/OTHER_PROJECT_MATERIALS/EXECUTION_STATE_RESTORE는 명시 누락. 전체 createBackup/job/restore와 다르다. |
| `backup-policy-input.ts:7~9,14`; 실제 policy store/approval/UI | 수동 정책 저장·조회·원명령/승인·보호 참조, include7/NONE 선언 | 선언이 전체 profile 발급 근거는 아니다. SELECTED_FILES와 기본 공급 부재412 유지. 태그/성공 callback 주입으로 전체 coverage를 만들 수 없다. |

## 10. 남은 A1 대조와 A2~A6 선행

이 문서 이후 필요한 판단은 전체 scope 발급이 아니라 **원문 손실 없이 무엇을 수집할지 고정하는 일**이다.

- 각 table의 실제 모든 열·변경 형태·삭제/immutable/완결 trigger와 원 codec의 상세 교차표는 아직 완성하지 않았다. 특히 connector/source/execution credential의 제외 열, 공통 자료 주체 범위, 계정 비반출 시 역사 FK 참조 처리, current 권한 row의 비권위 관측 형식을 후속 대조해야 한다.
- 최근 표/후보/child 변형/미참조 artifact를 어떤 자료군에 귀속할지, 필수 원문과 명시 제외를 어떻게 구분할지는 위 NOT_ADOPTED 매핑의 채택 대상이다. 기존 공통 decoder/비밀 검사 기준/공개 DTO를 임의 수정하지 않는다.
- 확보한 DDL 파일은 S/P 상태로만 기록했다. migration loader의 전체 포함/배포·적용 순서, 현재 실제 DB schema/row 존재·count·bytes·owner는 미확인이다. source 존재를 현재 보관 성공으로 승격하지 않는다.
- A2는 실제 DB 같은 관측/참조 폐쇄와 artifact 보호 원 bytes·최종 재관측·deadline·실한도/실패·UNKNOWN을 결합해야 한다. DB snapshot만으로 FS 원자성을 주장하지 않는다. 누락 자료나 미지원 collector는 실제 gap으로 남긴다.
- A3는 암호화 묶음의 version/header/AAD/manifest/canonical bytes/hash·nonce·실패 잔여·별도 키 이전 경계를 정해야 한다. 이번 문서는 새 암호화 형식을 채택하지 않는다.
- A4는 fresh 복원 공간에서 실제 schema/data/versions/관계/원문/artifact bytes/manifest를 비교해야 한다. 활성 권한/계정/Agent/writer/outbox/승인/quota를 재활성화하지 않는다. 실제 key 가용성이 확인되지 않으면 성공할 수 없다.
- A5 job/UI 여정은 접수·저장·진행·완료·실패·UNKNOWN 및 exact replay/승인 소비와 실제 결과를 구별해야 한다. A6 전체 검증 프로필은 A1~A4의 실제 근거 뒤에만 검토한다. 현재 기본412를 제거하지 않는다.

## 11. 이번 산출물의 검증 범위와 반환

- 실행한 것은 기존 source/doc의 파일 목록·Leaf·UTF-8 원문/줄·해시 읽기다. 제품 함수·합성 시험·브라우저·실 SQL/DB·artifact 실제 bytes·키/계정·backup/job/복원은 실행하지 않았다.
- 확인된 사실: 기본24 등록과 선택 feature/독립 collector의 차이, policy include7, notCollected9, 최근 표의 등록 공백, child HUMAN row의 직접 거절 조건, 그 밖의 최신 approval 변형 조건 차이.
- 미확인: 전체 column/trigger/codec 관계 전수 교차·actual DB 상태·실사용량·FS 원자성·암호화/복원 여정. 이 문서는 A1 부분 근거이지 전체 A1 완료/인수 증거가 아니다.
- 추가 제품/SQL/시험/공개 계약 변경은 별도 WI/GO 대상이다. 기존 conflict/dependency·선택파일·key-envelope 알고리즘 재개발이나 false 반환 wrapper 증설을 완료 단위로 삼지 않는다.
