# C-30R4 invocation

`C-30R4_PROGRESS_CHECKER_REPAIR_WORK_INSTRUCTION.md`를 기준으로 exact2만 수정한다.
compile regression을 먼저 RED로 확인하고, 지정된 destructive hunk와 authoritative C03 R2 harness
constant만 복원한다. 테스트 기대값 완화·historical evidence rewrite·다른 파일 변경은 금지한다.
각 RED/GREEN 명령·exit·건수, diff 범위와 잔여 미검증을 보고한다. commit/push는 Main 소유다.
