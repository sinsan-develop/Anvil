# WI-F19A-TASK4-EPOCH72-HISTORICAL-CLOCK-FIXTURE-20261008-001

## 판정·권한

F-19A Task4 epoch88 종료 `350846be`의 실제 G-05 seq2228 PASS·local/private clean 후 역사 통제 전체가 `110 PASS/3 FAIL`이다. 실패 세 건은 모두 epoch72 활성 fixture를 현재 시각에 재검증하여 `F19A_REWORK_LEASE_INVALID`를 받는 동일 원인이다. epoch72 보존 활성 checkpoint `eccbc2a78064a8538c135c10b328e2dddcd548f4`의 lease는 `2026-10-07T21:07:37+00:00` 만료됐고, 테스트 helper의 활성 분기만 `datetime.now(timezone.utc)`를 사용한다. 이 문서는 승인된 F-19A 검증의 비의미 테스트 시계 보정이며 제품 요구·공개 API·DB schema·인증·권한·운영 범위를 바꾸지 않는다. 부모 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md` SHA256 `ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5`, Spec SHA256 `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, Plan SHA256 `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`를 보존한다.

## 정확 scope·소유

Developer `developer-primary-f19a-pair-grant`의 정확 두 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py`다. 제품 write scope는 공집합이다. Main만 WI·Event/progress/HANDOFF/digest/WORK_STATUS·Git을 쓴다. Developer는 Main의 새 epoch89 canonical dual lease·private clean A 및 fencing token 확인 전 코드 write를 하지 않으며, 두 경로 밖 write·Git commit/push·WSL/DB/브라우저/Compose write를 하지 않는다. 새 branch를 만들지 않는다.

## 수정·검증 계약

1. epoch72 역사 활성 fixture의 검증 시각은 그 fixture의 원본 issued/expiry 안에 있는 결정적 시각으로 고정한다. route 호출까지 같은 시각을 적용하고 호출 후 전역 시계 patch가 남지 않게 한다. 닫힌 fixture는 원본 종료 Event 시각의 불변 검증을 유지한다. 현재 live projection의 실제 만료 검사는 완화하지 않는다.
2. 위 세 RED를 정확 테스트명으로 재현한 뒤 GREEN으로 만들고, 과거 위조·만료 음성 검사와 epoch88 활성/종료 fixture를 보존한다. Event 계약 오류가 시계 경계에서만 파생됐는지 검증한다. 코드 변경행 Ruff 신규0, `git diff --check`, epoch89 G-05를 확인한다.
3. 새 epoch89 active/C/B/closed G-05 route는 seq1~2228 Event 원문 불변, 새 WI→worker→write 24시간 분리 token, 정확2·제품0, A→C→B→종료 Git 조상/clean/private/비merge/커밋별 파일 범위·위조 거절을 검사한다. 이전 승인·역사 fixture를 삭제하거나 완화하지 않는다. 새 route 전 bootstrap G-05 RED는 PASS가 아니다.
4. 로컬 집중 세 건·epoch89 통제 집중·`tests/tooling/test_f19a_start_projection.py` 전체, F-20 successor 인접을 실행하고 정확 명령·exit·실패 원인을 보고한다. Main의 독립 C0/I0/M0와 C 정확2 checkpoint/private→B 문서 결박/private/clean→write→worker 회수→종료 G-05·역사 회귀 전 WSL 자원 생성 금지. R48 authority 기존2 FAIL은 따로 기록하며 새 실패를 그 탓으로 돌리지 않는다.

## 후속·제외

epoch89 종료 후 동일 private branch의 exact clean SHA를 WSL-server에서 Git pull하여 전용 PG15/OIDC/HTTPS/Chromium·Worker0020·reader/제3 actor/admin·GET/alerts/ACK·철회·DB 장애·backup/restore/downgrade guard를 실측한다. 자원 생성 전 이름·수명·정리 방법을 WORK_STATUS에 기록하고 종료 시 잔여0을 확인한다. 실제 WSL 증거와 독립 Tester `AV-OPS-026`·`AV-SAFE-034` 전 F-19A `ACCEPTED`, U-01 제품 write, main 병합은 금지한다. `ysna-server`/Production·공유 자원·실 사용자·Secret은 변경하지 않는다.
