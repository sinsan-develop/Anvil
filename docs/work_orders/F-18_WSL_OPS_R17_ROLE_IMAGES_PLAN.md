# F-18 R17 Web/API/Worker Role Images Implementation Plan

> 담당: Main 통제·WSL-server 실측 / `developer-primary` 단일 제품 writer. 승인된 F-18 단계1의 세 역할 image digest 결박 준비에 한정한다.

**Goal:** 승인 Git revision 하나에서 Web·API·Worker의 구분된 OCI image 세 개를 재현 가능하게 빌드하고 각 역할의 실제 image ID·revision을 관측할 수 있게 한다.

**Architecture:** 기존 `deploy/local/Dockerfile.runtime`의 잠금파일 기반 Web build와 Python runtime 패턴을 WSL 전용 `deploy/wsl/Dockerfile.f18`의 `web`, `api`, `worker` target으로 분리한다. Web은 정적 bundle+기존 same-origin Nginx, API는 FastAPI runtime, Worker는 Worker process만 담는다. 기존 F-16/F-17 `deploy/wsl/Dockerfile.web`, local Dockerfile/Compose, 운영 경로는 변경하지 않는다.

**Tech Stack:** pinned Node 22.23.0/Python 3.12.8/Nginx 1.28.3 base image digest, npm lockfile, pip pinned runtime requirements, Docker/pytest.

**Spec:** `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md` 단계1·제품 write 상한, `Anvil_설계서_v2.md` §49.8·§49.11~49.13.

## Global Constraints

- 기존 단일 branch `codex/f18-wsl-ops`와 격리 checkout만 사용한다. Main이 로컬 검증·push한 정확한 SHA를 WSL-server가 Git으로 수신한다. `ysna-server`·Production·새 branch는 제외한다.
- 제품 exact4: `deploy/wsl/Dockerfile.f18`, `deploy/wsl/Dockerfile.f18.dockerignore`, `tests/deploy/test_f18_role_images.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main은 control/progress를 별도로 소유한다.
- 새 image는 build artifact일 뿐 배포 승인·실행 capability가 아니다. `org.opencontainers.image.revision`이 Git SHA와 달라도 빌드가 성공으로 보일 수 있으므로 실제 inspect에서 일치해야 한다.
- 브라우저는 Web same-origin `/api/`·`/auth/`만 사용한다. API/Worker image는 browser 공개 포트·Web bundle·임시 Secret을 포함하지 않는다. 기존 로컬/WSL/운영 Dockerfile과 인증·권한·DB·공개 API를 바꾸지 않는다.

## Review Focus

- Web target이 실제 정적 bundle과 기존 `/api/`·`/auth/` Nginx proxy를 갖고, API/Worker source를 포함하지 않는가.
- API target이 ASGI import를 제공하고 Worker source를 포함하지 않는가.
- Worker target이 process import/`--check` 경계를 제공하고 Web/API source를 포함하지 않는가.
- 세 target 모두 같은 Git revision label을 갖고 서로 다른 실제 image ID인가.
- Docker build context가 `.git`, 임시 cache, `.env`/Secret을 전송하지 않는가.

## Task 1: 역할별 build artifact

**Files:** Create `deploy/wsl/Dockerfile.f18`, `deploy/wsl/Dockerfile.f18.dockerignore`, `tests/deploy/test_f18_role_images.py`; modify `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** Docker `--target web|api|worker --build-arg ANVIL_RELEASE_COMMIT=<exact SHA>`; image label `org.opencontainers.image.revision=<exact SHA>`. 기존 `deploy/local/nginx.conf`, `package-lock.json`, `deploy/wsl/requirements-runtime.txt`를 읽기 전용 입력으로 사용한다.

- [ ] **Step 1: RED.** 새 테스트에서 Dockerfile의 세 final target, exact revision label, Web 정적 build+Nginx proxy, API/Worker 최소 source, pinned base digest, ignore 규칙을 검사한다. 파일이 없으므로 먼저 실패해야 한다. 실제 Docker build를 통과했다고 주장하지 않는다.
- [ ] **Step 2: 최소 구현.** Node build는 `npm ci --ignore-scripts --no-audit --no-fund` 후 `npm run web:typecheck && npm run web:build`; Web final은 고정 Nginx digest와 bundle/config만 복사한다. Python dependency stage는 현재 pin 파일로 venv를 만들고, API final은 `packages`, `apps/api`, migration·설정만, Worker final은 `packages`, `apps/worker`만 복사한다. 각 final target은 고정 SHA `ARG`·OCI label, non-root user와 명시적 entrypoint를 가진다. Dockerfile-specific ignore는 `.git`, `.env*`, Python/Node cache, local build 산출물·QA temp를 제외한다.
- [ ] **Step 3: GREEN 및 회귀.** 새 테스트와 `tests/integration/test_f15_local_stack.py`, F-17/F-18 배포 계약을 로컬 전용 pytest temp에서 실행한다. Web typecheck/build, `git diff --check`, 정확한 변경 경로를 확인한다. 전체 pytest 수집/실행 실패는 별도로 기록한다.
- [ ] **Step 4: 제품 보고·commit.** exact4의 RED/GREEN·명령/exit, 빌드 미실행 범위, rollback(이 exact4 commit revert)을 보고서에 기록하고 exact4만 clean commit한다. Main은 독립 검토 후 기존 SSH alias로 push한다.

## Main WSL-server image 검증

- [ ] 생성 전 전용 checkout/image tag/cache 이름·수명·정리 계획을 `docs/WORK_STATUS.md`에 남기고 공유 서비스·자원을 inventory한다.
- [ ] 게시 exact SHA의 clean detached checkout에서 세 target을 제한 자원·`--pull=false`로 각각 build한다. image ID 세 개의 구분, OCI revision·OS/arch·실제 target source/entrypoint를 inspect한다. Web 정적·API/Worker import/최소 동작을 전용 일회성 container에서 검사한다. 이는 실제 운영 유사 target의 DB/OIDC/network/rollback PASS가 아니다.
- [ ] 전용 image/container/checkout만 ID·label·realpath로 확인해 정리하고 잔류0 및 기존 서비스 불변을 증명한다. independent review와 G-05 후 worker/write lease를 회수한다.

## Rollback

R17 exact4 제품 commit만 정상 revert한다. 기존 F-16/F-17/local Dockerfile, 공유 WSL 서비스·DB, Production은 변경하지 않는다.
