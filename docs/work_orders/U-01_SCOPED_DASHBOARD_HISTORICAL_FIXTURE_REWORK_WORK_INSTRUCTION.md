# WI-U01-SCOPED-DASHBOARD-HISTORICAL-FIXTURE-REWORK-20261009-001

## 판정과 기준선

신산님이 승인한 U-01 scoped Dashboard 권고 B의 비제품 통제 epoch99는 기존 단일 branch `codex/u01-dashboard-r2`의 H `4d6cba41b5f1d9269572ba454c7165063f38d9a7`에서 seq2284 CLOSED, local/private 동일·clean, G-05 PASS다. write→worker lease는 REVOKED이고 제품 write scope는 `[]`다. 통제 집중9 PASS와 독립 리뷰 Critical0/Important0에도 인접7 전체는 `235 PASS / 1 FAIL / exit1`이므로 U-01 수직 기능은 `NOT_ACCEPTED`다. 실패는 `tests/tooling/test_u01_postmerge_control_projection.py::U01HistoricalGitFixtureEpoch98Tests::test_epoch98_active_a_requires_exact_published_event_lease_and_git`가 epoch98 A `46ef1305f21b21f90e2de69b1e76085b6327ccdb`의 저장 bundle에 현재 epoch99 live Git collector를 적용한 시점 혼용이다. 이전 checker의 fail-closed 동작이나 실제 현재 Git 상태를 완화하지 않는다.

부모 계약은 승인 제안 `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md` SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`, 인간 승인 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`이다. 이 작업은 기능 범위·요구사항·중요 위험을 변경하지 않는 비의미 fixture/검사기 후속이다. 공개 API·DB·인증·운영 배포·비용 계약을 새로 정하지 않는다.

## 소유·정확 범위

- Main: 이 WI와 invocation, append-only Event/progress/HANDOFF/detached digest/WORK_STATUS, checkpoint·private push, 독립 검토와 최종 판정을 소유한다. seq1~2284 Event 원문과 epoch99 C/B/H blob을 보존한다.
- Developer `developer-primary-u01-scoped-dashboard-historical-fixture`는 새 epoch100 worker/write fencing token이 모두 유효하고 A docs-only local/private 동일·clean을 확인한 뒤 정확 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 두 파일만 수정한다. 제품 write scope는 `[]`다. 다른 파일·문서·DB·Web·WSL-server·Git commit/push를 변경하지 않는다.
- 단일 code writer다. Main은 Developer lease 활성 중 위 두 파일을 수정하지 않는다. 새 branch를 만들지 않는다.

## RED→GREEN·검증

1. 역사 A98 양성 테스트는 저장 bundle과 동일 시점의 Git 관찰만 사용한다. 좁은 fake Git 응답 또는 역사 commit의 불변 증거로 collector의 양성을 재현하되 현재 live Git을 과거로 위장하지 않는다. 실제 현재 HEAD/upstream/dirty가 A98과 다르면 live collector는 계속 거부해야 한다. 위조 Event·lease·hash·blob·branch·remote 음성 검증을 삭제하거나 느슨하게 만들지 않는다.
2. epoch100 G-05는 H `4d6cba41`의 seq2284 CLOSED를 먼저 검증하고 A→C→B→H의 정확 successor, 새 WI/lease/Event 원문·chain/snapshot/digest, 현재 branch/upstream/remote/dirty를 fail-closed로 결박한다. 제품 scope0, U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`를 유지한다. A active→C code→B docs→H write/worker revoke는 각각 실제 체크포인트와 정확 경로로 검증한다.
3. 실패 1건의 RED→GREEN, 새 통제 집중과 인접7 전체 GREEN, G-05, `git diff --check`, Ruff 변경 줄 신규 진단0을 실행한다. 실패·SKIPPED·미실행은 그대로 보고한다. Main은 코드 diff/독립 리뷰, 실제 G-05, local/private SHA·clean, 필요 범위의 독립 회귀를 확인한다. 정식 Developer 실패 횟수와 Main 오류 횟수를 WORK_STATUS에 분리 기록한다.

## 완료·복구

이 WI 완료는 역사 fixture와 통제 정합에 한정되고 U-01 제품 수락이 아니다. 인접 실패가 남으면 `NON-GREEN`으로 보존하고 제품 lease/PR/main 병합으로 승격하지 않는다. 실패·중단 시 같은 branch의 안전한 WIP commit/private ref 및 WORK_STATUS를 남기고 dirty 자료를 삭제·reset하지 않는다. force push/history rewrite·새 branch·ysna-server/Production 작업은 금지한다.
