# FN17 승인 요청 본인 in-app 알림 생산자 한정 결정안

- 상태: DECISION_PENDING / NOT_ADOPTED / IMPLEMENTATION_NOT_STARTED. 작성: 2026-10-28, 어울.
- 목적: 기존 requestApproval 신규 성공 사건을 본인 in-app 알림으로 보관하는 내부 생산자의 source-only 계약을 결정한다. 이 문서 작성은 후보 채택·코드/시험/DB 실행 승인이 아니다.
- 정본 후보: docs/work_packages/FN17_IN_APP_APPROVAL_NOTIFICATION_CONTRACT_CANDIDATE.md, 현 SHA256 041B1AC3E210D210C157AE2936DFD7241162AFC7897F8DF91F2509C6071CCF1D.
- 기존 독립 검토: docs/04_test_reports/AV3/FN17_IN_APP_APPROVAL_NOTIFICATION_CONTRACT_REVIEW.md. 최초 notification 행 잠금/최소권한 충돌 I1은 기존 project/member/control 잠금 재사용으로 해소되어 r2 한정 C0/I0/M0다. 검토 당시 raw 6DA759BF26ABA4DE3D9E221372EF11FF4BFF5AED6ED499F8EEEA06A93F5368A1은 CRLF→LF 비의미 보정 뒤 현 041B1AC3…로 재확정됐다. 검토서와 WORK_STATUS 8099~8105의 연결 이력을 따르며 논리 검토를 실행 PASS로 바꾸지 않는다.

## 1. 현재 구현과 필요한 결정

기존 본인 알림 GET/list·표준 markNotificationRead·UI14·읽음 정책 화면·기존 모바일 승인 접근은 source 검수된 범위다. 이를 재구현하거나 완료된 시험을 반복하지 않는다. 실제 알림 생산·DB/served 사용 가능은 별도다.

현재 source의 ProjectApprovals.request는 원 receipt 저장→approval_requests INSERT→필요한 설계활성화/작업계획 후보 capture→반환 순서이며 알림 INSERT가 없다. db/migrations 실제 목록 및 내용의 notification 검색에서도 두 저장표 정의를 확인하지 못했다. 이는 source 조사 결과이며 실제 DB의 존재/무결성 관측은 아니다. 과거 파일지도 이름이나 SQL 번호를 현재 저장 정의로 간주하지 않는다.

PMO 최신 회신에서 후보 A 원자성과 프로젝트당 10,000행 상한의 추가 채택 근거는 확인되지 않았다. 현재 P03/FN16 지원 범위 밖이므로 이 정확 결정안의 직접 결정을 요청할 필요가 있다. PMO 회신·기존 후보 C0/I0·기존 조회 구현은 채택을 대신하지 않는다. 기존 P03/FN16 질문을 중복 발행하거나 이 결정을 실제 DB 복구 허가로 사용하지 않는다.

## 2. 권장 A와 새 실패 의미

권장안 A는 기존 requestApproval의 같은 transaction 안에서 신규 승인 요청의 본인 알림 한 행을 저장하는 것이다. 원사건은 APPROVAL_REQUESTED 한 종류, 수신자는 서버가 만든 원 snapshot의 requiredDecider와 동일한 요청자 HUMAN, 채널은 IN_APP이다. 기존 9필드 DTO·알림 본체 v1/hash·원 승인 요청 v1/hash·server receipt ID·원 발생 시각을 사용한다. 승인 이유/위험/본문·token·URL을 복제하지 않는다. 알림의 보관은 현재 승인 가능·OS 전달·사용자 확인을 뜻하지 않는다.

**새 의미 1:** 알림 INSERT·저장소·guard 실패가 원 requestApproval까지 실패시킨다. 원 receipt/commands·authorization receipt/audit·approval_requests·기존 candidate capture·알림 모두 commit0으로 rollback한다. 기존 승인 성공의 실패 조건을 넓히므로 내부 구현 방법으로 임의 채택하지 않는다.

