# A-09 Skill Catalog · Selection Trace

`STATIC_ONLY`; `AV-LRN-018`, `AV-LRN-024`, owner `D-12`, `RUNTIME_DEFERRED / NOT_EXECUTED`. Skill activation NOT_EXECUTED, Hook activation NOT_EXECUTED.

Skill lifecycle은 DRAFT→PILOT→ACTIVE→DEPRECATED→ARCHIVED다. 신규 Skill은 서로 다른 대표 작업 3개, reproducibility, permission·secret scan, 사람 승인을 통과해야 한다.

Selection Trace는 actual Run, matched evidence, 선택 version/hash, reason, rejected candidates와 이유, loaded resources, precondition 결과, 최종 result/`next_action`을 표시한다. Progressive disclosure는 L0 catalog match 후 선택된 L1 전체 SKILL만, reference는 필요한 L2만 읽는다. 미선택 Skill은 로드하지 않는다.
