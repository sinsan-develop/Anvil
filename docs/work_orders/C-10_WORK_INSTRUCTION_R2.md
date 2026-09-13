# C-10 R2 보완 작업지시서

- Work Package: `C-10`
- 담당: `developer-primary`
- 기준 commit: `bc1b5c282f076aa95750d8f5505766327dfb559e`
- 기준 sequence: `845`
- 분류: `MAIN_RECONFIRMED_NON_SEMANTIC_CORRECTIVE_REWORK_R2`
- 기능 범위·요구사항·중요 위험: `UNCHANGED`

## 목적

동일 R1 snapshot의 독립 spec·quality 재검토에서 남은 두 blocking 계열만 닫는다.

1. 문자열 denylist 열거로 끝내지 않고 executable/subcommand/argv/effect를 구조화하여 파괴·force·history mutation을 fail-closed한다. ordinary grant만으로는 destructive action을 허용하지 않는다.
2. raw secret key를 delimiter와 대소문자 변형에 의존하지 않고 canonical key token으로 검출한다.

필수 hostile 예시는 `git checkout .`, `git worktree remove|prune`, `git gc|prune`, `git push +refspec|--prune|--delete|--mirror`, `git symbolic-ref -d`, `git replace`, `git fetch --prune`, `find -delete`, `Set-Content`, `Clear-Content`, `truncate`, `robocopy /MIR`, `env git ...`, PowerShell aliases와 `accessToken`, `refreshToken`, `idToken`, `clientSecret`, `clientPassword`, `X-API-Key`다.

## 고정 범위

제품 수정은 다음 기존 범위만 허용한다.

- `packages/action_policy/**`
- `packages/tool_gateway/**`
- `tests/action_policy/**`
- `tests/tool_gateway/**`
- `docs/04_test_reports/C-10_COMPLETION_REPORT.md`

C-09 read gateway를 보존한다. 실제 Secret manager, network, filesystem/subprocess mutation, DB, API, browser, WSL, Docker, 배포는 수행하지 않는다. control/progress/history를 제품 writer가 수정하지 않는다.

## 검증

- hostile RED에서 각 우회를 재현한 뒤 GREEN
- `python -B -m pytest -q -p no:cacheprovider tests/action_policy tests/tool_gateway`
- `python -B -m pytest -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py --disable-warnings -ra`
- `python -B -m compileall -q packages/action_policy packages/tool_gateway tests/action_policy tests/tool_gateway`
- `git diff --check`

stage·commit·push·PR·merge·WSL·배포는 Main의 별도 통제 전 금지한다.
