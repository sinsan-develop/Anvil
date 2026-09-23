# F-04 WorkInstruction — GROQ adapter

- 승인 범위: GROQ adapter의 `generate`, `stream`, `health`, `discovery` 계약과 request ID, abort, final usage, quota/error/retry-after mapping.
- 제품 exact5: `packages/providers/groq_adapter.py`, `packages/providers/groq_models.py`, `packages/providers/groq_errors.py`, `tests/providers/test_groq_adapter_f04.py`, `docs/04_test_reports/F-04_COMPLETION_REPORT.md`.
- 실제 GROQ/Provider/network/credential/DB/UI/browser/WSL/deploy 호출은 금지한다. 주입형 fake transport와 fixture만 사용한다.
- unknown/malformed response, credential material, quota/error ambiguity, retry-after overflow, non-finite JSON은 fail-closed한다.
- 동일 request ID replay는 결정적이어야 하며 입력이 달라지면 전송 전에 거부한다. receipt는 immutable·detached여야 한다.
- stream의 provider final usage는 단일 terminal frame에만 존재해야 하며 terminal 이후 frame을 거부한다.
- Developer는 제품 exact5만 수정하며 control 문서, Git commit·push·merge는 Main Agent가 담당한다.
- 완료 조건: 제품 focused test PASS, 관련 provider 회귀 PASS, compile PASS, 실제 미검증 범위와 rollback을 completion report에 기록.
