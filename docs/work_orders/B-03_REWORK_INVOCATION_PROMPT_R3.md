# B-03 R3 InvocationPrompt

- invocation_id: `INV-B-03-20260814-003`
- work_instruction_id: `WI-B-03-20260814-003`
- work_instruction_sha256: `A15F078F729361D486064AB44234B5D2CC41FB1C40A1EFFB09A0F4EF184F8CB7`
- baseline_git_commit: `03c0d131693f5479f16aababcce385ca1c46aee6`
- agent_role: `developer-primary-b03`
- completion_report_path: `docs/completion_reports/B-03_COMPLETION_REPORT_R3.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. report hash, epoch-3 fencing token과 exact5를 먼저 검증하고, system `core.autocrlf=true` hostile 조건의 내부 clone 실패를 RED로 고정한 뒤 clone-local LF 설정만 보완한다. 제품/runtime와 R1/R2 actual evidence/report는 byte-frozen이다. default current tooling 및 explicit LF clean clone tooling을 검증하고, B-03 acceptance·B-04·runtime 재실행·provider·WSL·production·deploy는 수행하지 않는다.
