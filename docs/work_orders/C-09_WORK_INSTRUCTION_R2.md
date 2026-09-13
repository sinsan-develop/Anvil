# C-09 R2 WorkInstruction — 실행 백엔드·경로 identity·read Tool Gateway

판정: 승인된 상위 범위 복원. WI-C-09-EXECUTION-BACKENDS-R2의 executor는 developer-primary다.
C-08은 seq795 ACCEPTED이며 dispatch 기준은 08aae12fdc4f8bd2d38b455f23408796ab4b8c82, branch codex/c09-execution-backends-r1, upstream development/main이다.
부모 승인은 APPROVAL-20260814-WORKPLAN-V16-001 / 3DFC292FA2F3A312B64EC8B14B991977643E7FE0F2E39889C8219EE3E9F6C236이다.
분류는 MAIN_RECONFIRMED_NON_SEMANTIC_SCOPE_RESTORATION, function_scope_change/requirements_change/material_risk_change 모두 UNCHANGED다.
역사 docs/work_orders/C-09_WORK_INSTRUCTION.md / A429119206BB2C42F0D6FE9AD45E674E1891142C72007FA4972DC091BFC9CFD8은 수정하지 않고 superseded 참고로 보존한다.
하위 observe-only 지시가 승인된 C-09 backend 범위를 축소했으므로 R2를 활성 계약으로 사용한다.

## 권위와 선행

우선순위는 신산님 최신 지시 → 설계 → 작업계획 → 검증 matrix → 테스트계획 → 운영규칙 → 이 WI → progress다.

- Anvil_설계서_v2.md: DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3
- Anvil_작업계획서_v1.md: 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18
- Anvil_통합검증매트릭스_v1.md: 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5
- Anvil_테스트계획서_v1.md: 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644
- docs/governance/ANVIL_OPERATING_RULES.md: 4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E

C-08 product 8095981d33deef082fe646495a2cbc80841839c3 및 C-08_FINAL_ACCEPTANCE_MANIFEST.json을 현재 Main merge가 포함한다.
직접 검증 ID는 AV-SAFE-010(E-GIT/E-DIFF), AV-SAFE-011(E-GIT), AV-STAT-021(E-GIT/E-EVT)이다.
AV-SAFE-028은 predecessor 회귀/carry-forward이며 신규 책임 ID로 재배정하지 않는다.

## exact18 단일 writer

정렬 경로 hash: 57A7D45027FC24930F013C7EB0AB85B81B45E6A174B2DA9ADD90ECE95FA6F3D5.
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
- tests/tool_gateway/test_registry.py

두 ACTIVE lease의 actor/subject/baseline/epoch/token/만료와 exact scope를 시작 전에 확인한다.
worker: worker-lease-c09-execution-backends-r2-20260913-001; epoch 1.
execution token: c09-execution-backends-r2-execution-fence-epoch-1-8f2e6c91a74d4b3b.
write: write-lease-c09-execution-backends-r2-20260913-001; epoch 1.
write token: c09-execution-backends-r2-write-fence-epoch-1-c41d7a598e2b4f10.
발급 2026-09-14T02:00:00+09:00, 만료 2026-09-14T14:00:00+09:00. 기록 시각은 runtime action 시각이 아니다.
packages/repository_intelligence, leases, orchestration, api, persistence, action_policy, migrations, UI, deploy, dependency/lock 및 역사 evidence는 쓰기 비범위다.
범위 밖 변경이 필요하면 SCOPE_EXPANSION_REQUIRED로 Main에게 증거를 반환한다.

## 필수 completion contract — Critical 3

C-1. GitWorktreeExecutionBackend와 DockerExecutionBackend는 prepare_workspace, execute, stream_events, cancel, collect_artifacts, destroy_workspace의 공통 protocol을 실제 구현한다.
caller observations를 성공 receipt로 포장하거나 모든 execute를 UNSUPPORTED로 끝내는 구현은 미완료다.
C-2. RepositoryIdentity는 stable repository_id, canonical source root, explicit case policy, mapping revision을 분리한다.
conflict key는 (repository_id, canonical_repo_relative_path, repository_case_policy)이며 host path나 remote URL에서 ID를 즉석 생성하지 않는다.
C-3. 단일 Tool Gateway admission이 registry, session grant, workspace/backend owner, path 및 limits를 확인하고 성공/차단/실패 모두 immutable audit를 생성한다.

## 필수 completion contract — Important 7

I-1. execute는 registry-defined bounded read operation만 실제 수행한다.
repo.status, repo.search, repo.read_file, repo.symbols, git.diff 다섯 도구를 canonical registration으로 제공한다.
ExecutionRequest는 operation/검증된 인자/workspace identity이며 raw command authority가 아니다.
C-10의 exec.run, 임의 shell/argv, test/build/lint Action, patch/write Action, risk engine, egress 정책 및 Secret Broker는 등록/구현하지 않는다.
고정 argv의 read process와 lifecycle 내부 mutation은 이 제한과 구분한다.

