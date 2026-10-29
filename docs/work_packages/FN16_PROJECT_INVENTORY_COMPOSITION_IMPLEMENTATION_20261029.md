# FN16 기존 프로젝트 수집 결과 내부 조합 작업지시서

> 구현 담당: 기존 fn16_primary 단독. `superpowers:executing-plans`로 RED→GREEN을 연속 수행한다. 현재는 Main 검토용 문서이며 제품/시험 GO가 아니다.

**목표:** 이미 구현된 자료군을 실제 호출하여 관측 식별·원결과 지문·정확 참조의 존재/충돌/누락을 한 내부 결과로 묶는다.
**구조:** 고정 수집 순서, 하나의 총한도와 로그인 신원 경계, 명시적인 종류별 참조 map. 각 수집기는 자신의 RR을 유지하므로 조합은 원자 snapshot이 아니다.
**기술:** 기존 Node24/TypeScript/pg·canonicalJson·node:test만. 새 의존성/설정/공개 API/정책/SQL/Job/파일 반출 없음.
**근거:** 설계 §10.4, FUNCTION_WORK FN16, 기존 자료군 WI와 검수 source, Main의 내부 조합 지시. 수동 정책 후보158E10BC는 NOT_ADOPTED로 유지한다.

## 1. 정확 범위와 산출물

신규 3경로만 후속 구현 후보다.
- `apps/server/modules/backups/project-inventory-composition.ts`: 고정 imports·조합·참조/관측 검사.
- `tests/unit/FN16/project-inventory-composition.test.ts`: 실제 collector와 메모리 access/DB의 업무 검증.
- `tests/unit/FN16/project-inventory-composition-schema.test.ts`: 정확 호출 목록·SQL/비밀/권한 경계 정적 대조.

기존 collector/helper/route/SQL/시험은 수정하지 않는다. 보호8 및 사용자 자료 보존. 실제 DB·원문 파일·키·서비스·Agent·Git 실행/변경0. Main은 관리 문서·Git·독립 검수를 소유한다.

## 2. 내부 함수와 현재 권한

`composeProjectInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ProjectInventoryComposition>` 하나만 export한다. 입력은 기존 `readDocumentInventoryInput`의 projectId/limits 그대로이며 include/정책/ref/provider 선택이나 외부 inventory 입력을 추가하지 않는다. 순서/수집기를 호출자가 교체하지 않는다.

기존 `artifact-current-verification.ts`의 guardedAccess와 경계를 읽기 참조하되 파일을 변경하거나 별도 새 public helper를 만들지 않는다. 시작 RC와 마지막 RC에서 현재 OWNER/프로젝트 보관상태·동일 actor/client/credentialGeneration/authSession을 검사한다. 각 child authenticated의 callback SQL **전** 최초 신원을 대조하고, child가 이미 읽는 정확 `SELECT clock_timestamp() AS at`의 유효 Date와 고정 actor expiry로 최소 세션기한을 누적한다. callback 성공인데 clock을 관측하지 못했으면 실패한다. db/client 원객체를 mutation하지 않고 좁게 위임하며 기존 pool은 직접 위임한다. 시작/중간/끝의 원authenticated 외부 COMMIT 뒤에도 취소·총기한을 검사한다. 축소된 만료를 후속 관측으로 연장하지 않는다.

child당 새로운 deadline을 시작하지 않는다. 전체 performance.now 시작점에서 남은 최소 시간/세션기한만 전달하며 child RC/RR의 기존 query timeout은 유지한다. 진행중 pool/query를 Promise.race로 떼어 정상 release하지 않는다. 실제 PG 대기 강제종료/전체 실시간 상한 보장은 미검증이다. 각 child의 회수 완료 뒤 다음 child를 호출한다. 회수불명503을 취소/기한으로 숨기지 않는다.

## 3. 실제 호출 고정 목록과 원결과 hash

