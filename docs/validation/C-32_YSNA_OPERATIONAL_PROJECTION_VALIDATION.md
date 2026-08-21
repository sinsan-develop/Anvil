# C-32 ysna 운영 검증 successor projection

## 판정

`C-32` 운영 검증 증거를 Phase B Gate의 historical sequence 1~374와 분리된 successor projection으로 연결한다. 이 기록은 Phase B Gate acceptance나 C-01 시작을 의미하지 않는다.

## 운영 증거

- 대상: `ysna-server`, `~/deploy/anvil`, `anvil.sinsan.kr`
- 전용 PostgreSQL database: `anvil`
- 전용 application role: `anvil_app`
- migration head: `0011_telegram_webhook_state`
- web liveness/readiness: `200 / 200`
- Telegram `setWebhook`: 성공
- Telegram `getWebhookInfo`: 등록된 운영 webhook과 오류 없음 확인
- Nginx/NPM 외부 경로: `anvil.sinsan.kr/integrations/telegram/webhook`
- 운영 비밀값: 값은 기록하지 않고 서버 runtime env에만 유지

## 정합성 경계

기존 Phase B Gate event, B-01~B-12 acceptance, authority hash와 기존 detached digest는 수정하지 않는다. 본 문서는 운영 결과를 후속 successor로만 연결한다. C-01과 Phase B Gate acceptance는 계속 `BLOCKED`/`TEST_REVIEW`다.

## 검증 범위와 미실행

운영 배포·DB·readiness·webhook 경로의 실제 증거만 운영 PASS로 기록한다. C-01 기능 구현, Phase B Gate 결정, 공개 Release 승격, 추가 제품 범위 변경은 실행하지 않았다.

