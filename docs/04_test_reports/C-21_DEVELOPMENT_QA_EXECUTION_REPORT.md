# C-21 Development QA 실행 보고서

## 판정

- WorkInstruction: `WI-C-21-DEVELOPMENT-QA-RESUME-20260905-001`
- 담당: `developer-primary`
- 상태: `COMPLETED_FOR_INDEPENDENT_REVIEW`
- 검증한 범위: Provider recorded fixture/test-double, Telegram outbound-free webhook와 PostgreSQL 감사, Chromium `page.evaluate/fetch` Network, WSL PG15/PG18RC migration/API/SSE/backup/restore, exact resource cleanup.
- 전체 C-21 acceptance, C-01 시작, DIR-2 판정은 수행하지 않았다.

## 실행 신원과 격리 범위

- 시작 branch/HEAD: `codex/c21-operational-execution` / `580ed9d7b202383a107b5e0bda0f53b2066cddc5` / clean.
- candidate: `a342d62391a44b349733d1468ac3b180761155ab`; private ref `candidates/c21-wsl-exact56`.
- control: `772afbd5eb55791ca7b5002d58378437ea496750`; private ref `codex/c21-operational-execution`.
- 실행 자원: `anvil-wsl-pg15`, `anvil-wsl-pg18rc`; 각 `anvil-db`, `anvil-web`, `anvil-ingress`; exact DB volume `anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data`.
- ysna, `anvil.sinsan.kr`, main, 운영 Secret, 실제 Provider 호출, Telegram outbound/setWebhook/real chat는 건드리지 않았다.

## TDD RED → GREEN

1. 신규 exact7 자산이 없던 상태에서 다음 명령은 의도대로 실패했다.
   - `python -m pytest tests/agent_team/test_c21_provider_nonbilling_qa.py ...` → exit 4, file not found.
   - `python -m pytest tests/api/test_c21_telegram_outbound_free_qa.py ...` → exit 4, file not found.
   - `node tests/browser/c21-network-probe.mjs --self-test` → exit 1, module not found.
   - `bash deploy/wsl/verify-c21-development-boundaries.sh --contract` → exit 127, file not found.
2. 구현 후 focused GREEN:
   - 신규 Provider QA `3 passed`.
   - 신규 Telegram QA `7 passed`.
   - boundary contract exit 0.
   - Chromium self-test에서 auth 201, initial SSE 200, Last-Event-ID resume 200/body 0, 4개 요청 same-origin.
3. focused regression:
   - Provider/MoA/runtime-config/Telegram adapter·webhook·persistence 포함 `45 passed in 1.06s`, exit 0.
   - `bash -n deploy/wsl/verify-c21-development-boundaries.sh` exit 0.
   - `git diff --check` exit 0.
4. broader fresh regression:
   - `python -m pytest tests/agent_team tests/api tests/persistence -q -p no:cacheprovider` → `188 passed, 20 skipped in 6.40s`, exit 0. SKIP은 기존 격리 PostgreSQL 선택 조건이며 이번 WSL 실검증으로 임의 PASS 처리하지 않는다.

Revision 2 fresh local 최종 검증은 repository `.venv`로 수행했다.

- focused 9-file suite: `46 passed in 1.33s`, exit 0.
- broader `tests/agent_team tests/api tests/persistence tests/llm_gateway`: `195 passed, 20 skipped in 5.80s`, exit 0.
- bundled Chromium `--self-test`, `--self-test-cross-origin-rejection`: 각각 exit 0.
- `bash -n` 및 `--contract`: exit 0.
- manifest canonical receipt 5개와 QA artifact 4개 bytes/SHA-256 독립 재계산: 전부 일치, exit 0.

## Provider 비과금 QA

- canonical provider 9개는 `CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA`로 확인했다.
- credential config는 환경변수 이름과 configured boolean만 반환하며 sentinel 값은 반환 객체 표현에 나타나지 않았다.
- 기록 model fixture 9개로 coding/writing/design CapabilityRouter를 수행했고 UPSTAGE 선택, catalog snapshot 결박, 9개 considered route를 확인했다. 테스트 중 provider network 연결은 강제 거부했다.
- `/api/providers`는 인증·권한을 통과한 실제 FastAPI boundary에서 HTTP 501 `CAPABILITY_NOT_AVAILABLE`다. 판정은 `NOT_IMPLEMENTED_RUNTIME_PROVIDER_STATUS_PORT`이며 fixture PASS로 닫지 않는다.
- 실제 credential 유효성, provider health/capability probe, 모델 목록 동기화, 비용 발생 호출은 `NOT_EXECUTED`다.

