# C-21 / LR-02C Operational Execution Rework R2 Invocation

`C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md`와 epoch5 fencing token을 기준으로 backup script의 SQLAlchemy/libpq DSN scheme 호환 결함만 TDD로 수정한다. seq1~469와 동결 acceptance는 변경하지 않고 exact13 write scope를 지킨다. 새 release binding 전 운영 backup 재시도와 Telegram/Provider 실호출은 금지한다.
