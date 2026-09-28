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
- [x] Task 3 — R5e exact SHA `69bfeb0` WSL-server에서 C30 역사 PR #15와 C21 immutable runtime-control sibling 정확한 Git 객체를 준비한 전체 pytest **exit0: 8202 passed, 116 skipped, 14 warnings**. 과거 원장 raw는 복원하지 않았고 CRITICAL/blocking 사고를 append-only 기록하여 수락을 차단한다. fixture/pytest GREEN은 실제 DB·API·브라우저 및 F-20 전체 수락 증거가 아니다. 첫 전체 실행은 WSL 재기동으로 중단, 객체 누락 상태의 두 번째 실행은 C21 3 FAIL, 올바른 역사 객체가 준비된 세 번째 실행만 공식 GREEN이다. 전용 임시 checkout·pytest·로그 잔류0.
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

### R5d — E09 역사 WI 권위 경계 3건

- R5c 정확한 SHA `eaea6d0`의 WSL-server 전체 suite는 `8184 passed, 4 failed, 116 skipped`였다. 잔여 E09 start1/final2의 첫 실패는 당시 WI frozen SHA `2DCA27...`와 현재 후속 WI SHA `71DA40...`의 차이다. `30ca8a2` 당시 Git blob은 5,196 bytes/frozen SHA와 일치하고 현재 파일은 5,195 bytes이며 마지막 LF 1 byte 차이. 다른 E09 고정 제품 5경로, invocation, start digest/manifest는 현재 고정 SHA와 일치한다. 당시 원문과 후속 파일을 분리하되 검증기·frozen 상수·Event·현재 WI를 수정하지 않는다.
- R5c epoch7 write→worker lease를 append-only 회수한 뒤 R5d epoch8 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5D_RESULT.md`)만 단일 writer에게 부여한다. 역사 WI 누락·위조 음성, E09의 다른 고정 경로 위조 거부, 현재 G-05를 유지한다. WSL-server 동일 SHA에 역사 객체를 준비하고 집중·전체 suite를 재실행한다. C30 raw Event 감사 1은 별도 경계로 계속 FAIL이며 F-20 전체 수락과 main 병합은 금지한다.
- 통제 준비: 기존 R5c overlay·projection을 기준으로 현재 문서/원장/lease/원격 SHA 변조 음성 테스트를 RED로 만든다. 새 R5d WI/Invocation, checker route, append-only overlay를 최소 구현하고 R5b/R5c 회귀·G-05를 GREEN으로 확인한다. 통제 준비 commit/push 뒤 R5c write→worker 회수와 R5d grant를 발급하며 로컬·WSL-server 통제를 검사한다.
- 제품 재작업: E09 start/final의 기존 3 RED를 확인하고, `30ca8a2` Git blob의 byte 길이·frozen SHA를 결박하는 fixture와 WI 누락·위조 음성을 추가한다. 현재 WI·checker·Event와 다른 E09 고정 검증은 보존한다. 단일 writer의 exact2 diff·결과를 독립 검토하고 집중/G-05 GREEN 뒤 commit/push한다.
- 동일 SHA 검증: WSL-server가 지정 원격에서 정확한 commit을 pull하고 필요한 역사 객체만 준비한다. E09·통제 집중 및 전체 suite를 실행하여 pass/fail/skip/warning·로그 해시·잔여 C30·미검증 DB/API/브라우저를 기록한다. 임시 리소스는 정확한 경로 확인 뒤 정리한다. C30 감사와 기능 완료조건이 열려 있으면 R5d가 GREEN이어도 F-20은 미수락으로 유지한다.

### R5e — C30 원장 무결성 사고의 append-only 기록과 수락 차단

- R5d 최종 제품 SHA `e12f74c`의 WSL-server 전체 suite는 `8196 passed, 1 failed, 116 skipped`이며 유일 실패는 C30 `test_no_early_acceptance_or_lease_revoke`의 현재 Event raw prefix와 역사 원문 불일치다. 당시 1334-event prefix는 3,994,695 bytes/SHA-256 `BDB3AA...`; 현재 원장의 같은 prefix는 4,022,935 bytes/SHA-256 `50195E...`다. `14c8c574`의 전체 재직렬화가 최초 원인이고, 그 부모 `97adc5c`의 seq1~1712와 현재 JSON의 의미 차이는 seq1689~1712 정확히 24개다. seq1715의 기존 F-20 수락 증거 무효화는 별개 사건이며 `historical_bytes_mutated=false`라는 당시 기록으로 이번 원장 변조를 덮지 않는다.
- C30 생성 원문과 현재 1334-event prefix 사이의 최초 byte 차이 offset은 `3868706`이다(과거 seq1262 manifest 비교의 `3868711`과 비교 대상이 다르다). 원인 commit 자체 Event는 1714개이며 부모→원인 seq1689~1712 24개, 원인→현재 초기 1714개 중 seq1714 후속 변경 1개를 구분해 기록한다. 원인 commit의 Event blob을 직접 읽어 현재 C30 prefix와 동일한지 검증한다.
- R5d epoch8 lease를 결과·정리 commit/push 후 write→worker 순서로 회수한다. R5e는 기존 Event contract의 `DEFECT_RECORDED`(severity CRITICAL, blocking true)만 append하여 원본 Git commit·원문/current prefix의 byte 길이와 SHA, 최초 차이, 24개 의미 변경 범위와 현재 미복구 상태를 결박한다. 과거 Event 객체·frozen manifest/hash·Git history를 덮거나 재직렬화하지 않으며 새 event는 현재 seq1761 raw prefix를 정확히 보존한다. 현재 F-20 수락은 무효·release decision `DEFER`·blocking defect 활성으로 유지하고, 자동 acceptance/merge를 금지한다. 기존 계약 안의 사고 기록이지 기능·schema·운영 범위 확장이 아니다.
- Main이 R5e append-only overlay·G-05 route·상태/manifest/digest, 정확한 WI/Invocation 및 epoch9 worker/write lease를 통제한다. 제품 writer는 exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_REWORK_R5E_RESULT.md`)만 수정한다. 역사 C30 projection의 조기 수락/lease 거부 검사는 보존하되 현재 원문과 역사 원문을 동일하다고 주장하는 assertion은 단순 skip/xfail이나 frozen fixture 치환으로 없애지 않는다. 현재 원장의 확인된 불일치와 CRITICAL blocking 사고 Event·원본/current hash 결박·현재 수락 차단을 함께 검증하고, Event/사고 기록/acceptance 위조 음성을 추가한다.
- local RED→GREEN, 독립 read-only 검토, G-05와 C30 집중·다른 역사군 회귀 후 같은 branch commit/push, WSL-server exact SHA 집중·전체 suite를 수행한다. 전체 suite가 GREEN이더라도 이는 알려진 원장 사고가 투명하게 기록·차단됨을 뜻할 뿐 원장 복원이나 F-20 수락·실제 DB/API/브라우저·11개 메뉴 완료를 뜻하지 않는다. 임시 자원은 정확한 대상 검증 뒤 정리한다. 새 branch·main 병합·ysna-server/Production 없음.

