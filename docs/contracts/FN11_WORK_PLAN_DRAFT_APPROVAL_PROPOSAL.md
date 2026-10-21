# FN11→FN04 작업계획 초안 저장 일회 승인 상세 후보 r1

- 상태: **DRAFT / NOT_ADOPTED**. 제품 코드·새 API·SQL 파일·실제 DB/권한 변경 0.
- 근거: 승인 WORK_PLAN의 FN11·FN04/UI06·UI08, FN11 TC08/13/14. 기준 코드 `c44bcfe9b20ddafa95d7e8a85a0d925365ced3ed`.
- 목적: 정책이 REQUIRE_APPROVAL인 경우에도 사람이 결정한 정확한 작업계획 초안을 한 번만 저장할 수 있도록 기존 미연결을 완성한다. 승인 자체를 내용 검토·계획 확정·기준 적용·실행 허가로 취급하지 않는다.
- 작성 범위: 2026-10-21 PMO의 상세 DRAFT/정적 검토 지시. 문서 채택·코드/SQL 구현·실제 실행 승인이 아니다. FN03 실제 검증1회는 소진했으며 재사용하지 않는다.

## 1. 실제 공백·변경 범위

- 기존 `ProjectCommand.operation=saveWorkPlanDraft`, `approvalRef` 형식, requestApproval/decideApproval·저장/조회 endpoint는 그대로 사용한다. 새 공개 연산/endpoint/자동 정책은 없다. 다만 **이 연산의 requestApproval payload에 candidatePayload를 추가하고 기존 승인 상세 응답에 보호된 candidatePlan을 추가하는 공개 자료 계약 변경**이 있다. 다른 연산의 요청/응답은 그대로 유지한다.
- 현재 ProjectApprovals.consumableOperations 및 SQL0033의 소비 허용 목록에는 해당 저장이 없다. UI에 approvalRef만 붙이거나 REQUIRE_APPROVAL을 AUTO로 바꾸어 열지 않는다.
- 기존 AUTO 저장·DENY/무정책 거절, 원문/설계/시안 검토 및 업무 분석·오류 포함 초안 보관 규칙을 유지한다. 승인된다는 이유로 미확정 원문이나 issues를 확정/적합으로 승격하지 않는다.
- 새 범위는 **saveWorkPlanDraft 한 연산의 신규/개정 초안**뿐이다. 문서 파일 업로드·AF04 문서 작성/확정·confirmWorkPlan·설계 변경 활성화·업무 시작·다른 자료 쓰기의 승인은 포함하지 않는다.

## 2. 후보/승인 범위 결박

| 항목 | 신규 계획 | 기존 계획 개정 |
|---|---|---|
| commandId | 준비 시 생성한 UUID 한 개를 승인 요청/저장/유실 재확인에 유지 | 동일 |
| targetId / targetRef | null / null | 기존 고정 계획 ref의 id / `{id,version,contentHash}` 전체 |
| expectedVersion | 0 | 정확한 현재 head version |
| 새 결과 | 서버가 한 번 생성한 planId/version1 | 같은 planId/version+1 |

- ApprovalDetails/actionScope의 기존 구조·candidateCommandId·HUMAN userId/clientId·controlGeneration·operation·payloadHash를 사용한다. baselineRefs=[] / environmentRef=null / sourceScopes=[] / limitsRef=null은 그대로 유지한다.
- payloadHash는 원 요청 payload `{documentRef,designRef,screenReviewRefs,tasks,reason}`의 canonical SHA256이다. document/design/screen ref와 업무·선행·검수·복구 입력 전부가 포함된다. 서버 분석 후 정규화한 tasks나 표시 요약의 hash로 대체하지 않는다.
- 승인자가 hash만 보고 판단하지 않도록 이 연산의 requestApproval payload는 `{details,candidatePayload}` exact 두 필드다. 서버가 candidatePayload의 기존 save 입력 구조/출처·hash를 검사해 요청과 함께 불변 보관한다. 실제 저장할 명령 payload와 exact 대조하고, 다른 연산은 종전 `{details}`만 받는다. candidatePayload는 준비한 저장 입력이지 요청자가 임의로 적은 요약이 아니다.
- 기존 승인 상세 응답에 추가하는 `candidatePlan`의 exact 형식은 `{candidateCommandId,payloadHash,payload}`다. 이 operation에만 존재하며 commandId/hash는 같은 응답의 details와 일치하고 payload는 저장한 candidatePayload 그대로다. 응답 직전에 저장 hash/요청 귀속을 검사하며, 깨진 저장을 표시값으로 재계산해 정상으로 바꾸지 않는다.
- 입력 형식/누락/다른 연산의 candidatePayload는 기존 APPROVAL_INPUT_INVALID422, 다른 주체 원문은 NOT_FOUND404, target 진행은 APPROVAL_TARGET_CHANGED409, candidate 행 누락/다중/저장 hash 불일치는 새 WORK_PLAN_APPROVAL_STORAGE_UNAVAILABLE503로 닫는다. 그 외 기존 승인/권한/기한 오류 의미는 유지한다. raw SQL/민감 원문 오류는 반환하지 않는다.
- 모든 source는 같은 프로젝트에 속하고 현재 조회 가능한 exact ref여야 한다. AF04 원문은 기존 save의 현재 head 조건을 유지한다. 설계/화면의 고정 과거 버전 사용 가능 여부와 검토/확정 부족을 issues로 보관하는 기존 초안 의미는 바꾸지 않는다. 이 후보가 과거 고정 ref를 모두 최신 ref로 바꾸라는 계약은 아니다.
- 요청 작성 시/결정 시/신규 저장 직전에 targetRef의 전체 hash와 현재 head를 다시 대조한다. 신규 저장의 원문/설계/화면·정책/제어·target 행은 기존 순서에 맞는 잠금으로 마지막 DB 제약 검사까지 고정한다. payloadHash가 같더라도 다른 commandId/주체/기기/제어세대/정책 버전/프로젝트면 재사용하지 않는다.
- 실제 현재 REQUIRE_APPROVAL 정책과 같은 policyRef를 결박하고 DENY 우선·만료·회수·현재 인증/OWNER/control을 기존보다 느슨하게 하지 않는다. 사용자에게 정책을 자동 등록하지 않는다.

