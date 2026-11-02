# FN16 전체 수동 백업·검증 복원 통합 계약 후보 r2

2026-11-02 / 작성: 기존 Reviewer 어울 / Main 상세화 요청에 따른 문서 작성
상태: DRAFT_REVIEW / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0
소유 범위: 이 신규 문서 한 개의 정본/source 동일 바이트 작성만. 기존 코드·시험·문서·SQL·Git 변경과 실제 자료/DB/키/파일/서비스/Agent/백업·복원 실행은 없다.

## 1. 목적·현재 판정·문서의 사용법

사용자는 UI14에서 정확한 프로젝트와 수동 정책을 선택하고, 포함/제외와 복구 조건을 확인한 뒤 별도 명시 생성한다. 생성된 암호화 묶음과 이식 가능한 키의 관계를 보존하고, 외부 Agent 로그인 없이 새 검증 대상에서 원문·버전·참조·바이트를 검증한다. 검증 성공과 현재 프로젝트 적용·권한 재발급·작업 재개는 서로 다른 일이다.

상위 범위 결정안의 47행은 Main의 A1~A6 상세화 진행과 PMO 결정 지원을 명시한다. 이 문서는 그 상세화 산출물이지 A안의 채택이나 제품 구현 허가가 아니다. 기존 수동 정책 r2·보호 참조·설치 자원·선택파일 검증의 승인은 보존한다. 이 문서에서 새로 정한 이름/수치/형식은 모두 제안이며 기존 P02 확정값이라고 주장하지 않는다.

판정 요약:
- 전체 사용자 여정과 공개/저장 delta의 검토는 가능하다.
- A1의 실제 표/codec 전수 폐쇄, 새로운 자료 암호화 사용 포트와 동일 실키 nonce 도메인, 복원 역사주체 저장 원형은 아직 구현 WI에 넣을 만큼 확정되지 않았다.
- 따라서 전체 source 구현 GO를 즉시 발행할 준비는 아니다. §15의 선택과 차단 항목을 해소한 정확 개정/allowlist가 필요하다.
- 실제 키·파일·PG·보호 공급자·사용자 복구 여정은 어떤 source 채택에서도 자동 승인되지 않는다.

## 2. 대조 근거와 보존할 기존 계약

| 구분 | 실제 경로·지문 또는 확인 범위 | 재사용·보존 조건 |
|---|---|---|
| 상세화 범위 A1~A6 | docs/work_packages/FN16_FULL_BACKUP_VERIFICATION_SCOPE_DECISION_20261031.md / A6776EE4A757F45DAE06534EC407B11DEEF2D625A1EC19517DFE9D6199A594F2 | 전체 선택 범위 검산, sourceSelection NONE, A6 선연결 금지 |
| A1 부분 조사 | docs/contracts/FN16_FULL_BACKUP_DATA_MAPPING_CANDIDATE_20261031.md / 7152EEB89567C78AC7EA417DF01B0E4B0A1172AB15604A518F1D69F11B919988 | 과거 source 기준의 부분 매핑이다. 현재 전체 registry가 아님 |
| A2 후보 | docs/contracts/FN16_FULL_BACKUP_SNAPSHOT_CONTRACT_CANDIDATE_20261031.md / 2407841F04013EF9FED30C8D0CDAF56711D19F40A7717F6C66350C98CC93A291 | 동일 RR client와 최신 허가 경계를 분리하는 제안을 계승 |
| A3/A4 후보 | docs/contracts/FN16_ENCRYPTED_BUNDLE_RESTORE_FORMAT_CANDIDATE_20261031.md / D7432ADC139B1453520050494E0B40A7BC3322E5E8A3E8F44379982937B73BBA | 단일 GCM 메시지·인증 전 미채택·키/nonce 미정 보존 |
| 키 이식 후보 이력 | docs/contracts/FN16_INSTALLATION_RESOURCE_PORTABLE_KEY_CANDIDATE.md / 5A6819E626F2FF4104862988C07230A00676D07F06A25658BC9344746335D053 | 문서의 옛 NOT_ADOPTED 머리글을 현재 구현 승인보다 우선하지 않음. 원형은 아래 실제 source로 대조 |
| 역사 주체 후보 | docs/contracts/FN16_RESTORE_HISTORICAL_IDENTITY_CANDIDATE_20261031.md | 원 UUID/hash를 현재 계정으로 치환하지 않는 제안. 아직 새 저장 원형 채택 근거는 아님 |
| 정책 | apps/server/modules/backups/backup-policy-input.ts, backup-policy-store.ts | include 정확7+sourceSelection NONE, MANUAL, 네 보호 fullref, 이전 버전/CAS·원승인·replay 유지 |
| 보호 참조 | contracts/runtime/backup-references-v1.ts, apps/server/modules/backups/backup-reference-store.ts, backup-resource-provider.ts | TARGET/ENCRYPTION_KEY/RETENTION/VERIFICATION 의미와 기존 reasonCodes 유지 |
| 키 envelope | contracts/runtime/backup-installation-resources-v1.ts, apps/server/modules/backups/portable-key-envelope.ts | ANVIL_PORTABLE_KEY_V1·scrypt N131072/r8/p1/dkLen32·AES-256-GCM/tag16·32byte DEK wrapping을 변경하지 않음 |
| 키 lease | apps/server/modules/backups/installation-resource-store.ts | 본인 project/actor/client/session/control·정확 ref/generation·최대5분/재시작 LOCKED·감소 우선 relock 유지. 현재 registry는 raw 키 사용 API를 제공하지 않음 |
| 전체 관측 | apps/server/modules/backups/project-inventory-composition.ts | 24 collector의 독립 RC 관측·atomicSnapshotVerified=false·fullProjectCoverage=false·restorable=false를 보존 |
| 검증 profile | contracts/runtime/backup-verification-profiles-v1.ts, apps/server/modules/backups/backup-verification-profiles.ts | 기존 scope SELECTED_FILES_V1와 세 FILE_* check를 전체 백업으로 바꾸지 않음 |
| 용량 | apps/server/modules/projects/project-storage-quota.ts, db/migrations/0059_project_storage_quota.sql.pending | QuotaPart kind ARTIFACT/CHECKPOINT 전용. upload/diff 2B·checkpoint C·원command/part/fence/독립 예약 및 시작 COMMIT 의미 보존 |
| 화면·기존 반출 | apps/web/src/features/backups/BackupPolicyPanel.tsx, BackupReferencePanel.tsx, InstallationResourcePanel.tsx, ProjectBackupsPanel.tsx | 기존 선택파일/반출·정책·키 화면을 삭제/전체 백업으로 개명하지 않음 |

위 자료는 source 읽기 근거다. SQL 적용 상태·실제 보안/내구성·복원 성공을 증명하지 않는다. 이 문서가 기존 후보의 미채택 선택을 몰래 채택하지 않는다.

## 3. 닫힌 공통 원형·식별·hash

모든 신규 JSON은 정상 UTF-8/Unicode·중복 키 없음·exact own data keys·알 수 없는 필드 거절이다. public command body는 최대2MiB. 정수는 안전정수, 바이트 집계는 내부 bigint 및 공개 canonical 10진 문자열(0 또는 선행0 없는 양수)이다. ISO 시각은 UTC 밀리초 정규형이다.

Ref = 정확 {id:UUID,version:양의안전정수,contentHash:소문자SHA256hex64}.
TypedRef = 정확 {namespace,projectId:UUID,ref:Ref}; namespace는 registry에 등록된 닫힌 값이다. 기존 Conversation MessageRef는 {conversationId,id,contentHash} 원형을 별도 record codec으로 유지한다. ARTIFACT의 기존 raw bytes hash·bytes·mediaType 원형을 generic snapshot hash로 바꾸지 않는다.

신규 종류:
FULL_BACKUP_SCOPE_V1 / FULL_BACKUP_REGISTRY_V1 / FULL_BACKUP_PROFILE_V1 /
FULL_BACKUP_JOB_V1 / FULL_BACKUP_EVENT_V1 / FULL_BACKUP_SNAPSHOT_V1 /
FULL_BACKUP_BUNDLE_V1 / FULL_RESTORE_VALIDATION_V1 / FULL_RESTORE_REPORT_V1.
동일 UUID/version이라도 namespace가 다르면 다른 객체다. 기존 FILE_* 또는 PortableKeyEnvelope와 교차 판독하지 않는다.

hash는 기존 canonicalJson/contentHash를 사용하되 신규 원형별 명시 projection에만 적용한다. 자기 ref·현재 조회시각·현재 정책결과·미래 bundle/report ref는 자기 snapshot hash에 넣지 않는다. raw bytes hash·원 source ref hash·비반출 projection hash·파일 전체 hash를 별개 필드로 보존한다.
공통 receipt는 먼저 job의 불변 intent를 가리킨다. bundle/report는 그 실제 receipt와 intent를 포함한 후행 불변 결과이고, 후행 event가 결과 ref를 가리킨다. receipt가 미래 bundle hash를 요구하는 순환은 만들지 않는다.

## 4. A1 — 정확7 자료군·지원 registry·누락 거절

include는 기존 정책의 documents/conversations/knowledge/decisions/plans/results/artifacts boolean 정확7이며 적어도 하나 true, sourceSelection={kind:NONE}만 허용한다. 자료군은 사용자 선택 단위이고 SQL 표명과 동일하지 않다.

| 자료군 | 제안 보존 범위 | 원문·관계 의무 |
|---|---|---|
| documents | 프로젝트 문서의 모든 버전/검토·확정·선택·출처 이력, 해당 양식/방법론/공통기준의 실제 참조 버전, 설계항목·화면영역·설계변경 자료 | source link의 외부/거절 원문은 이유와 원 ref 보존. 공통 자료 전체 수집 금지 |
| conversations | Anvil에 저장된 대화·메시지 순서/버전·추가지시와 첨부 관계 | 외부 Agent 비공개 세션 import 제외. conversation-scoped ID 유지 |
| knowledge | 지식 원문/버전/정정·검토·헌법 적용·공유요청/선택 역사 | 공유 권한/현재 효력은 복원하지 않음. source reference와 실제 원문 구분 |
| decisions | 프로젝트 관련 요청/후보 원문·결정·소비·receipt/audit·정책/제어 역사·이미 제공된 본인 알림/읽음 | Secret 제외 투영과 원본 hash 구분. 과거 승인은 비권한 이력. 다른 사용자의 비공개 범위 자동 확대 금지 |
| plans | 방법론/적용본·계획/업무/의존/검토·확정·기준 적용, 임무초안/확정·역할/결박·전달맥락·이해검토 역사 | 실제 참조 버전까지 닫힘. 현재 역할/실행 허가를 재활성화하지 않음 |
| results | 제출/검토조건/검토/보완·실행/관측/ACK·한도/예약·checkpoint·중지/준비·writer/native의 비밀 없는 저장 역사 | 실제 사실/주장/미검증의 원 assurance·false flag를 보존. credential·활성 permit·bearer·재전달 권위 제외 |
| artifacts | 선택된 범위에 속한 보호 원문/첨부의 실제 bytes와 ref·검사 상태·연결 관계 | 참조된 필수 bytes는 선택이 false여도 조용히 해시로 대체 불가. 아래 의존성 선택을 요구 |

의존성 규칙:
- 선택 자료의 검증/조회에 필요한 프로젝트 내부 불변 자료는 DEPENDENCY_INCLUDED로 구분해 포함하고 그 원자료군을 표시한다. 새 업무 범위를 자동 선택한 것처럼 숨기지 않는다.
- 사용자가 필수 의존성 포함을 거절하거나 보호 읽기 불가/격리/지원 없음이면 preview에는 gap을 보여주고 생성은 막는다. REQUIRED_EXCLUDED를 포함한 결과를 전체 검증 성공으로 표시하지 않는다.
- artifacts=false이면 선택한 자료에서 필수 원문 bytes가 전혀 없는 경우만 생성 가능하다. 메타데이터만으로 원문복원을 주장하지 않는다.
- sourceSelection NONE은 작업 저장소/미커밋 소스 파일 수집을 제외한다. 이미 Anvil에 정상 보관된 결과 첨부/문서 원문은 source라는 이름만으로 제외하지 않는다.
- 비밀 없는 등록/환경 정의·서명/보호 설정 metadata는 정확 의존성으로 보존하되 현재 환경/키/OS 검증을 복원하지 않는다.

RegistrySnapshot 제안 exact:
{schemaVersion:1,kind:FULL_BACKUP_REGISTRY_V1,entries,exclusions}
entry={namespace,recordSchemaVersion,group,codecId,codecSourceHash,producerId,producerSourceHash,selectorVersion,identityKind,hashRule,referenceRules,sensitivityProjectionId}
exclusion={category,reasonCode,restorationImpact}.
referenceRules 항목={fieldPath,targetNamespace,required,scopeRule}, scopeRule=PROJECT|CONVERSATION|EXECUTION|HISTORICAL_ORIGIN이며 fieldPath는 각 exact codec이 허용한 필드 경로만 받는다. codecId/producerId/selectorVersion/projectionId는 고정 registry 부록의 값 이외를 거절한다. sensitivityProjectionId는 null 또는 등록된 투영 ID다.
배열은 namespace/schemaVersion 정렬, 중복/모르는 codec/자기 선언 sourcehash 거절. 이것은 설치 배포에서 고정 검산된 registry 자료이며 HTTP가 producer를 등록하거나 임의 JS/module을 실행시키지 않는다.

실제 A1 대조 목록:
- 기존 composition 24종: Document, Conversation, Knowledge, WorkPlan, DesignTrace, DesignChange, Baseline, ProjectMethodology, MethodologyApplication, Notification, Assignment, ResponsibleSession, ContextPreparation, ExecutionControl, StageBudget, Observation, UnderstandingPermit, ResultSubmission, ResultReviewHistory, PermissionPolicy, ApprovalHistory, ProjectControlLedger, ConnectionCandidate, ProjectCreationDraft.
- 별도 제공되는 source root/control handoff/보호 참조/설치 자원/공유요청·후보 원문 등의 collector는 실제 범위·현재 보호를 개별 등록해야 한다. 기본24에 있다는 이유로 확장형 원문까지 포함됐다고 보지 않는다.
- 최신 forward0060~0071에는 준비기록·하위임무·SEND material·정책·artifact trace·정의/보고·환경·writer/native가 추가됐다. 각 실제 표/허용열/원형/receipt/audit/참조 codec을 1:1 확인해 신규 registry 행으로 고정해야 한다. 번호범위만으로 전부 지원한다고 주장하지 않는다.
- 원 command/승인후보·결과 DTO가 민감 원문을 보관한 경우 보호 투영 codec과 제외 ledger를 별도 검수한다. audit snapshot에 없는 원문을 collector가 재구성했다고 주장하지 않는다.

부록17~18은 실제 source DDL/collector 선택열의 대조 inventory다. 실행 가능한 전체 exact registry는 아직 미완성이다. 기존 부분 A1 후보를 복사해 COMPLETE=true를 발급할 수 없다. source 채택 전 각 entries의 실제 DDL/reader/hash와 표/필드 미분류0을 검토한 고정 부록이 필수다. 실행 중 미등록 namespace나 필수 row/본문/FK/이전 버전이 발견되면 COVERAGE_INCOMPLETE로 거절한다.

### 4.1 plans 자료군의 codec·의존성 판정

이 절은 실제 source를 읽은 현재 기술 근거다. 새 export codec/원문 반출을 채택하거나 plans 전체 coverage를 발급하지 않는다. ORIGINAL 가능은 해당 domain snapshot bytes/hash를 보존할 수 있다는 한정 판정이며 공통 command/receipt/audit·모든 의존성의 전체 폐쇄 성공을 뜻하지 않는다. 아래 경로는 모두 실제 저장소 상대경로다.

| 대상 | 원형·hash와 현재 출력 | 정확 source 근거·남은 폐쇄 |
|---|---|---|
| 프로젝트 방법론 버전 | graph 원형 보존 가능. ref.contentHash는 graph만, name/purpose/origin/reason을 포함한 exportHash와 다름 | `apps/server/modules/backups/project-methodology-inventory.ts:16~22,112~125`. REVISION 직전ref 검산, COPY/draft confirmation/form/limitPolicy 외부 의존성은 별도 포함·검산 필요 |
| 방법론 적용본 | application snapshot 전체의 ORIGINAL 가능. snapshotHash와 graph/sourceHash를 각각 재계산 | `apps/server/modules/methodologies/application-snapshot.ts:15~25`; `apps/server/modules/backups/methodology-application-inventory.ts:91~108`. 원 source methodology/form/limitPolicy·초기생성/draft confirmation·이전 applicationRef 폐쇄 필요 |
| 작업계획 버전·업무카드·의존성 | version_json의 ref/status 제외 snapshot hash, card_json/card_hash 보존 가능. export envelope hash와 원domain hash 분리 | `apps/server/modules/traceability/work-plans.ts:67~75`; `apps/server/modules/backups/work-plan-inventory.ts:105~123`. AF04/AF02 문서·설계/화면 refs·screen review는 같은 파일115~119행의 외부 의존성 |
| 양식·작성 공통기준 | 양식 definition_json 원hash 재계산 가능. 기존 공통기준 collector는 ref/시각만 반환하고 bodyVerification=NOT_PERFORMED. 양식 provenance도 원문과 투영 구분 | `apps/server/modules/documents/forms.ts:7~20,80`; `apps/server/modules/backups/document-inventory.ts:34~35,171~204`; `db/migrations/0003_documents.sql:2~7`의 body_utf8/source_approval_json. 공통기준 원문 reader/export codec 필요. origin_ref_json을 줄인 originProjection으로 원provenance 재계산 주장0 |
| 임무 초안·검토·확정 | 원 version_json hash/영수증을 검산하지만 출력 reviewedBy/confirmedBy는 HUMAN 축약. 기존 출력은 REDACTED_HISTORY | `apps/server/modules/backups/assignment-inventory.ts:125~151`. draft 이전ref·plan/application/taskCard·parent assignment·선택review/원명령/receipt/audit 폐쇄 필요 |
| 역할·책임 세션·결박 | 원snapshot을 검산한 뒤 definedBy/reservedBy/boundBy를 redacted 값으로 출력. 원ref 아래 투영 snapshot SOURCE_HASH PASS0 | `apps/server/modules/backups/responsible-session-inventory.ts:16~25,160~182`. policy/assignment/application/connection·정확 원승인소비 의존. 현재 역할·세션권위 복원0 |
| 설계변경 기준선 activation | 원snapshot 전체hash를 검산하지만 collector는 recordedBy를 축약하므로 REDACTED_HISTORY | `apps/server/modules/traceability/baseline-activation-record.ts:12~19`; `apps/server/modules/backups/baseline-inventory.ts:87~95`. 이전activation/원command·후보/approval/consumption/policy/design/plan 폐쇄 필요 |
| FeatureBaseline 초안·검토·채택 | 내부는 원행을 검산하나 현재 출력은 ref/provenanceHash/metadataHash/currentCheck 요약. 원문 ORIGINAL export source/codec 미구현 | `apps/server/modules/projects/project-baselines.ts:325,431~432,436,560~561`. draft version_json/review review_json/채택 content_json을 요약에서 복원할 수 없음. LEGACY_UNVERIFIED와 notCollected 보존 |

방법론 검토 reviewer 축약은 `project-methodology-inventory.ts:154`, 작업계획 확정 confirmedBy 축약은 `work-plan-inventory.ts:138`에도 있다(둘 다 `apps/server/modules/backups/` 아래). 따라서 검토·확정의 projectionHash/증빙 대조와 원본 SOURCE_HASH 재계산을 분리한다. 원 actor/client UUID를 비권한 역사로 반출할지 또는 기존 보호 투영만 반출할지는 아직 미정 delta이며 이 절에서 채택하지 않는다.

프로젝트가 실제 참조한 SYSTEM/USER_COMMON 방법론·양식의 정확 버전만 dependency 후보로 표시한다. 사용자 미선택 공통자료 전체·다른사용자의 비공개 자료를 자동 포함하지 않는다. 자료군 선택을 늘리지 않고 필요한 dependency/읽기 불가/필수 gap을 preview에 표시한다. 우선 적용snapshot/작업계획 ORIGINAL codec을 기술적으로 고정할 수 있으나 공통기준/FeatureBaseline 원문·보호투영·원명령 의존성이 닫히기 전 plans 전체 eligible0이다.

### 4.2 documents/artifacts 자료군의 codec·원문·참조 폐쇄 판정

