# FN04 현재 적용 기준·불변 이력 조회 — I1 보완 후보

상태: **DRAFT / NOT_ADOPTED · 구현/실행 승인 아님**. 2026-10-27, Main 어울.
부모 후보 [FN04 승인 연결 차이 r1](FN04_ACTIVATION_APPROVAL_DELTA_PROPOSAL.md) SHA256 84C4AB82C2003F7F0D7E541FD881C804614CACFE5BFC4AF92CE485ECE9AC0573. 부모 원문·기존 채택 질문을 수정하거나 답변한 것으로 취급하지 않는다. 현재 source 기준4d41151af9cd53671a35dcad1594506d6194f5f0, DATA_MODEL §7.2·INTERFACES FN04의 논리 적용/현재 pointer/불변 과거 보존을 상세화하는 별도 미채택 자료형·보호 GET 제안이다.

## 1. 확인된 공백과 선택 이유
부모는 적용 후보5필드와 현재 pointer CAS를 설명하지만 activation의 정확 snapshot/hash와 새로고침 후 현재/과거 조회 계약은 없었다. 현재 소스에는 후보 입력/관계 검사만 있고 실제 activation 공개 연산·저장·pointer·조회는 없다. 기존 입력/관계 검사는 재사용하며 다시 구현하지 않는다.
세 가지를 비교했다. 첫 적용 []만 구현하면 후속/내구 조회가 빠진다. 원 입력 reason·후보 전체를 적용 이력에 또 저장/공개하면 현재 후보의 원요청자 보호와 중복 원문 관리 범위가 커진다. **권장안은 적용 사실의 최소 불변 snapshot + 현재/고정 GET2개**이며, 이유 전체는 기존 부모의 보호 후보에 보존하고 적용 사실은 그 정확 payload hash에 결박한다. 이는 Main의 제안이며 사용자가 선택·승인한 사실이 아니다.

## 2. 불변 snapshot 정확 형식
아래 필드만 허용하는 JSON 객체를 제안한다. UUID·VersionRef·기존 ApprovalRef·canonicalJson/SHA256 검증은 현 계약을 재사용한다. 숨은 필드·getter·의심 비밀·불완전 참조를 정상화해 저장하지 않는다.

| 필드 | 정확 의미 |
|---|---|
| schemaVersion | 1 |
| purpose | DESIGN_BASELINE_ACTIVATION |
| projectId | 경로·원 명령·모든 저장 관계와 같은 프로젝트 UUID |
| activationId | 이번 transaction에서 새로 발급하는 activation UUID |
| generation | 프로젝트 적용 세대의 양의 안전 정수. 첫1, 이후 직전+1. 과거 행 개정 version이 아님 |
| previousActivationRef | 최초 null, 이후 같은 프로젝트 직전 activation fullref |
| changeRef | 부모 payload.changeRef 전체 |
| impactRef | 부모 payload.impactRef 전체 |
| approvedDesignRef | 부모 payload.approvedDesignRef 전체 |
| confirmedPlanRef | 부모 payload.confirmedPlanRef 전체 |
| candidatePayloadHash | 원 payload5필드 전체의 기존 canonical SHA256. reason도 hash 대상이며 정규화/요약하지 않음 |
| approvalRef | 기존 정확 {requestId,decisionId,scopeDigest}. 새 토큰/권위 필드 아님 |
| approvalConsumptionId | 같은 최종 명령을 소비하는 기존 승인 소비 행의 UUID. 미래 receipt/result의 hash를 넣지 않음 |
| commandId | 후보에서 동결한 최종 activateDesignChange 명령 UUID |
| policyRef | 신규 집행 직전에 확인한 해당 명령의 정확 정책 fullref |
| controlGeneration | 신규 집행 직전의 원 명령/승인/현재 제어 세대 |
| recordedBy | 정확 {kind:HUMAN,userId,clientId}. 서버 인증 결과만 사용 |
| activatedAt | transaction의 서버 시각, UTC ISO 밀리초 Z |

ref={id:activationId,version:generation,contentHash:SHA256(canonicalJson(snapshot))}. ID/세대/project도 hash에 포함한다. mutation으로 snapshot/hash를 다시 쓰지 않는다. 현재 pointer/isCurrent/observedAt은 불변 snapshot에 넣지 않는다.
승인 소비 UUID와 activation UUID는 해당 transaction 안에서 hash 계산 전에 발급한다. approvalRef/원 명령은 이미 결정된 입력이며 snapshot에 미래 command result/receipt hash·감사 result hash를 넣지 않아 결과→activation→결과의 hash 순환을 만들지 않는다. commandId·소비Id 일치만으로 정합을 추정하지 않고 조회 때 아래 저장 대응을 검사한다.

