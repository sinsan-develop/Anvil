# C-29 완료보고

## 판정

COMPLETED — exact8 구현 및 focused/웹 전체/owner 전체 회귀 완료. Developer evidence이며 Main acceptance가 아니다. formal FAILURE_REPORT 0. canonical checker는 기존 SyntaxError 때문에 NOT_VERIFIED/NOT_PASS이며 제품 테스트 PASS로 이를 대체하지 않는다.

## 판단 이유와 권위

- canonical checkout: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`; 시작/검증 HEAD: `98e218264bf54db04a1bd35a67273b713805a649`.
- 기존 대규모 dirty/untracked를 보존했다. stage/commit/push, control/progress/HANDOFF/checker 수정 없음. 제품 exact8만 수정했다.
- WI SHA256: `6CE07B900E8647997E955CEA85FEB8482E07B908A2EBCEEC010C5E2BF0E8D16A`.
- invocation SHA256: `69B5C7D84EEDBF3AE0697F6EB7C9B4B07E290945886F9888086CF8BAB6A53824`.
- design baseline: `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; progress seq1255.
- worker `worker-lease-c29-r1-20260919-001`, execution fence `c29-r1-execution-fence-epoch-1-98e218264bf54db0`.
- write `write-lease-c29-r1-20260919-001`, write fence `c29-r1-write-fence-epoch-1-98e218264bf54db0`; ACTIVE 2026-09-19 15:00:01~2026-09-20 03:00:01 KST. 발효 전 read-only 유지, 15:00:12 host 시각과 exact8 projection 재검증 후 mutation 시작.
- 사용자 확인은 event1252 `USER_CONFIRMATION_RECORDED`, `chat:user-message:계속해`, C28 HTML hash `12118D77CC0C66E22D15D90B5670CAFD5DA3A990A6DE7A6579E3FEAE81850706`에 결박한다. 역사 C28 interaction JSON은 PENDING/BLOCKED 그대로이며 SHA `2A1E5473B85B0D2AC4826B37C1CCF3B35082E56DF3F8C02C70950572E50FE9E8` 보존. C29는 별도 확인 event를 선행 권위로 소비했다.

## 조치와 구현 경계

- `agent_console.py`: C22 current assignment/actor/context/session/target/fence 및 C23 public mailbox/project를 통한 read-only host projection. C24 MoA 제안/반론은 실제 task/assignment/result/binding hash와 결박한다. C25 SNS는 host가 등록한 정확한 identity/receipt만 public receipt API로 재검증한다. 원문 대화/secret/auth hash는 반환하지 않는다.
- Team parent/child·role·status·result hash, MoA evidence refs, SNS/Daon receipt·privacy, adapter의 Telegram NOT_INTEGRATED/Kakao OPEN_DECISION을 표시한다. owner가 공개하지 않은 provider/model/artifact/synthesis는 NOT_EXPOSED/NOT_OBSERVED로 표시하며 값을 발명하지 않는다.
- projection checksum은 menu/trace/data 전체 canonical JSON에 결박. 반환은 detached value이며 authority/fence를 끝에서 재검증한다.
- `server.mjs`: 기존 route 유지, `/agent-console` 및 전용 `/api/agent-console/*` BFF 추가. browser는 상대 경로만 사용한다. 서버 전용 upstream은 명시적 loopback HTTP URL만 허용하며 외부 URL/user-info/redirect/query/traversal을 거부한다. 제한 응답 크기 256 KiB, timeout 3초, JSON shape 검증, 안전한 오류, Host/Origin/CSRF를 적용한다. 미설정은 OFFLINE 503이며 generic proxy로 fallback하지 않는다.
- client/runtime: 4개 메뉴, C28 CSS의 sidebar/table/trace/card 시각 구조 재사용, actual projection만 표시. loading/permission/error/empty/offline, late response suppression, detached state, high-risk 재확인 및 취소/메뉴 변경 시 이전 modal 폐기. `pause/resume`은 REQUESTED_NOT_APPLIED, 나머지는 HUMAN_APPROVAL_REQUIRED이며 실제 상태 변화 없음.
- 독립 API factory의 기본 상태는 authority 없는 fail-closed이다. host가 owner와 인증 resolver를 주입해야 한다. 기존 DB bootstrap `asgi.py`/main router는 exact8 밖이므로 수정/실행하지 않았다. 실행 가능한 로컬 factory→uvicorn→Node BFF HTTP 연결을 테스트했으나 production 인증/DB wiring은 NOT_INTEGRATED다.

