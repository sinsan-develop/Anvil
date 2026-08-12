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
