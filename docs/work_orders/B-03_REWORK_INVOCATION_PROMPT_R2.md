# B-03 R2 InvocationPrompt

- invocation_id: `INV-B-03-20260814-002`
- work_instruction_id: `WI-B-03-20260814-002`
- work_instruction_sha256: `CE1BA88F32B6EBF6AB7FFB5C834A9092FAD6B6FEE3DF5AC91CEB0D63A79CF722`
- baseline_git_commit: `f9fbf64f2f6f135050b69afe47e6bed3aabeea3b`
- agent_role: `developer-primary-b03`
- completion_report_path: `docs/completion_reports/B-03_COMPLETION_REPORT_R2.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, Tester report hash, epoch-2 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 실제 B-03 service를 호출하는 local-only same-origin flow로 E-SHOT 3종과 E-EVT를 생성하되 R1 제품·Tester report·progress/HANDOFF를 수정하지 않는다. B-11 canonical registry/SSE/auth/prod, B-03 acceptance, B-04, shared/WSL/production DB, provider, 외부 API, production/deploy를 수행하거나 완료로 기록하지 않는다. 실제 browser/API를 실행하지 못하면 PASS가 아닌 `BLOCKED`/`NOT_EXECUTED`로 보고한다.
