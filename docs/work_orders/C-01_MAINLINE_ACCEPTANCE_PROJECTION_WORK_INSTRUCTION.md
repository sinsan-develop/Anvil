# C-01 Mainline acceptance projection WorkInstruction

- ID: `WI-C-01-MAINLINE-ACCEPTANCE-PROJECTION-20260910-001`
- 담당: Main 어울 관리, `developer-primary` 단일 writer
- 기준선: `e215c0612363050dbe20315646f1612f31b8cdc0`
- 최초 product: `f56ac2514d0c5bca41768e456ed57f2036ab3137`, BASE의 sole direct child, exact9
- 검토 완료 product fix: `66c0e43a092215ea2e9be24606d7a28e10dff359`, 최초 product의 sole direct child, exact2 (`packages/orchestration/kernel.py`, `tests/llm_gateway/test_c01_kernel.py`)
- Main 승인 R3: commit별 occurrence 9+2=11, product unique exact9, projection exact20, WORK_STATUS 한 경로 중복을 뺀 cumulative unique exact28. Git으로 실측하고 검증한다.
- branch: `codex/c01-mainline-reconciliation`
- 개발 authority: `git@github-sinsan-develop:sinsan-develop/Anvil.git`, `refs/remotes/development/main`

판정 근거는 승인 설계 §47.15, §47.18~19, §49.6, 작업계획 C-01, AV-AGT-002/003 및 AV-OPS-011과 별도 코드 리뷰·독립 Tester 결과다. 기능 범위·요구사항·중요 위험을 확대하지 않는 증거 기록 작업이다.

제품 WorkInstruction의 canonical ID는 파일 stem `C-01_WORK_INSTRUCTION`이다. 경로 `docs/work_orders/C-01_WORK_INSTRUCTION.md`, SHA-256 `F99FE2D6C009E7B897130DD3802460258F5CF406BE973DA0939D49DAA5E367A5`를 함께 결박한다. 기존 product WI를 변경하지 않는다. 향후 명시적 artifact_id schema 도입 때 이 alias를 1회 migration한다.

## 작업과 승인 상태

1. R3의 RED/GREEN 이력을 보존한다. R4는 비의미 오기·증거/lease 메타데이터 정정만 하며 제품·테스트 판정 로직은 수정하지 않는다.
2. 기존 seq1~700 raw event 객체와 모든 historical evidence를 byte 단위 보존한다.
3. 미커밋 seq701~715를 R4로 재생성한다. seq701~706 최초 product lifecycle과 후속 fix 증거, seq707 원 code review와 fix review·projection finding, seq708 독립 시나리오 round1/2 judgment, seq709~714 epoch4 projection lifecycle, seq715 Main acceptance를 분리한다. seq1~700는 변경하지 않는다.
4. C-01을 `LOCAL_FIXTURE_CONTRACT_SCOPE`에 한하여 `ACCEPTED`로 기록한다. actual Claude/Codex/Local runtime, Provider, network, Telegram, DB, API, browser, WSL, deployment와 외부 영속 Event는 `NOT_EXECUTED`다.
5. `current_work_package=C-01`, completed의 C-01 중복 0, 다음 `C-02/READY_FOR_WORK_INSTRUCTION`, `DIR-2/NOT_REACHED`, `AUTO_CONTINUE`를 결박한다.
6. checker는 staged exact20 precommit, product fix의 clean sole direct-child feature, `[BASE, projection]` 두 parent의 clean `development/main` merge 상태만 통과시킨다. BASE→최초 product→fix의 parent 수·순서, exact9/fix2/projection20/cumulative28, index/unstaged/untracked/upstream/URL/ref를 fail-closed로 검사한다. 일반 projection은 넓히지 않는다.
7. 이전 18개 Developer-test 재실행은 regression-only이며 독립 acceptance 근거가 아니다. 설계·matrix를 먼저 읽고 별도 작성한 9개 독립 시나리오의 round1 8/1, UNKNOWN usage 결함, 제품 fix, 동일 기대값 round2 9/0을 보존한다. Reviewer Important finding과 그 해소를 삭제하지 않는다.

