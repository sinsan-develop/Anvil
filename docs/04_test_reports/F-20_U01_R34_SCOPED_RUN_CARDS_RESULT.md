# F-20/U-01 R34 범위 제한 Run 운영 카드 — Developer 결과

## 판정

`COMPLETED` — Developer 구현·로컬 검증 완료. 결과보고서 작성 뒤 발견한 REPORT 불변 결박 충돌은 Main의 control-only TDD로 해소됐고 Developer도 최종 G-05 seq2008 PASS를 재확인했다. 실제 WSL PG15/OIDC/HTTPS/Chromium 비0 증거는 **Main 미실행/NOT_EXECUTED**이며 인수 PASS가 아니다. 임시 pytest 자료는 아래 후속 안전 정리로 잔여0을 확인했다. C30 `OPEN_BLOCKING`, F-20/U-01 미수락, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. Developer commit/stage/push/WSL/DB/Docker/새 branch/control 변경은 0이다.

## 기준과 권한

- worktree: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`.
- dispatch HEAD: `07a05bfe1e3b4e70dcd4ff9ab3d4c9f34474398a`. Main clean dispatch 후 Developer 최초 조회에서는 Main 소유 `docs/WORK_STATUS.md`만 dirty였으며 보존했다.
- canonical seq2008, actor `developer-primary-f20-u01-r34`, epoch49, worker/write ACTIVE. execution token `f20-u01-r34-execution-fence-epoch-49-r34run031003`, write token `f20-u01-r34-write-fence-epoch-49-r34run031003`; 만료 `2026-10-04T01:49:47+00:00`.
- Plan `168184B390CE1760D7E0498ABE46502A5105AD7306DB2256339A18942720DAB4`; WI `40184D95A40EA45D0BF33DFF0D48D0C56DA75E1C2654F10B10A4616F0F580F6E`; Invocation `01F36DA399F85FCED48F1C556BBA425B832662A034E8CDA8E7E13BBF6FCE50D6`.
- 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`을 직접 재검증했다.

## 변경 exact8

1. `packages/api/operations.py`: 기존 owner snapshot exact12 검사를 유지하고 공개 GET에 `run_summary`를 추가. exact DTO·정수 0~100·버킷 합/분모·aware 비미래 시각 검증 후 값만 반환. 실패는 필드 단위 UNAVAILABLE/null이며 기존 Health/Queue/Alerts를 503으로 오염시키지 않는다. 상위 snapshot 실패는 기존 503을 유지한다. timezone/ZoneInfo exact builtin만 허용하고 custom datetime/tz/scalar callback을 거부한다.
2. `apps/web/src/console/App.tsx`: exact13 응답 파서, 3개 카드의 상태 수·관측 분모·별도 Run 관측시각. 불완전/미래/상위 실패·취소·재연결에서는 숫자를 숨긴다. 나머지 3개 카드는 UNAVAILABLE이며 mutation UI가 없다.
3. `tests/api/test_f20_u01_r10_dashboard_api.py`: 정상·빈 범위·100/101 경계·오염·합 초과·외부 scope·권한·비밀·callback0·detached/reload·표준 ZoneInfo 회귀.
4. `apps/web/tests/f15-console.test.mjs`: API→상태→렌더링, 실제 0과 비가용 분리, 미래 parent, 나머지 카드/기존 Dashboard 회귀.
5. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 기존 opt-in 전용 DB에서 R18 Task/Run repository 경로로 3 Run 생성, WAITING_APPROVAL/BLOCKED 상태를 해당 Run에만 커밋하는 QA fixture. 실제 scoped reader/summary를 주입하고 3/1/1/1 검증. strict browser receipt 검사 추가.
6. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 Dashboard 응답의 3/1/1/1 및 관측시각과 DOM exact 비교, 503/불완전 응답·권한 철회 뒤 수치 소거, 나머지 3카드 비가용. 기존 같은-origin·OIDC·secret·스크린샷 경계를 보존.
7. 본 결과보고서.
8. `tests/tooling/test_f20_u01_r33t_start_projection.py`: 고정 `8c0af9638d1e52fb29a1010a42f457b4448c0655`의 당시 8개 Git blob을 임시 fixture에 공급. 역사 scope 위조/만료 거부와 현재 public G-05를 분리. clone 없이 read-only git show만 사용, 기대 오류 완화/원장 변경 없음.

새 route/permission/schema/migration은 없다. Project/Environment·기간 필터와 Critical ack는 범위 밖이다. `ACTIVE`는 실제 프로세스 수, `WAITING_APPROVAL`은 승인 객체 수가 아니다. 최대100 완전한 scoped Run 관측이며 Dashboard/Run 두 관측은 하나의 DB 원자 snapshot이라고 주장하지 않는다.

## RED → GREEN 및 정확한 명령

아래 `PY`는 실제 `C:\Users\cyhuh\anaconda3\python.exe`; cwd는 위 worktree, Node/npm 명령은 명시한 경우 `apps/web`이다. Python 공통 옵션은 `-B -m pytest -q -p no:cacheprovider --import-mode=importlib`, 끝 옵션은 `--tb=short`이다.

