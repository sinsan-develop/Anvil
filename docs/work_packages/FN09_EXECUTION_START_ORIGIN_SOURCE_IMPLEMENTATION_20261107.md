# FN09 실행 START 원자료 source 구현 WI 초안

- 상태: **DRAFT / WAITING_ADOPTION / SOURCE_GO0 / PRODUCT_GO0 / ACTUAL_EXECUTION0**.
- 부모 후보: `docs/contracts/FN09_EXECUTION_START_ORIGIN_CANDIDATE_20261106.md` r2, 42007B/SHA256 **65765A0B36DEDEEDF188575632535882C19477F6E3B02C8DEC29F168B43105AE**. 현재 후보 채택 대기이며 이 WI 작성 지시는 제품·시험 쓰기 GO가 아니다.
- 관측 HEAD: **869eefe4cc89182ba540fcc30a36de06699e7163**, branch `codex/av3-stage-b`. 기존8 제품 raw는 §2 기준이다. 실제 수행 시 Main이 직접채택 binding·이 WI 최종 hash·정확 SOURCE_GO를 별도 결박한다. 문서 HEAD 이동과 제품 기준 변경을 혼동하지 않는다.
- 경로 기준: 공식 저장소 root의 상대 경로를 기준으로 한다. 이번 준비의 소유는 이 신규 WI1뿐이다. 아래23은 **향후 GO 뒤의 제안 허용목록**이며 지금은 쓰기/시험 실행0이다.
- 단일 writer는 기존 Primary. Main/검토자는 같은 제품을 쓰지 않으며, 타인 변경·보호3·Main 현황/통제·원 계약을 되돌리지 않는다. commit/push·새 agent/session/branch/worktree·자동화0.

## 1. 목적·완료 경계와 시작 조건

기존 WAITING stage 요청→실제 확정 assignment→등록 preparation→role binding과 별도 Anvil 논리 session을 실제 보호 reader로 교차검산한다. 서버만 새 실행 식별·최초 세대·token 없는 E예약을 도출하고, 불변 S→originRef→후행 Q→자기 receipt/audit·같은 Tx quota로 저장한다. 명시 UI05에서 선택·저장·보호 GET·이력 발견/취소 뒤 역사조회까지 정상 흐름을 연결한다.

이는 부모 원자료의 실제 저장/조회 기능이다. 단순 metadata wrapper·항상412·SyntheticQueueResolver의 current=true 대역·기존 false/transport 이름 변경으로 대체하지 않는다. 반대로 실제 grant/token/E발급·START dispatch envelope·첫 SEND 실행 permit·SDK SID/SESSION claim·OS writer/실행·완료판정·자동전이·Agent 연결이 완료됐다고 하지 않는다. 기존 stage WAITING/CANCELLED·assignmentRef:null·예약/실행 false 의미는 그대로다.

제품 착수 조건은 ①부모 후보 r2의 정확 채택 ②이 WI 독립 사전검토/최종 hash ③Main SOURCE_GO와 기존 제품 raw 재대조 ④정확23 단일 writer 배정이다. 순수 테스트 선행 GO를 별도 주면 시험/fixture8만 작성하며 제품15/0081은 쓰지 않는다. 후보의 새 공개/저장/정책 의미를 이 WI만으로 승인하지 않는다.

## 2. 정확 허용23와 시작 raw

### 2.1 제품15 — 신규7/기존8

