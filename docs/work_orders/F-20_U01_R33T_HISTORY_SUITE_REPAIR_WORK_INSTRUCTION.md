# WorkInstruction — F-20/U-01 R33T 역사 전체 검증 계약 복구

- 담당: `developer-primary-f20-u01-r33t` 단일 writer. Main의 seq1998 no-lease에서 append-only worker/write dual lease가 유효해지고 G-05가 PASS한 뒤 착수한다.
- 기준: `Anvil_작업계획서_v1.md` U-01/F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `docs/04_test_reports/F-20_U01_R33T_HISTORY_SUITE_REPAIR_PLAN.md`. Main이 dispatch 때 기준 문서/WI/Invocation SHA-256, branch/HEAD/status, 두 fencing token·만료를 전달한다.
- 분류: 승인된 F-20 전체 suite 회복의 test-only 내부 보완. 기능 범위·요구사항·공개 API/DB/auth/Secret·중요 위험 변경 없음.

## allowed_paths 정확히 13개

1. `tests/tooling/test_f20_u01_r2_projection.py`
2. `tests/tooling/test_f20_u01_r2b_projection.py`
3. `tests/tooling/test_f20_u01_r3b_projection.py`
4. `tests/tooling/test_f20_u01_r4_projection.py`
5. `tests/tooling/test_f20_u01_r5_projection.py`
6. `tests/tooling/test_f20_u01_r6_projection.py`
7. `tests/tooling/test_f20_u01_r6b_projection.py`
8. `tests/tooling/test_f20_u01_r7_projection.py`
9. `tests/tooling/test_f20_u01_r8_projection.py`
10. `tests/tooling/test_f20_u01_r20_prep_projection.py`
11. `tests/tooling/test_project_progress.py`
12. `tests/verification/test_c01_l3_independent_acceptance.py`
13. `docs/04_test_reports/F-20_U01_R33T_HISTORY_SUITE_REPAIR_RESULT.md`

## 완료조건과 금지

- 계획의 Task 1~4를 순서대로 RED→GREEN 처리하고 역사 정상·만료·위조 검사와 현행 G-05를 유지한다. 고정 시계는 역사 fixture에만 적용하며 live validator/overlay의 만료 검사·fencing/권한 규칙을 바꾸지 않는다.
- C01은 승인된 R10 `GET /api/dashboard/operations` 하나만 역사 successor 목록에 추가한다. 임의 route 허용, 원 parent hash 수정, assertion 삭제/skip/xfail 금지.
- Developer는 착수 전 기준 Git SHA/branch/dirty, active actor, 두 lease token·expiry·exact13 scope와 G-05를 확인한다. Main 소유 Event/progress/HANDOFF/WORK_STATUS/control, 제품 API/runtime, 사용자 dirty/untracked는 수정·stage·삭제하지 않는다.
- 정확한 diff와 각 실패군 집중 테스트, 관련 음성·보안 회귀, 전체 가능한 로컬 테스트, G-05, diff check를 실행한다. 실패·SKIP·미실행은 분리해 결과 보고서에 적는다. 테스트 임시 경로는 대상과 내부 링크·활성 프로세스를 확인해 정확히 정리한다.
- Developer는 commit/push/PR/merge, 새 branch/main, WSL-server/Docker/DB, ysna/Production을 건드리지 않는다. Main은 독립 검토·commit/private push·WSL-server 동일 SHA 전체 QA와 자원 정리를 담당한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. 전체 suite GREEN이어도 C30 `OPEN_BLOCKING`, F-20/U-01 미수락, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`가 유지된다.
