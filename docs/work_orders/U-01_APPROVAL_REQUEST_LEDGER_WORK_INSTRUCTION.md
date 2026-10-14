# U-01 실제 승인 요청 저장·조회 구현 계획 / 2026-10-14

> 실행: 프로젝트 고정 단일 `developer-primary`가 유효 dual lease로 순차 TDD한다. Main은 같은 source에 쓰지 않는다. 내부 계획·비의미 세분화는 프로젝트 AGENTS §5.1에 따라 Main이 관리하며 같은 승인을 반복 요청하지 않는다.

**Goal:** 검증된 실제 계획 확정에서 승인 요청을 원자 저장하고 정확 조합 Dashboard에서 현재 대기 요청을 조회한다.
**Architecture:** Task 기반 내부 Main 권위 원장→계획 확정 서비스→요청/감사 원자 저장→인가 후 read-only scoped source→기존 GET/UI. 사람 승인·Run 실행과 분리한다.
**Tech Stack:** Python/SQLAlchemy/Alembic/PostgreSQL15, 기존 React/TypeScript/Node tests. 신규 의존성0.
**Spec:** `docs/04_test_reports/U-01_APPROVAL_REQUEST_LEDGER_CONTRACT_PROPOSAL.md` SHA256 `9BAF4FAEB4454EDC2ED1151C30F614ABAEB55E3AE5F10C34533B4FB1DC7A0010`, 승인 `APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001` 및 `APPROVAL-20261014-U01-TASK-PLANNING-AUTHORITY-001`. 설계 §5.4/10.4/29.2·U-01. 신규 schema/권한/응답 확장은 사람 승인된 의미 변경이며 비의미 변경으로 가장하지 않는다.

## 공통 제한·권위 계약

1단계 로컬/WSL 기능 구현이다. 기존 branch `codex/u01-dashboard-r2`만 사용한다. main/PR/새 branch/Oracle/ysna/Production/예약/다른 프로젝트/외부비용0. 기존 Run·Queue·Agent·DB·로그아웃·ACK·기간 계약 보존. 무관한 구조 개편0. 운영자가 내부 CLI를 다룰 필요 없이 요청은 Main 계획 수립 서비스가 만들고 Dashboard에서 읽는다. U-02의 계획 입력 UI/사람 결정은 이번 대상이 아니다.

내부 논리 주체 `anvil-internal-planning-main`, 역할 `INTERNAL_MAIN`, 단일 내부 permission `approval-requests:create`. OIDC reader/users/roles/pair-grant의 기존 권한을 확대하지 않으며 새 공개 route/로그인/Secret/인증서를 만들지 않는다. 이 이름만 전달해 인가하지 않는다. 신뢰된 embedding host가 발급·보관하는 Task별 authority ID와 무작위 fencing capability를 별도 영속 행에 결박한다. DB에는 capability의 SHA256만 저장하고 wire/UI/log에는 원문을 내보내지 않는다. host authority 발급 port는 HTTP에 연결하지 않고, 조회 reader나 producer 자신이 발급/갱신/회수할 수 없게 creator와 registrar를 별도 객체로 분리한다. 발급은 Main의 인가된 내부 host 제어 경계에서만 명시 호출하며 app startup·생성 요청 때 자동 발급0. root 제어권이 없는 브라우저·DTO actor·tasks.requested_by·C30 owner·가짜 Run을 권위로 쓰지 않는다.

권위 행은 actor/role/permission, 정확 task/project/environment, plan id/hash, WI id/hash, mode snapshot id/hash, authority event hash, epoch, issued_at/expires_at/revoked_at를 고정한다. DB 시간 기준 최대1시간, issued<=now<expires, 최신 epoch만 유효, 회수는 append-only 감사와 원자 변경. 새 epoch/해시 변경/회수 뒤 이전 capability는 즉시 거부한다. 첫 요청은 Run이 없어도 허용하지만 Run 재계획이면 실제 Run의 Task/pair·현재 worker 소유/fence도 검증한다. 원장 권위는 작업용 Git dual lease와 별개 제품 계약이다.

