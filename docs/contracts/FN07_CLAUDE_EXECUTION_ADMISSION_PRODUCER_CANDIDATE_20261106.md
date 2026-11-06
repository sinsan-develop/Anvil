# FN07 Claude 실제 생성 구성·원허가 producer 후보

- 상태: **DRAFT / SOURCE_GO0 / ACTUAL_EXECUTION0**. Main의 기술 검토용 제안이며 직접채택·제품 구현·실행 승인이 아니다.
- 기준: FN10 저장 통합 fc45abea98fedf12d4b56d7be1cbd43a67b4ac07 이후 현재 소스. 부모 경계는 `FN07_CLAUDE_DRIVER_PROCESS_TOOL_BOUNDARY_CANDIDATE_20261106.md`, 계획 FN06/FN07/FN08 및 CAPABILITIES다.
- 소유/범위: 이 문서1만 작성. 기존 코드·시험·SQL·계약·현황 변경0. SDK 공개읽기 소진을 보존하고 재조회0. 실제 실행파일/사용자자료 조사·SDK import/query·OS child·DB·키·권한·서비스·Agent·유료호출0.
- r2 보완: r1 33664B/CBE8B8036B1EFB638CC77917125D941DFB4F0D6ECA080AD5DA692824968CA54A의 독립 C0/I1/M1을 반영했다. 확정 부모 START 증빙과 자기 admission receipt의 비순환 순서, 로컬 기록으로 확인된 spawnClaudeCodeProcess 이름, 논리 sessionBindingRef와 SDK SID의 별도 매핑을 고정한다. SOURCE_GO0 유지다.

## 1. 완성할 실질 기능과 현재 근거

목표는 사용자가 선택한 기존 Claude Code 연결과 실제 보호된 START/첫 SEND를, 검산된 실행 구성과 그 효과를 허가하는 원 서버 결정에 결박해 공식 SDK 생성 hook에 단발 공급하는 것이다. 단순 process 소유 래퍼, 임의 current=true, SYNTHETIC_ONLY 표식 변경, 준비 false의 true 전환, 고정 QA launcher 실행으로 대신하지 않는다. source-only 단계에서는 실제 producer/검사/소비 코드의 합성 종단을 검증할 수 있지만 실제 지원·실제 process/계정·6능력 인수는 별도다.

| 현재 원 경로 | 실제 제공 | 전용할 수 없는 공백 |
|---|---|---|
| `docs/contracts/CAPABILITIES.md` §4·§7 | Claude Code 2.1.224 관측, SDK 0.3.224 내부 객체 기준과 6능력 미검증 | 과거 설치 경로/버전은 현재 exe 정체성·계정 허가·SDK 비용 승인 증거가 아님 |
| `connections/claude-process-profile-selector.ts:50–68` | 같은 access/db/actor로 실제 정의·환경·resources·등록·직접/snapshot source root 보호 읽기, MATCHED·선택 profile 선언 | 반환은 actualExecutionVerified/executionEligible/executionAuthorized/dispatchPerformed/workAccepted=false·ownership UNVERIFIED. 실제 경로/argv/env를 발급하지 않음 |
| `contracts/runtime/environment-configuration-v1.ts:34–38` | profile exact9: label/purpose/hostRef/toolRequirements/program/argsTemplate/workingDirectory/secretSlots/policyRef | program은 선언 문자열. 버전 요구는 원문이며 지원 판정이 아님. env 실행 map은 없음 |
| `executions/execution-commands.ts:18–26,57–128` | SyntheticQueueResolver와 ProjectInitialExecutionQueue의 같은 Tx 준비/예산/정책·START/자료등록 | resolver/fact/queue/grant/writer는 SYNTHETIC_ONLY. 실제 START 허가 producer로 자동 승격 불가 |
| `contracts/runtime/server-execution-fact-v1.ts:5–40` | H/E·등록키·intent/준비·정책/예산·source 및 12 checks의 형상/참조 검산 | parser는 서버 현재성 인증자가 아님. transport SYNTHETIC_ONLY·executionAuthorized/dispatchPerformed=false만 받음 |
| `contracts/runtime/native-preparation-authority-v1.ts:18–19` | NATIVE_PREPARATION_AUTHORITY, 원 등록키 fingerprint·부모 command/receipt/audit, CHECK_NATIVE_PREPARATION_CURRENT/CONSUME_NATIVE_PREPARATION | codingAgentExecutionAuthorized:false. 준비/slot/owner를 실제 코딩 생성 permit으로 쓰지 않음 |
| `secondary/start-options.ts`·`instruction-bootstrap.ts`·`sdk-query-factory.ts` | 실제 receiver bytes/hash·원 Options·선택 SEND·현재 fact/공통 permit 소비, 실제 yield의 private 근거·START/Query/SID/상한 결박 | 명시 SYNTHETIC_ONLY driver/current/authority 경계. 기존 constructor의 표식만 바꾸거나 SDK 실제 driver를 주입하면 계약 변경 |
| `secondary/sdk-session-owner.ts`·`session-coordinator.ts` | 한 Query/iterator·원 입력 장부·관측·UNKNOWN/close/lane 관리 | 실제 SDK/OS 소유·현재 실행 authority와 SESSION claim은 미생산 |

정의의 adapterKind는 CLAUDE_AGENT_SDK, toolProduct는 Claude Code를 exact 대조한다. toolRequirements는 Claude Code 항목 하나 이상과 나머지 배열/버전 원문을 보존한다. 기존 도구 정의를 자동 변환하거나 다른 도구를 alias로 허용하지 않는다.

## 2. 원 선언과 새 실행 의미의 분리

