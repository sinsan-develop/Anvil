# E-06 Developer 완료보고

## 판정

`COMPLETED` — R3 구현·Developer 기본 검증 완료. 최신 focused79 passed/1 skipped, 관련591 passed/2 skipped, control4 passed, checker seq1113 PASS, compileall/diff-check exit0이다. R2 결과를 R3 완료로 재사용하지 않았다. Main 지시에 따라 package formal failure count3, 동일 branch-identity TOCTOU lineage count2(R2 direct HEAD target/R3 indirect referent chain)를 기록하고 Developer 재작업을 수행했다. Spec I1·Quality C1은 동일 고유 blocker이며 R3에서 보완했다. 이는 독립 acceptance가 아니고 lease revoke/Git publication/E-07을 수행하지 않는다.

## 판단 이유

- 범위: 독립 격리 worktree 쓰기, repository-wide canonical scope 상호배제, 기존 worker/write dual fencing 재사용, bounded host-only 파일 write/local commit. 기존 C09 read backend와 Tool Gateway의 read 계약을 변경하지 않았다.
- 실제 synthetic Git source에서 C09 별도 managed bare store/worktree를 준비하고 파일 write와 detached commit을 수행했다. source의 일반 파일 및 `.git` 파일 전체 checksum 전후 동일과 source `.git/worktrees` 미생성을 검사했다. 원본 적용/merge/PR/push는 제공하지 않는다.
- 서로 다른 run/workspace의 parent-child/case scope를 Barrier로 동시에 요청하는 100회 contention에서 매회 정확히 하나만 획득한다. 동일 worktree는 disjoint scope라도 둘째 owner를 거부하고 다른 worktree의 disjoint scope는 허용한다.
- RepositoryIdentity/RepositoryPathMapping의 physical path 및 Windows/WSL/case canonicalization을 재사용한다. 실제 junction 및 hardlink 교체 공격을 검사했다. 실제 8.3 alias 생성은 현재 볼륨에서 비활성화되어 1건 SKIP이다. SKIP을 실제 8.3 PASS로 주장하지 않는다.
- A 만료/B takeover 또는 mutation 직전 revoke, permission revoke, out-of-scope dirty, HEAD/branch/source drift를 거부한다. 파일 descriptor 및 physical parent guard와 commit scope guard 안에서 current dual fencing을 재검사한다. exact request retry는 기존 receipt를 반환한다.
- 기존 LeaseService의 in-memory RLock/host clock 계약이다. DB UTC·다중 프로세스 adapter는 `NOT_INTEGRATED`이며 production atomicity의 증거가 아니다. Main이 승인한 E06 내부 구현 경계이며 E08 예약 정책/E10 일반 Git adapter를 선점하지 않는다.

## 조치

### 기준선과 권위

- cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작 HEAD/local/upstream: `039c53acd6d79895d3c94e1bc21b72d1b54283f9`; clean 시작. private remote 일치의 출처는 Main 시작 지시이며 Developer의 외부 실행 증거가 아니다.
- 설계 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 계획 SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 매트릭스 SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획 SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- WI SHA256: `9EAF1703E49E7CDC84F77FC9F72F69C5ED57D98C9554DA240E9AB29F2F92B4AD`
- invocation SHA256: `7B2C19A6622E64C2AFF1461B31D80FF0B1741931FBED46252D27016488E51AF1`
- 설계 §46.9·46.16-7·47.18-6·49.5·49.17-5~6; `AV-SAFE-023`, `AV-SAFE-028`, `AV-FLOW-006`.
- seq1110 WI → 1111 worker → 1112 write → 1113 PACKAGE_STARTED. E06 IN_PROGRESS/E07 NOT_READY, pending approvals 0. seq1..1109 raw prefix 불변.
- worker: `worker-lease-e06-r1-20260917-001`; execution fence: `e06-r1-execution-fence-epoch-1-039c53acd6d79895`.
- write: `write-lease-e06-r1-20260917-001`; write fence: `e06-r1-write-fence-epoch-1-d3c94e1bc21b72d1`.
- 발효 `2026-09-17T14:50:00+09:00`, 만료 `2026-09-18T02:50:00+09:00`. 제품 mutation 전 발효를 확인했다. lease revoke/acceptance는 수행하지 않았다.

### 변경 경로 — product exact8 / control exact9

제품:

1. `packages/agent_team/__init__.py`: lazy export 추가.
2. `packages/agent_team/worktree_writes.py`: C09 isolated workspace에 결박한 host write/commit facade와 receipt.
3. `packages/leases/service.py`: 기존 owner의 canonical repository acquisition/검증 additive seam.
4. `packages/tool_gateway/gateway.py`: 기존 read 유지, current permission/dual fence mutation gateway 추가.
5. `tests/agent_team/test_worktree_writes_e06.py`: 실제 temp Git worktree integration/적대 테스트.
6. `tests/leases/test_repository_write_e06.py`: contention100·alias·half-open expiry·identity rebind.
7. `tests/tool_gateway/test_worktree_mutation_e06.py`: permission/fence TOCTOU·secret input IO0.
8. `docs/04_test_reports/E-06_COMPLETION_REPORT.md`: 본 보고.

control:

1. `docs/work_orders/E-06_WORK_INSTRUCTION.md`
2. `docs/work_orders/E-06_INVOCATION_PROMPT.md`
3. `scripts/check_project_progress.py`
4. `tests/tooling/test_project_progress.py`
5. `docs/progress/build-progress.json`
6. `docs/progress/progress-events.json`
7. `docs/progress/BUILD_HANDOFF.md`
8. `docs/progress/progress-handoff-detached-digest-e06-start.json`
9. `docs/evidence/manifests/E-06_START_MANIFEST.json`

checker는 승인된 additive one-shot 절차로만 변경했다. pre bytes 4,442,547 / SHA256 `D0B4D456B7EC4EA5270219E41CC31FED905332C580F3D0995B443458264793FC`, post SHA256 `85AF7194A13626D60DE8CF8B1F772E7DDC0D63D4B8D59CE2E9A80BE7E49B3FC2`. routing/EOF 4개 anchor 각각 count1, AST/compile 및 reverse reconstruction==pre bytes 확인 후 replace. numstat `155 0`, patch SHA256 `A160A19728B7358C6C7F62F24B5EE880096DCC1F3F5A9031E1B959FF97D9F3F9`. historical 삭제/교체 0. start control 이후 control은 동결했다.

