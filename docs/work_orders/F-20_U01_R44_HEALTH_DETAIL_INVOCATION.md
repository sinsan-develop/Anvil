# F-20/U-01 R44 Developer Invocation

Main이 기존 단일 branch의 clean/private 시작 commit, 계획·WorkInstruction hash, canonical worker/write lease ID·epoch·두 fencing token과 exact5를 전달하고 유효성을 확인한 뒤에만 시작한다. `developer-primary`는 WorkInstruction exact5에서 RED→최소 구현 GREEN→로컬 검증→결과보고까지만 수행한다. Main의 commit/push·WSL-server QA·Event/lease 회수는 맡지 않는다. 실패는 근본 원인·증거·정식 실패 횟수·남은 작업을 분리해 보고한다.
