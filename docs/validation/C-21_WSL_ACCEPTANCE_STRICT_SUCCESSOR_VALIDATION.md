# C-21 WSL acceptance strict successor validation

- Historical authority: immutable parent `bcaeeacd1618461127c2387504e2535a0d54504f`; private control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`; candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`.
- Historical seq566 checker/test/manifest are read from the immutable parent blob. Current seq566 validator receives only the C-21 local recursive strict JSON equality hardening.
- Deterministic materialization order: raw7 → E → P → H → D → M.
- Strict JSON contract: dict exact keys; list exact type, length, and order; scalar exact type and value; float finite; checksum bytes exact int greater than zero.
- exact12 Windows/ordinal hashes: `9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F` / `495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536`.
- cumulative155 Windows/ordinal hashes: `4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C` / `2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D`.
- Machine state is identical across completion event, progress, HANDOFF and manifest: scope C21_WSL; WSL ACCEPTED_WITH_LIMITATION; accepted false; C-21 BLOCKED_NOT_ACCEPTED; C-01 blocked; DIR-2 not triggered.
- Negative contracts cover bool/int/float confusion, scope/acceptance/C-01/DIR promotion, limitation removal, invented runtime timestamp, Provider/Telegram promotion, historical bytes/prefix/path/hash/digest/checksum, malformed JSON, private CAS, ancestry, status and direct-child diff.
- Tester source is `INDEPENDENT_TESTER_AGENT_REPORT`; repository artifact is absent. C0/I0/M2 is recorded without manufacturing a report file.
- Product/deploy/guard bytes are unchanged. Provider/Telegram/browser Network/ysna/main/C-01 start and external execution are not authorized.

## 검증 결과

- TDD RED results are recorded in the report and WORK_STATUS.
- Final focused GREEN before evidence append: seq566+seq572 public-path `12 tests in 18.705s`, OK, exit0.
- Live checker: sequence572/AUTO_CONTINUE PASS. Diff-check and two-file in-memory compile PASS.
- Full tooling before direct projection test hardening: `214 tests in 667.571s`, OK, exit0, retained only as historical evidence.
- Final full tooling after direct projection hardening: `214 tests in 680.535s`, OK, exit0.
- Direct `py_compile` attempted a managed-sandbox `__pycache__` write and was denied; file-free `compile()` syntax validation passed for both changed Python files.
- Deploy full is not required because product/deploy/guard bytes are unchanged. Final raw7 evidence append was followed by deterministic rematerialization and fresh focused `12 tests in 16.375s` OK, live checker sequence572 PASS, diff-check and file-free compile PASS. The postcommit checker is run only on the exact direct child.
- Direct seq566 projection coverage uses immutable bca artifacts with a patched generated-file view, so its float rejection cannot pass merely because current seq572 raw files differ.
