# C-11 완료보고서

## 판정

`COMPLETED` — 독립 검증 2회 보완 후 결정론적 Main Agent 요청 분석, DAG ExecutionPlan, WorkInstruction 생성 및 승인 전 write scheduling 차단을 구현했다.

## 판단 이유

- 분석·계획 산출물은 표준 JSON SHA-256으로 동일 입력에서 동일 hash를 생성한다.
- WRITE/EXECUTE 단계는 `PlanningApprovalService`의 동일 plan hash·승인 유형·만료 검사를 통과해야만 schedule된다.
- baseline, permission, egress hash와 path scope, completion condition, risk가 plan/step에 결박된다.
- cycle, 누락 dependency, egress 불일치, stale/만료 승인, 승인 없는 write는 fail-closed다.
- WorkInstruction에 objective, risk, egress snapshot, prohibited actions를 immutable하게 결박하고 검증한다.
- 모든 planner hash 입력은 lowercase hex 64자리 정규식으로 fail-closed 검증한다.
- dependency가 완료된 READY step만 schedule하며, 분석의 실제 scope/risk/egress/prohibited action을 instruction에 전달한다.

## 변경 파일

- `packages/planning/planner.py`
- `packages/planning/__init__.py`
- `packages/orchestration/__init__.py`
- `tests/planning/test_c11_planner.py`

## 검증

- `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/planning tests/orchestration tests/repository_intelligence tests/action_policy --disable-warnings`: 종료 코드 0, 72 passed (경고 2건)
- `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages tests`: 종료 코드 0
- `git diff --check`: 종료 코드 0

## 오류 이력

- 정식 실패 4회: WorkInstruction binding/hash, dependency·analysis 전달, 필수 request-analysis hash, analysis=None stale hash 검증 결함.
- 3회째 동일 근본 원인에서 Developer를 중지하고 Main Agent가 직접 인수했다. 이후 필수 binding과 stale hash 검증을 보완하고 회귀 테스트를 추가했다.

## 미검증 범위

실제 Subagent 실행, DB/API/browser, Provider, Docker/WSL, network, secret, deployment는 C-11 범위 밖이며 실행하지 않았다.

## rollback

C-11 커밋을 revert하면 된다. 기존 C-01~C-10 계약 파일은 변경하지 않았다.

## Main Agent Takeover

- 동일 근본 원인 실패 3회에 도달하여 Developer write lease를 회수하고 Main Agent가 직접 인수했다.
- 조치: WorkInstruction의 scope·request_analysis_hash 필수화, 실제 content_hash 재계산 검증, objective/risk/egress/prohibited 필수 검증을 추가했다.
- Main Agent 검증: `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/planning tests/orchestration tests/repository_intelligence tests/action_policy --disable-warnings` → 71 passed, 1 warning; compileall 및 `git diff --check` PASS.
- 추가 잔여 결함 보완: `request_analysis_hash=None` 기본 허용을 제거하고 필수 canonical hash로 강제했다.
- 추가 보완: `analysis=None` 경로에서도 instruction과 plan의 request-analysis hash가 반드시 일치하도록 fail-closed 검증과 회귀 테스트를 추가했다.
