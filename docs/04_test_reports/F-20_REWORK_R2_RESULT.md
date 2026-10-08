# F-20/R2 로컬 이식성 재작업 결과

## 판정

- 담당: `developer-primary-f20-r2`; 할당된 로컬 수정 `COMPLETED`. F-20 수락·P-01 시작·main 병합 판정은 아니다.
- 시작 branch/HEAD: `codex/f18-wsl-ops` / `7840a8e73dd05be0959a8a761dff16841a28697a`; 시작 `git status --porcelain=v1 -uall`은 빈 출력이었다.
- 유효 소유권: canonical seq1725, worker epoch2 `f20-r2-execution-fence-epoch-2-r228f20suite`, write epoch2 `f20-r2-write-fence-epoch-2-r228f20suite`; 정확한 8개 경로 범위만 사용했다.
- 기준 SHA-256: 설계서 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획서 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합검증매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획서 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R2 WorkInstruction `5399588999995AF85C88F36C589D7833FC318E7C747F4E0AA10D4085B20DAE46`.

## 원인·수정

| 경로 | 확인된 원인 | 조치 |
| --- | --- | --- |
| `packages/paths/identity.py`, `tests/paths/test_conflict_scope_identity.py` | POSIX `pathlib`가 가상 `C:/...`를 상대 경로로 해석; 첫 패치의 빠른 경로가 실제 `/mnt/<drive>`까지 lexical 처리해 symlink 검사를 우회 | 가상 drive 입력만 lexical 정규화하고 실제 `/mnt/<drive>` 입력은 native filesystem resolution을 먼저 거친다. mount를 disposable filesystem에 매핑한 음성 테스트를 추가 |
| `tests/deploy/test_wsl_staging_harness.py`, `tests/tooling/test_a14_workbench_prototype.py` | 11개의 `TemporaryDirectory(dir="D:/tmp")`가 Linux/WSL에서 실패 | 각 테스트가 실행 환경의 임시 root를 사용하게 변경 |
| `tests/execution_backends/test_git_worktree.py` | POSIX symlink를 `os.rmdir`로 삭제하여 `NotADirectoryError` | symlink는 `unlink`, Windows junction은 기존 `rmdir` 유지 |
| `tests/persistence/test_oidc_pending_auth.py` | `+360s` 만료값을 수집 시각에 만들어 긴 suite 후 유효 TTL로 바뀜 | 각 parameter case를 테스트 실행 시점에 구성 |
| `tests/integration/test_c30r3_formal_entity.py` | ASGI 기본 migration head의 현재 `IfExp`를 과거 `ast.Constant`로 단정 | 현재 두 default 분기 `0016`/`0013`을 검증 |

기존 RED 증거는 이전 WSL-server 전체 suite의 해당 실패들이다(`docs/WORK_STATUS.md`의 `ac7c429` 결과: 7,887 PASS, 261 FAIL, 116 SKIP). Windows의 경로·시간 특성으로 모든 실패를 로컬에서 동일하게 재현한 것은 아니다. 독립 리뷰의 `/mnt` symlink 우회는 새 portable 음성 테스트에서 수정 전 종료 1(`ValueError not raised`)을 확인하고 수정 후 종료 0으로 전환했다.

## 로컬 실행 증거

- 최초 focused: 아래 첫 명령 → 종료 1, 8 PASS·1 ERROR. `D:\tmp`에 대한 현재 실행 sandbox `WinError 5`가 원인이며 제품 실패로 집계하지 않았다. 둘째 명령은 종료 0, 9 PASS·89 deselected.

```powershell
.venv/Scripts/python.exe -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp='D:\tmp\anvil-f20-r2-focused-7840a8e' tests/paths/test_conflict_scope_identity.py tests/persistence/test_oidc_pending_auth.py tests/integration/test_c30r3_formal_entity.py tests/execution_backends/test_git_worktree.py -k 'windows_wsl_case_and_short_aliases_share_one_conflict_scope or test_put_rejects_malformed_or_overlong_pending or test_migration_source_proves_owner_tables_are_not_in_release_0013 or test_nested_reparse_is_denied_after_workspace_materialization'
.venv/Scripts/python.exe -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp='.pytest_tmp_f20_r2_focus_7840a8e' tests/paths/test_conflict_scope_identity.py tests/persistence/test_oidc_pending_auth.py tests/integration/test_c30r3_formal_entity.py tests/execution_backends/test_git_worktree.py -k 'windows_wsl_case_and_short_aliases_share_one_conflict_scope or test_put_rejects_malformed_or_overlong_pending or test_migration_source_proves_owner_tables_are_not_in_release_0013 or test_nested_reparse_is_denied_after_workspace_materialization'
```
- `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_regression_7840a8e tests/paths/test_conflict_scope_identity.py tests/persistence/test_oidc_pending_auth.py tests/integration/test_c30r3_formal_entity.py` → 종료 0, 56 PASS, SQLite datetime adapter DeprecationWarning 1건.
- `/mnt` 우회 RED: `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_mounted_red_7840a8e tests/paths/test_conflict_scope_identity.py -k test_posix_mounted_drive_resolves_link_before_conflict_scope` → 종료 1, 기대한 `ValueError not raised`. GREEN: 같은 명령을 `--basetemp=.pytest_tmp_f20_r2_mounted_green_7840a8e`로 하고 `-k` 없이 실행 → 종료 0, 7 PASS.
- `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_git_7840a8e tests/execution_backends/test_git_worktree.py` → 종료 0, 42 PASS.
- 배포/A14 명령: `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_deploy_7840a8e tests/deploy/test_wsl_staging_harness.py tests/tooling/test_a14_workbench_prototype.py -k 'cleanup_entrypoint or seq536 or seq542 or seq590_runtime_state or browser_source_resolves_only_safe_root_relative_constants or browser_source_rejects_commented_shadowed_and_escaped_ready_path or browser_source_rejects_nested_ready_path or browser_source_rejects_template_interpolation_ready_path'` → 종료 1, 23 PASS·1 FAIL·109 deselected. 실패는 `test_seq542_runtime_image_revision_check_is_fail_closed`에서 Git Bash가 Windows `C:/Windows/system32/sort`를 선택해 `sort -u`를 실행하지 못한 로컬 도구 환경 차이(`-uThe system cannot find the file specified.`). 같은 단일 테스트를 Git `usr/bin` PATH 우선으로 재실행해도 종료 1; `bash -c 'type sort'`는 Windows sort로 확인됐다. WSL 동일 SHA에서 판정해야 한다.
- `git diff --check` → 종료 0. 변경은 위 7개 코드/테스트 파일과 이 결과 보고서만이며, Main 소유 `docs/WORK_STATUS.md`·전체 계획 파일은 건드리지 않았다.
- 실행 중 만든 `.pytest_tmp_f20_r2_*` 6개 경로는 각각 worktree 내부임과 재분석 링크의 내부 target을 확인한 뒤 정확히 제거했다. 잔류 0. 별도 DB·Docker·WSL·브라우저 자원은 생성하지 않았다.

