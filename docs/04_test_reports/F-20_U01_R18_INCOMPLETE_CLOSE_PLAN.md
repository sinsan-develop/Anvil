# F-20/U-01 R18 epoch31 미완료 종료 계획

## 판정·근거

기준 `ee30f5749f353e20f246dd75efd9f410bc38b586`는 R18 guard/`INCOMPLETE` 결과의 기존 branch/private remote/WSL-server 동일 SHA·clean/G-05 seq1900이다. 정식 Run 생성의 append-only `run_events` 때문에 기존 WorkInstruction의 row-only teardown을 만족할 수 없고, 실제 PG 테스트는 미작성·미실행이다. Guard 로컬 10 PASS/1 opt-in SKIP만 확인됐으며 이를 R18 완료로 승격하지 않는다. 같은 원인의 정식 Developer `FAILURE_REPORT`는 0회다.

## 종료 통제

- 기존 Event 원문 prefix와 C30 `OPEN_BLOCKING`/DEFER를 보존해 epoch31의 write→worker lease만 seq1901~1902로 회수한다. canonical worker/write는 null, 제품 write scope는 빈 목록으로 만든다. `active_work_instruction.result_status`는 `INCOMPLETE_R18_PG_TEST_NOT_EXECUTED`로 기록하고 F-20/U-01 수락과 완료 package는 변경하지 않는다.
- Main은 종료 overlay·전용 테스트를 RED→GREEN으로 검증하고 R17 close/R18 start 인접 회귀·G-05·diff를 확인한 후 기존 branch checkpoint/private push→WSL-server 동일 SHA·clean을 확인한다. Developer 제품 write는 이 동안 재개하지 않는다.
- 후속은 teardown 문구를 **전용 tmpfs PostgreSQL container 전체 폐기**로 바로잡은 별도 WI revision과 신규 dual lease다. 제품 exact2 자체는 유지한다. 직접 SQL INSERT·append-only trigger 변경·공유 DB 삭제는 허용하지 않는다. 새 승인 범위·공개 API·schema·권한·Production 작업은 없다.

이 종료는 중단 지점의 안전한 회수이며 QA PASS가 아니다. R18 전용 DB/container/venv는 아직 생성되지 않았고 로컬 pytest base는 제거·잔여0이다. rollback은 이 종료 통제 commit만 정상 revert하되 Event 원문을 reset/재직렬화하지 않는 방식으로 별도 검증한다.
