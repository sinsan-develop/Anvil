# C-21 WSL cleanup runtime result validation

- Historical authority is immutable commit `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`; seq1~560 raw event prefix and historical progress/events/handoff hashes must match before materialization.
- Deterministic order is raw7 → events → progress → handoff → detached digest → manifest.
- Cleanup facts: invocation `1`, internal exit `0`, outer wrapper exit `1`; `POST_CLEANUP_UNRELATED_INVENTORY_EQUALITY_ASSERTION` is not a cleanup failure.
- Target cleanup: containers `6→0`, networks `4→0`, exact volumes `2→0`.
- Unrelated global equality is false, while pre-existing unrelated missing/changed counts are both `0`; the diff consists only of concurrent Daon2/eoul additions or replacements.
- Application remains clean detached candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`; active control `stage.3558037.6302` remains clean parent/control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, both on the private authority.
- `.env` remains SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, size `443`, mode `0600`, owner `root:root`. PG15 and PG18RC markers remain current=previous=`324eb169fedbce958d2e8cc29362deb7af433677`; receipt/evidence hashes and counts remain preserved.
- The earlier approval denial created no process and caused mutation `0`. Distro-selection and post-verify quoting damage are observation errors and do not increment the valid product failure count.
- `PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`: the exact mutation-wrapper command and cleanup env/argv full text are unavailable after Operator subagent compaction. The limitation stays `OPEN / UNRESOLVED_EVIDENCE_DETAIL / MINOR`; result hashes and exit codes are preserved.
- Runtime observed timestamp is unavailable: `runtime_observed_at=null`, status `UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`, date `2026-09-07`. Recording time is independently fixed from the local clock.
- Negative contracts reject history/prefix/path/hash/runtime-count/exit/misclassification/unrelated-loss/environment/marker/receipt/external-execution/acceptance/C-01/DIR/evidence-limitation tampering and malformed JSON.
- No product/deploy/guard byte changed, so deploy full regression is not required for this append-only result record.

## Developer verification result

- RED: `4 failed, 202 deselected`, exit `1`; GREEN: `5 passed, 202 deselected`, exit `0`.
- Live checker: sequence `566` / `AUTO_CONTINUE` PASS. `git diff --check` PASS.
- In-memory compile: two changed Python files PASS. The separate `py_compile` attempt was blocked only by sandbox `__pycache__` write permission and is not recorded as a source compile failure.
- First sandbox full tooling: `INTERRUPTED_NOT_COUNTED` at 34% due the known `D:\tmp tempfile.mkdtemp` stall.
- Approved isolated full tooling: `207 passed in 1029.51s (0:17:09)`, exit `0`.
- After the first result-evidence append and deterministic rematerialization, fresh precommit focused remained `5 passed, 202 deselected`, live checker remained sequence `566` PASS, diff-check PASS, and direct compile PASS. The full result is not relabeled as having run after later evidence-only appends.
