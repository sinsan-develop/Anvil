# F-20/U-01 R24 Developer Invocation

Main이 기존 branch·WSL-server 동일 SHA checkpoint와 신규 canonical worker/write dual lease ACTIVE를 확인한 뒤 `developer-primary-f20-u01-r24` 단일 writer에게 다음 실행 지시를 전달한다.

> `docs/work_orders/F-20_U01_R24_EMPTY_ERROR_BROWSER_QA_WORK_INSTRUCTION.md`의 exact3만 수정한다. 두 fencing token, 기준 SHA/hash, 시작 Git status를 먼저 확인한다. 브라우저 하네스의 빈 결과와 결정론적 오류 실패 탐지에 대해 예상 RED→GREEN을 수행하고 로컬 회귀·임시자원 정리·결과보고를 Main에게 인계한다. Main 통제 파일·Git/WSL/DB/운영은 변경하지 않는다.
