# A-02 화면 토큰 구현 계획

> 실행 방식: 승인된 A-02 계약을 Developer Subagent가 TDD로 구현하고, 별도 Tester가 독립 검증한다.

## Task 1 — WorkInstruction과 실행 기준선 고정

**Files**
- Create: `docs/work_orders/A-02_WORK_INSTRUCTION.md`
- Create: `docs/work_orders/A-02_INVOCATION_PROMPT.md`
- Modify: `docs/progress/**`

1. 권위 hash, A-01 ACCEPTED, HEAD/upstream clean을 확인한다.
2. A-02 WorkInstruction에 AV-UI-001/002, STATIC_ONLY 경계, 허용/금지 경로, hostile mutations를 고정한다.
3. worker/write lease와 `PACKAGE_STARTED`를 비소급 Event로 발급하고 progress/HANDOFF를 ACTIVE로 전환한다.
4. start manifest와 detached digest를 one-way로 결박한다.

## Task 2 — RED: token 계약 테스트

**Files**
- Create: `tests/tooling/test_a02_tokens.py`
- Create: `tests/fixtures/a02/canonical-contract.json`
- Create: `tests/fixtures/a02/mutation-catalog.json`

1. catalog/artifact/validator 부재로 RED를 관찰한다.
2. viewport/font/layout/explanation/status/color/contrast/static-evidence 계약을 테스트한다.
3. 각 hostile mutation이 stable reason code로 실패하도록 기대값을 고정한다.

## Task 3 — GREEN: 정적 token artifact와 validator

**Files**
- Create: `docs/architecture/a02/A-02_TOKEN_CATALOG.json`
- Create: `docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md`
- Create: `docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md`
- Create: `docs/architecture/a02/A-02_STATIC_RENDER.svg`
- Create: `scripts/check_a02_tokens.py`

1. catalog를 단일 정본으로 구현한다.
2. 문서 2개와 1920×1080 SVG를 catalog 값에 맞춘다.
3. stdlib validator로 exact contract, contrast, SVG binding, A-01 predecessor를 검증한다.
4. targeted tests와 checker를 GREEN으로 만든다.

## Task 4 — Developer evidence와 TEST_REVIEW 투영

**Files**
- Create: `docs/validation/A-02_TOKEN_VALIDATION.md`
- Create: `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json`
- Create: `docs/completion_reports/A-02_COMPLETION_REPORT.md`
- Modify: `docs/progress/**`

1. raw artifact hash와 target/delivered를 재현 가능한 방식으로 결박한다.
2. 실행·미실행 범위를 분리해 기록한다.
3. lease를 회수하고 `PACKAGE_COMPLETED / TEST_REVIEW`로 전환한다.
4. A-02·progress·G-07 회귀와 diff-check를 fresh 실행한다.

## Task 5 — 독립 Tester와 Main acceptance

**Files**
- Create: `docs/test_reports/A-02_TEST_REPORT.md`
- Modify: `docs/progress/**`

1. Tester는 구현 대화와 분리해 raw hash, exact token, hostile mutation, static/runtime 경계를 재검증한다.
2. blocking defect가 있으면 동일 Developer에게 재작업한다.
3. PASS면 Main이 `MAIN_PACKAGE_ACCEPTED`, A-03 READY를 materialize한다.
4. 최종 회귀·manifest·Git 상태를 확인하고 commit/push한다.

## 완료 기준

- AV-UI-001/002 정적 계약 PASS, blocking defect 0
- runtime/browser/API/DB/배포는 NOT_EXECUTED
- 기존 A-01·권위 evidence 불변
- progress/HANDOFF와 Git 원격 기준선 정합
- DIR 미도달
