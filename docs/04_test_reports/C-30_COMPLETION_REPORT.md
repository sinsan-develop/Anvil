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

## C-30R3 Task4 — 2026-09-20 현재 실행 기록

### 판정

`BLOCKED` — WSL formal execution은 `NOT_EXECUTED`; 승인된 local formal-preflight와 기록 작업은 완료했다.
위 C30R2 disposable smoke는 과거 후보의 증거이며 이번 Task4의 PG/browser/restart PASS로 재사용하지 않는다.
formal acceptance=false, formal FAILURE_REPORT=0. SSH 접근 환경 오류는 제품 정식 실패가 아니다.

기준 checkout `D:/Project/Anvil/.codex-sandbox/anvil-main-integration`, branch
`codex/c09-execution-backends-r1`, 시작 clean HEAD `624394e68e4828dbe4cdd2f7334dfb9bb19b2f85`.
Task3 제품 commit `f5c9b66942cc21ee0ffa4e7ca3bdf4dcb6c66e30`은 수정하지 않았다.
Task4 exact3: `tests/integration/test_c30r3_formal_entity.py`, 이 보고서, `docs/progress/BUILD_HANDOFF.md`.
worker/write `worker-lease-c30r3-task4-20260920-001` / `write-lease-c30r3-task4-20260920-001`,
execution/write fence `c30r3-task4-execution-fence-epoch-1-f5c9b66` /
`c30r3-task4-write-fence-epoch-1-f5c9b66`; ACTIVE, expires 2026-09-20T12:05:00+09:00.

### 판단 이유·Main 내부 실행 결정

1. `agent_owner_heads/history/requests`는 migration0015에서 처음 생성된다. app DB를0013까지만 구성하면
   owner persist는 불가능하다. Main은 동일 disposable PG15의 서로 다른 database 두 개를 사용하도록 결정했다:
   **app_db_head=0013_task_bootstrap_authority / owner_db_head=0015_agent_team_owner**.
   이는 disposable 검증 계획이며 release schema 승격이 아니다. migration source/release 파일은 변경하지 않았고
   두 DB 모두 이번 실행에서 생성하거나 migration하지 않았다.
2. `ssh -G WSL-server` exit0이지만 effective `user=codexsandboxoffline`, `hostname=wsl-server`로
   프로젝트 alias가 적용되지 않았다. `ssh -o BatchMode=yes -o ConnectTimeout=10 WSL-server hostname`
   exit1: `ssh: Could not resolve hostname wsl-server`.
3. 초기 read-only hostname/Docker inventory 복합 probe도 같은 해석 실패로 exit1이었다.
   명시적인 기존 config 경로 `ssh -F C:/Users/cyhuh/.ssh/config -o BatchMode=yes -o ConnectTimeout=10 WSL-server ...`
   확인은 `Can't open user config file ...: Permission denied`, exit1이었다. config/key/credential 변경,
   IP 우회, 권한 상승, WSL 서비스 재시작을 하지 않았다. Main 지시 뒤 추가 SSH probe는 반복하지 않았다.

blocker fingerprint: `C30R3-TASK4-SSH-ALIAS-UNRESOLVED-WORKER`.
원격 command 도달0, 생성 container/image/network/volume/DB/secret/tunnel0. disposable 식별자 미할당.
따라서 이번 작업에 의한 기존 서비스 mutation0이며 정리할 생성 자원도 없다.
원격 inventory 자체는 접근 실패로 미관측이므로 전체 서버 residue0/health 불변을 실측했다고 주장하지 않는다.

### 조치·검증 명령과 실제 결과

`PY=C:/Users/cyhuh/anaconda3/python.exe`, cwd는 위 canonical checkout이다.

- RED: `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_c30r3_formal_entity.py --tb=short`
  → exit1, **9 failed/13 passed/0 skipped, 3.58s**. 실패는 신규 dual-DB/non-attesting preflight inventory 부재였다.
- GREEN: 같은 명령 → exit0, **22 passed/0 skipped, 3.60s**.
- 관련 회귀: `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_c30r3_formal_entity.py tests/integration/test_c30r3_runtime_restore.py tests/agent_team/test_owner_component_restore.py tests/integration/test_c30r2_runtime_owner.py tests/integration/test_c30r2_formal_entity.py tests/integration/test_c30_console_e2e.py --tb=short`
  → exit0, **157 passed/0 skipped, 11.06s**.
- 기존 warning 1: `python_multipart` PendingDeprecationWarning. 제품 failure가 아니다.
- 구문: `PY -B -c "from pathlib import Path; p=Path('tests/integration/test_c30r3_formal_entity.py'); compile(p.read_bytes(),str(p),'exec'); print('COMPILE_PASS exact1')"`
  → exit0. `git diff --check` → exit0; 변경은 허용 exact3뿐이다.

새 test는 실제 migration source의 table 생성 위치를 AST로 확인하고, local SQLite/ASGI로 typed owner
4개 메뉴, empty/offline/error, control/high-risk/CSRF 입력 거부, durable receipt exact replay를 검증한다.
새 RuntimeConsoleOwner 객체는 같은 프로세스에서 생성했으므로 OS process restart PASS가 아니다.
preflight inventory는 실행 증거 발행 API가 아니며 SSH blocker/미실행 상태를 고정한다.

### 미검증·다음 행동·rollback

