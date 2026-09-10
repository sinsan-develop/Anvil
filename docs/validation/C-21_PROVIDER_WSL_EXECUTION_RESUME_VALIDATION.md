# C-21 Provider WSL execution-resume 검증 계약

1. seq1~533 raw event prefix와 `d442d4584516e1a673fd2edde55a2fe1330e9394`의 progress/event Git blob을 보존한다.
2. seq534~536은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED` 순서다.
3. K는 d442d458의 유일한 single-parent direct child이며 변경 경로는 exact14다.
4. validated base 대비 누적 경로는 exact117이다.
5. branch, upstream, origin ref, candidate ref, manifest raw checksum, derived binding checksum, WorkInstruction blob을 fail-closed로 검증한다.
6. K commit과 Main exact binding 전 runtime 호출은 거부한다.
7. 실제 Provider·Telegram·WSL·Docker·DB·ysna·main은 이 단계에서 실행하지 않는다.
