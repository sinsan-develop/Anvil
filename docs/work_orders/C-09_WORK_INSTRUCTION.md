# C-09 WorkInstruction — ExecutionBackend·경로 identity·read Tool Gateway

## 범위

`packages/execution_backends`, `packages/paths`, `packages/tool_gateway`에 표준 라이브러리 기반의 결정적 계약을 구현한다.

- Git worktree backend와 Docker backend의 read-only 실행 추상화 및 registry/audit receipt
- Windows drive, WSL `/mnt`, 대소문자·junction/symlink 별칭을 canonical path identity/conflict scope로 정규화
- Repository Intelligence와 연결 가능한 read Tool Gateway(파일 목록/메타데이터 조회만)
- dirty/untracked 보존, 경로 탈출·재parse point·미허용 backend fail-closed

실제 Docker daemon, WSL 서버, DB/API/browser/deployment 호출은 하지 않는다. 기존 C-08 및 historical progress/event/hash는 보존한다.

## 허용 경로

- `packages/execution_backends/**`
- `packages/paths/**`
- `packages/tool_gateway/**`
- `tests/execution_backends/**`
- `tests/paths/**`
- `tests/tool_gateway/**`
- `docs/04_test_reports/C-09_COMPLETION_REPORT.md`

## 완료 조건

1. 동일 대상을 Windows/WSL 표기·case·junction 별칭으로 입력해 동일 identity/conflict scope를 반환한다.
2. Git dirty/untracked 목록은 읽기만 하며 mutation 없이 보존된다.
3. Git/Docker backend registry와 read gateway가 deterministic receipt/audit를 생성한다.
4. traversal, symlink/junction, unsupported backend와 unsafe command가 fail-closed 된다.
5. 신규·관련 테스트, compileall, `git diff --check` 통과 및 미실행 운영 경계를 보고서에 기록한다.
