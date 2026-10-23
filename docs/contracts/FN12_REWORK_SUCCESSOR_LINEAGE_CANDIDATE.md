# FN12 보완 원문·후속 임무·새 제출 불변 계보 계약 후보

- 상태: **DRAFT / NOT_ADOPTED / 문서만**. 2026-10-24, 담당 Main 어울.
- 작성 근거: PMO 위임 지시. 설계 r8 §7.3, WORK_PLAN의 FN12/UI05/UI08, FUNCTION_WORK FN12가 요구한 부족 조건 보완과 원결과 연결을 구체화한다.
- 실제 소스 기준: `614b2b43313dfc2d2345e5d87f8cd79469cbbbc3`. 이 문서의 타입·명령·표·조회명은 **제안**이며 현행 제공 기능이 아니다.
- 이번 허용: 이 후보·WORK_STATUS·WORK_PLAN의 문서 작성/검토/보존. 제품 코드·SQL 파일·DB·실제 정책·Agent/OS/키/비용·서비스 변경은 하지 않는다.
- 구현 지시는 별도 정확 채택 후에만 발행한다. 기존 CHILD_DRAFT_ONLY를 제거하거나 일반 복사·reason 문자열로 보완 계보를 흉내 내지 않는다.

## 1. 현재 사실과 해결할 공백

아래 표의 코드 경로는 저장소의 `apps/server/modules/` 기준이다. 기능/선행 기준은 `docs/work_packages/FUNCTION_WORK.md`의 FN12다.

| 실제 계약/소비 | 확인된 범위 | 이번 후보가 필요한 차이 |
| --- | --- | --- |
| `assignments/assignment-input.ts` | AssignmentDefinition에 parentAssignmentRef만 있고 원 rework/review/result 전용 fullref 없음. 부모가 있으면 확정 경계의 assertAssignmentRoot가 CHILD_DRAFT_ONLY로 거절 | 일반 하위 임무 권한을 열지 않고 보완의 원인과 후속 업무를 구조화해 연결 |
| `results/result-rework-input.ts` | prepareResultRework는 원결과/기준/검수/같은 단계 역할과 RESERVED 바인딩을 대조하되 REWORK_ASSIGNMENT_DRAFT·권위false | 이 준비/저장 결과를 후속 임무 확정·실행 허가로 승격하지 않는 별도 연결 |
| `results/project-result-reworks.ts` | requestRework는 RESULT_REWORK_DRAFT_STORED. 저장 당시 정책/현재 binding을 확인해도 반환의 currentBindingVerified/currentAuthorityVerified는 false | 보관 보완과 새 임무의 현재 조건 확인을 분리 |
| `assignments/responsible-sessions.ts` | 같은 역할의 정확 기존 bindingRef와 connectionRef를 제출하면 sessionRef를 유지하고 binding version/generation을 증가. RESERVED/CANDIDATE_ONLY·외부 handle null | 같은 Anvil 단계 세션의 재예약 재사용. 실제 외부 Agent 세션 유지/실행 보장은 아님 |
| `results/project-result-submissions.ts` | submitResult payload는 scope/submissionId/manifest만 허용. 실행/임무 ref를 확인하되 어느 보완에서 온 새 결과인지 별도 계보 없음 | 원보완·후속 확정 임무/예약·새 실행·새 제출을 서버에서 대조/보관 |
| UI05/UI08 | 원제출/검수·보완 이력, 조건별 보고 부족, 등록 증거 bytes 대조 연결됨 | 실제 후속 임무 작성·확정/예약과 그 후속 제출 연결은 아직 없음 |

소스 지문(SHA256, raw): assignment-input `40093629F092FEB4BB8D661420B3985E8A9D93B72F37B6D290DF3995663D9ECF`; responsible-sessions `26A824D114DC52ECC03BEA4ABD80CC220DEC66963645E40CA43EAEF2C9C0816E`; result-rework-input `21FED28C6CEE478DEBE91A6E953165279CB111A145A60840A995C33C11A92375`; project-result-submissions `1DBF1B1F1A064D02841444A423345A46C76C54552BE4BA2C53C111B317DB7048`.

## 2. 대안과 권장안