Review Focus: 최초 Run 없는 생성/순환 방지; 위조·만료·회수·다른 Task/pair 경계; 멱등·경합·hash 대체; 원본 장애/overflow/일부 자료를 0으로 숨기지 않음; UI stale/escape/logout와 비밀·자동실행 금지.

## 정확 허용 source 경로 (단일 writer, 15개)

- 신규 `migrations/versions/0021_approval_requests.py`: 기존0020 이후, 요청/요청감사/Task 권위/권위감사 4테이블·제약·인덱스. 과거 행/기존 권한 변경0.
- 신규 `packages/planning/approval_requests.py`: 명령/receipt/신뢰 host principal 타입, 검증된 계획 확정 서비스, 내부 producer/registrar 분리.
- 신규 `packages/persistence/approval_request_repository.py`: DB 권위·계획/request/event 원자 저장·멱등·회수·상태 판정.
- 신규 `packages/persistence/operations_approval_request_read.py`: readonly repeatable-read 현재 모집단·projection.
- 수정 `packages/api/scoped_dashboard.py`: 검증된 approval source만 current.approvalPending/sourceCompleteness에 연결.
- 수정 `apps/api/anvil_api/oidc_process.py`: 기존 exact-pair 인가 뒤 reader 연결 및 HTTP 비노출 host producer 구성. 기존 auth·routes/registry·required head 설정 무단 변경0.
- 수정 `apps/web/src/console/App.tsx`: 승인 요청 대기 카드·목록·시각/empty/unavailable·기존 Run 카드 유지.
- 수정 `apps/web/tests/f15-console.test.mjs`: 실제 panel RED/GREEN 및 영향 UI 회귀.
- 신규 `tests/planning/test_approval_request_service.py`: producer/registrar 분리·실제 계획 검증·비밀 안전 테스트.
- 신규 `tests/persistence/test_approval_request_repository.py`: 로컬 portable 저장/제약/멱등/권위/상태 검증. PG lock 증거와 구분.
- 신규 `tests/api/test_u01_approval_request_reader.py`: source/API projection·거부 선행·장애 테스트.
- 신규 `tests/integration/test_u01_approval_request_pg15.py`: opt-in PG15 migration·실제 producer/DB/read·동시성/회수/실패 원자성.
- 수정 `tests/api/test_oidc_process.py`: host wiring·등록 조합 인가·미구성 fail closed 인접 회귀.
- 수정 `scripts/check_project_progress.py`: 이번 W21/A20/C20/M20/B20/H20/tail의 additive fail-closed route만.
- 수정 `tests/tooling/test_u01_postmerge_control_projection.py`: 이번 positive/음성 및 직전 frozen fixture 호환. 기존 기대/위조 검사 완화0.

추가 경로 필요는 Main에게 먼저 근거 보고한다. Developer 문서·scratch·stage/commit/push·서버·DB 외부 연결·새 agent0. Main 소유 기존 dirty 문서를 보존한다.

## Task 1: 영속 권위·실제 생성 수직 절편

**Interface:** `ApprovalRequestService.finalize_execution_plan(command, trusted_authority)` → request receipt. 내부 repository `create_execution_plan_request(command, trusted_authority)`를 사용한다. command는 실제 typed `ExecutionPlan`·Task/pair·frozen mode snapshot/id·idempotency key·optional Run 참조를 포함하며 actor는 command에서 받지 않는다. host principal은 내부 고정 actor/role/permission과 authority id/capability를 포함하며 DB 대조 전까지 신뢰 완료로 취급하지 않는다.

