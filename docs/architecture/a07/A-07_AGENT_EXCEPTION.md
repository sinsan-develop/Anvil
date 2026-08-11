# A-07 Agent Drawer · Exception Inbox 계약

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `AV-AGT-029` L4/AE/E-SHOT runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`, actual DIR NOT_EXECUTED다.

Agent Drawer는 role, scope, permissions, provider/model, token/cost, status/action, heartbeat, worker/write lease, checkpoint, evidence, authorized stop을 한 화면에서 보인다. token과 secret은 원문이 아닌 masked reference만 허용한다. 권한 없는 stop은 disabled이고 `reason`과 `next_action`을 표시한다. Stop 이후 새 action은 금지된다.

Exception Inbox는 class/severity, lineage/fingerprint, 유효 실패 횟수, dependents, evidence, default transition, retry, reason/next action을 구분한다. `INCOMPLETE`, `BLOCKED`, quota, environment, tool interruption, cancelled는 유효 실패에 더하지 않는다. 동일 lineage와 fingerprint의 완전한 FAILURE_REPORT만 집계한다.

