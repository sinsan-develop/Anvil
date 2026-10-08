# WI-U01-SCOPED-DASHBOARD-CONTROL-20261009-001

## 판정과 기준선

신산님은 `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`의 권고 B를 직접 승인했다. 승인 원문·범위는 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 구현 계획은 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`다. 제안 SHA-256은 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`다.

직전 epoch98은 Event seq2279 CLOSED, branch `codex/u01-dashboard-r2`, local/upstream HEAD `72836ca629ac76d0c6276f9055f7e77aa5a1668a`, 기존 dual lease REVOKED, G-05와 인접232 PASS다. U-01 수직 기능은 아직 `NOT_ACCEPTED`다. 신규 승인으로 공개 계약 대기만 해소되며 제품 검증·병합은 자동으로 완료되지 않는다.

## 소유·정확 범위

- Main 소유: 승인·계획·이 WI·invocation, append-only Event/progress/HANDOFF/detached digest/WORK_STATUS, checkpoint·push, 독립 리뷰와 판정. seq1~2279의 Event 원문 및 epoch98 폐쇄 증거를 보존한다.
- Developer `developer-primary-u01-scoped-dashboard-control`은 새 epoch99 worker/write fencing token이 모두 유효하고 A docs-only checkpoint의 local/private 동일·clean이 확인된 뒤에만 정확 `scripts/check_project_progress.py`, `tests/tooling/test_u01_scoped_dashboard_control_projection.py` 두 경로를 수정한다. 제품 write scope는 `[]`다. Git commit/push·문서·DB·Web·WSL-server 수정은 하지 않는다.
- 새 G-05 경로는 epoch98 폐쇄 검사를 먼저 통과해야 하며, 새 승인/계획/WI/lease/Event/snapshot/digest/Git의 정확 successor만 허용한다. 기존 fail-closed 판정이나 역사 fixture를 완화하지 않는다. 제품 경로는 active control gate의 독립 검토·게시 후 clean/G-05/인접 회귀 전까지 잠긴다.

## RED→GREEN·완료

Developer는 epoch98 원문 보존 양성 및 승인 해시·정확 경로·상호 다른 token·만료·Event chain·snapshot/digest·Git branch/upstream/HEAD/remote/dirty 변조 음성을 먼저 RED로 추가하고 최소 checker 경로로 GREEN을 만든다. 관련 통제 테스트·인접 회귀·`git diff --check`·Ruff 변경 줄 신규 진단0을 실행하고 정확 명령/exit/결과, diff, 미검증, rollback을 보고한다. Main은 독립 C/I/M 리뷰, 실제 G-05, local/private SHA·clean과 통제 checkpoint를 검증한다. G-05 부재나 인접 실패는 PASS가 아니며 U-01 제품 lease를 열지 않는다.

범위 변경·기존 GET/ACK 의미 변경·새 DB schema·Secret·ysna/Production 작업은 이 WI에 없다. 같은 브랜치의 안전한 checkpoint와 상태 기록으로 복구 가능성을 유지하며 새 브랜치를 만들지 않는다.
