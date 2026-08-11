# A-02 InvocationPrompt

- invocation_artifact_id: `INV-A-02-20260811-001`
- work_instruction_artifact_id: `WI-A-02-20260811-001`
- work_instruction_content_hash: `E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0`
- baseline_git_commit: `00adf34e8ed9393d1c22c2fa9da825bcacc79abc`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary-a02`
- completion_report_path: `docs/completion_reports/A-02_COMPLETION_REPORT.md`
- report_format: `판정 → 판단 이유 → 조치`

위 ID와 SHA-256으로 고정된 WorkInstruction을 유일한 실행 요구사항으로 읽고 그대로 수행하라. 권위 hash, A-01 ACCEPTED, active worker/write lease를 먼저 확인하고 test-first로 진행한다. A-02 판정은 `STATIC_CONTRACT_PASS`, canonical L4는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. 정적 SVG를 실제 브라우저·Playwright E-SHOT PASS로 승격하지 않는다. 상세 요구를 이 InvocationPrompt에 복제하지 않는다.