## F-20 완료조건 불일치 확인

- `U-01_DASHBOARD_WORK_INSTRUCTION.md`는 미연결 표시를 완료조건으로 삼고 `U-01_DASHBOARD_REPORT.md`는 `ACCEPTED_U01_LOCAL_WEB_SCOPED`이다. 그러나 상위 작업계획서 §13은 각 메뉴의 실제 service·API/BFF·UI·브라우저·DB 증거와 독립 수락을 요구한다. `apps/web/src/console/App.tsx`의 나머지 9개 메뉴는 현재 공통 `UNAVAILABLE` fallback이다. 하위 scoped 수락을 11개 메뉴 실제 완료로 승격하지 않고 U-01부터 직렬 재작업한다.
- 기존 F-20 R3 lease는 정확한 browser client 5개 파일에만 유효하다. 새로운 제품 경로는 기존 lease 회수와 새 exact-path WorkInstruction·lease 검증 뒤 단일 writer가 수정한다. 브라우저 Network는 아직 미검증이다.

### Task 4 / U-01 실제 수직 완료 준비

- 상위 작업계획서 §13의 U-01 완료조건을 기준으로 한다. 기존 `ACCEPTED_U01_LOCAL_WEB_SCOPED`는 shell의 정직한 미연결 표시만 검증했으며 실제 read model·API/BFF·브라우저·DB의 수락 증거가 아니다. 이를 소급해 `ACCEPTED`로 승격하지 않는다.
- 현재 React Dashboard는 `/api/health/ready`의 Database 카드만 연결하고 Queue·Worker·Provider·Backend·Artifact와 운영 카드·Next Actions·Critical Alerts는 미연결이다. 기존 `packages/observability/projection.py`는 queue/lease/budget/provider/health/deployment 소스의 읽기 전용 projection을 제공하지만, `packages/api/operations.py`는 alerts/audit 조회만 공개하고 runtime의 `operations_owner`는 선택 주입이다. 실제 host owner·인증된 project/environment scope·persistent source와 브라우저 same-origin 연결이 필수다.
- 먼저 각 카드/운영 항목의 실제 owner와 source availability를 읽기 전용으로 표로 고정한다. 없는 owner는 `UNAVAILABLE`과 원인을 유지하고 mock·fixture 값을 운영 화면에 내보내지 않는다. 실제 source가 있는 항목만 TDD로 API/BFF·UI에 연결하며 프로젝트/Run/Agent·승인 대기·Gate·baseline 충돌은 다른 메뉴와의 계약/소유권을 확인한다.
- U-01 제품 mutation 전 R5e epoch9 write→worker lease를 순서대로 회수하고, 변경할 정확한 경로·계약·rollback을 담은 새 WorkInstruction/Invocation 및 dual lease를 G-05로 검증한다. 제품 단일 writer가 로컬에서 RED→GREEN으로 개발하고 Main이 동일 SHA를 push한 뒤 WSL-server 격리 DB/API/실제 브라우저·Network·1920×1080/좁은 화면/키보드 증거를 확인한다. Secret·내부 주소 노출, 미연결의 READY 오표시, 무권한 cross-scope 조회는 거부한다.
- U-01 독립 Tester의 실제 `ACCEPTED` 전에는 U-02를 시작하지 않는다. F-20의 C30 CRITICAL 원장 사고는 별개로 계속 `OPEN_BLOCKING`; U-01 GREEN만으로 F-20 수락·main 병합·다음 branch·Production을 허용하지 않는다.

