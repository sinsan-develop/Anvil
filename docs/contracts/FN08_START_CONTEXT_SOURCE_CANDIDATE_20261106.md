# FN08 START 맥락·옵션 원문 재구성 계약 후보 r2

상태: DRAFT / NOT_ADOPTED / SOURCE_GO0
작성: 2026-11-06 Main 어울. 기존 Primary 조사와 독립 검토를 반영한 직접 결정 후보다.
r1 원형: df7776ad1ece873d4aba7ccca846f81419c2b139에 보존, 18601B / SHA256 32DED6A6036AF7C2748FE12ED0575AA77CBA0EF3B2DA8A8B0791DF8F7968E282.
r1은 C0/I2/M0로 반려됐다. 이 문서는 구현·실제 자료 조회·권한 부여·실행 승인이 아니다.

## 1. 이번에 필요한 결정

권장 A는 저장된 정확한 맥락과 Options를 기존 내부 보호 reader로 재구성해, 명시 주입된 합성 START source가 두 자료를 실제 registrar/부분/proof/receiver까지 소비하도록 하는 코드·합성 검증이다. 일반 대화 원문 endpoint나 실제 connector 권한·키·서비스·Agent 호출을 켜지 않는다.

기존 승인과 다른 의미는 아래 네 가지다.

1. 원 bundle에 이미 명시 선택된 USER_INSTRUCTION만 기존 내부 readMessage로 재구성하는 source-only 예외. 일반 대화·새 선택·DD166F endpoint/UI·대체 원문 provider는 포함하지 않는다.
2. 검증된 원 fact.intent.contextBundleRef와 fact.preparationRef를 해당 START의 Anvil 내부 논리 자료 범위로 해석한다. 파일 경로용 sourceScopes가 문서 권한이라는 뜻은 아니다.
3. CONTEXT 그룹의 sourceRef/bodyRef/originRef는 모두 실제 contextBundleRef, OPTIONS 그룹의 세 참조는 모두 실제 preparationRef를 가리키는 목적 해석이다. 원 manifest/snapshot SHA와 재구성 bytes SHA는 별도다.
4. 원문에 임의 수명을 만들지 않고 기존 원 fact/grant/HUMAN 세션·정책/descriptor의 최단 허가 수명과 현재 보호 조회를 함께 검사한다.

B는 위 새 의미를 채택하지 않고 실제 원문 공급 미연결을 유지한다. r1처럼 불가능한 정상 공급을 구현 완료 조건으로 두지 않는다.

## 2. 기존 근거와 r1 반려

- docs/design/Anvil_설계서_v3_초안.md §8.1/8.1.1: 출처·버전/hash·누락·접근 및 실제 수신을 구분한다.
- docs/WORK_PLAN.md의 FN05/FN08/FN09 및 docs/work_packages/FUNCTION_WORK.md의 같은 업무: 고정 맥락·원 명령·기존 Agent 연결의 선행이다.
- docs/contracts/FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md §1~3/6: 원문 source 권위·실제 보호 reader와 USER_INSTRUCTION/DD166F를 제외했다. 이 r2의 예외를 기존 승인으로 소급하지 않는다.
- docs/contracts/FN09_REGISTERED_PREPARATION_OPTIONS_CANDIDATE_20261106.md: optionsRef=실제 preparationRef와 보호 Options body/bytes/SHA 추출을 고정했다. Ref3 전체 목적은 이번 새 제안이다.
- context-input.ts의 contextSlotCodes/sourceValid: 고정7슬롯 중 LATEST_INSTRUCTIONS는 USER_INSTRUCTION만 허용한다. 비우면 context-sources.ts가 required MISSING을 만들고 context-manifest.ts는 모든 item을 required로 보존한다.
- 따라서 USER_INSTRUCTION 전부 제외와 모든 required INCLUDED를 함께 요구한 r1은 정상 입력이 없다(I1). Options Ref2·현재 공급 권위를 미정으로 둔 채 정상 두 그룹 종단을 요구한 점도 반려됐다(I2).

