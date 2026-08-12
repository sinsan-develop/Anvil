# A-14 Independent Browser Retest Report R5

- package / revision: `A-14 / R5`
- tester role: independent read-only Tester
- tested HEAD / branch: `7ec7e330ceb7d18990cb96d2cc72fa7fa334753f / main`
- remote baseline: `origin/main = 7ec7e330ceb7d18990cb96d2cc72fa7fa334753f`
- progress: sequence `171`, `TEST_REVIEW`, independent Tester `R5_PENDING`, worker/write lease `null`
- environment: `ENV-LOCAL / Codex in-app browser / fixture browser runtime / disposable clean Git clone`
- browser viewport: `1920 x 1080`, device pixel ratio `1`
- assigned verification: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- verdict: `FAILURE_REPORT / REWORK_REQUIRED / NOT_READY_FOR_MAIN_ACCEPTANCE`
- blocking findings: `2 CRITICAL`

## 판정 -> 판단 이유 -> 조치

### 판정

R4에서 닫힌 실제 화면 결함은 R5에서도 다시 나타나지 않았다. 실제 Codex in-app browser에서 fixture 변경 즉시 이전 scan/evidence/provider가 초기화됐고, `BLOCKED`, `ERROR`, `PERMISSION_DENIED`에서 Provider 9개가 모두 `disabled=true`, `aria-checked=false`였다. `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT`도 실제 버튼 클릭으로 도달했으며 fixture 또는 `NOT EXECUTED`로 표시되어 실제 Provider/Run/SSE PASS로 승격되지 않았다.

그러나 Main takeover completion은 `BLK-A14-002`를 닫지 못했다. 현재 committed clean checkout에서 targeted Python은 `29 total / 25 PASS / 4 FAIL`, full tooling은 `271 total / 267 PASS / 4 FAIL`이며 네 실패가 모두 A-13 evidence successor 계보에 집중된다. 별도 disposable clean clone에서는 targeted `29 total / 23 PASS / 6 FAIL`, full tooling `271 total / 258 PASS / 13 FAIL`로 더 넓은 raw-byte portability 결함도 재현됐다. 따라서 `AV-GATE-005`와 A-14 전체 인수는 FAIL이다. A-15를 시작하면 안 된다.

### 판단 이유

1. `BLK-A14-R5-001 / CRITICAL / BLK-A14-002 REOPENED`: seq 171의 Main takeover completion successor 선택이 `exact_allowed_paths == changed_paths`만 허용하고 committed clean 상태를 허용하지 않는다. completion manifest의 A-13 raw bytes/hash는 현재 파일과 정확히 일치하지만 `_revision2_completion_successor`가 후보를 반환하지 않아 current checkout과 disposable clean clone 모두 `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`를 반환한다. 이는 손상 입력 허용이 아니라 정상 committed projection false rejection이다.
2. `BLK-A14-R5-002 / CRITICAL / CLEAN_CLONE_CANONICAL_BYTE_PORTABILITY`: 원 checkout의 `apps/web/server.mjs`와 `tests/browser/a14/workbench-runtime.test.mjs`는 index `LF`, worktree `mixed`이고 A-14 manifest는 그 mixed worktree SHA를 결박한다. 원 checkout은 각각 `6255 bytes / 432FF673...16D5`, `2664 bytes / D6DC2372...9D9F`이며 manifest와 일치하지만, clean clone의 committed LF 파일은 `6254 bytes / FD1ED889...F1BC`, `2663 bytes / CF433305...0D2A`라 A-14 checker가 두 checksum을 거부한다. clean-clone full suite에서는 이 두 A-14 실패 외에 A-11 predecessor 1건과 project progress detached/reference/registry 6건도 추가로 실패했다. 따라서 현재 evidence/digest bundle은 새 clean checkout에서 재현 가능한 기준선이 아니다.
3. hostile tamper fail-closed는 유지된다. predecessor binding tamper, clean-checkout successor tamper, Main takeover successor raw-hash tamper를 독립 실행했고 모두 예상 reason code로 거부됐다. 정상 projection만 false reject되는 상태다.
4. 현재 checkout의 A-14 standalone, project progress, G-07, Phase G는 각각 PASS했다. clean clone에서는 A-13, A-14, project progress가 FAIL했고 G-07과 Phase G는 PASS했다. 현재 checkout PASS를 clean-clone 재현성 PASS로 승격하지 않는다.
5. 실제 browser에서 clean scan은 `LOADING -> NORMAL`, `SCANNED_READ_ONLY`, dirty `0`, `IDENTICAL`, evidence `FIXTURE`였다. CEREBRAS 선택 후 fixture 변경 즉시 `EMPTY / NOT EXECUTED / scan 없음 / Provider 9개 unchecked`로 초기화됐고 dirty scan은 `BLOCKED`, dirty `1`, `IDENTICAL`이었다. 서버 단절은 `ERROR / Failed to fetch`, 재기동 뒤 stale CSRF는 `PERMISSION_DENIED`였으며 두 상태 모두 Provider 9개가 해제됐다.
6. `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT` 각각을 실제 UI 버튼으로 눌렀다. `EMPTY`는 `NOT EXECUTED`, 나머지는 `FIXTURE` badge였고 화면의 Provider, DB/배포, 사용자 Repository는 모두 `NOT EXECUTED`였다. 실제 Provider quota, 실제 Run 취소, 실제 SSE 재연결을 실행하거나 PASS로 표시하지 않았다.
7. browser `pageAssets` inventory의 6개 URL은 모두 `http://127.0.0.1:4173` same-origin이고 API URL은 `/api/workbench/config`, `/api/workbench/scan`뿐이다. 이 inventory는 HTTP method/status를 제공하지 않으므로 Network 전체 캡처로 과장하지 않는다. 별도 raw HTTP hostile 9건은 8건 `403`, malformed JSON 1건 `400`이며 입력값, secret-shaped 문자열, stack, 서버 경로, 내부 endpoint leakage는 0건이었다. browser console warning/error는 0건이다.

