# F-20/U-01 R13 범위 지정 Agent owner 읽기 WorkInstruction

- 발행자: Main 어울. 효력 조건: canonical WI Event·신규 worker/write dual lease·G-05 PASS 전 제품 수정 금지.
- 상위 권위: 승인된 Anvil 설계·작업계획·매트릭스·테스트계획과 `docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_PLAN.md` (SHA-256 `2341B482A9E144E90AD6C685EA323C93F185F81C28E44F3E262B78745AE2B0FC`).
- 분류: 승인된 U-01 Dashboard의 내부 Agent owner 관측. 공개 API/BFF·인증·권한·UI·DB schema/지속 데이터 변경 없음.

## 정확한 제품 쓰기 범위

1. `packages/persistence/operations_agent_owner_read.py`
2. `tests/persistence/test_f20_u01_agent_owner_read.py`
3. `docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_RESULT.md`

## 구현·완료 조건

- `load_scoped_agent_owner_source(engine, project_id, environment_id)`는 신뢰된 Engine과 사전 인가된 범위만 받는다. 비정규 ID는 DB 접근 전에 거부한다. PostgreSQL `REPEATABLE READ`·`READ ONLY` 한 거래에서 DB 시각과 범위 일치 head를 `scope_key` 순·101행 상한으로 읽는다.
- 기존 `SqlAlchemyAgentTeamOwnerRepository._stored`로 snapshot/DB row 무결성을 확인하며 재구현하거나 우회하지 않는다. 100행 초과, malformed/중복, 무결성 실패, DB 오류는 `AGENT_SOURCE_UNAVAILABLE`로 fail closed한다. `revoked_through >= generation`은 `REVOKED`, 그 외 DB 관측시각이 snapshot 만료 이상이면 `EXPIRED`, 그 전은 `ACTIVE`다.
- 반환 필드는 `session_id`, `assignment_id`, `generation`, `owner_version`, 위 상태와 관측시각뿐이다. snapshot JSON, permission/principal, fence/token/hash 원문은 반환·repr·예외에 내보내지 않는다. 빈 목록은 범위 내 관측 0행일 뿐 건강 판정이 아니다.
- RED→GREEN으로 0/100/101행·교차 범위·철회/만료 우선순위·snapshot/column 변조·비정규 ID·DB 오류·민감정보 비노출·읽기 무변경을 검증한다. 인접 owner repository와 R12 Run read 회귀를 실행한다. 시작 HEAD/branch/status, diff, 명령·exit·결과, 미검증·rollback을 결과보고에 남긴다.
- Developer는 exact3 외 수정, commit/push/merge/WSL-server·Docker·공유 DB·ysna/Production 접근을 하지 않는다. Main이 독립 diff·테스트·기존 branch 사설 push→WSL-server 동일 SHA 실제 PostgreSQL15 검증과 일회성 자원 정리를 담당한다.
- 공개 Dashboard 응답이나 화면에 연결하지 않는다. 이 단위는 Project/Worker 전체 상태, Next Actions, C30 incident 복구, U-01/F-20 수락을 완료하지 않는다.
