# B-06 InvocationPrompt

- invocation_id: `INV-B-06-20260815-001`
- work_instruction_id: `WI-B-06-20260815-001`
- work_instruction_sha256: `C52B192E88B581B44B47D2A07DC7E293119BE9F60732988393C99795A03DB827`
- baseline_git_commit: `ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b`
- agent_role: `developer-primary-b06`
- completion_report_path: `docs/completion_reports/B-06_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, B-01~B-05 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-06 acceptance, B-07, FastAPI/BFF/UI, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. optimistic version의 framework-neutral conflict까지만 구현하고 HTTP 409 route mapping은 B-11에 남긴다. WSL을 사용하는 경우 Anvil 전용 격리 PostgreSQL 자원만 생성·검증·삭제하고, 실제 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