## 미검증·후속

- Main이 `ed858e9` WSL-server 집중 suite에서 227 PASS·5 FAIL을 확인했다. 아래 3건을 로컬에서 보완한 다음 SHA의 WSL 재검증과 전체 suite, 11개 메뉴의 실제 브라우저·DB·운영 유사 기능 검증, F-20 최종 gate는 아직 미검증이다. 로컬 테스트를 이 증거로 승격하지 않는다.
- Windows Git Bash의 `sort -u` 실패는 해당 로컬 테스트 1건의 미검증으로 남긴다. 다른 범위의 전체 suite 실패는 Main의 후속 전체 실행 결과로 분류한다.
- rollback: 이 보고서와 명시한 7개 코드/테스트 파일의 R2 diff만 역적용한다. Main 소유 파일이나 사용자 자료는 건드리지 않는다.

## ed858e9 WSL 집중 suite 후속 3건

- `tests/deploy/test_wsl_staging_harness.py`: 중복 guard source의 `readonly` 진단이 WSL 한글 locale에서 번역되므로 영어 문구 대신 실제 guarded 변수 `C21_CANDIDATE_CONTROL_REF`와 기존 exit/무변경 검사를 유지한다. 같은 파일의 rollback unit fixture는 Git mode `100644`인 `rollback.sh`의 임시 복사본에만 owner executable bit를 부여한다. Windows에서 드러난 별도 fixture `python3` 부재도 현재 테스트 인터프리터 경로로 제한해 보완했다. 원본 배포 스크립트 mode와 동작은 변경하지 않았다.
- `tests/tooling/test_a14_workbench_prototype.py`: R6 registry의 `live_raw_checksums`는 현재 파일이 아니라 registry 최초 도입 commit `a03aecc74b412515dab983148838c249fca62d3a`의 blob에 결박된다. 기존 accepted SHA `4bb8155`에는 R6 registry가 없고 `server.mjs`는 6,254 bytes라 R6의 11,837 bytes 기준으로 사용할 수 없다. 기존 역사 fixture clone을 R6 기준 commit에 clean detached checkout해 검증하며, 현재 browser scanner 검사는 별도로 그대로 유지한다.
- RED: `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_a14_red_ed858e9 tests/tooling/test_a14_workbench_prototype.py -k test_a14_successor_r6_registry_binds_live_scanner_and_test` → 종료 1, 현재 `server.mjs` 22,559 bytes 대 역사 11,837 bytes 불일치. readonly 한국어 오류와 POSIX mode 126은 Main의 `ed858e9` WSL suite가 RED 증거다.
- 첫 GREEN 시도: 두 파일에서 세 사례 선택 실행 → 종료 1, 2 PASS·1 FAIL. 직접 실행권한 126은 해소됐으나 Windows 테스트 환경에 `python3`가 없어 rollback fixture가 종료 4였다. 해당 fixture에만 현재 인터프리터 경로를 지정했다.
- 최종 집중 명령 `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_three_green2_ed858e9 tests/deploy/test_wsl_staging_harness.py tests/tooling/test_a14_workbench_prototype.py -k 'duplicate_real_guard_source or approved_previous_is_accepted or a14_successor_r6_registry_binds_live_scanner_and_test'` → 종료 0, 3 PASS·130 deselected.
- rollback 회귀 명령 `python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --basetemp=.pytest_tmp_f20_r2_rollback_reg_ed858e9 tests/deploy/test_wsl_staging_harness.py -k 'WslRollbackAllowlistUnitTests or duplicate_real_guard_source'` → 종료 0, 10 PASS·109 deselected. `git diff --check` 종료 0. 네 격리 `--basetemp` 경로는 정확히 정리해 잔류 0이다.
- 나머지 WSL 실패 중 PG volume 환경변수는 Main 실행 명령에서 설정한다. 현재 browser scanner가 두 client의 non-relative fetch를 지적한 별도 실패는 이 exact8 수정 범위에서 보완하지 않았으며, 현재 client 안전 검사 통과로 가장하지 않는다.
