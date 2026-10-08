# F-20/U-01 R18 R1 실제 PG15 QA 완료·epoch32 lease 종료 계획

기준 `54ada077e12c48e536c7b082f5e14e34dcce9224`는 기존 `codex/f18-wsl-ops`/private remote/WSL-server 격리 QA checkout 동일 SHA·clean/G-05 seq1906이다. R18 실제 opt-in PG15 `11 passed, 1 skipped`, 인접 `97 passed, 2 skipped, 1 warning`, 전용 DB/container/venv/pytest/port 잔여0을 `docs/WORK_STATUS.md`에 기록했다. R18 결과보고서의 원 epoch31 `INCOMPLETE`와 R1 로컬 `COMPLETED`는 모두 보존한다.

- Event 원문 prefix를 보존하고 epoch32 write→worker lease만 seq1907~1908로 순차 회수한다. canonical worker/write는 null, 제품 write scope는 빈 목록으로 만든다. R18 R1의 실제 PG15 QA만 완료로 표기하고 F-20/U-01 package acceptance·C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`·main 미병합은 그대로 둔다.
- Main은 종료 projection과 R18 start/close 인접 테스트를 검증하고 G-05·diff·정확한 경로만 기존 branch checkpoint/private push→WSL-server 동일 SHA로 맞춘다. 브라우저 E-SHOT/E-NET·PostgreSQL18 RC·전체 F-20 수락·Production은 이 QA 결과로 승격하지 않는다.
- 초기 일회성 DB 자격 출력 사고는 첫 컨테이너 즉시 폐기·재생성으로 무효화됐으며 구체 비밀은 어디에도 기록하지 않는다. 임시 자원은 모두 정리됐고 공유 DB/서비스·ysna/Production 변경0이다.

Rollback은 종료 통제 commit을 별도 정상 revert·재검증하는 방식이며 Event 원문을 reset/재직렬화하지 않는다.
