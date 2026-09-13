# C-09 R3 corrective WorkInstruction

WI-C-09-EXECUTION-BACKENDS-R3. 담당 developer-primary.
MAIN_RECONFIRMED_NON_SEMANTIC_CORRECTIVE_REWORK. 기능/요구/중요위험 변경 UNCHANGED.
R2 구현의 결함을 기존 승인 범위에서 바로잡는다. C-10 raw exec.run/임의 shell/patch/write/risk/egress/Secret 정책, 신규 backend/API/persistence는 추가하지 않는다.
부모 승인 APPROVAL-20260814-WORKPLAN-V16-001 / 3DFC292FA2F3A312B64EC8B14B991977643E7FE0F2E39889C8219EE3E9F6C236.
불변 R2 시작 commit 3720675f746cc0ca6a885a3c37bddf5cc4fc82a1, 부모/main 08aae12fdc4f8bd2d38b455f23408796ab4b8c82.
branch codex/c09-execution-backends-r1, upstream development/main, remote git@github-sinsan-develop:sinsan-develop/Anvil.git.
R2 WI/prompt/manifest/report/digest/validation과 seq1~798은 보존한다. R3 control commit은 R2의 sole direct child여야 하며 제품 작업은 그 commit 뒤 시작한다.

## 검증 및 권한

R2의 상위 설계/계획/matrix/test/governance/parent approval hash와 direct AV-SAFE-010 L3, AV-SAFE-011 L5, AV-STAT-021 L5를 유지한다.
AV-SAFE-028은 carry-forward 회귀다. 기존 C3/I7 계약을 유지하고 아래13 corrective cluster(제품결함12+pytest 배치1)를 모두 닫는다.
기존 제품 dirty18은 control 작성 중 byte-frozen이다. 제품 developer의 첫 mutation은 untracked tests/tool_gateway/test_registry.py를 tests/tool_gateway/test_tool_registry.py로 이름만 이동한다.
git mv로 stage하지 않는다. 이후 old path 존재를 거부하며 revised exact18 이외 쓰기는 금지한다.
제품 exact18 path hash AC308DAC4396006ABA4FFD3CCDB44FA90063F787C88EAA9F7E6B86E541D0887F.
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
worker worker-lease-c09-execution-backends-r3-20260914-002, epoch2, execution token c09-execution-backends-r3-execution-fence-epoch-2-6d9237f84bc14ea0.
write write-lease-c09-execution-backends-r3-20260914-002, epoch2, write token c09-execution-backends-r3-write-fence-epoch-2-e15c7a03926b4fd8.
issued 2026-09-14T03:00:00+09:00; expires 2026-09-14T15:00:00+09:00. R2 epoch1은 REVOKED이며 재활성화하지 않는다.
최신 control direct-child HEAD/branch/status/dual token/만료를 검증한다. 기능/요구/중요위험 UNCHANGED이며 internal basename correction은 새 권한이 아니다.

## 4. R3 WI에 결박할 고유 corrective finding 13개

두 review의 중복을 합치되 어느 finding도 탈락시키지 않는다.

1. `C09-R3-SCOPE-ADMISSION`: target scopes를 WorkspaceRef/WorkspaceGrant에 보존하고 path-bearing 도구를 IO 직전에 canonicalize한다. read_file뿐 아니라 status/search/symbols/diff의 scope 의미를 exact하게 정의하며 out-of-scope, ambiguous, reparse를 denial audit와 IO0로 차단한다.
2. `C09-R3-OPAQUE-ID-OWNED-CONTAINMENT`: workspace/container/request/handle/artifact ID를 strict opaque identifier로 제한한다. 계산된 경로는 resolve 후 managed root containment를 검증하여 absolute, `..`, separator, device/UNC escape를 IO 전에 거부한다.
3. `C09-R3-DOCKER-TRUSTED-MOUNT-OWNERSHIP`: backend-owned isolated workspace와 workspace/backend-bound exact mount table만 허용한다. source root, host root/socket/device/privileged, extra/duplicate/nested/ambiguous mount를 금지하고 remove 직전 container ID/name/label/endpoint ownership을 재검증한다.
4. `C09-R3-DOCKER-RUNNABLE-STATE-MACHINE`: concrete driver는 create→inspect→start→inspect(running)→exec의 실행 가능한 상태전이를 갖는다. cancel/destroy는 owned stop/remove만 수행하며 stateful fake가 stopped-container exec를 실제로 실패시킨다. actual Docker daemon은 계속 `NOT_EXECUTED`다.
5. `C09-R3-TERMINAL-LIFECYCLE-AUDIT`: IO 전에 PENDING/RUNNING handle 및 STARTED event를 등록한다. success, blocked, failure, timeout, cancel 각각 정확히 하나의 terminal event/receipt를 만들고 TimeoutError, TimeoutExpired, OSError 및 runner exception을 stable reason code로 정규화한다. Gateway도 모든 denial/failure/success audit를 남긴다.
6. `C09-R3-CANONICAL-TOOL-SCHEMA`: 다섯 read tool의 provider/version/input schema/output schema/capability/side-effect/risk/backend tuple을 canonical constant로 결박한다. exact required/allowed keys, type, bound, `additionalProperties=false`, output contract를 dispatch/return에 검증하고 registry drift를 거부한다.
7. `C09-R3-RETENTION-DISPOSAL-AUTHORITY`: cancel은 완료 결과를 덮지 않고 멱등이며 신규 dispatch를 막고 artifact 수집 후 기본 24시간 보존한다. destroy는 trusted issuer/fencing token 또는 기존 승인된 disposal authority, authority scope/expiry/hash, active-handle 0, retention expiry 또는 explicit override, protected artifact disposition, exact ownership을 모두 검증한다. caller reason만으로 즉시 삭제하지 않는다.
8. `C09-R3-PREPARE-IDEMPOTENCY-MANIFEST`: canonical prepare payload hash에 repository identity, baseline commit, verified baseline manifest hash, target scopes, mapping revision/mount table, retention, backend trusted config를 포함한다. exact replay만 기존 ref를 반환하며 어떤 drift도 idempotency conflict다. manifest hash는 형식뿐 아니라 public evidence와 대조하고 WorkspaceRef/Grant/receipt/audit에 전달한다.
9. `C09-R3-REAL-ARTIFACT-LIFECYCLE`: ArtifactRef는 atomic write된 backend-owned immutable object 또는 명시적 inline artifact만 가리킨다. collect는 run/session/workspace/handle ownership과 existence/hash/size를 재검증하고 실제 artifact가 없으면 빈 목록을 반환한다. destroy/cancel은 artifact disposition을 사실대로 보존한다.
10. `C09-R3-GIT-CONFIG-BOUNDS`: managed root가 source/common-dir과 겹치면 생성 전에 거부한다. trusted minimal config, global/system null, hooks/filter/textconv/external diff 차단, fixed read argv/cwd/env를 강제한다. search/symbols는 monotonic deadline, visited files/bytes/rows, per-file read 및 incremental encoded-output cap을 실행 중 적용한다.
11. `C09-R3-PHYSICAL-PATH-GUARD`: container lexical mapping과 host physical identity를 분리한다. root부터 leaf까지 no-follow/lstat 및 Windows reparse attribute를 검사하고 handle-open 후 identity/containment를 재검증한다. nested junction/symlink, broken link, missing leaf, replacement race, 실제 가능한 8.3 alias, duplicate/nested mapping을 hostile test로 고정한다. B-09 legacy adapter는 보존한다.
12. `C09-R3-C13-REVOKE-FENCE`: 동일 C-13 ToolPermissionRegistry 인스턴스와 trusted session_id를 사용한다. grant generation 또는 atomic reservation을 IO 직전 소비하고 revoke가 미소비 reservation을 무효화하여 require 성공 뒤 pause/revoke/resume에서도 backend IO0, denial audit1을 보장한다. caller run_id와 replay로 우회하지 못한다.
13. `C09-R3-PYTEST-BASENAME`: `test_tool_registry.py`로 치환하고 권위 exact suite를 `--import-mode=importlib` 없이 그대로 수집·PASS시킨다. importlib flag는 보조 검증으로만 허용하고 완료 증거를 대체하지 않는다.

