# A-01 독립 TestReport

## 판정

`FAIL / REWORK_REQUIRED`

- Work Package: `A-01`
- 검증 ID: `AV-UI-005`
- 검증 수준·방법·증거: `L7 / MI / E-ART + E-SHOT_STATIC + E-DEC + E-MAN + E-TEST`
- 심각도: `MAJOR`
- WorkInstruction: `WI-A-01-20260811-001`
- WorkInstruction SHA-256: `D7AE56F3E08A03D97F169933197BECC596C5F89F41DD5F0B14D8DF3A7291D48A`
- 검증 HEAD / `origin/main`: `287ea4c3238b19e88d8c1ba204a8117a52f9bcb5`
- 독립 Tester 결론: blocking finding `1건`, `ACCEPTED` 금지

## 판단 이유

14개 canonical 단계, 5개 경로 ID, Workbench screen map, Phase Rail, progressive disclosure, 기술검증·ProductValidation·DefectAssessment·ReleaseDecision·Learning 분리, STOP/RESUME checkpoint·중복방지, `STATIC_ONLY` 캡션과 `AV-FLOW-001` 유보는 현재 정적 산출물에서 확인됐다. A-01·project progress·G-07 checker도 fresh PASS했다.

그러나 사람 승인 guard와 거부·보완 연결을 훼손한 적대 mutation을 A-01 validator가 오류 없이 수용한다. `AV-UI-005`는 정상 문서의 존재만이 아니라 정상·거부·보완·중단·재개 경로가 화면 계약에서 연결되고 중요 승인 guard가 유지되는지를 요구한다. 따라서 현재 PASS는 해당 MAJOR 계약을 충분히 방어하지 못한다.

## Blocking finding

### `A01-TST-BLK-001` — 중요 위험 승인 guard와 decision outcome 연결이 적대 변경에 대해 fail-open

**판정:** `blocking MAJOR`

**증거:**

1. 권위 문서와 운영 규칙은 사람 재승인 조건을 `기능 범위·요구사항·중요 위험 변경`으로 정의하고 progress schema는 `IMPORTANT_RISK_CHANGE`를 사용한다. 그러나 `A-01_PATH_CATALOG.json`은 `CRITICAL_RISK_CHANGE`를 사용한다. 이 값은 중요 위험보다 좁게 해석될 수 있고 권위 문서의 canonical 값과 일치하지 않는다.
2. `scripts/check_a01_journey.py::validate_catalog()`는 `approval_boundary`의 존재·정확한 값·필수 승인 집합을 검증하지 않는다. `human_approval_required_for=[]` mutation 결과가 `[]`로 PASS했다.
3. decision은 actor·subject·결과 필드의 비어 있지 않음만 검사한다. 다음 hostile mutation이 모두 오류 `[]`로 PASS했다.
   - `DEC-CONCEPT.revise_result = TERMINAL-NONEXISTENT`
   - `EDGE-12-REJECT` 삭제
   - `DEC-CONCEPT.allowed_results = [SELECT]`로 축소
4. 이 상태에서는 중요 위험 변경의 사람 승인, Release REJECT, Concept REVISE를 정적 화면·catalog 연결에서 제거해도 `AV-UI-005 PASS`가 발행될 수 있다.

**영향:** 사람 승인 전 실행 차단과 거부·보완 경로가 누락된 설계가 검증을 통과할 수 있다. 기능 범위·요구사항·중요 위험 변경 또는 DIR 도달이라는 사람 개입 경계를 화면 계약이 보존한다는 보장이 없다.

**필수 조치:**

1. approval category를 권위 문서·schema와 같은 `IMPORTANT_RISK_CHANGE`로 정규화하고 `FUNCTION_SCOPE_CHANGE`, `REQUIREMENT_CHANGE`, `IMPORTANT_RISK_CHANGE`의 정확한 집합을 validator가 검사한다.
2. decision ID·actor·subject·허용 결과·reject/revise target을 canonical exact contract로 검사한다.
3. 모든 reject/revise 결과가 존재하는 step/terminal 및 machine-readable edge/path와 연결되는지 검증한다. 특히 Release REJECT와 Concept/WI 보완 연결을 누락해도 PASS하지 않아야 한다.
4. 위 네 hostile mutation을 fixture와 regression test에 추가하고 RED→GREEN 증거를 남긴다.

## 정합성·증거 재계산 결과

