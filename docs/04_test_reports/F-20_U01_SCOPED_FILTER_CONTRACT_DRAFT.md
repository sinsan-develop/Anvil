# F-20/U-01 Project·Environment·기간 필터 계약 초안

상태: `DRAFT / CONTRACT_ONLY / NOT_APPROVED_FOR_PRODUCT_WRITE` (2026-10-06). 기준 branch `codex/f18-wsl-ops`, 조사 시작 HEAD `d083a0e79f9bb1c80332d5d8510eeb42056a583e`, canonical seq2102·worker/write lease 없음. 이 문서는 설계 §29.2와 작업계획 U-01의 미완료 계약을 검토하기 위한 것으로 공개 API·인가·DB 변경을 승인하거나 실행하지 않는다. C30 `OPEN_BLOCKING`, F-20/U-01 미수락, Release `DEFER`.

## 판정과 근거

- 설계 §29.2는 Project, Environment, 오늘/7일/30일, 새로고침 시각을 요구한다. 설계 §26.1은 DB UTC 저장과 화면 Asia/Seoul 표시를 정하지만 기간 경계의 포함/제외, DST 적용, 집계 대상은 정하지 않는다.
- `apps/api/anvil_api/oidc_process.py`는 trust 입력의 Project ID 집합과 Environment ID 집합을 검사한 후 **한 쌍**의 `AuthorizationScope`와 `OperationsService`를 host 전체에 결박한다. `packages/api/fastapi_app.py::_authorize`는 permission·role 및 각각의 ID 집합 소속을 확인하지만 허용된 **쌍**의 목록은 검증하지 않는다. 두 집합의 Cartesian product는 인가 근거가 아니다.
- `packages/api/operations.py`의 기존 `GET /api/dashboard/operations`는 고정 scope owner의 현재 snapshot을 엄격한 필드 계약으로 반환한다. `packages/observability/service.py::snapshot`은 현재 projection과 alert를 결합하고 기간 인자를 받지 않는다. `operations_audit_events`는 project/environment/sequence/payload의 append-only Alert 감사 기록이며 모든 Dashboard 카드의 완전한 기간 원본이 아니다.
- 현재 선택 가능한 scope 목록 endpoint, 다중 scope owner registry, 기간별 Health/Run/Gate/예상 비용/baseline 충돌의 지속·완전성 owner는 확인되지 않았다. 기존 `/api/projects/scan`이나 Alert의 100건 페이지를 전체 목록/기간 건수로 재사용할 수 없다. 미확인 수치는 `UNAVAILABLE` 유지.

## 대안과 권장 방향 — 결정 전 제안

| 대안 | 장점 | 결손·영향 | 판정 |
|---|---|---|---|
| A. 현 단일 host scope만 노출, 기간도 현재 관측으로 표시 | 현재 권한·API 유지, 위험 최소 | Project/Environment/기간 선택 요구를 충족하지 못함 | 임시 진실성 유지 수단일 뿐 U-01 완료안 아님 |
| B. 서버 신뢰 **정확 쌍 registry**에서 principal 허용 쌍만 목록화하고, 쌍별 owner를 선택하는 별도 scoped read 계약 + 근거별 기간 read model | 인가 교차조합 방지, 기존 GET/ACK 계약 보존, 확장 경계 명확 | 새 공개 API·인가·데이터 계약, registry·원본 owner·완전성 정의 필요 | **권장 방향**, 별도 승인 전 구현 금지 |
| C. 기존 Dashboard GET에 임의 scope/window query와 응답 필드 추가 | 새 route 수 감소 | 기존 고정 resolver·owner와 exact-field 소비자 회귀, browser ID 신뢰·권한 확대 위험 | 비권장 |

권장 B는 예시로 `GET /api/projects/{projectId}/environments/{environmentId}/dashboard/operations?window=today|7d|30d` 같은 별도 route와 인가된 선택 목록 read route를 요구할 수 있다. 경로·응답 필드는 **미확정 예시**이며 이 문서로 public contract를 고정하지 않는다. 기존 Dashboard/Alerts/Audit GET 및 Critical ACK의 의미·권한·응답은 그대로 둔다.

## 결정을 위해 필요한 정확한 계약

