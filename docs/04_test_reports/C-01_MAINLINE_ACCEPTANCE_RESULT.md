# C-01 Mainline acceptance projection 결과

## R4 현재 판정 — 비의미 오기 정정·Main full tooling receipt

### R4 writer targeted 완료 checkpoint

판정 `COMPLETED`(문서·증거 정정 및 writer targeted 범위). `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUTF8=1`에서 `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -k C01MainlineAcceptance -q -p no:cacheprovider --tb=short` → exit0, `10 passed, 310 deselected in 24.13s`. live `.venv\Scripts\python.exe scripts/check_project_progress.py .` → exit0, `G-05 project progress contract: PASS sequence=715 reporting=AUTO_CONTINUE`.

read-only comprehensive audit → exit0 `R4_AUDIT_PASS`: generated7 두 build/live byte 동일, checksum19, R3 parent exact20 checksum snapshot/manifest binding, seq1~700 raw prefix2157757 bytes와 semantic·새701~715 chain, historical evidence272, 제품unique9/occurrence11/projection20/cumulative28·parent/ancestry·private authority·WORK_STATUS append-only, epoch4 start/revoke·progress/HANDOFF, syntax5·diff-check PASS. current historical32/map OPS-R2 2를 유지한다. 오기18/Minor1 resolved·Main697의 정정 전 실행 경계 및 재해시된 허위698 receipt rejection을 확인했다.

checker 변경을 메타데이터 patch만 역변환하면 R3 source SHA와 같고, test 파일도 epoch 기대 literal2개를 역변환하면 R3 SHA와 같음을 확인했다. G07 checker/test·독립suite·raw2는 R3 bytes 그대로다. 제품·테스트 판정 로직 변경0이다. 마지막 checkpoint를 재해시한 뒤 live/audit를 다시 검증한다. Main의 정정 후 focused/checker/checksum/determinism은 다음 별도 gate다.

신규 오류 `C01-R4-DOCUMENT-PATCH-HUNK-ORDER-v1` count1은 문서 patch의 역순 hunk가 atomic하게 변경 전 거부된 비제품 도구 오류다. 순서 정정 후 성공했고 새 제품/검증 실패0, 동일 원인3회 반복0이다. 기존 full attempt1 두 fingerprint각1 및 status-poll syntax1은 보존한다.

Main full tooling R3 attempt2: `.venv\Scripts\python.exe -m pytest tests/tooling -q -p no:cacheprovider` → exit0, `697 passed in 1661.64s (0:27:41)`. 출처는 Main 실행 결과 전달이며 writer 실행이 아니다. 정정 이전 R3 exact20에서 실행됐고 부모 manifest SHA `D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F` 및 당시 exact20 checksum snapshot을 현재 manifest에 보존한다. R4 정정 후 full suite 실행으로 승격하지 않는다.

Main 전달 Reviewer final SPEC PASS / QUALITY APPROVED C0/I0/M1의 Minor는 WI 항목7 Developer-test rerun20 오기다. 실제 regression18에 맞춰18로 정정하여 resolved했다. canonical evidence는 이미18이었으며 새 독립 Tester 실행·기대값 변경0이다. 로컬 추적 ID `C01-DEVELOPER-TEST-COUNT-TYPO-v1`, count1은 이력으로 보존한다. 기존 Important 및 full attempt1 실패 이력도 아래 보존한다.

`MAIN_RECONFIRMED_NON_SEMANTIC` / epoch4 / exact20 / cumulative28. worker `worker-lease-c01-mainline-acceptance-projection-r4-20260911-001`, execution `c01-mainline-acceptance-execution-fence-epoch-4-66c0e43`; write `write-lease-c01-mainline-acceptance-projection-r4-20260911-001`, token `c01-mainline-acceptance-write-fence-epoch-4-66c0e43`. 이전 epoch1/2/3 무효. 제품·테스트 판정 로직 변경0, lease/증거 metadata와 epoch 기대 literal만 갱신한다.

