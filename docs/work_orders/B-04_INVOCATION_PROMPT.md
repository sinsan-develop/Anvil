# B-04 InvocationPrompt

- invocation_id: `INV-B-04-20260814-001`
- work_instruction_id: `WI-B-04-20260814-001`
- work_instruction_sha256: `12EC940E255E2BF67B77120337874BDEAE446F9B1F1A6B478CD61A0C791838A1`
- baseline_git_commit: `1519d8cce5e205bd9e20652cc380e65e9ca01e49`
- agent_role: `developer-primary-b04`
- completion_report_path: `docs/completion_reports/B-04_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, runtime human approval, B-03 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-04 acceptance, B-05, B-11 공개 API/auth/BFF, ysna/shared-db mutation, provider, 외부 API, 운영 UI 또는 deploy를 수행하거나 완료로 기록하지 않는다. local isolated 또는 WSL Anvil 전용 격리 DB guard를 실행하지 못하면 정적·fixture 결과를 runtime PASS로 승격하지 않는다.
