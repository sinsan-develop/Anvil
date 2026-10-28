# FN17 승인 요청 본인 알림 생산자 A안 — source-only 결과

## 현재 판정

2026-10-28 기준 승인 A의 한정 source 구현과 독립 검수가 완료됐다. Main 최종 신규4 단일45 PASS, capture 직접 인접2 단일22 PASS, 최종 타입 exit0이다. TS 원 I1·producer 시험 I1은 ADDRESSED / scoped C0 I0 M0, SQL 원 I1/I2/I3는 ADDRESSED / scoped C0 I0이며 필수 미해결 finding은 없다. 전체 FN17·Stage·계획 완료나 실제 알림 서비스 사용 가능·사용자 인수 판정은 아니다.

제품4·신규시험4는 아래 지문으로 동결했다. 이번 최종 제출은 허용 결과서1만 작성한다. Main 제품 write0, 신규 QA/환경 자원0, 작성자 Git·commit·push0이다. 기존 시험·SQL·적용 manifest·FN03/FN05 완료 코드·보호 자료는 수정하지 않았다. 저장소 게시와 통합은 Main의 별도 작업이다.

## 승인·기준

- 직접 승인: `call_95ad36ce82b64af7925dc9282b12f3e0/item0`, “A안 동작·source-only 구현 승인”.
- 승인 `docs/approvals/FN17_APPROVAL_NOTIFICATION_PRODUCER_SOURCE_20261028.json`: `D2DCD9B8F8772EAB6789EBEF5855303AE3F05BD04F1B3D572A261A89B835F03D`.
- WI `docs/work_packages/FN17_APPROVAL_NOTIFICATION_PRODUCER_IMPLEMENTATION.md`: `E890D96FB1EAC0FB75051B7C927B968F255E17E65D10672AB955B916402A85A9`.
- 허용목록 `docs/work_packages/FN17_APPROVAL_NOTIFICATION_PRODUCER_SOURCE_MANIFEST.json`: `B84C08BEA2D546B7C92D5295FB2070C6882494FE38EFDF3971082215268F119A`.
- packet `docs/work_packages/FN17_APPROVAL_NOTIFICATION_PRODUCER_DECISION_PACKET.md`: `BAA454FCA8C900DF0A44F704190BBC808D05B5F54ED1602CA49F3D9A4A2A3709`.
- 원 후보 SHA: `041B1AC3E210D210C157AE2936DFD7241162AFC7897F8DF91F2509C6071CCF1D`.
- 실행 기준: Main 888ed9/439dc7 전달 HEAD `cd3003388f193925f9e99e1f847d5baec7dd1736`, 기존 `codex/av3-stage-b`, local/private 동일·tracked clean·보호12·main f976 불변 확인. 문서 작성 시 base `a2ff8802ad648445b8c0869535efebb428dbf349`와 실제 배정 HEAD를 구분한다. 작성자 Git 실행0.
- TEST_ONLY → Main fresh RED → 해당 제품 GREEN GO 순서로 reader와 생산 hook/producer/SQL을 분리 구현했다.

## 구현과 변경 전후

| source 참조 | 변경 전 | 변경 후 |
| --- | --- | --- |
| `apps/server/modules/approvals/project-approvals.ts` | 원 receipt/request/capture 뒤 생산 접점 없음 | 기존 지원 상수 내용·순서 그대로 export. 실제 receipt/request와 PLAN/ACTIVATION capture 뒤 같은 transaction의 producer 호출. 최초 requestApproval 정책 유효창 전달 |
| `apps/server/modules/notifications/project-notifications.ts` | 최초 RLS 조회 전 인증 GUC 누락·기존 지원연산11 누락 | trusted actor/client transaction-local GUC 선행·기존 승인 지원목록 재사용. 원본 검증·본인 격리 유지 |
| `apps/server/modules/notifications/approval-notification-producer.ts` | 부재 | 원 명령/본인/request v1 snapshot/hash/서버 receipt/시각 검사, 한정 DTO INSERT, 전체 project cap와 정책·기한 재확인 |
| `db/migrations/0052_approval_in_app_notifications.sql.pending` | 부재 | 두 표/FK/unique/FORCE RLS/불변·원본·현재성 guard와 owner 한정 void cap 통로. 미적용 forward source |

새 공개 API·승인 연산·권한 계약은 추가하지 않았다. 원 request 응답과 replay 의미는 유지한다. 같은 원 명령 replay는 domain callback/생산0이다. DTO는 본인 HUMAN의 IN_APP/APPROVAL_REQUESTED/ACTION_REQUIRED/STORED_IN_APP 및 최초 readAt:null이며 source_command_id는 호출자 commandId가 아니라 실제 서버 receipt ID다. 승인 이유·위험·rollback 본문은 복사하지 않는다.

