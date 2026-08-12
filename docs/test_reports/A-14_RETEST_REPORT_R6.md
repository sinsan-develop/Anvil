# A-14 Independent Retest Report R6

- package / revision: `A-14 / R6`
- tester role: independent read-only Tester
- tested HEAD / branch: `2293b03b40319f39e4a4cd531a50617e978089af / main`
- remote baseline: `origin/main = 2293b03b40319f39e4a4cd531a50617e978089af`
- progress: sequence `174`, `TEST_REVIEW`, independent Tester `R6_PENDING`, worker/write lease `null`
- environments: current Windows checkout with Git EOL conversion / disposable `core.autocrlf=false` LF clean clone / fixture HTTP runtime
- assigned verification: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- verdict: `READY_FOR_MAIN_ACCEPTANCE`
- blocking findings: `0`

## 판정 -> 판단 이유 -> 조치

### 판정

R5의 두 CRITICAL finding은 닫혔다. 현재 clean checkout과 별도 LF clean clone에서 targeted A-13+A-14는 각각 `29/29`, full tooling은 각각 `271/271` PASS했다. 두 환경 모두 A-11, A-13, A-14, project progress, G-07, Phase G standalone checker가 PASS했다. `GIT_EOL_PORTABILITY_R1`과 A-11/A-13/A-14 successor sidecar 변조는 모두 fail-closed였다.

R6 중 Codex in-app browser backend가 연결 목록에서 사라져 fresh IAB tab 검증은 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`다. 이를 PASS로 표기하지 않는다. 다만 R5 실제 IAB report SHA-256 `3E0C98FDB01772F8446FAE7763C6D4EC786655AA32DD22BF73A37F338743667B` 이후 `apps/web`, `tests/browser/a14`, `tests/fixtures/a14`의 변경 경로가 0건임을 commit diff로 확인했다. 동일 바이트에 대해 R6 Node UI/runtime `8/8`, valid scan HTTP `200`, hostile HTTP 9건과 same-origin source guard를 fresh 재현했다. 따라서 R5 실제 화면 증거는 변경되지 않은 UI target에 유효하고 R6 portability 변경에 의한 회귀는 없다.

### 판단 이유

1. current checkout은 `main = origin/main = 2293b03b...`, Git clean, seq 174, lease null이었다. targeted `29/29`, full tooling `271/271`, standalone 6종이 모두 PASS했다.
2. disposable LF clone은 `core.autocrlf=false`, HEAD와 origin/main이 모두 `2293b03b...`, Git clean이었다. `apps/web/server.mjs`, `tests/browser/a14/workbench-runtime.test.mjs`, `docs/progress/BUILD_HANDOFF.md`가 모두 `i/lf w/lf`였고 targeted `29/29`, full tooling `271/271`, standalone 6종이 모두 PASS했다.
3. `GIT_EOL_PORTABILITY_R1`의 `self_reference=false`를 true로 변조하면 A-11, A-13, A-14 checker가 모두 nonzero로 거부했다. A-11 sidecar raw hash 변조 공식 hostile test는 PASS했고, A-13/A-14 successor sidecar live SHA를 0으로 변조하면 각 checker가 raw/content/checksum mismatch로 nonzero 종료했다.
4. R5 이후 UI·browser test·A-14 fixture 변경은 0건이다. R6 Node tests는 state reset, unsafe provider uncheck, `EMPTY/QUOTA/CANCEL/RECONNECT`, relative same-origin client, BFF origin/CSRF/role/allowlist, masked error를 `8/8` PASS했다. module-type warning 1건은 기존 경고이며 테스트 실패가 아니다.
5. R6 raw HTTP는 valid clean scan `200`; missing CSRF, evil origin/host, wrong project/role, XSS project, script fixture, traversal, secret-shaped 8건은 `403`; malformed JSON은 `400`이었다. 입력, secret-shaped 값, stack, repository/server path, internal endpoint leakage는 0건이었다. browser source에서 API 절대주소, localhost, `127.0.0.1`, `NEXT_PUBLIC_*` 호출은 0건이다.
6. R5의 실제 IAB 증거는 1920x1080/DPR1/body12px/h1 16px, fixture change reset, unsafe Provider 9개 unchecked, `BLOCKED/ERROR/PERMISSION_DENIED`, 실제 버튼 `EMPTY/QUOTA/CANCEL/RECONNECT`, same-origin assets 6건, console warning/error 0건이었다. R6에서는 backend 부재 때문에 이 클릭을 새로 실행하지 않았으며, 변경되지 않은 target 및 fresh runtime/HTTP 재현 범위로만 승계한다.

### 조치

1. Main Agent는 이 R6 report와 byte-stable R5 IAB evidence를 검토해 A-14 acceptance를 판정한다.
2. 실제 Provider/Secret/Egress, production API/DB/SSE, user repository, WSL/ysna, deployment는 계속 `NOT_EXECUTED`이며 A-14 fixture PASS로 승격하지 않는다.
3. A-15 시작은 Main acceptance projection 전까지 계속 차단한다.

## 기준선 hash

| 대상 | SHA-256 |
|---|---|
| `AGENTS.md` | `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246` |
| 설계서 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| 작업계획서 | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` |
| 통합검증매트릭스 | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` |
| 테스트계획서 | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` |
| 운영규칙 | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| progress / HANDOFF | `35A0F4ED46C7019A418DE038391D016BA399A9ECA663C692E1843003D9E4C9DF` / `701F037632BE006461C9842EEB725840FFE12E9901BDBF7A64B91C291D880AF5` |
| R5 report | `3E0C98FDB01772F8446FAE7763C6D4EC786655AA32DD22BF73A37F338743667B` |
| `GIT_EOL_PORTABILITY_R1` | `7DEC88AF047A14F3C7D11E12F4D247556075675A8E71C36143F698214184E3BE` |
| A-11 / A-13 / A-14 successor sidecar | `F55C0472156989BC9203EB89DC7C054C265EB21BC8B80170A62CB68C00EB830A` / `D81BA87F8D78DC4FC061F1A2D2CA08E3A72DE7AB58C87FB2F093996743219A92` / `44ECD1D3A22ACD6E189CE4046E2F6023E7D864E9782279C4A3ADB263F128D20F` |
| portability completion | `44319E47F4F9F63582930DEC62A2DBB759AFCD9AD829730C3711E4CF8BDBDCED` |

