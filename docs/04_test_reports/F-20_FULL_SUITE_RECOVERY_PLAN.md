# F-20 전체 검증 회복 실행 계획

**목표:** F-20 재작업을 수락하기 전에 WSL-server 전체 테스트 실패를 원인별로 제거하고, 11개 운영 메뉴의 실제 검증 증거를 남긴다.

**기준:** `Anvil_작업계획서_v1.md` F-20, `docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md`, seq1719의 기존 exact3 lease. 개발은 로컬, 동일 Git SHA 테스트는 WSL-server. ysna-server/Production은 제외한다. 현재 브랜치가 main에 병합·삭제되기 전 새 브랜치를 만들지 않는다.

## Task 1 — G-05 공통 불변식 복구

- 대상: `scripts/check_project_progress.py`, `tests/tooling/test_f20_rework_projection.py`와 이 기록. F-20 전용 Event·manifest 규칙은 유지한다.
- 현재 F-20 bundle의 필수 필드 누락, handoff sequence 불일치 등 이전 공통 검사가 누락되는 사례를 음성 테스트로 먼저 확인한다.
- F-20 모드에도 적용 가능한 공통 검사만 추출·호출한다. 이전 전체 validator의 포맷별 검사에서 발생하는 기존 baseline 거짓 양성 7개를 무차별 호출하지 않는다.
- 집중 테스트와 현재 G-05를 로컬·WSL 동일 SHA에서 실행한다. F-20 조기 수락/상태 위조 음성 테스트를 유지한다.

## Task 2 — WSL 이식성 및 장시간 테스트 재작업

- 새 worker/write lease를 정확한 변경 경로로 append-only 발급하고, 기존 exact3 lease와 충돌하지 않도록 제품 mutation 전 소유권을 전환한다.
- seq1719 원본 Event bytes를 고정한 뒤 `WRITE_LEASE_REVOKED` → `WORKER_LEASE_REVOKED` → 새 `WORK_INSTRUCTION_ISSUED` → `WORKER_LEASE_ISSUED` → `WRITE_LEASE_ISSUED` → `PACKAGE_RESUMED`를 추가한다. 과거 수락 무효화 Event와 기존 보고서·manifest는 수정하지 않는다.
- 새 exact8 범위는 `docs/04_test_reports/F-20_REWORK_R2_RESULT.md`, `packages/paths/identity.py`, `tests/paths/test_conflict_scope_identity.py`, `tests/deploy/test_wsl_staging_harness.py`, `tests/tooling/test_a14_workbench_prototype.py`, `tests/execution_backends/test_git_worktree.py`, `tests/persistence/test_oidc_pending_auth.py`, `tests/integration/test_c30r3_formal_entity.py`다. 이 밖에 추가 결함이 확인되면 새 범위로 별도 전환한다.
- 전환 검사기는 원본 Event raw prefix, revocation 선행, 신규 token·scope·expiry, progress/handoff/digest/manifest 결박, `accepted=false` 및 P-01 차단을 확인한다. 정상 상태와 각 위조 사례를 테스트한 뒤에만 제품 writer를 시작한다.
- `D:/tmp`를 강제하는 테스트, Windows 경로의 POSIX 정규화, symlink cleanup, 수집 시각 기반 OIDC 만료, 낡은 AST·migration 기대치를 각각 최소 재현한 뒤 RED→GREEN으로 수정한다.
- 관련 집중 테스트를 로컬·WSL 동일 SHA에서 수행한다. 실패 유형을 `docs/WORK_STATUS.md`에 누적한다.

## Task 3 — 역사 Git 증거와 잔여 전체 suite

- 누락된 15개 commit 객체가 요구하는 검증 의미와 외부 공개 범위를 먼저 감사한다. 큰 고아 이력을 원격 tag로 바로 게시하지 않는다.
- 기존 지정 원격 `refs/pull/15/head`가 과거 `ec9ee09`와 대표 `abb7361`·`ed3cae9`의 후손임을 확인했다. WSL clean checkout은 현재 작업 SHA를 pull한 뒤 이 기존 ref만 명시적으로 fetch하여 역사 증거 객체를 읽는다. 새 원격 branch/tag나 테스트 편의를 위한 코드 fixture를 게시하지 않는다.
- 공개 영향 없이 재현 가능한 이식성 해결책을 우선 구현하고, 변경이 필요하면 정확한 경로 lease와 RED→GREEN을 따른다.
- 전체 suite를 WSL-server의 격리 checkout에서 다시 실행해 남은 실패를 분류·수정한다. 기존 공유 DB/Docker는 건드리지 않고 임시 리소스를 종료 후 정리한다.

## Task 4 — F-20 기능·통합 완료 증거

- WorkInstruction의 11개 메뉴, 중단/재개·복구, Monitoring·ProductValidation·Defect, backup/restore·rollback, same-origin Network를 실제 환경에서 검증한다.
- 기존 U-01~U-11 보고서의 `LOCAL_*_SCOPED` 수락을 실제 브라우저·DB·API 완료로 승격하지 않는다. 현 `apps/web/src/console/App.tsx`의 9개 route 공통 `UNAVAILABLE` fallback이 실측에서 재현되면 해당 U Package를 계획 순서대로 재작업하고 독립 검증을 닫은 뒤 F-20을 재검증한다.
- 실행하지 못한 항목은 PASS로 쓰지 않는다. 전체 필수 gate와 독립 검토가 GREEN일 때만 F-20 수락을 투영한다.
- Stage 검증 후 PR·main 병합·merged-main smoke·branch/worktree 정리를 수행한다. P-01 및 다음 브랜치는 그 뒤에만 시작한다.

## 실행 기록

- [x] Task 1 — 로컬 RED→GREEN 및 G-05 PASS; WSL 동일 SHA 검증은 별도 상태 기록
- [ ] Task 2 — R2 exact8 로컬 재작업·독립 검토 보완 완료; 같은 SHA WSL 집중/전체 검증 대기
- [ ] Task 3 — 기존 PR #15 ref fetch 후 WSL의 C-30 대표 회귀 1 PASS. seq1725 통제 테스트 파일 전체는 639 PASS·42 FAIL로 아직 비GREEN; 로컬 제품 수정 반영 SHA에서 원인별 재검증 대기
- [ ] Task 4
