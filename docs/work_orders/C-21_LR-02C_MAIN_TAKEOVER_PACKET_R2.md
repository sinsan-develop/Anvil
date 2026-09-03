# C-21 / LR-02C Main Takeover Packet R2

- Lineage: `C-21/LR-02C`
- Trigger: 동일 `WINDOWS_BACKUP_RECEIPT_MODE_HARNESS_MISMATCH` 내부 오류 3회 및 사용자 운영 규칙
- Independent failure fingerprint: `C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED`
- Valid independent failures: `1`
- Classification: `MAIN_AGENT_TAKEOVER_REQUIRED`, 기능 범위·요구사항·중요 위험 변경 없음
- Frozen Developer result: exact12, 외부 side effect 없음
- Main actor: `main-agent-eoul`

## 인수 범위

Main은 기존 LR-02C exact12만 순차 수정한다. 제품 변경은 `deploy/ysna/verify.sh`와 관련 deploy 계약 테스트 및 기존 progress/evidence 경로로 제한한다.

완료 조건은 다음과 같다.

- 최초 rebind 이후 모든 성공·실패 경로에서 원본 env restore
- restore 후 `anvil-web` force recreate
- restore 또는 recreate 실패 시 `INCIDENT_HOLD`
- 성공, SSE 실패, Telegram 불확실, Provider 오류 restore 계약 테스트
- receipt에는 restore hash와 runtime recreate 판정만 기록하고 secret을 남기지 않음
- 외부 SSH/Docker/DB/Telegram/Provider/배포는 실행하지 않음

Developer epoch1 token은 회수하며 Main epoch2 token 외 mutation을 허용하지 않는다.
