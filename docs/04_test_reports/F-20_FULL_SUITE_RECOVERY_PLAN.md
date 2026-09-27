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

- R2 집중 WSL의 유일한 남은 실패는 두 browser API client가 기존 `apiPath` 안전 검증 없이 간접 `fetchImpl`을 호출한다는 A14 정적 검사 결과다. R2 exact8 밖이므로 R2 lease를 회수한 뒤 R3 exact5(`F-20_REWORK_R3_RESULT.md`, 두 client, 각 client 테스트 2개)로 append-only 전환한다. browser scanner 자체는 수정하지 않고 기존 same-origin 경로 검증을 호출 지점에 적용한다.
- R3 보안 경로 수정은 cross-origin/내부 주소 거부 음성 테스트를 먼저 추가하고, A14 검사·해당 Node 테스트·브라우저 Network를 로컬/WSL 동일 SHA에서 확인한다. R3는 새 브랜치가 아니라 현재 `codex/f18-wsl-ops`의 다음 F-20 재작업 lease다.
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
- [x] Task 2 — R2 exact8 로컬 보완 및 WSL 동일 SHA 집중 231 PASS; 1 FAIL은 R2 범위 밖 browser 경로 안전 검사로 Task 3에 이관. 전체 suite는 아직 비GREEN
- [ ] Task 3 — R3 제품 SHA `c759956` WSL 동일 SHA Node 21 PASS, A14 browser-source 1 PASS, G-05 seq1731 PASS. WSL web typecheck·lint PASS, 격리 Node 22와 lockfile 일치 optional rolldown binding에서 build PASS(시스템 Node 18 build는 실패). 전체 pytest는 `8112 passed, 48 failed, 116 skipped`로 비GREEN. 실패군: C30 contract 2, A13 POSIX 경로 1, F18 R12 원격 ref 전제 2, Phase B gate 1, progress/history 41, C01 OpenAPI 1. 각 실패의 현재 결함·역사 fixture·실행 환경 원인을 분리해 RED→GREEN 처리하고 전체 suite 재실행 대기.
- [ ] Task 4

### 48건의 우선 원인 분리

- F18 R12 두 실패는 WSL 격리 clone에 `development/main` ref가 없어 `rev-parse`가 먼저 실패했다. ref가 있는 로컬에서 같은 두 테스트를 재실행하면 1 PASS·1 FAIL이고, 남은 실패는 과거 `BASE`와 현재 `development/main` 불일치(`F18_WSL_OPS_R12_MAIN_DRIFT`)다. 단순 ref fetch만으로 GREEN이라고 간주하지 않고, 역사 Git 기준선 고정 fixture로 재현한다.
- C30 contract 두 테스트는 현재 seq1731의 Event raw bytes·projection을 과거 seq1357 고정값과 비교한다. 이력 checkpoint 증거와 현재 투영 검증을 분리한다. A13의 Linux `swapcase()` 경로는 존재하지 않는 allowed root를 만들므로 Windows 전제인지 제품 경로 판정 오류인지 POSIX 최소 재현으로 분리한다.
- B Gate·C01 OpenAPI와 진행상태·이력 41건은 현재 정본을 과거 frozen 기준선에 대입하는 사례와 실제 현재 불변식 회귀를 각각 확인한다. 모든 변경은 기존 보안·승인 검사를 약화하지 않고 새 exact-path lease 뒤 진행한다.

### R4 — 비G-05 7건의 역사·이식성 테스트 기준 회복

