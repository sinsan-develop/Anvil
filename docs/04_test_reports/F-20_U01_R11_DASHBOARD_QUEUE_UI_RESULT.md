# F-20/U-01 R11 Dashboard Queue UI Developer 결과

## 판정

`COMPLETED` — 승인된 R11 exact3 로컬 화면 연결과 기본 검증을 완료했다. 이는 Queue 카드 단위의 Developer 결과이며 Main 독립 검토, WSL-server 동일 SHA API/브라우저 Network, U-01/F-20 전체 수락은 아니다. C30 `OPEN_BLOCKING` 및 ReleaseDecision `DEFER`를 유지한다.

## 기준·권한

- 담당: `developer-primary-f20-u01-r11`, branch `codex/f18-wsl-ops`, 시작 HEAD `80795b62bea04fa967ae65421654f3e5850a2135`.
- 시작 `git status --short`: Main 소유 `docs/WORK_STATUS.md`만 dirty. 해당 파일은 읽기만 했고 수정·stage·복구하지 않았다.
- 기준: R11 계획 SHA-256 `69153489F8C30C71E00698F0BE7FD86A0FEE7CEF0D45FD2B7D3894D589792AD3`, WorkInstruction `91E16FCCF59855D0024C55E4A8EB6EEC0A7380EB339F80801FA18A400BE43AD5`, Invocation `C61C19B853E52C134985513F4CFA9005B304D2107231E765764B07F8BC25F050`.
- canonical Event seq1858, epoch24 worker `f20-u01-r11-execution-fence-epoch-24-r11ui2909a` / write `f20-u01-r11-write-fence-epoch-24-r11ui2909a`, 두 lease `ACTIVE`, 만료 `2026-09-30T08:16:10+00:00`, exact3 scope 확인. 제품 수정 전 `.venv\Scripts\python.exe -B scripts\check_project_progress.py`는 `G-05 project progress contract: PASS sequence=1858 reporting=AUTO_CONTINUE`, exit 0.

## 변경과 계약

- `apps/web/src/console/App.tsx`: Dashboard Queue 카드만 R10 `GET /api/dashboard/operations`로 연결. `credentials: same-origin`, `Accept: application/json`, `AbortSignal`을 사용한다. 401/403은 `BLOCKED`; 그 외 비정상 상태·네트워크·JSON·계약 오류는 `UNAVAILABLE`로 닫는다. 성공 시 snapshot의 명시적 12개 필드, health component와 Queue row 필드, 고유 source gap, 최대 100행 및 중복 job ID를 검사한 뒤 원문 행 없이 `범위 내 관측 N건`만 표시한다. Gap 존재와 부재 모두 health `UNKNOWN`이며 0행도 실제 전체 0건으로 주장하지 않는다.
- `apps/web/tests/f15-console.test.mjs`: URL/credential/header/signal, 0·양수 count와 gap 부재, 401/403·5xx·네트워크, secret/error body 비노출, 잘못된 envelope/snapshot/row/gap/중복·101행, Database/Provider/Critical Alerts/기존 운영 상태 회귀를 추가했다. Test fixture가 `request_id` 누락만으로 모든 malformed 사례를 통과시키던 문제를 발견해 정상 envelope를 채워 각 사례가 실제 해당 필드를 검증하게 했다.
- 이 결과보고서. API·DB·권한, Queue mutation, 다른 메뉴 및 기존 카드 호출 경로는 변경하지 않았다.

## 정확한 로컬 실행·결과

1. `apps/web`에서 `C:\Users\cyhuh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --import tsx --test --test-name-pattern='Dashboard Queue' tests/f15-console.test.mjs`: 구현 전 RED, 신규 loader 부재로 4 failed / 기존 shell 회귀 1 passed, exit 1. 최초 worktree root에서 직접 Node 실행한 22개 JSX `React is not defined` 오류는 잘못된 cwd로 `apps/web/tsconfig.json` 변환을 사용하지 않은 호출 오류이며, 같은 명령을 `apps/web`에서 재실행해 제품 RED를 확인했다.
2. 같은 테스트 범위 구현 후 `C:\Program Files\nodejs\npm.cmd run test:console`: 29 passed / 0 skipped, exit 0. 검증 중 malformed fixture를 보정하고 중복 Queue 행에서 RED 1 failed / 0 passed, exit 1 → 중복 ID 거부 후 GREEN 1 passed, exit 0을 확인했다. 최종 전체 console 재실행도 29 passed / 0 skipped, exit 0.
3. `apps/web`에서 `C:\Program Files\nodejs\npm.cmd run typecheck`: exit 0. `C:\Program Files\nodejs\npm.cmd run lint`: 3 files checked / fixes 0 / exit 0. `C:\Program Files\nodejs\npm.cmd run build`: Vite 20 modules transformed / exit 0.
4. worktree root에서 `.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r11_dev tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f13_operations_api.py`: 19 passed / 0 skipped / exit 0. 이 검증은 로컬 API 인접 회귀이며 실제 PostgreSQL·OIDC·브라우저 증거가 아니다.
5. 전체 `tests` 수집 확인: `.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r11_dev tests --maxfail=1`: 기존 `tests/design/test_models.py`와 `tests/execution/test_models.py`의 같은 basename에 따른 `import file mismatch`로 2590 collected / collection error 1 / exit 1. 전체 suite PASS를 주장하지 않는다.
6. `git diff --check`: exit 0. 수정은 위 exact3뿐이며 commit/push/merge/WSL-server/ysna/Production 작업은 수행하지 않았다.

## 정리·미검증·rollback

- 전용 pytest base `.pytest_tmp_f20_u01_r11_dev`는 생성 전 부재를 확인했고 pytest 실행 종료 후 잔여 0이었다. 빌드 생성물 `apps/web/dist`는 시작 상태에 없었고, worktree 내부 정확한 절대경로·비 reparse root·내부 reparse point 0을 확인한 뒤 그 폴더만 제거해 잔여 0이다. 공유 서비스·DB·다른 작업 자원은 변경하지 않았다.
- 미검증: Main 독립 리뷰, 실제 WSL-server Git exact SHA/DB/API/브라우저/OIDC/Network, 전체 Python suite 정상 실행, 다른 Dashboard read model·Next Actions, U-01/F-20 수락. Static render와 빌드는 실제 브라우저 확인으로 승격하지 않는다.
- rollback: Main이 R11의 `App.tsx`와 `f15-console.test.mjs` diff만 되돌려 R10 API checkpoint를 유지하고, 본 결과보고는 감사 기록으로 보존한다. Main 소유 `docs/WORK_STATUS.md`는 rollback 대상이 아니다.
