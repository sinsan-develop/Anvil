# F-15 완료보고 — 공통 운영 셸·Local stack·Web 보안

## 판정

`COMPLETED` — Developer 제품 exact scope의 구현과 Windows-local 기본 검증을 완료했다. 이후 Main은 제품 SHA `1d1fe19f7ba6d5492b3555ad5c4f809a6c60a7cd`로 WSL Compose/PG15·임시 headless 브라우저 및 별도 Windows Local SSH-tunnel 흐름을 실측했다. 아래 증거는 Main 제공 결과와 Developer 직접 실행 결과를 분리한다. F-16 staging·PG18 RC·ysna Production·사용자 인수는 이 판정에 포함되지 않는다.

## 기준·시작 상태

- Branch `codex/f15-common-shell-local-stack`, dispatch HEAD `58bdbd96d146932aac9bf48b78c5dd1d7967de5f`, 기준 main `41e7e06cb0f4e76a0d8be31cab24120a4b530420`. 시작 Git status clean, G-05 seq1468 PASS.
- 정본 SHA-256: 설계 `b0d89584f331c225bed07c1519ce56eb0d80b916207d21cfef0a91807d1df65d`, 계획 `a10a01759496511af32354bace84c1fcef135a57a07247a45b8228e2a1ce0477`, 매트릭스 `999a906ef7d69835ee8c5efafd9de72885bef5ab3c7a2c1b47b58d7a9628a0bb`, 테스트 `9a6afc5fcdd89c351d2d6e98551472ba362212c8c863e2542bfa93b1723da102`, governance `4aa7b81629924dc47519353cf396a7ff85bac8fb50f7a1b63d9f1337e8f6216e`.
- WorkInstruction `f4d757797f35f336ca33817dba4b6449835dc368839818d4d742cd7701e6181c`, invocation `826f93e05b5932767a43c1523972024c49614d17823bf8f802b46072f602475a`.
- actor `developer-primary-f15-r1`; 유효한 worker/write lease와 fencing token을 확인하고 exact19 허용 상한의 부분집합에서 단일 writer로 작업했다. 최초 Developer 인계 당시 제품 commit/push/PR/merge는 수행하지 않았으며 이후 Main이 제품 SHA `1d1fe19f7ba6d5492b3555ad5c4f809a6c60a7cd`를 만들었다.

## 판단 이유와 변경 전후

- 이전에는 dependency-free 정적 Web shell과 예약된 Worker·Compose만 존재했다. 이제 D4 React/TypeScript/Vite 운영 shell이 별도 `apps/web/console`에 존재하며, 기존 정적 `apps/web/index.html`, `server.mjs`, C28/C29/fixture 자료는 수정하지 않았다. 기본 메뉴 순서를 유지하지만 Dashboard 외 기능은 `PREPARING`으로 비활성화한다. 경로·권한·오류·미연결 상태를 정직하게 표시하며 브라우저 요청은 `/api/health/ready` same-origin 하나뿐이다. DB 이외 Queue/Worker/Provider 등은 미연결로 유지한다.
- ASGI의 기존 주입형 0013 seam은 역사 회귀용으로 보존했다. F-15 운영 flag가 켜진 host는 선언 기대 head를 0016으로 재설정하되, 실제 DB `alembic_version`, DB 접속, runtime refs를 독립 확인해야 READY다. `/api/health/ready`는 기존 readiness의 BFF alias다. 운영 host는 React `dist/index.html`이 없으면 404로 fail closed하며 이전 정적 shell로 우회하지 않는다.
- Worker는 DB 접속·0016 head에 대한 프로세스 경계만 확인하고 SIGINT/SIGTERM 정상 종료한다. Queue 수행·업무 준비를 주장하지 않는다. 오류 응답은 비밀 DSN을 내보내지 않는다.
- Local Compose는 Web만 loopback `127.0.0.1:8300`에 노출한다. API 8301/Worker는 외부 포트를 publish하지 않으며 DB 서비스를 만들지 않는다. 외부 DSN은 환경 주입 필수이다. 컨테이너의 `127.0.0.1`은 DB host가 아니므로 `host.docker.internal:host-gateway`를 API/Worker에 제공한다. 최초 WSL Compose의 host-gateway 직접 DB 경로는 기능 확인일 뿐 네트워크 보안 인수 증거가 아니다. 별도 Windows Local 검증은 전용 WSL DB/role과 SSH loopback tunnel을 사용했다. 공유 `local-postgres`의 기존 anvil DB는 수정 대상이 아니다.
- Vite 개발 proxy와 Nginx 운영 reverse proxy는 브라우저 `/api/...` same-origin을 유지한다. Nginx는 원 Host의 `:8300`을 `$http_host`로 보존해 기존 Origin 비교가 정상 동작하게 한다. 정적 CSP는 `connect-src 'self'`, fixture-workbench 경로는 404다. 기존 Web security 구현 파일은 결함 재현이 없어 변경하지 않았다.