| 번호/구분 | 저장소 상대 경로 | 책임/시작 bytes·SHA256 |
|---|---|---|
| P01 신규 | apps/server/modules/executions/execution-start-origin-input.ts | 원 ProjectCommand exact11/payload exact5·S/Q/응답 닫힌 형상. ABSENT |
| P02 신규 | apps/server/modules/executions/execution-start-origin-sources.ts | 실제 보호 클래스·원 선택/현재성/세대·FRESH/HISTORY. ABSENT |
| P03 신규 | apps/server/modules/executions/execution-start-origin-store.ts | 단일 원장 S/Q·원 C/A/U/R 관계·목록/고정조회. ABSENT |
| P04 신규 | apps/server/modules/executions/project-execution-start-origins.ts | 같은 Tx 저장/계상·확정 뒤 새 인증 조회·목록/UNKNOWN. ABSENT |
| P05 기존 | apps/server/modules/scheduling/stage-queue.ts | 내부 readRequest. 17621B / FC494392B65B12A4EB40A0261BF30E3EDF0BFCDDD0A94A190E0B72B5F754B404 |
| P06 기존 | apps/server/modules/executions/project-execution-preparations.ts | 목적 한정 같은 Tx readStartOriginSources. 17053B / 6DB36788A633E0111BD33D5EC9607C79EE28A006E38220FA90AEA82F249D43B8 |
| P07 기존 | apps/server/modules/access/project-command.ts | 명시 연산/정책·원 목적 ID/receipt. 43495B / E068F9B08AA84626A451E3E6FE1491A07CD58BFC01C47E2F9633EB4B282B2B70 |
| P08 기존 | apps/server/modules/projects/project-storage-quota.ts | origin 동일 Tx reserve/settle·private lease. 49894B / F2768AFAB5661877F4BD2E4838E6657583F56CF5BBA871B0DCFCD0404E543DD9 |
| P09 기존 | apps/server/modules/projects/routes.ts | 실제 의존 구성·명령1/GET2. 88868B / C58EFD4F2FE5ADFE9F7BA6599B7E285130CC0B58B1A308BB55FC46EA8B475918 |
| P10 신규 | db/migrations/0081_execution_start_origins.sql.pending | 단일 목적 원장·C/A/U/R·forward dispatcher/guard/ACL. ABSENT |
| P11 신규 | apps/web/src/features/session-detail/execution-start-origin-api.ts | 원 packet·선택 API/closed decoder/hash·정확 조회/이력. ABSENT |
| P12 신규 | apps/web/src/features/session-detail/ExecutionStartOriginPanel.tsx | 실제 명시 UI05·정상/거절/불명·역사. ABSENT |
| P13 기존 | apps/web/src/features/session-detail/SessionDetailPage.tsx | 실제 장착/선택 confirmed 공급·별도 origin storage prop. 27778B / 9EA72B34F8062701A7A9EE432CDBB8056E9DD7733F74262D11823846388C4E6D |
| P14 기존 | apps/web/src/App.tsx | 원 주체/선택별 buffer CAS·receipt/UNKNOWN. 70252B / F3E5114FC82641FAC153BB77AF1E35388B52771D72A35C45EF2617074DDB104C |
| P15 기존 | apps/web/src/features/connections/policy-editor-profile.ts | 새 정책 옵션만, 자동 허용0. 5380B / 1B0862158E2FABBB31D2992FDC5C645A2D0B0B6C55C51DBE2DDBF1E3F96CF891 |

§2 raw 확인은 e82fa2의 읽기 결과다. 0081은 파일 ABSENT이고 실제 목록 마지막은0080이다. 아직 번호의 독점 예약/SQL 실행이 아니므로 GO 직전 Main의 다른 예약과 대조한다. 기존 파일 raw가 바뀌면 타인 변경을 복구하지 말고 정확 차이/소유/의존을 Main에게 반환한다.

### 2.2 신규 시험7/순수 fixture1 — 현재 모두 ABSENT

| 번호 | 경로 | 검산 책임 |
|---|---|---|
| T01 | tests/unit/FN09/execution-start-origin-input.test.ts | payload/외피/closed S/Q·사본/안전 문자열·원 hash |
| T02 | tests/unit/FN09/execution-start-origin-sources.test.ts | 실제 보호 producer/reader·현재성·교차 refs/H/E·alias/포트 |
| T03 | tests/unit/FN09/execution-start-origin-store.test.ts | 실제 service·S/Q·C/A/U/R·역사·동일 요청 단발·취소 |
| T04 | tests/unit/FN09/execution-start-origin-routes.test.ts | 실제 App.inject 명령/GET2·인증/CSRF/query/비노출 |
| T05 | tests/unit/FN09/execution-start-origin-quota.test.ts | 같은 Tx ID/private lease/actual/projection·실패/COMMIT 불명 |
| T06 | tests/unit/FN09/execution-start-origin-schema.test.ts | forward SQL source·수식·양방향 guard/ACL·기존 목적 보존 |
| T07 | tests/unit/UI05/execution-start-origin-flow.test.ts | 실제 Panel/SessionDetail/App·선택/저장/취소/이력·UNKNOWN |
| F01 | tests/unit/FN09/execution-start-origin-fixture.ts | 순수 메모리 SQL/가상 FS·실제 보호 클래스·독립 factory 상태 |

