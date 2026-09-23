# F-01 WorkInstruction — Provider Catalog·DataEgressProfile·Secret Broker

- Work Package: `F-01`
- 목적: canonical 9개 Provider ID와 DataEgressProfile, SecretRef/Broker의 fail-closed 계약을 host-only로 구현한다.
- 실제 Provider/네트워크/DB/운영 배포/브라우저 실행은 금지한다.
- 구현 범위 exact5:
  1. `packages/provider_catalog/__init__.py`
  2. `packages/provider_catalog/models.py`
  3. `packages/provider_catalog/service.py`
  4. `tests/provider_catalog/test_provider_catalog_f01.py`
  5. `docs/04_test_reports/F-01_COMPLETION_REPORT.md`
- 필수 계약:
  - 승인된 canonical 9개 ID 외 입력은 거부한다.
  - egress 목적·호스트·retention·training/ZDR·비용 class를 명시하고 unknown/mismatch는 fail-closed한다.
  - SecretRef는 실제 secret 값을 보유·직렬화·로그·artifact에 기록하지 않으며 purpose/version/rotate/revoke 감사 이벤트만 남긴다.
  - 반환 객체는 detached immutable 구조이며 입력 mutation과 secret alias를 허용하지 않는다.
  - audit 순서와 canonical hash는 결정론적이어야 한다.
- 검증: TDD focused suite, compile, JSON/static, 관련 회귀. 실제 외부 연동은 `NOT_EXECUTED`로 기록한다.
- rollback: exact5만 되돌리고 기존 E-11/E-GATE control과 사용자 자료는 보존한다.
