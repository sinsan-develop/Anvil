# F-18 R41 OIDC PostgreSQL 18 integration plan

> 승인 부모 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`. R40 close `243ad642d2d091adcf429daa5084e0896455b945`, seq1633, 두 lease null에서 시작하는 내부 검증 단계다. 기능 범위·요구사항·중요 위험을 넓히지 않는다.

**목표:** R40의 실제 loopback HTTPS OIDC 흐름을 Alembic head `0019_oidc_sessions`의 전용 PG18 Engine과 결합하고, `/health/ready`의 0013/0016 고정 간극을 OIDC host에 한정해 해소한다. 기존 COOKIE/WSL shell readiness 계약은 유지한다.

**제품 exact5:** `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `tests/integration/f18_oidc_live_host.py`, 신규 `tests/integration/test_f18_oidc_pg18.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main control/progress, Web, DB schema/migration, Compose, Secret 저장, 공개 API, Production은 수정하지 않는다.

## Task 1 — OIDC host migration readiness

1. `test_oidc_asgi_binding.py`에 OIDC DB head `0019`에서 ready 200, 구 head `0013`/`0016`에서 503, legacy COOKIE/WSL shell의 기존 head 기대값 유지 테스트를 먼저 추가하고 RED를 본다.
2. `create_oidc_asgi_app`만 `create_asgi_app`에 명시적인 `0019_oidc_sessions` 기대 head를 전달한다. `create_asgi_app`의 기존 호출은 0013/0016 기본값을 유지하고, readiness는 바인딩된 동일 Engine의 실제 `alembic_version`과 비교한다. 임의 최신/상위 head를 묵인하거나 전역 설정을 바꾸지 않는다.
3. 신규·기존 API/ASGI/OIDC 회귀 GREEN과 bare 전체 pytest 결과를 구분해 기록한다.

## Task 2 — 실제 PG18 결합 테스트

1. `test_f18_oidc_pg18.py`에 opt-in `ANVIL_F18_R41_PG18_DSN`+`ANVIL_F18_R41_PG18_ISOLATED=1` 부재 시 명시 SKIP, SQLite/비-18/비-loopback/잘못된 DB·role/head를 fail-closed 거부하는 테스트를 먼저 추가해 RED를 본다.
2. R40 harness에 제한된 외부 Engine 주입을 추가한다. 기본 SQLite 7건은 유지한다. PG18 경로는 기존 전용 DB의 `0019`와 비슈퍼유저 앱 role을 확인하고 schema를 만들거나 migration을 실행하지 않는다. 합성 issuer/API의 실제 TLS authorization→token→callback→session→replay와 ready 200, DB pending/session/directory 효과를 검증한다. Engine/thread/socket/임시 TLS 자료는 finally에서 닫는다. DB·role·container 자체는 Main이 수명 종료 시 제거한다.
3. 로컬은 PG18 opt-in SKIP을 PASS로 승격하지 않는다. 기존 R40 7건과 OIDC 회귀, 신규 guard 테스트를 실행한다. bare 전체 pytest의 기존 collection ERROR도 명시한다. 제품 commit은 exact5만 만든다.

## Main 동일 SHA WSL-server QA 자원·증거

- 로컬 작업 branch는 기존 `codex/f18-wsl-ops` 하나다. 제품 commit을 지정 `development` SSH remote에 push한 뒤 WSL-server에서 그 SHA를 clean detached checkout으로 받는다. 신규 branch·worktree 생성, `ysna-server` 접근, 공유 `local-postgres` 변경은 금지한다.
- 전용 checkout `/home/daon/anvil-f18-r41-oidc-pg18-qa`, 전용 container `anvil-f18-r41-pg18-qa`, DB `anvil_f18_r41_oidc`, 비슈퍼유저 role `anvil_f18_r41_app`, host loopback `127.0.0.1:35418`만 사용한다. 생성 전 모두 부재를 확인한다. 이미지 `pgvector/pgvector:0.8.2-pg18@sha256:42e7f6b4e1eceb02ff14e3e6bc6108bbe259abbe83879dc1845d0da1ddeb555d`; 데이터는 container 전용 tmpfs로 제한하고 익명 volume을 만들지 않는다. 테스트 전용 loopback trust 인증은 실제 credential 보안 증거가 아니다.
- Main은 전용 DB를 Alembic `upgrade head`하여 head·server/extension version·image digest를 기록하고 앱 role에 필요한 최소 DML만 준다. 같은 제품 SHA에서 신규 PG18 수직 통합을 SKIP 0으로 실행한다. 기존 OIDC store PG18 opt-in 3파일 13건은 각 fixture가 독립 빈 DB를 요구하므로 본 수직 통합 DB와 공유하거나 병렬 실행하지 않는다. 별도 전용 DB 마련 전에는 13건을 미검증으로 남긴다.
- 종료 시 listener/engine/temp를 확인하고 exact checkout·container·tmpfs·port/DB/role 잔여0, 공유 container ID/status 불변을 확인한다. 이 QA는 격리 PG18 OIDC 경계만 증명하며 정식 WSL 운영 유사 Compose, Web/browser Network, object storage/network policy, Production은 `NOT_EXECUTED`다. F-18 `accepted=false`, F-19 blocked를 유지한다.

**Rollback:** R41 제품 commit의 정상 revert와 이전 R40 checkpoint/G-05 확인. 임시 DB에는 지속 데이터가 없으며 전용 container/checkout만 exact 검증 뒤 제거한다.
