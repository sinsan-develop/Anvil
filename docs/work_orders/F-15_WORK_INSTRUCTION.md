# F-15 WorkInstruction — 공통 운영 셸·Local stack·Web 보안

## 기준과 경계

- 승인된 `Anvil_작업계획서_v1.md` F-15만 수행한다. 기준 main `41e7e06cb0f4e76a0d8be31cab24120a4b530420`, branch `codex/f15-common-shell-local-stack`. F-14 PR #30은 main 병합·검증·branch/worktree 정리 완료했다.
- 설계 D4의 React + TypeScript + Vite를 운영 Web Console 기준으로 구현한다. 기존 정적 `apps/web/index.html`, `server.mjs`, C28/C29/fixture 경로는 회귀 자료로 보존하고 운영 화면의 실제 성공 증거로 승격하지 않는다.
- Main 어울은 설계·범위·lease·WSL/browser 실제 검증·독립 검토·PR 통합을 소유한다. Developer는 아래 제품 경로에만 유효한 worker/write fencing token으로 단일 writer 작업한다.
- F-15는 메뉴별 업무 기능을 만들지 않는다. U 단계 화면을 선행 구현하거나 Provider·ysna 운영 배포를 하지 않는다.

## 제품 write scope

- `package.json`, `package-lock.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`
- `apps/web/console/index.html`, `apps/web/src/console/main.tsx`, `apps/web/src/console/App.tsx`, `apps/web/src/console/app-shell.css`
- `apps/api/anvil_api/asgi.py`, `packages/api/fastapi_app.py`, `apps/worker/anvil_worker/main.py`
- `docker-compose.local.yml`, `deploy/local/Dockerfile.runtime`, `deploy/local/nginx.conf`
- `apps/web/tests/f15-console.test.mjs`, `tests/integration/test_f15_local_stack.py`, `tests/api/test_f15_web_security.py`
- `docs/04_test_reports/F-15_COMPLETION_REPORT.md`

파일 경로를 늘려야 하면 mutation 전에 Main에 근거와 정확한 경로를 보고한다. Main은 기능·요구사항·중요 위험 변화가 없는 내부 배치 조정만 revision/hash/lease에 반영할 수 있다.

## 구현·검증 계약

1. React/TS/Vite 운영 셸은 sidebar/header/route boundary/권한·오류·미연결 상태를 정직하게 표시한다. 준비 전 메뉴를 활성 기능처럼 보이지 않게 하고 기존 메뉴 순서를 보존한다. 접근성·반응형 기본 계약을 유지한다. 준비 상태는 `/health/ready` 같은 same-origin 상대 경로로만 조회하고 실제 read model 없이 READY나 데이터처럼 표현하지 않는다.
2. Local Windows에서 Web/API/Worker 개발 프로세스를 실행할 수 있어야 한다. Web 8300, API 8301; 브라우저에는 내부 API·DB 주소와 Secret을 노출하지 않는다. Vite 개발 proxy와 운영 reverse proxy/BFF가 API를 same-origin으로 제공한다. 배포용 정적 build는 ASGI 또는 nginx 경로와 계약을 맞추고 QA fixture를 운영 root에 자동 노출하지 않는다. 기존 API/fixture 회귀를 보존한다.
3. F-14 migration head `0016_operations_recovery`와 실제 DB head가 다르면 readiness는 fail closed다. DB 미접속·runtime refs 누락은 READY가 아니다. Worker는 안전한 시작/종료 경계와 health 증거를 제공하되 큐 업무를 새로 구현하지 않는다.
4. Docker/PG는 WSL-server에서만 사용한다. 기존 `local-postgres`의 다른 프로젝트 데이터·role·컨테이너를 변경하지 않는다. F-15 검증은 Anvil 전용 PG15 DB/role을 최소권한으로 격리하고, 외부 직접 포트 대신 SSH tunnel 또는 확인된 네트워크 제한을 쓴다. QA용 임시 DB/role/container/profile은 이름·수명·정리를 `WORK_STATUS`에 기록하고 종료 후 정확한 대상만 제거·잔류 0 확인한다. 별도 지속 개발 DB 설정이 필요하면 Main이 기존 문서·권한 경계를 먼저 확인한다.
5. 기존 CSRF token/Origin/Host 사전 거부, CSP, CORS deny, cookie, proxy trust와 안전한 오류 처리를 회귀 시험한다. 결함이 실제 재현되지 않으면 해당 보안 코드를 변경하지 않는다. 실제 브라우저 Network에서 localhost·내부 컨테이너명·내부 API 포트 직접 호출 및 Secret이 각각 0건인지 확인한다.
6. TDD로 로컬 unit/integration, TypeScript typecheck, lint/build, 기존 관련 회귀를 실행한다. Main은 Git exact SHA를 WSL-server에서 fetch해 격리 Docker/PG15와 임시 headless 브라우저로 AV-OPS-014, AV-SAFE-029, AV-UI-010/012를 실측한다. fixture/mock/build 결과를 실제 DB·브라우저 PASS로 승격하지 않는다. F-16 정식 WSL staging 배포, F-17 PG18 RC, F-18 ysna 및 U 메뉴 기능은 미검증으로 분리한다.

## 보고

- 시작 HEAD/status와 정본 SHA, 변경 전후 diff·exact 경로, 명령/exit/결과, 정식 실패 횟수, 독립 검토 전 미검증, 자원 잔류, rollback, progress/HANDOFF 반영 여부를 판정→근거→조치 순으로 기록한다.
- 신규 공개 API/데이터 계약, DB schema, 인증·Secret·권한, 운영 배포, 비용·파괴적 조치가 필요하면 실행하지 말고 Main에 증거와 범위를 전달한다.