### 조치

1. seq 171 Main takeover completion을 phase-aware successor로 선택할 때 exact dirty projection뿐 아니라 exact committed clean projection도 deterministic하게 허용하되 predecessor hash와 live raw bytes/hash fail-closed 검증은 유지한다.
2. `apps/web/server.mjs`와 `tests/browser/a14/workbench-runtime.test.mjs`의 committed byte/EOL 기준을 하나로 정규화하고 A-14 evidence를 committed clean checkout에서 재계산한다. 현재 worktree에서 우연히 일치하는 mixed-EOL SHA를 canonical evidence로 사용하지 않는다.
3. clean clone의 A-11 predecessor 및 project detached/reference/registry failure도 동일한 canonical-byte 재현성 관점에서 점검한다. 정상 checkout과 clean clone 모두에서 A-13/A-14/project standalone, targeted `29/29`, full tooling `271/271`을 fresh 재검증한다.
4. 기존 predecessor/successor/Main takeover tamper fail-closed 회귀와 실제 browser UI smoke를 유지한다. 위 두 CRITICAL finding이 닫히기 전 A-14 acceptance와 A-15 시작을 금지한다.

## 기준선과 권위 hash

| 대상 | SHA-256 |
|---|---|
| `AGENTS.md` | `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246` |
| 설계서 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| 작업계획서 | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` |
| 통합검증매트릭스 | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` |
| 테스트계획서 | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` |
| 운영규칙 | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| progress / HANDOFF | `79B2314EA052493338310448E759D698C55D835F9ECDAC5BFB06BF067392FE15` / `274AB02A704BE106D3D3AF76872D7A5A4ABC2BF873CBD724CC7283CE57822D12` |
| R4 report | `10D591A1D87AD760BFACD7FCA70FD7A020DA87589DB12F035A8A59C6F207A2D9` |
| Main takeover packet | `42B3F92672203CCD90E0F00B3AC257036E05794FB9CCABE66DB98C0C86B33263` |
| Main takeover evidence | `77CA2CDC385E089DCCA5414C1CF7152DFE77B70B79A78C5C0C6F9E270D237381` |
| Main takeover completion | `52D4C769AEE757580FDC987B074EDF1EFA6A9C7462732216E46FD77BC7B75746` |

## 실제 browser evidence

| 단계 | 실제 결과 |
|---|---|
| 초기 config 완료 | `EMPTY`, evidence `NOT EXECUTED`, scan 없음, Provider 9개 disabled/unchecked |
| clean scan 클릭 직후 | `LOADING`, scan disabled, evidence `NOT EXECUTED` |
| clean scan 완료 | `NORMAL`, `SCANNED_READ_ONLY`, branch `main`, dirty `0`, `IDENTICAL`, evidence `FIXTURE`, Provider 9개 enabled |
| Provider 선택 | `CEREBRAS aria-checked=true`; 실제 Provider는 `NOT EXECUTED` |
| fixture 변경 직후 | `EMPTY`, evidence `NOT EXECUTED`, 이전 scan/result/provider 전부 초기화 |
| dirty scan 완료 | `BLOCKED`, dirty `1`, `IDENTICAL`, Provider 9개 disabled/unchecked |
| server disconnect | `ERROR`, `Failed to fetch`, Provider 9개 disabled/unchecked |
| server restart + stale CSRF | `PERMISSION_DENIED`, evidence `ERROR`, Provider 9개 disabled/unchecked |
| runtime buttons | `EMPTY`, `QUOTA`, `CANCEL`, `RECONNECT` actual UI action 도달; fixture/NOT EXECUTED, actual PASS 0 |

화면 표준은 실제 `innerWidth=1920`, `innerHeight=1080`, body `12px`, h1 `16px`, DPR `1`이다. 설명은 `i` 버튼의 title 기반 설명 인터페이스이며 상시 설명 box를 추가하지 않았다.

## fresh 검증 명령과 결과

| 범위 | exact command | exit | 실제 결과 |
|---|---|---:|---|
| current | `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` | 0 | `8/8 PASS`, fail 0, skip 0; module-type warning 1 |
| current | `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` | 1 | `29 total / 25 PASS / 4 FAIL / 0 SKIP` |
| current | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py' -v` | 1 | `271 total / 267 PASS / 4 FAIL / 0 SKIP`, 80.657s |
| current | `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a13_repository_scan.py` | 1 | content/raw bytes/raw hash mismatch |
| current | A-14 / project / G-07 / Phase G standalone checkers | 0 | 각각 PASS |
| clean clone | targeted A-13+A-14 unittest | 1 | `29 total / 23 PASS / 6 FAIL / 0 SKIP` |
| clean clone | full tooling unittest | 1 | `271 total / 258 PASS / 13 FAIL / 0 SKIP`, 82.793s |
| clean clone | A-13 / A-14 / project standalone | 1 | 각각 integrity/checksum/digest mismatch로 FAIL |
| clean clone | G-07 / Phase G standalone | 0 | 각각 PASS |
| tamper | predecessor + clean-checkout successor private hostile helpers | 0 | `A13_PREDECESSOR_AND_CLEAN_CHECKOUT_TAMPER_FAIL_CLOSED: PASS` |
| tamper | Main takeover successor raw-hash tamper validation | 0 | `A14_MAIN_TAKEOVER_SUCCESSOR_TAMPER_FAIL_CLOSED: PASS` |

