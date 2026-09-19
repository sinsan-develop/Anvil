# C-30 로컬 통합·WSL formal preflight 완료보고

## C-30R1 Main route smoke 보완 — seq1281

판정: `anvil-web:c30r1-a681`을 승인된 WSL Ubuntu에서 빌드하고 기존 runtime과 분리된 임시 컨테이너로 실제 HTTP route smoke를 수행했다. 이미지 ID는 `sha256:88774a6d0df2acce6eb36588ac3320c958fe3cb99e497551f20d07be7e7b21d7`이다. `/health/live`는 200, `team/moa/sns/adapters`는 모두 `503 OFFLINE` 및 `counts_as_pass=false`, control POST는 503, unknown은 404, forged actor query는 400이었다. 로그와 종료코드 0을 확인한 뒤 임시 컨테이너·환경파일을 정리했다.

이번 증거는 ASGI 라우트 등록·fail-closed·컨테이너 기동만 증명한다. DB entity persistence, 실제 owner/auth 주입, 브라우저 E2E, Provider/운영 배포는 여전히 `NOT_INTEGRATED`이며 DB writes와 외부 호출은 0건이다. 따라서 최종 상태는 `ROUTE_SMOKE_PASS_FORMAL_DB_NOT_INTEGRATED`이고 다음 단계는 승인된 formal entity harness 확보 후 DB/container/entity/browser E2E를 수행하는 것이다.

## C-30R1 ASGI 연결 재작업 — COMPLETED (로컬 범위)

판정: Main formal smoke finding `evt_c30_formal_smoke_agent_console_404`의 ASGI 경로 등록 누락을 해소했다. 외부 formal 재배포/재검증은 수행하지 않았으며, runtime owner/auth 미연결 상태의 `503 OFFLINE`은 의도적으로 유지한다. 아래 원 C30 결과는 당시 증거이고, 본 절이 R1 최신 결과다. formal FAILURE_REPORT0, integration rework round1.

권위·기준선:

- 최종 Main 재검증 반영: seq1276, snapshot_hash `558A98764A955B493009C3B204E8EC73B26019D7697C934050DA268A43180CD7`. Main이 snapshot 정정 후 동일 full C30 focused 명령을 독립 재실행하여 30 passed, compile/diff PASS를 보고했다. 이번 문서 반영에서는 제품/테스트/control을 추가 변경하거나 테스트를 재실행하지 않았다. elapsed는 추가 보고되지 않았으며 이전 Developer 1.36s와 혼합하지 않는다. dual lease ACTIVE 유지.

현재 exact7 결박(문서 두 파일 자체 SHA는 순환 자기해시를 피하여 최종 전달 결과에 별도 제공):

```text
EA7C2289C9C32A67C4CA96E9223C2ADF50169981AFD836D904BF432FA8089529 apps/api/anvil_api/asgi.py
4210E0DD8DBB3D40F4D895239544353039B82303716BBEF404B6CBBDDA36E527 tests/integration/test_c30_console_e2e.py
8DA67939967B715AD68D28D6263B8324376CE43586D3C49BC7C33E914C40FAF7 tests/integration/test_c30_contract_matrix.py
63A45E9A6DCC69BCE022F988E66A9712DD3B9927FBCA7C0C04BEE8CAB52D83A5 docs/progress/build-progress.json
42C255503AFF4980A795CA7B626B8C8EB3509851F888CC1723E3522B70BB9DFC docs/progress/progress-events.json
SELF_HASH_SEPARATELY_REPORTED docs/04_test_reports/C-30_COMPLETION_REPORT.md
SELF_HASH_SEPARATELY_REPORTED docs/progress/BUILD_HANDOFF.md
```

