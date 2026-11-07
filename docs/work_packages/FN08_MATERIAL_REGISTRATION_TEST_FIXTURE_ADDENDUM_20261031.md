# FN08 지속등록 — 인접 PG fixture 적응 부록

상태 MAIN_RECONFIRMED_NON_SEMANTIC. 직접승인 FB59E8C7A040D69CF9D11D8E753A3F5573647BE430E8A95E950EC2BABACABE6C와 원 WI490C5E0D839EC380B54CCD2870FC2CDD133AC0290CB7E8B2FCF5A4ECFC36D7F6의 의미·보호/검증 기준은 그대로다. 기존WI는 동결하고 이번 내부 시험 경로만9번째로 추가한다.

- 허용: tests/unit/FN08/execution-instruction-queue.test.ts / 시작 SHA256 2BB34FB4BCD7C2E7465D92B805F427AC98957C326FDF5A63BAED7A16D58850E8.
- 사유: PG adapter 양성 fixture가 등록 producer 없이 기존 예약/명령/outbox INSERT3개만 모사한다. 새필수등록을 건너뛰지 않으려면 해당309~321 주변 setup을 실제 registrar·descriptor/source 메모리 행으로 적응해야 한다.
- 한정 변경: 필요한 import·PG fixture/setup·메모리 SQL 분기/신규 registrar 의존 주입만. 기존 예약/outbox/receipt/권위false/replay·rollback 단언은 유지하고, 새등록으로 늘어나는 추가행은 종류별로 검산한다. 기존 INSERT 총3개 단언은 예약/명령/outbox3개라는 동일 의미로 대상만 좁혀 보존하며 새등록을 count에서 숨겨 성공을 합성하지 않는다.
- 금지: 파일 전체 재작성·expectation/guard 완화·기존 반례 삭제/skip·가짜AVAILABLE·새public/source종류/SQL대상확대·실환경 실행0. readonly 역사2소비자는 수정하지 않는다.

같은Primary 단일writer가 수행하고 Main은 코드 수정 없이 fresh 인접검증/독립diff검수로 기존 반례가 실제 검사까지 도달하는지 확인한다. 새 기능·권한·중요위험을 넓히는 변경이 아니므로 기존 직접승인을 반복 요청하지 않는다.
