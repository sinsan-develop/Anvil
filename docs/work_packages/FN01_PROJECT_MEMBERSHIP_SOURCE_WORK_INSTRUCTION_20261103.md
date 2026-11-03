# FN01/FN11 프로젝트 참여권한 source 작업지시서 — 실행본 r4

상태: APPROVED_SOURCE_ONLY / 단일 기존 Primary 착수 preflight 후 구현. 신산님 2026-11-03 직접 답변 「A안 계약·source-only 구현 승인」을 아래 고정 후보와 25경로에 결박한다. 실제 실행 승인이 아니다.

## 1. 승인 근거와 목적

- 승인 WORK_PLAN/FUNCTION_WORK FN01·FN11, INTERFACES §15.2의 기존 saveProjectMembership를 사용자 화면→정확 명령→member 새 불변 버전/현재 head→receipt/audit→보호 재조회로 연결한다.
- OWNER의 최근 재인증·현재 단독 제어·정확 정책, 마지막 유효 OWNER 보존·자기 임의 승격 금지를 유지한다. OWNER/VIEWER/HANDOFF_ELIGIBLE의 등록·역할 변경이 대상이다.
- 실제 키/DB 접속·SQL 적용/GRANT·정책/실사용자 권한 부여·서비스·Agent·OS 실행·실자료/백업 대상 조사·기존 프로젝트 차단 해제는 제외한다. 제품/시험 source 읽기, 코드·화면·미적용 SQL·합성 검증만 수행한다.
- 기존 FN01_VIEWER_MEMBERSHIP_PROPOSAL.md는 미채택 이력이다. 그 별도 grantProjectViewer/revokeProjectViewer·eligibility/profile 조회·새 archived 예외·5분/분당10 제안을 이 구현에 섞거나 승인된 필수 gate로 적용하지 않는다. 새 초대/전역 사용자 검색·타 사용자 profile 조회·일반 자료 접근 확대·자동 제어 이전은 없다.
- saveProjectMembership의 현재 계약에 없는 별도 회원 회수 연산을 임의 발명하지 않는다. 그 잔여와 실제 DB/사용자 인수는 전체 FN01 완료와 구분한다.

## 2. 소유권·착수 선행

Main: 본 WI/WORK_STATUS·검수·Git 통합. 기존 Primary: 아래 제품/시험 경로의 단일 writer. 다른 사람의 수정/보호 untracked를 복구·삭제하지 않는다.

FN15 writer 반환과 해당 겹치는 경로의 안전 checkpoint 뒤, Main이 실제 최신 HEAD/branch/private·허용 파일별 시작 지문·신규 부재·보호 자료·진행 중 도구를 검산하고 이 WI를 독립 검토한 다음에만 같은 Primary에 dispatch한다. 지금의 E63 WIP를 미래 착수 지문으로 재사용하지 않는다. 새 agent/chat/branch/자동화는 만들지 않는다.

## 3. 제품·시험 정확 허용 경로 25개

현재 baseline은 codex/av3-stage-b의 local/private 6e3c8eb79aae943a22bf8520039f285f41ba50b8이다. FN15 writer 반환·제품 tracked clean을 Main이 확인했다. 아래 기존14/신규11을 시작 지문·부재 인벤토리로 다시 고정한다. 범위 밖 경로가 필요한 경우 정확 이유/delta를 Main에게 반환하고 독립 작업은 계속한다.

