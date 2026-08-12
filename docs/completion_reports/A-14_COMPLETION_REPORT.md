# A-14 Developer Completion Report

- result: `COMPLETED`
- package: `A-14`
- baseline: `38832955f475746c842c40433566309f989b4b64`
- dispatch HEAD: `39a7bcce246db2f33d9ac7d02c81e0d4a11892d8` (`main = origin/main`, A-14 Main start projection)
- WorkInstruction: `WI-A-14-20260812-001` / `10421A71394CDC3903EF9BB03D1EDDECB1CA6240219F9E992AA5971D9B1E5F38`
- fencing: execution `a14-execution-fence-epoch-1-3883295`; write `a14-write-fence-epoch-1-3883295`

## 변경과 기존 기능 유지

Developer exact 17 paths에 dependency-free Workbench/BFF, unit/runtime/tooling tests, fixture·계약·검증·evidence 문서를 추가했다. `packages/repository_intelligence/**`, G-06 fixture, root dependency/config, authority/progress/HANDOFF는 수정하지 않았다. A-13 adapter는 disposable fixture에 서버측으로만 호출한다.

## 실행 증거

- Node RED: exit 1, missing implementation 2/2 fail.
- Node GREEN: exit 0, 6/6 pass.
- Python RED: exit 1, missing artifact로 1 pass/2 fail/1 error.
- Python GREEN: exit 0, 4/4 pass. Standalone checker: exit 0, exact 17 paths/self-reference false.
- Full tooling: 268 tests, 260 pass/8 fail. A-13 predecessor evidence 3건은 uncommitted A-14 successor를 허용하지 않아 실패했고, progress 5건은 모두 `GIT_DESCENDANT_WORKTREE_DIRTY`였다. A-14 자체 4건은 PASS했다.

## 미실행과 잔여 위험

실제 GUI browser 클릭/Network 캡처, Production API/DB/SSE, 실제 Provider/Secret/Egress, 사용자 repository, WSL/ysna, 배포, DIR은 `NOT_EXECUTED`다. Node HTTP runtime은 fixture BFF 요청만 증명하며 L7 사용성 및 실제 E-NET 판정은 독립 browser 검증이 필요하다. root package의 module type 경고는 allowlist 밖 설정을 임의 변경하지 않아 유지했다. Full tooling 8건은 Main이 Developer exact projection을 동결하고 predecessor/progress successor를 투영한 뒤 재검증해야 한다.

## 롤백·통합

rollback은 A-14 exact 17 paths를 제거하는 것이다. Developer는 Git commit/push와 progress/HANDOFF 갱신을 수행하지 않았다. Main Agent가 evidence 검토와 독립 검증 후 진행 상태를 투영한다.


## Revision 2 Developer result

Status: `COMPLETED_PENDING_INDEPENDENT_RETEST`. BLK-A14-002 clean-checkout successor validation is GREEN in the A-13/A-14 targeted suites; A-14 product paths remain unchanged. Actual in-app browser remains `ENVIRONMENT_BLOCKED / NOT_EXECUTED` after two ACL-helper failures. Full tooling is not PASS until Main synchronizes the allowed-path/hash projection and reruns all 268 tests.

Changed by Developer revision 2: `scripts/check_a13_repository_scan.py`, `tests/tooling/test_a13_repository_scan.py`, `docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json`, this report, and the A-14 validation report. Rollback is removal/reversion of only those revision-2 changes; commit, push, deployment and progress mutation were not performed.

## Revision 3 Developer result

- status: `COMPLETED_PENDING_INDEPENDENT_RETEST`
- baseline/dispatch: `d4e08549814dd0478f338ef83d1173663819f719` (`main = origin/main`)
- WorkInstruction: `WI-A-14-20260813-003` / `EA5C9CBB8D9A8107D5EE4845B578D995C3F4EA77017CBDDE7952DC8212E5896C`
- fencing: execution `a14-rework-execution-fence-epoch-3-4d6b813`; write `a14-rework-write-fence-epoch-3-4d6b813`

`BLK-A14-002`는 R3 exact live successor를 phase-aware하게 선택하도록 수정했고 clean-clone/tamper 회귀를 유지했다. fixture 변경과 새 scan 시작은 이전 scan/evidence/provider를 초기화하며 `BLOCKED/ERROR/PERMISSION_DENIED`에서 provider 선택을 해제한다. `EMPTY/QUOTA/CANCEL/RECONNECT`는 명시적인 fixture UI action으로 도달하되 모두 `countsAsPass=false`, `FIXTURE_BROWSER_RUNTIME_ONLY`다.

TDD 증거는 UI RED exit 1 → Node GREEN `8/8`, A-13 successor RED `28 total / 24 PASS / 4 FAIL` → targeted GREEN `29/29`이다. A-13/A-14/G-07/Phase G standalone은 exit 0이다. project checker는 exit 1 (`GIT_DESCENDANT_WORKTREE_DIRTY`, `PRG_REFERENCED_HASH_MISMATCH`), full tooling은 `271 total / 266 PASS / 5 FAIL / 0 SKIP`이며 5건 모두 그 Main-owned projection 동기화 원인이다. 이를 PASS로 승격하지 않는다. 실제 in-app browser/Network/console은 Developer가 실행하지 않았고 독립 Tester 재검증 대상이다. production API/DB/SSE, 실제 Provider/Secret/Egress, user repository, WSL/ysna, deploy, DIR은 `NOT_EXECUTED`다. coverage 전용 runner는 없어 `NOT_EXECUTED`다.

shell local clock과 canonical lease timestamp의 차이는 `LOCAL_CLOCK_SKEW`로 기록한다. 설계서 §49.5 PostgreSQL UTC 계약과 Main 판정에 따라 epoch-3 lease를 사용했으며 시스템 시각은 변경하지 않았다. rollback은 Revision 3 exact changed paths만 이전 commit으로 되돌리는 것이다. Developer는 progress/HANDOFF/events/ledger, commit, push, deploy, DIR, A-15를 수행하지 않았다.
