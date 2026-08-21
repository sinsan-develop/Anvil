# B-12 R2 InvocationPrompt

- invocation_id: `INV-B-12-20260821-002`
- work_instruction_id: `WI-B-12-20260821-002`
- work_instruction_sha256: `476D2A7EAE064F25EDF479F3D66BB6F64DFAFFB38D49430BF26BD38E92A0BAB2`
- baseline_git_commit: `e29ffcfc6e401af43bdb2672fd0817252792d652`
- source_tester_report_sha256: `224CC87D40496A09765551A317413832039C4BDBA2B67C22AC37C6E05681AF91`
- agent_role: `developer-primary-b12`
- completion_report_path: `docs/completion_reports/B-12_COMPLETION_REPORT.md`

위 ID/hash의 R2 WorkInstruction대로 test-first 수행하라. report, epoch-2 fencing token과 exact10을 먼저 확인하고 durable PostgreSQL adapter, process-linked FI-07, actual send-boundary FI-05/06의 부재를 RED로 재현한 뒤 최소 구현한다. 종료 후 in-memory reseed나 enum 반복을 실제 장애주입 증거로 사용하지 않는다. R1 exact15 밖을 수정하거나 B-12 acceptance, B Gate, C-01, shared DB, WSL staging, ysna, production, deployment를 시작하지 않는다. 실행하지 못한 runtime과 잔여 위험은 정확히 보고한다.
