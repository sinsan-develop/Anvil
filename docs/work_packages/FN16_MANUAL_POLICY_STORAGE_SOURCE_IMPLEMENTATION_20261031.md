# FN16 수동 백업 정책 저장 r2 A — 구현 WI

> 기존 Primary는 subagent-driven-development·TDD 절차로 아래 업무를 수행한다. Main은 관리·검수·통합만 한다. 신산님이 기존 담당자 사용을 명시했으므로 새 agent/세션을 만들지 않는다.

상태 MAIN_GO 예정 / DIRECT_HUMAN_APPROVED. 통제문서 독립 검수·게시 뒤 Main의 GO 메시지로 코드 착수한다.

목표: UI14에서 수동 백업 정책의 포함/제외·보호 ref·수동 한도를 작성하고, 필요한 전체 후보 승인 후 별도 명령으로 저장·보호 재조회하는 source 경로를 연결한다. 실제 backup/job/키/전체 프로필 발급이나 사용 가능 상태를 만들어내지 않는다.

기준: 직접승인00B3FC72B8B85FD1EACEB143C8DC42B4686561768FD8D214413F5B82DB693902 → r2결정53D2ED423629B6402BAAD1D42AAC5998A6F57AA6A4B15A0BB500AC158883FA0E + 부모158E10BC019C2647E488703865C12FA16AE008997CEF34CEBB431BF1C8D165D7. 시작 branch codex/av3-stage-b / HEAD7bc6818f88399621fa73357da462bc0295b35b59이며 통제문서 게시 뒤 실제 HEAD를 기록한다. 기술은 기존 React/TS·Node24/PG source 계약을 유지한다.

## 전역 제약·검수 초점

- 실제 DB/SQL 실행·권한/GRANT·키/Secret·사용자 파일 조사·서비스·Agent 실행·기존 프로젝트 차단 해제0. SQL은 .pending 하나만 작성한다. 기존 SQL·migration 적용목록·원문/Backup·보호3·다른 dirty는 수정하지 않는다.
- 새 정책/버전/후보3표, 프로젝트 합산10000행/67108864bytes·canonical 논리 bytes·head 차액·이력 산입/replay0. 기존0059 전체 용량으로 편입하거나 전체10GiB coverage라고 주장하지 않는다.
- 기본 coverage 포트 부재와 SELECTED_FILES_V1은 저장412. 원문/키·실경로를 입력·조회/로그에 노출하지 않는다. 신뢰 포트의 합성 성공은 실제 프로필이나 키 검사 증거가 아니다.
- 같은 code writer는 기존 Primary 한 명. Main 동일 code write0, Reviewer read-only. 새 branch/worktree/agent/자동화·force/history rewrite/main 직접수정0.
- 정상 외에 승인 후 payload/previousRef 변경·현재 ref/coverage 회수·한도 대기·replay/UNKNOWN·다른 client/transport·늦은 응답을 별도 반례로 고정한다. 기존 선택 파일 반출·다른 승인 operation·권한 guard·expectation을 보존한다.

## 정확 허용22경로

기존8 시작 SHA256:

| 경로 | SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | BF7919259818C3358FFB9216D8005E4DA782704632CAFAAB48D2D73792396886 |
| apps/server/modules/projects/routes.ts | 7C527F1E33679C3DBF77BA7E2882833E53C85A52AFF7A792D6E3EE6B7042E7A3 |
| apps/server/modules/approvals/project-approvals.ts | 552B86FC46CC3C6606F55C8A1194929968E1DE23210EF778D80F23F5EBC9249C |
| apps/server/modules/backups/backup-reference-store.ts | A86CC16149DCA20BAD84A14C03453ED08E993C94C1C00495FD0F300A37AB6C38 |
| apps/web/src/App.tsx | CE8DD8E43E59ADB21A74EF0D02323DE39F7246970636D22E08169166D20CCBEA |
| apps/web/src/features/decisions/api.ts | 23C259C563176AF80F6CA1AB716C70ACE0DFF979AE2877E946300B6C8553EA42 |
| apps/web/src/features/decisions/ApprovalsPage.tsx | 005102613714995542D645FBE8D63394E2A2729E0F2A40C8138E8865AD4DB3A1 |
| apps/web/src/features/connections/policy-editor-profile.ts | 1D94181DC2915AF0D4B756F8C47735FD7C31CC31755478F7DDCE973C66F63B41 |

신규14(Primary 부재 확인/0063 prefix 미점유):

```text
apps/server/modules/backups/backup-policy-input.ts
apps/server/modules/backups/backup-policy-store.ts
apps/server/modules/approvals/backup-policy-approval-candidate.ts
apps/web/src/features/backups/backup-policy-api.ts
apps/web/src/features/backups/BackupPolicyPanel.tsx
apps/web/src/features/decisions/backup-policy-approval-api.ts
tests/unit/FN16/backup-policy-input.test.ts
tests/unit/FN16/backup-policy-store.test.ts
tests/unit/FN16/backup-policy-approval.test.ts
tests/unit/FN16/backup-policy-schema.test.ts
tests/unit/UI14/backup-policy-api.test.ts
tests/unit/UI14/backup-policy.test.ts
tests/unit/UI08/backup-policy-approval.test.ts
db/migrations/0063_backup_policies.sql.pending
```

