# F-18 WSL 운영 유사 실행 지시

`F-18_WSL_OPS_WORK_INSTRUCTION.md`와 canonical progress의 현재 유효 worker/write fencing token을 확인한 뒤, Task별 exact write lease 경로에서만 로컬 TDD를 수행한다. 로컬 commit을 `development` SSH alias로 push한 후 WSL-server에서 같은 SHA를 Git으로 받아 테스트한다. F-17 과거 SHA/image나 합성 사전검증을 현재 WSL 운영 유사 PASS로 승격하지 않는다. WSL 전용 자원 이외의 서비스·DB를 수정하지 않고, `ysna-server`·Production에는 접속하지 않는다. 완료보고는 판정→근거→조치, 정확한 명령/exit·변경 파일·미검증·잔여 자원·rollback을 포함한다.
