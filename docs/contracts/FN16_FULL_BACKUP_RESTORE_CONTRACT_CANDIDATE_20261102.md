# FN16 전체 수동 백업·검증 복원 통합 계약 후보 r1

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

현재 전체 exact registry 부록은 미완성이다. 기존 부분 A1 후보를 복사해 COMPLETE=true를 발급할 수 없다. source 채택 전 각 entries의 실제 DDL/reader/hash와 표/필드 미분류0을 검토한 고정 부록이 필수다. 실행 중 미등록 namespace나 필수 row/본문/FK/이전 버전이 발견되면 COVERAGE_INCOMPLETE로 거절한다.

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

입력은 현재 설치에 보호 등록된 정확 bundleRef·key ref와 기대 originProjectId/registryRef다. 사용자가 보낸 header 식별자·임의 절대경로·bundle 소지만으로 조회/복호화 권한이 생기지 않는다. 복원 시험을 위해 원본을 overwrite하거나 계정을 만들지 않는다.

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
현재 자료로 재사용할 경우 새 current ID·원본ref·새 hash·현재 검토/확정/승인·명시 적용을 거치는 별도 계약이 필요하다. 이 후보에 confirmRestore/적용 endpoint는 없으며 적용 버튼도 disabled 이유를 제공한다.
REDACTED_HISTORY의 원문 제외는 report에 남는다. 필수 원본이 없으면 검증 가능한 제한 범위는 보여주되 FULL_VERIFIED를 발급하지 않는다.

ReportSnapshot exact 제안:
{schemaVersion:1,kind:FULL_RESTORE_REPORT_V1,originProjectId,runRef,bundleRef,manifestRef,registryRef,verifierRef,checks,totals,issues,excluded,startedAt,completedAt,assurance,applied:false,authorizationRestored:false,writerResumed:false}
checks 항목={code,state:PASS|FAIL|NOT_RUN|UNSUPPORTED,evidenceRefs,reasonCode}; code는 AUTHENTICATED_ENVELOPE/RECORD_BYTES/SOURCE_HASH/REFERENCE_CLOSURE/HISTORY_CHAIN/BLOB_BYTES/READBACK로 닫는다.
assurance=MODEL_ONLY|MANAGED_ARTIFACT_VALIDATED|ISOLATED_DB_VALIDATED의 수행 범위이며 하나가 다른 미수행을 대신하지 않는다. FULL_VERIFIED는 필수 check 모두 실제 계획된 수준에서 PASS·필수 issue0인 경우만 summary에 표시하고, source 합성 시험에서는 사용하지 않는다.

## 9. A5 — 공개 명령·조회 DTO·상태·일회승인

아래 신규 공개 표면은 전부 채택 대상 제안이다. 기존 source만으로 이미 제공된 endpoint라고 해석하지 않는다. 같은-origin 상대경로/HUMAN 인증/정규 JSON·닫힌 오류를 사용한다.

새 operation 후보:
- createFullBackupJob: 정확 payload={policyRef,registryRef,previewDigest,reason}
- createRestoreValidationJob: 정확 payload={bundleRef,validationTargetRef,keyReferenceRef,registryRef,reason}
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
정책이 없는 restore validation의 policyRef는 null. 아직 없는 attempt/result/시각은 null이며 성공처럼 만들어 채우지 않는다.
current={state:AVAILABLE|CHANGED|UNAVAILABLE,reasonCodes,observedAt}; 과거 job state와 현재 접근/키/파일 상태를 분리한다.
Issue exact={code,target,required}; target={kind:PROJECT|POLICY|REGISTRY|KEY|TARGET|RECORD|BLOB|ATTEMPT,ref:null 또는 TypedRef}. code는 COVERAGE_INCOMPLETE/REQUIRED_EXCLUDED/SOURCE_UNAVAILABLE/SOURCE_CHANGED/REFERENCE_CONFLICT/KEY_LOCKED/KEY_USE_UNAVAILABLE/REGISTRY_UNSUPPORTED/BUDGET_EXPIRED/STORAGE_LIMIT/IO_UNKNOWN/COMMIT_UNKNOWN/INTEGRITY_FAILED로 닫는다. reasonCodes도 이 집합과 명시 PUBLIC_ERROR 코드만 허용하고 raw 오류문자열을 받지 않는다. issues 최대1000, target 중복은 code+정확target+required로 제거하며 초과는 truncated 성공이 아니라 실패다.
Page exact={items,nextCursor,hasMore,observedAt}; cursor는 server 서명·project/actor/client·operation/정렬/고정 snapshot에 결박,30분·최대4096자·다른 문맥 거절. list/fixed는 원문 bundle/key를 반환하지 않는다.
오류 DTO는 기존 공통6필드 code/message/requestId/targetId/retryDisposition/commandId를 유지한다. 코드 후보: AUTH_REQUIRED401, PROJECT_OPERATION_DENIED/PROJECT_CONTROL_REQUIRED403, NOT_FOUND404, VERSION_CONFLICT/CONCURRENT_CHANGE/IDEMPOTENCY_CONFLICT409, INTENT_EXPIRED410, BACKUP_REFERENCE_UNAVAILABLE/COVERAGE_INCOMPLETE/KEY_USE_UNAVAILABLE412, INPUT_INVALID422, BACKUP_STORAGE_LIMIT429, BACKUP_INTEGRITY_FAILED/BACKUP_STATE_UNKNOWN503.
unknown SQL/IO/crypto 오류·키 존재·실경로·stack은 고정503으로 sanitize한다. 503은 실패 미전송의 증거가 아니며 원명령 재확인 안내를 유지한다.

