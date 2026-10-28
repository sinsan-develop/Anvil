# FN16 프로젝트 방법론 전체 적용 이력 수집 작업계획

> 수행자: 기존 Primary 단독. writing-plans 방식으로 명시 경로·인터페이스·TEST_ONLY → Main RED → SOURCE_GO → 독립 검수를 고정한다. 별도 subagent 생성이나 제품 착수 승인은 이 문서로 발급하지 않는다.

2026-10-29 / codex/av3-stage-b / 기존 방법론 역사 source 6C77A703 동결 유지.

**목표:** 프로젝트에 고정된 방법론의 전체 적용 버전과 명시 apply 명령의 역사 관계를 원문·현재 실행 권한과 분리해 수집한다.
**구조:** 기존 유한 입력과 양끝 OWNER/동일 세션 RC 확인 사이에서 단일 읽기 전용 RR snapshot을 수집한다. application snapshot의 순수 parser와 실제 저장 receipt를 대조하며, 현재 방법론 head·내용 검토·양식 권한을 재조회해 과거 적용을 다시 승인하지 않는다.
**기술:** 기존 Node 24/TypeScript/pg 계약과 canonicalJson/contentHash. 새 패키지·서비스·설정·migration 없음. 0031 열이 없거나 관련 표가 미적용이면 고정503으로 실패하며 열 생략·과거 형식 fallback으로 성공시키지 않는다.
**기준:** docs/WORK_PLAN.md 및 docs/work_packages/FUNCTION_WORK.md FN16, docs/contracts/INTERFACES.md §14.1, docs/contracts/DATA_MODEL.md FN02, 아래 실제 producer. 내부 metadata 수집이며 공개 archive/restore 형식은 아니다.

## 1. 이번 문서와 이후 허용 경로

현재 작성 허용은 이 WI 한 파일뿐이다. Main 검토·고정 후 별도 TEST_ONLY/SOURCE_GO로 다음 신규 3개만 수행한다.

- apps/server/modules/backups/methodology-application-inventory.ts
- tests/unit/FN16/methodology-application-inventory.test.ts
- tests/unit/FN16/methodology-application-inventory-schema.test.ts

기존 document/project-methodology collector·parser·writer·SQL·시험·보호 untracked 8은 수정하지 않는다. Main은 기록/Git/통합을 담당한다. 실제 DB/RLS/원문 FS/키/서비스/Agent/P03/job·설정 발급·현재 적용 전환·전체 백업/복원은 0이다.

## 2. 실제 producer와 중복 경계

- db/migrations/0002_methodologies.sql: project_methodologies 원 10열, id PK 및 (project_id,application_version) UNIQUE.
- db/migrations/0031_empty_project_methodology_application.sql: application_command_id 추가. fn02_lock_insert가 applyMethodology일 때 서버 command id를 채운다. fn02_assert_application은 원명령·현재 선행을 확인하지만 이번 collector에서 호출하지 않는다.
- apps/server/modules/methodologies/project-methodologies.ts apply: snapshot 4필드(name,purpose,graph,sourceRef), applicationVersion=expected+1, METHODOLOGY_APPLIED receipt에 snapshot/reason/previousApplicationRef. 원 작성 시 현재 확인은 현재 API 책임이었으며 역사 수집에서 재실행하지 않는다.
- apps/server/modules/projects/repository.ts createProject: 초기 application v1, application_command_id=null, snapshot은 기존 확정본 4필드 또는 전용 초안 draftConfirmationRef 포함 5필드. createProject 결과는 일반 apply receipt가 아니므로 임의로 apply 명령으로 결박하지 않는다.
- apps/server/modules/methodologies/application-snapshot.ts readApplicationSnapshot(projectId,rows): 순수 함수에 정확 행 하나씩 전달한다. graph 원hash와 snapshot hash, 참조, 구조적 확정 가능성만 검증한다. 선언된 form refs를 이용한 구조 검사이지 실제 form/공통본 접근은 아니다.
- 기존 document-inventory는 문서가 참조한 application만, 기존 project-methodology-inventory는 초기 전용 초안 증빙만 수집했다. 이번은 모든 application 이력이며 기존 자료군을 재구현하지 않는다.

