# ysna 내부 배포

`ysna-server:~/deploy/anvil`에서 실행하는 localhost 전용 경로다. 서버의
`runtime/anvil.env`는 권한 `0600`으로 생성하며 비밀값은 Git, 이미지, 로그,
evidence에 넣지 않는다. `web`은 `127.0.0.1:4173`과 내부 네트워크만 사용하고
`migrate`만 외부 `proxy-network`로 기존 DB에 접근한다.

```sh
./deploy/ysna/bootstrap-db.sh
docker compose -f deploy/ysna/compose.internal.yml --profile tools run --rm migrate
./deploy/ysna/deploy.sh "$ANVIL_RELEASE_COMMIT"
./deploy/ysna/verify.sh
```

배포는 승인된 40자리 SHA와 ReleaseManifest만 사용한다. rollback은 application
image만 되돌리며 검증된 downgrade manifest 없이는 schema를 하향하지 않는다.