- [ ] RED: 실제 계획 객체와 저장된 Task/등록 pair/WI의 정상 확정→Run NULL 요청1+REQUESTED 감사1, 같은 내용 재시도 동일ID를 기대하는 테스트를 실행해 미구현 실패를 확인한다. 단순 mock 호출 카운트로 대체하지 않는다.
- [ ] RED: 잘못된 actor/permission/capability/Task/pair, 만료 정확 경계·회수/epoch, WI/plan/mode hash 불일치에서 요청·계획·감사 부분 저장0을 단언한다.
- [ ] GREEN: migration4테이블을 추가하고 creator와 registrar를 분리한다. registrar는 host control plane 전용이며 public port/reader에서 도달불가. Task→project/repository/environment active mapping·등록 pair·상위 artifact 계보와 typed plan content hash·분석/영향 hash·WI범위를 검증한다. 기존 execution_plans에 VALIDATED metadata를 저장하되 APPROVED를 만들거나 approval_records를 쓰지 않는다. plan_id 충돌은 다른 내용을 덮지 않고 거부한다. mode는 기존 실행모드 모델을 우선 사용하고 없으면 Secret 없는 strict allowlist의 canonical frozen snapshot을 정의한다. 임의 JSON/actor/prompt/비밀을 신뢰하지 않는다.
- [ ] RED/GREEN: 같은 key 다른 fingerprint409, 같은 unresolved subject/mode 재시도 동일ID, 동시 요청1건, 다른hash→SUPERSEDED 감사+새ID, expired 후 새key 재요청, CANCELLED/INVALIDATED·원본미확인/부분감사 분리. request/authority audit UPDATE·DELETE 거부, 전체 transaction rollback 단언. hash `sha256:`+lowercase64, DB now+3600초·UTC, 시간/타입/길이/JSON/중복 strict. Run 재계획 fence·scope 음성 포함.
- [ ] 대체의 단일 unresolved subject는 `(task_id, project_id, environment_id, request_kind)`다. 같은 plan_id에 다른 content를 덮지 않는다. 변경된 계획은 새 plan_id로 제출하고 같은 Task subject의 앞 요청을 원자 SUPERSEDED한다. mode만 달라도 새 요청이며 이전 미해결 요청은 대체한다.
- [ ] 로컬 verification: 신규 planning/persistence 테스트 및 기존 planning 승인guard/Task bootstrap의 직접 영향 부분만 1회. SQLite PASS를 PG lock/정식 WSL PASS로 주장하지 않는다. 신규 의존성0.

## Task 2: 현재 조회·실제 화면

**Interface:** `load_scoped_approval_request_source(engine, project_id, environment_id)` → detached source `observed_at/items/status evidence`. 호출은 기존 exact-pair actor/dashboard:read/active grant 확인 뒤만 한다. public metric items exact8: requestId/taskId/runId|null/requestKind/planId/planHash/requestedAt/expiresAt.

- [ ] RED: 실제 producer 저장자료가 인가된 GET current.approvalPending에 source approval_request_ledger/현재count/items로 나타나며 1d/7d/30d에 현재 모집단이 동일한지, reader 생성 불가·다른pair/철회403 조회 전 차단을 확인한다.
- [ ] GREEN: 단일 read-only repeatable-read에서 DB 관측시각·Task/pair·subject/mode·감사·유효 HUMAN plan+mode approval을 대조한다. 대기/만료/대체/취소/무효/충족을 구분하고 PENDING만 current count에 넣는다. SATISFIED는 정확한 유효 사람 승인 두 종류가 있을 때만이며 Run 실행은 안 한다. 100건/101 overflow·누락·중복·형식오류·schema/DB 장애면 UNAVAILABLE/count:null, 완전한0만0. page 일부만 세지 않는다. 만료/무효 자료를 정상대기/승인으로 바꾸지 않는다.
- [ ] UI RED/GREEN: `승인 요청 대기`의 실제 count/Task/plan/요청·만료시각·empty/unavailable를 표시한다. 승인·반려·실행 버튼0. exactpair/complete/observed/fresh 검증·중복/overflow/enum/hash/time/escape 음성, 5분 source stale 및 요청 만료 시 표시 갱신, logout/선택변경 이전자료 소거. generic contract와 기존 Run 대기카드는 구분한다. 새 fetch/절대URL0.
- [ ] 신규 UI+API tests, web type/lint/build 및 영향 web suite는 각1회. broad R6/전체Python/다기기·부하 반복0. 직접 영향 실패는 보고·좁은 회귀로 해결하며 기준완화0.