현재 문서 준비에는 제품·시험 작성 권한이 없다. 위 목록은 계약 채택과 Main의 후속 GO 이후에만 적용한다.

fixture import 시 test 등록/OS IO/네트워크/global 변경0·새 dependency0다. 기존 fixture/시험을 import해 등록된 시험을 복제하지 않는다. 필요한 기존 원자료 패턴만 내용/의미를 보존해 F01에 구성하며, 기존 기대값·guard를 바꾸지 않는다. 이 WI·Main 문서·결과/manifest 파일은 향후 제품 writer의23 경로에 포함하지 않는다. 보고 문서/Git 통합은 Main이 소유한다.

## 3. 고정 계약·입력과 참조 도출

원 ProjectCommand exact11을 유지한다. operation=registerExecutionStartOrigin, targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null, payload exact `{stageRequestRef,assignmentRef,preparationRef,roleBindingRef,reason}`다. 새 timestamp·executionId/E/id/current/SID/원문/Options/임의 ref 필드0이다. 원 commandId 생성은 공통 명령 식별이며 서버 executionId/credentialId 입력과 다르다. REQUIRE_APPROVAL/approvalRef는 명확 사전412·AUTO 실제 정상 저장을 제공한다.

S/Q/receipt.data/목록·고정 GET의 exact 필드/해시·상한·오류 의미는 부모 r2 §2–4를 그대로 소비한다. parser/공용 canonical·VersionRef helper는 재사용하며 새로운 SDK 옵션·포괄 current DTO를 만들지 않는다. roleBindingRef와 그 snapshot.sessionRef인 논리 sessionBindingRef, H·lifecycle executionGeneration·credential E·role binding generation을 분리한다. 최초 새 실행/credential ID에 lifecycle1/E1만 서버 도출하고 H3/E1을 정상 검산한다.

source 도출은 선택 stage의 application/start node와 assignment.definition.taskRef를 exact 대조하고, 준비 intent의 assignment/binding/connection/context/환경과 선택 refs·원 binding을 결박한다. 등록 준비 Options의 목적 ref는 preparationRef 투영이며 body bytes/hash는 원값을 별도 보존한다. stage baselineRefs의 원 assignment/preparation 포함관계·sourceScopes의 허용 FILE 범위를 실제 보호 자료로 대조한다.

stage budgetRef는 실제 ProjectLimitPolicies의 PROJECT 한도 reader로 해소된다. 준비 budgetPolicyRef는 원 입력에서 보존되고 BUDGET_POLICY_UNVERIFIED다. 필드명/UUID만으로 같은 종류라고 단정하지 말고 각각 실제 reader/원 목적/현재 APPLIED·scope·만료를 검산한 뒤 같은 요청의 일관성을 대조한다. 다른 목적이면 source mismatch로 거절·자동 변환0이다. 유효한 같은 프로젝트 한도 자료의 양성을 실제 source로 구성한다. 역사에서는 현재도 APPLIED여야 한다는 조건을 소급하지 않는다.

문서·계획·logical session 등 기한 없는 원문에는 TTL을 창조하지 않는다. S/Q expiresAt은 발급 당시 실제 기한을 가진 원 Session idle/absolute·정책/한도 등의 min이다. 호출 budget은 별도 원 end를 고정하고 await 뒤 now+budget으로 늘리지 않는다. 역사 GET의 validUntil은 현재 조회자의 보호 수명이며 과거 S/Q 기한과 다르다.

