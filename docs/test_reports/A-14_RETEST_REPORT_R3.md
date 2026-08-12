# A-14 Independent Browser Retest Report R3

- package / revision: `A-14 / R3`
- tester role: independent read-only Tester
- tested HEAD / branch: `4d6b813af82047df40d1487ac011f6a542513713 / main`
- remote baseline: `origin/main = 4d6b813af82047df40d1487ac011f6a542513713`
- progress: sequence `161`, `TEST_REVIEW`, worker/write lease `null`
- environment: `ENV-LOCAL / Codex in-app browser / fixture browser runtime`
- browser viewport: `1920 x 1080`, device pixel ratio `1`
- assigned verification: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- verdict: `FAILURE_REPORT / REWORK_REQUIRED / NOT_READY_FOR_MAIN_ACCEPTANCE`
- blocking findings: `4` (`1 CRITICAL product regression`, `2 MAJOR browser-state gaps`, `1 ENVIRONMENT_BASELINE regression blocker`)

## 판정 -> 판단 이유 -> 조치

### 판정

`BLK-A14-001`은 `CLOSED`다. 손상된 Windows sandbox ACL state가 복구된 뒤 지정 surface인 Codex in-app browser가 실제 Workbench에 연결됐고 1920×1080 클릭·화면·resource inventory·console 증거를 수집했다.

그러나 `BLK-A14-002`가 fresh 회귀에서 재발했고, 실제 브라우저 상태 일관성과 필수 상태 도달성에도 blocking gap이 확인됐다. full tooling도 `260/268`이므로 A-14는 `NOT_READY_FOR_MAIN_ACCEPTANCE`다. A-15를 시작하면 안 된다.

### 판단 이유

1. `BLK-A14-R3-001 / CRITICAL / BLK-A14-002 REOPENED`: targeted A-13+A-14 Python은 `26 total / 23 PASS / 3 FAIL / 0 SKIP`, full tooling은 A-13 evidence 관련 3건이 다시 실패했다. 현재 `scripts/check_a13_repository_scan.py`는 `26144 bytes / 8a0a00cb...ea2d`인데 A-14 R2 successor manifest는 `25240 bytes / 1e7c890a...311f`를 결박한다. clean checkout도 `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`를 반환하며 current seq161 clean state에서 `_revision2_completion_successor`가 유효 successor를 선택하지 못한다.
2. `BLK-A14-R3-002 / MAJOR`: clean scan 및 CEREBRAS 선택 뒤 fixture를 `FIX-PY-DIRTY`로 변경해도 이전 `SCANNED_READ_ONLY`, `IDENTICAL`, `FIXTURE`, enabled Provider 9개와 `aria-checked=CEREBRAS`가 남았다. dirty scan 완료 후 `BLOCKED`, 서버 단절 `ERROR`, stale CSRF `PERMISSION_DENIED`에서도 disabled CEREBRAS가 계속 selected 상태다. 사용자가 현재 fixture와 현재 evidence/provider 결박을 화면만 보고 신뢰할 수 없어 `AV-UI-004` 인수 흐름이 미충족이다.
3. `BLK-A14-R3-003 / MAJOR`: 실제 UI에서 `LOADING`, `NORMAL`, `BLOCKED`, `ERROR`, `PERMISSION_DENIED`는 도달했지만 `QUOTA`, `CANCEL`, `RECONNECT`는 action/fixture route가 없어서 `NOT_EXECUTED`다. 초기 화면은 empty content와 `NOT EXECUTED`를 보이지만 config가 자동 선택된 뒤 state badge는 `NORMAL`이므로 계약의 실제 `EMPTY` state도 독립적으로 도달·유지되지 않는다. state vocabulary unit test PASS를 실제 화면 상태 PASS로 승격하지 않는다.
4. `BLK-A14-R3-004 / ENVIRONMENT_BASELINE`: 사용자 소유 untracked `docs/progress/WSL_ENVIRONMENT_MIGRATION_HANDOFF_2026-08-12.md`를 보존한 현재 worktree에서 project-progress 계열 5건이 `GIT_DESCENDANT_WORKTREE_DIRTY`로 실패했다. 이 파일은 수정·삭제·stage하지 않았으나 필수 full regression `268/268` 조건은 충족되지 않았다.
5. 실제 browser resource inventory의 unique URL 7건은 전부 페이지 origin `http://127.0.0.1:4173`과 같은 origin이다. API는 `/api/workbench/config`, `/api/workbench/scan` 두 경계뿐이며 브라우저 source의 fetch path도 상대 `/api/...` 두 건이다. 페이지 자체 local origin과 별도 내부 API 직접 호출을 구분했을 때 다른 host/port, container host, `NEXT_PUBLIC_*` direct call은 `0`이다. 따라서 실행된 fixture 범위의 same-origin 경계는 PASS다.
6. clean/dirty scan은 각각 `200`, stale CSRF는 `403`, 서버 단절은 HTTP response 없이 `Failed to fetch`로 `ERROR`가 됐다. missing/tampered CSRF, hostile Origin/Host, viewer role, project mismatch/XSS-shaped input, fixture path traversal, secret-shaped fixture, malformed body 9건은 모두 `POST /api/workbench/scan -> 403`과 generic `PERMISSION_DENIED`로 차단됐고 응답 leakage는 0건이다.
7. 실제 browser console은 최종 `0`건이다. DOM/source에서 inline script/style, secret, raw stack, server path, internal endpoint literal, `localStorage`, `sessionStorage`, cookie access가 0건이었다. Browser surface 안전 규칙상 live cookie/local-storage 값 자체는 읽지 않았으므로 `NOT_INSPECTED`; source-level storage use 0건만 판정한다.
8. fixture source inventory는 pre/post 모두 `53 files`, inventory SHA-256 `5d85da62579676bbef03d70790ae23c00467bfe8b5530641d471c7c58ac29ffa`로 동일하고, `tests/fixtures/repositories` 및 `packages/repository_intelligence`의 status/diff/cached diff는 0건이다.

