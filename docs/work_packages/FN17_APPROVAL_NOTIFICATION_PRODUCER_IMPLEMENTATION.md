# FN17 승인 요청 본인 in-app 알림 생산자 구현 준비

## 승인·현재 소유권

직접승인 call_95ad36ce82b64af7925dc9282b12f3e0/item0 ‘A안 동작·source-only 구현 승인’, 승인기록 D2DCD9B8F8772EAB6789EBEF5855303AE3F05BD04F1B3D572A261A89B835F03D·결정안 BAA454FCA8C900DF0A44F704190BBC808D05B5F54ED1602CA49F3D9A4A2A3709·원 후보 041B1AC3E210D210C157AE2936DFD7241162AFC7897F8DF91F2509C6071CCF1D만 소비한다. 새 설계 질문이나 권한 확대가 아니다.

기준은 Main이 전달한 a2ff8802ad648445b8c0869535efebb428dbf349 및 manifest의 실제 raw다. 이 작성자는 Git을 실행하지 않았다. 정본 D:/Project/Anvil과 등록 source C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil의 문서2만 동일 보존한다. 현재 단일 제품 writer는 FN03 담당이며 FN17 제품/시험/SQL 쓰기0이다. Main이 FN03 종료·현재 HEAD/dirty·보호12를 다시 확인하고 이 WI를 배정하기 전 TEST_ONLY도 시작하지 않는다. 새 branch/worktree/commit/push는 수행자가 만들지 않는다.

## 정확 허용9

| 구분 | 경로 |
|---|---|
| 기존 제품 | apps/server/modules/approvals/project-approvals.ts |
| 기존 제품 | apps/server/modules/notifications/project-notifications.ts |
| 신규 제품 | apps/server/modules/notifications/approval-notification-producer.ts |
| 신규 미적용 SQL source | db/migrations/0052_approval_in_app_notifications.sql.pending |
| 신규 집중 시험 | tests/unit/FN17/approval-notification-producer.test.ts |
| 신규 집중 시험 | tests/unit/FN17/approval-notification-request-transaction.test.ts |
| 신규 집중 시험 | tests/unit/FN17/approval-notification-reader-operations.test.ts |
| 신규 SQL 정적 시험 | tests/unit/FN17/approval-notification-sql.test.ts |
| 신규 결과 | docs/04_test_reports/AV3/FN17_APPROVAL_NOTIFICATION_PRODUCER_RESULT.md |

원 raw는 기존2 각각 98AC59FC1241BDB0A2E6208E5AC83D1827B464DDB6FEA5BE6BDBCFF3EF8E0002 / 32639105513E2CAE58FB0D1EFDE8C8B982397664BA3D9C2131933E835E6A9966이다. 신규7은 작성 직전 부재 확인했다. 현재 SQL/.pending 실제 목록 최대0051·0052 미사용이며 알림 저장표 정의는 없다. 0052는 미래 단일 writer GO 때 재확인할 경로 후보이며 지금 SQL 파일 생성/번호 예약은 아니다. 선점/충돌이면 수정 전 Main에 보고하고 임의 번호 우회0.

FN03 제품 design-trace/api.ts·DocumentsPage.tsx와 그 시험/문서는 허용하지 않는다. 기존 SQL·migration 적용 목록·기존 시험/fixture·notification-input·Web/UI/정책·설정·의존성은 모두 읽기 보존이다. 보호12와 기존 completed code를 수정하지 않는다. 새 허용파일이 꼭 필요하면 수정 전 Main이 근거·경계를 고정한다.

## 정확 동작

