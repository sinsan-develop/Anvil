# C-21 배포 마이그레이션 DSN 수정 보고서

- 일자: 2026-09-02
- 담당: developer-primary subagent
- 작업 브랜치: `codex/fix-alembic-psycopg2-runtime`
- 시작 HEAD: `6565b3e4f021085831151afdfbfbe1d00052dc55`
- 판정: `COMPLETED` (로컬 코드 및 회귀 검증 범위)
- 원격 배포: `NOT_EXECUTED` (작업 범위 제외)

## 판단 이유

ysna-server의 `ANVIL_DATABASE_URL`은 `postgresql+psycopg2://` 형식을 사용하지만 런타임 의존성은 psycopg 3이다. 기존 `normalize_postgresql_dsn()`은 `postgresql://`만 `postgresql+psycopg://`로 변환했고, `DatabaseSettings`는 psycopg2 dialect를 정규화 전에 거부했다. 따라서 Alembic 마이그레이션이 설치되지 않은 psycopg2 드라이버를 요구하거나 설정 단계에서 차단될 수 있었다.

## 조치

- `postgresql+psycopg2://`를 `postgresql+psycopg://`로 변환하도록 DSN 정규화를 확장했다.
- `DatabaseSettings`가 psycopg2 dialect 입력을 정규화 대상으로 허용하도록 최소 변경했다.
- 이미 psycopg 3인 DSN과 다른 dialect 문자열은 정규화 함수가 그대로 보존함을 테스트했다.
- 변경 파일:
  - `packages/persistence/config.py`
  - `tests/persistence/test_repository_contract.py`

## TDD 증거

1. RED
   - 명령: `.\.venv\Scripts\python.exe -m pytest tests/persistence/test_repository_contract.py -q`
   - 결과: `1 failed, 4 passed`
   - 기대한 실패: `postgresql+psycopg2://` 입력이 `ConfigurationError`로 거부됨
   - 참고: pytest cache 경로 권한 경고 2건이 있었으며 코드 실패와 무관했다.
2. GREEN
   - 명령: `.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/persistence/test_repository_contract.py -q`
   - 결과: `5 passed in 0.17s`
3. 관련 회귀 검증
   - 명령: `.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/persistence tests/api/test_runtime_app.py tests/deploy/test_ysna_deployment_contract.py -q`
   - 결과: `27 passed in 0.66s`

## 영향 및 미검증 범위

- 영향 범위: persistence 환경 설정에서 PostgreSQL SQLAlchemy dialect 선택
- 기존 `postgresql://` 및 `postgresql+psycopg://` 동작은 유지된다.
- 운영 서버 배포, 실제 Alembic 실행, 운영 DB 연결은 이 작업에서 실행하지 않았으며 `NOT_EXECUTED`다.
- 오류 횟수: 구현 실패 0회. 최초 RED 1회는 의도한 회귀 재현이다.

## Rollback

이 커밋을 revert하면 수정 전 DSN 정규화와 테스트 상태로 복구된다. 운영 환경이나 DB에는 변경을 수행하지 않았다.

## 다음 조치

Main Agent가 diff와 테스트 증거를 독립 검토한 뒤 승인된 ReleaseManifest 및 표준 배포 절차로 운영 마이그레이션을 재검증한다.
