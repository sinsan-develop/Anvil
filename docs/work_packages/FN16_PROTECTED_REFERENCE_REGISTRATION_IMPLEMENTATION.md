# FN16 보호참조 등록 구현 준비 계획

> 수행 방식: 기존 단일 writer가 단계별 Main TEST_ONLY → fresh RED → 제품 GO를 받아 실행한다. 실행 시 executing-plans 절차를 적용하며 이 문서 자체는 실행 GO가 아니다.

**현재 상태: SOURCE_ADOPTED_DOCUMENT_REVIEW_ONLY**

2026-10-28 신산님 직접 지시 “FN16 보호참조 계약과 P03 R2 복제 1회 둘 다 승인해. 계속 진행해.”를 Main이 전달했다. FN16 CA777 후보의 source-only 채택 대기는 해소됐다. 현재 기준은 Main 지정 625f4255이며 정확 full HEAD/Git 상태의 기록·확인은 Main 소유다. 제품8·보호12·완료코드2의 실제 raw를 재대조해 모두 기존 manifest와 일치함을 확인했고 0053 후보 파일은 여전히 부재다.

0050 점유로 인한 0053_backup_references.sql.pending 재배치는 동일 계약의 비의미 번호 재배치로 반영한다. 원 CA777의 0050 명칭은 과거 후보 원문에 보존한다. 승인 기록 파일은 Main이 별도 작성하며 이 문서가 승인 기록을 대신하지 않는다. 현재 author GO는 문서2 갱신뿐이며 문서검토/기준확인 뒤 Main TEST_ONLY 배정 전에는 제품·시험·SQL 생성과 실행 모두0이다. 실제 DB·권한·키·서비스·Agent는 제외한다. P03 actual은 Main 단독 소유로 이 FN16 업무에서 접근·실행하지 않는다.

아래 4191a7fa/PENDING 및 PMO 번호대조 대기 문구는 최초 준비 당시의 이력이다. 현재 채택 상태는 이 갱신 절이 우선하며, 원 pending 이력과 원문을 삭제하지 않는다.

**최초 준비 상태(보존 이력): PENDING_EXACT_PMO_SOURCE_ADOPTION**

목표는 보호참조 metadata의 등록·개정·정확 버전 조회·신규 사용 회수를 UI14에 연결하는 source-only 단위다. 기존 TypeScript/Fastify/React/PostgreSQL pending source 패턴을 사용하고 새 의존성·범용 구조를 만들지 않는다.

기준 HEAD는 4191a7faf67d1f7b56b79eb89c269ddcfb0ad5b1, branch는 codex/av3-stage-b다. Main 지정 현재 상태는 관리 현황 dirty1이며 App 및 사용자 dirty를 보존한다. 작성자는 Git·현황 파일을 변경하지 않는다. 실행 source는 등록 source 참조로 관리하고 이 문서의 상대 경로는 그 기준이다.

## 1. 채택 근거와 아직 필요한 결정

정확 후보는 docs/contracts/FN16_PROTECTED_REFERENCE_REGISTRATION_CONTRACT_R2.md, SHA256 CA7774F7A5C102B2B6EDD3D5D6E87701FEADE197E91B2186D05F4AACFE30AA21이다. 기존 B 방향 상세화와 상위 FN16 계획은 이 후보 전체의 정확 source 채택을 대신하지 않는다. PMO 기존 질문의 답변과 채택 근거는 아직 없다. 질문을 중복 발행하지 않는다.

원 후보의 0050_backup_references.sql.pending는 기존 0050_design_baseline_activations.sql.pending와 충돌한다. 현재 inventory의 최대 번호는 0052이며 0053_backup_references.sql.pending는 번호 재배치 후보일 뿐이다. 기존 질문에 0053가 자동 포함됐다고 주장하지 않는다. PMO가 기존 질문의 파일 범위·번호 영향을 대조하고 정확 채택 기록과 Main 재확정을 남기기 전 SQL 생성도 금지한다. 원 CA777 후보는 덮어쓰지 않는다. 실제 작성 직전 번호 부재를 다시 확인한다.

현재 허용은 이 WI와 SOURCE_MANIFEST 문서2의 준비뿐이다. 제품·시험·SQL·환경 생성·실행 GO는 모두 없다. 이후 단계도 정확 채택 → Main preflight → TEST_ONLY → Main 실제 RED → 해당 제품 GO 순서를 따른다.

## 2. 고정 관리 표면

기존8과 신규12의 정확 경로·기존 raw/LF SHA는 동명 SOURCE_MANIFEST에 고정한다. 기존8의 책임은 다음과 같다.

