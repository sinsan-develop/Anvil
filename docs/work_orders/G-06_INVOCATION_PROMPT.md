# G-06 InvocationPrompt

- invocation_artifact_id: `INV-G-06-20260810-002`
- supersedes_invocation_artifact_id: `INV-G-06-20260810-001`
- work_instruction_artifact_id: `WI-G-06-20260810-002`
- work_instruction_content_hash: `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- operating_approval_id: `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary`
- completion_report_path: `docs/completion_reports/G-06_COMPLETION_REPORT.md`
- report_format: `판정 → 판단 이유 → 조치`

위 ID와 content hash로 고정된 WorkInstruction을 유일한 실행 요구사항으로 읽고 그대로 수행하라. test-first로 fixture/golden/scenario 계약을 구현하고 기본 검증·자기검토 후 지정 CompletionReport에만 상세 결과를 기록하라.
