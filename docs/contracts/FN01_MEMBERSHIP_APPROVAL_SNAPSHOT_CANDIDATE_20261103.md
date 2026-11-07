# FN01 참여권한 변경 승인 원문 — 한정 계약 후보 A

2026-11-03. DRAFT / NOT_ADOPTED / 제품 GO0 / 실제 실행 GO0.

## 필요한 결정과 기존 계약의 차이

기존 INTERFACES15.2의 saveProjectMembership와 승인 계획 FN01/FN11은 그대로다. 현재 requestApproval은 이 연산의 원 payload를 저장하지 않고 consumableOperations에도 등록돼 있지 않다. targetRef:null인 새 관계에서는 payloadHash만으로 누구를 어떤 역할로 바꿀지 화면에서 재구성할 수 없다. 자유문장 reason·클라이언트 임시 메모리를 원문 대신 쓰지 않는다. 아래는 새 승인 요청/응답 필드·불변 snapshot 저장/소비를 명시하는 추가 상세이며, 다른 기능 선례를 이미 채택된 승인으로 취급하지 않는다.

권장 A는 기존 approval request_json/snapshot 안에 후보 원문을 함께 보관하고 기존 보호 GET으로 읽는 방식이다. 새 candidate table·별도 GET 주소는 만들지 않는다. 별도 후보 테이블/API를 만드는 대안은 저장·허가 접점이 늘어나므로 이번에는 권장하지 않는다. 보류하면 승인 원문 경계는 미완료로 남기며 AUTO-only 구현을 전체 FN01 완료로 보고하지 않는다.

## 공개 요청·응답의 정확 확장

1. 기존 POST project commands의 requestApproval에서 details.actionScope.operation='saveProjectMembership'일 때만 payload={details,candidatePayload}를 허용한다. candidatePayload={targetUserRef:{kind:'HUMAN',userId},participation:'OWNER'|'VIEWER'|'HANDOFF_ELIGIBLE',reason}이며 기존 member 저장 payload와 같은 codec/문자열 제한을 쓴다. 다른 연산의 기존 payload는 바꾸지 않는다.
2. 서버는 원 details/candidateCommandId/현재 주체·client/controlGeneration/project에서 approvalRef:null·baselineRefs:[]인 미전송 saveProjectMembership 원 command를 재구성한다. payloadHash·targetId/expectedVersion/targetRef와 원 codec을 모두 검산한다. 원 명령에 없는 actor/user 자료를 caller에게 선택하게 하지 않는다.
3. 기존 불변 approval snapshot에 membershipCandidate 한 필드를 이 연산에서만 넣는다. exact 원형은 아래와 같다.

```text
MembershipCandidateV1={
 schemaVersion:1,
 purpose:'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE',
 command: ProjectCommand(operation='saveProjectMembership',approvalRef=null,baselineRefs=[]),
 baseMembership: {kind:'NEW'} |
   {kind:'EXISTING',ref:{id:targetUserId,version,contentHash},participation:'OWNER'|'VIEWER'|'HANDOFF_ELIGIBLE'}
}
```

command는 기존 ProjectCommand의 정확11키를 사용한다. member 신규는 targetId:null/expectedVersion0/ActionScope.targetRef:null이며 같은 project에 기존·회수 관계가 없어야 한다. 기존 변경은 ACTIVE member의 정확 ref/version/hash·targetUserRef 일치가 필요하다. baseMembership은 서버가 실제 불변 member version/head에서 만들며 같은 project의 원 version/role과 검산한다. 회수 관계를 NEW로 만들거나 자동 재활성화하지 않는다.

membershipCandidate는 별도 entity/ref가 아니다. request ref/hash에 후보 전체를 포함하고 실제 request_json·원 request command의 result/receipt/audit와 결박한다. 원 approval 요청과 같은 Tx에서 한 번 저장한다. 저장 실패 시 요청도 미확정이며 원 commandId를 보존한다. 새 후보 저장행/전송/자동 적용은 없다.