#### U-01 실제 source/owner 감사와 구현 경계 (2026-09-28)

| 표시 항목 | 현재 확인한 소유자·경로 | 현재 판정·U-01 경계 |
| --- | --- | --- |
| Database | ASGI `GET /api/health/ready`가 DB `SELECT 1`·`alembic_version`·runtime 참조를 검사한다. React `classifyReadiness`는 `0016_operations_recovery`만 READY로 인정한다. | OIDC 호스트의 요구 head는 `0019_oidc_sessions`이므로 정상 준비 응답도 Dashboard가 `NOT CONNECTED`로 잘못 분류할 수 있다. 브라우저 응답의 실제 상태·head와 호스트 모드를 일치시켜 검증한다. readiness는 DB 외 항목의 건강 증거가 아니다. |
| Queue·Worker·Budget | `OperationsSources`는 queue/lease/budget 객체와 ID 목록을 **호스트가 공급**해야 투영한다. `project_operations`의 목록은 공급된 ID만 읽는다. | 현재 ASGI는 이 source를 생성·주입하지 않는다. 빈 목록은 실제 0건 증거가 아니다. persistent scoped 조회/관측 소유자를 확인하고 없으면 `UNAVAILABLE`로 유지한다. |
| Provider | `GET /api/providers`는 환경변수의 credential **존재**만 표시하고 건강은 `NOT_CHECKED`다. `OperationsSources.provider`도 호스트 주입형이다. | credential 등록을 live Provider 건강으로 승격하지 않는다. 안전한 상태 조회와 실제 probe의 증거를 분리한다. 키 문제는 별도 건강 실패로 기록하되 나머지 검증을 멈추지 않는다. |
| Backend·Artifact Store·환경 | `OperationsSources.health_signals`가 비어 있으면 여섯 health component는 `UNKNOWN`으로 투영된다. ASGI readiness는 이 구성요소들을 검사하지 않는다. | host-observed timestamp·TTL·evidence가 있는 source만 연결한다. 미관측·만료·오류는 READY 금지. |
| Alerts·Next Actions | `OperationsService.snapshot()`은 persistent audit repository의 alerts와 다음 행동을 계산한다. 현재 `OperationsPort`는 alerts/audit 두 조회만 노출하고 `create_runtime_app`의 `operations_owner`는 선택 주입이며 ASGI는 주입하지 않는다. | 인증된 project/environment scope를 결박한 실제 owner와 additive read API가 필요하다. GET은 detector를 실행하거나 audit를 쓰지 않는다. 미구성은 명시적으로 unavailable. |
| Project·Run·Agent·승인 대기·Gate·baseline | `/api/projects/scan`은 server path의 repository scan이며 project/environment 권한 scope를 가진 Dashboard read model이 아니다. 기존 F-13 projection에도 이 항목들은 없다. | 기존 Project/Run/Agent/approval/Gate의 durable owner·권한 계약을 식별한 뒤 별도 수직 slice로 잇는다. scan 결과를 임의 project의 상태로 재사용하거나 fixture를 실데이터로 표시하지 않는다. |

