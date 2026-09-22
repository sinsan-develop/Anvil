# C-30R4 canonical progress checker corrective WorkInstruction

## 목적

`abb73610`에서 `scripts/check_project_progress.py`의 C03/C04/C05 embedded fixture와
builder/validator 구간이 다중행에서 비정상 한 줄로 접합·삭제되어 발생한 SyntaxError를 복구한다.
이 작업은 C30 제품 동작 변경이 아니라 C30 전체 문서 lint/link/ID gate 복원이다.

## 기준과 허용 경로

- baseline HEAD: `cc98f99fd5bf3b8823c94dac0b4c9457d3eeeb10`
- 손상 도입 commit: `abb73610`
- 손상 전 기준: `abb73610^` (`98e218264bf54db04a1bd35a67273b713805a649`)
- C03 R2 harness authoritative constant 기준: `a1cc6157`
- exact write paths:
  - `scripts/check_project_progress.py`
  - `tests/tooling/test_project_progress.py`
- 제품 코드, progress/HANDOFF/report, historical evidence, 다른 checker 수정 금지.

## TDD와 복구 경계

1. 먼저 checker source를 builtin `compile()`하는 최소 regression test를 추가하고 현재
   line32957 SyntaxError로 RED임을 확인한다.
2. `abb73610`의 destructive hunk 17개만 손상 전 bytes로 복원한다. 현재 정상 additive
   routing/E11 delta는 보존한다.
3. `C03_FINAL_R2_HARNESS_B64`만 `a1cc6157`의 authoritative 43781 bytes /
   SHA256 `5027C870...B5F6487` 계약으로 복원한다.
4. frozen assertion을 삭제·완화하거나 기대값을 현재 손상 값으로 바꾸지 않는다.
5. unrelated formatting/refactor, generated evidence rewrite, event/history 수정 금지.

## 필수 검증

- 신규 compile regression RED→GREEN.
- Python builtin compile `scripts/check_project_progress.py`.
- focused tooling tests:
  `C03FinalAcceptanceProjectionTests or C04StartProjectionTests or C04FinalAcceptanceProjectionTests or C04DetachedSmokePortabilityReconciliationTests or C05StartProjectionTests or C05ScopeRevisionProjectionTests or C05FinalAcceptanceProjectionTests or E04StartControlTests`.
- 전체 `tests/tooling/test_project_progress.py`.
- `python -B scripts/check_project_progress.py`.
- `git diff --check`; exact2 외 변경0.

## 완료·rollback

완료는 checker compile과 focused/whole tooling test 및 canonical checker가 모두 exit0일 때만 가능하다.
미통과 항목은 PASS로 승격하지 않는다. rollback은 이 corrective commit의 exact2만 revert하고
historical evidence와 제품 commit은 건드리지 않는다.
