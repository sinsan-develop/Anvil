# F-20/U-01 R26 Dashboard 관측 시각 결과

## 판정

`COMPLETED` (Developer 로컬 절편) — 기존 Dashboard operations 응답의 검증된 관측 시각을 별도 live 영역에 표시한다. Main의 독립 검토와 동일 SHA WSL PG15/OIDC/HTTPS/Chromium opt-in은 아직 미실행이므로 R26 실제 브라우저 PASS나 U-01/F-20 수락은 아니다.

## 기준·증거

- 계획: `docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_PLAN.md`
- WorkInstruction: `docs/work_orders/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_WORK_INSTRUCTION.md`
- 시작 Git: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, HEAD `95c2bd9008efabe07139e4350aa4e70533674e9a`; 시작 제품 파일 clean. Main 소유 `docs/WORK_STATUS.md` 후속 dirty는 수정·stage하지 않았다. Main이 확인한 private/WSL checkpoint SHA는 시작 HEAD와 같으며 Developer가 WSL을 직접 재검증하지 않았다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R26 계획 `E87E440B68FFF5A94E79893CDCC9065D0984E8BB3B073FCB85EB97F7DC6B30B3`, WI `8B69ACB8219BEB78DC15ACAFD0BAC3FF45BAC908D6D448F38B3E48804514AECA`, Invocation `F85DD8A32F510CE2B6C2B158CBAF79C33A1534C412709973F5F26F83314DEEE0` 일치.
- canonical seq1954, epoch40 `ACTIVE`, 만료 `2026-10-02T10:57:20+00:00`, worker execution token `f20-u01-r26-execution-fence-epoch-40-r26observe1001`, 종속 write token `f20-u01-r26-write-fence-epoch-40-r26observe1001`, exact4 경로 확인 후 write했다.
- 제품 diff: `App.tsx`의 `LOADED`에 유효하고 미래가 아닌 top-level `observedAt` 보존, 머리말의 독립 `대시보드 관측 시각` live 영역에 성공 ISO/로딩/권한 차단/오류 상태 표시. `JUST NOW` readiness 표시는 별도 유지했다. 신규 fetch/effect/memo/동기 상태, 공개 API/schema/DB/auth/Secret 변경 없음.
- 테스트 diff: `f15-console.test.mjs`에서 성공·로딩·미래/invalid·401/403/503·readiness 독립·Queue 불변·민감정보 비노출 검증. 브라우저 하네스에는 기존 R23~R25 fact/Network/API/DB/Secret 단언을 유지한 채 pre-auth 요청 보류/차단, 저장 성공의 실제 reload 응답 `observed_at`, 권한 철회 DOM 단언을 추가했다. 새 Python fact 계약은 없다.

## Developer 로컬 검증 (Windows)

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `npm run test:console -- --test-name-pattern="Dashboard observation time"` (테스트 우선 RED) | 1 | 49 중 기존 47 PASS, 신규 2 예상 FAIL: `observedAt` 미보존, component 미구현 |
| `npm run test:console` | 0 | 49 PASS, 신규 2 GREEN |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (하네스 단언 우선 RED) | 1 | `validateObservationTime is not defined` 예상 실패 |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | syntax PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`, R26 양성·음성 단언 포함 |
| `npm run typecheck -w @anvil/web` | 0 | TypeScript PASS |
| `npm run lint -w @anvil/web` | 0 | 3 files, fix 0 |
| `npm run build -w @anvil/web` | 0 | 20 modules transformed |
| `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r26_dev tests/integration/test_f20_u01_oidc_browser_pg15.py` | 0 | 25 PASS / 실제 opt-in 1 SKIP |
| `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py` | 0 | G-05 PASS seq1954 `AUTO_CONTINUE` |
| `git diff --check` | 0 | whitespace error 0 |

- 임시자원: 생성 전 `apps/web/dist`와 `.pytest_tmp_f20_u01_r26_dev` 부재 확인. build 산출물 `dist`는 실경로·link0·정확한 내용 확인 뒤 해당 폴더만 삭제하고 잔여0. pytest base는 실경로·root 비-link, 내부 symlink3 대상이 모두 base 내부임을 확인했다. `Get-CimInstance Win32_Process` 명령은 접근거부(exit1)였고, `Get-Process python,pytest`에는 별도 Anaconda Python 1개만 보여 본 pytest 종료(exit0) 후 base만 삭제·잔여0으로 확인했다. 기존 `.pytest_cache` ACL 경고·내용은 보존했다.
- 미검증/잔여 위험: 실제 WSL PG15/OIDC/HTTPS/Chromium 새 SHA 실행, 1920×1080 screenshot·Network/API·DB 독립 사실, 사용자 인수·정식 Tester E-SHOT/E-NET/E-API/E-EVT, 필터·수동 refresh·실행/승인/비용 read model·7상태 완성은 미검증/미충족. R26 UI 변경이 기존 카드 값을 바꾸지 않는 로컬 회귀만 확인했다.
- Main 인계: exact4 diff 독립 검토 후 같은 branch commit/private push, WSL clean 동일 SHA 실제 opt-in과 전용 자원 정리, canonical 결과·상태 반영 및 dual lease 회수. Developer는 control/status/Git commit/push/WSL/DB/Docker/Production을 변경하지 않았다. 정식 Developer 실패보고 0회.
- C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락·Production `NOT_EXECUTED` 유지.

Rollback: Main이 R26 exact4 변경만 정상 Git revert한다. 기존 Event·DB 지속 데이터는 변경하지 않았다.
