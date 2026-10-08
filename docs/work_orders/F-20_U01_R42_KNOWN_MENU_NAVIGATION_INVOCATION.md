# F-20/U-01 R42 Developer Invocation

Main이 기존 단일 branch의 clean/private 기준 commit, 계획·WorkInstruction hash, canonical worker/write lease ID·epoch·두 fencing token 및 exact5를 전달하고 유효성을 확인한 뒤에만 시작한다. `developer-primary`는 WorkInstruction exact5에서 테스트 RED→최소 구현 GREEN→로컬 회귀/G-05/diff→결과보고까지만 수행한다. Main의 commit/push·WSL-server QA·Event/lease 종료는 맡지 않는다. 오류와 차단은 증거·동일 원인 횟수·남은 일을 분리해 보고한다.