R4 targeted 검증 결과는 아래 후속 checkpoint에 기록한다. Main의 정정 후 focused/checker/checksum/determinism은 별도 후속 gate다. C-01 ACCEPTED는 LOCAL_FIXTURE_CONTRACT_SCOPE만이며 actual Provider/Telegram/backend swap E2E 등 외부 NOT_EXECUTED를 유지한다. commit/push/merge 없음. 이하 R3/R2/R1은 당시 판정·실패·미검증 이력이다.

## R3 현재 판정 — full tooling 실패 수정·현재 집계 재계산

### R3 최종 검증·인계

writer 상태 `COMPLETED`; Main의 전체 tooling fresh 재실행은 다음 gate다. 아래 명령은 `.venv\Scripts\python.exe`와 `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUTF8=1` 환경에서 실행했다.

- 이전 실패20개의 정확 node IDs를 지정한 `-m pytest <20 exact node IDs> -q -p no:cacheprovider --tb=short`: exit0, `20 passed in 24.37s`. 목록/전체명령은 scratch 상세 보고서에 기록한다. cache나 --lf에 의존하지 않았다.
- `-m pytest tests/tooling/test_project_progress.py -k 'C01MainlineAcceptance or C21PostmergeDevelopmentAuthorityReconciliation or C21FinalAcceptanceProjectionReconciliation or exact_evidence_only_descendant_rejects_each_provenance_violation' -q -p no:cacheprovider --tb=short`: exit0, `21 passed, 299 deselected in 42.89s`.
- `-m pytest -p no:cacheprovider tests/verification/test_c01_independent_acceptance.py -q`: exit0, `9 passed in 0.33s`(writer 추가 재현, 원 Tester 판정과 별도).
- `scripts/check_project_progress.py .`: exit0, `G-05 project progress contract: PASS sequence=715 reporting=AUTO_CONTINUE`.
- generated7 two-build/live equality, checksum19, exact20/cumulative28/product unique9·occurrence11/sole parents·ancestry, epoch3 start/revoke·HANDOFF/manifest, syntax5·diff-check PASS. 역사evidence272개와 seq1~700 prefix2157757 bytes/SHA60EF142108978724C37E395B5B5C39FDE6504B65F7F5FFDEE336F41E5E937692, semantic04F82C5795671A4382D87AB3F31761EC06657CA7023D17B405CBB75EC8385DDC 불변.
- 실제 G07 no-active current 집계32/map OPS-R2 2 및 failure-related errors0 확인. 원 ledger/seq700 raw 불변. 마지막 문서 기록 뒤 checksum을 재결박하고 live/audit를 반복한다.
- 추가 내부 오류는 Counter import 누락1회, 문서 patch anchor 불일치1회이며 모두 해소했다. 같은 근본 원인3회 반복 없음. full attempt1과 status-poll syntax 오류1회는 아래에 보존한다.

Main full attempt1은 exit1, `20 failed, 673 passed in 1675.07s`였다. R2 focused 완료를 full tooling 완료로 승격하지 않는다. 원인 `C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1` count1(19개 test failure)과 `C01-GIT-MUTATION-ERA-EXPECTATION-v1` count1(1개 test failure)을 보존한다. Main status-poll wrapper syntax error count1은 non-product tool error다.

G07는 명시적 null을 no-active(idNone/count0)로 처리하고 기존 active/historical mismatch guard를 유지한다. C01 현재집계는 제품fix66c0e43에 고정된 failure-ledger SHA `C3C6A25E50946664F645FA1E1622555CCB553B57522E2D5BD6FF141B49470A73`에서 유효32건과 전체 map을 도출한다. OPS-R2는2다. seq700의 역사31/map1 raw와 failure ledger는 바꾸지 않는다. count31·active1 및 map-only 변조는 각 guard와 C01 strict reconstruction에서 거부한다.

