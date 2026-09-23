# E-06 WorkInstruction — 독립 worktree write와 dual fencing

## 권위와 목표

- WI-E-06-R1-20260917-001, developer-primary-e06-r1. Main 승인 product exact8/control exact9, 기존 E05 ACCEPTED/seq1109의 successor.
- HEAD `039c53acd6d79895d3c94e1bc21b72d1b54283f9`, branch `codex/c09-execution-backends-r1`; clean/local/upstream 확인. Main baseline handoff를 외부 runtime 실행 증거로 사용하지 않는다.
- 설계 §46.9·46.16-7·47.18-6·49.5·49.17-5~6, 계획 E06, AV-SAFE-023/028 및 AV-FLOW-006. 설계 SHA DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3; 계획 SHA 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18.

## exact write scope

제품8:

- packages/agent_team/__init__.py
- packages/agent_team/worktree_writes.py
- packages/leases/service.py
- packages/tool_gateway/gateway.py
- tests/agent_team/test_worktree_writes_e06.py
- tests/leases/test_repository_write_e06.py
- tests/tool_gateway/test_worktree_mutation_e06.py
- docs/04_test_reports/E-06_COMPLETION_REPORT.md

control9: 본 WI, docs/work_orders/E-06_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e06-start.json, docs/evidence/manifests/E-06_START_MANIFEST.json.

## 구현 계약과 순서

1. start control RED→GREEN: seq1110 WI,1111 worker lease,1112 write lease,1113 PACKAGE_STARTED. E06 IN_PROGRESS/E07 NOT_READY, pending0. checker는 hash anchored additive one-shot temp→AST/compile→allowed diff→replace; historical deletion0/prefix1..1109 보존.
2. LeaseService owner에 repository-wide canonical overlap 및 worktree 단일 owner acquisition을 additive 구현한다. RepositoryIdentity/RepositoryPathMapping을 재사용하고 run/workspace 차이로 같은 repo scope를 우회하지 못한다. alias normalization은 Windows/WSL/case/physical symlink/junction/8.3을 같은 key로 결박하고 해석 불가/escape는 거부한다. host-issued current worker와 write lease 둘 다 필요하다.
3. 실제 RED: 서로 다른 run/workspace의 same/parent-child scope contention 최소100회, same worktree disjoint scope 거부, 독립 worktree disjoint scope 성공, exact retry 및 stale token 거부. 정상 legacy lease/read 계약 회귀를 보존한다.
4. C09 GitWorktreeExecutionBackend가 materialize한 별도 store/worktree만 host가 WorktreeWriteService에 등록한다. baseline/repository/workspace/branch identity 및 canonical scope를 결박한다. host-only bounded 파일 write와 local commit만 제공; Tool Gateway는 current permission과 dual fencing을 mutation 직전 다시 검사한다. 제품 source tree, force/destructive/임의 git/merge/PR/push는 제공하지 않는다.
5. 파일 write·Git commit 직전 canonical lease/fence 및 changed paths를 다시 검사한다. A 만료/B 인수 뒤 tool/file/commit 모두 STALE_FENCING_TOKEN, filesystem/commit TOCTOU·out-of-scope dirty·baseline drift는 side effect 전에 차단한다. exact idempotent retry와 immutable receipt/개별 provenance를 제공한다. Main만 검증 뒤 순차 통합한다.
6. 실제 integration RED→GREEN은 workspace-local 고유 pytest basetemp의 synthetic source repo 및 C09 managed store/worktree를 사용한다. 실제 git/file 작업, contention, stale takeover, callback TOCTOU, original tree/common-dir mutation0을 검증한다. 수명은 테스트 invocation 동안이며 pytest teardown으로 정리하고 잔류 경계를 보고한다.
7. 기존 LeaseService의 in-memory lock/host-clock은 local contract evidence다. DB UTC/멀티프로세스 lease adapter는 NOT_INTEGRATED; 실제 Provider/HTTP/UI/remote/production은 NOT_EXECUTED. E07 failure policy/E08 budget/E10 general Git adapter를 구현하지 않는다.

## dual lease

- worker `worker-lease-e06-r1-20260917-001`, execution `e06-r1-execution-fence-epoch-1-039c53acd6d79895`
- write `write-lease-e06-r1-20260917-001`, write fence `e06-r1-write-fence-epoch-1-d3c94e1bc21b72d1`
- issued `2026-09-17T14:50:00+09:00`, expires `2026-09-18T02:50:00+09:00`. 발효 전 제품 mutation 금지.

## 검증·인계

각 behavior의 의도된 RED 후 최소 GREEN. focused 신규3 tests; tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends 관련 회귀; exact modules/tests compileall; git diff --check; canonical checker. 실제 writable basetemp를 명령에 명시한다. completion report는 판정→이유→조치, exact commands/exit/count/skip/미검증/원인/fingerprint/formal failure count/rollback을 기록한다. 복구는 Main이 scope diff를 보존한 후 역 patch로 수행한다. acceptance/lease revoke/commit/push/E07 시작·추가 agent 생성 금지.