이 표는 제품 source·시험을 읽은 기술 근거이며 새 export/원문 반출·권한 계약의 채택이 아니다. ORIGINAL 가능은 원 domain hash의 입력을 보존·재계산할 수 있다는 뜻이며 원행 전체·증빙·bytes·현재 접근의 완결을 뜻하지 않는다. sourceSelection NONE과 원문 비반출·미채택 권한 경계는 그대로다.

| 대상 | 원형·hash와 현재 출력 | 실제 source 근거·남은 폐쇄 |
|---|---|---|
| 문서 버전 | contentHash는 `{title,formRef,stageNodeRef,content}`의 hash다. 작성자·검토·원명령까지 포함한 전체 행/export hash와 분리한다. 원 content_json과 해당 입력은 ORIGINAL 재계산 가능 | `apps/server/modules/documents/project-documents.ts:185~190,196~214`; `apps/server/modules/backups/document-inventory.ts:21,145~158,202`. 문서 head/모든 버전·BODY/ATTACHMENT 링크·양식/적용본·실제 bytes 폐쇄 필요 |
| 반입 후보·변경 제안 | 반입은 candidate_json 전체, 제안은 `{proposal,content,reason}`의 원 hash를 재계산할 수 있다. 선택 이력은 별도 관계다 | `apps/server/modules/documents/project-imports.ts:25~36`; `apps/server/modules/documents/project-proposals.ts:47~59`; `apps/server/modules/backups/document-inventory.ts:24~27,159~162,203`. 원본/추출·diff artifact와 기준 문서·선택된 버전을 포함해야 한다. `apps/server/modules/documents/text-import.ts:1~5`의 READY는 지원 UTF-8 형식 판정이며 PNG 등의 추출 미지원과 원본 보존은 별개 |
| 검토·확정·화면 영역 | HUMAN 검토/확정 대상과 기준을 보존한다. regionHash는 `{designItemId,screenCode,documentRef,artifactRef,anchor}`의 hash이며 기록시각을 추가한 projectionHash와 다르다 | `apps/server/modules/documents/project-content-review.ts:24~41`; `apps/server/modules/backups/document-inventory.ts:165~167`; `apps/server/modules/backups/design-trace-inventory.ts:94~102`. 문서/양식 기준·검토/확정·원명령/receipt/audit 폐쇄 필요. 화면 PNG 첨부·HUMAN 판정·region metadata를 실제 화면/내용/실행 검증으로 승격하지 않는다 |
| 문서-소스 연결 | 원 snapshot hash는 codec으로 검산하지만 collector는 relativePath/reason을 제외한 축약 projection을 반환한다. sourceRef.contentHash와 projectionHash를 대체 사용하지 않는다 | `apps/server/modules/documents/document-source-link-history.ts:37~45`; `apps/server/modules/backups/document-inventory.ts:168~169`. SOURCE_SNAPSHOT fullref/blobHash는 외부 의존이다. FN03 §13.4 미채택 관리 원문 계약이나 외부 작업 소스 읽기 권위를 기존 문서 원문으로 간주하지 않는다 |
| artifact 목록과 실제 bytes | 현재 inventory는 ref/상태/검사 요약이며 blobVerification=NOT_PERFORMED다. 실제 bytes SHA 검산은 별도 source이며 목록 일치만으로 대체할 수 없다 | `apps/server/modules/backups/document-inventory.ts:23,150~154,204`; `apps/server/modules/backups/artifact-byte-verification.ts:35~61`. 후자도 authorityVerified/sourceStabilityVerified/restorable=false를 유지한다. `apps/server/storage/artifact-store.ts:26~34,51~69,78~87`의 배타 게시·sync·readback/길이·SHA 검산과 `apps/server/modules/documents/project-documents.ts:129~145`의 귀속/상태/검사·보호 읽기를 실제 blob collector에 연결해야 한다 |

`apps/server/modules/backups/document-history-envelope.ts:112~125`는 참조의 존재만으로 주체·양식/단계·artifact·command/receipt/audit 검산 성공을 만들지 않고 UNSUPPORTED/MISSING을 보존한다. 문서/첨부/반입/제안/검토와 원명령 증빙, 양식·공통기준·적용본 및 외부 source 참조를 실제 codec/보호 reader로 폐쇄하기 전 documents/artifacts 전체 coverage·복원 가능을 발급하지 않는다. 공통기준 원문과 provenance 축약의 한계는 §4.1을 따른다.

개별 document collector의 RR 관측과 전체 composition은 별개다. `apps/server/modules/backups/project-inventory-composition.ts:148~150`의 EXACT_REFERENCE_PRESENT는 원문/권위/전체 폐쇄 성공이 아니며 현재 전체 조합은 atomic:false다. §5의 같은 snapshot 생산 연결은 아직 구현해야 할 후보 요구다. 이 표를 실제 DB/파일 검사·현재 권한 부여·복원 권위 재생성의 증거로 사용하지 않는다.

## 5. A2 — snapshot과 현재 권한·원기한

불변 자료 수집은 새 한정 내부 접점으로 동일 PoolClient의 하나의 REPEATABLE READ transaction을 사용한다. 각 collector의 공개 RC wrapper를 바꾸거나 각자 connect/BEGIN/COMMIT하도록 두지 않는다. server가 검증한 actor/client/session/project에서 RLS 문맥을 만들며 임의 actor/purpose/GUC로 권위를 만들지 않는다.

순서:
1. 최신 RC 경계에서 현재 HUMAN 로그인/CSRF·활성 OWNER·단독제어/세대·명시 정책·현재 보호4ref·coverage/원 job·기한을 확인한다.
2. 별도 예약 Tx에서 원 intent와 정확 charge/fence를 지속 COMMIT 확인한다. project lock을 잡은 채 다른 동일 lock Tx를 중첩하지 않는다.
3. 전용 RR Tx에서 실제 isolation을 검산하고 같은 client로 registry의 유한 직렬 페이지를 읽는다. 원행을 잠그거나 보존하는 규약은 각 데이터 source와 대조한다. 읽기 전용 RR만으로 파일 변경/권한 회수를 막았다고 주장하지 않는다.
4. 보호 artifact reader로 snapshot의 exact ref/bytes/hash·READY/inspection·프로젝트 귀속과 실제 bytes를 검산한다. 같은 artifactId/bytes 객체의 여러 참조는 한 payload로 보존하고 참조는 모두 남긴다. 같은 hash의 다른 실제 객체를 자동 dedup하지 않는다.
5. 원 DB snapshot과 파일 관측의 시작/끝/현재성을 별도 기록한다. 수집 결과는 §6의 새 immutable manifest로 seal한다.
6. 최신 RC 경계에서 로그인/현재 OWNER·제어/정책/보호ref/예약·artifact 상태를 다시 검사한다. snapshot의 옛 정책을 현재 허가로 사용하지 않는다.
7. 암호화·publish 전과 완료기록 저장 전에도 동일 fence/현재 허가/원기한을 검사한다. RR/파일/publish/DB commit의 전역 원자성을 주장하지 않는다.

ClockPair={at:실제DB시각ms,mono:그관측수신단조시각}를 내부에 고정한다. 후행 DB 관측 시 effective=max(후행DB,기존at+단조경과)로 새 쌍을 고정하고 모든 await 뒤 감소만 적용한다. 공개 observedAt은 실제 관측값이다. 세션 idle/absolute·최근재인증·정책·profile·key lease·예약·job 원기한의 최솟값을 넘지 않는다. 새 연결/재조회/재시작으로 원기한 연장0.

한도 프로필의 deadlineMs 이내 statement/lock/idle timeout을 적용한다. timeout은 실제 작업 정착·취소/handle 회수가 확인됐다는 뜻이 아니다. 미정착 query/IO·rollback/release 불명은 UNKNOWN이고 자원과 예약을 보존한다. 취소나 새 snapshot으로 동일 job을 자동 재시작하지 않는다.

## 6. Snapshot/manifest와 비반출 원형

ManifestSnapshot exact 제안:
{schemaVersion:1,kind:FULL_BACKUP_SNAPSHOT_V1,originProjectId,jobRef,attemptId,policyRef,registryRef,include,scopeDigest,snapshotObservation,records,blobs,dependencies,exclusions,totals}
snapshotObservation={isolation:REPEATABLE_READ,dbStartedAt,dbCompletedAt,filesStartedAt,filesCompletedAt,dbSnapshotLabel,atomicAcrossStores:false}
record descriptor={typedRef,recordSchemaVersion,exportHash,exportBytes,projectionKind:ORIGINAL|REDACTED_HISTORY,omittedFields,sourceReceiptRefs}
blob descriptor={artifactId,sourceRef,contentHash,bytes,mediaType,payloadIndex,referenceOwners}
dependency={from,to,requirement:REQUIRED|OPTIONAL,status:INCLUDED|EXCLUDED|UNAVAILABLE,reasonCode}
exclusion={category,sourceRef:null 또는 TypedRef,reasonCode,required:boolean,projectionHash:null 또는 SHA256}
totals={recordCount,blobCount,metadataBytes,plaintextBytes}; bytes는 10진 문자열이다.

위의 선택형 표기는 문서의 타입 설명이며 wire 문자열이 아니다. null과 해당 닫힌 객체 중 하나만 허용한다.

Secret·비밀번호·DEK/KEK·token·credential·push 구독 원문·활성 grant/permit·연결 handle은 전부 비반출한다. historical actor/client UUID는 원문/hash 검산을 위한 비권한 식별자로만 보존한다. 현재 users/clients/auth/session 표에 과거 UUID 행을 만들어 FK를 통과시키지 않는다. 원 UUID를 현재 사용자로 치환해 source hash를 다시 쓰지 않는다. 비밀 제외 투영은 exportHash와 누락 필드/이유를 가지며 원본 전체 복원 성공으로 보고하지 않는다. 필수 원문에 비밀이 있고 안전한 복원 투영이 정의되지 않으면 전체 생성 거절이다.

## 7. A3 — 암호화 bundle과 키 사용의 신규 결정

권장 형식 A는 기존 후보의 ANV3BK01 magic과 ANVIL_PROJECT_BACKUP_V1/AES-256-GCM 단일 메시지다. 압축·archive 경로 추출·실행 스크립트·SQL·링크는 없다. 기존 PortableKeyEnvelope/FILE bundle decoder는 그대로 보존한다. 다른 알고리즘/길이 fallback은 없다.

외피:
magic ASCII 8bytes → headerLength uint32BE → canonical UTF-8 Header(최대4096B) → ciphertext → tag16B.
Header exact={format:ANVIL_PROJECT_BACKUP_V1,algorithm:AES-256-GCM,originProjectId,jobRef,attemptId,policyRef,keyIdentity,registryRef,nonce,plaintextBytes,bodyHash}.
keyIdentity={originProjectId,keyId,keyVersion}; wrappingVersion은 복구 envelope 선택의 이력이며 동일 DEK의 nonce 도메인을 나누지 않는다.
nonce는12bytes canonical base64, plaintextBytes는 양의10진 문자열·안전한 상한검사 후 streaming 길이로 사용한다. AAD=magic+정확 headerLength4bytes+정확 canonical header bytes. ciphertext 길이는 plaintextBytes와 같고 전체 파일은 12+headerLength+plaintextBytes+16이다. trailing/짧음/unknown key·version·비canonical/duplicate key·overflow는 거절한다. 바깥 header의 프로젝트/식별 metadata 노출은 UI에 알린다.

body record 외피:
kind uint8 + metadataLength uint32BE + canonical metadata + payloadLength uint64BE + payload.
MANIFEST(1)은 첫1개, RECORD(2)는 registry 순서의 자료, ARTIFACT(3)는 artifactId 정렬의 원bytes, END(4)는 마지막1개다.
metadataLength 최대8192B; MANIFEST payload는 아래 manifest canonical bytes·전체 metadata cap 이내, RECORD payload는 해당 exact codec·개별 최대2MiB, ARTIFACT는 원 보호 reader의 더 작은 한도(현재20MiB 이내), END payload는0이다.
MANIFEST metadata={manifestHash,payloadBytes}, payload는 §6 manifest canonical bytes이며 전체 manifest 한도는 §10의 metadata cap에 포함한다.
RECORD metadata={typedRef,recordSchemaVersion,exportHash,exportBytes,projectionKind}; payload는 export DTO canonical bytes.
ARTIFACT metadata={artifactId,contentHash,bytes,mediaType}; payload는 raw bytes.
END metadata={recordCount,blobCount,precedingBytes,precedingHash}; payload0.
record 정렬은 registry namespace ordinal→원 scope canonical bytes→id→version으로 고정한다. MessageRef scope·artifact 특수 원형은 registry codec의 정렬 규칙을 따른다. 중복 ID/hash 충돌·누락·알 수 없는 kind는 거절한다.
manifest totals는 자료 DTO/bytes와 descriptor를 합산하고 manifest 자기 bytes/hash·END를 포함하지 않는다. header plaintextBytes/bodyHash는 전체 body가 seal된 뒤 별도 계산해 자기참조를 피한다. 동일 sourceRef/hash와 payload hash를 구분한다.

키 사용:
- 기존 portable key는32byte DEK를 비밀번호 KEK로 wrapping하는 구현이다. 그 wrap/unwrap 성공이 전체 백업 GCM 지원이나 키 사용 인가는 아니다.
- 새 한정 내부 암호화 사용 접점은 정확 job/attempt/원command·현재 인증/OWNER/control/policy·원승인 소비·보호 ENCRYPTION_KEY ref·원 lease generation/기한·nonce reservation을 검산한 다음, 서버 내부에서만 encrypt/decrypt를 수행하는 제안이다. raw DEK getter, 브라우저/Agent로의 키 반환·임의 plaintext oracle는 없다.
- 기존 InstallationKeyLeaseRegistry에는 이 사용 접점이 없다. 새 method와 job별 용도/취소·폐기·nonce ledger 원형은 채택 대상이다. ACTIVE/UNLOCKED bool이나 주입된 verified:true로 대신하지 않는다.
- 같은 실제 DEK의 모든 encryption 사용이 하나의 지속 nonce 도메인에 속해야 한다. alias/wrapping 개정/설치 이전으로 도메인을 새로 만들 수 없다. nonce12byte 난수 생성과 domain+nonce unique INSERT/사용량 한도/원attempt 결박을 독립 COMMIT 확인한 후에만 cipher를 시작한다.
- 기존/외부 사용 이력을 증명하지 못한 키·import된 키는 복호화 전용이다. 신규 encryption에는 이 설치의 배타적 새 키 도메인 생성·소유 근거가 필요하다. 이 권한·domain 증빙은 아직 없으므로 현재 모든 실제 encryption은 차단이다.
- 동일 attempt 재조회로 재암호화0. nonce 발급/IO 시작 불명이면 해당 nonce를 영구 사용/예약으로 산입하며 재사용0. 실패/회수/과거 키를 자동 삭제하지 않는다.
- 큰 단일 메시지의 허용 길이와 동일 키 사용량 제한은 기존 암호 형식 후보의 미정이다. §10은 후보 정책 상한일 뿐 암호 표준 검토/실키 도메인의 완결 증명이 아니다. 구현 전에 고정 Node/OpenSSL 및 표준 한도를 대조해 더 작은 값을 exact profile에 고정해야 한다.

키 복구·이식·유실:
기존 ANVIL_PORTABLE_KEY_V1의 별도 이식 파일과 비밀번호, VERIFY_KEY_COPY·UNLOCK/RELOCK·REWRAP/ROTATE 의미를 재사용한다. 기존 파일/비밀번호 보관 확인 없이 전체 생성 가능 상태를 발급하지 않는다. 키 파일은 backup bundle 안에 넣지 않는다. 저장소가 함께 유실돼도 별도 키 사본이 있어야 복구 가능하다는 안내를 제공한다.
비밀번호 변경은 옛 wrapping 사본을 무효화하지 않으며 키 회수는 새 사용 차단이지 옛 암호문 파괴가 아니다. 새 키로 옛 bundle을 복호화할 수 없다. 필요한 키/비밀번호·사본을 모두 잃으면 복구 불능일 수 있고 관리자 우회/escrow/평문 export를 새로 만들지 않는다.
현재 권장 사용은 수동 해제만이다. 무인 백업/장기키 서비스·자동 해제는 별도 결정이며 이 후보에 없다.

## 8. A4 — 검증 복원·역사 보존과 실제 적용의 분리

입력은 §19에 따라 현재 검증 target 프로젝트에 보호 등록된 정확 inputRef(namespace FULL_BACKUP_BUNDLE_V1의 기존 생성 bundle 또는 FULL_BACKUP_INPUT_V1의 새 외부반입 ciphertext, §19의 신규 미채택 계약)·key ref와 기대 originProjectId/registryRef다. 사용자가 보낸 header 식별자·임의 절대경로·bundle 소지만으로 조회/복호화 권한이 생기지 않는다. 복원 시험을 위해 원본을 overwrite하거나 계정을 만들지 않는다.

검증 순서:
1. 현재 HUMAN/OWNER/control·명시 검증 정책·원승인/원command·보호 입력/검증 전용 target·key lease·기한/예약을 검산한다.
2. exact header/전체 길이·기대 identity와 codec 지원을 검산한다. bounded stream 평문은 새 소유 staging으로만 보낸다.
3. GCM final/tag/AAD와 bodyHash가 모두 성공하기 전에는 record parser/일반 API/DB/다운로드/복원 대상으로 평문을 전달하지 않는다.
4. 인증된 body의 정렬/count/각 hash/원 namespace/필수 dependency·이전 버전·receipt/audit/candidate/원command 관계를 검산한다. bundle 안의 SQL/DDL/JS/외부 URL은 실행하지 않는다.
5. 새 비권한 역사 검증 저장소에서 현재 계정/환경/권한과 분리한 원 DTO와 source identity를 로드해 고정 reader로 원문·버전·관계를 다시 읽고 비교한다.
6. actual verifier가 수행한 항목별 결과와 미수행/미지원·필수 gap을 immutable report에 보존한다. 메모리 모델 성공은 MODEL_ONLY이며 실제 PG 복원 PASS로 표시하지 않는다.

역사 저장소의 닫힌 논리 row 제안:
{originProjectId,namespace,scope,ref,recordSchemaVersion,exportHash,projectionKind,payload,validationRunId}.
이것은 기존 anvil 업무 표에 그대로 INSERT하는 복원이 아니다. 원 user/client는 비활성 역사 식별자이고 로그인/멤버/현재 control·승인소비/credential을 생성하지 않는다. 현재 읽는 사람의 권한은 검증 target의 현재 인증·정책으로 따로 검사한다.
ReportSnapshot.inputRef는 §19의 typed union이며 새 설치의 외부반입도 원 입력 그대로 보존한다. 현재 자료로 재사용할 경우 새 current ID·원본ref·새 hash·현재 검토/확정/승인·명시 적용을 거치는 별도 계약이 필요하다. 이 후보에 confirmRestore/적용 endpoint는 없으며 적용 버튼도 disabled 이유를 제공한다.
REDACTED_HISTORY의 원문 제외는 report에 남는다. 필수 원본이 없으면 검증 가능한 제한 범위는 보여주되 FULL_VERIFIED를 발급하지 않는다.

ReportSnapshot exact 제안:
{schemaVersion:1,kind:FULL_RESTORE_REPORT_V1,originProjectId,runRef,inputRef,manifestRef,registryRef,verifierRef,checks,totals,issues,excluded,startedAt,completedAt,assurance,applied:false,authorizationRestored:false,writerResumed:false}
checks 항목={code,state:PASS|FAIL|NOT_RUN|UNSUPPORTED,evidenceRefs,reasonCode}; code는 AUTHENTICATED_ENVELOPE/RECORD_BYTES/SOURCE_HASH/REFERENCE_CLOSURE/HISTORY_CHAIN/BLOB_BYTES/READBACK로 닫는다.
assurance=MODEL_ONLY|MANAGED_ARTIFACT_VALIDATED|ISOLATED_DB_VALIDATED의 수행 범위이며 하나가 다른 미수행을 대신하지 않는다. FULL_VERIFIED는 필수 check 모두 실제 계획된 수준에서 PASS·필수 issue0인 경우만 summary에 표시하고, source 합성 시험에서는 사용하지 않는다.

## 9. A5 — 공개 명령·조회 DTO·상태·일회승인

아래 신규 공개 표면은 전부 채택 대상 제안이다. 기존 source만으로 이미 제공된 endpoint라고 해석하지 않는다. 같은-origin 상대경로/HUMAN 인증/정규 JSON·닫힌 오류를 사용한다.

