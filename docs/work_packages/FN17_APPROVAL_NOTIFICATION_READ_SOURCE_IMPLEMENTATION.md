# FN17 승인 요청 알림 조회·표준 읽음 서버 소스 구현 계획

> 수행자는 superpowers:subagent-driven-development와 TDD로 단일 writer 구현·독립 scoped 검수 순서를 따른다.

## 목표·기준

기존 계획에 명시된 notifications 목록/고정 조회 및 markNotificationRead를 서버의 실제 라우트·현재 인증/회원/제어/정책·영수증/감사와 연결한다. 실제 DB/served/사용가능 완료는 별개다. 기반 branch codex/av3-stage-b / checkpoint672af50cea3eb6c4de32fc9f959bb9bfd6b67f97.

권위는 승인된 WORK_PLAN FN17/FUNCTION_WORK FN17, INTERFACES 공개명령표·GET collection·§14.2, DATA_MODEL notifications다. 상세 후보 FN17_IN_APP_APPROVAL_NOTIFICATION_CONTRACT_CANDIDATE.md r2/6DA759BF26ABA4DE3D9E221372EF11FF4BFF5AED6ED499F8EEEA06A93F5368A1의 기존9필드 정형화·GET/list·표준 mark·현재회원/본인·최초readAt에 한정해 참조한다. 후보 전체는 미채택이며 원 requestApproval 알림생성/원자 rollback/10000행상한을 이 업무로 채택하지 않는다.

Ruling: 이 범위는 기존 명시 GET notifications/markNotificationRead를 구현하는 내부 상세화다. 새로운 개인 PUT/권한 예외·원 승인 요청의 실패 의미를 만들지 않는다. 현재 정책 미설정/불허면 거절하고 실제 사용자 정책을 부여하지 않는다. 데이터 원본/공개 기존 응답은 보존한다. 새 영속표의 실제 적용·권한/스키마 결정은 별도며 이 업무는 SQL을 작성·적용하지 않는다.

스택은 기존 Node/TypeScript/Fastify/pg·기존 canonicalJson/VersionRef/ProjectListCodec다. 새 의존성/도구/서비스·로그인 우회0. 전체 FN17/FN10/FN11/FN12·Stage E 선행 완료를 선언하지 않으며 실제 존재하는 APPROVAL_REQUESTED 원본만 읽는 부분 구현이다.

## 정확 허용 경로

- 신규 apps/server/modules/notifications/notification-input.ts: strict 고정 Notification/원참조/mark 입력·core canonical hash.
- 신규 apps/server/modules/notifications/project-notifications.ts: 같은 AccessRepository의 현재회원+본인 GET/list와 원승인 무결성 대조·표준 mark callback/최초읽음 조회저장.
- 기존 apps/server/modules/access/project-command.ts: 예정 markNotificationRead operation 허용목록/이 연산의 미연결 REQUIRE_APPROVAL 거절만. 다른권한 변경0.
- 기존 apps/server/modules/projects/routes.ts: 예정 GET notifications/list·고정 GET·표준 commands 분기/명시 주입. 기존 handler 재작성0.
- 신규 tests/unit/FN17/notification-input.test.ts
- 신규 tests/unit/FN17/project-notifications.test.ts
- 신규 tests/unit/FN17/notification-routes.test.ts
- 필요 최소 신규 tests/unit/FN17/notification-fixture.ts: fake DB/기존 인증 fixture 명시 시험 전용.

정확 경로는 착수 전 실제 목록에서 충돌 확인. 제품/UI/SQL/기존시험/다른문서 수정0. Main의 WORK_STATUS 및 보호 untracked8 보존. 새 branch/worktree·commit/push/PR·DB/서비스/Agent/Secret/권한 변경0.

## 동작·실패 경계

