# Codex Work Log

## G-03

- Captured the pre-scaffold inventory before creating repository artifacts.
- Added the dependency-boundary test first and recorded its checker-missing RED result.
- Added only the standard-library boundary checker required to make the tooling contract GREEN.
- Reserved the approved directory structure without product or runtime implementation.

## C-21 인증 세션/SSE 통합 검토 — 2026-09-02

- 담당: `implement_session_auth_sse` subagent 구현, Main Agent 검토·통합.
- 기준: canonical `main` `9518dca`; 결과 커밋 `31b8324`로 cherry-pick.
- 변경 파일: `packages/api/fastapi_app.py`, `packages/api/local_session.py`, `packages/api/runtime.py`, `tests/api/test_local_session.py`, `docs/04_test_reports/C-21_SESSION_AUTH_SSE_REPORT.md`.
- 검증: `PYTHONPATH=<canonical worktree> uv run --offline pytest tests/api tests/recovery -q -p no:cacheprovider` → `65 passed, 13 skipped`.
- 환경 오류: PYTHONPATH 미지정 수집 실패 1회(`ModuleNotFoundError: packages`), 코드 실패로 집계하지 않음. 재실행에서 해소.
- 미검증: 새 커밋의 ysna 재배포, 실제 세션 credential 발급, PostgreSQL EventStream 기반 authenticated SSE, Last-Event-ID 운영 호출.
- 임시 경로: 새 `D:\tmp` 폴더·프로세스·포트·컨테이너·볼륨·네트워크를 만들지 않았고 기존 worktree를 보존했다. 상세 정책은 `docs/DEVELOPMENT_ENVIRONMENT.md`.
- 다음 조치: exact `31b8324`에 대한 ReleaseManifest/DeployApproval binding을 갱신한 후, 승인된 표준 `deploy.sh`로 ysna에 재배포하고 세션 발급→authenticated SSE→Last-Event-ID를 검증한다.
- 추가 확인: ysna `/home/ubuntu/deploy/anvil/.env`에서 `ANVIL_TEST_SESSION_*` 6개 변수는 미설정으로 확인됨(값은 읽지 않음). 원격 환경변수 추가와 `660e6a5` 배포는 새 exact DeployApproval 및 보안 credential 생성·저장 승인이 필요하다.

## C-21 공개 인증 프록시 보완 — 2026-09-02

- `fix_public_auth_proxy` subagent가 `/auth/*` upstream 전달과 스트리밍 응답 보존을 구현했다.
- subagent 검증: Node `15 passed`, `node --check` PASS, `git diff --check` PASS.
- Main cherry-pick 커밋: `8ba679e72f53e20561e2063f3cdf01c10981a67b`.
- 배포 전 상태: `ReleaseManifest`는 새 hash에 대해 `APPROVAL_PENDING`; 기존 `9fd7c46` 승인 binding은 hash 변경으로 승계하지 않는다.
- 다음 조치: 새 exact commit 배포 승인 후 표준 deploy 및 session→authenticated SSE→Last-Event-ID 재검증.

## 운영 구조 재정렬 — 2026-09-02

- 판정: 현재 `anvil-web:3770 → anvil-internal-web-1:4173` 포워딩은 단일 운영 런타임 요구를 충족하지 않는 우회 구조다.
- 조치: 이를 완료로 승격하지 않고, `anvil-web:3770`이 API·health·Telegram·SSE를 직접 처리하고 `4173` 의존성을 제거하는 정식 통합 작업을 시작했다.
- 미충족: 단일 런타임 구현·검증·internal 컨테이너 제거 전까지 C-21 운영 완료 아님.

## Unified Runtime R3 최종 배포 대기 — 2026-09-02

- 최종 runtime commit: `cb3afcdd5971c7497b4c0044d3ee52479c59da59`.
- 검증: 전체 `tests/api` 53 PASS, deployment scripts tests 9 PASS, bash syntax와 diff-check PASS.
- 변경: PostgreSQL SSE replay/Last-Event-ID adapter, health route·healthcheck, unified verify/rollback 계약.
- 상태: 새 exact hash DeployApproval 대기. 기존 `a962bdf` binding은 무효화했다.
- 제거 조건: 공개 UI·API·health·Telegram·SSE·Last-Event-ID가 모두 PASS인 경우에만 `anvil-internal-web-1` 제거.

## C-21 정식 Run 생성 경로 예외 — 2026-09-02

- 판정: `SCHEMA_AUTHORITY_GAP / WAITING_APPROVAL`.
- 독립 리뷰에서 초기 구현 `828a56e`는 승인 artifact 계보 미검증과 canonical API 계약 불일치로 `MERGE_BLOCKED`; main에 반영하지 않았다.
- 현재 migration에는 `execution_plans`, Task state version, Run의 work-instruction/execution-plan/idempotency/prior-run/resume-checkpoint 계보 컬럼과 active Run unique constraint가 없다.
- 신규 DB migration 없이 조건을 임의 `true`로 기록하거나 직접 SQL seed를 사용하는 방식은 금지한다.
- NPM `/data/nginx/custom/server_proxy.conf`(SHA-256 `406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf`)가 Telegram webhook을 internal `4173`으로 직접 우회하므로, 제거·`nginx -t`·graceful reload 승인도 필요하다.
- 다음 조치: 권위/계보/멱등/동시성 schema migration 및 NPM custom override 제거 승인을 받은 뒤 구현·배포·수직검증한다.

## C-21 Run/Event Main takeover — 2026-09-02

- 동일 권위/phase 계약 실패 3회로 Developer를 중단하고 Main Agent가 직접 인수했다.
- MERGE FORBIDDEN 계보: `80105db`, `828a56e`; R3 후보 `cc9382f`도 그대로 병합하지 않았다.
- 직접 수정: root human approval ID + DesignSpecification ID/hash/type exact 결박, durable/receipt phase `ANALYZING` 일치. 최초 2-event 시도는 아래 canonical EventType 보정에서 폐기했다.
- 회귀: `tests/api tests/persistence` → `72 passed, 5 skipped`; 현재 Main 환경에 격리 PostgreSQL DSN이 없어 PostgreSQL 전용 5건은 skip. 기존 subagent PostgreSQL 15 실증 3 PASS를 별도 증거로 유지하고 PG18은 `UNVERIFIED`.
- 원격 DB·NPM·Telegram 변경 없음. 다음 조치는 최종 독립 review 후 main 통합이다.