아래 순서로 각 기존 export를 정확 한 번 호출한다. 입력 limits 중 metadataBytes/deadlineMs만 전체 **잔여** 상한이다. fileCount/inputBytes는 최초 전체 상한을 그대로 전달하고 child 반환 뒤 전역 exacttuple 합집합을 검사한다(§5). 파일명은 `apps/server/modules/backups/` 기준이고 함수는 해당 파일의 `collect...Inventory`다. 전체 결과를 반환하지 않고 내부 검증 후 요약한다.

| 파일 / 함수 중간 이름 | 기존 원 hash의 정확 projection 필드 |
|---|---|
| document-inventory / Document | 기존 전체 hash 없음. 보충 `resultDigest=hash(canonicalJson(실제 child 결과 전체))`만 계산; 원 문서 hash로 부르지 않음 |
| conversation-inventory / Conversation | projectId,conversations,messages,artifacts,issues,externalDependencies |
| knowledge-inventory / Knowledge | projectId,entries,versions,events,reviews,constitutionApplications,currentConstitution,artifacts,issues,externalDependencies |
| work-plan-inventory / WorkPlan | projectId,plans,versions,tasks,dependencies,reviews,confirmations,issues,externalDependencies |
| design-trace-inventory / DesignTrace | projectId,designItems,screenRegions,traceEdges,issues,externalDependencies |
| design-change-inventory / DesignChange | projectId,changes,impacts,issues,externalDependencies |
| baseline-inventory / Baseline | projectId,activations,current,rechecks,issues,externalDependencies |
| project-methodology-inventory / ProjectMethodology | projectId,definitions,versions,reviews,confirmations,issues,externalDependencies |
| methodology-application-inventory / MethodologyApplication | projectId,applications,issues,externalDependencies |
| notification-inventory / Notification | projectId,notifications,issues,externalDependencies |
| assignment-inventory / Assignment | projectId,drafts,draftVersions,reviews,confirmations,issues,externalDependencies |
| responsible-session-inventory / ResponsibleSession | kind,projectId,roles,sessions,bindings,approvals,externalDependencies |
| context-preparation-inventory / ContextPreparation | kind,projectId,bundles,preparations,approvals,externalDependencies |
| execution-control-inventory / ExecutionControl | kind,projectId,executions,grants,commands,reservations,writers,revocations,outbox; externalDependencies는 별도 externalDependenciesHash |
| stage-budget-inventory / StageBudget | kind,projectId,stageRuns,queueRequests,limitPolicies,usageReservations,approvals,externalDependencies |
| observation-inventory / Observation | kind,projectId,observations,acknowledgements,observationResults,proofResults,externalDependencies |
| understanding-permit-inventory / UnderstandingPermit | kind,projectId,understandingReviews,startPermits,instructionPermits,proofResults,externalDependencies |
| result-submission-inventory / ResultSubmission | projectId,submissions,issues,externalDependencies |
| result-review-history-inventory / ResultReviewHistory | projectId,criteria,reviews,reworks,issues,externalDependencies |

history 계열은 기존 contentHash, kind 포함 실행 계열은 기존 inventoryHash를 명시 대조한다. 모든 child에 별도로 resultDigest를 계산한다. key 이름을 반사 탐색하거나 처음 발견한 hash를 전체 hash로 취급하지 않는다. observation은 각 원 snapshot/startedAt/finishedAt/isolation/readOnly/authBoundary를 그대로 보존하고 projectId/kind·UTF8 크기·false 계약을 검사한다. 동일 snapshot 문자열도 같은 transaction이라는 증거가 아니다.

## 4. 참조 map과 해소의 제한

map의 기본 key는 **자료 namespace + projectId + 필요한 execution/generation/conversation scope + id/version**이다. contentHash가 같은 경우만 EXACT_REFERENCE_PRESENT다. 같은 key의 다른 hash는 조용히 덮지 않고503 `PROJECT_INVENTORY_REFERENCE_CONFLICT`로 전체 조합을 거절한다. 원자료 손상 또는 시점 변화 중 어느 원인인지 확정하지 않는다. 다른 projection 모양/익명화 방식끼리 projectionHash가 다르다는 이유만으로 충돌시키지 않는다.

