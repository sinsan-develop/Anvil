# A-02 WorkInstruction — 1920×1080 화면 토큰·설명 인터페이스 정적 계약

## Artifact envelope

- artifact_id: `WI-A-02-20260811-001`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `A-02`
- version: `1`
- artifact_status: `approved`
- package_status: `READY`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-11T00:00:00+09:00`
- source_spec_sha256: `D815B26D0301A840F4F15C090D7880C276B9225A9EEB4A9C41B7679B6B9E60E3`
- source_plan_sha256: `2AEC277A94D90FF3612D2E4409DDF1230D11A1F839EA579EF8C4F5BB54489538`
- baseline_git_commit: `00adf34e8ed9393d1c22c2fa9da825bcacc79abc`
- executor: `developer-primary-a02`
- independent_tester: `구현 대화와 분리된 Tester 1명`

## 권위 binding

- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- validation_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- predecessor_package: `A-01 ACCEPTED`
- predecessor_test_report_sha256: `9DD0EE2626800E28420DB5AC3597BE3D3717586632E7441938904E946EBCF620`
- predecessor_manifest_sha256: `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`

## 목표와 판정 경계

후속 Phase A 화면이 공통 참조할 typography, layout, spacing, semantic color와 설명 인터페이스 토큰을 정적 artifact로 확정한다.

A-02의 판정은 `STATIC_CONTRACT_PASS / CANONICAL_L4_RUNTIME_DEFERRED_NOT_EXECUTED`다. 매트릭스의 `AV-UI-001/002 L4/E-SHOT` canonical runtime 판정은 A-14/A Gate에서 실제 Playwright screenshot으로 수행한다. A-02 정적 SVG를 브라우저·runtime E-SHOT PASS로 승격하지 않는다.

## exact token contract

### viewport·typography·layout

| 항목 | 값 |
|---|---:|
| viewport | 1920×1080 |
| body/form | 12px |
| small description | 10px |
| auxiliary | 9px |
| sidebar title | 14px |
| screen title | 16px |
| sidebar expanded/collapsed | 224px / 56px |
| header | 48px |
| context drawer | 360px on demand |
| base padding | 16px |
| card gap | 12px |

### semantic color baseline

다음 값은 A-02에서 처음 확정하는 기술 token이며 상위 요구 변경이 아니다.

| role | value |
|---|---|
| canvas | `#0B1220` |
| surface | `#142033` |
| surface-raised | `#1B2A42` |
| text-primary | `#F7F9FC` |
| text-muted | `#B8C4D8` |
| border | `#60738F` |
| interactive | `#7DB4FF` |
| focus | `#F8D66D` |
| success | `#5EE3A1` |
| warning | `#FFD166` |
| danger | `#FF7B86` |
| blocked | `#C4A7FF` |
| info | `#74D7FF` |
| neutral | `#B8C4D8` |

상태는 색상 단독으로 표현하지 않고 `icon + 상태명 + 짧은 설명`을 함께 사용한다. 일반 text contrast 4.5:1과 focus/non-text boundary 3:1은 A-02 내부 품질 guard이며 상위 요구로 소급하지 않는다.

### 설명 인터페이스

1. 진입점은 `i` icon이다.
2. 짧은 설명은 tooltip, 복합 내용·결정·증거는 popover다.
3. tooltip/popover에 `이유`와 `다음 행동`을 포함한다.
4. 상시 설명 box는 금지한다.
5. hover-only를 금지하고 focus/keyboard 경로를 계약한다.

## 필수 산출물

1. `docs/architecture/a02/A-02_TOKEN_CATALOG.json`
2. `docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md`
3. `docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md`
4. `docs/architecture/a02/A-02_STATIC_RENDER.svg`
5. `scripts/check_a02_tokens.py`
6. `tests/tooling/test_a02_tokens.py`
7. `tests/fixtures/a02/canonical-contract.json`
8. `tests/fixtures/a02/mutation-catalog.json`
9. `docs/validation/A-02_TOKEN_VALIDATION.md`
10. `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json`
11. `docs/completion_reports/A-02_COMPLETION_REPORT.md`
12. Main projection의 `docs/progress/**` evidence

