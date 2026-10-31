# FN13 과거 중지 요청 페이지 조회 A — 구현 WI

상태 MAIN_GO / DIRECT_HUMAN_APPROVED. 기준 codex/av3-stage-b / 8f58ecc877991bfb67dca92952aa09f169ff3582. 직접승인 FN13_STOP_REQUEST_PAGES_SOURCE_DIRECT_APPROVAL_20261031.md SHA0A4A24FE47927E4ECB658460F576772CD11C9A1E8C6A3FE1151290CFDF948306 → 후보 B1ACDCD495DC7F1F582A49620E3456A06540729A218DA57657522219A4DE6FBC A안. 이 통제 문서 commit 후 실제 시작 HEAD를 기록한다. 기존 Primary 단일 코드 writer, Main 관리·검수·통합 및 문서만, 기존 Reviewer 읽기 전용이다.

## 정확 8경로

기존5와 시작 SHA256:
1. apps/server/modules/checkpoints/project-stop-request-history.ts / A099D1E56C48125DBB232B3413C4CB19B7A72D40D3F013F2F5F657C750ED95F0
2. apps/server/modules/projects/routes.ts / CCFE3AB016C092E3050F9F5A73233280B64474300C00B8F7E924DDD0CE8CFF1E
3. apps/web/src/features/session-detail/stop-request-history-api.ts / C670B81E1F19C2AA1D95ADB28F33929F916B2FB1B6EB958973E25EC9CCCDBB45
4. apps/web/src/features/session-detail/StoredStopRequests.tsx / 1615F03857A8E243C2CB16F3D9617BC3B3D4D6156722A5BCCA9ABEC9FB30FD64
5. apps/web/src/features/session-detail/SessionDetailPage.tsx / F28C47D90C681F06863F51D32A35D166FA47D2C494F87CD40E6AB9D6BEA7B1BB
신규3:
6. tests/unit/FN13/stop-request-pages.test.ts
7. tests/unit/UI05/stop-request-pages-api.test.ts
8. tests/unit/UI05/stop-request-pages.test.ts

Primary는 지문·신규3 부재를 확인했다. 쓰기 전 충돌만 재확인하고 전수 탐색은 반복하지 않는다. 꼭 필요한 추가 기존 fixture/시험 경로는 사유·기준 hash와 함께 Main에 먼저 보고한다. 관련 없는 코드·기준 완화·새 dependency/전역CSS·공통화/재설계0. 보호3·원복구본·기존 SQL/원문·기존 정상 기능을 보존한다.

## 서버·공개 읽기 계약

- 기존 read()/GET /api/v1/projects/:projectId/results/:id/stop-requests/정확 응답·query거절·caller는 보존한다. 새 GET /api/v1/projects/:projectId/results/:id/stop-request-pages와 새 내부 page 접점만 추가한다. query는 빈 최초 또는 비어 있지 않은 cursor 한 키만, 고정20건·metadata21건. raw 알 수 없는 query를 schema coercion/removal로 허용하지 않는다. HUMAN cookie/current member·same-origin/host·Bearer 거절 등 기존 읽기 규칙을 같은 route에 적용한다. listener/실DB 생성0이다.
- signer는 기존 AccessRepository.signProjectCursor만 참조하며 실제 키를 생성·조회·변경하지 않는다. cursor payload 정확8키: schemaVersion(1),purpose(RESULT_STOP_REQUEST_PAGE_V1),bindingHash,snapshotUpper,snapshotMaxAuditSequence,before,issuedAt,expiresAt. canonical encoding·전용 namespace·서명/정확키/길이·유효기간·참조를 검산한다. 실제 함수 형식과 기존 검증 관례를 따르며 새 범용 cursor framework는 만들지 않는다.
- bindingHash는 현재 actor.user/client/session.id/credentialGeneration·project·result fullref/execution fullref를 canonical로 결박한다. 현재 authSession 없는 주체는 성공시키지 않는다. 발급 당시 DB 시각부터 최대30분과 당시 세션 idle/absolute 만료의 최소를 고정하며 이동/재조회로 연장0. 매 페이지 현재 로그인/프로젝트 조회권한과 같은 주체/session/client를 다시 검사한다. 조회자와 과거 요청 작성자의 client가 다르다는 이유나 원 요청 전달기한 만료로 과거 조회를 거절하지 않는다. controller/owner 요구를 새로 만들지 않는다.
- snapshotUpper={ref,requestedAt}|null, before={requestedAt,id}|null. 최초에 원 requestedAt 문자열/UUID tuple의 상한 fullref와 당시 프로젝트 감사순번 상한을 고정한다. 비어 있지 않은 감사순번은1..MAX_SAFE_INTEGER, 첫 before=null로 정확 MAX_SAFE 값도 누락하지 않는다. 빈 최초 upper=null/감사0/items[]/hasMore false/nextCursor null이며 이후 append를 섞지 않는다. 비정상 정수·정렬·참조/중복/반쪽 proof는503으로 닫는다.
- 원 sources.read()/readStoredSyntheticStopCommand를 소비해 정확 제출/실행 fullref·합성 transport와 상한·표시20건의 원명령/receipt/audit/HELD outbox를 대조한다. 원행은 있으나 JOIN/proof 누락으로 목록에서 사라지는 우회0, audit순번 상한을 이유로 손상 항목을 조용히 skip하지 않는다. tuple+감사순번으로 이후 append를 제외하되 완전한 DB snapshot이라고 주장하지 않는다. 전체 원문 JSON materialization0, 상한/표시분만 유한 수거한다. JS Date 재포맷을 cursor 정렬 위치로 사용하지 않는다.
- 페이지 DTO는 기존 read응답의 contentHash 제외 기본 필드를 유지하고 pageCursor,nextCursor,snapshotUpper,snapshotMaxAuditSequence,before,cursorIssuedAt,cursorExpiresAt 정확7필드만 추가한 뒤 전체 canonical contentHash를 계산한다. pageCursor는 현재 before의 보호 재조회, nextCursor는 hasMore일 때 마지막 표시 tuple이며 없으면null이다. old DTO decoder는 그대로 두고 새 decoder를 분리한다. 권위 flags false/중지·회수 미관측/SYNTHETIC_ONLY 의미는 불변이다.
- 단일 페이지는 DB 관측 시각과 monotonic 유한 처리예산 최대30초 및 현재 세션/권한·cursor 잔여기한 안에서 반환한다. cursor의30분 탐색수명과 요청 처리기한·과거 전달30초를 혼동하지 않는다. 기다림 뒤 만료/현재 권한 회수·불명/손상을 성공으로 만들지 않는다. 잘못된 query/cursor400, 현재 auth/조회보호401/403/404, 무결성 RESULT_STOP_HISTORY_INVALID/503·2MiB RESULT_STOP_HISTORY_LIMIT/412는 기존 의미를 보존한다.