### 이력과 원문 대응
- 저장 후보의 정확 원5필드/hash·원명령 operation/body/client/세대·대상/이전 baselineRefs·정확 결정/소비·정책·감사 결과와 같은 transaction의 적용 사실이 대응해야 한다. 신규 성공 receipt는 같은 activation ref를 가리킨다.
- 영향을 받은 업무 표시는 부모 §5대로 AFFECTED 업무만 원자 연결한다. snapshot에 새 자유 입력의 affectedTasks/recheckRequired를 추가해 호출자가 결정하게 하지 않는다. 정확 impactRef의 불변 영향 내용을 소비하며, 고정 plan/task 귀속과 업무 재확인 저장 관계도 같은 transaction guard로 검사한다. 기존 UNKNOWN/gap·보존된 완료 근거를 지우지 않는다.
- reason 원문은 기존 candidate 보관에 한 번만 보존하고 원래 보호 조회로만 연다. 이 snapshot에는 reason/문서 본문/원 OS자료/Secret을 추가하지 않는다. snapshot으로 원 payload bytes를 독립 재계산했다고 UI가 주장하지 않는다. 서버가 보호 후보 hash와 실제 저장 관계를 확인한 적용 사실이다.
- 과거 적용 뒤 현재 pointer·현재 정책·현재 impact가 합법적으로 진행해도 과거 snapshot을 손상으로 판정하지 않는다. 과거 command/정책/consumption 귀속과 현재 읽기 권한은 분리한다.

## 3. 최소 GET2개 — 모두 새로운 미채택 공개 계약
공통 prefix /api/v1. 새 목록·검색·페이지·cursor·자동 전체 이력 순회는 추가하지 않는다.

| 경로 | 정확 응답 객체 |
|---|---|
| GET /projects/:projectId/baseline-activations/current | {projectId,current,observedAt,executionAuthorized:false,dispatchPerformed:false}. current는 {state:NONE} 또는 {state:PRESENT,activationRef,designRef,planRef} |
| GET /projects/:projectId/baseline-activations/:id/versions/:generation | {projectId,ref,snapshot,currentActivationRef,isCurrent,observedAt,executionAuthorized:false,dispatchPerformed:false} |

현재와 고정 조회는 각각 한 읽기 transaction의 같은 snapshot에서 pointer/이력 대응을 검사한다. 고정 조회의 currentActivationRef는 실제 현재 ref 또는 검증된 최초상태의 null만 허용한다. 유효한 과거 행이 있는데 pointer가 없으면 정상 null 응답이 아니라 아래 저장 오류다. :id는UUID, :generation은정규 양의 안전정수이며 고정 URI를 임의 외부 URL로 바꾸지 않는다. 응답 전체는 기존 본문2MiB 상한 안에서만 반환한다.
읽기 주체 권장안은 **현재 로그인·현재 프로젝트 OWNER**다. 기존 회원/소유/격리 기준을 서버에서 확인하고 오류/상실/타프로젝트는404, 원문/존재 여부를 일부 노출하지 않는다. 같은 사용자의 다른 client 조회를 허용하지만 쓰기/원후보 결정·소비·실행 권한은 아니다. 이 OWNER 정책도 새 delta이며 기존 GET 권한을 자동 상속했다고 하지 않는다. VIEWER 권한 확대는 포함하지 않는다.
적용 snapshot에는 reason/원 payload가 없어 현재 OWNER가 당시 원요청자와 달라도 적용 식별 사실을 조회할 수 있게 제안한다. **부모의 candidateActivation 이유 전체는 계속 현재 OWNER이면서 원요청자일 때만 조회**한다. 두 자료의 노출 범위가 다른 것은 의도적인 후보 결정이며 채택 전 구현하지 않는다.
서버는 fixed ref/id/version/hash·모든 snapshot 필드와 원 저장 대응을 확인하고 반환한다. 브라우저는 받은 ref와 canonical snapshot hash·project/selection 대응을 검사하며, isCurrent를 집행 허가로 쓰지 않는다. fixed 과거 조회는 previousActivationRef 명시 클릭으로만 이어간다. session/client/project/선택 교체·401/403/404·이탈 시 이전 자료/진행 입력을 회수하고 늦은 응답을 재활성하지 않는다. 실제 새 command 전에는 서버 현재값을 다시 검사한다.

