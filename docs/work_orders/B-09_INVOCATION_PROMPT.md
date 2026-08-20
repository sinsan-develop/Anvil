# B-09 InvocationPrompt

- invocation_id: `INV-B-09-20260820-005`
- work_instruction_id: `WI-B-09-20260820-005`
- work_instruction_sha256: `108E951F23FAAC8390D6B17D64A206C127FE73D2776126E8B518EB674166725D`
- baseline_git_commit: `7c3382a497e995e18c736a487eee8761aa0c1a05`
- agent_role: `main-agent-eoul`
- completion_report_path: `docs/completion_reports/B-09_COMPLETION_REPORT.md`

위 ID/hash의 R5 WorkInstruction대로 test-first 수행하라. 독립 Tester report `8DE9794641BB22716A2A6392B9AC2F96B22387DFC12BFF17C91F467777C62B5D`의 CRITICAL `BLK-B09-IT-001/002`, R4 completion의 lease-null 상태, Main epoch-5 worker→write fencing token과 동결 exact15를 먼저 검증한다. 기능·요구사항·중요 위험·제품 exact15 범위는 바꾸지 않는다. 상세 요구를 복제하지 않으며 B-09 acceptance, B-10 intervention/budget, B-11 FastAPI/BFF/SSE/UI, B-12 process/PC recovery, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. 실제 DB 검증은 Anvil 전용 격리 WSL PostgreSQL 18에서만 허용하며, 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
