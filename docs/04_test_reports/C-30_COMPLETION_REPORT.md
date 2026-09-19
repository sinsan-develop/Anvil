# C-30 로컬 통합·WSL formal preflight 완료보고

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
