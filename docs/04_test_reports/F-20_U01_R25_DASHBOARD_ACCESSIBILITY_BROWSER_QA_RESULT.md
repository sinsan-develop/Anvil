# F-20/U-01 R25 Dashboard 접근성 브라우저 QA 결과

## 판정

`COMPLETED` (Developer의 로컬 exact3 범위), R25 좁은 접근성 브라우저 QA `PASS` — 로컬 TDD·회귀·정리를 마쳤고 Main이 동일 clean SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium opt-in과 PNG·Network를 독립 확인했다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락을 유지한다.

## 기준·변경·검증

- 시작 branch/HEAD/status: `codex/f18-wsl-ops`, `f9d4e96eebeba160529733f900de742a0e1f3321`, `development/codex/f18-wsl-ops` 동일 SHA. Main 소유 `docs/WORK_STATUS.md`만 dirty. 기존 `.pytest_cache` ACL warning은 보존한다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R25 계획 `92F45A0D0C3701EEC222E3D266CFBC68B07121E1D6EAD5AB3A215AC915C9590E`, WI `DE9BA51EFCA117E84A52C4B93029EEEC130F53AF0E23D9959B70952D34E53FF7`, Invocation `1816D1B22F05477F3B01D40C68F841A51FF3AE8B129BAEC619C15574DE66465E`.
- canonical seq1948 ACTIVE epoch39: worker `worker-lease-f20-u01-r25-r25access1001`/execution `f20-u01-r25-execution-fence-epoch-39-r25access1001`, write `write-lease-f20-u01-r25-r25access1001`/write `f20-u01-r25-write-fence-epoch-39-r25access1001`, 만료 `2026-10-02T07:04:53+00:00`. 현지 착수 2026-10-02 04:10 KST로 유효.
- 임시 자원 사전 경계: Node `--audit-self-test`, `node --check`, pytest focused와 비 opt-in은 로컬 실행. pytest 임시 root는 정확히 `D:\tmp\anvil-u01-r25-dev-pytest` 하나로 지정하고 신규 생성·사용 뒤 이 경로가 실제 일반 디렉터리인지 확인한 뒤 본 작업이 만든 내용만 정리한다. `.pytest_cache`는 접근·정리하지 않는다. console build가 만드는 repo 내부 빌드 산출물은 시작 전 상태·정리 대상을 별도 확인한다.
- console build 사전 경계: `apps/web/dist`는 실행 전 부재다. `npm run web:build`가 생성하면 정확한 이 경로가 일반 디렉터리·비 link인지 확인한 뒤 본 작업 산출물만 정리한다. 기존 `node_modules`와 `.venv`는 보존한다.
- 허용 exact3: 브라우저 하네스, Python opt-in, 이 결과보고서. 제품·공개 API·DB/schema·인증·Secret 변경 없음.
- 변경: JS 하네스는 실제 브라우저의 인증 전 Alerts `UNAVAILABLE`/Next Actions `BLOCKED` live region, 보호 행·민감 본문 비노출, 보류 중 sidebar Tab/Enter 포커스·expanded 유지 및 응답 해제 뒤 포커스를 검사한다. 빈 결과와 한 Dashboard GET 503의 live region 구분·독립 Provider 유지·오류 본문 비노출, 403 철회 후 두 카드의 저장 행/포커스 가능 후손 0과 보호 텍스트 제거를 검사한다. Python opt-in은 새 boolean fact 정확히 4개를 strict type whitelist에 결박한다. 기존 R23/R24 API·DB·DOM·Network·Secret 단언은 유지했다.

## 실행 증거