1. 기존 ProjectPolicyRepository.command의 인증/session·CSRF→OWNER/current controller·project/member/control 잠금→현재 정책→projectReplay→domain callback 순서를 유지한다. 신규 requestApproval 성공 callback에서 원 receipt/request와 필요한 activation/plan candidate capture를 저장한 뒤, 반환 전에 내부 producer를 같은 caller transaction으로 연결한다. 별도 연결/COMMIT/outbox/public publish API0. 기존 replay는 callback을 호출하지 않아 알림 생성0, GET/mark/backfill 생산0이다.
2. source command는 receipt.id(commands.id)이며 caller commandId와 구별한다. 원 requestRef v1/hash·server timestamp·project·requiredDecider/requestedBy 본인 HUMAN을 원 snapshot/원본 열에서 대조한다. 원 승인 이유/위험/본문·token·URL을 복제하지 않는다. notification-input의 기존9필드·APPROVAL_REQUESTED/IN_APP/ACTION_REQUIRED/STORED_IN_APP·readAt null·불변 본체 v1/hash를 소비한다. 공개 DTO와 requestApproval receipt 응답은 변경하지 않는다.
3. 기존 동일 project 잠금 아래 누적 notification 행 수를 검사한다. 9,999→10,000은 한 행 저장 가능, 10,000 이후 신규 요청은429 NOTIFICATION_CAPACITY_EXCEEDED로 원 receipt/request/capture/알림 전체 commit0이다. 저장/guard 실패도 같은 원자 rollback이다. 자동삭제OFF·보존기간미정으로 상한 뒤 새 승인 요청은 계속 거절될 수 있다. 기존 replay/GET/mark는 유지하며 자동정리/상한상향/보존개정/새 cap 값0, 신규 요청 복구는 별도 결정이다. 오류 원문·SQL·stack·승인 세부사항 노출0.
4. 기존 reader의 readApprovalDetails 허용 목록을 현재 requestApproval 실제 consumableOperations와 정확히 맞춘다. 현재 빠진11은 defineProjectRole, bindResponsibleSession, applyLimitPolicy, revokeLimitPolicy, startStage, buildTaskContext, saveBaselineDraft, reviewBaselineContent, confirmBaseline, exportProject, activateDesignChange다. 기존 candidate/trust/upload/detach/work-plan 지원을 보존하며 실제 미지원 operation을 새로 승인하지 않는다. 필요 시 기존 project-approvals의 지원 목록을 export하여 두 기존 파일에서 동일 기준을 소비하되 import cycle 여부를 검수한다. 미지원/타주체/변조는 계속 거절한다.
5. 새 pending SQL 안에서 notifications 불변 본체 및 notification_reads 최초 읽음만 정의한다. 후보§7의 composite PK/FK·원사건/recipient/channel 중복방지·정확 원 command/request/receipt/audit/current GUC 결박·자기 행 RLS·UPDATE/DELETE 불변·app 최소 SELECT/필요 INSERT를 구현한다. notification 행 FOR UPDATE/새 UPDATE 권한 없이 기존 project 잠금과 read PK로 최초 읽음을 직렬화한다. FK/guard는 결정·소비 후 현재 approval v2/v3가 되어도 원 request_json/receipt v1/hash와 알림을 검증할 수 있어야 한다. 알림 보관을 승인 가능성·발송·사용자 확인으로 승격하지 않는다.

## 직접 읽은 기존 계약 위치와 미확인

- db/migrations/0001_projects_access.sql: users(id), clients(user_id,id) UNIQUE 및 project_members(project_id,user_id) PK(73~78행). 임의 recipient나 다른 project의 FK를 만들지 않는다.
- db/migrations/0011_authorization.sql: commands의 UNIQUE(project_id,id), approval_requests의 UNIQUE(project_id,id), authorization_receipts의 command FK/지연 결박과 audit_events 원 command FK. 기존 DDL 파일은 변경하지 않는다.
- db/migrations/0011_one_time_approval_requests.sql: guard_one_time_approval_request 9~42행은 원 request_json/result_ref·v1/hash·created_at·원 receipt/주체/제어/정책을 결박한다. 최초 upload 전용 함수 원문만 현재 전체지원이라고 보지 않고 후속 forward들(0033/0035/0044~0050 포함)의 최종 source도 함께 대조한다. 기존 함수/SQL의 지원 경계를 FN17을 이유로 넓히지 않는다.
- access/project-command.ts: projectMember/currentProjectController 54~66행의 project/member 및 project_control 잠금, currentPolicy의 FOR SHARE, persistProjectReceipt 104~117행의 commands→authorization_receipts→audit→transaction-local anvil.actor_id/client_id/command_id GUC. 반환 id가 알림 source_command_id/read command_id의 서버 ID다. ProjectPolicyRepository.command의 replay 선행을 유지한다.
- access/repository.ts: transaction 72~73행 BEGIN/COMMIT, 오류 ROLLBACK. 내부 producer는 이 transaction을 재사용하고 자체 commit을 하지 않는다. project-approvals.ts request 54~77행의 receipt/request/capture와 notifications/notification-input.ts·project-notifications.ts의 원본/읽음 검증을 실제 소비한다.

