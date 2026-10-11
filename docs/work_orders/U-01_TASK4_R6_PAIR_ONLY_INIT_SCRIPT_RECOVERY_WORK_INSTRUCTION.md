# WI-U01-TASK4-R6-PAIR-ONLY-INIT-SCRIPT-RECOVERY-20261011-001

## 판정·기준

부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`와 승인 계획 U-01 Task4/R6 원인 분리의 **비제품 하네스 보정**이다. `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 지시이며 기능 범위·요구사항·중요 위험·공개 API·DB schema/migration·지속 데이터·인증·권한·Secret·비용·운영 계약을 바꾸지 않는다. 단일 기존 `codex/u01-dashboard-r2`의 결과보고 tail `ac2f20e23ae398e6aaa36ac5b9634836f3c85a38`을 기준으로 한다. 착수 시 HEAD/private 동일·tracked clean·게시본 G-05 seq2384 PASS, Event raw seq2384, epoch119 worker/write REVOKED·활성 lease null, 전용 WSL QA 잔여0을 재확인한다. 기존 `.pytest_cache` ACL 경고는 건드리지 않는다.

## 결함과 보정 경계

C9 `367222b5f11fc1643b823d326f568dc321cfe9e9`의 WSL-server A 격리 PG15/OIDC/HTTPS/Chromium R6 opt-in은 `PAGE_CREATE`에서 exit1(1 failed/1 warning)로 제품/pair 요청 전에 실패했다. Playwright 1.62.1 최소 재현에서 `page.addInitScript(pairOnlyBodyBootstrap, mode, 2000)`의 함수 뒤 두 인자가 단일 인자 계약에 위배된다. B는 `NOT_EXECUTED`, A/B 인과 `UNDETERMINED`이며 A 자원 잔여0이다. 이는 비제품 하네스 결함의 좁은 수정 근거이지 PAIR 404 직접 원인·제품 결함·R6 PASS가 아니다.

기존 pair-only 진단의 기본 OFF, A/B 동일 wrapper, 원 응답 즉시 반환, 첫 same-origin pair-list 404 한 건의 clone 본문만 B에서 별도 bounded 수거, 다른 비2xx/off-origin 미소비, Network/Secret 감사 및 기존 timeout은 불변이다. `addInitScript` 함수와 **단일 `{mode, timeoutMs}` 객체 인자**를 전달하고 bootstrap에서 구조분해하는 최소 수정만 허용한다. 먼저 fake가 세 번째 인자를 거부하는 RED와 실제 API 재현을 확인하고 GREEN을 만든다. 기본 OFF·A/B opt-in·중복/불일치/진단 TIMEOUT·requestfailed 음성 및 기존 인접 회귀를 보존한다. 404 허용, timeout 연장/sleep, body/Secret/off-origin 감사 생략, F-19A 임의 활성화, 제품 fetch 변경은 금지한다. 비밀값·DSN·URL/query/host/header/body/cookie/token 원문 출력도 금지한다.

## 순차 Git·lease Gate

- Main의 **W11**은 위 tail 직접 자식으로 본 WI·짧은 Invocation·`docs/WORK_STATUS.md` 정확3문서 한 commit이다. 실제 문서 hash·부모 승인·semantic diff·기준 Git/Event/lease를 기록한다. 신규 G-05 successor 전 W11 RED는 예상이며 PASS가 아니다.
- **A10**은 W11 직접 자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서 한 commit이다. 역사 Event 원문 seq1~2384를 보존하고 seq2385 WI→2386 epoch120 worker→2387 write를 append한다. 단일 기존 Primary Developer, 서로 다른 24시간 fencing token, 아래 정확 최대4 코드 경로·제품0으로 제한한다. 독립 Critical/Important0·private 게시 뒤에만 dispatch한다.
- Developer 허용 코드는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py` 최대4경로다. Main은 활성 write lease 동안 이 경로를 수정하지 않는다. 테스트 RED→최소 GREEN→Node 구문/self-test·Python 집중/인접·diff check·독립 Critical/Important0 순서다. **C10**은 A10 직접 자식 허용 코드만 한 commit이며 local/private 동일·tracked clean의 실제 G-05 PASS 전 WSL QA 금지다. G-05 successor는 W11→A10→C10→B10→H10 및 첫 보고 tail의 정확 부모·경로·Event/Git/lease·역사 실패 보존을 fail-closed 검증하며 위조 음성을 약화하지 않는다.
- Main은 C10 게시 후 A/B 각각 사전 등록한 새 빈 `ssh WSL-server` Git exact-SHA PG15/OIDC/HTTPS/Chromium QA에서 한 변수만 비교한다. A 종료·실패 시 exact 경로/owner/realpath/link·container ID/label/image/mount/port/process를 확인해 **전용 자원만** 정리·잔여0으로 만든 뒤 B를 만든다. 두 실행의 SHA·image digest·migration0019·seed/권한·harness/browser·timeout 동등성을 기록한다. 비밀 원문 출력 금지. 격리 QA 결과를 정식 인수로 승격하지 않는다.
- **B10**은 C10 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서에 실제 A/B exit·marker·동등성·오류·미실행·정리 결과를 기록한다. **H10**은 B10 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서로 seq2388 write→2389 worker를 회수한다. H10 직접 자식 첫 결과보고 tail은 신규 `docs/04_test_reports/U-01_TASK4_R6_PAIR_ONLY_INIT_SCRIPT_RECOVERY_RESULT.md` 추가(A)+`docs/WORK_STATUS.md` 수정(M) 필수2경로이며, 새 사실인 미진에 한해 `design_change.md` 역사 byte-prefix 보존 append(M)를 선택 허용한다. 첫 보고를 포함한 tail은 최대256개의 직계 단일 부모 commit으로 제한하고, 이후 `docs/WORK_STATUS.md`-only 수정만 허용한다. 첫 보고서·`design_change.md`의 수정·rename·삭제 및 Event·제품 파일 변경은 거부한다. 각 게시 SHA의 G-05를 별도 확인하고 과거 PASS를 상속하지 않는다.

## 종료·미충족

Playwright 인자 오류 보정의 실제 A/B 결과, 전용 자원 잔여0, epoch120 lease 회수, 최신 G-05를 사실대로 보고하면 이 내부 보정 WI를 닫는다. A/B가 다시 진단 경계에 도달해도 기본 전체 R6·U-01 `ACCEPTED`를 자동 선언하지 않는다. DC-U01-019와 E-NET/E-API/E-AUD/E-SHOT·AV-SAFE-034/AV-OPS-027/AV-UI-017은 별도 실제 증거 전까지 미충족, U-01 `NOT_ACCEPTED`/Release `DEFER`다. 새 branch/PR/main 병합, history rewrite/force push, ysna/Production은 제외한다. 롤백은 신규 비제품 커밋의 정상 `git revert`와 Event·승인·사설 원격 복구 ref 보존으로 한다.
