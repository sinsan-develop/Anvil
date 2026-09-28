# F-20/U-01 R3b 현재 projection 계약 테스트 결과

## 판정

`COMPLETED` — 지정 exact2의 로컬 테스트 보정과 기본 검증을 마쳤다. Main은 제품 commit `98b8d0b31d884cf1517ce039d73d7f6b7a7bae2a`의 WSL-server 동일 SHA focused·G-05·정식 전체 suite PASS를 전달했다. 이는 F-20/U-01 수락이나 실제 UI·브라우저·운영 실측이 아니다. C30 사고는 `OPEN_BLOCKING`, release 결정은 `DEFER`이며 manifest `accepted=false`를 유지한다.

## 기준선과 권한

- 담당: `developer-primary-f20-u01-r3b`, branch `codex/f18-wsl-ops`, 시작 HEAD `2e35284209922814e35a2485e08ad63974672ec3`, upstream `development/codex/f18-wsl-ops`. 시작 `git status --short --branch`는 Main 소유 `docs/WORK_STATUS.md`만 dirty였다. 이 파일은 수정하지 않았다. 원격 직접 조회는 로컬 SSH alias 이름 해석 실패로 미확인했고, 시작 HEAD와 로컬 remote-tracking ref의 일치는 G-05가 검사했다.
- epoch15 worker/write lease 상태 `ACTIVE`, 만료 `2026-09-29T05:56:31+00:00`; execution token `f20-u01-r3b-execution-fence-epoch-15-20260928r3b01`, write token `f20-u01-r3b-write-fence-epoch-15-20260928r3b01`. 쓰기 허용 경로는 이 보고서와 `tests/tooling/test_project_progress.py`다.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- WorkInstruction SHA-256 `B076EE6727FD27F49119E789AD52430947A7B164207C16CE8E0C997CFF74FD01`, Invocation `4E668C430E1B9800EA8300839268E3E9D86D421753485F02A31D8C9F91946BFB`. canonical Event 마지막 seq1804의 `step_id`와 현 progress `projection_mode`는 `F20_U01_R3B_CURRENT_PROJECTION_START`로 일치한다.

## 변경 전후와 근거

- 이전 테스트는 현재 bundle의 mode와 위조 거부 오류 네 곳에 역사적 `F20_U01_R2B_*`를 고정 기대해 현재 R3b 원장에서도 line1189에서 실패했다.
- 현재 테스트는 마지막 canonical Event `step_id`와 progress mode·manifest mode 및 Event sequence의 일치를 확인한다. Main 독립 검토에서 `_CURRENT_` 분리가 다음 정상 epoch의 다른 작업명에서 반복 실패할 수 있다는 Important 1건을 지적했다. 보정 후 route 오류 접두부는 검증된 `F20_U01_R<epoch>` 세 토큰에서 도출하며 작업명은 고정하지 않는다. `F20_U01_R4_OPERATIONS_ALERTS_START`는 허용하고 잘못된 package/epoch/빈 작업명은 거부하는 음성 테스트를 추가했다. 진행상태·digest·manifest 위조는 각각 현 route의 `PROGRESS_INVALID`·`DIGEST_INVALID`·`MANIFEST_INVALID`로 거부되는지 검사한다. handoff 위조의 공통 `HANDOFF_NEXT_ACTION_MISMATCH` 검사도 유지했다.
- 역사 Git blob/hash 테스트, C30 `OPEN_BLOCKING`, `DEFER`, `accepted=false` assertion은 변경하지 않았다. 검증기·canonical Event/progress/digest/manifest·다른 테스트를 수정하지 않았다.

## 실제 검증

