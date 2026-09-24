# F-18 Local/WSL 개발 실행 지시

`docs/work_orders/F-18_LOCAL_WSL_PREFLIGHT_PLAN.md`의 Task 1·2를 exact 제품 write lease 안에서 TDD RED→GREEN으로 구현하고 기본 검증 결과를 Main에게 반환한다. `ysna-server`에는 접속하거나 변경하지 않는다. Production·OIDC·object storage·network policy의 실제 검증이나 F-18 전체 acceptance를 주장하지 않는다. 결과에는 시작 HEAD/status, 변경 파일·diff, 정확한 명령/exit, 미검증과 rollback을 포함한다.

R2 후속 실행에서는 동일 계획서 Task 4만 새 canonical worker/write lease의 exact3 경로 안에서 수행한다. Task 1·2의 완료 코드를 다시 작성하지 않으며 승인 remote/tag/commit/clean 검증은 기존 F-16 guard를 사용한다. 로컬 제품 파일과 보고서 외에는 쓰지 않고, WSL/Production 접속·push·PR·병합은 Main에게 맡긴다.

R3 후속 실행에서는 동일 계획서 Task 5만 새 canonical worker/write lease의 exact3 경로 안에서 TDD로 구현한다. 기존 F16/F18 검증을 우회하거나 재작성하지 말고 CLI의 신뢰 입력·출력·실패 차단을 검증한다. `deploy/ysna`·WSL·Production 접속·push·PR·병합은 하지 않는다. 결과를 Production 승인/배포 PASS로 표현하지 않는다.
