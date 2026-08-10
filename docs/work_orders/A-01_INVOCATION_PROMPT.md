# A-01 InvocationPrompt

- invocation_artifact_id: `INV-A-01-20260811-001`
- work_instruction_artifact_id: `WI-A-01-20260811-001`
- work_instruction_content_hash: `CF67FB8DF08DF14460A1C304734BE15EEDCB35F4B181F34BA6B7A27064F0B206`
- responsibility_approval_id: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`
- operating_approval_id: `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- baseline_git_commit: `7422b07b85bcdcec52031e1b10098ab6ca089170`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary`
- completion_report_path: `docs/completion_reports/A-01_COMPLETION_REPORT.md`
- report_format: `판정 → 판단 이유 → 조치`

위 ID와 SHA-256으로 고정된 WorkInstruction을 유일한 실행 요구사항으로 읽고 그대로 수행하라. 먼저 기준선·허용 경로·`AV-UI-005 STATIC_ONLY` 책임을 검증한 뒤 test-first로 진행한다. 정적 artifact를 runtime PASS로 승격하지 말고, `AV-FLOW-001`은 `RUNTIME_DEFERRED / NOT_EXECUTED`로 유지한다. 상세 진행은 progress/HANDOFF와 지정 CompletionReport에만 기록한다.
