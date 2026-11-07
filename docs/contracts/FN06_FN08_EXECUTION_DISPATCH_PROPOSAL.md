# FN06 FN08 서버 현재 허가와 내구 실행 연결 제안

상태: 제안, 2026-10-19, Project Main 어울. 대상은 승인 WORK_PLAN의 FN06·FN08과 FN09 책임 세션 연결이다. 기준 branch는 codex/av3-stage-b, 조사 commit은 0784dc611d06cf68c1bebb65013d6b4ac686ccb7이다.

Anvil이 임무·프로젝트 지식을 소유하고 기존 Agent를 교체 가능한 도구로 사용하려면, 외부 세션을 시작하기 전에 Anvil 서버가 현재 권한을 판단하고 명령·관측을 영속 기록해야 한다. 이 제안은 그 누락을 구현 가능한 단위로 좁힌다. 기존 비권위 수신함이나 codec을 실제 실행기로 승격하지 않는다.

## 1. 현재 구현과 실제 사용을 막는 지점

| 지점 | 현재 코드·계약 | 남은 연결 |
|---|---|---|
| FN09 내용 확정 | assignment_content_reviews·assignment_versions 및 ProjectAssignmentConfirmations | 내용 확정의 ready/executionAuthorized/dispatchPerformed는 false다. 책임 역할·외부 세션 binding은 없다 |
| FN05 맥락 준비 | context_bundles·context_items, 원문 선택/검색/재사용 UI | sourceAuthorizationVerified·budgetVerified·ready는 false다. 필수 자료의 현재 효력·실제 수신·이해 검토가 필요하다 |
| FN06 연결 신뢰 | connectors·connector_credentials와 등록 증명 | REGISTRATION_STATUS_ONLY/grants=[]다. 현재 등록 credential은 상태 조회 전용이다 |
| FN08 소스 관측 | SOURCE_OBSERVE_READ_ONLY 전용 permit/reports | 읽기 관측은 Agent 작업·쓰기 허가가 아니다 |
| FN08 명령 수신 | DispatchEnvelopeV1·receiveUnverifiedEnvelope | 구조·hash·시각·비권위 중복 기록만 검사한다. 서버 현재 허가·실제 전송·OS 소유 증거가 없다 |
| FN06 Agent 사건 | 고정 Codex 0.161.0 schema/codec | 메모리 사건 분류다. 실제 startSession/sendInstruction/observe transport 연결은 없다 |
| 개발 환경 | 00:25 KST 기존 PG 단독 1회 start·ready marker 관측 | DB 접속/현재 migration·API/Web/relay 복구는 미확인이다. 소진한 기동 창과 옛 PID를 재사용하지 않는다 |

현재 UI04의 newAssignmentDraft는 allowedScopes=[]로 시작하며 내용 확정은 SOURCE_SCOPE_MISSING을 거절한다. 사용자가 실제 소스 범위를 선택해 넣는 연결이 빠져 있다. 기존 source root/관측/기준선의 정확 참조를 입력할 기능과 정식 환경 선행이 필요하며, 빈 범위 허용·가짜 snapshot/baselineRef로 통과시키지 않는다.

저장소 SQL 목록에는 0012_assignment_drafts.sql, 0013_assignment_confirmation.sql, 0014_context_preparation.sql, 0015_project_baselines.sql이 있다. 파일 존재와 과거 격리 시험은 정식 개발 DB 적용 증거가 아니다. 정식 DB의 마지막 46개 기록은 과거 관측이며 현재 SQL 목록으로 단정하지 않는다. FN01 H4 재결박/실제 QA와 FN05 DD166F 원문 endpoint/UI는 기존 미승인 경계를 유지한다.

## 2. 이번 결정과 분리할 실행 승인

권장안 A는 아래 상세 계약·제품 코드·forward migration 파일·합성 검증을 구현하는 것이다. 새 HTTP/API·데이터·권한 계약이므로 이 안을 먼저 결정받는다. 실제 사용자 정책·credential 발급, 모든 actual DB QA(격리 PG 포함)·정식 DB 적용, 서비스 기동·전환, 실제 Agent 호출은 A에 포함하지 않는다. P1 검증은 순수 함수·fakeDB·가짜 transport만이다. 실제 격리 PG가 필요한 다음 검증도 exact 후보·대상/효과·현재 권한·자원/정리의 별도 실행결정을 받은 뒤 수행한다.

대안 B는 정식 DB/서비스/Agent 실행까지 한 번에 승인하는 방식이다. 현재 OS 소유·실제 능력·예산·환경 복구가 미확인이어서 권장하지 않는다. 대안 C는 계약 결정을 미루는 것이며 화면 보완은 가능하지만 핵심 Agent 실행 연결은 계속 미완료다.