1. DTO는 후보의 기존9필드이며 APPROVAL_REQUESTED/본인 IN_APP 한 종류만 지원한다. 원 request snapshot/ref1/hash·서버 commands.id·현재 approval mutable version2/3을 구분한다. 원 reason/risks/details/token/URL을 반환하지 않는다. id/version/hash 형식·canonical 해시·현재 프로젝트·recipient 대조를 먼저 한다.
2. GET/list는 현재 유효 HUMAN 세션/동일host·기존 Origin/Bearer 정책과 현재회원·수신자 본인만 허용, 제어권 없는 현재회원의 본인 이력은 조회 가능하다. 타인/타프로젝트/회수/미존재404, 무결성503, 잘못된query400, 200빈목록은 허가된 실제빈목록에서만. page 기본50/최대200·서명cursor는 기존표준codec를 소비하고 목적/project/actor/filter/limit를 결박한다. GET는 읽음을 변경하지 않는다.
3. mark는 기존 ProjectCommand envelope/OWNER/current controller/client/generation·현재명시AUTO정책/CSRF/replay를 모두 거친다. targetId/expectedVersion1/payload.notificationRef exact, baselineRefs[]/approvalRef null. REQUIRE_APPROVAL는 명시 미연결412이며 임의 일회승인을 만들지 않는다.
4. 최초 읽음 readAt/서버receipt 결박을 같은 transaction에 저장하고 기존 persistProjectReceipt·감사를 소비한다. 기존 project/member/control 잠금 아래 최초조회/INSERT를 직렬화하고 notification FOR UPDATE/새 UPDATE권한은 쓰지 않는다. 같은command replay callback0, 다른command 같은알림은 최초readAt 유지·새표준receipt만, 변조ref409. 현재세션·회원/제어·정책 만료/회수는 기존helper와 최종반환 시각을 대조해 fail-closed한다. 공통helper 재설계가 필요하면 Main에 먼저 근거 보고한다.
5. 기존 requestApproval의 publisher/hook/생성/응답과 다른도메인은 변경0. production에 fake DB/가짜 알림을 넣지 않는다. 새 저장 표가 미적용이거나 provider미설정이면 명시503 NOT_READY/정상적인기존오류매핑, 빈성공으로위장0. 시험에만 명시 fake DB/신규알림 자료를 주입한다. source-only SQL/실DB/실PG 권한/원자경쟁 증거는 이번범위 밖이다.

## 검수 초점

- 승인 version2/3 뒤 원 사건v1/hash 조회, 현재상태를 과거사건으로 대체하지 않음.
- 본인·회원·제어기기·CSRF·현재정책·타인누출 차단, source integrity 실패를 빈목록으로 바꾸지 않음.
- 같은mark replay/상이commandId·타target/최초readAt·새receipt/감사 및 storage 실패 rollback.
- 서명cursor의 actor/project/filter/limit·동률 정렬·만료·잘못된query와 실제빈목록 구분.
- 기존 승인 요청 경로를 바꾸지 않으며 새 실제 DB/publisher가 없음을 미완료로 드러냄.

## 수행 순서와 증거

- [ ] 기존 같은 패턴과 위 source 4경로의 실제 호출·테스트 command를 대조한다. 새 공개endpoint/필드·권한 예외가 필요하면 구현 전에 Main에게 보고한다.
- [ ] 입력·정상/음성 unit·fake DB transaction·route 미구현 RED를 먼저 실행하고 raw 실패를 기록한다. fixture/test setup 실패는 기능 RED와 구분한다.
- [ ] 허용 source를 최소 구현해 같은 반례 GREEN, 직접 인접 승인·정책·목록 회귀 및 typecheck를 선택 실행한다. 신규기대 완화/기존시험 삭제·전체전수 반복0.
- [ ] Main에 정확변경파일/hash·before/after·명령/exit/개수·오류/미실행·새자원 여부와 소유권 해제를 보고한다. 독립 검수 후 Main이 통합한다.

임시 설치·파일 QA가 필요하면 Main의 이름/owner/수명/정리 사전등록 전에는 만들지 않는다. 메모리 fake DB·기존 unit runner는 새 PG/HTTP listener/OS native 실행이 아니다. 실제 브라우저·DB·서비스·권한·사용자 인수는 NOT_RUN으로 남긴다. rollback은 해당 source checkpoint 일반 revert이며 데이터/SQL/권한 삭제0이다.