Primary는 GO 직전 시작 지문·부재만 재대조한다. 추가 인접 fixture가 필요하면 실제 경로·시작 hash·최소 사유를 Main에 먼저 보고한다. 허용 밖 변경·공통 구조 재작성·새 dependency/도구 도입0이다.

## 업무1 — 입력·한도·같은 Tx 보호 참조

- [ ] 실제 input/한도 함수 부재 RED를 먼저 실행하고 기존 exact key/ref/text/integer/canonical helper를 재사용한다. payload={policy,previousRef,reason}; policy의 네 ref/include/schedule/maxBytes, 자료군7의 명시 boolean/sourceSelection NONE·적어도1선택·MANUAL/정수·금지필드/비밀을 닫는다. 최초 null/0, 개정 previousRef 전체와 targetId/expectedVersion을 결박한다.
- [ ] 기존 BackupReferenceStore의 private owner/version/view 검산을 같은 db/actor에서 사용하는 한정 readForPolicy 접점으로 노출한다. public read(token)로 별도 인증 Tx를 중첩하거나 보호 검산을 복제·완화하지 않는다. 기존 public reader/소비자 동작은 보존한다.
- [ ] 새 내부 coverage/한도 신뢰 포트의 관측은 exact project/actor/client/control·policy canonical hash·네 ref/include/maxBytes·공급 세대/관측시각·최단 기한에 결박하고 재대조한다. port 부재/REAL 위장/SELECTED_FILES/무효 전체 coverage·한도 근거는412. 실제 전체 공급자·공개 profile ID/checks·키를 발급하지 않는다.
- [ ] 새3표 head/버전/후보의 닫힌 projection codec·hash/bytes를 source와 SQL에서 동일하게 정의한다. head는 {projectId,id,headVersion}, 버전은 r2의 고정 PolicyView 및 작성자/client, 후보는 r2의 보관원문 metadata다. 재생성 current/preview 제외·행/byte 각각 cap-1/cap/cap+1·head 차액/만료 보존을 검사한다.

## 업무2 — 원형 승인 후보·소비와 정책 저장·보호 조회

- [ ] 후보 전체를 새 backup_policy_approval_candidates에 capture/read한다. 기존 requestApproval의 details/candidatePayload 및 보호 상세 DTO 패턴을 사용하고 기존 prepareExecution 표/validator를 정책에 공용하지 않는다. 정책 전체 payload hash/이전 fullref·원 candidateCommandId/actionScope·requestApproval 원명령 hash/작성자/client/control·정책·receipt/audit를 재조합 검산한다. 승인 없는 새 권한이나 가짜 eligible은 만들지 않는다.
- [ ] 기존 ProjectApprovals capture/read/consumableOperations와 authorize/consume에 saveBackupPolicy만 추가한다. persistProjectReceipt가 새 ProjectApprovals를 내부 생성하므로 route 주입만 연결하고 실제 소비 검산을 놓치지 않는다. 후보 helper는 같은 db/actor로 소비 가능해야 하며 다른 operation의 decoder·DRAFT/일반 승인·정책 거절을 그대로 유지한다.
- [ ] 새 정책 명령은 기존 인증/OWNER/current control·명시 정책/기한을 검사하고 replay를 fresh write와 분리한다. 동일 원명령은 현재 접근과 원 receipt·후보/소비·버전 무결성을 검산해 원형을 반환한다. 새로운 CAS/coverage 조건을 과거 사실에 재적용해 재송신/두번째 소비·버전·charge를 만들지 않는다. 다른 본문409, UNKNOWN은 원명령만 재확인한다.
- [ ] fresh write는 현재 네 ref의 kind/project/hash/회수·적합성/RETENTION automaticDeletion=false와 전체 coverage·공급 세대/한도·previous head CAS를 검산한다. project 잠금 뒤 합산/쓰기전·receipt/audit/승인소비/버전/head 저장후 commit전 재검사한다. provider 대기후 DB관측/단조경과·현재 세션 최단기한을 재확인한다. 별도 Tx/부분 성공0, 외부 포트와 실제 DB COMMIT 원자성 주장은 하지 않는다.
- [ ] source command 결과 BACKUP_POLICY_STORED/ref/previousRef/backupCreated=false/executionAuthorized=false와 GET backup-policies 목록·id/versions/version을 원 후보대로 제공한다. query exact/raw query 보존, default50/max200·cursor4096/30분·domain/project/actor/client/limit/order/id ASC/version DESC 결박·서명/TTL·scope/body/hash/2MiB를 검산한다. 기존 timestamp ProjectListCodec에 정렬을 억지로 맞추지 않는다. 전체 시점 snapshot을 주장하지 않는다. 고정 역사 조회는 원문과 현재 eligible/reasonCodes를 구분하고 부재/권한·손상/회수불명을 빈성공으로 바꾸지 않는다.

## 업무3 — 미적용0063 DB 보호