I-2. 원본 Git common dir에 worktree metadata를 만들지 않는다.
source 밖 backend-owned managed Git store에 승인 baseline을 local-only로 materialize하고 그 store에서 isolated worktree를 생성한다.
source를 향하는 writable alternates/links/metadata 공유와 remote fetch/push/clone/network를 금지한다.
source root/HEAD/branch/porcelain/index/refs/config/locks/full inventory, managed store/workspace 경로, baseline, 생성 refs/resources와 cleanup 결과를 기록한다.
A-13 public scan_repository(ScanRequest(..., output_path=None)) 및 C-08 public 결과를 조합하며 private snapshot 복사·재구현을 하지 않는다.
action 전 scan의 post_snapshot_sha256과 action 후 scan의 pre_snapshot_sha256을 비교한다. scanner 자체 no-write와 backend action 보존 증거를 구분한다.
source writes=0, owned workspace lifecycle mutation, read Tool side_effect=none을 별도 기록한다.

I-3. cancel은 해당 handle의 신규 작업 차단/정상 종료/결과 확인과 artifact 수집을 수행하며 workspace/artifact를 기본 24시간 보존한다.
이미 종료된 결과를 CANCELLED로 덮지 않으며 중복 cancel은 멱등이다.
destroy는 별도 disposal authorization seam으로 소유권, 실행 handle 없음, 보존기간 만료 또는 기존 승인된 폐기 authority를 검증한 뒤 exact owned 자원만 정리한다.
새 destructive 승인 정책/UI는 만들지 않는다. 취소가 destroy를 자동 호출하지 않는다.
강제 종료 정책/소유 증거/폐기 authority 부족은 BLOCKED/RETAINED다.
timeout/cancel/prepare 실패의 orphan manifest, dirty 결과/미보존 artifact, cleanup 실패/잔류를 사실대로 보고한다.
temp QA teardown authority를 제품 자동 폐기로 확대하지 않는다.

I-4. WorkspaceSpec에는 승인 baseline commit/manifest, canonical target scopes와 RepositoryIdentity를 포함한다.
dirty 존재만으로 차단하지 않는다. 대상 scopes와 dirty/untracked overlap, file/directory 충돌 또는 baseline 변동이면 prepare 전에 BASELINE_CONFLICT와 USER_DECISION_REQUIRED event/projection을 생성한다.
projection은 run/workspace 요청 identity, expected/observed baseline hash, 충돌 canonical paths, 원본 보존 evidence ref를 가진다.
충돌 없는 dirty는 보존하면서 read/격리 prepare를 허용한다. 검사와 prepare 사이 baseline 변동도 차단한다.
실패 시 source stash/clean/checkout/patch, workspace create/destroy 0이다. UI/API/DB 구현 및 event 영속화를 주장하지 않는다.

I-5. C-13 takeover와 동일 ToolPermissionRegistry 인스턴스 및 trusted session_id 권한키를 공유한다.
caller run_id로 다른 grant를 사용하지 못하도록 workspace owner에 결박한다.
grant 교체 의미, require, 멱등 revoke 반환값, active 복사본 반환과 import 경로를 보존한다.
namespace/alias는 registration에만 명시하며 wildcard/암묵 grant/default registry를 만들지 않는다.
dispatch 직전 현재 grant와 identity를 다시 검사한다. revoke 직후 신규·대기 dispatch와 동일 idempotency replay의 신규 IO는 0, denial audit는 존재해야 한다.
활성 process 전체 강제 종료나 DB fencing 원자성을 C-09 PASS로 확대하지 않는다.

I-6. metadata의 network deny와 driver argv/inspect의 격리를 별도로 검증한다.
Git은 고정 read subcommand와 no external diff/textconv, 안전한 cwd/env, bounded output/time/resource를 강제하며 hooks/filter/config 실행 경로도 검사한다.
user-controlled executable/cwd/env, shell 문자열/shell=true, option/metacharacter injection, 외부 명령은 dispatch 전에 거부한다.
Docker endpoint/image digest/mount는 trusted config만 사용한다. network=none, pull=never, source mount 금지, read-only workspace mount와 bounded resources를 argv 및 inspect 결과에서 확인한다.
host root/socket/device/privileged mount, 상대/중복 mapping, 전체 host env, Secret/ref 및 임의 env 주입을 거부한다.
container ID 소유 검증 없이 list/prune/stop/remove하지 않는다. fake runner는 concrete driver가 생성한 argv와 상태전이를 검사한다.