## write lease와 exact20

- worker: `worker-lease-c01-mainline-acceptance-projection-r4-20260911-001`
- execution token: `c01-mainline-acceptance-execution-fence-epoch-4-66c0e43`
- write: `write-lease-c01-mainline-acceptance-projection-r4-20260911-001`
- write token: `c01-mainline-acceptance-write-fence-epoch-4-66c0e43`
- write epoch: `4`

허용 경로는 다음 20개뿐이다. epoch1/2/3는 회수된 이전 기록이며 현재 쓰기를 허가하지 않는다.

1. `docs/04_test_reports/C-01_MAINLINE_ACCEPTANCE_RESULT.md`
2. `docs/WORK_STATUS.md`
3. `docs/completion_reports/C-01_completion.md`
4. `docs/evidence/manifests/C-01_MAINLINE_ACCEPTANCE_MANIFEST.json`
5. `docs/evidence/raw/C-01_BACKEND_CONTRACT_EVIDENCE.json`
6. `docs/evidence/raw/C-01_BUDGET_EVENT_EVIDENCE.json`
7. `docs/progress/BUILD_HANDOFF.md`
8. `docs/progress/build-progress.json`
9. `docs/progress/progress-events.json`
10. `docs/progress/progress-handoff-detached-digest-c01-mainline-acceptance.json`
11. `docs/test_reports/C-01_MAINLINE_INDEPENDENT_TEST_REPORT.md`
12. `docs/validation/C-01_MAINLINE_ACCEPTANCE_VALIDATION.md`
13. `docs/work_orders/C-01_INVOCATION_PROMPT.md`
14. `docs/work_orders/C-01_MAINLINE_ACCEPTANCE_PROJECTION_INVOCATION_PROMPT.md`
15. `docs/work_orders/C-01_MAINLINE_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md`
16. `scripts/check_project_progress.py`
17. `tests/tooling/test_project_progress.py`
18. `tests/verification/test_c01_independent_acceptance.py`
19. `scripts/check_g07_baseline.py`
20. `tests/tooling/test_g07_baseline.py`

제품 exact9의 Python·test·WI·product result는 수정하지 않는다. 공통 `docs/WORK_STATUS.md`에는 이번 경과만 추가한다. 새 승인 원문, schema, failure ledger, historical manifest를 수정하지 않는다.

## 증거와 검증

결정론적 raw JSON은 검토한 fake adapter와 실제 in-memory kernel 및 독립 시나리오의 public API subject를 재실행하여 만든다. raw replay의 request ID UUID entropy만 고정하며 Tester의 테스트 원문·기대값은 바꾸지 않는다. 이 writer 재현을 새로운 독립 Tester 실행으로 표시하지 않는다. prompt/credential 원문을 출력·저장하지 않는다.

원 code review `476E911CDB044ECDE80578EA0724E49EDC85A3117A74CC3820D56403AE66DBCB`, 기존 Developer-test rerun `EA461AD96A247A477FD096DB22B96E0713B8D7C2782DFFD2B4A6779539310973`, projection Important review `591BAD6EF52CE48C1D285379E4AB08001FEAD4CD40AC38505878FB6FC089D8AE`, 독립 scenario report `B27E326FD627A9BD35771B9A4219917FD53A0FD0E894FAD0D644C15C2FCDCCD8`, fix report `31E90A32F335548BE0471744F2903D37E7E1BCC0B391C75C4A561D15249CDA28`, fix review `6FA6400006CD21FBC0FAF5EFEEFD8C02AC9A036F2929F976A851556953F84688`를 서로 구분해 결박한다. 독립 test SHA는 `641FB690DDAA138D64522DFC66B0FB178D53FB3EBE22B3301497632A4A15A569`다.

`MAIN_PACKAGE_ACCEPTED.manifest_sha256`은 해당 manifest의 `acceptance_basis` canonical JSON SHA-256이다. `manifest_hash_scope=CANONICAL_ACCEPTANCE_BASIS_ONLY_NO_SELF_REFERENCE`로 자기참조를 피하고, manifest 자체는 외부 Git commit 및 raw checksum으로 결박한다.

