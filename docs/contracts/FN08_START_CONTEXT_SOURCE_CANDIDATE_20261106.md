# FN08 START ContextBundle 원문 source 계약 후보

상태: **DRAFT / NOT_ADOPTED / SOURCE_GO0**
작성일: 2026-11-06
대상: 신산님 직접 채택 판단용. 문서 작성은 코드·실제 원문 조회·실행 승인이 아니다.

## 1. 판정과 선택

권장 A는 원 ContextBundle을 보호 재검산해 선택 원문과 출처를 고정 canonical JSON으로 구성하고, 실제 bundle VersionRef를 세 목적 참조로 해석하는 **새 선택 후보**다. 기존 계약의 유일한 해석이라고 주장하지 않는다. 새 표·공개 API·executor 권한·실제 공급 기본값은 제안하지 않는다.

USER_INSTRUCTION·DD166F·실제 보호 원문 전달 제외는 보존한다. 같은 HUMAN actor/Tx가 원문을 읽을 수 있다는 사실만으로 connector 전달을 허용하지 않는다. 실제 grant의 명시 sourceScopes와 해당 원문 접근의 대응 producer가 없으면 source port는 계속 미연결/거절이다. A를 구현해도 실제 START 공급·Agent 실행 기능 완료가 아니다.

사용자 설명: “준비한 맥락의 정확한 버전과 출처를 확인하고 정해진 JSON으로 재구성하는 코드·합성 검증만 진행합니다. 실제 사용자 원문 전달이나 Agent 권한은 켜지 않으며, 자료·권한 근거가 없으면 계속 거절합니다.”

## 2. 실제 근거와 원형

작성 시점 실제 경로·행이다. 후속 변경 시 원 심벌/본문을 다시 대조한다.

| 근거 | 확인한 의미 |
|---|---|
| docs/design/Anvil_설계서_v3_초안.md:404-418, §8.1/8.1.1 | 원문 출처·버전/hash·포함/누락과 접근을 검산하고 수신 가능한 방식으로 분할한다. URL/DB ref만으로 실제 수신/이해를 주장하지 않는다. |
| docs/WORK_PLAN.md:1494 | FN05 buildTaskContext 일회 승인·원 명령 저장/고정조회 소스 검수와 실제 전달/Agent 미실행을 구분한다. |
| docs/contracts/FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md §1-3/§6/§8 | 실제 context 원문 접근·executor 권위·USER_INSTRUCTION·DD166F는 기존 제외다. source 부재 성공 대체0이다. |
| docs/work_packages/FN08_START_MATERIAL_REGISTRATION_SOURCE_IMPLEMENTATION_20261106.md:11/56 | source/current 소비와 실제 원문 producer를 구별한다. 없는 source는 SOURCE_UNAVAILABLE다. |
| apps/server/modules/context/project-contexts.ts:24-34/37-80 | 같은 HUMAN command Tx의 source.resolve→manifest→receipt→bundle/items 저장. 원 request/receipt/audit·승인소비·manifest/items 완결과 현재 재계산을 검산한다. |
| apps/server/modules/context/context-sources.ts:27-96 | 같은 actor로 임무·현재 헌법·지식/문서/사용자 지시 보호 reader를 소비해 text 부분을 계산한다. |
| apps/server/modules/context/context-input.ts:8-15/29-55 | 고정7슬롯·선택 배열을 검산하고 슬롯을 고정 순서로 정규화한다. |
| apps/server/modules/context/context-text-plan.ts:26-79 | 원문 UTF-8 길이/SHA·민감자료·분할/상한을 검산한다. |
| apps/server/modules/context/context-manifest.ts:28-69 | text를 검산한 뒤 metadata만 manifest에 저장하며 실제 ref를 그 canonical SHA로 만든다. |
| apps/server/modules/executions/execution-start-material-registration-input.ts:6-8/26-31 | START source는 VersionRef3와 별도 bytes SHA/길이/mediaType를 요구한다. |
| apps/server/modules/executions/execution-start-material-registration-store.ts:15-21/47-67 | 명시 describe/inspect/readBody를 소비한다. 실제 supplier 기본 구현은 없고 원 fact·Options/payload를 결박한다. |
| docs/contracts/FN09_REGISTERED_PREPARATION_OPTIONS_CANDIDATE_20261106.md:38-52 | optionsRef=실제 preparationRef의 목적 해석과 저장 options body/bytes/SHA를 명시한다. |
| apps/server/modules/executions/project-execution-preparations.ts:84-118/122-153 | 등록 준비는 원 context 보호조회와 Options 저장/읽기·정의/환경 보호 검산을 수행한다. |
| contracts/canonical.ts:5-46 | object key 정렬·배열 순서·정상 Unicode·깊이64 및 SHA256의 기존 구현이다. |

