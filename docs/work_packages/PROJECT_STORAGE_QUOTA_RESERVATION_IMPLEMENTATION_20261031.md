# 프로젝트 저장량·지속예약 A 구현 작업계획·WI — 2026-10-31

> Agent 실행: 기존 단일 Primary가 superpowers:subagent-driven-development·TDD로 Q1→Q4를 수행한다. Main은 관리·자체 명세 대조·검수·통합, 기존 Reviewer는 읽기 전용 독립 검수다. 사용자 지정 방법/담당을 유지하고 새 agent/chat/branch/worktree를 만들지 않는다.

**목표:** 새 원장2표의 지속 예약→실 upload/diff/생성 인계/checkpoint 소비→동일 운영Tx 정산을 연결한다. 라이브러리·NOT_CONNECTED 함수만 늘린 상태를 종단 완료로 판정하지 않는다.
**구조:** 기존 인증/보호 reader로 계획을 고정한 Tx를 종료하고 독립 예약·시작 Tx를 각각 COMMIT한 뒤 기존 운영Tx를 호출한다. 운영 rollback 뒤에도 선행 R가 남고 정확 정산은 자료/receipt/audit와 같은 Tx다.
**기술:** 기존 Node24/TypeScript·PostgreSQL pending SQL·ArtifactStore. 새 dependency/도구0.
**기준:** 동결후보 PROJECT_STORAGE_QUOTA_RESERVATION_SOURCE_CANDIDATE_20261031.md SHA9110DEA86C1616B224F5BB4DA6E1099B7BD9915A0DC67D044CDBC06827EE12E2와 직접승인 PROJECT_STORAGE_QUOTA_RESERVATION_APPROVAL_20261031.md SHADE377C277F9C90C849586CF711977D4DE7DAFD013CE979F0336641201858E236. 후보의 승인 전 상태는 이력이며 새binding을 적용한다.
**시작:** codex/av3-stage-b, 제품/문서 시작3e2decf2b3ef6099d21255e21b00a0d7c95bbfa9 local/private 확인. Main의 WI 문서checkpoint 이후에는 같은 제품기준을 유지한다.

## 전역 조건·승인 제외
- 실제 DB/SQL/GRANT·정책/권한·키·현재 파일/사용량 조사·서비스/Agent·기존 프로젝트 차단 해제0. 기존project의 account backfill/0·READY 자동초기화0. 새 실제QA/FS/브라우저/컨테이너/port/listener 생성0.
- 합성은 메모리 transaction/FS 대역과 순수·in-process route만. 코드·migration 문서 읽기와 일반 타입/메모리 build는 허용한다. 임시 실행 자원이 필요하면 정확 등록과 이 제외범위를 Main과 먼저 대조한다.
- 원자료/과거 receipt·0042·0058 SQL·현재 승인 정책·원문 보존/격리 의미를 유지한다. 새 pending0059에서 guard 대체/양방향 완결을 정의하며 적용 loader/기존SQL 수정0.
- 다른 보호3(FN06 native compile 후보/FN04 conversation-source 시험/FN10 queue-assignment pending) 수정·stage·삭제0. FN13 원WIP5 복구본 보존·자동삭제0.
- 같은파일 code writer는 기존 Primary 한명. Main은 해당 code를 수정하지 않는다. 정식 동일 failure3 인수 규칙과 TDD 예상RED·도구오류를 구분한다.
- 이번 source-only 종단 검수와 실제 PG/RLS/COMMIT/OS경합·현재 usage·사용자 수용을 구분한다. 전체 WORK_PLAN/기존project 실제저장 완료로 승격0.

## 정확 허용14경로
기존제품9:
1. apps/server/storage/artifact-store.ts
2. apps/server/modules/documents/project-files.ts
3. apps/server/modules/documents/project-proposals.ts
4. apps/server/modules/documents/project-documents.ts
5. apps/server/modules/projects/draft-artifacts.ts
6. apps/server/modules/projects/draft-artifact-files.ts
7. apps/server/modules/projects/repository.ts
8. apps/server/modules/checkpoints/project-checkpoints.ts
9. apps/server/modules/projects/routes.ts

