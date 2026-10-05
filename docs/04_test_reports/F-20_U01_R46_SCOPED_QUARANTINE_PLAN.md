# F-20/U-01 R46 실제 범위 격리 근거 표시 계획

## 판정과 승인 결박

PMO 대화 `01a054f5-c2b4-7af0-b31a-c8148ef74642`의 2026-10-05 지시는 R45의 “queue source gap이면 격리 경고 근거 없음”을 제한적으로 바꾸는 **의미 변경 승인**이다. R45 승인 binding을 비의미 재확정으로 재사용하지 않는다. R45의 실제 브라우저 PASS는 QA-only Queue HealthSignal 주입 조건에 한정된 역사 증거로 보존한다.

같은 권한 scope에서 읽은 실제 저장 quarantine 양성 행이 유효·신선·고유하고, 해당 저장 `QUEUE_JOB_QUARANTINED` alert가 유일하게 일치할 때만 Queue 카드에 “확인된 격리 이상”·건수·같은 페이지 상세를 표시한다. Queue **전체** Health/source gap은 그대로 `UNKNOWN`과 안내 문구로 노출한다. 0건·누락·권한 차단·오래되거나 미래의 관측·위조·중복 근거는 fail-closed다. 빈 gap을 만들기 위해 `HEALTHY/0` HealthSignal을 넣거나 새 HEALTH/Queue alert를 만들지 않는다.

## 경계와 검증

- 제품 변경은 기존 Web 대시보드 해석만 대상으로 한다. 동일 Dashboard 응답의 scoped `quarantine`, `alerts`, `observed_at`, `source_gaps`를 사용하고 새 공개 API·DB schema·인증·권한·운영 코드를 만들지 않는다.
- 표시 신선도는 Dashboard `observed_at`이 유효하고 브라우저 현재 시각을 넘지 않으며 60초 이내인 경우로 제한한다. `quarantined_at` 자체는 작업의 발생 시각이지 조회 신선도가 아니므로 과거 격리 작업을 60초 만에 숨기지 않는다. 행 시각은 snapshot·현재 시각 이하이어야 한다.
- 격리 행의 정확 필드·형식·100건 상한·고유성 및 alert의 정확 필드·상태·원인·증거 hash·유일성을 검증한다. 불일치·중복·해결된 alert의 상세 링크는 만들지 않으며, 확인된 이상 표시도 저장 alert와 일치할 때만 한다.
- `source_gaps`의 `queue`와 `health.queue=UNKNOWN`은 격리 양성 표시와 함께 유지한다. 격리 이상 표시는 전체 Queue 건강도 판정이 아니다. 기존 R43 Critical 우선과 R44 Health 상세, 인증 철회 시 보호 데이터 소거를 회귀시키지 않는다.
- Developer가 Web console RED→GREEN, browser harness의 QA-only HealthSignal 제거·실제 저장 alert 경로·0건 UNKNOWN·중복 alert 부재·Network/Secret을 구현·검증한다. Main은 독립 diff, G-05, 동일 clean SHA를 private push→WSL-server pull, 일회성 PG15/OIDC/HTTPS/Chromium, 전용 자원 정리, 결과·WORK_STATUS 및 lease 회수를 담당한다.

## 제외

Queue 전체 정상 판정, Health 실제 6종 source 완성, 새 공개 API/DB/auth, PG18/Provider, ysna/Production, F-20/U-01 전체 수락은 제외한다. ReleaseDecision `DEFER`를 유지한다. 새 중요 위험이나 이 경계 밖 변경이 필요하면 PMO에 근거·대안·권장안을 보고한다.
