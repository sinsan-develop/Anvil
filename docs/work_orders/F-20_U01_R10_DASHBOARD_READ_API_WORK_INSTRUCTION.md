# F-20/U-01 R10 Dashboard 읽기 API WorkInstruction

- 발행자: Main 어울. 효력 조건: canonical WI Event·새 worker/write dual lease·G-05 PASS 전 제품 수정 금지.
- 상위 권위: 승인된 Anvil 설계·작업계획·매트릭스·테스트계획과 `docs/04_test_reports/F-20_U01_R10_DASHBOARD_READ_API_PLAN.md` (SHA-256 `C7FF3B1915C9834AF3E2E1E2E5F355D4DF074B7A68C35718A382CDE1B97D9A85`).
- 분류: 승인된 U-01 Dashboard same-origin API/BFF 구현의 읽기 단위. 기존 인증·scope·alert/audit 권한 확대 없음. 새 `dashboard:read`는 별도 최소권한이며 기본 부여하지 않는다.

## 정확한 제품 쓰기 범위

1. `packages/api/registry.py`
2. `packages/api/operations.py`
3. `tests/api/test_f20_u01_r10_dashboard_api.py`
4. `tests/api/test_f20_u01_r10_oidc_dashboard.py`
5. `docs/04_test_reports/F-20_U01_R10_DASHBOARD_READ_API_RESULT.md`

## 구현·완료 조건

- canonical `GET /api/dashboard/operations`를 새 `dashboard:read` permission으로 registry/OperationsPort에 등록한다. principal과 authorization resolver의 project/environment가 trusted Operations owner와 일치해야 한다. 기존 alert/audit GET 권한만으로는 이 route에 접근하지 못한다.
- 내부 `snapshot()`만 조회하며 GET에서 `detect()`/audit append/Queue mutation을 호출하지 않는다. 허용 응답은 기존 snapshot 필드뿐이고 미연결/미실행 source를 건강·성공으로 변환하지 않는다.
- legacy/100건/DB/owner 오류는 안정적 공개 오류와 503으로 fail closed, SQL/credential/payload/fencing token 비노출. 기존 alert/audit route 및 인증·CSRF·same-origin 계약 회귀를 검증한다.
- 로컬 TDD RED→GREEN·API/ASGI 인접 테스트, Main 독립 검토와 사설 push→WSL-server 동일 SHA 실제 PG15/API 검증을 분리하여 보고한다. Developer는 exact5 외 파일 수정, commit/push/merge/WSL·공유 자원·ysna/Production 접근을 하지 않는다.
- UI, 다른 source 연결, 실제 브라우저/E-SHOT/E-NET, 전체 U-01/F-20 수락, C30 사건 복구는 제외한다. 미검증 범위를 PASS로 승격하지 않는다.
