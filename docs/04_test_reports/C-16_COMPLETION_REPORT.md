# C-16 완료 보고서 — Agent Team durable collaboration primitives

## 판정

`COMPLETED` — C-16 WorkInstruction 범위의 Agent Team 협업 primitive와 deterministic replay 경계를 구현했다.

## 구현 내용

- `packages/agent_team/collaboration.py`
  - immutable `ThreadIdentity`/`ThreadKind`로 USER↔AGENT와 AGENT↔AGENT thread를 분리
  - `DependencyGraph`의 canonical 정규화와 전이적 cycle 거부
  - `TeamEvent`의 UTC 시간·identity·sequence·parent/event hash 검증
  - `AppendOnlyTeamLog`의 session/actor 검증, stale parent·duplicate event·sequence gap 거부
  - `TeamProgressProjection`의 append-only event replay와 duplicate/foreign history 거부
  - 표준 JSON 기반 `canonical_hash`, schema identity guard
- `packages/agent_team/__init__.py`: public exports 추가
- `tests/agent_team/test_collaboration.py`: identity, cycle, hash, append-only, replay 회귀 테스트 추가

## 검증 증거

- 시작 기준선: `cc1d1ec`, branch `codex/c16-agent-team-primitives`
- 실행 명령: `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/agent_team -q`
- 결과: **43 passed**, exit code 0
- 실행 명령: `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages tests`
- 결과: exit code 0
- 실행 명령: `git diff --check`
- 결과: PASS, exit code 0
- 실제 외부 peer orchestration/provider, DB/API, browser/Telegram, Docker/WSL/deployment 및 분산 persistence는 본 WorkInstruction 범위 밖으로 미검증

## 변경 범위 및 복구

허용 경로인 `packages/agent_team/**`, `tests/agent_team/**`, 본 보고서만 변경했다. 복구는 이 작업 브랜치 커밋을 revert하면 된다.

## 독립 검증 보완 이력

독립 검증 FAILURE_REPORT 1회에 따라 다음을 보완했다.

- `TeamProgressProjection.replay`에서 session membership 외 actor를 거부
- `TeamEvent.parent_hash`를 lowercase `sha256:<64 hex>` 또는 명시적 `root` sentinel로 제한
- TeamEvent payload를 재귀적으로 immutable mapping/tuple/frozenset으로 동결하여 외부 mutation과 hash 불일치를 차단
- 기존 TeamSession·TeamTask·TeamMailbox·DecisionRequest·RevisionRequest에 UTC `created_at`과 `parent_hash` 필드를 추가했다. 기존 positional 생성자 호환성을 위해서만 명시적 `1970-01-01T00:00:00Z`/`root` legacy sentinel을 사용한다.

보완 후 재검증: `tests/agent_team` **46 passed**, compileall exit 0, `git diff --check` PASS. 운영 Provider/DB/API/browser/Telegram/Docker/WSL/deployment 경계는 계속 미검증이다.
