# F-20/U-01 R44 Health 상세 원인 이동 결과

## 판정

`INCOMPLETE` — 제품 변경과 로컬 GREEN은 확보했지만 Task 2의 실제 브라우저 RED 및 WSL-server PG15/OIDC/HTTPS/Chromium opt-in은 실행하지 않았다. R44/U-01/F-20 전체 인수는 미완료이며 ReleaseDecision `DEFER`, Production `NOT_EXECUTED`다.

## 판단 이유

- 시작: `codex/f18-wsl-ops`, HEAD `102c507e61071821f54ec462c261df9686e98156`, `development/codex/f18-wsl-ops` 추적. `git status --short --branch`는 clean이었다. 기존 `.pytest_cache/` ACL 접근 경고는 그대로 두었다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R44 계획 `F8369DAC0310EF18DCAB3DC7B35E560EF8B0F95D0E9ED3C981D9A1D038297FE3`, WorkInstruction `C2515543380A1B78E8791978544A331B6C06BD5A5D1BF7A3EFD123C55D658F1F`, Invocation `F7E8674890C6358188AAC7359AAD87635D0F19838925069F1B9EBF6AE63161F1`. 실제 파일 hash 접두와 기준이 일치했다.
- canonical seq2070의 epoch59 worker `worker-lease-f20-u01-r44-r44health1005`와 write `write-lease-f20-u01-r44-r44health1005`는 `ACTIVE`, 같은 actor/subject/만료 `2026-10-05T23:40:31+00:00`, exact5 scope 및 서로 대응하는 두 fencing token을 확인했다. 시작 G-05 seq2070 PASS 기록을 확인한 뒤 수정했다.
- Task 1 RED: `npm run web:test` exit1, 신규 R44 카드 링크 단언 1건 실패, 기존 76건 PASS. 구현 후 77/77 PASS. 여섯 Health component의 실제 저장 alert 유일 결합, 무후보·중복·code/source/evidence 불일치·위조 경로·source gap·미래시각·정상 상태를 확인했다.
- Task 2: 별도 격리 QA `backend` LATE 신호를 기존 R35 Database `HEALTHY/0`와 병존시키고, 기존 R43 저장 경고 검증 이후에 Health alert 1건을 생성하는 하네스와 카드 클릭 단언을 추가했다. Node audit self-test와 Python 비 opt-in은 GREEN이다. 실제 브라우저 RED를 기존 App과 신규 단언으로 실행하지 않았으므로 실제 클릭 PASS도 아직 주장하지 않는다.

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
- 기존 Network/Secret/PNG와 R35/R43 단언은 로컬 하네스 회귀에 남아 있다. 실제 브라우저 Network·PNG, PG15 저장·OIDC/HTTPS 실제 클릭 및 철회, WSL 동일 SHA는 `NOT_EXECUTED`; Provider·PG18·Production도 미검증이다.
- Main 소유 Event/progress/HANDOFF/WORK_STATUS/control, commit/push, WSL-server·ysna/Production 변경 0. 빌드 출력 정확 3파일과 빈 `dist` 폴더만 검증 후 제거했고 임시 자원 잔여 0이다.
- Rollback: Main이 이 exact5의 R44 diff를 검토 후 배제한다. 현재 미커밋 변경을 다른 사용자 자료와 함께 초기화하지 않는다. 다음은 Main이 Task 2 실제 RED와 WSL opt-in을 독립 검증하고, 실패 시 정확 원인으로 재작업을 지시한다.
