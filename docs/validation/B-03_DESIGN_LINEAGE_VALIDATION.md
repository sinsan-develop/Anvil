# B-03 Design Lineage Validation

- package: `B-03`
- baseline: `8f65b3e32aa9a45e18879aedca6add424df2ce2c`
- WorkInstruction SHA-256: `A80E618ECA15E184ADB5DBFB7E079C3B42A474A9FE8F566D7EFE7A0C6D13E023`
- assigned: `AV-FLOW-001`, `AV-FLOW-002`
- result: `COMPLETED_PENDING_INDEPENDENT_TEST`

## TDD와 정적 계약

첫 RED는 `packages.design`과 `packages.api`가 없어 design 4개 test module import가 모두 실패한 exit 1이었다. 최소 구현 뒤 design `8/8 PASS`; 다른 ProposalSet의 결정이 baseline에 혼입되는 hostile test는 exit 1로 재현 후 proposal lineage별 선택으로 수정했다. E-AUD가 빠진 hostile test도 `audit_events` 부재로 exit 1을 확인한 뒤 ordered, immutable, actor/UTC-bound audit lineage를 추가했다. security review에서 API/intent 입력 검증 RED `2/2 FAIL`을 확인하고 canonical non-empty/hash guard를 추가했다. 최종 design은 `11/11 PASS`다.

root human approval 누락·비인증 사용자·agent approval, 승인 revision 제자리 변경, scope 확대, semantic-risk 오분류, parent/root/old-new hash 불일치, unrelated decision 혼입을 fail-closed로 거부한다. `DEFERRED`와 `FOLLOW_UP_EXTENSION`은 target을 가진 CarryoverItem으로 보존한다. API는 framework-neutral DTO이며 route/auth/BFF는 B-11까지 구현하지 않는다.

## 회귀와 검증 경계

- domain: `14/14 PASS`, exit 0
- persistence: `7/7 PASS`, exit 0
- tooling: `272/282 PASS`, exit 1. 10건은 exact15 dirty 상태의 A13 evidence projection 4건과 project `GIT_DESCENDANT_WORKTREE_DIRTY` 6건이다.
- standalone A13/project: 위와 같은 dirty projection으로 exit 1
- standalone G-07/Phase G: exit 0 PASS
- `py_compile`, `git diff --check`: exit 0

`AV-FLOW-002`의 E-ART/E-AUD는 local domain/service test로 검증했다. 그러나 실행 가능한 local UI/API가 없으므로 `AV-FLOW-001`의 실제 L4+L7 E-SHOT/E-EVT는 `NOT_EXECUTED`이며 정적 PASS로 승격하지 않는다. 실제 DB migration, API, UI/browser, provider, WSL/shared/production, deployment도 `NOT_EXECUTED`다.