argsTemplate은 `{kind:"LITERAL",value}` 또는 `{kind:"SECRET_SLOT",name}`이며 secretSlots의 이름/SECRET_REFERENCE_METADATA 참조와 정확 사용 관계를 가진다. workingDirectory는 `{sourceRootRef,relativeDirectory:null|string}`다. 환경은 executionHostRef/targetHostRefs/sourceRoots/commandProfileRefs/secretRefs/policyRef를 보유한다. 이 데이터를 곧 OS 인자·환경변수·실 cwd로 해석하는 것은 새 의미다.

| 새 선택/허가 의미 | 제안 | 내부 구현과의 경계 |
|---|---|---|
| executable 정체성 | 원 program 선언을 명시 선택된 host의 승인된 설치 관측과 exact 결박 | PATH 검색·기본 claude.exe·과거 관측 경로·shell 문자열로 자동 해소하지 않음 |
| 실제 cwd/root | 원 root/mapping/observation·sourceScopes에 포함된 실제 root와 상대경로만 해소 | 경로 정규화·link/재분석점·경계/현재성 검사는 내부 구현, 새 root/쓰기 범위 허용은 별도 의미 |
| argv | 원 profile literal과 고정 SDK가 만드는 CLI 인자의 정확 닫힌 합성 규칙 | 임의 args/추가 flag/shell/env expansion forwarding0. SDK 내부 인자 문법이 아직 기록되지 않은 부분은 §7 공백 |
| env | 원 host/프로필·secretRefs에 결박된 명시 변수별 허용 catalog만 공급 | process.env 전체 상속·임의 인증/모델/SDK설정·PATH 우회·기본값 몰래 삽입0 |
| SECRET_SLOT | 원 secret metadata를 승인된 전달 위치/수명으로만 native 보호 resolve | 이름이 env 이름이라는 기존 계약은 없음. argv secret은 process 목록 노출 위험이 있어 별도 결정 필요 |
| 새 서명 목적/생성 효과 | 기존 등록키를 쓰더라도 실행 관측·CREATE_CLAUDE_PROCESS는 별도 목적/도메인 | 새 키가 필수는 아니지만 같은 키의 기존 준비 목적을 바꾸는 것은 내부 리팩토링이 아님 |

아래는 새 typed 계약의 **제안 exact 원형**이다. 현재 exported DTO·기존 endpoint가 존재한다는 뜻이 아니다. 숫자 상한/TTL·유료정책을 새로 만들지 않고 기존 원 상한과 최소기한 안에서만 설계한다. OS 세부 식별/서명 wire와 SDK 인자 문법의 미정은 성공 포트로 메우지 않는다.

## 3. 원 관측 producer와 폐쇄 실행 구성

### 3.1 명시 선택과 native 관측

브라우저의 제안 선택 입력은 다음뿐이다. 실제 경로·argv/env/secret값·current boolean을 브라우저 입력으로 받지 않는다.

```text
{connectionRef,environmentRef,profileRef,registrationRef,
 preparationRef,startCommandRef,firstSendCommandRef,reason}
```

각 ref는 원 VersionRef다. 이 후보의 비순환 기준은 **실제 부모 START command/receipt/audit가 이미 확정 보관된 뒤** 별도 admission 자신의 원 명령을 처리하는 것이다. 실제 START commandRef가 없으면 synthetic command를 대입하거나 admission 자신의 receipt를 부모 START 증빙으로 대신하지 않는다. 부모 START 생산은 별도 앞 선행이며 아직 실제 producer 미완료다. 부모 START 보관 자체도 OS 생성 효과를 수행하거나 이번 admission 허가를 대신하지 않는다. 같은 외피 하나로 START와 admission을 합치는 대안은 이 원형에서 빼고, 별도 순서/권한 계약을 검토하기 전 자동 채택하지 않는다.

원 native 등록 owner만 typed 관측 challenge를 받아 동일 host의 선택 설치/실 root를 읽고 다음 불변 observation을 생산하는 안을 제안한다. 서명은 caller가 전달한 함수가 아니라 현재 보호 등록키 owner의 캡처된 목적 제한 signer를 소비한다. 현재 후보 작업에서는 관측·키 접근을 실행하지 않는다.

```text
{schemaVersion:1,purpose:"CLAUDE_EXECUTION_CONFIGURATION_OBSERVATION",
 observationId,requestId,installationId,projectId,registrationRef,
 hostPublicKeyFingerprint,human:{userId,clientId,credentialGeneration,controlGeneration},
 execution:{executionId,executionGeneration},
 refs:{connectionRef,environmentRef,profileRef,preparationRef},
 executable:{programDeclarationHash,canonicalPathDigest,fileIdentityDigest,
             contentHash,versionEvidenceRef},
 workingDirectory:{sourceRootRef,rootObservationRef,mappingRef,
                   relativeDirectory,rootIdentityDigest,directoryIdentityDigest},
 argvTemplateHash,environmentCatalogHash,secretReferenceSetHash,
 checkedAt,expiresAt,parentPreparationCommandRef,challengeHash}
```

hash 자체는 실행 허가가 아니다. canonicalPathDigest/fileIdentityDigest는 임의 UUID가 아니라 native의 원 OS 관측에서 계산하는 후보이며, 그 실제 생산자와 canonical 형식을 별도로 고정해야 한다.

native private record에는 실제 canonical exe/cwd/root와 원 관측 file/directory identity 및 각 hash의 preimage를 보존한다. 서버/브라우저에는 기본적으로 실제 경로·secret 원문을 복제하지 않는다. digest 형식·OS file identity의 canonical 구조·버전 관측 방식은 코드 WI 전에 고정할 필수 기술 원형이다. 버전 확인을 위해 프로그램을 실행하는 방식도 이번 source-only 실행 범위에 포함되지 않는다.

