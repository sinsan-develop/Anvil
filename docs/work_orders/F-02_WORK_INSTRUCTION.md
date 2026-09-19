# F-02 WorkInstruction — Model discovery·privacy/cost/capability snapshot·routing

- 승인 범위: upstream model discovery snapshot, privacy/retention/training/ZDR/cost/capability metadata, role routing/fallback policy drift detection.
- 실제 Provider/upstream/network/DB/UI/deploy 호출은 금지한다.
- exact5: `packages/model_registry/__init__.py`, `packages/model_registry/models.py`, `packages/model_registry/service.py`, `tests/model_registry/test_model_registry_f02.py`, `docs/04_test_reports/F-02_COMPLETION_REPORT.md`.
- unknown provider/model, privacy/cost/capability drift, stale TTL, unauthorized fallback은 fail-closed한다. 반환 snapshot·routing decision·audit는 immutable detached 구조와 deterministic hash를 사용한다.
- 완료 시 정확한 TDD/회귀/compile 결과와 NOT_EXECUTED·NOT_INTEGRATED 범위를 보고한다.