tracked 제품 diff numstat: `__init__.py +4/-0`, `leases/service.py +83/-1`, `tool_gateway/gateway.py +30/-1`. 나머지 신규 제품 파일 5개를 포함한 실제 dirty exact17을 `git diff --name-only` + `git ls-files --others --exclude-standard`로 확인했고 staged 경로는 0이다. 기존 두 파일의 각 -1은 import 확장 및 export 확장에 해당하며 legacy read/lease 동작을 삭제하지 않았다.

### RED → GREEN 및 정확한 실행

아래 `PY`는 정확히 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`, `TMP`는 `D:/Project/Anvil/.codex-sandbox`의 절대경로 치환이다. 모든 pytest 호출은 `PY -B -m pytest -q -p no:cacheprovider`로 실행했다. 추가 인자/결과는 다음과 같다. 의도된 RED는 구현 전 누락 계약을 확인하는 TDD 증거이며 formal product failure가 아니다.

| 추가 인자 | exit | 실제 결과 |
|---|---:|---|
| `tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` | 1 | RED 2 failed, 2.15s; start helper 미구현 |
| 동일 start 명령 | 0 | GREEN 2 passed, 9.66s |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-lease-red-20260917 --tb=short` | 1 | RED 11 failed, 0.34s; acquire_repository_write 미구현 |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-lease-green-20260917 --tb=short` | 0 | GREEN 11 passed, 0.60s |
| `tests/agent_team/test_worktree_writes_e06.py --basetemp=TMP/e06-worktree-red-20260917 --tb=short` | 1 | RED 14 failed, 0.93s; worktree_writes 모듈 미구현 |
| `tests/agent_team/test_worktree_writes_e06.py --basetemp=TMP/e06-worktree-green1-20260917 --tb=short` | 0 | GREEN 14 passed, 234.19s |
| `tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-tool-red-20260917 --tb=short` | 1 | RED 4 failed, 0.25s; mutation gateway 미구현 |
| `tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-tool-green1-20260917 --tb=short` | 0 | GREEN 4 passed, 63.49s |
| `tests/leases/test_repository_write_e06.py -k 'short_name or rebind' --basetemp=TMP/e06-alias-red-20260917 --tb=short` | 1 | RED 1 failed/1 skipped/11 deselected, 0.13s; 동일 repo id의 다른 physical source rebind 허용 |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-lease-green2-20260917 --tb=short -rs` | 0 | GREEN 12 passed/1 skipped, 0.51s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'alias_swap or late_dirty' --basetemp=TMP/e06-adversarial-green-20260917 --tb=short` | 0 | 2 passed/14 deselected, 33.73s |
| `tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` | 0 | 4 passed, 22.37s |

개별 focused 최종 합계: 32 PASS/1 SKIP(16 worktree + 12 lease + 4 gateway). 한 번의 combined focused 실행으로 표기하지 않는다.

최종 관련 회귀 명령 — exit0, **544 passed/2 skipped in 632.01s**. 신규 focused 33개도 포함한 실제 실행이다. SKIP: `test_repository_write_e06.py:85` 실제 8.3 생성 비활성화, 기존 `test_worker_write_fencing.py:62` isolated PostgreSQL18 DSN 미설정. 기존 C09 backend/read gateway, path/lease 및 agent_team 회귀를 포함한다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=D:/Project/Anvil/.codex-sandbox/e06-related-20260917 --tb=short -rs
```

정적 검증 명령(각 exit0):

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/worktree_writes.py packages/leases/service.py packages/tool_gateway/gateway.py tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py scripts/check_project_progress.py tests/tooling/test_project_progress.py
git diff --check
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

canonical checker 실제 결과: `G-05 project progress contract: PASS sequence=1113 reporting=AUTO_CONTINUE`. Git global ignore 파일 read permission 경고는 관찰되었으나 diff/status 명령은 exit0이며 제품 실패가 아니다.

### 오류, 미검증 및 rollback

- R0 제출 당시 formal product failure count는 0이었으나 후속 독립 R1 REWORK로 현재 **1**이다. 정상 TDD RED는 별도다. Main의 최초 baseline 임시 디렉터리 setup 권한 오류는 환경 오류이며 본 제품 실패로 합산하지 않았다.
- 실제 fixture의 로컬 파일/Git 및 in-process 동시성은 실행했다. 실제 DB UTC/multiprocess lease adapter, Provider, HTTP/UI, WSL 실행, remote 전송, merge/PR/production/deployment는 NOT_EXECUTED/NOT_INTEGRATED다.
- 실제 8.3 alias 생성 disabled SKIP; 해석 불가능한 short alias 거부 계약과 실제 alias resolution의 검증 범위를 구분한다.
- cleanup: 각 절대경로를 Resolve-Path로 확인하고 parent가 `D:\Project\Anvil\.codex-sandbox`이며 아래 정확한 이름 집합에 속하는지 검증한 뒤 PowerShell `Remove-Item -LiteralPath <검증 경로> -Recurse -Force -ErrorAction Stop`으로 삭제했다. 완료된9개를 먼저, 관련 회귀 exit0 후 마지막1개를 삭제했다. 각 호출 exit0, 총10개 삭제, `ALL_E06_TEMP_RESIDUE=0`. 삭제 대상은 재생성 가능한 synthetic fixture뿐이며 사용자 파일 복구/삭제는 없다.
  - `e06-adversarial-green-20260917`, `e06-alias-red-20260917`, `e06-lease-green-20260917`, `e06-lease-green2-20260917`, `e06-lease-red-20260917`, `e06-tool-green1-20260917`, `e06-tool-red-20260917`, `e06-worktree-green1-20260917`, `e06-worktree-red-20260917`, `e06-related-20260917`.
