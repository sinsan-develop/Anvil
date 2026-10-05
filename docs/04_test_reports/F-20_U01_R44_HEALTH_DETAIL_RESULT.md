# F-20/U-01 R44 Health 상세 원인 이동 결과

## 판정

`R44 절편 PASS` — Main이 clean SHA `31e23fe5c59456484ce5072af38eba7eb41d5d10`의 WSL-server PG15/OIDC/HTTPS/Chromium 실제 검증과 전용 자원 정리를 완료했다. 앞선 실패들은 실패 이력으로 유지한다. 이 판정은 R44 Health 상세 클릭 절편에만 적용된다. U-01/F-20 전체 인수는 미완료, ReleaseDecision `DEFER`; PG18·Provider·Production은 `NOT_EXECUTED`다.

## 판단 이유

### R44 최종 WSL 실제 QA PASS 및 정리 (Main 출처)

- Main 보고: clean SHA `31e23fe5c59456484ce5072af38eba7eb41d5d10`, G-05 `PASS sequence=2070`, Node24 console 77 PASS·typecheck·lint·build(20 modules) PASS. 새 격리 tmpfs PostgreSQL 15 비관리자 DB migration `0019_oidc_sessions`에서 HTTPS/OIDC/Chromium opt-in `1 passed, 45 deselected, 1 httpx deprecation warning in 9.53s`, exit0.
- 같은 실제 실행에서 새 `backend` LATE Health 신호의 저장 alert와 카드 fragment 클릭, API↔DOM 원인 일치, 인증 전·권한 철회 후 상세 0건을 확인했다. 기존 R35 Database `HEALTHY/0`와 R43 Critical 우선 Next Actions 순서도 유지했다. Network/Secret 계약 단언을 포함한다. 저장 화면 PNG에서 Health 상세는 viewport 아래였으므로 실제 클릭과 상세 내용은 Chromium/DOM 단언의 증거이며 PNG 육안 증거로 확대하지 않는다.
- Main 전달 증거 exact4 SHA-256: `page-requests.json` `84e8abbbc6457e4e12bbfac39a2fcf348391167573a371d54f381607f908513d`; `pre-auth-error.png` `5d15edf6fa754ccaef53761ebf192c3b16b6afac8ea0155ad55e5e2a52a53c13`; `revoked-blocked.png` `551ccc100255d654a914bbc3cd8d66bbd869c0017dc727dbe82376bdc6dbf028`; `stored-critical.png` `02af741e6f0342632c151301972d15ade5cde0ed87fca8f21acee4a38ccad8a9`. Main은 복사본 hash를 대조하고 PNG 3장을 육안 확인했다: pre-auth BLOCKED, stored Critical/Next Action, revoked BLOCKED.
- `page-requests.json` scope는 `R6B_LOOPBACK_QA_ONLY`, 선언/실제 요청 `77/77`, HTTPS `127.0.0.1` 단일 origin, query·fragment·userinfo 0이다. 이는 해당 QA Network 범위의 결과이며 전체 운영망 검증이 아니다.
- Main은 PASS PG container ID `ec01fd80bf77eed27cc6c930a2a7b2b3fdfc147772456d420b4448016b1f16d4`의 정확 scope/SHA/AutoRemove/mount 0을 확인 후 stop/auto-remove했다. 앞선 실패 PG, R44 전용 checkout 4곳·evidence 4곳·venv·Playwright·로컬 visual copy도 신원/realpath/hash 검증 후 제거했고, R44 전용 container·port 5545·paths 잔여 0이라고 보고했다. 공유 `local-postgres` Up, `anvil-web` healthy 상태는 유지됐다.
- Developer의 이번 변경은 이 결과보고서 exact1뿐이다. 기존 정식 FAILURE_REPORT 0회·하네스 결함/실패 이력과 rollback 경계는 유지한다. R44 절편 밖 U-01/F-20 인수, PG18·Provider·Production은 이 PASS로 승격하지 않는다.

### R44 세 번째 WSL 실패 후 철회 전 상태·안전 진단 보정 (Main 출처, Developer 로컬 재작업)