새 operation 후보:
- createFullBackupJob: 정확 payload={policyRef,registryRef,previewDigest,reason}
- createRestoreValidationJob: 정확 payload={inputRef,validationTargetRef,keyReferenceRef,expectedOriginProjectId,registryRef,reason}; inputRef는 §19의 기존 생성 bundle 또는 새 외부반입 typed ref만 허용한다
두 명령 모두 기존 PROJECT 외피 schemaVersion/commandId/projectId/clientId/controlGeneration/operation/targetId/expectedVersion/baselineRefs/approvalRef/payload를 사용한다. 최초 targetId=null/expectedVersion0. baselineRefs는 registry가 정의한 정확 선택 ref를 정렬·중복거절한다. 각 payloadHash는 canonical payload 전체, 승인 actionScope는 그 원commandId/정확 policy·target·generation·hash와 결박한다.
읽기 operation 후보는 readFullBackup/readRestoreValidation 두 개다. 기존 정책에 자동 추가0. 현재 DENY 우선·명시 AUTO 또는 새 정확 일회 승인 분기만 허용한다.

승인:
기존 saveBackupPolicy 승인과 job 생성 승인은 다른 소비다. 키 unlock/설치 intent 승인을 job 승인으로 재사용하지 않는다.
requestApproval의 {details,candidatePayload} 패턴으로 위 비밀 없는 payload 전체를 별도 불변 후보에 보관하고 public approval GET은 현재 OWNER+원작성자·원 request/command/receipt/hash 검산 후만 반환한다. 기존 후보 validator·다른 operation 의미를 변경하지 않는다.
REQUIRE_APPROVAL일 때 UI08에서 별도 결정한 exact requestRef/decisionRef를 원 buffer로 명시 결박한다. job intent 저장과 정확 원승인 소비/공통 command/receipt/audit는 같은 Tx다. 워커의 후속 단계는 실제 원command 자기 소비 proof를 검산하고 다른 승인·중복 소비를 허용하지 않는다.
현재 권한/정책·제어/세대·세션은 replay에도 먼저 검사한다. replay는 원 intent receipt를 반환할 뿐 새 attempt/nonce/IO/승인 소비를 만들지 않는다. 원 receipt로 현재 job 완료/참조 유효성을 덮지 않는다.

신규 endpoint 제안:
- POST /api/v1/projects/:projectId/full-backup-previews
  body exact={policyRef,registryRef}; 현재 읽기+생성 권한을 검산하는 bounded preview이며 원문/키 반환·파일 생성·nonce 발급0.
  DTO={projectId,policyRef,registryRef,previewDigest,observedAt,expiresAt,includedGroups,dependencyGroups,excludedGroups,counts,estimatedBytes,gaps,canRequest,reasonCodes}.
  counts={recordCount,blobCount,dependencyCount}; estimatedBytes={inputBytes,outputBytes,stagingBytes,metadataBytes,retainedFailureBytes}이며 모든 bytes는10진문자열이다. includedGroups/dependencyGroups/excludedGroups는 정확7 이름 중 중복 없는 정렬배열이다. gaps/current.issues/report.issues는 아래 Issue 원형을 사용한다.
  previewDigest는 고정 선택·dependency descriptors·registry·보호 ref의 hash이며 실제 최종 snapshot을 미리 보장하지 않는다. preview 변동은 재확인/명시 새 준비를 요구한다.
- 기존 POST /api/v1/projects/:projectId/commands 의 위 두 신규 operation.
  접수 DTO는 기존 ProjectCommand receipt envelope를 보존하고 data={status:FULL_BACKUP_REQUESTED|RESTORE_VALIDATION_REQUESTED,intentRef,jobRef,accepted:true,completed:false}. 접수와 결과 완료 분리.
- GET /api/v1/projects/:projectId/full-backup-jobs?limit=1..50&cursor
- GET /api/v1/projects/:projectId/full-backup-jobs/:id/versions/:version
- GET /api/v1/projects/:projectId/restore-validation-jobs?limit=1..50&cursor
- GET /api/v1/projects/:projectId/restore-validation-jobs/:id/versions/:version
- GET /api/v1/projects/:projectId/full-backup-jobs/:id/bundle
  현재 보호 읽기와 정확 완료 bundle metadata/파일 재검산 후 암호문 bounded download만 제공. 미완료/불명은 다운로드0. raw target 경로/키 없음.

JobView exact={projectId,ref,intentRef,operation,state,attemptRef,policyRef,bundleRef,reportRef,startedAt,deadlineAt,completedAt,issues,current,observedAt}.
JobView/JobListItem의 bundleRef는 생성 job의 출력 bundle만 뜻하며 검증복원 job에서는 null이다. 검증복원의 원 입력은 intent의 inputRef와 report.inputRef에 §19 typed union으로 결박한다. 정책이 없는 restore validation의 policyRef는 null. 아직 없는 attempt/result/시각은 null이며 성공처럼 만들어 채우지 않는다.
current={state:AVAILABLE|CHANGED|UNAVAILABLE,reasonCodes,observedAt}; 과거 job state와 현재 접근/키/파일 상태를 분리한다.
Issue exact={code,target,required}; target={kind:PROJECT|POLICY|REGISTRY|KEY|TARGET|RECORD|BLOB|ATTEMPT,ref:null 또는 TypedRef}. code는 COVERAGE_INCOMPLETE/REQUIRED_EXCLUDED/SOURCE_UNAVAILABLE/SOURCE_CHANGED/REFERENCE_CONFLICT/KEY_LOCKED/KEY_USE_UNAVAILABLE/REGISTRY_UNSUPPORTED/BUDGET_EXPIRED/STORAGE_LIMIT/IO_UNKNOWN/COMMIT_UNKNOWN/INTEGRITY_FAILED로 닫는다. reasonCodes도 이 집합과 명시 PUBLIC_ERROR 코드만 허용하고 raw 오류문자열을 받지 않는다. issues 최대1000, target 중복은 code+정확target+required로 제거하며 초과는 truncated 성공이 아니라 실패다.
JobListItem exact={projectId,ref,intentRef,operation,state,policyRef,bundleRef,reportRef,startedAt,deadlineAt,completedAt,issueCount,currentState}. ref들은 기존 fullref 또는 아직 없으면 null, issueCount는0..1000 정수, currentState는 AVAILABLE/CHANGED/UNAVAILABLE다. 목록에는 issues/current.reasonCodes/원문을 인라인하지 않는다. 각 항목 canonical UTF-8 최대8192B를 서버가 검산하며 이를 넘는 원행은 무결성 실패이지 자르기 성공이 아니다. 동일 ref의 기존 fixed GET에서 JobView 전체를 읽는다. Page exact={items:JobListItem[],nextCursor,hasMore,observedAt}; cursor는 server 서명·project/actor/client·operation/정렬/고정 snapshot에 결박,30분·최대4096자·다른 문맥 거절. list/fixed는 원문 bundle/key를 반환하지 않는다.
오류 DTO는 기존 공통6필드 code/message/requestId/targetId/retryDisposition/commandId를 유지한다. 코드 후보: AUTH_REQUIRED401, PROJECT_OPERATION_DENIED/PROJECT_CONTROL_REQUIRED403, NOT_FOUND404, VERSION_CONFLICT/CONCURRENT_CHANGE/IDEMPOTENCY_CONFLICT409, INTENT_EXPIRED410, BACKUP_REFERENCE_UNAVAILABLE/COVERAGE_INCOMPLETE/KEY_USE_UNAVAILABLE412, INPUT_INVALID422, BACKUP_STORAGE_LIMIT429, BACKUP_INTEGRITY_FAILED/BACKUP_STATE_UNKNOWN503.
unknown SQL/IO/crypto 오류·키 존재·실경로·stack은 고정503으로 sanitize한다. 503은 실패 미전송의 증거가 아니며 원명령 재확인 안내를 유지한다.

JobView/current response의 전체 JSON은 최대2MiB+1000*512B+4096B, Page는 실제 items 개수 n(0..50)에 대해 n*8192B+4096B이며 최대413696B를 넘지 않도록 DTO builder에서 먼저 검산한다. 큰 manifest/registry/report 본문을 JobView에 인라인하지 않고 exact ref로만 연결한다. report 본문은 현재 보호 read 아래 별도 fixed GET /api/v1/projects/:projectId/restore-validation-reports/:id/versions/:version으로 최대2MiB를 반환하는 신규 endpoint 후보다. 큰 상세는 고정 ref별 유한 페이지 계약이 추가로 고정되기 전에는 생성 거절이며 임의 잘라 성공하지 않는다. 모든 GET stream은 상한 초과 시 cancel/release, 원 signal/기한을 보존한다.
현재 OWNER+원작성자만 job 원문/다운로드 조회하는 한정 제안이다. VIEWER·다른 OWNER의 원문 접근·다른 기기 creator 귀속 완화는 자동 포함하지 않는다. creator client는 원이력이며 새 현재 authenticated client로 본인 원기록을 조회할 수 있다. GET은 현재 제어 보유를 요구하지 않되 명시 read 정책은 검사한다. 다른 OWNER의 재난 복구 권한이 필요하면 별도 정확 범위를 결정한다.

EventSnapshot exact={schemaVersion:1,kind:FULL_BACKUP_EVENT_V1,projectId,jobRef,attemptId,sequence,previousEventRef,event,state,occurredAt,actorRef,commandRecordRef,reservationRefs,resultRef,issues}. actorRef는 원HUMAN 또는 그 원명령에 결박된 내부 작업자 표시로만 사용하고 새Agent 권한을 발급하지 않는다. event는 상태와 같은 닫힌 단계 이름이며 serverCommand/proof가 없는 전이는 거절한다. sequence는1부터연속, previousEventRef 최초null/나머지직전exact이고 신규event/payload/hash와최종head의지연완결을검산한다.
상태는 immutable events로 도출한다:
REQUESTED → RESERVED → COLLECTING → SEALED → ENCRYPTING → VALIDATING → PUBLISHING → COMPLETED.
검증복원은 REQUESTED → RESERVED → DECRYPTING → VALIDATING → COMPLETED.
각 단계에 REJECTED(부작용 시작 전 거절)/FAILED(명확 정착 실패)/UNKNOWN(시작·기록·정리/commit 불명)을 허용한다. 단계명만으로 실제 IO 완료를 추정하지 않는다. attempt는 job당 최대1이고 재시작/lease 인수로 같은 부작용을 재시도하지 않는다.
UNKNOWN에서 GET은 원행/원명령/파일 지문과 관측 사실만 반환한다. 새 파일/nonce/COMMIT 재전송이나 성공 전이는 하지 않는다. 수동 조정 명령/운영 정리는 이번 후보에 없고 별도 정확 후속안이 필요하다. 따라서 crash 뒤 사용자가 원기록을 찾는 것은 가능하지만 UNKNOWN 자동 복구 완료를 약속하지 않는다.

## 10. 저장·예약·한도와 미정 수치

논리 저장 종류 제안(물리 표명/번호는 후속 WI에서 실제 목록과 고정):
registry/profile version, job intent+head, immutable event, scope/manifest record index, blob descriptor, bundle descriptor, validation report, approval candidate, key nonce/use ledger, staging/output reservation.
job id·origin project·원command/receipt/audit·원승인소비·attempt/fence·이전 event fullref를 복합FK/지연 완결/reverse guard로 상호 검산한다. namespace 단독 행/누락/중복/명령 result-only 위조·event만 삭제를 거절한다.
head는 최종 event/fullref·세대수·최종 bytes cap을 검산한 CAS만 허용한다. history/candidate/nonce는 불변이다. REVOKED/FAILED/UNKNOWN/과거 버전도 누적 한도에 산입하며 자동 삭제/상향0.
직접 app raw DML/SELECT로 보호를 우회하지 않는다. 현재 authenticated identity·OWNER·종류별 정책/원명령을 검산한 최소 definer 접점과 FORCE RLS/고정 search_path/PUBLIC 회수·최소 ACL을 설계하고 내부 역사 반환은 검증 proof/최소 투영으로 한정한다. 임의purpose/actor GUC는 권위가 아니다. 실제 권한 적용은0이다.

유한 프로필 후보값(기존 확정 수치와 구분):
- 개별 command/record2MiB, header4096B, record metadata8192B, manifest+index 누적64MiB.
- 한 job 최대100000 records·10000 blobs, 기존 artifact 개별20MiB 이하.
- 암호문 포함 bundle 출력 최대 min(policy.maxBytes, 보호profile.outputBytes, target 한도,10GiB). plaintext 한도는 외피/manifest/END overhead를 빼 산출하고 부족하면 거절한다.
- job 전체 원기한 최대120초, 현재 session/정책/key lease/profile/예약의 더 짧은 기한. 실제 최대자료가120초 안에 처리된다고 보장하지 않으며 source/실측에 맞춰 더 작은 profile을 사용한다.
- 프로젝트 동시 IO job1/대기0. metadata는 head+모든 intent/event/report/candidate/nonce/예약을 포함해10000행/64MiB 제안. nonce 도메인 실제 암호 사용량 한도와 구별한다. 포화시 새 기록 포함 신규 job 거절, 기존 조회/replay추가0.
- 입력/staging/output/retainedFailureBytes/fileCount는 기존 VerificationLimits의 항목을 재사용하되 별도 FULL profile에서 상한을 검산한다. 물리 disk/WAL/전역사용량을 이 논리 cap으로 증명하지 않는다.

예약 프로토콜 제안:
기존 ARTIFACT/CHECKPOINT kind를 위장하지 않고 FULL_BACKUP_IO라는 새 저장예약 연산/집계 계약을 별도 채택한다. 기존0059 원형/수치·writer·quota_account 네 열을 바꾸지 않고 새 forward guard와 양방향 합산 보호가 필요하다.
K=10GiB, U=기존 실사용 원자료, H=기존 held(새 job의 중복 산입 제외), M=이번 예약에 포함되지 않은 metadata 실증가, R=동시에 존재하는 새 사본과 정리 불명 bytes의 예약으로 정의한다. R은 새 plaintext staging P·ciphertext C·검증 staging V 및 실제 별도 index/실패 사본을 포함하되 P/C/V에 이미 들어간 외피·manifest를 다시 더하지 않는다. 생성·외부 반입·검증 모두 동일 정의를 적용하며 같은 job의 중간 사본 해제는 소유·정착/삭제 확인 뒤에만 줄인다.
최신 권한·project 잠금·원command/계획/fence의 독립 예약 COMMIT → 별도 IO_STARTED COMMIT → 실제 IO 단발 → publish/완료 검산 → 정산을 따른다. 운영 Tx rollback이 예약/시작 표식을 지우지 않는다.
권장 보수안은 U+H+M+R≤K로 검산하고 target 여유도 따로 검사하는 것이다. 기존 held나 이미 R에 포함된 metadata/사본을 새 증가로 중복 산입하지 않는다. 따라서 원자료가 cap 근처인 프로젝트는 백업 staging을 예약하지 못할 수 있다. 이는 가용성의 중요한 제안 영향이며 숨기지 않는다. 대안은 외부 백업 저장소/검증 staging의 별도 유한 cap과 원 project cap 범위를 새로 정의하는 것이다. 이 선택은 D5에서 결정해야 하며 현재 값으로 구현 GO하지 않는다.

예약 해제:
- IO_STARTED 전 명확 부재/미시작이면 같은 fence로 RESERVED→RELEASED를 저장한다.
- IO 시작 뒤는 파일/handle 정착·정확 소유·정리 확인 전 예약 유지. timeout/만료/권한회수/프로세스 재시작은 해제 근거가 아니다.
- 실패 staging을 실제 회수한 bytes만 R에서 차감하고 남은/불명은 계속 held. 완료 ciphertext는 실제 파일 보관량으로 정산한다. 해제/정산과 used/held를 같은 Tx에서 바꿔 이중 산입/누락0.
- cap 포화여도 감소/실제 정산 기록을 못 남겨 허위 해제하지 않는다. 해당 사실을 기록할 유한 감소 전용 공간 또는 보수적 held 유지 방식은 D5의 exact 저장설계에서 고정한다. 예약 한도는 삭제 권한이 아니다.

## 11. 파일·commit·비동기 경계

root/대상은 기존 보호 TARGET/설치 catalog의 정확 ref와 비반출 resolver를 재사용한다. 임의 경로/URL 입력·TEMP 자동선택·사용자 Backup 폴더 조사0. 새 소유 attempt 하위에서 exclusive/no-follow/identity/nlink/owner 검산·유한 partial write→sync→readback/hash→불변 publish·parent sync를 수행한다. source 포트 구현과 실제 OS 내구성 증거를 구분한다.
모든 await 뒤 원시도/fence·current·clock/budget을 검사한다. 포트/함수/보호 root·key binding 교체는 거절하고 constructor/import효과0·기본 실제 IO fallback0으로 source를 작성한다.
publish 성공 뒤 DB 완료 COMMIT 실패/불명, DB 성공 뒤 파일 부재/변조는 UNKNOWN/사용 차단이다. 정상 완료는 파일 지문/정확 manifest·원command/receipt/audit·최종 current·예약정산의 완결 COMMIT 확인 후만 반환한다.
미정착 write/open/read의 소유 handle/buffer는 정착까지 보유하고 후속 write/publish0이다. 늦은 정착은 단 한 번 소유 close/cleanup 관측만 하며 성공 재채택·자동 retry0. cleanup도 원 scope 안의 감소만 가능하며 다른 파일/프로세스를 열거/강제삭제하지 않는다.
키 Buffer 소거는 best-effort이며 메모리 전체/OS swap/관리자 침해 방어로 과장하지 않는다. 완료파일·원자료·이식키 파일은 시험 cleanup 대상이 아니다.

## 12. UI14 전체 사용자 흐름과 원명령 보존

기존 설정·BackupPolicyPanel 옆에 '전체 수동 백업·검증 복원' 별도 접힘 영역을 제안한다. 기본 mount/open 자동 생성/권한창/원문 조회0. 기존 선택파일 검증과 전체 백업 범위를 분명히 구분한다.

1. 정확 프로젝트/정책을 보호 조회해 일곱 선택과 source NONE·네 보호ref를 표시한다. 고정 원문·현재 참조 유효/기한·coverage 미확인을 구분한다.
2. 명시 preview에서 선택/의존 포함/제외·필수 gap·예상 source/staging/output/held·키 복구 조건을 보여준다. 필수 의존성/키/coverage 없으면 생성 비활성+고정 이유다.
3. 기존 설치 자원 화면에서 키 사본 확인·수동 해제를 별도로 수행한다. 이 화면이 비밀번호를 App buffer/URL/localStorage/승인 후보에 넣지 않는다. 해제 성공이 백업 생성 성공은 아니다.
4. 부모 App 소유 CAS buffer에 원 commandId·payload·baselineRefs·정확 policy/registry·previewDigest를 고정한다. REQUIRE_APPROVAL이면 UI08 요청/원문 표시/별도 결정 후 원 buffer로 돌아오며 자동 POST0이다.
5. 명시 생성은 정확 원명령을 한 번 전송한다. 접수 receipt 후 job fixed GET을 별도로 수행하고 GET 실패가 원 pending/receipt를 지우지 않는다.
6. 명시 목록/fixed 조회에서 REQUESTED/단계·FAIL/UNKNOWN·현재 접근/키/파일 상태와 deadline을 표시한다. 늦은 JSON/digest/401/403은 project/user/client/session/CSRF/transport의 관측 세대와 close/unmount ticket으로 폐기한다. A→B→A가 원 ticket을 되살리지 않는다.
7. COMPLETED와 현재 bundle 확인이 모두 있으면 암호문 다운로드를 명시 제공한다. 다운로드 완료가 사용자 오프라인 사본 보관 성공은 아니다.
8. 검증복원은 보호 bundle·별도 validation target·키를 선택하고 별도 command/승인으로 실행한다. 결과는 검사별 PASS/FAIL/NOT_RUN/UNSUPPORTED·원문/참조·누락/제외를 표시한다. '검증 성공'과 '현재 프로젝트 적용'을 분리하고 적용은 이번 범위 미지원이다.
9. UNKNOWN은 원명령/원시도 재조회만 안내한다. 자동 재생성/복호화/nonce발급·과거 승인 재사용·원자료 삭제0.

일시 권한 실패는 원문을 숨기되 원 pending/UNKNOWN을 조용히 지우지 않는다. 현재 허용 문맥의 명시 재조회·입력 복구가 영구 latch로 막히지 않게 generation별 busy/finally를 결박한다. 실제 App의 부모 CAS/route 왕복 검수를 포함하고 합성 부모만으로 끝내지 않는다.

## 13. A6 — 실제 coverage 생산·저장 검증