## Task 3: 단일 branch 통제·WSL 기능 확인

W21은 직전3ee62694 직접 자식 제안서A, 승인원장A, Task권위승인A, 본WI A, Invocation A, WORK_STATUS M, design_change M **정확7**이다. 별도 중복 권위계약 문서는 만들지 않는다.

A20은 W21 직접자식 Event/progress/HANDOFF/detached digest/STATUS 정확5. seq1~2429 raw prefix 보존→2430 WI→2431 epoch129 worker→2432 write ACTIVE·서로 다른 token·24시간·허용15source. actor `developer-primary-u01-approval-request-ledger`, subject `U-01/APPROVAL-REQUEST-LEDGER`, step `U01_APPROVAL_REQUEST_LEDGER`, WI id `WI-U01-APPROVAL-REQUEST-LEDGER-20261014-001`. approval_classification=HUMAN_APPROVED_TASK_SCOPED_INTERNAL_REQUEST_AUTHORITY. binding `u01_approval_request_ledger_binding`·status/mode `U01_APPROVAL_REQUEST_LEDGER_ACTIVE`·action `U01_APPROVAL_REQUEST_LEDGER_IMPLEMENTATION_ONLY`, snapshot `snapshot-u01-approval-request-ledger-a20-seq2432`, keys w21_checkpoint/a20_docs_checkpoint/control_checkpoint/manifest_checkpoint/previous_result_checkpoint/active_projection_checkpoint. approval2/path/hash·제안hash·WI/Invhash를結박한다.

C20은 A20직접자식 허용source 15 이내. M20은 C20직접자식 신규 `deploy/wsl/U01ApprovalRequestLedgerReleaseManifest.json`+STATUS 정확2. schema `u01_approval_request_ledger_manifest/v1`, sourceC20·변경source Gitblob SHA256·DB0020→0021·Web/API immutable ID·이전M19 manifest/hash·기존issuer/origin/retained rollback·NOT_ACCEPTED/DEFER를 결박한다. 실제 immutable image가 없으면 M20을 발행하지 않는다.

M20 exact schema(모든 객체 extra/missing key 거부, null 금지): top keys는 `schema_version,environment,acceptance,release_decision,source_commit,source_files,predecessor_manifest_commit,predecessor_manifest_sha256,origin,images,image_sources,retained_source_files,database,rollback,unchanged`다. schema/environment/acceptance/release/origin은 위 literal 및 `WSL_SERVER_TEST_STAGING`/`NOT_ACCEPTED`/`DEFER`/`https://172.27.253.53:3770`. commit은 lowercase40hex, 파일/proof hash는 uppercase64hex, image는 `sha256:`+lowercase64hex, container ID는 lowercase64hex다. source_files는 C20에서 실제 변경된 허용 source path→Git blob SHA256 map이며 변경 누락/미허용 추가 거부. predecessor는 M19 `639992c9e01de2bb151c639e91089c2c1aa31818`의 `deploy/wsl/U01WaitingApprovalRunReleaseManifest.json`와 그 Git blob SHA256 `1D68A2A11D03B0DD415BCC16E535EF6810CED8C28225B3E78D0B4689837FB8FA`로 고정한다. `images`/`image_sources`는 exact api/issuer/web 문자열 map; api/web 새 실측 immutable ID·sourceC20, issuer는 M19와 동일하다. retained_source_files는 M19 exact4/hash 그대로다.

`database` exact keys: `previous_revision`=`0020_f19a_pair_grants`, `target_revision`=`0021_approval_requests`, `data_policy`=`PRESERVE_EXISTING_AND_APPROVAL_AUDIT`, `backup_proof_sha256`, `restore_proof_sha256`. 뒤 두 hash는 이번 적용 전 실제 backup/restore 비밀 없는 proof의 SHA256이며 미실행이면 manifest 발행 금지다. `rollback` exact keys `api,web,database_policy`; 각 api/web는 exact `container_id,image_id,source_commit` map, api는 ID `3c52b542ae951f0ab20c7d22ee5de43324cbe537a7e09193111001398f3a24dd`/M19 api image/source, web는 ID `1497bbf9b76b319bd82233267f58aebb542e6f21b76685e908e759b0b12b7b41`/M19 web image/source와 동일. database_policy는 `NO_DOWNGRADE_PRESERVE_ROWS_DISABLE_FEATURE`다. `unchanged`는 순서 포함 exact `[ISSUER,READER_AUTH,CREDENTIALS,CERTIFICATE,NETWORK,RETAINED_ROLLBACKS]`. proof/tuple/hash/타입/순서/계보 위조 거부를 검사한다.

