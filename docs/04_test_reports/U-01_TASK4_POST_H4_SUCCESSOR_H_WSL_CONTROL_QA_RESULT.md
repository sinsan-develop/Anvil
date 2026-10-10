# U-01 Task4 post-H4 보고 successor H WSL-server 통제 QA 결과

## 판정

`H_EXACT_SHA_G05_AND_FOCUSED_PASS; U01_NOT_ACCEPTED`. 기존 단일 `codex/u01-dashboard-r2`의 H `c821a4661a601c16b3b22964e2f4054719cc4fd2`는 로컬·사설 개발 원격·WSL-server 전용 checkout에서 동일 SHA·tracked clean이었다. 로컬과 WSL의 G-05는 각각 exit0 `PASS sequence=2339 reporting=AUTO_CONTINUE`, WSL focused는 exit0 `34 passed, 71 deselected, 159 subtests passed in 568.92s`다. 이는 H 정확 SHA의 진행 통제 범위만 증명한다. Foundation R6 `STORED_ROW`, 전체 suite/Windows 기본 fd-capture, E-NET/E-API/E-AUD 및 U-01 수직 인수는 PASS가 아니다.

## 기준·수행

- H4 `91fa68b0092ebf56d8118b285499a3c88269df51`→보고 R `8c56ffc966c585fd8164ab7b7b6fde6e27e99fd3`→계획 P `fed668c6d58d5e452b457e139ea2cbe45b1413b4`→WI W `6cb5390c7c5f94ce556524e83c2e27a843f86be3`→lease A `184836072d127b3e2048a42589d29e69d99ed172`→코드 C `01eed2d548999559bcac971ed6820395e8eb1356`→활성 B `00c4376aa65c4f70bb45e11ef2c7024c03eff28e`→H는 단일 직접 부모 계보다. C는 검사기/통제 테스트 정확2, B는 progress/HANDOFF/digest/WORK_STATUS 정확4, H는 Event/progress/HANDOFF/digest/WORK_STATUS 정확5만 변경했다. A/B/H의 독립 Critical0/Important0 및 각 로컬 G-05 seq2337/2337/2339 exit0을 확인했다. H에서 write→worker seq2338→2339 회수, 완료 두 lease REVOKED·활성 lease0·제품 write0이다.
- 사전 등록 경로 `/home/daon/anvil-u01-g05-e110-control-qa`는 `ssh WSL-server`의 `daon` 계정에서 생성 전 부재·비 symlink였다. 0700 격리 Git clone의 owner `daon`·realpath 정확, HEAD=private branch=`c821a4661a601c16b3b22964e2f4054719cc4fd2`, tracked clean을 확인했다. clone 내부 remote만 `development`로 이름 변경하고 `main:refs/remotes/development/main`을 fetch했다. 공유 checkout·서비스·DB·Docker·browser·port·Secret은 변경하지 않았다.
- WSL G-05: `cd /home/daon/anvil-u01-g05-e110-control-qa && PYTHONDONTWRITEBYTECODE=1 python3 -B scripts/check_project_progress.py` → exit0 `PASS sequence=2339 reporting=AUTO_CONTINUE`.
- WSL focused: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --capture=sys --basetemp=/home/daon/anvil-u01-g05-e110-control-qa/.pytest_tmp_u01_g05_e110 tests/tooling/test_u01_postmerge_control_projection.py -k "U01Task4PostH4ReportSuccessorTests or U01Task4Epoch108H3RegressionTests or U01Task4WslReportSuccessorTests or U01Task4Epoch107PostcloseFixtureTests" --tb=short` → exit0 `34 passed, 71 deselected, 159 subtests passed in 568.92s`.
- 로컬 신규 class는 Developer·Main 각각 8 PASS; 인접 6+3 PASS는 Developer 실행 범위다. 전체 suite와 Windows 기본 fd-capture는 미실행이며 독립 리뷰는 정적 코드·투영 적합성만 판정했다. 키/SSH sandbox 오류를 테스트 PASS로 무시하지 않았다.

## 자원 정리·미충족

시험 종료 후 전용 checkout은 owner `daon`·mode0700·realpath 동일·HEAD H·tracked dirty0·비무시 untracked0·내부 symlink0·pytest process0이었다. 삭제 직전 이 신원을 다시 검사하고 사전 등록된 `/home/daon/anvil-u01-g05-e110-control-qa` 한 경로만 `rm -r --`로 제거했다. `test ! -e`·`test ! -L`는 exit0, `U01_E110_QA_RESIDUE_ZERO`다. Git H와 사설 원격 복구 ref는 보존한다.

이 결과보고와 `design_change.md`·`WORK_STATUS`를 H 이후 새 commit으로 기록하면 H의 G-05 PASS를 새 HEAD에 상속할 수 없다. 최신 보고 checkpoint의 fail-closed 통제는 별도 판정이 필요하다. Foundation R6 `STORED_ROW`는 현재 정확 실패 단언이 아직 확인되지 않아 단순 UI/하네스 수정으로 PASS 처리하지 않는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; PR/main·새 branch·ysna 제외다. 다음은 이번 보고의 최신 G-05 상태를 정확히 기록하고, R6를 별도 WI·실제 WSL-server 진단으로 원인 분리한다.