## RED → GREEN 및 실행 기록

모든 명령 cwd는 위 canonical checkout. 아래 `PY`는 정확히 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`, Node v24.18.0의 `node`이다. pytest cache/bytecode 생성을 끈다.

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `PY -B -m pytest -q -p no:cacheprovider apps/api/tests/test_agent_console_routes.py --tb=short` 최초 | 1 | module 미구현 RED 16 failed, 3.36s |
| 동일 API 첫 GREEN | 0 | 16 passed, 1.18s |
| `node --test apps/web/tests/c29-console-runtime.test.mjs` 최초 확정 RED | 1 | 6 failed, 176.752ms |
| 동일 Node 첫 GREEN | 0 | 6 passed, 169.9111ms |
| Node raw/unstructured projection 보강 RED | 1 | 7 passed/2 failed, 202.5963ms → 양쪽 validator GREEN |
| API actual MoA 보강 | 1→0 | fixture 속성명 오류 후 실제 critique의 trace 차이 KeyError를 확인; canonical task hash 결박으로 19 passed |
| C28 shell/provider/permission 보강 RED | 1 | 10 passed/3 failed, 1932.1436ms → 13 passed, 1622.1529ms |
| raw traversal RED | 1 | 1 failed, 124.9688ms → BFF normalize 전 경계 차단 |
| API 전체 projection checksum RED | 1 | 19 passed/1 failed, 1.32s → GREEN 20 passed, 1.25s |
| `PY -B -m pytest -q -p no:cacheprovider apps/api/tests/test_agent_console_routes.py tests/agent_team --ignore=tests/agent_team/test_worktree_writes_e06.py --tb=short` 최종 | 0 | 736 passed, 0 skipped, 9.99s |
| `$env:ANVIL_PYTHON='D:/tmp/anvil-main-integration/.venv/Scripts/python.exe'; node --test apps/web/tests/*.test.mjs` 최종 | 0 | 70 passed, 0 skipped, 1683.6981ms; C29 14+C28 32+기존 웹24 |
| `PY -B -c "from pathlib import Path; files=['apps/api/anvil_api/routes/agent_console.py','apps/api/tests/test_agent_console_routes.py']; [compile(Path(p).read_text(encoding='utf-8'),p,'exec') for p in files]; print('builtin compile: 2 PASS')"` | 0 | builtin compile 2 PASS, pycache write0 |
| `node --check apps/web/server.mjs` | 0 | syntax PASS |
| `node --check apps/web/src/api/c29-agent-console-client.js` | 0 | syntax PASS |
| `node --check apps/web/src/app/c29-console-runtime.js` | 0 | syntax PASS |
| `node --check apps/web/tests/c29-console-runtime.test.mjs` | 0 | syntax PASS |
| `git diff --check` | 0 | whitespace 오류 없음 |
| `PY -B scripts/check_project_progress.py` | 1 | 기존 line32957 embedded C03 문자열 SyntaxError. canonical checker NOT_VERIFIED/NOT_PASS, Main 소유 복구 대기 |

Node 최초 RED 과정의 HTTP server cleanup 누락으로 종료가 지연되어 interrupt(exit1) 후 테스트 finally를 보완하고 확정 RED를 재실행했다. apply_patch에서 동일 CSS delete/add 중복 경로를 사용한 한 번의 요청이 검증 단계에서 거부되었고 파일 변경 없이 작은 update patch로 재실행했다. 모두 도구/테스트 작성 과정이며 formal failure가 아니다.

첫 Python 관련 회귀는 `--ignore=tests/agent_team/test_worktree_write_e06.py`라는 오타 때문에 E06이 포함되고 기본 Temp 접근이 거부되어 `735 passed, 56 errors in 18.18s`, exit1이었다. 모든 error는 `tests/agent_team/test_worktree_writes_e06.py` fixture setup이며 제품 테스트 본문 실행 전 환경 경계다. 전용 basetemp 전체 재실행: `PY -B -m pytest -q -p no:cacheprovider apps/api/tests/test_agent_console_routes.py tests/agent_team --basetemp=D:/Project/Anvil/.codex-sandbox/c29-pytest-20260919-1514 --tb=short` — **exit0, 791 passed, 0 skipped, 670.44s (0:11:10)**. session32046 최종 tool chunk b78e8f에서 정상 종료를 확인했다.

이 전체 재실행은 API checksum 마지막 보강 전 19건을 수집했다. 마지막 보강 후 fresh API20 및 E06 제외 관련736/웹70을 별도 확인하며 수치를 합쳐 단일 full command 결과인 것처럼 표시하지 않는다.

Node 기존 MODULE_TYPELESS_PACKAGE_JSON warning과 Git global ignore 접근 warning은 설정 범위 밖이라 보존했다. 실제 로컬 loopback HTTP test는 synthetic host authority + real C22~C25 owner + ASGI/BFF를 사용하며 종료 finally에서 server/child를 닫는다. 실제 Provider/adapter PASS가 아니다.

전체 회귀 종료 후 테스트 전용 디렉터리 `D:\Project\Anvil\.codex-sandbox\c29-pytest-20260919-1514`의 Resolve-Path 결과가 정확히 이 경로인 것을 검사하고 `Remove-Item -LiteralPath $c29Temp -Recurse -Force`로 이번 테스트 생성물만 정리했다. exit0, 후속 `Test-Path` False(잔여0). 기존 checkout/사용자 파일은 대상에 포함하지 않았다. 테스트 생성물은 재실행으로 재생성 가능하다.

## exact8 변경 SHA256

| 경로 | SHA256 |
|---|---|
| apps/web/server.mjs | B24993EACB3DF5017FD38003C2B3563B4A7A0F9B4DE41618CBEF1559B8750021 |
| apps/web/src/api/c29-agent-console-client.js | A016E8F2B6A10D81CE56BF81220E4CB5120900A493775D2E7D099BBE08F9DEFA |
| apps/web/src/app/c29-console-runtime.js | CB7F42047CA75F74CB990D2AB1DB8FB0BD8D9C865C35CC89A0498415BEED5A01 |
| apps/web/src/styles/c29-console-runtime.css | 028EED7A3B44405EED2397B7EBF4CB13A79DBD890405D21C9684FB8E5B8BB56A |
| apps/web/tests/c29-console-runtime.test.mjs | A0E0455AEF91A9101B560AE052CDE0A102D2857ECC5ED68A321F4EF1E06BF46E |
| apps/api/anvil_api/routes/agent_console.py | 88FB2D5460ABFCAB601906C2A465BEAE6925DC127B910E548FAB3EE76718D9A0 |
| apps/api/tests/test_agent_console_routes.py | 092AC49E83A1C0168B07CE33221620BC2AB37D7EBB8CAB8FC386A79A5CB84499 |
| docs/04_test_reports/C-29_COMPLETION_REPORT.md | 자기참조 방지: 마감 후 외부 결과 계약에 보고 |

server는 기존 모든 route를 보존한 additive 변경이다. 나머지7은 C29 신규 경로이며 기존 C22~C28 파일은 수정하지 않았다.

## 미검증·C30 인계·rollback

- 실제 browser 클릭/Network/1920×1080 렌더: NOT_EXECUTED. DOM contract와 local HTTP/ASGI는 PASS이나 actual browser acceptance로 승격하지 않는다.
- DB/WSL/Provider/Telegram/Kakao/Oracle/외부 network/배포/production auth: NOT_EXECUTED. durable receipt/실제 pause/resume/Release/Apply/권한변경: NOT_INTEGRATED.
- repository 전 범위 bare pytest는 외부/DB/장시간 tooling 경계 때문에 실행하지 않았다. 위 지정 웹 및 owner 관련 suite만 증거다.
- C30: Main이 local host owner/auth resolver 및 server-only loopback `agentConsoleUpstream`을 주입한 실행 환경에서 실제 browser Network와 상태별 인수, owner가 제공하지 않는 artifact/synthesis/runtime 연결을 별도 승인 범위에서 검증한다. `startWorkbenchServer({agentConsoleUpstream: ...})`와 `create_agent_console_app(service, resolve_authority=..., clock=...)`가 명시적 연결 seam이다. mock/fake 데이터를 운영 화면에 자동 삽입하지 않는다.
- control/progress/HANDOFF는 Main 소유, Developer 갱신 없음. checker 기존 SyntaxError 및 환경 경계를 Main에게 보고했다.
- rollback: Main이 exact8 diff와 현행 hash를 보존한 뒤 C29 추가분만 역패치하고 신규7 파일만 회수한다. 기존 server 시작 SHA `DA4927259BFEE3ABDB5A74B24D4E4D189F9734077F7C9CAA0225ECA25D456EFD`에 대한 C29 delta만 제거한다. Git reset/clean/광범위 삭제 금지, 기존 dirty/untracked/C28/control 보존. 실제 DB/외부 변경이 없으므로 해당 rollback 없음.
