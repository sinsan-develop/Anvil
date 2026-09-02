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
