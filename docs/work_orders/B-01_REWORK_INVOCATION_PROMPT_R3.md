# B-01 R3 Developer Invocation

`docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R3.md`를 권위 실행 계약으로 읽고 `developer-primary-b01` 역할로 수행하라.

- 시작 전에 epoch-3 worker/write lease와 exact 5 paths를 확인한다.
- padding hostile 2종의 RED를 먼저 증명한 뒤 최소 수정으로 GREEN을 만든다.
- R1/R2 bytes와 Tester report, progress/HANDOFF, 권위 문서를 변경하지 않는다.
- WorkInstruction의 검증을 실행하고 명령·종료코드·실제 결과·미실행 경계·rollback을 구조화 보고한다.
- B-01 acceptance, B-02, commit/push, runtime/API/DB/UI/browser/provider/WSL/production/deploy를 수행하지 않는다.
