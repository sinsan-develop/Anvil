# FN16 작업문맥·실행준비 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **Main 검토 전·구현 GO 아님**

**목표:** 확정 임무에서 준비한 문맥 manifest/items와 이를 소비한 실행준비 이력을 원 이유·미진 상태·명령 증거와 함께 보존한다. 과거 INCLUDED/예약/준비를 현재 원문 권한·실행 허가로 승격하지 않는다.
**방법:** writing-plans 기준 정확 경로·실제 producer·연속 TDD. Main GO 뒤 단독 Primary가 executing-plans 방식으로 RED→GREEN→type/diff, Main 집중 재검증·독립 검수로 진행한다.
**기준:** WORK_PLAN/FUNCTION_WORK FN16의 승인된 내부 metadata 자료 누락 보완. 새 공개 API·DB schema·설정·정책·백업 실행 계약을 만들지 않는다.

## 1. 허용 경로·공통 경계

현재 쓰기는 이 문서 하나다. 구현 GO 후 신규 허용은 정확 다음 3파일이다.

- apps/server/modules/backups/context-preparation-inventory.ts
- tests/unit/FN16/context-preparation-inventory.test.ts
- tests/unit/FN16/context-preparation-inventory-schema.test.ts

기존 source/helper/SQL/시험·보호 untracked8·Git 쓰기 0. 실제 DB/FS/원문/키/서비스/Agent/P03/job·설정 발급·runtime 연결 0. Main이 문서 동기화·상태·통합을 담당한다.

공통 OWNER 양끝 RC/동일 신원/최단 세션기한, 단일 RR READ ONLY, 200 keyset/명시 projection/SQL row-size 억제, query마다 남은 timeout, COMMIT 뒤 취소/기한, BEGIN 불명 client 회수, cleanup503 우선은 FN16_ASSIGNMENT_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §2·3·6·7 및 연결 공통 WI를 따른다. 진행 중 query/pool의 강제취소를 주장하지 않는다. 기존 전체 collector를 호출하거나 공통 코드를 변경하지 않는다.

## 2. 실제 근거와 명시 조회

- db/migrations/0014_context_preparation.sql: bundle16/item12열, manifest 구조·items 완결성·원 명령.
- db/migrations/0016_execution_preparation.sql: preparation15열, intent/국소 scope/basis/미진 조건.
- db/migrations/0046_context_one_time_approval.sql.pending: buildTaskContext의 AUTO/일회소비·bundle/items/receipt 완결성. 실제 적용은 NOT_RUN이다.
- apps/server/modules/context/project-contexts.ts save/#stored, context-input.ts, context-manifest.ts, context-text-plan.ts, context-sources.ts: 원 요청과 manifest 생성 관계. sources.resolve/ProjectContexts.read/list는 현재 권한·원문을 읽으므로 호출하지 않는다.
- apps/server/modules/executions/project-execution-preparations.ts save/read, preparation-input.ts, contracts/runtime/execution-intent-v1.ts·source-scope-v1.ts: 실제 실행준비 원형. save/read/current/candidate 서비스는 호출하지 않는다.
- approvals/project-approvals.ts request/decide/#history/readContextConsumption 및0046: 선택된 원 승인 이력만 적용한다. 다른 ownership/responsibleSession 전용 시간 조건을 이월하지 않는다.

`collectContextPreparationInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ContextPreparationInventory>`

readDocumentInventoryInput(projectId/limits)만 입력받는다. 외부 manifest/배열·actor/client·파일경로·실행 옵션 입력 0.