완료보고는 위 13개 cluster별 RED→GREEN 명령/exit/result를 기록하고 actual Docker/WSL/DB/API/UI/browser/Provider/Telegram/network/deploy/Secret은 실행하지 않았으면 그대로 `NOT_EXECUTED/NOT_ACCESSED`로 둔다.

## 정확한 재검증

- python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py
- python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py
- python -B -m compileall -q packages/paths packages/execution_backends packages/tool_gateway tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- git diff --check

권위 exact suite에 --import-mode=importlib을 붙인 결과를 대체 증거로 사용하지 않는다.
13개 cluster별 focused RED→GREEN과 AT-1~5 위반시도→정확한 차단→immutable audit, 최소2 우회/IO0을 기록한다.
concurrency barrier require→pause→revoke→resume, source/common-dir zero-delta, scope 밖5개 read, nested junction/symlink/broken/missing/replacement/실제 가능한8.3, ID escape, baseline manifest replay drift, retention/authority/artifact tamper, timeout/OSError, schema drift, stateful Docker fake, Git global/filter 차단, incremental search/symbol budget를 확인한다.
실제 local Git은 D:/tmp의 owned 격리 QA fixture에만 허용하고 exact cleanup/잔류0을 기록한다.
Docker concrete driver는 stateful injected fake로 검증한다. actual Docker daemon/CLI, WSL, DB/API/UI/browser, Provider/Telegram, network/SSH/deploy/Secret은 NOT_EXECUTED/NOT_ACCESSED다.
C13 public ToolPermissionRegistry는 기존 인스턴스/session_id/import/grant/require/revoke/active 계약을 보존한다.
증거를 과장한 R2 completion을 새 실제 evidence에 맞춰 정정한다. 독립 Reviewer blocking0과 현재 EvidenceManifest 전 ACCEPTED를 주장하지 않는다.

## 결과 및 중단

판정→이유→조치, COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED로 반환한다.
정확한 명령/exit/hash/bytes/변경경로/미검증/잔여위험/rollback을 docs/04_test_reports/C-09_COMPLETION_REPORT.md에 기록한다.
두 review는 동일 snapshot 판정이므로 product review failure1/rework1로만 집계한다. 허위 FAILURE_REPORT_ACCEPTED나 제품 commit을 기록하지 않는다.
제품 범위 밖 수정 필요는 SCOPE_EXPANSION_REQUIRED, DIR-2 이전 계속 조건과 C-10 NOT_READY를 유지한다.
commit/push/PR/merge/배포는 수행하지 않는다.
control commit 뒤 seq799~806을 rewrite/revert하지 않는다. 중단은 별도 append-only successor에서 epoch2 write→worker revoke하고 실제 INCOMPLETE/BLOCKED/CANCELLED를 기록한다.
제품 rollback은 active lease revoke 및 successor 기록 뒤 정확한 product commit 정상 revert. dirty 제품은 reset/clean/stash/delete하지 않는다.
stateless CLI는 현재 상태만 판정한다. 단방향 transition은 caller의 trusted previous_mode가 revised로 기록된 경우 old18 복귀를 차단하며 영속 dispatch 관측을 주장하지 않는다.