### 조치

1. `BLK-A14-002` successor binding을 현재 committed clean seq161과 exact raw bytes/hash에서 재현 가능하도록 수정하고 targeted `26/26`, full tooling `268/268`, A-13 standalone PASS를 fresh 재검증한다.
2. fixture 선택 변경 시 scan/result/evidence/provider selection을 새 selection에 맞게 초기화하고, `BLOCKED/ERROR/PERMISSION_DENIED`에서 stale provider selection이 남지 않도록 수정한다.
3. `EMPTY/QUOTA/CANCEL/RECONNECT`를 실제 UI interaction으로 도달·검증할 fixture/action을 제공하되 mock/fixture 비-PASS semantics를 유지한다.
4. 사용자 소유 untracked handoff를 변경하지 않는 격리된 clean validation 경계와 current-worktree projection 정책을 Main Agent가 결정한 뒤 project-progress 회귀를 다시 실행한다.
5. 위 4개 blocking finding이 모두 닫히기 전 A-14 acceptance와 A-15 시작을 금지한다.

## 기준선과 쓰기 경계

| 대상 | SHA-256 / 값 |
|---|---|
| `AGENTS.md` | `1e93333379d230ea56058c3395570c96e9aae98f40d586e6dea9c1bd920d8246` |
| 설계서 | `246d0487789a18af17c7c9d5cf772442aca2182339d33d4c989d209baa3da9a5` |
| 작업계획서 | `a1032fb587337a914f63a316972402bac99760a92c7934670ef93979baba396a` |
| 통합검증매트릭스 | `982b4046a4764d74564e0291a82f0306db9b06f5d0a3858d49876322fb93f90a` |
| 테스트계획서 | `803868505616be655b8d12fc216736decb55e4812e7673da242f2637bf7f40f8` |
| 운영규칙 | `4aa7b81629924dc47519353cf396a7ff85bac8fb50f7a1b63d9f1337e8f6216e` |
| A-14 WI | `10421a71394cdc3903ef9bb03d1eddecb1ca6240219f9e992aa5971d9b1e5f38` |
| A-14 R2 WI | `73de02532280784326fdce67bbb50f0ee037bd7ab693a4f6c6d4741d525f0cd2` |
| progress / HANDOFF | seq161 `206a2ea8...8fe8` / `854f8365...b4b5` |