## fresh 검증 결과

| 환경 | 명령 / 범위 | 결과 |
|---|---|---|
| current | `python -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` | `29/29 PASS`, 107.957s |
| current | `python -m unittest discover -s tests/tooling -p 'test_*.py' -v` | `271/271 PASS`, 185.210s |
| current | A-11/A-13/A-14/project/G-07/Phase G standalone | 모두 exit 0 PASS |
| current | `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` | `8/8 PASS`, fail/skip 0 |
| LF clone | targeted A-13+A-14 | `29/29 PASS`, 101.982s |
| LF clone | full tooling | `271/271 PASS`, 167.198s |
| LF clone | A-11/A-13/A-14/project/G-07/Phase G standalone | 모두 exit 0 PASS |
| tamper | portability registry self-reference | A-11/A-13/A-14 모두 exit 1 fail-closed |
| tamper | A-11 successor sidecar hostile test | exit 0, tamper rejection PASS |
| tamper | A-13/A-14 successor sidecar SHA | 각 checker exit 1 fail-closed |
| HTTP | valid + hostile 9건 | valid `200`; hostile `8x403 + 1x400`; leakage 0 |

## no-write·미실행·종료 경계

- current와 LF clone에서 테스트 전후 Git은 clean이었다. products/fixtures의 worktree diff와 cached diff는 0건이다.
- Tester write는 이 R6 report 한 파일뿐이다. 제품, fixture, 권위, progress/HANDOFF, events, ledger, manifests, Git refs/index를 수정하지 않았고 commit/push/deploy를 수행하지 않았다.
- tamper는 disposable LF clone에서만 수행했고 각 파일을 HEAD로 복구한 뒤 clean을 확인했다. clone은 검증 후 제거했다.
- fixture server PID `26684`는 종료했고 최종 `127.0.0.1:4173` listener는 `0 / PORT FREE`다.
- fresh R6 in-app browser click은 backend unavailable로 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`; Chrome으로 대체하지 않았다. R5 이후 UI target byte 불변과 R6 Node/HTTP 재현을 근거로 R5 actual IAB evidence만 승계했다.
- production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna, deployment, DIR은 `NOT_EXECUTED`다.
- rollback: 이 Tester report만 제거하면 된다.
