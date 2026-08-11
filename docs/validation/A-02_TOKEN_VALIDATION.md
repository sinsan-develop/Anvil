# A-02 Token Validation

## 판정

`PASS_STATIC_CONTRACT_REVISION_2 / COMPLETED_PENDING_INDEPENDENT_RETEST`

## TDD evidence

| 단계 | 명령 | exit | 실제 결과 |
|---|---|---:|---|
| 환경 확인 | `python -m unittest tests.tooling.test_a02_tokens` | 1 | PowerShell PATH에 `python` 미등록. 계약 실패가 아니므로 RED/정식 실패로 계산하지 않음 |
| RED | `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a02_tokens` | 1 | checker 부재로 1 failure, 1 error |
| 중간 GREEN | 같은 명령 | 1 | 8개 중 5 통과, mutation append 경로 오류와 manifest 미생성 확인 |
| 원인 수정 확인 | 같은 명령 | 1 | 8개 중 7 통과, 의도적으로 미생성 상태인 manifest 1 error만 남음 |
| 최종 GREEN | 같은 명령 | 0 | 8/8 PASS, failure 0, error 0, skip 0 |
| checker | `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a02_tokens.py --json` | 0 | `verdict=PASS`, `errors=[]` |
| 지정 회귀 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a02_tokens tests.tooling.test_project_progress tests.tooling.test_g07_baseline` | 1 | 56 중 52 PASS, 4 FAIL, skip 0. 4건은 Main push 대기로 local `2bd8812`와 origin `1ace563`이 다른 `GIT_DESCENDANT_ORIGIN_MISMATCH`, 개발 중 허용 제품 dirty가 start projection exact allowlist 밖인 `GIT_DESCENDANT_WORKTREE_DIRTY`; A-02 token test 8건은 PASS |

mutation append 오류는 `append`일 때 전체 경로를 따라 list까지 내려가지 않고 상위 dict에서 `.append()`를 호출한 것이 원인이었다. traversal 대상만 최소 수정했다.

## 검증 범위

- exact viewport·typography·layout·spacing
- semantic palette role/value와 contrast 4.5:1·3.0:1 guard
- i-icon + tooltip/popover + reason/next_action + focus/keyboard
- persistent explanation box·hover-only·color-only 상태 금지
- catalog/Markdown/SVG 정합성과 SVG 1920×1080 dimensions
- `AV-UI-001/002` matrix level/method/evidence/severity 불변
- A-01 accepted presentation contract/hash 불변
- hostile mutation 22건 stable reason code
- manifest raw bytes/hash와 non-self-referential target

## 판정 경계

정적 산출물만 검증한다. `STATIC_ONLY / E-SHOT_STATIC_NOT_RUNTIME_UI`이며 canonical L4 runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`다. 브라우저, Playwright, API, DB, Network, Docker, WSL, server, deploy, release는 실행하지 않았다.

회귀 4건은 제품 결함으로 은폐하거나 PASS로 승격하지 않는다. Main이 제품 diff를 checkpoint하고 start projection push/완료 projection을 갱신한 뒤 재실행해야 한다.

## Revision 2 — 독립 Tester 결함 보완

기준 TestReport SHA-256은 `1732C036F79FBE05DF9EBF1BB59B67E621DAE8CC40259D30585714C01F73FAF8`이다. predecessor manifest `FC2D3BD61BA7014CB74635D96AF68C3CCEE970E9FEAC52327A020570A52E5269`는 수정하지 않았다.

| finding | RED | 최소 수정 후 GREEN |
|---|---|---|
| DEF-A02-001 | 전용 unittest exit 1, self-reference/canonical bytes/content bytes/arbitrary raw path/bundle 미호출 5 failures | 동일 전용 test 포함 재실행에서 PASS |
| DEF-A02-002 | 전용 unittest exit 1, body 12→16 및 sidebar 224/56 swap이 errors `[]`인 1 failure | token-key/value table parser 도입 후 PASS |
| fixture binding | 새 manifest/document mutation 선언 부재로 exit 1, KeyError 1 | manifest 7종·document 2종 stable reason code 선언 후 PASS |

Revision 2 검사기는 latest successor manifest를 CLI `validate_bundle()`에서 반드시 호출한다. exact raw path set, `self_reference=false`, canonical/content byte aggregate, 실제 raw bytes/hash, target/delivered, predecessor/TestReport binding을 독립 재계산한다. Markdown은 token key별 값을 catalog와 비교하고 SVG의 key/value 표현도 catalog 값으로 구성한 exact literal과 비교한다.

최종 Revision 2 전체 suite는 10/10 PASS, failure 0, error 0, skip 0, exit 0이다. `scripts/check_a02_tokens.py --json`도 `verdict=PASS`, `errors=[]`, exit 0이다. 이 결과는 successor manifest 최종 재계산 뒤 다시 fresh 실행한다.