신규5(부재 확인됨):
10. apps/server/modules/projects/project-storage-quota.ts
11. db/migrations/0059_project_storage_quota.sql.pending
12. tests/unit/FN13/project-storage-quota.test.ts
13. tests/unit/FN13/project-storage-quota-writers.test.ts
14. tests/unit/FN13/project-storage-quota-schema.test.ts

access/project-command.ts·App/기존 API helper는 불변을 우선한다. 보완이 실제로 필요하면 정확 caller/기존계약 영향과 추가 경로를 Main에 제시하고 허용범위를 고정한 뒤 수정한다. 일반 리팩토링/공통화0.

## r2 내부 명확화 — 2026-10-31 독립 검토 보완
- 부모 WI SHA1B92351C44F09A2AF7364B04424D65626767B2D8B69174F904D5391DE975538E의 승인 범위·공개 계약·허용14·한도·기한·제외는 불변이다. Main이 내부 계획 hash의 대상을 명확히 하고 IO_STARTED 이후 오류 보존을 보강한다.
- ARTIFACT part.contentHash는 실제 본문 hash다. CHECKPOINT part.contentHash는 시각 없는 고정 준비 snapshot의 preparedHash이며 최종 snapshot.preparedHash와 정확히 대조한다. 최종 content_hash는 canonical 최종 snapshot hash·receipt ref·기존 checkpoint_complete로 별도 검산한다. 미래 운영Tx 시각의 최종 hash를 예측하거나 검사를 생략하지 않는다.
- checkpoint recordedAt은 기존 운영Tx 시각·receipt와 동일하게 유지한다. 선행 예약 C는 같은 최종 구조/고정 길이 UTC 밀리초 시각의 정확 UTF-8 크기와 recordText로 계산하고, 실제 최종 C와 다시 같음을 검사한다. 부족 예약·준비 snapshot 크기 대용0.
- settle은 이미 IO_STARTED 이후의 부작용 가능 경계다. 현재성/기한/권한 실패도 외부에는503 PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN으로 보존하고 원명령/R를 유지한다. 첫 FS 전 requireStarted의 현재성 검사는 그대로 유지한다.