## 4. 실제 보호 클래스와 같은 Tx 접점

원 routes의 실제 AccessRepository·ProjectDocuments/ProjectMethodologies/ProjectWorkPlans·ProjectAssignmentDrafts/Confirmations·ResponsibleSessions·ProjectContexts·정의/환경 구성과 같은 access/db/actor를 소비한다. 새 성공 current/verifier boolean·임의 Pick 구현으로 실제 보호 메서드를 대체하지 않는다. prototype/own-data 함수 정체성·getter/Proxy·query 포트/actor/Session/H·txid를 필요한 호출선에서 전후 검산한다. 외부 raw refs/call은 진입 시 안전 사본으로 고정한다.

- P05 `readRequest(db,actor,pid,ref)`는 기존 private #view의 원 command/receipt/audit 검산을 소비하는 내부 접점이다. 등록/사용은 현재 exact WAITING/head·원 stage scope를 검사하고 역사는 원 version 관계만 보호 읽기한다. 기존 queue read/응답은 변경하지 않으며 새 stage 공개 GET0이다.
- P06 `readStartOriginSources(db,actor,pid,ref,mode,guard)`는 목적 한정 내부 접점이다. FRESH는 실제 원 read와 #registeredOptions(...,true)·원 assignment/draft/binding/context/정의·환경 전후 관측을 소비한다. HISTORY는 원 snapshot/Options hash와 현재 출처 접근만 재검산하고 옛 자료를 현재 source로 재계산하지 않는다. private 필드 공개·authorize=false0이다.
- FRESH 등록은 project/member/control→정책 잠금 순서를 유지한다. 요청 취소·현재 binding/자료 변경 경로와 공유 project/필수 source 행 잠금으로 직렬화한다. 같은 command replay에는 새 controller/head/fresh WAITING CAS를 소급하지 않되 현재 read/원출처 보호·저장 관계를 반드시 검사한다.

기존 root 확정 임무 지원을 보존하고 child 임무의 기존 미지원/별도 readContent 범위를 성공 fixture로 우회하지 않는다. SDK 원문·사용자 실행파일·실제 자료를 읽어 source를 준비하지 않는다.

## 5. S/Q·ID·receipt·quota 비순환 생산

1. 실제 원 command/replay·source를 검산한 후 originId/executionId/credentialId 및 자기 serverCommandId/operationId/authorizationReceiptId/auditId를 원 목적 제한 producer로 선고정한다. 새 목적 provenance는 원 db/query/actor/Session/H/requestHash/txid·단발을 결박한다. 기존 FN09/FN10 ID 함수를 일반 성공 capability로 넓히지 않는다.
2. S에 credential id/gen만 넣고 canonical originHash/ref를 먼저 고정한다. Q는 후행 originRef를 포함해 별도로 hash/ref를 계산한다. S에 Q hash/자기 receipt/audit hash/scopeDigest를 역입력하지 않는다.
3. 같은 PoolClient로 private origin reserve→공통 persistProjectReceipt(targetRef=originRef,원 고정 ID)→S/Q 같은 row insert→actual settle을 수행한다. 등록 source와 최소기한/actor/txid는 마지막 await 뒤 다시 검산한다. helper가 새 Tx를 열거나 별도 PoolClient를 예약하지 않는다.
4. actual 원본 row는 S+Q와 실제 관계열을 포함하며 C/A/U/R 비용을 각 한 번 산입한다. Q를 별도 table 행 비용으로 다시 더하지 않는다. command result에 복제된 S/Q는 그 C 실제 bytes에 포함한다. 원 context/Options 원문은 ref/hash만 저장하므로 전체 bytes 재계상0, token/알림 행0이다.
5. 원 canonical-pair/고정점·coverageGeneration 포함 전체 plan 봉인을 소비한다. admission은 기존 U/H/O를 구분해 U+H+O+r<=10GiB, settle은 실제 원행/자기 R·현재 계정과 A_actual<=r를 검산한다. 기존 무필터 SETTLED·held에 새 R가 포함되면 새 소계를 또 더하지 않는다. 기존 fn15/fn75/fn76 등 별도 소계·account 완결을 빠뜨리지 않는다.
6. AccessRepository의 COMMIT tag 확인·release 확정 반환 뒤 새 authenticated 보호조회로 원 결과를 대조한다. 원 인증/정책·현재 보호가 바뀌면 성공 본문0·원 저장 삭제0이다. 실제 underlying query가 미정착한 동안 외부 timeout만으로 회수 완료/새 중첩 작업 허용을 주장하지 않는다.