관측은 원 challenge/request·등록/키 fingerprint/H·E/parent/profile/source refs에 결박되고 임의 서명된 다른 목적과 호환되지 않는다. 같은 key의 등록 상태/회수·세대·challenge 단발·시각/최단기한을 서버가 원 저장값으로 검산한다. 서명은 해당 host의 보고 출처만 인증하며 host 침해까지 해시 관측이 참임을 보증하지 않는다. 이전 관측을 현재 설치/파일 무변경의 증거로 무기한 사용하지 않는다.

여기 parentPreparationCommandRef는 refs.preparationRef를 원 결과로 생산한 **이미 확정된 준비 명령**의 ref다. 관측 provenance용이며 후행 실제 부모 START/admission 자신의 명령과 다르다. 원 준비 command/receipt/audit 관계를 실제 보호 reader로 대조하되 codingAgentExecutionAuthorized:false의 의미를 보존한다. 준비 증빙을 실제 생성 허가로 서명하거나 재해석하지 않는다.

### 3.2 실행계획의 private 실제값과 공개 봉인

native에서 원 observation과 보호 metadata를 재대조한 뒤 내부 launch plan을 만든다. 제안 private exact 그룹은 `{attemptId,observationId,executableHandleIdentity,executablePath,cwdIdentity,cwd,argv,environment,secretLoans,stdioOwner,deadline}`다. 이 실제값을 일반 HTTP DTO·로그·receipt에 직렬화하지 않는다. secretLoans는 원 보호 handle/단발 수명이며 JS 문자열의 완전한 메모리 삭제를 보장하지 않는다.

서버가 볼 봉인은 `{observationRef,profileRef,rootObservationRef,argvPolicyHash,envPolicyHash,secretReferenceSetHash,launchTemplateRef,launchPlanDigest}`다. secret 원문 또는 추측 가능한 secret의 공개 hash를 넣지 않는다. 실제 secret을 포함한 argv/env와 이 봉인을 어떻게 보호 결박할지는 전달 방식에 따라 고정해야 한다. argv SECRET_SLOT을 단순 치환해 공개 argsHash를 만들고 안전하다고 하지 않는다.

권장은 secretSlots마다 목적/허용 전달 위치를 명시한 참조 catalog를 먼저 채택하는 것이다. 기존 metadata만으로 argv secret 노출이나 env 변수 이름을 자동 허가하지 않는다. 초기 실행에서 argv secret을 제외하는 안과 명시 위험 동의 후 허용하는 안은 사용자 기능 범위 차이이며, 모든 유효 profile을 지원한다고 표시한 채 편의상 거절해서는 안 된다. 필요한 원 slot이 미채택이면 생성 전 명확 거절·그 profile 실제 지원 미완료다.

## 4. 합성이 아닌 원 START/fact·생성 허가 producer

현재 SyntheticQueueResolver·ServerExecutionFactV1·합성 grant/permit의 모든 기존 의미는 보존한다. 새로운 실제 admission producer를 그 객체의 transport/false 수정으로 만들지 않는다. 새 목적의 명시 parser/생산 경로를 두거나 목적 분리 확장을 채택해야 한다. 기존 실행 intent reader의 exact 형상·등록 준비 exact13과 실행 권위 exact11의 분리도 유지한다.

아직 6능력 실측이 없는 도구를 실제 임무용 capability VERIFIED_CURRENT로 만드는 것은 불가다. 반대로 최초 능력 검증에 필요한 생성까지 ‘이미 6능력 완료’를 요구하면 순환하므로 두 허가를 구분해야 한다. 권장 별도 결정은 원 생산 hook/관측·같은 안전선행을 소비하는 **LIMITED_VALIDATION 생성 목적**과 **ASSIGNMENT_EXECUTION 목적**의 분리다. 전자는 정확 검증 임무/파일·도구·계정·비용·종료 범위를 별도 명시하며 실제 임무 실행권위가 아니다. 고정 QA launcher의 성공으로 대체하지 않는다. 현재 실제 실행은 둘 다0이며 source-only 메모리 검산은 제한 실제 실행 승인을 뜻하지 않는다. 이 목적을 채택하지 않으면 최초 능력검증용 원 생성 허가가 어떤 기존 계약에서 나오는지 먼저 확인해야 하고, 이번 후보만으로 성공 actual admission을 약속할 수 없다.

서버의 제안 같은 Tx 순서는 다음과 같다.

1. 원 Session/HUMAN user/client/H, project 제어/현재 정책·원 정의/환경/profile·원 준비/확정 임무/역할을 실제 보호 reader로 읽는다. 데이터상 capabilityRef/budgetRef 보유를 실제 capability 지원/예산 허가로 바꾸지 않는다.
2. 원 E는 실행 예약이 발급한 실제 executionGeneration이다. 현재 H3/E1을 독립 검산하고 H=E를 요구하지 않으며, 외부 caller E3나 E예약 없음·사후예약으로 보충을 거절한다.
3. typed 관측의 challenge·등록키·host/root/mapping·sourceScopes·observation/profile refs·원 command/등록/세대·회수·기한을 검산한다. 현재 파일/경로 관측은 native가 생성한 원 증거를 재대조하며 declaration MATCHED만으로 대체하지 않는다.
4. 실제 원 START 자료의 CONTEXT/OPTIONS 두 그룹과 material receipt/manifest/bytes/ref/hash를 원 registrar로 결박한다. 현재 원 registrar가 synthetic fact/권위만 받는 부분은 새 실제 목적의 producer와 검산 schema 연결이 필요한 선행이다. 기존 SEND/0062/START자료 저장을 이름만 바꾸지 않는다.
5. 첫 입력은 명시 선택된 기존 HUMAN SEND의 원 문장·instructionRef/partsRef/receipt·sessionBindingRef·commandId다. 실제 current/clientauthority/permit이 아직 SYNTHETIC_ONLY이면 별도 실제 목적 생산이 필수다. bootstrap의 보호 receiver/실제 yield·private 출처 장부는 재사용하되 synthetic current 성공값을 생성 허가로 전용하지 않는다.
6. 모든 실제 checks의 근거를 원 저장/관측 refs로 생성한다. 예산·누적 호출/시간/비용/저장량·동시 writer·OS fence·기준/이해검토를 원 모드에 맞게 검사한다. required check가 UNVERIFIED이면 생성 허가0이다. 준비 false·모델 maxBudgetUsd만으로 검산을 통과시키지 않는다.
7. 새 admission 자신의 같은 PoolClient/Tx에서 serverCommandId를 먼저 고정한다. **이미 확정된 부모 START/자료 refs**를 읽고, 아래 §4.1 순서로 admission payload/ref를 먼저 확정한 뒤 그 ref를 target으로 자기 command/receipt/audit·예산/저장량 reservation·admission 저장 관계를 만든다. 호출비용과 저장량은 각 원 계약의 분모로 계상하며 새 무료/유료 정책을 만들지 않는다. COMMIT tag와 Pool 반환 확정 뒤 새 보호조회로 원 결과를 반환한다.