Git mutation test는 seq715의 정확한 `C01_ACCEPTANCE_GIT_BASE_OR_PRODUCT_INVALID`를 기대하고 별도 frozen generic fixture는 기존 `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 검증한다. collector 우선순위·3개 허용상태·부모·경로·권위 guard는 완화하지 않았다.

scope는 기존18 + `scripts/check_g07_baseline.py`, `tests/tooling/test_g07_baseline.py` = exact20, product unique9와 WORK_STATUS 한 경로만 겹쳐 cumulative28이다. epoch3 worker `worker-lease-c01-mainline-acceptance-projection-r3-20260910-001`, execution `c01-mainline-acceptance-execution-fence-epoch-3-66c0e43`; write `write-lease-c01-mainline-acceptance-projection-r3-20260910-001`, token `c01-mainline-acceptance-write-fence-epoch-3-66c0e43`. epoch1/2는 무효다. seq701~715만 R3로 재결박한다.

R3 최소 명령: `.venv\Scripts\python.exe -m pytest tests/tooling/test_g07_baseline.py tests/tooling/test_project_progress.py -k 'null_active_lineage or active_lineage_object_retains or c01_current_state or c01_ledger_derived or git_and_authority_bindings_are_checked_against_workspace' -q -p no:cacheprovider`. RED exit1 `5 failed, 1 passed, 373 deselected in 11.42s`; 첫 GREEN은 Counter import 누락으로 `3 failed, 3 passed, 373 deselected in 18.90s`. `C01-R3-COUNTER-IMPORT-MISSING-v1` count1을 C01 로컬 import로 해소했고 같은 명령에 `--tb=short`를 더한 재실행은 exit0 `6 passed, 373 deselected in 19.11s`다.

R3 최종 검증은 후속 checkpoint에 기록한다. 독립 Tester9/제품fix code review와 actual 외부 미실행 경계는 그대로다. 실제 Provider·Telegram·backend swap E2E는 NOT_EXECUTED이며 full tooling 재실행은 Main의 후속 gate다. commit/push/merge는 하지 않는다. rollback은 fix66 위 exact20만 역적용한다. 아래 R2/R1은 당시 이력으로 보존한다.

## R2 현재 판정 — 제품 수정·독립 시나리오 재결박

`ACCEPTED (LOCAL_FIXTURE_CONTRACT_SCOPE)` 기록을 product chain `e215c0612363050dbe20315646f1612f31b8cdc0` → `f56ac2514d0c5bca41768e456ed57f2036ab3137` → `66c0e43a092215ea2e9be24606d7a28e10dff359`에 재결박한다. 각 product commit은 sole direct child다. 처음9개+fix2개는 occurrence11이며 fix2가 기존9의 부분집합이므로 product unique9다. projection exact18과의 교집합은 WORK_STATUS뿐이며 누적 unique26이다. 제품 파일은 수정하지 않는다.

이전 R1 review는 `SPEC FAIL / QUALITY CHANGES_REQUIRED / C0/I1/M0`, fingerprint `C01-ACCEPTANCE-INDEPENDENT-SCENARIO-MISSING-v1`이었다. 18개 Developer-test rerun만으로 독립 acceptance를 선언했던 판단은 철회하고 regression-only로 재분류한다. 아래 R1 경과와 판정은 당시 기록으로 보존하며 현재 R2를 대체하지 않는다.

별도 Tester는 설계·matrix부터 독립9 시나리오를 작성했다(작성 전 제품/Developer tests/완료보고/projection 열람 각각0). round1은 최초 product에서 8 passed/1 failed/0 skipped, exit1이었다. `C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1`: UNKNOWN 사용량을 cost0/tokens0으로 소비하고 reservation을 풀었다. 제품 fix66c0e43는 actual cost/tokens=None을 기존 reconciliation에 전달한다. 동일 테스트/기대값 round2는 9 passed/0 failed/0 skipped, exit0이며 USAGE_RECONCILIATION_REQUIRED와 active reservation1을 확인했다. fix review는 SPEC PASS / QUALITY APPROVED / C0/I0/M0다.

round2 실행 당시 HEAD는 f56ac251+working fix였으며 이후 같은 kernel SHA `6F0918F53543B7F0DBC2479293AAFAA1BF65351693DA3EB153C431E479DF9D32`를 불변66c0e43에 결박했다. test SHA는 `641FB690DDAA138D64522DFC66B0FB178D53FB3EBE22B3301497632A4A15A569`로 두 round에서 불변이다. 독립 Tester 원문·명령·source checksum 및 각 AV 판단은 canonical `docs/test_reports/C-01_MAINLINE_INDEPENDENT_TEST_REPORT.md`에 분리 전사했다.

seq701~706은 최초 product lifecycle과 후속 fix receipt, seq707은 별도 원 code review/fix review 및 projection Important finding, seq708은 독립 round1/2 judgment다. seq709~714는 재발급된 epoch2 acceptance lifecycle이고 seq715는 fixture 범위 Main acceptance다. 이전 미커밋701~715만 개정하고 역사1~700는 불변이다. 새로운 product fix lease를 추정하여 만들지 않는다.

현행 worker `worker-lease-c01-mainline-acceptance-20260910-001`, execution `c01-mainline-acceptance-execution-fence-epoch-2-66c0e43`; write `write-lease-c01-mainline-acceptance-20260910-001`, token `c01-mainline-acceptance-write-fence-epoch-2-66c0e43`. 허용 범위는 R2 WI의 exact18이며 독립 테스트 파일은 기존 원문 그대로 포함한다.

TDD R2 첫 RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k c01_fix_chain_and_independent_design_scenarios -q -p no:cacheprovider` → exit1, `1 failed, 317 deselected in 1.81s`. 기존 builder가 f56ac251을 최종 product로 가리킨 것을 확인했다. chain/evidence 반영 후 focused C01MainlineAcceptance → exit0, `8 passed, 310 deselected in 16.38s`.