1. **허용 쌍과 목록 owner:** 현재 trust 파일의 단일 `(scope_project_id, scope_environment_id)`는 확인된 유일한 허용 쌍이다. 다중 쌍의 공급원을 별도 trusted server registry로 만들지, host를 단일 쌍으로 유지할지 결정해야 한다. principal의 독립 `project_ids`/`environment_ids`는 추가 교집합 검사일 뿐 쌍의 권위 원본이 아니다. 권한 철회 시 목록·선택·조회 모두 다음 요청에서 fail-closed; 다른 쌍의 owner/cache/audit 혼합 금지.
2. **시간 경계:** 설계 §26.1과 맞는 후보는 표시·달력 경계 `Asia/Seoul`, 저장·질의 시각 UTC이다. `today`는 서울 현지 자정부터 다음 자정까지 `[start,end)`, `7d/30d`는 현지 달력일 포함인지 고정 168/720시간인지 별도 결정해야 한다. `ZoneInfo` 기반 IANA timezone으로 DST 있는 향후 환경까지 계산할지 또는 모든 환경을 Asia/Seoul로 고정할지도 미정이다. 브라우저 로컬시각을 권위로 사용하지 않는다. 응답에는 timezone, UTC 경계, 관측시각, window basis가 필요하나 필드 계약은 미승인이다.
3. **카드별 데이터 basis:** 현재 시점 Health/Run/Agent/Provider 관측과 기간 내 발생 건수는 다르다. 각 카드마다 source owner, scope join, 사건 시각, 집계 단위, 중복 제거, 관측 범위, 누락/지연/완전성, 신선도, 오류 시 `UNAVAILABLE`을 먼저 정해야 한다. Alert 감사 테이블은 Alert 사건에 한정되고 100건 페이지는 기간 모집단이 아니다. Gate 미통과·예상 비용 초과·baseline 충돌은 검증된 완전 owner가 아직 없어 0으로 표기 금지.
4. **목록·read model 운영:** 쌍 registry의 등록/삭제·권한 철회·host owner 생성/폐기 주체와 저장 위치, period read model의 기존 DB 재사용 가능 여부·schema 필요 여부가 미정이다. DB schema/migration 또는 지속 데이터가 필요하면 별도 승인 경계로 분리한다.

## 승인 후에만 고려할 구현·검증 지도

- 후보 파일: `packages/api/registry.py`, `packages/api/fastapi_app.py`, `packages/api/operations.py`, `apps/api/anvil_api/oidc_process.py`, `packages/observability/service.py`, `apps/web/src/console/App.tsx` 및 각 단위/API/브라우저 테스트. 실제 exact write scope·WorkInstruction·dual lease는 승인된 계약을 기준으로 새로 작성한다. 현재 파일 수정 허용 목록이 아니다.
- 먼저 허용 쌍/독립 ID 집합 교차조합/권한 철회/존재하지 않는 쌍/동시 전환/오래된 응답 폐기와 기간 경계(자정, 월말, 윤일, DST 적용 시 전환)/완전성 누락의 실패 테스트를 작성한다. 같은 scope의 기존 GET·ACK 회귀, exact-field 호환성을 확인한다.
- 로컬 단위/API/Web 테스트·typecheck/lint/build 후 같은 clean SHA를 private Git에 push하고 WSL-server에서 pull해 격리 PG15/OIDC/HTTPS/Chromium의 선택→same-origin Network→실제 데이터→재표시를 확인한다. 필요 시 PG18 별도 RC 검증은 계획의 해당 Gate에서 수행한다. 실행하지 않은 검증은 PASS로 쓰지 않는다.
- rollback은 신규 route/registry/read model의 feature를 비활성화하고 기존 고정 Dashboard GET을 유지하는 방향이지만, schema·지속 데이터 변경이 생기면 안전한 별도 rollback 결정이 필요하다. 기존 Alert 감사 Event는 삭제·재작성하지 않는다. Production/ysna-server는 범위 밖이다.

## PMO 결정 요청 경계

이 초안에 대한 PMO 검토 항목은 허용 쌍의 권위 공급원, 선택 목록 노출 방식, 기간 정의와 timezone, 카드별 원본·완전성, 별도 API/인가·DB 계약의 영향과 필요한 신산님 승인 범위다. 위 값이 확정되기 전에는 제품 구현·API 등록·권한/DB schema 변경·U-01 인수 판정을 하지 않는다.
