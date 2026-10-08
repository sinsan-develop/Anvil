# WI-F19A-TASK4-EPOCH89-POST-CLOSE-LIVE-FIXTURE-20261008-001

## 판정·권한

F-19A Task4 epoch89 종료 `5605c86e42b2eb0fdc12234a846adebef56114c3`는 local/private 동일·clean, G-05 seq2233 PASS다. 그러나 종료 상태에서 `tests/tooling/test_f19a_start_projection.py` 전체는 120 PASS/1 FAIL(944.56초)이다. 실패 테스트 `test_task4_epoch72_clock_live_active_route_requires_real_lease`가 현재 진행 문서의 seq2231 활성 상태를 단정하지만, 현재 정본은 회수된 seq2233이다. 집중도 7 PASS/1 FAIL이다. 이는 제품 동작이 아닌 테스트 fixture의 역사/현재 상태 혼동이며 승인된 요구사항·기능 범위·중요 위험 변경이 없는 내부 검증 보완이다. 부모 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`를 유지한다.

## 정확 scope·소유

Main은 이 WorkInstruction·Event/progress/HANDOFF/digest/WORK_STATUS·Git을 소유한다. Developer `developer-primary-f19a-pair-grant`의 정확 코드 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py` 두 개이고 제품 write scope는 공집합이다. 새로운 epoch90 worker/write dual lease와 private clean A 및 fencing token 확인 전 코드 write를 하지 않는다. 다른 코드·제품·WSL/DB/브라우저·Git commit/push·새 branch는 금지한다.

## 수정·검증 계약

1. 실패 테스트는 불변 epoch89 활성 B `1119ab82ecd5519a54c337a81b45e900a444ee16`의 실제 원본 bundle을 역사 시각에 검증하여 활성 임대 만료 음성을 유지한다. 현재 정본 seq2233의 닫힌 상태는 별도로 검증한다. 테스트 이름과 assertions가 실제 검증 대상을 정확히 설명하도록 한다. 만료 검사 자체와 제품 계약은 완화하지 않는다.
2. 해당 실패 1건을 RED→GREEN으로 확인하고, epoch89 active/C/B/closed·과거 위조/만료·F-19A 역사 테스트 전체를 실행한다. 신규 epoch90 A→C→B→종료 route는 seq1~2233 원문, 분리 24시간 임대, 정확2·제품0, Git 조상·private/clean·비merge·변경 경로·위조 거절을 검사한다. 새 route 전 bootstrap G-05 RED는 PASS가 아니다.
3. 코드 변경행 Ruff 신규0, `git diff --check`, 종료 G-05와 인접 F-20 successor를 확인한다. Main의 독립 C0/I0/M0와 정확 C/private→B/private→write/worker 회수→종료 G-05·전체 역사 GREEN 전 WSL-server QA 자원 생성 금지. 기존 R48 authority 2 FAIL은 별도 기록한다.

## 후속·제외

완료 뒤 동일 branch의 exact clean SHA를 WSL-server에서 Git pull하여 전용 PG15/OIDC/HTTPS/Chromium·Worker0020·reader/제3 actor/admin·GET/alerts/ACK·철회·DB 장애·backup/restore/downgrade guard를 실측한다. 자원 이름·수명·정리 방법을 생성 전 WORK_STATUS에 기록하고 잔여0을 확인한다. 독립 Tester `AV-OPS-026`·`AV-SAFE-034` 전 F-19A ACCEPTED, U-01 제품 write, main 병합 금지. `ysna-server`/Production·공유 자원·실 사용자·Secret 변경 금지.