실제 PG15 DB write/rollback, live HTTP, browser same-origin Network, web process restart/revoked reload,
원격 cleanup inventory는 모두 NOT_EXECUTED. Provider/Telegram/Kakao/Oracle/production 실행0.
app readiness 0013 계약 및 기존 frozen manifest/events는 그대로 보존했다.
다음은 기존 WSL-server alias가 사용 가능한 승인된 Main 실행 환경에서 clean candidate Git-only 배포,
위 dual DB 분리, 실제 persist/restart/revoke/browser 검증과 정확한 disposable cleanup을 실행하는 것이다.
그 전까지 C30 formal acceptance는 false다. Project progress event JSON은 exact3 밖이라 수정하지 않았다;
Main이 이 blocker와 실행 수치를 append-only completion/event에 결박한다.
rollback은 이번 exact3 local-preflight/문서 commit만 Main이 검토 후 revert한다. 외부 state rollback은 없다.

### Task4 external-path 재개 checkpoint

Main/PMO 승인된 외부 경로에서 같은 WSL-server hostname probe가 exit0/SINSAN으로 확인됐다.
앞선 sandbox alias failure와 이 성공은 서로 다른 실행 환경 증거이며 과거 기록을 소급 변경하지 않는다.
생성 예정 prefix `anvil-c30r3-t4-20260920-0120`의 pg/web/bff/browser/internal-net, image
`anvil-c30r3-t4:20260920-0120`, `/tmp/anvil-c30r3-t4-20260920-0120` Git-only checkout을 사용한다.
수명은 이번 검증까지, 종료/실패 후 exact label/name/path 정리 및 기존 anvil-web identity 불변을 확인한다.
별도 app DB0013 / owner DB0015 적용 계획이며 shared DB/기존 runtime은 사용하지 않는다.
기존 cached app image의 네트워크 없는 --rm 의존성 검사1건은 종료·자동제거됐다.
후속 실제 결과 전까지 formal acceptance=false/PG/browser/restart NOT_EXECUTED를 유지한다.

## C30R3 Task4 실제 disposable 실행 종료 — 2026-09-20

### 판정 → 판단 이유 → 조치

**INCOMPLETE (인증 browser/Network BLOCKED)**. PostgreSQL15·live HTTP·OS process restart·durable
receipt/revocation 및 cleanup은 실제 실행했다. 브라우저 4개 메뉴의 권한 거부 화면은 관찰했지만
QA 로그인 제출이 Chrome `ERR_BLOCKED_BY_CLIENT`로 차단됐다. 브라우저 보안 설정/확장/쿠키를
우회하지 않았다. 인증된 browser 정상/empty 화면과 실제 browser Network 요청 목록은 미검증이다.
따라서 C30 formal acceptance=false, formal FAILURE_REPORT=0이며 제품 결함으로 단정하지 않는다.
위 초기 SSH BLOCKED/생성0 기록은 당시 실행 기록이고 이 후속 실제 실행 기록이 현재 상태다.

### 정확한 source·환경·실행

- 외부 push 없이 `WSL-server`의 mounted canonical
  `/mnt/d/Project/Anvil/.codex-sandbox/anvil-main-integration`에서 `git clone --no-hardlinks --no-checkout`
  → `/tmp/anvil-c30r3-t4-20260920-0120`, `git checkout --detach 219a28854628cb2c26ddd7d89a623dba9360ac41`.
  exit0, checkout clean. 외부 Git remote는 변경하지 않았다.
- `docker build --network none --pull=false --label anvil.c30r3.task4=20260920-0120 -t anvil-c30r3-t4:20260920-0120 -f - .`
  exit0, image `4097b12a3f55`. cached `anvil-web:c30r1-a681`에 exact Git source만 COPY했다.
  새 dependency 다운로드0. 첫 stdin CRLF build 실패(exit1)는 LF 정규화 후 해소했다.
- internal network `anvil-c30r3-t4-20260920-0120-net` ID `635f303ca3f2d8e5e6c7b3657d258631342ae1cbea758cc0c7a24102783edf87`.
  PG container `...-pg` ID `ff38cd14065760cfbe0d17296e002d73938e0d3f3fe16fbbaf940f5923161e7c`,
  cached `pgvector/pgvector:0.8.2-pg15`, data tmpfs, 별도 volume0.
- host에서 무작위 validation-only credential/session을 만들고 subprocess/container env로만 전달했다.
  값·DSN·token 로그/보고0, 기존 secret/DB 사용0. shell tracing0, 오류 출력은 credential redaction.
- `docker exec ...-pg createdb -U qa c30r3_app`, `... c30r3_owner`: 각각 exit0.
  `docker run --rm ... anvil-c30r3-t4:20260920-0120 init`: exit0.
  committed harness가 실제 `alembic.command.upgrade(config,'0013_task_bootstrap_authority')` /
  `upgrade(config,'0015_agent_team_owner')`를 서로 다른 DB에서 수행했다.
  **app_db_head=0013_task_bootstrap_authority / owner_db_head=0015_agent_team_owner**.
  release DB/source/migration 파일 변경0.
- 저장 owner snapshot1, hash `sha256:d75d4c98bcd102504f3a099f709aaef9e7d0028a098a33b3e639bbb05efe7ffb`.
  실제 RolePolicy/RoleResults/Team/MoA의 PENDING QA task이며 PASS 결과·Provider 실행을 꾸미지 않았다.
- `docker run -d ... anvil-c30r3-t4:20260920-0120 serve` web ID
  `7f229aacab20d77dffc92e770f5c48838528da8764bb7f361730cc4e3ea6ad4b`.
  `docker exec ...-web /opt/venv/bin/python -c <urllib GET probe>` exit0:
  `/health/live=200`, `/health/ready=200`, `/api/agent-console/{team,moa,sns,adapters}` 모두200.
  team NORMAL/PENDING, moa EMPTY, sns EMPTY, adapters NORMAL/NOT_INTEGRATED, counts_as_pass=false.