FULL_BACKUP_PROFILE_V1 제안 exact:
{schemaVersion:1,kind:FULL_BACKUP_PROFILE_V1,registryRef,verifierRef,format:ANVIL_PROJECT_BACKUP_V1,checks,limits,producerEvidenceRef,installationRef}
checks는 §8의 일곱 check이며 정렬/정확 개수·필수성은 registry에 고정한다. ref/hash는 이 immutable projection에만 결박하고 current는 별도 계산한다.
current exact={state:UNCONFIGURED|UNVERIFIED|ELIGIBLE,issues,observedAt}; ELIGIBLE은 해당 종류의 코드/배포/보호 공급자/현재성 검산이 가능하다는 뜻이며 특정 job 성공이 아니다.

producerEvidenceRef는 고정 설치 배포에서 검산된 실제 codec/verifier 코드·registry·대상/키 사용/nonce 저장·기한/한도 지원의 근거를 가리킨다. 임의 입력 bool·등록표 한 행·합성 fixture의 SOURCE_ONLY_MODEL이 이를 발급하지 않는다.
source 모드는 MODEL_ONLY로 닫고 명시 시험 조립만 허용한다. 기본 공급자는 UNCONFIGURED/412, 실제 ELIGIBLE을 발급할 생산자가 없으면 구현 미완료로 남긴다.
A1~A4의 검산 근거가 없거나 current 보호조회 DENY/불명이면 사용자 정책의 eligible을 true로 바꾸지 않는다. 기존 정책/참조 reader의 역사/현재 분리 및 오류 의미를 유지한다. 기존 SELECTED_FILES_V1 profile의 체크 목록을 늘려 원소비자를 깨지 않는다.

## 14. 후속 source 구현 표면·순서·검수

여기는 허용 후보 표면이지 현재 write allowlist가 아니다. 신규 파일은 미존재를 후속 WI에서 확인하고 실제 기존 파일은 import/목록을 다시 고정한다. 새 forward migration 번호를 지금 예약하지 않는다. 기존0053/0054/0059/0063과 완료제품 본문을 재작성하지 않는다.

| 단계 | 제안 표면과 산출물 | 직접 인수 |
|---|---|---|
| A1 | 신규 contracts/runtime/full-backup-registry-v1.ts, apps/server/modules/backups/full-backup-registry.ts 및 고정 registry 부록. 기존 project-inventory-composition/개별 collector와 별도 RR 내부 접점 | 실제 schema/원문/hash/보호관계 누락0; unknown namespace·필수 artifact/이전원형 누락 거절 |
| A2 | 신규 full-backup-snapshot.ts, full-backup-input.ts; 기존 AccessRepository의 한정 Tx 접점과 실제 collector | 동일client/isolation·최신RC/원기한·DBforward/await·RR와파일 혼합 거절·미정착 소유 |
| A3/A4 | 신규 full-backup-format.ts, full-backup-crypto.ts, full-restore-validation.ts, full-backup-key-use.ts; 기존 portable envelope/lease의 한정 내부접점 | 독립 expected bytes/AAD·tag/nonce/wrongkey·인증전채택0·역사주체 불변·parser/원문 readback |
| A5 | 신규 full-backup-jobs.ts, full-backup-routes.ts, full-backup-reservations.ts 및 forward SQL. 기존 projects/routes·project-command·approval-input/project-approvals의 새 두 명령만 | receipt/intent/event/nonce/예약의 양방향완결·RLS/ACL·원소비·COMMIT불명·replay추가0 |
| UI14 | 신규 FullBackupPanel.tsx/full-backup-api.ts, 기존 App/설정·ApprovalsPage/decisions api/policy profile의 정확연결 | 실제App·부모ACK·명시승인/저장·목록/fixed·UNKNOWN·GET실패분리·ABA/늦은401·키원문0 |
| A6 | 별도 full-backup-profile.ts/codec와 한정 기존 policy/provider 소비 | immutable evidence/source generation·current 검사·기본412·선택파일 profile불변 |

새 source는 import/constructor 부작용0·실제 IO/crypto key source/DB/브라우저/Agent는 명시 시험 대역 또는 미연결이다. 실제 fs/PG/키·Nodecrypto 난수/암호 실연산까지 허용할지는 별도 정확 검증 WI에서 구분한다. 현재 문서 작성은 그 실행을 허가하지 않는다.

검수 계층:
- 정적: 현재 schema/namespace/hash·FK/트리거/권한·실소비선과 코드 대조. SQL 구문/OID/RLS/경합 PASS로 부르지 않음.
- 합성: registry의 실제 codecs/수집/예약/state machine/route·실제 App을 명시 모델로 연결. codec 모듈 부재 준비 RED와 실제 정상 함수의 행동 RED를 분리.
- 암호: 후속 허용된 공개 시험 벡터/고정 키만; 별도 byte oracle로 AAD/길이/nonce·인증 전 미사용과 tamper 검증. injected success verifier로 실제 crypto 지원을 대신하지 않음.
- 필수 음성: 다른project/namespace·부모/참조/hash/원command·후보/receipt/audit/소비 누락/중복; 현재DENY/다른OWNER/옛세대; key locked/relocked/expired·같은DEK alias/import nonce재사용; DBforward/await기한; cap-1/cap/cap+1 및 후속writer; IO전/후·publish/COMMIT/rollback 불명; late handle·원정보 유출; 복원원문 누락/교차참조; 전체확인 없이 profile성공 금지.
- 실증 NOT_RUN: PG 적용/isolation/FK/OID/RLS/경합, 실제 보호 파일/전원손실/키 이식·복구, 실제 bundle/검증대상, served UI/다운로드/사용자 보관/인수. 합성 PASS 분모와 분리.

각 단위는 TEST_ONLY→정상 실제소비 반례 RED→단일 writer 구현→직접영향 검증→독립검수→Main 통합이다. A1 source만으로 A6/전체기능 완료를 선언하지 않는다. source-only 검수완료와 실제 사용가능/전체 FN16/계획 완료를 따로 기록한다.

## 15. 필요한 결정·대안·승인 준비도

| ID | 권장안·이유 | 대안·중요 영향 | 준비도/정확 선행 |
|---|---|---|---|
| D1 전체 범위/의존성 | 정확7선택+source NONE·필수의존성 명시포함/거절. 숨은 원문누락을 방지 | metadata-only를 허용하되 전체복원 profile과 별도형식 필요 | 사용자범위 검토 가능. 실제 전체 registry 부록 미완성으로 제품GO 불가 |
| D2 snapshot/원형 | RR한정내부수집+최신RC허가+불변bytes/실검산, 비권한역사 저장 | 현재 anvil 표로 직접 복원은 계정FK/원형/권한 delta가 커 이번에는 제외 | 기존auth/RLS/모든collector 접점과 역사row exactcodec 추가검수 필요 |
| D3 암호화/키 | 기존후보 AES-256-GCM 외피·수동 lease·동일실키 지속 nonce도메인·import복호화전용 | 매 backup용 파생/별도 키는 새 KDF/키수명계약이므로 이번에 임의 도입하지 않음. 키부재면 전체암호화보류 | 외피 검토 가능. 실제 key-use method/domain 증빙·사용량 정확상한/암호검수는 미정 |
| D4 공개job/승인/조회 | §9 두명령/두read·별도후보·receiptintent·이력/다운로드·UNKNOWN재조회 | 기존정책저장 승인만 재사용하는 방식은 다른부작용허가라 배제 | 공개delta 선택과 현 ProjectCommand/승인/조회형 대조가 필요 |
| D5 한도/예약 | §10의 U+H+M+R≤K/동시 사본·양방향기존writer보호·누적cap | 외부bundle/검증staging 별도cap은 가용성이 좋지만 기존10GiB 범위와새저장도메인 결정 필요 | near-cap 생성불가 영향·감소기록공간·실제charge algebra를 결정한 뒤 sourceWI 가능 |
| D6 적용/운영 | 검증전용·현재권한/계정/실행복원0·UNKNOWN보존/자동조정0 | 실제적용·운영조정/고아정리는 별도정확결정 | 이 제한 범위 검토 가능. 실제복원/사용자여정은 별도실행안 |

Main/PMO가 먼저 검토할 것은 D1~D6의 구체 선택과 미정 해소 순서다. 한 번에 모든 실제 실행을 승인받는 질문이 아니다. 기존 Main 상세화 지시에 따라 A1 registry/키사용/예약 상세 증거를 더 고정할 수 있지만, 새 public/auth/storage/암호 의미의 채택은 별도로 받는다.
현재 이 r1을 완성 구현 지시로 전달하면 안 된다. 특히 A1 미완성/미정 key domain/감소공간과 D5 cap 선택을 가짜 포트나 나중 시험으로 미루고 전체GO하지 않는다.

## 16. 변경·rollback·미수행

이번 산출물은 신규 후보문서1개뿐이다. 정본/source에 같은 UTF-8/LF bytes로 작성하고 기존 파일이 있으면 덮어쓰지 않는다. 기존 정책/참조/키 envelope/SQL/원자료를 수정하지 않는다.
후보가 채택되지 않으면 문서를 이력으로 남기거나 이 신규 문서 commit만 정상 revert할 수 있다. 실제 데이터/키/파일/서비스 rollback은 발생하지 않았다.
기존 선택파일/수동정책 기능을 유지하며 전체 백업 부족을 숨기지 않는다. native owner·실Agent 연결은 이 업무의 원문 백업 목표와 독립이고 Agent 교체를 위해 백업 복원을 필수로 만들지 않는다.

## 17. r2 교차 검토·registry 부록의 효력

부모 r1 원문 SHA는 `D3B3014E`로 시작하는 작성 지문이며 EOF 빈줄 보정 후 검토 기준은 `4E8423F0445591AC9F47D50FCE04311934ED87D9D993FB546F16D9E2E02FB8D9`다. 이 revision은 Main이 위임한 기술 보완이며 새 채택/제품 GO가 아니다. 과거 부분 registry를 전체 지원으로 승격하지 않는다.

아래 자동 대조표는 실제 `db/migrations/*.sql*`의 행 시작 CREATE TABLE 정적 선언 192개(고유192개)와 `apps/server/modules/backups/*inventory.ts` 27파일의 직접 선언 선택열을 읽은 source 관측이다. SQL/DB 실행0이다. 실제 DB catalog·동적 DDL·후행 ALTER/CHECK/FK/트리거·JSON 내부 원형·조건부 collector의 모든 branch까지 폐쇄한 결과가 아니다. 표의 행 수가 coverage proof는 아니다. 임의 producer/hash 상수로 전체 eligible을 만들지 않는다.

자료군 분류 원칙: 프로젝트 문서/양식/설계는 documents, 대화는 conversations, 지식/헌법은 knowledge, 방법론/계획/임무/역할은 plans, 승인/정책/제어/감사는 decisions, 실행/관측/준비/writer/native/제출은 results, 보관된 실제 bytes는 artifacts다. 공유 commands/receipt/audit는 해당 원자료의 DEPENDENCY_INCLUDED로 한 번 수집하고 각 원참조는 모두 보존한다. 참조만 있고 비밀 없는 원문/codec이 없는 대상은 UNAVAILABLE/생성 차단이다. 원 사용자가 선택하지 않은 자료군은 dependency로 표시한다.

비반출 기본: password/recovery credential·auth/session cookie/CSRF·pairing code/token/digest에 의한 인증수단·DEK/KEK·envelope 비밀번호·CA/키 원문·활성 grant/permit·socket/process handle·파일 실경로·OS 자격증명은 제외한다. digest/공개키/서명이 항상 안전하다고 일괄 판단하지 않는다. 저장 JSON/명령 payload/result/후보 원문은 operation별 exact 투영 검수 전 기본 UNKNOWN/반출 차단이다. 원 actor/client UUID는 비권한 역사 식별자로만 보관한다.

### 17.1 기존 composition의 실제 추가 소비

`apps/server/modules/backups/project-inventory-composition.ts:98~119`는 조건부 SourceRootHistory와 ControlHandoffOwnHistory를 포함한다. `139~145`는 `apps/server/modules/projects/project-baselines.ts:325`의 readDraftHistoryInventory와 `:436`의 readDecisionHistoryInventory를 호출해 FeatureBaselineDraftHistory/FeatureBaselineDecisionHistory를 추가한다. 기본24 목록에 없으나 실제 포함 대상이다.

- FeatureBaselineDraftHistory: baseline_drafts/baseline_draft_versions·관련 원 command/receipt/audit/정확 선택자료·artifact. heads/versions/selectedEvidenceHash·metadataObservationHash와 NOT_STORED/UNVERIFIED 의미를 보존한다. group=plans, 현재 적용/쓰기 권위 복원0.
- FeatureBaselineDecisionHistory: baseline_content_reviews/baseline_heads 및 정확 adoption/review 원행·참조. group=plans, reviews/adoptions/heads·원hash·현재성 미확인·contentConfirmed의 제한 의미를 보존한다.
- SourceRootHistory: source_roots/source_root_versions·정확 원등록/command/receipt/audit 의존성. group=results의 선언 이력이며 OS 경로 관측/권한으로 승격0.
- ControlHandoffOwnHistory: control_handoff_source_requests/summaries/commands/receipts/audits의 본인 범위. group=decisions, 실제어 이전·관측·권한 복원0. 현재 본인 제한을 백업 OWNER라는 이유로 확대하지 않는다.

기존 collector가 hash/metadata만 보관하거나 notCollected를 반환하면 원 payload를 복원했다고 하지 않는다. 새 동일 RR collector는 공개 RC wrapper와 별도 내부 접점을 통해서만 source를 재사용하며 원 observation/isolation 주장을 바꾸지 않는다.

### 17.2 최신 source의 별도 원형·명시 공백

| 실제 DDL 자료 | 후보 포함/의존·codec 근거 | 남은 폐쇄·반출 기준 |
|---|---|---|
| 0037 provider_session_claims/proof_results/revocations | results·원 claim/proof 원형, 원명령/등록·scope·execution 의존 | 실제 provider session/credential·현재 권위 제외. 전체 export codec 미구현 |
| 0039 execution_ownership_* 5표 | results·기존 ownership runtime 계약과 receipt/event/이전head | OS handle/현재소유 권위 제외. 역사payload codec/관계 전수 미완료 |
| 0040 source_content_* 4표 | documents·source request/observation/verification·정책원행 | 실제 source 원문·권한/파일관측 미확인 보존. 미채택 실행범위 자동포함0 |
| 0042 draft_artifact_*·draft_*_intents/quota·adoptions | artifacts/documents·project-creation-draft-inventory 실제선택열 | 미소비 개인초안 전체 접근0. quota/원command와 실제 immutable bytes closure 필요 |
| 0043 project_artifact_exports | decisions/artifacts·과거반출metadata | 반출권한/현재download 재활성화0·원문이 없는 경우 이유보존 |
| 0050 baseline_activations/current/rechecks·approval_candidates | plans/decisions·baseline-inventory+정확 후보/적용hash | candidate payload JSON 비밀투영·이전버전/원소비 전수검산 미완료 |
| 0051 knowledge_share_requests | knowledge·원scope/후보/공유결정 이력 | 타사용자 비공개 지식 자동확대0·공유원문 codec 필요 |
| 0052 notifications/notification_reads | decisions·notification-inventory | 본인알림 범위·원요청/중복읽음 보존 |
| 0053 backup_references/versions/events | decisions·backup-reference-history-inventory | TARGET/KEY/RETENTION/VERIFICATION metadata만·실경로/실키원문0 |
| 0054 installation_resource_* / installation_key_* / root_roles | decisions·backup-installation-resources-v1/installation-resource-store | wrapping 파일/키·lease원문0. 비반출 metadata projection·root역할 역사codec 미완료 |
| 0055 execution_preparation_approval_candidates / 0056 understanding_review_approval_candidates | results/decisions·각 기존 collector 선택열 | 원후보/요청/결정/소비/receipt 정확관계·민감 payload 검수 필요 |
| 0057 capability_reports/evidence / 0058 checkpoint_records | results·현재 capability/checkpoint 원형 | HUMAN 주장·UNVERIFIED/false 보존. checkpoint 실제blob ref/bytes 의존 |
| 0059 project_storage_accounts/reservations | results·원quota kind/plan/part/fence | used/held를 복원 대상 계정에 적용0. 원역사와 실제 새예약 분리 |
| 0060 transfer_preparation_records/versions | plans/results·원기록/이전ref/hash/command | 실제 책임/세션 이전 재개0·export codec 미완료 |
| 0062 execution_material_manifests/materials/proof_bindings | results/artifacts·정확 manifest/원binding | 활성 SEND/permit 비반출·원bytes/nonce/민감명령 투영codec 필요 |
| 0063 backup_policies/versions/approval_candidates | decisions·backup-policy-input/store | 정확7/sourceNONE/4ref·이전/CAS·후보원문 검산. 현재정책 자동복원0 |
| 0065 agent_connections/connection_definition_versions | results·원 정의snapshot/ref/command | 현재 연결자격/실행권 복원0·환경ref closure |
| 0067 definition_capability_reports/evidence | results·등록정의 보고원형/evidence | HUMAN 주장/OS_UNVERIFIED·원등록증빙 제한 보존 |
| 0069 environment_configuration_heads/versions/approval_candidates | results/decisions·environment-configuration-v1·환경원형/승인원문 | 등록최소증빙·원command/소비·Secret metadata만, 실제비밀0 |
| 0070 project_writer_authority_events/heads | results·project-writer-authority-v1 | typed사건/hashchain·원승인/등록·receipt 관계. actualflagsfalse·활성writer권위복원0 |
| 0071 native_preparation_authorities/events | results·native-preparation-authority-v1 | grant/receipt/일회소비·delivery digest/proof의 안전투영. token/permit/capability/원비밀 비반출 |

위는 실제 표/계약 연결 근거이지 실행 registry 등록 완료표가 아니다. 후속 부록의 UNMAPPED/DDL_ONLY·원형미검수 row가 하나라도 필수범위에 있으면 생성은 COVERAGE_INCOMPLETE다. 선택하지 않았다는 이유만으로 필수 command/receipt/FK 의존성을 생략하지 않는다.

## 18. 원본 hash와 REDACTED_HISTORY의 검증 구분

ORIGINAL은 저장당시 정확 source codec/domain의 원 projection bytes로 sourceRef.contentHash를 **재계산**하고 exportHash·raw artifact bytesHash도 각각 검산한다. export DTO의 hash를 source hash라고 부르지 않는다.

REDACTED_HISTORY는 exportHash만 재계산 가능하다. 누락된 원본 전체의 SOURCE_HASH는 재계산 PASS를 발급하지 않는다. sourceReceiptRefs의 고정 원command/receipt/audit와 보관된 원sourceRef/hash를 대조한 결과는 HISTORY_CHAIN에 기록하고 reasonCode=SOURCE_HASH_EVIDENCE_ONLY로 구분한다. 이 reasonCode는 이번 후보에 추가하는 닫힌 report reason이며 기존 wire 확장이 아니다. SOURCE_HASH check의 state는 해당 원본을 검증하지 못했으면 NOT_RUN, reasonCode=SOURCE_REDACTED다. 필수원문이면 FULL_VERIFIED0. 안전한 metadata 역사만 요구하는 명시 profile이 필요하다면 그 profile 자체를 별도 선택으로 둔다. receipt 존재가 원내용을 복구/재계산했다는 뜻은 아니다.

actual artifact reader `apps/server/modules/backups/artifact-readonly-reader.ts` MAX20MiB와 `artifact-byte-verification.ts`의20MiB를 유지한다. 새 bundle ciphertext는 별도10GiB 상한 reader/stream 계약으로 처리하고 기존 artifact reader에10GiB를 전달하거나 상수를 올리지 않는다. 사용자자료 원문blob별20MiB 제한과 전체암호문10GiB 제한은 다른 대상이다. 원복검증 staging에서도 이 구분을 유지한다.

## 19. 새 설치의 외부 암호문 반입 계약 — 신규 결정 delta

목표를 현재설치 생성파일 검증으로 축소하지 않는다. 새 설치에서 외부 bundle을 검증하려면 아래 새 public/storage 계약을 채택해야 한다. 아직 NOT_ADOPTED이며 기존 반출·선택파일 업로드 승인을 자동 이월하지 않는다.

새 operation 후보 `createFullBackupImportIntent`, payload exact `{targetRef,expectedOriginProjectId,registryRef,expectedBytes,expectedSha256,reason}`. 기존 ProjectCommand/HUMAN OWNER·단독제어/현재세대·명시정책·정확 일회승인/원문후보·receiptintent를 재사용하되 이 operation의 권한/승인 소비는 새로 닫는다. expectedBytes는1..10GiB canonical10진, expectedSha256은암호문전체hash다. expectedOriginProjectId는사용자기대값이지원프로젝트의현재권한증명아님. targetRef는보호반입격리대상의정확ref이며임의path/URL0. 새nonce/키발급0.