## C-21 Run Authority R2 격리 검증 리소스 계획 — 2026-09-02

- 승인: 신산님이 `SCHEMA_AUTHORITY_GAP` 해제 및 신규 migration, PostgreSQL 15/가능 시 18 검증을 승인했다.
- 기존 작업공간 재사용: `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\implement-session-auth-sse`; branch `codex/c21-run-event-writer-r2`; 새 `D:\tmp` 폴더 없음.
- 예정 container: `anvil-c21-pg15-r2` (`postgres:15`, loopback `55432`), `anvil-c21-pg18-r2` (`postgres:18`, loopback `55438`). 목적은 0012 migration과 정상 Run 생성 transaction/idempotency/concurrency 검증, 소유자는 `r3_event_flow_diag`, 사용 기간은 이번 R2 검증 동안이다.
- 영속 volume/network는 만들지 않는다. 각 container는 `--rm`으로 실행하며 검증 종료 시 explicit stop 후 container/name/port/process를 재조회해 잔여 0을 확인한다.
- 운영 DB·원격 ysna·NPM·Telegram·Provider에는 연결하거나 변경하지 않는다.

## C-21 정상 Run/Event 생성 R2 완료 대기 — 2026-09-02

- 담당: `r3_event_flow_diag` writer, `run_event_writer_review` independent read-only reviewer.
- 브랜치: `codex/c21-run-event-writer-r2`; 기준 `main` `a12adc2`; 금지된 R1 commit `80105db`/`828a56e`는 반영하지 않았다.
- 변경: canonical Run creation API/application port, server-side authority repository, `0012_run_authority` migration, runtime wiring 및 readiness migration head, API/실제 PostgreSQL tests.
- RED: 신규 port/migration 모듈 부재로 collection failure. GREEN: API/schema 4 passed.
- 실제 PostgreSQL 15: migration head `0012_run_authority`, atomic/idempotency/rollback/concurrency `3 passed in 1.67s`.
- 격리 PostgreSQL 18: 실행 출력은 확보했으나 마감 시 독립 증거 재확인을 생략하여 최종 판정은 `UNVERIFIED`.
- 회귀: `tests/api tests/persistence` 71 passed, 3 skipped in 6.57s. DSN 없는 회귀 실행에서 실제 DB 전용 3건만 의도적으로 skip.
- 오류 횟수: 동일 구현 실패 0회. PostgreSQL 18 최초 재실행의 고정 fixture PK 충돌 1회는 이전 성공 실행의 test row 잔존이 원인이며 UUID fixture로 보완 후 통과했다.
- 보안: test session `run:events:read` 권한을 확장하지 않았고 credential/auth 우회를 추가하지 않았다. 정상 운영 인증 부재는 숨기지 않고 route 운영 검증 blocker로 유지한다.
- 미검증: 운영 DB migration, authenticated 운영 Run 생성, public SSE/Last-Event-ID, Telegram/Provider, ysna 배포.
- 임시 리소스 정리: `anvil-c21-pg15-r2`, `anvil-c21-pg18-r2` stop 완료; 두 container는 `--rm`으로 제거됐고 name filter 재조회 결과 0건. volume/network 생성 없음.
- 상세 보고서: `docs/04_test_reports/C-21_RUN_EVENT_WRITER_R2_REPORT.md`.
- R3 RED: 잘못된 approval type을 허용할 수 있는 계보 query와 hostile ID가 HTTP 500이 되는 계약 결함을 독립 reviewer가 확인했다. API hostile test는 수정 전 `1 failed, 3 passed`로 RED를 재현했다.
- R3 조치: 각 artifact에 정확한 `approval_type` 결박, 모든 authority/continuation ID를 API boundary에서 canonical 길이·공백 검증 후 4xx 변환, 설계서 1950-1957에 맞춘 202 receipt `ANALYZING` 반환. 당시 2-event 판단은 아래 canonical EventType 보정으로 대체했다.

## C-21 canonical EventType Main takeover 보정 — 2026-09-02