새 `ClaudeExecutionAdmission` 불변 payload의 제안 exact 그룹은 다음이다.

```text
{schemaVersion:1,purpose:"CLAUDE_EXECUTION_ADMISSION",admissionId,
 admissionMode:"LIMITED_VALIDATION"|"ASSIGNMENT_EXECUTION",
 projectId,executionId,executionGeneration,
 subject:{userId,clientId,humanSessionId,credentialGeneration,controlGeneration},
 registration:{ref,hostPublicKeyFingerprint},
 parent:{startCommandRef,startAuthorizationReceiptRef,startAuditRef},
 start:{commandRef,envelopeHash,contextBundleRef,optionsRef,materialReceiptRef},
 instruction:{commandRef,envelopeHash,instructionRef,partsRef,sessionBindingRef},
 configuration:{observationRef,connectionRef,environmentRef,profileRef,
                launchTemplateRef,launchPlanDigest},
 expectedSessionDigest,attemptId,policyRef,budgetReservationRef,sourceScopeHash,
 factRef,factEvidenceRefs,allowedEffect:"CREATE_CLAUDE_PROCESS_ONCE",issuedAt,expiresAt}
```

원 refs/E/actor·SID/문장은 caller 선언이 아니라 실제 producer와 원 수신에 결박한다. expectedSessionDigest만으로 실제 SESSION claim은 생기지 않는다. 새 actual fact는 기존12 checks 이름을 재사용할 수 있으나, 의미/증거와 expiry source를 가진 실제 producer가 먼저 필요하다. 모든 checks를 current=true로 채운 구조 fixture는 불가다. 원 H/E·등록키·START·attempt·구성 hash 중 하나라도 다르면 생성 전에 거절한다.

factRef는 그 actual producer가 실제 보관한 불변 현재성 관측 원문의 fullref이며 checks의 상태/근거·원 intent·현재 subject/등록/정책/예산/수명·writer/fence 관계 전체 hash를 결박한다. factEvidenceRefs만 따로 모으거나 기존 synthetic fact의 transport만 바꿔 이 ref를 발급하지 않는다. LIMITED_VALIDATION의 capability 미검증을 NOT_REQUIRED로 임의 바꾸지 않으며, 해당 검증 목적에 허용되는 선행/효과를 별도 규칙으로 명시해야 한다. 원 이해검토의 모드별 예외도 기존 의미를 보존한다.

### 4.1 부모 증빙과 자기 receipt의 비순환 발급 순서

parent.startCommandRef/startAuthorizationReceiptRef/startAuditRef는 **같은 이미 확정된 실제 부모 START 한 명령**의 세 자료다. start.commandRef와 parent.startCommandRef는 exact 동일하며 부모 START의 원 result/envelopeHash·자료 refs·project/등록/H/E/원 임무·정책·첫 SEND 관계를 보호 조회로 대조한다. parent.startAuthorizationReceiptRef는 그 부모 START가 받은 원 승인 영수증이고, parent.startAuditRef는 그 부모 START의 원 감사다. 준비 명령의 영수증·관측 서명·이번 admission 자신의 receipt를 여기에 넣지 않는다. 부모 START가 실제 실행 허가를 이미 발행했다고 추정하지 않고, 이번 생성 effect에 대한 별도 admission 정책/권한을 다시 검사한다.

