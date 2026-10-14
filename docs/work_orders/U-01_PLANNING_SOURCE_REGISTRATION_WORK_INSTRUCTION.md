# U-01 계획 원본 정상 등록·실제 요청 1건 작업계획 및 지시서

> 구현은 기존 단일 developer-primary가 `superpowers:subagent-driven-development`/TDD로 순차 수행한다. Main은 승인·임대·독립 검토·통합·WSL을 담당하고 활성 lease의 제품 경로에는 쓰지 않는다. 새 담당자/병렬 writer를 만들지 않는다.

**Goal:** 승인 원본에 결박된 내부 등록으로 별도 검증 Task를 정상 생성하고 기존 C20 producer가 실제 요청1건을 저장해 정식 Dashboard에 표시하도록 연결한다.
**Architecture:** 기존0021 schema/Task bootstrap/planner/request service/인가GET/Web를 재사용한다. 새로운 source 등록은 호스트 전용 DTO·서비스·SQL adapter로 격리하고 공개 API·조회 계정·사람 실행 승인에는 연결하지 않는다. 등록 journal은 기존 design_artifacts의 전용 내부 종류를 사용하며 기존 ArtifactKind나 인간 승인 의미를 바꾸지 않는다.
**Tech Stack:** 기존 Python/SQLAlchemy/PG15·typed planning DTO. 의존성 추가0·migration0·UI수정0.
**Spec:** 승인된 `U-01_PLANNING_SOURCE_REGISTRATION_CONTRACT_PROPOSAL.md` SHA256 `69F648A29D3E0C32507D2272BB59C0616F5A74BCFF8C58F1F920AB9C9B464716`, 새 source-registration 승인 및 기존 원장/Task권위 승인. 기존 설계/작업계획/검사 기준 불변. 이 WI는 승인 범위의 내부 구체화다.

## Global Constraints

- 정확 대상은 `anvil-wsl-development / wsl-development`, 기존 private `git@github-sinsan-develop:sinsan-develop/Anvil.git`, 기존 branch `codex/u01-dashboard-r2`. 기존 Task/Run과 사용자 dirty 보존, reader권한·승인결정·Run실행·공개POST·환경Secret 변경0.
- 공개 런타임 API/Web/issuer는 M20의 C20/C20/C15를 유지한다. 이번 신뢰 호스트 기능은 새 C21 exact Git의 API target image를 일회성 내부 Main 프로세스로 실행한다. 기존 공개 reader 코드는 그대로 실제 저장된 요청을 조회한다. Web 재빌드·기존 서비스 교체·migration·기존 백업복원 반복은 필요하지 않다. host image와 API/Web source 혼합은 M21에 역할별로 명시하며 한 SHA라고 위장하지 않는다.
- 제품 권위는 내부 Main의 `planning-sources:register`로 제한하고 reader나 브라우저에는 노출하지 않는다. 호스트 policy와 원본 bytes/hash를 신뢰 admission에서 검증하고, agent가 보낸 actor/pair/hash/DTO만으로 권위를 얻지 못한다. 정책 객체는 HTTP 입력이 아니라 명시된 신뢰 embedding host 설정이다.
- 내부 journal 종류는 `PLANNING_SOURCE_GRANT_ISSUED`, `PLANNING_SOURCE_REGISTERED`, `PLANNING_SOURCE_GRANT_REVOKED`다. actor_type=agent/actor_id=`anvil-internal-planning-main`. 기존 design_artifacts의 source_refs JSON에 전용 내부 schema/version의 payload를 보관하고 revision/sequence·이전 hash·전체내용 hash를 검증한다. 기존 ArtifactKind/DesignArtifact 객체로 위장하지 않는다.
- journal은 정상 adapter의 INSERT-only·읽기 hash검증이다. 기존 table에는 UPDATE/DELETE 차단 trigger가 없으므로 DB 강제 immutable/악의적 DB권한자의 마지막 revoke 삭제 방어를 주장하지 않는다. DB·호스트는 신뢰 경계이고 원장 REQUESTED 감사의 기존 trigger 보장은 별도다.
- baseline은 `approval_mode=REGISTERED_APPROVAL_SOURCE_REFERENCE`, actor_type=agent로 실제 승인문서ID/hash를 참조한다. `approve_baseline()`·HUMAN actor/approval_records/authenticated_human·가짜a*64 해시·시험 fixture를 정식 생성에 사용하지 않는다. Run 생성의 기존 실제 사람 승인/APPROVED gate는 그대로다.
- Task·등록·요청·감사는 검증 자료로 식별하고 보존하며 삭제하지 않는다. 등록 grant는 검증 후 회수한다. C20 요청 생성 authority는 Run 실행 권위가 아니며 capability 원문을 폐기하고 기존 최대1시간/요청1시간 제한을 유지한다. 이를 DB회수라고 보고하지 않는다. 요청이 표시되는 정확 만료시각을 최종 보고한다.
- 전체 회귀/다기기/부하가 아니라 이번 영향 검증과 실제 경로만 수행한다. 기존 실패/미검증은 보존하며 전체U01NOT_ACCEPTED/ReleaseDEFER다.