1. **A — 기존 계약만 재사용:** 사용자가 기존 prepareAssignment로 새 root 초안을 만들고 reason/inputs에 보완 ID를 적는다. API/DB 추가가 없지만 문자열만으로 원검수·조건·범위·후속결과의 귀속을 강제할 수 없다. 일반 업무 작성으로는 유효하나 FN12 보완 연결 완료로 인정할 수 없다.
2. **B — 별도 불변 계보 + 기존 임무/예약 재사용(권장):** 일반 child를 열지 않는다. 새 후속 root 임무를 원보완의 제한된 목적에 연결하는 불변 기록을 원자 저장하고, 기존 내용 검토·확정/같은 Anvil 단계 세션 재예약을 별도 수행한다. 새 제출도 해당 계보로만 귀속한다. 공개 명령·허가 목적/저장/reader의 명시 변경이 필요하므로 현재 미채택이다.
3. **C — 일반 child 확정/예약/실행까지 확대:** FN09 일반 위임과 실행/복구 전체 계약이 연동돼 변경 범위가 크다. 이번 최소 보완 후보에서 제외한다.

B에서 새 root는 현재 child 제한을 우회하는 복사가 아니다. 원보완에서 발급되는 정확 목적·범위/조건·불변 연결과 별도 허가가 없으면 **보완 후속 임무로 생성/확정/예약/제출할 수 없다**. 일반 root를 만든 사실만으로 과거 보완을 해소하지 않는다.

## 3. 불변 원문과 후보 타입

모든 Ref는 `{id,version,contentHash}` 전체, projectId는 모든 읽기/명령/정책/감사의 같은 프로젝트다. ID만 비교하거나 최신 버전으로 치환하지 않는다. 아래는 저장 후보의 개념 필드이며 TS/SQL을 구현한 것이 아니다.

### 3.1 ReworkAssignmentOriginV1

- kind=`REWORK_ASSIGNMENT_ORIGIN_V1`, 고유 ref와 projectId.
- sourceReworkRef, sourceResultRef, sourceReviewRef, sourceCriteriaRef, sourceAssignmentRef, sourceExecutionRef.
- sourceRoleRef, sourceBindingRef, stageSessionRef, connectionRef.
- stageRef={applicationRef,nodeId}, sourceTaskRef={planRef,taskCode,applicationRef,nodeId}.
- selectedCriteriaIds, remainingCriteriaIds, preservedCriteriaIds, sourceScopes.
- successorDraftRef, definitionHash, requestedBy={userId,clientId}, requestedAt. 이번 생성 명령/정책·허가영수증/감사 결박은 아래 §3.3의 관계 metadata이며 snapshot 해시 대상이 아니다.
- 고정값: linkageStored=true는 계보 저장만 뜻한다. contentConfirmed=false, currentReservationVerified=false, executionAuthorized=false, dispatchPerformed=false, completionAccepted=false, formalFailureCounted=false.
- successorDraftRef는 확정 임무 ref와 다르다. 같은 ID/version이어도 contentHash가 다르므로 섞지 않는다.

origin은 고정된 새 draftRef를 참조하고 draft의 기존 snapshot/hash에는 originRef를 역삽입하지 않는다. 양방향 연결은 서버 원장의 정확 draftRef 조회로 대조해 해시 순환을 피한다. 별도 확정본은 snapshot.draftRef가 origin.successorDraftRef와 전체 일치해야 하며 ID/version 일치만으로 대체하지 않는다.

원보완의 selectedCriteriaIds는 저장된 missingItems와 정확히 일치한다. remainingCriteriaIds는 원검수의 보완/차단 조건 집합에서 선택을 뺀 값이며 순서/중복 정책도 원보완과 같아야 한다. 현행 보관 보완의 preservedItems=[]는 **기존 조건 합격**을 뜻하지 않는다. 확인되지 않은 충족 항목을 추론해 넣지 않는다. 같은 보완을 나눠 처리하려면 별도 원보완 저장본을 사용하며 이 후보에서 한 보완을 임의 재분할하지 않는다.

새 임무의 조건/검증 요구는 선택한 기준 항목의 고정 sources가 가리키는 원조건에서 도출한다. 이를 reason 문구로만 만들지 않는다. 파일 범위는 저장 보완 sourceScopes의 부분집합, 기준선·환경·예산·필요 능력·기록 정책은 원임무 밖으로 넓히지 않는다. 기준/환경 변경이 필요하면 별도 변경 영향 절차로 보낸다.

### 3.2 ReworkResultLinkV1

- kind=`REWORK_RESULT_LINK_V1`, 고유 ref/projectId, originRef.
- successorConfirmedAssignmentRef, successorBindingRef, bindingGeneration, stageSessionRef, successorExecutionRef, followupResultRef.
- selectedCriteriaIds/remainingCriteriaIds는 origin의 고정값 참조이며 새 결과가 선택 범위를 충족했다는 판정이 아니다.
- recordedBy/recordedAt. 이번 제출 명령/정책·허가영수증/감사 결박은 아래 §3.3의 관계 metadata이며 link snapshot 해시 대상이 아니다.
- sourceKind=WORKER_CLAIM, transport=SYNTHETIC_ONLY. evidenceProvenanceVerified/actualTestExecutionVerified/completionAccepted/formalFailureCounted/executionAuthorized/dispatchPerformed=false.
- 새 제출 상태가 COMPLETED여도 원보완/남은 조건을 자동 완료시키지 않는다. 새 기준 등록·별도 검수의 근거는 이 계보로 추적하며 실제 수행 출처는 별도 확인한다.