## 3. 처리 순서·재전송·실패

1. 현재 로그인/세션·프로젝트 OWNER/쓰기 가능·client/control generation·현재 정책/DENY/기한을 먼저 확인·잠근다.
2. 기존 승인 기록을 읽되 **동일 명령의 이미 커밋된 결과**를 확인할 때는 소비된 승인/진행한 head라는 이유만으로 새 target CAS를 먼저 요구하지 않는다. current 권한/정책이 유효하고 commandId·원 full request hash가 정확히 같을 때만 기존 영수증을 반환한다. 권한이 회수됐으면 과거 성공 기록이 있어도 거절한다.
3. 신규 명령만 APPROVED/미소진·동일 scope/policy/주체·기한과 원 payload/target/current 기준을 확인한다. 거절/변경요청/만료/옛 제어·정책/다른 후보는 저장·소비하지 않는다.
4. 기존 save의 참조/분석/CAS 후 한 transaction에서 command/authorization receipt/approval consumption/감사·계획 head/version/업무/선행을 저장한다. 중간 성공이나 소비만 따로 commit하지 않는다.
5. deferred constraint 검사는 마지막 DB 검사 시 실제 clock_timestamp와 현재 정책·제어·대상/원문 기준 및 양방향 완결성을 대조한다. 검사 후 외부 commit 응답까지의 물리 시간이나 관리자 동시 침해까지 보장한다고 주장하지 않는다.
6. 실패는 transaction 전체 rollback이다. 별도의 기존 DENIED 감사는 승인 소비나 계획 저장 성공으로 간주하지 않는다. 유실은 **같은 최종 command body/ID**만 재확인하며 새로운 ID/새 승인으로 같은 효과를 중복 생성하지 않는다.

- 기존 ProjectPolicyRepository는 authorizeMaterial→projectReplay 순서이고 authorize는 CONSUMED의 동일 command/hash replay를 허용한다. 이를 전면 재배치하지 않고 이 연산의 새 target 검사를 신규 분기 뒤에 배치한다. 아직 승인되지 않은 다른 연산의 순서/거절 동작을 바꾸지 않는다.
- approvalRef 결박은 준비 후 실제 저장 전 딱 한 번의 명시 조작이다. 이미 전송된/유실된 원명령에는 나중에 approvalRef를 덧붙이지 않는다. 최초 확실한 APPROVAL_REQUIRED로 미적용이 확인된 입력은 별도 준비/요청으로 분리할 수 있지만, 그 전 명령과 새 후보 ID를 혼동하지 않는다.
- 거절/변경요청 후 편집은 원문/기존 버전·이유를 보존하고 기존 후보를 과거 기록으로 남긴 뒤 새 commandId/새 payloadHash로 별도 준비한다. 옛 승인/결정은 새 입력에 이전하지 않는다.

## 4. 저장 보호 후보·원자성

