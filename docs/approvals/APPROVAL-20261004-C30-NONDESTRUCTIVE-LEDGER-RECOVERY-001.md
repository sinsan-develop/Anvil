# C30 비파괴 원장 복구 방향 승인 기록

- approval_id: `APPROVAL-20261004-C30-NONDESTRUCTIVE-LEDGER-RECOVERY-001`
- source: 현재 대화에서 Main의 복구 제안 직후 신산님의 직접 응답 `승인해`
- approved_proposal: `정상 원문과 사고 원문을 모두 보존한 채, 같은 작업 브랜치에서 검증된 새 원장 세대를 만들고 후속 Event·승인 결박을 재검증하는 복구입니다. 과거 기록 재작성·force push·운영 변경은 하지 않습니다.`
- scope: 현재 `codex/f18-wsl-ops` branch의 C30 Event 권위 복구 설계·구현·검증. 정상/사고 Git 원문과 후속 Event는 삭제·재작성하지 않는다.
- excluded: 과거 기록 재작성, force push, `main` 선병합, F-20/U-01 수락, Release GO, 운영/`ysna-server`, 공개 API·DB·인증·권한 계약 변경.
- derived_design: `docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DESIGN.md`

이 파일은 대화 지시의 범위를 기록한 것이며 신산님의 서명이나 별도의 수락·검증 완료를 주장하지 않는다. 실제 artifact hash와 원장 Event 결박은 구현·독립 검증 시 생성한다.