### 3.3 해시·영수증·감사 방향 — 순환 금지

위 두 타입의 ref는 각각 snapshot의 canonical hash다. sourceReworkRef 등은 **이미 존재하는 이전 불변 자료**를 참조한다. 이번 명령의 command row ID/operationId/authorizationReceiptRef/policyRef·audit 식별은 같은 transaction의 관계 metadata로 보관하고 이번 origin/link snapshot에 역삽입하지 않는다. 관계 metadata도 인증된 reader가 별도로 검증하며 단순히 해시에서 제외했다고 신뢰하지 않는다.

| 새 후보 명령 | 계산/저장 순서 | 영수증·감사 target 및 응답 |
| --- | --- | --- |
| prepareReworkAssignment | 기존 형식의 draft snapshot/ref 확정 → 그 draftRef와 과거 원문으로 origin snapshot/ref 계산 → 영수증 → draft/origin 및 관계 metadata 저장 | target=draftRef. 응답 data에 같은 draft snapshot/ref와 originRef를 포함. 원장 reader는 새 operation/정확 응답 variant를 구별하고 origin의 successorDraftRef 일치까지 대조 |
| submitReworkResult | manifest/ref 확정 → 영수증 → 기존 결과 snapshot에 그 authorizationReceiptRef를 넣어 새 resultRef 계산 → originRef/resultRef/후속 임무·예약으로 link snapshot/ref 계산 → 결과/link 및 관계 metadata 저장 | target=manifestRef. 응답에는 manifest/ref와 originRef만 선확정해 포함; resultRef/linkRef를 영수증에 역삽입하지 않음. 후속 exact 결과/계보 GET에서 두 fullref를 별도 대조 |

origin 요청 시각과 link 기록 시각은 서버 transaction_timestamp를 사용해 이번 영수증의 serverReceivedAt과 결박한다. caller 시각/임의 영수증은 받지 않는다. reader는 command의 actor/client/operation/request hash·정확 정책·허가 subject/scopeDigest/target과 APPLIED 감사 1건을 검증한다. 초안/결과와 origin/link가 모두 같은 command에 속하고 receipt.data 및 각 snapshot/ref와 일치해야 한다. target을 자신의 새 link/origin으로 바꾼 뒤 그 영수증 fullref를 snapshot에 넣는 순서는 금지한다. 부분 저장은 전체 rollback이며 원자성만으로 해시 순환을 해결했다고 주장하지 않는다.

## 4. 명시 흐름·현재성·동시성

1. 사용자가 저장된 원보완 fullref를 선택한다. 준비 GET/순수 검사는 새 임무·예약·writer를 만들지 않는다.
2. 후보 명령 `prepareReworkAssignment`로 원자적으로 **새 후속 초안 + origin**을 보관한다. 원보완/결과/검수/기준/역할/예약 원문을 서버 reader로 다시 읽고 위 관계·조건·범위를 대조한다. 실패하면 둘 다 저장하지 않는다.
3. 기존 내용 검토·별도 확정을 재사용한다. 기존 command/reader가 새 연결 임무를 인식하고 origin을 검증하도록 **채택 후 보완**해야 한다. 현행 reader가 이미 지원한다고 주장하지 않는다.
4. 기존 bindResponsibleSession을 재사용하되 새 확정 임무→origin→같은 stageRole/connection/Anvil session을 검사한다. 입력 existingSessionBindingRef는 그 순간의 최신 원 binding fullref여야 하며 새 binding version/generation을 저장한다. 과거 sourceBindingRef가 아직 최신이라고 가정하지 않는다.
5. 후보 명령 `submitReworkResult`로 현재 후속 확정 임무/예약·실행 ref와 origin을 대조해 새 결과 + result link를 원자 저장한다. 현재 submitResult로 연결 임무의 결과를 내서 계보 검사를 우회하면 거절한다.
6. UI05/UI08에서 원결과→보완→후속 초안/확정·예약→후속 결과를 별도 상태로 조회한다. 자동 생성/확정/예약/지시·실행/검수/완료 전이 없음.

