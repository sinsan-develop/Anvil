# C-21 운영 검증 보고서

## 판정

`PARTIAL / OPERATIONAL_BOUNDARY_NOT_VERIFIED`

C-21 WorkInstruction의 read-only 범위에서 확인 가능한 정적·로컬 HTTP·브라우저 계약 증거를 수집했다. 그러나 이 작업환경에는 Python/WSL 런타임과 `ysna-server` SSH 해석이 없고, 실제 Anvil 운영 서비스·DB·Provider·Telegram credential이 연결되어 있지 않다. 따라서 persistence, 실제 DB replay/audit, production same-origin/SSE, live Provider capability/drift, Telegram webhook을 `PASS`로 승격하지 않는다.

## 기준선 및 계보

- 작업 브랜치: `codex/c21-operational-validation`
- 시작 HEAD: `72fe26214fcfd8d4b5c9de3ce9f3453147bb1a7c` (`docs: issue C-21 operational validation`)
- `origin/main`: `4e91e339ce36b3ca6e56a0d30d5b228d4d3fe48f`
- 시작 `git status`: clean (브랜치만 표시)
- `git diff --check`: PASS, exit 0
- C-21 WorkInstruction SHA-256: `640D9693BA851C45464B118BD1CC7CC50068093EFCD922891327BF9EF5A6200A`
- C-21 Invocation Prompt SHA-256: `9A1478BB8BE08979F6765710F74D8B20678E69AAC8ADFB3271D42ABB3DD6BE7E`
- 설계서 SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- successor 검증 매트릭스 SHA-256: `696BED77D4CC6C4D928EA6931F1ADABE9B585738CBAF8A611AA694DB57C0FFC3`
- successor 테스트계획서 SHA-256: `F3B08A8CF3805351D2B1989995A87DF7862C03CBCE1B242D5DEF8EB0662CEACD`

## 실행 증거

| 검증 | 명령 | 결과 |
|---|---|---|
| 브라우저 계약 테스트 | `node --test apps/web/tests/*.mjs` | PASS, 14/14, exit 0 |
| Python 런타임 확인 | `py -3 --version` | FAIL, Python 3 미설치, exit 103 |
| Python focused 테스트 | `py -3 -m pytest tests/agent_team tests/api/test_telegram_webhook.py tests/persistence/test_telegram_webhook_state.py tests/api/test_runtime_app.py tests/api/test_sse_resume.py -q` | 실행 불가, Python 없음, exit 103 |
| Python compileall | `py -3 -m compileall -q packages apps/api` | 실행 불가, Python 없음, exit 103 |
| WSL 목록/명령 | `wsl.exe -l -v`, `wsl.exe -e sh -lc ...` | WSL service `E_ACCESSDENIED`, 실행 불가 |
| SSH 운영 호스트 | `ssh -o BatchMode=yes -o ConnectTimeout=5 ysna-server ...` | `Could not resolve hostname ysna-server`, exit 255 |
| 공개 HTTPS health | `curl.exe --max-time 8 -sS -I https://anvil.sinsan.kr` | 연결 실패, `Could not connect to server` |
| DNS | `Resolve-DnsName anvil.sinsan.kr` | A `161.33.20.13` 확인 |
| 저장소 compose | `Get-Content docker-compose.local.yml` | `services: {}`; 실행 서비스 없음 |

## 완료 조건별 판정

1. **commit/manifest/hash 및 health:** commit/hash와 정적 계보는 기록했다. 로컬 Anvil health 또는 운영 health는 확인하지 못했다. `anvil.sinsan.kr` DNS는 존재하지만 HTTPS 연결은 실패했다.
2. **PostgreSQL persistence/event/audit/replay:** migration `0011_telegram_webhook_state`가 `telegram_webhook_updates`, `telegram_webhook_audits`, `telegram_webhook_rate_limits`를 정의하는 정적 증거는 확인했다. 실제 PostgreSQL 연결·migration head·insert/replay/audit는 Python·WSL·DB 경계 부재로 미검증이다.
3. **Console/API same-origin/SSE:** Node 브라우저 계약 테스트 14건이 PASS했고 브라우저 코드 내부 endpoint 정적 검사도 테스트에 포함되어 있다. 운영 Console의 실제 Network, API, SSE/`Last-Event-ID`는 미검증이다. 로컬 `127.0.0.1:8080/health`의 `{"status":true}` 응답은 서버가 Anvil인지 식별되지 않아 Anvil PASS로 사용하지 않았다.
4. **Provider routing:** Provider 이름·credential reference를 코드와 문서에서 확인했으며, 현재 프로세스 환경에는 `ANVIL_*`, Provider key, Telegram key 이름이 노출되지 않았다. 실제 key 존재 여부, capability probe, drift 상태, live 호출은 미검증이며 과금 호출은 수행하지 않았다.
5. **Telegram webhook:** 코드와 migration에서 secret header, allowlist, nonce/command replay, audit/rate-limit 경계를 정적으로 확인했다. 실제 webhook 요청, Telegram API, secret rotation, durable replay/audit는 실행하지 않았다.
6. **안전 경계:** 운영 데이터 변경, 배포, webhook 변경, Provider 호출, schema migration/downgrade, public exposure 변경은 수행하지 않았다.