## 허용 code path — 정확9, 제품3

1. 신규 `packages/planning/source_registration.py`: 전용 DTO·신뢰 host policy/grant 서비스·source 검증.
2. 신규 `packages/persistence/planning_source_repository.py`: 동일 transaction의 source journal/mapping/baseline/계획/Task bootstrap 등록·회수.
3. 수정 `apps/api/anvil_api/oidc_process.py`: 별도 명시적 source host callback만 추가. 기존 planning_host_control의 두 인자 계약·public startup/read-only 동작 유지.
4. 신규 `tests/planning/test_planning_source_registration.py`.
5. 신규 `tests/persistence/test_planning_source_repository.py`.
6. 수정 `tests/api/test_oidc_process.py`.
7. 신규 `tests/integration/test_u01_planning_source_registration_pg15.py`.
8. 수정 `scripts/check_project_progress.py`: 이 successor 전용 fail-closed 경로만 추가.
9. 수정 `tests/tooling/test_u01_postmerge_control_projection.py`.

Main 소유 docs/approval·Event·STATUS·환경·manifest·보고는 Developer 쓰기 금지. 다른 파일 필요 시 먼저 Main에 경로/이유를 보고하고 쓰지 않는다.

## Review Focus

1. source bytes 또는 현재 승인 hash·정확 pair/Task/repository 불일치: mutation 전 거부.
2. 동일 key/ID 다른 내용, 기존 mapping 다른 repository/env/version: 덮어쓰기0/conflict.
3. Task 생성 뒤 등록 receipt 실패: 동일 outer transaction의 모든 source/Task row rollback.
4. grant 잠금 대기 중 만료·회수, typed DTO 변경/임의 hook: 실제 DB wall clock·고정 snapshot으로 fail-closed.
5. metadata 원본 참조가 사람 실행 승인으로 승격되거나 callback이 HTTP/appstate/startup에 노출: 거부/비노출·approval_records/Run 불변.

## Task 1: 호스트 등록·영속 source→정상 Task

**Files:** 위1/2/4/5. **Interfaces:** `PlanningSourcePolicy`, `PlanningSourceGrant`, `PlanningSourceRegistrationService`, `PlanningSourceRepository`; `issue`, `register`, `revoke`의 구체 signature는 아래 계약을 그대로 소비할 수 있도록 최소화하고 report에 기록한다. 기존 `FinalizeExecutionPlan`/typed plan을 재사용한다.

