# F-19A 최소 등록·정확 pair grant 제품 계약

상태: `APPROVED_CONTRACT_NOT_IMPLEMENTED` · 2026-10-07. 승인 근거는 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`다. 이 문서는 설계서 §3.1·§18.1·§28.1·§29.2와 작업계획서 §12·§19.8의 F-19A만 구체화한다. U-03의 repository onboarding·scan·baseline·정책/보호 경로나 U-01의 기간별 카드·다중 Dashboard 화면을 앞당기지 않는다.

## 사용자 목적과 경계

사용자가 등록한 활성 Project와 그 하위 활성 Environment의 **실존하는 정확한 조합** 중 현재 actor가 `dashboard:read`를 가진 조합만 Dashboard 선택 목록에 보인다. 등록은 권한이 아니며, 독립 Project ID 집합과 Environment ID 집합의 교차곱도 권한이 아니다. 철회·비활성은 다음 목록·조회·ACK 요청에서 적용한다. 원본 DB를 읽지 못하면 빈 목록이나 허용으로 대체하지 않는다. Local 개발→기존 private branch의 정확 SHA push→WSL-server 격리 QA의 실제 PostgreSQL 15/OIDC/HTTPS/Chromium 검증까지가 범위다. Production·`ysna-server`·공유/지속 DB 복원은 제외한다.

## 접근 방법

선택 A(승인): 0018 `users`/`roles`/`user_roles`/`oidc_subject_bindings`를 보존하고 0020에 최소 등록·정확 grant 원장을 추가한다. `roles.permissions`는 action의 상한, OIDC 세션은 actor의 신원, `pair_grants`는 actor·Project·Environment·permission의 최종 권위다. 현재 `user_roles`의 단일 actor PK와 OIDC resolver의 단일 행 가정은 등록/다중 grant 원장이 아니다. 기존 Project/Environment ID 집합은 추가 상한일 수 있지만 서로 다른 pair를 결합할 수 있는 근거가 아니다. 인가 결정 캐시는 F-19A에서 사용하지 않는다.

선택 B(기각): `user_roles` PK를 다중 행으로 바꾸면 현재 resolver의 `limit(2)`와 기존 로그인·호스트 scope·GET/ACK의 인가 계약이 함께 변하고 등록 원장을 별도로 필요로 한다. 데이터·rollback 영향이 커서 채택하지 않는다.

## 공개 API: 정확 여섯 route pattern

모든 경로는 same-origin `/api/...`이고 actor는 OIDC 세션에서만 얻는다. JSON 오류는 기존 `{ "error": { "code", "message", "request_id" } }` 형태를 유지한다. ID는 기존 scope ID의 `[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}` 형식이며 `*`·공백·제어문자를 거절한다. displayName은 1~200자 비제어 문자열이다. 성공 시간은 UTC RFC 3339 문자열이다. 알 수 없는 JSON 필드는 400이다.

| Method/path | 요청 | 성공 | 권한 |
|---|---|---|---|
| `POST /api/registration/projects` | `{projectId,displayName}` | 201 `{projectId,displayName,active:true,registeredBy,registeredAt}` | `projects:register` |
| `POST /api/registration/projects/{projectId}/environments` | `{environmentId,displayName}` | 201 `{projectId,environmentId,displayName,active:true,registeredBy,registeredAt}` | `projects:register`와 해당 등록 Project의 actor 또는 `pair-grants:manage` |
| `PATCH /api/registration/projects/{projectId}` | `{active:true|false}` | 200 `{projectId,active,updatedAt}` | `projects:register`와 해당 등록 actor, 또는 `pair-grants:manage` |
| `PATCH /api/registration/projects/{projectId}/environments/{environmentId}` | `{active:true|false}` | 200 `{projectId,environmentId,active,updatedAt}` | 위와 동일 |
| `PUT /api/authorization/pair-grants/{actorId}/{projectId}/{environmentId}/{permission}` | `{active:true|false}` | 200 `{actorId,projectId,environmentId,permission,active,updatedAt}` | 별도 `pair-grants:manage` 관리자; self-grant·자동 grant 없음 |
| `GET /api/dashboard/project-environments` | body 없음 | 200 `{items:[{projectId,environmentId,projectName,environmentName}],observedAt}`; 정확 grant가 없으면 `items:[]` | 로그인 actor의 등록 활성 pair와 활성 `dashboard:read` grant 교집합 |

Grant의 `permission`은 F-19A에서 `dashboard:read`, `operations:alerts:read`, `operations:alerts:acknowledge` 세 코드로 제한한다. 등록되지 않았거나 비활성 pair에는 grant를 활성화할 수 없다. Project 비활성은 모든 하위 Environment의 조회를 즉시 차단하며 물리 삭제하지 않는다. Grant 변경은 현재 상태의 멱등 PUT이되 매 실제 상태 전이를 감사한다. 등록 ID 중복/상충은 409, 부재·숨김은 동일 404, 인증 부재 401, action/정확 pair 거절 403, DB 사용 불가는 503이다. 사용자가 조회 가능한 pair가 0개인 정상 목록만 200 빈 목록이다. 503을 빈 목록·403으로 숨기지 않는다.

기존 `GET /api/dashboard/operations`, `GET /api/operations/alerts`, `POST /api/operations/alerts/{alertId}:acknowledge`의 method/path/body/성공 응답과 기존 `error` envelope는 유지한다. F-19A cutover 후에는 현재 고정 host pair에 대해 각각 `dashboard:read`, `operations:alerts:read`, `operations:alerts:acknowledge`의 활성 정확 grant를 기존 coarse 검사 **뒤에** 매 요청 확인한다. 없는/철회된 grant는 기존 403 `AUTHORIZATION_SCOPE_MISMATCH`를 사용해 pair 존재를 노출하지 않는다. DB 장애는 503 `PAIR_AUTHORIZATION_UNAVAILABLE`이며 기존 오류 응답 envelope를 유지한다. 준비되지 않은 기존 actor가 403이 되는 권한 강화는 승인된 의도적 호환성 변경이며 rollout readiness를 통과하지 못하면 새 앱으로 전환하지 않는다.

새 목록은 등록·grant 원장을 매 요청 읽는다. 현재 고정 host scope의 Dashboard 서비스가 여러 pair의 card 데이터를 반환하는 기능은 **U-01 책임**이다. F-19A는 여러 정확 pair의 목록·grant 격리와 고정 host pair의 기존 GET/ACK 인가를 증명한다. OIDC `project_ids`/`environment_ids` 독립 집합만으로 새 목록을 만들지 않는다.

## 지속 데이터와 감사

0020은 0019 뒤의 추가형 migration이다. 기존 0018 테이블·행·역할 permission을 자동 수정하거나 사용자 역할에서 등록·grant를 자동 생성하지 않는다.

- `registered_projects`: `project_id VARCHAR(128) PK`, `display_name`, `registered_by_actor_id FK users(actor_id) RESTRICT`, `active BOOLEAN NOT NULL`, `registered_at/updated_at TIMESTAMPTZ NOT NULL`.
- `registered_environments`: `(project_id,environment_id) PK`, `project_id FK registered_projects(project_id) RESTRICT`, `display_name`, `registered_by_actor_id FK users RESTRICT`, `active`, `registered_at/updated_at`; 같은 environment ID라도 Project가 다르면 다른 조합이다.
- `pair_grants`: `(actor_id,project_id,environment_id,permission_code) PK`, actor/granted_by/revoked_by는 `users` FK, `(project_id,environment_id)`는 등록 Environment 복합 FK, `active`, `granted_at`, `revoked_at`(nullable), `updated_at`; actor·active·pair 조회 인덱스와 status/시각 CHECK를 둔다.
- `registration_audit_events`: append-only `event_id PK`, event_type, actor/target, pair/permission, 이전·이후 상태, occurred_at, correlation_id. 등록·활성 변경·grant/철회와 감사 append를 같은 트랜잭션으로 확정한다.

DB 스키마는 pair FK·중복·비활성·교차 조합을 방어하되 서버가 action permission과 등록/권한 활성 상태를 재검사한다. Product code·migration·로그에 issuer/subject의 비밀값, 토큰·세션·Secret 원문을 저장하지 않는다. 등록한 ID는 실제 업무 read model과 자동으로 생성/연결되지 않으므로 존재·scope 검증과 불완전 원본 표시는 U-01에서 별도로 수행한다.

## 최초 관리자와 전환

일반 API에 최초 관리자 예외나 self-grant를 두지 않는다. WSL-server **격리 QA 전용**으로 사람 승인에 결박된 bootstrap manifest(issuer, subject, actor_id, 전용 role_code, 정확 host pair, `projects:register`/`pair-grants:manage`, 적용 SHA·DB 식별·수명·회수 조건; credential 없음)를 검증 harness가 멱등하게 seed한다. 기존 actor/role/binding 충돌, 공용 role 변경, 지정 외 권한이 있으면 쓰기 전에 중단한다. Local에는 동일 계약의 테스트 fixture만 둔다. 지속 환경/Production 최초 관리자 부여는 이 승인으로 실행하지 않는다.

WSL 격리 QA에서 전환 전 active 0018 actor·role·host pair의 **대상 범위만** 읽기 전용 inventory, 기존 GET/ACK 상태·응답, 전용 DB snapshot을 기록한다. 0020 적용 뒤 지정 QA actor/pair를 API로 명시 등록·grant하고 세 permission의 기대 행·audit·다른 pair grant 0을 preflight한다. 한 항목이라도 없으면 새 앱 SHA로 전환하지 않는다. 전환 후 동일 SHA/DB에서 기존 성공 응답 비교, 교차 조합·비활성·철회 다음 목록/GET/ACK·다른 actor·DB 장애·cache 혼합을 실측한다. 다른 actor나 공유 DB의 무차별 전환은 없다.

과거 앱 SHA는 새 grant 철회를 보지 못한다. 첫 등록·grant 상태 전이 이후 과거 SHA로 **단순 rollback 금지**; 정확 pair guard를 유지하는 안전 SHA로 fix-forward한다. 데이터가 생긴 0020 테이블의 downgrade/drop은 차단한다. 격리 QA 전체 종료 시에는 identity가 확인된 전용 DB snapshot 복원 또는 전용 DB 제거가 가능하지만 공유/지속 DB 전체 restore는 별도 승인 없이는 하지 않는다. 등록·grant를 쓰기 전의 preflight 단계에서만 이전 SHA와 변경 전 DB로 단순 복귀할 수 있다.

## 검증·판정

TDD RED→GREEN 후 local 단위/API/DB migration/회귀·G-05 및 diff 검증, 같은 branch의 안전 commit·private push, WSL-server의 Git exact clean SHA로 별도 PostgreSQL 15/OIDC/HTTPS/Chromium·same-origin Network 검증을 한다. `AV-OPS-026`, `AV-SAFE-034`와 기존 고정 GET/ACK 회귀를 독립 Tester가 확인하기 전 F-19A는 `ACCEPTED`가 아니다. 임시 QA DB/브라우저/프로세스/파일은 정확 identity를 확인해 종료 후 제거·잔여 0을 기록한다. PG18 RC는 필요할 때만 격리하며 Production은 `NOT_EXECUTED`다. F-19A 수락 전 U-01 제품 write lease를 발급하지 않는다.