## 3. 내부 인터페이스와 명시 SELECT

`collectMethodologyApplicationInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<MethodologyApplicationInventory>`

value는 기존 readDocumentInventoryInput 계약(projectId/limits)을 그대로 소비한다. 외부 inventory 배열·공통본 경로·실행 옵션은 받지 않는다.

| 표 | 허용 열 | 범위/순서 |
|---|---|---|
| project_methodologies (11) | id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by,created_at,application_command_id | project_id 일치. application_version bigint keyset 오름차순, 200행. 모든 세대 수집; LIMIT 1/현재본만 조회 금지 |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 위 application의 nonnull application_command_id만 배열≤200으로 SELECT. PROJECT/scope_id/project_id 및 applyMethodology 조건 고정. id keyset 200 |
| audit_events (4) | event_id,project_id,command_id,server_sequence | 수집한 apply 서버 명령 id만 배열≤200. event_id keyset 200. 각 명령 정확 1개, 고유 양의 안전정수 순번 |

명시 열 CTE 후 octet_length(to_jsonb(inventory_row)::text)와 CASE로 남은 metadataBytes보다 큰 행의 본문은 null로 억제한다. 전체 원행의 SELECT */to_jsonb(t)·OFFSET·전체 commands/audit 조회는 금지한다. schema 시험은 원 10열+0031 ALTER 1열과 commands 19/audit 4열을 실제 DDL에서 대조한다. bigint 문자열은 canonical decimal 안전정수만 수용한다.

## 4. 역사 무결성

1. 빈 이력은 정상이다. 있으면 application_version은 1..N 연속이고 id/세대가 유일하다. 각 행 프로젝트·UUID·생성자·날짜를 검사한다. 원 snapshot의 정확 hash와 graph hash/sourceRef는 readApplicationSnapshot으로 대조한다. row의 snapshot JSON은 원형 그대로 보존하며 원hash를 익명화 hash로 바꾸지 않는다.
2. application_command_id=null은 v1 초기 생성본에만 허용한다. 4필드/5필드 초기 snapshot 모두 가능하다. 초기 생성 command/draft의 원증빙은 이번 조회 범위 밖이며 INITIAL_CREATION_EVIDENCE_NOT_COLLECTED로 남긴다. null을 임의 성공 apply 권한으로 해석하지 않는다.
3. nonnull v1도 정상이다(방법론 미적용 빈 프로젝트의 최초 apply). 모든 nonnull 행은 정확 서버 명령 1개를 가져야 하며 한 명령을 두 application이 소비할 수 없다. 후속 v2 이상 null, 고아/중복 명령은 실패한다. nonnull apply snapshot은 정확 4필드이고 draftConfirmationRef를 추가하지 않는다.
4. 명령은 PROJECT/scope_id/project_id, APPLIED, applyMethodology, actor_id=created_by, 유효 client_id/control_generation, expected_version=application_version-1, 정확 policy VersionRef/authorization_receipt_id를 검사한다. approval_consumption_id와 payload_ref는 null이며 completed_at은 유효한 기록이다. 원 사용자 요청 command_id와 서버 id를 혼동하지 않는다. 요청 중복 비교가 필요하면 실제 producer의 actor_id+command_id 범위를 사용한다.
5. receipt는 기존 닫힌 10필드(operationId,commandId,projectId,status,targetId,version,data,evidenceRefs,warnings,serverReceivedAt)다. operationId=commands.operation_id, commandId=commands.command_id, targetId=application.id, version/프로젝트/APPLIED/ref 정확 일치를 검사한다. 빈 evidenceRefs/warnings 및 정확 data 5필드(ref,status,snapshot,reason,previousApplicationRef)를 대조한다. reason은 원 apply 입력대로 공백 아닌 well-formed 문자열 ≤20,000자이며 marker 검사를 통과해야 한다.
6. commands.request_hash는 64자리 소문자 hex이고 다음 기존 0031 원명령 재구성의 canonical hash와 같아야 한다: `{schemaVersion:1,projectId,commandId:command_id,clientId:client_id,controlGeneration:control_generation,operation:'applyMethodology',targetId:projectId,expectedVersion:expected_version,baselineRefs:[],approvalRef:null,payload:{methodologyRef:sourceRef,expectedApplicationVersion:expected_version,reason:data.reason}}`. 원요청을 반환하거나 실행하지 않는다. 이는 원명령 내용의 국소 hash 대조이며 authorization receipt scope digest·실제 승인/현재 정책 검증은 아니다.
7. data.status=METHODOLOGY_APPLIED, data.snapshot=원 snapshot, previousApplicationRef는 v1 null 또는 바로 앞 세대의 exact id/version/hash다. 앞 세대 sourceRef와 동일한 sourceRef의 연속 재적용은 기존 writer가 METHODOLOGY_ALREADY_APPLIED로 막으므로 거절한다. 세대가 달라도 application id는 재사용하지 않는다.
8. created_at/serverReceivedAt/completed_at은 같은 transaction의 기록으로 서로 일치한다. 서로 다른 application 사이의 시각 대소·감사순번 증가를 버전 규칙 대신 강제하지 않는다. audit의 명령 귀속·순번 유일성만 대조하며 전체 감사 hash chain은 검증하지 않는다.
9. 각 sourceRef·graph formRef/limitPolicyRef·draftConfirmationRef·policy/auth receipt는 정확 형식의 외부 역사 의존으로 기록한다. source 원문이나 현재 USER_COMMON/PROJECT 소유권·현재 확정본·현재 양식·실행 상태를 읽지 않는다. 해당 원증빙이 미수집됐음을 숨기지 않는다.
10. 보존 문자열·이유·graph·ref의 알려진 민감 표식을 검사해 고정 오류로 거절한다. 원 actor/client/session/token·명령 원행·원 오류/cause/SQL·경로를 출력하지 않는다. 완전한 민감정보 탐지 보장은 아니다.

