# C-27 WorkInstruction — Kakao adapter contract-only

## 목적

C-25 gateway와 C-26 Telegram 보조 adapter의 공통 계약을 바탕으로 Kakao adapter 경계를 정의한다. 공식 Kakao API/auth/quota가 확인되지 않은 상태이므로 외부 호출 없이 contract-only·fail-closed로 구현한다.

## 허용 범위

- Kakao inbound/outbound envelope와 actor/session/receipt 계약
- 상태 조회·저위험 command의 계약 projection 및 Web Console deep-link
- replay/idempotency/rate/privacy/audit 계약
- 고위험 승인·배포·삭제·권한·Provider 변경 및 미확정 API/auth/quota는 OPEN_DECISION + fail-closed
- 실제 Kakao SDK/API/network/token/auth/DB/WSL/UI/deploy는 실행하지 않음

## exact write scope

1. packages/agent_team/kakao_adapter.py
2. packages/agent_team/__init__.py
3. tests/agent_team/test_kakao_adapter_c27.py
4. tests/agent_team/test_kakao_contracts_c27.py
5. tests/agent_team/test_kakao_privacy_c27.py
6. tests/agent_team/test_kakao_replay_c27.py
7. docs/04_test_reports/C-27_COMPLETION_REPORT.md

## 완료 조건

RED→GREEN focused tests, `tests/agent_team` 회귀, compile/diff-check, exact7 SHA와 OPEN_DECISION·미검증 범위·rollback을 보고한다. 외부 계약 미확정은 PASS로 승격하지 않는다.