변경 명령은 현재 인증 세션·멤버·client/단독 제어 세대·정확 정책/기한·권한을 기존 프로젝트 명령 경계로 확인한다. 초안 생성 허가를 예약·제출 허가로 재사용하지 않는다. 새 두 명령의 enum/허가 목적·scope digest와 자료별 selector가 추가돼야 하며 기존 policy를 자동 확장/부여하지 않는다.

원보완/원임무 head·현재 방법론 적용·역할의 최신 binding을 트랜잭션 시작과 저장 전 다시 확인한다. 이전 Agent/OS writer 종료가 미확인, 같은 단계 실행이 진행 중/UNKNOWN, 또는 안전 회수 근거가 없으면 초안 읽기/보관과 **예약/새 실행 가능 여부를 분리**하고 새 예약/실행을 열지 않는다. 타임아웃은 종료/회수 증명이 아니다. 실제 회수/실행 권위는 FN08/FN13 및 기존 Bv3 미결과 별도다.

한 원보완 fullref에는 최초 후속 초안 한 개만 연결한다. 같은 commandId+정확 body의 재확인은 §4.1의 현재 인증/허가 선검사 뒤 원영수증만 반환하고 body 변경/다른 ID의 중복 생성을 거절한다. revision/후속 시도는 원연결을 덮지 않으며 §4.2대로 연결 초안 개정은 미지원이다. 후속 결과마다 고유 결과/명령을 사용하고 같은 결과 fullref는 한 origin에만 연결한다. command receipt·정책·감사와 연결 원장을 같은 트랜잭션에서 보관하고, 참조/현재성 변경·감사 실패면 전체 rollback한다.

### 4.1 공유 잠금·경쟁 변경·replay의 후보 순서

시작/저장 전 두 번 읽기만 해서는 경쟁을 막지 못한다. 채택 시 같은 DB transaction/connection에서 다음 순서를 따르고 COMMIT/ROLLBACK까지 잠금을 유지해야 한다. 한 프로젝트만 처리하며 여러 기존 임무 ID를 잠글 때는 UUID 오름차순이다.

1. 기존 AccessRepository의 현재 인증 u/s/c 잠금을 재사용해 사용자·auth_sessions·client의 활성/credential 세대/만료를 확인한다. 인증을 거치지 않는 store 직접 호출로 우회하지 않는다.
2. `anvil.projects`의 해당 project row FOR UPDATE → 현재 `project_members` row FOR UPDATE → `project_control` row FOR UPDATE → `permission_policies` head FOR SHARE 순서로 획득한다. 현 projectMember(lock=true)/currentProjectController/currentPolicy의 구조를 재사용하되 **모든 참여 경로가 project 먼저**임을 확인해야 한다.
3. 원임무/후속 임무의 `assignment_drafts` head를 ID순 FOR UPDATE하고, connection_candidates의 해당 head를 FOR SHARE한다. 새 임무 head가 아직 없을 때는 먼저 잡은 project row가 동일 프로젝트의 삽입/중복 연결을 직렬화한다. current methodology 적용/role binding의 append 및 새 origin/link 중복도 같은 project 잠금에 참여해야 한다.
4. 현재 actor/client·제어세대·해당 operation의 정책/유효기한을 확인한 **뒤** command replay를 확인한다. 같은 주체·project·commandId/requestHash와 원영수증/원장 정합이 맞으면 원 APPLIED 응답만 반환하고 새 INSERT·예약·실행은 하지 않는다. 이미 저장한 응답을 재확인할 때 과거 원문을 최신 head로 치환하거나 새 현재성/허가 인증을 덧붙이지 않는다. body 다름은 409, 현재 인증/멤버/정책 만료·회수는 원 성공을 반환하지 않고 현재 401/403/412로 거절한다.
5. 새 명령이면 잠금 안에서 원보완/원임무 head·확정/기준·현재 방법론·역할/최신 binding 및 scope를 읽는다. 저장 직전 같은 잠금 아래 값과 DB clock 기준 인증/정책 기한을 다시 검사하고 정확 삽입·허가영수증·감사 검증을 완료한다. 바뀌거나 읽지 못하면 전체 rollback한다.

참여해야 할 관련 mutation은 프로젝트 보관/멤버·제어권 변경, 정책 개정/회수, 방법론 적용 전환, 원/후속 임무 초안 개정·내용검토/확정, 책임 역할/예약 변경, execution/queue/grant·stop/recovery의 상태 변경, 결과/검수/보완/새 계보 쓰기다. 인증 회수는 기존 u/s/c 잠금을 존중해야 한다. 직접 DML·구버전 서버·관리 script가 이 프로토콜을 우회할 수 있다면 선검사/후검사만으로 안전하다고 하지 않는다.

