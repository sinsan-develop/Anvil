# F-17 WSL PG15/PG18 scoped acceptance

```json anvil-recovery-summary
{
  "event_sequence": 1491,
  "last_event_id": "evt_f17_1491_main_package_accepted",
  "status": "ACCEPTED",
  "current_phase": "F",
  "current_work_package": "F-17",
  "active_agent": null,
  "worker_lease": null,
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-18",
    "status": "READY_AFTER_F17_MERGE_CLEANUP"
  },
  "next_safe_action": "MERGE_F17_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
  "runtime_next_action": "MERGE_F17_PR_THEN_DELETE_BRANCH_AND_WORKTREE"
}
```

- 판정: F-17 범위 ACCEPTED. AV-OPS-015/025의 최종 Main ProductValidation SUITABLE은 실제 WSL PG15/PG18 동일 Git/image, 핵심 E2E·restart·backup/restore·rollback, 브라우저 Network 및 잔류 0에 한정한다.
- Web-only /auth/session 경로와 전체 UI·ProductValidation API·Provider·ysna/운영·사용자 ReleaseDecision은 미검증. F18 proxy/auth 라우팅 재확인 필수.
- 두 lease를 회수했다. 다음: F17 PR 병합→merged-main smoke→branch/worktree 정리 후 F18.
