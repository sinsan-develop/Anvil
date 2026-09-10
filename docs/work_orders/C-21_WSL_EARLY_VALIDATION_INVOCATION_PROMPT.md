# C-21 WSL 선행검증 Invocation

`WI-C-21-WSL-EARLY-VALIDATION-20260904-001`과 epoch-1 fencing을 준수한다. `deploy/wsl` 독립 harness를 테스트 우선으로 구현하고, candidate manifest의 exact feature SHA·remote·approval binding과 clean detached checkout을 fail-closed로 강제한다. PG15와 PG18 RC의 DB·volume·port·evidence를 분리하며 migration 전 backup, authenticated SSE/Last-Event-ID, same-origin, scratch restore, application-only rollback을 검증한다. Telegram·Provider 실제 호출, 실제 credential, scp, 서버 patch, dirty deploy, shared schema downgrade, main 병합은 수행하지 않는다. 구현 SHA가 commit/push되기 전에는 WSL 실제 배포를 시도하지 않고 그 dependency를 보고한다.
