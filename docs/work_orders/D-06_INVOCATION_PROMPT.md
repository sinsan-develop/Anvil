`D-06_WORK_INSTRUCTION.md`의 ID/hash, D-05 acceptance, 현재 worker/write fencing과 exact6를 확인한 뒤 test-first로
구현하라. D-05 review action을 source-bound candidate→evaluation→human approval→next-run activation→use/rollback/
quarantine 계보로 만들고 source revoke 시 신규 사용을 차단하라. 실제 Skill/Hook runtime, DB/HTTP/queue, Git mutation은
수행하지 말라. focused/관련 회귀, compileall, diff-check와 완료보고를 남긴 뒤 구조화 상태로 반환하라.
