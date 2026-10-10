# U-01 Task4 epoch108 H3 WSL-server control QA 결과

## 판정

`H3_EXACT_SHA_G05_PASS; FOCUSED_REGRESSION_FAIL; U01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 H3 `37323c39839f119137fc9b22502464034086189f`는 로컬/private/WSL-server 격리 checkout에서 같은 SHA·clean이며 G-05 `PASS sequence=2329`였다. 그러나 WSL 집중 회귀는 exit 1이므로 전체 통제 회귀 PASS나 U-01 인수를 주장하지 않는다.

## 명령·결과·원인

- `ssh WSL-server`의 등록 경로 `/home/daon/anvil-u01-g05-e108-control-qa`는 `daon` 소유 0700, realpath 일치, Git clean이었다. 격리 clone 내부에서만 `development/main` 추적 ref `0443043251d25aa77c17d23165b7c9299c8dbeb8`을 fetch했다. DB·Docker·browser·port·Secret·공유 checkout 변경은 없었다.
- `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --basetemp=/home/daon/anvil-u01-g05-e108-control-qa/.pytest_tmp_u01_g05_e108 tests/tooling/test_u01_postmerge_control_projection.py -k "U01Task4Epoch107PostcloseFixtureTests or U01Task4Epoch106G05SuccessorTests" --tb=short` → exit 1, `1 failed, 13 passed, 73 deselected, 110 subtests passed in 64.40s`.
- 실패는 `test_g05_dispatches_b_and_h3_without_accepting_u01`의 합성 B `checker.validate_bundle(b_bundle)`에서 `PRG_REGISTRY_HASH_MISMATCH`였다. `checkpoint_b()`가 progress/hand-off를 합성하면서 `registry_refs`가 참조하는 원본 파일의 `_file_hashes`를 B 자료와 재결박하지 않는다. 같은 시험의 H3에는 `_validate_registry_refs` mock이 있으나 B에는 없어 fixture 불일치가 노출됐다. 실제 H3 G-05 seq2329 통과와 구분하며 제품 결함으로 단정하지 않는다.
- Windows 신규8·독립 신규+epoch107 14 PASS는 이전 실행 당시 범위의 증거다. 이번 WSL 실패를 지우지 않는다. 전체 현재87·Windows 기본 fd-capture·Foundation R6 `STORED_ROW`·전체 E-NET/E-API/E-AUD·U-01 인수는 미검증이다.

## 조치·재개 경계

검사기나 제품 계약을 완화하지 않고 합성 B fixture의 실제 파일 hash 결박을 최소 수정하는 별도 비제품 WI/유효 dual lease가 필요하다. 그 뒤 기존 branch에 clean checkpoint/private push, 로컬·WSL-server 같은 SHA의 focused 및 G-05를 재실행한다. 이 결과는 `design_change.md`에 이번 주기 미진으로 기록하되 테스트 PASS로 취급하지 않는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; PR/main·새 branch·ysna 작업은 하지 않는다.

본 결과/현황/DC를 H3 뒤에 기록한 현재 dirty 문서 상태의 G-05는 exit1 `U01_TASK4_POSTCLOSE_CLOSE_FROZEN_INVALID`, `U01_TASK4_POSTCLOSE_GIT_INVALID`이다. 따라서 G-05 PASS 표기는 H3 정확 SHA에만 한정하고, 후속 보고 checkpoint의 G-05 GREEN은 주장하지 않는다.

## 임시 자원 정리

실패 후 QA checkout의 owner `daon`, mode 0700, realpath 정확 경로, Git clean과 활성 Python/pytest 작업 부재를 확인했다. 등록된 `/home/daon/anvil-u01-g05-e108-control-qa`만 제거하고 `QA_CHECKOUT_REMOVED`·경로 부재 exit0을 확인했다. 복구는 private branch H3에서 새 격리 clone으로 가능하며 공유 자원 변경·잔여0이다.