| 표 | 명시 허용 열 | 선택/정렬 |
|---|---|---|
| context_bundles (16) | project_id,id,version,assignment_id,assignment_version,assignment_hash,assignment_ref,baseline_refs,budget_ref,manifest_json,request_payload,content_hash,created_by,client_id,command_id,created_at | 프로젝트 전체, id UUID ASC |
| context_items (12) | project_id,bundle_id,bundle_version,item_id,category,required,source_ref,source_hash,included_state,reason,delivery_parts,issue | 프로젝트 전체, (bundle_id UUID,bundle_version bigint,item_id COLLATE C) ASC |
| execution_preparations (15) | project_id,id,version,assignment_id,assignment_version,binding_id,binding_version,bundle_id,bundle_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, id UUID ASC |
| assignment_versions (선택7) | project_id,assignment_id,version,content_hash,version_json,created_by,created_at | bundle/intent의 exact assignmentRef 집합만 |
| assignment_draft_versions (선택5) | project_id,draft_id,version,content_hash,version_json | 선택 확정 임무의 exact draftRef 집합만 |
| role_bindings (선택7) | project_id,binding_id,version,content_hash,snapshot_json,created_by,created_at | preparation intent의 exact roleBindingRef 집합만 |

보조 command19/auth9/audit16·approval request17/decision14/consumption8 명시 열은 FN16_RESPONSIBLE_SESSION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §2의 동일 목록을 사용한다. 대상은 이 단위의 bundle/preparation 서버 command ID와, bundle 일회소비가 참조한 요청/결정 명령뿐이다. 선택 assignment/draft/binding의 명령과 전체 이력을 재수집하지 않는다. 각 보조 exact id/version 집합은200씩 조회하며 다른 버전까지 읽고 조용히 버리는 방식은 금지한다.

item keyset의 비교·ORDER BY·최종 정렬에 동일 C collation을 쓰고 JS는 같은 ASCII itemId 순서를 대조한다. 전체 items를 읽어 고아 bundle·중복·누락도 검출한다. SELECT *·OFFSET·최신200으로 전체 이력을 대체하지 않는다. JSON timestamp·canonical bigint 안전정수 처리, 표/열 부재503 및 raw fallback0을 유지한다.

## 3. 문맥 manifest와 item의 실제 국소 정합

