# C-21 Workbench UI WSL authenticated browser runtime retry R9 validation

- seq669~674 append-only; seq1~668 byte-preserved
- synthetic PASS/PROBE_ERROR/malformed/throwing-transformer always-return envelope 4건: TDD RED `5 failed, 269 deselected`, GREEN `5 passed, 269 deselected`, builder RED `1 failed, 5 passed, 269 deselected`, builder GREEN `6 passed, 269 deselected`.
- harmless local native call-shape5 PASS, WSL action0; final preflight PASS.
- actual: deploy1, verify0, PG15 browser0, PG18RC browser0, outer-finally cleanup1, retry0. deploy/cleanup exit은 final safe envelope 실패로 `UNAVAILABLE`이며 PASS로 승격하지 않는다.
- failure step `SAFE_NATIVE_METADATA_HASH`; statement allowlist `stdout_sha256=H native.stdout;stderr_sha256=H native.stderr`; exception `ParameterBindingException`; category `GET_HISTORY_ID_CONVERSION_FAILURE`.
- post-cleanup app/env/control clean·byte-identical, exact runtime residue0. current receipt4/image metadata2는 SHA-256만 결박한다.
- 동일 evidence-capture lineage count3, lease/tool 회수, internal TakeoverPacket, Main sequential takeover를 강제한다. 제품 failure=false, accepted=false다.
- generated5 materialize5, two-build/materialized byte equality, seq1~668 raw event prefix 보존 PASS다. fresh seq668+674 focused는 `10 passed, 265 deselected in 1.23s`, live checker는 `PASS sequence=674 reporting=AUTO_CONTINUE`, exact12/cumulative273와 `git diff --check`가 PASS다.
- 첫 live checker는 capture count3를 canonical failure-ledger projection 없이 global `valid_failure_count`에 잘못 투영해 `FAILURE_PROJECTION_MISMATCH`로 fail-closed했다. capture count3를 internal TakeoverPacket/diagnosis에 유지하고 global ledger projection을 byte-preserve해 교정했다.
- parent `eadba5b...`의 exact12 single direct-child commit을 생성했다. postcommit focused `10 passed, 265 deselected`, checker `PASS sequence=674`, generated5 equality, direct path12, clean worktree를 확인했다. push/runtime 재실행은 미실행이다.