### 기존 저장과 반환의 정확한 구조

context_bundles는 id/version1/content_hash/manifest_json·assignment_ref/baseline_refs/budget_ref·created_by/client_id/원 내부 command_id/request_payload를 저장한다. context_items는 item_id/category/required/source_ref/source_hash/included_state/reason/delivery_parts/issue를 저장한다. 집합 원문 text는 저장하지 않는다.

buildContextManifest 반환은 {manifest,ref}이고 ref={id,version:1,contentHash:SHA256(canonicalJson(manifest))}다. manifest는 다음 필드를 가진다.

- id/projectId/version/preparationInput/assignmentRef/baselineRefs
- purposeRef/constitutionRef/latestInstructionRefs/currentPositionRef
- items/sourceBindings/missingRequired/excluded/deliveryPlan/budgetRef/unverified
- sourceAuthorizationVerified:false/budgetVerified:false/ready:false/executionAuthorized:false/dispatchPerformed:false

items는 {itemId,category,required,sourceRef,sourceHash,reason,includedState,deliveryParts,issue}, sourceBindings는 {itemId,selection,bodyRef,sourceState}다. 그 bodyRef는 null 또는 **ArtifactRef {artifactId,bytes,contentHash,mediaType}**이며 VersionRef가 아니다. deliveryPlan={state:'PREPARATION_ONLY',parts,multipartRequired,limits}; parts는 {partId,itemId,sourceRef,bodyRef,order,byteOffset,utf8Bytes,contentHash}로 text를 포함하지 않는다.

ProjectContextSources.resolve는 preparationInput/assignmentRef/baselineRefs/constitutionRef/budgetRef/bindings 및 planContextText의 items/parts/missingRequired/excluded/multipartRequired/false flags·unverified를 반환한다. 이 단계의 parts에는 {partId,itemId,text,utf8Bytes,contentHash}가 있다. 같은 결과로 manifest를 다시 만들 수 있지만 집합 body의 format은 없다.

ProjectContexts.read는 {projectId,manifest,ref,currentCheck,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt}를 반환한다. currentCheck.state는 MATCHED_METADATA/CHANGED/UNAVAILABLE다. MATCHED_METADATA는 현재 접근·connector 전달·실행 허가 전체를 뜻하지 않는다.

## 3. A안 exact body 제안

아래 literal/필드는 **채택 전 새 형식 제안**이다. 기존 저장/public 응답을 바꾸지 않고 내부 producer/parser만 소비한다.

~~~ts
{
 schemaVersion: 1,
 purpose: 'START_CONTEXT_BODY_V1',
 contextBundleRef: VersionRef,
 assignmentRef: VersionRef,
 budgetRef: VersionRef | null,
 baselineRefs: VersionRef[],
 constitutionRef: VersionRef | null,
 items: [{
  itemId: string,
  category: ContextSlotCode,
  sourceRef: ExistingContextSourceRef,
  selection: ExistingContextSourceSelection,
  bodyRef: ExistingArtifactRef,
  sourceState: string,
  includedState: 'INCLUDED',
  reason: string,
  parts: [{
   partId: string,
   order: PositiveInteger,
   byteOffset: NonnegativeInteger,
   utf8Bytes: PositiveInteger,
   contentHash: Sha256,
   text: string
  }]
 }],
 ready: false,
 executionAuthorized: false,
 dispatchPerformed: false
}
~~~