## r3 내부 재확인·최소 권한 — 2026-10-31 Q2
- 부모 r2 SHA B8C7068FDADAFB8F29D017C1B802676FB6B7D0397361158A9897DA6482B09CCC. 승인 A의 같은 원명령 RESERVED 재확인에서 임의 새 part ID/갱신 기한으로 planHash를 바꾸지 않도록 내부 보호 조회를 구체화한다. 공개 API·승인 범위·허용14·실행 제외 불변이다.
- 0059의 불필요한 두 표 app-role SELECT grant를 제거하고 원 REVOKE를 유지한다. 기존 class는 보호 함수만 사용한다. 현재 HTTP 교차 프로젝트 누출을 확인했다는 의미가 아니다.
- quota_existing(s uuid,a uuid,c uuid,p uuid,q jsonb) 보호 함수를 허용한다. 실세션·현재 프로젝트 OWNER/제어/정책·원승인·원명령 hash/actor/client를 검산하고 project→account→해당 원명령 예약 순서로 잠근다. 다른 원명령/프로젝트 정보 반환0, 전체 part/plan/fence/phase 검산과 최소 실행 권한 source를 정의한다. 실제 함수/GRANT 실행0.
- prepare는 현재 권한·원자료·기존 보호 replay를 보존하고, 이미 RESERVED인 정확 원명령만 원래 plan/part ID/deadline으로 재확인한다. 내부 derivePlan에 기존 part ID 힌트를 전달할 수 있으나 실제 bytes/hash/source를 재검산하고 불일치는409다. 원기한 연장0, 이미 IO_STARTED/UNKNOWN은503·재IO0, SETTLED는 기존 보호 replay만, CANCELLED 재시작0이다.
- 반례: 예약 COMMIT 응답 유실 후 같은 명령 재확인에서 예약 증가0·원ID/기한 유지, 다른 본문/주체/기기 거절, 시작 COMMIT 유실 후 재IO0. 실제SQL 대신 기존 메모리 transaction으로 확인하고 실제PG는 미검증으로 남긴다.
## 이름·값·인터페이스 고정
- 새 class는 project-storage-quota.ts의 ProjectStorageQuota, 실제 AccessRepository/ArtifactStore를 소비한다. 별도 공개 route/사용자 quota setter0.
- 내부 계획·예약 bundle은 readonly/원형복사이며 first await 전에 원 command/metadata와 실제 incoming Buffer를 복사해 caller 수정/ABA로 대상·바이트가 바뀌지 않는다. commandHash/planHash·project/actor/client·정확 operation/part·policy/fullref·기한을 결박한다. source의 새 usage=0/VERIFIED bool·성공 callback·환경변수 우회0.
- 내부 public 메서드 역할은 prepare(token,csrf,request,derivePlan), reserve(token,csrf,prepared), start(token,csrf,reservations), requireStarted(db,actor,request,started,actualParts), settle(db,actor,request,started,receiptFacts), adoptCreation(db,actor,creation,receipt,namespaceProof)로 분리한다. 반환형 PreparedQuotaCommand/QuotaReservationBundle/StartedQuotaBundle을 이 모듈에서 명시 정의해 caller가 재구성하지 않게 한다. derivePlan은 고정 보호원문/바이트 계산용 trusted 내부 closure이며 quota 권위/사용량을 발급하는 port가 아니다. 실제 DB/원장 검산은 class가 수행한다.
- prepare의 replay 결과는 기존 operation의 보호 replay 경로로 돌아간다. 특히 upload는 기존 artifact row·store.read·격리 검산을 유지하고 projectReplay JSON만으로 반환하지 않는다. 정확 과거 APPLIED replay는 현재 auth/원자료·원receipt/정산 대응 후 새 예약/IO0이다.
- P02 프로젝트 한도10737418240bytes. 파일/diff는 최대2B 예약→정확 게시/임시회수 검산 뒤 B 정산. 같은 ID 참조0, 같은 hash의 다른 실제 ID는 각 산입. 격리/실패/미확정/참조해제/UNKNOWN을0으로 빼지 않는다.
- checkpoint는 최종 canonical stored snapshot+recordText의 정확 C, 기존1073741824bytes/10000건·합계2MiB를 유지한다. 최종 recordedAt은 운영Tx/receipt 시각과 같게 산출하고 계획 C와 최종 C를 다시 대조한다. 준비 snapshot으로 축소0.
- amount는 내부 BigInt·wire/JSON은 canonical 비음수 decimalstring. SQL bigint/numeric, 부호/비정수/비유한값/unsafe Number 거절. U/R 각각>=0·합계<=cap이며 상태별 합계와 원장을 같은 Tx에서 검산한다.
- 계정 generation은 coverage/fencing 세대(양의 안전정수)다. 일반 U/R 변경 횟수와 혼동하지 않는다. 신규 start/settle는 같은 현재 VERIFIED 세대, 과거 SETTLED replay는 현재세대와 일치시켜 숨기지 않는다.

### 새 표2개·정확 열
1. anvil.project_storage_accounts: project_id(PK/project FK), schema_version(1), coverage_state(UNVERIFIED/VERIFIED), creation_intent_id, creation_command_id, initial_manifest_json, initial_manifest_hash, used_bytes, held_bytes, generation, created_at, updated_at.
2. anvil.project_storage_reservations: id(PK UUID), project_id(FK), actor_id, client_id, external_command_id, operation, command_hash, part_key, part_kind, plan_json, plan_hash, reserved_bytes, settled_bytes, phase, start_fence, authorized_until, server_command_id, authorization_receipt_id, scope_digest, created_at, started_at, settled_at.