## UI05 연결

- SessionDetailPage는 기존 criteria.session의 현재 조회자 user/client/CSRF 문맥만 자식에 전달한다. 외부 등록/정책·명령을 새로 만들지 않는다. StoredStopRequests는 명시 첫 목록/다음/이전·동일 실패 대상 재시도/명시 새 목록을 제공하고 한 번에20건만 표시한다. 과거 캐시를 현재 보호 재조회처럼 표시하지 않는다. 이전/다음 history는 성공 뒤에만 push/pop, 실패는 대상 cursor와 방향을 보존한다. 자동 GET/POST/새 cursor 발급·자동 재시도0이다.
- 빈 목록/끝/기한 만료/부정확 cursor/거절/손상을 구분하고 요청 중 옛 본문을 숨긴다. fullref/정렬·정수/기한/상한/false flags·2MiB·전체 hash와 cursor 일관성 검산 후에만 표시한다. 실제 중지/전달/회수·현재 실행 허가가 아님을 유지한다.
- 문맥은 project/result fullref/execution fullref·현재 user/client/CSRF와 실제 client/transport를 포착한다. 관측 ABA·늦은 JSON/native hash·401·이탈/세션전환 뒤 옛 응답·본문을 버리고 현재401만 상위 auth callback을 호출한다. 입력·다른 기능의 command buffer를 건드리지 않는다. 기존 Operate/12px·승인된 화면 양식 유지, craft-floor를 UI 쓰기 직전에 읽고 기존 impeccable context는 재init/재작성0, 변경UI2 target detect만 수행한다.

## TDD·검수·제출

1. 실제 class/원 reader와 같은 메모리 원장으로 첫20→21번째/이전왕복·동률시각·빈목록·MAX_SAFE 경계를 RED→GREEN. 부모 제출/실행 provider 대역은 명시한다. append·기존 요청 만료·조회자 다른 client 정상과 cursor의 다른현재 user/client/session/result/namespace·변조/기한연장·늦은 추가/손상proof 거절, 매 await/현재 보호와 최종 처리 만료 반례를 확인한다.
2. 실제 Fastify.inject로 GET 새/기존 경로·query거절/선택접점·host/auth를 메모리로 검증한다. 정적 문자열만으로 HTTP 연결 PASS를 대신하지 않는다. SQL/실PG/프로세스/listener0. 기존 최근20 reader와 decoder 직접인접 회귀만 선택하며 FN09 등 불변 완료검사 반복0이다.
3. 실제 React/API/decoder/native hash 메모리 DOM으로 명시 다음/이전/실패후 동일cursor/성공뒤history·새목록/빈/끝·late JSON/hash/transport/주체·401을 검증한다. native 입력/실브라우저/실PG 증거가 아님을 구분한다. 글로벌·MessageChannel·mock/prototype·앱은 finally 원복하고 handle0 확인한다.
4. type/noEmit·메모리 Web build(write:false/envDir:false)·UI detect·diff/staged check·원형/보호3 hash를 확인한다. 기존시험을 삭제/기대완화/skip하여 통과0. 정확 명령/exit/REDGREEN·오류횟수/수정범위/최종hash·NOT_RUN·rollback을 제출하고 writer를 반환한다. Main fresh 검증·독립 C/I0 뒤 소유경로만 기존 private branch 통합한다. 새 branch/worktree/chat/자동화·main병합/실서비스 반영0이다.

실제 DB·권한·키·사용자파일 조사·서비스·Agent 실행·기존프로젝트 일반차단 해제는 모두 제외한다. 새 SQL/table/쓰기 operation은 없다. 전체 FN13·작업계획·실제 사용자 인수 완료로 source/합성 합격을 승격하지 않는다.
