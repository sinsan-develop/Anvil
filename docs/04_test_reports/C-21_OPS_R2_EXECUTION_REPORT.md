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
| UPSTAGE | configured | unhealthy | 401 | - | - | 113 | `UNVERIFIED` |
| GEMINI | configured | unhealthy | 400 | - | - | 101 | `UNVERIFIED` |
| ANTHROPIC | configured | healthy | 200 | 10 | `claude-sonnet-4-6`, `claude-opus-4-6` | 273 | `UNVERIFIED` |
| OPENAI | configured | unhealthy | 401 | - | - | 149 | `UNVERIFIED` |
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

## Telegram signed POST 1회 실행 결과

신산님 승인 후 테스트 identity `7253893482:7253893482`와 `/status` fixture로 공개 webhook에 POST를 정확히 1회 실행했다. 응답은 HTTP `400` / `invalid host`였으며, 전후 `telegram_webhook_updates`, `telegram_webhook_audits`, `telegram_webhook_rate_limits` 행 수는 모두 `0`이었다. 따라서 감사 side effect와 업무 데이터 변경은 발생하지 않았다.

- 실행 횟수: 1회 (재전송 없음)
- token·secret·Authorization·원문 payload: 미기록
- 원인 분류: 공개 Host가 webhook 경계의 허용 host와 일치하지 않는 설정 불일치 의심
- read-only 확인: NPM `/integrations` location은 `proxy_set_header Host $host`; 런타임에는 `ANVIL_CONSOLE_BASE_URL=anvil.sinsan.kr`가 설정되어 있으나 `ANVIL_PUBLIC_HOST`는 별도 설정되지 않음
- 후속 조치: 동일 fixture 재전송 금지. Host 설정 수정은 별도 제품/운영 변경 승인 없이는 수행하지 않음.

## C-21 R3 승인 조치 및 재검증

신산님이 Host 설정 보완과 추가 signed POST 1회를 승인했다. 승인 범위에서 다음을 수행했다.

- ysna-server runtime env에 `ANVIL_PUBLIC_HOST=anvil.sinsan.kr`를 추가하고 기존 env 백업을 생성했다.
- Nginx Proxy Manager는 재시작하지 않고 Anvil 내부 `web` 서비스만 `--force-recreate`했다.
- 재배포 후 공개 `anvil.sinsan.kr/integrations/telegram/webhook`에 signed POST를 정확히 1회 추가 실행했다.
- 추가 POST도 HTTP `400` / `invalid host`로 종료했고, 세 webhook 상태 테이블 행 수는 전후 모두 `0`이었다.

추가 POST 승인 횟수는 소진되었으므로 동일 fixture를 더 이상 재전송하지 않는다. 공개 health/OpenAPI와 일반 API Host 검증은 정상이나 Telegram webhook 경계만 계속 실패한다.

## 접근 복구 후 read-only 대조

도구 실행 권한을 승인받아 ysna-server read-only 확인을 수행했다. NPM access log는 승인된 POST를 `https anvil.sinsan.kr "/integrations/telegram/webhook"`으로 기록하고, 생성 설정은 `server_name anvil.sinsan.kr`, `/integrations`의 `proxy_pass http://anvil-web:3770`, `proxy_set_header Host $host`로 확인된다. `anvil-internal-web-1`에는 `ANVIL_PUBLIC_HOST=anvil.sinsan.kr`, `ANVIL_CONSOLE_BASE_URL=https://anvil.sinsan.kr`가 전달되어 있다.

DNS/NPM 공개 Host 오기록은 배제되었지만 API handler가 실제 전달받은 Host를 현재 로그에 남기지 않아 추가 POST 없이 최종 원인을 확정할 수 없다. 원인은 `UNRESOLVED_EXTERNAL_HOST_PATH`로 분류하고, C-21 acceptance와 C-01 시작은 보류한다. 다음 조치는 비밀·payload를 남기지 않는 request-host metadata 진단 또는 별도 승인된 재시도다.

## C-21 승인 재배포 후 검증

- 승인된 수정 커밋 `c7826ca20c25d4f5627b2995e4cab479f3ca7fc8`를 표준 `deploy.sh`로 배포했다.
- migration과 `anvil-internal-web-1` 재생성은 성공했고 컨테이너는 `healthy`다.
- 공개 `/health/live`, `/health/ready`, `/openapi.json`은 200이다.
- 공개 `/api/runs/run-1/events`는 401로 인증 경계를 유지한다.
- 실행 중 API 컨테이너의 Host 파생값은 `anvil.sinsan.kr`이다.
- authenticated SSE/Last-Event-ID 운영 검증은 세션 자격증명 부재로 `NOT_EXECUTED`다.
- Telegram 추가 POST는 승인 횟수 소진으로 수행하지 않았다.
