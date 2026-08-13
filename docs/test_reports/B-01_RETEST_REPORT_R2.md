# B-01 Independent Retest Report R2

- package/revision: `B-01 / R2`
- baseline: `HEAD == origin/main == 6226e7828e11c564b08de738ba46c5b028792a85`
- progress: sequence `199`, `TEST_REVIEW / R2_PENDING`, worker/write lease `null`
- developer R2 manifest SHA-256: `DA32A7C2F2F3E38623BD691B876233A50E8267AC594E847E3108EE308A5E1AEF`
- developer R2 target: `E63009EE0F8386E670431F87EC6D2CE8C089D8D9C4ADCF51A5FC8B6D9D46373A`
- verdict: `REWORK`
- blocking findings: `1`

## 판정 → 판단 이유 → 조치

**판정: `REWORK`.** R1 finding `BLK-B01-001`의 원래 세 우회값 `False`, `0.0`, 공백-only target은 R2에서 차단됐다. strict integer zero, 일반 숫자 변형, whitespace-only, target mismatch도 fail-closed다. 그러나 R2 WorkInstruction의 `canonical nonblank hash 문자열` 계약을 만족하지 않는 앞뒤 공백 padding target 두 종류가 전이를 통과한다.

**판단 이유:** 구현은 `bool(target.strip())`로 nonblank 여부만 확인하고 `target == target.strip()`을 확인하지 않는다. 따라서 target과 validation target에 동일한 비정규 문자열을 주면 exact equality도 만족해 RELEASE guard가 `APPLY_PENDING`을 허용한다. 이는 R2 WorkInstruction 필수 수정 3번과 validation의 `stripped nonblank string` 주장에 대한 독립 hostile 실패다.

**조치:** `BLK-B01-002`를 수정하고 ASCII/Unicode padding을 회귀 test로 고정한 뒤 R3 독립 재검증이 필요하다. B-01 acceptance, B-02, commit, push는 수행하지 않는다.

## Blocking finding

### BLK-B01-002-NONCANONICAL-TARGET-PADDING-BYPASS — CRITICAL

- 위치: `packages/domain/reducer.py::_release_conditions`
- 계약 근거: `docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R2.md` 필수 수정 3번 — target과 validation target은 **canonical nonblank hash 문자열**이며 서로 정확히 같아야 한다.
- 재현:
  - `target_hash=" sha256:a "`, `validation_target_hash=" sha256:a "` → `ALLOW` (expected `REJECT`)
  - `target_hash="\u2003sha256:a\u00a0"`, validation target 동일 → `ALLOW` (expected `REJECT`)
- 영향: 비정규 target identity를 사람이 승인한 canonical target처럼 사용해 RELEASE subject identity 경계를 약화시킨다.
- 요구 보완: target 원문이 stripped 결과와 동일한 canonical nonblank 문자열인지 fail-closed 검사하고 두 padding case를 테스트에 추가한다. 이 보고서는 제품 코드를 수정하지 않는다.

## 확장 hostile matrix

| 입력 | 결과 |
|---|---|
| valid `int(0)` + exact canonical target | `ALLOW` (의도된 정상값) |
| `False`, `True`, `0.0`, `-1`, `1` | 모두 `REJECT` |
| `Decimal(0)`, `Fraction(0,1)` | 모두 `REJECT` |
| ASCII whitespace-only, Unicode whitespace-only | 모두 `REJECT` |
| target mismatch | `REJECT` |
| ASCII padded same target | **`ALLOW` — FAIL** |
| Unicode padded same target | **`ALLOW` — FAIL** |

## 독립 회귀·증거 결과

| 환경/항목 | 결과 |
|---|---|
| current domain | `13/13 PASS`, 0.007s |
| current tooling | `282/282 PASS`, 217.151s |
| current standalone A-13/project/G-07/Phase G | 모두 exit `0` PASS |
| LF clean clone domain | `13/13 PASS`, 0.006s |
| LF clean clone tooling | `282/282 PASS`, 193.093s |
| LF clean clone standalone 4종 | 모두 exit `0` PASS |
| R2 manifest | exact paths `5`, raw rows `4`, self-reference false |
| R2 target 재계산 | canonical `437` bytes, content `11,476` bytes, `E63009...46373A` 일치 |
| completion successor | canonical `530` bytes, content `9,890` bytes, `5A53ED...F5562` 일치 |
| tamper | raw hash, duplicate, self-reference, exact expansion, target forgery 모두 fail-closed |
| no-write | test 전후 clone clean; current tracked/cached diff 없음 |

## 미실행 경계

실제 runtime, API, DB, UI, browser, provider, WSL, production, deployment는 모두 `NOT_EXECUTED`다. B-01 acceptance, B-02, commit, push도 `NOT_EXECUTED`다. 이 보고서 외 제품·fixture·authority·progress/HANDOFF는 수정하지 않았다.