재해시된 manifest의 finding 삭제 차단 RED: `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/tooling/test_project_progress.py -k c01_rehashed_manifest -q -p no:cacheprovider` → exit1, `1 failed, 318 deselected in 3.02s`. fingerprint 삭제 등도 fail-closed로 보강한 동일 명령 GREEN → exit0, `1 passed, 318 deselected in 2.61s`. 두 RED는 기대된 개발 검증이며 정식 반복 제품 실패가 아니다.

raw receipt는 in-memory kernel과 독립 public API subject의 writer 재현이다. 결정론을 위해 UUID entropy만 고정하고 원 독립 테스트·기대값은 수정하지 않았다. 실제 Provider/Telegram/backend swap E2E/DB/API/browser/WSL/deployment/외부 영속 Event는 NOT_EXECUTED다. UNKNOWN 예외에서는 StepResult가 생성되지 않아 raw events=[]이며, 감사 소비자는 예외·reservation 상태를 사용해야 한다.

전체 tooling은 Main 소유이며 이 writer는 실행하지 않는다. commit/push/merge/외부 작업은 NOT_EXECUTED다. rollback은 fix66c0e43 위 acceptance exact18만 역적용하고 역사·제품·사용자 자료를 보존한다.

### R2 최종 checkpoint

- 판정 `COMPLETED`: projection exact18의 구현·focused 검증 완료, Main의 최종 review/full tooling은 후속 gate다.
- `$env:PYTHONDONTWRITEBYTECODE='1'; & '.\.venv\Scripts\python.exe' -m pytest tests/tooling/test_project_progress.py -k 'C01MainlineAcceptance or C21PostmergeDevelopmentAuthorityReconciliation or C21FinalAcceptanceProjectionReconciliation' -q -p no:cacheprovider` → exit0, `19 passed, 300 deselected in 39.38s`.
- 같은 interpreter의 `-m pytest -p no:cacheprovider tests/verification/test_c01_independent_acceptance.py -q` → exit0, `9 passed in 0.36s`. 이는 불변66c0e43에서 writer가 한 추가 재현이며 원 independent Tester round2와 구분한다.
- `.venv\Scripts\python.exe scripts/check_project_progress.py .` → exit0, `G-05 project progress contract: PASS sequence=715 reporting=AUTO_CONTINUE`.
- generated7 two-build/live byte 동일, manifest raw checksum17 전량 일치, authority/WI/독립 test/source receipt6 hash 일치, epoch2 fencing 일치.
- seq1~700 raw prefix `2157757` bytes / SHA `60EF142108978724C37E395B5B5C39FDE6504B65F7F5FFDEE336F41E5E937692`, semantic SHA `04F82C5795671A4382D87AB3F31761EC06657CA7023D17B405CBB75EC8385DDC` 불변. 역사 evidence272개 byte 불변, 새701~715 previous hash chain 일치.
- Git exact parent/ancestry, 최초9/fix2/occurrence11/product unique9/projection18/cumulative26, product 원문 보존(WORK_STATUS는 append-only), index exact18/unstaged0/untracked0, syntax3파일 및 `git diff --cached --check` PASS.
- 추가 반복 오류0. Git global ignore 접근 경고는 sandbox 환경 경고로서 scope를 변경하지 않으며 explicit status/untracked 열거와 checker를 통과했다. 이전 Important와 제품 round1 실패는 resolved finding으로 보존했다.
- 이 checkpoint를 checksum에 재결박한 뒤 동일 live/determinism/index 검사를 재확인한다. 미래 feature commit·merge 상태는 controlled Git receipt 검증만 수행했고 실제 commit/merge는 만들지 않았다.

