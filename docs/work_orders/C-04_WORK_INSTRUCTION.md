# C-04 WorkInstruction R2 — steer·resume·checkpoint·handoff service/API projection

## 1. 권위와 revision

- WorkInstruction ID: `WI-C-04-STEER-RESUME-R2-20260912-001`
- revision class: `MAIN_RECONFIRMED_NON_SEMANTIC`
- parent human approval: `APPROVAL-20260814-WORKPLAN-V16-001`
- parent approval SHA256: `3DFC292FA2F3A312B64EC8B14B991977643E7FE0F2E39889C8219EE3E9F6C236`
- 이전 WorkInstruction SHA256: `51052949EEDD05C7BCE1307504AB794237F602F21328B1199FC12E6E23185E7B` (`SUPERSEDED_BY_R2`)
- 이전 InvocationPrompt SHA256: `2B5005FBB23921EA466CD8B6174FDFF8D58007BB8E63F7580F6E310B008AE231` (`SUPERSEDED_BY_R2`)
- 기능 범위 변경: `UNCHANGED`
- 요구사항 변경: `UNCHANGED`
- 중요 위험 변경: `UNCHANGED`
- 근거: 기존 C-04 목표를 현재 설계·계획·검증 기준과 exact product path로 명료화하며 범위를 확장하지 않는다.

## 2. 기준선

- base commit: `028765cea128c73fb2404e6cefefce12175cb9f4`
- branch: `codex/c04-steer-resume-r1`
- 설계서 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 통합검증매트릭스 SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획서 SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 운영규칙 SHA256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- predecessor: C-03 `ACCEPTED`, canonical sequence `748`

## 3. 목표와 acceptance

C-03의 single Developer read-only lifecycle과 raw-result 계약을 보존하면서 사람의 steer·pause·resume·stop, checkpoint 복원, 결과 handoff, Workbench/registry projection을 framework-neutral service/API 계약으로 구현한다.

- `AV-AGT-005`: L6 / FI / E-EVT,E-PRG
- `AV-AGT-006`: L3 / AN / E-EVT
- `AV-AGT-029`: L4 / AE / E-SHOT. 실제 Workbench 브라우저와 screenshot은 `U-02`까지 `DEFERRED`한다.

## 4. exact9 제품 write scope

1. `packages/orchestration/developer_lifecycle.py`
2. `packages/orchestration/__init__.py`
3. `packages/api/delegation_lifecycle.py`
4. `packages/api/registry.py`
5. `packages/api/__init__.py`
6. `tests/orchestration/test_developer_lifecycle_c04.py`
7. `tests/orchestration/test_developer_lifecycle.py`
8. `tests/api/test_c04_delegation_lifecycle.py`
9. `tests/api/test_registry_openapi.py`

경로 비교는 `SEGMENT_AWARE_EXACT_IDENTITY`다. `packages/**`와 `packages_evil/**`, 대소문자·separator·dot-segment·prefix 유사 경로를 동일 권한으로 취급하지 않는다.

## 5. 구현 계약

1. runner capability를 통해 steer, checkpoint pause, resume, stop을 각 idempotency key당 정확히 1회 전달한다.
2. 사람 입력은 concurrent poll/system result보다 우선한다. 단, 이미 관측된 terminal result는 유실하지 않고 최신 human metadata와 선형화한다.
3. checkpoint는 canonical JSON-safe state bytes와 content hash를 만들고 session/delegation/packet/baseline/context/resume epoch에 결박한다.
4. 새 service instance가 checkpoint를 검증·restore한 뒤 같은 Delegation을 resume한다. stale epoch, identity drift, packet/baseline/context drift, duplicate command를 fail-closed로 거부한다.
5. `PAUSED` 상태의 stop을 지원하고 terminal·stop delivery 계약은 C-03을 회귀시키지 않는다.
6. 모든 projection은 deterministic JSON-safe immutable snapshot이며 Secret 값과 내부 credential을 포함하지 않는다.
7. raw-result와 canonical artifact reference를 handoff에 보존한다.
8. Workbench projection은 role, objective, in-scope, out-of-scope, permission, budget, cost/usage, status, current action, checkpoint, evidence, allowed commands, stop authority를 포함한다.
9. API projection은 canonical delegation `GET`, `:steer`, `:cancel`, `:resume` 계약과 registry route/permission projection을 제공한다.

## 6. TDD·검증

- crash/recreate를 최소 3회 반복한다.
- exact identity/hash/epoch/baseline/context drift와 stale/duplicate를 검증한다.
- concurrent wait×pause/steer/resume/stop과 human priority/terminal preservation을 검증한다.
- runner delivery-once와 idempotency key, PAUSED stop을 검증한다.
- JSON dumps, immutability, Secret 부재, raw-result/artifact handoff를 검증한다.
- Workbench 필드와 registry exact route/permission을 검증한다.
- focused RED→GREEN 뒤 `tests/orchestration tests/api tests/e2e` 전체 회귀를 실행한다.

## 7. 금지·미실행 경계

- 실제 UI, FastAPI binding, DB, external Developer backend, Provider, Telegram, Secret, WSL, deploy, network 실행 금지.
- U-02 browser와 E-SHOT은 `DEFERRED`; 실행하지 않은 증거를 PASS로 승격하지 않는다.
- C-05+, historical evidence/progress mutation, exact9 밖 제품 변경, C-03 계약의 암묵 변경 금지.

## 8. 결과 계약과 rollback

- 결과: `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`를 구분한다.
- 보고: exact 변경 파일, 명령·exit·실제 결과, 미검증, 외부 IO, 회귀, rollback을 포함한다.
- rollback: C-04 제품 commit만 revert하여 base `028765cea128c73fb2404e6cefefce12175cb9f4`의 C-03 accepted 상태로 복원한다.