실제 변경 경로: `package.json`, `package-lock.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/console/index.html`, `apps/web/src/console/main.tsx`, `apps/web/src/console/App.tsx`, `apps/web/src/console/app-shell.css`, `apps/api/anvil_api/asgi.py`, `apps/worker/anvil_worker/main.py`, `docker-compose.local.yml`, `deploy/local/Dockerfile.runtime`, `deploy/local/nginx.conf`, `apps/web/tests/f15-console.test.mjs`, `tests/integration/test_f15_local_stack.py`, `tests/api/test_f15_web_security.py`, 이 보고서. `packages/api/fastapi_app.py`는 허용 경로지만 변경 불필요.

## 실행 검증

| 실행 명령 | exit | 결과·증거 범위 |
|---|---:|---|
| `npm ci --ignore-scripts --no-audit --no-fund --cache <F15 임시 캐시>` | 0 | 고정 lock으로 Web 도구 설치 |
| `npm run web:test` | 0 | React shell Node 3 PASS |
| `node --test apps/web/tests/app-shell.test.mjs` | 0 | 기존 정적 shell 3 PASS |
| `npm run web:lint` | 0 | Biome 3 TS/TSX 파일, 오류 0 |
| `npm run web:typecheck` | 0 | TypeScript strict typecheck |
| `npm run web:build` | 0 | Vite 8.3.0, 17 modules, dist 생성; JS 224.75 kB (gzip 70.66 kB) |
| `D:\\tmp\\anvil-main-integration\\.venv\\Scripts\\python.exe -m pytest -q tests/api/test_runtime_app.py tests/api/test_web_security.py tests/api/test_public_asgi_frontend.py tests/api/test_f15_web_security.py tests/integration/test_f15_local_stack.py --basetemp=<F15 임시 경로>` | 0 | 최종 45 PASS, 기존 runtime/Web/ASGI 회귀와 F-15 경계 |
| `git diff --check` | 0 | 수정된 추적 파일 공백 오류 없음 |

TDD의 의도된 RED→GREEN 근거: 0016 운영 host readiness 503→200, React shell 모듈 부재→3 PASS, built frontend 인자/누락 fail-closed, Compose gateway 없음→계약 PASS, Nginx CSP/fixture 누락과 Host 포트 손실→security PASS, Biome a11y 지적→semantic span 수정 후 lint PASS. 이는 개발 중 의도한 RED이며 정식 `FAILURE_REPORT` 0회다. `rg.exe` 실행 불가 시 PowerShell `Select-String`으로 대체했고, Windows `docker` CLI 부재로 Compose build는 하지 않았다. 네트워크 제한으로 첫 npm 조회가 대기하여 취소한 뒤 승인된 공식 npm 조회·설치를 완료했다. 런타임/보안 회귀 잔여 실패는 0건이다.

## 미검증과 잔여 위험

- Main의 후속 WSL 실측에서 Web/API/Worker Up, root/ready 200, fixture 404와 브라우저 메뉴·네트워크 경계가 확인됐다. 다만 최초 Compose의 host-gateway 직접 DB 경로는 보안 인수 증거가 아니다. 기존 공유 PostgreSQL의 `0.0.0.0:5432` 노출은 F-15 이전부터 있던 위험이며 이번 작업으로 바꾸거나 방화벽 차단을 입증하지 않았다. direct WSL Compose 네트워크 제한이 검증됐다고 주장하지 않는다.
- Nginx를 통한 실제 인증된 mutation의 CSRF 동작은 아직 실측하지 않았다. `TestClient`의 synthetic Origin/Host/CSRF 거부와 side-effect 0은 별도의 로컬 계약 증거다. Playwright screenshot의 전송은 auto-review에 의해 차단됐고 우회하지 않았으므로 이미지 pixel QA는 미검증이다.
- Windows Vite 개발 서버는 generic SPA fallback 때문에 `/fixture-workbench`가 200을 반환했으나 fixture content는 포함하지 않았다. 이는 운영 Nginx/API의 fixture 404와 다른 경로·동작이며 dev proxy 404로 표시하지 않는다.
- F-16 정식 WSL staging, F-17 PG18 RC, F-18 ysna Production, U 메뉴 기능·사용자 인수, Provider 실호출: 범위 밖·미검증. 기존 WSL 공유 anvil DB head 0013은 F-15 운영 READY 증거가 아니다.
- Developer는 Windows Docker CLI가 없어 컨테이너를 직접 검증하지 않았다. Main의 WSL/Windows Local 실측과 정리는 아래 별도 증거로 기록한다. Developer 생성 `apps/web/dist`와 고유 pytest/npm 캐시는 정확한 경로 확인 후 삭제했다.