## 6. 0081 미적용 SQL 검수 조건

새 최소 목적 table execution_start_origins의 단일 row에 S/Q·origin/credential 식별·원 stage/assignment/preparation/binding·자기 command를 보관한다. 목적 전용 E예약은 existing execution_credentials의 grant FK/합성 exact8·challenge v1 deferred와 무관하다. 0017/0018/0062/기타 기존 migration·synthetic reader/guard를 수정하지 않는다.

원 stage queue version·assignment version·preparation/binding/session 및 자기 C/A/U의 실제 키/열·hash/주체·연산·정책·기한을 원 DB source와 대조한다. FK만으로 최신 WAITING/현재 접근을 인증하지 않는다. S/Q hash·원 request/result/receipt scope·audit actor/client/op/policy/source/reason·자기 R의 양방향 완결과 직접 DML/update/delete 거절을 검산한다. 같은 stage request 단발 유일성은 원 project 잠금/DB unique 관계에 결박한다.

새 전용 reserve/settle RPC2, operation/part_kind EXECUTION_START_ORIGIN 목적 분기, quota_plan_valid/quota_settled_complete의 exact 새 분기→기존 함수 위임을 추가한다. origin/domain만·command만·R만·account 없는 domain이 COMMIT하지 못하도록 origin/commands/authorization_receipts/audit_events/R/account의 deferred 전체 완결을 연결한다. 기존 held/SETTLED 합산·quota immutable 전이는 보존한다. 공개 quota_current/reserve/start allowlist 확장0이다.

함수 owner/search_path·PUBLIC/helper/app EXECUTE 경계를 명시한다. 앱은 정확 origin RPC2만 EXECUTE, helper/trigger 직접 호출0을 미적용 DDL로 제공한다. 실제 SQL parser/PG 설치·GRANT·trigger/잠금/COMMIT 실행0이다. 정적 형상/Node 수식·메모리 SQL 모델 PASS를 실제 PG 원자성/권한 PASS로 보고하지 않는다. SQL literal 삽입은 replacement callback 등으로 달러 토큰 해석을 피하고 저장 전 중복/문자 검사를 한다.

## 7. 단발·취소·현재/역사·공개 GET2

동일 stage request에 원본 하나다. 같은 command/hash는 원 결과·새 ID/R/예약0, 다른 command의 같은 request는409다. 원본/Q는 불변이며 새 pointer로 활성화하지 않는다. 기존 cancelQueuedRequest는 그대로 사용한다. 취소/만료/원 binding·app/정의/환경/정책/Session/H·control 변경 후 현재 사용은 거절한다. 기존 WAITING을 RUNNING·소비완료로 바꾸지 않는다.

rotation 명령/자동 갱신0이다. 새 원본이 필요하면 기존 요청 취소를 명시 확정하고 새 startStage 요청에서 새 ID의 lifecycle1/E1을 생산한다. 기존 ID를 새 generation으로 재활성화하지 않는다. 후속 실제 E발급/새 세대/복구는 별도 계약이다.

고정 GET은 `/api/v1/projects/:projectId/execution-start-origins/:id/versions/:version`, 추가 query/body0이다. 목록 GET은 `/api/v1/projects/:projectId/assignments/:id/versions/:version/execution-start-origins`, query exact `{cursor?:string}`, limit20 고정·4096자 cursor·기존 유한 만료다. 응답 exact는 부모 r2 §2.1을 그대로 구현한다. 목록은 originRef/stageRequestRef/recordedAt만 필요한 metadata로 투영하고 총계/다른 사용자·임무·secret/raw Q/원문을 추가하지 않는다.

