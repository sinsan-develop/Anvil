# F-20/U-01 R12 범위 지정 Run 읽기 owner WorkInstruction

- 발행자: Main 어울. 효력 조건: canonical WI Event·새 worker/write dual lease·G-05 PASS 전 제품 수정 금지.
- 상위 권위: 승인된 Anvil 설계·작업계획·매트릭스·테스트계획과 `docs/04_test_reports/F-20_U01_R12_SCOPED_RUN_READ_PLAN.md` (SHA-256 `8A7F5876F1D3DC1E4085B3383B80D79E57F444F48E10282DB52BD80A3409C401`).
- 분류: 승인된 U-01 Dashboard의 내부 Run 관측 owner. 공개 API/BFF·권한·UI·DB schema/지속 데이터 변경 없음.

## 정확한 제품 쓰기 범위

1. `packages/persistence/operations_run_read.py`
2. `tests/persistence/test_f20_u01_run_read.py`
3. `docs/04_test_reports/F-20_U01_R12_SCOPED_RUN_READ_RESULT.md`

## 구현·완료 조건

- 신뢰된 Engine 및 이미 인가된 project/environment ID만 입력한다. 비정규 ID는 DB 접근 전 거부한다. `REPEATABLE READ`·`READ ONLY` 한 거래에서 DB 시각과 `tasks.project_id`/`runs.environment_id`가 일치하는 Run만 `run_id` 안정 순서로 읽는다.
- 반환 필드는 `run_id`, `task_id`, `phase`, `status`, `version`과 관측시각뿐이다. phase/status는 `packages.execution.models.RunPhase`/`RunStatus`, version은 양의 정수로 확인한다. 101행·같은 Project의 legacy NULL environment·malformed row·DB 오류는 안정 코드로 fail closed하며 driver/SQL/Secret 원문을 노출하지 않는다.
- RED→GREEN으로 정상·교차 Project/Environment·0/100/101행·legacy NULL·잘못된 ID/enum/version·DB 장애·읽기 무변경·비밀값 비노출을 검증한다. 인접 Run 생성/Queue source 회귀를 실행하고 결과보고에 시작 HEAD/branch/status, diff, 정확한 명령·exit·결과, 미검증·rollback을 남긴다.
- Developer는 exact3 외 파일 수정, commit/push/merge/WSL-server·공유 자원·ysna/Production 접근을 하지 않는다. Main이 독립 diff/테스트, 사설 push→WSL-server 동일 SHA 실제 PostgreSQL15 검증 및 임시 자원 정리를 담당한다.
- Dashboard 공개 응답이나 화면에는 아직 연결하지 않는다. 이 단위는 Project/Agent/Worker 전체 상태·Next Actions·U-01/F-20 수락·C30 복구를 완료하지 않는다.