- reservation 유일키(project_id,actor_id,external_command_id,part_key); 기존행의 client/hash/계획/범위 차이409, 남의 reservation ID/다른part·project·주체/fence로재사용0. 외부 commandId와 내부 commands.id를 혼동하지 않는다.
- phase RESERVED/IO_STARTED/SETTLED/CANCELLED/UNKNOWN. 생성/예약 계획·주체·금액 상한은 불변, 시작 CAS 한번·fence 일치·정산 한번. CANCELLED는 원래주체/명령·같은 원장잠금 아래 시작 CAS 미성립 RESERVED만 허용한다.
- IO_STARTED/UNKNOWN의 시간만료·취소·PID부재 감액0, 자동 재시작0. UNKNOWN 정조정/실해제 API·실제 실행은 이번 제외다. 증빙없는 기존account 생성/backfill0.
- account U/R↔원장 phase 합계, 원명령/authorization receipt/정확 HUMAN_COMMAND 감사↔artifact/checkpoint/adoption/정산을 deferred 완결 검사로 양방향 결박한다. 부분 COMMIT·고아·다른 command/hash/target/순번을 거절한다.
- creation_command_id는 repository.createProject가 PROJECT 범위로 생성하여 commitCreation에 전달하는 내부 commands.id에 결박한다. 외부 request.commandId와 별도 draft 명령 ID를 혼동하지 않으며 동일 project·receipt·HUMAN_COMMAND 순번1·생성 결과·adoption을 검산한다. FK/guard는 현재 schema와 실제 caller에 맞춰 정의한다.
- 직접 app-role DML도 guard 우회0. 최소 권한 source만, GUC/입력 bool만으로 권한/FS truth/coverage 발급0. 기존 auth/현재세션·controller/policy·명령참조를 검사하며 SQL만으로 실제FS 사실을 검증했다고 주장하지 않는다.

### 오류/부작용 경계
quota/coverage 미검증 412 PROJECT_STORAGE_QUOTA_UNVERIFIED, cap 초과 429 PROJECT_STORAGE_LIMIT_EXCEEDED, 같은명령 hash/계획 충돌409, COMMIT/시작/FS/close/정산 결과 불명503을 구분한다. 503의 code는 PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN으로 고정하며 클라이언트가 새 command를 자동 만들 수 있는 명확 거절로 바꾸지 않는다.
- 기존 operation auth·CSRF·OWNER/controller/세대·원승인/정책·세션기한은 계획/예약/시작/운영 단계에서 재검사한다. 준비예약은 승인소비/권한연장0, 원승인소비는 원운영Tx 자료/receipt와 기존조건 그대로다.
- 시작 COMMIT 확인 전 FS0. IO_STARTED 이후 실패·운영 rollback은 R를 남긴다. 실제 side effect가 가능했던 결과를 일반 입력거절로 낮추지 않는다. 재로그인/기기변경도 원명령/UNKNOWN을 새현재명령으로 승격하지 않는다.
- 운영Tx의 project/control 잠금 안에서 독립 예약/시작 Tx를 중첩하지 않는다. 구체 순서 prepare Tx종료→reserve COMMIT→start COMMIT→기존 policies.command 또는 파일 운영Tx→같은Tx settle이다.

## 검토 초점5
1. 동일명령 동시 시작/COMMIT유실에서 I/O가 2번 되지 않는가.
2. 원래한도 아래 upload/diff 정상양성·격리·기존승인소비·replay가 유지되는가.
3. 실제IO후 DB실패/세션·정책/원자료변화가 UNKNOWN charge를 잃거나 새 명령 재시도를 유발하지 않는가.
4. 무첨부/첨부 생성의 실제 namespace/원0042 증빙과 legacy replay를 혼동해 account READY를 만들지 않는가.
5. checkpoint 성공과 기록/receipt/감사/정산이 같은 원자단위이며 실제 coverage 없는 현재 프로젝트는412인가.

## Q1 — 지속 원장/예약·시작 프로토콜
**파일:** 신규 class/0059·core/schema 시험(10~12,14). 나머지 code는 Q2/Q3까지 수정하지 않는다.
- [ ] core/schema 시험에 현재 class/두표 부재의 RED를 먼저 확인한다. 단순 import 오류만이 아니라 reserve→start→동시CAS/phase·U/R/불명 모델의 의도된 실패도 기록한다.
- [ ] ProjectStorageQuota의 typed 계획/예약/시작/requireStarted/settle와 실제 protected DB queries·0059의 두표/guard를 구현한다. account 미검증412, reservation/시작 별도 COMMIT 후에만 반환, 불명 COMMIT에서 IO0·원 ID/R보존을 검증한다.
- [ ] 테스트: 정확 cap/2B/C·0/unsafe·동일원명령/다른subject/client/hash/part·독립 durable commit/rollback·한번시작·UNKNOWN 자동감액0·부분정산거절. 메모리 DB 모델은 실제 transaction commit/rollback을 상태에 반영하고 COMMIT 응답유실은 별개로 모사한다.
- [ ] 실행: node --test tests/unit/FN13/project-storage-quota.test.ts tests/unit/FN13/project-storage-quota-schema.test.ts, node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json. Q1은 내부 protocol 검수이며 종단 기능 완료가 아니다.