cursor는 purpose EXECUTION_START_ORIGIN_HISTORY_V1·project/assignment 전체ref·현재 actor/client/H/서버 Session·limit20·결정적 recorded_at DESC/origin_id DESC에 결박한다. renderer Session DTO에 없는 SID를 추가/추정하지 않는다. 브라우저 cursor는 opaque이며 서버 authenticated 원 Session으로 검산한다. 실제 마지막 반환 행으로 nextCursor를 만들고 전체 canonical page/외피/cursor까지2MiB를 지킨다. byte truncation 후 cursor도 다시 계산한다.

목록/역사는 취소·원본 만료·옛 제어/binding으로 항목을 숨기지 않는다. 원 저장 관계와 **현재 읽기권/원 출처 보호**가 있으면 원ref를 찾는다. FRESH WAITING/최신 binding/옛 원작성자의 H를 역사 읽기에 소급0이다. H/Session 바뀐 cursor는400으로 거절하고 새 첫 페이지로만 복구한다. 현재 보호 거절/격리·오염이면 페이지 전체 비노출 오류이며 skip/부분 성공/총계 노출0이다. 목록 선택 후 exact GET을 다시 읽어 원 S/Q hash를 검산한다.

## 8. 실제 UI05 장착과 원 명령/본문 표시 수명

기존 작업 화면에서 선택한 실제 확정 임무로 SessionDetailPage에 진입한다. 신규 Panel은 기존 readStageQueue의 requestRef/sequence/reason을 명시 선택한다. queue summary에 없는 application/node를 화면이 추정하지 않고 ‘임무 연결 미검산’으로 표시하며 서버 FRESH source가 저장 전에 대조한다. 준비 선택은 기존 readPreparationHistoryPage→readPreparationOriginal, binding 선택은 readResponsibleSessionState→exact role-binding GET을 소비한다. draft 목록으로 confirmed를 선언하거나 freeform UUID·SDK SID·generation 입력0이다.

‘등록 준비’는 현재 선택/주체/제어/transport와 원 payload를 고정하고 ‘명시 저장’은 원 command 한 건을 보낸다. App의 key별 packet/expected 상태 CAS를 실제 소비한다. POST receipt는 후행 GET보다 먼저 보존한다. 명확 전송 전 거절·POST/COMMIT 불명·확정 receipt 뒤 GET403을 구분하고 불명에서 body/ID hold·추가 POST/새 execution ID 자동 생성0이다. 주체/client/H/Session/control/assignment/transport 전환·복귀/늦은 응답에서 이전 본문·선택을 새 주체에 재귀속하지 않는다.

기존 StageQueuePanel의 명시 취소 UI를 병행한다. 취소/재접속 후 새 보호 이력 목록에서 originRef를 선택→exact GET으로 역사 S/Q를 읽는 실제 왕복을 제공한다. 원 receipt 메모리 보유가 필수인 우회가 아니어야 한다. 새 보호 관측 전/목록 또는 고정 GET 거절 뒤 cached 본문0, 원 command/receipt 보존과 표시가능 본문을 분리한다. 원자료 등록·미발급 예약을 실제 실행/현재 권위로 표기하지 않는다. 12px·기존 i 도움말/화면 체계를 유지한다.

## 9. TDD·오류 구분·부분 동결 순서

