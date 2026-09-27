# F-20 WSL 최종 검증 보고서 / 2026-09-27

## 판정

`INCOMPLETE_F20_RUNTIME_BOUNDARY`. 최신 게시 commit `df19100`을 `ssh WSL-server`의 격리 Docker/브라우저 경계에서 확인했지만, F-20의 live queue/worker/Provider·backup/restore/rollback과 전체 checkout scan 완료조건을 모두 충족하지 못했다. F-20은 완료·ACCEPTED로 전환하지 않으며 ReleaseDecision은 `DEFER`로 유지한다.

## 근거

- WSL-server 전용 checkout에서 Python 지정 회귀는 `153 passed in 3.94s`였다.
- 동일 pushed checkpoint의 recovery/deployment 지정 회귀를 별도 checkout에서 추가 실행해 `170 passed in 3.56s`를 확인했다 (`test_f14_runbook`, `test_f14_disaster`, `test_f14_retention`, `test_f13_operations_api`, `test_f17_validation`, `test_gates_c14`, `test_release_guard`). 이 결과는 계약·격리 회귀 증거이며 live DB/backup/restore/rollback 실행 증거가 아니다.
- WSL 웹 회귀는 Projects/Workbench `15 passed`, Projects route `1 passed`, Dashboard `3 passed`, `npm run web:typecheck` PASS였다.
- WSL runtime은 Node `v18.19.1`이며 Vite 8 build는 `node:util styleText` 부재로 실행할 수 없었다. 이를 build PASS로 표시하지 않는다.
- WSL-server에는 `chromium`, `chromium-browser`, `google-chrome` 실행 파일이 없었다.
- 정본 `deploy/local/Dockerfile.runtime`의 Node `22.23.0` build stage를 사용한 isolated web image build는 typecheck와 Vite build를 포함해 성공했다. image id는 `sha256:62b200903356f5e8b646a5e2047a900f89e87a24db51148c2e23df182a5e4659`였고, 검증 후 image/container를 제거했다.
- 승인된 Windows Chrome 임시 headless/CDP 프로필을 사용해 SSH 포워드된 동일 WSL runtime을 확인했다. Dashboard와 Provider 화면은 열렸고 관측된 요청은 `127.0.0.1:4174` same-origin 상대 경로였다. 기존 Chrome 프로필·탭·계정은 사용하지 않았다.
- 같은 브라우저 실행에서 `/projects`는 WSL `server.mjs`의 404 응답이었다. U-03 React route의 실제 브라우저 화면으로 승격할 수 없다.
- Docker web image를 SSH 포워드한 CDP 재검증에서는 `/`, `/projects`, `/runs`, `/reviews`, `/quality`, `/knowledge`, `/agents-automation`, `/environments`, `/operations`, `/settings`가 모두 HTTP 200 shell을 반환했다. Dashboard와 Projects는 실제 heading을 표시했지만 나머지는 `페이지를 사용할 수 없습니다` fallback이었다. `/api/health/ready`와 `/api/projects/scan`은 API container 미기동으로 502였고, 이는 live readiness/DB PASS가 아니다.
- 위 CDP Network 요청은 `127.0.0.1:4176` same-origin 및 상대 `/api/...`만 관측됐으며 내부 API 절대주소·외부 host 요청은 없었다.
- r4 격리 PG15·API·web stack에서는 migration `0016_operations_recovery`, API `/health/live`와 `/api/health/ready`가 각각 `200`/`200`이었다. 같은 CDP browser에서 `/api/health/ready`는 전 route `200`으로 확인되어 DB/API readiness와 same-origin Network를 입증했다.
- r4에서 `/api/projects/scan`은 `404`였다. Projects BFF가 local `apps/web/server.mjs`에만 있고 production nginx→FastAPI 경로에는 없어 실제 Projects scan이 끊긴다. 이는 F-20 blocking defect 후보이며 0건으로 닫지 않는다.
- r4에서 Runs/Reviews/Quality/Knowledge/Agents & Automation/Environments/Operations/Settings는 HTTP shell `200`이지만 화면 heading은 `페이지를 사용할 수 없습니다` fallback이었다. 11개 메뉴 기능 smoke PASS가 아니다.
- F-20 target에서 live PostgreSQL/queue/worker/provider, backup/restore, application rollback과 관찰구간 critical-alert 판정은 실행하지 못했다. 이전 Package의 contract/fixture evidence를 이 target의 실제 PASS로 재사용하지 않는다.
- WSL checkout·임시 서버·4173 listener·SSH port-forward·Chrome process/profile·로그는 exact cleanup 후 모두 잔여 0을 확인했다. Production/ysna-server는 접근하지 않았다.
- 추가 recovery checkout `/home/daon/anvil-f20-r2`와 임시 `/tmp/f20-r2-*.log`도 exact cleanup 후 잔여 0이다.
- Docker r3 checkout/image/container, loopback port 4175, SSH forward, Chrome profile/process/log도 exact cleanup 후 잔여 0이다.
- r4 isolated PG15/API/web checkout, images, containers, internal network, port/forward, Chrome profile/process/log도 exact cleanup 후 잔여 0이다.

