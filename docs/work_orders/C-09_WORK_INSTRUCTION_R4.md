# C-09 R4 epoch3 corrective WorkInstruction

WI-C-09-EXECUTION-BACKENDS-R4. 담당 developer-primary.
MAIN_RECONFIRMED_NON_SEMANTIC_CORRECTIVE_REWORK_R4. 기능/요구사항/중요위험 UNCHANGED.
신규 backend/tool/API/persistence/egress/Secret/운영 authority를 추가하지 않는다. C10 일반 exec.run/raw shell/patch/write/risk/egress/Secret 정책은 제외한다.
부모 승인 APPROVAL-20260814-WORKPLAN-V16-001 / 3DFC292FA2F3A312B64EC8B14B991977643E7FE0F2E39889C8219EE3E9F6C236.
R3 HEAD 74f9878de521a6bc5a2c4f5165332c76edfc1354, sole parent R2 3720675f746cc0ca6a885a3c37bddf5cc4fc82a1.
branch codex/c09-execution-backends-r1; upstream development/main; remote git@github-sinsan-develop:sinsan-develop/Anvil.git; main 08aae12fdc4f8bd2d38b455f23408796ab4b8c82.
R2/R3 WI·prompt·manifest·report·validation·digest 및 seq1~806은 byte-immutable이다.
R4 control은 R3의 sole direct child이어야 한다. product dirty18은 control 작성 및 pre-dispatch 동안 frozen R3 bytes/index 그대로 보존한다.

## 승인·lease·완료 경계

AV-SAFE-010 L3 / AV-SAFE-011 L5 / AV-STAT-021 L5; AV-SAFE-028 carry-forward 회귀를 유지한다.
설계 baseline DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3과 상위 계획/matrix/test/governance hash는 변경하지 않는다.
spec R3 C1/I7/M1 / 9F580EACDFEFDFD41A68AD5D06AB1E5E230DA10BCB24046FF1A7D3416CB45B63.
quality R3 round2 C3/I6/M0 / 7735526AF31614D04A2382395A8653183FEA9BBFC7CE834CB667081A27169A88.
동일 snapshot 두 review를 중복 집계하지 않는다. product valid_failure_count=2, same_failure_count=2, rework_attempt=2, formal FAILURE_REPORT0.
다음 같은 C09 lineage의 유효 REWORK_REQUIRED/FAILURE_REPORT가 확정되면 valid failure3: MAIN_TAKEOVER_AT_3.
즉시 Developer 중지→epoch3 write→worker lease 회수→TakeoverPacket→Main 순차 인수. 같은 Developer에게 R5를 발행하지 않는다.
worker worker-lease-c09-execution-backends-r4-20260914-003 / epoch3 / c09-execution-backends-r4-execution-fence-epoch-3-a84e19276fc34db5.
write write-lease-c09-execution-backends-r4-20260914-003 / epoch3 / c09-execution-backends-r4-write-fence-epoch-3-3c91b6e5087a4fd2.
issued 2026-09-14T05:00:00+09:00; expires 2026-09-14T17:00:00+09:00. 두 token과 baseline/HEAD/branch/status/만료 모두 확인한다. epoch2는 REVOKED이며 재활성화 금지.
product exact18/hash AC308DAC4396006ABA4FFD3CCDB44FA90063F787C88EAA9F7E6B86E541D0887F:
- docs/04_test_reports/C-09_COMPLETION_REPORT.md
- packages/execution_backends/__init__.py
- packages/execution_backends/docker.py
- packages/execution_backends/git_worktree.py
- packages/execution_backends/models.py
- packages/execution_backends/registry.py
- packages/paths/identity.py
- packages/tool_gateway/__init__.py
- packages/tool_gateway/gateway.py
- packages/tool_gateway/models.py
- packages/tool_gateway/registry.py
- tests/execution_backends/test_docker.py
- tests/execution_backends/test_git_worktree.py
- tests/execution_backends/test_registry.py
- tests/integration/test_c09_repository_workspace.py
- tests/paths/test_conflict_scope_identity.py
- tests/tool_gateway/test_gateway.py
- tests/tool_gateway/test_tool_registry.py

