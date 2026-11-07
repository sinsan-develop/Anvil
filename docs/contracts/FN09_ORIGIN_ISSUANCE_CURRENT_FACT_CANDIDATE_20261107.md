# FN09 원자료와 START 발급·현재 근거 연결 후보

- 상태: DRAFT / NOT_ADOPTED / SOURCE_GO0 / ACTUAL_EXECUTION0.
- 2026-11-07. 소유 범위는 이 문서 하나다. 제품·시험·기존 계약·현황·SQL은 수정하지 않는다.
- 부모: FN09_EXECUTION_START_ORIGIN_CANDIDATE_20261106.md r2, SHA256 65765A0B36DEDEEDF188575632535882C19477F6E3B02C8DEC29F168B43105AE.
- 관련 미채택 후보: FN07_CLAUDE_EXECUTION_ADMISSION_PRODUCER_CANDIDATE_20261106.md, SHA256 4125117462AD778E28B1EA7130EC52684E14812CBB1630A7DEB2F9BD0F5A19F8.
- 이 문서는 기존 승인으로 가능한 내부 재사용과 새로 선택할 데이터·권한 의미를 구분한다. Main 제안을 사용자 채택으로 기록하지 않는다. 실제 발급·키 사용·Agent 생성·SDK 조회 승인이 아니다.

## 1. 현재 실제 생산과 공백

| 근거 경로·위치 | 현재 생산·소비 | 연결 시 보존할 경계 |
|---|---|---|
| executions/execution-start-origin-store.ts:8–15 | 실제 보호 원자료에서 S와 후행 Q를 생성한다. executionId/generation1, credentialId/E1, 별도 논리 sessionBindingRef와 원 roleBindingRef를 고정한다 | Q는 RESERVED_NOT_ISSUED다. S/Q의 credentialIssued/executionAuthorized/dispatchPerformed/writerReservationPerformed는 false다 |
| executions/project-execution-start-origins.ts:60–79 | 같은 Tx 저장·정산, 확정 COMMIT 후 새 인증 보호조회, 원 명령 replay와 assignment별 역사 목록 | 역사 발견은 fresh 사용 허가가 아니다. 취소 뒤 원 S/Q 보존과 source 읽기권 회수 시 전체 비노출이 검증됐다 |
| executions/execution-start-origin-sources.ts:66–79 | 실제 stage/준비/임무/binding/context/application/budget를 같은 actor/Tx에서 전후 관측 | stage 기준 refs의 양쪽 포함, WAITING/current head, H/제어·원 수명과 현재 source 보호를 보존한다 |
| contracts/runtime/execution-intent-v1.ts:5–36 | 실행 소비 exact11과 준비 전용 exact13을 분리한다 | REGISTERED_DEFINITION/optionsFormat을 전역 reader에서 지우거나 일반 실행 소비자가 등록 분기를 자동 수용하도록 만들지 않는다 |
| executions/execution-commands.ts:18–48,66–88 | ProjectInitialExecutionQueue는 명시 SYNTHETIC_ONLY resolver의 basis/current를 소비하고 합성 START를 저장한다 | production HTTP 기본 등록·실제 credential/OS 권위가 없다. S/Q originRef를 원자적으로 소비하는 입력은 없다 |
| contracts/runtime/server-execution-fact-v1.ts:6–16,23–49; executions/execution-grants.ts:10–29 | exact12 checks·참조 결박을 검사하고 합성 grant 계획을 만든다 | 형상 reader는 사실을 발급하지 않는다. 계획은 필수 current 및 WORK 이해검토를 요구하며 준비 자료만으로 통과시키지 않는다 |
| executions/execution-credential-reservation-read.ts:10–25; execution-credential-current.ts:22–48 | 원 grant에 속하는 기존 합성 E1 예약과 명시 합성 token current를 검사한다 | origin Q와 다른 namespace다. 옛 reader에 Q를 넣거나 SYNTHETIC_RESERVED_NO_TOKEN을 실제 발급으로 해석하지 않는다 |

표의 짧은 경로는 apps/server/modules/ 기준이며 contracts/는 저장소 root 기준이다. 기존 FN09 준비 options·FN08 START 자료 registrar/receiver·FN07 bootstrap/factory/owner/coordinator는 이미 구현된 소비 부품이다. 다시 구현하지 않는다. 원자료 생성은 해소됐지만 실제 실행 증빙과 발급 producer가 자동으로 생긴 것은 아니다.

