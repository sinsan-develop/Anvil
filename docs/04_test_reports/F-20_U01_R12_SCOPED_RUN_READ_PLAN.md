# F-20/U-01 R12 범위 지정 Run 읽기 owner 계획

## 목적·경계

승인된 U-01 Dashboard의 Project·Run 상태 정합을 위한 내부 읽기 owner를 한 단위로 만든다. 현재 `tasks.project_id`와 `runs.task_id`·`runs.environment_id`는 존재하지만, 전체 Run을 Project/Environment별로 안전하게 읽는 bounded 포트는 확인되지 않았다. R12는 이 내부 포트만 제공하고 공개 API/BFF 응답·권한·UI·DB schema는 바꾸지 않는다. 별도 `projects` 상태나 Agent·Worker 활성 소유권, U-01/F-20 수락을 주장하지 않는다.

## 읽기 계약

- `load_scoped_run_source(engine, project_id, environment_id)`는 이미 인증·인가된 정확한 범위를 입력받는다. 비어 있거나 비정규화된 ID는 DB 접근 전에 거부한다.
- PostgreSQL `REPEATABLE READ`·`READ ONLY` 한 거래에서 DB 시각, `tasks.project_id`와 `runs.environment_id`가 모두 일치하는 Run을 `run_id` 안정 순서로 읽는다. `run_id`, `task_id`, `phase`, `status`, `version`만 관측하며 WorkInstruction, permission snapshot, Secret, token, payload는 읽거나 반환하지 않는다.
- 결과 상한은 100행이다. 101번째가 보이면 잘린 성공 목록을 반환하지 않고 안정 오류로 거부한다. 같은 Project의 `runs.environment_id IS NULL` legacy 행이 있으면 환경을 추측하지 않고 안정 오류로 거부한다. 다른 Project/Environment 행은 누출하지 않는다.
- enum 밖의 phase/status, 비정상 ID·version, DB 장애는 원문 SQL/driver 정보를 노출하지 않고 `RUN_SOURCE_UNAVAILABLE`로 fail closed한다. 범위 내 0행은 그 거래에서 관측한 0행이지 프로젝트 전체 무실행·건강 판정이 아니다. GET 성격의 읽기는 audit/Run/Queue mutation을 하지 않는다.

## 구현·검증

제품 파일은 `packages/persistence/operations_run_read.py`, `tests/persistence/test_f20_u01_run_read.py`, `docs/04_test_reports/F-20_U01_R12_SCOPED_RUN_READ_RESULT.md` 세 경로로 제한한다. 단일 Developer가 정상·교차 범위·101행·legacy NULL·malformed·DB 오류·비밀값 비노출·읽기 무변경을 RED→GREEN으로 검증한다. Main은 diff와 테스트를 독립 확인하고 기존 branch의 정확한 SHA를 private development에 push한 뒤 WSL-server 격리 PostgreSQL15에서 동일 SHA·실제 DB 읽기와 자원 정리를 검증한다. 정식 전체 suite는 기존 정식 수집 옵션과 별도 실행 결과로 판정하고, 실행하지 않은 항목을 PASS라 하지 않는다.

## 다음 연결·제외·rollback

이 포트는 후속 U-01 service/API/UI 단위의 입력 후보일 뿐, 이 단위에서 Dashboard 응답에 새 필드를 붙이지 않는다. 별도 `projects` master 상태, Agent owner 목록, Worker 현 활성 상태, Next Actions 목적지와 경과시간, Provider 건강, OIDC 실제 세션·E-SHOT/E-NET 전체, `/srv` 공유 runtime, ysna/Production, main 병합·새 branch는 제외한다. 회귀 시 R12 제품 exact3만 되돌려 R11 Queue UI 및 R10 Dashboard API를 보존한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다.
