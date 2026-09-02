# Anvil Public UI Preview

이 문서는 historical alias 파일명 `README.public-preview.md`를 유지한다. 현재 기준 배포 대상은 unified `anvil-web` 공개 shell이며, 기존 `public-preview` 명칭은 호환 문맥에서만 남긴다.

## Runtime boundary

- service/container: `anvil-web`
- internal port: `3770`
- external Docker network: existing `proxy-network`
- public proxy: Nginx Proxy Manager `anvil.sinsan.kr -> http://anvil-web:3770`
- persistent root: `~/deploy/anvil`
- anvil-web unified ASGI runtime: UI + `/api/*` + `/health/*` + `/integrations/*` + `/auth/*` + `/openapi.json` + SSE
- API/SSE handling is direct in the same 3770 listener; no `ANVIL_API_UPSTREAM` or internal 4173 dependency
- database/LLM/Agent/Provider runtime: loaded from the server-owned runtime environment

`shared-db`, NPM, 기존 container/network/volume은 이 Compose의 관리 대상이 아니다. Compose는 host port를 publish하지 않고 NPM과 같은 `proxy-network`에서만 서비스 이름으로 접근된다. 공개 shell은 읽기 전용 UI preview를 유지하면서 필요한 API 경로만 `anvil-web` 내부에서 upstream으로 프록시한다.

## Local contract check

```text
docker compose -f deploy/ysna/compose.public-preview.yml config
docker compose -f deploy/ysna/compose.public-preview.yml build anvil-web
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_anvil_public_preview_contract tests.deploy.test_anvil_public_preview_scripts -v
```

실제 서버 배포는 승인된 full Git SHA와 release tag를 사용하는 committed deployment script로만 수행한다. deploy/verify/rollback 스크립트는 canonical `anvil-web-*` runtime/evidence 파일을 기록하고 historical `public-preview-*` alias 파일도 함께 유지한다.
