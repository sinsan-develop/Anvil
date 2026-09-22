# C-30R4 canonical reconciliation R2 WorkInstruction

## 분류

`MAIN_RECONFIRMED_NON_SEMANTIC` — 기능 범위·요구사항·중요 위험 변경 없이 만료된
epoch 1 lease를 회수하고, 동일 Developer exact2에서 남은 historical checkpoint fixture
격리와 전체 tooling gate를 마감한다.

## 부모와 불변 범위

- parent WorkInstruction:
  `docs/work_orders/C-30R4_CANONICAL_RECONCILIATION_WORK_INSTRUCTION.md`
- parent SHA256:
  `71AD438A5F5C614E5089B35B0CD49E806B5855DCB2844244C12BDF78992996CF`
- seq1~1327과 C30R4 canonical projection은 append-only로 보존한다.
- Developer exact write paths는 다음 두 개로 불변이다.
  - `scripts/check_project_progress.py`
  - `tests/tooling/test_project_progress.py`
- 제품 코드, historical Event/evidence, 설계·작업계획, 외부 환경은 변경하지 않는다.

## R2 수행 범위

1. current worktree를 과거 checkpoint로 사용한 나머지 tooling test를 해당 Git blob 기반
   deterministic fixture로 격리한다.
2. assertion, expected reason code, hash, raw-prefix, tamper 검증은 삭제·완화하지 않는다.
3. C30 strict event profile/builder/validator와 C03 authoritative harness는 보존한다.
4. 전체 679개를 상호 배타 shard로 fresh 실행하고 실제 exit code와 합계를 기록한다.
5. control materialization, 독립 review, acceptance, commit은 Main 소유다.

## Lease epoch 2

- worker: `worker-lease-c30r4-checker-20260922-002`
- write: `write-lease-c30r4-checker-20260922-002`
- execution token: `c30r4-checker-execution-fence-epoch-2-ed3cae9`
- write token: `c30r4-checker-write-fence-epoch-2-ed3cae9`
- 만료: `2026-09-22T21:25:00+09:00`

epoch 1 token은 재사용하지 않는다. rollback은 R2 exact2 delta만 역적용하고 부모
canonical reconciliation 및 사용자 자료를 보존한다.