고정 provider map은 아래 선택한 실제 DTO 경로만 사용한다. 재귀적인 모든 ref 탐색, 임의 kind 유추, id-only를 VersionRef로 합성하는 행동은 금지한다.

| namespace | 명시 provider 경로 |
|---|---|
| DOCUMENT_VERSION | document.versions[].sourceRef |
| FORM_VERSION / METHODOLOGY_VERSION | document.forms/methodologies의 기존 id/version/contentHash; projectMethodology.versions[].ref 추가 |
| AUTHORING_STANDARD | document.standards[].ref |
| METHODOLOGY_APPLICATION | methodologyApplication.applications[].ref; document.applications의 id/applicationVersion/snapshotHash도 동일 namespace로만 비교 |
| WORK_PLAN_VERSION | workPlan.versions[].ref |
| DESIGN_CHANGE / DESIGN_IMPACT / BASELINE_ACTIVATION | designChange.changes/impacts의 기존 ref, baseline.activations[].ref |
| KNOWLEDGE_VERSION / CONSTITUTION_APPLICATION | knowledge.versions[].ref / constitutionApplications[].ref |
| ASSIGNMENT_DRAFT_VERSION / ASSIGNMENT_VERSION | assignment.draftVersions[].ref / confirmations[].ref |
| ROLE / AGENT_SESSION / ROLE_BINDING | responsibleSession.roles/sessions/bindings[].ref |
| CONTEXT_BUNDLE / EXECUTION_PREPARATION | contextPreparation.bundles/preparations[].ref |
| EXECUTION_GRANT / EXECUTION_COMMAND / USAGE_RESERVATION | executionControl.grants/commands/reservations[].ref; stageBudget.usageReservations[].ref도 동일 예약 namespace |
| LIMIT_POLICY_VERSION / QUEUE_REQUEST | stageBudget.limitPolicies/queueRequests[].ref |
| UNDERSTANDING_REVIEW / START_PERMIT / SEND_PERMIT | understandingPermit.understandingReviews/startPermits/instructionPermits[].ref; 각 실행 scope 유지 |
| OBSERVATION / ACK / PROOF_RESULT | observation.observations/acknowledgements/proofResults[].ref; ACK는 반드시 snapshot.execution scope 포함. understandingPermit.proofResults의 원ref도 PROOF_RESULT로 비교 |
| RESULT_SUBMISSION / RESULT_CRITERIA / RESULT_REVIEW / RESULT_REWORK | resultSubmission.submissions[].ref / resultReviewHistory.criteria/reviews/reworks[].ref |
| APPROVAL_REQUEST / APPROVAL_DECISION | responsibleSession/contextPreparation/stageBudget.approvals[].requestRef/decisionRef; notification.notifications[].request.ref는 요청으로만 비교 |
| CONVERSATION_MESSAGE | conversation.messages[].sourceRef의 id/contentHash + conversationId. version 없는 원형 유지 |
| ARTIFACT | document.artifactRefs, conversation/knowledge.artifacts의 artifactId/bytes/contentHash/mediaType, contextPreparation.externalDependencies 중 ARTIFACT의 원 tuple |

입력 provider에 존재하지 않는 경로/형식은 자동 대체하지 않고 고정503으로 처리한다. 위 표에서 지원하지 않는 원형(예: trace edge의 별도 edgeHash, 승인 consumption ID, COMMAND ID, AUTHORIZATION_RECEIPT ID)은 원 의미를 보존한 외부의존으로 남기며 원hash나 가짜 VersionRef를 발급하지 않는다.

