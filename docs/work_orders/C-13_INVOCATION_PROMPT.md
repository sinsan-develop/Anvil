# C-13 R2 Invocation Prompt

C-13 R2 WorkInstruction만 수행하라. 먼저 최신 WorkInstruction·diff·test output·checkpoint·세 실패보고 중 하나라도 없는 기존 경로가 fail-closed하지 않는 RED 테스트를 재현하라. 그 뒤 검증 가능한 불변 reference bundle을 packet/audit hash에 결박하고 stop→revoke→takeover 순서, replay, stale token, 동시 write 0건을 회귀 검증하라. 실제 외부 실행/배포는 금지하며 완료보고서에 기준선·검증·오류·미검증·rollback을 기록하라.