| 결정 | 정확 범위 | 포함하지 않는 것 |
|---|---|---|
| P1 권장 | 이 제안의 명시 연산·별도 runtime credential 목적·저장/회수/최소 시험 계약, 코드와 신규 SQL 파일 작성·순수/fakeDB/가짜 transport 검수 | 격리/정식 실제 DB QA·정식 DB·실사용자 허가·키/credential 생성·서비스·유료/실제 Agent 호출 |
| P2 후속 별도 | 구현·합성 검수와 별도 승인 actual 격리 검수 후 exact SQL/hash·현재 정식 migration 차이·보존/rollback에 결박한 schema-only 적용 | 누락 SQL 일괄 적용, 정책/seed 자동 부여, Agent 실행 |
| P3 후속 별도 | 소유·회수/능력 실측과 현재 환경을 충족한 exact Agent·임무·파일·비용/시간/호출 한도의 1건 시험 | 무제한 자동화·다른 Agent/계정·운영/Oracle·안전심사 우회 |

실제 격리 PG QA의 승인도 P1에 포함하지 않는다. P1 후보는 코드/SQL 파일·합성 검수와 실제 DB/OS/served 미검증 기록까지로 제출할 수 있으며 실제 검증을 완료 조건으로 위장해 실행하지 않는다. P1 승인으로 P2/P3가 열린 것으로 해석하지 않는다. PMO에 필요한 결정은 P1이며, 이미 질문 중인 다른 거절/미승인 안을 다시 요청하는 것이 아니다.

## 3. 권위 입력과 내용 확정본 보존

실행 준비 입력 ExecutionIntentV1은 projectId, assignmentRef, roleBindingRef, contextBundleRef, connectionRef, environmentRef, capabilityRef, budgetPolicyRef, sourceScopes, mode, reason을 갖는다. ref는 기존 id/version/contentHash 형식이며 mode는 CONTEXT_REVIEW 또는 WORK다. CONTEXT_REVIEW도 실제 LLM 호출 권한은 별도다.

서버는 assignmentId 문자열만으로 버전을 선택하지 않는다. 정확 AssignmentVersion/계획 업무·설계·방법론 적용·헌법·최신 지시·환경·연결/정책 버전과 sourceScopes의 부분집합을 읽어 준비 snapshot을 만든다. 호출자의 true나 expectedSnapshot을 현재 사실로 받지 않는다.

기존 AssignmentVersion·ContextBundle의 false 값/불변 hash는 수정하지 않는다. 별도 ExecutionPreparation은 basisRefs, checkedAt, missingConditions, authorizationState:NOT_AUTHORIZED를 갖는다. 자료가 모두 존재해도 새로운 실행 허가를 발급하지 않으며 같은 임무의 최신 준비 조회와 과거 준비 이력을 구분한다.

## 4. 책임 세션과 이해 확인 순서

역할은 DATA_MODEL의 project_roles를 따른다. defineProjectRole은 {kind:COORDINATOR/STAGE_OWNER,stageRef,parentRoleRef,reason}를 현재 HUMAN 제어/명시 정책으로 저장한다. STAGE_OWNER는 현재 적용 방법론 단계와 정확 부모 COORDINATOR를 검사하고, 이번 단위에서 SUBTASK·자동 역할/계정 생성은 열지 않는다. 역할 ID는 서버가 발급하며 assignment.ownerRole 문자열을 역할 권한으로 사용하지 않는다.

bindResponsibleSession은 정확 assignmentRef/roleRef/connectionRef와 existingSessionBindingRef 또는 null을 받는다. 한 단계의 재작업은 기존 binding 유지가 기본이며, 다른 도구·외부 세션은 FN14 교체 절차 없이는 덮지 않는다. 외부 세션이 아직 없으면 RESERVED이며 존재하는 것처럼 표시하지 않는다.

CONTEXT_REVIEW는 맥락을 전달하고 6항목 이해 응답을 받기 위한 제한 실행이다. 필수 자료 수신과 의미 이해 검토는 다르므로 bootstrap 세션 생성 전에 아직 없는 Agent 이해 응답을 요구하지 않는다. 대신 유효한 서버 허가·예산·실제 무변경 도구 모드/소유·비밀 보호·필수 맥락이 선행하고, 도구/파일 변경 승인은 응답하지 않는다. 이를 보장할 능력이 미확인이면 bootstrap도 차단한다.

reviewUnderstanding은 {bundleRef,responseRef,subjectBindingRef,criteriaVersion:1,items,reason}를 기존 프로젝트 명령 경로로 받는다. 6개 code는 PURPOSE_REASON/BASELINE_AUTHORITY/DECISIONS_REASON/CURRENT_POSITION/ACTUAL_GAPS/NEXT_ACTION이며 각 항목에 sourceRefs,responsePartRefs,judgement:MATCH/MISMATCH/INSUFFICIENT,reason을 저장한다. 서버는 같은 실행/정확 bundle hash·외부 응답 source/관측 ref·현재 책임 세션과 필수 항목/부분 수신을 대조하고, 권한 있는 검토자의 별도 명시 판단을 understanding_reviews에 불변 저장한다. 첫 구현은 HUMAN이 사용자 또는 지정 총괄 역할로 확인하는 경로만 제공한다. Agent 총괄의 자동 검토 권한은 아직 연결하지 않으며 대상 세션/응답의 자기 합격은 거절한다. GET executions/:id/understanding-reviews는 허가된 HUMAN의 정확 기록 조회다. WORK는 최신 수용 검토 ref를 명시 검사하고 이후 MISMATCH/INSUFFICIENT·basis/session/bundle 변경 시 옛 수용을 재사용하지 않는다.

