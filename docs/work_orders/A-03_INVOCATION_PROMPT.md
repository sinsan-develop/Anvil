# A-03 InvocationPrompt

- invocation_artifact_id: `INV-A-03-20260811-001`
- work_instruction_artifact_id: `WI-A-03-20260811-001`
- work_instruction_content_hash: `E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F`
- baseline_git_commit: `a150a13fbc9874dcf18df7e7f0c713f7ca5d67ab`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary-a03`
- completion_report_path: `docs/completion_reports/A-03_COMPLETION_REPORT.md`
- report_format: `판정 → 판단 이유 → 조치`

위 ID와 SHA-256으로 고정된 WorkInstruction을 유일한 실행 요구사항으로 읽고 그대로 수행하라. 권위 hash, A-01/A-02 ACCEPTED, active worker/write lease를 먼저 확인하고 test-first로 진행한다. A-03 판정은 `STATIC_CONTRACT_PASS`, canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. Repository onboarding은 read-only이며 dirty/untracked를 정리하거나 static SVG를 실제 운영자·브라우저 PASS로 승격하지 않는다. 상세 요구를 이 InvocationPrompt에 복제하지 않는다.
