# FN17 in-app 승인 요청 알림 — 설계 선행 읽기 기록

상태: READ_ONLY_PREFLIGHT / NOT_ISSUED / NOT_ADOPTED. 구현·DDL·권한 결정을 발행하지 않는다. 기존 논리 FN17/INTERFACES §14.2·DATA_MODEL 및 UI13/설계 §11.14~15의 상세 저장/권한 공백을 조사한 기록이다. 현재 CapabilityReport R2의 기존 채택 질문과 별개이며 새 질문을 발행하지 않는다.

## 기존 구현·재사용 가능한 사실

- browser-push-support.ts/BrowserPushSupportPanel은 지원 상태 관측만 이미 구현됐다. 권한 요청·구독·알림 저장/조회·실제 전송은 구현되지 않았으며 관측 화면을 다시 개발하지 않는다.
- 기존 ProjectApprovals.request의 성공 사건은 APPROVAL_REQUESTED, requestRef={id,version:1,contentHash:hash(snapshot)}다. requiredDecider는 현재 {kind:HUMAN,userId:actor.actorId}이므로 첫 좁은 시나리오는 요청자 본인에게 보관하는 in-app 알림이다. 다른 담당자/Agent에게 전달되는 것으로 꾸미지 않는다.
- 서버 commands.id와 caller commandId는 다르다. 원 서버 receipt.id·정확 원 requestRef·requiredDecider를 결박하고 임의 사용자 입력의 event/recipient/URL을 받지 않는 안을 검토할 수 있다.
- 기존 requestApproval transaction 성공 경로에서 원 알림을 함께 보관하는 경우, 알림 저장 실패가 승인 요청도 rollback시키는 새 원자성 조건이 된다. 채택 전 조용히 추가하지 않는다. replay는 domain callback 전에 반환하므로 새 알림 발행/옛 요청의 자동 backfill을 하지 않는 범위가 좁다.

## 정확 선행과 남은 계약

- 원 approval_requests의 mutable version/status는 결정·소비에서 바뀐다. 알림의 원 v1/hash를 현재 row.version=1 FK로 만들면 안 된다. 실제 UNIQUE(project_id,id)를 FK로 사용하고 원 request_json/content_hash를 별도로 대조해야 한다.
- recipientRef는 원 requiredDecider, authenticatedTarget는 {projectId,approvalRequestId}로 묶는 안이 가능하다. 이는 아직 확정 DTO가 아니다. 기존 approvalRequestHref/모바일 동선을 소비하며 링크 클릭을 승인/제어 인수로 만들지 않는다. 승인 reason/risks·원문을 알림 본문에 복사하지 않고 비밀 없는 고정 안내만 쓰는 범위를 검토한다.
- 본인+현재 회원 GET/목록과 본인+현재 회원/CSRF 읽음 변경은 서로 구분할 새 접근 계약이다. 제어기기 변경과 읽기/자기 읽음의 관계, commandId/replay·최초 readAt 보존·중복/동시성은 아직 확정되지 않았다. ProjectCommand의 OWNER/current-control 또는 auth_actions를 가짜로 재사용하지 않는다.
- 현재 회원 회수/타project/미존재는 기존 projectMember의404를 소비할 수 있다. 세션은 기존 AccessRepository.authenticated의 사용자/client·회수/credentialGeneration·idle/absolute 검사다. 알림 수신/읽음은 decideApproval의 requiredDecider/client/controlGeneration을 해제하지 않는다.
- 원사건+수신자+in-app channel의 중복 키, 정확 PK/FK·불변 사건/읽음 이력·앱 역할 신규 권한, severity/channel/delivery enum, 본문/보존/발송 한도와 오류는 결정용 상세화 대상이다. 실제 선행은 approval_requests UNIQUE(project_id,id),commands UNIQUE(project_id,id),users,project_members,clients다.
- TD-03의 목록 기본50/최대200·주체/project/filter/order 서명 cursor는 공통 선행이다. 새 알림 filter/order/커서 수명은 명시해야 한다. 공통 기록64KiB/batch1MiB를 알림 payload·retry/TTL/빈도로 자동 전용하지 않는다.

## 향후 가장 좁은 후보와 제외

서버의 실제 requestApproval 성공→정확 requiredDecider 본인 in-app 보관→프로젝트 본인 목록/고정 조회→명시 읽음의 계약부터 구체화할 수 있다. 사용자 직접 알림 발행·가짜 완료/오류 사건·자동 승인/제어권·push/SMTP/구독·설정 저장·provider/credential/실제 전송/비용·실DB는 그 범위가 아니다. 이것은 완성된 FN17 기능이 아니며 나머지 알림 종류·설정·전달은 미구현으로 남는다.

FILE_MAP의0017_notifications.sql은 과거 계획명이다. 현재0017 실행권한 SQL을 바꾸거나 빈 번호를 예약하지 않는다. 정확 계약/개인 읽음 권한/불변·멱등 저장과 신규 권한·한도 채택 전 generic repository·제품/SQL을 만들지 않는다.

실제 근거: project-approvals.ts:16~26/46~70/97~107,project-command.ts:123~134,projects/service.ts:18~37,0011_authorization.sql:17~39,0001_projects_access.sql:9~12/73. 이번 작업은 읽기·설계 선행 기록만이며 코드/테스트/DB·서비스/권한/Agent·자원 변경0이다.
