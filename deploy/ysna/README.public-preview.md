# Anvil Public UI Preview

이 Compose는 `anvil.sinsan.kr`에서 전체 메뉴 위치를 확인하기 위한 읽기 전용 UI 프리뷰만 실행한다.

## Runtime boundary

- service/container: `anvil-web`
- internal port: `3770`
- external Docker network: existing `proxy-network`
- public proxy: Nginx Proxy Manager `anvil.sinsan.kr -> http://anvil-web:3770`
- persistent root: `~/deploy/anvil`
- database/API/LLM/Agent/Provider: `NOT CONNECTED`

`shared-db`, NPM, 기존 container/network/volume은 이 Compose의 관리 대상이 아니다. Compose는 host port를 publish하지 않고 NPM과 같은 `proxy-network`에서만 서비스 이름으로 접근된다.

## Local contract check

```text
docker compose -f deploy/ysna/compose.public-preview.yml config
docker compose -f deploy/ysna/compose.public-preview.yml build anvil-web
```

실제 서버 배포는 승인된 full Git SHA와 release tag를 사용하는 committed deployment script로만 수행한다.
