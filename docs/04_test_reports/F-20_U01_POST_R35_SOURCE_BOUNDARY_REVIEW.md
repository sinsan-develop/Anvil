# F-20/U-01 R35 이후 Dashboard 잔여 source 경계 감사

## 판정

`READ_ONLY_SOURCE_AUDIT / U01_F20_NOT_ACCEPTED`. R35 종료 seq2016, worker/write lease 없음, 기존 `codex/f18-wsl-ops` clean checkpoint `971923a286cac1c87d9d57cab1b2e1729906b442`를 기준으로 설계 §29.2와 현재 코드의 실제 자료·권한 경계를 대조했다. 제품·공개 API·DB·브라우저·Event는 변경하지 않았다.

## 확인된 자료와 빠진 계약

| 설계 항목 | 현재 실제 source | 미충족 조건 |
|---|---|---|
| Project/Environment 필터 | `GET /api/dashboard/operations`는 단일 `OperationsService(project_id, environment_id)`와 host `AuthorizationScope`에 고정되고, API port가 두 ID를 일치 검증한다. | 브라우저가 선택 가능한 인가 scope 목록, 선택 후 owner 재조회 계약이 없다. 프런트 임의 파라미터나 alert의 ID를 scope로 삼으면 안 된다. |
| 오늘/7일/30일 | F-13 `project_operations`와 Dashboard GET은 현재 시점 snapshot 및 저장 Alert의 최대 100행 페이지다. | 기간별 원본·집계 owner와 완전성/관측시각 계약이 없다. 현재 snapshot을 기간 통계로 재사용하거나 불완전한 100행을 전체로 표시할 수 없다. |
| 필수 Gate 미통과 | 현재 Dashboard `run_summary`는 범위 내 Run 3상태만 집계한다. | GateResult/Gate 필수 집합·동일 artifact/environment 판정 source가 응답에 없다. Run BLOCKED나 Alert를 Gate 실패 건수로 대체할 수 없다. |
| 예상 비용 초과 | F-13 budget/reservation projection은 host가 전달한 budget ID의 hard limit, 예약·소비액, reservation forecast를 제공한다. | host 목록의 완전성·기간·예상 비용 집계 기준이 없고 reservation 성공 자체가 hard limit 안에서만 가능하다. 단순 예약+소비액을 미래 예상 초과 건수로 쓰면 의미가 다르다. |
| baseline 충돌 | Project scan UI는 현재 repository/baseline 관측을 별도 읽는다. | Dashboard의 인가 Project/Environment에 결박된 현재 baseline 충돌 read model이 없다. 다른 메뉴의 단일 scan을 전 프로젝트 집계로 승격할 수 없다. |
| Critical 확인 버튼 | 저장 Alert GET은 읽기 전용이다. F-13 내부 `OperationsService.acknowledge`는 actor·승인 ID·evidence hash를 요구하고 원장에 기록한다. | 공개 mutation route/permission, 실제 승인 객체 결박, CSRF·Origin·idempotency·동시성·재조회 계약이 없다. UI에서 읽기 상태만 바꾸는 가짜 확인은 금지한다. |

## 다음 안전 순서

1. 기존 설계 범위에서 owner별 관측 단위·기간·누락·완전성·인가 scope와 Dashboard 계약을 명시한다. 먼저 현행 host의 실제 owner/인증 연결을 읽기 전용 확인한다.
2. 공개 API·권한·지속 데이터 변경이 필요 없는 source adapter/계약 테스트부터 단일 writer 절편으로 구현한다. 새 공개 계약이나 권한 경계는 영향 판정 후 계획·승인 규칙을 적용한다.
3. 정확 source가 생긴 뒤 해당 카드/필터/확인을 화면에 연결하고 로컬→동일 SHA WSL-server PG15/OIDC/HTTPS/Chromium, E-API/E-NET/E-SHOT로 별도 검증한다. 부분 PASS는 U-01 ACCEPTED가 아니다.

C30 Event 원문 사고는 별도 CRITICAL `OPEN_BLOCKING`이며 R5e의 감지·차단이 복구는 아니다. F-20/U-01 미수락, ReleaseDecision `DEFER`; main 병합·신규 branch·ysna/Production 변경0. 이 감사 자체의 테스트 실행0, 실제 운영 자료 조회0.
