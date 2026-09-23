# C-26 WorkInstruction — Telegram adapter

## 목적

C-25의 transport-neutral SNS Gateway와 Daon User API를 소비하는 Telegram 보조 adapter를 host-only contract로 구현한다. Web Console이 공식 원장이고 Telegram은 보조 Notification/Command 채널이다.

## 허용 범위

- Telegram update/envelope 정규화와 actor/device/session/receipt 연결
- 상태 조회, 저위험 pause/resume 요청, Web Console deep-link 생성
- idempotency/replay/rate-limit, bounded receipt/audit projection
- 고위험 승인·배포·삭제·권한 변경·Provider 변경 요청의 명시적 거부
- 기존 C-25 envelope/result와 C-22/C-23 role/trace 계약 재사용
- Telegram 실제 네트워크·bot token·외부 인증·DB/WSL/UI/deploy는 실행하지 않음

## exact write scope

1. packages/agent_team/telegram_adapter.py
2. packages/agent_team/__init__.py
3. tests/agent_team/test_telegram_adapter_c26.py
4. tests/agent_team/test_telegram_contracts_c26.py
5. tests/agent_team/test_telegram_privacy_c26.py
6. tests/agent_team/test_telegram_replay_c26.py
7. docs/04_test_reports/C-26_COMPLETION_REPORT.md

## 완료 조건

RED→GREEN focused tests, `tests/agent_team` 전체 회귀, 비-E06 회귀, compile/diff-check, exact7 SHA와 rollback을 보고한다. 미실행 external/DB/UI/WSL/deploy 및 checker SyntaxError는 PASS로 승격하지 않는다.