| 기존 경로 | 한정 역할 |
|---|---|
| apps/server/modules/access/project-command.ts | 새 명령2 분기와 보호 replay 접점 |
| apps/server/modules/projects/routes.ts | 기존 projects scope에 GET4/command 연결 |
| apps/server/modules/approvals/approval-input.ts | 새op2의 엄격 actionScope 입력 |
| apps/server/modules/approvals/project-approvals.ts | 공유 지원목록·실 일회 승인 소비 정합 |
| apps/web/src/features/connections/policy-editor-profile.ts | 명시 정책의 새op2 선택 |
| apps/web/src/features/decisions/api.ts | 승인 DTO/표시 소비 정합 |
| apps/web/src/features/decisions/ApprovalsPage.tsx | 새 동작의 승인 표시 |
| apps/web/src/App.tsx | 현재 actor/client/project/control과 UI14 연결 |

신규12는 contracts/runtime/backup-references-v1.ts, server backups의 backup-resource-provider.ts / backup-reference-store.ts / backup-reference-routes.ts, web backups의 backup-reference-api.ts / BackupReferencePanel.tsx, db/migrations/0053_backup_references.sql.pending 후보, unit FN16의 backup-reference-input.test.ts / backup-reference-store.test.ts / backup-reference-routes.test.ts, unit UI14의 backup-reference-api.test.ts, browser UI14의 backup-reference.spec.ts다. 전체 exact path는 manifest에서만 허용한다.

문서2+결과1을 포함한 관리 표면은23경로다. 추가 fixture/harness/config/제품 파일은 허용하지 않는다. 필요한 경우 먼저 정확 근거를 Main에 보고한다. 기존 시험은 읽기·직접 인접 검증만 하고 바이트를 수정하지 않는다. 4191a7fa 미전송 API/Panel과 보호 기존4·untracked8을 별도 보존한다. App은 이번 기존8에 포함된 기준 파일이며 영구 readonly라는 뜻이 아니다. 정확 제품 GO 전에는 App도 수정하지 않는다.

## 3. 계약 보존

GET prefix는 /api/v1/projects/:projectId다. 신규 GET4는 /backup-resources(kind TARGET|ENCRYPTION_KEY 필수), /backup-resources/:id/versions/:version, /backup-references(kind 선택), /backup-references/:id/versions/:version이다. 목록 limit 기본50/최대200, cursor 최대4096/30분, createdAt/id 내림차순이며 domain/project/actor/client/kind/limit/order/expiry를 결박한다. 잘못된 cursor400 후 첫 페이지 fallback은 없다. 고정 GET에는 query를 허용하지 않는다. 모든 응답 no-store다.

읽기는 현재 로그인·active project OWNER 및 민감 접근을 확인하되 control을 요구하지 않는다. 쓰기는 HUMAN actor/client/OWNER/controlGeneration·명시 PROJECT 정책·시간·CSRF·hash·receipt/audit를 대조한다. 타 사용자/프로젝트는404로 닫는다. 새 DTO/query exact key·중복 JSON key·lower UUID/hash·positive safe version을 엄격 검증하며 기존 encapsulated parseWireJson 경계를 재사용한다. displayName1~120/reason1~2000 UTF16, 공백뿐/NUL/control 문자는 거절한다.

saveBackupReference payload는 {kind,displayName,spec,reason}; 신규 target null/expectedVersion0, 개정은 동일kind/current head CAS다. receipt는 REFERENCE_STORED/ref/previousRef다. revokeBackupReference payload는 {referenceRef,reason}; 외부 target와 ActionScope.targetRef는 현재 body head fullref/expectedVersion이고 payload는 실제 회수할 정확 과거 또는 현재 버전을 결박한다. receipt는 REFERENCE_REVOKED/event ref/referenceRef다. 회수는 정확 버전당 UNIQUE event이며 body head를 변경하지 않고 키/파일을 삭제하지 않는다. stale head409 VERSION_CONFLICT, 다른 명령의 중복 회수409 REFERENCE_ALREADY_REVOKED, 같은 명령 다른 body409 COMMAND_CONFLICT로 닫는다. 자동 rebase/retry는 없다.

ReferenceView hash는 canonicalJson({projectId,id,version,snapshot,previousRef})다. commandRecordId/clientCommandId/operationId/auditEventId는 실제 DB 영수증·감사와 대조하며 가짜 VersionRef를 만들지 않는다. authorizationReceiptRef는 내부 권한 대조에 쓰고 DTO 임의 필드를 추가하지 않는다. immutable snapshot과 current{eligible,reasonCodes,observedAt}를 분리한다. 회수 event snapshot/hash는 원 후보의 eventId/version1/eventKind/projectId/referenceRef/reason/actorId/clientId/clientCommandId/createdAt만 사용하며 미래 receipt/audit/hash를 자기참조하지 않는다.

