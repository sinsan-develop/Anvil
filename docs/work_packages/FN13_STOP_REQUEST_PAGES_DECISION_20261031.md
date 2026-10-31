# FN13 보관 중지 요청 과거 페이지 조회 — 한정 결정안

상태 CANDIDATE / NOT_ADOPTED. 기존 계획 FN13·UI05의 미완료 조회이며 새 공개 읽기 계약은 결정 전 구현하지 않는다. 기준 codex/av3-stage-b / 7cda4b56cf34b0ae153e2dc2d482a5194b7871a5. 실제 DB·권한·키·사용자 파일 조사·서비스·Agent 실행·기존 프로젝트 일반 차단 해제는 제외한다.

## 실제 공백과 기존 동작

ProjectStopRequestHistory.read는 같은 제출의 정확 합성 실행에 보관된 STOP_REQUEST_STORED를 requestedAt DESC/id DESC로21개 조회해20개를 검산·반환한다. StoredStopRequests는 hasMore일 때 최근20건 이후를 미연결로 표시한다. 기존 GET /api/v1/projects/:projectId/results/:id/stop-requests는 query를 거절한다. 기존 원문 reader는 명령/영수증/감사/HELD outbox를 대조하며 실제 전달·정지·회수 관측이 아니다. 이 GET/DTO·기존 currentProtection과 원문은 보존한다.

## A안 권장: 읽기 전용 페이지 계약

- 새 GET /api/v1/projects/:projectId/results/:id/stop-request-pages. query는 cursor 한 개 또는 최초 빈 query만 허용한다. 고정20건·metadata 최대21개이며 사용자 가변 limit는 추가하지 않는다. 알 수 없는 키·빈/잘못된 cursor는 거절한다. 기존 GET은 변경하지 않는다.
- 별도 페이지 응답은 기존 항목·HISTORICAL_REFERENCE_ONLY 제출/실행 연결·SYNTHETIC_ONLY·SERVER_STORED_STOP_INTENTS_ONLY 및 중지/회수 미관측·모든 실행권위 false를 보존한다. pageCursor/nextCursor·고정 상한 ref/tuple/감사순번·발급/만료 시각을 명시한다. 원 응답처럼 전체 canonical hash를 반환하고 UI가 fullref/hash를 대조한다. DTO 세부 정본은 채택 후 같은 의미 안에서 WI에 고정한다.
- 최초 요청에서 정확 result/execution fullref, 최초 상한 요청의 fullref와 원 requestedAt 문자열/UUID tuple, 당시 감사순번 상한을 고정한다. 이후 append는 이 탐색에 섞지 않는다. 원문 reader로 상한과 표시 항목의 receipt/audit/HELD outbox를 검사하며 누락/중복/손상을 조용히 skip하지 않는다. 늦게 쓰인 자료를 포함하는 완전한 DB snapshot이라고 주장하지 않는다. JS Date 재포맷으로 cursor 정렬 위치를 만들지 않는다.
- cursor는 기존 서명 기능의 전용 namespace를 사용하고 현재 user/client/session/credentialGeneration·project·result/execution fullref·상한/정렬위치에 결박한다. 최초 발급 후 최대30분과 당시 현재 세션 idle/absolute 만료의 최소값을 고정하며 페이지 이동으로 연장하지 않는다. 이후 각 요청은 현재 로그인·프로젝트 조회 권한과 같은 cursor 주체를 다시 확인한다. 과거 요청 작성자의 client가 현재 조회자와 다르다는 이유나 과거 요청 전달 기한 만료를 조회 거절 사유로 삼지 않는다.
- 30분은 사람이 과거 이력을 읽는 cursor 수명이다. 현재 권한·세션 유효성 검사를 늦추거나 단일 요청의 기존 유한 처리·원문 보호를 연장하는 뜻이 아니다. 매 페이지 처리 중 만료/권한 회수는 성공으로 반환하지 않는다. cursor 만료 시 새 목록 조회를 명시하고 자동 발급/재조회·자동 command/POST는 없다.
- 첫 페이지에도 pageCursor를 반환해 이전/다음 왕복을 같은 고정 탐색의 보호 재조회로 수행한다. UI는 조회 성공 뒤에만 이력을 확정하고, 실패 시 동일 cursor 재시도 대상을 보존한다. 이전 페이지를 메모리 캐시만으로 현재 보호 조회처럼 표시하지 않는다. 요청 중 옛 본문 숨김, 빈 목록/끝/만료/403·손상과 권한부족 구분, mutable transport/관측 ABA/늦은 JSON·native hash/이탈 응답 폐기를 유지한다.
- 원문/명령/감사 이력은 삭제·변경하지 않는다. 새 table/SQL/migration/쓰기 operation/GRANT·실제 중지/전달·과금은 없다. 기존 프로젝트의 차단 해제도 없다.

