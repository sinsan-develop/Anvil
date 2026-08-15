# B-07 InvocationPrompt

- invocation_id: `INV-B-07-20260815-001`
- work_instruction_id: `WI-B-07-20260815-001`
- work_instruction_sha256: `4809891FD6EADFB7CD5A147D879257FC61C3AD7D20B63081814DF46F59E0741F`
- baseline_git_commit: `1a9c25b7ce2c257d40aaa10fcf3a0478f654db93`
- agent_role: `developer-primary-b07`
- completion_report_path: `docs/completion_reports/B-07_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, B-01~B-06 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-07 acceptance, B-08, progress/HANDOFF outbox/export, replay/fork orchestration, FastAPI/BFF/UI, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. WSL을 사용하는 경우 Anvil 전용 격리 PostgreSQL 자원만 생성·검증·삭제하고, 실제 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