## Telegram outbound-free QA

- local 실제 adapter/webhook boundary에서 allowlist ACCEPTED, 동일 update REPLAYED, 비허용 identity UNAUTHORIZED를 확인했다.
- high-risk 명령 `merge, deploy, delete, change-permissions, change-provider-credentials`는 모두 `accepted=false / APPROVAL_REQUIRED`였다.
- webhook/signing sentinel은 HTTP 응답, audit 객체, state-store 표현에 노출되지 않았다. 테스트는 socket outbound를 fail-closed 했다.
- WSL 두 PostgreSQL target에서 native Telegram-shaped POST를 same-origin ingress에 실행했다. 각 target에 ACCEPTED/REPLAYED/APPROVAL_REQUIRED 감사행 3개가 추가됐고 server log에서 webhook secret 노출 0을 확인했다.
- 실제 Telegram API, BotFather, setWebhook, 실제 chat 전송은 `NOT_EXECUTED`다.

## WSL 및 실제 Chromium Network

- 기존 Git-only control로 candidate를 PG15/PG18RC에 배포했다.
- 기존 `verify.sh`에서 migration `0013_task_bootstrap_authority`, health/OpenAPI, session, authenticated SSE, strict Last-Event-ID, backup/restore가 두 target 모두 exit 0이었다.
- Chromium은 `127.0.0.1:4770`과 `127.0.0.1:4870`에 실제 접속했다. 각 target에서 `/auth/session` 201, initial SSE 200/event `c21-wsl-event`, resume 200/body 0 byte였고 기록한 모든 URL은 해당 ingress와 same-origin이었다.
- 증거 tier는 `PAGE_EVALUATE_FETCH_SCOPE_ONLY`다. 제품 UI click 또는 운영 internal-address-zero 증거로 승격하지 않는다.
- 브라우저가 페이지 로드 중 자동 요청한 `/api/workbench/config`는 두 target 모두 404였다. C-21 auth/SSE boundary 결과와 분리한 제품 UI finding이며 이 exact7 lease에서 제품 코드를 수정하지 않았다.
- server log 집계: 각 target auth 2, SSE 4, Telegram 3, error/exception/traceback 0.

## 정리와 rollback

- 승인 control cleanup 후 exact project label container 0, network 0, 두 exact volume 0을 독립 verifier로 재확인했다.
- restore scratch DB와 테스트 session 파일은 기존 verify trap/drop 절차로 제거됐다.
- application repository는 candidate clean checkout을 보존했다. 이번 실행은 disposable resource를 전부 정리했으므로 별도 application rollback을 수행하지 않았다.
- Git-only control runtime은 검증된 active stage 1개(`772afbd...`)를 설계대로 보존했고 non-active stage는 0이다. 이는 Compose QA 임시자원이나 잔류 source patch가 아니다.

## 오류 ledger

| fingerprint | 횟수 | 분류 | 원인과 조치 |
|---|---:|---|---|
| `WINDOWS_POWERSHELL_REMOTE_SUBEXPRESSION_EXPANSION_R1` | 1 | 도구/quoting | 원격 `$(...)`가 로컬 PowerShell에서 해석됨. single-quoted remote script로 재실행. |
| `WSL_REPO_DUBIOUS_OWNERSHIP_READONLY_R1` | 1 | 환경 | root 소유 checkout의 read-only Git 확인. `git -c safe.directory=<exact repo>`로 global 설정 변경 없이 확인. |
| `PLAYWRIGHT_BROWSER_REVISION_MISMATCH_R1` | 1 | 환경 | bundled Playwright가 revision 1200을 기대하나 설치된 승인 Chromium은 1234. 설치된 executable을 명시적으로 탐색해 재검증. |
| `WSL_CONTROL_ROOT_OWNERSHIP_EXECUTION_CONTEXT_R1` | 1 | 환경 | daon이 root:700 control에 접근 불가. 권한 변경 없이 passwordless sudo로 실행. |
| `WSL_ROOT_SSH_HOME_ALIAS_RESOLUTION_R1` | 1 | 환경 | sudo root가 alias의 `~/.ssh`를 `/root`로 해석해 host-key 실패. 기존 `/home/daon/.ssh/sinsan-develop`과 known_hosts를 명시. |
| `LOCAL_PYTHON_COMMAND_NOT_REGISTERED_R2` | 1 | 환경 | 현재 PowerShell에 `python` 명령이 없어 실행 불가. repository `.venv\\Scripts\\python.exe`를 확인해 재실행. |
| `BUNDLED_PYTHON_MISSING_PROJECT_DEPENDENCY_R2` | 1 | 환경 | 일반 bundled Python에는 SQLAlchemy가 없어 collection 실패. 설치·환경 변경 없이 repository `.venv`로 재실행해 focused/broader PASS. |
| `WSL_CONTROL_BINDING_LOCAL_DECLARATION_ORDER_R2` | 1 | 구현 | `set -u`에서 같은 `local` 선언문의 `root`를 조기 확장. 선언 순서를 분리한 뒤 positive/negative control 검증 PASS. |

