# D-09 WorkInstruction — Hook Event·Matcher·Program·Fault Policy registry

## 1. 식별·권위
- Work Package: `D-09`; 선행: `D-Skill Gate ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 46.4~46.4.3, 48.9; 작업계획 D-09
- 검증: `AV-LRN-019`, `AV-LRN-021`, `AV-LRN-023`, `AV-SAFE-026`; 구현자: `developer-primary-d09-r1`

## 2. 목표
반복 수동 검사와 D-05/D-06 학습 계보에서 Hook 후보를 생성하고, Hook을 조언문이 아닌 immutable
`Event → Matcher → Program → Result/Fault Policy` 결정론적 계약으로 저장·조회한다. version/hash, source evidence,
permission, timeout, idempotency, recursion, trust 경계를 고정하고 matcher 평가 및 다중 결과 병합 규칙을 제공하되 프로그램은 실행하지 않는다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/hooks.py`
- `packages/api/hooks.py`
- `tests/knowledge/test_hooks_d09.py`
- `tests/api/test_hooks_d09.py`
- `docs/04_test_reports/D-09_COMPLETION_REPORT.md`

## 4. 필수 계약
1. 표준 Event enum, 허용 result enum과 Event별 허용 결과를 강제한다. 정의는 hook id/version/scope/status,
   matcher, program id/type/entrypoint/hash/timeout, permissions, failure policy, idempotency, recursion guard, source provenance를 가진다.
2. Hook definition과 program version/hash/trust identity를 분리한다. 어느 hash든 바뀌면 같은 version 재사용과 기존 trust 재사용을 거부한다.
3. candidate는 반복 수동 검사·객관적 누락/위반·항상 실행되는 Skill 단계·반복 command·재발 방지 deterministic test 중
   host가 확인한 최소 2개 독립 관찰과 D-05 review/D-06 source evidence에 결박한다. payload self-attestation을 허용하지 않는다.
4. action은 `create_rule | create_program_and_rule | patch_matcher | upgrade_program | split | merge | quarantine | retire`만 허용하고
   before/after shape와 target identity를 결정론적으로 검증한다.
5. Matcher는 schema가 허용한 exact field/operator만 정규화해 평가한다. unknown field/operator, 비결정 함수, LLM/시간/random/network 의존,
   path prefix 혼동, malformed glob/regex, payload type drift는 fail closed한다.
6. Program registry는 초기 command Hook만 정식 허용하며 source/dependency/artifact/signature hash, structured output schema,
   timeout, read-only filesystem/network deny 기본값을 기록한다. 실제 command/script/LLM/Agent 실행은 D-10 범위다.
7. failure policy는 `fail_open | fail_closed`와 timeout/error별 허용 결과를 정의하고 registry/API/audit projection에서 동일해야 한다.
   fail_closed timeout/error는 deny, fail_open은 warning/log로 결정론적으로 투영한다.
8. matching Hook은 모두 평가 대상으로 반환하며 managed 우선 순서는 오직 결정론적 ordering에 사용한다.
   결과 병합 우선순위는 `deny > ask > modify > allow`; 하나라도 deny이면 최종 deny다. 서로 다른 modify 충돌은 `HOOK_MODIFY_CONFLICT` deny다.
9. 동일 Event 내 정의 간 실행 순서 의존성을 허용하지 않고 canonical ordering/hash를 사용한다. recursion_guard=true, max depth 1,
   idempotency required를 definition 단계에서 강제한다.
10. 상태는 candidate/registered/shadow/pilot/trust/active/quarantined/retired를 표현하되 D-09는 새 프로그램을 실행·활성화하지 않는다.
    activation/trusted_auto/shadow/pilot/sandbox/quarantine 실행은 D-10 소유다.
11. API는 candidate/register/version/query/match/merge/fault-projection의 authenticated host-context adapter만 제공하며
    raw actor/source/trust/approval/result authority를 body에서 받지 않는다.
12. 실제 filesystem program, process, Hook 실행, DB/HTTP/browser/deployment는 범위 밖이며 NOT_EXECUTED로 기록한다.

## 5. 검증·보고
- immutable definition/program version/hash, action shape, provenance/반복 관찰, self-claim 차단
- Event/result matrix, exact matcher 정상/적대 입력, stable order/hash
- deny 우선, modify conflict deny, fail-open/closed timeout/error projection과 audit 일치
- recursion/idempotency/command-only/read-only/network-deny 기본 계약
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check
- 실제 Hook/program/process/DB/HTTP/browser/deployment는 미실행

## 6. 완료 후
Main 독립 검토 전 ACCEPTED가 아니며 D-10을 시작하지 않는다.