- Main 보고: clean SHA `4ad9954472eda897f9f595ae6e561fb758a62c7b`의 새 빈 PG/full-evidence 실제 WSL opt-in은 `R6_BROWSER_FAILED stage=REVOKE_FETCH exit=1 class=UnhandledError`로 실패했다. 새 Health 카드 클릭 블록 이후의 실패이며, 이전 safe marker의 단언 code는 허용 목록 밖 또는 `UNCLASSIFIED`여서 정확 원인은 미확정이다. 실패 PG는 Main이 정확 ID 확인 후 폐기한다고 전달했다.
- 재작업 시작 HEAD 위 SHA, canonical seq2070 epoch59 worker/write ACTIVE·두 토큰·exact5·유효기간 및 G-05 PASS를 재확인했다. 시작 Git dirty는 Main 소유 `docs/WORK_STATUS.md`뿐이다. Main 소유 파일·Git·WSL은 수정하지 않았다.
- source 판정: `OperationsService.snapshot()`은 열린 저장 alerts 2건을 순서대로 `next_actions`에 투영한다. R44 Health seed 후 기존 R43 Critical과 새 Health Warning 두 조치가 같은 Dashboard 응답에 있고 `readyDashboard(...,'STORED')`가 화면에도 두 행을 표시한다. 철회 직후 API를 직접 읽는 호출은 화면을 갱신하지 않는데, 기존 하네스가 그 사이 `nextCard li == 1`을 요구했다. 이 단언은 잘못됐다. 다만 해당 단언 위치의 stage는 `REVOKE_DASHBOARD_FETCH`이며 Main이 받은 `REVOKE_FETCH/UnhandledError`와 일치하지 않아 비동기 rejection 등 다른 원인 가능성은 남긴다.
- 보정: 철회 전 Critical-first/Health-second alert와 Next Actions 2건의 API↔DOM 대응을 검증하고, 기존 철회 뒤 0건 단언을 유지한다. 제품 동작은 바꾸지 않았다. 실패 marker는 허용된 stage·Error.name·R44와 해당 R27 철회 단언 코드만 출력한다. 그 밖의 값은 `UNCLASSIFIED`/안전한 기본 오류명으로 축소하며 원본 URL/cookie/token/body/error message/stack은 출력하지 않는다.
- RED: `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit1(두 조치 검증 함수 부재), 이후 Error.name/R27 허용 코드 회귀도 같은 명령에서 exit1; `python -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k r44_node_failure` exit1(안전 marker의 Error.name 미분류). GREEN: Node audit self-test exit0 `R6_AUDIT_SELF_TEST_PASS`; Python 집중 1 PASS, 전체 비 opt-in `45 passed, 1 skipped, 1 warning` exit0; `git diff --check` exit0; 지정 venv G-05 seq2070 PASS exit0.
- 현재 diff의 새 PG/Chromium 실제 재검은 Main 담당 `NOT_EXECUTED`. 이전 `REVOKE_FETCH` 실패를 보정본의 PASS로 승격하지 않는다. 정식 Developer FAILURE_REPORT 0회.

### R44 두 번째 WSL 실패 후 secret-safe 진단 보완 (Main 출처, Developer 로컬 재작업)

- Main 보고: SHA `17446a2578b15d83979ac2fccfcf691e4653278d`의 첫 full-evidence 실제 WSL opt-in은 `EVIDENCE_STORED`의 `AssertionError`로 실패했다. 이어 별도 새 빈 PG에서 evidence-dir 없이 재실행한 경우에도 `R6_BROWSER_FAILED stage=NODE_UNHANDLED exit=1 class=UnhandledError`로 실패했다. Docker Node24 런처 probe는 정상이고 browser container 잔여 0이라는 Main 관측이다. 두 PG는 Main이 정확 ID 확인 후 제거했다고 보고했다. 실패의 실제 내부 단언 코드는 기존 분류 출력에서 알 수 없으므로 원인을 단정하지 않는다.
- 재작업 시작 HEAD `17446a2578b15d83979ac2fccfcf691e4653278d`, branch clean(except Main 소유 `docs/WORK_STATUS.md` 변경), canonical seq2070 epoch59 dual lease ACTIVE·유효 토큰·exact5 및 G-05 PASS를 재확인했다. 이 HEAD 이후 Main 소유 파일·Git·WSL은 수정하지 않았다.
- 가설: Node가 시작한 뒤 유효한 `R6_BROWSER_FAILED` marker가 없거나 인식되지 않아 Python이 `NODE_UNHANDLED`로 분류했고, 마지막 허용 stage와 R44 단언 코드가 숨겨졌다. 제품 오류인지 하네스 예외인지는 현재 증거로 확정할 수 없다.
- Node 실패 경계는 허용된 stage와 여섯 개 R44 단언 코드만 `R6_SAFE_FAILURE`로 출력하고, 나머지는 `UNCLASSIFIED`로 표시한다. 처리되지 않은 rejection/exception도 같은 안전 marker만 남긴다. error class도 기존 허용 클래스만 출력한다. Python은 marker 또는 마지막 `R6_STAGE`에서 허용 stage만 가져오고, 명시 allowlist에 있는 R44 단언 코드만 보고문에 덧붙인다. 원본 URL/cookie/token/response body/error message/stack은 새 진단 출력에 포함하지 않는다.
- RED: `python -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k r44_node_failure` exit1, 기존 분류가 `NODE_UNHANDLED`; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit1, 안전 코드 함수 미구현. GREEN: 같은 Python 집중 1 PASS, 전체 비 opt-in `45 passed, 1 skipped, 1 warning` exit0, Node audit self-test `R6_AUDIT_SELF_TEST_PASS` exit0, `git diff --check` exit0, 지정 venv G-05 seq2070 PASS exit0.
- 최신 진단 보완 diff의 실제 WSL 재실행은 Main 담당 `NOT_EXECUTED`. 이 보완은 실패 식별력만 높이며 R44 실제 클릭·evidence export 합격을 증명하지 않는다. 정식 Developer FAILURE_REPORT 0회.

### R44 첫 WSL 실행 후 순서 보정 (Main 출처, Developer 로컬 재작업)

- Main이 기존 SHA의 실제 WSL opt-in을 처음 실행한 결과 `1 failed, 43 deselected`였다. 원인은 저장 경고의 정본 순서가 기존 R43 `WORKER_LEASE_EXPIRED` Critical(index 0) → 신규 `HEALTH_SIGNAL_LATE` Warning(index 1)인데, R44 Python seed와 JS 실제 브라우저 단언이 역순을 기대한 것이다. 이 실패는 R44 하네스 결함이며 제품 클릭의 합격 증거가 아니다.
- 재작업 시작 HEAD `80816ea21501ca63fd2bf33a9da23a005e3bf286`, clean branch `codex/f18-wsl-ops`; canonical seq2070 epoch59 dual lease ACTIVE·exact5·유효기간과 G-05 PASS를 재확인했다. Main 소유 파일·Git·WSL은 변경하지 않았다.
- Python seed는 Critical-first와 Health warning의 source/component/code를 확인한다. JS 브라우저 기대 순서도 Critical-first로 맞췄다. R44 validator는 전체 배열의 index가 아닌 `source=environment`와 `related_entity_id=backend`로 Health alert를 유일 선택하며, self-test에 Critical-first 양성과 중복 Health 음성을 추가했다.
- 로컬 RED: `python -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k r44_seed_keeps` exit1, 신규 순서 회귀 1 FAIL(`NameError`, 검증 함수 구현 전). GREEN 동일 명령 exit0, 1 PASS. `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit0 `R6_AUDIT_SELF_TEST_PASS`; Python 파일 전체 비 opt-in exit0 `44 passed, 1 skipped, 1 warning`; `git diff --check` exit0; 프로젝트 venv G-05 exit0 `PASS sequence=2070 reporting=AUTO_CONTINUE`.
- 이 순서 보정의 로컬 판정 시점에는 새 전용 PG/Chromium 실제 opt-in이 `NOT_EXECUTED`였다. 이후 두 번째 WSL 실패는 위 절에 별도로 기록했다. 정식 Developer FAILURE_REPORT 0회, 확인된 R44 하네스 순서 결함 1회 보정이다.

