# U-01 Task4 epoch109 H4 WSL-server control QA 결과

## 판정

`H4_EXACT_SHA_G05_AND_FOCUSED_PASS; U01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 H4 `91fa68b0092ebf56d8118b285499a3c88269df51`는 로컬·사설 개발 원격·WSL-server 격리 checkout에서 같은 SHA이며 양쪽 G-05 `PASS sequence=2334`다. WSL-server의 epoch109/108/107 통제 집중 회귀는 exit0 `26 passed, 71 deselected, 133 subtests passed in 379.98s`다. 이것은 해당 SHA의 통제 범위 증거이지 Foundation R6, 전체 97건, 사용자 수직 인수, Release 또는 Production PASS가 아니다.

## 기준·수행

- 기준: A `aaaefceb9fbe4099434cada3eed754350c8c94ec`→코드 C `8af39a91aa0deca2281fd3c876eb55cae8c74004`→활성 B `ed277d3cdbc81f791d8dd45b06f812c770dd9d27`→H4의 단일 직접 자식 chain이다. C는 정확 검사기·통제 테스트2만 변경, B는 canonical 문서4, H4는 Event/progress/HANDOFF/digest/WORK_STATUS5만 변경했다. B/H4 독립 검토는 각각 Critical0/Important0/Minor0, B G-05 seq2332와 H4 로컬 G-05 seq2334는 exit0이다.
- WSL-server: `ssh WSL-server`의 `daon` 계정에서 사전 등록된 `/home/daon/anvil-u01-g05-e109-control-qa`가 처음에는 부재·비 symlink였다. 새 0700 디렉터리의 owner `daon`, realpath 동일, Git HEAD=H4·clean, 사설 원격 branch SHA=H4를 확인했다. 격리 clone 내부에서만 remote를 `development`로 이름 변경하고 `main:refs/remotes/development/main`을 fetch했다. 공유 checkout·서비스·DB·Docker·browser·port·Secret은 변경하지 않았다.
- WSL G-05: `cd /home/daon/anvil-u01-g05-e109-control-qa && PYTHONDONTWRITEBYTECODE=1 python3 -B scripts/check_project_progress.py` → exit0 `G-05 project progress contract: PASS sequence=2334 reporting=AUTO_CONTINUE`.
- WSL focused: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --capture=sys --basetemp=/home/daon/anvil-u01-g05-e109-control-qa/.pytest_tmp_u01_g05_e109 tests/tooling/test_u01_postmerge_control_projection.py -k "U01Task4Epoch108H3RegressionTests or U01Task4WslReportSuccessorTests or U01Task4Epoch107PostcloseFixtureTests" --tb=short` → exit0 `26 passed, 71 deselected, 133 subtests passed in 379.98s`.
- Windows 후보에서 Developer 최종 신규10 PASS, epoch108 8·epoch107 6·epoch105 8 PASS(exit0)와 독립 코드 리뷰 Critical0/Important0·3 PASS를 확인했다. 전체 97건은 약30 진행 뒤 안전 중단해 최종 미판정이며 Windows 기본 fd-capture도 미실행이다. 키·인증 오류를 PASS로 무시한 시험은 없다.

## 자원 정리와 경계

시험 종료 후 격리 checkout의 `git status --porcelain`은 빈 출력, 내부 symlink 출력0, `pgrep -af "python3 -B -m pytest"`는 exit1/잔존0이었다. 삭제 직전 owner `daon`·mode0700·realpath 정확 경로를 재확인하고 등록된 단일 `/home/daon/anvil-u01-g05-e109-control-qa`만 `rm -r --`로 제거했다. `test ! -e`와 `test ! -L`가 exit0이므로 해당 QA 경로 잔여0이다. 이 제거 대상은 사전 등록된 임시 checkout이며 Git의 H4와 사설 원격 복구 ref는 보존한다.

H4 SHA 이후 이 결과와 `design_change.md`·`WORK_STATUS`를 추가하는 별도 보고 checkpoint의 G-05는 H4 PASS를 자동 상속하지 않는다. 최신 보고 checkpoint의 통제 successor는 별도 fail-closed 경로로 판단해야 한다. Foundation R6 `STORED_ROW`, 전체 E-NET/E-API/E-AUD, 전체 U-01 ID별 실제 DB/API/화면/Network·독립 사용자 인수는 미검증이다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; PR/main·새 branch·ysna 제외다. 다음은 같은 브랜치에서 미충족 항목을 정확 WI/dual lease로 재작업하되, 보고 기록만으로 PASS·병합 조건을 충족했다고 해석하지 않는다.
