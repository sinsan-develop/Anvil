# F-20/U-01 계약 문서 successor control 종료 handoff

```json anvil-recovery-summary
{
  "event_sequence": 2108,
  "last_event_id": "evt_f20_2108_worker_lease_revoked",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "main-agent-eoul",
  "worker_lease": null,
  "write_lease": null,
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_CONTRACT_DOCUMENT_SUCCESSOR_RECONCILIATION",
  "repository_head": "8d5e1bda081e1e9aa864259d522646d4ff3149df",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- PMO 조건부 비제품 successor이다. Developer의 코드 허용 경로는 `scripts/check_project_progress.py`, `scripts/f20_u01_contract_successor_overlay.py`, `tests/tooling/test_f20_u01_contract_successor_projection.py` 세 곳뿐이었다. 제품 scope는 비어 있으며 seq2106 handoff→2107 write lease 회수→2108 worker lease 회수로 종료한다.
- 정확한 시험 임시 폴더 하나를 PMO 지시에 따라 owner 실행으로 제거한 후 집중 14건, R48 인접 6건, G-05 seq2105가 모두 PASS였다. 본 종료 투영의 G-05·clean/private 원격 동등성은 후속 commit·push에서 별도로 확인한다. R48 과거 Event/hash는 동결, F-20/U-01 미수락, C30 quarantine 이력과 accepted=false 유지, Release `DEFER`, Production `NOT_EXECUTED`.