## 2. 권장 구분과 선택지

권장 A: 원자료에 연결된 START의 단발 귀속과 현재 근거·발급 목적을 아래처럼 명시 채택한 뒤, 같은 원 보호 source를 소비하는 하나의 수직 기능으로 구현한다. 실제 OS/SDK 실행은 제외하고 source/미적용 SQL/메모리 검증만 인수한다. 불명·회수·현재성 거절도 기능에 포함한다.

B: 먼저 원 S/Q에서 기존 합성 resolver의 basis만 실제 보호 자료로 생산하는 독립 내부 단위를 권장한다. §3.1의 basis는 이미 존재하는 START 자료 검산의 목적 한정 exact13→11 대응을 재사용하며 current·발급·origin 소비를 수행하지 않는다. 이 단위의 정상 반환에 실제 권위 계약 결정을 선행으로 부과하지 않는다. 합성 queue 전체 저장과 실제 START 발급의 인수는 별개다.

C: 현재 S/Q 저장·보호조회만 유지한다. 새 의미는 없지만 START 소비·발급 공백은 남는다.

A는 최소 권장 계약이고 아직 채택되지 않았다. B의 내부 source 매핑 전부를 실제 발급과 묶어 무조건 새 사용자 승인 대상으로 만들지는 않는다. §3의 기술 작업은 Main이 기존 범위와 목적을 대조해 결정할 수 있다. 반대로 새 단발 귀속·발급 scope·외부 전달을 순수 함수 배치라고 처리하지 않는다.

## 3. 기존 승인 안의 재사용과 새 의미의 경계

내부 재사용 가능:
- 실제 origin 고정 조회와 같은 PoolClient의 보호 source를 소비해 원 S/Q·준비·정의·환경·role/logical binding·context/options의 fullref/hash를 재대조한다.
- 안전 사본, prototype/own-data 정체성, query/actor/Tx 고정, 전후 유한 관측, DB 기한과 단조 호출 잔여의 환산을 재사용한다.
- canonical JSON/UTF8 bytes/SHA, 원 command/receipt/audit 결박, 동일 Tx quota의 reserve/settle·확정 COMMIT 후 보호조회·역사 응답 보호를 재사용한다.
- 기존 명시 합성 resolver/queue/registrar/proof/receiver를 검증에서 실제로 소비한다. 기본 production 등록·성공 current 포트는 추가하지 않는다.

목적 선택이 필요한 부분:
1. 등록 준비 exact13에서 실행 소비 exact11로 무엇을 투영하는지. 권장: 준비 exact13을 계속 보관하고 별도 목적 전용 변환에서 공통11을 도출하되, 원 preparationRef와 connectionKind/optionsFormat/Options bytes hash를 함께 private 근거로 유지한다. 전역 reader·원 준비 hash는 바꾸지 않는다. 기존 합성 START 자료의 목적 한정 투영은 §3.1에서 재사용할 수 있다. 이 투영이 등록 정의를 실제 발급 권위로 수용한다는 새 의미는 별도 채택 대상이다.
2. 원 origin 하나를 어떤 START command 한 건에 귀속시키는지와 동일 stage/origin의 취소·불명 후 다시 사용 가능한지.
3. S.execution과 Q.credentialId/E1을 실제 발급 namespace에서 같은 식별자로 승계할지, 새 식별자를 만들고 원 Q와 불변 대응시킬지.
4. 실제 fact·credential의 권위와 native 전달 목적. 형상·준비 current와 실제 관측을 분리해야 한다.
5. 최초 HUMAN SEND 선택을 언제 어떤 START/논리 session에 결박하는지. S.latestInstructionRefs는 대화 참조 목록이지, 공급할 SEND command나 원 문장 자체가 아니다.

### 3.1 먼저 닫을 독립 내부 단위: 원자료 기반 합성 START basis

