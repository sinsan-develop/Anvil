# C-21 Provider Status READ 실행 프롬프트

`docs/work_orders/C-21_PROVIDER_STATUS_READ_WORK_INSTRUCTION.md`를 기준으로 `developer-primary`가 구현한다.

- worker lease와 write lease fencing token을 확인한다.
- exact18 밖 파일을 수정하지 않는다. `fastapi_app.py`는 실제 wiring에 필요한 경우만 수정한다.
- 테스트를 먼저 추가해 기대 실패를 확인한 뒤 최소 구현으로 GREEN을 만든다.
- 실제 Provider/Telegram 호출, DB migration, ysna/main/release/install은 수행하지 않는다.
- credential 값과 내부 endpoint가 어떤 응답·로그·OpenAPI에도 노출되지 않음을 검증한다.
- 완료 시 actual changed paths가 exact18의 subset임을 manifest에 기록하고 결과 계약으로 보고한다.