- 선택한 방향: 기존 F-13 `OperationsService`/projection을 인증된 read-only Dashboard 소유자의 입력으로 재사용하고, 없는 실제 source는 이유와 관측 시각을 동반해 fail-closed 표시한다. 새 독립 DB 질의 계층을 중복 구축하거나 브라우저가 여러 내부 endpoint를 무권한 fan-out하는 방식은 채택하지 않는다. 이는 승인된 U-01 service·API/BFF·UI의 내부 구현 순서이며 별도 기능을 추가하지 않는다.
- 첫 제품 slice 전에 계약을 확정할 것: (1) 기존 canonical API registry의 추가 읽기 route 및 scope/permission, (2) OIDC·WSL acceptance 호스트의 실제 owner binding, (3) DB/queue/worker/provider/backend/artifact 각 source의 관측·stale/unknown 정책, (4) Project/Run/Agent/승인/Gate/baseline durable owner. 계약/권한이 상위 승인 범위를 바꾼다면 그 항목은 구현하지 않고 정확히 분리 보고한다.
- 음성 검증: 타 project/environment 403, 미인증 401, owner 부재·source gap·stale 상태의 READY 오표시 0, secret/fencing token/내부 주소 노출 0, GET audit mutation 0. WSL-server에는 local push의 exact SHA를 pull한 격리 프로세스·DB·브라우저만 사용하고 테스트 종료 후 정리한다. C30 원장 사건은 이 slice와 독립적으로 계속 차단한다.

#### U-01 R1 — 실제 readiness 표시의 첫 수직 slice

