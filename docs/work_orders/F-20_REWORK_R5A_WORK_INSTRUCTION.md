# F-20 R5a 현재 진행상태 계약 재작업 WorkInstruction

- 발행자: Main Agent 어울
- Work Package: `F-20/R5a`; F-20 전체 suite의 현재 투영 테스트 3건만 다룬다.
- 기준: 승인된 `Anvil_작업계획서_v1.md` F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `AGENTS.md`.
- 분류: 승인된 진행상태 검증 범위 안의 역사/현재 포맷 분리. 기능 범위·공개 API·DB·권한·중요 위험 변경 없음.
- 개발은 Windows 로컬의 기존 `codex/f18-wsl-ops`, 검증은 지정 원격 push 후 `ssh WSL-server` 동일 SHA. ysna-server/Production 제외.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R5A_RESULT.md`
2. `tests/tooling/test_project_progress.py`

R4 write→worker lease를 append-only 회수하고 R5a epoch5 worker/write token·exact2 scope·만료·dispatch SHA의 G-05가 유효한 뒤 단일 writer가 수정한다. 이 두 경로 밖 테스트·제품·검사기 변경 금지. Main은 writer가 lease를 가진 동안 같은 경로를 수정하지 않는다.

## 실패 재현과 변경 계약

- 다음 3개 node를 기존 SHA에서 RED로 확인한 뒤 원인별 GREEN으로 보완한다: `ProjectProgressContractTests.test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`, `test_failure_evidence_is_real_and_projection_matches_progress`, `test_event_payload_effects_and_all_categories_fixture_are_enforced`.
- F-20 현재 detached digest·handoff·manifest는 R5a의 실제 raw-byte 결박과 in-memory 변조 거부로 검사한다. 과거 canonical digest/manifest helper를 현재 포맷에 무차별 적용하지 않는다. 위조 progress/handoff/manifest가 `validate_bundle`에서 실제 거부되는지도 확인한다. 기존 역사 helper의 당시 경계는 유지한다.
- failure count 음성 테스트는 현재 F-20 handoff에 없는 필드를 조작하지 않는다. 현재 progress·failure ledger의 실제 계약을 사용하고 `FAILURE_PROJECTION_MISMATCH` 거부를 유지한다.
- Event all-category fixture에는 현재 event contract가 요구하는 구체 3종(`WORK_INSTRUCTION_ISSUED`, `PHASE_GATE_COMPLETED`, `PACKAGE_REVIEWED`)의 정확한 required payload만 더한다. wildcard 타입/검사 약화·skip/xfail 금지.
- C30 현 원장 raw prefix 변조 1건과 C21/C09~13/E09 역사 37건은 R5a 범위 밖으로 남겨 FAIL을 숨기지 않는다. 정상/위조 집중 테스트, G-05, 정확한 명령·exit·미검증·rollback을 결과 보고서에 기록한다. Main이 commit/push와 WSL 동일 SHA 검증을 맡는다.

## 완료 경계

R5a 세 테스트 GREEN은 전체 suite·감사 원장 무결성·실제 DB/브라우저/API/11개 메뉴 또는 F-20 수락이 아니다.