소비 대상은 각 child의 **externalDependencies 전부**이며 원형과 출처 child를 보존한다. 명시 alias만 허용한다: DESIGN_VERSION→DOCUMENT_VERSION, METHODOLOGY→METHODOLOGY_VERSION, BUDGET_POLICY→LIMIT_POLICY_VERSION, RESPONSIBLE_BINDING_REFERENCE→ROLE_BINDING, ROLE_REFERENCE→ROLE, STAGE_SESSION_REFERENCE→AGENT_SESSION. BASELINE_VERSION은 BASELINE_ACTIVATION으로 자동 대체하지 않는다. FORM/METHODOLOGY 등 원 kind가 뜻하는 자료가 분명하지 않으면 EXTERNAL_UNSUPPORTED로 유지한다. CONVERSATION_MESSAGE는 원 conversationId까지 요구한다. ARTIFACT VersionRef만 있는 DECLARED_ARTIFACT_REFERENCE를 bytes tuple로 바꾸지 않는다.

각 dependency 판정은 다음 중 하나다.
- EXACT_REFERENCE_PRESENT: 지원 namespace/scope와 정확 원ref가 조합 안에 있음. 원문검증/권한/복원 가능 판정이 아님.
- COLLECTED_REFERENCE_ABSENT: 해당 provider 자료군은 실제 수집했으나 원하는 ref가 없음. 다중 시점의 추가/삭제 가능성을 포함하며 전체 관계 일치를 주장하지 않음.
- NOT_COLLECTED: 아래 미수집 자료군에 해당함.
- EXTERNAL_UNSUPPORTED: 원문이 가리키는 종류/ID-only/별도 hash 표면의 해소를 이번 map이 지원하지 않음.

child issues·원 미검증/미수집 필드는 제거·덮어쓰지 않는다. 과거 child의 stageQueueHistory NOT_COLLECTED 등은 원 관측 범위의 선언이므로 다른 child가 있어도 원문을 수정하지 않고 조합의 별도 존재 판정만 기록한다. 모든 dependency가 해소되더라도 전체 coverage나 atomic 성공은 발급하지 않는다.

## 5. 한도·반환·고정 미수집

전체 metadataBytes는 각 child의 실제 canonical UTF8 크기를 누적하고 최종 결과 UTF8 크기까지 합산한다. 중복 자료도 메모리/전송 작업량에서는 차감하지 않는다. child usage의 크기/안전정수를 검사하며 반환계수 자체의 자리수를 포함해 최종 크기를 안정화한다. 각 child에는 남은 metadata 상한만 전달하므로 전체상한을 child 개수만큼 늘리지 않는다.

artifact 정확 tuple은 전역 map에서 한 번만 fileCount/inputBytes에 계수하고, 동일 artifactId의 bytes/hash/mediaType 충돌은503이다. 이 값은 **declared** bytes이며 실제 읽은 바이트/파일검사 PASS가 아니다. child 내부의 fileCount/inputBytes는 최초 전체 상한을 유지한다. 이미 본 artifact가 다음 child에도 존재할 수 있으므로 이 두 값을 잔여치로 차감해 전달하지 않는다. 반환 뒤 새 exacttuple만 전역 합집합에 반영하여 전체 한도를 검사하며 초과 시 후속 child 호출 없이 실패한다. 이는 실제 bytes 읽기 작업량 한도나 child의 사전 모든 메모리 사용량 보장을 뜻하지 않는다. 새 무제한 기본값은 없다. signal/deadline/metadata 초과 뒤 후속 child 호출0. 부재 source, child 실패·권한변경·충돌·한도를 빈 성공으로 바꾸지 않는다. 입력400/인증401/OWNER404/취소409/한도·기한413과 내부 고정503만 반환하고 raw child/SQL/cause를 노출하지 않는다. 반환 결과의 issues가 비어 있어도 고정 notCollected와 외부의존 판정은 남는다.

