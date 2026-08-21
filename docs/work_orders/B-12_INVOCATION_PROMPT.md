# B-12 InvocationPrompt

- invocation_id: `INV-B-12-20260821-001`
- work_instruction_id: `WI-B-12-20260821-001`
- work_instruction_sha256: `C588069F8F735DF32AC908F3E2F27F9BE5D2E6E18E0C2F67CBAF36202BA4C3EE`
- baseline_git_commit: `370a39436c4b15a84483017583a9fe3878652504`
- agent_role: `developer-primary-b12`
- completion_report_path: `docs/completion_reports/B-12_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. B-11 acceptance, epoch-1 worker/write fencing token과 exact15 allowlist를 먼저 확인하고 process/PC 종료 reconcile·resume, Action receipt 분류, stale fencing, revoked Secret·capability snapshot drift 차단과 recovery 공통 API만 구현한다. 상세 요구를 복제하지 않으며 B-12 acceptance, B Gate 판정, C-01 Agent/provider kernel, 실제 메뉴 UI, shared DB/WSL/ysna/production/deploy를 시작하거나 완료로 기록하지 않는다. 실제·simulation·미실행 evidence를 구분한다.