기본 provider는 UNCONFIGURED, eligible=false다. 실 descriptor가 없으면 resource list는 빈 페이지, fixed resource는 인증 후404다. TARGET/ENCRYPTION_KEY 저장은 BACKUP_RESOURCE_PROVIDER_NOT_CONNECTED 또는 KEY_PROTECTION_UNVERIFIED로412, VERIFICATION은 실제 checks/limits 없으면 REFERENCE_UNAVAILABLE로412다. RETENTION {automaticDeletion:false} metadata 저장만 양성이다. 원 후보의 current reasonCodes와 DTO enum을 임의 확장하지 않는다. raw path/key/internal handle/Secret을 응답·로그·Agent에 전달하지 않는다. DPAPI/임의 exportRoot/randomUUID fallback이나 빈 provider 성공 표시는 금지한다. saveBackupPolicy/createBackup/restore·실 key enroll/unlock/recovery-kit은 이번 범위가 아니다.

## 4. 서버·SQL 보안 접점

새 RLS 표의 첫 조회·replay 전에 authenticated callback의 trusted actor/client를 transaction-local GUC로 설정한다. command GUC는 실 persistProjectReceipt의 명령만 사용한다. 새op2의 replay는 현재 OWNER·민감 접근·원 ref/hash/receipt 대조 후 보호 투영으로 반환하고 공통 raw replay 조기반환으로 우회하지 않는다. 기존 다른 operation의 replay/권한 기준을 바꾸지 않는다.

DENY/명시 정책 없음은 거절하고 REQUIRE_APPROVAL은 기존 FN11 authorize/consume를 같은 transaction에서 실제로 사용한다. current policy exactref와 최초 최단 유효창을 늘리지 않고 잠금 대기 후 DB clock/회원/control/session/head/provider를 재대조한다. metadata/receipt/audit/승인 소비는 원자적이며 실패 시 rollback한다. 입력 id/eligible/READ 표시를 권한으로 삼지 않는다.

0053 후보는 복합 project FK/previous FK/head CAS, immutable version/event, 회수 unique, RLS/FORCE RLS·최소 role 권한·guard를 source로 준비한다. 기존0050/0051/0052와 적용 manifest를 수정하지 않는다. 기존 guard 함수를 후속 정합할 때 현재 전체 지원 연산·승인 소비·원본 불변/기한/nonce 검사를 복사 누락하지 않는다. SELECT-only 불변 표에 UPDATE권한을 요구하는 불필요 FOR SHARE를 넣지 않는다. broad GRANT/새 role/임의 definer 확대는 금지하며 필요성은 먼저 검수한다. pending 정적시험은 실 PG compile/RLS/COMMIT 증거가 아니다.

FN17 reader는 project-approvals의 consumableOperations를 공유 import하고 producer/current SQL은 candidate operation을 일반 경로로 처리한다. 새op2를 공유목록에 추가하면 기존 request 동일transaction notification/cap10000/current/deferred guard에 영향을 준다. 현재 별도 notification 제품 수정은 필요하지 않은 것으로 읽기 대조했다. notification/receipt/request/capture의 같은transaction 원자 rollback, replay 생산0, cap 실패 rollback을 새 store/routes 시험에서 확인하고 기존 FN17 직접 인접2를 선택 검증한다. 기존8 밖 제품 수정 필요가 발견되면 확대 쓰기 전에 Main에 보고한다.

## 5. TDD와 독립 검수 블록

