# F-18 R32 trusted directory WSL 격리 QA 실측 / 2026-09-26

- 판정: `R32_WSL_PG18_QA_PASS_PENDING_REPORT_AND_LEASE_CLOSE`. Main은 공개 제품 SHA `ca5f6597239fb8f031925ee5e1ffc8ee921a7075` clean detached checkout과 별도 tmpfs PG18 합성 DB의 비-superuser migrator로 focused 실행했다. exit0 **87 PASS/4 R31 PG opt-in SKIP/기존 SQLite datetime warning1/3.45초**; R32 PostgreSQL 전용 4개는 실제 PASS다. 별도 SELECT 전용 reader role(비-superuser/non-createdb/non-createrole)에서 resolver 조회 정상, INSERT는 SQLSTATE `42501` 거부. 전체 QA wrapper exit0. 실제 운영 DB·기존 migration 표는 건드리지 않았다.
- QA container ID `06f0b4dd1383ab639b700a3d6801c0efa65bc0b7a9caa94a79d8b7d2feaf7a53`, checkout과 port55432 모두 exact 정리·잔류0, 기존 `local-postgres` ID `99f3bf939d40` Up 및 `anvil-web` ID `f0107aada3b2` Up/healthy 불변을 별도 읽기 전용으로 재확인했다. 전용 tmpfs DB·두 합성 역할·암호는 컨테이너 제거로 폐기돼 복구 불가, 제품 source는 지정 원격 commit으로 복구 가능하다.
- 독립 read-only review Spec PASS/Task quality Approved C0/I0/M0, 로컬 Main focused 83 PASS/8 PG SKIP. 현재 전체 pytest 기존 13 collection ERROR는 non-green이고 실제 issuer/session/API/browser·정식 WSL 통합·Production은 미검증이다. Developer가 지정 보고서만 실측 결과를 누적한 뒤 Main은 report push/G-05와 epoch16 write→worker lease 회수를 수행한다. F-18 accepted=false/F-19 차단, 오류 횟수: Developer 정식 실패0·WSL QA 오류0.

# F-18 R32 trusted directory WSL 격리 QA 생성 전 계획 / 2026-09-26

- 판정: `R32_PRODUCT_REVIEW_APPROVED_WSL_PG18_PENDING`. 담당 Main. 단일 writer 제품 exact5 SHA `ca5f6597239fb8f031925ee5e1ffc8ee921a7075`를 지정 원격에 push했고 G-05 seq1591 PASS·branch clean·원격 HEAD 일치다. 독립 review Spec PASS/Task quality Approved, Critical 0/Important 0/Minor 0. Main 로컬 focused 83 PASS/PG opt-in 8 SKIP/기존 warning2(exit0), diff-check exit0. 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다. Developer 정식 실패0, 테스트 RED→GREEN 완료; 실제 PG18/권한 경계는 아직 미검증이다.
- WSL QA exact 자원: `ssh WSL-server`로만 접근한다. 신규 0700 Git clean detached checkout `/home/daon/anvil-f18-r32-directory-qa`에 공개 제품 SHA만 fetch한다. 기존 PG18 image ID `sha256:b551e63a5606bdd3127b12a8120c6df8d71c812b29a7faf944b034cb9beb644a`로 임시 컨테이너 `anvil-f18-r32-pg18-qa` 하나를 생성하며 PGDATA tmpfs, host 게시 `127.0.0.1:55432`만 사용한다. 별도 합성 DB `anvil_f18_r32_qa`, 비-superuser schema owner/migrator `anvil_oidc_r32_migrator`, SELECT 전용 `anvil_oidc_r32_reader`를 전용 컨테이너 안에만 만든다. 임의 합성 암호는 WSL 프로세스 내부에서 생성하고 출력·문서·Git에 기록하지 않는다. 기존 `local-postgres` ID `99f3bf939d40`와 `anvil-web` ID `f0107aada3b2`는 변경·재시작하지 않는다.
- 수명·검증·정리: 이번 격리 QA 한 회만 사용한다. 동일 SHA의 migration/active·inactive·권한 손상 거부/유자료 downgrade 거부/실제 insert-lock 경합을 opt-in PG 테스트로 실행한다. 별도 reader role로 SELECT resolver 정상과 DML 거부를 확인하되 운영 권한 증거로 승격하지 않는다. 완료·실패 시 정확한 container ID/name과 checkout 실경로를 확인해 위 전용 자원만 제거하고 경로·container·55432 잔류0 및 기존 서비스 불변을 확인한다. tmpfs DB/합성 역할·암호는 컨테이너 제거와 함께 폐기한다. 실제 issuer/session/API/browser·정식 WSL 통합·`ysna-server`/Production은 NOT_EXECUTED, F-18 accepted=false/F-19 차단이다.

# F-18 R32 trusted directory canonical lease 발행 / 2026-09-26

- 판정: `R32_CANONICAL_WRITER_LEASE_ACTIVE`. Main이 control QA `aaa00fc`와 seq1589 `WORK_INSTRUCTION_ISSUED`→1590 `WORKER_LEASE_ISSUED`→1591 `WRITE_LEASE_ISSUED` 투영 `d50d8951e4161e2f628b0a19d2e2b96145c1863f`를 지정 SSH 원격에 게시했다. epoch16 실행/write fencing token은 R31과 다르며 제품 exact5(`migrations/versions/0018_oidc_principal_directory.py`, `packages/persistence/oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`)에만 결박된다. G-05 seq1591 PASS, control test 2 PASS(exit0), branch clean·원격 HEAD 일치를 확인하고 `developer-primary` 단일 writer에게 구현을 전달했다. 제품 변경0, 정식 Developer 실패0, 실제 DB/issuer/API/browser 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R32 trusted directory 통제 준비 / 2026-09-26

- 판정: `R32_CONTROL_QA_PENDING_CANONICAL_LEASE`. 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·원격 `ae3d7b24165ff9dd3aa34c536a564486ba1d0dbf` clean, G-05 seq1588 PASS, worker/write lease=null. 로컬 관련 기준 회귀 57 PASS/PG opt-in 4 SKIP/기존 warning2(exit0). 기존 분리 checkout과 동일 브랜치를 유지하고 새 브랜치·worktree를 만들지 않는다.
- 설계/코드 대조: 설계서 17.1의 `users/roles/user_roles`는 migration 0001~0017에 없으며 R30 `OidcPrincipalResolver`는 Protocol뿐이다. F-18 기본 WorkInstruction 단계3의 실제 OIDC 권한 검증을 위한 내부 계보로 R32 전용 additive `0018`과 read-only resolver만 한정했다. 토큰 role/scope/project claim은 권한 근거로 사용하지 않는다. 기존 `SessionPrincipal`의 독립 project/environment 집합을 통한 교차 조합 확대를 막기 위해 단일 활성 role·project·environment만 허용한다. 다중 범위, provisioning UI/API, 제품 auth route/session, 기존 표·공유 DB·Production은 이 Task 밖이다. 기능 범위·공개 API·권한 확대 없이 내부 구현 방법을 확정한 `MAIN_RECONFIRMED_NON_SEMANTIC`이다.
- Main 통제 파일: R32 plan/WorkInstruction/invocation, start overlay와 checker dispatch/control test, 본 WORK_STATUS와 manifest. 새 control test는 모듈 부재 RED 1 collection ERROR 후 GREEN 2 PASS(exit0). 전체 G-05는 control 파일 미커밋·미투영 중에는 기준 상태로 판정하지 않는다. 다음은 exact control QA commit/push 후 seq1589 WorkInstruction→1590 worker→1591 write lease(epoch16, 제품 exact5) 투영, G-05 확인, `developer-primary` 단일 writer 위임이다. 제품 변경0·Developer 정식 실패0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R31 OIDC pending-store 종료 G-05 / 2026-09-26

- 판정: `R31_PENDING_STORE_CHECKPOINT_PASS`. Main의 control QA `42f834911341daefa7adf72cb3e167aaaf28af0f` 뒤 seq1587 `WRITE_LEASE_REVOKED`→seq1588 `WORKER_LEASE_REVOKED`를 투영해 `2856aee`로 동일 작업 브랜치에 게시했다. `worker_lease=null`, `write_lease=null`, 제품 write scope 빈 목록, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED. G-05 seq1588 PASS(exit0), R31 close control test 2 PASS(exit0), branch clean·원격 HEAD 일치다.
- 최종 제품 SHA `b0536b6d66530b8c6e12e68a8d129d435ba20dc8`의 WSL 격리 PG18 focused 98 PASS(exit0), QA wrapper exit0·전용 자원 잔류0 및 기존 서비스 불변을 보고서에 기록했다. 전체 pytest 기존 collection 13 ERROR는 미검증으로 남고 실제 issuer/trusted ownership mapping/OIDC session/API/browser는 아직 미검증이다. 다음 안전 행동은 같은 `codex/f18-wsl-ops`에서 trusted issuer+subject 소유권 매핑의 신규 exact-path WorkInstruction·lease 준비다. 새 브랜치 생성·main 병합·운영 배포는 하지 않는다.

# F-18 R31 OIDC pending-store 종료 통제 준비 / 2026-09-26

- 판정: `R31_WSL_PG18_QA_PASS_CLOSE_CONTROL_PENDING`. Main은 동일 제품 SHA `b0536b6d66530b8c6e12e68a8d129d435ba20dc8`를 WSL-server clean detached checkout과 전용 PG18 tmpfs DB·비관리자 역할에서 검증했다. opt-in 포함 focused 98 PASS/1 기존 SQLite datetime warning, 최종 wrapper exit0. 첫 2회는 테스트 98 PASS 후 Windows 파이프 끝 CR로 wrapper exit127이었고 매번 cleanup residue0; 마지막 명시적 exit0 실행으로 래퍼까지 해소했다. 전용 컨테이너·checkout·포트 잔류0, 기존 `local-postgres` ID `99f3bf939d40` Up·`anvil-web` ID `f0107aada3b2` Up/healthy 불변. 제품 보고서 commit `d69a0b8eaeba2123fc40ab08052ca8bb8ac25162`를 지정 원격에 push했고 G-05 seq1586 PASS, branch clean·원격 HEAD 일치다.
- R31 제품 독립 review Critical/Important 0, Task quality Approved. Main의 close plan/control checker/test/overlay를 준비하고 epoch15 write→worker lease 회수를 seq1587~1588에 투영할 예정이다. 이 단계는 통제 파일만 변경한다. 다음 safe action은 trusted issuer+subject 소유권 매핑 Stage 준비이며 실제 issuer/API/browser·전체 F-18은 미검증, F-18 accepted=false/F-19 차단/Production `NOT_EXECUTED`. Developer 정식 실패0; 전체 pytest 기존 collection13 ERROR는 전체 PASS 아님.

# F-18 R31 OIDC pending-store WSL 격리 QA 생성 전 계획 / 2026-09-26

- 판정: `R31_PRODUCT_REVIEW_APPROVED_WSL_PG18_PENDING`. 담당 Main; `developer-primary` 단일 writer의 제품 exact5 최종 SHA `b0536b6d66530b8c6e12e68a8d129d435ba20dc8`를 지정 SSH remote `codex/f18-wsl-ops`에 push했다. 독립 최종 재검토 Critical 0/Important 0, Task quality Approved. 로컬 집중 회귀 94 PASS/4 PG opt-in SKIP(exit0), diff-check exit0. 전체 pytest는 기존 중복 basename/import의 collection 13 error로 non-green; PostgreSQL 실측으로 승격하지 않는다. Developer 정식 실패 0, review 보완 2회(다운그레이드·fixture 소유권, 실제 lock-wait 관측), 로컬 pytest 기본 Temp ACL 환경오류 1회는 전용 basetemp 재실행으로 해소했다.
- WSL QA exact 자원: `ssh WSL-server`만 사용하며 `/home/daon/anvil-f18-r31-pending-qa` 신규 0700 detached clean checkout을 위 공개 SHA에서 생성한다. 기존 `local-postgres`, `anvil-web`, 다른 checkout·서비스·DB·계정은 변경·재시작하지 않는다. 기존 PG18 image ID `sha256:b551e63a5606bdd3127b12a8120c6df8d71c812b29a7faf944b034cb9beb644a`로 일시 컨테이너 `anvil-f18-r31-pg18-qa` 하나만 생성한다. PGDATA는 tmpfs, 게시 포트는 `127.0.0.1:55431`만 사용한다. 전용 합성 DB `anvil_f18_r31_qa`, 비관리자 시험 role `anvil_oidc_qa`와 합성 암호를 이 컨테이너 안에만 생성하며 로그·보고서에 암호를 기록하지 않는다. 전용 checkout에서 migration, 일회성·경합·만료·유자료 downgrade 거부를 opt-in 실측한다.
- 수명·정리: 이번 QA 한 회만 사용하고 exit/결과와 정확한 Git SHA를 기록한다. 이후 container ID·name과 경로 실경로를 확인하여 위 컨테이너와 checkout만 제거하고, 컨테이너/경로/55431 잔류 0 및 기존 `local-postgres`·`anvil-web` identity/health 불변을 확인한다. tmpfs DB·합성 계정/암호는 컨테이너 제거로 폐기한다. `ysna-server`/Production/실제 issuer·browser·OIDC 세션은 `NOT_EXECUTED`; F-18 accepted=false/F-19 차단이다.

# F-18 R31 OIDC pending-store canonical lease 발행 / 2026-09-26

- 판정: `R31_CANONICAL_WRITER_LEASE_ISSUED_PENDING_G05`. Main이 control QA commit `c5a131a`를 지정 원격에 게시하고 seq1584 `WORK_INSTRUCTION_ISSUED`→1585 `WORKER_LEASE_ISSUED`→1586 `WRITE_LEASE_ISSUED`를 투영했다. epoch15의 독립 execution/write fencing token은 제품 exact5(`migrations/versions/0017_oidc_pending_auth.py`, `packages/persistence/oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`)에만 결박되며 R30 token을 재사용하지 않는다.
- 투영 직후 validator/control test의 유일한 `F18_LOCAL_START_GIT_INVALID`는 새 progress/events/handoff/digest/manifest가 미커밋·미게시라서 발생한다. 새 schema/제품 mutation0, Developer 정식 실패0. 다음은 projection exact5 control 파일을 commit/push해 G-05와 clean·원격 HEAD 일치를 확인한 뒤 단일 Developer에게 위임한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R31 OIDC pending-store 통제 준비 / 2026-09-26

- 판정: `R31_CONTROL_QA_PENDING_CANONICAL_LEASE`. 담당 Main. 동일 `codex/f18-wsl-ops`의 시작 HEAD·원격 `fb8903edc8892aa0f7b0c4bea38325159059c3a5` clean/G-05 seq1583 PASS, 기존 worker/write lease=null을 확인했다. F-18 단계3 안의 pending-store를 전용 additive migration+원자 일회성 PostgreSQL 저장소의 제품 exact5로 좁혔다. 기존 `OidcCodeFlow`/runtime/API/테스트 bootstrap/공유 DB/Production은 이 Task에서 수정하지 않는다.
- Main 통제 변경: R31 plan/WorkInstruction/invocation, start overlay/control test, progress checker dispatch와 본 WORK_STATUS·manifest. 신규 control test 3 PASS(exit0), R30 close control과 합산한 현 4 PASS/1 FAIL은 **미투영 R31 파일이 존재하는 dirty 상태에서 R30 `F18_LOCAL_START_GIT_INVALID` 및 raw checksum 불일치**이며 제품 오류가 아니다. 다음은 checksum 보정과 exact control QA commit/push 뒤 새 canonical seq1584~1586 및 epoch15 worker/write lease를 투영·게시해 G-05를 확인한다. 제품 write0, Developer 정식 실패0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R31 OIDC runtime Stage 경계 조사 / 2026-09-26

- 판정: `PREPARE_F18_OIDC_RUNTIME_STAGE_SCOPED`, 제품 write 0. 담당 Main. clean `codex/f18-wsl-ops`의 로컬/지정 원격 `8e9c1f2c2c4ae134f795e472d239ca3c8371f025`, G-05 seq1583 PASS와 R30 worker/write lease=null을 시작점으로 삼았다. 승인된 F-18 WorkInstruction 단계3은 QA 전용 OIDC issuer 또는 동등 인증의 issuer/audience/서명·만료·역할·scope를 **실제 API**에서 검증하고 `/auth/*` same-origin 제품 ingress까지 확인하도록 한다.
- 코드 현실: `OidcCodeFlow`의 `PendingAuthStore`는 원자적 put/consume Protocol뿐이고 실제 영속 구현이 없다. `OidcPrincipalResolver`도 신뢰 매핑 Protocol만 있다. `LocalTestSessionService`는 명시적 테스트 bootstrap의 프로세스 메모리 세션으로 OIDC 대체가 아니다. `create_runtime_app`의 auth mode는 COOKIE/WSL_ACCEPTANCE뿐이고 `create_app`의 `/auth/session`은 테스트 bootstrap 경로다. migration 0001~0016에는 OIDC pending·principal mapping·session 테이블이 없다. 기존 `agent_owner_*`는 C30 owner snapshot용으로 인증 소유 저장소가 아니며 Telegram state table도 목적이 달라 재사용하지 않는다.
- Main 설계 판정: 한 번에 기존 `/auth/session`을 OIDC로 바꾸거나 기존 table에 권한을 끼워 넣으면 기존 정상 흐름과 신뢰 경계를 훼손한다. 다음 Stage는 (1) OIDC pending의 PostgreSQL 전용 원자·일회성 저장과 만료/중복 거부, (2) 별도 서버 소유 trusted issuer+subject→최소권한 mapping과 `user_roles` 계보 검증, (3) 별도 OIDC 세션 발급·검증/회수 및 CSRF, (4) 명시적 OIDC runtime/제품 same-origin `/auth/*`와 WSL 실제 issuer/API/브라우저 순으로 분리한다. R30의 `_canonical` 내부 공백/제어문자 Minor는 권한 매핑 단계의 거부 테스트로 흡수한다. 공통 `SessionPrincipal`·기존 테스트 bootstrap/COOKIE 경로의 동작은 유지하고 token claim을 권한 근거로 사용하지 않는다.
- 첫 후속 R31 제품 Task 후보는 `PendingAuthStore`의 실제 PostgreSQL 구현과 전용 additive migration이다. `PendingOidcRequest`의 nonce·PKCE verifier는 민감정보로서 DB 접근 role, 보존 300초, 원자 consume의 삭제 전제, 로그/오류 redaction, 재시도·동시성·만료·rollback을 WorkInstruction에서 명시해야 한다. DB schema는 F-18 OIDC 실측을 위한 계획 내 구현 수단이며 기존 DB/운영 데이터에는 적용하지 않고 로컬 단위·WSL-server 전용 격리 PG18에서만 migration/rollback rehearsal 후 다음 단계로 넘긴다. migration 도입의 영향·가역성을 먼저 좁혀 canonical revision/hash·새 epoch exact-path lease로 결박한다. 이 조사 자체는 schema/credential/기존 runtime 변경0, 실제 OIDC/API/browser 검증0이다.
- 다음 안전 행동: R31의 exact-path plan/WorkInstruction·거부 테스트·schema 영향/rollback을 확정하고 G-05가 인정하는 새 canonical lease를 발행한 뒤 `developer-primary` 단일 writer에게 위임한다. 같은 branch만 사용하며 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R30 종료 G-05 확인 / 2026-09-26

- 판정: `R30_CLOSE_G05_PASS`. `ba547708d1ed222ea435729b17670c3862f51551`가 로컬·지정 원격 branch에 일치하며 clean, `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .`는 `G-05 ... PASS sequence=1583 reporting=AUTO_CONTINUE`(exit0), R30 시작·종료 통제 pytest 5 PASS(exit0), `git diff --check` exit0이다. canonical worker/write lease는 null, 제품 write scope는 빈 목록이다. R30 로컬·WSL 동일 제품 SHA focused 185 PASS는 실제 OIDC issuer/API/browser PASS가 아니며 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED를 유지한다.
- 다음 안전 행동: 기존 `codex/f18-wsl-ops`에서 OIDC 영속 pending state·trusted mapping/session/API의 실제 소유권과 필요한 schema 경계를 조사하고, 승인 F-18의 좁은 후속 WorkInstruction을 발행한다. 새 branch·Production 작업 없음.

# F-18 R30 OIDC principal writer lease 회수 / 2026-09-26

- 판정: `R30_WORKER_WRITE_LEASE_REVOKED_PROJECTION_PENDING_G05`. Main이 제품 exact3 `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6`, 독립 Spec PASS/quality Approved(Critical/Important 0), 로컬·WSL 동일 SHA focused185 PASS, WSL 전용 QA 경로 잔류0을 근거로 canonical seq1582 `WRITE_LEASE_REVOKED`→seq1583 `WORKER_LEASE_REVOKED`를 순서대로 투영했다. worker_lease=null, write_lease=null, product_write_scope=[]; F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.
- R30 제품 추가 변경0·Developer 정식 FAILURE_REPORT 0, Main 변경은 R30 close plan/overlay/test/checker와 progress/events/handoff/digest/manifest·본 WORK_STATUS다. 투영 직후 validator의 유일한 `F18_LOCAL_START_GIT_INVALID`는 projection 미커밋·미게시 상태다. 회수 control QA commit `b6e7a24`는 원격에 게시됐고 최종 G-05와 로컬/원격 HEAD 일치는 projection commit/push 후 확인한다.
- 다음 안전 행동: R30 종료 projection commit/push·G-05 PASS 뒤 승인된 F-18의 영속 pending state·실제 trusted resolver ownership·OIDC session/API 연결을 각각 좁은 exact-path Stage로 분해한다. 내부 공백/제어문자 거부 Minor1을 해당 Stage에 흡수한다. 새 branch·F-19·`ysna-server`/Production 작업 없음.

# F-18 R30 writer 종료 통제 준비 / 2026-09-26

- 판정: `R30_CLOSE_CONTROL_QA_PENDING_REVOCATION`. 담당 Main. R30 제품 `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6`의 exact3 독립 review, 로컬·WSL 동일 SHA focused 185 PASS, WSL 전용 QA 자원 잔류0, G-05 seq1581 PASS와 브랜치 clean·원격 HEAD `ac4d463eff90ffa8665aef09e40bc5d99661c54e` 일치를 확인했다. 제품 정식 실패0, 전체 pytest 기존 collection13 ERROR는 전체 PASS 아님.
- R30 close plan/overlay/test와 progress checker dispatch를 Main 통제 경로에 추가했다. closure test 2 PASS·py_compile/diff-check exit0. 다음은 control QA commit/push 후 canonical seq1582 WRITE_LEASE_REVOKED→seq1583 WORKER_LEASE_REVOKED를 투영하고 G-05로 검증한다. 제품 파일 추가 write0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R30 동일 SHA WSL-server OIDC adapter QA·정리 / 2026-09-26

- 판정: `R30_SAME_SHA_WSL_OIDC_UNIT_BOUNDED_PASS`, 전체 OIDC capability/F-18 인수 아님. 승인 Git SSH alias의 제품 commit `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6`를 전용 `/home/daon/anvil-f18-r30-oidc-qa` mode0700 clean detached checkout으로 받았다. checkout 내부 잠금 venv는 Python3.12.3·`uv.lock`의 43개 패키지로 `uv sync --python /usr/bin/python3.12 --frozen --offline --no-install-project` exit0 구성했다. `.venv/bin/python -B -m pytest -q -p no:cacheprovider --basetemp <전용 checkout>/.pytest-r30`의 신규 R30+기존 OIDC/session/runtime 6파일은 **185 passed in 7.06s**, exit0. 이는 순수 adapter와 기존 API 계약의 WSL Python unit/contract 회귀일 뿐 실제 issuer/API HTTP·브라우저 검증이 아니다.
- QA 환경/명령 오류는 제품 정식 FAILURE_REPORT 0과 분리한다. 시스템 Python 첫 시도는 `sqlalchemy/httpx/fastapi` 부재로 collection 6 ERROR(exit1); 최초 `uv sync`가 Python3.14.3을 선택해 실제 venv version을 확인한 뒤 같은 exact checkout 내부에서 Python3.12.3으로 고정·재생성했다. 삭제 전 첫 read-only 검사 명령은 PowerShell→SSH 변수 quoting 오류로 stat/git 일부가 실패했으며 삭제 명령은 실행하지 않았다. 고정 경로 재검사에서 realpath exact, owner `daon`, mode0700, 비 symlink, clean detached HEAD와 checkout 최상위의 `.venv` 외 제품 변경0을 확인했다.
- `git show` 대상 제품 exact3는 Main 독립 검토와 read-only Task reviewer에서 Spec PASS/quality Approved, Critical/Important 0이다. `oidc_principal.py`의 **내부 공백/제어문자** 허용 가능성 Minor1은 현재 policy exact-match를 통한 권한 확대 근거가 없어 후속 권한 매핑 Stage의 거부 테스트에서 보완 대상으로 남긴다. Main 로컬 신규+관련 focused는 185 PASS/기존 `python_multipart` warning1이며 전체 pytest는 기존 collection13 ERROR로 전체 PASS 미확인.
- 종료 전 exact 경로·HEAD 재확인 뒤 R30 QA checkout과 내부 venv만 제거했다. 독립 재조회 `R30_EXACT_PATH_RESIDUE_ZERO` exit0: path 부재, 기존 `local-postgres` ID `99f3bf939d40` Up, `anvil-web` ID `f0107aada3b2` healthy, R21 보존 checkout SHA `4eadfcd441b55445237545146ae5ba4051739904` 불변. 삭제한 venv/pytest temp는 복구하지 않으며 소스는 게시 Git에서 복구 가능하다. DB/Docker/container/network/listener/Secret/Production 변경0. 실제 신뢰 resolver 영속 매핑·OIDC issuer·session/API·browser, PG18/MinIO 재검증, 전체 rehearsal/rollback은 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.
- 다음 안전 행동: R30 worker/write lease를 write→worker 순서로 회수하고 G-05로 종료한 뒤 동일 branch에서 후속 OIDC 실제 연결 Stage를 준비한다. 새 branch·PR/merge·`ysna-server` 작업 없음.

# F-18 R30 WSL-server QA 의존성 보완 계획 / 2026-09-26

- 판정: `R30_WSL_QA_ENVIRONMENT_REWORK_PLANNED`, 담당 Main. 사전 계획대로 exact `/home/daon/anvil-f18-r30-oidc-qa`를 daon mode0700으로 생성해 승인 Git alias의 clean detached 제품 commit `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6`를 확인했다. 첫 동일 SHA 6-file pytest는 **exit1, collection 6 ERROR**이며 WSL 시스템 Python에 `sqlalchemy`, `httpx`, `fastapi`가 없어 API package import에서 중단됐다. 제품 assertion 실행0·제품 실패 판정0. 전역 패키지/기존 서비스 변경0.
- read-only 로그인 셸에서 `uv 0.11.2`가 `/home/daon/.local/bin/uv`에 있고 사용자 cache가 존재함을 확인했다. 기존 QA 자원 상한에 **같은 checkout 내부 `.venv/` 하나**를 추가한다. `uv.lock` 고정 버전으로 `uv sync --frozen --offline --no-install-project`를 실행해 외부 네트워크·전역 Python 변경 없이 필요한 의존성을 설치한다. cache 부족 등으로 실패하면 원인/범위를 그대로 기록하고 임의 시스템 설치는 하지 않는다. 테스트는 `.venv/bin/python -B -m pytest -p no:cacheprovider --basetemp <exact checkout>/.pytest-r30`로 재실행한다.
- 기존 계획의 DB/Docker/network/listener/Secret 생성0 및 정확한 경로 정리 조건은 유지한다. 종료 시 `.venv`와 pytest temp는 QA checkout 안에만 존재해야 하며 realpath·owner·HEAD/dirty를 확인한 후 checkout 전체 exact path만 제거한다. 기존 `local-postgres`·`anvil-web`·R21 보존 checkout의 ID/SHA 불변을 독립 확인한다. 새 승인 경계·설계/요구사항 변경이 아닌 테스트 환경 보완이며 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R30 동일 SHA WSL-server OIDC adapter QA 자원 계획 / 2026-09-26

- 판정: `R30_SAME_SHA_WSL_OIDC_UNIT_QA_PLANNED`, 담당 Main. 제품 exact3 commit `5a8f0fcfffdbc48f69fd885ff0f74099d06a8cd6` 지정 SSH 원격 push·로컬/원격 HEAD 일치·G-05 seq1581 PASS, Main 독립 focused 185 PASS/기존 warning1, read-only Task review Spec PASS/quality Approved(Critical/Important 0, 내부 공백·제어문자 허용 가능성 Minor1)을 확인했다. 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다.
- WSL-server read-only inventory: hostname `SINSAN`, 사용자 `daon`, exact 신규 path `/home/daon/anvil-f18-r30-oidc-qa` 부재, 승인 Git alias의 `refs/heads/codex/f18-wsl-ops`가 위 SHA를 가리킴, Python3.12.3·PyJWT2.7.0·pytest9.1.1. 기존 `local-postgres` ID `99f3bf939d40` Up, `anvil-web` ID `f0107aada3b2` healthy, 보존 R21 checkout SHA `4eadfcd441b55445237545146ae5ba4051739904`는 변경하지 않는다.
- 새 자원 상한은 daon 소유 mode0700 전용 `/home/daon/anvil-f18-r30-oidc-qa` 안의 clean detached Git checkout과 내부 pytest temp뿐이다. 승인 SSH alias에서 정확한 `5a8f0fc`를 fetch/checkout하고 Python `-B`, pytest `-p no:cacheprovider`, 전용 `--basetemp`로 R30 신규·기존 OIDC/API auth focused suite를 실행한다. DB/Docker/container/network/listener/credential/Secret 생성0, 기존 서비스/checkout과 Production·`ysna-server` 접근0. Python 의존성 부재 시 결과를 `NOT_RUN`으로 기록하고 불필요한 전역 설치를 하지 않는다.
- 종료 시 exact path의 realpath·비-symlink·owner·mode·HEAD/dirty와 임시 파일만 존재함을 확인해 그 QA path만 제거하고 경로 잔류0·기존 서비스 ID/status·R21 SHA 불변을 독립 확인한다. 삭제한 내부 pytest temp는 복구하지 않으며 소스는 공개 Git commit에서 복구 가능하다. 이는 동일 SHA **로컬 순수 adapter 코드의 WSL 단위/회귀**에 한정한다. 실제 issuer·영속 resolver·session/API/browser, PG18/object-store 재검증, 전체 F-18/Production은 미검증, F-18 accepted=false/F-19 차단을 유지한다.

# F-18 R30 OIDC principal canonical writer lease 발행 / 2026-09-26

- 판정: `R30_CANONICAL_WRITER_LEASE_ISSUED_PENDING_G05`. Main이 control QA commit `d9b384b01b003e06d327e7cd9c2bd4e98e97b298`을 지정 원격에 push하고 새 seq1579 `WORK_INSTRUCTION_ISSUED`→1580 `WORKER_LEASE_ISSUED`→1581 `WRITE_LEASE_ISSUED`를 투영했다. epoch14의 worker `worker-lease-f18-wsl-ops-r30-20260926-001`·write `write-lease-f18-wsl-ops-r30-20260926-001`은 서로 다른 fencing token과 제품 exact3(`packages/api/oidc_principal.py`, `tests/api/test_oidc_principal.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`)에만 결박됐다. 이전 R29 token 재사용0.
- 투영 직후 R30 overlay validator의 유일한 `F18_LOCAL_START_GIT_INVALID`는 아직 새 progress/events/handoff/digest/manifest가 미커밋·미게시 상태이기 때문이다. 제품 mutation0, 오류0·Developer 정식 실패0. Main 통제·문서 외 파일 수정0. 다음은 이 projection을 commit/push하고 G-05 및 clean·원격 HEAD 일치를 확인한 뒤 단일 Developer에게 위임한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R30 OIDC principal 단일 writer 통제 준비 / 2026-09-26

- 판정: `R30_CONTROL_QA_PENDING_CANONICAL_LEASE`. 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·원격 `1dfe23d453a93fca1aa9710c3bd0acbdbe085d33`, clean, G-05 seq1578 PASS, worker/write lease=null을 확인했다. 기존 OIDC identity/code-flow/issuer transport focused baseline `109 passed, 1 existing python_multipart PendingDeprecationWarning`(exit0). 설계·계획·기본 F-18 WorkInstruction의 승인 범위 안에서 R30 OIDC 신원→서버측 권한 매핑의 exact3 제품 Task를 한정했다.
- Main 변경은 `F-18_WSL_OPS_R30_OIDC_PRINCIPAL_{PLAN,WORK_INSTRUCTION,INVOCATION}.md`, R30 start overlay/control test, progress checker dispatch와 본 WORK_STATUS·manifest다. 신규 public API/DB schema/Secret/network/Compose 제품 mutation은 없다. control test `3 passed`(exit0), overlay compileall exit0, diff-check exit0. 통제 스크립트의 lease tamper·approval binding tamper 거부를 단위 검증했으며 아직 seq1581 projection/G-05는 미실행이다. 오류0·Developer 정식 실패0.
- 다음 안전 행동: control-only QA commit/push 후 seq1579~1581 WorkInstruction→worker→write lease를 새 epoch14 exact3로 투영하고 G-05를 확인한다. 그 전 Developer 제품 write는 금지한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R30 OIDC 신원→권한 내부 계약 범위 확정 / 2026-09-26

- 판정: `R30_OIDC_PRINCIPAL_CONTRACT_SCOPED_NO_PRODUCT_WRITE`. 담당 Main. R29 종료 canonical seq1578의 worker/write lease=null과 clean `codex/f18-wsl-ops` HEAD `439768ab42f4dbdb2978671c32a59012230c0634`를 확인했다. 승인된 F-18 WorkInstruction 단계3의 OIDC issuer·역할·승인 scope 검증을 위해 현재 `OidcCodeFlow.complete()`의 결과가 `OidcIdentity(issuer, subject, auth_time, acr, step_up_verified)`까지만 제공되고, `create_runtime_app()`은 COOKIE/WSL_ACCEPTANCE만 활성화하며, DB migration 0001~0016에는 OIDC user/role/session 저장소가 없음을 대조했다. 기존 `LocalTestSessionService`는 OIDC 대체물이 아니다.
- 다음 단일 writer Task R30의 제품 exact3 후보는 `packages/api/oidc_principal.py`, `tests/api/test_oidc_principal.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. 검증된 `OidcIdentity`의 issuer+subject를 **서버측 신뢰 가능한** resolver가 제공한 명시적 actor role·permission·project/environment scope에만 결박해 `SessionPrincipal`을 생성하는 순수 내부 계약을 RED→GREEN으로 구현한다. resolver 부재·미등록 주체·issuer/subject 불일치·빈/과도 scope·step-up 미충족·role/permission 불일치·token claim만으로 권한 승격은 모두 거부한다. OIDC token의 role/project/scope claim을 신뢰하지 않는다.
- 이는 권한 의미나 공개 API를 새로 확정하지 않는 내부 선행 계약이다. 새 DB schema, 영속 세션, 브라우저 login/callback route, issuer egress/network 예외, Secret, Compose 변경은 이 Task에서 하지 않는다. 후속 R31 이후에 pending state의 원자·일회성 저장, 신뢰 매핑의 실제 소유권/영속화, 세션 lifecycle, 실제 issuer/API/브라우저 실측을 각각 검증할 때까지 OIDC capability는 `NOT_VERIFIED`; F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 오류0·Developer 정식 실패0.
- 다음 안전 행동: R30 정확한 계약·거부 테스트·rollback을 WorkInstruction/plan으로 고정하고 새 epoch worker/write lease를 발행·G-05로 검증한 뒤 `developer-primary` 단일 writer에게 exact3만 위임한다. R29 token 재사용 금지, 새 branch 생성 금지. 새 영속 schema 또는 권한 의미의 변경이 실제로 필요해지면 해당 경계만 분리하고 영향받지 않는 F-18 계획 작업을 계속한다.

# F-18 R29 회수 후 canonical 검증 / 2026-09-26

- 판정: `R29_NETWORK_CHECKPOINT_G05_PASS`. 회수 projection commit `ba727a00a09f90ee128d8b9000feccfb14ce1b31` push 후 `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .` exit0, `G-05 project progress contract: PASS sequence=1578 reporting=AUTO_CONTINUE`; R29 start/close 통제 pytest 5 PASS(exit0), branch `codex/f18-wsl-ops` clean 및 local/remote HEAD 일치. canonical worker/write lease=None·제품 write scope=[]을 유지한다. 다음은 승인된 F-18 OIDC/API 제품 연결 계약 조사·새 단일 writer 범위 확정이며 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R29 network writer lease 회수 / 2026-09-26

- 판정: `R29_WORKER_WRITE_LEASE_REVOKED_PROJECTION_PENDING_G05`. Main이 게시 제품 commit `a9550612084aa0b85c75e2c49844ba0367701d5a`의 로컬 정적 구현·독립 review와 같은 SHA WSL-server bounded network QA·잔류0을 근거로 canonical seq1577 `WRITE_LEASE_REVOKED`→seq1578 `WORKER_LEASE_REVOKED`를 순서대로 투영했다. Main의 `worker_lease=null`, `write_lease=null`, 제품 `product_write_scope=[]`; F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. R29 제품 추가 변경0, 통제/보고서만 변경했다.
- 이전 QA 시행 오류는 PG health 대기 누락 1건과 Docker 빈 PortBindings `null` 가정 1건, 이어진 진단/교정 후 최종 bounded PASS이며 Developer 정식 실패0으로 분리했다. 변경된 통제 파일은 R29 close plan/overlay/test, progress checker, events/progress/handoff/digest/manifest와 본 WORK_STATUS다. local close test 2 PASS·compileall exit0; 최종 G-05와 게시 HEAD 일치는 projection commit/push 후 검증한다.
- 다음 안전 행동: R29 closure commit·push 및 G-05 PASS를 확인한 뒤 승인된 F-18의 실제 OIDC/API 세션·권한 연결을 별도 exact-path WorkInstruction/lease로 분해한다. R29 token은 재사용하지 않는다. 새 branch·`ysna-server`·Production 작업 없음.

# F-18 R29 동일 SHA WSL-server 내부망·HTTP 실측 및 정리 / 2026-09-26

- 판정: `R29_SAME_SHA_WSL_NETWORK_BOUNDED_PASS`, F-18 전체 인수 아님. 승인 Git SSH alias에서 전용 clean detached checkout으로 게시 제품 commit `a9550612084aa0b85c75e2c49844ba0367701d5a`를 받아 제한 Git archive context(2,865,372 bytes)에서 Web/API/Worker image를 순차·오프라인 빌드했다. 실제 image ID는 Web `sha256:46cd7f36ef939baa2ea3cc929adceb40d82096ffe2dc812e7d63991e785a2702`, API `sha256:63fcc0f379923d18f6eb09bd072834869729f88cb123275940056b409b575f56`, Worker `sha256:dfd627c31d3e7c96a48795302915e3a6486888353576ddf61a851a775484f250`이며 각 OCI revision은 같은 commit이다.
- `docker compose config --quiet` exit0 및 필수 synthetic webhook secret 누락 config 거부를 확인했다. 전용 PG18 `server_version_num=180004`, vector extension, Alembic `0016_operations_recovery`, 전용 비-superuser `anvil_app` role을 앱 시작 전에 준비했다. Web loopback `127.0.0.1:8310`→제품 API `/api/health/ready` HTTP200, 같은 내부망의 Worker image→API ready HTTP200. Docker inspect에서 `internal=true` network와 분리된 ingress, Web만 정확한 loopback host port와 두 network, API/Worker/PG18/MinIO는 내부망 하나·host PortBindings=`{}`를 확인했다. Web/API/Worker read-only rootfs·CapDrop=[ALL], Worker image의 외부 `1.1.1.1:443` direct socket `connect_ex=101` 거부. MinIO는 기동/network topology까지만 검증했고 실제 객체 API는 R25 별도 범위다.
- QA 실행 오류2(제품 정식 실패 아님): 첫 시도는 PG 컨테이너 생성 직후 socket 준비 전 `psql`을 호출해 exit1, health 대기 추가. 둘째 시도는 HTTP200 후 빈 Docker `PortBindings`를 `null`로 가정해 assertion exit1; 실제 inspect는 `{}`였고 별도 진단 실행에서 topology·capability 값을 확인한 후 기대값만 바로잡아 같은 image ID로 최종 exit0. 매 시도 trap이 전용 Compose `down --volumes --remove-orphans`를 실행했으며 중간·최종 독립 재조회에서 project container/network/volume 잔류0. 최종에는 exact path owner/realpath·clean commit과 image ID를 대조한 뒤 R29 세 image tag 및 `/home/daon/anvil-f18-r29-network-qa`만 제거했다. 삭제한 합성 credential·tmpfs DB·객체 데이터는 복구하지 않는다.
- 최종 독립 확인 `R29_INDEPENDENT_RESIDUE_ZERO_EXISTING_UNCHANGED_PASS` exit0: R29 path/container/network/volume/image tag/8310 listener 잔류0, 기존 `local-postgres`/`anvil-web` ID·running/healthy 불변, R21 보존 checkout 및 세 image ID 불변. 제품 source/공유 WSL DB/서비스 변경0·Developer 정식 실패0. 이 결과는 현재 SHA의 network/PG18 migration·readiness bounded QA이며 OIDC 제품 세션/권한, 실제 MinIO S3 업무 연결, browser Network, PG18 backup/restore, rollback, 전체 운영 유사 rehearsal·Production은 미검증이다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 R29 worker/write lease 정식 회수 후 OIDC/API 연결 Stage를 발행한다.

# F-18 R29 동일 SHA WSL-server 실제 network QA 자원 계획 / 2026-09-26

- 판정: `R29_SAME_SHA_WSL_NETWORK_QA_PLANNED`, 담당 Main. 로컬 제품 exact3 SHA `a9550612084aa0b85c75e2c49844ba0367701d5a`를 SSH Git alias `git@github-sinsan-develop:sinsan-develop/Anvil.git`에 push한 뒤 G-05 seq1576 PASS·로컬/원격 HEAD 일치·clean을 확인했다. R29 독립 review는 로컬 정적 Task 1 `Spec PASS/quality Approved`이며 실제 WSL 증거는 아니다. 로컬 61 PASS/1 기존 warning, 전체 pytest 기존 collection 13 ERROR는 별도 기록을 유지한다.
- WSL-server read-only inventory: exact 신규 path `/home/daon/anvil-f18-r29-network-qa` 부재, `com.anvil.cleanup-scope=F18_R29_NETWORK_QA` container 0, `anvil-f18-r29-network*` network 0, 전용 image tag `anvil-f18-r29-{web,api,worker}:a955061` 부재, loopback 8310 listener 0. 기존 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy, R21 보존 세 image ID 및 clean QA checkout은 변경하지 않는다. PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, MinIO image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`, Docker Compose v5.1.1 확인.
- 신규 자원 상한: daon 소유 mode0700 `/home/daon/anvil-f18-r29-network-qa`와 그 아래 clean detached exact Git checkout·제한 Git archive build context, 전용 Web/API/Worker image tag 3개, Compose project `anvil-f18-r29-network`의 `web/api/worker/postgres/minio` container·`internal/ingress` network·PG18/MinIO tmpfs, loopback Web `127.0.0.1:8310`만. Git fetch/checkout은 승인 SSH alias의 정확한 commit으로 한다. source를 서버에서 patch하지 않고 root Docker build context를 사용하지 않는다. 합성 admin/app/MinIO/Telegram credential만 일회성 프로세스 변수로 사용하고 값은 로그·문서·Git에 쓰지 않는다. 기존 공유 DB·container·network·전역 설정과 `ysna-server`는 접촉하지 않는다.
- 전용 PG18 안에 `anvil_app` 최소 role·vector/migration head를 앱 기동 전에 별도 준비하고 DB/role을 기존 서비스와 공유하지 않는다. 현재 product Compose의 API는 OIDC가 아닌 기존 local/session 경계이므로 HTTP ready는 network·runtime 연결만 증명한다. `docker compose config`의 필수 image/secret 누락 거부, network inspect의 PG18/MinIO/API/Worker internal-only·host port0·Web loopback ingress, capability/read-only, Web→API HTTP, 내부 통신 허용/외부 direct socket 거부를 분리 확인한다. 실패 시 원인·미검증을 기록하고 PASS로 승격하지 않는다.
- 성공·실패 모두 exact project label/ID·image ID·path realpath/owner/비-symlink 확인 후 해당 project만 `down --volumes`, 전용 image tag 3개와 exact QA path만 정리한다. project container/network/volume/path/tag/8310 listener 잔류0과 기존 `local-postgres`·`anvil-web` ID/status 및 R21 보존 image/checkout 불변을 독립 재조회한다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, OIDC 제품/API·브라우저·backup/rollback·Production은 이 QA로 합격하지 않는다.

# F-18 R29 network exact3 단일 writer 통제 전환 / 2026-09-26

- 판정: `R29_CANONICAL_WRITER_LEASE_ISSUED_PENDING_PRODUCT_IMPLEMENTATION`. Main이 동일 branch의 clean 기준 commit `6bd7309b8bbd969efc14528fae27f190ec922e2f`에서 R29 계획·WorkInstruction·invocation을 고정하고 seq1574~1576 `WORK_INSTRUCTION_ISSUED`→`WORKER_LEASE_ISSUED`→`WRITE_LEASE_ISSUED`를 투영했다. canonical seq1576, worker `worker-lease-f18-wsl-ops-r29-20260926-001`, write `write-lease-f18-wsl-ops-r29-20260926-001`, epoch13·각기 다른 fencing token, 제품 exact3만 ACTIVE. R18 종료 token은 재사용하지 않는다.
- 변경된 통제 파일: R29 plan/WI/invocation, `scripts/f18_wsl_ops_r29_network_overlay.py`, `scripts/check_project_progress.py`, overlay test, progress/events/handoff/digest/manifest와 본 WORK_STATUS. 제품 변경0. 로컬 번들 Python의 compileall exit0, stdlib 직접 실행 R29 control test 3 PASS; 로컬 `pytest`는 모듈 부재로 실행 불가(환경 오류1, Developer 정식 실패0). 생성 직후 validator의 유일한 오류 `F18_LOCAL_START_GIT_INVALID`는 projection 파일 미커밋·미게시 상태이며, exact 통제 commit/push 후 G-05로 재검증한다.
- 다음 안전 행동: G-05 PASS 및 원격 HEAD 일치 확인 후 `developer-primary-f18-wsl-ops-r29-network`에게 exact3만 전달한다. 제품 TDD RED→GREEN·검증 뒤 Main이 독립 review하고 동일 Git SHA를 `ssh WSL-server`에서 검증한다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED.

# F-18 R29 제품 내부망·OIDC 구현 경계 확정 / 2026-09-26

- 판정: `R29_PRODUCT_STAGE_SCOPE_FIXED_PENDING_CANONICAL_WRITER_LEASE`. 승인된 F-18 설계 §49.11~49.12·계획 F-18·기본 WorkInstruction 단계3~5와 현재 clean `codex/f18-wsl-ops` HEAD/원격 `e9d3bef209fd62a6795557cc11670a12eb6fcb27`을 대조했다. 설계·계획·매트릭스·테스트계획의 WorkInstruction 기준 SHA-256은 현재 파일과 일치한다. 현재 canonical progress는 seq1573, worker/write lease=null이므로 제품 파일 mutation은 아직 시작하지 않았다. Main 조사·범위 확정만 수행, 오류0·Developer 정식 실패0.
- 첫 단일-writer 제품 경계는 F-18 전용 `deploy/wsl/compose.f18.yml`과 그 static topology/fail-closed 검증 `tests/deploy/test_f18_network_topology.py`, 결과 누적 `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`의 exact3이다. 새 Compose는 F-17의 PG ingress 연결을 복제하지 않는다. Web만 loopback host bind 및 ingress+internal network, API/Worker/PG18/MinIO는 internal-only·host port 0을 기본값으로 한다. API/Worker는 read-only rootfs, cap-drop ALL, no-new-privileges와 필요한 tmpfs만 유지한다. issuer가 필요한 OIDC 실제 API 시험은 명시적 내부 issuer 연결과 same-origin `/auth/*` 경로를 후속 별도 exact-path lease로 결박하며, 외부 egress 허용이나 임의 host port를 조용히 추가하지 않는다.
- TDD: (1) PG/MinIO/API/Worker의 ingress 또는 host port 노출, (2) Web 외 서비스의 외부 network, (3) 누락된 role image·필수 synthetic secret, (4) 최소권한 옵션 회귀를 우선 RED로 고정한 뒤 최소 Compose로 GREEN을 만든다. Main은 diff·로컬 테스트·G-05를 독립 검토하고 안전 commit/push 후 `ssh WSL-server`의 clean detached 같은 Git SHA와 새 역할별 image에서 실제 Docker topology/HTTP·외부 socket 거부/잔류0을 검증한다. 정적 Compose PASS 또는 R28 probe PASS를 실제 제품 network capability PASS로 승격하지 않는다.
- OIDC 별도 경계: 기존 `OidcIdentity`가 token role/project/scope를 신뢰하지 않는 계약은 유지한다. `runtime.py`의 COOKIE/WSL_ACCEPTANCE만 있는 현재 구성에 issuer code flow를 단순히 켜는 것으로 PASS 처리하지 않는다. 기존 권한의 신뢰 가능한 local 매핑, 원자·일회성 pending auth/session 소유권, step-up 승인 scope와 same-origin ingress를 정확한 제품 경로·거부 테스트로 후속 WorkInstruction에 고정한다. 새 공개 API·영속 schema·권한 의미 변경이 정말 필요한지는 기존 설계와 먼저 대조한다. 그 전에는 제품 OIDC PASS를 주장하지 않는다.
- 다음 안전 행동: Main이 위 network exact3에 대한 새 revision/WorkInstruction·invocation·canonical worker/write fencing token을 발행하고 G-05로 통제 상태를 검증한 뒤 `developer-primary` 단일 writer에게 전달한다. 현재 R18 종료 lease/token 재사용 금지. branch 추가 생성·`ysna-server`/Production 작업 없음. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED.

# F-18 R28 동일 API/Worker 이미지 WSL 내부망 격리 probe·정리 / 2026-09-26

- 판정: `R28_SAME_IMAGE_INTERNAL_NETWORK_PRIMITIVE_BOUNDED_PASS`, F-18 전체 network policy 인수 아님. WSL-server에서 R21 공개 QA tag commit `4eadfcd441b55445237545146ae5ba4051739904`의 실제 API image ID `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b`와 Worker image ID `sha256:6a8a0e1de3346c2a348487295504c9070557650a50459805798cb6f41262d43f`를 재빌드 없이 사용했다. 전용 Docker `internal=true` bridge 하나에서 Worker image→API image의 **probe HTTP server** DNS/HTTP `200 OK`, 외부 `1.1.1.1:443` direct socket `connect_ex=101` 거부를 실측했다(exit0).
- 두 QA container의 Docker inspect에서 rootfs read-only=true, CapDrop=[ALL], host PortBindings={}, NetworkMode=전용 internal network, network label/내부 여부 일치를 확인했다. 종료 trap과 독립 재조회에서 `anvil-f18-r28-{peer,worker-probe}` container 및 `anvil-f18-r28-internal` network 잔류0, R21 image ID/clean checkout·기존 `local-postgres`/`anvil-web` ID/running 불변. 신규 DB/port/volume/Secret/제품 source 없음. 실행 오류0·Developer 정식 실패0.
- 이 실측은 **현재 역할별 image의 Docker 내부망 primitive**에 한정한다. API의 실제 OIDC issuer egress, 제품 API/Worker/PG18/object store가 함께 구동되는 F-18 Compose topology, Web ingress-only·브라우저 same-origin·host 방화벽·rollback 및 trusted capability collector는 미검증이다. 특히 F-17 Compose의 PG ingress 동시 연결을 F-18 network PASS로 재사용하지 않는다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 OIDC 권한/세션 계약과 F-18 전용 Compose의 제품 단일 writer WorkInstruction/lease를 확정해 실제 target E2E로 진행한다.

# F-18 R28 동일 이미지의 WSL-server 내부망 격리 probe 자원 계획 / 2026-09-26

- 판정: `R28_INTERNAL_NETWORK_PRIMITIVE_QA_PLANNED`, 담당 Main. 공개 tag `f18-wsl-qa-4eadfcd`의 보존 API image ID `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b`, Worker image ID `sha256:6a8a0e1de3346c2a348487295504c9070557650a50459805798cb6f41262d43f`를 재빌드 없이 사용한다. WSL-server 사전 inventory에서 전용 `anvil-f18-r28-internal` network와 `anvil-f18-r28-*` container가 없고 기존 `local-postgres`/`anvil-web`은 Up/healthy, image OCI revision은 모두 `4eadfcd441b55445237545146ae5ba4051739904`였다.
- 새 자원: label `com.anvil.cleanup-scope=F18_R28_NETWORK_QA`의 Docker internal bridge network `anvil-f18-r28-internal` 하나, API image의 일회성 `anvil-f18-r28-peer` Python HTTP probe container와 Worker image의 `anvil-f18-r28-worker-probe` 일회성 container. host port/volume/DB/role/파일 경로/Secret/외부 계정은 0. 두 container는 read-only, cap-drop ALL, no-new-privileges, tmpfs `/tmp`, 내부망만 사용한다. API 이미지의 테스트 HTTP server는 제품 API가 아니며 같은 image의 네트워크 namespace/권한 관측용이다.
- internal network label·internal=true, Worker→peer 내부 DNS/HTTP 허용, Worker의 외부 IP direct socket 거부, container의 host PortBindings=0/cap-drop/read-only를 관측한다. 성공·실패 모두 exact label·container ID·image ID·network ID를 검사해 두 QA container와 해당 network만 종료·삭제하고 잔류0, 기존 서비스 ID/status와 R21 image/checkout 불변을 독립 확인한다. 이 시험은 F-18 전용 Compose, 실제 제품 API/Worker/PG18/object-store/OIDC egress 정책, 브라우저, 운영 유사 rehearsal PASS가 아니다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 R27 실제 OIDC/API·network capability 결박 전 코드/계획 대조 / 2026-09-26

- 판정: `R27_CAPABILITY_GAP_CONFIRMED_READ_ONLY`, F-18 전체 인수 아님. Main이 clean `codex/f18-wsl-ops` HEAD `07095daa51c329403d7b5e7a12b9364749b42c2a`/원격 동일, canonical F-18 seq1573·worker/write lease=None을 확인했다. 설계 §49.11~49.12, 계획 F-18, 기본 WorkInstruction 단계3~5의 실제 OIDC/API·network capability 조건을 현재 source와 대조했다. 제품·Git branch·WSL resource 변경0, 조사 오류0·Developer 정식 실패0.
- OIDC: `oidc_identity.py`·`oidc_code_flow.py`·`oidc_issuer_transport.py`는 실제 issuer direct QA까지 검증된 내부 단위지만, `runtime.py::create_runtime_app`의 허용 모드는 COOKIE/WSL_ACCEPTANCE뿐이고 OIDC 구성·세션/권한 연결이 없다. `fastapi_app.py`의 `/auth/session`은 주입된 session issuer에만 열리며 현재 runtime에서는 `LocalTestSessionService`가 유일한 issuer다. OIDC `PendingAuthStore`는 protocol일 뿐 운영 유사 원자·일회성 구현이 없고, 검증된 `OidcIdentity`는 고의로 role/project/permission을 주장하지 않는다. 기존 DB migration 0016에는 OIDC 사용자 권한 매핑/세션 테이블이 없고 Web은 `/auth/session/status`만 호출한다. 따라서 R11의 실제 Keycloak ordinary/step-up direct PASS나 R12의 `/auth/*` ingress PASS를 **제품 API OIDC capability PASS**로 승격할 수 없다.
- Network: 현재 `deploy/wsl/compose.f17.yml`은 `postgres`를 `internal`과 non-internal `ingress` 양쪽에 연결한다. F-18 요구인 PG18/object storage 최소 내부망·Web ingress 경계를 충족하는 `compose.f18.yml`은 아직 없다. R23/R24의 HTTPS Task/Run E2E는 이 F-18 network policy 검증이 아니다. 같은 image를 격리 운영 유사 target에 올리기 전에 전용 Compose의 PG18·API·Worker·object storage internal-only, Web ingress+internal, issuer의 명시적 내부 경로, host bind·capability·egress 거부를 별도 계약/실측으로 고정해야 한다.
- 다음 안전 행동: Main이 승인 F-18 내부 Stage를 (1) trusted issuer subject→기존 role/project/permission·step-up 승인 scope와 원자 pending/session 소유권, (2) F-18 전용 network/Compose, (3) 같은 Git/image의 실제 API·브라우저/DB·collector/rehearsal 순서로 정확한 제품 path·TDD·WSL 기준을 갖춘 WorkInstruction으로 분해한다. 공개 API·인증/권한 의미·새 지속 DB schema의 필요 여부와 기존 승인 범위를 먼저 대조하고, 해당 변경이 범위 밖이면 그 부분만 별도 경계로 보고하되 독립적인 network/rollback 검증은 계속한다. 현재는 제품 write lease를 임의 발급하지 않았고 합성 QA glue로 실제 API PASS를 만들지 않았다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED.

# F-18 R26 동일 artifact 서명 ReleaseManifest preflight QA·정리 / 2026-09-26

- 판정: `R26_SIGNED_RELEASE_MANIFEST_PREFLIGHT_BOUNDED_PASS`, 전체 F-18 인수 아님. WSL-server에서 공개 annotated QA tag `f18-wsl-qa-4eadfcd`의 clean detached commit `4eadfcd441b55445237545146ae5ba4051739904`, 승인 Git SSH remote/tag object, `package-lock.json` SHA-256 `b1cba45d…`, 실제 Web/API/Worker image ID `61f13f7f…`/`ad6a2b73…`/`6a8a0e1d…` 및 OCI revision 일치를 다시 확인했다. image 재빌드·제품 변경0.
- F-16 `preflight_release` 실제 실행 exit0: 현재 관측값에 결박된 일회성 합성 QA Ed25519 서명 envelope hash `sha256:afc834d239f086a49d1967311e56a58f3de68f46b3e7fae237239c0feede18c0`, subject hash `sha256:3a83ff7c1b607904f3fb7be91c3447e6f9bc04c7110b569f1ec20c5bb55d3da2`, 공개키 fingerprint `sha256:16ad0c7081fc94cf3c5fabe9cf9a07854148eadace9b385ee314025fd85bcfd6`. `sbom_ref`는 `sha256:601054349edd6e7272196d08b8257f6b1b217773bf8487e55e4fce8af7b31031`의 **부분 source dependency/image ID 목록**으로, image/OS SBOM이나 provenance는 아니다. config source 구성 hash `sha256:e2b2453ec07df28ca037c8bc58b95d3127b1d0d49a5112f870774d7ac6d4b613`, bounded evidence hash `sha256:6eb1501b5bf070dc807522c985d2cc1c815751070b9104263ea734b038ffeedd`, QA 입력 report hash `sha256:51c505e1d4c7f1fb4b904cf4ff078c01c4c12466c43d8601416abad0465ab12c`였다. Provider version은 해당 tag의 각 adapter source SHA 앞 12자리로 산출했다.
- 거부 실측: 변조 서명 `MANIFEST_SIGNATURE_INVALID`, 다른 image 관측값 `MANIFEST_OBSERVATION_MISMATCH`, 다른 source commit `GIT_COMMIT_MISMATCH`, 로컬에 없는 image ID `IMAGE_DIGEST_MISMATCH`. 전용 QA path는 mode0700/owner/realpath·비-symlink 확인 후 정확히 제거했고 독립 재조회에서 잔류0. 개인키는 프로세스 메모리에서만 생성·폐기했고 기존 `local-postgres`/`anvil-web`, R21 clean checkout·세 image ID는 불변. 실행 오류0·Developer 정식 실패0.
- 한계: 합성 QA 서명은 운영 신뢰·DeployApproval·ReleaseDecision이 아니다. 부분 SBOM, 과거 bounded R23/R24/R25 증거 참조, 실제 OIDC issuer/API·network policy·trusted capability collector·PG18 backup/restore·rollback·브라우저·운영 유사 rehearsal 미충족이다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 동일 artifact의 실제 OIDC/API 및 network/collector 결박과 격리 rehearsal 검증이다.

# F-18 R26 동일 artifact 서명 ReleaseManifest QA 계획 / 2026-09-26

- 판정: `R26_SIGNED_MANIFEST_BOUNDED_QA_PLANNED`, 담당 Main. R21 clean detached source `/home/daon/anvil-f18-r21-artifact/repo`의 공개 annotated QA tag `f18-wsl-qa-4eadfcd`/commit `4eadfcd441b55445237545146ae5ba4051739904`와 보존 Web/API/Worker image ID `61f13f7f…`/`ad6a2b73…`/`6a8a0e1d…`를 재사용한다. lockfile SHA-256은 로컬·WSL에서 `b1cba45d362401032ef3ba362073b7c80a8cc42cdef6ee6583884b66e619d8a3`로 일치한다. 세 image의 OCI revision도 해당 commit으로 확인했다. source/image·기존 서비스 변경은 하지 않는다.
- WSL-server 사전 읽기 전용 inventory에서 전용 exact path `/home/daon/anvil-f18-r26-manifest-qa` 부재, 시스템 Python cryptography 41.0.7 확인. 신규 자원은 daon 소유 mode0700 QA 디렉터리 안의 **일회성 합성 Ed25519 개인키/공개키, 현재 관측값 JSON, 부분 source-dependency SBOM, 범위 제한 evidence/report, 서명 envelope**뿐이다. container/DB/network/port/volume/프로세스 상주 자원은 생성하지 않는다. 실제 운영 신뢰키나 승인 기록을 만들지 않는다.
- 계획 검증은 F-16 `preflight_release`의 실제 remote/tag/clean checkout, `package-lock.json`, 세 image ID, 독립 공개키 fingerprint·서명·관측값 결박과 변조 signature/image/commit 거부다. 부분 SBOM은 npm/uv lock 해시와 image ID만 다루며 전체 image/OS SBOM이 아니다. QA key와 파일은 검사 후 exact path realpath·owner·비-symlink를 확인해 삭제하고 잔류0을 재조회한다. R21 checkout/image는 Main 소유 ACTIVE로 유지한다. 성공해도 OIDC·network policy·trusted capability collector·backup/rollback·운영 유사 rehearsal·Production을 PASS로 올리지 않는다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`.

# F-18 R25 현재 API image의 WSL 격리 MinIO 객체 저장소 QA·정리 / 2026-09-26

- 판정: `R25_CURRENT_API_IMAGE_MINIO_BOUNDED_PASS`, F-18 전체 인수 아님. R21 보존 API image ID `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b` **내부** Python의 `S3ArtifactStore`를 전용 MinIO image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`와 실제 S3 API로 연결했다. 전용 Docker internal network, MinIO tmpfs `/data`, host bind/volume0, 일회성 합성 credential·bucket·객체만 사용했다.
- 실제 실행 exit0: content-addressed put/read 및 hash `sha256:066f48792700fe7453601730cda09c3217d5f2d16683b2d78165a18aad63a27b` 일치, 동일 바이트 조건부 재기록의 dedupe, 다른 바이트로 변조된 기존 객체의 collision 거부, 손상 객체 read 무결성 거부, 잘못된 credential 쓰기 거부와 redacted 오류를 각각 관측했다. 제품 source/image 변경0, QA runner 오류0, Developer 정식 실패0. 이는 현재 API image의 저장 adapter 직접 호출 증거이지 API 업무 흐름/Release capability collector 전체 PASS가 아니다.
- 종료 trap 및 독립 read-only 재조회에서 `anvil-f18-r25-minio`·`anvil-f18-r25-client` container, `anvil-f18-r25-object` network, 전용 volume, host 9000 listener 잔류0. 기존 `local-postgres`·`anvil-web` ID/running 상태 불변, R21 API image ID 보존. 합성 객체·credential은 tmpfs/container 제거로 폐기. 실제 OIDC issuer/API, network policy, signed ReleaseManifest·trusted collector, backup/rollback·브라우저·운영 유사 rehearsal은 미검증이다. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 현재 세 image의 신뢰 입력·서명 manifest와 실측 capability 결박을 진행한다.

# F-18 R25 현재 API image의 WSL 격리 객체 저장소 QA 자원 계획 / 2026-09-26

- 판정: `R25_SAME_IMAGE_OBJECT_STORE_QA_PLANNED`, 담당 Main. 공개 QA tag `f18-wsl-qa-4eadfcd`의 R21 보존 API image ID `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b` **내부** Python과 `S3ArtifactStore`를 격리 MinIO 실제 API에 연결한다. 소스 재빌드·제품 write·기존 DB/서비스 접근은 하지 않는다.
- WSL-server read-only inventory: 전용 `anvil-f18-r25-minio`·`anvil-f18-r25-client` container, `anvil-f18-r25-object` network, `/home/daon/anvil-f18-r25-object-qa` path 부재, 9000 host listener 없음. 캐시된 MinIO image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`. 신규 자원은 내부 전용 Docker network, tmpfs `/data`의 MinIO container, 동일 API image의 일회성 검증 container뿐이며 host port·volume·파일 경로는 생성하지 않는다. 합성 일회성 credential·bucket·객체만 사용한다.
- 실제 put/read, 같은 바이트 dedupe, 다른 바이트 collision, 저장 객체 corruption 감지, 잘못된 credential 권한 거부를 분리 관측한다. 오류는 endpoint/credential 원문 없이 기록한다. 성공·실패 모두 이름·label·image를 확인한 정확한 두 container와 전용 network만 제거하고 container/network/volume/host listener 잔류0 및 기존 `local-postgres`/`anvil-web` 불변을 재검사한다. 이 시험은 현재 API image의 객체 저장 adapter에 한정되고 전체 F-18, OIDC, signed manifest, network policy, 브라우저, 운영 유사 target 인수가 아니다.

# F-18 R24 동일 artifact PG15 HTTPS Task/Run·SSE QA 및 정리 / 2026-09-26

- 판정: `R24_SAME_IMAGE_PG15_HTTPS_TASK_RUN_SSE_BOUNDED_PASS`, F-18 전체 인수·정식 WSL Test/Staging 인수 아님. R23 PG18과 동일 clean Git tag commit `4eadfcd441b55445237545146ae5ba4051739904`와 R21 보존 Web/API/Worker image ID(`61f13f7f…`/`ad6a2b73…`/`6a8a0e1d…`)를 재빌드 없이 사용했다. 기존 `local-postgres` 안에 **새 전용** `anvil_f17_pg15_f18r24` DB와 migrator/app role만 생성했고, PG15 `150018`, pgvector `0.8.2`, Alembic `0016_operations_recovery`, vector distance `1`, HTTPS Web·API readiness HTTP200을 관측했다. TLS proxy의 `/auth/`·`/api/`는 모두 제품 Web을 거쳤다.
- 잠긴 Python3.12 임시 venv에서 opt-in `tests/integration/test_f17_runtime_e2e.py -k real_task_run_events`의 `phase=create` 1 PASS·1 SKIP(exit0, warning1): 합성 Task/Run HTTP·DB row/event 일치, task `adcbdc20-86c0-4427-91c2-5d192095bbbf`, run `e30cc5e4-b105-4822-a38c-47231e19ff25`, evidence `sha256:693486704142eb37e93ec9bcbdd17d6f29923c7b489668a6acb1da522b506332`. 같은 DB·API image를 새 run allowlist로 재생성한 `phase=events`도 1 PASS·1 SKIP(exit0, warning1): SSE event ID=DB, evidence `sha256:c63b957f59e4aecd39c63895a153c3f39362122e3d1ab94d6993e222f58b1ed9`. 경고는 harness의 `httpx verify=<str>` deprecation이며 제품 실패는 아니다. R24 QA runner 오류0·Developer 정식 실패0·제품 source 변경0.
- 종료 시 TLS/QA Compose를 먼저 내리고 전용 DB owner·이름과 role identity를 확인해 **그 DB·두 role만** 삭제했다. 최종 독립 확인에서 DB·role·QA path/venv/cert·project container/network/volume·TLS container·loopback 8315/8443 잔류0, 기존 `local-postgres`/`anvil-web` ID·running 상태와 R21 image ID/clean checkout 불변이다. 기존 PG15의 사전 외부 bind는 변경하지 않았다. R21 image/checkout은 후속 동일-artifact 검증용 ACTIVE 유지. 이 결과와 R23은 양 PG 엔진의 한 합성 핵심 경로에 한정되며 OIDC·object storage·network policy·signed ReleaseManifest/collector·rollback/운영 유사 rehearsal·브라우저는 미검증. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 같은 artifact에 결박한 Git 배포 capability·manifest와 격리 운영 유사 target의 남은 실제 검증이다.

# F-18 R24 동일 artifact PG15 HTTPS Task/Run E2E 자원 계획 / 2026-09-26

- 판정: `R24_SAME_IMAGE_PG15_HTTPS_E2E_PLANNED`, 담당 Main. 기존 단일 branch의 공개 QA tag `f18-wsl-qa-4eadfcd`와 R21 보존 Web/API/Worker image ID 세 개를 재빌드 없이 사용한다. R23 PG18과 동일 image를 WSL-server PostgreSQL15 일반 통합의 합성 Task→Run HTTP+DB·API 재생성 후 SSE=DB에 적용하되, 전체 F-18 인수나 운영 검증으로 승격하지 않는다.
- WSL-server read-only inventory: 새 QA path `/home/daon/anvil-f18-r24-pg15-qa`, Compose project `anvil-f18-r24-pg15`, TLS container `anvil-f18-r24-tls` 부재, loopback 8315/8443 free. 기존 `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running/PG15 `150018`·pgvector 사용 가능 버전 `0.8.2`, `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running. 정확한 신규 DB `anvil_f17_pg15_f18r24`, migrator/app role `anvil_f17_migrator_f18r24`/`anvil_f17_app_f18r24`는 모두 부재.
- 기존 PG15의 다른 DB·role·설정·기존 서비스는 변경하지 않는다. 전용 DB·두 role 및 그 안의 vector/migration0016·합성 row만 만들고, source 수정 없이 QA 전용 Compose Web/API/Worker와 HTTPS proxy를 별도 network/path에 둔다. 잠긴 Python3.12 임시 venv·합성 credential/CA만 사용한다. 실제 HTTP/DB/재시작/SSE 결과와 실패 단계를 분리해 기록한다.
- 성공·실패 모두 QA API/Worker/TLS를 먼저 종료하고 전용 DB 연결0·정확한 DB/role identity 확인 후 해당 DB/role만 삭제한다. QA container/network/path/venv/cert/loopback listener 잔류0·기존 PG15/Web 불변을 독립 확인한다. R21 세 image/checkout은 다음 동일-artifact QA를 위해 ACTIVE 유지한다. 기존 PG15의 사전 외부 bind는 이 시험에서 변경·확대하지 않으며 network policy PASS로 간주하지 않는다.

# F-18 R23 동일 artifact PG18 HTTPS Task/Run·SSE QA 및 정리 / 2026-09-26

- 판정: `R23_SAME_IMAGE_PG18_HTTPS_TASK_RUN_SSE_BOUNDED_PASS`, 전체 F-18 인수 아님. 공개 QA tag `f18-wsl-qa-4eadfcd`의 clean checkout·R21 보존 Web/API/Worker image ID(`61f13f7f…`/`ad6a2b73…`/`6a8a0e1d…`)와 격리 PG18 image ID `5a9c2dbe…`를 사용했다. Web `/`·Web→API `/api/health/ready`의 loopback TLS HTTP200, 실제 PG `180004`·vector `0.8.2`·migration `0016_operations_recovery`·최소 app role을 재확인했다. TLS proxy는 `/auth/`와 `/api/` 모두 제품 Web을 거쳤고 API 직접 우회 경로는 만들지 않았다.
- 잠긴 Python 3.12 임시 venv에서 opt-in `tests/integration/test_f17_runtime_e2e.py -k real_task_run_events`의 `phase=create` 1 PASS·1 SKIP(exit0, warning1): 합성 Task/Run HTTP201/202 및 DB row/event 일치, run `4e56d245-1f4b-462d-b819-13e527eea7dd`, evidence hash `sha256:5749717fc665758f4cb23dd1bbf41f87f9828bba79d549706631817529694b9f`. 같은 DB·API image를 새 run allowlist로 재생성한 `phase=events`도 1 PASS·1 SKIP(exit0, warning1): SSE event ID=DB, evidence hash `sha256:a90abadd00179196fecefc8ecfe6d6f16e5ce2d72e2bd1772d443789e6c43198`. 경고는 테스트의 `httpx verify=<str>` deprecation이며 검증 실패는 아니다.
- 시행 오류 3건은 제품 정식 실패가 아닌 QA runner 환경 오류다: (1) Caddy 이미지의 Entrypoint=null인데 `run`만 전달해 executable 미발견, (2) Caddy 실행 파일의 file capability와 `--cap-drop ALL`이 충돌해 `operation not permitted`, (3) 오프라인 uv cache에 `httpcore`가 없어 venv 설치 불가. 각각 image inspect·분리 실행으로 원인을 확인하고 Caddy 실행 인자, 일회성 컨테이너 cap 설정, Python3.12 잠금 의존성 설치만 교정했다. 제품 source/image·공유 설정 변경0, Developer 정식 실패0.
- 매 시도 종료 시 전용 `anvil-f18-r23-pg18` Compose `down --volumes`, 정확한 TLS container와 QA path/cert/key/venv/합성 tmpfs DB를 정리했다. 최종 독립 확인: path·project container/network/volume·TLS container·loopback 32769/8300/8443 listener 잔류0; 기존 `anvil-web`/`local-postgres` ID와 running 상태 불변. R21 세 image ID와 clean checkout은 후속 동일-artifact QA 입력으로 ACTIVE 유지한다. 로컬 G-05 seq1573 PASS. PG15 일반 통합, 실제 OIDC/MinIO/network policy, signed manifest/collector, backup/restore·rollback, 브라우저·운영 유사 target은 미검증. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED. 다음은 동일 artifact의 PG15 일반 통합 검증이다.

# F-18 R23 동일 artifact PG18 HTTPS Task/Run E2E 자원 계획 / 2026-09-26

- 판정: `R23_SAME_IMAGE_HTTPS_E2E_PLANNED`, 담당 Main. 공개 QA tag `f18-wsl-qa-4eadfcd`/clean commit `4eadfcd441b55445237545146ae5ba4051739904`와 R21 보존 Web/API/Worker image ID 세 개만 사용한다. F-17의 opt-in `tests/integration/test_f17_runtime_e2e.py`를 **현재 F-18 image**에 실행해 실제 Task→Run HTTP+DB·API 재시작 후 SSE=DB를 한정 검증한다. 테스트의 F-17 환경 명칭은 기존 guard 계약일 뿐 현재 F-18 전체 인수를 뜻하지 않는다.
- WSL-server 사전 read-only inventory: 신규 `/home/daon/anvil-f18-r23-e2e-qa`, Compose project `anvil-f18-r23-pg18`, TLS container `anvil-f18-r23-tls` 모두 부재, loopback 32769/8300/8443 listener 0. PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, Caddy image ID `sha256:612f0ff47f33888e3b61a8db399ff2dc22c2cefb8cb652d86a619e52eabcd51f`, `uv` 실행 경로 `/home/daon/.local/bin/uv` 확인. 기존 `local-postgres`·`anvil-web` ID/status 불변.
- 신규 자원은 daon 소유 mode0700 전용 QA 경로와 그 안의 일회성 TLS cert/key·Caddyfile·잠긴 venv/cache/pytest temp, 전용 PG18 Compose postgres/web/api/worker·두 network·tmpfs DB, loopback DB32769/Web8300/TLS8443, 이름이 고정된 Caddy container 한 개뿐이다. F-17 Compose의 API/Worker 중복 `command`는 R22에서 원인이 확인됐으므로 source 변경 없이 in-memory QA override `command: null`로 제거한다. 합성 credential·actor/project/run만 사용하며 Secret 값은 출력·Git 기록하지 않는다. 기존 서비스·DB·역할·설정은 변경하지 않는다.
- 전용 DB에 vector extension·migration0016 및 최소 app role을 만든 뒤 Web `/api/`·`/auth/`를 모두 거치는 loopback TLS proxy에서 opt-in F-17 `phase=create`를 실행한다. 성공 시 같은 DB와 image ID에서 API만 동일 설정·새 run ID로 재생성해 `phase=events`의 SSE event ID=DB를 확인한다. TLS QA gateway가 제품 ingress를 우회해 auth만 직접 API로 보내지 않는다. 실패 시 HTTP/DB/컨테이너 경계를 redacted 로그로 진단하고 PASS로 승격하지 않는다.
- 성공·실패 모두 exact container/project label/image/port·QA path realpath/owner/비-symlink를 확인해 TLS container, Compose project(`down --volumes`), QA path/cert/key/venv·합성 tmpfs DB만 정리한다. container/network/volume/port/path 잔류0·기존 서비스 불변을 재확인한다. R21 세 image와 checkout은 후속 동일-artifact 검증을 위해 ACTIVE 유지한다. 이 E2E는 PG15·실제 OIDC/MinIO/network policy·서명 manifest·운영 유사 rehearsal·Production 증거가 아니다.

# F-18 R22 동일 artifact WSL 격리 PG18 HTTP+DB QA·정리 / 2026-09-26

- 판정: `R22_SAME_IMAGE_PG18_HTTP_DB_BOUNDED_PASS`, 전체 F-18 인수 아님. 공개 tag `f18-wsl-qa-4eadfcd`의 clean source와 R21 Web/API/Worker **동일 세 image ID**로 전용 Compose project `anvil-f18-r22-pg18`을 실행했다. PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, 실제 server `180004`, pgvector `0.8.2`, Alembic head `0016_operations_recovery`, vector distance `1`을 DB에서 조회했다. 전용 app role `anvil_app`의 superuser/createdb/createrole=false·login=true. 세 app service running, loopback Web `/` HTTP200, Web→API `/api/health/ready` HTTP200.
- 시행 오류 3건은 제품 정식 Developer 실패가 아닌 QA runner/topology 오류로 분리한다. (1) 최초 base64→bash stdin 파이프에서 `psql`이 뒤따른 스크립트를 소비해 migration 전 exit0으로 끝났다. (2) F-17 Compose의 API·Worker `command`가 F-18 이미지의 `ENTRYPOINT`에 중복 전달돼 uvicorn/worker가 인자 오류로 종료하고 Web API502였다. (3) 중복 command를 QA in-memory Compose override로 제거한 뒤 합성 `TELEGRAM_ALLOWED_IDENTITIES`가 `chat:user` 쌍이 아닌 단일 값이라 API startup `RuntimeConfigurationError`, Web API502였다. 실제 로그·계약을 확인하고 각각 실행 전달 방식·QA 전용 command override·합성 allowlist 형식만 교정했다. 제품 이미지/추적 source 변경0, 공유 환경 설정 변경0. 교정 후 동일 image ID로 위 bounded PASS를 얻었다.
- 매 시도 전용 PG18 DB/role/credential은 tmpfs와 프로세스 변수에만 두고 Compose `down --volumes`로 제거했다. 최종 독립 read-only 확인에서 R22 project container/network/volume, QA path, 32769/8300/8443 listener 잔류0. 기존 `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running, `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy 불변. R21 세 image ID/revision은 그대로 보존 중이며 Main 소유 ACTIVE다. 합성 DB/credential은 삭제돼 복구 불가; 공개 tag와 image는 후속 QA 입력으로 남는다.
- 이 증거는 PG18 migration/vector, 최소 role 속성, 단순 Web/API readiness에 한정된다. 합성 Task/Run/SSE, PG15 일반 통합, HTTPS/auth/browser, 실제 OIDC·MinIO·network policy, backup/restore·rollback, 서명 manifest/collector·운영 유사 target은 여전히 미검증. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 같은 세 image ID로 PG15 일반 통합 및 PG18 핵심 HTTP+DB E2E를 진행한다.

# F-18 R22 현재 세 image의 WSL 격리 PG18 HTTP+DB QA 자원 계획 / 2026-09-26

- 판정: `R22_PG18_HTTP_DB_QA_PLANNED`, 담당 Main. R21 공개 tag `f18-wsl-qa-4eadfcd`의 clean detached checkout과 동일 image ID Web `61f13f7f…`, API `ad6a2b73…`, Worker `6a8a0e1d…`만 사용한다. 기존 F-17 `deploy/wsl/compose.f17.yml`을 source 변경 없이 별도 Compose project `anvil-f18-r22-pg18`으로 재사용한다. 이 단위는 F-18 단계1의 실제 PG18 migration·Web→API HTTP·DB 관측만 확인하며 F-17 ProductValidation 또는 전체 F-18 인수 판정이 아니다.
- 생성 전 WSL-server read-only inventory: 신규 exact `/home/daon/anvil-f18-r22-pg18-qa` 부재, project label container 0, loopback `32769`·`8300`·`8443` listener 0. PG18 공유 cache image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c` 확인. 기존 `local-postgres` ID `99f3bf939d40` Up·`anvil-web` ID `f0107aada3b2` Up/healthy, 다른 Compose project는 보존한다.
- 신규 QA 자원은 daon 소유 mode0700 exact 경로 한 개, 전용 Compose project의 postgres/web/api/worker container 네 개·internal/ingress network 두 개, PGDATA tmpfs와 loopback PG18 `:32769`·Web `:8300`뿐이다. named volume 0. postgres는 위 정확한 PG18 image, 세 app service는 R21 image ID로 지정한다. 합성 admin/app/Telegram/test-session credential은 임시 프로세스 변수에서 생성하고 값은 문서·로그에 출력하지 않는다. 기존 `anvil` DB·role, 공유 PostgreSQL/서비스/네트워크/전역 설정을 변경하지 않는다.
- postgres healthy 뒤 전용 `anvil_f17_qa` DB에 vector extension·Alembic head `0016_operations_recovery`를 admin으로 적용하고 최소 app role `anvil_app`의 DB/스키마 CREATE=false·비-superuser를 확인한다. 이후 정확한 세 app image로 API/Web/Worker를 구동해 loopback Web→API ready·실제 DB version/head/vector query를 관측한다. HTTPS 인증·Task/Run/SSE·PG15·OIDC/MinIO/network capability·backup/rollback은 이 단위의 PASS에 포함하지 않는다.
- 성공·실패 모두 project label/ID·image ID·port와 exact QA path realpath/owner/비-symlink를 확인해 전용 Compose project(`down -v`)와 exact QA path만 제거하고 container/network/volume/port/path 잔류0을 확인한다. R21 세 image tag와 checkout은 다음 동일-artifact 시험을 위해 유지한다. 기존 두 서비스 ID/status 불변을 재확인한다.

# F-18 R21 공개 QA tag 동일 artifact 이미지 빌드·보존 / 2026-09-26

- 판정: `R21_SAME_TAG_THREE_IMAGES_BUILT_RETAINED`, F-18 인수 아님. WSL-server 전용 `/home/daon/anvil-f18-r21-artifact/repo`에서 공개 annotated tag `f18-wsl-qa-4eadfcd`의 clean detached commit `4eadfcd441b55445237545146ae5ba4051739904`를 F-16 `verify_exact_checkout` exit0으로 검증했다. tracked 최소 archive context를 만들어 Web/API/Worker target을 각각 `--pull=false`, 1GiB/2CPU 제한으로 빌드 exit0. Docker legacy builder 경고 외 빌드 오류0.
- 실제 Web image ID `sha256:61f13f7ffa9d20713c6cc4234b4529bce2d4b0c8f1d11b73832a28c3213910bf`, API `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b`, Worker `sha256:6a8a0e1de3346c2a348487295504c9070557650a50459805798cb6f41262d43f`. 세 ID는 구분되며 OCI revision은 모두 exact tag commit. Web은 UID101/Nginx, API·Worker는 UID10001/각 역할 entrypoint. `docker image inspect` 재조회에서도 ID/revision 동일, source checkout clean. 이미지 runtime/PG15/PG18·실제 OIDC/object store/network/browser 검증은 아직 하지 않았다.
- 세 전용 tag `anvil-f18-r21-{web,api,worker}:4eadfcd` 및 exact checkout/context는 Main 소유 `ACTIVE`로 후속 Test/Staging→격리 rehearsal의 동일 image ID 검증 전까지 보존한다. 새 container/DB/network/port/Secret은 없고 기존 `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` Up, `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` Up/healthy 불변. 완료·중단 시 exact path/tag/ID/owner를 대조하고 전용 자원만 제거한다.
- 다음 안전 행동: 이 세 ID를 유지한 채 같은 checkout에서 lockfile/SBOM/migration/config/provider/evidence의 실제 관측값을 수집하고 QA 전용 독립 신뢰키의 출처를 정의한 뒤 서명 manifest를 검증한다. 이후에만 동일 image ID를 Test/Staging·격리 target의 PG15/PG18/OIDC/object store/network/브라우저·rollback 시험에 사용한다. 지금은 ReleaseManifest·capability collector·운영 유사 rehearsal 미검증이며 F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R21 동일 artifact 유지형 WSL 이미지 QA 자원 계획 / 2026-09-26

- 판정: `R21_SAME_TAG_IMAGE_BUILD_PLANNED`. 담당 Main, 기존 branch `codex/f18-wsl-ops`/canonical seq1573·worker/write lease=None. 공개 annotated QA tag `f18-wsl-qa-4eadfcd`의 peeled commit `4eadfcd441b55445237545146ae5ba4051739904`만 source로 사용한다. 현재 R19 `fac742eb` image ID는 재사용하지 않는다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.
- WSL-server 읽기 전용 inventory에서 신규 `/home/daon/anvil-f18-r21-artifact`와 전용 `anvil-f18-r21-{web,api,worker}:4eadfcd` tag 부재, 기존 `local-postgres`·`anvil-web` ID/status 불변, root 파일시스템 여유 562GiB·메모리 available 약 5.4GiB를 확인했다. 실행 직전 exact 경로·tag·기존 서비스 ID를 다시 확인한다.
- 신규 자원은 daon 소유 mode0700 전용 checkout `/home/daon/anvil-f18-r21-artifact/repo`, 하위 제한된 Git archive context, 전용 image tag 세 개뿐이다. 승인 tag fetch→clean detached exact checkout을 F-16 gate로 검증하고, tracked 최소 입력만 archive해 `Dockerfile.f18` 세 role을 `--pull=false`, 1GiB/2CPU 제한으로 빌드한다. image ID·revision·role entrypoint·user를 기록한다. 이 단위에서는 container/DB/network/port/Secret/브라우저를 생성하지 않는다.
- R19와 달리 세 전용 image tag는 후속 동일 digest Test/Staging·격리 rehearsal에 재사용하기 위해 **ACTIVE Main 소유 QA 자원**으로 보존한다. 다른 branch/프로젝트와 공유하거나 Production에 사용하지 않는다. source tag/object·image ID가 달라지거나 F-18 증거 수집이 중단되면 exact tag·checkout의 owner/revision/ID를 대조하고 정리한다. 후속 검증 완료 때도 동일 방식으로 전용 자원만 제거해 잔류0을 기록한다. 보존은 합격이나 ReleaseManifest 서명을 의미하지 않는다.

# F-18 R20 공개 QA tag 실제 Git gate·정리 / 2026-09-26

- 판정: `R20_ANNOTATED_TAG_EXACT_CHECKOUT_PASS_BOUNDED`, 전체 F-18 인수 아님. 승인 remote의 annotated tag `f18-wsl-qa-4eadfcd` object `dc9f0c64e22c78c9fce6a28d471a74756a430a0f`가 commit `4eadfcd441b55445237545146ae5ba4051739904`를 가리킴을 로컬·WSL-server에서 확인했다. WSL-server 전용 `/home/daon/anvil-f18-r20-git-qa/repo`에서 해당 tag만 fetch, clean detached exact HEAD로 `deploy.wsl.f16_staging.verify_exact_checkout` 실행 exit0 `F16_EXACT_CHECKOUT_PASS`.
- 정리 전 전용 path realpath·비-symlink·`daon:daon`/0700·clean HEAD를 확인한 뒤 exact checkout을 삭제해 경로 잔류0. 기존 `local-postgres`·`anvil-web` ID와 Up/healthy 상태 불변. 신규 Docker/DB/Secret/port/browser/network listener 없음. QA tag는 게시된 Git 재현 입력으로 보존한다.
- R19의 세 image ID는 **이전** `fac742eb99ff13d1d78af1bce761534cde52df6c` 기준이었고 정리됐다. R20 tag의 `4eadfcd`와 동일 commit·digest artifact가 아니므로 ReleaseManifest에 합산할 수 없다. 다음 안전 조치는 단일 공개 QA tag commit에서 세 image를 다시 빌드·실제 Test/Staging 기능을 검증하고, 동일 artifact를 격리 target에 재사용할 수 있는 수명·저장·정리 경계를 마련한 뒤 독립 신뢰키와 실측 입력으로 서명 manifest/collector를 결박하는 것이다. 실제 서명 manifest·세 현재 image의 유지·capability/PG18/운영 유사 rehearsal은 미검증, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.

# F-18 R20 서명 manifest 선행 Git tag 경계 QA 계획 / 2026-09-26

- 판정: `R20_ANNOTATED_QA_TAG_PUBLISHED_GIT_GATE_PENDING`. 담당 Main, 제품 수정·신규 branch 없음. 기존 `codex/f18-wsl-ops`의 clean·게시 commit `4eadfcd441b55445237545146ae5ba4051739904`에 QA 전용 annotated tag `f18-wsl-qa-4eadfcd`를 생성·게시했다. tag object `dc9f0c64e22c78c9fce6a28d471a74756a430a0f`, peeled commit은 위 SHA다. 이는 F-16 `verify_exact_checkout`의 공개 tag 입력 준비이며 ReleaseDecision/배포 승인이 아니다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.
- WSL-server 읽기 전용 사전 확인: 승인 Git SSH alias에서 정확한 tag object가 조회됐고 신규 `/home/daon/anvil-f18-r20-git-qa`는 부재, 기존 `local-postgres` ID `99f3bf939d40` Up·`anvil-web` ID `f0107aada3b2` Up/healthy다. 신규 자원은 daon 소유 mode0700 전용 checkout 한 개와 그 안의 Git metadata뿐이다. 승인 tag를 fetch해 clean detached exact commit·tag object·remote를 `verify_exact_checkout`으로 확인한다. Docker/DB/Secret/port/browser/network listener는 만들지 않는다.
- 종료 시 exact realpath·owner·비-symlink·HEAD/dirty를 확인한 뒤 전용 checkout만 제거하고 경로 잔류0·기존 두 서비스 불변을 재확인한다. Git tag는 재현 가능한 QA 입력으로 보존한다. 이 검증은 서명 manifest, 세 현재 image의 유지·동일 digest, capability collector 또는 운영 유사 rehearsal PASS가 아니다.

# F-18 R19 현재 SHA 세 역할 image 재검증 자원 계획 / 2026-09-26

- 판정: `R19_CURRENT_SHA_IMAGE_QA_PLANNED`. 담당 Main, 기존 단일 branch `codex/f18-wsl-ops`, 게시·clean HEAD `fac742eb99ff13d1d78af1bce761534cde52df6c`, canonical seq1573·worker/write lease=None·G-05 PASS. 제품 write 없이 F-18 단계1의 현재 SHA image 증거만 수집한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED.
- WSL-server 접근은 `ssh WSL-server`만 사용한다. 읽기 전용 inventory에서 신규 `/home/daon/anvil-f18-r19-qa` 부재, Docker 29.1.3, 전용 `anvil-f18-r19-*` tag 부재, 기존 `local-postgres` ID `99f3bf939d40` Up 및 `anvil-web` ID `f0107aada3b2` Up/healthy를 확인했다. 실행 직전 exact 경로·tag·기존 ID를 재확인한다.
- 신규 자원은 daon 소유 mode0700 exact 임시 checkout `/home/daon/anvil-f18-r19-qa`와 그 하위 제한된 Git archive build context, 전용 image tag `anvil-f18-r19-web:fac742eb`, `anvil-f18-r19-api:fac742eb`, `anvil-f18-r19-worker:fac742eb`뿐이다. 승인 SSH alias에서 exact 공개 SHA를 clean detached checkout하고 추적된 Dockerfile 입력만 archive하여 legacy Docker build context를 제한한다. `deploy/wsl/Dockerfile.f18`의 세 target을 `--pull=false`, `--memory=1g`, `--cpu-quota=200000`, 동일 exact `ANVIL_RELEASE_COMMIT`으로 빌드해 각 image ID·OCI revision·role source/entrypoint를 inspect한다. 기존 서비스·DB·network·port·Secret·Production은 변경하지 않는다.
- QA 종료 시 checkout realpath/owner/비-symlink·Git HEAD, 각 tag의 exact revision과 선행 부재를 재확인해 전용 tag와 exact checkout만 제거한다. tag가 유일하면 Docker가 해당 전용 image ID/layer도 함께 제거할 수 있으므로 실제 결과를 기록한다. 전용 path/tag/container 잔류0 및 기존 두 서비스 ID/status 불변을 기록한다. 성공해도 서명 manifest·실제 collector·PG15/PG18/OIDC/object store/network/browser/rollback PASS로 승격하지 않는다.

## R19 현재 SHA 세 역할 image 실측·정리

- 판정: `R19_THREE_ROLE_IMAGE_BUILD_PASS_BOUNDED`, 전체 F-18 인수 아님. WSL-server의 승인 SSH alias에서 `fac742eb99ff13d1d78af1bce761534cde52df6c`를 전용 clean detached checkout했고, 추적된 입력만 담은 archive context에서 `web`, `api`, `worker` target을 각각 `--pull=false`·1GiB/2CPU 제한으로 빌드했다. 세 명령 모두 exit0이며 Docker legacy builder 경고만 있었다.
- 실제 image ID는 Web `sha256:fbcddd54cd5831a51b97303dbecab65596372ebcea7dd6483cc4418fb1858c54`, API `sha256:dc1ba152ef78570259261f3f6e30f3c4576f1e03790e5c32ccb266337d1b0e04`, Worker `sha256:81c67b2051e6081f9b2fb6b74b1ec05dc2a41a18e922a41c0a8dc56e5a834a7e`로 서로 달랐다. 세 OCI revision은 모두 exact Git SHA, linux/amd64였다. Web은 UID 101과 Nginx, API/Worker는 UID 10001과 각 명시적 entrypoint였다. 이미지 실행·내부 source 검사, DB·브라우저 검증은 이 단위에서 하지 않았다.
- 정리 전 전용 checkout realpath/owner `daon:daon`/0700/비-symlink/clean HEAD와 세 tag의 revision을 재확인했다. 전용 tag 제거 시 유일 tag였으므로 Docker가 세 image ID와 전용 layer를 실제 삭제했다. 전용 checkout path/tag/container 잔류0, 기존 `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` Up 및 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` Up/healthy 불변. 삭제된 합성 QA 이미지 자체는 복구 불필요하며 source는 공개 Git SHA로 재빌드 가능하다.
- 본 증거는 `fac742eb`의 역할별 이미지 생성 가능성과 당시 ID 관측만 입증한다. 정리된 ID를 현재 배포 가능한 artifact나 실제 서명 ReleaseManifest로 취급하지 않는다. 현재 SHA의 signed manifest/collector, PG15·PG18 E2E, 실제 OIDC/API·object store·network, same-origin browser, backup/rollback 및 운영 유사 rehearsal은 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 재사용 가능한 실제 artifact와 서명 manifest/collector의 신뢰 결박을 같은 commit 기준으로 준비한다.

# F-18 R18 분리 Worker digest writer lease 회수 / 2026-09-26

- 판정: `R18_WRITER_LEASE_REVOKED_PENDING_PUSH`. 제품 exact4 commit `3586c8400172a8357d9c239e59a65550c0596d68`의 로컬 focused 143 PASS, 독립 review Critical/Important 0, WSL-server 동일 제품 SHA 순수 preflight 143 PASS·전용 자원 잔류0 후 canonical seq1572 `WRITE_LEASE_REVOKED` → seq1573 `WORKER_LEASE_REVOKED`를 materialize했다. active agent=Main, 두 lease=None, 제품 write scope=[]이다. F-18은 여전히 IN_PROGRESS_WSL_OPS/accepted=false, F-19 차단, Production NOT_EXECUTED다.
- close 통제 QA `7aff259eee8a4fe5923b5516c34112a2f2332b8b` 게시, close 거부 테스트 2 PASS(exit0), checker net 3줄 확인. 다음은 seq1573 progress/HANDOFF·manifest checksum·detached digest를 검증해 evidence commit/push하고 G-05 재실행이다. 실제 현재 SHA 세 image·signed ReleaseManifest/collector·OIDC/object store/network/PG18·브라우저/rollback/운영 유사 rehearsal은 아직 미검증이며 신규 branch나 `ysna-server` 작업 없음.

# F-18 R18 동일 SHA WSL-server 순수 preflight QA·정리 / 2026-09-26

- 판정: `R18_DISTINCT_DIGEST_CONTRACT_LOCAL_WSL_PASS_BOUNDED`, 전체 F-18 acceptance 아님. 담당 Main. 제품 exact4 commit `3586c8400172a8357d9c239e59a65550c0596d68`를 원격 기존 branch에 게시했고, G-05 seq1571 PASS·독립 read-only review Critical/Important 0(Minor: 새 signed capability fixture는 별도 Git checkout gate를 직접 증명하지 않음)을 확인했다.
- WSL-server 전용 `/home/daon/anvil-f18-r18-qa/repo`의 clean detached HEAD를 제품 SHA로 대조했다. `uv sync --locked --group dev --no-install-project` exit0, `.venv/bin/python -m pytest -q -p no:cacheprovider --basetemp=<전용 .pytest-temp>`로 F-16 ReleaseManifest/staging, F-17 validation, F-18 promotion/WSL operational/deploy approval/role images의 8개 파일 **143 PASS**(exit0, 2.86초). 이는 WSL 실제 순수 preflight 코드/테스트 실행이지 signed collector·현재 SHA 세 image/DB/OIDC/object storage/network/PG18 제품 실측이 아니다.
- 정리 전 전용 경로 realpath/daon/0700/비-symlink, clean HEAD와 하위 repo·.venv(내부)·.uv-cache·pytest temp·두 로그만 확인했다. 정확한 전용 path만 제거해 path/tag/container 잔류0. 기존 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running, `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변. 정식 Developer 실패0; 로컬 전체 pytest는 기존 수집 오류 13건으로 미통과. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지. 다음은 R18 lease 회수 뒤 실제 세 image 현재 SHA·서명 manifest/collector와 나머지 capability 검증이다.

# F-18 R18 동일 SHA WSL-server 순수 preflight QA 자원 계획 / 2026-09-26

- 판정: `R18_PRODUCT_POSTED_WSL_QA_PENDING`. 담당 Main, 단일 branch `codex/f18-wsl-ops`의 게시 제품 SHA `3586c8400172a8357d9c239e59a65550c0596d68`, checkout clean/G-05 seq1571 PASS. 제품 exact4 로컬 RED→GREEN, focused 143 PASS, 전체 pytest 기존 수집 오류 13건/exit1. 독립 read-only review와 실제 WSL 테스트를 분리한다.
- WSL-server 새 전용 `/home/daon/anvil-f18-r18-qa`만 만든다. 생성 전 경로 부재·home 소유·비-symlink를 재확인하고 승인 SSH alias로 위 SHA의 clean detached checkout을 받는다. 그 하위 `.venv`·`.uv-cache`·`.pytest-temp`만 쓰며 `uv sync --locked --group dev --no-install-project` 후 순수 F-16/F-17/F-18 preflight focused pytest를 실행한다. Docker/DB/network/port/Secret/기존 `/srv/anvil-wsl/repo` 및 공유 서비스는 생성·변경하지 않는다.
- 검증 후 exact path·owner/0700·비-symlink·clean HEAD와 생성물 범위를 확인해 전용 path만 제거한다. 기존 `anvil-web`·`local-postgres` ID/running 불변, 전용 path 잔류0을 확인한다. 이 pytest는 세 실제 image ID·signed ReleaseManifest/collector·OIDC/object store/network/PG18·브라우저/rollback의 현재 SHA 실측이 아니므로 F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 유지한다.

# F-18 R18 분리 Worker digest writer 준비 / 2026-09-26

- 판정: `R18_CONTROL_QA_POSTED_LEASE_PENDING`. 담당 Main. 기존 branch `codex/f18-wsl-ops` clean/게시 기준 `3f664fb8d9c474a98e739dd5de0545c2b5edd045`, canonical seq1568 worker/write lease=None·G-05 PASS. R17 세 역할 image 실측과 preflight의 API=Worker digest 강제 충돌을 승인된 F-18 단계1 내부 정합 단위로 분리했다. 새 branch/운영 서버/Production 범위 없음.
- R18 exact4 제품 scope는 `packages/deployment/promotion_preflight.py`, `tests/deploy/test_f18_promotion_preflight.py`, `tests/deploy/test_f18_wsl_operational.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. legacy `runtime_image_digest`는 API에만 결박하고 Worker는 signed manifest와 실제 `image_digests` map의 독립 대조를 유지한다. 기존 reject reason/approval·checkout·capability gate를 유지한다.
- 계획·WorkInstruction·invocation, R18 overlay·거부 테스트·checker 3줄 분기를 control-only QA `fa8a9ea1d754203adddb0fc034282ed34d3518bc`로 게시했다. R18 통제 테스트 3 PASS(exit0), compileall·diff-check exit0, checker net diff 3줄 확인. seq1569 instruction→1570 worker lease→1571 write lease의 새 epoch12 exact4 발급·G-05 후 단일 Developer가 RED→GREEN을 수행한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 다음 내부 작업: 세 역할 digest preflight 계약 불일치 / 2026-09-26

- 판정: `F18_THREE_DISTINCT_IMAGES_PREFLIGHT_GAP`, 제품 변경 전 read-only 확인. `packages/deployment/promotion_preflight.py`의 `validate_promotion`은 signed manifest의 `web/api/worker` 세 digest와 관측 map을 비교하면서도 legacy `runtime_image_digest`가 API와 **Worker 모두** 같아야 한다고 요구한다. R17 WSL-server에서 실제 세 역할 image ID가 서로 다른 것을 확인했으므로, 현 계약으로는 정직한 세 image 증거가 `DEPLOY_ARTIFACT_MISMATCH`로 거부된다. 기존 테스트 fixture도 API=Worker digest를 가정한다.
- 다음 안전 조치: 같은 branch에서 별도 exact-file WorkInstruction·새 worker/write fencing epoch을 발급한 뒤 단일 Developer가 RED→GREEN으로 legacy runtime digest는 API에만 결박하고 Worker는 signed manifest와 관측 `image_digests["worker"]`로 독립 대조하도록 최소 수정한다. mismatch·누락·위조 거부 및 기존 동일 digest 호환성을 유지하고, 제품 commit/독립 review/로컬·WSL 확인 후 lease를 회수한다. 이 단계만으로 서명 ReleaseManifest·actual collector·PG18/OIDC/운영 유사 rehearsal PASS를 선언하지 않는다.

# F-18 R17 세 역할 image writer lease 회수 / 2026-09-26

- 판정: `R17_WRITER_LEASE_REVOKED_PENDING_PUSH`. 제품 exact4 commit `57653ee835d47c810a1f90d48d9fbe332fb3540c`의 로컬 104 PASS/Web build·WSL-server 세 image build/inspect·일회성 HTTP/import·전용 자원 잔류0을 확인한 뒤 canonical seq1567 `WRITE_LEASE_REVOKED` → seq1568 `WORKER_LEASE_REVOKED`를 materialize했다. active agent는 Main, 두 lease=None, 제품 write scope=[]이다. F-18은 여전히 `IN_PROGRESS_WSL_OPS`/accepted=false, F-19 차단, Production NOT_EXECUTED다.
- 통제 QA는 `2fe4b4ac9f2bcc52b9b42d3f671e0b43f79f96b2`로 게시됐고 close 전용 거부 테스트 2 PASS(exit0), overlay compile·diff-check exit0이다. 대형 progress checker에 3줄 분기를 적용할 때 patch 도구가 무관한 과거 코드 약 1,500줄을 잘못 삭제한 오류를 commit 직후 diff에서 발견했다. 원격 push 전 `559cf9a`의 원본 checker와 비교해 순수 3줄만 남도록 복원했고 후속 `2fe4b4a` commit에 복구를 기록했다. 이 두 local commit은 함께 게시되어 원격 최종 checker의 net diff는 3줄이며 제품 파일·과거 이벤트는 변하지 않았다. 해당 도구/복구 오류는 정식 Developer 실패로 계상하지 않는다.
- 다음은 seq1568 progress/HANDOFF·manifest checksum·detached digest를 검증해 evidence commit/push하고 G-05를 재실행하는 것이다. WSL 실제 제품 DB/OIDC/object-store/network/PG18/브라우저/rollback/운영 인수는 미검증이며 새 branch나 `ysna-server` 작업은 하지 않는다.

# F-18 R17 WSL-server 세 image 실측·정리 / 2026-09-26

- 판정: `R17_THREE_ROLE_IMAGE_QA_PASS_BOUNDED`, 전체 F-18 acceptance 아님. 담당 Main, 기존 `codex/f18-wsl-ops`의 게시 제품 SHA `57653ee835d47c810a1f90d48d9fbe332fb3540c`; 로컬 G-05 seq1566 PASS. 독립 review의 `ENTRYPOINT`가 base `CMD`를 상속한다는 Important 지적은 Dockerfile 공식 규칙과 실측 `.Config.Cmd=None`으로 반증되어 제품 변경 없이 기각했다. 검토 중 만든 미커밋 테스트만 Developer가 제거해 checkout clean, 정식 실패 0회.
- WSL-server 사용자 소유 전용 `/home/daon/anvil-f18-r17-qa`에서 승인 SSH alias로 clean detached 제품 SHA를 받았다. Docker legacy builder에는 repository root를 전달하지 않고 `git archive`로 선정한 추적 파일 417개/3,174,400 bytes의 tar context만 사용했다. tar 목록에서 `.git`·`.env*`·Secret·cache·임시 산출물 없음 확인. `DOCKER_BUILDKIT=0 docker build --pull=false --force-rm --cpu-period 100000 --cpu-quota 150000 --memory 3g --target web|api|worker --build-arg ANVIL_RELEASE_COMMIT=<제품 SHA> -f deploy/wsl/Dockerfile.f18 -t anvil-f18-r17-<role>:57653ee - < context.tar` 세 명령 각각 exit0.
- 최종 image ID Web `sha256:9e31583d2877674aa9507885afae115f82ddcd1667bdebb2d25be3b4dcb0fcea`, API `sha256:a7b4d9150ce6abebdf50c6d4ae11cb69f2f5d444de4b8aff9a2f7e23fa7bae1d`, Worker `sha256:2c2fe9a9b1eedbdaee9c9f6c66eddb774c3b55ec15911167a1d0ddd2b6de4f96`로 서로 다르다. 셋 모두 OCI revision=제품 SHA, `linux/amd64`, non-root(101:101 / 10001:10001 / 10001:10001), 역할별 실제 Entrypoint, `Cmd=None`을 inspect로 확인했다.
- 일회성 `--network none` 컨테이너에서 Web bundle·`/api/`·`/auth/` Nginx proxy·역할별 source 제외, `nginx -t`, 기본 Web HTTP 200을 확인했다. API 이미지에는 Worker/Web source가 없고 migration이 있으며, synthetic 비운영 환경변수에서 ASGI import 103 routes와 기본 API `/health/live` HTTP 200을 확인했다. 환경변수 없는 API import는 `ANVIL_DATABASE_URL` 누락, 합성값 보충 전에는 `TELEGRAM_ALLOWED_IDENTITIES` 누락으로 exit1인 설정 실패였고, 실제 DB 연결은 시도하지 않았다. Worker 이미지에는 API/Web source가 없고 module import PASS, DB 미설정 기본 `--check`는 exit1/`configuration_unavailable`로 fail-closed였다. 실제 DB ready·OIDC·network policy·브라우저·rollback은 미검증이다.
- 정리: 각 tag가 예상 ID·revision·단일 RepoTag인지 확인해 세 tag만 `docker image rm`, 전용 path realpath/daon 소유/0700/비-symlink·Git clean을 확인해 해당 path만 제거했다. 전용 path/tag/container 잔류0. 공유 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running, `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변. Legacy Docker의 공용 무태그 build cache는 이번 전용 자원으로 구분 불가하여 broad prune하지 않았다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED 유지; 다음은 R17 worker/write lease 회수와 후속 승인 계획 범위의 capability 검증이다.

# F-18 R17 WSL-server 세 image 실측 자원 계획 / 2026-09-26

- 판정: `R17_PRODUCT_POSTED_QA_PENDING`. 담당 Main, 단일 branch `codex/f18-wsl-ops`의 게시 exact 제품 commit `57653ee835d47c810a1f90d48d9fbe332fb3540c`, clean/G-05 seq1566 PASS. 로컬 exact4 구현·104 focused PASS·Web typecheck/build exit0이며 전체 pytest는 기존 수집 13 ERROR/exit1, 실제 image는 아직 미검증이다. 독립 read-only 검토와 WSL 실측을 분리한다.
- WSL-server 전용 자원은 새 `/home/daon/anvil-f18-r17-qa` checkout 및 그 안의 제한 Git archive build context뿐이다. 생성 전 정확한 경로 부재·`/home/daon` 소유권·비-symlink를 확인하고, 승인 SSH alias에서 위 SHA만 받아 clean detached checkout한다. 기존 root 소유 `/srv/anvil-wsl/repo`, 실행 중인 `anvil-web`·PostgreSQL 및 다른 서비스는 수정하지 않는다.
- 세 image tag는 `anvil-f18-r17-web:57653ee`, `anvil-f18-r17-api:57653ee`, `anvil-f18-r17-worker:57653ee`로 한정한다. legacy Docker는 Dockerfile별 ignore를 보장하지 않으므로 repository root를 빌드 context로 넘기지 않는다. 필요한 tracked 경로만 Git archive에 넣고 tar 목록에서 `.git`·`.env*`·Secret·cache·임시 산출물 부재를 확인한 뒤 순차 `--pull=false`/제한 CPU·memory로 빌드한다. image ID·OCI revision·OS/arch·역할 source/entrypoint와 Web 정적/HTTP, API import, Worker `--check` 경계를 검사한다. 별도 DB/Secret/network/port/운영 배포는 생성하지 않는다.
- 검증 후 생성된 tag/ID와 전용 checkout을 exact path·label·소유자·비-symlink로 확인해 해당 자원만 제거하고 잔류0 및 기존 서비스 ID 불변을 확인한다. 검사 실패 시 합격 처리하지 않고 재현 가능한 Git SHA·오류를 기록한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 유지한다.

# F-18 R17 세 역할 image 제품 writer lease 발행 / 2026-09-26

- 판정: `F18_R17_CONTROL_LEASE_ISSUED_PENDING_PUSH`, 제품 write·image build·WSL runtime 실측 전. 담당 Main. 시작 기존 branch `codex/f18-wsl-ops` clean/원격 동일 `4c5b40db2a49e34dc6279012d5f86901991e400d`, canonical seq1563 worker/write lease=None, G-05 PASS. 기존 계획 F-18 단계1의 Web/API/Worker image 세 digest 결박을 내부 구현 단위로 분리한다. 새 branch·`ysna-server`·Production은 제외한다.
- R17 exact 제품 scope는 `deploy/wsl/Dockerfile.f18`, `deploy/wsl/Dockerfile.f18.dockerignore`, `tests/deploy/test_f18_role_images.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md` 네 파일이다. 기존 `deploy/local/Dockerfile.runtime`의 Web build/Python runtime을 WSL 전용 명시적 `web`/`api`/`worker` target으로 나누되, 기존 F-16/F-17 Dockerfile·Compose·API/권한·DB/Secret은 바꾸지 않는다. 로컬 TDD 뒤 WSL-server exact SHA로 실제 세 image ID·OCI revision을 관측하며 전체 F-18 PASS로 승격하지 않는다.
- R17 계획·WorkInstruction·invocation과 새 overlay·거부 테스트·checker dispatcher를 control-only QA commit `b59936123dc74f5d81126b20d70ad2ebb483ac65`로 게시했다. R17 통제 테스트 3 PASS(exit0), compileall·diff-check exit0, 전용 로컬 pytest temp 정리0. 그 commit에 결박된 seq1564 `WORK_INSTRUCTION_ISSUED` → 1565 `WORKER_LEASE_ISSUED` → 1566 `WRITE_LEASE_ISSUED`를 materialize했다. 새 epoch11 worker/write는 `2026-09-26T01:05:00+09:00` 발급·`13:05:00+09:00` 만료, exact4 scope이며 옛 token을 재사용하지 않는다. canonical 검사는 원격보다 앞선 control evidence commit 전이라 Git 일치만 미충족; 게시·G-05 후 단일 developer-primary에게 exact4만 배정한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 현재 SHA 배포 preflight WSL 단위 QA 결과·정리 / 2026-09-26

- 판정: `F18_CURRENT_SHA_PREFLIGHT_LOCAL_WSL_UNIT_PASS`, F-18 전체 capability/정식 Test/Staging 인수 아님. 담당 Main, 제품 변경0·정식 Developer 실패0. 게시된 기존 branch의 clean detached Git SHA `27ebcaacc5d44b10443ca4cf3dcbc757d34685fe`를 WSL-server 전용 `/srv/anvil-wsl/f18-gate-qa-20260926/repo`에서 확인했다. Python3.12.3 `uv sync --locked --group dev --no-install-project` 47 resolved/43 installed(exit0), `tests/deploy/test_f18_wsl_operational.py`, `test_f18_wsl_dependencies.py`, `test_f18_deploy_approval.py`, `test_f18_promotion_preflight.py`, `test_f17_validation.py` **90 PASS**(exit0, 1.64초). 로컬 동일 5개 파일은 전용 basetemp에서 90 PASS(exit0, 21.39초).
- 준비·정리 오류: 첫 전용 경로 생성은 root 소유 parent 아래 일반 사용자 `install -d` 권한 거부(exit1)로 경로 미생성; 정확한 부재와 기존 비대화식 sudo를 확인한 뒤 `daon:daon`/0700 전용 경로만 생성했다. 초기 Docker inventory는 DB에 없는 Health 필드 조회가 실패해 읽기 전용 재조회로 해소했다. 정리 검증은 pytest 미추적 `.pytest-temp/`를 빈 status로 오인해 2회 중단했으나, tracked diff0·미추적 모두 해당 prefix·venv/cache만 있음을 확인했다. 일반 사용자 `rm -r`은 내용 제거 후 root 소유 parent의 디렉터리 entry 삭제에서 권한 거부(exit1); 빈 exact 경로·realpath·비-symlink·owner0700·자식0을 확인하고 `sudo -n rmdir`로 제거했다.
- 종료 검증: 전용 path/checkout/venv/cache/pytest temp 잔류0, QA Docker/DB/network/port/Secret 생성0. 기존 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy, `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변. 삭제된 전용 pytest/Git/venv/cache는 게시 SHA와 lockfile로 재생성 가능하다.
- 한계·다음: 이는 현재 commit의 배포 preflight **단위 계약**만 재현했다. 동일 Web/API/Worker 세 image digest·서명 manifest/실제 collector, OIDC 제품 API/권한, object store 제품 연결, network policy·browser·정식 WSL/운영 유사 rehearsal·rollback은 미검증. 같은 branch에서 F-18 계획의 세 이미지·실제 capability 연결을 다음 exact-file 제품 단위로 진행한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED, `ysna-server` 작업 없음.

# F-18 현재 SHA 배포 preflight WSL 단위 QA 자원 계획 / 2026-09-26

- 담당 Main, 동일 `codex/f18-wsl-ops` branch. 시작 clean·원격 동일 HEAD `72642964c1126fd6ef6ed31ecccc95ba4b9543e9`, G-05 seq1563 PASS, worker/write lease=None. 현재 SHA의 F-17/F-18 배포 preflight 5개 파일을 WSL-server 잠긴 Python 환경에서 실행해 로컬/WSL 단위 계약 차이만 확인한다. 실제 image·API·OIDC·network policy·DB·배포·browser PASS는 아니다.
- 로컬 최초 실행은 Windows 기본 pytest 임시 경로 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` 접근 거부로 79 PASS/11 setup ERROR(exit1). 기본 `TEMP`는 존재하지만 pytest의 해당 하위 디렉터리 열거가 거부됐다. 전용 `--basetemp=.f18-r17-pytest-temp`에서 문제 파일 단독 27 PASS(exit0), 5개 파일 합계 90 PASS(exit0, 21.39초). 전용 temp의 resolved exact worktree 내부·비-reparse를 확인해 제거, 잔류0. 제품 실패/정식 Developer 실패로 계상하지 않는다.
- WSL 생성 대상은 신규 exact `/srv/anvil-wsl/f18-gate-qa-20260926` 하나뿐이다. 생성 직전 부재·realpath/owner·기존 서비스 상태를 재확인한다. 승인 SSH Git alias의 게시 HEAD를 그 경로의 `repo`에 clean detached checkout하고, 그 하위에만 `.venv`, `.uv-cache`, pytest temp를 둔다. Docker/DB/network/port/Secret/기존 checkout은 생성·변경하지 않는다. 작업 후 exact 경로·비-symlink·owner0700·HEAD/tracked clean·ignored 생성물만 확인하고 해당 QA 경로만 제거해 잔류0 및 기존 서비스 불변을 확인한다.
- WSL 실제 결과 전 F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 유지한다. Web/API/Worker 세 image digest, 실제 OIDC API, object store 제품 연결, network policy, 정식 Test/Staging·운영 유사 rehearsal은 이 단위 QA의 판정 밖이다.

# F-18 OIDC 런타임 연결 경계 재확인 / 2026-09-26

- 판정: `OIDC_API_RUNTIME_NOT_INTEGRATED`, F-18 단계3 인증 합격 아님. 담당 Main, 제품 변경0·정식 Developer 실패0. 동일 작업 branch `codex/f18-wsl-ops`의 게시 HEAD `756cf37`에서 `tests/api/test_oidc_identity.py`, `test_oidc_code_flow.py`, `test_oidc_issuer_transport.py`, `test_local_session.py` 로컬 회귀 138 PASS(exit0, 9.87초), warning 1(`python_multipart` PendingDeprecation). `git diff --check` exit0, 작업 checkout clean.
- 근거: `packages/api/runtime.py`는 `ANVIL_AUTH_MODE`를 COOKIE 또는 WSL_ACCEPTANCE로만 받으며 `LocalTestSessionService`를 `authenticate`/`session_issuer`로 연결한다. OIDC verifier/code-flow/issuer transport를 `create_runtime_app` 또는 `create_app`에서 연결하는 경로와 실제 API 로그인·callback·권한 매핑은 없다. 이전 WSL 격리 Keycloak/PKCE/step-up PASS와 이번 138 PASS는 제품 API OIDC 인증 PASS가 아니다.
- 다음: 승인된 F-18 단계3 범위에서 기존 세션·API·권한 계약과 설계서의 인증 경계를 대조해 OIDC runtime exact-file 작업지시·canonical worker/write lease를 확정한 뒤 단일 writer가 TDD로 연결한다. 인증·권한 계약을 임의 확대하지 않는다. 같은 branch 유지, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED; WSL-server 외 서버 작업 없음.

# F-18 R16 현재 SHA object-store 격리 실측·정리 / 2026-09-26

- 판정: `F18_R16_OBJECT_STORE_BOUNDED_PASS`, F-18 단계3 전체/정식 WSL 인수 아님. 담당 Main, 제품 변경0·정식 Developer 실패0. 승인 Git alias의 clean detached exact SHA `373e73b17ceab9d010f2afe5bf528692a1210733`에서 로컬 artifact 두 파일 21 PASS(exit0), WSL locked Python3.12 환경 같은 두 파일 21 PASS(exit0). 실제 MinIO image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`, 전용 container ID `75fef529510d9a51c39e4677ef4a5bf68253b8dfbbb4efdf98d7354e6136da96`, label `F18_R16_OBJECT_QA`, loopback `127.0.0.1:19016` health200.
- `S3ArtifactStore`를 합성 bucket/prefix와 실제 boto3/MinIO에 연결해 content hash·conditional put/read, 동일 bytes dedupe, 상이 bytes collision, 저장 bytes 손상 read 거부, 잘못된 credential 쓰기 거부 및 예외 원인/credential 비노출을 실행했다. 출력 `MINIO_R16_REAL_PUT_READ_DEDUPE_COLLISION_CORRUPTION_DENIAL_PASS`, exit0, target-bound 요약 evidence `sha256:38cdca9ac89e163911f51e674f92fc378a56808b93c3a6e44cd9bfd61407bc26`. 합성 credential 원문은 Git·로그·보고서에 기록하지 않았다.
- 정리 전 exact checkout realpath/비-symlink/`daon:daon`/0700/HEAD/tracked clean, credential mode0600, container ID·label·image·QA data bind·loopback 포트를 확인했다. 정확한 전용 container와 `/srv/anvil-wsl/f18-object-r16-qa`의 checkout/venv/cache/data/credential/log를 제거해 path/container/port 잔류0. 기존 `local-postgres` Up·`anvil-web` healthy 불변, 공용 image/cache/network/DB 보존. 삭제된 합성 object/credential은 복구하지 않으며 source는 게시 Git SHA로 복구 가능하다.
- 한계: 실제 저장소 adapter 경계만 PASS다. 제품 API·Worker가 이 adapter를 사용한다는 증거, 동일 Web/API/Worker image target 결박, OIDC issuer·role/scope·step-up, network policy, browser/운영 유사 rehearsal, 정식 Test/Staging·Production은 미검증. `packages/api/oidc_identity.py`·`oidc_code_flow.py`·`oidc_issuer_transport.py`는 존재하지만 현재 `packages/api/runtime.py`에는 해당 code flow/issuer의 실제 연결이 없다. 다음은 같은 branch에서 exact-file WorkInstruction·canonical lease를 발급한 단일 writer의 OIDC runtime 연결과 실측 준비이며, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 R16 현재 SHA object-store 실측 자원 계획 / 2026-09-26

- 담당 Main, 같은 `codex/f18-wsl-ops` branch clean·`development` 동일 HEAD `373e73b17ceab9d010f2afe5bf528692a1210733`, G-05 seq1563 PASS, worker/write lease=None. F-18 단계3의 `S3ArtifactStore` 실제 S3-compatible 저장소 경계만 현재 SHA에서 재실측한다. R6의 다른 SHA MinIO PASS를 현재 artifact/전체 F-18 PASS로 재사용하지 않는다. 로컬 `tests/artifacts/test_s3_artifact_store.py`+`test_artifact_store.py` 21 PASS(exit0); 전용 pytest temp는 생성되지 않았다.
- 생성 전 WSL-server 읽기 전용 inventory: 전용 `/srv/anvil-wsl/f18-object-r16-qa`와 container `anvil-f18-r16-minio-qa` 부재, loopback port19016 free, cached `minio/minio:RELEASE.2025-09-07T16-13-09Z` image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`. 기존 `local-postgres` Up·`anvil-web` healthy. 승인 Git alias의 위 exact SHA를 mode0700 전용 경로 `repo`에 clean detached checkout한다. checkout 아래 `.venv`·pytest temp와 QA data/uv-cache만 만든다. 합성 access/secret key는 QA 경로의 mode0600 `qa.env`에만 둔다.
- 위 image ID의 전용 MinIO container 하나만 label `com.anvil.cleanup-scope=F18_R16_OBJECT_QA`, uid/gid1000, cap-drop ALL/no-new-privileges, `127.0.0.1:19016→9000`, 전용 data bind로 실행한다. 합성 bucket/prefix에서 실제 boto3 조건부 put/read, 동일 bytes dedupe, 상이 bytes 충돌, 손상 read, 잘못된 credential 거부와 오류 redaction을 확인한다. QA는 제품 API 연결/동일 image digest·OIDC/network policy/운영 유사 rehearsal/Production PASS가 아니다.
- 수명은 이번 QA 동안뿐이다. 성공·실패 모두 checkout realpath/비-symlink/owner0700/정확한 HEAD·tracked clean, data/env/venv만 untracked, container ID/label/image/host bind를 검증한 후 정확한 container와 전용 QA path/합성 credential·data를 제거한다. path/container/port 잔류0과 기존 두 서비스 불변을 확인하고 결과·오류·미검증을 기록한다. 공용 image/cache/network·기존 서비스/DB는 보존한다.

# F-18 R15/R15b 동일 artifact PG15·PG18 핵심 HTTP·DB E2E 실측·정리 / 2026-09-25

- 판정: `F18_R15_DUAL_PG_HTTP_DB_BOUNDED_PASS`, F-18 전체 인수·정식 WSL 통합 인수 아님. Main 소유, 제품 변경0·정식 Developer 실패0. 승인 alias의 동일 clean detached Git SHA `d66bcafb3a36828a8a83f22f88385530be167157`와 **동일 실행 Web image** `sha256:42c4fa2c65d6d4d7ea707b68e19daafabf99300c8740e1ba00e7349182ec015f`, **동일 API/Worker runtime image** `sha256:ad87e2fc2f86c837a856406a560829ae9d152fdefd6ed4f6a36440cc10dce432`를 PG15→PG18 순차로 유지했다. 둘 다 OCI revision=위 Git SHA. 이전 R14 PG18의 다른 image ID 증거는 동일 artifact 비교에서 제외한다.
- PG15 `local-postgres` image `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e` 안의 **새** DB `anvil_f17_pg15_f18r15`·전용 migrator/app role만 사용했다. pgvector0.8.2/migration0016/vector distance1, app DB/schema CREATE=false. HTTPS readiness200, 합성 Task→Run HTTP·DB 일치 `1 passed`/warning1(exit0), evidence `sha256:e1fd36bae2a5cc050568970ca63c4c15e796358a6f30fee3ee80e4934d73fd56`; API 재시작 후 SSE event ID=DB `1 passed`/warning1(exit0), evidence `sha256:91ca64c1be2acd66d248187489b613d6d1d9a5d92f7641ccb36201a223a9c31c`. run `97d4d284-3cde-42b6-97fa-2b33034d65dc`.
- PG18 cached base image `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, 별도 tmpfs DB/host loopback32769, Docker Mounts=[]·named volume0. 같은 Git/Web/runtime image에서 migration0016/pgvector0.8.2/vector distance1·최소 app role, HTTPS readiness200, 합성 Task→Run HTTP·DB 일치 `1 passed`/warning1(exit0), evidence `sha256:fc49abd12d0f74e6fee83f3436cb9d3e1cb152b381a06994b1955e7571d7fb7c`; API 재시작 후 SSE=DB `1 passed`/warning1(exit0), evidence `sha256:3cd5102fa1aad1bc14dc235475e2a32d6f6c39bff4304cc75d163d251faedd66`. run `f3ebd3b9-ba8d-4bbb-9a4a-08d2aa5a348f`. 양쪽 warning은 HTTPX 문자열 CA 경로 deprecation이며 실패가 아니다.
- 준비 진단 오류: 최초 QA DB 생성 shell의 인용 구문 1회 실패(그 시점 DB/role 미생성), PG18 `Mounts=[]` 확인 shell 비교식 1회 실패(DB는 이미 정상 기동); 정확한 read-only 재조회 후 진행했다. R14와 R15 동일 source 재빌드 image ID 차이를 감지해 R14를 비교에서 제외하고 R15 image 객체를 양 DB에 그대로 사용했다. 임시 credential 원문은 Git·보고서에 남기지 않았다.
- 정리: PG15 API/Web/Worker/TLS container·network3 종료 후 전용 DB 연결0·정확한 DB/두 role identity를 확인해 그 DB/role만 제거했다. PG18 container5/network2·tmpfs, 동일 image tag2, exact QA checkout `/srv/anvil-wsl/f18-pg15-api-r15-qa`/venv/합성 credential/1일 CA·로그를 ID·label·realpath/비-symlink/owner0700/clean HEAD로 확인 후 제거했다. R15/R15b path/container/network/tag/QA DB·role/volume/listener32769·8315·8316·8443 잔류0. 기존 `local-postgres` 동일 container ID Up, `anvil-web` healthy; 공용 builder cache와 기존 데이터·설정은 보존했다. 삭제된 합성 DB·credential/로그는 복구하지 않으며 source는 게시 Git SHA에서 복구 가능하다.
- 제한: 두 엔진의 **한 합성 핵심 HTTP+DB 경로**만 동일 artifact에서 실측했다. PG15의 기존 host `0.0.0.0`/`::` DB bind는 사전 존재한 노출 위험으로 이번 QA가 수정·확대하지 않았고 network policy PASS가 아니다. 정식 WSL Test/Staging entity·반복 가능한 seed/reset, 실제 브라우저 Network, OIDC/step-up, object store의 동일 target 결박, rollback/운영 유사 rehearsal, 서명 ReleaseManifest·capability/3-role digest 승격은 미검증. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 같은 branch에서 Stage3·4 실제 capability 및 정식 WSL 증거를 진행한다. 새 branch/main 병합/운영 서버 접근 없음.

# F-18 R15b 동일 image PG18 비교 검증 추가 계획 / 2026-09-25

- 담당 Main. R15에서 exact source SHA `d66bcafb3a36828a8a83f22f88385530be167157`를 재빌드한 runtime ID `sha256:ad87e2fc2f86c837a856406a560829ae9d152fdefd6ed4f6a36440cc10dce432`, Web ID `sha256:42c4fa2c65d6d4d7ea707b68e19daafabf99300c8740e1ba00e7349182ec015f`는 R14의 동일 SHA image ID와 달랐다. 따라서 R14 PG18과 R15 PG15를 같은 image 검증으로 합치지 않는다. R15 두 image tag를 제거하지 않고 보존해 **바로 그 image ID**로 PG18을 재검증한 뒤 최종 정리한다. 별도 product rebuild/새 branch 없이 기존 F-18 동일 artifact 요구를 충족하는 순서 보정이다.
- 먼저 R15 PG15의 전용 TLS/Web/API/Worker·network를 label/ID 확인 후 제거하고, 전용 `anvil_f17_pg15_f18r15` DB와 두 role만 연결0·identity 확인 후 제거한다. 기존 `local-postgres` 및 그 밖의 DB·role·network/volume은 보존한다. 이때 R15 image tag와 clean source checkout `/srv/anvil-wsl/f18-pg15-api-r15-qa/repo`만 R15b에서 재사용할 때까지 보존하며 이유·수명을 이 계획에 기록한다.
- R15b 생성 전 부재·포트 inventory를 다시 확인한다. 신규 전용 DB container `anvil-f18-r15b-pg18-qa`, API/Web/Worker/TLS 각 `anvil-f18-r15b-*-qa`, internal/ingress network `anvil-f18-r15b-internal-qa`/`anvil-f18-r15b-ingress-qa`, base PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`만 사용한다. 전용 PG18 DB `anvil_f17_qa`는 tmpfs·named volume0, host DB/Web/TLS loopback 32769/8316/8443이며 합성 credential/CA·로그는 위 QA path 안의 `pg18` 하위에 mode0700/0600으로 둔다. 기존 `local-postgres`에 다시 접속하지 않는다.
- 현재 동일 runtime/Web image ID의 OCI revision, PG18 migration0016/vector·최소 runtime role, HTTPS Task→Run HTTP+DB와 API 재시작 후 SSE=DB를 F-17 opt-in harness로 확인한다. R15 PG15과 Git SHA·두 image ID가 정확히 같을 때만 동일 artifact의 양 DB 엔진 bounded evidence로 결합한다. 이는 정식 WSL 통합/전체 F-18 acceptance, browser/OIDC/운영 서버 증거가 아니다. 성공·실패 모두 R15b exact container/network/PG18 tmpfs와 R15 image tags/source checkout/credential을 ID·label·realpath/HEAD 확인 후 제거해 잔류0과 기존 서비스 불변을 검증한다.

# F-18 R15 PG15 실측 중간 결과 / 2026-09-25

- R15 clean detached `d66bcaf...`의 전용 Web/runtime image ID는 위와 같다. 기존 `local-postgres`의 **새 QA DB·두 role만** 생성하고 extension vector0.8.2/migration0016·app role의 DB/schema CREATE=false를 확인했다. 실제 same-origin HTTPS readiness200, 합성 Task→Run HTTP·DB 일치 `1 passed`/warning1(exit0), task `959dfc3e-b5e0-4e39-b6db-1a8ad6d3698b`, run `97d4d284-3cde-42b6-97fa-2b33034d65dc`, evidence `sha256:e1fd36bae2a5cc050568970ca63c4c15e796358a6f30fee3ee80e4934d73fd56`. API 전용 container 재생성 뒤 readiness200과 SSE event ID=DB `1 passed`/warning1(exit0), evidence `sha256:91ca64c1be2acd66d248187489b613d6d1d9a5d92f7641ccb36201a223a9c31c`. HTTPX 문자열 CA 경로 deprecation warning은 기능 실패가 아니다. 정식 Developer 실패0, 제품 mutation0.
- 생성/검증 상태이지 아직 cleanup 완료가 아니다. PG15 QA DB·role/전용 container/network와 image/source checkout이 남아 있다. 아래 R15b 순서대로 exact 정리·PG18 동일 image 검증 후 최종 판정한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 R15 PG15 일반 통합 QA 자원 생성 전 계획 / 2026-09-25

- 담당 Main, 동일 branch `codex/f18-wsl-ops`; 현재 clean/원격 일치 `b1d2e29e479a06d0b8fd4f060e98817db686e767`, G-05 seq1563 PASS, worker/write lease=None. R14 PG18과 **동일 실제 source SHA** `d66bcafb3a36828a8a83f22f88385530be167157`를 승인 Git alias에서 WSL-server exact `/srv/anvil-wsl/f18-pg15-api-r15-qa/repo`에 clean detached checkout한다. R14 이후 doc-only commit 때문에 현 branch HEAD는 다르며, 빌드 image ID까지 같을 때만 동일 artifact로 결합한다.
- 생성 전 읽기 전용 inventory: 위 exact 경로, QA DB `anvil_f17_pg15_f18r15`, 역할 `anvil_f17_migrator_f18r15`/`anvil_f17_app_f18r15` 부재. 기존 `local-postgres` container ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c`/image ID `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e` Up, `anvil-web` healthy. host loopback 8301/8315/8443 free. 공용 PG15에는 해당 전용 DB·두 role 이외의 schema/data/설정 변경을 금지한다. 기존 DB port의 0.0.0.0/:: bind는 이미 존재하는 별도 노출 위험으로 기록하며 이 QA에서 변경·확대하지 않는다.
- 생성 대상: 전용 checkout/0700 QA 경로와 0600 합성 credential·1일 TLS cert, 기존 Dockerfile의 전용 `anvil-f18-r15-runtime-qa:d66bcaf`/`anvil-f18-r15-web-qa:d66bcaf` tag, `anvil-f18-r15-internal-qa`/`anvil-f18-r15-ingress-qa`/`anvil-f18-r15-db-egress-qa` network, API/Web/Worker/TLS 전용 container 각1. API/Worker만 DB egress network에서 Docker host gateway를 통해 기존 PG15의 **전용 DB**에 접속한다. Web/TLS만 host loopback `127.0.0.1:8315/8443`에 게시하고 API·Worker host port는 없다. 이미지·network·container label로 소유 범위를 고정하고 named volume을 만들지 않는다.
- `postgres`는 새 전용 DB·최소 권한 migrator/app role 생성과 삭제에만 사용한다. 전용 DB에만 pgvector와 현재 migration0016을 적용하고, `anvil_f17_app_f18r15`이 superuser/createdb/createrole·DB/schema CREATE 권한이 없는지 확인한다. 기존 F-17 opt-in harness의 PG15 고정 loopback5432/HTTPS8443 계약으로 현재 SHA의 Task→Run HTTP+DB 및 API 재시작 후 SSE=DB를 검증한다. 실제 실패는 기록하고 PASS로 승격하지 않는다. 이 격리 QA는 PMO 정식 WSL 통합 인수 또는 F-18 전체 합격이 아니다.
- 수명은 이번 검증 동안만. 성공·실패 모두 QA path realpath/비-symlink/owner/HEAD, DB·두 role의 정확한 identity, container/network/image ID·label과 접속자를 확인한다. API/Worker 종료 후 전용 DB→두 role만 삭제하고 전용 container/network/image tag/path·합성 credential·인증서·로그를 제거한다. DB/role/path/container/network/tag/listener 잔류0, 기존 DB·서비스 불변을 확인한다. 공용 builder cache·기존 DB/role/서비스/volume은 보존한다.

# F-18 R14 PG18 실제 HTTP·DB E2E 실측·정리 / 2026-09-25

- 판정: `F18_R14_PG18_HTTP_DB_E2E_BOUNDED_PASS`, F-18 전체 인수 아님. 담당 Main, 제품 변경0·정식 Developer 실패0. 승인 alias 게시 clean detached SHA `d66bcafb3a36828a8a83f22f88385530be167157`에서 기존 Dockerfile Web image `sha256:52654f9c41fccd65c9867611c2b01c09cd004794b0f942ba9e55d01e79305b2c`와 API/Worker 공통 runtime image `sha256:479f0295f72c9f6869204391fc142039e42bb0bee9e421a246ea006aacd93946`를 빌드했으며 OCI revision 둘 다 해당 SHA. DB base는 계획한 PG18 image ID다.
- 전용 PG18 `anvil_f17_qa`에 Alembic `0016_operations_recovery`, pgvector `0.8.2`; `anvil_app`은 login=true, superuser/createdb/createrole=false, DB/schema CREATE=false. 실제 HTTPS same-origin readiness200, 합성 session, Task create/read→Run create의 HTTP·DB row 일치를 F-17 opt-in harness 현재 SHA에서 `1 passed`(warning1, exit0)로 검증했다. task `010e6eec-fdaf-4e8e-bbc8-d56e5f52e142`, run `e73a48cb-939f-4465-a8c5-eeb1f9adc18d`, create evidence `sha256:ced5163b9df4fbf0deaa655b5ffaca6311c9e03c1de07dbe214c29983626bb13`. API를 해당 run 허용목록으로 재시작한 후 SSE event ID와 DB 행을 같은 harness `1 passed`(warning1, exit0)로 대조했고 events evidence `sha256:d7b6f876c320aa770ce727e8976d8cdcfdd85b6db811acc8ec5c389054a46cd1`. warning은 HTTPX 문자열 CA 경로 deprecation이며 기능 실패가 아니다.
- QA 준비 오류와 해결: 합성 env 생성의 값 자리 수 오기입 1회 → 재생성; Caddy 실행 권한·host 인증서 파일 소유권·IP TLS cert 선택 각 1회 → 전용 컨테이너 교체 및 명시적 1일 자기서명 SAN 인증서; 최초 Web 502는 합성 Telegram 허용 ID 형식 오류 → 전용 설정 보정; 첫 harness의 DB preflight 실패는 migration과 별도 pgvector extension 미생성 → 전용 DB에 생성; API 재시작 직후 readiness race 1회 → 실제 ready200 확인 후 재실행 PASS. 모두 전용 QA 설정/순서 오류로 제품 코드 mutation·정식 Developer 실패0. 첫 실패를 PASS로 표시하지 않는다.
- 정리 전 exact 경로 realpath/비-symlink/owner0700/clean HEAD, 전용 container5·network2·volume0, image revision 및 project/cleanup label을 확인했다. TLS와 Compose postgres/api/web/worker, 두 network, 두 image tag, checkout/venv/로그/합성 credential/인증서/DB tmpfs를 제거했다. path/container/network/tag/volume/listener(32769/8314/8443) 잔류0, 기존 `local-postgres` Up·`anvil-web` healthy 불변. 삭제된 합성 DB/인증서·로그는 복구하지 않으며 Git source는 게시 SHA로 복구 가능하다.
- 한계: PG18 현재 SHA의 한 합성 API·DB 시나리오만 PASS다. PG15 현재 revision, 브라우저 Network·OIDC/step-up·object store·network policy·전체 rollback/rehearsal·서명 3-image 승격은 미검증. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 같은 branch에서 PG15 격리 QA 또는 남은 F-18 로컬·WSL 검증을 계속한다. 새 branch/main 병합/운영 서버 작업 없음.

# F-18 R14 PG18 실제 HTTP·DB E2E 격리 QA 자원 계획 / 2026-09-25

- 담당 Main. 대상은 같은 `codex/f18-wsl-ops` branch의 승인 alias 게시 SHA이며 WSL-server만 사용한다. 현재 HEAD/원격 `279d01ebf51786a8c79a705d6ae189747541d6b8` clean, G-05 seq1563 PASS, worker/write lease=None. 기존 F-17 합성 opt-in HTTP+DB harness를 현재 revision에 실행한다. F-18 전체 인수·PG15·OIDC·브라우저·운영 서버 검증으로 승격하지 않는다.
- 생성 전 읽기 전용 확인: `/srv/anvil-wsl/f18-pg18-api-r14-qa`, 전용 `anvil-f18-r14-*` container/network/tag가 부재하고 loopback 포트 32769/8314/8443이 비어 있으며 `local-postgres` Up·`anvil-web` healthy. 생성 대상은 위 exact 경로의 clean detached Git checkout 및 mode0700 QA 산출물, 현재 SHA OCI revision의 기존 Dockerfile runtime/Web target 전용 image tag 각 하나, cached PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, 전용 internal/ingress network 둘, PG18/API/Web/TLS 전용 container 각 하나로 제한한다. PGDATA tmpfs, named volume0, DB/Web/TLS host bind는 각각 127.0.0.1:32769/8314/8443이다. F-17 Compose의 synthetic test-session 설정을 전용 project name으로 재사용하며 실제 계정·운영 Secret은 사용하지 않는다.
- migration은 격리 DB에 admin으로 0016까지 적용하고 최소 권한 `anvil_app` runtime role을 만든다. 실제 HTTPS same-origin readiness, 합성 session, Task→Run HTTP와 DB 행 일치, API restart 후 SSE event ID와 DB 일치를 확인한다. 인증서는 전용 Caddy internal CA를 QA 경로에만 보관해 검증 클라이언트에 지정한다. 어떤 실패도 PASS로 승격하지 않는다.
- 성공·실패 모두 exact path realpath/비-symlink/owner/HEAD와 container/image/network ID·label 및 loopback bind를 대조하고 이 QA의 container/network/image tag/path·합성 credential·DB tmpfs를 제거한다. 전용 잔류0 및 기존 서비스 불변을 확인하고 결과·오류 횟수·미검증 범위를 여기 기록한다. 공용 builder cache와 기존 DB·서비스는 보존한다.

# F-18 R13 PG18 격리 migration·backup 실측 / 2026-09-25

- 판정: `F18_R13_PG18_BOUNDED_QA_PASS`, F-18 전체 인수 아님. 담당 Main. 승인 SSH alias에 게시한 clean SHA `a81fdc70c80c029a72e3a7316e9f907f8fc7639c`를 WSL-server 전용 checkout에서 detached/clean으로 확인했다. 기존 runtime Dockerfile의 전용 image ID `sha256:42006154975182d12549a1e21d893033e08c2dca14c8a0fa7c83fd74b0721744`, OCI revision=게시 SHA, base PG18 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`를 확인했다. 빌드 exit0(`--pull=false`, 1GiB/2CPU).
- 실제 전용 DB는 PostgreSQL `server_version_num=180004`, pgvector `0.8.2`, Alembic head `0016_operations_recovery`. `SELECT '[1,2,3]'::vector(3) <-> '[1,2,4]'::vector(3)`=1. 전용 internal network=true, host port0, Docker volume0이며 기존 `local-postgres`에 접속하지 않았다. 합성 audit 1행이 담긴 PG18 `pg_dump -Fc` SHA256 `8f51eb3258584d6a12d9129fc518982e1f56d1d263bace0851fc8d068dd16c72`를 같은 임시 컨테이너의 새 `anvil_f18_r13_restore` DB에 `pg_restore`했다. 원본/복원 모두 head0016·audit1·vector0.8.2 일치. 유자료 `alembic downgrade -1`은 exit1/`DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`, 원본 head0016 유지; downgrade가 실제 수행된 것은 아니다.
- 임시 합성 credential은 계획의 `qa.env` 파일 대신 한 SSH 프로세스의 환경변수로만 사용했고 파일 생성·출력·Git 기록0이다(더 좁은 내부 구현). 최초 cached PG18 image의 `.Config.User` inspect 템플릿은 필드 부재로 진단 1회 실패했으나 ID/PGDATA/volume을 정확히 재조회했다. 정식 Developer 실패0, 제품 수정0. 경로 realpath/비-symlink/`daon:daon`/700·Git HEAD/clean, DB image ID, 전용 image ID/label, network label/internal/연결1·migrator 잔류0을 대조한 후 DB container·network·runtime image tag와 checkout/log/dump/tmpfs를 제거했다. path/container/network/image 잔류0, 기존 `local-postgres` Up·`anvil-web` healthy 불변, 공용 builder cache 보존.
- 제한: 이 실측은 현재 SHA의 PG18 migration·extension/query·단일 합성 백업/복원·유자료 rollback 거부만 입증한다. PG15 현재 revision 동일 E2E, Web/API/Worker 세 digest, 실제 API/브라우저/OIDC, network egress, Test/Staging→운영 유사 동일 artifact 승격과 전체 backup/restore·rehearsal은 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 같은 branch에서 PG15/PG18 현재 SHA의 공통 API·DB E2E 및 동일 image digest 결박을 준비한다. 새 branch/main 병합/운영 서버 작업 없음.

# F-18 R13 PG18 격리 migration·backup 검증 자원 계획 / 2026-09-25

- 담당 Main, 대상은 `ssh WSL-server`만. 기준 branch `codex/f18-wsl-ops` clean·`development` 동일 HEAD `76aa395e26d97aaad3c0a489aa42984f332c50a4`, G-05 seq1563 PASS, worker/write lease=None. 계획서 F-18 단계1 및 AV-OPS-025 잔여 중 **현재 제품 revision의 PG18 부분**만 검증한다. PG15 Test/Staging, 동일 세 image digest 승격, API/UI/브라우저/OIDC/운영 유사 rehearsal은 이번 결과로 PASS 처리하지 않는다. 제품 write·신규 branch·`ysna-server` 접근은 없다.
- 생성 전 읽기 전용 inventory: 전용 `/srv/anvil-wsl/f18-pg18-r13-qa` 부재, container `anvil-f18-r13-pg18-qa`/`anvil-f18-r13-migrate-qa`, network `anvil-f18-r13-internal-qa`, `anvil-f18-r13-runtime-qa:*` tag 모두 부재; 기존 `local-postgres` Up와 `anvil-web` healthy. cached PG18 image `pgvector/pgvector:0.8.2-pg18` ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, PGDATA `/var/lib/postgresql/18/docker`, image-declared volume root `/var/lib/postgresql`을 확인했다.
- 승인 Git alias에서 이 계획을 포함해 게시한 **정확한 SHA**를 위 전용 경로의 `repo`에 clean detached checkout한다(부모 `daon:daon`/0700). 기존 `deploy/local/Dockerfile.runtime` runtime target의 전용 tag `anvil-f18-r13-runtime-qa:<게시 SHA 앞 7자리>` 하나를 `--pull=false`·1GiB/2CPU로 build하고 OCI revision/full SHA와 image ID를 기록한다. 내부 전용 network 하나와 DB container 하나만 상주시킨다. DB는 host port·volume 없이 `--tmpfs /var/lib/postgresql`/1GiB 제한·합성 admin credential, DB명 `anvil_f18_r13_qa`; credential은 전용 `qa.env` mode600에만 두고 값은 출력·Git·보고서에 남기지 않는다. migration 실행 container `anvil-f18-r13-migrate-qa`는 일회성으로, 같은 내부망·nonroot runtime image에서만 실행한다.
- 확인 범위: PG18 server/pgvector extension 버전 및 vector query, 현재 Alembic head `0016_operations_recovery` upgrade, 합성 audit row 포함 version-matched `pg_dump`→같은 임시 container 내부의 `anvil_f18_r13_restore`로 `pg_restore` 후 schema/head/row 대조, 유자료 `alembic downgrade -1`의 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED` 거부와 head 보존. dump는 DB tmpfs에만 보관한다. 이는 실제 API/Worker/Browser E2E, 전체 F-18 또는 Production 합격이 아니다.
- 수명은 이 검증 동안뿐이다. 성공·실패 모두 exact path realpath·비-symlink·owner/HEAD/tracked clean, container/image ID·label·network 연결을 재검증한 뒤 전용 container/network/image/tag/path 및 합성 credential·DB tmpfs를 제거한다. path/container/network/tag/전용 listener 잔류0과 `local-postgres`/`anvil-web` 불변을 확인한다. 기존 서비스·DB·volume·공용 builder cache는 보존한다.

# F-18 R12 종료 최종 게이트 / 2026-09-25

- 판정: `F18_R12_AUTH_INGRESS_CHECKPOINT_PASS`, F-18 전체 인수 아님. 종료 증거와 exact 사후 검사 보정 commit `8048f0f`까지 `development/codex/f18-wsl-ops`에 게시했고 clean HEAD에서 G-05 `PASS sequence=1563 reporting=AUTO_CONTINUE`(exit0). R11 close+R12 start/close 통제 9 PASS(exit0), 로컬 Web typecheck/build exit0, WSL-server 실제 Web/API ingress HTTP 결과와 전용 자원 잔류0은 위 기록대로다. worker/write lease=None, Main 소유, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음 작업은 같은 branch의 F-18 잔여 실증이며 새 branch 생성·main 병합은 아직 하지 않는다.

# F-18 R12 종료 증거 사후 검증 범위 보정 / 2026-09-25

- seq1563 회수 증거 commit `cc71295` 게시 후 G-05는 `F18_WSL_OPS_R12_CLOSE_POST_QA_SCOPE_INVALID`로 차단됐다. 원인은 종료 QA SHA `b08d0c026a27332f72334bc8f6166457b9d6de07` 이후 수정한 R12 시작/종료 검사기의 역사 fixture test 경로가 종료 사후 허용 집합에서 누락된 것이다. 첫 보정 commit `22b7220`에도 종료 test 경로가 남아 동일 오류가 반복됐다. 실제 제품/lease 범위와 seq1562/1563 이벤트는 보존한다. 종료 overlay의 QA SHA를 위 이벤트 binding으로 고정하고 정확한 시작/종료 test·종료 overlay만 추가 허용한다. 관련 거부 회귀와 G-05를 게시 clean HEAD에서 다시 확인한다. 제품 실패·F-18 인수 아님.

# F-18 R12 종료 후 역사 fixture 보정 / 2026-09-25

- seq1563 회수 증거를 materialize한 직후 R12 시작 검사기 자체의 post-QA 단위 테스트 2건이 현재 progress를 ACTIVE라고 가정해 2 FAIL했다. 제품·G-05 실패가 아니라 테스트의 역사 fixture drift다. 게시 제품 commit의 정확한 seq1561 ACTIVE progress를 fixture로 고정하고, 허용/무관 경로 거부 검사를 다시 실행해 R11 close+R12 start/close 통제 9 PASS(exit0)로 복구했다. 발급 lease/제품 코드/현재 seq1563 progress는 변경하지 않았다.

# F-18 R12 writer 회수 결과 / 2026-09-25

- 담당 Main. 종료 통제/회귀 commit `b08d0c0`을 승인 SSH alias에 게시하고 G-05 seq1561 PASS를 확인했다. clean 동일 HEAD의 검증된 종료 코드에 결박해 seq1562 `WRITE_LEASE_REVOKED` → seq1563 `WORKER_LEASE_REVOKED`를 순서대로 materialize(exit0), canonical worker/write lease=None, active agent=Main, 제품 write scope=[]로 전환했다. 발급된 epoch10 제품 commit 및 원래 R12 시작 QA binding은 변경하지 않았다.
- 결과는 F-18 부분 checkpoint일 뿐 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production NOT_EXECUTED다. 이 문서·연쇄 manifest·progress/handoff/digest/event를 정확히 commit/push하고 clean G-05 seq1563 PASS를 확인하기 전에는 종료 완료로 표시하지 않는다. 다음은 같은 branch의 승인된 F-18 잔여 검증이며 새 branch/main 병합/운영 서버 작업은 없다.

# F-18 R12 종료 통제 QA 경계 보정 / 2026-09-25

- 종료 materialize 첫 시도는 `F18_WSL_OPS_R12_CLOSE_GIT_INVALID`로 fail-closed 되었고 canonical progress/lease는 seq1561 그대로다. 진단 결과 첫 종료 control QA commit `c7610e2` 이후 게시된 R12 시작 검사기 exact 자체 보정 파일 `scripts/f18_wsl_ops_r12_overlay.py`를 종료 검사기의 사후 허용 집합에서 누락했다. 제품 변경·원격 drift·dirty 파일은 없었다. 거부 회귀 RED 1 FAIL, 이 한 파일만 허용해 GREEN을 확인하고 새 종료 control QA commit에 재결박한다. `F-18 accepted=false`/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 R12 종료 통제 사후 범위 보정 / 2026-09-25

- 판정: `F18_R12_CLOSE_CONTROL_SCOPE_REPAIR`, 제품 실패·F-18 인수 아님. R12 종료 control commit `c7610e2` 게시 후 활성 R12 G-05는 `F18_LOCAL_START_GIT_INVALID`와 `F18_WSL_OPS_R12_POST_QA_SCOPE_INVALID`로 차단됐다. 원인은 R12 시작 검사기의 사후 허용 집합에 알려진 종료 plan/overlay/test와 checker dispatch exact4가 빠진 것이며, 발급 제품 exact3·lease token·원래 QA SHA·canonical snapshot은 정상이다. 동일 범주의 Main 통제 허용 경로 오류 두 번째 발견, 정식 Developer 실패0.
- 해당 exact4 control path만 시작 검사기의 Git 허용 경로에 더하고 발급된 canonical `control_paths()`/worker/write scope는 바꾸지 않는다. 현재 실제 상태 거부 회귀 RED 1 FAIL, 별도 `deploy/ysna/unrelated-change.sh` 주입은 계속 거부. 보정 테스트·checksum 동기화·게시 후 G-05를 재실행한다. 미통과 동안 lease 회수 증거는 materialize하지 않는다.

# F-18 R12 writer 종료 통제 준비 / 2026-09-25

- 담당 Main. 제품 exact3 및 같은 SHA 기반 WSL-server 실제 ingress HTTP QA, 로컬 Web 타입검사·빌드, 독립 리뷰 0 finding을 확인했다. 현재 seq1561/G-05 PASS, epoch10 worker/write lease ACTIVE인 상태에서 종료 통제만 준비한다. 제품 write·새 branch·운영 서버 변경은 하지 않는다.
- R12 close overlay/계획/거부 회귀와 G-05 분기를 추가했다. R11 close+R12 start/close 통제 9 PASS(exit0), 임시 pytest 경로는 생성되지 않았다. 다음은 control code·manifest 게시 후 exact QA commit에 결박해 seq1562 write→seq1563 worker 회수하고 증거 게시·G-05를 재확인한다. 회수 전 완료로 주장하지 않는다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R12 auth ingress 실제 QA·독립 리뷰 결과 / 2026-09-25

- 판정: `F18_R12_AUTH_INGRESS_BOUNDED_PASS`, F-18 전체 인수 아님. 담당 Main, 단일 제품 writer `developer-primary`, 독립 read-only reviewer. 발급된 epoch10 exact3 제품 commit `cae47aa8c2dd14d561d03b8eaf25948c860f136e`, 게시·WSL-server 검증 SHA `88004220423c324374b47a32ad7a50728c810094`를 구분한다. 독립 제품 리뷰 Critical/Important/Minor 0이며 `/api/`와 SPA fallback의 변경은 없다. 로컬 Main 관련 회귀 55 PASS(exit0); Developer의 RED 1 FAIL→GREEN 1 PASS. 전체 pytest는 기존 수집 13 ERROR로 비-GREEN이다.
- 로컬 Web 추가 확인: 최초 격리 `npm ci --ignore-scripts --no-audit --no-fund`는 registry tarball GET EACCES 및 `Exit handler never called`로 exit1. 허용된 네트워크 실행 경계에서 같은 lock 기준 설치에 `--fetch-retries=0`을 적용해 exit0/29 packages. `npm run web:typecheck`와 `npm run web:build` 각각 exit0(Vite 8.3.0, 17 modules). `package-lock.json` SHA256 전후 동일 `B1CBA45D362401032EF3BA362073B7C80A8CC42CDEF6EE6583884B66E619D8A3`. exact 생성 경로 `node_modules`, `apps/web/dist`, `.npm-f18-r12-cache` 제거 후 잔류0, Git clean. 최초 오류는 정식 Developer 실패가 아니다.
- WSL-server: 승인 SSH alias에서 위 게시 SHA를 전용 경로에 clean detached checkout. 기존 Dockerfile의 Web/runtime 두 target build exit0; 실제 image ID는 각각 `sha256:8caaef536cd45971d4d053e55233227f01622d46f012267f16ccbcff2fea20ed`, `sha256:90129ae9a6264ca18df88219e783049e2eebfcde5f168405c8d30a52c7ee79c2`, OCI revision은 게시 full SHA. Web image 빌드 과정의 타입검사·빌드와 `nginx -t` exit0. 신규 internal/ingress 두 network, 비root·read-only·cap-drop ALL·no-new-privileges·tmpfs·loopback `127.0.0.1:8312`의 전용 Web/API 두 container만 사용했다. `/auth/session/status`는 200 JSON `authenticated=false`, `/auth/not-found`는 404 JSON, 기존 `/api/health/ready`는 합성 미연결 DB에 따른 503 JSON `database_unavailable`, `/`는 200 HTML. 실제 Web→API same-origin ingress 확인이며 DB PASS로 해석하지 않는다.
- 최초 전용 부모 경로 일반 권한 생성은 `/srv/anvil-wsl`의 root 소유 때문에 실패했다. 경로 부재와 부모 권한을 다시 확인해 `sudo -n install -d`로 정확한 전용 경로만 생성했다. 종료 시 두 container·두 network·두 전용 image tag와 exact checkout/log/HTTP 산출물의 ID·label·realpath·소유자·HEAD·tracked clean·연결을 대조해 제거했다. path/tag/container/network/listener `:8312` 잔류0, 기존 `anvil-web` healthy·`local-postgres` Up 불변, 공용 builder cache 보존. 정식 Developer 실패0, Main 통제 검사기 오류1은 아래 보정 기록과 같다.
- 미검증: 브라우저 Network, 실제 DB 연동, 유인증 OIDC 및 step-up, PostgreSQL 15/18 전체 경로, 네트워크 정책·재시작/rollback·동일 digest 배포 게이트. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 다음은 R12 worker/write lease를 canonical 순서로 회수한 뒤 승인된 F-18 잔여 검증을 같은 branch에서 진행한다. 새 branch·운영 서버 작업 없음.

# F-18 R12 Web/API 실제 ingress 격리 QA 자원 계획 / 2026-09-25

- 담당 Main. 게시 clean `96177f243c8581a9b7a2bb72f0975dc4034e35a2`는 R12 제품 `cae47aa8c2dd14d561d03b8eaf25948c860f136e`의 후손이고 G-05 seq1561 PASS다. 같은 Git commit을 승인 remote에서 WSL-server 전용 `/srv/anvil-wsl/f18-auth-ingress-r12-qa/repo`에 clean detached checkout한다. 부모 `/srv/anvil-wsl/f18-auth-ingress-r12-qa`는 `daon:daon`/0700으로 격리하며 Git source 이외 복사·server patch는 금지한다.
- 생성 대상: 전용 image `anvil-f18-r12-web-qa:96177f2`와 `anvil-f18-r12-runtime-qa:96177f2`(기존 `deploy/local/Dockerfile.runtime`의 web/runtime target, OCI revision=실제 full Git SHA), internal network `anvil-f18-r12-internal-qa`, ingress network `anvil-f18-r12-ingress-qa`, container `anvil-f18-r12-api-qa`(internal 전용, `anvil-api` alias)와 `anvil-f18-r12-web-qa`(internal+ingress, host loopback `127.0.0.1:8312:8080`)뿐이다. Web/API는 read-only·cap-drop ALL·no-new-privileges·tmpfs와 image 기본 비root USER로 제한한다. 새 volume·DB·실제 계정·운영 Secret은 만들거나 사용하지 않는다. API 기동에 필요한 DSN은 연결되지 않는 합성 QA 식별자이고, Telegram 변수는 임시 합성 값이며 출력·Git·보고서에 원문을 남기지 않는다.
- 실행: `--pull=false`·1GiB/2CPU 제한으로 image를 build해 실제 ID/label을 확인한다. Web `/auth/session/status`가 API의 JSON `authenticated=false`인지, `/auth/` 미등록 경로가 HTML SPA 성공이 아닌 404인지, 기존 `/api/health/ready`가 API의 DB 미구성 503 JSON으로 전달되는지 실제 loopback HTTP로 확인한다. 이 시험은 실제 제품 Web+API 라우팅이며 DB·OIDC·브라우저 Network·동일 digest Test/Staging→운영 유사 target 승격 PASS가 아니다.
- 생성 전 읽기 전용 inventory: 부모 path, 두 tag·container·network 모두 부재, `:8312` listener 부재, 기존 `anvil-web` healthy·`local-postgres` Up. 수명은 이 QA 동안뿐이다. 성공·실패 모두 전용 container/image ID·label·network 연결·path realpath/비-symlink/owner/HEAD/tracked clean을 확인한 뒤 이 자원과 합성 입력만 제거한다. 공용 builder cache·기존 서비스/DB/network/volume은 보존하며 path/tag/container/network/listener 잔류0과 기존 서비스 불변을 확인한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 R12 사후 통제 검사기 보정 / 2026-09-25

- 판정: `F18_R12_VALIDATOR_POST_QA_SCOPE_REPAIR` (F-18 인수 아님). 단일 Developer 제품 exact3 `cae47aa8c2dd14d561d03b8eaf25948c860f136e`를 Main이 diff·clean·독립 로컬 관련 55 PASS(exit0, warning1)로 확인하고 `development/codex/f18-wsl-ops`에 push했다. 이후 G-05는 `F18_WSL_OPS_R12_POST_QA_SCOPE_INVALID`로 차단됐다. 재현·집합 대조 결과, R12 검사기 `collect_git`의 QA 이후 허용 집합에 `write_paths()`가 빠져 있었고 실제 변경은 발급된 정확한 제품 3경로뿐이었다. 제품 결함이나 정식 Developer 실패가 아닌 Main 통제 코드 오류 1회다.
- 조치: 제품 commit·발급 WI/hash·epoch10 token·`control_qa_head=30637da8301acdeccd32510656e914677c123e23`을 보존한다. 검사기는 기존 evidence와 발급된 제품 exact3 및 이 통제 보정의 overlay/test 경로만 사후 허용하며, `deploy/ysna/unrelated-change.sh` 주입은 명시 거부한다. 관련 RED는 기대된 POST_QA_SCOPE_INVALID 1 FAIL, GREEN 1 PASS, R11 start/close+R12 통제 8 PASS(exit0), R12 전체 5 PASS(exit0). 보정 코드·manifest를 commit/push하고 G-05 재통과 전 WSL QA를 시작하지 않는다. 임시 pytest 경로 잔류0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R12 auth ingress 통제 준비 / 2026-09-25

- 담당 Main. 기준 clean/원격 일치 `6509f28be39ae5137a0947e862fbe7cc9a4cb8c5`, canonical seq1558의 worker/write lease=None, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED. F-18 단계3의 `/auth/*` 제품 ingress same-origin을 위한 기존 Web Nginx 라우팅 보완을 R12 exact3(`deploy/local/nginx.conf`, `tests/integration/test_f15_local_stack.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`)로 좁혔다. 기존 F-18 후보 파일 상한에서 벗어난 파일 배치는 내부 구현 revision으로 분류하고 새 WorkInstruction/hash·epoch10 fencing token·canonical lease를 제품 write 전에 결박한다. 인증·권한·공개 API·DB·Secret·운영 대상 변경은 금지한다.
- 통제 파일은 R12 계획·WI·invocation·overlay·tooling test와 checker dispatch다. 이전 seq1558 progress/events 원문·Git 조상·branch/remote·control QA commit·exact path를 검증하고, 새 seq1559~1561 이벤트와 detached digest/manifest를 생성한 후에만 Developer를 배정한다. 현재 제품 파일 변경0·정식 Developer 실패0. 통제 테스트는 Windows 관련 R11 start/close+R12 7 PASS(exit0), 아직 새 G-05/lease 발급 전이다. 다음은 통제 commit/push→materialize/G-05→단일 Developer TDD이다.
- 통제 실행 결과: `30637da`를 `development/codex/f18-wsl-ops`에 push한 뒤 clean·이전 seq1558 원문 일치로 materialize exit0. 새 seq1559 `WORK_INSTRUCTION_ISSUED` →1560 `WORKER_LEASE_ISSUED` →1561 `WRITE_LEASE_ISSUED`, epoch10, worker/write exact3 동일 scope, 이전 lease 재사용0. `validate_state` 빈 오류를 확인했다. 증거 commit/push/G-05 뒤 단일 Developer에게 위임한다. 이 기록 자체는 제품 수정·실제 ingress QA가 아니다.

# F-18 auth ingress 후속 경계·로컬 기준선 / 2026-09-25

- 판정: `F18_AUTH_INGRESS_PRODUCT_FIX_PENDING` (F-18 인수 아님). 제품 Web image의 `deploy/local/nginx.conf`에는 `/api/` upstream만 있고 `/auth/`는 SPA fallback으로 간다. 반면 `apps/web/server.mjs`의 개발 proxy에는 `/auth/`가 있으며 실제 API에는 `/auth/session`·`/auth/session/status`가 등록되어 있다. 기존 F-18 WorkInstruction의 제품 ingress same-origin `/auth/*` 검증에는 Web Nginx 라우트 보완이 필요하다. 이 경로는 R1 제품 후보 상한 밖이므로 Main이 WorkInstruction revision/hash·exact write lease를 새로 결박한 뒤 단일 Developer writer에게만 맡긴다. `deploy/ysna`와 운영 대상은 제외한다.
- 로컬 기준선: `tests/integration/test_f15_local_stack.py`와 `tests/api/test_runtime_app.py`는 기본 pytest temp ACL로 setup 2 ERROR/23 PASS(exit1)였고, 작업공간 내 전용 `--basetemp` 재실행에서는 25 PASS(exit0, python_multipart warning 1). 전용 temp를 exact 경로 확인 후 삭제해 잔류0. 이는 제품 변경 전 F-15/runtime 회귀 기준이며 `/auth/` ingress 실제 HTTP·브라우저 PASS가 아니다. 다음 단위는 거부 회귀 RED → `/auth/`만 API로 프록시하는 최소 변경 → 로컬 GREEN → 게시 SHA의 WSL-server 제품 image 및 실제 same-origin HTTP 재검증이다. 정식 Developer 실패0, worker/write lease0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 기존 multi-stage Web/runtime image 격리 QA 자원 계획 / 2026-09-25

- 판정: `F18_MULTI_STAGE_IMAGE_BUILD_PASS_AUTH_INGRESS_GAP` (F-18 인수 아님). 게시 Git exact `7c39d40052104d8fdeeddd792a4319a53198ae5a` clean detached에서 기존 `deploy/local/Dockerfile.runtime`의 `web`/`runtime` target을 `--pull=false`·1GiB/2CPU로 각각 build exit0. 실제 Web image ID `sha256:1326fa2bf3cf316fd2f5a6e7e2eb895c384679f4fd51fc0fb4dfb0a02ebcd514`, runtime image ID `sha256:67d9480f7d7fcc3dc737f7cc71c77383f5cb9c2ab1c282c84125d552d74bb0a1`, 두 OCI revision label은 exact SHA다. Web은 USER `101:101`, dist/index 존재·`/api/` proxy 존재, Nginx 설정 구문은 임시 upstream 이름을 제공한 network-none 검사에서 exit0. Runtime은 USER `anvil`, API/Worker 모듈 spec 모두 존재, Worker 실제 import exit0. 따라서 앞선 단일 `Dockerfile.web`의 Worker/Node 부재를 제품 전체 3-role image 불능으로 확대하지 않는다. API와 Worker가 같은 runtime image ID를 사용하는 현 패턴은 별도 실제 서비스 구동·검증 전까지 허용 판정이 아니다.
- 남은 Important: Web Nginx `deploy/local/nginx.conf`에 `/auth/` proxy가 없어 F-18 WorkInstruction의 제품 ingress same-origin `/auth/*`가 미충족이다. 첫 `nginx -t`는 network-none DNS에 `anvil-api`가 없어 exit1이었고 `--add-host anvil-api:127.0.0.1`로 구문 exit0; 첫 API 실제 import는 `ANVIL_DATABASE_URL` 미설정으로 exit1이어서 module presence 및 Worker import로 한정해 검증했다. 이는 실제 HTTP+DB E2E가 아니다. 다음 제품 단위는 기존 Web Nginx ingress에 `/auth/` same-origin proxy와 거부 회귀를 추가하고, 이후 exact SHA로 두 target을 재빌드해 실제 API 경로를 확인하는 것이다. 기존 `deploy/ysna` 및 공유 WSL 서비스는 수정하지 않는다.
- 정리: exact path realpath·비-symlink·`daon:daon`/700·Git HEAD/tracked clean, 두 image ID/전용 tag·사용 container 0을 확인했다. 전용 tag/image 및 checkout/build log 제거 후 path/tag/전용 container 잔류0, 기존 `anvil-web` healthy. 공용 builder cache 보존. 제품 변경0·정식 Developer 실패0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

- 담당 Main. 같은 단일 `codex/f18-wsl-ops`, seq1558/G-05 PASS·worker/write lease0. 위 단일 `Dockerfile.web` 실패의 대체 경로를 신규 설계로 추측하지 않고 기존 `deploy/local/Dockerfile.runtime`의 `web`/`runtime` stage로 읽기 전용 계약 대조 후 빌드·검증한다. 승인 Git exact 현재 HEAD에서 새 `/srv/anvil-wsl/f18-artifact-targets-qa` clean detached checkout(`daon:daon`/700) 하나를 만들고, 전용 tag `anvil-f18-web-qa:8bcb630`과 `anvil-f18-runtime-qa:8bcb630`만 생성한다. tag의 짧은 값은 제품 코드 조상 식별자일 뿐 배포 권위가 아니며 OCI revision label·Git full SHA·실제 image ID를 따로 대조한다.
- `--pull=false`, legacy builder가 지원하는 1GiB/2CPU 제한으로 각 target을 build한다. Web은 Nginx 설정·dist·기본 사용자/port와 `/api/`, `/auth/` proxy 계약을 image 내부에서 확인하고, API/Worker는 동일 runtime image의 module import·실행 파일/의존성을 network none/read-only/cap-drop ALL 일회성 container에서 확인한다. 이 검증은 빌드·구성 요소 확인이며 실제 HTTP/DB/browser/동일 digest 두 target 배포 PASS가 아니다. 필요한 제품 수정은 현재 검증 결과 후 승인 F-18 범위의 별도 exact lease로 수행한다.
- 생성 전 exact path/tag/container 부재·기존 서비스·자원 상태를 재확인한다. 성공·실패 모두 image ID/전용 label·사용 container 0, path realpath/non-symlink/owner/HEAD/tracked clean을 확인하고 전용 tag/image 및 checkout만 제거한다. 공용 builder cache·기존 서비스/DB/network/volume/Secret은 보존하고 path/tag/전용 container 잔류0을 확인한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.

# F-18 동일 artifact image baseline 격리 QA 자원 계획 / 2026-09-25

- 판정: `F18_SINGLE_DOCKERFILE_IMAGE_INSUFFICIENT` (F-18 전체 인수 아님). 승인 Git에서 게시 exact `7056cded65160dedbb3b476a8d54555038ac6322` clean detached checkout, 기존 `deploy/wsl/Dockerfile.web`를 legacy builder의 제한 자원(1GiB/2CPU)으로 `--pull=false` build exit0. 전용 image ID `sha256:4bccc00327fc4fc69ac283137cf1dcb607e112204ebeb4461a463bfca37bbf96`, OCI revision label=exact SHA. network none/read-only/cap-drop ALL 일회성 container에서 `packages.api.oidc_code_flow`·issuer transport·WSL preflight import exit0, 그러나 `apps.worker.anvil_worker.main`은 이미지에 `apps/worker`가 없어 `ModuleNotFoundError`/exit1, Web Node 실행기는 부재/exit127. 단일 `Dockerfile.web` 산출물을 세 역할의 검증된 이미지로 재사용할 수 없다.
- 원인 경계: 이는 현 `Dockerfile.web`의 COPY 목록과 Python uvicorn 기본 명령에 부합한다. 기존 `deploy/local/Dockerfile.runtime`에는 별도 `web`(Nginx+Vite) 및 `runtime`(API+Worker) stage가 있어 전체 3-role artifact 불능으로 단정하지 않는다. 다만 그 Nginx 설정은 `/api/`만 프록시하고 WorkInstruction의 `/auth/*` same-origin 경계는 아직 검증·구현되지 않았다. 후속 격리 QA에서 기존 multi-stage 두 image를 현재 SHA로 build·inspect·역할별 실행한 뒤 실제 수정 범위를 확정한다. 첫 checkout full SHA 수기 오기재로 Git-only 후속 검사 1회 fail-closed(실제 HEAD/clean 확인), 첫 build의 Docker legacy 미지원 `--progress` exit125는 지원 옵션을 확인해 명령만 보정했다. 제품 파일 변경·정식 Developer 실패0.
- 정리: exact path realpath/non-symlink·`daon:daon`/700·checkout exact SHA/tracked clean, image ID/label, 다른 tag·사용 container 0을 확인했다. 전용 tag/image와 exact checkout/build log를 제거해 path/tag/전용 container 잔류0; 기존 `anvil-web` healthy, 공용 builder cache 보존. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

- 담당 Main. 현재 단일 branch `codex/f18-wsl-ops` clean·게시 `baf594d6cd55974187c98fdcad3e5049d8947b96`, G-05 seq1558 PASS, worker/write lease0. F-18 WorkInstruction 단계1의 Web/API/Worker image 기준선 준비를 한정해 실행한다. 이는 current revision의 빌드/정적 런타임 import 확인이며 Test/Staging HTTP+DB E2E, 서명 ReleaseManifest, 동일 digest 승격 또는 F-18 인수 자체는 아니다. 제품 파일은 변경하지 않는다.
- WSL-server 읽기 전용 preflight에서 신규 exact `/srv/anvil-wsl/f18-image-baseline-qa`·전용 tag `anvil-f18-image-baseline-qa:baf594d` 부재, 전용 container 0, 기존 `anvil-web` healthy, 가용 메모리 5.8GiB/디스크 561GiB를 확인했다. 새 경로 `daon:daon`/0700에 승인 Git에서 게시 exact commit을 clean detached clone한다. 기존 `deploy/wsl/Dockerfile.web`를 `--pull=false`·`ANVIL_RELEASE_COMMIT` label·새 전용 tag로 한 번만 build하고 실제 image ID를 기록한다. Web/API/Worker 역할의 필요한 Python import를 network none·일회성 read-only container로 분리 확인한다. 동일 단일 Dockerfile 이미지라 역할별 tag가 달라도 ID 동일 가능성을 명시하고, 그것만으로 각 서비스 런타임 PASS를 주장하지 않는다.
- 종료 전 exact path realpath/non-symlink/owner/HEAD/tracked clean, 생성 image ID·tag·전용 label·사용 container 여부를 확인하고 새 전용 tag/이미지(다른 사용처 0일 때만) 및 checkout만 제거한다. builder 공용 cache, 기존 image/container/network/volume/DB·Secret은 정리 대상으로 삼지 않는다. path/tag/전용 container 잔류0·기존 서비스 불변을 확인한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지한다.

# F-18 PG18 격리 DB·migration 단독 QA 자원 계획 / 2026-09-25

- 판정: `F18_PG18_ISOLATED_DB_QA_PASS_ONLY` (게시 clean `08c74fc8ce0c5e76c2121f26f7a6f34661d8f670`, 제품 조상 `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`). WSL-server 전용 checkout의 `uv lock --check --offline` 47 resolved, 잠긴 Python3.12 dev 43 installed. 기존 `pgvector/pgvector:0.8.2-pg18` image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`로 `anvil-f18-pg18-qa` 하나를 768MiB/2CPU/pids256, tmpfs 384MiB, loopback `:15438`에서 실행했다. 별도 `anvil_f18_qa` DB에 `CREATE EXTENSION vector`·Alembic `upgrade head` exit0; 실제 서버 version `180004`(18.4), pgvector `0.8.2`, head `0016_operations_recovery`, vector distance `1.0`을 조회했다. 전용 `anvil_f18_app`은 DB/스키마 CREATE=false, superuser=false로 55개 기존 public 테이블과 migration head를 조회했다.
- 인증 진단: 컨테이너 내부 localhost의 `pg_hba`는 `trust`라 잘못된 비밀번호도 허용됐다(내부경로의 거부 판정은 FAIL). 규칙 read-back은 local/127.0.0.1/::1=`trust`, 외부 host=`scram-sha-256`. 실제 WSL 호스트→`127.0.0.1:15438` 경로에서 psycopg 3.3.4로 틀린 비밀번호는 `OperationalError` 거부, 올바른 전용 credential은 역할·head·vector 조회 PASS(exit0). 컨테이너 내부 trust 특성은 임시 QA 경로의 한계로 남기며 network policy PASS로 승격하지 않는다.
- 전체 DB 백업/복원: 전용 DB에 합성 `f18_restore_marker` 1행을 넣고 `pg_dump -Fc --no-owner` 206607 bytes, SHA-256 `af654df2f4522d85a9c4bae206c8034147a0600503e4dfa5e2c72819527d54a6`; 같은 임시 컨테이너 내 별도 `anvil_f18_restore_qa`에 `pg_restore --exit-on-error` exit0. 원본·복원 DB가 모두 head `0016_operations_recovery`, public 56 tables, marker `f18-synthetic-qa`로 일치했다. 이 증거는 합성 데이터의 DB backup/restore이며 Web/API/Worker HTTP E2E·동일 3-image digest·실제 deployment/rollback 증거는 아니다.
- QA 도구 오류: 최초 image full ID 오기재는 자원 생성 전 fail-closed, Python `pgvector` import는 잠긴 환경에 패키지가 없어서 실패했으나 SQL extension 검증과 무관, Docker image-inspect `Config.User` template 오류와 원격 스크립트 base64 인코더 오타 각 1회는 제품 실행 전 진단·교정했다. 정식 Developer 실패0, 제품 파일 변경0. 종료 전 exact path non-symlink·`daon:daon`/700·credential/backup 600·repo tracked clean/ignored cache·container ID/image/label/tmpfs/no mount를 확인하고 전용 container/path/credential/backup 제거, path/container/listener 잔류0. 기존 `anvil-web` healthy·`local-postgres` Up 불변; 공유 image/cache는 보존했다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED. 다음은 현 제품 SHA의 Web/API/Worker image digest와 Test/Staging 동일 commit 검증을 마련한 뒤 별도 WSL 운영 유사 target rehearsal을 수행한다.

- 담당 Main. 현재 `codex/f18-wsl-ops` 게시 clean `9a34714e5126085e37e1e296abfb15a13ebd96c4`, 제품 SHA `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424` 조상, canonical seq1558/G-05 PASS, worker/write lease0. 설계 §49.11·WorkInstruction F-18 단계1/4/5의 PG18 분리·최소권한·migration/extension/backup-restore 일부를 WSL-server 격리 QA로 확인한다. 이는 동일 Web/API/Worker digest·HTTP E2E·운영 유사 target 승격/rollback·F-18 인수 전체를 대신하지 않는다.
- 생성 전 WSL-server 공유 container가 다수이며 기존 `anvil-web` healthy, `/srv/anvil-wsl/f18-ops-rehearsal` 부재, F18 전용 label container/network/volume 0, 지정 8310/8311/32770/8444 listener 부재를 확인했다. 최초 inventory 셸의 정규식 quoting 오류 1회와 base64 인코더 오타 1회는 실행 전 도구 오류로, 재실행해 읽기 전용 확인했다. 기존 `local-postgres`·공유 DB/네트워크·다른 프로젝트 자원은 변경하지 않는다.
- 신규 exact `/srv/anvil-wsl/f18-pg18-qa`(`daon:daon`/0700)에 승인 Git의 게시 commit을 clean detached checkout하고 경로 내부 잠긴 Python3.12 `.uv-cache`/`.venv`만 둔다. 기존 local image `pgvector/pgvector:0.8.2-pg18`의 정확한 ID를 재확인한 뒤 전용 `anvil-f18-pg18-qa` 하나를 `127.0.0.1:15438` loopback, 메모리 768MiB/CPU 2/pids256, 전용 tmpfs DB(384MiB), network/volume 신규 생성 없이 일회성 실행한다. 합성 admin/app credential·`anvil_f18_qa` DB/전용 role만 사용하고 값은 출력·기록하지 않는다. 역할 권한·PG/pgvector version·migration head 0016·vector query·합성 테이블 backup/restore·잘못된 role 거부를 검증한다. image는 공유 cache이므로 삭제하지 않는다.
- 성공·실패 모두 경로 realpath exact·비-symlink·owner/mode·Git HEAD/tracked clean·container ID/image/전용 port를 확인한 뒤 해당 container 및 exact QA 경로/credential/backup만 제거하고 path/container/listener 잔류0·기존 서비스 불변을 확인한다. 현재 F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지한다.

# F-18 실제 issuer step-up 격리 QA 자원 계획 / 2026-09-25

- 판정: `REAL_ISSUER_STEP_UP_PASS` (제품 exact `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`, WSL-server 격리 QA). 공식 Keycloak 26.7.4 image digest `sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c`를 `127.0.0.1:4771` 자체서명 localhost SAN TLS로 격리 실행했다. 임시 realm의 `acr.loa.map={"urn:anvil:step-up":2}` read-back, LoA1 비밀번호/LoA2 OTP 조건·인증 flow binding read-back 및 임시 public PKCE client/합성 user 설정을 확인했다. 실제 `OidcCodeFlow.begin(require_step_up=True)` 요청 → 사용자 비밀번호 → OTP 등록·검증 → callback의 code/state → `OidcIssuerTransport` 인증 코드 교환 → `OidcIdTokenVerifier` 서명·issuer·audience·nonce·최근 auth_time·고정 ACR 판정 결과 `step_up_verified=True`, `acr=urn:anvil:step-up`(QA script exit0). 같은 code/state 재사용은 `OIDC_CODE_FLOW_NOT_VERIFIED`로 거부됐다. 시드·코드·토큰·키·합성 credential 원문은 출력·보관하지 않았다.
- QA 스크립트 오류 2회: OTP 시드를 Base32로 잘못 해석해 padding/문자 오류가 발생했다. Keycloak 구현의 raw secret bytes 형식을 공식 소스와 대조해 스크립트만 교정했고 제품 파일 변경·정식 Developer 실패·보안 영향은 0이다. 이 검증은 실제 issuer step-up과 한 번 사용 거부에 한하며 API/BFF/browser UI, 네트워크 정책, PG18, 전체 suite GREEN, Production의 PASS가 아니다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED 유지. 다음 안전 행동은 F-18의 나머지 WSL-server 검증 경계를 작업계획서와 대조해 진행하는 것이다.
- 정리: exact `/srv/anvil-wsl/f18-oidc-stepup-qa` realpath·비-symlink·`daon:daon`/700·PEM key600·제품 SHA/tracked clean·전용 Keycloak container/image를 확인한 뒤 임시 container·경로/PEM·image를 제거했다. path/container/image/listener `:4771` 잔류0, 기존 `anvil-web` Up/healthy 불변. 기존 서비스·DB·운영 계정·Secret 영향0.

- 담당 Main. canonical seq1558/G-05 PASS, `codex/f18-wsl-ops` clean·게시, worker/write lease0 및 F-18 accepted=false/F-19 차단을 확인한다. 다음 미검증은 §49.8의 고위험 재인증/step-up 경계다. 공개 API·권한·DB·운영 Secret 변경 없이 게시 제품 SHA `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`의 실제 Keycloak flow를 격리 검증한다. 공식 Keycloak step-up 문서의 ACR→LoA mapping, LoA1 비밀번호·LoA2 OTP 조건, essential `acr` 요청을 사용하며 제품의 고정 `urn:anvil:step-up`과 최근 `auth_time` 검증을 비교한다. 성공이 어려우면 issuer 설정 미충족과 제품 결함을 분리해 기록한다. `https://www.keycloak.org/docs/latest/server_admin/`, `https://www.keycloak.org/docs-api/26.7.4/rest-api/index.html` 참고.
- WSL-server 신규 exact `/srv/anvil-wsl/f18-oidc-stepup-qa`만 사용한다. 생성 전 경로/container `anvil-f18-oidc-stepup-qa`/loopback `:4771` 부재·기존 `anvil-web` 상태·메모리를 확인한다. 해당 경로의 clean detached 제품 SHA, 내부 `.uv-cache`·`.venv` 잠긴 Python3.12, 하루짜리 localhost SAN PEM(키0600), 공식 Keycloak 26.7.4 고정 image/1GiB·2CPU·pids256·loopback HTTPS container 하나를 사용한다. 임시 realm/public PKCE client/합성 user·OTP만 만들고 기존 DB·network·volume·서비스·사용자 계정·Secret은 변경하지 않는다. synthetic password/OTP seed/code/token/key 원문은 보고·로그·Git에 기록하지 않는다.
- 실제 `OidcCodeFlow.begin(require_step_up=True)`의 `claims`·`max_age` 요청, issuer의 저인증 거부/추가인증 요구, 완료 ID Token의 ACR·auth_time·nonce 및 제품의 downgrade 거부를 검사한다. 일반 로그인 단일 PASS를 step-up PASS로 승격하지 않는다. 성공·실패 모두 exact path realpath·비-symlink·owner/mode·제품 SHA/tracked clean·image 사용 container를 확인한 뒤 해당 임시 container/path/PEM/image만 제거하고 path/container/image/listener 잔류0과 기존 서비스 불변을 확인한다. API/BFF/browser UI/Production 검증은 이번 QA에서 제외한다.

# F-18 R11 writer 종료 통제·WSL-server QA 자원 계획 / 2026-09-25

- 담당 Main. 게시 제품 `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424` WSL 잠긴 관련 151 PASS와 격리 실제 Keycloak ordinary code-flow/PKCE negative PASS, 자원 잔류0을 확인했다. R11 writer 종료는 seq1557 WRITE_LEASE_REVOKED → seq1558 WORKER_LEASE_REVOKED 증거-only이며 F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 유지한다. 신규 통제 모듈 부재 RED 2 FAIL(exit1) → GREEN 2 PASS(exit0), Windows R1~R11 종료 통제 38 PASS(exit0/6.67초), checker diff 3줄 추가/삭제0. 최초 PowerShell wildcard literal로 pytest 경로를 찾지 못한 read-only 호출(exit4)은 파일 목록을 명시적으로 전달해 해소했다.
- WSL-server 신규 exact `/srv/anvil-wsl/f18-ops-r11-close-control-qa` clean detached checkout 하나만 생성한다. 생성 전 경로 부재·기존 서비스 상태를 확인하고 게시된 control code SHA를 `daon:daon`/0700 경로에 가져온다. 내부 `.uv-cache`·`.venv`의 잠긴 Python3.12에서 offline lock·R1~R11 종료 통제 회귀를 실행한다. DB·Docker·기존 서비스·Secret·browser·listener는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 범위를 확인하고 해당 checkout만 제거해 잔류0을 증명한다. WSL PASS 전 lease 회수 증거는 발급하지 않는다.
- 종료 통제 WSL-server QA 결과: 게시 exact `b523ff57ea740b60e262d1480027aa69afbde457` clean detached, Python3.12.3, offline lock 47 resolved, 잠긴 dev 43 installed, R1~R11 종료 통제 **38 PASS**(exit0/3.10초). 경로 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인한 뒤 신규 checkout만 sudo 삭제·잔류0. 기존 `anvil-web` Up/healthy 불변. 제품·DB·Docker·Secret 영향0. 이제 control code SHA에 결박해 seq1557~1558 evidence-only lease 회수를 materialize한다.
- 검증된 종료 통제 code SHA `b523ff57ea740b60e262d1480027aa69afbde457` 및 게시 evidence HEAD `7ba57ae`에 결박하여 seq1557 `WRITE_LEASE_REVOKED` → seq1558 `WORKER_LEASE_REVOKED`를 materialize했다. 제품 write scope=[], worker/write lease=None, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지. 다음 안전 행동은 격리 실제 issuer step-up 경계 준비다. 증거가 미커밋인 동안 G-05 PASS를 주장하지 않고 checksum/commit/push 후 재검증한다.

# F-18 R11 실제 issuer 격리 재QA 자원 계획 / 2026-09-25

- Main 소유, WSL-server만 사용. 게시 exact 제품 SHA `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`을 신규 `/srv/anvil-wsl/f18-oidc-real-r11-qa/repo` clean detached로 가져오고 부모 exact 경로는 `daon:daon`/0700으로 격리한다. 기존 `/srv/anvil-wsl/f18-oidc-real-qa`의 자원은 잔류0이며 재사용하지 않는다. 내부 `.uv-cache`·`.venv`의 잠긴 Python3.12에서 Anvil 실제 `OidcCodeFlow`/`OidcIssuerTransport`/`OidcIdTokenVerifier`를 실행한다.
- 공식 Keycloak 26.7.4 고정 image를 다시 가져와 임시 `anvil-f18-oidc-r11-qa` container 하나만 1GiB/2 CPU/pids256과 `127.0.0.1:4771:8443` loopback publish로 사용한다. 부모 exact 경로에 1일짜리 localhost SAN 자체서명 cert/key를 만들고 0600 key/0644 cert, 임시 realm/public client/합성 user만 사용한다. 기존 서비스·DB·계정·Secret·network/volume·운영 환경은 건드리지 않는다. 실제 code/PKCE/TLS/서명/issuer/audience/nonce를 확인하고 틀린 verifier 거부도 시도한다. UI/browser·step-up 전체·Production PASS로 승격하지 않는다.
- 성공·실패 모두 exact path realpath·비-symlink·owner/mode·repo SHA/tracked clean·ignored 범위를 확인하고 해당 임시 container/path/cert만 제거한다. image는 다른 container 미사용을 확인 후 제거한다. path/container/image/listener 잔류0 및 `anvil-web` 기존 healthy를 재검증한다. synthetic credential, code, token, private key는 기록하지 않는다.
- 재QA 판정: `REAL_ISSUER_ORDINARY_CODE_FLOW_PASS` (제품 exact SHA `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`). Keycloak 26.7.4 image digest `sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c`, localhost SAN 자체서명 TLS 검증, 실제 discovery/JWKS 200(서명 RS256 키1·암호화 RSA-OAEP 키1), 합성 사용자 login 302 callback, Anvil `OidcCodeFlow`→`OidcIssuerTransport`→`OidcIdTokenVerifier`의 인증 코드/PKCE 교환·서명/issuer/audience/nonce 검증 PASS(exit0). Keycloak client의 `pkce.code.challenge.method=S256`를 읽어 확인했고 새 실제 코드에 잘못된 verifier를 제시하면 `OidcIssuerRejected`로 거부됐다(exit0). 첫 로그인은 필수 `VERIFY_PROFILE`로 callback에 이르지 못했으나 합성 사용자의 필수 프로필 필드를 설정해 해소했다. 이 결과는 ordinary OIDC 단일 flow에 한하며 step-up/브라우저 UI/API/BFF/DB/네트워크 정책/PG18/재시작/Production은 PASS가 아니다.
- 정리: exact `/srv/anvil-wsl/f18-oidc-real-r11-qa` 비-symlink·`daon:daon`/700, PEM 600/644, repo 제품 SHA/tracked clean·ignored cache/venv만 확인했다. image 사용 container는 임시 `anvil-f18-oidc-r11-qa` 한 개뿐이었다. 해당 container·exact 경로와 인증서·image를 제거하고 path/container/image/listener `:4771` 잔류0, 기존 `anvil-web` Up/healthy를 확인했다. 기존 서비스·DB·운영/사용자 계정 영향0. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED, seq1556 epoch9 lease는 종료 통제 전까지 ACTIVE다.

# F-18 R11 제품 WSL-server QA 자원 계획 / 2026-09-25

- 담당 Main. Developer exact3 clean commit `8bcb630cdd913ed0a4dc9fa456b814c0d71f1424`을 승인 SSH alias의 기존 branch에 push했다. Main 독립 Anaconda 관련 5-file **151 PASS**(exit0/7.76초), 게시 후 G-05 seq1556 PASS, branch clean. Developer 잠긴 로컬 151 PASS와 구분한다. 전체 suite 13 collection ERROR 비-GREEN, 실제 issuer/API/browser/Production은 미검증이다.
- WSL-server 신규 exact `/srv/anvil-wsl/f18-ops-r11-product-qa` clean detached checkout 하나만 생성한다. 생성 전 경로 부재·기존 서비스 상태를 확인하고 승인 remote의 위 제품 SHA를 checkout한다. `daon:daon`/0700, 내부 `.uv-cache`·`.venv`의 잠긴 Python3.12에서 offline lock 및 OIDC identity/code-flow/issuer-transport/local-session/web-security 회귀를 실행한다. DB·Docker·기존 서비스·Secret·listener·브라우저는 변경하지 않는다. 완료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 범위를 확인하고 checkout만 제거해 잔류0을 증명한다. 합성 계약 PASS를 실제 issuer PASS로 승격하지 않는다.
- WSL-server 결과: 게시 exact 제품 SHA clean detached, Python3.12.3, offline lock 47 resolved, 잠긴 dev 43 installed, 관련 **151 PASS**(exit0/7.15초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인하고 해당 checkout만 sudo 삭제했다. path 잔류0, 기존 `anvil-web` Up/healthy 불변. 실제 issuer/API/browser/Production은 여전히 미검증이다.

# F-18 R11 mixed-use JWKS 통제·WSL-server QA 자원 계획 / 2026-09-25

- 담당 Main, 제품 writer developer-primary. 같은 `codex/f18-wsl-ops` branch에서 R11 exact3만 발급한다. 최초 실제 issuer QA의 공개 JWKS 혼합 용도 실패를 회귀 테스트로 고정하고 RS256 서명 후보만 신뢰한다. 암호화 전용/비지원 키만 있는 JWKS, 잘못된 서명 후보, 중복 `kid`는 계속 거부한다. 기존 공개 API·DB·권한·Secret·운영 환경 변경 없음. 신규 control test는 모듈 부재 RED 2 FAIL(exit1) → 구현 후 GREEN 2 PASS(exit0); checker diff 3줄 추가/삭제0. seq1553/lease0/F-18 accepted=false/F-19 차단/Production NOT_EXECUTED 유지.
- 통제 전체 36건 중 최초 35 PASS/1 FAIL(exit1): R6 종료의 역사적 ACTIVE lease가 현재 시각 기준 만료되어 test가 과거 상태를 유효하지 않다고 오판했다. 제품·canonical lease에는 손대지 않고 해당 역사 검증 test에서 당시 `issued_at+1초`로 시계를 고정했다. 수정 전 집중 R6/R11 1 FAIL, 수정 후 4 PASS(exit0). R11 제품 scope나 런타임 동작은 변경하지 않았다.
- 통제 QA 신규 exact 경로 `/srv/anvil-wsl/f18-ops-r11-control-qa` 하나만 WSL-server에 생성한다. 생성 전 경로 부재·기존 서비스 상태를 확인한다. 승인 SSH alias에 게시된 control SHA를 `daon:daon`/0700 clean detached로 checkout하고 내부 `.uv-cache`·`.venv`에서 offline lock·잠긴 Python3.12 R1~R11 통제 회귀를 실행한다. DB·Docker·기존 서비스·Secret·브라우저·listener는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 범위를 확인하고 그 checkout만 제거하여 잔류0을 검증한다. PASS 전에는 lease를 발급하지 않는다.
- 통제 WSL-server QA 결과: 게시 exact `a2e899d92a4a6830d5c7e076a0155091f4f7da35` clean detached, Python3.12.3, offline lock 47 resolved, 잠긴 dev 43 installed, R1~R11 통제 **36 PASS**(exit0/2.64초). 경로 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인했다. 최초 삭제는 부모 디렉터리 권한 부족으로 실패(exit1), 재검증 후 해당 exact 경로만 sudo 삭제(exit0), 잔류0. 기존 `anvil-web` Up/healthy 불변. 제품·DB·Docker·Secret 영향0. 이제 검증된 control code SHA에 결박해 seq1554~1556 writer 발급을 진행한다.
- 검증된 control code SHA `a2e899d92a4a6830d5c7e076a0155091f4f7da35` 및 게시 evidence HEAD `bab44d9`에 결박하여 seq1554 `WORK_INSTRUCTION_ISSUED` → seq1555 `WORKER_LEASE_ISSUED` → seq1556 `WRITE_LEASE_ISSUED`를 materialize했다. epoch9 제품 exact3, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED 유지. 현재 증거 파일이 미커밋인 동안 G-05의 `F18_LOCAL_START_GIT_INVALID`는 예상되는 clean Git gate이며 PASS로 기록하지 않는다. checksum 동기화·증거 commit/push 후 재검증한다.

# F-18 실제 OIDC issuer QA 1차 결과·R11 보완 / 2026-09-25

- 판정: `REAL_ISSUER_JWKS_MIXED_USE_REWORK`, 전체 F-18 인수 아님. WSL-server 일회성 Keycloak 26.7.4 image digest `sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c`를 1GiB·loopback HTTPS로 실행했다. 자체서명 localhost SAN 인증서 검증과 discovery HTTPS 200, 임시 realm/public client/합성 user 생성, exact 제품 SHA `5c0a9ba2ec907b8e7a4b05c92389de9456304736` 잠긴 Python3.12 R10 25 PASS를 확인했다. 실제 로그인·code exchange 전 R7 `OidcIdTokenVerifier`가 Keycloak 공개 JWKS를 `OIDC_ID_TOKEN_NOT_VERIFIED`로 거부했다. 인증 코드/ID Token 실제 발급과 browser/API/step-up/Production은 미검증이다.
- 원인·재현: 공개 JWKS 메타데이터는 RS256 `use=sig` RSA 키 1개와 RSA-OAEP `use=enc` RSA 키 1개다. 동일 응답 전체는 R7 생성자에서 거부되고, 값 노출 없이 서명 키만 남긴 진단 입력은 수용된다. R7 생성자가 모든 JWK에 `use=sig`, `alg=RS256`을 요구하는 설계가 정상적인 혼합 용도 JWKS와 충돌한다. 수정은 비서명/비지원 키를 후보에서 제외하되 유효한 RS256 서명 키 최소1개, 후보의 구조·개인키 필드·중복 kid는 fail-closed로 유지한다. 기존 공개 API·세션 권한·DB는 변경하지 않는다.
- 정리: exact `/srv/anvil-wsl/f18-oidc-real-qa` realpath·비-symlink·`daon:daon`/700, Git 제품 SHA·tracked clean·ignored cache/venv만 확인 후 컨테이너 `anvil-f18-oidc-qa`, exact 경로/PEM, 유일 QA image를 제거했다. 독립 재확인 path/container/image/listener `127.0.0.1:4771` 잔류0, 기존 `anvil-web` Up/healthy. Windows shell의 검증용 `$(docker...)` 보간 오류1은 정리 명령의 앞 단계 실행과 무관했고 독립 잔류 검증으로 해소했다. 정식 Developer 실패0, Main 실제 통합 오류1·원인 확정1.
- 다음: 같은 branch의 R11 exact3(`oidc_identity.py`, `test_oidc_identity.py`, F-18 report) TDD·잠긴 로컬/WSL 회귀 후 격리 issuer를 새 exact QA 경로로 재생성해 실제 code/PKCE/TLS/서명·nonce 흐름을 재실행한다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED, seq1553 lease0 유지.

# F-18 OIDC 실제 issuer 격리 QA 자원 계획 / 2026-09-25

- 자원 계획 revision 1: 실제 Anvil `OidcCodeFlow`/`OidcIssuerTransport`/`OidcIdTokenVerifier`를 WSL-server에서 실행하려면 기존 system Python에 `httpx`가 없으므로, 같은 exact QA 경로의 자식 `repo`에 게시 제품 SHA `5c0a9ba2ec907b8e7a4b05c92389de9456304736` clean detached Git checkout을 추가한다. 그 안의 `.uv-cache`·`.venv`에서 offline lock·잠긴 Python3.12를 사용한다. 새 root 경로·container·listener는 추가하지 않고 종료 시 parent exact 경로와 함께 제거한다. 기존 QA 서버나 checkout을 재사용하지 않는다.
- 담당 Main, read-only 선행 확인: canonical seq1553/G-05 PASS, worker/write lease 없음, branch `codex/f18-wsl-ops` clean·remote 동일 `2e6535359b60de1708bea6e25613b3bd6402aa1f`. WSL-server exact `/srv/anvil-wsl/f18-oidc-real-qa` 부재, `anvil-f18-oidc-qa` container 부재, loopback `127.0.0.1:4771` listener 부재, 메모리 available 5.8GiB; 공유 서비스는 건드리지 않는다.
- 이번 QA는 공식 Keycloak 26.7.4 고정 image 하나를 WSL-server에 가져오고 임시 container `anvil-f18-oidc-qa` 하나만 1GiB 상한·`127.0.0.1:4771:8443` loopback publish로 시작한다. exact 경로에는 임시 localhost SAN 자체서명 PEM만 생성한다. Keycloak 내 임시 `anvilqa` realm/public PKCE client/합성 사용자만 만들고 기존 DB·network·container·웹·계정·Secret은 사용하지 않는다. `start-dev`는 격리 QA 전용이며 운영 구성으로 간주하지 않는다. 실제 제품 `OidcIssuerTransport`의 TLS 검증·code/PKCE 교환과 R7 ID Token 서명/issuer/audience/nonce 검증을 확인하되, browser UI·운영 인증·step-up 전체 PASS는 주장하지 않는다.
- 실패·성공 모두 exact container와 PEM 경로를 확인 후 제거하고, 새 image가 다른 container에서 사용되지 않았음을 확인한 뒤 exact QA image도 제거한다. 잔여 container/path/listener/image 0과 기존 서비스 상태를 재확인한다. 테스트 기록에는 합성 credential·authorization code·token·private key를 남기지 않는다.

# F-18 R10 종료 통제 WSL-server QA 자원 계획 / 2026-09-25

- R10 종료 projection: 검증된 control code SHA `7d8ffaec49c60aa4df7330254c52d8ee96bfbfb3`에 결박하여 seq1552 `WRITE_LEASE_REVOKED` → seq1553 `WORKER_LEASE_REVOKED`를 materialize했다. 제품 SHA `5c0a9ba2ec907b8e7a4b05c92389de9456304736` WSL 관련 143 PASS와 control 34 PASS만 증명한다. Main 소유, 제품 write scope=[], worker/write lease=None, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED 유지. 다음은 격리 실제 OIDC issuer QA이다.
- 종료 통제 QA: 게시 exact `7d8ffaec49c60aa4df7330254c52d8ee96bfbfb3` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R10 종료 통제 **34 PASS**(exit0/2.51초). realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 신규 QA checkout 제거·잔류0. 기존 `anvil-web` Up/healthy 불변. 이제 검증된 control code SHA에 결박해 seq1552~1553 lease 회수를 materialize한다.
- 담당 Main. 게시 제품 `5c0a9ba2ec907b8e7a4b05c92389de9456304736`의 WSL-server 143 PASS와 checkout 잔류0을 확인했다. R10 종료 통제는 canonical seq1551의 ACTIVE write/worker lease를 seq1552~1553으로 순서대로 회수한다. TDD 신규 모듈 부재 RED 2 FAIL(exit1) → GREEN 2 PASS(exit0/0.73초), Windows R1~R10 종료 통제 **34 PASS**(exit0/5.58초), checker diff 3줄 추가/삭제0. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED는 유지한다.
- WSL control QA 자원은 신규 exact `/srv/anvil-wsl/f18-ops-r10-close-control-qa` 하나다. 생성 전 경로 부재·기존 서비스 상태를 확인하고 게시된 control SHA를 `daon:daon`/0700 clean detached로 checkout한다. 경로 안의 `.uv-cache`·`.venv`에서 offline lock·잠긴 Python3.12 R1~R10 종료 통제를 실행한다. 기존 DB·Docker image/container/network/volume·서비스·Secret·브라우저·listener는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 목록을 확인하고 이 checkout만 제거해 잔류0을 확인한다.

# F-18 R10 OIDC transport 제품 WSL-server QA 자원 계획 / 2026-09-25

- 제품 QA 결과: 승인 remote의 exact `5c0a9ba2ec907b8e7a4b05c92389de9456304736` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, OIDC transport/code-flow/identity/local-session/web-security **143 PASS**(exit0/6.90초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인했다. 신규 제품 QA checkout만 제거·잔류0, 기존 `anvil-web` Up/healthy 불변. 이 판정은 synthetic issuer 계약이며 실제 Keycloak/TLS, API/browser, 전체 suite GREEN, Production PASS가 아니다. Main 독립 결과와 Developer 보고를 구분하고 F-18 accepted=false/F-19 차단을 유지한다.
- Main 독립 검토: Developer exact6 clean commit `5c0a9ba2ec907b8e7a4b05c92389de9456304736`을 승인 SSH alias로 push했다. 로컬 `test_oidc_issuer_transport/code_flow/identity/local_session/web_security` 143 PASS(exit0/9.42초), compileall·diff-check exit0. 전체 suite는 기존 13 collection ERROR로 비-GREEN, ruff 미설치로 미실행. 개발자 보고의 잠긴 로컬 148 PASS와 구분한다.
- QA 자원은 WSL-server 신규 exact `/srv/anvil-wsl/f18-ops-r10-product-qa` 하나만 사용한다. 생성 전 경로 부재·기존 서비스 상태를 확인한다. `daon:daon`/0700, 승인 remote의 제품 SHA clean detached checkout, 경로 내부 `.uv-cache`·`.venv`에서 offline lock·잠긴 Python3.12 설치 및 관련 단위·통합 회귀를 실행한다. DB·Docker image/container/network/volume, 기존 웹·PostgreSQL, Secret·listener/port·브라우저는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 전용 파일을 확인한 뒤 이 checkout만 제거하고 잔류0을 확인한다. 이는 synthetic issuer 검증이며 실제 Keycloak/HTTPS issuer, browser/API/Production 검증으로 승격하지 않는다.

# F-18 R10 OIDC transport 통제 WSL-server QA 자원 계획 / 2026-09-25

- R10 통제 발급: 검증된 control code SHA `46e45ed1bc2cd1cea98d267de1703b83a0799b32`에 결박해 seq1549 `WORK_INSTRUCTION_ISSUED` → seq1550 `WORKER_LEASE_ISSUED` → seq1551 `WRITE_LEASE_ISSUED`를 materialize했다. exact6 제품 경로의 epoch8 worker/write token, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED 유지. 다음은 checksum 동기화·G-05 뒤 Developer 구현이며 실제 issuer/browser 검증은 아직 미실행이다.
- 보정 재QA: 게시 exact `46e45ed1bc2cd1cea98d267de1703b83a0799b32` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R10 통제 **32 PASS**(exit0/2.13초). Windows 동일 32 PASS(exit0/5.02초). realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.pytest_cache/`, `.uv-cache/`, `.venv/` 확인 후 신규 `-r2` checkout만 제거·잔류0. 기존 `anvil-web` Up/healthy 불변. 제품·DB·Docker·Secret 영향0. 이제 seq1549~1551 writer 발급을 수행한다.
- 통제 보정 1회: 첫 QA 이후 `R10 evidence_paths`가 후속 checksum 동기화 대상인 R9_START manifest를 누락해 writer materialize의 post-QA diff guard와 충돌함을 사전 확인했다. 제품·runtime mutation0, lease 발급0. 누락 경로를 테스트 RED 1 FAIL/1 PASS(exit1)로 고정한 뒤 exact evidence-only 허용 목록에 추가해 focused 2 PASS(exit0/0.58초), diff-check exit0. 수정된 통제를 신규 exact `/srv/anvil-wsl/f18-ops-r10-control-qa-r2` clean detached WSL checkout에서 재검증한다. 생성 전 경로 부재·기존 서비스 불변, `daon:daon`/0700·offline lock·잠긴 Python3.12·종료 전 exact 경계·잔류0을 동일하게 확인한다. 정식 Developer 실패0, Main control 오류1·교정1이다.
- 통제 QA 결과: 게시 exact `ab4b6e8cda7e74fb3ff669dfd7c82761a870bcf5` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R10 통제 **32 PASS**(exit0/2.61초). Windows 동일 32 PASS(exit0/5.06초). realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 신규 QA checkout만 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 다음은 seq1549~1551 evidence-only writer 발급·G-05다.
- 담당 Main. 게시 clean `codex/f18-wsl-ops` HEAD `752c6b75e939e98b06286a227e7cebaff4876b88`, G-05 seq1548 PASS, worker/write lease0, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 확인했다. 승인 계획의 다음 범위를 R8의 주입 token exchange port에 연결하는 고정 HTTPS issuer transport exact6으로 한정한다. 기존 LocalTestSessionService를 OIDC 사용자 세션으로 재사용하거나 token claim을 role/permission으로 매핑하지 않는다. R10 계획·WI·invocation과 epoch8 control overlay를 준비하며 신규 모듈 부재 TDD RED 2 FAIL(exit1) → GREEN 2 PASS(exit0/0.57초), Windows R1~R10 통제 32 PASS(exit0/5.06초), checker diff 3줄 추가/삭제0이다.
- R10 통제 code QA의 유일한 신규 자원은 WSL-server exact `/srv/anvil-wsl/f18-ops-r10-control-qa` Git checkout이다. `ssh WSL-server`에서 생성 직전 경로 부재·기존 `local-postgres` Up/`anvil-web` Up/healthy를 읽기 전용 확인한다. 승인 remote에 게시한 control HEAD를 clean detached checkout하고 `daon:daon`/0700 경로 내부 `.uv-cache`·`.venv`만 사용해 offline lock·잠긴 Python3.12 R1~R10 통제 회귀를 실행한다. DB·Docker image/container/network/volume, 브라우저·Secret·listener/port·기존 서비스는 생성·변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 파일만 확인하고 이 checkout만 제거해 잔류0을 증명한다.
- 읽기 전용 선행 확인: WSL-server에 기존 Keycloak/OIDC issuer image는 없고 headless Chromium cache는 있다. 공식 Keycloak 26.7.4 amd64 manifest digest `sha256:3d911baa186f352563854039b95f21a7e2c01c76b527fdc64f24a0885b927bdf`를 원격 registry에서 조회했으나 아직 pull·container 생성은 하지 않았다. 이 image는 이후 별도 실 issuer QA 자원 계획과 격리·정리 경계가 확정된 뒤에만 사용한다.

# F-18 R9 종료 및 다음 경계 / 2026-09-25

- 교정된 종료 통제 `02973873a827776c7e47cafd074e09065edc090d`에 결박하여 seq1547 `WRITE_LEASE_REVOKED` → seq1548 `WORKER_LEASE_REVOKED`를 재생성했다. 종료 commit `d30aeff5684788539d3fe127e40515f150780f30` 원격 게시 후 G-05 seq1548 PASS(exit0), clean branch 확인. Main 소유, 제품 write scope=[], worker/write lease=None, F-18 accepted=false, F-19 차단, Production NOT_EXECUTED를 유지한다. 실제 issuer/API/browser 통합은 미검증이며 같은 단일 브랜치의 다음 로컬·WSL-server 작업이다.

# F-18 R9 종료 SHA 결박 교정 / 2026-09-25

- 교정 통제 WSL QA: 게시 exact `02973873a827776c7e47cafd074e09065edc090d` clean detached, Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R9 종료 통제 **30 PASS**(exit0/1.85초). realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/` 확인 후 신규 `-r3` checkout만 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이 control code SHA를 seq1547~1548 이벤트와 repository에 결박한다.
- 첫 seq1547~1548 종료 projection `af421fe`는 G-05에서 `QA_HEAD_INVALID`, `REVOCATION_INVALID`, `STATE_INVALID`로 거부됐다. 원인은 materializer가 WSL 검증된 최신 control code commit이 아니라 그 뒤 QA 결과 evidence commit을 `control_qa_head`와 이벤트에 적은 것이다. 제품·WSL 서비스 영향0, 인수 기록으로 승인하지 않았다. 게시 Git 이력은 보존하고 exact 잘못된 종료 commit만 `7dd4988` revert로 원복했다.
- 종료 통제 코드는 실제 `control_qa_commit`을 이벤트·repository에 동일하게 결박하도록 수정한다. 로컬 focused와 WSL-server 신규 exact `/srv/anvil-wsl/f18-ops-r9-close-control-qa-r3`에서 게시 수정 SHA를 재검증한 뒤에만 seq1547~1548을 재생성한다. 경로 부재·기존 서비스 상태를 먼저 확인하고 clean detached/daon 0700/잠긴 Python3.12/정확한 삭제·잔류0 경계를 유지한다. 정식 Developer 실패0, Main 통제 projection 오류1·교정1이다.

# F-18 R9 종료 통제 WSL-server QA 자원 계획 / 2026-09-25

- 수정 종료 통제 재QA: 게시 exact `7df4476326da0602444548a45c4efb1963b34eb2` clean detached, control code SHA `c57d4d2` 조상, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R9 종료 통제 **30 PASS**(exit0/1.76초). realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 신규 `-r2` checkout 제거·잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이제 seq1547~1548 lease 회수를 materialize한다.
- 종료 통제 follow-up 1회: 첫 WSL QA 이후 `materialize`의 `control_qa_commit == HEAD` 조건이 evidence-only QA 기록 commit과 충돌함을 확인했다. 제품/런타임 오류가 아닌 통제 guard 오류로, 검증된 control QA commit의 조상관계와 그 이후 exact evidence-only diff를 함께 검사하도록 수정했다. 기존 fail-closed validator와 같은 조건이며 Windows focused 2 PASS(exit0), diff-check exit0. 수정된 통제는 별도 신규 `/srv/anvil-wsl/f18-ops-r9-close-control-qa-r2` 경로에서 게시 exact HEAD를 재검증한다. 생성 전 경로 부재·기존 서비스 불변을 확인하고 동일한 0700/clean detached/잠긴 Python3.12/잔류0 절차를 적용한다. 정식 Developer 실패0.
- 종료 통제 QA 결과: 게시 exact `dbfee16c1814ff5e6b9c33301ab8582840dc8e1f` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R9 종료 통제 **30 PASS**(exit0/1.69초). Windows 동일 30 PASS(exit0/4.81초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인하고 신규 QA 경로만 제거해 잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 다음은 seq1547~1548 evidence-only lease 회수 및 G-05다.
- 담당 Main. 동일 게시 제품 `0b8adc634ff98a6649d615a03399292c835b81d8`의 WSL-server 148 PASS와 checkout 잔류0을 확인했다. R9 종료 통제는 canonical seq1546의 ACTIVE write/worker lease를 seq1547~1548로 순서대로 회수한다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED는 유지한다. TDD는 종료 상태/선행 상태 거부를 검증하며 Windows·WSL 통제 회귀와 G-05를 수행한다.
- 신규 exact WSL checkout `/srv/anvil-wsl/f18-ops-r9-close-control-qa`만 생성한다. 생성 전 경로 부재와 기존 `local-postgres`/`anvil-web` 상태를 확인한다. 게시된 종료 통제 SHA를 clean detached checkout해 `daon:daon`/0700, 내부 `.uv-cache`·`.venv`·임시 pytest만 사용한다. DB·Docker·browser·Secret·포트·기존 서비스는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean을 확인한 뒤 exact 경로만 제거해 잔류0을 증명한다.

# F-18 R9 제품 WSL-server QA 자원 계획 / 2026-09-25

- 제품 WSL QA 결과: 게시 exact `0b8adc634ff98a6649d615a03399292c835b81d8` clean detached, Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, 제품·통제 관련 **148 PASS**(exit0/8.07초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인한 뒤 신규 checkout exact 경로만 삭제해 잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 삭제 전 확인 명령 인용 오류 1회는 read-only 실패이며 재확인 후 정확한 경계검사를 통과한 삭제 1회만 수행했다. 제품/기존 서비스 영향0, 정식 Developer 실패0. 실제 issuer/API/browser/Production은 여전히 미검증이다. 다음은 R9 worker/write lease 회수 통제다.
- 담당 Main. developer-primary의 exact4 제품 commit `0b8adc634ff98a6649d615a03399292c835b81d8`을 승인 Git SSH alias의 기존 `codex/f18-wsl-ops`에 push했다. G-05 seq1546 PASS(exit0). TDD RED 신규 assertion 1 FAIL/31 PASS → GREEN 신규 32 PASS, 관련 잠긴 회귀 118 PASS(exit0), diff-check exit0, 제품 작업 트리 clean. 전체 pytest는 기존 수집 오류 13건으로 exit1이므로 전체 PASS 미확인. 실제 issuer/API/browser/Production은 미검증이고 F-18 accepted=false, F-19 차단이다.
- Main 통제 오류 1회: 대형 `scripts/check_project_progress.py`에 직접 patch 적용 시 무관한 embedded 내용이 비정상 절단되었다. `git diff`로 즉시 탐지해 해당 미커밋 변경만 역적용하고 작은 검증된 `git apply` patch로 필요한 dispatcher 6줄만 다시 반영했다. 제품·원격·WSL 영향 0, 해당 통제 회귀 Windows/WSL 각각 28 PASS. 정식 Developer 실패 횟수 0.
- 제품 QA 신규 exact checkout `/srv/anvil-wsl/f18-ops-r9-product-qa`의 부재와 기존 `local-postgres`/`anvil-web` 상태를 생성 직전 읽기 전용 확인한다. 승인 remote의 위 제품 exact SHA를 clean detached checkout하고 `daon:daon`/0700 경로 안에만 `.uv-cache`, `.venv`, `.f18-r9-product-test-temp`를 둔다. WSL Python3.12 잠긴 dev 환경에서 offline lock 검사와 OIDC code-flow/identity/local-session/web-security 관련 회귀 및 통제 회귀를 실행한다. DB·Docker·기존 서비스·브라우저·Secret·listener/port는 생성·변경하지 않는다.
- 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored/임시 파일 범위를 확인하고 이 신규 QA 경로만 제거한다. 잔류0·기존 두 서비스 상태 불변을 증명한다. source는 게시 Git commit으로 복구 가능하며 제품 QA 결과를 기록한 뒤 R9 worker/write lease 회수와 G-05 재검증을 한다.

# F-18 R9 step-up 요청 통제 WSL-server QA 자원 계획 / 2026-09-25

- R9 통제 QA 결과: 게시 exact `c1870433d1298433235b23f945eae0c5fa117924` clean detached, WSL-server Python3.12.3, `uv lock --check --offline` exit0/47 resolved, locked dev 43 installed, R1~R9 통제 **28 PASS**(exit0/1.70초). Windows 동일 28 PASS(exit0/4.00초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 신규 QA checkout exact 경로만 제거, 잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 다음은 seq1544~1546 evidence-only writer 발급이다.
- 담당 Main. R8 종료 공개 checkpoint `c8064226835fc142c46350a62009b653c907cbfb`, seq1543, worker/write lease0, F-18 `accepted=false`, F-19 차단, G-05 PASS를 확인하고 같은 `codex/f18-wsl-ops` branch를 유지한다. R9 exact4는 R7 고정 ACR을 R8 요청에 필수값으로 전달하는 내부 계약 보완이며 실제 issuer/API/세션/권한/DB/Secret은 변경하지 않는다. 계획·WI·invocation과 제품 scope를 canonical seq1544~1546에 결박한다. 통제 TDD RED는 overlay 부재 2 FAIL(exit1), GREEN은 2 PASS(exit0/0.59초), R8 close+R9 focused 4 PASS(exit0/1.14초)다.
- 통제 code QA는 승인 Git SSH alias에 게시된 exact SHA를 WSL-server 신규 clean detached `/srv/anvil-wsl/f18-ops-r9-control-qa`에 수신한다. 생성 직전 경로 부재·기존 `local-postgres`/`anvil-web` 상태를 읽기 전용 확인하고 `daon:daon`/mode0700 한 경로만 만든다. 내부 `.venv`·`.uv-cache`에서 잠긴 Python3.12 dev 환경, offline lock 검사, R1~R9 통제 회귀를 수행한다. Docker image/container/network/volume, DB, listener/port, Secret, 브라우저는 생성·변경하지 않는다.
- 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 범위를 확인하고 이 신규 QA 경로만 제거한다. 잔류0 및 기존 서비스 불변을 증명한 뒤에만 evidence-only writer 발급·G-05 검증을 수행한다. 이 통제 QA는 실제 OIDC issuer/API capability가 아니다.

# F-18 R9 OIDC step-up 요청 계약 준비 / 2026-09-25

- 담당 Main. 현재 clean `codex/f18-wsl-ops` HEAD `c8064226835fc142c46350a62009b653c907cbfb`, canonical seq1543/G-05 PASS, worker/write lease0, F-18 `accepted=false`, F-19 차단을 재확인했다. 승인 계획의 다음 미완료 범위는 WSL-server 격리 OIDC·step-up 실제 검증이다. 기존 R7 verifier와 R8 PKCE transaction을 확인한 결과 `require_step_up=True`는 pending intent·반환 ID Token 검사에만 반영되고 authorization URL에 ACR 요청을 넣지 않는다. 이는 R8 내부 단위의 미구현 경계이지 R8 QA PASS를 취소하거나 실제 issuer PASS로 승격할 근거가 아니다.
- R9 내부 단위는 기존 `packages/api/oidc_code_flow.py`의 step-up 요청에 고정 ACR을 essential ID Token claim으로 요구하고 최근 인증을 요구하며, ordinary 요청에는 이를 넣지 않는 계약으로 한정한다. 응답은 R7의 고정 ACR·최근 `auth_time` 검증을 계속 통과해야 한다. token role/scope를 권한으로 승격하거나 기존 local test session·공개 API·DB·Secret을 변경하지 않는다. TDD에서 URL의 literal query/JSON과 다운그레이드·위조 거부를 먼저 고정하고 R8/R7 및 기존 인증 회귀를 재실행한다. 실제 issuer/API/browser는 R9 코드 단위만으로 PASS가 아니다.
- 후속 실제 issuer/API 통합은 같은 작업 branch에서 별도 exact scope와 resource plan으로 수행한다. WSL-server 전용 issuer 후보는 공식 Keycloak의 OIDC essential ACR/LoA step-up 지원을 기준으로 하며, QA image는 실행 전에 digest를 고정하고 loopback/격리 네트워크·일회성 계정·임시 Secret/인증서·정확한 수명과 정리 대상을 기록한다. 기존 서비스·DB·운영 issuer/`ysna-server`는 사용하지 않는다. Keycloak `start-dev`는 공식 문서상 개발 모드이므로 격리 QA에서만 고려하고 Production 증거로 사용하지 않는다. 근거: `https://openid.net/specs/openid-connect-core-1_0.html`, `https://www.rfc-editor.org/rfc/rfc7636/`, `https://www.keycloak.org/docs/latest/server_admin/`, `https://www.keycloak.org/server/containers`.

# F-18 R8 종료 통제 WSL-server QA 자원 계획 / 2026-09-25

- 최종 종료 통제 재QA: 최신 verifier exact `9884dc415c0e1e18c0ee8b6e76054e6ae4311b9d` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, 잠긴 dev 43 installed, R1~R8 종료 통제 **26 PASS**(exit0/1.56초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 exact QA checkout 제거·잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 최초 추가 commit이 아닌 최신 검증 control SHA를 종료 projection에 결박한다.
- 종료 통제 QA 결과: 게시 exact `2de80d072163e6bfccc7bca3e395edfa7dcfca68` clean detached, WSL-server Python3.12.3, offline lock exit0/47 resolved, locked dev 43 installed, R1~R8 종료 통제 **26 PASS**(exit0/1.36초). Windows 동일 26 PASS(exit0/3.30초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인 후 신규 QA checkout exact 경로만 제거, 잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 다음은 seq1542~1543 evidence-only lease 회수·G-05다.
- 담당 Main. 게시 제품 exact `e6a6c9b9b0f642e51d4dffbc0d8f803ed6b90c2b`의 WSL-server Python3.12 잠긴 관련 회귀 139 PASS·전용 checkout 잔류0을 확인했다. 새 R8 종료 통제는 seq1542~1543에서 write/worker lease를 순서대로 회수하고 F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다. TDD RED는 overlay 부재 2 FAIL(exit1), GREEN은 2 PASS(exit0/0.51초)다.
- 종료 통제 code QA는 승인 Git alias에 게시된 exact control SHA를 WSL-server의 신규 `/srv/anvil-wsl/f18-ops-r8-close-control-qa`에 clean detached checkout한다. 생성 전 경로 부재·기존 `local-postgres`/`anvil-web` 상태를 읽기 전용 확인하고 `daon:daon`/mode0700 한 경로만 만든다. 내부 `.venv`·`.uv-cache`에서 잠긴 Python3.12 dev 환경, offline lock 검사, R1~R8 종료 통제 회귀를 실행한다. Docker/DB/port/Secret/browser는 생성·변경하지 않는다.
- 정리 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·ignored 범위를 확인하고 신규 QA checkout 한 경로만 제거해 잔류0과 기존 서비스 불변을 확인한다. QA 후에만 evidence-only 종료 투영을 수행하며 실제 issuer/API 인수로 승격하지 않는다.

# F-18 R8 code-flow 제품 WSL-server QA 자원 계획 / 2026-09-25

- 제품 QA 결과: 승인 Git alias에서 제품 exact `e6a6c9b9b0f642e51d4dffbc0d8f803ed6b90c2b` clean detached checkout, WSL-server Python3.12.3, `uv lock --check --offline` exit0/47 resolved, locked dev 43 installed. `tests/api/test_oidc_code_flow.py`, R7 identity, 기존 local session/web security 및 R1~R8 통제 회귀 **139 PASS**(exit0/7.73초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.uv-cache/`, `.venv/`만 확인하고 신규 QA checkout exact 경로만 제거했다. 잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 실제 issuer/API/세션·Production은 `NOT_EXECUTED`; F-18 `accepted=false`, F-19 차단을 유지하며 다음은 R8 lease 종료 통제다.
- 담당 Main. developer-primary exact3 제품 commit `e6a6c9b9b0f642e51d4dffbc0d8f803ed6b90c2b`를 지정 `development` SSH alias의 기존 `codex/f18-wsl-ops`에 push하고 G-05 seq1541 PASS를 확인했다. 로컬 잠긴 R8/R7/기존 보안 focused 113 PASS이며 전체 pytest는 기존 13 collection ERROR 및 보정 장시간 실행 중단으로 PASS 미확인이다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.
- 제품 QA는 WSL-server의 신규 전용 `/srv/anvil-wsl/f18-ops-r8-product-qa` 경로만 사용한다. 생성 전 exact 경로 부재·기존 `local-postgres`/`anvil-web` 상태를 읽기 전용 확인하고, `daon:daon`/mode0700 전용 디렉터리 하나를 만든다. 승인 Git SSH alias에서 제품 exact SHA를 fetch한 clean detached checkout에 잠긴 Python3.12 dev 환경을 `.venv`로 설치하며 offline lock 검사와 R8/R7/local_session/web_security 및 통제 회귀를 실행한다. 기존 checkout, DB, Docker image/container/network/volume, listener/port, Secret, 브라우저는 변경·생성하지 않는다.
- 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·untracked/ignored 범위를 확인하고 이 신규 QA 경로만 제거한다. 잔류0 및 기존 서비스 불변을 확인한다. 이 단위 QA는 실제 issuer/Authorization Code 네트워크/API/세션·step-up 실측이나 F-18 인수를 증명하지 않는다. 결과와 미검증 범위를 본 파일에 추가한 후 R8 lease 종료 통제를 진행한다.

# F-18 R8 code-flow 통제 QA 계획 / 2026-09-25

- R8 통제 QA 결과: 게시 exact `ac44e8e7fc447128cd68d3cb015410eee54644c8` clean detached, WSL-server Python3.12.3, 47 resolved/43 installed, `uv lock --check --offline` exit0, R1~R8 통제 **24 PASS**(exit0/1.08초). Windows 동일 24 PASS(exit0/3.04초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.venv/`만 확인 후 exact 신규 checkout 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 실제 OIDC issuer/API 미검증이며 다음은 seq1539~1541 evidence-only writer 발급이다.
- 담당 Main. R7 종료 공개 checkpoint `85b788b570ebd58f252c3952cae8f7d75063f517`, seq1538, worker/write lease0, F-18 `accepted=false`, F-19 차단, G-05 PASS를 확인하고 같은 `codex/f18-wsl-ops` branch를 유지한다. R8은 계획된 OIDC/step-up 연결의 내부 code-flow/PKCE 단위만 추가하며 외부 공개 API·세션·권한·Secret·DB·기존 서비스는 변경하지 않는다. 실제 issuer/API/step-up 실측은 다음 단위다.
- 내부 구현 선택은 공식 OIDC Authorization Code Flow와 PKCE S256을 따르는 원자적 pending-state port + R7 ID Token verifier 연결이다. 구현 대안 중 token 역할 주장으로 권한을 만드는 방식과 운영용 in-memory pending store는 배제한다. R8 제품 exact3과 WorkInstruction/계획 hash를 canonical seq1539~1541에 결박한다. TDD 통제 RED는 새 overlay 부재 2 FAIL(exit1), GREEN은 focused 2 PASS(exit0/0.42초)다.
- 통제 code QA는 승인 Git alias에 게시된 exact SHA를 WSL-server 신규 clean detached `/srv/anvil-wsl/f18-ops-r8-control-qa`에 수신한다. 생성 직전 경로 부재·기존 서비스 상태를 읽기 전용 확인하고 `daon:daon`/mode0700 한 경로만 만든다. 내부 `.venv`·`.f18-r8-control-test-temp`에서 잠긴 Python3.12 dev 환경, offline lock 검사, R1~R8 통제 회귀를 수행한다. Docker image/container/network/volume, DB, listener/port, Secret, 브라우저는 생성하지 않는다.
- 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked/untracked 범위를 확인해 이 신규 QA 경로만 제거하고 잔류0·기존 `local-postgres`/`anvil-web` 불변을 증명한다. QA 후 evidence-only writer 발급·G-05 검증까지 마친 뒤 developer-primary에게 제품 exact3을 지시한다. 이 통제 QA는 실제 OIDC issuer/API PASS가 아니다.

# F-18 R7 종료 통제 WSL-server QA 자원 계획 / 2026-09-25

- 통제 QA 결과: 게시 exact `9c288bd7d87641c72e92df15759115ed494f1e33` clean detached, Python3.12.3, 47 resolved/43 installed, `uv lock --check --offline` exit0, R1~R7 종료 통제 **22 PASS**(exit0/1.27초). 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·ignored `.venv/`만 확인해 exact checkout 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 실제 issuer/API·Production 미검증, F-18 `accepted=false`, F-19 차단. 이제 seq1537/1538 lease 회수 evidence-only 투영 및 G-05를 진행한다.
- 종료 통제 TDD RED: 새 `scripts/f18_wsl_ops_r7_close_overlay.py` 부재로 신규 테스트 2 FAIL(exit1). GREEN: 동일 신규 테스트 2 PASS(exit0/0.51초), Windows R1~R7 종료 통제 회귀 22 PASS(exit0/2.72초), `git diff --check` exit0. 제품 exact6은 추가 변경0이다. 현재 seq1536은 통제 QA·lease 회수 전 ACTIVE이며 종료 PASS로 승격하지 않는다.
- 담당 Main. R7 종료 통제 code의 게시 exact SHA만 승인 Git SSH alias에서 WSL-server 신규 `/srv/anvil-wsl/f18-ops-r7-close-control-qa`에 clean detached checkout한다. 생성 직전 경로 부재·기존 서비스 상태를 읽기 전용으로 재확인하고 `daon:daon`/mode0700 한 경로만 만든다.
- 전용 checkout 내부 `.venv` 및 `.f18-r7-close-test-temp`만 사용해 잠긴 Python3.12, offline lock 검사, R1~R7 종료 통제 회귀를 실행한다. Docker image/container/network/volume, DB, port/listener, Secret, browser는 새로 만들지 않는다. 기존 `/srv/anvil-wsl/repo`, `local-postgres`, `anvil-web` 및 다른 서비스는 건드리지 않는다.
- 종료 전 realpath exact·비-symlink·owner/mode·HEAD·dirty/untracked 범위를 확인해 이 신규 경로만 제거하고 잔류0 및 기존 서비스 불변을 증명한다. 소스는 공개 Git commit으로 복구 가능하다. 통제 QA가 실제 OIDC issuer/API capability를 증명하지 않는다.

# F-18 R7 ID Token 제품 WSL-server QA 자원 계획 / 2026-09-25

- 결과: 공개 제품 exact SHA `0b220b8a57922e051ad1fc43ea433c1ec189c5aa` clean detached, `daon:daon`/700. 첫 `uv sync --locked`는 기본 Python 3.14.3을 선택해 회귀 108 PASS였으나 목표 interpreter가 아니므로 최종 판정에 쓰지 않는다. 같은 checkout에서 `--python /usr/bin/python3.12`로 전용 `.venv`를 교체해 Python 3.12.3·47 resolved/43 installed, `uv lock --check --offline` exit0, 신규 ID Token·기존 API 보안·R1~R7 통제 회귀 **108 PASS**(exit0/6.08초)를 확인했다. 환경 선택 교정 1회, 제품 정식 실패 0.
- 정리 전 realpath exact·비-symlink·`daon:daon`/700·HEAD exact·tracked clean, ignored 산출물 `.venv/`만 확인했다. exact 신규 QA checkout만 제거해 잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 실제 issuer/discovery/authorization code/API/session/cookie/step-up endpoint·Production은 미검증이며 F-18 `accepted=false`, F-19 차단을 유지한다.
- 담당 Main. 공개된 제품 exact SHA `0b220b8a57922e051ad1fc43ea433c1ec189c5aa`만 승인 Git SSH alias에서 수신한다. 신규 exact `/srv/anvil-wsl/f18-ops-r7-product-qa` 한 경로를 `daon:daon`/mode0700으로 생성하고 clean detached checkout한다. 생성 직전 경로·기존 서비스 상태를 읽기 전용 재확인한다.
- checkout 내부 `.venv`와 `.f18-r7-product-test-temp`에서 잠긴 Python3.12 dev 설치, offline lock 검사, 신규 ID Token 및 기존 API 보안 회귀, R1~R7 통제 회귀를 실행한다. 새 Docker image/container/network/volume, DB, listener/port, credential/Secret, 브라우저는 생성하지 않는다. 기존 `/srv/anvil-wsl/repo`, `local-postgres`, `anvil-web` 및 다른 서비스는 보존한다.
- 시험 종료 전 realpath exact·비-symlink·owner/mode·HEAD·tracked clean·untracked 범위를 확인한 뒤 이 신규 QA 경로만 제거하고 부재 및 기존 서비스 불변을 증명한다. source는 공개 Git commit으로 복구할 수 있다. 이 verifier 단위 결과는 실제 OIDC issuer/API/step-up capability PASS나 F-18 전체 인수가 아니다.

# F-18 R7 ID Token 검증 writer 통제 QA 계획 / 2026-09-25

- R7 통제 code QA: 게시 exact SHA `aa4d71cbfb6f74a25e23ae3738eafe6b66ee96b6`를 WSL-server 신규 clean detached `/srv/anvil-wsl/f18-ops-r7-control-qa`에 수신, 잠긴 Python3.12 `uv sync --locked --group dev --no-install-project` exit0/46 resolved·42 installed, `uv lock --check --offline` exit0, R1~R7 통제 **37 PASS**(exit0/1.48초). Windows 동일 37 PASS(exit0/15.74초). 새 checkout realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r7-control-test-temp/`만 확인 후 exact 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이제 QA SHA 결박 seq1534~1536 evidence-only 투영을 수행한다.
- 담당 Main 어울, 기존 단일 `codex/f18-wsl-ops` branch의 clean 게시 HEAD `dd12b4566204b447339da137b175b7fb0a902f73`, G-05 seq1533 PASS. R6 write/worker lease 회수 및 F-18 accepted=false/F-19 차단/Production `NOT_EXECUTED`를 확인했다. R7은 승인된 OIDC·step-up의 첫 내부 단위로 고정 신뢰 JWKS의 ID Token verifier만 만들고 세션·권한·공개 API는 변경하지 않는다. 계획 `F-18_WSL_OPS_R7_ID_TOKEN_PLAN.md`, WorkInstruction/Invocation과 epoch5 exact6 통제 게이트를 준비했다. 신규 게이트 모듈 부재 RED 2 FAIL(exit1)→focused 2 PASS(exit0), Windows R1~R7 통제 **37 PASS**(exit0/15.74초), diff-check exit0. `.f18-r7-*` 테스트 임시 경로는 exact 비-reparse 확인 후 잔류0. 정식 Developer 실패보고 0회.
- WSL-server 읽기 전용 사전 확인: 신규 exact `/srv/anvil-wsl/f18-ops-r7-control-qa` 부재·비-symlink, 기존 `local-postgres` Up·`anvil-web` Up/healthy. R7 통제 code checkpoint를 승인 Git SSH alias로 push한 뒤 이 경로만 `daon:daon`/700으로 생성해 exact clean detached checkout한다. 내부 `.venv`와 `.f18-r7-control-test-temp`만 사용해 잠긴 Python3.12 dev 환경, offline lock check, R1~R7 통제 회귀를 실행한다. 기존 `/srv/anvil-wsl/repo`, DB·Docker·브라우저·Secret·포트는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·dirty를 확인하고 새 QA checkout만 제거·잔류0을 증명한다. 이후 evidence-only seq1534~1536 writer 발급 및 G-05 재검증을 한다. 실제 OIDC issuer/API/step-up 실측은 R7 verifier 결과로 PASS라 하지 않는다.

# F-18 R6 제품 lease 회수 통제 QA 계획 / 2026-09-25

- R6 회수 code QA: 게시 exact SHA `efb6ce5518c61e976bab2210e4b077280669d0d7`의 WSL-server clean detached `/srv/anvil-wsl/f18-ops-r6-close-qa`, Python3.12 `uv sync --locked --group dev --no-install-project` exit0/46 resolved·42 installed, `uv lock --check --offline` exit0, R1~R6·close 통제 **35 PASS**(exit0/1.34초). Windows 동일 35 PASS(exit0/16.14초). 전용 checkout realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r6-close-test-temp/`만 확인 후 exact 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. QA 뒤 변경은 evidence-only seq1532/1533 회수다.
- 담당 Main 어울, 동일 `codex/f18-wsl-ops` branch. R6 제품·WSL 실제 MinIO 검증 후 활성 epoch4 write→worker lease를 순서대로 회수하는 코드/증거 전환이다. 고정 게시 predecessor `8e2e89bf820a26fa84f1dc66562d35e87efb4b89`, 제품 `6f95fd9033b9e4017854c2ea467f0580ffc71e52` 조상 관계와 seq1531 전체 역사, 회수 후 제품 write scope 빈 목록을 검증한다. 신규 기능·제품 파일 mutation·새 branch는 없다. TDD module 부재 RED 2 FAIL(exit1)→focused 2 PASS(exit0), Windows R1~R6·close 통제 **35 PASS**(exit0/16.14초), diff-check exit0. `.f18-r6-close-red`/`green` temp는 미생성, QA temp는 종료 후 exact 정리. 정식 Developer 실패보고 0회. F-18 전체 accepted=false/F-19 차단/Production `NOT_EXECUTED` 유지.
- WSL-server 읽기 전용 사전 확인: 새 exact `/srv/anvil-wsl/f18-ops-r6-close-qa` 부재·비-symlink, 기존 `local-postgres` Up·`anvil-web` Up/healthy. 통제 code checkpoint를 승인 SSH alias로 push한 뒤 이 경로만 `daon:daon`/700으로 만들고 동일 게시 SHA를 clean detached 수신한다. 내부 `.venv`와 `.f18-r6-close-test-temp`만 사용해 Python3.12 잠긴 dev 환경, offline lock check, R1~R6·close 통제 회귀를 실행한다. DB·Docker·브라우저·Secret·포트·기존 `/srv/anvil-wsl/repo`는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·dirty를 확인하고 전용 checkout만 제거·잔류0을 확인한다. 그 뒤에만 seq1532/1533 회수를 evidence-only 투영한다.

# F-18 R6 S3 호환 ArtifactStore 통제 QA 자원 계획 / 2026-09-25

- Main 독립 R6 제품 리뷰: exact6 diff에서 기존 `FileSystemArtifactStore`·공개 API·기본 선택 변경 없음, 주입 client와 고정 bucket/prefix, 사전 hash/size, 조건부 write, 412 byte 비교, 409/transport fail-closed, read 무결성 검사 확인. R6 관련 Windows 전체 9-file **180 PASS**(exit0/64.35초), `.f18-r6-main-full-temp` exact 비-reparse 정리·잔류0. R6 범위 Critical/Important 발견 0; 제품 로컬·WSL object store capability에 한정된 검증이며 F-18 전체 Gate가 아니다. 활성 R6 lease는 후속 canonical 회수 전까지 재사용·확대하지 않는다.
- R6 WSL 제품 QA 판정 `OBJECT_STORE_R6_VERIFIED_ONLY`: 게시 제품 exact SHA `6f95fd9033b9e4017854c2ea467f0580ffc71e52`를 clean detached WSL-server `/srv/anvil-wsl/f18-ops-r6-product-qa`로 수신, 잠긴 Python3.12 `uv sync --locked --group dev --no-install-project` exit0/46 resolved·42 installed, `uv lock --check --offline` exit0, 관련 6-file **110 PASS**(exit0/0.98초). 기존 MinIO image ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`의 전용 container ID `ac5da7ca239baca678c81ced41a7cf119398273a40d10f863714adcd281c28aa`, label `anvil.qa=f18-r6`, `127.0.0.1:19016` loopback health 200. 합성 bucket/prefix와 보호된 일회성 credential로 실제 boto3 `put/read/동일 객체 dedupe`, 상이 bytes 충돌 거부, 손상 read 거부, 잘못된 credential 거부를 실행해 exit0 `MINIO_R6_REAL_PUT_READ_DEDUPE_COLLISION_CORRUPTION_DENIAL_PASS`. 실제 Secret 값은 출력·기록하지 않았다. Inline QA 준비 중 로컬 JS `TextEncoder` 미지원으로 orchestration 1회 실행 전 오류가 있었고 ASCII base64 생성으로 바로잡았다. 정식 Developer 실패보고 0회.
- 정리: checkout realpath exact·비-symlink·`daon:daon`/700·정확한 제품 HEAD·tracked clean, untracked는 전용 MinIO data/env/pytest temp만 확인. 전용 container ID/label/image를 확인해 해당 container만 제거, exact checkout의 synthetic data·credential을 제거했고 checkout/container/port 잔류0. 기존 `local-postgres` Up 및 `anvil-web` Up/healthy 불변. 공유 Docker image/cache/network·기존 서비스/DB는 제거하지 않았다. OIDC·network policy·PG18·세 image digest·backup/rollback·브라우저·Production은 미검증, F-18 `accepted=false`, F-19 차단, ReleaseDecision `DEFER` 유지. 다음은 R6 제품 독립 리뷰와 lease 회수, 이후 F-18 남은 capability 작업이다.
- R6 제품 Main 독립 사전 검토: worker clean exact6 commit `6f95fd9033b9e4017854c2ea467f0580ffc71e52`를 승인 SSH alias에 게시했고, 변경 파일이 발급 exact6과 일치하며 `git diff --check` exit0. Windows 관련 6-file 110 PASS(exit0/0.97초), 처음 `uv lock --check --offline`은 사용자 기본 cache 접근 거부(exit1), checkout 전용 cache로 재실행 exit0/46 resolved. `.f18-r6-main-temp`·`.f18-r6-main-uv-cache` exact 비-reparse 정리·잔류0. G-05 seq1531 PASS(exit0). WSL 실측 전 제품 전체 PASS는 아니다. 정식 Developer 실패보고 0회.
- WSL-server R6 제품·MinIO QA 사전 자원 계획: 새 exact `/srv/anvil-wsl/f18-ops-r6-product-qa` 부재·비-symlink, 전용 container `anvil-f18-r6-minio` 및 전용 network 이름 충돌 없음, 기존 local image `minio/minio:RELEASE.2025-09-07T16-13-09Z` ID `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9` 확인. `daon:daon`/700 checkout에 승인 Git exact 제품 SHA를 clean detached로 받고, 내부 `.venv`, `.f18-r6-product-test-temp`, `.f18-r6-minio-data`(700), `.f18-r6-minio.env`(600)만 만든다. 일회성 합성 credential은 이 env 파일에만 두고 값은 기록·출력하지 않는다. `anvil-f18-r6-minio`는 위 고정 image, 전용 label, 비-root uid1000/gid1000, cap-drop ALL, no-new-privileges, host `127.0.0.1:19016`→container 9000만 사용한다. 생성 직전 포트/이름을 다시 확인한다. 합성 bucket/prefix로 실제 put/read/dedupe/collision/권한 거부를 확인하고 Python3.12 잠긴 dev 환경의 관련 회귀를 실행한다. 기존 `anvil-web`, `local-postgres`, `/srv/anvil-wsl/repo`, 타 Docker image/network/DB와 Production은 변경하지 않는다. 사용 후 container ID/label/image·checkout realpath/owner/mode/HEAD/dirty·전용 파일만 확인하고 exact 전용 container 및 checkout만 제거해 잔류0을 증명한다. 전용 credential은 QA 후 복구하지 않는다. 운영 network policy나 전체 F-18 acceptance를 이 QA로 PASS라 하지 않는다.
- R6 통제 code QA 판정: 게시 exact SHA `d60abfa866710ca9d450b3477cfcef7eac17debd`를 WSL-server 새 clean detached `/srv/anvil-wsl/f18-ops-r6-control-qa`에 수신, Python3.12 `uv sync --locked --group dev --no-install-project` exit0/39 resolved·35 installed, `uv lock --check --offline` exit0, R1~R6 통제 **33 PASS**(exit0/1.16초). Windows 동일 33 PASS(exit0/15.56초). 해당 신규 checkout은 realpath exact·비-symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r6-control-test-temp/`만 확인 후 exact 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이제 QA SHA 결박 seq1529~1531 evidence-only projection을 수행한다. F-18 전체 acceptance로 승격하지 않는다.
- 담당 Main 어울. 기존 단일 `codex/f18-wsl-ops` branch에서 승인된 F-18 내부 R6 객체 저장소 adapter exact6 작업을 준비한다. F-18 전체 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`; 기존 filesystem 기본값과 공개 API는 유지한다. R5 독립 검토 Minor였던 QA/체크포인트 조상 관계 검사를 R6 worker 발급 게이트에 추가했다. R6 통제 테스트는 module 부재 RED 2 FAIL 후 Windows R1~R6 관련 범위 33 PASS(exit0/15.56초), 임시 `.f18-r6-control-qa-temp` exact·비-reparse 확인 후 제거·잔류0. 정식 Developer 실패보고 0회.
- WSL-server 읽기 전용 사전 확인: 새 exact `/srv/anvil-wsl/f18-ops-r6-control-qa` 부재·비-symlink, 기존 `local-postgres` Up·`anvil-web` Up/healthy. 통제 code checkpoint를 승인 SSH alias로 push한 뒤 이 경로만 `daon:daon` mode700으로 만들고 정확한 게시 SHA를 clean detached checkout한다. checkout 내부 `.venv`와 `.f18-r6-control-test-temp`만 사용해 Python3.12 잠긴 dev 환경, offline lock check, R1~R6 통제 회귀를 실행한다. DB·Docker·브라우저·Secret·포트·기존 `/srv/anvil-wsl/repo`는 변경하지 않는다. 종료 전 realpath exact·비-symlink·owner/mode·HEAD·dirty 범위를 확인하고 새 checkout만 제거·잔류0을 확인한다. 결과 검증 후에만 seq1529~1531 R6 exact6 lease를 투영한다.

# F-18 R5 통제 테스트 fixture 재현성 보정·WSL 자원 계획 / 2026-09-25

- 독립 R5 read-only 감사: 게시 `97f907e604d76d4589a45626e256a283f2260f0f` clean branch에서 R4/R5 테스트 **4 PASS**(exit0), G-05 seq1528 PASS(exit0)를 독립 실행했고 이전 fixture Important 해소, 잔여 Critical/Important 0. QA 최초 추가 commit `77c1532...`·R4 checkpoint `b399527...`의 실제 조상 관계, QA 후 evidence-only 6경로, 고정 과거 ledger prefix 및 F-18 accepted=false/Production NOT_EXECUTED 확인. Reviewer의 Minor 1건: R5 검사기가 실제 이력에선 맞는 `b399527`→R5 QA 조상 관계를 코드에서 직접 강제하지 않아, 다른 분기 이력의 R4 증거 복사를 형식상 거부하지 못한다. 다음 제품 writer 발급 통제 전환에서 조상 검사·회귀 테스트로 보완한다. 현재 실제 이력은 정상이며 F-18 전체 acceptance로 승격하지 않는다.
- seq1528 투영 후 Windows 현재 체크포인트에서 R1~R5 관련 통제 **31 PASS**(exit0/15.39초), `.f18-r5-projected-temp` exact 비-reparse 정리·잔류0. R5 validator의 precommit 검사 결과는 예상대로 `F18_LOCAL_START_GIT_INVALID` 한 건뿐이며 다른 상태·hash·event 오류는 없었다. evidence-only commit·게시 후 G-05를 다시 실행한다.
- R5 code QA 판정: 승인 Git의 공개 exact SHA `77c153290070b2ceb1e45d9430d27c3f1f31855a`를 WSL-server 신규 clean detached `/srv/anvil-wsl/f18-ops-r5-control-qa`에 수신, 잠긴 Python3.12 `uv sync --locked --group dev --no-install-project` exit0/39 resolved·35 installed, `uv lock --check --offline` exit0, R1~R5 관련 통제 **31 PASS**(exit0/1.13초). Windows 같은 31 PASS(exit0/14.56초). 첫 checkout 시 로컬 Git 조회 없이 잘못 확장한 전체 SHA `77c15326...`를 입력해 Git `reference is not a tree` exit1이었고, 정확한 로컬 `git rev-parse HEAD`를 확인한 뒤 같은 전용 checkout에서 바로잡았다. 환경/명령 입력 오류 1회, 제품·정식 Developer 실패 0회. 제거 전 realpath exact·비 symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r5-control-test-temp/`만 확인, exact checkout 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이 코드는 seq1528 투영 전 QA이므로 투영 후 현재 상태 테스트·G-05를 재실행한다.
- 담당 Main 어울, 판정 `R5_CONTROL_QA_PENDING`, 동일 `codex/f18-wsl-ops` branch. 독립 read-only R4 검토는 R3 QA 독립 Git 앵커·seq1526/27 회수·evidence-only Git diff에서 Critical 0, 추가 Important 0을 확인했지만, 게시 `b39952770e115c2ccafdf0e980eb31b6c23cc716`의 R4 테스트 fixture가 현재 seq1527을 선행 seq1525로 오인해 재실행 2 FAIL(exit1)인 Important 1건을 발견했다. G-05 PASS와 구분해 R4 체크포인트 최종 통과 판정을 보류했다.
- 원인·조치: `_predecessor()`가 mutable 현재 progress/events를 읽었다. 테스트를 고정 공개 predecessor `d27c5264a56c80ccf4f96571fcca15ec50ca93e7`의 Git 파일로 읽게 한 뒤 같은 2 PASS(exit0), 새 R5 검사 테스트는 module 미존재 RED 2 FAIL→GREEN, 현재 체크포인트에서 R1~R5 통제 31 PASS(exit0/14.56초), diff-check exit0. 전용 `.f18-r5-local-qa-temp` exact 비-reparse 정리·잔류0. R5는 기존 공개 R4 checkpoint `b399527...`의 progress/events를 역사적 정본으로 고정하고 test-fix event seq1528만 더하며 새 제품 lease는 발급하지 않는다.
- WSL-server 읽기 전용 사전 확인: 신규 exact `/srv/anvil-wsl/f18-ops-r5-control-qa` 부재, 기존 `local-postgres` Up·`anvil-web` Up/healthy. R5 code checkpoint 게시 후 이 경로만 `daon:daon` mode700으로 생성, 승인 Git의 exact clean commit을 detached checkout하여 잠긴 Python3.12 `.venv`와 내부 `.f18-r5-control-test-temp`에서 R1~R5 관련 통제 회귀를 실행한다. DB·Docker·브라우저·Secret·포트·기존 `/srv/anvil-wsl/repo`는 변경하지 않는다. 사용 후 realpath·비 symlink·owner/mode·HEAD·dirty를 확인하고 exact 임시 checkout만 제거·잔류0을 증명한다. F-18 accepted=false, F-19 차단, Production `NOT_EXECUTED` 유지.

# F-18 R4 통제 QA 앵커 보정·WSL 자원 계획 / 2026-09-25

- R4 code QA 판정: 게시 exact SHA `ec550d8d3bba4f3110b03f56dadca0475dfdc29d` clean detached WSL checkout의 잠긴 Python3.12 `uv sync --locked --group dev --no-install-project` exit0/39 resolved·35 installed, `uv lock --check --offline` exit0, R1~R4 및 관련 overlay **29 PASS**(exit0/0.94초). Windows 동일 범위 29 PASS(exit0/14.29초). R4 overlay 최초 추가 Git commit은 위 QA SHA와 일치하며 R3 WI 최초 추가 commit은 `0f0ff0df5495edcec8a3e49cacea516e5d1de3c6`으로 확인했다. WSL 임시 checkout `/srv/anvil-wsl/f18-ops-r4-control-qa`는 realpath exact·비 symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r4-control-test-temp/`만 확인 후 exact 제거·잔류0. 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변. 이제 evidence-only seq1527 회수 projection/G-05 검증을 수행한다. 정식 Developer 실패보고 0회.
- 담당 Main 어울, 기존 단일 `codex/f18-wsl-ops` branch. 판정 `R4_CONTROL_QA_PENDING`, F-18 accepted=false, F-19 차단, Production `NOT_EXECUTED`. R3 통제 결함 재현: progress의 `control_qa_head`와 worker/write lease baseline·dispatch를 함께 현재 후속 SHA로 옮겨도 기존 `validate_state`는 `[]`였다. 독립 Git 앵커 부재가 원인이다. R3 WorkInstruction 최초 추가 commit `0f0ff0df5495edcec8a3e49cacea516e5d1de3c6`에 결박하고, R4에서 이전 게시 `d27c5264a56c80ccf4f96571fcca15ec50ca93e7` progress/event 계보와 R3 lease 회수를 검증한다. 제품 writer는 새로 발급하지 않는다.
- TDD: R3 동시 QA/lease 재결박 거부 테스트 RED 1 FAIL(exit1, 실제 `validate_state=[]`) → 최소 앵커 결박 후 4 PASS. R4 새 검증 테스트는 신규 module 부재 RED 2 FAIL(exit1) → R3/R4와 관련 overlay 전체 Windows 29 PASS(exit0/14.29초), diff-check exit0. 전용 `.f18-r4-qa-temp` exact 비-reparse 정리·잔류0. 실제 WSL 검증은 아직 미실행이며 이 local 결과로 통제 QA PASS를 선언하지 않는다.
- WSL-server 사전 읽기 전용 확인에서 신규 exact `/srv/anvil-wsl/f18-ops-r4-control-qa` 부재, 기존 `local-postgres` Up·`anvil-web` Up/healthy. R4 code checkpoint를 승인 SSH alias로 게시한 뒤 이 경로만 `daon:daon` mode700으로 생성해 exact clean detached checkout한다. checkout 내부 잠긴 Python3.12 `.venv`와 `.f18-r4-control-test-temp`만 사용해 R1~R4 및 관련 overlay 테스트를 실행한다. DB·Docker·브라우저·Secret·포트·기존 `/srv/anvil-wsl/repo`는 변경하지 않는다. 종료 전 realpath·비 symlink·owner/mode·HEAD·dirty 범위를 확인하고 신규 checkout만 제거·잔류0을 확인한다. QA 뒤 evidence-only projection으로 seq1527 R3 write→worker lease 회수를 기록하고 G-05를 재검증한다.

# F-18 R3 제품 WSL 잠금·이미지 QA 자원 계획 / 2026-09-25

- QA 판정: `R3_LOCKED_WSL_RUNTIME_VERIFIED`(F-18 전체 아님). 공개 제품 commit `971a021f5f7da8bfcd10a0c285caf8f6f2bea2a9`를 exact clean detached 임시 checkout에서 수신, Python3.12 `uv sync --locked --group dev --no-install-project` exit0/39 resolved·35 installed, `uv lock --check --offline` exit0, F16/F17/F18 관련 8-file **154 PASS**(exit0/4.10초). 전용 `Dockerfile.web` build `--pull=false` exit0, image ID `sha256:29d8d41e08184a7baff8cf7cc29417034ae8cb02ed5ba0269dd82c5873d24611`, SHA label 일치. `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --rm` image의 crypto 46.0.7/F16/F18 실제 import exit0. 앞선 PyYAML 수집·F16 파일 누락 오류는 이 범위에서 해소됐다.
- 정리: checkout realpath exact·비 symlink·`daon:daon`/700·HEAD와 tracked clean, untracked `.f18-r3-product-test-temp/`만 확인. 전용 container는 `--rm`으로 부재, 정확한 image ID/tag만 제거했고 `/srv/anvil-wsl/f18-ops-r3-product-qa` exact 경로도 제거·잔류0. 기존 `local-postgres` Up 및 `anvil-web` Up/healthy 불변. 공용 Docker builder cache는 광범위 정리하지 않았다. 환경 오류 1회(첫 Windows SSH 명령의 PowerShell quoting ParserError, WSL 작업 미실행; 단순 명령 분리로 해결), 정식 Developer 실패보고 0회. 잔여 Important: R3 control QA SHA가 수정 가능한 progress/lease 값끼리만 결박되어 독립 앵커가 없다. 병합 전 독립 Git 앵커·변조 거부 테스트·재검증 필요. OIDC·object storage·network policy·PG18·backup/rollback·브라우저·세 image digest·Production `NOT_EXECUTED`, F-18 accepted=false, F-19 차단.
- 판정: `R3_LOCAL_VERIFIED_WSL_PENDING`, 담당 Main 어울. Developer exact5 `971a021f5f7da8bfcd10a0c285caf8f6f2bea2a9` clean commit을 승인 SSH alias의 단일 `codex/f18-wsl-ops` branch에 게시했다. Main 독립 Windows 8-file 154 PASS(exit0/65.62초), `.f18-r3-main-temp` exact 비-reparse 정리·잔류0, G-05 seq1525 PASS. 정식 Developer 실패보고 0회. R3에선 dev-only PyYAML 잠금과 Web image F16 모듈 단일 COPY만 변경했다.
- 사전 확인: `ssh WSL-server` 읽기 전용에서 신규 `/srv/anvil-wsl/f18-ops-r3-product-qa` 부재, 전용 `anvil-f18-runtime-qa:971a021f` image tag·`anvil-f18-runtime-check-971a021f` container 부재. 기존 `local-postgres` Up, `anvil-web` Up/healthy. 기존 `/srv/anvil-wsl/repo`, 서비스·DB·다른 image는 변경하지 않는다.
- 새 exact 임시 checkout 한 개만 `daon:daon` mode700으로 생성하고 승인 remote의 위 공개 SHA를 clean detached 수신한다. 내부 `.venv`와 `.f18-r3-product-test-temp`에 Python3.12 `uv sync --locked --group dev --no-install-project`, `uv lock --check --offline`, F16/F17/F18 8-file 154 회귀를 시스템 PYTHONPATH·별도 pip 우회 없이 실행한다. 전용 Web image를 기존 base로 `--pull=false`·위 SHA label로 빌드하고, 포트/DB/Secret 없이 `--network none --read-only --cap-drop ALL --rm` 일회성 컨테이너로 실제 crypto·F16·F18 import를 확인한다.
- 종료 시 checkout exact realpath·비 symlink·owner/mode·Git HEAD/dirty 및 image ID/tag·전용 container 이름을 확인하고 신규 checkout·image tag·잔여 전용 container만 제거해 잔류0을 확인한다. 공유 builder cache는 광범위하게 정리하지 않는다. 결과와 미검증 범위는 이 파일에 기록한다. 이 QA만으로 OIDC·object storage·network policy·PG18·rollback·브라우저·동일 3-image digest·Production은 PASS가 아니다. F-18 accepted=false, F-19 차단 유지.

# F-18 R3 runtime bundle·lease 게이트 보완 준비 / 2026-09-25

- R3 통제 code checkpoint `0f0ff0df5495edcec8a3e49cacea516e5d1de3c6`을 승인 Git SSH alias에 게시했다. WSL-server의 새 clean detached `/srv/anvil-wsl/f18-ops-r3-control-qa`·잠긴 Python3.12에서 R1/R2/R3·기존 관련 overlay **29 PASS**(exit0/0.73초); exact realpath·비-symlink·`daon:daon`/700·HEAD·untracked `.f18-r3-control-test-temp`만 확인 후 전용 checkout 삭제·잔류0. Windows 같은 29 PASS(exit0/13.70초), 전용 `.f18-r3-control-final-temp` exact 정리·잔류0. 첫 Windows 기본 pytest temp 시도는 OS `PermissionError` 5건(exit1), 범위 내 `--basetemp` 지정 재실행으로 해소했다. 통제 코드 QA 뒤에는 evidence만 수정하고 seq1525 R2 lease 회수/R3 exact5 lease 발급을 투영한다.
- 판정: `R3_CONTROL_PREPARING`, 담당 Main 어울, R2 제품 Task 정식 Developer 실패보고 0회. R2 잠긴 WSL QA에서 PyYAML 개발 의존성 및 Web image의 `deploy/wsl/f16_staging.py` 누락을 각각 정확한 수집/런타임 오류로 확인했다. R2 worker/write lease는 새 전환 event 전까지 유효하지만 R3 제품 exact5 mutation은 아직 없다. 기존 유일 `codex/f18-wsl-ops` branch 유지, Production `NOT_EXECUTED`, F-18 accepted=false, F-19 차단.
- 읽기 전용 통제 리뷰 Important 2건: R2 G-05가 seq1516~1520의 회수/재발급 event 의미를 검증하지 않고, ACTIVE lease의 만료·epoch·baseline도 거부하지 않았다. 실제 ledger는 R1 write→worker 회수 후 R2 발급 순서로 정상이고 당시 lease도 만료 전이었다. Main은 변조 event/만료 lease 거부 테스트 RED(2 FAIL)를 확인하고 R2 checker에 전체 전환 의미·시간/epoch/dispatch 결박, R3 checker에 후속 회수/발급 결박을 추가했다. 이전 성공 증거를 문제 없는 gate로 소급 승격하지 않는다.
- 새 R3 WorkInstruction은 정확히 `pyproject.toml`, `uv.lock`, `deploy/wsl/Dockerfile.web`, `tests/deploy/test_f18_wsl_dependencies.py`, F-18 WSL 보고서의 exact5만 제품 writer에게 허용한다. PyYAML은 F17 테스트에서만 import하므로 dev group에 한정하고, Web image에는 F18 import의 실제 종속 파일만 넣는다. 제품 파일은 현재 Main이 수정하지 않았다.
- 통제 QA 사전 자원 계획: `ssh WSL-server`의 새 exact `/srv/anvil-wsl/f18-ops-r3-control-qa` 부재·비-symlink 확인 후 `daon:daon`/700으로 생성한다. 승인 Git SSH 원격에 게시된 R3 통제 code SHA만 clean detached checkout하여 Python3.12 잠긴 dev 환경에서 신규 R2/R3와 기존 관련 overlay 테스트를 `.f18-r3-control-test-temp` 안에서 실행한다. 종료 전 realpath·비-symlink·owner/mode·HEAD·dirty 범위를 확인하고 새 QA checkout만 제거·잔류0을 증명한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, Docker/DB/브라우저는 변경하지 않는다.

# F-18 R2 잠긴 의존성 WSL 제품 QA 자원 계획 / 2026-09-25

- QA 판정: `PARTIAL_R2_LOCKED_WSL_VERIFIED`, F-18 전체 accepted=false. 게시 제품 SHA `eed74079d813b13f35dacbb0fad8dcb483b9283a`를 새 clean detached `/srv/anvil-wsl/f18-ops-r2-product-qa`로 수신했다. Python 3.12 `uv sync --locked --group dev --no-install-project` exit0/38 resolved·34 installed, `cryptography==46.0.7`와 F-16/F-18 import exit0, `uv lock --check --offline` exit0. 시스템 `PYTHONPATH` 또는 별도 `pip install` 우회는 없었다. F-16/F-18 핵심 7-file **140 PASS**(exit0/4.18초). 8-file 152 수집 시 `tests/deploy/test_f17_validation.py`의 `import yaml`이 `ModuleNotFoundError: yaml`로 exit1; PyYAML은 잠긴 개발 의존성에 미선언이므로 전체 PASS가 아니다.
- Docker Web runtime: 기존 python/node base image ID를 확인한 뒤 전용 `anvil-f18-crypto-qa:eed74079`를 `--pull=false`·정확한 SHA label로 build exit0, image ID `sha256:391a42464ff98f960934d9d94154744dbc188797729f6a39c13913622748cbef`. 포트·DB·network 없이 read-only 일회성 컨테이너의 crypto 46.0.7/F-16 import는 exit0. F-18 import는 `FileNotFoundError: /opt/anvil/deploy/wsl/f16_staging.py` exit1: `Dockerfile.web`이 `packages`와 `apps`만 복사하고 기존 promotion preflight가 동적으로 import하는 `deploy/wsl/f16_staging.py`를 복사하지 않는 별도 runtime bundle 결함이다. 이미지 build PASS를 F-18 runtime PASS로 승격하지 않는다.
- 종료 전 checkout exact realpath·비-symlink·`daon:daon`/700·HEAD·tracked clean·untracked `.f18-r2-product-test-temp`만 확인했다. 해당 checkout, 전용 image tag(ID 확인), `--rm` 컨테이너를 exact guard로 제거하고 잔류0. 기존 `local-postgres` Up, `anvil-web` Up/healthy 불변; 다른 DB/브라우저/서비스 변경0. Docker legacy builder cache는 공용 cache 범위라 삭제하지 않았고 잔여 층은 감사 미완료다. WSL 제품 QA에서 확인된 새 환경/구성 오류 2종(PyYAML 개발 의존성, Dockerfile 필수 파일 누락), 정식 Developer 실패보고 0회. 다음: R2 lease 회수, 통제 게이트의 과거 회수 event·lease 만료 fail-closed 보완과 R3 exact 제품 Task(Python dev dependency/runtime bundle) 발급 → 동일 게시 SHA 잠긴 WSL 152 PASS 및 F-18 image import 재검증. Production `NOT_EXECUTED`, F-19 차단.
- R2 exact5 제품 commit `eed74079d813b13f35dacbb0fad8dcb483b9283a`를 승인 Git SSH alias로 게시했다. Main 독립 Windows 8-file 152 PASS(exit0/77.75초), 전용 `.f18-r2-main-temp` exact 비-reparse 정리·잔류0, G-05 seq1520 PASS. 변경은 직접 `cryptography>=43,<47`/lock 46.0.7 및 새 3 package·Web runtime pin·선언 테스트·보고서 exact5다. 실제 WSL 잠긴 QA는 아직 미실행이다.
- WSL-server 제품 QA 사전 자원 계획: 새 exact checkout `/srv/anvil-wsl/f18-ops-r2-product-qa`가 없고 비-symlink인지 확인한 후 `daon:daon` mode700으로 만들고 승인 Git의 게시 SHA `eed74079d813b13f35dacbb0fad8dcb483b9283a`를 clean detached 수신한다. checkout 내부 `.venv`, `.f18-r2-product-test-temp`만 생성하여 Python 3.12 `uv sync --locked --group dev --no-install-project`와 crypto/F16/F18 8-file 회귀를 system `PYTHONPATH`·임시 설치 우회 없이 실행한다.
- Web runtime 이미지 QA는 전용 태그 `anvil-f18-crypto-qa:eed74079`, 전용 일회성 컨테이너 이름 `anvil-f18-crypto-check-eed74079`만 사용한다. 생성 전 두 이름·기존 python/node base image ID·기존 서비스 충돌을 읽기 전용 확인한다. checkout의 `deploy/wsl/Dockerfile.web`에서 `--pull=false`·Git SHA build arg로 image를 빌드하고, `--network none --rm` 일회성 Python crypto/F16/F18 import를 확인한다. 포트·DB·Secret·공유 network는 사용하지 않는다. image tag·container ID·checkout realpath/owner/HEAD를 확인한 뒤 해당 전용 컨테이너(남았을 때만), 전용 image tag와 checkout만 exact guard로 제거하며 builder cache 등 제거하지 못한 잔여는 명시한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, 다른 프로젝트 Docker/DB/브라우저는 변경하지 않는다. 원격 Git commit이 코드 복구 ref다.

# F-18 R2 잠긴 의존성 재현 지시 준비 / 2026-09-25

- R2 통제 code checkpoint `3b968e900b07d82f487090bf4de89748d057a221`을 승인 Git SSH alias에 게시했다. Windows Python 3.13 새·기존 overlay 24 PASS(exit0/15.88초), WSL-server 동일 SHA의 새 clean detached `/srv/anvil-wsl/f18-ops-r2-control-qa`·잠긴 Python 3.12 환경에서 같은 24 PASS(exit0/0.77초). 임시 checkout exact realpath·비-symlink·`daon:daon`/700·HEAD와 untracked `.f18-r2-control-test-temp`만 확인한 뒤 exact 삭제·잔류0. 첫 checkout 명령의 잘못 적은 축약 SHA는 레퍼런스 오류(exit1)였고, 로컬 full SHA 재확인 후 정확한 HEAD로 재실행해 해결했다. 제품·DB·Docker·브라우저·기존 서비스 변경 0. 통제 코드 QA 뒤에는 증거 파일만 변경하고 seq1520으로 R1 lease 회수/R2 lease 발급을 투영한다.
- 판정: `R2_CONTROL_PREPARING`, 담당 Main 어울, R1 정식 Developer 실패보고 0회. R1 `5fd4c10` 로컬 149 PASS/WSL provisional 149 PASS이나 잠긴 WSL venv는 `cryptography` 미선언으로 수집 실패했다. R1 lease는 새 전환 event 전까지 유효하고 R2 제품 경로 mutation은 없다. 기존 단일 `codex/f18-wsl-ops` branch를 유지한다.
- R2 새 WorkInstruction/Invocation과 통제 overlay는 R1 lease 회수→R2 exact5 lease 발급을 단일 seq1520 전환으로 결박한다. 제품 exact5는 `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `tests/deploy/test_f18_wsl_dependencies.py`, 기존 F-18 WSL 보고서다. 이 단계는 기능 범위·요구사항·중요 위험 변경이 아니라 승인된 F-18의 재현 가능 의존성 보완이다. Production `NOT_EXECUTED`, F-18 `accepted=false`, F-19 차단.
- 통제 QA 사전 자원 계획: `ssh WSL-server` 새 exact `/srv/anvil-wsl/f18-ops-r2-control-qa`가 없는지 확인한 후 `daon:daon` mode700으로 생성한다. 승인 Git SSH remote의 공개 R2 통제 code checkpoint만 clean detached checkout하여 Python 3.12 잠긴 dev 환경의 신규·기존 overlay 테스트를 `--basetemp=.f18-r2-control-test-temp`로 실행한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, 다른 Docker/DB/브라우저 자원은 변경하지 않는다. 종료 전 exact realpath·비-symlink·owner/mode·HEAD·dirty 범위를 확인한 뒤 이 새 경로만 삭제·잔류0을 검증한다. 실제 R2 제품 QA용 자원은 별도 사전 기록 후 생성한다.

# F-18 R1 WSL 격리 재현 자원 계획 / 2026-09-25

- 판정: R1 순수 preflight 코드의 독립 로컬 149 PASS(exit0/66.60초), 제품 commit `5fd4c1013fb4015929700874c61c09cea22519d2` push와 G-05 seq1515 PASS. 독립 리뷰 Important 2·Minor 1은 같은 exact3에서 서명된 계획/승인 대상 hash, target/run ID, UTC 유효기간(최대 5분), 고정 승인 remote 결박으로 보완했다. 실제 capability나 F-18 전체 인수는 아니다.
- WSL-server 게시 SHA의 새 `/srv/anvil-wsl/f18-ops-r1-qa` clean detached checkout에서 Python 3.12 `uv sync --locked --group dev --no-install-project` exit0/31 packages. 잠긴 환경의 `tests/deploy/test_f18_wsl_operational.py` 수집은 `ModuleNotFoundError: cryptography`로 exit1; `pyproject.toml`/`uv.lock`의 누락된 직접 의존성 문제로 판정한다(키 오류 아님). 기존 WSL system crypto 경로를 임시 `PYTHONPATH`로 결합한 같은 7-file 회귀는 149 PASS(exit0/4.30초)이나 **PROVISIONAL**이며 정식 잠긴 환경 PASS가 아니다. 이후 dependency declaration/lock/runtime requirements를 별도 exact lease에서 보완하고 동일 SHA에 대한 정식 WSL QA를 다시 수행한다.
- QA exact realpath `/srv/anvil-wsl/f18-ops-r1-qa`, 비-symlink, `daon:daon`/700, HEAD `5fd4c10`, tracked clean, untracked 최상위 `.f18-r1-pytest-temp`만 확인했다. 해당 전용 checkout만 guard 후 삭제·잔류0(exit0); 기존 `local-postgres` Up, `anvil-web` Up/healthy 유지. Docker/DB/브라우저와 기존 서비스 변경 0, Production `NOT_EXECUTED`, F-18 `accepted=false`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`. 정식 개발 실패보고 0회, 확인된 환경 오류 1종(의존성 누락). 다음 안전 행동은 R1 lease 회수·R2 의존성 exact scope 발급 후 lock 재현이다.
- 정확한 임시 대상은 `ssh WSL-server`의 신규 `/srv/anvil-wsl/f18-ops-r1-qa` 하나다. 생성 전 부재·비 symlink와 상위 경로를 확인하고 `daon:daon`, mode 700으로 생성한다. 승인 Git SSH remote의 게시 SHA `5fd4c1013fb4015929700874c61c09cea22519d2`를 clean detached checkout한다. 이 checkout 안의 `.venv`와 `.f18-r1-pytest-temp`만 사용한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`, Docker/DB/브라우저와 다른 프로젝트 자원은 변경하지 않는다.
- 이번 재현은 제품 순수 계약의 Linux 실행 확인이다. 현재 `uv.lock`에 `cryptography`가 선언되지 않아 잠긴 venv만으로는 F-16/F-18 import가 불가능할 수 있다. 실제 의존성 오류를 기록하고, 필요하면 기존 WSL system Python의 crypto를 임시 QA에만 결합해 결과를 `PROVISIONAL`로 구분한다. 정식 잠긴 환경 PASS는 별도 의존성 수정 이후에만 판정한다. 검증 후 exact realpath·비-symlink·owner/mode·HEAD·dirty 범위를 확인하고 새 대상만 제거·잔류0을 확인한다. 원격 commit은 복구 ref다.

# F-18 WSL 운영 유사 target 착수 준비 / 2026-09-25

- R1 통제 code checkpoint `b865ccb3b0a3f978b67b8c9e69b626a49b0874f8`을 승인 Git SSH alias로 게시하고 WSL-server 전용 `/srv/anvil-wsl/f18-ops-control-qa`에서 같은 HEAD를 detached checkout했다. Python 3.12 잠긴 dev 의존성으로 신규·기존 진행상태 계약 22 PASS(exit0/0.75초), Windows 동일 범위 22 PASS(exit0/13.68초). WSL checkout exact realpath·비-symlink·HEAD를 확인한 뒤 전용 경로 제거·잔류0. 기존 서비스·DB·Docker/브라우저 변경 0. 이 결과는 lease 통제 코드 QA이지 F-18 제품 runtime PASS가 아니다. 이후 code/authority는 수정하지 않고 evidence만 seq1515에 결박한다.
- R1 통제 계약 TDD: 신규 overlay import 부재 RED(exit1), 새 state/정확한 Git 경로 계약 2 PASS(exit0). `scripts/f18_wsl_ops_overlay.py`와 checker dispatcher는 기존 seq1512 mode를 보존하고, 새 seq1515에서 F-18 exact3 제품 write lease/worker fencing·WI hash·Production 미실행·F-19 차단을 검증하도록 작성했다. 제품 Task 1의 실제 PASS나 lease 발급은 아직 아니다. 코드 checkpoint QA는 새 `/srv/anvil-wsl/f18-ops-control-qa`에 승인 Git의 정확한 SHA를 detached 수신해 잠긴 Python 3.12 환경의 통제 테스트만 실행하고, 전용 checkout/venv/pytest temp를 realpath·비-symlink·HEAD 확인 후 제거할 계획이다. 기존 WSL 서비스·DB·Docker 변경은 0으로 유지한다.
- 판정: `WORK_INSTRUCTION_PREPARED`, 담당 Main 어울, 정식 실패보고 0회. 병합된 `main@69247977e4e51781401e45348fd3a290d8393c36`의 clean 격리 checkout에서 단일 `codex/f18-wsl-ops` branch를 생성했다. canonical seq1512의 `PREPARE_F18_WSL_OPS_WORK_INSTRUCTION`에 따라 `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`와 짧은 invocation을 작성했다. 현재 worker/write lease는 None이므로 제품 파일 mutation·WSL 자원 생성은 아직 없다.
- WSL-server 읽기 전용 inventory: 기존 `/srv/anvil-wsl/repo@a681e0c0a97bdb67956a0a50aa208bd38982a545` clean, `anvil-web` healthy, `local-postgres` Up. 새 `/srv/anvil-wsl/f18-ops-rehearsal`은 없고 후보 loopback 8310/8311/32770/8444 점유 출력은 없었다. 기존 root-owned repo의 Git safe.directory 오류는 명령별 read-only 예외로 확인했고 전역 설정 변경은 0. 기존 서비스/DB/타 프로젝트 자원 접근·변경 0. MinIO image는 로컬에 있으나 OIDC image는 확인 범위에서 없으며 재사용은 계획이 아닌 실제 runtime 테스트 때 별도 판단한다.
- F-17 PASS는 과거 Git/image에 한정한다. 이번 F-18은 새 정확한 Web/API/Worker digest, signed manifest, Test/Staging 재검증과 WSL 분리 target의 인증·object storage·network·PG18/rollback 실측이 필요하다. 현재 F-18 `PARTIAL`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`, ReleaseDecision `DEFER`를 유지한다.
- 다음: WorkInstruction hash·정본 SHA 점검 → canonical worker/write lease의 exact Task 경로와 G-05 transition 준비 → 로컬 TDD/commit/push → WSL-server exact Git 수신·격리 실측·정리. 계획 자원은 새 `/srv/anvil-wsl/f18-ops-rehearsal` checkout과 `anvil-f18-wsl-ops` Compose project/PG18 전용 DB·role이며 실행 직전 부재·포트·label 확인 후 생성, 검증/실패 직후 exact 대상을 제거해 잔류0을 기록한다.

# 신산님 지시 Local·WSL 운영 유사 검증 범위 revision / 2026-09-25

- 최종 코드 QA SHA `378b337ad2ddc6069d2eb5549edbc224a9319aaf`: seq1512 projection 첫 시도가 Windows Git 한글 경로 이스케이프 때문에 `WSL_SCOPE_GIT_INVALID`로 안전 중단(exit1). 실제 Git 재현 테스트 RED 후 UTF-8·`core.quotePath=false` 수정. 로컬 통제 20 PASS(exit0/14.68초), 게시한 같은 SHA를 WSL-server Python 3.12 새 격리 checkout `/srv/anvil-wsl/wsl-scope-revision-qa-r2`에서 20 PASS(exit0/0.68초). exact realpath·비-symlink·HEAD 검사 후 R2 제거·잔류0. 코드 QA 이후 증거 파일만 변경하며 F18 실제 운영 유사 환경 검증은 아직 미실행이다.
- 게시 code checkpoint `9da1060812020a0ea9b2b0aa837b3423324b7848`의 WSL-server 격리 Python 3.12 계약 검증 19 PASS(exit0/0.73초), 로컬 Windows 동일 대상 19 PASS(exit0/13.92초). WSL 전용 `/srv/anvil-wsl/wsl-scope-revision-qa`는 absent 확인→daon:daon/mode700 생성→같은 SHA detached checkout→검증 후 realpath·비-symlink·HEAD guard로 제거·잔류0. 첫 정리 guard의 Windows→SSH 인용 오류 1회(exit1)는 정확한 경로를 다시 확인한 명령으로 해소했다. 기존 WSL 서비스·DB·Docker·브라우저 변경 0. 코드 QA 이후에는 증거 파일만 변경한다.

- 판정: `REVISION_IN_PROGRESS`, 담당 Main 어울, 정식 Developer 실패보고 0회. main 기준 `c2c62cd011f47db8cbd524f97b3dae494a5672b5`에서 새 단일 branch `codex/wsl-operational-scope-plan`을 생성했다. 직전 F19 로컬·WSL 통합 PR #36 병합·branch/tag 정리와 merged-main G-05/542 PASS를 확인했다. 사용자 dirty root `D:\Project\Anvil`은 변경하지 않고 격리 checkout에서만 작업한다.
- 신산님의 직접 지시를 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`로 기록했다. 설계 v2.8, 작업계획 v1.7, 매트릭스 v1.5, 테스트계획 v1.6의 현재 필수 검증은 Local·WSL-server Test/Staging·WSL-server 격리 운영 유사 target이다. `ysna-server`·`shared-db`·`envil.sinsan.kr` 실측과 `RELEASED`는 이번 계획에서 제외하며 WSL 증거로 대체하지 않는다. F-18 전체 accepted=false, F-19 BLOCKED, Production NOT_EXECUTED 유지.
- 변경 파일: `AGENTS.md`, 4개 정본 문서, `docs/governance/ANVIL_OPERATING_RULES.md`, `docs/DEVELOPMENT_ENVIRONMENT.md`, 승인 기록, 범위 보고서, `scripts/wsl_scope_overlay.py`, `scripts/check_project_progress.py`, 해당 테스트, 이후 seq1512 progress/HANDOFF/event/digest/manifest. 신설 G-05 mode는 새 범위의 승인·hash·Git/QA/merge 관계와 이전 F18/F19 상태 유지 검증용이다.
- 로컬 단위 계약 RED는 새 overlay import 누락(exit1)이고 최소 구현 후 신규 scope+기존 F18 통제 19 PASS(exit0/26.50초), `git diff --check` exit0. pytest 전용 `.wsl-scope-local-temp`는 exact 비-reparse 경로 확인 후 제거·잔류0. 승인 기록의 7개 authority 파일 SHA-256이 실제 파일과 모두 일치한다. 기존 G-05는 변경 전 clean main에서 seq1511 PASS, 현재 새 branch/dirty에서는 최종 판정이 아니다. 전체 개발·테스트 계획의 F18~F20 실제 재검증은 아직 0이다.
- WSL-server QA 사전 자원 계획: 새 exact `/srv/anvil-wsl/wsl-scope-revision-qa`가 없는지 확인한 뒤, 승인 Git remote의 게시 code checkpoint를 detached checkout한다. 그 내부에서 Python 3.12 잠긴 dev dependency와 통제 테스트를 실행한다. 기존 WSL 서비스·DB·Docker·브라우저는 변경하지 않는다. checkout의 realpath·비-symlink·owner/mode·HEAD·dirty 범위를 확인하고 내부 venv/pytest temp를 포함한 이 새 경로만 제거해 잔류0을 확인한다. 원격 Git commit은 복구 ref다.
- 다음: 정본·매트릭스 의미 diff와 hash 감사 → 통제 테스트·Git graph 검증 → code checkpoint 선별 commit/push → WSL-server 동일 SHA QA → seq1512 evidence-only 결박/G-05 → PR Broker 병합/merged-main smoke/branch 정리. 실제 F18 WSL 운영 유사 검증 착수는 이 범위 revision 통합 뒤로 둔다.

# F-18/F-19 로컬·WSL 통합 게이트 보완 / 2026-09-25

- R2 코드 QA: 파서 수정 게시 commit `dcac6d6ff2a9dc750a5d5083963a60d1d2972b02`, Windows Python 3.13 542 PASS(exit0/17.89초, upstream warning 1), WSL-server Python 3.12 잠긴 격리 venv 동일 542 PASS(exit0/5.15초). R2 exact checkout `/srv/anvil-wsl/f19-integration-qa-r2` realpath/비-symlink/daon:daon/mode700/HEAD 확인, pytest temp만 untracked·venv ignored 확인 후 제거·잔류0. QA 뒤 코드 변경 없음. 이 SHA만 canonical QA binding으로 사용한다.
- QA 실측: 게시 code checkpoint `03ea4c3a531886da53c4be7405c049f78f7187fe`; Windows Python 3.13 게이트+Provider/보안 대상 541 PASS(exit0/18.96초, upstream multipart 경고 1), WSL-server Python 3.12 잠긴 격리 개발 환경 동일 541 PASS(exit0/4.81초). WSL은 Git remote에서 정확한 SHA를 받아 detached checkout했다. WSL 임시 `/srv/anvil-wsl/f19-integration-qa-e2f3d99`의 realpath exact/비-symlink/daon:daon/mode700/HEAD와 untracked pytest temp만 확인 후 제거·잔류0. 첫 정리 guard 명령은 Windows 셸의 `$()` 보간 때문에 exit1이었고, 사전 검증한 exact 경로를 별도 명령으로 정리해 exit0·잔류0을 확인했다. 기존 DB·Docker·서비스·브라우저·운영 서버 변경 0. 정식 제품 실패보고 0회.
- 후속 projection 시도 1회는 `F18_F19_SUCCESSOR_DIRTY_INVALID`로 fail-closed했다. 원인은 `git status --porcelain` 첫 행의 leading status 공백을 전체 `.strip()`이 제거해 경로 파싱이 어긋난 것이며, 정본 파일 mutation은 이 오류 전에 0이다. 파서 회귀 테스트 RED 후 raw porcelain 파서로 수정했으므로 새 code commit을 다시 게시하고 동일 WSL QA를 반복한 뒤에만 QA SHA를 결박한다. 이전 QA SHA를 수정 코드의 통과 증거로 재사용하지 않는다.
- R2 WSL QA 사전 자원 계획: 새 exact `/srv/anvil-wsl/f19-integration-qa-r2` 부재를 확인한 뒤, 게시 `dcac6d6`만 승인 Git remote에서 detached 수신한다. 해당 checkout 내부 `.venv`를 WSL Python 3.12·잠긴 dev dependency로 만들고 게이트+Provider/보안 542건을 pytest temp 내부에 실행한다. 기존 서비스·DB·Docker·브라우저는 변경하지 않는다. realpath·비-symlink·owner·mode·HEAD·dirty 확인 후 exact 새 checkout만 제거해 잔류0을 확인한다.
- 판정: `CODE_CHECKPOINT_PREPARED`, F-18 전체 `accepted=false`, F-19 정식 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`. 담당 Main 어울, 동일 정식 Developer 실패보고 0회. 신산님 지정 범위인 로컬 개발→Git push→WSL-server Git 수신·테스트만 수행하고 운영/ysna-server는 제외한다.
- 현재 단일 branch `codex/f19-test-dependency`, base `development/main@e2f3d994b95c2e60f6a3e597101c30daa25089b4`. 후속 integration mode는 exact base/branch/upstream/remote, 변경 경로, WSL QA SHA 이후 evidence-only, 2-parent merge 첫 부모와 tree 일치 조건을 fail-closed로 확인한다. 기존 F18 mode는 보존한다. 계획 `docs/work_orders/F-18_F-19_LOCAL_INTEGRATION_PLAN.md`.
- TDD: 신규 계약 테스트 RED 2건(`TypeError`, `AttributeError`) 후 overlay·dispatcher 구현. Windows 단위·실제 임시 Git graph 16 PASS(exit0/13.60초), `git diff --check` exit0. 임시 pytest 경로 `.f19-gate-pytest-temp`는 exact 경로/비-reparse 확인 후 제거·잔류0. 아직 code checkpoint push·WSL 재검증·G-05·PR·병합은 미완료다.
- WSL-server QA 사전 자원 계획: 새 격리 `/srv/anvil-wsl/f19-integration-qa-e2f3d99` 하나에 승인 Git remote에서 게시된 정확한 code checkpoint를 detached checkout한다. 전용 `.venv`와 pytest temp는 이 경로 안에만 생성한다. 기존 서비스/DB/Docker/브라우저는 변경하지 않는다. 정확한 realpath·비-symlink·owner·HEAD·dirty 범위를 확인하고 QA 후 이 새 checkout만 제거해 잔류 0을 확인한다. 원격 Git commit이 복구 ref다.
- 다음: 코드 checkpoint 선별 commit/push → WSL-server 동일 SHA 대상 회귀 → QA SHA를 seq1511 canonical evidence에 결박 → 브랜치 G-05/review → PR Broker/main 병합/merged-main smoke/브랜치 정리. 실측 전 PASS나 전체 인수로 표시하지 않는다.

# F-18 병합 후 Provider·보안 회귀 준비 / 2026-09-24

- 판정: `PREPARED_UNMERGED`, 담당 Main 어울, 정식 Developer 실패보고 0회. F18 로컬·WSL 개발분은 PR #35로 `main@e2f3d994b95c2e60f6a3e597101c30daa25089b4`에 병합되어 merged-main G-05와 관련 124 PASS를 확인하고 기존 작업 브랜치/worktree를 삭제했다. F18 전체 `accepted=false`, Production `NOT_EXECUTED`, F19 정식 착수 `BLOCKED_PENDING_F18_ACCEPTANCE`는 유지한다.
- 신산님 지정 흐름에 따라 로컬에서 `codex/f19-test-dependency`를 `main`에서 만들고 `pyproject.toml`·`uv.lock`의 개발용 `httpx`/`httpx2` 선언 및 `packages/provider_catalog/service.py`의 IPv4-mapped IPv6 검사를 수정했다. 로컬 commit `80665863c798ef0c56b7a95cbc9ac7242328d63a`, `609f071391ef84f54cb6870668c15367d89fc937`를 승인 SSH alias로 push한 뒤 `ssh WSL-server`가 동일 최종 commit을 Git fetch/detached checkout으로 받았다. 변경 사유·전후 diff와 검증 세부는 `docs/04_test_reports/F-19_LOCAL_PROVIDER_SECURITY_PRECHECK_REPORT.md`에 기록한다.
- 검증: Windows 잠긴 격리 개발 환경의 Provider/Settings/Web security/secret 대상 525 PASS(exit 0), WSL-server Python 3.12의 정확한 게시 commit에서 같은 범위 525 PASS(exit 0). 최초 WSL 기본 Python 수집 오류 6건은 SQLAlchemy/FastAPI 미설치, 격리 venv 첫 재시도 수집 오류 3건은 `httpx` 미선언이었다. 의존성 보완 뒤 기존 테스트의 IPv4-mapped loopback/metadata 2건이 WSL에서 RED였고, Python 3.12의 `ipaddress` 분류 차이를 확인해 effective IPv4 검사를 추가한 뒤 GREEN 525 PASS. 전체 로컬 pytest는 별개의 잠금 개발 의존성 `yaml` 누락으로 수집 오류 1건(exit 1); 전체 PASS가 아니다. WSL 격리 checkout·venv는 exact 경로/소유권/HEAD 확인 후 제거하여 잔류 0.
- 통제 예외: canonical G-05는 현재 F18 전용 branch/merge만 허용하여 이 후속 브랜치에서 `F18_LOCAL_START_GIT_INVALID`(exit 1)이다. 작업현황·신규 보고서 기록 뒤에는 F18 frozen manifest의 기존 raw checksum과도 달라 `F18_LOCAL_RAW_CHECKSUM_INVALID`가 함께 발생한다. 이를 F19 합격이나 PR 병합으로 우회하지 않는다. 새 브랜치는 만들지 않고 현재 게시된 단일 브랜치를 보존한다. 다음 조치는 F18 인수 선행조건과 G-05의 후속 maintenance 경계를 정본 계획에 맞게 정리한 뒤, 필수 gate 재검증→PR→main 병합→브랜치 삭제 순서다. 운영/`ysna-server`는 접근·변경하지 않았다.

# F-18 Task 5 read-only signed CLI 지시 개정 / 2026-09-24

- F18 병합 게이트 R2 게시 code checkpoint/WSL QA: 로컬 Windows 관련 7-file 124 PASS 후 `4a8f8a999d70184a28d455659125081317cf9aa8`을 승인 SSH alias로 push했다. `ssh WSL-server` 새 `/srv/anvil-wsl/f18-merge-gate-r2`에서 이 정확한 commit clean detached checkout의 F18 control+F16/F18 6-file **112 PASS**(exit0/4.76초). 정리 전 exact realpath·비-symlink·daon:daon mode700·HEAD·pytest temp만 untracked 확인 후 exact checkout 제거·잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변이다. canonical `repository.local_wsl_qa_head`에 이 SHA를 결박하고 이후 변경은 작업현황·보고서·checksum 등 evidence-only로 제한한다. 신산님 직접 지시에 따른 다음 안전 행동은 이 로컬·WSL 개발분만 PR 통합하는 것이며, F18 운영 전체 accepted=false/F19 전체 차단·운영 작업 제외 상태는 그대로다.
- F18 병합 게이트 독립 review 보완/R2 WSL QA 계획: read-only reviewer가 Important 2건(기준 main 이후 범위 밖 변경을 merge tree가 되돌리는 공백, WSL QA 뒤 code commit 허용)을 발견했다. Main은 첫 부모가 `BASE`와 정확히 같은 경우만 허용하고, `local_wsl_qa_head` 이후 merge 두 번째 부모까지의 변경을 evidence-only 경로로 제한했다. 실제 임시 Git graph 정상/범위 밖 main drift/QA 뒤 code change 3사례와 기존 순수 계약 합계 13 PASS(exit0/7.53초), 전용 `.f18-git-graph-test-temp` exact 비-reparse 정리·잔류0. 보완 후 Windows F16/F17/F18+통제 7-file 회귀 124 PASS(exit0/72.68초), 전용 `.f18-merge-win-r2-temp` exact 비-reparse 제거·잔류0. 이 단계는 아직 최종 WSL QA·G-05·병합 PASS가 아니다. 새 `WSL-server` exact `/srv/anvil-wsl/f18-merge-gate-r2` 부재와 기존 `local-postgres` Up·`anvil-web` Up/healthy를 확인했다. 로컬 code checkpoint를 push한 뒤 승인 Git remote에서 이 새 경로에 clean detached 수신, F18 control+F16/F18 테스트 실행, exact realpath/비-symlink/owner/mode/HEAD·dirty 확인 후 checkout만 제거하고 잔류0을 확인한다. DB·Docker·브라우저·기존 서비스 변경은 없다.
- F18 로컬 개발분 병합 게이트 QA: Windows `tests/tooling/test_f18_progress_overlay.py` 포함 F16/F17/F18 7-file 관련 회귀 120 PASS(exit0/68.93초), 전용 `.f18-merge-win-pytest-temp` exact 비-reparse 확인 후 제거·잔류0. 게시 commit `daf483c7194843df192f4e369114c1509908e67c`를 `ssh WSL-server` 새 `/srv/anvil-wsl/f18-merge-gate-qa`에 승인 Git remote에서 clean detached checkout한 뒤 F18 통제+F16/F18 6-file 108 PASS(exit0/4.32초). 정리 전 realpath exact/비-symlink/daon:daon mode700/HEAD와 pytest temp만 untracked임을 확인했고 새 checkout만 제거·잔류0, 기존 `local-postgres` Up·`anvil-web` Up/healthy 불변이다. 테스트는 로컬 개발분과 WSL 재현만 증명하며 실제 merged-main G-05, Production 및 F18 전체 acceptance는 미검증이다.
- F18 개발분 병합 게이트 QA 자원 계획(생성 전): `ssh WSL-server`에서 새 exact `/srv/anvil-wsl/f18-merge-gate-qa` 부재를 확인했다. 기존 `local-postgres` Up, `anvil-web` Up/healthy다. 로컬에서 검증·push한 같은 F18 브랜치의 정확한 commit을 승인 SSH remote에서 새 격리 checkout으로 Git 수신해 clean detached HEAD에서 F18 통제·F16/F18 회귀만 실행한다. 기존 `/srv/anvil-wsl/repo`·DB·Docker·브라우저·서비스는 변경하지 않는다. Python bytecode/cache를 억제하고 pytest 임시 파일은 checkout 내부 exact 경로로 제한한다. 종료 전 realpath·비-symlink·owner·mode·HEAD·dirty 범위를 확인한 뒤 새 exact checkout만 제거하고 잔류0과 기존 서비스 불변을 확인한다. source는 게시된 Git commit으로 복구 가능하다.
- 신산님 2026-09-24 직접 범위 재확인: 개발은 로컬 Windows에서 수행하고 Git push 후 `ssh WSL-server`가 게시된 동일 commit을 Git으로 받아 테스트한다. 로컬 WSL 인스턴스는 대상이 아니며, `ysna-server`와 운영 관련 구현·배포·실측은 현재 Main 작업범위에서 제외한다. F18 운영 기준을 합격으로 바꾸지 않고 `accepted=false`로 보존한다. 현재 F18 브랜치의 로컬·WSL 개발 산출물만 검증·통합한 뒤 브랜치를 정리하는 경계를 준비한다. 이는 신산님의 기존 순차 브랜치 지시를 지키기 위한 개발분 통합이며 F19 전체 합격이나 Production 준비 판정이 아니다.
- F17 artifact 복구 후보 추가 조사: `ssh WSL-server`의 `/srv/anvil-wsl` 범위에서 `sudo -n find`로 깊이 5 이내의 tar/tar.gz/OCI/SIF 이미지 아카이브 및 image manifest 후보 파일명을 읽기 전용 조회한 결과 0건이다. 일반 `find`는 기존 `control`과 과거 failed checkout의 권한 거부로 exit1이어서, 동일 범위 `sudo` 읽기 전용 재조회 exit0으로 확인했다. `docker ps -a --no-trunc`에도 F17 Web/API/Worker 이미지 ID를 참조하는 실행·중지 컨테이너가 없다. 검색 범위 밖 보존물과 외부 registry의 부재를 증명하지는 않는다. F18 accepted=false/F19 차단 및 Production 담당자 증거 필요 상태는 유지한다.
- 기존 immutable image 전달 경로 감사: `.github/workflows`에는 PR Broker workflow만 있으며 Anvil 이미지를 registry에 push하는 작업은 없다. `deploy/wsl`·`docs`의 배포 자료에도 F17 두 image ID의 immutable registry ref나 `docker push`/OCI artifact 게시 절차가 없다. WSL `docker images`의 현재 Anvil 관련 태그는 F17 두 ID와 불일치하며 출력된 digest는 `<none>`이었다. 이 조사는 저장소와 현재 WSL Docker에 한정되며 외부 registry 전체의 부재를 증명하지 않는다. 따라서 새 이미지 보존 위치·인증·전달·정리 주기 결정 없이 WSL 새 RC를 만들어 임시 이미지를 곧바로 지우는 것은 AV-OPS-016을 전진시키지 못한다. 권장 경로는 Production 담당자가 기존 승인된 immutable OCI ref를 제공하는 것이고, 없다면 신규 registry/서명키/외부 push는 중요 보안·운영·비용 경계로 별도 결정 후 추진한다.
- F18 동일 artifact 승격 경계 실측: `ssh WSL-server` 읽기 전용 `docker image inspect`에서 F17 보고서의 Web image ID `sha256:5f02bdbbc2e26844e07f3d34208162bdb9a73c82f04670ae223e331281f44a32`와 API/Worker runtime image ID `sha256:f6c481954d3ec9013b4974aa9514c8646b06616ffbc84cc4d645c7a5d4432a82`가 모두 `IMAGE_ABSENT`였다. 현재 Docker의 Anvil 이미지 태그 목록에는 이 ID에 해당하는 보존 태그·registry digest가 없으며, F17 machine-readable EvidenceManifest는 runtime digest만 담고 Web digest는 F17 보고서에만 있다. 따라서 기존 F17 PASS와 합성 CLI PASS로 AV-OPS-016/020의 동일 배포 artifact를 확보했다고 주장할 수 없다. 다른 기존 이미지를 임의 대체하거나 같은 commit을 재빌드해 기존 digest와 동일하다고 가정하지 않는다. 다음 안전 행동은 승인된 immutable OCI registry/artifact 보존·전달 방법과 Production 담당자 증거를 확정한 뒤 WSL에서 새 3-service RC를 실제 검증하고 서명 ReleaseManifest에 결박하는 것이다. 이는 외부 artifact 보존/운영 경계이므로 Main은 임의 registry push·장기 이미지 보존·ysna-server 접근을 하지 않는다. F18 accepted=false/F19 차단.
- R3 최종 QA 실측: 공개 테스트 commit `89dbc26` clean detached WSL-server `/srv/anvil-wsl/f18-local-qa-r5`에서 CLI+F16/F18 5-file 99 PASS(exit0/4.70초); exact 경로/비-symlink/daon:daon/mode700/HEAD·pytest temp만 dirty 확인 후 `sudo rm -rf` exact 디렉터리 exit0, 잔류0. Windows Main focused 21 PASS, Developer 6-file 111 PASS. 기존 서비스·DB·Docker·Production 변경 0, 정식 실패 0. F18 전체 accepted=false/F19 차단.
- R3 독립 읽기 전용 코드 리뷰: Critical/Important 0, Minor 1(독립 expected observation 불일치 CLI 결합 테스트 부재), R3 checkpoint 가능·F18 acceptance 아님. Developer가 signed manifest 불변 상태에서 Web image/lockfile observed hash만 바꾼 2개 차단 테스트를 `89dbc26`에 보강했다. 기존 코드에서 바로 GREEN, 6-file 111 PASS(exit0), Main CLI focused 21 PASS(exit0/31.03초), 전용 `.f18-r3-main-final-temp` exact cleanup 잔류0. `python -m` 실제 성공 경로는 테스트 fixture의 임시 SSH remap 한계로 미검증이며 CLI 내부 main() 성공과 module 실패 경로만 검증했다.
- WSL 최종 QA 사전 자원 계획(생성 전 기록): 새 exact `/srv/anvil-wsl/f18-local-qa-r5`에 공개 최종 테스트 commit `89dbc268b593b1afe2efee7b0771b3947d948877`만 clean detached checkout하고 CLI+F16/F18 5파일을 `--basetemp=.f18-r5-pytest-temp`로 재실행한다. 기존 서비스·DB·Docker·브라우저·Production에는 접촉하지 않는다. exact realpath/비-symlink/daon:daon/mode700/HEAD와 pytest 임시물만 dirty임을 확인한 후 해당 새 디렉터리만 `sudo rm -rf`로 제거하고 잔류를 확인한다.
- Main R3 독립 로컬 검증: Developer exact3 commit `96b6f17bfe7aa716bd1bb283af5ee3f3d8eae922`를 공개 branch에 게시했다. Windows 6-file F16/F17/F18 독립 109 PASS(exit0, 64.56초), diff-check exit0, 전용 `.f18-r3-main-review-temp` exact path/비-reparse 확인 후 제거·잔류0. CLI는 Production `READY`나 실제 배포를 수행하지 않는다.
- WSL 격리 QA 사전 자원 계획(생성 전 기록): `ssh WSL-server`에서 새 exact `/srv/anvil-wsl/f18-local-qa-r4`만 생성하여 공개 commit `96b6f17bfe7aa716bd1bb283af5ee3f3d8eae922`를 clean detached checkout한다. 내부 pytest `--basetemp=.f18-r4-pytest-temp`로 CLI+F16/F18 관련 5파일을 실행한다. 기존 `/srv/anvil-wsl/repo`, 서비스·DB·Docker·브라우저·Production에는 접촉하지 않는다. 종료 후 realpath exact/비-symlink/소유권/HEAD/dirty 범위를 확인해 임시 내용물을 제거하고, root 소유 parent 아래 빈 exact 디렉터리만 `sudo rmdir`로 정리한다. DB/role/container/venv는 생성하지 않는다.
- 판정: F18 `PARTIAL_LOCAL_WSL_VERIFIED`, `accepted=false`, F19 차단; R2 seq1504 lease 회수 상태에서 동일 branch의 Task 5를 승인된 F18 local/WSL 범위로 분리한다. 새 CLI는 signed manifest·독립 expected observations·approval subject·WSL artifact·기존 checkout Git guard를 묶되 Production capability/실배포는 판정하지 않는다. 로컬 `deploy/ysna` legacy 경로는 수정하지 않는다.
- Main control 변경: F18 계획/호출 지시, R3 overlay/G-05 dispatcher/테스트, 이 WORK_STATUS. 새 exact3 제품 범위는 `production_preflight_cli.py`, 해당 테스트, F18 보고서. 정식 제품 실패 0회. Overlay 테스트는 의도한 RED(import 없음) 뒤 8 PASS, diff-check exit0. 다음: control 게시→R3 canonical lease·G-05→Developer TDD→Main Windows/WSL 독립 QA·임시 자원 정리→독립 review→lease 회수/checkpoint. Production 증거 없으면 F18 merge/acceptance·F19 착수 금지.

# F-18 Task 4 Git guard 지시 개정 / 2026-09-24

- 후속 Main 읽기 전용 adapter gap 감사: 정본 F18(`Anvil_작업계획서_v1.md` F-18, 설계서 49.11~49.12, AV-OPS-016/020/021)은 `envil.sinsan.kr`의 Web/API/Worker 동일 서명 ReleaseManifest·WSL 합격 digest·DeployApprovalSubject·PG18/secret/network 경계를 요구한다. 현재 로컬 `deploy/ysna/deploy.sh`/`manifest-guard.sh`/`compose.production.yml`은 C21 `anvil-web` 단일 런타임, 레거시 `deploy/ysna/ReleaseManifest.json`, `anvil.sinsan.kr`/origin main 도달성 검증 경로이며 F16 서명 manifest나 F18 `validate_existing_checkout` 호출은 없다. 따라서 로컬 preflight 90 PASS·WSL 78 PASS를 실제 Production adapter 또는 AV-OPS-016/020/021 PASS로 승격하지 않는다. 차기 안전 구현은 기존 서버 실행 없이 로컬 새 adapter의 서명/approval/evidence/target capability 계약을 정본과 맞춰 분리하고 테스트하는 것이다. 기존 legacy 배포 경로를 이 근거만으로 직접 교체하거나 ysna-server에 접속하지 않는다.
- R2 독립 읽기 전용 코드 리뷰: base `4ff5af0`→제품 `1c2c5df`와 보고서 `7bdc7d8` 확인, Critical/Important/Minor 각 0건, R2 checkpoint 가능. 실제 SSH 정책과 Production/ysna·DB/OIDC/storage/network/배포는 리뷰·실측 범위 밖이므로 F18 전체 인수 증거로 쓰지 않는다. 최종 canonical seq1504 `PAUSED`, worker/write lease 회수, G-05 PASS, F19 차단을 유지한다.
- Main WSL R3 실측: 공개 `1c2c5df` clean detached 격리 checkout에서 F18/F16 4-file 78 PASS(exit0, 1.92초). 기존 서비스·DB·Docker·운영 서버 변경 0. 정리 오류 1회: 첫 `rm -rf`는 내용물 제거 후 상위 `/srv/anvil-wsl` 쓰기 권한 때문에 빈 root 제거에서 exit1; exact realpath/비-symlink/daon:daon/빈 상태 확인 후 `sudo rmdir` exit0, 잔류 0. 정식 제품 실패 0회. Developer가 R2 보고서를 `7bdc7d8`로 보완했다. Production 증거 미확보이므로 F18 accepted=false/F19 차단.
- 현재 R2 seq1501 `ACTIVE`, exact3 worker/write lease 유효. Developer commit `1c2c5df`는 공개 branch에 게시됐고 Windows Main 독립 90 PASS·diff-check exit0, 임시 pytest 경로 제거/잔류0이다. R2 lease는 Main의 WSL QA와 최종 checkpoint 검토 뒤 회수한다.
- Main WSL 격리 QA 사전 자원 계획(생성 전 기록): 대상은 `ssh WSL-server`의 새 exact `/srv/anvil-wsl/f18-local-qa-r3` 하나이며, 공개 commit `1c2c5df72cb217c6507dcbd5021f397e108ccd78`만 clean detached checkout으로 검증한다. 내부 pytest `--basetemp=.f18-r3-pytest-temp`를 쓰고 기존 `/srv/anvil-wsl/repo`, 서비스·DB·Docker·브라우저·운영 서버에는 접촉하지 않는다. QA 뒤 realpath exact 일치·비 symlink·소유권을 확인해 이 디렉터리와 내부 임시물만 제거하고 잔류를 확인한다. 새 DB/role/container/venv는 생성하지 않는다.
- 판정: F-18 `PARTIAL_LOCAL_WSL_VERIFIED`, `accepted=false`; F-19 차단, 기존 R1 lease 회수(seq1498), 현재 제품 writer 없음. `codex/f18-local-wsl-preflight` 단일 branch에서 read-only existing-checkout Git guard를 Task 4로 분리했다. 기능 범위·요구사항·중요 위험의 확장이 아닌 기존 F-18 deployment adapter의 로컬 사전검증 구현이다.
- 변경 예정: Main control 파일(작업지시·실행 지시·overlay·G-05 dispatcher·overlay 테스트·WORK_STATUS)을 공개 checkpoint로 push한 뒤 새 R2 exact3 lease를 발행한다. Developer만 `promotion_preflight.py`, 해당 test, F-18 보고서를 쓴다. 정식 실패 0회; Python 기본 명령 부재 1회와 bundled Python pytest 부재 1회는 `C:\Users\cyhuh\anaconda3\python.exe`로 해결했다. 새 overlay RED(import 누락) 후 6 PASS.
- 미검증: 실제 Web/API/Worker digest 결박 서명 manifest, Production checkout·서비스·DB·OIDC·object storage·network 및 사용자 인수는 모두 NOT_EXECUTED. `ysna-server`는 접근하지 않는다. 다음: control commit/push → R2 G-05 → Developer TDD → WSL 격리 QA와 정확한 임시 자원 정리 → R2 checkpoint.

# F-18 Local/WSL preflight start / 2026-09-24

- 판정: ACTIVE, F-18 전체 합격 아님. 신산님 최신 직접 지시에 따라 작업 대상은 로컬과 WSL-server뿐이며 ysna-server 접근·변경·검증은 금지한다. F-19 및 U Gate는 F-18 최종 미충족으로 대기한다.
- Main 기준 main b6b3ff0, F-17 PR #34 merged-main G-05 PASS/관련 19 PASS·2 opt-in SKIP, F-17 작업 branch/worktree 삭제. 단일 branch codex/f18-local-wsl-preflight, Developer exact5 lease, 정식 실패 0회.
- 현재 작업은 DeployApprovalSubject와 WSL→target artifact mismatch의 로컬 순수 계약 및 WSL 격리 재현뿐이다. Production checkout, shared-db, OIDC/object storage/network, envil.sinsan.kr, 실제 DeployApproval/ReleaseDecision은 NOT_EXECUTED.
- 다음: G-05 start gate→Developer TDD exact5→Main 로컬/WSL 독립 검증→미검증 경계와 서버 담당자 인수 증거를 기록. F-18 전체 acceptance·PR merge·후속 branch는 수행하지 않는다.

# F-17 WSL PG15/PG18 범위 인수

- 판정: `ACCEPTED_F17_PG15_PG18_SCOPED`; seq1491. 동일 Git 7083e2a·runtime image f6c481의 PG15/PG18 실측과 AV-OPS-015/025 ProductValidation SUITABLE. 브라우저 dashboard same-origin만 PASS, Web-only auth/전체 UI/운영 배포는 미검증.
- Main이 worker/write lease를 모두 회수했다. **WSL F17 runtime/QA 자원 잔류 0**. Windows 로컬 Web `node_modules`·dist와 F17 `.pyc`는 제거했으나 pytest basetemp exact 5개는 OS `Access denied`로 남아 있다(실행 오류 1, 제품 실패 0). ACL/소유권은 변경하지 않았고 전역 cleanup PASS로 승격하지 않는다. 다음은 F17 PR 병합·merged-main smoke·branch/worktree 정리이며 그 전 F18 branch 금지.

# F-17 WSL 실제 기능·격리 PG18 RC 착수

- 2026-09-24 F-16 merged-main 보완 검증: Anaconda Python `C:\Users\cyhuh\anaconda3\python.exe`를 확인해 main merge `3460d9768b039568022fd43e24577cc0e2402dea`에서 `tests/tooling/test_f16_progress_overlay.py` 및 F-16 deploy focused 3파일을 실행, exit0/52 PASS(26.78초). GUID 전용 pytest basetemp를 정확한 임시 경로 검증 후 제거했으며 cacheprovider를 비활성화했다. 이전 번들 Python의 pytest 부재는 도구 선택 문제였고 merged-main focused 미검증을 여기서 해소했다. F-17 PG15/PG18 E2E PASS로 전용하지 않는다.
- 2026-09-24 F-17 생성 전 읽기 전용 WSL inventory: 기존 `local-postgres`는 image ID `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e`의 PG15이며 5432가 IPv4 `0.0.0.0`/IPv6 `::`에 bind된다. 기존 `anvil` DB 소유자는 `anvil_app`, role은 LOGIN=true/SUPERUSER=false/CREATEDB=false/CREATEROLE=false/REPLICATION=false/BYPASSRLS=false다. HBA는 loopback trust 및 일반 host scram-sha-256으로 확인했다. 기존 DB/role에는 mutation 0; F-17은 고유 임시 DB/role로 분리한다. 격리 PG18 후보 image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`가 이미 존재한다. F-17 새 checkout/container/DB/role 생성은 아직 0.
- F-16 PR Broker 요청 태그 첫 게시에서 태그가 신뢰 main 대신 작업 HEAD를 가리킨 실수 1회를 Main이 발견했다. Broker가 fail-closed로 병합하지 않았고 그 정확한 요청 태그만 삭제·main 대상 재생성한 뒤 PR #32로 정상 병합했다. 브랜치/제품/기존 데이터 영향 0. 원인: 태그 이름의 HEAD SHA와 태그 대상 main SHA를 혼동. 후속 요청은 태그 대상 `development/main`을 push 전에 직접 검증한다.
- 판정: `ACTIVE`. F-16 PR #32 merged main 3460d97, feature ancestry/tree·merged-main G-05 PASS, F-16 remote/local branch 및 worktree 삭제 확인. F-17 branch는 clean main에서 생성. 담당 Main 어울 통제, developer-primary-f17-r1 exact5 write lease, 정식 FAILURE_REPORT 0회.
- F-17은 기존 local-postgres PG15의 전용 임시 Anvil DB/비-superuser role 일반 경로와 별도 PG18 격리 instance를 구분한다. 전역 bind/pg_hba/network나 기존 DB·role은 변경하지 않고 WSL host loopback/SSH tunnel만 쓴다. WSL 실제 자원은 생성 전 exact inventory·cleanup 방법을 기록한다.
- F-14 과거 PG15/18 백업·복원 실측 및 F-16 staging/browser PASS를 F-17 새 exact Git/image E2E로 재사용하지 않는다. 현재 ProductValidation 공개 API는 501 미결선이므로 실제 API·DB 관측에 결박된 criterion별 검증 기록을 F-17 범위로 두며 API/DB 지속화 PASS는 주장하지 않는다.
- 다음: G-05 start gate→Developer TDD exact5→Main 독립 검토→WSL PG15 일반/PG18 격리 동일 E2E·migration/backup/restore/rollback·브라우저/ProductValidation 실측→정확한 자원 정리. ysna/Production·사용자 인수 미실행.

# F-16 격리 WSL Test/Staging 인수

- 판정: `ACCEPTED_ISOLATED_WSL_STAGING`. R2 제품 HEAD 383bd8cb, Windows focused 48 PASS 각 2회, WSL focused 48 PASS, published exact Git tag/서명 ReleaseManifest 사전·사후 검증 PASS. PG15 migration0016, app 최소권한·DDL 거부, Web/API/Worker·재시작 health, Chromium 1920/390 same-origin Network·오류/누출 0을 실측했다. R1의 superuser 결함은 R2 분리 role로 수정·재검증했다. 정식 Developer FAILURE_REPORT 0회.
- R2 전용 Compose 서비스4·망2·볼륨0, image tag2, QA dir와 Git checkout을 정확히 제거하고 잔여 0 확인. checkout은 published tag로 재생성 가능하지만 일회성 합성 서명 개인키·credential·tmpfs DB는 복구 불가능하다. 기존 local-postgres/anvil-web 및 타 자원은 미변경.
- 미검증: shared local-postgres 접근제어·전용 role 일반 경로, 전체 image/OS SBOM·provenance, preflight→Compose 자동 봉쇄, F17 PG18 RC/E2E rollback, F18 ysna/Production, 사용자 인수. 합성 staging key를 운영 신뢰키로 쓰지 않는다. R2 공개 증거 원문과 해시를 아래에 보존한다.
- Main이 두 lease 회수. 다음: F-16 PR 병합·merged-main smoke·branch/worktree 정리 후 F-17.

# F-16 Git-only WSL Test/Staging 착수

## F-16 R2 공개 QA 증거 원문

아래 원문은 일회성 합성 개인키·credential을 제외한 공개 검증 자료다. 각 JSON 블록은 단일 JSON 행과 최종 LF이며, `source_commit`은 검증 tag `383bd8cb0c1eec48cde9267a0dd9fb1d060ea272`이다. staging 공개키는 Production 신뢰키가 아니다.

### 최종 서명 ReleaseManifest

```json
{"public_key_fingerprint":"sha256:456c657eebd6bc0a3f0c09ba2557ac4ef674c2c6dff4fe08e72ec746bfb6d5e7","schema_version":1,"signature":"dEPFbXodoD4AkvLcl5eV0W/XnnzFRqL9NzGjLkY0MVNWBAI0M1V9PxH6UqN8W3+xsvQTMwBPqYChDZBrN662Bw==","subject":{"config_schema_revision":"sha256:8531c915d817de1f64c593791478f551666bae7a39648ed680458688f67e1505","db_migration_head":"0016_operations_recovery","evidence_manifest_hash":"sha256:78d5b924f57ce02d1fc37bd5b1e08474cfcf4c49909b3e05dfc7098c78aaa332","image_digests":{"api":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa","web":"sha256:e43ba974e3e2f35e44c82e832061b89233af0377f78033d15e9332075547bdf7","worker":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa"},"lockfile_hash":"sha256:b1cba45d362401032ef3ba362073b7c80a8cc42cdef6ee6583884b66e619d8a3","provider_adapter_versions":{"anthropic":"v1+90803772ffb5","cerebras":"v1+dc2607aa90ba","gemini":"v1+7042d430a3e4","groq":"v1+c0af30d73fbd","mistral":"v1+a7c51a78b0bb","ollama":"v1+ae6cf61c97b5","openai":"v1+28db01908a28","openrouter":"v1+c3cb8a1fba62","upstage":"v1+8e9c2daa30f0"},"release_tag":"f16-staging-383bd8cb","sbom_ref":"sha256:dc00ae925d7dfed9224da750edb0847e1f9fda5841d7dcd7e201051d3c18f45c","source_commit":"383bd8cb0c1eec48cde9267a0dd9fb1d060ea272","source_git_remote":"git@github-sinsan-develop:sinsan-develop/Anvil.git","verification_report_hash":"sha256:5534c51e2602183f4429216901a711bf1baa27dcec1b38b10c7d324b9fb6e0dd"},"subject_hash":"sha256:1c259758a1e0a843d31c71b2a3ce1151dd95412522c1ce273bdbe56b015b34ce"}
```

### 합성 staging 공개키

```pem
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEABXkHx/qL8fC4lIji9es1M6xNtms7lSCnDo/uoYVkepI=
-----END PUBLIC KEY-----
```

### 실측 Evidence

```json
{"app_role":{"createdb":false,"createrole":false,"ddl_denied_sqlstate":"42501","login":true,"network_auth":"PASS","superuser":false},"browser":{"api_json":true,"api_status":200,"csp_present":true,"direct_internal_api":0,"external_requests":0,"internal_host_leaks":0,"menu_count":11,"mobile_overflow":false,"mobile_status":200,"page_errors":0,"request_count":9,"response_count":9,"root_status":200,"secret_leaks":0,"toggle_collapsed":true,"toggle_restored":true},"credential_separation":"admin_only_in_postgres_app_only_in_api_worker","db_migration_head":"0016_operations_recovery","http":{"api_ready":200,"restart_ready":200,"root":200,"unknown_api":404},"image_ids":{"api":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa","postgres":"sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e","web":"sha256:e43ba974e3e2f35e44c82e832061b89233af0377f78033d15e9332075547bdf7","worker":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa"},"pg18_rc":"NOT_EXECUTED","production":"NOT_EXECUTED","release_tag":"f16-staging-383bd8cb","sbom_scope":"PARTIAL_SOURCE_DEPENDENCY_INVENTORY","schema":"F16_R2_FINAL_WSL_EVIDENCE_V1","shared_postgres":"NOT_MODIFIED","source_commit":"383bd8cb0c1eec48cde9267a0dd9fb1d060ea272","windows_focused_tests":"48 PASS twice","wsl_focused_tests":"48 PASS"}
```

### 검증 Report

```json
{"evidence_hash":"sha256:78d5b924f57ce02d1fc37bd5b1e08474cfcf4c49909b3e05dfc7098c78aaa332","limitations":["shared local-postgres access control not verified","full image SBOM not generated","F17 PG18 RC and E2E rollback not executed","synthetic staging signing key not production trust"],"result":"SCOPED_WSL_STAGING_PASS","rollback":"F16 project down and exact temp path/image cleanup pending","schema":"F16_R2_FINAL_VERIFICATION_V1","source_commit":"383bd8cb0c1eec48cde9267a0dd9fb1d060ea272","subject_preflight_hash":"sha256:3e2c3887407007bf6d2326f4d6564debd07abe5650a6874dcdfc2c4d008e62f5"}
```

### 부분 SBOM

```json
{"image_ids":{"api":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa","postgres":"sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e","web":"sha256:e43ba974e3e2f35e44c82e832061b89233af0377f78033d15e9332075547bdf7","worker":"sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa"},"limitations":["source lockfile and runtime requirements only; OS package inventory and provenance not audited"],"npm_lockfile_hash":"sha256:b1cba45d362401032ef3ba362073b7c80a8cc42cdef6ee6583884b66e619d8a3","python_requirements":["SQLAlchemy==2.0.43","alembic==1.16.5","fastapi==0.116.1","psycopg[binary]==3.2.10","uvicorn==0.35.0"],"schema":"F16_QA_PARTIAL_SBOM_V1"}
```

- 2026-09-24 F16 R2 WSL 실측 판정 `SCOPED_STAGING_PASS_CLEANUP_PENDING`: exact tag `f16-staging-383bd8cb` clean detached, 제품 Git preflight PASS. 실제 Web image `sha256:e43ba974e3e2f35e44c82e832061b89233af0377f78033d15e9332075547bdf7`, API/Worker `sha256:1deedceec7988cf4ebad7137fa1ffe09ceaf0fb2c4496f72bc4c6c5fd1e011fa`, PG15 `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e`. admin-only migration `0016_operations_recovery`, app role `LOGIN=true/SUPERUSER=false/CREATEDB=false/CREATEROLE=false/REPLICATION=false/SCHEMA_CREATE=false`, app network auth·migration read PASS와 DDL SQLSTATE42501 거부 PASS. 관리자 credential은 PG만, app credential은 API/Worker만 실측. Web root/API 200·fixture404, Worker 0016 ready, 재시작 후 API200·Worker0016 ready 및 이미지 불변. WSL focused 48 PASS. Chromium 1920/390 root·same-origin API 200, 11개 메뉴·사이드바 접기/복원, Network 9건 중 외부/내부 직접 API 0, 페이지 오류·secret·내부주소 노출 0, CSP 존재·mobile overflow 0. 검증 후 최종 합성 Ed25519 Manifest hash `sha256:1812db3c90ec98e46ae782179750854f3ef6fd92ca0c0b7ca7dfb75a5e6d241b`, subject hash `sha256:1c259758a1e0a843d31c71b2a3ce1151dd95412522c1ce273bdbe56b015b34ce`, evidence hash `sha256:78d5b924f57ce02d1fc37bd5b1e08474cfcf4c49909b3e05dfc7098c78aaa332`, report hash `sha256:5534c51e2602183f4429216901a711bf1baa27dcec1b38b10c7d324b9fb6e0dd`로 product preflight PASS. lockfile·부분 SBOM·evidence/report·config source hash·9개 Provider source-derived version·실제 DB head는 별도 재계산 일치. 최종 QA 자원 cleanup 및 잔여 확인은 아직 남음.
- F16 수용 범위 제한: staging 서명키는 일회성 합성키이며 Production trust가 아니다. SBOM 참조는 source lockfile/requirements 중심의 `F16_QA_PARTIAL_SBOM_V1`으로 전체 image/OS package inventory 및 provenance가 아니다. 기존 shared `local-postgres`의 0.0.0.0:5432 접근제어·Anvil 전용 role 경로, PG18 RC, F17 핵심 E2E/rollback, ysna/Production·사용자 인수는 미검증이고 현재 staging PASS로 승격하지 않는다. Compose role bootstrap과 preflight→Compose 순서는 아직 Main 절차 통제이며 시스템이 자동 봉쇄하는 운영 어댑터는 후속 검증 대상이다.
- 2026-09-24 R2 WSL 재검증 생성 전 inventory: published annotated tag `f16-staging-383bd8cb`→`383bd8cb0c1eec48cde9267a0dd9fb1d060ea272`, WSL 조회에서 tag object/peeled commit 일치. R1 정리 후 `/srv/anvil-wsl/f16-staging`, `/srv/anvil-wsl/f16-staging-qa`, Compose `anvil-f16-staging` 모두 미점유 확인. 같은 두 전용 경로·project·서비스4·망2·tmpfs DB/volume0을 재사용하고 image tag만 `anvil-f16-web:383bd8cb`, `anvil-f16-runtime:383bd8cb`로 새로 생성한다. QA env·합성 서명키·브라우저 profile은 QA 경로 mode700 안에만 두고 끝나면 exact project down→두 image tag 제거→두 비심볼릭 경로 제거→잔여 조회한다. 기존 공유/타 프로젝트 자원은 제외한다. R2 실제 생성은 이 기록 시점 NOT_EXECUTED.
- 2026-09-24 F16 R2 제품 인수: 동일 단일 writer가 exact3(`deploy/wsl/compose.f16.yml`, `tests/deploy/test_f16_staging_compose.py`, 완료보고)로 postgres bootstrap admin과 API/Worker app role·서로 다른 credential을 분리했다. RED 1 FAIL→GREEN Compose 5 PASS, Developer/Main 독립 focused 각 48 PASS(exit0), diff check PASS. 넓은 기존 `tests/deploy`는 Windows WSL fixture `wsl -d Ubuntu` exit4294967295에서 37 PASS 후 1 FAIL, F16 제품 경로 전 환경 실패로 분류하며 전체 PASS가 아니다. 다음 정식 WSL QA는 R2 정확한 Git tag로 fresh checkout→서명/이미지 preflight→전용 PG15 up→admin-only migration0016→앱 LOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE role·최소 DML/sequence grants→rolsuper=false 실측→API/Worker/Web 기동·브라우저·재시작→전용 자원 제거 순서로 수행한다. R1 실측의 superuser 결함은 아직 R2 WSL 실측으로 해소되지 않았다.
- 2026-09-24 F16 R1 WSL QA 중간 판정 `REWORK_IMPORTANT_DB_ROLE`: exact Git tag/clean detached preflight PASS, 합성 Ed25519 Manifest subject hash `sha256:31aad56f44e0b1e08be49b47bd36e6e116d412ad07e1b34198c55c19822e2590` 검증 PASS, 변조 signature exit2 차단 PASS. Web image `sha256:e8f98b52edd3dfe97fc56d2a0bf4252f7b0eab9fd4f9790300bce8205ba0b0b6`, API/Worker `sha256:d949479ab13b4708790e85545d21e8a71c006927be490c11d78f7667ca614371`, PG15 `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e` 일치. 임시 PG migration 0016, root/API 200, fixture 404, Worker ready, 재시작 후 API 200·Worker 0016, WSL focused 47 PASS. Chromium 1920/390 root 200, 11개 메뉴·사이드바 클릭, Network 외부·내부 직접 API 0, same-origin API 200, 페이지 오류·secret/내부주소 노출 0, CSP 존재. 첫 브라우저 QA harness 인자/전송 인코딩 오류 각 1회는 스크립트 수정 후 성공했으며 제품 실패가 아니다. 단, Compose의 `POSTGRES_USER=anvil_app`가 앱 runtime superuser 접속을 초래해 최소권한 조건 미충족. Main이 R1을 합격 처리하지 않고 제품 R2를 같은 브랜치/lease에 재지시하며, R1 임시 Compose·image·키·profile·checkout 정리 후 R2 재검증한다. 정식 Developer FAILURE_REPORT 0회.
- 2026-09-24 F16 R1 정리 실측: project `anvil-f16-staging`의 서비스 4개·망 2개를 정확한 Compose down으로 제거했고 project label container/network/volume 조회 잔여 0. 전용 image tag 2개 제거 확인, `/srv/anvil-wsl/f16-staging` 및 `/srv/anvil-wsl/f16-staging-qa`(일회성 서명 개인키·합성 credential·브라우저 profile·venv·tmpfs DB 포함) 정확한 경로의 비심볼릭/소유·권한 확인 후 제거해 경로 잔여 0. 일반 사용자 삭제는 root 소유 부모 때문에 1회 거부되어 `sudo -n`으로 동일 exact QA 경로만 재시도했다. 원격 R1 Git tag/commit은 감사·재현 ref로 남아 있으며 임시 키·DB는 복구 불가능한 합성 자료다. 기존 `local-postgres`·`anvil-web` 및 타 프로젝트 자원은 미변경.
- 2026-09-24 제품 구현 인수: Developer exact8 구현 완료·정식 FAILURE_REPORT 0회, Windows focused 47 PASS(Developer/Main 독립 재실행 각 exit0). Git remote/tag/clean checkout, canonical Ed25519 서명·독립 신뢰 입력, lockfile/image ID 읽기 전용 preflight와 격리 Compose 정적 계약까지 확인했다. 실제 WSL Git fetch/서명키/PG15 migration/Compose/브라우저/정리 및 전체 회귀는 아직 NOT_EXECUTED이며, CLI가 DB/config/provider/evidence/report 값을 독립 측정하지 않는 한계를 별도 실측한다. Main 검토·원격 checkpoint·정식 QA를 다음으로 진행한다.
- 2026-09-24 WSL 격리 QA 생성 전 정확한 추가 자원: Git source tag `f16-staging-b5a23c5e`→commit `b5a23c5e0d4ec49433de4688f2717d79a4866486`, checkout `/srv/anvil-wsl/f16-staging`(전용으로 생성·clean detached 사전검사 PASS). 임시 image tag `anvil-f16-web:b5a23c5e`, `anvil-f16-runtime:b5a23c5e`; QA key·manifest·관측·브라우저 profile·로그는 checkout 밖 `/srv/anvil-wsl/f16-staging-qa` mode 700에만 만든다. Docker 전용 project/서비스/망은 아래 inventory와 같다. 검증 후 해당 두 image ID/tag와 project label을 대조한 뒤 전용 Compose down·image remove, QA dir와 checkout의 정확한 경로만 제거하고 잔류 0을 확인한다. 현재 image/QA dir/Compose 생성은 NOT_EXECUTED.
- 2026-09-24 Main F16 내부 검증 방법 판정: 신산님의 더 최근 직접 지시대로 WSL-server에 F16 전용 임시 PG15·브라우저·restart/Compose 자원을 생성해 검증 후 제거한다. 공유 `local-postgres`의 `0.0.0.0:5432`/non-internal 공유망에 host-gateway로 직접 연결하거나 해당 컨테이너·방화벽·pg_hba를 변경하지 않는다. F16 격리 PG15 migration/health는 F16 Test/Staging 검증 증거로만 사용하고, 설계 §49.11의 기존 `local-postgres` Anvil 전용 DB/role 일반 통합 경로와 외부 접근 제한은 미검증으로 F17에 이월한다. 승인된 기능·요구사항·중요 위험은 확대하지 않는다.
- 2026-09-24 WSL 자원 생성 전 inventory: 전용 checkout `/srv/anvil-wsl/f16-staging`(사전 미존재 확인), Compose project `anvil-f16-staging`(사전 컨테이너/망/볼륨 점유 0), 서비스 `web/api/worker/postgres`, 전용망 `anvil-f16-staging_internal`(internal) 및 `anvil-f16-staging_ingress`, PGDATA tmpfs·named volume 0, cleanup label `F16_ISOLATED_STAGING`; web만 loopback 8300 공개. 정확한 Git source SHA와 실제 image digest를 기록한 뒤 `docker compose -p anvil-f16-staging down --remove-orphans`로 전용 컨테이너·망을 해제하고 checkout·브라우저 프로필·합성 서명키·산출물은 각 정확한 경로를 확인한 뒤 제거한다. 기존 `/srv/anvil-wsl/repo`·`anvil-web`·`local-postgres`·타 프로젝트 자원은 제외한다. 생성/정리 실측은 아직 NOT_EXECUTED.
- 판정: ACTIVE. F-15 PR #31 merged main f2b124a, feature ancestry/tree 및 merged-main G-05·49 PASS, 원격/로컬 F-15 branch 삭제와 Git worktree 등록 제거 확인. F-15 작업 디렉터리에는 ACL 거부된 .pytest_cache 하나만 고아 잔류하며 다른 자료는 정리했다. ACL 변경은 임의 수행하지 않았다.
- 담당: Main 어울 통제, developer-primary-f16-r1 제품 exact8 write lease. 기준 문서 hash 일치, F-16 branch main f2b124a에서 생성·원격 게시 후 clean 시작. 정식 FAILURE_REPORT 0회.
- 기존 WSL /srv/anvil-wsl/repo는 root-owned clean detached a681e0c, anvil-web 컨테이너 OCI revision bb2ff437로 F-16 exact target이 아니다. 기존 C21/C01 스크립트도 고정 SHA 계약이라 수정·재사용하지 않는다. F-16 별도 경로·Compose/DB/서명 QA 자원은 생성 전 이름·수명·정리 방법을 기록한다.
- 다음: G-05 start gate 후 Developer TDD 구현, Main 독립 검토, 원격 exact SHA WSL 격리 정식 staging에서 서명/checkout/migration/health/rollback 준비 검증 및 임시 자원 정리. F-17 PG18 RC·ysna/Oracle 미실행.

# F-15 Local 운영 셸·SSH tunnel 인수

- 판정: `ACCEPTED_LOCAL_BROWSER_WINDOWS_SSH_TUNNEL`; 제품 HEAD 1d1fe19, Windows 관련 49 PASS, Web Node 3·기존 Node 3 PASS, lint/typecheck/build PASS. Main 통합 최초 Nginx tmpfs chown 실패 1회는 R2 USER 101:101 수정 후 실제 Web Up/HTTP 200으로 재검증했다. 정식 Developer FAILURE_REPORT 0회.
- WSL-server 격리 PG15 QA DB/role migration 0016, Git exact SHA Compose Web/API/Worker Up, API ready 200, Worker ready, Playwright 1920/390 브라우저 same-origin Network 4건·내부 직접주소 0·secret 0·오류 0. WSL Compose의 host-gateway DB 직결은 SSH tunnel 보안 합격 증거로 사용하지 않는다.
- 별도 Windows Local 실측은 WSL-server SSH loopback tunnel 127.0.0.1:15432를 통해 전용 DB/role migration 0016, Worker --check 및 장기 프로세스 ready, API 8301 ready, Vite Web 8300 same-origin /api ready 200을 확인했다. Windows API fixture 404; 개발 Vite의 일반 SPA fallback은 해당 경로 200이므로 운영 fixture 차단 증거는 WSL Nginx 404만 사용한다.
- 초기 WSL QA DB/role/Compose/이미지/브라우저 산출물과 이후 Windows Web/API/Worker/SSH 프로세스·전용 DB/role/credential/log를 정확히 정리해 잔류 0. 기존 shared PostgreSQL 0.0.0.0:5432 바인딩은 선행 위험이며 F-15에서 변경하지 않았다. 인증 세션의 through-Nginx mutation, screenshot 픽셀 육안 검토, WSL Compose DB tunnel, shared PG 외부 방화벽은 미검증이다. F-16 staging, F-17 PG18 RC, F-18 ysna도 후속이다.
- Main이 두 lease를 회수. 다음: F-15 PR 병합·merged-main smoke·branch/worktree 정리 후 F-16.

# F-15 공통 운영 셸·Local stack 착수

- 2026-09-24 Main 중간 판정: `ACTIVE`, 제품 HEAD `1d1fe19f7ba6d5492b3555ad5c4f809a6c60a7cd` push 완료. Main Windows 관련 pytest 47 PASS, Web Node 3 PASS·기존 Node 3 PASS, lint/typecheck/build PASS, G-05 PASS. 정식 Developer `FAILURE_REPORT` 0회. 제품 Web 첫 Docker 기동은 Nginx tmpfs chown 오류 1회였고 R2 `USER 101:101` 후 Web 재빌드·기동 PASS.
- WSL-server SSH-only 격리 QA: 기존 `local-postgres` 안에 F-15 전용 최소권한 DB/role `anvil_f15_qa_40b640a7`을 생성하고 migration head `0016_operations_recovery` 확인. Git exact SHA Web/API/Worker Compose 기동, HTTP root 200·same-origin `/api/health/ready` 200·fixture 404, Worker DB head ready. 기존 `anvil` DB는 read-only head `0013_task_bootstrap_authority`만 확인하고 변경하지 않았다.
- WSL 임시 headless Chromium 브라우저 1920×1080 및 390×844: root navigation 200, 메뉴 11개, Dashboard와 sidebar 펼침/접힘, 모바일 수평 overflow 0. Network 4건 중 외부 origin 0, 내부 API 직접주소 0, 응답/요청 secret 노출 0, page error 0, CSP `connect-src 'self'` 확인. bad Host through Nginx 403; 익명 bad Origin/CSRF mutation은 인증 401로 중단됨. 승인된 synthetic principal TestClient에서는 bad Host/Origin/CSRF 403·owner side effect 0 확인. 실제 인증 세션을 통한 Nginx mutation 보안은 미검증.
- 선택적 스크린샷의 Windows 반출은 실행 플랫폼 안전 심사에서 차단되어 우회하지 않았고 픽셀 육안 검토는 미검증이다. 필수 F-15 E-NET/동작 증거와 분리한다. Windows Local Web/API/Worker 전체 프로세스 동시 기동 및 SSH tunnel 실측, 기존 PostgreSQL 5432 전역 바인딩의 외부 접근제어는 아직 검증하지 못했다. F-16 staging·PG18 RC·ysna·메뉴 기능은 범위 밖이다.
- QA 종료 후 F-15 전용 Compose 컨테이너 3개·network·image 3개, 전용 DB/role, Git clone, credential, Playwright 설치/cache, screenshot/profile을 정확한 대상 검사 후 제거했고 F-15 이름 잔류 0을 확인했다. 기존 PostgreSQL 컨테이너와 타 프로젝트 자원은 유지했다. 다음: Windows 로컬 프로세스/SSH tunnel과 기존 DB 접근제어의 F-15 수용 경계를 확인한 뒤 Main 독립 판정·lease 회수·PR 통합. 신규 branch는 만들지 않는다.
- 내부 통제 보완: F-15 exact19는 제품 write 허용 상한이며 19개 파일의 형식적 수정을 요구하지 않는다. G-05는 통제 exact11 변경을 필수로 하고 실제 제품 변경은 exact19 부분집합으로 검증한다. 기능·요구사항·중요 위험·lease 경로를 넓히지 않았고, 신규 checker 테스트 RED→GREEN 3 PASS. 기존 F-15 작업지시·승인 hash는 불변이다.
- 판정: ACTIVE. F-14 PR #30 merged main 41e7e06, feature ancestry/tree와 merged-main G-05·74 PASS/17 SKIP, branch/worktree 정리 확인.
- 담당: Main 어울 통제, developer-primary-f15-r1 제품 exact19 write lease. 기준 문서 hash 일치, F-15 branch clean에서 시작. 정식 FAILURE_REPORT 0회.
- 설계 D4 React/TypeScript/Vite 운영 셸은 신규 구현; 기존 정적 Node shell과 fixture는 회귀 보존. Local Web/API/Worker와 WSL-server PG15 전용 DB/role, Docker/브라우저 실제 검증은 아직 NOT_EXECUTED.
- 계획 QA 자원: WSL-server SSH-only, F-15 이름의 격리 PG15 DB/role·container·브라우저 profile을 필요 시 생성하고 F-15 검증 종료 후 정확한 대상만 삭제·잔류 0 확인. 기존 local-postgres/타 프로젝트·ysna 미변경.
- 다음: G-05 start gate 후 developer TDD, Main 독립 검토, exact Git SHA WSL 격리 QA와 실제 브라우저 Network 검증. F-16 staging/PG18 RC/ysna는 별도.

# F-14 PostgreSQL 15/18 격리 복구 인수

- 판정: `ACCEPTED_ISOLATED_PG15_PG18_REHEARSAL`; 제품 checkpoint 82fb713 exact12, 독립 SPEC PASS / QUALITY APPROVED, Critical 0/Important 0.
- Main Windows 관련 71 PASS/17 SKIP, G-05 PASS. WSL-server Git-only commit 3baf8e4에서 격리 PG15·PG18 각 관련 75 PASS/13 SKIP, 6종 lineage backup/restore 2 PASS, CAS 각 6 PASS, Alembic 0016/vector 확인. 유자료 downgrade는 두 버전 모두 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단되고 0016·audit 2행 보존.
- PG15·PG18 전용 tmpfs 컨테이너 2개, UUID 임시 DB, Git checkout, dump, pytest 산출물 정리 잔여 0. 기존 local-postgres·타 프로젝트·ysna 미변경.
- 첫 opt-in 테스트는 test DSN URL 오류로 migration 전 실패했고 UUID DB 잔류 0; 수정 후 PASS. 전체 pytest 기본 수집 충돌 및 선택 yaml/httpx 의존성 누락, 지원 범위 장기 시도 중단·출력 미회수는 PASS가 아니다. Alembic 경고 14건은 설정 deprecation이며 해당 테스트 성공과 분리 기록.
- 기본 host owner 결선·브라우저/UI·Provider·WSL staging 배포·PG18 formal RC·ysna Production은 미검증. F-15~20 후속 조건이며 본 결과를 release/운영 PASS로 승격하지 않는다.
- Main이 두 lease를 회수. 다음: F-14 PR 병합·merged-main smoke·branch/worktree 정리 후 F-15.

# F-14 PostgreSQL migration·backup/restore 착수

- WSL 격리 검증 사전 범위: Git-only 임시 checkout `/tmp/anvil-f14-1b8211f` (제품 commit `1b8211f`), 신규 컨테이너 `anvil-f14-pg15-1b8211f` 및 `anvil-f14-pg18-1b8211f`만 생성한다. 기존 `local-postgres`, `anvil-web`, 타 프로젝트 컨테이너·DB·볼륨·네트워크에는 접근·변경하지 않는다. 이미 로컬에 있는 이미지 `pgvector/pgvector:0.8.2-pg15` (sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e), `pgvector/pgvector:0.8.2-pg18` (sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c)을 사용한다. 전용 임시 DB 저장소는 Docker tmpfs, host port는 loopback 동적 할당, 별도 named volume/network 생성 없음. 검증 후 정확히 두 컨테이너를 정지·제거하고 해당 임시 checkout·테스트 산출물을 제거한 뒤 이름·경로·볼륨 잔류 0을 확인한다.
- 제품 R2: `1b8211f` 원격 checkpoint, 독립 SPEC/QUALITY 계약 범위 PASS(Critical/Important 0), F-13 queue `task-1` 실제 detector 경로 통과. Main Windows 66 PASS/15 SKIP, G-05 PASS. 실제 PostgreSQL·backup/restore는 아래 격리 실행 전까지 미검증.
- 중간 판정: 제품 checkpoint 71a466a 반영 뒤 G-05가 `F14_START_GIT_INVALID` 1회 발생. 검사기가 승인된 exact12 제품 파일의 committed 변경을 누락한 통제 결함으로 확인했고 TDD RED 1 FAIL/1 PASS → 수정 후 2 PASS. F-14 제품 실패 횟수에는 산입하지 않는다. 제품 R2 독립 검토는 정상 `task-1` 식별자 오탐 Important 1을 재현하여 동일 write lease 내 재작업 중이며, PG15/PG18 실검증은 아직 미실행.
- 판정: ACTIVE; F-13 PR #29 merged main 1584523, feature ancestry/tree, merged-main G-05/659 PASS 6 SKIP, branch/worktree 정리 확인.
- 담당: Main 어울 통제, developer-primary-f14-r1 제품 exact12 write lease. 기준 문서 hash 일치, F-14 branch clean.
- 기존 migration head 0015, artifact/checkpoint/recovery table 존재. 실제 backup restore·retention·operations PostgreSQL adapter는 미구현.
- WSL-server 기존 local-postgres·타 프로젝트 컨테이너와 ysna 운영 DB 변경 금지. PG15/PG18 별도 격리 자원으로 검증 후 정리.
- 다음: G-05 start gate 후 developer TDD 구현·독립 검토·Main WSL 격리 DB 훈련. 현재 정식 FAILURE_REPORT 0회.

# F-13 Operations read model/API 로컬 계약 인수

- 판정: `ACCEPTED_LOCAL_CONTRACT_SCOPE`; 제품 commit 772ab8d exact9, 독립 SPEC PASS / QUALITY APPROVED, 미해결 Critical 0/Important 0.
- Main Windows 관련 회귀 656 PASS/6 SKIP; WSL-server 격리 Git checkout 동일 SHA 652 PASS/10 SKIP. WSL 최초 시스템 Python 의존성 누락 23 collection ERROR는 lockfile 오프라인 venv로 해결. 임시 checkout/pytest 정리 잔여 0.
- 실제 기본 ASGI operations owner 미주입으로 GET 501, 실제 PostgreSQL 영속 adapter·주기 detector·브라우저/UI·Provider·배포·PG18은 미검증. F-14 및 F-15~19, U-01/U-10, F Gate의 후속 결선·검증 조건으로 남긴다.
- developer 정식 FAILURE_REPORT 0회. 독립 review C1/I4 및 추가 Important 1을 같은 WI에서 수정했다.
- 담당: Main 어울 인수·lease 회수. 다음: F-13 PR 병합, merged-main smoke, branch/worktree 정리 후 F-14 시작.

# F-13 Operations read model/API 시작

- 판정: ACTIVE; F-12 merged main a612fda에서 F-13 단일 branch를 시작했다.
- 담당: Main 어울 통제, developer-primary-f13-r1 제품 exact9 write lease.
- 기준선: Queue/Lease/Budget/API 관련 Windows 회귀 637 PASS, 6 SKIP. 최초 Python 경로 2회, D:/tmp 권한 1회 실패는 환경 오류이며 허용된 Temp 경로로 해결했다. 정식 제품 FAILURE_REPORT 0회.
- 설계 §16.2의 alert/audit 조회 경로만 사용하고 미정 command 경로는 추가하지 않는다. 실제 UI/U-01·U-10, DB/F-14, release/F-20은 미검증.
- 다음: G-05 start gate 후 developer TDD 구현·독립 검증.

# F-12 Provider Settings 계약 완료·Broker gate 정합

- 판정: `ACCEPTED`; F-12 제품 exact10, 독립 검토 Critical 0/Important 0/Minor 0.
- Windows 관련 회귀 975 PASS, WSL-server 격리 checkout 동일 commit 975 PASS; WSL 임시 checkout·venv·pytest 제거와 잔여 컨테이너 0 확인.
- 전체 pytest collection 16 ERROR는 clean main에서도 동일 재현; 전체 suite PASS 아님.
- PR Broker trusted gate는 기존 checker에 F-12 mode dispatch가 없어 요청 전 재현 시 실패했다. checker 원본 대비 F-12 dispatch 20행만 추가하고 제품 변경 없음.
- 수정 checker의 정확한 Broker gate는 commit 후 실행해 확인한다. 검증 전 요청 tag를 만들지 않는다.
- 실제 Provider·human approval·Secret material·network·DB·browser·deploy는 `NOT_EXECUTED`; F-14 profile 영속성·다중 인스턴스, U-11 실제 화면은 별도 acceptance.

# F-11 OLLAMA adapter 완료

- 판정: `ACCEPTED`; 독립 재검토 Critical 0/Important 0/Minor 0, 제품 exact6을 인수한다.
- focused 69 PASS, 관련 회귀 699 PASS/4 SKIP(PG18 DSN), AST 5 OK.
- Main 재검증: 관련 회귀와 control 합산 706 PASS/4 SKIP, exit 0; 임시 `.f11-main-final-20260924b` 정리 확인.
- 독립 검토 재작업 1회(Important 1건 해결), 정식 `FAILURE_REPORT` 0회; control 테스트 7 PASS, 임시 `.f11-control-20260924a` 정리 확인.
- 잔여 제약: 실제 host socket의 peer·redirect·proxy·egress 계약은 F-12에서 검증한다.
- 실제 Ollama·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-10 OPENAI adapter 완료

- 판정: `ACCEPTED`; 독립 재검토 Critical 0/Important 0/Minor 0, 제품 exact5를 인수한다.
- focused 36 PASS, 관련 회귀 630 PASS/4 SKIP(PG18 DSN), AST 4 OK.
- Main 재검증: 관련 회귀와 control 합산 637 PASS/4 SKIP, exit 0; 임시 `.f10-main-final-20260924a` 정리 확인.
- 독립 검토 재작업 1회(Important 2건 해결), 정식 `FAILURE_REPORT` 0회; control 테스트 7 PASS, 임시 `.f10-control-20260924a` 정리 확인.
- 잔여 제약: 기존 Gateway 문자열 계약상 선행·후행 공백 출력은 `OUTPUT_TEXT_NON_CANONICAL`로 거부된다.
- 실제 OPENAI·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-09 ANTHROPIC adapter 완료

- 판정: `ACCEPTED`; 독립 검토 Critical 0/Important 0/Minor 1, 제품 exact5를 인수한다.
- focused 37 PASS, 관련 회귀 594 PASS/4 SKIP(PG18 DSN), AST 4 OK.
- 독립 검토 재작업 2회, 정식 `FAILURE_REPORT` 0회; control 테스트 7 PASS, 임시 `.f09-control-20260924a` 정리 확인.
- Minor: 기존 Gateway 문자열 계약상 선행·후행 공백 출력은 `OUTPUT_TEXT_NON_CANONICAL`로 거부된다.
- 실제 ANTHROPIC·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-08 GEMINI adapter 완료

- 판정: `ACCEPTED`; 독립 검토 Critical 0/Important 0/Minor 1, 제품 exact5를 인수한다.
- focused 49 PASS, 관련 회귀 557 PASS/4 SKIP(PG18 DSN), AST 4 OK.
- 독립 검토 재작업 2회, 정식 `FAILURE_REPORT` 0회; control 테스트 7 PASS, 임시 `.f08-control-20260924a` 정리 확인.
- Minor: 기존 Gateway 문자열 계약상 선행·후행 공백 출력은 `OUTPUT_TEXT_NON_CANONICAL`로 거부된다.
- 실제 GEMINI·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-07 UPSTAGE adapter 완료

- 판정: `ACCEPTED`; 제품 exact5와 독립 재검토 C0/I0/M1. 429 오분류 Important는 해소했다.
- focused 31 PASS, 관련 회귀 508 PASS/4 SKIP(PG18 DSN 없음), AST PASS.
- 실제 UPSTAGE·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-06 OPENROUTER adapter 완료

- 판정: `ACCEPTED`; 제품 exact5와 독립 검토가 통과했다(Critical/Important 0).
- Main 재검증: 관련 회귀 `477 passed, 4 skipped`(격리 PG18 DSN 없음), AST 4파일 통과.
- 검토 재작업: 인증형 `/api/v1/auth/key`, 선택적 quota 필드, routing 충돌, 비모델 404, 중첩 credential 차단을 해결했다.
- 실제 OPENROUTER·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-05 MISTRAL adapter 완료

- 판정: `ACCEPTED`; 제품 exact5와 독립 검토가 통과했다.
- 실제 MISTRAL·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-04 GROQ adapter 완료

- 판정: `ACCEPTED`; 제품 exact5와 독립 검토가 통과했다.
- 실제 GROQ·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.
- 다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다.

# F-03 merged-main reconciliation / 2026-09-23

- 판정: `IN_PROGRESS`; PR #18 merged main `950bc8375fb19a76788f24e492112d68043ed596`의 structural checker를 추가한다.
- 제품 동작 변경 0, F-03 acceptance와 F-04 READY 상태 유지.

# F-03 CEREBRAS adapter accepted / 2026-09-23

- 판정: `ACCEPTED`; 독립 Reviewer `C0/I0/M0`.
- Main focused 45 PASS, 관련 회귀 709 PASS/4 SKIP, 독립 넓은 회귀 738 PASS/4 SKIP, compile3 PASS.
- 실제 Cerebras/credential/network/DB/UI/browser/WSL/deploy는 미검증이다.
- 다음 승인 작업은 F-04 GROQ adapter다.

# F-03 CEREBRAS adapter start / 2026-09-23

- 판정: `IN_PROGRESS`; 승인된 작업계획 F-03 exact5 host-only TDD를 시작했다.
- canonical worker/write lease와 fencing token을 seq1360~1363에 발급했다.
- 실제 Provider/network/DB/UI/browser/deploy 호출은 승인하지 않았고 실행하지 않는다.

# C-30 merged-main canonical checker reconciliation / 2026-09-23

- 판정: `IN_PROGRESS`; Stage A merge-policy main `66eef70f87cac1d0b87df5b7e7c37715b3bf2632`에서 Stage B exact9 reconciliation을 시작했다.
- TDD RED `4 failed, 6 passed`; GREEN `10 passed`; canonical checker seq1359와 worktree diff-check PASS. checker는 work branch pre/post와 2-parent merged main을 구조·exact path·ancestry·tree equality로 검증한다.
- 제품/DB/WSL/browser/Provider/Oracle 변경·재실행은 0이다. 다음은 seq1359 checker/diff/focused gate 후 commit·push·request tag다.

# C-30 PR Broker integration gate correction / 2026-09-23

- 판정: `RECONCILED_PENDING_COMMIT_PUSH`; seq1358 append-only reconciliation으로 Broker merge와 exact13 correction을 결박했다.
- 기존 seq1~1357과 C-30 제품 동작은 변경하지 않았다. EOF blank 4건과 checker projection/test/control evidence만 수정했다.
- TDD RED `2 failed, 2 passed`, selector RED `1 failed, 5 passed`; GREEN `6 passed`; runtime owner `27 passed`; canonical checker seq1358와 worktree diff-check PASS. 다음은 commit 후 range diff-check·SSH push·request tag다.
- 미검증: Provider, production auth, PG18, actual server-generated 400, Oracle.

# C-30R5 remote checkpoint reconciliation / 2026-09-23

- 판정: `PASS`; accepted checkpoint `f3eeb4c88cceb10c919242e4b0db1843aac8c699`와 원격 branch SHA가 일치한다.
- worktree는 checkpoint 직후 clean이며 C30 작업계획은 완료 상태다.

# C-30R5 final acceptance / 2026-09-23

- 판정: `ACCEPTED`; C30 contract matrix와 기록된 evidence 범위의 final gate를 통과했다.
- R2는 matrix 수량 오기 `18→14`만 비의미 정정했고, spec/quality C0/I0/M0이다.
- 미검증 경계: Provider, production auth, PG18, actual server-generated 400, Oracle.
- 다음 조치: exact15 checkpoint commit/push 후 remote SHA와 clean worktree를 재확인한다.

# C-30R5 matrix correction start / 2026-09-23

- 판정: `IN_PROGRESS`; historical checkpoint/current successor 테스트 드리프트 exact1 보완.
- canonical dual lease와 exact1 scope를 seq1346~1349에 발급했다. C30 전체 gate는 계속 `PENDING_FINAL_GATE`.

# C-30R4 canonical reconciliation / 2026-09-22

- 판정: `C30R4_ACCEPTED_C30_GATE_PENDING`; 세 번째 unrelated large-file patch corruption 복구와 신산님의 직접 `Main takeover 승인`을 canonical human-override로 결박했다.
- 현재 정본: branch `codex/c09-execution-backends-r1`, base HEAD `ed3cae92597d681c76417e26576bed91a0525bad`, acceptance projection event seq1345.
- 완료한 수정: historical/current fixture 격리, seq1~1334 raw freeze, seq1335 human override, Developer lease 회수, TakeoverPacket, Main epoch3 lease, completion replay actor/hash 결박, exact16 rollback, C30R3 fixture-only/미검증 경계, phase/package/next/successor/action projection 정합화.
- fresh gate: tooling shard `125+199+159+196=679/679`, focused `36/36`, C30 adversarial `10/10`, compile/live checker/diff-check PASS. 모든 pytest는 `-p no:cacheprovider`; `.pytest_cache`와 `.tmp_subagent_review` residue 0.
- 독립 리뷰: spec `ACCEPT C0/I0/M0`, quality `ACCEPT C0/I0/M0`; 역할별 actor와 seq1340 epoch3 lease/token에 결박했다.
- 완료 전 필수: seq1345 exact16 acceptance commit/checkpoint push와 remote SHA 확인. C30 전체 gate는 별도이며 아직 `PENDING_FINAL_GATE`다.
- 미검증 유지: production auth, 실제 Provider, PostgreSQL18, actual server-generated 400, Oracle, live remote.

# 2026-09-18 문서 successor 전환 — v2.8/v1.7 핵심 개념 정합화

- 담당: Main 어울. 신산님의 직접 지시에 따라 제품 코드·DB·WSL·Provider·Kakao·Oracle 배포를 중지하고 설계서/작업계획서만 append-only로 보완했다.
- 기준선: branch `codex/c09-execution-backends-r1`, HEAD `98e218264bf54db04a1bd35a67273b713805a649`; 기존 dirty/untracked는 보호 목록으로 유지한다.
- 변경 문서: `Anvil_설계서_v2.md` v2.8 successor, `Anvil_작업계획서_v1.md` v1.7 successor. 기존 C-16~C-21·F-01/F-02 Event/Gate/Acceptance는 재작성하지 않는다.
- 신규 문서 계약: 다섯 일급 역할, Main/Code 단일 writer 경계, Agent Team과 MoA/Provider routing 분리, transport-neutral SNS Gateway·Telegram 보존·Kakao OPEN_DECISION·Daon User, 화면 mockup 선행, C-22~C-30 successor와 Oracle 별도 운영계획.
- 상태: `DOCUMENT_SUCCESSOR_REVIEW_PENDING`; matrix/test-plan/progress/HANDOFF/approval binding은 제품 구현 전에 별도 정합화해야 한다.
- 미실행: 제품 테스트·DB/WSL·Provider·SNS 외부 호출·브라우저/운영·Oracle 설치/배포·commit/push/merge.
- 다음: 문서 lint/link/ID/diff 검증과 독립 read-only review(C/I finding 0)를 완료한 뒤 PMO용 완료보고를 남긴다.

# C-22 시작 — 다섯 역할 계약·Agent Team domain

- 상태: `ACTIVE_C22_IMPLEMENTATION`; 신산님의 `진행하자` 지시에 따라 문서 successor의 첫 구현 패키지를 시작한다.
- WorkInstruction: `docs/work_orders/C-22_WORK_INSTRUCTION.md`, SHA-256 `67C864C512AFC7023E08626DC4C8BB7FE39D84A3CFB44303B69D404B5D196E5B`
- Invocation: `docs/work_orders/C-22_INVOCATION_PROMPT.md`, SHA-256 `C12B945CBBC661F983C724407AAE11899F1558B9F53C6EDAEC0C272CD72ECF6E`
- 허용 writer 경로: `packages/agent_team/role_contracts.py`, `packages/agent_team/role_results.py`, public export, C-22 tests/report only.
- 금지: DB/WSL/Provider/UI/Telegram/Kakao/Oracle, historical progress rewrite, unrelated dirty/untracked, commit/push/merge.
- 해결: Main takeover control reconciliation seq1196~1200을 append-only로 기록했다. F-02 `PACKAGE_COMPLETED`→독립 ACCEPT→write/worker lease revoke→`MAIN_PACKAGE_ACCEPTED`를 결박했고, `build-progress`는 seq1200/ACCEPTED/active null/next C-22 READY로 정합화했다.
- 잔여: checker는 Git projection 5건(`GIT_BRANCH_MISMATCH`, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `GIT_DESCENDANT_WORKTREE_DIRTY`, `GIT_UPSTREAM_MISMATCH`)만 fail-closed한다. 이 Git projection 정합화 전에는 C-22 제품 writer를 발급하지 않는다.

# C-21 Workbench UI WSL authenticated browser probe R1 — seq609~614

- Reviewer 최종 재검토 `COMMIT_READY / C0 / I0 / M1`: WorkInstruction 첫 범위 bullet에 R1의 `screenshot root를 환경변수에서 읽는다` 문구가 남아 확정된 R2 memory-only 계약과 불일치했다. path 없는 Buffer 메모리 전용 및 screenshot-root nonempty env fail-closed로 비의미 문서 정정했으며 기능·범위·seq614/exact13/hash 경계는 확대하지 않는다. 기존 full tooling `606 passed in 1320.29s`는 코드 불변으로 유지하고 focused 문서/checker 검증으로 M1을 해소한다.
- 비의미 정정 pre-amend 검증: focused `7 passed, 231 deselected`; live checker는 새 projection이 아직 commit되지 않은 단계에서 예상대로 `GIT_DESCENDANT_RECORD_COMMIT_INVALID` 1회로 fail-closed했다. amend 후 재검증 대상으로서 제품/계약 실패가 아니며 valid failure count `2`는 불변이다.
- Reviewer R2: `REWORK / C0 / I1 / M1`, 동일 package valid failure 2로 수락했다. filesystem screenshot root 설계가 TOCTOU·overwrite·symlink·cleanup 예외 경계를 불필요하게 만든다는 판단에 따라 WorkInstruction을 `MEMORY_ONLY` Buffer capture로 축소한다. 이는 기능 범위 확대가 아니라 위험 제거 revision이며 seq614/exact13을 유지한다.
- R2 시작 기준 full tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → exit 0, `606 passed in 1122.50s`.
- R2 TDD RED: memory-only manifest/input/failure/self-test 계약 부재 `4 failed, 1 passed`; 하나의 screenshot persistence revision lineage valid failure 2에 속하며 3번째 동일 유효 실패는 아니다.
- R2 GREEN: screenshot은 path 없는 Buffer로만 캡처하고 logical relative name/bytes/SHA-256만 receipt에 기록한다. filesystem files/directories/residue는 0이고 `ANVIL_SCREENSHOT_ROOT` 및 legacy `ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR` 입력은 fail-closed 거부한다. Last-Event-ID exact 검증은 유지한다. 집중 `7 passed, 231 deselected`, Node syntax PASS다.
- R2 최종 full tooling 재검증: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → exit 0, `606 passed in 1320.29s (0:22:00)`; 실패 fingerprint 없음.
- R2 최종 보조 검증: API 전체 `117 passed`, Workbench Web `8 passed`, actual headless Workbench click/SSE와 cross-origin rejection PASS. `node --test apps/web/tests`는 Node가 directory target을 module로 해석해 1회 exit 1이었고 정확한 `apps/web/tests/workbench.test.mjs` 대상으로 정정했다. 제품 실패가 아니며 valid failure count는 `2`로 유지한다.

# C-21 Provider status READ start — seq507~509

- commit 전 cached diff-check의 `new blank line at EOF` 2건(WI line58, invocation line11)을 비의미 correction으로 확정했다. 문서 의미·제품 범위·lease exact18은 불변이며 EOF LF 1개로 정규화한 뒤 WI/prompt 3-way hash와 manifest/raw refs/digest/progress/HANDOFF snapshot만 재결박한다. full164 R3 결과는 유효하고 focused 검증으로 마감한다.
- 독립 review I1 `SEQ509_HANDOFF_INVOCATION_HASH_STALE` 1회: 실제 prompt와 build-progress는 `9CB42A75...3251`인데 HANDOFF machine summary만 이전 invocation `1A368B58...D220`을 유지했다. TDD RED는 raw checksum stale 포함 focused `2 failed, 1 passed`; 직접 3-way 비교로 stale을 확인했다. checker가 실제 prompt raw hash = active WorkInstruction invocation hash = HANDOFF invocation hash를 강제하도록 보완하고 digest/manifest/snapshot을 재결박한다.
- I1 GREEN: focused `3 passed, 161 deselected in 11.89s`; full tooling fresh R3 `164 passed in 919.47s`, exit 0. JUnit `D:\tmp\anvil-seq509-full164-r3.xml`. HANDOFF invocation은 실제 prompt/build-progress와 `9CB42A75...3251`로 일치한다.
- 담당: `provider_status_start`; 상태: `ACTIVE_PROVIDER_STATUS_READ`; 기준 clean HEAD `aa116e2044671628011b46d190de014ad7fd0af4`.
- TDD RED: 신규 start manifest/helper 부재로 focused `3 failed, 161 deselected`; 기대된 계약 실패다.
- seq507 worker lease → seq508 exact18 write lease → seq509 package start를 append한다.
- product lease exact18 hash `300FEF86...122E8`; start exact10 hash `3F575DB5...A1B6`; predecessor exact78 hash `4BB888F6...E946`; cumulative exact82 hash `6A6A51D6...DD63`.
- seq1~506 보존: full `895160` bytes/`5517EAA3...FAB0`; raw prefix `894954` bytes/`7D6BE1D0...34C3`; canonical `5CCAE8CD...C6F8`.
- 구현 목표: canonical lowercase 9/uppercase display/UPSTAGE primary, env presence-only, GET list/detail/models 200, unknown·mixed 404, auth/RBAC, MoA no-eligible fail-closed. POST configure/test/refresh는 honest 501로 유지한다.
- actual Provider/Telegram, DB migration, ysna/main/release/install은 `NOT_EXECUTED`; C-21 accepted=false, C-01 차단, DIR-2 미발생.
- 오류 fingerprint `C21_PROVIDER_STATUS_START_MISSING_RED` 1회(의도된 RED), 동일 유효 제품 오류 반복 0회.
- `C21_SEQ509_DTMP_SANDBOX_WRITE_DENIED` 1회: 최초 materializer가 `D:\tmp` progress-events 쓰기에서 sandbox `PermissionError`로 중단됐다. 승인된 exact worktree 쓰기로 재실행해 해소했으며 제품 실패가 아니다.
- `C21_SEQ509_PACKAGE_STARTED_PAYLOAD_INCOMPLETE` 1회: 첫 생성본의 `PACKAGE_STARTED`에 공통 계약의 work-instruction/package-status 및 repository effect field가 빠져 checker가 2건을 거부했다. Main 승인에 따라 이번 turn의 미커밋 progress-events 단일 파일만 HEAD blob으로 원자 복원하고, seq1~506 full/prefix/canonical hash 불변을 확인한 뒤 필수 payload를 포함해 seq507~509를 처음부터 재생성했다. 과거 event를 인플레이스 수정하지 않았다.
- `C21_SEQ509_HISTORICAL_SEQ506_CURRENT_BUNDLE_MIX` 1회: full tooling 첫 fresh 실행은 `160 passed, 4 failed in 772.64s`였다. seq506 historical 계약 4건이 seq509 current bundle을 읽은 fixture 혼합이며 제품 실패가 아니다. 3개 validator fixture와 Git fixture를 동일 detached `aa116e2` snapshot bundle로 분리해 seq506 계약을 유지했다.
- fixture 보완 중 `SEQ509_SEQ506_POSTCOMMIT_DUPLICATE_TEST_BLOCK_TYPO` 1회: seq509용 postcommit block이 seq506 test에도 중복 삽입돼 미정의 `exact78/exact10`으로 focused 1건이 실패했다. 잘못 삽입된 duplicate block만 제거하고 seq506 기존 계약과 seq509 별도 postcommit 계약은 유지한다.
- fixture 교정 focused: seq506 detached coherent bundle 4건과 seq509 신규 계약 3건 `7 passed, 157 deselected in 56.48s`; checker/diff-check PASS.
- full tooling fresh R2: `164 passed in 946.22s`, exit 0. JUnit `D:\tmp\anvil-seq509-full164-r2.xml`; 최초 R1의 historical fixture 4건은 모두 해소됐다.
- 다음: governance exact10 검증·commit 후 `developer-primary`가 exact18 lease subset에서 구현하고, 이어 Workbench UI rework로 진행한다.

# C-21 Development QA review successor — seq502~506

- 담당: `seq506_successor_writer`; 상태: `REWORK_REQUIRED`; 기준 clean HEAD `3c6774f98e25bf3b8473575d88da3fcac8fbca59`.
- TDD RED: successor manifest/helper 부재로 focused `4 failed, 157 deselected`; 의도한 계약 실패이며 제품 failure가 아니다.
- exact7 독립 판정: `SPEC_PASS / QUALITY_APPROVED / C0 / I0`; 580ed9d→3c6774f direct exact7 hash `15F82A54...14DE9`.
- 전체 판정: `PACKAGE_QA_COMPLETED_BUT_C21_ACCEPTANCE_PENDING / C0 / I2`. `PROVIDER_RUNTIME_STATUS_PORT_501`, `WORKBENCH_CONFIG_404_UI_CLICK_NOT_PROVEN`이 남았다.
- seq502→506: write lease 회수 → worker lease 회수 → package 완료 → exact7 독립 review → C-21 test judgment. active agent/lease는 모두 null이다.
- seq1~501 보존: full file `891334` bytes / `8AB734F3...E508C`; event-object prefix `891131` bytes / `80B5A599...E2AB`; canonical ASCII `5616162D...E7288`.
- repository: eef3496→3c6774f exact75 hash `DA55B1DE...FBE3`; record exact9 hash `4B44F07D...2AAE`; postcommit cumulative exact78 hash `4BB888F6...E946`.
- 외부 actual Provider/Telegram, ysna, main, release/install은 `NOT_EXECUTED`; 현재 gate가 아니며 사용자 대기로 전환하지 않는다.
- 다음: `ISSUE_C21_RUNTIME_UI_REWORK_WI`; C-01은 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2는 `NOT_TRIGGERED`.
- 오류 fingerprint `D_TMP_CANONICAL_WRITE_PERMISSION_R1` 1회: 기본 sandbox에서 canonical D:\tmp worktree write가 거부됐고 승인된 동일 generator 실행으로 해소했다. 제품 failure는 아니다.
- 오류 fingerprint `SEQ506_GENERIC_EVENT_AND_REF_BINDING_R1` 1회: 신규 event type/effect와 checksum registry 결박 누락을 checker가 거부했고 exact9 checker/refs 보완 후 focused와 checker가 PASS했다.
- 오류 fingerprint `SEQ506_FULL_OUTPUT_TRUNCATED_R1` 1회: 최초 full tooling 종료 출력이 도구 context에서 truncate되어 최종 counts를 회수하지 못했다. 동일 fresh run으로 실제 결과를 다시 확보했으며 제품 failure는 아니다.
- 오류 fingerprint `SEQ506_HISTORICAL_FIXTURE_CURRENT_BUNDLE_MIX_R1` 1회: fresh full tooling `14 failed, 147 passed / 706.52s`에서 seq424~501 과거 projection tests가 current seq506 ROOT bundle을 사용한 fixture 혼합을 검출했다. checker·historical evidence를 완화/수정하지 않고 각 검증된 historical commit의 detached bundle/root로 분리했으며 실패군 focused `14 passed, 147 deselected / 87.97s`와 잔여 3건 focused `3 passed, 158 deselected / 15.53s`를 확인했다.
- generator는 historical event prefix 불변과 exact hash를 assert하며 checksum 재결박 후 idempotent 재실행한다. 최종 full tooling 결과는 아래 마감 checkpoint에 추가한다.
- 최종 마감 checkpoint: fresh full tooling `161 passed, F=0, E=0 / 719.16s / exit0`; JUnit `D:\tmp\anvil-seq506-full161.xml`. 신규 seq506 focused `4 passed, 157 deselected / 12.31s`, checker `PASS sequence=506 reporting=AUTO_CONTINUE`, historical 실패군 focused `14 passed, 147 deselected / 87.97s`다.

# C-21 독립 판정 projection — seq496~498

- 담당: `seq498_result_writer`; 상태: `COMPLETED_FOR_REVIEW`; 기준 HEAD `9a7a6144bcd0a7d38fce291610f40e9608a38309`.
- TDD RED: focused `4 failed, 145 deselected`; 원인: manifest/validator 부재. 동일 formal product failure가 아니라 의도한 계약 실패 1회다.
- 구현: WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → INDEPENDENT_TEST_JUDGMENT_RECORDED. 최종 lease/agent null, C-21 BLOCKED_NOT_ACCEPTED, C-01 blocked, DIR-2 NOT_TRIGGERED.
- 미실행: commit, push, WSL/DB, Provider, Telegram, ysna, browser, main merge.
- 검증 결과와 추가 오류는 완료 checkpoint에 이어서 기록한다.

## seq498 completion checkpoint

- focused RED: `4 failed, 145 deselected`; 신규 manifest/validator 부재를 의도대로 검출했다.
- focused GREEN: `4 passed, 145 deselected`; historical fixture 보완 관련 focused: `8 passed, 141 deselected`.
- 첫 full tooling: `145 passed, 4 failed, E=0` / `521.59s`. 기존 seq478/seq495 테스트가 current seq498 bundle을 과거 projection fixture로 사용한 `HISTORICAL_CURRENT_BUNDLE_MIX_SEQ498_R1` 1회이며 제품 failure가 아니다.
- immutable historical commit fixture로 분리 후 두 번째 full tooling: `149 passed, F=0, E=0` / `555.48s`.
- project checker: `PASS sequence=498 reporting=AUTO_CONTINUE` (full suite 재실행 전). 최종 checksum 재결박 후 checker/diff/history/exact9/64/idempotence를 다시 확인한다.
- 구현 오류 ledger: `D_TMP_SANDBOX_WRITE_PERMISSION` 1회, `SEQ495_RAW_PREFIX_RESERIALIZED` 1회, `HANDOFF_CORE_DECISION_OMISSION` 1회, `EVENT_CONTRACT_REPOSITORY_EFFECT_HANDOFF_MISMATCH` 1회. 모두 해소했으며 동일 fingerprint 3회 반복은 없다.
- 외부 실행, commit, push, WSL/DB, Provider, Telegram, ysna, browser, main merge는 `NOT_EXECUTED`다.
- 최종 마감: checker `PASS sequence=498 reporting=AUTO_CONTINUE`; `git diff --check` PASS; dirty exact9 hash `83E130DB...D232`; base 대비 union exact64 hash `00293DE6...9A10`; seq1~495 raw/canonical 불변; secret 원문 패턴 0; generator/finalizer before→cycle1 및 cycle1→cycle2 bytes 동일.

### seq498 independent review rework

- 독립 review: `SPEC FAIL / QUALITY REWORK / C0 / I3`. I-1 exact binding/event/digest fail-closed 누락, I-2 real-Git fast-path structural guard 우회, I-3 판정보고서 리터럴 `+` 손상을 수락했다.
- TDD RED: seq498 focused `5 failed, 2 passed`; manifest mutation, feature remote mutation, Markdown `^+`를 실제 재현했다.
- GREEN: manifest/source/WI, 세 event 전체 envelope/details, digest bytes/canonical/scope/self-reference를 exact 검증하고 공통 repository structural helper를 public Git 경로에 합성했다. 보고서는 정상 Markdown으로 재생성했다.
- focused GREEN: `7 passed, 145 deselected`; checker와 diff-check PASS. full fresh 및 최종 멱등 검증은 아래 재작업 마감에서 기록한다.
- 재작업 full fresh: `152 passed`, `F=0`, `E=0`, `545.42s`, exit0.
- 재작업 오류 fingerprint `SEQ498_REVIEW_I1_I2_I3`은 RED 1회 후 GREEN으로 해소했으며 반복 3회 조건은 없다.

# C-21 WSL QA 실행 결과 — seq495

- 담당: `seq495_result_binding`; 상태: `TEST_REVIEW_PENDING_INDEPENDENT_JUDGMENT`; ProductValidation=`SUITABLE` (승인된 WSL 범위만).
- `a342d62391a44b349733d1468ac3b180761155ab`를 PG15/PG18RC에 배포·2회 verify하고 genuine `324eb169fedbce958d2e8cc29362deb7af433677` rollback/독립 관찰/candidate 복귀/cleanup을 완료했다. exact project residue는 container/network/volume `0/0/0`.
- 환경 오류: pre-mutation SSH alias 2회, PowerShell quoting 1회, 로컬 PowerShell `@{u}` parse 1회; 모두 product valid failure 0이며 해소했다. 외부 SSH flood는 Main failure가 아니다.
- 미실행: Telegram, Provider, ysna, browser Network, main merge. C-01 차단 유지, DIR-2 미발생.
- 다음: frozen seq495 exact10을 독립 Tester가 판정한 뒤 Main이 acceptance/lease 회수 여부를 별도 event로 결정한다.
- TDD: 신규 manifest 부재 RED 1건을 확인한 뒤 seq495 focused 3/3 PASS와 checker PASS를 확인했다. 첫 전체 tooling은 `142 tests / 467.659s / 13 failures`; seq495-current와 seq494 historical fixture 혼합 및 fast-path의 generic reason-code 누락으로 분류했다. 보완 후 실패목록 focused는 12건 중 11 PASS/1 FAIL, 남은 base ancestry reason-code를 복원한 단일 focused는 PASS다. 최종 전체 tooling 재실행 결과는 후속 마감 행에 기록한다.
- 비제품 실행 오류: 로컬 Python 미설치 확인 2회, WSL 재호출 권한 거부 1회(재호출 금지 유지), D:\tmp sandbox write 거부 1회는 번들 Python 및 승인된 canonical worktree write로 해소했다. 동일 제품 실패로 집계하지 않는다.
- 최종 전체 tooling 재실행: `142 tests / 540.521s / OK / exit0`. Windows global ignore 접근 경고는 있었으나 test failure/error는 0이다.
- 독립 리뷰 C0/I2 REWORK: active recovery와 HANDOFF machine summary의 실행 전 legacy 값 모순, 3문서 coherent evidence 및 repository projection 변조 fail-open을 재현했다. reviewer mutation 회귀 테스트를 먼저 추가했고 projection-mode/base/head-relation 3개 RED를 확인했다.
- Main verification 명칭 오타 1회: focused 실행 시 실제 클래스 `ProjectProgressContractTests` 대신 `ProjectProgressTest`를 지정해 3 loader error/exit1이 발생했다. 테스트 선택 오류이며 제품 실패 0; 정확한 클래스명으로 즉시 재실행해 위 RED를 확인했다.
- REWORK 검증 명령 범위 오류 1회: 기존 seq495 전체 tooling 기준인 `tests.tooling.test_project_progress` 대신 `unittest discover -s tests/tooling`을 실행해 unrelated historical A13/A14/B12/G07 suite와 npm-cache까지 포함했다. 결과 `510 tests / 897.234s / 16 failures + 1 error / exit1`; npm-cache `EPERM` 1건과 historical fixture/current-tree·encoding mismatch 16건으로, reviewer focused 6 PASS 및 project checker PASS와 분리한다. 이 실패는 삭제하지 않고 올바른 project-progress 전체 파일 재실행 결과를 후속 기록한다.
- REWORK 정식 검증: reviewer mutation table 포함 focused `6 tests / 2.529s / OK / exit0`; seq495 정식 전체 범위 `tests.tooling.test_project_progress`는 `145 tests / 642.358s / OK / exit0`. Windows global ignore 접근 경고 외 failure/error 0이다.
- real-Git `_validate_git_projection` 잔여 fast-path도 공통 구조 guard를 경유하도록 보완한 뒤 focused `6 tests / 3.822s / OK / exit0`, 최종 정식 전체 `145 tests / 779.577s / OK / exit0`을 fresh 재확인했다.
- 최종 마감 명령의 inline secret-pattern regex에서 PowerShell quote parser error 1회/exit1이 발생했다. 파일 변경·secret 출력·제품 실행은 없었고, regex를 제거한 안전한 read-only 마감 명령으로 history/exact/checker/diff를 재확인했다. 제품 실패 0이다.

# Anvil 작업현황

## seq494 로컬 검증 마감 / 2026-09-05

- 담당: Main 어울 관리, pg18_binding_resume 구현 후 seq494_local_finish가 단일 writer 인수. candidate a342d62391a44b349733d1468ac3b180761155ab, candidate56 / record12 / 누적58. Main의 최종 문서 검토·record commit·clean postcommit 검증은 아직 전이며 외부 실행은 하지 않는다.
- tooling 전체 139 PASS/471.73s/exit0은 직전 writer의 실제 결과를 Main에게서 인수했으며 중복 실행하지 않았다. 기존 harness session8103 최종 결과는 세션 소실로 미확인이고 제품 실패나 PASS로 계상하지 않는다.
- 인수 후 frozen harness만 1회 재실행: session96554, 80 PASS / 1 Compose parser SKIP / 428.42s / exit0. stdout·exit는 D:/tmp/anvil-seq494-harness-resume-6fa1d981bdb54491a32aab02a9375c66에 보존했다. SKIP는 로컬 parser 환경 한계이며 실제 WSL 검증 성공이 아니다. 프로세스 확인이 실행 후 이뤄진 인수 절차 누락은 기록했고 이전 suite 잔존 없이 현재 launcher/worker 한 쌍만 확인했다.
- Main 독립 B 검증: I1 보완 직전 핵심 Git/public READY/ABA 4 PASS/53.45s/exit0(session34066), 보완 후 runtime_next_action coherent 변조 거부 1 PASS/7.03s/exit0(session67752). Reviewer I1 해소 후 SPEC PASS / QUALITY APPROVED, Critical 0 / Important 0. 전체 검증 후 문서 마감 검토는 별도다.
- 정상 exact HOLD는 PASS하고 임의 dispatch·다른 HOLD·빈 문자열·필드 누락은 FAIL하는 계약을 유지한다. event494 canonical SHA 644592AE2E1FE61A074455358F786BC84AE4BA28D71D1EEF3AF87154B02314D2, derived2320 bytes/hash2A57298FA53B8D16AA399DEB9DE695620A20581B5FA85845B4C0EEE573647BE6 및 seq1~493·기존 approval/evidence는 변경하지 않는다.
- READY는 기술 준비 상태일 뿐 dispatch 허가가 아니다. runtime_next_action은 HOLD_EXTERNAL_EXECUTION_PENDING_SCOPE_RECONFIRMATION_AFTER_LOCAL_SEQ494_COMMIT 그대로다. private push·WSL·DB·실제 rollback/cleanup·Provider·Telegram·ysna·main 병합은 하지 않았다. 다음은 로컬 기록 마감 후 정확한 candidate/control/ref 및 실행 범위에 대한 외부 재개 조건 확인이다.

### 아래는 준비 당시의 누적 기록



## seq494 승인된 WSL QA 재개 사전 checkpoint / 2026-09-05

- Main 관리·단일 writer pg18_binding_resume. candidate `a342d62391a44b349733d1468ac3b180761155ab` / parent `ad3355baf0aa94da27b8cb6b5ee5a90215ee5994`, correction2 / candidate56 / record12 / post58. 기존 seq1~493·승인 원문·historical evidence 보존. 새 인간 승인을 작성하지 않고 기존 cleanup·ingress 승인 및 WI `52AA197F724F1D0AB59F061D187EFE3744ED86AFC52E5E504DA0E26C4BE04FF8`를 `MAIN_RESUMED_APPROVED_WSL_QA` derived로 연결한다.
- A 로컬 제품 검증: Producer focused7 PASS/22.23s, full76 PASS/1 Compose parser SKIP/363.15s(exit0), Main 독립7 PASS/35.19s, review SPEC PASS/QUALITY APPROVED C0/I0. B seq494 결박·전체 public READY 테스트는 아직 미실행이며 A helper 성공으로 대체하지 않는다.
- `READY_FOR_APPROVED_WSL_QA`는 기술적 준비 상태일 뿐 현재 실행 dispatch 권한이나 배포 성공이 아니다. 최신 PMO 지시는 이번 범위를 로컬 B494 검토·commit·clean postcommit까지만 제한했다. private push·WSL·DB·rollback·cleanup을 실행하지 않고 완료 후 외부 범위를 재확인한다. 현재 후보 push·배포·DB·실제 rollback·cleanup은 NOT_EXECUTED. Main의 predecessor3ref atomic FF push 및 Reviewer fresh clone/content validator/fsck0/residue0만 별도 확인됨. 실제 WSL은324/control3f52이며 ccf/5f8 배포 성공으로 기록하지 않는다.
- 기존 `.env` root:600과 `/srv/anvil-wsl/repo` root 소유권을 보존한다. 아래 자원·실행·정리 목록은 후속 외부 범위 재확인용 사전 계획이며 이번에는 실행하지 않는다. 후속 실행이 허용된 경우에만 Git-only candidate exact56와 그 direct-child control 및 raw manifest/action checksum을 검증한 뒤 Main이 bootstrap/control-runtime을 호출한다. bootstrap/control-runtime은 검증 전에도 제어 checkout·lock/active 경로를 만들 수 있어 read-only 검사로 부르지 않는다.
- 승인 자원: 프로젝트 `anvil-wsl-pg15`, `anvil-wsl-pg18rc`; 각 `anvil-db`, `anvil-web`, `anvil-ingress`(최대6 컨테이너). 기존 internal망 `anvil-wsl-pg15_anvil-wsl`, `anvil-wsl-pg18rc_anvil-wsl`은 internal=true. 승인 ingress-only non-internal망 `anvil-wsl-pg15_anvil-ingress`, `anvil-wsl-pg18rc_anvil-ingress` 두개는 ingress만 연결한다. app/DB outbound는 계속 차단한다.
- ingress image `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, user101/read-only/cap-drop ALL/no-new-privileges/tmpfs16m. `127.0.0.1:4770`, `127.0.0.1:4870` → ingress8080 → web3770, 원 Host/SSE 유지. ysna의 anvil-web:3770 단일 런타임이나 임시 UI Preview와 무관한 WSL 전용 QA ingress다.
- DB 볼륨은 `anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data` 두개만. PG15 mount `/var/lib/postgresql/data`, PG18RC mount `/var/lib/postgresql`. project/service/environment/cleanup-scope labels exact 및 anonymous volume0을 Main이 실측한다. 기존 PG15/18 image와 app image324 상태는 이전 read-only 증거이며 새 배포로 간주하지 않는다.
- 수명: C-21 WSL 검증 동안만 사용하고 성공 증거·복구 자료 보존 후 정리한다. Main 실행 순서는 pinned `control-runtime.sh deploy a342d62391a44b349733d1468ac3b180761155ab` → verify → genuine previous324 rollback → 실제 image/current/health/SSE/DB 독립 관측 → 후보 재배포·verify → cleanup. 각 action에 immutable control SHA/raw manifest/action checksum을 전달한다. rollback approved_commits는 `[candidate,324]`만 허용한다. 이전 dump/receipt는 재배포로 갱신되기 전 별도 보존한다.
- 정리 명령은 검증된 control의 `control-runtime.sh cleanup a342d62391a44b349733d1468ac3b180761155ab`(내부 cleanup.sh)이며, 양 프로젝트 label allowlist를 모두 확인한 뒤 서비스3종·비어 있는 전용망4개·지정 볼륨2개만 제거한다. 이미 없는 자원은 idempotent 처리하고 unrelated 자원/기존 `.env`/자료는 보존한다. Main 최종 Docker inspect/list로 지정 container/network/volume 및 restore scratch DB/cookie 잔류0을 검증한다. 실패 시 부분 상태를 각각 기록하고 전체 PASS를 선언하지 않는다.
- Telegram·Provider 실제 호출, ysna 실행, main 병합 제외. C-21 실제 검증 결과 후에만 별도 결과 event를 append하고 C-01은 독립 판정까지 차단한다. B finalizer는 현재 HEAD와 historical bytes를 검증하며 같은494 event만 재결박하고 다른494는 덮어쓰지 않는다.


## seq493 결박 구현·로컬 검증 완료 / Main 최종 동결 검토 인계

- 기록 대상은 candidate `5f8c301e18c332e3353092dab9efe5c32d0fda84`의 exact12 direct-child 후속 기록이며 candidate54 / 기록 후 누적56이다. 제품 I-3는 로컬 보완·검증됐고 과거492 및 approval/evidence는 불변이다.
- Producer 새 계약 RED: 1 FAIL/129 deselected/0.60s(493 manifest 부재). 보완 후 focused tooling13 PASS/94.70s와 guard16 PASS/122.05s. 최종 전체 tooling130 PASS/445.50s(exit0,8061), harness69 PASS/1 parser SKIP/399.44s(exit0,23190)를 각각 1회 실행했다. SKIP는 Windows Compose parser 부재이며 이번 실제 WSL 실행 증거로 대체하지 않는다.
- Main 독립 critical3 PASS/36.72s(exit0,39021): actual Git exact12 direct-child, runtime HOLD 및 coherent local evidence 외부 성공 승격 거부. Main raw 감사239파일/492 prefix841414 bytes/hash F38EA939…C063/unique493/rollback 제품 byte 불변 PASS. Reviewer 별도 archive402파일·기존 WSL validator AST 보존 PASS/finding0.
- 동일 최종 generator build+finalizer 재실행 비교는 exact12 hash 모두 동일, Changed=[]/Idempotent=true(exit0,7941). event493도 byte 불변으로 이중 append나 기록 rollback이 없었다. 기존492 generator/finalizer는 실행·수정하지 않았다.
- 현재 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`, public guard return22. 현재 private push 상태는 NOT_EXECUTED_EXTERNAL_SCOPE_HOLD다. 실제 push/merge/배포/rollback/cleanup/DB/Telegram/Provider는 하지 않았으며 C-21 완료·C-01 시작으로 승격하지 않는다. Main 최종 기록 commit 검토 전 checksum만 마감한다.

### 아래는 seq493 준비 단계의 누적 기록


## seq493 rollback allowlist 제품 후속 결박 진행 / 2026-09-05

- 담당: Main 어울 관리, 단일 writer pg18_binding_resume. 제품 후보 `5f8c301e18c332e3353092dab9efe5c32d0fda84`, parent `48fbad8be35c7e826dd31363464c7c477d9ca9e8`, correction exact2. 내부 기록 예상 exact12, validated base 누적 candidate54 / record 후56.
- I-3 rollback approved_commits membership 누락은 기존 승인 계약의 제품 구현 결함으로 보완됐다. Producer focused10 PASS(21.78s), 전체 harness69 PASS/1 parser SKIP(346.77s, exit0), Main 독립 focused10 PASS(25.19s), SPEC PASS/QUALITY APPROVED는 로컬 제품 증거다. 새 seq493 결박 테스트는 아직 미완료이며 이전 결과로 대신하지 않는다.
- 직전 로컬 ccf5109 candidate/48fbad8 control은 미push·미배포. 실제 WSL 잔류는 candidate324eb169/control3f52d26이며 보조 internal transport의 API·SSE·Last-Event-ID·backup/restore 성공과 정식 localhost ingress 실패는 과거 증거 그대로 유지한다.
- 현재 gate는 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`. public guard는 고정 exit22로 실행을 거부한다. 제품 I-3의 로컬 보완과 외부 실행 허용은 별개이며 이번 기록 범위에서 push/merge/배포/실제 rollback/cleanup/DB/Telegram/Provider를 수행하지 않는다. C-21 완료나 C-01 시작으로 승격하지 않는다.
- 기존 seq1~492와 historical evidence/approval 원문은 보존하며 seq493 이벤트 단1개만 append한다. cleanup·ingress human approval hash를 유지하고 seq492 derived hash를 부모로 새 내부 구현 수정 binding을 연결한다. 원격 관측은 09:59의 3f52/324 확인이며 새 원격 관측으로 표현하지 않는다.
- 다음: seq493 정적 원문 검토 → focused RED/GREEN → tooling/harness 각1회 → checksum/계보/변조 거부 확인 및 Main 검토. 서버·네트워크·Secret 변경은 없다.


## 2026-09-05 Main 최종 전수 검증과 마지막 fixture 보완

- Main frozen 전체 tooling session87925는 exit0, 123 PASS(394.63s). 전체 harness session59377은 exit1, 1 FAIL/59 PASS/1 SKIP(360.62s)였다. 유일 실패는 새 runtime HOLD가 rollback 알고리즘 fixture보다 먼저 exit22하여 기존 docker log 검증에 도달하지 못한 테스트 경계 문제다.
- Main의 한정 지시에 따라 복사된 rollback 단위 fixture의 guard 호출만 binding 전용으로 계측하고 테스트 이름/주석에 단위 경계를 명시했다. 실제 제품 rollback.sh와 runtime exit22는 변경하지 않았다. 기존 PG15/PG18 image 사전검사 및 Compose 변경0 assertion을 유지했다.
- 보완 단일 node `test_rollback_unit_pg18_preflight_failure_makes_zero_compose_mutations`는 exit0, 1 PASS/60 deselected(6.84s). Main 전체 실패 결과를 단일 전체 PASS로 덮어쓰지 않는다. 최종 결과는 tooling 전수123 PASS, harness 전수59 PASS/1 FAIL/1 SKIP 이후 해당1건 focused PASS로 구분한다. parser SKIP는 기존 실제 WSL Compose 두 target GREEN 증거와 별도다.
- 기록/HANDOFF와 checksum만 마감 재결박한다. candidate ccf5109 제품/과거491 evidence 불변, I-3 미해결 및 runtime BLOCKED_IMPORTANT_I3/exit22 유지. 새 후보 배포·rollback·cleanup·Provider·Telegram은 미실행이고 Main 기록 commit을 위한 최종freeze 상태로 인계한다.

## 2026-09-05 seq492 최종 보완·독립 검증 인계

- 판정: seq492 결박 보완의 writer 검증 완료, Main 독립 전수 검증·기록 commit 전 상태. 새 candidate ccf5109는 미push·미배포다. runtime은 `BLOCKED_IMPORTANT_I3`이며 제품 rollback allowlist 보완이 필요하다. 기존 SPEC PASS/QUALITY APPROVED는 I-3 발견 전 검토다.
- 전체 실행 결과는 tooling5 FAIL/117 PASS(322.92s), harness3 FAIL/53 PASS/1 SKIP(281.38s) 그대로 보존한다. 원인은 historical helper tuple 처리5건과 새 approval blob이 없는 fixture3건으로 서로 다른 테스트 구성 문제다. guard 판정을 완화하지 않고 fixture·helper만 보완했다.
- 보완 후 focused: historical491+seq492 tooling10 PASS/112 deselected(111.53s), harness10 PASS/49 deselected(135.64s), 실제cleanup.sh I-3 진입차단2 PASS/59 deselected(35.99s), HOLD→ALLOWED 변조거부1 PASS/122 deselected(1.51s), 모두exit0. 이를 단일 전체 실행 PASS로 표시하지 않는다. 최종 전체 tooling/harness는 Main이 freeze 이후 독립 수행한다.
- 정합성 함수와 runtime 함수를 분리했다. 정상binding은 PASS지만 실제runtime 진입은 고정exit22로 거부하며 bypass가 없다. 실제cleanup.sh fixture 진입에서 Docker호출0·파일변경0을 확인했다. 삭제 알고리즘 테스트는 별도 계측 fixture의 단위 검증이며 실제cleanup 성공이 아니다.
- Main 독립 감사: historical491 raw827250/hash7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71 및 canonical8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7 보존. 기존 evidence/approval237개 raw bytes가 후보 Git blob과 모두 동일(session64111 exit0). candidate 제품은 수정하지 않았다.
- 변경은 exact13 record 범위이며 HANDOFF·환경문서에 deployed324/control3f52와 미배포localccf/seq492를 구분했다. I-3 최소2파일 후속 제품 제안은 scratch seq492-i3-rollback-proposal.md에 기록했다. 다음은 Main 독립검증·기록 검토 후 별도 I-3 제품 수정 승인·검증이며 자동 deploy/rollback/cleanup 또는 C-01 시작은 금지한다.

## 2026-09-05 seq492 생성·append 검증 진행

- 신산님의 정확한 명시 승인 및 Main 정적 검토 후 require_escalated build exit0. candidate ccf5109/record 계획은51/13/54, derived binding은1634 bytes·8FE8DCD4D90A91393E777E0FABCF60E51A68B93DB2B77197E12FC6445EF2D5EE다. 생성 AST4/guard Bash syntax와 finalizer의 historical491 raw/canonical prefix·last-id assertions 통과 후 seq492 한 행을 append했다.
- 신규 focused 초기2 PASS/1 FAIL은 seq492 head_relation 허용 분기 누락으로 확인하여 기존491을 유지하고492만 추가했다. 해당 회귀1 PASS 후 progress checker492/AUTO_CONTINUE PASS. guard positive 및 approval/derived 동시 재계산 변조 거부는4 PASS(18.69s).
- 별도 audit exit0: exact51/13/54, historical491 raw827250/hash7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71, 기존manifest/digest와 이전 WSL validator AST, 후보 제품 파일 불변 PASS. 전체 tooling43279/harness2406는 각각1회 실행 중이고 일부 실패가 관찰되어 상세 결과 확인 전 완료로 판정하지 않는다.
- Main이 기존324 배포의 mutable server receipt4개를 읽기 전용으로 별도 보존했다. 이는 후속 표준 배포에서 갱신될 옛 receipt 보존이며 새 후보 검증 성공이나 Git historical evidence를 대체하지 않는다. 새 candidate push/deploy/DB/cleanup/Provider/Telegram 실제 실행은 여전히 NOT_EXECUTED다.

## 2026-09-05 seq492 정확 범위 명시 승인 후 재개

- 신산님이 seq1~491/historical evidence 보존, ccf5109용 checker·guard·manifest·승인 binding·finalizer/관련 생성기·계약 테스트 보완과 이벤트 append·계보·변조 거부·checksum 검증을 명시 승인했다. 기존 ingress 원승인 범위와 새 후보 외부실행 NOT_EXECUTED를 유지한다.
- 정식 심사로 scratch generator 정적6항목 보완이 이번에는 승인·적용됐다. actual approval Git blob hash pin, rollback2SHA/fixtureapproval, raw491 불변/id assertions, 491/492 gate분기, actual09:59:29시각/legacyanchor와 private remote 분리, 증거승격금지를 반영했다. 새 approval draft에는 실제ccf후보와 후속 명시승인 원문을 기록했다.
- AST 파싱만 실행하여 GENERATOR_AST_PASS_NO_EXECUTION exit0, git diff --check exit0. generator build와 보호 checker/guard/manifest/events 변경은 아직 미실행이다. exact51/13/54 변경계획을 Main에 제출하여 실행 전 검토 대기한다. 이전 거절3회는 삭제하지 않으며 새 명시승인에 따른 정상 재개와 구분한다.

## 2026-09-05 09:38 seq492 재개 지시 후 플랫폼 재심사 결과

- 신산님의 현재 `계속 진행하자`를 전달받아 동일 seq492 작업의 scratch 정적 제안 보완만 정식 재심사했다. generator build는 실행하지 않았으며 checker/guard/manifest/events 등 보호 파일을 변경하지 않았다.
- scratch `rebind_seq492.py` 단일 파일에 6개 미완성 항목을 보완하는 apply_patch 1회도 플랫폼이 거절했다. 원문: “패치가 단순 정적 검토를 넘어 향후 checker·guard·manifest·approval binding을 재작성하는 생성기의 보안·권한 경계를 확장하지만, 사용자는 해당 구체적 변경을 명시적으로 승인하지 않았습니다.”
- 패치는 전체 미적용이다. 이번 재개 후 거절1회이며 기존 거절2회와 구분한다. 같은 요청 재시도·다른 도구 우회·생성기 실행을 하지 않고 Main에 정확한 원문을 즉시 전달했다.
- 실제 clock 관찰은 2026-09-05T09:38:06+09:00이다. generator의 미래10:00 문구를 포함한 정적 미완성 사항은 여전히 남아 있어 실행할 수 없다. 다음은 구체적 checker/guard/manifest/approval binding/finalizer 보완·seq492 append에 대한 사용자 명시 승인과 플랫폼 재심사이며, 새 기능·push·배포·서버 변경은 포함하지 않는다.
- 권한 거절은 누적3회이며 제품 정식 FAILURE_REPORT 횟수와 별개다. Main 지시에 따라 추가 generator/code 수정·재시도를 중단한다. 코드와 보안 허용 조건을 변경하는 다음 정확한 승인 문구가 필요하다: “기존 seq1~491 및 historical evidence를 보존하면서 ccf5109용 seq492 checker·guard·manifest·승인 binding·finalizer와 관련 생성기·계약 테스트를 보완하고, seq492 append 및 계보·변조 거부·checksum 검증을 수행하는 것을 승인한다.” 이는 아직 검증되지 않은 새 candidate의 성공 선언을 허용하지 않는다.

## 2026-09-05 seq492 결박 실행 플랫폼 거절 checkpoint

- 판정: 제품 candidate `ccf5109d0640bf28c461e7754ad56e0821fd77be` exact7 구현·기본 검증 완료. 아직 push·배포하지 않았고 C-21 완료가 아니다. 이전 `3cc869e`는 복구용 보존ref에만 남은 미배포 중간 후보다.
- 담당: Main이 권한 판단과 외부 실행 담당, pg18_binding_resume 단일 writer는 보호 대상 쓰기·재시도를 중단했다.
- seq492 신규 tooling 계약 테스트는 manifest 없음으로 기대 RED를 확인했다. generator build 요청은 checker·manifest·guard·approval binding 변경의 명시 승인 근거 부족으로 플랫폼에서 거절됐고, 후속 scratch-only 보완 패치도 같은 이유로 거절됐다. 거절2회이며 우회 실행하지 않았다.
- 보호 대상 checker·guard·CandidateReleaseManifest·events 변경은0이다. 현재 dirty는 기존 docs/WORK_STATUS.md와 docs/DEVELOPMENT_ENVIRONMENT.md, 새 approval artifact, 신규 tooling tests다. historical seq1~491 및 기존 evidence는 그대로 보존했다.
- generator는 현재 미완성이므로 실행 금지: 실제 exception approval Git blob hash pin, rollback 두SHA fixture, raw491→492 id 확인, 실제 관찰시각 적용(현재 draft의 미래10:00 제거), seq492 gate/routing 분기 정합성 보완이 남아 있다. 새 approval draft의 중간3cc candidate 표기도 최종ccf5109로 정정해야 한다.
- 다음 정확한 승인 대상: 기존 seq1~491 원문·hash와 historical evidence를 보존하면서 candidate `ccf5109`의 seq492용 checker/guard/manifest/새 approval binding/finalizer를 보완하고 seq492를 append한 뒤 계보·변조 거부·checksum을 검증하는 작업이다. 플랫폼의 명시적 재승인 전 이를 자동 승인된 것으로 간주하지 않는다.
- 현재 이 checkpoint 외 파일 쓰기·generator 실행·재시도는 하지 않는다. Main의 실제 WSL full-suite 결과는 수신 후 별도로 기록하며 미수신 결과를 PASS로 표시하지 않는다.
- Main 추가 검증 실제 결과: full harness session27234는 exit1, 9 FAIL/45 PASS/1 SKIP(263.41s). 실패 상세는 D:\tmp tempdir 설정이 적용되지 않아 C:/Users/.../Temp로 fallback되고 Bash mkdir /c/Users/cyhuh Permission denied로 cold-start log 미생성/control startup 미진입한 환경 경계다. 최종 제품 검증 PASS로 처리하지 않는다.
- Main은 코드 변경 없이 정식 require_escalated 테스트 재검증 session5210을 시작했다. 선택 범위는 `WslColdStartTests or WslControlRuntimeTests` 12개 node이며 실제 결과 대기 중이다. 이 테스트 전용 권한 재검증은 checker/guard/manifest 보호 변경 거절의 우회가 아니다. 보호 대상 및 신규 field/부정 case 생성 쓰기 금지를 유지한다.
- Main 최종 환경 진단: 같은 TEMP 설정에서도 기본 권한은 configured D:\tmp와 달리 selected C:/Users/.../Temp였고, require_escalated에서는 selected D:\tmp와 일치했다. 임시 경로 접근의 실행 환경 원인을 확인했다. 동일 제품 코드의 session5210 재검증은 11 PASS/1 parser SKIP/43 deselected(27.27s, exit0)이며 앞선 실패9개를 모두 포함해 해소했다.
- 종합 검증은 서로 다른 실행의 고유 node 기준54 PASS/1 parser SKIP다. 단일 전체 실행에서54 PASS한 것으로 표시하지 않는다. parser SKIP는 별도의 실제 WSL Compose 두 target GREEN 증거와 구분한다. 제품 `ccf5109` exact7을 유지하며 실제 새 WSL 배포는 수행하지 않았다.
- 현재 유일한 차단은 seq492 checker/guard/manifest/approval binding/finalizer 보완·append를 위한 플랫폼 예외 권한이다. 미완성 정적 제안 보완을 포함한 정확한 사용자 명시 승인이 필요하다. Main이 최종 보고하며, 이 checkpoint 이후 다른 파일 쓰기·재시도·서버 변경을 하지 않는다.

## 2026-09-05 seq491 실제 검증 후 WSL ingress 예외 승인·seq492 준비

- 기준선: clean record/control `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`, candidate `324eb169fedbce958d2e8cc29362deb7af433677`. private push/fresh recovery PASS 후 Main 실제 deploy exit0, PG15/PG18 named volume1씩/anonymous0, migration0013 PASS.
- 보조 runner exit0: PG15/PG18 INTERNAL_BRIDGE_API_CONTRACT에서 authenticated SSE/Last-Event-ID/backupRestore PASS. 정식 verify는 loopback4770 connection refused, rollback은 previous15 없음 preflight로 무변경 종료했다. host/browser ingress 및 genuine rollback/cleanup은 아직 미완료다.
- Main의 restore scratch DB read-only 조회는 두 target 모두0건이며, 임시 cookie/session evidence 디렉터리 조회도0건이다. 샌드박스 WSL E_ACCESSDENIED는 승인된 동일 read-only 재실행 성공으로 해소됐으며 WSL 서비스 장애로 판정하지 않았다.
- 신규 예외: Main은 WI outbound 경계를 ingress까지 적용하고 non-internal망을 새 예외로 분류했다. 신산님의 현재 `승인해`가 직전 제안한 WSL QA ingress-only non-internal망 예외와 구현·검증에 적용됐다. ingress2 container/2 dedicated network만 추가하고 app/DB internal-only, loopback4770/4870, Git-only candidate/control, Provider·Telegram 실제호출 금지, ysna 변경금지를 유지한다.
- writer: `pg18_binding_resume` 단일 writer. 승인된 최소 compose/nginx/deploy/rollback/cleanup/회귀 보완과 환경 문서 정정 진행. seq1~491 events 및 historical evidence는 수정하지 않는다. 현재 문서·제품 dirty는 기준선3f52에서 보존하고 검증·새 candidate 확정 후 seq492만 append한다. 그 전 checker projection mismatch를 숨기거나 PASS로 표시하지 않는다.
- 다음: ingress 정식 host 검증→genuine previous324 rollback→candidate 복귀→후속cleanup/잔류0→C-21 독립 판정. 활성 gate 때문에 C-01과 종속 C-02~20 구현은 아직 시작하지 않는다. 독립 증거/명세/환경 문서 작업은 계속한다.
- 구현 검증 진행: 신규 ingress TDD 3 RED 후 최소 구현, 초기 focused 19 PASS/33 deselected. cleanup network label·unrelated endpoint·absent 추가 케이스를 포함한 관련 전체 harness 실행 중. Bash syntax 3파일 및 diff-check PASS. Main Windows→WSL wildcard 인용 오류1건은 원문/Secret 전송 없이 단일 health 재실행 exit0로 해소; 제품 실패와 구분한다.
- 구현 검증 마감: 관련 harness52 PASS/1 parser SKIP(188.16s), 추가 nginx temp 회귀1 PASS. 실제 Main nginx configcheck는 비root/read-only 조건에서 fastcgi temp 기본경로 오류1회→temp3개 /tmp 명시 후 동일 조건 exit0 PASS. 제품 exact6 freeze, 문서2개는 후속 record로 분리. 아직 실제 host/SSE/rollback 배포 검증과 새 projection은 미완료다.
- Main 독립 실제 WSL docker-compose config --quiet는 PG15/PG18-rc 각각 exit0(dummy 환경, 자원생성 없음). PyYAML parser SKIP와 구분하여 실제 Compose 파싱 증거를 확보했고 bash3/diff-check도 독립 exit0 확인했다.
- 후속 cleanup entrypoint의 .env 미로드를 Main 실제 no-env Compose RED로 확인하여 cleanup.sh에 권위 검증 후 기존 loader를 추가했다. 신규 실행 fixture의 Windows/Bash 경로원인2회는 Main이 테스트 write lease를 인수하여 처리 중이며 통과로 처리하지 않는다. `3cc869e`는 unpublished 중간 후보이고 Main 소유 보존ref `codex/preserve-c21-ingress-3cc869e`에 복구 가능하다. 목적은 candidate amend 전 보존, 새 후보 원격 복구 확인 후 정리를 검토한다. 최종 exact7 candidate SHA 수신 전 seq492 projection은 보류하고 승인 artifact만 새로 준비했다.
- Main 직접 인수 종료: fixture POSIX script arg로 환경경계 수정. load1줄 제거 기대RED1건→복원 후 ingress class5 PASS, cleanup syntax/diff PASS. 전체 관련55node는54 PASS/1 parser SKIP(실제 WSL parser2 target 별도 PASS). exact7 제품 freeze, actual cleanup/새 candidate 배포는 미실행이며 최종 amended SHA를 기다린다.

## 2026-09-05 seq491 WSL cold-start 보완 후보

- Main 검토 후 bootstrap Bash 전달, DB health 최대 120초 대기, tmpfs 단일 mount 및 PG18 volume target 보완을 candidate `324eb169fedbce958d2e8cc29362deb7af433677`에 결박했다. parent는 seq490 control `18fa604531acfd303c10effa528797fbd5b55c8b`이며 correction exact5다.
- 이전 seq490 candidate/control private push와 fresh recovery 검증은 PASS다. 실제 WSL에서는 bootstrap permission error, 최초 DB 준비 전 backup 실패, warm retry에서 backup/image build 성공 후 잘못된 tmpfs로 migration container 생성 실패를 확인했다. PG15 DB는 healthy, migration 실행·web 생성·PG18 실행은 미완료다.
- 새 후보 배포·DB 검증·volume cleanup·Telegram·Provider는 미실행이다. PG15 warm 성공을 새 후보 cold-start 성공으로 표시하지 않는다.
- seq1~490 event bytes와 기존 manifest/digest를 보존하며 seq491만 append했다. exact48 후보/exact11 record/누적 exact50, 자동 private push 정책과 기존 cleanup 승인 범위를 유지한다.
- 담당: developer-primary-wsl 단일 writer. 변경은 successor exact11만. Main review 후 자동 private push/recovery 및 WSL 실제 검증으로 이어간다. C-01은 C-21 독립 판정 전까지 차단한다.

## 2026-09-04 private 개발 Git 시범 전환

- 담당: Main Agent 어울
- 적용 범위: Anvil만 해당하며 다른 프로젝트에는 적용하지 않는다.
- 판정: `ACTIVE_GIT_REMOTE_TRANSITION`
- canonical repository: `D:\Project\Anvil`
- active worktree: `D:\tmp\anvil-c21-operational-execution`
- active branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 기존 공식 remote: `https://github.com/cyhuh7950/anvil.git`
- 기존 공식 remote 역할: 전환 후 `release`
- 계획 private 개발 remote: `sinsan-develop/Anvil`, visibility `private`, 전환 후 `origin`
- private 저장소 존재 확인: `CREATED_AND_BROWSER_CONFIRMED_PRIVATE` (`sinsan-develop/Anvil`)
- GitHub CLI 확인 계정: `cyhuh428-sinsan`; `sinsan-develop` 인증은 아직 확인되지 않았다.
- canonical root dirty 보존: `AGENTS.md` modified, `packages/agent_team/`, `tests/agent_team/` untracked. reset, clean, stash, 삭제, 덮어쓰기 금지.
- C-21 candidate 상태: local commit `93c58f7`, 기존 공식 remote보다 1 commit ahead, 기존 공식 remote push 미실행.
- 생성 예정 외부 자원: `sinsan-develop/Anvil` private repository.
- 생성 이유: WSL-server LLM 개발 전체 history를 비공개로 보존하고 공식 저장소에는 승인된 배포 allowlist만 반영하기 위함.
- owner/lifetime: `sinsan-develop`; Anvil 개발 기간 유지, 종료·이관 시 신산님이 archive/delete 여부 결정.
- 폐쇄 조건: private 개발 history 보존·공식 release 인수·필요 branch/tag archive가 완료되고 신산님이 폐쇄를 승인한 경우.
- WSL SSH 원칙: WSL-server 전용 key pair와 `github-sinsan-develop` alias를 사용하고 Windows private key는 복사하지 않는다. public key만 GitHub 계정에 등록한다.
- 오류: 기존 공식 원격 push가 exact destination 승인 부족으로 1회 차단됨. 최신 Git 분리 지시에 따라 같은 push를 재시도하지 않는다.
- 미검증: `sinsan-develop` GitHub CLI 인증, WSL SSH public-key 등록 필요 여부, private push/clone 복구 검증, official clean RC allowlist.
- 다음 조치: private 저장소와 WSL 전용 SSH 인증을 구성하고 기존 공식 remote를 보존한 채 private remote를 추가하여 push/clone을 검증한다.

## 2026-09-04 C-21 WSL Git SSH 선행작업

- 시작: `2026-09-04T16:59:26+09:00`
- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 승인 범위: 실제 WSL-server 접속 경로 확인, WSL 사용자 홈 전용 ed25519 키 생성 또는 재사용, `github-sinsan-develop` SSH alias 멱등 구성
- 비공개 원칙: private key 내용은 출력·기록하지 않고 public key, SHA256 fingerprint, 권한만 보고한다.
- 금지 범위: 제품·역사 파일, Docker, DB, volume 변경 없음
- 접속 확인: Windows `wsl.exe -d Ubuntu -- ...` → WSL2 `Ubuntu`, user `daon`, home `/home/daon`, hostname `SINSAN`
- GitHub 기존 key 기준: 이름 `sinsan-develop`, fingerprint `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`
- 오류 횟수: 1
- 오류: 첫 key 구성 명령은 Windows→WSL 중첩 quoting으로 WSL의 key 경로가 빈 문자열이 되어 `ssh-keygen`이 즉시 실패했다. 키·config 파일은 생성·변경되지 않았다.
- 다음 조치: quoting 영향을 제거한 stdin script 방식으로 동일 작업을 1회 재실행하고 fingerprint를 기존 GitHub key와 비교한다.
- 키 결과: `CREATED`; `/home/daon/.ssh/id_ed25519_github_sinsan_develop`
- public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICD0B/9D44dRWm06tj8e3XyWPGxh5A/+osehuAgLlvkN anvil-wsl-server`
- WSL key fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- GitHub 기존 key fingerprint 비교: `DIFFERENT`; 새 public key는 GitHub 등록 대기
- 권한: `.ssh=700 daon:daon`, private key=`600 daon:daon`, public key=`644 daon:daon`, config=`600 daon:daon`
- alias 해석: host `github.com`, user `git`, identities-only `yes`, identity file `~/.ssh/id_ed25519_github_sinsan_develop`
- 멱등 검증: alias block count `1`, config hash unchanged `no`
- 오류 횟수: 2
- 오류 2: 기존 alias block 제거 후 앞쪽 빈 줄을 정규화하지 않아 두 번째 적용에서 config 파일 hash가 변경됐다. alias 의미와 단일 block은 유지됐으나 byte-level 멱등 계약은 실패했다.
- 최종 상태: `FAILURE_REPORT`
- failure fingerprint: `WSL_SSH_CONFIG_TRAILING_BLANK_NON_IDEMPOTENT`
- 영향: 키와 alias는 사용 가능한 상태지만 config를 다시 적용할 때 빈 줄이 누적될 수 있다. private key는 재생성하지 않는다.
- 미수행: GitHub public-key 등록, SSH 네트워크 인증, private repository push/clone. 제품·역사 파일, Docker, DB, volume 변경 없음.
- 정확한 다음 조치: 기존 키를 재사용하고 alias block 제거 결과의 trailing blank를 정규화한 뒤 두 번 적용하여 byte hash가 동일한지 확인한다.

### Fix round 1

- 시작: `2026-09-04`
- 상태: `IN_PROGRESS`
- 보존 조건: 기존 `/home/daon/.ssh/id_ed25519_github_sinsan_develop` key와 fingerprint를 재생성·변경하지 않는다.
- 수정 범위: `~/.ssh/config`의 `github-sinsan-develop` 관리 block과 파일 끝 연속 blank/공백만 정규화한다.
- 다음 조치: 변환 전 fingerprint를 확인하고 같은 변환을 2회 적용하여 hash·block count·`ssh -G`·권한을 검증한다.
- Fix round 1 오류 1: 검증 단계의 inline `awk`에서 `$1`이 Bash positional parameter로 해석되어 `bash: 줄 38: $1: 바인딩 해제한 변수`, exit 1이 발생했다. config 변환 2회와 hash 산출은 이미 끝났으나 의미 검증 출력 전 중단됐다.
- 조치: config를 다시 변환하지 않고 현재 파일의 hash·block count·의미값·권한·fingerprint를 read-only 명령으로 검증한다.
- 적용 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded approved fix script> | base64 -d | bash"`
  - script 핵심: fingerprint 선검증 → exact managed block만 `awk`로 제거 → 파일 끝 whitespace-only line 제거 → blank separator 1개와 관리 block append → 같은 함수 2회 실행 → `sha256sum` 비교
  - 적용 명령 exit: 1. 두 번 적용과 `hash1 == hash2`, block count 1 검사는 통과했으나 후속 inline `awk` 의미 출력의 Bash quoting 오류로 종료했다.
- 최종 read-only 검증 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded read-only validation script> | base64 -d | bash"`
  - 검증 명령 exit: 0
- 1차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- 2차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- byte-level 멱등성: `PASS`
- alias block count: `1`
- `ssh -G` 의미값: `hostname github.com`, `user git`, `identitiesonly yes`, `identityfile ~/.ssh/id_ed25519_github_sinsan_develop`
- 보존 fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- 최종 권한: `.ssh=700 daon:daon`, private=`600 daon:daon`, public=`644 daon:daon`, config=`600 daon:daon`
- Fix round 1 오류 횟수: 1
- Fix round 1 최종 상태: `COMPLETED`
- 변경 범위 확인: WSL `~/.ssh/config` 관리 block과 파일 끝 blank만 변경. 기존 key 재생성 없음. 제품·역사 파일, Docker, DB, volume, Git 변경 없음.
- 잔여 작업: fingerprint가 기존 GitHub key와 다르므로 새 public key의 GitHub 등록은 별도 단계에서 필요하다.

## 2026-09-04 C-21 WSL harness review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 변경 범위: `deploy/wsl`, `tests/deploy`, `docs/WORK_STATUS.md`
- findings: I1 Git blob 원본-byte checksum, I2 control/candidate ref 분리 및 verify 선행 guard, I3 fake Docker cleanup 무삭제/정확삭제 계약
- 금지: seq/event historical 파일, commit, push, deploy, 실제 Docker·DB·volume 삭제
- 오류 횟수: 0
- 다음 조치: 실패하는 checksum/ref/verify/cleanup 계약 테스트를 먼저 추가한다.
- TDD RED 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- 최초 RED 결과: exit 1, 15 tests 중 3 failures. control ref exact 제한 미구현 2건(상속 중복), verify 선행 guard 미구현 1건.
- RED 보강: fixture manifest 끝 LF를 추가하여 Git blob raw-byte checksum 결함도 탐지하도록 조정했다.
- 사용자 정정 인수: 정식 alias의 IdentityFile은 `~/.ssh/sinsan-develop`이다. harness 검증 후 기존 key의 fingerprint/권한을 확인하고 alias를 이 경로로 멱등 복원한다. 새로 생성된 `id_ed25519_github_sinsan_develop`은 삭제하지 않고 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다.
- 구현 결과:
  - I1: control Git blob을 `git show ... | sha256sum`으로 직접 hashing하여 끝 LF를 포함한 원본 byte checksum과 일치시켰다. 정상 checksum 및 manifest blob 1-byte 변조 거부 계약을 추가했다.
  - I2: control ref를 `refs/remotes/origin/codex/c21-operational-execution`, candidate ref를 `refs/remotes/origin/candidates/c21-wsl-exact34`로 고정했다. 두 commit의 상이성과 candidate→control ancestry를 강제했다. `verify.sh`는 checksum과 control ref를 요구하고 첫 runtime-state write 전에 동일 guard를 호출한다.
  - I3: fake Docker/Compose로 세 label 각각의 mismatch 및 두 번째 volume mismatch에서 삭제 호출 0건, 정상 시 allowlist의 정확한 두 volume만 삭제함을 검증했다.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `tests/deploy/test_wsl_staging_harness.py`, `docs/WORK_STATUS.md`
- TDD GREEN 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- TDD GREEN 결과: exit 0, `15 passed in 18.56s`
- Bash/diff 명령: 모든 `deploy/wsl/*.sh`에 `bash -n`; `git diff --check -- deploy/wsl tests/deploy docs/WORK_STATUS.md`
- Bash/diff 결과: 각각 exit 0
- 전역 `git diff --check` 참고 결과: exit 1, 범위 밖 `docs/DEVELOPMENT_ENVIRONMENT.md:36 new blank line at EOF`; 해당 파일은 수정하지 않았다.
- 실제 배포·Docker·DB·volume 삭제: `NOT_EXECUTED`
- WSL 정식 key 확인 명령: `wsl.exe -d Ubuntu -- bash -lc <public fingerprint and file metadata only>`
- WSL 정식 key 확인 결과: exit 1, `/home/daon/.ssh/sinsan-develop` 및 `.pub`가 존재하지 않음
- 후속 공개키 inventory: exit 0. 기존 public key fingerprint 어디에도 GitHub 등록 기준 `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`가 없었다.
- 현재 `github-sinsan-develop` alias: `~/.ssh/id_ed25519_github_sinsan_develop`을 가리킴. 이 key는 `UNUSED_UNREGISTERED_RESIDUAL`; 삭제·등록하지 않았다.
- alias 복원: `BLOCKED`; 존재하지 않는 `~/.ssh/sinsan-develop`로 변경하면 SSH alias가 깨지므로 수정하지 않았다.
- harness review 상태: `COMPLETED`
- 전체 결과: `FAILURE_REPORT`
- failure fingerprint: `WSL_OFFICIAL_SINSAN_DEVELOP_KEY_MISSING`
- 오류 횟수: harness 0, WSL 정식 key 확인 1
- 정확한 재개 조건: 올바른 WSL-server 경로 또는 기존 `~/.ssh/sinsan-develop` key가 존재하는 환경을 확인한 뒤 fingerprint `SHA256:RYy...` 일치와 권한을 검증하고 alias block을 멱등 복원한다.

### 정정 checkpoint

- 정정 근거: `~/.ssh/sinsan-develop` key와 `github-sinsan-develop` alias는 WSL이 아니라 Windows 사용자 SSH 설정이며, Windows `ssh -G`에서 확인됐다.
- WSL 판정 정정: WSL에 위 경로가 없는 것은 제품 또는 harness 실패가 아니다. WSL alias를 존재하지 않는 경로로 변경하지 않는다.
- WSL 신규 key: `/home/daon/.ssh/id_ed25519_github_sinsan_develop`은 GitHub 미등록 상태의 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다. 등록·삭제·재생성하지 않았다.
- 외부 인증 다음 조치: Windows의 기존 등록 key를 사용해 private repository push 인증을 우선 검증한다.
- harness I1-I3 최종 상태: `COMPLETED`
- 전체 최종 상태: `COMPLETED_WITH_EXTERNAL_AUTH_PENDING`
- 미검증: Windows key를 사용한 private repository 실제 push 인증. 이번 범위에서 push는 실행하지 않았다.

## 2026-09-04 비의미 EOF cleanup 및 candidate 외부 쓰기 계획

- 담당: `developer-primary-wsl`
- 상태: `VALIDATING`
- 비의미 cleanup: `docs/DEVELOPMENT_ENVIRONMENT.md`의 의미 내용은 유지하고 EOF 여분 blank line만 제거하여 단일 LF로 정규화했다.
- planned external write source: local commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- planned external write destination: private `sinsan-develop/Anvil`의 `refs/heads/candidates/c21-wsl-exact34`
- 목적: immutable WSL candidate를 private 개발 저장소에 보존한다.
- 공식 origin: 변경하지 않고 그대로 보존한다.
- rollback: private candidate branch 삭제이며 별도 승인이 필요하다.
- 현재 상태: `PUSH_NOT_EXECUTED`; 실제 push는 Main Agent가 수행한다.
- 외부 Git 전환 오류 1회: active worktree에서 `git remote add development ...`가 shared gitdir `D:/Project/Anvil/.git/config` 권한 거부로 실패했다. 제품 파일 변화는 없다.
- 외부 Git 전환 오류 조치: Main Agent가 승인된 Git 전환 범위에서 escalated 명령으로 재실행한다.
- 다음 조치: 전체 `git diff --check`와 focused harness 15 tests를 재실행해 결과를 기록한다.
- 전체 diff 검증: `git diff --check` → exit 0
- focused harness 검증: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.32s`
- 최종 상태: `COMPLETED`; commit·push는 수행하지 않았다.
- exact push 안전 게이트: `git push development 93c58f7...:refs/heads/candidates/c21-wsl-exact34`는 private remote와 대상 저장소에 대한 구체적 승인 부족으로 거부됐다.
- 재시도 정책: 동일 push 재시도·우회 금지.
- 필요한 정확한 승인: source commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`의 전체 history/content를 private `git@github-sinsan-develop:sinsan-develop/Anvil.git` branch `refs/heads/candidates/c21-wsl-exact34`로 push하는 승인.

## 2026-09-04 C-21 WSL governance control successor

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- isolated worktree: `D:\tmp\anvil-c21-operational-execution`; git dir와 common dir가 달라 기존 linked worktree임을 확인했다.
- 시작 branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 시작 dirty 보존: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `tests/deploy/test_wsl_staging_harness.py` modified; `docs/WORK_STATUS.md` untracked.
- 승인 범위: immutable candidate `93c58f7...`, validated base `eef3496...` 대비 cumulative exact34, historical seq1~485 불변, reviewed harness/Git transition docs의 control successor projection.
- 금지 범위: 기존 seq1~485 event/historical 내용 수정, commit, push, deploy, Docker·DB·volume 삭제.
- 탐색 오류 1회: sandbox에서 `rg.exe` 실행이 access denied로 실패했다. 제품 변화 없음; PowerShell 파일 열거로 대체한다.
- 다음 조치: authority/progress/HANDOFF/manifest/digest/checker/test 구조와 historical prefix hash를 읽고 신규 successor 계약 테스트를 RED로 추가한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k c21_wsl_control_successor` → exit 1, 신규 control successor manifest 부재로 1 failure/96 deselected. 요구 기능 부재를 정확히 탐지했다.
- checker 시도 1: `EVENT_EFFECT_MISMATCH`, `EVENT_PAYLOAD_MISSING`, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH`, `PRG_REGISTRY_HASH_MISMATCH`; seq486 envelope와 projection/hash 결박을 보완했다.
- checker 시도 2: `PRG_REFERENCED_HASH_MISMATCH` 1건; 두 번째 historical `progress-events.json` 참조가 구 hash인 원인을 확인해 갱신했다. 동일 fingerprint 연속 반복은 아니다.
- PMO 보고 routing: 향후 checkpoint, 예외, 승인, quality gate, 완료 후보는 parent PMO task `01a054f5-c2b4-7af0-b31a-c8148ef74642`로 직접 보고한다.
- legacy PMO task `01a027a8-0a37-7821-9980-aa029a33e8fd`는 read-only이며 수신·판단·승인 대상이 아니다. 기존 범위·순서·승인은 변경하지 않는다.
- 구현 결과: seq486 `evt_c21_wsl_control_successor_bound`를 append하고 candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`를 base `eef3496...` 대비 cumulative exact34로 고정했다. 기존 seq1~485 내용은 변경하지 않았다.
- CandidateReleaseManifest: `APPROVED_FOR_STAGING_VALIDATION`, candidate ref `refs/remotes/origin/candidates/c21-wsl-exact34`, control ref `refs/remotes/origin/codex/c21-operational-execution`, 승인 원문 SHA-256 `03F4DAC0219F92DA43E2972B59E40453BDB56DF36E9E4E6B4F098BEEBBBADFB7`, rollback exact candidate로 결박했다.
- 신규 evidence: `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`.
- TDD GREEN targeted: WSL active/control projection `2 passed, 95 deselected`; focused harness `15 passed in 18.15s`.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `97 passed in 41.02s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.85s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical prefix: seq1~483 `163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2`, seq1~485 `CC2A98A539CB226DB213CF4E715C599598E4819300A2676EC64E38D15DB2CDE8`, 모두 PASS.
- candidate exact34: `git diff --name-only eef3496... 93c58f7...` 34 paths가 checker의 cumulative set과 완전 일치.
- 오류 횟수: 탐색 `rg` sandbox 1회, checker 보완 round 2회, final suite 기대값 drift 2건 1회. 동일 근본 원인 3회 없음.
- 외부 side effect: push, deploy, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

## 2026-09-04 C-21 control successor review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- review findings: I1 승인 binding이 원문 artifact와 독립 결박되지 않음, I2 seq1~485 canonical JSON hash가 raw whitespace/key-order byte 변조를 탐지하지 못함, minor 개발환경 private repository 상태 불일치.
- 시작 HEAD/branch: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` / `codex/c21-operational-execution`; 기존 control successor dirty 자료를 보존한다.
- historical raw 기준선: candidate `93c58f7...`의 seq1~485 event-object slice와 current slice가 byte-identical, bytes `780353`, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`.
- 승인 원문 hash 검토: 원문 UTF-8만 hash한 기존 `03F4...`와 달리, 이번 artifact 계약은 정확한 원문 뒤 단일 LF를 포함한 509 bytes를 SHA-256한 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`로 명시한다.
- 승인 evidence 조건: source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at은 확인 가능한 `2026-09-04 (Asia/Seoul)`만 사용하며 시각은 추측하지 않는다.
- 금지: seq1~485 event semantic/byte 수정, commit, push, deploy, Docker, DB, volume 삭제. 외부 push 재시도 금지.
- 다음 조치: 승인 artifact 및 raw byte mutation 음성 계약을 RED로 추가한 뒤 checker/manifest/progress binding을 최소 수정한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k approval_artifact_and_raw_historical_bytes` → exit 1, `C21_WSL_HUMAN_APPROVAL_ARTIFACT_MISSING` 1회. 승인 artifact 부재를 정확히 탐지했다.
- 승인 artifact: `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`; file SHA-256 `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`; source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at `2026-09-04 (Asia/Seoul)`로 기록했다.
- 승인 원문 결박: fenced payload의 정확한 원문과 후행 LF 1개를 UTF-8 509 bytes로 해시하여 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`를 산출했다. candidate/control manifest, seq486, progress, HANDOFF가 artifact path/file hash/text hash를 독립 검증한다.
- historical raw 결박: candidate `93c58f7...`와 current의 seq1~485 event-object raw slice가 byte-identical이며 780353 bytes, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`다. whitespace 1-byte 및 semantic-equivalent key-order mutation이 raw hash에서 거부됨을 계약 테스트로 추가했다.
- 보완 오류 1회: key-order 음성 fixture가 CRLF를 가정해 `RAW_KEY_ORDER_FIXTURE_LINE_ENDING_MISMATCH`로 실패했다. 실제 LF로 수정했으며 동일 fingerprint 반복은 0회다.
- TDD GREEN: 동일 targeted 명령 → exit 0, `1 passed, 97 deselected`.
- DEVELOPMENT_ENVIRONMENT 정정: private repository는 browser-confirmed created, temporary `development` remote access는 `VERIFIED`, candidate push는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`로 현재 WORK_STATUS와 일치시켰다.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `98 passed in 52.03s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.78s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical/exact 검증: seq1~483 canonical `163E5D0E...B2D4D2`, seq1~485 canonical `CC2A98A5...2CDE8`, raw seq1~485 `39D6D6EC...7E60FA`, candidate exact34 모두 PASS.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`(seq486만), `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/WORK_STATUS.md`. 기존 harness review 변경은 보존했다.
- 미검증/미실행: private candidate push, control commit/push, WSL 배포, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`. seq1~485는 semantic/byte 모두 변경하지 않았다.
- 다음 조치: Main Agent가 검토 후 exact 승인 경계에서 immutable candidate push와 별도 control successor commit/push를 수행한다. 그 전에는 WSL 실제 배포를 시작하지 않는다.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_REVIEW_FIX_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

### Reviewer Minor 외부 Git 상태 정정

- 기존 `생성 예정 외부 자원` 표기는 당시 계획 기록으로 보존한다. 현재 authoritative 상태는 `생성 완료 외부 자원`: private repository `sinsan-develop/Anvil`이 생성됐고 브라우저에서 Private임을 확인했다.
- GitHub CLI의 `sinsan-develop` 계정 인증 여부는 `NOT_VERIFIED`로 유지한다.
- Windows SSH alias `github-sinsan-develop` 인증은 `SUCCESS`이며 temporary `development` remote access는 `VERIFIED`다.
- candidate push 상태는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`; 실제 candidate push는 `NOT_EXECUTED`다.
- private repository clone 복구 검증은 `NOT_EXECUTED`다.
- 이 정정은 현재 상태를 분리해 명시하는 append-only checkpoint이며 기존 오류·작업 이력의 의미를 변경하지 않는다.

## 2026-09-04 C-21 control successor post-commit fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 시작 branch/HEAD: `codex/c21-operational-execution` / `73c39ca03caa615f7207eac3499c668497cecc5a`; 시작 worktree `CLEAN`.
- upstream/remote head: `origin/codex/c21-operational-execution` / `ca92b7845eda803cff3c432799642e4f9243d4d6`.
- 승인 범위: 실제 committed control commit과 그 exact path set을 신규 seq487 post-commit successor로 결박한다. candidate `93c58f7...`, base `eef3496...` exact34, 승인 artifact와 seq1~485 raw hash는 불변이다.
- 금지: seq1~486 historical event 수정, commit, push, deploy, Docker, DB, volume 삭제.
- 명령 해석 오류 1회: PowerShell이 인용되지 않은 `@{u}`를 hash literal로 해석해 baseline 조회가 실패했다. 제품 변화 없음; ` '@{u}' ` 인용으로 즉시 해소했다.
- TDD RED/checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`.
- TDD RED/tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 1, `3 failed, 95 passed`; 같은 두 repository projection 오류가 원인이다.
- failure fingerprint: `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`; 동일 fingerprint 첫 정식 발생 1회.
- 다음 조치: 기존 post-commit successor 패턴을 따라 seq487, committed control exact path set, progress/HANDOFF/manifest/digest/checker 음성 계약을 append-only 구현한다.
- safety gate 1회: Parent PMO가 canonical `Anvil_작업계획서_v1.md`에 fingerprint/원인/조치/잔여 미검증 기록을 지시했으나, 실행 안전 게이트가 권위 문서 변경에 대한 신산님의 직접 승인이 없다고 판정해 patch 전체를 거부했다. 테스트 파일을 포함한 동일 patch는 원자적으로 적용되지 않아 추가 제품·historical 변화는 없다.
- 현재 상태: `BLOCKED_PENDING_EXPLICIT_WORK_PLAN_MUTATION_APPROVAL`; 우회·재시도하지 않는다. 정확한 재개 조건은 신산님의 `Anvil_작업계획서_v1.md` post-commit 정합화 checkpoint append 승인 또는 Main Agent가 권위 문서 변경을 제외한 축소 범위를 재지시하는 것이다.
- Main ruling: 권위 문서 `Anvil_작업계획서_v1.md` mutation을 축소 범위에서 제외하고 successor evidence/HANDOFF/WORK_STATUS만으로 재개한다.
- 작업계획서 미갱신 분류: `AUTHORITY_DOC_MUTATION_EXCLUDED`; 잔여 미검증이나 승인 대기 항목으로 분류하지 않는다.
- 재개 상태: `IN_PROGRESS_POSTCOMMIT_SUCCESSOR_REDUCED_SCOPE`.
- Main ruling: seq486 `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 immutable historical evidence로 보존하고, seq487 정본은 신규 `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`에 분리한다.
- 경로 비용: committed control exact39와 seq487 post-commit successor exact8을 분리해 신규 manifest 경로 1개가 post-commit path set에 추가됐다. `Anvil_작업계획서_v1.md`는 `AUTHORITY_DOC_MUTATION_EXCLUDED`를 유지한다.
- 현재 GREEN 전 재결박 오류는 `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`의 추가 정식 실패가 아니며, 최초 RED 1회만 유지한다.

### seq487 completion checkpoint

- checker GREEN: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=487 reporting=AUTO_CONTINUE`.
- seq487 binding: committed control `73c39ca03caa615f7207eac3499c668497cecc5a`, candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` exact34, control delta exact14/path SHA-256 `A810194414EE28410CD816CF5EAB5D1D85E1C9D1A1AFCF04ED91C15EAEC1F61F`, cumulative committed exact39을 독립 검증한다.
- 새 정본: `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`; seq486 `C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 byte-immutable historical evidence로 유지한다. seq487 event가 신규 manifest path를 명시한다.
- 독립 raw binding: approval artifact `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`, approval text `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`, seq1~485 raw `780353` bytes/`39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`, seq1~486 raw `782389` bytes/`784A0DC5BBDF916A752B8766E8DA89BB5B5FBC824765713DFB30C31E5269B053`.
- focused tooling GREEN: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `99 passed in 55.26s`. historical validator test은 current seq487에서 immutable seq486 artifact assertion으로 분기했고, post-commit bypass는 canonical branch 외 mutation을 거부하도록 보완했다.
- focused WSL harness GREEN: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.05s`.
- full tooling attempted once: `.venv\\Scripts\\python.exe -m pytest tests/tooling -q -p no:cacheprovider` → exit 1, `445 passed, 19 failed in 104.13s`. seq487 접점 2건은 위 focused GREEN으로 해소했다. 잔여 17건은 `test_a13_repository_scan`, `test_a14_workbench_prototype`, `test_g06_test_assets`, `test_g07_baseline`, `test_phase_g_gate`이며 해당 tests/checkers/authority/A14 assets는 `git diff --name-only 73c39ca -- <paths>` 출력이 없어 control SHA 대비 unmodified baseline이다. 원인은 existing A13/A14/B12/G07 baseline/hash expectation drift와 `npm ci --offline` cache `EPERM`; 재실행하지 않았다.
- 오류 계수: formal `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1` 1회 유지. GREEN 전 registry/reference rebinding 오류는 각각 단일 원인 확인 뒤 해소했고, 동일 seq487 failure 3회에 도달하지 않았다.
- 권위 문서: `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지; `Anvil_작업계획서_v1.md`를 수정하지 않았다.
- 미실행/미검증: commit, push, deploy, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; full tooling 17 baseline failures는 seq487 completion evidence가 아니다.
- 다음 안전 조치: Main이 exact dirty path set과 evidence를 검토하고 별도 승인 범위에서만 commit/push를 판단한다.

### Reviewer final disposition

- reviewer 판정: `SPEC PASS` / `QUALITY APPROVED`; Critical/Important finding 없음.
- reviewer 재검증: checker PASS, focused contract 3개 PASS, WSL harness 15 PASS, candidate exact34/control delta14/cumulative exact39 및 seq1~485·seq1~486 raw hash 일치.
- full tooling baseline: base 기준 `443 passed / 20 failed`; 그중 detached 환경 3건과 기존 baseline 17건으로 분리한다. seq487 change의 회귀 또는 commit 차단 사유로 승격하지 않는다.
- Minor M1: 신규 postcommit test는 manifest field 변조를 직접 커버한다. noncanonical branch 및 extra dirty path의 actual negative case는 후속 package에 흡수하며, 현재 commit을 차단하지 않는다.
- 외부 side effect/권위 문서 상태는 이전 checkpoint와 동일하다: commit/push/deploy/Docker/DB/volume cleanup/Telegram/Provider `NOT_EXECUTED`, `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지.

## 2026-09-04 C-21 post-commit successor formal failure round 2

- 시작 branch/HEAD: `codex/c21-operational-execution` / `4eeff02053ac28f0cf127851f7b722e7f99f1ce2`; worktree `CLEAN`.
- TDD RED/checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`.
- TDD RED/focused tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 1, `3 failed, 96 passed`; 세 failure 모두 같은 현재 bundle repository projection 오류다.
- failure fingerprint: `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`의 두 번째 정식 발생. 원인: control SHA를 exact HEAD로 결박한 뒤 successor commit이 HEAD를 다시 변경하는 self-reference다.
- 안전한 수정 원칙: seq1~487/events/existing manifests는 불변으로 유지한다. canonical branch clean HEAD가 control `73c39ca...`의 descendant이고 `73c39ca..HEAD` cumulative path set이 seq487 postcommit exact8이며 현재 content contracts가 통과할 때만 local descendant를 허용한다. old upstream `ca92b784...`은 private push 전 expected remote로 명시 검증한다.
- PMO 전달 예외: parent PMO task `01a054f5-c2b4-7af0-b31a-c8148ef74642`로 round2 checkpoint 전송은 payload/destination에 대한 신산님의 구체 승인이 없다는 safety gate로 거부됐다. `PMO_REPORT_NOT_DELIVERED_SAFETY_GATE`; 재시도/우회 금지. 정확한 재개 조건은 신산님의 해당 PMO task·payload·destination 전송 직접 승인이다. 기술 fix는 독립 범위로 계속한다.
- 다음 조치: checker/test의 self-reference-free descendant contract와 fail-closed negative cases를 구현하고 GREEN verification을 실행한다.

### round 2 stabilization result

- stable contract: exact HEAD equality와 descendant commit count를 제거했다. canonical branch의 control `73c39ca...` ancestor, `73c39ca..HEAD` exact8 path set, private-push 전 upstream `ca92b784...`, current seq487 manifest/digest/approval/raw/candidate contracts를 조합해 local descendant를 허용한다.
- initial live checker는 WIP dirty 상태에서 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed 했으며, 이 precommit 결과는 formal round2 RED evidence로 보존한다. 이후 현재 WIP는 seq487 exact8의 subset만 허용하는 bounded verification mode로 제한했고 extra dirty path는 fail-closed다.
- clean simulated contract 및 negative coverage: noncanonical branch, extra post-control path, dirty tree, control non-ancestor, manifest field, detached digest, historical raw hash 변조를 모두 reject한다.
- checker GREEN: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=487 reporting=AUTO_CONTINUE`.
- focused tooling GREEN: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `99 passed in 60.94s`.
- focused harness GREEN: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.29s`.
- whitespace: `git diff --check` → exit 0. commit/push/deploy/Docker/DB/volume/Telegram/Provider는 계속 `NOT_EXECUTED`.

## 2026-09-04 C-21 post-commit successor review fix round 2

- Reviewer Important 조치: `_validate_git_projection`의 bounded WIP bypass를 완전히 제거했다. seq487 dirty worktree는 path가 postcommit exact8의 일부·전부여도 항상 `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed한다.
- expected live precommit checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_WORKTREE_DIRTY`. 현재 uncommitted checker/test/progress/digest/manifest/WORK_STATUS 변경 때문에 기대되는 결과이며 origin/path mismatch는 발생하지 않는다.
- clean integration simulation: actual `_validate_git_projection` 경유 canonical descendant exact8은 PASS. partial allowed dirty, current exact6 dirty, extra untracked dirty, noncanonical branch, old upstream 아닌 remote, control non-ancestor는 모두 fail-closed 음성 계약으로 추가했다.
- retained content negatives: postcommit manifest field, detached digest, historical raw hash 변조 reject를 유지한다.
- focused integration: `pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k postcommit` → exit 0, `2 passed, 98 deselected in 1.86s`; focused WSL harness → exit 0, `15 passed in 18.89s`; `git diff --check` → exit 0.
- clean committed-tree checker GREEN은 Main의 후속 commit 뒤에만 실행 가능하다. commit/push/deploy/Docker/DB/volume/Telegram/Provider는 `NOT_EXECUTED`.

### round 2 scoped re-review Minor fix

- actual `_validate_git_projection` integration simulation에 explicit tracked out-of-contract dirty case ` M arbitrary-tracked.txt`를 추가했다. 기존 partial allowed/current6/extra untracked cases와 동일하게 `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed한다.
- seq/event/history/workplan은 수정하지 않았고, checker/test hash에 따른 current progress/detached digest/postcommit manifest raw checksum만 재결박했다.

## 2026-09-04 C-21 postcommit evidence checkpoint

- postcommit HEAD: `67c477bed49fe24eea95dbbf4109208a4e96c1a7`; 시작 worktree는 clean이었다.
- postcommit evidence: checker PASS sequence=487, focused progress `100 PASS`, WSL harness `15 PASS`, `git diff --check` PASS. `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1` formal round2는 해소됐다.
- stable contract: control `73c39ca...` 이후 cumulative exact8 path/content contract는 record-only successor commit 뒤에도 유지돼야 하며, clean committed tree에서만 local descendant를 허용한다.
- PMO report: parent PMO egress는 safety gate로 `NOT_DELIVERED` 유지다. 재시도/우회하지 않으며, 정확한 재개 조건은 신산님의 destination과 payload에 대한 explicit egress approval이다.
- commit/push/deploy/Docker/DB/volume/Telegram/Provider는 `NOT_EXECUTED`.

## 2026-09-04 20:23:22 +09:00 C-21 push safety-gate rejection

- current HEAD: `5251a0b889f4e1062a5780eea9f03d8e9b9f69bb`.
- exact command: `git push development 93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad:refs/heads/candidates/c21-wsl-exact34`.
- result: `SAFETY_GATE_REJECTED`; user phrase `진행하자` was insufficient explicit payload/destination egress approval. Safety-gate lineage failure count incremented to `2` (not a product failure).
- no workaround attempted. Control ref push, recovery clone, remote rename, and WSL deploy were not executed.
- exact resume condition: explicit approval of both full-SHA pushes to `git@github-sinsan-develop:sinsan-develop/Anvil.git` and recovery clone create/verify/delete.

## 2026-09-04 21:40:19 +09:00 C-21 control-runtime hardening takeover

- read-only WSL audit found that candidate checkout could replace the later `verify.sh` command path; runtime execution remained `NOT_EXECUTED`.
- Developer fix round produced the initial separate control checkout, then independent review reproduced stale-descendant execution and rollback preflight gaps.
- first rework closed rollback approval/two-target preflight, but dependency-closure and concurrent active-pointer findings remained.
- the same incomplete condition (required adversarial tests not written before turn end) repeated three consecutive handoffs; Main stopped further Developer dispatch and performed the approved direct takeover. This is a takeover-policy count, not a product-failure count.
- Main TDD evidence: abandoned-stage cleanup RED failed with residual `stage.abandoned`, then GREEN passed; concurrent invocation RED exposed non-portable active symlink replacement, then the locked atomic text pointer plus exact physical stage execution passed.
- current local focused evidence: dependency-only descendant rejection, failed-stage cleanup, and serialized concurrent invocation `3/3 PASS`.
- external push, remote rename, recovery clone, WSL runtime, Docker, DB, Telegram, and Provider remain `NOT_EXECUTED`.
- final independent review after Main takeover: `SPEC PASS / QUALITY APPROVED`, Critical/Important/Minor residual finding `0`.
- final local verification: focused stale-lock/dependency/stage-cleanup/concurrency `4/4 PASS`; full WSL harness `24 PASS` in `49.430s`; all WSL shell syntax and `git diff --check` PASS.
- stale `.publish.lock` now fails within configured `1..600s` instead of waiting forever; ordinary cleanup errors cannot strand an owned lock, and `active.next.*` residues are removed under the lock.
- next internal action: commit the reviewed harness, then append a non-retroactive successor projection binding the new control commit before any private push or WSL execution.

## 2026-09-04 C-21 seq488 control-runtime successor projection

- 담당: `developer-primary-wsl`; 시작 branch/HEAD: `codex/c21-operational-execution` / `ead1214e3f01e68e577c3163e1cf143ee5753490`; 시작 worktree clean.
- 상태: `IN_PROGRESS_TDD_GREEN`; 승인된 brief의 record-only exact8 범위만 수정하며 seq1~487와 historical manifest/digest는 byte-immutable로 보존한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k control_runtime_successor` → exit 1, `2 failed, 100 deselected`; `C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json` 부재와 `FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42` 미지원이 의도한 결함이다.
- 오류 횟수: formal fingerprint `C21_WSL_CONTROL_RUNTIME_SUCCESSOR_UNBOUND_R1` 1회; 동일 오류 반복 0회.
- 미검증/미실행: GREEN/full tooling/checker/diff는 아직 실행 전이다. commit, push, SSH, WSL, Docker, DB, volume, Telegram, Provider는 `NOT_EXECUTED`; C-01은 계속 차단한다.
- brief 전사 오류 정정 ledger: brief의 record exact8 hash `...F00`은 63자리로 SHA-256이 될 수 없다. 지정 8경로를 UTF-8 canonical sorted JSON(`separators=(",", ":")`)으로 계산한 실제 값은 `E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B`다. Main은 마지막 `B` 누락을 명백한 전사 오류로 확정하고 64자리 실제값 사용을 ruling했다. 범위·요구사항·중요 위험 변경은 없다.

### seq488 completion checkpoint

- 상태: `COMPLETED_FOR_REVIEW`; record commit SHA는 self-reference 규칙에 따라 기록하지 않았고 commit/push를 실행하지 않았다.
- TDD GREEN: 동일 focused 명령 → exit 0, `2 passed, 100 deselected`; 역사 seq487와 seq488 postcommit 음성 계약을 함께 확인한 focused 명령은 `4 passed, 98 deselected`다.
- full tooling progress: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `102 passed in 73.62s`.
- precommit checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=488 reporting=AUTO_CONTINUE`; HEAD=`ead1214...`와 dirty exact8만 허용됨을 확인했다.
- 보완 오류 1: `HISTORICAL_SEQ487_CURRENT_HEAD_PATH_MIX` 1회. seq487 역사 projection test가 현재 seq488 HEAD/path를 혼입해 실패했으며 historical commit의 seq487 bundle과 synthetic clean exact8 descendant로 분리해 해소했다. 동일 fingerprint 반복 0회다.
- 보완 오류 2: `SEQ488_SELF_REFERENCED_TOOL_HASH_STALE` 1회. 변경된 checker/test의 `latest_evidence_refs`가 seq487 hash를 유지해 `PRG_REFERENCED_HASH_MISMATCH` 3건을 냈으며 현재 portable hashes와 snapshot/digest/manifest를 재결속해 해소했다. 동일 fingerprint 반복 0회다.
- immutable 확인: seq1~487 raw `786441` bytes / `A230B994745047786883CEF8F94279EAE239DB359F3A923717961F8552008C17`, canonical `E2752DBA9CEE5989D7AF890C83A0AD82886A610965CAAEC060EE4079A076295C`; historical event/manifest/digest mutation은 0이다.
- 변경 record exact8: `docs/WORK_STATUS.md`, `docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`.
- 미실행: commit, push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 다음 안전 조치: Main이 exact8 diff와 보고서를 검토한 뒤 별도 권한 경계에서 record commit/push 여부를 판단한다.

#### seq488 오류 ledger 보충

- 최초 full tooling은 `97 passed, 5 failed`였다. `SEQ488_PROGRESS_EVENT_REF_STALE` 1회가 `PRG_REFERENCED_HASH_MISMATCH` 3건을, `HISTORICAL_SEQ487_CURRENT_HEAD_PATH_MIX` 1회가 역사 projection 2건을 발생시켰다.
- 역사 fixture 분리 후 focused 재검증의 `HISTORICAL_SEQ487_NEGATIVE_FIXTURE_CLASSIFICATION` 1회는 extra control path만 바꿔 상위 origin 오류로 분류된 기대값 불일치였다. cumulative path에도 같은 extra path를 주어 exact path-set 음성 계약을 직접 검증하도록 해소했다.
- 이후 full tooling의 `99 passed, 3 failed`는 `SEQ488_SELF_REFERENCED_TOOL_HASH_STALE` 1회가 변경된 checker/test의 과거 reference hash를 유지한 결과였다. current portable hashes 및 snapshot/digest/manifest를 재결속해 최종 `102 passed`로 해소했다.
- 위 세 보완 fingerprint와 formal `C21_WSL_CONTROL_RUNTIME_SUCCESSOR_UNBOUND_R1`은 각각 1회이며 동일 fingerprint 연속 반복은 0회다.

## 2026-09-04 C-21 seq488 reviewer fix round 1

- 판정: `COMPLETED_FOR_REVIEW_FIX_ROUND_1`; seq488 event sequence와 record exact8 범위는 유지하고 제품·historical predecessor·authority 문서는 수정하지 않았다.
- Main coordination error: 최초 seq488 완료 뒤 독립 reviewer dispatch를 누락한 `MAIN_REVIEW_DISPATCH_OMISSION_SEQ488_R1` 1회. 제품 failure가 아니며 review finding을 받은 즉시 fix round 1로 재개했다. 동일 coordination error 반복은 0회다.
- reviewer finding 1 RED: 실제 임시 Git clone에서 valid direct exact44 record는 PASS했지만, ead1214 direct record가 base content를 복원해 base→HEAD exact43이 된 경우 기존 checker가 `[]`로 허용했다. 동일 fixture는 second exact8 descendant와 ead1214 외 추가 parent를 가진 merge record도 구성한다. fingerprint `SEQ488_POSTCOMMIT_LINEAGE_UNDERCONSTRAINED_R1` 1회.
- reviewer finding 2 RED: manifest의 `push/deployment/database/volume_cleanup/telegram/provider` 중 하나를 `EXECUTED`로 바꾼 mutation이 기존 validator에서 `[]`로 통과했다. C-01 `READY` mutation도 같은 누락에 포함한다. fingerprint `SEQ488_MANIFEST_EXTERNAL_BOUNDARY_UNGUARDED_R1` 1회.
- GREEN: postcommit은 ead1214를 유일한 parent로 갖는 단일 record commit, ead1214→HEAD exact8, base→HEAD derived exact44, clean/canonical old-remote 상태를 모두 만족할 때만 허용한다. exact43 reversion, second descendant, extra parent는 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`로 거부한다.
- manifest GREEN: `push`, `deployment`, `database`, `volume_cleanup`, `telegram`, `provider`는 모두 정확히 `NOT_EXECUTED`, `c01_status`는 정확히 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`여야 한다.
- focused GREEN: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k "control_runtime_successor or control_runtime_postcommit_real_git"` → exit 0, `3 passed, 100 deselected in 28.87s`.
- test/setup 오류: `SEQ488_R1_TOOL_WRAPPER_DECLARATION_TYPO`, `SEQ488_R1_SKILL_REFERENCE_PATH_MISS`, `SEQ488_R1_TEST_FIXTURE_SYNTAX`, `SEQ488_R1_FIXTURE_BASE_PATH_MISSING` 각 1회, 제품 failure 아님, 동일 fingerprint 반복 0회. 각각 wrapper 선언, skill 상대경로, 괄호, base에 존재하지 않는 fixture path를 교정해 해소했다.
- 미실행: commit, push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01 차단 유지.
- 다음 안전 조치: current checker/test hash와 snapshot/digest/manifest를 재결속하고 full tooling/checker/diff/exact8을 재검증한 뒤 Main re-review로 반환한다.

### seq488 reviewer fix round 1 completion checkpoint

- current checker/test portable hash, progress snapshot, detached digest, manifest raw checksum을 순환 없이 재결속했다.
- focused: `3 passed, 100 deselected in 30.19s`; full progress tooling: `103 passed in 120.82s`; precommit checker: `PASS sequence=488 reporting=AUTO_CONTINUE`.
- 변경 범위는 seq488 record exact8뿐이고 scratch report는 `.superpowers` ignore 경로에 별도 유지한다. seq1~487 raw/canonical prefix와 predecessor artifact는 불변이다.
- 상태: `COMPLETED_FOR_REVIEW`; Main re-review 전 commit/push/external action은 계속 금지한다.

## 2026-09-05 C-21 seq489 fresh-clone candidate rebind projection

- 판정: correction review `SPEC PASS / QUALITY APPROVED`; candidate `326476d69a3228f9dfcf64ff1dd056577bcbcf55`는 seq488 control `74ed0d4ac566ccc2877301103663b68272cce5b2`의 single-parent child이며 correction exact2/hash `B2E9A41E7E30999A64BBFA85332791EA44F23D2783A064D3CBEEFFFA4DE8BC1F`다.
- TDD RED: 기준선 checker는 candidate로 이동한 HEAD와 exact44 누적 경로를 seq488 projection으로 해석해 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`를 냈다. 신규 focused unittest는 seq489 manifest 부재와 기존 candidate `93c58f7...` 결박 때문에 2건 실패했다.
- 구현: human approval 네 필드를 보존한 `MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION` 파생 binding, exact44 private candidate ref, seq489 append-only event와 record-only exact11, precommit/direct-child postcommit checker를 추가했다. seq1~488 raw/canonical prefix와 seq488 manifest/digest는 변경하지 않는다.
- 검증: seq488+seq489 focused tooling `7/7 PASS`, guard 음성 계약 `9/9 PASS`, full progress tooling `107 PASS`, full WSL harness `33 PASS`, 전체 `deploy/wsl/*.sh` Bash syntax와 `git diff --check` PASS, precommit checker `PASS sequence=489`다. direct-child/second-child/merge/reversion 실제 Git fixture도 GREEN이며 clean postcommit checker는 record commit 직후 재검증한다.
- reviewer fix I-1: runtime guard가 derived binding SHA-256 `7C0078AD0EACA441088017A6A4C0FF25B85464F198AFC48A177B09C85304D863`와 candidate parent `74ed0d4ac566ccc2877301103663b68272cce5b2`를 exact 비교한다. parent/hash/candidate/ref/manifest checksum을 함께 재결박한 회귀를 거부하며 focused guard `10/10 PASS`, full WSL harness `35 PASS`다. Minor M-1 timestamp는 deferred로 유지한다.
- 미실행: external push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 다음 안전 조치: seq489 exact11 direct-child commit을 검토한 뒤 별도 외부 push 승인을 받아 exact refs push/ls-remote/fresh recovery를 수행하고, 그 뒤 WSL 검증으로 진행한다.

## 2026-09-05 C-21 seq490 Compose runner candidate rebind projection

- 판정: correction review `SPEC PASS / QUALITY APPROVED`; candidate `830ad98546ed82a59524dd5a6cef0a5b7a6a96b0`는 seq489 control `99e83e4b07df1cffced6a89ff16ff2266ddaa426`의 single-parent child이며 correction exact2/hash `BCF8BC3E409715FF2E470D3BEB977E8E410B388BAC253114310D264FD783AA0F`다.
- baseline RED: 기존 checker에서 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH` 3건을 확인했다. 신규 focused unittest는 `seq490 rebind manifest is missing`으로 기대 실패했다.
- 구현: human approval 네 필드와 exact volume/label/exclusions를 보존한 `MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION` 파생 binding, exact46 candidate ref, seq490 append-only event와 record-only exact11, precommit/direct-child postcommit checker를 추가한다. seq1~489 raw/canonical prefix 및 모든 historical manifest/digest/commit은 변경하지 않는다.
- 외부 경계: push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 검증 상태: focused/full tooling, full WSL harness, Bash syntax, diff-check, precommit checker 및 commit 후 postcommit 검증을 이 record에서 수행한다.

### seq490 reviewer fix round I-1

- 독립 리뷰는 active progress/HANDOFF가 승인된 개발·테스트 범위의 private push를 별도 프로젝트 승인 대기로 잘못 기록한 `Important I-1`을 확정했다.
- TDD RED: tooling은 repository `push_status`가 `...BLOCKED_PENDING_EXACT_DESTINATION_APPROVAL`인 것을 검출했고, guard test는 잘못된 private-push policy가 direct-child 검사까지 통과해 policy 전용 거부 사유가 없음을 검출했다.
- 수정 원칙: seq1~489와 seq490 event 원문은 byte-immutable로 유지한다. active progress/HANDOFF/CandidateReleaseManifest/evidence/checker/guard/tests만 `REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH` 및 `MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE` 계약으로 재결박한다.
- 외부 push/WSL/Docker/DB/volume cleanup/Telegram/Provider는 이 fix round에서 실행하지 않는다. push 결과는 실행 후 새 append-only checkpoint로 기록한다.

## 2026-09-05 C-21 seq491 cold-start 및 PG18 volume 경로 보완

- 담당: `developer-primary-wsl` 인수 writer `pg18_binding_resume`. 기존 seq491 dirty exact11은 보존 후 이어서 작업했다. 기존 candidate `ea6f47b33b68d156923528345f6990fd3859b7eb`는 로컬 ref `codex/preserve-c21-ea6f47b-pg18-resume`에 보존했고 dirty binary patch 및 신규 manifest/digest는 `D:\tmp\anvil-seq491-preserve-20260905-pg18-resume`에 checksum과 함께 보존했다.
- 실제 결함 근거: Main이 확인한 공식 PG18 image는 `PGDATA=/var/lib/postgresql/18/docker`, declared volume `/var/lib/postgresql`이다. 기존 named mount `/var/lib/postgresql/data`는 PG18 데이터 경로를 포함하지 않았다. PG18 DB는 아직 생성되지 않았다.
- 최소 보완: `configure_wsl_target`이 PG15에는 `/var/lib/postgresql/data`, PG18 RC에는 `/var/lib/postgresql`을 매번 대입·export하고 Compose named volume target은 필수 변수로 받는다. volume 이름·labels·cleanup·server `.env`·PGDATA 설정은 변경하지 않는다.
- 제품 candidate: `324eb169fedbce958d2e8cc29362deb7af433677`, single parent `18fa604531acfd303c10effa528797fbd5b55c8b`, correction exact5/hash `63D5B1B57251E3A6680BBE62280A434E28AD9DFCE764A8D0C1BD2B161A1DE14D`. 기존 cold-start bootstrap/deploy/tmpfs 보완을 포함한다. seq491 record의 테스트 수정은 candidate에 섞지 않았다.
- 결박: base→candidate exact48, record exact11, 누적 exact50 유지. derived binding은 1063 bytes/hash `C9EC11DE9FCA150F07418449C1A7C554B17909BE8F2647B85C7A763C86D3FA0A`. seq1~490 raw prefix 814540 bytes/hash `E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19` 및 historical manifest/digest는 불변이다.
- 검증 근거: shell 15→18-rc→15 전환 및 자식 프로세스 export 확인, Bash syntax, diff check PASS. Main의 WSL Compose config JSON 두 target 검사도 각 exit0: 정확한 named volume·target·labels·단일 tmpfs 확인. 이는 configuration 검증이며 DB runtime PASS가 아니다. 변경 binding focused 및 필요한 WSL harness 결과는 freeze 직전 추가한다.
- 오류: 인수 전 테스트 session5384는 사라져 결과 미확인으로 유지한다. PG18 재결박에서 prior candidate→candidate 경로 수가 common.sh 추가로 14→15가 된 점을 처음 누락하여 checker1회 실패했고 실제 Git diff/hash 재계산으로 해소했다. 동일 제품 원인 실패 3회 조건은 발생하지 않았다.
- 문서 상태: `docs/DEVELOPMENT_ENVIRONMENT.md`의 seq486/93c58 candidate와 승인 대기 문구는 오래된 상태다. 현재 실행 근거는 최신 checkpoint와 CandidateReleaseManifest이며 환경 문서 정정은 후속 정상 문서 checkpoint에서 수행한다.
- 미검증·다음 조치: 새 candidate의 WSL PG15/PG18 runtime·migration/API/SSE/backup/restore/rollback/cleanup은 아직 미실행이다. 독립 review 뒤 Main이 승인된 private refs push·복구 검증과 WSL gate를 계속한다. Telegram·Provider 실호출은 제외하며 C-01은 C-21 독립 판정 전 차단한다.
- 최종 관련 검증: seq491 focused 5개와 seq490 immutable content1개 `6 PASS,111 deselected`. WSL harness 첫 실행은 `46 PASS,2 환경 FAIL,1 SKIP`; Windows subprocess의 native PATH와 POSIX separator 혼합이 두 fixture에서 중첩 Bash 실패를 만들었다. Main이 반복 실행 경계를 직접 인수하여 테스트 세 PATH 지점을 `str(bin_dir)+os.pathsep+os.environ['PATH']`로 수정했고 두 실패 node 재검증 `2 PASS,47 deselected`(17.01s, exit0)를 확인했다. 총 48개 node 통과, PyYAML parser1개 skip은 실제 WSL Compose config 두 target PASS로 별도 충족했다. 전체 suite를 반복 실행하지 않았다. Main의 WSL 임시 QA 경로도 rmdir exit0로 정리했다.
# C-21 seq499 개발 QA 재개 start projection 진행

- 담당: `seq499_qa_resume`; 상태: `IN_PROGRESS_TDD_RED_PREPARATION`; 기준 HEAD `4178ae78db2c48e176e8543364d09787e54bb4ad`.
- Main 검토 입력: scratch proposal SHA-256 `9A4DAFF9E2D6A86553AB88977D7AEBD56967FA862C12C8C3A18DA7D0985B3837`. 이는 `SCRATCH_ONLY_MAIN_REVIEW_INPUT_NOT_AUTHORITY`이며 승인 기준이나 실행 권위가 아니다. tracked `C-21_DEVELOPMENT_QA_RESUME_WORK_INSTRUCTION.md`가 exact7 실행의 canonical authority다.
- 현재 변경: start exact10 중 WorkInstruction, invocation prompt, WORK_STATUS. seq499~501 Event·lease와 manifest/digest/checker/test는 아직 materialize하지 않았다.
- Provider runtime 9-status/model/capability/drift port는 `NOT_IMPLEMENTED_RUNTIME_PROVIDER_STATUS_PORT`; browser는 page.evaluate/fetch scope only; Telegram은 outbound-free scope only다.
- 외부 실행, commit, push, WSL/DB/browser/Provider/Telegram/ysna/main은 `NOT_EXECUTED`; 기존 seq1~498은 불변이다.
- 오류: 없음. 다음 조치: RED mutation 계약 추가 후 seq499→501 start projection을 생성하고 full fresh 검증한다.

### seq501 start projection 인수 및 full tooling 보완

- 인수 기준: `4178ae78db2c48e176e8543364d09787e54bb4ad`; 기존 dirty exact10과 seq1~498 bytes를 보존했다.
- `SEQ501_DTMP_SANDBOX_WRITE_DENIED` 1회: materializer 최초 실행이 `docs/progress/build-progress.json` 쓰기에서 `PermissionError`로 중단됐다. 제품 실패가 아니며 승인된 `D:\tmp` 격리 worktree 쓰기 권한으로 같은 generator를 재실행해 해소했다.
- `SEQ501_HISTORICAL_SEQ498_CURRENT_BUNDLE_MIX` 1회: full tooling 최초 실행은 `151 passed, 4 failed in 582.51s`였다. seq498 독립 판정 계약 네 개가 현재 seq501 bundle을 읽어 과거 판정과 재개 projection을 혼합한 fixture 오류였다.
- TDD 보완: 네 실패를 RED로 확인한 뒤 `4178ae7` detached historical bundle과 checksum이 결박된 untracked tester authority source를 함께 구성하는 fixture로 분리했다. 관련 focused 재검증은 `4 passed, 151 deselected in 27.95s`다.
- 위 두 fingerprint는 각각 1회이며 동일 유효 제품 실패 3회 조건은 발생하지 않았다. commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 하지 않았다.

#### seq501 start projection 완료 검증

- checker/focused 재결박: `G-05 project progress contract: PASS sequence=501 reporting=AUTO_CONTINUE`; seq501 및 보완 대상 focused `7 passed, 148 deselected in 27.56s`.
- full tooling 재실행: `155 passed in 590.28s`, exit 0. 최초 4개 historical fixture 실패는 모두 해소됐다.
- generator 두 번째 cycle은 exact10 전체 `IDEMPOTENCE_CHANGED=0`; `git diff --check` PASS, dirty path는 start projection exact10과 일치한다.
- 상태: `COMPLETED_FOR_MAIN_REVIEW`; commit, push, WSL/DB/browser/Provider/Telegram 실행은 금지대로 수행하지 않았다. 다음 안전 조치는 Main의 diff·계보 검토 후 developer-primary에게 exact7 QA를 전달하는 것이다.

### seq501 독립 review I-1/I-2 rework

- 판정 입력: independent review `SPEC FAIL / QUALITY REWORK_REQUIRED / C0 / I2`를 수락했다.
- `SEQ501_SCRATCH_PROPOSAL_AUTHORITY_FAIL_OPEN_I1` 1회: 비권위 scratch proposal hash가 manifest에 dangling field로 남고 WORK_STATUS가 이를 승인 기준으로 오표기했다. proposal hash binding을 제거하고 scratch를 Main 검토 입력으로, tracked WI를 canonical execution authority로 분리한다.
- history scope를 분리한다. seq498 Git blob 전체는 `882505` bytes / `B9C412B586999C2DCD530B7E6EDD283CE3A124BF4E98B08F8673A3184D641F78`; 현재 append-only 파일의 seq1~498 event-object prefix는 `882302` bytes / `3659A9808E97F6927E983CFCCD617BF5B1740D60CCDFE16D39D8107C8780C955`; canonical events는 `5BF5777954E769602CD70D9B27AE74836ABD5FF3FEE63A85DD1FDABF2D761BE0`다.
- `SEQ501_GIT_FAST_PATH_UNDERCONSTRAINED_I2` 1회: seq501 public validator가 remote/committed exact64/working-tree mode 일부 mutation을 허용했다. 신규 mutation test RED `2 failed, 155 deselected`; checksum stale을 제거한 재실행에서도 I1 proposal 잔존과 I2 fail-open을 정확히 검출했다.
- 동일 fingerprint 반복은 각각 1회다. commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 계속 금지한다.

#### seq501 I-1/I-2 rework 완료 검증

- GREEN: scratch proposal hash binding을 제거하고 비권위 검토 입력으로 고정했다. manifest는 tracked WI path/hash를 실행 권위로 결박하고 seq498 full Git blob, append-only event-object prefix, canonical event hash를 서로 다른 필드로 검증한다.
- GREEN: seq501 public/real-Git 경로는 branch/upstream/remote/feature remote/base/local HEAD/head relation/worktree status, committed exact64, dirty exact10, working-tree mode, clean 상태, record-direct 플래그를 fail-closed한다.
- 필드명 전환 보완 1회: 기존 mutation test가 제거된 `historical_raw_event_bytes`를 계속 변조해 `1 failed, 4 passed`가 발생했다. 신규 full-file/prefix/canonical 필드 mutation으로 교정했으며 제품 실패가 아니다.
- focused: `5 passed, 152 deselected in 9.80s`; checker `PASS sequence=501`; full tooling fresh `157 passed in 590.78s`; `git diff --check` PASS.
- 상태: `COMPLETED_FOR_INDEPENDENT_REREVIEW`; commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 하지 않았다.

### seq501 post-commit projection Main 직접 인수

- 시작 기록 exact10을 `34eb1725b47c544b6ec314a28428b364a029f3eb`로 커밋한 직후 checker가 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `GIT_DESCENDANT_RECORD_COMMIT_INVALID`를 반환했다. Git 객체와 `git fsck --no-dangling`은 정상이며 원인은 seq501 validator가 pre-commit dirty 상태만 허용하고 동일 exact10의 post-commit clean descendant를 허용하지 않은 계약 누락이다.
- 이 mismatch 계열은 이전 projection에서도 반복된 유형이므로 AGENTS.md의 동일 오류 3회 Main 인수 원칙을 적용해 `developer-primary` 재시도를 중단하고 Main이 직접 인수했다.
- 조치: validated base ancestry, projected parent ancestry, cumulative exact68, descendant exact10, clean worktree, branch/upstream/remote 고정을 모두 만족하는 post-commit 경로만 허용했다. content/hash 검증은 그대로 유지하며 허용 경로 밖 변경은 계속 fail-closed한다.
- focused 계약 검증: `1 passed, 156 deselected`; 실제 checker PASS는 raw checksum·snapshot·digest 재결박 및 보완 commit 후 확인한다. 제품 QA exact7, WSL/DB/browser/Provider/Telegram, push, ysna, main은 아직 시작하지 않았다.
# C-21 Provider 상태 조회 독립 검토 successor — sequence 513

- 담당: Main Agent 직접 인수(무결성 projection), 제품 구현 `developer-primary`, 독립 검토 `provider_status_review`.
- 제품 commit `13b2b4e7dbd0aaec8d8fc8bcf22ed969e9e82fe0`은 Provider 9종의 상태·credential 존재 여부·model 조회 READ 계약을 exact13으로 구현했다.
- Main broad 검증은 `192 passed`; 독립 검토는 `SPEC_PASS / QUALITY_APPROVED / Critical 0 / Important 0 / Minor 0`이다.
- 기존 일반 Git projection에서 같은 `GIT_DESCENDANT_ORIGIN_MISMATCH`·`GIT_DESCENDANT_PATH_SET_MISMATCH`가 3회 반복되어 Main Agent가 인수했다. 신산님이 seq513 전용 predicate의 선행 적용을 승인했으며 exact commit·경로·ancestor·direct-child·clean/dirty 검증은 유지한다.
- 기존 sequence 1~509와 historical evidence는 변경하지 않고 sequence 510~513을 append했다. 제품 exact13과 record exact8 외 경로 변경은 허용하지 않는다.
- 실제 Provider 호출, Telegram outbound, WSL PG15/PG18RC, ysna 배포, main 병합은 모두 `NOT_EXECUTED`; C-21은 아직 수락되지 않았고 C-01은 차단 상태다.
- 다음 안전 조치: 개발/WSL 전용 test session에 `provider:read`를 exact endpoint allowlist로 추가하는 successor를 발행하고 로컬 검증 후 Git-only PG15/PG18RC candidate를 결박한다.
# C-21 Provider WSL Auth successor 시작 — sequence 516

- 담당: `developer-primary`; 상태: `LOCAL_IMPLEMENTED_PENDING_GIT_ONLY_CANDIDATE`; Main은 progress·lease·검토를 관리한다.
- 독립 review 1차는 `REWORK / C1 / I2`: 기존 `.env` 재작성 temp의 secret 노출·잔류, 비대상 bytes 정규화, Provider trailing-slash 307→200 허용을 검출했다. fingerprint `C21_PROVIDER_WSL_AUTH_REVIEW_R1` 1회다.
- REWORK 1차에서 secure temp·cleanup·binary byte transform을 적용해 temp 보안과 LF/CRLF/final-newline 보존을 해소했다.
- 독립 review 2차는 `REWORK / C0 / I2`: 전역 redirect 차단의 Provider 외 API 범위 초과 회귀와 0400 fixture의 잘못된 temp mode 기대값을 검출했다. fingerprint `C21_PROVIDER_WSL_AUTH_REVIEW_R2` 1회다.
- REWORK 2차는 Provider exact3 slash variants만 좁게 거부하고 다른 API redirect 계약을 보존하며 0400 test oracle을 교정했다. 동일 package 유효 실패 누계 2회로 Main 직접 인수 threshold 3회에는 도달하지 않았다.
- 제품 commit `0f70afeabe9a031e7960d49cfe27c808c0770d16`은 parent `b85d2b48e14f513e326054bc0be28009f269a827` direct child exact7이다. 독립 최종 review는 `SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`다.
- Main 검증은 API `117 passed`, WSL focused `10 passed, 2 skipped`, bash syntax/diff-check PASS다. candidate WSL의 실제 0600/0400·signal/move-failure residue·PG15/PG18RC는 미검증이다.
- sequence 517~524는 두 review/rework, write/worker lease 회수, package 완료, 최종 review를 append-only로 기록했다. 다음은 `PREPARE_C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE`다.
- dispatch HEAD: `b85d2b48e14f513e326054bc0be28009f269a827`; 제품 write lease는 exact7/path hash `43388FD076A9F799DC8AE3FC7EDABA6E682CFD1618BBE3721EC347F6E62FB11A`다.
- 목표: 개발·WSL test session에 `provider:read`를 추가하되 Provider GET exact3만 허용하고 mutation·유사 경로·비정상 scope는 fail-closed한다.
- sequence 514~516으로 worker lease → write lease → package start를 기록했다. 실제 Provider·Telegram·WSL·ysna·main·DB migration은 `NOT_EXECUTED`다.
- 직전 시스템 안전 검토 서비스의 usage limit은 제품 실패가 아니며 동일 실패 횟수에 포함하지 않는다. 부분 반영된 start projection은 Main이 즉시 완결하고 제품 exact7은 Subagent가 TDD로 수행한다.

### seq524 historical seq513 mutation fixture 보완

- 오류 fingerprint `SEQ524_HISTORICAL_SEQ513_CURRENT_BUNDLE_MIX` 1회: `test_c21_provider_status_read_review_successor_fails_closed_on_binding_mutation`이 seq513 manifest와 현재 seq524 bundle을 혼합해 `C21_PROVIDER_STATUS_READ_COMPLETION_EVENT_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_DIGEST_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_EVENT_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_EVENT_ORDER_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_HANDOFF_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_HISTORY_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_PROJECTION_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_RAW_INVALID` 8개 오류로 실패했다. 이는 historical fixture 오류이며 제품 실패가 아니다.
- 최소 수정: 기존 `_historical_bundle` 패턴으로 seq513 commit `b85d2b48e14f513e326054bc0be28009f269a827`의 격리 bundle과 동일 시점 manifest를 로드하도록 test만 교정했다. seq1~513 event/evidence와 checker 계약은 변경하지 않았다.
- RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k "test_c21_provider_status_read_review_successor_fails_closed_on_binding_mutation"` -> exit 1, `1 failed, 168 deselected in 0.66s`.
- GREEN: 동일 명령 -> exit 0, `1 passed, 168 deselected in 5.68s`; seq524 focused `-k "provider_wsl_auth_reviewed"` -> exit 0, `3 passed, 166 deselected in 1.78s`.
- live checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` -> exit 1, `PRG_REFERENCED_HASH_MISMATCH`. 원인은 `build-progress.json`의 `tests/tooling/test_project_progress.py` 결박 hash `6F9508873404B3D318E5611C9DA904BACB4DCB93ED7E594804CBCFA680BDE8F3`가 수정 후 portable hash `3CACC50CA9DB23EB8F2E2D0C779756988A3416717DDFB8781703951818BD8EFB`와 불일치하기 때문이다.
- 다음 안전 조치: Main이 current test hash를 progress projection에 재결박하고 연쇄 snapshot/digest를 재계산한 뒤 live checker를 재실행한다. commit, push, WSL, Provider, Telegram, DB, ysna, main은 실행하지 않았다.
- Main 재결박 후 live checker는 `PASS sequence=524 reporting=AUTO_CONTINUE`, 전체 `tests/tooling/test_project_progress.py`는 `169 passed in 717.78s`로 통과했다. `SEQ524_HISTORICAL_SEQ513_CURRENT_BUNDLE_MIX`는 1회 발생 후 해소됐으며 추가 반복은 없다.

### seq524 독립 검토 재작업 1회

- fingerprint `C21_PROVIDER_WSL_AUTH_SEQ524_BINDING_GAPS_R1` 유효 실패 1회: 독립 reviewer가 Important 2건으로 terminal seq514~524 event details와 manifest/digest 선언 metadata의 fail-open을 재현해 commit을 보류했다.
- RED: `-k c21_provider_wsl_auth_reviewed` -> `2 failed, 169 deselected`; GREEN: 동일 focused suite -> `5 passed, 166 deselected`.
- 조치: terminal event canonical SHA-256을 `70237B7C9F71D44330B8F77877DEB17A1D8362EFF362E88EE1D3522969FB1135`로 exact 결박하고, manifest `schema_version/created_at`, digest `schema_version/digest_id/algorithm/created_at/scope`를 exact 검증한다.
- 현재 미충족: 변경된 checker/test hash와 progress snapshot/detached digest 재결박, 전체 tooling 재검증, 독립 재검토. seq1~513 historical evidence와 제품 exact7은 변경하지 않았다.
- 해소 검증: Main 재결박 후 focused `5 passed, 166 deselected`, live checker `PASS sequence=524`, 전체 tooling `171 passed in 711.92s`를 확인했다. checker/test hash와 progress snapshot/detached digest 재결박 및 전체 tooling 미충족은 해소됐다.
- 독립 재검토 최종 판정은 `SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`이며 exact10 record commit을 허용한다. seq514~524의 이전 11개 event details 변조는 `C21_PROVIDER_WSL_AUTH_REVIEW_EVENT_INVALID`, manifest/digest metadata 변조는 각 지정 오류로 모두 fail-closed 거부됨을 확인했다.

### C-21 Provider WSL Git-only candidate start — 플랫폼 승인 대기

- 기준선은 clean `e4cccf3ce99e29005103cea3bd76fa0eede36f28`; seq1~524 historical event/evidence는 변경하지 않았다.
- 계획 초안의 path hash 불일치는 canonical helper로 정정했다: S exact10 `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, 누적 exact107 `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, K exact12 `6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`, 누적 exact109 `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`.
- 시스템 안전 fingerprint `PLATFORM_SEQ527_GOVERNANCE_GATE_APPROVAL_REQUIRED` 2회: 두 writer의 seq527 전용 predicate patch가 지속적 무결성 gate 확장으로 분류돼 차단됐다. 제품 실패 횟수에는 포함하지 않으며 우회하지 않았다.
- 현재 변경은 Work Order 2개, checker path helper, RED 계약 테스트와 이 상태 기록뿐이다. RED `-k git_only_candidate_start`는 `2 failed, 1 passed`; projection predicate/validator가 아직 없어 의도대로 실패한다.
- 재개 조건: 신산님이 seq527 전용 predicate/validator의 구현을 직접 승인하면 subagent가 기존 RED에서 재개한다. 실제 WSL·Docker·DB·Provider·Telegram·push·ysna·main은 아직 실행하지 않는다.

### seq527 start projection 구현·검증 진행

- 판정: `IN_PROGRESS_FINAL_VERIFICATION`. 최신 직접 지시 `계속하자`와 교체된 AGENTS 5.1에 따라 승인된 계획 내부 start projection을 재개했다. 담당은 `developer-primary`, branch `codex/c21-operational-execution`, HEAD `e4cccf3ce99e29005103cea3bd76fa0eede36f28`, upstream `origin/codex/c21-operational-execution`, remote head `ca92b7845eda803cff3c432799642e4f9243d4d6`다.
- 변경 exact set: S exact10 전부만 dirty다. 기존 수정 6개(`docs/WORK_STATUS.md`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`)와 신규 4개(start manifest, detached digest, WorkInstruction, invocation prompt)다. seq1~524 raw event object와 historical evidence는 byte-immutable이다.
- projection: seq527 specialized Git predicate를 일반 projection보다 먼저 적용하고 seq524 full validator를 유지했다. precommit은 HEAD `e4cccf3...` + committed exact103 + dirty start exact10만, postcommit은 그 direct single-parent child + exact107 clean만 허용한다. branch/upstream/remote, base ancestry, exact paths, clean/dirty, candidate ref와 predecessor control을 fail-closed한다.
- lease/event: seq525 `WORKER_LEASE_ISSUED`, seq526 `WRITE_LEASE_ISSUED`, seq527 `PACKAGE_STARTED`를 append했다. active developer write scope는 K exact12/hash `6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`; 이후 누적 exact109 hash는 `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`다.
- canonical path helper 재감사: source exact103=`A46103D23EC42AD4F0431A979601964FA846913555C568DE4947605411787880`, S exact10=`87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, 누적 exact107=`E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, K exact12=`6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`, 누적 exact109=`16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`. 기존 계획 감사의 `E095...`, `14D594...`, `A356...`, `8904...` 값은 범위 의미 변경이 아니라 canonical helper를 쓰지 않은 비의미 계산 오류였으며 위 값으로 정정했다.
- TDD RED: `-k git_only_candidate_start` 최초 `2 failed, 1 passed, 171 deselected in 0.73s`, exit1. fingerprint `C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_UNBOUND_R1` 1회로, 전용 validator 부재와 일반 projection이 seq527 exact103/start10을 구분하지 못한 의도한 원인이다.
- 구현 중 focused: start manifest/digest/progress/handoff materialize 뒤 첫 실행은 `1 failed, 2 passed, 171 deselected in 0.79s`, event canonical order·handoff 마지막 중복 키·latest refs·projection 결박을 보완했다. 다음 실행은 `1 failed, 2 passed, 171 deselected in 0.33s`, last_event_id 축약 오기 1건을 exact PACKAGE_STARTED id로 교정했다. 최종 focused는 `3 passed, 171 deselected in 3.41s`, exit0이다. 각 integration fingerprint는 1회이며 동일 근본 원인 3회가 아니다.
- 전체 tooling 1차: `3 failed, 171 passed in 897.36s`, exit1. `HISTORICAL_BACKUP_ACCEPTANCE_CURRENT_BUNDLE_DRIFT`, `HISTORICAL_OPS_R2_CURRENT_BUNDLE_DRIFT`, `GENERIC_ACTIVE_WI_HASH_KEY_DRIFT` 각 1회다. 앞 두 개는 seq527 current bundle을 과거 validator에 혼합한 fixture 오류라 immutable `e4cccf3...` historical bundle로 분리했고, 마지막은 generic referenced-hash validator가 새 `artifact_path`/`artifact_sha256` alias를 읽도록 최소 보완했다. 제품 실패로 계상하지 않는다.
- fixture 보완 검증: 1차 `1 failed, 2 passed, 171 deselected in 14.49s`에서 같은 historical test 내부 후속 release-rebind current bundle 잔존을 발견했고 같은 historical bundle로 고정했다. 2차 `3 passed, 171 deselected in 14.57s`, exit0이다. 이 잔존 fixture fingerprint도 1회이며 반복 제품 오류가 아니다.
- 도구/편집 절차 오류: D:\tmp sandbox deny, apply_patch batch newline 전달, unified hunk range 문맥 실패, PowerShell quoting 1회, event comma 누락 1회는 모두 제품 실패가 아니며 승인된 direct apply_patch CLI와 JSON parse로 즉시 해소했다. 같은 제품 근본 실패의 유효 반복 횟수는 0이다.
- 실제 Provider 호출, Telegram outbound, WSL, Docker, DB, ysna, main 병합, push는 모두 `NOT_EXECUTED`. commit도 지시대로 `NOT_EXECUTED`다. C-21 accepted=false, C-01 차단, DIR-2 미발생을 유지한다.
- 남은 조치: final checker/test hash와 snapshot/digest/manifest 결박 후 seq527 focused, 전체 tooling fresh, live checker, `git diff --check`, exact10 Git status를 검증한다. 다음 package action은 developer-primary가 lease exact12를 로컬 TDD로 구현하는 것이며 이 start task에서는 실행하지 않는다.

#### seq527 start projection 최종 검증 마감

- 판정: `COMPLETED`. final hash 재결박 뒤 seq527 focused `3 passed, 171 deselected in 3.23s`, exit0; 전체 `tests/tooling/test_project_progress.py` fresh 재실행 `174 passed in 920.81s`, exit0이다.
- live checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` → exit0, `G-05 project progress contract: PASS sequence=527 reporting=AUTO_CONTINUE`.
- 정적·Git 검사: `.venv\Scripts\python.exe -m py_compile scripts/check_project_progress.py tests/tooling/test_project_progress.py` exit0; `git diff --check` exit0. dirty는 S exact10만이며 canonical path-list hash `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`와 일치한다.
- 역사 무결성: HEAD `e4cccf3...`의 progress-events 원본은 `918383` bytes / `6CA5E70011C18974C91116229A137CB9D5366F13114312064AD5EBA80D852AE0`; 현재 seq1~524 event-object prefix는 `918175` bytes / `7976E9A81F28A7293552C4D18556AD506A0450C46B620D28F1B74A112EED2EAA`이며 Git blob에서 추출한 같은 prefix와 byte-equal이다.
- 변경 영향: seq527 start projection과 이후 exact12 write lease만 활성화했다. Provider/Telegram/WSL/Docker/DB/ysna/main/push/commit은 모두 `NOT_EXECUTED`; 해당 실제 검증이나 배포 PASS를 주장하지 않는다.
- rollback: 아직 commit하지 않았으므로 Main이 S exact10 diff를 검토한 뒤 승인하지 않으면 이 exact10만 복구 대상으로 삼는다. 사용자 자료·다른 dirty 경로·historical evidence는 rollback 대상이 아니다.
- 다음 안전 조치: Main의 exact10 diff 검토 후 별도 후속 작업자가 active lease의 K exact12를 로컬 TDD로 구현한다. 이 seq527 start task 자체의 추가 제품 write, commit, push, WSL/외부 호출은 하지 않는다.

#### seq527 Reviewer Important 1 fail-closed 보완

- 인수 사유: 이전 developer의 중단은 usage limit이며 유효한 `FAILURE_REPORT`가 아니다. 동일 제품 근본 실패의 유효 반복 횟수는 계속 `0`이다.
- Reviewer Important 1 재현: seq527 clean postcommit projection에서 Git status 수집값 `None`이 `_working_tree_paths(None) -> []`로 바뀌어 clean direct-child/exact107 projection을 통과할 수 있었다.
- 조치: valid direct-child/exact107 응답과 status `None`을 분리 mock한 collector-boundary 회귀 계약을 유지하고, seq527에만 `GIT_STATUS_COLLECTION_FAILED`를 반환하도록 fail-closed했다. seq524 및 generic/historical projection은 변경하지 않았다.
- 상태: focused GREEN 뒤 관련 historical·전체 tooling·live checker·정적/Git 무결성 재검증을 진행한다. Provider/Telegram/WSL/Docker/DB/ysna/main/commit/push는 계속 `NOT_EXECUTED`다.
- 검증: collector-boundary focused `3 passed, 172 deselected` exit 0, 인접 historical focused exit 0, 전체 `tests/tooling/test_project_progress.py` fresh `175 passed in 884.84s` exit 0, live checker `PASS sequence=527`, `py_compile` exit 0, `git diff --check` exit 0을 확인했다.
- 최종 무결성: Git status 기준 dirty는 S exact10만이며 path-list SHA-256 `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`; 누적 exact107은 `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`; seq1~524 raw event-object prefix `918175` bytes는 HEAD historical blob과 byte-equal이다.
- 완료 범위: seq527 status collection fail-closed 보완과 기존 manifest/digest 결박 정합성만 수정했다. commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 실행하지 않았다.

#### seq527 exact10 CLEAN_REVIEW 마감

- 독립 Reviewer 재검토 판정은 `CLEAN_REVIEW / C0 / I0 / M0`이며 Reviewer Important 1 status-collector fail-closed 결함은 해소됐다.
- 독립 focused 검증은 `11 passed`로 종료했다. 코드 변경이 없는 review 마감이므로 직전 fresh 전체 tooling `175 passed in 884.84s` 결과를 유지하며 전체 suite는 재실행하지 않는다.
- 재확인 대상: live checker `PASS sequence=527`, `py_compile` 및 `git diff --check` exit 0, S exact10 hash `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, cumulative exact107 hash `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, seq1~524 raw prefix byte-equal을 최종 마감 조건으로 유지한다.
- 범위·상태: 새 event를 append하지 않으며 seq527, `ACTIVE_GIT_ONLY_CANDIDATE_PREPARATION`, S exact10과 C-21 accepted=false/C-01 차단/DIR-2 미발생을 보존한다. commit/push와 WSL/Docker/DB/Provider/Telegram/ysna/main은 `NOT_EXECUTED`다.

## 2026-09-06 C-21 Provider WSL Git-only candidate exact12

- 상태: `IN_PROGRESS`; 시작 기준은 `a6dca0da5a37e64491e91813895268e78ecb78b2`, source parent는 `e4cccf3ce99e29005103cea3bd76fa0eede36f28`이다.
- RED: existing manifest source mismatch와 completion validator 부재를 각각 재현했다. 최소 GREEN은 source/ref contract와 validator 노출까지 확인했다.
- 외부 범위: commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 모두 `NOT_EXECUTED`다.
- 다음 조치: seq528~530 forward-only record와 progress/evidence/digest 재결박 뒤 전체 검증을 수행한다.


### exact12 미완성 인수 및 seq530 플랫폼 승인 심사 차단

- 담당: developer-primary 역할의 developer_c21_candidate_finish. 시작 HEAD a6dca0da5a37e64491e91813895268e78ecb78b2, branch codex/c21-operational-execution, 기존 dirty8을 그대로 인수했다. 이전 INCOMPLETE는 유효 FAILURE_REPORT가 아니며 제품 실패 횟수에 더하지 않는다.
- 인수 검토: CandidateReleaseManifest/guard/test의 역사 seq494 fixture 혼합, seq530 validator의 event details/WI/raw checksum/detached metadata 결박 미완성을 확인했다.
- 새 RED 명령: TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1, .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k git_only_candidate_bound. 실제 결과 exit1, 2 failed/175 deselected/0.42s. 원인은 seq530 Git projection 및 신규 manifest 미완성이다.
- 적용한 변경: tests/tooling의 seq530 mutation/direct-child 계약 테스트와 checker의 seq530 exact107+exact12 pre/postcommit predicate, status collection None 차단, source direct-child path 및 미게시 candidate ref 검사. 전체 seq530 validator와 projection artifact는 아직 미완성이다.
- 플랫폼 fingerprint PLATFORM_SEQ530_INTEGRITY_GATE_APPROVAL_REQUIRED 3회. 1차 terminal/WI/raw/digest 보강 patch가 seq510~513 승인 범위 초과로 거절됐고, 2차 현행 WI exact12를 근거로 제시한 helper 단일 patch도 WI가 사용자 승인으로 인정되지 않아 거절됐다. 3차 사용자 계속하자 및 사용자 제공 AGENTS와 역사 불변 근거를 제시한 3줄 역사 in-memory 변조 거부 patch도 같은 사유로 거절됐다. 모두 실제 codex --codex-run-as-apply-patch를 require_escalated로 요청했으며 실행 전 거절되어 해당 patch는 적용되지 않았다. 이는 제품 실패가 아니고 우회하거나 추가 반복하지 않는다.
- 정확한 최소 차단 patch: validate_c21_provider_wsl_git_only_candidate_projection의 terminal 계산 직전에 if preserved and events[:527] != json.loads(historical)["events"]: preserved = False를 추가하는 변경이다. Main에 3회 사유와 patch를 전달했다.
- 안전한 재개 조건: Main이 seq528~530 checker/progress/evidence/digest 구현에 대한 시스템 승인 경계를 해소하면 같은 dirty8에서 계속한다. 그 전에는 영향 없는 guard와 historical harness 보완을 수행한다. 새 seq528~530 event는 아직 append하지 않았다.
- 실제 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 모두 NOT_EXECUTED이며, 기존 seq1~527 및 historical evidence 원본은 불변이다. 현재 RED 또는 미완성 결과를 PASS/COMPLETED로 표시하지 않는다.


### exact12 인수 후 validator·fixture 보완 및 focused GREEN

- Main이 child의 시스템 승인 거절을 인수하여 checker history guard, seq528~530 expected helper/validator, candidate guard 및 governance materialization을 실제 apply_patch로 적용했다. child에서는 Main 인수 뒤 helper 1회, deploy guard 1회, events append 1회가 각각 추가 거절되어 정확한 patch와 생성 변환을 Main에 전달했고 같은 요청을 반복하지 않았다.
- Main materializer 첫 실행은 expected_terminal 지역변수 누락으로 1회 실패했고 즉시 수정 재실행 exit0으로 해소됐다. live 오류 3종은 events envelope last_sequence=527 잔존, terminal projection metadata 누락으로 seq527 event가 최신 repository event로 선택됨, registry_refs.progress_events hash 잔존이었다. Main이 last_sequence=530, terminal530 exact metadata와 registry hash를 반영했다.
- child 최초 historical deploy focused는 5 failed/82 deselected/19.25s exit1. PATH 첫 bash가 WindowsApps app alias라 return127 및 cp949 reader 오류가 발생했다. 서비스/WSL QA 실행 성공이 아니며 Git Bash exe로 PATH를 고정하고 PYTHONUTF8=1로 교정했다.
- 환경 교정 후 관련 focused는 3 failed/6 passed/78 deselected/47.08s exit1. 원인은 historical guard를 fixture tracked 경로로 복사해 dirty를 만든 점(두 inherited test)과 synthetic stat의 Windows CRLF 출력이었다. historical guard를 fixture repo의 sibling으로 분리하고 Unix fixture write_text에 newline LF를 명시했다. 제품 코드 변경으로 우회하지 않았다.
- 보완 focused session83789는 11 passed/80 deselected/80.13s exit0. 이어 historical READY/cleanup helper도 immutable a6dca0d Git guard로 분리한 focused session50381은 18 passed/73 deselected/103.89s exit0이다.
- 최신 guard 검증은 실제 로컬 Git clone에서 nominal binding PASS, public runtime exit22, branch/upstream drift, failed Git status collection, candidate remote drift, exact12를 유지한 누적109 reversion 거부를 포함한다. 기존 seq494/rollback/cleanup의 역사 계약은 당시 Git blob으로 유지하며 실제 외부 실행 증거로 승격하지 않는다.
- seq1~527 raw prefix byte-equal을 직접 확인했다. 현재 남은 일은 마지막 exact12 잘못된 집합/두 번째 descendant focused, 최종 자료 재결박, full tooling/deploy, shell syntax, py_compile, diff-check 및 exact12/exact109 hash 감사다.
- 모든 오류는 원인별 보완/환경/플랫폼 기록이며 이번 인수의 유효한 FAILURE_REPORT 반복은 0이다. Main 검토·전체 필수 검증이 끝나기 전 C-21 또는 이번 exact12를 최종 완료로 주장하지 않는다.
- 마지막 current guard exact12 집합/second descendant focused(session83888)는 2 passed/91 deselected/15.95s exit0이다. 코드/fixture 및 전체 suite 전 기록을 마감했으며 다음은 Main 재결박 뒤 전체 검증이다. git diff --check exit0.


### seq530 전체 검증 1차 및 테스트-only 잔존 보완

- 최종 재결박 후 live checker는 PASS sequence=530 / AUTO_CONTINUE였고 후보 focused는 7 passed/171 deselected/16.70s exit0(session89317)이었다.
- 전체 fresh 1차 tooling(session19334): 1 failed, 177 passed in 687.94s, exit1. test_c21_wsl_qa_resume_candidate_rebind_separates_ready_from_actual_execution만 실패했다. seq494 historical bundle을 사용하면서 CandidateReleaseManifest만 최신 ROOT에서 읽어 private_push_policy KeyError가 난 참조 혼합이었다. 해당 한 줄을 historical_root로 고정했다.
- 전체 fresh 1차 deploy(session25037): 1 failed, 90 passed, 2 skipped in 680.36s, exit1. test_fresh_no_checkout_clone_reaches_manifest_guard_with_a_clean_worktree만 실패했다. 현재 guard가 exact107 source 검사에서 먼저 거부하는데 과거 manifest contract mismatch 진단을 기대했다. 현재 정확한 candidate source must be the exact107 commit 문구로 기대값 한 줄만 정정했으며 clean-tree/dirty-tree 검증은 유지했다.
- 수정 후 focused(session30131): 2 passed, 2 skipped, 267 deselected in 6.80s, exit0. 두 실패의 원인은 테스트-only 참조/기대 문구이며 제품 checker/guard 추가 변경은 0이다. 최초 full의 실패를 통째 PASS로 재분류하지 않는다.
- SKIP2는 Compose parser 부재와 Git Bash/NTFS의 POSIX0600/0400 mode 표현 불가다. 이 Windows-local slice에서 actual WSL/Docker/DB/Provider/Telegram/ysna/main을 실행하거나 SKIP를 실제 QA PASS로 승격하지 않았다.
- 정적/무결성: Python3파일 py_compile PASS, Git Bash -n guard PASS, diff-check PASS; dirty exact12 SHA6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765, cumulative exact109 SHA16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E, seq1~527 raw prefix931700bytes SHA E8171085938267B003285688E97C76FEC5D2D1173533EED0CBF5BC854C47788F byte-equal을 확인했다. py_compile 임시 출력은 자동 정리되고 잔류0이다.
- 다음 조치: Main 재결박 후 전체 tooling/deploy를 각 fresh 재실행해 최종 GREEN 증거를 남긴다. 현재 accepted=false 및 외부 NOT_EXECUTED 경계는 불변이다.


### seq530 exact12 최종 fresh 검증 마감

- 판정: 로컬 구현/기본 검증 COMPLETED, Main 최종 검토 및 문서 결과 재결박 후 무결성 확인 대기다. C-21 전체 수락 또는 외부 실행 완료를 의미하지 않는다.
- 재결박 후 live checker: .venv/Scripts/python.exe scripts/check_project_progress.py → PASS sequence=530 reporting=AUTO_CONTINUE, exit0. 후보 focused: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k git_only_candidate → 7 passed, 171 deselected in 17.22s, exit0(session33579).
- 전체 fresh tooling: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider → 178 passed in 664.70s, exit0(session67778).
- 전체 fresh deploy: .venv/Scripts/python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -rs -p no:cacheprovider → 91 passed, 2 skipped in 649.93s, exit0(session10125). SKIP2는 Git Bash/NTFS POSIX0600/0400 표현 한계와 Compose parser 부재다. 두 full suite의 실패는 0이나 SKIP를 실제 WSL PASS로 승격하지 않는다.
- 실행 환경: PATH 선두 C:/Program Files/Git/usr/bin, PYTHONUTF8=1, TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1. 두 suite 실행 중 제품/기록 파일은 수정하지 않았다. 테스트가 사용하는 disposable Git fixture만 로컬에서 생성/정리했으며 실제 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 NOT_EXECUTED다.
- 보존 경계: source a6dca0da5a37e64491e91813895268e78ecb78b2와 K exact12 dirty만 유지한다. seq1~527 및 historical evidence를 변경하지 않는다. accepted=false, C-01 차단, DIR-2 미발생, 실행 허가 HOLD는 불변이다.
- 다음 안전 조치: 이 문서 결과 기록을 Main이 manifest/progress/digest에 재결박하고 live checker, diff-check, exact12/exact109 및 역사 raw byte 불변을 최종 확인한다. 코드/테스트는 전체 fresh 실행 이후 변경하지 않았다. 이후 Main이 exact12 diff와 증거를 검토하며 이 child는 commit/push/외부 실행을 하지 않는다.
- rollback: 미커밋 exact12를 그대로 보존해 Main이 승인된 diff 단위로 처리한다. 임의 reset/clean/stash, 다른 dirty 또는 historical evidence 삭제는 하지 않는다. 유효 FAILURE_REPORT 반복은 0이며 초기 실패/환경/플랫폼 오류 기록은 위에 누적 보존했다.


### seq530 Reviewer Important 1 — 손상/누락 evidence fail-closed 재작업

- 인수: 최종 local COMPLETED 뒤 Reviewer가 신규 seq530 validator의 missing/corrupt evidence 예외를 Important1로 제기했다. detached_digest None/list/누락, historical events/progress Git blob 누락·손상, current progress/HANDOFF 누락, CandidateManifest/WI 누락에서 오류 목록 대신 AttributeError/UnboundLocalError/CalledProcessError/JSONDecodeError/FileNotFoundError가 날 수 있다. 동일 지적 첫 재작업이며 유효 FAILURE_REPORT 반복은0이다.
- 원인: 역사 조회/파일 읽기 실패를 기록한 뒤 미초기화 raw 변수를 재사용하고, digest 및 역사 projection의 구조를 확인하지 않은 채 중첩 get/helper를 호출했다. latest evidence hash loop는 IO 예외를 처리하지 않았다.
- TDD: tests/tooling/test_project_progress.py에 malformed digest7행, historical Git missing/invalid JSON/null/list/empty object10행, current events/progress/HANDOFF/CandidateManifest/WI/prompt missing6행의 table-driven adversarial 회귀3개를 추가했다. 실제 파일은 삭제하지 않고 해당 read_bytes/git-show 경계만 mock한다.
- RED 명령: 고정 Git Bash/PYTHONUTF8/TEMP D:/tmp 환경에서 .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'bound_malformed_digest or bound_history_unavailable or bound_missing_files' → 3 failed,178 deselected in2.33s, exit1. 실제 historical 및 progress_raw 미초기화 예외를 확인했다.
- 설계: 역사 필수 입력 오류는 HISTORY_INVALID, digest shape/필수 raw 읽기 실패는 DIGEST_INVALID로 후속 미초기화 사용 전에 반환하고 latest 파일 hash IO 실패는 LATEST_REF_INVALID로 누적한다. 정상 정확 결박 조건과 seq1~527 역사 원본은 변경하지 않는다.
- 플랫폼: checker 최소 patch를 실제 codex --codex-run-as-apply-patch require_escalated로1회 요청했으나 seq510~513 승인 밖 영속 gate 변경이라는 사유로 실행 전 거절됐다. 반복/우회 없이 정확 unified diff를 Main에 전달했다. 이는 제품 실패 횟수에 더하지 않는다.
- 다음 조치: Main 시스템 승인 적용 후 adversarial 전 행과 관련 focused를 확인하고 기록/hash를 재결박한다. Main 지시에 따라 전체 검증 및 독립 재검토를 진행한다. commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 NOT_EXECUTED다.

- Main이 제시한 최소 fail-closed patch를 시스템 승인으로 적용했다. child 재검증에서 adversarial3개/23행은 3 passed,178 deselected in3.02s exit0이다. 누락/손상 입력을 PASS로 처리하지 않고 명시 C21_HISTORY_INVALID/C21_DIGEST_INVALID/C21_LATEST_REF_INVALID를 반환하는 것을 각 행에서 검사했다.
- 관련 focused 명령: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'git_only_candidate and not bound_projection_rejects_mutations' → 9 passed,172 deselected in15.32s exit0(session33975). 현재 기록/코드/test raw hash가 재결박 전이므로 정상 전체 baseline 비교1개는 의도적으로 이 실행에서 제외했다. 이를 전체 candidate 또는 전체 tooling PASS로 주장하지 않는다.
- 정상 전체 candidate 비교와 live checker는 Main의 재결박 직후 실행한다. 이전 full178P/91P2S는 I1 보완 전 증거로 보존하며 최신 코드의 full로 재사용하지 않는다. focused와 독립 Reviewer 재검토가 끝나기 전 전체 suite는 재실행하지 않는다.


### seq530 Reviewer I1 CLEAN_REVIEW 및 최종 전체 검증 마감

- 판정: COMPLETED / CLEAN_REVIEW / C0 / I0 / M0. 독립 Reviewer 최종 판정과 commit 허용은 Main이 전달한 결과다. child가 독립 Reviewer 역할을 수행하거나 자체 승인한 것이 아니다.
- I1 후 재결박 검증: live checker PASS sequence=530 reporting=AUTO_CONTINUE, 정상 baseline 포함 candidate focused10 passed,171 deselected in17.70s exit0(session42329). adversarial23행은 명시 오류 목록을 반환하며 예외가 없다.
- I1 후 전체 fresh tooling 명령: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider → 181 passed in664.59s(11:04), exit0(session76370).
- I1 후 전체 fresh deploy 명령: .venv/Scripts/python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -rs -p no:cacheprovider → 91 passed,2 skipped in642.84s(10:42), exit0(session43244).
- SKIP 한계: Git Bash/NTFS에서 POSIX0600/0400 mode 표현 불가 및 Compose parser 부재다. Windows-local full 결과이며 실제 WSL/Docker/DB/Provider/Telegram/ysna/main PASS를 의미하지 않는다. Gate의 별도 실제 실행 경계를 넓히거나 SKIP를 PASS로 바꾸지 않았다.
- 환경/불변: Git Bash PATH 선두, PYTHONUTF8=1, TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1. 두 full 실행 중과 종료 결과 보고까지 파일 수정0이며 이후 이 WORK_STATUS/HANDOFF 기록만 수정했다. 코드/테스트는 full 실행 이후 불변이다.
- commit 허용: Main 지시에 따라 승인된 K exact12의 로컬 commit을 허용하는 review 마감 상태로 기록한다. 실제 commit은 child가 실행하지 않았으며 Main의 최종 재결박/무결성 확인 후 수행한다. push 및 WSL/Docker/DB/Provider/Telegram/ysna/main 외부 실행은 계속 NOT_EXECUTED이고 별도 실행 승인 경계를 유지한다.
- 다음 안전 조치: Main이 기록 결과를 manifest/progress/digest에 최종 재결박하고 live checker 및 exact12/exact109/역사 raw 불변을 확인한다. 최종 로컬 commit/후속 조치는 Main이 관리한다. C-21 accepted=false, C-01 차단, DIR-2 미발생은 불변이다.
- 기록 마감 중 도구 wrapper JavaScript 괄호 오류1회(SyntaxError Unexpected token)는 shell 실행 전에 발생했고, 괄호를 바로잡은 동일 문서 patch 재실행 exit0으로 해소했다. 제품/테스트 실패나 파일 손상은 없으며 유효 실패 횟수에 더하지 않는다.


### seq530 Main focused 환경 오류 및 교정 결과

- Main 전달 실행 증거: 첫 focused는 PATH/PYTHONUTF8 고정 누락으로 WindowsApps bash가 선택되어 8 failed(rc127) 및 cp949 reader warnings가 발생했다. 이 결과는 Windows-local launcher/encoding 환경 오류이며 제품 기능 실패나 실제 WSL 실행 증거가 아니다.
- Main이 즉시 PATH 선두 Git Bash, PYTHONUTF8=1, TEMP=TMP=D:/tmp로 고정해 재실행한 결과는 16 passed,258 deselected in79.41s, exit0이다. 최초 오류를 숨기거나 PASS로 바꾸지 않고 교정 실행과 분리해 기록한다.
- Main 지시에 따라 HANDOFF machine independent_focused를 PASS_MAIN_16_AND_REVIEWER_20_ADVERSARIAL로 갱신한다. 이는 Main이 전달한 독립 검증 증거이며 child가 Reviewer20을 직접 실행했다는 뜻은 아니다.
- 이번 보완은 WORK_STATUS/HANDOFF 기록만 변경한다. 코드/테스트는 최종 전체 tooling181P 및 deploy91P2S 이후 불변이다. 외부 실행/commit/push는 child에서 하지 않았고 Main 최종 재결박을 기다린다.


### seq533 Provider WSL execution-resume S 시작 projection

- 시작 기준: `codex/c21-operational-execution` / `e6c562cf07bc2c35e24addb60efa9d90fae08046`, clean이며 parent는 `a6dca0da5a37e64491e91813895268e78ecb78b2`다. seq527 CLEAN_REVIEW C0/I0/M0와 seq530 `commit=NOT_EXECUTED` 사실을 보존한다.
- S exact10은 `0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070`, 후속 K exact14는 `3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B`로 결박한다. 외부 실행, commit, push는 모두 `NOT_EXECUTED`다.
- TDD RED: execution-resume path helper 부재를 AssertionError로 확인했다. GREEN: path helper focused 1 passed. full tooling/checker/py_compile/diff-check는 projection 재결박 전이므로 아직 미실행이다.
- 플랫폼 오류: canonical progress의 active WorkInstruction/lease 전환 patch는 영속 운영 상태 변경으로 2회 거절됐다. 제품 실패가 아니며 해당 오류를 PASS로 승격하지 않는다. Main의 승인 binding 또는 시스템 적용 뒤 seq531~533, handoff/digest, live checker를 재결박한다.
- 미검증: K direct-child commit, Main exact binding, actual current/previous runtime 관측 및 WSL/Docker/DB/Provider/Telegram/ysna/main은 수행하지 않았다. rollback은 미래 dispatch에서 관측해야 하며 추측하지 않는다.

### seq533 S validator writer 인수 및 집중 검증

- 담당 `developer-primary` 역할의 `developer_seq533_validator`; 인수 HEAD `e6c562cf07bc2c35e24addb60efa9d90fae08046`, branch `codex/c21-operational-execution`, 기존 dirty7 보존. 변경은 S exact10 안의 checker/test/WI/prompt/WORK_STATUS/HANDOFF이며 제품·외부 실행·commit/push는 0이다.
- TDD RED: `-k execution_resume` → `4 failed,1 passed,181 deselected`, exit1. 순수 artifact builder와 seq533 validator 부재가 원인이다. 이후 strict JSON, raw header/footer·prefix, 역사 progress 보존, 정확한 manifest raw5/latest6, Git direct-child·scope·ref 수집 계약을 구현했다.
- 로컬 환경 오류 `SEQ533_TMPDIR_SANDBOX_PERMISSION_LOOP` 1개 원인: 첫 일반 권한 테스트와 진단 실행에서 Python tempfile.mkdtemp가 D:/tmp 생성 거부를 재시도했다. 두 실행을 중단하고 faulthandler 1회로 해당 위치를 확인했다. 별도 실행한 진단도 즉시 중단했다. 외부 실행 또는 제품 실패가 아니며 유효 FAILURE_REPORT 횟수에 포함하지 않는다. 승인된 D:/tmp fixture 생성/자동 정리만 require_escalated로 실행해 해소했다.
- 첫 GREEN: `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k execution_resume` → `5 passed,181 deselected in6.68s`, exit0.
- 추가 RED: Git 실행 OSError가 밖으로 전파되고 duplicate/malformed path helper가 없는 것을 `2 failed,185 deselected in1.91s`, exit1로 확인했다. 수집 실패를 `GIT_REQUIRED_COLLECTION_FAILED`로 반환하고 중복/경로 변조를 거부했다.
- 최신 GREEN: 같은 focused 명령 → `6 passed,181 deselected in8.67s`, exit0. 누락/손상/nonobject/duplicate JSON/nonfinite/invalid UTF-8 evidence, duplicate rows, refs/status/ref collection 실패, dirty widen/narrow, second descendant, merge, source parent, 누적 reversion을 확인했다. 실제 WSL/DB/Provider/브라우저 성공 증거가 아니다.
- canonical P/E/D 영속 쓰기는 Main의 기존 동일 원인 플랫폼 거절 3회 후 Main takeover 지시에 따라 이 writer가 시도하지 않았다. Main에 순수 `c21_provider_wsl_execution_resume_start_artifacts`와 정확한 입력 mapping을 전달한다. 현재 machine projection/manifest/digest는 재결박 전이므로 seq533 live checker PASS를 주장하지 않는다.
- 다음 안전 행동: Main이 기록 마감 후 E/P/H/D/M bytes를 재생성하여 apply_patch로 적용하고 live checker, exact10/exact113, historical raw 불변과 독립 검토를 수행한다. S/K의 모든 외부 필드는 NOT_EXECUTED이고 runtime은 K direct-child commit 및 Main exact binding 전까지 차단한다.

#### seq533 공통 복구 계약 보완 및 writer 마감

- 관련 회귀 `-k 'execution_resume or git_only_candidate_start or git_only_candidate_postcommit'`는 `10 passed,177 deselected in22.88s`, exit0이다. 이 결과는 아래 공통 HANDOFF 필드 보완 전 증거이며 최신 전체 tooling PASS로 표시하지 않는다.
- 추가 TDD RED `execution_resume_matches_shared`는 `1 failed,187 deselected in0.97s`, exit1이었다. 새 machine summary에서 기존 공통 validator가 요구하는 baseline/failure/next action/DIR/upstream/projection/base/path 필드8개가 누락돼 실제 불일치를 재현했다. source progress 기준으로 필드를 보존하고 next_safe_action은 K exact14 준비로 맞췄다. Event/reporting/detached/manifest 공통 계약은 유지했다.
- 최종 focused `-k execution_resume`는 `7 passed,181 deselected in8.55s`, exit0이다. source seq530 validator, Git predicate If와 collector 내부 seq530 If의 AST는 불변 True였다. 두 Python 파일의 in-memory compile 및 git diff --check PASS. raw checksum과 portable checksum도 current latest 파일5개에서 일치했다.
- `D:/tmp/anvil-seq533-*` 테스트 fixture 잔류0을 확인했다. canonical P/E/D 쓰기0, commit/push/외부 실행0. 현재 dirty7이며 Main의 5개 artifact 적용 뒤 S exact10이 된다. manifest 초안과 HANDOFF machine block도 같은 builder 결과로 함께 교체해야 한다.
- 완료 판정은 `INCOMPLETE_MAIN_MATERIALIZATION_REQUIRED`다. 구현·집중 계약은 완료했고, canonical 적용/live checker/실제 Git precommit projection/전체 tooling·독립 검토는 Main의 영속 기록 인수 후 검증한다. 열린 제품 finding을 없다고 선언하지 않는다.

#### seq533 Main materialization 후 registry hash 보완

- Main이 S exact10을 적용한 뒤 live checker에서 `PRG_REGISTRY_HASH_MISMATCH` 1건을 전달했다. read-only 진단 결과 `registry_refs.progress_events.sha256`가 source E hash `2B1B29ACF178595EEF3C2C2CEB22BE3529BB61E7BB27567CC9601474C5CE7B36`에 남아 있었고 실제 E hash는 `29DC6F22D130E4AB29FB4683C3883F8490EA713EF1DEB779FB8847C2321CB9EC`이었다.
- 원인 `SEQ533_REGISTRY_EVENTS_HASH_NOT_REBOUND` 1회. builder에서 새 E를 latest refs에만 반영하고 registry 참조를 갱신하지 않은 누락이다. 기존 공통 `_validate_registry_refs`를 공유 복구 계약 테스트에 포함해 `1 failed,187 deselected in1.01s`, exit1로 동일 오류를 재현했다.
- 수정: artifact builder가 generated E의 실제 SHA-256을 `registry_refs.progress_events`에 갱신한다. source의 다른 registry refs는 보존한다. checker/test/이 기록만 수정했고 canonical P/E/D는 쓰지 않았다.
- 최신 GREEN: `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k execution_resume` → `7 passed,181 deselected in8.83s`, exit0. `-k execution_resume_start`는 path helper1개만 선택하므로 전체 seq533 집중 검증으로 사용하지 않는다.
- 다음 안전 조치: Main이 current6 입력으로 E/P/H/D/M을 다시 materialize하고 live checker를 실행한다. live PASS는 아직 확인하지 않았으며 commit/push/외부 실행0을 유지한다.

#### seq533 전체 tooling 3F와 Reviewer I1 재작업

- Main 재결박 후 live checker PASS와 execution_resume7 PASS를 전달받고 파일 수정 없이 fresh full tooling을 실행했다. 명령 `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider`, PYTHONUTF8=1/PYTHONDONTWRITEBYTECODE=1/TEMP=TMP=D:/tmp/PATH Git Bash 선두. 결과 `3 failed,185 passed in565.15s (9:25)`, exit1(session2176). 실행 중 파일 수정0이며 이 실패를 전체 PASS로 대체하지 않는다.
- full 실패 중 `...git_only_candidate_bound_git_projection_is_exact`, `...git_only_candidate_bound_projection_rejects_mutations`는 live seq533 bundle과 historical seq530 source/manifest를 혼합한 fixture 오류였다. 두 테스트를 immutable `e6c562cf07bc2c35e24addb60efa9d90fae08046`의 seq530 bundle/manifest로 옮겼으며 기존 정상·음성 assertion은 보존했다.
- full 나머지 `test_git_and_authority_bindings_are_checked_against_workspace`는 mutated validated_base_commit에 대한 실제 ancestry 수집이 상수 base를 사용해 예상 `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 누락했다. seq533 collector는 repository에 기재된 base로 ancestry를 조회하며, 예상 exact base와의 불일치는 별도 projection 오류로 유지한다.
- Reviewer I1은 public main→load_bundle 경로에서 P/E/M의 nonobject/null/nested corruption이 sequence 전용 validator 앞에서 AttributeError/TypeError를 발생시킨 문제다. 공개 main 테스트로 P/E/M 각각 []/null/nested corruption 총9행을 추가했다. main 경계가 구조 오류를 `LOAD_ERROR:INVALID_STRUCTURE:<error type>`와 exit1로 반환해 traceback 없이 fail-closed하도록 보완했다.
- 수정 전 RED: 공개 main 및 영향3개 선택자는 `4 failed,185 deselected in2.85s`, exit1. 최신 GREEN: `-k 'execution_resume or git_and_authority_bindings_are_checked_against_workspace or git_only_candidate_bound_git_projection_is_exact or git_only_candidate_bound_projection_rejects_mutations'` → `11 passed,178 deselected in21.35s`, exit0(session57492).
- source seq530 validator, Git predicate If, collector 내부 seq530 If의 AST 불변3개 True; in-memory compile/diff-check PASS. runtime 외부 실행·commit/push와 canonical P/E/D 쓰기는 0이다. checker/test/WORK_STATUS/HANDOFF를 마감한 뒤 Main이 기존 pure builder로5 artifacts를 재결박하고 live checker 및 Reviewer I1 독립 재검토를 수행한다. 보완 후 fresh full tooling은 아직 미실행이다.

#### seq533 최종 전체 검증·독립 검토 마감

- 판정: `full_tooling=PASS_189`, `independent_review=CLEAN_REVIEW_C0_I0_M0`, `independent_focused=PASS_REVIEWER_18_MAIN_15`. 독립 Reviewer 결과와 Main15 증거는 Main이 전달한 검토 판정이며 이 writer가 독립 Reviewer를 겸한 결과가 아니다.
- I1 보완·최종 재결박 후 fresh 전체 tooling 명령 `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider` → `189 passed in729.23s (12:09)`, exit0(session81020). Git Bash PATH 선두, PYTHONUTF8=1, PYTHONDONTWRITEBYTECODE=1, TEMP=TMP=D:/tmp를 고정했다. 전체 실행 시작부터 결과 회수까지 파일 수정0, 재실행0이다. 이전 full185P/3F는 보완 전 기록으로 그대로 보존한다.
- Main 전달 독립 증거: Reviewer CLEAN_REVIEW / C0 / I0 / M0, related18과 Main15 PASS. 공개 main malformed P/E/M []/null/nested9행은 exit1/error/no traceback으로 거부한다. Git adversarial은 source/direct-child/extra-parent/second-descendant/ref 수집실패/dirty widen-narrow/cumulative reversion을 거부한다. 검증 전용 잔류0을 확인했다.
- 이번 마감 변경은 `docs/WORK_STATUS.md`, `docs/progress/BUILD_HANDOFF.md` 두 문서뿐이다. 제품·검증 코드와 historical seq1~530은 변경하지 않았다. 세 결과 값은 본문에 기록하며 strict machine summary의 schema 변경은 하지 않는다.
- Main 지시에 따라 seq533 S exact10의 로컬 commit 허용 상태를 기록한다. 실제 commit은 Main이 최종 재결박/live checker/무결성을 확인한 뒤 수행하며 writer는 commit/push를 실행하지 않았다. 이는 K runtime 실행이나 외부 배포 승인으로 확대되지 않는다.
- C-21 accepted=false, C-01 차단, DIR-2 미발생을 유지한다. WSL/Docker/DB/Provider/Telegram/ysna/main/push는 NOT_EXECUTED다. runtime dispatch는 K direct-child commit 및 Main exact binding 전까지 차단한다.
- 다음 안전 행동: Main이 마감된 WORK_STATUS/HANDOFF를 포함한 current6 raw input으로 E/P/H/D/M을 재결박하고 live checker 및 로컬 commit 직전 exact10을 확인한다. 이번 문서 마감 자체를 새로운 실제 WSL/브라우저/DB PASS로 표시하지 않는다.
# 2026-09-06 C-21 Provider WSL execution-resume K exact14

- 담당: `developer-primary`; 상태: `IN_PROGRESS_TDD_GREEN`.
- 기준: branch `codex/c21-operational-execution`, HEAD `d442d4584516e1a673fd2edde55a2fe1330e9394`, 시작 clean.
- lease: worker `worker-lease-c21-provider-wsl-execution-resume-20260906-001`, write `write-lease-c21-provider-wsl-execution-resume-20260906-001`, exact14/hash `3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B`.
- TDD RED: completion repository 전용 테스트가 `_validate_c21_resume_bound_repository` 부재로 exit 1, 1 failed. fingerprint `C21_PROVIDER_WSL_EXECUTION_RESUME_BOUND_MISSING_R1` 1회.
- 환경 오류: `rg.exe` 실행 불가 1회(`ResourceUnavailable`); PowerShell `Select-String`으로 읽기 전용 조사 전환. 제품 오류가 아니다.
- 구현 중: seq534~536 completion builder, exact14/cumulative117 Git predicate, CandidateReleaseManifest/guard runtime-ready 계약.
- 미실행: commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main merge.
- 다음: guard/projection TDD GREEN, 집중 및 전체 tooling/deploy 검증, evidence 재결박, writer lease 회수.

## seq536 writer 실행 중단 및 Main 인수 요청

- 동일 환경 fingerprint `SEQ536_DEPLOY_TEST_PYTHON_CPU_HANG`가 3회 반복됐다.
  1. 기존 no-hardlinks fresh clone 단일 guard test: 60초 초과, 출력 없음, 소유 Python process 종료.
  2. `--shared --no-checkout` 축소 fixture 단일 test: 30초 초과, 출력 없음, 소유 Python process 종료.
  3. pytest를 제거한 직접 module/helper 실행: module 실행 경로에서 30초 초과, 출력 없음, 소유 Python process 종료.
- `ast.parse`와 별도 `exec(compile(...))` module 정의만은 즉시 PASS했고 class 위치는 line 1751, 기존 cleanup class 뒤·state unit class 앞이다. 구문/삽입 위치 오류 증거는 없다.
- PowerShell stderr 진단 로그 생성은 sandbox가 `D:\tmp\seq536-stack.log` 쓰기를 거부해 실행되지 않았다.
- 마지막 성공 검증: completion 단위 `2 passed, 189 deselected`; `bash -n` PASS. `py_compile`은 project `__pycache__` 쓰기 권한 거부로 미검증이다.
- 세 번째 동일 hang 후 Subagent 추가 실행과 canonical P/E/H/D/M materialization을 중단한다. 현재 변경을 보존하고 worker/write lease를 Main takeover로 반환한다.
- commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main merge는 `NOT_EXECUTED`다.

## seq536 Main takeover 원인 확정 및 재개

- 판정: 동일 hang 3회에 따라 어울이 writer를 인수했다. 변경 9경로와 기존 기록은 그대로 보존했다.
- 확인 결과 test module import는 `0.41s`, fixture 생성은 `4.02s`로 정상이며 코드 구조나 clone 자체가 hang 원인이 아니었다.
- 환경 원인 확정: Developer 실행에서는 WindowsApps의 WSL `bash.exe`가 먼저 선택된 경로 불일치가 있었고, Reviewer 비승격 실행에서는 Git Bash 고정 후에도 sandbox가 `tempfile.mkdtemp(D:/tmp)` 쓰기를 재시도하며 정지했다. 단일 원인으로 단정하지 않고 두 환경 조건을 모두 기록한다.
- 교정: 검증 명령의 PATH 선두를 `C:\Program Files\Git\usr\bin`으로 고정하고 D:/tmp fixture 실행을 승인된 escalated 범위에서 수행했다. 같은 단일 guard fixture는 Main `1 passed, 118 deselected in 8.49s`, Reviewer `1 passed in 9.87s`; seq536 guard 3개는 Main `3 passed, 116 deselected in 41.26s`, Reviewer `3 passed, 116 deselected in 43.61s`, 모두 exit0이다.
- 이 교정은 제품·계약 변경이 아니라 검증 실행기 선택 정정이다. 외부 실행·commit·push는 계속 0이며, 다음은 canonical P/E/H/D/M materialization과 전체 회귀 검증이다.
- 첫 materialization live checker는 `EVENT_EFFECT_MISMATCH`, `GIT_REQUIRED_COLLECTION_FAILED`로 실패했다. 원인은 seq536 PACKAGE_COMPLETED에 공통 reducer용 cumulative `exact_allowed_paths`가 없었고, K가 push=NOT_EXECUTED인데 collector가 candidate remote ref 존재를 조기에 강제한 것이었다.
- 수정: completion event에 cumulative exact117을 추가하고, projection pre/postcommit에서는 seq533과 동일하게 candidate ref 수집 성공과 ref 부재를 요구한다. 실제 candidate ref=a6 검증은 미래 runtime guard에만 유지한다.
- 독립 Reviewer I1에 따라 CandidateReleaseManifest raw bytes를 checker 상수 SHA-256으로 고정하여 coherent unauthorized rewrite를 거부한다. rollback allowlist의 미관측 control d442를 제거하고 기존 실제 rollback 계보인 `a6dca0d`, `e4cccf3`를 보존했다.
- 수정 후 live checker는 `PASS sequence=536`이었다. 첫 집중 회귀는 역사 seq533 public-main test가 live seq536 파일을 혼합해 `1 failed,13 passed`였으며, 제품 실패가 아니라 fixture 격리 누락이다. 해당 테스트 입력을 immutable seq533 builder 산출물로 고정했다.
- 첫 전체 tooling은 `191 passed, 1 failed in 933.78s`, 첫 전체 deploy 계약은 `114 passed, 3 failed, 2 skipped in 1144.47s`였다. 병렬 D:/tmp I/O 경합 때문에 시간은 성능 증거로 사용하지 않는다.
- tooling 1F는 seq536 collector가 mutated declared base 대신 상수 base로 ancestry를 조회한 회귀였다. declared base의 형식과 실제 ancestor를 검사하도록 수정했다. deploy 3F는 seq536 test class가 기존 base test를 상속해 중복 실행했고, 역사 seq530 status-failure test 한 곳이 current guard를 source한 fixture 혼합이었다. seq536 class를 독립 TestCase로 바꾸고 역사 test는 immutable seq530 guard를 사용하도록 수정했다.
- 직접 수정 검증 3개는 `3 passed in 23.19s`. seq536 전용 branch/upstream/local HEAD, merge, exact14 widen/narrow, cumulative117 reversion, WI blob tamper, control-ref race/ABA를 보강한 집중 검증은 `7 passed, 93 deselected in 79.40s`, exit0이다.
- 최종 직렬 전체 tooling은 `192 passed in 716.25s`, exit0. 최종 직렬 전체 deploy 계약은 `98 passed, 2 skipped in 743.40s`, exit0이다. skip2는 Windows Git Bash/NTFS에서 POSIX 0600/0400 mode를 표현할 수 없는 항목과 Compose parser 부재이며 실제 WSL PASS로 승격하지 않는다.
- 현재 판정은 로컬 K exact14 구현·계약 검증 완료, `READY_FOR_APPROVED_WSL_QA`다. actual WSL/Docker/DB/Provider/Telegram/ysna/push/main은 모두 `NOT_EXECUTED`; 다음 안전 행동은 exact14/path hash와 누적 exact117을 재확인한 뒤 Main이 K direct-child commit을 만들고 별도 exact binding을 생성하는 것이다.
- HANDOFF builder와 마지막 tooling assertion을 반영한 뒤 fresh 전체 tooling을 다시 실행해 `192 passed in 682.23s`, exit0을 확인했다. 이 실행 중 파일 수정0이다.
- 독립 Reviewer 최종 판정은 `CLEAN_REVIEW / SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`, commit 가능이다. 독립 focused는 execution-resume tooling11 PASS와 seq536 guard7 PASS이며 exact14/exact117/history/ref 부재/rollback/raw SHA/dispatch 차단을 재확인했다.

## C-21 Provider WSL exact-binding S 시작 — seq537~539 준비

- 담당: `developer-primary`; 기준 branch/HEAD: `codex/c21-operational-execution` / `3501c37b25274c2c3b406a15bc8a57aa03a162e7`; 시작 clean.
- TDD RED: `pytest ... -k exact_binding_start_contract_is_frozen` → exit 1, `1 failed, 192 deselected`; builder 부재가 의도한 원인이다. fingerprint `C21_PROVIDER_WSL_EXACT_BINDING_START_MISSING_R1`, 1회.
- S exact10 path hash `410EB4E3EB843BFF2FE9D332505445286986BE8572A288DF713E388DAF587B62`; post-S cumulative exact121 hash `8A7D4AA0124FBC49DD67D48DBF10C9CCC586BB43AB4A9A4473604C1E2F43B429`.
- 실측 authority는 WSL `SINSAN`, clean detached runtime `/srv/anvil-wsl/repo@a342d623...`, private `sinsan-develop/Anvil.git`, missing control repo/candidate ref, FF-eligible old control `772afbd...`, PG current/previous `a342d623...`/`324eb169...`, containers 없음, exact two volumes 없음, images 3종 있음, `.env` 0600/필수7 key 각1이다. secret 값은 기록하지 않았다.
- 이번 S의 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 `NOT_EXECUTED`다. 다음 K exact14는 detached runtime 허용, private exact refs/CAS, rollback `a6dca0d...` + observed current `a342d623...`, mutation 전 runtime drift fail-closed를 구현해야 한다.
- TDD GREEN: exact-binding focused `3 passed, 192 deselected`; raw history 보존, exact10/exact121, 후속 K exact14/hash, artifact tamper와 Git direct-child/private authority 거부를 확인했다. `py_compile`, `git diff --check`도 PASS했다.
- 첫 materialization live checker는 `EVENT_EFFECT_MISMATCH`였다. root cause는 seq539 `PACKAGE_STARTED` details에 공통 repository reducer가 요구하는 upstream/projection/base/relation 필드가 누락된 것이다. 이를 재현하는 direct field TDD RED 1건을 추가하고 source projection과 동일한 값으로 보완했다. fingerprint `SEQ539_EVENT_REDUCER_FIELDS_MISSING_R1` 1회.
- 전체 tooling 직렬 실행은 Main이 장시간 무응답으로 중단했다. 중단 전 점 53개만 출력됐고 exit/final summary가 없으므로 PASS로 집계하지 않는다. worktree 전용 잔류 PID `41160`/`8204`만 종료하고 잔류0을 확인했다. `SEQ539_FULL_TOOLING_MAIN_INTERRUPT` 1회는 정식 제품 실패가 아니다.
- 60초 이하 분할 최종 검증: exact-binding focused `3 passed`, 공통 recovery/malformed `2 passed`, live checker `PASS sequence=539`, `py_compile`, `git diff --check`, exact10 hash와 raw seq1~536 prefix 동일성 PASS. full tooling은 `INTERRUPTED_NOT_COUNTED`다.
- canonical exact10만 dirty이며 commit하지 않았다. Developer writer 실행은 완료보고와 함께 Main에 반환한다. 후속 K exact14의 실제 mutation은 Main의 exact binding/dispatch 전까지 금지한다.

### seq539 Main 집중 검증 동일 ancestry 오류 3회 인수

- Main 영향 집중 검증에서 live checker PASS539 뒤 `test_git_and_authority_bindings_are_checked_against_workspace`가 `1 failed, 13 passed, 181 deselected`였다. seq539 collector가 mutated `validated_base_commit` 대신 상수 base로 ancestry를 검사해 `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 누락했다.
- 이 근본 원인은 seq533·seq536에서 이미 각각 교정된 뒤 seq539에 다시 발생해 누적 3회다. 규칙에 따라 Developer 재지시 없이 Main이 직접 writer를 인수했다.
- 수정: repository가 선언한 base의 40자 SHA 형식과 실제 ancestor 관계를 검사한다. 예상 projection 상수 불일치는 기존 `GIT_EXACT_BINDING_PROJECTION_INVALID`로 별도 유지한다.
- 수정 전 실패를 PASS로 대체하지 않는다. 수정 후 동일 영향 테스트와 projection 재결박·전체 tooling을 다시 검증한다.

### seq539 Main 전체 tooling 회귀 보완

- Main ancestry 수정·재결박 후 Codex 번들 Python 집중 검증은 `3 passed, 192 deselected`였다. 시스템 Python 3.14 실행에서는 자식 `git` 캡처 핸들 복제 오류 `WinError 6`가 두 번 발생했으며 제품·계약 실패로 집계하지 않는다.
- fresh 전체 tooling은 `194 passed, 1 failed in 1072.08s`, exit 1이었다. 실패는 `test_c21_provider_wsl_git_only_candidate_bound_status_collection_fails_closed` 한 건이며 fingerprint `SEQ539_STATUS_COLLECTION_ERROR_CODE_REGRESSION_R1`, 오류 횟수 1회다.
- 원인은 seq539 전용 collector가 `git status` 수집 실패를 기존 계약의 `GIT_STATUS_COLLECTION_FAILED` 대신 포괄 오류 `GIT_REQUIRED_COLLECTION_FAILED`로 반환한 회귀다. status 수집을 별도로 검사해 기존 fail-closed 오류 코드를 그대로 유지하도록 수정했다.
- 수정 전 전체 실패는 PASS로 대체하지 않는다. 파생 projection을 다시 결박한 뒤 해당 회귀·집중 계약·live checker를 먼저 검증하고, 최종 fresh 전체 tooling을 재실행한다.
- 독립 Reviewer의 수정 전 최종 판정은 `CLEAN_REVIEW / COMMIT_READY / C0 / I0 / M0`였으나 이 추가 checker 변경 후 재확인이 필요하다. commit·push·WSL·Docker·DB·Provider·Telegram·ysna·main은 계속 `NOT_EXECUTED`다.

### seq539 Main 최종 전체 tooling PASS

- status 수집 오류코드 회귀 보완·projection 재결박 후 live checker는 `PASS sequence=539`, 영향 집중 검증은 `4 passed, 191 deselected`, `git diff --check`는 PASS였다.
- 동일 final diff에 대한 fresh 전체 tooling 명령은 Codex 번들 Python으로 `195 passed in 997.74s (0:16:37)`, exit 0이다. 실행 중 파일 수정은 없었다.
- 이전 `194 passed, 1 failed`는 보완 전 유효 실패 증거로 그대로 보존한다. 이번 PASS는 로컬 tooling 계약만 증명하며 WSL·Docker·DB·Provider·Telegram·ysna 운영 검증으로 승격하지 않는다.
- 다음 안전 행동은 문서 결과를 pure builder로 재결박하고 reviewer가 마지막 checker 변경을 재확인한 뒤 exact10/누적 exact121/history bytes/live checker를 확인하여 seq539 S direct-child commit을 만드는 것이다.
- 최종 Reviewer 재검토는 `COMMIT_READY / C0 / I0 / M0`다. status 수집 실패의 `GIT_STATUS_COLLECTION_FAILED` 보존, exact10/누적 exact121, seq1~536 raw history, deterministic projection, live checker와 diff-check를 재확인했다.
## C-21 seq540~542 Provider WSL exact binding K

- 담당 agent: `developer-primary`; 상태: `IN_PROGRESS_TDD_GREEN`.
- 기준: `71d6747c0b713bedf1a1bc6724a5771d6ae33c60`, exact14 write lease.
- TDD RED: focused 4 FAIL — completion builder, private exact authority, lifecycle validator가 아직 없어서 의도대로 실패했다.
- 반영: private `development` push와 WSL `origin` fetch 권위를 분리하고, clean detached runtime 및 initial/deployed/rolledback tuple을 결박한다.
- analyst 보완: 실제 rollback은 candidate 배포 전 `previous.sha=324eb169...`를 유지하므로 rollback allowlist를 `a6dca0d...`, `a342d623...`, `324eb169...` 3개로 구성한다.
- 오류 횟수: `C21_EXACT_BINDING_COMPLETION_MISSING_R1` 1회(TDD RED), 동일 근본 원인 반복 0회.
- 미실행: commit, push, SSH/WSL mutation, Docker, DB, Provider, Telegram, ysna, main merge.
- 다음 조치: pure seq540~542 projection과 strict checker를 완성하고 focused/full 검증 후 Main에 writer lease를 반환한다.

### seq542 동일 ancestry 오류 반복에 따른 Main 인수

- Developer 확대 회귀는 `14 passed, 285 deselected`, 신규 focused는 `5 passed, 295 deselected`, live checker는 당시 PASS542였다.
- 첫 병렬 전체 결과는 tooling `193 passed, 3 failed in 869.22s`, deploy `100 passed, 2 skipped, 2 failed in 888.65s`였다. 실패 결과는 최종 PASS로 대체하지 않고 그대로 보존한다.
- tooling 3건은 (1) seq536 historical manifest가 current 파일을 읽은 fixture drift `SEQ536_HISTORICAL_GUARD_FIXTURE_DRIFT_R1` 1회, (2) seq542 status 수집 오류코드 회귀 1회, (3) seq542 declared-base ancestry 누락 1회다. Developer가 historical blob 고정, `GIT_STATUS_COLLECTION_FAILED`, declared base 실제 ancestor 검사를 적용했다.
- declared-base ancestry 누락은 seq533·seq536·seq539에 이어 다시 발생한 동일 근본 원인이다. 규칙에 따라 Main이 추가 Developer write를 중단하고 exact14 writer lease를 직접 인수했다. Developer는 `INCOMPLETE_TAKEOVER_PACKET`을 제출했고 실행 중 pytest/python 잔류는 없었다.
- deploy 2건은 legacy Windows fixture에서 mock `stat` 디렉터리를 POSIX Bash PATH로 전달하지 못해 guard 전 `server-only environment mode`로 실패한 환경 fixture 오류였다. Main이 해당 PATH 3곳을 POSIX 목록으로 고정했다. 직렬 재현에서 1건은 새 guard의 오류 문자열이 기존 `candidate source must be the exact107 commit` 계약을 축약한 호환성 회귀로 드러나 기존 문자열을 복원했다.
- Main 보완 후 두 legacy deploy fixture는 `2 passed in 25.87s`, exit 0이다. 외부 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 `NOT_EXECUTED`다.
- 현재 파생 P/E/H/D/M은 마지막 코드·문서 변경 전 materialization일 수 있으므로 pure builder 재결박이 필요하다. 이후 live checker, 영향 focused, 직렬 전체 tooling/deploy, independent review, exact14/누적 exact125를 다시 검증한다.

### seq542 Main 최종 검증 마감

- Main 보완·재결박 후 live checker는 `PASS sequence=542`, tooling 영향 집중은 `3 passed, 193 deselected`, deploy 영향 집중은 `6 passed, 98 deselected`, diff-check는 PASS였다.
- 동일 final code diff의 직렬 전체 tooling은 `196 passed in 925.73s (0:15:25)`, exit 0이다.
- 동일 final code diff의 직렬 전체 deploy 계약은 `102 passed, 2 skipped in 1043.36s (0:17:23)`, exit 0이다. skip 2건은 Git Bash/NTFS가 POSIX 0600/0400 mode를 표현하지 못하는 항목과 Compose parser가 필요한 WSL 전용 항목이며 실제 WSL PASS로 승격하지 않는다.
- 독립 Reviewer 판정은 `COMMIT_READY / C0 / I0 / M0`다. exact14/누적 exact125, seq1~539 raw history, deterministic projection, private development push와 WSL origin fetch 권위/CAS, a6/a342/324 lifecycle·rollback allowlist, runtime/image drift fail-closed, historical seq536 isolation과 Git 오류코드를 확인했다.
- 다음 안전 행동은 최종 문서 결과를 pure builder로 재결박한 뒤 live checker, exact14/누적 exact125/history, direct-child/clean 상태를 확인하여 seq542 K commit을 생성하는 것이다. 외부 push·WSL/Docker/DB·Provider/Telegram·ysna/main은 여전히 `NOT_EXECUTED`다.

## 2026-09-07 C-21 seq543~548 Provider 제외 WSL verify scope correction

- 담당 agent: `developer-primary` (subagent `/root/developer_seq548_verify_scope`)
- 기준: clean `c330d34ea7d0acc7e423a978f9c558c94c159118`, private control CAS도 동일, candidate ref `a6dca0da5a37e64491e91813895268e78ecb78b2`.
- 상태: exact17 구현 및 seq548 projection 생성 단계.
- 런타임 사실: deploy `PASS`; PG15는 local Provider envelope에서 중단; PG15 SSE/backup `NOT_REACHED`; PG18RC `NOT_STARTED`; local Provider status `ATTEMPTED`; external Provider/billing 및 Telegram `NOT_EXECUTED`.
- TDD RED `C21_WSL_VERIFY_PROVIDER_RUNTIME_SCOPE_LEAK_R1` 1회: `verify.sh`에 `/api/providers` 호출과 Provider 전용 temp/parser/assertion이 남아 focused `1 failed, 1 passed`.
- 조치: 모든 Provider runtime 호출과 전용 parser를 제거하고 auth session, SSE, Last-Event-ID, same-origin, migration, backup/restore는 유지. focused `2 passed`와 `bash -n` PASS.
- 구현 오류 `C21_VERIFY_SCOPE_BUILDER_UNDEFINED_SYMBOL_R1` 1회: 새 builder가 미정의 상수 `C21_RESUME_CANDIDATE`를 참조해 NameError. canonical `C21_RESUME_PARENT`로 수정, 반복 0.
- 테스트 오류 `C21_VERIFY_SCOPE_HISTORY_ASSERTION_R1` 1회: 최초 테스트가 JSON 내부 comma로 history prefix를 잘못 분리. production helper `raw_event_object_prefix_bytes(..., 542)` 비교로 정정, 반복 0.
- hash 산식 차이 `C21_VERIFY_SCOPE_WINDOWS_SORT_HASH_R1` 1회: 승인 hash는 Windows `Sort-Object` 문화권 정렬이고 기존 Python ordinal 정렬과 달랐다. underscore/hyphen collation을 재현한 deterministic helper로 exact17 `78D7...9502`, cumulative131 `984F...574A`를 모두 검증하도록 보완.
- valid failure count: 기존 `2` 유지. 위 항목은 구현·테스트 도구 오류이며 정식 동일 runtime failure로 증분하지 않는다.
- 외부 side effect: commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main 모두 `NOT_EXECUTED`.

### seq548 전체 회귀 및 환경 진단

- API full: `8 passed`.
- deploy full 최초 실행: `27 passed, 1 skipped, 77 failed in 698.76s`.
- 환경 fingerprint `BASH_D_DRIVE_MOUNT_UNAVAILABLE_R1` 2회 확인: 모든 실패가 `/d/tmp/...` 또는 `/d/tmp/.../candidate-manifest-guard.sh` 부재로 exit 127이었다. read-only 진단은 Git Bash cwd `/mnt/d/tmp/anvil-c21-operational-execution`, `/d/tmp=MISSING`, `/d/tmp/.../guard=MISSING`를 확인했다. 제품 assertion failure가 아니며 제품 코드를 이 환경에 맞춰 우회 수정하지 않는다.
- tooling full 최초 실행: `195 passed, 2 failed in 812.52s`.
- `C21_VERIFY_SCOPE_HANDOFF_PATH_FIELDS_R1` 1회: 새 active instruction에 공통 `artifact_path`/`invocation_path`가 없어 historical missing-file test가 KeyError. 두 필드를 canonical 경로로 추가했다.
- `C21_VERIFY_SCOPE_DECLARED_BASE_ANCESTRY_R1` 1회: seq548 전용 Git predicate가 declared base mutation을 전용 projection mismatch로만 거부하고 공통 named error `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 반환하지 않았다. 기존 seq539/542와 동일한 fail-closed ancestry 검사를 추가했다.
- 각 제품/contract fingerprint 반복은 1회이며 수정 후 focused 및 전체 tooling 재검증 대상으로 둔다.

### seq548 동일 fixture 오류 3회 및 Main takeover

- deploy Git Bash 전체 재검증은 `101 passed, 2 skipped, 2 failed in 898.48s`였다. 두 실패는 제품 런타임이 아니라 Windows fixture의 fake `stat`가 `.env` mode를 전달하지 못해 보안 게이트에서 선행 중단한 동일 fingerprint `BASH_ENV_MODE_SHIM_R1`이다.
- 동일 fingerprint는 전체 실행 1회, focused 재현 1회, `echo 600`을 `printf 600`으로 바꾼 뒤 focused 재검증 1회로 총 3회 반복됐다. 프로젝트 규칙에 따라 Developer Subagent는 추가 수정을 중단하고 `FAILURE_REPORT`와 write lease를 Main Agent에 반환했다.
- Main Agent가 writer를 인수했다. 원인은 외부 명령 PATH에 의존한 fake executable이 Git Bash/Windows 경계에서 안정적으로 선택되지 않은 fixture 설계다. 제품 `common.sh`의 mode 검사는 정상적으로 fail-closed했다.
- 조치: 해당 두 테스트의 격리된 control checkout에만 `stat()` shell function을 주입해 POSIX mode 결과를 결정적으로 고정한다. 제품 파일과 실제 WSL 권한 검사는 변경하지 않는다.
- 인수 시 검증 기준: API `8 passed`, tooling `197 passed in 829.99s`, live checker `PASS sequence=548`; deploy 2건은 수정 후 focused 및 전체 재검증이 필요하다.
- commit, push, WSL/Docker/DB, Provider, Telegram, ysna, main은 인수 시점까지 `NOT_EXECUTED`다.
- Main 수정 후 동일 두 테스트는 Git Bash 고정 환경에서 `2 passed in 28.11s`, exit 0이다. `BASH_ENV_MODE_SHIM_R1`은 제품 우회 없이 격리 fixture의 shell function으로 해소됐다.
- final exact17 재결박 후 live checker는 `PASS sequence=548`, 영향 집중 회귀는 `4 passed, 306 deselected in 30.35s`, `git diff --check`는 PASS였다.
- 동일 final diff의 API 전체 검증은 `8 passed in 1.66s`, exit 0이다.
- 동일 final diff의 deploy 전체 검증은 Git Bash 고정 환경에서 `103 passed, 2 skipped in 1224.87s`, exit 0이다. skip 2건은 Windows/NTFS가 POSIX 0600/0400 mode를 표현하지 못하는 항목과 WSL 전용 Compose parser 항목이며 실제 WSL PASS로 승격하지 않는다.
- 동일 final diff의 tooling 전체 검증은 `197 passed in 961.27s`, exit 0이다.
- Reviewer 1차 판정의 Important 1건은 전체 결과가 아직 문서·projection에 결박되지 않았다는 증거 정합성 항목이었다. 위 결과를 WORK_STATUS·validation·report에 기록하고 P/E/H/D/M을 다시 생성한 뒤 재검토한다.
- 다음 조치: final evidence 재결박, live checker·exact17/누적 exact131/history byte 재확인, Reviewer 재검토 후 direct-child commit 준비다.

## 2026-09-07 seq549~554 WSL rollback scope compatibility 시작 및 시스템 승인 대기

- 담당 Agent: `developer-primary` (`developer_seq554_rollback_scope`). 기준선은 clean `dfd75904e3b6ba0f453965607a95d6020bdc4466`이며 write lease는 승인된 exact16에만 한정했다.
- TDD RED: `python -m pytest tests/deploy/test_wsl_staging_harness.py -q -k seq554`는 `3 failed, 105 deselected`였다. fingerprint `C21_WSL_ROLLBACK_SCOPE_COMPAT_R1_RED` 1회이며, 누락된 commit별 scope map, all-target preflight, process-local scope override를 각각 재현한다.
- 현재 변경 파일은 `tests/deploy/test_wsl_staging_harness.py`, `docs/WORK_STATUS.md`뿐이다. manifest·rollback·guard 구현은 적용되지 않았다.
- 시스템 안전 게이트는 `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/rollback.sh`, `deploy/wsl/candidate-manifest-guard.sh`의 rollback permission-scope·계보 계약 변경에 대해 신산님의 직접적인 `seq549~554 C21_WSL_ROLLBACK_SCOPE_COMPAT_R1 구현 승인`을 요구하며 패치를 거부했다. 거부 횟수 1회이며 우회·간접 적용·재시도하지 않았다.
- 승인되어야 할 정확한 범위: candidate/observed/previous commit별 session scope map 결박, 두 PostgreSQL target의 previous·scope·image·Compose render를 mutation 전에 모두 검사, target별 process-local scope override, health 성공 후 marker/receipt 기록, `.env` byte·mode 불변, exact16 direct-child 및 누적 exact137 guard/checker·seq549~554 projection 구현이다.
- 현재 WSL 사실: PG15·PG18RC verify receipt는 PASS다. 최초 rollback 시도는 PG15 old image unhealthy에서 중단되어 current marker는 candidate `a6dca0d`를 유지했고 PG18RC는 candidate healthy이며 mutation은 시작하지 않았다. 이후 표준 redeploy로 두 target 모두 candidate `a6dca0d` healthy 상태로 복구되었고 `.env` byte·mode는 불변이다.
- Provider·Telegram은 `NOT_EXECUTED`; push·ysna·main merge도 이 Subagent 범위에서 `NOT_EXECUTED`다.
- 상태: `INCOMPLETE_WAITING_SYSTEM_EXECUTION_APPROVAL`. 제품 파일 추가 수정 없이 write lease를 반환한다. 정확한 승인 후 동일 기준선에서 RED를 유지한 채 구현을 재개한다.

### seq554 직접 승인 후 제품 구현 및 projection 별도 승인 대기

- 신산님의 직접 승인에 따라 Manifest commit별 scope map, guard 검증, rollback all-target preflight와 process-local scope override를 구현했다.
- focused GREEN: `python -m pytest tests/deploy/test_wsl_staging_harness.py -q -k seq554`는 `3 passed, 105 deselected`; `bash -n deploy/wsl/rollback.sh`, `bash -n deploy/wsl/candidate-manifest-guard.sh`, `git diff --check`도 PASS다.
- 현재 dirty exact 경로는 9개다: 제품 3개, TDD 1개, `WORK_STATUS` 1개, report/validation/WI/prompt 4개. P/E/H/D/M projection과 tooling test는 아직 생성하지 않았다.
- 시스템 안전 게이트는 seq549~554 이벤트·progress·handoff·manifest projection 및 checker lineage/hash/lease predicate 추가가 scope map·guard·rollback 구현 승인보다 넓은 지속적 무결성 게이트 변경이라고 판정해 1회 거부했다. 요구되는 정확한 추가 승인 범위는 `seq549~554 append-only projection 생성과 exact16/direct-child/cumulative exact137 checker 및 계약 테스트 변경`이다.
- 거부 전에 추가했던 미완성 checker routing 2곳은 즉시 원복했다. 현재 `scripts/check_project_progress.py`는 clean이며 정의되지 않은 seq554 함수 참조가 없다.
- 장시간 full test는 시작하지 않았다. Provider·Telegram·WSL runtime·push·ysna·main merge는 계속 `NOT_EXECUTED`다.
- 상태: `INCOMPLETE_WAITING_PROJECTION_GATE_APPROVAL`. 추가 mutation 없이 write lease를 반환한다.

### seq554 projection 재개 시 해시 및 historical 결박 보완

- 추가 직접 승인 후 seq549~554 pure builder/checker를 구현했다.
- focused tooling 최초 실행은 `2 failed, 197 deselected`였다.
- `C21_SEQ554_DECLARED_PATH_HASH_MISMATCH_R1` 1회: architect 전달값 `203A...`/`79C7...`은 승인된 exact16 목록에서 재현되지 않았다. Main 판정에 따라 실제 PowerShell `Sort-Object` + UTF-8 LF 재계산값 direct `27647FE5BBE135FAB147A635D75BF93B7A4EC03E26BA00C2C709402EFB80B841`, cumulative `71F5E29A6F2AFA16219059D9417415DE3F62A515D7145728F21363EFCB4B42FC`를 정본으로 사용한다.
- `C21_SEQ554_HISTORY_HASH_UNBOUND_R1` 1회: pure builder가 전달받은 historical prefix 내부 변조를 parent blob hash와 대조하지 않았다. `dfd75904`의 P/E/H exact byte hash를 선행 검사하도록 보완했다.
- 두 fingerprint 모두 1회이며 동일 오류 3회 조건에 해당하지 않는다.
- materialize 후 live checker 최초 실행은 `EVENT_EFFECT_MISMATCH`, `HANDOFF_BASELINE_MISMATCH`, `HANDOFF_DIR_STATUS_MISMATCH`, `HANDOFF_FAILURE_COUNT_MISMATCH`였다. fingerprint `C21_SEQ554_GENERIC_PROJECTION_FIELDS_R1` 1회이며, seq554 event에 parent remote projection을, HANDOFF에 source baseline·DIR·failure count를 누락한 원인이다. source 정본 값을 추가하고 재materialize한다.
- 두 번째 live checker는 `EVENT_EFFECT_MISMATCH` 1건만 남았다. fingerprint `C21_SEQ554_EVENT_EXACT_ALLOWED_PATHS_R1` 1회이며, event detail의 cumulative 목록에 generic reducer가 요구하는 `exact_allowed_paths` alias가 빠진 원인이다. 동일 cumulative exact137을 alias로 추가한다.
- alias 추가·재materialize 후 live checker는 `G-05 project progress contract: PASS sequence=554 reporting=AUTO_CONTINUE`이다.
- 기존 rollback allowlist fixture 재검증은 Windows `bash.exe` 경계에서 Python `subprocess(env=...)` 값이 전달되지 않아 `/srv/anvil-wsl` 기본값을 사용하며 1회 실패했다. fingerprint `C21_SEQ554_WSLENV_FIXTURE_FORWARDING_R1` 1회다. 제품이 아니라 fixture 호출 경계이므로 승인된 격리 경로 값을 Bash command에 inline으로 전달한다.
- fixture inline 전달 후 candidate scope mismatch가 2회 재현됐다. fingerprint `C21_SEQ554_WINDOWS_PYTHON_CRLF_POLICY_ROWS_R1` 2회이며, Windows Python의 stdout CRLF가 Bash policy row 끝에 남은 것이 원인이다. 실제 WSL과 같은 `python3`를 fixture parser에 사용해 해소했고 approved rollback fixture는 PASS다. 같은 오류 3회 조건에는 도달하지 않았다.

### seq554 full regression 환경 오류 3회 및 Main takeover 반환

- full deploy/tooling을 병렬 시작했으나 `where.exe bash` 결과 첫 실행 파일이 `C:\Users\cyhuh\AppData\Local\Microsoft\WindowsApps\bash.exe`였고 Git Bash는 두 번째 `C:\Program Files\Git\usr\bin\bash.exe`였다.
- 실행 중 deploy에 다수 공통 실패가 나타나 두 pytest를 Ctrl-C로 중단했다. 결과는 `INTERRUPTED_NOT_COUNTED`이며 PASS/FAIL 증거로 승격하지 않는다.
- fingerprint `BASH_D_DRIVE_MOUNT_UNAVAILABLE_R1`은 기존 seq548 기록의 2회에 이번 잘못된 WSL bash 선택 1회를 합쳐 총 3회다.
- 프로젝트 규칙에 따라 Developer Subagent는 추가 재실행·수정을 중단한다. Main Agent가 이 호스트에 실제 존재하는 `C:\Program Files\Git\usr\bin`을 PATH 선두로 고정해 deploy → tooling을 직렬 재검증한다.
- 반환 시 상태: exact16 16/16 생성, seq1~548 historical hash 결박, focused rollback `12 passed`, focused tooling `2 passed`, shell syntax PASS, live checker는 마지막 materialize 시 `PASS sequence=554`였다. 이 WORK_STATUS 추가로 P/E/H/D/M은 재materialize가 필요하다.
- Provider·Telegram·WSL runtime·Docker·DB·push·ysna·main은 `NOT_EXECUTED`다.

### seq554 Main takeover 재개

- Main 실측 `where.exe bash`는 WindowsApps WSL bash가 1순위, `C:\Program Files\Git\usr\bin\bash.exe`가 2순위였으며 `C:\Program Files\Git\bin\bash.exe`는 이 호스트에 없다.
- Main은 검증 프로세스의 PATH 선두를 `C:\Program Files\Git\usr\bin`으로 고정한다. 이 변경은 제품 코드가 아니라 검증 실행기 선택 정정이다.
- 이 기록을 포함한 final exact16 raw 파일로 P/E/H/D/M을 재생성한 뒤 live checker와 focused 검증을 먼저 실행한다.
- Main 재결박 후 live checker `PASS sequence=554`, seq554 focused deploy `3 passed`, focused tooling `2 passed`, rollback/guard `bash -n` 및 diff-check PASS였다.
- Git Bash 고정 전체 deploy 1차는 `104 passed, 2 skipped, 2 failed in 906.19s`였다. 실패는 서로 다른 fixture root다.
  - `C21_SEQ554_HISTORICAL_ROLLBACK_MANIFEST_DRIFT_R1` 1회: historical seq494 guard fixture가 current seq554 rollback parser를 혼합해 scope map이 없는 과거 manifest를 malformed로 거부했다. 해당 테스트는 parent `dfd7590` rollback blob으로 고정하고 새 scope 계약은 seq554 전용 테스트가 검증한다.
  - `C21_SEQ554_ROLLBACK_UNIT_POSIX_MAPPING_R1` 1회: 새 rollback allowlist unit의 `_posix`가 WSL 전용 `/mnt/d`를 고정해 Git Bash에서 script exit127이 발생했다. 공통 Windows fixture 방식대로 `cygpath`를 우선하고 fallback을 `/d`로 수정한다.
- 두 실패는 제품 runtime 실패가 아니며 각각 1회다. 수정 후 두 테스트 focused PASS와 전체 deploy 재검증이 필요하다.
- 두 fixture 수정 후 focused 재검증은 historical fixture PASS, rollback allowlist unit FAIL이었다. 남은 오류는 `C21_SEQ554_WINDOWS_PYTHON_CRLF_POLICY_ROWS_R1`이며 이전 Developer 기록 2회에 이번 Main focused 1회를 합쳐 총 3회다.
- Main takeover 규칙에 따라 policy row transport에서 Windows Python의 CRLF 끝 `\r`만 제거한다. JSON 내부 scope whitespace·중복·순서 검증은 Python parser에서 이미 선행하므로 manifest 정책을 완화하지 않는다. 실제 WSL LF 출력과 `.env`는 변경하지 않는다.
- CRLF transport 보완 후 historical rollback+allowlist focused는 `10 passed in 22.27s`, live checker·rollback `bash -n`·diff-check는 PASS였다.
- 동일 final diff의 Git Bash 고정 전체 deploy 계약은 `106 passed, 2 skipped in 888.04s`, exit 0이다. skip 2건은 Windows/NTFS POSIX mode와 WSL Compose parser 전용 항목이며 실제 WSL rollback PASS로 승격하지 않는다.
- 동일 final diff의 전체 tooling 계약은 `199 passed in 916.77s`, exit 0이다.
- 다음 조치: final 결과를 validation/report에 기록하고 P/E/H/D/M을 재결박한 뒤 exact16/누적 exact137/history/direct-child 계약과 독립 review를 확인한다.

## 2026-09-07 C-21 WSL cleanup guard source R1 — 플랫폼 안전 게이트 BLOCKED

- 기준: branch `codex/c21-operational-execution`, HEAD `797b4d831e384423fdd9a706f9512ffa9dc79bb5`, parent `dfd75904e3b6ba0f453965607a95d6020bdc4466`; 시작 시 clean.
- TDD RED: 실제 `candidate-manifest-guard.sh`를 `cleanup_wsl_test_volumes` 진입 전 1회 source한 뒤 현재 `common.sh`가 다시 source하여 `readonly variable`로 Docker inventory 전에 종료하는 것을 `cleanup_sources_guard_once_then_reaches_inventory`로 재현했다. GREEN 중간 변경은 `common.sh`의 중복 source 1줄 제거와 common-only fixture의 historical guard 명시 source다.
- 현재 dirty 중간 경로: `deploy/wsl/common.sh`, `tests/deploy/test_wsl_staging_harness.py`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`. guard/checker/projection의 최종 구현, 생성 문서, commit은 미수행이다.
- 플랫폼 거부: `C21_WSL_CLEANUP_GUARD_SOURCE_R1_PLATFORM_GUARD_SCOPE_REJECTED` 1회. `candidate-manifest-guard.sh`의 `797b4d8` direct-child exact15 및 base `eef3496` cumulative exact143 결박 변경을 지속적 보안·무결성 통제 변경으로 판정해 명시적 사용자 승인을 요구했다. 우회·간접 적용은 금지됐다.
- resource mutation=0. Provider, Telegram, WSL, Docker, DB, ysna, main, push, cleanup retry는 모두 `NOT_EXECUTED`.
- 필요한 정확한 승인 범위: `deploy/wsl/candidate-manifest-guard.sh`의 source parent `797b4d8` single-direct-child exact15와 cumulative exact143 결박, 그에 종속한 seq555~560 append-only checker/projection/evidence 문서 생성 및 direct-child commit 검증.
- 다음 조치: 신산님의 위 guard/projection 범위 직접 승인 후에만 existing TDD GREEN을 재개하고 validation 2회·inventory 도달·allowlist cleanup/mutation0 실패 경로를 검증한다.

### reviewer fix round 1

- Reviewer `REWORK C0/I2/M2`를 반영 중이다. I1/I2 RED는 status 수집 오류가 generic collection error로 귀결되는 것을 재현했고, collector에 private development URL/control/candidate CAS 및 named status/base-ancestry fail-closed 계약을 추가했다.
- external runtime actions remain `NOT_EXECUTED`; resource mutation remains `0`.

#### reviewer fix round 1 focused 및 first full tooling

- I1/I2 focused tooling은 development private URL/control/candidate CAS, exact `GIT_STATUS_COLLECTION_FAILED`, declared-base ancestry fail-closed와 seq554 immutable `797b4d8` blob fixture 2곳을 포함해 `4 passed, 198 deselected`, exit0이다.
- real cleanup focused는 실제 `cleanup.sh` entrypoint와 real readonly guard를 사용한다. success=`source1/validate2/env1/inventory reached`, first validation failure=`validate1/env0/inventory0/mutation0`, second validation failure=`validate2/env1/inventory0/mutation0`; duplicate real guard source는 readonly 재선언을 실제 재현하고 inventory/mutation0이다. 결과 `4 passed, 109 deselected`, exit0.
- Reviewer 전달 full deploy는 `107 passed, 2 skipped`, exit0이고, pre-fix full tooling은 `198 passed, 2 failed`, exit1이다. 서로 다른 시점의 증거이며 실패를 PASS로 승격하지 않는다.
- fix-round first full tooling은 `199 passed, 3 failed in 632.58s`, exit1이다. 3건 모두 amend 전 committed successor에 reviewer-fix dirty가 남아 발생한 동일 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`; 코드/계약 테스트 실패가 아니라 postcommit 조건 미충족이며 최종 amend 후 전체 tooling을 재실행한다.
- full deploy는 이 round에서 제품 `cleanup.sh`/`common.sh`/guard bytes가 변경되지 않고 checker/test/evidence만 변경됐으므로 재실행하지 않았다. 변경된 cleanup test는 위 real-entrypoint focused로 실행했다.
- Bash syntax와 Python compile은 PASS. amend 전 live checker는 정확히 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`; 최종 amend 전 PASS로 기록하지 않는다. 외부 WSL/Docker/DB/Provider/Telegram/ysna/main/push/cleanup retry는 계속 `NOT_EXECUTED`, resource mutation=0이다.

#### reviewer fix round 1 clean postcommit full tooling

- first amend `9ccc4104988bebdc61da7cb68b42fba502d3b3ff`는 parent `797b4d831e384423fdd9a706f9512ffa9dc79bb5`의 single direct child였고, clean 상태 live checker는 `G-05 project progress contract: PASS sequence=560 reporting=AUTO_CONTINUE`였다.
- 같은 clean postcommit에서 full tooling은 `202 passed in 637.37s`, exit0이다. 이 결과를 final exact15 evidence에 append하고 P/E/H/D/M을 재materialize한 뒤 최종 amend/postcommit checker와 focused 검증을 다시 수행한다.
- 외부 WSL/Docker/DB/Provider/Telegram/ysna/main/push/cleanup retry는 `NOT_EXECUTED`; resource mutation=0을 유지한다.

#### reviewer fix round 1 TDD 및 환경 오류 원장

- `C21_SEQ560_REAL_ENTRYPOINT_REGRESSION_RED` 1회: 새 3개 test는 helper 부재로 `3 failed, 109 deselected`, exit1을 먼저 확인했다. helper 구현 후 real guard/Git을 유지하고 runtime state/image·Docker/stat만 fixture adapter로 격리했다.
- `C21_SEQ560_ENV_WRAPPER_CRLF_R1` 2회: environment-load 횟수를 `declare -f | sed | eval` wrapper로 관찰한 fixture가 MSYS 함수 재구성 경계에서 CR을 유입해 각 `2 failed, 1 passed`, exit1이었다. 실제 loader baseline test는 같은 환경에서 `1 passed`; loader를 감싸지 않고 real loader의 단일 `stat` 호출에서 횟수를 관찰하도록 바꿔 해소했다. 제품 실패가 아니다.
- `C21_SEQ560_DUPLICATE_SOURCE_REGRESSION_RED` 1회: duplicate-source option 부재로 `1 failed`, exit1을 먼저 확인했다. option 구현 후 첫 실행은 실제 historical 순서 `guard source1 → validation1 → env load1 → guard source2 readonly failure`를 보여 assertion 1건이 실패했다. 관찰된 실제 순서로 기대를 교정한 뒤 GREEN이다.
- `C21_SEQ560_DTMP_SANDBOX_MKDTEMP_BLOCKED` 3회: managed sandbox 안에서 `D:\tmp` `tempfile.mkdtemp`가 멈췄고 faulthandler가 정확히 `tempfile.py:mkdtemp`를 지목했다. 이 플랫폼 실행 오류는 정식 제품 failure가 아니며, 승인된 격리 test 실행으로 전환해 해소했다. 중단된 자체 pytest process tree 2개는 종료했고 외부 runtime/resource mutation은 없었다.
- 유효 제품 실패 횟수는 증가하지 않았고 동일 제품 근본 원인 3회 조건은 발생하지 않았다.

## 2026-09-07 seq560 private push 확인 및 WSL 표준 cleanup 실행 승인 대기

- private authority `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 실제 refs는 control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`로 exact 일치한다. candidate는 불변이며 seq560 control private push도 확인됐다.
- WSL exact preflight는 hostname `SINSAN`, user `daon`, `sudo -n` 가능, root `/srv/anvil-wsl`을 확인했다. application repo는 private origin, clean detached HEAD `a6dca0da5a37e64491e91813895268e78ecb78b2`; local runtime refs는 control `797b4d831e384423fdd9a706f9512ffa9dc79bb5`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`였다. active control pointer는 `stage.3012955.4746`, clean HEAD `797b4d831e384423fdd9a706f9512ffa9dc79bb5`였다.
- `/srv/anvil-wsl/.env`는 SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, mode `0600`, owner `root:root`이며 값은 출력하지 않았다. pg15/pg18rc 모두 `current=previous=324eb169fedbce958d2e8cc29362deb7af433677`였다.
- target inventory는 정확히 container 6개(`1dcc08a82fb4`, `9afd95477687`, `fe74e316c36e`, `e8773a61f46e`, `aaac7fe7e54e`, `4cf00905c058`), project network 4개(`f2043a36c089`, `3bf6a1359388`, `fba29146f52b`, `130e79264d48`), exact volume 2개(`anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data`)다. Compose project/service 및 `WSL_SERVER_TEST_STAGING`/`C21_WSL_ISOLATED_TEST` labels가 허용 계약과 일치했고 두 ready endpoint는 migration head `0013_task_bootstrap_authority`로 ready였다. web image revision은 두 target 모두 `324eb169fedbce958d2e8cc29362deb7af433677`; rollback/verify/pre-migration receipts와 backup evidence 존재를 확인했다.
- mutation 전 unrelated inventory 기준은 container `73`개 / SHA-256 `ac52390889e31eb3e832e5b77ae89e6bbaa8bd8aaaf6e852983f84e8ce9f45c5`, network `26`개 / SHA-256 `105faf480afdec45c4a15dea785bbaa6765c9102cc6e1f51b42d7892b8eb5437`, volume `498`개 / SHA-256 `9d1a7e1bba0f752e1fd9fa696aedd034e226ba662fbdd40e85354ecef39afa69`다. target hash는 container `7dc4375c47d35fbb923bc6cb8ab25dbf7629884b3ce467b07be28aa069df7be4`, network `70e8a0323d6d205949b630af9d53fe0aa2ab7d141886a002b7dea8a6ab068ab3`, volume `d0ae7dc77672af341bf5e4566c0c17273139a71f10d4f1e3cf1e4e5ed717ca79`였다.
- immutable `b2ba821` Git blob bytes의 manifest SHA-256은 `4fedf2ccc05d309099363e336df8107c479f51124f62e98b3bffacdc9f44442a`, cleanup script SHA-256은 `65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d`로 계산했다. active `797b4d8`와 `b2ba821`의 `control-runtime.sh` blob은 동일 `2e0dcb8a20d42488a5f628e573c8b4f0d7547a4e`다.
- 플랫폼 cleanup 실행 거부는 `C21_SEQ560_WSL_CLEANUP_DESTRUCTIVE_APPROVAL_REJECTED` 1회다. private refs fetch + standard control stage publication + 표준 `cleanup.sh` 1회 요청을 정확한 Docker 삭제 범위로 escalation했으나 직접 사용자 삭제 승인이 확인되지 않는다는 이유로 `CreateProcess` 전에 거부됐다. 우회·분할·수동 Docker 삭제·재시도하지 않았다.
- 거부가 process 시작 전이므로 application fetch `0`, control stage publication `0`, `cleanup.sh` invocation `0`, Docker mutation `0`이다. 재조회 결과 application/control/.env/markers와 target container `6`·network `4`·volume `2`는 모두 preflight 상태 그대로다. 이 거부는 제품 failure count에 포함하지 않는다.
- 필요한 직접 승인 문구: `WSL SINSAN의 anvil-wsl-pg15/anvil-wsl-pg18rc containers와 네 개의 해당 project networks 및 exact volumes anvil-wsl-pg15_anvil-db-data, anvil-wsl-pg18rc_anvil-db-data를 표준 cleanup.sh 1회로 삭제하고, b2ba821 control stage publication과 application private refs fetch를 허용한다.`
- 다음 조치: 위 직접 승인 후 동일 read-only CAS preflight를 다시 통과한 경우에만 immutable manifest/control checksum을 고정하여 표준 Git-only control stage publication과 `cleanup.sh`를 정확히 1회 실행한다. 이후 target containers/networks `0`, exact volumes absent, unrelated inventory hash 불변, `.env` hash/mode 불변, application clean detached candidate, active/published control `b2ba821`, receipts/evidence 보존을 검증한다. Provider·Telegram·ysna·main·별도 DB 조작은 계속 금지한다.

## 2026-09-07 C-21 WSL cleanup runtime result seq561~566 기록

- 담당: `developer-primary` (`developer_seq566_cleanup_result`); parent/control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`; exact12 append-only writer lease.
- Windows `Sort-Object` 재계산은 exact12 `54DE92EBEC20A6897379A2B14FBBA258517A0E6A52A221C6217739B40FA9E0EF`, cumulative149 `F804F93F8F8BE351071EB0CC3674A4EB442BF8D0E74DFF0D65FAD88AD1DE85F2`; ordinal 재계산은 exact12 `63E7070C7D5D018F76DE04A0369B5778F3B58AF2798EA2EC78ED3CFB75645CA0`, cumulative149 `B956DA56B0D6BD17D0918878F1E3F80E672FAE971CEE3E4793A1CE227E0C47C8`로 전달값과 일치했다.
- TDD RED `C21_SEQ566_RUNTIME_RESULT_BUILDER_MISSING_R1` 1회: 신규 builder/validator/collector가 없어 focused tooling `4 failed, 202 deselected`, exit `1`을 확인했다. 이는 예상된 기능 부재이며 제품 runtime failure count를 증가시키지 않는다.
- runtime 사실: cleanup invocation `1`, internal exit `0`, outer wrapper exit `1`; wrapper failure `POST_CLEANUP_UNRELATED_INVENTORY_EQUALITY_ASSERTION`은 cleanup 실패가 아니다. target containers `6→0`, networks `4→0`, exact volumes `2→0`; unrelated global equality false지만 pre-existing missing/changed는 `0/0`이고 차이는 concurrent Daon2/eoul additions or replacements뿐이다.
- application은 clean detached candidate/private origin, control은 active `stage.3558037.6302` clean `b2ba821`/private origin이다. `.env` SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, size443, mode0600, root:root 불변; PG15/PG18RC marker current=previous=`324eb169fedbce958d2e8cc29362deb7af433677`; receipts/evidence hashes와 counts 보존이다.
- 이전 preapproval denial은 process-not-created/mutation0이다. distro-selection과 post-verify `ENV_STAT` quoting damage(exit127, containing block exit0)는 observation error이며 valid failure count는 기존 `2`를 유지한다.
- `PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`은 핵심 require-escalated wrapper와 cleanup env/argv 전문이 유실되어 정확히 재구성할 수 없는 증거 한계다. Reviewer Minor를 `OPEN / UNRESOLVED_EVIDENCE_DETAIL`로 유지하고 결과/hash/exit 보존을 별도 기록한다.
- 정확한 runtime observed timestamp도 보존되지 않았다. `runtime_observed_at_status=UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`, `runtime_observed_at=null`, `runtime_observed_date=2026-09-07`로 기록한다. `recorded_at=2026-09-07T04:00:51.7574180Z`는 materialize 시작 시 로컬 UTC clock을 1회 측정한 값이며 source는 `LOCAL_CLOCK_AT_APPEND_ONLY_RECORDING`이다. 분 단위 실제 cleanup 시각 증거가 남지 않은 비용을 명시한다.
- Provider/Telegram/separate DB/ysna/main은 `NOT_EXECUTED`; `volume_cleanup=EXECUTED_APPROVED`. 이 result package에서 새 WSL/Docker/DB 외부 실행이나 push는 하지 않는다.
- 상태 목표: `READY_FOR_C21_WSL_ACCEPTANCE`, accepted=false, tester `PENDING`, C-01 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2 `NOT_TRIGGERED`, next `INDEPENDENT_C21_WSL_ACCEPTANCE_REVIEW`.

### seq566 Developer 검증 결과

- 초기 RED는 `4 failed, 202 deselected`, exit1; 구현 후 focused GREEN은 `5 passed, 202 deselected`, exit0이다.
- runtime result materialize 후 live checker는 `PASS sequence=566 reporting=AUTO_CONTINUE`; `git diff --check`도 exit0이다.
- 첫 `py_compile`은 managed sandbox가 `scripts/__pycache__` write를 거부해 exit1이었다. 이는 source syntax 실패가 아니며, 파일을 생성하지 않는 direct in-memory compile은 두 변경 Python 파일 모두 PASS/exit0이다.
- 첫 sandbox full tooling은 34% 이후 기존 `D:\tmp tempfile.mkdtemp` stall을 재현해 Ctrl-C로 중단했다. `INTERRUPTED_NOT_COUNTED`이며 PASS 또는 제품 FAIL로 계상하지 않는다. 동일 명령의 승인된 격리 실행은 `207 passed in 1029.51s (0:17:09)`, exit0이다.
- 제품/deploy/guard bytes는 parent `b2ba821`과 동일하므로 deploy full은 재실행하지 않는다. 최종 evidence append 뒤 파생 P/E/H/D/M 재결박과 focused/live/diff/compile만 fresh 재검증한다.
- 첫 result-evidence append와 deterministic 재결박 뒤 precommit focused는 다시 `5 passed, 202 deselected`, live checker sequence566 PASS, diff-check PASS, direct compile PASS다.
- `C21_SEQ566_EVENT_REMOTE_PROJECTION_MISSING_R1` 1회: 최초 live checker의 `EVENT_EFFECT_MISMATCH`는 seq566 완료 Event에 source remote-head projection이 빠진 원인이며 `dispatch_upstream_head`를 immutable source 값으로 추가해 해소했다.
- `C21_SEQ566_PYCOMPILE_CACHE_PERMISSION_R1` 1회와 `C21_SEQ566_SANDBOX_MKDTEMP_STALL_R1` 1회는 각각 pycache write 권한과 알려진 sandbox temp 생성 정지의 환경 오류다. 정식 제품 failure count는 기존 `2`로 유지한다.

## 2026-09-07 C-21 WSL acceptance strict successor seq567~572

- 담당: `developer-primary` (`developer_seq572_wsl_acceptance_strict`); WorkInstruction `WI-C-21-WSL-ACCEPTANCE-STRICT-SUCCESSOR-20260907-001`; parent `bcaeeacd1618461127c2387504e2535a0d54504f`, private control expected `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`; exact12 append-only writer lease.
- 독립 Tester source는 파일이 아닌 `INDEPENDENT_TESTER_AGENT_REPORT`이며 repository artifact는 `ABSENT`다. 판정 `ACCEPTED_WITH_LIMITATION — C-21 WSL 선행검증 범위에 한정`, findings `C0/I0/M2`를 원문 경계대로 기록한다.
- machine 목표: `acceptance_scope=C21_WSL`, `wsl_acceptance_status=ACCEPTED_WITH_LIMITATION`, `accepted=false`, `c21_acceptance_status=BLOCKED_NOT_ACCEPTED`, C-01 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2 `NOT_TRIGGERED`.
- 열린 limitation: primary wrapper/env/argv fulltext 미보존, exact runtime timestamp null/unavailable, receipt originals/paths 미독립 확인, same-origin HTTP ingress만 확인하고 실제 browser Network 미검증.
- 비승인/미검증: 실제 Provider, Telegram, browser acceptance, ysna, main, C-01 start, push, 외부 실행. 다음은 계획에 따른 사용자 소유의 실제 Provider/Telegram 검증과 실제 브라우저 인수다.
- TDD RED `C21_SEQ566_JSON_SCALAR_TYPE_CONFUSION_R1` 1회: runtime public validator가 `invocation_count=True`, `internal_exit_code=False`, `outer_wrapper_exit_code=1.0`을 정상 정수와 동일하게 비교해 `1 failed`, exit1. 공용 parser/canonical JSON을 바꾸지 않고 C-21 전용 recursive strict comparator로 보완했다.
- TDD RED `C21_SEQ572_STRICT_SUCCESSOR_MISSING_R1` 1회: seq572 builder/validator/collector/routing 부재를 신규 class 6개 test에서 `1 failure, 5 errors`, exit1로 확인했다. 이는 예상된 기능 부재이고 valid product failure count를 증가시키지 않는다.
- 환경 오류 `C21_SEQ572_PYTHON_LAUNCHER_ENV_R1` 3회: `python` 명령 부재, `py -3` 설치 Python 부재, `uv` cache 초기화 access denied였다. 제품 실패가 아니며 bundled workspace Python으로 전환해 TDD RED를 정상 실행했다.
- exact12 Windows/ordinal 재계산은 `9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F` / `495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536`; cumulative155는 `4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C` / `2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D`로 전달값과 일치했다.
- 현재 단계: raw7 작성 완료, seq572 P/E/H/D/M deterministic materialize 및 focused GREEN 전. 제품/deploy/guard bytes는 수정하지 않았다.

### seq572 Developer 검증 결과

- 최초 materialize 후 focused는 `11 passed, 1 failed`, exit1이었다. `C21_SEQ572_EVENT_CONTRACT_FIELDS_R1` 1회로, generic Event 계약이 completion top-level `accepted` 누락을 `EVENT_PAYLOAD_MISSING`, repository projection의 `dispatch_upstream_head` 누락을 `EVENT_EFFECT_MISMATCH`로 검출했다. seq566과 같은 두 필드만 보완해 해소했으며 제품 runtime failure가 아니다.
- 재materialize 후 focused seq566+seq572 public-path tests는 `12 tests in 14.525s`, `OK`, exit0이다.
- live checker 첫 호출은 잘못된 `--root .` 인수 때문에 `--root`를 directory로 해석해 LOAD_ERROR를 냈다. `C21_SEQ572_LIVE_CHECKER_ARGV_R1` 1회 명령 사용 오류이며, 지원되는 positional `.` 호출은 `G-05 project progress contract: PASS sequence=572 reporting=AUTO_CONTINUE`, exit0이다.
- `git diff --check` exit0, 두 Python 파일 direct in-memory compile PASS/exit0, dirty 경로 exact12 일치다.
- 승인된 격리 실행의 full tooling은 `214 tests in 667.571s`, `OK`, exit0이다. 제품/deploy/guard bytes는 parent와 동일하므로 deploy full은 실행하지 않았다.
- 다음: 이 결과가 포함된 raw7로 P/E/H/D/M 최종 재materialize → fresh focused/live/diff/compile → exact12 단일 direct-child commit → clean postcommit checker. push/external execution은 계속 금지한다.

### seq566 public projection 직접 RED 보강

- 완료 전 자체 검토에서 최초 seq566 projection assertion이 current seq572 raw mismatch로도 만족될 수 있음을 발견했다. immutable `bcaeeacd` seq566 artifacts를 synthetic generated-file view로 제공하도록 테스트를 교체했다.
- `C21_SEQ566_PROJECTION_FLOAT_TYPE_CONFUSION_R1` 1회: direct projection에 `event_sequence=566.0`을 넣었을 때 빈 오류 목록을 반환해 `1 failed`, exit1을 정확히 확인했다. supplied progress/events/digest/manifest 비교를 C-21 strict helper에 직접 연결한 뒤 해당 테스트 PASS다.
- 이 테스트/코드 변경으로 앞선 full tooling 결과는 역사 증거로만 유지하고 final raw7 재materialize 뒤 focused 및 full tooling을 다시 실행한다.

### seq572 final full tooling 및 evidence 결박

- direct seq566 projection strict 보강 후 pre-evidence focused는 `12 tests in 18.705s`, `OK`, live checker sequence572 PASS, diff-check PASS다.
- `C21_SEQ572_PYCOMPILE_CACHE_PERMISSION_R1` 1회: `py_compile`이 managed sandbox의 `scripts/__pycache__` 쓰기를 거부해 exit1이었다. source syntax failure가 아니며 파일 생성 없는 direct `compile()`은 두 변경 Python 파일 모두 PASS/exit0이다.
- 승인된 격리 final full tooling은 `214 tests in 680.535s`, `OK`, exit0이다. trace/failure는 없었다.
- 이 결과를 raw7에 기록하고 P/E/H/D/M을 deterministic 재materialize한 뒤 fresh focused/live/diff/compile, exact path/hash/status 검증, exact12 direct-child commit과 clean postcommit checker를 수행한다.
- final full 결과를 반영한 첫 재materialize 뒤 focused는 `12 tests in 16.375s`, `OK`, live checker sequence572 PASS, diff-check PASS, direct `compile()` PASS다.
- 독립 PowerShell 재계산은 dirty exact12 count12와 cumulative155를 확인했고 Windows/ordinal hash가 각각 exact `9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F` / `495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536`, cumulative `4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C` / `2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D`로 계약과 일치했다.
- 위 검증 결과를 마지막 raw7 append로 고정한 뒤 파생 P/E/H/D/M을 한 번 더 재materialize한다. 이후 실행하는 focused/live/diff/compile과 exact path/hash는 precommit 최종 증거이며 추가 evidence append 없이 commit한다.
# 2026-09-07 C-21 Workbench UI rework local 착수

- 담당: `developer-primary`; dispatch base `8d043e39f6066283821abe47b36fa83e5ecff8b5`; 상태 `START_PROJECTION_TDD`.
- 범위: seq573~578 append-only, product exact11, LOCAL-only. Provider/Telegram 실제 호출·WSL·ysna·main·DB/schema/Secret 변경은 제외한다.
- topology: seq573 worker lease → seq574 write lease → seq575 package start → product direct child → seq576 write revoke → seq577 worker revoke → seq578 completion.
- TDD RED: `python -m unittest tests.tooling.test_project_progress.C21WorkbenchUiReworkLocalStartTests`는 builder/metadata 부재로 `1 failure, 1 error`, exit1. 예상된 착수 projection RED이며 제품 오류가 아니다.
- 오류 횟수: 제품 오류 0; 절차상 RED 1(실패 집계 제외). 다음 조치: start projection builder/validator/collector를 최소 구현해 seq575 checkpoint를 결박한다.

- start metadata 첫 GREEN 시도는 기존 checker의 `windows`가 CRLF가 아니라 Windows ordinal(casefold/underscore normalization) 정렬을 뜻한다는 점을 잘못 적용해 `C21_WORKBENCH_UI_LOCAL_PATH_METADATA_INVALID` 2 errors, exit1이었다. 실제 helper 결과로 고정 hash를 정정했다. 제품 오류 0, 절차 오류 1이며 같은 근본원인 반복은 아니다.

- start builder focused는 `2 tests / OK`였으나 첫 live checker에서 event payload/effect 및 HANDOFF 공통 비교 필드 누락을 fail-closed로 검출했다. 기존 event contract의 flat lease payload와 repository effect, HANDOFF 공통 필드를 builder에 추가한다. 제품 오류 0, projection 계약 오류 1이며 같은 근본원인 반복은 아니다.

- seq575 start projection GREEN: focused `2 tests / OK`, live checker `PASS sequence=575 reporting=AUTO_CONTINUE`, `git diff --check` exit0. exact10 start lease와 exact11 product write lease가 ACTIVE이며 다음은 제품 테스트 RED다.

## 2026-09-07 C-21 Workbench UI rework local 제품 구현

- 담당: `developer-primary`; 제품 commit `7eb2cc291bda729e21deebbed86376eac4db7c2b`; parent start checkpoint `72139df2f8cd3c16e1c7c08b26686f675400a2c9`; exact11/path hash `3FD59352816A3CAF316F1EF832C9B206B20363197C4B5887626BA8D964095DFF`.
- TDD RED: Node는 production marker/exports 부재로 실패했고 ASGI는 production root marker 부재로 실패했다. Chromium `--workbench-self-test`는 기능 부재로 required arguments 오류를 반환했다. 모두 승인 범위 기능 부재를 먼저 확인한 예상 RED다.
- GREEN: web 전체 `19/19`, API+agent_team 표준 범위 `193/193`, 신규 실제 headless Chromium 클릭/Network, 기존 SSE self-test와 cross-origin rejection, `git diff --check`, production browser secret/internal-host scan을 통과했다.
- Chromium은 `/api/providers` → UPSTAGE detail/models → GROQ 클릭 → authenticated SSE 2회 흐름을 실제 클릭했다. 요청은 모두 same-origin GET이고 두 번째 SSE에만 `Last-Event-ID: event-ui-1`이 있었다. 설정/연결 테스트/model refresh 버튼 3개는 disabled이며 POST와 fixture API 요청은 없었다.
- 전체 `pytest -q`는 exit2로 PASS가 아니다. 기존 collection 오류 7건: PyYAML 미설치 1, 중복 `test_models`/`test_repository` import mismatch 3, fixture `src` import 부재 3. 제품 변경과 직접 관련된 표준 분리 suite는 위와 같이 PASS했다.
- 오류 원장: Python PATH 명령 부재 1회와 bundled Python의 pytest 부재 1회는 환경 실행 오류다. Chromium disabled button selector ID 부재 1회는 probe assertion 보완 오류이며 실제 버튼은 disabled였다. seq575 checker의 제품 commit 직후 `GIT_DESCENDANT_PATH_SET_MISMATCH` 1회는 start-only predicate가 제품 direct child를 아직 허용하지 않은 lifecycle 공백이다. 유효 제품 실패 0, 동일 근본 원인 3회 없음.
- 제외/미검증: 실제 Provider/Telegram 호출, WSL, ysna, main, DB/schema/Secret 변경과 push는 `NOT_EXECUTED`. 다음은 seq576~578 결과 projection과 독립 Tester 검토다.

## 2026-09-07 C-21 Workbench UI rework local full tooling 판정

- canonical full tooling은 `583 tests in 1136.972s`, `FAILED (failures=19)`, exit1이다. PASS 또는 미검증으로 승격하지 않는다.
- root-cause 분류: A-13 current-root temporal coupling 7, A-14 accepted artifact checksum/current-root coupling 2, G-07 historical authority/current-root coupling 3, Phase G Gate historical baseline/current-root coupling 4, progress historical projection/current-root coupling 2, seq578 validated-base collector fail-open 1이다.
- seq578 collector 1건은 declared `validated_base_commit`이 canonical exact base와 일치하고 현재 HEAD의 ancestor인지 먼저 확인하도록 최소 수정했다. 해당 mutation test를 targeted GREEN으로 재검증한다.
- 나머지 18건은 UI 제품 동작 실패가 아니지만 이번 변경으로 드러난 회귀다. 기존 seq1~572와 historical evidence를 변경하지 않고 별도 historical-fixture reconciliation package에서 immutable commit/file-view fixture로 수정한다. 현재 exact10 lease 밖의 과거 테스트 4개 파일은 이 package에서 수정하지 않았다.
- 따라서 이 package는 `COMPLETED_LOCAL_PENDING_TOOLING_RECONCILIATION`으로 닫고 write/worker lease를 회수한다. 독립 Tester는 reconciliation 완료 전 `BLOCKED_PENDING_TOOLING_RECONCILIATION`이다. 다음 안전 조치는 `C21_WORKBENCH_UI_HISTORICAL_FIXTURE_RECONCILIATION`이다.
- collector 보완 후 focused result 계약은 `3 tests in 3.461s`, `OK`, exit0이다. 이어 start+result projection `5 tests in 2.598s`, `OK`, live checker `PASS sequence=578 reporting=AUTO_CONTINUE`, `git diff --check` exit0을 확인했다. exact10 밖 A-13/A-14/G-07/Phase G 테스트 파일 diff는 0이다.

## 2026-09-07 C-21 historical fixture reconciliation FAILURE_REPORT

- 담당: `developer-primary`; parent `d059e043ff642c9f5eb50da8dda8aaa8f4ed8408`; lineage `C21_WORKBENCH_TOOLING_HISTORICAL_FIXTURE_RECONCILIATION_TEMPORAL_FIXTURE`.
- 승인 범위의 기존 RED 재현은 예상 18건과 달리 현재 `176 tests in 35.789s`, `FAILED (failures=16)`, exit1이었다. 분류는 A-13 7, A-14 2, G-07 3, Phase G 4이며 제품 failure가 아닌 current-root temporal 결합이다.
- 1차 immutable fixture 수정 뒤 `177 tests in 115.147s`, `FAILED (failures=4)`, exit1이었다. A-13 당시 successor 존재 계약 1, A-14 당시 portable hash 계약 1, Phase G의 clean historical HEAD와 당시 progress Git projection 차이 2였다.
- 2차 당시 literal/검증 경계 복원 뒤 `177 tests in 100.147s`, `FAILED (failures=2)`, exit1이었다. A-13/A-14/G-07은 GREEN이지만 Phase G checkpoint manifest가 clean `57703ffc3521287cdd7d54b07bfd7c9001928388` snapshot에서 `GATE_CHECKPOINT_RAW_MISMATCH`, `GATE_CHECKPOINT_TARGET_BYTES_MISMATCH`, `GATE_CHECKPOINT_TARGET_MISMATCH`를 반환한다.
- 동일 temporal-fixture lineage가 세 실행에서 연속 확인되어 프로젝트의 3회 규칙에 따라 추가 수정·재시도·seq579~584 projection materialization·commit을 중단한다. 상태는 `FAILURE_REPORT`; write/worker lease를 Main Agent에 반환한다.
- 현재 변경은 test-only exact4와 본 작업현황 append뿐이다. 제품, historical evidence, historical checker/constants, `scripts/check_g07_baseline.py`는 변경하지 않았다. push/WSL/Provider/Telegram/ysna/main/external side effect는 `NOT_EXECUTED`다.
- Main 인수 지점: Phase G accepted checkpoint가 원래 `HEAD=5ca9c1f` + post-checkpoint dirty projection으로 생성된 계약인지 확인하고, clean `57703ff`를 억지로 현재 hash에 맞추지 말고 materialized historical file-view 또는 전용 collector로 당시 raw view를 재현해야 한다. rollback은 네 test 파일과 이 WORK_STATUS append를 parent `d059e043` 상태로 복원하는 것이다.
## 2026-09-07 C-21 Workbench UI historical fixture reconciliation seq579~584 — Main takeover

- 기준 HEAD `d059e043ff642c9f5eb50da8dda8aaa8f4ed8408`, 제품 commit `7eb2cc291bda729e21deebbed86376eac4db7c2b`, 시작 시 clean이다.
- test-only lease는 A13/A14/G07/Phase-G tooling test 4경로이며 historical evidence·scripts·상수·제품 코드는 불변이다.
- 동일 lineage `C21_WORKBENCH_TOOLING_HISTORICAL_FIXTURE_RECONCILIATION_TEMPORAL_FIXTURE`가 16 → 4 → 2 failures로 3회 이어져 Developer가 중지하고 Main이 인수했다.
- Main 인수 1차는 clean `57703ff`를 사용해 checkpoint manifest가 결박한 transient report bytes를 찾지 못해 Phase-G 2건이 계속 실패했다.
- Git object database와 reachable history에 해당 두 transient blob이 없음을 확인했다. 현재 checker가 사용하는 declaration-only checkpoint 검증과 commit별 frozen root를 결합하는 것이 보존된 계약이다.
- Main 인수 2차는 abbreviated SHA를 full SHA와 직접 비교하여 checkout/clean assertion 2건이 실패했다. 저장소 `rev-parse`로 full SHA를 확인해 교정했다.
- 108-package gate 재계산은 `e59c4a105dab0faae31f43fd75e3ac53f1992ffe`, fenced A-02 start는 `2bd88123e93550db5874b479c82d78d4733fd53f` frozen root에 결박했다.
- Main focused Phase-G 2 tests는 `Ran 2 tests in 12.444s / OK`; exact4 historical modules는 `Ran 177 tests in 97.378s / OK`다.
- 현재 상태는 seq579~584 materialize 및 전체 tooling 전 `IN_PROGRESS`; Provider·Telegram·WSL·ysna·main·push는 `NOT_EXECUTED`다.

### seq584 Main 전체 tooling 1차 및 temporal test 보완

- seq584 exact16/cumulative183 경로 metadata를 Windows/ordinal SHA-256까지 상수로 결박했다. exact16은 `4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0` / `E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90`, cumulative183은 `BCCCA49E2B920D3A4FD4C557792F63204E20708E4897812CB4457DEB5ED7DC3B` / `DFA407A31DBDAD6424B9664ACBFB1F77999D5D746604A20327CFE0E0EA85D91B`이다.
- 명령 오류 `C21_SEQ584_METADATA_FUNCTION_NAME_R1` 1회: 존재하지 않는 `build_*_metadata` 이름을 호출해 `AttributeError`가 발생했고 실제 공개 함수명으로 바로 교정했다. 제품·계약 실패가 아니다.
- 환경 오류 `C21_SEQ584_SANDBOX_MATERIALIZE_PERMISSION_R1` 1회: managed sandbox가 격리 worktree의 generated file write를 거부했다. 승인된 격리 실행으로 동일 builder를 재실행해 5개 파생 산출물을 정상 생성했다.
- pre-full focused는 seq584 2 tests `OK`, historical exact4 `177 tests in 95.725s / OK`, live checker `PASS sequence=584 reporting=AUTO_CONTINUE`, diff-check와 direct compile 모두 PASS다.
- canonical full tooling 1차는 `587 tests in 1072.914s`, `FAILED (failures=2)`, exit1이다. 기존 seq572 strict projection test가 현재 seq584 bundle을 사용한 1건과, provider WSL candidate status fail-closed test가 현재 seq584 Git collector로 라우팅된 1건으로 분류했다.
- 두 테스트를 각각 seq572 generated artifact view와 `e6c562cf07bc2c35e24addb60efa9d90fae08046` historical bundle에 고정했다. public current bundle에 과거 seq572 manifest를 주입하려던 중간 시도 2회는 generic registry/digest 계약과 맞지 않아 실패했고, 중복된 public assertion을 제거하고 seq572 전용 projection의 원래 검증 목적을 유지했다.
- 두 실패의 targeted 최종 재검증은 `Ran 2 tests in 9.478s / OK`다. 동일 제품 오류 3회가 아니며 Main 인수 범위 안에서 historical temporal fixture만 보완했다. 다음은 파생 산출물 재결박 후 canonical full tooling 2차다.
- canonical full tooling 2차는 `Ran 587 tests in 1126.738s / OK`, exit0으로 완료됐다. 앞선 19개 tooling 실패와 1차 잔여 2개 temporal test가 모두 해소됐다.
- 다음은 이 최종 결과를 포함한 raw report/validation/WORK_STATUS 기준으로 seq584 P/E/H/D/M을 마지막 재결박하고, focused/live/determinism/diff/compile 및 exact16 상태를 확인한 뒤 단일 direct-child record commit을 생성하는 것이다.
- 최종 evidence 재결박 전 검증은 historical exact4 `177 tests in 102.320s / OK`, seq584+잔여 회귀 targeted `4 tests in 12.061s / OK`, live checker sequence584 PASS, deterministic regeneration PASS, diff-check PASS, direct compile PASS다.
- dirty set은 exact16과 일치하며 Windows/ordinal hash는 `4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0` / `E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90`다. 이 문구를 포함해 마지막으로 파생 산출물을 재결박한 뒤 read-only precommit 확인만 수행한다.
## 2026-09-07 C-21 Workbench UI WSL Git-only candidate Developer 시작

- 담당: `developer-primary`; 상태: `IN_PROGRESS_TDD_RED_PREPARATION`.
- 시작 branch/HEAD: `codex/c21-operational-execution` / `468b1408f6e817d20d68c46a79ba44dc82cb4b3d`; 시작 worktree clean.
- 범위: seq585~590의 S exact10 및 K exact12 두 direct-child commit. 기존 seq1~584와 historical evidence는 보존한다.
- 실행 제외: push, WSL, Docker, DB, Provider, Telegram, ysna, main은 `NOT_EXECUTED`.
- 환경 오류 원장: `WORKBENCH_WSL_CANDIDATE_RG_WINDOWS_LAUNCH_R1` 1회. Windows `rg.exe` 연결 오류로 검색이 실행되지 않아 PowerShell `Select-String`으로 전환했다. 제품/계약 실패가 아니다.
- TDD RED: `.venv\Scripts\python.exe -m unittest tests.tooling.test_project_progress.C21WorkbenchUiWslGitOnlyCandidateStartTests` → exit 1, `Ran 2 tests`, missing builder/metadata로 예상대로 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_CANDIDATE_START_MISSING_R1` 1회.
- GREEN 보완 오류: 최초 event append helper가 terminal event 내부의 event_id를 footer보다 먼저 치환해 seq584 raw prefix 보존 테스트 1건이 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_EVENT_FOOTER_REPLACE_R1` 1회. footer tail만 치환하도록 수정했다.
- 환경 오류 원장: S generated5 materialize가 sandbox의 `D:\tmp` 쓰기 제한으로 `PermissionError` 1회 발생했다. fingerprint `WORKBENCH_WSL_CANDIDATE_TMP_WRITE_SANDBOX_R1`; 제품/계약 오류가 아니며 같은 명령을 승인된 unrestricted 실행으로 재개한다.
- S live checker 1차는 `EVENT_EFFECT_MISMATCH` 1건으로 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_START_REMOTE_EFFECT_R1`; terminal `PACKAGE_STARTED`에 source projection의 `dispatch_upstream_head`가 누락된 원인이며 동일 관측값을 추가해 보완한다.

### S exact10 completion

- S commit `f0d4bc7badbdae69c2d2b21089667fdcc636518d`는 parent `468b1408f6e817d20d68c46a79ba44dc82cb4b3d`의 단일 direct child다.
- exact10 Windows/ordinal hash는 `6E8FF216E3984D238E6229C489B97B8CBD3E45E7591D4378ED9EA5C4AFE8DFD5` / `E6B5378AA75AE61785AAAF6E5C07695663EA4F3970010750D9DD4D5EA3492275`, cumulative187은 `287B8617A64EC0A33E3F97E20A03E7CB69B66A9C8A1DBCC777E3A16D2F7F3D88` / `1A35F7995A3AE539395E0EC515B240C276433F5AD7F736C28BE0F63182EDC889`이다.
- postcommit live checker `PASS sequence=587 reporting=AUTO_CONTINUE`, focused `2 tests OK`, deterministic generated5 및 diff-check PASS다.
- K seq588~590 exact12 TDD RED를 시작한다. 외부 실행은 계속 `NOT_EXECUTED`다.
- K TDD RED: tooling/deploy focused 실행은 `Ran 6 tests`, 3 failures/1 error로 예상 실패했다. missing bound builder/metadata, 이전 Candidate manifest status/source, active guard 함수 부재가 원인이다. fingerprint `C21_WORKBENCH_UI_WSL_CANDIDATE_BOUND_MISSING_R1` 1회.
- K GREEN 보완: active guard focused 1건이 Windows Git Bash의 기본 `python3` 부재로 exit20이었다. fingerprint `C21_WORKBENCH_UI_WSL_GUARD_TEST_PYTHON_PATH_R1` 1회; 실제 WSL 계약 실패가 아니며 기존 harness 방식대로 현재 interpreter의 POSIX 경로를 `ANVIL_PYTHON`에 주입한다.
- 환경 오류 원장: S/K/deploy 결합 focused 중 Windows subprocess stderr reader의 CP949 decode가 1회 실패해 guard shell이 exit127로 표시됐다. fingerprint `WORKBENCH_WSL_CANDIDATE_CP949_READER_FLAKE_R1`; 동일 테스트 단독 재실행은 즉시 PASS했다. 제품/guard failure로 승격하지 않고 전체 suite에서 재검증한다.
- 전체 deploy 1차는 같은 Windows `cp949` reader 예외가 7회 반복되어 결과가 오염돼 중단했다. fingerprint `WORKBENCH_WSL_CANDIDATE_CP949_READER_FLAKE_R1` 누적 8회. 정식 제품 실패가 아니며 추가 동일 실행을 중단하고 Developer가 직접 `PYTHONUTF8=1`로 프로세스 기본 text encoding을 고정한 뒤 전체 suite를 새로 실행한다.
- UTF-8 전체 deploy 2차는 신규 active guard가 historical exact107 호출까지 가로채 다수 fail을 즉시 재현해 중단했다. fingerprint `C21_WORKBENCH_GUARD_HISTORICAL_DISPATCH_R1` 1회. 기존 active 함수 객체를 seq590 alias로 보존하고 expected candidate가 exact187일 때만 신규 predicate를 적용하도록 수정한다.
- candidate별 guard dispatcher 보완 후 prior guard 27개 중 26개 PASS, 1개는 historical exact107 manifest assertion이 current mutable file을 읽는 시간결합으로 실패했다. fingerprint `C21_WORKBENCH_DEPLOY_HISTORICAL_MANIFEST_FIXTURE_R1` 1회. seq542/seq554를 포함한 historical manifest 검사는 각 accepted commit blob으로 고정한다.
- historical fixture commit 1차 선택에서 exact107 source에 `a6dca0d` 자체 blob을 사용해 실제 source `a342d62`가 반환됐고, seq542는 exact binding 도입 전 `71d6747`을 골라 2건 실패했다. fingerprint `C21_WORKBENCH_HISTORICAL_FIXTURE_COMMIT_SELECTION_R1` 1회. `git log -- deploy/wsl/CandidateReleaseManifest.json` 실측으로 source fixture=`3501c37`, exact binding fixture=`c330d34`, scope map fixture=`797b4d8`로 정정한다.
- 전체 deploy 3차는 non-elevated UTF-8 환경에서 약 30분간 F/E 없이 진행했으나 장기 중복 fixture 구간의 종료를 확인하지 못하고 진단을 위해 중단했다. fingerprint `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 1회. 프로세스는 응답 중이고 CPU가 계속 증가해 idle/hang 증거는 없었다. 중단 결과를 PASS로 쓰지 않으며 같은 fresh 전체 명령을 충분한 시간 동안 다시 실행한다.
- 전체 deploy 재시도도 non-elevated UTF-8 Git Bash에서 약 30분간 F/E 없이 CPU를 계속 사용했으나 진단 목적으로 중단했다. `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 누적 2회이며 PASS가 아니다. elevated 실행은 WSL bash가 Git Bash 형식 `/d/.../.venv/python.exe` 경로를 찾지 못해 exit127이었다(`WORKBENCH_WSL_DEPLOY_ELEVATED_BASH_PATH_R1` 1회, 환경 오류).
- Git global excludes 경고를 줄이려 `core.excludesfile=NUL`을 적용한 시도는 Git이 NUL을 exclude file로 허용하지 않아 실패했다(`WORKBENCH_WSL_GIT_IGNORE_OVERRIDE_NUL_R1` 1회, 명령/환경 오류). repo-local `.gitignore` 절대경로를 프로세스 한정 override로 사용한다.
- 현재 프로세스 확인 중 `Get-CimInstance Win32_Process`는 managed 권한으로 `Access denied`였다(`WORKBENCH_WSL_PROCESS_ENUM_PERMISSION_R1` 1회, 환경 오류). 이 시점에 이어갈 unified test session은 없으며 dirty set은 K exact12와 일치했다.
- 전체 suite 전 active symbol을 직접 검사해 seq590 구현이 파일 중간에 삽입되고 뒤쪽 seq542 historical public 정의가 다시 덮어쓰는 결함을 재현했다. 신규 public-dispatch test는 active 함수에 `C21_WORKBENCH_CANDIDATE`가 없어 1 failure였고 fingerprint `C21_WORKBENCH_GUARD_FINAL_DEFINITION_ORDER_R1` 1회다. 원인은 정의 순서이며, historical final 함수를 alias로 캡처한 뒤 EOF public dispatcher가 exact187만 신규 predicate로 전달하도록 최소 수정했다. 해당 class `Ran 5 tests / OK`로 GREEN이다.
- 다음: repo-local excludes + UTF-8 non-elevated Git Bash로 full deploy를 종료까지 실행하고, 이후 full tooling·Web·API/agent-team을 순차 검증한다.

### K full deploy 동일 장기 실행 3회 — Developer FAILURE_REPORT

- lineage/fingerprint: `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1`. 이번 fresh full deploy는 2026-09-07 23:14:14에 시작해 2시간 00분 이상 실행됐고, 마지막 확인 PID 56280은 CPU 6716.22초, `Responding=True`, single thread, WorkingSet 약 13.6MB였다. F/E/traceback 출력은 0이었으나 종료하지 않아 PASS가 아니다.
- 진행 위치: unittest dot/fixture 출력 순서상 `WslCandidateManifestGuardTests` 23개 중 앞 22개가 완료됐고, 마지막 기존 `test_seq494_public_coherent_resume_or_work_instruction_rewrite_rejected`의 7-scenario temp clone/file snapshot 구간에서 장기 실행했다. 이 테스트는 각 scenario 전후 `repo.rglob("*")`로 `.git` traversal까지 수행한 뒤 파일 선택 단계에서만 `.git`을 제외한다. 신규 seq590 class 실행 전의 기존 harness 병목이다.
- 동일 조건은 앞선 diagnostic 중단 2회에 이어 이번 재개에서 3회째 확인됐다. 프로젝트 규칙에 따라 Developer는 추가 full deploy 재시도와 테스트 성능 수정을 중단하고 Main에게 인계한다. 이번 중단은 exit1이며 PASS로 기록하지 않는다.
- 별도 확인 오류: 테스트 정의 순서 확인용 one-line Python 명령은 quoting 오류로 `SyntaxError` 1회(`WORKBENCH_WSL_TEST_ORDER_COMMAND_QUOTING_R1`), `wmic`은 명령 부재 1회, `tasklist /v`는 Access denied 1회(`WORKBENCH_WSL_PROCESS_COMMANDLINE_DIAGNOSTIC_R1`)였다. 제품 오류가 아니며 더 이상 권한 우회를 시도하지 않았다.
- 완료된 조치: seq590 public guard가 뒤쪽 historical 함수 정의에 덮어써지던 결함은 dedicated RED로 재현하고 EOF dispatcher로 수정했다. `WslWorkbenchUiGitOnlyCandidateContractTests`는 `Ran 5 tests / OK`; dirty 경로는 K exact12와 일치한다.
- 미완료/미검증: full deploy 종료 결과, full tooling, Web 19, API/agent-team 193, 최종 K materialize/determinism/live checker/exact hash, K commit/postcommit은 미완료다. push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 `NOT_EXECUTED`다.
- Main 인수 권장안: 기존 test의 non-Git snapshot 의미를 유지하면서 `.git` 디렉터리를 traversal 전에 prune하는 fixture helper로 병목을 제거하고 해당 단일 test를 먼저 시간 측정한 뒤 full deploy를 fresh 실행한다. 변경 범위를 테스트 harness에 한정하고 deploy runtime script는 수정하지 않는다.
- rollback: K dirty exact12 전체를 S commit `f0d4bc7badbdae69c2d2b21089667fdcc636518d`로 되돌리면 된다. S commit 자체는 clean 검증과 seq587 checker PASS를 이미 확보했다.

### K Main takeover — deploy harness 병목 및 실행환경 분리

- 동일 lineage `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 3회 후 Main이 test-only lease를 인수했다. 제품·deploy runtime·historical evidence는 수정하지 않았다.
- 기존 seq494 snapshot comprehension이 `.git`을 파일 선택 단계에서만 제외하여 Git object tree 전체를 순회하던 문제를 `os.walk()`의 directory prune으로 수정했다. 해당 7-scenario 단일 테스트는 기존 2시간 초과 미종료에서 `103.383s / OK`로 단축됐다.
- fixture clone은 source object 복제를 피하는 `git clone --shared`로 제한했고, source HEAD/status가 clone commit 후에도 불변임을 확인하는 격리 회귀 테스트를 추가했다. seq494+격리 targeted는 `2 tests in 64.109s / OK`다.
- cleanup entrypoint fixture도 immutable Git object만 읽고 worktree에서는 `deploy/wsl`만 사용하므로 sparse checkout을 적용했다. 제품 저장소·source object·runtime script는 변경하지 않는다.
- Main verbose full deploy 비상승 실행은 `tempfile.mkdtemp(dir="D:/tmp")`에서 샌드박스 write가 허용되지 않은 채 CPU를 소비하는 환경 대기로 확인됐다. `faulthandler` stack이 `tempfile.py:385 mkdtemp`를 직접 지목했다. fingerprint `WORKBENCH_WSL_TMP_SANDBOX_MKDTEMP_R1` 1회이며 제품/테스트 assertion 실패가 아니다.
- 상승 실행의 기본 PATH는 WSL `bash`를 선택해 Git Bash 경로 `/d/...`를 찾지 못했다. fingerprint `WORKBENCH_WSL_ELEVATED_BASH_SELECTION_R1` 1회. 프로세스 PATH 앞에 `C:\\Program Files\\Git\\usr\\bin`을 고정하여 Git Bash와 D: mount를 명시한다.
- 위 환경 고정 뒤 cleanup duplicate-source 단일 테스트는 `1.865s`에 실행됐으나 dirty precommit fixture가 아직 존재하지 않는 seq590 control commit을 요구해 첫 binding에서 `cleanup-guard control must be a single direct child`로 거부됐다. 이는 commit 전 current HEAD만 clone하는 기존 fixture의 lifecycle 조건이며, exact12 commit 후 full deploy에서 재검증한다. historical expectation이나 guard를 완화하지 않는다.
- K focused tooling+guard는 `7 tests in 1.118s / OK`다. raw `WORK_STATUS`와 test harness 변경 뒤 live checker는 예상대로 `PRG_REFERENCED_HASH_MISMATCH`를 검출했으며, final raw 입력을 반영해 P/E/H/D/M을 deterministic 재materialize한 뒤 다시 실행한다.
- 외부 실행, push, WSL, Docker, DB, Provider, Telegram, ysna, main은 계속 `NOT_EXECUTED`다.

### K final precommit 검증

- final raw 입력 재결박 후 seq590 focused tooling+guard는 `7 tests in 1.105s / OK`, live checker는 `PASS sequence=590 reporting=AUTO_CONTINUE`, deterministic generated5 비교·`git diff --check`·direct Python compile·`bash -n`은 모두 PASS다.
- 제품 회귀는 정확한 표준 명령으로 Web `19/19 PASS`와 API+agent_team `193 passed in 6.53s`를 확인했다. API unittest discovery 0건은 해당 pytest suite의 검증으로 사용하지 않고 환경/명령 선택 기록으로만 남긴다.
- canonical 전체 tooling은 Git Bash PATH·UTF-8·D:\\tmp fixture 권한을 고정한 fresh 실행에서 `591 tests in 995.010s / OK`, exit0으로 완료됐다. 실행 중 제품/문서 mutation은 없었다.
- dirty set은 계약 exact12이며 Windows/ordinal hash `D85669CA2C20EA8481C165F736FD28F017E7291BAFBB3916684A9DF5975EF714` / `4A8A0CED250CE4E9010589C68416BC4C25346F6D2DA46F44034CE92336C6D901`, cumulative189 hash `8A54D4594B30E4CACFD8AB8C54C187CB528735E39305E1503737932023BD786F` / `13D263C508363A6D24622CC015545B965D96F67025EA75B1F1C9C43C5EDBF31A`와 일치했다.
- 이 raw 결과를 마지막으로 P/E/H/D/M에 재결박한 뒤 focused/live/determinism/diff/compile/hash를 read-only로 재확인하고 S commit의 단일 direct-child exact12 commit을 생성한다. commit-bound full deploy는 그 다음 fresh 실행한다.

### K independent review REWORK 및 Main 보완

- 최초 K commit `b9ff3ff118ecce4c744f2803083e45f5aea7ce4e`에 대한 독립 Reviewer 판정은 `REWORK`, Critical 0 / Important 1 / Minor 1이다.
- Important 원인은 새 candidate `f0d4bc7...`가 source/rollback에는 결박됐지만 `runtime_binding.allowed_lifecycle_tuples`와 active `validate_c21_exact_runtime_state`에는 없었던 것이다. 정상 배포 상태 `f0d4bc7:f0d4bc7:324eb169`가 exit23으로 거부되어 verify와 rollback을 막는 실제 계약 결함이다.
- TDD RED는 manifest rollback allowlist 누락과 정상 배포 tuple 거부를 각각 재현해 `2 failures`였다. test helper의 `_posix` 호출 대상 오류 1회는 즉시 교정한 test-author 오류이며 제품 실패 횟수에 포함하지 않는다.
- GREEN은 manifest의 정확한 신규 배포 후/rollback 후 tuple 2개와 rollback allowlist를 추가하고, 새 manifest contract가 runtime binding 전체를 strict equality로 검증하도록 보완했다. active runtime validator도 동일 두 tuple만 추가했다. focused class는 `6 tests in 1.193s / OK`이며 runtime tuple 삭제 변조도 exit20으로 fail-closed다.
- commit-bound full deploy의 기존 cleanup entrypoint 4건은 현재 seq590 manifest와 과거 exact107 candidate를 혼합하는 historical temporal fixture 때문에 같은 binding 실패를 냈다. 테스트 최초 확정 commit `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`를 control/manifest view로 고정하되 현재 cleanup/common/guard를 계속 실행하도록 수정했고, 관련 4건은 `28.733s / OK`다. historical artifact bytes는 변경하지 않았다.
- Reviewer Minor는 S WorkInstruction의 EOF 빈 줄 1건이다. 이미 검증된 immutable S commit과 계보를 재작성하지 않으며 기능·runtime 영향 없는 기존 diff 경고로 보존한다.
- K는 아직 private push 전이므로 위 exact12 내부 보완과 재결박을 같은 single direct-child commit으로 amend한 뒤 full tooling/deploy와 재검토를 다시 수행한다.

### K commit-bound 재검증

- Reviewer 보완을 포함한 K `ab2483a1f07d90d2763d9038e73a57b176dadd64`는 S `f0d4bc7...`의 단일 direct child, clean exact12이며 postcommit checker sequence590 PASS다.
- commit-bound 전체 deploy harness는 `119 tests in 575.846s / OK (skipped=9)`, exit0이다. SKIP9는 기존 Windows/Git Bash 환경 조건이며 실제 WSL runtime PASS로 승격하지 않는다.
- 보완 후 canonical 전체 tooling 1차는 `591 tests in 969.091s`, error1, exit1이다. 유일 오류는 과거 `test_c21_provider_wsl_exact_binding_completion_is_forward_only`가 현재 seq590 Candidate manifest를 과거 seq542 builder 입력으로 사용해 `C21_EXACT_BINDING_BOUND_CANDIDATE_INVALID`를 낸 temporal fixture다. 제품/runtime/checker 오류로 분류하지 않는다.
- 위 과거 테스트의 raw 입력만 당시 accepted commit `c330d34ea7d0acc7e423a978f9c558c94c159118` Git blob으로 고정했다. historical evidence와 checker는 변경하지 않았고 targeted 재검증은 `1 test in 0.750s / OK`다.
- 이 결과와 exact12 변경을 다시 재결박·amend한 뒤 full tooling을 fresh 재실행하고 독립 Reviewer 재검토를 받는다.

### K final full tooling PASS

- 최종 K `61eff066fcc0693884bf1816eeed14687908f2c9`에서 historical fixture 보완 후 canonical 전체 tooling을 fresh 재실행했다. 결과는 `591 tests in 964.449s / OK`, exit0이며 failure/error/traceback은 0이다.
- 이 PASS를 raw 상태에 마지막으로 기록하고 seq590 P/E/H/D/M을 재결박한 뒤 K를 동일 exact12 single direct-child로 최종 amend한다. 이후 focused/live/determinism/path/hash와 독립 Reviewer만 재확인하며 전체 suite 결과를 과장하지 않는다.

### K independent review 2차 REWORK 및 manifest fail-closed 보완

- 최종 K `744d032256a911ef600686d13dc7a47817156f11` 2차 검토는 runtime tuple 해소를 확인했으나 `REWORK`, Critical 0 / Important 1 / Minor 1이었다.
- Important는 seq590 전용 manifest contract가 `authority.approval_artifact_sha256`, `cleanup.required_labels`, 미승인 최상위 key 변조를 허용한 것이다. TDD RED에서 해당 변조가 rc0으로 통과해 1 failure로 재현됐다.
- seq590 manifest의 최상위 exact key set, authority 전체 canonical SHA-256 `985BF0E357291D002C5081040684667524DDBC1F1DF83EAF01880874A58E03AF`, environment와 cleanup exact object를 전용 contract에 추가했다. runtime/rollback/source/verification/wsl observation의 기존 exact 비교도 유지한다.
- 구현 중 `hashlib` import가 같은 파일의 과거 heredoc에 적용된 위치 오류 1회가 있었고 신규 heredoc으로 즉시 교정했다. historical 함수의 원문 import는 복원했으며 제품 실패가 아니다.
- 보완 focused class는 `6 tests in 1.754s / OK`; authority·cleanup·unknown key·runtime tuple·Telegram evidence 변조를 모두 rc20으로 거부하고 정상 manifest 및 신규 배포/rollback tuple은 통과한다.
- 이 보완은 기존 exact12 경로 안이며 private push 전이다. 재결박·amend 후 전체 deploy/tooling과 독립 검토를 다시 수행한다.

### K manifest fail-closed 최종 full suites

- seq590 manifest fail-closed 보완을 포함한 K `d08ed2585b6c66cb9792f8b52ea6d65b5a8f217e`에서 두 canonical suite를 fresh 병렬 실행했다.
- 전체 deploy harness: `119 tests in 733.993s / OK (skipped=9)`, exit0. 기존 환경 SKIP9 외 failure/error 0이다.
- 전체 tooling: `591 tests in 1214.862s / OK`, exit0. failure/error/traceback 0이다.
- 병렬 실행으로 각 wall time은 직전 순차 실행보다 늘었지만 결과 계약은 모두 PASS다. 이 결과를 마지막 raw 상태에 기록하고 generated5를 재결박한 뒤 exact12 amend·focused/live/determinism·독립 Reviewer를 수행한다.

### WSL exact187 실행 재개 — 접속 경로 확인

- private refs 게시와 재조회 완료 기준은 control `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`다. Provider·Telegram 실제 호출은 제외하고 migration·API·authenticated SSE·Last-Event-ID·same-origin·backup/restore·rollback·승인된 exact cleanup만 수행한다.
- Windows `ssh SINSAN` 시도는 `banner exchange: Connection to UNKNOWN port -1: Connection refused`로 실패했다. fingerprint `C21_WSL_SINSAN_TRANSPORT_SELECTION_R1` 1회. 제품·WSL 장애가 아니라 현재 실행 환경에서 SSH 별칭이 offline 대체값으로 해석된 전송 경로 오류다.
- `wsl.exe --list --verbose`와 `wsl.exe -d Ubuntu -- bash -lc`의 읽기 전용 확인 결과 Ubuntu 배포판이 실행 중이고 내부 hostname은 `SINSAN`, 사용자 `daon`, `/srv/anvil-wsl` 및 `/srv/anvil-wsl/repo`가 존재한다. 이후 표준 WSL 실행은 이 경로로 한정한다.
- 다음: SINSAN 내부 Git·`.env` 존재/hash/mode·application/control/runtime marker·Docker residue를 읽기 전용으로 확인하고, manifest/action checksum을 고정한 control-runtime 순서로 진행한다.
- 첫 preflight 출력의 runtime 경로를 `/runtime/anvil-wsl-pg*`로 잘못 조회하여 marker가 `ABSENT`처럼 표시됐고, image label 출력용 Go-template 인용도 2회 실패했다. fingerprint `C21_WSL_PREFLIGHT_COMMAND_QUOTING_R1` 3회. 이는 읽기 전용 진단 명령 작성 오류이며 제품/runtime 상태가 아니다. 추가 동적 shell 변수를 중단하고 literal 경로로 Main이 직접 확인했다.
- 실제 runtime marker는 PG15/PG18RC 모두 current=`324eb169fedbce958d2e8cc29362deb7af433677`, previous=`324eb169fedbce958d2e8cc29362deb7af433677`; active control=`b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`; rollback tag `anvil-wsl-web:324eb169...`는 존재한다. application HEAD=`a6dca0d...`, clean detached, private origin exact, 격리 container/network/volume은 0이다.
- private fetch는 지정 deploy key로 exit0이며 control ref=`8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate ref=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`, K parent=S를 재확인했다. immutable manifest SHA-256=`a1bb21983ef5791c5025e8487675801cb824b2066f5c9d9f8dcf092ec1d6d82b`, control-runtime SHA-256=`d0ff497b22851dfc6cb3fa36c761d8bb69ded1cb7a838e81ef55c4a459570097`다.
- `.env` mode=600, SHA-256=`fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`. 필수 7개 변수 이름이 각각 존재하고 값 byte 길이가 49/65/18/16/17/12/53으로 비어 있지 않음을 값 노출 없이 확인했다. 최초 `grep -E '=.+` count 출력은 shell 인용 영향으로 무효였으며 literal `sed` 길이 검사로 교정했다.
- 다음: exact checksum을 환경으로 전달하여 표준 `control-runtime.sh deploy S`를 실행한다. 실패하면 side effect와 상태를 즉시 수집하고 같은 근본 원인 횟수를 누적한다.
- 표준 deploy 실행은 exit0이다. control stage는 K `8fe7b97...`로 게시됐고 application checkout은 S `f0d4bc7...` clean detached로 전환됐다. PG15와 PG18RC에서 DB pull/start/healthy, pre-migration backup+restore-list, candidate image build, Alembic upgrade, web recreate, pinned nginx config test와 ingress start가 모두 완료됐다.
- Docker Compose의 buildx plugin 경고와 migration one-off container의 Tini subreaper 경고가 있었으나 action exit0이며 해당 단계 실패는 없었다. 이는 기능 실패로 승격하지 않고 잔여 운영 개선사항으로 보존한다.
- 다음: immutable verify checksum으로 표준 verify를 실행하여 두 target의 migration head, authenticated SSE, Last-Event-ID, same-origin, backup/restore를 검증한다. Provider·Telegram은 스크립트 계약대로 `NOT_EXECUTED`다.
- 표준 verify는 exit0이다. PG15/PG18RC 모두 canonical test task/run/event 입력, `/auth/session`, authenticated SSE 1건, acknowledged Last-Event-ID 무재생, same-origin ingress, migration head `0013_task_bootstrap_authority`, round-trip dump/restore 및 scratch DB 정리를 완료했다. Provider·Telegram 호출은 수행하지 않았다.
- 다음: rollback checksum과 commit별 test-session scope map을 사용해 두 target을 승인된 previous `324eb169...`로 rollback하고, marker·image·health·migration을 독립 관찰한다.
- 표준 rollback은 exit0이며 두 target 모두 process-local exact3 test-session scope로 web/ingress를 재생성했다. 서버 `.env`는 수정하지 않았다.
- 독립 관찰 결과 PG15/PG18RC의 current/previous marker와 실제 실행 web image revision은 모두 `324eb169...`; 두 `/health/ready`는 `status=ready`, DB `alembic_version`은 `0013_task_bootstrap_authority`다. rollback 중 DB downgrade는 수행하지 않는 계약과 일치한다.
- 다음: S를 재배포하고 동일 표준 verify를 다시 실행한 뒤, 영수증과 `.env` 불변을 확인하고 exact cleanup을 수행한다.
- S 재배포 1차는 PG15 DB가 healthy로 판정되고 image build까지 완료된 뒤 `wsl_compose run --rm anvil-web /opt/venv/bin/alembic upgrade head`에서 `psycopg.errors.ConnectionTimeout`으로 exit1 실패했다. fingerprint `C21_WSL_REDEPLOY_AFTER_ROLLBACK_DB_CONNECT_TIMEOUT_R1` 1회. 첫 deploy·verify·rollback은 성공했으며 이 실패를 전체 WSL 검증 PASS로 기록하지 않는다.
- 실패 시점에는 두 번째 deploy가 PG15 migration 전에서 중단되어 PG18RC에는 이번 재배포 mutation이 시작되지 않았다. Main은 즉시 반복 실행하지 않고 Subagent 읽기 전용 코드 분석과 Main의 runtime marker/container/network/DB log·connectivity 관찰로 원인을 분리한다.
- 다음: side effect 상태와 네트워크 연결성을 보존 조사하고, 표준 runtime을 바꾸지 않는 최소 복구 후 fresh 재배포한다. 동일 근본 원인 3회면 Main 직접 takeover 규칙을 적용한다.
- 조사에서 PG15 DB는 healthy, `pg_isready` local PASS, 기존 rollback web의 DNS `anvil-db=172.21.0.2` 및 실제 SQL `select 1` PASS, DB log에도 crash/restart가 없었다. 반면 동일 S image의 새 Compose one-off는 DNS lookup PASS 후 `pg_isready -h anvil-db -t 5`가 `no response`로 실패했고 Alembic current도 같은 timeout이었다.
- 같은 경계는 재배포 Alembic, one-off Alembic current, one-off TCP readiness에서 3회 확인됐다. `C21_WSL_REDEPLOY_AFTER_ROLLBACK_DB_CONNECT_TIMEOUT_R1` 누적 3회. Main이 직접 인수하며 Subagent는 rollback이 DB/network를 재생성하지 않고 scope override도 DSN과 무관함을 확인했다.
- 최소 복구는 PG15 DB volume과 데이터는 보존하고 정확한 `anvil-db` 컨테이너 endpoint만 Compose force-recreate+healthy로 갱신한 뒤 candidate one-off TCP probe를 재실행하는 것이다. 성공 후 표준 deploy 전체를 fresh 실행한다. 광범위 network/volume 삭제는 하지 않는다.
- PG15 `anvil-db`만 force-recreate+healthy한 뒤에도 candidate one-off `pg_isready`는 DNS resolve 후 `no response`였다. 기존 rollback web은 새 DB endpoint에 즉시 연결되어 DB·alias·password가 정상임을 재확인했다. 따라서 단일 DB endpoint가 아니라 현재 PG15 project bridge의 신규 endpoint forwarding 상태가 원인이다.
- Main 복구 2단계는 승인된 exact PG15 test project의 서비스 3개와 network 2개만 제거·재생성하되 `anvil-wsl-pg15_anvil-db-data` volume과 `/srv/anvil-wsl/.env`, backup/evidence는 보존하는 것이다. 제거 전 network endpoint가 해당 project 서비스 3개뿐임을 확인했다.
- exact PG15 서비스3/network2 제거는 exit0이고 DB volume 존재 및 `.env` mode600을 즉시 재확인했다. 이후 표준 deploy fresh 실행은 PG15 신규 bridge에서 migration one-off 연결을 포함해 통과했고 PG18RC까지 완료되어 전체 exit0이다.
- 판정: 장애 원인은 rollback 후 유지된 PG15 Docker bridge에서 기존 endpoint 간 통신은 되지만 신규 Compose run endpoint의 TCP forwarding이 막힌 런타임 network residue였다. 제품 코드·DB 내용·Secret 변경 없이 exact test network 재생성으로 복구됐다.
- 다음: 표준 verify를 재실행해 최종 candidate 상태를 다시 검증하고, evidence·marker·`.env` hash를 독립 확인한 뒤 exact cleanup한다.
- 복구 후 표준 verify 재실행도 exit0이다. 두 target의 기존 test identifiers는 `ON CONFLICT`로 0건 추가됐고 authenticated SSE/Last-Event-ID/same-origin/backup-restore 결과는 동일하게 PASS다.
- 최종 application은 S clean detached, 두 current marker=S, 두 previous marker=`324eb169...`; `.env` mode600 및 SHA-256 `fecae53b...a79a`로 작업 전과 byte-identical이다. backup·verify·rollback receipt 6개를 literal 경로로 읽고 checksum을 확보했으며 모든 `secret_values=omitted`다. 첫 evidence loop 출력은 shell 변수 인용 오류로 빈 파일명/empty hash가 출력되어 무효 처리했고 literal 경로 확인으로 교정했다(`C21_WSL_PREFLIGHT_COMMAND_QUOTING_R1` 누적4회; 제품 실패 아님).
- 실제 in-app browser에서 PG15 `127.0.0.1:4770/`와 PG18RC `127.0.0.1:4870/` 모두 title `Anvil Provider Workbench`, 9개 Provider/Provider Registry/Run Event UI가 렌더링됨을 확인했다. 브라우저에 test token을 주입하지 않아 Provider 목록은 예상대로 `PERMISSION DENIED`, SSE는 `NOT CONNECTED`; 이를 authenticated browser PASS로 과장하지 않는다. 인증 SSE는 표준 same-origin HTTP verify로 별도 PASS다.
- 다음: 표준 cleanup guard로 승인된 두 Compose project의 서비스·네트워크와 exact volume 2개만 제거하고 residue0, scratch DB0, `.env`/evidence/backup 보존을 확인한다.
- 표준 cleanup은 exit0이다. 독립 사후 관찰에서 PG15/PG18RC Compose container=`0/0`, exact network=`0/0`, exact named volume 합계=`0`이다. restore scratch DB는 verify 단계에서 각각 drop됐고 DB 컨테이너·volume 자체도 승인된 cleanup으로 제거됐다.
- `/srv/anvil-wsl/.env`는 mode600 및 SHA-256 `fecae53b...a79a`로 불변, evidence 6종과 candidate별 backup 디렉터리는 보존됐다. application repo는 S clean detached, runtime control ref=K, candidate ref=S다.
- 현재 live checker의 `C21_WORKBENCH_UI_WSL_BOUND_PROJECTION_INVALID`, `GIT_PRIVATE_AUTHORITY_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH`는 seq590이 pre-CAS Git-only 상태를 결박한 뒤 실제 CAS·WSL 결과와 raw WORK_STATUS가 추가된 예상 projection drift다. seq590/historical evidence를 수정하지 않고 새 successor event/projection으로 해소한다.
- 다음: 실제 runtime 결과와 네트워크 복구 이력, 제한사항을 새 append-only successor package에 결박하고 focused/full tooling·checker·독립 Reviewer·commit·private CAS push를 수행한다.

### C-21 Workbench UI WSL runtime result successor — seq591~596

- 담당: `developer-primary`; 시작 branch/HEAD: `codex/c21-operational-execution` / `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`.
- 기존 seq1~590과 historical evidence는 byte 불변으로 보존하고, 실제 WSL 실행 결과를 신규 exact12 / cumulative exact195 successor에만 기록한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k runtime_result` → `2 failed, 1 passed, 224 deselected`, exit1. 신규 builder와 metadata 함수 부재가 의도한 실패 원인이다. fingerprint `C21_WORKBENCH_UI_WSL_RUNTIME_RESULT_UNBOUND_R1` 1회.
- exact12 hash는 Windows `D1965266EBE7DDC3D4D6B0D01A2E71EA276DDFF378B0793E5895E2FB8F07F348`, ordinal `B345B0586EC4A8937238324EAC5F6FC9046C848F9B171B5E6CB6B83DDA9A6346`; cumulative exact195 hash는 Windows `5F63907A3D63D0350B68EC277B9703EB6AB9D0631E583427BADC2D53A1A13F00`, ordinal `CAD44AA61C8F359D0AD5FE19DABD70C4F7BE2106FC9EC4C59BD3E2EBFF89C516`다.
- 첫 GREEN 시도는 신규 Git collector의 괄호 1개 누락으로 compile SyntaxError를 냈다. fingerprint `SEQ596_CHECKER_COLLECTOR_SYNTAX_R1` 1회. 즉시 최소 수정했고 focused `3 passed, 224 deselected`, exit0으로 해소했다. 기본 `py_compile`은 기존 접근 불가 `scripts/__pycache__` 때문에 code compile과 무관한 permission error가 발생하여, 최종 검증은 허용된 별도 pycache 경로로 재실행한다.
- generated progress/event/HANDOFF/detached digest/manifest 5개를 materialize한 뒤 live checker는 `PASS sequence=596 reporting=AUTO_CONTINUE`, focused seq590+596 영향 범위는 `3 passed, 224 deselected`다. builder 2회 byte equality와 historical seq1~590 raw prefix equality도 PASS했다.
- receipt overwrite 경계를 명시했다. pre-migration backup과 verification receipt hash는 final deploy/final verify의 현재 상태만 증명하며, 첫 verify의 독립 file evidence로 주장하지 않는다. rollback receipt는 보존 상태로 별도 결박한다.
- 전체 tooling: `592 passed, 1 failed in 716.23s`, exit1. 실패는 historical `A13RepositoryScanArtifactTests::test_checker_validates_reusable_contract_and_eight_fixtures`의 `PUBLIC_RESULT_SCHEMA_MISMATCH`다. fingerprint `HISTORICAL_A13_MODULE_CACHE_SCHEMA_R1` 1회.
- 위 테스트는 단독 실행하면 `1 passed in 12.84s`, A13 파일 전체에서는 `62 passed, 1 failed in 48.04s`로 재현됐다. historical checker가 같은 process에서 먼저 import된 current `packages.repository_intelligence.ScanResult` module cache를 재사용하여 accepted A-13 schema 대신 현재 확장 schema를 읽는 기존 순서 의존 fixture 문제다. seq596 exact12와 무관하고 exact12 밖 historical test는 변경 금지이므로 수정하지 않는다.
- 미검증 경계: 동일 process 전체 tooling의 clean PASS는 위 기존 historical fixture 실패 때문에 확보하지 못했다. seq596 focused/live/determinism/raw history/exact Git 검증은 별도로 완료하고, 전체 suite를 PASS로 과장하지 않는다.
- 최종 precommit 검증: seq590+596 focused `3 passed, 224 deselected`; live checker `PASS sequence=596 reporting=AUTO_CONTINUE`; in-memory compile, deterministic builder, seq1~590 raw prefix, strict manifest, `git diff --check` 모두 PASS다. Git collector는 K+dirty exact12와 validated base cumulative exact195, private control K/candidate S를 PASS했다.
- 최초 postcommit `git diff --check HEAD^ HEAD`에서 신규 validation/WI/prompt 3개 EOF 여백을 발견했다. fingerprint `SEQ596_NEW_DOC_EOF_BLANK_R1` 1회. 신규 exact12 내부 비의미 포맷 오류이므로 제거하고 generated hashes를 재결박한 뒤 동일 direct-child commit을 amend한다.

### C-21 A13 historical module isolation successor — seq597~602

- 담당: `developer-primary`; 인수 branch/HEAD: `codex/c21-operational-execution` / `6e06810ea02b72e5642da8258cd0ae5fb6d87dc6` (clean).
- 범위: seq1~596, historical evidence, 제품 코드는 불변으로 보존하고 `tests/tooling/test_a13_repository_scan.py`의 historical import만 context-managed isolation한다. `packages`와 `packages.repository_intelligence*` module cache 및 `sys.path`를 성공·예외 모두에서 정확히 복원한다.
- 계획 경계: 신규 exact13, cumulative exact201, seq597~602 lifecycle. Provider·Telegram·WSL·ysna·main·push는 수행하지 않는다.
- 다음: 순서 의존 2-node 재현 테스트와 예외 복원 negative 테스트를 먼저 추가하고 RED를 확인한다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider -k "historical_checker_isolates_package_modules_across_two_nodes or historical_checker_restores_modules_and_path_after_exception"` → `2 failed, 63 deselected`, exit1. 두 테스트 모두 기존 `_historical_checker`가 tuple을 반환하여 context manager protocol을 제공하지 않는 예상 이유로 실패했다. fingerprint `A13_HISTORICAL_IMPORT_ISOLATION_MISSING_R1` 1회.
- 다음: helper를 context manager로 전환하고 historical root를 `sys.path` 최우선에 잠시 설정하며, `packages`/`packages.repository_intelligence*`와 checker module을 `finally`에서 정확히 복원한다.
- GREEN focused: 위 helper를 context manager로 전환하고 6개 historical caller를 context 범위로 제한했다. RED와 동일 명령은 `2 passed, 63 deselected in 24.78s`, exit0이다. 성공 노드 2개 사이와 강제 예외 후 모두 original module identity 및 `sys.path` exact list가 복원됨을 확인했다.
- 다음: A13 파일 전체를 단일 process에서 실행해 기존 `PUBLIC_RESULT_SCHEMA_MISMATCH` 순서 의존성 해소와 회귀를 확인한다.
- A13 전체 GREEN: `.venv\Scripts\python.exe -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider` → `65 passed in 72.01s`, exit0. 기존 전체 실행의 `PUBLIC_RESULT_SCHEMA_MISMATCH`가 재발하지 않았다.
- seq602 projection TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq602` → `2 failed, 227 deselected`, exit1. 신규 builder/metadata가 없는 예상 이유로 실패했다. fingerprint `C21_A13_MODULE_ISOLATION_PROJECTION_UNBOUND_R1` 1회.
- 다음: seq596을 parent로 하는 seq597~602 append-only builder, strict manifest/projection/Git predicate를 추가하고 exact13/cumulative201을 결박한다.
- seq602 focused GREEN: builder, metadata, strict manifest/projection validator, seq602 우선 Git predicate와 manifest routing을 구현했다. `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq602` → `2 passed, 227 deselected in 2.21s`, exit0.
- 터미널 상태는 seq596과 동일하게 `READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`, next action은 `INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`이며 acceptance/C-01/DIR-2 차단을 그대로 유지한다.
- 다음: 신규 generated5를 materialize하고 live checker와 byte determinism을 확인한다.
- generated5 최초 materialize는 sandbox가 `D:\tmp` exec write를 거부하여 `PermissionError` exit1이었다. fingerprint `SEQ602_GENERATED_WRITE_SANDBOX_DENIED_R1` 1회. 플랫폼 실행 권한을 정식 요청해 동일 builder를 성공적으로 실행했다.
- 첫 live checker는 `EVENT_EFFECT_MISMATCH`, `GIT_PRIVATE_AUTHORITY_MISMATCH` exit1이었다. fingerprint `SEQ602_EVENT_REMOTE_AND_PRIVATE_CONTROL_BINDING_R1` 1회. seq602 completion event에 seq596의 public upstream projection을 유지하는 `completion_upstream_head`가 없었고, private control ref는 push 금지 경계에서 실제로는 seq590 control `8fe7b97...`을 유지하고 있었다. 실제 권위를 manifest/collector에 정확히 결박해 교정했다.
- 교정 후 generated5 materialize 및 live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`, exit0이다.
- exact13 hash는 Windows `3363F8F3DB4BE55C2D4CC12FCDD60D8EDEEDA46C7385CE87A92FAD6B72FF820A`, ordinal `7EBDAF635BD89CFBFB9B183003613CE433A9929405AF74005DDDF85A5CB0DF42`; cumulative exact201 hash는 Windows `DF0884A6F6AA73738488487E4A8C5181A6022FA4443DDCF1E28B69FA6EA3882D`, ordinal `FF0B9643404E4EA080313E43AD52BC3D356A82710415162B437C2914FFBA8312`다.
- 다음: 정적 metadata hash를 고정한 generated5를 재생성한 뒤 focused/A13 회귀와 전체 tooling을 실행한다.
- metadata hash 고정 후 focused seq596+602는 `4 passed, 225 deselected in 1.68s`, A13 전체는 `65 passed in 88.50s`, live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`로 모두 exit0이다.
- 다음: generated5를 최신 WORK_STATUS hash로 재생성하고 `tests/tooling` 전체를 단일 process에서 실행해 전체 통과를 확인한다.
- 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `597 passed in 1247.18s`, exit0. 기존 기대 595는 seq602 projection 테스트 2개를 전체 수에 포함하지 않은 계산 오류였고, 실제 collection 결과 597로 evidence/contract를 정정했다. fingerprint `SEQ602_TOOLING_EXPECTED_COUNT_CORRECTION_R1` 1회.
- 장시간 테스트 상태 확인 중 `Get-CimInstance Win32_Process`는 OS access denied로 실패했다. fingerprint `SEQ602_PROCESS_COMMANDLINE_DIAGNOSTIC_DENIED_R1` 1회(제품/테스트 실패 아님). `Get-Process`로 worker/launcher의 `Responding=True`와 CPU 증가를 확인했다.
- 다음: 597 evidence 정정 후 generated5를 재생성하고 focused/live/determinism/history/Git 최종 검증을 수행한다.
- 597 evidence 정정 후 seq596+602 focused는 `4 passed, 225 deselected in 1.76s`, live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`, 모두 exit0이다.
- generated5 2회 byte equality, materialized generated5 equality, seq1~596 raw event object prefix, strict manifest, raw checksum row 12개, exact13/cumulative201 metadata, `git diff --check`는 모두 PASS했다.
- precommit status는 선언된 exact13만 dirty/untracked이며 제품 코드·historical evidence 변경은 0건이다. 다음: WORK_STATUS 최종 hash를 generated5에 재결박하고 quick final verification 후 단일 commit한다.
## 2026-09-08 C-21 A13 historical module isolation CAS publication — seq603~608

- 담당 agent: `developer-primary`; 시작 branch/HEAD: `codex/c21-operational-execution` / `6134e4140d2017536563babc907c631853509ae5`; 시작 worktree clean.
- 실제 private authority read-only 확인: `development=git@github-sinsan-develop:sinsan-develop/Anvil.git`, control `6134e4140d2017536563babc907c631853509ae5`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq603~608 append-only publication projection, exact12/cumulative207, previous control `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`에서 published control `6134e4140d2017536563babc907c631853509ae5`로의 CAS PASS 기록. seq1~602, historical evidence, `tests/tooling/test_a13_repository_scan.py`, 제품 코드는 불변이다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests\\tooling\\test_project_progress.py -q -p no:cacheprovider -k seq608` → `2 failed, 229 deselected`, exit1. 신규 builder/metadata 부재의 예상 실패이며 fingerprint `C21_A13_CAS_PUBLICATION_PROJECTION_UNBOUND_R1` 1회다.
- 외부 push, WSL, ysna, main, Provider, Telegram은 이번 writer 범위에서 `NOT_EXECUTED`다.
- 동일 시스템 안전 검사 거절이 3회 발생했다. fingerprint `SEQ608_CAS_RECEIPT_SAFETY_REJECTION_R1`, 누적 3회. subagent가 Main 메시지로 전달된 실제 tool receipt를 독립 tool receipt로 인정하지 못해 CAS PASS 영구 기록을 거부한 것이며 제품·Git 실행 실패가 아니다.
- 3회 규칙에 따라 `developer-primary` write lease를 회수하고 Main Agent가 인수했다. 인수 시 dirty 경로는 `docs/WORK_STATUS.md`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py` 3개이며 신규 generated artifact는 아직 없었다.
- Main 직접 실행 증거: preflight `git ls-remote` exit0에서 control=`8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`; CAS 명령 `git push development 6134e4140d2017536563babc907c631853509ae5:refs/heads/codex/c21-operational-execution --force-with-lease=refs/heads/codex/c21-operational-execution:8fe7b975f39990b3d721d27b1a3e9353f891c5c1` exit0; postflight `git ls-remote` exit0에서 control=`6134e4140d2017536563babc907c631853509ae5`, candidate=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`다. source=`MAIN_AGENT_DIRECT_TOOL_RECEIPT`, secret/token은 없다.
- 다음: 실제 receipt를 strict manifest에 결박하고 신규 문서와 generated5를 생성한 뒤 GREEN·전체 tooling·독립 review를 수행한다.
- Main 인수 후 신규 문서 4개와 receipt field를 추가하고 generated5를 생성했다. 첫 live checker는 `EVENT_EFFECT_MISMATCH`였으며 fingerprint `SEQ608_COMPLETION_UPSTREAM_EFFECT_R1` 1회다. seq608 완료 Event에 기존 public upstream projection을 유지하는 `completion_upstream_head=ca92b7845eda803cff3c432799642e4f9243d4d6`이 빠진 것이 원인이므로 seq602와 동일한 불변 upstream을 추가했다.
- completion effect 교정 후 focused seq602+608은 `4 passed, 227 deselected`, live checker는 `PASS sequence=608 reporting=AUTO_CONTINUE`로 통과했다.
- sandbox 전체 tooling 실행은 45분 이상 진행된 뒤 장기 fixture에서 정상 기준(직전 약 21분)의 2배를 넘어 Main이 진단을 위해 중단했다. fingerprint `SEQ608_TOOLING_SANDBOX_LONG_RUNNING_R1` 1회. worker는 중단 전까지 `Responding=True`, CPU 증가, 메모리 안정이었으며 제품 실패로 판정하지 않는다.
- `-x` 재실행으로 최초 실패를 분리한 결과 `G06TestAssetContractTests::test_ts_clean_uses_offline_local_typescript_593_and_typechecks`가 Windows npm cache 파일 `stat`에서 `EPERM`으로 실패했다(`1 failed, 255 passed in 110.45s`). fingerprint `SEQ608_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1` 1회. 이는 sandbox가 `C:\Users\cyhuh\AppData\Local\npm-cache` 읽기를 거부한 환경 권한 오류이며 제품·seq608 회귀가 아니다.
- 다음: 동일 canonical 전체 tooling을 권한이 허용된 실행 경계에서 fresh 재실행하고 실제 결과를 기록한다.
- 권한 허용 경계에서 canonical 전체 tooling을 fresh 재실행했다: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `599 passed in 1125.72s (0:18:45)`, exit0. sandbox npm cache EPERM은 재발하지 않았고 failure/error는 0이다.
- 다음: 전체 PASS 증거를 generated5에 재결박하고 focused/live/determinism/history/Git 검증 후 exact12 단일 commit과 독립 review를 수행한다.
- 최종 precommit 검증: isolation+seq602+seq608 focused `6 passed, 290 deselected in 28.34s`; live checker `PASS sequence=608 reporting=AUTO_CONTINUE`; generated5 2회 byte equality와 materialized equality `SEQ608_GENERATED5_DETERMINISTIC_PASS`; `git diff --check` PASS다.
- dirty/untracked 경로는 선언된 exact12와 일치하며 seq1~602 raw prefix, cumulative207, 제품/A13 isolation/historical evidence 불변 계약은 seq608 focused validator가 확인했다. 다음: WORK_STATUS hash를 마지막 재결박 후 단일 direct-child commit을 생성한다.
# 2026-09-08 C-21 Workbench UI WSL authenticated browser probe R1 — seq609~614

- 담당: `developer-primary`; 시작 기준: clean `4ad596f603987f7a87b4396de035fd49ddc274f6`, branch `codex/c21-operational-execution`.
- 범위: exact13 Git-only probe 계약. 제품·배포·DB·Provider·Telegram·WSL·ysna·main은 변경 또는 실행하지 않는다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'seq614 or probe_self_test'` → exit 1, `3 failed, 231 deselected`. seq614 builder/metadata 부재 2건과 새 self-test mode 부재가 의도한 실패 원인이다. Playwright eager load가 schema-only self-test보다 먼저 실패한 현상은 새 mode가 runtime dependency 없이 secret-safe receipt schema를 검증해야 한다는 계약으로 함께 고정한다.
- 다음 조치: browser probe env-only mode와 schema-only self-test를 최소 구현하고, seq609~614 append-only projection/checker를 결박한 뒤 집중·전체 검증한다.
- 구현 GREEN: seq614 및 browser 입력 경계 집중 검증 `4 passed, 231 deselected`; 동일 fingerprint 반복 0회다.
- 환경 오류: sandbox 기본 권한에서 `docs/progress/progress-events.json` 생성 projection 쓰기가 `PermissionError`로 1회 거부됐다. 제품/생성기 오류가 아니며 플랫폼의 D:\tmp 쓰기 승격으로 동일 builder를 재실행해 generated5를 기록했다.
- projection 보완: 최초 live checker는 completion Event의 `completion_upstream_head` 누락으로 `EVENT_EFFECT_MISMATCH` 1회였다. predecessor repository remote 값을 명시해 재결박했고 live checker는 `PASS sequence=614 reporting=AUTO_CONTINUE`다. 동일 fingerprint 반복 0회다.
- 추가 TDD RED/GREEN: 상대 screenshot root가 repository 쓰기로 해석될 수 있는 실패를 1회 재현하고 원문 absolute path만 허용하도록 수정했다. seq614/browser 집중 검증은 `5 passed, 231 deselected`다.
- 관련 검증: `node --check tests/browser/c21-network-probe.mjs` exit 0; Web `12 passed`; API `41 passed`; 기존 `--workbench-self-test`는 실제 headless Chromium click/network를 통해 Provider GET 및 SSE Last-Event-ID 재개를 통과했다. Web 시험의 기존 `MODULE_TYPELESS_PACKAGE_JSON` 경고는 제품 오류로 승격하지 않는다.
- actual `--wsl-workbench-auth` WSL 실행과 실제 screenshot 생성은 이 Git-only package에서 `NOT_EXECUTED`다.
- 전체 progress tooling: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `236 passed in 1009.65s`. 실패 0이다.
- 독립 Reviewer R1: `REWORK / C0 / I3 / M0`. Important 3건은 screenshot root의 승인 temp 경계·비덮어쓰기/정리 계약 부족과 `Last-Event-ID` exact 값 비교 부족이다. exact13 안에서 TDD rework하며 acceptance/runtime 경계는 바꾸지 않는다.
- Main fresh 전체 tooling 기준: `604 passed in 1202.30s`, exit 0. 보완 후 동일 전체 범위를 다시 실행한다.
- Rework TDD RED: temp root/cleanup 및 bad cursor self-test 부재 `2 failed`; manifest 확장 계약 부재 `1 failed`. 서로 다른 root cause 각 1회이며 반복 0회다.
- Rework GREEN: 승인 temp prefix, unique non-existing/exclusive run directory, arbitrary/repository/existing/symlink-junction-reparse-realpath escape 거부, success/failure cleanup receipt, `Last-Event-ID == initial eventId` exact 비교와 missing/stale/wrong negative 계약을 구현했다. 집중 `7 passed, 231 deselected`, Node syntax exit 0이다.
- post-create race 보완 TDD RED/GREEN: 생성 후 symlink/reparse 교체 거부 증거 부재 `1 failed` 후 created run directory realpath를 재검증하고 screenshot buffer를 `wx` exclusive write하도록 수정했다. 집중 `2 passed, 236 deselected`; 동일 fingerprint 반복 0회다.
- Browser negative/actual/schema self-tests: page fetch scope PASS, cross-origin rejection PASS, 실제 headless Workbench Provider click + SSE Last-Event-ID PASS, schema-only root/cursor/screenshot receipt PASS. Web `12 passed`, API `41 passed`, Node syntax/diff-check PASS다.
- Rework generated5를 a4ad8e2 위 dirty 상태에서 임시 확인할 때 live checker는 postcommit clean-only gate에 따라 `GIT_DESCENDANT_RECORD_COMMIT_INVALID` 1회를 반환했다. 이는 a4ad8e2 amend 전 예상된 Git transition이며 final amend 후 clean direct-child에서 재검증한다.

## 2026-09-08 C-21 seq615~620 WSL authenticated browser runtime result R1

- 담당: `developer-primary`; 인수 parent/control `c4f219b214cd6bfd6fabf7fe69e26a8995ae098a`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, validated base `eef349682ff5598e3488c9e75163c5e0a99a0bdb`.
- 단계: preflight `PASS`; deploy attempt 1 `FAIL`; verify/browser PG15/browser PG18RC `NOT_EXECUTED`; cleanup attempt 1 `PASS`; postcondition `PASS`.
- 오류 횟수: runtime invocation lineage `C21_AUTH_BROWSER_CONTROL_REF_MISBOUND` valid failure 1. `ANVIL_CANDIDATE_MANIFEST_REF`를 control-runtime checkout에도 사용하는 현재 인터페이스에 candidate ref를 전달하여 observed checkout `f0d4bc7...`가 trusted control `c4f219b...`와 달랐고 mutation 전 exit3으로 거부됐다.
- WSL preflight: host `SINSAN`, user `daon`, application repo exact candidate/clean, private refs exact, validated base ancestor PASS, `.env` owner root/mode600/hash `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, bootstrap-token name/RUN_IDS/scope name presence 및 `provider:read` scope PASS. 값은 출력하지 않았다.
- immutable hashes: manifest `a1bb21983ef5791c5025e8487675801cb824b2066f5c9d9f8dcf092ec1d6d82b`, control-runtime `d0ff497b22851dfc6cb3fa36c761d8bb69ded1cb7a838e81ef55c4a459570097`, deploy `7b6ee6a02bed857299423f78c73d746b6f8ac8c0cc40e3a611ece06e43e1c1c0`, verify `93e882d35c055535a7d989962fe0ee0ec49b91542eb462b655f1477dd2562a36`, cleanup `65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d`.
- cleanup: 올바른 control ref로 표준 cleanup 1회, exit0. active control exact `c4f219b...`/clean.
- 사후: application repo exact candidate/clean, `.env` mode/hash byte-identical, PG15/PG18RC container0/network0, exact volume2 residue0.
- 비밀 안전성: credential value, token, cookie, header, raw URL은 stdout·문서·event·manifest에 기록하지 않았다. screenshot files/directories/residue도 0이다.
- 미검증: actual deploy/verify, authenticated browser 3 viewport, Provider UI read/GROQ click, SSE/Last-Event-ID. Provider 외부·Telegram·ysna·main·C-01은 제외 유지.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered.
- 다음: control checkout ref와 candidate manifest ref 역할을 분리한 별도 successor runtime attempt를 발행한다. 이번 실패 evidence는 보존한다.
- TDD RED: seq620 focused에서 신규 builder/metadata 부재로 `2 failed, 238 deselected`, exit1을 확인했다. GREEN: strict failure result/checksum/tamper 계약 구현 후 `2 passed, 238 deselected`, exit0이다.
- generated5 최초 materialize는 sandbox의 `D:\tmp` 쓰기 제한으로 `PermissionError` 1회가 발생했다. 제품/생성기 실패가 아니며 승인된 격리 worktree 쓰기 경계에서 동일 권위 생성기를 실행해 생성했다.
- live checker: `G-05 project progress contract: PASS sequence=620 reporting=AUTO_CONTINUE`, exit0.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `608 passed in 1214.47s (0:20:14)`, exit0.
- 용어 경계: WSL browser/API/DB/runtime은 개발단계 검증이다. 사용자 인수·외부 테스트·개발 완료로 승격하지 않는다. 작업계획서 자체 용어 정정은 exact12 밖이므로 후속 별도 projection 대상으로 남긴다.
- final focused seq614+seq620+probe: `9 passed, 231 deselected`, exit0. generated5 두 번 생성 결과 및 materialized bytes 동일 `SEQ620_GENERATED5_DETERMINISTIC_PASS`; `git diff --check` PASS.
- exact 경로는 설계된 12개와 일치하고 cumulative219 hash는 Windows `52936B5F9C6861EE6FAE270F747A6318502747539E8E66B285DA2811612D4E6D`, ordinal `7478D25196E94EB84E45BCE779E685937DB29E5736C8F482A7CD52D6040C40E2`다.
- 진단 오류 원장: sandbox 기본 WSL 호출 `E_ACCESSDENIED` 1회(플랫폼 권한, 승격 후 해소); root 소유 repo의 dubious ownership와 `.env` read denial 1회(전역 설정 변경 없이 command-local `safe.directory`와 기존 sudo read로 해소); sudo가 daon SSH alias/known_hosts를 상속하지 못한 private fetch 실패 2회(직접 `github.com` host와 기존 daon deploy key/known_hosts 명시로 해소); PowerShell/WSL 중첩 변수·quote 진단 명령 실패 2회(고정 literal 명령으로 해소); post-cleanup active-stage 동적 경로 검사 실패 1회(관측 stage literal read-only 검사로 exact control/clean 확인). 이들은 runtime deploy valid failure 횟수에 포함하지 않는다.

## 2026-09-08 C-21 seq621~626 WSL authenticated browser runtime retry result R2

- 담당: `developer-primary`; parent/control `a9243cc9969de58e4b230ff028fca1fe95e14778`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- seq620 independent review `COMMIT_READY C0/I0/M0`와 private CAS publication을 Main으로부터 인수했다. candidate는 불변이다.
- preflight: private control/candidate exact, candidate ancestor of control, application exact candidate/clean, `.env` mode600/hash `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, required names 및 provider:read scope, initial residue0 모두 PASS. 값은 출력하지 않았다.
- attempt 2: `ANVIL_CANDIDATE_MANIFEST_REF=refs/remotes/origin/codex/c21-operational-execution`, trusted control exact a9243cc, EXPECTED candidate exact f0d4bc7로 분리했다.
- deploy `FAIL`, exit128. control stage exact a9243cc 생성 후 application repo의 기존 origin hostname alias를 root 실행이 해석하지 못해 `git fetch origin`에서 mutation 전 중단됐다. fingerprint `APPLICATION_ORIGIN_ALIAS_UNRESOLVED_UNDER_ROOT`, 현재 root cause 1회다.
- 계약에 따라 실패를 재실행하지 않았다. verify/browser PG15/browser PG18RC는 `NOT_EXECUTED`다.
- cleanup: 표준 control-runtime cleanup 정확히 1회, exit0. 사후 application repo exact candidate/clean, env mode/hash byte-identical, PG15/PG18RC container/network 0, exact volume residue0.
- secret 값, token, cookie, header, raw URL, screenshot 파일은 기록·생성하지 않았다. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_2`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered.
- 용어: WSL browser/API/DB/runtime은 개발단계 검증이며 사용자 인수·외부 테스트·개발 완료로 표현하지 않는다.
- 다음: application fetch의 alias 해석 경계를 분석한다. 이번 attempt2 evidence는 보존한다.
- TDD RED: seq626 builder/metadata 부재로 `2 failed, 240 deselected`, exit1.
- TDD GREEN: strict attempt2 failure projection/checker를 구현한 뒤 seq626 focused는 `2 passed, 240 deselected`, seq620 회귀 포함 focused는 `4 passed, 238 deselected`, 모두 exit0이다.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `610 passed in 1176.53s (0:19:36)`, exit0. failure/error는 0이다.
- 다음: 전체 PASS 영수증을 generated5에 재결박하고 focused/live/determinism/exact12/Git 계보를 최종 검증한 뒤 parent a9243cc의 단일 direct-child commit으로 고정한다.
- precommit 최종 검증: seq620+seq626 focused `4 passed, 238 deselected`; live checker `PASS sequence=626 reporting=AUTO_CONTINUE`; generated5 2회 byte equality와 materialized equality `SEQ626_GENERATED5_DETERMINISTIC_PASS`; exact12 Windows/ordinal 및 cumulative225 Windows/ordinal hash 일치; parent a9243cc exact; `git diff --check` PASS다.

## 2026-09-08 C-21 seq627~632 WSL authenticated browser runtime retry R3 result

- 담당: `developer-primary`; parent/control `2d4a2c90fb6f3d4e38ba311f9e13294a8fe67be0`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- Main orchestration 오류 `MAIN_R3_WRONG_WORKDIR_CREATEPROCESS_R1` 1회: canonical worktree가 아닌 잘못된 workdir로 프로세스를 생성하려다 실패했다. 제품·WSL·Git 실행 실패가 아니며 canonical worktree로 교정했다.
- 범위: seq627~632 append-only exact12 projection 및 actual WSL development validation attempt 3. 제품/deploy/probe/WorkPlan/historical 파일은 변경하지 않는다.
- 다음: seq632 strict success/failure projection/checker 계약을 TDD RED로 고정한 뒤 secret-safe preflight와 단일 runtime attempt를 실행한다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -q -p no:cacheprovider -k seq632` → `2 failed, 242 deselected`, exit1. 신규 R3 builder/metadata 부재의 예상 실패이며 fingerprint `C21_AUTH_BROWSER_RUNTIME_R3_PROJECTION_UNBOUND_R1` 1회다.
- 다음: WSL child env에서 explicit `GIT_SSH_COMMAND` presence/exact와 private refs/repo/env/scope/residue를 secret-safe 확인한 뒤 attempt 3을 1회 실행한다.
- 플랫폼 안전 심사 거절 2회는 actual runtime 실행 전 `PLATFORM_SAFETY_REVIEW_REJECTION`으로 분리하며 attempt 3 횟수에 포함하지 않는다. 세 번째 요청은 사용자 중단으로 판정되지 않았고 제품·WSL mutation 증거가 없다.
- actual attempt 3 preflight: host/user `SINSAN`/`daon`, private control/candidate `2d4a2c90...`/`f0d4bc7...`, application candidate/clean, env mode600/hash `FECAE53B...52A79A`, required names/provider:read scope, initial container/network/exact-volume residue `0/0/0`, lock absent가 PASS했다.
- deploy exact1은 control runtime을 표준 `bash script` 호출 대신 직접 실행하여 `/srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh: Permission denied`, exit126으로 application/Docker mutation 전에 실패했다. fingerprint `CONTROL_RUNTIME_DIRECT_EXEC_PERMISSION_DENIED_R3` 유효 실패 1회다. verify/PG15/PG18 authenticated browser는 `NOT_EXECUTED`이며 재실행하지 않았다.
- cleanup exact1도 동일 direct-exec 오류로 exit126/FAIL이다. read-only 사후 관측은 container/network/exact-volume/lock residue `0/0/0/0`, application `f0d4bc7...` clean, env mode/hash byte-identical이다. malformed bash arg1 및 wrong Windows cwd Git discovery2는 preflight orchestration abort이며 runtime mutation0이다. receipt 뒤 `exit 30\\r` 메시지는 PowerShell CRLF 오류로 second attempt가 아니다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_3`; WSL 개발단계 검증 실패이며 accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 다음 안전 조치: 별도 successor에서 `sudo -n env GIT_SSH_COMMAND=... bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh deploy <candidate>`를 사용하고 cleanup도 `bash`로 호출한다.
- 경로 계약 재검산: repository `_c21_path_list_sha`로 exact12 Windows/ordinal `227E0B11...784E4B`/`3FDD92F6...73E3E`, cumulative231 `1701B4B8...65B15`/`4491BC45...EEE6C`가 모두 일치했다. 최초 독립 계산의 경로 입력 오류는 계약 오류로 계상하지 않는다.
- Main의 exact 경로 전달 중 manifest `WORKBENCH_UI_UI`, validation `WORKBEN_UI` 오타 1회는 즉시 정정됐으며 오타 경로 파일은 생성하지 않았다. fingerprint `MAIN_R3_EXACT_PATH_TRANSMISSION_TYPO_R1` 1회다.
- TDD GREEN: seq632 focused `2 passed, 242 deselected`; seq626 회귀 포함 focused `4 passed, 240 deselected`; live checker `PASS sequence=632 reporting=AUTO_CONTINUE`다.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `612 passed in 1060.58s (0:17:40)`, exit0. failure/error는 0이다.
- 다음: 위 fresh 영수증을 generated5에 재결박하고 focused/live/determinism/exact12/Git 계보를 최종 검증한 뒤 parent `2d4a2c9`의 단일 direct-child commit으로 고정한다.
- precommit 최종 검증: seq626+seq632 focused `4 passed, 240 deselected`; live checker `PASS sequence=632 reporting=AUTO_CONTINUE`; generated5 2회 및 materialized bytes 동일 `SEQ632_GENERATED5_DETERMINISTIC_PASS`; exact12/cumulative231 Windows·ordinal hash 일치; parent `2d4a2c9` exact; `git diff --check` PASS다.

## 2026-09-08 C-21 seq633~638 WSL authenticated browser runtime retry R4 result

- 담당: `developer-primary`; parent/control `eafe12a3d64bd0d4f6f91924fcc35a20ab7dd07a`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 시작 상태: branch `codex/c21-operational-execution`, HEAD/upstream private control `eafe12a3d64bd0d4f6f91924fcc35a20ab7dd07a`, tracked worktree clean. seq1~632, attempt1~3, historical evidence는 불변이다.
- 범위: seq633~638 append-only exact12 projection 및 actual WSL development validation attempt 4 정확히 1회. 제품/deploy/probe/WorkPlan은 변경하지 않는다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -q -p no:cacheprovider -k seq638` → `2 failed, 244 deselected`, exit1. 신규 R4 builder/metadata 부재의 예상 실패이며 fingerprint `C21_AUTH_BROWSER_RUNTIME_R4_PROJECTION_UNBOUND_R1` 1회다.
- 다음: strict R4 projection/checker의 최소 구현 후 child `ls-remote`·ref·repo·env·residue preflight를 수행하고, 모든 runtime action을 outermost `sudo -n env`와 explicit `GIT_SSH_COMMAND`, 명시 hash, `bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh <action> f0d4bc7...`로 호출한다.
- 최초 child `ls-remote`는 미등록 residual key `id_ed25519_github_sinsan_develop`을 잘못 지정해 publickey exit1이었다. runtime attempt는 시작되지 않았고, read-only key inventory에서 기존 승인 transport `/home/daon/.ssh/sinsan-develop`을 확인해 교정했다. fingerprint `R4_PREFLIGHT_WRONG_EXISTING_KEY_SELECTION_R1` 1회다.
- env preflight 진단에서 이전 추정 변수명이 실제 `.env` 이름과 달라 silent exit1이 1회 발생했다. 값은 출력하지 않았고 실제 exact6 이름과 `ANVIL_TEST_SESSION_PERMISSION_SCOPES`의 `provider:read` presence로 교정했다. fingerprint `R4_PREFLIGHT_ENV_NAME_ASSUMPTION_R1` 1회다.
- 최종 preflight PASS: host/user `SINSAN/root`, private control/candidate `eafe12a...`/`f0d4bc7...`, application exact candidate/clean, env mode600/hash `FECAE53B...52A79A`, required names exact6/provider:read, initial container/network/exact-volume/lock residue `0/0/0/0`, explicit Git SSH transport와 immutable manifest/action hash presence를 확인했다.
- actual deploy exact1은 outermost `sudo -n env`와 explicit Git SSH transport/hashes, `bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh deploy f0d4bc7...`로 호출했다. control stage는 `eafe12a...`에 결박됐고 application origin fetch 후 exit1 실패했다. 재실행하지 않았으며 verify/PG15/PG18RC authenticated browser는 `NOT_EXECUTED`다.
- read-only lineage 진단: control `eafe12a...` parent는 `2d4a2c9...`, candidate→control은 56 paths다. active guard는 candidate `f0d4bc7...`의 single direct-child exact12를 요구하므로 충돌한다. fingerprint `WORKBENCH_CANDIDATE_CONTROL_DIRECT_CHILD_MISMATCH_R4` 1회이며 확인된 사실과 원인 추론을 구분한다.
- cleanup exact1은 같은 outermost transport로 `bash ... control-runtime.sh cleanup f0d4bc7...`을 호출했으나 전달된 cleanup hash에서 `B` 1자가 누락되어 `trusted control identity format is invalid`, exit1로 mutation 전에 실패했다. 재실행하지 않았다. fingerprint `CONTROL_CLEANUP_HASH_FORMAT_INVALID_R4` 1회다.
- 사후 read-only: application `f0d4bc7...` clean, env mode/hash byte-identical, approved runtime container/network/exact-volume/lock/screenshot residue `0/0/0/0/0`; active control stage1은 `eafe12a...` clean이다. Secret/token/cookie/header/raw URL 값과 screenshot 파일은 생성·기록하지 않았다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_4`; classification `WSL_DEVELOPMENT_VALIDATION`, accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 실제 결과 TDD RED: seq638 신규 strict failure assertion은 기존 success template 때문에 `1 failed, 2 passed, 244 deselected`, exit1. GREEN에서 deploy/cleanup exact1 실패, 후속 미실행, residue와 경계 계약을 결박해 `3 passed, 244 deselected`, exit0이다.
- 다음 안전 조치: candidate의 single direct-child exact12 immutable runtime control ref를 별도 successor로 발행·결박하고 정확한 cleanup hash를 사용한 새 attempt를 준비한다. 이번 attempt4 evidence는 덮어쓰지 않는다.
- 인수 시 이전 canonical 전체 tooling 실행은 약 70%에서 사용자 중단으로 프로세스가 종료됐다. provisional failure 1건이 화면에 보였으나 최종 traceback·exit code가 없어 `INTERRUPTED_NON_RESULT`로 분류하며 PASS·FAIL·정식 failure 횟수에 포함하지 않는다.
- 인수 후 WSL read-only 재확인: application `f0d4bc7...` clean, active control stage `eafe12a...` clean, publish lock과 Anvil 전용 container/network/지정 volume residue 0. actual deploy/verify/browser/cleanup은 재실행하지 않았다.
- 인수 후 fresh canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `615 passed in 793.94s (0:13:13)`, exit0. 실패·오류·skip은 0이다.
- 첫 live checker 인수 호출은 지원하지 않는 `--root` 옵션을 전달해 `--root`가 root 위치 인자로 해석되면서 `LOAD_ERROR`, exit1로 종료됐다. fingerprint `LIVE_CHECKER_ROOT_FLAG_USAGE_R1` 1회이며 제품·projection·runtime 실패가 아니다. 올바른 위치 인자 `.`로 교정한다.
- precommit 최종 검증 준비: seq632+seq638 focused `5 passed, 242 deselected`; 교정 live checker `PASS sequence=638 reporting=AUTO_CONTINUE`; generated5 두 번 생성 및 materialized bytes 동일 `SEQ638_GENERATED5_DETERMINISTIC_PASS`; exact12 Windows/ordinal `3FC15E2C...1218F1`/`55CCC7D5...9742C`, cumulative237 Windows/ordinal `7882E92A...CECE7C`/`7B3AF299...9245D` 일치; parent `eafe12a...` exact; `git diff --check` PASS다.
- 인수 orchestration 오류: sandbox 기본 WSL read `E_ACCESSDENIED` 1회(`FINALIZER_WSL_SANDBOX_READ_DENIED_R1`), PowerShell/WSL 일괄 인용 syntax 오류 1회(`FINALIZER_WSL_POWERSHELL_QUOTING_R1`), D:\tmp generated5 materialize `PermissionError` 1회(`FINALIZER_GENERATED5_SANDBOX_WRITE_DENIED_R1`), 첫 patch의 두 번째 파일 context 불일치 1회(`FINALIZER_PATCH_CONTEXT_MISMATCH_R1`). 모두 제품·projection·actual runtime 실패가 아니며 승인된 격리 경계·분리된 literal 명령·정확한 context로 교정했다. runtime deploy/verify/browser/cleanup은 재실행하지 않았다.
- 최초 direct-child commit 뒤 오류 원장 추가로 dirty한 amend 전환에서 live checker는 의도대로 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`, exit1로 fail-closed했다. 이는 최종 clean amend 전 예상된 Git transition이며 제품·projection 결함이 아니다. 최종 amend 후 clean direct-child에서 재검증한다.
- 독립 review 판정은 `COMMIT_READY / C0 / I0 / M1`이다. M1은 R4 결과 보고서 인수 검증의 tooling/checker/orchestration 관련 블록이 정상 순서 뒤에 역순으로 중복된 비의미 문서 결함이다. 뒤쪽 중복만 제거해 각 사실을 한 번씩 논리 순서로 유지하며 코드·runtime·기존 full tooling `615 PASS` 증거는 변경하거나 재실행하지 않는다.
# C-21 Workbench UI WSL immutable runtime control v2 publication — seq644

- 기준선은 canonical `codex/c21-operational-execution`의 `22ebc0470d4bd9ddef03f763c0197d67c315443e`이며 시작 worktree는 clean이었다. sibling `fb311d456fe3cbb2e8439f39017356ddec6cf266`은 candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`의 sole direct child이고 canonical branch에 merge/cherry-pick하지 않는다.
- 실제 create-only CAS receipt를 append-only 기록한다. preflight에서 `refs/heads/candidates/c21-wsl-runtime-control-v2`는 `ABSENT`, candidate/record는 각각 `f0d4bc7`/`22ebc047`; atomic publication exit 0; postflight는 runtime-control-v2/candidate/record가 각각 `fb311d45`/`f0d4bc7`/`22ebc047`이다.
- sibling exact12/cumulative189 및 manifest raw SHA-256 `3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329`, guard raw SHA-256 `94727D9BF06BC6256B97F1FA7BB8C2E1E383F75EA5D2939A804E0A0B6D22AA19`를 검증한다. reviewer receipt는 `COMMIT_READY / C0 / I0 / M0`다.
- 현재 직접 지시는 실행 증거에 `CURRENT_DIRECTIVE_APPLIED_TO_EXECUTION_EVIDENCE`로 적용한다. Local PC와 WSL-server의 구현·build·unit·static·fixture·API·DB·브라우저·E2E·실제 runtime 검증·문서화·정리는 `DEVELOPMENT`이고 WSL은 외부/사용자 인수 또는 완료 판정이 아니다. Oracle Cloud의 정확한 candidate 배포부터 별도 명시 승인된 `TEST/STAGING/UAT`가 시작된다. `WSL_SERVER_TEST_STAGING`과 cleanup label은 legacy machine identifier로 유지한다.
- 작업계획서의 지속 문구 변경은 안전 게이트가 별도 명시 승인 필요로 판정하여 `PENDING_EXPLICIT_GOVERNANCE_CLASSIFICATION_APPROVAL`로 분리했다. 이 package는 `Anvil_작업계획서_v1.md`를 수정하지 않는다. Main이 잘못된 agent target으로 `send_message`한 orchestration error 1회는 제품 failure가 아니며 같은 오류 반복은 0회다.
- 오류 원장: 초기 dirty path count를 예상 6/실제 7로 잘못 보고한 `SEQ644_DIRTY_PATH_COUNT_REPORT_MISMATCH_R1` 1회, 동일 오류 반복 0회. 첫 full tooling은 69%에서 healthy CPU를 유지했으나 41분 동안 진행률 출력이 고정되어 기준 시간 2배 초과 후 Ctrl+C로 정상 중단했다. `SEQ644_TOOLING_SANDBOX_LONG_RUNNING_R1` 1회이며 제품 failure/PASS로 계상하지 않는다. 후속 `-x`는 `255 passed, 1 failed in 126.20s`; 최초 실패는 npm offline cache `stat`의 sandbox `EPERM`인 `SEQ644_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1`이며 제품 failure가 아니다. 승인된 실행 권한의 canonical full tooling fresh 1회는 `619 passed in 1543.54s`, exit 0이다.
- seq639~644만 append한다. seq1~638, historical evidence, record history, 기존 candidate/control action hash는 변경하지 않는다. Provider·Telegram·WSL runtime·ysna·main·C-01은 `NOT_EXECUTED`; C-21 accepted=false, C-01 blocked, DIR-2 not triggered다.
- terminal status는 `READY_FOR_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION`, 다음 조치는 `EXECUTE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_DEVELOPMENT_VALIDATION_R5`다.

## 2026-09-09 C-21 seq645~650 WSL authenticated browser runtime retry R5 result — 인수

- 담당: `developer-primary`; canonical parent/private record `48c34f8ef514e061f1cfa24e6d9f9f5bc0173bf1`, immutable runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 시작 상태: `D:\tmp\anvil-c21-operational-execution`, branch `codex/c21-operational-execution`, HEAD `48c34f8...`, tracked worktree clean. local immutable ref는 `refs/remotes/development/candidates/c21-wsl-runtime-control-v2`; WSL control repo의 private origin fetch ref는 `refs/remotes/origin/candidates/c21-wsl-runtime-control-v2`다.
- 범위: actual WSL development validation R5 정확히 1회와 seq645~650 append-only exact12 projection. 제품/deploy/probe/WorkPlan, seq1~644, historical/sibling immutable evidence는 변경하지 않는다.
- Main 전달 verify SHA 문자열에 잡문이 섞인 orchestration 오류 `MAIN_R5_VERIFY_SHA_TRANSMISSION_TYPO_R1` 1회가 있었다. 제품=false, runtime=false이며 정확한 유일 값 `93E882D35C055535A7D989962FE0EE0EC49B91542EB462B655F1477DD2562A36`으로 교정했다.
- 첫 읽기 전용 preflight 묶음은 `bash -c` payload의 Windows→WSL argv 인용이 보존되지 않아 빈 remote/path로 해석됐다. fingerprint `R5_PREFLIGHT_WINDOWS_WSL_ARGV_QUOTING_R1` 1회, 제품=false, runtime=false이며 deploy/verify/browser/cleanup action은 0회다. 복합 shell payload를 중단하고 값 비노출 단일 argv 관측으로 분리한다.
- 다음: strict R5 success/failure projection/checker를 TDD RED로 고정한 뒤 secret-safe preflight를 수행한다. runtime은 preflight 전부 PASS일 때 deploy→verify→Windows canonical probe PG15→PG18RC를 각 1회 실행하고 outer finally cleanup을 정확히 1회 수행한다. 실패 시 runtime action은 재실행하지 않는다.
- sandbox 기본 권한의 최초 WSL read는 `E_ACCESSDENIED`로 거절됐다. `R5_PREFLIGHT_WSL_SANDBOX_DENIED_R1` 1회, product=false/runtime=false/action=0이며 승인된 실행 경계에서 같은 read-only preflight를 이어갔다.
- 최종 preflight PASS: child private record/control/candidate exact, application `f0d4bc7...` detached clean, control-runtime SHA `D0FF497B...70097`, `.env` mode600/hash `FECAE53B...52A79A`, required name presence와 exact provider-read scope, 초기 container/network/exact-volume/lock residue0을 확인했다. 값은 출력하지 않았다.
- actual R5는 재실행 없이 정확히 1회 진행했다. deploy exact1 `exit0/PASS`, verify exact1 `exit0/PASS`; PG15 Windows canonical browser exact1은 `exit1/PROBE_ERROR`, PG18RC는 stop-on-first-failure로 `NOT_EXECUTED`; outer-finally cleanup exact1은 `exit0/PASS`다.
- PG15 receipt 원문에 token/sentinel/base URL 및 cookie/header/raw URL 값이 없음을 먼저 확인했다. Node entrypoint와 secret-safe receipt parser는 실행됐으나 `C:\Program Files\nodejs\node_modules\playwright`가 없고 `ANVIL_PLAYWRIGHT_MODULE`·`ANVIL_CHROMIUM_EXECUTABLE` override도 없어 viewport0에서 실패했다. fingerprint `PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5`, category `PLAYWRIGHT_RUNTIME_DEPENDENCY_RESOLUTION`이다. 직전 verify의 API/authenticated SSE/Last-Event-ID/same-origin PASS와 분리되므로 제품 UI/API/SSE 실패로 확정하지 않는다.
- current JSON receipt는 PG15/PG18RC pre-migration backup 2개와 verification 2개만 합계4이며 rollback receipt는0이다. file SHA-256은 `A2A8FB3C...69C36`, `2AC37761...9541`, `96BD2FC8...C8DB2`, `0CE473C5...E4D3B`; image metadata2 SHA는 `18108107...E88B3`, `2E549E4B...32393`이다. backup/evidence는 보존했다.
- post-cleanup application/env/control stage clean, exact container/network/volume/lock residue0이다. repository/history의 기존 versioned PNG 6개는 probe-created mutation이 아니며 exact probe-created evidence/backup/runtime 경로의 screenshot filesystem mutation/residue는0이다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음 안전 조치는 canonical Windows Playwright runtime dependency 경로를 복구한 별도 successor다.
- actual failure TDD: PG15 dependency failure가 verify receipt4를 보존하고 PG18RC를 미실행하는 strict test는 RED `1 failed, 254 deselected` 후 GREEN `4 passed, 251 deselected`다. seq650 builder 부재 test는 RED `1 failed, 255 deselected`이며 strict generated5 구현으로 전환했다.
- Main의 연속 상태요청 두 건에 깨진 문구가 포함됐다. 사용자 정정에 따라 하나의 orchestration error `MAIN_R5_STATUS_TRANSMISSION_TYPO_R1` 1회로만 기록하며 product=false/runtime=false다.
- checker syntax 확인용 `py_compile`은 sandbox가 `scripts/__pycache__` write를 거절해 exit1이었다. 같은 module은 focused pytest에서 정상 import·실행됐으며 `SEQ650_PYCOMPILE_SANDBOX_PYCACHE_DENIED_R1` 1회, product=false/runtime=false다.
- seq644+seq650 focused는 `9 passed, 247 deselected in 2.50s`, live checker는 `PASS sequence=650 reporting=AUTO_CONTINUE`다. generated5는 materialize했고 manifest strict validation과 seq1~644 raw prefix 보존을 확인했다.
- canonical sandbox full tooling은 10분/69%에서 provisional failure1 뒤 traceback 없이 CPU 진행 중이었으나 지시된 장시간 경계에서 Ctrl+C exit1로 중단했다. `SEQ650_TOOLING_SANDBOX_LONG_RUNNING_R1`은 non-result/product=false/runtime=false다.
- 후속 `pytest tests/tooling -q -x -p no:cacheprovider`는 `1 failed, 255 passed in 120.17s`, exit1로 첫 failure를 분리했다. 기존 G06 TypeScript clean fixture의 `npm ci --offline` cache `stat EPERM`이며 fingerprint `SEQ650_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1`, product=false/runtime=false다. 동일 단일 테스트를 권한 허용 경계에서 실행해 `1 passed in 4.14s`, exit0을 확인했다.
- `test_project_progress.py` 전체는 failure 없이 28% 뒤 CPU가 계속 증가했으나 직전 정상 약 12분의 2배인 25분 경계를 넘어 Ctrl+C exit1로 중단했다. `SEQ650_PROJECT_PROGRESS_LONG_RUNNING_R1`은 non-result/product=false/runtime=false이며 장시간 suite는 더 실행하지 않는다. seq644 canonical full `619 passed in 1543.54s`와 fresh focused9/live checker/단일 EPERM elevated PASS를 함께 사용한다.
- 최초 exact12 stage는 linked-worktree Git index가 workspace sandbox 밖에 있어 `index.lock Permission denied`로 중단됐다. `SEQ650_GIT_INDEX_SANDBOX_DENIED_R1` 1회, product=false/runtime=false이며 index mutation0을 확인하고 권한 허용 경계의 동일 exact12 stage로 교정한다.

## 2026-09-09 C-21 seq651~656 WSL authenticated browser runtime retry R6 result — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-execution-fence-epoch-1-4a30f23`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-write-fence-epoch-1-4a30f23`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `4a30f234745677025a572beb2ec8dcad379ac193`, tracked worktree clean, runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq651~656 append-only exact12와 actual R6 1회. seq1~650/historical evidence, 제품/deploy/probe/WorkPlan, `.env`는 불변이며 install/download/runtime retry는 금지한다.
- 실행 계약: read-only preflight 뒤 deploy1→verify1→PG15 browser1→성공 시 PG18RC browser1, outer-finally cleanup exact1. Playwright module/executable은 Main이 사전 self-test한 기존 경로를 process-local environment에만 주입한다.
- 다음: seq656 성공·실패 projection/checker를 TDD RED로 고정한 뒤 preflight와 actual runtime을 실행한다.
- 최초 전달된 architect hash 4개는 전달된 exact12 경로 집합을 repository `_c21_path_list_sha`로 계산한 값과 불일치했다. fingerprint `MAIN_R6_ARCHITECT_PATH_HASH_CALCULATION_ERROR_R1` 1회, product=false/runtime=false/action=0이다. Main이 독립 재계산 후 경로 집합을 정본으로 확정하고 exact Windows/ordinal `58CE542C...41975`/`2FD1D089...E6DC3`, cumulative255 Windows/ordinal `880C34EB...84786`/`CEEBA7C4...554F6`으로 교정했다.
- R6 read-only preflight 복합 collector는 detached application의 빈 branch 출력을 `.Trim()`하려다 같은 null method error로 2회 중단됐다. fingerprint `DETACHED_BRANCH_EMPTY_OUTPUT_NULL_TRIM` 2회, product=false/runtime=false/action=0이다. 두 번째 실패 뒤 복합 collector를 폐기하고 branch empty는 `symbolic-ref` exit로 확인하는 direct literal 관측 revision으로 전환한다. 동일 오류 3회째면 runtime action0 증거와 TakeoverPacket을 제출하고 중단한다.
- direct literal preflight는 application `f0d4bc7...` detached/clean, control `fb311d45...` clean, private refs exact, `.env` mode600/hash `FECAE53B...52A79A`, required names/provider-read scope, initial residue0, process-local Playwright module/Chromium executable 존재를 확인해 PASS했다. `.env` mutation과 비밀값 출력은 없다.
- actual R6는 단일 PowerShell try/finally에서 정확히 1회 시작했다. deploy action count1은 실제 `exit0/PASS`했고 backup receipt2/image metadata2를 생성했다. 함수가 WSL stdout과 마지막 exit code를 함께 반환해 `$deployExit`가 배열이 되었고 controller가 성공 deploy를 실패로 오분류해 exit1로 종료했다. fingerprint `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6` 1회, product=false/runtime=true다.
- stop-on-first-failure에 따라 verify count0, PG15 browser count0, PG18RC browser count0이다. process-local Playwright/Chromium 값은 browser phase에 도달하지 않아 사용되지 않았고 runtime action 재실행은 0회다. outer-finally cleanup count1은 `exit0/PASS`했다.
- post-cleanup은 application/control stage clean, `.env` byte-identical, exact container/network/volume/lock/probe-created screenshot residue0이다. current R6 JSON은 backup2/verification0/rollback0이고 SHA-256은 `894462E0...7ADAE`, `C02F8A37...72FB5`; image metadata2는 `18108107...E88B3`, `2E549E4B...32393`이다. JSON은 `secret_values=omitted`와 민감 키/raw URL 부재를 원문 비노출로 확인했다.
- seq656 실제 orchestration failure strict TDD는 RED `3 failed, 1 passed, 256 deselected` 뒤 validator key 교정과 R5 회귀 보호를 거쳐 seq650+seq656 focused `10 passed, 251 deselected in 10.20s`, exit0이다.
- 도구 오류 원장: `SEQ656_PYTHON_COMMAND_NOT_FOUND_R1` 1회, `SEQ656_PY_LAUNCHER_NO_PYTHON_R1` 1회, `SEQ656_BUNDLED_PYTHON_PYTEST_MISSING_R1` 1회, `R6_POSTEVIDENCE_WSL_SANDBOX_DENIED_R1` 1회, `R6_RECEIPT_SECRET_SAFE_QUOTE_JQ_UNAVAILABLE_R1` 1회, `SEQ656_PYCOMPILE_SANDBOX_PYCACHE_DENIED_R1` 1회다. 모두 product=false/runtime=false이며 `.venv` focused import 또는 승인된 read-only 경계로 교정했다.
- Main 상태 점검 중 협업 도구 인자 오류 `MAIN_COLLAB_TOOL_ARGUMENT_ERROR`가 3회 연속 발생했다(missing target, target type/name typo, wait timeout type). impact=`NONE`, resolved=`true`, product=false/runtime=false이며 Developer failure/runtime failure count에 포함하지 않는다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다.
- 다음: generated5를 failure projection으로 materialize하고 focused/live checker/determinism/diff/exact12/direct-child를 검증한다. 다음 runtime은 controller stdout/exit-code 분리 successor 없이는 실행하지 않는다.
- seq651~656 generated5 materialize는 5개 파일을 생성했고 strict manifest raw checksum row11, historical seq1~650 raw event prefix, exact12/cumulative255를 결박했다. live checker는 `PASS sequence=656 reporting=AUTO_CONTINUE`, exit0이다.
- precommit 검증은 seq650+seq656 focused `10 passed, 251 deselected in 10.20s`, generated5 두 번 byte equality/materialized equality PASS, checker source AST parse PASS, `git diff --check` PASS다. dirty/untracked는 선언된 exact12만이며 장시간/full suite는 시작하지 않았다.
- 미검증: verify와 PG15/PG18RC authenticated browser, Provider UI read/GROQ click, SSE/Last-Event-ID, 독립 review. 다음: 최종 WORK_STATUS checksum을 generated5에 재결박하고 동일 focused/checker/determinism/exact12를 fresh 확인한 뒤 parent `4a30f23...`의 단일 direct-child commit을 생성한다. push는 금지한다.

## 2026-09-09 C-21 seq657~662 WSL authenticated browser runtime retry R7 result — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-execution-fence-epoch-1-0e22a1d`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-write-fence-epoch-1-0e22a1d`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `0e22a1d4e47cdff117b894dd885af816f354a550`, clean worktree, immutable runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq657~662 append-only exact12와 actual R7 1회. seq1~656/historical evidence와 제품/deploy/probe/WorkPlan/`.env`는 불변이다.
- 실행 계약: harmless local native wrapper self-check 뒤 read-only preflight→deploy1→verify1→PG15 browser1→성공 시 PG18RC browser1, outer-finally cleanup 정확히1. 첫 failure 뒤 중단하며 WSL action 재시도는 금지한다.
- 다음: native wrapper stdout/exit 분리 및 seq662 success/failure projection을 TDD RED로 고정한다.
- TDD RED: seq662 focused는 신규 metadata/validator/builder 부재로 `4 failed, 261 deselected`, exit1이었다. metadata와 native wrapper/success-failure validator 최소 구현 후 `3 passed, 1 failed`, 남은 expected failure는 builder 부재뿐이었다.
- harmless local native wrapper self-check는 stdout1/exit0/`Int32`/caller `.ExitCode`/WSL action=false로 PASS했다. R6 `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6`은 actual에서도 재발하지 않아 root status `RESOLVED`다.
- preflight 오류 원장: helper parameter에 PowerShell reserved `$Args`를 사용한 `R7_PREFLIGHT_RESERVED_ARGS_PARAMETER_R1` 1회, control root 자체를 Git repo로 본 `R7_PREFLIGHT_CONTROL_ROOT_REPO_ASSUMPTION_R1` 1회, `%(refname)` format argv 인용을 보존하지 못한 `R7_PREFLIGHT_FOREACH_REF_FORMAT_QUOTING_R1` 1회다. 모두 product=false/runtime=false/action=0이며 서로 다른 fingerprint다.
- Main 지시대로 active stage에 `git rev-parse --git-dir --show-toplevel`과 quoted `git for-each-ref --format='%(refname) %(objectname)'`를 한 번 적용했다. stage root/HEAD/object/clean과 candidate/control refs를 exact 확인했으며 remote-tracking ref 존재 자체를 새 필수 제품 계약으로 만들지 않았다.
- 최종 preflight PASS: application `f0d4bc7...` detached clean, active control `fb311d45...` clean/object present, `.env` mode600/hash `FECAE53B...52A79A`/exact7 names/provider-read scope, initial residue0, probe hash exact, process-local Playwright module/Chromium executable present다. 비밀값과 raw URL은 출력하지 않았다.
- actual R7 단일 실행: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/NONPASS`, PG18RC browser0, outer-finally cleanup1 `exit0/PASS`, runtime retry0. primary fingerprint `BROWSER_ACCEPTANCE_FAILED_R7` 1회다.
- browser receipt JSON parser는 통과했으나 controller가 non-PASS의 세부 parsed JSON/predicate를 보존하지 않았다. diagnostic fingerprint `BROWSER_RECEIPT_NOT_PERSISTED_R7` 1회다. 제품/환경/브라우저 하위 원인은 재실행 없이 분리 불가하므로 추정하지 않는다. verification receipt의 authenticated SSE/Last-Event-ID/same-origin은 두 target 모두 PASS라는 범위만 유지한다.
- current R7 JSON receipt4는 backup2/verification2/rollback0이고 SHA-256은 `CF9EF430...7E90E`, `96BD2FC8...C8DB2`, `9A4B65F9...C612D`, `0CE473C5...E4D3B`; image metadata2는 `18108107...E88B3`, `2E549E4B...32393`이다. 네 JSON 모두 `secret_values=omitted`와 민감 키/raw URL 부재를 원문 비노출로 확인했다.
- post-cleanup application/control clean, `.env` byte-identical, exact container/network/volume/lock/probe-created screenshot residue0이다.
- Main 상태 점검 중 잘못된 interrupt 도구 선택 `MAIN_R7_INTERRUPT_TOOL_SELECTION_ERROR_R1` 1회와 깨진 지시 출력 `MAIN_R7_STATUS_TRANSMISSION_TYPO_R1` 1회가 있었다. impact=`NONE`, saved exact12 변경과 receipt는 intact, checker AST PASS로 복구했으며 product=false/runtime=false다.
- 판정: `FAILED_R7_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다.
- 다음: seq662 failure generated5/checker를 완성한다. R8은 actual 재실행 전에 모든 native stdout/parsed JSON을 secret-safe memory/object에 보존하고 phase exit와 predicate failures를 분리해야 한다.
- seq662 builder/failure projection 구현 후 seq656+662 focused는 `9 passed, 256 deselected in 9.47s`, exit0이다. generated5 materialize와 live checker `PASS sequence=662 reporting=AUTO_CONTINUE`를 확인했다.
- generated5 두 번 byte equality와 materialized equality PASS, exact12 dirty 일치, cumulative261/hash 계약, raw checksum row11, seq1~656 raw event prefix 보존, `git diff --check` PASS다. 장시간/full suite와 runtime 재실행은 시작하지 않았다.
- 다음: 최종 WORK_STATUS checksum을 generated5에 재결박하고 fresh focused/checker/determinism/exact12를 확인한 뒤 parent `0e22a1d...`의 single direct-child commit을 생성한다. push는 미실행으로 유지한다.

## 2026-09-09 C-21 seq663~668 WSL authenticated browser runtime retry R8 result — 인수/lease

- 담당: `developer-primary`; worker/write lease와 execution/write fence epoch1을 parent `a1b67f4` 및 R8 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `a1b67f4f93d06e1b71f5bd05b9f66e404f10a039`, clean worktree, runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq663~668 append-only exact12와 actual R8 1회. seq1~662/historical evidence 및 product/probe/deploy/WorkPlan/`.env`는 불변이다.
- exact12 Windows/ordinal `151561FBBD5EAF89FC25E125D0E205B08ADBA99EADECB1E194D4D0DC0AEB3F25` / `0373683DBDDB9B07FCFBA084F2F9BC164D7326EC3864FE616CE110B2D8FED172`; cumulative267 Windows/ordinal `84F562328BC0C0EA7CEB2C9C15CD0728447140C8F67A7A9A5689973E4834374B` / `6DE6BB7AB87178149F987475196D8EA30997DF57BE025E5F9453AD67DBCF590B`.
- 초기 도구 payload 문법 오류 `R8_INITIAL_TOOL_PAYLOAD_SYNTAX_R1` 1회는 command 실행 전 발생했고 product/runtime/action 영향0이다.
- 다음: separated stdout/stderr/exit와 strict parsed receipt/predicate persistence를 TDD RED로 고정한다.
- TDD RED는 R8 metadata/strict observation validator 부재로 `3 failed, 265 deselected`, exit1; 최소 구현 GREEN은 `3 passed, 265 deselected`, exit0이다. builder 포함 focused는 `4 passed, 265 deselected`, exit0이다.
- local native 분리 self-check는 stdout1/stderr1/exit7을 별도 field로 보존해 PASS했다. sandbox WSL은 `Wsl/Service/E_ACCESSDENIED`였고 `R8_SANDBOX_WSL_E_ACCESSDENIED_R1` 1회, product=false/runtime=false/action=0; 승인된 경계로 교정했다.
- preflight 준비 오류는 결과 serialization 구문 `R8_SELF_CHECK_RESULT_SERIALIZATION_R1` 1회, ProcessStartInfo/native `bash -c` payload split `R8_PREFLIGHT_BASH_C_ARGUMENT_SPLIT_R1` 2회, relative active pointer를 absolute로 오인한 `R8_PREFLIGHT_ACTIVE_POINTER_RELATIVE_PATH_R1` 1회, env path/name 계약 추정 `R8_PREFLIGHT_ENV_CONTRACT_ASSUMPTION_R1` 2회, broad `*.lock`을 controller exact lock으로 본 `R8_PREFLIGHT_BROAD_LOCK_PATTERN_R1` 1회다. 모두 서로 구분된 read-only orchestration 오류이며 product=false/runtime=false/action=0이다.
- 교정 final preflight PASS: application `f0d4bc7...` clean; active `/srv/anvil-wsl/control/stage.1059447.16378` HEAD/ref `fb311d45...` clean; control-runtime SHA exact; `/srv/anvil-wsl/.env` mode600/SHA `FECAE53B...52A79A`, immutable common.sh exact7 names once와 exact provider-read scope; probe SHA `932C996E...0C89`; process-local Playwright/Chromium present; container/network/volume/exact `.publish.lock` residue0다. 값은 출력·저장하지 않았다.
- actual one-shot: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 controller entry1, PG18RC0, outer-finally cleanup1 `exit0/PASS`, retry0. deploy stdout/stderr line `116/101`, SHA `F28B319B...AD68`/`456084BE...770E`; verify `6/4`, `26343A47...C95`/`073BBD58...227A`; cleanup `8/26`, `5B7E9FB1...737`/`D2B51978...6047`만 기록한다.
- PG15는 attempt counter 진입 뒤 secret-safe observation 할당 전 controller exception으로 종료됐다. fingerprint `BROWSER_OBSERVATION_CONTROLLER_EXCEPTION_R8`, diagnostic `BROWSER_RECEIPT_NOT_PERSISTED_R8`이다. native browser process 실행/exit, stdout/stderr line·hash, canonical receipt SHA, secret scan, safe parsed receipt, false predicate exact list는 보존되지 않아 `UNAVAILABLE`이며 추정하지 않는다.
- R7/R8은 동일 `BROWSER_RECEIPT_NOT_PERSISTED` evidence-capture lineage 누적2다. 제품 UI/API/SSE 실패는 확정되지 않았다. developer/runtime validation failure이지만 product failure=false다.
- post-cleanup app `f0d4bc7...` clean, env mode600/SHA byte-identical, control `fb311d45...` clean, container/network/exact-volume/publish-lock residue0. screenshot 저장 환경변수는 주입하지 않았고 probe code memory-only 정책상 filesystem screenshot mutation은 관측되지 않았다.
- current receipt4 backup2/verification2/rollback0 SHA는 `99190AC9...E4F7`, `96BD2FC8...C8DB2`, `A619FDF4...4775`, `0CE473C5...E4D3B`; image metadata2 SHA는 `18108107...E88B3`, `2E549E4B...32393`이다. raw/token/cookie/header/origin/secret literal과 screenshot binary/base64는 파일에 기록하지 않았다.
- focused 호출 payload에 duplicate malformed `yield_time_ms`를 넣은 `R8_FOCUSED_TOOL_ARGUMENT_SYNTAX_R1` 1회는 command 실행 전 도구 오류이며 product=false/runtime=false다. 올바른 호출에서 focused4 PASS했다.
- 첫 generated5 live checker는 seq668 PACKAGE_COMPLETED에 unchanged upstream binding이 빠져 `EVENT_EFFECT_MISMATCH`, exit1이었다. `R8_LIVE_CHECKER_EVENT_EFFECT_BINDING_R1` 1회, product=false/runtime=false이며 `completion_upstream_head`를 기존 repository remote head에 결박한 뒤 checker `PASS sequence=668 reporting=AUTO_CONTINUE`, exit0이다.
- 판정: `FAILED_R8_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음은 seq668 generated5/checker/determinism/single direct-child이며 push와 runtime 재실행은 하지 않는다.
- precommit generated5는 5개 materialize, 두 번 생성 byte equality와 materialized equality PASS다. seq662+668 focused `8 passed, 261 deselected in 1.57s`, live checker `PASS sequence=668 reporting=AUTO_CONTINUE`, `git diff --check` PASS, exact12/cumulative267 hash 계약 일치다. 장시간/full suite는 실행하지 않았다.
- secret-safe read-only scan은 actual credential value exact12 match0, R8 추가 line의 runtime origin literal0, screenshot base640이다. exact12 전체에서 보인 origin literal2는 이번 R8 diff가 아닌 기존 R6 test fixture line이며 새 raw origin 기록이 아니다.
- 미검증: PG15 native browser exit와 predicate, PG18RC browser, 독립 review. 다음: fresh final 동일 검증 뒤 parent `a1b67f4...`의 single direct-child exact12 commit을 생성하고 postcommit 확인한다. push는 금지한다.

## 2026-09-09 C-21 seq669~674 WSL authenticated browser runtime retry R9 final Developer successor — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-execution-fence-epoch-1-eadba5b`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-write-fence-epoch-1-eadba5b`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `eadba5bad0df3ea4f52e28b847ab20957217b6c5`, clean worktree, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- exact12 Windows/ordinal `C76DF85C02565072777A14B469396E5E56F001BD094051F546A9CF2C6AA3F003` / `E52F1859A1643A060D3D680554B111E54D7DDC7F05C543E0EE39B8F2C50036D5`; cumulative273 Windows/ordinal `BF167099DC8F21AC96258B041C333A9F19DC2426899EB140B48531FFA26A9D45` / `797C222A29F7B7D6F729D6DC2C3F06CE55586705AA0C8C01A6E42D9708806338`.
- 동일 evidence-capture lineage `BROWSER_RECEIPT_NOT_PERSISTED`는 R7+R8 count2다. seq1~668/historical evidence 및 제품/probe/deploy/`.env`는 불변이다.
- 다음: always-return phase envelope의 PASS/PROBE_ERROR/malformed/throwing-transformer synthetic4를 TDD RED/GREEN으로 고정한다. 네 건 모두 통과하기 전 actual runtime action count는0이다.
- synthetic4 TDD RED는 구현 부재로 `5 failed, 269 deselected`, GREEN은 `5 passed, 269 deselected`; PowerShell synthetic4도 case4/one-object4/raw·secret clear4/secret literal0, exit0 PASS했다. harmless local identical call-shape5도 PASS했고 WSL action count0이다.
- 실제 action 전 첫 controller payload는 `Invoke-R9Action'deploy'` tokenization으로 command 전 실패했다. `R9_ACTUAL_CONTROLLER_ACTION_CALL_TOKENIZATION_R1` 1회, product=false/runtime=false/action0이다. 후속 준비 중 서로 다른 pre-dispatch/read-only 오류 `R9_POST_TOKENIZATION_HEREDOC_POWERSHELL_PARSE_R1`, `R9_LOCAL_CALL_SHAPE_INTERPOLATION_PARSE_R1`, `R9_ACTION0_STATE_RECHECK_ESCAPED_SCRIPT_PARSE_R1` 각1회가 있었고 모두 product=false/runtime=false/action0로 교정했다.
- 교정 final preflight PASS: application `f0d4bc7...`/active control `fb311d45...` clean, env mode600/hash byte-identical/exact names+scope, initial residue0, probe/process-local browser dependency exact이다. secret 값은 출력하지 않았다.
- actual one-shot은 deploy1 뒤 safe native metadata의 `stdout_sha256=H native.stdout;stderr_sha256=H native.stderr`에서 `H`가 PowerShell `Get-History` alias로 해석됐다. `R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1` 1회, `ParameterBindingException`, category `GET_HISTORY_ID_CONVERSION_FAILURE`, failure step `SAFE_NATIVE_METADATA_HASH`다. verify/PG15/PG18RC는0, outer-finally cleanup1, retry0이다. deploy/cleanup exit 및 stream metadata는 envelope가 반환되지 않아 `UNAVAILABLE`이고 추정하지 않는다.
- 두 target backup receipt/image metadata 갱신은 deploy terminal boundary 근거다. current receipt SHA는 `140CCCFE...B6A0`, `96BD2FC8...C8DB2`, `17FD2E60...950A`, `0CE473C5...E4D3B`; image metadata는 `18108107...E88B3`, `2E549E4B...32393`이다.
- post-cleanup direct WSL `stat` 인용 1회 오류 `R9_POSTCLEANUP_DIRECT_WSL_STAT_QUOTING_R1`은 read-only false start/product=false/runtime=false다. ProcessStartInfo stdin 교정 관측은 app/control clean, env mode600/SHA byte-identical, container/network/exact-volume/lock residue0를 확인했다.
- 동일 evidence-capture lineage `BROWSER_RECEIPT_NOT_PERSISTED`는 R7+R8+R9 valid failure count3다. 제품 결함은 미확정이며 worker/write lease와 runtime tool ownership을 `REVOKED`, Developer execution을 `STOPPED`로 회수했다. 내부 TakeoverPacket next owner는 `MAIN_AGENT_SEQUENTIAL_TAKEOVER`; Subagent runtime/implementation retry를 금지한다.
- Main 상태 점검 오류 `MAIN_R9_STATUS_TRANSMISSION_TYPO_R1`, `MAIN_R9_COLLAB_TOOL_MISSING_MESSAGE_R1`, `MAIN_R9_READ_ONLY_EXEC_WORKDIR_TYPO_R1` 각1회는 product/runtime/Git impact=`NONE`, 즉시 교정됐고 Developer failure/capture lineage count에 포함하지 않는다.
- builder TDD RED `1 failed, 5 passed, 269 deselected`; seq674 failure projection/lease revoke/TakeoverPacket 구현 후 GREEN `6 passed, 269 deselected`다. 다음은 generated5/checker/determinism/exact12 single direct-child commit이며 runtime 재실행과 push는 금지한다.
- 첫 live checker는 capture lineage count3를 immutable failure ledger 갱신 없이 global `valid_failure_count`에 넣은 projection 때문에 `FAILURE_PROJECTION_MISMATCH`로 fail-closed했다. `R9_LIVE_CHECKER_FAILURE_LEDGER_PROJECTION_R1` 1회, product=false/runtime=false이며 global ledger projection은 역사 그대로 두고 count3를 diagnosis/internal TakeoverPacket에 결박해 교정했다.
- generated5 materialize5와 two-build/materialized equality, seq1~668 raw event prefix 보존 PASS. fresh seq668+674 focused `10 passed, 265 deselected in 1.23s`, live checker `PASS sequence=674 reporting=AUTO_CONTINUE`, exact12/cumulative273 metadata와 `git diff --check` PASS다. 다음은 single direct-child commit과 postcommit 확인이며 runtime 재실행/push/추가 Subagent execution은 금지한다.
- parent `eadba5b...`의 exact12 single direct-child commit을 생성했고 postcommit focused `10 passed, 265 deselected in 1.17s`, checker `PASS sequence=674`, generated5 two-build/materialized equality, direct path12, clean worktree를 확인했다. push/runtime 재실행은0이다. Developer execution은 종료하며 정확한 다음 조치는 `MAIN_AGENT_SEQUENTIAL_TAKEOVER_NO_FURTHER_SUBAGENT_EXECUTION`이다.

## 2026-09-09 C-21 seq675~680 R9 takeover correction — HUMAN_OVERRIDE lease

- 신산님의 명시 HUMAN_OVERRIDE `APPROVAL-20260909-C21-R9-TAKEOVER-CORRECTION-001`에 따라 rejected local commit `5162d358...`을 amend하지 않고 append-only exact13 correction을 시작했다. private remote는 `eadba5bad...`이며 runtime tool 권한은 회수 상태다.
- rejected dirty test precondition은 HEAD blob `ff09e953fc76d90111ea80b3d9b7d6bfe1177b93`, worktree blob `4a680574fcc4717cbf28179cb9817c8b438767df`, diff `9+/6-`, SHA-256 `F76536182CA6476489FA33F505C51669064F2689B998DF508B678FDCD067D492`로 모두 일치했다. apply_patch로 그 hunk만 역적용해 HEAD blob/clean을 복원했다.
- correction worker/write lease와 epoch1 fence를 parent `5162d358...` 및 exact13에 발급했다. exact13 Windows/ordinal `0CF50BDA...CB159` / `66B0CB35...AA9D`; cumulative280 Windows/ordinal `B4052844...EDFC` / `C8EAF5D6...F136`이다.
- reviewer C1/I1 교정: R7 parser PASS/native exit1, R8 native unconfirmed, R9 browser not executed로 단계와 root가 다르다. current correction은 세 exact root를 각1로 고정하고 historical broad grouping을 diagnostic symptom only/superseded로 분류한다. 기존 seq1~674/R9 artifact와 nested takeover packet은 historical bytes로만 보존한다.
- Main 협업 도구 unknown-field 오류 `MAIN_R9_CORRECTION_COLLAB_UNKNOWN_FIELD_R1` 1회는 product/runtime/Git impact=`NONE`, 즉시 교정됐고 Developer failure count에 포함하지 않는다.
- 다음: seq680 strict correction predicate를 RED로 고정하고 deterministic generated5/checker를 구현한다. runtime/WSL/product/external/amend/reset/checkout/clean/stash/force push는 실행하지 않는다.
- architect가 제안한 더 넓은 approval mode/classification으로 draft를 바꾸려던 apply_patch는 안전 심사에서 `governance weakening`으로 1회 거절됐다. `SEQ680_APPROVAL_BINDING_SAFETY_REVIEW_REJECTION_R1`은 product/runtime/Git impact=`NONE`이다. Main의 read-only governance 재검토는 기존 `mode=HUMAN_OVERRIDE`, `classification=R9_TAKEOVER_PROJECTION_CORRECTION_ONLY`가 schema 허용 범위의 더 좁은 least-privilege binding임을 확정했고, 거절된 변경을 재시도하지 않았다.
- seq680 strict predicate TDD RED는 correction constants/builder 부재로 `5 failed, 275 deselected`, exit1이다. builder 대형 append 첫 patch는 tail blank-line context 불일치로 변경0, `SEQ680_BUILDER_APPEND_CONTEXT_MISMATCH_R1` 1회/product=false/runtime=false였고 정확한 anchor로 분리 적용했다.
- metadata/anchors/approval/correction/root-map/lease/events/generated5 builder/manifest validator/Git collector/dispatcher 구현 뒤 seq680 GREEN은 `5 passed, 275 deselected in 7.70s`, exit0이다. 기존 seq674 checker/predicate/test source region strict equality도 포함한다.
- 다음: generated5 materialize, focused seq674+680, live checker, two-build/idempotence/exact13/cumulative280/diff-check 후 parent `5162d358...`의 sole direct-child commit을 생성한다. push 및 runtime/WSL/product/external action은 금지한다.
- generated5 첫 live checker는 correction lease/event contract와 recovery summary 필수 필드가 빠져 `EVENT_PAYLOAD_MISSING`, `HANDOFF_BASELINE_MISMATCH`, `HANDOFF_DIR_STATUS_MISMATCH`, `HANDOFF_FAILURE_COUNT_MISMATCH`, `HANDOFF_REPORTING_DECISION_MISMATCH`로 fail-closed했다. `SEQ680_LIVE_CHECKER_REQUIRED_FIELDS_R1` 1회, product=false/runtime=false이며 기존 seq674를 바꾸지 않고 correction worker/write fencing·path scope·accepted와 handoff baseline/DIR/failure/reporting binding만 보완했다.
- 첫 materialize 재실행은 linked worktree가 workspace sandbox 밖이라 `PermissionError`로 중단됐다. `SEQ680_MATERIALIZE_SANDBOX_DENIED_R1` 1회, generated partial write는 다음 deterministic materialize로 전부 덮였고 product/runtime/Git impact=`NONE`이다. 승인된 exact13 write 경계에서 generated5를 다시 materialize한 뒤 live checker `PASS sequence=680 reporting=AUTO_CONTINUE`, exit0을 확인했다.
- 현재 pending은 seq674+680 focused regression, two-build byte equality/materialize2 idempotence, exact13/cumulative280/diff-check와 sole-parent commit/postcommit이다. runtime/WSL/product/external action count는 계속0이며 push는 금지한다.
- precommit regression은 seq674+680 focused `11 passed, 269 deselected in 3.71s`, live checker `PASS sequence=680 reporting=AUTO_CONTINUE`, exit0이다. generated5 two-build/live byte equality와 materialize2 idempotence, exact13 13/13, cumulative280/4개 hash, historical event/R9 artifact anchors, self-manifest 제외 raw checksum12, `git diff --check`가 모두 PASS했다.
- 미검증: independent review 및 R10 successor 실행. 다음: 이 최종 기록을 generated5에 재결박하고 fresh verification 후 parent `5162d358...`의 sole direct-child commit을 생성한다. runtime/WSL/product/external/push는 실행하지 않는다.

## 2026-09-09 C-21 seq681~686 WSL authenticated browser runtime retry R10 result — 인수/lease

- Main의 seq680 independent review 후 R10 Developer successor 지시를 인수했다. parent/local/private record는 `27406570cbfbb89f19ee3a5d746687125d043d7e`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, branch `codex/c21-operational-execution`, 시작 worktree clean이다.
- 담당 `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-execution-fence-epoch-1-2740657`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-write-fence-epoch-1-2740657`를 exact12에 발급했다.
- exact12 Windows/ordinal `A517ED343E5509C56070AC53DFF2FA46DBF6E22AD0F87D4640A09EFBE748F39A` / `BE98A5D1DB7ED066EB01888326947F65E72D87615E0FE076EE2DC6796DE86836`; cumulative286 Windows/ordinal `38CF5747CE85C17EB7DB259E12B86E65B5AB32743E298B3E4A5573D9D33EE335` / `C67C1829358F575C435D47AD3953BDC636DD22F3CFF8CDDF9C2B816F72081ED2`다. seq1~680/historical evidence와 product/probe/deploy/`.env`는 byte-preserve한다.
- 실행 계약은 alias collision0, synthetic4, 동일 `Invoke-R10Process` harmless Node native hash/line/exit self-check, read-only preflight가 모두 PASS한 뒤 deploy1→verify1→PG15 browser1→strict PASS일 때 PG18RC browser1이며 outer-finally cleanup은 deploy 이후 정확히1, retry0이다. 짧은 alias와 `H`는 금지한다.
- Main orchestration 오류 `MAIN_SEQ680_REVIEWER_SPAWN_FORK_TURNS_ARGUMENT_REJECTED_R1` 1회와 `MAIN_SEQ680_CAS_PUSH_WORKDIR_REF_TYPO_SAFETY_BLOCKED_R1` 1회는 모두 external change0, product/runtime/Git impact=`NONE`, corrected다.
- startup read-only에서 `rg.exe`가 Windows execution boundary에서 거절된 `R10_STARTUP_RG_ACCESS_DENIED_R1` 1회와 broad `Get-ChildItem`이 기존 `.pytest_cache` 접근을 거절한 `R10_STARTUP_GCI_PYTEST_CACHE_ACCESS_DENIED_R1` 1회가 있었다. 모두 product/runtime/external action0이며 명시 경로 읽기로 교정했다.
- 다음: seq686 controller envelope/strict runtime validator를 RED로 고정하고 최소 GREEN 구현 후 self-check와 preflight를 수행한다. actual WSL action count는 현재0이다.
- seq686 TDD는 신규 metadata/envelope/native self-check/runtime success-failure validator 부재로 RED `6 failed, 280 deselected` 후 최소 구현 GREEN `6 passed, 280 deselected in 5.96s`, exit0이다. 기존 seq680 checker/test region byte-preserve assertion도 포함한다.
- controller 생성 첫 대형 patch는 hunk line prefix 누락으로 적용 전 거절됐다. fingerprint `R10_CONTROLLER_PATCH_HUNK_PREFIX_MISSING_R1` 1회, product/runtime/WSL/Git impact=`NONE`이며 작은 verified patch로 교정했다.
- 첫 self-check는 함수 scope에서 `$PSCommandPath`가 비어 controller AST source를 찾지 못한 `R10_SELFCHECK_PSCOMMANDPATH_FUNCTION_SCOPE_R1` 1회, 다음 self-check는 harmless Node payload가 LF 대신 literal escape를 출력한 `R10_NATIVE_SELFCHECK_NEWLINE_ESCAPE_R1` 1회였다. 둘 다 product/runtime/WSL impact=`NONE`, WSL action0이며 script-scope path와 실제 LF로 교정했다.
- 최종 controller self-check는 alias collision0/AST parse error0, synthetic4 one-object·secret-safe, harmless Node stdout/stderr 각 line1, SHA `BDF41A72...61058`/`FE050FD6...63F45`, fixed nonzero exit를 모두 PASS했다. actual dispatch용 early return을 제거해 outer-finally 이후 단일 envelope만 반환하고 raw/native/secret clear를 보강한 뒤 동일 self-check를 다시 PASS했다.
- self-check 명령 1회가 필수 `RepoRoot`/`PrivateUrl` 인자를 빠뜨려 process 시작 전 종료됐다. fingerprint `R10_SELFCHECK_REQUIRED_ARGUMENT_OMISSION_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 정확한 두 인자를 넣은 harmless self-check로 교정했으며 WSL action0이다.
- final escalated read-only preflight PASS: local/private parent `2740657...`, application `f0d4bc7...` clean, control `fb311d4...` clean, manifest/control-runtime/probe hash exact, env mode600/hash byte-identical/name+provider-read scope exact, initial residue0, process-local Playwright/Chromium presence를 확인했다. secret 값은 출력하지 않았고 WSL action count0이다.
- 승인된 one-shot actual의 최초 dispatch 요청은 sandbox 밖 실행 검토가 shared WSL service/data 영향에 대한 신산님 명시 승인을 요구해 `CreateProcess` 전에 거절됐다. fingerprint `R10_ACTUAL_PERMISSION_BOUNDARY_REJECTED_R1` 1회, product/runtime/WSL/Git/external impact=`NONE`; deploy/verify/PG15/PG18RC/cleanup 각0, retry0이다. 우회·재요청하지 않고 self-check/preflight 증거와 exact12 draft를 보존하며 Main의 permission-boundary 판정을 기다린다.
- 현재 상태는 `WAITING_EXPLICIT_R10_WSL_EXECUTION_APPROVAL`이다. worker/write lease는 R10 exact12 기록 범위에만 유지되고 runtime 실행은 정지 상태다. dirty path는 `docs/WORK_STATUS.md`, R10 report/WI, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`의 승인 대기 draft뿐이며 제품/probe/deploy/`.env` mutation0이다. 미완료는 실제 deploy/verify/PG15/조건부 PG18RC/cleanup, seq681~686 generated5/checker/determinism/exact12 commit/postcommit이다. 다음 조치는 신산님의 명시 R10 WSL 실행 승인 후 Main이 새 지시를 내리는 것이며 actual 재시도, 새 WSL action, Git commit/push는 그 전까지 금지한다.
- 신산님이 2026-09-09 Asia/Seoul에 response `계속하자`와 exact R10 실행 문구로 `DIRECT_USER_APPROVAL`을 부여했다. approval subject SHA-256은 `723A1D914C3540B7D4FF677C25C25DDA7CFF25ED7CD43ABF1E7D436D8B6426DC`다. scope는 immutable control `fb311d4...`, candidate `f0d4bc7...`, 격리 `anvil-wsl-pg15`/`anvil-wsl-pg18rc`의 deploy1/verify1/PG15 browser1/PG15 strict PASS 시 PG18RC browser1/finally cleanup1이며, 승인된 테스트 container/network/dedicated volume 정리만 포함한다. exclusions는 `.env`, 다른 Docker 자원, Provider/Telegram/Oracle/ysna/main/C-01 변경·실행이다. prior safety rejection은 pre-dispatch/action0으로 유지하고 `WAITING_EXPLICIT_R10_WSL_EXECUTION_APPROVAL`을 해제해 same R10 one-shot을 재개한다.
- 승인 후 재확인한 self-check와 escalated read-only preflight는 모두 PASS했다. app/control/env/residue가 직전 exact state와 같고 wsl action count0이며 deploy/verify/PG15/PG18RC/cleanup 각0임을 확인했다.
- actual R10 one-shot은 정확히 1회 종료했다: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/FAIL`, PG18RC0 `NOT_EXECUTED`, outer-finally cleanup1 `exit0/PASS`, retry0이다. controller exception은 `NONE`이며 모든 phase raw/secret memory clear를 확인했다.
- PG15 safe receipt는 `result=ACCEPTANCE_FAILED`, `runtime_execution=EXECUTED`, viewport pass2/3, provider read GET only, provider write0, cross-origin0, fixture0, Last-Event-ID exact, secret safety0, screenshot memory-only, filesystem mutation residue0이다. native exit1과 receipt ACCEPTANCE_FAILED는 일치한다. exact persisted false predicates는 `receipt.result==PASS`, `viewports.all_acceptance_predicates==true`, `native.exit_code==0`이다.
- safe transformer가 failing viewport name과 개별 false UI/SSE/accessibility field path를 보존하지 않아 raw가 clear된 뒤 재실행 없이 복구할 수 없다. 추정하지 않고 primary `BROWSER_ACCEPTANCE_FAILED_R10` count1, diagnostic `R10_SAFE_RECEIPT_VIEWPORT_PREDICATE_DETAIL_INSUFFICIENT_R1` count1로 분리한다. 이는 R9 hash alias root와 다른 새 root이며 takeover 조건이 아니다.
- post-cleanup read-only preflight PASS: application `f0d4bc7...`/control `fb311d4...` clean, `.env` mode600/hash `FECAE53B...A79A` byte-identical, exact container/network/dedicated-volume/lock residue0, probe/control/manifest hash exact이다. secret 값은 출력하지 않았다.
- current evidence SHA-256은 PG15/PG18RC backup `52F690C5...E9C3`/`97453E6C...906C`, verification `96BD2FC8...8DB2`/`0CE473C5...4D3B`, image metadata `18108107...E88B3`/`2E549E4B...32393`다. backup/evidence는 보존했다.
- evidence SHA read 첫 명령은 slug에 잘못된 `anvil-wsl-` prefix를 붙여 6개 path not found로 exit1이었다. fingerprint `R10_POSTEVIDENCE_PATH_SLUG_PREFIX_R1` 1회, read-only/product/runtime/WSL state impact=`NONE`; `common.sh`의 exact slug `pg15`/`pg18rc`를 읽어 동일 hash 수집을 교정했다.
- R10 재개 첫 skill read orchestration payload에 malformed JavaScript token이 포함돼 command 실행 전 거절됐다. `R10_SKILL_READ_EXEC_PAYLOAD_SYNTAX_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 올바른 payload로 required skill 3개를 완독했다.
- report typo 교정 첫 patch는 exact line context가 달라 변경0으로 거절됐다. `R10_REPORT_TYPO_PATCH_CONTEXT_MISMATCH_R1` 1회, product/runtime/WSL/Git impact=`NONE`; exact observed line의 작은 patch로 교정했다.
- 판정은 `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R10_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered다. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음은 seq686 failure generated5/checker/determinism/exact12 single direct-child이며 runtime 재실행과 push는 금지한다.
- seq686 builder TDD는 from-root builder 부재로 RED `1 failed, 286 deselected` 후 approval/runtime safe result/diagnosis/seq681~686/generated5/manifest/projection/Git collector를 구현해 GREEN `1 passed, 286 deselected`다.
- 첫 focused regression 명령은 파일 경로 뒤에 잘못된 token이 붙어 collection0/exit1이었다. fingerprint `SEQ686_FOCUSED_COMMAND_PATH_TOKEN_TYPO_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 정확한 selector로 `12 passed, 275 deselected in 3.17s`, exit0을 확인했다.
- 첫 live checker는 신규 lease event에 contract alias `fencing_token`/`path_scope`가 없고 PACKAGE_COMPLETED의 `completion_upstream_head`가 repository projection과 달라 `EVENT_PAYLOAD_MISSING`/`EVENT_EFFECT_MISMATCH`, exit1이었다. fingerprint `SEQ686_LIVE_CHECKER_EVENT_CONTRACT_BINDING_R1` 1회, product/runtime/WSL impact=`NONE`; 기존 seq680과 contract를 비교해 exact alias 및 historical upstream head만 보완한 뒤 checker `PASS sequence=686 reporting=AUTO_CONTINUE`, exit0이다.
- generated5는 5개 파일을 materialize했다. 다음은 fresh focused/checker, two-build/materialize idempotence, exact12/cumulative286/diff-check와 single direct-child commit/postcommit이다.
- precommit focused regression은 seq680+seq686 `12 passed, 275 deselected in 3.40s`, live checker `PASS sequence=686 reporting=AUTO_CONTINUE`, `git diff --check` PASS다. dirty/untracked는 선언된 exact12 12/12와 일치한다.
- generated5 two-build byte equality와 live materialized equality, materialize2 idempotence를 확인했다. exact12/cumulative286 Windows·ordinal hash는 각각 `A517ED34...8F39A`/`BE98A5D1...86836`, `38CF5747...EE335`/`C67C1829...1ED2`로 exact다.
- 미검증은 PG18RC browser와 exact failing viewport/field 및 independent review다. 다음은 이 최종 WORK_STATUS를 generated5에 재결박한 뒤 fresh focused/checker/determinism/diff/exact12 검증, parent `2740657...`의 sole direct-child commit과 postcommit이다. runtime 재실행/push는0으로 유지한다.
- fresh final verification은 focused `12 passed, 275 deselected in 3.51s`, live checker `PASS sequence=686`, generated5 two-build/live equality와 manifest raw checksum11 PASS, `git diff --check` PASS, parent HEAD `2740657...`, dirty exact12를 확인했다.
- 임시 controller 정리 첫 시도는 workspace sandbox가 `D:\tmp\anvil-r10-controller-2740657.ps1` 삭제를 거절했다. fingerprint `R10_TEMP_CONTROLLER_CLEANUP_SANDBOX_DENIED_R1` 1회, product/runtime/WSL/Git impact=`NONE`; exact resolved path를 승인된 경계에서 삭제해 residue0을 확인했다. 삭제 대상은 이번 실행용 임시 controller 한 개이며 복구하지 않는다.
- final status 묶음의 한 read-only Git 명령에 불필요한 pathspec token이 붙어 전체 dirty 표시 대신 제한된 clean 문구를 출력했다. fingerprint `SEQ686_FINAL_GIT_STATUS_PATHSPEC_TOKEN_TYPO_R1` 1회, product/runtime/WSL/Git mutation impact=`NONE`; 즉시 plain `git status --short`로 exact12 dirty 12/12와 HEAD `2740657...`을 재확인했다.

## 2026-09-09 C-21 seq687~692 R10 evidence correction — 인수/lease

- Reviewer I1을 수락하고 append-only R10 evidence correction을 시작했다. parent/local HEAD `c8c35cf92e72ea405b1a9171983c26407175c382`, private remote record `27406570cbfbb89f19ee3a5d746687125d043d7e`, 시작 worktree clean이다. seq1~686/R10 unique artifacts/current c8c commit을 보존하며 amend/rewrite/runtime/WSL/product/external action은 금지한다.
- 담당 `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-execution-fence-epoch-1-c8c35cf`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-write-fence-epoch-1-c8c35cf`를 exact12에 발급했다.
- exact12 Windows/ordinal `57AB57A282545B4BAC8FE729A04FE315DDDC6E58C69B30086093AFC5B60AC0EB` / `384AFFDE81E005F3882CB839D0E0A0DE4AD44EB64EE21B8DAF18264B132BC8A5`; cumulative292 Windows/ordinal `8F4C7FE3DE09BE70264AB38C01969B8B9B58E1D8C7A8EF572205FB6547FCC9B6` / `D814CFED8C979B0D89F90DA39497675578477C2FC5062585EB21F3480BE3913E`를 repository helper로 재확인했다.
- review 판정은 C0/I1/M0다. historical R10 safe receipt의 `provider_row_count=0`, `groq_detail_clicked=false`는 viewport pass2/3만으로 지지되지 않는다. historical bytes는 그대로 두고 effective projection에서 두 필드만 `UNAVAILABLE_NOT_PERSISTED`로 교정한다. 그 외 safe receipt/false predicates/native exit/result는 strict preserve한다.
- Main의 read-only hash precheck path typo `EVIDENCE_CORE_CORRECTION` 1회는 product/runtime/Git impact=`NONE`이며 exact `R10_EVIDENCE_CORRECTION` path set으로 즉시 helper recompute PASS했다.
- 다음: seq692 predicate를 TDD RED로 고정한 뒤 correction generated5/checker를 구현한다. runtime/WSL/product/external0, push0을 유지한다.
- seq692 TDD RED는 correction API/marker 부재로 `4 failed, 287 deselected`; metadata/anchors/review/effective correction/leases/events/generated5/manifest validator/projection/Git collector/dispatcher 구현 후 GREEN `4 passed, 287 deselected in 4.73s`다.
- generated5 materialize 후 seq686+seq692 focused `11 passed, 280 deselected in 2.54s`, live checker `PASS sequence=692 reporting=AUTO_CONTINUE`, `git diff --check` PASS, dirty/untracked exact12 12/12를 확인했다.
- generated5 two-build byte equality/live equality와 materialize2 idempotence PASS, raw checksum11, exact12/cumulative292 hash exact이다. existing seq686 checker/test region strict equality와 seq1~686/R10 unique artifact anchors도 PASS했다.
- status `READY_R10_EVIDENCE_CORRECTION_FOR_INDEPENDENT_REVIEW`, next `INDEPENDENT_REVIEW_R10_EVIDENCE_CORRECTION_BEFORE_R11`; runtime/WSL/product/external action0, accepted=false다. 다음은 이 final status를 generated5에 재결박하고 fresh verification 후 parent `c8c35cf...`의 sole direct-child commit/postcommit이다. push는 Main이 수행한다.

## 2026-09-09 C-21 seq693~698 WSL authenticated browser runtime retry R11 result — 인수/lease

- parent/local/private record `da7ab71ea14bbe0db2c41d114ca4b97c1109404b`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, 시작 worktree clean이다. seq1~692 및 R10/correction unique artifacts를 byte-preserve한다.
- 담당 `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r11-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r11-result-execution-fence-epoch-1-da7ab71`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r11-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r11-result-write-fence-epoch-1-da7ab71`를 exact12에 발급했다.
- exact12 Windows/ordinal `BD8C7FF87D4FD1C49FE860678C0F7AD99EEF72F64BA21B7B66F3857486CA1FA4` / `234500925F1410C7F9F591950E1AAD03B0013E64E00CE092D07C3057832B319E`; cumulative298 Windows/ordinal `F573D2A1061D34AC512697AF6249D0CB0C0459F890B945B2B5225E20DBE39A35` / `7110CBD9CCB68D8785C80B8ECE96677FCAF4638DDB91D68CBFCDA3E2CAD5669C`를 repository helper로 재확인했다.
- controller 계약: safe receipt에 expected viewport3의 name/width/height와 9 boolean을 보존하고 screenshot subtree/path/hash/binary는 제외한다. receipt/native/consistency false predicate 배열은 분리하고 ordinal unique exact path를 사용한다. targeted mobile keyboard false, reversed multi-false, wrong/missing schema, transformer exception synthetic을 fail-closed한다.
- 실행 계약: R10 alias/synthetic/native self-check regression과 R11 controller gate, read-only preflight PASS 후 deploy1→verify1→PG15 browser1→strict PASS 시 PG18RC browser1, deploy 후 outer-finally cleanup1, retry0. 첫 failure 뒤 conditional phase는 중단하며 제품 원인은 추정하지 않는다.
- 다음: seq698 controller/safe receipt contract를 TDD RED로 고정한다. runtime/WSL action은 현재0이다.
- seq698 focused TDD는 신규 safe transformer/controller metadata 부재로 RED `6 failed, 291 deselected` 후 expected viewport3 identity+9 boolean, screenshot subtree 제외, receipt/native/consistency false predicate 분리, targeted mobile keyboard/reversed multi-false/wrong·missing schema/transformer exception fail-closed를 구현해 GREEN `6 passed, 291 deselected in 6.22s`, exit0이다.
- 첫 PowerShell controller self-check는 native/WSL dispatch 전 parser가 viewport identity string의 닫는 괄호를 문자열 내부에 포함해 `The string is missing the terminator`로 종료됐다. fingerprint `R11_CONTROLLER_VIEWPORT_IDENTITY_STRING_TERMINATOR_R1` count1, product/runtime/WSL/Git impact=`NONE`; exact 발생문을 확인한 뒤 닫는 괄호 위치 한 곳만 교정했다. actual action count는 deploy/verify/PG15/PG18RC/cleanup 각0이다.
- 첫 교정 확인을 Windows PowerShell 5.1 host에서 실행해 `ConvertFrom-Json -AsHashtable` 비지원 때문에 throwing-transformer gate로 오분류된 `R11_SELFCHECK_HOST_VERSION_MISMATCH_R1` count1이 있었다. pwsh 7.6.5 exact host로 실행해 targeted/reversed/schema/transformer와 R10 alias/native regression이 모두 PASS했고 product/runtime/WSL/Git impact는 `NONE`이다.
- preflight/actual dispatcher 추가 후 self-check parser가 actual PG15 outer if-block의 닫힘 누락을 `Try statement is missing its Catch or Finally block`로 fail-closed했다. `R11_CONTROLLER_ACTUAL_IF_BLOCK_UNCLOSED_R1` count1, native/WSL dispatch0·product/runtime/Git impact=`NONE`; line-level brace balance를 확인해 누락 한 곳만 교정했다.
- 첫 escalated read-only preflight는 compound bash command가 WSL intermediate shell에서 command substitution을 sudo 이전에 평가해 control/`.env` permission error로 fail-closed했다. `R11_PREFLIGHT_COMPOUND_BASH_INTERMEDIATE_EXPANSION_R1` count1, runtime action0·product/Git/WSL state impact=`NONE`; secret 없는 step markers와 root/path mode를 확인하고 direct argv read-only 호출들로 교정했다.
- direct argv preflight는 app/env/residue를 exact로 확인했지만 `/srv/anvil-wsl/control`을 Git root로 간주해 `wsl.control_exact_clean`에서 fail-closed했다. read-only `find`/`active` 관측으로 실제 immutable repo root가 `/srv/anvil-wsl/control/<active-stage>`임을 확인했다. `R11_PREFLIGHT_CONTROL_ACTIVE_STAGE_ROOT_R1` count1, runtime action0·state impact=`NONE`; active namespace를 엄격한 `stage.<digits>.<digits>`로 검증한 뒤 그 root에서 commit/ref/clean을 비교하도록 교정했다.
- final pwsh controller gate는 alias collision0/AST parse0, synthetic6 targeted mobile keyboard/reversed multi-false/wrong·missing schema/throwing transformer, R10 harmless native known hashes를 모두 PASS했다. active-stage-aware escalated preflight도 local/private `da7ab71...`, app `f0d4bc7...` clean, control `fb311d4...` head/ref clean, env mode600/hash/name/scope exact, control-runtime/probe hash exact, initial residue0로 PASS했다.
- R11 actual one-shot은 정확히 1회 종료했다: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/ACCEPTANCE_FAILED`, PG18RC0 `NOT_EXECUTED`, outer-finally cleanup1 `exit0/PASS`, retry0, controller exception `NONE`이다. runtime 재실행은 금지한다.
- PG15 exact failure는 `mobile-430x844`(430×844)의 `safe_receipt.viewports[2].documentHorizontalOverflowZero==true` false다. desktop 2개는 각 9/9 true이고 mobile은 해당 항목 외 8개가 true다. receipt false는 `receipt.result==PASS`와 위 exact path, native false는 `native.exit_code==0`, consistency false는 빈 배열이다. native exit1과 receipt `ACCEPTANCE_FAILED`는 일치하며 제품 원인은 추정하지 않는다.
- request contract provider read GET-only/write0/cross-origin0/fixture0/Last-Event-ID exact는 PASS했다. secret scan/sentinel/auth header/cookie/raw URL occurrence0, raw stdout/stderr·token·origin·exception message persisted0, screenshot subtree/path/hash/binary persisted0, filesystem mutation residue0이다. Provider external/Telegram/Oracle/ysna/main/C-01은 `NOT_EXECUTED`다.
- post-cleanup read-only preflight PASS: app/control/`.env` exact clean, container/network/dedicated-volume/lock residue0다. accepted=false, C-21/C-01 blocked, DIR-2 not triggered이며 primary `BROWSER_ACCEPTANCE_FAILED_R11` count1이다.
- seq698 builder TDD는 builder API 부재로 RED `3 failed, 297 deselected` 후 actual runtime/safe receipt/diagnosis/seq693~698 lease+events/generated5/manifest validator/Git collector를 구현해 GREEN `3 passed, 297 deselected`; 전체 seq698 focused는 `9 passed, 291 deselected in 11.55s`다.
- 첫 builder focused 명령은 PATH에 없는 bare `python`을 호출해 pre-test 종료됐다. `SEQ698_FOCUSED_PYTHON_COMMAND_UNAVAILABLE_R1` count1, product/runtime/WSL/Git impact=`NONE`; repository `.venv\Scripts\python.exe`로 교정했다.
- generated5 materialize 후 live checker `PASS sequence=698 reporting=AUTO_CONTINUE`, exit0이다. 다음은 final WORK_STATUS 재결박, focused seq692+698 regression, two-build/materialize2 determinism, exact12/cumulative298/diff-check, parent `da7ab71...` sole direct-child commit/postcommit이다. runtime 재실행/push는0으로 유지한다.
- precommit focused seq692+698 regression은 `13 passed, 287 deselected in 5.26s`, live checker `PASS sequence=698 reporting=AUTO_CONTINUE`, generated5 two-build/live byte equality와 materialize2 idempotence가 PASS했다. raw checksum11, exact12 12/12와 cumulative298의 Windows/ordinal hash는 각각 `BD8C7FF8...A1FA4`/`23450092...B319E`, `F573D2A1...E39A35`/`7110CBD9...5669C`로 exact이고 `git diff --check` PASS다.
- dirty/untracked는 선언된 exact12 12/12와 일치하며 seq1~692/R10+correction unique artifacts와 product/probe/deploy/`.env`는 byte-preserve다. 다음은 이 final status를 generated5에 재결박하고 fresh focused/checker/determinism/diff/exact12를 확인한 뒤 parent `da7ab71...`의 sole direct-child commit/postcommit을 생성하는 것이다. runtime 재실행과 push는 금지한다.
- precommit diff summary 첫 read-only 호출은 workdir 문자열 오타로 process 생성 전 `CreateProcess error 267`에 fail-closed했다. fingerprint `R11_PRECOMMIT_DIFF_WORKDIR_TYPO_R1` count1, product/runtime/WSL/Git impact=`NONE`; 정확한 canonical workdir로 교정하며 runtime 재실행은0이다.
- exact12 stage 첫 시도는 linked worktree Git index가 workspace sandbox 밖 `D:\Project\Anvil\.git\worktrees\...`에 있어 `index.lock Permission denied`로 변경 전 거절됐다. fingerprint `SEQ698_GIT_STAGE_SANDBOX_INDEX_LOCK_DENIED_R1` count1, product/runtime/WSL/Git state impact=`NONE`; 승인된 exact12 Git write 경계에서 동일 explicit path stage를 수행한다.

## C-21 Final Acceptance Projection Reconciliation — planned successor

- 기준: historical seq1~698 raw event와 historical evidence는 byte-preserve한다. deployed product source `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`, record/development ref `2db9eff352d32d60638ae9bf7c9dae153c862be8`이며 `2db9eff`는 `7b7e7cc`의 direct child다.
- 예상 successor event: seq699 `MAIN_PACKAGE_ACCEPTED`, subject `C-21`, `accepted=true`, `blocking_findings=0`, `next_work_package=C-01`, `next_package_status=READY_FOR_WORK_INSTRUCTION`, `DIR-2=NOT_REACHED`.
- 예상 exact path set: `docs/04_test_reports/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_RESULT.md`, `docs/WORK_STATUS.md`, `docs/evidence/manifests/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/progress-handoff-detached-digest-c21-final-acceptance-projection-reconciliation.json`, `docs/validation/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_VALIDATION.md`, `docs/work_orders/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_INVOCATION_PROMPT.md`, `docs/work_orders/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_WORK_INSTRUCTION.md`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`.
- 외부 Provider probe와 Telegram 실제 호출은 `USER_OWNED_NOT_EXECUTED`로 보존하며 PASS로 승격하지 않는다. same-origin secret-safe Network receipt는 재배포 없이 read-only browser capture 또는 기존 receipt/UI evidence의 분리로만 결박한다.

### BLOCKED — automated final acceptance persistence denied

- RED contract `test_seq699_final_acceptance_projection_contract_is_available`은 checker API 부재로 예상대로 `AttributeError` 실패했다. 공유 Python 및 `-p no:cacheprovider`를 사용했다.
- 이후 `MAIN_PACKAGE_ACCEPTED`와 `C-01 READY_FOR_WORK_INSTRUCTION`을 historical evidence만으로 영속화하는 checker 구현은 자동화 안전 경계에서 거절됐다. 동일 결과를 우회 구현하지 않았다.
- WSL/원격/DB/Provider/Telegram/배포/Git commit·push action은 0이다. provisional WorkInstruction/Invocation/Result/Validation과 RED test는 회수했다. 다음 조치는 해당 governance state transition을 명시적으로 허용하는 최종 승인이다.

### RESUMED — 신산님 explicit approval binding

- 신산님은 2026-09-09에 seq1~698/historical evidence 보존, 실제 완료된 WSL/UI/API/SSE 증거만으로 seq699 `MAIN_PACKAGE_ACCEPTED`와 C-01 `READY_FOR_WORK_INSTRUCTION`을 projection에 영속화하도록 명시 승인했다. 이는 승인된 C-21 successor이며 신규 기능·요구·중요위험 확장이 아니다.
- Provider external probe와 Telegram actual invocation은 `USER_OWNED_NOT_EXECUTED`로 유지한다. same-origin은 historical authenticated UI/API/SSE receipt와 current CSP `connect-src 'self'`/absolute-host source scan 0를 분리해 기록한다.
- RED 재확인 `1 failed, 300 deselected` 후 metadata/builder/manifest/Git predicate/adversarial contract를 구현해 focused GREEN `3 passed, 300 deselected in 6.53s`다. WSL/원격/DB/Provider/Telegram/deploy action은 계속 0이다.
- 최종 tooling one-shot `D:\\tmp\\anvil-c21-operational-execution\\.venv\\Scripts\\python.exe -m pytest tests\\tooling -q -p no:cacheprovider`는 초기 stdout `10%` 뒤 75분 동안 완료하지 않았다. parent PID `195396`(CPU 0)와 worker PID `199716`(CPU `2468.94`, 단일 thread, 계속 증가)을 read-only 관측한 뒤 Main의 75분 지시에 따라 두 PID를 종료했고 종료 확인했다. one-shot의 exit/result는 tool stream 분리로 회수할 수 없어 PASS로 판정하지 않는다.
- 파일 단위 binary split 진단: 전반 `a01~a11`은 `122 passed in 15.64s`; 후반 `a12~project_progress`는 18 dots 후 01:35 active라 종료했다. `a12~a14`는 19 dots 후 00:59 active라 종료했고, `a12` 단독은 `6 passed in 0.40s`; `a13` 단독은 16 dots 후 01:08 active라 종료했다. `a13 -k remote_credentials`는 `1 passed, 64 deselected in 7.74s`다. 사실상 장기 구간은 `test_a13_repository_scan.py`이며 module fixture가 `git clone --local --no-hardlinks`를 수행한다. 이 clone/65-test fixture 비용이 원인이라는 것은 추정이며, production/WSL/remote/DB/Provider/Telegram/deploy mutation은 0이다.
- 진단 중 잘못된 unittest node-id 2회는 `not found`/`no tests ran`으로 즉시 종료했고, 올바른 `-k remote_credentials`로 교정했다. 다음: generated evidence를 이 상태 기록에 재결박한 뒤 focused, checker, diff/exact12를 재확인한다. full tooling은 장기 원인 분리 전 재실행하지 않는다.
- 재결박 후 첫 focused selector `-k c21_final_acceptance_projection`는 `303 deselected`여서 검증 PASS로 사용하지 않았다. unittest class selector로 교정한 exact seq699 contract/adversarial 3개는 `3 passed in 2.12s`; live checker는 `PASS sequence=699 reporting=AUTO_CONTINUE`; generated5 two-build equality와 `git diff --check`, dirty/untracked exact12 12/12도 PASS다. commit/push는 계속 0이다.
- `BLOCKED_HISTORICAL_TEST_ENVIRONMENT`: A13 collect-only는 65개를 0.09초에 수집했다. Foundation `5 passed in 9.89s`, Integration의 4개를 함수 단위로 `24.24s/12.23s/10.54s/11.76s`, Hostile `8 passed in 18.85s`, Artifact 전반 24개 `24 passed in 13.57s`로 확인했다. Artifact 후반은 15/24 dots 뒤 60초 상한에서 종료했고, 정확한 다음 함수 `A13RepositoryScanArtifactTests::test_checker_cli_reports_exact_counts`는 별도 60초 상한에서도 완료 결과를 출력하지 않은 채 parent/worker가 종료했다. 이 함수는 historical checkout의 `check_a13_repository_scan.py`를 child subprocess `timeout=60`으로 실행한다. 함수 변경·skip은 하지 않았다.
- read-only 환경 근거: A13 `setUpModule`은 현재 worktree `ROOT`를 temp repository로 `git clone --local --no-hardlinks --no-checkout`한다. historical commit `38832955...`의 tracked blob은 634개/3,402,046 bytes이고, target checker는 8개 fixture를 materialize→scan한다. 현재 common Git object store는 `53.01 MiB`(count 3,181)로 관측됐다. local no-hardlinks clone과 8-fixture scanner/I/O 비용이 60초 초과를 유발한다는 것은 추정이며, 확정 사실은 위 exact historical test가 60초 내 verdict를 회수하지 못했다는 것뿐이다. 이는 seq699 변경과 무관한 historical test environment blocker이고 C-21 source/test에는 변경0이다.
- seq699 자체는 WORK_STATUS 재결박 뒤 exact class focused/checker/determinism/diff/exact12를 다시 실행한다. full tooling은 `BLOCKED_HISTORICAL_TEST_ENVIRONMENT`가 해소되기 전 재실행하지 않으며, full PASS로 표시하지 않는다.
- 60초 직후 diagnostic runner를 종료하려던 `Stop-Process`는 parent PID가 snapshot과 command 사이에 이미 종료되어 `Cannot find a process`를 반환했다. 즉시 재관측에서 parent/worker 모두 `EXITED`였으며 mutation/잔여 process는 0이다. 이는 historical test verdict를 회수하지 못한 사실을 바꾸지 않는다.
- 재개 지시: historical 정상 실행 환경과 동일한 PowerShell process env `TEMP=D:\\tmp`, `TMP=D:\\tmp`, `PYTHONUTF8=1`, `PYTHONDONTWRITEBYTECODE=1`로 shared Python과 `-p no:cacheprovider`를 사용한다. 순서는 exact historical checker-CLI test 단독 → A13 전체 → tooling full one-shot 1회이며, canonical A13 source/fixture 변경·skip은 금지한다. 정상 검증은 60초 diagnostic ceiling이 아니라 test 자체 contract timeout을 따르고, 30분 CPU/stdout 무변화 전에는 중단하지 않는다.
- 정상-env A13 exact historical checker-CLI 단독은 `2026-09-10T01:46:57+09:00` 시작, `TEMP/TMP=D:\\tmp`, `PYTHONUTF8=1`, `PYTHONDONTWRITEBYTECODE=1`을 child에 명시했으며 `1 passed in 40.93s`, exit0, wall `41.79s`로 종료했다. prior 60초 ceiling 관측은 동일-volume temp가 아닌 diagnostic environment 차이로 인한 것으로 확정하지 않고, 이 정상-env result로 supersede한다. 다음 A13 전체를 동일 조건으로 1회 실행한다.
- 정상-env A13 전체는 `2026-09-10T01:48:20+09:00` 시작하여 동일 env/공유 Python/`-p no:cacheprovider`에서 `65 passed in 105.65s`, exit0, wall `108.17s`로 종료했다. stdout은 56→60→65로 증가했고 CPU/output 무변화 중단 조건은 발생하지 않았다. canonical A13 test/fixture 변경·skip은 0이다. 다음은 tooling full one-shot 1회다.
- full tooling 실패 분리 중 `ProjectProgressContractTests` index `79..130` 파티션은 14개 PASS 후 약 47분 동안 추가 stdout 없이 worker CPU가 계속 증가했다(`193060`, 마지막 관측 CPU `2692.50s`, `Responding=True`). 진단 파티션의 45분 실용 상한으로 종료했으며 pytest exit/verdict는 회수하지 못했다. WSL/DB/Provider/Telegram/deploy/Git mutation과 임시 residue는 0이다.
- 마지막 PASS 다음 정확한 node는 `tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_c21_provider_wsl_execution_resume_collector_fails_closed`로 `-vv` 단독 격리를 시작했다. 동일 정상 env·공유 Python·`-p no:cacheprovider`를 유지하고 20분 상한에서 원인 및 종료 verdict를 회수한다.
- 위 exact node 단독은 `2026-09-10T03:35:28+09:00`부터 20분 동안 node id 이후 추가 stdout이나 PASS/FAIL verdict 없이 worker CPU가 계속 증가했다(`179188`, 중간 관측 CPU `939.70s`, `Responding=True`). 20분 진단 상한으로 종료했고 parent/worker 종료 및 residue 0을 확인했다. 판정은 `NO_VERDICT_CPU_ACTIVE_AT_DIAGNOSTIC_LIMIT`이며 test PASS/FAIL로 집계하지 않는다.
- faulthandler 10초 stack은 위 node가 checker에 진입하기 전 `_execution_resume_fixture`의 `tempfile.TemporaryDirectory(..., dir="D:/tmp")` → stdlib `tempfile.mkdtemp` line 391 → `random.py`에서 CPU-active였음을 확정했다. 현재 restricted runner가 `D:\tmp` mkdir/write를 `PermissionError`로 막지만 `os.access(D:\tmp, W_OK)`는 true여서 Windows tempfile가 기존 이름 충돌로 오판하고 `TMP_MAX` 후보를 반복한 환경 원인이다. fingerprint `SEQ699_PYTEST_TEMP_SANDBOX_PERMISSION_RETRY_LOOP_R1` affected execution count6; product/checker/test/WSL/DB/external/Git state impact=`NONE`이다.
- 코드 수준 추적에서 seq533 bundle은 seq699 `_validate_git_projection` 분기에 진입하지 않는다. 승인된 temp-write 권한에서는 fixture `0.208s`, baseline validator `0.001s`, 모든 missing/post mutation도 각각 `<0.001s`였으므로 seq699 checker 상호작용 가설은 기각했다. 이 원인에 대한 source/test 수정·skip·완화는 0이다.
- 동일 env와 실제 `D:\tmp` write 권한에서 exact node 재검증은 `1 passed in 0.48s`, exit0이다. 이어 index `79..130` 52-node 실패 파티션은 `52 passed in 254.04s`, exit0으로 종료했다. 진단용 임시 별도 파일 생성은 0이고 report에 임시 append했던 stack/timing marker는 제거해 exact12 밖 잔여 0을 확인한다.
- historical failure1 `test_c21_independent_judgment_projection_is_blocked_not_accepted`는 current worktree에 존재하지 않는 sibling untracked seq496 file을 runtime dependency로 읽어 `FileNotFoundError` RED였다. expected SHA `67B7D70633DECA23FD5716EA7902AE30FB043AD082AC55B4DA4459C825D66460`과 exact historical 5,779 bytes를 `tests/tooling/test_project_progress.py` 내부 압축 fixture로 고정했고 관련 7개는 `7 passed in 61.38s` GREEN이다. historical bytes/hash/검증 의미/skip 변경0, exact12 밖 fixture0이다.
- historical failure2 `test_c21_provider_status_read_review_successor_accepts_only_exact_record_projection`는 seq513 historical artifact에 seq699 current repository projection을 섞어 `GIT_DESCENDANT_PROJECTION_INVALID`를 만들었다. 해당 method만 frozen commit `b85d2b48e14f513e326054bc0be28009f269a827` bundle을 사용하도록 교정했고 `1 passed in 6.98s` GREEN이다.
- temp-write 정상 권한 full tooling one-shot은 exit1, `2 failed, 669 passed in 950.42s (0:15:50)`다. seq699-related failure는 `test_git_and_authority_bindings_are_checked_against_workspace`가 mutated `validated_base_commit`에서 기존 expected `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 찾지 못한 것이다. 원인은 event699 전용 Git collector의 early return이 projected base를 검사하지 않은 데 있으며, exact record 불일치 시 기존 error로 fail-closed하는 최소 조건을 추가했다. 기존 full RED 후 focused `1 passed in 3.16s`, seq699 class `3 passed in 4.83s` GREEN이다.
- full tooling의 나머지 1 failure는 seq699 무관 A14 historical test `A14WorkbenchArtifactTests::test_browser_source_has_only_relative_api_calls_and_no_sensitive_literals`다. expected는 `browser_source_findings(...) == []`지만 scanner forbidden regex `https?://|localhost|127\.0\.0\.1|NEXT_PUBLIC_|host\.docker|container`가 committed `apps/web/src/app/app-shell.js:43,57`의 identifier `container`를 `internal-address`로 오탐하고, fetch rule이 literal `/api/` 또는 `apiPath(...)`만 허용해 line72 `fetch(READY_PATH, ...)`를 `non-relative-fetch`로 판정한다. A14 code/test/app-shell은 exact12 밖이며 변경·skip·완화0이다.
- 현재 판정은 `REVIEW_READY_WITH_UNRELATED_TOOLING_FAILURE`다. seq699 exact12를 all-tooling-complete로 보고하지 않으며, A14 1 failure는 Main review concern으로 명시한다. 다음은 generated5 재결박 후 relevant ProjectProgress partition, live checker, determinism/exact12/diff-check를 fresh 검증하는 것이다.
- latest Result/WORK_STATUS/checker를 generated5에 재결박한 뒤, current bundle·generic Git contract·seq496/seq513/seq533 historical fixes를 포함하는 `ProjectProgressContractTests` index `0..130` 131-node relevant partition은 `131 passed in 379.22s (0:06:19)`, exit0이다. failure marker와 skip/완화는 0이다.
- Main ruling: exact15 expansion은 A14 false-positive test integrity repair로 분류한다. 추가 경로는 `scripts/check_a14_workbench_prototype.py`, `tests/tooling/test_a14_workbench_prototype.py`, `docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json` 세 개뿐이며, cost if wrong: 3-path audit-surface rework다.
- 첫 exact15 checker/manifest/Git dual-state apply_patch는 플랫폼이 직접 승인 부족으로 1회 거절했다. 원문은 `이 패치는 승인된 exact12·seq699 범위를 exact15로 확장하고 Git projection의 검증 조건을 바꾸는 지속적 거버넌스 변경이며, 해당 범위 확대에 대한 사용자 승인이 없습니다.`이며 우회·재시도 없이 중단했다.
- 신산님은 직전 exact15 승인 요청에 직접 `계속하자`라고 응답했다. 이를 exact12→exact15, 위 additive 3 paths, seq1~698 및 prior A14 manifest/R5 byte 보존, A14 오탐 수정, committed-clean R6 binding, seq699 precommit/postcommit dual-state 검증의 명시적 진행 승인으로 결박한다. push/WSL/원격/DB/Provider/Telegram은 계속 0으로 유지한다.
- A14 TDD RED는 existing browser source false-positive, safe root-relative constant fixture, missing R6 registry로 `3 failed in 2.24s`였다. bare DOM `container`를 forbidden address token에서 제거하고 scanned source 전체에서 exact one `READY_PATH` declaration이 single-slash root-relative이며 `://`가 없을 때만 identifier fetch를 허용했다. unresolved/protocol-relative/absolute cases는 계속 fail-closed하며 scanner focused `2 passed in 2.15s`, additive R6 live binding `1 passed in 2.11s` GREEN이다.
- seq699 exact15 TDD RED는 metadata count `12 != 15`와 postcommit child rejection 두 건(`2 failed in 2.56s`)이었다. metadata/generated manifest checksum contract를 exact15/14 non-self rows로 확장하고 Git collector를 precommit dirty exact15 at `2db9eff` 또는 postcommit clean sole direct-child changed exact15만 허용하도록 구현했다. 기존 projected base mismatch는 `GIT_VALIDATED_BASE_NOT_ANCESTOR`로 먼저 fail-closed하며 exact15/dual-state focused `2 passed in 2.57s` GREEN이다.
- precommit focused는 A14 module + seq699 class + historical Git regression `16 passed in 20.08s`, app-shell Node test `3 passed`다. Node는 package `type` 미지정 ES module reparse warning만 출력했고 failure0이다. product app-shell source 변경0, historical manifest/R5 bytes 변경0이다.
- generated5 exact15 materialize 후 fresh precommit focused는 `16 passed in 20.21s`; live checker `PASS sequence=699 reporting=AUTO_CONTINUE`; two-build/live byte equality, seq1~698 raw prefix, manifest non-self checksum14, exact15 dirty paths, record direct parent/ancestor와 `git diff --check`가 모두 PASS다. exact15 Windows/ordinal path hash는 `D06C8F4158A914042DA3C0688BC5829D7B6F2D94DDEDFEF18F27AEC6FD7B336E` / `DE7B86332907781913506C1C74B2066EAA4EAF74EAF00378866FA587803D4187`다.
- precommit 판정은 `PRECOMMIT_GATES_PASSED_COMMIT_PENDING`이다. 다음은 이 최종 status/result를 generated5에 재결박하고 동일 deterministic/checker/diff/exact15 gate를 확인한 뒤, HEAD `2db9eff`의 sole direct child인 single exact15 commit을 생성한다. push/WSL/원격/DB/Provider/Telegram은 0이다.
- single exact15 commit `86e0d76ba257f8a7b18ff2c0999df9d00883fb9a`를 parent `2db9eff352d32d60638ae9bf7c9dae153c862be8`의 sole direct child로 생성했다. staged/committed path는 exact15 15/15였고 push는0이다.
- 첫 postcommit A14 standalone은 R6 registry 자체의 tracked-clean/predecessor/script/test hash는 모두 exact였지만 `checksum:` 10개로 RED였다: `apps/web/index.html`, `apps/web/server.mjs`, workbench JS/client/state/CSS/test, browser runtime test, A14 checker/test. 원인은 R6 registry가 older A15/B03 successor rows보다 먼저 적용되어 이후 stale rows에 덮였고, R6가 live scanner/test 2개만 결박해 나머지 current live A14 rows를 최종 선택하지 못한 것이다. fingerprint `A14_R6_SUCCESSOR_FINAL_SELECTION_ORDER_R1` count1; product/historical/WSL/external impact=`NONE`이다.
- R6 registry exact live-row coverage test는 2-row registry로 RED `1 failed in 3.75s`였다. R6를 older projections 뒤 committed-clean final selection으로 적용하고 current A14 live 10 rows를 predecessor R5/historical manifest에 additive binding했다. current app/product bytes 변경0이며 scanner+safe path+R6 focused는 `3 passed in 3.50s` GREEN이다. single-commit 요구를 유지하기 위해 기존 unpublished commit을 exact15로 amend한 뒤 postcommit standalone을 재검증한다.
- R6 final-selection 보완 후 amend 전 fresh focused는 A14+seq699+historical Git `16 passed in 19.77s`, app-shell `3 passed`, generated5 two-build/live equality와 diff-check PASS다. unpublished single commit을 `1cbda7e72265197f06c3f1a7012d2f9144addee7`로 amend했고 sole parent `2db9eff...`, clean changed paths exact15 15/15를 확인했다.
- postcommit A14 standalone은 `A-14 WORKBENCH CHECK: PASS paths=17 self_reference=false`, full tooling one-shot은 `675 passed in 1012.49s (0:16:52)`, exit0이다. 이어 live checker `PASS sequence=699 reporting=AUTO_CONTINUE`, `git diff --check`, clean status가 PASS했다. 첫 full `669 passed, 2 failed`의 두 failure는 모두 닫혔다.
- 위 final evidence를 status/result에 결박한 뒤 generated5를 재materialize하고 동일 single commit을 마지막 amend한다. 최종 commit에서 A14 standalone, focused seq699, full tooling, live checker와 exact15 clean sole-child를 fresh 재검증하며 push/WSL/원격/DB/Provider/Telegram은 0이다.
- Main fresh range diff는 `docs/04_test_reports/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_RESULT.md:32: new blank line at EOF.` 1건을 발견했다. fix round 1/5로 Result의 EOF 빈 줄만 제거하고 이 교정 근거를 Result/WORK_STATUS에 기록한다. scanner/checker/test logic은 최종 full tooling `675 passed in 958.55s` 이후 변경하지 않으며, docs evidence와 deterministic generated5 checksum binding만 갱신하므로 full tooling은 재실행하지 않는다. 동일 single commit amend 후 range diff, seq699 focused, A14 standalone, live checker, clean sole-child exact15를 fresh 재검증한다.

## 2026-09-10 C-21 seq699 task review fix round 1/5

- review base `ab5c03afc695af03d836c79a735d8e9baabffca2`에서 canonical state/private authority/whitespace 신규 테스트는 `3 failed in 3.45s` RED였다. builder가 `next_work_package`와 `next_successor_work_package`를 모두 `C-01 / READY_FOR_WORK_INSTRUCTION`으로 투영하고 `completed_packages`에 `C-21`을 append하도록 수정했다. validator는 세 assertion 중 하나라도 모순이면 `C21_FINAL_ACCEPTANCE_CANONICAL_STATE_INVALID`를 추가한다.
- seq699 collector는 `development` URL exact `git@github-sinsan-develop:sinsan-develop/Anvil.git`과 full `for-each-ref` row `refs/remotes/development/candidates/c21-wsl-acceptance-auth-r1 2db9eff352d32d60638ae9bf7c9dae153c862be8`를 검증한다. URL/ref missing, mismatch, contaminated multi-row output는 `GIT_PRIVATE_AUTHORITY_MISMATCH`; precommit whitespace는 `git diff --cached --check`, postcommit은 `git diff --check 2db9eff..HEAD`로 fail-closed한다. 기존 `GIT_VALIDATED_BASE_NOT_ANCESTOR` 선행 계약은 유지한다.
- review-base A14 scanner는 block-comment declaration, function-parameter shadow, `'/\\x2fexample.invalid/ready'` 세 입력을 모두 finding0으로 잘못 통과했다(`[[], [], []]`). comment/string/template lexical mask, exact top-level canonical literal declaration, escape/`//`/`://` 배제, same-file exact named binding, 잔여 identifier ambiguity 판정을 추가했고 unbound cross-file use도 거부한다. direct adversarial/safe GREEN, current browser findings `[]`, A14+seq699+historical Git focused `18 passed in 15.30s`, app-shell `3 passed`다.
- restricted runner로 잘못 시작한 A14 두 검증은 기존 `D:\tmp` permission retry 현상으로 장기 CPU active가 되어 본인이 시작한 PID `197268/187196/162888/197940`만 종료했고 residue0을 확인했다. 승인된 temp-write로 즉시 재실행해 PASS했다. inline Python quoting 오류 1회는 command execution 전 PowerShell parse 실패이며 literal here-string으로 교정했고 product/repo 영향0이다.
- 변경은 exact15 내부만이며 historical seq1~698와 A14 R5 bytes 변경0이다. 당시 남았던 R6/generated5/docs 재결박, postcommit A14/full tooling/live checker/range diff/private ref/clean sole-child 검증은 같은 round에서 후속 완료했다. push/WSL/remote write/DB/Provider/Telegram은0이다.
- generated5 첫 materialize는 sandbox 밖 worktree write가 `PermissionError`로 1회 거절되어 생성 파일 write0에서 중단됐고, 승인된 exact15 write로 재실행해 5개를 deterministic materialize했다. exact stage 첫 명령은 WorkInstruction 경로 오타로 exit1이었으며, 곧바로 명시 exact15 목록으로 재실행해 unrelated stage0과 `git diff --cached --check` PASS를 확인했다. 보조 R6 확인 PowerShell pipeline parse 오류 1회도 단순 foreach 출력으로 교정했고 repository 영향0이다.
- round-1 postcommit state는 parent `2db9eff...` sole child, status clean, range exact15였다. postcommit focused `18 passed in 14.24s`, A14 standalone `PASS paths=17 self_reference=false`, live checker `PASS sequence=699 reporting=AUTO_CONTINUE`, generated5 two-build/live equality, seq1~698 prefix, development URL/ref exact, ancestor/sole-parent와 range diff-check가 모두 PASS했다. mutable final commit SHA는 self-reference를 피하기 위해 문서에 결박하지 않는다.
- round-1 logic 변경 후 필수 fresh full tooling one-shot은 동일 정상 env와 승인된 `D:\tmp` temp-write에서 exit0, `677 passed in 954.99s (0:15:54)`, failure marker0이었다. 결과를 Result/WORK_STATUS와 generated5 checksum에 재결박한 뒤 focused/A14/live/determinism/exact15/authority/diff/clean을 당시 current HEAD에서 재검증했다.

## 2026-09-10 C-21 seq699 task review fix round 2/5

- current-head generated progress에서 `repository.head_relation=PRECOMMIT_EXACT12_SUCCESSOR_PROJECTION`, `worktree_status=SEQ698_R11_RESULT_EXACT12_DIRTY`가 재현됐다. 신규 builder/validator assertions는 `2 failed in 5.46s` RED였다. builder를 SHA self-reference 없는 `POSTCOMMIT_EXACT15_SOLE_DIRECT_CHILD_OF_RECORD`/`CLEAN`으로 교정하고, 둘 중 하나라도 stale이면 기존 next-work/next-successor/completed assertions와 함께 `C21_FINAL_ACCEPTANCE_CANONICAL_STATE_INVALID`로 fail-closed한다.
- A14 exact reviewer nodes는 nested declaration 앞 regex `/}/`가 brace count를 상쇄하는 case와 template `${...}` 내부 protocol-relative shadow/use를 모두 finding0으로 통과해 `2 failed in 2.78s` RED였다. root cause는 regex literal 미구분과 template interpolation 전체 masking이다.
- scanner는 comments/strings/regex/template text를 position-preserving mask하되 `${...}` code를 재귀 tokenization하고, brace depth/malformed structure를 보수적으로 검사하도록 교체했다. exact top-level literal declaration 또는 exact named import와 unshadowed fetch만 허용한다. R6 scanner/test raw hashes 재결박 후 A14+seq699 focused `19 passed in 16.14s` GREEN이다.
- exact15/seq1~698/A14 R5를 보존한다. postcommit A14/seq699/historical Git focused `20 passed in 16.55s`, A14 standalone PASS, live checker PASS, app-shell `3 passed`, deterministic generated5, exact15 range/authority/clean/sole-parent/ancestor/diff-check가 PASS했다.
- scanner logic 변경 뒤 full tooling fresh one-shot은 exit0, `679 passed in 967.03s (0:16:07)`, failure marker0이다. 이 결과를 docs/generated checksum에 결박한 뒤 logic 변경 없이 final current HEAD의 focused/A14/live/determinism/range/authority/clean을 재검증한다. mutable final SHA는 self-reference를 피하기 위해 Result/WORK_STATUS에 쓰지 않는다.
- determinism 보조 명령 1회는 inline Python 식별자에 잘못된 문자가 들어가 `NameError`로 exit1이었다(`SEQ699_R2_DETERMINISM_COMMAND_TYPO_R1`, count1). 같은 read-only predicate를 즉시 정확히 재실행해 PASS했고 repository/product/runtime/external impact는0이다.
- push/WSL/DB/Provider/Telegram/external write는 계속0이며 Provider/Telegram actual은 `USER_OWNED_NOT_EXECUTED`다.

## 2026-09-10 C-21 seq699 task review fix round 3/5 — Main Agent takeover

- A14 `READY_PATH` scope 판정의 동일 근본 원인 우회가 독립 review에서 세 번째로 확인됐다. 이번 exact input은 control statement 뒤 regex character class `/[}]/`, `/[{]/`가 raw brace depth를 상쇄해 nested declaration/use를 finding0으로 통과시켰다. 오류 횟수=`3`; 영향은 scanner 무결성 gate이며 제품 source, WSL, DB, Provider, Telegram, remote state 변경은0이다.
- 프로젝트의 동일 오류 3회 규칙에 따라 `developer-primary`를 중단하고 Main Agent가 write lease를 인수했다. 새 branch/worktree는 생성하지 않았고 기존 exact15 sole-child 구조에서만 수정한다.
- exact reviewer input을 계약 테스트로 먼저 추가해 `1 failed in 4.38s` RED를 확인했다. scanner는 일반 JavaScript parser라고 추측하지 않고, `READY_PATH` 포함 source에서 comment/string/template/인식된 regex masking 후 slash가 남으면 scope 추론 불명확으로 fail-closed하도록 제한했다. 신규 회귀 포함 A14 전체는 `14 passed in 10.20s` GREEN이며 canonical live browser-source test도 포함한다.
- stale pending-final 문구는 최종 증거로 해석되지 않도록 superseded 사실로 교정했다. R6/generated5 재결박, exact15 amend, postcommit focused/A14/live/full tooling/authority/diff/clean 재검증을 같은 브랜치에서 이어간다.
- scanner-bearing postcommit의 최종 검증은 A14/seq699 focused `20 passed in 17.56s`, A14 standalone `PASS paths=17 self_reference=false`, progress checker `PASS sequence=699 reporting=AUTO_CONTINUE`, app-shell `3 passed`, full tooling fresh `680 passed in 1071.45s (0:17:51)`, exit0이다. 이 결과로 위 pending 상태를 supersede하며 C-21은 `MAIN_PACKAGE_ACCEPTED`, C-01은 `READY_FOR_WORK_INSTRUCTION`이다.
- 최종 문서/checksum 재결박은 scanner/checker/test logic을 변경하지 않는다. 최종 증거는 symbolic current exact15 HEAD, development authority/ref, sole-parent/ancestor, range diff와 clean predicate에 결박하며 mutable self-referential commit SHA는 문서에 넣지 않는다. Provider/Telegram actual은 `USER_OWNED_NOT_EXECUTED`, push/WSL/DB/external action은0이다.
# 2026-09-10 C-21 post-merge development authority reconciliation — seq700 TDD RED

- 단계: `C-21 / POSTMERGE-DEVELOPMENT-AUTHORITY-RECONCILIATION`
- 담당 agent: `developer-primary`
- 상태: `IN_PROGRESS_TDD_RED`
- 시작 branch/HEAD: `codex/c21-postmerge-authority-reconcile` / `931b32418924de11626949b9303360696d614fb0`
- 개발 정본: `git@github-sinsan-develop:sinsan-develop/Anvil.git`, `refs/remotes/development/main`
- 변경 파일: exact12 한정; 현재 test/WI/prompt/result/validation/WORK_STATUS부터 작성
- TDD RED: seq700 focused `3 failed, 306 deselected`, exit 1
- 오류 fingerprint/count: `SEQ700_BUILDER_COLLECTOR_ABSENT_R1` / 1회
- 원인: seq700 builder/collector/dispatcher 부재
- 불변: seq1~699 event object와 historical evidence, C-21 accepted, C-01 ready, DIR-2 not reached
- 미검증: focused GREEN, checker CLI, diff/history/checksum
- 외부 미실행: Provider/Telegram actual은 `USER_OWNED_NOT_EXECUTED`; network/WSL/Docker/DB/deploy/push/PR/merge/branch delete는 `NOT_EXECUTED`
- 다음 조치: exact12 범위에서 builder/validator/collector/dispatcher 최소 구현 후 deterministic projection 생성·검증

## seq700 TDD GREEN checkpoint

- 구현: canonical `REPOSITORY_RECONCILED` event, deterministic builder/from-root, strict manifest/projection validator, seq700 dispatcher, 3-state Git collector
- focused GREEN: `3 passed, 306 deselected`, exit 0
- 삭제된 `refs/remotes/development/candidates/c21-wsl-acceptance-auth-r1` 조회·존재 요구: 0
- 현재 상태: `COMPLETED_PENDING_INDEPENDENT_REVIEW`; projection 생성과 live checker/diff 검증 대기

## seq700 live checker checkpoint

- focused 최종: `4 passed, 306 deselected`, exit 0
- live checker: `G-05 project progress contract: PASS sequence=700 reporting=AUTO_CONTINUE`, exit 0
- 보완 오류 fingerprint/count: `SEQ700_COMMON_EVENT_HANDOFF_CONTRACT_MISMATCH_R1` / 1회; 필수 repository payload와 HANDOFF status 정합화 후 해소
- 환경 오류: generated exact5 D:\tmp write 거부 1회; 시스템 승인된 동일 generator로 해소, 정식 failure 미산입
- 변조 거부: development URL/ref, baseline merge parents, a03/2db parent, ancestor, dirty/path, branch/upstream, merged parent/path
- 다음 조치: 문서 변경을 포함해 exact5 재생성 후 py_compile, focused, checker, exact12, seq1~699 byte prefix를 최종 확인하고 Main 독립 review로 인계

## seq700 independent review rework round 1/5

- reviewer findings: Important 2 (`origin/main` merged upstream 완화, unstaged/untracked precommit checksum 우회)
- TDD RED: `1 failed, 3 passed, 306 deselected`, exit 1
- 오류 fingerprint/count: `SEQ700_REVIEW_R1_PRECOMMIT_INDEX_INCOMPLETE` / 1회
- 조치 1: merged main upstream을 `development/main` exact로 제한하고 `origin/main` negative 계약 추가
- 조치 2: precommit은 cached name-only exact12, unstaged name-only empty, untracked empty, status exact12, cached diff-check PASS 모두 요구
- GREEN: `4 passed, 306 deselected`, exit 0
- 현재 상태: exact12 명시 stage와 live checker/digest/history 재검증 대기

### Review R1 최종 staged 검증

- exact12 staged: PASS; unrelated staged 0, unstaged 0, untracked 0
- cached diff-check: PASS
- syntax: PASS
- focused: `4 passed, 306 deselected`, exit 0
- live checker: `PASS sequence=700 reporting=AUTO_CONTINUE`, exit 0
- deterministic generated5: PASS
- seq1~699 raw event prefix: `2155312` bytes / `209446EEDCAE056F25E788701A0E12D76B487EBD20D52644C14D151FAC0C1D83`, byte-identical
- 상태: `COMPLETED_PENDING_INDEPENDENT_REREVIEW`; commit/push/external action 미실행

## seq700 independent review rework round 2/5

- reviewer finding: Important 1, precommit negative 독립성 부족
- 조치: cached path 1개 누락 / unstaged nonempty / untracked nonempty / cached diff-check failure를 table/subTest 네 행으로 분리하고 각 행은 한 조건만 변조
- status path mismatch negative: 기존 별도 계약 유지
- production RED: 없음; production collector 동작은 이미 올바르므로 테스트 gap 보완 직후 focused `4 passed, 306 deselected`, exit 0
- 명령 오류: 첫 검증 호출의 workdir/token 구성 오류 1회, target mutation 0, 동일 근본 원인 반복 0, 정식 failure 미산입
- 다음 조치: generated5 checksum 재결박, exact12 restage, focused/checker/history/determinism/cached diff-check 최종 재검증

## seq700 systematic rework round 3/5

- Main 전체 tooling: `681 passed, 3 failed in 1155.62s`
- exact node RED: 3 failures, exit 1
- `SEQ488_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` 1회: seq488 test repository를 current copy가 아닌 frozen explicit fixture로 격리
- `SEQ700_VALIDATED_BASE_REASON_CODE_REGRESSION_R1` 1회: seq700 projected base mismatch에 `GIT_VALIDATED_BASE_NOT_ANCESTOR` 복원 및 전용 regression 추가
- `SEQ699_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` 1회: seq699 collector bundle repository를 exact historical fixture로 격리
- 세 exact node GREEN: `3 passed`, exit 0
- 기존 seq488/seq699 production 계약 완화: 없음
- 테스트 locator class 오기 1회: exit 4/test 0/mutation 0, 정식 failure 미산입
- full tooling 재실행: Main 수행 경계라 미실행
- 최종 검증: 세 exact node `3 passed`; seq700 focused `4 passed, 306 deselected`; checker `PASS sequence=700 reporting=AUTO_CONTINUE`; exact12 staged, unstaged 0, untracked 0; cached diff-check/history/determinism PASS
- 상태: `COMPLETED_PENDING_INDEPENDENT_REREVIEW`; Main이 full tooling을 재실행

## seq700 최종 독립 review·tooling 마감

- 담당 agent: Main 검증 + read-only diagnostic + independent reviewer + `developer-primary` evidence writer
- 독립 review round 3 판정: `PASS`; findings `Critical 0 / Important 0 / Minor 0`
- 실행 환경 오류 fingerprint/count: `TOOLING_TMP_SANDBOX_PERMISSION_R1` / `1회`. restricted sandbox full tooling은 `D:\tmp` 임시 디렉터리 생성에 요구되는 권한이 없어 A14 `tempfile.mkdtemp` 노드에서 `61.8분` 정체한 후 Main이 중단했다.
- 영향/분류: 제품·checker·round3 회귀가 아닌 시스템 권한 오류다. valid product/checker failure count는 증가시키지 않았다.
- read-only escalated 진단: A14 exact node `1 passed in 5.35s`; A01~A13 `193 passed in 119.04s`.
- Main escalated full tooling: `684 passed in 1113.60s (0:18:33)`, exit `0`.
- Main checker CLI 인자 오류 fingerprint/count: `CHECKER_CLI_POSITIONAL_ROOT_INVOCATION_R1` / `1회`. `python scripts/check_project_progress.py --root .`를 호출해 positional root가 `--root`로 해석되어 `LOAD_ERROR ...\--root\docs\progress\build-progress.json`가 발생했다. 제품/checker valid failure count는 불변이며, 정확한 `python scripts/check_project_progress.py .`는 `PASS sequence=700 reporting=AUTO_CONTINUE`다.
- 변경 파일: seq700 exact12 유지; `scripts/check_project_progress.py` 및 `tests/tooling/test_project_progress.py` 로직은 최종 증거 재결박 단계에서 변경하지 않음.
- 미실행 범위: Provider/Telegram actual `USER_OWNED_NOT_EXECUTED`; network/WSL/Docker/DB/deploy/push/PR/merge/branch delete `NOT_EXECUTED`.
- 최종 evidence rebind 검증: seq700 focused `4 passed, 306 deselected`; live checker `PASS sequence=700 reporting=AUTO_CONTINUE`; generated5 two-build/live equality, manifest checksum 11행, seq1~699 raw prefix `2155312` bytes / `209446EEDCAE056F25E788701A0E12D76B487EBD20D52644C14D151FAC0C1D83` PASS; exact12 staged, unstaged/untracked 0, cached diff-check PASS.
- 상태: `COMPLETED`; commit/push/merge는 Main Agent 후속 경계다.
# 2026-09-10 C-01 product correction — developer-primary

- 판정: `COMPLETED` (Main Agent 검토·독립 acceptance projection 전 Developer 구현/기본 검증 완료)
- Work Package/기준선: `C-01`, branch `codex/c01-mainline-reconciliation`, BASE/시작 HEAD `e215c0612363050dbe20315646f1612f31b8cdc0`, 시작 status clean
- worker lease: `worker-lease-c01-product-correction-20260910-001`; execution fencing token: `c01-product-execution-fence-epoch-1-e215c06`
- write lease: `write-lease-c01-product-correction-20260910-001`; write fencing token: `c01-product-write-fence-epoch-1-e215c06`
- 기준 hash: design `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`; work plan `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`; matrix `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`; test plan `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`; corrective brief `5F9F3DD6454ED7C223BBC69176EACC2E6E16069CF6E9245E55326E4B58C37178`; pre-revision WorkInstruction `D594FC661D3E54D905C64B0AEDEB8E53644832EB9F2FE5C17A2B0CA5A3014DF3`
- 시작 기준선: `.venv\Scripts\python.exe -m pytest tests\llm_gateway\test_c01_kernel.py tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider` → exit 0, `10 passed in 0.77s`
- TDD RED 준비 오류: 신규 symbol의 module-level import가 collection을 중단해 exit 1이었고, import를 test body로 지연해 assertion RED로 교정했다. fingerprint `C01_NATIVE_ADAPTER_IMPORT_COLLECTION_R1`, 1회, 제품/외부 영향 0.
- 의미 있는 TDD RED: `.venv\Scripts\python.exe -m pytest tests\llm_gateway\test_c01_kernel.py tests\orchestration\test_c01_native_agent_adapter.py -q -p no:cacheprovider` → exit 1, `9 failed, 5 passed in 0.36s`; 빈 capability 기본값 오염, noncanonical/step-derived request ID, 동일 Step 두 번째 Provider 호출, evidence 부재, 별도 Native Coding Agent lifecycle boundary 부재를 각각 재현했다.
- 최소 GREEN: 같은 focused 명령 → exit 0, `14 passed in 0.31s`.
- C-21 호환: `.venv\Scripts\python.exe -m pytest tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider` → exit 0, `4 passed in 0.70s`; 기존 LLM-provider `NativeAgentAdapter.probe/generate` 호출 계약 유지.
- 변경 전→후: explicit `set()` capability가 암묵적 `text_generation`으로 바뀜→empty 유지; kernel request ID가 Step 고정값→호출별 canonical UUID; 동일 Step 재호출이 Provider에 도달→기존 reservation binding에서 사전 거부; 예산 결과 evidence 없음→ordered secret-free reserve/reconcile evidence; coding-agent lifecycle 경계 없음→별도 opaque Protocol 추가.
- 변경 경로: `docs/work_orders/C-01_WORK_INSTRUCTION.md`, `docs/WORK_STATUS.md`, `docs/04_test_reports/C-01_IMPLEMENTATION_RESULT.md`, `packages/llm_gateway/contracts.py`, `packages/orchestration/__init__.py`, `packages/orchestration/kernel.py`, `packages/orchestration/native_agent_adapter.py`, `tests/llm_gateway/test_c01_kernel.py`, `tests/orchestration/test_c01_native_agent_adapter.py`.
- 제외/미검증: network, 실제 Provider, Telegram, DB, API, browser, WSL, deployment, secret/외부 환경 mutation은 `NOT_EXECUTED`; C-02+ DelegationPacket/Developer lifecycle/validation 의미 변경 0; canonical progress/event/HANDOFF/checker 수정 0; commit/push/merge 0.
- 오류 횟수: 정식 제품 실패 0; RED 수집 구조 오류 1회(해소); compileall sandbox 환경 오류 1회(승인된 재실행으로 해소).
- 남은 acceptance: Main Agent diff/범위 검토와 별도 독립 Tester의 AV-AGT-002, AV-AGT-003, AV-OPS-011 판정 및 canonical projection은 후속 reviewed task가 소유한다.
- rollback: 이 worktree의 위 변경 경로 diff만 역적용한다. 사용자 dirty/untracked, 다른 tracked path, canonical progress/history에는 손대지 않는다.
- 최종 통합 기본 검증: `.venv\Scripts\python.exe -m pytest tests\llm_gateway tests\orchestration\test_c01_native_agent_adapter.py tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider` → exit 0, `18 passed in 0.76s`.
- compileall 환경 오류: 기본 sandbox에서 `packages/.../__pycache__/*.pyc` 쓰기가 거부되어 exit 1. fingerprint `C01_COMPILEALL_DTMP_SANDBOX_WRITE_DENIED_R1`, 1회, 코드/제품 failure가 아니다. 지정 worktree 내부 쓰기 승인으로 같은 compileall을 재실행해 exit 0, output 0을 확인했다.

## 2026-09-10 C-01 mainline acceptance projection — developer-primary

- 단계/상태: `ACCEPTANCE_PROJECTION_VALIDATING`; Main의 C-01 local fixture scope acceptance 기록을 수행한다.
- 시작: `D:\tmp\anvil-main-integration`, branch `codex/c01-mainline-reconciliation`, clean HEAD `f56ac2514d0c5bca41768e456ed57f2036ab3137`; BASE `e215c0612363050dbe20315646f1612f31b8cdc0`의 sole direct child 및 product exact9 확인.
- worker/execution: `worker-lease-c01-mainline-acceptance-20260910-001` / `c01-mainline-acceptance-execution-fence-epoch-1-f56ac25`.
- write/token: `write-lease-c01-mainline-acceptance-20260910-001` / `c01-mainline-acceptance-write-fence-epoch-1-f56ac25`; exact17 한정.
- 기준 문서: 설계 `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`, 계획 `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`, matrix `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`, test plan `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` 실측 일치.
- product WI는 `C-01_WORK_INSTRUCTION` path stem alias / SHA `F99FE2D6C009E7B897130DD3802460258F5CF406BE973DA0939D49DAA5E367A5`. Main 판단에 따라 기존 본문을 바꾸지 않고 exact ID/path/hash를 invocation과 manifest에 결박한다.
- 독립 자료: code review SPEC PASS / QUALITY APPROVED C0/I0/M0, hash `476E911CDB044ECDE80578EA0724E49EDC85A3117A74CC3820D56403AE66DBCB`; Tester 18 passed/0 failed/0 skipped, hash `EA461AD96A247A477FD096DB22B96E0713B8D7C2782DFFD2B4A6779539310973`. 별도 event707/708로 보존한다.
- seq701~706 product lifecycle, 707 code review, 708 independent Tester, 709~714 projection lifecycle, 715 Main acceptance. 이전 seq1~700/historical evidence는 byte-preserve 대상이다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k C01MainlineAcceptance -q -p no:cacheprovider` → exit 1, `5 failed, 310 deselected in 1.54s`.
- 최소 GREEN: 같은 명령 → exit 0, `5 passed, 310 deselected in 9.40s`.
- 변경 전→후: acceptance builder/collector 없음 → 결정론적 raw fixture·projection 생성과 staged/clean feature/two-parent merge 세 상태의 exact9/exact17/cumulative25 검사. 일반 projection 허용 조건은 넓히지 않고 event715와 sequence715 dispatcher만 추가한다.
- 변경 경로: `C-01_MAINLINE_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md`의 exact17. 제품 Python/test/WI/result 경로 변경 0, WORK_STATUS만 새 기록을 추가한다.
- 오류: `C01_RG_LAUNCHER_UNAVAILABLE_R1` 1회, PowerShell 대체 성공. 정식 제품 실패 0. TDD RED는 예상된 실패로 별도 집계한다.
- 미검증: full tooling은 Main 후속 gate. actual coding backend/Provider/network/Telegram/DB/API/browser/WSL/deployment/persistent external Event/Release/user acceptance는 NOT_EXECUTED.
- 다음: generated7 생성 → live checker/history/hash/determinism/exact17 staged → focused/syntax/cached diff 검증 → Main review에 인계. commit/push/merge/외부 작업/Subagent 생성 금지.
- rollback: product commit 위 이번 exact17 diff만 역적용한다. 기존 seq1~700와 historical evidence·사용자 자료·다른 worktree를 보존한다.

### C-01 acceptance projection focused 검증 마감

- systematic-debugging으로 인접 seq700 collector test failure를 추적했다. 기존 테스트가 `load_bundle(ROOT)`로 새 seq715 현재 repository를 읽어 old BASE guard에 걸렸다. frozen seq700 fixture로 최소 교정하고 production seq700 collector는 보존했다.
- `SEQ700_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` 1회: 인접 첫 실행 `1 failed, 14 passed, 300 deselected in 29.13s`, exit 1.
- `C01_CURRENT_PROJECTION_STALE_BASE_AND_FAILURE_R1` 1회: 새 builder가 과거 repository.baseline_merge_parents와 active failure를 상속했다. 추가 RED `1 failed, 2 passed, 314 deselected in 6.88s`; 현재 BASE parents와 C-01 failure0/null을 명시하여 GREEN `3 passed, 314 deselected in 6.26s`. historical 실패 합계31과 ledger는 보존한다.
- 최종 focused와 인접 회귀: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k 'C01MainlineAcceptance or C21PostmergeDevelopmentAuthorityReconciliation or C21FinalAcceptanceProjectionReconciliation' -q -p no:cacheprovider` → exit 0, `17 passed, 300 deselected in 36.45s`.
- `C01_RAW_EVIDENCE_PARENT_MISSING_R1` 1회: generator가 새 `docs/evidence/raw` 부모 폴더 부재로 중단했다. 지정 경로 부모 생성 후 generated7을 재생성하여 해소했다. 부분 생성물도 deterministic 재생성으로 일치시켰다.
- 첫 live checker: `.venv\Scripts\python.exe scripts\check_project_progress.py .` → exit 0, `PASS sequence=715 reporting=AUTO_CONTINUE`.
- raw/history 감사: generated7 two-build/live 동일, manifest16 checksum, historical evidence272파일 byte 동일, seq1~700 raw prefix2157757 bytes/hash `60EF142108978724C37E395B5B5C39FDE6504B65F7F5FFDEE336F41E5E937692`, seq1~700 semantic 동일, checker/test syntax compile PASS.
- 오류 fingerprint 각각1회, 정식 제품 FAILURE_REPORT 0. full tooling·future 실제 feature commit·GitHub merge·외부 runtime은 미실행이다. 세 Git 상태는 focused controlled Git receipt로 검증했다.
- 다음: 최종 문서와 generated checksum 재결박, exact17 restage, live checker/exact-scope/determinism 재확인 뒤 Main review 인계.

### C-01 acceptance projection 최종 인계

- 판정: `COMPLETED` — writer의 exact17 projection 구현·focused 검증 완료. Main의 fresh full tooling 및 독립 review는 다음 단계다.
- 마감 검증: live checker `PASS sequence=715 reporting=AUTO_CONTINUE`; generated7 two-build/live byte equality; manifest16 raw checksum; seq1~700 raw/semantic 동일과 새701~715 Event 순서/hash chain; product exact9 sole parent BASE; staged exact17 및 누적25; unstaged0/untracked0; checker/test syntax compile; `git diff --cached --check` 모두 exit 0/PASS.
- historical evidence272파일 불변, current HEAD `f56ac2514d0c5bca41768e456ed57f2036ab3137` 유지. commit/push/merge/외부 실행 0. 다음: Main이 exact17 diff·증거를 독립 검토하고 fresh full tooling gate를 수행한다.

### C-01 acceptance R2 — 독립 시나리오 결함·제품 fix 이후 재결박

- 담당 `developer-primary`, 상태 `ACCEPTANCE_R2_VALIDATING`. HEAD `66c0e43a092215ea2e9be24606d7a28e10dff359`, sole parent `f56ac2514d0c5bca41768e456ed57f2036ab3137`, 최초 product parent `e215c0612363050dbe20315646f1612f31b8cdc0`. 이전 acceptance 변경은 미커밋으로 보존했고 역사1~700는 불변이다.
- Main 승인 실측 산식: 최초 product9 + fix2 = occurrence11, product unique9, projection18, WORK_STATUS 한 경로만 중복이므로 누적26. 독립 `tests/verification/test_c01_independent_acceptance.py`를 기존 exact17에 포함하고 원문 SHA `641FB690DDAA138D64522DFC66B0FB178D53FB3EBE22B3301497632A4A15A569`를 보존한다. 제품 Python/test/WI/result 변경0.
- canonical worker `worker-lease-c01-mainline-acceptance-20260910-001` / execution `c01-mainline-acceptance-execution-fence-epoch-2-66c0e43`, dependent write `write-lease-c01-mainline-acceptance-20260910-001` / token `c01-mainline-acceptance-write-fence-epoch-2-66c0e43`를 재취득했다. epoch1은 현재 쓰기 권한이 아니다.
- 원 projection review SPEC FAIL / QUALITY CHANGES_REQUIRED C0/I1/M0, fingerprint `C01-ACCEPTANCE-INDEPENDENT-SCENARIO-MISSING-v1`: 기존 Developer tests18 재실행은 regression-only로 재분류. 별도 Tester의 설계/matrix 기반9개 시나리오로 해소하며 당시 기록은 삭제하지 않는다.
- 독립 round1 `8 passed/1 failed/0 skipped`, 제품 fingerprint `C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1` 1회. UNKNOWN cost/tokens0으로 예약을 조기 해제했다. immutable fix66c0e43 이후 동일 기대값 round2 `9 passed/0 failed/0 skipped`; 불확실성 예외·reservation1 보존. fix code review SPEC PASS / QUALITY APPROVED C0/I0/M0. 두 finding은 각각 별도 원인과 resolution으로 기록하고 historical failure ledger는 수정하지 않는다.
- R2 TDD RED `-k c01_fix_chain_and_independent_design_scenarios`: exit1, `1 failed, 317 deselected in 1.81s`. chain/basis/raw replay/epoch2/Git exact18 보강 뒤 focused C01MainlineAcceptance exit0 `8 passed, 310 deselected in 16.38s`.
- rehashed manifest RED `-k c01_rehashed_manifest`: exit1 `1 failed, 318 deselected in 3.02s`; finding 삭제/회귀-only 승격을 차단한 GREEN exit0 `1 passed, 318 deselected in 2.61s`. 예상된 TDD RED2회 외 반복 도구·제품 오류0.
- source hashes·명령·round별 대상·범위는 canonical Tester report와 manifest basis에 분리 결박한다. raw의 독립 subject replay는 writer 재현이며 새 Tester 실행이 아니다. UUID entropy만 고정하고 test 원문은 보존한다.
- 남은 검증: generated7 재생성, staged exact18, focused+seq699/700, 독립9 재현, live715, determinism/checksum17/history272/부모·ancestry·경로·syntax·diff. full tooling은 Main 담당. actual Provider·Telegram·backend swap E2E·DB/API/browser/WSL/deployment는 NOT_EXECUTED.
- 다음: 위 검증 후 Main review에 인계. commit/push/merge/외부 작업/Subagent 생성 금지. rollback은 fix 위 projection exact18만 역적용한다.

### C-01 acceptance R2 검증 완료·인계

- 판정 `COMPLETED`; 이유: 독립 시나리오9의 원문·round1 실패·fix·round2 PASS 및 두 finding 해소를 chain/seq715/exact18에 재결박하고 검증했다. Main review/full tooling은 다음 gate다.
- `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -k 'C01MainlineAcceptance or C21PostmergeDevelopmentAuthorityReconciliation or C21FinalAcceptanceProjectionReconciliation' -q -p no:cacheprovider` → exit0, `19 passed, 300 deselected in 39.38s`.
- 불변66c0e43에서 writer 추가 재현 `-m pytest -p no:cacheprovider tests/verification/test_c01_independent_acceptance.py -q` → exit0, `9 passed in 0.36s`; 원 independent round2와 구분한다.
- live checker exit0 `PASS sequence=715 reporting=AUTO_CONTINUE`; generated7 two-build/live 일치, manifest checksum17, source receipt6/authority/WI/독립 test hash 일치, epoch2 tokens 일치.
- raw seq1~700 prefix2157757/SHA60EF142108978724C37E395B5B5C39FDE6504B65F7F5FFDEE336F41E5E937692와 semantic04F82C5795671A4382D87AB3F31761EC06657CA7023D17B405CBB75EC8385DDC 불변; historical evidence272 byte 불변; 새701~715 hash chain PASS.
- Git 실제9/2/occurrence11/unique9/projection18/cumulative26, exact parent/ancestry·WORK_STATUS 외 제품 byte 보존·WORK_STATUS append-only, staged18/unstaged0/untracked0, syntax3파일/diff-check PASS. 새 반복 오류0; global ignore 접근 경고는 환경 경고다.
- 최종 문서 checksum 재결박 뒤 live/determinism/index를 재확인하고 Main에 넘긴다. actual Provider·Telegram·backend swap E2E·외부 runtime, full tooling, commit/push/merge는 NOT_EXECUTED. seq1~700 및 historical failure ledger는 보존한다.

### C-01 acceptance R3 — full tooling 실패 정정

- Main full attempt1 exit1 `20 failed, 673 passed in 1675.07s`. `C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1` count1(19 failure instances), `C01-GIT-MUTATION-ERA-EXPECTATION-v1` count1(1 instance)을 보존한다. Main status-poll wrapper syntax error1은 non-product다. R2 focused 완료와 full tooling 미통과를 구분한다.
- Main 승인 exact20: 기존18 + scripts/check_g07_baseline.py + tests/tooling/test_g07_baseline.py. product unique9와 WORK_STATUS 한 경로 overlap으로 누적28. 제품code/WI/test 변경0, HEAD66c0e43 및 branch 유지.
- epoch3 worker `worker-lease-c01-mainline-acceptance-projection-r3-20260910-001` / execution `c01-mainline-acceptance-execution-fence-epoch-3-66c0e43`; write `write-lease-c01-mainline-acceptance-projection-r3-20260910-001` / token `c01-mainline-acceptance-write-fence-epoch-3-66c0e43`. epoch1/2 무효, 이번 단일writer developer-primary.
- G07 null=no-active(idNone/count0), existing object/count guard 보존. immutable ledger SHA C3C6A25E50946664F645FA1E1622555CCB553B57522E2D5BD6FF141B49470A73에서 current historical32/map OPS-R2 2를 도출. 역사seq700의31/map1·ledger·evidence raw는 보존한다. count31/active1/map-only tamper는 거부한다.
- generic mutation test는 current715 specialized code를 정확히 기대하고 별도 generic frozen fixture는 기존 NOT_ANCESTOR 오류를 확인한다. collector 우선순위/3상태 strict predicate 완화0.
- 최소 RED 명령 `pytest tests/tooling/test_g07_baseline.py tests/tooling/test_project_progress.py -k 'null_active_lineage or active_lineage_object_retains or c01_current_state or c01_ledger_derived or git_and_authority_bindings_are_checked_against_workspace' -q -p no:cacheprovider`: `5 failed,1 passed,373 deselected in11.42s`, exit1. 최초 GREEN은 Counter import 누락1회로3failed3passed18.90s; `C01-R3-COUNTER-IMPORT-MISSING-v1` count1, C01 local import로 해소. 동일 명령 `--tb=short` 추가 재실행 exit0 `6 passed,373 deselected in19.11s`.
- 문서 patch anchor가 R2 제목과 달라 실패1회(`C01-R3-DOCUMENT-PATCH-ANCHOR-v1`), 변경 없이 거부되었고 실제 첫제목 anchor로 재적용 성공. 진단 단계 class setup 누락1/존재하지 않는 schema 경로조회1은 scratch에 별도 보존했다. 같은 제품 root 재발로 집계하지 않는다.
- 다음: generated7/exact20 stage → 기존실패20 exact node IDs·focused+seq699/700·독립9·live/history/checksum19/determinism/경로·부모·syntax·diff 검증. 전체 tooling fresh 재실행은 Main 소유. 실제 Provider/Telegram/backend swap E2E/외부runtime/commit/push/merge 미실행.

### C-01 acceptance R3 targeted 검증 완료

- 상태 `COMPLETED`(writer targeted scope), Main full tooling fresh 재실행은 후속 gate. 이전20실패 full attempt1을 삭제하지 않는다.
- 이전실패20 정확 node IDs pytest 실행: exit0 `20 passed in24.37s`. cache/--lf 미사용. full 명령은 scratch acceptance report에 보존.
- C01MainlineAcceptance + seq699/700 + generic provenance negative: exit0 `21 passed,299 deselected in42.89s`. 독립9 writer 추가재현 exit0 `9 passed in0.33s`.
- live715 AUTO_CONTINUE PASS. generated7 two-build/live equality, raw checksum19, currenthistory32/fullmap OPS-R2 2, epoch3 tokens/lease종료/HANDOFF/manifest 일치, historical evidence272 byte 및 seq1~700 raw/semantic·새701~715 chain PASS.
- Git 실제 product unique9/occurrence11/projection20/cumulative28·parent/ancestry·private authority·제품byte보존·WORK_STATUS prefix보존, staged20/unstaged0/untracked0·syntax5·cached diff-check PASS. 최종 문서 재결박 뒤 live/audit 반복 인계.
- 새 같은root 반복0. Counter import1/문서anchor1 해소; Main status-poll syntax1은 non-product. 실제 Provider/Telegram/backend swap E2E/외부runtime, full tooling 재실행, commit/push/merge 미실행. 다음은 Main review/full gate다.

### C-01 acceptance R4 — 비의미 오기 정정·Main full tooling PASS receipt

- Main full tooling R3 attempt2 `.venv\Scripts\python.exe -m pytest tests/tooling -q -p no:cacheprovider`: exit0, `697 passed in 1661.64s (0:27:41)`. Main 결과 전달이며 writer 실행 아님. R4 정정 이전 R3 exact20에서 실행됐고 부모 manifest SHA `D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F` 및 당시 exact20 checksum snapshot을 현재 manifest에 보존한다.
- Main 전달 Reviewer final SPEC PASS / QUALITY APPROVED C0/I0/M1: WI 항목7 Developer-test 재실행 수20은 오기이며 실제18로 정정해 Minor1 resolved. canonical evidence는 이미18이었다. 로컬 추적 ID `C01-DEVELOPER-TEST-COUNT-TYPO-v1`; 새 독립 Tester 실행·제품·테스트 판정 로직 변경0.
- `MAIN_RECONFIRMED_NON_SEMANTIC`, epoch4 worker `worker-lease-c01-mainline-acceptance-projection-r4-20260911-001` / execution `c01-mainline-acceptance-execution-fence-epoch-4-66c0e43`; write `write-lease-c01-mainline-acceptance-projection-r4-20260911-001` / token `c01-mainline-acceptance-write-fence-epoch-4-66c0e43`, write epoch4. 이전 epoch1/2/3 무효. HEAD66c0e43/branch/exact20/cumulative28 유지.
- seq701~715/current projection metadata만 재결박하며 seq1~700/history272/product·원 독립suite는 보존. 테스트 변경은 승인 epoch 기대 literal2개만이며 checker 판정 로직 변경0이다.
- R4 문서 패치 hunk 역순1회 `C01-R4-DOCUMENT-PATCH-HUNK-ORDER-v1`: 적용 전 atomic 거부·변경0 확인 후 순서 정정하여 성공. 비제품 도구 오류이고 반복 제품 실패로 집계하지 않는다. full attempt1 두 fingerprint각1/status-poll wrapper syntax error1 이력 유지.
- 다음: writer 최소 관련 tests/live/checksum/determinism/history/exact/syntax/diff, Main 정정 후 focused/checker/checksum/determinism 재실행. R3 full697 PASS를 R4 이후 full 실행으로 표시하지 않는다. actual 외부 NOT_EXECUTED, commit/push/merge 금지. rollback은 fix66 위 exact20의 승인 diff만 역적용하며 역사·사용자 자료를 보존한다.

### C-01 acceptance R4 writer targeted 완료

- 판정 `COMPLETED`(writer targeted); `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -k C01MainlineAcceptance -q -p no:cacheprovider --tb=short` → exit0 `10 passed,310 deselected in24.13s`. live715 AUTO_CONTINUE PASS.
- comprehensive audit exit0 `R4_AUDIT_PASS`: generated7 two-build/live equality, checksum19, R3부모 snapshot20, seq1~700 raw/semantic·새chain, historical272, exact20/cumulative28/product9/occurrence11/parent/ancestry/private authority/WORK_STATUS prefix, epoch4종료/progress/HANDOFF, syntax5/diff PASS. current history32/OPS-R2 2 유지.
- checker의 metadata patch와 test epoch 기대 literal2개를 메모리에서 역변환하여 각 R3 source SHA 동일 확인. G07 checker/test·독립suite·raw2의 R3 bytes 불변. 제품/테스트 판정 로직 변경0. 허위 full PASS count698 재해시도 strict reconstruction에서 거부한다.
- R4 hunk-order 도구오류1 해결, 새 제품/검증 실패0. 기존 Main attempt1 두 fingerprint각1/status-poll syntax1 보존. 최종 문서 재결박 뒤 live/audit 반복 후 추가 writer mutation을 종료한다. Main post-correction focused/checker/checksum/determinism은 후속 gate이며 R4 이후 full tooling 실행을 주장하지 않는다. 외부 NOT_EXECUTED, commit/push/merge0.

## C-01 L3 final acceptance

- C-01 `ACCEPTED`; C-02 `READY_NOT_STARTED`; active lease 없음.
- WSL formal runtime와 browser/SSE evidence는 final manifest에 결박했다. Provider·Telegram 실제 호출은 `NOT_EXECUTED`다.

## C-01 post-merge development authority reconciliation

- seq728 `REPOSITORY_RECONCILED / DEVELOPMENT_MAIN_AUTHORITY_RECONCILED`.
- development main `b0e70278d3799860beb1eef94c382def53a45057`; C-01 `ACCEPTED`; C-02 `READY_NOT_STARTED`.
- Provider/Telegram `USER_OWNED_NOT_EXECUTED`; active lease 없음.

## C-02 start projection

- seq729~731 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`.
- C-02 `ACTIVE`; C-01 `ACCEPTED`; C-03 `BLOCKED_PENDING_C02_ACCEPTANCE`; DIR-2 `NOT_REACHED`.
- actor `developer-primary`; epoch 1 worker/write fencing token과 exact product scope를 결박했다.
- Provider/Telegram `USER_OWNED_NOT_EXECUTED`; runtime/DB/Secret/network/commit/push/PR/merge `NOT_EXECUTED`.

## C-02 final acceptance

- seq732~736 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED → INDEPENDENT_TEST_JUDGMENT_RECORDED → MAIN_PACKAGE_ACCEPTED`.
- C-02 `ACCEPTED`; C-03 `READY_FOR_WORK_INSTRUCTION`; DIR-2 `NOT_REACHED`; reporting `AUTO_CONTINUE`.
- AV-AGT-001/AV-SAFE-022 PASS; hostile1468, runner-zero1458, regression193; Critical/Important 0/0.
- full repository suite `NOT_COMPLETED` (7 collection errors); Provider/Telegram/network/DB/browser/WSL/deploy/actual runner `NOT_EXECUTED`.

## C-02 post-merge development authority reconciliation

- seq737 `REPOSITORY_RECONCILED / DEVELOPMENT_MAIN_AUTHORITY_RECONCILED`.
- development main `a0cdc6aabcca14ae36ce6077bf9d2f0d89a70658`; C-02 `ACCEPTED`; C-03 `READY_FOR_WORK_INSTRUCTION`; DIR-2 `NOT_REACHED`.
- full repository suite `NOT_COMPLETED`; Provider/Telegram/network/DB/browser/WSL/deployment/actual runner `NOT_EXECUTED`; active lease 없음.
- tooling contract suite는 상호배타 분할 347 PASS; monolithic sandbox/tmpdir retry는 assertion·product failure가 아닌 환경 성능 실패로 중단.

## C-03 start projection

- seq738~740 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`.
- C-02 `ACCEPTED`; C-03 `IN_PROGRESS`; C-04 `NOT_READY`; DIR-2 `NOT_REACHED`.
- `AV-AGT-004` / `L3` / `AI` / `E-GIT,E-ART`, Developer 1명 read-only lifecycle과 exact3 scope를 결박했다.
- control 제품 변경 및 Provider/Telegram/Secret/DB/API/browser/WSL/deploy/network/actual runner `NOT_EXECUTED`.

## C-03 control R2

- seq741~743 `WRITE_LEASE_REVOKED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`.
- R1 worker lease 유지; R1 write lease 폐기; exact4 epoch2 write lease 발급.
- `packages/e2e/harness.py`는 `record_takeover` start→wait/state transition→stop 호환만 허용한다.
- 기능/요구/중요 위험 `UNCHANGED`; C-03 `IN_PROGRESS`; C-04 `NOT_READY`; DIR-2 `NOT_REACHED`.

## C-03 final acceptance

- seq744~748 completion/independent judgment/Main acceptance를 append했다.
- product exact4와 Main 241/78 PASS, independent 23 nodes/66 cases PASS, review disposition을 결박했다.
- C-03 `ACCEPTED`; C-04 `READY_FOR_WORK_INSTRUCTION`; DIR-2 `NOT_REACHED`; active lease 없음.
- external Developer backend/Provider/Telegram/DB/API/browser/WSL/deploy/network `NOT_EXECUTED`.

## C-04 start projection

- seq749~751 `WORK_INSTRUCTION_ISSUED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED`.
- C-03 `ACCEPTED`; C-04 `IN_PROGRESS`; C-05 `NOT_READY`; DIR-2 `NOT_REACHED`.
- current R2 authority, epoch2/epoch3 leases and exact9 segment-aware product scope bound; control product mutation 없음.
- actual external systems and UI binding `NOT_EXECUTED`; U-02 browser/E-SHOT `DEFERRED`.

## C30R3 Task4 browser formal 진단 — 2026-09-22

- 전체 판정 `INCOMPLETE`; 기존 normal/empty/same-origin browser 증거는 PASS이나 revoke 후
  browser permission/403은 아직 미검증이다.
- 단1회 response-capture 진단은 PG15 migration/owner seed `COMMITTED` 후 disposable web
  startup exit1로 중단됐다. `/health/live`와 `/health/ready` 모두 `URLError`, 실행 결과는
  `RuntimeError: API_READINESS_FAILED`였다.
- cleanup 경합 때문에 web 원본 exception은 미수집/미확정이다. 제품·fixture 변경과 추가 retry0.
- Chrome/profile/tunnel/container/network/volume/image/tmp checkout cleanup residue0,
  기존 `anvil-web` current identity/health 불변을 확인했다.

## C30R3 Task4 browser formal 완료 — 2026-09-22

- 판정 `COMPLETED_FORMAL_FIXTURE_SCOPE`; 최종 `session15435` exit0.
- startup 실패는 진단 런처의 env key 불일치(`INTERNAL_SIGNING_SECRET` 주입,
  runtime 요구 `TELEGRAM_INTERNAL_SIGNING_SECRET`)로 확정·교정했다. 제품 변경0.
- web restart 전 web/BFF net inode 동일 `4026533760`; restart 후 web `4026533820`,
  기존 BFF `4026533760`으로 분리되며 연결 reset. BFF를 동일 설정으로 1회 재생성하자
  둘 다 `4026533820`, health200으로 회복했다.
- PG PID1/postmaster 안정 확인 후 app0013/owner0015, seed/revoke COMMITTED,
  receipts4/revoked1. restart live/ready200, 직접 API403 `PERMISSION_DENIED`.
- 동일 격리 Chrome/tunnel/HttpOnly cookie가 유지·재전송됐고 browser403,
  loadingFailed0, DOM `Team · permission`(offline/error 아님)을 확인했다.
- 최초 네 메뉴 normal/empty, same-origin API200 네 경로, foreign/internal URL0,
  CSP self, uncaught JS0. fixture auth이며 production auth 증거가 아니다.
- Chrome/profile/tunnel/container/network/volume/image/tmp checkout residue0,
  기존 `anvil-web` identity/StartedAt/running/healthy 불변.
- Provider/production/PG18/Oracle 미실행. 다음은 C30 전체 독립 Reviewer와 fresh gate다.
- fresh gate: web 전체88P/0F/0S exit0(2663.7486ms), C30R3 관련 Python159P/0S
  exit0(14.30s, 기존 warning1), diff-check exit0.

## C30R3 독립 review rework 및 browser error 보완 — 2026-09-22

- 첫 독립 review `REWORK C0/I2/M1`. seq1315 선행 acceptance는 seq1316으로 무효화했고
  만료 lease projection은 seq1318에서 회수했다. 현재 acceptance=false.
- 유효 read-only worker lease 아래 최종 session21984 exit0. internal Docker network의 publish
  비활성은 cached image 비교로 확정했고 WSL host→internal container IP ingress를 사용했다.
- 정상 Team200 뒤 exact same-origin team GET1건만 CDP safe400 fault injection;
  Network400, DOM `Team · error`, loadingFailed0, uncaught0, foreign/internal URL0, CSP self.
- CDP fault-injection UI 증거이며 실제 서버 생성400/Provider/production/PG18 증거가 아니다.
- 모든 disposable/Chrome/profile/tunnel residue0, 기존 anvil-web tuple/healthy 불변.
- 다음 행동은 C30R3 독립 재검토이며 통과 전 formal acceptance를 기록하지 않는다.

## F-17 WSL QA 생성 전 자원 계획 — 2026-09-24

- 판정: F-17 제품 코드 `509fb22`(선행 `d39432b`) 기준 Windows 회귀 83 PASS/2 SKIP(exit 0); 실제 WSL PG15/PG18·HTTPS/browser·backup/restore는 `NOT_EXECUTED`. 담당 Main, 제품 오류 0, 환경 오류 1(Windows 기본 pytest temp ACL; 별도 basetemp로 재실행 PASS).
- WSL 접근은 `ssh WSL-server`만 사용한다. 읽기 전용 확인에서 기존 `local-postgres`(PG15), 기존 `anvil` DB/`anvil_app` role, 기존 `anvil-web`은 존재한다. 아래 신규 F-17 대상은 생성 전 모두 부재, 포트 32769/8300/8301/8443은 비어 있다. 기존 자원·전역 HBA/bind/network/firewall에는 변경을 가하지 않는다.
- exact Git checkout `/srv/anvil-wsl/f17-rc`(공개 tag/commit의 clean detached 상태), QA 임시 경로 `/srv/anvil-wsl/f17-rc-qa`. 생성 전 경로 부재 확인. QA 안에 합성 비밀·TLS cert/key·브라우저 프로필·venv·시험 산출물을 0700/0600으로 보관하고 완료 후 exact path 확인 후 제거한다. Git checkout은 공개 ref로 복구 가능하다.
- PG15: 기존 `local-postgres` 서비스 내부에 **새로운** `anvil_f17_pg15_d39432b` DB 및 `anvil_f17_migrator_d39432b`, `anvil_f17_app_d39432b` role만 생성한다. 현재 부재 확인 완료. migrator가 해당 DB를 소유하고 migration을 실행하며 app은 비-superuser/non-createdb/non-createrole, 해당 DB DML만 수행한다. 테스트 후 해당 DB와 두 role을 정확히 확인해 제거한다. 기존 `anvil` DB/role은 건드리지 않는다.
- PG18: 기존에 로컬 존재하는 `pgvector/pgvector:0.8.2-pg18` image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`를 고정해 `anvil-f17-pg18-rc` Compose project로 postgres/web/api/worker, labeled network 두 개, named volume 0, PGDATA tmpfs, DB host 127.0.0.1:32769, Web host 127.0.0.1:8300만 생성한다. 완료 후 이 project/label/이미지·volume 수를 확인해 down하고 잔류 0을 확인한다.
- PG15 API는 exact F17 image의 전용 `anvil-f17-pg15-api-d39432b` host-network container(127.0.0.1:8301), HTTPS QA proxy는 `anvil-f17-qa-tls-d39432b`(127.0.0.1:8443)로 제한한다. PG15와 PG18 시험은 순차로 수행한다. image tag는 `anvil-f17-runtime:d39432b`, `anvil-f17-web:d39432b`로 고정하고 exact image ID를 기록한 후 생성된 tag만 제거한다. `anvil-f14-pg18-d39432b` 별도 backup/rollback container가 필요하면 F17 Compose를 내린 뒤 F14 guard label/tmpfs/loopback 조건으로 일시 생성·제거한다.
- 모든 테스트는 합성 actor/project/run, 임시 DB와 same-origin HTTPS만 사용한다. 실 Provider/계정/운영 서버/외부 배포는 제외한다. 자원 생성 전 exact 공개 commit과 image, role/port/path 부재를 재확인한다. 생성·시험·정리 결과와 미검증 범위는 `F-17_WSL_TEST_REPORT.md`에 누적 기록한다.
- AV-OPS-015 보완 계획: PG15 shared QA DB의 migration/E2E/restart PASS만으로 rollback을 PASS라 하지 않는다. `pgvector/pgvector:0.8.2-pg15` image ID `sha256:75f6767185020459c7e2c3f88fb66f1bd2d9790c435bc91512497146c8bf8d7e`의 별도 `anvil-f14-pg15-7083e2a` tmpfs/label `F14_ISOLATED_TEST`/127.0.0.1:32768 컨테이너에서 F17 exact Git SHA로 6계보·version-matched dump/restore·유자료 downgrade 거부를 검증한다. 기존 `local-postgres`와 DB를 공유하지 않으며, 임시 checkout `/srv/anvil-wsl/f17-rc`·QA `/srv/anvil-wsl/f17-rc-qa`를 재생성해 완료 후 정확히 제거한다. 생성 전 경로/컨테이너/포트 부재 확인 완료.
- F-17 비교 기준 보완: 최초 PG15 E2E는 `509fb22`/image `d38dbda3`였고 PG18은 Compose 포트 실제 결함 수정 후 `7083e2a`/image `65b17826`이다. 두 개를 동일 source/image PASS로 합산하지 않는다. F14 PG15/18 rollback rehearsal은 최종 `7083e2a`에서 각각 PASS했고 임시 자원은 정리됐다. F-17의 PG15 핵심 HTTP+DB·restart를 최종 `7083e2a` clean tag 및 동일 runtime image digest로 다시 실행한다. 기존 F17 전용 DB/role·path·port 부재를 확인한 뒤만 재생성하며 완료 후 다시 제거한다. 기존 `anvil` DB/role과 `anvil-web`은 보존한다.

## F-17 WSL 실측·정리 — 2026-09-24

- 판정: Main 독립 검증 기준 AV-OPS-015/025 **F17 범위 PASS**, 각 criterion 최종 ProductValidation `SUITABLE`(증거 기반 Main 판단, 공개 API/DB 기록 아님). 담당 Main, 작업 branch `codex/f17-wsl-pg18-rc`; 제품 최종 공개 tag `f17-rc-7083e2a` → `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`. 동일 runtime image ID `sha256:f6c481954d3ec9013b4974aa9514c8646b06616ffbc84cc4d645c7a5d4432a82`로 PG15/18 순차 E2E·restart PASS. 전용 WSL 보고서와 RC EvidenceManifest에 정확한 target/evidence hash 기록.
- PG15 공유 서비스의 **전용** DB·최소 app role에서 migration0016/vector/query/HTTPS ready200/Task→Run HTTP+DB/재시작 후 SSE=DB PASS. PG18 별도 tmpfs Compose(4 containers, 2 networks, named volume0, DB loopback 32769)에서도 동일 시나리오 PASS. PG18 최종 실제 synthetic DB custom dump→동일 major restore의 migration/task/run/event/vector 값 일치 PASS. F14 guard의 별도 PG15/18 tmpfs 컨테이너에서 6계보 backup/restore·유자료 downgrade 거부 각각 exit0/1 PASS.
- 최종 Web image Playwright 1920/390 둘 다 200, overflow0, JS error0, same-origin 요청4/foreign0. 화면의 Environment NOT CONNECTED, Queue/Worker UNAVAILABLE는 사실대로 보존했고 전체 UI 정상 주장 없음. Windows Main 관련 회귀 exit0/83 PASS·2 opt-in SKIP·warning1; PG18 internal-only port 결함은 테스트 RED1→수정 GREEN으로 고정했다.
- 중간 진단 오류·조치: (1) internal-only PG18 DB port 미게시 → postgres를 격리 ingress에도 연결, 실제 127.0.0.1:32769 확인. (2) QA Caddy `*:8443` → 즉시 종료·loopback bind. (3) Web-only `/auth/session` 405 → F17 전용 HTTPS QA gateway에서 `/auth/*`만 API 내부 IP로 전달, Secure cookie 검증 PASS; Web-only 직결 인증은 미검증/F18 proxy 재확인 항목. (4) PG15 image 자동 anonymous volume → 해당 container+정확한 volume 즉시 제거하고 PGDATA tmpfs `Mounts=[]`로 재실행. (5) 초기 Git/image 불일치 및 레거시 빌드 ID 변동 → 최종 동일 checkout/image를 **유지**하며 양 환경 재검증. 동일 정식 Developer 실패 3회가 아니며 Main 인수 횟수 0.
- 정리: 전용 PG15 DB·2 role, PG18 Compose/container/network/tmpfs, PG15/18 rehearsal container·anonymous volume, TLS·브라우저 프로필·합성 비밀·인증서·QA screenshot, F17 image tags, `/srv/anvil-wsl/f17-rc`와 `-qa` exact paths 잔류0. 기존 `anvil|anvil_app` 확인, `local-postgres` Up·`anvil-web` Up/healthy. 임시 합성 DB·비밀은 삭제돼 복구 불가; source는 공개 tag로 복구 가능.
- 변경 파일: `deploy/wsl/compose.f17.yml`, `deploy/wsl/f17_validation.py`, `tests/deploy/test_f17_validation.py`, `tests/integration/test_f17_runtime_e2e.py`, `docs/04_test_reports/F-17_COMPLETION_REPORT.md`, 본 WORK_STATUS, `docs/04_test_reports/F-17_WSL_TEST_REPORT.md`, `docs/evidence/manifests/F-17_RC_EVIDENCE_MANIFEST.json` 및 raw checksum manifest. 미검증: ProductValidation API 501, Web-only auth route, 전체 UI 업무 흐름, 실제 Provider/production/user ReleaseDecision. 다음 행동: report/manifest hash·G-05·독립 review 후 PR Broker→main merge→merged-main smoke→branch/worktree 삭제; 그 전 F-18 branch 생성 금지.

## F-17 병합 후 G-05 보정 — 2026-09-24

- 판정: PR #33은 `main`의 `b0a4de6`에 병합됐으나 merged-main G-05는 `F17_START_GIT_INVALID`로 실패했다. 제품/WSL 검증 실패가 아니라 F-17 final overlay가 작업 브랜치만 검사한 control checker 결함이다. F-18 브랜치는 생성하지 않았다.
- 담당 Main, 동일 F-17 작업 브랜치 `codex/f17-wsl-pg18-rc`를 병합된 `main`으로 fast-forward한 뒤 checker-only TDD 보정 중. RED: final merged-main validator import 실패 1회. GREEN: `tests/tooling/test_f17_progress_overlay.py` 4 PASS(exit 0). 제품 파일·런타임·승인 범위 변경 0.
- 보정 내용: final 상태에서 동일 exact18-path clean feature 또는 두 부모/feature 동일 tree/원격 main 일치/기준 BASE의 첫 부모 계보가 검증된 merged-main을 허용한다. start 상태 검사는 종전 branch 조건을 유지한다.
- 다음 조치: raw checksum 갱신 → 동일 F-17 브랜치 push 및 G-05 → PR Broker 보정 병합 → merged-main G-05/smoke → F-17 branch/worktree 정리. 미검증: 보정 병합 전 merged-main gate.
- 독립 재검토 결과 spec/quality 각각 C0/I0/M0 PASS. seq1323 Main acceptance는
  C30R3 fixture formal 범위만 적용한다. active agent/worker/write lease0.
- C30 전체 acceptance는 보류: canonical progress checker의 기존 C03 embedded SyntaxError가
  문서 lint/link/ID gate를 차단한다. 다음은 이 checker의 정식 corrective repair다.

## F-18 WSL 격리 QA 자원 생성 전 계획 — 2026-09-24

- 담당 Main. F-18은 로컬·`WSL-server` 사전검증만 수행한다. `ysna-server`, Production DB·OIDC·object storage·network policy·도메인은 접속·변경·검증하지 않으며 전체 F-18 acceptance는 보류한다.
- WSL 접근은 `ssh WSL-server`만 사용한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres`는 읽기·변경·재시작 대상이 아니다. 읽기 전용으로 신규 exact 경로 `/srv/anvil-wsl/f18-local-qa` 부재와 WSL Python 3.12.3, pytest 9.1.1, cryptography 41.0.7을 확인했다.
- 생성 자원은 **한 개**의 임시 Git checkout `/srv/anvil-wsl/f18-local-qa`로 제한한다. `github-sinsan-develop` SSH alias의 승인 remote에서 공개된 F-18 branch의 정확한 commit을 fetch한 후 detached checkout으로 테스트한다. Python `-B`, pytest `-p no:cacheprovider`와 checkout 내부 전용 `--basetemp`를 사용하며 DB·Docker·브라우저·네트워크 listener·계정·Secret을 생성하지 않는다.
- 종료 시 checkout의 HEAD·dirty 상태를 기록하고 exact 경로가 `/srv/anvil-wsl/f18-local-qa`인지 재확인한 뒤 그 임시 checkout과 내부 pytest 임시 파일만 제거한다. 제거 후 경로 부재와 기존 서비스 상태 불변을 확인한다. 시험 결과·오류 횟수·잔여물·미검증 범위는 `F-18_LOCAL_WSL_PREFLIGHT_REPORT.md`에 기록한다. 소스는 공개 Git commit으로 복구 가능하다.
- 로컬 제품 writer는 시작 `8f78d31`에서 exact5 경로만 수정했고 Task1 `3a97e06`, Task2 `88da55f`, 보고서 `f214c6e`, 서명 결박 보완 `34e0f8f`를 남겼다. Main 독립 검토에서 F-16 `VerifiedRelease.subject_hash`가 서명 envelope 자체를 묶지 못하는 Important 1건을 발견해 동일 writer에게 보완시켰다. `verify_approval_release`의 기존 F-16 서명 검증+envelope 전체 SHA-256 결박과 새 유효 서명/변조 서명 거부 테스트로 해소했다. 정식 Developer FAILURE_REPORT 0, Main 보완 요청 1.
- Main 독립 Windows 회귀: F-18/F-16/F-17 관련 79 PASS(exit 0, 23.74s), 전용 `.f18-main-pytest-temp` exact 경로 확인 후 제거·잔류0. 실제 F-17 evidence는 Web digest가 없어 `WEB_IMAGE_NOT_VERIFIED`; 합성 3-image shape만 비공개 rehearsal 준비. WSL 실측·Production·전체 F-18 acceptance는 여전히 미실행.
- WSL-server QA: 공개 Git checkpoint `de4caa5eede6b3700cb5c0607b895a442994cfc5`를 승인 alias에서 exact `/srv/anvil-wsl/f18-local-qa` 격리 clone, clean detached checkout했다. 첫 5-file pytest collection은 WSL Python에 `sqlalchemy`가 없어 exit1; F-17 파일 12개는 WSL에서 `NOT_RUN`이다. F-18/F-16 4-file focused 재실행은 67 PASS(exit0, 1.17s). Windows 5-file 79 PASS와 구분한다.
- WSL 임시 경로 첫 생성은 `/srv/anvil-wsl` root 소유로 허가 거부 1회였다. exact 신규 경로만 `sudo install -d -o daon -g daon -m 0700`으로 생성해 해결했다. 정리 전 realpath exact 일치·비 symlink·HEAD 확인, pytest 임시 파일만 untracked임을 확인했다. exact 임시 checkout 제거 후 경로 잔류0; 기존 `local-postgres` Up, `anvil-web` Up/healthy 불변. 환경 오류 2(경로 권한, SQLAlchemy 부재), 제품 정식 실패 0.
- 담당 Developer 최종 보고 commit `eaef185a8d03d2cb75f5385a758cd92841a1b951`. Main은 F-18 전체 `accepted=false`, Production `NOT_EXECUTED`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`로 기록하고 worker/write lease를 회수한다. 신산님 지시의 로컬·WSL 범위 밖 증거가 없으므로 이 브랜치는 복구 가능한 checkpoint로 보존하며 병합·삭제·신규 F-19 branch 생성은 하지 않는다.

## F-18 WSL 누락 회귀 재검증 자원 계획 — 2026-09-24

- 신산님의 `진행하자` 지시로 같은 `codex/f18-local-wsl-preflight` 브랜치의 남은 로컬·WSL 검증을 진행한다. Production 범위 제한과 F-18 `accepted=false`, F-19 차단은 유지한다. 제품 코드 mutation과 신규 브랜치·PR 병합은 하지 않는다.
- 첫 WSL 5-file 수집 실패의 직접 원인은 WSL Python의 `sqlalchemy` 부재다. `uv.lock`은 SQLAlchemy `2.0.52`를 기록한다. 기존 WSL 전역 Python·DB·Docker·서비스에는 설치·변경하지 않는다.
- 신규 exact 임시 경로 `/srv/anvil-wsl/f18-local-qa-r2`의 부재와 기존 `local-postgres` Up·`anvil-web` Up/healthy를 생성 전 확인했다. 승인 remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`에서 현재 게시된 동일 branch의 exact commit만 detached checkout한다. checkout 내부 `.f18-venv`는 `--system-site-packages` 가상환경으로 만들고 `SQLAlchemy==2.0.52`만 설치한다. 의존 패키지는 pip가 해당 가상환경 안에만 둔다. 시험 산출물은 checkout 내부 `.f18-wsl-pytest-temp`로 제한한다.
- 5-file 79건을 한 명령으로 실행해 exit·PASS/FAIL/SKIP을 기록한다. 추가 모듈 부재 또는 설치 불가 시 원인과 실행 범위를 기록하고 무한 재시도하지 않는다. 종료 시 realpath·비-symlink·Git HEAD·dirty 상태를 확인하고 exact 임시 경로만 제거해 잔류0 및 기존 서비스 상태 불변을 검증한다. source는 공개 Git ref로 복구 가능하다.
- R2 실행 결과: 공개 `ad0ddb16ed9504563128934a647db3390515e5cc` clean detached checkout, 전용 `.f18-venv`에 `SQLAlchemy==2.0.52`/`greenlet==3.5.6`만 설치. 동일 F-18/F-16/F-17 5-file WSL 회귀 **79 PASS**, exit0, 2.59s. 앞선 WSL F-17 12 NOT_RUN은 이 실행으로 해소했다. 환경 의존성 보완 1회이며 제품 정식 실패 0.
- 정리 전 R2 realpath exact/비 symlink/owner `daon:daon` 0700/HEAD를 확인했고 untracked는 `.f18-venv/`와 `.f18-wsl-pytest-temp/`뿐이었다. exact `/srv/anvil-wsl/f18-local-qa-r2` 삭제 후 잔류0. `local-postgres` Up, `anvil-web` Up/healthy 불변. Production 및 Web 실제 digest 결박은 여전히 미검증이고 F-18 `accepted=false`, F-19 차단, branch 보존을 유지한다.

## F-18 WSL 공개 tag Git 경계 QA 자원 계획 — 2026-09-24

- 신산님의 `계속진행하자`에 따라 기존 F-18 브랜치를 유지하면서 AV-OPS-021의 WSL 측 공개 Git tag/clean-detached 경계만 실제 원격으로 추가 확인한다. Product/Production 파일 mutation, `ysna-server` 접속, 신규 브랜치·PR 병합은 하지 않는다. 이 검증은 운영 서버의 checkout PASS가 아니다.
- 생성 전 `ssh WSL-server`에서 exact 임시 `/srv/anvil-wsl/f18-git-gate-qa` 부재, `local-postgres` Up·`anvil-web` Up/healthy를 확인했다. 승인 remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 `f17-rc-7083e2a` annotated tag object `6eda3d5f984b6237250fb460d496970b7182e019`, peeled commit `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`를 직접 조회했다.
- 신규 자원은 root 소유 `/srv/anvil-wsl` 아래 daon 소유 mode0700 exact 임시 Git checkout 한 개뿐이다. 공개 tag로 clone하고 승인 remote·annotated tag object·peeled commit·detached HEAD·clean status를 확인한다. DB·Docker·브라우저·Secret·프로세스·network listener는 생성하지 않는다.
- 종료 시 realpath exact·비 symlink·Git HEAD/dirty를 확인한 뒤 exact 임시 checkout만 제거하고 경로 잔류0 및 기존 서비스 불변을 재확인한다. 실패는 PASS로 승격하지 않으며 결과·미검증은 F-18 보고서에 기록한다. 소스는 공개 tag로 복구 가능하다.
- 결과: WSL actual approved remote의 annotated tag object `6eda3d5f984b6237250fb460d496970b7182e019` → peeled F-17 commit `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`; single clean detached exact checkout에서 기존 `deploy.wsl.f16_staging.verify_exact_checkout` exit0. exact temp checkout 제거·잔류0, 기존 두 서비스 상태 불변. WSL 측 Git 경계만 PASS이며 Production AV-OPS-021은 미검증이다.
- 추가 인수 경계: 저장소의 F-16 서명 ReleaseManifest envelope 부재, F-17 evidence의 Web/API/Worker 세 digest 결박 부재, 기록된 Web image ID의 현재 WSL Docker 조회 `No such image`를 확인했다. 과거 C-21 형식 `deploy/ysna/ReleaseManifest.json`은 F-18 서명 artifact가 아니다. 새 동일 image를 임의 재빌드해 PASS로 승격하지 않는다. 운영 담당자의 실제 서명 manifest·세 image digest·ysna capability/checkout/DB/브라우저/monitoring 증거 전 F-18 `accepted=false`, F-19 차단을 유지한다.
- 추가 WSL 읽기 전용 조사: `/srv/anvil-wsl/evidence`, `/srv/anvil-wsl/control`, `/srv/anvil-wsl/runtime`의 깊이 3 이내에서 `*release*manifest*.json`·`*evidence*manifest*.json` 경로 0. 첫 일반 `find`는 control 권한 거부 1회였고 정확한 세 경로 `sudo find`로 재확인했다. `.env`·Secret 내용은 읽지 않았다. 실 서명 manifest와 세 image digest가 현재 확인된 로컬·WSL 산출물에 없어 Production 승격 검증을 시작할 근거가 없다. 조사 범위 밖 존재 가능성은 미확인으로 남긴다.
# F-18 R32 trusted directory canonical 임대 종료 / 2026-09-26

- 판정: `R32_TRUSTED_DIRECTORY_CHECKPOINT_PASS`. Main은 제품 보고서 commit `e0cea603a8fe11c4bf1375c3553898f2613fcae7`와 QA 상태 commit `b5871d7`을 지정 원격에 게시했다. control QA `65af1f4` 후 seq1592 `WRITE_LEASE_REVOKED`→seq1593 `WORKER_LEASE_REVOKED`를 투영한 `e0315617d84e47e8d80eaae64bef43863e3739f0`을 동일 브랜치에 push했다. worker/write lease=null, 제품 write scope 빈 목록, G-05 seq1593 PASS, 종료 control test 2 PASS(exit0), branch clean·원격 HEAD 일치다.
- 판단 이유: 동일 제품 SHA `ca5f6597239fb8f031925ee5e1ffc8ee921a7075`의 WSL-server 격리 PG18 87 PASS/4 R31 PG SKIP(wrapper exit0), R32 PG4 PASS, SELECT-only reader INSERT SQLSTATE 42501, 전용 자원 잔류0, 기존 서비스 불변이다. 독립 review Critical/Important 0·Task quality Approved. 전체 pytest 기존 수집 오류 13건은 NON-GREEN이다.
- 조치·다음: R32 합성 DB·container·checkout 정리 완료. 임대 종료 후 새 제품 write 없음. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED. 실제 issuer·session·API·browser·정식 WSL 통합은 미검증이며, 다음 안전 행동은 승인된 F-18 OIDC session Stage 준비다. 오류 횟수: Developer 정식 실패0·WSL QA 오류0. 변경 파일은 R32 control/투영/WORK_STATUS와 지정 보고서이며, rollback은 제품·control 공개 commit을 보존하고 새 Stage 전 동일 브랜치의 마지막 검증 checkpoint로 복귀하는 것이다.
# F-18 R33 OIDC session store control 준비 / 2026-09-26

- 판정: `R33_CONTROL_QA_PENDING_CANONICAL_LEASE`. 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·원격 `89674c15f8288bab484894b072224ddbf8c1f03c`, clean, G-05 seq1593 PASS, worker/write lease=null을 확인했다. 로컬 OIDC 관련 baseline 142 PASS/기존 warning2(exit0). 설계·계획·기본 F-18 WorkInstruction 승인 범위의 세션 영속 저장 경계 exact5를 계획·지시하고, API/runtime/Web/실제 issuer/Production 변경은 제외했다.
- control 변경: R33 계획·WorkInstruction·Invocation, epoch17 overlay·checker dispatch·overlay test. control test 2 PASS(exit0), overlay import/write scope 확인 PASS. 다음은 exact control QA commit/push 후 seq1594 WorkInstruction→1595 worker→1596 write lease를 투영하고 G-05 PASS를 확인하여 `developer-primary` 단일 writer에게 RED→GREEN 구현을 전달하는 것이다. 제품 변경0, 정식 Developer 실패0, 실제 PG18/session/API/browser 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.
# F-18 R33 OIDC session store canonical writer 임대 발행 / 2026-09-26

- 판정: `R33_CANONICAL_WRITER_LEASE_ACTIVE`. Main은 control QA `1010c64`와 seq1594 `WORK_INSTRUCTION_ISSUED`→1595 `WORKER_LEASE_ISSUED`→1596 `WRITE_LEASE_ISSUED` 투영 `f087e3694ce0a8556436d4435171f3ce11f40389`를 지정 SSH 원격에 게시했다. epoch17 실행/write fencing token은 R32와 다르며 제품 exact5(`0019` migration, session store, local/PG test, F-18 보고서)에만 결박된다. G-05 seq1596 PASS, control test 2 PASS(exit0), branch clean·원격 HEAD 일치다.
- 조치·다음: `developer-primary` 단일 writer에게 R33 RED→GREEN 구현과 기본 검증을 전달한다. Main은 제품 파일을 수정하지 않는다. 제품 변경0, 정식 Developer 실패0, 실제 PG18/issuer/API/browser 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.
# F-18 R33 OIDC session store 격리 WSL PostgreSQL 18 QA 생성 전 계획 / 2026-09-26

- 판정: `R33_PRODUCT_REVIEW_APPROVED_WSL_PG18_PENDING`. Main은 제품·보완 SHA `35df34359bfe290a4dec53cb78837e1a3a4792a1`→`0b33263bdc01f5ca1422cec32936862967d94228`을 같은 branch에 push했고 G-05 seq1596 PASS·branch clean·원격 HEAD 일치다. 독립 review의 Important 2건은 correction scoped 재검토에서 모두 ADDRESSED, Critical 0/Important 0/Task quality Approved. Main focused 150 PASS/PG opt-in 13 SKIP/기존 warning8(exit0); 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다. 정식 Developer 실패0.
- 생성 전 read-only WSL-server inventory: 전용 checkout `/home/daon/anvil-f18-r33-session-qa`, container `anvil-f18-r33-pg18-qa`, loopback port `127.0.0.1:55433`은 모두 부재·미사용이다. QA는 공개 제품 SHA `0b33263bdc01f5ca1422cec32936862967d94228`의 clean detached Git checkout, 기존 고정 PostgreSQL 18 image `sha256:b551e63a5606bdd3127b12a8120c6df8d71c812b29a7faf944b034cb9beb644a`, 전용 tmpfs container/합성 DB `anvil_f18_r33_qa`, 비-superuser migrator `anvil_oidc_r33_migrator` 및 SELECT 전용 reader `anvil_oidc_r33_reader`만 사용한다. owner Main, 수명 이번 한 번의 격리 QA, 사용 후 exact container ID·checkout marker·port·기존 서비스 ID/status를 확인해 전용 자원만 제거한다. 합성 DB/role/password는 container 제거로 폐기된다.
- 기존 `local-postgres` ID prefix `99f3bf939d40` Up, `anvil-web` ID prefix `f0107aada3b2` Up/healthy는 보존 대상으로 재확인했다. 공유 DB·다른 container/network/Secret·ysna-server·Production은 대상이 아니다. 이번 실측은 R33 세션 저장소 migration/DB clock/중복·철회/lock mutation/권한 거부 범위이며 실제 issuer/session coordinator/API/browser/정식 WSL 통합은 미검증이다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R33 OIDC session store 격리 PG18 QA 및 writer 회수 준비 / 2026-09-26

- 판정: `R33_WSL_PG18_QA_PASS_WRITER_REVOCATION_PENDING`. Main은 공개 제품 SHA `0b33263bdc01f5ca1422cec32936862967d94228`을 WSL-server의 clean detached 전용 checkout에서 검증했다. 고정 PG18 image `sha256:b551e63a5606bdd3127b12a8120c6df8d71c812b29a7faf944b034cb9beb644a`, tmpfs container `anvil-f18-r33-pg18-qa`, 합성 DB·비관리자 역할을 사용했다. exact9 focused 155 PASS/8 SKIP/7 warning, SELECT-only reader get PASS·INSERT SQLSTATE 42501, 최종 wrapper `QA_EXIT=0`; 실제 R33 PG opt-in 5 PASS다. 제품 보고서 commit `a4ab454056d233e185ae0baf74de40a393d6a316`이 원격 branch에 push됐다.
- 오류·조치: 전송 CR 문자의 1회차 wrapper exit127(그 안 pytest 155 PASS), 초기 PostgreSQL 임시 서버 readiness 경합의 2회차 wrapper exit2를 각각 실패로 기록한다. 둘 다 전용 자원 cleanup 잔여0. 세 번째 동일 제품 SHA에서 최종 exit0을 확인했으나 base64 전송 계층 경고는 남아 있다. 종료 후 Main 독립 재확인에서 checkout/container/loopback port 잔여0, 기존 `local-postgres` ID prefix `99f3bf939d40` running 및 `anvil-web` ID prefix `f0107aada3b2` running/healthy 불변. 정식 Developer FAILURE_REPORT 0회다.
- 영향·미검증·다음: R33 session store migration/DB clock/TTL/중복·철회/downgrade lock/reader 권한 경계만 PASS다. 전체 pytest의 기존 13 collection ERROR는 non-green; 실제 issuer·session coordinator·API/browser·정식 WSL 통합 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. Main은 close control QA 후 seq1597 write lease→1598 worker lease 순으로 회수, G-05와 상태·원격 checkpoint를 확인한다. 새 branch·PR·main 병합은 현재 하지 않는다.

# F-18 R33 OIDC session store checkpoint / 2026-09-26

- 판정: `R33_SESSION_STORE_CHECKPOINT_COMPLETE`. Main은 control QA `a3638c7190e44bcabb4066fde188dc7eda79ec08` 이후 canonical seq1597 `WRITE_LEASE_REVOKED`→seq1598 `WORKER_LEASE_REVOKED`를 투영해 `721fd94`로 원격 branch에 push했다. 두 lease=null, `active_agent=main-agent-eoul`, G-05 sequence1598 PASS(exit0), R33 start/close overlay test 4 PASS(exit0), branch clean·원격 HEAD 일치다. QA 전용 로컬 script와 두 pytest temp directory는 정확한 경로를 확인해 제거했으며 WSL checkout/container/port 잔여0이다.
- 범위·다음: 제품 exact SHA `0b33263bdc01f5ca1422cec32936862967d94228`에 대한 R33 영속 session 저장 경계만 검증했다. 로컬 전체 pytest 기존 collection 13 ERROR, 실제 issuer·session coordinator/API/browser·정식 WSL 통합은 미검증이고 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다. 같은 `codex/f18-wsl-ops` branch에서 다음 안전 작업은 승인 F-18 범위의 OIDC session coordinator Stage 준비이며, 새 branch·PR·main 병합은 하지 않는다.

# F-18 R34 OIDC session coordinator control 준비 / 2026-09-26

- 판정: `R34_CONTROL_QA_PENDING_CANONICAL_LEASE`. 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·원격 `80ec27ab62215ff853dbee8371046bc354ca0ec8`, clean, G-05 seq1598 PASS, worker/write lease=null을 확인했다. 관련 R30~R33 scoped baseline 122 PASS/7 warning(exit0). 승인 F-18 인증 범위의 내부 결합을 coordinator(R34)와 same-origin API(후속)로 분리하며 공개 API·runtime·DB schema·기존 서비스 변경은 제외했다.
- control 변경: R34 계획·WorkInstruction·Invocation, epoch18 overlay·checker dispatch·overlay test. control test 2 PASS(exit0), exact3/서로 다른 fencing token 확인 PASS. 계획은 verified code-flow→R32 server authority→R33 SHA-256 session 저장, 매 요청 재조회, 만료·철회·step-up fail-closed를 고정한다. 다음은 exact control QA commit/push 후 seq1599 WorkInstruction→1600 worker→1601 write lease를 투영하고 G-05 PASS를 확인하여 `developer-primary` 단일 writer에게 RED→GREEN 구현을 전달한다. 제품 변경0, 정식 Developer 실패0, 실제 issuer/API/browser·R34 WSL 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R34 OIDC session coordinator canonical writer 임대 발행 / 2026-09-26

- 판정: `R34_CANONICAL_WRITER_LEASE_ACTIVE`. Main은 control QA `46145073464ebdb020440e9d8c9d7aa83dd1c26d`와 seq1599 `WORK_INSTRUCTION_ISSUED`→1600 `WORKER_LEASE_ISSUED`→1601 `WRITE_LEASE_ISSUED` 투영 `a2d424508730ca4f4f34fd987bcd9ae1cd6556f2`를 지정 SSH 원격에 게시했다. epoch18 실행/write fencing token은 R33과 다르며 제품 exact3(`oidc_session_coordinator.py`, 해당 API 테스트, F-18 보고서)에만 결박된다. G-05 seq1601 PASS, control test 2 PASS(exit0), branch clean·원격 HEAD 일치다.
- 조치·다음: `developer-primary` 단일 writer에게 R34 RED→GREEN 구현과 기본 검증을 전달한다. Main은 제품 파일을 수정하지 않는다. 제품 변경0, 정식 Developer 실패0, 실제 issuer/API/browser·WSL R34 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R34 OIDC session coordinator 격리 WSL QA 생성 전 계획 / 2026-09-26

- 판정: `R34_PRODUCT_REVIEW_APPROVED_WSL_PENDING`. Main은 제품 SHA `4bf30ebae255b9c094c72ce18f400bf4fd7bec99`와 false PASS 테스트 보완 SHA `03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4`를 같은 branch에 push했고 G-05 seq1601 PASS·branch clean·원격 HEAD 일치다. 독립 review의 Important 1건은 nonce와 fixture clock을 맞춘 테스트 및 in-memory guard 제거 mutation RED로 ADDRESSED; scoped Spec PASS/Task quality Approved, Critical 0/Important 0. Main focused 220 PASS/PG opt-in 13 SKIP/기존 warning8(exit0); 전체 pytest 기존 collection 13 ERROR는 전체 PASS가 아니다. Reviewer Minor 1건은 보고서의 signed flow→중복 난수 검사→server binding 순서가 부정확한 문구로, 후속 문서 보완 대상으로 추적한다. 정식 Developer 실패0.
- 생성 전 read-only WSL-server inventory: 전용 checkout `/home/daon/anvil-f18-r34-coordinator-qa`는 부재다. QA는 원격 공개 제품 SHA `03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4`의 clean detached Git checkout과 전용 `.venv`·uv cache·pytest temp만 사용한다. Docker/container/DB/port는 새로 만들지 않는다. owner Main, 수명 이번 한 번의 same-SHA scoped QA, 사용 후 exact root realpath·비-symlink·기존 서비스 ID/status를 확인해 전용 checkout만 제거한다.
- 기존 `local-postgres` ID prefix `99f3bf939d40` running, `anvil-web` ID prefix `f0107aada3b2` running/healthy는 보존 대상이다. 공유 DB·다른 container/network/Secret·ysna-server·Production은 대상이 아니다. 이번 실측은 R34 signed-token/SQLite coordinator 및 R30~R33 관련 회귀의 WSL 환경 반복일 뿐 PostgreSQL 실제 결합·issuer 네트워크·API/browser·정식 WSL 통합 PASS로 승격하지 않는다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R34 OIDC session coordinator WSL QA 및 writer 회수 준비 / 2026-09-26

- 판정: `R34_WSL_SCOPED_QA_PASS_WRITER_REVOCATION_PENDING`. Main은 공개 제품 SHA `03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4`를 WSL-server의 clean detached 전용 checkout에서 검증했다. uv locked dev environment, exact11 focused 220 PASS/13 PG opt-in SKIP/7 warning, wrapper `QA_EXIT=0`. 종료 cleanup과 Main 독립 재확인에서 전용 checkout 잔여0, 기존 `local-postgres` ID prefix `99f3bf939d40` running 및 `anvil-web` ID prefix `f0107aada3b2` running/healthy 불변이다. 제품 보고서-only commit `932d8f28a4514ab10893a28c36648e4d50b0a68c`가 원격 branch에 push됐고, 독립 리뷰 Minor 표현 오류도 실제 실행 순서로 정정됐다. 정식 Developer 실패0.
- 영향·미검증·다음: R34 signed-token/SQLite coordinator와 R30~R33 관련 WSL scoped 반복만 PASS다. PG opt-in 13 SKIP, 로컬 전체 pytest 기존 13 collection ERROR, 실제 issuer·same-origin API/browser·PostgreSQL coordinator 결합·정식 WSL 통합 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. Main은 close control QA 후 seq1602 write lease→1603 worker lease 순으로 회수, G-05·상태·원격 checkpoint를 확인한다. 새 branch·PR·main 병합은 현재 하지 않는다.

# F-18 R34 OIDC session coordinator checkpoint / 2026-09-26

- 판정: `R34_SESSION_COORDINATOR_CHECKPOINT_COMPLETE`. Main은 control QA `f5374fc` 이후 canonical seq1602 `WRITE_LEASE_REVOKED`→seq1603 `WORKER_LEASE_REVOKED`를 투영해 `330f4e597b701a1ec97a7c5617b3c2fc84856988`로 원격 branch에 push했다. 두 lease=null, `active_agent=main-agent-eoul`, G-05 sequence1603 PASS(exit0), R34 start/close overlay test 4 PASS(exit0), branch clean·원격 HEAD 일치다. QA 전용 로컬 script와 두 pytest temp directory는 정확한 경로를 확인해 제거했으며 WSL checkout 잔여0이다.
- 범위·다음: 제품 exact SHA `03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4`에 대한 R34 signed-token/SQLite coordinator 경계만 검증했다. 로컬 전체 pytest 기존 collection 13 ERROR, PostgreSQL coordinator 실측·실제 issuer·same-origin API/browser·정식 WSL 통합은 미검증이고 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다. 같은 `codex/f18-wsl-ops` branch에서 다음 안전 작업은 승인 F-18 범위의 OIDC same-origin API Stage 준비이며, 새 branch·PR·main 병합은 하지 않는다.

# F-18 R35 OIDC HTTP adapter control 준비 / 2026-09-26

- 판정: `R35_CONTROL_PREPARATION`, 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·원격 `0d1c1d67771983f576a4f84d76073884ce703989`, clean, G-05 seq1603 PASS, worker/write lease=null. 승인 F-18 OIDC 범위의 same-origin API를 FastAPI 명시적 주입 경계로 한정한다. 공개 route는 `/auth/oidc/*`이고 기존 local test login·runtime/Web/DB/실제 issuer는 변경하지 않는다. R35 계획·WorkInstruction·Invocation을 작성했고 canonical lease·제품 write는 아직 없다.
- 로컬 baseline 임시 자원 계획: checkout 내부 `.pytest-f18-r35-baseline` 한 경로만, owner Main, 수명 관련 API 회귀 1회, Python `-B`와 pytest `-p no:cacheprovider` 사용. 생성 전 부재를 확인하고 종료 시 exact realpath·비-symlink·내용을 확인해 이 전용 temp만 정리한다. 기존 서비스·DB·Docker·브라우저·WSL-server·Secret은 변경하지 않는다.
- 다음: 관련 API baseline → R35 control overlay/checker/test와 정확한 scope 결박 → control QA commit/push → canonical epoch19 worker/write lease와 G-05 확인 → `developer-primary` 단일 writer TDD. 정식 실패0, 제품 변경0, 실제 issuer/API/browser/WSL 통합 미검증, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.
- 로컬 API baseline `tests/api/test_local_session.py tests/api/test_runtime_app.py tests/api/test_oidc_session_coordinator.py`는 `63 passed, 1 warning`, exit0. 지정 `--basetemp` 경로는 생성되지 않아 삭제 대상0. R35 계획·WI·Invocation, epoch19 overlay/checker dispatch/overlay test를 작성했고 control test 2 PASS(exit0), `git diff --check` PASS(exit0). 현재까지 제품 변경0, canonical lease0이다. 다음은 control diff·scope 검토 후 QA checkpoint push다.
- R34 start/close와 R35 control test를 dirty R35 준비 중 합쳐 실행했을 때 `5 passed, 1 failed`(pytest exit1)였다. 실패는 현재 R34 close projection이 후속 R35 미커밋 변경을 `F18_LOCAL_START_GIT_INVALID`/raw checksum으로 정확히 거부한 예상된 gate이며 R35 제품 실패가 아니다. 이 결과를 PASS로 표시하지 않는다. R35 control 단독 test는 2 PASS(exit0); R35 새 projection materialize 및 clean push 뒤 G-05를 다시 판정한다.

# F-18 R35 OIDC HTTP adapter WSL 격리 QA 생성 전 계획 / 2026-09-26

- 판정: `R35_PRODUCT_REVIEW_APPROVED_WSL_PENDING`. Main은 control QA `d6a26006d466af9879dee24bb9b845418dacfda9`, canonical epoch19 lease `5df390cd88b90cd9dcac528d53a005808b705339`, 제품 3 commit 최종 `eb0af553c36f191e0bd80949741e95ff4bc3012a`를 같은 `codex/f18-wsl-ops` branch에 지정 SSH alias로 게시했다. G-05 seq1606 PASS, branch clean·원격 HEAD 일치다. 독립 review의 Important 2건(event loop 차단, 직접 HTTP/HTTPS Origin 불일치)과 후속 Important 1건(실제 Nginx Host+XFP-only 호환성)은 같은 epoch/exact3 correction으로 모두 ADDRESSED; 최종 Critical0/Important0/Minor0. Main의 관련 6-file 독립 회귀 128 PASS/기존 warning1(exit0), 이전 dirty R34 gate 실패는 clean R35 checkpoint에서 control 6 PASS(exit0)로 해소했다. 전체 pytest 기존 collection 13 ERROR는 계속 non-green이며 정식 Developer 실패보고0이다.
- 생성 전 read-only WSL-server inventory: 전용 checkout `/home/daon/anvil-f18-r35-oidc-http-qa`는 부재다. QA는 원격 공개 제품 SHA `eb0af553c36f191e0bd80949741e95ff4bc3012a`의 clean detached Git checkout 및 그 내부 `.venv`, uv cache, `.pytest-r35`만 사용한다. Docker/container/DB/port/계정/Secret은 새로 만들지 않는다. owner Main, 수명 이번 한 번의 same-SHA scoped API 회귀다. 종료 시 exact realpath·비-symlink·owner·HEAD·dirty 상태를 확인한 뒤 그 전용 checkout만 제거하고 경로 잔류0과 기존 서비스 상태 불변을 확인한다. 소스는 지정 원격 commit으로 복구 가능하다.
- 보존 대상 read-only 관측: `local-postgres` ID prefix `99f3bf939d40` running, `anvil-web` ID prefix `f0107aada3b2` running/healthy. 별도 `local-postgres-pasu`/`local-postgres-alpha` 및 모든 공유 자원도 미변경 대상으로 둔다. 이번 WSL 검증은 TestClient/test double 중심 R35 HTTP 계약 반복이며 실제 issuer, PostgreSQL coordinator 결합, Web callback·브라우저 Network, 정식 WSL 통합 PASS로 승격하지 않는다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED.

# F-18 R35 OIDC HTTP adapter WSL QA 및 writer 회수 준비 / 2026-09-26

- 판정: `R35_WSL_SCOPED_QA_PASS_WRITER_REVOCATION_PENDING`. Main은 게시된 제품 SHA `eb0af553c36f191e0bd80949741e95ff4bc3012a`를 WSL-server의 전용 clean detached checkout에서 검증했다. uv locked development environment/Python3.14.3, exact 6-file scoped 128 PASS/7.47초/exit0. 최초 non-login shell에서 `uv` 명령 부재 1회(exit1)는 login shell `bash -lic`로 해소했으며 제품 실패로 계상하지 않는다. 종료 전 realpath exact·비-symlink·owner `daon`·HEAD exact·dirty0, 종료 후 전용 checkout 잔류0을 확인했다. 기존 `local-postgres` 99f3 및 `anvil-web` f010 healthy와 pasu/alpha는 ID/status 불변이다. 보고서-only commit `abb4c16d7a289c00df9c5cbe894e676e738bf71c`을 원격에 게시했고 G-05 seq1606 PASS·branch clean·원격 HEAD 일치다.
- 이 WSL 결과는 TestClient/test double 중심 HTTP 계약의 반복 증거일 뿐 실제 issuer·PostgreSQL coordinator·Web callback/브라우저 Network·정식 WSL 운영 유사 통합 증거가 아니다. 전체 pytest 기존 collection 13 ERROR는 non-green, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED다. 리뷰 Critical0/Important0/Minor0, Developer 정식 실패0. 다음은 close control QA 후 seq1607 write→1608 worker lease 회수, G-05·원격 checkpoint 확인이다.
# F-18 R36 OIDC runtime binding 준비 / 2026-09-26

- 판정: `R36_CONTROL_PREPARATION`, 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·지정 원격 `8570ab4d0d723db9b3ec4349f20d245ffe9628a2`, 시작 시 clean, canonical seq1608 worker/write lease=null. F-18 기본 WorkInstruction과 실제 `create_runtime_app`/R35 HTTP 결선을 대조해 다음 내부 Stage를 OIDC 명시 mode·신뢰 coordinator·업무 scope resolver의 fail-closed 주입으로 한정했다.
- 변경 파일: `docs/work_orders/F-18_WSL_OPS_R36_OIDC_RUNTIME_BINDING_PLAN.md`, `docs/work_orders/F-18_WSL_OPS_R36_OIDC_RUNTIME_BINDING_WORK_INSTRUCTION.md`, `docs/work_orders/F-18_WSL_OPS_R36_OIDC_RUNTIME_BINDING_INVOCATION.md`, 본 WORK_STATUS. 제품 코드 변경0, QA 자원 생성0, 정식 Developer 실패0. R36은 기존 `COOKIE`/`WSL_ACCEPTANCE` 보존과 혼합 인증 거부를 TDD로 확인하고, 실제 issuer 구성·ASGI/Web·PG/WSL 통합은 다음 범위로 명시한다.
- 오류·미검증·다음: 전체 pytest 기존 collection 13 ERROR는 non-green이며 R36 테스트는 아직 미실행이다. 새 issuer/Secret/DB/브라우저/WSL/Production 검증도 실행하지 않았다. 다음은 R36 control overlay와 exact3 lease 결박·control QA·G-05 후 `developer-primary` 단일 writer에게 TDD를 전달하는 것이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. Rollback은 이 준비 문서 commit의 정상 revert다.
- 로컬 baseline 임시 자원 계획: checkout 내부 `.pytest-f18-r36-baseline` 한 경로만, owner Main, 수명 관련 runtime/API 회귀 1회. 생성 전 부재를 확인하고 종료 시 exact 경로·비-symlink·내용을 확인해 이 경로만 정리한다. 기존 서비스·DB·Docker·브라우저·WSL-server·Secret은 변경하지 않는다.
- 로컬 baseline 명령 `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.pytest-f18-r36-baseline tests/api/test_runtime_app.py tests/api/test_oidc_http.py tests/api/test_local_session.py` → 73 PASS/기존 warning1/exit0. 지정 임시 경로는 생성되지 않아 삭제 대상0. 준비 중 G-05는 `F18_LOCAL_START_GIT_INVALID`/`F18_R35_CLOSE_RAW_CHECKSUM_INVALID`/exit1로 예상대로 non-green이며, R36 control overlay·clean projection 뒤 재판정해야 한다. 이는 R36 제품 실패가 아니다.
- R36 control overlay/checker dispatch/overlay test를 작성했다. 신규 파일은 `scripts/f18_wsl_ops_r36_oidc_runtime_binding_overlay.py`, `tests/tooling/test_f18_wsl_ops_r36_oidc_runtime_binding_overlay.py`; checker에는 R36 START mode dispatch만 추가했다. 아직 canonical lease 발행·제품 write 없음. control test와 diff를 확인한 뒤 QA checkpoint를 게시한다.
- R36 control test `python -B -m pytest -q -p no:cacheprovider tests/tooling/test_f18_wsl_ops_r36_oidc_runtime_binding_overlay.py` 2 PASS/exit0, `git diff --check` exit0. exact3·epoch20의 서로 다른 execution/write token·predecessor seq1608를 코드로 확인했다. 현재 새 projection materialize 전이므로 G-05 PASS 또는 R36 제품 완료를 선언하지 않는다.
- control 준비 commit `96376f3` 직전 staged diff check에서 신규 overlay의 EOF 공백 1건이 검출됐다. 명령 묶음이 그 실패에도 commit을 계속 실행한 절차 오류 1회를 기록한다. EOF만 후속 diff로 수정했으며 제품 파일·lease에는 영향이 없다. 이 상태를 검증 완료로 간주하지 않고 diff-check와 control test를 다시 실행한 후 별도 정상 commit으로 보완한다. 기존 commit을 amend/재작성하지 않는다.

# F-18 R36 OIDC runtime binding WSL 격리 QA 생성 전 계획 / 2026-09-26

- 판정: `R36_PRODUCT_REVIEW_APPROVED_WSL_PENDING`. Main은 control QA `13268e3`와 canonical epoch20 lease `f302035`, 제품 exact3 SHA `5f1b57a21b1b874d3e6af9c6f92605bce9c11c13`을 동일 `codex/f18-wsl-ops` branch에 지정 SSH alias로 게시했다. G-05 seq1611 PASS·branch clean·원격 HEAD 일치다. Developer TDD 11 RED→11 GREEN, 관련 6-file 139 PASS, Main 동일 6-file 독립 회귀 139 PASS/기존 warning1(exit0). 전체 pytest 기존 13 collection ERROR는 non-green이다. 독립 read-only review는 Critical0/Important0, Minor1(ConsoleOwner의 실제 restore principal 소비는 이번 합성 테스트 밖)이며 이 Minor는 후속 실 DB/console 통합에서 검증한다. 정식 Developer 실패보고0.
- 생성 전 read-only WSL-server inventory: 전용 checkout `/home/daon/anvil-f18-r36-oidc-runtime-qa` 부재, 기존 `local-postgres` ID prefix `99f3bf939d40` running, `anvil-web` ID prefix `f0107aada3b2` running/healthy, 다른 프로젝트 container도 보존 대상으로 확인했다. QA는 지정 원격 공개 제품 SHA `5f1b57a21b1b874d3e6af9c6f92605bce9c11c13`의 clean detached Git checkout과 그 내부 `.venv`, uv cache, `.pytest-r36`만 생성한다. Docker/container/DB/port/계정/Secret은 만들지 않는다. owner Main, 수명 이번 1회의 same-SHA scoped 회귀, 사용 후 checkout의 exact realpath·비-symlink·owner·HEAD·dirty를 확인한 뒤 이 전용 checkout만 제거하고 경로 잔류0과 기존 서비스 ID/status 불변을 확인한다. 소스는 지정 원격 commit으로 복구 가능하다.
- 이번 WSL 테스트는 R36 runtime/TestClient 계약의 동일 SHA 반복이다. 실제 issuer/JWKS·PostgreSQL coordinator·Web callback/브라우저 Network·정식 WSL 통합 PASS로 승격하지 않는다. `ysna-server`/Production은 대상이 아니며 F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다.

# F-18 R36 OIDC runtime binding WSL scoped QA 및 writer 회수 준비 / 2026-09-26

- 판정: `R36_WSL_SCOPED_QA_PASS_WRITER_REVOCATION_PENDING`. Main은 공개 제품 SHA `5f1b57a21b1b874d3e6af9c6f92605bce9c11c13`을 WSL-server의 전용 clean detached checkout에서 검증했다. uv locked dev/Python3.14.3, exact 6-file scoped 139 PASS/8.58초/exit0. 종료 전 realpath exact·비-symlink·owner `daon`·HEAD exact·dirty0, 종료 후 전용 checkout `QA_RESIDUE=0`을 확인했다. 기존 `local-postgres` ID99f3 running 및 `anvil-web` IDf010 healthy 불변이다. Developer가 WSL 결과를 보고서-only commit `8464cb1584c18e0ccf6346d303787f0428a887ca`에 이관했고 지정 원격 branch에 게시했다. G-05 seq1611 PASS·branch clean·원격 HEAD 일치다.
- 오류·미검증: 최초 WSL clone wrapper exit1은 SSH 문자열의 `$()`를 PowerShell이 로컬에서 선확장한 Main 명령 인용 오류 1회다. 실제 checkout 생성·SHA는 별도 읽기 전용 검사로 확인했고 이어진 uv 설치·scoped 테스트·정리는 exit0이었다. 최초 wrapper 실패를 PASS로 표시하지 않는다. 전체 pytest 기존 13 collection ERROR는 non-green이며 실제 issuer/JWKS·PostgreSQL coordinator·Web callback/브라우저·정식 WSL 운영 유사 통합·Production은 미검증이다. 독립 리뷰 Critical0/Important0/Minor1, Developer 정식 실패0. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다.
- 다음: R36 close control QA 후 seq1612 write lease→1613 worker lease 순으로 회수하고 G-05·원격 checkpoint 확인. 새 branch·PR·main 병합은 현재 하지 않는다. Rollback은 R36 제품 commit의 정상 revert이고 QA 전용 checkout은 이미 제거되어 복구할 임시 DB/container가 없다.
- R36 close overlay/checker dispatch/close test를 작성했다. dirty 준비 상태에서 start+close control test 묶음은 `3 PASS/1 FAIL`(pytest exit1)이며 start test가 새 close 파일·WORK_STATUS 변경에 따른 `F18_LOCAL_START_GIT_INVALID`/raw checksum 변경을 정확히 거부했다. 명령 뒤 연결된 출력 명령 때문에 wrapper exit0이었지만 pytest는 실패로 기록한다. close 단독 control test는 2 PASS/exit0이다. clean close projection 이후 start/close 묶음과 G-05를 다시 판정한다.

# F-18 R36 OIDC runtime binding checkpoint / 2026-09-26

- 판정: `R36_OIDC_RUNTIME_BINDING_CHECKPOINT_COMPLETE`. Main은 close control QA `21b11effc507097b332e1b00bb4b54b0da8547b1` 뒤 canonical seq1612 `WRITE_LEASE_REVOKED`→1613 `WORKER_LEASE_REVOKED`를 투영해 `95570d8`로 동일 원격 branch에 게시했다. 두 lease=null, `active_agent=main-agent-eoul`, G-05 seq1613 PASS(exit0), R35/R36 start·close control test 8 PASS(exit0), branch clean·원격 HEAD 일치다. WSL 전용 checkout 잔류0, 기존 서비스 ID/status 불변이다.
- 범위·다음: 제품 SHA `5f1b57a21b1b874d3e6af9c6f92605bce9c11c13`에 대한 R36 로컬·동일 SHA WSL scoped 139 PASS와 독립 리뷰 Critical0/Important0만 확인했다. 전체 pytest 기존 collection 13 ERROR, 실제 issuer/JWKS·PostgreSQL coordinator·ASGI/Web callback·브라우저·정식 WSL 운영 유사 통합은 미검증이다. 독립 리뷰 Minor1(ConsoleOwner 실제 restore principal 소비) 후속 추적. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED. 같은 branch의 다음 안전 작업은 승인 F-18 범위의 issuer/JWKS 구성과 서버 컴포넌트 결선 Stage 준비다. 새 branch·PR·main 병합은 하지 않는다.

# F-18 R37 OIDC trusted composition control 준비 / 2026-09-26

- 판정: `R37_CONTROL_PREPARATION`, 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·지정 원격 `77f2f4bd8e15cea808d5964c4394cd41a993a2b2`, clean, G-05 seq1613 PASS, worker/write lease=null. 승인 F-18 인증 범위에서 R7~R36의 기존 issuer transport·pinned JWKS verifier·one-use code flow·서버 DB directory/session을 하나의 신뢰된 구성 함수로 묶는 R37을 계획했다. ASGI/Web/DB schema/Secret 파일·deploy/실제 issuer는 제외한다.
- 변경 파일: R37 계획·WorkInstruction·Invocation, 본 WORK_STATUS. 제품 변경0, 새 QA 자원0, Developer 정식 실패0. 제품 예정 exact3는 `packages/api/oidc_runtime_factory.py`, `tests/api/test_oidc_runtime_factory.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. R37 계획은 endpoint를 issuer에서 파생하고 policy issuer·허용집합을 구성 시 fail-closed 확인하며 실측/fixture 경계를 분리한다. 다음은 baseline과 control overlay/checker/test·QA commit/push, canonical lease/G-05 확인 후 단일 writer TDD다.
- 로컬 baseline 임시 자원 계획: checkout 내부 `.pytest-f18-r37-baseline` 한 경로만, owner Main, 수명 R37 관련 API·persistence 기준선 회귀 1회. 생성 전 부재 확인, 종료 시 exact 경로·비-symlink·내용을 확인해 이 전용 경로만 정리한다. 기존 서비스·DB·Docker·브라우저·WSL-server·Secret은 변경하지 않는다. 전체 pytest 기존 collection 13 ERROR는 non-green, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED다.
- 로컬 baseline은 OIDC identity/transport/code-flow/principal/coordinator, 3개 SQLite persistence, runtime API의 9파일 `270 PASS/기존 warning8/exit0`이었다. `.pytest-f18-r37-baseline`은 생성됐으나 exact 경로·workspace 내부·비-symlink·내용 2개 pytest 하위 폴더를 확인하고 PowerShell 동일 shell에서 전용 경로만 제거해 `TEMP_RESIDUE=0`이다. 실제 issuer·PG18/API/browser/WSL 운영 유사 통합은 이 기준선으로 증명되지 않는다.
- R37 epoch21 control overlay/checker dispatch/overlay test를 작성했다. 신규 파일은 `scripts/f18_wsl_ops_r37_oidc_composition_overlay.py`, `tests/tooling/test_f18_wsl_ops_r37_oidc_composition_overlay.py`; checker에는 R37 START mode dispatch만 추가했다. canonical lease·제품 write는 아직 없다. control test와 exact3/scope/diff 검토 뒤 QA checkpoint를 지정 원격에 게시한다.
- R37 control 단독 test `python -B -m pytest -q -p no:cacheprovider tests/tooling/test_f18_wsl_ops_r37_oidc_composition_overlay.py` 2 PASS/exit0. 계획 자체 점검에서 제품 exact3·issuer 파생 endpoint·pinned JWKS·Secret 제공자 비식별·후속 ASGI/실측 미검증을 재확인했다. 신규 overlay의 생성 직후 EOF 공백은 commit 전에 제거했다. projection materialize 전 G-05 PASS나 제품 완료는 선언하지 않는다.

# F-18 R37 OIDC trusted composition WSL 격리 QA 생성 전 계획 / 2026-09-26

- 판정: `R37_REVIEW_APPROVED_WSL_SCOPED_QA_PENDING`. Main은 canonical epoch21 lease/G-05 seq1616 PASS를 확인하고 단일 writer의 제품·보고서 및 correction 최종 SHA `47ef331146825d05e88ae96b9ab49baf98ff0edb`를 기존 `codex/f18-wsl-ops` 지정 원격에 게시했다. 독립 리뷰 Important 2건(잘못된 issuer port 구성 전 거부, 활성 세션 revoke 증거)은 동일 lease·exact3에서 수정되어 재리뷰 Critical0/Important0/Minor0이다. Main의 11파일 독립 회귀는 327 PASS/기존 warning8/exit0이고 전용 로컬 basetemp 잔여0이다. bare 전체 pytest는 기존 13 collection ERROR로 non-green, 정식 Developer FAILURE_REPORT 0회다.
- 생성 전 read-only WSL-server inventory: 전용 checkout `/home/daon/anvil-f18-r37-oidc-composition-qa`는 부재(`test -e` exit1)이고 로그인 셸의 `uv 0.11.2`, Git 2.43.0을 확인했다. 기존 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy 및 그 밖의 공유 컨테이너는 보존 대상이다. QA는 공개된 정확한 SHA `47ef331146825d05e88ae96b9ab49baf98ff0edb`의 clean detached Git checkout과 그 내부 `.venv`, `.uv-cache`, `.pytest-r37`만 생성한다. Docker/container/DB/port/계정/Secret을 새로 만들거나 변경하지 않는다. Owner Main, 수명 이번 한 차례의 same-SHA 11파일 scoped 회귀다. 종료 전 checkout realpath exact·비-symlink·owner `daon`·HEAD exact·dirty0을 확인하고 이 전용 경로만 제거한 뒤 잔류0과 기존 서비스 ID/status 불변을 확인한다. 소스는 지정 원격 commit에서 복구 가능하다.
- 이 WSL 반복은 합성 서명 token·MockTransport·SQLite store를 사용하는 R37 조립 경계의 동일 SHA 증거다. 실제 issuer·PostgreSQL 18·host ASGI/Secret 결선·Web callback·브라우저 Network·정식 운영 유사 E2E는 미검증이며 `ysna-server`/Production은 대상이 아니다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다.

# F-18 R37 OIDC trusted composition WSL scoped QA 및 writer 회수 준비 / 2026-09-26

- 판정: `R37_WSL_SCOPED_QA_PASS_WRITER_REVOCATION_PENDING`. Main은 공개 제품 SHA `47ef331146825d05e88ae96b9ab49baf98ff0edb`를 WSL-server 전용 clean detached checkout에서 uv locked dev/Python3.14.3으로 시험했다. exact 11파일 scoped pytest 327 PASS/기존 SQLite warning7/9.66초/exit0, SHA·realpath·비-symlink·owner `daon` 확인 후 `.pytest-r37`을 별도 제거해 Git clean을 확인하고 전용 checkout만 제거했다(`QA_RESIDUE=0`). 기존 `local-postgres` ID99f3 running·`anvil-web` IDf010 healthy 및 다른 공유 컨테이너 ID/status 불변이다. 보고서-only commit `576fbc126928241f50910e8d3609a0ab2f72e2b5`은 지정 원격에 게시됐고 G-05 seq1616 PASS·branch clean·원격 HEAD 일치다.
- 오류·미검증: 로컬 RED 이전 테스트 구문 오류 1건, 임시 pytest 기본 폴더 ACL setup 오류 1건과 독립 리뷰 Important 2건은 보고서에 원인·보완을 구분했다. 정식 Developer FAILURE_REPORT 0회다. 전체 pytest 기존 collection 13 ERROR는 non-green이며 실제 issuer/JWKS·PostgreSQL 18·ASGI/Web callback·브라우저·정식 WSL 운영 유사 E2E·Production은 미검증이다. F-18 accepted=false, F-19 차단, Production NOT_EXECUTED다.
- 다음: R37 close control QA 후 seq1617 write lease→seq1618 worker lease 순으로 회수하고 G-05·원격 checkpoint 확인. 새 branch·PR·main 병합은 하지 않는다. 제품 rollback은 R37 commit의 정상 revert이며 임시 QA 자원은 이미 제거됐다.

# F-18 R38 OIDC host binding control 준비 / 2026-09-26

- 판정: `R38_CONTROL_PREPARATION`, 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD·지정 원격 `972e873bc2b3d57c79adb6aa03454d46fed4b764`, clean, G-05 seq1618 PASS, worker/write lease=null. F-18 승인 설계·계획·매트릭스·테스트계획·운영규칙 hash는 이전 binding과 일치하며 R37 제품 SHA `47ef331`의 로컬·WSL-server scoped 327 PASS와 독립 리뷰 C0/I0/M0를 보존한다.
- 내부 범위 선택: R37의 실제 OIDC coordinator를 신뢰된 명시 입력으로 기존 runtime+ASGI shell에 결선한다. 환경/Secret 로더·module-level 활성화·Compose/TLS·Web callback·실제 issuer/PG18는 이후 Stage로 분리한다. 새 공개 API, DB schema, Secret 저장소, Production 변경은 없다. 계획·WorkInstruction·Invocation과 본 WORK_STATUS 외 제품 변경0, 새 QA 자원0, 정식 Developer 실패0이다. 제품 예정 exact3는 `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다.
- 로컬 baseline 임시 자원 계획: checkout 내부 `.pytest-f18-r38-baseline` 한 경로, owner Main, 수명 R38 관련 API/ASGI/OIDC 회귀 1회. 생성 전 부재를 확인하고 종료 시 exact 경로·비-symlink·내용을 확인해 이 경로만 제거한다. 기존 서비스·DB·Docker·브라우저·WSL-server·Secret은 변경하지 않는다. 전체 pytest 기존 collection 13 ERROR는 non-green, F-18 accepted=false/F-19 차단/Production NOT_EXECUTED다.
- 로컬 baseline `tests/api/test_public_asgi_frontend.py test_runtime_app.py test_oidc_http.py test_oidc_runtime_factory.py test_oidc_session_coordinator.py test_local_session.py`는 136 PASS/기존 warning1/exit0(7.55초)이다. 지정 `.pytest-f18-r38-baseline`은 전후 모두 부재해 제거 대상0이며 새 DB/container/프로세스 자원0이다. 실제 issuer·PG18/WSL 운영 유사 통합 PASS는 아니다.
- R38 epoch22 control overlay/checker dispatch/overlay test를 작성했다. 신규 파일은 `scripts/f18_wsl_ops_r38_oidc_host_binding_overlay.py`, `tests/tooling/test_f18_wsl_ops_r38_oidc_host_binding_overlay.py`; checker는 R38 START mode를 분기한다. 단독 control test 2 PASS/exit0, exact3·서로 다른 두 fencing token·R37 seq1618 predecessor 경로를 점검했다. 아직 projection materialize·제품 write가 없으므로 dirty 준비 단계의 G-05를 PASS로 선언하지 않는다. 다음은 control diff·manifest 재결박 후 clean checkpoint push다.
- 2026-09-26 F-18 R38 independent review correction: Main 판정 `REWORK_WITHIN_APPROVED_SCOPE`. 독립 reviewer는 제품 SHA `41207282dd64621299ef64f3faff77bf2acb063d`의 exact3와 신규 17 PASS를 확인했으나 Critical0/Important2를 재현했다. I-1 주입 `session_factory` 사용 시 `runtime.py`의 `engine=None` 때문에 `/health/ready`가 503 `database_unavailable`; I-2 `urlsplit`이 console URL 내부 LF/TAB/CR을 제거해 잘못된 구성으로 앱 생성 후 authorization 403이 된다. 이 단계는 R38 기존 host binding·fail-closed 목표의 구현 보완이며 새 기능·요구사항·중요 위험·외부 HTTP/DB schema/Secret/deploy 범위 변경이 아니다. Main이 내부 R38 plan을 명시 Engine 입력·동일 bind 검증·ready 200/head mismatch 503 및 제어문자 사전 거부로 비의미 revision했다(새 SHA-256 `7F3091431E16269260041CFE653314CF0282983FB76F55E8F8958D206E711A3C`). Canonical 설계/작업계획/WorkInstruction hash와 epoch22 두 lease·exact3는 유지한다. Main 독립 7파일 회귀 153 PASS/기존 warning1/exit0; bare 전체 기존 13 collection ERROR non-green. 제품 정식 FAILURE_REPORT 0회, 독립 리뷰 correction 1회(Important 2건). 다음: 같은 writer/lease로 exact3 RED→GREEN 보완 후 재리뷰·원격 push·WSL-server 동일 SHA QA. 이 준비 단계에서 실제 issuer/PG18/browser/Production은 미실행, F-18 accepted=false, F-19 차단이다.
- 2026-09-26 F-18 R38 WSL-server scoped QA 사전 자원 기록: Main은 독립 재리뷰 C0/I0/M0, 로컬 16파일 422 PASS/기존 warning8/exit0, 제품 SHA `7c635006fb2fe9878d91580f2a80bf13db2663d8` 원격 게시, branch clean·G-05 seq1621 PASS를 확인했다. QA 전용 경로 `/home/daon/anvil-f18-r38-oidc-host-qa`는 `ssh WSL-server` 읽기 전용 검사에서 부재다. Owner Main, 수명 이번 한 차례의 same-SHA scoped 회귀까지. 지정 Git 원격의 정확한 SHA를 clean detached checkout으로 받으며 그 안의 `.venv`, `.uv-cache`, `.pytest-r38`만 새로 만들 수 있다. Docker/container/DB/port/계정/Secret은 생성·변경하지 않는다. 기존 `local-postgres` ID `99f3bf939d40` running 및 `anvil-web` ID `f0107aada3b2` healthy와 다른 공유 컨테이너 ID/status를 QA 전후 비교한다. 종료 전에 realpath exact·비-symlink·owner `daon`·HEAD exact·temporary path를 확인하고 전용 checkout만 제거해 QA_RESIDUE=0을 확인한다. 동일 SHA scoped PASS만 판정하며 실제 issuer/PG18/Web/browser/Production과 bare 전체 pytest 기존 13 collection ERROR는 미검증/non-green이다.
- 2026-09-26 F-18 R38 WSL-server QA 및 close 준비: Main은 전용 clean detached checkout `/home/daon/anvil-f18-r38-oidc-host-qa`에서 제품 SHA `7c635006fb2fe9878d91580f2a80bf13db2663d8`을 검증했다. uv locked dev/Python3.14.3(43 packages), 계획된 16파일 scoped pytest **422 PASS/SQLite 기존 warning7/17.33초/exit0**. 종료 전 realpath exact·비-symlink·owner `daon`·HEAD exact 확인; `.pytest-r38` 내부 symlink target이 전용 경로 안임을 확인하고 링크→temp 제거, Git clean 뒤 전용 checkout만 제거해 `QA_RESIDUE=0`. 기존 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy 및 다른 공유 container ID/status 전후 동일. Developer가 보고서-only commit `7475eaca3aa00cc367ff0ec61f05035066c47da4`에 Main 결과를 이관했다. 로컬 독립 422 PASS/기존 warning8와 reviewer C0/I0/M0는 별도 근거다. 전체 pytest 기존 13 collection ERROR, 실제 issuer/PG18/Web/browser/정식 WSL 운영 유사 통합/Production은 non-green/NOT_EXECUTED이고 F-18 accepted=false/F-19 blocked다. Main은 R38 close control plan/overlay/test/checker 준비 및 신규 모듈 부재의 의도한 RED 2 FAIL→control test 2 PASS를 수행했다. 오류 횟수: Developer 정식 FAILURE_REPORT 0, reviewer correction 1회(Important 2건 해소), WSL QA 제품 오류0. 다음은 보고서·control 준비 commit push 후 clean 원격 HEAD에서 seq1622 write→1623 worker lease 회수, close G-05 검증이다.
- 2026-09-26 F-18 R39 OIDC host configuration control 준비: Main은 R38 close seq1623, `codex/f18-wsl-ops` HEAD/지정 원격 `3fcaae976c23953644991fe48061c87e33723f51`, clean, G-05 PASS, worker/write lease=null을 실측했다. 승인 설계·계획·매트릭스·테스트계획·운영규칙 hash는 F-18 binding과 일치한다. 다음 내부 단계는 기존 R38 factory 앞에서 비밀이 아닌 OIDC issuer/client ID/step-up ACR 3개만 server-only environment에서 받으며 pinned JWKS/policy/client-secret provider/DB Engine은 신뢰된 주입 그대로 유지하는 R39다. Unknown `ANVIL_OIDC_*`·Secret/JWKS 환경값·누락/제어문자를 앱 노출 전에 비식별 거부한다. Module-level 활성화·Secret 파일/환경 loader·TLS/Compose·실제 issuer/PG18/Web/browser/Production 변경은 없다. 제품 예정 exact3는 `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`; Main control 계획·WI·Invocation과 본 WORK_STATUS만 준비했다. 기존 테스트 `tests/api/test_oidc_asgi_binding.py tests/api/test_oidc_runtime_factory.py` baseline은 53 PASS/기존 warning1/exit0, 새 QA 자원0, 정식 Developer 실패0. F-18 accepted=false/F-19 blocked, bare 전체 pytest 기존 13 collection ERROR non-green. 다음은 R39 control overlay/checker/test와 canonical 새 lease를 결박한 뒤 단일 writer TDD다.
- R39 control preparation: 신규 `scripts/f18_wsl_ops_r39_oidc_host_config_overlay.py`와 `tests/tooling/test_f18_wsl_ops_r39_oidc_host_config_overlay.py`를 추가하고 checker에 R39 START mode 분기를 연결했다. Control 테스트는 신규 모듈 부재 의도 RED 2 FAIL→overlay 작성 후 2 PASS/exit0이다. 제품 수정0·새 QA 자원0·정식 실패0. 준비 상태 dirty/새 control 경로로 이전 R38 close G-05는 PASS가 아니며, 정확한 control 파일만 commit/push해 clean 선행 상태에서 canonical seq1624~1626 WorkInstruction→worker→write lease를 투영한 뒤 새 G-05를 확인한다.
- 2026-09-26 F-18 R39 WSL-server scoped QA 사전 자원 기록: Main은 제품 exact3 commit `51f3964fae64f20907726f73c8c2fd83cce3fa5d`를 기존 `codex/f18-wsl-ops` 지정 원격에 push했고, 독립 reviewer C0/I0/M0·Main 로컬 16파일 435 PASS/기존 warning8/exit0·G-05 seq1626 PASS를 확인했다. QA 전용 경로 `/home/daon/anvil-f18-r39-oidc-host-config-qa`는 `ssh WSL-server` 읽기 전용 검사에서 부재다. Owner Main, 수명 이번 한 차례의 동일 SHA scoped 회귀까지. 지정 Git SSH alias에서 정확한 SHA를 clean detached checkout으로 받으며 그 안의 `.venv`, `.uv-cache`, `.pytest-r39`만 새로 만들 수 있다. Docker/container/DB/port/계정/Secret은 생성·변경하지 않는다. 기존 공유 컨테이너 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy와 다른 공유 컨테이너 ID/status를 QA 전후 비교한다. 종료 전에 realpath exact·비-symlink·owner `daon`·HEAD exact·temporary path를 확인하고 전용 checkout만 제거해 QA_RESIDUE=0을 확인한다. 동일 SHA scoped PASS만 판정하며 bare 전체 pytest 기존 13 collection ERROR, 실제 issuer/PG18/Web/browser/Production은 non-green/NOT_EXECUTED다.
- 2026-09-26 F-18 R39 WSL-server QA 및 close 준비: 지정 제품 SHA `51f3964fae64f20907726f73c8c2fd83cce3fa5d`의 clean detached 전용 checkout에서 Python3.14.3/locked dev 43개 패키지를 구성하고 계획된 16파일을 **435 PASS/SQLite 기존 warning7/15.54초/exit0**으로 검증했다. `.pytest-r39` 내부 symlink target이 전용 경로 안임을 확인해 링크→temp→전용 checkout 순서로 제거했고 `QA_RESIDUE=0`이다. 기존 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy 및 다른 공유 컨테이너 ID/status는 전후 동일하다. Developer는 Main 결과를 보고서-only `c95c5c03cd2c3e47e2ee557239bc75b54c8460c7`에 이관했고 지정 원격에 게시했다. Main 독립 로컬 435 PASS/warning8, reviewer C0/I0/M0/66 PASS는 별도 근거다. bare 전체 pytest 기존 13 collection ERROR, 실제 issuer/PG18/Web/browser/정식 운영 유사 통합/Production은 non-green/NOT_EXECUTED, F-18 accepted=false/F-19 blocked다. Main은 R39 close control plan/overlay/test/checker 준비 및 의도한 RED 2 FAIL→control 2 PASS를 수행했다. 오류 횟수: Developer 정식 FAILURE_REPORT 0, reviewer correction 0, WSL QA 제품 오류0. 다음은 정확한 close control 준비 commit/push 후 clean 원격 HEAD에서 seq1627 write→1628 worker lease 회수와 G-05 검증이다.
- 2026-09-26 F-18 R40 live OIDC host QA 준비: Main은 R39 close seq1628, HEAD/지정 원격 `8969e4e57b543131fd231ad1047d68695217bed7`, clean, G-05 PASS, worker/write lease=null을 실측했다. 승인 설계·계획·매트릭스·테스트계획·운영규칙 hash는 binding과 동일하다. 다음 내부 Stage는 R39 factory를 합성 QA issuer·API 두 실제 루프백 HTTPS listener에서 활성화해 OIDC authorization→token exchange→callback/session을 확인한다. 변경 예정 exact3는 `tests/integration/f18_oidc_live_host.py`, `tests/integration/test_f18_oidc_live_host.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`이며 제품 runtime/ASGI·Web·DB/migration·Compose·운영 Secret 저장·배포 변경0이다. 로컬 baseline OIDC ASGI/factory 2파일 66 PASS/기존 warning1/exit0, 정식 Developer 실패0. QA 자원은 각 pytest 실행에 한정한 `127.0.0.1:0` OS 할당 issuer/API 두 listener, 테스트 전용 임시 TLS/RSA 키·cert와 SQLite DB/engine이다. Owner Developer(로컬), Main(WSL 동일 SHA 재검증); 수명 각 실행 동안만이며 `finally`에서 listener/thread/socket/임시 키·cert/DB를 닫고 잔류를 확인한다. 실제 할당 port는 실행 증거에 기록한다. 외부 issuer·실제 계정/Secret·공유 Docker/DB/port는 사용·변경하지 않는다. bare 전체 pytest 기존 13 collection ERROR, 실제 PG18·정식 WSL 운영 유사 통합/Web/browser/Production은 non-green/NOT_EXECUTED, F-18 accepted=false/F-19 blocked다. 다음은 R40 control overlay/checker/test와 canonical 새 lease를 결박한 뒤 단일 writer TDD다.
- 2026-09-26 F-18 R40 동일 SHA QA와 close 준비: Developer exact3 제품 commit `bd82973a2e2527f3299feb7ae8e26a23c68fdc47`의 신규 실제 loopback HTTPS 7 PASS 및 이전 OIDC 16파일 435 PASS를 로컬에서 확인했다. Main 별도 로컬 신규+핵심 73 PASS, 지정 원격 push 후 WSL-server clean detached 동일 제품 SHA에서 신규 7 PASS/경고7/exit0 및 기존 435 PASS/경고7/exit0을 확인했다. QA 전용 `/home/daon/anvil-f18-r40-live-oidc-host-qa`는 생성 전 부재, owner Main, 한 차례 수명으로 제한했고 종료 전 realpath exact/owner `daon`/mode700/HEAD exact·내부 pytest symlink target을 검사한 뒤 전용 checkout만 제거해 QA_RESIDUE=0이다. 기존 공유 Docker ID/status는 전후 동일(`local-postgres` `99f3bf939d40` running, `anvil-web` `f0107aada3b2` healthy 포함). Developer가 Main 실측을 보고서-only `17f2ac603e68645d289be0a498be893ccb9381e6`에 이관했고 원격 게시됐다. Main의 잘못된 WORK_STATUS manifest 변경 시도 `d4ca35e`는 정상 revert `4ce9bd4`로 즉시 무효화되어 파일 내용/G-05 seq1631이 복구됐다; 정식 Developer FAILURE_REPORT 0, 제품 QA 실패0. Bare 전체 pytest 기존 13 collection ERROR, PG18·정식 Compose·Web/browser·Production은 NOT_EXECUTED, F-18 accepted=false/F-19 blocked. R40 close control 테스트는 모듈 부재 RED 2 FAIL→overlay 구현 GREEN 2 PASS였고 준비 control commit `27f2ed5`를 게시했다. 다음은 clean 원격 HEAD에서 seq1632 write→1633 worker lease 회수와 G-05 재검증이다.
- 2026-09-27 F-18 R41 OIDC PG18 통합 준비: Main은 R40 close `243ad642d2d091adcf429daa5084e0896455b945`, 기존 단일 branch `codex/f18-wsl-ops` local/지정 remote 동일·clean, G-05 seq1633 PASS, worker/write lease=null을 확인했다. 승인 정본 hash 5개는 F-18 binding과 일치한다. 로컬 R40 HTTPS+OIDC 핵심 73 PASS/경고7/exit0; 기존 PG opt-in 3파일은 DSN 부재로 13 SKIP/exit0이며 실제 PG18 PASS가 아니다. 실제 Alembic head는 `0019_oidc_sessions`이나 OIDC ASGI readiness는 0013/operational shell 0016 고정이라 R41 RED 대상이다. Main은 기존 R40 실제 TLS OIDC 흐름을 격리 PG18 Engine과 결합하는 승인 범위 내 내부 Stage로 분류했다. 제품 예정 exact5는 R41 Plan/WorkInstruction에 고정한다. WSL-server read-only 사전 검사에서 QA checkout `/home/daon/anvil-f18-r41-oidc-pg18-qa`, container `anvil-f18-r41-pg18-qa`, loopback port 35418이 부재하고 pinned PG18 image는 존재했다. 예정 자원은 위 exact checkout/container, DB `anvil_f18_r41_oidc`, role `anvil_f18_r41_app`, container 전용 tmpfs, pytest `.pytest-r41`, 테스트별 두 loopback HTTPS listener/임시 TLS/SQLite 대비 PG18 Engine이다. Owner Main(WSL), 수명 동일 SHA PG18 scoped QA 한 차례; 생성 전 다시 부재·공유 자원 ID를 확인하고 종료 시 exact 경로/ID/port/DB/role/volume residue0을 확인한다. 공유 `local-postgres`·기존 서비스/Secret·ysna-server는 사용·변경하지 않는다. 실제 credential 보안, 정식 Compose·Web/browser·Production은 미검증, F-18 accepted=false/F-19 blocked다. 다음은 R41 control overlay/checker/test와 신규 canonical lease 결박 후 단일 writer TDD다.
- 2026-09-27 F-18 R41 동일 SHA PG18 QA 및 종료 준비: Main은 seq1636 epoch25 exact5 lease/G-05 PASS에서 Developer 제품 commit `629858cfe1a4d17767cf484432be910e5c5282c7`을 지정 원격에 게시했다. Developer의 로컬 OIDC readiness RED 2 FAIL→관련 18파일 456 PASS/실제 PG18 1 SKIP, Main 별도 로컬 3파일 58 PASS/PG18 1 SKIP(exit0)를 확인했다. Bare 전체 pytest의 기존 13 collection ERROR는 non-green이다. WSL-server에서 같은 제품 SHA의 clean detached 전용 checkout, pinned PG18 image(`5a9c2dbe6ab5…`), 전용 tmpfs 컨테이너 `749eab0a832a…`/loopback 35418, DB `anvil_f18_r41_oidc`/비관리자 role `anvil_f18_r41_app`, PostgreSQL `server_version_num=180004`, Alembic `0019_oidc_sessions`를 확인했다. locked dev 설치(exit0), opt-in PG18 수직시험 15 PASS/경고1/exit0, 관련 3파일 59 PASS/경고8/exit0. QA loopback trust는 실제 credential 보안 증거가 아니다. 정확한 전용 checkout/container만 제거하고 `CHECKOUT_ABSENT`/`CONTAINER_ABSENT`/`PORT_FREE`, 라벨 볼륨 없음 및 공유 `local-postgres` `99f3bf939d40`/`anvil-web` `f0107aada3b2` healthy 유지를 확인했다. Developer가 Main 결과를 보고서-only `e7d1aa896fffd57b63fc7b494f42be467421f101`에 이관해 원격 게시했다. 정식 Developer FAILURE_REPORT 0, 제품 PG18 QA 오류0. F-18 accepted=false/F-19 blocked, 정식 Compose·브라우저·Production/ysna 미검증. R41 close control test는 신규 모듈 부재 RED 2 FAIL→복원 GREEN 2 PASS이며, 다음은 control 준비 commit/push 후 seq1637 write→1638 worker lease 회수와 G-05 재검증이다.

# F-18 R42 OIDC process bootstrap control 준비 / 2026-09-27

- 판정: `R42_CONTROL_PREPARATION`, 담당 Main. 시작 branch `codex/f18-wsl-ops`, HEAD/지정 원격 `9d9bda6063887091fe154dd9cc11297e9ba9607f`, clean, canonical seq1638·lease=null·G-05 PASS다. 승인 정본 5종 hash는 기존 binding과 일치한다. R41은 격리 PG18 OIDC 통합만 검증했고, 실제 `ANVIL_AUTH_MODE=OIDC` module import는 기존 `asgi.py:208`의 COOKIE session coordinator 요구로 exit1이다. `compose.f18.yml`의 OIDC env/TLS 결선 부재도 확인했으나 이번 Stage에서 수정하지 않는다. 기존 ASGI 원문·동적 import 검사의 결합 때문에 초안 factory 추출은 commit/lease 전에 폐기하고, 기존 마지막 `app` 선택만 OIDC에서 분기하는 exact4로 좁혔다. 기존 C30 AST 검사 1건은 R41 baseline에서도 실패하므로 신규 회귀로 오인하지 않는다.
- 변경·검증: R42 Plan/WorkInstruction/Invocation, control overlay/test/checker 및 본 WORK_STATUS만 준비했다. 제품 write0, WSL-server 자원 생성0, 실제 Secret/credential 사용0, 정식 Developer FAILURE_REPORT 0회. 로컬 baseline `tests/deploy/test_f18_role_images.py tests/deploy/test_f18_network_topology.py tests/api/test_oidc_asgi_binding.py` 65 PASS/기존 warning1/exit0; R42 control test는 모듈 부재 의도 RED 2 FAIL→2 PASS/exit0이다. 테스트별 합성 trust JSON/Secret/CA 파일은 로컬 pytest 임시 디렉터리에만 생성하고 테스트 종료 시 제거한다(Owner Developer, 각 pytest 실행 수명). WSL-server에서는 아직 자원 생성 없이 read-only로 `/srv/anvil-wsl/f18-ops-rehearsal` 부재, 전용 예정 port 8310/8311/32770/8444 free, 공유 `local-postgres`·`anvil-web` 정상 상태만 확인했다. 다음은 control 정확 경로 commit/push→clean 원격 HEAD에서 epoch26 seq1639~1641 투영·G-05 PASS→단일 writer exact4 TDD다. Bare 전체 pytest의 기존 collection 오류, 정식 Compose/TLS/browser/실제 issuer·credential/Production은 non-green/미검증, F-18 accepted=false·F-19 blocked다.
- R42 control 보정: epoch26 seq1641 생성 뒤, Main이 pre-dispatch 독립 검증에서 overlay의 선행 module chain 오기 1건과 checker의 `root` 인자 오기 1건을 검출했다. 첫 생성 산출물은 Main 소유 exact 경로만 회수하고 overlay 수정 commit을 원격 게시한 다음 동일 seq1641을 새 clean HEAD에서 재투영했다. 두 번째 검사에서 checker 오류를 재현하여 checker의 두 R42 분기를 `bundle["_root"]`로 보정하고, overlay의 post-QA 예외를 `checker`·`SELF` 두 control 경로로만 좁혀 manifest raw checksum을 재결박한다. 이는 Developer 정식 실패가 아닌 Main control 준비 오류 2건이며, 제품 write·Subagent dispatch·WSL 자원 생성은 0이다. G-05 전체 PASS 전에는 제품 작업을 시작하지 않는다.
- R42 Main 독립 리뷰/재검증 사전 자원 기록: Developer local exact4 `4e48ea5`에서 기존 운영형 ASGI `ANVIL_F15_OPERATIONAL_SHELL=1` 전달 누락 Important 1건을 확인하여 동일 lease·exact4 안에서 RED 3건→보완 commit `f169c22`/관련 69 PASS를 받았다. Main의 첫 Windows 독립 4파일 회귀는 기본 CP949 harness 오류(68 PASS/1 FAIL), UTF-8만 적용한 두 번째 실행은 Python TEMP가 사용자 경로를 가리켜 Git Bash `/c/Users/cyhuh` mkdir 거부(68 PASS/1 FAIL), TEMP/TMP/TMPDIR을 전용 checkout 안에 설정한 세 번째 실행은 69 PASS/exit0이었다. 첫 두 전용 temp `.pytest-f18-r42-main`, `.pytest-f18-r42-main-utf8`은 Main이 소유·link target이 각각 exact 디렉터리 내부임을 확인하고 link부터 제거해 residue0이다. 최종 제품 SHA 독립 재검증용 `.pytest-f18-r42-main-post`는 현재 부재를 확인한 뒤 Main 소유로 단일 로컬 pytest 실행 동안만 생성한다. UTF-8과 TEMP/TMP/TMPDIR을 이 경로로 제한하고 종료 후 exact realpath·link target을 확인해 link→directory 순서로 제거한다. 공유 DB/Docker/WSL 서비스·실제 Secret은 이 로컬 테스트에 사용하지 않는다. Bare 전체 pytest는 기존 수집 오류 13건으로 non-green, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED 유지다.
- R42 Main 최종 로컬 독립 결과·WSL 사전 자원 기록: 제품 최종 SHA `f169c22969adeb54950b4f3bf81f810301adb806`의 7파일(`test_oidc_process`, `test_oidc_asgi_binding`, `test_public_asgi_frontend`, `test_f15_local_stack`, `test_f18_oidc_live_host`, 두 `test_ysna_*` harness) 회귀는 UTF-8/TEMP/TMP/TMPDIR/PATH를 전용 경로로 한정해 **94 PASS/기존 warning10/exit0**이었다. `.pytest-f18-r42-main-post` 내부 symlink 11개 대상이 모두 exact 전용 경로 내부임을 확인해 link부터 제거, residue0. Diff는 제품 exact4, `git diff --check` exit0, Main 리뷰 Important 1건 해소. WSL-server read-only 확인에서 새 전용 checkout `/home/daon/anvil-f18-r42-oidc-process-qa`는 부재(exit0), 기존 `/srv/anvil-wsl/repo` 원격은 SSH alias `github-sinsan-develop`; `safe.directory`는 명령별 옵션만 쓰고 전역 변경하지 않았다. 예정 자원: 위 exact checkout(Owner Main, 수명 게시된 같은 제품 SHA의 이번 7파일 scoped QA 한 차례), 내부 `.venv`·`.uv-cache`·`.pytest-r42`·`.tmp-r42`와 합성 pytest 자료만 생성한다. WSL-server에서 지정 원격의 제품 SHA를 clean detached로 가져와 locked dev dependency·scoped pytest 후, realpath/owner/HEAD/link target을 확인하고 전용 checkout만 제거해 residue0을 증명한다. Docker/container/DB/port/실제 issuer·Secret/credential·기존 공유 서비스는 생성·변경하지 않는다. 이는 formal Compose/TLS/browser/PG18 실측이 아닌 동일 SHA scoped 회귀다. Bare 전체 pytest 기존 13 collection ERROR non-green, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED 유지.
- R42 Main 동일 SHA WSL-server scoped QA 완료: 제품 `f169c22969adeb54950b4f3bf81f810301adb806`은 지정 remote branch의 ancestor이고 local/remote branch clean·G-05 seq1641 PASS였다. WSL-server에서 전용 `/home/daon/anvil-f18-r42-oidc-process-qa`에 SSH alias Git clone 후 정확한 제품 SHA로 clean detached checkout, uv locked dev Python3.14.3/43 packages를 설치했다. 전용 `.tmp-r42`와 `.pytest-r42`를 사용한 계획 7파일 테스트는 두 실행 모두 exit0, **92 PASS/2 SKIP/기존 httpx warning7**. 두 SKIP은 `tests/deploy/test_ysna_scripts_contract.py:24,34`의 Linux Git Bash 필요 검사이며 실제 실행 PASS가 아니다(동일 로컬 7파일은 94 PASS). Product OIDC process loader와 기존 ASGI/operational shell/합성 loopback TLS의 동일 SHA 회귀만 증명한다. 종료 전 realpath exact·owner `daon`·HEAD exact·pytest symlink 11개의 내부 target을 확인하고 symlink→전용 checkout 순서로 제거, `test ! -e` exit0/QA_RESIDUE=0. 공유 `local-postgres` ID `99f3bf939d40` running, `anvil-web` ID `f0107aada3b2` healthy 유지. Docker·PG18·정식 Compose/TLS ingress·실제 issuer/credential·브라우저 Network·Production은 R42에서 실행하지 않았다. Developer 보고서-only 이관 후 Main은 write→worker lease 회수와 후속 F-18 formal host Stage를 준비한다. Bare 전체 pytest 기존 13 collection ERROR non-green, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED, 정식 Developer FAILURE_REPORT 0회·Main control 준비 오류 2회·독립 리뷰 Important 1건(해소)이다.

# F-18 R42 OIDC process bootstrap checkpoint 종료 준비 / 2026-09-27

- 판정: `R42_CLOSE_CONTROL_PREPARATION`, 담당 Main. 보고서-only SHA `10801aa155f5d7c226c970de1303710ec09b4d2b`와 Main WSL QA 기록을 게시했고, 현재 branch/지정 remote `1481e63a8a509f55fd7c8bf548dbf32d7cf6efb0` 동일·clean, G-05 seq1641 PASS, epoch26 worker/write ACTIVE/exact4를 확인했다. R42 제품 SHA와 동일 SHA QA 결과는 위 절의 범위에 한정하며 F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED다. 종료 overlay·checker·test·계획과 본 WORK_STATUS만 준비, 제품 변경0·새 QA 자원0. 신규 종료 모듈 부재의 의도한 RED 2 FAIL→overlay 구현 후 2 PASS/exit0. 준비 control commit/push 뒤 clean 원격 HEAD에서 seq1642 write→1643 worker lease 회수와 G-05를 확인한다. Bare 전체 pytest 기존 13 collection ERROR, 정식 Compose/TLS/browser/PG18·실제 issuer는 non-green/미검증이다.

# F-18 R43 OIDC 정식 WSL host 계획 준비 / 2026-09-27

- 판정: `R43_FORMAL_HOST_PLAN_PREPARED`, 담당 Main 어울. 시작 `codex/f18-wsl-ops@955102978eb5c68735980fb98b0b65c268bb0884`, clean·canonical seq1643·worker/write lease=null. 승인 정본 5종 SHA-256은 R42 binding과 일치한다. R42의 92 PASS/2 SKIP은 scoped 회귀이고 정식 Compose/TLS/issuer/browser/PG18 인수가 아니다.
- 판단 이유: 현재 `compose.f18.yml`은 loopback HTTP 8080만 게시하고 OIDC trust/CA/Secret을 API에 결선하지 않는다. API의 internal-only network에서 외부 issuer를 직접 사용할 수 없으므로, WSL 전용 HTTPS Web ingress의 same-origin issuer 프록시와 internal-only 합성 QA issuer를 R43 내부 구현 방향으로 정했다. 기존 HTTP Compose·이미지 role 계약과 비대상 `ysna-server`/Production은 변경하지 않는다.
- 조치: `docs/work_orders/F-18_WSL_OPS_R43_OIDC_FORMAL_HOST_PLAN.md`를 작성했다. WSL-server 읽기 전용 inventory: Docker Compose v5.1.1, `/srv/anvil-wsl/f18-ops-rehearsal` 부재, 공유 `local-postgres` Up·`anvil-web` healthy. 현재 G-05 실행은 R43 준비 파일이 아직 R42 raw manifest에 없는 상태에서 `F18_LOCAL_START_GIT_INVALID`·`F18_R42_CLOSE_RAW_CHECKSUM_INVALID`로 종료(exit1); 제품 결함이나 정식 Developer 실패가 아니라 신규 control projection 전의 예상된 경계다. 제품 파일 write·lease 발급·WSL QA 자원 생성은 아직 0; 정식 Developer 실패 0회. 다음은 R43 exact path WorkInstruction·control projection 준비, G-05 PASS 후 단일 writer TDD다. 계획된 전용 checkout/Compose/PG18/QA issuer/합성 credential·cert의 정확한 이름·수명·정리 명령은 실제 생성 직전에 별도 기록하고 inventory를 재확인한다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED.
- R43 계획·상태 exact2를 `0971714989aa5fba720dae0a3a959f70cb2fc992`로 기존 branch에 commit/push했고 지정 원격 SHA 동일·worktree tracked clean을 확인했다. 게시 후 G-05는 `F18_LOCAL_START_GIT_INVALID`·`F18_R42_CLOSE_POST_QA_SCOPE_INVALID`·`F18_R42_CLOSE_RAW_CHECKSUM_INVALID`로 exit1이며, 이는 R42 checkpoint verifier가 신규 R43 파일을 아직 허용하지 않기 때문이다. R43 신규 projection/G-05 PASS 전 제품 write·runtime 생성 금지 유지. WSL-server 합성 표준입력 `docker compose config --format json`은 exit0이나 F-18 overlay 병합/TLS 실행의 증거는 아니다.
- R43A 분해·지시 준비: Main과 읽기 전용 Developer 검토에서 OIDC issuer token endpoint가 단일 URL이고 HTTP client가 `trust_env=False`라 API와 브라우저가 같은 HTTPS hostname:port에 도달해야 함을 확인했다. Web internal alias와 격리 Chrome DNS 매핑의 공통 `anvil-f18-qa.local:8444`, Web TLS listener/WSL loopback publish/SSH tunnel 모두 8444로 고정한 R43A exact4 WI·Invocation을 작성했다. WSL-server Compose v5.1.1의 비영속 합성 two-file `ports: !override` 정규화는 기존 HTTP 8080 publish 제거·loopback HTTPS 1개만 남음을 exit0으로 확인했다. 실제 F-18 overlay·TLS/issuer/browser/PG18은 미실행. R43B는 issuer executable/image와 실제 QA로 별도 순차 lease 발급 예정. 제품 write·WSL 자원 생성0, canonical seq1643·lease=null, G-05 신규 projection 전 non-green 유지.
- R43A control 준비: WI·Invocation·R43 Plan은 `2177aed`로 지정 원격에 게시됐다. Main이 새 epoch27 canonical overlay와 G-05 dispatch·control test를 작성했다. 신규 overlay 모듈 부재 RED 2 FAIL/exit1 → module 구현 후 2 PASS/exit0. R42 종료 테스트를 함께 실행한 준비 중 조합은 3 PASS/1 FAIL이며, 실패 원인은 canonical mode가 아직 R42인 상태에서 새 R43 경로·dirty control을 기존 R42 raw manifest가 거부한 것이다. 제품 실패 또는 Developer 정식 실패가 아니다. 이는 control tooling 검증이며 제품/TLS runtime 검증이 아니다. 현재 제품 write0, worker/write lease=null·seq1643; 준비 control exact 파일을 commit/push하고 clean remote HEAD에서만 seq1644~1646 발급·G-05를 확인한다. 정식 Developer 실패 0회, Main control 오류 0회. R43A exact4 외 경로는 금지, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R43A Main 동일 SHA read-only Compose QA 사전 자원 기록: Developer exact4 제품 `4d1a09f555977fb883b7491c1bf5fad5cb629633`을 지정 `development`에 push했고 local/remote SHA 동일·clean·G-05 seq1646 PASS(exit0)를 확인했다. 독립 코드 리뷰는 Critical 0, 확정 Important 코드 결함 0이며 실제 Compose 병합 검증을 필수 미충족 조건으로 지적했다. WSL-server에서 전용 `/home/daon/anvil-f18-r43a-compose-qa` 부재·8444 listen 없음·Git/Python/Docker CLI 존재를 read-only 확인했다. 다음 생성 예정 자원은 정확히 이 Git checkout 1개뿐이다(Owner Main/OS owner `daon`, 수명 게시된 제품 SHA의 `docker compose config` 한 차례). 지정 SSH Git remote에서 clone 후 clean detached exact SHA를 확인하고 Compose config만 실행한다. `ANVIL_F18_OIDC_MATERIAL_DIR`은 checkout 안의 미생성 config-only 경로를 가리키며 합성 image/credential 변수는 interpolation 전용으로만 제공한다. 이미지 build/pull, Compose up, container/network/DB/port bind, 실제 Secret·cert·issuer, 브라우저는 생성·실행하지 않는다. 종료 전 realpath·owner·HEAD·변경 여부를 확인하고 전용 checkout만 `rm -rf -- /home/daon/anvil-f18-r43a-compose-qa`로 제거, `test ! -e`로 잔류0을 확인한다. 기존 `/srv/anvil-wsl/repo`, `anvil-web`, `local-postgres` 및 다른 자원은 보존한다. 본 WORK_STATUS 갱신 이후 active R43A raw manifest G-05는 다음 통제 projection 전까지 non-green일 수 있으므로 신규 제품 Task dispatch는 하지 않는다. 동일 유효 lease의 R43A 보완은 Main의 정식 재작업 지시 아래에만 허용한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R43A WSL-server exact SHA config 첫 실측 실패·정리: 전용 checkout은 지정 SSH Git에서 clean detached `4d1a09f555977fb883b7491c1bf5fad5cb629633`으로 수신됐다. synthetic config-only image/credential 변수만 주고 `docker compose -f compose.f18.yml -f compose.f18.oidc.yml config --format json`을 실행했으나 exit1, `services.web.security_opt items at 0 and 1 are equal`로 정규화 전 거부됐다. 뒤따른 JSONDecodeError는 빈 stdout을 읽은 2차 오류이고 근본 원인은 base·overlay가 같은 Web `security_opt` list를 선언해 Compose merge가 중복한 것이다. 동일 성격의 `cap_drop`도 두 파일에 중복 선언됐다. WSL-server Compose v5.1.1 합성 비영속 병합에서 두 list에 `!override`를 적용하면 각각 단일 값으로 정규화됨을 `MERGE_LIST_OVERRIDE_PASS`/exit0으로 확인했다. 이는 실측 발견 Important 1건(미해소), 원인 재현 1회, 정식 Developer FAILURE_REPORT 0회. 동일 exact4 lease에 테스트 RED→최소 보정을 전달했다. WSL checkout realpath/owner `daon`/HEAD/clean·material 부재를 확인하고 위 exact 경로만 제거, `R43A_QA_RESIDUE=0`; 공유 서비스/DB·Docker 자원은 변경하지 않았다. 보정 SHA에 대한 후속 QA는 별도 자원 사전 기록 후 수행한다. R43A/F-18 인수 아님.
- R43A 보정 SHA WSL 재검증 사전 자원 기록: Developer가 base에서 상속받는 Web `security_opt`/`cap_drop`을 overlay에서 중복 선언하지 않도록 하고 중복 거부 회귀를 추가한 exact3 commit `c787f7817284fa99f5e91b2654ac200789f523de`를 완료했다. RED 2 FAIL→GREEN 30 PASS, 관련 6파일 117 PASS/exit0·temp 잔여0; Main이 exact3 diff·`git diff --check`를 확인하고 지정 원격에 push했다. 두 번째 WSL 전용 Git checkout은 정확히 `/home/daon/anvil-f18-r43a-compose-qa2` 하나(Owner Main/OS owner `daon`, 수명 위 보정 SHA의 정규화 Compose config QA 한 차례)다. 생성 전 부재와 공유 자원을 확인하고 지정 SSH remote에서 clean detached exact 보정 SHA를 받는다. 합성 interpolation 변수 및 미생성 `material-not-created` 경로만 사용하며 실제 image pull/build·Compose up·container/network/DB/port/issuer·Secret·cert·브라우저 생성은 금지한다. 종료 전 realpath·owner·HEAD·clean·material 부재를 확인하고 정확한 `/home/daon/anvil-f18-r43a-compose-qa2`만 제거, `test ! -e`로 잔류0을 증명한다. 실패가 재발하면 오류를 분리해 기록하고 같은 원인 정식 실패 횟수를 판단한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R43A 보정 SHA WSL config QA 결과: 위 두 번째 checkout에서 clean detached exact `c787f7817284fa99f5e91b2654ac200789f523de`를 확인했다. `docker compose -f compose.f18.yml -f compose.f18.oidc.yml config --format json`는 exit0. 첫 Main assertion은 정규화 JSON이 `ingress.internal=false`를 필드 생략으로 표시하는데 필수 키로 가정하여 `KeyError: internal`/exit1이었다(제품 오류 아님, Main QA harness 오류 1회). Secret 비출력 진단에서 서비스 6개, Web·issuer 내부망·Web 보안 상속 단일값과 ingress 비내부망을 확인했고, false 생략을 허용한 전체 assertion 재실행은 `CONFIG_PASS services=6 web_port=127.0.0.1:8444:8444 private_publish=0 web_security=preserved mounts_ro=6`/exit0. Web internal alias `anvil-f18-qa.local`, issuer internal-only, API OIDC URL 일치도 검증했다. 두 번째 checkout realpath/owner `daon`/HEAD/clean/material 부재 확인 후 exact 경로만 제거 `R43A_QA2_RESIDUE=0`, 공유 `local-postgres` Up·`anvil-web` healthy 유지. 독립 correction-only read-only 리뷰 Critical/Important 0, R43A 정적 결선 PASS로 다음 R43B 준비 가능. 실제 image digest/TLS `nginx -t`·issuer code exchange·PG18·브라우저·Secret 파일 권한은 미검증; F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. 정식 Developer FAILURE_REPORT 0회, R43A 실제 Compose 결선 오류 1회 해소, Main assertion 오류 1회 해소. 다음은 보고서-only 이관 후 epoch27 write→worker lease 순차 회수·G-05 복구다.
- R43A 종료 control 준비: Developer가 위 WSL QA 결과를 제품 범위 내 보고서 한 파일에 이관해 `a8e12e69a80497ab48267f6ec8aa172d2f6d61a3`로 commit했다. Main의 `docs/WORK_STATUS.md` 변경은 stage하지 않고 보존했다. Main이 종료 Plan/overlay/checker/test를 작성했고 모듈 부재 RED 2 FAIL/exit1→구현 후 2 PASS/exit0, `git diff --check` exit0을 확인했다. 현재 canonical seq1646 epoch27 두 lease ACTIVE, R43A accepted는 정적/config 범위에 한정하며 F-18 accepted=false다. 준비 control과 보고서 SHA를 지정 원격에 게시하고 clean remote HEAD에서만 seq1647 write→1648 worker 회수·G-05 PASS를 확인한다. 추가 제품 mutation/WSL QA 자원 생성0.
- R43A 종료·R43B1 준비: R43A는 `8e45b37ef11f8cd52f901416c0aa1f4b9d09475b`에서 canonical seq1648, worker/write lease=null, G-05 PASS, 지정 원격 동일 SHA로 종료됐다. R43A는 Compose 정적/config QA까지만 통과했고 실제 TLS/OIDC/PG18/브라우저는 미검증이다. Main과 읽기 전용 Developer가 R43B를 B1 합성 issuer 구현과 B2 실제 WSL-server 실측으로 순차 분리했다. B1 계획·WI·Invocation과 epoch28 start overlay/G-05 dispatch/control 테스트를 준비했고 control 2 PASS/exit0 및 `git diff --check` exit0을 확인했다. 현재 제품 write·WSL 자원 생성0, 정식 Developer 실패0회, Main control 오류0회. B1 준비 파일을 동일 branch의 지정 원격에 게시한 뒤 clean remote HEAD에서만 seq1649~1651 두 lease 발급·G-05 PASS를 확인하고 단일 Developer exact5 구현을 시작한다. R43B1 정적 PASS는 실제 QA 인수가 아니며 F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R43B1 제품·Main 검토: 준비 `fdbbc05`와 canonical 발급 `1abb6e5`를 지정 원격에 게시했고 G-05 seq1651 PASS·control 2 PASS 후 단일 Developer가 exact5 제품 `160e98ee0ee2a71ec047215c58ad40c21eeedc36`을 commit했다. RED 신규 파일 부재 2 FAIL/12 ERROR, 첫 GREEN helper URL 중복으로 12 FAIL/2 PASS, helper 수정 후 14 PASS, 최종 7파일 132 PASS/exit0; bare 전체는 기존 13 collection ERROR/exit1로 non-green. Main은 exact5 diff·`git diff --check`를 확인해 범위 이탈·확정 Critical/Important 결함 0으로 판단했다. Main 재검증에서 제품/기존 계약 74 PASS였으나 함께 실행한 control 1 FAIL은 미게시 제품 HEAD와 원격 SHA 불일치였고, Main 생성 `.pytest-f18-r43b1-main-review`의 내부 symlink와 해당 전용 경로를 검증·제거해 잔여0으로 만들었다. 제품 SHA를 지정 원격에 push한 뒤 local/remote 동일·clean, G-05 seq1651 PASS 및 control 2 PASS로 해소했다. 실제 image build/Compose/TLS/OIDC/PG18/browser는 미검증; WSL-server read-only inventory에서 `/srv/anvil-wsl/f18-ops-rehearsal`과 `/home/daon/anvil-f18-r43b2-qa` 부재, 8444 listener 없음, F18 label 컨테이너 없음, Docker Compose v5.1.1 및 공유 서비스 정상 상태를 확인했다. B2 자원은 아직 생성0. 정식 Developer FAILURE_REPORT 0회, Main QA harness/Git projection 오해 1회 해소, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. 다음은 epoch28 write→worker lease 회수와 B2 별도 control·자원 사전 기록이다.
- R43B1 종료·B2 준비: R43B1 종료 control `17cd1cc` 게시 후 canonical seq1652 write→1653 worker 회수 `c6baa6a75da984ba3f077e6e684078aea93100f2`를 지정 원격에 게시했다. local/remote SHA 동일·clean, G-05 seq1653 PASS, 종료 control 2 PASS. B1은 로컬 issuer 계약에 한정한다. B2는 Main 전용 검증 worker lease epoch29만 발급하고 제품 write lease/scope는 비워 둔다. WSL-server `/srv/anvil-wsl` root:root 755를 확인해 전용 Git checkout `/home/daon/anvil-f18-r43b2-qa`와 별도 합성 material `/home/daon/anvil-f18-r43b2-material`로 정했다. Git alias가 seq1653 SHA를 읽고 Docker Compose v5.1.1·Git·OpenSSL이 있으며 8444/전용 checkout/F18 label 자원이 비어 있음을 확인했다. 전용 Compose project `anvil-f18-r43b2`, 4개 전용 Git archive image, PG18/MinIO 공유 cache 비삭제, Windows 터널/격리 Chrome의 exact 자원 경계를 R43B2 WI와 별도 보고서에 사전 기록했다. 실제 resource 생성은 아직 0. B2 control 테스트 2 PASS/exit0·`git diff --check` 확인 후 준비 파일을 지정 원격에 게시하고 clean HEAD에서 seq1654~1655/G-05 PASS 전에는 생성하지 않는다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R43B2 첫 실제 runtime 실측: Main 검증 lease epoch29 seq1655/G-05 PASS, 전용 WSL checkout clean exact `91bdc617ae0c3d1096d173d1e64cbe4207c4022b`/B1 제품 조상 확인. 전용 4개 image exact Git archive build/ID/revision/nonroot PASS, 합성 material 8개 mode·CA/SAN PASS, 두 Compose 정규화 `R43B2_CONFIG_PASS`, 전용 PG18 18.4 `anvil_app` 비관리자/migration0019/public 61 tables·합성 OIDC directory 각 1행. 전용 6서비스 기동 후 Web `nginx -t`, CA 검증 `/`/JWKS/session-status 각 HTTP200, `/api/health/ready` ready/head0019, issuer 불완전 auth 400·token 401. 그러나 Worker는 hardcoded F15 head0016 대 실제0019로 `migration_head_mismatch` exit1이고, HTTPS `/auth/oidc/authorization`은 Nginx 전달 TLS scheme을 API Uvicorn 0.35가 비신뢰 proxy IP로 무시해 HTTP로 관측함에 따라 `ORIGIN_VALIDATION_FAILED` 403이다. Main OIDC 흐름 assertion exit1은 실제 제품 결선 결함 검출이며 별도 정식 Developer FAILURE_REPORT는 아니다. 브라우저 독립 정적 Network만 profile 계획을 사전 기록해 확인한 후 전용 자원 전량 정리, B2 lease 회수, 별도 제품 수정 WI로 진행한다. Worker/OIDC runtime PASS와 F-18 accepted는 불가, F-19 blocked/Production NOT_EXECUTED. 자세한 자원 ID·권한·명령·미검증은 `docs/04_test_reports/F-18_R43B2_WSL_RUNTIME_REPORT.md`에 누적했다.
- R43B2 Windows Chrome 경로 사전 수정: Windows `127.0.0.1:8444` listener 소유는 WSL 관리 `wslrelay.exe` PID23452임을 읽기 전용 확인했다. 이를 중지하거나 OS 설정을 바꾸지 않고, Chrome 격리 프로필의 host resolver만 `anvil-f18-qa.local→127.0.0.2`로 지정하고 Windows `ssh.exe` 전용 `127.0.0.2:8444→WSL-server 127.0.0.1:8444` tunnel을 사용한다. 브라우저 URL/issuer/cert는 기존 `anvil-f18-qa.local:8444`를 유지하므로 기능 요구를 바꾸지 않는다. 정확한 profile path·터널·PID 검증과 종료 경계를 B2 보고서에 먼저 갱신했다. 아직 SSH tunnel/Chrome profile/process 생성0, 브라우저 미검증. 기존 relay/Chrome/계정은 보존한다.
- R43B2 브라우저·전량 정리: Windows SSH tunnel PID47192를 `127.0.0.2:8444` 전용으로 개설하고 curl 합성 TLS SPKI pin `/` 200을 확인했다. 격리 Chrome 프로필 첫 headless PID65052는 host-resolver 인수 quoting 오류로 exit13, 같은 격리 프로필에서 인수만 수정한 PID64844는 exit0, DOM에 Anvil title·인증서 오류 없음. NetLog 실제 URL_REQUEST_START_JOB 10건 중 앱 요청 5개(`/`, `/api/health/ready`, CSS/JS, favicon)는 모두 same-origin, 브라우저 localhost·127.0.0.1·Docker 내부 호스트 직접 호출0; 다른 5개 Google 계열은 Chrome 자체 배경 요청이다. 이는 UI 정적/Network 범위이며 OIDC 사용자 로그인 인수는 아니다. Chrome 전용 profile/process·SSH PID만 종료/제거해 Windows residue0. WSL은 전용 project label/네트워크 접속자·4개 image 단일 tag/revision·checkout/material realpath/owner/clean·symlink0을 확인한 뒤 `docker compose down --remove-orphans`, 전용 image tag 4개 force 없는 제거, 전용 checkout·합성 material 두 경로만 삭제했다. 최종 project container/network/image/8444 listener/전용 경로 잔여0, 공유 `anvil-web` healthy·`local-postgres` Up 및 PG18/MinIO cache 보존. 합성 credential·Chrome 산출물은 제거되어 복구되지 않는다. 실제 runtime 결함 2건(Worker head0016 고정 대 DB0019, HTTPS proxy trust 미설정)으로 R43B2 `REWORK_REQUIRED`; 별도 Developer 정식 FAILURE_REPORT 0회, Main Chrome 인수 오류 1회 해소. B2 report에 모든 증거·미검증·rollback을 기록했고 epoch29 Main worker lease 회수 후 최소 보정 WI 발급 예정. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- 2026-09-27 R43C 준비: Main은 R43B2 종료 seq1656, worker/write lease=null, HEAD/지정 원격 `d3481ae6e086bcbf03c600b4d70ec51e28cc795d`, clean·G-05 PASS에서 두 결함의 최소 보정 범위를 확정했다. 읽기 전용 Developer 검토와 일치: Worker 기본 F15 head0016 보존/명시 OIDC일 때만0019, WSL QA overlay API의 실제 Web internal IPv4 한 개만 Uvicorn proxy trust에 결박한다. 고정 subnet이나 wildcard/CIDR는 사용하지 않는다. 최초 loopback placeholder→Web IP 검증→API 재생성→Web restart→IP 불변·negative spoof 검증 후에만 OIDC PASS를 판단한다. 제품 예정 exact5와 TDD/WSL 재실측 경계를 R43C Plan/WI/Invocation에 기록했다. 현 시점 제품 write/WSL QA 자원 생성0, 정식 Developer FAILURE_REPORT 0회, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. Main control overlay/G-05를 clean 원격에서 발급한 뒤 단일 Developer에게 exact5를 전달한다.
- R43C 로컬 제품 및 종료 준비: epoch30 seq1659 두 lease ACTIVE/G-05 PASS의 단일 Developer가 exact5 제품 commit `e3a1b0bdbe62f68b37a4798be6f16f91e3208bd9`를 완료했다. RED overlay 7 FAIL(첫 명령 `-k` 중복으로 Worker 미선택), 별도 Worker 5 FAIL, 최초 GREEN 52 PASS, 7파일 최종 164 PASS/exit0, bare 전체 기존 13 collection ERROR/exit1; 정식 Developer FAILURE_REPORT 0회. Main은 exact5 diff/기존 F15 기본 head 유지·OIDC0019/unknown mode 거부·QA-only Web proxy 변수와 노출 범위를 검토해 확정 Critical/Important 결함0, 독립 첫 회귀는 OS Temp `pytest-of-cyhuh` 접근 거부로 146 PASS/18 ERROR(검증 harness 오류1회), 전용 `.pytest-f18-r43c-main-review` 재실행은 164 PASS/exit0이다. 해당 전용 경로의 내부 symlink11개 target이 모두 경로 안임을 확인해 symlink→경로 제거, 잔여0. `git diff --check` PASS, 제품 SHA를 지정 원격에 push하여 local/remote 일치·clean·G-05 seq1659 PASS를 확인했다. WSL read-only inventory는 전용 R43D 후보 checkout/material 부재·8444 listener 부재, Docker Compose v5.1.1, 공유 `anvil-web` healthy·`local-postgres` Up이다. 새 WSL QA 자원 생성0, Worker 실제 ready/OIDC end-to-end는 미검증, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. Main은 epoch30 write→worker lease를 회수한 뒤 별도 QA lease/자원 계획을 발급한다.
- R43C 종료·R43D QA 사전 자원 기록: R43C 제품 및 Main 독립 로컬 164 PASS 뒤 epoch30 write→worker lease를 seq1660~1661로 회수했다. 종료 checkpoint `567514f0801c70871d6baa570b37a48c0a8f789b`는 지정 원격 동일·clean, G-05 seq1661 PASS, lease=null이다. R43D는 Main worker lease만 발급하고 제품 write scope를 비워 둔다. WSL-server 사전 inventory에서 `/home/daon/anvil-f18-r43d-qa`와 `/home/daon/anvil-f18-r43d-material` 부재, 8444 listener 없음, Compose v5.1.1, 공유 `anvil-web` healthy·`local-postgres` Up. 전용 Compose `anvil-f18-r43d` 6 services/2 networks, exact SHA 전용 image 4개, PG18/MinIO cache 보존, Windows `127.0.0.2:8444` tunnel·격리 Chrome profile 단회 수명/정리 경계를 R43D WorkInstruction과 보고서에 사전 기록했다. Windows 전용 profile 부재·127.0.0.2:8444 listener 부재도 확인했다. 현 시점 전용 자원 생성0, 실제 Worker/OIDC/browser 검증은 미시작, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. R43D QA start control·G-05 PASS 후에만 자원을 만든다.
- R43D WSL-server runtime QA 결과: Main 전용 epoch31 seq1663/G-05 PASS, WSL-server 전용 checkout clean exact `e21c9dc00b40c0c288fd54a2c34cbb4b57a2a6f0`(R43C 제품 조상). Git archive image 4개 revision/nonroot PASS, 합성 material 8개 권한·CA/SAN, 6서비스 Compose config loopback8444/private publish0 PASS. 전용 PG18 18.4 Alembic head0019/public 61테이블·합성 OIDC directory 각1행, Worker ready/head0019·지속 실행, Web `nginx -t`/CA 검증 `/`·API ready·JWKS 각200. 초기 proxy placeholder의 auth403 뒤 Web internal 단일 IP `172.24.0.7`로 API만 재생성·Web restart했고 Web ID/IP 불변·API env 일치. 실제 HTTPS OIDC authorization200→issuer302→callback200/secure HttpOnly cookie→session200/authenticated→replay401, 비신뢰 internal peer 헤더 위조403, issuer 불완전 auth400/잘못된 Secret401/PKCE401. 비관리자 DB `oidc_sessions` 1행 및 합성 directory 각1행, 최근 로그 합성 Secret 비노출. 격리 Windows Chrome exit0·Anvil DOM·cert error0, 앱 Network 5건 same-origin/내부·localhost 직접 호출0, Chrome 배경5건 분리. 전용 tunnel/profile 및 WSL 6컨테이너·2network·4image·checkout/material 제거, Windows/WSL 잔여0; 공유 `anvil-web` healthy·`local-postgres` Up과 PG18/MinIO cache 보존. Main QA harness 오류 4회(SQL 인용, HTTP newline, Location header 대소문자, 비승격 CIM 권한)는 각각 보정 후 통과했고 제품 실패로 집계하지 않는다. 실제 nonce·issuer/JWKS/CA mismatch 거부와 Chrome 사용자 로그인 동선은 미검증, bare 전체 기존 13 collection ERROR non-green. 핵심 runtime 통과를 F-18 전체 합격으로 승격하지 않는다: accepted=false, F-19 blocked, Production NOT_EXECUTED. 세부 ID·명령·미검증·rollback은 `docs/04_test_reports/F-18_R43D_WSL_RUNTIME_REPORT.md`에 기록했다. 다음은 Main QA lease 회수 및 F-18 잔여 검증 경계 감사다.
- R44 준비 감사 / 2026-09-27: Main, branch `codex/f18-wsl-ops`, 시작 HEAD·지정 원격 `838a7591fd63f641dfc9cdf4db147a4461320dd1`, clean, G-05 seq1664 PASS, worker/write lease=null. R43D 실제 OIDC head0019와 F-16 `ReleaseManifest` 고정 head0016 불일치를 최소 실행으로 확인했다: `canonical_subject_bytes`의 head0019 입력은 `MANIFEST_MIGRATION_INVALID`/exit1, F-17 역사적 validator도 head0019를 `migration 0016 required`/exit1로 거부한다. F-17의 기존 0016 계약은 그대로 두고, F-18 현재 signed manifest를 위해 F-16 검증기에 두 정확한 head만 허용하는 R44 exact3 계획·WI·Invocation을 준비했다. 이는 새로운 migration/schema나 subject 필드 변경이 아닌 승인 F-18의 내부 구현 보정이다.
- 같은 감사에서 Windows 전체 pytest는 `--import-mode=importlib --ignore=tests/fixtures/repositories`로 8218개 collection PASS/exit0이었다. 전체 실행은 25% 부근의 다수 FAIL·4 SKIP으로 non-green이어서 중단했다. 단독 E-06 실제 Git 테스트 1 PASS/19.38초로 느린 구간 원인을 확인했고, C-01 첫 실패군은 레거시 테스트가 금지된 로컬 `wsl -d Ubuntu`를 호출해 returncode 4294967295/exit1인 환경·검증 경계 오류다. 이 명령을 다시 사용하지 않는다. 두 전용 pytest temp의 symlink target은 모두 내부, 제거 후 잔여0. WSL-server read-only inventory는 F-18 정식 checkout·컨테이너·8444 listener 부재, pgvector PG18 cache 사용 가능, 공유 `anvil-web` healthy·`local-postgres` Up이었다. 제품 수정/WSL 자원 생성0, 정식 Developer 실패0, Main 인용 오류1회 보정, 실제 signed current manifest·동일 artifact 승격·pgvector/backup/rollback 미검증. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. 다음은 R44 control binding과 epoch32 단일 writer lease 발급 후 exact3 TDD다.
- R44 제품·Main 검토 / 2026-09-27: Main은 `245fab7b1b8b341d9fe3bad5f9c4576a1498cebd`에서 canonical seq1667·epoch32 두 lease ACTIVE/G-05 PASS를 확인해 단일 Developer에게 exact3를 배정했다. Developer RED의 예상 `MANIFEST_MIGRATION_INVALID` 1 FAIL→F-16 42 PASS→F-16/F-17/F-18 배포 13파일 253 PASS/exit0을 보고했다. 최초 회귀 출력 세션 ID 유실 1건은 새 basetemp 재실행으로 확정했고, 정식 Developer FAILURE_REPORT 0회다. 제품 commit `4e3ba7039894d182fe387420bf978d89f4faf24c`는 허용 head `0016_operations_recovery`/`0019_oidc_sessions` exact2, signed subject 일치·미허용/관측 불일치 거부 테스트, 제품 보고서만 포함한다. Main은 exact3 diff·`git diff HEAD^ HEAD --check`와 F-16 독립 42 PASS/exit0을 확인하고, 내부 symlink 5개가 전용 `.pytest-f18-r44-main-check` 안을 향함을 확인한 뒤 그 경로만 제거해 잔여0으로 만들었다. 제품 SHA는 지정 원격에 push해 local/remote 일치·clean·G-05 seq1667 PASS다. Main의 종료 overlay 준비 테스트는 2 PASS/exit0이며 아직 writer 회수 전이다. 로컬 signed manifest 계약만 PASS이고 실제 서명 manifest 발행·WSL-server pgvector PG18/동일 artifact 승격/backup·restore·rollback/브라우저 사용자 로그인/negative OIDC는 미검증이다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED. 다음은 R44 종료 control QA를 게시한 뒤 seq1668 write→seq1669 worker lease를 회수한다.
- R44 종료 control 준비 중 재검증 경계: 종료 overlay 단독 2 PASS지만 이전 R44 시작 overlay와 함께 실행하면 시작 overlay의 dirty Git/raw checksum 보호가 예상대로 `F18_LOCAL_START_GIT_INVALID`/`F18_R44_RAW_CHECKSUM_INVALID` 1 FAIL을 낸다. 종료 준비 변경을 지정 원격에 게시하고 종료 projection을 생성하기 전의 과도 상태이며 제품 실패로 분류하지 않는다. 종료 projection·G-05가 PASS하기 전에는 R44 종료를 선언하지 않는다.
- R44 종료·R45A 사전 계획 / 2026-09-27: R44 종료 checkpoint `dfdbdcb95be53ff15bec7224864f759982e83525`는 지정 원격 동일·clean, seq1669 G-05 PASS, worker/write lease=null, 종료 통제 2 PASS다. Main은 승인 F-18의 잔여 formal 검증을 R45A Test/Staging artifact→R45B 동일 artifact 격리 target으로 순차 분리했다. R45A 전용 WSL-server checkout `/home/daon/anvil-f18-r45a-staging`, Git 밖 material `/home/daon/anvil-f18-r45a-material`, Compose `anvil-f18-r45a`, Web loopback 127.0.0.1:8454, 전용 PG15와 pgvector-PG18 RC/합성 role·키·OIDC를 계획했으며 기존 `local-postgres`, `anvil-web`, cached pgvector image는 보존한다. read-only inventory에서 두 경로와 후속 target 후보 `/home/daon/anvil-f18-r45-target`, 기존 `/srv/anvil-wsl/f18-ops-rehearsal`은 부재, 8444/8454/8464 listener 부재, pgvector PG18 cached image ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`, 공유 `anvil-web` healthy·`local-postgres` Up을 확인했다. 다른 프로젝트 `daon2-runtime-coordinator` unhealthy는 기존 공유 상태로 관측만 하고 변경하지 않는다. R45A plan/WI/invocation/report 준비 시 제품 변경·WSL 자원 생성·annotated tag 0, Developer 정식 실패0. 생성 직전 이름·owner·label·포트·공유 ID/status를 다시 확인한다. 이 QA는 기존 범위의 내부 방법 분할이며 F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED다.
- R45A 통제 준비 추가: annotated QA tag 이름을 `f18-wsl-r45a-qa`로 고정하고 로컬·지정 원격 모두 부재함을 읽기 전용 확인했다. QA lease 발급 전 신규 tag·checkout·container·DB·Secret·브라우저 생성0. R45A control overlay 단독 테스트 2 PASS/exit0, diff check PASS이며 아직 canonical seq1669 상태다. 다음은 control QA commit/push 후 clean remote HEAD에서 epoch33 worker-only lease를 발급한다.
- R45A epoch33 시작과 포트 계획 오류: control QA `312e62b93d3d1e8370f975b8b93dd3d98a8808c5`와 worker-only seq1671 checkpoint `d36de847842804ca93e405abe9bff687c1162a69`를 지정 원격에 게시, local/remote 동일·clean·G-05 PASS·통제2 PASS. 사전 WSL inventory 첫 시도는 Health map 없는 `local-postgres`에 Health 필드를 요청해 exit1(Main 관측 명령 오류1회), Status만 사용하는 최소 수정 후 경로/material 부재·project container/network/volume0·8454 free·공유 Web/PG ID 불변·pgvector-PG18 cache 확인 PASS. annotated QA tag `f18-wsl-r45a-qa` object `973ac0ba719b076e91b279222abb6a48bc93960e`/peeled `d36de847842804ca93e405abe9bff687c1162a69`를 지정 원격에 게시하고 WSL-server 전용 checkout `/home/daon/anvil-f18-r45a-staging`을 clean detached exact SHA/owner daon으로 생성했다. F-16 `verify_exact_checkout` 실제 PASS/exit0. Compose source audit에서 계획한 8454가 기존 QA OIDC Compose/Nginx/issuer 고정 8444와 충돌함을 발견해 실행을 멈췄다(Main 계획 오류1회). 합성 material/container/DB/Secret/브라우저 생성0. 8444로 비의미 계획 보정하고 기존 epoch33 worker를 회수→epoch34 새 WI/lease/G-05로 재결박하기 전에는 QA를 재개하지 않는다. checkout/tag는 정확한 Git source 검증 후 재사용, 강제 tag 이동/삭제 없음. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45A epoch34 QA 실측 / 2026-09-27: Main worker-only seq1674/G-05 PASS에서 exact tag `d36de847842804ca93e405abe9bff687c1162a69` Git checkout의 Web/API/Worker/issuer 4 image를 빌드하고 PG15 15.18/vector0.8.2와 별도 pgvector-PG18 RC 18.4/vector0.8.2 비관리자 migration0019/61 tables/vector 쿼리를 각각 PASS했다. Compose PG18+OIDC 합성 runtime은 HTTPS ready/JWKS/OIDC code→session/replay 및 spoof403을 실제로 확인했다. F-16 signed QA manifest preflight PASS와 F-18 positive/mismatch 6건 기대 결과를 확인했다. QA signer·application-only SBOM·blob 유래 adapter version은 Production trust/전체 공급망 인수가 아니다. 입력/harness 오류는 R45A 보고서에 구분 기록, Developer 정식 실패0. 정리 전 전용 7 container(Compose6+PG15), 3 network와 checkout/material이 남아 있다. 다음은 exact ID/label/owner 확인 후 전용 자원만 삭제·잔여0/공유 ID 불변을 기록하고 lease close projection을 수행한다. R45B 동일 artifact target·backup/restore/rollback·브라우저 사용자 로그인 등은 미검증, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45A 임시 자원 정리 / 2026-09-27: Main이 전용 checkout/material realpath·UID1000·symlink0·Git clean/exact tag, Compose6+별도 PG15의 ID/label, 3 network의 연결자, volume0, image 4개 단일 tag/revision과 공유 Web/PG의 불변 ID를 확인했다. 정확한 `anvil-f18-r45a` Compose down→전용 PG15 container/network→4 image tag→두 전용 경로를 제거했다. 재검사에서 project container/network/volume/image tag/8444 listener·PG15 container/network·두 경로 잔여0, 공유 Web healthy·PG running/ID 불변, cached pgvector/MinIO 보존이다. 합성 키·credential·임시 DB는 제거되어 복구되지 않고 QA tag는 보존한다. R45A 보고서에 증거·미검증·rollback을 누적했다. 다음은 report-only commit과 canonical epoch34 worker 회수/G-05, 이후 같은 branch의 R45B 동일 ID target 계획이다. 제품 write0·Developer 정식 실패0, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45A 종료 control 준비 / 2026-09-27: R45A 보고서-only checkpoint `9fe77adc45c9405be009959c38a3bb43403c09e8`를 지정 원격에 게시·SHA 일치 확인했다. Main은 seq1674 epoch34 worker-only lease 회수용 overlay/checker/test/종료 계획을 같은 branch에 준비한다. 로컬 전용 pytest temp는 checkout 내부 `.pytest-f18-r45a-close` 한 경로(Owner Main, control 테스트 단회 수명)만 생성하고 symlink/realpath를 확인해 종료 시 그 경로만 제거한다. 제품 write·새 WSL/브라우저 자원 생성0. 준비 변경 중 G-05 raw checksum은 다음 projection 전까지 non-green이며 신규 제품 dispatch는 금지한다. R45B는 회수 후 별도 사전 계획·lease/G-05로 시작한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45A 종료 control 기본 검증: `D:\Project\Anvil\.venv\Scripts\python.exe -B -m pytest`는 해당 로컬 venv에 pytest 부재로 exit1(`No module named pytest`), `.pytest-f18-r45a-close` 경로는 생성되지 않았다. 같은 Python의 stdlib `runpy`로 두 control 테스트 함수를 직접 실행해 2 PASS/exit0, `git diff --check` exit0을 확인했다. pytest 미실행을 pytest PASS로 표시하지 않으며 projection 후 G-05가 필수다. Main harness 환경 오류 1회, Developer 정식 실패0, 제품 변경0.
- R45A 종료 및 R45B 증거 연속성 감사 / 2026-09-27: `c655984e0e434223d0586f6ec8c97d46fac785dc`를 지정 원격에 게시해 local/remote SHA 동일·clean, canonical seq1675 worker/write lease=null, G-05 PASS/exit0, 종료 control 직접 실행 2 PASS를 확인했다. WSL R45A 전용 자원 잔여0이다. R45B 사전 inventory에서 `/home/daon/anvil-f18-r45b-target`, `/home/daon/anvil-f18-r45b-material`, 기존 `/srv/anvil-wsl/f18-ops-rehearsal` 부재, R45B project container/network0·8444 listener0, 공유 Web `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy·PG `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변을 확인했다. 감사에서 R45A 임시 material 정리 시 합성 signed manifest/public key 원본도 제거됐음을 확인했다. SHA·image ID·manifest hash 기록은 남았으나 동일 signed envelope 원본을 R45B에서 재검증할 수 없으므로 R45A envelope를 승격 증거로 사용하지 않는다. Main 절차 오류 1건으로 기록하고 승인 F-18 내부 QA 방법을 보완한다. `F-18_WSL_OPS_R45B_SAME_ARTIFACT_PLAN.md`/WI/Invocation/보고서/공개 증거 README를 준비했다. 제품·새 WSL/브라우저 자원 변경0, Developer 정식 실패0. 다음은 새 QA worker-only lease/G-05 후 공개 QA manifest를 Test/Staging에서 재결박·Git 보존하고 같은 SHA/세 image ID/envelope로 격리 target 검증이다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B control 준비 / 2026-09-27: Main은 R45A 종료 seq1675·lease=null을 predecessor로 epoch35 worker-only 시작 overlay/checker/test를 준비했다. 공개 증거 9파일은 모두 `PENDING_REATTESTATION` placeholder이며 원본·PASS가 아니다. 제품 write scope는 계속 비운다. 로컬 control 검증은 설치된 Python의 stdlib direct 2함수로 수행할 계획이며 pytest는 해당 venv에 없어 SKIPPED로 남긴다. 새 로컬 pytest temp·WSL container/DB/Secret/브라우저 생성0. 준비 파일을 지정 원격에 게시하고 clean remote HEAD에서 canonical seq1676~1677/G-05 PASS 전에는 R45B 자원을 만들지 않는다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B control 기본 검증: 설치된 로컬 venv Python에서 새 두 test 함수를 `runpy`로 직접 실행해 2 PASS/exit0, `git diff --check` exit0을 확인했다. pytest 패키지 부재로 pytest runner 검증은 미실행이며 전용 temp 생성0. epoch35 worker lease는 아직 미발급, 제품 write/WSL runtime 생성0, 정식 Developer 실패0. 다음은 준비 commit/push→canonical seq1676~1677/G-05다.
- R45B epoch35 생성 직전 자원 기록 / 2026-09-27: 준비 `6563b8312077432755b7d7ae0a7d8e1e96c7a7fe`·canonical `df45ee12dea7832780d3106a77fbfb9688833808`를 지정 원격에 게시, local/remote 동일·clean·G-05 seq1677 PASS, Main worker-only lease active/write lease=null, control 직접 2 PASS를 확인했다. WSL-server 사전 inventory에서 전용 `/home/daon/anvil-f18-r45b-staging`·`/home/daon/anvil-f18-r45b-target`·`/home/daon/anvil-f18-r45b-evidence`·`/home/daon/anvil-f18-r45b-material` 모두 부재, 두 Compose project container/network0, 8444 listener0, 전용 Web image tag 부재, 공유 Web/PG ID·상태 불변이다. Owner Main/OS owner `daon`, source staging checkout은 Git SSH exact tag `f18-wsl-r45a-qa`의 clean detached SHA로 한 번 생성하고 image ID 재현 검사 후 후속 Test/Staging과 target 검증에만 사용한다. 추후 target/evidence checkout, 합성 material, 두 Compose project/PG18/MinIO/issuer·private QA key와 8444 listener는 각각 사전 부재·ID 재확인 후 순차 생성하며 target과 staging은 동시 실행하지 않는다. 종료 시 전용 ID/label/owner/연결자 검사 후 두 project/4 image tag/네 checkout·material만 제거하고 잔여0·공유 불변을 확인한다. 기존 pgvector/MinIO cache, 다른 자료·ysna-server/Production은 대상이 아니다. 현재 새 자원 생성0, R45B 실측 미시작, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B source 및 최초 image build 입력 오류: WSL-server `/home/daon/anvil-f18-r45b-staging`을 지정 SSH Git의 annotated tag에서 clean detached exact `d36de847842804ca93e405abe9bff687c1162a69`로 만들고 F-16 `verify_exact_checkout` PASS/exit0을 확인했다. 첫 제한 archive `docker build --target web`은 WSL Docker legacy builder가 앞선 `python-deps` stage의 `deploy/wsl/requirements-runtime.txt`도 필요로 해 COPY missing/exit1이었다. 이는 Main archive 선정 오류 1회이며 제품 image ID 불일치/제품 결함이 아니다. 이후 동일 exact Git SHA의 전체 tracked archive를 Docker 입력으로 사용해 빌드 후 ID를 비교한다. 첫 명령에서 전용 image tag/컨테이너/DB/Secret 생성0, 공유 자원 불변, F-18 accepted=false/F-19 blocked.
- R45B 기존 R45A image 동등성 실패·신규 baseline / 2026-09-27: exact `d36de847842804ca93e405abe9bff687c1162a69`의 전체 tracked Git archive로 WSL Docker legacy builder에서 Web/API/Worker를 순차 빌드했다. 재빌드 ID는 Web `sha256:aac0c07cb48f957b01d0bab7327f51c556bd82a6ff262c8577b177cc6f1c4604`, API `sha256:1c1e5aec94707afde5f96b4b0eefaca83e88fd2ac988ef27ee008823a805f608`, Worker `sha256:ba9394ddd315810668f5f07b2f3afc7dc314281eb4b3f955875da0b71d2e4a13`으로 R45A 세 image ID와 각각 다르다. R45A 원래 ID 세 개는 WSL Docker image store에도 남아 있지 않다. Main은 진행 중인 순차 빌드의 issuer 이전에 중단시켜 최초 빌드 wrapper exit1; 이는 artifact mismatch fail-closed이며 이미지가 같다는 주장을 하지 않는다. R45B staging/target container/network/DB/Secret 생성0. R45A signed envelope도 재사용하지 않고 이 새 image ID를 R45B Test/Staging에서 처음부터 실측·서명·공개 증거로 보존한 뒤 같은 image ID를 재빌드 없이 target에 사용한다. 새 baseline의 실제 Test/Staging이 통과하기 전 target은 시작하지 않는다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B 합성 material 생성 직전 기록: QA issuer image `sha256:79d71c35c04ffcd95e76423e993148d6771bf33832d7f50babc6c875b388b59f`를 exact Git archive로 빌드 완료했고 현재 전용 4 image tag만 생성, container/DB/Secret0이다. cached pgvector PG18 `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`와 MinIO `sha256:69b2ec208575b69597784255eec6fa6a2985ee9e1a47f4411a51f7f5fdd193a9`를 보존한다. staging checkout의 nonsecret Nginx config는 644/owner daon이다. 다음 전용 `/home/daon/anvil-f18-r45b-material`(owner daon/mode700)에 `ca.key/ca.crt/tls.key/tls.crt/signing.key/client-secret/trust.json/compose.env/app-password/pg18-admin-password`만 합성 생성한다. 사설 키·credential은 Git/로그 출력 금지, 전용 QA 종료 시 exact 경로를 삭제해 복구되지 않는다. 공개 CA/TLS SAN·파일 mode 및 Compose config만 출력하고 공유 자원은 건드리지 않는다. F-18 accepted=false/F-19 blocked.
- R45B 합성 material·정적 배포 구성 / 2026-09-27: 전용 material 10파일을 mode700 경로에 생성했고 CA key/env/DB credential600, Web TLS key640 group101, issuer key/client-secret/trust640 group10001, 공개 cert644를 확인했다. 합성 CA fingerprint SHA-256 `23df3788b4e54608b8ad13a50dd57a1cfd803a23871df6b2dbacf35fe20ee844`; `openssl verify` 체인 OK/SAN `anvil-f18-qa.local`, 비밀 원문 출력0. 두 Compose 파일 병합 `config --format json`은 6서비스, Web 단독 `127.0.0.1:8444` publish로 PASS/exit0, runtime container/DB/port는 아직 생성0. 다음은 전용 staging PG18을 먼저 기동해 비관리자 migration/head/vector를 확인하고 이후 API/Worker/issuer/Web의 실제 HTTPS 결선을 검증한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B staging PG18/OIDC 실측: 전용 project `anvil-f18-r45b-staging` PG18 container `dbea1bb62fd40a009240357995b3cdafc09dab41d3126c6af09703c77bfb9c82` healthy/host publish0, 합성 `anvil_app` super/createDB/createRole 모두 false, DB/schema owner 결박 후 app role Alembic upgrade exit0/head `0019_oidc_sessions`, public 61 tables, vector extension0.8.2와 차원3 거리1 쿼리 PASS. 합성 OIDC directory 4테이블 각1행을 seed했다. 6서비스 기동 후 Nginx `-t` exit0, CA 검증 HTTPS `/`·ready·JWKS 200. Web ID `439e3bc241e72a237bca00e34bcf3ba0de639bfa08c33f0bbe7a4a7344cf4019`, internal IP `172.24.0.7`을 단일 proxy trust로 지정해 API만 재생성·Web restart, Web ID/IP 불변. 실제 HTTPS OIDC authorization200→issuer302→callback200/Secure·HttpOnly cookie→session200/authenticated→replay401 PASS. 현재 staging 6서비스/2network와 4 전용 image tag·checkout/material은 QA 진행 중으로 남아 있으며 target은 생성0. 다음 전용 object probe 이름은 `anvil-f18-r45b-staging-artifact-probe`, owner Main, 일회성 API image `--rm`/internal network/합성 MinIO bucket 수명이다. 생성 전 이름 부재 확인 후 `S3ArtifactStore`의 실제 put/read/dedupe/collision/denial만 검사하고 종료 시 container 잔여0을 확인한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B staging MinIO·공개 QA manifest 준비: 전용 API image의 일회성 `anvil-f18-r45b-staging-artifact-probe`에서 제품 `S3ArtifactStore` 실제 put/read·dedupe·wrong credential denial·collision·corruption 거부 PASS/exit0, probe container 잔여0. Main은 새 세 image ID/소스/tag/PG18·OIDC·MinIO 관측을 결박한 QA-only Ed25519 signed envelope를 메모리 생성하고 F-16 `verify_release_manifest` PASS, private key 저장0으로 처리했다. 공개 9파일을 `docs/evidence/f18_r45b/` placeholder 대신 원본으로 채웠다. public fingerprint `sha256:811eacdbf512b47efc755c05f8685d8b79363f96f2f8c104c8ced233500acb8a`, envelope file SHA `sha256:12d5d654cebe0d4355489bdfacc2792c2ae6aef1f5ef57fb311ad89e5948315c`, subject hash `sha256:3da1acce3299571ca81ae36cb4af72740a39833d03a6cc3305d14042daade18b`를 고정한다. QA application-only SBOM과 Git blob 유래 provider 식별자는 완전한 공급망/운영 trust 근거가 아니다. 다음은 공개 원본+보고서를 같은 branch에 commit/push한 뒤 WSL-server가 정확한 Git SHA로 수신해 F-16 CLI 및 F-18 positive/negative preflight를 다시 실행한다. staging runtime 자원은 target까지 같은 image ID를 유지하도록 계획 수명 내 보존 중, target 생성0, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B 공개 증거 Git 재수신·F-16/F-18 preflight / 2026-09-27: 공개 9파일·README·보고서·WORK_STATUS를 기존 단일 branch `8afff26f1b325be4aefa2e828963687724489518`에 commit/push하고 지정 원격 SHA 일치를 확인했다. WSL-server 전용 evidence checkout은 그 SHA를 지정 Git SSH 원격에서 직접 fetch한 clean detached 상태이며 signed envelope 파일 SHA `12d5d654cebe0d4355489bdfacc2792c2ae6aef1f5ef57fb311ad89e5948315c` 일치다. source checkout d36 clean에서 Git 수신 공개 원본의 F-16 CLI `F16_PREFLIGHT_PASS`/exit0, 세 image ID 일치. F-18 `validate_existing_checkout` QA 합성 subject의 positive `READY_FOR_PRIVATE_REHEARSAL`과 wrong Web/missing Web/wrong commit/wrong environment/wrong checkout 5개 negative reason을 모두 PASS/exit0으로 확인했다. 이는 QA synthetic approval이지 사람 DeployApproval 또는 target 실측이 아니다. target 생성 전 inventory: target checkout/project 부재, staging 6컨테이너/2network 및 loopback8444 점유, 전용 4 image tag와 합성 material 유효, source/evidence owner daon·clean/정확한 HEAD. 다음은 staging project만 내려 8444를 비우고 동일 image ID를 재빌드 없이 보존한 채 별도 target checkout·credential/DB/Compose를 생성한다. target용 새 credential 파일은 `/home/daon/anvil-f18-r45b-material/target` 하위에만 만들고 QA 종료 시 상위 material과 함께 제거한다. 공유 서비스·cached image는 대상이 아니다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B target 격리 runtime / 2026-09-27: staging Compose 6컨테이너/2network를 project label로 down해 8444 listener0, 세 image ID 불변을 확인했다. target checkout은 지정 Git exact tag d36 clean detached로 수신했으나 최초 `--no-tags` fetch는 로컬 tag ref가 없어 F-18 `GIT_CHECKOUT_NOT_VERIFIED`(Main Git QA 절차 오류 1회); 원격 annotated tag ref를 정확히 등록한 뒤 같은 envelope SHA `12d5d654...`/합성 subject 및 3 image ID로 `READY_FOR_PRIVATE_REHEARSAL` PASS. target 별도 material 하위 10파일/dir700을 생성해 별도 CA/TLS/OIDC signing/client/DB/MinIO/Telegram credential과 별도 scope를 사용, secret 원문 출력0, 체인/SAN/권한/Compose config PASS. 별도 target PG18 18.4/vector0.8.2 tmpfs·비관리자 role super/createDB/createRole false, Alembic head0019 및 OIDC directory 4테이블 각1행 확인. 첫 Compose 기동은 합성 client-secret 말미 개행으로 issuer가 거부했고 API/Web 종료(Main material 오류 1회); 개행 제거 후 API는 합성 Telegram identity를 제품 필수 chat:user 형식으로 수정해야 기동(Main material 오류 1회). 제품 코드/image 변경 없이 issuer→API→Web 재기동 후 Web만 loopback8444, 단일 internal IP proxy trust, CA 검증 `/`·ready·JWKS 각200, 세 실행 image ID signed manifest와 동일. 실제 target HTTPS OIDC 200→302→callback200/Secure HttpOnly→session200→replay401, invalid callback401, staging CA wrong-chain 거부 PASS. 첫 target ArtifactStore probe는 Docker stdin 미연결로 검사 미실행(Main QA 명령 오류 1회, PASS 아님), 재실행은 실제 put/read/dedupe/wrong credential/collision/corruption PASS·일회성 probe 잔여0. 다음 전용 자원은 `/home/daon/anvil-f18-r45b-material/target/backup.dump` 및 restore 임시 credential 파일 1개, target PG18 내부 scratch DB `anvil_f18_r45b_restore`와 role `anvil_f18_r45b_restore`다. 생성 전 부재를 확인하고 target DB의 합성 데이터를 dump→scratch restore/건수 비교 후 scratch DB/role을 삭제, backup은 SHA만 보고서에 보존하고 QA 종료 시 material 상위와 함께 제거한다. 이 작업은 공유 PG/운영 데이터와 무관하다. 브라우저·네트워크 세부·rollback·최종 정리는 미검증, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B target backup·network 및 브라우저 예정 자원: target custom backup `backup.dump` 199440 bytes/SHA256 `454344c623c4e220177cb5b6c05406bc6c0a50962febbb6f76f41dab260e17be`를 별도 scratch DB/비관리자 role에 복원했다. 첫 `pg_restore`는 vector 확장 COMMENT 소유권 때문에 exit1(제품 오류가 아닌 Main 복원 옵션 오류 1회); exact scratch DB만 재생성하고 `--no-comments`로 exit0, 원본/복원 head0019·61 tables·users/roles/user_roles/bindings/sessions=각1 일치. scratch DB/role/일회성 password 파일 제거·잔여0, backup은 QA 종료 전까지 전용 material에만 유지. target Docker network internal=true/ingress=false, Web만 `127.0.0.1:8444`, 나머지 host publish0, Web/API/Worker/issuer read-only rootfs·cap_drop ALL PASS. 다음 전용 egress probe는 `anvil-f18-r45b-target-egress-probe`(제품 API image/internal network/`--rm`, 사전 부재 후 실행·잔여0). Windows 브라우저 검증 자원은 임시 격리 프로필 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r45b-chrome-profile`, NetLog `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r45b-netlog.json`, DOM 출력 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r45b-dom.html`, SSH loopback tunnel `127.0.0.2:8444`→WSL-server loopback8444와 이 실행의 Chrome/ssh PID만이다. 생성 전 경로·listener·process 점유를 확인하고 기존 Chrome 프로필/탭/계정에는 접근하지 않으며, 검증 후 해당 PID·세 파일 경로만 제거해 잔여0을 확인한다. synthetic TLS SPKI pin으로 기존 trust store를 변경하지 않는다. 실제 egress/Chrome은 아직 미실행, rollback artifact 미확보, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B target egress 및 Chrome 첫 실행: target internal 전용 일회성 egress probe의 외부 `1.1.1.1:443` direct `connect_ex=101` 거부/exit0, probe 잔여0. Windows 사전 경로 부재·port 점유0 확인 후 SSH tunnel PID38288을 `127.0.0.2:8444`에 생성해 listener owner 일치, target TLS 공개 SPKI pin을 계산했다. 첫 headless Chrome은 exit0이지만 DOM 출력0 byte/NetLog 파일 부재여서 검증 결과가 아니며 임시 프로필만 생성됐다(Main 브라우저 호출/관측 오류 1회). 현재 그 프로필 전용 Chrome process는 없는 것으로 재확인했고, 기존 프로필은 미사용. 동일 프로필에서 표준오류를 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r45b-chrome-stderr.txt`로 분리한 한 차례 진단 실행 후 결과에 따라 브라우저 검증 또는 미검증으로 기록한다. 종료 시 이 전용 stderr도 함께 제거한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B target browser·capability QA / 2026-09-27: 두 번째 격리 Chrome headless PID39524는 exit0, DOM3830 bytes/title `Anvil Dashboard`/인증서 오류0, NetLog515077 bytes의 URL_REQUEST_START_JOB 9건 중 앱 요청5 모두 QA same-origin/localhost·내부 Docker host 직접 요청0이다. 나머지 Google 4건은 Chrome 배경 요청으로 앱 결과에서 분리했다. QA 프로필 전용 Chrome process0·터널 PID38288 identity 및 정확한 Temp 경로/재분석점0을 확인 후 PID·프로필·DOM/NetLog/stderr만 삭제해 모두 잔여0; 기존 Chrome profile/tab/account는 미사용. 브라우저 UI 사용자 로그인은 미실행. target 관측 네 capability를 `qa-target-evidence.json`으로 공개하고 메모리 생성 QA-only Ed25519 signed capability envelope를 F-18 `validate_wsl_operational`에 즉시 입력해 positive `READY_FOR_WSL_REHEARSAL`, wrong target `CAPABILITY_NOT_VERIFIED` PASS/exit0. 공개 fingerprint `sha256:cf484b823f82ad3652dcd77e84291eb1693b8d70f3f4c5de8d8a695bedde779e`, 서명 당시 canonical envelope SHA `sha256:7e3a39f49ada157fa7fe82858070a610dc74b32f475f661c8c6d1ce081a4ce0b`, 4분 만료·private key 저장0. 이것은 임시 QA gate이며 실제 사람 승인/Production trust가 아니다. 공개 evidence/envelope/key와 보고서 게시 후 WSL-server가 Git 재수신하는지 확인하고, 전용 target 6서비스/2network·4 image tag·3 checkout/material의 정확한 ID/owner/symlink/연결자를 확인해 잔여0으로 정리한다. 이전 exact rollback artifact 부재로 code/container rollback 미검증, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.
- R45B 공개 target 증거 Git·전용 자원 최종 정리 / 2026-09-27: target evidence/key/envelope·보고서·WORK_STATUS를 기존 branch `1000aa91819cef0fdc4f0512fa32d46042a3c900`에 commit/push해 지정 원격 동일·clean. WSL-server evidence checkout이 같은 Git SHA를 수신했고 public envelope file SHA `dcc41f66b874251404249ed0e496941b842cfca8dce9ed21074ceadc566dfde9`, target evidence file SHA `036dbc8b892dcd94a67e5c4e604ea8de13c97df129119e9bde2b68fc9ac0e655`; 네 capability의 canonical evidence_hash·공개 서명을 서명 당시 시간 기준 `READY_FOR_WSL_REHEARSAL`로 재검증 PASS. 정리 전 target network의 접속자는 정확한 6개 전용 컨테이너뿐, backup SHA `454344c6...` 재확인, checkout owner daon/clean/root symlink0, project volume0, 공유 Web/PG ID 불변이었다. target project down 후 staging/target container·network0/8444 listener0, R45B 전용 Web/API/Worker/issuer 4 image tag를 force 없이 제거했다. 정확한 세 clean Git checkout과 합성 material/backup 네 경로를 삭제해 전부 부재. PG18/MinIO cached image와 공유 Web `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`/PG `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변. 합성 credential/backup은 삭제되어 복구 불가; 공개 해시·보고서는 Git 보존. 이전 exact code/container rollback artifact 미확보, 브라우저 UI 로그인 미실행으로 F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. 다음은 R45B worker-only epoch35 회수용 seq1678 control checkpoint/G-05, 이후 승인 범위 안에서 이전 exact rollback artifact 복구 가능성을 읽기 전용 조사한다. 정식 Developer FAILURE_REPORT 0회, Main QA 절차/입력 오류는 보고서에 각각 분리 기록했다.

# F-18 R45C 이전 rollback artifact 읽기 전용 감사 / 2026-09-27

- 판정: `R21_HISTORICAL_QA_ARTIFACT_NOT_APPROVED_ROLLBACK_BASELINE`. 담당 Main, 시작 branch `codex/f18-wsl-ops`/HEAD 및 지정 원격 `da187871091219e8aee1dd62be85399c75284905`, clean, canonical seq1678/G-05 PASS, worker/write lease=null. 승인 정본 hash는 기존 binding과 동일. 준비 변경 파일은 본 `WORK_STATUS`, `docs/04_test_reports/F-18_R45C_ROLLBACK_ARTIFACT_AUDIT.md`, `docs/work_orders/F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_PLAN.md`뿐이고 제품 write·신규 branch·외부 환경 mutation 0이다.
- `ssh WSL-server` 읽기 전용 검사: R21 clean detached checkout/tag commit `4eadfcd441b55445237545146ae5ba4051739904`, 세 보존 image ID/revision 일치, R21 container 0; 공유 `anvil-web`/`local-postgres` ID·running 상태 불변. R21은 QA 보존 산출물이며 ReleaseDecision/이전 승인 릴리스가 아니다. R26 서명 원본은 제거됐고, R45B 공개 signed manifest가 결박한 세 image ID도 제거됐다. R21 head0016과 R45B target head0019/OIDC 차이로 현재 DB에 직접 code rollback을 수행하지 않는다.
- 새 테스트·DB·컨테이너·브라우저·Secret 자원 0; 명령 오류 0, 정식 Developer FAILURE_REPORT 0. 실제 code/container rollback `NOT_EXECUTED`, 브라우저 UI 로그인·전체 suite·완전 공급망은 미검증. 격리 합성 PG18의 old/new 별도 artifact·code rollback/DB restore 분리 계획을 작성했으나 실행 전이다. 다음은 준비 문서 commit/push→정확한 자원 사전 inventory/수명 기록→worker-only lease/G-05 결박이다. R21 사용 결과도 QA-only로 한정하고 승인 릴리스 복구라고 표시하지 않는다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED.
- 준비 중 G-05 재실행은 exit1 `F18_LOCAL_START_GIT_INVALID`, `F18_R45B_CLOSE_RAW_CHECKSUM_INVALID`다. 새 보고서/계획/WORK_STATUS의 미커밋 준비 변경과 seq1678의 고정 raw checksum 때문에 예상되는 non-green이며 PASS가 아니다. 제품 dispatch/WSL 자원 생성은 신규 canonical checkpoint가 GREEN이 될 때까지 하지 않는다. 이전 seq1678 clean checkpoint의 PASS 이력과 현재 dirty 준비 상태를 구분한다.

# F-18 R45C worker-only 통제 준비 및 QA 자원 사전 inventory / 2026-09-27

- 담당 Main. 시작 `codex/f18-wsl-ops@301e871e7547eccb9b008d48999a7e561068f069`, 지정 원격 동일·clean, canonical seq1678/worker·write lease=null, F-18 accepted=false/F-19 blocked. R45C 보고서·계획은 위 SHA로 Git 게시됐으나 이전 R45B gate 재실행은 exit1 `F18_LOCAL_START_GIT_INVALID`, `F18_R45B_CLOSE_POST_QA_SCOPE_INVALID`, `F18_R45B_CLOSE_RAW_CHECKSUM_INVALID`: R45B의 종료 허용경로와 raw checksum에 새 R45C 문서가 없기 때문이다. 이 결과를 제품 실패나 신규 R45C PASS로 표시하지 않는다.
- 새 control module `scripts/f18_wsl_ops_r45c_overlay.py`, checker 분기, `tests/tooling/test_f18_wsl_ops_r45c_overlay.py`, R45C WorkInstruction/Invocation, 계획의 exact source/resource 명시, 본 WORK_STATUS가 준비 변경이다. 신규 control 테스트는 overlay 부재 assertion RED(exit1) → 모듈 작성 후 기본 결박 시험 GREEN(exit0); 둘째 tamper 시험은 projection 전이라 아직 실제 검증되지 않았다. `py_compile`과 `git diff --check` exit0. 로컬 venv의 `python -B -m pytest -q tests/tooling/test_f18_wsl_ops_r45c_overlay.py`는 `No module named pytest`/exit1이라 pytest 실행은 미검증이고, stdlib `runpy` 1개 실검증만 PASS다. 정식 Developer FAILURE_REPORT 0, Main 도구환경 오류1. 기존 bare 전체 pytest 13 collection ERROR는 별도 non-green이다.
- `ssh WSL-server` 읽기 전용 inventory: `/home/daon/anvil-f18-r45c-old`, `/home/daon/anvil-f18-r45c-new`, `/home/daon/anvil-f18-r45c-material` 모두 부재; Compose project `anvil-f18-r45c-old`/`anvil-f18-r45c-new`의 container/network/volume 각각0, R45C image tag0, loopback8444 listener0. 보존 R21 checkout HEAD/tag `4eadfcd441b55445237545146ae5ba4051739904`와 세 image ID/revision 일치. 공유 `anvil-web` `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`, `local-postgres` `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변이다.
- 예정 전용 QA 자원은 위 세 daon 소유 경로, 두 Compose project의 별도 container/internal+ingress network/PG18·MinIO tmpfs, old R21 exact source `4eadfcd...`와 new R45B source `d36de847...`의 전용 image tag old3/new4, old/new/restore 전용 DB·role, old custom backup, Web-only `127.0.0.1:8444`, 합성 QA key/credential이다. 정확한 tag/DB/role/backup 이름은 R45C 계획에 명시했다. 수명은 이번 한 차례 격리 QA 및 정리까지; 종료 시 exact ID·label·owner·realpath·연결자를 검사한 뒤 전용 자원만 제거해 잔여0을 확인한다. 기존 R21 원본과 공유 자원·Production은 보존한다. 실제 생성은 신규 worker-only lease·G-05 PASS와 재inventory 이후로 제한한다.
- 다음은 control 준비 exact 파일만 commit/push→clean 원격 HEAD에서 seq1679 WorkInstruction, seq1680 worker-only lease를 결박→manifest/checker/tamper 검증으로 G-05 PASS 확인이다. 실제 code/container rollback, browser UI login, 전체 공급망은 아직 `NOT_EXECUTED/UNVERIFIED`이고 F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED다.

# F-18 R45C worker-only 통제 결박·old/new image QA checkpoint / 2026-09-27

- `28417a864313a1bff771c9cafaf4096436cfbb24` 준비와 `ebc10eb9ce213dcc8e3ab4a909ce1ea476f4d765` canonical seq1679 WorkInstruction→seq1680 worker-only epoch36을 기존 branch/지정 원격에 게시했다. clean G-05 `PASS sequence=1680 reporting=AUTO_CONTINUE`, 직접 control 테스트 2 PASS, worker path_scope=[]/write lease=null. WSL 자원은 이 PASS 이후에만 생성했다.
- 생성 직전 WSL-server 세 전용 경로·두 Compose project container/network/volume·R45C tag·8444 listener 모두0, 공유 `anvil-web`/`local-postgres` ID·running 불변을 재확인했다. old `4eadfcd...`와 new `d36de847...`을 지정 SSH Git annotated tag의 clean detached checkout으로 각각 daon mode700 전용 경로에 받았고 F-16 exact checkout 두 건 PASS/exit0. R21 보존 이미지 ID를 바꾸지 않는 R45C-old tag 3개, new source의 추적 Git archive로 제한 빌드한 Web/API/Worker/QA issuer tag 4개를 생성했다. 정확한 tag·full image ID/UID/revision은 `docs/04_test_reports/F-18_R45C_ROLLBACK_ARTIFACT_AUDIT.md`에 고정한다. 네 new 빌드 exit0, Docker legacy builder 경고 외 실행 오류0.
- 현재 `/home/daon/anvil-f18-r45c-old`와 `...-new` clean, old3/new4 tag가 Main `ACTIVE` QA 자원이다. material/DB/container/network/port/Secret/backup 생성0, 기존 R21 checkout/tag/ID와 공유 Web `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`/PG `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running 불변. R45B signed manifest는 new image ID가 달라 재사용 불가; 새 QA-only 서명/실제 rollback/PG18/browser는 `NOT_EXECUTED`다. 다음은 image 결박 공개 QA manifest를 실측으로 만들고 old baseline→new→old/restore 순으로 전용 격리 리허설, 종료 시 exact R45C 자원만 정리한다. 기록 변경 중 G-05 raw checksum은 새 close checkpoint 전까지 non-green이며 이 과거 PASS를 현재 문서 변경 전체의 PASS로 승격하지 않는다. 정식 Developer 실패0, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.

# F-18 R45C 서명·실제 이미지 불일치 fail-closed 검증 / 2026-09-27

- 담당 Main, branch `codex/f18-wsl-ops@7921320e1cad47155988cfc5a9838e4c58f530a5`, 지정 원격 동일·clean으로 시작. WSL-server new exact checkout에 지정 Git alias로 동일 공개 branch를 fetch해 `FETCH_HEAD=7921320...`를 확인했고 checkout source는 clean/detached 그대로 유지했다. 제품 write0, 새 branch0.
- WSL-server Python/cryptography에서 Git 수신 R45B 공개 Ed25519 manifest 서명과 subject hash는 유효했다. 실제 R45C new Web/API/Worker image ID와 대조하면 `MANIFEST_OBSERVATION_MISMATCH`, 잘못된 source commit 기대값도 같은 거부로 종료했다. 세 판정 assertion과 명령 exit0. 이 시험은 signature/mismatch 음성 경계만 증명하고 새 QA manifest나 code/container rollback은 여전히 `NOT_EXECUTED`다.
- WSL QA 오류0. 로컬 venv `cryptography`와 `pytest` 부재는 로컬 test 환경 제약이며 WSL의 실제 verifier로 대체한 범위만 PASS. 현재 QA 자원은 두 exact checkout과 old3/new4 image tag만 `ACTIVE`; material·DB·container·network·port·Secret·backup0. 다음은 실측 image ID에 결박한 QA-only manifest 발행 후 격리 old/new/restore 시험 또는 안전 중단 시 exact 자원 정리·worker 회수다. G-05는 원본 raw checksum 재결박 전 non-green, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.

# F-18 R45C QA-only manifest 결박 / 2026-09-27

- 담당 Main. `codex/f18-wsl-ops`의 `155cd7f`를 WSL-server new checkout이 지정 Git alias로 fetch한 뒤, 공개 원본 8개를 source·Docker image ID·OCI revision과 재대조했다. old/new 각각 `*_QA_FACTS_MATCH_SOURCE_AND_DOCKER` PASS, checkout clean, tag peeled commit 일치, 제품 write0.
- WSL-server 메모리에서만 Ed25519 private key를 생성해 old/new QA-only manifest를 서명·검증했다. public fingerprint `sha256:8cddccfc708c2119c7c786f56855aad6b1f5a9d85450757077cfa5a113c3e2b8`; public key와 서명 envelope만 `docs/evidence/f18_r45c/`에 기록하고 private key·credential은 저장하지 않았다. wrong image ID expected 값은 `MANIFEST_OBSERVATION_MISMATCH`로 거부됐다.
- 실행한 실제 검증: WSL Python verifier exit0, old/new source·artifact·Docker 대조 exit0, JSON/diff check exit0. 새 PG18 DB·Compose container/network·MinIO·backup·browser·Secret은 아직 0. R45C manifest는 QA-only이며 runtime/backup-restore/code-container rollback은 `NOT_EXECUTED`; F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED. G-05는 아직 seq1680 raw checksum 재결박 전 non-green.

# F-18 R45C PG18 restore·runtime 결과 및 정리 / 2026-09-27

- old 격리 PG18 head0016에서 custom-format backup `190028` bytes를 생성했다. old API 내부 readiness=200, Worker head0016 ready. old Web loopback=502는 historical nginx 고정 upstream `anvil-web:3770` incompatibility로 기록했으며 제품 수정은 0건이다.
- backup을 new 격리 PG18의 별도 scratch DB `anvil_f18_r45c_restore`/role에 복원해 head0016 일치 PASS를 확인했다. new target DB는 head0019까지 migration됐으나 OIDC trust material 미구성으로 API=503, Worker는 기본 auth mode에서 migration_head_mismatch. old exact API image를 scratch DB에 재기동한 code/container rollback도 readiness=503으로 미통과했다. 이 결과는 데이터 restore PASS, code/container rollback NOT_EXECUTED/REWORK_REQUIRED로 분리한다.
- Main QA 오류: Compose old 첫 기동은 이미지 entrypoint 중복 command로 실패 1회, old token 길이 제약 1회, MinIO floating tag pull 거부 1회, old app role·schema 권한 보완 2회, runtime readiness 502/503은 제품/역사 artifact 결과로 기록했다. 정식 Developer FAILURE_REPORT 0.
- 다음 조치: R45C 임시 자원 exact cleanup 후 worker lease 회수·G-05 raw checksum 재결박. OIDC runtime과 old image rollback은 별도 보완 작업 없이는 PASS로 승격하지 않는다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.

# F-18 R45C rollback rehearsal 보완 시작 / 2026-09-27

- 판정: `IN_PROGRESS`. 기존 R45C의 503은 old image를 OIDC trust 없는 현행 환경으로 기동한 결과로 분리되었으므로, 승인된 F-18 범위 안에서 old 비-OIDC 환경과 restore head0016 DB의 code/container rollback을 재검증한다.
- 이번 실행의 WSL-server 전용 자원은 `/home/daon/anvil-f18-r45c-rework-old`, `/home/daon/anvil-f18-r45c-rework-new`, `/home/daon/anvil-f18-r45c-rework-material`, Compose project `anvil-f18-r45c-rework-old`/`anvil-f18-r45c-rework-new`, 전용 PG18·network·container·image alias·backup·loopback `127.0.0.1:8446`이다. owner는 `daon`, 수명은 이 보완 QA 1회, 종료 시 exact path/ID/연결자 확인 후 전량 제거한다.
- 생성 전 inventory와 공유 `anvil-web`/`local-postgres` ID를 `ssh WSL-server`로 확인하고, old runtime은 `WSL_ACCEPTANCE`/head0016, new target은 기존 R45C OIDC/head0019와 분리한다. Production·ysna-server·shared DB·운영 credential은 사용하지 않는다.
- 다음 조치: inventory PASS 후 old backup restore와 old API/Worker readiness를 실행하고, 실패 시 해당 단계만 중단·기록한 뒤 exact cleanup한다.

# F-18 R45C rollback rehearsal 보완 runtime 결과 / 2026-09-27

- old exact `4eadfcd441b55445237545146ae5ba4051739904`와 보존 R21 image를 old `WSL_ACCEPTANCE` 환경으로 기동했다. API readiness `200`, Worker `0016_operations_recovery ready`를 확인했다.
- old DB backup `190559` bytes를 별도 restore DB/role에 복원하고 head0016을 확인했다. old image를 restore DB에 연결한 rollback API readiness도 `200`/head0016으로 통과했다. 기존 R45C의 503은 OIDC trust 없는 현행 overlay와 old image를 혼용한 절차 문제로 분리한다.
- 보정 오류 3건(entrypoint command 중복, 합성 identity 형식, restore role 권한)을 각각 수정해 통과시켰고 제품 source/migration/shared DB 변경은 0건이다. 전용 자원 ID와 공유 Web/PG 불변은 `F-18_R45C_REWORK_REPORT.md`에 기록했다.
- 다음 조치: WSL 전용 old project·restore DB/role·backup·checkout/material·image alias를 exact cleanup하고 residue 0을 확인한 뒤 worker lease를 회수한다. F-18 accepted 판정 전 negative gate와 독립 evidence 검토를 유지한다.

# F-18 R45C rollback rehearsal 보완 종료 준비 / 2026-09-27

- old 비-OIDC runtime/API/Worker와 별도 restore head0016 DB의 readiness가 모두 HTTP 200/ready로 통과했다. code/container rollback과 data restore를 분리해 PASS로 기록한다.
- 전용 container·network·DB/role·backup·checkout/material·port를 exact cleanup했고 `R45C_REWORK_CLEANUP_RESIDUE_ZERO_SHARED_UNCHANGED`를 확인했다. 공유 `anvil-web`/`local-postgres` ID와 running 상태는 불변이다.
- 기존 R45C의 wrong image/source/signature mismatch 거부 증거와 이번 G-05 clean projection을 negative gate 근거로 유지한다. 브라우저 사용자 로그인·전체 suite·Production은 미검증/미실행이다.
- 다음 조치: rework worker lease 회수 및 close manifest/G-05 재검증 후 F-18 독립 acceptance review를 수행한다. F-19는 아직 시작하지 않는다.

# F-18 독립 acceptance review / 2026-09-27

- 판정: `ACCEPTED_F18_WSL_SCOPED_QA`. R45A/R45B의 동일 artifact·PG18/OIDC/object/network evidence와 R45C 보완의 old 비-OIDC rollback/restore PASS를 기준별로 대조했다. F-18 완료조건의 Critical/Important 미해결 finding은 0건이다.
- acceptance 범위는 WSL-server 격리 운영 유사 QA로 한정한다. `ysna-server`/Production, 사용자 운영 인수, 전체 pytest, 브라우저 사용자 로그인, human ReleaseDecision은 `UNVERIFIED/NOT_EXECUTED`로 유지한다.
- 다음 조치: canonical F-18 completion event를 기록하고 F-19 WorkInstruction을 계획 순서대로 시작한다.

# F-19 Provider·보안 회귀 시작 / 2026-09-27

- F-18 scoped QA acceptance 후 F-19 WorkInstruction을 발행했다. 제품 변경 없이 Provider/catalog/settings/Web/secret 회귀를 로컬→WSL-server 동일 commit으로 검증한다.
- 로컬 anaconda pytest 범위는 `525 passed, 1 warning`으로 통과했다. WSL 전용 checkout `/home/daon/anvil-f19-provider-security-qa`, owner `daon`, 수명은 이번 회귀 1회이며 종료 후 exact cleanup한다.
- 실제 Provider credential 호출과 Production은 실행하지 않고 `UNVERIFIED/NOT_EXECUTED`로 기록한다. 다음은 WSL checkout 수신·동일 suite 실행이다.

# F-19 Provider·보안 회귀 결과 / 2026-09-27

- 로컬 지정 범위 `525 passed, 1 warning`, WSL-server 동일 exact commit `4d8e9529b78aea15698747e1500180c2d34ba86f`의 잠긴 Python 3.12 범위 `525 passed in 6.79s`로 통과했다.
- WSL 전용 checkout·venv는 제거해 `F19_WSL_CHECKOUT_RESIDUE_ZERO`를 확인했다. R45B browser Network·payload·DB/log/artifact 비노출 evidence도 대조했다.
- live Provider credential 호출·비용·운영 도메인은 실행하지 않았으므로 `UNVERIFIED/NOT_EXECUTED`다. 다음은 F-19 evidence manifest와 acceptance review를 기록하는 것이다.

# Phase F Capability Gate / 2026-09-27

- 판정: `ACCEPTED_PHASE_F_SCOPED_CAPABILITY_QA`. F-01~F-19 acceptance evidence, Local·WSL-server 경계, F-18 격리 rollback/restore, F-19 Provider·egress·Web·secret 회귀를 대조해 Gate를 통과시켰다.
- Production·ysna-server, 실제 Provider credential/비용 호출, 전체 메뉴 사용자 인수와 human ReleaseDecision은 `UNVERIFIED/NOT_EXECUTED`로 유지한다. 이를 운영 PASS로 표시하지 않는다.
- canonical progress seq1687/G-05를 기록했고 다음 계획 항목을 `U-01 Dashboard READY_FOR_WORK_INSTRUCTION`으로 전환했다. 다음 조치는 U-01 WorkInstruction 발행이며, 메뉴 write는 순차적으로 한 개만 수행한다.

# U-01 Dashboard / 2026-09-27

- 판정: `ACCEPTED_U01_LOCAL_WEB_SCOPED`. 기존 Dashboard shell의 health·운영 상태·승인/경고·다음 행동 read model 표시를 계획 범위로 검증했다.
- `npm run web:test` 3 passed, `npm run web:typecheck` PASS, `npm run web:build` PASS, `npm run web:lint` PASS. 브라우저 readiness는 same-origin `/health/ready`만 사용하고 미연결·미실행은 PASS로 표시하지 않는다.
- WSL-server 실제 브라우저 클릭/Network, live read model·Provider·운영 인수는 미실행이다. canonical progress seq1689로 U-01을 완료하고 다음을 `U-02 Workbench READY_FOR_WORK_INSTRUCTION`으로 전환한다.

# U-02 Workbench / 2026-09-27

- 판정: `ACCEPTED_U02_LOCAL_WEB_CONTRACT_SCOPED`. Workbench state/client의 canonical Provider 순서, honest 상태, empty/quota/cancel/reconnect, relative same-origin API와 SSE Last-Event-ID 계약을 검증했다.
- `node --import tsx --test apps/web/tests/workbench.test.mjs` 10 passed, `npm run web:test` Dashboard 회귀 3 passed. 한 번에 두 Node test 명령을 묶었을 때 발생한 React loader 오류는 재현되지 않은 실행 순서/loader 현상으로 PASS에 포함하지 않았다.
- WSL-server 브라우저·Network, live LLM Provider, DB Run hash·human approval 계보와 운영은 미검증이다. canonical progress seq1691로 U-02 완료, 다음은 `U-03 Projects READY_FOR_WORK_INSTRUCTION`이다.

# U-03 Projects 시작 / 2026-09-27

- U-03 WorkInstruction을 발행하고 canonical progress seq1692로 활성화했다. repository intelligence의 zero-delta scan·dirty/untracked·baseline 경계를 기반으로 Projects 메뉴/API/UI를 구현한다.
- 현재는 제품 변경 전 조사·구현 단계이며, `ysna-server`/Production preview는 범위에서 제외한다. 다음 조치는 로컬 Projects UI/BFF 구현 후 동일 commit을 `ssh WSL-server`에서 검증하는 것이다.

# U-03 Projects 완료 / 2026-09-27

- 판정: `ACCEPTED_U03_LOCAL_WSL_CONTRACT_SCOPED`. Projects read-only onboarding UI/client/BFF와 dirty·untracked·baseline 차단 계약을 구현했다.
- 로컬 state/client 5개·route 1개·Dashboard 3개·Workbench 10개, typecheck/build/lint가 통과했다. WSL exact commit `9904541`에서 state/client 5개·route 1개·typecheck가 통과했고 전용 checkout 잔여0을 확인했다.
- WSL Node 18에서는 Vite 8 build가 runtime 요구사항 불충족으로 미검증이다. live browser click/Network·live repository scan·DB baseline도 미검증이며 PASS로 승격하지 않았다.
- canonical progress seq1694로 U-03을 기록했고 다음 항목은 `U-04 Runs READY_FOR_WORK_INSTRUCTION`이다.

# U-04 Runs 완료 / 2026-09-27

- 판정: `ACCEPTED_U04_LOCAL_WSL_CONTRACT_SCOPED`. Run·Step·Delegation·attempt·queue·중단·재개·취소 계약을 검증했다.
- 로컬 execution/queue/delegation 선택 범위 `77 passed, 1 skipped, 1 warning`, Workbench SSE/state 10개 PASS를 기준으로 기록한다. 실제 WSL DB queue·브라우저·live worker는 미검증이다.
- canonical progress seq1696으로 U-04를 완료하고 다음 항목을 `U-05 Reviews READY_FOR_WORK_INSTRUCTION`으로 전환한다.

# U-05 Reviews 완료 / 2026-09-27

- 판정: `ACCEPTED_U05_LOCAL_CONTRACT_SCOPED`. Release guard와 ProductValidation·DefectAssessment·human ReleaseDecision 분리 계약을 `173 passed`로 검증했다.
- 실제 Reviews 브라우저·Network·live DB·사용자 승인·Production은 미검증으로 유지한다. canonical progress seq1698, 다음은 `U-06 Quality READY_FOR_WORK_INSTRUCTION`이다.

# U-06 Quality 완료 / 2026-09-27

- 판정: `ACCEPTED_U06_LOCAL_CONTRACT_SCOPED`. Gate/EvidenceManifest 상태 계약을 `370 passed`로 검증했다.
- 실제 Quality 브라우저·Network·live deployment는 미검증이며 PASS로 승격하지 않았다. canonical progress seq1700, 다음은 `U-07 Knowledge READY_FOR_WORK_INSTRUCTION`이다.

# U-07 Knowledge 완료 / 2026-09-27

- 판정: `ACCEPTED_U07_LOCAL_CONTRACT_SCOPED`. Knowledge 계보·revoke·snapshot 계약을 `406 passed`로 검증했다.
- 실제 Knowledge 브라우저·Network·live vector/DB는 미검증이다. canonical progress seq1702, 다음은 `U-08 Agents & Automation READY_FOR_WORK_INSTRUCTION`이다.

# U-08 Agents & Automation 완료 / 2026-09-27

- 판정: `ACCEPTED_U08_LOCAL_CONTRACT_SCOPED`. role/M1~M5/Skill·Hook/DAG/fencing/takeover 계약을 `275 passed`로 검증했다.
- 실제 Agents 메뉴·브라우저·Network·운영 plugin은 미검증이다. canonical progress seq1704, 다음은 `U-09 Environments READY_FOR_WORK_INSTRUCTION`이다.

# U-09 Environments 완료 / 2026-09-27

- 판정: `ACCEPTED_U09_LOCAL_CONTRACT_SCOPED`. ReleaseManifest·WSL staging·Git SHA·deployment preflight 계약을 `111 passed, 2 skipped`로 검증했다.
- 실제 Environments 브라우저·Network·live WSL deployment는 미검증이며 Production/ysna-server는 제외했다. canonical progress seq1706, 다음은 `U-10 Operations READY_FOR_WORK_INSTRUCTION`이다.

# U-10 Operations 완료 / 2026-09-27

- 판정: `ACCEPTED_U10_LOCAL_CONTRACT_SCOPED`. Operations API/observability·queue·budget 선택 범위를 `46 passed, 1 skipped`로 검증했다.
- 실제 Operations 브라우저·Network·live WSL worker/queue는 미검증이다. canonical progress seq1708, 다음은 `U-11 Settings READY_FOR_WORK_INSTRUCTION`이다.

# U-11 Settings 완료 / 2026-09-27

- 판정: `ACCEPTED_U11_LOCAL_CONTRACT_SCOPED`. Provider/settings/security 선택 범위를 `523 passed`로 검증했다.
- 실제 Settings 브라우저·Network와 live Provider credential/비용은 미검증이다. canonical progress seq1710, 다음은 `PHASE_U_GATE READY_FOR_GATE_REVIEW`이다.

# Phase U Gate / 2026-09-27

- 판정: `ACCEPTED_PHASE_U_SCOPED_CONTRACT_QA`. U-01~U-11 contract evidence를 순서대로 대조했다.
- 실제 1920×1080 브라우저 클릭/Network, live DB/worker/provider와 사용자 운영 인수는 미검증이다. 이를 `RELEASED` 또는 Production PASS로 표시하지 않는다.
- canonical progress seq1711, 다음은 계획 순서상 `F-20 WSL-server 최종 운영 유사 검증`이다.

@@
# F-20 WSL 최종 검증 시작 / 2026-09-27

- F-20 WorkInstruction을 발행하고 canonical progress seq1712로 활성화했다.
- 검증 대상은 WSL-server 동일 commit의 11개 메뉴 smoke·monitoring·ProductValidation·Defect·backup/restore·rollback과 승인된 임시 CDP 브라우저 경계다. Production/ysna-server와 RELEASED 승격은 제외한다.
- 다음 조치는 WSL-server runtime·browser·Network evidence 실행 후 exact cleanup과 최종 판정이다.

# F-20 WSL 최종 검증 checkpoint / 2026-09-27

- 판정: `INCOMPLETE_F20_RUNTIME_BOUNDARY`. 동일 게시 commit `00677052c5791b70253389332c3837b286281dc0`의 WSL 전용 checkout에서 Python 지정 회귀 `153 passed`, 웹 Projects/Workbench `15 passed`, Projects route `1 passed`, Dashboard `3 passed`, typecheck PASS를 확인했다.
- WSL Node `v18.19.1`에서는 Vite 8 build가 `node:util styleText` 요구사항으로 미검증이며, WSL native Chromium 계열 실행 파일은 없었다.
- 승인된 Windows Chrome 임시 headless/CDP 프로필을 SSH 포워드된 동일 WSL runtime에 연결했다. Dashboard·Provider 화면과 same-origin Network 요청은 확인했지만 `/projects`는 WSL `server.mjs`에서 404였다. 이를 11개 메뉴 브라우저 PASS로 승격하지 않는다.
- F-20 target의 live DB/queue/worker/Provider 상태, backup/restore, application rollback, 관찰구간 critical alert 0은 미실행/미검증이다. 이전 Package evidence를 재사용하지 않는다. Production·ysna-server는 접근하지 않았다.
- 임시 WSL checkout·서버·port·SSH forward·Chrome 프로필/process·로그를 exact cleanup하고 WSL/로컬 residue 0을 확인했다.
- 동일 pushed checkpoint의 별도 WSL recovery checkout에서 `test_f14_runbook`, `test_f14_disaster`, `test_f14_retention`, `test_f13_operations_api`, `test_f17_validation`, `test_gates_c14`, `test_release_guard`를 실행해 `170 passed in 3.56s`를 확인했다. 이는 계약·격리 회귀이며 live DB/backup/restore/rollback PASS가 아니다. `/home/daon/anvil-f20-r2`와 `/tmp/f20-r2-*.log` exact cleanup 후 잔류0.
- 정본 `deploy/local/Dockerfile.runtime`의 Node `22.23.0` build stage로 isolated web image를 실제 build했다(typecheck+Vite build PASS, image `sha256:62b200903356f5e8b646a5e2047a900f89e87a24db51148c2e23df182a5e4659`). SSH 포워드 CDP에서 10개 route(`/`, `/projects`, `/runs`, `/reviews`, `/quality`, `/knowledge`, `/agents-automation`, `/environments`, `/operations`, `/settings`) HTTP 200을 확인했으며 요청은 same-origin이었다. Dashboard/Projects 외 route는 honest `페이지를 사용할 수 없습니다` fallback, API health/projects는 upstream 미기동 502였다. live DB/queue/worker/provider와 전체 메뉴 기능 PASS로 승격하지 않는다.
- r3 Docker checkout/image/container·4175 listener·SSH forward·Chrome profile/process/log exact cleanup 후 잔류0.
- r4 격리 PG15·API·web stack을 동일 commit에서 실행했다. Docker Node22 build image와 API runtime을 기동하고 migration `0016_operations_recovery`, API `/health/live=200`, `/api/health/ready=200`을 확인했다. 승인된 임시 Chrome CDP에서 10개 route를 확인했으며 모든 health Network는 same-origin 200이었다. 그러나 `/api/projects/scan=404`(local server.mjs 전용 BFF가 production FastAPI 경로에 없음), Runs/Reviews/Quality/Knowledge/Agents & Automation/Environments/Operations/Settings는 `페이지를 사용할 수 없습니다` fallback이었다. 따라서 F-20 blocking defect 0/11개 메뉴 기능 smoke PASS는 아직 충족하지 않는다.
- r4 isolated PG15/API/web checkout·image·container·internal network·port/SSH forward·Chrome profile/process/log exact cleanup 후 잔류0. 다음 조치: Projects BFF production 경로와 U-04~U-11 실제 메뉴 runtime 구현·검증을 계획 범위에서 보완한 뒤 동일 F-20 target 재검증.
- 보고서: `docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md`. 다음 조치: 이미 설치된 WSL 호환 Node runtime 확인 후 동일 commit의 실제 11개 메뉴 runtime과 DB/queue/worker/provider·backup/restore·rollback을 재검증한다. F-20 active/ReleaseDecision `DEFER` 유지.

# F-20 WSL runtime repair checkpoint / 2026-09-27

- 판정: `IN_PROGRESS_F20_RUNTIME_REPAIR`. 최신 pushed commit `df19100`(부모 `f11e0ae`, `2715978`)에서 production FastAPI `/api/projects/scan`, canonical Projects projection, 9개 read-only menu route와 runtime Git 의존성을 보완했다. `ysna-server`/Production은 접근하지 않았다.
- RED→GREEN: `tests/api/test_projects_scan_api.py`는 구현 전 `ModuleNotFoundError`로 실패했고, 구현 후 `tests/api/test_public_asgi_frontend.py tests/api/test_projects_scan_api.py`는 `6 passed`였다. Anaconda local pytest 기준이다. Windows npm 설치는 보호된 사용자 cache EPERM/ npm 자체 종료로 미검증이며 생성 cache/node_modules는 제거했다.
- WSL-server Docker Node22 web build에서 typecheck+Vite build PASS. runtime image에 Git을 포함하고 exact `safe.directory` 환경을 추가했다. 격리 PG15/API readiness `/health/live=200`, `/api/health/ready=200`.
- 승인된 임시 격리 브라우저에서 `/projects`가 `READY`, branch/head/dirty/untracked와 `READY_TO_REVIEW`를 표시했고, `/workbench`, `/runs`, `/reviews`, `/quality`, `/knowledge`, `/agents-automation`, `/environments`, `/operations`, `/settings`가 각 제목과 `UNAVAILABLE` read-only 상태를 표시하며 fallback 없이 열렸다. 메뉴 요청은 same-origin이었다.
- 전체 Anvil checkout scan은 실제 저장소 규모로 단일 요청이 timeout되어 완료 증거가 아니며, 동일 API 경로의 독립 임시 Git fixture scan은 `200`, `SCANNED_READ_ONLY`, `noWriteProof.identical=true`, `mutationAllowed=false`로 확인했다. 이 차이는 미검증 범위로 유지한다.
- Docker/clone/fixture/network/port/SSH forward/브라우저 탭을 exact cleanup해 `F20_FIX_TEMP_RESIDUE_ZERO`를 확인했다. 다음 조치는 F-20 WorkInstruction의 live queue/worker/provider, backup/restore/rollback 및 전체 checkout scan 성능 경계를 같은 target에서 검증하는 것이다.

# F-20 WSL 최종 검증 완료 / 2026-09-27

- 판정: `COMPLETED_F20_WSL_SCOPED_DEFERRED_RELEASE`. 최신 commit `97adc5c`를 `ssh WSL-server` 격리 runtime에서 검증했고, Production/ysna-server와 사용자 `RELEASED`는 계획대로 제외했다.
- 동일 checkout의 전체 read-only repository scan은 `success=true`, `status=SCANNED_READ_ONLY`, `errors=[]`, `identical=true`, `elapsed_seconds=31.04`였다. Projects API fixture scan도 `200 READY`, `noWriteProof.identical=true`, `mutationAllowed=false`였다.
- Docker Node22 web build의 typecheck+Vite build가 PASS했고, 승인된 임시 격리 브라우저에서 Projects `READY/READY_TO_REVIEW`와 9개 추가 메뉴의 제목·`UNAVAILABLE` read-only 상태를 확인했다. 11개 메뉴 요청은 same-origin이었다.
- WSL runtime은 migration `0016_operations_recovery`, `/health/live=200`, `/api/health/ready=200`, Worker `ready` 및 실행 중 상태를 확인했다. Provider catalog는 9개 항목을 반환했으며 credential 미구성 상태를 정직하게 표시했다. 권한 없는 Operations 세션은 `403 PERMISSION_DENIED`로 fail-closed했다.
- 격리 DB backup SHA-256 `5cb1ab958eaf5481971c778c456dc79594d8ad8ab35fcff9e14d56eb36e59cc0`(186730 bytes), restore head `0016_operations_recovery`, 123 tables, select PASS를 확인했다. restore DB에서 downgrade `0015_agent_team_owner` 후 upgrade `0016_operations_recovery` rollback 재적용을 완료했다.
- 새 격리 DB 관측구간에서 `AUDIT_EVENTS=0`, `AUDIT_HEADS=0`, `CRITICAL_ALERT_EVENTS=0`을 직접 확인했다. 이는 해당 관측구간의 증거이며 장기 모니터링 보장을 의미하지 않는다.
- `F20_FINAL_TEMP_RESIDUE_ZERO`, `F20_ALERT_TEMP_RESIDUE_ZERO`, 기존 `F20_FIX_TEMP_RESIDUE_ZERO`로 임시 checkout·container·image·network·dump·port·SSH forward·브라우저 잔여 0을 확인했다.
- F-20은 WSL 범위에서 완료했지만 ReleaseDecision은 계획대로 `DEFER`이며 Production 배포·사용자 운영 인수·실제 credential Provider 호출은 실행하지 않았다.

# F-20 branch integration gate / 2026-09-27

- `finishing-a-development-branch` 병합 전 전체 pytest를 실행했으나 collection 단계에서 13건 오류로 중단했다. 중복 test module basename(`test_models`, `test_hooks_d09` 등)와 fixture 내부 `src` import 경로가 원인이다.
- F-20 targeted API 6개 테스트와 G-05 seq1714는 PASS지만, 전체 suite가 non-green이므로 현재 `codex/f18-wsl-ops`를 `main`에 병합하지 않고 보존한다. 현재 main checkout은 다른 branch의 dirty 상태라 변경하지 않았다.
- 다음 조치는 계획 범위를 넓히지 않는 별도 test-collection 정리/검토 후 전체 suite를 재실행하는 것이다. Production·ysna-server는 계속 제외한다.

# F-20 branch integration gate 재검증 / 2026-09-27

- 판정: `HOLD_F20_BRANCH_INTEGRATION_NON_GREEN`.
- 정식 collection 경계(`-p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories`)는 `8245 tests collected in 6.82s`, 종료 코드 0으로 통과했다.
- 같은 기준의 전체 실행은 약 27%에서 요약·종료 코드 없이 중단되어 PASS로 판정할 수 없다. `--maxfail=1` 재현에서는 `1044 passed, 1 warning, 1 error in 16.68s`로 종료 코드 1이 확인됐다.
- 첫 확정 오류는 `tests/agent_team/test_worktree_writes_e06.py::test_real_disjoint_write_commit_and_source_zero_mutation` setup의 pytest `tmp_path` 생성 단계 `PermissionError: [WinError 5]`이며 대상은 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh`이다. 이는 제품 기능 실패가 아니라 현재 Windows 임시 디렉터리 권한/잔여 상태 차단으로 분류한다.
- 저장소 내부 `--basetemp` 우회 실행도 정상 요약을 남기지 못했으므로 전체 suite GREEN 또는 제품 회귀로 승격하지 않는다. 임시 `.pytest-f20-basetemp`는 제거했다.
- F-20 WSL targeted/runtime evidence와 G-05 seq1714는 기존 PASS를 유지하지만, branch integration gate는 non-green HOLD이며 `main` 병합·push·branch 삭제를 수행하지 않는다. Production·ysna-server는 계속 제외한다.
- 다음 조치: 별도 승인 없이 제품 코드를 변경하지 않고, pytest 임시 디렉터리 권한/환경을 정리한 뒤 동일 정식 명령의 종료 코드와 전체 요약을 다시 확보한다.

# F-20 통합 Gate 원인 재분류 / 2026-09-27

- 판정: `REWORK_REQUIRED_F20_INTEGRATION_AND_ACCEPTANCE`. 이전 `HOLD`의 Windows pytest 임시 경로 원인을 분리했다. 독립 `--basetemp`에서 첫 대상 테스트 `1 passed in 18.15s`였으며 전용 임시 경로를 정리했다. Windows 전체 실행은 28%에서 중단했고 25% 부근 실패를 관측했으므로 전체 PASS가 아니다.
- Windows `tests/deploy/test_c01_wsl_formal_single_runtime_contract.py`는 `26 passed, 4 failed`였다. 네 실패는 테스트의 `wsl -d Ubuntu` 직접 호출이 현재 지정된 `ssh WSL-server` 경계와 맞지 않고 WSL subprocess가 `4294967295`로 종료된 것이다. 이 결과를 WSL-server 제품 검증 실패로 승격하지 않는다.
- 지정 원격 `codex/f18-wsl-ops`의 `94dcc85a2cc394c056a0b039d4741ccf8b0ecc2a`를 `ssh WSL-server` 전용 checkout으로 가져와 `uv sync --frozen --group dev`로 격리 Python 3.14.3/pytest 8.4.2 환경을 구성했다. 정식 수집(`--import-mode=importlib --ignore=tests/fixtures/repositories`)은 `8245 tests collected in 11.69s`로 통과했다.
- 같은 WSL 환경의 전체 suite `-x` 실행은 `1080 passed, 1 failed in 44.05s`에서 종료 코드 1이었다. 첫 실패 `tests/agent_team/test_worktree_writes_e06.py::test_managed_object_fanout_redirect_is_rejected_before_foreign_write`는 심볼릭 링크를 안전하게 차단하면서 `BackendRejected(REPARSE_PATH_DENIED)`를 반환했으나 계약은 `LeaseError`를 요구한다. 해당 파일 전체 재검증은 `55 passed, 1 failed in 34.51s`; 보안 차단 유지와 공개 오류 형식 정합화가 필요한 제품 회귀다. 전용 WSL checkout·가상환경은 경로/실행 상태 확인 후 제거했고 `F20_SUITE_TEMP_RESIDUE_ZERO`를 확인했다.
- 계획서 F-20 완료조건의 동일 ReleaseManifest 11개 메뉴 기능 smoke·중단/재개와 Phase F Gate의 화면 기반 조작을 최종 보고서 증거와 대조했다. 최종 보고서는 Projects 이외 9개 메뉴를 `UNAVAILABLE` read-only로 기록한다. 따라서 기존 canonical F-20 accepted Event를 임의 수정하지 않되, 현재의 완료 선언을 Gate 충족 증거로 사용하지 않고 독립 재판정 대상으로 표시한다.
- 이 브랜치는 `main` 병합·삭제 전 상태를 유지한다. 다음 조치는 동일 브랜치에서 정확한 제품 수정 WorkInstruction/유효한 worker·write lease를 발행해 Git 쓰기 예외 계약을 RED→GREEN으로 보완하고, F-20의 실제 11개 메뉴·중단/재개 완료조건을 재검증하는 것이다. `P-01`은 F Gate 충족 전 착수하지 않는다. Production·ysna-server는 제외한다.

# F-20 완료 증거 hash 결박 감사 / 2026-09-27

- 판정: `F20_ACCEPTANCE_BINDING_REWORK_REQUIRED`. seq1714 `MAIN_PACKAGE_ACCEPTED`의 `test_report_sha256`은 `14DC37EDAE4589A26EC393B94BD843734FD86BF9ACA5B7EBD54F5FBC99C97D7F`인데 현재 보고서 SHA-256은 `3F4B009A3D401B2727E88A36694083657853F47DD171E1396B6FECDAF82EC7A0`이다. 현재 파일은 기존 완료 commit `14c8c57`의 보고서와 동일하여 이 불일치는 이번 재감사에서 새로 만든 것이 아니다.
- 같은 Event의 `manifest_sha256`은 `C4466666FBD82FCB503BA9CE01D3D33891CB12CAC87DB4D704D7027389E2DE8C`인데 현재 manifest 파일 SHA-256은 `814AB1441CA2997F30322FF7E3890F7D4AFCF13C2F52FD610114ABA8C6BD0692`이다. 보고서·manifest 모두 Event와 현재 파일이 결박되지 않는다.
- 직전 재감사 commit에서 보고서에 덧붙였던 설명은 immutable evidence 경계를 보존하기 위해 `efe739e`에서 정확히 제거했다. 재감사 사실은 이 WORK_STATUS에만 남긴다. G-05 checker는 seq1714에서 `PASS`를 반환하지만 현재 보고서의 hash 결박 불일치를 검출하지 못하므로 그 PASS를 F-20 acceptance 유효성 증거로 사용하지 않는다.
- 다음 통제 조치: seq1714와 과거 report bytes는 수정하지 않고 append-only `EVIDENCE_MANIFEST_INVALIDATED`/재작업 계보 및 새 WorkInstruction을 정식으로 투영하고, checker에 report hash 검증을 추가한다. 검증된 worker/write lease가 발급되기 전 제품 파일 mutation은 시작하지 않는다. 기능 범위·요구사항·중요 위험 변경 승인 요청은 필요하지 않다.

# F-20 증거 결박 검사 TDD / 2026-09-27

- 담당: Main Agent. `docs/04_test_reports/F-20_CONTROL_REWORK_PLAN.md`의 Task 1을 수행했다. `scripts/f20_evidence_binding.py`, `scripts/check_project_progress.py`, `tests/tooling/test_f20_evidence_binding.py`만 코드 변경했다. 제품 파일은 변경하지 않았다.
- RED: 로컬 `uv run --frozen --group dev python -B -m pytest tests/tooling/test_f20_evidence_binding.py -q -o cache_dir=.pytest_cache_f20`는 신규 module 부재로 collection ERROR(종료 1). GREEN: 같은 명령 `2 passed in 0.10s`(종료 0). G-05는 수정 전 `PASS sequence=1714`; 수정 후 `F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH`(종료 1)로 기존 거짓 수락을 차단한다.
- 정식 실패 횟수: 0. 미검증: append-only 무효화·새 lease·WSL 전체 suite·11개 메뉴 기능·중단/재개. 다음 조치는 계획 Task 2의 새 통제 projection을 검증한 뒤 유효 lease에서만 제품 회귀를 수정하는 것이다. 현재 F-20은 `REWORK_REQUIRED`, main 병합과 `P-01` 착수는 금지한다.
- `docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md`를 작성했다. 첫 writer lease의 대상은 Git 쓰기 오류 형식에 필요한 제품 파일 3개로 제한했고, 11개 메뉴 기능 검증은 별도 완료조건으로 유지했다. 아직 worker/write lease를 발급하거나 제품 파일을 수정하지 않았다.

# F-20 R1 재작업 control 사전 검증 / 2026-09-27

- 담당: Main Agent. branch `codex/f18-wsl-ops`, 시작 HEAD `591788470dffef75dac5095c773c5565f431e804`, 시작 worktree clean. 정본 설계·계획·매트릭스·테스트계획 SHA는 progress의 승인 범위 binding과 일치한다. 신규 WorkInstruction SHA `68284A753059B8C58E4847350114C2856C22329C3B67BDE145C85F0D84EC5972`를 보존하고 짧은 `F-20_REWORK_R1_INVOCATION.md`를 별도 작성했다.
- 변경: `scripts/f20_rework_overlay.py`, `scripts/check_project_progress.py`, `tests/tooling/test_f20_rework_projection.py`, invocation, control 재작업 계획. 제품 파일 mutation 0, canonical seq1714 이후 Event/progress mutation 0. 임시 fixture에서만 append-only 생성기·검증기를 실행했다.
- 테스트: `tests/tooling/test_f20_rework_projection.py`는 기능 미구현 시 오류/계약 불일치 RED를 확인한 뒤 로컬 `9 passed in 9.04s`(exit 0). Windows checkout의 Event JSON은 CRLF 88,599개·LF 88,599개로 LF-only marker가 불일치한 원인 1건을 확인해 양 newline 대응 후 GREEN. 별도 Windows pytest 기본 temp 접근 거부 1건은 worktree 내부 전용 `--basetemp=.pytest_tmp_f20_rework`로 격리했다. 동일 근본 원인 3회 반복은 없다.
- 로컬 임시 QA 자원: 이 worktree의 `.pytest_tmp_f20_rework`·`.pytest_cache_f20_rework`, 소유 F-20 R1, 수명 해당 로컬 테스트까지, 정리 대상은 두 정확한 경로다. 아직 정본 projection을 적용하거나 유효 worker/write lease를 발급하지 않았다. 정식 실패 횟수 0, 미검증은 G-05 새 projection·WSL 전체 suite·11개 메뉴·중단/재개·F-20 최종 인수다. 다음은 control 코드 안전 commit/push → 해당 SHA 기준 정본 append-only materialize → G-05/해시/remote 확인이다.
- 추가 회귀 실행: `tests/tooling/test_project_progress.py -q -x`는 `8 passed, 1 failed in 112.58s`(exit 1). 첫 실패 `C30CanonicalReconciliationTests.test_no_early_acceptance_or_lease_revoke`는 현재 Windows 작업본의 과거 Event raw CRLF와 C-30 생성본 LF의 바이트 비교이며 F-20 신규 validator의 결과가 아니다. `.gitattributes`의 `eol=lf`와 Git blob SHA `5327C583FAAB44F74290062F41CB03389C2D07609941CEE4F40D37C5C9DE045A`가 작업본 CRLF→LF SHA와 동일함을 확인했다. 이에 F-20 생성기는 Git 정본 LF로 Event를 append하고 신규 manifest row도 LF 기준으로 hash한다. 이 수정 후 F-20 전용 `11 passed in 6.37s`(exit 0), 전체 tooling 재검증은 새 projection 적용 뒤 수행한다.
- 사전 검증 최신: F-20 증거 결박+R1 projection 테스트 `12 passed in 6.57s`(exit 0). Main actor 위조, 잘못된 무효화 대상·hash, 동일 fencing token, 과거 Event 변조, 잘못된 Git branch/path, 거짓 WSL PASS, digest/manifest 변조를 거부한다. canonical G-05는 아직 seq1714를 읽어 `F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH`(exit 1)이며 새 상태가 적용될 때까지 이 RED를 완료 근거로 쓰지 않는다.

# F-20 R1 control 기준 commit 후 QA / 2026-09-27

- 담당 Main Agent, 기준 commit `c7a244d5611525a3e83c438dd5a2654597cb97ab`는 `development/codex/f18-wsl-ops`에 push·원격 SHA 일치 확인했다. 제품 파일은 여전히 변경하지 않았다.
- 로컬 pytest 임시 경로 `.pytest_tmp_f20_rework`와 `.pytest_cache_f20_rework` 두 곳의 읽기·삭제가 OS ACL `Access is denied`로 거부됐다. PowerShell 재귀·비재귀 삭제, 같은 Python 런타임 삭제, 읽기 전용 ACL 조회까지 실패했다. 삭제 성공으로 표시하지 않는다. 권한 변경은 기존 계획 승인의 일부로 해석하지 않고 두 경로로 한정된 ACL 복구·삭제 허용 여부를 신산님께 비동기로 요청했다. 관련 없는 작업은 계속한다. 현재 Git에는 `.pytest_tmp_f20_rework/`가 untracked로 보이므로 정본 lease 발급은 이 오염 해소 전 보류한다.
- 임시 WSL QA 예정 자원: `ssh WSL-server`의 `/tmp/anvil-f20-r1-control-c7a244d` Git checkout·전용 가상환경. 목적은 동일 SHA의 F-20 control 테스트 확인, 수명은 이번 검증까지, 완료/실패 즉시 checkout·가상환경만 제거하고 경로 잔류 0을 확인한다. 기존 `/srv/anvil-wsl/repo`·Docker·DB·secret·서비스는 변경하지 않는다.

# F-20 R1 control WSL 검증 및 Windows 임시 폴더 권한 예외 / 2026-09-27

- 판정: `F20_R1_CONTROL_CODE_WSL_GREEN; CANONICAL_PROJECTION_PENDING`. `ssh WSL-server`에서 `development/codex/f18-wsl-ops`의 `c7a244d5611525a3e83c438dd5a2654597cb97ab`를 전용 `/tmp/anvil-f20-r1-control-c7a244d`에 checkout하고 `uv sync --frozen --group dev` 후 F-20 결박·projection 테스트를 실행했다. 결과는 `12 passed in 2.34s`(exit 0)다. 정확한 checkout SHA를 재확인하고 그 전용 경로만 제거해 `F20_R1_WSL_CONTROL_TEMP_RESIDUE_ZERO`를 확인했다. canonical seq1714 이후 projection·lease는 아직 발급하지 않았다.
- 신산님은 `.pytest_tmp_f20_rework`, `.pytest_cache_f20_rework` 두 폴더만 ACL 복구 후 삭제를 승인했다. 그러나 현 실행 토큰에서 해당 폴더의 읽기·삭제 및 `takeown.exe /F`가 모두 `Access is denied`였다. 동일 근본 원인의 권한 실패는 3회 이상으로 분류하고 추가 권한 변경 변형 시도를 중단했다. 두 폴더는 삭제되지 않았으며 Git에는 첫 폴더가 untracked로 남는다. 다른 경로의 ACL이나 기존 Chrome·WSL 서비스는 변경하지 않았다.
- 변경 파일: 이 `WORK_STATUS` 기록만 추가. 테스트 범위는 위 WSL 12개로 제한하며 G-05 새 projection, WSL 전체 suite, 11개 메뉴 기능·중단/재개는 미검증이다. 다음 조치는 정확한 두 폴더에 대한 관리자 권한의 ACL 복구·삭제와 잔류 0 확인 후 정본 append-only projection을 적용·검증하는 것이다. 그 전 제품 파일 write, F-20 재수락, `P-01`, main 병합은 수행하지 않는다.
- 추가 권한 진단: 실행 토큰의 `BUILTIN\Administrators`는 `deny only`였다. 두 폴더만 대상으로 하는 UAC 상승 스크립트 첫 실행은 exit 1을 반환했고 폴더는 둘 다 남았다. 실패 지점 확인용 worktree 루트 로그를 추가한 재시도는 자동 안전 검토가 "승인된 두 폴더 밖 로그 생성·반복 실행" 위험으로 거부했다. 이 거부를 우회하지 않았고 일회성 스크립트는 제거했다. 원인은 관리자 실행 실패 지점 미확인, 영향은 두 ACL 폴더의 잔류와 정본 projection 보류다. 다음 조치는 별도 명시된 진단 로그·재시도 허용 또는 관리자 측에서 정확한 두 폴더만 정리한 증거 확인이다.

# F-20 R1 WSL progress 검사기 추가 회귀 / 2026-09-27

- 담당 Main Agent, 기준 원격 SHA `9742ef8af4d05ed80b5d7fc0b306fa45ee478b0e`. `ssh WSL-server` 전용 `/tmp/anvil-f20-r1-progress-9742ef8` checkout에서 `uv sync --frozen --group dev` 후 `python -B -m pytest tests/tooling/test_project_progress.py tests/tooling/test_f20_evidence_binding.py tests/tooling/test_f20_rework_projection.py -q -x -o cache_dir=/tmp/anvil-f20-r1-progress-9742ef8/.pytest_cache`를 실행했다. `2 passed, 1 failed in 6.12s`(exit 1)로, 첫 실패는 `C30CanonicalReconciliationTests.test_current_mutations_fail_closed`의 `git show ed3cae92597d681c76417e26576bed91a0525bad:docs/progress/progress-events.json`(exit 128)이다.
- 로컬 저장소에서 해당 commit 객체와 progress 파일은 읽히지만 `git merge-base --is-ancestor ed3cae9 HEAD`는 exit 1이다. 동일 원격 branch의 WSL clean clone에서는 `git show -s ed3cae9`가 `fatal: bad object`였다. 따라서 C-30 검사기는 현재 branch의 원격 재현 가능한 조상 이외 객체에 의존한다. 해당 테스트나 제품 코드는 아직 수정하지 않았고 전체 progress suite를 PASS로 표시하지 않는다.
- 두 전용 WSL checkout은 각각 정확한 HEAD를 확인한 뒤 제거해 `F20_R1_WSL_PROGRESS_TEMP_RESIDUE_ZERO`, `F20_R1_WSL_C30_DIAGNOSTIC_TEMP_RESIDUE_ZERO`를 확인했다. 오류 횟수: ACL 동일 근본 원인 3회 이상으로 추가 시도 중단; C-30 신규 원인 1회. 미검증: 전체 progress suite GREEN, F-20 canonical projection/lease, WSL 전체 suite, 11개 메뉴 기능·중단/재개. 다음 조치는 ACL 잔류 해소 후 정본 projection과 정확한 범위의 C-30 역사 의존성 수정·재검증이다. Production·ysna-server는 계속 제외한다.

# F-20 R1 승인된 두 폴더 ACL 정리 진단 / 2026-09-27

- 신산님은 `.pytest_tmp_f20_rework`, `.pytest_cache_f20_rework` 두 폴더에 한한 UAC ACL 복구·삭제 재시도와 worktree 루트 진단 로그 1개의 생성·확인·삭제를 승인했다. 이번 첫 UAC 실행은 `ADMIN=True`였고 첫 폴더 아래 113개 파일·폴더의 소유권 취득 및 ACL reset이 성공했지만, pytest `*current` 심볼릭 링크 5개를 안전 검사에서 발견해 삭제 전 중단했다. 각 링크 대상은 동일한 첫 임시 폴더 안이었다.
- 내부 링크 대상 검증을 보완한 다음 UAC 실행도 삭제 전 중단했다. 이유는 실행 `powershell.exe` 5.1의 `DirectoryInfo.Target`가 `System.String[]`인 반면 현재 일반 셸 PowerShell 7.6.6은 `System.String`이라 검사기가 예상치 못한 reparse point로 판정한 것이다. 비승격 PowerShell 5.1의 읽기 전용 재현으로 실제 형식 차이를 확인했다. 이 단계에서 두 폴더는 모두 존재하며 삭제 완료로 표시하지 않는다. 첫 폴더 ACL만 복구되었고 다른 경로 ACL은 변경하지 않았다.
- 동일 정리 시도는 최초 실패를 포함해 3회 이상이므로 추가 권한·삭제 실행을 중단했다. 승인된 진단 로그 1개는 읽은 뒤 삭제해 잔류 0을 확인했고 일회성 스크립트도 제거했다. `WORK_STATUS` 외 제품 파일 변경은 없다. Git에는 첫 임시 폴더가 untracked로 남아 F-20 정본 projection·lease·제품 수정·재수락·main 병합은 계속 보류한다. 다음 조치는 두 폴더 내부 링크를 안전하게 분리하는 PowerShell 5.1/7 호환 절차를 확정하고 별도 정리 실행 범위를 재확인한 뒤 잔류 0을 증명하는 것이다.

# F-20 R1 사후 projection 테스트 fixture 보완 / 2026-09-27

- 담당 Main Agent. canonical projection을 아직 적용하지 않은 상태에서 `tests/tooling/test_f20_rework_projection.py`의 역사 fixture가 현재 Event 1714개만 가정하고, materialization fixture가 가변 현재 파일을 복사해 seq1719 이후 스스로 실패할 결함을 확인했다. 승인된 Task 2 검증 기준을 유지하기 위해 역사 prefix 1714개를 검증하고, fixture predecessor는 현재 브랜치의 조상인 control commit `c7a244d5611525a3e83c438dd5a2654597cb97ab`의 일곱 파일로 고정했다. 해당 파일·조상 관계를 로컬 Git에서 확인했다.
- TDD: 첫 사후 projection 회귀는 WSL SHA `7ae6df3`에서 `1719 != 1714`로 RED(exit 1), 수정 SHA `fe2d93d`에서 `1 passed`(exit 0). 두 번째 가변 predecessor 회귀는 WSL SHA `43ab91c`에서 `_predecessor_bytes` 부재로 RED(exit 1), 수정 SHA `3219be8aad556ff3ae4fe5c41330f4cff40be399`에서 `tests/tooling/test_f20_evidence_binding.py tests/tooling/test_f20_rework_projection.py -q`가 `14 passed in 2.68s`(exit 0). 이 전용 WSL checkout은 정확한 SHA 확인 후 제거해 `F20_POSTPROJECTION_TDD_TEMP_RESIDUE_ZERO`를 확인했다.
- 변경 파일: 위 테스트 파일 1개. 정식 실패 횟수 0(의도한 TDD RED는 제외). 미검증: 실제 canonical seq1719 적용 후 G-05, WSL 전체 suite, 11개 메뉴 기능·중단/재개. 두 Windows 임시 폴더는 여전히 남아 있고 추가 정리 실행 범위를 신산님께 확인 요청한 상태다. 유효 lease 이전 제품 파일 mutation 0, F-20 재수락·main 병합 0. 다음은 임시 폴더 잔류 0 확인 후 Task 2 정본 materialize·검증이다.

# F-20 R1 control 누락 Event fail-closed 보완 / 2026-09-27

- 담당 Main Agent. `validate_control`은 새 Event tail이 누락된 경우 `validate_rework_progress`의 오류 판정 이후에도 `rows[1714]`를 접근해 `IndexError`를 내는 것을 코드 검토에서 확인했다. WSL SHA `9602bb7`의 신규 회귀 테스트에서 동일 `IndexError` RED(exit 1)를 재현한 뒤, Event row의 타입·정확한 길이를 먼저 검사해 `F20_REWORK_TRANSITION_INVALID`로 거부하도록 `scripts/f20_rework_overlay.py`를 최소 수정했다.
- WSL-server는 동일 전용 checkout을 SHA `35395670c7f56bbaf55df31cbf0b976a9e57375a`로 fast-forward pull한 뒤 F-20 evidence binding+projection 전체 `15 passed in 2.94s`(exit 0)를 확인했다. 정확한 SHA 확인 후 전용 checkout을 제거해 `F20_TRUNCATED_TDD_TEMP_RESIDUE_ZERO`를 확인했다. 변경 파일은 검사기와 해당 테스트 각 1개, 정식 실패 횟수 0(의도한 RED 제외). 실제 seq1719·G-05·제품 회귀·WSL 전체 suite·11개 메뉴는 아직 미검증이다.
- Windows 임시 폴더 두 곳은 여전히 존재한다. 링크·폴더 정리 1회 추가 실행 여부를 신산님께 확인 요청한 상태에서 ACL·삭제 재시도는 하지 않았다. 다음은 잔류 0 확인 후 F-20 Task 2 canonical projection·lease 발급·G-05 검증이다.

# C-30 역사 Git 객체 의존성 읽기 전용 분리 / 2026-09-27

- F-20 full-suite 선행 검사에서 드러난 C-30 clean-clone 실패를 읽기 전용으로 좁혔다. 과거 기준 commit `ed3cae92597d681c76417e26576bed91a0525bad`의 Event 첫 1325개와 현재 Event 첫 1325개는 JSON 객체로는 동일(`EQUAL=True`, 최초 차이 없음)하지만, 현재 LF 정규화 raw prefix는 `4,012,498 bytes`·SHA `2D77CEB47E1F2CC98A5E1FBC83E4966F3A7AA0CF4D00523A77EC6EBA4FFD8BE2`로 기존 권위값 `3,985,246 bytes`·SHA `09A6B52717CEF4E4E49B2AA1830B670226FEB272237668CC3EC39E2D07219431`과 다르다. 구 commit의 raw prefix는 기존 권위 SHA와 일치한다. 현재 Event 객체만으로 옛 원시 바이트 증거를 대체할 수 없으므로 임의 재구성·검사 약화는 하지 않았다.
- 로컬 `uv run` 읽기 전용 검사는 사용자 uv cache ACL 때문에 시작 실패 1회였고, 기존 worktree `.venv/Scripts/python.exe -B -c`로 같은 비교를 실행했다(exit 0). 변경 파일은 이 상태 기록만이며 C-30 제품·검사기 수정 0. 임시 checkout·DB·서비스 생성 0. 다음 조치는 F-20 통제 전환 후 원격 clean clone에도 존재하는 C-30 역사 증거 고정 방식을 별도 검증하는 것이다. 두 Windows pytest 임시 폴더 추가 정리 승인 응답 전에는 ACL·삭제를 실행하지 않는다.

# F-20 R1 Windows 임시 폴더 정리 / 2026-09-27

- 신산님의 계속 지시에 따라 이미 승인된 두 정확한 경로 `.pytest_tmp_f20_rework`, `.pytest_cache_f20_rework`만 다시 확인했다. 두 경로는 현재 worktree 바로 아래였고 첫 경로의 심볼릭 링크 5개는 모두 첫 경로 내부를 가리켰다. PowerShell 7에서 링크만 비재귀 삭제한 뒤 두 경로를 재귀 삭제해 두 경로 모두 잔류 0을 확인했다(exit 0). 관련 없는 `.pytest_cache`와 그 ACL은 건드리지 않았다.
- 정리 후 `git status --porcelain=v1`은 출력이 없었다. 제거한 두 폴더는 생성된 임시 테스트 자료이며 이 작업본에서 복구할 수 없다. 정식 실패 횟수는 기존 ACL 정리 3회 이상 기록을 유지하고 이번 재개 실행은 성공 1회다. 제품 파일 수정 0, 새 정본 projection·lease·F-20 수락·main 병합은 아직 없다. 다음은 이 clean SHA를 기준으로 F-20 Task 2 append-only 정본 projection을 적용·검증한다.

# F-20 R1 seq1719 통제 projection / 2026-09-27

- 담당 Main Agent. 임시 폴더 정리 기록 commit `2c966d6b5fb275360e07d6440b011a5b6df351ed`를 `development/codex/f18-wsl-ops`에 push하고 `git ls-remote`로 동일 SHA를 확인했다. 이 clean 기준 commit에서 seq1715~1719의 수락 무효화 → 재작업 지시 → worker lease → 정확한 제품 경로 3개에 대한 write lease → 재개 Event와 progress/handoff/digest/manifest를 생성했다. 과거 1714개 Event의 JSON 객체 및 원시 prefix bytes는 기준 Git blob과 동일하며 역사 보고서와 manifest는 이번 변경 범위 밖이다.
- 검증: `scripts/check_project_progress.py`는 `G-05 ... PASS sequence=1719 reporting=AUTO_CONTINUE`(exit 0). F-20 evidence binding+projection 로컬 집중 테스트는 `15 passed in 8.75s`(exit 0). `git diff --check` exit 0, 독립 read-only 비교 `HISTORICAL_RAW_PREFIX_IDENTICAL=True`, `HISTORICAL_JSON_EVENTS_IDENTICAL=True`, 신규 Event 5개를 확인했다. 테스트 전용 OS 임시 경로 1개는 내부 링크를 확인한 후 삭제해 잔류 0이다.
- 변경 파일: `docs/progress/progress-events.json`, `build-progress.json`, `BUILD_HANDOFF.md`, 신규 F-20 R1 digest·manifest, 이 기록과 F-20 control plan 체크. 정식 실패 횟수 0. 미검증: commit/push 후 WSL-server 동일 SHA 재검증, 전체 suite, 제품 3경로 Git write 오류 수정, 11개 메뉴·중단/재개·복구·Monitoring·blocking defect 0 검증. 제품 파일 변경·F-20 수락·main 병합·Production 작업은 하지 않았다. 다음은 통제 projection commit/push 및 WSL-server 검증이다.

# F-20 R1 seq1719 동일 SHA WSL 검증 / 2026-09-27

- 판정: `F20_R1_CONTROL_PROJECTION_WSL_GREEN; F20_REWORK_IN_PROGRESS`. 통제 projection commit `1ab8905a39ef6f38f9affac530f5b97fae9e73eb`를 `development/codex/f18-wsl-ops`에 push·원격 SHA 일치 확인했다. `ssh WSL-server`에서 전용 `/tmp/anvil-f20-r1-projection-1ab8905` checkout을 해당 정확한 SHA로 받고 F-20 evidence binding+projection 테스트 `15 passed in 4.59s`(exit 0)를 확인했다.
- 최초 WSL G-05는 Git clone 기본 remote가 `origin`인 반면 정본은 `development`를 요구해 `F20_REWORK_GIT_INVALID`(exit 1)였다. 전용 checkout의 remote 이름만 `development`로 변경한 뒤 같은 SHA에서 G-05 `PASS sequence=1719 reporting=AUTO_CONTINUE`(exit 0), checkout Git status clean을 확인했다. 제품·검사기 코드는 바꾸지 않았다. 전용 checkout은 정확한 SHA 확인 후 제거하여 `F20_R1_PROJECTION_WSL_RESIDUE_ZERO`를 확인했다. 오류 횟수: 환경 설정 불일치 1회(정식 제품 실패 0).
- 변경 파일: 이 상태 기록과 F-20 control plan 체크만 추가. 미검증: WSL 전체 suite, Git write 오류 형식 RED→GREEN, 11개 메뉴 실제 기능·중단/재개·복구·Monitoring·ProductValidation·Defect·backup/restore·rollback. 유효 lease는 세 제품 경로로만 제한되며 F-20 수락·main 병합·Production 검증은 하지 않았다. 다음은 control 변경의 독립 검토 후 지정된 Git write 오류 형식 재작업이다.

# F-20 R1 통제 독립 검토 및 Important 수정 / 2026-09-27

- 판정: 독립 읽기 전용 검토 `Critical 0 / Important 3 / Minor 0`, 제품 exact3 착수 전 통제 보완 필요. 확인된 세 결함은 (1) 과거 폐기 fencing token 및 빈 execution token 재사용 허용, (2) 역사 Event JSON 객체는 같지만 원시 prefix 공백 변조 후 현재 hash만 재계산하면 허용, (3) F-20 미완료 상태에서 P-01 successor 및 WI `ACCEPTED` 투영 허용이었다. 검토 자체는 파일 변경 0이며 WSL 15개 재실행·전체 suite·실제 제품 기능·Production은 판정하지 않았다.
- Main Agent가 각 결함에 coherent mutation 음성 테스트를 먼저 추가하여 RED(exit 1)를 확인한 뒤, 이전 Event의 중첩 fencing token 집합 대비 신규 token 비공백·미사용 검사, 기준 Git LF 역사 raw prefix 4,419,645 bytes/SHA-256 `A6819BD667C4BB3A48888AC9674131CCF782AC81D6636F7E97CF7008E9D19D75` 결박, `next_work_package`/`next_successor_work_package` 차단값·`runtime_next_action`·WI `package_status` 정합 검사를 추가했다. 세 개별 GREEN(exit 0) 뒤 F-20 evidence binding+projection 집중 suite `18 passed in 13.92s`(exit 0), G-05 seq1719 PASS(exit 0), `git diff --check` exit 0을 확인했다.
- 테스트에 쓴 OS 임시 경로 3개는 링크·정확한 경로 검사 후 모두 삭제해 잔류 0이다. 변경 파일은 `scripts/f20_rework_overlay.py`, `tests/tooling/test_f20_rework_projection.py`, 이 기록뿐이다. 정식 실패 0(의도한 TDD RED 제외). 미검증: 보완 코드의 commit/push 및 WSL-server 동일 SHA, 전체 suite와 C-30 외부 Git 객체 문제, 제품 exact3 오류 형식, 11개 메뉴·중단/재개 등 F-20 실제 완료 조건. 다음은 이 통제 보완 commit/push와 WSL 동일 SHA 검증이다.

# F-20 R1 통제 보완 동일 SHA WSL 검증 / 2026-09-27

- 판정: `F20_R1_CONTROL_REVIEW_FIX_WSL_GREEN; PRODUCT_REWORK_PENDING`. 보완 commit `bdfbce1829abdfd418d5fcc09816eec5b8d2925e`를 push하고 원격 SHA 일치를 확인했다. `ssh WSL-server`의 전용 `/tmp/anvil-f20-control-bdfbce1` checkout에서 정확한 SHA와 `development` upstream을 확인하고 F-20 집중 suite `18 passed in 5.38s`(exit 0), G-05 `PASS sequence=1719 reporting=AUTO_CONTINUE`(exit 0), clean Git status를 확인했다. 전용 checkout은 SHA 확인 후 삭제하여 `F20_CONTROL_BDFBCE1_WSL_RESIDUE_ZERO`다.
- 변경 파일은 이 상태 기록만 추가. 제품 exact3 파일은 아직 수정하지 않았다. 정식 실패 0. 미검증: WSL 전체 suite/C-30 외부 역사 객체, Git write 오류 형식, 11개 메뉴 및 F-20 실제 검증. 다음은 유효 worker/write lease 확인 후 WorkInstruction의 정확한 제품 세 경로에 developer-primary 단일 writer를 배정하는 것이다.

# F-20 R1 Git object fanout 오류 형식 로컬 재작업 / 2026-09-27

- 판정: `F20_R1_EXACT3_LOCAL_GREEN; WSL_PENDING`. active seq1719 worker/write lease의 정확한 세 경로만 `developer-primary-f20-r1` 단일 writer가 수정했다. POSIX fanout 심볼릭 링크 거부에서 `BackendRejected(REPARSE_PATH_DENIED)`가 외부로 노출되던 것을 `LeaseError(WORKSPACE_GIT_STORE_DRIFT)`로 변환했다. 신규 오류 형식 테스트는 RED 1 failed(exit 1)→GREEN 1 passed(exit 0), 관련 파일 전체 로컬 회귀 `57 passed in 905.21s`(exit 0), 구문·`git diff --check` 통과다. writer 결과는 `docs/04_test_reports/F-20_REWORK_R1_RESULT.md`에 있다.
- Main 독립 확인: 제품 diff가 POSIX guard의 예외 변환과 신규 회귀 1개, 결과 문서만 포함됨을 확인했다. 신규 테스트와 기존 외부 Git write/HEAD 보존 테스트를 재실행해 `2 passed in 25.33s`(exit 0), G-05 `PASS sequence=1719`(exit 0), diff check 통과다. Main OS 임시 pytest 경로는 내부 링크 확인 후 제거해 잔류 0; writer의 OS 임시 경로 3개도 잔류 0이다. 정식 Developer 실패 0.
- 미검증: WSL 동일 SHA 실제 POSIX symlink 원래 실패 테스트·전체 suite, C-30 원격 역사 객체 문제, F-20 11개 메뉴·중단/재개·복구·Monitoring 등 최종 완료 조건. 변경 파일: `packages/agent_team/worktree_writes.py`, `tests/agent_team/test_worktree_writes_e06.py`, `docs/04_test_reports/F-20_REWORK_R1_RESULT.md`, 이 기록. 다음은 exact3 commit/push 후 `ssh WSL-server`에서 동일 SHA 테스트다. F-20 수락·P-01·main 병합·Production은 보류한다.

# F-20 R1 exact3 동일 SHA WSL 및 전체 suite 분류 / 2026-09-28

- 판정: `F20_R1_POSIX_FANOUT_FIXED; FULL_SUITE_NON_GREEN`. 제품 exact3 commit `ac7c4299fe5d24c47bf8989455299231ef60aa6f`을 지정 원격에 push하고 `git ls-remote`로 SHA 일치를 확인했다. `ssh WSL-server` 전용 `/tmp/anvil-f20-product-ac7c429` checkout이 같은 SHA였다. 실제 POSIX symlink 원래 실패와 신규 오류 형식 회귀는 `2 passed in 2.23s`(exit 0)다.
- 전체 suite 첫 명령은 bare pytest 수집의 기존 파일명 충돌·fixture 오수집으로 13 collection ERROR(exit 1). 정식 `--import-mode=importlib --ignore=tests/fixtures/repositories` 실행은 PG15 Compose parser의 필수 `ANVIL_POSTGRES_VOLUME_TARGET` 미지정으로 `1 failed, 2346 passed, 33 skipped`(exit 1); 명시값 `/var/lib/postgresql/data`의 대상 테스트는 1 PASS다. 같은 PG15 전제로 정식 `-x` 실행은 레거시 테스트의 Windows 고정 `D:/tmp`가 WSL에 없어 `1 failed, 2366 passed, 33 skipped`(exit 1)였다.
- 실패 범위 파악을 위해 같은 SHA에서 `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data .venv/bin/python -B -m pytest -q --tb=line -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-product-ac7c429/.pytest_tmp_broad`를 끝까지 실행했다. 결과 `7887 passed, 261 failed, 116 skipped, 14 warnings in 1024.54s`(exit 1). 확인된 공통 실패군은 Windows 고정 `D:/tmp` 경로, 원격 clone에 없는 과거 Git 객체(`abb7361`, `ed3cae9`, `ec9ee09` 등), 현재 seq1719 G-05 라우팅과 역사 projection 검사의 상충이다. 이외 POSIX path/AST/권한 및 Web 상대 URL 검증 실패도 섞여 있으므로 아직 원인별 정확한 수를 확정하지 않았다. 테스트를 제외·PASS로 승격하지 않는다.
- WSL 전용 checkout에는 suite가 만든 `.pytest_tmp_broad`, `.pytest_tmp_formal`, `.pytest_tmp_formal_pg15`만 untracked였고 사용 중 프로세스는 없었다. 정확한 SHA 확인 후 checkout과 그 내부 임시 경로만 제거해 `F20_PRODUCT_AC7C429_WSL_RESIDUE_ZERO`를 확인했다. 기존 공유 Docker/DB/서비스·Production/ysna-server는 변경하지 않았다. 정식 Developer 실패 0; WSL 검증 환경/하네스 오류와 suite 실패는 별도 분류한다.
- 미충족: 전체 suite GREEN, F-20의 실제 11개 메뉴 기능·중단/재개·복구·Monitoring·ProductValidation·Defect·backup/restore·rollback. `F-20` 재수락·`P-01` 착수·main 병합은 금지 상태다. 다음은 대표 실패를 최소 재현해 환경 전제/원격 역사 증거/현재 G-05 라우터 결함을 분리하고, 새 exact-path lease를 발급한 뒤 변경 유형별 RED→GREEN으로 고친다.

# F-20 전체 suite 회복 Task 1: G-05 공통 검사 / 2026-09-28

- 판정: `F20_G05_COMMON_GUARDS_LOCAL_GREEN; WSL_PENDING`. 현재 `codex/f18-wsl-ops`/`1e34bc4749d45155782445249b8d56ad975a6a6d`에서 F-20 전용 G-05 라우터가 필수 필드·handoff·Event 등 공통 검사를 조기 반환으로 건너뛰는 회귀를 확인했다. 새 `F-20_FULL_SUITE_RECOVERY_PLAN.md`에 전체 suite·이식성·역사 증거·실제 기능 검증 순서를 기록했다.
- `tests/tooling/test_f20_rework_projection.py`에 현재 bundle의 필수 필드 누락 및 handoff sequence 불일치 음성 사례를 추가했다. 수정 전 `PRG_MINIMUM_FIELD_MISSING` 부재로 RED `1 failed`(exit 1), 수정 후 GREEN `1 passed`(exit 0). `scripts/check_project_progress.py`의 F-20 경로에 포맷 독립 공통 검사만 복구했고, 구 projection과 의도적으로 다른 handoff 3개 필드는 F-20 전용 digest/summary 검사에 맡겼다. 전체 legacy validator 무차별 호출에 따른 7개 거짓 양성은 도입하지 않았다.
- 독립 읽기 전용 review는 Critical 0/Important 1/Minor 1이었다. Important인 불완전 bundle의 공통 검사 fail-open을 별도 음성 테스트로 RED `1 failed`(exit 1) 확인한 뒤 `F20_REWORK_BUNDLE_INCOMPLETE` 오류로 차단했다. 정상 기준선의 공통 검사 결과 `[]`도 명시적으로 테스트한다. 최종 로컬 집중 검증 `20 passed in 14.07s`(exit 0), G-05 `PASS sequence=1719 reporting=AUTO_CONTINUE`(exit 0), `git diff --check` exit 0. 첫 실행의 기본 pytest 임시 루트는 기존 Windows ACL 때문에 10 setup ERROR였으며, 격리 `--basetemp=.pytest_tmp_f20_common_r2` 재실행으로 해결했다. 해당 폴더의 내부 symlink 9개 대상이 모두 같은 폴더 안임을 확인한 뒤 링크만 비재귀 제거·폴더 삭제했고 잔류 0이다. 정식 Developer 실패 0; 환경 오류 1, 의도한 TDD RED 2.
- 변경 파일: `scripts/check_project_progress.py`, `scripts/f20_rework_overlay.py`, `tests/tooling/test_f20_rework_projection.py`, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, 이 기록. 미검증: WSL 동일 SHA, 전체 suite, F-20 11개 메뉴와 복구·Monitoring·backup/restore 등 실제 기능. 다음은 Task 1 commit/push 및 WSL 집중 검증 후 새 exact-path lease를 발급해 이식성 실패를 처리한다. F-20 수락·P-01·main 병합·Production은 하지 않는다.

# F-20 G-05 공통 검사 동일 SHA WSL 검증 / 2026-09-28

- 판정: `F20_G05_COMMON_GUARDS_WSL_GREEN; FULL_SUITE_NON_GREEN`. Task 1 수정 commit `25f7857c40be924de09f9b6abfb1182f1b10c580`을 `development/codex/f18-wsl-ops`에 push하고 `git ls-remote` SHA 일치를 확인했다. `ssh WSL-server` 전용 `/tmp/anvil-f20-g05-25f7857` checkout에서 정확한 SHA와 원격 tracking branch를 확인하고 F-20 집중 suite `20 passed in 4.76s`(exit 0), G-05 `PASS sequence=1719 reporting=AUTO_CONTINUE`(exit 0), clean Git status를 확인했다.
- 첫 G-05 실행은 테스트가 만든 `.pytest_tmp/` 때문에 `F20_REWORK_GIT_INVALID`였고, 임시 폴더 내부 symlink 9개가 같은 폴더 내부를 가리키며 사용 중 프로세스가 없음을 확인해 그 폴더만 제거했다. 두 번째는 detached HEAD라 같은 Git 오류였고, 정확한 SHA의 원격 tracking branch로 바꿔 G-05 PASS를 확인했다. 테스트·프로세스·Git 상태 확인 후 전용 checkout만 삭제해 `F20_G05_25F7857_WSL_RESIDUE_ZERO`다. 공유 DB/Docker/서비스·ysna-server/Production 변경 0.
- 변경 파일은 이 상태 기록만 추가. 전체 suite 기존 `7887 passed / 261 failed / 116 skipped` 비GREEN은 재실행하지 않았고 해결로 표시하지 않는다. 다음은 새 exact-path lease로 WSL 이식성 실패를 처리한다. F-20 수락·P-01·main 병합은 보류한다.

# F-20 R2 exact8 lease 전환 통제 준비 / 2026-09-28

- 판정: `F20_R2_CONTROL_QA_LOCAL_GREEN; LEASE_NOT_ISSUED`. F-20 전체 suite의 WSL 이식성 실패를 처리할 새 WorkInstruction·invocation과 `F-20_FULL_SUITE_RECOVERY_PLAN.md`의 exact8 경로·seq1719 뒤 append-only 전환 순서를 작성했다. 아직 정본 seq1719 Event·projection은 변경하지 않았고 기존 R1 exact3 lease가 투영되어 있다. 같은 작업 브랜치 외 새 브랜치 생성 0.
- `scripts/f20_rework_r2_overlay.py`와 G-05 라우터는 R1 raw Event prefix 및 1719개 Event의 고정 hash, 기존 write→worker 회수, 신규 WI→worker→write→resume 순서, 새 token·scope·12시간 제한·기준 SHA, progress/handoff/digest/manifest 및 수락 금지를 검사한다. TDD 초기 모듈 부재 RED `2 failed`(exit 1) 후 합성 전환 GREEN을 확인했다. 독립 읽기 전용 review의 Important 3건(actor/project/time 출처, R1 무효화 증거 raw bytes, lease 기준 commit·회수 시각)을 음성 테스트 RED `2 failed`(exit 1)와 추가 기준선 검사 RED `1 failed`(exit 1)로 재현해 보완했다. 최종 R2 집중 `4 passed`(exit 0), 정본 G-05 `PASS sequence=1719`(exit 0), diff check 통과다.
- 최종 R1/R2 결박 집중 suite `24 passed in 16.66s`(exit 0). 검증용 Windows `.pytest_tmp_f20_r2_*` 폴더는 각 정확한 경로와 내부 symlink 대상이 동일 폴더 내부임을 확인한 뒤 링크·폴더 순서로 삭제해 잔류 0. 정식 Developer 실패 0, 의도한 TDD RED 3종. 변경 파일은 R2 WI·invocation·overlay·tests, 기존 G-05 라우터·R1 control 허용집합·회복 계획, 이 기록이다. 미검증: 새 projection 실물 G-05 및 WSL 동일 SHA, 제품 exact8 이식성, 전체 suite, 11개 메뉴 실제 기능. 다음은 control QA commit/push 후 clean 기준선에서 append-only lease를 발급하고 독립 검증한다. F-20 수락·P-01·main 병합·Production은 금지.

# F-20 R2 exact8 lease 실제 투영 로컬 검증 / 2026-09-28

- 판정: `F20_R2_LEASE_LOCAL_GREEN; WSL_PENDING`. 통제 QA commit `fd34d507bea0e8aea4294a9263fd28301c6a0c36`을 지정 원격에 push하고 SHA 일치를 확인한 뒤, clean·G-05 seq1719 PASS 기준선에서 seq1720~1725의 write revoke→worker revoke→R2 WI→worker grant→write grant→resume Event를 append-only로 추가했다. 기존 1719개 Event와 과거 F-20 보고서·manifest는 수정하지 않았다. 새 lease의 제품 exact8은 R2 WorkInstruction과 일치하며 발행 `2026-09-27T15:59:26+00:00`, 만료 `2026-09-28T03:59:26+00:00`다.
- 정본 전환 직후 G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0), R1/R2 결박 집중 suite `24 passed in 18.62s`(exit 0), diff check exit 0. 첫 R2 fixture는 seq1725 현재 파일을 다시 전환 입력으로 사용해 `F20_R2_PREDECESSOR_INVALID` RED 1회였고, 바로 앞 clean 원격 기준선 `fd34d50`의 Git blob을 읽도록 수정해 R2 테스트 `4 passed`로 복구했다. 테스트 임시 폴더는 각 내부 symlink 대상 확인 후 제거해 잔류 0이다. 정식 Developer 실패 0, fixture 전제 오류 1.
- 변경 파일은 progress Event/projection/handoff, 신규 digest·manifest, `tests/tooling/test_f20_rework_r2_projection.py`, 이 기록. 미검증: seq1725 commit/push 및 WSL 동일 SHA, 실제 exact8 제품 변경, 전체 suite, 11개 메뉴 실제 기능. 다음은 통제 투영 commit/push→WSL 동일 SHA 검증 후 유효 worker/write token을 재확인하여 단일 writer의 이식성 재작업을 시작한다. F-20 수락·P-01·main 병합·Production 제외.

# F-20 R2 exact8 lease 동일 SHA WSL 검증 / 2026-09-28

- 판정: `F20_R2_LEASE_WSL_GREEN; PRODUCT_REWORK_PENDING`. seq1725 R2 lease 투영 commit `441a6ca0a42eabaddb5e528d00b7d16a4c61ccdd`을 지정 원격에 push하고 SHA 일치를 확인했다. `ssh WSL-server` 전용 `/tmp/anvil-f20-r2-control-441a6ca` checkout에서 동일 SHA의 R1/R2 결박 집중 suite `24 passed in 12.21s`(exit 0), 임시 폴더 정리 후 G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0), clean Git status를 확인했다. 전용 checkout은 SHA·프로세스·status 확인 후 제거해 `F20_R2_441A6CA_WSL_RESIDUE_ZERO`다.
- 변경 파일은 이 상태 기록만 추가. R2 exact8 제품 수정·전체 suite·11개 메뉴 실제 기능은 아직 실행하지 않았다. 정식 Developer 실패 0, WSL 통제 QA 실패 0. 다음은 현재 lease 시각·token·scope를 확인해 `developer-primary-f20-r2` 단일 writer를 시작한다. F-20 수락·P-01·main 병합·ysna-server/Production은 제외.

# F-20 역사 Git 증거의 기존 원격 ref 회복 / 2026-09-28

- 판정: `F20_HISTORY_EXISTING_PR_REF_VERIFIED; FULL_SUITE_PENDING`. 원격에 새 tag/branch를 게시하지 않고 `git ls-remote development refs/pull/15/head`가 `e2ad28dded92eb0418928ddecb76353368b09d0d`임을 확인했다. 로컬 `git merge-base --is-ancestor`에서 누락 대표 commit `ec9ee09`, `abb7361`, `ed3cae9` 모두 PR #15 head의 조상(exit 0)이었다.
- `ssh WSL-server` 전용 `/tmp/anvil-f20-history-pr15-audit-7840a8e`에서 현재 작업 SHA `7840a8e73dd05be0959a8a761dff16841a28697a` clean clone 후 기존 `refs/pull/15/head`만 명시적으로 fetch했다. `FETCH_HEAD=e2ad28d`, 세 대표 commit의 `git cat-file -e`와 `git show ed3cae9/abb7361:docs/progress/progress-events.json` 모두 exit 0, Git status clean. 전용 checkout·프로세스 확인 후 삭제해 `F20_HISTORY_PR15_AUDIT_RESIDUE_ZERO`. 공유 서버/DB/Docker·ysna-server/Production 수정 0.
- 전체 15개 역사 참조의 suite PASS는 아직 검증하지 않았다. R2 제품 수정 후 WSL 정식 suite에 이 기존 ref fetch를 재현 가능한 준비 단계로 넣는다. 파일 변경은 회복 계획과 이 기록만이다. 새 외부 ref 게시 0, 정식 Developer 실패 0, F-20 수락·main 병합 금지.
- 대표 실제 실패였던 `tests/tooling/test_project_progress.py::C30CanonicalReconciliationTests::test_current_mutations_fail_closed`도 별도 WSL 전용 동일 SHA `7840a8e` checkout에서 PR #15 ref fetch 후 `1 passed in 17.90s`(exit 0)로 확인했다. 전용 checkout은 clean/프로세스 확인 후 삭제해 `F20_HISTORY_TARGET_TEST_RESIDUE_ZERO`. 이 단일 PASS는 전체 역사 참조 테스트나 전체 suite PASS가 아니다.

# F-20 메뉴 수직 검증의 잔여 범위 확인 / 2026-09-28

- 판정: `F20_MENU_VERTICAL_VALIDATION_PENDING`. 승인 계획 §13은 U-01~U-11 각각 API/BFF·UI와 실제 Docker 브라우저 클릭/Network/DB 증거를 요구한다. 현재 U 보고서의 판정은 `LOCAL_*_SCOPED`이며 U-01·U-02·U-04 등에서 실제 WSL 브라우저/DB를 미검증으로 명시했다. 기존 F-20 보고서도 9개 메뉴가 제목과 `UNAVAILABLE` read-only만 표시했다고 기록한다. 현재 `apps/web/src/console/App.tsx`는 해당 route에 공통 `UNAVAILABLE` fallback을 렌더링한다.
- 이전 scoped contract PASS를 11개 메뉴 기능 PASS로 승격하지 않는다. WSL 실제 재검증에서 이 상태가 유지되면 U-01~U-11을 계획 순서로 재작업·독립 검증한 뒤 F-20 최종 조건을 닫는다. 이번 확인은 read-only 문서·소스 대조로 실제 신규 브라우저/DB 실행 증거가 아니다. 변경 파일은 회복 계획과 이 기록만 추가; R2 exact8 writer 경로와 충돌 0, F-20 수락·main 병합 금지.

# F-20 R2 제품 로컬 재작업 및 seq1725 통제 테스트 분류 / 2026-09-28

- 판정: `F20_R2_LOCAL_PRODUCT_GREEN; WSL_EXACT_SHA_PENDING; G05_TEST_FILE_NON_GREEN`. 단일 writer `developer-primary-f20-r2`가 seq1725 유효 exact8 lease 안의 제품·테스트 7개 파일과 `F-20_REWORK_R2_RESULT.md`만 수정했다. Windows 고정 임시 경로 11곳, POSIX 가상 drive/실제 `/mnt/<drive>` 식별, Git symlink 정리, OIDC 테스트 만료 시점, C30 migration AST 기대치를 보완했다. 독립 읽기 전용 리뷰 Important 1건(`/mnt/<drive>` symlink 이탈 우회)을 새 음성 테스트 RED 1 FAIL→수정 후 경로 테스트 7 PASS로 닫았다. 정식 Developer 실패 0.
- Main 독립 검증: 현재 diff의 경로 보안 수정과 테스트를 확인했고 로컬 관련 4개 테스트 파일 `99 passed, 1 warning in 155.48s`(exit 0), `git diff --check`(exit 0), G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0)다. Main 테스트 임시 폴더 2개는 정확한 worktree 내부 경로·내부 symlink를 확인한 뒤 폴더만 제거해 잔류 0이다. Windows Git Bash의 `sort -u` 경로 차이로 writer의 deploy/A14 선택 테스트는 23 PASS·1 FAIL이며 WSL 동일 SHA 판정 전까지 미검증으로 둔다.
- 별도 WSL-server 격리 checkout은 수정 전 SHA `7840a8e73dd05be0959a8a761dff16841a28697a`를 pull하고 기존 PR #15 head를 fetch한 뒤 `tests/tooling/test_project_progress.py` 전체를 실행했다. 결과 `639 passed, 42 failed in 927.67s`(exit 1). 실패 1건은 테스트 로그를 checkout 안에 생성해 R2 Git dirty 검사 `F20_R2_GIT_INVALID`를 유발했다. C21/C09~13/E09 역사 builder 계열은 과거 authority hash·parent/raw 기대와 현재 checkout의 불일치가 나타났다. 그 밖의 현재 projection/digest/fixture 실패를 포함해 42건 전부를 환경 오류로 단정하지 않으며 원인별 재현·수정이 필요하다. 이 검증은 R2 제품 수정 전 SHA이므로 R2 제품 WSL PASS가 아니다. checkout의 4개 symlink가 `.venv` 내부 일반 링크임과 프로세스 종료·정확한 SHA를 확인한 뒤 전용 checkout만 제거해 잔류 0; 공유 서비스·DB·Docker는 변경 0.
- 변경 파일: R2 결과보고와 exact8의 제품·테스트 7경로, 회복 계획과 이 상태 기록. 미충족: 제품 수정 commit/push 후 WSL 동일 SHA 집중/전체 suite, 42건 원인별 처리, 11개 메뉴 및 F-20 통합 완료 조건. 다음은 로컬 diff review·commit/push, WSL 동일 SHA 집중 검증 후 전체 suite 실패 분류다. F-20 수락·P-01·main 병합·ysna-server/Production은 실행하지 않았다.

# F-20 R2 첫 동일 SHA WSL 집중검증과 테스트 전제 보완 / 2026-09-28

- 판정: `F20_R2_WSL_FOCUSED_NON_GREEN; EXACT8_TEST_FIX_LOCAL_GREEN`. R2 제품 commit `ed858e9ac24fb93b70a34128d3e255be4c115e37`을 `development/codex/f18-wsl-ops`에 push하고 `git ls-remote` SHA 일치를 확인했다. `ssh WSL-server` 전용 checkout에서 동일 SHA와 upstream·기존 PR #15 ref를 확인한 뒤 경로/OIDC/C30/Git/deploy/A14 집중 suite를 실행했다. 결과 `227 passed, 5 failed, 1 warning in 95.17s`(exit 1). 전체 suite 또는 F-20 수락 판정이 아니다.
- 5건 중 PG15 Compose 1건은 명시된 `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`를 붙인 단일 재실행에서 `1 passed`(exit 0). 나머지 4건은 한글 Bash locale의 readonly 문구, Git 100644 rollback fixture 직접 실행, 이후 변경된 현재 파일과 과거 A14 R6 registry hash 비교, 현재 browser client 2개의 dynamic `fetchImpl(...)`를 정적 안전 검사기가 상대 경로로 증명하지 못하는 문제다. 특히 browser 검사 실패는 안전 검사 자체를 약화하지 않고 별도 제품 경로 scope에서 해결해야 한다. WSL 테스트 `.pytest_tmp_focused`의 28개 symlink target이 모두 해당 디렉터리 내부임을 확인해 그 임시 폴더만 삭제했고 checkout은 다음 동일 SHA 검증 전까지 유지했다. 공유 서비스·DB·Docker/Production 변경 0.
- 단일 writer가 기존 exact8 범위의 `tests/deploy/test_wsl_staging_harness.py`, `tests/tooling/test_a14_workbench_prototype.py`, `F-20_REWORK_R2_RESULT.md`에서 앞의 테스트 전제 3건을 보완했다. A14 hash 비교는 현재 파일 대신 최초 R6 registry commit `a03aecc74b412515dab983148838c249fca62d3a`의 clean historical blob을 읽으며, rollback 실행권한과 현 인터프리터는 폐기되는 fixture copy에만 설정한다. A14 변경 전 RED 1, 보완 후 로컬 집중 `3 passed`, rollback 회귀 `10 passed`, diff check exit 0; writer 임시 폴더 4개 잔류 0. Main 검토·commit/push 및 WSL 재실행 대기. 정식 Developer 실패 0; 미충족은 browser scanner 1건, 42건 통제 테스트 실패, 전체 suite 및 F-20 실제 메뉴 검증이다.

# F-20 R2 재검증과 R3 보안 경계 분리 / 2026-09-28

- 판정: `F20_R2_EXACT8_WSL_REGRESSIONS_GREEN; F20_OVERALL_NON_GREEN`. 테스트 fixture 보완 commit `cd5683f91eae581bfe306201e74cc60b65d3ed1c`을 push하고 원격 SHA 일치를 확인했다. `ssh WSL-server`의 clean checkout을 해당 SHA로 fast-forward한 뒤 PG 볼륨 명시값과 기존 PR #15 객체로 같은 집중 suite를 재실행했다. 결과 `231 passed, 1 failed, 1 warning in 97.48s`(exit 1); 유일한 실패는 R2 exact8 범위 밖 두 browser API client의 간접 `fetchImpl` 경로가 A14 안전 정적 검사에서 `non-relative-fetch`로 분류된 것이다. 관련 경로·OIDC·C30·Git·deploy의 앞선 4개 실패는 재현되지 않았다. 아직 전체 suite GREEN 또는 F-20 수락이 아니다.
- 집중 suite의 `.pytest_tmp_cd5683f` 안 28개 symlink가 모두 폴더 내부를 가리킴을 검증 후 폴더만 삭제했다. 같은 SHA에서 G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0)와 clean Git status를 확인했다. checkout의 남은 4개 symlink는 `.venv` 표준 링크뿐임을 확인하고 전용 checkout을 삭제해 `F20_R2_CD5683F_WSL_RESIDUE_ZERO`. 공유 서비스·DB·Docker·ysna-server/Production 변경 0.
- 다음은 R2 lease를 append-only로 회수하고, `apps/web/src/api/c29-agent-console-client.js`, `apps/web/src/api/projects-client.js`와 해당 테스트·결과보고 경로만 R3 새 worker/write lease로 발급하는 것이다. 기존 `apiPath` same-origin 검증을 호출 지점에 적용해 정적 검사와 실제 브라우저 경로를 동시에 증명한다. 그 뒤 정확한 Git SHA에서 WSL 전체 suite의 42개 통제 테스트 포함 잔여 실패를 원인별로 처리한다. 정식 Developer 실패 0, F-20 수락·P-01·main 병합 금지.

# F-20 R3 exact5 lease 통제 QA / 2026-09-28

- 판정: `F20_R3_CONTROL_QA_LOCAL_GREEN; R3_LEASE_NOT_ISSUED`. `F-20_FULL_SUITE_RECOVERY_PLAN.md` Task 3에 R2 범위 밖의 브라우저 경로 실패를 기록하고 R3 exact5 WorkInstruction·invocation을 발행했다. `scripts/f20_rework_r3_overlay.py`는 seq1725 R2 write→worker revoke 후 WI→worker→write→resume 6 Event를 append-only로 구성하며 새 epoch3 token·exact5·최대 12시간·기준 Git SHA와 이전 Event/report bytes를 검사한다. `scripts/check_project_progress.py`의 R3 분기와 R2 control scope 준비만 추가했고 정본 seq1725 projection·기존 제품 파일은 아직 바꾸지 않았다.
- R3 전환·scope/token/actor 변조·과거 report/digest·누락 자료 음성 테스트를 추가했다. 누락 report는 최초 `FileNotFoundError` RED(exit 1)였고 `F20_R3_CONTROL_MISSING`으로 fail-closed 수정했다. R1/R2/R3 결박 집중 suite `27 passed in 59.86s`(exit 0), 현재 R2 G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0), diff check exit 0. 검증용 로컬 `.pytest_tmp_f20_r3_*` 폴더는 각각 경로·내부 symlink를 확인한 후 삭제해 잔류 0. 정식 Developer 실패 0; 의도한 통제 TDD RED 1, 후속 오류 분류 조정 1.
- 변경 파일: R3 WI·invocation·overlay·projection 테스트, 기존 G-05 router·R2 허용 control scope, 회복 계획과 이 기록. 미검증: control QA commit/push 및 WSL 동일 SHA, 실제 R3 lease 발급·제품 수정, 전체 suite·11개 메뉴. 다음은 통제 변경만 commit/push하여 WSL 동일 SHA G-05·집중 테스트 후 clean 기준선에서 R2 lease를 회수하고 R3 lease를 발급하는 것이다. F-20 수락·P-01·main 병합·Production 제외.

# F-20 R3 통제 준비 동일 SHA WSL 검증 / 2026-09-28

- 판정: `F20_R3_CONTROL_QA_WSL_GREEN; LEASE_NOT_ISSUED`. 통제 준비 commit `b7bf2a1c1209875933659f32031f2c32f77bb47f`를 지정 원격에 push하고 SHA 일치를 확인했다. `ssh WSL-server` 전용 `/tmp/anvil-f20-r3-control-b7bf2a1` checkout에서 동일 SHA·upstream·기존 PR #15 ref를 확인하고 R1/R2/R3 통제 집중 suite `27 passed in 27.16s`(exit 0)를 실행했다. 테스트 `.pytest_tmp`의 16개 symlink target이 모두 폴더 내부임을 확인해 제거한 뒤 G-05 `PASS sequence=1725 reporting=AUTO_CONTINUE`(exit 0), clean Git status를 확인했다. checkout의 4개 symlink는 `.venv` 표준 링크뿐임을 확인하고 정확한 checkout만 제거해 `F20_R3_CONTROL_WSL_CLEANED`; 공유 DB/Docker/서비스·Production 변경 0.
- 이 기록 외 추가 제품 변경 없음. 정식 Developer 실패 0, WSL 통제 QA 실패 0. 다음은 이 기록 commit/push 후 clean·G-05 기준선에서 R2 write→worker lease를 append-only 회수하고 R3 exact5 worker/write lease를 발급한다. F-20 수락·P-01·main 병합은 금지.

# F-20 R3 exact5 lease 실제 투영 로컬 검증 / 2026-09-28

- 판정: `F20_R3_LEASE_LOCAL_GREEN; WSL_PENDING`. R3 통제 QA 기록 commit `e6e85b631ddc82308b1ae9fe90c3f818c8136627`을 지정 원격에 push하고 SHA 일치·clean status·G-05 seq1725 PASS를 확인한 뒤, 이 commit을 immutable predecessor로 seq1726~1731 write revoke→worker revoke→R3 WI→worker grant→write grant→resume 6 Event를 append-only로 투영했다. 기존 1725개 Event는 원본 Git bytes와 비교되어 변경되지 않았다. 기존 R2 worker/write는 `REVOKED`, 새 `developer-primary-f20-r3` epoch3 worker/write는 `ACTIVE`, 정확한 5개 제품 경로·발행 후 최대 12시간으로 결박됐다. 새 기준 Git SHA는 `e6e85b6`이다.
- 실제 투영 후 G-05 `PASS sequence=1731 reporting=AUTO_CONTINUE`(exit 0), R1/R2/R3 집중 suite `27 passed in 58.07s`(exit 0), diff check exit 0. 테스트 임시 폴더는 정확한 worktree 내부 위치와 내부 symlink target을 확인하고 삭제해 잔류 0. 정식 Developer 실패 0, 제품 writer는 아직 시작하지 않았다.
- 변경 파일: progress Event/projection/handoff, 신규 R3 digest·manifest와 이 기록. 미검증: 투영 commit/push 후 WSL 동일 SHA, R3 두 browser client 제품 수정, 전체 suite, 11개 메뉴 실측. 다음은 통제 투영 commit/push→WSL 동일 SHA G-05·집중 테스트 후 유효 epoch3 token을 확인해 단일 writer를 시작하는 것이다. F-20 수락·P-01·main 병합·Production 제외.

# F-20 R3 lease 동일 SHA WSL fixture 기준 수정 / 2026-09-28

- 판정: `F20_R3_LEASE_G05_WSL_GREEN; TEST_FIXTURE_REWORK_LOCAL_GREEN`. seq1731 투영 commit `55b65797d046fe09af0edd76f975654163c05918`을 지정 원격에 push하고 SHA 일치를 확인했다. `ssh WSL-server`의 전용 checkout은 같은 SHA·upstream·기존 PR #15 ref이며, 테스트 전 clean 상태 G-05 `PASS sequence=1731 reporting=AUTO_CONTINUE`(exit 0)다.
- 첫 R1/R2/R3 집중 suite는 `22 passed, 5 failed in 8.93s`(exit 1). 실패 5건 모두 R3 fixture가 현재 seq1731 HEAD를 다시 1725 이전 투영 입력으로 사용해 `F20_R3_PREDECESSOR_INVALID`가 발생했다. 실제 정본 통제 G-05 실패가 아니며, fixture만 바로 앞 clean 기준선 `e6e85b631ddc82308b1ae9fe90c3f818c8136627`로 고정했다. 보완 후 로컬 전체 집중 `27 passed in 58.58s`(exit 0), diff check 통과. 로컬 테스트 임시 폴더는 내부 symlink를 검사해 제거했다. WSL 첫 실행 `.pytest_tmp` 내부 링크 16개도 모두 폴더 내부임을 확인해 해당 폴더만 제거했고 전용 checkout은 clean 다음 SHA pull용으로 유지했다.
- 변경 파일: `tests/tooling/test_f20_rework_r3_projection.py`, 이 기록. 오류 횟수: 테스트 fixture 기준 오류 1회, 정식 Developer 실패 0. 미검증: fixture 수정 commit/push·WSL 동일 SHA 집중 재실행, R3 제품 두 client, 전체 suite·11개 메뉴. 다음은 이 두 control 파일만 commit/push하고 전용 WSL checkout을 정확한 SHA로 fast-forward해 재검증한다. F-20 수락·P-01·main 병합·Production 제외.

# F-20 R3 exact5 lease 동일 SHA WSL 최종 통제 확인 / 2026-09-28

- 판정: `F20_R3_LEASE_WSL_GREEN; PRODUCT_WRITER_READY`. fixture 기준 수정 commit `c1b1442a4655a00b3ec6aacee2c75287a46ca206`을 지정 원격에 push하고 SHA 일치를 확인했다. `ssh WSL-server`의 전용 checkout을 clean `55b6579`에서 같은 SHA로 fast-forward하고 G-05 `PASS sequence=1731 reporting=AUTO_CONTINUE`(exit 0), R1/R2/R3 통제 집중 `27 passed in 12.73s`(exit 0)를 확인했다. 테스트 `.pytest_tmp_c1b1442`의 16개 symlink가 폴더 내부만 가리킴을 확인 후 제거하고 G-05 재실행 PASS·clean status를 확인했다. 전용 checkout의 나머지 4개 symlink는 `.venv` 표준 링크뿐임을 확인해 정확한 checkout만 제거, `F20_R3_LEASE_WSL_RESIDUE_ZERO`. 공유 DB/Docker/서비스·Production 변경 0.
- 변경 파일은 이 상태 기록만 추가. 정식 Developer 실패 0, fixture 오류 1회 해결. R3 epoch3 worker/write lease의 정확한 5개 경로에서만 단일 writer를 시작할 수 있다. 미검증: browser client RED→GREEN, WSL 동일 SHA 제품 검증, 전체 suite·11개 메뉴. 다음은 이 상태 commit/push 후 R3 token·만료를 확인해 developer-primary 단일 writer에게 WorkInstruction을 전달한다. F-20 수락·P-01·main 병합 금지.

# F-20 R3 same-origin client 로컬 재작업 / 2026-09-28

- 판정: `F20_R3_EXACT5_LOCAL_GREEN; WSL_PENDING; F20_NON_GREEN`. 단일 writer `developer-primary-f20-r3`가 seq1731 epoch3 유효 worker/write lease의 정확한 5개 경로 안에서 두 browser API client에 기존 `apiPath` validator를 호출 지점에 적용하고 두 Node 테스트에 안전 경계 음성 사례를 추가했다. 시작 clean HEAD `dfa85738368f322248818400e432e760bce3684f`; 새 기능·공개 API·scanner 변경 0. 신규 두 테스트는 수정 전 RED(exit 1)→수정 후 GREEN(exit 0), 관련 Node 전체 `21 PASS`(exit 0), A14 `browser_source_findings=0`(exit 0), 로컬 web typecheck·lint·build exit 0이다. lint의 기존 unused React 경고 1건은 PASS로 둔 검사 출력 그대로 보존한다. 자세한 실행·rollback은 `F-20_REWORK_R3_RESULT.md`에 있다.
- Main 독립 검토: 실제 diff는 `c29-agent-console-client.js`, `projects-client.js`, 각각의 테스트와 결과보고서뿐이며 `apiPath`가 두 `fetchImpl` 호출 직전에 적용된다. Main의 Node 21 PASS(exit 0), A14 browser source 0 findings(exit 0), G-05 `PASS sequence=1731 reporting=AUTO_CONTINUE`(exit 0), diff check exit 0. 전체 A14 checker는 두 역사 checksum(`apps/web/server.mjs`, `tests/tooling/test_a14_workbench_prototype.py`)이 여전히 불일치해 exit 1이며 PASS로 승격하지 않는다. writer의 첫 npm 의존성 시도 EACCES 1회 후 lockfile 설치 재시도 성공; 설치·build 임시 산출물 3경로는 worktree 내부·junction 대상을 검사해 제거, 잔류 0. 정식 Developer 실패 0.
- 미검증: 제품 diff commit/push 후 WSL 동일 SHA Node·A14 source·typecheck/lint/build, 실제 browser Network, A14 역사 checksum, 전체 suite 42건 계열과 11개 메뉴 실측. 다음은 exact5 diff commit/push→WSL 동일 SHA 집중 검증 후 잔여 전체 suite를 분류한다. F-20 수락·P-01·main 병합·ysna-server/Production은 하지 않았다.

# F-20 R3 동일 SHA WSL 제품·전체 suite 판정 / 2026-09-28

- 판정: `F20_R3_FOCUSED_WSL_GREEN; FULL_SUITE_NON_GREEN; F20_NOT_ACCEPTED`. R3 exact5 commit `c759956a9592ebfca66ed2bebc03e6db16ea2fe0`은 지정 원격과 WSL 격리 checkout `/tmp/anvil-f20-r3-product-c759956`에서 동일 SHA다. Node client 테스트 `21 passed`(exit 0), A14 browser-source 대상 `1 passed`(exit 0), G-05 `PASS sequence=1731`(exit 0). WSL web typecheck·lint exit 0, lint의 기존 unused React 경고 1건. 시스템 Node 18 build는 `styleText` 부재로 실패했으나 격리 Node `22.23.3`와 lockfile 일치 rolldown `1.2.10` Linux optional binding에서 Vite build exit 0이다. 시스템 Node·manifest·lockfile은 변경하지 않았다. 실제 browser Network는 미검증이며 WSL에 브라우저 실행 파일이 없다.
- WSL 동일 SHA의 정식 전체 pytest `--import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-pytest-c759956`, `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`, 격리 Node22 PATH 결과는 `8112 passed, 48 failed, 116 skipped, 14 warnings in 1271.82s`(pytest exit 1). 이전 261 FAIL보다 감소했으나 비GREEN. 실패 목록은 C30 contract 2, A13 POSIX 경로 1, F18 R12 `development/main` ref 전제 2, Phase B gate 1, progress/history 41, C01 OpenAPI 1이다. 현재 제품 회귀와 역사 fixture/실행 환경을 아직 최종 분리하지 않았고 48건을 skip·PASS 처리하지 않는다. 전체 A14 checker의 역사 checksum 2건도 별도 미해결이다.
- 상위 계획 §13의 U-01~U-11 실제 수직 구현·브라우저/API/DB/Network·독립 수락과 기존 U-01의 `LOCAL_WEB_SCOPED` 수락/하위 WorkInstruction의 미연결 표시 완료조건 사이에 차이가 있다. 현 `apps/web/src/console/App.tsx`는 9개 메뉴를 공통 `UNAVAILABLE` fallback으로 렌더링한다. 이 수락 기록을 F-20 실제 메뉴 완료로 승격하지 않으며 U-01부터 직렬 재작업이 필요하다. F-20의 WSL 실제 runtime·중단/재개·복구·Monitoring·ProductValidation·Defect·backup/restore·rollback도 미검증이다.
- 변경 파일: 이 기록과 `F-20_FULL_SUITE_RECOVERY_PLAN.md`만. 정식 Developer 실패 0; 이번 WSL full suite 48 FAIL 1회, Node18 환경 build 실패 1회(격리 Node22 성공). 다음은 실패군 최소 재현·원인 분류, 현재 R3 exact5 lease 회수→새 exact-path 통제 투영, 순차 RED→GREEN 및 전체 suite 재실행이다. WSL 임시 checkout·pytest base·log·Node cache의 제거 확인은 별도 기록한다. F-20 수락, P-01, main 병합, ysna-server/Production은 하지 않는다.
- 정리: 전체 suite 종료 후 WSL checkout SHA `c759956`·Git clean·pytest process 0을 확인했다. pytest base의 symlink 213개는 모두 base 내부, Node cache symlink 2개는 cache 내부, checkout의 외부 symlink는 `.venv` 표준 Python 실행파일뿐임을 확인했다. 정확한 네 경로 `/tmp/anvil-f20-r3-product-c759956`, `/tmp/anvil-f20-pytest-c759956`, `/tmp/anvil-f20-node22-cache-c759956`, `/tmp/anvil-f20-full-c759956.log`만 제거하고 `F20_C759956_WSL_RESIDUE_ZERO`를 확인했다. 공유 서비스·DB·Docker와 Production은 변경하지 않았다.
- 후속 읽기 진단: F18 R12 두 테스트는 WSL clone에 `development/main` ref가 없어 둘 다 `rev-parse` 종료 128이었다. ref가 존재하는 로컬에서 정확한 두 테스트 재실행은 `1 failed, 1 passed`(exit 1); 남은 것은 역사 `BASE` 대비 현재 main의 `F18_WSL_OPS_R12_MAIN_DRIFT`다. ref fetch만으로 해결됐다고 표시하지 않는다. C30 contract 두 테스트는 현재 Event/progress를 seq1357 시절 고정값과 비교하고, A13은 POSIX에서 `allowed_root.swapcase()`가 존재하지 않는 경로가 되는 전제를 확인했다. R4 제품/테스트 scope 전환 전 읽기 진단이며 코드 수정 0.

# F-20 R4 비G-05 실패군 통제 준비 / 2026-09-28

- 판정: `F20_R4_CONTROL_QA_LOCAL_GREEN; R4_LEASE_NOT_ISSUED`. 시작 clean `codex/f18-wsl-ops@b8e9e6803587f4b98adc9c56d23c24b6c4999570`, 정본 seq1731 R3 worker/write ACTIVE. 승인된 F-20 전체 suite의 비G-05 7 FAIL(C30 2, A13 1, F18 R12 2, Phase B 1, C01 1)을 다루는 R4 exact6 WorkInstruction·invocation과 회복 계획을 작성했다. R3 결과 보고서는 유효 R3 writer가 WSL 증거로 갱신했고 Main diff·G-05 검토 후 `b8e9e68`로 push, 원격 SHA 일치를 확인했다.
- Main 통제 QA는 R3 write→worker revoke 후 새 WI→worker→write→resume 6 Event를 seq1732~1737에만 append하는 R4 overlay·G-05 route와 위조 음성 테스트를 추가했다. R4 모듈 부재 RED `1 failed`(exit 1), 라우터 추가 전 RED `1 failed`(exit 1), 수정 후 R4 대상 GREEN `1 passed` 및 R1~R4 집중 전체 `32 passed in 104.37s`(exit 0). 현재 정본은 아직 seq1731이며 G-05 `PASS sequence=1731`(exit 0). 여섯 `.pytest_tmp_f20_r4_*` 임시 폴더의 29개 링크가 각 폴더 내부만 가리킴을 확인하고 정확한 폴더만 삭제해 잔류 0이다. 정식 Developer 실패 0, 의도한 TDD RED 2.
- 원인 보강: C01 현재 OpenAPI에는 승인된 F-13 `GET /api/operations/alerts`, `GET /api/operations/audit` 두 경로만 기존 C01 역사 테스트의 후속 allowlist에서 누락됐다. 메모리 내 진단으로 두 경로만 포함하면 해당 C01 검사는 PASS했으며 파일 변경 0. Phase B 과거 manifest의 raw checksum 16개 중 현재 successor 매트릭스·테스트계획서 2개만 달라 과거 기준선 비교가 필요하다.
- 중요 원본 이력 발견: C30 manifest의 seq1262 raw Event prefix hash는 과거 `abb7361`에서 일치하지만 현재 ledger는 불일치한다. 첫 차이는 F-02 scope 배열의 공백/개행 바이트(offset 3868711); `git blame`은 `14c8c574` F-20 정리 commit의 전체 Event 재직렬화를 가리킨다. `14c8c574^`의 seq1~1712와 현재 JSON 의미 비교는 seq1689~1712의 24개 Event 내용도 다르다. 이는 단순 역사 테스트 오판으로 숨기지 않으며 R4 exact6 밖의 감사 이력 무결성 복구 과제로 분리했다. 현재 진행상태 41 FAIL을 skip/PASS 처리하지 않는다.
- 변경 파일은 R4 WI·invocation·overlay·통제 테스트, 기존 G-05 router/R3 control 허용집합, 회복 계획과 이 기록이다. 미검증: control QA commit/push 및 WSL 동일 SHA, 정본 R4 투영, exact6 writer 변경, 전체 suite 재실행, 11개 메뉴 실제 기능과 브라우저 Network. 다음은 통제 QA commit/push→WSL 동일 SHA 통제 검사→clean 기준선 R3 revoke/R4 issue다. F-20 수락·P-01·main 병합·ysna-server/Production 제외.

# F-20 R4 통제 독립 검토 보완 / 2026-09-28

- 판정: `F20_R4_CONTROL_REVIEW_IMPORTANT_3_RESOLVED_LOCAL; R4_LEASE_NOT_ISSUED`. 읽기 전용 검토 Critical 0/Important 3/Minor 1. 이전 R3 digest·manifest·handoff를 새 lease 발급 전에 재검증하지 않는 문제, epoch4 fencing token 형식 미검증, 발급 시 HEAD/원격 SHA의 정확한 일치 미검증을 각각 음성 테스트 RED로 재현했다. R3 통제 전체를 과거 발급 시각 기준으로 검사하고, 두 token의 epoch·nonce를 고정하며, 발급 시 branch/upstream/HEAD/remote SHA를 모두 결박했다. G-05 fixture의 Git 검사 mock을 제거해 실제 branch/upstream을 검증한다. Minor인 이전 Event 의미 불변 바이트 변조도 별도 음성 테스트로 차단 확인했다.
- 실제 검증: 선행 R3 변조 digest/manifest/handoff `3 passed`(exit 0); 토큰 및 HEAD/remote drift 수정 전 `3 failed`(의도한 RED, exit 1)·수정 후 R4 `10 passed`(exit 0); 역사 Event 바이트 음성 `1 passed`(exit 0); R1~R4와 evidence binding 집중 `40 passed in 157.08s`(exit 0). `git diff --check` exit 0. 테스트 임시 7경로의 내부 symlink 40개가 각 경로 내부를 가리키는지 확인 후 전용 경로만 삭제했고 잔류 0. 정본 G-05는 삭제 전 임시 미추적 경로 때문에 `F20_R3_GIT_INVALID`(exit 1), 삭제 후 `PASS sequence=1731`(exit 0). 정식 Developer 실패 0, 통제 검토 보완 3건, 추가 의도한 TDD RED 4.
- 변경 파일: R4 overlay·통제 테스트 및 본 기록. 미검증: commit/push·WSL 동일 SHA, canonical seq1737 투영, R4 exact6 구현, 전체 suite 재실행, 실제 브라우저·DB·Provider. 다음은 통제 QA commit/push→WSL-server 동일 SHA 검사→정본 R4 lease 발급이다. F-20 수락·main 병합·Production 제외.

# F-20 R4 WSL fixture 기준 SHA 보완 / 2026-09-28

- 판정: `F20_R4_WSL_CONTROL_FIXTURE_REWORK; R4_LEASE_NOT_ISSUED`. 통제 checkpoint `fefd180f3fe3feb4a5333b08fbe6351a5f7ab49c`는 지정 원격 SHA 일치·clean이었고, WSL-server 전용 `/tmp/anvil-f20-r4-control-fefd180`에 동일 SHA로 가져왔다. `uv sync --frozen --group dev` exit0. WSL 집중 결과는 `34 passed, 6 failed in 44.95s`(exit1); 6건 모두 과거 `b8e9e68`을 합성하는 R4 fixture가 `development/codex/f18-wsl-ops`의 현재 원격 끝 `fefd180`을 가져와 이전 SHA 발급 검사에서 거부된 같은 근본 원인이다. 실제 R4 materialize의 정확한 SHA 검사 자체는 완화하지 않는다.
- 테스트 fixture 안의 전용 Git remote-tracking ref만 과거 `b8e9e68`로 고정하고, 로컬 R4 `11 passed in 131.49s`(exit0)로 재확인했다. WSL 첫 실행의 임시 checkout·venv·pytest 산출물은 아직 정리 전이며 공유 DB/Docker·Production 변경0. 정식 Developer 실패0, 통제 fixture 이식성 오류1. 변경 파일은 `tests/tooling/test_f20_rework_r4_projection.py`와 본 기록만이다. 다음은 전용 임시 폴더 정리→fixture 보완 commit/push→WSL 동일 SHA 40건·G-05 재검증→정본 R4 lease 발급이다.

# F-20 R4 통제 WSL 동일 SHA 검증 / 2026-09-28

- 판정: `F20_R4_CONTROL_WSL_GREEN; R4_LEASE_NOT_ISSUED`. fixture 보완 commit `508d6cef57bc2ca30801b3574aaac2fb12017215`를 지정 원격에 push하고 로컬·원격·WSL-server 전용 checkout의 SHA 일치를 확인했다. WSL 전용 checkout에서 R1~R4/evidence binding 집중 `40 passed in 39.82s`(exit0), G-05 `PASS sequence=1731 reporting=AUTO_CONTINUE`(exit0), Git clean을 확인했다. 테스트가 만든 `.pytest_tmp_r4`의 26 symlink가 모두 해당 전용 경로 내부를 가리킴을 확인하고 정확한 폴더만 삭제하여 잔류0. 전용 checkout·venv는 다음 canonical projection의 동일 SHA 검증까지 보존하며 공유 DB/Docker·Production 변경0.
- 변경 파일은 본 기록만이다. 정본은 여전히 seq1731/R3 lease이며 R4 write는 아직 시작하지 않았다. 정식 Developer 실패0, 환경/fixture 오류1, WSL 통제 집중 재검증 PASS. 다음은 clean Git 기준 `508d6ce`에서 R3 write→worker revoke/R4 exact6 grant를 append-only 투영하고 G-05·Git diff를 검증한 뒤 그 결과를 commit/push·WSL 동일 SHA로 확인한다.

# F-20 R4 정본 lease 투영·로컬 재검증 / 2026-09-28

- 판정: `F20_R4_LEASE_PROJECTED_LOCAL_GREEN; WSL_PROJECTION_PENDING`. 지정 원격과 일치한 `codex/f18-wsl-ops@508d6cef57bc2ca30801b3574aaac2fb12017215`에서 기존 R3 worker/write lease를 append-only 회수하고 Event seq1732~1737에 R4 WI→epoch4 worker/write exact6 lease→resume을 투영했다. 변경 정본은 `docs/progress/progress-events.json`, `build-progress.json`, `BUILD_HANDOFF.md`, 새 R4 detached digest·manifest와 본 기록 6개 경로뿐이다. F-20 accepted=false, P-01 차단, 제품 runtime/API 수정0. 신규 lease 만료는 `2026-09-28T07:09:26+00:00`이며 유효성은 다음 writer 시작 전 다시 확인한다.
- 투영 직후 로컬 G-05 `PASS sequence=1737 reporting=AUTO_CONTINUE`(exit0), R1~R4/evidence binding 집중 `40 passed in 218.49s`(exit0), `git diff --check` exit0. 전용 `.pytest_tmp_f20_r4_projection_live`의 symlink 26개가 내부를 가리킴을 확인 후 해당 폴더만 삭제해 잔류0. 정식 Developer 실패0, 투영 오류0. WSL-server 동일 SHA 검증 및 R4 제품 exact6 변경은 아직 미실행. 다음은 정본 checkpoint commit/push→WSL-server seq1737 G-05·집중 테스트→단일 writer R4 7건 RED→GREEN이다.

# F-20 R4 정본 WSL 동일 SHA 검증·writer 이관 / 2026-09-28

- 판정: `F20_R4_LEASE_WSL_GREEN; EXACT6_WRITER_READY`. seq1737 정본 commit `84cf556ffa1eebc148fe1d2ec2f42e966337daf7`을 지정 원격에 push하고 로컬·원격·WSL-server SHA 일치를 확인했다. WSL 전용 checkout에서 G-05 `PASS sequence=1737 reporting=AUTO_CONTINUE`(exit0), R1~R4/evidence binding 집중 `40 passed in 43.05s`(exit0). 임시 `.pytest_tmp_r4`의 내부 symlink 26개를 확인하고 폴더만 삭제했으며 재실행 G-05 PASS·Git clean이다. 전용 checkout·venv는 R4 제품 동일 SHA 검증에 재사용할 수 있게 유지한다.
- 정본 R4 worker/write epoch4·exact6 lease가 유효한 동안 단일 `developer-primary`에게 WorkInstruction의 비G-05 7건을 배정한다. Main은 제품 exact6 파일을 동시에 수정하지 않는다. 정식 Developer 실패0, R4 writer 변경0. 미검증: 7건 RED→GREEN, WSL 제품 동일 SHA 및 전체 suite, G-05/history 41건, 11개 메뉴 실제 기능, 브라우저 Network. 다음은 writer 시작 시 lease/HEAD/status 재검사→exact6 로컬 구현·보고→Main 리뷰·commit/push·WSL 전체 suite이다. F-20 수락·main 병합·Production 제외.

# F-20 R4 exact6 로컬 writer 완료·독립 검토 / 2026-09-28

- 판정: `F20_R4_LOCAL_SCOPED_GREEN; WSL_PRODUCT_PENDING`. 단일 `developer-primary-f20-r4`가 clean `c64d709165ad8ccf473347c36709e588a905b7b0`, canonical seq1737/epoch4 exact6 lease와 G-05를 확인한 후 결과 보고서 및 다섯 테스트 파일만 변경했다. 7개 실패 node 초기 RED는 Windows `5 failed, 2 passed`(A13 POSIX와 F18 unrelated-path는 기존 WSL RED 증거), 원인별 보완 후 다섯 파일 전체 `91 passed, 8 skipped in 206.99s`(exit0). 8 skip은 실제 DB 연결 요구 C01 테스트로 PASS가 아니다. 내부 symlink 2개인 전용 pytest 폴더와 생성 pyc 5개를 식별·정리해 잔류0, 최종 G-05 `PASS sequence=1737`·`git diff --check` exit0. 정식 Developer FAILURE_REPORT 0, 원인별 의도한 RED/fixture 조정은 보고서에 구분했다.
- Main이 exact6 diff를 검토하고 읽기 전용 독립 검토를 받았다. Critical/Important 0, Minor 2(현재 ledger raw prefix까지 불변인 듯한 C30 테스트명, F18 음성의 주입 기반 Git diff를 실제 commit처럼 읽히는 보고 표현)를 같은 writer가 exact6 안에서 보완했다. 보완 후 C30 2개+F18 파일 전체 `7 passed in 24.46s`(exit0), 임시 폴더 내부 symlink 2개 검사·삭제, G-05 seq1737 PASS·diff check exit0. 기존 PR #15 ref fetch는 승인된 회복 계획의 WSL 역사 객체 준비 조건이며 전용 WSL checkout에서 `abb7361` 객체 존재와 Git clean을 확인했다. 현재 감사 Event raw prefix 변조는 R4에서 해결/수락하지 않고 R5 과제로 유지한다.
- 변경 파일: `docs/04_test_reports/F-20_REWORK_R4_RESULT.md`와 R4 WorkInstruction의 다섯 테스트 파일, 본 상태 기록. 미검증: 변경본 commit/push·WSL 동일 SHA 집중/전체 suite, DB 8 skip, G-05/history 41건, 실제 브라우저·API·11개 메뉴. 다음은 exact6 diff와 상태 기록만 commit/push→WSL-server 동일 SHA R4 집중·전체 suite→남은 원인 분류다. F-20 수락·main 병합·Production 제외.

# F-20 R4 제품 WSL 동일 SHA·전체 suite / 2026-09-28

- 판정: `F20_R4_WSL_SCOPED_GREEN; FULL_SUITE_NON_GREEN_41`. R4 제품 commit `bd6a5439c5f744e364a3daed13533ec21e13cc22`는 로컬·지정 원격·WSL-server 전용 checkout에서 SHA 일치·clean. 기존 PR #15 ref만 fetch해 C30 frozen `abb7361` 객체가 commit임을 확인했으며 새 branch/tag는 게시하지 않았다. WSL Python3.14.3/격리 Node22.23.0에서 G-05 `PASS sequence=1737`(exit0), R4 다섯 파일 `91 passed, 8 skipped in 12.14s`(exit0). 8 skip은 실제 DB 검증 미실행이다. 전용 R4 집중 pytest 폴더의 내부 symlink 2개를 검사한 뒤 그 폴더만 삭제했고 G-05 재실행 PASS·Git clean이다.
- 같은 SHA의 전체 pytest(`--import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-pytest-bd6a543`, `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`) 결과 `8131 passed, 41 failed, 116 skipped, 14 warnings in 1469.59s`(exit1). 이전 전체 48 FAIL 중 R4 대상 7건은 제거됐고, 남은 41건은 전부 `tests/tooling/test_project_progress.py`다. C30 현 ledger raw prefix/현재 불변식 4, C21 runtime control 3, C09~C13 역사 authority·review·projection 31, E09 역사 authority 3으로 분류했다. `14c8c574`에서 과거 Event 전체 재직렬화 및 seq1689~1712 24개 Event 필드/연결 hash 변경이 있었던 사실은 회복 계획 R5에서 독립 audit incident로 다룬다. 41건을 skip하거나 PASS로 승격하지 않는다.
- 전체 suite 전용 pytest base symlink 223개는 모두 그 내부, Node cache symlink 2개도 그 내부, checkout `.venv`의 4개는 일반 Python 실행파일/상대 링크로 확인했다. 네 경로 모두 daon 소유·예상 realpath/유형이며 checkout SHA `bd6a543`·Git clean·pytest Python process 0. 로그 `22488 bytes` SHA-256 `829036a5321a1b83bfe36404307b264244c4288857e5a4fd3ee7db560dc62882`를 기록한 뒤 정확한 `/tmp/anvil-f20-r4-control-fefd180`, `/tmp/anvil-f20-pytest-bd6a543`, `/tmp/anvil-f20-node22-cache-bd6a543`, `/tmp/anvil-f20-full-bd6a543.log`만 삭제해 `F20_BD6A543_WSL_RESIDUE_ZERO`를 확인했다. 임시 로그·venv는 복구되지 않으며 검증 결과와 Git commit은 보존된다. 정식 Developer 실패0, R4 변경의 WSL 집중 실패0, 전체 suite 실패41. 미충족: 진행상태/역사 테스트 41 FAIL. 미검증: 실제 DB/브라우저/API/Provider·11개 메뉴; F-20 수락·main 병합·Production은 미실행. 다음은 R4 결과보고서에 WSL 증거·cleanup 반영→R4 lease 회수와 R5 범위 설계·역사 증거 복구 판단이다.

# F-20 R5 실패군 분리·R5a 범위 준비 / 2026-09-28

- 판정: `F20_R5A_PLANNED_NOT_ISSUED; R4_LEASE_ACTIVE`. R4 결과·cleanup 문서 checkpoint `363eb74d045036284041552632a3d9b655ab6142`를 지정 원격에 push하고 SHA 일치·clean·G-05 seq1737 PASS를 확인했다. 전체 suite 실패 41개 node ID를 로그에서 확인했고 모두 `tests/tooling/test_project_progress.py`: 현재 4, C21 3, C09~C13 31, E09 3. 이 중 현재 세 node를 로컬에서 정확히 재실행하여 `3 failed in 8.01s`(exit1): 레거시 `validate_detached_progress_binding`이 현재 F-20 digest 형식에 `DETACHED_DIGEST_MISMATCH`, 과거 handoff에 있던 `valid_failure_count` 필드가 현 R4 summary에는 없어 KeyError, Event all-category fixture가 `WORK_INSTRUCTION_ISSUED`·`PHASE_GATE_COMPLETED`·`PACKAGE_REVIEWED` 세 타입을 누락한다. `--basetemp=.pytest_tmp_f20_r5_diagnose`는 테스트에서 실제 생성되지 않아 삭제 대상도 없다. 코드 변경0, 정식 Developer 실패0, 의도한 원인 재현 RED 3.
- C30 한 건은 `14c8c574`의 과거 원장 재직렬화/24개 Event 수정으로 인한 현재 raw-prefix 불일치이며 R5a 테스트 수정으로 PASS 처리하지 않는다. 남은 역사군은 당시 authority blob과 현재 successor를 분리해야 하나 아직 정확한 writer scope가 정해지지 않았다. 회복 계획에 R5a exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5A_RESULT.md`)와 감사 사고·역사군 후속 경계를 추가했다. 다음은 R4 write→worker lease 회수, R5a 통제 WorkInstruction·epoch5 exact2 발급 및 G-05 검증, 단일 writer의 RED→GREEN이다. F-20 수락·main 병합·Production 제외.

# F-20 R5a 통제·lease 인계 / 2026-09-28

- 판정: `F20_R5A_LEASE_ACTIVE; EXACT2_WRITER_IN_PROGRESS`. 동일 `codex/f18-wsl-ops`에서 R5a WorkInstruction·invocation·append-only overlay·G-05 router·통제 테스트를 준비했다. 첫 통제 테스트 RED는 오버레이 누락, 이후 2 FAIL은 헤더를 포함한 잘못된 prefix 기대와 R5a 미등록 router로 원인을 분리해 보완했다. R4+R5a 통제 회귀 `14 passed in 180.34s`(exit0), 개별 R5a 정상·변조 3건 `3 passed in 46.11s`(exit0), `git diff --check` 및 G-05 seq1737 PASS. 임시 pytest 폴더 네 곳의 내부 reparse link만 먼저 제거하고 정확한 폴더를 삭제해 잔류0.
- 통제 준비 commit `3b7f8391f3392f9a862c1be9c01da47cb277b550`을 지정 `development` 원격의 기존 branch에 push하고 로컬 HEAD·원격 추적 SHA 일치 및 clean을 확인했다. 그 SHA에서 R4 write→worker lease를 순서대로 회수하고 Event seq1738~1743에 R5a WI, epoch5 worker/write exact2 lease, 미수락 resume을 append-only 투영했다. 로컬 G-05 `PASS sequence=1743 reporting=AUTO_CONTINUE`(exit0). 현재 writer는 `developer-primary-f20-r5a`, 유효 쓰기 범위는 결과 보고서와 `tests/tooling/test_project_progress.py` 두 경로뿐이며 Main은 그 파일을 동시에 수정하지 않는다. 정식 Developer 실패0.
- 변경 통제 파일: R5a WI·invocation·overlay·테스트, 기존 R4 overlay/G-05 router, seq1743 Event/progress/handoff/digest/manifest와 이 기록. 미검증: seq1743 정본 commit/push·WSL 동일 SHA, exact2 제품 변경, 전체 suite 38+ 잔여 실패, DB/브라우저/API/Provider·11개 메뉴. 다음은 exact2 writer의 세 RED→GREEN·보고를 받은 뒤 독립 검토→commit/push→WSL-server 동일 SHA 검증이다. F-20 수락·main 병합·ysna-server/Production 제외.

# F-20 R5a 정본 WSL-server 통제 검증 / 2026-09-28

- 판정: `F20_R5A_CONTROL_WSL_GREEN; PRODUCT_EXACT2_PENDING`. seq1743 정본 commit `b0a22312dbf7dd95046a5d5337f555f086d26fe3`을 지정 원격에 push하고 로컬·원격·WSL-server 전용 checkout의 정확한 SHA 일치를 확인했다. WSL-server `/tmp/anvil-f20-r5a-control-b0a2231`에서 격리 `uv sync --frozen --group dev` exit0, G-05 `PASS sequence=1743`(exit0), R4/R5a 통제 `14 passed in 29.56s`(exit0), Git clean을 확인했다. 전용 pytest base의 내부 symlink 11개가 모두 전용 폴더 내부를 가리킴을 확인하고 `/tmp/anvil-f20-r5a-pytest-b0a2231`만 삭제해 잔류0. 전용 checkout은 다음 exact2 제품 SHA pull·검증에 재사용한다. 공유 DB/Docker·Production 변경0.
- 정확한 현재 writer는 `developer-primary-f20-r5a`; dispatch baseline `3b7f8391f3392f9a862c1be9c01da47cb277b550`과 현재 후속 정본 HEAD `b0a22312`의 차이는 Main의 seq1743 control commit이다. lease의 baseline을 임의 갱신하지 않으며, G-05가 ancestry와 범위를 검사한다. 정식 Developer 실패0, 미검증: exact2 제품 RED→GREEN·독립 리뷰·WSL 제품/전체 suite, 잔여 38+, 실제 기능. 다음은 writer 결과 수집 후 같은 브랜치의 exact2만 검토·push·WSL 동일 SHA 재검증이다.

# F-20 R5a exact2 로컬·통제 독립 검토 보완 / 2026-09-28

- 판정: `F20_R5A_TARGET3_LOCAL_GREEN; CONTROL_IMPORTANT_1_FIXED_LOCAL; ACCEPTANCE_PENDING`. 단일 writer는 exact2 두 파일만 변경해 지정 현재 진행상태 3 node를 `3 passed in 34.07s`(exit0)로 보완했다. 파일 전체 `-x` 첫 실패는 `C30CanonicalReconciliationTests.test_no_early_acceptance_or_lease_revoke`의 seq1334 raw Event prefix mismatch로 `1 failed, 8 passed in 71.21s`(exit1). 전체 파일/프로젝트 suite는 완주하지 않았고 새 SHA 잔여 실패 수는 미확정이다. 기존 C30 audit incident를 R5a에서 숨기거나 PASS 처리하지 않는다.
- 독립 read-only 리뷰 Important 1: 디스크 progress가 digest에 맞더라도 in-memory `bundle.progress.repository.commit_status`를 변경하고 snapshot hash를 재계산하면 `validate_bundle=[]`이었다. Main control 음성 테스트 `1 failed`(의도한 RED, exit1) 후 `scripts/f20_rework_r5a_overlay.py`가 disk JSON과 bundle progress 동등성을 확인하도록 보완하여 같은 테스트 `1 passed`(exit0). 앞서 in-memory detached digest 위조도 RED `1 failed`→수정 후 GREEN `1 passed`였고, R5a 통제 전체 `3 passed in 43.34s`(수정 전 부분), 수정 후 현재 G-05 `PASS sequence=1743`(exit0). 전용 임시 pytest 폴더 모두 내부 링크 확인 후 해당 정확한 폴더만 삭제해 잔류0. 정식 Developer 실패0, control 검토 Important 1 및 writer 발견 digest 결함 1 모두 로컬 보완.
- 절차 확인: writer가 대형 권위 문서의 F-20 관련 절·hash만 읽고 전체 EOF 독서 조건을 먼저 충족하지 못했다고 자진 보고했다. 추가 제품 수정 없이 전 문서 EOF/기준 hash·상충 지시를 재대조하고 세 node·G-05를 다시 실행하도록 지시했다. Main의 최종 수락은 그 재확인 및 독립 control 회귀 후 판정한다. 변경은 exact2 제품 + Main control 테스트/overlay와 이 기록이다. 미검증: 재확인, commit/push·WSL 동일 SHA, 전체 suite, DB/API/브라우저·11개 메뉴. 다음은 절차 재확인·로컬 통제 회귀→diff 검토→동일 브랜치 push→WSL-server 동일 SHA 검증이다.

# F-20 R5a 로컬 독립 재검증·임시 경로 영향 분리 / 2026-09-28

- 판정: `F20_R5A_LOCAL_SCOPED_GREEN; FULL_SUITE_NON_GREEN_UNRESOLVED`. writer가 지정 권위 문서 전 파일을 EOF/UTF-8/hash까지 재확인하고 F-20 계약·현재 seq1743·epoch5 exact2 및 승인 artifact와 대조한 결과 상충을 찾지 못했다. 대형 문서 모든 문장에 대한 개별 의미 해석까지 주장하지 않는다고 명시했으며 추가 제품 수정 없이 3 node `3 passed in 31.49s`(exit0), G-05 seq1743 PASS를 다시 확인했다.
- Main의 독립 묶음 재실행은 R4/R5a control 14건 + 대상 3건 중 `1 failed, 16 passed in 226.95s`(exit1). 실패 1건은 test의 정상 `validate_bundle` 단계에서 같은 checkout 안의 Main pytest clone basetemp가 untracked가 되어 `F20_R5A_GIT_INVALID`로 거부된 검증 환경 오염이다. 전용 basetemp 내부 symlink 11개를 확인하고 해당 폴더만 삭제해 잔류0. 이후 대상 3 node를 독립 재실행해 `3 passed in 37.14s`(exit0). 통제 14건은 위 묶음 실행에서 모두 PASS이고, FAIL을 숨기지 않고 원인·재검증으로 분리했다. 현재 G-05 seq1743 PASS, `git diff --check` PASS. 정식 Developer 실패0; 독립 검토 Important 1은 Main control RED→GREEN 완료.
- 변경 제품 exact2와 Main control/status 총 5파일만 commit/push 예정. 미검증: 새 SHA WSL-server 동일 SHA 대상·전체 suite, 남은 C30/C21/C09~13/E09 역사 검증, 실제 DB/API/브라우저·11개 메뉴·Provider. 다음은 정확한 diff/검사 후 push→WSL 동일 SHA 재검증이다. F-20 수락·main 병합·ysna-server/Production 제외.

# F-20 R5a 제품 WSL-server 동일 SHA·전체 suite / 2026-09-28

- 판정: `F20_R5A_WSL_SCOPED_GREEN; FULL_SUITE_NON_GREEN_38`. R5a 제품·Main control commit `aefcc56b06d1182c110411b1bde69fd0c83fdc2a`를 지정 원격에 push하고 로컬·원격 추적·WSL-server 전용 checkout의 SHA 일치 및 Git clean을 확인했다. WSL-server 격리 Python3.14.3/Node22.23.0에서 G-05 `PASS sequence=1743`(exit0), R4/R5a 통제 14건 + R5a 현재 대상 3건 `17 passed in 29.92s`(exit0). 집중 pytest 전용 symlink 11개를 확인·정리했고, 기존 PR #15 ref만 fetch하여 C30 frozen `abb7361` 객체가 commit임을 확인했다. 새 원격 branch/tag·공유 DB/Docker·Production 변경0.
- 같은 SHA 전체 pytest(`ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`, `--import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-pytest-aefcc56`, 격리 Node22 PATH) 결과 `8137 passed, 38 failed, 116 skipped, 14 warnings in 793.60s`(exit1). 이전 41 FAIL 중 R5a 대상 3건 제거, 새 FAIL 0; 38건 전부 `tests/tooling/test_project_progress.py`: C30 원장 raw-prefix 1, C21 runtime control 3, C09~C13 역사 authority/review/projection 31, E09 역사 3. 대표 오류는 `C21_RUNTIME_CONTROL_V2_PARENT_INVALID`, `C09_START_AUTHORITY_HASH_INVALID`, `C09_MAIN_TAKEOVER_REVIEW_RAW_INVALID`, `E09_AUTHORITY_INVALID`/`E09_FINAL_FROZEN_DRIFT`이며 상세 node 목록은 실행 출력에 있다. 116 skip은 PASS 아님. F-20 전체 수락·P-01·main 병합 불가.
- 전체 로그 `21,646 bytes`, SHA-256 `120dd70e206829338cd4b625bd5cc4ee65b67f98d8778b1ec973a84021d756ac`와 정확한 집계를 확인했다. 전체 pytest base symlink 226개와 Node cache symlink 2개는 모두 각 전용 경로 내부, checkout `.venv` 표준 Python 링크 4개만 외부/상대 링크였으며 checkout clean·pytest 프로세스 0. 정확한 `/tmp/anvil-f20-r5a-control-b0a2231`, `/tmp/anvil-f20-pytest-aefcc56`, `/tmp/anvil-f20-r5a-node22-cache-aefcc56`, `/tmp/anvil-f20-full-aefcc56.log`만 제거해 `F20_AEFCC56_WSL_RESIDUE_ZERO` 확인. 임시 로그/venv는 복구되지 않고 SHA·집계·Git 변경은 보존된다. 정식 Developer 실패0, R5a 대상 WSL 실패0, 전체 suite 실패38. 미검증: DB/API/브라우저·11개 메뉴, PG15/PG18RC·backup/restore·rollback. 다음은 R5a epoch5 lease 회수와 C30 감사 사고/역사군의 read-only 증거 분리→후속 exact-path 작업지시다. ysna-server/Production 제외.

# F-20 R5 잔여 38건 1차 원인 분리 / 2026-09-28

- 판정: `C21_3_ENVIRONMENT_OBJECT_RECOVERABLE; C30_AUDIT_OPEN; HISTORICAL_AUTHORITY_DRIFT_OPEN`. C21 세 node는 로컬 `3 passed in 3.18s`인데 WSL 전체 suite의 단일 branch clone에서는 `C21_RUNTIME_CONTROL_V2_PARENT_INVALID`였다. 기존 원격 candidate ref는 `ls-remote`에서 없었지만 과거 정확한 `fb311d456fe3cbb2e8439f39017356ddec6cf266` 객체를 SHA로 직접 fetch할 수 있음을 WSL bare 임시 repo에서 확인했다(부모 `f0d4bc7...`). 전용 후속 status-only SHA `f8fa29746a569e40362c0f90477c9e43d112027d` checkout에서 새 branch/tag 없이 그 객체만 fetch한 후 C21 세 node `3 passed in 2.53s`(exit0), G-05 seq1743 PASS, Git clean. 임시 probe repo/error 파일과 checkout은 각 정확한 경로만 삭제해 잔류0. 따라서 이 세 실패는 테스트 코드 변경 없이 WSL 역사 객체 준비로 해소 가능하나, 전체 suite는 해당 준비 조건으로 재실행하지 않았으므로 35 FAIL로 공식 집계하지 않는다.
- C09 시작·Main takeover·E09 시작 대표 세 node는 로컬에서도 `3 failed in 23.54s`(exit1). C09 시작에서 현재 설계·계획·매트릭스·테스트계획·운영규칙 SHA가 승인된 최신값이지만, 검사기가 요구하는 역사 SHA는 `C09_START_BASE=08aae12`의 Git blob과 일치한다. 즉 현재 권위 문서를 당시 freeze hash에 직접 대입한 오류다. Main takeover는 `C09_MAIN_TAKEOVER_REVIEW_RAW_INVALID`, E09는 `E09_AUTHORITY_INVALID`가 선행한다. 당시 원본 hash/승인 문서를 재작성하지 말고 각 역사 commit/tree와 현재 후속 문서를 명시적으로 구분해야 한다. C30은 `test_no_early_acceptance_or_lease_revoke`가 현재 raw Event seq1~1334와 당시 생성 raw prefix의 실제 불일치를 검출했으므로 감사 사고로 계속 열어 둔다.
- 다음은 C30 무결성 복구 경계를 read-only로 설계하고, C09~C13/E09 역사군을 당시 Git tree·현재 문서 경계별로 더 분할해 exact-path lease를 순차 발행한다. F-20 전체 수락, main 병합, 새 branch, ysna-server/Production은 하지 않는다. 정식 Developer 실패0, 추가 코드 변경0.

# F-20 R5b C09 역사 권위 10건 통제 준비 / 2026-09-28

- 판정: `R5B_CONTROL_LOCAL_GREEN; PRODUCT_EXACT2_NOT_STARTED; F20_NON_GREEN`. Main이 C09 시작5·R3 3·R4 2를 exact2 제품 경계로 분리하고 WorkInstruction/Invocation, append-only epoch6 revocation→grant overlay, G-05 route와 음성 projection 테스트를 준비했다. 제품 파일은 아직 수정하지 않았고 R5a seq1743·epoch5 lease가 현재 유효하다.
- 독립 read-only 통제 검토 Important 1: 발급 후 R5a 선행 WI/Invocation/digest/manifest와 상속된 progress 필드 변조를 놓칠 수 있었다. 선행 WI 변조 음성 테스트가 의도대로 `1 failed`(exit1)인 것을 확인한 뒤 dispatch Git blob byte 대조와 상속 필드 보존 검사를 추가했다. R5b 통제 `4 passed in 64.83s`(exit0), R5a 회귀 `3 passed in 49.67s`(exit0), 현재 G-05 seq1743 PASS(exit0). 통제 검토 Critical 0, Important 1은 이 수정으로 해소했으며 제품 writer 정식 실패0. 로컬 테스트 clone 임시 경로는 정확한 범위 확인 후 제거 중이며 잔류 여부를 commit 전 확인한다.
- 변경 후보: `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, R5b WI/Invocation, `scripts/check_project_progress.py`, R5a/R5b overlay, R5b projection test 및 이 현황. 미검증: R5b 제품 10건 RED→GREEN, 새 SHA WSL-server 동일 SHA, full suite, C30 감사 사고와 잔여 역사군, 실제 DB/API/브라우저. 다음은 임시 경로 잔류0·diff/G-05 확인→같은 branch control 기준 SHA commit/push→R5b lease 발급→단일 writer 제품 수정이다. 신규 branch·main 병합·ysna-server/Production 없음.

# F-20 R5b lease 발급·WSL-server 통제 검증 / 2026-09-28

- 판정: `R5B_LEASE_ACTIVE; CONTROL_WSL_GREEN; PRODUCT_IN_PROGRESS`. 통제 준비 `d8a7e2dd4ce2a144c53607242b326a9afd16c468`를 기존 branch에 push하고 원격 SHA 일치·local G-05 seq1743 PASS를 확인했다. R5a epoch5 write→worker 회수, R5b epoch6 exact2 발급 Event seq1744~1749를 append-only 기록하고 G-05 seq1749 PASS 후 `bbc2190466d1566016da009fe3f8092aa8677588`를 commit/push했다. 단일 writer `developer-primary-f20-r5b`에게 제품 정확한 두 경로만 배정했다. writer 정식 실패0, Main 통제 사전 음성 RED 1건은 수정 후 GREEN.
- WSL-server 전용 `/tmp/anvil-f20-r5b-control-bbc2190` clone은 처음 `origin`만 있어 checker가 요구한 `development/codex/f18-wsl-ops` ref 부재로 G-05 `F20_R5B_GIT_INVALID`(exit1)였다. 지정 development SSH alias의 같은 정확한 SHA를 fetch·upstream 설정한 뒤 G-05 `PASS sequence=1749`(exit0), R5a/R5b projection `7 passed in 25.24s`(exit0), SHA 일치. 이는 검증 checkout 설정 오류1회이며 제품/통제 결함으로 분류하지 않는다. 임시 checkout은 제품 exact SHA 후속 WSL 검증에 재사용 예정이고 전용 pytest base는 경로·link 확인 후 정리한다. 공유 DB/Docker·ysna-server/Production 변경0. 미검증: 제품 10건, 새 제품 SHA WSL, full suite·C30/잔여 역사군·DB/API/브라우저. 다음은 writer 결과 검토→동일 branch commit/push→WSL 동일 SHA 검증·임시 리소스 정리다.

# F-20 R5b 제품 로컬 RED→GREEN·독립 리뷰 / 2026-09-28

- 판정: `R5B_C09_LOCAL_SCOPED_GREEN; F20_FULL_NON_GREEN`. 단일 writer가 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5B_RESULT.md`)만 변경했다. C09 시작5/R3 3/R4 2는 수정 전 `10 failed, 8 passed, 663 deselected in 73.60s`(exit1), 당시 governance Git blob을 기존 in-memory fixture에 포함하고 누락·위조 음성 1건을 추가한 후 `19 passed, 663 deselected in 73.58s`(exit0). Main 독립 동일 범위는 `19 passed, 663 deselected in 76.63s`(exit0), G-05 seq1749 PASS, diff check PASS. 로컬 Main pytest base는 후속 확인 시 이미 ABSENT였고 `Test-Path=False`; 삭제한 것으로 과장하지 않는다. WSL 전용 pytest base는 링크7개 모두 내부 확인 후 정확한 경로만 제거해 잔류0.
- 독립 읽기 전용 제품 리뷰 Critical 0/Important 0. C09 Start/R3/R4 기준 commit의 governance Git blob 동일성, 현재 문서·역사 SHA 상수·Event 미수정, exact2 범위, 결과보고서의 미검증 구분을 확인했다. writer 정식 실패0. 변경 파일 전체 로컬 실행은 기존 C30 raw Event 실패 1건 출력 후 장시간 실행을 중단하여 완료 집계가 아니다. 미검증: 새 제품 SHA WSL-server focused/full suite, C30 감사 사고, C21·C09 나머지·C10~13/E09, 실제 DB/API/브라우저. 다음은 정확한 diff/G-05 확인→동일 branch commit/push→WSL-server pull한 SHA의 focused/full 검증. F-20 수락·main 병합·ysna-server/Production은 금지 유지.

# F-20 R5b 제품 WSL-server 전체 suite와 현재 모드 회귀 / 2026-09-28

- 판정: `R5B_C09_WSL_SCOPED_GREEN; FULL_SUITE_NON_GREEN_11; CURRENT_DIGEST_TEST_REWORK`. 제품 commit `8ba8d8ac4708550b8d75f04ca71cdcb52c79ba47`을 기존 branch에 push하고 WSL-server 전용 checkout에서 pull해 exact SHA/Git clean, G-05 seq1749 PASS, C09 19 + R5a/R5b control 7 = `26 passed, 663 deselected in 40.51s`(exit0)를 확인했다. C21 이전 객체 `fb311d456fe3cbb2e8439f39017356ddec6cf266`는 SHA만 fetch하고 C30 역사 PR #15는 FETCH_HEAD만 fetch했으며 새 branch/tag 없음. 격리 Node22.23.3와 `/var/lib/postgresql/data` 테스트 환경변수를 사용했고 공유 DB/Docker·Production 변경0.
- 같은 SHA WSL-server 전체 pytest exit1: `8169 passed, 11 failed, 116 skipped, 14 warnings in 803.37s`. 로그 34,155 bytes SHA-256 `0be1fa869403f62cc1d59f9ce572d93413eaea16afbc6ae9a8ff587d57d6c8f0`. 실패는 C30 원장 raw-prefix 1, 현재 `ProjectProgressContractTests.test_detached_digest_binds_current_progress_and_handoff_into_manifest_target` 1, C09 Main takeover/final 6, E09 시작/final 3이다. 이전 SHA 38 FAIL과 달리 C21 3은 준비된 역사 객체로 통과했고 C10~C13 역사군도 이번 전용 clone·역사 객체 준비에서 실패하지 않았다. 단, 이 차이를 R5b 제품 수정 효과만으로 주장하지 않는다. 새 현재 digest 테스트는 R5a mode와 `F20_R5A_*` 오류 코드를 고정 기대한 채 R5b seq1749에서 실패했으므로 active epoch6 exact2 writer에게 동일 경로 후속 보완을 지시했다. 정식 Developer 실패0, 새 회귀 1건 보완 중. 전체 suite PASS·F-20 수락 불가.
- WSL 전용 checkout `/tmp/anvil-f20-r5b-control-bbc2190`은 후속 exact SHA 검증용으로 유지 중이며 full pytest base, Node22 cache, 로그도 정확한 결과 기록·후속 검증 뒤 링크·경로 확인 후 제거한다. 미검증: 후속 제품 SHA 전체 suite, C30 감사 복구, C09 takeover/final, E09, DB/API/브라우저·11개 메뉴. 다음은 current digest RED→GREEN→동일 branch commit/push→WSL 동일 SHA focused/full 재검증→임시 자원 정리다. ysna-server/Production·main 병합 없음.

# F-20 R5b 현재 digest 회귀 로컬 보완 / 2026-09-28

- 판정: `R5B_CURRENT_DIGEST_LOCAL_GREEN; WSL_RERUN_PENDING`. 동일 active epoch6 exact2 writer가 현재 `test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`의 R5a mode·진행/digest/manifest 오류 기대 4곳을 R5b로 갱신했다. 승인 원장·checksum·실제 검증 로직은 변경하지 않고 현재 R5b의 정상 bundle 수락 및 in-memory progress/handoff/digest/manifest 위조 거부를 검증한다. writer RED `1 failed`(exit1)→GREEN `1 passed in 7.50s`(exit0), Main 독립 `1 passed in 7.38s`(exit0), G-05 seq1749 PASS, diff check PASS. writer의 통제 회귀 R5a 3+R5b 4 PASS. 한 묶음의 후행 현재 node는 선행 테스트의 미추적 pytest base 때문에 `F20_R5B_GIT_INVALID`였고 내부 symlink7개 확인·정확한 경로 정리 뒤 단독 GREEN 재검증했으므로 코드 실패로 집계하지 않는다. Main 전용 Windows temp도 테스트 종료 시 이미 ABSENT였으므로 삭제를 주장하지 않는다. 정식 Developer 실패0.
- 첫 WSL full pytest base 230 links, focused base 7 links 모두 해당 전용 경로 내부임을 확인하고 두 정확한 폴더만 제거해 잔류0. Node22 cache, 첫 결과 로그, clean checkout은 후속 SHA 검증 후 정리 예정이다. 추가 read-only 독립 리뷰 요청 중. 미검증: 새 SHA WSL focused/full, 나머지 10 FAIL의 복구, DB/API/브라우저. 다음은 diff/G-05·리뷰 확인→기존 branch commit/push→WSL-server pull·full 재검증이다. F-20 수락·main 병합·ysna-server/Production 없음.

# F-20 R5b 최종 동일 SHA WSL-server 재검증 / 2026-09-28

- 판정: `R5B_SCOPED_ACCEPTED; F20_FULL_SUITE_NON_GREEN_10`. 후속 exact2 commit `9af4923156f23fa3c7344b4a823a76989e890478`을 기존 branch에 push하고 WSL-server 전용 checkout에서 pull했다. G-05 seq1749 PASS, current detached digest 1 + R5a/R5b control 7 = `8 passed in 16.64s`(exit0). 로컬 독립 current node `1 passed in 7.38s`; 후속 read-only 리뷰 Critical 0/Important 0이며 R5a 역사 route와 현 R5b fail-closed 유지 확인. C09 19건은 직전 `8ba8d8a` SHA의 WSL `26 passed`에 포함돼 확인됐고 후속 SHA는 그 테스트 코드 변경 없이 current digest 기대 4곳만 변경했다.
- 새 SHA WSL 전체 pytest exit1: `8170 passed, 10 failed, 116 skipped, 14 warnings in 754.82s`. 로그 32,816 bytes SHA-256 `ee89548cd91825df02c7f130712aec47142a5e33de34e23e155e626d73c5e23f`. 이전 11 실패에서 current digest 1건이 제거되고 신규 실패0. 잔여 정확히 C30 canonical raw Event 감사 1, C09 Main takeover 4 + final acceptance 2, E09 start 1 + final 2. 이들은 R5b 범위 밖이며 PASS/skip으로 숨기지 않았다. 이 결과는 full suite PASS나 F-20 전체 수락이 아니다. C21 과거 commit과 PR #15 Git 객체는 새 ref 없이 fetch한 WSL 전용 checkout에서 테스트했고, 공유 DB/Docker·ysna-server/Production 변경0.
- R5b writer는 최종 SHA/집계를 exact2 결과보고서에 반영 중, 정식 실패0. Main은 다음 exact-path lease 전 R5b write→worker lease를 append-only 회수해야 한다. WSL 임시 checkout·Node22 cache·두 full 로그·후속 pytest base는 결과 기록 뒤 정확한 경로와 링크를 확인해 정리한다. 미검증: C30 감사 사고의 안전한 복구 경계, C09 takeover/final, E09, PG15/PG18RC·실제 DB/API/브라우저·11개 메뉴·Provider/backup/restore. 다음은 자원정리와 R5b 기록 commit/push→잔여 10건의 독립 read-only 분류→차기 exact-path WI/lease를 순차 발행한다. 새 branch·main 병합·Production 없음.

- R5b 결과보고서에 최종 SHA·전체 suite 집계·로그 해시·남은 10 node를 단일 writer가 동일 exact2 scope로 반영했고 G-05 seq1749 PASS, diff check PASS, 정식 실패0. WSL clean checkout의 SHA, 두 로그 SHA, pytest 프로세스0과 임시 폴더의 정확한 경로를 재확인한 뒤 R5b 전용 checkout 1, pytest base 2, Node22 cache 1, 로그 2만 제거해 `F20_R5B_WSL_RESIDUE_ZERO` 확인했다. checkout `.venv`의 외부 Python 링크 3개는 uv 공유 runtime을 가리키는 symlink일 뿐이며 공유 runtime 자체는 제거하지 않았다. 두 로그 원문은 정리 후 복구되지 않고 위 크기·SHA·집계만 Git에 보존된다. 다음 R5c 범위 확정 전 이 branch의 R5b 기록을 commit/push한다.

# F-20 R5c C09 Main takeover·final 역사 검토 분리 준비 / 2026-09-28

- 판정: `R5C_CONTROL_LOCAL_GREEN; PRODUCT_NOT_STARTED; F20_FULL_NON_GREEN_10`. R5b 최종 기록 commit `9c41643420e8d833660781a2571cd67a750eaa02`를 동일 branch에 push한 뒤 C09 takeover 대표와 final 대표 RED를 로컬 재현했다. 각각 `C09_MAIN_TAKEOVER_REVIEW_RAW_INVALID`(1 failed in 8.81s), `C09_FINAL_SEQ824_CONTROL_MUTATED`(1 failed in 6.23s). 당시 quality review는 `10bbb87` Git blob 18,269 bytes/SHA `E109EB0D...`, 현재 파일은 18,268 bytes/SHA `FBB9CD91...`로 마지막 LF 1 byte 차이. final의 immutable set 9경로를 exact Git byte 대조했을 때 불일치 1경로도 동일 quality review다. 현재 파일·frozen hash·원장 Event는 수정하지 않았다. 두 로컬 진단 pytest base는 후속 확인 시 ABSENT였다.
- Main이 계획 R5c 절, exact2 WI/Invocation, R5b revoke→R5c epoch7 grant seq1750~1755 통제, checker route와 fail-closed projection 음성 테스트를 준비했다. R5c 통제 `4 passed in 59.34s`(exit0), 현재 G-05 seq1749 PASS, diff check PASS. 통제 pytest 임시 clone 경로는 정확한 범위·link 확인 뒤 제거해 잔류0. 독립 read-only 통제 리뷰 진행 중. R5b epoch6 lease는 여전히 ACTIVE이며 제품 파일은 R5c로 수정하지 않았다. 미검증: 독립 control 리뷰, R5c 발급/WSL 동일 SHA, 제품 C09 6건, C30/E09 4건, DB/API/브라우저. 다음은 리뷰·control 기준 commit/push→R5b lease 회수/R5c exact2 발급→단일 writer 제품 재작업이다. 새 branch·main 병합·Production 없음.

- 독립 read-only 통제 리뷰 Important 3: R5c 및 활성 R5b의 재해시 current status/repository 필드 위조, R5c 발급 후 R5a 보존 artifact와 활성 WI/Invocation의 dispatch Git byte 미결박, CRLF Event preflight 정규화 위험. 앞의 첫 위조는 R5b/R5c 각각 음성 테스트 `1 failed`(의도 RED, exit1)로 실제 재현했다. 두 overlay에 정확한 status·head·commit/push·instruction 필드와 Git blob 원문 결박, 선행 R5a/R5b artifact 보존, CRLF 원장 exact-byte 거부를 추가했다. R5c fixture는 WI/Invocation을 임시 Git commit으로 만든 dispatch SHA에 결박해 자기일관성만으로 합격하지 않도록 했다. 두 통제 projection 묶음 `10 passed in 159.80s`(exit0), G-05 현재 seq1749 PASS, py_compile/diff check PASS. RED와 묶음 pytest clone 3경로는 정확한 경계 확인 후 제거해 잔류0. 독립 재검토 진행 중이며 제품 writer는 아직 발급하지 않았다. 이는 Main control 실패1군·보강이지 정식 Developer FAILURE_REPORT가 아니며 Developer 실패0 유지.
- 독립 read-only 재검토에서 위 Important 3 모두 해소, 새 Critical/Important 0으로 판정했다. Reviewer는 별도 테스트·파일 수정 없이 diff와 Main의 실제 10 PASS/G-05 증거를 확인했다. R5b epoch6 ACTIVE 유지, R5c 제품 발급 전 동일 branch 통제 준비 commit/push와 exact SHA 확인을 다음 조치로 둔다.

# F-20 R5c lease 발급·WSL-server 통제 검증 / 2026-09-28

- 판정: `R5C_LEASE_ACTIVE; CONTROL_WSL_GREEN; PRODUCT_EXACT2_IN_PROGRESS`. R5c 통제 기준 `7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d`를 기존 branch에 push하고 로컬·원격 SHA 일치, clean, G-05 seq1749 PASS를 확인했다. R5b epoch6 write→worker lease를 append-only 회수하고 R5c epoch7 exact2 발급 Event seq1750~1755를 기록, G-05 seq1755 PASS 후 lease commit `3b2c1de7b14411fc626862c4ab3697a039ded8e1`을 push했다. 단일 writer `developer-primary-f20-r5c`에 제품 두 경로만 배정했다. 정식 Developer 실패0.
- WSL-server 전용 `/tmp/anvil-f20-r5c-control-3b2c1de` checkout에서 지정 development SSH alias를 fetch해 upstream/exact SHA/Git clean을 확인했고 격리 `uv sync --frozen --group dev` exit0, G-05 `PASS sequence=1755`(exit0), R5b/R5c 통제 `10 passed in 31.82s`(exit0). 전용 pytest base 내부 link10개 모두 자기 경로 내부 확인 후 그 폴더만 삭제해 잔류0. checkout은 제품 exact SHA pull 검증에 재사용한다. 공유 DB/Docker·ysna-server/Production 변경0. 미검증: R5c 제품 6건, 새 제품 SHA WSL 전체 suite, C30/E09 4건, DB/API/브라우저. 다음은 writer 결과 독립 검토→commit/push→WSL 동일 SHA focused/full 검증과 checkout 정리다.

# F-20 R5c C09 제품 로컬 RED→GREEN·독립 검토 / 2026-09-28

- 판정: `R5C_C09_LOCAL_SCOPED_GREEN; F20_FULL_NON_GREEN`. epoch7 단일 writer가 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5C_RESULT.md`)만 변경했다. C09 Main takeover 4·final 2는 수정 전 `6 failed, 5 passed, 671 deselected in 30.25s`(exit1), 역사 quality review Git blob을 frozen 크기·SHA 검증 후 fixture에만 overlay하고 누락·위조 음성 2건을 더해 `13 passed, 671 deselected in 39.34s`(exit0)로 전환했다. 현재 review 파일·검증기·상수·Event 원장은 수정하지 않았다.
- writer G-05 seq1755 PASS, diff check PASS, Main 독립 G-05 seq1755 PASS(exit0). 로컬 변경 파일 전체 pytest는 약 10%에서 기존 C30 raw Event 실패 마커 1건을 관측한 후 중단(exit1)하여 최종 집계·PASS로 표시하지 않는다. 네 전용 pytest basetemp는 모두 ABSENT이며 정식 Developer 실패0. read-only 독립 제품 검토 Critical 0/Important 0; 별도 리뷰 테스트는 수행하지 않았고 실제 테스트 결과는 writer의 집중 실행 증거다.
- 미검증: 제품 commit SHA의 WSL-server focused/full suite, C30·E09 잔여 4건, 실제 DB/API/브라우저·PG15/PG18RC·11개 메뉴. 다음은 exact2 diff·G-05·Git 상태를 최종 확인하고 같은 branch에 commit/push한 뒤 WSL-server가 그 SHA를 pull해 집중·전체 검증한다. F-20 수락·main 병합·신규 branch·ysna-server/Production은 하지 않는다.

# F-20 R5c WSL-server 역사 객체 이관 및 임시 clone 보완 / 2026-09-28

- 판정: `R5C_WSL_FIRST_SHA_NON_GREEN_ENVIRONMENT_OBJECT; PORTABILITY_REWORK_LOCAL_GREEN`. 제품 SHA `e05f9c2e7986e459f1fed3d3b87ba210db62441d`를 기존 branch의 지정 원격에 push하고 WSL-server 전용 checkout에서 fast-forward해 SHA/Git clean을 확인했다. G-05 seq1755 PASS였으나 C09 13건은 첫 실행에서 `10bbb87` 역사 객체 부재로 모두 setUp 실패(exit1). 정확한 객체 하나를 fetch해 frozen review 18,269 bytes를 확인한 후 `11 passed, 2 failed`(exit1): 8f5 역사 객체 부재 1, 임시 fresh clone에 unattached 85d 객체 미전달 1. 기존 PR #15 ref를 FETCH_HEAD만으로 fetch하니 8f5·85d 객체가 생겼고 전자 단일 node `1 passed in 0.38s`(exit0). 새 branch/tag·공유 DB/Docker·Production 변경0.
- active epoch7 exact2 writer가 `git clone --no-local` fixture 후 정확한 85d 객체를 source에서 임시 clone으로 `git fetch --no-tags` 하도록 보완했다. source 객체 부재는 실패로 닫히고 검증기·상수·Event 원장은 그대로다. writer 로컬 C09 재실행 `13 passed, 671 deselected in 43.68s`(exit0), G-05 seq1755 PASS, diff check PASS. 정식 Developer 실패0. 해당 Windows 로컬에는 객체가 있어 수정 전에도 clone node가 PASS했으므로 WSL 실패를 RED 증거로 분리 기록했다.
- 미검증: 보완 제품 SHA의 WSL-server focused/full suite, C30/E09 잔여, 실제 DB/API/브라우저. 다음은 후속 exact2 독립 검토→같은 branch commit/push→WSL-server 정확한 SHA 집중·전체 suite 검증 및 전용 임시 경로 정리다. F-20 수락·main 병합은 하지 않는다.

# F-20 R5c 제품 WSL-server 집중·전체 suite / 2026-09-28

- 판정: `R5C_C09_WSL_SCOPED_GREEN; FULL_SUITE_NON_GREEN_8; CURRENT_DIGEST_R5C_REWORK`. 보완 commit `ba8a0b4023f48cc9a8ed1e61fe606844f4dd4564`를 기존 branch에 push하고 WSL-server 전용 checkout에서 pull해 SHA/Git clean을 확인했다. 기존 PR #15 역사 객체는 FETCH_HEAD만으로 준비하고 C09 10bbb 객체도 정확한 SHA로 fetch했다. 같은 SHA의 C09 takeover/final 13건 `13 passed, 671 deselected in 14.49s`(exit0), R5b/R5c 통제 `10 passed in 30.49s`(exit0), G-05 seq1755 PASS. 새 branch/tag·공유 DB/Docker·Production 변경0.
- WSL-server 전체 pytest는 exit1, `8180 passed, 8 failed, 116 skipped, 14 warnings in 817.48s`. 로그 25,997 bytes SHA-256 `3b8a409d7267045827de835a6fdfdeecd30c24020b481cd7a589388d4d6af3a9`. C09 기존 6건은 모두 제거됐다. 실패8은 C30 raw Event 1, 현재 detached digest R5b 고정 기대값 1, C21 역사 부모 객체 부재 3, E09 start/final 3이다. 이 차이를 R5c 제품 효과만으로 귀속하지 않는다. C21 정확한 과거 객체 `fb311d456fe3cbb2e8439f39017356ddec6cf266`를 그 checkout에 추가로 fetch한 뒤 해당 class `4 passed, 680 deselected in 0.76s`(exit0)로 환경 원인을 분리했으나, 이 준비를 포함한 전체 suite 재실행 전이므로 공식 5 FAIL 집계로 승격하지 않는다.
- active epoch7 exact2 writer에게 현재 digest node의 R5c mode 기대값만 보완하도록 재작업 전달했다. C30 감사 원장과 E09 3건은 별도 진단·순차 범위로 남긴다. 전체 로그·pytest 임시 폴더·전용 checkout은 정확한 결과 기록 및 후속 SHA 검증 뒤 정리 예정. 미검증: 후속 제품 SHA WSL full suite, DB/API/브라우저·PG15/PG18RC·11개 메뉴/rollback. F-20 수락·main 병합 불가.

- 동일 writer가 현재 detached digest 테스트의 R5b 고정 mode와 위조 progress/digest/manifest 오류 기대 네 곳을 R5c로 갱신했다. 단일 node RED `1 failed in 0.77s`(exit1)→GREEN `1 passed in 9.82s`(exit0), C09 13건과 묶음 `14 passed, 670 deselected in 64.26s`(exit0), G-05 seq1755 PASS, diff check PASS. in-memory 위조 payload·검증기·Event 수정0, 정식 Developer 실패0. 새 SHA WSL 동일 조건 focused/full 재검증이 남았고 독립 read-only 재검토 진행 중이다.
- 다음 E09 잔여 3건의 읽기 전용 원인 확인: frozen `E09_WI_HASH=2DCA27...`는 `30ca8a2` 당시 Git blob의 5,196 bytes와 일치하며 현재 WI는 5,195 bytes/SHA `71DA40...`로 마지막 LF 1 byte 차이다. final에서 고정 검사하는 다른 제품 5경로와 E09 start digest/manifest·invocation은 현재 hash가 checker 고정값과 일치한다. 따라서 현재 E09 3건의 첫 실패는 동일 WI 역사/후속 bytes 경계로 좁혀졌으나, 아직 재작업·GREEN 판정 전이다. 현재 파일·frozen 상수·Event 변경0.

# F-20 R5c 최종 동일 SHA WSL-server 전체 suite / 2026-09-28

- 판정: `R5C_SCOPED_ACCEPTED; F20_FULL_SUITE_NON_GREEN_4`. 후속 exact2 commit `eaea6d09c6ab1e7d59e8263e4437eedb64433d80`을 기존 branch에 push하고 지정 원격·WSL-server 전용 checkout에서 SHA 일치/Git clean을 확인했다. C21 과거 객체와 기존 PR #15 역사 객체는 새 branch/tag 없이 그 전용 checkout에 준비했다. C09 Main takeover/final 및 current digest `14 passed, 670 deselected in 16.19s`(exit0), R5b/R5c 통제 `10 passed in 30.62s`(exit0), G-05 seq1755 PASS. 단일 writer 정식 실패0, 독립 제품 검토 Critical 0/Important 0.
- 같은 SHA WSL-server 전체 pytest exit1: `8184 passed, 4 failed, 116 skipped, 14 warnings in 850.42s`. 실패는 C30 canonical raw Event 감사 1과 E09 start1/final2 역사 검증 3뿐이며 C09 6·현재 digest1·C21 객체3은 이번 조건에서 실패하지 않았다. 전체 로그 18,587 bytes SHA-256 `d9bb31f849e7f866f38f05ecbec82bca2f5f1eb4de5dfcbd0c19eab10687f620`. 이는 전체 suite PASS/F-20 수락이 아니며 skip은 PASS로 세지 않는다. 공유 DB/Docker·ysna-server/Production 변경0.
- R5c 결과보고서에 최종 WSL 증거를 writer가 반영 중이다. 전용 checkout·두 전체 로그·pytest base들은 정확한 결과 기록 후 링크/경로와 타 프로세스 이용을 확인해 정리한다. 미검증: E09 역사 3과 C30 원장 감사 1, 실제 PG15/PG18RC·API/브라우저·11개 메뉴/backup/restore/rollback. 다음은 R5c 기록 commit/push·임시 자원 정리→epoch7 write/worker lease 회수→E09 exact-path 후속 R5d 통제·제품 순차 재작업이다. F-20 수락·main 병합·신규 branch는 하지 않는다.

- R5c 결과보고서가 최종 SHA/집계/로그 해시를 반영했고 G-05 seq1755 PASS, diff check PASS, 정식 Developer 실패0이다. WSL 전용 checkout 1, 전체 로그 2, pytest base 4의 정확한 경로·Anvil 사용 프로세스 0을 확인했다. pytest symlink 492개 모두 각 전용 경로 내부이며 checkout `.venv`의 외부 Python runtime symlink는 링크만 삭제되고 공유 runtime은 보존된다. 일곱 경로만 제거하고 `F20_R5C_WSL_RESIDUE_ZERO`를 확인했다. 다른 프로젝트 pytest·공유 DB/Docker·Production은 건드리지 않았다. 두 로그 원문은 정리 후 복구되지 않고 집계·크기·SHA가 이 status와 결과보고서에 보존된다.

# F-20 R5d E09 역사 WI 재작업 계획 / 2026-09-28

- 판정: `R5D_PLAN_DEFINED; R5C_LEASE_STILL_ACTIVE; PRODUCT_NOT_STARTED`. R5c 최종 기록 commit `7a28fe0559b9943090304e752634e354801caf5d`가 지정 원격과 일치하고 현재 작업 branch clean을 확인했다. WSL 전체의 잔여 E09 3건은 당시 E09 WI 5,196 bytes/SHA `2DCA27...`와 현재 5,195 bytes/SHA `71DA40...`의 역사/후속 경계로 좁혔다. E09의 다른 frozen 제품 5경로·invocation·start digest/manifest는 고정 hash와 일치한다. C30 감사 1건은 변경 없이 열려 있다.
- 승인된 F-20 회복 계획의 R5d 절에 통제 준비→epoch7 회수/epoch8 exact2 grant→단일 writer 역사 fixture·음성→독립 검토→WSL 동일 SHA 전체 suite의 작업·검증 경계를 정했다. 이는 기존 계획의 E09 역사군 분리이며 기능 범위·요구사항·중요 위험 확장이나 새 branch 생성은 아니다. 별도 계획 신규 파일은 현재 R5c G-05 경로 제한에 걸려 생성 직후 제거하고 기존 허용 계획서에 통합했다. 현 단계 제품 파일·현재 E09 WI·검증기·frozen hash·Event 수정0; 새 lease 전 writer는 시작하지 않는다. 다음은 R5d 통제 음성 RED→GREEN과 유효 lease 발급이다.

- Main이 R5d WI/Invocation, append-only overlay, checker route, R5c 다음 통제 경로 allowlist, R5d projection 테스트를 준비했다. 새 테스트는 overlay 부재로 `5 failed in 0.28s`(의도 RED, exit1), 최소 구현 후 `5 passed in 116.13s`(exit0); G-05 현재 seq1755 PASS, diff check PASS, py_compile PASS. 두 전용 Windows pytest base의 symlink 각각5개는 각 경로 내부임을 확인하고 정확한 폴더만 제거해 잔류0. 기존 제품 exact2는 수정하지 않았고 현재 R5c epoch7 lease는 ACTIVE다. 독립 read-only 통제 리뷰와 R5b/R5c 회귀가 남아 있으며, 새 lease를 아직 발급하지 않았다.

- 독립 read-only 통제 리뷰 Important 1: 활성 R5c와 새 R5d overlay의 detached digest가 schema_version·algorithm·progress.path·handoff.path를 발행값에 결박하지 않았다. R5c 정본 메모리 위조 네 경우 모두 `validate_control=[]`로 실제 재현됐다. R5c/R5d 각각 새 음성 테스트가 `1 failed`씩 의도 RED(exit1)임을 확인하고 두 overlay에 네 metadata exact 비교를 추가했다. 동일 두 테스트 `2 passed in 36.04s`(exit0), R5b/R5c/R5d 통제 전체 `17 passed in 335.67s`(exit0). reviewer 재검토에서 Important 1 해소·새 Critical/Important 0. RED/GREEN 전용 pytest base symlink 각2, 전체 base symlink17 모두 해당 경로 내부 확인 후 정확한 폴더만 제거해 잔류0. 현재 G-05·diff/py_compile와 기준 Git 상태 재확인 후 통제 준비 commit/push 예정; epoch7 ACTIVE, epoch8 아직 미발급, 제품 writer 실패0.

# F-20 R5d epoch8 lease 발급 / 2026-09-28

- 판정: `R5D_LEASE_ACTIVE; PRODUCT_EXACT2_NOT_STARTED; WSL_CONTROL_PENDING`. R5d 통제 준비 `8eb806be6304c741e20f49266aa5ddfb4a693f8a`를 기존 branch에 push하고 로컬·원격 SHA 일치, clean, G-05 seq1755 PASS를 확인했다. 검증된 overlay가 R5c epoch7 write→worker를 append-only 회수한 뒤 R5d epoch8 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5D_RESULT.md`) worker/write를 발급해 Event seq1756~1761을 추가했다. G-05 `PASS sequence=1761`(exit0), diff check PASS. 제품 두 경로 수정0, writer 정식 실패0. 다음은 lease 기록 commit/push→WSL-server exact SHA 통제 검증 후 단일 writer 지시다. E09 3건·C30 감사 1건과 실제 DB/API/브라우저는 미검증·미수락이며 새 branch·Production 없음.

- lease commit `d7572066eec4927b34a32cd1481a357760314ed2`를 지정 원격에 push하고 local/remote 일치·clean·G-05 seq1761 PASS를 확인했다. WSL-server 전용 `/tmp/anvil-f20-r5d-control-d757206` checkout도 SHA 일치·Git clean이며, 기존 `/home/daon/.local/bin/uv`로 lockfile 고정 dev 의존성을 설치해 G-05 seq1761 PASS, R5b/R5c/R5d 통제 `17 passed in 68.05s`(exit0). 전용 pytest base symlink17개 모두 그 경로 내부 확인 후 해당 폴더 하나만 제거해 잔류0. checkout은 제품 exact SHA 후속 검증에 재사용한다. 공유 DB/Docker·다른 프로젝트 프로세스·ysna-server/Production 변경0. 다음은 active epoch8 exact2 단일 writer의 E09 역사 WI RED→GREEN이다.

- 판정: `R5D_PRODUCT_LOCAL_GREEN; FULL_SUITE_NOT_VERIFIED`. 지정 branch `faa239db03c924445da63e8bb1e38d190177cad0`/epoch8 worker+write lease의 단일 writer가 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5D_RESULT.md`)만 변경했다. E09 기존 5개는 변경 전 3 FAIL/2 PASS, 당시 `30ca8a2` Git WI 5,196 bytes/frozen SHA 검증 후 fixture 전용 in-memory overlay와 누락·위조 음성 2개를 추가하여 최종 7 PASS(8.20s, exit0)다. 현재 WI·checker·Event·frozen hash는 변경하지 않았다. G-05 seq1761 PASS, diff check PASS. 변경 파일 전체 pytest는 기존 C30 raw Event 실패 마커 1건 확인 후 중단(exit1, 최종 집계 없음); PASS로 표시하지 않는다. Windows 임시 basetemp 7경로는 writer 확인 시 모두 ABSENT, 정식 Developer 실패0. Main 독립 검토와 동일 SHA WSL focused/full suite는 대기 중이며 F-20 수락·main 병합·신규 branch·Production은 하지 않는다.

- Main 독립 G-05 seq1761 PASS(exit0), diff check PASS. 독립 read-only 제품 리뷰 Critical 0/Important 0: exact2 외 수정 없음, 5,196-byte 역사 Git WI/frozen SHA와 현재 5,195-byte 후속 WI의 분리, 두 E09 class 전용 overlay, blob 누락·위조 음성 및 기존 제품/raw Event/lease/final 거부 검사를 확인했다. 리뷰는 실행 검증을 대체하지 않는다. 다음은 기존 branch exact 변경 commit/push→WSL-server exact SHA E09·통제·전체 suite다.

- R5d 제품 commit `9024c6e59666673e11375f5df8d514ae02886e47`를 현재 branch에 push하고 지정 원격 SHA 일치·로컬 clean을 확인했다. WSL-server 전용 checkout이 같은 SHA를 pull하여 G-05 seq1761 PASS, E09 `7 passed in 7.42s`, R5b/R5c/R5d 통제 `17 passed in 59.29s`(각 exit0). 전체 pytest는 exit1, `8195 passed, 2 failed, 116 skipped, 14 warnings in 877.01s`: 기존 C30 raw Event 감사 1건과 `ProjectProgressContractTests.test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`의 R5c 고정 mode 기대값 1건이다. E09 기존 3건은 전체 suite에서 실패하지 않았다. 전체 로그 15,196 bytes SHA-256 `7bfc018f698c82c64f4dc04cc3481928a81a326a9379246a79eccb061ebdb9ff`. 활성 epoch8 exact2 writer에게 mode 기대값만 R5d로 보완하고 보고서를 갱신하도록 후속 지시했다. C30 감사·실제 DB/API/브라우저·11개 메뉴는 미해결/미검증이며 F-20 수락·main 병합 금지다. WSL 전용 checkout·로그·pytest base는 후속 동일 SHA 재검증 및 정확한 경로 확인 뒤 정리한다.

- 후속 exact2 writer가 현재 digest node RED `1 failed`를 재현하고 R5c→R5d mode/오류 기대 네 곳만 갱신했다. 위조 progress·handoff·digest·manifest 음성 입력은 유지했고 digest+E09 로컬 `8 passed in 26.11s`(exit0), G-05 seq1761 PASS, diff check PASS, 정식 실패0. 독립 read-only 재검토 Critical 0/Important 0: 현재 projection mode와 R5d overlay checker의 세 오류 코드가 일치하며 exact2 외 제품·Event 변경은 없다. Main 독립 G-05 seq1761 PASS(exit0)·diff check PASS. 다음은 동일 branch에 세 경로(제품 exact2와 Main WORK_STATUS)만 commit/push하고 WSL-server가 새 SHA의 집중·전체 suite를 재검증하는 것이다.

- 판정: `R5D_SCOPED_GREEN; F20_FULL_SUITE_NON_GREEN_1`. 후속 R5d commit `e12f74c7e4ca040acec113c2bc37f55c83ff6124`를 지정 원격에 push하고 WSL-server 전용 checkout이 동일 SHA로 fast-forward했다. G-05 seq1761 PASS, digest+E09 `8 passed in 5.87s`(각 exit0). 전체 pytest는 exit1, **8196 passed, 1 failed, 116 skipped, 14 warnings in 928.23s**. 유일 실패는 `C30CanonicalReconciliationTests.test_no_early_acceptance_or_lease_revoke`의 현재 Event raw prefix와 당시 C30 정본 불일치다. E09 3건과 R5d digest 신규 실패는 제거됐으나 전체 suite PASS는 아니다. 최종 로그 13,857 bytes/SHA-256 `d29767afeaba6a9aa14ffe294b3492c90c226765eff32a2510c1ad8aa9e332d2`. R5d writer가 exact2 결과보고서에 이 증거를 반영 중이며 정식 실패0. 잔여 C30 감사·실제 DB/API/브라우저·11개 메뉴/backup/restore/rollback은 미해결/미검증이다. F-20 수락·main 병합·신규 branch·Production 금지. 다음은 R5d 보고서 commit/push와 WSL 임시 자원 안전 정리 후 C30 append-only 사고 기록·현재 수락 차단의 별도 경계 설계다.

- WSL-server R5d 전용 checkout 1, pytest base 3, 전체 로그 2의 정확한 `/tmp/anvil-f20-r5d-*` 여섯 realpath를 확인했다. Anvil pytest/process 0이며 별도 Daon2-rag pytest는 건드리지 않았다. pytest 경로 내부 symlink 503개를 확인했고 링크 대상/공유 runtime은 삭제하지 않은 채 여섯 경로만 제거했다. 후속 `find /tmp -maxdepth 1 -name 'anvil-f20-r5d-*'` 출력0으로 R5d 임시 잔류0. 원문 로그는 정리 후 복구되지 않으며 두 실행의 집계·크기·SHA가 status/결과보고서에 보존된다. 공유 DB/Docker·다른 프로젝트·ysna-server/Production 변경0.

# F-20 R5e C30 원장 사고 경계 계획 / 2026-09-28

- 판정: `R5E_PLAN_DEFINED; R5D_LEASE_ACTIVE; INCIDENT_NOT_YET_RECORDED`. R5d 결과·정리 commit `3467f88cee3d1c229849cfb0e1c3c0342c913f34`가 지정 원격과 일치하고 branch clean이다. 남은 C30 감사 실패는 당시 1334-event prefix 3,994,695 bytes/SHA `BDB3AA...`와 현재 4,022,935 bytes/SHA `50195E...`의 실제 불일치다. 최초 변형 `14c8c574`, 부모 `97adc5c` 대비 seq1689~1712 의미 변경 24건을 재확인했다. seq1715 기존 F-20 evidence invalidation의 `historical_bytes_mutated=false` 기록은 이 별도 사고를 해소하지 않는다.
- 승인된 F-20 회복 계획에 R5e 절을 추가했다. 기존 Event contract의 `DEFECT_RECORDED` CRITICAL/blocking을 과거 raw prefix 보존 상태로 append하고, G-05가 원본/current hash·사고 활성·현재 F-20 미수락/DEFER를 검증하도록 통제한다. R5d write→worker 회수 뒤 epoch9 exact2 제품 lease를 발급하고 단일 writer가 C30 역사 검증과 현재 사고/수락 차단·위조 거부 테스트를 다룬다. 과거 Event/frozen hash 재작성·test skip/xfail·full suite PASS의 F-20 수락 승격은 금지다. 이는 기존 계획의 사고 기록 경계이며 제품/API/DB/운영 범위는 확장하지 않는다. 계획·status 변경 후 G-05 seq1761 PASS(exit0); 새 Event/lease/제품 write는 아직 0. 다음은 R5e 통제 RED→GREEN·독립 검토, 기준 commit/push 후 유효 lease 전환이다.

- R5e exact2 WI/Invocation을 별도 문서로 초안 작성했다. R5d 활성 control의 Git allowlist에는 이 두 준비 문서만 정확히 추가했으며 R5e overlay·Event·lease·제품 test 변경은 아직 없다. 새 두 파일이 allowlist 밖일 때 G-05 `F20_R5D_GIT_INVALID`(exit1)를 재현하고, 두 경로만 허용한 뒤 G-05 `PASS sequence=1761`(exit0)을 확인했다. WI는 아직 canonical `WORK_INSTRUCTION_ISSUED` Event로 발행되지 않았으며 writer dispatch·제품 write는 금지 상태다. 다음은 준비 문서·allowlist의 diff/통제 회귀 검토와 안전 commit/push다.

- R5d 통제 회귀 로컬 첫 실행은 `D:\tmp` 접근 ACL로 test setup 6 ERROR/exit1이며 제품 실패가 아니다. 같은 전용 경로의 실행 권한으로 재실행해 `tests/tooling/test_f20_rework_r5d_projection.py` **6 passed in 159.64s**(exit0). 전용 basetemp의 6개 reparse point가 모두 자기 경로 내부를 가리킴을 확인하고 해당 폴더 하나만 제거해 `Test-Path=False`를 확인했다. 정식 Developer 실패0; 제품 파일·원장·lease 수정0. 미검증: R5e Event/control 발급, C30 test/음성, WSL 동일 SHA. 다음은 G-05·diff와 Git exact path를 확인해 준비 commit/push한다.
