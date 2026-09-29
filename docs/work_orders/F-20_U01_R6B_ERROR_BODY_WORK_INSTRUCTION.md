# F-20/U-01 R6B 브라우저 오류 응답 완료 경계 WorkInstruction

- 발행 준비자: Main 어울. **DRAFT — canonical WI Event·epoch19 exact5 dual lease/G-05 PASS 전 제품 exact5 수정 금지.**
- 상위 권위: 승인된 U-01 작업계획·설계·매트릭스 및 `docs/04_test_reports/F-20_U01_R6B_ERROR_BODY_BINDING_PLAN.md`.
- 분류: 기존 R6 실패의 내부 구현 보완. 기능 요구·공개 API·DB·권한·Secret·운영 영향 변경 없음. 제품 UI의 기존 표시/오류 계약은 유지한다.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `tests/integration/test_f20_u01_oidc_browser_pg15.py`
4. `tests/browser/f20-u01-oidc-browser-pg15.mjs`
5. `docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_RESULT.md`

Main은 R6 epoch18 write→worker를 순서대로 회수한 뒤 R6B epoch19 worker/write exact5를 발급한다. 단일 Developer만 위 다섯 경로를 수정하고 Main은 동시 수정하지 않는다.

## 실행·검증

- 비정상 Provider/Alerts/Health fetch의 body 완료 처리와 기존 fail-closed 화면 상태·비밀 비노출을 먼저 RED→GREEN으로 검증한다. 성공 경로·AbortController·빠른 연속 요청·화면 접근성 회귀를 확인한다. 본문 원문을 DOM/로그에 표시하지 않는다.
- 실제 WSL-server에서는 private push→동일 SHA pull 후 진단 flag **OFF**로 PG15 migration0019·합성 OIDC·Chromium same-origin Network/저장 Critical/권한 철회 E2E를 실행한다. 진단 ON의 과거 SKIP은 합격 근거가 아니다.
- 로컬 Node/Python 인접, typecheck/lint/build, G-05/diff, WSL 임시 자원 사전 기록/신원 확인/정리·잔여0을 수행한다.
- Developer는 변경·RED/GREEN·실행 명령/exit·미검증/rollback을 결과보고서에 기록하고 Main에게 인계한다. commit/push/merge 및 WSL 공유 자원 변경은 하지 않는다.
- 공개 API/role/권한 계약·DB schema/migration·Secret·새 기능·새 branch/main 병합·ysna-server/Production은 범위 밖. C30 `OPEN_BLOCKING`/DEFER와 U-01/F-20 미수락을 유지한다.
