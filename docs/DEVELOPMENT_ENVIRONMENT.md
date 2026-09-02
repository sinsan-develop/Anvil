# 개발 환경 및 임시 작업 경로

## 임시 경로 정책

- `D:\Project` 아래에는 새 worktree, clone, 임시 checkout, QA, 로그, 빌드 폴더를 생성하지 않는다.
- 새 임시 리소스가 필요하면 작업 전에 `D:\tmp\<task-id>`의 절대 경로, 목적, 소유자, 사용 기간, 정리 방법을 `CODEX_WORK_LOG.md`에 기록하고 승인된 범위에서 생성한다.
- `D:\tmp`를 사용할 수 없으면 우회하지 않고 작업을 중지해 보고한다.
- 사용 후 생성한 파일·폴더·프로세스·포트·컨테이너·볼륨·네트워크를 정리하고 동일 조회로 잔여 0건을 확인한다.

## 이번 작업 기록 (2026-09-02)

- 새 `D:\tmp` 리소스: 생성하지 않음.
- 사용한 기존 작업공간: `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\ysna-internal-deploy` (canonical main), `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\implement-session-auth-sse` (subagent 결과 검토용 기존 worktree).
- 소유자: Main Agent 어울 / 구현: `implement_session_auth_sse` subagent.
- 사용 기간: 현재 C-21 인증/SSE 검토 및 통합 동안.
- 정리: 기존 사용자 worktree는 삭제·이동하지 않음. 이번 작업에서 생성한 임시 리소스와 외부 프로세스·포트·컨테이너·볼륨·네트워크는 없음(잔여 정리 대상 0건).
