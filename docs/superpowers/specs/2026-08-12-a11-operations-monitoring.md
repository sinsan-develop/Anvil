# A-11 Operations·Monitoring 정적 계약

## 목적과 경계

Operations Dashboard, Queue, Worker/Lease, Provider/Backend Health, Alert, Budget/Quota, Deployment Monitoring을 정적 UI·artifact 계약으로 확정해 시스템이 이상을 먼저 감지하고 원인·영향·다음 조치를 보여주게 한다.

- assigned: `AV-OPS-002`
- verdict: `STATIC_CONTRACT_PASS`
- actual L4/FI/E-SHOT and queue/worker/provider/budget/deployment runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- canonical runtime owner: `F-13`

## 핵심 계약

- Operations Overview는 DB, Queue, Worker, LLM Providers, Execution Backends, Artifact Store의 상태·관측 시각·stale 기준·원인·영향·evidence·deep link·next action을 표시한다. 성공률은 기간·표본·PASS/SKIPPED 구성을 함께 보여준다.
- Alert는 detector/rule revision/threshold/observed value로 system-detected를 증명하고, dedupe key와 `open|acknowledged|resolved`를 분리한다. acknowledge는 resolve가 아니며 resolve에는 검증 evidence가 필요하다.
- Queue는 priority, dependency, attempt/max, retry/backoff, visible time, lease epoch/DB time/masked token ref, quarantine/DLQ와 next action을 표시한다. stale token·무한 retry·poison job silent drop을 허용하지 않는다.
- Worker는 capability/current work/heartbeat `HEALTHY|LATE|EXPIRED`, worker/write lease epoch·expiry·conflict scope, drain requested/draining/drained, checkpoint·receipt를 분리한다.
- Budget은 `FORECAST→RESERVED→PROVIDER_REQUESTED→FINAL_USAGE_RECORDED→RECONCILED→REMAINDER_RELEASED` 순서를 보존한다. 예약 실패 후 Provider call, unknown usage=0, quota=FAILED 승격을 금지한다.
- Deployment는 `PENDING→APPROVED→DEPLOYING→SMOKE_TEST→MONITORING→RELEASED|ROLLBACK_REQUIRED→ROLLING_BACK→ROLLED_BACK|BLOCKED`를 보존한다. smoke PASS만으로 RELEASED가 되지 않으며 monitoring window, critical alert 0, Owner 확인이 필요하다.
- health, alert, queue, Run, deployment 상태는 서로 다른 enum이다. force-success control과 raw fencing token, secret, endpoint, unbounded log는 금지한다.

## 화면과 검증

Operations Overview, Queue, Worker/Lease, Provider/Backend, Alert Center, Budget/Quota, Deployment Monitoring, Audit/Details Drawer를 catalog·focused Markdown·1920×1080 SVG로 표현한다. Checker와 hostile fixtures는 stale signal, anomaly evidence, dedupe/ack/resolve, fencing, quarantine, reservation/reconcile, provider drift, deployment monitoring/rollback, permission·sensitive disclosure·static promotion·manifest integrity를 fail-closed 검증한다.

No actual queue claim, worker control, provider probe, budget reservation, alert mutation, deployment, API/DB/Event/SSE/browser/network. DIR is not reached at A-11.