- 목적: 기존 same-origin `/api/health/ready`가 OIDC 호스트에서 `status=ready`, `migration_head=0019_oidc_sessions`를 반환할 때 Dashboard의 Database 카드가 이를 `NOT CONNECTED`로 오판하고 `0016_operations_recovery`를 고정 설명하는 결함을 먼저 제거한다. 이는 승인된 U-01 실제 read model의 최소 독립 테스트 단위이며 U-01 전체 수락은 아니다.
- 정확한 제품 파일: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R1_READINESS_RESULT.md` 세 경로. ASGI/readiness server, API registry, 인증·DB schema, 다른 메뉴는 이 slice에서 변경하지 않는다.
- 제품 TDD: `f15-console.test.mjs`에서 0019 ready→READY, 0016 operational-shell ready→READY, 0013/알 수 없는 head·not_ready/무응답→NOT CONNECTED를 각각 검증한다. 서버가 확인한 실제 migration head와 다른 고정 문구가 READY 카드에 표시되지 않도록 관찰 가능한 화면 결과를 검사한다. 기대값은 테스트가 직접 적고 구현 helper를 재사용해 생성하지 않는다. RED 확인 후 최소 구현, 해당 Node 테스트→web typecheck/lint/build→전체 가능한 프로젝트 테스트 순서로 실행한다.
- 통제 순서: 현재 R5e epoch9 write→worker를 회수하고 새 F-20/U01-R1 exact3 WI·invocation·epoch10 worker/write를 append-only 발급한다. G-05가 이전 Event raw prefix, 순서, token, exact3, 기존 C30 `OPEN_BLOCKING`, F-20 미수락/DEFER를 검사하기 전에는 제품 파일을 수정하지 않는다. 단일 `developer-primary`만 exact3을 쓰고 Main은 통제·독립 검토·commit/push를 맡는다.
- WSL-server: local push의 exact SHA를 전용 checkout에 pull하고 Node 22 잠긴 의존성으로 동일 테스트/빌드, 격리 PostgreSQL/API/브라우저에서 0019 ready와 503/not_ready 화면·Network same-origin을 확인한다. 임시 checkout·DB·프로세스·브라우저 프로필은 이름/경계/잔류를 확인해 제거한다. 모든 검증은 실행 명령·exit·원문 응답과 미검증을 결과보고서에 분리한다.
- R1 후속: Queue/Worker/Provider/Backend/Artifact 및 operations/Project/Run/Agent/approval/Gate/baseline의 실제 scoped owner/API/UI를 후속 직렬 slice로 연결한다. source가 없는 항목은 계속 `UNAVAILABLE`; R1 통과를 U-01 acceptance, F-20 acceptance, C30 사고 해결로 승격하지 않는다.

#### U-01 R1b — 현재 projection과 역사 digest 테스트의 구분

- R1 제품 SHA `9b5bf8b`의 WSL-server 정식 전체 pytest는 `8205 passed, 4 failed, 116 skipped`였다. G-06 세 실패는 Main의 잘못된 bare pytest가 fixture source에 만든 pycache 세 곳이 원인이며 이를 제거한 뒤 G-06 `25 passed`로 확인했다. 남은 한 실패는 `test_project_progress.py:1189`가 현재 seq1774 `F20_U01_R1_READINESS_START`를 이전 `F20_R5E_AUDIT_INCIDENT_START`라고 주장하는 역사/현재 경계 오류다. 다른 현재 원장·manifest·수락 차단 검사는 이미 G-05와 집중 검사에서 GREEN이며 변경하지 않는다.
- R1 exact3 제품 결과·실측 보고와 원격 checkpoint를 먼저 보존한다. 이후 epoch10 write→worker를 순서대로 회수하고, R1b exact2(`tests/tooling/test_project_progress.py`, `docs/04_test_reports/F-20_U01_R1B_HISTORY_RESULT.md`) WorkInstruction·invocation 및 epoch11 dual lease를 append-only 발급한다. 이전 Event raw prefix·R1 WI/결과·digest/manifest hash와 C30 `OPEN_BLOCKING`/release `DEFER`를 G-05가 유지 검증한다. 새 branch·기존 lease의 범위 확장·과거 Event/문서 수정은 금지다.
- exact2 단일 writer는 `test_detached_digest_binds_current_progress_and_handoff_into_manifest_target`가 읽는 **epoch11 현재 bundle**의 `F20_U01_R1B_HISTORY_START` mode를 검증한다. 현재 진행상태·digest·manifest 변조 음성은 새 route의 `F20_U01_R1B_PROGRESS_INVALID`, `F20_U01_R1B_DIGEST_INVALID`, `F20_U01_R1B_MANIFEST_INVALID`로, handoff 변조는 기존 공통 `HANDOFF_NEXT_ACTION_MISMATCH`로 계속 거부한다. 과거 R1/R5e checkpoint는 당시 Git blob/hash로만 검증하며 현재 값을 과거로 위장하지 않는다. 먼저 현재 실패를 RED로 재현한 뒤 최소 GREEN, 관련 역사군·G-05·WSL-server exact SHA 전체 suite를 확인한다. `SKIPPED`/warning을 PASS로 승격하지 않고 R1b GREEN도 U-01/F-20 수락은 아니다.

#### U-01 R2 — Provider 등록 상태의 정직한 Dashboard 조회

- R1b 동일 SHA WSL-server 전체 suite `8214 passed, 116 skipped, 14 warnings`는 Python 회귀 GREEN만 증명한다. R1b 결과·상태 checkpoint를 보존한 뒤 epoch11 write→worker lease를 append-only 회수하고 R2 epoch12 exact3(`apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R2_PROVIDER_STATUS_RESULT.md`)을 발급한다. 새 branch는 만들지 않는다.
- 이미 승인된 `GET /api/providers`의 `data` 목록만 Dashboard에서 same-origin·credential 포함 읽기로 사용한다. 9개 canonical 항목, `credential_status=REGISTERED/MISSING`, `health_status=NOT_CHECKED`를 검증한 응답에 한하여 등록 개수를 표시하고 건강은 항상 `NOT CHECKED`로 유지한다. `DEGRADED`를 연결 성공이나 `READY`로 승격하지 않는다. 인증 거부·통신 실패·불완전/위조 응답·빈 목록은 `UNAVAILABLE`이고 Secret 값, 내부 endpoint, 모델 추정값을 화면에 표시하지 않는다.
- TDD는 정상·무등록·401/403·malformed·transport failure를 RED→GREEN으로 분리한다. 기존 Database/다른 카드·메뉴·auth/API/DB 계약은 변경하지 않는다. Main 독립 Node·typecheck·lint·build·G-05 검토 후 같은 branch commit/push, WSL-server exact SHA의 API·브라우저 Network·1920×1080/390×844·접근성/오류 표시를 확인한다. 임시 자원은 대상 확인 후 정리한다.
- R2 결과가 GREEN이어도 실제 Provider 연결 건강, 다른 Dashboard source, U-01 전체 acceptance, C30 `OPEN_BLOCKING` 복구, F-20 수락, release, Production은 미완료다.
