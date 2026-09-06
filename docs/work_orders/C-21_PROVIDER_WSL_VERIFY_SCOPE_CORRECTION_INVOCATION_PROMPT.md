# 실행 프롬프트

`WI-C-21-PROVIDER-WSL-VERIFY-SCOPE-CORRECTION-20260906-001`을 exact17 범위에서 수행한다. `verify.sh`의 모든 `/api/providers` 호출과 Provider 전용 임시파일·파서·assertion을 제거한다. auth session, SSE, Last-Event-ID, same-origin, migration, backup/restore는 유지한다. 실제 외부 실행과 commit/push는 하지 않는다.

