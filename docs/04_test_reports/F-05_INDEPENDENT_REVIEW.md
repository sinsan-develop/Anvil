# F-05 Independent Review

## 판정

`ACCEPT` — Critical 0 / Important 0 / Minor 1 (문서화된 잔여 주의점)

## 판단 이유

- 최초 독립 검토의 Important 4건은 같은 F-05 제품 exact5 안에서 수정됐다: stream 취소 직후 빈 출력 계약 오류, 실패 요청 ID의 변경 입력 재전송, generate 전송 중 취소 상태 누락, 129자 요청 ID의 사후 거부.
- 실패한 요청 ID도 최초 입력 fingerprint를 전송 전에 예약한다. 동일 입력 재시도는 허용하고 변경 입력은 전송 전에 거부한다.
- stream은 취소 요청 뒤 실제 도착한 content와 provider final usage를 보존한다. content가 전혀 없으면 공통 응답 계약상 `ABORTED`로 반환하되 receipt의 `transport_sent=true`와 `usage_provenance=PROVIDER_FINAL`로 전송 전 확정 취소와 구분한다. 이 상태 명칭의 의미상 주의점 1건은 완료보고서에 기록됐으며 통합 차단 사유는 아니다.
- OmniRoute `release/v3.8.51`의 built-in `mistral` provider와 OpenAI-format chat, `/v1/models` discovery, stream final usage, bare 401 인증·quota 모호성 처리가 일치한다. 동적 `openai-compatible-responses-UUID` 연결 ID와 혼동하지 않았다.

## 독립 검증

- focused: `58 passed`, exit 0.
- 관련 provider·registry 회귀: `812 passed, 4 skipped`, exit 0.
- 제품 4개 Python 파일 compile: `compile-ok 4`, exit 0.
- 네 결함 재현과 수정 후 회귀를 재확인했다. 제품 exact5 외 파일은 reviewer가 수정하지 않았다.

`4 skipped`는 실행되지 않은 검증이며 PASS로 승격하지 않는다.

## 미검증 범위

실제 Mistral API, 키 유효성·quota, network, DB, UI/browser, WSL, deployment는 실행하지 않았다. 키 문제로 인한 실제 연동 오류는 제품 결함으로 집계하지 않는다.