- WI `docs/work_orders/C-30R1_WORK_INSTRUCTION.md` SHA256 `6701E351D01C37CFB9E870AA2CB8A899A3CA240E3AD7B621545326D8D7CCA08F`; prompt SHA256 `B82131C59C91699CC040FC62947CC53031AA5AE226A1D8988598556E960A3626`.
- event baseline `4a24dfb`, 최초 dispatch `087a4b6a834055686ce2ab7a5abaa984652afd40`; Main control 정정 후 실제 구현 기준 HEAD `7889245f99d6fe39fde30eb0afadada0291ef11a`, branch `codex/c09-execution-backends-r1`. 최초 checkout clean, Main 정정 이후 기존 RED 테스트만 dirty인 상태를 보존했다.
- seq1275; actor `developer-primary-c30-r1-rework`, worker/write `worker-lease-c30r1-20260919-001` / `write-lease-c30r1-20260919-001`, execution/write fence `c30r1-execution-fence-epoch-1-4a24dfb` / `c30r1-write-fence-epoch-1-4a24dfb`, ACTIVE window 2026-09-19 16:42~2026-09-20 04:42 KST.
- 전역 lease/hash/path 불일치를 mutation 전에 Main에 전달했다. Main이 정정·허용 exact7을 확정한 후 진행했다. 본 작업에서 lease/acceptance/event를 새로 발급하거나 회수하지 않았다.

변경:

- `apps/api/anvil_api/asgi.py`: 기존 `create_agent_console_app()`의 이미 prefix가 있는 APIRoute들을 frontend static mount 앞에 등록(+6/-1). 새 owner/auth/data를 만들지 않는다. 이중 prefix가 없고 기존 flat route 목록 계약을 보존한다.
- `tests/integration/test_c30_console_e2e.py`: DB/provider bootstrap factory만 격리하고 실제 ASGI 등록을 실행한다. health/root, team/moa/sns/adapters 503, control POST503, unknown404, forged query400, no-store와 counts_as_pass=false를 검증한다.
- `tests/integration/test_c30_contract_matrix.py`: Main acceptance 이후 current accepted=true를 되돌리지 않고 frozen Developer event의 accepted=false를 확인하도록 역사 검증을 수정했다.
- `docs/progress/build-progress.json`: 이미 수행된 Main control 수정 뒤 누락된 snapshot_hash만 현재 canonical 내용으로 재계산. 상태·authority·event_sequence 변경0.
- 본 보고서와 BUILD_HANDOFF에 결과를 추가했다. 허용 exact7 중 progress-events는 변경0이며, C30 manifest와 다른 제품은 그대로 보존했다.

TDD·정확한 명령(동일 canonical cwd, `PY=D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`):

| 명령 | exit | 결과 |
|---|---:|---|
| `PY -B -m pytest -q -p no:cacheprovider tests/integration/test_c30_console_e2e.py -k unified_asgi --tb=short` RED | 1 | 1 failed/11 deselected,1.21s; expected503 vs actual404 |
| `PY -B -m pytest -q -p no:cacheprovider tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py --tb=short` 최초 | 1 | 2 failed/28 passed,1.56s; 신규404 + Main acceptance 이후 역사 테스트 불일치 |
| 위 focused 중간 | 1 | 1 failed/29 passed,1.51s; 누락된 control snapshot_hash만 잔여 |
| 위 focused 최종 fresh | 0 | 30 passed/0 skipped,1.36s |
| `PY -B -m pytest -q -p no:cacheprovider apps/api/tests/test_agent_console_routes.py tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py tests/api/test_public_asgi_frontend.py --tb=short` | 0 | 55 passed/0 skipped,1.95s |

관련 회귀의 중간 `include_router` 구현은 현 FastAPI `_IncludedRouter`에 `.path`가 없어 기존 ASGI route introspection 1 failed/54 passed(2.10s)를 발생시켰다. 기존 subapp의 완성된 route들을 flat 목록으로 재사용하여 수정했다. 기존 관련 suite의 fresh-ASGI 테스트가 DB bootstrap/readiness를 포함하므로, 외부 의존성 없이 확인하는 최종 회귀를 아래처럼 추가 실행했다. 기존 테스트의 실제 DB 접속 성공을 주장하지 않는다.

```powershell
PY -B -c "import pytest; from fastapi import FastAPI; from unittest.mock import patch; guard=patch('packages.api.runtime.create_runtime_app',FastAPI); guard.start(); code=pytest.main(['-q','-p','no:cacheprovider','apps/api/tests/test_agent_console_routes.py','tests/integration/test_c30_console_e2e.py','tests/integration/test_c30_contract_matrix.py','tests/deploy/test_c30_wsl_formal_preflight.py','tests/api/test_public_asgi_frontend.py','--tb=short']); guard.stop(); raise SystemExit(code)"
```

