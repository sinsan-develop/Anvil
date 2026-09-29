# F-20/U-01 R6 OIDC·브라우저·PG15 통합 검증 WorkInstruction

- 발행 준비자: Main 어울. **DRAFT — canonical WI Event·epoch18 exact3 dual lease/G-05 PASS 전 제품 exact3 수정 금지.**
- 상위 권위: 승인된 U-01 작업계획·설계·매트릭스와 `docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_BINDING_PLAN.md`.
- 목적: 격리 WSL-server의 실제 PG15 저장 경고가 HTTPS OIDC session을 가진 단일 Chromium context의 same-origin Dashboard에 표시되고 권한 철회 시 제거됨을 검증한다.

## 정확한 제품 쓰기 범위

1. `tests/integration/test_f20_u01_oidc_browser_pg15.py`
2. `tests/browser/f20-u01-oidc-browser-pg15.mjs`
3. `docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_RESULT.md`

Main은 R5 epoch17 write→worker를 순서대로 회수하고 R6 epoch18 worker/write exact3를 발급한다. 단일 Developer만 세 경로를 수정하며 Main은 동시 수정하지 않는다.

## 실행·검증

- 기존 OIDC ASGI factory/`OperationsService`/built `apps/web/dist`와 격리 PG15 migration `0019_oidc_sessions`를 결합한다. 사전 인증 401, callback 후 실제 저장 Critical GET 200·동일 브라우저 DOM 표시, role permission 철회 후 403·stale text 제거, same-origin Network/비밀 비노출을 확인한다.
- 사용자 로그인 UI는 현재 없으므로 브라우저 context에서 same-origin authorization/callback을 호출하고 임시 HTTPS IdP를 통해 code를 얻는다. 이를 로그인 버튼 클릭 증거로 보고하지 않는다.
- 로컬 RED→GREEN·Node/Python syntax·인접 API/UI 회귀·G-05를 실행한다. WSL 실제 통합은 Main 독립 확인/commit/private push 후 exact SHA의 사전 명명 격리 자원에서만 실행한다. 정식 shared checkout·anvil-web·공유 DB/.env는 변경하지 않는다.
- 실측 명령/exit·전후 SHA/branch/status·baseline hash·token·diff·정리 잔류·미검증·rollback을 결과보고서에 기록한다. Developer는 Main 인수 전 commit/push/merge하지 않는다.
- 공개 API/role/권한 계약·DB schema/migration·Secret·제품 UI/서비스 동작·ysna-server/Production·새 branch/main 병합은 범위 밖이다. C30 `OPEN_BLOCKING`/DEFER와 U-01/F-20 미수락을 유지한다.
