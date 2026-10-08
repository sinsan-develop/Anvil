# F-20/U-01 R11 Dashboard Queue 읽기 화면 WorkInstruction

- 발행자: Main 어울. 효력 조건: canonical WI Event·새 worker/write dual lease·G-05 PASS 전 제품 수정 금지.
- 상위 권위: 승인된 Anvil 설계·작업계획·매트릭스·테스트계획과 `docs/04_test_reports/F-20_U01_R11_DASHBOARD_QUEUE_UI_PLAN.md` (SHA-256 `69153489F8C30C71E00698F0BE7FD86A0FEE7CEF0D45FD2B7D3894D589792AD3`).
- 분류: 승인된 U-01 Dashboard 화면의 기존 R10 same-origin 읽기 API 연결. API·DB·permission·권한 변경 없음.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `docs/04_test_reports/F-20_U01_R11_DASHBOARD_QUEUE_UI_RESULT.md`

## 구현·완료 조건

- Queue 카드만 `GET /api/dashboard/operations`의 same-origin 상대 경로, 세션 credential, Accept JSON, AbortSignal로 연결한다. 401/403은 BLOCKED, 5xx/네트워크/비정상 envelope/snapshot은 UNAVAILABLE로 닫고 응답 원문·secret·내부 주소를 렌더하지 않는다.
- Queue 배열은 최대100행 및 형식 검증 뒤 행 내용 없이 `범위 내 관측 N건`만 표시한다. `source_gaps`의 `queue`는 health UNKNOWN이지만 gap 부재도 완전성·HEALTHY 증거가 아니다. 0행을 실제 0건이나 성공률로 표시하지 않는다.
- 기존 Database readiness, Provider 등록, Critical Alerts의 호출·권한·화면은 유지한다. 기존 레이아웃/스타일을 유지하고 React의 안전한 text rendering만 사용한다.
- 같은 exact3에 RED→GREEN 테스트를 작성하고 `npm run test:console`, `typecheck`, `lint`, `build` 및 인접 회귀를 실행한다. 제품 결과보고에는 시작 HEAD/branch/status, 변경 diff, 정확한 명령·exit·결과, 미검증·rollback을 기록한다.
- Developer는 exact3 외 파일 수정, commit/push/merge/WSL-server·공유 자원·ysna/Production 접근을 하지 않는다. Main이 별도 독립 검토·사설 push→WSL-server 동일 SHA 브라우저/API/Network 확인과 임시 자원 정리를 담당한다.
- 이 단위는 Next Actions·다른 Dashboard read model·U-01/F-20 전체 수락·C30 복구를 완료하지 않는다.