동일 fingerprint 반복은 0이며 제품 valid failure로 계상하지 않는다.

## Revision 2 독립 검토 재작업

독립 판정 `SPEC FAIL / REWORK_REQUIRED / C0 I4`를 수락하고 기존 exact7 lease 안에서 재작업했다.

- I1: WSL PG15/PG18RC를 다시 배포·검증하고 Telegram DB 감사행, server log 집계, Chromium request/response/requestfailed ledger, cleanup receipt를 manifest에 원문 credential/header/body 없이 내장했다.
- I2: Chromium probe는 `request`, `response`, `requestfailed`를 모두 정규화해 수집하며, 성공·실패 여부와 무관하게 attempted URL 하나라도 base origin과 다르면 실패한다.
- I3: boundary verifier는 active control pointer가 가리키는 checkout의 실제 HEAD `772afbd5eb55791ca7b5002d58378437ea496750`, candidate ancestor 관계, control manifest/deploy/verify/cleanup raw SHA-256을 fail-closed로 검증한다. 잘못된 root negative test는 exit 9였다.
- I4: 실제 `ProviderAdapter` protocol, `DeterministicFakeAdapter`, `NativeAgentAdapter`의 `probe/generate` 경계를 호출했다. socket 및 `socket.create_connection`을 거부한 상태에서 registry/config/MoA와 함께 수행했고 외부 Provider 호출은 없었다.

Revision 2 RED는 (a) 기존 Chromium self-test에 3단계 ledger가 없어 검증 assertion exit 1, (b) 기존 boundary script에 `--verify-control`이 없어 exit 2였다. GREEN에서는 Provider 신규 4 PASS, Telegram 신규 7 PASS, Chromium self-test와 failed cross-origin rejection PASS, control binding PASS가 됐다.

## Revision 2 실행 명령과 종료 코드

Secret 값은 명령 또는 receipt에 기록하지 않았다. 실제 실행은 아래 literal command shape를 사용했고 `GIT_SSH_COMMAND`에는 기존 `/home/daon/.ssh/sinsan-develop`과 `/home/daon/.ssh/known_hosts`만 지정했다.

