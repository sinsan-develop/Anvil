# C-21 Dashboard Shell Progress

## 2026-09-09 — TDD RED started

- Package: C-21 Dashboard Shell (`codex/c21-wsl-acceptance-auth-r1`, `0f770e4`)
- Changed files: `apps/web/tests/app-shell.test.mjs`, `tests/api/test_public_asgi_frontend.py`, this progress file
- RED: `node --test apps/web/tests/app-shell.test.mjs` exit 1; missing `app-shell-model.js` was the expected pre-implementation failure. API RED could not run because this worktree has neither a Python executable nor a configured `py` default.
- Error count: 0
- Unverified: full web/API regression, browser rendering, WSL/remote/DB/container; excluded by work instruction.
- Next: execute focused RED, confirm missing Dashboard Shell contract, then minimally implement the approved files.

## 2026-09-09 — GREEN and local verification

- Changed files: `apps/web/index.html`, `apps/web/provider-workbench.html`, `apps/web/server.mjs`, `apps/web/src/app/app-shell.js`, `apps/web/src/features/app-shell/app-shell-model.js`, `apps/web/src/styles/app-shell.css`, `apps/web/tests/app-shell.test.mjs`, `apps/web/tests/ui-preview-runtime.test.mjs`, `tests/api/test_public_asgi_frontend.py`, this progress file.
- GREEN: `node --no-warnings --test apps/web/tests/app-shell.test.mjs` → 3 passed; `node --no-warnings --test apps/web/tests/*.test.mjs` → 24 passed.
- Static checks: `git diff --check` exit 0; browser source host scan (`localhost|127.0.0.1|anvil-api|shared-db|https?://`) exit 0.
- Error count: 0 formal implementation failures. The initial all-web regression exposed the obsolete root-workbench expectation once; its test was revised to the approved Dashboard/Provider split and then passed.
- Unverified: `py -m pytest tests/api/test_public_asgi_frontend.py -q` cannot run because no default Python is installed in this worktree; actual browser rendering and `/health/ready` response remain unverified. WSL/remote/DB/container work was not performed by scope.
- Next: review exact diff and stage only the listed Dashboard Shell files for the required local commit.

## 2026-09-09 — Reviewer rework round 1

- Scope: reviewer-required Dashboard Shell corrections only; no WSL, remote, DB, container, Provider, or migration action.
- Changed files: `apps/web/index.html`, `apps/web/src/app/app-shell.js`, `apps/web/src/features/app-shell/app-shell-model.js`, `apps/web/src/styles/app-shell.css`, `apps/web/tests/app-shell.test.mjs`, this progress file.
- RED: `node --no-warnings --test apps/web/tests/app-shell.test.mjs` first failed because `DASHBOARD_OPERATIONS` was absent; after browser observation exposed English property-name headings, the strengthened contract then failed on the missing `DASHBOARD_OPERATION_DEFINITIONS` export. Both failures were expected pre-implementation contract gaps.
- GREEN: focused app-shell test 3 passed; full Web test suite `node --no-warnings --test apps/web/tests/*.test.mjs` → 24 passed; `git diff --check` and browser-source host scan passed.
- Browser evidence: local static server at 430px yielded `clientWidth=415`, `scrollWidth=415`; sidebar collapse changed `aria-expanded` true→false and button name to `메뉴 펼치기`, then restored the menu. The expanded menu retained all names; PREPARING items had `aria-disabled=true`, `tabindex=-1`, and no `href`. With no local `/health/ready` route, Database changed to truthful `NOT_CONNECTED`/`FAILED` rather than a success state.
- Error count: 0 formal implementation failures; two expected RED contract gaps resolved. Operations exact set is now 실행 중/승인 대기/BLOCKED/필수 Gate 미통과/예상 비용 초과/baseline 충돌; `failedRuns` is removed. Health cards expose icon, status, short explanation, last checked, error count, and an explicitly unavailable detail-link field.
- Unverified: Python API pytest remains unavailable because no default Python is installed; a successful real `/health/ready` response, WSL/remote/DB/container remain unverified by scope.
- Next: stage only rework files, run staged verification, and commit the reviewer rework.

## 2026-09-09 — Main 검증 및 독립 재검토