실제 공백은 tests/unit/FN08/execution-command-ledger.test.ts:82–86의 수작업 basis와 같은 형태를 저장된 실제 보호 원자료에서 생산하는 함수가 없다는 점이다. 실행 권위 생산이나 합성 current의 교체가 아니다. execution-commands.ts:66–88에서 실제 consumer는 basis를 exact {intent,claim}으로 받은 후 별도로 authorizeExecution/queueExecutionCommand 정책·writer/중복·예산 예약·current를 검사한다. 이 후속 검사를 선행 basis가 대체하지 않는다.

권장 내부 함수: readOriginStartQueueBasis(db,actor,request,selection,demand,ports,call). 실제 SyntheticQueueResolver.basis(db,actor,request) 자리에는 나머지 인자를 고정한 함수로 연결할 수 있다. resolver 전체나 current를 이 함수에서 만들지 않는다. 명시 SYNTHETIC_ONLY 조립만 대상이며 기본 HTTP 등록이나 기존 요청 payload 키 추가가 없다.

- selection은 호출자가 선택한 정확 {originRef,reservationRef}의 고정 사본이다. 원 보호 row를 가져올 선택값이지 쓰기/실행 허가가 아니다. demand는 별도 명시 합성 BudgetUnits의 안전 사본이며 HTTP metadata·S/Q의 준비 미검증·모델 옵션·본문 크기에서 비용상태를 추정하지 않는다. 신호와 호출 종료는 진입에서 원 값으로 고정한다.
- 실제 ExecutionStartOriginStore.read의 hash/C/A/U/R 관계를 소비하되 직접 보호 없는 반환 포트로 노출하지 않는다. 동일 actor/PoolClient에서 origin 읽기 정책·원 준비/정의/환경/role/logical binding의 현재 보호를 검사한다. 원 Session/H/제어와 선택 S/Q를 대조하고 request의 project/client/control, executionId/executionGeneration, preparationRef, contextBundleRef/optionsRef, permissionPolicyRef/budgetPolicyRef를 원 자료와 대조한다. Q/E1은 실제 미발급 근거 검산에만 쓰며 새 grant나 발급된 E로 반환하지 않는다.
- 실제 ExecutionStartOriginSources.load의 FRESH 호출선과 원 stage/준비 reader를 소비한다. 필요한 원 등록 명령은 store가 검산한 원 결과의 commandId와 S의 원 선택/주체로 복원할 수 있다. 이는 원 FRESH 권한 검산용이며 별도 등록 명령 실행이 아니다. 원 출처의 WAITING/head·원 subject/선택/budget/기한을 생략하거나 HISTORY로 대체하지 않는다. queue용 두 runtime 정책은 기존 consumer가 계속 별도 검산한다.
- execution-start-material-registration-store.ts:54–55의 원 등록 준비 parser→connectionKind/optionsFormat 제외→exact11 fact.intent 대조를 근거로 삼는다. 목적 제한 basis 안에서만 실제 protected preparation.intent의 공통11을 원형대로 투영하고 readExecutionIntentV1로 검산한다. 원 exact13의 kind/format, 원 preparationRef, Options bytes/hash를 그 앞에서 대조한다. intent.capabilityRef는 원 입력 참조로 보존하되 능력 지원이나 current를 발급하지 않는다. 원 S/Q·등록 준비·공통 reader 변경0이다.
- claim은 정확 {projectId,executionId,executionGeneration,commandId,assignmentRef,stageRef,policyRef,operation,demand}이다. project/실행/임무/단계 applicationRef·nodeId/budget policy는 현재 보호된 원 자료, commandId는 현재 queue request, operation은 START_SESSION에서 도출한다. origination의 commandId를 새 queue commandId로 쓰지 않는다. request가 S/Q와 다르면 새 ID를 채택하지 않고 거절한다. 결과는 정확 {intent,claim}이며 raw source/권위/준비 표식을 덧붙이지 않는다.
- execution-budget.ts:47의 readClaim은 이미 문법·수요 원 검산을 가진 private 순수 함수다. 권장 최소 접점은 같은 파일에서 이 함수만 readExecutionBudgetClaim이라는 내부 모듈 별칭으로 export하고, 같은 구현을 basis가 소비하는 것이다. 기존 planReservation·reserveExecutionBudget 호출부/오류/정책은 변경하지 않는다. 이를 호출하려고 예산 예약·randomUUID·예산 원장 계산을 실행하지 않는다. 원 START 수요는 attempts=1, calls 양의 안전정수, spoolBytes 비음수 안전정수, VERIFIED_NO_CHARGE/null 또는 FINITE_CAP/유효 cost다. UNKNOWN/미확인 비용은 원 BUDGET_COST_UNVERIFIED, 오염/잘못된 조합은 원 입력 오류를 유지한다. OBSERVED를 새 요청 수요로 승격하지 않는다.
- 같은 query 정체성·actor/Session/H·txid·source refs를 전후 대조한다. 원 call/Session/정책/S/Q/한도 중 실제 기한의 최소를 넘으면 반환하지 않는다. DB 관측 전 단조 mark·관측 직후 기한 적용·마지막 await 뒤 재검산을 유지한다. 취소 후 late result를 반환하지 않으며 남은 실제 읽기를 강제 취소했다고 표시하지 않는다. SELECT·잠금/기존 보호 context 설정은 가능하지만 BEGIN/COMMIT 소유·domain 쓰기·origin 소비완료·budget reserve·grant/E/current/fact·새 receipt·token은 모두 0이다.