## R1 역사 기록 — 독립 acceptance 판정은 위 R2로 대체

## 판정

`ACCEPTED (LOCAL_FIXTURE_CONTRACT_SCOPE)` — Main의 승인된 projection 지시에 따라 제품 완료와 별도 code review·독립 Tester 판정을 seq701~715에 기록한다. 이 문서의 projection 구현 검증은 아래 실제 실행 결과로 별도 관리한다.

## 판단 이유

- product `f56ac2514d0c5bca41768e456ed57f2036ab3137`은 BASE `e215c0612363050dbe20315646f1612f31b8cdc0`의 sole direct child이며 exact9다.
- product WI ID `C-01_WORK_INSTRUCTION` + exact path + SHA-256 `F99FE2D6C009E7B897130DD3802460258F5CF406BE973DA0939D49DAA5E367A5`를 고정했다.
- code review 원문 `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-product-review-report.md`, SHA-256 `476E911CDB044ECDE80578EA0724E49EDC85A3117A74CC3820D56403AE66DBCB`: SPEC PASS / QUALITY APPROVED, Critical 0 / Important 0 / Minor 0. 기존 LLM-provider adapter 호환, 별도 7-method lifecycle Protocol, opaque reference 보존, 빈 capability·고유 request ID·동일 Step 중복 호출 거부와 budget evidence를 검토했다. Reviewer의 테스트 재실행은 `NOT_EXECUTED`다.
- independent Tester 원문 SHA-256 `EA461AD96A247A477FD096DB22B96E0713B8D7C2782DFFD2B4A6779539310973`: 18 passed in 0.80s, compileall와 cached diff-check exit 0. AV-AGT-002/003/AV-OPS-011 모두 명시한 fake/in-memory 범위에서 PASS다.
- raw backend/budget JSON은 검토된 코드와 fake test backend를 실행하여 재현한다. Provider label이 UPSTAGE여도 실제 adapter는 DeterministicFakeAdapter이고 external call 0이다.

## 변경과 조치

seq700 `C-21 accepted / C-01 ready` → seq715 `C-01 local fixture accepted / C-02 ready`다. completed C-01 1개, DIR-2 `NOT_REACHED`, 보고 `AUTO_CONTINUE`를 유지한다. 제품 exact9는 보존하고 이번 projection은 별도 exact17이다. 공통 WORK_STATUS 때문에 BASE 대비 누적 변경은 25경로다.

Event는 product lifecycle701~706, code review707, Tester judgment708, projection lifecycle709~714, Main acceptance715다. seq700 event부터 canonical hash를 새 event의 previous_event_sha256에 연쇄 결박한다. seq1~700 raw 및 semantic hash는 불변이다.

Git checker는 staged exact17 precommit, product의 clean sole child, BASE/그 projection의 순서 고정 두 parent merge만 허용한다. `development/main`이 개발 기준이며 `origin/main`은 허용하지 않는다. Main acceptance의 manifest_sha256은 manifest.acceptance_basis의 canonical SHA-256이며 전체 manifest 자기참조를 만들지 않는다.