1. 각 object는 위 exact key만 가진다. 각 ref/선택/ArtifactRef는 기존 정확 원형이다. 원 messageRef를 VersionRef로 변환하지 않는다.
2. items는 normalized preparationInput의 고정7슬롯 순서와 슬롯 내부 원 sources 선택 순서다. itemId는 기존 CODE_n을 유지한다. parts는 해당 item의 원 manifest order 오름차순이며 partId/order/byteOffset/utf8Bytes/contentHash를 원 manifest와 exact 대조한다. offset은 item별0부터 연속이고 order는 기존 전역 순서다.
3. text는 같은 resolve 결과의 동일 partId 하나에서만 받는다. 각 text SHA/길이와 item 전체 원문 SHA/길이가 기존 ArtifactRef와 일치해야 한다. 출처·reason/sourceState·selection도 원 manifest/sourceBindings와 같다. 줄바꿈/공백/Unicode 정규화·요약·자동 마스킹0이다.
4. root contextBundleRef는 실제 저장 manifest ref다. assignment/budget/baseline/constitution은 그 manifest 값이다. 새 descriptor ref·body SHA·자기 bodyRef를 body 안에 넣지 않는다.
5. body=canonicalJson(위 exact object), bytes=UTF8(body), contentHash=SHA256(bytes), sourceBytes=bytes.length, mediaType='application/json'이다. BOM/접두·접미/끝 LF0, object key는 기존 canonical 정렬, 배열은 위 순서다. manifest SHA와 body SHA는 별도이며 서로 같다고 가정하지 않는다.
6. 기존 FN05 원문2MiB/manifest2MiB·부분200과 START 두 source 합계2MiB/부분200을 모두 보존한다. metadata·JSON escaping 때문에 초과하면 거절하고 잘라내기/상한상향0이다. 공용 canonical은 수정하지 않는다.

### 누락·제외 처리

모든 required item이 INCLUDED·issue:null이고 missingRequired/excluded가 비어 있어야 생산한다는 **새 공급 조건**을 제안한다. MISSING/REDACTED/EXCLUDED가 하나라도 있으면 집합 전체를 거절한다. 빈 text/이전 body/다른 source로 대체하거나 item을 조용히 빼지 않는다. FN05의 미완료 준비 저장/화면 조회는 그대로다.

USER_INSTRUCTION·DD166F 제외는 보존한다. HUMAN resolver가 읽을 수 있어도 이 후보의 connector 전달 대상으로 확대하지 않는다. 제외된 자료가 필수 슬롯이면 전체 source가 미연결/거절이다. 이 제한 때문에 실제 정상 자료 공급이 불가능한 구성이 있어도 source-only 성공으로 숨기지 않는다. 시험은 명시 비밀 없는 메모리 자료만 사용한다.

## 4. VersionRef3 목적과 Options 미정 경계

최소 A는 CONTEXT_BUNDLE 그룹의 세 ref를 모두 **실제 contextBundleRef와 exact 같은 VersionRef**로 고정하는 선택이다. 세 목적이 같은 저장 객체를 가리킨다는 새 의미를 직접 채택받는다. Ref3 형상이 존재한다는 사실만으로 이 해석을 기존 승인이라고 하지 않는다.

| 필드 | 제안 의미 | 검산 |
|---|---|---|
| sourceRef | 원 bundle의 선택 집합/metadata | 원 저장 manifest SHA·payload/fact.intent.contextBundleRef exact |
| bodyRef | 같은 bundleRef를 START_CONTEXT_BODY_V1 재구성 키로 해석 | ref.contentHash는 원 manifest SHA 그대로. 별도 body SHA/길이는 §3 재현 결과와 비교 |
| originRef | 같은 bundle의 buildTaskContext 저장 출처 | 기존 원 HUMAN command/receipt/audit·필요 승인소비 closure를 보호 read로 검산 |

각 원문의 ArtifactRef는 body의 items[].bodyRef에 별도 보존한다. source.bodyRef를 새 artifact 저장의 존재로 주장하지 않는다. 원 bundle ref는 새 body를 포함하지 않는 기존 manifest hash라 순환 hash가 없다. 임의 UUID/version·가짜 artifact Ref·manifest hash를 bytes SHA로 치환0이다.

이 목적 투영은 재구성 알고리즘이 바뀌면 같은 키가 다른 body를 가리킬 위험이 있다. 그러므로 format/순서/직렬화를 불변으로 고정하고 저장 descriptor의 body SHA와 exact 일치할 때만 fresh bytes를 반환한다. 원문이 없어지거나 현재 접근이 거절되면 재구성도 거절한다. 실제 body 별도 불변 저장을 추가하는 안은 이번 최소안이 아니다.