```text
ssh WSL-server 'sudo -n env GIT_SSH_COMMAND="ssh -F /dev/null -o HostName=github.com -o User=git -i /home/daon/.ssh/sinsan-develop -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/daon/.ssh/known_hosts" ANVIL_GIT_REMOTE_URL="git@github-sinsan-develop:sinsan-develop/Anvil.git" ANVIL_CANDIDATE_MANIFEST_REF="refs/remotes/origin/codex/c21-operational-execution" ANVIL_WSL_CONTROL_COMMIT="772afbd5eb55791ca7b5002d58378437ea496750" ANVIL_CANDIDATE_MANIFEST_SHA256="456a5240cd8be8a7739e9ac898b478ade5b8a2d68a67ced21b0fa023a30b120b" ANVIL_WSL_CONTROL_DEPLOY_SHA256="7b6ee6a02bed857299423f78c73d746b6f8ac8c0cc40e3a611ece06e43e1c1c0" bash /srv/anvil-wsl/repo/deploy/wsl/bootstrap-c21-git-only-staging.sh a342d62391a44b349733d1468ac3b180761155ab' -> exit 0
ssh WSL-server 'sudo -n env GIT_SSH_COMMAND="...existing approved key and known_hosts..." ANVIL_GIT_REMOTE_URL="git@github-sinsan-develop:sinsan-develop/Anvil.git" ANVIL_CANDIDATE_MANIFEST_REF="refs/remotes/origin/codex/c21-operational-execution" ANVIL_WSL_CONTROL_COMMIT="772afbd5eb55791ca7b5002d58378437ea496750" ANVIL_CANDIDATE_MANIFEST_SHA256="456a5240cd8be8a7739e9ac898b478ade5b8a2d68a67ced21b0fa023a30b120b" ANVIL_WSL_CONTROL_VERIFY_SHA256="93e882d35c055535a7d989962fe0ee0ec49b91542eb462b655f1477dd2562a36" bash /srv/anvil-wsl/repo/deploy/wsl/control-c21-git-only-staging.sh verify a342d62391a44b349733d1468ac3b180761155ab' -> exit 0
cmd /d /c "ssh WSL-server sudo -n bash -s -- --verify-control < deploy\wsl\verify-c21-development-boundaries.sh" -> exit 0
cmd /d /c "ssh WSL-server sudo -n env ANVIL_WSL_DEPLOY_ROOT=/srv/anvil-wsl/repo bash -s -- --verify-control < deploy\wsl\verify-c21-development-boundaries.sh" -> exit 9 (negative PASS)
cmd /d /c "ssh WSL-server sudo -n bash -s -- --verify-running < deploy\wsl\verify-c21-development-boundaries.sh" -> exit 0
ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=<process-only value>; ANVIL_TEST_SESSION_RUN_ID=c21-wsl-run; ANVIL_CHROMIUM_EXECUTABLE=C:\Users\cyhuh\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe; & $env:CODEX_MCP_NODE_PATH tests/browser/c21-network-probe.mjs --base-url http://127.0.0.1:4770 --expected-event-id c21-wsl-event --project anvil-wsl-pg15 -> exit 0
ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=<process-only value>; ANVIL_TEST_SESSION_RUN_ID=c21-wsl-run; ANVIL_CHROMIUM_EXECUTABLE=C:\Users\cyhuh\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe; & $env:CODEX_MCP_NODE_PATH tests/browser/c21-network-probe.mjs --base-url http://127.0.0.1:4870 --expected-event-id c21-wsl-event --project anvil-wsl-pg18rc -> exit 0
ssh WSL-server 'sudo -n env ... ANVIL_WSL_CONTROL_CLEANUP_SHA256="65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d" bash /srv/anvil-wsl/repo/deploy/wsl/control-c21-git-only-staging.sh cleanup a342d62391a44b349733d1468ac3b180761155ab' -> exit 0
cmd /d /c "ssh WSL-server sudo -n bash -s -- --residue-zero < deploy\wsl\verify-c21-development-boundaries.sh" -> exit 0
```

Chromium 명령은 bundled workspace Node/Playwright를 사용했다. 정확한 Node는 `$env:CODEX_MCP_NODE_PATH` = `C:\Users\cyhuh\AppData\Local\OpenAI\Codex\runtimes\cua_node\440c4f095d41ea30\bin\node.exe`, Playwright는 그 실행 파일 옆 `node_modules/playwright`였다. 값 비노출을 위해 WSL `.env`에서 읽은 테스트 session 값을 현재 PowerShell process의 `ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN`, `ANVIL_TEST_SESSION_RUN_ID`에만 설정하고 명령 직후 제거했다. `ANVIL_CHROMIUM_EXECUTABLE`은 `C:\Users\cyhuh\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe`였다.

## Revision 2 durable receipts

정규화 알고리즘은 receipt object를 parse한 뒤 Python `json.dumps(ensure_ascii=True, sort_keys=True, separators=(',', ':'))`, trailing newline 없는 UTF-8, SHA-256, uppercase hex 순서다. wrapper의 `canonical_sha256`과 `capture_note`는 입력에서 제외한다.