## 5. 현재성·유한 수집·회수

- 최초 RC authenticated 안에서 같은 actor/client/credentialGeneration/session을 고정하고 projectMember OWNER·비보관 프로젝트와 DB clock_timestamp 유효 Date를 확인한다. 최종 RC도 동일 신원을 SQL 전에 대조한다. 양끝 관측만으로 지속 권한이나 원자적 전체 snapshot을 주장하지 않는다.
- 단일 RR READ ONLY transaction으로 자료를 수집한다. 시작/끝 isolation/read_only/snapshot을 대조한다. 매 자료/권한 query 직전 총 deadline과 관측된 최단 세션 만료의 남은 시간을 statement_timeout으로 갱신한다.
- 페이지·응답 후, 최종 authenticated 외부 COMMIT 뒤 취소/기한을 검사한다. 이전에 짧게 관측한 세션 만료를 뒤의 긴 값으로 늘리지 않는다.
- 누적 SQL row_bytes와 최종 canonical UTF-8 metadataBytes를 각각 제한한다. fileCount/inputBytes는 0이다. 최종 usage 자기 자리수를 포함한 크기를 유한 반복으로 고정한다.
- BEGIN 전송 시작/성공을 구분한다. BEGIN 응답 유실 client는 정상 재사용시키지 않고 error release한다. 정상·실패 모두 owned RR을 단발 rollback/release 후 종료 RC로 이동한다. 진행 중 query를 Promise.race로 버리고 정상 반납하지 않는다. 회수 불명 503이 취소/기한보다 우선한다.
- 현재 AccessRepository의 connect/auth 경로를 바꾸지 않으므로 전체 wall-clock 강제 중단 보장은 없다. 실제 PG timeout·RLS·동시변경은 NOT_RUN이다.

## 6. 반환 DTO

`kind:METHODOLOGY_APPLICATION_INVENTORY_V1`, `scope:PROJECT_METHODOLOGY_APPLICATION_HISTORY_ONLY`.