## 고유 corrective 13축
1. `C09-R4-DOCKER-READ-AUTHORITY-ENVELOPE`: Docker helper 입력을 canonical envelope로 고정한다. repository_id, approved baseline commit, trusted manifest evidence hash, canonical target scopes, operation, validated arguments, timeout/output/traversal limits를 포함하고 helper가 모든 다섯 operation에서 scope를 적용한다. mount 내부 out-of-scope 데이터는 helper IO 전에 거부하고 zero disclosure를 증명한다.
2. `C09-R4-ATOMIC-IDEMPOTENCY-SINGLE-IO`: replay lookup, canonical payload conflict, request/handle ID uniqueness, RUNNING registration과 winner IO authority 발급을 하나의 lock transaction으로 원자화한다. 동일 key/payload loser는 terminal을 기다려 같은 immutable receipt를 반환하며 신규 IO0, 다른 payload/같은 request ID 충돌은 fail-closed한다.
3. `C09-R4-FULL-OWNER-IDENTITY`: public cancel/stream/collect 및 handle lookup은 run_id+session_id+workspace_id+backend_id 전체를 요구한다. 제공된 각 identity를 독립 비교하며 missing/partial/wrong/cross-backend substitution을 IO0 `HANDLE_OWNERSHIP_MISMATCH`로 거부한다.
4. `C09-R4-DOCKER-PER-HANDLE-CANCEL`: 한 handle 취소가 shared workspace container를 stop하지 않는다. exec별 owned control/process ID로 그 실행만 graceful cancel하거나, 단일-active admission과 verified container recovery를 계약으로 명시한다. 두 concurrent handles 중 하나 cancel 후 다른 handle과 새 read가 정상이어야 한다.
5. `C09-R4-CANONICAL-TERMINAL-RECEIPT-AUDIT`: 모든 terminal status는 immutable canonical receipt와 SHA-256을 가진다. run/session/workspace/backend/repository/tool/path/scopes, correlation/idempotency, baseline+manifest, requested/started/completed, timeout/output/traversal limits, masked fields, result/error digest를 포함한다. handle/event/artifact/ToolAudit가 같은 receipt를 참조하며 replay도 동일 bytes를 반환한다.
6. `C09-R4-EARLY-CUMULATIVE-BOUNDS`: subprocess stdout/stderr를 streaming hard cap으로 제한하고 status/diff/search/symbols 모두 공통 monotonic deadline 및 visited files/bytes/rows/incremental encoded-output cap을 처리 중 적용한다. cap+1에서 추가 traversal/read/match/row 생성 없이 즉시 하나의 limit terminal receipt/audit로 종료한다.
7. `C09-R4-TRUSTED-MANIFEST-EVIDENCE`: caller가 `verified_*` 문자열을 self-assert하지 못한다. public manifest bytes와 approved baseline commit을 검증하는 trusted verifier/evidence object가 digest를 산출하며 prepare payload, WorkspaceRef/Grant, Docker envelope, receipt/audit에 동일 hash를 결박한다. 임의 hash, missing bytes, commit mismatch, replay drift를 IO 전에 거부한다.
8. `C09-R4-NONMAPPING-INPUT-AUDIT`: ToolRequest arguments는 ingress에서 string-key Mapping만 수용한다. list/tuple/scalar/foreign malformed Mapping, key collision, validator exception은 모두 안정된 `TOOL_SCHEMA_INVALID` denial audit exactly1/backend IO0로 변환하며 raw AttributeError를 누출하지 않는다.
9. `C09-R4-PER-SESSION-PERMISSION-RESERVATION`: registry global lock을 long backend IO 동안 잡지 않는다. per-session generation/reservation token을 짧은 critical section에서 발급하고 backend `_mark_io` 직전에 atomic consume한다. revoke-before-IO는 stale token/queued/replay IO0을 보장하면서 session A slow IO가 session B grant/revoke를 지연시키지 않는다.
10. `C09-R4-WORKSPACE-STATE-FENCE`: workspace state를 `ACTIVE→DISPOSING→DESTROYED` 또는 cleanup failure 시 `RETAINED`로 lock 아래 전환한다. destroy authority/active0 검사와 상태 전환을 원자화하고 `_workspace_for/_begin/execute`는 ACTIVE만 허용한다. authorize→execute barrier에서 신규 handle/IO0을 증명한다.
11. `C09-R4-OUTPUT-SCHEMA-VALIDATION`: backend bounded result envelope를 gateway receipt에 연결한다. canonical ToolDefinition output schema를 실제 result에 검증한 뒤에만 SUCCEEDED terminal audit/receipt를 발급하고 malformed/oversized/missing output은 FAILED receipt/audit로 닫는다.
12. `C09-R4-DOCKER-DIGEST-ORPHAN-EVIDENCE`: image digest를 exact 64 lowercase/normalized hex로 검증한다. prepare partial failure는 endpoint/container ID/name/labels/inspect mismatch/cleanup attempt/residue를 담은 immutable public read-only orphan evidence로 노출하고 trusted cleanup authority 경로와 연결한다. private map만으로 완료하지 않는다.
13. `C09-R4-PHYSICAL-HOSTILE-COVERAGE`: broken link, missing leaf, component replacement race, actual available Windows 8.3 short path, junction/symlink ancestor, handle-open 후 identity change, duplicate/nested/ambiguous mapping registry를 hostile tests로 고정한다. 실제 8.3 기능이 host에서 비활성인 경우 명확히 SKIPPED하고 lexical `PROGRA~1` 흉내를 PASS로 승격하지 않는다.