- PG15 Telegram/server: 감사 3행 `ACCEPTED/REPLAYED/APPROVAL_REQUIRED`, audit id와 command id 포함, auth 3/SSE 6/Telegram 9/error 0/secret exposure 0, hash `8ACD5BA7FBE1ACBF0624759ECD604A321B91465AB6BB65E14E9267F0C4FD76AF`.
- PG18RC Telegram/server: 동일 outcome 3행과 고유 audit id 포함, auth 3/SSE 6/Telegram 9/error 0/secret exposure 0, hash `A8781951B9DAF9FCA997ACFBB1AE99506CCFABC43BCF4908B524180D168C3589`.
- PG15 Chromium: auth 201, SSE 200, resume 200/body 0, request/response/requestfailed ledger, all attempted same-origin, hash `7C0289FC0358C1A2D7A20DAAB1A1E79DC40D0C9CCF4DBF78F0091E6F780F0777`.
- PG18RC Chromium: 같은 경계 PASS, hash `F62E2F6BCFCE8378F209B82667F7C9D2653F53D0EB8965F4B4F2E395ABFCB09D`.
- cleanup: `containers=0, networks=0, volumes=0`, hash `0BDCCA4F5F16195072B6300B20FFC2CFA0814E1076996AC3F30C10BE6FAC811F`.

원격 종료 후 read-only 재확인도 `CONTAINERS=0`, `NETWORKS=0`, `VOLUMES=0`, exit 0이었다. 세부 canonical JSON은 manifest `receipts`가 권위다. `/api/workbench/config` 404는 계속 별도 finding이다.

Revision 2 오류 ledger에 `WSL_CONTROL_BINDING_LOCAL_DECLARATION_ORDER_R2` 1회를 추가한다. Bash `local root=... base="$root/control"`에서 `set -u`가 같은 선언문의 아직 설정되지 않은 `root`를 확장해 실패했고, 선언을 두 줄로 분리한 뒤 control positive/negative 검증이 통과했다. 제품 valid failure가 아니다.

## Revision 3 browser project raw binding

Reviewer finding `C0/I1`을 수락했다. Revision 2 browser manifest에는 `project`가 있었지만 당시 probe의 raw stdout에는 그 field가 없어, 사후 주입 가능성을 배제하지 못했다.

- RED: `--self-test --project self-test-pg` stdout을 parse해 `project == self-test-pg`를 요구한 assertion이 exit 1(`project missing from raw probe stdout`)이었다.
- GREEN: `runProbe`가 `project`를 required input으로 받고 sanitized return object에 직접 포함한다. self-test는 explicit `--project`를 그대로 사용하거나 fixture project `self-test-fixture`를 설정한다.
- local self-test raw stdout에 `"project":"self-test-pg"`가 포함됐고 cross-origin rejection도 exit 0이었다.
- exact WSL resources를 승인된 Git-only control로 재생성했다. deploy exit 0, verify exit 0 뒤 PG15와 PG18RC probe를 `--project anvil-wsl-pg15`, `--project anvil-wsl-pg18rc`로 실행했고 각각 exit 0이었다.
- 두 raw stdout JSON은 project, auth 201, SSE 200, resume 200/body 0, same-origin ledger를 자체 포함한다. 별도 field 주입 없이 stdout parse object를 canonicalization하면 manifest browser receipt와 동일하고 hash도 각각 `7C0289FC0358C1A2D7A20DAAB1A1E79DC40D0C9CCF4DBF78F0091E6F780F0777`, `F62E2F6BCFCE8378F209B82667F7C9D2653F53D0EB8965F4B4F2E395ABFCB09D`다.
- browser 재검증 직후 control cleanup exit 0. read-only residue 재확인은 containers/networks/volumes `0/0/0`, exit 0이었다. Telegram/Provider는 재실행하지 않았다.
- revision 3 fresh broader suite는 `195 passed, 20 skipped in 5.35s`, exit 0. bundled Chromium self/cross-origin 및 Bash syntax/contract도 exit 0이었다.
- 새 도구 오류 `WSL_REMOTE_ENV_ASSIGNMENT_QUOTING_R3` 1회: 첫 deploy 호출에서 원격 `GIT_SSH_COMMAND` 공백이 인수로 분리되어 `env: -F` exit 1. 원격 command 전체를 하나의 quoting boundary로 전달해 같은 승인 스크립트를 재실행했고 PASS했다. 제품 failure가 아니다.

Commit 전 diff-check에서 발견된 Telegram QA EOF 빈 줄 1개를 비의미 변경으로 제거했다. 최종 artifact는 3,596 bytes, SHA-256 `592018D4B61AFF8E15E989820464643F48E3E975579893EB7BCEB4B4DDE49E28`이며 manifest와 재결박했다.

## 변경 파일

exact7만 변경했다. commit/push와 progress/HANDOFF 수정은 수행하지 않았다.
