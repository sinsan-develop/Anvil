# D-13 WorkInstruction — 전체 학습·source revoke E2E

## 1. 식별·권위

- Work Package: `D-13`; 선행: `D-01~D-12 ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 48.9, 49.9, 49.17-13; 작업계획 D-13
- 검증: `AV-LRN-013`, `AV-LRN-025`, `AV-FLOW-018`, `AV-FLOW-022`, `AV-STAT-042(DIR-X trigger)`
- 구현자: `developer-primary-d13-r1`

## 2. 목표

가르친 코드와 완료 Run에서 학습 후보를 만들고, 승인 전 행동 불변·승인 후 다음 Task 적용·필요한 ExampleReference만 지연 로드·source revoke 영향 격리·rollback·무변경 review까지 D-01~D-12의 실제 in-memory 계약으로 재현한다. D-12 Learning Journey에서 전체 provenance를 다시 조회하고, D Gate 직후 조건부 `DIRX-LRN-CRITICAL` 발생 여부를 결정적 결과로 제공한다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/learning_e2e.py`
- `packages/api/learning_e2e.py`
- `tests/knowledge/test_learning_e2e_d13.py`
- `tests/api/test_learning_e2e_d13.py`
- `docs/04_test_reports/D-13_COMPLETION_REPORT.md`

## 4. 필수 계약

1. 동일 principal/context/scope의 D-01~D-12 repository와 authority만 조합한다. 요청 payload가 approval, activation, source 상태, 검증 severity 또는 DIR-X를 자가 부여할 수 없다.
2. taught code와 terminal completed Run은 source hash·commit/target·review·final diff evidence에 결박된 candidate만 만든다. terminal review는 candidate 또는 명시적 no-change reason을 정확히 하나 남긴다.
3. 사용자 교정 candidate 생성 전후의 현재 Task/Run snapshot·선택·결과는 동일해야 한다. 승인과 activation 전에는 Skill/Hook/Prompt/Memory 행동이 바뀌지 않는다.
4. 승인된 학습은 진행 중 snapshot을 바꾸지 않고 다음 Task의 새 LearningSnapshot부터 적용한다. provenance는 source→review→candidate→evaluation→approval→activation→next-task snapshot→선택→사용을 exact hash로 연결하고 선택된 Skill/Hook/Prompt revision을 구분한다.
5. 승인된 final diff는 다음 유사 작업에서 source/target hash로 검색한다. 선택된 항목에 필요한 `ExampleReference`만 로드하고 관련 없는 reference 본문은 로드하지 않는다. 검증 실패·미승인 diff는 positive exemplar가 될 수 없다.
6. source revoke 또는 license/security 상태 변경 뒤 신규 Task는 파생 Memory/Skill/Hook/Prompt 사용을 차단한다. 이미 진행 중인 Run snapshot은 불변으로 격리하고 affected run·파생 항목·다음 안전 행동을 보고한다.
7. rollback은 활성 version을 baseline으로 되돌리고 해당 version을 선택·사용한 Task/Run을 추적한다. rollback 뒤 같은 입력은 baseline 결과로 복귀하며 rollback된 항목의 신규 사용은 차단한다.
8. no-change terminal Run은 이유와 evidence를 남기되 candidate/activation을 만들지 않는다. 중복 request/replay는 멱등이고 다른 target/context의 evidence는 거부한다.
9. D-12 Learning Journey query/lineage로 전체 E2E provenance와 revoke/quarantine/rollback을 재확인한다. 실제 프로그램·Hook·Provider 실행을 발명하거나 fixture 결과를 운영 PASS로 승격하지 않는다.
10. 조건부 DIR-X 판정은 **동일 검증 target hash**에서 `AV-LRN-003`, `AV-LRN-004`, `AV-LRN-005` 중 하나의 확정 `CRITICAL` 실패가 있을 때만 `DIRX-LRN-CRITICAL`을 한 번 산출한다. 다른 ID, 다른 hash, 미확정·MAJOR 이하, 중복 입력은 trigger하지 않는다. 실제 D Gate Event/hold는 Main control이 소유한다.
11. API는 authenticated in-process E2E 실행/조회 adapter이며 authority object와 canonical fixture를 host가 주입한다. caller가 source/candidate/approval/verification/DIR 상태를 직접 제출하는 endpoint는 제공하지 않는다.
12. 실제 UI/browser/DB/HTTP/Provider/OS program/WSL/Docker/deployment와 durable process restart는 `NOT_EXECUTED`; runtime consumer 연결은 `NOT_INTEGRATED`로 명시한다.

## 5. 검증·보고

- 후보 생성→승인→다음 Task 적용→필요 ExampleReference 로드→source revoke 격리→rollback→무변경 review 전체 E2E
- 승인 전 동일 입력 행동 불변, 현재 snapshot 불변, 다음 Task 적용 provenance
- failed/unapproved exemplar 제외, foreign target/context/hash drift, duplicate replay, revoke/rollback 적대 검증
- DIR-X trigger/dedupe와 비대상 ID·다른 hash·비 CRITICAL·미확정 no-trigger
- D-12 Journey lineage와 민감 원문 비노출
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check

## 6. 완료 후

Main 독립 검토 후 D Gate를 판정한다. `DIRX-LRN-CRITICAL` 조건이 실제로 성립하면 Gate 직후 `DIR_HOLD`로 중단·보고하고, 성립하지 않으면 Phase E를 자동 시작한다.