## B안

기존 최근20건 조회만 유지하고 과거 페이지는 미구현으로 남긴다. A의 새 GET·페이지 DTO·cursor 수명/상한 의미만 이번 추가 결정 차이다. 기존 FN13 전체 또는 실제 실행을 승인해 달라는 요청이 아니다.

## 구현·검수 범위

채택 시 기존 Primary 한 명이 다음 기존5+신규시험3 안에서 source/UI·합성 검증을 수행하고 Main이 독립 검수·통합한다. 필수 추가 경로가 발견되면 사유와 영향만 먼저 보고한다.

1. apps/server/modules/checkpoints/project-stop-request-history.ts
2. apps/server/modules/projects/routes.ts
3. apps/web/src/features/session-detail/stop-request-history-api.ts
4. apps/web/src/features/session-detail/StoredStopRequests.tsx
5. apps/web/src/features/session-detail/SessionDetailPage.tsx — 기존 조회자 session 전달만
6. tests/unit/FN13/stop-request-pages.test.ts — 신규
7. tests/unit/UI05/stop-request-pages-api.test.ts — 신규
8. tests/unit/UI05/stop-request-pages.test.ts — 신규

필수 반례는21번째 접근/이전왕복·동률시각/빈목록·append 상한·다른client/session/result/namespace·변조/만료·원proof 누락/중복·401/403/404/손상·실패 history 미확정/동일 cursor 재시도·transport/ABA/늦은 JSON/hash 폐기다. 실제 제품 reader·Fastify.inject·React/decoder를 메모리로 소비하고 기존 목록의 직접 인접 시험·type·메모리 build·UI detect를 수행한다. 실제 PG/서비스/브라우저·중지/Agent 결과로 승격하지 않는다. 일회 프로세스·listener·DB 생성은 없다.

## 요청 결정

A의 공개 읽기 계약과 source-only 구현을 채택하거나 B 유지로 결정한다. PMO 위임 범위 밖이면 해당 정확 범위만 신산님께 전달할 지원을 요청한다. PMO의 다음 업무 배정을 기다리는 요청이 아니며 현재 승인 안의 독립 미완료 소비선 대조는 계속한다.
## 독립 검토 후 상세 고정

초안92B9C91E는 독립 C0/I0로 검토됐다. 빈 최초 목록은 고정 상한 null·감사순번0·items[]/hasMore false/nextCursor null로 표현하고 해당 탐색에 이후 append를 섞지 않는다. 비어 있지 않은 상한 감사순번은 양의 안전정수이며 MAX_SAFE_INTEGER 초과/비정상 값은 무결성 오류로 닫는다. 기존 2MiB 상한·RESULT_STOP_HISTORY_LIMIT/412와 RESULT_STOP_HISTORY_INVALID/503의 의미는 보존한다. 새 GET의 잘못된 query/cursor는400이며 인증·조회권한 오류는 기존401/403/404로 구분한다. 세부 DTO의 정해진 키·canonical hash·빈/끝/경계 반례는 채택 후 WI에서 고정한다. Primary도 원 요청 전달기한30초와 페이지 cursor 수명은 별개이며 최대30분∩당시 세션기한에 기술적 충돌이 없음을 확인했다. 후보는 여전히 미채택이고 제품 변경/시험 실행0이다.
