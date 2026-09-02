# C-21 공개 `anvil-web:3770` 배포 경로 진단

## 판정

`deploy/ysna/deploy.sh`를 실행해도 공개 `anvil-web:3770` 이미지는 갱신되지 않는다. 이 스크립트는 `compose.internal.yml`의 `web` 서비스(`127.0.0.1:4173`)와 migration만 배포하며, 공개 컨테이너 `anvil-web`을 대상으로 하지 않는다.

## 확인 근거

- `deploy/ysna/deploy.sh`
  - `compose()`가 `compose.internal.yml`만 호출한다.
  - `compose up -d --build web`은 내부 `web` 서비스만 재빌드한다.
  - `compose.internal.yml`의 서비스명은 `web`, listener는 `127.0.0.1:4173`이다.
- `deploy/ysna/compose.public-preview.yml`
  - 공개 서비스/컨테이너는 `anvil-web`, 내부 포트 `3770`, 외부 `proxy-network`이다.
  - 이미지가 현재 checkout의 `apps/web`과 `Dockerfile.web-preview`에서 별도 빌드된다.
- `deploy/ysna/deploy-public-preview.sh`
  - 공개 컨테이너만 `docker compose -p anvil-public-preview ... build/up anvil-web`로 갱신한다.
  - 인자는 full 40자리 commit과 `anvil-ui-preview-YYYYMMDD.N` 형식의 release tag 모두 필수다.
  - `git rev-parse "$release_tag^{commit}"` 결과가 commit과 다르면 exit 4로 중단한다.
- `deploy/ysna/README.public-preview.md`
  - NPM 대상은 `anvil.sinsan.kr -> http://anvil-web:3770`으로 고정되어 있다.

따라서 내부 배포 성공은 `anvil-internal-web-1:4173` 갱신 증거일 뿐, 공개 `anvil-web:3770` 갱신 증거가 아니다. NPM 설정 변경은 필요하지 않으며 기존 `anvil-web:3770` 경로를 유지한 채 공개 이미지 배포를 별도로 수행해야 한다.

## 현재 승인/미충족 상태

- 사용자 승인 대상 commit: `8ba679e72f53e20561e2063f3cdf01c10981a67b`.
- `ReleaseManifest.json`은 위 commit과 `APPROVAL-20260902-C21-DEPLOY-004`를 결박한다.
- 로컬에서 확인된 `anvil-ui-preview-*` tag에는 `8ba679e`에 결박된 tag가 없다.
- 따라서 현재 공개 배포 스크립트의 필수 tag 인자를 충족하지 못한다.

## 표준 다음 조치와 승인 경계

1. `8ba679e`에 결박된 형식의 release tag를 GitHub 원격에 생성/푸시한다. 이는 외부 Git 쓰기이며, exact tag 이름과 tag 대상 commit에 대한 별도 승인이 필요하다.
2. ysna에서 다음 표준 명령을 실행한다.

   ```sh
   bash repo/deploy/ysna/deploy-public-preview.sh \
     8ba679e72f53e20561e2063f3cdf01c10981a67b \
     anvil-ui-preview-YYYYMMDD.N
   bash repo/deploy/ysna/verify-public-preview.sh \
     8ba679e72f53e20561e2063f3cdf01c10981a67b
   ```

3. 검증 범위는 `anvil-web` healthy, `proxy-network`, 내부 `3770`의 `/healthz`, `/health/live`, `/openapi.json`, 공개 HTTPS 보안 헤더와 API upstream, `nginx-proxy-manager`/`shared-db` container ID 불변이다.
4. 실패 시 `rollback-public-preview.sh`는 기록된 이전 SHA로 공개 이미지와 tag 상태만 되돌린다. NPM/DNS/DB를 변경하지 않는다.

`YYYYMMDD.N`은 임의 값으로 정하지 말고 release 기록과 충돌하지 않는 exact tag 이름을 승인 문서에 먼저 고정해야 한다. tag 생성·원격 push 및 공개 컨테이너 재기동은 이 진단의 read-only 범위를 넘어선다.

## 실행하지 않은 조치

- Git tag 생성/삭제/원격 push: 실행하지 않음.
- NPM/DNS 변경: 실행하지 않음.
- ysna 공개 컨테이너 재기동: 실행하지 않음.
