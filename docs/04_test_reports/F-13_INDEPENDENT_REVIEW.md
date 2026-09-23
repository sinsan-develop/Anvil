# F-13 독립 검토 — Operations read model/API

## 판정

SPEC PASS / QUALITY APPROVED (로컬 계약 범위). 최종 재검토에서 미해결 Critical 0, Important 0이다. 이는 실제 ASGI·DB·브라우저·배포 합격을 의미하지 않는다.

## 재검토 증거

- 최초 C1/I4는 감사 저장소 계약·재인스턴스 복원, GET 무쓰기, 권한별 응답 격리, evidence hash 및 health 이상 탐지로 재작업했다.
- 재검토 Important 1은 미해결 critical alert 101건의 페이지 조회로 해결했다. 첫 페이지 100건과 다음 페이지 1건에서 101건 모두 확인했고, GET 전후 repository event tuple은 동일하다. 응답에 fencing token·worker·budget 원자료가 없다. 잘못된 alert cursor는 400이다.
- 독립 집중 테스트 4 PASS. Main 관련 회귀 `tests/queue tests/leases tests/budget tests/api tests/observability`: 656 PASS, 6 SKIP (격리 PostgreSQL 18 DSN 없음), exit 0. G-05 시작 상태 PASS.
- WSL-server 임시 Git checkout에서 제품 SHA `772ab8deea508ff217dc89c6b45e453f157af018`을 detached 확인했다. 시스템 Python의 의존성 누락으로 첫 수집은 23 ERROR였으나, `uv sync --offline --group dev`로 lockfile·기존 캐시에서 격리 venv를 준비한 뒤 같은 관련 회귀 652 PASS, 10 SKIP, exit 0이었다. 추가 4 SKIP은 Windows 경로 별칭 전용 테스트이며 PostgreSQL 18 DSN 미설정 6 SKIP은 동일하다. 정확한 임시 checkout·pytest 두 경로를 확인·제거했고 잔여물 0이다. Docker/DB 컨테이너는 만들지 않았다.
- `apps`·`packages`의 기존 `/api/operations/alerts` 소비자는 확인되지 않아 bounded 응답 `{alerts, next_before_sequence}` 변경이 현행 화면 소비자를 깨지 않는다.

## 미검증 경계와 후속 결선

- 실제 `apps/api/anvil_api/asgi.py`는 `operations_owner` 없이 `create_runtime_app()`을 호출한다. 따라서 기본 ASGI의 두 operations GET은 501이며 운영 API PASS가 아니다.
- 실제 PostgreSQL durable adapter, host detector 주기 실행, 프로세스 재시작/다중 인스턴스, WSL-server, 실제 UI·브라우저 Network, Provider, 배포는 미실행이다. F-14 데이터베이스, F-15~19 런타임·환경 통합, U-01/U-10 화면 및 F Gate에서 각각 검증해야 한다.
- AV-OPS-001~006 중 L4 화면·L6 복구·실제 영속 감사 증거는 아직 충족되지 않았다. F-13의 인수 범위는 WorkInstruction의 read-model/API 계약뿐이다.

## Rollback

병합 전에는 F-13 branch를 병합하지 않는다. 병합 후 문제 발견 시 F-13 merge commit을 정상 revert하고, 기존 main과 사용자 dirty 자료를 보존한다.
