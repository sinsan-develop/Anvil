# C-21/LR-02C 운영 실행 보고서

## 판정

`REWORK_IMPLEMENTED / LOCAL_VERIFIED / BACKUP_ATTEMPT_2_NOT_EXECUTED`

운영 preflight는 통과했으나 backup attempt 1이 PostgreSQL client에 전달된 DSN scheme 호환 문제로 dump 생성 전에 exit 20으로 종료됐다. 배포·migration·Telegram·Provider는 실행하지 않았다.

## 기준선과 운영 preflight

- repository main/origin main: `ca945dfe4fed9befedc46620aff24729c3898952`
- ReleaseManifest target: `095e1488ed85ec11986447539d04cf2b494dbd34`
- ysna checkout 시작 HEAD: `8ba679e72f53e20561e2063f3cdf01c10981a67b`
- fetch 후 ysna `origin/main`: `ca945dfe4fed9befedc46620aff24729c3898952`
- `INCIDENT_HOLD`: `ABSENT`
- deployment root `.env` mode: `600`
- `shared-db`: running/available
- `anvil-web`: healthy, unified runtime listener `3770`
- permission scope: backup 실행에 필요한 database client DSN 호환 권한/형식 미충족

## Backup attempt 1

- command path: Git에서 target commit의 versioned `deploy/ysna/backup-c21-db.sh`를 추출·hash 검증 후 실행
- result: exit `20`
- failure fingerprint: `C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE`
- root cause: `ANVIL_DATABASE_URL`의 `postgresql+psycopg2://` SQLAlchemy scheme이 libpq client에 그대로 전달되어 전체 문자열이 database name으로 해석됨
- dump file: `NOT_COMPLETED`
- backup receipt: `NOT_CREATED`
- restore-listability: `NOT_EXECUTED`
- migration/deploy/runtime replacement: `NOT_EXECUTED`
- Telegram signed POST: `NOT_EXECUTED / USER_VERIFICATION_PENDING`
- Provider probe: `NOT_EXECUTED / USER_VERIFICATION_PENDING`
- secret/token/cookie/DSN/payload body 기록: `0`

## 영향과 안전 조치

- database row와 schema는 변경하지 않았다.
- 배포 및 migration을 시작하지 않았다.
- 실패한 target script의 재실행을 중단했다.
- 기존 seq1~469, epoch3/4 revoked lease, backup-portability acceptance artifact를 변경하지 않는다.
- C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.

## 다음 조치

1. OPS-R2 변경을 새 checkpoint로 만들고 ReleaseManifest를 그 checkpoint에 재결박한다.
2. 새 release binding과 독립 검증이 완료된 뒤에만 운영 backup attempt 2를 실행한다.
3. Telegram/Provider는 제품 운영 검증에 포함하지 않고 신산님 확인 대기로 남긴다.

## OPS-R2 재작업 결과

- execution/write lease: epoch 5
- 변경 범위: `deploy/ysna/backup-c21-db.sh`, `tests/deploy/test_c21_lr02c_operational_contract.py`
- RED: focused 계약 테스트 exit `1`, 의도한 DSN 계약 실패 4건과 기존 PASS 14건을 확인했다.
- 구현: `postgresql+psycopg2://` prefix만 `postgresql://`로 정규화하고 `postgresql://` 및 `postgres://`는 그대로 보존한다.
- fail-closed: 그 밖의 scheme은 PostgreSQL client·Docker 호출 전에 exit `22`로 거부한다.
- 전달 경계: host는 normalized DSN을 `PGDATABASE` 환경변수로 받고, container는 stdin으로만 받는다. DSN과 credential은 argv·stdout·stderr·receipt에 포함하지 않는다.
- GREEN: focused 계약 테스트 `18 passed`; host/container 정규화, 기존 URI 보존, 미지원 scheme 거부, secret 비노출, host dump 실패 후 fallback 금지를 확인했다.
- backup attempt 2: `NOT_EXECUTED / BLOCKED_PENDING_CHECKPOINT_AND_RELEASE_REBIND`
- DB dump·migration·deploy·runtime replacement: `NOT_EXECUTED`
- Telegram/Provider: `NOT_EXECUTED / USER_VERIFICATION_PENDING`

## OPS-R2 governance validator 보완

- 인수 사유: 기존 governance fixer가 workspace permission `404`로 중단되어 동일 epoch 5 lease 안에서 인수했다. 이는 제품 실패 횟수에 포함하지 않는다.
- RED: historical acceptance validator가 승인된 current seq474/exact13 OPS-R2 projection을 `C21_BACKUP_PORTABILITY_ACCEPTANCE_PROJECTION_INVALID`, `C21_BACKUP_PORTABILITY_ACCEPTANCE_REPOSITORY_INVALID`로 거부했다.
- 구현: historical seq469/exact24와 current seq474/exact13의 정확한 두 상태만 허용하고, seq475 등 임의 후속 상태는 fail-closed로 거부한다.
- 보존: seq1~469 event canonical hash와 frozen backup-portability acceptance manifest/release binding 검증은 변경하지 않았다.
- 외부 실행: 서버·DB·Telegram·Provider·배포 `NOT_EXECUTED`.
- rollback: `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py` 및 이 보고서의 본 절 변경만 되돌린다.
