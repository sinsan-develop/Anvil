# D-04 WorkInstruction — CodePattern·ExampleReference·AntiPattern 추출·조회

## 1. 식별·권위

- Work Package: `D-04`
- 선행: `D-03 ACCEPTED`
- 기준 문서: `Anvil_설계서_v2.md` 36.14~36.15, 47.12, 48.7~48.9, 49.9
- 작업계획: `Anvil_작업계획서_v1.md` D-04
- 검증 ID: `AV-LRN-008`, `AV-LRN-009`
- 구현자: `developer-primary-d04-r1`

## 2. 목표

D-03의 immutable LearningSource에서 재사용 가능한 `CodePattern`, 필요할 때만 읽는 `ExampleReference`, 실패 재발을
막는 `AntiPattern`을 versioned artifact로 추출·조회한다. 검증되지 않은 자체 생성 코드, 실패·거부된 결과, 기밀·license
계보가 불명확한 원문은 positive exemplar가 되지 않도록 fail-closed한다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/patterns.py`
- `packages/api/knowledge_patterns.py`
- `tests/knowledge/test_patterns_d04.py`
- `tests/api/test_knowledge_patterns_d04.py`
- `docs/04_test_reports/D-04_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 통제 파일과 D-01~D-03 구현은 수정하지 않는다.

## 4. 필수 계약

1. D-03 repository가 확인한 exact source ID/version/record hash, REGISTERED 상태, scope/confidentiality/license/ownership,
   activation eligibility를 source provenance로 고정한다. source revoke/quarantine 또는 hash/version mismatch는 신규 추출·조회 사용을 차단한다.
2. `CodePattern`은 intent, languages/frameworks, problem signals, preconditions, procedure, tradeoffs, prohibitions,
   failure conditions, verification refs, example refs, target scope와 source provenance를 가진 immutable version이다.
3. `ExampleReference`는 repository/document/run locator, commit/revision, path/symbol/range, purpose와 최소 excerpt hash만
   보존한다. 전체 source body를 정본·검색 projection·오류에 넣지 않고, 선택된 pattern에서 명시적으로 요청할 때만 reference를 로드한다.
4. `AntiPattern`은 failed approach, recurrence conditions, detection signals, impact, safer alternative, verification과 source
   provenance를 가진다. 실패 결과를 positive CodePattern/ExampleReference로 승격하지 않는다.
5. positive artifact 생성은 source quality=`VERIFIED`, 보안/license eligibility, 승인된 최종 artifact hash, 필수 test/gate
   `PASS`, 결과 `ACCEPTED | SUCCEEDED` 증거가 모두 있을 때만 허용한다. `SKIPPED/BLOCKED/ERROR/FAILED/REJECTED`, 사용자
   미검증 자료, 자체 생성 미검증 코드는 positive exemplar가 될 수 없다.
6. 실패·거부·미검증 source는 근거가 있을 때 `AntiPattern` 후보만 만들 수 있으며, 그 자체를 성공 예시로 검색하지 않는다.
7. extract payload는 host가 발급한 source/evidence attestation과 exact digest에 결박한다. payload가 actor, source status,
   quality, approval, gate result, scope/license를 자가 부여할 수 없다.
8. 동일 artifact ID는 증가 version·previous hash를 사용한다. input order/alias가 정본 hash를 바꾸지 않고, identity/version
   재결박, stale expected version, replay/concurrent duplicate는 fail-closed다.
9. 검색은 metadata만 반환하며 intent/language/framework/risk/scope/source status에 맞는 항목만 deterministic rank한다.
   암시 호출로 전체 reference/body를 로드하지 않는다. 명시적 load-reference에서만 해당 reference projection을 반환한다.
10. source confidentiality/license/exclusions/scope는 pattern/reference/anti-pattern과 조회 결과까지 축소 없이 상속한다.
    private source를 다른 project/user scope로 확대하거나 license 불명확 원문을 reference로 활성화하지 않는다.
11. API adapter는 authenticated host context에 결박된 extract/search/get/load-reference를 제공하며 raw evidence/body,
    authority 필드를 payload로 받지 않는다.
12. 실제 AST·repository/file fetch, LLM extraction, 후보 승인·activation·rollback, DB/HTTP persistence는 후속 D-06/U 범위다.

## 5. TDD·적대 검증

- 검증된 code/document/completed-run source에서 deterministic pattern/reference/anti-pattern 생성
- failed/rejected/unverified/self-generated source의 positive exemplar·reference 차단
- gate PASS 위조, source hash/version 재결박, scope/license/confidentiality 축소·확대 우회 차단
- metadata search가 raw body/reference를 로드하지 않고 명시적 load만 최소 reference 반환
- source revoke/quarantine 후 신규 추출과 reference load 차단, 과거 artifact provenance 보존
- mutable alias, version gap/rollback, stale/replay/concurrent duplicate fail-closed
- API authority 자가부여와 민감값 projection 차단

## 6. 검증·보고

- focused: D-04 두 test 파일
- 관련 `tests/knowledge tests/api` 회귀
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 실제 DB/HTTP/browser/Provider/network/WSL/Docker/deployment는 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 구조화 결과 계약으로 보고한다. Main 독립 검토 전 D-04는 ACCEPTED가 아니며 D-05를 시작하지 않는다.
