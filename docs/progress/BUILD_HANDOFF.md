# F-20/U-01 계약 문서 successor control bootstrap handoff

```json anvil-recovery-summary
{
  "event_sequence": 2105,
  "last_event_id": "evt_f20_2105_write_lease_issued",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-contract-control",
  "worker_lease": "worker-lease-f20-u01-contract-control-4cf54cc2258248d9b1654dfd3f2c4c6d",
  "write_lease": "write-lease-f20-u01-contract-control-bac68713410a4b378b2b44aa800676e1",
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_CONTRACT_CONTROL_EXACT3_BOOTSTRAP",
  "repository_head": "8d5e1bda081e1e9aa864259d522646d4ff3149df",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- PMO 조건부 비제품 bootstrap이다. seq2103 WI→2104 worker→2105 write lease를 append-only로 기록했으며 Developer의 코드 허용 경로는 `scripts/check_project_progress.py`, `scripts/f20_u01_contract_successor_overlay.py`, `tests/tooling/test_f20_u01_contract_successor_projection.py` 세 곳뿐이다. 제품 scope는 비어 있고 Main은 세 경로를 수정하지 않는다.
- R48 frozen checker의 현재 `R48_CLOSE_GIT_INVALID`는 미해결이며 PASS가 아니다. 새 successor 검증·음성 시험·seq2106~2108 회수·최종 G-05 PASS·독립 C0/I0·clean/remote equality 전에는 private push 또는 새 제품 작업을 하지 않는다. R48 과거 Event/hash는 동결, F-20/U-01 미수락, C30 `OPEN_BLOCKING`, Release `DEFER`, Production `NOT_EXECUTED`.