1. .gitattributes
2. apps/server/modules/access/project-command.ts
3. apps/server/modules/projects/routes.ts
4. apps/server/modules/approvals/project-approvals.ts
5. apps/server/modules/approvals/approval-input.ts
6. apps/web/src/App.tsx
7. apps/web/src/features/projects/ProjectAccessSummary.tsx
8. apps/web/src/features/connections/policy-editor-profile.ts
9. contracts/runtime/project-membership-v1.ts (신규)
10. apps/server/modules/projects/project-memberships.ts (신규)
11. apps/server/modules/approvals/project-membership-approval-target.ts (신규)
12. apps/web/src/features/projects/membership-api.ts (신규)
13. apps/web/src/features/projects/ProjectMembershipPanel.tsx (신규)
14. db/migrations/0074_project_membership_versions.sql.pending (신규 후보; 착수 직전 번호/경로 충돌 검산)
15. tests/unit/FN01/project-membership-input.test.ts (신규)
16. tests/unit/FN01/project-memberships.test.ts (신규)
17. tests/unit/FN01/project-membership-schema.test.ts (신규)
18. tests/unit/FN11/project-membership-approval.test.ts (신규)
19. tests/unit/UI01/project-membership-panel.test.ts (신규)
20. tests/unit/FN01/project-access-summary.test.ts
21. tests/unit/FN11/approval-input.test.ts
22. tests/unit/FN11/policy-editor-qa-budget.test.ts
23. apps/web/src/features/projects/ProjectsPage.tsx
24. apps/web/src/features/decisions/api.ts
25. apps/web/src/features/decisions/ApprovalsPage.tsx

새 migration에는 exact 경로의 LF 규칙만 추가한다. 과거 SQL/fixture bytes·전역 Git 설정/정책은 바꾸지 않는다. Main의 source 후보/현황 문서는 Primary 소유가 아니다.

## 4. 명령과 저장 상세

- 기존 POST /api/v1/projects/:projectId/commands의 saveProjectMembership만 사용한다. 공통 idempotency/CSRF/actor/client·controlGeneration/기한·baselineRefs·approvalRef를 유지한다. 실제 주체는 인증 결과에서만 얻는다.
- payload는 targetUserRef:{kind:'HUMAN',userId}, participation:OWNER|VIEWER|HANDOFF_ELIGIBLE, reason의 정확 원형이다. approvalRef는 공통 envelope 한 곳만 쓰며 이유는 기존 일반 문자열 규칙/본문 한도 안에서 보존한다. 사용자 ID만으로 권한을 얻지 않는다.
- 새 관계: targetId:null/expectedVersion:0, ActionScope.targetRef:null, 정확 대상은 payloadHash에 포함한다. 같은 project 잠금 안에서 과거/회수 관계도 없음을 검사한다. 회수된 기존 행을 신규로 덮어쓰지 않는다.
- 기존 관계: targetId=userId/expectedVersion=현재 member head. 불변 member ref는 id=userId/version=head/contentHash이며 snapshot에 projectId를 포함한다. 승인 후보/소비 시 실제 고정 snapshot hash를 대조한다. 별도 랜덤 snapshot ID로 공통 ActionScope와 충돌시키지 않는다. 이번 save는 ACTIVE 기존 관계만 수정한다. revoked_at이 있는 기존 관계는 보호 이력 조회만 허용하고 명령은 거절한다. 회수·재활성화·삭제/재생성은 이번 save의 의미가 아니며 revoked_at=null 자동 갱신을 하지 않는다.
- 기존 원문/SQL/최초 OWNER 생성은 보존한다. legacy member를 실제로 검증한 과거 명령의 결과로 소급하지 않는다. 시작 head의 이력 출처는 확인 가능한 생성 계보와 미확인 legacy를 구분하며 최초 기준의 동결·이후 불변 version+head CAS·receipt/audit 역완결을 같은 forward에서 정의한다.
- 제품 쓰기 전에 실제 적용 migration ID/최종 파일 checksum과 저장 계약을 확인한다. 미적용/불일치면 명시 NOT_CONNECTED로 거절하고 원 입력/명령을 보존한다. 메모리 provider를 제품 성공 경로로 노출하거나 자동 SQL 적용하지 않는다. 최종 SQL 고정 전 placeholder는 미완료이며 최종 검수에서 raw/Git artifact/hash를 대조한다.
- 동일 인증 transaction의 OWNER/current→최근 재인증→명시 정책/DENY/정확 승인·기한→현재 대상/관계→last OWNER·자기 승격→동일 Tx CAS/새 버전/영수증/감사를 연결한다. policy bootstrap 예외나 FN15 일반 grant로 관리 권한을 열지 않는다.
- project 직렬화와 member 고정 순서/control/policy/명령 잠금으로 동시 last OWNER 변경을 막는다. 다른 user 행 잠금의 교차 사용자 교착을 검토하고 미확정 결과를 자동 재호출하지 않는다. 현재 controller/관리 actor가 자격을 잃는 역할 변경은 거절하고 FN15 인계 뒤 처리한다. 현재 OWNER가 자기 OWNER 지위를 잃는 OWNER→HANDOFF_ELIGIBLE도 관리 권위 상실이므로 거절하며, 실제 handoff grant가 없는데 HE로만 바꿔 현재 제어를 잇지 않는다. 자동 회수·대체 OWNER 선택·새 grant 발급은 하지 않는다.
- 현재 참여자 변경과 새 one-time 승인 요청/결정/소비의 정확 target/version/payloadHash/current policy/requiredDecider·주체/client/gen·기한을 결박한다. 옛 승인을 새 세대·다른 명령에 재사용하지 않는다.
- 결과 불명은 동일 원 body/commandId를 보존해 보호 GET/정확 원 명령 재확인만 한다. 새 ID 자동 생성·행 rollback을 가장한 grant 회수·성공 추정은 없다.