- WI의 teardown 표현과 달리 pytest basetemp는 invocation 종료 후 남으므로 위 명시적 cleanup으로 정리했다. 공유/기존 DB·credential·원본 D:\tmp worktree를 변경하지 않았다. Python executable 경로의 읽기/실행만 재사용했다.
- rollback: Main이 exact17 diff와 untracked 산출물을 보존한 후 E06 제품8 및 시작 control9의 역 patch를 검토한다. 기존 HEAD 및 seq1..1109 역사는 재작성하지 않는다. 임의 reset/clean/stash/commit/push를 수행하지 않았다.
- progress/HANDOFF는 시작 projection seq1113까지만 materialize했다. 본 Developer 검증은 독립 spec/quality/Main acceptance를 대체하지 않는다.

## R1 독립 REWORK 보완

### 판정·원인

Main 전달 판정은 Spec `REWORK C1/I1`, Quality `REWORK C1/I4/M0`; 중복 제거 C2/I5, formal failure count1이다. 아래 식별자는 보고서 내 재현 fingerprint이며 control/history를 변경하지 않았다.

| fingerprint | 원인 | 보완 |
|---|---|---|
| E06-PHYSICAL-IDENTITY-ALIAS | root/case_policy/repository_id 문자열 비교로 같은 물리 source/workspace의 중복 current grant 허용 | 기존 LeaseService lock 안에서 실제 디렉터리 dev/inode를 읽고 source authority 및 workspace owner에 결박. 매 소비 시 physical identity 재검증. 미해석/교체 거부 |
| E06-CLOCK-ROLLBACK-REVIVAL | 만료 관찰 후 과거 now로 grant가 다시 current가 됨 | owner high-water time, 발급시각 및 stale tombstone. 미래 B 획득 이후 과거 시각 A/B 모두 거부, 미래 current B만 유지 |
| E06-COMMIT-INDEX-INTERLEAVE | git add 이후 shared index가 바뀌어 receipt와 실제 commit diff가 다름 | shared index에 쓰지 않음. receipt-bound blob/immutable tree와 예상 HEAD를 고정하고 commit-tree→update-ref expected-parent CAS. 실제 tree parent diff와 receipt 경로 exact 대조 |
| E06-UNRECEIPTED-DIRTY-COMMIT | 기존 in-scope dirty/staged를 출처 없이 commit | service write receipt의 canonical path+bytes SHA256이 있는 변경만 tree에 포함. 그 외 dirty는 원상 보존하며 거부 |
| E06-PARTIAL-FILE-WRITE | truncate/부분 write 실패가 원문을 손상 | 사전 임시 준비 후 physical descriptor publication, 실패 시 동일 descriptor로 원문 복원. 복원 실패는 WRITE_RECOVERY_REQUIRED, 실제 target mutation audit1 유지 |
| E06-COMMIT-INDEX-ROLLBACK | git add 후 commit 실패 시 index/staging 잔류 | shared index를 전혀 수정하지 않음. ref CAS 직후 예외는 자신의 exact new HEAD일 때만 prior HEAD로 보상; foreign HEAD 덮어쓰기 금지 |
| E06-TOKEN-CALLBACK-LOCK | facade가 owner lock을 잡고 token callback을 실행 | facade/owner lock 밖 token 준비, same-thread foreign-owner reentry taint, owner in-flight guard. callback의 다른 thread owner read 및 facade 재획득 검증 |

범위는 기존 제품 exact8이며 실제 수정은 lease owner/facade/gateway와 해당 테스트 및 본 보고서다. control exact9·WI·dual lease·historical prefix 불변. E07/E08/E10 기능은 추가하지 않았다.

### R1 RED 및 중간 검증

`PY`, `TMP`는 위 절대경로 정의와 같다. 공통 pytest prefix는 `PY -B -m pytest -q -p no:cacheprovider`다.

| 추가 인자 | exit | 결과 |
|---|---:|---|
| `tests/leases/test_repository_write_e06.py -k 'physical_identity or expired_observation or physical_root or token_callback' --basetemp=TMP/e06-r1-lease-red --tb=short` | 1 | RED 5 failed/13 deselected, 0.20s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'interleaved or provenance or partial_write or preoperation' --basetemp=TMP/e06-r1-worktree-red --tb=short` | 1 | RED 5 failed/16 deselected, 91.21s |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-r1-lease-green --tb=short -rs` | 0 | 17 passed/1 skipped, 0.67s |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-r1-lease-green2 --tb=short -rs` | 0 | 21 passed/1 skipped, 1.09s; 추가 physical alias contention100 포함 |
| `--import-mode=importlib tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r1-focused-green --tb=short -rs` | 1 | 중간 11 failed/31 passed/1 skipped, 421.12s; Windows guard와 rename의 WinError32 공통 원인 |
| `tests/agent_team/test_worktree_writes_e06.py::test_real_disjoint_write_commit_and_source_zero_mutation --basetemp=TMP/e06-r1-debug --tb=short` | 1 | 원인 최소 재현 1 failed, 18.72s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'real_disjoint or interleaved or partial_write or preoperation' --basetemp=TMP/e06-r1-debug-green --tb=short` | 0 | 수정 후 4 passed/17 deselected, 100.59s |
| `tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` | 0 | 4 passed, 5.07s |
| `--import-mode=importlib tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r1-focused-final --tb=short -rs` | 0 | 최종 49 passed/1 skipped, 558.88s |
| `--import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=TMP/e06-r1-related --tb=short -rs` | 0 | 최종 561 passed/2 skipped, 868.46s |

WinError32는 첫 보완의 atomic rename이 기존 Windows physical directory guard와 양립하지 않는 구현 오류였다. guard를 약화하지 않고 검증된 descriptor 원문 복원으로 변경했다. 동일 내부 실행의 반복 failing cases는 새로운 독립 formal failure로 합산하지 않는다. formal count1을 유지한다.

### R1 경계