예상 최소 허용3: 신규 apps/server/modules/executions/execution-start-origin-queue-basis.ts, 기존 apps/server/modules/executions/execution-budget.ts의 순수 별칭 export 한 곳, 신규 tests/unit/FN09/execution-start-origin-queue-basis.test.ts. 시험은 기존 tests/unit/FN09/execution-start-origin-fixture.ts의 실제 원자료 생산·보호 reader/메모리 SQL을 재사용한다. 기존 ledger 시험의 82–86행은 교체할 소비 접점의 근거이며, 기존 current fixture나 기존 정상/음성 기대값을 바꾸지 않는다. 별도 consumer 통합 시험 경로가 꼭 필요하면 기존 ledger 원자료와의 실제 차이를 먼저 보고한다.

검증: 실 S/Q 저장 뒤 실제 보호 source→basis 반환으로 intent11/claim9 및 원 refs·queue commandId·명시 demand를 단언하고 해당 단계에서 새 저장/정산/발급0을 확인한다. 정상 및 Q/S 재봉인 불일치, 교차 actor/client/H/제어/논리 session/실행·세대, 준비 exact13·Options 오염, UNKNOWN/OBSERVED/과다키·수요 변이, query/Tx 교체, 취소/만료·후속 await HOLD의 원 기한 적용을 검증한다. 기존 readClaim 정상·실패 오류 비교와 필요한 ledger 인접만 검증한다. 명시 합성 current의 기존 ledger 증거는 그대로 별도이며, basis 정상만으로 queue 저장·origin 단발 귀속·실제 발급을 인수하지 않는다.

이 단위는 §4–9의 새 발급 계약과 독립이다. 원 자료·예산 claim 생산의 실제 누락을 채우며, 단순 false/항상412 반환기가 아니다. 하지만 source GO는 이 문서가 부여하지 않는다.

## 4. 권장 식별·단발 귀속 원형

제안 입력은 기존 ProjectCommand exact11 외피 안의 payload exact {originRef,reason}다. 원문·executionId/E/H·등록키·fact/current boolean·정책·기한·token을 caller가 입력하지 않는다. 이름 후보 issueExecutionStartFromOrigin은 기존 POST /api/v1/projects/:projectId/commands의 새 operation이며 아직 공개 계약으로 채택되지 않았다.

발급과 첫 SEND 선택은 같은 일로 합치지 않는다. START 귀속만 선택한 명령에 첫 SEND를 자동 생성하지 않는다. 첫 입력이 필요한 후행 admission은 기존 저장 SEND의 exact commandRef/envelopeHash/instructionRef/partsRef/sessionBindingRef를 별도 명시 선택·보호 조회로 결박한다.

권장 불변 결과의 그룹은 다음과 같다. 정확 필드명은 후보이며 기존 DTO가 아니다.

    {schemaVersion:1,purpose:"EXECUTION_ORIGIN_ISSUANCE",
     issuanceId,projectId,originRef,reservationRef,
     execution:{executionId,executionGeneration},
     credential:{credentialId,credentialGeneration},
     parent:{originServerCommandId,originAuthorizationReceiptRef,originAuditRef},
     subject:{userId,clientId,humanSessionId,credentialGeneration,controlGeneration},
     roleBindingRef,sessionBindingRef,preparationRef,
     registrationRef,permissionPolicyRef,budgetReservationRef,
     issuanceScopeHash,evidenceSetRef,issuedAt,expiresAt}