반환은 닫힌 내부 `{kind:'PROJECT_INVENTORY_COMPOSITION_V1',projectId,components,references,dependencies,notCollected,issues,observation,usage,compositionHash,atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false,blobVerification:'NOT_PERFORMED'}`다. components는 고정 child명/kind/resultDigest/기존 원hash 또는 null/원 observation/원 issues·미검증 선언/행별 집계만 반환한다. raw child 전체, 원문본문, actor/client/token, 원grant/envelope/보호참조 경로를 재반환하지 않는다. references는 namespace/scope/ref/출처만, dependencies는 원 참조·출처·위 판정만 보존한다. compositionHash는 usage/observation을 제외한 의미 projection의 canonical hash로 명시 계산하며 byte checksum/portable archive hash로 부르지 않는다.

고정 notCollected에는 다음을 항상 명시한다: 전체 permission 정책/승인·명령·auth·감사 원장, 본인 공통자료 전체·공통 감사, 연결/등록/source-root 설정의 비밀 제외 전체 이력, 프로젝트 생성초안/첨부 귀속·제어 인계·baseline 초안, 지식 공유요청, 선택 export 및 backup 보호참조 설정 이력, 미참조/결과 첨부·checkpoint 원문, 소스/미커밋 파일, 실제 blob검사·암호화 archive·검증복원. 기존 선택 증거가 있다는 사실과 자료군 전체 미수집을 구분한다. 외부 Agent 계정·credential·challenge·서명/키 원문은 계약상 제외다.

158E10 미채택의 정책 payload/include/sourceSelection/GET/영속 구조 및 전체 검증프로필을 구현하지 않는다. 이 조합 결과는 coverage 공급 포트의 READY·저장허가로 쓰지 못한다. 실제 사용자 backup 조합/API로 연결하려면 해당 계약/전체 profile·원문·archive·복원 선행이 별도로 필요하다.

## 6. 단일 업무 TDD·검수

- [ ] 새 행동/schema 시험 작성: 기본 경로에서 19 실제 collector 호출·빈 관측 정상(전체 성공 아님), 최소 실제 문서→계획 또는 임무→context 두 자료군 ref 연결, 서로 다른 RR snapshot 보존.
- [ ] 참조 반례: 동일 namespace/id/version 다른 hash503, 서로 다른 namespace·execution scope 같은 ID 정상, projectionHash 차이는 원ref 충돌과 구분, 수집했으나 ref없음/미수집/ID-only외부 분리, artifact exacttuple 중복1회/변조503.
- [ ] 신원/한도 반례: child SQL전 신원변경0SQL, 중간만료 축소 보존·clock누락, 마지막 외부 COMMIT 뒤 취소, 누적metadata초과 뒤 후속0, child회수불명503·원오류비밀노출0. 원 child 미검증과 NOT_COLLECTED 유지. 동일 artifact가 두 child에서 각각 한도에 정확히 도달해도 전역 합집합은 한 번만 계수하는 정상, 서로 다른 artifact 합집합 초과 음성을 분리한다.
- [ ] RED 명령: `node --test tests/unit/FN16/project-inventory-composition.test.ts tests/unit/FN16/project-inventory-composition-schema.test.ts`. 미구현 RED를 원형 보관하고 같은 담당이 구현한다. 의존 결과를 외부에서 넣어 실제 소비를 건너뛰는 시험만으로 완료하지 않는다.
- [ ] 동일 집중 GREEN 및 `npm run typecheck`, `git diff --check`, 신규파일 LF/EOF/지문 검사. 기존 완료 collector 전수 재실행0.
- [ ] Main fresh 집중 검증·독립 검수→지정 파일만 checkpoint. Primary Git0. rollback은 신규 내부 함수/시험의 검토된 revert이며 데이터 삭제0.

실제 PG/RLS·시간상한/동시변경·전체 자료 무결성·원문FS·키·서비스·UI·사용자 backup/restore는 NOT_RUN이다. 개별 collector의 합성 PASS를 실환경이나 전체 FN16 완료로 승격하지 않는다.