## Q2 — 실제 upload/diff writer 연결
**파일:** 기존1~4,9·신규class/시험13. 기존 project-command를 그대로 최종운영Tx에 소비한다.
- [ ] writers 시험에서 실제 route/class consumer의 미연결 RED를 확인한다.
- [ ] 고정 upload Buffer·서버 생성 diff source/ref/bytes/hash/part ID를 계획에서 보존한다. 최종운영Tx에서 current source/CAS를 재대조하고 예약으로 실제 put→기존 receipt/자료→정산을 연결한다.
- [ ] 격리파일도 산입, attach 같은 ID재참조는 증가0. final/staging 확인 불명이면2B 유지. 원본만/receipt만/정산만·FS후운영rollback·정산COMMIT유실 반례에서 실제 메모리 FS잔류/R/원명령을 단언한다.
- [ ] 정상 artifact·proposal/receipt 결과 단언을 유지한다. 기존 양성을412 기대값으로 바꿔 통과시키지 않는다. 공개 callback/테스트flag로 usage성공 발급0.
- [ ] 실행: node --test tests/unit/FN13/project-storage-quota-writers.test.ts 및 실제 영향 기존 UI06/document-upload-approval.test.ts·proposal-api.test.ts. 기존 테스트 수정이 필요하면 Main에 정확경로/fixture근거부터 제시한다.

## Q3 — 새 프로젝트 인계·FN13·전writer coverage
**파일:** 기존5~9·신규class/SQL/집중시험.
- [ ] 생성/인계와 checkpoint의 실제 class 소비 미연결 RED를 확인한다. 새project와 기존project/replay를 구분한다.
- [ ] 현재0042 durable creation intent/선택 snapshot/provenance·closed copy를 재사용한다. 프로젝트/adoption/원생성receipt와 같은 생성Tx에서만 account/초기원장을 인계한다. 기존개인500MiB/200·정확중복회수/0042는 보존한다.
- [ ] 무첨부도 captured ArtifactStore의 신규·비혼재/빈namespace 증빙이 필수이며 첨부는 정확선택·copy의 B다. 실제스토어부재·검산불명·기존COMMITTED생성 replay는 자동0/READY로 만들지 않는다.
- [ ] 현재 FN13 unconditional412를 실제 quota producer의 정확 검산으로만 연결한다. 새forward0059가0058 guard를 정확 원장/현재권한·역방향완결로 대체하고 원0058 bytes/loader는 불변이다. current coverage 없는 legacy프로젝트·미등록writer/UNKNOWN은 계속412다.
- [ ] full wrapper의 실제 source factory가 모든 증가 writer를 사용하는지 검증한다. 설명용 descriptor만으로 VERIFIED 발급0.
- [ ] 집중 통합은 reserve/start 각COMMIT→실메모리 put/adoption/checkpoint class→receipt/audit/ledger SETTLED를 끝까지 실행한다. 현재 실제 프로젝트 사용가능으로 승격하지 않는다.

## Q4 — Main 검수·통합·현황
- [ ] Primary 소유변경목록/정확명령·exit/RED→GREEN/미검증·오류횟수/복구방법을 제출하고 code writer를 해제한다.
- [ ] Main은 source/caller와 새SQL/기존guard 지문, 직접 영향 unit·type/메모리build·diff를 최종source에서 확인한다. Reviewer의 C/I0와 원형지문/보호3·복구본 보존을 대조한다.
- [ ] 관련 결과/WORK_STATUS·WORK_PLAN에 부분/미확인/미구현을 구분한다. 정확소유파일만 같은branch commit/private push, main/PR/배포0. 논리업무 경계에서 Main이 중간checkpoint할 수 있으나 Q1만 전체완료로 보고하지 않는다.
- [ ] 실제 PG/RLS/동시성·OS crash/원파일 usage·실 DB/schema적용·기존project초기화/차단해제·실서비스/Agent는 NOT_RUN/제외. 재개조건은 별도 실제 증거·정확 실행 결정이며 이번승인을 확대하지 않는다.