1. 앞선 확정 자료 P = 부모 START/그 receipt/audit + 준비·자료/첫 SEND·관측·actual fact refs를 읽는다. actual fact 원문도 이번 admission 자신의 target/scopeDigest/receipt를 참조하지 않아야 한다. 해당 ref가 없거나 자기 command에 의존하면 생산 전 거절한다.
2. 원 외피 requestHash와 현재 정책·P를 검산하고 이번 admissionId/attemptId/자기 serverCommandId·operationId·authorizationReceiptId·auditId를 원 목적 제한 ID producer에서 선고정한다. 스칼라 ID 선고정은 자기 결과 hash를 선입력하는 것이 아니다.
3. §4의 payload S를 만든다. S에는 P와 선고정 admissionId/attemptId가 있으나 **자기 authorizationReceiptRef/auditRef/resultRef/scopeDigest는 없다**. H = SHA256(canonicalJson(S)), admissionRef={id:admissionId,version:1,contentHash:H}를 먼저 고정한다. source/actor/current/P 최소기한을 다시 검사한다.
4. 같은 Tx의 원 reserve plan/projection은 고정 S/admissionRef와 자기 command/receipt/audit 실제 열의 비용을 소비한다. 비용의 유한 고정점은 숫자 자기비용 문제이지 S에 자기 receipt hash를 넣는 순환으로 해결하지 않는다. 원 persistProjectReceipt가 **targetRef=admissionRef**와 이번 request/policy/actor에서 자기 scopeDigest/receipt·audit·result를 생산한다.
5. 별도 저장 관계 B = {admissionRef,serverCommandId,operationId,authorizationReceiptId,auditId}로 자기 부모 FK와 원 command/result/receipt/audit·R을 후행 결박한다. 필요 시 자기 receipt/audit의 ref/hash를 보호 응답에서 부가할 수 있으나 **S/hash preimage로 다시 넣지 않는다**. B의 각 hash를 S의 contentHash로 재귀 복원하지 않는다. 역완결 guard가 B와 원 target/scopeDigest/result·서명 payloadHash=H를 다시 검사한다.
6. 같은 Tx COMMIT·release 확정 전에는 외부 실행 가능한 허가를 반환하지 않는다. 서명이 외부 효과/관측 가능한 작업이면 COMMIT 뒤 확정 S/B를 새 인증으로 읽고 같은 H·현재성에서 목적 signer가 단1회 발급/기록하는 후행 절차가 필요하다. 그 정착 불명에는 재서명/새 admission 발급0이며 서명 없는 ADMITTED 결과를 실행 가능한 것처럼 표시하지 않는다. DB 내 순수 서명인지 보호 signer 외부 작업인지에 맞춘 정확 원자성/저장 배치는 WI에서 고정한다.

해시 의존은 **P→S/H/admissionRef→자기 receipt·audit/result→B** 한 방향이다. 원 scopeDigest가 target admissionRef를 포함해도 S가 그 scopeDigest/receipt를 역참조하지 않으므로 순환하지 않는다. 자기 receipt를 parent에 넣어 S→receipt→target S의 hash가 되는 안은 제외한다. 정상/음성 검수에는 자기 receipt/audit를 parent에 대입·같은 길이 다른 부모/actor·미확정 부모·관계 누락을 추가한다.

최소수명은 원 Session idle/absolute·현재 제어/정책·등록/키·실 E예약/허가·START/SEND·자료/관측·root/fence·예산/자동범위의 가장 짧은 값이다. 원 sync 호출에서 deadline을 고정하고 await 뒤 now+budget으로 연장하지 않는다. 현재성 관측의 짧은 기한은 해당 권위에 반영하되 단순 처리 timeout을 되돌려 자원을 부활시키지 않는다.

## 5. 서명·단발 소비·서버 저장/조회 제안

위 admission payload의 H(canonicalJson(payload))를 정확 원 command/receipt/정책에 결박해 서명하는 안이다. 기존 등록키/설치 서버키 중 어느 기존 보호 signer가 실제 생성 허가를 발급할지는 목적별 역할을 구분해 채택해야 한다. host 서명은 관측 출처이고 서버 서명은 원 admission 허가다. 둘을 하나로 합치거나 host의 자기서명만으로 실행 허가를 만들지 않는다. 새 keypair/표/endpoint가 무조건 필요하다고 단정하지 않는다.

서명 wire에는 정확 purpose/version/domain/method/target·payloadHash·원 nonce/request/attempt·issuedAt/expiresAt·등록키 fingerprint를 포함하는 목적 제한을 제안한다. 기존 native 준비의 nonce/allowedOperations를 변경하지 않는다. 정확 암호 알고리즘/encoding/domain literal은 이미 승인된 보호 signer의 실제 지원과 대조해 WI에서 고정하며 알려지지 않은 sign 함수나 성공 callback을 발행자로 쓰지 않는다. 동일키의 새 서명 목적과 코딩 생성 효과는 새 중요 계약이다.

단발 상태 제안은 PREPARED(실제 생성 허가 아님)→ADMITTED(원 허가 확정)→CREATE_ATTEMPTED→PROCESS_OBSERVED/UNKNOWN/CLOSED다. CREATE_ATTEMPTED는 생성 효과 직전 원 journal에 먼저 고정하며 기록 정착 불명이면 생성0이다. 같은 attempt/원 hash의 조회만 허용하고 다른 attempt로 자동 재생성하지 않는다. PROCESS_OBSERVED도 업무 완료·SESSION claim·6능력 인수가 아니다.

기존 command/result·보호 원장에 admission/관측/소비를 함께 담을지 목적별 저장을 둘지는 내부 배치 선택이다. 새 불변 자료와 원 command/receipt/audit/등록·예산/소비의 양방향 완결, 현재 회수/중복 CAS가 필수다. 단순 Map이나 caller 제공 VersionRef만으로 원장 존재를 주장하지 않는다. 저장량에는 실제 원행/command 결과 복제/receipt/audit/R 자기비용을 한 번씩 포함하고 secret/원문/관측 파일을 불필요하게 복제하지 않는다.

제안 공개 흐름은 이미 확정된 실제 부모 START를 명시 선택하고 기존 project commands의 `prepareClaudeExecutionAdmission` 목적 및 정확 고정 admission GET을 두는 안이다. 기존 synthetic 명령을 실제 실행으로 바꾸지 않고 새 목적/정책을 분리한다. 기존 명령/저장 배치를 재사용할 수 있는지는 별도 기술 선택이지만, §4.1의 부모와 자기 증빙의 선후 관계를 없애지 않는다. 정확 공개 path/input·app/connector 인증·새 native signed observation 수신 경로·후행 process 보고 경로는 신규 계약으로 채택해야 하며 이 문서가 endpoint를 등록하지 않는다. 조회는 same-origin/no-store·현재 actor/정책/출처 보호·비밀0, COMMIT/HTTP 불명은 원 command/body/ID 보존·자동 POST0다.

