# A-07 Execution Control 정적 계약

## 목적과 경계

Execution Control, Task Graph, Agent Drawer, Exception Inbox, Recovery, Fencing/Budget, Takeover, DIR Panel을 정적 화면·state·guard 계약으로 확정한다. `AV-AGT-029`의 A-07 static slice만 `STATIC_CONTRACT_PASS`; 실제 L4/AE/E-SHOT과 Agent runtime은 `NOT_EXECUTED`다.

## surfaces

- Execution Control: run/WI/plan/mode hashes, phase와 run status 분리, strategy/failure policy/concurrency, budget reserved/consumed/forecast, checkpoint/event, safe controls.
- Task Graph: exact node/edge/dependency/hash/path/capability/lease/budget/result contract and canonical StepState.
- Agent Drawer: role/scope/permissions/provider/model/token+cost/status/action/heartbeat/worker+write lease/checkpoint/evidence/stop.
- Exception Inbox: class/severity/fingerprint/valid count/dependents/evidence/default transition/retry/reason/next action.
- Recovery: checkpoint/hash/event, workspace/lease/side-effect reconciliation, reusable/stale/rerun, safe resume guards.
- Fencing/Budget: worker/write epoch and masked token refs, conflict scope, heartbeat/expiry; reservation/usage/release/reconcile/hard limit.
- Takeover: same lineage+fingerprint valid count, third failure or human override, lease/tool revocation, packet and actor transition.
- DIR Panel: DIR_HOLD/REPORTING/WAITING_OWNER_DIRECTION/CLEARED and verdict kept separate; no auto resume.

## safety

No mutation without worker+write leases; stale token commit rejected. Failed dependency cannot run. Independent failure cannot yield overall success. Stop blocks new action; resume requires exact checkpoint/hash/side-effect reconciliation/no duplicate execution. Budget reservation precedes provider request. Invalid/quota/environment failure is not counted for takeover. Actual DIR occurs only after A-15, not A-07.

## artifacts

Catalog, four focused Markdown contracts, three 1920×1080 SVGs, checker/test/fixtures, validation, evidence manifest, completion report. Hostile tests cover states, DAG, leases, heartbeat, budget, failures/takeover, recovery, DIR, permissions, predecessor/static qualifier, secrets, manifest integrity.

No apps/packages/dependency/API/DB/browser/Agent runtime/deploy mutation.