**Options:** FN09가 고정한 것은 optionsRef=실제 preparationRef와 exact10/options exact5 보호 추출이다. 현재 START inspector의 options sourceRef=preparationRef·body bytes/hash 대조도 유지한다. 그러나 Options의 bodyRef/originRef를 임의 artifact나 contextBundleRef로 채울 근거는 없다. 이 후보는 CONTEXT_BUNDLE Ref3만 제안하며 Options 두 ref의 의미/생산을 자동 채택하지 않는다. 실제 기존 producer에서 입증되지 않으면 그 그룹은 미연결이다. 같은 preparationRef 목적 투영을 Options에도 적용하려면 정확 범위를 별도 명시해 판단받아야 한다.

## 5. actor/Tx·명시 범위·H/E·수명·역사

- HUMAN 등록은 원 ProjectInitialExecutionQueue authenticated Tx의 actor/db/request/fact/grant와 정확 bundleRef를 사용한다. 원 ProjectContexts 보호 closure와 text-bearing resolve를 한 내부 목적 계산으로 연결해 재구성 manifest 전체를 원 저장 ref와 exact 비교한다. 별도 Pool Tx·raw 원문 우회·renderer 권한 선언0이다.
- 같은 actor/Tx/projectMember만으로 새 전달 권위를 만들지 않는다. 실제 grant의 명시 sourceScopes와 보호 source/current가 선택한 프로젝트 원문을 허용함을 입증해야 한다. 현재 경로/observation 기반 sourceScopes와 knowledge/document/conversation ref의 일반 대응 producer는 확인되지 않았다. 대응 없으면 port 미연결·bytes0을 유지하고 새 allow boolean/성공 stub를 넣지 않는다.
- 원 descriptor H는 저장 HUMAN grant subject, 외부 proof E는 기존 실제 E1 예약이다. 같은 grant/fullref·원 Challenge 이전/동일 예약·currentReadOnly와 helper의 최종 대조를 보존한다. request에 새 E 필드를 추가하거나 H/E 치환·예약 사후생산0이다.
- 각 await 뒤 원 db/query/txid·actor/client/H·grant/정책/source/current와 기한을 재검산한다. 실제 원 grant/fact/source의 최소 수명과 호출 시작 고정 budget만 사용한다. 원 source의 수명 근거가 없으면 임의 만료를 발행하지 않는다. now+budget 재시작·처리기한을 resource 수명으로 전용0이다.
- 같은 Tx의 기존 합산 admission→receipt/envelope/queue/등록·완결을 유지한다. 실패 전체 rollback, COMMIT 불명은 원 command UNKNOWN/hold 보존·자동 새서명/명령/등록/재전달0이다.
- 후행 fresh 부분 조회는 E currentReadOnly→저장 H 매핑→기존 보호 actor/현재 source 접근→원 descriptor/body SHA 재현을 검산한다. HUMAN 생성함수·승인소비/GUC를 재호출·위조하지 않는다. sourceScopes/current 권위가 없으면 fresh bytes0이다.
- consumed proof replay는 기존 receipt/challenge/binding/result 관계와 추가기록0을 유지한다. body 반환이 필요하면 현재 접근을 생략하지 않는다. 역사 command replay는 원 저장 closure/결과만 검산하고 source를 재생산·재등록·전달하지 않는다. 만료/삭제/거절을 과거 body/descriptor/기한 수정으로 수선하지 않는다.

## 6. 대안·영향·검증

| 안 | 장점 | 차이/위험 |
|---|---|---|
| A 권장: canonical JSON+bundleRef 목적 reader | item·출처·원문·순서와 bytes SHA를 함께 검산. 새 표/artifact 없이 계산 가능 | 새 format/Ref 목적 의미의 직접 채택 필요. JSON overhead 거절과 실제 권위/supplier 미연결이 남음 |
| 단순 이어붙임 | overhead가 작음 | 구분자·슬롯 경계·출처·빈 원문 처리도 새 계약. ab+c/a+bc 혼동과 명령 해석 위험. 별도 metadata 결박 필요로 권장하지 않음 |
| B: 미연결 유지 | 새 의미/권한0, strict 거절 유지 | 실제 START context 공급 선행은 계속 미완료 |

