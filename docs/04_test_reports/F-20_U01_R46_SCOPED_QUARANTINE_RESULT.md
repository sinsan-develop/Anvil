# F-20/U-01 R46 실제 범위 격리 근거 결과

판정: `INCOMPLETE` — Developer exact5 제품 변경과 로컬 검증은 통과했으나 Main의 동일 SHA `75b37984` WSL-server PG15/OIDC/HTTPS/Chromium opt-in은 실패했다. `STORED_RESPONSES`에서 `AssertionError`, 1 failed/48 deselected/2 deprecation warnings, 7.34초. F-20/U-01 전체 미수락, ReleaseDecision `DEFER`.

## 판단 이유

- 시작 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `3e67e14d192662b237a2f57d231ec3805779f9d1`, 지정 5파일 clean. canonical seq2088 dual lease epoch62·exact5 scope·만료·두 fencing token 유효와 baseline `37d7d88fbce53844c8d20725ec212431a61e7186`의 HEAD 조상 관계를 확인했다. Main은 원격 동일 HEAD와 G-05 PASS를 별도 확인했다.
- R46 계획 bytes SHA-256 `D33786BFD4AF3BC77AD48E112904C105FBDF8493B565637B3EC0B30F3A2AF5D9`, WorkInstruction `2E78E8596DB87F2E6BC87D7F7AF4DD745E3E8E708C3569F9FC0416A18159BB57` 일치. 설계/계획/매트릭스/테스트계획/운영규칙 현 SHA-256은 각각 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- 변경 전 Queue gap은 격리 행을 숨겼고, gap이 없으면 저장 alert 없이도 `LATE`·건수를 표시했다. 변경 후에는 `observed_at`이 현재 이하·60초 이내이고 유효·고유한 scoped 격리 양성 행과 유일한 저장 `QUEUE_JOB_QUARANTINED` alert가 정확히 일치할 때만 `확인된 격리 이상`·건수·same-page 상세를 함께 표시한다. 전체 Queue `UNKNOWN`과 source gap 부족 안내는 유지한다. `quarantined_at`은 발생 시각으로 검증하지만 60초 관측 기준으로 취급하지 않는다.
- R46 console RED는 예상한 `UNKNOWN`·격리 상세 부재였고, 구현 후 GREEN이다. 추가로 같은 코드·다른 출처의 중복 alert를 주입하면 기존 구현이 상세를 표시하는 RED를 확인해, 모든 `QUEUE_JOB_QUARANTINED` 후보의 유일성을 검사하도록 고쳤다. 0건·누락·차단·오래된/미래 관측·위조·중복·해결된 alert는 격리 확인 표시 없이 닫힌다. R35/R43/R44 기존 경로는 로컬 회귀 범위에서 유지됐다.

## 조치·미검증

- 변경 파일과 diff: `apps/web/src/console/App.tsx` (+4/-기존 LATE 덮어쓰기 제거), `apps/web/tests/f15-console.test.mjs` (현재 시각 기반 R46 RED→GREEN), `tests/browser/f20-u01-oidc-browser-pg15.mjs` (0건 UNKNOWN·저장 alert 유일성·API↔DOM/same-page·변조 감사), `tests/integration/test_f20_u01_oidc_browser_pg15.py` (QA-only Queue `HEALTHY/0` HealthSignal 제거, 격리 시드 직전 snapshot 시계 갱신), 이 결과파일. 제품 exact5 밖 소스 변경 없음.
- `node --test --test-name-pattern='R46 Queue keeps' tests/f15-console.test.mjs` (`apps/web` cwd) exit1은 tsx loader 누락 도구 호출 오류였다. 올바른 `node --import tsx --test --test-name-pattern='R46 Queue keeps' tests/f15-console.test.mjs`는 구현 전 exit1 예상 RED, 구현 후 exit0/1 PASS.
- `npm run web:test` exit0/78 PASS; `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -q` exit0/48 PASS·1 실제 opt-in SKIP; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit0/`R6_AUDIT_SELF_TEST_PASS`; `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit0; `npm run web:typecheck` exit0; `npm run web:lint` 최초 exit0/경고1(non-null assertion), 수정 뒤 exit0/경고0; `npm run web:build` exit0/Vite 20 modules; `git diff --check` exit0.
- 빌드가 만든 `apps/web/dist`의 정확한 절대경로와 비-link 내용 3파일을 확인해 해당 생성물만 제거했고 잔여 0이다. 기존 `.pytest_cache` ACL 읽기 경고는 유지했다. 정식 실패보고 0회; 기대된 RED·도구 오류·lint 경고는 정식 실패로 계상하지 않았다.
- Main은 WSL exact SHA/clean/G-05 seq2088, Node24 Web78/typecheck/lint/build20, Python48/1skip, PG15 비관리자 migration0019을 확인했다. 실제 opt-in 브라우저는 위 실패이므로 PASS가 아니다. 최초 clone remote 이름/detached HEAD로 인한 G-05 실패 2회는 동일 SHA 추적 branch 정렬로 해소된 환경 오류이며 제품 실패 횟수에 포함하지 않는다. 일회성 PG와 checkout/evidence/venv/module은 원인 조사 중 Main이 `ACTIVE`로 보존한다.
- 실패 진단: Python R46 harness가 초기 `at`을 `datetime.now(timezone.utc)`로 바꿔 R35 QA Database `last_check=at-10초`를 동적으로 생성했으나 Node browser harness의 `STORED_RESPONSES`는 고정값 `2026-09-27T23:59:50+00:00`을 요구한다. Main이 두 경로를 독립 대조했다. WSL의 안전 failure marker에서 단언 코드를 확인하지 못했으므로 이 경로의 결정적 실패와 stage 내 최초 실패 지점은 구분한다.
- 단일 최소 보정: 초기 R35/R44 기준 `at`을 기존 `2026-09-28T00:00:00+00:00`으로 복원했다. 격리 시드 직전 `observation_clock[0]=datetime.now(timezone.utc)` 및 Queue `HEALTHY/0` 미주입은 유지했다. 보정 후 로컬 Python 비 opt-in 48 PASS·1 SKIP, Node audit `R6_AUDIT_SELF_TEST_PASS`, Web console 78 PASS, typecheck/lint 경고0이다. 이는 실제 WSL 실패를 소급 PASS로 바꾸지 않는다. Main이 새 빈 전용 PG에서 동일 clean SHA로 재실행해야 한다.
- Main 독립 검토·통제/Event/progress/HANDOFF/WORK_STATUS와 Git commit/push는 Main 소유다. Developer는 WSL/ysna/Production에 접근하지 않았다.
- Rollback: Main이 정확한 이 5파일 diff만 제외해 깨끗한 `3e67e14d192662b237a2f57d231ec3805779f9d1` checkpoint로 복원한다. Developer는 Git reset·commit·push를 수행하지 않았다.