접수data exact `{status:'FULL_BACKUP_IMPORT_REQUESTED',intentRef,importRef,accepted:true,completed:false}`. 그뒤 POST `/api/v1/projects/:projectId/full-backup-inputs/:intentId/content` 한경로에서 `application/octet-stream` raw ciphertext만받는다. 기존인증/CSRF·현재OWNER/control/명시권한·원intent/command/approvalproof·동일client·기한/fence·독립예약 COMMIT·IO_STARTED COMMIT을검산한뒤단발쓰기한다. 새일반upload token/cookie export0, URLfetch0,압축전송/실행파일추출0. exactContentLength가expectedBytes와다르거나hash불일치는거절하며원시도/held를보존한다. 대기/새시도자동재전송0. 기존120초원기한과target/profile더짧은기한을늘리지않는다.

전용 import 입력 descriptor snapshot exact:
`{schemaVersion:1,kind:'FULL_BACKUP_INPUT_V1',projectId,intentRef,attemptId,source:'EXTERNAL_CIPHERTEXT',expectedOriginProjectId,registryRef,ciphertextBytes,ciphertextHash,targetRef,state:'IMPORTED_UNAUTHENTICATED',createdAt}`.
그ref는이snapshot의canonicalhash이며기존FULL_BACKUP_BUNDLE_V1과구별하는신규namespace다. 내부fileidentity는별도보호저장에만두고publicref에path/key를넣지않는다. 불변publish/sync/readback/hash와완결COMMIT확인후에만이ref를fixedGET으로생산한다. 외부파일명/헤더/개인rawJSON을보호ref로등록하지않는다.

GET `/api/v1/projects/:projectId/full-backup-inputs/:id/versions/:version`는현재보호읽기아래위metadata/ref·현재AVAILABLE/CHANGED/UNAVAILABLE만반환하며rawplaintext0. 새목록은제안하지않는다. 입력은새targetproject에귀속하고origin은원프로젝트UUID로별도보존한다. 다른설치동일원UUID를현재project/member로자동생성하지않는다.

`createRestoreValidationJob` payload는 §9의 exact `{inputRef,validationTargetRef,keyReferenceRef,expectedOriginProjectId,registryRef,reason}`다. inputRef는 typed union의정확namespace FULL_BACKUP_BUNDLE_V1(현재설치기존생성) 또는 FULL_BACKUP_INPUT_V1(새외부반입)만받는다. 현재project의보호ref/실파일bytes를검산하되originProjectId는expected와인증후manifest/header가일치해야한다. 입력암호문길이/hash가맞아도인증·원본진위·복원성공이아니다. 새설치키IMPORT는기존portablekey별도명시동작이며복호화전용제한을보존한다.

반입단계는bounded header의형식/길이검사만할수있고manifest/record/DB/historyparser를호출하지않는다. key선택후GCMfinal/tag/AAD/bodyHash전평문은새소유staging안에서만보관·채택0. 완전인증뒤에만기존검증순서를진행한다. 생성·반입·검증job의실제권한/예약/metadata한도를서로구분하고비밀/원키를반입파일에넣지않는다.

새delta는입력intentoperation/쓰기정책·승인후보·rawciphertextPOST·보호입력고정GET·FULL_BACKUP_INPUT_V1저장·restorepayload변경이다. 이것은사용자선택대상이며Main의단순내부wrapper배치로채택하지않는다. 원 bundle의과거작성자를현재사용자로위장하지않고현재검증주체만새target권한을소비한다.

## 20. 키/nonce·대수의 미정 유지

이번보완은새암호알고리즘/KDF/실키도메인을채택하지않는다. 동일실DEK를keyId/wrappingVersion/alias/import/retry로다른도메인으로만드는것은금지다. 기존0054 lease/wrapping은데이터암호화nonce원장이아니다. 실제키동일성에결박된지속domainproducer·unique nonce원행·전instance사용량·cipher진입전COMMIT확인이구체화될때까지실encrypt차단이다. domain/nonce예약COMMIT불명에는cipher0·원nonce영구소진·새attempt재암호화0을적용하고재시작원조회식별/사용량완결을후속계약으로닫아야한다. source상bool성공으로대체0.

대수는 K=10GiB, U=기존실사용원자료, H=기존held(새job중복산입제외), M=이번미포함metadata실증가, R=동시에존재하는새사본/정리불명예약으로두고 `U+H+M+R≤K`다. R의P/C/V에이미포함된manifest/외피를다시더하지않는다. 별도index/실패사본은정확물리논리소유로추가한다. P≈C≈V≈U라면다른비용전에도4U≤K,즉약2.5GiB에서보수cap에닿는다. 원자료10GiB를동일projectcap안3사본으로처리할수있다고하지않는다.

D5는①이보수한계와nearcap백업불가를선택할지 ②외부bundle/staging의별도유한저장domain/cap을선택할지결정해야한다. 반입10GiB와새검증staging도동일대수에넣는다. 프로젝트논리cap과실disk/WAL/target여유는별도검산이다. 감소전용event/정산공간의사전유한예약과계속held보존중어느원형을쓸지도미정이다. 포화시감소사실을못기록했다고used/held를허위해제0. 독립예약/IO_STARTED COMMIT불명은IO시작0,원예약보존·조회로만전환한다.

## 21. r2 준비도와 변경 범위

기술I1은새설치입력producer/public/storage후보로상세화했고I2는목록전용JobListItem≤8192B·page≤413696B와fixedJobView분리로수정했다. 외부반입/키사용/보호저장·quota선택은채택되지않았다. registry는아래정적대조범위를명확히열거했지만ALTER/동적DDL/모든JSON민감투영·모든이전버전/참조까지의누락0을입증하지못했다. 따라서현재전체sourceWI GO불가·A6eligible선연결0이다. source/read-only조사로더닫을수있는정확기술항목을가짜포트나user질문으로미루지않는다.

문서한개만수정하며제품/SQL/시험/Git/WORK_STATUS·실DB/키/파일/백업/복원/서비스/Agent/컴파일·새QA/세션실행0이다. 정본/source동일UTF8LF바이트로보관한다. 다음부록의rawSQL열명은반출허용목록이아니며민감열은명시투영/제외전채택0이다.

## 22. 실제 DDL 선언 대조 부록
본문 §1~21은 미채택 계약 후보이고 §22~23은 **읽기 조사 증거 부록**이다. 부록의 DDL/선택열/source 지문은 실행 registry, export 허용목록, codec 검증완료, 실제 백업지원의 증거가 아니다. 모든 gate가 해소됐다는 판정은 없으며 단순192행으로 누락0을 발급하지 않는다. 본문과 부록이 충돌하면 더 보수적인 차단을 유지하고 Main이 후속 기술 검토로 해소한다.


CREATE TABLE 192개/고유192개. `DDL_CREATE_COLUMNS`는 정적 초기 선언열이며 후행 ALTER/동적 SQL/JSON 투영은 UNVERIFIED다. 식별자는 조사 근거이며 반출 권한이 아니다.

