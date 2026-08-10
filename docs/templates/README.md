# Anvil artifact template 계약 v1.0.0

`artifact-schema.json`과 8개 JSON template이 기계 판정의 정본이다. 기존 Markdown 형식의 WorkInstruction, CompletionReport, TestReport 등은 이 정본을 사람이 읽기 쉽게 표현하는 layer이며 정본 필드를 삭제하거나 enum을 넓힐 수 없다.

## 정본과 위치

| artifact_type | canonical template |
|---|---|
| `work_instruction` | `docs/work_orders/templates/work-instruction.template.json` |
| `invocation_prompt` | `docs/work_orders/templates/invocation-prompt.template.json` |
| `completion_report` | `docs/validation/templates/completion-report.template.json` |
| `test_report` | `docs/validation/templates/test-report.template.json` |
| `product_validation` | `docs/validation/templates/product-validation.template.json` |
| `defect_assessment` | `docs/release/templates/defect-assessment.template.json` |
| `release_decision` | `docs/release/templates/release-decision.template.json` |
| `evidence_manifest` | `docs/evidence/templates/evidence-manifest.template.json` |

`artifact-catalog.json`은 위 경로와 schema `$defs` 참조를 고정한다. template의 `__REQUIRED_*__` 값은 실제 artifact 생성 때 반드시 치환하며 빈 문자열이나 임의 PASS로 대체하지 않는다.

## canonical JSON과 content hash

1. JSON object key를 유니코드 코드포인트 순으로 정렬한다.
2. separator는 `,`와 `:`만 사용하고 공백을 넣지 않는다.
3. UTF-8, LF, BOM 없음으로 직렬화한다.
4. self-reference를 피하기 위해 최상위 `content_hash`를 제외한 canonical JSON bytes에 SHA-256을 적용한다.
5. 표기는 `sha256:`과 대문자 64자리 hex를 사용한다.

표준 라이브러리 checker 실행 예시는 개발·검증용이며 운영자 인터페이스가 아니다.

```text
python scripts/check_artifact_templates.py <repository-root>
```

독립 Tester는 WorkInstruction fixture만 입력으로 받아 `semantic_projection`을 재구성하고 `expected-semantic-projection.json`과 byte-level 의미 diff 0을 확인한다.