- projectId, applications[], issues[], externalDependencies[].
- application: ref, 원 snapshot, recordedAt, previousApplicationRef, provenance(INITIAL_CREATION 또는 APPLY_COMMAND), 적용 명령이 있으면 serverSequence, 익명 actor `{kind:HUMAN}`. 원문 사용자 식별자/명령 실행 객체는 반환하지 않는다.
- 원 ref.contentHash는 snapshot 원 hash다. projectionHash는 위 익명 application 투영 전체(그 자신의 projectionHash 제외)의 canonical hash다.
- 전체 contentHash는 정확 `{projectId,applications,issues,externalDependencies}` 4필드 canonical hash. observation/usage는 제외한다.
- observation은 기존 snapshot/시작·끝 DB시각/isolation/readOnly/양끝 RC 경계 정보만.
- `metadataComplete=false` when issues/externalDependencies 존재; 원증빙 누락은 성공 검증으로 표시하지 않는다.
- `blobVerification,sourceVersionVerification,authorizationBindingVerification,formAvailabilityVerification,auditChainVerification:NOT_PERFORMED`, `executionEvidence:NOT_CONNECTED`.
- `fullProjectCoverage,restorable,executionAuthorized,dispatchPerformed,atomicSnapshotVerified:false`.
- 오류는 AUTH_REQUIRED401/NOT_FOUND404/INPUT400, METHODOLOGY_APPLICATION_INVENTORY_CANCELLED409, DEADLINE·LIMIT413, INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503. 자료 parser의 오류는 고정 503으로 정규화한다.

## 7. 단일 논리 업무의 실행·검수 순서

- [ ] TEST_ONLY: 행동/schema 두 신규 시험만 작성하고 지문 동결. 실제 collector를 import하며 부재를 PASS로 숨기지 않는다.
- [ ] Main RED: `node --test tests/unit/FN16/methodology-application-inventory.test.ts tests/unit/FN16/methodology-application-inventory-schema.test.ts`를 직접 실행하고 미구현 실패와 schema 검사를 구분한다.
- [ ] SOURCE_GO 후 신규 source 한 파일에 명시 SELECT·순수 snapshot 소비·현재성·관계/한도를 구현한다. 기존 producer/SQL/helper는 고치지 않는다.
- [ ] 같은 신규 시험, `npm run typecheck`, `git diff --check`를 각각 exit와 함께 보고한다. 기존 완료 단위의 전체검사는 반복하지 않는다.
- [ ] 독립 검수는 실제 producer·null/v1 분기·receipt/previous exact 관계·현재 form 재판정 금지·SQL 범위·현재성/회수를 대조한다. 중요 결함은 별도 반례 RED → 최소 보완한다.
- [ ] Main이 fresh 검증·결과/지문/미검증 기록·checkpoint를 수행한다. Primary는 commit/push/문서 동기화하지 않는다.

필수 합성 사례: 빈 이력, null v1 4/5필드→nonnull v2/v3, nonnull v1, 201 이상 paging, 같은 source를 건너뛰어 재적용하는 정상 역사, 세대간 시각 역전, 잘못된 원hash/sourcehash/graph형식/프로젝트, 세대 gap·중복id·후속null·중복명령, 잘못된 previousRef/명령 ref·actor·request/serverID·기대버전·상태·null 계약·같은사건시각, 원 적용 뒤 현재 source/form/검토 상태 변화에 대한 무조회, marker·큰row·한도/표부재, 양끝 OWNER/세션 교체·총/최소세션기한·취소·BEGIN/rollback/release 불명. 메모리 PG는 SQL 실행·RLS 증거가 아니며 실제 적용/전체 백업/복원은 미완료다.

rollback은 신규 source/test의 검토 revert뿐이며 기존 데이터·자료·버전을 삭제하지 않는다. 이 WI 초안은 제품/시험 작성 GO가 아니다.
## r2 내부 역사 보존 보완 — 적용 이유
FN16 사용자 판단·이력 보존을 위해 application 투영에 reason:string|null을 추가한다. INITIAL_CREATION은조회범위에원명령이없으므로null이며추측작성0,APPLY_COMMAND는검증한receipt.data.reason을원형보존한다. projectionHash/전체contentHash에포함하고기존민감검사/한도를그대로적용한다. 새공개API/DB/권한/실행계약변경0이며기존원명령검증은유지한다. 행동시험에정상보존단언을추가하고MainRED후제품투영한정보완한다.
