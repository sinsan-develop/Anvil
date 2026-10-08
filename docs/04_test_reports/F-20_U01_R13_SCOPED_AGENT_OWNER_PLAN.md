# F-20/U-01 R13 범위 지정 Agent owner 읽기 계획

## 목적과 현재 근거

U-01 Dashboard의 Agent 상태를 실제 read model과 연결하기 위한 **내부** 읽기 owner 한 단위를 만든다. `agent_owner_heads`에는 `project_id`·`environment_id`, generation·version·revoked-through 및 검증 가능한 snapshot이 있지만 현재 repository의 조회는 신뢰된 단일 `scope_key`에 한정된다. 따라서 빈 Agent 카드나 발급 이력만으로 활성 Agent 0건·정상을 주장하지 않는다. R13은 목록 읽기 포트만 제공하고 Dashboard 공개 응답/API·BFF·UI·인증·권한·DB schema·지속 데이터는 변경하지 않는다.

## 계약

- `load_scoped_agent_owner_source(engine, project_id, environment_id)`는 신뢰된 Engine과 **이미 인가된** 정확한 Project·Environment 범위만 입력받는다. 비정규 ID는 DB 접근 전 거부한다.
- PostgreSQL `REPEATABLE READ`·`READ ONLY` 단일 거래에서 DB 시각과 범위 일치 `agent_owner_heads`를 `scope_key` 안정 순서로 최대 101행 읽는다. 100행을 넘으면 잘린 성공 결과가 아니라 안정적인 비가용 오류다. 범위 외 행은 결과에 포함하지 않는다.
- 저장 snapshot은 기존 `SqlAlchemyAgentTeamOwnerRepository._stored`의 무결성 검증을 재사용한다. DB 컬럼과 snapshot identity/generation/version/hash가 불일치하면 전체를 fail closed한다. snapshot은 내부 검증용으로만 읽고 결과·오류·repr에는 snapshot JSON, principal mapping, permission, execution/write fence, hash 원문을 싣지 않는다.
- 결과에는 `session_id`, `assignment_id`, `generation`, `owner_version`, 관측 시각 및 DB 시각 기준 `ACTIVE`/`REVOKED`/`EXPIRED` 분류만 남긴다. 철회 우선, 그다음 만료를 판정한다. 이 값은 Agent owner의 관측 상태이지 Worker 실행 건강·Provider 건강이나 C30 복구 판정이 아니다.
- malformed row/시각/중복, 101행, DB 오류는 SQL·driver·저장 비밀을 노출하지 않는 `AGENT_SOURCE_UNAVAILABLE`로 닫는다. 빈 범위는 해당 거래의 0행 관측일 뿐 전체 건강 상태가 아니다. 읽기는 owner/history/request/audit/Run/Queue mutation을 하지 않는다.

## 구현·검증과 경계

단일 Developer 제품 경로는 `packages/persistence/operations_agent_owner_read.py`, `tests/persistence/test_f20_u01_agent_owner_read.py`, `docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_RESULT.md` exact3이다. RED→GREEN으로 0/100/101행, 교차 범위, active/revoked/expired, snapshot/컬럼 불일치, malformed/DB 오류, 민감정보 비노출, 읽기 무변경을 검증한다. Main은 독립 diff·테스트 후 기존 branch의 정확한 SHA를 사설 원격에 push하고 WSL-server 격리 PostgreSQL15에서 같은 SHA·실제 owner 저장/철회/만료를 확인하며 일회성 자원을 정확히 정리한다.

이 포트는 후속 U-01 service/API/UI 연결 후보일 뿐 현재 공개 Dashboard Agent 필드를 바꾸지 않는다. Project master 상태, Worker 현재 lease, Next Actions 경과시간·작동하는 이동, Provider/환경 건강, 실제 OIDC·브라우저·정식 E-SHOT/E-NET, F-20/U-01 acceptance, C30 incident 해소는 제외한다. 회귀 시 R13 exact3만 되돌려 R12 Run/R11 Queue/R10 Dashboard 경로를 보존한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, main 미병합·새 branch 금지, ysna/Production 제외를 유지한다.