R3에서 이미 닫힌 source/common-dir zero mutation, opaque ID/managed containment, retention/disposal 기본 계약, Docker create/start/inspect/exact mounts, canonical tool registration, pytest basename, B-09 adapter는 회귀 검증으로 유지한다.

## 정확한 재검증

- python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py
- python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py
- python -B -m compileall -q packages/paths packages/execution_backends packages/tool_gateway tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- git diff --check

13축별 focused hostile RED→GREEN 명령/exit/result를 기록한다. Docker envelope 모든5도구 scope/out-of-scope IO0, concurrent same-key IO1/동일 immutable receipt와 different payload/request ID 충돌, full owner4축 missing/partial/cross-backend, 두 handle cancel 격리/new read, 모든 terminal canonical receipt/audit hash, cap+1 early stop, trusted manifest bytes/commit/replay, malformed Mapping audit1/IO0, session A slow IO중 B permission latency/stale token IO0, destroy→execute barrier/new IO0, malformed output schema, hex digest/public orphan recovery, physical hostile matrix를 모두 재검증한다.
원본 Git source/common-dir zero mutation, managed containment/opaque ID, retention24h와 trusted disposal authority, Docker create→inspect→start→inspect/exact owned mounts, canonical registry, B09 legacy, C13 동일 ToolPermissionRegistry 인스턴스/session_id, pytest basename 유지 회귀를 포함한다.
실제 가능한 Windows8.3를 조회하되 기능 비활성은 SKIPPED로 기록한다. lexical PROGRA~1 예제를 actual8.3 PASS로 주장하지 않는다.
local owned Git fixture와 stateful Docker fake만 허용하며 fixture 사전 기록·수명·cleanup/잔류0을 기록한다. actual Docker daemon/WSL/DB/API/UI/browser/Provider/Telegram/network/deploy/Secret은 NOT_EXECUTED/NOT_ACCESSED.
추가 --import-mode=importlib로 authoritative suite를 대체하지 않는다. 완료보고를 실제 residual/검증 결과에 맞춰 수정하고 ACCEPTED를 선행 주장하지 않는다.

## 실행·결과·rollback

개발자는 수정 전 FROZEN_R3, epoch3 수정 후 ACTIVE_R4 checker mode를 명시한다:
python -B scripts/check_project_progress.py --c09-r4-mode=FROZEN_R3
python -B scripts/check_project_progress.py --c09-r4-mode=ACTIVE_R4
clean fresh-clone 검증은 detached R4 control commit에서 --c09-r4-mode=DETACHED_CONTROL로만 허용한다.
stateless CLI는 과거 관측을 영속화하지 않는다. trusted previous_mode가 ACTIVE_R4인 경우 FROZEN_R3 역전은 거부한다.
control out-of-scope 수정, product stage/commit/push/PR/merge/외부 실행 금지. scope 밖 필요는 증거와 함께 Main으로 반환한다.
C09 REWORK_IN_PROGRESS/C10 NOT_READY/DIR2 NOT_REACHED 유지. 판정→이유→조치, COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED 결과 계약.
completion report에13축별 exact command/exit/hash/bytes/미검증/잔여위험/rollback을 기록한다.
control commit 전 실패는 frozen18을 먼저 검증하고 Main 권한으로 control11만 unstage/복구한다. 제품 reset/clean/stash/checkout/delete 금지.
control commit 후 seq807~814/R4 artifacts rewrite/revert 금지. successor에서 epoch3 write→worker revoke 후 실제 중단 상태를 기록한다.
제품 실패 dirty/artifact 보존. 안전한 product commit 뒤 rollback은 lease 회수/successor 뒤 해당 product commit 정상 revert뿐이다.
