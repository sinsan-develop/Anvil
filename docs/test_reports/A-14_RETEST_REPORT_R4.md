# A-14 Independent Browser Retest Report R4

- package / revision: `A-14 / R4`
- tester role: independent read-only Tester
- tested HEAD / branch: `66b967d12cc0e57107dead56d5d47a65804f6863 / main`
- remote baseline: `origin/main = 66b967d12cc0e57107dead56d5d47a65804f6863`
- progress: sequence `168`, `TEST_REVIEW`, independent Tester `R4_PENDING`, worker/write lease `null`
- environment: `ENV-LOCAL / Codex in-app browser / fixture browser runtime`
- browser viewport: `1920 x 1080`, device pixel ratio `1`
- assigned verification: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- verdict: `FAILURE_REPORT / REWORK_REQUIRED / NOT_READY_FOR_MAIN_ACCEPTANCE`
- blocking findings: `1 CRITICAL`

## 판정 -> 판단 이유 -> 조치

### 판정

R3의 실제 화면 상태 결함과 환경 기준선 결함은 닫혔다. 실제 Codex in-app browser에서 fixture 변경 즉시 이전 scan/evidence/provider가 초기화됐고, `BLOCKED`, `ERROR`, `PERMISSION_DENIED`에서 Provider 9개가 모두 `disabled=true`, `aria-checked=false`였다. `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT`도 실제 버튼 클릭으로 도달했으며 fixture 또는 `NOT EXECUTED`로 표시되어 실제 Provider/Run/SSE PASS로 승격되지 않았다.

그러나 `BLK-A14-002`의 clean-checkout successor 결박은 현재 committed HEAD에서 다시 실패한다. targeted Python은 `29 total / 25 PASS / 4 FAIL`, full tooling은 `271 total / 267 PASS / 4 FAIL`이며 네 실패가 모두 A-13 evidence successor 계보에 집중된다. 따라서 `AV-GATE-005`와 A-14 전체 인수는 FAIL이다. A-15를 시작하면 안 된다.

### 판단 이유

1. `BLK-A14-R4-001 / CRITICAL / BLK-A14-002 REOPENED`: 현재 파일은 `scripts/check_a13_repository_scan.py = 28,946 bytes / FD08867C...C5754`, `tests/tooling/test_a13_repository_scan.py = 39,743 bytes / 267B566A...8829`이다. `A-14_EVIDENCE_MANIFEST_R3.json`의 live successor row는 각각 `27,321 bytes / 4C9D5C06...2B13D`, `38,764 bytes / F7920C6E...36E3F`를 결박한다. 반면 completion-progress manifest에는 현재 raw bytes/hash가 들어 있다. phase-aware successor가 하나의 유효 successor로 선택되지 않아 current workspace와 clean clone 모두 `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`를 반환한다.
2. tamper fail-closed 자체는 동작한다. predecessor tamper와 clean-checkout successor tamper helper는 독립 실행에서 PASS했다. 문제는 손상 입력을 허용하는 것이 아니라, 정상 committed clean projection을 stale evidence row 때문에 거부하는 false rejection이다.
3. fixture 변경 직전 clean scan과 CEREBRAS 선택 상태는 `NORMAL / FIXTURE / aria-checked=true`였다. `FIX-PY-DIRTY` 선택 직후에는 `EMPTY / NOT EXECUTED / scan 없음 / Provider 9개 disabled / aria-checked=false`로 즉시 초기화됐다. dirty scan 완료 `BLOCKED`, 서버 단절 `ERROR`, stale CSRF `PERMISSION_DENIED`에서도 Provider 9개가 모두 해제됐다. R3 stale UI finding은 `CLOSED`다.
4. `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT` 각각을 실제 UI 버튼으로 눌렀다. `EMPTY`는 `NOT EXECUTED`, 나머지는 `FIXTURE` badge와 메시지 안의 실제 Provider quota/Run 취소/SSE `NOT EXECUTED`를 표시했다. scan 결과는 비워지고 Provider는 모두 disabled/unchecked였으며 actual PASS 표시는 0건이다. R3 runtime-state 도달 finding은 `CLOSED`다.
5. 시작 기준선은 clean이었고 project progress checker가 PASS했다. 사용자 WSL handoff는 현재 committed evidence이며 `GIT_DESCENDANT_WORKTREE_DIRTY`가 재현되지 않았다. R3 environment baseline finding은 `CLOSED`다.
6. in-app browser `pageAssets` inventory는 현재 페이지에서 관측된 6개 asset URL과 initiator만 제공하며 HTTP method/status는 제공하지 않는다. 6개 URL은 모두 `http://127.0.0.1:4173` same-origin이고 API는 `/api/workbench/config`, `/api/workbench/scan`뿐이다. method/status는 동일 fixture server의 raw HTTP로 별도 대조했다. 이 결합 증거를 browser Network 전체 캡처로 과장하지 않는다.
7. hostile raw HTTP 9건은 모두 `POST /api/workbench/scan -> 403`, generic `PERMISSION_DENIED`, input/secret/raw stack/server path/internal endpoint leakage 0건이었다. root/config/valid clean scan은 각각 `200`이었다. 실제 browser console warning/error는 0건이다.

