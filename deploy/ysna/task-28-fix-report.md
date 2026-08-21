# C-32 fix round 1 report

## 판정

`COMPLETED` — 배포 아티팩트의 승인 경계, 런타임 readiness, 실패 중단·rollback 검증, 비밀 주입 경계를 보완했다. 실제 서버·Docker·DB·Telegram·Provider 호출은 실행하지 않았다.

## 변경 내용

- `manifest-guard.sh` 추가: ReleaseManifest 상태, 후보 commit, successor binding/hash, `origin/main` 도달성을 배포·검증 전에 확인한다.
- `deploy.sh`: migration 또는 service start 실패 시 즉시 중단하고 비밀값 없는 evidence를 남긴다.
- `rollback.sh`: 애플리케이션만 복구하고 schema downgrade는 수행하지 않으며 복구 후 `verify.sh`를 실행한다.
- `verify.sh`: manifest/clean checkout, localhost liveness와 readiness를 확인한다.
- `bootstrap-db.sh`: DB 비밀번호를 `psql -v` 인자로 전달하지 않고 stdin SQL로만 전달한다.
- `/health/ready`: DB 연결, `alembic_version`의 고정 migration head, runtime/provider references를 확인하며 secret 값은 응답하지 않는다.

## 검증

- `.venv\Scripts\python.exe -m pytest tests/deploy tests/api/test_runtime_app.py -q` — 12 passed
- `.venv\Scripts\python.exe -m compileall -q apps/api packages` — PASS
- `git diff --check` — PASS
- 실제 Docker/DB/서버/외부 Provider/Telegram — `NOT_EXECUTED` (범위 외 외부 side effect 방지)

## 잔여 위험

- 실제 `ysna-server`의 Docker/DB 연결과 ReleaseManifest 대상 SHA 정합성은 배포 전 운영 preflight에서 확인해야 한다.
- 기존 migration은 downgrade를 제공하지 않으므로 rollback은 애플리케이션 revision만 대상으로 한다.
