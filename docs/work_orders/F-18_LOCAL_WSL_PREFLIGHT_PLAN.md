# F-18 Local/WSL Preflight Implementation Plan

> **For agentic workers:** Execute this plan task by task under the Anvil worker/write lease rules. This is a preparation slice of F-18, not F-18 acceptance.

**Goal:** Produce a fail-closed, locally testable deployment-approval subject and WSL-to-production artifact preflight without accessing or changing `ysna-server`.

**Architecture:** Keep the approval subject and artifact comparison as pure Python in `packages/deployment`. A separate read-only preflight entry point may consume signed F-16 ReleaseManifest and F-17 evidence, but must never fetch, checkout, deploy, migrate, or contact the production host. WSL-server can run the same preflight against a disposable, exact-Git fixture; that evidence proves only the preflight behavior.

**Tech Stack:** Python 3, pytest, existing `packages/deployment/release_manifest.py`, canonical JSON/SHA-256, existing F-17 evidence schema.

**Spec:** `Anvil_설계서_v2.md` §49.11–49.13; `Anvil_작업계획서_v1.md` F-18; `Anvil_통합검증매트릭스_v1.md` AV-OPS-013/016/020/021. 신산님의 직접 지시에 따라 실행 대상은 로컬과 `WSL-server`뿐이다.

## Global Constraints

- `ysna-server`, `shared-db`, `envil.sinsan.kr`, Oracle Cloud는 접속·변경·검증 대상이 아니다. 이들의 상태를 PASS로 기록하지 않는다.
- 기존 F-16 서명 검증과 F-17 exact Git/image 증거를 재사용하되, fixture·정적 PASS를 실제 Production PASS로 승격하지 않는다.
- Secret 원문, OIDC token, object-storage credential, 서버 내부 주소를 Git·로그·보고서에 기록하지 않는다.
- 새 작업 branch는 `main`에서 하나만 만들고, 미병합 상태에서 후속 작업 branch를 만들지 않는다.
- 제품 경로 mutation은 canonical worker/write lease 발급과 exact WorkInstruction 결박 뒤에만 한다.

## Review Focus

1. WSL 증거의 Git commit은 같지만 image digest가 다르면 `DEPLOY_ARTIFACT_MISMATCH`로 차단한다.
2. ReleaseManifest subject나 서명이 바뀌면 이전 DeployApprovalSubject를 재사용하지 못하게 한다.
3. migration 또는 rollback plan hash가 바뀌면 기존 approval binding을 거부한다.
4. dirty/local-only checkout과 승인 remote가 아닌 source ref를 사전 차단하고 side effect를 만들지 않는다.
5. OIDC·object storage·network capability가 미확인일 때 `READY`나 `RELEASED`가 아니라 구체적 `NOT_VERIFIED`를 반환한다.

---

### Task 1: DeployApprovalSubject 불변 결박

**Files:** Create `packages/deployment/deploy_approval.py`; create `tests/deploy/test_f18_deploy_approval.py`.

**Interface:** `DeployApprovalSubject(environment_id: str, release_manifest_hash: str, migration_plan_hash: str, rollback_plan_hash: str)`와 `subject_hash(subject) -> str`, `approval_matches(approved, observed) -> bool`. Digest 입력은 `sha256:` 접두사와 소문자 64자리만 허용한다. 비교는 네 필드의 canonical JSON byte를 기준으로 한다.

- [ ] Test RED: 유효한 네 필드 subject의 고정 기대 hash를 테스트에 리터럴로 두고, 환경·manifest·migration·rollback 각 한 필드만 바꾼 네 사례가 다른 hash와 approval 거부를 만드는지 확인한다. malformed digest와 빈 environment를 거부한다.
- [ ] RED 명령: `python -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_deploy_approval.py`; 누락 모듈/기능으로 실패한 결과를 기록한다.
- [ ] `deploy_approval.py`에 위 인터페이스만 구현한다. canonical payload의 키는 `environment_id`, `release_manifest_hash`, `migration_plan_hash`, `rollback_plan_hash`이며 정렬 JSON·UTF-8·공백 없는 구분자를 쓴다.
- [ ] 동일 focused 테스트 GREEN, 기존 F-16 manifest 테스트를 실행한다.
- [ ] exact 두 파일만 stage/commit하고 diff/rollback을 기록한다.

### Task 2: F-16 manifest와 F-17 WSL evidence의 동일 artifact 사전검증

**Files:** Create `packages/deployment/promotion_preflight.py`; create `tests/deploy/test_f18_promotion_preflight.py`.

**Interface:** `validate_promotion(verified_release, wsl_evidence, approval_subject, observed_environment_id, migration_plan_hash, rollback_plan_hash) -> PreflightDecision`. `PreflightDecision`은 `ready: bool`, `reason_code: str`, `subject_hash: str | None`만 노출한다. `verified_release`는 기존 `VerifiedRelease` 타입이며, F-17 evidence의 `git_commit`과 `runtime_image_digest`를 실제 입력으로 받는다.

- [ ] Test RED: exact commit과 image digest 일치만 `READY_FOR_PRIVATE_REHEARSAL`을 반환한다. 다른 commit/digest는 `DEPLOY_ARTIFACT_MISMATCH`; 다른 environment/plan hash는 `DEPLOY_APPROVAL_SUBJECT_MISMATCH`; 필수 evidence 누락은 `EVIDENCE_TARGET_MISMATCH`가 된다. 각 차단에서 실행/네트워크 side effect가 0임을 실제 순수 함수 호출로 확인한다.
- [ ] RED 명령: `python -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py`; 의도한 누락 기능 실패를 기록한다.
- [ ] 기존 `verify_release_manifest`의 검증 결과만 입력으로 받는 순수 함수를 구현한다. 새 서명 키 생성·신뢰 정책 완화·서버 연결을 추가하지 않는다.
- [ ] focused GREEN 및 F-16/F-17 관련 배포 회귀를 실행한다.
- [ ] exact 두 파일만 stage/commit하고 diff/rollback을 기록한다.

