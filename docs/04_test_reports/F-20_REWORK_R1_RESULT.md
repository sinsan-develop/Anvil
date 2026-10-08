# F-20 R1 Git object fanout 오류 형식 재작업 결과

## 판정

`COMPLETED` — 이번 exact-path lease의 국소 수정과 로컬 회귀는 완료했다. F-20 전체 수락은 미충족이다. WSL 동일 SHA 전체 suite와 11개 메뉴 실제 기능 검증은 Main Agent 후속 작업으로 남는다.

## 판단 이유

- 기준 작업본: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops`, 시작 HEAD `3485f8b282129e5a648d8784b12edec9fe6a2461`; 시작 `git status --porcelain=v1` 출력 없음. 정본 projection seq1719의 `developer-primary-f20-r1` worker/write lease는 모두 `ACTIVE`였고 두 token은 상이하며 제품 경로가 정확히 세 개로 제한됐다.
- 원인: POSIX `_object_write_guard`가 `verified_scope_guard`의 symlink/reparse 거부 `BackendRejected`를 그대로 공개했다. Windows 분기는 같은 거부를 `LeaseError('WORKSPACE_GIT_STORE_DRIFT')`로 변환했다.
- 신규 `test_posix_object_fanout_rejection_uses_public_lease_error`는 변환 전 `BackendRejected: REPARSE_PATH_DENIED`로 RED(1 failed, pytest exit 1), 변환 후 GREEN(1 passed, pytest exit 0)이다. 테스트는 POSIX 분기의 예외 경계를 로컬에서 자극하며, 실제 POSIX symlink 통합 동작의 최종 증거는 WSL 재실행에 맡긴다.
- `tests/agent_team/test_worktree_writes_e06.py` 전체 로컬 실행: `57 passed in 905.21s`, pytest exit 0. 기존 `test_managed_object_fanout_redirect_is_rejected_before_foreign_write`는 source Git 파일 해시와 작업 HEAD가 변경되지 않았음을 검사한다. 이번 Windows 실행의 junction 경로에 대한 증거이며 POSIX 실측으로 승격하지 않는다.

## 조치와 검증

- 변경 파일: `packages/agent_team/worktree_writes.py`의 POSIX 가드에서 `BackendRejected`만 `LeaseError('WORKSPACE_GIT_STORE_DRIFT')`로 변환; `tests/agent_team/test_worktree_writes_e06.py`에 오류 형식 회귀 추가; 이 결과 문서 생성. 그 외 제품 파일 수정 없음.
- RED 명령: `.\.venv\Scripts\python.exe -B -m pytest tests/agent_team/test_worktree_writes_e06.py::test_posix_object_fanout_rejection_uses_public_lease_error -q --basetemp=<OS TEMP red path> -o cache_dir=<same path>\cache` → 1 failed, exit 1. 첫 도구 호출은 출력이 중간에 끝나 최종 코드를 받지 못했고, 같은 RED를 다시 실행해 위 결과를 확인했다.
- GREEN 명령: 위 명령의 고유 `<OS TEMP green path>` 변형 → 1 passed in 13.27s, exit 0.
- 관련 회귀 명령: `.\.venv\Scripts\python.exe -B -m pytest tests/agent_team/test_worktree_writes_e06.py -q --basetemp=<OS TEMP regression path> -o cache_dir=<same path>\cache` → 57 passed in 905.21s, exit 0.
- 정적 검사: `.\.venv\Scripts\python.exe -B -c "from pathlib import Path; [compile(Path(p).read_bytes(), p, 'exec') for p in ('packages/agent_team/worktree_writes.py','tests/agent_team/test_worktree_writes_e06.py')]; print('COMPILE_OK')"` → `COMPILE_OK`, exit 0. `git diff --check` → 출력 없음, exit 0.
- OS TEMP의 세 pytest basetemp 아래 reparse link 각각 1·1·36개를 확인했고 대상이 각 해당 basetemp 내부임을 확인한 다음 link와 정확한 세 폴더를 삭제했다. 세 폴더 모두 잔류 0. 기존 worktree `.pytest_cache`는 건드리지 않았다.
- 정식 실패 횟수 0. 의도한 TDD RED 1회는 정식 실패로 계산하지 않는다.

## 미검증과 다음 조치

- WSL-server 동일 commit/SHA pull 후 POSIX 원래 실패 테스트·전체 suite, F-20의 11개 메뉴 기능 smoke, 중단/재개·복구, monitoring, ProductValidation, Defect, backup/restore, rollback, blocking defect 0, critical alert 0은 미실행이다. 과거 `1080 passed, 1 failed`는 미해결 기준선이다. Production/`ysna-server`는 범위 밖이며 접근하지 않았다.
- Main Agent가 이 exact3 diff를 검토하고 commit/push한 뒤 같은 SHA에서 WSL 재검증한다. F-20 수락·P-01 착수·main 병합은 해당 완료조건 전까지 진행하지 않는다.
- Rollback: Main Agent가 commit 전 두 코드 파일의 이 diff만 역적용하고 이 결과 문서를 제거한다. 다른 dirty·untracked 자료와 과거 Event/manifest는 보존한다.