## TDD·검증 checkpoint

- focused RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k C01MainlineAcceptance -q -p no:cacheprovider` → exit 1, `5 failed, 310 deselected in 1.54s`; acceptance builder가 없는 상태를 각 행동 검증 진입 assertion으로 확인했다.
- 최소 GREEN: 같은 focused 명령 → exit 0, `5 passed, 310 deselected in 9.40s`.
- 인접 seq699/700 회귀: 첫 실행 `1 failed, 14 passed, 300 deselected in 29.13s`. seq700 collector 테스트가 mutable current repository를 읽어 BASE가 바뀐 것이 원인이다. frozen seq700 fixture로 분리했고 기존 seq700 production collector는 변경하지 않았다.
- 현재 projection 보완 RED: `-k 'c01_current_state or c01_current_event or seq700_git_collector'` → `1 failed, 2 passed, 314 deselected in 6.88s`. 현재 repository가 seq700의 old merge parents를 상속한 것을 확인했다. 새 BASE의 실제 parents 및 C-01의 active_failure_lineage=null / valid_failure_count=0을 결박했고 동일 명령 `3 passed, 314 deselected in 6.26s`로 GREEN이다. historical failure count31은 보존한다.
- 최종 focused+인접 회귀: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k 'C01MainlineAcceptance or C21PostmergeDevelopmentAuthorityReconciliation or C21FinalAcceptanceProjectionReconciliation' -q -p no:cacheprovider` → exit 0, `17 passed, 300 deselected in 36.45s`.
- 첫 live checker: `.venv\Scripts\python.exe scripts\check_project_progress.py .` → exit 0, `PASS sequence=715 reporting=AUTO_CONTINUE`.
- 결정론적 build/live generated7 동일, manifest raw checksum16, historical evidence272 byte 동일, seq1~700 raw prefix `2157757` bytes / SHA-256 `60EF142108978724C37E395B5B5C39FDE6504B65F7F5FFDEE336F41E5E937692`, semantic equality 및 syntax compile PASS. 마감 문서 뒤 checksum을 재결박하고 live 검사한다.
- 전체 tooling: `NOT_EXECUTED` — Main이 독립 review 뒤 수행한다.

## 오류·미검증·rollback

- 초기 파일 탐색 rg.exe launcher 오류 1회, PowerShell 대체 성공. 제품 failure 0.
- `C01_RAW_EVIDENCE_PARENT_MISSING_R1` 1회: generated 첫 호출에서 새 raw evidence 부모 폴더 부재. exact17에 필요한 부모 폴더를 만든 뒤 같은 generated7을 재생성하여 해소했다.
- `SEQ700_HISTORICAL_FIXTURE_CURRENT_REPOSITORY_MIX_R1` 1회: frozen fixture로 해소.
- `C01_CURRENT_PROJECTION_STALE_BASE_AND_FAILURE_R1` 1회: 현재 merge parent/failure projection 정합화로 해소. 위 내부 수정은 정식 FAILURE_REPORT 횟수에 산입하지 않는다.
- actual Claude/Codex/Local runtime, Provider, network, Telegram, DB, API, browser, WSL, deployment, 외부 영속 Event, Release 및 사용자 인수: `NOT_EXECUTED`.
- commit/push/merge/배포/Subagent 생성: `NOT_EXECUTED`.
- rollback: product commit 위 이번 exact17 diff만 역적용한다. seq1~700와 historical evidence, 다른 worktree·사용자 자료는 보존한다.

## 최종 인계

projection writer 상태 `COMPLETED`. 최종 live checker `PASS sequence=715 reporting=AUTO_CONTINUE`, generated7 두 build/live 동일, raw checksum16, seq1~700 raw/semantic 보존 및 새 hash chain, product exact9/sole parent, staged exact17/cumulative25, unstaged0/untracked0, syntax compile 및 cached diff-check PASS다. Main의 fresh full tooling과 독립 review 이후 commit/통합 절차를 진행한다. 현재 HEAD는 reviewed product commit 그대로다.
