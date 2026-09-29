# F-20/U-01 R9 Queue source host WorkInstruction

- 발행자: Main 어울. **DRAFT — canonical WI Event·새 worker/write dual lease·G-05 PASS 전 제품 수정 금지.**
- 상위 권위: 승인된 Anvil 설계·작업계획·매트릭스·테스트계획과 `docs/04_test_reports/F-20_U01_R9_QUEUE_SOURCE_HOST_PLAN.md` (SHA-256 `DC703FBDAD5ADA1C20F6E8657A000C9F3539F0F1FD6F7263CC72AAC590CD1919`).
- 분류: U-01 실제 read model의 내부 host 연결. 공개 API·permission·DB schema·Secret·운영 영향 변경 없음.

## 정확한 제품 쓰기 범위

1. `packages/observability/service.py`
2. `apps/api/anvil_api/oidc_process.py`
3. `tests/observability/test_f20_u01_r9_queue_host.py`
4. `tests/api/test_f20_u01_r9_oidc_queue_host.py`
5. `docs/04_test_reports/F-20_U01_R9_QUEUE_HOST_RESULT.md`

## 구현·완료 조건

- `snapshot()`와 명시적 `detect()`마다 권한 고정 project/environment의 새 R8 Queue source를 로드한다. 기존 고정 `OperationsSources` 생성 방식·alert/audit GET·audit append 계약은 보존한다.
- legacy NULL scope, DB 오류, 100건 초과, loader 형식 오류는 완전한 빈 Queue 또는 HEALTHY로 표시하지 않는다. 사용자/로그에 SQL·credential·payload·fencing token을 노출하지 않는다. GET는 detector를 실행하거나 queue/audit를 쓰지 않는다.
- RED→GREEN, F-13/OIDC 인접 회귀, Main 독립 검토 후 사설 push→WSL-server 동일 SHA 격리 PostgreSQL 15 실제 시점·scope·legacy/실패 경계 검증을 구분하여 보고한다.
- Developer는 위 exact5만 수정하고 commit/push/merge, 공유 WSL 자원, 정식 `/srv`, ysna/Production에 접근하지 않는다. Main의 control/status 수정은 보존한다.
- 새 공개 endpoint·UI, Worker/Budget/Provider 연결, 건강 신호 생성, U-01/F-20 acceptance, C30 사고 복구는 제외한다. 정식 실패 횟수와 미검증은 결과에 구분한다.