current full tooling의 실패 4건은 `test_checker_cli_reports_exact_counts`, `test_checker_validates_reusable_contract_and_eight_fixtures`, `test_evidence_manifest_has_raw_hashes_no_self_reference_and_exact_diff`, `test_revision3_rework_projection_selects_current_live_successor`다. clean clone full tooling의 실패 13건은 A-13 4, A-14 2, A-11 predecessor 1, project progress 6이다.

## no-write·미실행·종료 경계

- 시작 시 Git은 clean이고 `main = origin/main = 7ec7e330ceb7d18990cb96d2cc72fa7fa334753f`였다.
- current/clone 테스트와 browser 검증 뒤, 이 보고서 작성 직전 원 checkout과 disposable clone은 모두 clean이었다.
- disposable clone `C:\Users\cyhuh\AppData\Local\Temp\anvil-a14-r5-clean-7ec7e33`은 결과 확인 뒤 제거했다.
- Tester write는 이 보고서 한 파일뿐이다. 제품, progress/HANDOFF, events, ledger, manifests, 기존 보고서, Git refs/index는 수정하지 않았다. commit/push/deploy도 수행하지 않았다.
- production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna, deployment, DIR은 `NOT_EXECUTED`다. fixture browser·Node·static 결과를 해당 영역 PASS로 승격하지 않는다.
- live cookie/local-storage 값은 browser safety 경계상 `NOT_INSPECTED`; source-level access 0건만 확인했다.
- in-app browser viewport override를 reset하고 검증 tab을 finalize했다. fixture server PID `38968`, restart PID `37816`은 종료했고 최종 `127.0.0.1:4173` listener는 `0 / PORT FREE`다.
- rollback: 이 Tester 보고서만 제거하면 된다. 제품 rollback은 수행하지 않았다.
