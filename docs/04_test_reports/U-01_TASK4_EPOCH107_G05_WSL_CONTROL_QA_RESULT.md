# U-01 Task4 epoch107 G-05 WSL-server control QA 결과

## 판정

`H2_EXACT_SHA_G05_PASS; FOCUSED_HISTORY_FIXTURE_FAIL; U01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 H2 `d6cf8be5608eeb3ce438353a8184bb9b2e55cc20`은 Windows 로컬·private `development`·WSL-server 격리 checkout에서 일치했고 clean G-05는 각각 `PASS sequence=2324 reporting=AUTO_CONTINUE`였다. 그러나 WSL-server의 epoch107 focused 시험은 exit 1이므로 이 시험군이나 전체 U-01을 PASS로 표시하지 않는다.

## 실제 명령·근거

- Windows 로컬 H2: `git ls-remote development refs/heads/codex/u01-dashboard-r2`가 H2 SHA와 같고 `python -B scripts/check_project_progress.py` exit 0이었다. 독립 코드 리뷰 Critical0/Important0, Developer의 A 시점 신규6·epoch105 8·인접 U-01 9 PASS는 각각 당시 투영의 증거이며 H2 focused PASS가 아니다.
- `ssh WSL-server`의 격리 경로 `/home/daon/anvil-u01-g05-e107-control-qa`: `daon:daon` 0700, realpath 일치, Git clean H2, private 원격 H2 일치. 단일 branch clone에는 검사기가 요구하는 `development/main` 추적 ref가 없어 최초 G-05는 `U01_TASK4_G05_GIT_INVALID` exit 1이었다. 격리 clone 내부에 원격 main `0443043251d25aa77c17d23165b7c9299c8dbeb8`의 추적 ref만 fetch한 뒤 같은 H2의 G-05 exit 0. 새 작업 branch나 공유 checkout은 만들지 않았다.
- WSL 집중 명령: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --basetemp=/home/daon/anvil-u01-g05-e107-control-qa/.pytest_tmp_u01_g05_e107 tests/tooling/test_u01_postmerge_control_projection.py -k U01Task4Epoch106G05SuccessorTests --tb=short` → exit 1, `10 failed, 2 passed, 73 deselected, 12 subtests passed`(21.67초). 이 중 정상 A/B/H2 합성 fixture를 기대한 네 test method와 일부 위조 subtest가 실패했다. 전체 79건은 미실행이다.
- Windows 로컬 같은 H2에서 `test_published_a_validates_with_exact_new_events_and_active_lease`만 재실행 → exit 1, `1 failed, 78 deselected`, 동일 `U01_TASK4_G05_EVENT_INVALID`·`U01_TASK4_G05_MISSING`. 따라서 WSL/Python 버전 특이 결함으로 단정하지 않는다.

## 원인과 재개 경계

신규 focused fixture의 `checkpoint_b()`와 활성 검사 테스트가 `checker.load_bundle(ROOT)`로 **현재** H2를 읽는다. H2에서는 `worker_lease`·`write_lease`가 이미 null이고 Event가 seq2324이므로, 시험의 A seq2322·활성 lease 가정과 충돌한다. `closed_h2()`가 null lease에서 `lease_id`를 읽는 TypeError와 B/A validator의 Event 오류가 이 계보 불일치와 일치한다. Git active 음성의 `matching`도 현재 HEAD H2를 과거 A로 간주한다. 과거 A의 불변 Git blob으로 fixture를 고정하고 현재 H2와 분리하는 비제품 test-only 수정이 필요하며, 실제 코드 결함이나 사용자 인수 실패로 아직 단정하지 않는다.

이 결과·`design_change.md`의 DC-U01-013 기록은 미실행 항목의 이번 주기 정리이지 시험 PASS가 아니다. 동일 기존 branch에서 별도 비제품 WorkInstruction·dual lease로 역사 fixture와 후속 G-05 경로를 fail-closed 복구한 뒤 Windows/WSL-server clean exact-SHA 집중 시험을 다시 실행한다. Foundation R6 `STORED_ROW`, 전체 E-NET/E-API/E-AUD와 U-01 사용자 인수는 별개로 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`; PR/main·새 branch/U-02·ysna-server는 실행하지 않는다.

## 임시 자원 정리

WSL QA에서 생성한 것은 등록된 단일 격리 Git checkout과 그 내부 시험 임시 자료뿐이다. PostgreSQL·Docker·브라우저·port·Secret 생성0. pytest 종료 후 `.pytest_tmp_u01_g05_e107` 부재, Git clean·H2 G-05 재PASS를 확인했다. 첫 삭제 시도의 PowerShell/원격 셸 인용 오류는 대상 변경 전에 exit 1이었고, 대상 존재를 읽기 전용으로 재확인했다. 다음 단일 WSL 셸에서 정확 경로·owner `daon`·realpath·clean·임시 자료 부재를 검증한 뒤 등록 checkout만 제거해 `WSL_G05_E107_QA_RESIDUE_ZERO` exit 0을 확인했다. 공유 WSL checkout·서비스는 변경하지 않았다.

Rollback은 이 보고/재작업 문서 checkpoint만 정상 revert하고 H2·R7·승인 계약과 private 복구 ref를 보존하는 방법이다.