4. 기존 GET /api/v1/projects/:projectId/approvals/:id의 고정 request snapshot에 이 필드를 반환하고 hash/물리 원문을 재검산한다. 새 candidate GET은 없다. 추가 필드가 다른 연산에 있거나 membership에 빠졌거나 원 target/ref/hash/role이 맞지 않으면 거절한다. 기존 요청·다른 종류의 snapshot/hash 규칙은 그대로다.
5. 이 관리 후보의 보호 조회·결정·소비에는 현재 로그인·같은 project의 OWNER/current controller·최근 재인증·명시 정책을 요구한다. 일반 승인 조회가 더 넓더라도 VIEWER/HE에게 이 원문을 노출하지 않는다. 다른 사용자 profile/이메일/계정·인증정보는 조회하지 않는다.

## UI08·원 명령 복귀

- 서버가 보관한 후보에서 대상 사용자 식별코드·신규 여부 또는 요청 당시 역할/정확 ref·변경 역할·원 변경 사유를 표시한다. approval details.reason/결정 사유는 각각 별도로 표시하고 원 변경 내용으로 대신하지 않는다.
- 고정 후보 조회는 과거 사실이다. 현재 관계/정책이 바뀌어도 원 snapshot을 고쳐 현재 상태처럼 표시하지 않는다. 결정/소비/실행 시 서버가 현재 head·정책·제어·기한·lastOwner를 다시 검사한다.
- 승인 결정만으로 member를 저장하지 않는다. 원 membership 화면으로 돌아와 보존 원문·candidateCommandId·payload/hash·target/ref/version을 대조하고 미전송 원 command에만 approvalRef를 붙인다. UNKNOWN/SENDING/APPLIED 명령의 내용·ID 변경이나 자동 POST는 없다.
- 같은 명령 재확인만 원 결과를 반환하고 새 version/감사·소비를 중복 생성하지 않는다. 다른 명령/세대·기한/회수·다른 후보 재사용은 거절한다. 원 주체가 관리 권위를 잃으면 새 승계자에게 결정을 자동 이관하지 않는다.

## 범위·검수와 결정 요청

채택 시 구현은 코드·화면·미적용0074·합성 검증까지다. 회원 버전/불변 이력·receipt/audit/역완결과 위 원문 연결을 같은 업무 단위에서 구현한다. 실제 DB 적용·정책/회원 권한 부여·GRANT·키·서비스·Agent 실행은 제외한다. 타사용자 HE용 정책 생산 기능은 별도 잔여이며 이번에 자동 확대하지 않는다.

준비 WI r3의22경로에 실제 UI props 연결 ProjectsPage.tsx, 승인 DTO decisions/api.ts, 서버 보관 원문 표시 decisions/ApprovalsPage.tsx의3경로를 추가한25경로 후보다. 기존 사용자 식별코드 수동 입력은 허용하고 profile 검색·가짜 대상 옵션은 없다. Main의 이전 '수동ID/개인profile검색0'은 구분이 모호한 표현이었으며 수동입력 금지 지시가 아니었다.

검수는 새/기존 관계의 원문 왕복·다른 사용자/기기/세대·다른 payload/role/target/ref/version·변조·현재 관계 변경·lastOwner/자기 관리권 상실·회수 관계·중복/COMMIT 불명·늦은 UI 응답·UNKNOWN 원명령 보호를 포함한다. 실제 PG/RLS·권한·사용자 인수는 NOT_RUN으로 분리한다. 기존 승인 형식을 느슨하게 하거나 새 관계 내용을 opaque hash만으로 완료하지 않는다.

필요한 결정은 이 A안의 새 approval 입력/불변 snapshot/보호 조회·표시/정확 소비 상세와 source-only 구현 채택이다. 기존 계획 전체를 다시 승인받거나 실제 권한 실행을 요청하는 문서가 아니다.