| 검증 | 명령의 대상/추가 옵션 | 실제 결과 |
|---|---|---|
| Task0 RED | `PY` 공통옵션 `tests/tooling/test_f20_u01_r33t_start_projection.py --tb=short` | exit1, 1P/2F, 1.10s; 역사 START가 current2008을 소비 |
| Task0 GREEN | 같은 대상 `--basetemp=.tmp_subagent_review/r34/task0b --tb=short` | exit0, 3P, 3.00s |
| API RED | `tests/api/test_f20_u01_r10_dashboard_api.py --tb=short` | exit1, 10P/14F; run_summary 부재 |
| API 초기 GREEN | 같은 대상 | exit0, 24P, 2.52s |
| Console RED | `node --import tsx --test --test-name-pattern=R34 tests/f15-console.test.mjs` (apps/web) | exit1, 3F; component/strict 계약 미구현 |
| 미래 parent RED | `node --import tsx --test --test-name-pattern='R34 future' tests/f15-console.test.mjs` | exit1, 1F; 미래 상위 관측 수치 노출 |
| Console 최종 | `npm run test:console` (apps/web) | exit0, 63P/0F/0S, 675.6546ms |
| formal receipt RED/GREEN | `tests/integration/test_f20_u01_oidc_browser_pg15.py -k r34 --tb=short` | exit1 1F/37 deselected → exit0 1P/37 deselected |
| ZoneInfo RED/GREEN | `tests/api/test_f20_u01_r10_dashboard_api.py -k zoneinfo --tb=short` | exit1 1F/26 deselected → exit0 1P/26 deselected; psycopg 표준 ZoneInfo 호환 |
| 중간 관련 | 아래 최종 명령에서 observability 전체 대신 summary/R17, R9/R8/R34 control 제외 | exit0, 135P/3S, 10.42s |
| 최종 관련 | 아래 완전 명령 | exit0, **171P/3S/0F**, 16.19s |

```powershell
& C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_f20_u01_r18_run_host_pg15.py tests/persistence/test_f20_u01_run_read.py tests/persistence/test_f20_u01_r8_queue_read.py tests/integration/test_f20_u01_oidc_browser_pg15.py tests/tooling/test_f20_u01_r33t_start_projection.py tests/tooling/test_f20_u01_r33t_close_projection.py tests/tooling/test_f20_u01_r34_start_projection.py --basetemp=.tmp_subagent_review/r34/final --tb=short
```

- SKIP3: R18 opt-in 부재 guard/실제 PostgreSQL host 및 실제 PG15/OIDC/browser opt-in. SKIP은 실제 DB/browser PASS가 아니다. 기존 python_multipart PendingDeprecationWarning 1건.
- `npm run typecheck`, `npm run lint`, `npm run build` (apps/web): 각각 exit0. lint 3 files, Vite 20 modules/502ms. build 출력은 QA build일 뿐 browser PASS가 아니다.
- `PY -B -c "from pathlib import Path; files=['packages/api/operations.py','tests/api/test_f20_u01_r10_dashboard_api.py','tests/integration/test_f20_u01_oidc_browser_pg15.py','tests/tooling/test_f20_u01_r33t_start_projection.py']; [compile(Path(p).read_bytes(),p,'exec') for p in files]; print('COMPILE_PASS 4')"`: exit0, 4파일 구문 PASS, pyc 생성0.
- `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`: exit0.
- `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`: exit0, `R6_AUDIT_SELF_TEST_PASS`. 출력의 TIMEOUT/READABLE_401/ROUTE_CONTINUE_FAILED는 self-test 음성 주입이며 실제 browser 실행 아님.
- `PY -B -m scripts.check_project_progress`: exit0, `PASS sequence=2008 reporting=AUTO_CONTINUE`.
- `git diff --check`: exit0. 제품/테스트 코드 diff는 7파일 356 insertion/30 deletion, 보고서 별도. Main `docs/WORK_STATUS.md` 4 insertion은 Developer 변경이 아니다.

## 오류·임시 자료·미검증