- commit의 shared index는 성공/실패 모두 byte-preserved다. 따라서 detached HEAD commit 후 사용자 index staging 상태를 자동 재작성하지 않는다. Main은 receipt의 immutable commit/tree와 parent diff를 통합 입력으로 사용한다.
- Git object 준비 후 ref publication 전 실패는 authority 없는 unreachable object를 격리 store에 남길 수 있다. canonical HEAD/receipt/index publication은 없으며 일반 GC 또는 원본 Git 조작은 수행하지 않는다.
- 보상 자체가 실패하는 OS/storage 장애는 성공이나 IO0으로 포장하지 않으며 WRITE_RECOVERY_REQUIRED/COMMIT_RECOVERY_REQUIRED 경계를 유지한다. 프로세스 crash/disk failure/DB multiprocess는 실제 미실행이다.
- 파일 publication 중 실패 후 복원 성공도 audit `io_count=1`, `target_restored=true`, `io_boundary=TARGET_MUTATION`이다. pre-dispatch denial과 파일 mutation 전 실패의 target IO0과 구분한다.

### R1 최종 인계

- 실제 최종 related command:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=D:/Project/Anvil/.codex-sandbox/e06-r1-related --tb=short -rs
```

- 최종 SKIP2는 8.3 생성 비활성화와 기존 isolated PG18 DSN 미설정이다. 실제 temp Git/파일, source zero mutation, in-process contention 총200회는 실행했다. 이를 DB UTC/multiprocess/PG18 PASS로 승격하지 않는다.
- R1 code freeze 후 compileall exact product modules/tests exit0, canonical checker seq1113 PASS, diff-check0. E05/E06 start control4 PASS. checker SHA256 `85AF7194A13626D60DE8CF8B1F772E7DDC0D63D4B8D59CE2E9A80BE7E49B3FC2`로 시작 control과 동일하다.
- R1 최종 tracked 제품 numstat는 `__init__.py +4/-0`, `leases/service.py +139/-2`, `tool_gateway/gateway.py +31/-1`. 신규 facade/tests/report와 합쳐 기존 product8/control9의 total dirty exact17, staged0이다. HEAD/branch 변경 없음, dual leases active, 만료는 `2026-09-18T02:50:00+09:00`이다.
- R1 fixture cleanup: 앞서 설명한 exact 절대경로 검증 후 native PowerShell Remove-Item 방식으로 7개 종료 fixture, focused 종료 후1개, related 종료 후1개를 삭제했다. 각 exit0, 총9개, `ALL_E06_TEMP_RESIDUE=0`. 대상 이름은 `e06-r1-debug`, `e06-r1-debug-green`, `e06-r1-focused-green`, `e06-r1-lease-green`, `e06-r1-lease-green2`, `e06-r1-lease-red`, `e06-r1-worktree-red`, `e06-r1-focused-final`, `e06-r1-related`다. 재생성 가능한 synthetic fixture만 삭제했다.
- 보고서 표 추가 중 apply_patch anchor mismatch1은 write0으로 종료했고 좁은 anchor로 재시도했다. 제품/control 손상0이며 formal failure에 합산하지 않는다.
- 다음 정확한 행동: Main 독립 spec/quality 재검토. acceptance/lease revoke/commit/push/E07은 Developer가 수행하지 않는다. rollback은 Main이 exact17 evidence/diff를 보존한 뒤 제품 역 patch를 검토하며 historical control은 재작성하지 않는다.

## R2 — HEAD 종류/target fencing 및 in-process exception atomicity

### 판정·판단 이유

- Main의 R2 지시: formal failure count2. 새 Spec Important fingerprint는 `E06-HEAD-SYMBOLIC-REDIRECT`: commit-tree 뒤 detached HEAD를 foreign symbolic ref로 바꾸면 old object CAS만으로 foreign branch를 갱신하던 문제다. 기존 R1 C2/I5 closure는 Main이 전달한 독립 재검토 근거이며 Developer 자체 acceptance가 아니다.
- Quality 추가6의 보고서 내 식별자는 `E06-UNRECEIPTED-PRESTATE-OVERWRITE`, `E06-FILE-RECEIPT-PUBLICATION`, `E06-HEAD-RECEIPT-PUBLICATION`, `E06-INVALID-CLOCK-POISON`, `E06-SWALLOWED-CALLBACK-REENTRY`, `E06-CLOCK-LOCK-INVERSION`이다. 같은 R2/count2 안에서 재현·보완했다.
- Main ruling: 승인 범위는 **in-memory host facade의 in-process exception atomicity**다. OS 강제종료/프로세스 재시작 사이 durable journal·receipt recovery는 새 persistence/recovery 계약이므로 **NOT_INTEGRATED**다. 이를 구현하거나 process-crash recovery PASS로 표시하지 않는다. 실제 commit hash/parent/tree/path를 receipt에 결박해 검증 가능한 증거를 남긴다.

### 조치

1. acquire binding에 HEAD의 `DETACHED|SYMBOLIC` 종류와 exact symbolic target ref를 포함했다. 기존 workspace/baseline/branch 및 physical identity 검증을 유지한다.
2. Git `update-ref --no-deref` 단독으로는 symbolic→detached 변경을 허용함을 실제 temp probe로 확인했다(exit0). `symref-verify HEAD`와 referent update를 함께 넣으면 Git이 duplicate HEAD update로 거부함도 확인했다(exit128, 두 command variants). 단순 argv 옵션으로 안전성을 주장하지 않았다.
3. Git files-ref의 prepared transaction을 사용한다. Git이 HEAD.lock 및 symbolic referent lock을 잡은 뒤 raw HEAD kind/target과 old object를 재검사하고 current dual fence/단조시간 expiry를 확인한 후 commit한다. mismatch는 abort하며 foreign ref를 갱신하지 않는다. 실제 다른 `git symbolic-ref`가 HEAD.lock 때문에 거부됨을 detached/symbolic 양쪽에서 검증했다. 프로토콜 실행은 고정된 local update-ref 명령뿐이며 C09와 동일한 제한 환경 및 disabled hooks를 적용한다. 일반 Git/Hook 실행 API가 아니다.
4. shared index는 수정하지 않는다. receipt-bound file blobs로 만든 immutable tree의 actual parent diff와 changed_paths를 exact 비교한다. receipt에는 actual commit, parent, tree, HEAD kind/target이 들어간다.
5. write는 기존 dirty/staged/untracked의 pre-state에 receipt가 없으면 덮어쓰지 않는다. bounded bytes를 직접 검증 descriptor로 쓰며 임시 파일을 생성하지 않는다. catchable write/receipt/guard 실패에서 원문·존재 상태·시간 metadata와 내부 receipt/provenance를 복원한다. 따라서 R1의 temp 준비 구현 설명은 최신 R2 구현에 적용되지 않는다.
6. commit의 ref publication부터 receipt 저장 및 후속 guard 종료까지 하나의 보상 범위로 묶었다. 예외 시 자신의 exact new HEAD만 prior object로 돌리고 receipt 및 내부 head를 복원한다. foreign 상태를 덮어쓰지 않으며 source/index는 바꾸지 않는다. 복구는 진행 중 owner lock 안에서만 수행하고 새 실행 권한을 발급하지 않는다.
7. clock은 public operation 진입 및 callback 이후에 모든 service/lease lock 밖에서 캡처한다. lock 안에서는 캡처값만 사용하고 단조 elapsed time으로 최종 expiry를 검사한다. global per-thread operation taint로 same/foreign service 재진입을 차단하며 callback이 예외를 삼켜도 outer mutation을 거부한다. token 준비 중 facade reentry도 기존 LeaseService taint에 연결한다.
8. canonical grant/current worker/write/physical identity를 검증하기 전에는 clock high-water나 tombstone을 갱신하지 않는다. 실패한 acquire의 conflict 검사도 관측을 publish하지 않는다. 발급 전 또는 expires+5분을 넘는 시각은 bounded policy 밖의 invalid observation으로 거부하고 정상 현재 시각을 poison하지 않는다. 유효 expiry 관측과 B 인수 이후 A의 clock-rollback revival 차단은 유지한다.

### R2 실제 검증 기록

공통 `PY`, `TMP` 절대경로는 앞 절과 같다. 공통 pytest prefix: `PY -B -m pytest -q -p no:cacheprovider`.

| 추가 인자 | exit | 결과 |
|---|---:|---|
| `tests/agent_team/test_worktree_writes_e06.py -k final_head_kind --basetemp=TMP/e06-r2-red --tb=short` | 1 | RED4 failed/23 deselected, 83.32s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'final_head_kind or real_disjoint or post_cas' --basetemp=TMP/e06-r2-green --tb=short` | 0 | GREEN6 passed/21 deselected, 140.62s |
| `tests/agent_team/test_worktree_writes_e06.py -k prepared_native --basetemp=TMP/e06-r2-prepared --tb=short` | 1 | 2 failed/27 deselected, 43.56s; 보호는 동작했으나 Git 거부 exit128 가정과 실제 exit1 불일치 |
| `tests/agent_team/test_worktree_writes_e06.py -k prepared --basetemp=TMP/e06-r2-prepared-green --tb=short` | 0 | 3 passed/27 deselected, 58.47s; nonzero+HEAD.lock 거부 및 stale abort residue0 |
| `--import-mode=importlib tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r2-focused --tb=short -rs` | 0 | **추가 Quality 보완 전** 56 passed/1 skipped, 624.03s |
| `--import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=TMP/e06-r2-related --tb=short -rs` | 0 | **추가 Quality 보완 전** 568 passed/2 skipped, 905.98s |
| `tests/leases/test_repository_write_e06.py -k invalid_future --basetemp=TMP/e06-r2-clock-red --tb=short` | 1 | RED2 failed/22 deselected, 0.16s |
| `tests/leases/test_repository_write_e06.py --basetemp=TMP/e06-r2-clock-green --tb=short -rs` | 0 | 23 passed/1 skipped, 1.07s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'overwrite_unreceipted or receipt_publication or swallowed or clock_callback_reads' --basetemp=TMP/e06-r2-quality-red --tb=short` | 1 | RED7 failed/30 deselected, 125.71s |
| 동일 selection, `--basetemp=TMP/e06-r2-quality-green --tb=short` | 0 | GREEN7 passed/30 deselected, 111.08s |
| `tests/agent_team/test_worktree_writes_e06.py -k post_guard --basetemp=TMP/e06-r2-postguard-red --tb=short` | 1 | RED1 failed/37 deselected, 21.22s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'post_guard or real_disjoint or post_cas or prepared' tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r2-last-green --tb=short` | 0 | 6 passed/37 deselected, 130.98s; -k가 gateway tests를 deselect하므로 gateway PASS로 주장하지 않음 |
| `tests/agent_team/test_worktree_writes_e06.py -k 'foreign_service_clock or two_service_clock' --basetemp=TMP/e06-r2-foreign-clock --tb=short` | 0 | 2 passed/38 deselected, 33.16s |
| `tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` | 0 | 최신 control4 passed, 3.57s |
| `--import-mode=importlib tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r2-final-focused --tb=short -rs` | 0 | **R2 최종 focused 69 passed/1 skipped**, 781.86s; 8.3 alias 생성 비활성화 SKIP |
| `--import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=TMP/e06-r2-final-related --tb=short -rs` | 0 | **R2 최종 관련 581 passed/2 skipped**, 1067.61s; 8.3 생성 비활성화 및 isolated PG18 DSN 미설정 |

