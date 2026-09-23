# F-03 WorkInstruction — CEREBRAS adapter

- 승인 범위: CEREBRAS adapter의 generate/stream/health/discovery 계약과 request id, abort, final usage, quota/error/retry-after mapping.
- exact5: `packages/providers/cerebras_adapter.py`, `packages/providers/cerebras_models.py`, `packages/providers/cerebras_errors.py`, `tests/providers/test_cerebras_adapter_f03.py`, `docs/04_test_reports/F-03_COMPLETION_REPORT.md`.
- 실제 CEREBRAS/Provider/network/DB/UI/deploy 호출은 금지한다. Fake transport/fixture만 사용한다.
- unknown/malformed response, credential material, quota/error ambiguity, retry-after overflow는 fail-closed한다. detached immutable receipt와 deterministic mapping을 검증한다.