현재 전체 참여/실제 경쟁은 **미검증**이다. 채택 후 source 경로 목록과 lock 획득 순서·동일 tx 여부를 대조하고 경쟁 반례로 확인하기 전 새 계보 변경 기능은 `REWORK_COORDINATION_UNAVAILABLE`(503/default deny)로 유지한다. 인접 mutation의 참여를 보장하지 못하면 새 계보 생성·확정/예약·제출만 차단하며 일반 개발 전체를 동결하지 않는다. 잠금은 실제 OS writer 종료나 외부 Agent 단절의 증거가 아니다.

### 4.2 고정 초안 개정·검토·확정의 후보 제한

최소 B안에서 origin.successorDraftRef는 새 root 초안 v1에 고정된다. 그 ID로 기존 prepareAssignment를 재호출해 정의·이유·버전 중 하나라도 바꾸는 **모든 개정은** origin 대조 성공 여부와 무관하게 `REWORK_LINEAGE_REVISION_UNSUPPORTED`(412)로 거절한다. origin만 옛 버전에 남긴 채 새 head를 정상 후속으로 소비할 수 없다.

같은 고정 v1의 내용 검토 기록·별도 확정은 허용 후보다. reader/확정 경계는 정확 origin·고정 draftRef/definitionHash·원자료 관계와 현재 정책/방법론을 대조하고, 동일 고정 ref에 대한 **최신 적합 검토가 ACCEPTED일 때만** 별도 확정한다. REWORK/BLOCKED/원자료 변경·접근불가는 확정 거절이며 자동 수정·승인하지 않는다. 확정 snapshot.draftRef는 고정 draftRef와 전체 일치해야 한다. 역할 재예약은 이 확정본에만 별도 명령으로 한다.

수정이 필요한 경우 기존 계보/초안을 보존하고 새로운 원보완 저장본(fullref)에서 별도 후속을 작성한다. 이 최소 후보에는 원보완을 같은 채로 교체·취소/해제·자동 재연결하거나 초안 v2로 승격하는 기능이 없다. UI에는 '이 계보의 후속 초안 수정 미지원 · 기존 기록 보존, 새 보완 요청 필요'를 표시한다. 이는 불편을 숨긴 정상 완료가 아니라 선택 가능한 최소 범위의 명시적 제한이다. 일반 임무의 기존 개정 동작은 유지한다.

## 5. 현행 소비 delta — 채택 시 필요한 변경점

| 영역 | 유지 | 후보 채택 후의 정확 차이 |
| --- | --- | --- |
| requestRework/기존 목록·원문 | RESULT_REWORK_DRAFT_STORED·권위false·현재 GET와 기존 hash 불변 | 선택 원보완에서 후속 계보를 **별도** 조회. 초안 저장 영수증은 배정/실행으로 승격 금지 |
| AssignmentDefinition/child | 현행 정의 hash·parentAssignmentRef·CHILD_DRAFT_ONLY 유지 | 별도 후속 root와 origin 관계를 명시. 일반 child 허용으로 변경하지 않음 |
| prepareAssignment/확정 reader | 일반 임무의 payload/원문·기존 정상 흐름 유지 | 연결 임무는 생성 명령/영수증과 origin의 정확 draftRef/definitionHash를 함께 읽도록 strict reader 보완. 새 명령을 기존 prepareAssignment로 가장해 기록하지 않음 |
| 내용 검토·확정 | 일반 임무의 개정/검토/별도 확정·정확 버전·최신 적합 검토 유지 | 연결 임무 개정은 항상 미지원/거절, 고정 v1의 검토·별도 확정만 §4.2대로 허용 후보. 기존 명령 경로 모두에서 검사 |
| bindResponsibleSession | 현재 HUMAN 명령, 같은 Anvil 세션 참조/새 세대, RESERVED/CANDIDATE_ONLY 유지 | 연결 임무면 origin·같은 단계/connection/session·현재 세대·안전 조건 재대조. 외부 handle/실 Agent 세션은 여전히 미확인 |
| submitResult/새 submitReworkResult | 일반 제출의 v1 scope/manifest·원문/기존 조회·출처false 유지 | 연결 임무의 일반 submitResult는 명시 거절. 새 명령에서 origin과 새 결과/link를 원자 저장; reader는 새 명령 영수증도 정확 검증 |
| UI05/UI08 | 기존 검수/보완·조건 부족·bytes 조회 불변 | 명시 선택·현재성 미확인·계보만 저장/내용확정/예약/제출·검수 상태 분리. 준비/저장/거절/동일명령 재확인 및 이전 기록 보존 |
| API/허가·감사 | 기존 operation/GET·정책 자료·감사 이력 불변 | 새 두 operation과 별도 계보 조회 제안. 명령의 정책 목적·target/fullref/세대/기한·감사 계약을 채택하고서만 구현 |