- R3 결과 보고서를 동일 SHA WSL 증거로 닫은 뒤 R3 write→worker lease를 append-only 회수하고, R4 exact6을 발급한다: `F-20_REWORK_R4_RESULT.md`, `test_c30_contract_matrix.py`, `test_a13_repository_scan.py`, `test_f18_wsl_ops_r12_overlay.py`, `test_phase_b_gate.py`, `test_c01_l3_independent_acceptance.py`(각 원래 경로 유지). 제품 runtime·API·기존 frozen manifest는 수정하지 않는다.
- C30 원본 Event hash는 해당 checkpoint에서 검증하고 현재 seq1731의 상태/연결 증거는 현재 projection에서 별도로 검증한다. F18 R12는 과거 `development/main`을 현재 remote에 의존하지 않는 고정 Git 기준선으로 재현하며 실제 scope 변조 거부는 유지한다. Phase B는 당시 manifest와 해당 authority 문서의 역사 bytes를 함께 검증한다. C01은 승인된 F-13 Operations GET 2개만 후속 경로로 인정하고 기존 execute route·권한·schema·parent hash 검사는 유지한다. A13은 POSIX에서 존재하지 않는 case-flipped root가 아니라 실제 허용 root를 사용해 경계 이탈을 검증한다.
- 각 실패를 정확한 원인으로 RED 재현하고 해당 파일의 다른 계약 테스트·G-05를 GREEN으로 확인한다. WSL-server 동일 SHA 집중 검증 후 전체 suite를 재실행한다. 41개 진행상태 실패와 seq1196 이후 raw Event 변경은 R4에서 숨기거나 skip하지 않고 별도 R5 진단·복구 경계로 유지한다.

### R5 — 진행상태/역사 41건의 분리 복구

- R4 동일 SHA `bd6a543` WSL 전체 suite는 `8131 passed, 41 failed, 116 skipped`였다. 실패 41건은 모두 `tests/tooling/test_project_progress.py`: 현재 C30 원문 prefix/현재 불변식 4, C21 runtime 역사 3, C09~C13 역사 31, E09 역사 3이다. 원본 Event와 frozen manifest의 hash는 고치거나 테스트를 skip하지 않는다.
- R5a는 현재 F-20 모드의 세 진행상태 테스트(`detached digest`, failure count, Event category fixture)를 별도 exact-path lease로 다룬다. 예정 제품 쓰기 경로는 `tests/tooling/test_project_progress.py`와 `docs/04_test_reports/F-20_REWORK_R5A_RESULT.md` 두 곳뿐이다. 레거시 digest/manifest helper를 현재 F-20 raw-byte 형식에 무비판적으로 대입하지 않고, 현재 R4 control의 digest·handoff·manifest 결박 및 in-memory 변조 거부를 실제로 검증한다. failure count는 현재 handoff에 없는 필드를 조작하지 않고 정본 projection의 실제 필드를 사용한다. Event fixture는 계약상 빠진 구체 타입만 명시적 payload로 채운다. 검사 약화나 wildcard 타입 허용은 금지한다.
- C30의 `test_no_early_acceptance_or_lease_revoke`는 현재 원장의 과거 raw bytes 변조를 실제로 포착한 독립 감사 결함이다. `14c8c574`의 전체 Event 재직렬화와 seq1689~1712 24개 Event 변경을 Git 원본·현재 blob·스크립트로 확인했다. 이 테스트를 단순 frozen fixture로 바꿔 현재 원장의 무결성 실패를 은폐하지 않는다. 원본 재작성·history rewrite 없이 복구 가능한 append-only 사고 기록과 현재 acceptance 차단 조건을 먼저 설계·검증한다. 설계·중요 위험 변경이 필요하면 그 경계만 별도 보고한다.
- C21 3, C09~C13 31, E09 3은 원본 authority hash 및 당시 Git tree와 현재 successor 문서/상태를 분리해 각 군별 역사 fixture와 변조 음성 검사를 유지한다. 한 번에 38건을 단일 writer 변경으로 묶지 않고, 실제 의존 파일과 검증/rollback 경계를 읽기 전용으로 확인한 다음 후속 exact-path lease를 정한다. R5a와 감사 사고 판정, 역사군 검증 모두 닫히기 전 전체 suite나 F-20을 수락하지 않는다.