시작 Git porcelain은 사용자 소유 untracked handoff 1건뿐이었다. Tester의 workspace write는 이 보고서 한 파일뿐이며 제품, progress/HANDOFF, events, manifests, 기존 보고서, Git refs/index를 수정하지 않았다. commit/push/deploy도 수행하지 않았다.

## 실제 browser evidence

### 클릭·화면 결과

| 단계 | 실제 결과 |
|---|---|
| 초기 등록/fixture 자동 선택 | `NORMAL`, current task empty text, evidence `NOT EXECUTED`, Provider 9개 disabled |
| clean scan 클릭 직후 | `LOADING`, scan disabled, evidence `NOT EXECUTED` |
| clean scan 완료 | `NORMAL`, `SCANNED_READ_ONLY`, branch `main`, dirty `0`, `IDENTICAL`, evidence `FIXTURE`, Provider 9개 enabled |
| canonical Provider 선택 | `CEREBRAS`, `aria-checked=true`, 실제 Provider `NOT EXECUTED`, PASS badge 0 |
| dirty fixture scan | `BLOCKED`, dirty `1`, `IDENTICAL`, evidence `FIXTURE`, Provider 9개 disabled, PASS badge 0 |
| server disconnect | `ERROR`, `Failed to fetch`, evidence `ERROR`, Provider 9개 disabled |
| server restart + stale CSRF | `PERMISSION_DENIED`, generic message, evidence `ERROR`, leakage 0 |
| disabled keyboard 우회 | disabled GROQ `Space` action 실패, state/selection 변화 0 |

화면 표준은 실제 `innerWidth=1920`, `innerHeight=1080`, body `12px`, h1 `16px`다. 설명은 title tooltip 두 건이며 상시 설명 box가 아니다.

### screenshot artifacts

| 상태 | artifact | bytes | SHA-256 |
|---|---|---:|---|
| 초기 / NOT EXECUTED | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\01-initial-empty-not-executed.png` | 73317 | `a1b24255d4ca666f4f7c47217f3a3457709a248941cf31906d28194886d6abce` |
| clean / Provider fixture | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\02-clean-scan-provider-fixture.png` | 82415 | `52af3d1cf25bb9b0562352bb0e77e219047d970dfa3fbbe57d494386cf4790bc` |
| dirty / loading | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\03-dirty-blocked-fixture.png` | 78630 | `b63fe2821254ff65247a95620e02b4ea699c22e4b870b478c2089832236bdde7` |
| dirty / blocked | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\04-dirty-blocked-complete.png` | 79350 | `5dc65bc48ee5559e25c01ab94e26bd2291ad86247ea731b57f57eb391350de76` |
| server disconnect / error | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\05-server-disconnect-error.png` | 76640 | `585c38f6f929bb5b4285e2ab2ca04734fa9f3da1c7927750cff247fbca70e029` |
| stale CSRF / permission denied | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r3\06-stale-csrf-permission-denied.png` | 79311 | `239bb9bb28e7c67baeb606539e3bcaed0252af2e70e2a2fad7e09a51060f33da` |

### Network URL / method / status

in-app browser resource inventory는 실제로 관측된 URL과 initiator를 제공했고, method/status는 UI 결과 및 동일 서버 raw HTTP 응답으로 대조했다.

