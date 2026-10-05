# F-20/U-01 R44 Health 상세 원인 이동 결과

## 판정

`INCOMPLETE` — 제품 변경과 로컬 GREEN은 확보했다. Main의 WSL-server PG15/OIDC/HTTPS/Chromium opt-in은 저장 경고 순서 보정 뒤에도 실패했다. 최신 진단 보완 diff의 실제 재실행은 아직 없다. R44/U-01/F-20 전체 인수는 미완료이며 ReleaseDecision `DEFER`, Production `NOT_EXECUTED`다.

## 판단 이유

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
- Task 2: 별도 격리 QA `backend` LATE 신호를 기존 R35 Database `HEALTHY/0`와 병존시키고, 기존 R43 저장 경고 검증 이후에 Health alert 1건을 생성하는 하네스와 카드 클릭 단언을 추가했다. Node audit self-test와 Python 비 opt-in은 GREEN이다. Main의 첫 실제 브라우저 실행은 순서 단언에서 실패했고, 현재 보정본의 실제 클릭 PASS는 아직 주장하지 않는다.

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
- 기존 Network/Secret/PNG와 R35/R43 단언은 로컬 하네스 회귀에 남아 있다. WSL 브라우저 실행은 두 차례 모두 실패했으며 최신 진단 diff의 실제 Network·PNG, PG15 저장·OIDC/HTTPS 클릭 및 철회는 `NOT_EXECUTED`; Provider·PG18·Production도 미검증이다.
- Main 소유 Event/progress/HANDOFF/WORK_STATUS/control, commit/push, WSL-server·ysna/Production 변경 0. 빌드 출력 정확 3파일과 빈 `dist` 폴더만 검증 후 제거했고 임시 자원 잔여 0이다.
- Rollback: Main이 이 exact5의 R44 diff를 검토 후 배제한다. 현재 미커밋 변경을 다른 사용자 자료와 함께 초기화하지 않는다. 다음은 Main이 새 격리 PG의 실제 WSL opt-in에서 안전 진단 marker를 확인하고, 식별된 원인에 따라 재작업을 지시한다.
