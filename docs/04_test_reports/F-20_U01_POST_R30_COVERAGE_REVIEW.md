# F-20/U-01 R30 이후 Dashboard 잔여 범위 점검

## 판정

`U01_PARTIAL_INTERNAL_QA_ONLY`. R30 Dashboard 브라우저 GET 사용자 취소와 늦은 응답 경합은 동일 clean SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium에서 PASS했고 epoch44 두 lease는 seq1979~1980에서 회수됐다. 이는 backend Run/Task 취소, SSE Event 재연결, U-01 독립 인수 또는 F-20 완료가 아니다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED` 유지.

## 계약 대조

| 요구 | 현재 증거 | 판정 |
|---|---|---|
| 공통 7상태 중 cancel | R30은 진행 중인 Dashboard GET만 사용자 취소하고 보호 행/관측 시각 제거, 실제 abort, 후속 200 및 늦은 stale200 무시를 확인했다. | R30 절편 PASS |
| 공통 7상태 중 reconnect | 오류 후 수동 새로고침 200 회복은 있으나, 재연결 시도 중인 상태·접근성·중복 GET/취소·실패 재분류의 실제 브라우저 전이는 별도 없다. | Dashboard read reconnect 미검증 |
| B-11 SSE `Last-Event-ID` | 설계 §28.7의 Run Event stream 재연결은 Dashboard GET과 다른 계약이다. | R31 범위 밖, 별도 B-11 증거 유지 |
| 필터·운영 수치·Next Actions 경과시간·Critical 확인 | R29 이후 점검과 동일하게 공개 API/read model 계약 및 화면 구현·독립 검증이 남았다. | 후속 독립 경계 |
| U-01 독립 인수 | AV-UI 공통·AV-OPS-001~005와 E-SHOT/E-NET/E-API/E-EVT 전량 독립 Tester 판정 전이다. | `ACCEPTED` 아님 |

## 다음 안전 작업

R31은 승인된 U-01 공통 `reconnect` 상태의 **Dashboard read retry**만 분리한다. 이미 `UNAVAILABLE`인 종속 카드에서 사용자가 한 번 재시도하면 요청 중 `RECONNECTING`을 표시하고 새 same-origin GET 하나만 보낸다. 재시도 중 보호 데이터·이전 관측 시각을 되살리지 않으며 중복 조작은 GET을 늘리지 않는다. 성공200은 기존 엄격 파서의 저장 결과만 표시하고, 401/403·429·500/503·형식 오류는 기존 안전 분류로 귀착한다. 사용자 취소는 R30과 같은 브라우저 GET만 중단한다. 자동 재시도, SSE `Last-Event-ID`, backend Run/Task 재개, 공개 API/schema, DB/auth/Secret, 운영 변경은 하지 않는다. 로컬 RED→GREEN 뒤 기존 branch의 private push→WSL-server 동일 clean SHA의 실제 브라우저/Network/Secret/전용 자원 잔여0으로 검증한다.

Rollback: R31 exact scope만 정상 Git revert하여 R30 결과와 원장 prefix를 보존한다.
