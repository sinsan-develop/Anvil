# D-01 WorkInstruction — USER/MEMORY bounded curated store

## 1. 식별·권위

- Work Package: `D-01`
- 선행: `C Gate ACCEPTED`, `DIR-2 CLEARED`
- 기준 문서: `Anvil_설계서_v2.md` 12장, 36.1~36.7, 49.9, 48장
- 작업계획: `Anvil_작업계획서_v1.md` D-01
- 검증 ID: `AV-LRN-001`
- 구현자: `developer-primary-d01-r1`

## 2. 목표

USER와 MEMORY를 물리·논리 scope가 분리된 curated entry로 저장하고 조회한다. 각 항목의 source, scope,
evidence, confidence, version/hash, 생성·검증·만료 시각을 보존하며, 상위 instruction과 충돌하거나 capacity를
초과하거나 만료된 항목이 실행 context에 주입되지 않도록 fail-closed로 판정한다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/memory.py`
- `packages/api/knowledge_memory.py`
- `tests/knowledge/test_memory_d01.py`
- `tests/api/test_knowledge_memory_d01.py`
- `docs/04_test_reports/D-01_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 소유 progress/HANDOFF/events/checker/tooling은 수정하지 않는다.

## 4. 필수 계약

1. `USER`와 `MEMORY` store를 구분하고 user-global과 project scope를 혼합하지 않는다.
2. entry는 안정 ID, kind, scope, category, statement, source provenance/evidence, confidence,
   created/last_verified/expires, version, content hash, status를 가진다.
3. source/evidence와 기존 version은 append-only다. 수정은 새 version이며 과거 entry를 덮어쓰지 않는다.
4. 조회 시 현재 시각, user/project scope, status를 적용하고 만료·비활성·다른 project 항목은 제외한다.
5. instruction priority는 `현재 사용자 지시 > DesignBaseline > WorkPlan > WorkInstruction > Project Policy >
   AgentDefinition > Skill/Hook/Prompt > Memory/CodePattern/ExampleReference`다.
6. Memory가 상위 계약과 충돌하면 적용하지 않고 구조화 `LearningConflict`를 기록한다. Memory가 승인 문서를
   변경하거나 우선순위를 역전할 수 없다.
7. 기본 capacity는 USER 500 token-equivalent, MEMORY 800 token-equivalent다. 정확한 결정론적 estimator를
   공개하고 추가 전 simulation한다. 초과 시 자동 truncate/숨은 요약/기존 항목 삭제 없이
   `MEMORY_CAPACITY_EXCEEDED`로 거부하며 current/added/limit을 반환한다.
8. empty/whitespace, 잘못된 enum/scope, evidence 없음, non-aware datetime, expires<=created,
   secret-like 값은 fail-closed로 거부한다. 실제 secret 값을 저장·로그·응답하지 않는다.
9. API-shaped service는 propose/add, version, get/list, resolve-context, conflict/capacity projection을 제공한다.
   실제 HTTP server·DB·파일 시스템은 D-01 범위가 아니며 in-memory deterministic contract로 구현한다.
10. 반환 projection은 내부 mutable alias를 노출하지 않는다.

## 5. TDD·적대 검증

- 정상 USER/MEMORY 저장·조회와 provenance/hash 결정성
- project A/B scope 격리 및 user-global 분리
- expiry 경계와 inactive/replaced version 제외
- 상위 instruction 충돌 8단계 우선순위와 LearningConflict 기록
- capacity exact-boundary 허용, +1 거부, 기존 상태 무변경, truncate 없음
- evidence 누락, naive datetime, invalid scope/category/confidence, secret-like 값 거부
- duplicate/version append-only, 반환 projection mutation이 내부 상태에 영향 없음
- API request replay와 malformed payload가 상태를 바꾸지 않음

## 6. 검증·보고

- focused tests: 위 두 test 파일
- 관련 `packages/knowledge`, `packages/api` 회귀 중 실행 가능한 범위
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 완료보고에는 정확한 명령·exit·변경 파일·미검증·rollback을 기록한다.
- 실제 DB/HTTP/browser/Provider/network/WSL/Docker/deployment를 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 보고한다.
Main 독립 검토 전 D-01은 ACCEPTED가 아니며 D-02를 시작하지 않는다.