- Main API 회귀: 검증된 Anvil venv로 `pytest -p no:cacheprovider` 관련 API 6파일 실행 → `71 passed in 5.09s`.
- Main Web 회귀: `node --no-warnings --test apps/web/tests/*.test.mjs` → `24 passed`, 실패 0.
- Main diff: `git diff --check` → PASS.
- 독립 Reviewer 재검토: `ACCEPTED`, Critical 0 / Important 0 / 비차단 Minor 1.
- 독립 Chromium 430×932: `clientWidth=scrollWidth=430`, menu 11, health 6, operations exact 6, collapse/restore와 ARIA 상태 PASS.
- 비차단 Minor: 430px 검증이 repository 자동 browser regression suite에는 아직 편입되지 않았으며 이번 scoped acceptance에서는 수동 독립 증거로 보존.
- 다음 조치: exact commit을 development candidate ref로 push하고 WSL-server의 정식 `anvil-web` 하나에 Git 배포하여 `/` Dashboard, `/provider-workbench.html`, health를 실제 브라우저/API로 검증한다.

## 2026-09-09 — WSL 정식 단일 컨테이너 배포 시작

- 배포 대상: host `SINSAN`, Git exact commit `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`, 정식 container `anvil-web` 1개.
- 사전 관측: application checkout HEAD `70ddf09257131b82490bab5ec86192b7631674b3`; 기존 `anvil-web`은 `0.0.0.0:3770->3770`, `proxy-network`, `host.docker.internal:host-gateway`, restart `unless-stopped`를 사용.
- 오류 1회 (`PLATFORM_SECRET_BROAD_COLLECTION_REJECTED`): 기존 container 전체 Env를 root-only 임시 파일로 복사하는 명령이 광범위 자격정보 수집 위험으로 플랫폼 안전 게이트에서 실행 전 거부됨. 외부/서버 상태 변경 0. 전체 수집은 재시도하지 않고 배포에 필요한 exact allowlist 환경변수만 값 미출력으로 보존하는 방식으로 축소.
- 현재 상태: preflight 진행 중. Provider/Telegram 외부 호출과 mutation은 수행하지 않음.
- 다음 조치: remote/ref 확인 → exact commit fetch/clean detached checkout → allowlist env 보존 → image build → 기존 배치 속성과 동일하게 단일 container 교체 → read-only 검증.
- 오류 1회 (`WSL_DOCKERFILE_PATH_MISTAKE`): `deploy/ysna/Dockerfile`을 조회했으나 실제 경로는 `deploy/ysna/Dockerfile.web`이어서 명령이 실패함. 조회-only 단계라 상태 변경 0이며, exact tree 확인 후 올바른 경로로 정정. 앞선 플랫폼 거부와 다른 근본 원인.
- Git remote: candidate exact commit은 `refs/heads/candidates/c21-wsl-acceptance-auth-r1`에서 확인·fetch됨.
- Secret 보존: 승인된 allowlist 14개 변수만 `/root/anvil-web-approved-env.c21-dashboard`에 mode `600`으로 보존. 값·길이·hash는 출력하지 않음.

## 2026-09-09 — WSL 배포 실행 및 takeover 경계

- Git: `/srv/anvil-wsl/repo`를 clean detached `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`로 checkout.
- Image build: `deploy/ysna/Dockerfile.web`, build arg `ANVIL_RELEASE_COMMIT=7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`; 성공.
- 새 image: `sha256:83f2c7b879c65a0f0c571acfcbf114c913b1d53631e7de880f0ec3ffe146db25`, `amd64`, revision label exact `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`.
- 교체: 기존 `anvil-web`을 제거하고 새 image로 exact name `anvil-web`, `0.0.0.0:3770:3770`, `proxy-network`, `host.docker.internal:host-gateway`, restart `unless-stopped`, 승인 allowlist env-file을 사용해 기동 성공. 새 container ID `cb9ba3c39bc769a8f51a1ffbd32f973c7be21ae73d5114e00e5a54627848cf12`.
- 초기 관측: `/` 200(Dashboard HTML), `/health/live` 200, `/health/ready` 200(`0013_task_bootstrap_authority`). 단, 아래 quoting 오류가 섞인 명령 출력이라 독립된 깨끗한 재검증 필요.
- 오류 2회 추가 (`POWERSHELL_WSL_QUOTING_COLLISION`, 누적 3): 1) clean 검사 command substitution이 Windows PowerShell에서 먼저 평가되어 build 전 중단, 2) read-only curl의 literal `*`가 WSL 전달 경계에서 checkout 파일명으로 확장되어 불필요한 로컬 DNS 실패 요청과 noisy output 발생. Provider/Telegram 호출 및 mutation은 없었음. 동일 근본원인 3회 규칙에 따라 추가 WSL 명령 중단.
- Rollback: 새 컨테이너 기동 및 root/live/ready 200 관측으로 실행하지 않음. 기존 rollback image는 `sha256:b3f6653b665553b85ab3ac9d558c52e964b2e5adf70e63f1c52062fbf28a5b53`.
- 남은 검증: exact container/image/revision 및 단일 container count, `/provider-workbench.html`, `/auth/session/status`, `/api/providers` canonical 9개, formal run `c21-wsl-run` SSE initial/Last-Event-ID, root-only env-file 삭제.
- 상태: `INCOMPLETE_TAKEOVER_REQUIRED`. Main agent가 `$`/glob/복합 shell 없는 단일 리터럴 명령으로 남은 read-only 검증과 임시 env-file 삭제를 인수해야 함.