- 담당: Main Agent `어울`; 동일 권위·phase 계보 구현 실패 3회 이후 `developer-primary` write lease를 회수하고 직접 인수했다.
- 판정: `RUN_CREATED`는 `packages/domain/events.py`의 폐쇄형 `EventType`과 설계서 전이표에 없으므로 canonical event가 아니다. SSE Last-Event-ID 검증 편의를 위해 추가한 비표준 이벤트를 유지할 수 없다.
- 근거: 설계서의 최초 정상 전이는 `DRAFT + TASK_CONFIRMED -> ANALYZING` 하나이며, 다음 정상 이벤트 `ANALYSIS_COMPLETED`는 실제 분석 완료 뒤에만 생성할 수 있다.
- Ruling: Run 생성 transaction은 `TASK_CONFIRMED` 1개만 sequence 1로 기록하고 durable/receipt phase를 `ANALYZING`으로 일치시킨다. 실제 후속 이벤트 없이 Last-Event-ID strict successor를 성공으로 만들지 않는다. 이 판단이 틀리면 별도 도메인 이벤트를 설계·승인해야 하며 현재 구현에 임의 문자열을 추가하지 않는다.
- TDD RED: 격리 PostgreSQL 15에서 단일 `TASK_CONFIRMED`/sequence 1 기대에 기존 구현이 `RUN_CREATED`, `TASK_CONFIRMED`를 반환하여 `1 failed, 4 passed`로 실패했다.
- GREEN: production repository를 단일 `TASK_CONFIRMED`/sequence 1, Run version 2, 1-event idempotent receipt로 수정했다. 동일 PostgreSQL 15 test `5 passed in 0.83s`, API port `4 passed in 0.76s`.
- 멱등 replay 추가 RED/GREEN: sequence 1이 canonical `TASK_CONFIRMED`가 아닌 손상 상태를 기존 replay가 수락해 `DID NOT RAISE`로 RED. replay가 sequence 1의 ID/type을 확인하도록 수정 후 PostgreSQL 통합 `6 passed in 0.79s`.
- 전체 회귀: PostgreSQL 15 DSN을 포함한 `tests/api tests/persistence` `78 passed in 2.59s`; `compileall`과 `git diff --check` PASS.
- PostgreSQL 18 RC: 새 격리 DB에 migration head `0012_run_authority` 적용 후 실제 Run/Event 통합 `5 passed in 0.79s`.
- 임시 리소스 정리: `anvil-c21-pg15-r2`, `anvil-c21-pg18-r2`를 stop했고 `--rm`으로 제거됐다. name filter와 loopback `55432`/`55438` listener 재조회 결과 잔여 0건, volume/network 생성 없음.
- 임시 검증 리소스: 기존 기록된 `anvil-c21-pg15-r2` 이름을 재사용하며, PostgreSQL 15 loopback `55432`, owner Main Agent, 목적은 migration 0012 및 atomic/idempotency/rollback/concurrency RED-GREEN 검증, 기간은 이번 검증 동안, 완료 즉시 `--rm` 제거·잔여 0건 확인이다. 새 volume/network/D:\tmp 폴더는 생성하지 않는다.
- 현재 미검증: 독립 reviewer 재검토, canonical main 통합, ysna migration/runtime 적용, NPM override 제거/reload, 전체 수직 검증.
- Main continuation 안전성 보완: 미조정 `pending_writes`가 있는 checkpoint를 거부하고, checkpoint state artifact의 type/run/project/content hash를 명시적으로 재검증한다.
- RED: pending write가 남은 checkpoint가 continuation을 통과해 `1 failed, 13 passed`를 재현했다.
- GREEN: PostgreSQL 15 Run creation/continuation `14 passed in 1.44s`; 실제 scratch migration upgrade/downgrade 및 duplicate-active rollback `2 passed in 5.42s`.
- 독립 최종 review는 EvidenceManifest가 prior Run/Step/project/ExecutionPlan에 직접 결박되지 않아 다른 실행의 동일-hash 증거를 재사용할 수 있는 Important 1건으로 `MERGE_BLOCKED` 판정했다.
- Main 조치: 0012에 EvidenceManifest `run_id`, `step_id`, `project_id`, `execution_plan_id/hash`, `permission_snapshot_hash`의 all-or-legacy migration/FK/check/index를 추가하고 continuation query를 exact binding으로 강화했다. 다른 project manifest 거부 회귀 테스트를 추가했다.
- 최종 GREEN: PostgreSQL 15 Run/continuation+migration `17 passed in 6.82s`; API+persistence+planning `107 passed in 8.38s`; compileall 및 `git diff --check` PASS. 독립 재검토 대기.
- 독립 scoped review: 이전 비표준 `RUN_CREATED` Critical은 `ADDRESSED`. 새 Important로 진행된 Run의 현재 phase/status를 idempotent replay가 반환해 최초 202 receipt를 재현하지 않는 계약 위반을 확인했다.
- 보정 계획: 후속 event 존재는 허용하되 sequence 1 `TASK_CONFIRMED`를 creation proof로 확인하고, replay receipt는 최초 계약 값 `ANALYZING`/`ACTIVE`를 반환한다. 실제 PostgreSQL progressed-run 회귀 테스트를 RED로 확인한 뒤 production code를 수정한다.
- 멱등 receipt RED: Run을 `EXECUTION_PLAN_REVIEW`/`WAITING_APPROVAL`로 진행시킨 뒤 같은 key를 replay하면 현재 phase가 반환되어 `1 failed`.
- 멱등 receipt GREEN: replay query에서 mutable phase/status 의존을 제거하고 최초 계약 값 `ANALYZING`/`ACTIVE` 및 sequence 1 event ID를 반환하도록 수정했다. PostgreSQL 통합 `7 passed in 0.91s`, API+persistence `79 passed in 2.72s`, compileall/diff-check PASS.
- 최종 whole-branch review: `MERGE_BLOCKED`. Critical 2건은 cross-task/stale checkpoint continuation과 cross-project artifact 결박 부재, Important 2건은 artifact approval vocabulary 미연결과 migration preflight/downgrade 실증 부재였다.
- Main takeover 보정: `design_baselines.project_id` legacy-nullable anchor를 0012에 추가하고 신규 Run은 Task project와 exact match를 요구한다. API authorization resolver의 project/environment 및 canonical permission snapshot hash를 Run command·durable row·event에 결박했다.
- Continuation 보정: prior Run same task/baseline/WI/ExecutionPlan/environment/permission, terminal status, checkpoint state artifact same project/run, exact six binding hashes를 검증한다. 완료 Step은 target=delivered, same-run/project output artifact 및 exact design/work/WI/environment EvidenceManifest가 모두 있을 때만 재사용 가능하다.
- Approval 보정: `DESIGN_SPECIFICATION`, `WORK_PLAN`, `WORK_INSTRUCTION`, `EXECUTION_PLAN`, `EXECUTION_MODE`를 domain/API guard vocabulary에 추가하고 기존 PLAN/운영 승인 lane은 유지했다. 신규 unit RED 후 planning guard `5 passed`.
- TDD/검증: cross-project schema anchor 부재 RED→repository scope 미검증 RED→GREEN; cross-task/stale-binding/missing-evidence 3 RED 및 verified-evidence success를 추가했다. PostgreSQL Run creation `13 passed`; 실제 scratch DB 0012 upgrade/downgrade round-trip과 duplicate-active preflight 전체 DDL rollback `2 passed`; API+persistence+planning `105 passed in 9.49s`, compileall/diff-check PASS.
- PostgreSQL 18 RC 재검증: 최신 0012 head 적용 후 Run/continuation 13건과 scratch migration round-trip/preflight 2건, 합계 `15 passed in 6.20s`.
- 남은 단계: 최종 독립 재리뷰, canonical main squash 통합·push, 표준 3770 deploy의 DB backup/정확한 0012 적용 단계 보완, release binding, ysna 적용/NPM override 제거/수직 검증.

## C-21 공개 인증 프록시 — 2026-09-02

