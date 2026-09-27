# F-20 R2 WSL 전체 suite 이식성 재작업 WorkInstruction

- 발행자: Main Agent 어울
- Work Package: `F-20/R2`; 기존 F-20 완료 판정은 무효, 수락 전 재작업이다.
- 기준: 승인된 `Anvil_작업계획서_v1.md` F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `AGENTS.md`.
- 분류: 계획 범위의 내부 검증·이식성 보완. 기능 범위·요구사항·중요 위험 변경 없음.
- 개발: Windows 로컬의 현재 `codex/f18-wsl-ops`. 검증: 지정 원격 push 후 `ssh WSL-server` 동일 SHA. ysna-server/Production 제외.

## 정확한 제품 쓰기 범위

1. `docs/04_test_reports/F-20_REWORK_R2_RESULT.md`
2. `packages/paths/identity.py`
3. `tests/paths/test_conflict_scope_identity.py`
4. `tests/deploy/test_wsl_staging_harness.py`
5. `tests/tooling/test_a14_workbench_prototype.py`
6. `tests/execution_backends/test_git_worktree.py`
7. `tests/persistence/test_oidc_pending_auth.py`
8. `tests/integration/test_c30r3_formal_entity.py`

이 범위 이외 제품 변경은 금지한다. 기존 R1 exact3 lease를 revoke하고 R2 execution/write token이 둘 다 유효하게 투영된 뒤에만 단일 writer가 수정한다.

## 작업과 완료 경계

- WSL에서 실패한 Windows `D:/tmp` 하드코딩, Windows 드라이브 경로의 POSIX 정규화, POSIX symlink cleanup, 테스트 수집 시각으로 고정된 OIDC 만료, 현재 코드와 불일치하는 AST·migration 단정을 각각 최소 재현해 RED→GREEN으로 보완한다. 제품 의미를 바꾸는 우회는 하지 않는다.
- 관련 로컬 테스트·회귀 및 WSL 동일 SHA 검증을 실시하고 전체 suite를 재실행한다. 남은 실패를 이 lease의 성공으로 숨기지 않는다.
- 결과 보고에 정확한 명령·종료코드·수치, 변경 diff, 잔여 오류, 미검증 범위, rollback을 기록한다. F-20 실제 11개 메뉴·중단/재개·Monitoring·ProductValidation·Defect·backup/restore·rollback 검증과 blocking defect 0은 별도 최종 gate다.
- 이번 lease 완료는 F-20 수락, P-01 착수, main 병합을 허용하지 않는다.
