# C-21 R2 WorkInstruction — 최소 운영 경계 검증

## 목적

C-21의 미검증 운영 경계를 승인된 최소 범위로 확인한다. 제품 코드·배포·schema 변경은 금지한다.

## 실행 범위

1. Provider 9개(CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA)의 credential 값은 출력하지 않고 configured/disabled, capability, drift 상태만 확인한다. 외부 요청은 비과금·최소 health/capability probe로 제한한다.
2. `anvil.sinsan.kr` Telegram webhook에 signed test POST 1회만 실행한다. allowlist·secret·nonce/replay·고위험 command 거부와 감사 행을 확인한다.
3. 승인된 인증 세션으로 same-origin SSE를 1회 연결하고 `Last-Event-ID` 재연결을 확인한다. 토큰·credential·내부 upstream 주소는 기록하지 않는다.
4. 생성된 테스트 감사 데이터는 검증 후 보존 또는 정리 결정을 기록한다. 정리 시 대상 식별자와 결과만 남긴다.

## 금지

- Provider key/Telegram token 원문 출력 또는 파일 커밋
- 과금 가능 completion/chat 호출
- 운영 사용자 데이터 변경, schema migration/downgrade, webhook 설정 변경, 배포
- 인증 우회, Host/CORS 보안 완화, 내부 주소의 브라우저 노출

## 승인 경계

실제 Provider probe, Telegram signed POST, 인증 SSE 검증은 신산님의 명시 승인을 받은 뒤에만 실행한다. 승인 전 상태는 `WAITING_APPROVAL`로 기록한다.

## 완료 증거

- 실행 명령·시각·대상 환경·HTTP 상태·응답 분류
- Provider별 configured/capability/drift 결과(비밀값 제외)
- Telegram update idempotency/replay/audit 결과와 데이터 보존·정리 결정
- SSE 연결·재연결·`Last-Event-ID` 결과
- EvidenceManifest와 C-21 R2 보고서의 hash
