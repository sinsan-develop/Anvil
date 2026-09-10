# C-01 L3 rework control report

## Status

- Status: COMPLETED_PENDING_RECORD_COMMIT
- Frozen parent: `0f39bad30e7f4ab865077530cbbd29d902d1485d`
- Branch: `codex/c01-mainline-reconciliation`
- Record commit: `SELF` (resolve with `git rev-parse HEAD`; a Git commit cannot embed its own SHA without changing that SHA)

## Exact changed paths

Verified control exact10:

1. `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-l3-rework-control-report.md`
2. `docs/evidence/manifests/C-01_L3_REWORK_START_MANIFEST.json`
3. `docs/progress/BUILD_HANDOFF.md`
4. `docs/progress/build-progress.json`
5. `docs/progress/progress-events.json`
6. `docs/progress/progress-handoff-detached-digest-c01-l3-rework-start.json`
7. `docs/work_orders/C-01_L3_REWORK_INVOCATION_PROMPT.md`
8. `docs/work_orders/C-01_L3_REWORK_WORK_INSTRUCTION.md`
9. `scripts/check_project_progress.py`
10. `tests/tooling/test_project_progress.py`

## RED / GREEN evidence

- RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -q -p no:cacheprovider -k C01L3ReworkControlTests`
- RED result: exit 1, `3 failed, 320 deselected`; all failures reported `C-01 L3 rework control builder missing`.
- First focused GREEN: exit 0, `3 passed, 320 deselected in 11.85s`.
- Focused GREEN after fail-closed lineage/event/Git-path correction: exit 0, `4 passed, 320 deselected in 13.34s`.
- Historical + successor focused GREEN: exit 0, `14 passed, 310 deselected in 36.83s` for `C01MainlineAcceptanceTests or C01L3ReworkControlTests`.

## Checks

- Final review receipt SHA-256: `E9D8A4B643C9FDAEF97B06FABDB0159527B6CD506B1238AC9F8BA9ED859A9B46` confirmed.
- Append-only: seq1-715 raw event prefix bytes `2189608`, SHA-256 `717CAB1E70CE2ACDBDA5ABA7711F812CFF360701C773F95BA20D4088345C57C9`, equal before/after.
- Exact staged path count: 10; no product or product-test path changed.
- Live checker: exit 0, `G-05 project progress contract: PASS sequence=721 reporting=AUTO_CONTINUE`.
- Authority hashes match the seq715 frozen values; final review receipt hash matches the approved brief.
- `git diff --cached --check`: exit 0.
- Direct `py_compile` could not write `scripts/__pycache__` because of sandbox ACL; final syntax verification uses in-memory `compile()` and must remain write-free.
- Product code/tests, migrations, Provider, Telegram, credentials, network, push, PR, deployment: not changed/not executed.

## Remaining work and rollback

- Remaining product work: execute the fresh exact17 C-01 L3 WorkInstruction, then obtain independent L3 review and Main acceptance. C-02 remains blocked.
- Remaining control action: create the sole child record commit of `0f39bad` and verify its clean exact10 lineage.
- Rollback after commit: revert the single control commit. Historical seq1-715 and evidence remain the recovery baseline.
