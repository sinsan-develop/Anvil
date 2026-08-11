# A-11 Operations Monitoring Validation

## 정적 검증 범위

`AV-OPS-002`는 system detector evidence와 cause, impact, next action, deep link를 가진 Operations 정적 계약으로 검증한다. health stale, alert dedupe/ack/resolve, queue·worker/write fencing, quarantine, budget reserve/reconcile, provider drift, deployment monitoring/Owner guard, enum·permission 분리, sensitive masking, predecessor 및 EvidenceManifest 무결성을 checker와 hostile mutation fixture로 fail-closed 검증한다.

## 제외 범위

결과는 `STATIC_ONLY / STATIC_CONTRACT_PASS`다. 실제 queue, worker, provider, budget, alert, deployment, API, DB, Event, SSE, browser, network, runtime 및 DIR은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 runtime owner는 `F-13`이다.
