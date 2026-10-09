# Anvil 설계 변경·미진사항 기록

이 파일은 신산님의 2026-10-09 지시에 따른 작업 주기별 추적 기록이다. 작업을 진행할 수 없는 항목은 사유·재현 근거·영향·실제 수행/미검증 범위·재개 조건·권고안을 기록하고 다음 독립 작업을 계속한다. 이 기록으로 해당 항목의 **이번 계획 진도**는 정리할 수 있으나 실제 기능 구현, 테스트 PASS, 보안·DB 검증, PR 병합, 사용자 인수의 증거로 승격하지 않는다. 정본 상태와 실제 증거는 `docs/WORK_STATUS.md`, `docs/progress/build-progress.json`, 검증 보고서와 Git을 함께 대조한다.

## 현재 주기: U-01 정확 조합·기간 Dashboard

- 기준: 승인된 계약 B `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`, 승인 기록 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md`.
- 작업 범위: Windows 로컬 개발 → 기존 단일 branch push → `ssh WSL-server`에서 동일 SHA 격리 검증. `ysna-server`와 Production은 이 주기 작업 대상이 아니다.
- 2026-10-09 현재 Task 1 API shell은 로컬 절편까지 검증됐지만 U-01 전체는 `NOT_ACCEPTED`, Release는 `DEFER`, Production은 `NOT_EXECUTED`다. Task 2 Reader·Task 3 화면·Task 4 실제 WSL-server/독립 수락·PR/main 병합은 아직 수행·검증 완료가 아니다. 이들은 현재 승인 계획의 후속 실행 항목이며 단순 기록만으로 PASS 처리하지 않는다.

### DC-U01-001 — Task 2 시작 문서의 제품 경로 표시 불일치

- 판정: 내부 문서 투영 오류를 A2에서 교정. 설계·기능 범위 변경은 아니다.
- 사유·근거: 최초 A `d89a1c6160821af0ed3fb62ee1426b9a576f201a`의 `repository.product_write_scope`가 전 Task 1 경로를 표시해 epoch102 WI·binding/write lease의 12경로와 달랐다.
- 영향·조치: Developer 쓰기를 중단하고 Event·lease 원문은 보존한 채 A2 `7b5c8bfc60e7db8d0147cf8bd7d82b5a674cc49d`에서 해당 표시와 A checkpoint를 교정했다. A2 local/private 동일·clean을 확인했다.
- 잔여·재개 조건: 신규 Task 2 통제 route와 제품 검증은 별도 gate다. A2 교정 자체를 제품 PASS로 간주하지 않는다.

### DC-U01-002 — Task 2 통제 독립 검토의 단계별 Git 허용 경계

- 판정: 동일 승인 범위의 통제 결함 2건과 음성 테스트 공백 2건을 단일 Developer가 보완했다.
- 사유·근거: 최초 통제 diff는 B 전용 `design_change.md` 수정을 D→P에도 허용했고, 종료 H가 test-only 제품 D를 허용했다. B→P/P→H 시각 역행 재결박 음성도 빠져 있었다.
- 영향·조치: 각각 RED→GREEN 음성을 추가하고 C→B에만 새 기록 파일을 요구하며 D→P 문서 및 H 제품 경로를 좁혔다. 최종 통제 SHA-256은 검사기 `BDC1AD0C9D932E8C1966C5814AFAE992C880BB33479E4592205C1E2FD6A607A9`, 테스트 `F49A5D11A67BBE2D6F1E04CD63F556714A695196D7F96837755C5ED2A7816CB7`이다.
- 실제 검증: Task 2 집중 10 PASS, 인접 7파일 271 PASS/0 FAIL(exit 0), 활성 G-05 seq2297 PASS, 독립 재검토 Critical 0/Important 0. 제품 12파일·WSL-server 실제 QA는 미실행이다.
- 잔여·재개 조건: 통제 C `ff8f26b60c22696fdb8a27ed5d551b26ab879100`는 기존 branch/private에 게시·원격 동일·clean까지 확인했다. 이 문서를 포함한 B 투영의 G-05·원격 게시/clean 후에만 제품 RED 테스트를 시작한다.