누적 cap은 수신자 RLS 가시 행 수가 아닌 전체 project 10,000이다. 9,999→10,000은 허용하고 다음 신규 요청은 429 NOTIFICATION_CAPACITY_EXCEEDED다. 자동 삭제·보존·상한 복구 정책은 구현하지 않았다. 생산 실패는 caller transaction에 전파하여 command/authorization receipt/audit/request/capture/notification을 함께 rollback한다.

## 독립 finding 보완

1. **producer 시험 I1**: storage503 predicate만으로 실제 INSERT/guard fault 도달을 보장하지 못했다. fault count=1, 정확 POLICY→CAP→CLOCK→POLICY→INSERT 순서, unexpected SQL 빈 배열을 함께 검사하도록 강화했다. 예상 밖 SQL 실패를 제품 정상으로 세지 않는다.
2. **TS/SQL I1**: cap 뒤 session/request만 검사하면 짧은 requestApproval AUTO 만료 후 긴 AUTO로 창이 늘어날 수 있었다. request 진입 최초 validUntil 전달, producer cap 전/후와 INSERT 후 기존 authorizeMaterial의 동일 policy ref·현재 허가 및 최초/현재 최소 기한을 검사한다. DB clock과 session/request/policy monotonic deadline도 결박한다. 짧은 원 AUTO/긴 AUTO·candidate 기한에서 cap/INSERT 지연 반례가 원 transaction 전체 rollback을 확인한다. SQL deferred complete에 current 검사를 추가하되 cap 재계산은 하지 않아 정상 10,000번째 INSERT를 거절하지 않는다. SQL은 원 transaction 시작 시 유효했던 짧은 규칙 만료도 거절한다.
3. **SQL I2**: 현재 상태·기한과 FOR UPDATE가 한 SELECT에 있으면 잠금 대기 전 조건 평가에 의존할 수 있었다. project/member/control 실제 잠금 statement 뒤 별도 statement에서 동일 actor/client·회원·제어·사용자·세션/clock 현재성을 재검사한다. 역사 조회에는 현재 정책을 소급하지 않는다.
4. **SQL I3**: 과거 APPLIED command/GUC만으로 알림 없는 과거 request를 backfill하지 못하도록 cap/INSERT 및 deferred complete에 현재 transaction 원본 guard를 연결했다. commands/request/authorization_receipt/audit 네 row version의 xmin을 pg_current_xact_id()::xid와 비교하고 원 received_at·created_at·snapshot 시각을 함께 결박한다. request.created_at은 기존 JS ISO 밀리초 저장 계약에 맞춰 transaction_timestamp의 milliseconds와 비교한다. 시각 단독 신규 판정은 하지 않는다. 역사 origin_valid는 xmin을 검사하지 않아 결정 이후 v2/v3 원 요청도 읽을 수 있다.

원본 불변 근거는 기존 `db/migrations/0011_authorization.sql` 104–108행의 app authorization_receipts/audit_events UPDATE·DELETE 회수와 approval_requests status/version만 UPDATE 허용이다. 과거 command/request를 UPDATE해 xmin을 바꿔도 과거 authorization/audit의 xmin까지 바꾸는 권한은 없다. 신규 의존 원본 guard도 알림 연결 receipt/request/snapshot/capture를 보존하며 승인 status/version 진행만 허용한다. 이것은 source 대조이며 실제 app-role 검증은 아니다.

