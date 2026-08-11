# A-04 Workbench Validation

## 판정

`STATIC_CONTRACT_PASS / COMPLETED_PENDING_INDEPENDENT_TEST`

canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 정적 SVG는 `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`로만 분류한다.

## 판단 이유

- A-01 rail의 14 steps, 21 edges, 5 paths와 STEP-03/06/10/12/14 human point를 변경 없이 소비한다.
- A-02의 1920×1080, 12/10/9/14/16px, 360px on-demand drawer, i-tooltip/popover와 접근성 계약을 유지한다.
- A-03의 project/branch/baseline/environment, dirty/untracked 분리, policy/protected path, UNKNOWN/CONFLICT fail-closed를 유지한다.
- 요구사항 확정, high-risk `CONTROLLED + STOP`, approval/lease, safe resume/no-duplicate, permission separation을 stable reason code로 검증한다.
- hostile mutation catalog는 predecessor, field/state/edge, mode, permission, preservation, qualifier drift를 fail-closed로 압박한다.

## TDD 증거

1. RED: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a04_workbench`
   - exit `1`
   - 기대 원인: `scripts/check_a04_workbench.py` 부재
2. 부분 GREEN: `C:\Users\cyhuh\anaconda3\python.exe scripts\check_a04_workbench.py --without-manifest --json`
   - exit `0`, errors `[]`
3. 최종 GREEN 및 회귀 명령은 CompletionReport에 기록한다.

## 미실행 범위

Browser, API, DB, Network, Docker, WSL, deploy는 모두 `NOT_EXECUTED`다. 정적 검사 결과를 해당 runtime PASS로 승격하지 않는다.
