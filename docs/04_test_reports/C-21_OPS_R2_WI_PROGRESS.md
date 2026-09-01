# C-21-OPS-R2 WorkInstruction 작성 진행현황

## 현재 판정

`COMPLETED / DRAFT_READY_FOR_MAIN_REVIEW`

## 기준선

- 작업 패키지: `C-21-OPS-R2`
- 작성 agent: `c21_r2_workinstruction`
- 시작 기준: `origin/main` `2a5793a` (`docs(progress): record c21 reconciliation`)
- 전용 브랜치: `codex/c21-ops-r2-wi`
- 시작 status: root worktree의 기존 dirty/untracked(`AGENTS.md`, `packages/agent_team/`, `tests/agent_team/`)를 보존하고 별도 worktree에서 작성
- 기존 C-21 WI/prompt: successor 운영 검증의 read-only 범위만 정의하여 이번 최소 외부 검증·승인 경계를 포함하지 않음

## 변경 파일

1. `docs/work_orders/WI-C-21-OPS-R2.md`
2. `docs/work_orders/WI-C-21-OPS-R2_INVOCATION_PROMPT.md`
3. `docs/04_test_reports/C-21_OPS_R2_WI_PROGRESS.md`

## 포함한 범위

- 9개 Provider의 credential 비노출 non-billing capability/health probe
- Telegram signed POST 정확히 1회
- 인증 SSE 및 `Last-Event-ID` 재개
- DB side effect의 기본 정리와 승인된 보존 선택
- 동일 target의 EvidenceManifest 기록
- 배포/schema/Provider 모델·routing/webhook 설정 변경 금지
- 외부 호출·DB side effect·정리/보존을 별도 사람 승인 지점으로 명시

## 오류·조치

1. 최초 전용 브랜치 생성은 sandbox ref lock 권한 오류로 실패했다: `.git/refs/heads/codex/c21-ops-r2-wi.lock`, `Permission denied`.
2. 같은 원인 명령을 반복하지 않고 권한 상승 실행으로 전용 worktree 생성에 성공했다.
3. 코드·운영 상태·DB·Provider·Telegram은 변경하지 않았다.

## 검증

- 문서 파일 존재 및 읽기 확인: PASS
- `git diff --check`: 작성 후 실행 예정
- Provider/Telegram/SSE/DB 실제 실행: `NOT_EXECUTED` (이 문서 작성 범위가 아니며 별도 승인 필요)

## 다음 조치

Main Agent가 문서 diff와 hash를 검토하고, WI subject hash를 승인 binding에 고정한다. 이후 §6의 승인 여부에 따라 준비 점검만 진행하거나 최소 운영 검증을 시작한다.