기존 준비의 누락 표시·저장·조회와 false/unverified 상태는 바꾸지 않는다. 필수 맥락을 빼거나 제외를 몰래 완화해 통과시키지 않는다.

## 3. 원문을 얻는 내부 접점

Context:
- ProjectContexts.read의 원 command/receipt/audit·일회 승인 소비·manifest/items 저장 완결 검사를 그대로 소비한다.
- 같은 db/actor와 저장 preparationInput으로 ProjectContextSources.resolve를 호출해 실제 text-bearing 결과를 얻는다.
- buildContextManifest(원 bundle id, projectId, 같은 결과)의 fullref와 manifest 전체가 원 저장값과 exact 같아야 한다. 서로 다른 resolve 결과의 metadata/text를 섞지 않는다.
- 원 bundle에 저장된 정확 selection·VersionRef/MessageRef·conversation·project·HUMAN author만 허용한다. 기존 ProjectConversations.readMessage의 원 snapshot/body 검산을 재사용한다.
- 새 save/buildTaskContext/prepareExecution·receipt·승인 소비·예약·원문 생성은 하지 않는다. 공개 read 응답에 text를 추가하지 않는다.

Options:
- 실제 ProjectExecutionPreparations.read의 저장 snapshot/hash와 options body·UTF-8 bytes·SHA 검사를 소비한다.
- fresh 공급은 실제 ProjectConnectionDefinitions.read와 ProjectEnvironments.read의 동일 ref를 추가 재조회한다. definition.currentStatus.configurationCurrent===true, environment.current.configurationCurrentness==='MATCHED'를 요구한다.
- 기존 준비 역사 read의 currentness:'NOT_RECHECKED'를 현재 유효성으로 승격하지 않는다. 원 definition으로 재컴파일한 Options와 저장 options 전체가 같아야 한다.
- 후보/legacy 준비를 임의 등록 정의 준비로 바꾸거나 Options를 자동 생성·저장하지 않는다.

ProjectContexts의 저장 manifest/원문 선택을 정정하지 않는다. 원문 회수·격리·정정·헌법 변경 등으로 exact 재구성이 불가능하면 bytes를 주지 않는다.

## 4. 고정 Context body 형식

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

- exact key만 허용한다. sourceRef/selection/ArtifactRef는 기존 원형이며 MessageRef를 VersionRef로 위조하지 않는다.
- items는 원 preparationInput의 고정7슬롯 순서·슬롯 내 선택 순서다. parts는 해당 item의 원 manifest 전역 order 순서, offset은 item별0부터 연속이다. 원 partId/order/offset/길이/SHA를 exact 대조한다.
- text는 같은 resolve 결과의 해당 part에서만 얻는다. 각 부분과 합친 원문 bytes/SHA가 원 ArtifactRef와 같아야 한다. reason/sourceState/selection도 원 manifest/sourceBindings와 같아야 한다.
- 모든 required item이 INCLUDED·issue:null이고 missingRequired/excluded가 비어 있어야 한다. MISSING/REDACTED/EXCLUDED·빈 부분·원문 유실이면 전체 공급을 거절한다.
- USER_INSTRUCTION은 이번 A에 한해 원 bundle의 exact 선택을 내부 보호 재구성한다. 이 예외가 없으면 정상 공급은 불가능하다. 실제 사용자 자료를 이번 검증에서 읽지 않는다.
- 포함은 원문의 재구성 가능성이다. 지시의 의미상 효력·최신성 전체·Agent 이해 완료나 실행 권한을 자동 인정하지 않는다. 기존 ContextBundle false/unverified 표식과 별도 이해검토/실행 조건을 보존한다.
- body=기존 canonicalJson(위 객체), bytes=UTF8(body), SHA256(bytes), mediaType=application/json. BOM·끝 LF·접두/접미0, object key는 기존 canonical 정렬이며 배열 순서는 고정한다. 원문 줄바꿈·공백/Unicode를 정규화·요약·마스킹하지 않는다.
- FN05 원문/manifest2MiB, START 두 body 합계2MiB·부분 합계200 등 기존 상한을 모두 지킨다. JSON escaping/metadata로 넘으면 거절하며 상한을 올리거나 잘라내지 않는다.

