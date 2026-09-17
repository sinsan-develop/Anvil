# WI-E-10-R1-20260917-001

## 목적

승인된 E-10 범위에서 사용자 변경을 보존하는 Git branch·commit·merge·PR adapter와 append-only audit 계약을 구현한다. 실제 원격 push·PR 생성·merge는 이 Package에서 실행하지 않는다.

## 기준선과 선행조건

- branch: `codex/c09-execution-backends-r1`
- dispatch/base HEAD: `30ca8a2d5a8f856ee4d82ae4f47b47bc60109342`
- canonical progress: E-09 `ACCEPTED`, sequence 1156, E-10 `READY_FOR_WORK_INSTRUCTION`
- 권위: 설계서 §6.4, §7.4, §9~10, §30.4, §31.1~31.2, §49.10; 작업계획서 E-10; 테스트계획서; 통합검증매트릭스 AV-SAFE-015 및 전달 hash 관련 AV-GATE-020·025

## 제품 write scope exact5

1. `packages/git_adapter/__init__.py`
2. `packages/git_adapter/models.py`
3. `packages/git_adapter/service.py`
4. `tests/git_adapter/test_git_adapter_e10.py`
5. `docs/04_test_reports/E-10_COMPLETION_REPORT.md`

위 5개 이외 제품·schema·migration·API route·UI·배포 파일을 수정하지 않는다. Main 소유 progress/event/HANDOFF/checker/tooling/WI/prompt/evidence 파일은 수정하지 않는다.

## 구현 계약

### 공통 권위와 입력 경계

- Git mutation은 인증된 host adapter만 요청하며 agent payload는 subprocess·shell·환경·credential을 직접 선택하지 못한다.
- 모든 공개 입력은 exact builtin·크기 제한·detached copy 후 사용한다. hostile callback·alias·TOCTOU·replay로 권위를 만들지 않는다.
- repository/workspace identity, exact baseline commit, branch, before status manifest, allowed paths, target/delivered hash, release/admission receipt, actor, idempotency key를 동일 subject에 결박한다.
- driver 결과의 command id·argv·exit·before/after HEAD/status/ref·artifact hash를 audit에 보존한다. secret·credential·remote userinfo는 출력하지 않는다.

### Branch

- exact baseline에서 새 작업 branch만 생성한다. default/protected/existing branch 덮어쓰기, branch delete/rename, detached/다른 baseline 시작을 거부한다.
- 기존 tracked dirty·untracked·index와 사용자 소유 path가 있으면 보존 증거를 유지하고 overlap은 `USER_CHANGE_CONFLICT`; 자동 stash/reset/clean/checkout overwrite를 실행하지 않는다.

### Commit

- exact allowed path inventory와 content/diff hash가 승인 subject와 일치할 때만 commit 후보를 admission한다.
- `git add -A`, `commit -a`, hooks에 의한 범위 밖 변경, empty/partial/추가 staged path, 전달 hash 불일치를 거부한다.
- commit parent는 exact baseline/current expected HEAD이며 결과 commit/tree/delivered hash를 검증한다.

### Merge·PR

- merge는 독립 Gate/Release receipt와 exact source commit·target baseline·delivered hash가 일치하고 충돌이 없을 때만 순차 admission한다. 자동 conflict resolution, unrelated histories, squash/rebase/history rewrite, force는 금지한다.
- PR은 exact source/target/ref·commit·delivered hash·검증 manifest와 목적/영향/검증/미검증/rollback metadata를 결박한다. 다른 remote/ref/commit 재사용을 거부한다.
- 실제 merge/push/PR network 실행은 별도 host capability와 정책 소유이며 E-10 테스트에서는 fake driver receipt만 검증한다.

### 절대 금지와 audit

- `push --force*`, reset, clean, checkout/restore overwrite, branch/tag delete, rebase, filter-branch/filter-repo, reflog expire, gc prune, destructive ref update, DB/file 삭제를 command allowlist 전에 거부한다.
- 승인 여부와 무관하게 금지 operation은 adapter에서 실행하지 않으며 side_effects=0 denial audit를 남긴다.
- idempotency exact replay는 동일 receipt를 반환하고 충돌 payload 재사용은 거부한다. audit은 append-only이며 반환 alias로 내부 기록이 변하지 않는다.

## TDD·검증

- RED를 먼저 고정하고 최소 구현 후 GREEN.
- E-10 focused, 기존 execution_backends/repository_intelligence/E-09 verification 관련 회귀, builtin compile, `git diff --check`, canonical progress checker를 실행한다.
- destructive argv 변형, shell metacharacter, case/Unicode/ref/path alias, stale baseline, dirty/untracked overlap, index smuggling, parent/commit/tree/hash swap, remote/ref swap, replay, callback/alias/concurrency를 적대적으로 검증한다.
- 실제 Git remote network, push, PR, merge, branch 삭제는 실행하지 않고 `NOT_EXECUTED`로 보고한다.

## 완료보고

- 기준 HEAD/branch/status, exact5 diff/hash
- RED→GREEN과 정확한 명령/exit/result
- AV-SAFE-015, AV-GATE-020·025 매핑과 실제/fixture 경계
- 기존 기능 유지, 잔여 위험, rollback
- stage/commit/push는 Main만 수행