## 조치·rollback·상태

- rollback은 이 branch의 F-15 제품 diff를 병합하지 않거나, 병합 후 Git에서 정확한 F-15 commit만 revert하는 것이다. DB schema·공유 컨테이너·기존 정적 Web 파일에 변경은 없다. Local Compose 기동 자원은 Main이 정확한 project name과 QA DB/role로 식별해 정리한다.
- Developer는 제품 외 `docs/progress/build-progress.json` 및 `BUILD_HANDOFF.md`를 수정하지 않았다. Main이 독립 검토·실환경 증거·통합 결정을 반영한다.

## R2 Web 컨테이너 기동 재작업 — Main 제공 WSL 증거와 Developer 검증 분리

- Main 실측 대상 Git SHA `40b640a7fe906dae7255b53d72067f9c9d45c518`: WSL Compose build PASS, 격리 QA DB Alembic head `0016_operations_recovery` PASS, API/Worker Up. Web 컨테이너는 exit 1이며 Nginx log는 `[emerg] chown("/tmp/client_temp", 101) failed (1: Operation not permitted)`였다. 이는 F-15 전체 stack PASS가 아니다.
- 검토 결과, Web stage는 Nginx 이미지를 root 기본 사용자로 실행했고 Compose는 `read_only` 및 `cap_drop: [ALL]`이었다. Nginx의 tmpfs 소유권 조정이 허용되지 않는 조합이므로 제품 `deploy/local/Dockerfile.runtime`의 Web stage만 `USER 101:101`로 변경했다. Python runtime stage·Compose·공유 DB·Nginx 설정은 이번 재작업에서 변경하지 않았다.
- 회귀 테스트 `test_nginx_web_stage_runs_as_unprivileged_image_owner_for_read_only_compose`는 수정 전 exit 1/1 FAILED, 수정 후 `tests/integration/test_f15_local_stack.py` exit 0/9 PASS. 최종 관련 Python exit 0/45 PASS, React/legacy Node 각각 3 PASS, Biome lint/typecheck/Vite build 모두 exit 0. 이는 Docker 실제 기동 증거가 아니다.
- R2 인계 시점에는 수정 후 Web 이미지 build/up 및 HTTP/브라우저 경계가 미검증이었으나 이후 Main이 아래 R3에서 실측했다. R2 정식 `FAILURE_REPORT` 추가 0회; 기존 최초 Web 기동 실패는 Main 통합 실측 failure로 이력화했다.
- R2 Windows 재검증으로 생성된 `apps/web/dist`와 고유 pytest 임시 폴더를 정확한 대상 확인 후 제거했으며 잔류 0을 확인했다. R2 인계 시점 제품 미커밋 변경은 위 세 파일뿐이었다.

## R3 Main 제공 실제 환경 증거 — SHA 1d1fe19

- WSL-server 격리 QA PG15에서 `0016_operations_recovery`를 확인했다. Compose Web/API/Worker가 모두 Up이며 Web root 200, ready 200, fixture 404였다. 이는 최초 Web exit 1을 수정 후 재빌드·재기동으로 해소한 실측이고, 위 R2의 과거 실패 이력은 그대로 보존한다.
- Main의 임시 Playwright Chromium 실측: 1920×1080 및 390×844에서 메뉴 11개, same-origin 요청 4건, foreign 0건, 내부 API 직접 호출 0건, Secret 노출 0건, page error 0건. Screenshot 전송 차단으로 pixel QA는 수행됐다고 주장하지 않는다.
- 최초 Compose QA의 DB host-gateway 직접 경로는 security acceptance가 아니다. Main은 별도의 전용 WSL PostgreSQL role/DB `anvil_f15_tunnel_1db2060`을 SSH를 통해 만들고, Windows `ssh -L 127.0.0.1:15432:127.0.0.1:5432 WSL-server` loopback tunnel로 연결했다. Windows Alembic 0016, Worker `--check` ready, 백그라운드 Windows API/Worker/Vite(각 API 8301/Web 8300) 구동, Vite same-origin proxy의 READY 200 및 API fixture 404를 실측했다. Windows Vite 자체의 `/fixture-workbench` 200은 generic SPA fallback이며 fixture 내용은 없었다.
- Main은 F-15 테스트 프로세스·터널·QA DB/role·credential·log와 WSL 임시 QA 자원을 정확한 대상으로 정리하고 잔류 0을 확인했다. 기존 공유 PostgreSQL의 `0.0.0.0:5432` 노출은 변경하지 않았다. 위 Main 제공 결과에는 이 보고서 작성자가 실행하지 않은 명령의 exit code를 추정해 부여하지 않는다.
