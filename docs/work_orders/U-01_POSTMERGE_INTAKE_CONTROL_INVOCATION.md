# U-01 postmerge 통제 실행 지시

1. `U-01_POSTMERGE_INTAKE_CONTROL_WORK_INSTRUCTION.md`와 현재 branch/HEAD, seq2269, PR #39 계보, 유효한 epoch97 두 lease의 정확 경로·token·만료를 확인한다.
2. Main의 A 문서가 local/private 동일·clean임을 확인한 뒤 exact2 검사기·테스트만 TDD로 수정한다. 제품·다른 문서·Git·WSL-server에는 쓰지 않는다.
3. 실제 명령/종료 코드, RED→GREEN, G-05, 인접 회귀, diff·Ruff 신규 진단, 정확 SHA, 미검증·rollback을 Main에게 보고한다. C/B/H 게시와 제품 승인 판정은 Main 소유다.