cap은 본인 RLS에 보이는 행 수가 아니라 동일 프로젝트의 모든 수신자 알림 행 수를 검사해야 한다. 자기 행 SELECT만으로 전체 cap을 계산해 과소집계하지 않는다. 전체 count가 필요한 최소 내부 SQL 함수는 0052 source 안의 고정 search_path·현재 GUC/원 command·project 잠금 검증과 함께 한정하고, 다른 수신자 행·건수를 공개 응답으로 반환하거나 app에 전역 SELECT를 부여하지 않는다. 구체 count/guard의 RLS·소유권 동작은 구현 전 source에서 확정할 미해결 사항이며 실제 DB 검증이 아니다.

현재 적용 DB/schema·최종 trigger/GUC 실효과·실권한/default privileges·실PG FK/DML/동시성은 미확인이다. source상 의존 함수(예: canonical JSON hash)의 정의/선행을 실제 파일에서 확인하고 없는 함수를 가정하지 않는다. 새 pending SQL은 기존 source가 제공하는 정확 함수만 사용하거나 자체 한정 정의를 포함하되 승인된 저장/guard 범위를 넓히지 않는다. 실제 세션·정책 만료가 잠금 대기 뒤에도 검사되는지 source/합성 반례로 확인하고 현재 helper만으로 미보장인 경우 이를 기록한다. 허용범위 밖 수정이 필요하면 Main에 정확 증거를 보고한다. 불명 사항을 PASS로 쓰거나 실제 환경 실험으로 해결하지 않는다.

## TEST_ONLY→Main RED→제품 GO

- Main 배정 후 신규 시험4만 작성한다. 제품2/신규producer/SQL source는 Main fresh RED 전0. 기존 시험 변경/삭제·skip/timeout 연장·넓은 assert.rejects로 예상외 예외 통과0.
- producer 시험: 고정 원 snapshot/receipt ID와 DTO/hash·민감정보 복사0·9,999/10,000/초과·유효성/오류 코드를 독립 기대값으로 대조한다.
- request transaction 시험: 실제 ProjectApprovals.request/공통 명령 소비선을 합성 DB transaction으로 호출하여 정상 알림1·동일 command replay/유실 재확인 추가0·실패 요청0·cap/INSERT/guard 실패 시 receipt/request/각 candidate capture 포함 rollback0을 관측한다. 동시 cap 경합은 기존 project lock 접점/순서·멱등을 합성으로 대조하며 실제 DB 잠금 증명이 아님을 명시한다. 새 알림에 필요한 SQL을 모르는 fixture는 명시 오류로 실패하게 하고 원문 구현값을 그대로 복제해 기대값으로 사용하지 않는다.
- reader 시험: 현재 지원 연산 전체 정상 원본을 실제 reader가 수용하고, 미지원 연산/다른 actor/project·조작 request/ref/hash·receipt/client/시각/recipient를 정확 AuthFailure/status/code로 거절하는지 검증한다. 기존GET/list/mark/최초readAt·공개형식은 유지한다.
- SQL 시험: table/FK/RLS·guard/최소권한·불변 source의 정확 조건을 정적으로 대조한다. 문자열 존재만으로 guard 의미정확/실PG compile·DML·RLS·GRANT PASS를 선언하지 않는다.
- Main fresh RED 및 독립 명세 뒤 같은 단일 writer 제품4 GO. 집중4/직접 FN17 notification-input·project-notifications·notification-routes 중 영향검사, FN11 approval-input/approval-list 및 capture 회귀 중 필요한 것과 type만 수행한다. 기존 완료 UI/브라우저·실제 DB를 다시 실행하지 않는다. 새로운 테스트파일/자원은 이 허용목록 밖에서 만들지 않는다.

직접 명령 후보:

    node --test --test-reporter=spec tests/unit/FN17/approval-notification-producer.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts tests/unit/FN17/approval-notification-reader-operations.test.ts tests/unit/FN17/approval-notification-sql.test.ts
    node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json

## 제외·제출

실DB접속/SQL실행/DDL/GRANT·migration적용목록·정책/계정/권한·서비스/배포·Secret/인증서·실Agent/비용·외부push/SMTP·새public API·과거backfill·임의알림사건0. 신규브라우저/PG/컨테이너/포트/임시QA자원생성0. code source 작성 승인과 실제실행허가를 분리한다.