- 시작 G-05: `& 'C:\Users\cyhuh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/check_project_progress.py` → exit 0, `PASS sequence=1804 reporting=AUTO_CONTINUE`.
- RED: `PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .\.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_detached_digest_binds_current_progress_and_handoff_into_manifest_target -q -p no:cacheprovider --basetemp=runtime/pytest-r3b-developer-red` → exit 1, 1 failed, line1189의 R2b/R3b mode 불일치. PowerShell에서는 두 환경변수를 `$env:`로 설정해 실행했다.
- GREEN: 위와 같은 node를 `--basetemp=runtime/pytest-r3b-developer-green`으로 재실행 → exit 0, `1 passed in 12.99s`.
- 인접 역사·R3b 통제: `PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .\.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_f20_r5e_and_u01_history_remains_bound_to_git_blobs tests/tooling/test_f20_u01_r3b_projection.py -q -p no:cacheprovider --basetemp=runtime/pytest-r3b-developer-regression` → exit 0, `4 passed in 47.82s`. 역사 Git blob/hash와 R3b 전이·변조·공개 validator 경로를 포함한다.
- 수정 후 G-05: 같은 checker 명령 → exit 0, `PASS sequence=1804 reporting=AUTO_CONTINUE`.
- Main 검토 후 RED: `test_current_u01_route_prefix_rejects_invalid_step_format`를 `--basetemp=runtime/pytest-r3b-developer-green`에서 실행 → `_CURRENT_` 의존 helper가 정상 다음 epoch 예시를 거부해 exit 1, 1 failed. 검사를 처음 추가했을 때 helper 미정의로 인한 초기 RED exit 1도 있었으며, 유효한 행동 RED는 이 두 번째 실행이다.
- Main 검토 후 GREEN: 위 음성 node와 `test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`를 같은 지정 green base에서 실행 → exit 0, `2 passed in 24.24s`.
- Main 검토 후 인접 역사·R3b 통제: 위와 같은 두 대상/명령을 지정 regression base에서 재실행 → exit 0, `4 passed in 36.96s`.
- Main 검토 후 G-05 → exit 0, `PASS sequence=1804 reporting=AUTO_CONTINUE`; `git diff --check` → exit 0. 최종 수정 테스트 파일 SHA-256 `FEF5BA010767F511624D75D75A836DA684C9EF8CAE1E5B0AC7C5771281B16325`.
- 도구 확인 중 `python`은 명령 없음(exit 1), `py -3.12`는 설치 Python 없음(exit 1), bundled Python의 `-m pytest`는 module 없음(exit 1)이어서 worktree `.venv` Python으로 검증했다. 이들은 제품 테스트 실패로 집계하지 않는다.
- 테스트 base는 지정된 `runtime/pytest-r3b-developer-{red,green,regression}`만 사용했다. red/green은 생성되지 않았고 regression의 실경로가 현재 worktree 내부, directory 자체 reparse 아님, 내부 reparse 3개가 모두 이 base 내부 대상임을 확인했다. 해당 base만 삭제해 세 경로 잔류 0을 확인했다. pytest 세션은 종료됐다. 별도 관측된 Anaconda Python PID 2개는 이 실행의 `.venv` 프로세스가 아니며 CIM 명령행 조회는 ACL로 거부되어 소유 업무는 확인하지 못했다.
- Main 검토 후 재실행에서도 green base는 생성되지 않았고 regression base의 내부 reparse 3개를 다시 확인해 정확한 경로만 삭제했다. 세 지정 base 잔류 0, 실행 pytest 프로세스 0을 확인했다.
- Main 후속 WSL-server 실측 인계: 제품 SHA `98b8d0b31d884cf1517ce039d73d7f6b7a7bae2a`에서 focused `6 passed in 13.11s`(exit 0), G-05 `PASS sequence=1804`(exit 0), 정식 전체 suite `8239 passed, 117 skipped, 14 warnings in 2032.40s`(exit 0). 전체 로그는 11,489 bytes, SHA-256 `77bbf574e4ae85c3a4d64bc2bb103221d8c3b1233490ac73ec58726c762e1514`였다. Main은 Git clean, bash/pytest PID 종료를 확인했다. 전용 focused/full pytest bases와 full log/exit는 경로·내부 symlink 277개/외부 0개·로그 hash/exit 확인 후 정확한 대상만 삭제해 잔류 0으로 보고했다. 이 항목은 Main의 실제 WSL 검증 결과를 인계받아 기록한 것이며 Developer가 WSL에서 재실행하지 않았다.

## 미검증·인계

- Main의 WSL 동일 SHA 전체 suite PASS에도 `117 skipped`와 `14 warnings`가 남는다. 실제 DB/API/UI/브라우저/운영·Production 수락 증거로 승격하지 않는다. C30 `OPEN_BLOCKING` 복구, U-01/F-20 acceptance 및 계획상 11개 메뉴 실제 검증은 별도 판정이 필요하다. 이전 `fdaa66f` WSL 전체 `1 failed, 8234 passed, 117 skipped, 14 warnings`는 이번 제품 SHA의 결과가 아니다.
- Main이 제품 exact2를 포함한 `98b8d0b3` commit과 후속 PID 기록 `721ef201cc56df35fa3586564133621b1535798b`를 현재 branch에 반영했다. 이 Subagent는 이번 결과보고서 후속 보완 외에 테스트 코드를 수정하지 않았고 commit/push/merge·배포를 수행하지 않았다. Main 소유 `docs/WORK_STATUS.md`는 건드리지 않았다.
- rollback은 Main이 제품 exact2 변경만 정상 후속 Git commit으로 되돌리는 것이다. `98b8d0b3`에는 Main 소유 WORK_STATUS 기록도 포함되므로 전체 commit을 무검토로 되돌리지 않는다.
