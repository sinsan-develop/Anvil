# A-05 InvocationPrompt

- invocation_artifact_id: `INV-A-05-20260811-001`
- work_instruction_artifact_id: `WI-A-05-20260811-001`
- work_instruction_content_hash: `F80E1641704BD0FD436F220A13228463FFEC6E2585F083A0405075B2C5E8375C`
- baseline_git_commit: `a797c104d802d4e371db3d901feb17ab5cd680db`
- execution_mode: `STANDARD_SINGLE_DEVELOPER`
- executor_role: `developer-primary-a05`
- completion_report_path: `docs/completion_reports/A-05_COMPLETION_REPORT.md`

위 hash로 고정된 WorkInstruction을 유일한 실행 요구사항으로 읽고 권위·A-01~04 predecessor·active worker/write lease를 검증한 뒤 test-first로 수행하라. Agent 추천과 사람 결정을 혼동하지 말고, 사람 확정 전 Execute를 열지 않는다. 결과는 `STATIC_CONTRACT_PASS`, canonical L4/L7와 E-EVT는 `RUNTIME_DEFERRED / NOT_EXECUTED`다. 상세 요구를 이 프롬프트에 복제하지 않는다.
