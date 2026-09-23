# C-30 merged-main canonical checker reconciliation

- 판정: `IN_PROGRESS`; routine Broker merge policy가 적용된 main 기준선은 `66eef70f87cac1d0b87df5b7e7c37715b3bf2632`다.
- root cause: 기존 checker는 작업 branch만 허용했고 squash main은 exact feature ancestry를 보존하지 않았다.
- Stage A: routine PR을 merge commit 방식으로 교정했고 bootstrap PR #16은 기존 squash 정책을 유지했다.
- Stage B: work branch pre/post commit과 merged main의 구조를 분리 검증한다. merged main은 parent 2개, first-parent base, second-parent exact feature head, base→feature exact path, feature/main tree equality를 요구한다. SHA는 checker에 하드코딩하지 않는다.
- TDD: merged-main 계약 RED `4 failed, 6 passed`; GREEN `10 passed`. canonical checker seq1359와 worktree diff-check PASS. 제품 코드 변경은 0이다.
- 미검증 유지: Provider, production auth, PG18, actual server-generated 400, Oracle.
- rollback: 본 exact9 reconciliation commit만 revert하며 seq1~1358과 Stage A Broker 정책 commit은 보존한다.
