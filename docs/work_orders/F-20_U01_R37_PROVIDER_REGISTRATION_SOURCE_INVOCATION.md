# F-20/U-01 R37 단일 Developer 실행 지시

canonical epoch52 worker/write fencing lease와 WorkInstruction exact4를 먼저 검증한 뒤, R37 계획의 Provider 등록 상태 host 결선만 TDD로 수행하십시오. `ProviderStatusService`의 이미 정해진 `DEGRADED/NOT_CONFIGURED`와 `NOT_CHECKED`를 그대로 사용하고 실제 건강이나 비용을 추정하지 마십시오. 로컬 결과보고 후 Main에게 `COMPLETED`/정식 `FAILURE_REPORT`/`INCOMPLETE`/`BLOCKED`를 구분해 인계하고 commit·push·WSL 접근은 하지 마십시오.