| 표 | 근거 | CREATE 선언열 | 자료군/제외 후보 | 기존 선택열 근거 | 차단 상태 |
|---|---|---|---|---|---|
| `schema_migrations` | `db/migrations/0000_environment.sql:1` | `id,checksum,applied_at` | `EXCLUDED_INSTALLATION_RUNTIME` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `users` | `db/migrations/0001_projects_access.sql:1` | `id,login_name,normalized_login_name,display_name,status,credential_generation,server_owner,version,created_at,revoked_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `clients` | `db/migrations/0001_projects_access.sql:9` | `id,user_id,label,version,created_at,revoked_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `password_credentials` | `db/migrations/0001_projects_access.sql:14` | `user_id,argon2_phc,credential_generation,changed_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `auth_sessions` | `db/migrations/0001_projects_access.sql:18` | `id,token_digest,user_id,client_id,credential_generation,csrf_digest,created_at,last_seen_at,idle_expires_at,absolute_expires_at,reauth_until,revoked_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `installation_claims` | `db/migrations/0001_projects_access.sql:27` | `installation_id,bootstrap_digest,expires_at,consumed_at,owner_user_id,version` | `EXCLUDED_INSTALLATION_RUNTIME` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `recovery_credentials` | `db/migrations/0001_projects_access.sql:32` | `id,user_id,secret_digest,issued_at,consumed_at,revoked_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `user_invitations` | `db/migrations/0001_projects_access.sql:37` | `id,normalized_login_name,display_name,secret_digest,project_grants_json,expires_at,consumed_by,consumed_at,revoked_at,created_by` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `auth_attempt_windows` | `db/migrations/0001_projects_access.sql:43` | `bucket_kind,bucket_key,window_start,attempt_count,blocked_until,updated_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `auth_actions` | `db/migrations/0001_projects_access.sql:48` | `id,actor_scope,operation,command_id,protected_fingerprint,result_status,safe_result_ref,created_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `auth_audit_events` | `db/migrations/0001_projects_access.sql:53` | `id,server_sequence,subject_ref,action_id,client_ref,operation,outcome,reason_code,recorded_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `projects` | `db/migrations/0001_projects_access.sql:59` | `id,name,purpose,desired_outcome,version,archived_at,created_at,updated_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_drafts` | `db/migrations/0001_projects_access.sql:64` | `id,owner_user_id,client_id,version,step,input_json,consumed_project_id,created_at,updated_at` | `HISTORICAL_PROJECTION_REQUIRED` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `project_members` | `db/migrations/0001_projects_access.sql:73` | `project_id,user_id,participation,version,joined_at,revoked_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_control` | `db/migrations/0001_projects_access.sql:81` | `project_id,actor_id,client_id,generation,version,issued_at,revoked_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_declarations` | `db/migrations/0001_projects_access.sql:87` | `id,draft_id,project_id,version,declared_by,host_label,display_name,path_hint_protected_ref,origin_root_ref,reason,authority,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_baselines` | `db/migrations/0001_projects_access.sql:95` | `id,project_id,version,source_snapshot_ref,content_json,content_hash,created_by,created_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_declaration_versions` | `db/migrations/0001_source_declarations.sql:2` | `id,version,draft_id,draft_version,declared_by,client_id,content_hash,declaration_json,authority,readiness,command_id,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_source_declarations` | `db/migrations/0001_source_declarations.sql:10` | `project_id,declaration_id,declaration_version,created_by,client_id,command_id,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `methodology_definitions` | `db/migrations/0002_methodologies.sql:1` | `id,scope,owner_user_id,project_id,system_code,name,purpose,head_version,created_at` | `plans` | `project-methodology-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `methodology_versions` | `db/migrations/0002_methodologies.sql:14` | `definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by,created_at` | `plans` | `project-methodology-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `methodology_reviews` | `db/migrations/0002_methodologies.sql:24` | `id,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,decided_at` | `plans` | `project-methodology-inventory.ts:19` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `project_methodologies` | `db/migrations/0002_methodologies.sql:32` | `id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by,created_at` | `plans` | `document-inventory.ts:33; methodology-application-inventory.ts:13; project-methodology-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_confirmations` | `db/migrations/0003_document_confirmations.sql:2` | `id,project_id,document_id,version,target_hash,form_ref,review_refs,validation_json,confirmed_by,client_id,command_id,created_at` | `documents` | `document-inventory.ts:30` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_imports` | `db/migrations/0003_document_imports.sql:2` | `id,project_id,original_artifact_id,form_definition_id,form_version,form_hash,candidate_json,content_hash,created_by,client_id,command_id,created_at` | `documents` | `document-inventory.ts:24` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_import_selections` | `db/migrations/0003_document_imports.sql:14` | `id,project_id,import_id,document_id,version,created_by,client_id,command_id,created_at` | `documents` | `document-inventory.ts:25` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_proposals` | `db/migrations/0003_document_proposals.sql:1` | `id,project_id,document_id,base_version,base_hash,body_artifact_id,diff_artifact_id,content_json,proposal_json,content_hash,reason,created_by,client_id,command_id,created_at` | `documents` | `document-inventory.ts:26` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_proposal_selections` | `db/migrations/0003_document_proposals.sql:13` | `id,project_id,proposal_id,document_id,version,created_by,client_id,command_id,created_at` | `documents` | `document-inventory.ts:27` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `authoring_standard_versions` | `db/migrations/0003_documents.sql:2` | `id,version,content_hash,body_utf8,source_approval_json,created_at` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `form_definitions` | `db/migrations/0003_documents.sql:10` | `id,scope,owner_user_id,project_id,form_code,name,head_version,created_at` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `form_versions` | `db/migrations/0003_documents.sql:25` | `definition_id,version,definition_json,content_hash,authoring_standard_id,authoring_standard_version,authoring_standard_hash,authoring_standard_ref,origin_ref_json,created_by,created_at` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `artifacts` | `db/migrations/0003_project_artifacts.sql:1` | `id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,created_by,client_id,command_id,created_at` | `artifacts` | `conversation-inventory.ts:15; document-inventory.ts:23; knowledge-inventory.ts:22; project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `documents` | `db/migrations/0003_project_documents.sql:1` | `id,project_id,title,head_version,confirmed_version,created_by,created_at,updated_at` | `documents` | `document-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_versions` | `db/migrations/0003_project_documents.sql:8` | `project_id,document_id,version,form_definition_id,form_version,form_hash,stage_ref_json,body_artifact_id,title,source_refs_json,content_json,content_hash,sections_json,author_ref_json,validation_json,reason,client_id,command_id,created_at` | `documents` | `document-inventory.ts:21` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_artifact_links` | `db/migrations/0003_project_documents.sql:25` | `project_id,document_id,version,artifact_id,kind` | `documents` | `document-inventory.ts:22` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_version_events` | `db/migrations/0003_project_documents.sql:31` | `id,project_id,document_id,version,event_kind,review_ref,actor_ref,reason,command_id,created_at` | `documents` | `document-inventory.ts:29` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `design_changes` | `db/migrations/0004_design_change_proposals.sql:2` | `id,project_id,version,before_id,before_version,before_hash,proposal_id,content_hash,change_json,created_by,client_id,command_id,created_at` | `documents` | `design-change-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `design_change_impacts` | `db/migrations/0004_design_change_proposals.sql:10` | `id,project_id,version,change_id,change_hash,source_kind,content_hash,impact_json,created_by,client_id,command_id,created_at` | `documents` | `design-change-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `design_items` | `db/migrations/0004_design_index.sql:1` | `id,project_id,design_document_id,document_version,document_hash,local_code,title,anchor,item_hash,item_json,created_by,client_id,command_id,created_at` | `documents` | `design-trace-inventory.ts:14` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `screen_regions` | `db/migrations/0004_design_index.sql:11` | `id,project_id,design_item_id,screen_code,source_document_id,source_version,source_hash,artifact_id,anchor,region_hash,region_json,created_by,client_id,command_id,created_at` | `documents` | `design-trace-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `trace_edges` | `db/migrations/0004_trace_links.sql:1` | `id,project_id,from_kind,from_id,from_version,from_code,to_kind,to_id,to_version,to_code,relation,design_refs,edge_json,edge_hash,reason,created_by,client_id,command_id,created_at` | `documents` | `design-trace-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `work_plan_confirmations` | `db/migrations/0004_work_plan_confirmation.sql:2` | `id,project_id,plan_id,version,target_hash,review_refs,validation_json,confirmed_by,client_id,command_id,created_at` | `plans` | `work-plan-inventory.ts:19` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `work_plans` | `db/migrations/0004_work_plan_drafts.sql:2` | `id,project_id,head_version,confirmed_version,created_by,created_at,updated_at` | `plans` | `work-plan-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `work_plan_versions` | `db/migrations/0004_work_plan_drafts.sql:8` | `project_id,plan_id,version,document_id,document_version,document_hash,design_id,design_version,design_hash,screen_review_refs,content_hash,version_json,created_by,client_id,command_id,created_at` | `plans` | `work-plan-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `plan_tasks` | `db/migrations/0004_work_plan_drafts.sql:24` | `project_id,plan_id,plan_version,task_code,task_type,card_json,card_hash,owner_role` | `plans` | `work-plan-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `plan_dependencies` | `db/migrations/0004_work_plan_drafts.sql:31` | `project_id,plan_id,plan_version,task_code,dependency_task_code,phase` | `plans` | `work-plan-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `conversations` | `db/migrations/0005_conversations.sql:1` | `id,project_id,target_role_ref,head_sequence,created_by,last_client_id,last_command_id,created_at,updated_at` | `conversations` | `conversation-inventory.ts:13` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `conversation_messages` | `db/migrations/0005_conversations.sql:7` | `project_id,conversation_id,sequence,id,author_ref,kind,body_artifact_id,source_refs,reply_to,supersedes_instruction_id,effective_scope,message_json,content_hash,redaction_state,client_id,command_id,recorded_at` | `conversations` | `conversation-inventory.ts:14` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `knowledge_entries` | `db/migrations/0005_knowledge_drafts.sql:1` | `id,project_id,kind,head_version,created_by,client_id,command_id,created_at` | `knowledge` | `knowledge-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `knowledge_versions` | `db/migrations/0005_knowledge_drafts.sql:8` | `project_id,entry_id,version,title,content_artifact_id,content_hash,source_refs,reason,scope_json,related_refs,entry_json,supersedes_version,created_by,client_id,command_id,created_at` | `knowledge` | `knowledge-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `knowledge_events` | `db/migrations/0005_knowledge_drafts.sql:21` | `id,project_id,entry_id,version,kind,reason,actor_ref,approval_ref,target_refs,client_id,command_id,recorded_at` | `knowledge` | `knowledge-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `constitution_applications` | `db/migrations/0005_project_constitutions.sql:2` | `project_id,application_version,content_hash,entry_id,version,confirmation_id,snapshot_json,applied_by,client_id,command_id,created_at` | `knowledge` | `knowledge-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `project_constitutions` | `db/migrations/0005_project_constitutions.sql:11` | `project_id,application_version,application_hash,entry_id,version` | `knowledge` | `knowledge-inventory.ts:21` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `connection_candidates` | `db/migrations/0006_connection_candidates.sql:2` | `id,project_id,kind,head_version,created_by,created_at` | `results` | `connection-candidate-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `connection_candidate_versions` | `db/migrations/0006_connection_candidates.sql:9` | `project_id,candidate_id,version,kind,snapshot_json,content_hash,created_by,client_id,command_id,expires_at,created_at` | `results` | `connection-candidate-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `connectors` | `db/migrations/0006_host_trust_registrations.sql:2` | `id,project_id,owner_user_id,client_id,credential_generation,host_label,host_fingerprint,public_key_spki,connector_version,registration_id,generation,status,created_at,revoked_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `connector_registrations` | `db/migrations/0006_host_trust_registrations.sql:13` | `id,project_id,connector_id,requested_by,client_id,session_id,credential_generation,control_generation,version,state,expected_host_fingerprint,observed_host_fingerprint,code_digest,code_consumed_at,enroll_request_hash,failed_attempts,scope_json,scope_digest,policy_ref,created_command_id,decision_command_id,created_at,expires_at,proofed_at,issued_at,revoked_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `connector_registration_challenges` | `db/migrations/0006_host_trust_registrations.sql:32` | `id,project_id,registration_id,purpose,payload_json,preflight_digest,failed_attempts,created_at,expires_at,consumed_at,proof_signature` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `connector_credentials` | `db/migrations/0006_host_trust_registrations.sql:42` | `id,project_id,connector_id,registration_id,generation,token_digest,scope,scope_digest,issued_at,expires_at,revoked_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `source_read_grants` | `db/migrations/0008_source_read_observation.sql:3` | `project_id,id,version,source_root_id,source_root_version,source_root_hash,connector_id,connector_generation,registration_id,registration_version,requested_by,client_id,session_id,credential_generation,control_generation,policy_ref,scope_json,scope_digest,created_command_id,created_at,expires_at,revoked_at,revoke_command_id,exchange_failures` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_read_challenges` | `db/migrations/0008_source_read_observation.sql:25` | `id,project_id,grant_id,preflight_digest,payload_json,created_at,expires_at,consumed_at,proof_signature,failed_attempts` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_read_credentials` | `db/migrations/0008_source_read_observation.sql:34` | `id,project_id,grant_id,connector_id,connector_generation,token_digest,scope,scope_digest,issued_at,expires_at,revoked_at,consumed_at` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `source_snapshots` | `db/migrations/0008_source_read_observation.sql:46` | `project_id,id,version,grant_id,report_command_id,source_root_id,source_root_version,connector_id,generation,scope_digest,report_json,content_hash,signature,observed_at,finished_at,received_at,evidence_class,os_verification` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_roots` | `db/migrations/0008_source_root_registry.sql:2` | `project_id,id,head_version,created_by,client_id,created_at` | `results` | `source-root-history-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `source_root_versions` | `db/migrations/0008_source_root_registry.sql:9` | `project_id,root_id,version,content_hash,declaration_json,status,authority,readiness,reason,actor_id,client_id,command_id,connector_id,created_at` | `results` | `source-root-history-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `permission_policies` | `db/migrations/0011_authorization.sql:1` | `id,project_id,head_version,created_by,created_at` | `decisions` | `permission-policy-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `permission_policy_versions` | `db/migrations/0011_authorization.sql:6` | `project_id,policy_id,version,rules_json,content_hash,reason,review_refs,created_by,created_at` | `decisions` | `permission-policy-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `commands` | `db/migrations/0011_authorization.sql:16` | `id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; assignment-inventory.ts:19; backup-reference-history-inventory.ts:11; baseline-inventory.ts:16; connection-candidate-inventory.ts:11; context-preparation-inventory.ts:30; design-change-inventory.ts:19; design-trace-inventory.ts:17; execution-control-inventory.ts:26; knowledge-inventory.ts:23; methodology-application-inventory.ts:14; notification-inventory.ts:17; permission-policy-inventory.ts:11; project-control-ledger-inventory.ts:10; project-creation-draft-inventory.ts:11; project-methodology-inventory.ts:21; responsible-session-inventory.ts:23; result-review-history-inventory.ts:19; result-submission-inventory.ts:14; source-root-history-inventory.ts:11; stage-budget-inventory.ts:27; understanding-permit-inventory.ts:31; work-plan-inventory.ts:21` | `PROJECTION_UNVERIFIED` |
| `approval_requests` | `db/migrations/0011_authorization.sql:32` | `id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; backup-reference-history-inventory.ts:11; context-preparation-inventory.ts:29; notification-inventory.ts:16; responsible-session-inventory.ts:22; stage-budget-inventory.ts:26; understanding-permit-inventory.ts:29` | `PROJECTION_UNVERIFIED` |
| `approval_decisions` | `db/migrations/0011_authorization.sql:42` | `id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; backup-reference-history-inventory.ts:11; context-preparation-inventory.ts:27; responsible-session-inventory.ts:21; stage-budget-inventory.ts:25; understanding-permit-inventory.ts:28` | `PROJECTION_UNVERIFIED` |
| `approval_consumptions` | `db/migrations/0011_authorization.sql:50` | `id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version,consumed_at` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; backup-reference-history-inventory.ts:11; context-preparation-inventory.ts:26; responsible-session-inventory.ts:20; stage-budget-inventory.ts:24; understanding-permit-inventory.ts:27` | `PROJECTION_UNVERIFIED` |
| `authorization_receipts` | `db/migrations/0011_authorization.sql:58` | `id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; assignment-inventory.ts:20; backup-reference-history-inventory.ts:11; connection-candidate-inventory.ts:11; context-preparation-inventory.ts:31; execution-control-inventory.ts:27; knowledge-inventory.ts:25; notification-inventory.ts:18; permission-policy-inventory.ts:11; project-control-ledger-inventory.ts:10; project-creation-draft-inventory.ts:11; responsible-session-inventory.ts:24; result-review-history-inventory.ts:20; result-submission-inventory.ts:15; source-root-history-inventory.ts:11; stage-budget-inventory.ts:28; understanding-permit-inventory.ts:32` | `PROJECTION_UNVERIFIED` |
| `audit_events` | `db/migrations/0011_authorization.sql:70` | `project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of` | `DEPENDENCY_REDACTION_REQUIRED` | `approval-history-inventory.ts:10; assignment-inventory.ts:21; backup-reference-history-inventory.ts:11; connection-candidate-inventory.ts:11; context-preparation-inventory.ts:32; execution-control-inventory.ts:28; knowledge-inventory.ts:24; methodology-application-inventory.ts:15; notification-inventory.ts:19; permission-policy-inventory.ts:11; project-control-ledger-inventory.ts:10; project-creation-draft-inventory.ts:11; project-methodology-inventory.ts:22; responsible-session-inventory.ts:25; result-review-history-inventory.ts:21; result-submission-inventory.ts:16; source-root-history-inventory.ts:11; stage-budget-inventory.ts:29; understanding-permit-inventory.ts:33; work-plan-inventory.ts:22` | `PROJECTION_UNVERIFIED` |
| `draft_audit_events` | `db/migrations/0011_authorization.sql:82` | `draft_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,operation,outcome,reason_code,recorded_at` | `DEPENDENCY_REDACTION_REQUIRED` | `project-creation-draft-inventory.ts:11` | `PROJECTION_UNVERIFIED` |
| `project_events` | `db/migrations/0011_authorization.sql:90` | `project_id,server_sequence,event_id,kind,target_ref,command_id,safe_payload_json,recorded_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `delivery_outbox` | `db/migrations/0011_authorization.sql:97` | `id,project_id,command_id,kind,destination_ref,payload_ref,scope_digest,state,attempt_count,next_attempt_at,last_error_code` | `DEPENDENCY_REDACTION_REQUIRED` | `execution-control-inventory.ts:25` | `PROJECTION_UNVERIFIED` |
| `draft_methodology_reviews` | `db/migrations/0011_draft_method_reviews.sql:1` | `id,draft_id,version,graph_hash,graph_json,review_refs,validation_json,decided_by,client_id,command_id,decided_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `content_reviews` | `db/migrations/0011_user_common_content_reviews.sql:1` | `id,scope_kind,scope_id,owner_user_id,project_id,draft_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id,created_at` | `results` | `document-inventory.ts:28; knowledge-inventory.ts:19; project-methodology-inventory.ts:18; work-plan-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `form_reviews` | `db/migrations/0011_user_common_content_reviews.sql:20` | `id,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,client_id,command_id,decided_at` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `user_common_audit_events` | `db/migrations/0011_user_common_control.sql:14` | `owner_user_id,scope_kind,server_sequence,event_id,client_id,command_id,operation_id,operation,target_ref,outcome,reason_code,recorded_at` | `HISTORICAL_PROJECTION_REQUIRED` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `assignment_drafts` | `db/migrations/0012_assignment_drafts.sql:2` | `project_id,id,head_version,created_by,client_id,created_at,updated_at` | `plans` | `assignment-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `assignment_draft_versions` | `db/migrations/0012_assignment_drafts.sql:9` | `project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id,created_at` | `plans` | `assignment-inventory.ts:16; context-preparation-inventory.ts:24` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `assignment_content_reviews` | `db/migrations/0013_assignment_confirmation.sql:2` | `project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id,created_at` | `plans` | `assignment-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `assignment_versions` | `db/migrations/0013_assignment_confirmation.sql:10` | `project_id,assignment_id,version,content_hash,version_json,created_by,client_id,command_id,confirmation_id,created_at` | `plans` | `assignment-inventory.ts:18; context-preparation-inventory.ts:23; responsible-session-inventory.ts:19` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `context_bundles` | `db/migrations/0014_context_preparation.sql:2` | `project_id,id,version,assignment_id,assignment_version,assignment_hash,assignment_ref,baseline_refs,budget_ref,manifest_json,request_payload,content_hash,created_by,client_id,command_id,created_at` | `plans` | `context-preparation-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `context_items` | `db/migrations/0014_context_preparation.sql:12` | `project_id,bundle_id,bundle_version,item_id,category,required,source_ref,source_hash,included_state,reason,delivery_parts,issue` | `plans` | `context-preparation-inventory.ts:21` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `baseline_drafts` | `db/migrations/0015_project_baselines.sql:2` | `project_id,id,head_version,created_by,client_id,created_at,updated_at` | `plans` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `baseline_draft_versions` | `db/migrations/0015_project_baselines.sql:9` | `project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id,created_at` | `plans` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `baseline_content_reviews` | `db/migrations/0015_project_baselines.sql:19` | `project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id,created_at` | `plans` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `baseline_heads` | `db/migrations/0015_project_baselines.sql:49` | `project_id,baseline_id,baseline_version,baseline_hash` | `plans` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_roles` | `db/migrations/0016_execution_preparation.sql:2` | `project_id,role_id,version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `plans` | `responsible-session-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `agent_sessions` | `db/migrations/0016_execution_preparation.sql:12` | `project_id,session_id,version,role_id,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `responsible-session-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `role_bindings` | `db/migrations/0016_execution_preparation.sql:22` | `project_id,binding_id,version,role_id,session_id,assignment_id,assignment_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `plans` | `context-preparation-inventory.ts:25; responsible-session-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_preparations` | `db/migrations/0016_execution_preparation.sql:185` | `project_id,id,version,assignment_id,assignment_version,binding_id,binding_version,bundle_id,bundle_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `context-preparation-inventory.ts:22` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `limit_policy_versions` | `db/migrations/0017_execution_authority.sql:3` | `project_id,policy_id,version,content_hash,snapshot_json,scope_json,created_by,client_id,command_id,created_at` | `results` | `stage-budget-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `usage_reservations` | `db/migrations/0017_execution_authority.sql:156` | `project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,policy_id,policy_version` | `results` | `execution-control-inventory.ts:24; stage-budget-inventory.ts:21; understanding-permit-inventory.ts:25` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `executions` | `db/migrations/0017_execution_authority.sql:170` | `project_id,id,generation,transport,state,created_by,client_id,command_id,created_at` | `results` | `execution-control-inventory.ts:19` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_grants` | `db/migrations/0017_execution_authority.sql:178` | `project_id,id,version,execution_id,generation,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `execution-control-inventory.ts:20; observation-inventory.ts:20; stage-budget-inventory.ts:23; understanding-permit-inventory.ts:24` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `writer_claims` | `db/migrations/0017_execution_authority.sql:186` | `project_id,id,execution_id,generation,grant_id,grant_version,scope_json,expires_at,ownership_state,created_command_id,issued_at,reclaimed_at` | `results` | `execution-control-inventory.ts:21` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_commands` | `db/migrations/0017_execution_authority.sql:197` | `project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id,created_at` | `results` | `execution-control-inventory.ts:22; observation-inventory.ts:21; stage-budget-inventory.ts:22; understanding-permit-inventory.ts:23` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_credentials` | `db/migrations/0018_execution_observation.sql:2` | `project_id,id,version,grant_id,grant_version,credential_generation,content_hash,snapshot_json` | `EXCLUDED_AUTH_SECRET` | `NO_LITERAL_SELECTOR` | `EXCLUDED_REVIEW_REQUIRED` |
| `execution_challenges` | `db/migrations/0018_execution_observation.sql:8` | `project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json,request_id,client_nonce,server_nonce` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_receipts` | `db/migrations/0018_execution_observation.sql:20` | `project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json` | `results` | `observation-inventory.ts:19; understanding-permit-inventory.ts:26` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_observations` | `db/migrations/0018_execution_observation.sql:228` | `project_id,execution_id,generation,id,version,event_sequence,grant_id,grant_version,content_hash,snapshot_json,event_id` | `results` | `observation-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_acknowledgements` | `db/migrations/0018_execution_observation.sql:237` | `project_id,execution_id,generation,id,version,grant_id,grant_version,content_hash,snapshot_json` | `results` | `observation-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_observation_results` | `db/migrations/0018_execution_observation.sql:327` | `project_id,execution_id,generation,proof_result_id,proof_result_version,ack_id,ack_version,content_hash,snapshot_json` | `results` | `observation-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_start_permits` | `db/migrations/0018_execution_observation.sql:369` | `project_id,execution_id,generation,id,version,proof_result_id,proof_result_version,content_hash,snapshot_json` | `results` | `understanding-permit-inventory.ts:21` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `understanding_reviews` | `db/migrations/0019_understanding_reviews.sql:4` | `project_id,execution_id,generation,id,version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `understanding-permit-inventory.ts:20` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_grant_revocations` | `db/migrations/0022_execution_grant_revocation.sql:3` | `project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,snapshot_json,created_by,client_id,created_command_id,created_at` | `results` | `execution-control-inventory.ts:23` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `execution_instruction_permits` | `db/migrations/0024_execution_instruction_permits.sql:4` | `project_id,execution_id,generation,id,version,command_id,command_record_id,command_record_version,grant_id,grant_version,reservation_id,reservation_version,proof_result_id,proof_result_version,envelope_hash,content_hash,snapshot_json` | `results` | `understanding-permit-inventory.ts:22` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `result_submissions` | `db/migrations/0025_result_submissions.sql:3` | `project_id,id,execution_id,generation,assignment_ref,execution_ref,manifest_ref,manifest_hash,submission_state,submitted_by,client_id,command_id,content_hash,snapshot_json,submitted_at` | `results` | `result-review-history-inventory.ts:18; result-submission-inventory.ts:13` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `result_criteria_versions` | `db/migrations/0026_result_review_criteria.sql:3` | `project_id,criteria_id,version,assignment_ref,assignment_id,assignment_version,content_hash,criteria_json,input_json,created_by,client_id,command_id,created_at` | `results` | `result-review-history-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `result_reviews` | `db/migrations/0027_result_reviews.sql:3` | `project_id,id,result_id,criteria_id,criteria_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `result-review-history-inventory.ts:16` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `result_rework_drafts` | `db/migrations/0028_result_rework_drafts.sql:3` | `project_id,id,result_id,review_id,binding_id,binding_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at` | `results` | `result-review-history-inventory.ts:17` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_source_links` | `db/migrations/0032_document_source_links.sql:4` | `project_id,id,document_id,version,source_root_id,relative_path,source_snapshot_ref,blob_hash,link_version,state,current_event_id,linked_at,updated_at` | `documents` | `document-inventory.ts:31` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `document_source_link_events` | `db/migrations/0032_document_source_links.sql:15` | `id,project_id,link_id,link_version,content_hash,snapshot_json,command_id,created_at` | `documents` | `document-inventory.ts:32` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `work_plan_approval_candidates` | `db/migrations/0035_work_plan_draft_approval.sql:3` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,target_ref,created_by,client_id,control_generation,policy_ref,created_at` | `plans` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `stage_runs` | `db/migrations/0036_stage_queue.sql:2` | `project_id,id,sequence,input_json,created_by,client_id,command_id,created_at` | `results` | `stage-budget-inventory.ts:18` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `queue_requests` | `db/migrations/0036_stage_queue.sql:9` | `project_id,request_id,version,sequence,content_hash,snapshot_json,command_id` | `results` | `stage-budget-inventory.ts:19` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `provider_session_claims` | `db/migrations/0037_provider_session_claims.sql.pending:23` | `project_id,claim_id,version,execution_id,generation,command_id,command_record_id,command_record_version,agent_session_id,agent_session_version,grant_id,grant_version,original_proof_result_id,original_proof_result_version,permit_id,permit_version,start_permit_id,instruction_permit_id,parent_thread_claim_id,parent_thread_claim_version,kind,request_id_digest,event_key,content_hash,snapshot_json,recorded_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `provider_session_claim_proof_results` | `db/migrations/0037_provider_session_claims.sql.pending:50` | `project_id,execution_id,generation,proof_result_id,proof_result_version,claim_id,claim_version,body_hash,receipt_json` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `provider_session_claim_revocations` | `db/migrations/0037_provider_session_claims.sql.pending:60` | `project_id,id,version,claim_id,claim_version,grant_revocation_id,grant_revocation_version,content_hash,snapshot_json,recorded_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_ownership_events` | `db/migrations/0039_ownership_authority.sql.pending:5` | `project_id,execution_id,execution_generation,event_id,version,sequence,project_sequence,content_hash,snapshot_json,candidate_anchor_json,request_id,kind,previous_event_id,previous_event_version,previous_event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_ownership_observations` | `db/migrations/0039_ownership_authority.sql.pending:25` | `project_id,execution_id,execution_generation,observation_id,version,request_id,content_hash,snapshot_json,accepted_event_ref,nonce_digest,request_version,request_hash,accepted_event_id,accepted_event_version,accepted_event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_ownership_anchors` | `db/migrations/0039_ownership_authority.sql.pending:44` | `project_id,execution_id,execution_generation,anchor_id,version,content_hash,snapshot_json,preparation_event_ref,adoption_event_ref,preparation_event_id,preparation_event_version,preparation_event_hash,adoption_event_id,adoption_event_version,adoption_event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_ownership_bindings` | `db/migrations/0039_ownership_authority.sql.pending:62` | `project_id,execution_id,execution_generation,binding_id,version,command_id,anchor_ref,attempt_ref,permit_ref,binding_event_ref,content_hash,snapshot_json,anchor_id,anchor_version,anchor_hash,attempt_id,attempt_version,permit_id,permit_version,binding_event_id,binding_event_version,binding_event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_ownership_heads` | `db/migrations/0039_ownership_authority.sql.pending:77` | `project_id,execution_id,execution_generation,id,head_generation,content_hash,snapshot_json,anchor_id,anchor_version,anchor_hash,current_event_id,current_event_version,current_event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_content_policy_events` | `db/migrations/0040_source_content_hash.sql.pending:4` | `project_id,id,version,sequence,subject_user_id,disposition,snapshot_json,content_hash,previous_ref,management_command_id,recorded_at,expires_at,previous_id,previous_version,previous_hash` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_content_requests` | `db/migrations/0040_source_content_hash.sql.pending:91` | `project_id,id,version,scope_json,scope_digest,created_command_id,requested_by,client_id,credential_generation,control_generation,source_root_id,source_root_version,connector_id,registration_id,created_at,expires_at,updated_at,content_policy_id,content_policy_version,content_policy_hash,state,preflight_json,preflight_digest,challenge_json,challenge_issued_at,challenge_expires_at,proof_signature,exchange_failures,credential_token_digest,credential_scope,credential_issued_at,credential_expires_at,observation_request_ref,observation_nonce_digest,permit_json,report_consumed_at,report_consumed_command_id,revoked_at,revoke_command_id` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_content_observations` | `db/migrations/0040_source_content_hash.sql.pending:428` | `project_id,id,version,request_id,request_version,scope_digest,report_command_id,report_json,content_hash,signature,observed_at,finished_at,received_at,evidence_class,os_verification` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `source_content_verifications` | `db/migrations/0040_source_content_hash.sql.pending:659` | `project_id,id,version,observation_id,observation_version,observation_hash,target_index,relative_path,document_id,document_version,document_hash,observer_implementation_ref,decision,verified_at,expires_at,previous_ref,snapshot_json,content_hash,previous_id,previous_version,previous_hash` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `control_handoff_source_requests` | `db/migrations/0041_control_handoff_source.sql.pending:60` | `project_id,id,version,content_hash,snapshot_json,metadata_json,requested_by,client_id,source_command_id,created_at,expires_at` | `decisions` | `control-handoff-history-inventory.ts:8` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `control_handoff_source_summaries` | `db/migrations/0041_control_handoff_source.sql.pending:85` | `project_id,request_id,request_version,request_hash,version,content_hash,body_json,metadata_json,source_command_id,observed_at,valid_until` | `decisions` | `control-handoff-history-inventory.ts:8` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `control_handoff_source_commands` | `db/migrations/0041_control_handoff_source.sql.pending:108` | `command_id,project_id,operation,actor_id,client_id,request_id,request_version,request_hash,summary_version,summary_hash,base_control_json,command_json,command_hash,payload_hash,created_at` | `decisions` | `control-handoff-history-inventory.ts:8` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `control_handoff_source_receipts` | `db/migrations/0041_control_handoff_source.sql.pending:140` | `command_id,project_id,body_json` | `decisions` | `control-handoff-history-inventory.ts:8` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `control_handoff_source_audits` | `db/migrations/0041_control_handoff_source.sql.pending:146` | `command_id,project_id,body_json` | `decisions` | `control-handoff-history-inventory.ts:8` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `fn01_owner_quota` | `db/migrations/0042_draft_artifact_storage.sql.pending:3` | `owner_id,reserved_bytes,reserved_count` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `draft_upload_intents` | `db/migrations/0042_draft_artifact_storage.sql.pending:8` | `id,draft_id,actor_id,client_id,external_command_id,expected_version,request_hash,request_json,artifact_id,server_command_id,receipt_id,operation_id,ref_json,staging_key,final_key,state,attempt,result_json,created_at` | `results` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `draft_artifact_selection_versions` | `db/migrations/0042_draft_artifact_storage.sql.pending:19` | `draft_id,draft_version,refs_json,snapshot_hash,command_id,receipt_id` | `results` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `draft_artifact_selections` | `db/migrations/0042_draft_artifact_storage.sql.pending:26` | `draft_id,draft_version,artifact_id,upload_intent_id,ordinal,ref_json` | `results` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `draft_creation_intents` | `db/migrations/0042_draft_artifact_storage.sql.pending:33` | `id,draft_id,actor_id,client_id,external_command_id,expected_version,request_hash,request_json,target_project_id,refs_json,sources_json,selection_hash,state,attempt,project_command_id,result_json,created_at` | `results` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `draft_artifact_quota_reservations` | `db/migrations/0042_draft_artifact_storage.sql.pending:46` | `id,owner_id,upload_intent_id,creation_intent_id,held_bytes,held_count` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `fn01_project_quota` | `db/migrations/0042_draft_artifact_storage.sql.pending:54` | `project_id,reserved_bytes,creation_intent_id` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `draft_artifact_adoptions` | `db/migrations/0042_draft_artifact_storage.sql.pending:55` | `artifact_id,upload_intent_id,original_command_id,draft_id,draft_version,ref_json,source_key,target_key,project_id,creation_intent_id,create_command_id,actor_id,client_id,adopted_at` | `results` | `project-creation-draft-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `draft_artifact_intent_events` | `db/migrations/0042_draft_artifact_storage.sql.pending:67` | `id,upload_intent_id,creation_intent_id,state,attempt,recorded_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_artifact_exports` | `db/migrations/0043_project_artifact_exports.sql.pending:26` | `id,project_id,document_id,document_version,document_content_hash,artifact_id,artifact_content_hash,actor_id,client_id,command_id,manifest_json,content_hash,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `design_activation_approval_candidates` | `db/migrations/0050_design_baseline_activations.sql.pending:3` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,target_ref,baseline_refs,created_by,client_id,control_generation,policy_ref,created_at` | `documents` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `baseline_activations` | `db/migrations/0050_design_baseline_activations.sql.pending:12` | `project_id,id,generation,content_hash,snapshot_json,previous_activation_id,command_id,approval_consumption_id,created_by,client_id,created_at` | `plans` | `baseline-inventory.ts:13` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `baseline_activation_current` | `db/migrations/0050_design_baseline_activations.sql.pending:22` | `project_id,activation_id,activation_ref` | `plans` | `baseline-inventory.ts:14` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `baseline_activation_rechecks` | `db/migrations/0050_design_baseline_activations.sql.pending:26` | `project_id,activation_id,plan_id,plan_version,plan_hash,task_code,impact_ref` | `plans` | `baseline-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `knowledge_share_requests` | `db/migrations/0051_knowledge_share_requests.sql.pending:3` | `project_id,id,version,state,content_hash,snapshot_json,request_json,created_by,client_id,control_generation,policy_ref,command_id,created_at` | `knowledge` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `notifications` | `db/migrations/0052_approval_in_app_notifications.sql.pending:3` | `id,project_id,source_command_id,approval_request_id,request_version,request_content_hash,recipient_user_id,event_kind,channel,severity,reason_code,delivery_state,created_at,content_hash` | `decisions` | `notification-inventory.ts:14` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `notification_reads` | `db/migrations/0052_approval_in_app_notifications.sql.pending:17` | `project_id,notification_id,recipient_user_id,client_id,command_id,notification_content_hash,read_at` | `decisions` | `notification-inventory.ts:15` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `backup_references` | `db/migrations/0053_backup_references.sql.pending:4` | `project_id,id,kind,head_version,created_by,created_at` | `decisions` | `backup-reference-history-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `backup_reference_versions` | `db/migrations/0053_backup_references.sql.pending:11` | `project_id,reference_id,version,snapshot_json,content_hash,previous_version,previous_hash,actor_id,client_id,command_id,created_at` | `decisions` | `backup-reference-history-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `backup_reference_events` | `db/migrations/0053_backup_references.sql.pending:24` | `project_id,id,reference_id,reference_version,reference_hash,event_kind,reason,actor_id,client_id,command_id,created_at,version,snapshot_json,content_hash` | `decisions` | `backup-reference-history-inventory.ts:11` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `installation_resource_intents` | `db/migrations/0054_backup_installation_resources.sql.pending:3` | `project_id,id,actor_id,client_id,session_id,command_id,authorization_receipt_id,scope_digest,state,process_id,result_ref,snapshot_json,content_hash,created_at,expires_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_resources` | `db/migrations/0054_backup_installation_resources.sql.pending:13` | `project_id,id,kind,head_version,installation_id,slot_id,created_by,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_resource_versions` | `db/migrations/0054_backup_installation_resources.sql.pending:15` | `project_id,resource_id,version,origin_intent_id,command_id,actor_id,client_id,snapshot_json,content_hash,probe_json,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_resource_events` | `db/migrations/0054_backup_installation_resources.sql.pending:20` | `project_id,id,intent_id,resource_id,process_id,event_kind,actor_id,client_id,command_id,snapshot_json,content_hash,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_key_failure_limits` | `db/migrations/0054_backup_installation_resources.sql.pending:22` | `project_id,bucket_kind,bucket_key,failures,window_started_at,blocked_until` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_key_attempts` | `db/migrations/0054_backup_installation_resources.sql.pending:23` | `id,project_id,actor_id,client_id,session_id,key_id,created_at,state,outcome` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_key_wrappings` | `db/migrations/0054_backup_installation_resources.sql.pending:26` | `project_id,resource_id,resource_version,key_id,key_version,wrapping_version,origin_intent_id,command_id,actor_id,client_id,envelope_hash,file_id,file_identity_json,snapshot_json,content_hash,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_key_states` | `db/migrations/0054_backup_installation_resources.sql.pending:30` | `project_id,resource_id,resource_version,key_id,lease_generation,state,copy_confirmed,audit_state,origin_intent_id,command_id,created_at,unlocked_until,updated_at,confirmed_at,confirmation_intent_id,last_intent_id,lease_owner_actor_id,lease_owner_client_id,lease_owner_session_id,control_generation` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_root_roles` | `db/migrations/0054_backup_installation_resources.sql.pending:91` | `installation_id,device,inode,purpose,first_project_id,first_intent_id,first_process_id,profile_ref,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `installation_key_state_history` | `db/migrations/0054_backup_installation_resources.sql.pending:389` | `project_id,resource_id,resource_version,event_id,actor_id,client_id,session_id,previous_state,next_state,created_at` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_preparation_approval_candidates` | `db/migrations/0055_execution_preparation_one_time_approval.sql.pending:3` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,created_at` | `results` | `context-preparation-inventory.ts:28` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `understanding_review_approval_candidates` | `db/migrations/0056_understanding_review_one_time_approval.sql.pending:3` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,command_hash,created_at` | `results` | `understanding-permit-inventory.ts:30` | `ALTER_JSON_CODEC_UNVERIFIED` |
| `capability_reports` | `db/migrations/0057_capability_reports_human_claim.sql.pending:2` | `id,project_id,version,connection_id,connection_version,connection_hash,environment_id,environment_version,environment_hash,claim_json,claim_hash,snapshot_json,content_hash,supersedes_id,supersedes_version,supersedes_hash,created_by,client_id,command_id,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `capability_report_evidence` | `db/migrations/0057_capability_reports_human_claim.sql.pending:19` | `project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `checkpoint_records` | `db/migrations/0058_checkpoint_records.sql.pending:3` | `project_id,id,assignment_id,assignment_version,assignment_hash,previous_id,previous_hash,content_hash,snapshot_json,record_text,created_by,client_id,command_id,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_storage_accounts` | `db/migrations/0059_project_storage_quota.sql.pending:3` | `project_id,schema_version,coverage_state,creation_intent_id,creation_command_id,initial_manifest_json,initial_manifest_hash,used_bytes,held_bytes,generation,created_at,updated_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_storage_reservations` | `db/migrations/0059_project_storage_quota.sql.pending:16` | `id,project_id,actor_id,client_id,external_command_id,operation,command_hash,part_key,part_kind,plan_json,plan_hash,reserved_bytes,settled_bytes,phase,start_fence,authorized_until,server_command_id,authorization_receipt_id,scope_digest,created_at,started_at,settled_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `transfer_preparation_records` | `db/migrations/0060_transfer_preparation_records.sql.pending:3` | `id,project_id,creator_user_id,creator_client_id,version,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `transfer_preparation_record_versions` | `db/migrations/0060_transfer_preparation_records.sql.pending:8` | `record_id,project_id,version,snapshot_json,content_hash,command_id,policy_ref_json,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_material_manifests` | `db/migrations/0062_execution_material_registration.sql.pending:2` | `project_id,id,version,execution_id,generation,grant_id,grant_version,credential_generation,command_id,created_command_id,content_hash,snapshot_json` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_materials` | `db/migrations/0062_execution_material_registration.sql.pending:11` | `project_id,id,version,manifest_id,manifest_version,execution_id,generation,grant_id,grant_version,credential_generation,command_id,command_record_id,command_record_version,created_command_id,content_hash,snapshot_json` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `execution_material_proof_bindings` | `db/migrations/0062_execution_material_registration.sql.pending:22` | `project_id,proof_result_id,proof_result_version,execution_id,generation,grant_id,grant_version,credential_generation,material_id,material_version,content_hash,snapshot_json` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `backup_policies` | `db/migrations/0063_backup_policies.sql.pending:4` | `project_id,id,head_version` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `backup_policy_versions` | `db/migrations/0063_backup_policies.sql.pending:9` | `project_id,policy_id,version,content_hash,snapshot_json,previous_ref,command_id,client_command_id,created_by,client_id,created_at,projection_json` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `backup_policy_approval_candidates` | `db/migrations/0063_backup_policies.sql.pending:21` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,projection_json` | `decisions` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `agent_connections` | `db/migrations/0065_connection_definitions.sql.pending:2` | `id,project_id,head_version,created_by,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `connection_definition_versions` | `db/migrations/0065_connection_definitions.sql.pending:7` | `project_id,connection_id,version,definition_json,canonical_json,content_hash,canonical_bytes,created_by,client_id,command_id,request_json,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `definition_capability_reports` | `db/migrations/0067_definition_capability_reports.sql.pending:4` | `id,project_id,version,connection_id,connection_version,connection_hash,environment_id,environment_version,environment_hash,claim_json,claim_hash,snapshot_json,content_hash,supersedes_id,supersedes_version,supersedes_hash,created_by,client_id,command_id,created_at,request_json,canonical_bytes` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `definition_capability_report_evidence` | `db/migrations/0067_definition_capability_reports.sql.pending:19` | `project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `environment_configuration_heads` | `db/migrations/0069_environment_configuration.sql.pending:3` | `project_id,kind,id,head_version,created_by,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `environment_configuration_versions` | `db/migrations/0069_environment_configuration.sql.pending:10` | `project_id,kind,id,version,snapshot_json,content_hash,canonical_json,canonical_bytes,evidence_json,evidence_bytes,request_json,created_by,client_id,command_id,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `environment_approval_candidates` | `db/migrations/0069_environment_configuration.sql.pending:466` | `project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,projection_json,canonical_bytes,created_at` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_writer_authority_events` | `db/migrations/0070_project_writer_authority.sql.pending:4` | `project_id,id,version,authority_epoch,sequence,kind,previous_ref,content_hash,payload_json,at,expires_at,lease_id,execution_id,execution_generation,subject_json,registration_ref,host_fingerprint,source_scopes_json,scope_hash,command_ref,authorization_receipt_ref,audit_ref,request_ref,nonce_digest,previous_id,previous_version,previous_hash,request_id,request_version,request_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `project_writer_authority_heads` | `db/migrations/0070_project_writer_authority.sql.pending:22` | `project_id,id,authority_epoch,head_generation,current_event_ref,phase,lease_id,execution_id,execution_generation,registration_ref,scope_hash,expires_at,content_hash,event_id,event_version,event_hash` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `native_preparation_authorities` | `db/migrations/0071_native_preparation_authority.sql.pending:3` | `project_id,id,version,content_hash,snapshot_json,intent_id,intent_hash,intent_json,credential_digest,server_command_id,lease_id,canonical_bytes` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |
| `native_preparation_authority_events` | `db/migrations/0071_native_preparation_authority.sql.pending:10` | `project_id,id,version,authority_id,project_sequence,sequence,previous_ref,content_hash,snapshot_json,canonical_bytes,kind` | `results` | `NO_LITERAL_SELECTOR` | `DDL_ONLY_UNMAPPED` |

