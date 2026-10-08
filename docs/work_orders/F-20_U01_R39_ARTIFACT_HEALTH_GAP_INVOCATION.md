# F-20/U-01 R39 Developer Invocation

현행 단일 branch의 clean 기준 commit, 계획/WI hash와 canonical worker/write fencing token을 Main이 전달하고 유효성을 확인한 뒤 실행한다. `developer-primary`는 WorkInstruction exact4 안에서 테스트 RED→최소 수정 GREEN→로컬 회귀·G-05·diff 검증→결과보고까지만 수행한다. Main의 Git/WSL QA 및 Event/lease 종료는 맡지 않는다. 차단이나 실패는 근거·오류 횟수·남은 일을 구분해 보고한다.
