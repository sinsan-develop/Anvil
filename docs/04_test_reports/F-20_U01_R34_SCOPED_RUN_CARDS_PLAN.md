# F-20/U-01 R34 범위 제한 Run 운영 카드 계획

## 판정과 목적

설계 §29.2와 승인된 작업계획 U-01의 `실행 중`, `승인 대기`, `BLOCKED` 운영 카드만 기존 범위 제한 Run read owner에 연결한다. R33T 종료 seq2004, worker/write lease 없음, 기존 `codex/f18-wsl-ops` 한 브랜치를 기준으로 한다. 이는 계획된 Dashboard service/API/BFF/UI 구현의 절편이며 기능 범위·요구사항·중요 위험을 넓히지 않는다. 기존 GET 응답의 정확한 계약에 필드가 추가되는 사실과 영향은 숨기지 않는다.

## 데이터·표시 계약

기존 `GET /api/dashboard/operations`의 신뢰된 owner가 고정 Project/Environment에 대해 이미 구현된 `run_summary()`를 별도로 읽는다. 새 `run_summary` 필드는 성공 시 `status=AVAILABLE`, `observed_at`, `observed_total`, `active_runs`, `waiting_approval_runs`, `blocked_runs`의 정확한 형태로, 실패 시 `status=UNAVAILABLE`과 나머지 값 `null`의 정확한 형태로 응답한다. 값은 0~100의 정수, 각 버킷과 합은 관측 분모 이하, 시각은 timezone-aware여야 한다. DB reader의 101건 초과, legacy NULL 환경, 외부 scope, malformed row, 오류는 숫자 0으로 바꾸지 않는다. Run 집계 실패가 기존 Health/Queue/Alert/Next Action 조회를 통째로 거짓 실패 처리하지 않도록 집계 필드만 비가용으로 둔다. 별도 관측시각을 유지하고 단일 원자 snapshot이나 실제 프로세스 실측으로 표현하지 않는다.

웹은 응답 전체와 새 필드를 엄격히 검사한다. 유효한 범위 제한 집계의 세 카드에만 수치·관측 분모·시각을 표시한다. 실패/차단/취소/재연결·불완전/미래/위조 자료에는 해당 수치를 숨기고 `UNAVAILABLE` 또는 상위 조회 상태를 표시한다. `필수 Gate 미통과`, `예상 비용 초과`, `baseline 충돌`은 검증된 source가 없으므로 R33의 `UNAVAILABLE` 그대로 유지한다. Project/Environment 선택·오늘/7일/30일 기간·Critical 확인 버튼은 이번 절편에 포함하지 않는다. 기존 `dashboard:read`, same-origin, OIDC scope, CSRF/권한 경계와 DB schema는 바꾸지 않는다.

## 단일 writer 순서와 검증

1. Main이 기준 hash·깨끗한 Git·G-05·기존 no-lease를 확인하고 R34 정확 경로의 WorkInstruction 및 worker/write dual lease를 append-only로 발급한다. 이 전 제품 write는 없다.
2. 착수 전 발견된 R33T 시작 시점 테스트 2건은 현행 seq2004를 과거 seq2002로 잘못 취급한다. Developer가 과거 시작 상태를 고정 Git SHA에서 검증하고 현행 G-05는 현재 상태로 별도 검증하도록 test-only RED→GREEN 복구한다. 역사 위조·만료 거부는 삭제·skip/xfail하지 않는다. 2026-10-03 로컬 시작 테스트는 1 PASS/2 FAIL이며, 인접 원장 전체 테스트는 약 10%에서 의도 중단했으므로 `INTERRUPTED_UNVERIFIED`다.
3. Developer는 API/Console/브라우저 계약의 예상 RED를 먼저 만들고, 기존 `OperationsPort`·`App`만 최소 수정하여 GREEN으로 만든다. 기존 service/DB reader/OIDC host/registry와 과거 Event는 변경하지 않는다.
4. 정상·빈 범위 0·인가 밖 403·loader 부재/오류/오염/101건 초과 비가용·비밀 노출0·다른 카드 비가용·상위 조회 상태를 검증한다. 기존 R10 API/OIDC, R12/R16/R17/R18, R33T 시작/종료와 현재 G-05, Console 전체, browser 문법/audit, typecheck/lint/build, 관련 비 opt-in Python, G-05/diff를 실행한다. 독립 diff/spec 검토에서 Critical/Important 0을 확인한다.
5. Main이 같은 branch에서 안전 checkpoint/private push 후 WSL-server에 exact clean SHA를 Git으로 받아 격리 PG15/OIDC/HTTPS/Chromium의 API↔DOM·same-origin/secret·1920×1080 증거를 확인한다. 임시 checkout/DB/container/evidence 경로·수명·정리 방법을 생성 전에 WORK_STATUS에 기록하고 검사 후 정확 자원만 제거해 잔여0을 확인한다.
6. 결과보고·현황·append-only 종료 통제로 dual lease를 회수한다. U-01 독립 Tester 전량 수락과 F-20 최종 검증 전에는 branch를 main에 병합하거나 다음 branch를 만들지 않는다.

## 완료 한계와 rollback

R34는 세 Run 상태 카드의 실제 범위 제한 읽기 절편만 완료할 수 있다. C30 `OPEN_BLOCKING`, F-20/U-01 `REWORK_IN_PROGRESS`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. 회귀 시 R34 제품 변경만 정상 Git revert하고 이전 응답·Event prefix, 사용자 자료와 R33T QA 증거를 보존한다.
