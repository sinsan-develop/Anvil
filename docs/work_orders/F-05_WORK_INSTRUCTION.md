# F-05 WorkInstruction — MISTRAL adapter

- 승인 범위: MISTRAL adapter의 `generate`, `stream`, `health`, `discovery` 계약과 request ID, abort, final usage, quota/error/retry-after mapping.
- 제품 exact5: `packages/providers/mistral_adapter.py`, `packages/providers/mistral_models.py`, `packages/providers/mistral_errors.py`, `tests/providers/test_mistral_adapter_f05.py`, `docs/04_test_reports/F-05_COMPLETION_REPORT.md`.
- 기준: 설계서 canonical Provider ID `mistral`, 계획서 F-05, 매트릭스 `AV-OPS-010`, `AV-OPS-011`, `AV-FLOW-019(MISTRAL)`.
- Mistral 공식 Chat API의 additive metadata와 정상 stream delta를 수용한다. `stream_options.include_usage=true`를 요청하고 실제 final usage가 없는 완료는 fail-closed한다. 공식 문서: `https://docs.mistral.ai/api`, `https://docs.mistral.ai/resources/known-limitations`.
- 동일 request ID replay는 결정적이어야 하고 입력이 바뀌면 전송 전에 거부한다. abort 전후의 usage provenance와 immutable·detached receipt를 검증한다.
- malformed/unknown response, credential material, quota/error ambiguity, retry-after overflow, non-finite JSON은 fail-closed한다. 키 부재·무효로 인한 실제 연동 실패는 제품 결함으로 집계하지 않고 미검증으로 기록한다.
- 실제 Mistral API, network, credential, DB, browser, WSL, deployment는 이 host-only 작업에서 실행하지 않는다. 주입형 fake transport만 사용한다.
- Developer는 제품 exact5만 수정한다. control 문서, Git commit·push·merge는 Main Agent가 담당한다.
- 완료 조건: TDD RED/GREEN, 제품 focused test, 관련 provider 회귀, compile, 독립 검토와 미검증 범위·rollback 기록.
