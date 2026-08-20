# B-11 R2 InvocationPrompt

- invocation_id: `INV-B-11-20260821-002`
- work_instruction_id: `WI-B-11-20260821-002`
- work_instruction_sha256: `1B72ABC408EF8B4C8A3CAE657201F3D1C1A00D1000D1E417D61942F457941002`
- baseline_git_commit: `ce8179527a64128899df21542b24f1b7f85e35b1`
- source_tester_report_sha256: `EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C`
- agent_role: `developer-primary-b11`
- completion_report_path: `docs/completion_reports/B-11_COMPLETION_REPORT.md`

위 ID/hash의 R2 WorkInstruction대로 test-first 수행하라. baseline/report, epoch-2 fencing token과 exact8을 먼저 확인하고 `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`를 Approval·artifact·SSE의 wrong role/project/environment hostile 요청과 zero-dispatch/read assertion으로 RED 재현한 뒤 최소 서버 측 scope authorization을 구현한다. R1 exact17 밖을 수정하거나 B-11 acceptance, B-12, 실제 메뉴 UI, Provider/Secret/Egress, shared DB, ysna, production, deployment를 시작하지 않는다. 실행하지 못한 runtime과 잔여 위험은 정확히 보고한다.