WORK는 같은 Anvil session binding·정확 맥락 수신과 이해 검토를 확인한 뒤 별도로 허가한다. 총괄 교체는 HUMAN, 단계책임자는 총괄 검토가 기본이며 자기 응답을 자기 합격시키지 않는다. 이해 검토·권한/기준 버전이 바뀌면 기존 WORK 허가를 다시 쓰지 않는다. 이 첫 단위에서 Agent 총괄 자동 승인·하위 임무 자동 실행은 구현하지 않는다.

## 5. 서버 허가와 실행 직전 재검사

authorizeExecution은 현재 HUMAN 세션·client·단독 제어 세대·프로젝트 소유/명시 정책·정확 임무/준비/역할 binding·현재 등록/credential 세대·기한·예산 예약을 같은 transaction에서 확인한다. DENY 우선, 미설정/만료는 거절이며 실제 사용자에게 정책을 자동 부여하지 않는다.

applyLimitPolicy는 INTERFACES §13.2의 {limits,scope,reason,policyBaseVersion}를 현재 HUMAN·제어·명시 정책으로 처리한다. scope는 정확 프로젝트/선택 실행이며 limit_policy_versions에 서버 발급 ID/단조 version·불변 본문/hash와 APPLIED/REVOKED 상태를 저장한다. 같은 scope의 project 행 잠금 아래 최신 version이 현재 head이고 policyBaseVersion 불일치는 409다. revokeLimitPolicy도 다음 REVOKED 버전을 추가하며 과거 본문은 바꾸지 않는다. GET projects/:projectId/limit-policies/:id/versions/:version으로 정확 원문을 조회한다. budgetPolicyRef는 이 표의 실제 APPLIED 최신 ref만 받으며 호출자 객체/기본 상수/과거 ref로 대체하지 않는다. 예약/소비 transaction은 동일 현재 head·기한·누적/예약을 잠가 다시 확인하고 정책 변경은 새 전달을 막되 이미 발생/불명 비용을 제거하지 않는다. limits의 시간·호출·동시 실행·spool/offline 값은 §8 상한 이내의 유한 정수이고, 실제 유료 호출에는 명시 유한 비용/통화와 별도 비용 승인이 필요하다. 기존 FN10 전체 scheduler를 새로 구현하는 범위는 아니다.

기존 materialRules는 limitPolicyRef:null의 문서 연산만 허용한다. 실행 연산을 문자열만 추가해 AUTO로 열지 않는다. defineProjectRole/bindResponsibleSession/prepareExecution/applyLimitPolicy/revokeLimitPolicy/reviewUnderstanding 같은 비실행 작성 연산은 명시 허가된 기존 HUMAN 정책 분기에서만 처리하고, 실제 실행/queue 연산만 유효한 runtime 한도 정책을 추가 요구한다. 따라서 최초 예산 정책 작성을 위해 아직 없는 예산 ref를 먼저 요구하지 않는다. runtime 정책 분기는 별도 명시 연산과 유효한 budgetPolicyRef·단일 실행/파일 범위·필요 승인 소비를 요구하고 기존 문서 연산의 null 제한은 유지한다. 모든 currentPolicy 소비자가 두 종류를 명확히 구분하도록 함께 수정한다.

ExecutionGrant는 정확 executionId/generation, project/user/client/controlGeneration, sessionId/credentialGeneration, role/assignment/context·현재 기준 refs, connectorId/registration generation/host public-key fingerprint, sourceScopes, budget reservation, allowedOperations, expiresAt, scopeDigest에 결박한다. 기한은 기존 세션·정책·등록·자동 범위 중 가장 짧은 값이며 최대 2시간을 넘지 않는다.

다음 검사는 준비 시와 queue/명령 수신/실제 wire 직전에 다시 수행한다.

- 현재 로그인/참여·단독 제어 세대와 명시 정책, 1회 승인 범위/소비.
- 정확 임무·맥락·기준/헌법·최신 지시·환경/연결 버전과 격리 상태.
- 실제 source root/파일 정체성·허가 부분집합, 기존 writer/소유 미확인 충돌.
- 필요한 실제 능력/도구 버전, OS 소유/회수 제공자, 남은 예산/유한 기한.
- 명령의 내구 기록/중복·결과 불확실성, 서버/로컬 저장소와 spool 여유.

OS 관측은 DB transaction으로 보장되지 않는다. 서버 허가는 필요조건이고, 실행기는 현재 허가와 실제 host/OS/경로를 대조한 별도 launch fence 없이 전송하지 않는다. 최종 fence와 실제 사용 사이를 통제할 OS 수단이 미지원/미확인이면 파일 변경 역할을 허용하지 않는다.

## 6. 별도 실행 credential과 API