## 5. 두 그룹의 정확한 참조와 저장 의미

| 그룹 | payloadRef와 sourceRef/bodyRef/originRef | bytes |
|---|---|---|
| CONTEXT_BUNDLE | 모두 실제 원 contextBundleRef | §4의 canonical JSON |
| START_OPTIONS | 모두 실제 원 preparationRef=optionsRef | 기존 보호 snapshot의 options.body 원 UTF-8 |

세 필드는 목적이 다르지만 같은 저장 객체를 읽는 키라는 새 해석을 제안한다. sourceRef는 원 선택/옵션 객체, bodyRef는 해당 목적의 재구성 키, originRef는 원 buildTaskContext/준비 command·receipt/audit 출처다.

Ref.contentHash는 원 manifest/준비 snapshot SHA 그대로다. 별도 source.contentHash/sourceBytes는 재구성 bytes의 SHA/길이다. 둘을 같은 hash로 취급하지 않는다. 각 원문의 ArtifactRef는 Context body 안에 그대로 보존한다. 새 artifact UUID·가짜 저장 VersionRef를 만들지 않는다.

알고리즘/format은 V1로 고정하고 저장 descriptor의 sourceRef/bodyRef/originRef·body SHA/길이와 모두 같을 때만 fresh 부분을 반환한다. 알고리즘 변경은 새 계약 변경이며 기존 등록 hash를 고치지 않는다. 새 표/DDL은 없지만 기존 material descriptor에 저장되는 새 목적·원문 SHA의 영속 의미 변화는 존재한다.

## 6. 논리 자료 범위·현재성·수명

- source는 기존 주입 current 공급자의 원 fact를 소비한다. source가 VERIFIED_CURRENT·checkedAt·grant·budget·실행 권위를 만들거나 새로 연장하지 않는다. 현재 공급자가 없거나 원 fact 검사에 실패하면 원문 보호 reader가 성공해도 등록/fresh bytes를 거절한다.
- 원 START actor/client/HUMAN session/H와 fact.subject, project, 원 command·grant fullref/intent·assignment·basis·최신 지시 참조·등록·원 정책·허가 기한을 기존 guard로 exact 대조한다. 같은 actor/Tx만으로 충분하다고 판단하지 않는다.
- A의 논리 자료 범위는 검증된 원 intent.contextBundleRef와 원 preparationRef에만 한정한다. 원 bundle에 저장된 선택 또는 원 preparation의 Options 이외의 project 자료를 탐색/추가하지 않는다. filesystem sourceScopes는 기존 파일 범위 검사에 그대로 쓰고 문서 ref 대응표로 전용하지 않는다. 원 fact의 context/source/permission checks와 실제 보호 reader의 현재 접근을 모두 요구한다.
- describe/inspect/readBody와 그 사이 await 전후에 원 db.query/txid·actor·scope·fullref·현재 source와 만료를 검사한다. callback 뒤/COMMIT 전 마지막 검사도 보존한다. current 공급자의 부재를 성공 boolean/override로 메우지 않는다.
- 반환 수명은 호출 시작에 고정한 원 grant/fact의 기존 expires, 원 HUMAN idle/absolute·정책 기한과 descriptor 기한의 최솟값이다. 현재 보호 조회 관측도 기존30초 제한 안이어야 한다. manifest.observedAt이나 NOT_RECHECKED로 새 허가 수명을 만들지 않는다.
- 원 descriptor의 H와 외부 proof의 기존 E1 예약을 분리한다. 같은 grant·원 Challenge 이전/동일 예약·currentReadOnly·namespace helper의 검산을 유지한다.
- 기존 admission·receipt/envelope/queue·등록 완결과 전체 rollback을 유지한다. COMMIT 불명은 UNKNOWN/원 명령 보존, 자동 새 명령/서명/전달0이다.
- 역사 command replay는 원 저장 closure/결과만 읽고 source 재생산·등록·전달0이다. fresh 부분/소비 proof 재조회로 body를 반환할 때는 현재 접근·기한을 생략하지 않는다. source 만료/회수/불명은 과거 body·기한·descriptor를 바꿔 복구하지 않는다.