| method | full URL | status / browser 결과 |
|---|---|---|
| GET | `http://127.0.0.1:4173/` | `200` |
| GET | `http://127.0.0.1:4173/src/styles/workbench.css` | `200` |
| GET | `http://127.0.0.1:4173/src/app/workbench.js` | `200` |
| GET | `http://127.0.0.1:4173/src/api/workbench-client.js` | `200` |
| GET | `http://127.0.0.1:4173/src/features/workbench/workbench-state.js` | `200` |
| GET | `http://127.0.0.1:4173/api/workbench/config` | `200` |
| GET | `http://127.0.0.1:4173/favicon.ico` | `404` non-API optional resource; console error 0 |
| POST | `http://127.0.0.1:4173/api/workbench/scan` | clean `200`, dirty `200`, disconnected `NO_RESPONSE / Failed to fetch`, stale CSRF `403` |

- browser-observed unique resources: `7`; scan fetch occurrences: `4`
- browser API boundary: same-origin `/api/...` unique `2`
- separate internal API/localhost/container-port direct calls: `0`
- source scan: browser absolute API, `NEXT_PUBLIC_*`, storage/cookie, secret/raw stack/server path literals `0`; server-only local bind/origin construction은 browser code와 구분했다.

## 보안·hostile evidence

- root response: `200`; CSP는 `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`; `X-Content-Type-Options=nosniff`, `X-Frame-Options=DENY`, `Referrer-Policy=no-referrer`.
- hostile 9건: missing CSRF, tampered CSRF, hostile Origin, hostile Host, viewer role, XSS-shaped project mismatch, fixture path traversal, secret-shaped fixture, malformed body.
- 결과: `9/9 POST /api/workbench/scan -> 403`, generic `PERMISSION_DENIED`, input reflection/secret/raw stack/server path/provider raw error/internal endpoint leakage `0`.
- valid clean/dirty scan은 `200`, server-side read-only result `SCANNED_READ_ONLY`, `noWriteIdentical=true`다.

## fresh 검증 명령과 결과

| exact command | exit | 결과 |
|---|---:|---|
| `node --version` | 0 | `v24.18.0` |
| `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` | 0 | `6/6 PASS`, fail 0, skip 0 |
| `python --version` | 0 | `Python 3.13.9` |
| `python -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` | 1 | `26 total / 23 PASS / 3 FAIL / 0 SKIP`, 33.680s |
| `python -m unittest discover -s tests/tooling -p 'test_*.py' -v` | 1 | `268 total / 260 PASS / 8 FAIL / 0 SKIP`, 90.166s |
| `python scripts/check_a13_repository_scan.py` | 1 | 4 mismatch codes |
| `python scripts/check_a14_workbench_prototype.py` | 0 | PASS, paths 17, self-reference false |
| `python scripts/check_project_progress.py` | 1 | `GIT_DESCENDANT_WORKTREE_DIRTY` |
| `python scripts/check_g07_baseline.py` | 0 | packages 97, AV 255, uncovered 0, scenarios 20 |
| `python scripts/check_phase_g_gate.py` | 0 | accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7 |
| `python scripts/check_g06_test_assets.py` | 0 | fixtures 8, golden 8, scenarios 20, fault injections 8 |

full tooling 8 failures의 분해는 A-13 evidence 3건과 `GIT_DESCENDANT_WORKTREE_DIRTY` project-progress 5건이다. 실행된 범위만 위와 같이 PASS/FAIL로 인정한다.

## 미실행·비-PASS 경계

- actual UI `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT`: `NOT_EXECUTED` (runtime route 없음)
- live browser cookie/local-storage value inspection: `NOT_INSPECTED`; source use 0건만 확인
- production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna, deployment, DIR: `NOT_EXECUTED`
- fixture/mock/static/Node contract 결과는 production 또는 실제 Provider PASS로 승격하지 않는다.

## 종료 상태

- in-app browser viewport override는 reset했고 검증 tab은 finalize했다.
- fixture server PID `12452`, restart PID `16344`, final evidence PID `28076`은 모두 종료했다.
- 최종 `127.0.0.1:4173` listener: `0 / PORT FREE`.
- rollback: 이 Tester 보고서만 제거하면 된다. 제품 rollback은 수행하지 않았다.