후속 초안에 origin을 숨긴 채 일반 root로 반환하거나, reader가 새 command operation을 무시하고 기존 APPLIED로 받아들이는 구현은 금지한다. 조회는 현재 멤버/프로젝트 격리를 재검사하며, 과거 계보의 보존과 **현재 실행 가능** 판정을 분리한다. 원문 불일치/누락은 빈 계보/정상으로 바꾸지 않는다.

### 5.1 후보 API exact 계약 — 현행 API로 제공되지 않음

공통 Ref는 exact `{id,version,contentHash}`(UUID, 양의 safe integer, 소문자 SHA256 64자리)다. origin/link 자체 version과 이 후보의 protocol/schemaVersion은 1이다. 알 수 없는 필드·중복 JSON key·다른 버전은 거절한다. UTF-8 전체 요청/응답은 각각 2MiB 이내, reason은 기존 안전문자 검사/공백제외 1~20000자, 선택/잔여 조건은 각각 최대100개·중복0, definition은 기존 AssignmentDefinition 전체 exact 형식/배열 제한을 그대로 적용한다.

**두 변경 명령:** 기존 same-origin `POST /api/v1/projects/:projectId/commands`의 새 operation 변형이다. 최상위 exact keys는 `schemaVersion,projectId,commandId,clientId,controlGeneration,operation,targetId,expectedVersion,baselineRefs,approvalRef,payload`. schemaVersion=1, expectedVersion=0, baselineRefs=[], approvalRef=null, 현재 clientId/제어세대이며 자동 승인 소비는 없다. policy가 REQUIRE_APPROVAL이면 `REWORK_APPROVAL_NOT_CONNECTED`(412)로 거절한다. 새 operation의 명시 정책이 없으면 default deny다.

| operation | targetId / payload exact keys | 새 변형 data exact keys·고정 상태 |
| --- | --- | --- |
| prepareReworkAssignment | targetId=새 draft UUID. payload=`{sourceReworkRef,definition,reason}`. parentAssignmentRef=null/baseRef 입력 없음·v1 신규만. 기존 저장 보완에서 도출한 조건·범위/같은 stage 관계와 definition을 서버가 대조 | `{ref,status,snapshot,originRef}`. ref=새 draftRef, status=REWORK_ASSIGNMENT_DRAFT_STORED, snapshot=기존 exact draft snapshot(ready/executionAuthorized/dispatchPerformed=false), originRef=새 origin fullref |
| submitReworkResult | targetId=submissionId. payload=`{originRef,successorBindingRef,scope,submissionId,manifest}`. scope exact=`{projectId,assignmentRef,executionRef}`; 새 확정 임무/예약 전체 ref와 현재 세대를 대조. manifest는 기존 결과 제출 exact 형식 | `{ref,status,manifest,originRef,sourceKind,completionAccepted,executionAuthorized,dispatchPerformed}`. ref=manifestRef, status=REWORK_RESULT_SUBMITTED, sourceKind=WORKER_CLAIM, 세 flag=false. 결과/link fullref는 후속 GET에서 검증 |

두 영수증 최상위 exact keys는 기존 persistProjectReceipt의 `operationId,commandId,projectId,status,targetId,version,data,evidenceRefs,warnings,serverReceivedAt`, status=APPLIED/version=1/evidenceRefs=[]/warnings=[]다. targetId/version/data.ref는 §3.3의 draftRef 또는 manifestRef와 일치한다. 새 resultRef/linkRef를 응답 data에 소급 추가하지 않는다. 이번 origin/link를 기록한 command row·authorizationReceiptRef·policyRef·감사는 비노출 관계 metadata로 검증한다. 생성 허가는 현재 actor/client+project+`prepareReworkAssignment`+sourceReworkRef/후속 definition digest, 제출 허가는 별도 `submitReworkResult`+originRef/successorBindingRef/scope 전체를 selector로 대조한다. 현 MaterialRule의 project scope만으로 이 추가 resource 결박이 이미 구현됐다고 하지 않는다.

**두 읽기 경로:** 원문 본문/파일을 새로 수집하지 않는 계보 metadata 조회만 제안한다. 새 command 또는 영수증을 만들지 않는다.