- A-01 developer EvidenceManifest: raw artifact `12개`, bytes/SHA-256 불일치 `0건`, target/delivered `EFFA9E26CADB687E50A1E03817B4F48406FC48BB0F6B1A9A76802E0ECDCBAF1F` 일치, self-reference 없음.
- A-01 completion progress manifest: raw checksum `23개`, 불일치 `0건`, canonical bytes `2558`, content bytes `324769`, target/content/delivered `sha256:AAA571E4F04CA6585F00A372496A479A43C957E8A2389E47F92A71D221FB6513` 일치, self-reference 없음.
- progress: sequence `36`, status `TEST_REVIEW`, result `COMPLETED`, `accepted=false`, independent Tester `PENDING`, worker lease `null`, write lease `null`.
- Git: local `HEAD`와 `origin/main`이 `287ea4c3238b19e88d8c1ba204a8117a52f9bcb5`로 일치한다. validated base `16af3f4284245aea4df130c5efa30700743fc6f6` 이후 변경 경로는 completion manifest의 exact allowlist `24개`와 일치한다.
- 기존 accepted evidence 경로는 위 24개 변경 집합에 포함되지 않았다. 관련 historical immutability regression은 PASS했다.
- `AV-FLOW-001`은 A-01 assigned verification에 재삽입되지 않았고 `RUNTIME_DEFERRED / NOT_EXECUTED`다. runtime owner는 `A-05`, `B-03`, `A Gate`로 유지된다.
- 정적 SVG는 `1920×1080`, `RUNTIME_DEFERRED / NOT_EXECUTED`, `E-SHOT_STATIC — not browser/runtime evidence` 캡션을 포함한다.

## Fresh 검증

1. `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a01_journey -v`
   - `7/7 PASS`
2. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a01_journey.py --json`
   - `PASS`, errors `[]`
3. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_project_progress.py`
   - `PASS`, sequence `36`, reporting `AUTO_CONTINUE`
4. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_g07_baseline.py`
   - `PASS`, packages `97`, AV `255`, uncovered `0`, scenarios `20`
5. `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py' -v`
   - `111개 중 110 PASS / 1 FAIL`
   - 유일 실패는 historical Phase G checkpoint manifest를 현재 mutable detached progress와 비교하는 기존 회귀 `test_checkpoint_manifest_binds_current_detached_without_self_reference`다.
   - 오류 코드는 `GATE_CHECKPOINT_PROGRESS_REF_INVALID`, `GATE_CHECKPOINT_RAW_MISMATCH`, `GATE_CHECKPOINT_TARGET_BYTES_MISMATCH`, `GATE_CHECKPOINT_TARGET_MISMATCH`다.
   - 이 historical baseline failure는 이번 A-01 blocking finding과 분리하며 A-01 신규 결함으로 승격하지 않는다.
6. hostile in-memory mutation 4종
   - approval guard 전체 제거, unknown revise target, Release REJECT edge 삭제, allowed result 축소가 모두 validator errors `[]`로 false-pass했다.

`git diff --check 16af3f4284245aea4df130c5efa30700743fc6f6..HEAD`는 `A-01_USER_JOURNEY.md`의 Markdown hard-break용 후행 공백 2건을 보고했다. 정적 의미에는 영향이 없어 본 finding과 분리한 비차단 formatting 항목으로 기록한다.

## 미검증·runtime 경계

- 브라우저 실제 화면·click·Network: `NOT_EXECUTED`
- API·DB·영속 Event·same-origin BFF: `NOT_EXECUTED`
- STOP/RESUME 실제 중단·checkpoint 복구·중복방지 runtime: `NOT_EXECUTED`
- 사람 승인 실제 저장·guard·거부·보완 runtime: `NOT_EXECUTED`
- WSL-server, PostgreSQL 15/18, ysna-server, Production, 배포, Release: `NOT_EXECUTED`
- `AV-FLOW-001`: `RUNTIME_DEFERRED / NOT_EXECUTED`
- `E-SHOT`은 정적 SVG 증거이며 browser screenshot이 아니다.

## 조치

`A-01`은 `TEST_REVIEW / REWORK_REQUIRED`에 유지한다. Main Agent는 `A01-TST-BLK-001` 보완 WorkInstruction revision을 발행하고 Developer가 최소 범위로 catalog·validator·fixture/test·파생 evidence/progress를 갱신하게 한다. 독립 재검증 PASS 전 `ACCEPTED`, commit/push에 의한 수락 투영, A-02 착수를 금지한다.