- 담당: `fix_public_auth_proxy` subagent.
- 기준: canonical `main` `b9b1a39`; 작업 브랜치 `codex/fix-public-auth-proxy`.
- 변경 파일: `apps/web/server.mjs`, `apps/web/tests/public-auth-proxy.test.mjs`, `docs/04_test_reports/C-21_PUBLIC_AUTH_PROXY_REPORT.md`.
- RED: 구현 전 `/auth/session` proxy 테스트가 404로 실패.
- GREEN: 구현 후 Node web test 15 passed, 0 failed.
- 오류 횟수: 동일 근본원인 정식 실패 0회(테스트 설계의 Host 전송 방식 보완 1회).
- 미검증: ysna 재배포 및 실제 NPM authenticated SSE.
- 다음 조치: Main Agent가 diff 검토·commit 후 exact release manifest/DeployApproval 갱신 및 승인된 배포 절차로 통합한다.
- 환경: 새 `D:\tmp` 리소스·외부 프로세스·포트·컨테이너·볼륨·네트워크 없음; 잔여 0건.

## C-21 공개 `anvil-web:3770` 배포 경로 진단 — 2026-09-02

- 담당: `diagnose_public_web_deploy` read-only subagent.
- 판정: `deploy/ysna/deploy.sh`는 `compose.internal.yml`의 `web`/`127.0.0.1:4173`만 배포하므로 공개 `anvil-web:3770` 이미지를 갱신하지 않는다.
- 공개 경로: `deploy/ysna/deploy-public-preview.sh` + `compose.public-preview.yml`; NPM은 기존 `anvil.sinsan.kr -> anvil-web:3770`을 사용한다.
- 필수 입력: full SHA와 `anvil-ui-preview-YYYYMMDD.N` release tag. 현재 `8ba679e72f53e20561e2063f3cdf01c10981a67b`에 결박된 공개 release tag가 없어 스크립트 실행 조건이 미충족이다.
- 변경 파일: `docs/04_test_reports/C-21_PUBLIC_WEB_DEPLOY_DIAGNOSIS.md`, `CODEX_WORK_LOG.md`.
- 오류 횟수: 동일 근본원인 정식 실패 0회. `rg.exe` stderr 인코딩 오류 1회는 조사 도구 문제이며 코드 실패로 집계하지 않음.
- 미검증: 공개 tag 생성/원격 push, ysna 공개 컨테이너 재배포·verify, NPM 공개 HTTPS.
- 외부 조치/승인 필요: exact tag 이름과 `8ba679e` 결박 tag의 GitHub 생성·push 승인, 이후 공개 deploy script 실행 승인. NPM/DNS 변경은 필요하지 않음.
- 임시 리소스: 새 `D:\tmp` 폴더·프로세스·포트·컨테이너·볼륨·네트워크 생성 없음; 기존 canonical worktree 보존, 잔여 0건.
- 다음 조치: exact release tag를 승인·생성한 뒤 ysna에서 `deploy-public-preview.sh <full-sha> <tag>`와 `verify-public-preview.sh <full-sha>`를 순서대로 실행한다.

## C-21 Unified Runtime 승인 대기 — 2026-09-02

- 담당: `unify_public_runtime` subagent, Main Agent 검토·통합.
- 구현: FastAPI ASGI가 3770에서 UI 정적 파일과 API/health/Telegram/SSE를 직접 제공하도록 1차 수직 슬라이스를 통합했다. 기존 Node proxy와 `ANVIL_API_UPSTREAM` 의존은 제거했다.
- exact commit: `a962bdfb6ba0e9c057907be8ee88909793bbf6ce`.
- 검증: `tests/api` 49 passed, 신규 동일 listener frontend 테스트 포함; compileall, `bash -n deploy/ysna/deploy-public-preview.sh`, `git diff --check` PASS.
- Manifest: `ReleaseManifest.json` source를 exact commit으로 갱신하고 `PENDING_APPROVAL`로 변경했다. 기존 C-21 DeployApproval binding은 승계하지 않는다.
- 운영 영향: public compose가 Python ASGI 단일 `anvil-web:3770`을 실행하며 runtime env/DB/Telegram 참조가 필요하다. 원격/NPM/DB 변경은 하지 않았다.
- internal 제거 조건: public 3770에서 API, health/readiness, Telegram signed ingress, provider capability, authenticated SSE 및 Last-Event-ID를 실제 검증하고 rollback 가능성을 확인한 뒤에만 `anvil-internal-web-1:4173`을 중지·삭제한다.
- 승인 대기: exact commit에 대한 신규 human DeployApproval binding과 표준 unified deploy 실행 승인이 필요하다.

## C-21 Unified Runtime R2 — 2026-09-02

- 담당: `unify_public_runtime` subagent, 단일 writer.
- 구현: FastAPI root StaticFiles mount 순서를 API route 뒤로 고정하고 동일 listener `/` + `/health/live` 회귀 테스트 추가. Python ASGI 이미지에 맞춰 public compose healthcheck를 stdlib urllib로 변경.
- 구현: 기존 `run_events` schema를 읽는 `PostgresEventStream(session_factory)` 추가. cursor 없음 sequence 0, 동일 run strict successor, unknown/cross-run cursor `SSE_CURSOR_INVALID` 409, JSON payload mapping. `create_runtime_app`에 기본 주입.
- 검증: focused tests 11 passed; compileall PASS; `bash -n deploy/ysna/deploy-public-preview.sh` PASS; `git diff --check` PASS.
- 범위 밖: real-time push, Telegram 추가 POST, remote/NPM/DB mutation, migration 생성 없음.
- 잔여: full suite, rollback/verify script unified 계약 검토, 실제 배포·운영 SSE 검증 후에만 internal 4173 제거.

## C-21 Unified Runtime R3 — 2026-09-02

- 담당: `unify_public_runtime` subagent, 단일 writer.
- 조치: verify를 same-listener `/health/live`, `/health/ready`, `/openapi.json`, `/auth/session` route existence, UI/HTTPS/security header 검증으로 정리. rollback을 compose project `anvil`, runtime env, 이전 Unified ASGI release 복구로 정리.
- 안전성: 이전 release 미기록 시 service 삭제를 거부한다. Node proxy, `ANVIL_API_UPSTREAM`, internal 4173 전제를 스크립트에서 제거했다.
- 검증: deployment contract/scripts 9 passed; 두 shell script `bash -n` PASS; `git diff --check` PASS.
- 범위 밖: real-time push, remote/NPM/DB/Telegram mutation, 운영 배포.

