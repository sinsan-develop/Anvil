# C-09 R4 제품 독립 Spec Review 원문

## 판정

`REWORK_REQUIRED` — `Critical 2 / Important 8 / Minor 1`.

이 판정은 C-09 동일 lineage의 세 번째 유효 재검토 실패를 확정하므로 `MAIN_TAKEOVER_AT_3` 조건을 충족한다. quality/spec 두 검토는 동일 product snapshot의 한 review cycle이므로 failure count를 4로 중복 증가시키지 않고 failure3으로 1회만 집계한다.

## 검토 snapshot

- reviewed HEAD: `85d72196eaafe3e458f8aea7016df94f810df086`
- branch: `codex/c09-execution-backends-r1`
- product path count: exact18
- product sorted LF+trailing-LF path hash: `AC308DAC4396006ABA4FFD3CCDB44FA90063F787C88EAA9F7E6B86E541D0887F`
- staged path count: 0
- completion report SHA-256: `89D95D90CCEB839B5265166200DCFD36C8C7A865790F68A661D94755601034A7`
- review 중 제품/control/기존 ignored 파일 수정·stage·commit·push: 0

## Fresh 검증 결과

1. `python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py`
   - exit 0, `49 passed in 152.83s`
2. `python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py`
   - exit 0, `85 passed in 177.26s`
3. `python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py`
   - exit 0, `5 passed in 0.82s`
4. `python -B scripts/check_project_progress.py --c09-r4-mode=ACTIVE_R4`
   - exit 0, `PASS sequence=814 reporting=AUTO_CONTINUE`
5. `git diff --check` 및 `git diff --cached --check`
   - exit 0
6. read-only syntax compile
   - `python -B -c`에서 대상 Python source bytes를 `compile(..., 'exec')`로 검사
   - exit 0, `SYNTAX_COMPILE_PASS files=17`

실제 Docker daemon/CLI, WSL, DB/API/UI/browser, Provider/Telegram, SSH/network/deploy/Secret은 `NOT_EXECUTED` / `NOT_ACCESSED`다. Docker 검토는 stateful injected fake와 temp/local in-memory hostile probe만 사용했으며 actual runtime PASS로 승격하지 않는다.

## 확정 findings

### Critical 1 — Docker helper scope enforcement가 구현·검증되지 않음

- `packages/execution_backends/docker.py`에는 canonical envelope를 `anvil-read-tool`에 전달하는 호출만 있고 helper 구현은 저장소에 없다.
- 제품 source에서 `rg -n "anvil-read-tool|target_scopes|traversal"`을 수행한 결과 helper scope enforcement 구현은 0건이고 호출부와 fake test만 존재했다.
- 5개 operation `repo.status`, `git.diff`, `repo.read_file`, `repo.search`, `repo.symbols`를 stateful fake에서 실행한 결과 모두 `SUCCEEDED`했다.
- 다섯 envelope의 `limits` key는 모두 `max_output_bytes`, `timeout_seconds`뿐이고 traversal file/byte/row limit가 없다.
- direct hostile probe `repo.read_file {"path":"OUTSIDE.txt"}` 결과는 `SUCCEEDED bounded docker read`였다.
- 영향: Docker backend는 scope 밖 read를 자체 차단하지 않고 외부 미검증 executable을 신뢰한다. 특히 path 없는 status/diff/search/symbols의 scope enforcement와 zero disclosure를 증명하지 못해 R3 Critical이 폐쇄되지 않았다.

### Critical 2 — trusted manifest verifier가 manifest를 검증하지 않고 임의 bytes hash만 비교함

- `packages/execution_backends/models.py::_verify_manifest_evidence`는 bytes의 SHA-256만 계산하며 JSON/schema/repository/baseline 결박을 확인하지 않는다.
- hostile probe에서 evidence bytes `b"not-json-and-no-baseline-binding"`을 `(repo-1, actual-baseline)` key로 주입하고 그 bytes hash를 WorkspaceSpec에 사용했다.
- 결과: `MALFORMED_MANIFEST_ACCEPTED ws-1 True`.
- 동일 spec의 기존 workspace replay는 현재 evidence를 재검증하기 전에 반환한다.
- 영향: approved baseline/manifest authority가 실제 authoritative 문서가 아니라 constructor mapping key와 임의 bytes hash만으로 성립한다.

### Important 1 — handle owner identity에 backend_id 축이 없음

- 실제 public signature:
  - cancel: `run_id, session_id, workspace_id`
  - stream/collect: `run_id, session_id, workspace_id`
- `_owned_handle` 역시 backend_id를 입력받거나 비교하지 않는다.
- R4의 run/session/workspace/backend 4축 및 cross-backend substitution 차단 요구를 충족하지 않는다.

### Important 2 — non-Mapping/string-key ingress가 fail-closed audit 계약을 충족하지 않음

