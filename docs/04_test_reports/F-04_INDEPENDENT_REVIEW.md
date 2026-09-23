# F-04 Independent Review

## 판정

`ACCEPT` — Critical 0 / Important 0 / Minor 0

## 판단 이유

- 최초 검토의 Important 2건(`F04-CANONICAL-PROVIDER-ID-v1`, `F04-GROQ-WIRE-COMPAT-v1`)은 각각 1회 발견됐고 R1에서 해소됐다.
- canonical Provider ID는 lowercase `groq`만 허용하며 uppercase 입력은 transport 호출 전에 `PROVIDER_MISMATCH`로 거부한다.
- Groq 공식 OpenAI-compatible 계약에 맞춰 additive completion/model metadata, role-only delta, 비종단 `usage:null`, `choices:[]` final usage frame을 수용한다.
- stream payload는 `stream_options.include_usage=true`를 요청하고, final usage 이후 frame은 `RESPONSE_MALFORMED`로 거부하며 receipt를 남기지 않는다.
- 공식 대조 근거: `https://console.groq.com/docs/api-reference`, `https://console.groq.com/docs/openai`.

## 독립 검증

- focused: `45 passed in 0.08s`
- 관련 회귀: `754 passed, 4 skipped in 8.59s`
- compile: `compile-ok 4`
- 확장 inline 재현 5개: PASS
- `git diff --check`: exit 0
- exact5 scope: 차이 없음
- trailing whitespace: 0

4개 skip은 `ANVIL_B10_PG18_DSN`이 없는 PostgreSQL 18 격리 테스트이며 DB PASS로 승격하지 않는다.

## 미검증 범위

실제 GROQ API, credential/Secret Broker, network, upstream abort 전파, invoice reconciliation,
DB, UI/browser, container, WSL, staging, production, deployment는 실행하지 않았다.