실행 credential purpose는 EXECUTION_DISPATCH_ONLY, token prefix 제안은 av3ex1_이다. 기존 av3ct1_/av3sr1_은 그대로 거절한다. token은 새 runtime grant 전용이며 다른 project/execution·일반 문서 조회·정책 변경에 쓸 수 없다. HUMAN cookie와 Bearer를 함께 사용한 요청은 거절한다. 값은 보호 저장소에만 두고 서버에는 digest, Git/맥락/로그에는 비밀 없는 ref만 저장한다.

발급은 명시 HUMAN 허가 이후, 신뢰된 host의 기존 공개키로 별도 purpose EXECUTION_CREDENTIAL_EXCHANGE의 server nonce·client nonce·grantRef/scopeDigest·기한을 서명 검증한 1회 교환으로만 가능하다. 등록 당시 문자열 지문이나 등록용 proof 재생은 거절한다. nonce는 최대 2분, credential은 최대 15분 및 grant/현재 로그인 기한 이내이며 자동 연장하지 않는다. 소유키·보호 저장이 실제 준비되지 않았으면 발급하지 않는다.

현재 서버 검증에 실패하면 새 delivery/permit을 차단한다. credential만 취소했다고 OS 프로세스가 끝난 것으로 기록하지 않는다. 회수된 credential의 일반 자료 접근은 열지 않으며 미전송 관측 회수는 별도 정확 권한을 사용한다.

| 경로 | 입력·결과 |
|---|---|
| 기존 POST /api/v1/projects/:projectId/commands | defineProjectRole, bindResponsibleSession, prepareExecution, applyLimitPolicy, revokeLimitPolicy, reviewUnderstanding, authorizeExecution, queueExecutionCommand, revokeExecutionGrant, requestExecutionStop, authorizeExecutionRecovery를 명시 등록 |
| GET /api/v1/projects/:projectId/executions/:id | 허가된 HUMAN에게 준비/허가/세션/명령·관측/공백·실제 미확인 조회. 미가동과 업무 완료 구분 |
| POST /api/v1/connectors/:cid/executions/:eid/credential-exchange | 별도 host proof와 정확 grant로 제한 credential을 1회 발급. cookie·기존 Bearer fallback 없음 |
| GET 같은 prefix /commands?afterCursor&waitMs | 해당 실행의 저장된 outbox 명령만 반환. waitMs 0~10000, page 최대 50, cursor는 실행/세대/credential 범위에 서명 결박 |
| POST 같은 prefix /commands/:commandId/permit | envelopeHash·localAttemptRef·현재 host 소유/파일 관측 참조와 challenge 검증 후 1회 start permit 기록. TTL 최대 30초 및 grant/명령 기한 이내 |
| POST 같은 prefix /receipts | RECEIVED/PREPARED/START_ATTEMPTED/STARTED/REJECTED/UNKNOWN의 관측 주장·hash 저장. 공급자 주장만으로 실제 STARTED 확정 금지 |
| POST 같은 prefix /observations | 실행/세대별 sequence·비밀 제거 사건·batchHash를 내구 저장한 연속 ACK 반환 |
| POST 같은 prefix /heartbeat | 현재 실행 소유/마지막 ACK·공백을 보고하고 허가 회수 여부 조회. heartbeat 존재/부재를 OS 회수로 해석하지 않음 |

exchange/request challenge 발급은 POST 같은 prefix /challenges로 명시한다. 입력은 {requestId,purpose:CREDENTIAL_EXCHANGE/EXECUTION_REQUEST,grantRef,credentialGeneration,target:{method,path,queryHash,bodyHash},clientNonce,issuedAt,signature}다. 최초 교환만 Bearer가 없고 EXECUTION_REQUEST challenge는 해당 EXECUTION_DISPATCH_ONLY Bearer가 필요하다. cookie는 거절한다. 이 발급 요청 자체는 server nonce를 요구하지 않고, 등록 공개키로 purpose EXECUTION_CHALLENGE_REQUEST와 signature를 제외한 위 정확 입력의 canonical JSON 서명·서버시각 ±30초를 확인한다. 최초 교환의 credentialGeneration은 grant 생성 때 서버가 예약한 세대만 사용한다. grant의 현재 주체/제어/등록 세대와 host 키가 다르면 발급하지 않는다. grant를 찾기 전 응답은 동일 NOT_FOUND로 범위를 숨긴다.

execution_challenges는 project/grant/credentialGeneration/purpose/target hash·requestId/clientNonce·서명 입력 hash·서버 nonce digest·public_challenge_json·expiresAt/소비 request/결과 ref를 저장한다. public_challenge_json의 nonce는 비밀 token/키가 아닌 공개 challenge이며 원 응답 재확인에만 쓴다. 같은 requestId/같은 hash는 원 challenge/기한을 그대로 반환하고 다른 hash는 409, clientNonce 재사용도 거절한다. 교환 challenge는 2분·grant당 분당5개, 일반 request challenge는 30초·credential당 분당60개/살아있는 challenge 최대1개다. grant 수명 전체 발급 최대10000개이며 만료/재등록으로 그 grant 수량을 초기화하지 않는다. query는 명시된 key/형식만 받고 중복/미지원 key를 거절한 canonical JSON hash, bodyHash는 parseWireJson 뒤 canonical JSON hash로 결박한다. 이는 P1의 제안 프로토콜 상한이고 실제 Agent 50회 한도를 늘리지 않는다. 정확 challenge/요청 서명 검증·현재 grant 검사·nonce 소비·영수증 저장은 같은 transaction으로 처리한다. 응답 유실 뒤 같은 hash 재확인은 원 결과만 반환하고 새 permit/credential을 발급하지 않는다. credential 원문이 재전달 불가하면 기존 발급을 불확실로 보존하고 새 정확 허가 없이 재발급하지 않는다.