### R5b — C09 시작·R3·R4 역사 권위 경계 10건

- 현재 C09 시작 5, R3 3, R4 2건은 당시 `C09_START_BASE=08aae12`의 설계·계획·매트릭스·테스트계획·운영규칙 hash를 현재 승인 후속 문서에 대입해 먼저 실패한다. 최신 문서 hash가 틀렸다는 뜻이 아니다. 당시 Git tree의 원문 bytes와 고정 hash를 결박하고, 현재 정본의 권위/현재 G-05를 별도로 유지한다. 당시 blob 누락·hash 변조·predecessor manifest/WorkInstruction 변조는 계속 거부한다. 테스트 skip/xfail·상수 hash 변경 금지.
- R5a epoch5 write→worker lease를 append-only 회수한 후 R5b epoch6 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5B_RESULT.md`)만 단일 writer에게 부여한다. Main이 control checker/overlay·G-05 route·상태 기록을 맡고 같은 제품 두 경로를 동시에 수정하지 않는다. C09 Main takeover·final 6건, C10~C13 15건, E09 3건, C21 WSL 객체 준비 3건과 C30 감사 사고는 R5b 범위 밖이다.
- 해당 10개 RED를 로컬에서 재현하고 원인별 GREEN 및 역사 변조 음성 검사를 수행한다. R5b 통제 G-05·집중 테스트·WSL-server 동일 SHA를 거친 뒤 전체 suite를 다시 실행해 신규 회귀가 없음을 확인한다. 전체 suite의 다른 실패는 그대로 FAIL로 기록하고 F-20 수락하지 않는다.

### R5c — C09 Main takeover·final 역사 검토 원문 6건

- R5b `9af4923` WSL 전체 suite의 남은 10 FAIL 중 C09 Main takeover 4와 final 2는 과거 품질 검토 원문의 현재 파일이 당시 18,269-byte Git blob보다 마지막 LF 1 byte 짧아 발생한다. `10bbb87`의 역사 품질 검토 blob과 고정 SHA `E109EB0D...`를 확인하고 현재 승인 후속 문서를 덮거나 frozen hash를 바꾸지 않는다. Main takeover 및 final의 다른 선행 WI/manifest, 제품 raw map, raw Event prefix, review severity·failure counting, successor 계약은 유지한다.
- R5b epoch6 write→worker lease를 append-only 회수한 뒤 R5c epoch7 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5C_RESULT.md`)만 단일 writer에게 부여한다. C30 감사 사고 1과 E09 3은 범위 밖이다. 역사 review blob 누락·위조와 다른 선행 파일 변조는 계속 거부한다. R5c 6건과 기존 관련 검사를 로컬/WSL 동일 SHA에서 확인하고 전체 suite를 재실행해 신규 회귀를 분리한다. 그 결과가 GREEN이어도 F-20 전체 수락은 하지 않는다.

## F-20 완료조건 불일치 확인

- `U-01_DASHBOARD_WORK_INSTRUCTION.md`는 미연결 표시를 완료조건으로 삼고 `U-01_DASHBOARD_REPORT.md`는 `ACCEPTED_U01_LOCAL_WEB_SCOPED`이다. 그러나 상위 작업계획서 §13은 각 메뉴의 실제 service·API/BFF·UI·브라우저·DB 증거와 독립 수락을 요구한다. `apps/web/src/console/App.tsx`의 나머지 9개 메뉴는 현재 공통 `UNAVAILABLE` fallback이다. 하위 scoped 수락을 11개 메뉴 실제 완료로 승격하지 않고 U-01부터 직렬 재작업한다.
- 기존 F-20 R3 lease는 정확한 browser client 5개 파일에만 유효하다. 새로운 제품 경로는 기존 lease 회수와 새 exact-path WorkInstruction·lease 검증 뒤 단일 writer가 수정한다. 브라우저 Network는 아직 미검증이다.