## 2026-09-09 — Main takeover 및 WSL 수직 검증 완료

- Takeover: 동일 `POWERSHELL_WSL_QUOTING_COLLISION`이 Subagent에서 3회 누적되어 운영 규칙에 따라 Subagent의 추가 WSL 명령을 중단하고 Main Agent가 인수했다.
- Runtime: `docker ps --filter name=anvil-web`에서 정식 container `anvil-web` 1개, image `anvil-web:7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`, `0.0.0.0:3770->3770/tcp`, 실행 상태를 확인했다. build 단계에서 OCI revision label도 exact `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`로 확인됐다.
- HTTP: WSL 내부에서 `/` 200, `/provider-workbench.html` 200, `/health/live` `{"status":"ok"}`, `/health/ready` `{"status":"ready","migration_head":"0013_task_bootstrap_authority"}`를 확인했다.
- Auth/Provider: `http://172.27.253.53:3770/auth/session/status`는 `authenticated=true`, `mode=WSL_ACCEPTANCE`, `actor_role=wsl_acceptance_reader`; read-only `/api/providers`는 canonical 9개를 반환했고 UPSTAGE만 primary이며, 외부 Provider probe 없이 모든 credential은 `MISSING`, health는 `NOT_CHECKED`로 진실하게 표시됐다.
- Browser Dashboard: in-app browser 실제 배포 화면에서 `Anvil Dashboard`, 11개 메뉴, Health 6개, 운영 상태 exact 6개, Database `READY`/migration `0013_task_bootstrap_authority`, 나머지 미연결 read model의 `UNAVAILABLE` 표시를 확인했다.
- Browser Provider Workbench: `/provider-workbench.html`에서 `WSL_ACCEPTANCE · wsl_acceptance_reader`, canonical 9개 Provider, `READY`, UPSTAGE PRIMARY를 확인했다.
- Authenticated SSE: Provider Workbench에서 formal run `c21-wsl-run`을 연결해 `CONNECTED`, Last Event ID `c21-wsl-event-1`, `1개 Event를 확인했습니다.`를 확인했다. 같은 버튼으로 재연결해 저장 cursor가 전송된 뒤 `새 Event가 없습니다.`를 확인하여 Last-Event-ID 재개를 검증했다.
- Secret cleanup: allowlist 보존에 사용한 root-only `/root/anvil-web-approved-env.c21-dashboard` 파일을 정확한 경로로 삭제했고 `test ! -e` exit 0으로 잔여 없음 확인. secret 값·길이·hash는 출력하지 않았다.
- External side effects: Telegram 실제 호출, Provider 외부 호출, Provider mutation, DB write, 추가 container 생성은 수행하지 않았다.
- Main 인수 중 실행 오류: Windows sandbox에서 WSL IP 직접 curl 6건이 연결 거부됐으나 WSL 내부와 in-app browser가 같은 endpoint에서 성공해 runtime 장애가 아닌 실행 경계로 판정했다. Docker Go-template format 명령 5건은 PowerShell 인용 충돌로 실패했으며 plain `docker ps`와 build evidence로 대체했다. SSE 본문 direct curl 1건은 플랫폼 안전 게이트가 인증 없는 조회로 판정해 실행 전 거부했으며, 설계된 `WSL_ACCEPTANCE` authenticated browser UI 경로로 수행했다.
- 최종 판정: `COMPLETED` — Dashboard Shell의 승인 범위 구현, exact Git 배포, 정식 단일 WSL runtime, UI·health·Provider read API·authenticated SSE·Last-Event-ID 수직 검증 완료. 전체 U-01 데이터 연결과 전체 프로젝트 완료를 의미하지 않는다.
