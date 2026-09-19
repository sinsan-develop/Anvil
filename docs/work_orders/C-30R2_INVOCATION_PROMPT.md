# C-30R2 Task1 InvocationPrompt

canonical checkout `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`에서
`docs/work_orders/C-30R2_WORK_INSTRUCTION.md`를 완전히 읽고 current dual lease/exact3를 확인한다.

Task1만 수행한다. 계약 테스트를 먼저 RED로 실행한 뒤 WI의 machine-readable fixture/hash를 고정한다.
제품 repository/persistence/runtime/migration 파일은 생성·수정하지 않는다.
contract_fixture GREEN과 미구현 product_contract RED를 분리 보고하며 제품/DB 완료로 승격하지 않는다.
0015 계획과 release0013 충돌은 Task2 전 Main 결정 항목으로 유지한다.

기존 dirty/untracked 및 Main control 변경을 보존한다.
Git mutation, DB/WSL/Docker/Provider/network/UI/deploy 실행과 scope 밖 문서 변경을 하지 않는다.
정확한 pytest 명령/exit/result, 구문·diff 결과, exact3 SHA256, 미검증, rollback을
COMPLETED(Task1 한정) 또는 유효한 FAILURE_REPORT로 반환한다. 별도 report/progress 파일은 쓰지 않는다.