## 허용 경로

- `docs/architecture/a02/**`
- `scripts/check_a02_tokens.py`
- `tests/tooling/test_a02_tokens.py`
- `tests/fixtures/a02/**`
- `docs/validation/A-02_*`
- `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST*.json`
- `docs/completion_reports/A-02_COMPLETION_REPORT.md`
- Main 전용 `docs/work_orders/A-02_*`, `docs/progress/**`
- Tester 전용 `docs/test_reports/A-02_TEST_REPORT*.md`

## 금지 범위

- 권위 문서, AGENTS.md, approval/baseline 수정
- `docs/architecture/a01/**` 및 A-01 accepted evidence 수정
- `apps/**`, `packages/**`, CSS/React/브라우저 runtime, dependency 수정
- A-03 이후 wireframe·interaction·제품 화면 선점
- API/DB/Event/Network/Docker/WSL/server/deploy
- static render를 Playwright/browser/runtime PASS로 표시
- 기존 progress event와 manifest의 소급 수정
- Developer의 commit/push

## TDD·hostile mutation

RED를 먼저 관찰한 뒤 최소 구현으로 GREEN을 만든다. validator는 stable reason code로 다음을 거부한다.

- viewport/font/layout/spacing exact 값 변경·누락·swap
- persistent explanation box 허용
- `i`, tooltip, popover, reason, next action, focus/keyboard 중 하나 누락
- color-only status 또는 icon/label 누락
- semantic role 누락·중복·unknown·raw-hex 우회
- catalog와 Markdown/SVG 값 drift
- SVG width/height/viewBox drift
- A-01 presentation contract drift
- E-SHOT static qualifier 제거 또는 runtime PASS 위조
- AV 책임/level/method/evidence/severity 변경
- 허용 범위 밖 제품·dependency 파일 생성

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A"
  assigned_verification_ids: ["AV-UI-001", "AV-UI-002"]
  required_levels: ["L4"]
  required_methods: ["AE", "MI"]
  required_evidence: ["E-SHOT", "E-ART", "E-MAN", "E-TEST"]
  execution_classification: "STATIC_ONLY"
  package_verdict: "STATIC_CONTRACT_PASS"
  canonical_runtime_verdict: "RUNTIME_DEFERRED / NOT_EXECUTED"
  evidence_acquisition_mode: "STATIC_RENDER"
  evidence_qualifier: "E-SHOT_STATIC_NOT_RUNTIME_UI"
  canonical_runtime_owner: ["A-14", "A Gate"]
  environment: "ENV-LOCAL"
  evidence_manifest_required: true
  regression_suite: "tests.tooling.test_a02_tokens + tests.tooling.test_project_progress + tests.tooling.test_g07_baseline"
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "DIR-1·DIR-2·DIR-3·DIR-X 도달"
    - "권위 문서 semantic drift 또는 승인 계보 불일치"
    - "실제 secret 발견"
```

## 완료·보고 계약

Developer는 exact diff, RED→GREEN 명령/exit/count, mutation reason code, manifest raw/target, 미실행 범위, A-01 불변, rollback을 CompletionReport에 기록한다. 결과는 `COMPLETED_PENDING_INDEPENDENT_TEST`로 제출하고 lease를 회수해 `TEST_REVIEW`로 전환한다.

Tester는 구현 대화와 분리해 exact token, contrast, catalog-doc-SVG binding, hostile mutations, static/runtime qualifier, raw hash를 독립 재계산한다. blocking defect 0이면 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`를 기록한다. Main 수락 전 A-03 시작을 금지한다.

기능 범위·요구사항·중요 위험 변경과 DIR 도달이 없으므로 routine 진행은 신산님에게 보고하지 않는다.