originRef/reservationRef는 원 S/Q exact다. 권장 식별 선택은 S의 executionId/generation1과 Q의 credentialId/E1을 승계하되, 새 목적의 실제 발급 행과 원 Q의 불변 대응을 둔다. 이는 기존 Q 계약에서 자동 도출되지 않는 새 데이터 의미다. Q 자체의 state/false/hash를 UPDATE하거나 옛 합성 credential row를 덮지 않는다. 독립 새 ID를 쓰는 대안은 기존 namespace 충돌 위험은 줄지만 논리적 실행의 이중 식별과 대응 검산이 늘어난다.

H는 현재 HUMAN credentialGeneration, E는 실행 credentialGeneration, executionGeneration은 실행 생명주기 세대다. roleBindingRef의 version/내부 generation과 논리 session ref를 이 셋의 대용으로 사용하지 않는다. H3/E1은 정상일 수 있다. 새 H 로그인은 기존 token을 재발급하는 사유가 아니며 현재 권한·origin subject 적합성 규칙을 따로 검사한다. SDK init SID는 후행 실제 SDK 관측 전에는 없으며 논리 session UUID를 SID로 승격하지 않는다.

권장 유일성은 (project,originRef.id/version/hash)→원 issuance/START 한 건이다. exact 같은 command/hash replay는 원 저장 결과만 읽고 새 발급·charge·자료등록0이다. 다른 command, 다른 requestHash, 다른 origin/Q/role/logical binding을 같은 귀속으로 처리하지 않는다. 취소·만료·회수 뒤 같은 origin의 새 generation 자동 생성은 하지 않는다. 새 세대 허용 절차는 후속 별도 원자료·명시 명령으로 정해야 하며 이번 후보에서 복구 성공으로 추정하지 않는다.

## 5. 현재 근거의 실제 생산·검산 경계

새 fact는 HTTP caller의 JSON을 받아 서버 사실로 채택하는 API가 아니다. 권장 새 목적은 EXECUTION_ORIGIN_CURRENT_EVIDENCE이며 기존 SERVER_EXECUTION_CURRENTNESS/SYNTHETIC_ONLY reader와 구별한다. 다음은 증빙 목록이지 모두 현재 검증됐다는 선언이 아니다.

| 항목 | 기존 실제 재사용 | 아직 필요한 생산자·결정 |
|---|---|---|
| subject/session/permissionPolicy | 현재 AccessRepository 인증·H·단독 제어·명시 정책 | 발급 operation의 명시 허용 범위·회수 효력 |
| assignment/basis/context/options | 실제 확정 임무/방법론·설계/계획·등록 준비/정의·환경·보호 원문 readers | exact13 목적 투영·논리 CONTEXT/OPTIONS 전달권의 해당 발급 scope |
| registration | 원 보호 등록/회수·등록 ref와 key fingerprint 검사 | 해당 목적을 서명할 등록 주체·challenge/nonce·서명 원문·검증 경로 |
| capability | 기존 HUMAN 보고·입력 ref·미검증 표시 | 해당 도구의 필수 능력에 대한 실제 증거와 승인된 판정 공급자. ref 존재는 지원 아님 |
| source/osFence | 환경 선언·sourceScopes·관측 ref 형상/소유 관계 | 실제 파일/root/link/실행 image·writer 소유 관측 producer. 선언 MATCHED를 대용으로 쓰지 않음 |
| budget/storage | 실제 정책과 기존 quota 분모·동일 Tx 예약/정산 | 실행 budget의 목적/실비·기한을 실제 발급 scope에 결박하는 생산선 |
| understanding | 원 모드별 보호 이해검토 reader | 기존 WORK/CONTEXT_REVIEW 규칙 유지. 미검증을 임의 NOT_REQUIRED로 바꾸지 않음 |