1. **TEST_ONLY가 별도 발행되면** T01/F01 및 직접 실제 caller 시험부터 작성한다. 신규 module/export 부재의 실패는 구조적 RED로만 보고한다. 실제 기존 App/route의 명령 미지원, 원 StageQueue/준비의 새 결박 미생산 등 행동 반례를 유효한 실제 원자료로 별도 수거한다. SQL fixture 미지원/필수 row 누락·import 오류·관측 timeout을 제품 RED로 부르지 않는다. 같은 원인 준비 실패가 반복되면 3회 전에 정확 guard/원자료 차이를 Main에게 보고하며 성공 대역을 넣지 않는다.
2. **SOURCE_GO 뒤** input/sources와 P05/P06의 최소 내부 접점을 먼저 구현한다. 실제 stage/assignment/binding/등록 준비 producer가 만든 원행을 실제 보호 reader로 읽는 정상, 교차/stale/H3/E1·source 회수/alias/함수 identity 음성을 닫는다. 안정된 source 묶음만 raw/hash로 부분 동결해 독립 검수를 요청한다.
3. 같은 Tx ID/원본/Q·quota·service·0081/역완결을 연결한다. 원 S/Q→C/A/U/R 정상과 replay/동시 충돌/취소·정산 유실·COMMIT 불명을 실제 클래스 메모리 호출로 수거한다. SQL 형상은 별도 source 증거다. 정상 class 호출 없이 고정 RPC 응답만 통과한 것을 저장 전체 PASS로 올리지 않는다.
4. 실제 App.inject의 명령/GET2·인증/CSRF/query·현재/역사를 닫고 UI05/API/SessionDetail/App의 실제 메모리 DOM 흐름을 연결한다. 복제 Host의 CAS만으로 제품 App을 검증했다고 하지 않는다. DOM/Vite는 write:false·소켓0·새 dependency0, 실제 ArtifactStore는 격리 child의 fs import만 명시 메모리 mock으로 공급한다.
5. 직접 테스트/type/diff·필요 Web build, 변화에 맞는 실제 의존 인접만 실행한다. 변하지 않은 bootstrap/profile/FN10 전체를 반복하지 않는다. source 변경이 필요하면 해당 부분 동결을 먼저 해제 통지하고 지문을 갱신한다. Main은 최종 동결 이후 fresh 검증/독립 인수를 수행한다.

## 10. 필수 검수표·명령 후보

| 검수 | 정상·중요 음성 |
|---|---|
| 실제 source | 원 producer의 WAITING/확정 root assignment/등록 preparation/binding·context·정의/환경 정상; 같은 모양 다른 app/node/임무/준비/refs·child 미지원·현재 source 회수 |
| 세대·예약 | H3/E1/role generation 독립 정상; caller ID/E 주입·예약 없음/다른 origin·사후보충·synthetic E/grant/reader 전용 거절 |
| 같은 Tx/수명 | query/actor/Session/txid·call alias/getter/Prototype/port 변이·시간 역행/만료, 취소·동시 등록/원 replay·새 효과0 |
| 원장·계상 | S/Q/자기 receipt의 비순환 hash·원 실제 row/C/A/U/R·coverage/plan 세대·actor/op/policy/부모·actual/한도·양방향 누락 |
| 불명 | query HOLD/abort 외부 정착과 늦은 원 Pool 회수, COMMIT LOST/wrong tag·release 불명 뒤 성공/후행 auth/자동 명령0·원 receipt/시도 보존 |
| route·이력 | 명령/GET2 정상·401/403/404/CSRF·추가 query·다른 assignment/주체 cursor·만료·20건/동률/byte/마지막 행 cursor |
| 취소/재접속 | 원 요청 cancel 뒤 fresh 사용 거절, 현재 역사 읽기권으로 목록 ref 발견·same exact GET·원 S/Q 불변·새 snapshot 재계산0 |
| UI 실제 흐름 | 명시 선택→S/Q저장→receipt 선보존→보호조회, 재접속/취소→목록→고정조회, 불명 body/ID hold·거절/늦은 응답 본문0·원 App CAS |

아래는 **향후 GO 뒤의 검증 명령 후보**이며 이번 WI 작성 중 실행하지 않는다. 의미 있는 선택 패턴/파일 범위는 실제 작성된 시험과 소스 영향에 따라 좁혀 보고한다.