## 5. 보호 조회와 화면 업무

- 현재 project의 OWNER/current·최근 재인증 관리 범위에서만 member 목록과 불변 version/history를 조회한다. 다른 사용자 계정의 profile/로그인명/이메일/자격증명은 반환하지 않는다. 일반 VIEWER/HE의 기존 자기 participation 조회는 보존한다.
- same-origin GET /api/v1/projects/:projectId/members?status=ACTIVE|REVOKED&limit=50&cursor=... 는 현재 head의 유한 목록이다. 기본 ACTIVE/50, 허용 limit1~200, 추가 query 거절이다. 본문은 memberRef·userId·participation·revokedAt·observedAt 등 최소 metadata이며 타 사용자 profile/긴 reason 본문을 포함하지 않는다.
- GET /members/:userId/versions/:version?contentHash=... 는 같은 project의 정확 불변 snapshot/ref·이유/출처 이력을 고정 조회한다. 추가 query와 다른 hash를 거절한다. GET /members/:userId/history?limit=50&cursor=... 는 같은 user의 metadata만 기본50/최대200으로 페이지 조회하고 긴 본문은 고정 상세에서만 읽는다.
- cursor는 기존 서명 codec 계약을 재사용해 actor/project/목록종류/userId/필터/limit에 결박한다. 목록은 안정된 joinedAt/userId, 이력은 기록시각/불변 eventId의 유일 tuple로 정렬·페이지 경계를 고정한다. version 동률/밀리초 동률이나 같은 userId 때문에 이력이 누락되지 않아야 한다. migration에서 관측한 legacy 시작 snapshot의 새 eventId를 원 작성 명령/과거 권한 부여의 증거로 위장하지 않는다. actor/project 전환·기한/권한 상실·타 project cursor를 거절한다.
- UI01의 기존 project 제어·준비 상태 영역에 참여권한 관리 패널을 연결한다. 명시 개방/조회 전 I/O0, 현재 project/client/control·재인증에 맞는 입력/별도 확인→정확 명령→저장 결과·현재/과거 이력 재조회가 한 흐름이어야 한다.
- 기존 사용자 식별코드 입력만 제공한다. 본인의 기존 session.user.id 표시/복사는 토큰/client/session ID를 노출하지 않는다. eligibility/profile 조회·전체 검색/자동완성은 없다.
- 정책이 없거나 DENY/재인증·제어·버전·대상 상태가 맞지 않으면 원인을 표시하고 저장하지 않는다. 미확인 응답은 입력·원 명령을 보존하며 project/auth 전환 때 타 project 결과와 혼합하지 않는다. 기능 수행 전 이미 공유된 자료의 사후 회수를 보장하지 않는다.