1. bundle.version=1. ref={id,version:1,contentHash:canonical(manifest_json) hash}. 원 manifest는 정확22필드: id,projectId,version,preparationInput,assignmentRef,baselineRefs,purposeRef,constitutionRef,latestInstructionRefs,currentPositionRef,items,sourceBindings,missingRequired,excluded,deliveryPlan,budgetRef,unverified,sourceAuthorizationVerified,budgetVerified,ready,executionAuthorized,dispatchPerformed. 원 hash·기존2MiB 한도·민감 표식을 검사한다. 마지막5 boolean은 모두false다.
2. readContextPreparationInput(row.request_payload)의 정규화된 값=manifest.preparationInput. **원 command request_hash는 정규화 전 저장 request_payload 원형**으로 재구성한다. 사용자 slots 순서가 정규화될 수 있으므로 원 요청을 바꿔 hash하지 않는다. manifest의 assignment/budget와 행의 assignment_id/version/hash/ref·baseline_refs/budget_ref를 정확 대조한다.
3. 선택 확정 임무의 원 snapshot hash·draftRef·definition·confirmedBy/At·contentConfirmed=true/ready=false/executionAuthorized=false/dispatchPerformed=false를 검사한다. 원 definition의 baselineRefs/budgetRef가 manifest와 같다. 선택 draftRef 원 snapshot hash와 실제 basis 구조/definition 관계를 검사하되 현재 head/검토 적합성은 재조회하지 않는다. 기존 pure assignment 입력/확정 형식 검증만 재사용하며 draft snapshot에 새2MiB 제한을 추가하지 않는다.
4. 입력7슬롯/선택 최대200·source 종류 제한은 기존 parser 그대로다. 슬롯 순서·sources 순서로 expected itemId를 만든다: 선택이 있으면 CODE_1..N, 없으면 CODE. items/sourceBindings는 같은 순서·개수(7..207)다. item 정확9필드 및 sourceBinding 정확4필드(itemId,selection,bodyRef,sourceState)를 검사한다. required=true, category/선택ref/sourceHash/이유는 원 슬롯과 같아야 한다. 별도 context_items 행과 manifest items는 정확 전체 집합이 같다.
5. sourceState와 issue의 허용 목록은0014 context_preparation_manifest_valid의 states/issues 상수에 한정한다. 선택없음은 MISSING/bodyRef null/NOT_SELECTED, state별 issue·deliveryParts와 원 관계를 보존한다. **MISSING/REDACTED에서도 분할 실패 등에 의해 bodyRef가 남는 정상 원형을 일괄 null 강제하지 않는다.** sourceBinding의 bodyRef nonnull은 기존 textArtifact 형식이며 원문을 읽지 않는다.
6. deliveryPlan은 정확 state,parts,multipartRequired,limits 4필드, PREPARATION_ONLY와 입력 limits. INCLUDED에는 bodyRef와 1개 이상 part·issue null, 비INCLUDED에는 deliveryParts=[]다. part는 정확8필드(partId,itemId,sourceRef,bodyRef,order,byteOffset,utf8Bytes,contentHash), item/local 순서의 partId·전체 order1..N·item별 offset0부터 연속·각 양수 utf8Bytes<=maxPartBytes를 검사한다. item별 합계=bodyRef.bytes, 포함 bytes 총계<=2MiB, parts<=maxParts<=200, multipartRequired=(parts.length>1). 남는/중복 part·고아 item을 거절한다.
7. part.contentHash는 유효 hash 형식과 저장 metadata 관계만 검사한다. 원문 text가 없으므로 buildContextManifest/planContextText에 가짜 text를 공급하거나 part/body hash를 재계산했다고 주장하지 않는다. 원 manifest hash와 원문 byte hash 검증은 별개다.
8. purposeRef=PURPOSE_REASON 첫 선택ref/null, latestInstructionRefs=LATEST_INSTRUCTIONS 원 messageRef 순서, currentPositionRef=해당 슬롯 선택1개일 때만 ref/아니면null. missingRequired는 비INCLUDED itemId 순서, excluded는 EXCLUDED itemId 순서. unverified는 builder의7개 고정 목록과 CURRENT_POSITION 선택2개 이상일 때 CURRENT_POSITION_AMBIGUOUS가 뒤에 붙은 정확 배열이다. constitutionRef는 null/exact VersionRef 역사로만 보존하며 현재 헌법 application을 조회하지 않는다.
9. context_items에는 command_id가 없다. 모든 item은 해당 bundle의 **하나의 buildTaskContext command/receipt**에 종속된다. item마다 새 명령/receipt를 발명하지 않는다. execution_preparation은 별도 prepareExecution 명령이다.

## 4. 실행준비와 선택 참조

- preparation.version=1, ref=원 snapshot_json hash, 기존2MiB 한도. snapshot 정확9필드: intent,basisRefs,latestInstructionRefs,checkedAt,missingConditions,authorizationState,preparedBy,executionAuthorized,dispatchPerformed. preparedBy는 원 행 actor, checkedAt/행/receipt/command 완료는 같은 사건 밀리초 시각. NOT_AUTHORIZED/false/false 유지.
- intent 정확11필드는 readExecutionPreparationInput으로 검증한다. generated assignment/binding/bundle id/version은 intent refs와 같다. 내부 bundle exactref·동일 assignment를 확인한다. 선택 binding 원 snapshot14필드/hash/같은사건 boundBy/At·assignmentRef/connectionRef·RESERVED/null/false/false를 대조한다. binding 현재 최신 여부는 검사하지 않는다.
- 실제 선택 assignment.definition.allowedScopes와 intent.sourceScopes를 readSourceScopesV1로 읽고 producer withinScope와 동일한 exact sourceRoot/mapping/observation/baseline 및 target(relativePath/kind/recursive=false/access) 부분집합을 대조한다. WRITE→READ 추정이나 실경로·OS 접근으로 확대하지 않는다. 선언 상대경로는 승인된 intent metadata이고 실제 source path 조회가 아니다.
- basisRefs는 선택 draft.basis.planRef,designRef,applicationRef + manifest.baselineRefs + nonnull constitutionRef를 원 순서대로 결합 후 exact 중복을 제거한 배열이다. 후보 배열<=200·최종 refs 형식 및 순서를 지킨다. latestInstructionRefs는 내부 manifest와 같다.
- missingConditions에는 실제 producer의7개 고정 미해결 항목이 들어간다. REQUIRED_CONTEXT_MISSING은 manifest.missingRequired 유무, UNDERSTANDING_NOT_REVIEWED는 mode WORK와 정합한다. CURRENT_CONTEXT_CHANGED는 당시 currentCheck 관측이 저장되지 않았으므로 존재/부재를 그대로 보존하고 현재 source를 재조회해 재판정하지 않는다. 원 producer 순서(고정7→필요한 context missing→관측된 current changed→필요한 understanding)·중복0·허용10코드를 검사한다.
- capabilityRef/budgetPolicyRef/environmentRef/connectionRef의 형식은 유지하되 실제 candidate body/최신 head·만료·policy·capability·provider 보호참조를 읽지 않는다. 선택 assignment/draft/binding의 전체 명령·검토·승인 검증은 NOT_PERFORMED이며 기존 수집기를 재호출하지 않는다.

