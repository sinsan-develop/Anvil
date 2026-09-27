# F-18 R12 Auth Ingress Implementation Plan

> 담당: Main 통제 / `developer-primary` 단일 제품 writer. 승인된 F-18 제품 ingress same-origin 인증 경계만 보완한다.

**Goal:** Web Nginx image에서 `/auth/*` 요청을 같은 출처의 API upstream으로 전달하고 SPA fallback으로 반환하지 않는다.

**Architecture:** 기존 `deploy/local/nginx.conf`의 `/api/` location을 유지한 채 `/auth/` location을 병렬로 추가한다. `proxy_pass http://anvil-api:8301`과 기존 Host·X-Forwarded-For·X-Forwarded-Proto 전달 계약을 일치시키며 브라우저 코드, API route, Compose network, 인증 권한은 변경하지 않는다.

**Tech Stack:** Nginx pinned Web image, Python pytest, WSL-server Docker/HTTP.

**Spec:** `Anvil_작업계획서_v1.md` F-18, `F-18_WSL_OPS_WORK_INSTRUCTION.md` 단계3, `docs/WORK_STATUS.md`의 `F18_AUTH_INGRESS_PRODUCT_FIX_PENDING`.

## Global Constraints

- 단일 branch `codex/f18-wsl-ops`에서 로컬 개발·검증 후 Main이 `development`에 push하고 WSL-server가 exact Git SHA를 수신한다. 신규 branch/worktree·`ysna-server`·Production은 제외한다.
- 제품 exact3는 `deploy/local/nginx.conf`, `tests/integration/test_f15_local_stack.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. Main은 control/progress만 별도 소유한다.
- `/api/`, 정적 SPA, CSP, 기존 proxy header, API 인증·권한 동작을 유지한다. 브라우저에 upstream 주소를 노출하지 않는다.
- 로컬 구성 계약은 실제 WSL Web image의 HTTP 동작을 대신하지 않는다. 임시 WSL 자원은 사전 이름·소유·수명·정리 계획을 WORK_STATUS에 기록하고 정확한 대상만 제거한다.

## Review Focus

- `/auth/session/status`가 HTML SPA가 아니라 실제 API JSON을 반환하는가: 로컬 route 계약과 WSL 실제 HTTP 검증.
- 존재하지 않는 `/auth/` 경로가 index.html 성공으로 숨겨지지 않는가: WSL 404 및 content type 검증.
- 기존 `/api/` 요청이 같은 upstream으로 유지되는가: 로컬 기존 F-15 회귀와 WSL smoke.
- 브라우저 요청 URL이 same-origin이고 내부 Docker host·port가 노출되지 않는가: WSL 실제 Network/HTTP evidence.
- 무인증 세션이 인증된 것으로 오인되지 않는가: `/auth/session/status`의 실제 JSON `authenticated=false` 검증.

## Task 1: 제품 Web auth ingress

**Files:** Modify `tests/integration/test_f15_local_stack.py`, `deploy/local/nginx.conf`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** Nginx가 같은 Web origin의 `/auth/`를 기존 API service `anvil-api:8301`로 전달한다. API의 `/auth/session` 및 `/auth/session/status` JSON 계약을 그대로 사용한다.

- [ ] **Step 1: RED 회귀 추가.** F-15의 기존 compose/config 테스트 옆에 `/auth/` location의 동일 upstream·Host·X-Forwarded-For·X-Forwarded-Proto 계약과 `/api/` 유지가 깨지면 실패하는 좁은 테스트를 추가한다. 구성 검사는 실제 HTTP 증거가 아님을 테스트명·보고서에 명시한다.
- [ ] **Step 2: RED 실행.** `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp D:\Project\Anvil\.codex-sandbox\anvil-main-integration\.pytest-f18-r12-local tests/integration/test_f15_local_stack.py -k auth_ingress`에서 `/auth/` 누락으로 FAIL을 관측한다. temp 경로는 생성 전 부재 확인한다.
- [ ] **Step 3: 최소 구현.** `deploy/local/nginx.conf`의 기존 `/api/` location 뒤에 아래 location만 추가한다. 다른 route/header는 수정하지 않는다.

```nginx
location /auth/ {
    proxy_pass http://anvil-api:8301;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- [ ] **Step 4: GREEN 및 회귀.** focused RED 명령 재실행, `tests/integration/test_f15_local_stack.py tests/api/test_runtime_app.py tests/api/test_local_session.py` 실행, `npm run web:typecheck`, `npm run web:build`, `git diff --check`; 전체 pytest도 시도하고 기존 수집 오류와 새 실패를 분리 기록한다. Windows pytest temp ACL 우회는 작업공간 내 새 전용 `--basetemp`만 사용하며 정확한 경로를 확인해 정리한다.
- [ ] **Step 5: 제품 증거.** 보고서에 시작 HEAD/branch/status, 기준 hash, 변경 diff, RED/GREEN 명령·exit·실제 결과, 회귀·미검증, 기존 동작과 rollback을 기록한다. exact3만 clean commit한다. Main은 독립 diff/테스트 후 원격 push한다.

## Main WSL-server 검증·종료

- [ ] 게시 exact SHA의 전용 clean detached checkout에서 Web/runtime image를 빌드하고 실제 ID·OCI revision을 기록한다. 기존 서비스·DB/Secret을 변경하지 않는 전용 network/container/API test route를 사용한다.
- [ ] Web host의 `/auth/session/status`가 JSON `authenticated=false`이고 `/auth/not-found`가 SPA HTML이 아닌 API 404인지, 기존 `/api/` 경로가 유지되는지 실제 HTTP로 확인한다. 내부 주소의 브라우저 노출 여부도 관측한다.
- [ ] 제품 QA, 독립 검토, G-05 후 worker/write lease를 순서대로 회수한다. 전용 container/image/checkout/임시 자료의 exact 소유·ID를 확인해 정리·잔류0을 기록한다. F-18 전체 인수와 F-19 시작은 별도 전체 Gate까지 보류한다.

## Rollback

R12의 제품 exact3 commit만 revert한다. R11 및 이전 제품·공유 WSL 서비스/DB는 변경하지 않는다.
