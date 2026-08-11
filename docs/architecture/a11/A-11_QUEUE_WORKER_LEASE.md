# Queue · Worker · Lease

Queue는 priority, dependency, attempt/max, retry/backoff, visible time, lease epoch와 masked token reference, quarantine/DLQ, next action을 표현한다. stale worker/write fencing은 거부하고, max attempt를 넘긴 poison job은 silent drop하지 않는다. Worker heartbeat와 drain, checkpoint/receipt, worker/write lease는 별도 상태다.