## 5. 명령·승인과 역사 경계

| 원 자료 | operation / target / expected | payload | receipt data / reason |
|---|---|---|---|
| bundle 및 종속 items | buildTaskContext / null / 0 | 저장 request_payload 원형 | ref,status:CONTEXT_PREPARED,ready:false,executionAuthorized:false,dispatchPerformed:false / EXPLICIT_CONTEXT_PREPARATION |
| preparation | prepareExecution / null / 0 | snapshot.intent | ref,status:EXECUTION_PREPARED,snapshot / EXPLICIT_PREPARATION_NOT_AUTHORIZATION |

두 원 요청 baselineRefs=[]이며 prepareExecution approvalRef/consumption/payload_ref는 반드시null이다. bundle은 AUTO(null) 또는0046의 exact 일회소비다. 별도 실행준비에 일회승인 지원을 임의 추가하지 않는다.

command/auth/audit의 exact PROJECT/APPLIED·actor/client·scopeDigest·receipt/ref/사건시각·사용자 요청 hash·고유성은 앞선 책임세션 WI §4와 같되 operation/receipt는 위 표다. `(project,actor,사용자commandId)` 유일성을 모든 distinct 명령에 적용하고 operation을 유일키에 넣지 않는다. bundle 감사가 그것을 소비한 preparation 감사보다 먼저여야 한다. 서로 다른 거래의 시각 단조는 요구하지 않는다.

bundle 소비는 같은RR의 exact consumption→decision→request 및 이들의 원 command/auth/audit로 검증한다. 원 request7필드/decision9필드 hash, CONSUMED 현재3과 PENDING 불변1, APPROVE/원 subject/client/control/policy/candidate user commandId·payloadHash=원 request_payload hash·nulltarget/expected0·scopeDigest·ONE_TIME_APPROVAL_SCOPE·auth 결정ID/audit approvalRef를 대조한다. requestApproval payload={details}/null0, decideApproval payload={requestId,expectedVersion:1,scopeDigest,decision:APPROVE,reason}/requestId1의 원 hash·receipt도 확인한다. 요청 감사→결정 감사→bundle 감사 순서를 유지한다.

**시간 조건을 복사하지 않는다.** context의 기존 #stored/#history/0046에는 소비 시각을 요청/결정 시각과 대소 비교하는 책임세션/ownership 전용 하한이 없다. 소비 시각의 유효 형식은 검사하지만 consumedAt>=createdAt/decidedAt 같은 새 하한을 추가하지 않는다. 현재 만료·정책·제어 검사도 과거를 거절하는 이유가 아니다. 실제0046의 현재기한 검증이 수행됐다는 운영 증거를 이번 합성검사로 대체하지 않는다.

## 6. 반환·원문 미검증·한도

