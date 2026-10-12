# WI-U01-DASHBOARD-DATABASE-HEALTH-VERTICAL-20261012-001

## 판정과 범위

신산님의 2026-10-12 직접 지시에 따라 Anvil은 로컬·WSL-server **기능 구현 단계**다. 승인된 설계 §29.2, 계획 U-01, `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`의 읽기 전용 정확 조합 Dashboard 범위에서 다음 미완성 기능을 DB 건강 상태 카드로 한정한다. W12 `U-01_TASK4_R6_ALL_PAIR_404_BODY_CAUSAL_PROBE_WORK_INSTRUCTION.md`의 반복 진단은 실행하지 않고 기록을 보존한다. 이 지시는 W12의 성공·G-05 PASS·U-01 인수를 뜻하지 않는다.

현재 `database_signal`은 실제 DB `SELECT 1`과 Alembic head를 확인하지만, 정확 조합 Dashboard reader의 `current.health.database`는 고정 `UNAVAILABLE`이며 화면도 응답과 무관하게 `UNAVAILABLE`을 그린다. 변경 목표는 이미 검증된 신호만 요청별 정확 조합에 연결하여 화면에서 건강 상태·관측 시각·출처 또는 결손 이유를 사실대로 볼 수 있게 하는 것이다. DB 장애·migration 불일치·관측 시각/범위 불일치 시 건강 상태를 추측하거나 0/HEALTHY로 대체하지 않는다. 나머지 5개 건강 항목은 원본이 없으면 `UNAVAILABLE`을 유지하고, 전체 `health` 원본을 완전하다고 표시하지 않는다.

## 구현 경계

- Main은 기존 branch `codex/u01-dashboard-r2`와 안전한 Git 상태, 부모 승인 hash, F-19A 수락 증거, canonical worker/write lease를 먼저 재확인한다. 유효하고 서로 다른 token의 단일 Primary Developer에게만 제품 코드 write를 맡긴다. Main은 해당 lease 동안 같은 파일을 수정하지 않는다.
- 허용 제품 경로는 `packages/api/scoped_dashboard.py`, `apps/api/anvil_api/oidc_process.py`, `apps/web/src/console/App.tsx`다. 필요한 좁은 검증 경로는 `tests/api/test_u01_scoped_dashboard_reader.py`, `tests/api/test_u01_scoped_dashboard_api.py`, `apps/web/tests/f15-console.test.mjs`다. 다른 제품 파일·DB schema/migration·권한·Secret·공개 경로 변경은 이 지시의 범위가 아니다. 부모 승인 제안 §정확 제품 계약 4·6이 이미 요구한 카드별 원본·관측시각·scope·완전성 근거는 기존 `current.health`와 `sourceCompleteness.current` 안에서 Database 구성요소에만 추가할 수 있다. 상위 응답 필드·기존 필드의 의미·나머지 5개 항목의 결손 상태는 바꾸지 않는다. 이 경계를 넘는 새 공개 필드·의미 변경이 필요하면 Main에 차이를 보고하고 별도 승인 경계를 판정한다.
- 요청별 `dashboard:read`·등록된 정확 pair 권한 검증 뒤에만 원본을 읽고, 다른 pair의 신호·cache를 재사용하지 않는다. 원본 신호의 실제 freshness/상태를 검증하고 내부 주소·DSN·Secret을 브라우저 응답에 노출하지 않는다. 기존 Operations GET·Critical ACK·다른 카드 동작은 유지한다.
- RED→GREEN으로 정상 DB 신호, 연결 실패/migration 불일치, 잘못된 pair·철회 권한, 화면의 검증된 값/결손 표기를 확인한다. API reader와 Web 해당 테스트, 필요한 타입·빌드만 실행한다. 변경 없는 전체 브라우저·부하·복구 검사를 반복하지 않는다. 테스트 기대값을 낮추거나 실패를 PASS로 바꾸지 않는다.
- G-05와 private exact-SHA가 미충족이면 WSL-server 기능 검증은 미실행으로 남긴다. WSL 접속 가능 시 등록된 전용 환경에서 실제 DB→API→브라우저 경로를 한 번 검증하고 전용 자원만 정확 정리한다. Oracle Cloud 정밀 검증·외부 공개·운영 투입은 이 단계에서 하지 않는다.

## 보고와 다음 기능

완료 판정은 DB 건강 상태의 실제 화면·API·DB 연결과 핵심 실패 조건에 한정한다. 확인하지 못한 WSL 또는 브라우저 경로는 `구현했지만 동작 미확인`으로 표시한다. 다른 미구현 health/운영 지표는 `추후 테스트`로 숨기지 않고 별도 부분 구현 목록에 남긴다. 다음 구현은 실제 원본과 권한 계약이 확인된 U-01 미완성 카드 중 하나로 좁힌다. W12 진단 실패·G-05 RED, U-01 `NOT_ACCEPTED`, Release `DEFER`는 독립 증거 전까지 유지한다.
