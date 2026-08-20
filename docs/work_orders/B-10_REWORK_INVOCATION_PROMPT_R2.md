# B-10 R2 InvocationPrompt

- invocation_id: `INV-B-10-20260821-002`
- work_instruction_id: `WI-B-10-20260821-002`
- work_instruction_sha256: `DFFCE00D420BC0DDC04C48B18856D111397C8DDC67155EE3DE702B8C379E6D21`
- baseline_git_commit: `e9dd00983775a5b1b2849f6be35304e34ef4fa17`
- source_tester_report_sha256: `B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB`
- agent_role: `developer-primary-b10`
- completion_report_path: `docs/completion_reports/B-10_COMPLETION_REPORT.md`

위 ID/hash의 R2 WorkInstruction대로 test-first 수행하라. baseline/report, epoch-2 fencing token과 exact7을 먼저 확인하고 `BLK-B10-IT-001`을 RED로 재현한 뒤 in-memory와 PostgreSQL admission accounting을 동일한 최소 계약으로 보완한다. R1 exact15 밖을 수정하거나 B-10 acceptance, B-11, B-12, provider adapter, shared DB, ysna, production, deployment를 시작하지 않는다. 실행하지 못한 runtime과 잔여 위험은 정확히 보고한다.