exit0, 55 passed/0 skipped,0.90s. 이미 import된 anyio의 PytestAssertRewriteWarning1건은 이 process-local bootstrap guard 실행 경계다. 실제 router/response/readiness fixture는 실행하고 DB factory만 대체했다.

구문: `PY -B -c "from pathlib import Path; files=['apps/api/anvil_api/asgi.py','tests/integration/test_c30_console_e2e.py','tests/integration/test_c30_contract_matrix.py'];[compile(Path(p).read_text(encoding='utf-8'),p,'exec') for p in files];print('builtin compile 3 PASS')"` exit0. `git diff --check` exit0. 이번 R1에서 전체819/웹70은 재실행하지 않았으므로 원 C30의 역사 결과와 구분한다. canonical checker의 기존 SyntaxError는 이번 범위에서 수정/재검증하지 않았다.

제품/테스트 SHA256:

```text
EA7C2289C9C32A67C4CA96E9223C2ADF50169981AFD836D904BF432FA8089529 apps/api/anvil_api/asgi.py
4210E0DD8DBB3D40F4D895239544353039B82303716BBEF404B6CBBDDA36E527 tests/integration/test_c30_console_e2e.py
8DA67939967B715AD68D28D6263B8324376CE43586D3C49BC7C33E914C40FAF7 tests/integration/test_c30_contract_matrix.py
```

미검증/다음 행동: runtime owner/auth adapter의 실제 주입, DB·WSL·Docker·Provider·브라우저·배포는 NOT_EXECUTED/NOT_INTEGRATED. Main이 승인된 환경에서 새 exact candidate로 404→503 formal smoke를 독립 확인해야 한다. 로컬503은 서비스 정상 데이터200이나 formal acceptance가 아니다. rollback은 본 R1 ASGI/테스트/보고·HANDOFF/progress hash delta만 역패치하며 Main control commit과 기존 acceptance/event는 보존한다. stage/commit/push0.

## 판정

COMPLETED — 승인된 로컬 통합·preflight 증거 산출 범위 완료. 전체 owner 회귀819건, 최종 focused29건, 웹70건 GREEN. Developer 증거이며 C30 formal acceptance/Main acceptance가 아니다. WSL formal DB/container/entity/E2E는 NOT_EXECUTED/NOT_INTEGRATED. formal FAILURE_REPORT 0.

## 판단 이유·권위

- cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/c09-execution-backends-r1`, 기준 HEAD `98e218264bf54db04a1bd35a67273b713805a649`.
- WI `docs/work_orders/C-30_WORK_INSTRUCTION.md`: `BF6FD2BE7455F9AE5FDA59F19FFDA73C6BEFCB4FD8D252BD60733F504E21D0ED`.
- invocation: `8A15E8870199F259478F1E73CF64BC59FC81D62469ABEA317DECEC0FC05B244C`.
- seq1262, worker/write `worker-lease-c30-r1-20260919-001` / `write-lease-c30-r1-20260919-001`, execution/write fences `c30-r1-execution-fence-epoch-1-98e218264bf54db0` / `c30-r1-write-fence-epoch-1-98e218264bf54db0`.
- 2026-09-19 15:34:51 KST에 ACTIVE window 15:30~다음날03:30 및 exact8 projection 확인 후 작업했다. 기존 dirty/untracked는 보존했다. stage/commit/push/acceptance/lease revoke 없음.
- design51.1~51.5, 계획19.7, 통합검증매트릭스 v1.7 overlay, 테스트계획 v1.7 overlay를 manifest의 C22~C30 matrix로 연결했다. 예약 검증군만 사용하고 미발행 AV ID를 발명하지 않았다. 원 canonical 설계/계획/매트릭스/테스트계획 문서는 범위 밖이므로 수정하지 않고 현재30개 source hash를 고정했다.
- 읽기 중 C29 seq1256~1258의 occurred_at=11:20이 lease 발효15:00보다 빠른 역사 시각 불일치를 발견하여 Main에 통보했다. 이를 조용히 수정하지 않았으며 현재 C30 lease/발효시각은 정상이다.

## 조치

허용 exact8:

1. `tests/integration/test_c30_console_e2e.py`: 실제 C22 current role authority→C23 parent/child 계획·claim·결과 수집→C24 proposal/critique/synthesis→C29 API projection. 실제 owner 메서드와 frozen typed DTO를 사용하되 evidence는 synthetic fixture임을 표시한다. revocation, high-risk8종/intent-only, Telegram pause와 Kakao OPEN_DECISION을 통합 검증한다.
2. `tests/integration/test_c30_contract_matrix.py`: 9개 패키지/설계/예약 검증군/실제 테스트 경로,30개 source hash, event1252 사용자 확인, append-only prefix·evidence event·progress snapshot·HANDOFF 결박.
3. `tests/deploy/test_c30_wsl_formal_preflight.py`: 로컬 파일만 검사. 승인·clean candidate·ReleaseManifest·실환경 preflight·실행 증거·독립 review 누락을 명시한다. PG15와 PG18RC, provider/adapter/Oracle 경계를 별도 표시한다.
4. 본 보고서.
5. `docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json`: local evidence 전용 문서이며 runtime ReleaseManifest나 human approval이 아니다. `release_allowed=false`, `automatic_acceptance=false`, 독립 C/I는 미판정 null이다.
6~8. `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`: Developer의 로컬 검증 evidence만 후속 기록. 기존 acceptance/역사 raw prefix를 보존하고 Main 합격/lease 회수 이벤트는 만들지 않는다.

기존 C22~C29 제품 코드, migration, DB, WSL 실행 스크립트, secret/config, checker는 수정하지 않는다. 승인된 계획 실행·TDD 스킬의 검증/기록 원칙을 사용하되 별도 agent·commit·범위 밖 ledger 생성은 하지 않는다.

## RED → GREEN

- 최초 focused: 26 failed/1 passed, exit1,1.42s. 16건은 신규 evidence inventory/preflight manifest 미작성 RED,10건은 parent-child fixture의 packet parent_run_id/parent_hash 결박 미정합이었다.
- fixture를 실제 host `RolePolicyService.register`로 재등록하여 child assignment를 만들었다. 중간 context hash 필드 경로 오류(`assignment` 대신 `assignment.packet`)를 수정한 뒤 integration11 PASS/1.14s. 정상 owner 거부를 제품 버그라고 변경하지 않았다.
- 실제30개 source hash 및 fail-closed preflight manifest를 작성한 후 focused27 PASS/1.14s.
- 후속 append-only event/progress 결박 테스트2건은 먼저 RED(2 failed/12 deselected,0.10s)를 확인했다. seq1263 증거 동기화 후 fresh focused29 PASS/1.23s로 GREEN을 확인했다.
- 모두 개발 과정 RED/fixture 보완이며 정식 FAILURE_REPORT나 독립 review failure가 아니다.

## 정확한 검증 명령·결과

모든 명령 cwd는 위 canonical checkout. `PY`는 정확히 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`이다.

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `PY -B -m pytest -q -p no:cacheprovider tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py --tb=short` 첫 GREEN | 0 | 27 passed,0 skipped,1.14s |
| `PY -B -m pytest -q -p no:cacheprovider tests/agent_team apps/api/tests/test_agent_console_routes.py tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py --basetemp=D:/Project/Anvil/.codex-sandbox/c30-pytest-20260919-1545 --tb=short` | 0 | 819 passed,0 skipped,669.24s(11:09). session47452 종료 확인. 후속 control2건 추가 전에 수집한 전체 회귀 |
| `PY -B -m pytest -q -p no:cacheprovider tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py --tb=short` 최종 | 0 | 29 passed,0 skipped,1.23s. 후속 control2건 포함 |
| `PY -B -m pytest -q -p no:cacheprovider tests/agent_team apps/api/tests/test_agent_console_routes.py tests/integration/test_c30_console_e2e.py tests/integration/test_c30_contract_matrix.py tests/deploy/test_c30_wsl_formal_preflight.py --ignore=tests/agent_team/test_worktree_writes_e06.py --basetemp=D:/Project/Anvil/.codex-sandbox/c30-final-fast-pytest-20260919-1555 --tb=short` | 0 | 765 passed,0 skipped,11.22s. 최종 control 포함/E06만 명시 제외; 앞선 full819와 별도 실행 |
| `$env:ANVIL_PYTHON='D:/tmp/anvil-main-integration/.venv/Scripts/python.exe'; node --test apps/web/tests/*.test.mjs` | 0 | 70 passed,0 skipped,2025.2269ms. real loopback Python API→Node BFF와 C28/C29 포함 |
| `PY -B scripts/check_project_progress.py` | 1 | 기존 line32957 embedded C03 string SyntaxError. NOT_VERIFIED/NOT_PASS |