## C-21 Unified Runtime R4 — 2026-09-02

- 동일 실패 fingerprint `UNIFIED_HEALTH_SHADOWED_BY_ROOT_STATIC_MOUNT` 2회차 원인 확인: ASGI entrypoint에서 root StaticFiles mount가 health route보다 먼저 등록됨.
- 조치: `create_asgi_app()` factory로 명시적 health route 등록을 mount보다 선행하고 fresh import 회귀 테스트 추가.
- 검증: fresh import `/health/live` 200, `/health/ready` non-404, route order PASS; focused tests 2 passed, compileall PASS, diff-check PASS.
- 범위 밖: Telegram/remote/DB 변경 없음.

## C-21 NPM graceful reload / override migration R5 — 2026-09-02

- 담당: `unify_public_runtime` subagent, 단일 writer.
- 구현: public deploy 후 web healthy → Docker DNS `getent` IP와 `docker inspect` IP 동일성 → NPM `nginx -t` → graceful reload → 고유 public probe/log correlation 순서를 추가. 실패 시 rollback 시도 후 `INCIDENT_HOLD`.
- 구현: `remove-npm-telegram-override.sh` exact hash guard(`406052ff...1593cf`), backup, 제거, nginx test/reload; 실패 시 원본 restore와 test/reload. hash 불일치 exit 4 fail closed.
- 검증: deployment script tests 6 passed, `bash -n` 두 신규/변경 script PASS, diff-check PASS.
- 범위 밖: 실제 원격/NPM/DB/Telegram 변경, script execution, real-time push.

## C-21 NPM stale upstream DNS 진단 — 2026-09-02

- 담당: `npm_dns_refresh_design` read-only subagent.
- 판정: `anvil-web` recreate 후 NPM worker reload가 없어 literal `proxy_pass`가 이전 Docker IP를 유지할 수 있는 배포 순서 결함이다. Docker DNS의 현재 `getent` 정상 여부만으로 active worker routing은 증명되지 않는다.
- 실제 구조: NPM `nginx-proxy-manager`와 `anvil-web`은 `proxy-network`에 연결됨. NPM proxy host 8은 `/api`, `/health`, `/integrations`를 `anvil-web:3770`으로 전달한다.
- legacy override: `/data/nginx/custom/server_proxy.conf`, SHA-256 `406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf`, 145 bytes가 Telegram webhook을 `anvil-internal-web-1:4173`으로 직접 전달한다. 제거 전 Telegram PASS/internal 제거 금지.
- 영구 조치안: deploy script에 새 web health -> Docker DNS/IP 동일성 -> `nginx -t` -> graceful `nginx -s reload` -> 고유 public probe의 새 web log correlation을 포함한다. 실패 시 이전 release rollback 후 동일 reload/검증, 재실패 시 `DIR/INCIDENT_HOLD`.
- rollback: custom override는 exact hash guard와 Git versioned migration으로만 제거하고, runtime backup을 byte-identical 복원한 뒤 nginx test/reload한다. 임의 서버 patch 금지.
- 원격 조치: SSH/Docker/NPM은 읽기 전용 조사만 수행. NPM reload, 파일 변경, container recreate/removal, DB/Telegram mutation 없음.
- 오류 횟수: PowerShell/SSH quoting 오류 2회는 조사 도구 오류이며 운영 실패로 집계하지 않음. 동일 운영 root cause 수정 시도 0회.
- 임시 리소스: 새 `D:\tmp` 폴더·worktree·process·port·container·volume·network 생성 없음; 잔여 0건.
- 필요한 승인: 공유 NPM graceful reload와 exact custom override migration은 운영 설정 변경 승인 필요. exact unified release deploy/rollback 및 internal 제거는 DeployApproval/제거 승인에 결박.
- 상세: `docs/04_test_reports/C-21_NPM_DNS_REFRESH_DIAGNOSIS.md`.

## C-21 운영 migration/deploy 표준화 — 2026-09-02

