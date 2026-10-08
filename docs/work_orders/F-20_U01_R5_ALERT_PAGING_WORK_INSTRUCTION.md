# F-20/U-01 R5 저장 경고 과거 페이지 WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event·epoch17 exact3 dual lease/G-05 PASS 전 제품 exact3 수정 금지.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_설계서_v2.md` §29.2·stable cursor, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_U01_R5_ALERT_PAGING_BINDING_PLAN.md`.
- 환경: Windows 로컬 개발, `ssh WSL-server` 격리 동일 SHA 검증. 기존 branch 하나만 사용하며 새 branch·main 병합·ysna-server·Production 제외.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `docs/04_test_reports/F-20_U01_R5_ALERT_PAGING_RESULT.md`

Main이 R4 epoch16 write→worker를 순서대로 회수하고 R5 epoch17 worker/write exact3를 발급한다. 단일 Developer만 제품 exact3을 쓰며 Main은 동시 수정하지 않는다.

## 구현·검증

- 기존 `GET /api/operations/alerts`와 `x-alert-before-sequence` header만 사용한다. 첫 페이지 로드 후 반환 cursor가 있을 때만 ‘과거 저장 경고 더 보기’ 버튼을 표시한다. 사용자가 누를 때 cursor를 붙여 same-origin·credential 포함 GET하고, 100개 상한·strict schema·페이지 간 배타적 sequence/ID·cursor 감소를 검증한다. 이전 페이지와 겹치거나 빈 과거 페이지·반복 cursor이면 카드 전체 `UNAVAILABLE`이다.
- 누적 critical/open|acknowledged 기록을 최신 순서로 안정 렌더링한다. warning/resolved는 검증하되 표시하지 않는다. loading 동안 중복 클릭을 막고, partial/마지막 저장 페이지를 구분한다. 인증 거부·500·통신/JSON 오류는 이전 protected record를 남기지 않고 `UNAVAILABLE`로 닫는다. 화면 문구는 detector 실행·전체 건강/0건·신선도를 주장하지 않는다. keyboard/aria-live와 React 텍스트 escaping을 유지한다.
- Node RED→GREEN(두 페이지 101+ 기록, 요청 header/credentials, 버튼/키보드, partial/end, 오류·중복·위조/악성 텍스트), web typecheck/lint/build, F-13 pagination 인접·G-05를 실행한다. Main 독립 검토/commit/push 뒤 WSL-server exact SHA 실제 API·브라우저 두 viewport·Network를 확인한다. 임시 자원은 사전 기록·정확한 경로 정리한다.
- 새 route·permission/role·DB migration·Secret, detector/ack mutation, Next Actions, 다른 Health/운영 카드·가짜 데이터는 만들지 않는다. 기존 Database/Provider·다른 메뉴와 C30 `OPEN_BLOCKING`/DEFER·U-01/F-20 미수락을 유지한다.
- 결과보고서에 시작 HEAD/branch/status, 기준 hash·token, diff, RED/GREEN 명령·exit·실측, WSL 미검증, 기존 기능·잔여 위험·rollback 및 progress/HANDOFF 상태를 기록한다. Developer는 Main 인수 전 commit/push/merge하지 않는다.

## 완료 경계

R5 GREEN도 실제 OIDC+브라우저 통합 E2E, U-01/F-20 수락 또는 C30 사고 복구가 아니다.