- 기존 적용 SQL0033 등은 수정하지 않는다. 채택 시 새 `db/migrations/0035_work_plan_draft_approval.sql` 후보로 한 연산만 추가하며 실제 DB 적용은 별도 경계다. 이 DRAFT에서는 파일을 생성하지 않는다.
- `anvil.work_plan_approval_candidates`의 불변 행을 제안한다: project/approval request/request server command·candidate command·policyRef/control/actor/client·old targetRef·exact candidate_payload_json/payloadHash. **승인 요청 저장 transaction**에서 만들고 나중에 입력/집행 결과로 수정하지 않는다. 실제 결정/소비/server command/result plan ref는 기존 관계를 따라 대조한다. 정규화된 version_json만으로 원 payload를 재구성할 수 있다고 가정하지 않는다.
- exact 원 payload는 계획 업무/이유 등의 사용자 자료를 포함한다. 기존 계획과 같은 보호 DB/프로젝트 범위 안에서만 보관하고 기존 감사에는 본문/비밀을 복제하지 않는다. 기존 승인 상세 GET에 이 연산의 candidatePlan을 추가하되 **현재 프로젝트 OWNER이면서 요청 작성자인 사용자**만 원문을 받는다(client는 조회에만 고정하지 않아 같은 사용자의 과거 조회를 허용). 다른 주체/조회자에게는 원문을 노출하지 않고 NOT_FOUND로 거절한다. 요청 당시 기기/세대는 보존하며 결정·저장은 그 현재성까지 별도로 검사한다. 새 일반 조회·파일 다운로드 API는 없고 보관은 기존 계획/명령 이력과 함께하며 자동 삭제0이다.
- 요청 command/receipt/요청/정책과 candidate 행, 실행 command/receipt/소비/결정 및 그 candidate 간 양방향 FK/unique/deferred 제약을 검사한다. orphan candidate, 소비만 존재, command의 승인 참조만 존재, 영수증만 존재, 계획 version/head만 바뀜, 감사 누락/변조는 commit되지 않아야 한다. 아직 미결정인 정상 요청 candidate는 존재할 수 있고 이때 실행 command/소비/계획 저장을 강제하지 않는다. AUTO 저장에는 이 candidate를 강제하지 않는다.
- SQL은 exact 원 payload를 사용해 payloadHash와 full final request hash를 재계산하고 저장 ref·snapshot hash·업무/선행 projection·원문/설계 ref와 대조한다. 서버가 미리 전달한 hash를 그대로 믿는 것으로 끝내지 않는다.
- 생성/개정 head 변경은 **그 transaction의 현재 command**에 결박해 expectedVersion→새 version을 검사한다. 후속 합법 개정으로 head가 진행해도 과거 승인 version을 손상/무효화한 것으로 취급하지 않는다. 과거 receipt를 항상 최신 head와 같아야 한다는 전역 제약을 만들지 않는다.
- 역할은 기존 app/migrator만 사용한다. app의 직접 DML로 완결된 승인 집행 없이 보호 행을 넣거나 고치지 못하도록 기존과 같은 guard+불변/최소 grant를 사용한다. 이것을 DB 관리자·서버 credential 침해까지 방어하는 증거로 주장하지 않는다.

## 5. 상세 화면 동작 — 기존 UI06/UI08 안에서

기존 작업계획 편집 본문/업무 목록은 유지한다. 저장 버튼 옆에 해당 명령 준비/승인 상태를 표시하며 새로운 Dashboard/메뉴를 만들지 않는다. 도움말은 기존 i/팝오버 규칙을 따른다.

| 상태/조작 | 표시·허용 동작 | 금지 |
|---|---|---|
| 편집 → 저장 준비 | 문서/설계/시안 ref·신규/개정 대상·업무/선행·이유/전체 입력 읽기 전용 미리보기, 후보 ID/hash·현재 정책/기한 표시 | 준비만으로 요청/저장/확정하지 않음 |
| 일회 승인 요청 | 위험·복구·미확인 입력 후 기존 requestApproval 한 번 전송. 유실은 같은 요청만 재확인 | payload만 바꿔 기존 요청 재사용 금지 |
| UI08 별도 결정 | 기존 승인 상세 GET의 고정 candidatePlan·payloadHash를 대조해 대상/전체 업무 입력·주체/기기/버전/기한을 보고 승인/거절/수정요청. 결정과 저장은 분리 | 입력 원문 조회/해시 확인 없이 결정하거나 승인 버튼으로 계획 저장 자동 실행 금지 |
| UI06 승인된 후보 | exact 요청/결정/후보 대조 후 별도 ‘승인 범위로 저장’. 기존 AUTO는 기존 저장 경로 유지 | 다른 요청 선택·불일치/만료·미확인 후보의 저장 금지 |
| 저장 결과/유실 | 저장 영수증과 고정 version 재조회를 구분. 유실은 같은 full body/ID 재확인, 이탈/복귀에도 버퍼 유지 | 유실 pending을 삭제해 새 저장/새 승인으로 우회 금지 |