결과는 exact명령/exit·원RED/fixture오류·변경전후diff/raw·집중/인접/type 범위·독립finding·보호12·미검증·rollback을 기록한다. source rollback은 이번 정확 변경을 일반 revert하고 기존자료를 보존하는 것으로, 실제DB 적용0이므로 데이터복구0이다. FN17전체/Stage/계획완료·실제알림/실DB사용가능으로 표시하지 않는다. COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED는 근거로 구분하며 Main만 통합/게시한다.
## r2 독립 preflight I1 — 읽기 전 인증 RLS 문맥

부모 WI SHA256은 9999C38C630F347A09F8F39FF42D85E83AD08DE52F0C45D89C7089766499C7B1, 부모 manifest SHA256은 13BAD0C0A779320BE6EDFD3018AE6B21021CB2D2C07A410FD9619D5447DF8547이다. 이 보완은 같은 허용9 안의 인증/RLS 실행 순서와 필수 반례를 명시한 내부 비의미 보강이며 승인·기능·권한 범위를 확대하지 않는다. 기존 raw/보호 baseline을 재설정하지 않는다.

직접 읽은 AccessRepository.authenticated(repository.ts:60~68)는 현재 session의 actor/client identity를 domain callback에 전달하지만 anvil.actor_id/client_id GUC를 설정하지 않는다. ProjectNotifications.read/list는 SELECT 전에 자체 GUC 설정이 없고, mark도 persistProjectReceipt 전에 this.read를 호출한다. 따라서 신규 자기행 RLS 도입 뒤 원 receipt가 남긴 GUC를 전제로 하면 별도 GET/list transaction과 최초 mark 조회가 본인 행을 숨기게 된다. producer는 이미 persistProjectReceipt의 transaction-local GUC 설정 뒤이므로 이 별도 읽기 순서 문제와 구분한다.

기존 FN05 선례 apps/server/modules/knowledge/project-knowledge-share-requests.ts:65~67,92~98을 직접 확인했다. authenticated callback의 actor.actorId/actor.clientId만 매개값으로 사용해 SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)를 먼저 수행한 뒤 보호 조회한다. 이 선례 파일은 읽기 참고이며 수정하지 않는다.

기존 허용파일 apps/server/modules/notifications/project-notifications.ts 안에서 현재 AuthenticatedIdentity로 transaction-local actor/client GUC를 준비하는 한정 접점을 두고, read/list 및 mark의 최초 notification SELECT 전에 호출한다. 순서는 기존 인증→현재 projectMember/권한 선행 유지→인증 actor/client GUC 설정→notification/notification_reads RLS SELECT→기존 원본/hash 검증이다. mark도 최초 this.read를 통해 같은 준비를 거치고 원 OWNER/controller/policy·최종기한·CSRF 검사는 유지한다. GUC는 actor/client만 설정하며 caller payload/query/userId·이전 transaction 문맥을 사용하지 않는다. anvil.command_id를 임의 설정하거나 receipt 발급을 가장하지 않는다. notification_reads INSERT의 command GUC는 기존 persistProjectReceipt가 실제 새 server receipt ID로 설정한 값을 사용한다. 세션 전역 SET·타인 조회 예외·RLS 완화·credential/권한 변경0이다.

필수 TEST_ONLY 보강은 신규 허용 시험 안에서 수행한다. producer 성공 transaction을 먼저 실행하지 않고 GUC가 비어 있거나 이전 actor/client 값인 각각 별도의 새 합성 authenticated transaction에서 본인 GET·list·최초 mark를 호출한다. fixture는 첫 RLS SELECT 전 현재 인증 actor/client의 local=true 설정을 요구하고, 없는 경우 행을 숨기거나 명시 실패하여 잘못된 순서를 잡아야 한다. 정상 결과와 설정→SELECT→원본검증→mark receipt/GUC→최초 읽음 INSERT 순서, actor 교체 시 이전 GUC 재사용0·타인/무회원404·caller입력 위조 거절을 관측한다. 기존 조회/mark 양성·최초 readAt·본체/hash 불변과 actual command GUC를 유지한다. 별도 transaction의 local GUC 소멸·실제 RLS 동작은 실제 PG 미실행으로 NOT_PROVEN이며 합성 순서 검증과 구분한다.