credential 교환 뒤의 각 요청도 현재 등록 공개키로 purpose EXECUTION_REQUEST_PROOF와 requestId/method/정확 경로/query/bodyHash/grantRef/credentialGeneration/짧은 서버 nonce를 서명 검증한다. nonce와 requestId는 내구 기록에 1회 결박하며 동일 요청 재확인은 같은 hash의 기존 결과만 반환한다. host 증명 없이 Bearer 소지만으로 permit을 발급하지 않는다. 이 구체 proof/API는 P1의 신규 보안 계약이다.

### 6.1 회수 전용 허가

authorizeExecutionRecovery는 현재 HUMAN·제어·회수용 명시 정책·최근 재인증과 정확 executionId/generation·lastServerAck·알려진 process identity/미확인·회수 목적/reason을 검사한다. execution_grants에 kind:RECOVERY, allowedOperations:SYNC_OBSERVATIONS/READ_STOP_INSTRUCTION/REPORT_STOP/HEARTBEAT, expiresAt 최대10분을 저장한다. 원 실행 허가가 회수됐어도 새 허가 자체의 주체/정책/기한이 현재여야 한다. 자동 발급/연장은 없다.

별도 host challenge/교환은 /recovery/challenges와 /recovery/credential-exchange, proof purpose EXECUTION_RECOVERY_*를 사용하고 prefix av3er1_/purpose EXECUTION_RECOVERY_ONLY를 발급한다. /recovery/observations·/recovery/stop-receipts·/recovery/heartbeat만 POST하고 /recovery/stop-instruction만 GET한다. 같은 host 증명·nonce/1회 소비·상한을 적용하되 execution credential과 경로/purpose를 교차 사용하지 않는다.

이 권한은 원 execution/generation의 이미 보존된 사건/공백·현재 종결 사실과 저장된 정확 graceful stop 지시만 회수한다. START_SESSION/SEND_INSTRUCTION/새 permit·일반 명령/맥락 원문/문서/소스 읽기·새 Agent 실행·강제 kill은 모두 거절한다. 서버에 오래된 관측을 저장하는 것은 과거 출처일 뿐 현재 writer나 회수 완료를 부활시키지 않는다. 등록 신뢰 자체가 회수된 host 키를 자동 재신뢰시키지 않으며, 현재 승인된 신뢰 host/정확 회수 경로가 없으면 새 회수 credential을 발급하지 않는다. 별도 host/자료 이동은 새 정확 결정 사항이다. 새 회수 권한을 발급할 수 없으면 spool을 보존하고 RECOVERY_AUTHORIZATION_REQUIRED로 남긴다.

### 6.2 명령에 결박한 자료 전달

GET 같은 execution prefix /commands/:commandId/materials/:materialId는 exact 현재 grant·command/envelopeHash·context/instruction/parts/options ref에 서버가 등록한 부분만 반환한다. 임의 문서 ID/전역 hash/파일 경로를 받지 않으며 일반 문서 조회 권한을 열지 않는다. WORK/CONTEXT_REVIEW와 recovery의 허용 source를 분리하고 recovery에는 이 경로를 열지 않는다.

서버는 부분을 읽을 때마다 현재 자료 접근/격리·정정/제외·헌법/관련 지시 basis와 실제 bytes/hash·원본/부분 범위를 다시 대조한다. 응답은 materialId/sourceRef/partIndex/partCount/contentHash/bytes와 최대2MiB 이하 단일 부분이며 no-store다. 큰 본문은 기존 deliveryPlan의 유한 maxPartBytes/maxParts로 나눠 필수 누락을 그대로 표시한다. 실행기는 hash/순서·수신 ref를 기록하며 전부 받기 전 WORK로 승격하지 않는다.

P1에서는 합성 material resolver/가짜 bytes만 사용하며 실제 보호 원문/계정/외부 전송을 읽지 않는다. P1의 테스트 transport는 in-process fake이며 실제 socket/listener·Windows 자식/OS helper·credential 보호 파일 생성도 0이다. 특히 FN05 DD166F의 거절된 대화 원문 endpoint/UI나 그 대체 provider를 구현/연결하지 않는다. USER_INSTRUCTION 실제 원문 제공이 그 별도 승인 경계에 걸리면 해당 source는 BLOCKED로 남기며 필수 맥락을 생략하거나 다른 경로로 우회하지 않는다.

## 7. 내구 명령과 불확실한 시작 처리

서버는 기존 commands/authorization_receipts/approval_consumptions/audit_events와 delivery_outbox를 사용하고, 실행 전용 command row/envelopeHash·grant·예산 예약을 같은 transaction에서 저장한다. commit 이전에는 외부 전달하지 않는다. 원 사용자 명령 APPLIED는 queue 저장 성공이지 Agent 실행 성공이 아니다.

