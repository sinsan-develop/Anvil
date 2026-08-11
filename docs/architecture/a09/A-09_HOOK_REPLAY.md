# A-09 Hook Catalog · Replay

`STATIC_ONLY`; `AV-LRN-018`, `AV-LRN-024`, owner `D-12`, `RUNTIME_DEFERRED / NOT_EXECUTED`. Skill activation NOT_EXECUTED, Hook activation NOT_EXECUTED.

Hook은 Event→Matcher→Program→Result/Fault Policy 계약이다. definition hash trust와 program hash·permission profile·principal trust를 별도 결박하고 어느 hash든 바뀌면 trust를 무효화한다.

SHADOW는 side effect가 없고 PILOT은 동일 input replay를 요구한다. Replay에는 actual Run/Event input, matched hooks, masked input, 각 result, deny reason, program output hash, timeout policy, audit ref, `next_action`이 보인다. 모든 matching Hook을 평가하며 precedence는 deny>ask>modify>allow다. modify 충돌은 자동 병합하지 않고 차단한다. recursion depth는 1, Hook의 Subagent spawn은 금지한다.