```powershell
node --experimental-test-module-mocks --test tests/unit/FN09/execution-start-origin-input.test.ts tests/unit/FN09/execution-start-origin-sources.test.ts tests/unit/FN09/execution-start-origin-store.test.ts tests/unit/FN09/execution-start-origin-routes.test.ts tests/unit/FN09/execution-start-origin-quota.test.ts tests/unit/FN09/execution-start-origin-schema.test.ts tests/unit/UI05/execution-start-origin-flow.test.ts
npm run typecheck
git diff --check
npm run build
```

실제 모듈 mock은 기존 Node24의 mock.module exports 옵션과 격리 child 패턴만 사용한다. mock된 OS port와 성공 보호 메서드 override를 구분한다. 인접 후보는 실제 수정 P05/P06/명령/quota와 직접 관련된 기존 stage-queue·registered-definition-responsible-session·execution-preparation-approval 및 preparation-history/UI05 시험으로 Main과 exact 경로를 고정한다. 추정 basename으로 실행하지 않고 rg --files로 실제 경로부터 확인한다. 실제 IO file-store/DB/SDK/Agent·C# 컴파일/서비스/외부 요청·실브라우저/served 검증은 이번 분모 밖이다.

## 11. 반환·동결·미검증·rollback

최종 반환은 판정→근거→조치 순서로 한다. 시작/끝 HEAD·branch·dirty/index와 정확23 파일별 raw bytes/SHA·변경 목록/실 diff를 제출한다. TDD는 실제 행동 RED/구조적 RED/준비 오류를 분리하고 각 정확 명령·도구 ID·exit·PASS/FAIL/SKIP/cancel·타입/build 경고와 live/pending/자원 정착 상태를 남긴다. 시험 모드/재실행을 고유 시험 수로 중복 합산하지 않는다.

문서1 초안 작성은 기능 구현/제품 GO가 아니다. 향후 소스 구현 완료도 Main 독립 인수·실제 PG/권한/계상/trigger/경합·HTTP/브라우저·SDK/Agent·전체 FN09/계획 완료와 다르다. 필수 gate 미실행은 PASS가 아니라 미검증이다. 새 범위/실제 권한·환경 제약은 정확 근거로 Main에게 반환하고 영향 없는 허용 작업은 계속한다.

최종 동결 뒤 제품/시험 write lease를 Main에게 반환하고 추가 수정/반복검사0이다. rollback은 Main이 정확23만 시작 baseline/안전 checkpoint에 대응해 정상 역변경한다. 타인 dirty·보호3·기존 SQL/원자료/실데이터를 reset/delete로 복구하지 않는다. 이 WI로 실제 DDL/자료가 적용되지 않으므로 실제 DB rollback 작업0이다.

### 보호 자료·현재 소유 분리

준비 시 tracked dirty는 Main WORK_STATUS/통제와 부모 후보 r2다. 본 작업이 stage/복구하지 않는다. 보호 비추적3은 `docs/contracts/FN06_NATIVE_COMPILE_ONLY_CANDIDATE.md`, `tests/unit/FN04/design-change-conversation-source.test.ts`, `tests/unit/FN10/stage-queue-assignment.test.ts.pending`이며 원 raw를 변경하지 않는다. 실제 GO 전후 Main의 고정 지문과 비교한다. 실행 승인 대기 SDK 공개읽기·실제 실행 선행과 이 source 원자료 작업을 섞지 않는다.

## 12. 아직 필요한 판단

1. 부모 r2의 새 등록/조회/명시 정책·단발 association·미발급 Q/rotation 없는 새 요청 규칙·GET2 공개/보관 의미의 정확 채택.
2. 이 WI 독립 검토 및 Main의 최종 hash/기준 raw/정확23 단일 writer SOURCE_GO, 필요 시 TEST_ONLY 단계 발행.
3. 0081 번호 예약 충돌과 실제 같은 목적 예산 ref의 source 대조. 번호/ID/계상·파일 내부 함수 배치는 계약 안의 기술 판단이며 새 cap/유료정책 질문으로 바꾸지 않는다.

계약이 채택되기 전 제품/시험/SQL 쓰기0을 유지한다. 임의 current=true·준비 false 승격·새 E/token/OS 권위·실제 SDK 생성으로 정상 source를 위장하지 않는다.