기존 DispatchEnvelopeV1과 DispatchReceiptV1은 변경하지 않는다. envelope는 기존 세 operation/참조만 담고, 새 서버 execution command가 exact AssignmentVersion/ContextBundle/허가/세션 binding을 별도로 결박한다. 기존 receipt의 executionAuthorized/dispatchPerformed:false와 UNVERIFIED_INBOX_ONLY는 보존한다. 실제 상태는 새 ServerExecutionFactV1로 저장하고 비권위 receipt를 그 사실로 변환하지 않는다.

실행기는 같은 key/project/execution/generation/commandId와 envelopeHash를 로컬 내구 기록한다. permit 소비와 START_ATTEMPTED를 기록·sync한 뒤 단 1회 wire 전송한다. 전송 직전·직후 crash, 부분 write, 응답 유실은 UNKNOWN이며 새 turn/commandId로 자동 재실행하지 않는다. provider 핸들/서버·로컬 지점·실제 부작용 대조 또는 별도 재개 결정이 필요하다.

서버의 1회 permit 소비와 외부 프로세스 시작은 하나의 원자적 transaction이 아니다. 따라서 exactly-once 실행을 보장한다고 하지 않고, 중복 시작 거절과 불명 시작의 자동 재시도 금지를 증명한다. 재전달은 동일 key/hash/기존 receipt 조회에만 쓰며 예산을 새로 초기화하지 않는다.

## 8. 최소 저장 구조

DATA_MODEL §9/10의 논리 이름 project_roles·role_bindings·agent_sessions·executions·execution_receipts·execution_observations·execution_acknowledgements·writer_claims·limit_policy_versions·usage_reservations를 유지한다. 초안의 responsible_session_bindings/execution_runs/execution_budget_ledger는 별도 중복 테이블로 만들지 않는다.

파일 제안은 db/migrations/0016_execution_preparation.sql(C1), 0017_execution_authority.sql(C2), 0018_execution_observation.sql(C3)이다. 각 파일은 해당 후보의 합성 검수 뒤 고정하며 적용된 SQL은 수정하지 않는다. 이 번호는 파일 계획이고 정식 적용 승인이 아니다. 기존 0012~0015 등 실제 DB 선행은 별도 current diff/정확 승인으로 처리한다.

| 단위·새 테이블 | 필요한 불변/현재 정보 |
|---|---|
| C1 project_roles·role_bindings·agent_sessions | Anvil 역할/세션 ID·정확 assignment/connection·binding generation·보호 외부 handle ref와 RESERVED/ACTIVE/UNKNOWN/REVOKED 이력. 역할당 활성 binding1개 |
| C1 execution_preparations | exact 임무/맥락·basis refs/hash·현재 검사/누락·NOT_AUTHORIZED. 기존 불변 내용 확정본과 분리 |
| C2 limit_policy_versions·usage_reservations | 현재 적용/회수 버전·유한 한도/hash, 명령별 예약·소비/반환/미확인과 정확 단위/통화. 세션/재시작에 따른 누적 초기화0 |
| C2 executions·writer_claims | 실행/세대·정확 준비/session/connector/basis·소유/회수 상태와 source identity/범위 claim. DB 충돌 검사와 OS launch fence는 별도 |
| C2 execution_grants·execution_commands | EXECUTION/RECOVERY kind·현재 허가 scope/기한/회수, 정확 envelope/hash·서버 명령/outbox·예산 ref와 시작 불확실성 |
| C3 execution_credentials·execution_challenges | grant·host/등록/credential generation·purpose/token digest·기한/회수, challenge의 정확 대상/hash·request/client nonce/발급 한도·기한/1회 소비 |
| C3 execution_receipts·execution_observations·execution_acknowledgements | 요청 proof/permit·로컬 receipt/시작 관측의 출처/hash, execution/generation/sequence 유일 사건, 내구 연속 ACK·공백/충돌. 원행 덮기0 |
| C3 understanding_reviews | exact bundle/response/session·6항목/판정/검토 주체·기준 refs/hash와 불변 sequence. 최신 수용만 WORK가 소비 |

각 새 표는 project 복합 FK/명시 권한·현재 제어/허가 검사·불변 행 UPDATE/DELETE 거절을 갖는다. app 역할의 직접 삽입도 같은 무결성 guard를 통과해야 한다. 새표의 전체 권한 부여나 실사용자 정책 seed는 하지 않는다. UI 오류로 실패해도 기존 원문/임무·관측은 삭제하지 않는다.

writer claim은 같은 host의 실제 root/file identity를 비교해 프로젝트가 달라도 겹치면 거절한다. DB 문자 경로 UNIQUE나 같은 프로젝트 row lock만으로 실제 링크/범위 겹침을 해결했다고 하지 않는다. 실제 identity/OS 제공자가 없으면 claim은 UNVERIFIED이고 새 wire가 없다.