- [ ] 정확 source 채택·0053 번호 범위 대조 기록을 Main이 고정하고 기존 raw/보호/부재 preflight를 재확인한다.
- [ ] 입력 블록 TEST_ONLY: backup-reference-input.test.ts에서 DTO/중복key/UUID/version/hash/target-head 결박·원 후보의 kind/spec/길이 오류를 정확 오류 predicate로 고정한다. Main이 부재 기능 RED를 직접 확인한 뒤 runtime/input 관련 제품 접점만 GO한다.
- [ ] 보호 store/routes+SQL 블록 TEST_ONLY: 실제 public GET/command와 opt-in fake DB/provider를 사용한다. 기본 UNCONFIGURED 거절/RETENTION 양성·현재성 회수·head CAS·과거버전 회수·명령 충돌·현재 보호 replay·GUC 순서·receipt/audit/승인 consume 원자 rollback·cap rollback을 고정한다. unexpected SQL/TypeError가 정상 거절로 통과하지 않도록 정확 AuthFailure/status/code와 도달 횟수·순서를 검사한다. Main fresh RED 후 해당 제품/신규 pending SQL만 GO하고 독립 계약/SQL 검수를 받는다.
- [ ] UI 블록 TEST_ONLY: API exact wire/응답 검증·목록 cursor 격리·actor/client/project/control ABA·late JSON 숨김·old ref 명시 선택·회수 후 eligible=false와 승인 명시 소비를 고정한다. 실제 provider 없는 상태를 연결 완료로 표시하지 않는다. Main RED 후 API/Panel/App/정책·승인 표시 접점만 GO한다. UI 직전 craft-floor와 기존 CSS 패턴을 읽으며 새 CSS/디자인 문서는 만들지 않는다.
- [ ] 각 블록 첫 GREEN 후 기존 기대·raw/diff·미검증을 제출하고 동결한다. Main은 독립 검수와 직접 검증을 수행한다. 실제 browser는 별도 fresh QA root/owner/수명/부재·정리 계획을 Main이 등록하고 한정 GO하기 전 실행하지 않는다. 사용자에게 새로운 키나 실 연결 입력을 요구하지 않는다.

정확 계획 명령(현재 미실행):

    node --test --test-reporter=spec tests/unit/FN16/backup-reference-input.test.ts
    node --test --test-reporter=spec tests/unit/FN16/backup-reference-store.test.ts tests/unit/FN16/backup-reference-routes.test.ts
    node --test --test-reporter=spec tests/unit/UI14/backup-reference-api.test.ts
    node --test --test-reporter=spec tests/unit/FN17/approval-notification-reader-operations.test.ts tests/unit/FN17/approval-notification-request-transaction.test.ts
    node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json

browser 파일은 tests/browser/UI14/backup-reference.spec.ts만 보강 대상이며 실제 실행 명령/QA 경로는 Main 등록 후 고정한다. 기존 완료 업로드/공유/UI08/전체 FN17 회귀를 무작정 반복하지 않는다. 기존 시험의 기대·바이트는 그대로 보존한다.

## 6. 검수 초점·오류·재개 조건

주요 검수는 ① 비지원 provider의 거짓 성공 ② 같은 body처럼 보이는 다른 actor/client/project/epoch ③ 오래된 head로 과거버전 회수 ④ 잠금·승인·cap 대기 중 기한 만료와 rollback ⑤ immutable 원본을 가짜 ref/현재 metadata로 바꾸는 경우다. 각 항목을 소유 블록의 양성/음성 시험에 포함한다. 함수 이름 등 내부 선택은 채택 후 기존 접점에 맞추며 새 공개 계약으로 확정하지 않는다.

조사 오류 이력: 부가 검토 문서를 docs/work_packages/FN16_PROTECTED_REFERENCE_CONTRACT_REVIEW.md로 읽으려 한 경로 오류1이 있었다. 정확 경로는 docs/contracts/FN16_PROTECTED_REFERENCE_CONTRACT_REVIEW.md이며 원 CA777 전문 읽기는 성공했다. 잘못된 부가 조회를 계약 근거로 사용하지 않았고 파일 영향0/제품 실패0/정식 FAILURE_REPORT 횟수0이다. 이후 rg --files/실 import의 exact path를 사용한다.

문서준비 시 신규12·결과1·문서2는 양쪽에서 부재를 확인했다. 실제 Git 상태는 Main 확인 책임이며 작성자가 재실행하거나 변경하지 않는다. 현재 실DB/SQL/권한·provider·키·서비스·Agent·browser·served·사용자 인수는 NOT_RUN이다. 전체 FN16/Stage/계획 완료를 주장하지 않는다. 정확 채택·번호 대조·Main GO 후에만 다음 단계로 재개한다. 원 후보/보호 파일·기존 미전송 완료코드·기존 SQL을 보존하며 rollback은 Main이 source-only 해당 단위의 정확 diff를 선택 복구하고 실제 DB 되돌리기로 주장하지 않는다.

## 7. 직접 승인 반영 후 재개 경계

현재 source 채택 및 0050→0053 비의미 재배치 반영은 완료했다. 최초 준비의 승인 대기 체크는 이 갱신으로 해소하며 Main approval 기록과 preflight/TEST_ONLY 지시를 연결한 뒤 입력 블록부터 재개한다. 지금 제품/시험/SQL GO는 없고 기존20+문서2+결과1의23경로만 관리한다. 기존raw8·보호12·미전송 완료코드2의 실제 바이트 재대조는 전부 일치했다. 문서 외 변경·시험/타입/환경 실행·Git 작업은0이다.