## 6. 실제 생성 직전 검산과 SDK 인계

원 native owner가 admission 서명/현재 등록·E예약/회수·profile/root/파일 관측과 원 최소기한을 다시 검사한다. 실제 exe는 hash 관측한 파일과 생성된 image가 같은지 확인해야 한다. path 문자열 일치만으로 TOCTOU를 닫지 않는다. 선택된 native 생성 source가 변경 금지 소유/원 file identity·root link 경계를 유지하고, 필요한 경우 suspended child의 실제 image/Job 귀속을 실행 전에 검산하는 설계가 필요하다. 불명 상태에서 새 writer를 열지 않는다. 현재 일반 NativeOwnerHandle은 SDK의 pipe/exit handle을 제공하지 않으므로 새 concrete 생성 supplier가 필수다. QA용 Codex 고정 handshake의 pipe/HANDLE_LIST/Job 조합은 참고 primitive이며 제품 supplier·Claude 허가로 전용하지 않는다.

새 supplier는 원 attempt에 하나의 원 child, private process handle·소유 Job/동등 경계, stdin Writable/stdout Readable, 별도 stderr 소유자, exit/error listeners와 원 cleanup을 결박해야 한다. shell=true·기본 shell·광범위 handle 상속·unbounded stderr·전체 env 전달0이다. 파일/Job/자식 writer 회수는 process.killed나 kill 반환값이 아닌 실제 관측 근거로 별도 판정한다. OS primitive와 정확 실패 반환은 실제 실행 없이 source 설계/메모리 OS 포트로 먼저 검수한다.

생성 구성→허가→단발 journal→SDK Query 생성 호출→공식 spawn hook→동일 원 process supplier→원 Query/init/첫 입력→원 owner/codec으로 이어지는 순서다. callback에서 받은 command/args/cwd/env가 원 closed plan과 exact하지 않으면 process 생성0이다. SDK 내부 default spawn으로 fallback하지 않는다. 같은 instance의 maxMessageBytes를 실제 yield 전에 적용하고 원문 자르기0이다.

공식 Query의 최초 user AsyncIterable은 실제 instruction receiver의 원 bytes로 만들며, 실제 yield를 private 장부에 기록한다. init이 먼저 와도 같은 Query/init/prefix를 보존하고 기존기한 안의 원 yield를 기다린다. 생성 시도/입력 yield/SDK 메서드 정착/init 관측/SESSION claim/업무 완료는 다른 사실이다. 원 command가 직접 owner 또는 SEND bridge로 이미 공급됐으면 새 bootstrap 인수0이며 인계 직전 await 없이 같은 owner 원장에 결박한다. 원 START 전체/envelope/옵션·expected SID digest·sessionBindingRef/attempt/input/반환 Query/facade의 factory private 출처를 검산한다.

planned 신규 session UUID는 고정 SDK Options.sessionId→--session-id 지원의 기존 기록에 근거해 입력할 수 있지만, 실제 SID는 같은 생성/Query/init에서 exact 대조한 뒤 보호 SESSION claim으로 별도 결박해야 한다. 불일치면 UNKNOWN/종료 경계이며 관측 SID 자동 채택0이다. 기존 세션 재개는 별도 저장 SID/권한/소유 근거가 필요하므로 임의 UUID로 대체하지 않는다. SESSION claim 전/후에 같은 첫 instruction을 재공급하지 않는다.

**선행 논리 binding과 후행 SDK SID는 다른 값/역할이다.** 첫 SEND의 sessionBindingRef는 Anvil이 이미 저장한 책임 세션/논리 binding의 fullref이며 실제 SDK의 session_id 문자열이나 planned UUID가 아니다. START/원 fact의 agentSession.sessionRef와 첫 SEND의 binding이 그 원 계약상 같은 Anvil 참조인지 검산하되, 그것을 SDK SID와 같다고 비교하지 않는다. 생성 전에는 `{startCommandRef,attemptId,sessionBindingRef,expectedSessionDigest}`를 admission/원 private factory에 함께 고정한다. 생성 뒤 같은 원 Query/init 관측에서 expectedSessionDigest와 실제 SID digest를 대조하고, 실제 process/등록/E/첫 yield·원 생성 허가와 함께 **mapping={sessionBindingRef,attemptId,queryIdentityDigest,observedSessionDigest,admissionRef}**를 보호 SESSION claim의 근거로 후행 생산하는 안이다. raw Query handle·raw SID를 일반 응답에 노출하지 않는다. Query identity는 caller 임의 object가 아니라 원 factory private 생성 상태의 근거를 소비한다.

따라서 SEND를 보관하기 위해 SDK init이 반드시 선행한다거나, init을 받기 위해 아직 저장되지 않은 SEND가 필수라는 순환을 가정하지 않는다. 논리 binding/기존 SEND의 원 생산을 먼저 검산하고 같은 생성의 첫 입력·init 순서는 원 기한 안에서 지원한다. mapping의 정확 저장/권한·회수/충돌과 SESSION claim producer는 아직 새 결정이며 이 문서가 자동 발급하지 않는다.

## 7. 확인된 SDK 포트와 구현 전 반드시 닫을 공백

추가 공개조회 없이 `docs/04_test_reports/AV3/FN07_PINNED_SDK_SPAWN_SOURCE_READ_20261106.md`만 소비한다. 고정 SDK 0.3.224의 d.ts SHA256 556277033B15112811922D84EC8DC846D446CCE7BD9AA27765C52A9C09869575, mjs SHA256 70E00A3EE54A88382CA606893AC3C4ACDD9BB83A9E11A9D3E803FA0B63389ED5다.

