# ysna 내부 배포

`ysna-server:~/deploy/anvil`에서 실행하는 localhost 전용 경로다. 서버 전용
`~/deploy/anvil/.env`(Git checkout인 `~/deploy/anvil/repo/.env`가 아님)를 배포
스크립트가 검증한 뒤 `runtime/anvil.env`로 원자적 복사하고 권한 `0600`을
보장한다. 비밀값은 Git, 이미지, 로그, evidence에 넣지
않는다. `web`은 `127.0.0.1:4173`과 내부 네트워크만 사용하고
`migrate`만 외부 `proxy-network`로 기존 DB에 접근한다.

```sh
./deploy/ysna/deploy.sh "$ANVIL_RELEASE_COMMIT"
./deploy/ysna/verify.sh
```

`deploy.sh`는 `.env`의 필수 secret reference를 확인하고 runtime 파일을 준비한
뒤 migration과 web을 실행한다. `compose.internal.yml`을 직접 실행할 때는
`ANVIL_RUNTIME_ENV_FILE="$PWD/runtime/anvil.env"`를 명시해야 한다. rollback은
runtime secret을 삭제하거나 덮어쓰지 않고 그대로 유지하며 application image만
되돌린다.

배포는 승인된 40자리 SHA와 ReleaseManifest만 사용한다. rollback은 application
image만 되돌리며 검증된 downgrade manifest 없이는 schema를 하향하지 않는다.

## Unified public runtime C-21 승격

`deploy-public-preview.sh`라는 기존 파일명은 호환을 위해 유지하지만 배포 대상은
임시 preview가 아니라 `anvil-web:3770` Unified FastAPI runtime이다. 스크립트는
다음 fail-closed 순서를 따른다.

1. versioned bootstrap이 target commit의 deployment script blob을 추출·검증·실행한다.
2. 실행 중 script SHA-256이 target commit의 `git show` blob과 같은지 확인한다.
3. release tag와 40자리 commit을 대조하고 해당 commit으로 이미지를 build한다.
4. 이미지의 OCI revision label이 commit과 같은지 확인한다.
5. 운영 DB revision이 정확히 `0011_telegram_webhook_state`인지 확인한다.
6. `runtime/db-backups`에 custom-format 전체 백업을 만들고 `pg_restore -l`과
   SHA-256 sidecar로 검증한다.
7. container 원본과 host 보존 dump SHA-256이 같은지 확인한다.
8. 같은 exact image로 `0012_run_authority`만 적용하고 revision을 재확인한다.
9. runtime start, live/ready/OpenAPI, Docker DNS, NPM config/reload 및 public log
   correlation을 통과한 뒤 versioned NPM Telegram override 제거 스크립트를 실행한다.

서버 checkout이 이전 revision이어도 target script를 사용하도록 다음 순서로 실행한다.

```sh
set -euo pipefail
git -C "$HOME/deploy/anvil/repo" fetch --prune --tags origin
git -C "$HOME/deploy/anvil/repo" show \
  "$ANVIL_RELEASE_COMMIT:deploy/ysna/bootstrap-public-deploy.sh" \
  | /usr/bin/bash -s -- "$ANVIL_RELEASE_COMMIT" "$ANVIL_RELEASE_TAG"
```

0012 적용 뒤 실패하면 자동 downgrade하지 않는다. application image rollback만
시도하고 `INCIDENT_HOLD`로 중단하며 `anvil-internal-web-1`은 전체 수직 검증이
끝날 때까지 보존한다. rollback은 시작 시 target release의 versioned Dockerfile을
runtime 임시 파일로 exact 보존·검증한 뒤 previous source checkout을 그 Dockerfile로
직접 build한다. OCI revision과 health가 모두 확인되기 전에는 current alias를 바꾸지
않으며 임시 Dockerfile은 종료 trap에서 제거한다.