**새 의미 2:** notifications는 프로젝트당 누적 10,000행을 제안 상한으로 둔다. 기존 project 잠금 아래 신규 INSERT 직전에 검사하며, 신규 한 행으로 상한을 넘으면 429 NOTIFICATION_CAPACITY_EXCEEDED로 원 transaction 전체 commit0이다. 알림을 만들지 않는 기존 replay·GET·READ는 상한 뒤에도 가능하다. 기존 행 자동삭제·본문 quota 전용·조용한 알림 누락으로 우회하지 않는다. 보존기간/실제 바이트·부하 수치는 확정하지 않는다.

장점은 worker·외부 송신 없이 승인 요청과 알림의 누락 없는 같은 commit 경계를 만드는 것이다. 단점은 알림 표 장애나 상한 도달만으로도 원 승인 요청을 보관할 수 없고, project 잠금·상한 검사 비용이 원 요청 경로에 더해진다는 점이다. 알림보다 원 승인 보관의 가용성을 우선한다면 A를 선택하면 안 된다. 이 가용성 변화와 10,000행 상한을 사용자가 함께 판단해야 한다.

**상한 도달 뒤의 운영 영향:** 자동삭제는 OFF이고 보존기간도 미정이다. 따라서 10,000행이 쌓이면 이후 새 승인 요청 자체가 계속 거절될 수 있다. 시간이 지나거나 승인을 처리했다고 자동으로 다시 저장되는 구조가 아니다. 기존 알림 조회·읽음 표시와 같은 원명령 replay는 가능하지만, 새 승인 요청 저장을 다시 가능하게 하려면 별도 명시 결정이 필요하다. 자동정리·상한 상향·보존정책 개정이나 새 상한값은 이번 승인에 포함하지 않는다. C는 원 승인 요청 성공을 유지하는 대신 알림을 놓칠 수 있다는 반대 선택이다. 사용자는 A의 알림과 원 요청 동시 보관과 C의 원 요청 가용성/알림 누락 가능성을 비교해 선택해야 한다.

## 3. 대안

| 대안 | 동작과 한계 |
|---|---|
| A 원 transaction 직접 INSERT — 권장 | 요청·receipt·candidate capture·알림을 함께 commit. 알림 실패/상한 초과가 원 요청도 rollback한다. |
| B 원 transaction outbox 후 별도 생성 | enqueue 실패는 여전히 원 요청 rollback. enqueue 이후 생성 실패만 분리된다. worker/claim·실패/재처리·수명·권한의 새 계약이 필요하며 기존 delivery_outbox를 임의 전용하지 않는다. 이번 source 구현 승인으로 자동 포함하지 않는다. |
| C 원 승인 commit 후 best-effort INSERT | 알림 실패로 원 승인을 되돌리지 않는다. commit과 INSERT 사이 crash로 알림이 빠질 수 있다. durable 복구 계약 없이 무손실을 보장하지 않으며 과거 backfill을 자동 추가하지 않는다. |
| 보류 | 기존 조회/읽음 source를 보존하고 신규 알림 생산은 미구현으로 남긴다. |

## 4. 제안하는 정확 source-only 승인 범위

- 후보 041B1AC3…의 내부 생산자 A와 프로젝트당 10,000행·초과429 의미를 채택하고, 코드·미적용 SQL source·합성 검증·필요 계약 문서 반영을 허용하는 안이다. 구현 전에 정확 WI/파일 허용목록·baseline·단일 writer·TEST_ONLY→Main RED 순서를 별도로 고정한다.
- 내부 생산자는 원 신규 성공 callback에서만 호출한다. 기존 same-command replay 경로·재조회·읽음은 생산자를 부르지 않고 과거 요청 backfill을 하지 않는다. 실제 capture까지 완료된 같은 transaction의 성공/실패 경계를 유지한다.
- 기존 reader의 허용 승인 연산을 현재 requestApproval의 실제 consumableOperations와 정합하게 맞춘다. 현재 reader는 일부 최근 연산을 누락하므로, 새 알림을 만들고도 원본 검증에서 503이 되는 조합을 막아야 한다. 새 승인 가능 연산/권한을 추가하는 것이 아니며 원 요청의 지원·target/current 계약을 유지한다.
- notifications/notification_reads의 미적용 forward 저장 DDL·PK/FK/중복방지·불변/원본 결박 guard·RLS·기존 owner/app 대상 최소 SELECT/필요 INSERT 권한 SQL source를 준비한다. 실제 inventory 뒤 사용 가능한 새 번호를 결정한다. 기존 SQL 수정·적용 manifest 변경·새 계정/credential·notification UPDATE 권한 추가는 포함하지 않는다. 기존 project/member/control 잠금과 최초 read 불변 계약을 보존한다.
- 기존 공개 requestApproval/알림 GET/list/mark를 그대로 소비한다. 새 public publish API·임의 recipient/event/channel/URL 입력은 만들지 않는다. 기존 GET/mark/UI14/정책/모바일 기능과 DTO/receipt 의미를 재구현하거나 완화하지 않는다.

