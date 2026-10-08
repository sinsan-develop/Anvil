# F-20/U-01 R38 단일 Developer 실행 지시

canonical R38 worker/write fencing lease와 WorkInstruction exact6를 확인한 뒤 승인된 R38 scoped budget source만 TDD로 구현하십시오. 기존 예산 의미를 보존하고 다른 scope·불완전 row는 fail-closed로 처리하십시오. 로컬 결과보고 후 Main에게 상태를 구분해 인계하며 commit·push·WSL 접근이나 Main control/status 수정은 하지 마십시오.