Git 2.53.0.windows.2의 로컬 설치 문서 `git-update-ref.html`과 실제 isolated probe를 함께 사용했다. native transaction 보호 거부의 exit 가정 오류는 테스트 expectation 오류로 교정했으며 formal count를 추가하지 않았다. 최신 전체 실행은 위 표의 final-focused/final-related이며 중간 실행과 구별한다.

### R2 범위·잔여 경계

- 제품 exact8/control exact9, total exact17 유지. control/WI/lease/history는 동결이며 Main R2 corrective 지시에 따른 제품 보완만 수행했다. checker SHA는 R0/R1과 동일하다.
- OS crash/durable restart recovery, DB UTC/multiprocess, 실제 8.3 alias 생성, isolated PG18, Provider/HTTP/UI/외부 전송/운영은 미검증이다. 실제 검증은 local temp Git files-ref와 파일·in-process 동시성/보상 경계다.
- 중간 fixture 14개는 각 절대경로/parent/정확한 이름 검증 후 native PowerShell Remove-Item으로 삭제했고 exit0/residue0이다. 최종 실행 중인 두 fixture는 유지한다. 임시 이름 집합: `e06-r2-ref-probe`, `e06-r2-red`, `e06-r2-green`, `e06-r2-prepared`, `e06-r2-prepared-green`, `e06-r2-focused`, `e06-r2-related`, `e06-r2-clock-red`, `e06-r2-quality-red`, `e06-r2-clock-green`, `e06-r2-quality-green`, `e06-r2-postguard-red`, `e06-r2-last-green`, `e06-r2-foreign-clock`.
- rollback 및 후속 판정은 Main 소유다. canonical commit/push/acceptance/lease revoke/E07 시작을 하지 않았다.