**실행 제외:** 실제 DB 접속·SQL/DDL/GRANT 적용·정책/계정권한 부여·기존 데이터 재작성/삭제·서비스/배포·Secret/인증서·실Agent/비용·외부 push/SMTP/구독·설정/일반진도/완료/오류 생산자·타수신자·backfill은 0이다. SQL source 작성 허용은 SQL 실행 허가가 아니다.

## 5. 검증 계획과 증거 한계

1. 정상 신규 requestApproval의 원 receipt.id/requestRef v1/hash/수신자/발생 시각과 알림 한 행을 직접 대조한다. 원문·위험/Secret 복사0을 검사한다.
2. 같은 원 command replay·응답 유실 재확인은 추가 알림/capture0, 다른 payload 충돌·실패 요청 알림0을 확인한다. 원 reader의 기존 조회·mark 계약과 호환됨을 영향 범위에서만 확인한다.
3. 알림 저장/guard/cap 실패를 주입해 원 receipt/request·설계활성화/작업계획 candidate capture까지 모두 rollback되는지 검사한다. 상한 직전/도달/초과·동시 신규 요청에서 기존 project 잠금과 일관된 10,000행 경계를 source/fake transaction으로 대조한다. replay/GET/READ는 상한 이후에도 가능해야 한다.
4. 현재 requestApproval이 지원하는 각 승인 연산의 정상 원본을 reader가 검증하는지 검사하고, 미지원 연산·다른 actor/project·변조 ref/hash/receipt·원본 시각/수신자 불일치를 정확 오류로 거절한다. 예상 밖 예외를 음성 PASS로 처리하지 않는다.
5. 새 SQL source의 FK/guard/RLS/최소권한·불변·최초 읽음 결박과 권한/변조 거절을 정적으로 대조하고, 집중 unit/in-process/fakeDB·type·직접 영향 회귀만 수행할 계획이다. 실제 PG 문법/트리거/DML/COMMIT/RLS·동시 잠금/GRANT·실DB/served·기기/사용자 인수는 별도 실행 근거 전 NOT_RUN/NOT_PROVEN이다. fake transaction의 rollback이나 cap 경합 결과를 실제 DB 원자성 증명으로 올리지 않는다.

## 6. 복구와 필요한 정확한 결정

채택 전에는 이 결정안만 철회할 수 있다. 후속 source 구현 rollback은 정확 producer/reader 호환 변경을 이전 검증 source로 되돌리며, 실제 적용 전이므로 DB 복구 작업은 없다. 향후 별도 승인으로 적용했다면 저장된 알림/read·원 승인/receipt를 보존하고 DROP/reset/자동삭제를 하지 않는다. 생산자 rollback 뒤 신규 승인 알림 공백을 기록하며, schema/권한의 forward 보정·서비스 복구는 그때 별도 실행 판단 대상이다.

요청할 결정은 **‘A의 원 승인까지 rollback하는 원자성 및 프로젝트당 10,000행/초과429를 포함하여 위 source-only 구현을 채택’** 또는 **‘보류/다른 가용성 의미 선택’**이다. B/C 선택은 해당 상세 계약을 먼저 정하는 방향 결정이며 자동 구현 허가가 아니다. 이번 결정으로 전체 FN17·Stage E·WORK_PLAN 완료나 실제 알림 전달/DB 준비를 선언하지 않는다.

현재 이 문서 외 code/tests/Git/WORK_STATUS·DB/서비스 변경은 0이며, 승인 전 구현은 시작하지 않는다.