구문 검증: `PY -B -c "from pathlib import Path; files=['tests/integration/test_c30_console_e2e.py','tests/integration/test_c30_contract_matrix.py','tests/deploy/test_c30_wsl_formal_preflight.py']; [compile(Path(p).read_text(encoding='utf-8'),p,'exec') for p in files]; print('builtin compile 3 PASS')"` exit0. `git diff --check` exit0, `git diff --cached --name-only` exit0/output empty(staged0).

## 최종 증거 결박

- manifest SHA256: `9E71BF741A77F74C582E26DC1BCCD6CE8EC8F88F4F656C114F2FF10A7FBB544A`.
- seq1263 `evt_c30_local_evidence_manifest_created`는 Developer EVIDENCE_MANIFEST_CREATED일 뿐 acceptance/lease revoke가 아니다. package ACTIVE 및 기존 dual lease 유지.
- 기존 seq1~1262 event raw prefix 3,937,471 bytes, SHA256 `482FF3FEF063093C57A5F96E1BECAF7393973398AE5E1704B6A79A55F9A3970E` byte-identical 테스트 PASS.
- progress snapshot hash `373CE8E46DC1B2C4C3B5217D93B6854EF1F12AF2BF4C67FD022D764B1A69AB4B`; manifest ref/hash 및 HANDOFF 결박 테스트 PASS. 이 좁은 검증은 실행 불가한 canonical checker의 대체 PASS가 아니다.
- 선택적 최종 fast 회귀 첫 호출에서 `--ignore=tests/agent_team/test_worktree_write_e06.py` 오타로 E06이 재수집되어 session75837을 Ctrl-C 중단(exit1, 최종 집계 없음). 이 미완료 실행은 PASS에 포함하지 않으며, 앞선 전체819 종료 증거는 유효하다. 수정한 복수형 경로로 재실행했다. 프로세스 조회 `Get-CimInstance Win32_Process`는 환경 Access denied(exit1)였고 pytest 세션 도구의 종료 코드로 확인했다. 둘 다 formal FAILURE_REPORT가 아니다.
- 전용 테스트 임시 경로 `D:\Project\Anvil\.codex-sandbox\c30-pytest-20260919-1545`, `c30-final-pytest-20260919-1554`, `c30-final-fast-pytest-20260919-1555`는 각 Resolve-Path exact identity 및 허용 상위 경로를 확인한 뒤 `Remove-Item -LiteralPath $c30Resolved -Recurse -Force`로 정리했다. 세 경로 모두 Test-Path=False, exit0. 재생성 가능한 테스트 임시 Git 자료만 제거했고 canonical checkout/기존 사용자 자료는 건드리지 않았다.

C30 local suite는 actual Provider를 호출하지 않는다. 기존 E06 회귀만 전용 임시 Git 작업 디렉터리를 사용하며 canonical Git mutation이 아니다. Node warning MODULE_TYPELESS_PACKAGE_JSON 및 Git ignore permission warning은 기존 환경 경계이다.

## WSL 미실행의 정확한 이유와 안전 경계

- 별도 WSL/DB mutation·외부 배포 실행 안전 승인 없음. 현재 dirty successor에는 freeze된 C30 candidate commit/image/ReleaseManifest가 없다. 기존자격증명/DSN/토큰은 읽거나 기록하지 않았다.
- 읽은 기존 `deploy/wsl/formal-single-runtime.sh`는 C01 candidate `bb2ff4374c81865cab127eca14d3d4c9de575465`와 이전 runtime에 고정돼 있다. 단순 preflight 명령이 아니라 Git fetch/checkout, Docker build와 exact runtime replacement를 수행한다. 현재 C30 실행기로 재사용하지 않았고 `--help` 형태로도 실행하지 않았다.
- manifest `planned_checks`의 Git/container/DB/entity/HTTP/browser/rollback/cleanup 명령 또는 owner 항목은 실행 계획일 뿐 모두 `NOT_EXECUTED`, `automatic_dispatch=false`, `requires_approval=true`이다. 미구현 C30 entity harness 명령을 발명하지 않고 Main-owned 후속 실행 조건으로 표시한다.
- WSL/SSH/Docker/DB network/Provider/Telegram/Kakao 실제 호출0. Oracle/production은 OUT_OF_SCOPE. PG15/PG18RC는 각각 NOT_EXECUTED.
- 브라우저 실제 클릭/Network/렌더는 NOT_EXECUTED. Node HTTP·DOM contract 및 ASGI 테스트를 실제 browser/운영 PASS로 승격하지 않는다.
- 독립 Reviewer C/I: NOT_EXECUTED/null. self-review를 독립 ACCEPT로 기록하지 않는다. PR/remote publication도 NOT_EXECUTED.