- formal FAILURE_REPORT 0. TDD 예상 RED와 아래 환경/호출 오류는 정식 제품 실패로 세지 않는다.
- Invocation 최초 파일명에 `_PROMPT`를 붙여 read 실패1회; 실제 `_INVOCATION.md`를 찾아 hash 일치 확인 후 작업.
- file-path 방식 `PY -B scripts/check_project_progress.py`는 기존 scripts import 경로 오류1회. module 방식으로 바로 재검증 PASS했다. checker 수정0.
- 처음 unignored `.tmp_r34`를 사용해 G-05 Git 경계 오류1회. 링크 아닌 root를 검증 후 ignored `.tmp_subagent_review/r34`로 이동했다. 이후 npm build의 untracked `apps/web/dist` 때문에 중간 70P/1S/1F의 G-05 실패1회가 있었다. typecheck/lint/build 종료 후 자체 출력 3파일만 정확 경로/링크 검사하고 제거, dist 잔여0. Win32_Process CIM 조회는 권한 거부1회였고 우회하지 않았다.
- 최종 pytest 전용 root: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r34`. 97파일/22 pytest symlink. 21링크는 해당 root 내부, 1링크 `task0/test_r33t_start_rejects_scope_current`는 이동 전 자체 경로 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_r34\task0\test_r33t_start_rejects_scope_0`를 가리킨다. 기존 `.tmp_r34` root는 없다. parent 자체 링크0. root 재귀 삭제 guard가 링크 존재/외부 경계로 중단했으며 **pytest 자료 삭제0**, Main에 정확 경계 인계. 다른 임시물/프로세스는 건드리지 않는다. Developer 테스트 세션8547/57322/85645 및 web30740은 종료코드 수집 완료. 이후 새 python/node는 Main 작업 가능성이 있어 종료하지 않았다.
- 실제 WSL 비0 Run/API↔DOM, 실제 DB/브라우저/OIDC/network, Production/Provider/PG18는 Developer 미실행. Main이 동일 SHA 격리 tmpfs PG15 QA 후 증거를 별도 결박해야 한다. 이번 3 Run은 opt-in fixture일 뿐 운영 자료가 아니다.
- 전체 저장소 suite는 이번 Windows 절편에서 재실행하지 않았다. R33T 과거 WSL8581P를 R34 결과로 재사용하지 않는다. 필터·Gate/비용/baseline source·Critical ack·U01 전체 acceptance 미해결.

## 조치·rollback

Main control-only TDD 보완 → 독립 diff/spec 검토 → 동일 SHA WSL 실제 비0/브라우저 QA 순서로 인계한다. Developer의 executing-plans/TDD/verification 스킬은 순차 RED/GREEN·증거 분리·최종 fresh 검증에 사용했으며 exact8 제약 때문에 별도 ledger/branch/subagent/commit은 생성하지 않았다.

회귀 시 Main이 R34 exact8 diff만 정상 Git revert/복구한다. API와 UI exact 응답 소비자를 함께 되돌리고, 기존 WORK_STATUS·progress/Event·R33T 증거·사용자 dirty는 보존한다. DB migration/운영 데이터 rollback은 필요 없다. lease 회수·acceptance·progress/HANDOFF/WORK_STATUS 기록은 Main 소유로 남겼다.

## 마감 후속 증거

- 임시 정리: Main이 확인한 stale 링크의 절대 경로·SymbolicLink/ReparsePoint·target 문자열·old root/target 부재를 재검증했다. 링크 자체만 `Remove-Item -LiteralPath <exact-link> -Force`로 unlink, target 접근/삭제0. 남은 21링크는 r34 내부 target임을 전수 확인 후 링크 자체만 제거했다. 모든 link 제거·exact resolved root 재검증 뒤 자체 r34 임시 root만 제거했다. 최종 `R34_RESIDUE=False`, `OLD_ROOT=False`, `DIST_RESIDUE=False`, exit0. 기존 `.tmp_subagent_review` 부모/다른 임시 자료/프로세스는 보존했다. 프로세스 CommandLine 귀속은 OS 제한으로 미확정이며 어떤 프로세스도 종료하지 않았다. 삭제 자료는 pytest fixture/build 재생성 가능 출력이며 사용자 자료가 아니다.
- 보고서 작성 직후 `PY -B -m scripts.check_project_progress`: exit1 `F20_U01_R34_AUTHORITY_INVALID`. `scripts/f20_u01_r34_start_overlay.py:51`의 AUTHORITY_FILES에 REPORT가 포함되어 결과보고서를 BASE의 NOT_STARTED 틀과 byte-equal 강제한다. WI exact8은 해당 결과보고서 작성을 허용한다. Main이 이 control 결함을 확인하고 별도 control-only TDD 수정을 맡았다. Developer는 overlay/checker/control test/원장을 변경하지 않았다. 앞선 171P/3S와 G-05 PASS는 보고서 작성 전 결과이며 최신 G-05를 PASS로 승격하지 않는다.
- final diff-check exit0; Developer 변경 exact8, 별도 Main 소유 WORK_STATUS dirty 보존. formal FAILURE_REPORT0이며 이 인계는 정식 제품 실패보고가 아니다.
- Main 출처 후속: REPORT∈SCOPE/REPORT∉AUTHORITY_FILES test RED1 → overlay 항목1 제거 → R34 start3P, G-05 seq2008 PASS. Main 변경은 `scripts/f20_u01_r34_start_overlay.py`, `tests/tooling/test_f20_u01_r34_start_projection.py`이며 Developer exact8과 분리한다. Developer의 후속 `PY -B -m scripts.check_project_progress`도 exit0 `PASS sequence=2008 reporting=AUTO_CONTINUE`, `git diff --check` exit0, r34/old-root/dist 세 경로 모두 Test-Path=False를 재확인했다. 따라서 최신 상태는 로컬 개발 COMPLETED이며 앞선 control 실패 기록은 해소된 이력이다.