## 4. NONE·유실·과거·현재 변경
- NONE은 지원되는 저장소에서 현재 pointer와 activation 이력이 **모두 없음**을 같은 읽기 snapshot에서 확인했을 때만 반환한다. 실제 OS writer 없음·프로젝트가 아무 작업도 안 했다는 뜻이 아니다.
- reader/schema 미연결·오류·변조·깨진 FK/hash·pointer 유실/이력 존재·세대/previous 연결 불일치는503 BASELINE_ACTIVATION_STORAGE_UNAVAILABLE이다. NONE/빈 목록/최초 []로 바꾸거나 자동 복구하지 않는다.
- 정상 이력은 최초 generation1/previous=null 뒤에 프로젝트 내 직전 ref+1의 단일 연결이며, 현재 pointer는 그 합법 최종 적용 ref와 대응한다. 지원되는 저장소의 전체 일관성은 SQL 불변/귀속/commit guard로 유지하고, 미지원/불완전 reader에서는 확인했다고 답하지 않는다. 유한 GET 한 건으로 과거 모든 OS사실/타저장소 완전성을 증명하지 않는다.
- 신규 적용은 부모 §3~5의 baselineRefs [] 또는 exact현재fullref와 잠금/CAS를 transaction 안에서 대조한다. 첫 []는 이력도0일 때만 허용한다. 후속 generation은 직전+1, 중복 세대/같은 이전에서 두 successor는 commit불가다. overflow는 신규 적용을 닫고 초기화하지 않는다.
- 새 queue/claim/관측/결과·writer 안전은 부모 §6의 미결 선행 그대로다. 위 DB 직렬화만으로 OS 쓰기/범위가 안전하다고 하지 않는다.
- 조회 후 current가 바뀌면 기존 후보를 최신으로 자동 변경하지 않고 신규 명령은409 VERSION_CONFLICT다. 정확 고정 과거는 정상 보존·isCurrent=false다.
- 같은 최종 명령/body/hash의 합법 소비 replay는 현재 권한을 확인한 뒤 기존 receipt를 먼저 반환한다. 최신 pointer 진행을 신규 CAS로 재검사해 과거 성공을409로 바꾸지 않는다. 다른 명령/내용/주체/기기에는 과거 결정을 재사용하지 않는다.

## 5. 채택 후에만 할 구현·검수
부모 r1 §8.1과 이 후보를 함께 검토해야 한다. 새 endpoint2·불변snapshot/hash·현재 OWNER의 적용사실 조회/원후보 원문 보호분리·현재pointer/세대 저장 보호가 추가 delta다. **이 파일의 작성/독립검토/commit은 채택이 아니다.** 기존 질문 답변이 부모만 가리키면 이 추가 범위를 승인한 것으로 넓히지 않는다. 기존 질문을 복제하거나 PMO의 한정 지원 범위를 임의 재개하지 않는다.
구현을 채택하면 실제 현재 파일/번호를 재대조해 단일 WI의 허용 경로를 고정한다. 기존 activation 입력/관계 parser·기존 SQL/등록된 migration은 보존한다. 새 pending SQL 번호는 아직 예약하지 않는다(다른0050후보충돌주의). DB 적용·역할/정책 부여·실제 기준 전환·업무재개/Agent/native/비용/서비스·Oracle는 포함하지 않는다.
필수 검수는 최초 NONE/PRESENT·schema없음·pointer유실+이력존재·exact과거/현재전환·해시/관계/세대/분기변조·다른project/OWNER회수/읽기다른client·원후보 이유 비노출·UI 이탈/늦은응답·동일명령replay/다른명령재사용·CAS/원자성이다. 원본 후보 reason 비밀검사는 기존 inspectArtifact 상당의 서버 입구에서 값 없는 거절로 연결해야 하며 새공개 계약이 비밀 탐지를 완전 보장하지 않는다.
단위/fakeDB/합성DOM/SQL정적과 실제PG/DML/경합/served/OS 관측은 별개다. **현재 신규 시험·코드·SQL·자원 생성은0**이다. 부모 §6의 실제 완전성·writer 선행을 공급하는 자료/권한을 추가하지 않는다. 현재 생산 경로의 미연결 gap는계속412 DESIGN_ACTIVATION_NOT_READY이며 이를 제거/과거PASS소급/합성정상자료로대체하지 않는다.
rollback은 미래 소유 source revert이며 과거 적용/승인/소비·원문을 삭제하지 않는다. 이 문서는 설계 공백 보완 후보일 뿐 실제 기능/Stage/계획 완료가 아니다.
