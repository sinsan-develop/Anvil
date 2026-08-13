# B-03 InvocationPrompt

- invocation_id: `INV-B-03-20260814-001`
- work_instruction_id: `WI-B-03-20260814-001`
- work_instruction_sha256: `A80E618ECA15E184ADB5DBFB7E079C3B42A474A9FE8F566D7EFE7A0C6D13E023`
- baseline_git_commit: `a589b17f26991432de5cf48cfe95c441cdd6da39`
- agent_role: `developer-primary-b03`
- completion_report_path: `docs/completion_reports/B-03_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, B-02 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-03 acceptance, B-04, shared/WSL/production DB, provider, 외부 API, 공개 API 확정 또는 deploy를 수행하거나 완료로 기록하지 않는다. 실제 L4+L7 흐름을 실행하지 못하면 정적·fixture 결과를 runtime PASS로 승격하지 않는다.
