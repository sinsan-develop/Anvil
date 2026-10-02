# F-20/U-01 R29 이후 Dashboard 잔여 범위 점검

## 판정

`U01_PARTIAL_INTERNAL_QA_ONLY`. R29의 quota 절편은 동일 clean SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium에서 결정론적 429→수동200 회복을 PASS했고 epoch43 두 lease는 seq1973~1974에서 회수됐다. 이는 서버 quota enforcement, U-01 독립 인수 또는 F-20 최종 검증이 아니다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. 이 점검은 읽기 전용 분석이며 제품·API·DB·인증·원장 이력을 변경하지 않는다.

## 현재 계약 대조

| 설계·계획 요구 | 현 코드·증거 | 판정 |
|---|---|---|
| 공통 7상태 중 quota | R29은 Dashboard GET 429를 `QUOTA`로 분류하고 보호 행/관측 시각을 제거하며 수동200 회복을 같은 실제 브라우저 흐름에서 확인했다. 429는 테스트 주입이다. | R29 절편 PASS, 실제 서버 한도 정책 미검증 |
| 공통 7상태 중 cancel | `Shell.refreshDashboard`는 route 이탈 때 `AbortController`를 중단하지만, 현재 Dashboard에서 사용자가 진행 중인 조회를 취소하는 화면 조작·`CANCELLED` 상태·이후 재조회 증거는 없다. 백엔드 Run 취소와 혼동해서는 안 된다. | UI 조회 취소 미구현·미검증 |
| 공통 7상태 중 reconnect | 전송 실패는 `UNAVAILABLE`, 수동 새로고침의 후속 성공은 검증됐지만 연결 상실→복구의 별도 상태/접근성/브라우저 전이 증거가 없다. | reconnect 미검증 |
| 상단 Project/Environment/오늘·7일·30일 필터와 2행 운영 수치 | Dashboard 상단 Environment는 고정 `NOT CONNECTED`; 운영 2행은 read model 미연결을 명시한다. 현재 공개 `/api/dashboard/operations` 응답에 필터·수치용 완전한 계약이 없다. | 구현·계약 검토 필요 |
| Next Actions 경과시간/이동·Critical Alerts 확인 | 실제 저장 행과 안전한 메뉴 링크·Critical 읽기/페이징은 검증됐다. 경과시간 필드와 Alerts 확인 API/버튼은 없다. | 부분 구현, 공개 계약 경계 분리 필요 |
| U-01 독립 인수 | R23~R29의 내부 테스트/브라우저 절편은 누적됐으나 AV-UI 공통·AV-OPS-001~005와 E-SHOT/E-NET/E-API/E-EVT 전량 독립 Tester 판정은 없다. | `ACCEPTED` 아님 |

## 다음 안전 작업

R30은 승인된 U-01 공통 상태 중 **Dashboard 조회 취소**만 다룬다. 진행 중인 same-origin GET의 사용자 취소를 클라이언트에서 표시하되 백엔드 Run/Task를 취소했다고 주장하지 않는다. 이전 보호 행·관측 시각의 재등장, 늦은 응답에 의한 상태 덮어쓰기, 중복 GET, Secret/Network 누출을 RED→GREEN 및 동일 SHA WSL-server 실제 브라우저에서 확인한다. Reconnect와 필터·운영 수치·경과시간·Alert 확인은 뒤의 독립 경계로 유지한다. 공개 API/schema·DB/auth/Secret·운영 변경 없이 기존 branch에서 진행한다.

Rollback: 이 점검 문서와 관련 상태 기록만 정상 Git revert한다. C30 원문 사건과 이전 QA 증거는 보존한다.
