# C-04 Detached-Smoke Portability Reconciliation Validation

- seq1~756 raw event objects: preserved; seq757 `REPOSITORY_RECONCILED`: appended once
- authority classification: `MAIN_INTERNAL_TECHNICAL_CORRECTION`
- fix → merged main and ordered prior merge parents: fail-closed
- merged-main tree equals prior feature-acceptance tree: required
- exact2 fix paths and exact9 projection paths: fail-closed
- exact9 precommit, sole direct child, reviewed two-parent merge and detached development main: accepted
- hash/path/ancestor/parent-order/merge-tree/dirty/upstream/remote mutation: rejected
- C-04 ACCEPTED, C-05 READY_FOR_WORK_INSTRUCTION, DIR-2 NOT_REACHED and null leases: preserved
- external/runtime validation: no new execution; historical evidence is not promoted