### Task 3: 로컬·WSL 한정 증거와 인수 경계

**Files:** Create `docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md`; update `docs/WORK_STATUS.md`와 canonical progress/HANDOFF는 Main의 허용 control projection으로만 수행한다.

- [ ] Main은 Task 1·2 exact commit을 확인하고 동일 published Git commit을 `ssh WSL-server`의 격리 checkout에서 가져와 focused tests를 실행한다. 기존 `anvil-web`, `local-postgres`, `/srv/anvil-wsl/repo`를 수정하지 않는다. 생성 전 임시 경로·수명·정리 방법을 WORK_STATUS에 기록한다.
- [ ] WSL 테스트 후 exact 임시 checkout/cache를 정리하고 잔류를 확인한다. source SHA, Python/test 명령·exit, 실제 결과, 미검증 범위를 보고서에 남긴다.
- [ ] `ysna-server` Git checkout, `shared-db` 전용 DB/role, 실제 OIDC/object storage/network policy, `envil.sinsan.kr` browser, DeployApproval, Monitoring/Release는 모두 `NOT_EXECUTED`로 남긴다. F-18/AV-OPS-016/020/021 최종 acceptance를 발행하지 않는다.
- [ ] 정본 G-05와 diff-check를 실행하고 branch를 안전한 checkpoint로 push한다. 서버 실측을 요구하는 F-18 gate가 미충족인 한 PR 자동 병합·branch 삭제·F-19 branch 생성은 하지 않는다.

### Task 4: 이미 존재하는 checkout의 읽기 전용 Promotion Git guard — 2026-09-24 Main 후속 지시

**범위 판정:** 정본 F-18의 production deployment adapter 중 승인 remote/tag/commit/clean checkout 사전 차단만 로컬·WSL에서 구현한다. 신산님이 제외한 `ysna-server` 접속, fetch·checkout 생성, DB·서비스 변경, 실제 DeployApproval·Release는 하지 않는다. 이 Task는 Task 1~3의 완료 증거를 변경하지 않고 같은 작업 branch에서 수행한다.

**Files:** Modify `packages/deployment/promotion_preflight.py` and `tests/deploy/test_f18_promotion_preflight.py`; update `docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md` for worker results. Main만 control status/progress/HANDOFF를 갱신한다.

**Interface:** `VerifiedApprovalRelease`에 서명 검증 당시의 `source_git_remote`를 결박한다. `validate_existing_checkout(verified_release, wsl_evidence, approval_subject, observed_environment_id, migration_plan_hash, rollback_plan_hash, checkout: Path, approved_remote: str = APPROVED_DEVELOPMENT_REMOTE) -> PreflightDecision`은 기존 `validate_promotion`의 `ready=True` 후에만 F-16 `verify_exact_checkout`을 호출한다. 불일치/미검증은 `ready=False`와 안정적인 `GIT_CHECKOUT_NOT_VERIFIED` 또는 기존 reason code를 반환한다. 기존 입력·반환의 의미를 바꾸지 않는다.

- [ ] RED: 합성 서명 manifest + 임시 bare Git remote/tag의 실제 clean detached checkout은 private rehearsal 준비가 된다. 다른 remote·tag·commit, attached HEAD, tracked/untracked dirty, 복사된 비-Git source는 차단한다. Web digest가 없는 실제 F-17 shape 또는 approval mismatch면 Git guard가 호출되지 않음을 확인한다. 원격 서명 subject와 `approved_remote`가 달라도 차단한다.
- [ ] RED 명령: `python -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py`; 새 함수/필드 부재로 실패한 결과를 기록한다.
- [ ] 최소 구현: 기존 F-16 Git guard와 F-18 순수 preflight를 순서대로 결합한다. 승인 remote 기본값은 고정 SSH alias이며, 테스트의 임시 bare remote는 서명 subject와 일치할 때만 허용한다. 네트워크·Git 예외 내용을 노출하지 않고 차단한다. fetch·checkout 생성·배포·서버 접속 함수를 추가하지 않는다.
- [ ] focused GREEN, F-16/F-17 회귀 및 diff-check를 실행한다. 정확한 명령/exit/미검증을 보고서에 기록하고 exact3 제품 파일만 commit한다.
- [ ] Main은 published exact Git commit의 WSL 격리 QA와 자원 정리, 독립 review, G-05 checkpoint를 수행한다. Web image·실 서명 manifest·Production 환경 증거가 없는 한 F-18 `accepted=false`, F-19 차단을 유지한다.

## Self-review

- F-18 전체 요구 중 이 계획이 수행하는 것은 approval subject·artifact mismatch·기존 checkout Git guard의 로컬·WSL 사전검증뿐이다. Production checkout/DB/OIDC/object storage/network/도메인 실측은 의도적으로 미포함이며 F-18 최종 완료의 필수 미충족 조건이다.
- 각 제품 task는 자기 테스트로 검토할 수 있고, Task 3은 evidence·cleanup·상태 경계만 검토한다. Task 4는 새로운 내부 read-only preflight 진입점만 추가하며 공개 HTTP API나 DB schema를 변경하지 않는다.