- [ ] 누락된 source registration의 RED를 먼저 확인한다. `test_register_real_source_creates_task_and_lineage_atomically`는 실제 정상 Task repository를 사용해 신규DRAFT Task1·mapping/typed baseline→WorkPlan→Iteration→WI/receipt 및 사람approval0/Run0를 검증한다.
- [ ] 신뢰 host policy에는 정확 pair/repositoryID·기존privateURL·검증TaskID·원본 path→SHA256 map·이번 승인ID/hash·유효시간<=1시간을 고정한다. 원본은 설계2171EC…9BC7, 작업계획19B7AC…BF4, 원장승인E9C0B7…6E4B6, Task권위승인F9966B…E06A, 이번 등록승인(실제 hash를 Main이 Invocation에 고정)이다. 정확 raw bytes와 path 집합·hash를 확인하고 raw원문/Secret을 journal·로그·GET에 넣지 않는다.
- [ ] `issue`는 TaskID/정확pair/등록command fingerprint·원본hash·서버생성capability hash·DB issued/expires를 결박한다. `register`/`revoke`는 같은 등록 aggregate 잠금 순서로 직렬화하고 잠금 뒤 실제 DB clock_timestamp로 유효/회수를 확인한다. SQLite 로컬과 PG15 실제 시험을 구분한다.
- [ ] mapping/typed계보/journal receipt와 기존 `SqlAlchemyTaskBootstrapRepository.create()`는 같은 outer connection/transaction에 참여한다. `TaskBootstrapCommand.task_id=None`을 유지하며 기존 trusted task_id_factory로 예약 검증ID를 공급하고 반환ID exact를 확인한다. 별도 session commit으로 원자성을 위장하지 않는다. source등록receipt 실패 후 Task 포함 전체 rollback을 실제 시험한다.
- [ ] `register`는 source bytes/hash/승인 참조·typed WorkPlan/Iteration/WI의 canonical hash/parent/content/범위를 검증한다. 기존 row가 exact면 멱등, 부분·충돌은 전체거부한다. 기존 row 수정/삭제·기존 Task 재사용0. source 문서의 file SHA와 typed canonical hash는 별도 journal 필드다.
- [ ] 동일 권위·등록command 재시도는 같은 Task/receipt·중복0, 같은 key 다른 내용/권위 없는 reader·다른Task/다른pair/hash변조/회수/만료/부분자료·감사실패rollback의 GREEN을 확인한다. 중대한 변경만 Main으로 escalation한다.

## Task 2: 명시 host 연결·실제 요청과 영향 검증

**Files:** 위3/6/7 및 Task1 연계. 기존 C20 producer/reader/Web는 수정하지 않는다.

- [ ] `create_configured_oidc_process`에 별도 선택적 `planning_source_host_control=None`을 추가해 명시 host만 등록 registrar/service를 받을 수 있게 한다. 기존 `planning_host_control(registrar,service)`는 불변이고 새callback 없음이면 source SQL write/권위발급0다. app state/HTTP factory/router에 registrar/service를 공개하지 않는다.
- [ ] actual factory RED→GREEN으로 원본 거부·callback없음startup0·기존 두 인자 계약·reader권한 불변을 검증한다. 임의 public POST 추가0.
- [ ] Main 전용 새 격리 PG15 opt-in은0021/빈DB/등록된 literal 대상만 허용한다. 정상 등록→실Task/typed plan→기존 C20 authority/producer→동일 요청 재시도1/감사1/실행계획1→정확인가GET count1 및 회수·원자rollback을 확인한다. 실제 app route를 소비하며 fake응답/직접요청INSERT0. 후속 실제 정식 DB·브라우저는 Main만 수행한다.
- [ ] 영향받는 새단위/인접C20 source·Task bootstrap·host factory 검사를 한정 수행하고 기존 실패·환경오류는 이름/범위대로 기록한다. 전체불변 코드 검사 반복0.

## Task 3: W23→A22→C21→M21→B21→H21/보고 통제

**Files:** 위8/9. 이전C20/history/검사/승인 불변. 최신문서가 과거synthetic input에 새어 들어가지 않도록 BASE의 frozen bytes를 명시 공급한다.