확인된 SpawnOptions는 command:string/args:string[]/cwd?:string/env:문자열 또는 undefined map/signal:AbortSignal이다. SpawnedProcess는 stdin Writable/stdout Readable/killed/exitCode/선택 signalCode/kill(signal):boolean·exit/error의 on/once/off다. **별도 stderr 필드는 없다.** 원 stderr는 같은 child supplier의 별도 private 수집 경로로만 다룬다. 원문/자격정보 유출 방지·수집 cap/EOF·오류/종결과 버림량을 보존하며 stdout 프로토콜과 합치지 않는다.

공식 hook 이름 **spawnClaudeCodeProcess**는 기존 통제 `FN06_IMPLEMENTATION_CONTROL_20261104.md:1936,2052,2097`의 확인 기록에 존재한다. 그 이름을 미확인 SDK 옵션으로 분류했던 r1 문구를 정정한다. 이 로컬 기록과 §7의 SpawnOptions/SpawnedProcess 원형만 소비하며 SDK를 재조회하지 않는다. 다만 **전체 callback 반환 동기성/서명**, SDK가 생성하는 **argv 전체 grammar/필수 환경 변수와 값 출처**는 그 이름 확인만으로 확정되지 않는다. async callback·서버 await가 가능하다고 추정하지 않는다. 내부 factory.driver.create는 합성 포트이지 공식 API의 증거가 아니다. 이 잔여 공백은 실제 adapter 코드 GO 전에 닫아야 하며 기존 고정 원문이 현재 저장돼 있지 않으므로 재조회·설치로 임의 해결하지 않는다.

권장 순서는 사전 허가된 closed SDK launch template를 구성하고 hook은 **await 없는 최종 exact 검산·원 supplier 단발 소비만** 하게 하는 것이다. SDK 내부가 추가하는 flag/경로/환경의 정확 닫힌 값이 아직 확인되지 않아 현재 template 정상 원형을 확정할 수 없다. hook 안에서 임의 서버 허가를 기다리는 대안은 callback async 지원이 확인되기 전 제안 구현으로 채택하지 않는다. 최초 profile program/args만 맞으면 SDK 임의 args를 모두 통과시키는 우회0이다.

## 8. 도구 효과·취소·불명과 소유 정리

생성 허가는 임의 도구 효과의 blanket 허가가 아니다. 실제 tool name/input/request/session 식별을 원 START/E/선택 sourceScopes·정책·예산과 결박하는 별도 결정 producer가 필요하다. SDK 도구 결정 callback의 정확 객체/응답 포트가 현재 기록에 없으면 새 SDK 옵션을 추정하지 않는다. 파일 read/write, command/child, network/MCP 효과의 target 추출·Anvil operation·기존 일회 결정 receipt 소비를 원 요청에 exact 대응해야 한다. 모르는 효과는 허용0이며, tools=[] 또는 bypassPermissions로 이 기능을 구현했다고 하지 않는다. 필요한 도구가 미연결이면 실제 해당 역할 지원 미완료로 표시하고 실제 코딩 실행의 완료 조건을 낮추지 않는다.

공식 hook signal은 즉시 caller 취소와 동일하지 않으며 stdin EOF와 약2초 유예 뒤 전달된다는 기존 확인을 보존한다. Anvil 원 deadline을 늘리지 않고 caller abort/만료에 입력 차단·외부 Promise 불명 정착·원 SDK interrupt/close 요청·원 process 종료/자식 writer 관측을 분리한다. 즉시 강제취소/exit 성공을 주장하지 않는다.

| 상황 | 생성/반환·점유 |
|---|---|
| 실제 effect 전 profile/서명/current/기한 실패 | process0·첫 입력0, 원 근거와 고정 거절. 명확 사전실패와 UNKNOWN 구분 |
| journal append 정착 불명 | 생성0·원 기록 보존, 삭제/reset/새 attempt 자동 발급0 |
| create/hook 후 반환 HOLD·단절 | UNKNOWN·같은 attempt 보존·재create0. 늦은 원 child/Query만 소유 cleanup |
| init 선도착/입력 HOLD | 원 init/prefix 유지, 기한 내 원 yield면 같은 Query 인계; 미yield 만료 UNKNOWN |
| SDK result/close 정착 | 실제 process/자식·writer 회수와 별개, workAccepted false |
| cancel/close 중 underlying 미정착 | 새 입력/새 생성 차단·점유 유지. 늦은 원work 정착 뒤 자기 점유만 회수 |
| exe/root/profile·등록/H/E/정책 변경 | 새 효과 차단, 이전 current로 허가 연장0·늦은 success 재승격0 |

정상 cleanup은 원 handle/listener/pipe/secret loan·buffer 소유 참조를 원 수명 안에서 폐기한다. 이미 공급된 OS/SDK 문자열·파일/서비스 외부효과를 되돌렸다고 하지 않는다. 오류 로그에는 원 secret/전체 env/지시문을 담지 않고 고정 단계/attempt/ref/hash·안전 reason만 남긴다.

## 9. 실제 사용자 흐름·소스 검수와 최소 업무 순서

UI는 등록 연결·환경/profile·정확 준비/임무·원 START/첫 SEND·생성구성 관측·지원/미확인·예산/정책/수명·영향을 표시하고 명시 admission 요청→불변 receipt/보호조회까지 제공한다. 실행값/secret 원문·임의 env/argv 입력창·기본 자동 활성화0이다. source-only에서 ‘생성 승인 구성 검산’과 ‘실제 Agent 실행’ 버튼/지원등급을 혼동하지 않는다. 응답 유실은 원 command 보존, receipt 뒤 GET 거절은 본문 숨김과 동일 ref 재조회·추가 명령0을 유지한다.