- 시작: `codex/f18-wsl-ops`, HEAD `102c507e61071821f54ec462c261df9686e98156`, `development/codex/f18-wsl-ops` 추적. `git status --short --branch`는 clean이었다. 기존 `.pytest_cache/` ACL 접근 경고는 그대로 두었다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R44 계획 `F8369DAC0310EF18DCAB3DC7B35E560EF8B0F95D0E9ED3C981D9A1D038297FE3`, WorkInstruction `C2515543380A1B78E8791978544A331B6C06BD5A5D1BF7A3EFD123C55D658F1F`, Invocation `F7E8674890C6358188AAC7359AAD87635D0F19838925069F1B9EBF6AE63161F1`. 실제 파일 hash 접두와 기준이 일치했다.
- canonical seq2070의 epoch59 worker `worker-lease-f20-u01-r44-r44health1005`와 write `write-lease-f20-u01-r44-r44health1005`는 `ACTIVE`, 같은 actor/subject/만료 `2026-10-05T23:40:31+00:00`, exact5 scope 및 서로 대응하는 두 fencing token을 확인했다. 시작 G-05 seq2070 PASS 기록을 확인한 뒤 수정했다.
- Task 1 RED: `npm run web:test` exit1, 신규 R44 카드 링크 단언 1건 실패, 기존 76건 PASS. 구현 후 77/77 PASS. 여섯 Health component의 실제 저장 alert 유일 결합, 무후보·중복·code/source/evidence 불일치·위조 경로·source gap·미래시각·정상 상태를 확인했다.
- Task 2: 별도 격리 QA `backend` LATE 신호를 기존 R35 Database `HEALTHY/0`와 병존시키고, 기존 R43 저장 경고 검증 이후에 Health alert 1건을 생성하는 하네스와 카드 클릭 단언을 추가했다. Node audit self-test와 Python 비 opt-in은 GREEN이다. Main의 첫 실제 브라우저 실행은 순서 단언에서 실패했으며, 이후 최종 SHA의 실제 클릭 PASS는 위 별도 절에 기록했다.

