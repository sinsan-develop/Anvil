# F-19A 통합 R48 역사 fixture 보완 실행 지시

정본 `F-19A_INTEGRATION_R48_HISTORY_FIX_WORK_INSTRUCTION.md`와 현재 epoch94 canonical worker/write lease의 두 token·정확 경로를 확인한 뒤에만 시작한다. 테스트 RED→GREEN, 검사기 active route와 음성 차단, 관련 회귀를 수행한다. 변경은 허용된 두 파일만, commit/push/merge는 Main만 수행한다. `scripts/f20_u01_r48_close_overlay.py`와 제품 파일은 수정하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 실제 명령·종료 코드·diff·미검증·rollback을 포함해 보고한다.