A는 공개 API/DTO·인증/권한·FN05 저장/public read·새 DDL/표/열을 바꾸지 않는다. 다만 새 body/Ref 의미와 그 body SHA/길이가 기존 START descriptor/material에 저장되는 **영속 의미 변화**는 존재한다. 기존 세 material 표·합산 admission을 재사용하며 저장 변화0이라고 과장하지 않는다. 실제 supplier 기본 활성화·app/main·DD166F/USER_INSTRUCTION 해제·Options 의미 확장·ACK/실행/Agent는 제외다.

채택 뒤 최대 영향 예상은 제품4/시험3이며 아직 쓰기 GO가 아니다.

제품:
1. apps/server/modules/context/project-contexts.ts — 기존 closure/보호 read와 text-bearing 재구성을 한 목적에서 검산하는 내부 접점. public DTO 불변.
2. apps/server/modules/context/context-sources.ts — 필요할 때만 원 actor/Tx·재구성 결과 연결. 기존 reader/상태 의미 불변.
3. apps/server/modules/executions/execution-start-material-registration-store.ts — 목적 한정 source/Ref3/body 검산의 실제 소비.
4. 신규 내부 apps/server/modules/executions/execution-start-context-source.ts — 채택 format 계산·명시 SYNTHETIC_ONLY 조립만. 현재 파일 존재/기본 공급을 주장하지 않는다. 기존 내부 배치로 충분하면 경로를 줄인다.

시험:
- tests/unit/FN05/context-sources.test.ts
- tests/unit/FN05/context-manifest.test.ts
- tests/unit/FN08/execution-start-material-registration-flow.test.ts

새 fixture·일반 wrapper·공개 export/권한·공통 canonical/SQL 변경은 자동 포함하지 않는다. 실제 sourceScopes 대응 없이는 정상 연결을 완료할 수 없으면 그 사실을 반환하고 이 후보로 권한을 우회하지 않는다.

최소 검증은 실제 메모리 보호 reader→원 manifest closure→body 생산→기존 registrar/부분/proof/receiver 소비다. 미호출 builder/성공 override만으로 완료하지 않는다. 정상 동일입력 동일bytes, 다른 actor/project/Tx/fullref·원문/ArtifactRef/부분SHA 변조, 원문 회수/격리/current 변경, 누락·제외·USER_INSTRUCTION/DD166F·범위 미연결의 효과0, UTF-8/key/순서/offset/JSON 상한, 매 await 만료·H3/E1·예약없음/후행예약·UNKNOWN·역사/consumed 추가0을 검산한다. Options 기존 보호 검산은 유지하고 미정 Ref를 가짜 원자료로 통과시키지 않는다.

## 7. 결정문과 남은 위험

**A:** “위 고정 JSON과 실제 bundleRef의 목적 해석을 코드·합성 범위로 채택한다. USER_INSTRUCTION/DD166F·실제 원문/권한/Agent 실행 제외를 유지하고 source/current·명시 접근 범위 근거가 없는 공급은 계속 거절한다.”

**B:** “새 format/Ref 의미를 채택하지 않고 현재 미연결을 유지한다.”

A도 아직 NOT_ADOPTED/SOURCE_GO0이다. 직접 선택은 format/정확 직렬화, incomplete source 전체거절, CONTEXT_BUNDLE Ref3 투영이다. 실제 sourceScopes→원문 권위 대응·source 수명·Options bodyRef/originRef는 이 후보가 임의 해소하지 않은 미연결이다. 이 후보를 실제 최초 Agent 실행/전체 FN08 완료로 해석하지 않는다.

변경은 이 문서1뿐이다. 제품/시험/동결12·보호 자료/Main 현황/Git 수정·실제 DB/권한/키/서비스/listener/SDK/Agent/실자료 조사·commit/push0이다. 실제 PG/RLS/경합/수신 이해·사용자 인수는 NOT_RUN이다. rollback은 후보 문서 delta의 정상 수정/제거 범위이며 수행하지 않는다.