### 조치

1. `A-14_EVIDENCE_MANIFEST_R3.json`, completion-progress successor, 현재 committed raw bytes/hash 중 어느 artifact가 canonical successor인지 하나로 고정하고 phase-aware selection을 deterministic하게 만든다.
2. clean current checkout과 clean clone에서 A-13 standalone PASS, targeted `29/29`, full tooling `271/271`을 fresh 재검증한다.
3. 기존 tamper fail-closed 회귀를 유지하고 유효 projection을 false reject하지 않는 테스트를 별도로 보존한다.
4. 이 CRITICAL finding이 닫히기 전 A-14 acceptance와 A-15 시작을 금지한다.

## 기준선과 권위 hash

| 대상 | SHA-256 |
|---|---|
| `AGENTS.md` | `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246` |
| 설계서 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| 작업계획서 | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` |
| 통합검증매트릭스 | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` |
| 테스트계획서 | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` |
| 운영규칙 | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| A-14 R3 WI | `EA5C9CBB8D9A8107D5EE4845B578D995C3F4EA77017CBDDE7952DC8212E5896C` |
| progress / HANDOFF | `683BE47B7B5FF29C0CA05FA615397B99C2C34AA818B4ABDC07AB6412817F7B01` / `F8B11BDBC0665E5A66B202A090EB621C996E8D6E70F17788EA0709B728B376CE` |
| A-14 R3 evidence / completion-progress | `830A16580403C0A29AFC23DDD29F921AFF0BDF116538E5675F2011185213AE25` / `D78B13D62EAB115E900AB341E6EEB221C3B2C7E5EFE86AECBB37D8F2C29A1D51` |

## 실제 browser evidence

### 화면·클릭 결과

| 단계 | 실제 결과 |
|---|---|
| 초기 config 완료 | `EMPTY`, evidence `NOT EXECUTED`, scan 없음, Provider 9개 disabled/unchecked |
| clean scan 클릭 직후 | `LOADING`, scan disabled, evidence `NOT EXECUTED` |
| clean scan 완료 | `NORMAL`, `SCANNED_READ_ONLY`, branch `main`, dirty `0`, `IDENTICAL`, evidence `FIXTURE`, Provider 9개 enabled |
| Provider 선택 | `CEREBRAS aria-checked=true`, 실제 Provider는 화면에서 계속 `NOT EXECUTED` |
| fixture 변경 직후 | `EMPTY`, evidence `NOT EXECUTED`, 이전 scan/result/provider 전부 초기화 |
| dirty scan 완료 | `BLOCKED`, dirty `1`, `IDENTICAL`, Provider 9개 disabled/unchecked |
| server disconnect | `ERROR`, `Failed to fetch`, scan 없음, Provider 9개 disabled/unchecked |
| server restart + stale CSRF | `PERMISSION_DENIED`, evidence `ERROR`, Provider 9개 disabled/unchecked |
| runtime buttons | `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT` actual UI action 도달; fixture/NOT EXECUTED, actual PASS 0 |

화면 표준은 실제 `innerWidth=1920`, `innerHeight=1080`, body `12px`, h1 `16px`, DPR `1`이다. 설명은 `title` 기반 `i` 툴팁이며 상시 설명 box로 추가되지 않았다.

### screenshot artifacts

| 상태 | 임시 artifact | bytes | SHA-256 |
|---|---|---:|---|
| EMPTY / NOT EXECUTED | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r4\01-empty-not-executed.png` | 84,920 | `F88B54A3CB3D48CF36CF386BE44B3E20078714862EF93FD615FC4B2496BFE51E` |
| clean / CEREBRAS fixture | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r4\02-clean-provider-fixture.png` | 95,097 | `373ED003696EBEE0FAC486937D9E7F25AAFFAE96CD621BF73939F66120D5117D` |
| fixture change reset | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r4\03-fixture-change-reset.png` | 84,978 | `57C2F3D06AAC425B003179CB6BF0EBABFB1CCDF61C8A1E5F204FA05836832A60` |
| RECONNECT fixture / not actual | `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-retest-r4\04-reconnect-fixture-not-actual.png` | 88,133 | `0D15D153700B0B710091508BB696F89E7735B4A5217B3404E6F1F8F3E69842DB` |

