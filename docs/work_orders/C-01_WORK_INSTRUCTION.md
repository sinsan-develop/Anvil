# C-01 WorkInstruction — LLM Gateway·NativeAgentAdapter·Minimal Main Agent Kernel

## 목표

Phase B Gate가 `ACCEPTED`인 기준선에서 C-01의 최소 수직 capability를 구현한다. LLM provider 호출을 추상화하고, capability probe 및 NativeAgentAdapter의 단일 model→action→observation loop를 제공한다.

## 범위

- `packages/llm_gateway/`에 provider-neutral gateway contract, request/response model, capability probe, retry-after/abort/final-usage/usage-provenance 표현을 구현한다.
- `packages/orchestration/` 또는 기존 orchestration 경계에 Minimal Main Agent Kernel을 추가하되 기존 계약을 깨지 않는다.
- 한 Step 시작 전에 예약 budget 검증을 수행하고, request id와 usage provenance를 결과에 포함한다.
- 실제 외부 Provider 호출은 하지 않는다. deterministic fake adapter/fixture로 계약을 검증한다.
- 브라우저·배포·운영 DB·secret 파일은 수정하지 않는다.

## 금지

- C-02 이후 Delegation·Developer lifecycle·메뉴 UI 구현 금지
- 기존 historical progress/event/hash 파일 수정 금지
- provider key 또는 secret 출력·저장 금지
- `latest` 의존성 변경 및 전체 리팩터링 금지

## 완료 조건

1. gateway request가 고유 request id, model/provider, abort signal, retry-after를 전달한다.
2. adapter 결과가 final usage와 usage provenance를 반환한다.
3. capability probe가 지원 capability와 미지원 사유를 deterministic하게 반환한다.
4. kernel이 단일 Step의 budget reservation을 호출 전에 검증하고 초과 시 provider adapter를 호출하지 않는다.
5. 정상·abort·retry-after·budget denial·usage provenance 케이스 테스트가 통과한다.

## 검증 계약

- `python -m pytest` 또는 저장소 기준 `uv run pytest`로 C-01 신규/관련 테스트를 실행한다.
- `python -m compileall packages/llm_gateway packages/orchestration`을 실행한다.
- `git diff --check`를 실행한다.
- 실제 Provider·DB·API·브라우저·배포 검증은 `NOT_EXECUTED`로 보고한다.

## 결과 보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED` 중 하나로 판정하고, 변경 파일·정확한 명령/종료코드·테스트 결과·미검증 범위·rollback 방법을 포함한다.