| 단계 | 정확한 명령 | exit/결과 |
|---|---|---|
| Task1 RED | `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 1, 새 `validatePreAuthAccessibility` 미정의 |
| Task1 RED | `py -3.13 -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k test_r25_pre_auth_and_loading_keyboard_facts_are_strict_booleans` | 1, 새 `_r25_task1_evidence` 미정의 |
| Task1 GREEN | 위 Node/Python focused 재실행 | 각각 0, `R6_AUDIT_SELF_TEST_PASS`/1 passed |
| Task2 RED | 위 Node self-test 재실행 | 1, 새 `validateEmptyErrorAccessibility` 미정의 |
| Task2 RED | `py -3.13 -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k test_r25_empty_error_and_revocation_facts_are_strict_booleans` | 1, 새 `_r25_task2_evidence` 미정의 |
| Task2 GREEN | `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` 및 Node self-test, `py -3.13 -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k r25` | 각각 0, self-test PASS, Python 2 passed |
| Python 비 opt-in | `py -3.13 -m pytest -q -p no:cacheprovider --basetemp='D:\tmp\anvil-u01-r25-dev-pytest' tests/integration/test_f20_u01_oidc_browser_pg15.py` | 0, 25 passed/1 opt-in skipped/`python_multipart` PendingDeprecationWarning 1건 |
| console | `npm run web:test`; `npm run web:typecheck`; `npm run web:lint`; `npm run web:build` | 모두 0; 47 passed/TypeScript 오류0/3 files 수정0/20 modules transformed |
| 통제·diff | `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py`; `git diff --check` | 모두 0; G-05 PASS seq1948, 기존 `.pytest_cache` ACL warning 보존 |

Python3.14 subprocess 핸들 오류는 이번 실행에서 보지 않았고 설치된 Python3.13으로 검증했다. `D:\tmp\anvil-u01-r25-dev-pytest`는 생성 전 부재·일반 디렉터리였고 내부 symlink 3개의 target이 전부 이 경로 안임을 확인했다. 세 link를 제거한 뒤 전용 pytest root와 생성 전 부재였던 일반 디렉터리 `apps/web/dist`만 제거했다. 두 경로 잔여 0을 확인했다. 기존 `.venv`, `node_modules`, `.pytest_cache`, Main 소유 `docs/WORK_STATUS.md`는 보존했다. 작업 오류 횟수: Windows 기본 sandbox ACL helper 실패 2회(실행 설정으로 해결), TDD 예상 RED 각 1회, 정식 구현 실패 0회.

## Main 제공 WSL-server 실제 QA·정리 증거

- Main이 기존 branch에 commit/private push한 정확한 clean SHA는 `d24bb66bbe9dafabf555880bfacdadd917029ede`다. WSL-server 격리 PG15/OIDC/HTTPS/Chromium opt-in은 exit 0, `1 passed, 25 deselected, 2 deprecation warnings in 8.64s`였다. R25 boolean fact 4개와 기존 R23/R24 API·DB·DOM·Network·Secret 단언이 함께 통과했다. 이는 Main 실행·검증 결과이며 Developer가 WSL에서 직접 실행한 결과가 아니다.
- 준비 중 전용 checkout의 첫 `git clone`은 원격 이름이 기본 `origin`이어서 G-05 `F20_U01_R25_GIT_INVALID` exit 1이었다. Main이 전용 checkout의 원격 이름을 canonical `development`로 바로잡아 동일 SHA clean/G-05 seq1948 PASS를 확인했다. Python editable 설치는 저장소 flat-layout 자동 검색 오류로 exit 1이었고, Main은 제품을 변경하지 않고 전용 venv에 선언 의존성을 직접 설치한 뒤 실제 opt-in을 통과시켰다.
- Main의 독립 PNG 3개 육안 확인: 인증 전 보호 카드 비노출·차단, 저장 Critical Alerts와 Next Actions 각 1행, 철회 뒤 `BLOCKED`와 저장 행 제거. Network JSON은 선언/실제 요청 `46/46`, app API `28`, HTTPS loopback origin `1`, URL userinfo/query/fragment `0`이다.
- 증거 SHA-256: pre-auth PNG `6c209c479a221377b13756d1e965df4eeb2081d5cdb54415f5b4c5d07f9541fc`; stored PNG `f2feb815498fc650fb9be42443731c7cd66dee00bb174d8f94ff30a58d284395`; revoked PNG `1696e33d24500a1368e2fee842bae5d61ede0c768c6a05a6a121c8819d0bb691`; Network JSON `d61c0701dec4525308d0aa550177a3188c8480ff717446c29323bc7e744c1921`.
- Main이 전용 PG/Node/browser container `0`, port 5545 listener `0`, WSL TLS/venv/pytest/evidence/node_modules/dist/checkout `0`, 로컬 visual-review `0`을 신원·경계 검사 후 확인했다. 공유 서비스·기타 DB/컨테이너·ysna/Production 변경은 없었다.

## 인계·미검증·rollback

Main의 동일 SHA 실제 검증과 임시자원 정리는 위 범위에서 확인됐다. 이 Developer의 후속 작업은 결과보고서 갱신과 diff 검사까지만이다. 독립 Tester E-SHOT/E-NET/E-API/E-EVT, U-01 전체 7상태·필터·운영 카드와 Production은 미검증이다. rollback은 R25 exact3 테스트·보고서 diff만 정상 Git revert하며 제품·DB·과거 원장은 건드리지 않는다. canonical progress/HANDOFF/WORK_STATUS와 Git 후속 조치는 Main 소유다.

## 미검증

R25는 연결된 카드의 지정 접근성 흐름만 PASS다. Project/Environment/기간 필터·새로고침 시각, 운영 상태 실데이터·quota/cancel/reconnect, U-01 전체 7상태, 독립 Tester E-SHOT/E-NET/E-API/E-EVT, C30 복구와 F-20 인수는 별도 미충족이다.