- 담당: `developer-primary` 단일 writer; branch `codex/c21-production-migration-deploy`, 시작 HEAD `104f406d765c1efc57ad4db505a055c2d4035e0c`, clean.
- 구현: exact OCI commit label 검증 → DB exact 0011 guard → custom-format 전체 backup + `pg_restore -l` + SHA-256 → 같은 image로 explicit 0012 upgrade/postcheck → runtime/DNS/NPM/public readiness → guarded Telegram override removal 순서를 표준 public deploy에 추가했다.
- 실패 경계: 0012 성공 뒤 자동 downgrade 금지, previous application image만 rollback 시도, `INCIDENT_HOLD`, `anvil-internal-web-1` 보존. internal 제거 코드는 추가하지 않았다.
- TDD RED: 신규 executable pipeline 4건이 기능부재로 `4 failed`; rollback build가 새 revision을 상속하는 별도 RED `1 failed`.
- GREEN: 신규 pipeline `4 passed in 6.43s`; 전체 `tests/deploy` 최종 fresh `30 passed in 9.80s`; deploy/rollback/NPM removal `bash -n` 및 `git diff --check` PASS.
- 추가 수정: runtime alias read가 파일 내용을 반환하지 않던 redirection-only 결함과 rollback alias filename 순서 불일치를 회귀 테스트로 수정했다.
- 환경 오류: worktree `.venv` 전체 deploy suite는 PyYAML 미설치로 collection 중단. PyYAML 6.0.3이 설치된 기존 Anaconda Python으로 전체 suite를 재실행했다. production 동일 실패 0회.
- 외부 미실행: ysna/DB/NPM/Telegram/Provider/SSE와 internal 제거는 모두 `NOT_EXECUTED`.
- 임시 리소스: worktree/C:\\tmp의 C-21 pytest fixture 잔여 0건. container, volume, network, port 생성 없음.
- 상세: `docs/04_test_reports/C-21_PRODUCTION_MIGRATION_DEPLOY_IMPLEMENTATION.md`.
- Main review 보완: 실제 `alembic current`의 `0012_run_authority (head)`를 전체 문자열로 비교해 오탐하는 RED `1 failed`를 재현했다. 단일 nonempty line의 첫 token만 canonical revision으로 파싱하도록 수정 후 전체 `tests/deploy` `30 passed in 10.75s`, shell parse와 diff-check PASS.
- 정식 `FAILURE_REPORT` 1회차 재작업: 최초 승격에서 서버 old checkout을 신뢰하지 않고 target commit의 versioned bootstrap/deploy script를 추출·blob 검증·실행하도록 추가했다. main deploy script도 실행 중 파일 SHA-256과 target Git blob 내용 SHA-256이 다르면 배포 전 중단한다.
- backup 보완: 컨테이너 custom dump의 SHA-256과 `docker cp` 후 host retained dump SHA-256을 exact 비교한다. corruption 회귀 테스트가 migration 전에 차단됨을 확인했다.
- rollback 보완: previous SHA image의 OCI revision exact check, compose up, 30회 health wait/final healthy 확인 이후에만 current alias를 갱신한다. image mismatch/unhealthy에서는 기존 alias를 유지하고 nonzero 종료한다.
- TDD RED/GREEN: 최초 정식 RED `4 failed`(bootstrap 부재, copied backup corruption 미차단, rollback image mismatch 미차단, unhealthy alias 갱신). 보완 후 pipeline `8 passed in 14.18s`; 전체 `tests/deploy` fresh `34 passed in 16.46s`; bootstrap/deploy/rollback/NPM removal 4개 `bash -n` PASS.
- 오류 횟수: 정식 동일 lineage `FAILURE_REPORT` 1회. Windows Git Bash nested script path harness 오류 1회와 temp ACL 실행 오류는 제품 실패로 집계하지 않았고 `/usr/bin/bash` + `cygpath` 정규화 및 격리 basetemp로 해결했다. blocker 없음.
- 외부/미검증: ysna/운영 DB/NPM/Telegram/Provider 변경은 수행하지 않았다. ReleaseManifest/DeployApproval exact hash는 Main 통합 SHA 확정 후 갱신해야 한다. `anvil-internal-web-1` 제거 구현·실행 없음.
- 전체 deploy review 재작업 2차 / 신규 fingerprint `ROLLBACK_PREVIOUS_DOCKERFILE_NO_REVISION_LABEL` 1회: 실제 `0079699` Dockerfile에 OCI revision ARG/LABEL이 없으므로 previous checkout 뒤 compose build가 exact label 검증에서 항상 실패함을 확인했다.
- TDD RED: label 미지원 previous Dockerfile fixture에서 기존 rollback이 `rollback image revision does not match previous release`, exit 6으로 실패하는 `1 failed`를 재현했다.
- 조치: rollback 시작 시 현재 target HEAD의 versioned `Dockerfile.web`을 runtime temp로 추출하고 SHA-256 exact 검증한다. 이후 previous source를 checkout하여 보존 Dockerfile로 `docker build --build-arg ANVIL_RELEASE_COMMIT=<previous> --tag anvil-web:<previous12>`하고 compose up은 `--no-build`로 실행한다. OCI revision·health 성공 후에만 current alias를 갱신하며 temp Dockerfile은 trap으로 정리한다.
- GREEN: focused `1 passed in 1.21s`; pipeline `9 passed in 16.13s`; byte-exact Dockerfile source assertion 포함 최종 전체 `tests/deploy` fresh `35 passed in 20.27s`; bootstrap/deploy/rollback/NPM removal 4개 `bash -n` PASS. 제품 수정 시도 1회, blocker 없음.
- 외부/잔여: 운영 변경·이미지 build·배포는 실행하지 않았다. C:\tmp pytest fixture만 생성했고 종료 시 정리한다. 커밋 없음.

## C-21 exact release binding `5b0f338` — 2026-09-02

- 담당: `c21_release_binding_5b0f338` 단일 문서 writer.
- 작업 브랜치: `codex/c21-release-binding-5b0f338`; 시작 HEAD `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`, 시작 상태 clean.
- 배포 source: exact commit `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`, release tag 이름 `anvil-ui-preview-20260902.4`.
- 승인 계보: `docs/approvals/APPROVAL-20260902-C21-DEPLOY-001.md`에 `APPROVAL-20260902-C21-DEPLOY-007`을 append했다. canonical Run/Event migration 적용, NPM Telegram internal override backup/remove, `nginx -t`/graceful reload 및 전체 수직 검증 성공 후 조건부 internal 제거에만 결박했다.
- Manifest: `deploy/ysna/ReleaseManifest.C21.DRAFT.json`의 source commit/tag, migration head `0012_run_authority`, listener `anvil-web:3770`, authority·script/report hash를 갱신했다. 이 후속 manifest 문서 commit과 배포 source commit을 명시적으로 분리했다.
- 증거 경계: Provider non-billing probe, Telegram signed POST, authenticated SSE, `Last-Event-ID`, 운영 DB backup/migration, runtime/NPM 변경, internal 제거는 모두 `NOT_EXECUTED`로 유지했다.
- 변경 범위: ReleaseManifest draft, deploy approval 기록, 이 작업현황 파일만 수정했다. 운영 코드 수정 없음.
- 검증: JSON parse, exact commit/hash 대조, 승인 문구·binding 확인, release tag 미생성 확인, `git diff --check`가 모두 PASS다. scoped diff는 문서 3개만 포함한다.
- 외부 조치: tag 생성/push, commit, 운영 변경, secret 접근은 수행하지 않는다.
- release tag 충돌 정정: Main Agent의 원격 `git ls-remote --tags` 확인에서 `anvil-ui-preview-20260902.2`는 `a962bdfb6ba0e9c057907be8ee88909793bbf6ce`, `.3`은 `cb3afcdd5971c7497b4c0044d3ee52479c59da59`에 이미 결박되어 있었다. `anvil-ui-preview-20260902.4`는 원격 ref가 없어 C-21 source `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`용 tag 이름으로 정정했다. 이 writer는 원격 재조회·tag 생성·push를 수행하지 않았다.

## C-21 운영 배포 INCIDENT_HOLD 보완 — 2026-09-02