## 최신 repair evidence (df19100)

- RED→GREEN으로 새 production API route를 고정했다. 구현 전 `tests/api/test_projects_scan_api.py`는 `ModuleNotFoundError`였고, 구현 후 local Anaconda에서 API/public frontend `6 passed`였다.
- `deploy/local/Dockerfile.runtime` runtime stage에 Git을 추가했고, repository scanner는 서버가 지정한 정확한 경로만 `safe.directory`로 허용한다. WSL Docker Node22 web image의 typecheck+Vite build는 PASS였다.
- 격리 PG15/API/web stack에서 `/health/live=200`, `/api/health/ready=200`을 확인했다. 임시 독립 Git fixture를 read-only로 마운트한 `/api/projects/scan`은 `200`과 `status=READY`, `noWriteProof.identical=true`, `mutationAllowed=false`를 반환했다.
- Windows 임시 격리 브라우저에서 `/projects`는 실제 `READY`/`READY_TO_REVIEW`를 표시했다. 나머지 9개 계획 route도 각 제목과 `UNAVAILABLE` read-only 화면을 표시했고 `페이지를 사용할 수 없습니다` fallback은 없었다. 브라우저 요청은 same-origin이었다.
- 전체 Anvil checkout scan은 저장소 규모로 요청이 timeout되어 완료 증거로 승격하지 않는다. 독립 fixture와 실제 checkout의 시간 차이는 미검증 성능/운영 경계다.
- 최신 임시 Docker/clone/fixture/network/SSH forward/browser tab을 exact cleanup했고 `F20_FIX_TEMP_RESIDUE_ZERO`를 확인했다. 남은 필수 검증은 live queue/worker/provider, backup/restore/rollback, 전체 checkout scan 완료와 critical alert 0이다.

## 조치 및 다음 안전 행동

1. F-20 active 상태와 `DEFER` 경계를 유지한다.
2. WSL-server에 이미 설치된 Node `>=20.19` runtime이 있는지 확인하거나, 환경 변경 승인 범위가 확정된 뒤에만 호환 runtime을 마련한다. 임의 설치·시스템 변경은 하지 않는다.
3. 동일 commit으로 WSL web runtime을 다시 기동해 11개 메뉴 route가 실제로 제공되는지 확인하고, DB/queue/worker/provider·backup/restore·rollback을 같은 target에서 수집한다.
4. 모든 필수 evidence와 blocking defect 0/critical alert 0이 확보되기 전에는 F-20 완료, Phase F Gate, Plugin Phase P 착수를 선언하지 않는다.

## Rollback

제품 변경은 없었다. 임시 runtime과 checkout만 제거했으며, 코드 rollback 대상은 없다. 기준 commit은 `00677052c5791b70253389332c3837b286281dc0`이다.

