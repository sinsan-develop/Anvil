# E-11 완료보고 — developer-primary-e11-r1

## 판정

`COMPLETED` — 구현과 승인된 로컬 계약 검증 완료. Developer 자체 검증이며 Main ACCEPTED/독립 Tester PASS/Owner 활성화 결정을 대신하지 않는다. formal FAILURE_REPORT **0**; 직전 quota/tool 중단은 정식 실패가 아니다.

## 판단 이유

- 기준 HEAD `98e218264bf54db04a1bd35a67273b713805a649`, branch `codex/c09-execution-backends-r1`, canonical sequence1169. 시작 dirty는 Main control9이며 보존했다. 제품 exact5만 신규 작성했고 stage/commit/push0.
- WI SHA256 `615025F0CC168FCE1B4377A3D1B110B05915D2BE766954554F28318DC3203018`, invocation `0BF3C7F268B84E2A5A62DC0BBC3EE8276A9EF6F5D77B48E2423E78289533CDE5`를 전부 읽고 일치 확인.
- 설계 `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`, 계획 `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`, 매트릭스 `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`, 테스트계획 `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.
- worker `worker-lease-e11-r1-20260918-001`, execution `e11-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-e11-r1-20260918-001`, write fence `e11-r1-write-fence-epoch-1-4a1bd35a67273b71`. 발효 `2026-09-18T01:08:09+09:00`, 만료 `2026-09-18T13:08:09+09:00`, 작업 중 ACTIVE 재확인.
- E04 TaskGraph/DagQueueService, B09/B10 LeaseService, E08 BudgetService와 실제 E09 ReleaseGateService/E10 GitAdapterHost public seam을 재사용한다. fixture는 read-only 데이터 변환을 실제 bounded local threads로 실행하며 Provider/원격 실행을 하지 않는다.
- fixture/golden/target/delivered/graph/dual fence/budget를 result hash에 결박하고 immutable detached 반환, exact replay와 conflict replay 거부, Single 축소, 독립 실패 격리와 비용 보존을 구현했다.

## 조치 / 변경 exact5

| 경로 | diff 요약 |
|---|---|
| packages/verification/parallel_e2e.py | 신규 host-only fixture capture·benchmark·comparison·publication guard·E09/E10 admission 연결 |
| tests/verification/test_parallel_e2e_e11.py | 신규 focused 61개, owner 기반 경쟁/적대/신뢰사슬 검증 |
| tests/fixtures/e11/large_migration.json | 16 task × 64 row = 1024행, golden 변환/발견 집합 |
| tests/fixtures/e11/bug_hunt.json | 16 task × 32 row = 512행, golden defect128개 |
| docs/04_test_reports/E-11_COMPLETION_REPORT.md | 본 보고서 |

모든 제품 파일은 신규이므로 diff는 전체 내용이다. Main control9 및 progress/HANDOFF를 수정하지 않았다. 기존 owner/schema를 변경하지 않았다.

## TDD / 오류 기록

아래 focused 명령 F로 순차 실행했다.

1. module 부재 RED exit1 **11 failed/1.32s** → 최소 benchmark GREEN exit0 **11 passed/1.54s**.
2. E09 fixture subject 변경 시 일부 baseline hash를 기존 값으로 남겨 `EVIDENCE_TARGET_MISMATCH` 7개와 미구현 guard1, exit1 **8 failed/15 passed/2.17s**. fixture의 동일 subject hash 전량 결박을 정정했다. 그 뒤 실제 미구현 admit/guard RED exit1 **8 failed/15 passed/2.28s** 확인.
3. admission/guard 보완 후 random token이 E10 canonical identifier 형식 밖으로 생성되는 fixture 환경 문제1, exit1 **1 failed/22 passed/2.43s**. test-only deterministic token prefix 사용 후 exit0 **23 passed/2.43s**.
4. dual fence/budget receipt 명시 결박 RED exit1 **1 failed/59 passed/3.45s** → GREEN exit0 **60 passed/3.74s**.
5. bounded actual local thread test `F -k bounded_real`: exit1 **1 failed/60 deselected/0.64s** → ThreadPoolExecutor 변환 도입 후 최종 focused exit0 **61 passed/3.84s**.

위는 test-first/fixture 정정 과정이며 formal FAILURE_REPORT가 아니다. callback/alias/bounds 입력은 owner 소비 전에 builtin 검사로 차단한다. public agent callback/shell/provider 입력 seam은 없다.

## 정확한 명령 / 결과

cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.

F: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_parallel_e2e_e11.py --tb=short`

