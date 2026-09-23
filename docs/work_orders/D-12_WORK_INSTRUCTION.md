# D-12 WorkInstruction — Learning Studio·Skills·Hooks·Journey read model/API

## 1. 식별·권위
- Work Package: `D-12`; 선행: `D-01~D-11 ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 36.14, 46.12, 46.17, 48.9; 작업계획 D-12
- 검증: `AV-LRN-018`, `AV-LRN-024`; 구현자: `developer-primary-d12-r1`

## 2. 목표
D-01~D-11의 authoritative sidecar를 mutation 없이 조회해 Learning Studio, Skills, Hooks, Learning Journey용 read model과
authenticated API를 제공한다. source→candidate→평가→승인→활성→적용 Run→quarantine/rollback 계보를 exact reference/hash로
재구성하고, 사용자는 Skill 선택 이유와 Hook 차단 입력·결정·fault policy를 재현할 수 있어야 한다. 실제 Knowledge/Agents 화면은
U-07~U-08 소유이며 이번 Package는 menu projection contract만 구현한다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/learning_journey.py`
- `packages/api/learning_journey.py`
- `tests/knowledge/test_learning_journey_d12.py`
- `tests/api/test_learning_journey_d12.py`
- `docs/04_test_reports/D-12_COMPLETION_REPORT.md`

## 4. 필수 계약
1. read model은 인증된 동일 principal/context/scope의 D-01~D-11 repository 객체만 조합하며 payload가 상태·승인·적용·rollback을 자가 부여할 수 없다.
2. source, review, pattern, candidate, Memory, Skill, Skill evolution, Hook definition/runtime, Prompt/Model/routing의 immutable id/version/hash와
   provenance edge를 보존한다. 누락·foreign context·dangling edge·hash drift·cycle은 fail-closed 한다.
3. Learning Journey는 source→review→candidate→evaluation→approval/trust→activation→Task/Run selection/application→quarantine/rollback의
   시간순 Event와 previous hash를 제공한다. 실행하지 않은 단계는 `NOT_EXECUTED|NOT_INTEGRATED|PENDING`으로 표시하며 PASS로 승격하지 않는다.
4. Skill projection은 선택된 version/hash, explicit/implicit trigger, matched input facts, exclusions, source roots, activation/trust,
   next-run LearningSnapshot, 실제 적용 Run과 rollback 상태를 반환해 “왜 선택됐는지”를 설명한다. selection receipt 없는 사용 주장은 금지한다.
5. Hook projection은 Event/Matcher/Program/Fault Policy exact version/hash, matcher trace, redacted input identity/hash, merge decision,
   allow/deny/ask/modify, warning/log, recursion/idempotency receipt, trust/runtime snapshot, quarantine/fallback/rollback/affected runs를 제공한다.
   secret/PII/raw prompt·credential·실제 command/environment는 반환하지 않는다.
6. Hook 재현은 저장된 receipt와 exact registry/runtime snapshot만 사용한 deterministic read-only replay다. 프로그램·Hook을 실행하거나
   원 action을 재호출하지 않으며 hash mismatch, missing evidence, 다른 principal/context는 거부한다.
7. 목록/상세/lineage/replay projection은 canonical stable sort, cursor, bounded limit을 사용하고 동일 snapshot에서 결정적 결과를 반환한다.
   pagination 중 head drift는 snapshot mismatch로 차단한다.
8. menu projection contract는 loading/empty/ready/error/blocked/not_executed를 구분하고 source/evidence/last verified/rollback/next action을 포함한다.
   브라우저 주소·same-origin 화면 구현·실제 screenshot은 포함하지 않는다.
9. API는 read-only query/list/detail/lineage/skill-explanation/hook-replay/menu-projection만 제공한다. mutation/capture/approval/activate/rollback endpoint는 없다.
10. export/import 재시작 복원은 read snapshot/cursor/evidence hash를 보존하고 tamper·stale/foreign authority를 거부한다.
11. 실제 UI/browser/DB/HTTP/Hook program/Provider/WSL/Docker/deployment는 `NOT_EXECUTED`; D-01~D-11 runtime consumer 통합은 `NOT_INTEGRATED`로 구분한다.

## 5. 검증·보고
- 완전한 provenance DAG와 dangling/cycle/hash/context 적대 검증
- Skill selection reason/exclusion/snapshot/application/rollback projection
- Hook blocked input 재현, fault decision·merge·idempotency·quarantine/fallback projection 및 raw secret 비노출
- stable pagination/head drift/menu 상태 계약/API read-only 경계
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check

## 6. 완료 후
Main 독립 검토 후 D-13을 자동 시작한다. 실제 화면·Hook 실행·운영 사용을 검증했다고 표시하지 않는다.