- 기준선: branch `codex/c21-deploy-incident-fix`, 시작 HEAD `13040fef646460e88bf8b47f54459cdce1855e62`, clean. 담당 `developer-primary` 단일 writer.
- 운영 FAILURE_REPORT 1회: backup과 DB `0012_run_authority` 적용, target container healthy 뒤 최초 public live curl 10초 timeout으로 `INCIDENT_HOLD`.
- backup: `/home/ubuntu/deploy/anvil/runtime/db-backups/anvil-20260902T111209Z-5b0f3389dd6f54d1f7606ac99a36d237feda7b60.dump`와 `.sha256` sidecar, `sha256sum -c OK`. 실제 hash 문자열은 미출력이라 기록하지 않았다.
- rollback compose fingerprint 1회: previous `8ba679e` legacy compose의 runtime env 누락과 preview upstream 상속으로 exact unified image에 `ANVIL_DATABASE_URL`이 주입되지 않아 unhealthy.
- 운영 복구: Main Agent가 exact target `5b0f338...` image/compose로 `anvil-web` healthy 복구. NPM_TO_WEB/local HTTPS/public live·ready·OpenAPI 모두 200. override backup SHA `406052ff...93cf`, 제거 후 `nginx -t`/graceful reload 성공. 전체 수직 검증 실패로 internal healthy 보존.
- 보완 구현: target versioned Dockerfile과 compose를 checkout 전에 temp exact 보존·SHA-256 검증하고 previous source direct build + preserved compose `--no-build` 기동. temp 2개 EXIT trap cleanup.
- probe 구현: public live/ready/OpenAPI는 connect 2초/max 3초/최대 5회/간격 2초, live log correlation은 최대 10회/간격 1초의 bounded retry. 모두 실패하면 기존 `INCIDENT_HOLD` 유지.
- TDD RED: 첫 timeout/지속 timeout/legacy compose env 누락 `3 failed`, 첫 log miss/지속 log miss `2 failed`로 합계 5건을 재현. GREEN focused `5 passed in 18.32s`, pipeline `14 passed in 38.35s`, 전체 `tests/deploy` fresh `40 passed in 41.96s`. shell 4개 `bash -n` PASS.
- 잔여 운영 검증 정정: Provider 5 healthy/4 unhealthy(UPSTAGE 401/GEMINI 400/OPENAI 401/OLLAMA timeout). fresh 담당자가 `2026-09-02T11:39:09Z` 공개 URL로 override 없이 Telegram POST를 정확히 1회 실행해 HTTP 200 `ACCEPTED`; post counts updates/audits/rate_limits 각 1, latest update/audit 11:39:09Z, NPM/app correlation 확인. pre-count psql capture는 stdin 오류로 누락되어 strict delta는 `UNKNOWN`, 재전송 0회·추가 POST 금지. auth session 201, SSE 200/event 0, Last-Event-ID 미실행.
- Telegram evidence binding 정정: 기존 400 파일 timestamp `2026-09-01T22:36:05Z`는 5b0 배포 `2026-09-02T11:12Z` 이전이므로 current 증거에서 제외하고 `HISTORICAL_UNBOUND`로 격리했다. full current revision `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`/healthy를 fresh 실행 시 확인했다.
- 도구 오류: fixture cleanup 출력용 `Test-Path` parameter typo 1회. 대상 제거는 먼저 수행됐고 후속 read-only 조회로 `C:\tmp\anvil-c21-operational-*` 잔여 0건 확인. 제품 실패 횟수에는 미포함.
- 외부 변경 경계: 이 코드 수정 작업에서는 운영/SSH/tag/commit/push/DB/NPM/Telegram/Provider 변경을 수행하지 않았다. 상세 `docs/04_test_reports/C-21_PRODUCTION_DEPLOY_INCIDENT_20260902.md`.

## C-21 final review rollback/public evidence 보완 — 2026-09-02

- 기준선: branch `codex/c21-deploy-incident-fix`, 시작 HEAD `71d0f6321d9bfba9a721df232d46134b11799bf4`, clean. 담당 `developer-primary` 단일 writer.
- TDD RED: rollback의 stale NPM DNS, persistent public probe failure, persistent log correlation failure 3건에서 alias가 잘못 갱신되고, 성공 순서에 DNS/nginx/public/log 검증이 없는 합계 `4 failed` 재현.
- 구현: previous container healthy 뒤 proxy-network IP와 NPM `getent` exact 비교 → `nginx -t` → graceful reload → bounded public rollback live probe → bounded container log correlation을 검증한 후에만 current alias 갱신. 각 실패는 nonzero이며 alias 유지.
- bounded 계약: public probe connect 2초/max 3초/최대 5회/간격 2초, log correlation 최대 10회/간격 1초. focused GREEN `4 passed in 10.28s`.
- R3 rollback 문서를 unified `anvil-web:3770`/`runtime/anvil.env`/versioned Dockerfile+compose 절차로 정정. legacy internal/preview upstream 복원은 rollback이 아님을 명시.
- Telegram evidence: raw command/response 및 wrapper numeric exit가 보존되지 않아 sanitized correlated self-report receipt만 생성. server-side NPM/application/DB correlation은 HTTP 200 `ACCEPTED`를 지지하지만 remote line 72 `unexpected EOF` 때문에 전체 검증 script 성공은 주장하지 않는다.
- redaction: secret, payload, identity, update_id, Authorization, signature 원문 미기록. receipt SHA-256을 R3 manifest에 결박했다.
- 최종 검증: deploy/rollback log fixture를 분리한 회귀 `1 passed in 6.48s`; 전체 `tests/deploy` fresh `44 passed in 58.80s`; shell 4개 `bash -n` PASS; receipt/manifest JSON parse 및 SHA-256 binding PASS.
- harness 오류 횟수: 동일 test harness 원인 2회. incident 뒤 실행되는 rollback log를 기존 deploy-only persistent flag/count가 함께 집계한 문제로, revision별 log call을 분리해 해결했다. 제품 실패 횟수에는 미포함, 3회 인수 조건 미도달.
- 외부 변경: 운영/SSH/DB/NPM/Telegram/Provider/tag/commit/push 모두 미수행.

## Canonical source migration — 2026-09-02

