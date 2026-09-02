# C-21 운영 migration/deploy 표준화 구현 보고서

## 판정

`COMPLETED / LOCAL_CONTRACT_VERIFIED / PRODUCTION_NOT_EXECUTED`

승인된 C-21 canonical Run/Event migration을 `anvil-web:3770` 표준 배포 경로에
fail-closed로 연결했다. 실제 ysna-server, 운영 DB, NPM, Telegram, Provider에는
변경을 수행하지 않았다. `anvil-internal-web-1` 제거도 구현하거나 실행하지 않았다.

## 기준선

- 작업 역할: `developer-primary` 단일 writer
- 작업 브랜치: `codex/c21-production-migration-deploy`
- 시작 HEAD: `104f406d765c1efc57ad4db505a055c2d4035e0c`
- 시작 상태: clean
- 설계서 SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 통합검증매트릭스 SHA-256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획서 SHA-256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 운영규칙 SHA-256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`

## 구현

- exact commit을 OCI `org.opencontainers.image.revision` label과 compose build arg에
  결박하고 build 결과의 label을 배포 전에 확인한다.
- migration 실행 image와 runtime image를 같은 `anvil-web:<commit12>`로 고정한다.
- migration 전 DB revision이 정확히 `0011_telegram_webhook_state`가 아니면 중단한다.
- `shared-db/anvil` 전체를 PostgreSQL custom format으로
  `~/deploy/anvil/runtime/db-backups/anvil-<UTC>-<commit>.dump`에 백업한다.
- 백업은 컨테이너 내부 `pg_restore -l`, host non-empty, SHA-256 sidecar 생성까지
  통과해야 한다. token, DSN, password는 명령·로그·evidence에 출력하지 않는다.
- `alembic upgrade 0012_run_authority`를 명시 실행하고 적용 후 정확 revision을
  다시 확인한다. `head` 승격이나 자동 downgrade는 사용하지 않는다.
- migration 성공 뒤 runtime start/healthy, NPM Docker DNS, `nginx -t`, graceful
  reload, public live/ready/OpenAPI, 고유 live probe log correlation을 순서대로 확인한다.
- 위 준비가 끝난 뒤 기존 exact-hash/backup/restore 계약의
  `remove-npm-telegram-override.sh`를 호출한다.
- migration 이후 실패는 `INCIDENT_HOLD`로 중단하고 schema를 유지한다. 이전
  application image rollback만 시도하며 internal runtime 보존 메시지를 남긴다.
- 기존 rollback alias 경로의 이름 순서 결함과 redirection-only read 결함을 수정하고,
  rollback build도 previous commit OCI label에 결박했다.
- 최초 승격은 현재 서버 checkout의 deploy script를 직접 실행하지 않는다. target commit의
  versioned bootstrap을 먼저 가져오고, bootstrap이 target deploy script를 임시 추출하여
  Git blob SHA를 검증한 뒤 그 파일을 실행한다. main deploy script도 자신의 내용 SHA-256이
  target commit의 script 내용 SHA-256과 다르면 외부 변경 전에 중단한다.
- `docker cp` 전 컨테이너 dump SHA-256과 host retained dump SHA-256을 exact 비교한다.
- rollback은 previous image OCI revision, compose up, health wait/final healthy를 모두 확인한
  뒤에만 current alias를 갱신한다. mismatch/unhealthy에서는 기존 alias를 보존한다.
- 이전 release 자체 Dockerfile이 OCI label을 지원하지 않아도 rollback할 수 있도록, rollback
  시작 시 현재 target HEAD의 versioned Dockerfile을 runtime temp에 추출하고 SHA-256을 exact
  검증한다. 그 뒤 previous source checkout을 보존 Dockerfile로 직접 build하고 compose up에는
  `--no-build`를 적용한다. temp Dockerfile은 성공·실패 모두 EXIT trap에서 제거한다.

## TDD 및 검증 증거

### RED

- 명령: `.venv\\Scripts\\python.exe -m pytest -p no:cacheprovider --basetemp C:\\tmp\\anvil-c21-deploy-red7 tests/deploy/test_public_deploy_pipeline.py -q`
- 결과: `4 failed`
- 기대한 기능부재: DB backup 없음, 0011 fail-closed 없음, backup catalog failure
  차단 없음, migration 이후 runtime failure의 no-downgrade incident 계약 없음.
- rollback exact revision 추가 RED: previous image build가 새 release revision을
  상속하여 `1 failed`.

### GREEN

- 핵심 pipeline: `4 passed in 6.43s`
- 전체 deploy suite:
  `C:\\Users\\cyhuh\\anaconda3\\python.exe -m pytest -p no:cacheprovider --basetemp C:\\tmp\\anvil-c21-deploy-suite2 tests/deploy -q`
- 최초 전체 GREEN: `30 passed in 9.48s`
- 문서 반영 후 최종 fresh 결과: `30 passed in 9.80s`
- Main review 보완 RED: 실제 Alembic 형식 `0012_run_authority (head)`를 fake가
  반환하자 postcheck가 전체 줄을 비교해 `1 failed`와 `INCIDENT_HOLD`를 재현했다.
- Main review 보완 GREEN: 비어 있지 않은 revision line이 정확히 하나일 때 첫 token만
  canonical revision으로 파싱하도록 수정했다. 전체 deploy suite `30 passed in 10.75s`,
  shell parse 3건과 `git diff --check` PASS.
- 정식 `FAILURE_REPORT` 1회차 RED:
  `tests/deploy/test_public_deploy_pipeline.py`에서 `4 failed` — old checkout bootstrap 부재,
  copied backup corruption 미차단, rollback OCI mismatch 미차단, unhealthy rollback 뒤 alias
  갱신을 각각 재현했다.
- 정식 재작업 focused GREEN:
  `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/deploy/test_public_deploy_pipeline.py -q -p no:cacheprovider --basetemp C:\tmp\anvil-c21-failure1-green4`
  → `8 passed in 14.18s`.
- 정식 재작업 전체 GREEN:
  `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/deploy -q -p no:cacheprovider --basetemp C:\tmp\anvil-c21-failure1-full`
  → `34 passed in 16.46s`.
- 전체 deploy review 재작업 2차 / 신규 fingerprint
  `ROLLBACK_PREVIOUS_DOCKERFILE_NO_REVISION_LABEL` 1회:
  실제 `0079699:deploy/ysna/Dockerfile.web`에 revision ARG/LABEL이 없음을 확인했다.
  legacy Dockerfile fixture에서 기존 compose rollback build가 빈 label을 만들고 exact check에서
  exit 6이 되는 RED `1 failed`를 재현했다.
- 보완 focused GREEN:
  `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/deploy/test_public_deploy_pipeline.py::test_rollback_builds_previous_source_with_target_versioned_dockerfile -q -p no:cacheprovider --basetemp C:\tmp\anvil-c21-rollback-dockerfile-green2`
  → `1 passed in 1.21s`.
- 보완 전체 GREEN:
  `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/deploy -q -p no:cacheprovider --basetemp C:\tmp\anvil-c21-rollback-dockerfile-final`
  → 보존 Dockerfile과 target versioned Dockerfile의 byte-exact fixture assertion 포함
  `35 passed in 20.27s`.
- shell parse: Git Bash `bash -n`으로 bootstrap, deploy, rollback, NPM override removal 4개 PASS.
- `git diff --check`: PASS.

프로젝트 `.venv`의 전체 deploy suite 첫 실행은 `PyYAML` 미설치로 collection이
중단됐다. 코드 실패로 집계하지 않았고, 이미 PyYAML 6.0.3과 pytest 8.4.2가 설치된
로컬 Anaconda Python으로 같은 전체 suite를 실행해 위 결과를 얻었다.

## 변경 파일

- `deploy/ysna/Dockerfile.web`
- `deploy/ysna/compose.public-preview.yml`
- `deploy/ysna/bootstrap-public-deploy.sh`
- `deploy/ysna/deploy-public-preview.sh`
- `deploy/ysna/rollback-public-preview.sh`
- `deploy/ysna/README.md`
- `tests/deploy/test_public_deploy_pipeline.py`
- `CODEX_WORK_LOG.md`
- 이 보고서

## 미검증과 rollback

- 운영 DB backup/apply, 실제 image build, ysna runtime health, NPM override backup/remove,
  Telegram signed POST, Provider non-billing probe, authenticated SSE/Last-Event-ID는
  모두 `NOT_EXECUTED`다.
- exact release commit/tag/ReleaseManifest/DeployApproval binding은 Main 통합 commit이
  정해진 뒤 갱신해야 한다.
- 배포 전 실패는 DB를 변경하지 않는다. 0012 성공 뒤 실패는 자동 schema downgrade를
  금지하며 검증된 backup을 보존하고 incident 판단을 기다린다. application rollback만
  허용한다.
- `anvil-internal-web-1`은 전체 수직 검증이 모두 성공한 뒤 Main Agent만 제거할 수 있다.

## 오류 횟수와 다음 조치

- 정식 동일 lineage `FAILURE_REPORT`: 1회
- 신규 fingerprint `ROLLBACK_PREVIOUS_DOCKERFILE_NO_REVISION_LABEL`: 1회
- 전체 deploy review 재작업 cycle: 2차
- 의도한 TDD RED: pipeline 1 cycle, rollback binding 1 cycle, Alembic `(head)` parsing 1 cycle
- Windows test harness 보정: temp ACL, bash 선택, NTFS mode/executable, nested bash PATH와
  Windows형 임시경로를 각각 분리 해결했으며 production failure로 집계하지 않는다.
- 임시 리소스: worktree `.tmp`의 C-21 pytest fixture와 `C:\\tmp\\anvil-c21-deploy-*`
  fixture를 제거했고 잔여 0건을 확인했다. container, volume, network, port는 생성하지 않았다.
- 다음 조치: Main Agent diff 독립 검토 → commit/tag/manifest/binding 확정 → 승인된
  Git-only ysna 배포 → 운영 수직 검증 전량 PASS일 때만 internal 제거.