## 남은 정확한 다음 행동과 rollback

Main이 로컬 증거를 독립 검토하고 checker SyntaxError·역사 시각 문제를 별도 소유 범위에서 정리한다. 실제 WSL이 필요하면 exact clean candidate/image/ReleaseManifest·대상 자원·환경/승인·검증/rollback/cleanup 계획을 먼저 결박한 뒤 허용된 실행자가 formal DB/container/entity/browser E2E를 수행해야 한다. 현재 로컬 PASS만으로 C30 formal acceptance나 배포를 허용하지 않는다.

rollback은 C30 신규5 파일과 control3의 이번 successor delta만 Main이 hash/diff 확인 후 역패치한다. 이미 게시된 progress event를 소급 삭제하지 않고 후속 무효화/정정 이벤트를 사용한다. 기존 historical acceptance·제품·dirty/untracked는 보존한다. 외부 DB/WSL/배포 상태를 바꾸지 않았으므로 해당 rollback은 없다.

## C-30R2 후속 local-only 기록 — 2026-09-19

- Task2 durable owner persistence, Task3 trusted runtime owner seam, Task4A formal entity preflight를 구현·검증했다.
- Task2 `69 passed/1 skipped`, Task3 관련 회귀 `531 passed/34 skipped`, Task4A `15 passed`, preflight 묶음 `31 passed`.
- C30 matrix는 `13 passed/1 failed`; 기존 frozen manifest가 승인된 runtime successor보다 오래된 역사 세대이므로 과거 manifest/event는 소급 수정하지 않았다.
- Docker CLI 미설치, WSL 열거 `E_ACCESSDENIED`; PostgreSQL·HTTP·browser·process restart·배포는 `NOT_EXECUTED`다.
- `0015_agent_team_owner`는 생성만 되었고 canonical release target `0013_task_bootstrap_authority`에는 적용하지 않았다.
- 판정: `LOCAL_PREFLIGHT_ACCEPTED`; C30 formal acceptance/release는 `NOT_INTEGRATED`.

### WSL-server disposable formal attempt

- SSH `WSL-server`의 canonical worktree `codex/c09-execution-backends-r1`에서 disposable `postgres:15-alpine`를 생성했다.
- `anvil-c30r2-formal:760317c`를 별도 빌드했고, `alembic upgrade 0013_task_bootstrap_authority` 및 `alembic_version=0013_task_bootstrap_authority`를 확인했다.
- web 기동은 `RuntimeConfigurationError: TELEGRAM_WEBHOOK_SECRET is required`로 실패했다. secret을 기록·추측·우회하지 않았으며 HTTP/browser/restart는 실행하지 않았다.
- disposable PostgreSQL과 formal image는 시도 후 제거했고 기존 `anvil-web` 및 기존 DB는 변경하지 않았다.

### WSL-server formal runtime smoke — disposable only

- 임시 검증 secret만 주입해 web을 기동했고 `/health/live=200`, `/health/ready=200`, `migration_head=0013_task_bootstrap_authority`를 확인했다.
- `/api/agent-console/team`은 `503 OFFLINE / CONSOLE_REQUEST_DENIED / counts_as_pass=false`, unknown route는 `404`였다.
- web 재시작 후에도 live/ready와 동일한 console refusal을 확인했다. durable owner restore/entity projection은 여전히 `NOT_INTEGRATED`다.
- 임시 secret은 저장·보고하지 않았고 disposable web/PG/image는 모두 제거했다.
