# C-05 WorkInstruction R2 — 구조화 Result Envelope·schema validator

## Revision authority

- ID: `WI-C-05-RESULT-ENVELOPE-R2-20260913-001`
- 분류: `MAIN_INTERNAL_TECHNICAL_REVISION`
- 기능 범위·요구사항·중요 위험: 변경 없음
- R1 보완 사유: optional `reason_code`의 상태별 domain, JSON container fail-closed 경계, C-02 identifier authority, C-06/C-07 책임 분리를 명시한다.

## 목표

C-03/C-04 raw 결과를 Main Agent가 신뢰 가능한 구조화 결과로 판정할 수 있도록 Result Envelope와 schema validator를 구현한다.

## 범위

- 상태 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`와 공통 식별자·attempt·target hash·evidence·summary 필드를 정의한다.
- first-class optional `reason_code`를 정의한다. 입력에서 생략하거나 `null`일 수 있지만 상태별 canonical 조건은 다음과 같다.
  - `INCOMPLETE`: `RESULT_CONTRACT_INCOMPLETE | TRANSIENT_EXECUTION_ERROR | CHECKPOINTED_INTERRUPTION` 중 하나를 반드시 사용한다.
  - `BLOCKED`: `DECISION_REQUIRED | POLICY_BLOCKED | ENVIRONMENT_BLOCKED | PERMISSION_BLOCKED` 중 하나를 반드시 사용한다.
  - `CANCELLED`: `DELEGATION_REASSIGN | RUN_CANCEL_REQUESTED` 중 하나를 반드시 사용한다.
  - `COMPLETED | FAILURE_REPORT`: domain `reason_code`를 허용하지 않으며 canonical serialization은 명시적 `null`로 고정한다.
- `CHECKPOINTED_INTERRUPTION`은 canonical non-empty `checkpoint_ref`가 반드시 필요하다.
- `failure_fingerprint`는 있으면 canonical non-empty text로만 검증한다. 필수 여부·계산·동일 failure 판정·집계는 C-06 책임이므로 C-05가 대신하지 않는다.
- 상태 전이, Step·Delegation mutation, resolver 판정은 C-07 책임이므로 C-05가 수행하지 않는다.
- 필수 field, hash 형식, evidence/test/handoff 구조와 canonical JSON serialization을 deterministic하게 검증한다.
- 각 상태 및 누락·변조 hostile 테스트를 작성한다.

## JSON·identifier fail-closed 계약

- Mapping 입력의 JSON array는 실제 `list`, object는 string key를 가진 실제 mapping이어야 한다. 문자열·tuple·set·scalar/custom object를 array/object로 변환하지 않는다.
- `actions_taken`, `changed_paths`, `evidence_refs`, `tests`, `assumptions`, `unresolved`와 모든 nested `evidence`·`test`·`handoff`를 재귀 검증한다.
- nested field 누락·잘못된 primitive·non-string key·NaN/Infinity·지원하지 않는 객체는 `validate_result`의 결정적 invalid 결과로 fail-closed한다. `KeyError`, `TypeError`, JSON serialization exception을 호출자에게 누출하지 않는다.
- `EvidenceReference`와 `ResultTest` object의 required/unknown field를 명시적으로 검사하고 값을 문자열로 강제 변환하지 않는다.
- `handoff`는 bounded structured summary/state와 checksum-bound artifact/evidence reference만 허용한다. raw transcript·raw log·stdout·stderr 본문을 inline으로 넣지 않는다.
- handoff 모든 depth의 key를 대소문자 무시 및 `_`·`-`·공백 제거 형태로 비교한다. `transcript`, `transcripts`, `stdout`, `stderr` 또는 `rawlog`, `rawlogs`, `rawtranscript`, `rawtranscripts` 의미 token을 포함한 key는 fail-closed한다. raw 자료는 `evidence_refs`의 checksum reference로만 전달한다.
- handoff bound는 canonical JSON 65,536 bytes, 최대 depth 8, object당 최대 128 keys, array당 최대 256 items, string당 최대 UTF-8 16,384 bytes다. 한도 초과는 exception leakage 없이 invalid 결과다.
- result/delegation/attempt/step/evidence identifier는 C-02가 허용한 operational identifier를 보존한다. C-05 ad-hoc regex를 추가하지 않고, trimming이 필요 없는 canonical non-empty text만 요구한다.
- SHA-256 field와 고정 reason code enum은 identifier가 아니므로 각각의 정본 format/allowlist를 엄격히 검증한다.

## 금지

- C-06 FAILURE_REPORT validity·fingerprint 계산·집계 구현 금지
- C-07 outcome resolver·canonical 상태/Event 전이 구현 금지
- 실제 외부 호출·DB/API/browser/deployment 및 historical progress 수정 금지
- C-02 identifier authority를 C-05 전용 regex로 축소하거나 다시 정의하지 않는다.

## 완료조건·검증

1. 다섯 결과 상태가 명시적으로 구분된다.
2. 상태별 `reason_code` allowlist와 `CHECKPOINTED_INTERRUPTION → checkpoint_ref` 조건을 fail-closed 검증한다.
3. 모든 JSON array/object/nested evidence/test/handoff hostile 입력이 type coercion·exception leakage 없이 deterministic invalid 결과를 반환한다. handoff inline raw transcript/log/stdout/stderr key와 bounded JSON 초과도 포함한다.
4. C-02-valid operational identifier는 raw/canonical text 그대로 round-trip하고 C-02-invalid empty/whitespace text는 fail-closed한다.
5. round-trip과 canonical hash가 deterministic하며 `COMPLETED/FAILURE_REPORT.reason_code`는 `null`이다.
6. C-06/C-07/DB/API/browser/external side effect가 없고 focused test, compile, `git diff --check`가 통과한다.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 실제 상태와 변경·검증·미검증·rollback을 보고한다.