## 6. 한도·호환 경계

직접 승인 PROJECT_STORAGE_QUOTA_RESERVATION_APPROVAL_20261031.md와 원후보의 metadata 제외를 따른다. member version/history·공통 command/receipt/audit를 새 U/H·O·FN15 F에 자동 산입하거나 ARTIFACT 예약으로 위장하지 않는다. 이 기능에 새 quota 원장/cap·기존 coverage 승격을 선행으로 붙이지 않는다. 이는 물리 저장량이 무한히 안전하다는 주장과 다르다.

기존 OWNER-only/원문 격리·Secret 보호·archive 거절·다른 프로젝트 격리·정상 목록/승인/정책 동작을 보존한다. source rollback은 변경 경로의 정상 revert이며 실제 DB/회원 권한의 회수·복구 실행을 포함하지 않는다.

## 7. TDD·검수와 증거

- 실제 공통 명령/현재 관리 guard/저장·보호 조회·UI 호출선을 소비하는 행동 RED→GREEN을 확보한다. 구현 부재의 준비 RED와 제품 행동 RED/도구 오류를 분리한다.
- 정상 새 관계·역할 변경·이력/replay, 다른 project·VIEWER/HE·옛 client/gen·만료 재인증/정책/DENY·잘못된 ref/version/hash·자기 승격·회수된 관계의 새 등록/role 변경·자동 재활성화 거절·동시 last OWNER·현재 controller OWNER→HE 포함 자격 상실·승인 재사용·COMMIT UNKNOWN/원 명령 보존을 확인한다.
- 실제 PG 없이 메모리 transaction/CAS·명령/receipt/audit 및 DOM 모델로 구현을 검증한다. RLS/함수권한·직접 DML 우회/동시성의 실제 PG/사용자 인수는 NOT_RUN으로 남긴다. 문자열 존재 검사를 실제 SQL 집행으로 승격하지 않는다.
- 신규/직접 인접만 실행하고 변경 없는 기존 FN15/전체 회귀를 반복하지 않는다. 필요한 noEmit·diff·메모리 build/DOM을 선택하며 .env/실 Secret·DB/서비스·Agent를 읽거나 시작하지 않는다.
- Primary는 변경 파일/hash·정확 명령/exit/결과·오류 횟수/미완료/미검증/live handle·rollback을 반환한다. Main이 독립 spec/quality 검수·최종 지문 직접 검증·기존 승인 private branch checkpoint를 수행한다. 이 단위의 source 합격과 실제 사용 가능/전체 FN01·계획 완료를 구분한다.
## 8. 이번 직접 승인 원문 계약·실행 순서 r4

부모 준비본 r3 SHA256 6B65E112A7053EAD5F23229A61180F6E6217C6CCB225D68F6862AA145D7C3398. 직접 채택 후보는 docs/contracts/FN01_MEMBERSHIP_APPROVAL_SNAPSHOT_CANDIDATE_20261103.md SHA256 51292CA41A0A1C762104D6FF9890FF05A06DD4402DBAE6ABAB087045D48C1BE6이다. 후보 원문은 hash를 유지하며 별도 승인 사실을 이 절에 기록한다. PMO cursor15는 새 공개 API·데이터 상세를 직접 결정하라고 반환했고 신산님이 A안 계약·source-only 구현을 승인했다. 후보의 모든 exact 필드·보호·역사/현재·소비·불명 조건이 검수 기준이다. 다른 승인 계약을 묵시 확대하지 않는다.

