# A-14 Workbench Prototype Validation

## TDD 증거

- RED 1: `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` — exit 1, missing state/server implementation 2 failures.
- GREEN: 같은 명령 — exit 0, 6/6 PASS. 정적 shell/CSP, state/provider, 상대 API client, Origin/Host·CSRF·role/project/fixture, A-13 서버측 scan, hostile masking을 검증했다.
- RED 2: `python -m unittest tests.tooling.test_a14_workbench_prototype -v` — exit 1, 1 PASS/2 FAIL/1 ERROR. 누락된 계약·문서·manifest가 원인이다.
- GREEN 2: 같은 Python 명령 — exit 0, 4/4 PASS. Standalone checker도 exact 17 paths/self-reference false로 PASS했다.
- Full tooling: 268건 중 260 PASS/8 FAIL. A-14 자체 검사는 PASS했고, 8건은 아직 commit되지 않은 Developer exact projection을 기존 A-13 successor/progress clean-descendant 검사가 거부한 결과다. Developer 금지 경로를 수정하지 않고 Main completion projection 후 재검증 대상으로 남긴다.

## 검증 경계

Node HTTP runtime test는 dependency-free local fixture BFF를 실제 기동하고 요청했다. 이는 실제 GUI 브라우저 클릭 또는 Network panel 캡처가 아니므로 `AV-UI-004` L7와 `AV-UI-010` E-NET 최종 판정을 주장하지 않는다. 실제 브라우저·운영·Provider·DB·사용자 저장소·배포는 `NOT_EXECUTED`다. Fixture 증거는 `FIXTURE`, `countsAsPass=false`다.

## 보안 검증

Mutation route는 일치하는 Origin/Host, epoch-local CSRF token, operator role, project와 fixture allowlist를 모두 요구한다. 응답은 generic message만 포함하고 브라우저 dynamic content는 `textContent`로 렌더링한다. CSP는 `connect-src 'self'`이다.

## Revision 3 Developer rework evidence

- UI RED: `node --test apps/web/tests/workbench.test.mjs` — exit `1`, 신규 runtime-state export 부재로 의도한 compile-time RED.
- UI GREEN: `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` — exit `0`, `8/8 PASS`. fixture 변경·unsafe state의 stale selection 초기화, `EMPTY/QUOTA/CANCEL/RECONNECT` deterministic fixture action, relative API, strict CSP/Origin/Host/CSRF/role/allowlist와 hostile masking을 검증했다.
- A-13 successor RED: `python -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` — exit `1`, `28 total / 24 PASS / 4 FAIL`; seq165 R3 successor가 선택되지 않아 content/raw bytes/raw hash mismatch가 재현됐다.
- Targeted GREEN: 같은 명령 — exit `0`, `28/28 PASS`. active epoch-3 exact write-lease 또는 committed clean checkout에서 R3 exact live successor를 선택하고 predecessor/self-reference/raw bytes/hash tamper는 fail-closed로 유지한다.
- Standalone: A-13 checker exit `0` (`fixtures=8`, `zero_delta=8`, `hostile=15`), A-14 checker exit `0` (`paths=17`, `self_reference=false`), G-07 exit `0`, Phase G exit `0`.
- Project checker: exit `1`, `GIT_DESCENDANT_WORKTREE_DIRTY`와 `PRG_REFERENCED_HASH_MISMATCH`. Developer exact projection과 새 A-13 checker/test hash를 Main-owned progress가 아직 결박하지 않은 상태이며 Developer는 progress/HANDOFF/events를 수정하지 않는다.
- Full tooling: `python -m unittest discover -s tests/tooling -p "test_*.py" -v` — exit `1`, `271 total / 266 PASS / 5 FAIL / 0 SKIP`. 5건은 모두 위 동일 project projection 두 code이고 제품/targeted failure는 0이다. Main completion projection과 hash 동기화 뒤 전체 재실행이 필요하다.
- 실제 Codex in-app browser의 클릭·Network·console 재검증은 독립 Tester 소유로 `NOT_EXECUTED_BY_DEVELOPER`다. 위 Node 결과는 dependency-free fixture unit/HTTP runtime이며 실제 GUI·Provider·production PASS가 아니다.
- coverage 전용 runner는 이 dependency-free scaffold에 구성되어 있지 않아 `NOT_EXECUTED`; 실행한 Node/Python suite 결과를 coverage 수치로 승격하지 않는다.
- `LOCAL_CLOCK_SKEW`가 관측됐으나 설계서 §49.5 계약에 따라 lease 유효성은 shell local clock이 아니라 canonical PostgreSQL UTC `worker_leases` 기준으로 판정했다. 로컬 시각·설정을 변경하지 않았다.


## Revision 2 Developer rework evidence (BLK-A14-002)

- TDD RED reproduced exactly: `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`.
- Root cause: clean HEAD is A-14 START sequence 151, but the A-13 successor checker required dirty-path equality before considering the immutable A-14 START successor. Both working tree and clone used LF; line-ending conversion was ruled out.
- GREEN: phase-aware clean-checkout binding accepts the exact A-14 START successor and current epoch-2 successor while preserving predecessor, self-reference, target, raw bytes/hash and hostile-tamper rejection.
- Targeted Python: 26/26 PASS (`tests.tooling.test_a13_repository_scan` + `tests.tooling.test_a14_workbench_prototype`).
- Node HTTP/browser contract: 6/6 PASS.
- Full tooling: 268 total, 258 PASS, 10 FAIL. All 10 are Main-owned projection synchronization failures (`GIT_DESCENDANT_PATH_SET_MISMATCH`, downstream `PRG_REFERENCED_HASH_MISMATCH`) because the epoch-2 checker/test/R2 manifest are not yet in `build-progress` exact paths/hashes. This is not promoted to PASS; Main must materialize the completion projection and rerun.
- In-app browser retry: `ENVIRONMENT_BLOCKED / NOT_EXECUTED`. Two setup attempts failed before interaction with `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`. No alternate browser was used and no browser PASS is claimed.