Health 정합성: 새 API의 F19A required head는 `0021_approval_requests`로 정확 변경한다. 미적용0020에서는 새 원장·새API Health를 정상으로 꾸미지 않는다. F19A OFF의0019 규칙·기존 다른auth는 보존한다. 이전 API rollback은0020만 강제로 허용하도록 완화하지 않고 신기능 미제공/기존 Health의 head 불일치 가능성을 명시하며 자료보존을 우선한다.

B20 M20직접자식 progress/HANDOFF/digest/STATUS/DEVELOPMENT_ENVIRONMENT 정확5·Event2432불변·active_projection_checkpoint=null. action `U01_APPROVAL_REQUEST_LEDGER_CLOSE_READY`, snapshot `snapshot-u01-approval-request-ledger-b20-seq2432`.
H20 B20직접자식 Event/progress/HANDOFF/digest/STATUS 정확5,2433write→2434worker REVOKED·active0. completed keys `completed_u01_approval_request_ledger_{write,worker}_lease`, Event ids `evt_u01_2433_approval_request_ledger_write_lease_revoked`/`evt_u01_2434_approval_request_ledger_worker_lease_revoked`, close step `U01_APPROVAL_REQUEST_LEDGER_CLOSE`, mode/status/reason `U01_APPROVAL_REQUEST_LEDGER_CLOSED`, action `U01_APPROVAL_REQUEST_LEDGER_RECORDED_U01_PENDING`, snapshot `snapshot-u01-approval-request-ledger-h20-seq2434`. H에서만 active_projection_checkpoint=B20. 첫 report H20직접자식 `docs/04_test_reports/U-01_APPROVAL_REQUEST_LEDGER_RESULT.md` 신규+STATUS 정확2.

- [ ] strict Git/private/live head·clean·direct parent·allowed path·사람approval/제안/문서hash·raw prefix·snapshot/digest·시간·token·권한범위의 positive/위조음성을 TDD한다. 새route 전 예상 RED를 PASS로 주장하지 않는다. 과거 collector/기대/실패는 불변.
- [ ] Main 독립 코드검토·fresh 핵심 이후 C20 nonforce private push·clean actual G05 PASS. 이 전 WSL QA0. 배포는 Git exact SHA/manifest만, source복사0.
- [ ] Main이 생성 전 이름/owner/image/port/수명/정리를 등록한 격리 PG15에서0020→0021·실제 producer·권위/감사·멱등/경합·인가 GET 확인. 정식 WSL은 현재DB/권한/image와 암호화backup·복원수단·보존hash를 검증한 뒤 migration/API/Web 반영. 기존issuer·reader·인증서·망·자료/rollback보존. PostgreSQL migration/실측 없이 fixture PASS를 기능완료로 주장하지 않는다.
- [ ] 실제 Main계획producer→저장→인가GET→브라우저목록·기간/재조회/만료·로그아웃·same-origin/비밀감사·정확자원정리0를 확인한다. 비영QA는 식별 가능한 Task/권위/계획으로 생성하며 직접 SQL 요청 fixture를 실생성 증거로 쓰지 않는다. secret/fence 원문출력0. 승인결정0/Run실행0.
- [ ] rollback은 기존API/Web로복귀·요청/감사 보존, 새기능UNAVAILABLE격리. 데이터삭제/강제downgrade0. H20회수/보고 후 실제사용가능과미구현/미확인을구분한다. 전체R6역사실패/DC-U01-019와U01NOT_ACCEPTED/DEFER유지.