## 23. 실제 collector 선택열 근거 부록

아래 파일은 모두 `apps/server/modules/backups/` 아래다. 직접 선언 선택열은 source 근거이며 안전한 완성 export DTO가 아니다. 동적 query/수입 codec은 별도 폐쇄가 필요하다. payload/result/command/candidate 열은 operation별 비밀 투영 검수 전 차단이다.

### `approval-history-inventory.ts`

`collectApprovalHistoryInventory`; SHA256 `6DC5C43D7BC75FC1735C9ED41899EC60D1F7ABFDFCA738E1903D67BCD70A9101`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/approval-history-inventory.ts:10` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/approval-history-inventory.ts:10` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/approval-history-inventory.ts:10` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref received_at completed_at operation_id request_hash` | `apps/server/modules/backups/approval-history-inventory.ts:10` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/approval-history-inventory.ts:10` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/approval-history-inventory.ts:10` |

### `assignment-inventory.ts`

`collectAssignmentInventory`; SHA256 `57E660312DEA87295E4735604F48A6E5D5615CB56B25ED46C2F204E07E715BF0`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `assignment_drafts` | `project_id id head_version created_by client_id created_at updated_at` | `apps/server/modules/backups/assignment-inventory.ts:15` |
| `assignment_draft_versions` | `project_id draft_id version content_hash version_json created_by client_id command_id created_at` | `apps/server/modules/backups/assignment-inventory.ts:16` |
| `assignment_content_reviews` | `project_id review_id draft_id draft_version draft_hash content_hash review_json created_by client_id command_id created_at` | `apps/server/modules/backups/assignment-inventory.ts:17` |
| `assignment_versions` | `project_id assignment_id version content_hash version_json created_by client_id command_id confirmation_id created_at` | `apps/server/modules/backups/assignment-inventory.ts:18` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/assignment-inventory.ts:19` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/assignment-inventory.ts:20` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/assignment-inventory.ts:21` |

### `backup-reference-history-inventory.ts`

`collectBackupReferenceHistoryInventory`; SHA256 `1619652D908EE3FEA29A43BECFD797CA1C688AF92B0204682A6F60ED4A7BCC1D`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `backup_references` | `project_id id kind head_version created_by created_at` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `backup_reference_versions` | `project_id reference_id version snapshot_json content_hash previous_version previous_hash actor_id client_id command_id created_at` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `backup_reference_events` | `project_id id reference_id reference_version reference_hash event_kind reason actor_id client_id command_id created_at version snapshot_json content_hash` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `commands` | `id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/backup-reference-history-inventory.ts:11` |

### `baseline-inventory.ts`

`collectBaselineInventory`; SHA256 `7E0416319C1F2A9F15C5BF218F2E6584C606FFA5F7666D288D2D4187495A374C`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `baseline_activations` | `project_id id generation content_hash snapshot_json previous_activation_id command_id approval_consumption_id created_by client_id created_at` | `apps/server/modules/backups/baseline-inventory.ts:13` |
| `baseline_activation_current` | `project_id activation_id activation_ref` | `apps/server/modules/backups/baseline-inventory.ts:14` |
| `baseline_activation_rechecks` | `project_id activation_id plan_id plan_version plan_hash task_code impact_ref` | `apps/server/modules/backups/baseline-inventory.ts:15` |
| `commands` | `id command_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id` | `apps/server/modules/backups/baseline-inventory.ts:16` |

### `connection-candidate-inventory.ts`

`collectConnectionCandidateInventory`; SHA256 `3560579EE9A3C0CB08C760E1836D777E48CC87991E7EA3346E34965C54BC4B6B`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `connection_candidates` | `id project_id kind head_version created_by created_at` | `apps/server/modules/backups/connection-candidate-inventory.ts:11` |
| `connection_candidate_versions` | `project_id candidate_id version kind snapshot_json content_hash created_by client_id command_id expires_at created_at` | `apps/server/modules/backups/connection-candidate-inventory.ts:11` |
| `commands` | `id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at` | `apps/server/modules/backups/connection-candidate-inventory.ts:11` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/connection-candidate-inventory.ts:11` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/connection-candidate-inventory.ts:11` |

### `context-preparation-inventory.ts`

`collectContextPreparationInventory`; SHA256 `2DA3E8F146084A3EE768A0E519BF05EB249F392BC2EB881493675A1400B90B88`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `context_bundles` | `project_id id version assignment_id assignment_version assignment_hash assignment_ref baseline_refs budget_ref manifest_json request_payload content_hash created_by client_id command_id created_at` | `apps/server/modules/backups/context-preparation-inventory.ts:20` |
| `context_items` | `project_id bundle_id bundle_version item_id category required source_ref source_hash included_state reason delivery_parts issue` | `apps/server/modules/backups/context-preparation-inventory.ts:21` |
| `execution_preparations` | `project_id id version assignment_id assignment_version binding_id binding_version bundle_id bundle_version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/context-preparation-inventory.ts:22` |
| `assignment_versions` | `project_id assignment_id version content_hash version_json created_by created_at` | `apps/server/modules/backups/context-preparation-inventory.ts:23` |
| `assignment_draft_versions` | `project_id draft_id version content_hash version_json` | `apps/server/modules/backups/context-preparation-inventory.ts:24` |
| `role_bindings` | `project_id binding_id version content_hash snapshot_json created_by created_at` | `apps/server/modules/backups/context-preparation-inventory.ts:25` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/context-preparation-inventory.ts:26` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/context-preparation-inventory.ts:27` |
| `execution_preparation_approval_candidates` | `project_id request_id request_command_id candidate_command_id payload_hash payload_json created_by client_id control_generation policy_ref created_at` | `apps/server/modules/backups/context-preparation-inventory.ts:28` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/context-preparation-inventory.ts:29` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/context-preparation-inventory.ts:30` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/context-preparation-inventory.ts:31` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/context-preparation-inventory.ts:32` |

### `control-handoff-history-inventory.ts`

`readOwnControlHandoffHistoryRows`; SHA256 `B6CA2A0EE35CF04828A5724C3A3A6AC2D25A1D15C3276CD370C0B07B1E463207`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `control_handoff_source_requests` | `project_id id version content_hash snapshot_json metadata_json requested_by client_id source_command_id created_at expires_at` | `apps/server/modules/backups/control-handoff-history-inventory.ts:8` |
| `control_handoff_source_summaries` | `project_id request_id request_version request_hash version content_hash body_json metadata_json source_command_id observed_at valid_until` | `apps/server/modules/backups/control-handoff-history-inventory.ts:8` |
| `control_handoff_source_commands` | `command_id project_id operation actor_id client_id request_id request_version request_hash summary_version summary_hash base_control_json command_json command_hash payload_hash created_at` | `apps/server/modules/backups/control-handoff-history-inventory.ts:8` |
| `control_handoff_source_receipts` | `command_id project_id body_json` | `apps/server/modules/backups/control-handoff-history-inventory.ts:8` |
| `control_handoff_source_audits` | `command_id project_id body_json` | `apps/server/modules/backups/control-handoff-history-inventory.ts:8` |

### `conversation-inventory.ts`

`collectConversationInventory`; SHA256 `7115F0FF13DBB7B1F8B20216F1734AE2355194FDD19F83EF1B17795E0D076B50`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `conversations` | `id project_id target_role_ref head_sequence created_by last_client_id last_command_id created_at updated_at` | `apps/server/modules/backups/conversation-inventory.ts:13` |
| `conversation_messages` | `project_id conversation_id sequence id author_ref kind body_artifact_id source_refs reply_to supersedes_instruction_id effective_scope message_json content_hash redaction_state client_id command_id recorded_at` | `apps/server/modules/backups/conversation-inventory.ts:14` |
| `artifacts` | `id project_id bytes content_hash media_type state inspection_json` | `apps/server/modules/backups/conversation-inventory.ts:15` |

### `design-change-inventory.ts`

`collectDesignChangeInventory`; SHA256 `F73137CC363D03DCE88523A41BA8CB40FD664E39FC17A202459511948489EDDC`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `design_changes` | `id project_id version before_id before_version before_hash proposal_id content_hash change_json created_by client_id command_id created_at` | `apps/server/modules/backups/design-change-inventory.ts:17` |
| `design_change_impacts` | `id project_id version change_id change_hash source_kind content_hash impact_json created_by client_id command_id created_at base_version base_hash` | `apps/server/modules/backups/design-change-inventory.ts:18` |
| `commands` | `id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id` | `apps/server/modules/backups/design-change-inventory.ts:19` |

### `design-trace-inventory.ts`

`collectDesignTraceInventory`; SHA256 `4F2EB532016AEEC17EC6DDB3E34121D685DD0A1FEC0ABAC23894285A04E2B264`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `design_items` | `id project_id design_document_id document_version document_hash local_code title anchor item_hash item_json created_by client_id command_id created_at` | `apps/server/modules/backups/design-trace-inventory.ts:14` |
| `screen_regions` | `id project_id design_item_id screen_code source_document_id source_version source_hash artifact_id anchor region_hash region_json created_by client_id command_id created_at` | `apps/server/modules/backups/design-trace-inventory.ts:15` |
| `trace_edges` | `id project_id from_kind from_id from_version from_code to_kind to_id to_version to_code relation design_refs edge_json edge_hash reason created_by client_id command_id created_at` | `apps/server/modules/backups/design-trace-inventory.ts:16` |
| `commands` | `id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id` | `apps/server/modules/backups/design-trace-inventory.ts:17` |

### `document-inventory.ts`

`collectDocumentInventory`; SHA256 `F5C39009216E97691215B8F4E0BAA3F4803E1889F878298B223EAA1C0AEF1C11`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `documents` | `id project_id title head_version confirmed_version created_by created_at updated_at` | `apps/server/modules/backups/document-inventory.ts:20` |
| `document_versions` | `project_id document_id version form_definition_id form_version form_hash stage_ref_json body_artifact_id title source_refs_json content_json content_hash sections_json author_ref_json validation_json reason client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:21` |
| `document_artifact_links` | `project_id document_id version artifact_id kind` | `apps/server/modules/backups/document-inventory.ts:22` |
| `artifacts` | `id project_id bytes content_hash media_type state inspection_json` | `apps/server/modules/backups/document-inventory.ts:23` |
| `document_imports` | `id project_id original_artifact_id form_definition_id form_version form_hash candidate_json content_hash created_by client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:24` |
| `document_import_selections` | `id project_id import_id document_id version created_by client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:25` |
| `document_proposals` | `id project_id document_id base_version base_hash body_artifact_id diff_artifact_id content_json proposal_json content_hash reason created_by client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:26` |
| `document_proposal_selections` | `id project_id proposal_id document_id version created_by client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:27` |
| `content_reviews` | `id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at` | `apps/server/modules/backups/document-inventory.ts:28` |
| `document_version_events` | `id project_id document_id version event_kind review_ref actor_ref reason command_id created_at` | `apps/server/modules/backups/document-inventory.ts:29` |
| `document_confirmations` | `id project_id document_id version target_hash form_ref review_refs validation_json confirmed_by client_id command_id created_at` | `apps/server/modules/backups/document-inventory.ts:30` |
| `document_source_links` | `project_id id document_id version source_root_id relative_path source_snapshot_ref blob_hash link_version state current_event_id linked_at updated_at` | `apps/server/modules/backups/document-inventory.ts:31` |
| `document_source_link_events` | `id project_id link_id link_version content_hash snapshot_json command_id created_at` | `apps/server/modules/backups/document-inventory.ts:32` |
| `project_methodologies` | `id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at` | `apps/server/modules/backups/document-inventory.ts:33` |

### `execution-control-inventory.ts`

`collectExecutionControlInventory`; SHA256 `B281D33B40679A87E1822885FA2CDBA3A3F496C2EC663A6A3C96E5B9FE87D675`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `executions` | `project_id id generation transport state created_by client_id command_id created_at` | `apps/server/modules/backups/execution-control-inventory.ts:19` |
| `execution_grants` | `project_id id version execution_id generation content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/execution-control-inventory.ts:20` |
| `writer_claims` | `project_id id execution_id generation grant_id grant_version scope_json expires_at ownership_state created_command_id issued_at reclaimed_at` | `apps/server/modules/backups/execution-control-inventory.ts:21` |
| `execution_commands` | `project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at` | `apps/server/modules/backups/execution-control-inventory.ts:22` |
| `execution_grant_revocations` | `project_id id version execution_id generation grant_id grant_version content_hash snapshot_json created_by client_id created_command_id created_at` | `apps/server/modules/backups/execution-control-inventory.ts:23` |
| `usage_reservations` | `project_id reservation_id version server_sequence command_id content_hash snapshot_json policy_id policy_version created_command_id` | `apps/server/modules/backups/execution-control-inventory.ts:24` |
| `delivery_outbox` | `id project_id command_id kind destination_ref payload_ref scope_digest state attempt_count next_attempt_at last_error_code` | `apps/server/modules/backups/execution-control-inventory.ts:25` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/execution-control-inventory.ts:26` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/execution-control-inventory.ts:27` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/execution-control-inventory.ts:28` |