- 신산님 승인에 따라 `D:\Project\Anvil`을 canonical source로 확정했다. D root의 `AGENTS.md`, `packages/agent_team/`, `tests/agent_team/` dirty/untracked 보호 범위와 Desktop 원본은 변경하지 않았다.
- `origin/main`을 `13040fef646460e88bf8b47f54459cdce1855e62`로 fetch(무-prune)했고, Desktop local refs 40개(head 32/tag 8)를 D의 `desktop-migration/*` 격리 namespace에 import했다. 대상 ref pre-state absent, post-import full-SHA/object mismatch 0건이다.
- `D:\tmp\anvil-canonical-migration`/`codex/canonical-source-migration`을 최신 origin/main에서 생성하고, descendant 확인과 정확히 3개의 후속 commit 확인 뒤 `desktop-migration/codex/c21-deploy-incident-fix`를 `--ff-only`로 `7d4a15ab62860a38a82c6ef485b035b564f9dde0`까지 반영했다.
- 검증: JSON parse/checksum, 4개 shell `bash -n`, merged/working `git diff --check` PASS. `tests/deploy`는 D tmp에서 42 PASS/2 harness path-assumption FAIL(`/d`→`/c` only inverse conversion)이며 제품 script 전 failure다. 운영·브라우저·device 증거로 승격하지 않는다.
- 상세 ref/object/commit/temporary-resource/미수행 경계는 `docs/04_test_reports/CANONICAL_SOURCE_MIGRATION_20260902.md`에 기록했다. commit, push, main merge, Desktop 삭제는 아직 미수행이다.

## Canonical migration D-drive deploy test harness 보정 — 2026-09-02

- 오류 1회: `tests/deploy/test_public_deploy_pipeline.py`의 두 rollback fixture가 D tmp의 `/d/...` POSIX path를 Python `Path`로 재사용할 때 `/c/...`만 하드코딩 역변환하여 `FileNotFoundError`가 발생했다. 제품 deploy/rollback script 실행 전 test harness에서 발생했으며 Desktop/D root 보호 범위와 외부 시스템에는 영향이 없다.
- TDD RED: affected rollback 2건이 D tmp에서 재현 실패했고, C/D drive POSIX path contract를 먼저 추가하여 helper 부재 `NameError` RED를 확인했다.
- 조치: `_windows_path_from_posix()`가 drive letter를 일반화해 복원하도록 최소 helper를 추가하고, 두 hard-coded `/c/` replacement만 교체했다. 새 helper contract는 C와 D를 모두 고정한다.
- GREEN/회귀: focused 4 PASS, fresh `tests/deploy` 46 PASS(26 static + pipeline 20), JSON/checksum·4 shell `bash -n`·merged/working `git diff --check` 재검증 PASS. D tmp test resource는 각 run 종료 시 삭제하며 잔여 0건을 확인한다.
- 외부 변경: deploy, DB, NPM, Telegram, Provider, Browser, Desktop ref/file, push, main merge 모두 미수행.

## Canonical migration post-transfer actual state — 2026-09-02

- historical push snapshot: `origin/main`과 remote `codex/canonical-source-migration`이 모두 `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`이던 시점의 migration branch b9f0f44 push는 성공했다.
- `observed_before_this_document_commit`: `origin/main`은 `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`, remote `codex/canonical-source-migration`은 `45bb63b519195e52ffb70ef54028ff4527f5640c`이었다.
- authoritative current migration ref는 문서에 내장하지 않으며 `git rev-parse origin/codex/canonical-source-migration` 실행 결과다. 문서 commit push 뒤 값이 변할 수 있다. remote main은 문서 commit으로 fast-forward하지 않았으므로 `origin/main` `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`은 현 main 기준으로 유지한다.
- 이후 작업 기준은 `origin/main` `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`이다.
- D local `main` `c49b7534012d97ad130483c1ff255c0db1e99df4`는 stale이다. `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\ysna-internal-deploy`가 `main`을 점유하는 stale D worktree registry 때문에 `git branch -f main`은 거부됐다.
- Desktop 삭제·Git metadata 강제 제거는 하지 않았고 D root/Desktop의 보호 dirty·untracked를 보존했다.
- 다음 안전 조치: Desktop 폐쇄 완료 후 exact stale entry 검증 → prune/repair → D local main fast-forward 순서로만 처리한다. 현 단계의 강제 branch 이동/metadata 삭제는 금지한다.

## Canonical cleanup 완료 기록 — 2026-09-02

- 승인 범위: D canonical Git admin metadata cleanup만 수행했다. D root의 보호 dirty/untracked(`M AGENTS.md`, `?? packages/agent_team/`, `?? tests/agent_team/`)와 Desktop 실제 파일·`.git`은 변경하지 않았다.
- D stale worktree admin metadata `anvil-plan-common-api-menu-order`, `anvil-public-ui-preview-impl`, `ysna-internal-deploy`를 각각의 D admin `gitdir` → Desktop 대상 `.git` → Desktop `.git/worktrees/<name>` backlink → Desktop separate common-dir까지 exact 검증한 뒤에만 제거했다. D valid root metadata나 `.git/worktrees` 상위 디렉터리는 제거하지 않았다.
- 결과: `git -C D:\Project\Anvil worktree list --porcelain`의 Desktop worktree entry는 0건이다. Desktop 대상 `.git` backlink은 3개 모두 계속 존재한다. stale `main` lock 해제 후 local `main = origin/main = 3c4e115d9d4bb783a0277a185fd9cf1b3e32ad68`을 확인했다.
- migration cleanup: clean `D:\tmp\anvil-canonical-migration` worktree와 local/remote `codex/canonical-source-migration` branch를 비강제로 제거했다.
- 테스트 한계: latest code-bearing `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`의 fresh `tests/deploy` 46 PASS가 기존 증거이고 `b9f0f44..3c4e115`는 문서-only, 이번 cleanup은 metadata-only다. cleanup 중 재실행은 PyYAML 누락 collection 중단 뒤 임시 보완을 했으나 Codex 실행 시간 제한 때문에 pytest 하위 프로세스 종료 요약을 얻지 못했다. 시작한 정확한 프로세스만 종료했으며 이번 실행을 PASS로 기록하지 않는다.
- 외부 미수행: deploy, DB, NPM, Telegram, Provider, 브라우저, device 및 Desktop mutation은 모두 수행하지 않았다.