필드가 부족하면 UNVERIFIED/STALE/CONFLICT/UNSUPPORTED와 원 evidence refs를 정확히 남긴다. 검증 함수가 증거를 확인한 해당 항목에만 VERIFIED_CURRENT를 산출할 수 있으며, S.unresolvedChecks를 삭제하거나 이름만 바꿔 fact를 만들지 않는다. 필수 실제 근거가 미구성이면 발급은 효과 전 412이며, 이것을 정상 발급 여정이라고 제시하지 않는다.

기존 native 준비 authority는 codingAgentExecutionAuthorized:false다. 이 authority나 합성 grant/current의 transport를 바꿔 새 목적에 사용하지 않는다. 새 서명 key가 필수라는 결론도 내리지 않는다. 같은 등록 key의 새 목적 서명이 적합한지와 payloadHash/challenge/nonce/등록 세대·원 수명의 도메인 분리는 채택할 항목이다.

현재 key 없는 Q를 실제 token에 결박하는 issuer·안전 전달·digest 저장·폐기/회수 producer는 없다. 이 후보는 raw token을 응답/로그/원본 snapshot에 넣는 방식을 허용하지 않는다. 기존 보호 Native 채널을 재사용할 수 있는지 목적·payload·권한을 대조해야 하며, 기존 준비 opaque나 first-receive payload를 임의 전용하지 않는다. 전달 방식이 정해지기 전 실제 발급 기능의 전체 구현 가능을 약속하지 않는다.

## 6. 같은 Tx·hash 비순환·현재성·불명

권장 순서:
1. 현재 HUMAN과 project 잠금 경계를 먼저 확보하고 정책·원 S/Q·모든 보호 source를 같은 actor/PoolClient에서 읽는다. fresh WAITING/head·등록/회수·원 원자료 subject/H/제어와 원 source refs를 전후 검산한다.
2. 이미 확정된 부모 origin 명령/receipt/audit와 원 S/Q를 읽는다. 실제 START가 이번 명령의 결과라면 부모 START ref를 선입력하지 않는다. 이번 START/admission 자신의 receipt를 부모 origin receipt로 가장하지 않는다.
3. 원 목적 제한 serverCommandId/operationId/receipt ID와 issuanceId를 선고정한다. scalar ID를 먼저 정하는 것은 자기 hash를 미리 요구하는 순환과 다르다.
4. current evidence 원문/ref와 §4의 issuance payload/hash를 먼저 고정한다. 자기 command/receipt/auditRef/scopeDigest를 이 hash preimage에 넣지 않는다. 실제 START envelope가 이 결과를 참조하면 START 생성 후 별도 대응 행으로 결박한다.
5. 같은 PoolClient의 reserve plan에 새 domain·C/A/U·자기 R의 실제 열 비용을 산입하고 원 persistProjectReceipt로 자기 receipt/audit/result를 생성한다. 같은 Tx의 대응 관계로 origin→issuance→START/grant/E와 원 명령/receipt/audit/R을 후행 결박한다.
6. 마지막 보호 관측·정산과 양방향 deferred 완결을 통과한 뒤 COMMIT tag와 release를 확인하고 새 인증으로 원 결과를 보호 조회한다. 저장 후 보호 거절은 원행을 지우지 않고 본문을 반환하지 않는다.

origin 귀속 잠금과 source 취소/회수의 project→정책/원 source 잠금 순서를 맞춘다. current producer가 가진 원 DB 수명과 호출 처리의 단조 deadline은 분리하고 최소값으로만 줄인다. 새 사실의 수명은 원 S/Q, 현재 H Session, 정책, 등록/증거, budget의 실제 기한 중 최소이며 기한 없는 자료에 TTL을 창조하지 않는다. 처리 timeout으로 Q.expiresAt을 다시 쓰지 않는다.

COMMIT·발급 응답·전달 결과가 불명이면 같은 명령/귀속을 UNKNOWN으로 보존하고 자동 새 command/token/START/nonce 재발급·재전송0이다. 취소/close가 underlying 저장·전달 종료를 증명하지 않으므로 원 work 미정착 동안 BUSY/원 점유를 유지한다. 늦은 성공은 이미 정착한 외부 결과나 새 문맥의 본문을 덮지 않는다. 준비 false와 현재 공급자 부재를 이유로 항상412 wrapper만 구현하는 업무는 제안하지 않는다.

## 7. 저장·API·회수·화면의 최소 선택