### `knowledge-inventory.ts`

`collectKnowledgeInventory`; SHA256 `6554BBE0EA77A250AE3FDD6B96243CD1583CF780B426C8AACFE4DD06CCF71973`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `knowledge_entries` | `id project_id kind head_version created_by client_id command_id created_at` | `apps/server/modules/backups/knowledge-inventory.ts:16` |
| `knowledge_versions` | `project_id entry_id version title content_artifact_id content_hash source_refs reason scope_json related_refs entry_json supersedes_version created_by client_id command_id created_at` | `apps/server/modules/backups/knowledge-inventory.ts:17` |
| `knowledge_events` | `id project_id entry_id version kind reason actor_ref approval_ref target_refs client_id command_id recorded_at base_ref change_sources review_refs` | `apps/server/modules/backups/knowledge-inventory.ts:18` |
| `content_reviews` | `id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at` | `apps/server/modules/backups/knowledge-inventory.ts:19` |
| `constitution_applications` | `project_id application_version content_hash entry_id version confirmation_id snapshot_json applied_by client_id command_id created_at` | `apps/server/modules/backups/knowledge-inventory.ts:20` |
| `project_constitutions` | `project_id application_version application_hash entry_id version` | `apps/server/modules/backups/knowledge-inventory.ts:21` |
| `artifacts` | `id project_id bytes content_hash media_type state inspection_json` | `apps/server/modules/backups/knowledge-inventory.ts:22` |
| `commands` | `id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id` | `apps/server/modules/backups/knowledge-inventory.ts:23` |
| `audit_events` | `event_id project_id command_id server_sequence` | `apps/server/modules/backups/knowledge-inventory.ts:24` |
| `authorization_receipts` | `id command_id policy_ref` | `apps/server/modules/backups/knowledge-inventory.ts:25` |

### `methodology-application-inventory.ts`

`collectMethodologyApplicationInventory`; SHA256 `04A962600EB746D7423A273729A01600DC1135A284E66F73CEADD4CBFD4FE451`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `project_methodologies` | `id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at application_command_id` | `apps/server/modules/backups/methodology-application-inventory.ts:13` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/methodology-application-inventory.ts:14` |
| `audit_events` | `event_id project_id command_id server_sequence` | `apps/server/modules/backups/methodology-application-inventory.ts:15` |

### `notification-inventory.ts`

`collectNotificationInventory`; SHA256 `02981FB2B707FABEF6B37E316B505428A342502CC460E9FC342F94B762BAE5FB`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `notifications` | `id project_id source_command_id approval_request_id request_version request_content_hash recipient_user_id event_kind channel severity reason_code delivery_state created_at content_hash` | `apps/server/modules/backups/notification-inventory.ts:14` |
| `notification_reads` | `project_id notification_id recipient_user_id client_id command_id notification_content_hash read_at` | `apps/server/modules/backups/notification-inventory.ts:15` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/notification-inventory.ts:16` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/notification-inventory.ts:17` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/notification-inventory.ts:18` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/notification-inventory.ts:19` |

### `observation-inventory.ts`

`collectObservationInventory`; SHA256 `C033F75381C8C4BC8ECDBD9F70DB121C6E74D49A314AC5F72CF539DC047082F7`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `execution_observations` | `project_id execution_id generation id version event_sequence grant_id grant_version content_hash snapshot_json event_id` | `apps/server/modules/backups/observation-inventory.ts:16` |
| `execution_acknowledgements` | `project_id execution_id generation id version grant_id grant_version content_hash snapshot_json` | `apps/server/modules/backups/observation-inventory.ts:17` |
| `execution_observation_results` | `project_id execution_id generation proof_result_id proof_result_version ack_id ack_version content_hash snapshot_json` | `apps/server/modules/backups/observation-inventory.ts:18` |
| `execution_receipts` | `project_id id version grant_id grant_version challenge_id challenge_version content_hash snapshot_json` | `apps/server/modules/backups/observation-inventory.ts:19` |
| `execution_grants` | `project_id id version execution_id generation content_hash snapshot_json` | `apps/server/modules/backups/observation-inventory.ts:20` |
| `execution_commands` | `project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at` | `apps/server/modules/backups/observation-inventory.ts:21` |

### `permission-policy-inventory.ts`

`collectPermissionPolicyInventory`; SHA256 `F472913AB6D27BE608D97817CF7217BE46869A903113C44690F2B23BDF07524C`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `permission_policies` | `id project_id head_version created_by created_at` | `apps/server/modules/backups/permission-policy-inventory.ts:11` |
| `permission_policy_versions` | `project_id policy_id version rules_json content_hash reason review_refs created_by created_at client_id command_id` | `apps/server/modules/backups/permission-policy-inventory.ts:11` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref received_at completed_at operation_id request_hash` | `apps/server/modules/backups/permission-policy-inventory.ts:11` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/permission-policy-inventory.ts:11` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/permission-policy-inventory.ts:11` |

### `project-control-ledger-inventory.ts`

`collectProjectControlLedgerInventory`; SHA256 `1DAD75229D6C12568C6A1E86192C0436F4D54B1CE15F5B77839ACBD047A97AC7`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `commands` | `id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at` | `apps/server/modules/backups/project-control-ledger-inventory.ts:10` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/project-control-ledger-inventory.ts:10` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/project-control-ledger-inventory.ts:10` |

### `project-creation-draft-inventory.ts`

`collectProjectCreationDraftInventory`; SHA256 `A695586AE98A48A0693D316F61B31D6395BAE509BAE551720F4FCD0D57FC800D`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `project_drafts` | `id owner_user_id client_id version step input_json consumed_project_id created_at updated_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_artifact_selection_versions` | `draft_id draft_version refs_json snapshot_hash command_id receipt_id` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_artifact_selections` | `draft_id draft_version artifact_id upload_intent_id ordinal ref_json` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_artifact_adoptions` | `artifact_id upload_intent_id original_command_id draft_id draft_version ref_json source_key target_key project_id creation_intent_id create_command_id actor_id client_id adopted_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_creation_intents` | `id draft_id actor_id client_id external_command_id expected_version request_hash request_json target_project_id refs_json sources_json selection_hash state attempt project_command_id result_json created_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_upload_intents` | `id draft_id actor_id client_id external_command_id expected_version request_hash request_json artifact_id server_command_id receipt_id operation_id ref_json staging_key final_key state attempt result_json created_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `artifacts` | `id project_id draft_id bytes content_hash media_type storage_key state created_by client_id command_id created_at inspection_json` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `commands` | `id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `draft_audit_events` | `draft_id server_sequence event_id actor_ref client_ref command_id operation_id operation outcome reason_code recorded_at` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/project-creation-draft-inventory.ts:11` |

### `project-methodology-inventory.ts`

`collectProjectMethodologyInventory`; SHA256 `6C77A70392F59E28568F3A9F859C5E25AADF99BF2C7C67E555E2E88B8FDF8071`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `methodology_definitions` | `id scope owner_user_id project_id system_code name purpose head_version created_at` | `apps/server/modules/backups/project-methodology-inventory.ts:16` |
| `methodology_versions` | `definition_id version name purpose graph_json content_hash origin_ref_json reason created_by created_at` | `apps/server/modules/backups/project-methodology-inventory.ts:17` |
| `content_reviews` | `id scope_kind scope_id owner_user_id project_id draft_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at` | `apps/server/modules/backups/project-methodology-inventory.ts:18` |
| `methodology_reviews` | `id definition_id version target_hash validation_json review_refs decision decided_by decided_at client_id command_id project_id` | `apps/server/modules/backups/project-methodology-inventory.ts:19` |
| `project_methodologies` | `id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at` | `apps/server/modules/backups/project-methodology-inventory.ts:20` |
| `commands` | `id command_id scope_kind project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id` | `apps/server/modules/backups/project-methodology-inventory.ts:21` |
| `audit_events` | `event_id project_id command_id server_sequence` | `apps/server/modules/backups/project-methodology-inventory.ts:22` |

### `responsible-session-inventory.ts`

`collectResponsibleSessionInventory`; SHA256 `9A9D3CD996029042F271D9D50347FC16B4A9ADD7DC051C65C327BA2F3A7BA936`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `project_roles` | `project_id role_id version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/responsible-session-inventory.ts:16` |
| `agent_sessions` | `project_id session_id version role_id content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/responsible-session-inventory.ts:17` |
| `role_bindings` | `project_id binding_id version role_id session_id assignment_id assignment_version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/responsible-session-inventory.ts:18` |
| `assignment_versions` | `project_id assignment_id version content_hash version_json created_by created_at` | `apps/server/modules/backups/responsible-session-inventory.ts:19` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/responsible-session-inventory.ts:20` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/responsible-session-inventory.ts:21` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/responsible-session-inventory.ts:22` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/responsible-session-inventory.ts:23` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/responsible-session-inventory.ts:24` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/responsible-session-inventory.ts:25` |

### `result-review-history-inventory.ts`

`collectResultReviewHistoryInventory`; SHA256 `C3005711C2CAA2CCC81C836EDDE8CE5884B7514D1C706C482C0F8F0E0524F339`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `result_criteria_versions` | `project_id criteria_id version assignment_ref assignment_id assignment_version content_hash criteria_json input_json created_by client_id command_id created_at` | `apps/server/modules/backups/result-review-history-inventory.ts:15` |
| `result_reviews` | `project_id id result_id criteria_id criteria_version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/result-review-history-inventory.ts:16` |
| `result_rework_drafts` | `project_id id result_id review_id binding_id binding_version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/result-review-history-inventory.ts:17` |
| `result_submissions` | `project_id id content_hash snapshot_json submitted_by submitted_at` | `apps/server/modules/backups/result-review-history-inventory.ts:18` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/result-review-history-inventory.ts:19` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/result-review-history-inventory.ts:20` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/result-review-history-inventory.ts:21` |

### `result-submission-inventory.ts`

`collectResultSubmissionInventory`; SHA256 `DF733B11DC10001617F052349111B39F4FF76B192955E901FC5E25A3CC919187`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `result_submissions` | `project_id id execution_id generation assignment_ref execution_ref manifest_ref manifest_hash submission_state submitted_by client_id command_id content_hash snapshot_json submitted_at` | `apps/server/modules/backups/result-submission-inventory.ts:13` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/result-submission-inventory.ts:14` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/result-submission-inventory.ts:15` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/result-submission-inventory.ts:16` |

### `source-root-history-inventory.ts`

`collectSourceRootHistoryInventory`; SHA256 `C5538A46F6ED08A842009202C824923AF946B9C270A6F9F02A5C2AB4873BF26F`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `source_roots` | `project_id id head_version created_by client_id created_at` | `apps/server/modules/backups/source-root-history-inventory.ts:11` |
| `source_root_versions` | `project_id root_id version content_hash declaration_json status authority readiness reason actor_id client_id command_id connector_id created_at` | `apps/server/modules/backups/source-root-history-inventory.ts:11` |
| `commands` | `id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at` | `apps/server/modules/backups/source-root-history-inventory.ts:11` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/source-root-history-inventory.ts:11` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/source-root-history-inventory.ts:11` |

### `stage-budget-inventory.ts`

`collectStageBudgetInventory`; SHA256 `ECE4CEEB5C0F11BC465DA418F156CAC4D36726382383251289C867454BF7D06F`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `stage_runs` | `project_id id sequence input_json created_by client_id command_id created_at` | `apps/server/modules/backups/stage-budget-inventory.ts:18` |
| `queue_requests` | `project_id request_id version sequence content_hash snapshot_json command_id` | `apps/server/modules/backups/stage-budget-inventory.ts:19` |
| `limit_policy_versions` | `project_id policy_id version content_hash snapshot_json scope_json created_by client_id command_id created_at` | `apps/server/modules/backups/stage-budget-inventory.ts:20` |
| `usage_reservations` | `project_id reservation_id version server_sequence command_id content_hash snapshot_json policy_id policy_version created_command_id` | `apps/server/modules/backups/stage-budget-inventory.ts:21` |
| `execution_commands` | `project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at` | `apps/server/modules/backups/stage-budget-inventory.ts:22` |
| `execution_grants` | `project_id id version execution_id generation content_hash snapshot_json` | `apps/server/modules/backups/stage-budget-inventory.ts:23` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/stage-budget-inventory.ts:24` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/stage-budget-inventory.ts:25` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/stage-budget-inventory.ts:26` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/stage-budget-inventory.ts:27` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/stage-budget-inventory.ts:28` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/stage-budget-inventory.ts:29` |

### `understanding-permit-inventory.ts`

`collectUnderstandingPermitInventory`; SHA256 `DF84042B09956275D2D7D8A347410F583F97A083A611089855DE4C37CFDAE780`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `understanding_reviews` | `project_id execution_id generation id version content_hash snapshot_json created_by client_id command_id created_at` | `apps/server/modules/backups/understanding-permit-inventory.ts:20` |
| `execution_start_permits` | `project_id execution_id generation id version proof_result_id proof_result_version content_hash snapshot_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:21` |
| `execution_instruction_permits` | `project_id execution_id generation id version command_id command_record_id command_record_version grant_id grant_version reservation_id reservation_version proof_result_id proof_result_version envelope_hash content_hash snapshot_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:22` |
| `execution_commands` | `project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at` | `apps/server/modules/backups/understanding-permit-inventory.ts:23` |
| `execution_grants` | `project_id id version execution_id generation content_hash snapshot_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:24` |
| `usage_reservations` | `project_id reservation_id version server_sequence command_id content_hash snapshot_json policy_id policy_version created_command_id` | `apps/server/modules/backups/understanding-permit-inventory.ts:25` |
| `execution_receipts` | `project_id id version grant_id grant_version challenge_id challenge_version content_hash snapshot_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:26` |
| `approval_consumptions` | `id project_id decision_id command_id scope_digest policy_id policy_version consumed_at` | `apps/server/modules/backups/understanding-permit-inventory.ts:27` |
| `approval_decisions` | `id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:28` |
| `approval_requests` | `id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json` | `apps/server/modules/backups/understanding-permit-inventory.ts:29` |
| `understanding_review_approval_candidates` | `project_id request_id request_command_id candidate_command_id payload_hash payload_json created_by client_id control_generation policy_ref command_hash created_at` | `apps/server/modules/backups/understanding-permit-inventory.ts:30` |
| `commands` | `id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash` | `apps/server/modules/backups/understanding-permit-inventory.ts:31` |
| `authorization_receipts` | `id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at` | `apps/server/modules/backups/understanding-permit-inventory.ts:32` |
| `audit_events` | `project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of` | `apps/server/modules/backups/understanding-permit-inventory.ts:33` |

### `work-plan-inventory.ts`

`collectWorkPlanInventory`; SHA256 `EE930589A0562494B1367EDC7C77DEDD0F0A82CC2866886D7C3F1C78CF961823`.

| 표 | 직접 선언된 선택열 | 근거 행 |
|---|---|---|
| `work_plans` | `id project_id head_version confirmed_version created_by created_at updated_at` | `apps/server/modules/backups/work-plan-inventory.ts:15` |
| `work_plan_versions` | `project_id plan_id version document_id document_version document_hash design_id design_version design_hash screen_review_refs content_hash version_json created_by client_id command_id created_at` | `apps/server/modules/backups/work-plan-inventory.ts:16` |
| `plan_tasks` | `project_id plan_id plan_version task_code task_type card_json card_hash owner_role` | `apps/server/modules/backups/work-plan-inventory.ts:17` |
| `plan_dependencies` | `project_id plan_id plan_version task_code dependency_task_code phase` | `apps/server/modules/backups/work-plan-inventory.ts:18` |
| `work_plan_confirmations` | `id project_id plan_id version target_hash review_refs validation_json confirmed_by client_id command_id created_at` | `apps/server/modules/backups/work-plan-inventory.ts:19` |
| `content_reviews` | `id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at` | `apps/server/modules/backups/work-plan-inventory.ts:20` |
| `commands` | `id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id` | `apps/server/modules/backups/work-plan-inventory.ts:21` |
| `audit_events` | `event_id project_id command_id server_sequence` | `apps/server/modules/backups/work-plan-inventory.ts:22` |