### R2 최종 인계

- fresh 최종 focused/관련 command는 위 표의 `PY`를 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`, `TMP`를 `D:/Project/Anvil/.codex-sandbox`로 치환한 정확한 명령이다. 둘 다 프로세스 exit0을 확인했다. focused69/1skip, 관련581/2skip만 최신 결과로 사용한다.
- 보고서 갱신 후 control을 다시 실행했다: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` → exit0, 4 passed in 3.21s.
- `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/worktree_writes.py packages/leases/service.py packages/tool_gateway/gateway.py tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` → exit0.
- `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py` → exit0, PASS sequence1113/reporting AUTO_CONTINUE. `git diff --check` → exit0. `git diff --cached --name-only` → exit0/empty. `git rev-parse HEAD` → 위 기준선 그대로. checker SHA256는 `85AF7194A13626D60DE8CF8B1F772E7DDC0D63D4B8D59CE2E9A80BE7E49B3FC2`로 동결 상태다.
- `git status --porcelain --untracked-files=all`의 경로를 WI product8/control9의 정렬된 exact 목록과 Compare-Object로 비교한 결과 차이0, dirty exact17/staged0이다. tracked 제품 numstat는 `packages/agent_team/__init__.py +4/-0`, `packages/leases/service.py +148/-2`, `packages/tool_gateway/gateway.py +27/-1`; 신규 facade/tests/report는 별도 untracked 제품 산출물이다. unrelated/control 제품 보완 변경0.
- 종료한 final-focused/final-related 두 경로도 각각 절대경로와 `.codex-sandbox` parent를 exact 확인한 뒤 Remove-Item으로 정리했다. exit0, `ALL_E06_TEMP_RESIDUE=0`. R2 총16개 재생성 가능한 synthetic fixture만 제거했고 사용자/원본 저장소는 손대지 않았다.
- 완료보고 patch 중 마지막 anchor의 단어 불일치1은 apply_patch 사전 검증에서 write0으로 거부됐고, 정확한 좁은 anchor로 수정했다. 파일 손상0이며 정식 제품 실패를 추가하지 않는다. formal failure count2를 유지한다.
- 완료 전 검증 스킬의 evidence-before-claims 원칙에 따라 실제 종료 코드와 새 전체 회귀를 확인한 뒤 상태를 변경했다. 최종 acceptance는 Main의 별도 독립 spec/quality 검토 소유다. progress/HANDOFF/lease는 seq1113 active 상태를 유지하며 Developer는 변경하지 않았다.
- 남은 정확한 행동: Main 독립 R2 검토. OS crash/restart durable recovery 및 DB UTC/multiprocess adapter는 **NOT_INTEGRATED**, 실제 8.3/isolated PG18는 **SKIPPED**, Provider/HTTP/UI/외부 전송/운영은 **NOT_EXECUTED**다. 승인된 in-process exception atomicity를 이 경계 이상의 PASS로 승격하지 않는다. rollback은 검증된 기준선과 exact 제품 diff/evidence를 보존한 뒤 Main의 역 patch 검토이며 control 역사 재작성·자동 merge/PR/원본 적용은 없다.

## R3 — indirect symbolic-ref chain identity

### 판정·판단 이유

- Main 독립 재검토: Spec REWORK I1, Quality REWORK C1/I0/M0. 두 판정은 같은 `E06-HEAD-SYMBOLIC-REDIRECT`/branch-identity TOCTOU lineage의 indirect referent 변형이다. package formal count3, 동일 lineage count2(R2 direct target, R3 indirect chain)이며 Main의 명시적 판단에 따라 Developer를 유지했다. 새로운 독립 blocker는 없다.
- R2는 raw HEAD 첫 hop만 검사했다. HEAD→owned는 그대로인데 owned→foreign으로 변하면 native Git이 새 chain을 따라 foreign을 갱신했다. 실제 loose/packed/nested RED3과 final_target receipt 누락 RED1로 재현했다.
- 제품 exact8/control9 및 기존 lease/만료시각은 변경하지 않았다. R3에서는 facade/test/report만 보완하며 control/WI/start history를 재작성하지 않는다. 이전 R2 완료는 최신 acceptance가 아니다.

### 조치

- ref chain을 최대8개 항목으로 resolve하여 각 name/raw kind/exact symbolic target 또는 direct object를 immutable tuple로 결박한다. cycle/depth/unborn/unsafe ref identity는 domain denial이다. packed direct entry는 bounded packed-refs에서 유일한 exact ref/object로 읽고, loose/packed 표현 차이는 권위 확대가 아닌 같은 direct identity로 취급한다.
- native prepared `update HEAD`가 모든 symbolic hop 및 최종 direct ref의 lockfile을 잡는 것을 별도 실제 Git probe와 integration test로 확인했다. 새 lock owner를 구현하지 않고 prepare 전후 full-chain 동일성과 각 exact lock 존재, current fencing을 검증한다. mutation 직후에도 expected new object를 가진 같은 chain을 확인한다.
- receipt는 실제 parent/tree/paths 외에 첫 head_target, final_target, immutable head_chain 및 그 SHA256을 결박한다. 정상 nested/packed commit과 exact retry, 기존 detached/symbolic regression을 함께 검증한다.
- 리뷰 수신·체계적 디버깅·TDD 스킬에 따라 실제 실패와 Git lock 행동을 먼저 확인했다. 처음 검토한 explicit symref-verify 조합은 Git duplicate-HEAD 제약이 있어 채택하지 않았다. bare-store 수동 hop lock prototype도 검증했지만 기존 native transaction 재사용으로 해결돼 제품에 추가하지 않았다.