- [ ] 새 backup_policies/backup_policy_versions/backup_policy_approval_candidates만 작성한다. 실제 기존 commands/approval_requests/receipts/audit 키·타입·RLS 패턴을 직접 대조하고 내부 server command id와 외부 UUID를 구분한다. 없는 UNIQUE를 FK로 가정하거나 부모표 유일성·GRANT를 바꾸지 않는다.
- [ ] 프로젝트 owner RLS·불변 version/candidate·head 허용열 CAS·UPDATE/DELETE/TRUNCATE 보호, source와 같은 canonical hash/projection/총량·project-first 잠금·한도 초과 실패를 구현한다. 새 head/버전/후보 전량·head 변경 차액/행수유지·같은명령0을 검산한다. 이력 삭제/자동 quota초기화0이다.
- [ ] 원command/request/후보·버전/head·receipt/승인소비/audit의 deferred 쌍방 완결을 검산한다. 부모표의 실제 scope_kind/scope_id와 project_id 구분, 원행 존재/종류 먼저 분류해 operation/result flag 변경으로 대상제외를 못 하게 한다. 무관 operation/기존 역사/DRAFT는 보존한다. 단순 GUC/태그를 권위로 쓰지 않는다.
- [ ] 실행하지 않는다. 실제 PG구문/trigger/FK/원자성/교착은 NOT_RUN이다. 정적 실제 DDL 대조·의미 분류모델을 token 존재 검사와 구분한다.

## 업무4 — UI14와 UI08 실제 source 연결

- [ ] 기존 반출/보호 참조/설치 패널을 보존하고 별도 수동정책 패널을 App에 연결한다. App 소유 buffer는 policy 편집·정확 이전 ref·원명령/UNKNOWN을 유지한다. 실제 기존 보호 ref 목록의 고정 버전을 명시 선택하고 합성 키/profile/목록을 제품에 등록하지 않는다. 기존 스타일·글자 크기/레이아웃을 재사용하며 화면 재설계0.
- [ ] 포함/제외7자료군/NONE·MANUAL·maxBytes/이유·네 ref/현재 사용 가능 여부를 표시한다. 편집/참조선택/조회만으로 POST/승인/키입력/실행하지 않는다. 실제 전체 profile 미지원은 이유를 보이고 저장을 막는다. source/전체백업생성 미지원과 미검증을 숨기지 않는다.
- [ ] 필요 승인 요청→UI08 전체 정책 후보 미리보기→별도 결정→UI14 복귀→명시 저장→고정/목록 조회를 연결한다. candidate hash만 표시해 검토한 것으로 간주하지 않는다. AUTO는 승인 임의생성0, REQUIRE_APPROVAL exact일회, DENY 거절을 유지한다. 선택/승인만으로 저장하지 않는다.
- [ ] API decoder exact shape/fullref/hash/project·byte 상한, same-origin 상대 URL/no-store를 유지한다. project/user/client/auth generation/transport/편집 version 변경·abort/늦은 JSON/hash/401·ABA에서 옛결과/옛승인을 버린다. UNKNOWN 같은명령 재확인·성공때만 목록history 이동, 신규명령 자동재시도0이다.

## 업무5 — 검증·제출·통합

- [ ] RED→GREEN은 입력/한도→같은 메모리 Tx의 후보/승인/정책 저장·목록/고정조회→UI 실제 이벤트 연결 순서다. new repo를 모사 성공값으로 바꾸지 말고 기존 보호 참조·정책/receipt/audit·승인소비를 가능한 만큼 실제 source로 조립한다. DB/source/coverage포트 대역은 명확히 밝힌다.
- [ ] 정상 최초/개정·고정/목록·전체후보승인/별도저장·replay0/COMMIT응답유실, 다른project/client/옛세대/만료/DENY·원문/ref/hash변조·선택한도/coverage회수·source미연결·상한/중간실패 전체 memoryrollback·SQL 원행/역검산분류와 보호조회 무관회귀를 검증한다. raw SQL은 실행하지 않는다.
- [ ] 신규7시험과 변경된 보호 참조/승인/명령·UI의 직접 인접 메모리 조건을 내용 확인 후 선택한다. 완료 FN08/다른 기능 전수·native/실fs/PG/process/키 시험은 제외한다. type/noEmit·변경UI memory build·diff를 실시한다. 실제 브라우저 시험이 별도 자원을 필요로 하면 정확 임시 이름/owner/수명/정리와 한도·포트/기존서비스영향을 Main에 먼저 보고한다. 미실행은 PASS로 표시하지 않는다.
- [ ] 서버/SQL 부분동결을 먼저 알리면 기존 Reviewer가 독립 검수한다. 마지막에는22경로 최종hash·실제명령/exit/REDGREEN·오류횟수/남은범위·livehandle/QA상태와 writer반환을 제출한다. Main이 fresh 범위검사/독립 C/I0·정확 소유경로만 기존privatebranch에 통합한다. source 합격을 실DB·served·전체FN16·계획완료로 승격하지 않는다. rollback은 소유commit 일반 revert, 실제자료/DBrollback은 없다.
