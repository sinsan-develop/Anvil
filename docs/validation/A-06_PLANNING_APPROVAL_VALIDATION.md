# A-06 Planning·Approval Validation

## 판정

`STATIC_CONTRACT_PASS / COMPLETED_PENDING_INDEPENDENT_TEST`

## 실행 증거

- TDD RED: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a06_planning_approvals`, exit 1. `scripts/check_a06_planning_approvals.py` 부재를 정확히 검출했다.
- manifest 이전 checker: `...python.exe scripts\check_a06_planning_approvals.py --without-manifest --json`, exit 0, PASS/errors `[]`.
- A-01~A-05 + G-07 + Phase-G 회귀: 86/86 PASS.
- A-01~A-05 checker: 각 PASS. G-07 checker: packages 97, AV 255, uncovered 0. Phase-G checker: accepted 7, decisions 10, sync 7.
- focused GREEN: A-06 12/12 PASS, checker PASS/errors `[]`.
- hostile mutation: 40개 stable reason 모두 검증 PASS.
- A-01~A-06 + G-07 + Phase-G 최종 누적 회귀: 98/98 PASS.
- project-progress: active Developer exact product diff를 `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed 검출. Main completion projection 전 예상 경계다.

## 정적·runtime 경계

`AV-SAFE-005`, `AV-FLOW-003`의 E-ART 정적 계약만 증명한다. `RUNTIME_DEFERRED / NOT_EXECUTED`; `E-API NOT_EXECUTED`, `E-AUD NOT_EXECUTED`, Browser/Event/Apply/Deploy/Destructive 모두 NOT_EXECUTED다. `reason=runtime owner 미도달`, `next_action=독립 Tester 후 Main acceptance projection`이다.
