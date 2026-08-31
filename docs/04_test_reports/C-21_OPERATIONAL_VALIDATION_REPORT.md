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

## 복구 및 변경 상태

- 제품 코드 변경: 0
- 운영·외부 변경: 0
- 이 보고서만 추가되었으며, Main Agent 검토 후 C-21 branch 정리 여부를 결정한다.
