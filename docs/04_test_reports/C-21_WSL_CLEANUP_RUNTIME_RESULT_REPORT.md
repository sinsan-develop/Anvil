# C-21 WSL cleanup runtime result report

## 판정

`READY_FOR_C21_WSL_ACCEPTANCE`, accepted=false, independent tester `PENDING`. C-01 remains `BLOCKED_PENDING_C21_ACCEPTANCE`; DIR-2 is `NOT_TRIGGERED`. Next action is `INDEPENDENT_C21_WSL_ACCEPTANCE_REVIEW`.

## Runtime 결과

- Standard cleanup invocation count `1`; cleanup internal exit `0`; outer wrapper exit `1`.
- The wrapper failure was `POST_CLEANUP_UNRELATED_INVENTORY_EQUALITY_ASSERTION`. It is a post-cleanup observation assertion and is not a cleanup failure.
- Approved targets deleted: containers `6/6`, networks `4/4`, exact volumes `2/2`; all target remaining counts are `0`.
- Global unrelated inventory equality was false, but pre-existing unrelated missing `0` and changed `0`. The only diff was concurrent Daon2/eoul additions or replacements.
- Application: clean detached `a6dca0da5a37e64491e91813895268e78ecb78b2`, private origin. Control: active `stage.3558037.6302`, clean `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, private origin.
- `.env`: SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, size `443`, mode `0600`, owner `root:root`, unchanged. PG15/PG18RC markers remain current=previous=`324eb169fedbce958d2e8cc29362deb7af433677`. Receipt/evidence hashes and counts were preserved.
- The prior approval denial was process-not-created with mutation `0`. Distro-selection and quoting faults are observation errors; valid product failure count remains unchanged.
- Provider, Telegram, separate DB work, ysna, and main were `NOT_EXECUTED`; `volume_cleanup=EXECUTED_APPROVED`.

## Evidence limitation

`PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION` is `OPEN / UNRESOLVED_EVIDENCE_DETAIL / MINOR`. The core require-escalated wrapper command and cleanup env/argv full text cannot be reconstructed exactly and are not guessed. Observed results, hashes, and exit codes remain preserved. Runtime observed timestamp also was not preserved; its status is `UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`, value is `null`, and only observed date `2026-09-07` is retained. The recording timestamp is independently sourced from `LOCAL_CLOCK_AT_APPEND_ONLY_RECORDING`.

## Preserved post-verify PowerShell command log

```powershell
Write-Output 'PG15_CONTAINERS'
wsl.exe -d Ubuntu -- sudo -n docker ps -aq --filter label=com.docker.compose.project=anvil-wsl-pg15
Write-Output "exit=$LASTEXITCODE"
Write-Output 'PG18_CONTAINERS'
wsl.exe -d Ubuntu -- sudo -n docker ps -aq --filter label=com.docker.compose.project=anvil-wsl-pg18rc
Write-Output "exit=$LASTEXITCODE"
Write-Output 'PG15_NETWORKS'
wsl.exe -d Ubuntu -- sudo -n docker network ls -q --filter label=com.docker.compose.project=anvil-wsl-pg15
Write-Output "exit=$LASTEXITCODE"
Write-Output 'PG18_NETWORKS'
wsl.exe -d Ubuntu -- sudo -n docker network ls -q --filter label=com.docker.compose.project=anvil-wsl-pg18rc
Write-Output "exit=$LASTEXITCODE"
Write-Output 'TARGET_VOLUMES'
wsl.exe -d Ubuntu -- sudo -n docker volume ls -q --filter name=anvil-wsl-pg15_anvil-db-data
wsl.exe -d Ubuntu -- sudo -n docker volume ls -q --filter name=anvil-wsl-pg18rc_anvil-db-data
Write-Output "exit=$LASTEXITCODE"
Write-Output 'APP_HEAD'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/repo rev-parse HEAD
Write-Output "exit=$LASTEXITCODE"
Write-Output 'APP_BRANCH_EXPECT_EXIT1'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/repo symbolic-ref -q --short HEAD
Write-Output "exit=$LASTEXITCODE"
Write-Output 'APP_STATUS'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/repo status --porcelain=v1
Write-Output "exit=$LASTEXITCODE"
Write-Output 'APP_ORIGIN'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/repo remote get-url origin
Write-Output "exit=$LASTEXITCODE"
Write-Output 'CONTROL_ACTIVE'
wsl.exe -d Ubuntu -- sudo -n cat /srv/anvil-wsl/control/active
Write-Output "exit=$LASTEXITCODE"
Write-Output 'CONTROL_HEAD'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/control/stage.3558037.6302 rev-parse HEAD
Write-Output "exit=$LASTEXITCODE"
Write-Output 'CONTROL_STATUS'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/control/stage.3558037.6302 status --porcelain=v1
Write-Output "exit=$LASTEXITCODE"
Write-Output 'CONTROL_ORIGIN'
wsl.exe -d Ubuntu -- sudo -n git -C /srv/anvil-wsl/control/stage.3558037.6302 remote get-url origin
Write-Output "exit=$LASTEXITCODE"
Write-Output 'MANIFEST_SHA'
wsl.exe -d Ubuntu -- sudo -n sha256sum /srv/anvil-wsl/control/stage.3558037.6302/deploy/wsl/CandidateReleaseManifest.json
Write-Output "exit=$LASTEXITCODE"
Write-Output 'ENV_SHA'
wsl.exe -d Ubuntu -- sudo -n sha256sum /srv/anvil-wsl/.env
Write-Output "exit=$LASTEXITCODE"
Write-Output 'ENV_STAT'
wsl.exe -d Ubuntu -- sudo -n stat -c '%a|%U:%G|%s' /srv/anvil-wsl/.env
Write-Output "exit=$LASTEXITCODE"
```

The target container/network/volume queries were blank with exit `0`; application/control/origin/manifest/environment-hash checks matched the facts above. `APP_BRANCH_EXPECT_EXIT1` returned the expected detached-head exit `1`. Only the final `ENV_STAT` suffered quoting damage and exited `127`; the containing post-verify PowerShell block itself exited `0`. That observation error is not evidence that the environment changed.

## Recording boundary

No command was re-executed for this report. No product/deploy/guard file changed. Push, WSL/Docker/DB mutation, Provider, Telegram, ysna, and main remain outside this record-only package.

## Developer verification

- TDD RED: `4 failed, 202 deselected`, exit `1`, because the seq566 builder/validator/collector did not yet exist.
- Focused GREEN before final evidence append: `5 passed, 202 deselected`, exit `0`.
- Live checker after runtime-result materialization: `G-05 project progress contract: PASS sequence=566 reporting=AUTO_CONTINUE`, exit `0`.
- `git diff --check`: exit `0`.
- Direct in-memory Python compile of `scripts/check_project_progress.py` and `tests/tooling/test_project_progress.py`: `compile: PASS 2 files`, exit `0`.
- A first `py_compile` invocation exited `1` because the managed sandbox denied its attempted `scripts/__pycache__` write. No source defect was inferred; direct in-memory compile supplied the syntax result without creating files.
- The first sandbox full-tooling run was interrupted after 34% when it reproduced the previously known managed-sandbox `D:\tmp tempfile.mkdtemp` stall. It is `INTERRUPTED_NOT_COUNTED`, not PASS or product FAIL.
- The same full tooling command in the approved isolated execution context completed `207 passed in 1029.51s (0:17:09)`, exit `0`.
- Deploy full was not rerun because every product/deploy/guard byte is identical to parent `b2ba821`; this package changes only the exact12 result-record/checker/test/projection paths.
- After the first result-evidence append and deterministic rematerialization, precommit focused remained `5 passed, 202 deselected`, live checker remained sequence `566` PASS, `git diff --check` remained PASS, and direct compile remained PASS.