실질 최소 업무는 ①현재 declaration/profile 선택→typed native 실행구성 관측·봉인 producer ②현재 실제 준비/임무/등록/E/fact·정책/예산과 원 START/첫 SEND의 실제 부모 생산·확정 ③그 부모를 보호 조회해 §4.1의 비순환 payload→자기 receipt 순서로 새 admission을 같은 Tx 저장/계상 ④닫힌 SDK launch template와 원 process supplier의 effect 전 exact 단발 소비→spawnClaudeCodeProcess/첫 yield/같은 owner·논리 binding 대 SDK SID mapping이다. 하나라도 없으면 완결 생성 기능이 아니다. ①만 검수 가능한 부분 소스로 구현할 수 있으나 실제 생성이나 FN10 현재 workflow 공급 완료로 세지 않는다. 기존 합성 경로를 실제 driver로 몰래 바꾸지 않는 목적 분리와 exact8 등의 기존 기본 계약 보존이 필요하다.

영향 후보는 contracts/runtime의 새 목적 원형·기존 fact/START의 목적 분리 parser, server executions의 actual admission/관측 검산·원 준비/등록/정책/예산/START 자료 연결, connector native 관측/생성 supplier, secondary 실제 driver 조립과 기존 factory/bootstrap/owner의 명시 인계 경계, 보호 조회/정책 UI·연결 화면과 forward pending SQL/시험이다. 새 일반 실행 API·새 표/키가 필수라고 단정하지 않는다. 실제 primitive·원문/authority 소비가 걸리는 기존 모듈을 먼저 대조해 정확 허용파일을 WI로 고정하며 내부 파일 수를 새 제품 결정으로 과장하지 않는다.

합성 정상은 성공 current 대역 없이 **실제 보호 정의/환경/준비·원 등록/E/fact producer→typed 관측 검산→실제 command/receipt/예산·단발 허가 저장→receiver의 두 그룹/원 SEND→closed plan 검산→메모리 OS supplier의 같은 handle/stdio→고정 SDK 포트 모형→실제 factory/owner/codec·원 장부**를 소비한다. 공식 SDK는 import/query하지 않고 확인된 hook 포트의 동작 모형만 사용했음을 표시한다. 현존하지 않는 actual fact/START/permit producer를 테스트 성공값으로 채우지 않고 같은 업무의 실제 구현으로 포함해야 한다. ‘관측만 추가→준비 permit을 생성 허가로 바꿈’은 정상 종단이 아니다.

필수 음성은 다른 host/등록키·목적/signature/domain·회수/nonce 재사용, H3/E1 정상과 외부 E3/예약없음/후행예약 거절, profile/definition/toolProduct/환경/root/mapping/current 변조, exe 해시/identity·cwd link/권한 변경, 미등록 env·slot/secret 원문 누출·임의 argv/SDK flag·default spawn 우회, 원 START/option/SEND/SID/attempt 교차, 원 첫입력 중복/직접 owner 점유·입력상한 effect 전 거절, current/clock/포트/getter·함수 identity 교체, 같은 Tx/ID/예약/proof·COMMIT 불명, HOLD/abort/late child·stderr 과다/EOF/exit 순서·소유 누락·UNKNOWN 재생성0이다. 소스 정상/메모리 syscall·동작 모형/실제 SDK·OS·키/권한/유료 호출은 각각 다른 증거다.

## 10. 채택 전에 남는 결정과 이후 완료 경계

1. 원 typed 관측과 실제 생성 admission의 새 서명 목적/기존 key 역할·호스트 보고 신뢰 한계 및 회수/current 의미.
2. program→검산 exe·root/cwd·SDK/profile argv 합성·변수별 env·secret slot 전달의 정확 허용 문법. 기존 profile 저장이 그 효과를 이미 허가했다고 보지 않음.
3. synthetic과 분리된 actual START/fact/E·자료/첫 SEND permit의 실제 producer와 원 지시·SID·SESSION claim 관계. 새 공개/저장/권한 의미는 정확히 채택하고 기존 false 의미는 보존.
4. spawnClaudeCodeProcess 이름은 이미 확인된 사실이며 새 사람 결정이 아니다. 미확인 전체 callback 서명/반환동기성·SDK argv/env·도구 결정 포트를 보완할 정확 근거 확보 방법만 별도 기술/조회 승인 경계다. 이번 문서는 새 공개조회나 실행을 요청/수행하지 않음.
5. 사용자 선택한 기존 계정/인증 경로의 공식 허용·비용 귀속. 구독 token 추출·신규 API 과금 전환·기존 로그인 자동 상속0.

내부 구현은 immutable snapshot·함수/prototype identity·같은 Tx private ID와 원 journal·유한 timer/cleanup·포트 배치·역완결/owner/ACL의 미적용 소스다. 위 중요 의미가 먼저 닫히면 Main이 routine 방법·정확 업무를 고정할 수 있다. 항상412/도구 빈목록/QA launcher만 통과시키는 방식으로 미정을 숨기지 않는다.

이 기능이 열 것은 원 선택 Agent의 생성 효과를 정확 허가·구성·시도/첫 입력·동일 세션 소유에 결박하는 첫 실제 producer 경로다. 아직 필수6능력의 실제 지시/SID, 상태/원문 수집, 파일/시험 증거, 도구 승인, 실제 중지/회수, 허가 경로/쓰기 통제와 계정교체는 각각 실측이 필요하다. FN12 완료/검수·원 stage/workflow/선행 평가대상 및 FN10 분기 소비·queue/dispatch는 별도 미완료다. 본 후보·코드 합성 PASS를 실제 Agent 지원이나 자동개발 전체 완료로 표시하지 않는다.
