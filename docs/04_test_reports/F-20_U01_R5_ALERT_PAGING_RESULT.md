# F-20/U-01 R5 저장 경고 과거 페이지 결과

## 판정

`LOCAL_GREEN; WSL_EXACT_SHA_PENDING; U01_F20_NOT_ACCEPTED`. 기존 `GET /api/operations/alerts`의 `x-alert-before-sequence`만 이용하는 Dashboard 저장 경고 과거 페이지 읽기를 exact3 안에서 구현했다. 실제 OIDC+브라우저 통합 E2E나 detector 신선도·완전성은 검증하지 않았다. C30 원장 사고 `OPEN_BLOCKING`과 release `DEFER`는 그대로다.

## 기준과 소유

- 시작 branch `codex/f18-wsl-ops`, HEAD `7855d3660d8911a4c911cfe0b0cb53c94a69ddfc`, clean, G-05 seq1816 PASS. Main의 status-only checkpoint가 개발 중 `e8bad5b4e99354e67ac6066b2d08e8e27b21cac0`, `119661fc`로 진행했으며 두 commit은 제품 변경이 아니다.
- canonical worker `developer-primary-f20-u01-r5`, epoch17, `worker-lease-f20-u01-r5-r5pagingstart1`, execution token `f20-u01-r5-execution-fence-epoch-17-r5pagingstart1`; 종속 write `write-lease-f20-u01-r5-r5pagingstart1`, write token `f20-u01-r5-write-fence-epoch-17-r5pagingstart1`, 만료 `2026-09-29T11:05:47+00:00`. 발급 baseline `11159f69e091715c95cf0578da3db040124ee6ce`. dispatch HEAD 이후 Main status-only commit은 정확한 제품 lease 경로를 바꾸지 않았다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R5 WI `E73F0B7F10B6F6E32D9914F8861F66E703234B8D844F1C6B375034B75BF7756C`, Invocation `6A4E2F272923BD70DB8416F13F6C3CEF7CF4A864AE60DC1DB0AE511FE85B7951`.

## 변경과 회귀 경계

- `apps/web/src/console/App.tsx`: 첫 페이지와 과거 페이지의 strict schema/상한100/양의 안전한 sequence·cursor, 페이지 내부/간 sequence·ID 배타성과 커서 감소를 검증한다. 저장된 critical open/acknowledged만 누적 최신순으로 출력하고 warning/resolved는 검증 후 화면에서 제외한다. 빈·겹침·반복·위조·auth/HTTP·통신/JSON 오류는 전체 카드 `UNAVAILABLE`로 닫는다. 부분 결과 버튼은 `type=button`/native keyboard, 로딩 중 disabled 및 실제 Shell이 사용하는 단일 in-flight 요청 helper, same-origin credential과 abort를 유지한다. React 문자열 escaping을 사용한다.
- `apps/web/tests/f15-console.test.mjs`: 101건 두 페이지, 배타적 요청 header/credential·최신순, 버튼/로딩/끝, 같은 cursor 동시 호출 1회, 이전 protected record 제거 오류 경로를 추가하고 기존 R4 테스트의 최신순 기대만 맞췄다. Database·Provider·기타 메뉴·새 route/permission/DB/Secret·ack/detector mutation은 변경하지 않았다.
- 이 결과보고서가 세 번째 exact 경로다. Main 인수 전 Developer commit/push/merge 없음.

## 실행 증거

| 실행 | 종료/실측 |
|---|---|
| `npm run web:test` 첫 RED | exit1, 기존 13 PASS/신규 1 FAIL: `loadOlderCriticalAlerts is not a function` |
| `npm run web:test` 버튼 RED | exit1, 15 PASS/신규 1 FAIL: cursor가 있어도 과거 페이지 버튼 없음 |
| `npm run web:test` 중복 요청 RED | exit1, 16 PASS/신규 1 FAIL: Shell 공용 단일 in-flight helper 없음 |
| `npm run web:test` 최종 GREEN | exit0, 17/17 PASS; 미완료 첫 요청 동안 같은 cursor 두 번째 호출은 null, 실제 요청 1회 |
| `npm run web:typecheck` | exit0 |
| `npm run web:lint` | exit0, 3 files, fixes 0 |
| `npm run web:build` | exit0, Vite 8.3.0, 20 modules |
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/api/test_f13_operations_api.py::test_alert_pages_reach_all_101_unresolved_critical_alerts_without_mutating_owner --basetemp=.pytest_tmp_f20_u01_r5_f13` | exit0, 1 passed/2.22s; 기존 API cursor/101건 read 계약 인접 회귀 |
| `C:\Users\cyhuh\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe -B scripts/check_project_progress.py .` | 제품 diff 상태에서도 G-05 seq1816 PASS |

Main이 `docs/WORK_STATUS.md`에 임시 자원을 먼저 기록했다. build가 만든 정확한 `apps/web/dist`의 실경로·symlink0·파일3개를 확인하고 해당 디렉터리만 제거해 잔류0이다. F-13 지정 basetemp `.pytest_tmp_f20_u01_r5_f13`은 종료 후 생성되지 않은 것으로 확인했으며 제거 대상이 없었다. 부재 대상에 대한 첫 `Get-Item` 진단은 exit1이었지만 해당 경로의 directory/Git 잔류0을 재확인했다. 기존 `node_modules`는 보존했다.

## 미검증·잔여 위험·인계

- WSL-server exact 제품 commit에서 실제 API/DB와 headless browser 두 viewport·Network·빠른 연속 클릭은 Main 검증 전이므로 미검증이다. Node의 SSR/card 및 fetch stub·동시 호출 helper는 실제 DOM 클릭이나 OIDC+브라우저 결합 증거가 아니다.
- detector 실행·경고 신선도/완전성, acknowledge, Next Actions, 다른 Health/운영 카드, U-01/F-20 전체 인수, C30 사고 복구, Production은 미검증/미완료다.
- 기존 동작 유지 범위: Database·Provider 카드와 다른 메뉴는 제품 수정0; `web:test` 17/17 및 typecheck/lint/build가 로컬 회귀만 증명한다.
- rollback: Main이 R5 제품 commit만 정상 `git revert`하여 R4 단일 페이지/부분 경고 UI로 복귀한다. canonical Event·DB·승인 원문을 되돌리지 않는다.
- progress/HANDOFF는 Main 소유로 seq1816 ACTIVE이며 Developer가 수정하지 않았다. 다음은 Main 독립 diff/검증, exact3 commit/private push, WSL-server 동일 SHA QA 및 상태 기록이다. main 병합·신규 branch·ysna-server/Production은 제외한다.
