# F-20/U-01 R47 Database Health 실제 관측 연결 계획

## 판정·승인 경계

PMO 대화 `01a054f5-c2b4-7af0-b31a-c8148ef74642`의 2026-10-05 지시에 따라 기존 U-01 Health 여섯 카드 중 Database 하나의 실제 관측 source만 연결한다. 이는 R47 절편 승인이지 F-20/U-01 전체 수락이나 ReleaseDecision 변경이 아니다. 기존 단일 `codex/f18-wsl-ops` branch와 `development` 원격을 유지한다.

## 제품 동작

1. 인증된 OIDC host의 단일 project/environment scope를 확인한 뒤, 실제 PostgreSQL 접속·`SELECT 1`·`alembic_version` 단일 기대 head 일치를 읽기 전용으로 관측한다. 기존 `/health/ready` 응답 문자열이나 Provider 설정값을 Database Health로 복사하지 않는다.
2. 현재 `OperationsSources.health_signals`의 `database`에만 관측값을 제공한다. `HEALTHY`는 이 시점의 좁은 접속·질의·migration 일치만 뜻한다. 실제 점검 시각, 유한한 freshness, credential 없는 SHA-256 증거를 사용한다. Dashboard 응답 shape, 권한, 외부 API, DB schema는 변경하지 않는다.
3. 실패·권한 불일치·관측 누락·오래되거나 미래인 시각은 `UNKNOWN`/`UNAVAILABLE`로 닫는다. 이전 성공값을 재사용하거나 다른 다섯 Health, 전체 DB/업무 건강, Queue/Provider 정상으로 승격하지 않는다. 명시적으로 이 좁은 관측 범위를 카드에 설명한다.
4. R35의 API readiness와 Dashboard Health 분리 규칙을 유지한다. readiness가 READY여도 별도 Database 관측 실패 시 Health 정상으로 만들지 않는다. 기존 저장 alert의 원인·상세 검증을 우회하지 않는다.

## 구현·검증 순서

- Main은 정본 hash·clean HEAD·기존 seq2090 종료를 고정한 WorkInstruction/Invocation을 발행하고 dual lease/G-05를 선행한다. 단일 `developer-primary`만 exact 제품 scope를 쓴다.
- TDD: 실제 PG query/migration 성공 양성, 연결·query 실패/불일치·scope 불일치·미래/오래된 시각 음성, 기존 Health 5종 UNKNOWN과 readiness 분리를 먼저 RED로 확인한다. 구현 뒤 같은 테스트 GREEN, API/observability/Web 회귀·typecheck/lint/build·diff 검사를 한다.
- Main은 정확 commit을 private `development`에 push한 뒤 WSL-server에서 같은 SHA를 pull하여 전용 격리 PG15의 OIDC/HTTPS/Chromium 실제 양·음성, Network same-origin/Secret, 리소스 정리를 검증한다. fixture PASS와 실제 host DB source PASS를 혼동하지 않는다.
- 결과와 실패 횟수·미검증·rollback은 R47 결과 및 WORK_STATUS에 기록한다. rollback은 R47 exact diff만 역적용한다.

## 제외

새 공개 API·DB migration/schema·auth·Secret, 비용 카드, 다른 다섯 Health 원천, Project/Environment/기간 필터, Critical ack, PG18, ysna/Production, main 병합·새 branch는 제외한다. 뜻밖의 공개 계약·중요 위험 변경이 필요하면 제품 write를 멈추고 PMO에 판정·영향·대안·권장안을 보고한다.
