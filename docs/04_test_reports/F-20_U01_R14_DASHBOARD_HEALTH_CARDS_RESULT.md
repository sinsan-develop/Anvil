# F-20/U-01 R14 Dashboard Health 카드 Developer 결과

## 판정

`COMPLETED` — 단일 Developer 구현과 로컬 기본 검증 완료. Main 독립 검토·동일 SHA WSL 검증·브라우저 Network/E-SHOT·U-01/F-20 acceptance는 아직 수행하지 않았다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. 같은 문제의 정식 `FAILURE_REPORT` 0회.

## 기준·착수 상태

- 작업: `F-20/U01-R14`, actor `developer-primary-f20-u01-r14`. 시작 `codex/f18-wsl-ops` HEAD `57d70aaaaa7e5ba449d88c34e799816e3d24be42`; lease 기준 `fb30a9ddc05b127753f823406efd70f3d9da8134`는 HEAD의 조상. 시작 dirty는 Main 소유 `docs/WORK_STATUS.md` 1개이고 제품 exact3은 clean이었다.
- 권위 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- 계획 SHA-256 `2F188D20491E332CBE86C0C95870293DBDAD2DF6E4EC000CE09F73B0C51C22AC`; WI `C0829DAC11AA1A8E56C21EE2728F270A59A1A7DA206E062D5390838533039A32`; Invocation `22AF8D56B5A5C1B05F8735918546FC2FC033810E1865583473BF126CF7BFCD4A`.
- canonical progress/HANDOFF: G-05 seq1876, `ACTIVE`, epoch27 worker `worker-lease-f20-u01-r14-r14run3009a`와 종속 write `write-lease-f20-u01-r14-r14run3009a` 모두 ACTIVE, 만료 `2026-09-30T12:01:53+00:00`. 두 fencing token·baseline·actor가 일치하고 write scope는 아래 exact3이다. Main 소유 progress/HANDOFF/control/WORK_STATUS는 Developer가 수정하지 않았다.

## 변경 전·후와 영향

| exact3 경로 | 변경 전 | 변경 후 |
|---|---|---|
| `apps/web/src/console/App.tsx` | Worker/Execution Backends/Artifact Store placeholder `UNAVAILABLE` | 기존 한 번의 same-origin `/api/dashboard/operations` 응답에서 각 health signal을 검증한 뒤 state·마지막 점검시각·오류 수만 표시. gap/UNKNOWN 및 미래·비정상 값은 fail-closed. evidence·detail URL·raw payload는 DOM에 표시하지 않음. |
| `apps/web/tests/f15-console.test.mjs` | Queue·Provider·Alert 기존 회귀 | 기존 회귀를 유지하고 정상 신호, 요청 1회, gap/UNKNOWN, 비정상 row·미래 snapshot, 인증/서버/전송/invalid 응답과 비노출을 추가. |
| `docs/04_test_reports/F-20_U01_R14_DASHBOARD_HEALTH_CARDS_RESULT.md` | 없음 | 본 결과·명령·미검증·rollback 기록. |

Queue의 기존 관측 수/오류·Database readiness·Provider credential·Critical Alerts 경로를 변경하지 않았다. API/BFF route·공개 JSON 필드·권한·DB·Provider 외부 호출 추가 없음. 건강 상태는 Worker/Backend/Artifact Store의 관측값 세 개로만 표현하고 실제 소스 연결·상세 이동은 주장하지 않는다.

## 로컬 실행 증거 (Windows, 해당 worktree)

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .` | 1 | direct-path Python import path에서 기존 overlay import error. 제품 검증 실패가 아니며 파일은 존재. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` | 0 | G-05 `PASS sequence=1876 reporting=AUTO_CONTINUE`; 제품 변경 뒤 재실행도 동일 PASS. |
| `npm run web:test -- --test-name-pattern='Dashboard renders three observed Health signals'` | 1 | npm이 flag를 config warning으로 처리해 전체 suite 실행. 신규 정상 신호 첫 RED, 29 PASS/1 FAIL, `state.health` 미존재. |
| `npm run web:test` | 0 | 첫 GREEN 30/30 PASS. |
| `npm run web:test` | 1 | 후속 카드 계약 RED 30 PASS/3 FAIL: 카드가 snapshot state `LOADED`를 신호로 잘못 표시. |
| `npm run web:test` | 1 | 중간 32 PASS/1 FAIL: `//internal` 상세경로가 허용되어 guard 보완. |
| `npm run web:test` | 1 | 중간 32 PASS/1 FAIL: extra health field에서 Queue 기존 whole-snapshot 거부가 맞는데 테스트가 관측 수를 기대해 기대값 수정. |
| `npm run web:test` | 1 | 미래 snapshot RED 33 PASS/1 FAIL: UNKNOWN 카드가 미래 timestamp를 신뢰. |
| `npm run web:test` | 0 | 최종 34/34 PASS, SKIP 0. |
| `npm run web:typecheck` | 0 | TypeScript noEmit PASS. |
| `npm run web:lint` | 0 | Biome 3 files checked, fixes 0. |
| `npm run web:build` | 0 | Vite 20 modules transformed, build PASS. |
| `git diff --check` | 0 | whitespace/error 없음. |

`apps/web/dist`는 생성 전 없었고 build로 생성된 `index.html`·해시 CSS/JS와 디렉터리만 확인했다. worktree 내부 절대경로와 모든 자식의 reparse/link 부재를 검증한 후 해당 dist만 제거했고 잔여 `False`다. `.pytest_tmp_f20_u01_r14_dev`는 생성하지 않았고 잔여 `False`다. 기존 `node_modules`는 보존했다.

## 미검증·다음 조치·rollback

- 로컬 Node fixture/SSR·정적 빌드는 실제 브라우저 클릭/Network, 실제 Worker·Backend·Artifact Store 상태, WSL 같은 SHA, 실제 DB/Provider, 배포, Production 증거가 아니다. E-SHOT/E-NET, WSL 검증, 전체 제품 인수는 Main·독립 Tester의 후속 절차다.
- Main은 exact3 diff와 회귀를 독립 검토하고, 필요 시 같은 단일 writer에게 재작업을 지시한다. Developer는 commit/push/PR/merge·WSL/DB/Docker·ysna/Production을 수행하지 않았다.
- 회귀 시 제품 exact2(`App.tsx`, `f15-console.test.mjs`)의 R14 diff만 제거해 이전 상태로 돌리고 본 결과와 실패 근거는 보존한다. Main 소유 dirty `docs/WORK_STATUS.md` 및 control/progress 파일은 rollback 대상이 아니다.
