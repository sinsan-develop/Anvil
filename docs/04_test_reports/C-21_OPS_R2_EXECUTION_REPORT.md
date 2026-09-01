# C-21 R2 운영 실행 보고서

## 판정

`PARTIAL / PROVIDER_PROBE_COMPLETED_WITH_PROVIDER_ERRORS`

승인된 C-21 R2 범위 중 9개 Provider non-billing 모델 목록 probe를 실행했다. 모든 credential은 원문을 출력하지 않고 `configured`로만 기록했다. Telegram signed POST, DB mutation, 모델 생성 호출은 수행하지 않았다.

## 기준선 및 실행 경계

- 실행 대상: `ysna-server`의 `anvil-internal-web-1` 컨테이너 환경
- 명령: 컨테이너 내부 Python `urllib` 기반 각 Provider 모델 목록 GET
- timeout: Provider별 10초
- billing action: `none` (models/catalog GET만 수행)
- secret 출력: 금지 준수 (키·Authorization·응답 본문 미출력)
- DB 변경: 없음
- Telegram 호출: 없음

## 결과

| Provider | Credential | Status | HTTP | 모델 수 | 모델 예시 | 소요(ms) | Drift |
|---|---|---|---:|---:|---|---:|---|
| CEREBRAS | configured | healthy | 200 | 2 | `gemma-4-31b`, `gpt-oss-120b` | 243 | `UNVERIFIED` |
| GROQ | configured | healthy | 200 | 14 | `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` | 137 | `UNVERIFIED` |
| MISTRAL | configured | healthy | 200 | 48 | `mistral-large-latest`, `codestral-latest` | 600 | `UNVERIFIED` |
| OPENROUTER | configured | healthy | 200 | 417 | `deepseek/deepseek-chat`, `google/gemini-2.5-flash` | 149 | `UNVERIFIED` |
| UPSTAGE | configured | unhealthy | 4xx | - | - | 113 | `UNVERIFIED` |
| GEMINI | configured | unhealthy | 4xx | - | - | 101 | `UNVERIFIED` |
| ANTHROPIC | configured | healthy | 200 | 10 | `claude-sonnet-4-6`, `claude-opus-4-6` | 273 | `UNVERIFIED` |
| OPENAI | configured | unhealthy | 4xx | - | - | 149 | `UNVERIFIED` |
| OLLAMA | not_required | unhealthy | timeout | - | - | 10010 | `UNVERIFIED` |

오류 Provider의 상세 응답 본문과 상태 원인은 비밀·응답정보 노출 방지를 위해 기록하지 않고 `HTTPError`/`URLError` 계열만 확인했다. 모델 catalog 기준 hash 또는 사전 baseline이 없어 drift는 모두 `UNVERIFIED`다.

## 검증 및 안전 확인

- 9개 Provider credential presence 확인: PASS (원문 비노출)
- 모델 목록 GET probe: 9/9 실행 완료
- timeout 경계: PASS (최대 10초)
- 생성/채팅/embedding 등 과금 가능 호출: 미실행
- Telegram signed POST: `NOT_EXECUTED` (이번 담당 범위 제외)
- DB audit/event mutation: `NOT_EXECUTED`
- 실제 API `/api/providers` route: 인증 경계로 인해 호출하지 않음; 직접 non-billing provider probe로 대체

## 잔여 조치

1. UPSTAGE/GEMINI/OPENAI의 4xx 원인을 키 원문·응답 본문 없이 provider별 status metadata로 확인한다.
2. OLLAMA endpoint/네트워크 도달성을 확인한다.
3. catalog baseline을 확정한 뒤 drift hash를 산출한다.
4. Telegram signed POST는 별도 승인 범위에서 1회 실행한다.

