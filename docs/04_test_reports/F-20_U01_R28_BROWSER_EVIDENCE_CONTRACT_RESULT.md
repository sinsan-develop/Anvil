# F-20/U-01 R28 브라우저 증거 계약 보정 결과

## 판정

`COMPLETED` (Developer의 R28 Python 증거 계약·로컬 검증). R27 네 번째 WSL 실제 opt-in은 브라우저 흐름을 완료했지만 Python exact 증거 사전에서 `R6_BROWSER_EVIDENCE_MISMATCH`로 FAIL이었다. R28 epoch42 dual lease에서 새 증거의 top-level·중첩 키, type·값과 고정 관측 시각을 엄격히 검증하도록 보정했다. Main의 동일 clean SHA WSL 실제 재검증은 아직 `NOT_EXECUTED`이며 이 로컬 결과만으로 R27/U-01/F-20을 수락하지 않는다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`.

## 기준과 RED→GREEN

- 시작 branch/HEAD: `codex/f18-wsl-ops` clean `a0aad2f4d2ad31749b9826e9db2e09b90e465ff9`; private/WSL-server 동일 SHA·G-05 seq1966 PASS는 Main이 발급 전 확인했다. Main 소유 `docs/WORK_STATUS.md` dirty는 별도 보존한다.
- 계획 SHA-256 `61E9B2751595ACDC94B604A56A6E51C33D3A160F18CCA6BF4298237BEFF90D0D`, WorkInstruction `2BFC73C1EE4F5F0A37421D76C80102E0C0D7574FEF9196C8C82CB995EA19C85B`, Invocation `EBEFFD04753AAA4632CC107FDADE06214211ABE5BFFBF6D38DEDAC6FA5FC436C`.
- 상위 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- lease: actor `developer-primary-f20-u01-r28`, canonical seq1966 epoch42 worker/write ACTIVE, execution token `f20-u01-r28-execution-fence-epoch-42-r28contract1002`, write token `f20-u01-r28-write-fence-epoch-42-r28contract1002`, 만료 `2026-10-02T17:07:36+00:00`; allowed exact2는 이 결과보고서와 Python integration 테스트 파일이다.
- TDD RED: Main의 실제 WSL 4차 `1 failed, 25 deselected, 2 warnings in 9.07s`, `R6_BROWSER_EVIDENCE_MISMATCH`. 로컬 신규 negative 계약 테스트는 helper 구현 전 `NameError`로 1 FAIL/26 deselected(exit1)하여 미구현 지점을 확인했다. helper·최종 사전 결박 후 focused 1 PASS/26 deselected(exit0).
- Python 변경: R27 새 top-level 10키와 중첩 3계약을 exact-key/deep type/value로 검증한다. 수동·키보드 조회의 관측 시각은 이 실제 WSL fixture `OperationsService` clock `2026-09-28T00:00:00+00:00`과 각각 정확히 일치해야 한다. 수동/키보드 GET1, 독립 카드 보존, 503/invalid의 구별된 응답 상태·fail-closed, 철회 403/기존 보호값 제거를 정확히 요구한다. 새 키가 누락·추가되면 R28 exact 사전이 거부하고, 기존 R6/R23~R26 exact 사전도 그대로 유지한다. Network/Secret/artifact 검사는 제거·완화하지 않았다. 누락·잘못된 type/value·중첩/상위 여분 키 negative 테스트를 포함한다.

## 로컬 임시자원 사전 기록

- 비 opt-in Python 전체 검증의 Windows 기본 pytest temp ACL 문제를 피하기 위해 현 worktree 하위 전용 `.pytest_tmp_f20_u01_r28_dev`만 사용했다. 생성 전 부재를 확인했고 `-p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r28_dev`로 실행했다. 종료 후 실경로가 worktree 내부·root 비-link·관련 프로세스 0, 내부 symlink 3개 대상이 전용 base 내부임을 확인해 그 링크 3개와 base만 제거·잔여0이다. 기존 `.pytest_cache`, `.venv`, `node_modules`는 보존했다. `apps/web/dist`도 생성 전 부재, build 후 root 실경로가 worktree 내부·root 비-link·하위 link0을 확인해 이 출력만 제거·잔여0이다. 두 경로의 삭제는 같은 pytest/build 명령으로 재생성 가능한 일회성 산출물에만 적용했다.

## 남은 검증·인계

- `./.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k r28_manual_refresh_evidence_requires_exact_keys_values_and_observation --tb=short`: RED exit1/`NameError` 1 FAIL·26 deselected, helper 후 GREEN exit0/1 PASS·26 deselected. 전체 `./.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r28_dev tests/integration/test_f20_u01_oidc_browser_pg15.py --tb=short`: exit0/**26 PASS/1 SKIP**. SKIP은 opt-in 실제 WSL이 아니다.
- `npm run test:console -w @anvil/web`: exit0/50 PASS. `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`: exit0. `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`: exit0/`R6_AUDIT_SELF_TEST_PASS`. `npm run web:typecheck`: exit0. `npm run web:lint`: exit0/3 files·수정0. `npm run web:build`: exit0/20 modules. `./.venv/Scripts/python.exe -m scripts.check_project_progress`: 전용 pytest base가 남은 중간 시점에는 Main read-only 조회에서 `F20_U01_R28_GIT_INVALID`; 해당 base 정리 후 exit0/G-05 seq1966 PASS. `git diff --check`: exit0.
- 변경은 `tests/integration/test_f20_u01_oidc_browser_pg15.py`와 이 결과보고서 exact2다. 정식 Developer `FAILURE_REPORT` 0회; 최초 실제 WSL 증거 계약 불일치와 focused 예상 RED는 정식 반복 실패로 세지 않는다. 기존 `docs/WORK_STATUS.md`는 Main 소유 dirty로 보존했고 Developer는 Git commit/push·WSL/DB/Docker/control 변경0이다.
- Main은 exact2를 독립 검토해 기존 branch에만 checkpoint commit/private push, WSL-server가 Git으로 동일 clean SHA를 받아 격리 PG15/OIDC/HTTPS/Chromium opt-in 전체 결과·PNG/Network·Secret 비노출을 확인하고 정확한 임시자원 잔여0을 증명해야 한다. 그 전 R28은 Developer 로컬 결과일 뿐 실제 브라우저 PASS가 아니다.
- Rollback: R28 exact2만 정상 Git revert한다. 제품/API/DB/schema/auth/Secret·지속 데이터 변경은 없다.