공식 PG15 [transaction ID 함수](https://www.postgresql.org/docs/15/functions-info.html)는 pg_current_xact_id()의 xid8 반환과 xid 직접 cast를 설명한다. [시스템 열](https://www.postgresql.org/docs/15/ddl-system-columns.html)은 xmin이 해당 row version 삽입 transaction ID이고 UPDATE도 새 version을 만든다고 설명한다. xmin 단독을 최초 INSERT 완전 증거라고 주장하지 않는다. 기존 app 일반 BEGIN 경로를 전제로 하며 xid32 wrap·savepoint/subtransaction 실제 동작은 NOT_RUN이다.

## 최종 동결 지문

| 파일 | SHA256 |
| --- | --- |
| `apps/server/modules/approvals/project-approvals.ts` | `A41595201FB0CFD75D7C820857648080C3690B280F7E1D864E577D0DD89D3AB7` |
| `apps/server/modules/notifications/project-notifications.ts` | `D0D1EFA367DBFED3FE05D148C8EC83EC35AFB0B900ED5DFAB4FE19F83E2798E6` |
| `apps/server/modules/notifications/approval-notification-producer.ts` | `09FB56B98C78CBC96655CB227D43BFF8AC04884D5D8B5106C73BE2BA52B8934F` |
| `db/migrations/0052_approval_in_app_notifications.sql.pending` | `AA54E9E27C5C93F6BC30C9B263B0B919E7EA02A8A5E81EE2AC28CDB065F940A1` |
| `tests/unit/FN17/approval-notification-producer.test.ts` | `903355971B003D29E3CE356EE3C0A1F876BECF181ACA263D82C5528A5A246B70` |
| `tests/unit/FN17/approval-notification-request-transaction.test.ts` | `DC4C29DF9F01CCA4CAEBB5FCF94531296B0F5DEF9FB0E8B53F3C0DB8BB71A648` |
| `tests/unit/FN17/approval-notification-reader-operations.test.ts` | `4E1741C3AB21CC170E95FA0AAC5A2EEAB17E86BE58B9DCB04D9ADAFC8D48CCF5` |
| `tests/unit/FN17/approval-notification-sql.test.ts` | `E7B349758913BA50588C668CDD2D3D7A3465314B2F90C72867CCD9268AF79C31` |

원 approvals/reader SHA는 `98AC59FC1241BDB0A2E6208E5AC83D1827B464DDB6FEA5BE6BDBCFF3EF8E0002` / `32639105513E2CAE58FB0D1EFDE8C8B982397664BA3D9C2131933E835E6A9966`이다. I1/I2/I3 전 approvals/producer/0052 SHA `3BE511C17ABDB4892E042519154A23AB56238D36E3D86F0CA5F9CF63956693B0` / `0C5C5ABFF497E3BD7C2E7ABF2937232B3004D5337AE32B981D6602E75203B280` / `6E40BB61530E468B8284EBD96012CA773A83826005408D63849CB317AA64777C`도 이력으로 보존한다.

## 검증 이력

Main 제공 원출력과 작성자 실행을 분리한다. 명령은 등록 source의 상대 참조이며 내부 실행 공간을 제품 사용 방법으로 노출하지 않는다.

| 증거 | 실제 결과 | 범위 |
| --- | --- | --- |
| Main 8069fd / 549e3a | reader24: 9PASS15FAIL / 366.3019ms / skip0 / exit1 | 원제품 확인 후 누락11·RLS GUC RED |
| Main b8211c | 신규24+기존16 단일40PASS / 2006.2334ms | reader GREEN |
| Main bb45ac / 5a5b2d | transaction6: 0PASS6FAIL / 342.4772ms / skip0 / exit1 | 실제 서비스 생산 hook 부재 RED |
| Main 6075dd / c8c2f7 | producer5+SQL4: 0PASS9FAIL / 128.2999ms / skip0 / exit1 | 신규 source 부재 RED |
| author 146db5 | 집중4 단일41PASS / 386.3459ms / exit0 | finding 보완 전 중간 증거, 최종 해소로 소급하지 않음 |
| author 8d4b8a | 집중4 단일45: 44PASS1FAIL / 413.6561ms / exit1 | POLICY 관측 분류 fixture 누락1 |
| author 798371 | 영향3 단일21PASS / 387.4137ms / exit0 | fixture 교정 후 producer/transaction/SQL만 확인 |
| author fd7843 | 기존 직접5 단일23PASS / 1491.5093ms / exit0 | FN17 notification3 및 FN11 approval2 |
| author d9d299 | type exit0 | 최종 보완 타입 |
| Main a7718e | 신규4 단일45PASS / 608.3464ms / skip0/cancel0/todo0 / exit0 | 최종 fresh |
| Main 0cbf7e | 기존 capture2 단일22PASS / 450.7792ms / skip0/cancel0/todo0 / exit0 | PLAN/ACTIVATION 직접 회귀 |
| Main 61ad29 / d11320 | exact tsc exit0 / diff 검사 exit0 | 최종 타입·diff |

Main 최종 exact 명령:

```text
node --test --test-reporter=spec tests/unit/FN17/approval-notification-reader-operations.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts tests/unit/FN17/approval-notification-producer.test.ts tests/unit/FN17/approval-notification-sql.test.ts
node --test --test-reporter=spec tests/unit/FN11/work-plan-approval-candidate.test.ts tests/unit/FN11/design-activation-approval.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

작성자 집중·영향3·기존 직접5 exact 명령:

```text
node --test --test-reporter=spec tests/unit/FN17/approval-notification-producer.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts tests/unit/FN17/approval-notification-reader-operations.test.ts tests/unit/FN17/approval-notification-sql.test.ts
node --test --test-reporter=spec tests/unit/FN17/approval-notification-producer.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts tests/unit/FN17/approval-notification-sql.test.ts
node --test --test-reporter=spec tests/unit/FN17/notification-input.test.ts tests/unit/FN17/project-notifications.test.ts tests/unit/FN17/notification-routes.test.ts tests/unit/FN11/approval-input.test.ts tests/unit/FN11/approval-list.test.ts
```

### 원 오류와 보강 이력

- 원 producer test `FF7C592BD97628C109933013DFE9D9F7878BC1D1688E0A7D175DB6566D7E9592`, transaction `19F829B9505C151A02326119AD20E8DAED8109CD6709964EE1A050D06A642815`, SQL static `0CC0E36E5ECD9C85EA0CF40A6B1DD3C3A50E7BA43B8950CAA2C35FD2388F932F` 보존. 도달·순서 강화/session-request cap 지연 반례 후 중간 producer `7D08D5EE5246CE385E1461DB1FD220D2F10F1C54BD98202B8214E070A2C8FCAD`, transaction `4EC00A23D73DEE8BA35EE34012D775EDEF3613DB3B32EBFD86576D87405245EC`와 최종 지문은 별개다.
- 첫45 원 실패: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`; actual `['UNEXPECTED','CAP','CLOCK']`, expected `['POLICY','CAP','CLOCK']`. producer 시험의 cap 후 session/request 만료 case SQL 관측 map 한 곳에 새 currentPolicy 분류가 누락됐다. 정확 AUTH_REQUIRED401/APPROVAL_INPUT_INVALID422 predicate는 도달했다. 같은 map에 `FROM anvil.permission_policies`→`POLICY` 분기1만 보정했다. 기대/timeout/skip 완화0, 제품 기능 RED와 분리한다.
- 기존 notification fixture의 임의 policy hash는 허용 신규 시험 내부에서 실제 canonical policy hash 및 request snapshot hash로 보강했다. 기존 fixture/시험 바이트 변경0.
- 읽기 오기2: 없는 `db/migrations/0050_design_activation_approval_pointer.sql.pending` 대신 실제 `db/migrations/0050_design_baseline_activations.sql.pending`, 없는 `db/migrations/0044_work_plan_approval_candidates.sql` 대신 실제 `db/migrations/0035_work_plan_draft_approval.sql`을 inventory 확인해 읽었다. 별도 rg literal wildcard 경로 사용1은 `파일 이름, 디렉터리 이름 또는 볼륨 레이블 구문이 잘못되었습니다`로 실패하여 directory 검색으로 교정했다. 모두 읽기·영향0이며 제품 실패가 아니다.

## 검증 한계·미실행

- reader 신규시험은 기존 지원19 연산·새 인증 transaction GUC·A→B→A 본인 격리와 변조/타인/무회원 오류를 합성 포트로 검증했다. 실제 PG RLS 증거가 아니다.
- transaction 시험은 실제 repository.command→ProjectApprovals.request→receipt/request 및 PLAN/ACTIVATION capture INSERT/rollback을 관측한다. capture assertCurrent는 한정 stub이다. 실제 원문·DB 현재성까지 증명하지 않는다.
- cap 동시성은 합성 queue 직렬화 모델이다. 실제 PG row lock 경합/격리 수준 PASS가 아니다. 응답 유실 재확인은 동일 원 명령 합성 replay이며 실제 HTTP 유실이나 COMMIT 실패를 일으킨 시험이 아니다.
- producer unit의 INSERT 후 만료 때 저장 포트 row는 caller rollback 이전 상태다. 서비스 transaction 시험은 같은 실패가 원 command/receipt/audit/request/capture/notification 전체를 rollback하는 모델을 검사한다.
- SQL 시험은 미적용 source 정적 대조다. 문자열/정적 계약·owner FORCE RLS policy·void cap 통로·PUBLIC/app EXECUTE 회수를 실제 PG compile/DML/RLS/GRANT/COMMIT PASS로 승격하지 않는다.
- NOT_RUN: 0052 적용, 실제 PG compile/DML/GRANT/RLS/COMMIT/경합/xid wrap/subtransaction/savepoint, privileged 외부 변경, 실제 알림 전달·승인 집행·정식 served API/UI·Agent·사용자 인수. 전체 FN17/Stage/계획 미완료.
- QA/브라우저/환경/DB 자원 생성0, 따라서 이번 작업의 QA 회수 대상0. 정책·권한·Secret·서비스 변경0이다.

## rollback·다음 조치

Main은 이번 정확 허용 제품4·신규시험4·결과서1만 일반 revert/선택 복구하며 보호 자료와 다른 완료 단위를 보존한다. 0052 미적용이므로 이번 변경의 실제 DB 데이터 rollback은 없다. drop/DB 복구/권한 실행은 포함하지 않는다.

현재 단위는 source-only 한정 구현·검수 완료다. Main이 exact diff·기존 시험/SQL·적용 manifest·보호 자료·지문을 확인해 별도 checkpoint/통합한다. 작성자는 결과서 해시 제출 뒤 제품·시험·추가검사0으로 동결한다. 실제 환경/운영·전체 FN17 후속은 별도 선행과 실행 승인 범위에서만 진행한다.
