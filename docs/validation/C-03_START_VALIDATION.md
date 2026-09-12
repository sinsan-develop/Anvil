# C-03 Start Projection Validation

- seq1~737 raw event object bytes: preserved
- seq738~740 lease/write/package start 순서와 hash chain: validated
- C-02 ACCEPTED, C-03 IN_PROGRESS, C-04 NOT_READY, DIR-2 NOT_REACHED: exact
- WorkInstruction/invocation/design/work-plan/AV-AGT-004 L3 AI E-GIT E-ART: bound
- session 재사용 packet/baseline mismatch, runner session mismatch: fail-closed contract
- segment-aware exact3 path, packages_evil prefix 충돌: rejected contract
- raw freeze non-string key/set/non-finite/non-JSON type: rejected contract
- exact12 staged at base 또는 clean sole direct-child only
- 외부 시스템 및 actual runner: `NOT_EXECUTED`