이 문서의 논리 자료 목적 해석을 실제 계정/정책/권한 부여나 실제 connector 접근 활성화로 해석하지 않는다. 실제 current/credential 공급·default app 연결·서비스·SDK/Agent 실행은 계속 제외다.

## 7. 구현·검증 범위와 대안

채택 후 기존 Primary 단일 writer에게 정확 WI를 발행한다. 최대 제품4·시험4 범위이며 더 필요하면 변경점을 먼저 분류한다.

제품 후보:
- apps/server/modules/context/project-contexts.ts: 기존 보호 closure와 text-bearing exact 재구성의 내부 접점. 공개 read DTO 불변.
- apps/server/modules/context/context-sources.ts: 필요한 경우 같은 결과의 내부 소비만 보완, 기존 상태/선택/reader 검사 보존.
- apps/server/modules/executions/execution-start-material-registration-store.ts: 두 그룹 목적/원문 소비 경계.
- apps/server/modules/executions/execution-start-context-source.ts: 신규 명시 SYNTHETIC_ONLY adapter, 고정 body·현재 보호 재조회·상한/기한. 기본 등록0.

시험 후보:
- tests/unit/FN05/context-sources.test.ts
- tests/unit/FN05/context-manifest.test.ts
- tests/unit/FN08/execution-start-material-registration-flow.test.ts
- tests/unit/FN08/execution-start-context-source.test.ts (신규)

정상 합성은 실제 ProjectContexts/ProjectContextSources·ProjectExecutionPreparations·definition/environment 보호 클래스와 실제 registrar/부분/P256/proof/receiver를 소비한다. 메모리 DB의 원 자료와 명시 합성 current를 공급하며 제품 성공 메서드를 override하지 않는다. 선택된 USER_INSTRUCTION도 실제 내부 readMessage 모듈을 소비한다.

최소 반례: 동일입력 동일bytes·출처/순서, 다른 actor/project/Tx/fullref/H/E, 원문/ArtifactRef/hash 변조, 최신 헌법·정의/환경 변경, 회수·격리·누락·상한·await 뒤 만료, current 부재, 예약부재/후행예약, UNKNOWN·역사/consumed 추가효과0. Options 두 Ref 목적과 body SHA를 별도로 검사한다. 타입검사·diff check 및 직접 인접 회귀를 선택한다.

A는 실제 자료 공급을 켜지 않고 실제 보호 코드를 합성에서 연결하는 구현 범위다. 실제 PG/RLS/trigger/HTTP·source/current·키/서비스/Agent·사용자 인수는 NOT_RUN으로 남는다. 새 public endpoint/DDL/SQL·정책/권한 부여·일반 대화 조회·DD166F 구현·실자료 조사·P03/J3 실행은 제외한다.

대안:
- A 권장: 위 네 새 의미를 한 번에 고정해 정상 두 그룹의 합성 연결을 구현한다.
- 단순 원문 이어붙임은 slot/출처 경계를 잃고 구분자/순서 의미도 새로 필요해 비권장이다.
- B: 미채택·미연결 유지. encoder만 추가하고 기능 진도처럼 계산하지 않는다.

rollback은 이번 소스 checkpoint의 허용 변경만 검토 후 정상 revert하는 방식이며 실제 실행하지 않는다. 원 문서/등록/SQL·보호 미추적 자료는 보존한다.

## 8. 직접 결정문

A: “r2의 고정 JSON·두 그룹 참조 목적·고정 bundle의 선택 사용자 지시 내부 재구성 예외·원 fact의 논리 자료 범위/현재성·기한 계약을 코드·합성 검증 범위로 채택한다. 실제 DB·권한 부여·키·서비스·원문 조회/전송·Agent 실행과 DD166F endpoint/UI는 제외한다.”

B: “새 계약을 채택하지 않고 원문 공급 미연결을 유지한다.”

아직 선택되지 않았으며 SOURCE_GO0이다. Main은 r2 독립 검토 후에만 정확 후보로 결정을 요청한다. 전체 FN08/Stage/작업계획서 완료가 아니다.
