# UNIFIED_DEPLOY_SCRIPTS 작업현황

- 일시: 2026-09-01 (Asia/Seoul)
- 작업 위치: `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\anvil-web-unified-deploy`
- 브랜치 / 시작 HEAD: `codex/anvil-web-unified-deploy` / `58f0cb30c3197956e71c5acc7fe6219333d121b9`
- 판정: `COMPLETED`

## 판단 이유

- `deploy/ysna/compose.public-preview.yml`에 깨진 `` `n `` 문자열이 들어 있어 YAML 파싱이 실패했고, 배포 계약 테스트도 이 지점에서 실제로 깨졌다.
- public-preview 배포 묶음은 여전히 historical 파일명으로 남아 있었지만, unified `anvil-web`와 `ANVIL_API_UPSTREAM` 기준이 compose, 스크립트, manifest, README에 일관되게 반영되지 않았다.
- 기존 동작을 보존하기 위해 historical `public-preview-*` 파일명은 유지하고, runtime/evidence는 canonical `anvil-web-*`와 legacy alias를 함께 기록하도록 정리했다.

## 조치

1. `tests/deploy/test_anvil_public_preview_contract.py`, `tests/deploy/test_anvil_public_preview_scripts.py`를 먼저 갱신해 다음 계약을 RED로 고정했다.
   - YAML이 정상 파싱될 것
   - `ANVIL_API_UPSTREAM`가 compose/manifest/README에 드러날 것
   - canonical `anvil-web-*` runtime/evidence 파일과 historical alias가 함께 유지될 것
   - verify 스크립트가 `/health/live`, `/openapi.json` upstream 경계를 확인할 것
2. `deploy/ysna/compose.public-preview.yml`에서 YAML 깨짐을 수정하고 `ANVIL_API_UPSTREAM: ${ANVIL_API_UPSTREAM:-http://anvil-internal-web-1:4173}`를 추가했다.
3. `deploy-public-preview.sh`, `verify-public-preview.sh`, `rollback-public-preview.sh`를 수정해 canonical `anvil-web-*` runtime/evidence 경로를 쓰면서 legacy `public-preview-*` alias도 함께 유지했다.
4. `release-manifest.public-preview.json`, `README.public-preview.md`를 수정해 unified `anvil-web` 기준, same-origin API proxy 범위, historical alias 유지 방침을 문서화했다.
5. 변경 후 배포 계약 테스트를 재실행해 GREEN을 확인했다.

## 변경 파일

- `deploy/ysna/compose.public-preview.yml`
- `deploy/ysna/deploy-public-preview.sh`
- `deploy/ysna/verify-public-preview.sh`
- `deploy/ysna/rollback-public-preview.sh`
- `deploy/ysna/release-manifest.public-preview.json`
- `deploy/ysna/README.public-preview.md`
- `tests/deploy/test_anvil_public_preview_contract.py`
- `tests/deploy/test_anvil_public_preview_scripts.py`

## 실행 및 결과

- 사전 확인: `C:/Users/cyhuh/anaconda3/python.exe -m unittest tests.deploy.test_anvil_public_preview_contract tests.deploy.test_anvil_public_preview_scripts -v`
  - 결과: `FAILED (errors=2)`
  - 원인: `compose.public-preview.yml`의 YAML parse error
- 변경 후 검증: `C:/Users/cyhuh/anaconda3/python.exe -m unittest tests.deploy.test_anvil_public_preview_contract tests.deploy.test_anvil_public_preview_scripts -v`
  - 결과: `OK (9 tests)`
- 정적 검사: `git diff --check`
  - 결과: exit 0, CRLF→LF 경고만 출력
- 환경 확인: `docker compose -f deploy/ysna/compose.public-preview.yml config`
  - 결과: `docker` 명령 미설치/미가용으로 `BLOCKED`

## 오류 횟수

- `apply_patch` ACL 오류 2회: worktree 파일 직접 패치 불가, PowerShell 파일 치환으로 최소 수정
- `docker compose` 환경 오류 1회: 로컬 `docker` 명령 미가용

## 미검증 범위

- 실제 Docker build / `docker compose config` / 컨테이너 기동
- ysna-server 실배포와 `anvil.sinsan.kr` 실제 upstream 프록시 응답
- 실제 `/integrations/*` POST, Telegram/Provider/DB side effect

## 롤백

- 이 커밋을 되돌리면 된다. 제품 외부 환경이나 서버 상태는 변경하지 않았다.