내부 kind=CONTEXT_PREPARATION_INVENTORY_V1, scope=PROJECT_CONTEXT_PREPARATION_HISTORY_ONLY. bundles(원ref+manifest), preparations(원ref+preparedBy 익명snapshot), 선택 approvals 익명 역사, externalDependencies 및 기존 observation/usage를 반환한다. 별도 items 배열을 중복 반환하지 않고 manifest items와 DB 전체집합 일치로 보존한다. 각 투영 projectionHash와 원 ref.contentHash를 구분한다. 전체 inventoryHash=canonical `{kind,projectId,bundles,preparations,approvals,externalDependencies}` 6필드 hash, 관측시각/usage는 제외한다.

원 hash/증거 검증 뒤 actor/client를 HUMAN·REDACTED로 투영하며 raw command/auth/audit·토큰/오류 cause/원문 text·provider 보호참조·키값은 반환하지 않는다. 선택 임무/draft/binding 원문은 결과에 재출력하지 않는다. 공개 exact 외부ref와 선언된 sourceScopes metadata만 보존한다. known marker가 있는 손상 metadata는 고정503이다.

sourceBindings/deliveryPlan의 실제 bodyRef는 원 artifact 참조로 dedup하여 외부의존에 남긴다. 같은 artifactId에 상충 bytes/hash/mediaType은 거절한다. unique bodyRef의 fileCount·선언 bytes 합계는 기존 input limits의 fileCount/inputBytes에 대조하고 overflow를 거절한다. 이는 **선언량**이며 실제 바이트 읽기/검증이 아니다. 모든 조회와 반환 UTF-8 metadataBytes 한도·정확 자기자리수 계산을 유지한다.

sourceByteVerification/partHashVerification/currentSourceVerification/selectedReferenceEvidenceVerification/currentPermissionVerification=NOT_PERFORMED. atomicSnapshotVerified/fullProjectCoverage/restorable/ready/executionAuthorized/dispatchPerformed=false. sourceAuthorizationVerified/budgetVerified는 원 false를 보존한다. 원문·실제 PG/RLS/0046 적용·보호 FS·UI/백업 생성/복원·runtime 호출선은 NOT_RUN/미연결이다.

## 7. 한정 연속 TDD와 완료 기준

- [ ] 실제 pure 입력과 synthetic text로 정상 fixture를 만든다. 제품에는 text를 주입하지 않는다. 빈7슬롯, INCLUDED 분할/누락/격리/제외·nonnull bodyRef가 남는 분할실패·원 slots 비정규순서·현재위치 다중선택·양승인·CONTEXT_REVIEW/WORK·현재성미진 보존·과거 다른actor·201페이지 정상.
- [ ] manifest/item/part/ref/hash/offset/순서·누락/고아/중복·원budget/baseline·selected assignment/draft/binding·범위부분집합·basisRefs/미진 flags 손상 및 snapshot과 원명령 hash를 재결박한 관계 반례를 작성한다. 원문 부재를 가짜 hash 재계산으로 통과시키지 않는다.
- [ ] AUTO/소비·요청/결정/command/auth/audit 정확 결박과 유일성·소비 시각 정상 역전·같은사건 불일치, declared artifact 중복/상충/총량·민감 metadata, OWNER/양끝신원/최단기한·COMMIT뒤취소·회수불명 핵심을 검증한다. schema 시험은 실제16/12/15열·명시SELECT/C keyset/공유 item 관계·읽기 전용을 확인한다.
- [ ] Main 범위 GO 후 신규2시험 RED 실제 실행·원 결과 보존→신규 source1 GREEN. 기대값/검사강도 완화0. 실제 producer와 다른 fixture는 근거·최소 diff로 보정한다. 같은 근본 원인3회는 Main에 인계한다.
- [ ] `node --test tests/unit/FN16/context-preparation-inventory.test.ts tests/unit/FN16/context-preparation-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check` 각각 exit/결과·3지문·미검증을 제출한다. 기존 완료 collector 전수 재시험0. Main 집중 새검증·독립 C/I 확인 후 통합한다.

새 제품·시험3개만 source rollback 가능하며 실제 DB rollback은 없다. 다음 실행·승인 전체 이력이나 미채택 정책·public profile·백업 job을 이 문서에 포함하지 않는다.
