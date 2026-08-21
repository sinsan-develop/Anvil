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