JobView/current response의 전체 JSON은 최대2MiB+1000*512B+4096B, Page는50개*8192B+4096B를 넘지 않도록 DTO builder에서 먼저 검산한다. 큰 manifest/registry/report 본문을 JobView에 인라인하지 않고 exact ref로만 연결한다. report 본문은 현재 보호 read 아래 별도 fixed GET /api/v1/projects/:projectId/restore-validation-reports/:id/versions/:version으로 최대2MiB를 반환하는 신규 endpoint 후보다. 큰 상세는 고정 ref별 유한 페이지 계약이 추가로 고정되기 전에는 생성 거절이며 임의 잘라 성공하지 않는다. 모든 GET stream은 상한 초과 시 cancel/release, 원 signal/기한을 보존한다.
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
생성 입력 source 원문은 기존 U에 남고, 새 plaintext staging P·ciphertext C·검증 staging V와 실패 사본을 실제 별개 bytes로 예약한다. 최초 보수 상한 R=P+C+V+외피/manifest/index이며 같은 job의 중간 사본 해제는 소유·정착/삭제 확인 뒤에만 줄인다.
최신 권한·project 잠금·원command/계획/fence의 독립 예약 COMMIT → 별도 IO_STARTED COMMIT → 실제 IO 단발 → publish/완료 검산 → 정산을 따른다. 운영 Tx rollback이 예약/시작 표식을 지우지 않는다.
권장 보수안은 기존 프로젝트 U+R+새 증가가10GiB를 넘지 않게 하고 target 여유도 따로 검사하는 것이다. 따라서 원자료가 cap 근처인 프로젝트는 백업 staging을 예약하지 못할 수 있다. 이는 가용성의 중요한 제안 영향이며 숨기지 않는다. 대안은 외부 백업 저장소/검증 staging의 별도 유한 cap과 원 project cap 범위를 새로 정의하는 것이다. 이 선택은 D5에서 결정해야 하며 현재 값으로 구현 GO하지 않는다.

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
| D5 한도/예약 | §10 보수 U+held/최대3사본·양방향기존writer보호·누적cap | 외부bundle/검증staging 별도cap은 가용성이 좋지만 기존10GiB 범위와새저장도메인 결정 필요 | near-cap 생성불가 영향·감소기록공간·실제charge algebra를 결정한 뒤 sourceWI 가능 |
| D6 적용/운영 | 검증전용·현재권한/계정/실행복원0·UNKNOWN보존/자동조정0 | 실제적용·운영조정/고아정리는 별도정확결정 | 이 제한 범위 검토 가능. 실제복원/사용자여정은 별도실행안 |

Main/PMO가 먼저 검토할 것은 D1~D6의 구체 선택과 미정 해소 순서다. 한 번에 모든 실제 실행을 승인받는 질문이 아니다. 기존 Main 상세화 지시에 따라 A1 registry/키사용/예약 상세 증거를 더 고정할 수 있지만, 새 public/auth/storage/암호 의미의 채택은 별도로 받는다.
현재 이 r1을 완성 구현 지시로 전달하면 안 된다. 특히 A1 미완성/미정 key domain/감소공간과 D5 cap 선택을 가짜 포트나 나중 시험으로 미루고 전체GO하지 않는다.

## 16. 변경·rollback·미수행

이번 산출물은 신규 후보문서1개뿐이다. 정본/source에 같은 UTF-8/LF bytes로 작성하고 기존 파일이 있으면 덮어쓰지 않는다. 기존 정책/참조/키 envelope/SQL/원자료를 수정하지 않는다.
후보가 채택되지 않으면 문서를 이력으로 남기거나 이 신규 문서 commit만 정상 revert할 수 있다. 실제 데이터/키/파일/서비스 rollback은 발생하지 않았다.
기존 선택파일/수동정책 기능을 유지하며 전체 백업 부족을 숨기지 않는다. native owner·실Agent 연결은 이 업무의 원문 백업 목표와 독립이고 Agent 교체를 위해 백업 복원을 필수로 만들지 않는다.