- `docker restart ...-web` 후 동일 urllib probe exit0; StartedAt 변경 확인, 4개 응답 bytes/hash exact equality.
  시작 직후 1회 connection refused는 readiness retry로 수렴했으며 성공 응답으로 숨기지 않았다.
  `docker exec ...-web /opt/venv/bin/python /opt/anvil/formal.py stats`: owner head0015,
  heads1/receipts4/revoked0/app head0013. 반복 GET/restart 뒤 receipt 수4 유지.
  response SHA256: team `ffc30aa56e2fa6bde506d44c2d6e37fd67128594da79c4049fa8158525d522d3`,
  moa `5032469a6f92e1f9f5bf9f22a6f4bb795687b0a807ac2964f73e5874cacad6c8`,
  sns `d8587bfb9f772c88cefb12b356c6568b4931f188c787dcdf19cd44593ee9f72a`,
  adapters `00ec00712aca5b9e1c57ebc607f02a6e60e8818b5d035d7711cd3753a2ce39fa`.

### Browser/BFF 시도와 거부·revocation

Main에 보고한 test-only QA 로그인 fixture commit `372718c85209aed50e28ebd5c6c27196be11571d`를
mounted Git에서 full SHA fetch→detached checkout했다(exit0). 처음 short SHA fetch는 exit1이고 source 변경0.
이후 Main은 이미 준비된 fixture 사용만 허용하고 추가 fixture 생성을 금지했다. 그 뒤 코드 변경0.
fixture는 기존 seeded read-only principal용 cookie만 설정하며 owner registration/권위 변경을 하지 않는다.
이는 production authentication 증거가 아니다. image `anvil-c30r3-t4:20260920-0120-browser`
`b6fd739f2a39`, web 교체 ID `42dfb15f0546d8189e0dc22a915894642b1d38f5974caa121da31e5289c1698d`.

원본 `apps/web/server.mjs`의 `startWorkbenchServer({host:'127.0.0.1',port:4173,
agentConsoleUpstream:'http://127.0.0.1:3770'})`를 cached Node22에서 실행했다.
BFF `...-bff` ID `b104c9602330bcf17294de888a50145c185afc23a8985491c6b483c5ff64d6b0`,
read-only Git checkout mount, `--network container:...-web`; 임시 TCP relay4174→namespace loopback4173.
internal Docker network host port는 실제 비노출이라 첫 tunnel 연결이 reset됐다.
SSH alias는 유지하고 `ssh -N -L 127.0.0.1:4173:172.24.0.3:4174 WSL-server`로
원격 disposable container 목적지만 연결했다. 이 내부 주소는 browser 코드/URL에 넣지 않았다.
처음 tunnel PID34208은 소유 commandline 확인 후 종료, 대체 PID46720도 종료했다.

- Chrome CUA에서 `http://127.0.0.1:4173/auth/c30r3-qa` 페이지와 명시적 QA 설명을 관찰했다.
  qa-reader 제출 후 `127.0.0.1이(가) 차단됨 / ERR_BLOCKED_BY_CLIENT`.
  이후 `/agent-console`에서 Team/MoA/SNS/Adapters를 실제 클릭했고 4개 모두 permission 화면을 관찰했다.
  인증 browser PASS로 승격하지 않는다. read-only browser evaluation에서 performance API가 제공되지 않아
  `Cannot read properties of undefined (reading 'getEntriesByType')`; 실제 Network 목록 미수집.
- 별도 실제 HTTP BFF probe는 persisted cookie로 4개 메뉴200을 확인했다.
  pause/resume/approve/deploy/merge/delete × CSRF 없음/유효 = **12개403**, query spoof400,
  foreign Origin403. runtime의 durable read-side는 제어 실행을 하지 않았다.
- `docker exec ...-web /opt/venv/bin/python /opt/anvil/formal.py revoke` exit0 COMMITTED;
  `docker restart ...-web` 후 같은 persisted session으로 4개 메뉴 **모두403**.
  stats: heads1/receipts4/revoked1, owner0015/app0013 유지.
- `docker stop ...-web` 후 BFF actual HTTP 조회 **503 OFFLINE**, exit0.
  이 live HTTP 묶음은 pytest 건수와 혼합하지 않는다.

### Cleanup·불변 증거