I-7. WorkspaceRef는 stable repository ID와 source↔isolated worktree↔container mapping을 보유한다.
Docker mount table은 workspace_id/backend_id에 결박하고 임의 /workspace stripping, basename 비교, 중첩 root 모호 선택을 금지한다.
Windows drive/WSL /mnt/case/실제 symlink·junction/가능한 실제 8.3 alias/missing leaf의 deepest-existing-ancestor를 수렴시킨다.
lexical alias/.. 선처리로 물리 대상을 오인하지 말고 모호/escape/UNC/device/broken link/reparse를 fail-closed한다.
identity key 수렴과 read 접근 reparse 거부를 구분한다. lexical short-name 흉내/WSL 문자열 매핑을 실제 filesystem 검증으로 승격하지 않는다.
기존 B-09 conflict_scope_key(root_path, path, policy) 호출은 additive mapper로 보존하며 C-09 runtime은 stable-ID 경로를 사용한다.

## lifecycle·audit·artifact 추가 완료조건

prepare는 실제 owned workspace와 manifest를 생성하고 baseline/idempotency ID 충돌을 거부한다.
stream_events는 handle-bound 시작/실제 read 결과 또는 bounded stdout/stderr/종료의 순서와 단일 terminal event를 제공한다.
cross-run/backend handle·artifact·mapping 대체를 거부한다.
collect_artifacts는 실행이 실제 만든 output/diff/log만 immutable ArtifactRef/hash/size/media type으로 반환하며 빈 목록은 빈 목록으로 보고한다.
caller path 임의 수집, unknown/outside/special/reparse/oversize artifact를 거부한다.
모든 결과(success/blocked/failed/timeout/cancelled)는 run/workspace/backend/tool/path identity, idempotency, limits, masked fields, start/end, result/error, canonical JSON bytes/SHA-256을 가진다.
ingress deep-freeze로 caller dict/list 사후 mutation을 차단하고 NaN/non-JSON/secret-shaped/oversize input/output은 fail-closed한다.
새 실행은 새 ID/시각/receipt를 갖고 idempotency replay는 원 receipt를 반환한다. clock/ID는 결정적 테스트에 주입한다.
runner/process/control 객체는 serialization하지 않는다. JSON-safe 값이라는 이유로 C-04 영속복구 완료를 주장하지 않는다.
legacy list_files/metadata는 같은 admission 또는 명시적 trusted fixture adapter로 제한하여 우회 경로를 남기지 않는다.

## 실행·검증 경계

제품 구현 단계 local Git은 D:\tmp 아래 고유 owned fixture에만 init/add/commit/managed worktree lifecycle을 허용한다.
원본/remote 변경, fetch/pull/push/clone/network는 금지한다. temp 이름·수명·정리 계획을 기록하고 exact cleanup/잔류0을 증명한다.
Docker는 deterministic injected runner만 사용하며 실제 daemon/CLI/pull/build/install/network는 실행하지 않는다.
WSL은 pure 문자열/manifest mapping만 검증한다.
DB/API/UI/browser/Provider/Telegram/SSH/network/deploy/Secret은 NOT_EXECUTED/NOT_ACCESSED다.
mock/fake는 contract, temp Git은 local integration, 실제 daemon/WSL/운영은 NOT_EXECUTED로 구분한다.

TDD 후 다음을 실행한다.

- python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py
- python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py
- C-13 successor E2E registry 사용의 정확한 node를 read-only Impact Map으로 식별하여 회귀한다. lease 밖 test는 수정하지 않는다.
- python -B -m compileall -q packages/paths packages/execution_backends packages/tool_gateway tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py
- git diff --check

두 concrete backend에 같은 lifecycle contract suite를 적용하고 success/denial/failure/timeout/cancel/artifact/destroy를 검사한다.
AT-1~5: 각 L5는 위반 시도→정확한 blocked_code→immutable audit, 우회 최소2, dispatch0, 방어 부재 시 파괴되는 대상을 한 문장으로 기록한다.
source dirty/untracked/metadata zero-delta, 실제 junction/missing leaf/가능한 8.3, TOCTOU, bounded 5 read 도구, replay/revoke IO0 및 외부 IO sentinel을 포함한다.
제품 exact18 증거와 독립 Tester blocking0/current EvidenceManifest 전에는 C-09 ACCEPTED를 선언하지 않는다.

## 보고·rollback

결과는 COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED로 구분한다.
정확한 branch/HEAD/status/기준 hash, 변경 path/diff, 명령/exit code, RED/GREEN, 오류 lineage/count, 미실행/잔여위험, progress 갱신 여부를 docs/04_test_reports/C-09_COMPLETION_REPORT.md에 기록한다.
이 start-control은 제품 실행·제품 완료·외부 환경 성공이 아니다. C-10 NOT_READY, DIR-2 NOT_REACHED를 유지한다.
후속 commit 뒤 rollback은 해당 C-09 제품/control commit의 정상 git revert다. DB/migration/외부 rollback은 없다.
Developer는 commit/push/PR/merge를 수행하지 않고 결과를 Main에 반환한다.