## 조치와 변경 전후

| 파일 | 변경 전 → 변경 후 |
|---|---|
| `apps/web/src/console/App.tsx` | Health 상태·시각·오류 수만 렌더링 → 같은 snapshot의 유효 신호와 유일한 저장 environment Health alert가 code/component/evidence/path로 일치할 때만 고정 `#health-detail-{component}` 링크와 읽기 전용 code/source/cause/impact/시각/evidence 표시. `detail_path`를 URL/DOM에 출력하지 않음. |
| `apps/web/tests/f15-console.test.mjs` | R35/R43 개별 계약 → 여섯 카드의 R44 양성·음성 회귀 추가. |
| `tests/browser/f20-u01-oidc-browser-pg15.mjs` | R35 Database·R43 Next Actions 검증 → 두 검증 뒤 별도 Health seed, 실제 카드 클릭·fragment·API↔DOM·인증 전/철회 후 상세 제거 단언 및 boolean evidence 추가. |
| `tests/integration/test_f20_u01_oidc_browser_pg15.py` | 기존 단일 저장 경고 QA → 격리 Health signal/alert 전용 seed route와 boolean/count evidence 검증 추가. 기존 R35 Database 값과 R43 경고 순서 단언 유지. |
| 이 결과보고서 | `NOT_EXECUTED` placeholder → 실제 로컬 증거와 미실행 범위 기록. |

### 실행 명령과 실제 결과

| 명령 | exit | 결과 |
|---|---:|---|
| `npm run web:test` (Task 1 RED) | 1 | 신규 R44 1 FAIL, 기존 76 PASS |
| `npm run web:test` (최종) | 0 | 77 PASS |
| `npm run web:typecheck` (초기) | 1 | 비로드 상태의 `detail` union 누락; 보정함 |
| `npm run web:typecheck` (최종) | 0 | TypeScript 오류 0 |
| `npm run web:lint` | 0 | Biome 오류 0 |
| `npm run web:build` | 0 | Vite 20 modules build; 생성 dist 정확 3파일 검증 후 정리 |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`, R44 validator 양성·음성 PASS |
| `python -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py` | 0 | 43 passed, 1 skipped(opt-in), 1 기존 dependency warning |
| `git diff --check` | 0 | 공백 오류 0 |
| `.\\.venv\\Scripts\\python.exe scripts/check_project_progress.py` | 0 | `G-05 project progress contract: PASS sequence=2070 reporting=AUTO_CONTINUE` |

- 정식 Developer `FAILURE_REPORT` 0회. 구현 중 기존 R35 상태 객체 deep equality 회귀 1회와 typecheck 1회는 보정했다. 기본 셸 ACL 실행 오류는 지정된 권한 실행으로 해소했고, 직접 Python checker import 오류 및 임시 dist로 인한 `R44_GIT_INVALID`는 프로젝트 venv 사용과 전용 출력 정리 후 G-05 PASS로 해소했다. `.pytest_cache`는 접근·정리하지 않았다.
- 기존 Network/Secret/PNG와 R35/R43 단언은 로컬 하네스 회귀에 남아 있다. 앞선 WSL 실패는 위 이력 그대로이며, 최종 clean SHA에서 PG15 저장·OIDC/HTTPS/Chromium 클릭·철회와 Network·PNG 검증은 Main 출처 PASS다. Provider·PG18·Production은 `NOT_EXECUTED`다.
- Main 소유 Event/progress/HANDOFF/WORK_STATUS/control, commit/push, WSL-server·ysna/Production 변경 0. 빌드 출력 정확 3파일과 빈 `dist` 폴더만 검증 후 제거했고 임시 자원 잔여 0이다.
- Rollback: Main이 이 exact5의 R44 diff를 검토 후 배제한다. 현재 미커밋 변경을 다른 사용자 자료와 함께 초기화하지 않는다. 다음은 Main이 최종 PASS 증거와 본 보고서의 범위·이력을 독립 검토하고 canonical control을 정리한다.