- [ ] W23은BASE5578ba27직접자식 정확6: 신규 proposal/승인/WI/Invocation4 + DC/STATUS2. A22는W23직접자식Event/progress/HANDOFF/digest/STATUS정확5. frozenEvent1~2439원문 보존→2440WI→2441epoch131worker→2442write ACTIVE24시간·분리token/정확9제품3. 새 binding=`u01_planning_source_registration_binding`, mode=`U01_PLANNING_SOURCE_REGISTRATION_ACTIVE`, action=`U01_PLANNING_SOURCE_REGISTRATION_IMPLEMENT`, snapshot=`snapshot-u01-planning-source-registration-a22-seq2442`.
- [ ] C21은A22직접자식 허용9이내code-only, actual clean/privateG05 PASS 전 WSL시험0. M21은C21직접자식 신규 `deploy/wsl/U01PlanningSourceRegistrationReleaseManifest.json`+STATUS정확2. manifest는 실제host image/source/C20유지API·Web/C15issuer·0021·원본서버/proof를 역할별 결박한다. 임의image/hash/계보·dirty/remote위조를 거부한다.
- [ ] B21은M21직접자식progress/HANDOFF/digest/STATUS/DEV_ENV정확5·Event2442불변/active_projection_checkpoint=null·action=`U01_PLANNING_SOURCE_REGISTRATION_CLOSE_READY`, snapshot=`snapshot-u01-planning-source-registration-b21-seq2442`. binding에 a22_docs_checkpoint/C21 control_checkpoint/M21 manifest_checkpoint/hash를 결박하고 repository/HANDOFF head=M21.
- [ ] H21은B21직접자식Event/progress/HANDOFF/digest/STATUS정확5. 2443write→2444worker REVOKED/active0, Event ids=`evt_u01_2443_planning_source_registration_write_lease_revoked`/`evt_u01_2444_planning_source_registration_worker_lease_revoked`, subject=`U-01/PLANNING-SOURCE-REGISTRATION`, step=`U01_PLANNING_SOURCE_REGISTRATION_CLOSE`. completed키=`completed_u01_planning_source_registration_{write,worker}_lease`의전체객체+status/revoked_at. close mode/reason=`U01_PLANNING_SOURCE_REGISTRATION_CLOSED`, action=`U01_PLANNING_SOURCE_REGISTRATION_RECORDED_U01_PENDING`, snapshot=`snapshot-u01-planning-source-registration-h21-seq2444`, H에서만B21결박. 마지막보고는H21직접자식 신규 `docs/04_test_reports/U-01_PLANNING_SOURCE_REGISTRATION_RESULT.md`+STATUS+DC정확3.
- [ ] G05는 source별 실검증 대신이 아니다. 과거BASE/C20 PASS를새HEAD로상속하지 않고 새route전 예상RED는PASS아님. rawprefix/lease/시각/hash/정확path/단일parent/private위조 음성을 TDD한다. 구현간sourcecommit은Main의C21단일직접자식으로묶는다.

## Main 정식 실측·정리

코드완료/독립검토/한정fresh→C21private/actualG05→생성전등록한0021일회PG→host image 실측/M21private/G05→정식현재 source/ID/자료/proof 재대조→호스트전용 정상등록/요청1→기존API/Web실제화면/기간/재조회/logout. 등록Grant/Task/requestID/planHash/만료시각·기존Task1Run1불변·사람approval/새Run0를근거로남긴다. 요청·감사삭제0, 등록grant회수·capability정확폐기·일회자원정리/잔여0. 명시승인범위밖새위험만보고하며일반계속승인을묻지않는다.

### M21 고정 manifest 계약

- 정확 top-level keys: `schema_version`, `environment`, `acceptance`, `release_decision`, `source_commit`, `source_files`, `predecessor_manifest_commit`, `predecessor_manifest_sha256`, `origin`, `images`, `image_sources`, `retained_source_files`, `database`, `rollback`.
- schema_version=`u01_planning_source_registration_manifest/v1`, environment=`WSL_SERVER_TEST_STAGING`, acceptance=`NOT_ACCEPTED`, release_decision=`DEFER`, source_commit=C21, origin=`https://172.27.253.53:3770`. source_files는 C21에서 실제 변경된 허용 code path 전부의 Git bytes SHA256 map이다.
- predecessor_manifest_commit=`8586eaa8052cfb46ffbafead8084b424a0365b27`, predecessor_manifest_sha256=`727734ED23D9FA1D9D4E70B36804E76C60513CBB7FE139F6BE7528037290EB83`. retained_source_files는 이전 manifest 자체와 이전 manifest의 retained_source_files exact map을 포함한다.
- images/image_sources는 정확 `planning_host`, `api`, `web`, `issuer` 네 역할 map이다. planning_host는 C21에서 실제 빌드한 image ID/source=C21이며 임의 값은 허용하지 않는다. 나머지 세 image ID/source는 predecessor의 images/image_sources와 exact 동일하다. host image의 실제 inspection receipt와 source label은 Main 실측 증거로 남긴다. manifest만으로 runtime 실행 성공을 주장하지 않는다.
- database 정확 keys: revision=`0021_approval_requests`, schema_change=false, data_policy=`PRESERVE_EXISTING_AND_APPROVAL_AUDIT`, registration_approval_id=`APPROVAL-20261014-U01-PLANNING-SOURCE-REGISTRATION-001`, registration_approval_sha256=Invocation의 실제 승인 hash. rollback 정확 keys: policy=`REVOKE_REGISTRATION_GRANT_PRESERVE_TASK_REQUEST_AUDIT`, public_runtime_change=false. 비밀/DSN/실행 capability 원문은 넣지 않는다.
