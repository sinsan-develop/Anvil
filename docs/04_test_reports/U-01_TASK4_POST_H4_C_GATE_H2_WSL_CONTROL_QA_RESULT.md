# U-01 Task4 post-H4 C gate H2 WSL-server 통제 QA 결과

## 판정

`H2_EXACT_SHA_G05_AND_FOCUSED_PASS; U01_NOT_ACCEPTED`. 기존 단일 브랜치 `codex/u01-dashboard-r2`의 H2 `4117aceab7e1172f62e7f1af2cf2fb2d0bae101f`는 Windows 로컬·사설 `development` 원격·WSL-server 격리 Git checkout에서 동일 SHA였다. 로컬과 WSL-server의 G-05는 각각 exit0 `PASS sequence=2349 reporting=AUTO_CONTINUE`, WSL 집중 회귀는 exit0 `36 passed, 87 deselected, 131 subtests passed in 423.83s`다. 이 증거는 H2 정확 SHA의 비제품 진행 통제 범위만 증명한다. 원본 C `3e788ed25330910d2b55c932e3fe517e8661bd59`의 G-05 실패는 불변이다.

## 기준·실행

- W3 `e5e131d648b5b445be9bcbfa6fac504b2b02e8b5`→A2 `2457544cc02d2992c9458e97ae708c00b5da769c`→C2 `77478cf38cc897092c443ddeb5f6e35ebc9ee731`→B2 `488581291dd313f2c012076f696b2381f40d8006`→H2는 기존 브랜치의 각 직접 부모다. C2 정확 검사기·통제 테스트2, B2 정확 통제4, H2 Event/progress/HANDOFF/digest/WORK_STATUS 정확5경로다. C2/B2/H2의 독립 검토는 각 Critical0/Important0이며 각 로컬 G-05 seq2347/2347/2349 exit0이다. H2에서 seq2348 write→2349 worker 회수, completed 두 lease `REVOKED`, active lease/agent null, 제품 scope0이다.
- H2 로컬 집중 회귀: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q --capture=sys -p no:cacheprovider tests/tooling/test_u01_postmerge_control_projection.py::U01Task4PostH4CGateRecoveryTests` → exit0 `9 passed in 160.39s`. C2 최종 바이트의 신규9+인접 epoch111/110/109 3은 Main exit0 `12 passed in 190.09s`였다. 첫 Main 재검증은 선택자 오기입으로 `no tests ran` exit1 후 위 올바른 선택자로 재실행했다.
- 사전 등록 `/home/daon/anvil-u01-g05-e112-control-qa`는 `ssh WSL-server`의 `daon` 계정에서 생성 전 부재·비 symlink였다. 0700 격리 Git clone의 owner `daon`·realpath 정확, HEAD·기존 동일 branch·private ref는 H2 exact SHA였고 tracked/untracked clean이었다. clone 내부 remote만 `development`로 이름 변경하고 `main:refs/remotes/development/main`을 fetch했다. 공유 checkout·서비스·DB·Docker·browser·port·Secret은 변경하지 않았다.
- WSL G-05: `cd /home/daon/anvil-u01-g05-e112-control-qa && PYTHONDONTWRITEBYTECODE=1 python3 -B scripts/check_project_progress.py` → exit0 `PASS sequence=2349 reporting=AUTO_CONTINUE`.
- WSL 집중 회귀: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --capture=sys --basetemp=/home/daon/anvil-u01-g05-e112-control-qa/.pytest_tmp_u01_g05_e112 tests/tooling/test_u01_postmerge_control_projection.py -k "U01Task4PostH4CGateRecoveryTests or U01Task4PostH4ReportTailTests or U01Task4PostH4ReportSuccessorTests or U01Task4Epoch108H3RegressionTests" --tb=short` → exit0 `36 passed, 87 deselected, 131 subtests passed in 423.83s`. 87 deselected는 미실행이며 PASS가 아니다.

## 정리·미검증

시험 종료 후 전용 checkout은 owner `daon`·mode0700·realpath 정확·HEAD H2·tracked/untracked clean·내부 symlink0·pytest process0이었다. 사전 등록된 이 경로만 정확 확인 후 삭제했고 부재·비 symlink를 다시 확인해 `U01_E112_QA_RESIDUE_ZERO` exit0이다. 기존 branch와 사설 원격 복구 ref는 보존했다.

Foundation R6 `STORED_ROW`의 정확 실패 단언·PG15/OIDC/HTTPS/Chromium 재현, 전체 suite/Windows 기본 fd-capture, 전체 E-NET/E-API/E-AUD와 U-01 ID별 수직 인수는 이번 통제 QA 범위가 아니며 PASS가 아니다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; PR/main 병합·신규 branch·ysna 작업은 미실행이다. 이 보고·`design_change.md`·`WORK_STATUS`의 H2 후속 commit은 H2 SHA의 과거 PASS를 최신 SHA에 자동 상속하지 않으므로 최신 G-05를 별도로 판정한다. 다음은 같은 브랜치에서 Foundation R6의 정확 단언을 별도 WI/lease와 격리 WSL-server 실제 환경으로 분리한다.
