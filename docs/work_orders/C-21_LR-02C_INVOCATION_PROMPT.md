# C-21 / LR-02C Invocation

`WI-C-21-LR-02C-20260903-001`을 읽고 exact12 lease 안에서만 TDD로 운영 실행 도구와 계약 테스트를 구현한다. 외부 SSH/Docker/DB/Telegram/Provider 호출과 commit/push는 하지 않는다. Task confirm은 C-21 전용 CAS provisioning으로 제한하고, Last-Event-ID는 단일 event 미재전송으로 검증하며, Provider generation 계열 endpoint는 코드 차원에서 거부한다. 정확한 명령·exit code·결과·변경 경로·미검증 범위·rollback을 보고서와 evidence에 기록하고 계약 상태로 반환한다.
