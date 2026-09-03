# C-21 / LR-02C Rework WorkInstruction R3

- ID: `WI-C-21-LR-02C-R3-20260903-001`
- 부모 WorkInstruction: `WI-C-21-LR-02C-20260903-001`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 변경 분류: `MAIN_RECONFIRMED_NON_SEMANTIC`
- 범위·요구사항·중요 위험 변경: 없음
- 실행자: `main-agent-eoul` (epoch2 takeover lease 연속)

## 목표

R2 독립 검토 finding `C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN`을 닫는다.

## 변경 계약

1. `c21-test-session-incident-hold.json`은 sticky/monotonic 증거다.
2. 기존 INCIDENT_HOLD가 있으면 backup, Git, Docker, HTTP, DB, Telegram, Provider 호출 전에 fail-close한다.
3. verify 정상 경로는 기존 incident receipt를 삭제하거나 덮어쓰지 않는다.
4. 해제·복구는 별도 사람 승인과 resolution artifact에 결박된 운영 동작으로만 허용하며 R3 구현 범위에서는 수행하지 않는다.
5. 차단 재실행은 기존 incident bytes/hash와 외부 호출 log를 변경하지 않는다.
6. 기존 exact12 write scope, Provider non-billing, Telegram one-shot, restore/recreate, secret redaction 계약은 유지한다.

## 검증

- RED에서 기존 incident가 있어도 재실행이 진행되는 실패를 확인한다.
- GREEN에서 재실행 exit 91, incident bytes 불변, 외부 호출 log 불변을 확인한다.
- deploy exact suite, API, progress checker, shell/Python syntax, diff check를 재실행한다.
- 외부 ysna side effect와 C-01 시작은 계속 금지한다.