- user/client/project/control·현재 plan ref가 바뀌면 미전송 신규 동작을 막고 원 후보는 같은 주체 버퍼에 보존한다. 전송된 응답은 해당 binding에만 수집한다. 다른 주체에게 이전 입력/승인 원문을 보여주지 않는다.
- 승인/소비 이력은 삭제하지 않는다. 조회에는 저장된 상태/결정/소비와 현재 정책·제어·기한의 사용 가능 여부를 분리한다. 과거 CONSUMED는 새 저장 가능이 아니고, 과거 성공은 현재 모든 기준이 최신이라는 뜻이 아니다.

## 6. 구현/검수 단위·완료 조건

- 책임 Main, 단일 code writer. 채택 후 허용 파일: approvals의 이 연산 target/scope 분기, 기존 work-plan 저장/receipt 최소 연결, 신규 SQL0035, UI06 계획 승인 준비/소비·UI08 기존 표시의 필요한 범위, 해당 단위/합성 DOM/DB 시험. 관련 없는 리팩터링/다른 승인 연산 확장0.
- 정상: 신규/개정 각각 별도 요청→결정→명시 저장→고정 재조회, 이미 소비된 정확 명령 replay 결과 동일/새 version0. 기존 AUTO 저장·다른 upload/detach/신뢰 승인 정상 회귀.
- 음성: payload/refs/tasks/이유 변조·다른 대상 hash/version·같은 승인 다른 명령/프로젝트·주체/기기/세대 변경·DENY/무정책·기한/회수·거절/수정요청·다른 scope·stale source/target·권한 없는 이력 조회. 저장/소비 부작용0.
- 원자성: 동시에 같은 승인 소비 최대1회, 확정 권한 재확인 후 기준 변경 경합, receipt/소비/binding/계획버전/업무/감사 각 중간 실패 rollback. 직접 app DML의 orphan/누락/변조/과거행 수정 및 직접 COMMIT 음성. 이후 head 합법 개정은 과거 증거 보존.
- UI: 준비/요청/결정/저장 분리·최종 저장0인 취소·거절후 새입력/새후보·유실 원명령 유지·늦은 응답/프로젝트·주체 전환 입력 보존·현재효력과 과거기록 구분·same-origin/텍스트 이스케이프.
- 합성·fixture·단위/type/build는 해당 범위만 증명한다. 실제 신규 SQL/PG의 commit·권한·경합, HTTP/served UI↔DB, 실사용자 여정은 실행하기 전 미검증으로 남긴다. 문서 DRAFT 작성은 기능 구현 진도가 아니다.

## 7. 선택지·위험·가역성·채택 요청 범위

1. **권장: 한 연산만 exact 원 payload binding + forward guard로 연결.** 이미 계획된 기능을 사용자 흐름으로 완성하고 DB에서도 양방향 원자성을 검수할 수 있다. 대가는 계획 입력 원문을 보호 DB 이력에 한 번 더 보관하고 관련 guard/검수가 늘어나는 점이다.
2. 공통 자료 연산 전체를 한꺼번에 승인 소비하도록 일반화: 범위/회귀/각 target의 hash·정규화 의미가 달라 이번에는 제외한다.
3. AUTO만 사용/승인 필요 정책을 변경: 작업이 쉬워져도 요구한 승인 통제를 우회하므로 채택하지 않는다. 현재 fail-closed 유지가 구현 전 상태다.

- 주요 위험: 승인과 payload 정규화의 불일치, receipt/소비만 커밋되는 부분 성공, replay가 head 진행으로 막히는 오류, 이탈·유실에서 새 명령 중복 생성, 정확 입력 이력의 노출. 앞의 경계·검수와 기존 권한으로 줄이되 실측 전 해소됐다고 하지 않는다.
- 가역성: source는 후속 revert 가능, 새 SQL은 기존 파일 보존·미적용 후보로 준비한다. 실제 적용 후 승인/계획 이력은 코드 되돌림으로 삭제/소급 취소하지 않는다. 임의 down migration/자료 삭제/승인 기록 변경0. 해당 연산 정책 DENY는 새 집행을 막는 수단일 뿐 과거 저장을 되돌리지 않는다.
- **이번 채택 요청 후보:** 위 한 연산의 source·새 미적용 SQL·단위/합성/in-process 검증 구현 기준만. 정식/격리 DB 생성·적용/실사용자 정책·기존 Secret/계정/서비스·실 Agent/비용·Oracle·다른 계약(VIEWER/r2/DD166F/공유B) 해제는 포함하지 않는다. PMO의 정확 채택/실행 안전 경계 확인 전 코드/SQL 작성0을 유지한다.
