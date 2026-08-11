# A-04 InvocationPrompt

- invocation_artifact_id: `INV-A-04-20260811-001`
- work_instruction_artifact_id: `WI-A-04-20260811-001`
- work_instruction_content_hash: `1B8CE8809EC6546ED483D0E48294CC547F0767A5D0D31D120B08787290ED753E`
- baseline_git_commit: `445765acfc5ca565d24bd794db6edd08c6dbca05`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary-a04`
- completion_report_path: `docs/completion_reports/A-04_COMPLETION_REPORT.md`
- report_format: `판정 → 판단 이유 → 조치`

위 hash로 고정된 A-04 WorkInstruction을 유일한 실행 요구사항으로 읽고, 권위·A-01~03 predecessor·active worker/write lease를 검증한 뒤 test-first로 수행하라. 결과는 `STATIC_CONTRACT_PASS`, canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. A-01 rail과 A-02/A-03 계약을 재정의하거나 static SVG를 실제 browser/runtime PASS로 승격하지 않는다. 상세 요구를 이 프롬프트에 복제하지 않는다.