| route | exact 입력 | exact 응답 |
| --- | --- | --- |
| `GET /api/v1/projects/:projectId/result-reworks/:reworkId/successor-lineage` | path UUID 두 개, query exact=`{version,contentHash}`; version 문자열 '1', contentHash=선택 원보완의 소문자 hash. 그 외 query/cursor 금지 | `{schemaVersion,projectId,sourceReworkRef,state,origin,observedAt,sourceAssurance,currentExecutionAuthorizationVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed}` |
| `GET /api/v1/projects/:projectId/results/:resultId/rework-lineage` | 같은 query로 선택한 새 result fullref. 최신/다른 결과로 치환하지 않음 | `{schemaVersion,projectId,followupResultRef,state,link,observedAt,sourceAssurance,currentExecutionAuthorizationVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed}` |

읽기 응답 schemaVersion=1, state=FOUND 또는 NOT_LINKED, sourceAssurance=SERVER_STORED_LINEAGE_ONLY, 마지막 다섯 검증/권위 flag=false, observedAt=서버 UTC ISO 시각이다. FOUND일 때 origin/link는 exact `{ref,snapshot}`이며 snapshot의 exact fields는 §3.1/§3.2의 **ref를 제외한 모든 명시 필드**다. projectId/kind도 snapshot에 들어가고 이번 명령/정책/영수증/감사 metadata는 들어가지 않는다. NOT_LINKED일 때 해당 값은 null이며, 먼저 같은 project·선택 fullref의 원보완/결과가 정상 원문으로 읽혔고 실제 연결이 없을 때만 반환한다. 불완전/변조 원장을 NOT_LINKED로 숨기지 않는다.

- OriginSnapshot의 exact keys는 `kind,projectId,sourceReworkRef,sourceResultRef,sourceReviewRef,sourceCriteriaRef,sourceAssignmentRef,sourceExecutionRef,sourceRoleRef,sourceBindingRef,stageSessionRef,connectionRef,stageRef,sourceTaskRef,selectedCriteriaIds,remainingCriteriaIds,preservedCriteriaIds,sourceScopes,successorDraftRef,definitionHash,requestedBy,requestedAt,linkageStored,contentConfirmed,currentReservationVerified,executionAuthorized,dispatchPerformed,completionAccepted,formalFailureCounted`다. 요청 주체는 exact `{userId,clientId}`이며 kind/flag는 §3.1 고정값이다.
- LinkSnapshot의 exact keys는 `kind,projectId,originRef,successorConfirmedAssignmentRef,successorBindingRef,bindingGeneration,stageSessionRef,successorExecutionRef,followupResultRef,selectedCriteriaIds,remainingCriteriaIds,recordedBy,recordedAt,sourceKind,transport,evidenceProvenanceVerified,actualTestExecutionVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed`다. 기록 주체는 exact `{userId,clientId}`, sourceKind/transport/flag는 §3.2 고정값이다.

GET의 허가 selector는 현재 인증 actor/client와 해당 project, 첫 경로의 sourceReworkRef 또는 두 번째 경로의 followupResultRef다. 기존 projectMember와 원보완/결과 reader의 현재 접근 검사·RLS를 재사용하고 연결 대상이 모두 같은 project임을 검사한다. 조회용 ProjectCommand를 위조하거나 쓰기 정책/과거 영수증으로 읽기 권한을 대신하지 않는다. 조회에는 write controller 세대를 요구하지 않아 기존 조회 가능한 참여자도 같은 읽기 범위만 볼 수 있다. 인증/멤버·원자료 접근과 관계 검사는 반환 전 다시 확인하며 개인정보·Secret/외부 파일 경로/실행 handle은 추가하지 않는다.

GET는 두 단일 기록만 반환하고 무제한 결과 배열·페이지/cursor를 만들지 않는다. 후속 결과 선택은 origin.successorDraftRef로 기존 임무/결과 목록을 열어 사용자가 원결과를 선택하는 흐름을 재사용한다. 따라서 전체 후속 제출 이력을 한 번에 조회했다고 표시하지 않는다. 입력 형식/unknown key는400, 미인증401, 권한거절403(기존 비노출 원자료는404 유지), 다른project/없는원문/선택hash불일치404, 원장무결성/조정불가503, 크기초과413이다. 오류는 exact `{code}`이며 비밀 없는 대문자 코드만 반환하고 성공/빈 링크로 fallback하지 않는다.

## 6. 필요한 forward SQL 범위 — SQL 파일 작성/적용 아님

후보 논리 원장은 `anvil.rework_assignment_origins`와 `anvil.rework_result_links` 두 종류다. 정확 migration 번호/파일명은 채택 시 실제 등록부와 미적용 후보 충돌을 확인해 정하며 이번에 SQL 파일·manifest 항목을 만들지 않는다.