### same-origin resource inventory와 raw HTTP

Browser-observed asset URL 6건은 stylesheet 1, script 3, fetch 2이며 모두 page origin과 동일하다. fetch URL은 다음 두 개다.

- `http://127.0.0.1:4173/api/workbench/config`
- `http://127.0.0.1:4173/api/workbench/scan`

Browser resource inventory는 method/status를 제공하지 않는다. 동일 server raw HTTP 대조 결과는 root `GET 200`, config `GET 200`, valid clean scan `POST 200`, hostile scan 9건 `POST 403`이다. browser client source의 API 호출은 상대 `/api/...`이고 다른 host/port, container hostname, `NEXT_PUBLIC_*`, browser storage/cookie access, secret/raw stack/server path literal은 0건이다.

보안 header는 CSP `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'`, `X-Content-Type-Options=nosniff`, `X-Frame-Options=DENY`, `Referrer-Policy=no-referrer`다.

## fresh 검증 명령과 결과

| exact command | exit | 실제 결과 |
|---|---:|---|
| `node --version` | 0 | `v24.18.0` |
| `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` | 0 | `8/8 PASS`, fail 0, skip 0; module-type warning 1 |
| `C:\Users\cyhuh\anaconda3\python.exe --version` | 0 | `Python 3.13.9` |
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` | 1 | `29 total / 25 PASS / 4 FAIL / 0 SKIP` |
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py' -v` | 1 | `271 total / 267 PASS / 4 FAIL / 0 SKIP`, 85.374s |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_project_progress.py` | 0 | PASS, sequence 168, `AUTO_CONTINUE` |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_g07_baseline.py` | 0 | PASS, packages 97, AV 255, scenarios 20 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_phase_g_gate.py` | 0 | PASS, accepted 7, decisions 10, sync 7 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a13_repository_scan.py` | 1 | `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH` |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a14_workbench_prototype.py` | 0 | PASS, paths 17, self-reference false |
| direct predecessor + clean-checkout successor tamper helpers | 0 | `A13_PREDECESSOR_AND_CLEAN_CHECKOUT_TAMPER_FAIL_CLOSED: PASS` |

full tooling의 실패 4건은 `test_checker_cli_reports_exact_counts`, `test_checker_validates_reusable_contract_and_eight_fixtures`, `test_evidence_manifest_has_raw_hashes_no_self_reference_and_exact_diff`, `test_revision3_rework_projection_selects_current_live_successor`다. 모두 동일 successor mismatch lineage다.

## no-write·미실행·종료 경계

- 시작 시 Git은 clean이고 `main = origin/main = 66b967d12cc0e57107dead56d5d47a65804f6863`였다.
- `packages/repository_intelligence`와 `tests/fixtures/repositories`의 worktree diff와 cached diff는 0건이다.
- 모든 테스트와 browser 검증 뒤, 이 보고서 작성 직전 Git은 다시 clean이었다.
- Tester write는 이 보고서 한 파일뿐이다. 제품, progress/HANDOFF, events, ledger, manifests, 기존 보고서, Git refs/index는 수정하지 않았다. commit/push/deploy도 수행하지 않았다.
- production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna, deployment, DIR은 `NOT_EXECUTED`다. fixture browser·Node·static 결과를 해당 영역 PASS로 승격하지 않는다.
- live cookie/local-storage 값은 browser safety 경계상 `NOT_INSPECTED`; source-level access 0건만 확인했다.
- in-app browser viewport override를 reset하고 검증 tab을 finalize했다. fixture server PID `22576`, restart PID `36424`는 종료했고 최종 `127.0.0.1:4173` listener는 `0 / PORT FREE`다.
- rollback: 이 Tester 보고서만 제거하면 된다. 제품 rollback은 수행하지 않았다.