기본 상한은 writer1/외부 실행1, 자동 범위2시간·호출50회·동일 실패3회, 단절 중 이미 허가된 작업 최대5분, 이벤트64KiB/batch1MiB·spool1GiB를 넘지 않는다. 비용 미관측은 0이 아니며 유료 호출의 유한 비용/예산 근거가 없으면 실제 호출은 차단한다. 로컬 request/permit 추가 상한은 검증할 P1안이고 기존 정책 상한 완화가 아니다.

## 9. 구현 단위와 최소 검증

Main 단일 writer가 아래 순서로 수행하고 기존 담당 검토자가 후보별 한정 검수한다. 새 세션·branch·도구 설치를 만들지 않는다. 기존 시험을 삭제/완화하지 않고 각 단위의 변경·정상/중요 음성·직접 인접 검사만 실행한다.

### C1 책임 세션과 실행 준비의 실제 저장

- 새 계약 contracts/runtime/execution-intent-v1.ts, 새 assignments/responsible-sessions.ts, executions/preparation-input.ts·project-execution-preparations.ts, 0016_execution_preparation.sql 및 기존 apps/server/modules/projects/routes.ts·access/project-command.ts의 명시 command router를 연결한다. role/session/준비 저장과 현재 scope 입력 연결은 신규 apps/web/src/features/workspace/WorkspaceExecutionPreparation.tsx 및 기존 WorkspaceAssignments.tsx·assignment-api.ts의 소유 단위로 제한한다. scope 입력은 현재 반환된 정확 root/관측/기준 ref의 명시 선택만 허용하며 자료가 없으면 저장 초안은 가능해도 확정/실행은 막는다.
- defineProjectRole·bindResponsibleSession과 prepareExecution은 내용/참조·현재 제어/정책을 검사해 NOT_AUTHORIZED 저장/재조회를 제공한다. Agent/credential/permit/전송은 0이다.
- tests/unit/FN09/responsible-sessions.test.ts 및 tests/unit/FN08/execution-preparation.test.ts: exact refs, stale/control/교차 project, 기존 세션 재사용/무단 교체, 누락 필수 맥락·겉보기 true, 기존 불변 hash, 같은 명령/다른 hash 충돌 RED→GREEN.
- P1은 fakeDB transaction/read/rollback·명시 guard 호출과 UI04 준비 저장/조회 소비 후보까지 검수한다. 실제 SQL/commit/직접 app 권한 거절·실제 DB/served는 NOT_EXECUTED이며 별도 exact 실제 QA 결정 후 검증한다.

### C2 현재 실행 허가와 내구 queue

- executions/runtime-policy.ts·execution-grants.ts·execution-commands.ts·execution-budget.ts, contracts/runtime/server-execution-fact-v1.ts, 기존 access/project-command.ts·approval 소비·projects/routes.ts를 명시 확장한다. applyLimitPolicy/revokeLimitPolicy와 현재 exact 예산 resolver도 이 단위가 소유한다.
- grant/queue transaction·0017_execution_authority.sql 파일을 구현한다. 기존 문서 정책/receipt 의미·비권위 inbox는 보존하고 아직 실제 credential 발급/Agent transport를 연결하지 않는다.
- tests/unit/FN08/execution-authority.test.ts·execution-command-ledger.test.ts: 새 세대/로그아웃/회수/만료/기준 변경 차단, 이중 queue/동시 writer·예산 예약 경합, rollback시 outbox0, 응답 유실 재확인, 미확인 사용량을 0으로 만들지 않음 RED→GREEN.
- P1은 fakeDB의 현재 권한/순서·중복·실패 rollback 분기만 검수한다. 실제 PG의 동시성/atomicity·정식 사용자 정책은 NOT_EXECUTED다.

### C3 실행기 수신과 결과 연결

- 새 executions/execution-routes.ts·execution-proof.ts, connector runtime/execution-client.ts·execution-ledger.ts, primary/session-transport.ts를 구현한다. 기존 고정 schema/codec·source-scope/envelope·OS 소유 interface만 소비한다. 0018_execution_observation.sql과 reviewUnderstanding·회수 전용 API/credential 목적·부분 material resolver를 이 단위가 소유한다.
- 합성 transport에서 challenge 발급/nonce 원자 소비와 재확인·회수 credential의 dispatch/원문 거절·부분자료 격리/hash/범위/필수 누락·6항목 검토의 최신/자기합격 거절·proof/nonce 재생·다른 host/범위·permit 유실/만료·wire 전후 crash·부분 전송·ACK 공백/충돌·중지 요청과 실제 회수 미확인을 시험한다.
- tests/unit/FN08/execution-protocol.test.ts·execution-ledger.test.ts, tests/unit/FN06/session-transport.test.ts를 정상/음성 RED→GREEN으로 실행한다. 외부 핸들은 provider claim으로 출처를 보존한다.
- C3의 실행 제공자는 반드시 SYNTHETIC_ONLY로 고정한다. 서버/OS verifier나 source/material provider가 실제 준비되지 않은 상황에서 fake 성공을 주입해 실제 전송하는 mode/env fallback은 없다. 실제 transport를 켜는 것은 OS 제공자·현재 자원까지 결박한 P3다. native CS1504/PATH_GUARD 우회, 옛 harness/PID/소진창 재사용, provider 자체 승인 우회는 하지 않는다.