- exit0 **61 passed in 3.84s**, skip0.

R: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/queue tests/leases tests/budget tests/verification tests/git_adapter tests/agent_team/test_concurrency_e05.py tests/agent_team/test_worktree_writes_e06.py tests/orchestration/test_exception_resolver_e07.py --basetemp=D:/Project/Anvil/.codex-sandbox/e11-regression-20260918-r1 --tb=short -rs`

- exit0 **1040 passed, 15 skipped in 673.03s (0:11:13)**. Skip15는 isolated PostgreSQL18 DSN 미설정6(queue1/leases1/budget4), `ANVIL_TEST_DATABASE_URL` 미설정8(C01), volume의 8.3 alias generation 비활성1이다. 해당 실제 환경 검증은 PASS가 아니라 미검증으로 남긴다. 기존 E06 owner 회귀의 temporary filesystem/local Git 사용은 E11 실제 Git 연결 증거가 아니다. 공용 Temp 대신 승인 workspace-local 전용 basetemp를 사용했다.

C: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k E11StartControlTests --tb=short`

- exit0 **2 passed, 666 deselected in 9.09s**.

S: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; import json; paths=['packages/verification/parallel_e2e.py','tests/verification/test_parallel_e2e_e11.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; [json.loads(Path(p).read_text()) for p in ['tests/fixtures/e11/large_migration.json','tests/fixtures/e11/bug_hunt.json']]; print('COMPILE2 JSON2 PASS; pycache0')"`

- exit0 **COMPILE2 JSON2 PASS; pycache0**.

P: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`

- exit0 **PASS sequence=1169 reporting=AUTO_CONTINUE**.
- `git diff --check` exit0; `git diff --cached --name-only` empty/exit0.

M(raw benchmark): `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "import runpy,json; t=runpy.run_path('tests/verification/test_parallel_e2e_e11.py'); h=t['host']()[0]; data=[t['fixture'](n) for n in ['large_migration','bug_hunt']]; refs=[h.capture(d) for d in data]; fields=['fixture_hash','golden_hash','delivered_hash','wall_units','reserved_total','actual_cost','completed','failed','blocked','precision','recall','quality_pass']; results=[h.run(d['id']+'-'+mode,r,mode=mode,at=t['NOW'].isoformat()) for d,r in zip(data,refs) for mode in ['SINGLE','PARALLEL']]; print(json.dumps([{k:r[k] for k in fields} for r in results],indent=2))"`

- exit0, 아래 원시 수치와 동일.

## Benchmark 원시 측정 / 해석

| Fixture | Mode | wall-unit | reserved 합 | actual 비용 | 완료/실패/차단 | precision | recall |
|---|---|---:|---:|---:|---|---|---|
| large_migration | Single | 64 | 32 | 16 | 16/0/0 | 1024/1024 | 1024/1024 |
| large_migration | parallel4 | 16 | 32 | 16 | 16/0/0 | 1024/1024 | 1024/1024 |
| bug_hunt | Single | 48 | 32 | 16 | 16/0/0 | 128/128 | 128/128 |
| bug_hunt | parallel4 | 12 | 32 | 16 | 16/0/0 | 128/128 | 128/128 |

비용은 synthetic ledger 단위이며 실제 청구 비용이 아니다. wall-unit은 fixture가 승인한 작업량 합/동시 wave 최대값이며 실제 elapsed latency/Provider 성능이 아니다. 실제 local thread barrier는 동시4/상한4를 별도로 검증한다. 두 fixture 모두 golden output과 delivered hash가 일치한다. 권고 `ELIGIBLE_FOR_LIMITED_PARALLEL`은 해당 synthetic 조건에서만 성립하며 자동 활성화/Main acceptance는 false다. golden 훼손/비용비율 불충족/속도기준 불충족은 `DO_NOT_ENABLE_PARALLEL`이다.

- migration canonical fixture hash `sha256:b972cf575ecc198ac9f85f99c1ad9364de39ad0960adb0dee0c09a43509e78df`
- migration golden=delivered `sha256:cec1a5293b268c863bb2d52a150710defd14aa1b57fa333025bef5f47b22f85c`
- bug hunt canonical fixture hash `sha256:d55b2f0102612b0869e484f424552faceeb10e37fd6c1f96a13c2e4c95a04a43`
- bug hunt golden=delivered `sha256:972a937a1444d3706d828a90d99e563f3dc3464db8fc1718f39544c98a63ed0c`

## 검증 ID / 신뢰사슬

- **AV-AGT-034**: 동일 fixture/golden에서 Single/parallel 비용·작업량·품질 비교, 품질/비용/속도 부적합 시 보류 권고. L7 최종 Owner 판단은 아직 미실행.
- **AV-FLOW-023**: bounded local parallel, canonical shuffled ordering/hash, dependency/path/subject/write/non-independent의 Single 축소. task00 실패 시 task01/02만 BLOCKED_DEPENDENCY, task03~15 성공: 실패1/차단2/완료13이며 전체 FINISHED_WITH_FAILURES, quality_pass false.
- **§49.17-3/4/5/7**: actual in-memory LeaseService FIX-CONFLICT 100회 두 thread 경합에서 획득 `[1]*100`, 이중 획득0. actual BudgetService 100-way 경쟁 hard3에서 send3/거절97/send0, unknown abort exposure3 유지. fixture budget3에서는 send1/거절15, PAUSED/new_action_allowed false. cancellation은 비용1과 CLIENT_DISCONNECTED 보존, UNKNOWN은 None/exposure2 유지.
- A 만료/B takeover 뒤 QUEUE/STEP/TOOL/COMMIT fixture publication guard 모두 STALE_FENCING_TOKEN. 별도 실제 DagQueue visibility claim takeover 후 old completion 거부 및 실제 E10 Git adapter current fence 변경 후 old grant send0을 검증했다. Tool 실제 실행은 하지 않았다.
- 실제 E09 ProductValidation/Defect/Release/Apply 승인 public owner와 E10 exact grant를 연결했다. target/delivered mismatch, forged/revoked approval, blocking defect, ProductValidation BLOCKED는 driver0. 정상 fake receipt는 Main acceptance/real Apply를 생성하지 않는다.
- **AV-STAT-041/042**: Main canonical acceptance/DIR-3 control의 책임이다. 제품은 DIR trigger/direction/Gate/F-01 전이를 생성하지 않는다. 이 Developer 보고를 ACCEPTED나 DIR CLEARED 증거로 승격하지 않는다. 독립 acceptance 직후 Main의 DIR_HOLD와 direction 검증은 후속 필수 통제이며 제품 focused PASS로 표시하지 않는다.

## 제품 SHA256

- parallel_e2e.py `794074EAF923C2795A9E36F0C6666648F41C578E37D3549A3E37240E73E96BEA`
- test_parallel_e2e_e11.py `C1ADBBFFB3D3F9B0DB37A07C36764B2F5B9AD5EE944E6577BAC9F0D004E64BEB`
- large_migration.json `74100E6EA42DCBC302740F60F7F3EEEC0427F4D1264D6313C914D9AD42DCD6CB`
- bug_hunt.json `F457EBE34242BF24DBCC154A295AF1EB2BE429DCFA51859A8303E3764D5799B2`
- 보고서 SHA는 self-reference 없이 최종 결과에 제공한다.

## 미검증 / 잔여 위험 / rollback

E11 Provider/network/DB/remote Git/PR/merge/UI/deploy는 **NOT_EXECUTED**. 실제 DB UTC/multiprocess queue·budget·lease 원자성, cross-owner durable transaction/crash recovery, native Tool runtime integration은 **NOT_INTEGRATED**. Lease100회는 동일 run/scope의 기존 in-memory owner 검증이며 physical cross-workspace alias/DB evidence로 승격하지 않는다. E09의 `real` 필드는 기존 host-capture fixture의 계약 입력일 뿐 실제 외부 검증 실행을 의미하지 않는다.

기존 관련 회귀의 격리 임시 파일은 전용 basetemp에 보존한다. 원본 worktree/운영 DB/remote 자산 삭제0. rollback은 Main이 신규 exact5만 검토해 되돌리며 control9와 기존 사용자 자료는 보존한다. progress/HANDOFF는 Main 소유로 미갱신, lease revoke/acceptance/commit/push0. 전체 dirty exact14는 control9+product5이고 staged0이다. 완료 전 검증 스킬에 따라 관련 회귀 종료 코드/실제 수치 확인 후에만 COMPLETED로 갱신했다. 다음 조치는 독립 spec/quality 검토이며 E Gate/F-01을 시작하지 않는다.