- requestApproval의 해당 operation만 {details,candidatePayload}, 같은 member payload codec으로 검산한다. 원11키 ProjectCommand를 원 project/details·현재 인증 주체에서 재구성한다. 대상 user와 원 requester를 대체하지 않는다. candidate.command approvalRef:null/baselineRefs:[]·같은 candidateCommandId/client/control·targetId/version이다.
- 기존 request_json/불변 snapshot membershipCandidate에 purpose/schemaVersion/command/baseMembership을 함께 보관하고 같은 request ref/hash와 원 command 결과/receipt/audit를 같은 Tx로 검산한다. NEW의 원 부재, EXISTING의 원 immutable version/hash/role은 서버가 생산한다. 별도 candidate entity/table/GET URI를 추가하지 않는다.
- 역사 GET은 과거 원문과 당시 관계를 검산하며 현재 head로 바꾸거나 NEW의 현재 부재를 요구하지 않는다. 새 결정·소비·저장은 현재 관계/head·현재 OWNER/controller·재인증·명시정책/기한·lastOwner를 다시 검산한다. 일반 approval보다 넓은 VIEWER/HE 조회로 관리 원문이 새지 않게 한다.
- UI08은 서버 보관 원문에서 대상 ID·신규/당시 역할·새 역할·원 변경 이유를 표시하고 approval 요청/결정 이유와 구분한다. 기존 DTO에 이 연산 전용 exact 검산을 추가한다. 다른 operation의 exact키/hash·양식은 그대로다.
- UI01의 미전송 원 command와 보관 candidate 전체를 비교하고 정확 ApprovalRef만 연결한다. 결정만으로 저장하지 않으며 사용자의 명시 재개만 소비한다. UNKNOWN/SENDING/APPLIED command ID/body는 수정·교체·자동 POST하지 않는다. 이전 상태를 성공으로 추정하지 않는다.
- 수동 입력은 기존 사용자 ID만 허용한다. 다른 사용자 프로필 검색·가입·초대·가짜 옵션·정책 자동부여0. 현재 계정이 대상 계정을 가장하지 않는다.

시작 절차: Main 문서/준비자료와 보호3을 제외한 product tracked clean·다른writer/live0, 위25 중 기존14/신규11·0074 미충돌, 후보51292와 본 WI 지문을 확인한다. ProjectsPage→ProjectListResults→ProjectAccessSummary의 실제 props 연결과 decisions DTO/UI를 사용한다. source-only 기존 파일14의 시작SHA를 반환하고 새로운 경로가 필요하면 정확 근거만 Main에 요청한다. 자동심사 거절 시 해당 action/hash/이유를 보존하고 우회·분할·반복 재시도하지 않는다.

구현 순서: (1) runtime codec/명령·보호 조회·승인 원문 왕복의 행동 RED, (2) member 불변버전/현재head·원자성/권한경계의 미적용0074와 메모리 저장, (3) 현재 repository/route/원 approval 소비 연결, (4) UI01 관리·현재/과거 조회와 UI08 저장 원문 표시·명시 복귀, (5) 중요한 음성/COMMIT UNKNOWN·다른 operation 인접 회귀, (6) 필요한 type/구문·직접시험·scoped diff·SQL LF/rawchecksum/NOT_CONNECTED 검수 후 writer 반환. 경로별 작은 내부 commit은 Main이 검수 뒤 기존 branch에 통합한다. broad 전체회귀 반복0이며 실제 PG/RLS/race/browser/사용자인수는 실행하지 않았다면 NOT_RUN이다.

보존·인수: FN15 기본 source5와 UI2·26PASS는 불변 부분을 다시 구현하지 않는다. source와 canonical의 이전 현황 차이를 덮어쓰지 않는다. Main은 문서·검수·Git만, 같은 Primary는 정확25코드/시험 단일writer다. FN15 import/선택의 읽기설계는 완료됐으나 제품 수정 전이므로 동시writer 없이 후순위 잔여로 남긴다. 이 업무를 완료해도 전체 FN01/FN15/Stage/작업계획 완료를 주장하지 않는다.