- `{1:"integer-key", "1":"string-key"}`가 오류 없이 `{'1':'string-key'}`로 축약됐다.
- foreign Mapping iteration 예외는 `RuntimeError foreign mapping iteration`으로 raw 누출됐다.
- ToolRequest 생성 단계 예외이므로 Gateway denial audit exactly1도 생성되지 않는다.
- list 하나만 검사하는 현재 test로는 key collision, foreign Mapping, validator exception을 증명할 수 없다.

### Important 3 — 한 session의 revoke가 다른 session의 pending reservation을 제거함

- hostile sequence: session A/B grant → A reservation 생성 → B revoke → A authorize.
- 결과: `ToolGatewayRejected TOOL_PERMISSION_DENIED`.
- 원인: `ToolPermissionRegistry.revoke()`가 reservation의 session 소유권을 저장하지 않은 채 모든 `PENDING` reservation을 전역 삭제한다.
- 영향: per-session 격리가 깨지고 무관한 session이 다른 실행을 중단시킬 수 있다.

### Important 4 — cleanup failure가 RETAINED가 아니라 다시 ACTIVE가 됨

- `_abort_destroy()`는 `DISPOSING→ACTIVE`로 전환한다.
- deterministic probe 결과: `CLEANUP_FAILURE_STATE ACTIVE WORKSPACE_REF_ALLOWED ws-1`.
- 영향: partial cleanup 뒤 손상되거나 일부 삭제된 workspace에서 새 read를 허용할 수 있으며 R4의 failure-state `RETAINED`와 직접 충돌한다.

### Important 5 — malformed backend output이 FAILED receipt로 닫히지 않음

- hostile output `{"bad":1}` 결과:
  - exception code: `OUTPUT_SCHEMA_INVALID`
  - audit status: `DENIED`
  - `terminal_receipt_sha256=None`
- backend handle은 이미 `SUCCEEDED`이고 Gateway는 이를 FAILED handle/receipt로 치환하지 않는다.
- R4의 "output schema 검증 후에만 SUCCEEDED, malformed output은 FAILED receipt/audit" 계약을 위반한다.

### Important 6 — canonical terminal receipt 필드와 terminal 연결이 불완전함

- `ExecutionReceipt`에는 traversal limits, masked fields, `error_sha256`가 없다.
- `requested_at`에는 실제 request ingress 시각이 아니라 `started_at`이 중복 기록된다.
- Gateway 선행 denial과 output-schema denial에는 execution terminal receipt가 없다.
- 따라서 모든 terminal에서 handle/event/artifact/ToolAudit가 동일 canonical receipt를 참조한다는 계약이 성립하지 않는다.

### Important 7 — repo.symbols에 cumulative read-byte bound가 없음

- synthetic `_iter_files`가 같은 1MB Python file을 17회 제공하도록 하고 `max_output_bytes=1`로 실행했다.
- 결과: `SYMBOLS_CUMULATIVE_BYTES 17000000 RESULT_LEN 0`, 예외 없음.
- output row cap만 있고 누적 file bytes cap이 없어 무출력 대형 저장소를 제한 없이 읽는다.

### Important 8 — Docker orphan evidence와 recovery authority가 불완전함

- public orphan evidence fields는 `workspace_id`, `container_id`, `expected_name`, `expected_image`, `daemon_endpoint_sha256`, `state`, `error_code`, `receipt_sha256`뿐이다.
- required observed labels/inspect mismatch, cleanup attempt/result, residue가 없다.
- expired authorization이며 `run_id=attacker-run`인 receipt가 authority 단계에서 거부되지 않고 실제 recovery filesystem 조작 단계까지 진입했다. 최종 결과는 prepare 실패 중 이미 삭제된 root 때문에 `FileNotFoundError`였으며 expiry/run mismatch 차단은 발생하지 않았다.
- 영향: immutable recovery evidence가 부족하고 stale/cross-run cleanup authority가 소비된다.

### Minor 1 — 완료보고와 physical hostile coverage가 실제 상태보다 강함

- 완료보고는 13축 구현 완료를 선언하지만 위 residual이 남았다.
- 독립 temp probe에서 Windows actual short path를 `GetShortPathNameW`로 조회한 결과 long/short path의 canonical conflict key는 동일해 actual 8.3은 `PASS`였다.
- 그러나 정식 test는 lexical `PROGRA~1/..` 예제를 계속 PASS시키며 broken link, safe missing leaf, actual 8.3 availability/skip을 고정하지 않는다.
- 따라서 physical hostile cluster 전체 closure 주장은 불충분하다.

## takeover 결론

본 spec review는 동일 C-09 product snapshot의 third valid review cycle에서 `REWORK_REQUIRED`를 확정한다. epoch3 Developer를 중지하고 write lease → worker lease 회수, TakeoverPacket 작성 후 Main Agent가 순차 인수해야 한다. Critical 두 건을 먼저 처리하고 owner 4축 → ingress audit → per-session reservation → RETAINED state fence → FAILED output receipt → cumulative bounds → orphan authority 순으로 수정한다.