- origin: project/id/version/hash/snapshot, source rework fullref, successor draft fullref, command/actor/client/시각. project+sourceRework fullref 단일 연결·successor draft 단일 origin·버전1/append-only·ref/snapshot 결박.
- result link: project/id/version/hash/snapshot, origin fullref, successor confirmed/binding/execution/result fullrefs, bindingGeneration, command/actor/client/시각. project+followup result 단일 연결·같은 원문 replay 보존.
- 기존 assignment/result snapshot·hash·적용 SQL은 변경/재계산하지 않는다. 참조 프로젝트·버전/hash 검증은 constraints/보호 함수와 서버 reader를 함께 사용하며 문자열 ID FK만으로 충분하다고 하지 않는다.
- 현재 명령/auth session·자료별 허가영수증·감사·transaction-local 보호 조건을 연결하고 기본 거절/RLS·직접 DML 거절을 유지한다. 실제 사용자 정책/role/GRANT 자동 부여 없음.
- 새 두 operation의 허용 enum/명령·허가·감사 validator 및 링크 INSERT와 기존 초안/결과 INSERT의 원자성을 보완해야 한다. 과거 command receipt/읽기 validator는 변경하지 않고 새 변형을 구별한다.
- 현재 SQL0012 등 특정 거절·미적용0039/0040·M1 COMMIT 미충족은 해소된 것이 아니다. 이 SQL 범위 문서는 실제 DB 적용/정책 변경 승인이 아니다.

## 7. 채택 후 검증 단위·가역성

아래는 **예정이며 전부 NOT_RUN**. 이번 문서 대조/독립 정적 검토와 제품 PASS를 혼동하지 않는다.

| 단위 | 핵심 반례/검수 |
| --- | --- |
| 관계·조건 순수검사 | 다른 project/원보완·검수·기준/같은ID다른hash 거절; 선택 외 조건/파일 범위 확대·미확인 합격 추론 거절; 정확 선택/잔여 유지 |
| 저장 원자성/허가 | 두 새 명령의 default deny·다른 client/옛세대/만료·권한 혼동/receipt 재사용 거절; 한 command replay/다른 body 충돌; 원장만 남는 부분 저장·감사 실패 rollback |
| 현재 예약 | 같은 stageRole/connection/Anvil session 보존과 새 binding generation; 최신 binding 변경/다른 Agent·session·역할·방법론/불명 writer면 거절; 외부 세션 유지로 오인 금지 |
| 새 제출 귀속 | 정확 origin/새 확정 임무/예약·실행 ref·결과 fullref 일치; 일반 submitResult 우회·다른보완 재사용·옛 실행 결과 거절; COMPLETED 주장으로 원보완 자동완료 금지 |
| UI05/UI08 | 명시 연결 조회/이탈·거절·같은명령 재확인·계보/확정/예약/실행 상태 분리. 기존 보완 초안/원문·부족/증거bytes 경로의 영향 범위만 회귀 |
| 실제 연동 | 적용 허가와 정식 DB/실제 실행의 선행이 따로 갖춰졌을 때만 해당 범위 시험. 합성/fake DB/DOM은 실제 API/DB/Agent/인수 PASS가 아님 |

문서 후보는 비채택 상태로 남기거나 후속 버전으로 대체할 수 있으며 기존 제품 동작은 변하지 않는다. 향후 소스/미적용 SQL 구현만 채택하면 새 operation/계보 consumer를 기본 OFF/default deny로 두어 복구한다. 실제 데이터가 생긴 뒤에는 원장을 삭제하거나 과거 결과를 덮지 않고 새 명령 중단·읽기 보존·정확 이전 commit 복귀를 별도 검토한다. 자동 down migration/DB 복원·강제 reset은 제안하지 않는다.

## 8. 필요한 정확 결정과 제외

- PMO 검토 대상: A의 기능 부족을 남길지, **B의 두 새 operation·두 단일 계보 GET·불변 계보/연결 임무 guard·공유 잠금 참여·고정 초안 개정 미지원 및 위 SQL 범위를 소스/미적용 SQL/합성 검증 후보로 채택할지**. 현재는 문서만이며 B 채택 결정 없음.
- B의 후보 이름/계보·원자성 중 수정할 항목은 이 단일 문서에 통합한다. 기존 설계 본문·INTERFACES·WORK_PLAN 승인 범위를 몰래 변경하지 않는다.
- 실제 DB 적용/권한·정책 부여/현재 서비스 복구·OS writer 회수/외부 Agent 실행·계정/키·비용/Oracle/운영은 제외. 일반 child 확정/실행·자동 기준 변경·합격/실패 집계도 제외한다.
- 이 미결은 보완 후속 임무/제출 연결에만 적용한다. 이미 승인된 독립 기능을 중단시키는 전체 개발 gate로 사용하지 않는다.
