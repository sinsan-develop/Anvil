# FN09 하위 HUMAN 내용검토·확정 — r2 한정 보완 결정안

상태 CANDIDATE / NOT_ADOPTED. 작성·검토는 구현GO가 아니다. 기준 codex/av3-stage-b / fc14810dd53424088afe474376f722480cde0ed3. 원r1 docs/work_packages/FN09_CHILD_HUMAN_CONTENT_REVIEW_CONFIRMATION_DECISION_PACKET_20261030.md SHA51F71890EDCE8668676A39AFD5A1A76DA71C5BB3FC26A60452F8464B8617BEBB는 이력으로 동결한다. r2 A는 원r1의 HUMAN 내용검토·별도확정·과거조회 범위에 아래 보정만 결합한다.

## 필요한 결정·기존 승인 차이
과거 직접 'FN09 A안'은 승인 FN09_PREPARE_EXECUTION_SOURCE_DIRECT_APPROVAL_20261030.json B50A7709…의 instruction→4B8455AE 실행준비에 결박돼 있으며 본 자식 HUMAN 후보와 다르다. 부모연결초안283E8601은 저장/개정/조회만 허용하고 자식 내용검토·확정을 제외한다. 현재 공유 assertRoot·drafts.current/confirmations·0034가 이 내용을412로 차단한다. 이 A는 기존 operation의 nonnull parent 허용대상·저장guard·확정조회 의미를 바꾸므로 기존 FN02/FN14 source 승인이나 root UI 연결로 대신하지 않는다.

## r1의 현재 source 사실 보정
1. **재인증:** 현재 두 내용연산에는 별도 reauthUntil 검사가 없다. r1의 '기존 재인증'을 새로운 child 전용 비밀번호/재인증 gate 요구로 해석하지 않는다. 기존 로그인·현재client/단독제어·기한/현재 명시 정책 조건은 그대로 검사하며 새로운 hardcoded 재인증 gate를 추가하지 않는다. 현재 정책이 요구하는 조건을 낮추는 뜻도 아니다.
2. **기존 승인 오류 층 보존:** common authorizeMaterial에서 REQUIRE_APPROVAL+null은 APPROVAL_REQUIRED/412, AUTO+nonnull approvalRef는 APPROVAL_NOT_REQUIRED/422, class까지 도달한 nonnull은 ASSIGNMENT_APPROVAL_NOT_CONNECTED/412다. 이를 모두 하나의412로 덮지 않는다. 새 일회승인 요청/소비·승인예외는 추가하지 않는다.
3. **새 쓰기와 과거 replay 분리:** fresh child 검토/확정은 각각 부모 exact fullref/head/current 기준·최신ACCEPTED·범위부분집합/현재정책·제어를 잠금후 재검사한다. 기존 공통 APPLIED replay가 domain material 앞에서 반환한다는 사실을 숨기지 않는다. 현재 그 경로가 원review/confirmation·receipt/audit까지 이미 검산한다고 주장하지 않는다.
   A 구현에서는 해당 두 내용연산의 child replay가 raw receipt로 바로 반환되지 않도록 좁은 도메인 보호 검산 접점을 return 앞에 둔다. child 여부는 요청의 고정 target과 보호된 불변 draft에 근거해 판정하고 raw result의 parent flag만 신뢰하지 않는다. child면 정확 원명령/hash·보관 review/confirmation·receipt/audit와 현재 조회 보호가 확인된 원결과만 그대로 반환한다. 과거 APPLIED에 새 부모head/CAS·새 최신검토 요건을 다시 적용하지 않고, 현재 auth/client/control/정책 거절·보호원문/원결과 손상은 거절한다. root/null 정상 replay와 반환 원형은 보존하며, 다른 operation replay에는 이 접점을 확장하지 않는다. 실제 구현 접점/근거가 미연결이면 검증을 생략해 성공시키지 않는다.

## 좁은 내부 연결·남길 차단
- 기존 confirmations.read()/decision(), drafts.current()의 root-only 의미와 shared assertAssignmentRoot를 보존한다. 같은 class의 HUMAN 내용용 sibling 접점(readContent/decisionContent/currentForContent 등)을 사용해 기존 HTTP 내용 decision/확정 GET2만 한정 선택한다. 새 operation·endpoint·table·DTO field는 없다. method 이름은 내부 구현 예시이며 사용자 공개 계약이 아니다.
- routes의 assignmentConfirmations 객체나 기존 의존 주입 전체를 content reader로 바꾸지 않는다. 기존 root-only read에 의존하는 context 목록·실행상태/준비목록·결과기준/검토/보완·checkpoint 및 별도root검사가 있는 부모생성/role binding/context/execution preparation은 현재 child412/쓰기0를 그대로 유지한다. consumer19곳에 불필요한 새guard를 분산하지 않는다.
- UI04의 하위 내용 패널만 열고 AssignmentContentDecision의 child 책임자·맥락·실행준비·실행상세 조작은 표시/실행하지 않는다. 기존 root 화면·편집입력·현재client/세대·pending/hash와 불명결과의 명시 재확인을 보존한다. 과거 내용확정은 부모 현재성 미재검사·실행권한 아님으로 표시하고 자동 확정/재전송/승인소비0.
- 0034 원파일과 assignment_root_reference 및 downstream 10 trigger(agent_sessions/role_bindings/context_bundles/execution_preparations/execution_grants/usage_reservations/executions/execution_commands/writer_claims/delivery_outbox)는 보존한다. 새 pending forward SQL에서 review/version 두 내용guard만 한정 대체하고 원명령/receipt/audit·양방향 완결을 검산한다. 새 SQL번호는 채택후 실제목록 대조로 WI에 고정한다.
- 부모는 root 하나만, 같은project/정확plan·node·environment/budget/recordingPolicy·baseline/능력/파일범위 부분집합·최신허용parent를 유지한다. 순환/자기참조/손자/reparent·내용확정에 따른 새 권한/세션/실행을 열지 않는다. contentConfirmed는 내용 사실이고 ready/executionAuthorized/dispatchPerformed의 실행권위는 만들지 않는다.

## 구현·검수·제외
원r1+이r2를 source/화면/새 미적용 SQL·합성 검증으로만 채택한다. Main이 실제 exact경로·기준hash/단일writer WI를 고정하며 핵심은 drafts/confirmations/routes·UI2와 위 좁은 replay접점이다. shared root/다른 operation/현재guard의 불필요한 개편은 없다. 기존 SQL·자료·확정 이력은 보존하고 실제 DB/SQL실행·정책/권한/키/사용자파일조사·서비스·Agent·기존project차단해제·실제하위위임/예산/writer·운영/Oracle/main병합은 제외한다.

정상child검토→별도확정→고정조회, 두쓰기각부모변경/범위확대/타project/손자거절, staleparent의과거조회/replay·원증빙손상/권한회수, root/null 정상/다른operation replay 회귀, 412/422 기존층별거절/승인소비0, child역할/context/prepare/grant/writer·downstream10저장0, UI후속조작0/지연응답/입력보존을검증한다. 합성DB/DOM·정적SQL을실PG/trigger/경합·인증·브라우저/실Agent PASS로 승격하지 않는다.

## 결정
A 권장: 원51F71890+r2의 한 단계 하위 HUMAN 내용검토·별도확정·과거조회 source 범위만 채택한다. B: 초안 전용을 유지한다. PMO 위임 범위면 A/B를 명시하고, 직접 판단 범위면 이 정확 신규대상만 신산님께 결정받는다. 두 이미 채택된 FN02/FN14 A를 재승인하는 질문이 아니다. 결정 전 코드/SQL/버튼 변경은0이다.
