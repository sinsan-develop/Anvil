# C-21 단일 공개 런타임 진단

## 판정

현재 `anvil-web:3770`은 UI/Node 정적 서버이며, API·health·Telegram·SSE를 직접 처리하지 않는다. `apps/web/server.mjs`의 `proxyApiRequest()`가 `/api/`, `/health/`, `/integrations/`, `/auth/`, `/openapi.json`을 `ANVIL_API_UPSTREAM`으로 전달한다. 따라서 `anvil-internal-web-1:4173` 제거는 현재 이미지에서 즉시 수행할 수 없다. 포워딩을 유지하거나 UI preview를 운영 API로 승격하는 것은 요구사항을 충족하지 않으므로 구현하지 않았다.

## 확인 근거

- `deploy/ysna/compose.public-preview.yml`: `anvil-web`은 `Dockerfile.web-preview`, Node 22 단독 이미지, `3770`, `ANVIL_API_UPSTREAM=http://anvil-internal-web-1:4173`로 구성된다.
- `deploy/ysna/Dockerfile.web-preview`: Node 런타임과 `apps/web`만 복사한다. Python, FastAPI 앱, migrations, PostgreSQL 런타임 의존성이 없다.
- `deploy/ysna/compose.internal.yml`: 내부 `web`은 `Dockerfile.web`, `127.0.0.1:4173:4173`, FastAPI ASGI(`apps.api.anvil_api.asgi:app`)로 구성된다.
- `deploy/ysna/Dockerfile.web`: Python 3.12, `/opt/venv`, `packages`, `apps/api`, migrations, psycopg/SQLAlchemy 의존성을 포함하고 Uvicorn 4173을 실행한다.
- `apps/api/anvil_api/asgi.py`와 `packages/api/runtime.py`: DB engine/migration readiness, Telegram durable state, provider catalog, session auth, API/SSE route를 구성한다.

## 영향 범위

내부 컨테이너를 지금 중지·삭제하면 공개 API, health/readiness, `/auth/session`, Telegram webhook, OpenAPI, authenticated SSE가 함께 중단된다. 특히 DB 연결과 migration readiness는 Node 정적 서버에 존재하지 않는다.

## 정식 전환안

1. 별도 Work Package로 “Unified Anvil Runtime” 설계·승인: 공개 listener 하나가 UI 정적 파일과 FastAPI API를 같은 프로세스/컨테이너에서 직접 제공하도록 런타임 경계를 확정한다.
2. TDD로 FastAPI 앱에 운영 Frontend 정적 파일 mount/fallback과 same-origin route를 추가하고, Node proxy 의존성·`ANVIL_API_UPSTREAM`을 제거한다. API/SSE는 FastAPI가 직접 처리한다.
3. 단일 이미지에 UI 빌드 산출물과 Python runtime을 포함하고, 단일 `anvil-web` 서비스가 3770에서 ASGI를 listen하도록 Dockerfile/compose/healthcheck/deploy/rollback을 함께 변경한다.
4. 로컬 및 격리 환경에서 API·health·Telegram signed ingress·provider probe·SSE/Last-Event-ID와 UI 정적 응답을 같은 listener로 검증한다.
5. 승인된 release manifest로 배포한 뒤 실제 3770 수직 검증을 완료하고, 그 후에만 `anvil-internal-web-1` 제거를 수행한다.

## 롤백 및 금지선

전환 실패 시 이전 승인 commit의 단일 서비스 정의로 rollback한다. 검증 전 내부 컨테이너 삭제, NPM 변경, DB 변경, 서버 직접 patch는 수행하지 않는다. 이번 진단에서는 원격/NPM/DB를 변경하지 않았다.

## 1차 구현 상태

`INCOMPLETE / VERTICAL_SLICE_READY`: 별도 Unified Runtime 브랜치에서 FastAPI ASGI에 `mount_frontend()`를 추가하고, `/health/live`와 `/`가 동일 ASGI 앱에서 응답하는 회귀 테스트를 추가했다. `Dockerfile.web`은 UI 파일을 포함하고 3770에서 ASGI를 실행하도록 변경했으며, public compose/deploy는 더 이상 `ANVIL_API_UPSTREAM`을 설정하지 않는다. 원격 배포는 수행하지 않았다.

남은 작업은 `rollback-public-preview.sh` 및 `verify-public-preview.sh`의 unified 명칭/검증 계약 정리, 전체 API/SSE/Telegram 수직 테스트, 공개 운영 배포와 internal 컨테이너 제거 순서 검증이다. 이 단계가 끝나기 전에는 `anvil-internal-web-1`을 중지·삭제하지 않는다.
