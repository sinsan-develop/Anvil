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