새 DB/API가 무조건 필요하다고 전제하지 않는다.
- 합성 내부 조립 B는 원 ProjectInitialExecutionQueue와 C/A/U·기존 grant/credential/queue/material 원장을 재사용할 수 있는지 먼저 검토한다. 다만 origin 단발 대응을 원 command/result와 역완결로 검산할 저장 근거는 필요하다.
- 실제 발급 A는 원 S/Q를 불변으로 두면서 귀속·발급/회수·불명을 보관할 수 있어야 한다. 기존 표에 닫힌 새 purpose 분기를 forward로 추가하는 안과 별도 목적 원장 안을 비교한다. 기존 synthetic exact schema·reader/guard는 완화하지 않는다. 선택은 해당 PK/FK·현재성/역사·역완결을 함께 닫아 Main이 기술 결정하되 권위 목적은 별도 채택한다.
- 기존 /commands 외피와 인증/CSRF/정책/명령 보호는 재사용한다. 새 operation의 공개 의미는 별도이며 기존 registerExecutionStartOrigin을 발급으로 바꾸지 않는다. 고정/목록 보호조회는 기존 source 읽기권에 실제 credential 권한을 자동 추가하지 않는 방식으로 정한다.
- 회수는 원 grant/E 목적에 귀속된 명시 revoke와 현재 검사 즉시 거절로 제안한다. 원 stage 취소는 후속 fresh 사용을 차단하되 OS 중지·쓰기 회수를 완료했다고 표시하지 않는다. 역사 조회는 현재 읽기권/출처 보호와 불변 저장관계를 검사하며 원 만료/current head를 소급하지 않는다.
- UI05는 기존 origin 보호 목록→exact 원본→원 Q/미검증 표시를 재사용한다. 발급 버튼은 새 목적을 채택한 경우에만 명시 준비/확인/원 명령 보존으로 연결한다. UNKNOWN 재클릭은 새 효과가 아니라 보호 결과 확인이다. 첫 SEND 선택이나 SDK SID 입력을 freeform UUID로 만들지 않는다.

저장량은 기존 10GiB의 U/H/O와 coverage를 재사용한다. 새 정책·상한·유료 호출 한도를 만들지 않는다. 새 domain/C/A/U/R 비용은 원 동일 Tx projection/실비·유한 자기비용 식으로 연결하고 duplicate charge0을 검증한다. 원 allocation을 무조건 새 표로 바꾸거나 다른 목적 합계를 재계상하지 않는다. pending 번호는 현재 최대0081 다음 후보0082이나 이 문서가 번호/DDL 작업을 예약하거나 적용하지 않는다.

## 8. 인수할 정상과 중요 음성

내부 조립과 실제 발급의 인수 분모를 나눈다.
- 내부 정상: 실제 startStage→확정 임무/등록 준비→S/Q 저장·현재 보호 재조회→목적 전용 basis→원 합성 queue/START 두 그룹 registrar→원 proof/receiver 소비를 연결한다. 실제 보호 메서드 override0, 메모리 SQL/OS 포트와 합성 증거의 출처를 공개한다. 원 resolver의 current를 실제 source가 증명하지 않은 성공 상수로 채워 정상이라 하지 않는다.
- 실제 발급 설계 정상: 원 registered/native 증거 producer·검산→현재 근거→명시 정책/같은 Tx 귀속/발급→단발 START와 원 E 관계→후행 admission의 부모 ref 검산. 이 producer와 token 전달이 미정인 현재는 정상 runtime 인수 조건이 미충족이다.
- 실제 SDK/child 호출은 두 분모 모두 실행하지 않는다. 공식 생성 hook 호출부는 설계/명시 메모리 driver만 검증하고 제품 실행 완료로 표시하지 않는다.