정확한 label `anvil.c30r3.task4=20260920-0120` 검증 후 bff/web/pg `docker rm -f`, network rm,
두 image tag rm을 수행했다. 임시 checkout의 resolved exact 경로·HEAD372718c·clean을 확인한 뒤 제거했다.
원격 cleanup script exit0: label container/network/volume/image 목록 모두 empty, checkout_exists=false.
빌드 출력에 나온 intermediate image exact14 IDs도 별도 inspect하여 residue[] exit0.
SSH tunnel46720 commandline 확인→종료→process 없음, QA browser tab 종료.
disposable data는 의도적으로 폐기됐으며 외부 서비스 복구는 필요하지 않다.
기존 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`,
image `sha256:c0254177b858d93457585d2c268f43b3386ca20c18a47e4af9460174320488e9`,
StartedAt `2026-09-19T08:16:52.620522074Z`, Running=true를 전후 exact 비교해 불변 확인했다.
기존 다른 서비스/DB/volume/config/key 변경0.

### 최종 로컬 검증·남은 경계

- `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_c30r3_formal_entity.py --tb=short`
  → exit0 **24 passed/0 skipped,3.52s** (기존 warning1).
- `C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_c30r3_formal_entity.py tests/integration/test_c30r3_runtime_restore.py tests/agent_team/test_owner_component_restore.py tests/integration/test_c30r2_runtime_owner.py tests/integration/test_c30r2_formal_entity.py tests/integration/test_c30_console_e2e.py --tb=short`
  → exit0 **159 passed/0 skipped,12.31s**, 기존 python_multipart warning1.
- 실제 authenticated browser 정상/empty/revoked 흐름 및 Network inspection은 BLOCKED/NOT_VERIFIED.
  Provider/Telegram/Kakao/Oracle/production/PG18 실행0, 일반 production auth 연결 미검증.
  이 제한을 해소하기 전 formal acceptance를 요청하지 않는다.
- exact3 밖 제품/control 변경0. progress-events/build-progress JSON은 Main 소유라 수정하지 않았다.
  Main completion event에는 INCOMPLETE, 위 actual PG/HTTP/restart/revoke/cleanup, browser blocker를 구분해 결박한다.
- rollback: Task4 exact3 commits만 Main 검토 후 revert. 기존 history 원문/제품/DB는 보존하며
  disposable 자원은 이미 제거됐으므로 남은 외부 rollback0. lease는 임의 revoke하지 않았다.
- 최종 `PY -B -c "from pathlib import Path; p=Path('tests/integration/test_c30r3_formal_entity.py'); compile(p.read_bytes(),str(p),'exec'); print('COMPILE_PASS exact1')"`
  및 `git diff --check` 각각 exit0. 보고/HANDOFF append-only delta135 lines 확인 뒤 이 구문 결과를 추가했다.

### 마지막 승인 경로 재시도 — 플랫폼 실행 거부 후 종료

Main은 새 fixture/제품 코드 없이 기존372718c와 설치 Chrome의 임시 headless/CDP profile로
마지막 browser 검증을 지시했다. exact372718c Git-only checkout 및 같은 cached base/source로
disposable image를 재생성했다(이전 image는 이미 정리됐으므로 digest 동일을 주장하지 않는다).
재생성 image `sha256:e43d24d332e8fa340cc3b5a74b125d8d8009698659e0e8b7dfeaa1e2189f7927`,
network `bfcaca2bb78cfad634887f87ee461279a6ef4640c8e467627c901f3010a8a0da`,
PG `7c4e78f44beae797c18a1a945b90f6bfeb471f25bedb88b4925ebf6326fb6df0`,
web `4114c599d79f470f9cde139203eeab96dfadc4f6f488ed88ed1dee78c388b8c3`,
BFF `ad6cc69dceb68569134fa9fc4ebd13577415cff780d48012acc9dabd5e8697b3`.
같은 prefix/label, app0013/owner0015 적용 및 snapshot1/receipt0를 확인했다.

플랫폼 auto-review가 Chrome 실행 명령을 **CreateProcess 이전에 거부**했다:
`This action was rejected due to unacceptable risk.`
사유: `CUA 차단 후 별도 Chrome headless/CDP·WebSocket 경로로 브라우저 로그인과 검증을 우회하려 하며,
해당 접근 방식에 대한 사용자의 구체적 승인이 없다.`
따라서 해당 browser/profile/tunnel/CDP 실행0, 새 screenshot0, Network 증거0.
우회 명령·다른 브라우저 실행·반복 재시도0. Main에게 즉시 원문/정확한 안전 승인 경계를 보고했다.

`ssh -o BatchMode=yes WSL-server "tr -d '\\r' | python3 -"` cleanup script exit0:
재생성 owner revoke COMMITTED, exact label 검사 후 3container/network/image/tmp Git checkout 제거,
container/network/volume/image 목록 모두 empty, checkout_exists=false, 기존 anvil-web identity/running 불변.
로컬 `Get-ChildItem .../.codex-sandbox -Directory -Filter c30r3-browser-*` 결과 empty.
이 후속 재시도에서는 browser/tunnel 프로세스가 시작되지 않아 종료할 신규 프로세스도 없다.

최종 판정은 **INCOMPLETE/browser BLOCKED**, formal FAILURE_REPORT0으로 유지한다.
제품/test 파일 변경0; report/HANDOFF만 append했다. 이전24P/159P 결과는 코드 불변의 앞선 실행 증거이며
이번 문서 보강으로 새 pytest 실행을 주장하지 않는다. 다음 행동은 해당 headless/CDP 방식에 대한
사용자 직접 실행 안전 승인을 받은 뒤 별도 검증을 수행하는 것이다. 승인 전 재생성·우회 실행하지 않는다.

### 사용자 승인 후 Windows isolated Chrome 단일 재시도 — 2026-09-20 05시대

Main이 사용자 명시 승인을 전달했다: Windows Chrome의 임시 격리 profile/headless/CDP 사용,
기존 프로필·탭·계정 불사용, 기존372718c fixture만 재사용, 검증 뒤 전부 정리.
이 승인으로 앞선 플랫폼 거부 경계는 해소됐고 실제 Chrome을 시작했다. 새 제품/fixture 변경0.

- 시작 canonical clean HEAD `af03459a6c961eb3b3f13eee1ace9d25b13d7357`,
  host2026-09-20T04:57:37+09:00, Task4 epoch1 lease ACTIVE/12:05 만료 전.
- exact372718c Git-only disposable checkout, cached base 동일, 실제 재생성 image
  `sha256:b2d394f9966e80f3bff6dec27341c2b99b14f57b691f32aa1ca36cff8dc1a9ae`.
  network `0c2a2f585baf279e187d207fab77cbc7ff9698780c53e0866077ddaabf062113`,
  PG `eb0f0b882273eebb3fea3046a60f9d83c283c5b4f2986b1038e7919c3a8d0a53`,
  web `7f648e675e8c023059631d73fe28162486e6d875497873eda882810c3247734a`,
  BFF `e4dbdd3ea2ba3d3e5759b506d1d6d189e0bf8de9d635a0564e8f46be9da019a8`.
  app0013/owner0015, new snapshot1 COMMITTED hash
  `sha256:c1994e33186e102bff6e273c48e455c8e76c2dbf8f42d99eb1874c47795ff701`.
- 실행 명령은 `C:/Users/cyhuh/anaconda3/python.exe -B -`로 inline CDP verification script를 소비했다.
  script의 Chrome argv: `C:/Program Files/Google/Chrome/Application/chrome.exe --headless=new
  --no-first-run --no-default-browser-check --remote-debugging-address=127.0.0.1 --remote-debugging-port=0
  --user-data-dir=<new .codex-sandbox/c30r3-browser-* temporary directory> about:blank`.
  PID31836, localhost CDP/WebSocket 연결 성공. 기존 사용자 profile 접근0, security bypass flag0.
  SSH alias tunnel은 loopback4173→disposable bridge4174만 사용했다.
- 실제 `/auth/c30r3-qa` 로그인 form에서 account=qa-reader를 입력·submit한 후
  `/agent-console` 정상 status 대기에서 실패: `BROWSER_WAIT_FAILED`, Chrome 화면
  `127.0.0.1에 대한 액세스가 거부됨 / 이 페이지를 볼 수 있는 권한이 없습니다. / HTTP ERROR 403`.
  이 실행은 이전 ERR_BLOCKED_BY_CLIENT와 다른 **실제 HTTP403**이다. 원인 response body/header가
  별도 수집되지 않았으므로 middleware/fixture/권한 중 특정 원인으로 단정하지 않는다.
  인증 4menu/Network/CSP/revoke browser 단계에 도달하지 못했으며 해당 결과를 PASS로 표시하지 않는다.
- 단일 script exit1, finally는 성공: `ALL_DISPOSABLE_CLEANUP_PASS`.
  CDP Browser.close→Chrome 종료 대기, own tunnel 종료, exact resolved temporary profile 제거.
  remote exact label container/network/volume/image empty, checkout_exists=false,
  기존 anvil-web ID/image/StartedAt/Running 불변. 로컬 profile glob empty/PID31836 없음을 재확인했다.
  screenshot 생성0, 남은 DB/credential/resource0. 다른 재시도나 fixture 수정은 하지 않았다.

현재 WORK_STATUS: **INCOMPLETE / browser QA login HTTP403 BLOCKED**, formal FAILURE_REPORT0.
앞선 실제 PG/restart/receipt/revoke/BFF 검증은 보존하되 이번 실패를 상쇄하지 않는다.
기존24P/159P는 앞선 코드 불변 검증 결과이며 이번에는 보고/HANDOFF만 append했다.
다음 조치는 Main이 403 response와 기존 QA login/auth forwarding 계약의 read-only 원인을 판단하는 것이다.
이번 승인된 단일 browser retry는 종료됐으며 모든 disposable 자원은 제거됐다.

### C30R3 QA wiring rework 및 단일 실제 Chrome 종료 — 2026-09-20 05:45 KST

판정: **INCOMPLETE**. fixture-only QA login wiring 구현·로컬 회귀는 완료했으나,
실제 browser의 revoke 후 재시작 권한 화면 검증이 완료되지 않았다. formal FAILURE_REPORT0.
앞선 기록을 덮어쓰지 않으며 Main acceptance/production auth PASS를 주장하지 않는다.

Main의 read-only 원인 확인: `/auth/c30r3-qa`는 기존372718c test FastAPI에만 등록되어 있고,
기존 BFF `/auth/*`는 `ANVIL_API_UPSTREAM`으로 전달한다. direct fixture HTTP는303+cookie이나
기존 browser POST는 API upstream에서403이었다. 승인된 exact5 중 server와 새 Node test만
구현 변경했고 기존 fixture/test/runtime/owner/schema에는 변경이 없다.

구현 commit: `64b76de4c7133ca5246c86d53fef448709e96641`.
`apps/web/server.mjs`는 명시적 fixture mode+fixtureEnabled+loopback QA upstream일 때만
exact QA route를 전달한다. production QA route404 및 기존 production auth proxy는 유지한다.
same-origin/Host/메서드/body/응답 크기/상대 redirect/HttpOnly cookie를 검증하고,
내부 주소·secret·임의 upstream body는 노출하지 않는다. QA form만 same-origin referrer policy,
일반 페이지는 기존 no-referrer를 유지한다. 새 로그인 fixture나 auth authority 생성은 없다.

#### TDD·실행 명령과 실제 수치

- `node --test apps/web/tests/c30r3-qa-login.test.mjs`
  최초 RED exit1 **10 failed/4 passed/0 skipped,261.3745ms** → 최소 GREEN exit0
  **14 passed/0 skipped,621.7582ms**.
- QA form referrer policy 및 안전 응답 보강 RED exit1 **1 failed/17 passed,329.9975ms**.
  `node --test --test-reporter=dot apps/web/tests/c30r3-qa-login.test.mjs`
  최종 GREEN exit0 **18 passed/0 skipped**.
- PowerShell `$env:ANVIL_PYTHON='C:\Users\cyhuh\anaconda3\python.exe'` 설정 후
  `node --test apps/web/tests/*.test.mjs`: exit0 **88 passed/0 failed/0 skipped,3640.4617ms**.
  production QA route absent, 기존 auth proxy, C28/C29 및 Python ASGI-BFF 회귀 포함.
  기존 Node MODULE_TYPELESS_PACKAGE_JSON warning은 보존한다.
- `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_c30r3_formal_entity.py tests/integration/test_c30r3_runtime_restore.py tests/agent_team/test_owner_component_restore.py tests/integration/test_c30r2_runtime_owner.py tests/integration/test_c30r2_formal_entity.py tests/integration/test_c30_console_e2e.py --tb=short`
  exit0 **159 passed/0 skipped,14.14s**, 기존 python_multipart warning1.
- `node --check apps/web/server.mjs`, `node --check apps/web/tests/c30r3-qa-login.test.mjs`,
  Python builtin compile(test_c30r3_formal_entity.py), `git diff --check`: 각각 exit0.

#### 실제 단일 browser 검증: 일부 PASS, revoke 이후 미완료

실행: `C:\Users\cyhuh\anaconda3\python.exe -B -` inline verification script(session40444).
기존 SSH alias `WSL-server`, mounted canonical exact64b76de Git-only checkout,
기존372718c fixture와 이번 fixture-only wiring만 사용했다. 외부 push0.
Chrome argv는 `C:\Program Files\Google\Chrome\Application\chrome.exe --headless=new
--no-first-run --no-default-browser-check --remote-debugging-address=127.0.0.1
--remote-debugging-port=0 --user-data-dir=<new c30r3-browser-* directory> about:blank`.
PID38568, 새 임시 profile만 사용; 기존 사용자 profile/tab/account 및 security bypass flag0.

- prefix `anvil-c30r3-t4-20260920-0120`, label `anvil.c30r3.task4=20260920-0120`.
- network `0f080540e02750d261d30a7abe305c801338148daea587ab6294c3ed72986504`;
  PG `a776615c17576dadeed37913049a425dc6a9758830c8fc71d1179ba14c20f481`;
  web `3a126aac8c942f4d608ef9596526e767c7a1fa2334c72eba87bab15fb9cf90f5`;
  BFF `8dc4fe048a78c7c20c5b6a6b0fa240e85a18750e7fd6d8064fbd5c0fafa2d340`;
  image `sha256:6ed12c4e13860978c1b5d8266ee8414cde6111ee78af762fc8a82502c8817a3f`.
- isolated PG15 app_db_head=`0013_task_bootstrap_authority`,
  owner_db_head=`0015_agent_team_owner`; seed COMMITTED hash
  `sha256:98cf30b5b95d224464cdf4be00a36bc964340a5482685df205b0006d8c03ad8e`.
  before revoke heads1/receipts4/revoked0. release/candidate DB schema 변경0.
- 실제 QA login 성공, `login_cookie_http_only=true`.
  Team/Adapters=`normal`, MoA/SNS=`empty`를 실제 메뉴 클릭으로 확인했다.
  Network200 네 경로: `/api/agent-console/team`, `/moa`, `/sns`, `/adapters`
  (후자3개도 동일 `/api/agent-console` prefix). 모두 browser origin
  `http://127.0.0.1:4173` 상대 요청; foreign/internal-address requests0.
- CSP: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
  script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'`.
  uncaught JavaScript exceptions0, favicon resource error1. console 전체 error0으로 표시하지 않는다.
- repository revoke=`COMMITTED` 후 exact disposable web OS restart 실행.
  이후 permission 화면 대기는 실패했다. 원문:
  `RuntimeError: BROWSER_WAIT_FAILED ... Team READ-ONLY PROJECTION Team ... offline ...`.
  출력의 한국어 일부는 console encoding으로 깨졌으나 `Team ... offline`은 확인된다.
  이 단계의 response status/body 및 원인은 확정하지 못했으므로 revoked browser403 PASS를
  주장하지 않는다. script exit1; `BROWSER_FORMAL_PASS`는 출력되지 않았다.
  단1회 승인된 retry가 종료됐으며 추가 재실행/제품 보완은 하지 않았다.

#### 정리·미검증·다음 행동

실패와 무관하게 finally 종료: `ALL_DISPOSABLE_CLEANUP_PASS`.
Chrome Browser.close 및 own process 종료, own SSH tunnel 종료, exact temp profile 제거.
remote exact label container/network/volume/image 목록 모두 empty,
`checkout_exists=false`, `anvil_web_unchanged=true`를 확인했다.
05:45 로컬 추가 확인에서 c30r3-browser-* profile0/PID38568 없음, screenshot 생성0.
기존 anvil-web ID/image/StartedAt/Running은 위 보호 기준과 exact 불변이다.

남은 조건은 revoke→restart 이후 실제 browser permission/403의 완결 검증이다.
이번 offline 원인의 read-only 진단과 후속 실행 여부는 Main 판단이며, 추가 retry는 자동 수행하지 않는다.
Provider/외부계정/production/PG18 및 일반 production auth는 NOT_EXECUTED/NOT_INTEGRATED.
progress JSON/events는 Main 소유라 변경0; Main은 이 결과를 append-only event에 결박해야 한다.
승인된 exact5 외 변경0, lease 임의 revoke0, push0.
rollback은 Main 검토 후64b76de의 exact2 구현만 revert하며 과거 evidence는 보존한다.
이미 제거된 disposable 자원에 추가 외부 rollback은 없다.

문서 마감 직전 fresh 검증: `node --test --test-reporter=spec apps/web/tests/*.test.mjs`
(동일 ANVIL_PYTHON 설정) exit0 **88P/0F/0S,2604.3864ms**;
위 동일 Python 관련 명령 exit0 **159P/0S,12.14s**, warning1.
두 Node `--check`/Python builtin compile/diff-check 모두 exit0.
문서 변경은 report/HANDOFF append-only 2경로이며 제품64b76de는 불변이다.

### b84a610 후속 read-only 원인 분석 — 실행·재생성 없이

판정 **INCOMPLETE 유지**. 보존 로그와 현재 코드만 읽었으며 browser/컨테이너/DB 재생성,
제품·fixture·테스트 수정, 추가 pytest 및 progress completion event 생성은 하지 않았다.

확인 사실:

- `apps/web/src/app/c29-console-runtime.js`의 `select()`는 error.status403을 `permission`,
  503을 `offline`, 그 외 오류를 `error`로 표시한다. 화면 `offline`은 이 클라이언트 분류의
  증거이지 실제 API가503을 반환했다는 단독 증거는 아니다.
- `apps/web/src/api/c29-agent-console-client.js`는 실제 fetch 실패도 status503으로 변환한다.
  BFF `apps/web/server.mjs:161~188`은 연결/timeout/JSON 검증 오류 및 upstream 비403 오류를
  safe503으로 바꾸고, 정상 JSON upstream403은403으로 유지한다.
- API runtime route는 authority ValueError/TypeError/KeyError를403으로, 그 밖의 exception을
  503으로 변환한다(`apps/api/anvil_api/routes/agent_console.py:229~233`). 따라서 browser만의
  offline 관찰로 API 권한 판정, BFF upstream 실패, fetch transport 실패를 구분할 수 없다.
- 실제 마지막 실행의 확인 순서는 네 메뉴200/HttpOnly cookie→PG stats heads1/receipts4/revoked0
  →revoke COMMITTED→`docker restart` web 명령 반환→browser permission 대기 실패→finally cleanup이다.
  web restart 명령 반환은 API readiness 또는 BFF 연결 복구의 확인을 대신하지 않는다.
- 기존 fixture는 환경의 같은 QA session 값을 사용하고 요청마다 persisted mapping/snapshot을
  읽는다. 앞선 실제 HTTP 검증에서는 restart/reload/revoke403이 확인됐으나, 그 과거 증거를
  이번 browser의 cookie 재전송·session reload·revoked row 재조회 PASS로 승격하지 않는다.
- finally는 browser 실패 이후 실행되어 residue0/기존 anvil-web 불변을 확인했다.
  cleanup 완료 사실은 오류 순간의 web/BFF/API health나 생존을 증명하지 않는다.

미확정:

- revoke 후 정확한 browser response status/body, Network.loadingFailed 이유, cookie 존재/전송
  여부(값 제외), web/BFF/API의 같은 시점 health 및 restart 후 owner 재조회 결과는 미수집이다.
- 앞선 실행에 restart 직후 readiness retry가 필요했던 사실을 고려하면 startup/readiness race가
  후보이나 확정 원인이 아니다. BFF network namespace/connection 상태와 API exception도 미배제다.
- 이번 대기 오류가 최초 일시 실패 후 재요청 없이 화면 상태만 기다렸기 때문인지, 지속 장애인지
  확정할 보존된 post-restart response timeline은 없다. teardown이 원인이었다는 증거도 없다.

최소 후속 실행 제안(현재 **미실행**, Main의 별도 실행 지시 전 재생성 금지): 동일 승인 source와
fixture로 단1회 revoke/restart 경계에서 API/BFF readiness·생존을 먼저 시간순으로 확인하고,
기존 브라우저 세션의 단일 메뉴 요청에 대한 HTTP status/안전한 오류 body 또는 loadingFailed를
수집한다. cookie는 존재/HttpOnly/동일성 hash만 기록하고 값·credentials는 기록하지 않는다.
그 결과로 authority403, upstream503, transport 실패 중 한 경계를 식별한 뒤에만 수정 판단한다.
새 기능/fixture/자동 retry 정책을 추가하지 않으며 모든 disposable 자원 finally cleanup을 유지한다.

### 2026-09-22 단일 response-capture 진단 실행

판정은 **INCOMPLETE**다. 동일 source/fixture에서 승인된 단1회 진단을 실행했으나 목표였던
revoke 이후 browser status/body 수집 전에 disposable web 초기 기동이 실패했다.

- 기준 HEAD `9b03c1afce31c4dbdebeff8c893a2030b89745bc`, 제품·fixture 변경0.
- 실행 전 exact prefix container/network/volume/image/tmp residue0. 기존 `anvil-web`은 현재
  ID/image/StartedAt/running/healthy tuple을 보호 기준으로 고정했다.
- disposable PG15 migration과 owner seed는 `COMMITTED`까지 성공했다.
- disposable web `5f1114524ec7`은 startup exit1. 최초 readiness 결과는
  `[{"path":"/health/live","error":"URLError"},{"path":"/health/ready","error":"URLError"}]`였고,
  inline 진단은 `RuntimeError: API_READINESS_FAILED`로 exit1 종료했다.
- cleanup과 로그 조회가 경합해 후속 read-only `docker logs`는 `no such object`로 실패했다.
  따라서 web startup의 원본 exception은 미확정이며 임의 원인을 지정하지 않는다.
- browser login, revoke, restart, response status/body/loadingFailed 수집에는 도달하지 못했다.
  같은 실행의 추가 retry·재생성은0이다.
- finally cleanup은 PASS: 생성 image/network/PG/web/BFF 및 Chrome PID52484, 임시
  profile/tunnel/tmp checkout을 제거했고 exact residue0을 확인했다. 기존 `anvil-web` 보호 tuple과
  health, 실행 전 사용자 dirty report/HANDOFF SHA는 전후 불변이었다.

이번 실행은 기존 normal/empty/same-origin browser PASS나 revoke COMMITTED 증거를 취소하지 않지만,
revoked browser permission/403을 추가로 증명하지도 않는다. 다음 진단은 startup 실패 원문을 cleanup
전에 수집할 별도 증거 경로가 먼저 필요하며, 현재 formal acceptance=false를 유지한다.

### 2026-09-22 C30R3 Task4 browser formal 마감

판정은 **COMPLETED_FORMAL_FIXTURE_SCOPE**다. 최종 단일 실행 `session15435`는 exit0이며,
격리 PG15·container·restart·동일 browser session에서 revoke 이후 실제 HTTP403과
`Team · permission` UI를 확인했다. 이는 fixture-mode C30 formal 증거이며 production auth,
Provider, PG18, Oracle 배포 증거로 승격하지 않는다.

#### 선행 실패 원인과 교정

- 첫 response-capture startup 실패 원문을 별도 startup-only 실행에서 cleanup 전에 보존했다.
  runtime은 `TELEGRAM_INTERNAL_SIGNING_SECRET`을 요구했지만 진단 런처가
  `INTERNAL_SIGNING_SECRET`만 주입해 import-time exit1이었다. 제품 결함이 아니며 secret 값은
  출력하지 않았다. 키 이름만 교정한 뒤 live/ready가 모두200으로 복구됐다.
- revoke/restart 뒤 직접 API는403이었지만 기존 BFF 경로는 `ERR_CONNECTION_RESET`이었다.
  web restart 전 web/BFF net inode는 모두 `4026533760`; restart 뒤 web은 `4026533820`,
  기존 BFF는 `4026533760`에 남았다. `network=container:web` BFF를 동일 설정으로 1회 재생성한 뒤
  둘 다 `4026533820`, BFF health200으로 회복했다. 원인은 web container restart 후 BFF가
  이전 network namespace에 남은 disposable 검증 topology였다.
- 중간 namespace-only 실행은 PostgreSQL 초기화 임시 postmaster 종료 race로 DB 생성 전에 중단했다.
  최종 실행은 PID1=`postgres`, `SELECT 1`과 동일 postmaster start time을 3회 확인한 뒤 진행했다.
- 직전 실행은 browser403까지 확인했으나 `Network.getResponseBody`의 CDP -32000으로 UI 수집 전에
  종료됐다. 최종 실행은 body를 직접 API에서 수집하고 CDP body 호출 없이 DOM을 끝까지 확인했다.

#### 최종 실제 증거

- exact source `9b03c1afce31c4dbdebeff8c893a2030b89745bc`, immutable base image
  `sha256:88774a6d0df2acce6eb36588ac3320c958fe3cb99e497551f20d07be7e7b21d7`,
  실행 image `sha256:95294efe116e12c5e95bf0b43da1cc0f9fc82b7fc24b7cdb252f9626bdbee5c1`.
- app DB head0013, owner DB head0015, seed/revoke COMMITTED, receipts4, revoked1.
  release/candidate schema와 기존 DB는 변경하지 않았다.
- 격리 Chrome 새 profile에서 HttpOnly QA cookie를 발급받고 Team/Adapters=`normal`,
  MoA/SNS=`empty`, same-origin 네 API200, foreign/internal-address request0, CSP self,
  uncaught JavaScript exception0을 확인했다.
- web restart 뒤 live/ready200. 직접 API는403과
  `{"state":"PERMISSION_DENIED","reason":"CONSOLE_REQUEST_DENIED","counts_as_pass":false}`.
- BFF를 새 web namespace에 1회 재결합한 뒤 동일 Chrome·tunnel·HttpOnly cookie가 유지되고
  Cookie header가 재전송됐다. browser `Network.responseReceived`는403, loadingFailed0,
  DOM은 실제 `Team · permission`; `offline`과 `error`가 아님을 확인했다.
- 예상된 API403과 favicon404 resource console 항목은 각1건이며 이를 error0으로 표시하지 않는다.

#### 정리와 경계

각 실행은 cleanup 전에 inspect/log를 보존했다. 최종적으로 Chrome/profile/tunnel,
container/network/volume/image/tmp checkout residue0이며 기존 `anvil-web`의 identity, image,
StartedAt, running, healthy tuple은 불변이다. 제품·fixture·Git 변경0, 외부 Provider/production/PG18
실행0. 남은 절차는 C30 전체 독립 Reviewer의 C/I finding 판정과 문서·test fresh gate다.

문서 반영 후 fresh gate: `node --test --test-reporter=spec apps/web/tests/*.test.mjs`
exit0 **88 passed/0 failed/0 skipped,2663.7486ms**. C30R3 관련 Python 6파일 회귀는
exit0 **159 passed/0 skipped,14.30s**, 기존 `python_multipart` warning1. `git diff --check` exit0.
