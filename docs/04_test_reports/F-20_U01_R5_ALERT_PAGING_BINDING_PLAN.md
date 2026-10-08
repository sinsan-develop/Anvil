# F-20/U-01 R5 — 저장 경고 과거 페이지 읽기 계획 (DRAFT)

## 판정과 목적

- R4 제품 SHA `cc94334c1594f85a22402aa990aaf309f84d73fa`는 현재 저장 경고 페이지 최대 100개를 Dashboard에 표시하고 `next_before_sequence`가 있으면 과거 미조회로 표시한다. R4 결과 checkpoint `b0ba0bf683928b2b5087cc77ae7c0e7caf9ca9ce`는 기존 사설 branch에 보존됐다. R4의 브라우저는 fixture interception, OIDC API는 별도 격리 PG15이므로 통합 E2E는 미검증이다.
- 승인된 U-01 운영자의 경고 조회를 위해 기존 `GET /api/operations/alerts`의 `x-alert-before-sequence` 안정 cursor로 과거 저장 페이지를 **사용자 요청 시에만** 추가 읽는다. 100건을 넘는 저장 critical을 `부분 결과` 문구에 가둬두지 않는 내부 UI 연결이다. 새 route·permission·DB·detector·ack mutation은 만들지 않는다.
- C30 사건은 CRITICAL `OPEN_BLOCKING`, ReleaseDecision `DEFER`, U-01/F-20 미수락이다. R5도 main 병합·새 branch·ysna-server/Production을 수행하지 않는다.

## 정확한 경계

1. R4 epoch16 write→worker lease를 순서대로 회수한 뒤 R5 epoch17 exact3 `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R5_ALERT_PAGING_RESULT.md`를 WI/Invocation·dual lease로 발급한다. G-05 PASS 전 제품 write는 금지한다.
2. 첫 페이지는 현 R4 계약과 같은 same-origin/credential GET이다. 과거 조회 버튼은 서버가 반환한 양의 정수 cursor가 있을 때만 나타나고, 클릭 시 같은 경로에 `x-alert-before-sequence` header를 붙인다. 응답은 매 페이지 최대100개·strict row/schema/cursor 검증을 통과해야 한다. 페이지 간 sequence는 배타적으로 감소하고 alert ID는 중복되지 않아야 한다. 누적 결과는 최신 항목부터 안정적으로 표시한다.
3. loading/partial/end/error를 분리한다. 진행 중 중복 클릭·중복 요청은 막고, older cursor가 있으면 여전히 미조회/부분 결과를 알린다. 마지막 페이지를 읽어도 ‘저장된 페이지 조회 종료’일 뿐 detector 실행·경고 신선도·운영 건강 PASS가 아니다. 인증 거부·HTTP/네트워크/JSON 오류, 빈/역행/반복 cursor, 겹침·위조 record는 전체 카드 `UNAVAILABLE`로 닫아 stale protected data를 유지하지 않는다. 브라우저 텍스트 escaping과 기존 Provider/Database·다른 메뉴는 유지한다.
4. TDD RED→GREEN Node 계약(101개 이상 두 페이지, 버튼/키보드·same-origin header, 중복 클릭, 끝/부분, 인증/HTTP/transport/위조/중복·악성 텍스트), web typecheck/lint/build, F-13 pagination 인접·G-05를 확인한다. Main 독립 diff/검증 후 기존 branch commit/push, WSL-server exact SHA의 격리 실제 API 및 headless 브라우저 1920×1080/390×844·Network 상대 경로를 별도로 기록한다. 임시 자원은 사전 이름·수명·정리 범위를 기록한다.

## 남는 조건

R5 GREEN은 저장된 Alert 과거 페이지 read만 증명한다. acknowledge·Next Actions·다른 Health/운영 카드, 실제 OIDC+browser 결합, detector 신선도/완전성, U-01/F-20 독립 acceptance는 후속 작업이다. rollback은 R5 제품 commit만 정상 Git revert해 R4의 단일 페이지/부분 경고 UI로 복귀한다. 원장·DB·이전 승인 기록은 되돌리지 않는다.
