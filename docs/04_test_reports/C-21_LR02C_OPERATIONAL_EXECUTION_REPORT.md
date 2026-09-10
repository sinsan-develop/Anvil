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

## OPS-R2 backup attempt 2 실패 및 conninfo 재작업 R4

- 실행 artifact: Git blob `b4858ffb373066b24d7d9ee9bfde810160cacb75`의 `deploy/ysna/backup-c21-db.sh`
- 결과: exit `20`; scheme 정규화 이후에도 URI 전체가 literal dbname으로 처리됐다.
- 연결 분리 진단: self DNS PASS, local socket PASS, direct TCP authentication PASS, `PGDATABASE` URL connect/dump FAIL, service fd3 connect/schema dump PASS.
- backup dump/receipt/success: `NOT_CREATED / NOT_CREATED / NOT_RECORDED`
- deploy/migration/runtime replacement: `NOT_EXECUTED`
- Telegram/Provider: `NOT_EXECUTED / USER_VERIFICATION_PENDING`
- failure lineage: `C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE`, valid failure count `2`
- 기존 epoch 5 worker/write lease를 exact13 conninfo rework 범위로 이어서 사용한다.

### TDD 결과

- RED: 기존 URI 전달 구현에서 `19 failed, 12 passed`; fd3 service, strict invalid input, Python 3 fail-close 계약이 의도대로 실패했다.
- GREEN: `31 passed`; 세 scheme, percent-decoded credential/db, 허용 query, host/container fd3 service exact bytes, invalid/ambiguous input의 client 0회, Python 3 부재, 실패 cleanup과 no fallback을 검증했다.
- 구현: Python 3 stdlib stdin parser가 strict validate한 `[anvil_backup]` stanza를 stdout으로 렌더하고 host/container PostgreSQL client에 pipe→fd3로만 전달한다.
- credential/URI는 argv, stdout/stderr, receipt, disk 또는 container temp에 기록하지 않는다.
- backup attempt 3, ReleaseManifest rebind, main merge, deploy, Telegram, Provider는 `NOT_EXECUTED`다.

## Main takeover 및 PMO Stage PR 적용

- takeover: 동일 historical successor projection drift가 3회 이상 반복되어 Main Agent가 checker/test 최소 보완을 직접 인수했다.
- 보완 결과: historical R2 manifest binding은 고정값과 Git blob으로 검증하고, current R4는 strict seq481/exact13 validator가 완전히 통과할 때만 successor로 허용한다.
- 검증: project checker `PASS sequence=481`; tooling `94 passed`; 제품 R4 계약 `31 passed`는 보존했다.
- 최종 fresh 검증: API `99 passed`, ysna script `6 passed`, `backup-c21-db.sh` Bash syntax PASS, `git diff --check` PASS, exact13·JSON duplicate 0·seq1~478 canonical hash 불변을 확인했다.
- PMO 적용: 이후 C-21 사용자 인수 단계는 branch commit을 push하고 Stage PR을 만든 뒤 staging 배포·사용자 확인·병합 순서로 진행한다.
- 기존 예외: `b4858ff` 및 governance 후속 commit은 새 PMO 지시 수신 전에 main에 먼저 통합됐다. history rewrite/revert 없이 forward 방식으로 수습한다.
- 환경 경계: 기존 프로젝트 문서는 `ysna-server`/`anvil.sinsan.kr`를 Production으로 정의하지만 새 PMO 규칙은 별도 Oracle Cloud staging 선배포를 요구한다. 별도 staging 정보가 없으므로 외부 배포 전에 대상 환경을 신산님과 확정한다.
