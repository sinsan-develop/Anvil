# F-18 R43B2 WSL-server 격리 runtime 검증

## 사전 판정

- 상태 `NOT_STARTED`; R43B1 합성 issuer 로컬·정적 결과와 R43A Compose config는 실제 runtime 인수가 아니다. F-18 `accepted=false`, F-19 blocked, Production `NOT_EXECUTED`.
- 시작 전 원격 read-only inventory: `ssh WSL-server`의 Docker Compose v5.1.1, `/home/daon/anvil-f18-r43b2-qa`·`/srv/anvil-wsl/f18-ops-rehearsal` 부재, WSL TCP 8444 listener 없음, F18 cleanup label 컨테이너 없음, 공유 `anvil-web` healthy·`local-postgres` Up. `/srv/anvil-wsl`은 root:root 755이므로 새 checkout은 `/home/daon` 전용 경로를 사용한다. 지정 SSH Git 별칭은 `c6baa6a75da984ba3f077e6e684078aea93100f2`를 읽을 수 있다.

## 생성 예정 전용 자원과 수명

- WSL-server owner OS `daon`, Main 검증 소유: Git checkout `/home/daon/anvil-f18-r43b2-qa`, Git 밖 합성 material `/home/daon/anvil-f18-r43b2-material`. 생성 전 두 경로 부재·realpath·owner 재확인; 작업 수명은 이번 R43B2 단회 QA이며 종료/실패 시 둘 다 제거 후 부재 확인. material에는 합성 CA/cert/key, issuer signing key, client-secret, trust JSON, Compose env만 두고 Git·로그에 원문을 남기지 않는다.
- 전용 Compose project `anvil-f18-r43b2`, services web/api/worker/postgres/minio/oidc-issuer, network project prefix 한정. Web `127.0.0.1:8444`만 host publish. 이 project의 컨테이너·network·합성 PG18 DB `anvil_f18_qa`/role `anvil_app`은 `docker compose -p anvil-f18-r43b2 ... down --remove-orphans`로 제거한다. 다른 Compose project나 공유 DB/서비스는 만지지 않는다.
- 전용 태그 `anvil-f18-r43b2-web:<exact12>`, `...-api:<exact12>`, `...-worker:<exact12>`, `...-issuer:<exact12>`의 Git archive exact SHA build 이미지 4개, 이미지 ID/revision label과 참조 컨테이너를 확인한 후 전용 ID만 제거한다. PostgreSQL 18·MinIO 검증 이미지 ID는 공유 cache로 간주해 삭제하지 않는다. Docker volume은 만들지 않고 PG18/MinIO 임시 데이터는 Compose tmpfs만 사용한다.
- Windows 로컬 8444 SSH tunnel process 1개와 격리 Chrome 임시 프로필/프로세스·시험 산출물은 실제 실행 직전 경로/PID를 추가 기록한다. 기존 Chrome 프로필·탭·계정과 OS 전역 인증서 저장소는 사용·변경하지 않고 종료 후 정확한 PID/path만 제거한다.
- 브라우저 시험 전용 확정 경로는 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r43b2-chrome-profile` 하나이며, 최초 실행 전 부재를 확인한다. 이 프로필의 netlog/캐시/Crashpad 산출물은 내부에만 둔다. Windows `ssh.exe`는 `127.0.0.1:8444`→`WSL-server`의 `127.0.0.1:8444` 터널로만 숨김 실행하고 PID·명령행을 확인한다. Chrome은 별도 headless process, profile 한정 `anvil-f18-qa.local`→loopback DNS와 합성 TLS 인증서의 SPKI pin만 허용한다. 검사 후 해당 Chrome 프로필을 사용하는 PID와 해당 SSH PID만 종료하고 전용 경로를 검증 후 제거한다.

## 결과

R43B2 Main 검증 lease seq1655/G-05 PASS, clean/원격 동일 SHA `91bdc617ae0c3d1096d173d1e64cbe4207c4022b`에서 시작했다. WSL-server 전용 checkout은 지정 SSH Git에서 detached exact SHA로 받고 clean·owner `daon`, B1 제품 `160e98e` 조상을 확인했다. 제한 `git archive`에서 전용 image 4개를 빌드했고 image ID는 Web `18ce517eb8ad`, API `2b71409f9238`, Worker `188468495003`, issuer `3fcc0a63ac8d`(각 full SHA-256 image ID는 WSL Docker에서 검증), 모두 `org.opencontainers.image.revision=91bdc61...` 및 Web UID101/API·Worker·issuer UID10001이었다. PG18 cache ID `4b87d5343a0e`, MinIO cache ID `69b2ec208575`는 공유 cache로 보존한다.

Git 밖 material 8개 파일을 일회성으로 만들고 dir0700, key/Secret/trust mode0640 group10001, TLS key mode0640 group101, CA/cert public mode0644, Compose env mode0600을 확인했다. `openssl verify` CA chain OK, TLS SAN `anvil-f18-qa.local` match. 실제 합성 값은 기록·출력하지 않았다. `docker compose config --quiet` exit0 및 정규화 JSON assertion `R43B2_CONFIG_PASS services=6 web_loopback_8444=1 private_publish=0 issuer_internal=1`. project `anvil-f18-r43b2`의 PG18/MinIO만 먼저 기동해 PG18 healthy, `anvil_app` 합성 role·DB 소유권 생성, API image의 Alembic upgrade exit0. 비관리자 SQL 실측 `anvil_app|anvil_f18_qa|18.4|0019_oidc_sessions|61`(public tables)과 합성 users/roles/user_roles/oidc_subject_bindings 각 1건을 확인했다. 이후 전용 Web/API/Worker/issuer를 기동했고 Web `nginx -t` exit0, HTTPS CA 검증 `/` 200, issuer JWKS 200, `/auth/session/status` 200, `/api/health/ready` 본문 `ready`/head0019, issuer의 불완전 auth 400·token 401을 확인했다.

실측 결함 2건을 발견해 R43B2 전체 PASS는 불가하다. Worker는 `migration_head_mismatch`로 exit1: 제품 `apps/worker/anvil_worker/main.py`가 F15 head `0016_operations_recovery`를 고정하지만 같은 Compose의 API/DB는 `0019_oidc_sessions`다. 실제 HTTPS OIDC authorization POST는 403 `ORIGIN_VALIDATION_FAILED`: Nginx는 `X-Forwarded-Proto=https`를 보내지만 API Uvicorn 0.35의 `FORWARDED_ALLOW_IPS` 기본값은 `127.0.0.1`이고 실제 Web proxy는 다른 container IP다. 앱의 `trusted_proxy_ips` 기본값도 공란이라 API가 observed HTTP scheme과 HTTPS Origin을 불일치로 거부한다. 첫 Main 흐름 assertion exit1은 이 실제 403을 검출한 것이며 별도 harness 결함은 아니다. 서비스/API가 UP이거나 health ready여도 OIDC 허용 흐름/Worker readiness를 PASS로 승격하지 않는다. 브라우저 same-origin 정적·Network는 독립 검증 후 기록하고, 전용 자원 전량 정리·B2 lease 회수 후 별도 제품 보정 WI를 발행한다.