정확 검증 명령은 기존 고정 Node로 `--test <해당 단위의 위 test 파일>`, `node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`이다. Web 변경 단위만 기존 Vite build를 더한다. 격리 PG 실행 명령/자원은 P1 밖의 별도 정확 QA 결정, P3 실제 명령은 해당 후보가 만들어졌을 때 exact SHA/hash로 별도 결박한다. 아직 존재하지 않는 후보/실제 QA를 PASS로 기록하지 않는다.

## 10. 검수 집중 지점과 완료 기준

검수는 특히 다음을 확인한다.

1. 준비·내용 확정·credential/queue 성공을 실제 실행 성공으로 잘못 표시하지 않는가.
2. 현재 권한/세대/정책이 바뀌거나 host 관측이 불명인 순간에 새 wire를 막는가.
3. 전송 후 응답 유실을 새 turn으로 반복하지 않고 UNKNOWN/원자료를 보존하는가.
4. 이해 확인 bootstrap이 WORK 쓰기/도구 승인 권한을 우회하지 않는가.
5. 등록/소스 읽기 credential·기존 원문 읽기 경로로 실행 자료를 우회 전달하지 않는가.

C1~C3 코드/합성 검수는 FN06/08 완료가 아니다. 실제 완료 증거는 승인 P3 범위에서 같은 Anvil 임무/맥락·세션·현재 허가→실제 Agent 제한 작업→정확 변경/시험·결과·순번/ACK 회수→중지/회수와 화면 조회가 연결된 기록이다. 다른 Agent로 최소 손실 인계는 FN07/14/IX04의 별도 남은 업무다.

이번 계약 문서의 되돌리기는 해당 문서 commit의 일반 revert다. 향후 신규 schema는 자동 down/drop하지 않고 forward 보완하며, 실제 실행 회수는 정확 소유를 확인한 지원 중지/관측을 따른다. 문서 승인으로 데이터 복원·강제 종료가 허용되지 않는다.

## 11. 현재 기준 파일 지문

SHA256은 이번 읽기 기준이며 과거 승인으로 소급하지 않는다.

| 파일 | SHA256 |
|---|---|
| docs/contracts/INTERFACES.md | 8E6E55E04DE411AB58DB50FBE5D4F7F37C1E2D9154D27EEF23BB712629F905C0 |
| docs/contracts/TECH_DECISIONS.md | 2048226A20B4BB8922F53E2840367423B1C27158CB1BD1EDF16ECD167A4B0FE4 |
| apps/server/http/connector-auth.ts | D00149C4CA5A5256B8ED12CA01BBF310F3C31A2658D8ACCD4DABE467DF957EE9 |
| apps/server/modules/access/project-command.ts | 8B2D9014AD6D215B5C41224D2A3A2652B0BF3D39BB36E1AD771D9AC7E9D61CEB |
| contracts/runtime/dispatch-envelope-v1.ts | 7B1C0C71FFA1436D83BC269EEE93F7E50A44F7F81AC90FC24FB7A27EF991937A |
| contracts/runtime/dispatch-receipt-v1.ts | 4AB9D9C3AC1894154D34DB40AF32598AE61A7DA252A6AF7129591CCE1B815AB7 |
| db/migrations/0012_assignment_drafts.sql | 1120676CE1DF7A086D374ADB5C81356D7AB2C12EF6E07C8CE66C36B4C57A7133 |
| db/migrations/0013_assignment_confirmation.sql | FE064AF94B23185066047F8E202806CD4C3A7FE69AB7855BD2D2F6B961AE7CCA |
| db/migrations/0014_context_preparation.sql | BAC754D6DFBDF5FAF63024050C4474F0ADC42BC54F9E41AA399E3111E81CD0A3 |
| db/migrations/0015_project_baselines.sql | 3E5EEA0F94186F0CC28819D435E85C4FEC97569DDA3BEF7751AD420ED9D3B6EC |

## 12. 한정 검토와 Main 보정

원 초안 F2CA2A8F8E9367622161BAC914E1AC812E6B731ADF83C00E8F29C3502F6ACEF4의 독립 한정 문서 검토는 C0/I6/M0였다. I1 실제 격리 PG 혼입, I2 challenge 발급 부재, I3 회수 전용 권한 부재, I4 자료 전달 경로 부재, I5 이해 검토 연산/저장 누락, I6 예산 정책 권위 출처 누락을 Main이 이 개정에 보정했다. PMO의 P1 실제 DB 제외·OS 미확인 synthetic-only 요청도 반영했다. DATA_MODEL 논리 이름/현재 scope 입력 누락도 직접 대조했다. 같은 후보 독립 재검토는 하지 않았으며 Main의 문서 정합 대조를 독립 C0/I0 판정으로 표기하지 않는다.

P1 후보는 문서 정합 보정 상태다. 실제 SQL 문법/잠금·보호키·OS fence/회수·실제 Agent/비용·브라우저·사용자인수는 이 문서로 증명하지 않는다.