## 미검증 및 차단 경계

- Python/pytest/compileall: Python 3 미설치.
- WSL-server/`shared-db`: WSL service access denied.
- `ysna-server`: SSH alias DNS 해석 실패.
- 공개 `https://anvil.sinsan.kr`: DNS는 확인되나 443 연결 실패.
- 실제 Docker/container, PostgreSQL migration head 및 persistence transaction.
- 실제 browser Network/SSE reconnect/Last-Event-ID.
- 9개 Provider의 credential·health·capability·drift와 live fallback.
- Telegram webhook secret/allowlist/replay/audit/rate-limit 실전 요청.

위 상태는 C-21의 완료 조건 2~5에 대한 운영 PASS가 아니라 `NOT_EXECUTED`/`ENVIRONMENT_BLOCKED` 증거다.

## 다음 조치

1. Main Agent가 이 보고서와 실행 증거를 검토한다.
2. Python 3 및 WSL service 접근이 가능한 검증 호스트에서 focused pytest/compileall을 재실행한다.
3. 승인된 내부 환경에서만 `shared-db` migration head와 read-only persistence/replay/audit 조회를 수행한다.
4. `ysna-server` SSH/DNS 및 `anvil.sinsan.kr` reverse proxy가 복구된 뒤 실제 same-origin health/Network/SSE를 별도 증거로 수집한다.
5. Provider/Telegram은 credential 값을 출력하거나 변경하지 않고, 승인된 non-billing probe와 signed test fixture 경계를 별도로 승인한 뒤 수행한다.

## 2026-09-01 번들 런타임 재검증

- Codex bundled Python으로 `tests/agent_team`를 재실행해 **63 passed**를 확인했다.
- bundled Node로 `apps/web/tests/*.mjs`를 재실행해 **14 passed**를 확인했다.
- bundled Python `compileall -q packages apps/api` 및 `git diff --check`도 PASS했다.
- FastAPI/SQLAlchemy 의존 테스트는 bundled runtime에 패키지가 없어 collection 단계에서 미실행(`ModuleNotFoundError`)이며, 실제 WSL/DB/API 경계는 여전히 미검증이다.

## 2026-09-01 프로젝트 venv 재검증

- 프로젝트 `.venv`로 API·persistence fixture 테스트 **16 passed**를 확인했다.
- 동일 `.venv`에서 `tests/agent_team` **63 passed**, Node 브라우저 계약 **14 passed**, compileall·diff-check PASS를 확인했다.
- 전체 `tests` 수집은 기존 `yaml` 의존성 부재, 중복 `test_models` 모듈명, fixture `src` import 경로 문제로 7개 collection error가 발생했다. 이는 C-21 변경 코드 실패로 승격하지 않고 전체 suite 미검증으로 분리한다.

## 복구 및 변경 상태

- 제품 코드 변경: 0
- 운영·외부 변경: 0
- 이 보고서만 추가되었으며, Main Agent 검토 후 C-21 branch 정리 여부를 결정한다.

## 2026-09-01 C-21 재검증 (현재 세션)

### 판정

`PARTIAL / OPERATIONAL_BOUNDARY_NOT_VERIFIED`를 유지한다. 로컬 canonical worktree에서 focused 계약 검증은 재현되었지만, WSL·Docker·실제 Anvil API/DB·외부 운영망은 여전히 확인되지 않았다. 제품 코드와 운영 상태는 변경하지 않았다.

### 실행 증거

