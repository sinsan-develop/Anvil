# B-01 Domain Core Validation

- assigned: `AV-STAT-001`, `AV-STAT-002`, `AV-STAT-003`
- environment: `ENV-LOCAL`
- evidence class: `UNIT_TEST / FRAMEWORK_INDEPENDENT_DOMAIN_CORE`
- runtime boundary: API·DB·UI·Provider·WSL·production·deploy `NOT_EXECUTED`

## TDD evidence

RED:

```text
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/domain -p 'test_*.py' -v
```

Exit `1`: 세 test module 모두 `packages.domain.identifiers/events` 부재로 import error였다.

GREEN: 같은 focused 명령은 `12/12 PASS`, exit `0`이다. §27.1 정상 전이 11건과 각 필수 산출물, §27.2 차단 코드 9건, invalid ID, closed enum, duplicate·reverse sequence, undefined transition, condition/artifact 누락, RELEASE same-target·필수 ProductValidation·blocking defect 0·인증된 사람 결정, immutable Event/State/payload, framework import 금지를 table-driven test로 검증했다.

## 회귀 경계

전체 tooling은 `282 total / 272 pass / 10 fail`이다. A-13 successor 4건과 project-progress 6건은 Developer exact11 dirty diff를 Main start repository projection과 동일시하는 기존 projection 검증이며, domain test failure는 0이다. G-07과 Phase G standalone checker는 PASS했다. 이 결과를 full PASS로 승격하지 않는다.

실제 persistence, API, Event Store, UI와 distributed runtime은 B-01 검증 범위가 아니다.
