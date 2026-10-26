# FN17 승인 요청 in-app 상세 후보 독립 검토

2026-10-27 / Main 어울 / 작성 fn17_minimal_contract_candidate / 독립 fn17_contract_review.

판정: r2 문서 논리의 최초 I1 ADDRESSED, scoped C0/I0/M0. 채택·기능/Stage 완료·실행 검증이 아니다.

- 최초 후보 F9B9EFEBB91286B63A0B5B8584F9C3458D32486A7D81B78A49C275A6A3DD977B는 C0/I1/M0. notifications FOR UPDATE가 필요로 하는 UPDATE 권한과 SELECT/INSERT만 허용하는 표 권한이 충돌했다.
- 최소 수정은 notification 행 잠금을 제거하고 기존 currentProjectController→projectMember FOR UPDATE OF p,m→project_control FOR UPDATE의 동일 transaction에서 최초 read 조회/INSERT를 직렬화하는 것이다. Main bd29ef·검수자 source 대조, 복합 PK/불변/표준receipt 유지·새UPDATE권한0.
- 최종 후보6DA759BF26ABA4DE3D9E221372EF11FF4BFF5AED6ED499F8EEEA06A93F5368A1. 독립 재검토 I1 ADDRESSED/fix C0/I0/M0. 이전 hash와 finding 이력을 후보에 보존했다.
- 기존 계획의 Notification9필드·조회/markNotificationRead·현재 회원/수신자·표준 OWNER/controller/policy/CSRF/replay를 구체화했다. 개인 PUT/권한 예외·arbitrary publish·본문/승인 token 복사0.
- 원 승인 요청까지 rollback하는 새 실패 조건과 프로젝트10000행 상한은 명시 제안이며 아직 채택하지 않았다. 실제DB/GRANT/서비스/외부송신·Agent/Secret 변경0.
- 실제 SQL 구문/권한·경쟁/원자성/API/브라우저/DB는 NOT_RUN이다. 문서 논리 검토를 기능 사용 가능·전달/권한 PASS로 승격하지 않는다.

참고: PostgreSQL15 SELECT 행 잠금은 대상 표 최소 한 열 UPDATE 권한을 필요로 한다. https://www.postgresql.org/docs/15/sql-select.html

다음은 위 두 정확 의미 결정을 PMO에 제출하고, 기존 계획 내부 상세와 별도 실제 실행 경계를 구분하는 것이다. 전체 FN17의 나머지 사건·설정·채널·UI13/Stage는 미완료다.

- **게시 전 Main 문서 개행 보정**: d24fbb staged diffcheck exit1은 새 JSON의 CRLF67행과 미채택 후보224행의 CRLF를 trailing whitespace로 판정했다. Main 소유 두 문서만 CRLF→LF로 보정하고 JSON 논리/문서 의미·제품8파일은 불변이다. 후보 검토 raw6DA759BF26ABA4DE3D9E221372EF11FF4BFF5AED6ED499F8EEEA06A93F5368A1의 현 보존 지문은 041B1AC3E210D210C157AE2936DFD7241162AFC7897F8DF91F2509C6071CCF1D 이며 비의미 재확정이다. 기존 WI63238492의6DA는 검토 당시 원문 지문으로 보존하고 이 연결 이력을 적용한다. 새 검증 PASS/범위 확대가 아니며 코드 테스트를 개행 때문에 반복하지 않는다. Main 동일 원인1회/권한·Git 설정변경0.