| 검증 | 명령 | 결과 |
|---|---|---|
| WSL 상태 | `wsl.exe --status`; `wsl.exe --list --verbose` | `Wsl/EnumerateDistro/Service/E_ACCESSDENIED`, 각 exit 0/출력 오류; distro shell 실행 불가 |
| Docker | `Get-Command docker,docker-compose`; `docker version`; `docker ps` | Docker CLI/compose 명령 미등록, 컨테이너 조회 불가 |
| 로컬 PostgreSQL 포트 | `Test-NetConnection 127.0.0.1 -Port 5432 -InformationLevel Detailed` | `TcpTestSucceeded=True`; 인증·DB 식별·쿼리·migration은 수행하지 않음 |
| 로컬 health | `curl.exe --max-time 5 -sS -i http://127.0.0.1:8080/health` | HTTP 200, `{"status":true}`, Uvicorn 응답. 소스의 Anvil API entrypoint는 runtime을 정의하지 않으므로 Anvil 서비스로 식별하지 않음 |
| canonical focused agent tests | `Push-Location .worktrees/ysna-internal-deploy; .venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/agent_team -q` | `63 passed`, exit 0 |
| canonical focused API/persistence tests | `.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/api/test_runtime_app.py tests/api/test_telegram_webhook.py tests/persistence/test_telegram_webhook_state.py -q` | `14 passed`, exit 0 |
| browser 계약 | `node --test apps/web/tests/*.mjs` | `14 passed`, exit 0 |
| 정적 검사 | `.venv\Scripts\python.exe -m compileall -q packages apps/api`; `git diff --check` | 각 exit 0 |
| 운영 SSH | `ssh -o BatchMode=yes -o ConnectTimeout=5 ysna-server true` | hostname 해석 실패, exit 255 |
| 공개 HTTPS | `curl.exe --max-time 8 -sS -I https://anvil.sinsan.kr` | 연결 실패, exit 7; DNS A `161.33.20.13`은 확인 |
| Telegram API reachability | `curl.exe --max-time 8 -sS https://api.telegram.org/` | 연결 실패, exit 7; token 미사용 |
| Provider endpoint DNS | `Resolve-DnsName` for configured provider hosts | DNS A 레코드 확인만 수행; key·TLS authenticated request·billing probe 미실행 |

### 경계 및 해석

- 사용자가 WSL이 Running이라고 보고했지만, 이 검증 세션의 `wsl.exe` 호출은 재현 가능하게 `E_ACCESSDENIED`를 반환했다. WSL service 접근권한 복구나 재시작은 수행하지 않는다.
- `127.0.0.1:5432`는 TCP listener 존재만 증명한다. PostgreSQL server identity, `shared-db`, schema head, persistence transaction, replay/audit는 미검증이다.
- `127.0.0.1:8080/health`는 응답하지만 현재 저장소의 `apps/api/anvil_api/main.py`가 예약 entrypoint이며 compose가 `services: {}`이므로 Anvil 운영 health로 간주하지 않는다.
- 외부 SSH/HTTPS/Telegram은 네트워크 경계에서 실패했다. credential 값 출력, webhook 변경, Provider 호출, 배포, DB 변경은 모두 하지 않았다.
- focused 로컬 테스트는 PASS이나 실제 운영·브라우저 Network·SSE reconnect/Last-Event-ID·Provider capability/drift·Telegram allowlist/secret/replay/audit를 대체하지 않는다.

### 다음 조치

검증 가능한 호스트에서 WSL service 접근과 Docker/Anvil runtime을 복구한 뒤, 동일한 read-only 명령으로 PostgreSQL identity/migration 및 실제 API/SSE를 먼저 재검증한다. 이후 승인된 non-billing Provider/Telegram probe만 별도 실행한다.

### Main 권한 승격 재확인

- Main 세션에서 read-only `wsl.exe -l -v`는 `Ubuntu Running (WSL2)`, `wsl.exe -e sh -lc "uname -a"`는 Linux kernel 정보를 반환했다.
- 따라서 WSL 자체는 권한 승격 경로에서 접근 가능하지만, subagent 기본 세션의 `E_ACCESSDENIED`와 실행 권한 차이가 존재한다. Docker CLI/Anvil runtime과 DB identity는 여전히 미검증이다.

### WSL/Docker read-only 재검증

- 권한 승격 WSL에서 Docker Server `29.1.3`와 실행 컨테이너 목록을 확인했다.
- `local-postgres` 및 기타 PostgreSQL 컨테이너는 실행 중이나 Anvil 전용 `shared-db` 컨테이너는 존재하지 않았다.
- `local-postgres`의 database 목록에는 `eoul_gateway` 등 기존 DB가 있으나 `anvil` 데이터베이스는 확인되지 않았다. 따라서 Anvil schema/migration/replay/audit PASS로 승격하지 않는다.
- WSL 프로젝트 `/home/daon/deploy/eoul-gateway`는 `?? .env` dirty 상태이므로 변경하지 않고 보존했다.

### HTTPS 운영망 재확인

- 권한 승격 `curl`에서 `https://anvil.sinsan.kr`가 HTTPS 응답을 반환했다. `/health/live`, `/health/ready`, `/api/health`는 모두 `404 EMPTY`로 응답해 기대 health 계약은 확인되지 않았다.
- `/integrations/telegram/webhook`는 `405 Method Not Allowed`와 `Allow: POST`를 반환해 same-origin webhook 경로가 존재함을 확인했다. 실제 POST·secret 검증·Telegram API 호출은 수행하지 않았다.
- 응답의 CSP, HSTS, X-Content-Type-Options, X-Frame-Options, `Cache-Control: no-store` 헤더를 확인했다.
- `ysna-server` SSH alias는 계속 해석되지 않으며, Docker 목록에는 Anvil `shared-db`/운영 API 컨테이너가 없다.