필수 음성:
1. 교차 project/actor/client/H/logical session/origin/Q/grant/E/lifecycle/roleBinding·등록/key purpose·START hash는 후속 효과 전에 거절.
2. 등록 준비만 current인 상태·unresolvedChecks 삭제·exact13의 판별키 소실·새 SEND 문장/가짜 ref는 정상으로 채택하지 않음.
3. 취소·만료·등록/정책/source 회수는 fresh 거절, 역사 보호조회는 원 S/Q/발급 원문을 보존. source 보호 상실 시 페이지 전체 비노출.
4. 같은 origin 동시소비는 하나의 원 귀속만 정착. 정확 replay 등록/charge0, 다른 명령 충돌. COMMIT 불명·late return은 재발급/재전송0.
5. 사후 E예약/후행 challenge 수선·임의 세대증가·후행 admission에 맞춘 부모 receipt/audit 수정·hash 순환은 거절.
6. 외부 timeout 뒤 underlying HOLD의 점유·늦은 정착 회수, call alias/함수 교체/시간 역행 및 최단기한 재관측.
7. 첫 SEND 단발 yield/owner 장부와 원 논리 session·실제 반환 Query 결박은 기존 bootstrap을 소비한다. SID 예상값과 init 관측을 혼합하지 않음.
8. 실제 producer 부재의 차단과 실제로 지원하는 정상 순서를 구분한다. 정상 지원 가능 순서를 쉬운 거절로 바꾸거나 조건 preview로 목표를 대체하지 않는다.

## 9. 예상 영향과 직접 결정

아래는 구현 허용목록이 아니라 역할별 영향 후보다. 실제 WI에서는 계약 선택 뒤 정확 파일을 고정한다.
- 신규 내부 source/basis: apps/server/modules/executions/execution-origin-issuance-input.ts, execution-origin-issuance-sources.ts.
- 원자 귀속/발급/보호조회가 필요한 경우: 같은 디렉터리의 execution-origin-issuance-store.ts, project-execution-origin-issuances.ts.
- 기존 소비 대조: execution-commands.ts, execution-start-material-basis.ts, execution-start-material-registration-store.ts, execution-credential-reservation-read.ts, execution-credential-current.ts, execution-grant-revocation-store.ts. 기존 합성 branch는 불변 유지하고 actual purpose의 별도 entry를 검토한다.
- 실제 fact schema/검산은 contracts/runtime/server-execution-fact-v1.ts를 넓히는 대신 목적 전용 신규 codec을 우선 검토한다. 원 exact11 reader를 넓히지 않는다.
- 공통 접점: access/project-command.ts, projects/project-storage-quota.ts, projects/routes.ts. 권한 목적·ID/비용·호출 범위 한정.
- UI05: execution-start-origin-api.ts, ExecutionStartOriginPanel.tsx, SessionDetailPage.tsx, App.tsx 및 명시 정책 편집. 기존 S/Q 저장 의미는 유지한다.
- DB 변경이 필요하면 신규 forward pending 하나에서 닫힌 purpose/원 관계/역완결/ACL을 선언한다. 옛 SQL 직접 수정0.
- 시험: tests/unit/FN09/execution-origin-issuance-input.test.ts, execution-origin-issuance-sources.test.ts, execution-origin-issuance-store.test.ts, execution-origin-issuance-routes.test.ts, execution-origin-issuance-schema.test.ts와 tests/unit/UI05/execution-origin-issuance-flow.test.ts를 후보로 한다. 기존 순수 origin fixture 재사용 가능 여부를 먼저 대조한다.

직접 선택할 의미는 다섯 가지로 제한한다: 등록 준비의 실제 발급 목적 수용, origin 한 건의 START 단발 귀속, Q/E 식별 승계와 scope/회수, 실제 증빙·issuer/전달 목적, 최초 SEND의 별도 명시 선택 관계. 기존 정책/상한을 그대로 소비하는 함수 배치·잠금·복사/해시·같은 Tx 계상·순수 메모리 시험 배치는 기술 판단이다.

권장 결정문: “원 S/Q는 불변 원자료로 보존한다. 목적 한정 등록 준비 변환과 origin 단발 START 귀속·Q/E 대응 및 현재 증거의 출처를 별도 고정한다. source/미적용 SQL/합성 검증은 정확 WI로 진행하되, 기존 합성 current와 준비 authority를 실제 발급으로 전용하지 않는다. 실제 issuer·전달·runtime 증거가 미확정인 부분은 실제 발급/Agent 완료로 인수하지 않는다.”

문서 작성만 완료해도 위 선택이 채택되거나 실제 생성의 선행이 모두 충족되는 것은 아니다. 실제 current producer·발급·전달·START/admission/첫 SEND·SDK claim·6능력 관측과 실제 사용자 인수는 남는다.