- `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -k C01MainlineAcceptance -q -p no:cacheprovider`
- `.venv\Scripts\python.exe scripts\check_project_progress.py .`
- 두 build byte 동일성, seq1~700 raw prefix·semantic hash, 새 Event 순서·previous hash, raw checksum과 authority hash
- 독립 9-scenario suite와 인접 seq699/700 regression
- exact20 staged, unstaged/untracked 0, 최초 product exact9와 fix exact2 parent/ancestry, unique9/cumulative28, `git diff --cached --check`, syntax compile

전체 tooling은 Main이 review 뒤 실행한다. 이 writer는 commit/push/merge/외부 호출/배포/Subagent 생성 권한이 없다. 실패·오류·미검증과 다음 조치는 WORK_STATUS와 결과 보고에 누적한다. rollback은 product fix commit 위 이번 exact20 diff만 역적용하며 historical/다른 worktree/사용자 자료는 보존한다. 실제 Provider·Telegram·backend swap E2E는 NOT_EXECUTED다.

## R4 비의미 정정과 Main 검증 receipt

Main 승인 `MAIN_RECONFIRMED_NON_SEMANTIC`: R3 WI SHA `8937BB5FD5C6C3F588A003B88EE9747082063380EE7C64BC8CC21E985C91B247`를 부모로 항목7 오기20→18 및 epoch4/검증 증거를 재결박한다. 제품·테스트 로직 및 승인 기능·요구사항·중요 위험 변경0이다. builder의 lease/시점/receipt 데이터와 epoch 기대 literal 2개만 갱신한다.

Main이 실행한 full tooling R3 attempt2 `.venv\Scripts\python.exe -m pytest tests/tooling -q -p no:cacheprovider`는 exit0, `697 passed in 1661.64s (0:27:41)`다. 실행 대상은 이 정정 이전 R3 exact20이며 부모 manifest SHA `D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F`와 당시20개 file checksum snapshot을 현재 manifest.acceptance_basis.full_tooling_attempt2에 보존한다. 이 PASS를 R4 정정 후 full suite 실행으로 표시하지 않는다.

Main이 전달한 Reviewer final은 SPEC PASS / QUALITY APPROVED C0/I0/M1이다. Minor 항목7 regression 수 오기20→18은 이 정정으로 resolved이며, canonical evidence는 원래18이었다. 원 finding1은 삭제하지 않는다. 로컬 추적 ID `C01-DEVELOPER-TEST-COUNT-TYPO-v1`는 이번 기록용이며 Reviewer가 발급한 fingerprint로 주장하지 않는다.

정정 후 writer는 최소 관련 tests/live checker/generated7 determinism/checksum19/history272/seq1~700/exact20/cumulative28/syntax/diff를 실행한다. Main은 영향받는 focused/checker/checksum/determinism을 별도로 재실행한다. 전체 tooling을 writer가 재실행하지 않는다. seq1~700/history272/product는 불변이며 actual 외부는 NOT_EXECUTED다.

## R3 full tooling 재작업 계약 — 보존 이력

Main attempt1은 exit1, `20 failed, 673 passed in 1675.07s`다. `C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1` 및 `C01-GIT-MUTATION-ERA-EXPECTATION-v1`은 각각 count1이며 테스트 failure instance는19/1이다. status-poll wrapper syntax error1은 non-product tool error로 별도 보존한다.

G07은 null을 no-active(idNone/count0)로 해석하고 모든 유효 ledger32건을 historical로 집계한다. C01 current historical total32 및 OPS-R2 map2를 immutable ledger에서 도출한다. null+active1, 역사count31 및 map-only 변조는 거부한다. seq700의 역사31/map1 raw는 수정하지 않는다. seq715 current exact 오류코드와 별도 frozen generic ancestry 오류코드 테스트를 분리하고 collector를 완화하거나 재정렬하지 않는다.

최소 RED→GREEN, 실패했던20개 정확 node ID, focused+seq699/700, 독립9, live715, generated7/checksum19/history/exact20/cumulative28/syntax/diff를 실행한다. 전체 tooling 재실행은 Main 소유다.