### R3 실행 기록

공통 prefix는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider`, TMP는 `D:/Project/Anvil/.codex-sandbox`다.

| 추가 인자 | exit | 실제 결과 |
|---|---:|---|
| `tests/agent_team/test_worktree_writes_e06.py -k 'indirect_referent or nested_referent' --basetemp=TMP/e06-r3-red --tb=short` | 1 | RED4 failed/40 deselected, 128.21s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'prepared_nested or invalid_symbolic' --basetemp=TMP/e06-r3-boundary-red --tb=short` | 1 | RED3 failed/1 passed/44 deselected, 68.13s; malformed domain denial3, 기존 all-hop native lock characterization1 PASS |
| `tests/agent_team/test_worktree_writes_e06.py -k 'indirect_referent or nested_referent or prepared_nested or invalid_symbolic or final_head_kind or post_cas or real_disjoint' --basetemp=TMP/e06-r3-green --tb=short` | 0 | GREEN14 passed/34 deselected, 275.54s |
| `tests/agent_team/test_worktree_writes_e06.py -k 'between_preflight or nested_referent' --basetemp=TMP/e06-r3-chain-window --tb=short` | 0 | 3 passed/47 deselected, 78.64s; 정상 nested loose/packed 및 preflight→prepare redirect |
| `tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` | 0 | 4 passed, 3.55s |
| `--import-mode=importlib tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py --basetemp=TMP/e06-r3-final-focused --tb=short -rs` | 0 | **R3 최종79 passed/1 skipped**, 995.45s; 8.3 생성 비활성화 |
| `--import-mode=importlib tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends --basetemp=TMP/e06-r3-final-related --tb=short -rs` | 0 | **R3 최종591 passed/2 skipped**, 1265.34s; 8.3 생성 비활성화/isolated PG18 DSN 미설정 |

격리 probe의 고정 Git transaction은 `start`, `update HEAD <new> <old>`, `prepare`, `abort`였다. 실제 HEAD/owned/final `.lock`3개, 모든 symbolic-ref redirect exit1+lock 오류, abort exit0/lock residue0을 확인했다. `symref-verify`를 반복하는 초기 대안은 per-command no-deref 필요/duplicate HEAD/bad pseudo-ref name으로 exit128이며, 한 interactive probe의 종료 후 stdin write는 OSError exit1이었다. 이들은 제품 변경 전 안전한 폐기 prototype이며 정식 실패를 추가하지 않는다. TemporaryDirectory가 각각 정리했고 원본 저장소는 사용하지 않았다.

### R3 최종 인계

- 제품 변경은 `packages/agent_team/worktree_writes.py`, `tests/agent_team/test_worktree_writes_e06.py`, 이 보고서다. R2 나머지 제품5/control9 bytes는 유지했다. 누적 dirty exact17(product8/control9), staged0, HEAD/branch/seq1113/active dual lease 및 만료시각은 기존 기준선과 동일하다.
- 최종 facade SHA256 `D2CA8F8CB4E08E24ABC1526945058B61B9844A3DA000DAD96BBF5C887D1FF307`, test SHA256 `56BB6F9FE46143C5FBF607648A1C1234E756BD58B65D73EF64BF154485B9A208`. WI/invocation/checker SHA256는 앞 절의 고정값 그대로다.
- 최종 control 재실행: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E05StartControlTests tests/tooling/test_project_progress.py::E06StartControlTests --tb=short` → exit0, **4 passed in 3.61s**.
- `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py` → exit0/PASS sequence1113. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/worktree_writes.py packages/leases/service.py packages/tool_gateway/gateway.py tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` → exit0. `git diff --check` → exit0; `git diff --cached --name-only` → empty.
- R3 exact fixture6개(red, boundary-red, green, chain-window, final-focused, final-related)를 각 절대경로/parent/이름 확인 후 Remove-Item으로 정리했다. cleanup 명령 exit0, **ALL_E06_TEMP_RESIDUE=0**. 폐기 prototype은 TemporaryDirectory 종료 및 최종 잔여 검사로 정리를 확인했다. 재생성 가능한 synthetic 자원만 제거했다.
- 완료 전 검증 스킬에 따라 이번 전체 suite의 실제 종료 코드와 수치가 나온 뒤 판정을 갱신했다. 실제 in-process Git files-ref/file/rollback 검증이며 durable process-crash recovery와 DB UTC/multiprocess adapter는 **NOT_INTEGRATED**다. 실제 8.3/PG18는 **SKIPPED**, Provider/HTTP/UI/외부 전송/운영은 **NOT_EXECUTED**다.
- 다음 정확한 조치는 Main의 독립 R3 재검토다. rollback은 Main이 기준선·exact 제품 diff/evidence를 보존하고 해당 제품 역 patch를 검토한다. control 역사 재작성, 자동 integration/merge/PR/source 적용, acceptance/lease revoke/commit/push/E07을 수행하지 않았다.

## R4~R8 Main takeover 최종 완료

### 판정

`COMPLETED / INDEPENDENT ACCEPT RECOMMENDED` — R4에서 branch identity publication 동일 계열의 세 번째 유효 실패가 확정되어 Developer를 중지하고 Main이 직접 인수했다. 이후 Main 수정에 대한 독립 검토에서 확인된 in-scope 결함까지 R8에서 닫았다. 최신 독립 판정은 Spec `C0/I0/M0 ACCEPT`, Quality `C0/I0/M0 APPROVED`다. package formal failure count는 5이며 모두 해결됐다. 본 판정은 Windows local Git/filesystem 및 in-process exception atomicity 범위다.

### Main 인수와 해결한 failure lineage

