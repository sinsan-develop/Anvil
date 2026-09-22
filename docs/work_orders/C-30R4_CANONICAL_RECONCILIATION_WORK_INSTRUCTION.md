# C-30R4 canonical progress reconciliation WorkInstruction

## 목적

복구된 `scripts/check_project_progress.py`가 C-22~C-30의 append-only 진행 이력을
엄격하게 검증하도록 canonical progress 계약을 동기화한다. 기존 Event나 acceptance를
재작성하지 않고, C-30R4 완료 상태와 C-30 전체 gate 보류 범위를 정확히 투영한다.

## 기준과 불변 조건

- code baseline HEAD: `cc98f99fd5bf3b8823c94dac0b4c9457d3eeeb10`
- repair start sequence: `1325`
- seq1~1325 raw event-object prefix: `3985246` bytes / SHA256
  `09A6B52717CEF4E4E49B2AA1830B670226FEB272237668CC3EC39E2D07219431`
- seq1218~1325 canonical event-array SHA256:
  `00F988CE7B5ACFA45FAAD68B41F50668A3B81618CF94F9A626F205CE52147F08`
- 기존 Event 삭제·수정·재정렬, 기존 acceptance 승격, 오류 사후 필터링을 금지한다.
- C30R3 browser evidence는 승인된 fixture formal 범위만 유지한다. production auth,
  Provider, PostgreSQL 18, 실제 server-generated 400은 실행한 것으로 승격하지 않는다.

## 책임과 허용 경로

Developer write lease exact2:

- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`

Main control materialization exact8:

- `docs/progress/progress-event-contract.json`
- `docs/progress/progress-events.json`
- `docs/progress/build-progress.json`
- `docs/progress/BUILD_HANDOFF.md`
- `docs/work_orders/C-30R4_CANONICAL_RECONCILIATION_WORK_INSTRUCTION.md`
- `docs/work_orders/C-30R4_CANONICAL_RECONCILIATION_INVOCATION.md`
- `docs/evidence/manifests/C-30_FINAL_CANONICAL_RECONCILIATION_MANIFEST.json`
- `docs/progress/progress-handoff-detached-digest-c30-final-canonical-reconciliation.json`

제품 코드, 기존 historical evidence, 설계서·작업계획서, Secret, DB, 외부 환경은
변경하지 않는다.

## 구현 계약

1. seq1218~1325의 미등록 historical Event는 exact sequence/event_id/type/actor/
   subject/details hash profile로만 수용한다. 동일 type의 범위 밖 재사용은 거부한다.
2. event header의 stale `last_sequence=1280`은 기존 값을 기록한 새 reconciliation
   Event 뒤 현재 header만 append-only tail과 일치시킨다.
3. C30 canonical builder/validator/Git collector를 추가한다. 기존 generic snapshot,
   failure, approval, DIR, registry, evidence, handoff, digest 검증을 우회하지 않는다.
4. historical 테스트는 각 checkpoint의 Git blob 기반 deterministic fixture로 격리한다.
   현재 worktree bytes를 과거 authority로 대체하거나 assertion을 완화하지 않는다.
5. final tail은 표준 Event 계약을 사용해 WorkInstruction revision, repository
   reconciliation, package completion, independent judgment, write/worker lease revoke,
   C30R4 Main acceptance를 기록한다.
6. C30 전체 acceptance 조건이 아직 충족되지 않으면 별도 Main acceptance Event를
   만들지 않고 `PENDING_FINAL_GATE`를 유지한다.

## TDD·검증

- 현재 canonical checker 12개 오류를 RED로 보존하고 각 오류의 해소 근거를 남긴다.
- raw prefix/history profile 변조, 누락, 재정렬, type 재사용, 조기 acceptance,
  lease·review·Git·manifest·digest·HANDOFF 변조를 각각 fail-closed 검증한다.
- C03 authoritative harness와 기존 C30R4 focused 36개 회귀를 유지한다.
- 전체 `tests/tooling/test_project_progress.py`는 상호 배타 shard 전체 합계와 실제
  종료 코드로 검증하며 중단 실행을 PASS로 표시하지 않는다.
- builtin compile, live canonical checker exit0, `git diff --check`, exact10 외 변경0을
  확인한다.

## 완료와 rollback

C30R4는 독립 spec/quality review C0/I0/M0와 위 gate가 모두 통과해야 Main이
acceptance를 기록한다. rollback은 이번 successor exact10만 역적용하고 seq1~1325,
기존 C30R3 evidence, 사용자 dirty/untracked 자료는 보존한다.
