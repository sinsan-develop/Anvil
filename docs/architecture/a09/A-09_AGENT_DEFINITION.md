# A-09 AgentDefinition Catalog

`STATIC_ONLY`; `AV-LRN-018`, `AV-LRN-024`, owner `D-12`, `RUNTIME_DEFERRED / NOT_EXECUTED`. Skill activation NOT_EXECUTED, Hook activation NOT_EXECUTED.

AgentDefinition과 active Agent instance를 구분한다. 자식 permission은 parent에서 `inherit_and_narrow`만 허용하고 effective permission diff, denied action reason, `next_action`을 표시한다. 확장은 새 승인·definition version 없이는 불가하다.

persistent memory 기본값은 none이다. actual Run에는 frozen AgentDefinition/Skill/Hook snapshot ref만 기록하고 secret literal은 노출하지 않는다. Hook은 Subagent를 생성할 수 없다.