1. R1: 물리 alias의 중복 write authority, clock rollback revival, unreceipted dirty/index interleave, partial file publication, callback lock/reentry 계열.
2. R2: direct HEAD 종류·target 변경이 게시 대상을 바꾸는 branch identity TOCTOU 및 후속 clock/receipt 보완.
3. R3: HEAD 첫 hop은 같지만 indirect symbolic chain이 foreign ref로 바뀌는 동일 branch identity 계열.
4. R4: Git transaction `commit: ok` 뒤 intermediate symref가 바뀌면 bound final ref는 이미 전진했는데 facade가 실패·receipt 없음으로 끝나는 동일 계열 세 번째 변형. 이 시점에 Main takeover를 발동했다.
5. R5~R8 Main review: 게시 뒤 receipt 예외 보상이 current HEAD를 따라 bound final을 놓치거나 same-OID symbolic identity를 덮는 문제, workspace `.git`/common object root/fanout 재지정으로 원본 object store를 오염하는 문제.

TakeoverPacket은 `docs/work_orders/E-06_MAIN_TAKEOVER_PACKET_R4.md`다. 기능 범위·요구사항·중요 위험은 변경하지 않았으며 E-07/E-08/E-10 기능을 선점하지 않았다.

### 최종 구현 경계

- Git prepared transaction의 `commit: ok`를 게시 linearization point로 사용한다. 그 전에는 원래 symbolic chain 전체와 final ref lock, exact identity, current dual fence를 확인한다.
- 게시 뒤 intermediate chain이 바뀌어도 원래 bound final에 게시된 commit의 immutable receipt를 남긴다. exact retry는 current grant를 확인한 뒤 기존 receipt만 반환하며 새 request는 chain drift로 거부한다.
- 게시 뒤 예외 보상은 current HEAD를 따르지 않는다. 원래 final ref를 prepared no-deref transaction으로 잠근 후 direct kind/OID를 확인하고 CAS rollback한다. foreign symbolic identity가 끼어들면 덮지 않고 `COMMIT_RECOVERY_REQUIRED`다.
- post-acquire Git 명령은 등록된 per-worktree git-dir와 managed common-dir에 고정하고 외부 `.git` pointer를 따르지 않는다.
- managed object root와 256개 loose-object fanout을 생성·물리 결박한다. Windows object writer 동안 모든 fanout handle을 read/write share, delete-share 없음으로 유지하고, handle 획득 후 object write 전에 전체 identity/reparse를 다시 검사한다. root/fanout junction 및 pre-handle 교체는 source write 전에 `WORKSPACE_GIT_STORE_DRIFT`로 거부된다.
- source 일반 파일·Git store, foreign branch/ref, shared index는 receipt가 증명한 격리 commit 외에는 변경하지 않는다.

### R4~R8 RED → GREEN

공통 prefix는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib`, 모든 basetemp는 `D:/Project/Anvil/.codex-sandbox` 아래 고유 절대경로다.

| 구분 | exit | 실제 결과 |
|---|---:|---|
| post-commit intermediate retarget 단일 RED | 1 | 1 failed, 24.36s; `WORKSPACE_HEAD_IDENTITY_DRIFT`, bound final 전진/receipt 없음 |
| R4 관련 GREEN | 0 | 5 passed, 122.60s |
| `.git` pointer redirect + retarget/receipt-exception RED | 1 | 2 failed, 39.34s; foreign object store write 및 bound final rollback 누락 |
| R5 핵심 GREEN | 0 | 3 passed, 57.29s |
| object root/fanout, compensation identity, source-zero 최신 targeted | 0 | 4 passed, 102.50s |
| corrected fanout junction RED | 1 | 1 failed, 21.87s; service가 source object fanout write를 거부하지 않음 |
| final fanout handle/pre-yield 보완 targeted | 0 | 4 passed, 102.50s |

독립 Spec은 최신 facade SHA에서 object root junction, fanout junction, 정상 disjoint source-zero exact3을 실행해 **3 passed in 78.54s**, 별도 pre-handle replacement probe도 source 변경0/receipt0을 확인했다. 독립 Quality는 정상 commit, object root/fanout 거부, receipt 유지, 예외 보상, symbolic identity 보존 exact6을 실행해 **6 passed/50 deselected in 146.10s**를 확인했다. 둘 다 `git diff --check` exit0, fixture residue0, 제품 수정0이다.

### 최신 전체 검증

- focused: `tests/agent_team/test_worktree_writes_e06.py tests/leases/test_repository_write_e06.py tests/tool_gateway/test_worktree_mutation_e06.py` → exit0, **85 passed/1 skipped in 1222.20s**. SKIP은 해당 볼륨의 실제 8.3 alias 생성 비활성화다.
- related: `tests/agent_team tests/leases tests/tool_gateway tests/paths tests/execution_backends` → exit0, **597 passed/2 skipped in 1546.89s**. 추가 SKIP은 isolated PostgreSQL18 DSN 미설정이다.
- compileall exact 제품/테스트 및 `git diff --check` → 각각 exit0.
- 최종 facade SHA256 `14FB02DE1C8CAA27B506003CE5CAD649F69036A57ECE0E82BDF83B9C22C089C8`; E06 test SHA256 `3DB2A61FE5DB3316BC34195DDA53FFC7A5C1AB6890211CFE8EA5F8F23D5D7B1D`.
- 최신 product exact8, start control exact9, takeover packet exact1로 pre-final dirty exact18/staged0다. final acceptance manifest/digest를 더하면 combined exact20이다.

### 미검증·비통합·rollback

- DB UTC/multiprocess lease adapter와 OS process-kill/restart durable journal은 `NOT_INTEGRATED`다. catchable in-process exception atomicity를 process-crash 내구성으로 승격하지 않는다.
- 실제 8.3 alias 및 isolated PG18은 `SKIPPED`; Provider, HTTP/UI, WSL runtime, external send, deployment, production은 `NOT_EXECUTED`다.
- 임시 검증 경로는 각 실행 종료 후 exact parent/name 확인 뒤 삭제했다. 중단한 오래된 focused와 독립 review orphan fixture도 실행 프로세스 종료 확인 후 해당 synthetic 경로만 삭제했다.
- rollback은 기준선 `039c53acd6d79895d3c94e1bc21b72d1b54283f9`와 본 exact 제품/control evidence를 보존한 뒤 E-06 단일 commit을 되돌리는 방식이다. source 저장소, unrelated 사용자 파일, history rewrite, force push, stash/clean을 사용하지 않는다.
