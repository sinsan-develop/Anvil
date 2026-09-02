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
