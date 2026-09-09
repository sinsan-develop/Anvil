# C-21 Workbench UI WSL authenticated browser probe R1 — seq609~614

- Reviewer 최종 재검토 `COMMIT_READY / C0 / I0 / M1`: WorkInstruction 첫 범위 bullet에 R1의 `screenshot root를 환경변수에서 읽는다` 문구가 남아 확정된 R2 memory-only 계약과 불일치했다. path 없는 Buffer 메모리 전용 및 screenshot-root nonempty env fail-closed로 비의미 문서 정정했으며 기능·범위·seq614/exact13/hash 경계는 확대하지 않는다. 기존 full tooling `606 passed in 1320.29s`는 코드 불변으로 유지하고 focused 문서/checker 검증으로 M1을 해소한다.
- 비의미 정정 pre-amend 검증: focused `7 passed, 231 deselected`; live checker는 새 projection이 아직 commit되지 않은 단계에서 예상대로 `GIT_DESCENDANT_RECORD_COMMIT_INVALID` 1회로 fail-closed했다. amend 후 재검증 대상으로서 제품/계약 실패가 아니며 valid failure count `2`는 불변이다.
- Reviewer R2: `REWORK / C0 / I1 / M1`, 동일 package valid failure 2로 수락했다. filesystem screenshot root 설계가 TOCTOU·overwrite·symlink·cleanup 예외 경계를 불필요하게 만든다는 판단에 따라 WorkInstruction을 `MEMORY_ONLY` Buffer capture로 축소한다. 이는 기능 범위 확대가 아니라 위험 제거 revision이며 seq614/exact13을 유지한다.
- R2 시작 기준 full tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → exit 0, `606 passed in 1122.50s`.
- R2 TDD RED: memory-only manifest/input/failure/self-test 계약 부재 `4 failed, 1 passed`; 하나의 screenshot persistence revision lineage valid failure 2에 속하며 3번째 동일 유효 실패는 아니다.
- R2 GREEN: screenshot은 path 없는 Buffer로만 캡처하고 logical relative name/bytes/SHA-256만 receipt에 기록한다. filesystem files/directories/residue는 0이고 `ANVIL_SCREENSHOT_ROOT` 및 legacy `ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR` 입력은 fail-closed 거부한다. Last-Event-ID exact 검증은 유지한다. 집중 `7 passed, 231 deselected`, Node syntax PASS다.
- R2 최종 full tooling 재검증: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → exit 0, `606 passed in 1320.29s (0:22:00)`; 실패 fingerprint 없음.
- R2 최종 보조 검증: API 전체 `117 passed`, Workbench Web `8 passed`, actual headless Workbench click/SSE와 cross-origin rejection PASS. `node --test apps/web/tests`는 Node가 directory target을 module로 해석해 1회 exit 1이었고 정확한 `apps/web/tests/workbench.test.mjs` 대상으로 정정했다. 제품 실패가 아니며 valid failure count는 `2`로 유지한다.

# C-21 Provider status READ start — seq507~509

- commit 전 cached diff-check의 `new blank line at EOF` 2건(WI line58, invocation line11)을 비의미 correction으로 확정했다. 문서 의미·제품 범위·lease exact18은 불변이며 EOF LF 1개로 정규화한 뒤 WI/prompt 3-way hash와 manifest/raw refs/digest/progress/HANDOFF snapshot만 재결박한다. full164 R3 결과는 유효하고 focused 검증으로 마감한다.
- 독립 review I1 `SEQ509_HANDOFF_INVOCATION_HASH_STALE` 1회: 실제 prompt와 build-progress는 `9CB42A75...3251`인데 HANDOFF machine summary만 이전 invocation `1A368B58...D220`을 유지했다. TDD RED는 raw checksum stale 포함 focused `2 failed, 1 passed`; 직접 3-way 비교로 stale을 확인했다. checker가 실제 prompt raw hash = active WorkInstruction invocation hash = HANDOFF invocation hash를 강제하도록 보완하고 digest/manifest/snapshot을 재결박한다.
- I1 GREEN: focused `3 passed, 161 deselected in 11.89s`; full tooling fresh R3 `164 passed in 919.47s`, exit 0. JUnit `D:\tmp\anvil-seq509-full164-r3.xml`. HANDOFF invocation은 실제 prompt/build-progress와 `9CB42A75...3251`로 일치한다.
- 담당: `provider_status_start`; 상태: `ACTIVE_PROVIDER_STATUS_READ`; 기준 clean HEAD `aa116e2044671628011b46d190de014ad7fd0af4`.
- TDD RED: 신규 start manifest/helper 부재로 focused `3 failed, 161 deselected`; 기대된 계약 실패다.
- seq507 worker lease → seq508 exact18 write lease → seq509 package start를 append한다.
- product lease exact18 hash `300FEF86...122E8`; start exact10 hash `3F575DB5...A1B6`; predecessor exact78 hash `4BB888F6...E946`; cumulative exact82 hash `6A6A51D6...DD63`.
- seq1~506 보존: full `895160` bytes/`5517EAA3...FAB0`; raw prefix `894954` bytes/`7D6BE1D0...34C3`; canonical `5CCAE8CD...C6F8`.
- 구현 목표: canonical lowercase 9/uppercase display/UPSTAGE primary, env presence-only, GET list/detail/models 200, unknown·mixed 404, auth/RBAC, MoA no-eligible fail-closed. POST configure/test/refresh는 honest 501로 유지한다.
- actual Provider/Telegram, DB migration, ysna/main/release/install은 `NOT_EXECUTED`; C-21 accepted=false, C-01 차단, DIR-2 미발생.
- 오류 fingerprint `C21_PROVIDER_STATUS_START_MISSING_RED` 1회(의도된 RED), 동일 유효 제품 오류 반복 0회.
- `C21_SEQ509_DTMP_SANDBOX_WRITE_DENIED` 1회: 최초 materializer가 `D:\tmp` progress-events 쓰기에서 sandbox `PermissionError`로 중단됐다. 승인된 exact worktree 쓰기로 재실행해 해소했으며 제품 실패가 아니다.
- `C21_SEQ509_PACKAGE_STARTED_PAYLOAD_INCOMPLETE` 1회: 첫 생성본의 `PACKAGE_STARTED`에 공통 계약의 work-instruction/package-status 및 repository effect field가 빠져 checker가 2건을 거부했다. Main 승인에 따라 이번 turn의 미커밋 progress-events 단일 파일만 HEAD blob으로 원자 복원하고, seq1~506 full/prefix/canonical hash 불변을 확인한 뒤 필수 payload를 포함해 seq507~509를 처음부터 재생성했다. 과거 event를 인플레이스 수정하지 않았다.
- `C21_SEQ509_HISTORICAL_SEQ506_CURRENT_BUNDLE_MIX` 1회: full tooling 첫 fresh 실행은 `160 passed, 4 failed in 772.64s`였다. seq506 historical 계약 4건이 seq509 current bundle을 읽은 fixture 혼합이며 제품 실패가 아니다. 3개 validator fixture와 Git fixture를 동일 detached `aa116e2` snapshot bundle로 분리해 seq506 계약을 유지했다.
- fixture 보완 중 `SEQ509_SEQ506_POSTCOMMIT_DUPLICATE_TEST_BLOCK_TYPO` 1회: seq509용 postcommit block이 seq506 test에도 중복 삽입돼 미정의 `exact78/exact10`으로 focused 1건이 실패했다. 잘못 삽입된 duplicate block만 제거하고 seq506 기존 계약과 seq509 별도 postcommit 계약은 유지한다.
- fixture 교정 focused: seq506 detached coherent bundle 4건과 seq509 신규 계약 3건 `7 passed, 157 deselected in 56.48s`; checker/diff-check PASS.
- full tooling fresh R2: `164 passed in 946.22s`, exit 0. JUnit `D:\tmp\anvil-seq509-full164-r2.xml`; 최초 R1의 historical fixture 4건은 모두 해소됐다.
- 다음: governance exact10 검증·commit 후 `developer-primary`가 exact18 lease subset에서 구현하고, 이어 Workbench UI rework로 진행한다.

# C-21 Development QA review successor — seq502~506

- 담당: `seq506_successor_writer`; 상태: `REWORK_REQUIRED`; 기준 clean HEAD `3c6774f98e25bf3b8473575d88da3fcac8fbca59`.
- TDD RED: successor manifest/helper 부재로 focused `4 failed, 157 deselected`; 의도한 계약 실패이며 제품 failure가 아니다.
- exact7 독립 판정: `SPEC_PASS / QUALITY_APPROVED / C0 / I0`; 580ed9d→3c6774f direct exact7 hash `15F82A54...14DE9`.
- 전체 판정: `PACKAGE_QA_COMPLETED_BUT_C21_ACCEPTANCE_PENDING / C0 / I2`. `PROVIDER_RUNTIME_STATUS_PORT_501`, `WORKBENCH_CONFIG_404_UI_CLICK_NOT_PROVEN`이 남았다.
- seq502→506: write lease 회수 → worker lease 회수 → package 완료 → exact7 독립 review → C-21 test judgment. active agent/lease는 모두 null이다.
- seq1~501 보존: full file `891334` bytes / `8AB734F3...E508C`; event-object prefix `891131` bytes / `80B5A599...E2AB`; canonical ASCII `5616162D...E7288`.
- repository: eef3496→3c6774f exact75 hash `DA55B1DE...FBE3`; record exact9 hash `4B44F07D...2AAE`; postcommit cumulative exact78 hash `4BB888F6...E946`.
- 외부 actual Provider/Telegram, ysna, main, release/install은 `NOT_EXECUTED`; 현재 gate가 아니며 사용자 대기로 전환하지 않는다.
- 다음: `ISSUE_C21_RUNTIME_UI_REWORK_WI`; C-01은 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2는 `NOT_TRIGGERED`.
- 오류 fingerprint `D_TMP_CANONICAL_WRITE_PERMISSION_R1` 1회: 기본 sandbox에서 canonical D:\tmp worktree write가 거부됐고 승인된 동일 generator 실행으로 해소했다. 제품 failure는 아니다.
- 오류 fingerprint `SEQ506_GENERIC_EVENT_AND_REF_BINDING_R1` 1회: 신규 event type/effect와 checksum registry 결박 누락을 checker가 거부했고 exact9 checker/refs 보완 후 focused와 checker가 PASS했다.
- 오류 fingerprint `SEQ506_FULL_OUTPUT_TRUNCATED_R1` 1회: 최초 full tooling 종료 출력이 도구 context에서 truncate되어 최종 counts를 회수하지 못했다. 동일 fresh run으로 실제 결과를 다시 확보했으며 제품 failure는 아니다.
- 오류 fingerprint `SEQ506_HISTORICAL_FIXTURE_CURRENT_BUNDLE_MIX_R1` 1회: fresh full tooling `14 failed, 147 passed / 706.52s`에서 seq424~501 과거 projection tests가 current seq506 ROOT bundle을 사용한 fixture 혼합을 검출했다. checker·historical evidence를 완화/수정하지 않고 각 검증된 historical commit의 detached bundle/root로 분리했으며 실패군 focused `14 passed, 147 deselected / 87.97s`와 잔여 3건 focused `3 passed, 158 deselected / 15.53s`를 확인했다.
- generator는 historical event prefix 불변과 exact hash를 assert하며 checksum 재결박 후 idempotent 재실행한다. 최종 full tooling 결과는 아래 마감 checkpoint에 추가한다.
- 최종 마감 checkpoint: fresh full tooling `161 passed, F=0, E=0 / 719.16s / exit0`; JUnit `D:\tmp\anvil-seq506-full161.xml`. 신규 seq506 focused `4 passed, 157 deselected / 12.31s`, checker `PASS sequence=506 reporting=AUTO_CONTINUE`, historical 실패군 focused `14 passed, 147 deselected / 87.97s`다.

# C-21 독립 판정 projection — seq496~498

- 담당: `seq498_result_writer`; 상태: `COMPLETED_FOR_REVIEW`; 기준 HEAD `9a7a6144bcd0a7d38fce291610f40e9608a38309`.
- TDD RED: focused `4 failed, 145 deselected`; 원인: manifest/validator 부재. 동일 formal product failure가 아니라 의도한 계약 실패 1회다.
- 구현: WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → INDEPENDENT_TEST_JUDGMENT_RECORDED. 최종 lease/agent null, C-21 BLOCKED_NOT_ACCEPTED, C-01 blocked, DIR-2 NOT_TRIGGERED.
- 미실행: commit, push, WSL/DB, Provider, Telegram, ysna, browser, main merge.
- 검증 결과와 추가 오류는 완료 checkpoint에 이어서 기록한다.

## seq498 completion checkpoint

- focused RED: `4 failed, 145 deselected`; 신규 manifest/validator 부재를 의도대로 검출했다.
- focused GREEN: `4 passed, 145 deselected`; historical fixture 보완 관련 focused: `8 passed, 141 deselected`.
- 첫 full tooling: `145 passed, 4 failed, E=0` / `521.59s`. 기존 seq478/seq495 테스트가 current seq498 bundle을 과거 projection fixture로 사용한 `HISTORICAL_CURRENT_BUNDLE_MIX_SEQ498_R1` 1회이며 제품 failure가 아니다.
- immutable historical commit fixture로 분리 후 두 번째 full tooling: `149 passed, F=0, E=0` / `555.48s`.
- project checker: `PASS sequence=498 reporting=AUTO_CONTINUE` (full suite 재실행 전). 최종 checksum 재결박 후 checker/diff/history/exact9/64/idempotence를 다시 확인한다.
- 구현 오류 ledger: `D_TMP_SANDBOX_WRITE_PERMISSION` 1회, `SEQ495_RAW_PREFIX_RESERIALIZED` 1회, `HANDOFF_CORE_DECISION_OMISSION` 1회, `EVENT_CONTRACT_REPOSITORY_EFFECT_HANDOFF_MISMATCH` 1회. 모두 해소했으며 동일 fingerprint 3회 반복은 없다.
- 외부 실행, commit, push, WSL/DB, Provider, Telegram, ysna, browser, main merge는 `NOT_EXECUTED`다.
- 최종 마감: checker `PASS sequence=498 reporting=AUTO_CONTINUE`; `git diff --check` PASS; dirty exact9 hash `83E130DB...D232`; base 대비 union exact64 hash `00293DE6...9A10`; seq1~495 raw/canonical 불변; secret 원문 패턴 0; generator/finalizer before→cycle1 및 cycle1→cycle2 bytes 동일.

### seq498 independent review rework

- 독립 review: `SPEC FAIL / QUALITY REWORK / C0 / I3`. I-1 exact binding/event/digest fail-closed 누락, I-2 real-Git fast-path structural guard 우회, I-3 판정보고서 리터럴 `+` 손상을 수락했다.
- TDD RED: seq498 focused `5 failed, 2 passed`; manifest mutation, feature remote mutation, Markdown `^+`를 실제 재현했다.
- GREEN: manifest/source/WI, 세 event 전체 envelope/details, digest bytes/canonical/scope/self-reference를 exact 검증하고 공통 repository structural helper를 public Git 경로에 합성했다. 보고서는 정상 Markdown으로 재생성했다.
- focused GREEN: `7 passed, 145 deselected`; checker와 diff-check PASS. full fresh 및 최종 멱등 검증은 아래 재작업 마감에서 기록한다.
- 재작업 full fresh: `152 passed`, `F=0`, `E=0`, `545.42s`, exit0.
- 재작업 오류 fingerprint `SEQ498_REVIEW_I1_I2_I3`은 RED 1회 후 GREEN으로 해소했으며 반복 3회 조건은 없다.

# C-21 WSL QA 실행 결과 — seq495

- 담당: `seq495_result_binding`; 상태: `TEST_REVIEW_PENDING_INDEPENDENT_JUDGMENT`; ProductValidation=`SUITABLE` (승인된 WSL 범위만).
- `a342d62391a44b349733d1468ac3b180761155ab`를 PG15/PG18RC에 배포·2회 verify하고 genuine `324eb169fedbce958d2e8cc29362deb7af433677` rollback/독립 관찰/candidate 복귀/cleanup을 완료했다. exact project residue는 container/network/volume `0/0/0`.
- 환경 오류: pre-mutation SSH alias 2회, PowerShell quoting 1회, 로컬 PowerShell `@{u}` parse 1회; 모두 product valid failure 0이며 해소했다. 외부 SSH flood는 Main failure가 아니다.
- 미실행: Telegram, Provider, ysna, browser Network, main merge. C-01 차단 유지, DIR-2 미발생.
- 다음: frozen seq495 exact10을 독립 Tester가 판정한 뒤 Main이 acceptance/lease 회수 여부를 별도 event로 결정한다.
- TDD: 신규 manifest 부재 RED 1건을 확인한 뒤 seq495 focused 3/3 PASS와 checker PASS를 확인했다. 첫 전체 tooling은 `142 tests / 467.659s / 13 failures`; seq495-current와 seq494 historical fixture 혼합 및 fast-path의 generic reason-code 누락으로 분류했다. 보완 후 실패목록 focused는 12건 중 11 PASS/1 FAIL, 남은 base ancestry reason-code를 복원한 단일 focused는 PASS다. 최종 전체 tooling 재실행 결과는 후속 마감 행에 기록한다.
- 비제품 실행 오류: 로컬 Python 미설치 확인 2회, WSL 재호출 권한 거부 1회(재호출 금지 유지), D:\tmp sandbox write 거부 1회는 번들 Python 및 승인된 canonical worktree write로 해소했다. 동일 제품 실패로 집계하지 않는다.
- 최종 전체 tooling 재실행: `142 tests / 540.521s / OK / exit0`. Windows global ignore 접근 경고는 있었으나 test failure/error는 0이다.
- 독립 리뷰 C0/I2 REWORK: active recovery와 HANDOFF machine summary의 실행 전 legacy 값 모순, 3문서 coherent evidence 및 repository projection 변조 fail-open을 재현했다. reviewer mutation 회귀 테스트를 먼저 추가했고 projection-mode/base/head-relation 3개 RED를 확인했다.
- Main verification 명칭 오타 1회: focused 실행 시 실제 클래스 `ProjectProgressContractTests` 대신 `ProjectProgressTest`를 지정해 3 loader error/exit1이 발생했다. 테스트 선택 오류이며 제품 실패 0; 정확한 클래스명으로 즉시 재실행해 위 RED를 확인했다.
- REWORK 검증 명령 범위 오류 1회: 기존 seq495 전체 tooling 기준인 `tests.tooling.test_project_progress` 대신 `unittest discover -s tests/tooling`을 실행해 unrelated historical A13/A14/B12/G07 suite와 npm-cache까지 포함했다. 결과 `510 tests / 897.234s / 16 failures + 1 error / exit1`; npm-cache `EPERM` 1건과 historical fixture/current-tree·encoding mismatch 16건으로, reviewer focused 6 PASS 및 project checker PASS와 분리한다. 이 실패는 삭제하지 않고 올바른 project-progress 전체 파일 재실행 결과를 후속 기록한다.
- REWORK 정식 검증: reviewer mutation table 포함 focused `6 tests / 2.529s / OK / exit0`; seq495 정식 전체 범위 `tests.tooling.test_project_progress`는 `145 tests / 642.358s / OK / exit0`. Windows global ignore 접근 경고 외 failure/error 0이다.
- real-Git `_validate_git_projection` 잔여 fast-path도 공통 구조 guard를 경유하도록 보완한 뒤 focused `6 tests / 3.822s / OK / exit0`, 최종 정식 전체 `145 tests / 779.577s / OK / exit0`을 fresh 재확인했다.
- 최종 마감 명령의 inline secret-pattern regex에서 PowerShell quote parser error 1회/exit1이 발생했다. 파일 변경·secret 출력·제품 실행은 없었고, regex를 제거한 안전한 read-only 마감 명령으로 history/exact/checker/diff를 재확인했다. 제품 실패 0이다.

# Anvil 작업현황

## seq494 로컬 검증 마감 / 2026-09-05

- 담당: Main 어울 관리, pg18_binding_resume 구현 후 seq494_local_finish가 단일 writer 인수. candidate a342d62391a44b349733d1468ac3b180761155ab, candidate56 / record12 / 누적58. Main의 최종 문서 검토·record commit·clean postcommit 검증은 아직 전이며 외부 실행은 하지 않는다.
- tooling 전체 139 PASS/471.73s/exit0은 직전 writer의 실제 결과를 Main에게서 인수했으며 중복 실행하지 않았다. 기존 harness session8103 최종 결과는 세션 소실로 미확인이고 제품 실패나 PASS로 계상하지 않는다.
- 인수 후 frozen harness만 1회 재실행: session96554, 80 PASS / 1 Compose parser SKIP / 428.42s / exit0. stdout·exit는 D:/tmp/anvil-seq494-harness-resume-6fa1d981bdb54491a32aab02a9375c66에 보존했다. SKIP는 로컬 parser 환경 한계이며 실제 WSL 검증 성공이 아니다. 프로세스 확인이 실행 후 이뤄진 인수 절차 누락은 기록했고 이전 suite 잔존 없이 현재 launcher/worker 한 쌍만 확인했다.
- Main 독립 B 검증: I1 보완 직전 핵심 Git/public READY/ABA 4 PASS/53.45s/exit0(session34066), 보완 후 runtime_next_action coherent 변조 거부 1 PASS/7.03s/exit0(session67752). Reviewer I1 해소 후 SPEC PASS / QUALITY APPROVED, Critical 0 / Important 0. 전체 검증 후 문서 마감 검토는 별도다.
- 정상 exact HOLD는 PASS하고 임의 dispatch·다른 HOLD·빈 문자열·필드 누락은 FAIL하는 계약을 유지한다. event494 canonical SHA 644592AE2E1FE61A074455358F786BC84AE4BA28D71D1EEF3AF87154B02314D2, derived2320 bytes/hash2A57298FA53B8D16AA399DEB9DE695620A20581B5FA85845B4C0EEE573647BE6 및 seq1~493·기존 approval/evidence는 변경하지 않는다.
- READY는 기술 준비 상태일 뿐 dispatch 허가가 아니다. runtime_next_action은 HOLD_EXTERNAL_EXECUTION_PENDING_SCOPE_RECONFIRMATION_AFTER_LOCAL_SEQ494_COMMIT 그대로다. private push·WSL·DB·실제 rollback/cleanup·Provider·Telegram·ysna·main 병합은 하지 않았다. 다음은 로컬 기록 마감 후 정확한 candidate/control/ref 및 실행 범위에 대한 외부 재개 조건 확인이다.

### 아래는 준비 당시의 누적 기록



## seq494 승인된 WSL QA 재개 사전 checkpoint / 2026-09-05

- Main 관리·단일 writer pg18_binding_resume. candidate `a342d62391a44b349733d1468ac3b180761155ab` / parent `ad3355baf0aa94da27b8cb6b5ee5a90215ee5994`, correction2 / candidate56 / record12 / post58. 기존 seq1~493·승인 원문·historical evidence 보존. 새 인간 승인을 작성하지 않고 기존 cleanup·ingress 승인 및 WI `52AA197F724F1D0AB59F061D187EFE3744ED86AFC52E5E504DA0E26C4BE04FF8`를 `MAIN_RESUMED_APPROVED_WSL_QA` derived로 연결한다.
- A 로컬 제품 검증: Producer focused7 PASS/22.23s, full76 PASS/1 Compose parser SKIP/363.15s(exit0), Main 독립7 PASS/35.19s, review SPEC PASS/QUALITY APPROVED C0/I0. B seq494 결박·전체 public READY 테스트는 아직 미실행이며 A helper 성공으로 대체하지 않는다.
- `READY_FOR_APPROVED_WSL_QA`는 기술적 준비 상태일 뿐 현재 실행 dispatch 권한이나 배포 성공이 아니다. 최신 PMO 지시는 이번 범위를 로컬 B494 검토·commit·clean postcommit까지만 제한했다. private push·WSL·DB·rollback·cleanup을 실행하지 않고 완료 후 외부 범위를 재확인한다. 현재 후보 push·배포·DB·실제 rollback·cleanup은 NOT_EXECUTED. Main의 predecessor3ref atomic FF push 및 Reviewer fresh clone/content validator/fsck0/residue0만 별도 확인됨. 실제 WSL은324/control3f52이며 ccf/5f8 배포 성공으로 기록하지 않는다.
- 기존 `.env` root:600과 `/srv/anvil-wsl/repo` root 소유권을 보존한다. 아래 자원·실행·정리 목록은 후속 외부 범위 재확인용 사전 계획이며 이번에는 실행하지 않는다. 후속 실행이 허용된 경우에만 Git-only candidate exact56와 그 direct-child control 및 raw manifest/action checksum을 검증한 뒤 Main이 bootstrap/control-runtime을 호출한다. bootstrap/control-runtime은 검증 전에도 제어 checkout·lock/active 경로를 만들 수 있어 read-only 검사로 부르지 않는다.
- 승인 자원: 프로젝트 `anvil-wsl-pg15`, `anvil-wsl-pg18rc`; 각 `anvil-db`, `anvil-web`, `anvil-ingress`(최대6 컨테이너). 기존 internal망 `anvil-wsl-pg15_anvil-wsl`, `anvil-wsl-pg18rc_anvil-wsl`은 internal=true. 승인 ingress-only non-internal망 `anvil-wsl-pg15_anvil-ingress`, `anvil-wsl-pg18rc_anvil-ingress` 두개는 ingress만 연결한다. app/DB outbound는 계속 차단한다.
- ingress image `nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236`, user101/read-only/cap-drop ALL/no-new-privileges/tmpfs16m. `127.0.0.1:4770`, `127.0.0.1:4870` → ingress8080 → web3770, 원 Host/SSE 유지. ysna의 anvil-web:3770 단일 런타임이나 임시 UI Preview와 무관한 WSL 전용 QA ingress다.
- DB 볼륨은 `anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data` 두개만. PG15 mount `/var/lib/postgresql/data`, PG18RC mount `/var/lib/postgresql`. project/service/environment/cleanup-scope labels exact 및 anonymous volume0을 Main이 실측한다. 기존 PG15/18 image와 app image324 상태는 이전 read-only 증거이며 새 배포로 간주하지 않는다.
- 수명: C-21 WSL 검증 동안만 사용하고 성공 증거·복구 자료 보존 후 정리한다. Main 실행 순서는 pinned `control-runtime.sh deploy a342d62391a44b349733d1468ac3b180761155ab` → verify → genuine previous324 rollback → 실제 image/current/health/SSE/DB 독립 관측 → 후보 재배포·verify → cleanup. 각 action에 immutable control SHA/raw manifest/action checksum을 전달한다. rollback approved_commits는 `[candidate,324]`만 허용한다. 이전 dump/receipt는 재배포로 갱신되기 전 별도 보존한다.
- 정리 명령은 검증된 control의 `control-runtime.sh cleanup a342d62391a44b349733d1468ac3b180761155ab`(내부 cleanup.sh)이며, 양 프로젝트 label allowlist를 모두 확인한 뒤 서비스3종·비어 있는 전용망4개·지정 볼륨2개만 제거한다. 이미 없는 자원은 idempotent 처리하고 unrelated 자원/기존 `.env`/자료는 보존한다. Main 최종 Docker inspect/list로 지정 container/network/volume 및 restore scratch DB/cookie 잔류0을 검증한다. 실패 시 부분 상태를 각각 기록하고 전체 PASS를 선언하지 않는다.
- Telegram·Provider 실제 호출, ysna 실행, main 병합 제외. C-21 실제 검증 결과 후에만 별도 결과 event를 append하고 C-01은 독립 판정까지 차단한다. B finalizer는 현재 HEAD와 historical bytes를 검증하며 같은494 event만 재결박하고 다른494는 덮어쓰지 않는다.


## seq493 결박 구현·로컬 검증 완료 / Main 최종 동결 검토 인계

- 기록 대상은 candidate `5f8c301e18c332e3353092dab9efe5c32d0fda84`의 exact12 direct-child 후속 기록이며 candidate54 / 기록 후 누적56이다. 제품 I-3는 로컬 보완·검증됐고 과거492 및 approval/evidence는 불변이다.
- Producer 새 계약 RED: 1 FAIL/129 deselected/0.60s(493 manifest 부재). 보완 후 focused tooling13 PASS/94.70s와 guard16 PASS/122.05s. 최종 전체 tooling130 PASS/445.50s(exit0,8061), harness69 PASS/1 parser SKIP/399.44s(exit0,23190)를 각각 1회 실행했다. SKIP는 Windows Compose parser 부재이며 이번 실제 WSL 실행 증거로 대체하지 않는다.
- Main 독립 critical3 PASS/36.72s(exit0,39021): actual Git exact12 direct-child, runtime HOLD 및 coherent local evidence 외부 성공 승격 거부. Main raw 감사239파일/492 prefix841414 bytes/hash F38EA939…C063/unique493/rollback 제품 byte 불변 PASS. Reviewer 별도 archive402파일·기존 WSL validator AST 보존 PASS/finding0.
- 동일 최종 generator build+finalizer 재실행 비교는 exact12 hash 모두 동일, Changed=[]/Idempotent=true(exit0,7941). event493도 byte 불변으로 이중 append나 기록 rollback이 없었다. 기존492 generator/finalizer는 실행·수정하지 않았다.
- 현재 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`, public guard return22. 현재 private push 상태는 NOT_EXECUTED_EXTERNAL_SCOPE_HOLD다. 실제 push/merge/배포/rollback/cleanup/DB/Telegram/Provider는 하지 않았으며 C-21 완료·C-01 시작으로 승격하지 않는다. Main 최종 기록 commit 검토 전 checksum만 마감한다.

### 아래는 seq493 준비 단계의 누적 기록


## seq493 rollback allowlist 제품 후속 결박 진행 / 2026-09-05

- 담당: Main 어울 관리, 단일 writer pg18_binding_resume. 제품 후보 `5f8c301e18c332e3353092dab9efe5c32d0fda84`, parent `48fbad8be35c7e826dd31363464c7c477d9ca9e8`, correction exact2. 내부 기록 예상 exact12, validated base 누적 candidate54 / record 후56.
- I-3 rollback approved_commits membership 누락은 기존 승인 계약의 제품 구현 결함으로 보완됐다. Producer focused10 PASS(21.78s), 전체 harness69 PASS/1 parser SKIP(346.77s, exit0), Main 독립 focused10 PASS(25.19s), SPEC PASS/QUALITY APPROVED는 로컬 제품 증거다. 새 seq493 결박 테스트는 아직 미완료이며 이전 결과로 대신하지 않는다.
- 직전 로컬 ccf5109 candidate/48fbad8 control은 미push·미배포. 실제 WSL 잔류는 candidate324eb169/control3f52d26이며 보조 internal transport의 API·SSE·Last-Event-ID·backup/restore 성공과 정식 localhost ingress 실패는 과거 증거 그대로 유지한다.
- 현재 gate는 `BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE`. public guard는 고정 exit22로 실행을 거부한다. 제품 I-3의 로컬 보완과 외부 실행 허용은 별개이며 이번 기록 범위에서 push/merge/배포/실제 rollback/cleanup/DB/Telegram/Provider를 수행하지 않는다. C-21 완료나 C-01 시작으로 승격하지 않는다.
- 기존 seq1~492와 historical evidence/approval 원문은 보존하며 seq493 이벤트 단1개만 append한다. cleanup·ingress human approval hash를 유지하고 seq492 derived hash를 부모로 새 내부 구현 수정 binding을 연결한다. 원격 관측은 09:59의 3f52/324 확인이며 새 원격 관측으로 표현하지 않는다.
- 다음: seq493 정적 원문 검토 → focused RED/GREEN → tooling/harness 각1회 → checksum/계보/변조 거부 확인 및 Main 검토. 서버·네트워크·Secret 변경은 없다.


## 2026-09-05 Main 최종 전수 검증과 마지막 fixture 보완

- Main frozen 전체 tooling session87925는 exit0, 123 PASS(394.63s). 전체 harness session59377은 exit1, 1 FAIL/59 PASS/1 SKIP(360.62s)였다. 유일 실패는 새 runtime HOLD가 rollback 알고리즘 fixture보다 먼저 exit22하여 기존 docker log 검증에 도달하지 못한 테스트 경계 문제다.
- Main의 한정 지시에 따라 복사된 rollback 단위 fixture의 guard 호출만 binding 전용으로 계측하고 테스트 이름/주석에 단위 경계를 명시했다. 실제 제품 rollback.sh와 runtime exit22는 변경하지 않았다. 기존 PG15/PG18 image 사전검사 및 Compose 변경0 assertion을 유지했다.
- 보완 단일 node `test_rollback_unit_pg18_preflight_failure_makes_zero_compose_mutations`는 exit0, 1 PASS/60 deselected(6.84s). Main 전체 실패 결과를 단일 전체 PASS로 덮어쓰지 않는다. 최종 결과는 tooling 전수123 PASS, harness 전수59 PASS/1 FAIL/1 SKIP 이후 해당1건 focused PASS로 구분한다. parser SKIP는 기존 실제 WSL Compose 두 target GREEN 증거와 별도다.
- 기록/HANDOFF와 checksum만 마감 재결박한다. candidate ccf5109 제품/과거491 evidence 불변, I-3 미해결 및 runtime BLOCKED_IMPORTANT_I3/exit22 유지. 새 후보 배포·rollback·cleanup·Provider·Telegram은 미실행이고 Main 기록 commit을 위한 최종freeze 상태로 인계한다.

## 2026-09-05 seq492 최종 보완·독립 검증 인계

- 판정: seq492 결박 보완의 writer 검증 완료, Main 독립 전수 검증·기록 commit 전 상태. 새 candidate ccf5109는 미push·미배포다. runtime은 `BLOCKED_IMPORTANT_I3`이며 제품 rollback allowlist 보완이 필요하다. 기존 SPEC PASS/QUALITY APPROVED는 I-3 발견 전 검토다.
- 전체 실행 결과는 tooling5 FAIL/117 PASS(322.92s), harness3 FAIL/53 PASS/1 SKIP(281.38s) 그대로 보존한다. 원인은 historical helper tuple 처리5건과 새 approval blob이 없는 fixture3건으로 서로 다른 테스트 구성 문제다. guard 판정을 완화하지 않고 fixture·helper만 보완했다.
- 보완 후 focused: historical491+seq492 tooling10 PASS/112 deselected(111.53s), harness10 PASS/49 deselected(135.64s), 실제cleanup.sh I-3 진입차단2 PASS/59 deselected(35.99s), HOLD→ALLOWED 변조거부1 PASS/122 deselected(1.51s), 모두exit0. 이를 단일 전체 실행 PASS로 표시하지 않는다. 최종 전체 tooling/harness는 Main이 freeze 이후 독립 수행한다.
- 정합성 함수와 runtime 함수를 분리했다. 정상binding은 PASS지만 실제runtime 진입은 고정exit22로 거부하며 bypass가 없다. 실제cleanup.sh fixture 진입에서 Docker호출0·파일변경0을 확인했다. 삭제 알고리즘 테스트는 별도 계측 fixture의 단위 검증이며 실제cleanup 성공이 아니다.
- Main 독립 감사: historical491 raw827250/hash7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71 및 canonical8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7 보존. 기존 evidence/approval237개 raw bytes가 후보 Git blob과 모두 동일(session64111 exit0). candidate 제품은 수정하지 않았다.
- 변경은 exact13 record 범위이며 HANDOFF·환경문서에 deployed324/control3f52와 미배포localccf/seq492를 구분했다. I-3 최소2파일 후속 제품 제안은 scratch seq492-i3-rollback-proposal.md에 기록했다. 다음은 Main 독립검증·기록 검토 후 별도 I-3 제품 수정 승인·검증이며 자동 deploy/rollback/cleanup 또는 C-01 시작은 금지한다.

## 2026-09-05 seq492 생성·append 검증 진행

- 신산님의 정확한 명시 승인 및 Main 정적 검토 후 require_escalated build exit0. candidate ccf5109/record 계획은51/13/54, derived binding은1634 bytes·8FE8DCD4D90A91393E777E0FABCF60E51A68B93DB2B77197E12FC6445EF2D5EE다. 생성 AST4/guard Bash syntax와 finalizer의 historical491 raw/canonical prefix·last-id assertions 통과 후 seq492 한 행을 append했다.
- 신규 focused 초기2 PASS/1 FAIL은 seq492 head_relation 허용 분기 누락으로 확인하여 기존491을 유지하고492만 추가했다. 해당 회귀1 PASS 후 progress checker492/AUTO_CONTINUE PASS. guard positive 및 approval/derived 동시 재계산 변조 거부는4 PASS(18.69s).
- 별도 audit exit0: exact51/13/54, historical491 raw827250/hash7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71, 기존manifest/digest와 이전 WSL validator AST, 후보 제품 파일 불변 PASS. 전체 tooling43279/harness2406는 각각1회 실행 중이고 일부 실패가 관찰되어 상세 결과 확인 전 완료로 판정하지 않는다.
- Main이 기존324 배포의 mutable server receipt4개를 읽기 전용으로 별도 보존했다. 이는 후속 표준 배포에서 갱신될 옛 receipt 보존이며 새 후보 검증 성공이나 Git historical evidence를 대체하지 않는다. 새 candidate push/deploy/DB/cleanup/Provider/Telegram 실제 실행은 여전히 NOT_EXECUTED다.

## 2026-09-05 seq492 정확 범위 명시 승인 후 재개

- 신산님이 seq1~491/historical evidence 보존, ccf5109용 checker·guard·manifest·승인 binding·finalizer/관련 생성기·계약 테스트 보완과 이벤트 append·계보·변조 거부·checksum 검증을 명시 승인했다. 기존 ingress 원승인 범위와 새 후보 외부실행 NOT_EXECUTED를 유지한다.
- 정식 심사로 scratch generator 정적6항목 보완이 이번에는 승인·적용됐다. actual approval Git blob hash pin, rollback2SHA/fixtureapproval, raw491 불변/id assertions, 491/492 gate분기, actual09:59:29시각/legacyanchor와 private remote 분리, 증거승격금지를 반영했다. 새 approval draft에는 실제ccf후보와 후속 명시승인 원문을 기록했다.
- AST 파싱만 실행하여 GENERATOR_AST_PASS_NO_EXECUTION exit0, git diff --check exit0. generator build와 보호 checker/guard/manifest/events 변경은 아직 미실행이다. exact51/13/54 변경계획을 Main에 제출하여 실행 전 검토 대기한다. 이전 거절3회는 삭제하지 않으며 새 명시승인에 따른 정상 재개와 구분한다.

## 2026-09-05 09:38 seq492 재개 지시 후 플랫폼 재심사 결과

- 신산님의 현재 `계속 진행하자`를 전달받아 동일 seq492 작업의 scratch 정적 제안 보완만 정식 재심사했다. generator build는 실행하지 않았으며 checker/guard/manifest/events 등 보호 파일을 변경하지 않았다.
- scratch `rebind_seq492.py` 단일 파일에 6개 미완성 항목을 보완하는 apply_patch 1회도 플랫폼이 거절했다. 원문: “패치가 단순 정적 검토를 넘어 향후 checker·guard·manifest·approval binding을 재작성하는 생성기의 보안·권한 경계를 확장하지만, 사용자는 해당 구체적 변경을 명시적으로 승인하지 않았습니다.”
- 패치는 전체 미적용이다. 이번 재개 후 거절1회이며 기존 거절2회와 구분한다. 같은 요청 재시도·다른 도구 우회·생성기 실행을 하지 않고 Main에 정확한 원문을 즉시 전달했다.
- 실제 clock 관찰은 2026-09-05T09:38:06+09:00이다. generator의 미래10:00 문구를 포함한 정적 미완성 사항은 여전히 남아 있어 실행할 수 없다. 다음은 구체적 checker/guard/manifest/approval binding/finalizer 보완·seq492 append에 대한 사용자 명시 승인과 플랫폼 재심사이며, 새 기능·push·배포·서버 변경은 포함하지 않는다.
- 권한 거절은 누적3회이며 제품 정식 FAILURE_REPORT 횟수와 별개다. Main 지시에 따라 추가 generator/code 수정·재시도를 중단한다. 코드와 보안 허용 조건을 변경하는 다음 정확한 승인 문구가 필요하다: “기존 seq1~491 및 historical evidence를 보존하면서 ccf5109용 seq492 checker·guard·manifest·승인 binding·finalizer와 관련 생성기·계약 테스트를 보완하고, seq492 append 및 계보·변조 거부·checksum 검증을 수행하는 것을 승인한다.” 이는 아직 검증되지 않은 새 candidate의 성공 선언을 허용하지 않는다.

## 2026-09-05 seq492 결박 실행 플랫폼 거절 checkpoint

- 판정: 제품 candidate `ccf5109d0640bf28c461e7754ad56e0821fd77be` exact7 구현·기본 검증 완료. 아직 push·배포하지 않았고 C-21 완료가 아니다. 이전 `3cc869e`는 복구용 보존ref에만 남은 미배포 중간 후보다.
- 담당: Main이 권한 판단과 외부 실행 담당, pg18_binding_resume 단일 writer는 보호 대상 쓰기·재시도를 중단했다.
- seq492 신규 tooling 계약 테스트는 manifest 없음으로 기대 RED를 확인했다. generator build 요청은 checker·manifest·guard·approval binding 변경의 명시 승인 근거 부족으로 플랫폼에서 거절됐고, 후속 scratch-only 보완 패치도 같은 이유로 거절됐다. 거절2회이며 우회 실행하지 않았다.
- 보호 대상 checker·guard·CandidateReleaseManifest·events 변경은0이다. 현재 dirty는 기존 docs/WORK_STATUS.md와 docs/DEVELOPMENT_ENVIRONMENT.md, 새 approval artifact, 신규 tooling tests다. historical seq1~491 및 기존 evidence는 그대로 보존했다.
- generator는 현재 미완성이므로 실행 금지: 실제 exception approval Git blob hash pin, rollback 두SHA fixture, raw491→492 id 확인, 실제 관찰시각 적용(현재 draft의 미래10:00 제거), seq492 gate/routing 분기 정합성 보완이 남아 있다. 새 approval draft의 중간3cc candidate 표기도 최종ccf5109로 정정해야 한다.
- 다음 정확한 승인 대상: 기존 seq1~491 원문·hash와 historical evidence를 보존하면서 candidate `ccf5109`의 seq492용 checker/guard/manifest/새 approval binding/finalizer를 보완하고 seq492를 append한 뒤 계보·변조 거부·checksum을 검증하는 작업이다. 플랫폼의 명시적 재승인 전 이를 자동 승인된 것으로 간주하지 않는다.
- 현재 이 checkpoint 외 파일 쓰기·generator 실행·재시도는 하지 않는다. Main의 실제 WSL full-suite 결과는 수신 후 별도로 기록하며 미수신 결과를 PASS로 표시하지 않는다.
- Main 추가 검증 실제 결과: full harness session27234는 exit1, 9 FAIL/45 PASS/1 SKIP(263.41s). 실패 상세는 D:\tmp tempdir 설정이 적용되지 않아 C:/Users/.../Temp로 fallback되고 Bash mkdir /c/Users/cyhuh Permission denied로 cold-start log 미생성/control startup 미진입한 환경 경계다. 최종 제품 검증 PASS로 처리하지 않는다.
- Main은 코드 변경 없이 정식 require_escalated 테스트 재검증 session5210을 시작했다. 선택 범위는 `WslColdStartTests or WslControlRuntimeTests` 12개 node이며 실제 결과 대기 중이다. 이 테스트 전용 권한 재검증은 checker/guard/manifest 보호 변경 거절의 우회가 아니다. 보호 대상 및 신규 field/부정 case 생성 쓰기 금지를 유지한다.
- Main 최종 환경 진단: 같은 TEMP 설정에서도 기본 권한은 configured D:\tmp와 달리 selected C:/Users/.../Temp였고, require_escalated에서는 selected D:\tmp와 일치했다. 임시 경로 접근의 실행 환경 원인을 확인했다. 동일 제품 코드의 session5210 재검증은 11 PASS/1 parser SKIP/43 deselected(27.27s, exit0)이며 앞선 실패9개를 모두 포함해 해소했다.
- 종합 검증은 서로 다른 실행의 고유 node 기준54 PASS/1 parser SKIP다. 단일 전체 실행에서54 PASS한 것으로 표시하지 않는다. parser SKIP는 별도의 실제 WSL Compose 두 target GREEN 증거와 구분한다. 제품 `ccf5109` exact7을 유지하며 실제 새 WSL 배포는 수행하지 않았다.
- 현재 유일한 차단은 seq492 checker/guard/manifest/approval binding/finalizer 보완·append를 위한 플랫폼 예외 권한이다. 미완성 정적 제안 보완을 포함한 정확한 사용자 명시 승인이 필요하다. Main이 최종 보고하며, 이 checkpoint 이후 다른 파일 쓰기·재시도·서버 변경을 하지 않는다.

## 2026-09-05 seq491 실제 검증 후 WSL ingress 예외 승인·seq492 준비

- 기준선: clean record/control `3f52d26a61e49543dd3d3121f5cc62a04f809a3d`, candidate `324eb169fedbce958d2e8cc29362deb7af433677`. private push/fresh recovery PASS 후 Main 실제 deploy exit0, PG15/PG18 named volume1씩/anonymous0, migration0013 PASS.
- 보조 runner exit0: PG15/PG18 INTERNAL_BRIDGE_API_CONTRACT에서 authenticated SSE/Last-Event-ID/backupRestore PASS. 정식 verify는 loopback4770 connection refused, rollback은 previous15 없음 preflight로 무변경 종료했다. host/browser ingress 및 genuine rollback/cleanup은 아직 미완료다.
- Main의 restore scratch DB read-only 조회는 두 target 모두0건이며, 임시 cookie/session evidence 디렉터리 조회도0건이다. 샌드박스 WSL E_ACCESSDENIED는 승인된 동일 read-only 재실행 성공으로 해소됐으며 WSL 서비스 장애로 판정하지 않았다.
- 신규 예외: Main은 WI outbound 경계를 ingress까지 적용하고 non-internal망을 새 예외로 분류했다. 신산님의 현재 `승인해`가 직전 제안한 WSL QA ingress-only non-internal망 예외와 구현·검증에 적용됐다. ingress2 container/2 dedicated network만 추가하고 app/DB internal-only, loopback4770/4870, Git-only candidate/control, Provider·Telegram 실제호출 금지, ysna 변경금지를 유지한다.
- writer: `pg18_binding_resume` 단일 writer. 승인된 최소 compose/nginx/deploy/rollback/cleanup/회귀 보완과 환경 문서 정정 진행. seq1~491 events 및 historical evidence는 수정하지 않는다. 현재 문서·제품 dirty는 기준선3f52에서 보존하고 검증·새 candidate 확정 후 seq492만 append한다. 그 전 checker projection mismatch를 숨기거나 PASS로 표시하지 않는다.
- 다음: ingress 정식 host 검증→genuine previous324 rollback→candidate 복귀→후속cleanup/잔류0→C-21 독립 판정. 활성 gate 때문에 C-01과 종속 C-02~20 구현은 아직 시작하지 않는다. 독립 증거/명세/환경 문서 작업은 계속한다.
- 구현 검증 진행: 신규 ingress TDD 3 RED 후 최소 구현, 초기 focused 19 PASS/33 deselected. cleanup network label·unrelated endpoint·absent 추가 케이스를 포함한 관련 전체 harness 실행 중. Bash syntax 3파일 및 diff-check PASS. Main Windows→WSL wildcard 인용 오류1건은 원문/Secret 전송 없이 단일 health 재실행 exit0로 해소; 제품 실패와 구분한다.
- 구현 검증 마감: 관련 harness52 PASS/1 parser SKIP(188.16s), 추가 nginx temp 회귀1 PASS. 실제 Main nginx configcheck는 비root/read-only 조건에서 fastcgi temp 기본경로 오류1회→temp3개 /tmp 명시 후 동일 조건 exit0 PASS. 제품 exact6 freeze, 문서2개는 후속 record로 분리. 아직 실제 host/SSE/rollback 배포 검증과 새 projection은 미완료다.
- Main 독립 실제 WSL docker-compose config --quiet는 PG15/PG18-rc 각각 exit0(dummy 환경, 자원생성 없음). PyYAML parser SKIP와 구분하여 실제 Compose 파싱 증거를 확보했고 bash3/diff-check도 독립 exit0 확인했다.
- 후속 cleanup entrypoint의 .env 미로드를 Main 실제 no-env Compose RED로 확인하여 cleanup.sh에 권위 검증 후 기존 loader를 추가했다. 신규 실행 fixture의 Windows/Bash 경로원인2회는 Main이 테스트 write lease를 인수하여 처리 중이며 통과로 처리하지 않는다. `3cc869e`는 unpublished 중간 후보이고 Main 소유 보존ref `codex/preserve-c21-ingress-3cc869e`에 복구 가능하다. 목적은 candidate amend 전 보존, 새 후보 원격 복구 확인 후 정리를 검토한다. 최종 exact7 candidate SHA 수신 전 seq492 projection은 보류하고 승인 artifact만 새로 준비했다.
- Main 직접 인수 종료: fixture POSIX script arg로 환경경계 수정. load1줄 제거 기대RED1건→복원 후 ingress class5 PASS, cleanup syntax/diff PASS. 전체 관련55node는54 PASS/1 parser SKIP(실제 WSL parser2 target 별도 PASS). exact7 제품 freeze, actual cleanup/새 candidate 배포는 미실행이며 최종 amended SHA를 기다린다.

## 2026-09-05 seq491 WSL cold-start 보완 후보

- Main 검토 후 bootstrap Bash 전달, DB health 최대 120초 대기, tmpfs 단일 mount 및 PG18 volume target 보완을 candidate `324eb169fedbce958d2e8cc29362deb7af433677`에 결박했다. parent는 seq490 control `18fa604531acfd303c10effa528797fbd5b55c8b`이며 correction exact5다.
- 이전 seq490 candidate/control private push와 fresh recovery 검증은 PASS다. 실제 WSL에서는 bootstrap permission error, 최초 DB 준비 전 backup 실패, warm retry에서 backup/image build 성공 후 잘못된 tmpfs로 migration container 생성 실패를 확인했다. PG15 DB는 healthy, migration 실행·web 생성·PG18 실행은 미완료다.
- 새 후보 배포·DB 검증·volume cleanup·Telegram·Provider는 미실행이다. PG15 warm 성공을 새 후보 cold-start 성공으로 표시하지 않는다.
- seq1~490 event bytes와 기존 manifest/digest를 보존하며 seq491만 append했다. exact48 후보/exact11 record/누적 exact50, 자동 private push 정책과 기존 cleanup 승인 범위를 유지한다.
- 담당: developer-primary-wsl 단일 writer. 변경은 successor exact11만. Main review 후 자동 private push/recovery 및 WSL 실제 검증으로 이어간다. C-01은 C-21 독립 판정 전까지 차단한다.

## 2026-09-04 private 개발 Git 시범 전환

- 담당: Main Agent 어울
- 적용 범위: Anvil만 해당하며 다른 프로젝트에는 적용하지 않는다.
- 판정: `ACTIVE_GIT_REMOTE_TRANSITION`
- canonical repository: `D:\Project\Anvil`
- active worktree: `D:\tmp\anvil-c21-operational-execution`
- active branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 기존 공식 remote: `https://github.com/cyhuh7950/anvil.git`
- 기존 공식 remote 역할: 전환 후 `release`
- 계획 private 개발 remote: `sinsan-develop/Anvil`, visibility `private`, 전환 후 `origin`
- private 저장소 존재 확인: `CREATED_AND_BROWSER_CONFIRMED_PRIVATE` (`sinsan-develop/Anvil`)
- GitHub CLI 확인 계정: `cyhuh428-sinsan`; `sinsan-develop` 인증은 아직 확인되지 않았다.
- canonical root dirty 보존: `AGENTS.md` modified, `packages/agent_team/`, `tests/agent_team/` untracked. reset, clean, stash, 삭제, 덮어쓰기 금지.
- C-21 candidate 상태: local commit `93c58f7`, 기존 공식 remote보다 1 commit ahead, 기존 공식 remote push 미실행.
- 생성 예정 외부 자원: `sinsan-develop/Anvil` private repository.
- 생성 이유: WSL-server LLM 개발 전체 history를 비공개로 보존하고 공식 저장소에는 승인된 배포 allowlist만 반영하기 위함.
- owner/lifetime: `sinsan-develop`; Anvil 개발 기간 유지, 종료·이관 시 신산님이 archive/delete 여부 결정.
- 폐쇄 조건: private 개발 history 보존·공식 release 인수·필요 branch/tag archive가 완료되고 신산님이 폐쇄를 승인한 경우.
- WSL SSH 원칙: WSL-server 전용 key pair와 `github-sinsan-develop` alias를 사용하고 Windows private key는 복사하지 않는다. public key만 GitHub 계정에 등록한다.
- 오류: 기존 공식 원격 push가 exact destination 승인 부족으로 1회 차단됨. 최신 Git 분리 지시에 따라 같은 push를 재시도하지 않는다.
- 미검증: `sinsan-develop` GitHub CLI 인증, WSL SSH public-key 등록 필요 여부, private push/clone 복구 검증, official clean RC allowlist.
- 다음 조치: private 저장소와 WSL 전용 SSH 인증을 구성하고 기존 공식 remote를 보존한 채 private remote를 추가하여 push/clone을 검증한다.

## 2026-09-04 C-21 WSL Git SSH 선행작업

- 시작: `2026-09-04T16:59:26+09:00`
- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 승인 범위: 실제 WSL-server 접속 경로 확인, WSL 사용자 홈 전용 ed25519 키 생성 또는 재사용, `github-sinsan-develop` SSH alias 멱등 구성
- 비공개 원칙: private key 내용은 출력·기록하지 않고 public key, SHA256 fingerprint, 권한만 보고한다.
- 금지 범위: 제품·역사 파일, Docker, DB, volume 변경 없음
- 접속 확인: Windows `wsl.exe -d Ubuntu -- ...` → WSL2 `Ubuntu`, user `daon`, home `/home/daon`, hostname `SINSAN`
- GitHub 기존 key 기준: 이름 `sinsan-develop`, fingerprint `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`
- 오류 횟수: 1
- 오류: 첫 key 구성 명령은 Windows→WSL 중첩 quoting으로 WSL의 key 경로가 빈 문자열이 되어 `ssh-keygen`이 즉시 실패했다. 키·config 파일은 생성·변경되지 않았다.
- 다음 조치: quoting 영향을 제거한 stdin script 방식으로 동일 작업을 1회 재실행하고 fingerprint를 기존 GitHub key와 비교한다.
- 키 결과: `CREATED`; `/home/daon/.ssh/id_ed25519_github_sinsan_develop`
- public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICD0B/9D44dRWm06tj8e3XyWPGxh5A/+osehuAgLlvkN anvil-wsl-server`
- WSL key fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- GitHub 기존 key fingerprint 비교: `DIFFERENT`; 새 public key는 GitHub 등록 대기
- 권한: `.ssh=700 daon:daon`, private key=`600 daon:daon`, public key=`644 daon:daon`, config=`600 daon:daon`
- alias 해석: host `github.com`, user `git`, identities-only `yes`, identity file `~/.ssh/id_ed25519_github_sinsan_develop`
- 멱등 검증: alias block count `1`, config hash unchanged `no`
- 오류 횟수: 2
- 오류 2: 기존 alias block 제거 후 앞쪽 빈 줄을 정규화하지 않아 두 번째 적용에서 config 파일 hash가 변경됐다. alias 의미와 단일 block은 유지됐으나 byte-level 멱등 계약은 실패했다.
- 최종 상태: `FAILURE_REPORT`
- failure fingerprint: `WSL_SSH_CONFIG_TRAILING_BLANK_NON_IDEMPOTENT`
- 영향: 키와 alias는 사용 가능한 상태지만 config를 다시 적용할 때 빈 줄이 누적될 수 있다. private key는 재생성하지 않는다.
- 미수행: GitHub public-key 등록, SSH 네트워크 인증, private repository push/clone. 제품·역사 파일, Docker, DB, volume 변경 없음.
- 정확한 다음 조치: 기존 키를 재사용하고 alias block 제거 결과의 trailing blank를 정규화한 뒤 두 번 적용하여 byte hash가 동일한지 확인한다.

### Fix round 1

- 시작: `2026-09-04`
- 상태: `IN_PROGRESS`
- 보존 조건: 기존 `/home/daon/.ssh/id_ed25519_github_sinsan_develop` key와 fingerprint를 재생성·변경하지 않는다.
- 수정 범위: `~/.ssh/config`의 `github-sinsan-develop` 관리 block과 파일 끝 연속 blank/공백만 정규화한다.
- 다음 조치: 변환 전 fingerprint를 확인하고 같은 변환을 2회 적용하여 hash·block count·`ssh -G`·권한을 검증한다.
- Fix round 1 오류 1: 검증 단계의 inline `awk`에서 `$1`이 Bash positional parameter로 해석되어 `bash: 줄 38: $1: 바인딩 해제한 변수`, exit 1이 발생했다. config 변환 2회와 hash 산출은 이미 끝났으나 의미 검증 출력 전 중단됐다.
- 조치: config를 다시 변환하지 않고 현재 파일의 hash·block count·의미값·권한·fingerprint를 read-only 명령으로 검증한다.
- 적용 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded approved fix script> | base64 -d | bash"`
  - script 핵심: fingerprint 선검증 → exact managed block만 `awk`로 제거 → 파일 끝 whitespace-only line 제거 → blank separator 1개와 관리 block append → 같은 함수 2회 실행 → `sha256sum` 비교
  - 적용 명령 exit: 1. 두 번 적용과 `hash1 == hash2`, block count 1 검사는 통과했으나 후속 inline `awk` 의미 출력의 Bash quoting 오류로 종료했다.
- 최종 read-only 검증 명령: `wsl.exe -d Ubuntu -- bash -lc "echo <base64-encoded read-only validation script> | base64 -d | bash"`
  - 검증 명령 exit: 0
- 1차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- 2차 적용 hash: `6dd3e81cfbc61f1989a3fd4dd5138c48742ea30b0c8794d405fc54798ab9d257`
- byte-level 멱등성: `PASS`
- alias block count: `1`
- `ssh -G` 의미값: `hostname github.com`, `user git`, `identitiesonly yes`, `identityfile ~/.ssh/id_ed25519_github_sinsan_develop`
- 보존 fingerprint: `SHA256:5nr41sDAJxdLKcegRsQL2RS6oA/BLuHBmHGwD6A8Zk0`
- 최종 권한: `.ssh=700 daon:daon`, private=`600 daon:daon`, public=`644 daon:daon`, config=`600 daon:daon`
- Fix round 1 오류 횟수: 1
- Fix round 1 최종 상태: `COMPLETED`
- 변경 범위 확인: WSL `~/.ssh/config` 관리 block과 파일 끝 blank만 변경. 기존 key 재생성 없음. 제품·역사 파일, Docker, DB, volume, Git 변경 없음.
- 잔여 작업: fingerprint가 기존 GitHub key와 다르므로 새 public key의 GitHub 등록은 별도 단계에서 필요하다.

## 2026-09-04 C-21 WSL harness review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 변경 범위: `deploy/wsl`, `tests/deploy`, `docs/WORK_STATUS.md`
- findings: I1 Git blob 원본-byte checksum, I2 control/candidate ref 분리 및 verify 선행 guard, I3 fake Docker cleanup 무삭제/정확삭제 계약
- 금지: seq/event historical 파일, commit, push, deploy, 실제 Docker·DB·volume 삭제
- 오류 횟수: 0
- 다음 조치: 실패하는 checksum/ref/verify/cleanup 계약 테스트를 먼저 추가한다.
- TDD RED 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- 최초 RED 결과: exit 1, 15 tests 중 3 failures. control ref exact 제한 미구현 2건(상속 중복), verify 선행 guard 미구현 1건.
- RED 보강: fixture manifest 끝 LF를 추가하여 Git blob raw-byte checksum 결함도 탐지하도록 조정했다.
- 사용자 정정 인수: 정식 alias의 IdentityFile은 `~/.ssh/sinsan-develop`이다. harness 검증 후 기존 key의 fingerprint/권한을 확인하고 alias를 이 경로로 멱등 복원한다. 새로 생성된 `id_ed25519_github_sinsan_develop`은 삭제하지 않고 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다.
- 구현 결과:
  - I1: control Git blob을 `git show ... | sha256sum`으로 직접 hashing하여 끝 LF를 포함한 원본 byte checksum과 일치시켰다. 정상 checksum 및 manifest blob 1-byte 변조 거부 계약을 추가했다.
  - I2: control ref를 `refs/remotes/origin/codex/c21-operational-execution`, candidate ref를 `refs/remotes/origin/candidates/c21-wsl-exact34`로 고정했다. 두 commit의 상이성과 candidate→control ancestry를 강제했다. `verify.sh`는 checksum과 control ref를 요구하고 첫 runtime-state write 전에 동일 guard를 호출한다.
  - I3: fake Docker/Compose로 세 label 각각의 mismatch 및 두 번째 volume mismatch에서 삭제 호출 0건, 정상 시 allowlist의 정확한 두 volume만 삭제함을 검증했다.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `tests/deploy/test_wsl_staging_harness.py`, `docs/WORK_STATUS.md`
- TDD GREEN 명령: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider`
- TDD GREEN 결과: exit 0, `15 passed in 18.56s`
- Bash/diff 명령: 모든 `deploy/wsl/*.sh`에 `bash -n`; `git diff --check -- deploy/wsl tests/deploy docs/WORK_STATUS.md`
- Bash/diff 결과: 각각 exit 0
- 전역 `git diff --check` 참고 결과: exit 1, 범위 밖 `docs/DEVELOPMENT_ENVIRONMENT.md:36 new blank line at EOF`; 해당 파일은 수정하지 않았다.
- 실제 배포·Docker·DB·volume 삭제: `NOT_EXECUTED`
- WSL 정식 key 확인 명령: `wsl.exe -d Ubuntu -- bash -lc <public fingerprint and file metadata only>`
- WSL 정식 key 확인 결과: exit 1, `/home/daon/.ssh/sinsan-develop` 및 `.pub`가 존재하지 않음
- 후속 공개키 inventory: exit 0. 기존 public key fingerprint 어디에도 GitHub 등록 기준 `SHA256:RYyFyGUnPJjzMI53sLRiJJNfRa2cHL7ASGZBqfHk7N8`가 없었다.
- 현재 `github-sinsan-develop` alias: `~/.ssh/id_ed25519_github_sinsan_develop`을 가리킴. 이 key는 `UNUSED_UNREGISTERED_RESIDUAL`; 삭제·등록하지 않았다.
- alias 복원: `BLOCKED`; 존재하지 않는 `~/.ssh/sinsan-develop`로 변경하면 SSH alias가 깨지므로 수정하지 않았다.
- harness review 상태: `COMPLETED`
- 전체 결과: `FAILURE_REPORT`
- failure fingerprint: `WSL_OFFICIAL_SINSAN_DEVELOP_KEY_MISSING`
- 오류 횟수: harness 0, WSL 정식 key 확인 1
- 정확한 재개 조건: 올바른 WSL-server 경로 또는 기존 `~/.ssh/sinsan-develop` key가 존재하는 환경을 확인한 뒤 fingerprint `SHA256:RYy...` 일치와 권한을 검증하고 alias block을 멱등 복원한다.

### 정정 checkpoint

- 정정 근거: `~/.ssh/sinsan-develop` key와 `github-sinsan-develop` alias는 WSL이 아니라 Windows 사용자 SSH 설정이며, Windows `ssh -G`에서 확인됐다.
- WSL 판정 정정: WSL에 위 경로가 없는 것은 제품 또는 harness 실패가 아니다. WSL alias를 존재하지 않는 경로로 변경하지 않는다.
- WSL 신규 key: `/home/daon/.ssh/id_ed25519_github_sinsan_develop`은 GitHub 미등록 상태의 `UNUSED_UNREGISTERED_RESIDUAL`로 보존한다. 등록·삭제·재생성하지 않았다.
- 외부 인증 다음 조치: Windows의 기존 등록 key를 사용해 private repository push 인증을 우선 검증한다.
- harness I1-I3 최종 상태: `COMPLETED`
- 전체 최종 상태: `COMPLETED_WITH_EXTERNAL_AUTH_PENDING`
- 미검증: Windows key를 사용한 private repository 실제 push 인증. 이번 범위에서 push는 실행하지 않았다.

## 2026-09-04 비의미 EOF cleanup 및 candidate 외부 쓰기 계획

- 담당: `developer-primary-wsl`
- 상태: `VALIDATING`
- 비의미 cleanup: `docs/DEVELOPMENT_ENVIRONMENT.md`의 의미 내용은 유지하고 EOF 여분 blank line만 제거하여 단일 LF로 정규화했다.
- planned external write source: local commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- planned external write destination: private `sinsan-develop/Anvil`의 `refs/heads/candidates/c21-wsl-exact34`
- 목적: immutable WSL candidate를 private 개발 저장소에 보존한다.
- 공식 origin: 변경하지 않고 그대로 보존한다.
- rollback: private candidate branch 삭제이며 별도 승인이 필요하다.
- 현재 상태: `PUSH_NOT_EXECUTED`; 실제 push는 Main Agent가 수행한다.
- 외부 Git 전환 오류 1회: active worktree에서 `git remote add development ...`가 shared gitdir `D:/Project/Anvil/.git/config` 권한 거부로 실패했다. 제품 파일 변화는 없다.
- 외부 Git 전환 오류 조치: Main Agent가 승인된 Git 전환 범위에서 escalated 명령으로 재실행한다.
- 다음 조치: 전체 `git diff --check`와 focused harness 15 tests를 재실행해 결과를 기록한다.
- 전체 diff 검증: `git diff --check` → exit 0
- focused harness 검증: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.32s`
- 최종 상태: `COMPLETED`; commit·push는 수행하지 않았다.
- exact push 안전 게이트: `git push development 93c58f7...:refs/heads/candidates/c21-wsl-exact34`는 private remote와 대상 저장소에 대한 구체적 승인 부족으로 거부됐다.
- 재시도 정책: 동일 push 재시도·우회 금지.
- 필요한 정확한 승인: source commit `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`의 전체 history/content를 private `git@github-sinsan-develop:sinsan-develop/Anvil.git` branch `refs/heads/candidates/c21-wsl-exact34`로 push하는 승인.

## 2026-09-04 C-21 WSL governance control successor

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- isolated worktree: `D:\tmp\anvil-c21-operational-execution`; git dir와 common dir가 달라 기존 linked worktree임을 확인했다.
- 시작 branch/HEAD: `codex/c21-operational-execution` / `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`
- 시작 dirty 보존: `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/candidate-manifest-guard.sh`, `deploy/wsl/verify.sh`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `tests/deploy/test_wsl_staging_harness.py` modified; `docs/WORK_STATUS.md` untracked.
- 승인 범위: immutable candidate `93c58f7...`, validated base `eef3496...` 대비 cumulative exact34, historical seq1~485 불변, reviewed harness/Git transition docs의 control successor projection.
- 금지 범위: 기존 seq1~485 event/historical 내용 수정, commit, push, deploy, Docker·DB·volume 삭제.
- 탐색 오류 1회: sandbox에서 `rg.exe` 실행이 access denied로 실패했다. 제품 변화 없음; PowerShell 파일 열거로 대체한다.
- 다음 조치: authority/progress/HANDOFF/manifest/digest/checker/test 구조와 historical prefix hash를 읽고 신규 successor 계약 테스트를 RED로 추가한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k c21_wsl_control_successor` → exit 1, 신규 control successor manifest 부재로 1 failure/96 deselected. 요구 기능 부재를 정확히 탐지했다.
- checker 시도 1: `EVENT_EFFECT_MISMATCH`, `EVENT_PAYLOAD_MISSING`, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH`, `PRG_REGISTRY_HASH_MISMATCH`; seq486 envelope와 projection/hash 결박을 보완했다.
- checker 시도 2: `PRG_REFERENCED_HASH_MISMATCH` 1건; 두 번째 historical `progress-events.json` 참조가 구 hash인 원인을 확인해 갱신했다. 동일 fingerprint 연속 반복은 아니다.
- PMO 보고 routing: 향후 checkpoint, 예외, 승인, quality gate, 완료 후보는 parent PMO task `01a054f5-c2b4-7af0-b31a-c8148ef74642`로 직접 보고한다.
- legacy PMO task `01a027a8-0a37-7821-9980-aa029a33e8fd`는 read-only이며 수신·판단·승인 대상이 아니다. 기존 범위·순서·승인은 변경하지 않는다.
- 구현 결과: seq486 `evt_c21_wsl_control_successor_bound`를 append하고 candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`를 base `eef3496...` 대비 cumulative exact34로 고정했다. 기존 seq1~485 내용은 변경하지 않았다.
- CandidateReleaseManifest: `APPROVED_FOR_STAGING_VALIDATION`, candidate ref `refs/remotes/origin/candidates/c21-wsl-exact34`, control ref `refs/remotes/origin/codex/c21-operational-execution`, 승인 원문 SHA-256 `03F4DAC0219F92DA43E2972B59E40453BDB56DF36E9E4E6B4F098BEEBBBADFB7`, rollback exact candidate로 결박했다.
- 신규 evidence: `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`.
- TDD GREEN targeted: WSL active/control projection `2 passed, 95 deselected`; focused harness `15 passed in 18.15s`.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `97 passed in 41.02s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.85s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical prefix: seq1~483 `163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2`, seq1~485 `CC2A98A539CB226DB213CF4E715C599598E4819300A2676EC64E38D15DB2CDE8`, 모두 PASS.
- candidate exact34: `git diff --name-only eef3496... 93c58f7...` 34 paths가 checker의 cumulative set과 완전 일치.
- 오류 횟수: 탐색 `rg` sandbox 1회, checker 보완 round 2회, final suite 기대값 drift 2건 1회. 동일 근본 원인 3회 없음.
- 외부 side effect: push, deploy, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

## 2026-09-04 C-21 control successor review fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- review findings: I1 승인 binding이 원문 artifact와 독립 결박되지 않음, I2 seq1~485 canonical JSON hash가 raw whitespace/key-order byte 변조를 탐지하지 못함, minor 개발환경 private repository 상태 불일치.
- 시작 HEAD/branch: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` / `codex/c21-operational-execution`; 기존 control successor dirty 자료를 보존한다.
- historical raw 기준선: candidate `93c58f7...`의 seq1~485 event-object slice와 current slice가 byte-identical, bytes `780353`, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`.
- 승인 원문 hash 검토: 원문 UTF-8만 hash한 기존 `03F4...`와 달리, 이번 artifact 계약은 정확한 원문 뒤 단일 LF를 포함한 509 bytes를 SHA-256한 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`로 명시한다.
- 승인 evidence 조건: source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at은 확인 가능한 `2026-09-04 (Asia/Seoul)`만 사용하며 시각은 추측하지 않는다.
- 금지: seq1~485 event semantic/byte 수정, commit, push, deploy, Docker, DB, volume 삭제. 외부 push 재시도 금지.
- 다음 조치: 승인 artifact 및 raw byte mutation 음성 계약을 RED로 추가한 뒤 checker/manifest/progress binding을 최소 수정한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k approval_artifact_and_raw_historical_bytes` → exit 1, `C21_WSL_HUMAN_APPROVAL_ARTIFACT_MISSING` 1회. 승인 artifact 부재를 정확히 탐지했다.
- 승인 artifact: `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`; file SHA-256 `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`; source `DIRECT_USER_APPROVAL`, actor `신산님`, approved_at `2026-09-04 (Asia/Seoul)`로 기록했다.
- 승인 원문 결박: fenced payload의 정확한 원문과 후행 LF 1개를 UTF-8 509 bytes로 해시하여 `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`를 산출했다. candidate/control manifest, seq486, progress, HANDOFF가 artifact path/file hash/text hash를 독립 검증한다.
- historical raw 결박: candidate `93c58f7...`와 current의 seq1~485 event-object raw slice가 byte-identical이며 780353 bytes, SHA-256 `39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`다. whitespace 1-byte 및 semantic-equivalent key-order mutation이 raw hash에서 거부됨을 계약 테스트로 추가했다.
- 보완 오류 1회: key-order 음성 fixture가 CRLF를 가정해 `RAW_KEY_ORDER_FIXTURE_LINE_ENDING_MISMATCH`로 실패했다. 실제 LF로 수정했으며 동일 fingerprint 반복은 0회다.
- TDD GREEN: 동일 targeted 명령 → exit 0, `1 passed, 97 deselected`.
- DEVELOPMENT_ENVIRONMENT 정정: private repository는 browser-confirmed created, temporary `development` remote access는 `VERIFIED`, candidate push는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`로 현재 WORK_STATUS와 일치시켰다.
- 최종 checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=486 reporting=AUTO_CONTINUE`.
- 최종 tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `98 passed in 52.03s`.
- 최종 focused harness: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 20.78s`.
- 최종 whitespace: `git diff --check` → exit 0.
- historical/exact 검증: seq1~483 canonical `163E5D0E...B2D4D2`, seq1~485 canonical `CC2A98A5...2CDE8`, raw seq1~485 `39D6D6EC...7E60FA`, candidate exact34 모두 PASS.
- 변경 파일: `deploy/wsl/CandidateReleaseManifest.json`, `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`, `docs/DEVELOPMENT_ENVIRONMENT.md`, `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`(seq486만), `docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/WORK_STATUS.md`. 기존 harness review 변경은 보존했다.
- 미검증/미실행: private candidate push, control commit/push, WSL 배포, Docker, DB, volume 삭제, Telegram, Provider 모두 `NOT_EXECUTED`. seq1~485는 semantic/byte 모두 변경하지 않았다.
- 다음 조치: Main Agent가 검토 후 exact 승인 경계에서 immutable candidate push와 별도 control successor commit/push를 수행한다. 그 전에는 WSL 실제 배포를 시작하지 않는다.
- 최종 상태: `COMPLETED_CONTROL_SUCCESSOR_REVIEW_FIX_PENDING_MAIN_COMMIT_AND_APPROVED_PUSH`.

### Reviewer Minor 외부 Git 상태 정정

- 기존 `생성 예정 외부 자원` 표기는 당시 계획 기록으로 보존한다. 현재 authoritative 상태는 `생성 완료 외부 자원`: private repository `sinsan-develop/Anvil`이 생성됐고 브라우저에서 Private임을 확인했다.
- GitHub CLI의 `sinsan-develop` 계정 인증 여부는 `NOT_VERIFIED`로 유지한다.
- Windows SSH alias `github-sinsan-develop` 인증은 `SUCCESS`이며 temporary `development` remote access는 `VERIFIED`다.
- candidate push 상태는 `SAFETY_GATE_PENDING_EXACT_DESTINATION_APPROVAL`; 실제 candidate push는 `NOT_EXECUTED`다.
- private repository clone 복구 검증은 `NOT_EXECUTED`다.
- 이 정정은 현재 상태를 분리해 명시하는 append-only checkpoint이며 기존 오류·작업 이력의 의미를 변경하지 않는다.

## 2026-09-04 C-21 control successor post-commit fix round 1

- 담당: `developer-primary-wsl`
- 상태: `IN_PROGRESS`
- 시작 branch/HEAD: `codex/c21-operational-execution` / `73c39ca03caa615f7207eac3499c668497cecc5a`; 시작 worktree `CLEAN`.
- upstream/remote head: `origin/codex/c21-operational-execution` / `ca92b7845eda803cff3c432799642e4f9243d4d6`.
- 승인 범위: 실제 committed control commit과 그 exact path set을 신규 seq487 post-commit successor로 결박한다. candidate `93c58f7...`, base `eef3496...` exact34, 승인 artifact와 seq1~485 raw hash는 불변이다.
- 금지: seq1~486 historical event 수정, commit, push, deploy, Docker, DB, volume 삭제.
- 명령 해석 오류 1회: PowerShell이 인용되지 않은 `@{u}`를 hash literal로 해석해 baseline 조회가 실패했다. 제품 변화 없음; ` '@{u}' ` 인용으로 즉시 해소했다.
- TDD RED/checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`.
- TDD RED/tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 1, `3 failed, 95 passed`; 같은 두 repository projection 오류가 원인이다.
- failure fingerprint: `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`; 동일 fingerprint 첫 정식 발생 1회.
- 다음 조치: 기존 post-commit successor 패턴을 따라 seq487, committed control exact path set, progress/HANDOFF/manifest/digest/checker 음성 계약을 append-only 구현한다.
- safety gate 1회: Parent PMO가 canonical `Anvil_작업계획서_v1.md`에 fingerprint/원인/조치/잔여 미검증 기록을 지시했으나, 실행 안전 게이트가 권위 문서 변경에 대한 신산님의 직접 승인이 없다고 판정해 patch 전체를 거부했다. 테스트 파일을 포함한 동일 patch는 원자적으로 적용되지 않아 추가 제품·historical 변화는 없다.
- 현재 상태: `BLOCKED_PENDING_EXPLICIT_WORK_PLAN_MUTATION_APPROVAL`; 우회·재시도하지 않는다. 정확한 재개 조건은 신산님의 `Anvil_작업계획서_v1.md` post-commit 정합화 checkpoint append 승인 또는 Main Agent가 권위 문서 변경을 제외한 축소 범위를 재지시하는 것이다.
- Main ruling: 권위 문서 `Anvil_작업계획서_v1.md` mutation을 축소 범위에서 제외하고 successor evidence/HANDOFF/WORK_STATUS만으로 재개한다.
- 작업계획서 미갱신 분류: `AUTHORITY_DOC_MUTATION_EXCLUDED`; 잔여 미검증이나 승인 대기 항목으로 분류하지 않는다.
- 재개 상태: `IN_PROGRESS_POSTCOMMIT_SUCCESSOR_REDUCED_SCOPE`.
- Main ruling: seq486 `docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 immutable historical evidence로 보존하고, seq487 정본은 신규 `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`에 분리한다.
- 경로 비용: committed control exact39와 seq487 post-commit successor exact8을 분리해 신규 manifest 경로 1개가 post-commit path set에 추가됐다. `Anvil_작업계획서_v1.md`는 `AUTHORITY_DOC_MUTATION_EXCLUDED`를 유지한다.
- 현재 GREEN 전 재결박 오류는 `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`의 추가 정식 실패가 아니며, 최초 RED 1회만 유지한다.

### seq487 completion checkpoint

- checker GREEN: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=487 reporting=AUTO_CONTINUE`.
- seq487 binding: committed control `73c39ca03caa615f7207eac3499c668497cecc5a`, candidate `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad` exact34, control delta exact14/path SHA-256 `A810194414EE28410CD816CF5EAB5D1D85E1C9D1A1AFCF04ED91C15EAEC1F61F`, cumulative committed exact39을 독립 검증한다.
- 새 정본: `docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json`; seq486 `C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json`은 byte-immutable historical evidence로 유지한다. seq487 event가 신규 manifest path를 명시한다.
- 독립 raw binding: approval artifact `92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F`, approval text `2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5`, seq1~485 raw `780353` bytes/`39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA`, seq1~486 raw `782389` bytes/`784A0DC5BBDF916A752B8766E8DA89BB5B5FBC824765713DFB30C31E5269B053`.
- focused tooling GREEN: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `99 passed in 55.26s`. historical validator test은 current seq487에서 immutable seq486 artifact assertion으로 분기했고, post-commit bypass는 canonical branch 외 mutation을 거부하도록 보완했다.
- focused WSL harness GREEN: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.05s`.
- full tooling attempted once: `.venv\\Scripts\\python.exe -m pytest tests/tooling -q -p no:cacheprovider` → exit 1, `445 passed, 19 failed in 104.13s`. seq487 접점 2건은 위 focused GREEN으로 해소했다. 잔여 17건은 `test_a13_repository_scan`, `test_a14_workbench_prototype`, `test_g06_test_assets`, `test_g07_baseline`, `test_phase_g_gate`이며 해당 tests/checkers/authority/A14 assets는 `git diff --name-only 73c39ca -- <paths>` 출력이 없어 control SHA 대비 unmodified baseline이다. 원인은 existing A13/A14/B12/G07 baseline/hash expectation drift와 `npm ci --offline` cache `EPERM`; 재실행하지 않았다.
- 오류 계수: formal `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1` 1회 유지. GREEN 전 registry/reference rebinding 오류는 각각 단일 원인 확인 뒤 해소했고, 동일 seq487 failure 3회에 도달하지 않았다.
- 권위 문서: `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지; `Anvil_작업계획서_v1.md`를 수정하지 않았다.
- 미실행/미검증: commit, push, deploy, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; full tooling 17 baseline failures는 seq487 completion evidence가 아니다.
- 다음 안전 조치: Main이 exact dirty path set과 evidence를 검토하고 별도 승인 범위에서만 commit/push를 판단한다.

### Reviewer final disposition

- reviewer 판정: `SPEC PASS` / `QUALITY APPROVED`; Critical/Important finding 없음.
- reviewer 재검증: checker PASS, focused contract 3개 PASS, WSL harness 15 PASS, candidate exact34/control delta14/cumulative exact39 및 seq1~485·seq1~486 raw hash 일치.
- full tooling baseline: base 기준 `443 passed / 20 failed`; 그중 detached 환경 3건과 기존 baseline 17건으로 분리한다. seq487 change의 회귀 또는 commit 차단 사유로 승격하지 않는다.
- Minor M1: 신규 postcommit test는 manifest field 변조를 직접 커버한다. noncanonical branch 및 extra dirty path의 actual negative case는 후속 package에 흡수하며, 현재 commit을 차단하지 않는다.
- 외부 side effect/권위 문서 상태는 이전 checkpoint와 동일하다: commit/push/deploy/Docker/DB/volume cleanup/Telegram/Provider `NOT_EXECUTED`, `AUTHORITY_DOC_MUTATION_EXCLUDED` 유지.

## 2026-09-04 C-21 post-commit successor formal failure round 2

- 시작 branch/HEAD: `codex/c21-operational-execution` / `4eeff02053ac28f0cf127851f7b722e7f99f1ce2`; worktree `CLEAN`.
- TDD RED/checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`.
- TDD RED/focused tooling: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 1, `3 failed, 96 passed`; 세 failure 모두 같은 현재 bundle repository projection 오류다.
- failure fingerprint: `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1`의 두 번째 정식 발생. 원인: control SHA를 exact HEAD로 결박한 뒤 successor commit이 HEAD를 다시 변경하는 self-reference다.
- 안전한 수정 원칙: seq1~487/events/existing manifests는 불변으로 유지한다. canonical branch clean HEAD가 control `73c39ca...`의 descendant이고 `73c39ca..HEAD` cumulative path set이 seq487 postcommit exact8이며 현재 content contracts가 통과할 때만 local descendant를 허용한다. old upstream `ca92b784...`은 private push 전 expected remote로 명시 검증한다.
- PMO 전달 예외: parent PMO task `01a054f5-c2b4-7af0-b31a-c8148ef74642`로 round2 checkpoint 전송은 payload/destination에 대한 신산님의 구체 승인이 없다는 safety gate로 거부됐다. `PMO_REPORT_NOT_DELIVERED_SAFETY_GATE`; 재시도/우회 금지. 정확한 재개 조건은 신산님의 해당 PMO task·payload·destination 전송 직접 승인이다. 기술 fix는 독립 범위로 계속한다.
- 다음 조치: checker/test의 self-reference-free descendant contract와 fail-closed negative cases를 구현하고 GREEN verification을 실행한다.

### round 2 stabilization result

- stable contract: exact HEAD equality와 descendant commit count를 제거했다. canonical branch의 control `73c39ca...` ancestor, `73c39ca..HEAD` exact8 path set, private-push 전 upstream `ca92b784...`, current seq487 manifest/digest/approval/raw/candidate contracts를 조합해 local descendant를 허용한다.
- initial live checker는 WIP dirty 상태에서 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed 했으며, 이 precommit 결과는 formal round2 RED evidence로 보존한다. 이후 현재 WIP는 seq487 exact8의 subset만 허용하는 bounded verification mode로 제한했고 extra dirty path는 fail-closed다.
- clean simulated contract 및 negative coverage: noncanonical branch, extra post-control path, dirty tree, control non-ancestor, manifest field, detached digest, historical raw hash 변조를 모두 reject한다.
- checker GREEN: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 0, `PASS sequence=487 reporting=AUTO_CONTINUE`.
- focused tooling GREEN: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `99 passed in 60.94s`.
- focused harness GREEN: `.venv\\Scripts\\python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -p no:cacheprovider` → exit 0, `15 passed in 19.29s`.
- whitespace: `git diff --check` → exit 0. commit/push/deploy/Docker/DB/volume/Telegram/Provider는 계속 `NOT_EXECUTED`.

## 2026-09-04 C-21 post-commit successor review fix round 2

- Reviewer Important 조치: `_validate_git_projection`의 bounded WIP bypass를 완전히 제거했다. seq487 dirty worktree는 path가 postcommit exact8의 일부·전부여도 항상 `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed한다.
- expected live precommit checker: `.venv\\Scripts\\python.exe scripts/check_project_progress.py` → exit 1, `GIT_DESCENDANT_WORKTREE_DIRTY`. 현재 uncommitted checker/test/progress/digest/manifest/WORK_STATUS 변경 때문에 기대되는 결과이며 origin/path mismatch는 발생하지 않는다.
- clean integration simulation: actual `_validate_git_projection` 경유 canonical descendant exact8은 PASS. partial allowed dirty, current exact6 dirty, extra untracked dirty, noncanonical branch, old upstream 아닌 remote, control non-ancestor는 모두 fail-closed 음성 계약으로 추가했다.
- retained content negatives: postcommit manifest field, detached digest, historical raw hash 변조 reject를 유지한다.
- focused integration: `pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k postcommit` → exit 0, `2 passed, 98 deselected in 1.86s`; focused WSL harness → exit 0, `15 passed in 18.89s`; `git diff --check` → exit 0.
- clean committed-tree checker GREEN은 Main의 후속 commit 뒤에만 실행 가능하다. commit/push/deploy/Docker/DB/volume/Telegram/Provider는 `NOT_EXECUTED`.

### round 2 scoped re-review Minor fix

- actual `_validate_git_projection` integration simulation에 explicit tracked out-of-contract dirty case ` M arbitrary-tracked.txt`를 추가했다. 기존 partial allowed/current6/extra untracked cases와 동일하게 `GIT_DESCENDANT_WORKTREE_DIRTY`로 fail-closed한다.
- seq/event/history/workplan은 수정하지 않았고, checker/test hash에 따른 current progress/detached digest/postcommit manifest raw checksum만 재결박했다.

## 2026-09-04 C-21 postcommit evidence checkpoint

- postcommit HEAD: `67c477bed49fe24eea95dbbf4109208a4e96c1a7`; 시작 worktree는 clean이었다.
- postcommit evidence: checker PASS sequence=487, focused progress `100 PASS`, WSL harness `15 PASS`, `git diff --check` PASS. `C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_UNBOUND_R1` formal round2는 해소됐다.
- stable contract: control `73c39ca...` 이후 cumulative exact8 path/content contract는 record-only successor commit 뒤에도 유지돼야 하며, clean committed tree에서만 local descendant를 허용한다.
- PMO report: parent PMO egress는 safety gate로 `NOT_DELIVERED` 유지다. 재시도/우회하지 않으며, 정확한 재개 조건은 신산님의 destination과 payload에 대한 explicit egress approval이다.
- commit/push/deploy/Docker/DB/volume/Telegram/Provider는 `NOT_EXECUTED`.

## 2026-09-04 20:23:22 +09:00 C-21 push safety-gate rejection

- current HEAD: `5251a0b889f4e1062a5780eea9f03d8e9b9f69bb`.
- exact command: `git push development 93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad:refs/heads/candidates/c21-wsl-exact34`.
- result: `SAFETY_GATE_REJECTED`; user phrase `진행하자` was insufficient explicit payload/destination egress approval. Safety-gate lineage failure count incremented to `2` (not a product failure).
- no workaround attempted. Control ref push, recovery clone, remote rename, and WSL deploy were not executed.
- exact resume condition: explicit approval of both full-SHA pushes to `git@github-sinsan-develop:sinsan-develop/Anvil.git` and recovery clone create/verify/delete.

## 2026-09-04 21:40:19 +09:00 C-21 control-runtime hardening takeover

- read-only WSL audit found that candidate checkout could replace the later `verify.sh` command path; runtime execution remained `NOT_EXECUTED`.
- Developer fix round produced the initial separate control checkout, then independent review reproduced stale-descendant execution and rollback preflight gaps.
- first rework closed rollback approval/two-target preflight, but dependency-closure and concurrent active-pointer findings remained.
- the same incomplete condition (required adversarial tests not written before turn end) repeated three consecutive handoffs; Main stopped further Developer dispatch and performed the approved direct takeover. This is a takeover-policy count, not a product-failure count.
- Main TDD evidence: abandoned-stage cleanup RED failed with residual `stage.abandoned`, then GREEN passed; concurrent invocation RED exposed non-portable active symlink replacement, then the locked atomic text pointer plus exact physical stage execution passed.
- current local focused evidence: dependency-only descendant rejection, failed-stage cleanup, and serialized concurrent invocation `3/3 PASS`.
- external push, remote rename, recovery clone, WSL runtime, Docker, DB, Telegram, and Provider remain `NOT_EXECUTED`.
- final independent review after Main takeover: `SPEC PASS / QUALITY APPROVED`, Critical/Important/Minor residual finding `0`.
- final local verification: focused stale-lock/dependency/stage-cleanup/concurrency `4/4 PASS`; full WSL harness `24 PASS` in `49.430s`; all WSL shell syntax and `git diff --check` PASS.
- stale `.publish.lock` now fails within configured `1..600s` instead of waiting forever; ordinary cleanup errors cannot strand an owned lock, and `active.next.*` residues are removed under the lock.
- next internal action: commit the reviewed harness, then append a non-retroactive successor projection binding the new control commit before any private push or WSL execution.

## 2026-09-04 C-21 seq488 control-runtime successor projection

- 담당: `developer-primary-wsl`; 시작 branch/HEAD: `codex/c21-operational-execution` / `ead1214e3f01e68e577c3163e1cf143ee5753490`; 시작 worktree clean.
- 상태: `IN_PROGRESS_TDD_GREEN`; 승인된 brief의 record-only exact8 범위만 수정하며 seq1~487와 historical manifest/digest는 byte-immutable로 보존한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k control_runtime_successor` → exit 1, `2 failed, 100 deselected`; `C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json` 부재와 `FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42` 미지원이 의도한 결함이다.
- 오류 횟수: formal fingerprint `C21_WSL_CONTROL_RUNTIME_SUCCESSOR_UNBOUND_R1` 1회; 동일 오류 반복 0회.
- 미검증/미실행: GREEN/full tooling/checker/diff는 아직 실행 전이다. commit, push, SSH, WSL, Docker, DB, volume, Telegram, Provider는 `NOT_EXECUTED`; C-01은 계속 차단한다.
- brief 전사 오류 정정 ledger: brief의 record exact8 hash `...F00`은 63자리로 SHA-256이 될 수 없다. 지정 8경로를 UTF-8 canonical sorted JSON(`separators=(",", ":")`)으로 계산한 실제 값은 `E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B`다. Main은 마지막 `B` 누락을 명백한 전사 오류로 확정하고 64자리 실제값 사용을 ruling했다. 범위·요구사항·중요 위험 변경은 없다.

### seq488 completion checkpoint

- 상태: `COMPLETED_FOR_REVIEW`; record commit SHA는 self-reference 규칙에 따라 기록하지 않았고 commit/push를 실행하지 않았다.
- TDD GREEN: 동일 focused 명령 → exit 0, `2 passed, 100 deselected`; 역사 seq487와 seq488 postcommit 음성 계약을 함께 확인한 focused 명령은 `4 passed, 98 deselected`다.
- full tooling progress: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `102 passed in 73.62s`.
- precommit checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` → exit 0, `G-05 project progress contract: PASS sequence=488 reporting=AUTO_CONTINUE`; HEAD=`ead1214...`와 dirty exact8만 허용됨을 확인했다.
- 보완 오류 1: `HISTORICAL_SEQ487_CURRENT_HEAD_PATH_MIX` 1회. seq487 역사 projection test가 현재 seq488 HEAD/path를 혼입해 실패했으며 historical commit의 seq487 bundle과 synthetic clean exact8 descendant로 분리해 해소했다. 동일 fingerprint 반복 0회다.
- 보완 오류 2: `SEQ488_SELF_REFERENCED_TOOL_HASH_STALE` 1회. 변경된 checker/test의 `latest_evidence_refs`가 seq487 hash를 유지해 `PRG_REFERENCED_HASH_MISMATCH` 3건을 냈으며 현재 portable hashes와 snapshot/digest/manifest를 재결속해 해소했다. 동일 fingerprint 반복 0회다.
- immutable 확인: seq1~487 raw `786441` bytes / `A230B994745047786883CEF8F94279EAE239DB359F3A923717961F8552008C17`, canonical `E2752DBA9CEE5989D7AF890C83A0AD82886A610965CAAEC060EE4079A076295C`; historical event/manifest/digest mutation은 0이다.
- 변경 record exact8: `docs/WORK_STATUS.md`, `docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`.
- 미실행: commit, push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 다음 안전 조치: Main이 exact8 diff와 보고서를 검토한 뒤 별도 권한 경계에서 record commit/push 여부를 판단한다.

#### seq488 오류 ledger 보충

- 최초 full tooling은 `97 passed, 5 failed`였다. `SEQ488_PROGRESS_EVENT_REF_STALE` 1회가 `PRG_REFERENCED_HASH_MISMATCH` 3건을, `HISTORICAL_SEQ487_CURRENT_HEAD_PATH_MIX` 1회가 역사 projection 2건을 발생시켰다.
- 역사 fixture 분리 후 focused 재검증의 `HISTORICAL_SEQ487_NEGATIVE_FIXTURE_CLASSIFICATION` 1회는 extra control path만 바꿔 상위 origin 오류로 분류된 기대값 불일치였다. cumulative path에도 같은 extra path를 주어 exact path-set 음성 계약을 직접 검증하도록 해소했다.
- 이후 full tooling의 `99 passed, 3 failed`는 `SEQ488_SELF_REFERENCED_TOOL_HASH_STALE` 1회가 변경된 checker/test의 과거 reference hash를 유지한 결과였다. current portable hashes 및 snapshot/digest/manifest를 재결속해 최종 `102 passed`로 해소했다.
- 위 세 보완 fingerprint와 formal `C21_WSL_CONTROL_RUNTIME_SUCCESSOR_UNBOUND_R1`은 각각 1회이며 동일 fingerprint 연속 반복은 0회다.

## 2026-09-04 C-21 seq488 reviewer fix round 1

- 판정: `COMPLETED_FOR_REVIEW_FIX_ROUND_1`; seq488 event sequence와 record exact8 범위는 유지하고 제품·historical predecessor·authority 문서는 수정하지 않았다.
- Main coordination error: 최초 seq488 완료 뒤 독립 reviewer dispatch를 누락한 `MAIN_REVIEW_DISPATCH_OMISSION_SEQ488_R1` 1회. 제품 failure가 아니며 review finding을 받은 즉시 fix round 1로 재개했다. 동일 coordination error 반복은 0회다.
- reviewer finding 1 RED: 실제 임시 Git clone에서 valid direct exact44 record는 PASS했지만, ead1214 direct record가 base content를 복원해 base→HEAD exact43이 된 경우 기존 checker가 `[]`로 허용했다. 동일 fixture는 second exact8 descendant와 ead1214 외 추가 parent를 가진 merge record도 구성한다. fingerprint `SEQ488_POSTCOMMIT_LINEAGE_UNDERCONSTRAINED_R1` 1회.
- reviewer finding 2 RED: manifest의 `push/deployment/database/volume_cleanup/telegram/provider` 중 하나를 `EXECUTED`로 바꾼 mutation이 기존 validator에서 `[]`로 통과했다. C-01 `READY` mutation도 같은 누락에 포함한다. fingerprint `SEQ488_MANIFEST_EXTERNAL_BOUNDARY_UNGUARDED_R1` 1회.
- GREEN: postcommit은 ead1214를 유일한 parent로 갖는 단일 record commit, ead1214→HEAD exact8, base→HEAD derived exact44, clean/canonical old-remote 상태를 모두 만족할 때만 허용한다. exact43 reversion, second descendant, extra parent는 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`로 거부한다.
- manifest GREEN: `push`, `deployment`, `database`, `volume_cleanup`, `telegram`, `provider`는 모두 정확히 `NOT_EXECUTED`, `c01_status`는 정확히 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`여야 한다.
- focused GREEN: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k "control_runtime_successor or control_runtime_postcommit_real_git"` → exit 0, `3 passed, 100 deselected in 28.87s`.
- test/setup 오류: `SEQ488_R1_TOOL_WRAPPER_DECLARATION_TYPO`, `SEQ488_R1_SKILL_REFERENCE_PATH_MISS`, `SEQ488_R1_TEST_FIXTURE_SYNTAX`, `SEQ488_R1_FIXTURE_BASE_PATH_MISSING` 각 1회, 제품 failure 아님, 동일 fingerprint 반복 0회. 각각 wrapper 선언, skill 상대경로, 괄호, base에 존재하지 않는 fixture path를 교정해 해소했다.
- 미실행: commit, push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01 차단 유지.
- 다음 안전 조치: current checker/test hash와 snapshot/digest/manifest를 재결속하고 full tooling/checker/diff/exact8을 재검증한 뒤 Main re-review로 반환한다.

### seq488 reviewer fix round 1 completion checkpoint

- current checker/test portable hash, progress snapshot, detached digest, manifest raw checksum을 순환 없이 재결속했다.
- focused: `3 passed, 100 deselected in 30.19s`; full progress tooling: `103 passed in 120.82s`; precommit checker: `PASS sequence=488 reporting=AUTO_CONTINUE`.
- 변경 범위는 seq488 record exact8뿐이고 scratch report는 `.superpowers` ignore 경로에 별도 유지한다. seq1~487 raw/canonical prefix와 predecessor artifact는 불변이다.
- 상태: `COMPLETED_FOR_REVIEW`; Main re-review 전 commit/push/external action은 계속 금지한다.

## 2026-09-05 C-21 seq489 fresh-clone candidate rebind projection

- 판정: correction review `SPEC PASS / QUALITY APPROVED`; candidate `326476d69a3228f9dfcf64ff1dd056577bcbcf55`는 seq488 control `74ed0d4ac566ccc2877301103663b68272cce5b2`의 single-parent child이며 correction exact2/hash `B2E9A41E7E30999A64BBFA85332791EA44F23D2783A064D3CBEEFFFA4DE8BC1F`다.
- TDD RED: 기준선 checker는 candidate로 이동한 HEAD와 exact44 누적 경로를 seq488 projection으로 해석해 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`를 냈다. 신규 focused unittest는 seq489 manifest 부재와 기존 candidate `93c58f7...` 결박 때문에 2건 실패했다.
- 구현: human approval 네 필드를 보존한 `MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION` 파생 binding, exact44 private candidate ref, seq489 append-only event와 record-only exact11, precommit/direct-child postcommit checker를 추가했다. seq1~488 raw/canonical prefix와 seq488 manifest/digest는 변경하지 않는다.
- 검증: seq488+seq489 focused tooling `7/7 PASS`, guard 음성 계약 `9/9 PASS`, full progress tooling `107 PASS`, full WSL harness `33 PASS`, 전체 `deploy/wsl/*.sh` Bash syntax와 `git diff --check` PASS, precommit checker `PASS sequence=489`다. direct-child/second-child/merge/reversion 실제 Git fixture도 GREEN이며 clean postcommit checker는 record commit 직후 재검증한다.
- reviewer fix I-1: runtime guard가 derived binding SHA-256 `7C0078AD0EACA441088017A6A4C0FF25B85464F198AFC48A177B09C85304D863`와 candidate parent `74ed0d4ac566ccc2877301103663b68272cce5b2`를 exact 비교한다. parent/hash/candidate/ref/manifest checksum을 함께 재결박한 회귀를 거부하며 focused guard `10/10 PASS`, full WSL harness `35 PASS`다. Minor M-1 timestamp는 deferred로 유지한다.
- 미실행: external push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 다음 안전 조치: seq489 exact11 direct-child commit을 검토한 뒤 별도 외부 push 승인을 받아 exact refs push/ls-remote/fresh recovery를 수행하고, 그 뒤 WSL 검증으로 진행한다.

## 2026-09-05 C-21 seq490 Compose runner candidate rebind projection

- 판정: correction review `SPEC PASS / QUALITY APPROVED`; candidate `830ad98546ed82a59524dd5a6cef0a5b7a6a96b0`는 seq489 control `99e83e4b07df1cffced6a89ff16ff2266ddaa426`의 single-parent child이며 correction exact2/hash `BCF8BC3E409715FF2E470D3BEB977E8E410B388BAC253114310D264FD783AA0F`다.
- baseline RED: 기존 checker에서 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH` 3건을 확인했다. 신규 focused unittest는 `seq490 rebind manifest is missing`으로 기대 실패했다.
- 구현: human approval 네 필드와 exact volume/label/exclusions를 보존한 `MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION` 파생 binding, exact46 candidate ref, seq490 append-only event와 record-only exact11, precommit/direct-child postcommit checker를 추가한다. seq1~489 raw/canonical prefix 및 모든 historical manifest/digest/commit은 변경하지 않는다.
- 외부 경계: push, SSH, WSL, Docker, DB, volume cleanup, Telegram, Provider는 모두 `NOT_EXECUTED`; C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- 검증 상태: focused/full tooling, full WSL harness, Bash syntax, diff-check, precommit checker 및 commit 후 postcommit 검증을 이 record에서 수행한다.

### seq490 reviewer fix round I-1

- 독립 리뷰는 active progress/HANDOFF가 승인된 개발·테스트 범위의 private push를 별도 프로젝트 승인 대기로 잘못 기록한 `Important I-1`을 확정했다.
- TDD RED: tooling은 repository `push_status`가 `...BLOCKED_PENDING_EXACT_DESTINATION_APPROVAL`인 것을 검출했고, guard test는 잘못된 private-push policy가 direct-child 검사까지 통과해 policy 전용 거부 사유가 없음을 검출했다.
- 수정 원칙: seq1~489와 seq490 event 원문은 byte-immutable로 유지한다. active progress/HANDOFF/CandidateReleaseManifest/evidence/checker/guard/tests만 `REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH` 및 `MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE` 계약으로 재결박한다.
- 외부 push/WSL/Docker/DB/volume cleanup/Telegram/Provider는 이 fix round에서 실행하지 않는다. push 결과는 실행 후 새 append-only checkpoint로 기록한다.

## 2026-09-05 C-21 seq491 cold-start 및 PG18 volume 경로 보완

- 담당: `developer-primary-wsl` 인수 writer `pg18_binding_resume`. 기존 seq491 dirty exact11은 보존 후 이어서 작업했다. 기존 candidate `ea6f47b33b68d156923528345f6990fd3859b7eb`는 로컬 ref `codex/preserve-c21-ea6f47b-pg18-resume`에 보존했고 dirty binary patch 및 신규 manifest/digest는 `D:\tmp\anvil-seq491-preserve-20260905-pg18-resume`에 checksum과 함께 보존했다.
- 실제 결함 근거: Main이 확인한 공식 PG18 image는 `PGDATA=/var/lib/postgresql/18/docker`, declared volume `/var/lib/postgresql`이다. 기존 named mount `/var/lib/postgresql/data`는 PG18 데이터 경로를 포함하지 않았다. PG18 DB는 아직 생성되지 않았다.
- 최소 보완: `configure_wsl_target`이 PG15에는 `/var/lib/postgresql/data`, PG18 RC에는 `/var/lib/postgresql`을 매번 대입·export하고 Compose named volume target은 필수 변수로 받는다. volume 이름·labels·cleanup·server `.env`·PGDATA 설정은 변경하지 않는다.
- 제품 candidate: `324eb169fedbce958d2e8cc29362deb7af433677`, single parent `18fa604531acfd303c10effa528797fbd5b55c8b`, correction exact5/hash `63D5B1B57251E3A6680BBE62280A434E28AD9DFCE764A8D0C1BD2B161A1DE14D`. 기존 cold-start bootstrap/deploy/tmpfs 보완을 포함한다. seq491 record의 테스트 수정은 candidate에 섞지 않았다.
- 결박: base→candidate exact48, record exact11, 누적 exact50 유지. derived binding은 1063 bytes/hash `C9EC11DE9FCA150F07418449C1A7C554B17909BE8F2647B85C7A763C86D3FA0A`. seq1~490 raw prefix 814540 bytes/hash `E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19` 및 historical manifest/digest는 불변이다.
- 검증 근거: shell 15→18-rc→15 전환 및 자식 프로세스 export 확인, Bash syntax, diff check PASS. Main의 WSL Compose config JSON 두 target 검사도 각 exit0: 정확한 named volume·target·labels·단일 tmpfs 확인. 이는 configuration 검증이며 DB runtime PASS가 아니다. 변경 binding focused 및 필요한 WSL harness 결과는 freeze 직전 추가한다.
- 오류: 인수 전 테스트 session5384는 사라져 결과 미확인으로 유지한다. PG18 재결박에서 prior candidate→candidate 경로 수가 common.sh 추가로 14→15가 된 점을 처음 누락하여 checker1회 실패했고 실제 Git diff/hash 재계산으로 해소했다. 동일 제품 원인 실패 3회 조건은 발생하지 않았다.
- 문서 상태: `docs/DEVELOPMENT_ENVIRONMENT.md`의 seq486/93c58 candidate와 승인 대기 문구는 오래된 상태다. 현재 실행 근거는 최신 checkpoint와 CandidateReleaseManifest이며 환경 문서 정정은 후속 정상 문서 checkpoint에서 수행한다.
- 미검증·다음 조치: 새 candidate의 WSL PG15/PG18 runtime·migration/API/SSE/backup/restore/rollback/cleanup은 아직 미실행이다. 독립 review 뒤 Main이 승인된 private refs push·복구 검증과 WSL gate를 계속한다. Telegram·Provider 실호출은 제외하며 C-01은 C-21 독립 판정 전 차단한다.
- 최종 관련 검증: seq491 focused 5개와 seq490 immutable content1개 `6 PASS,111 deselected`. WSL harness 첫 실행은 `46 PASS,2 환경 FAIL,1 SKIP`; Windows subprocess의 native PATH와 POSIX separator 혼합이 두 fixture에서 중첩 Bash 실패를 만들었다. Main이 반복 실행 경계를 직접 인수하여 테스트 세 PATH 지점을 `str(bin_dir)+os.pathsep+os.environ['PATH']`로 수정했고 두 실패 node 재검증 `2 PASS,47 deselected`(17.01s, exit0)를 확인했다. 총 48개 node 통과, PyYAML parser1개 skip은 실제 WSL Compose config 두 target PASS로 별도 충족했다. 전체 suite를 반복 실행하지 않았다. Main의 WSL 임시 QA 경로도 rmdir exit0로 정리했다.
# C-21 seq499 개발 QA 재개 start projection 진행

- 담당: `seq499_qa_resume`; 상태: `IN_PROGRESS_TDD_RED_PREPARATION`; 기준 HEAD `4178ae78db2c48e176e8543364d09787e54bb4ad`.
- Main 검토 입력: scratch proposal SHA-256 `9A4DAFF9E2D6A86553AB88977D7AEBD56967FA862C12C8C3A18DA7D0985B3837`. 이는 `SCRATCH_ONLY_MAIN_REVIEW_INPUT_NOT_AUTHORITY`이며 승인 기준이나 실행 권위가 아니다. tracked `C-21_DEVELOPMENT_QA_RESUME_WORK_INSTRUCTION.md`가 exact7 실행의 canonical authority다.
- 현재 변경: start exact10 중 WorkInstruction, invocation prompt, WORK_STATUS. seq499~501 Event·lease와 manifest/digest/checker/test는 아직 materialize하지 않았다.
- Provider runtime 9-status/model/capability/drift port는 `NOT_IMPLEMENTED_RUNTIME_PROVIDER_STATUS_PORT`; browser는 page.evaluate/fetch scope only; Telegram은 outbound-free scope only다.
- 외부 실행, commit, push, WSL/DB/browser/Provider/Telegram/ysna/main은 `NOT_EXECUTED`; 기존 seq1~498은 불변이다.
- 오류: 없음. 다음 조치: RED mutation 계약 추가 후 seq499→501 start projection을 생성하고 full fresh 검증한다.

### seq501 start projection 인수 및 full tooling 보완

- 인수 기준: `4178ae78db2c48e176e8543364d09787e54bb4ad`; 기존 dirty exact10과 seq1~498 bytes를 보존했다.
- `SEQ501_DTMP_SANDBOX_WRITE_DENIED` 1회: materializer 최초 실행이 `docs/progress/build-progress.json` 쓰기에서 `PermissionError`로 중단됐다. 제품 실패가 아니며 승인된 `D:\tmp` 격리 worktree 쓰기 권한으로 같은 generator를 재실행해 해소했다.
- `SEQ501_HISTORICAL_SEQ498_CURRENT_BUNDLE_MIX` 1회: full tooling 최초 실행은 `151 passed, 4 failed in 582.51s`였다. seq498 독립 판정 계약 네 개가 현재 seq501 bundle을 읽어 과거 판정과 재개 projection을 혼합한 fixture 오류였다.
- TDD 보완: 네 실패를 RED로 확인한 뒤 `4178ae7` detached historical bundle과 checksum이 결박된 untracked tester authority source를 함께 구성하는 fixture로 분리했다. 관련 focused 재검증은 `4 passed, 151 deselected in 27.95s`다.
- 위 두 fingerprint는 각각 1회이며 동일 유효 제품 실패 3회 조건은 발생하지 않았다. commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 하지 않았다.

#### seq501 start projection 완료 검증

- checker/focused 재결박: `G-05 project progress contract: PASS sequence=501 reporting=AUTO_CONTINUE`; seq501 및 보완 대상 focused `7 passed, 148 deselected in 27.56s`.
- full tooling 재실행: `155 passed in 590.28s`, exit 0. 최초 4개 historical fixture 실패는 모두 해소됐다.
- generator 두 번째 cycle은 exact10 전체 `IDEMPOTENCE_CHANGED=0`; `git diff --check` PASS, dirty path는 start projection exact10과 일치한다.
- 상태: `COMPLETED_FOR_MAIN_REVIEW`; commit, push, WSL/DB/browser/Provider/Telegram 실행은 금지대로 수행하지 않았다. 다음 안전 조치는 Main의 diff·계보 검토 후 developer-primary에게 exact7 QA를 전달하는 것이다.

### seq501 독립 review I-1/I-2 rework

- 판정 입력: independent review `SPEC FAIL / QUALITY REWORK_REQUIRED / C0 / I2`를 수락했다.
- `SEQ501_SCRATCH_PROPOSAL_AUTHORITY_FAIL_OPEN_I1` 1회: 비권위 scratch proposal hash가 manifest에 dangling field로 남고 WORK_STATUS가 이를 승인 기준으로 오표기했다. proposal hash binding을 제거하고 scratch를 Main 검토 입력으로, tracked WI를 canonical execution authority로 분리한다.
- history scope를 분리한다. seq498 Git blob 전체는 `882505` bytes / `B9C412B586999C2DCD530B7E6EDD283CE3A124BF4E98B08F8673A3184D641F78`; 현재 append-only 파일의 seq1~498 event-object prefix는 `882302` bytes / `3659A9808E97F6927E983CFCCD617BF5B1740D60CCDFE16D39D8107C8780C955`; canonical events는 `5BF5777954E769602CD70D9B27AE74836ABD5FF3FEE63A85DD1FDABF2D761BE0`다.
- `SEQ501_GIT_FAST_PATH_UNDERCONSTRAINED_I2` 1회: seq501 public validator가 remote/committed exact64/working-tree mode 일부 mutation을 허용했다. 신규 mutation test RED `2 failed, 155 deselected`; checksum stale을 제거한 재실행에서도 I1 proposal 잔존과 I2 fail-open을 정확히 검출했다.
- 동일 fingerprint 반복은 각각 1회다. commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 계속 금지한다.

#### seq501 I-1/I-2 rework 완료 검증

- GREEN: scratch proposal hash binding을 제거하고 비권위 검토 입력으로 고정했다. manifest는 tracked WI path/hash를 실행 권위로 결박하고 seq498 full Git blob, append-only event-object prefix, canonical event hash를 서로 다른 필드로 검증한다.
- GREEN: seq501 public/real-Git 경로는 branch/upstream/remote/feature remote/base/local HEAD/head relation/worktree status, committed exact64, dirty exact10, working-tree mode, clean 상태, record-direct 플래그를 fail-closed한다.
- 필드명 전환 보완 1회: 기존 mutation test가 제거된 `historical_raw_event_bytes`를 계속 변조해 `1 failed, 4 passed`가 발생했다. 신규 full-file/prefix/canonical 필드 mutation으로 교정했으며 제품 실패가 아니다.
- focused: `5 passed, 152 deselected in 9.80s`; checker `PASS sequence=501`; full tooling fresh `157 passed in 590.78s`; `git diff --check` PASS.
- 상태: `COMPLETED_FOR_INDEPENDENT_REREVIEW`; commit, push, WSL, DB, browser, Provider, Telegram 외부 실행은 하지 않았다.

### seq501 post-commit projection Main 직접 인수

- 시작 기록 exact10을 `34eb1725b47c544b6ec314a28428b364a029f3eb`로 커밋한 직후 checker가 `GIT_DESCENDANT_ORIGIN_MISMATCH`, `GIT_DESCENDANT_PATH_SET_MISMATCH`, `GIT_DESCENDANT_RECORD_COMMIT_INVALID`를 반환했다. Git 객체와 `git fsck --no-dangling`은 정상이며 원인은 seq501 validator가 pre-commit dirty 상태만 허용하고 동일 exact10의 post-commit clean descendant를 허용하지 않은 계약 누락이다.
- 이 mismatch 계열은 이전 projection에서도 반복된 유형이므로 AGENTS.md의 동일 오류 3회 Main 인수 원칙을 적용해 `developer-primary` 재시도를 중단하고 Main이 직접 인수했다.
- 조치: validated base ancestry, projected parent ancestry, cumulative exact68, descendant exact10, clean worktree, branch/upstream/remote 고정을 모두 만족하는 post-commit 경로만 허용했다. content/hash 검증은 그대로 유지하며 허용 경로 밖 변경은 계속 fail-closed한다.
- focused 계약 검증: `1 passed, 156 deselected`; 실제 checker PASS는 raw checksum·snapshot·digest 재결박 및 보완 commit 후 확인한다. 제품 QA exact7, WSL/DB/browser/Provider/Telegram, push, ysna, main은 아직 시작하지 않았다.
# C-21 Provider 상태 조회 독립 검토 successor — sequence 513

- 담당: Main Agent 직접 인수(무결성 projection), 제품 구현 `developer-primary`, 독립 검토 `provider_status_review`.
- 제품 commit `13b2b4e7dbd0aaec8d8fc8bcf22ed969e9e82fe0`은 Provider 9종의 상태·credential 존재 여부·model 조회 READ 계약을 exact13으로 구현했다.
- Main broad 검증은 `192 passed`; 독립 검토는 `SPEC_PASS / QUALITY_APPROVED / Critical 0 / Important 0 / Minor 0`이다.
- 기존 일반 Git projection에서 같은 `GIT_DESCENDANT_ORIGIN_MISMATCH`·`GIT_DESCENDANT_PATH_SET_MISMATCH`가 3회 반복되어 Main Agent가 인수했다. 신산님이 seq513 전용 predicate의 선행 적용을 승인했으며 exact commit·경로·ancestor·direct-child·clean/dirty 검증은 유지한다.
- 기존 sequence 1~509와 historical evidence는 변경하지 않고 sequence 510~513을 append했다. 제품 exact13과 record exact8 외 경로 변경은 허용하지 않는다.
- 실제 Provider 호출, Telegram outbound, WSL PG15/PG18RC, ysna 배포, main 병합은 모두 `NOT_EXECUTED`; C-21은 아직 수락되지 않았고 C-01은 차단 상태다.
- 다음 안전 조치: 개발/WSL 전용 test session에 `provider:read`를 exact endpoint allowlist로 추가하는 successor를 발행하고 로컬 검증 후 Git-only PG15/PG18RC candidate를 결박한다.
# C-21 Provider WSL Auth successor 시작 — sequence 516

- 담당: `developer-primary`; 상태: `LOCAL_IMPLEMENTED_PENDING_GIT_ONLY_CANDIDATE`; Main은 progress·lease·검토를 관리한다.
- 독립 review 1차는 `REWORK / C1 / I2`: 기존 `.env` 재작성 temp의 secret 노출·잔류, 비대상 bytes 정규화, Provider trailing-slash 307→200 허용을 검출했다. fingerprint `C21_PROVIDER_WSL_AUTH_REVIEW_R1` 1회다.
- REWORK 1차에서 secure temp·cleanup·binary byte transform을 적용해 temp 보안과 LF/CRLF/final-newline 보존을 해소했다.
- 독립 review 2차는 `REWORK / C0 / I2`: 전역 redirect 차단의 Provider 외 API 범위 초과 회귀와 0400 fixture의 잘못된 temp mode 기대값을 검출했다. fingerprint `C21_PROVIDER_WSL_AUTH_REVIEW_R2` 1회다.
- REWORK 2차는 Provider exact3 slash variants만 좁게 거부하고 다른 API redirect 계약을 보존하며 0400 test oracle을 교정했다. 동일 package 유효 실패 누계 2회로 Main 직접 인수 threshold 3회에는 도달하지 않았다.
- 제품 commit `0f70afeabe9a031e7960d49cfe27c808c0770d16`은 parent `b85d2b48e14f513e326054bc0be28009f269a827` direct child exact7이다. 독립 최종 review는 `SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`다.
- Main 검증은 API `117 passed`, WSL focused `10 passed, 2 skipped`, bash syntax/diff-check PASS다. candidate WSL의 실제 0600/0400·signal/move-failure residue·PG15/PG18RC는 미검증이다.
- sequence 517~524는 두 review/rework, write/worker lease 회수, package 완료, 최종 review를 append-only로 기록했다. 다음은 `PREPARE_C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE`다.
- dispatch HEAD: `b85d2b48e14f513e326054bc0be28009f269a827`; 제품 write lease는 exact7/path hash `43388FD076A9F799DC8AE3FC7EDABA6E682CFD1618BBE3721EC347F6E62FB11A`다.
- 목표: 개발·WSL test session에 `provider:read`를 추가하되 Provider GET exact3만 허용하고 mutation·유사 경로·비정상 scope는 fail-closed한다.
- sequence 514~516으로 worker lease → write lease → package start를 기록했다. 실제 Provider·Telegram·WSL·ysna·main·DB migration은 `NOT_EXECUTED`다.
- 직전 시스템 안전 검토 서비스의 usage limit은 제품 실패가 아니며 동일 실패 횟수에 포함하지 않는다. 부분 반영된 start projection은 Main이 즉시 완결하고 제품 exact7은 Subagent가 TDD로 수행한다.

### seq524 historical seq513 mutation fixture 보완

- 오류 fingerprint `SEQ524_HISTORICAL_SEQ513_CURRENT_BUNDLE_MIX` 1회: `test_c21_provider_status_read_review_successor_fails_closed_on_binding_mutation`이 seq513 manifest와 현재 seq524 bundle을 혼합해 `C21_PROVIDER_STATUS_READ_COMPLETION_EVENT_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_DIGEST_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_EVENT_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_EVENT_ORDER_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_HANDOFF_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_HISTORY_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_PROJECTION_INVALID`, `C21_PROVIDER_STATUS_READ_REVIEW_RAW_INVALID` 8개 오류로 실패했다. 이는 historical fixture 오류이며 제품 실패가 아니다.
- 최소 수정: 기존 `_historical_bundle` 패턴으로 seq513 commit `b85d2b48e14f513e326054bc0be28009f269a827`의 격리 bundle과 동일 시점 manifest를 로드하도록 test만 교정했다. seq1~513 event/evidence와 checker 계약은 변경하지 않았다.
- RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k "test_c21_provider_status_read_review_successor_fails_closed_on_binding_mutation"` -> exit 1, `1 failed, 168 deselected in 0.66s`.
- GREEN: 동일 명령 -> exit 0, `1 passed, 168 deselected in 5.68s`; seq524 focused `-k "provider_wsl_auth_reviewed"` -> exit 0, `3 passed, 166 deselected in 1.78s`.
- live checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` -> exit 1, `PRG_REFERENCED_HASH_MISMATCH`. 원인은 `build-progress.json`의 `tests/tooling/test_project_progress.py` 결박 hash `6F9508873404B3D318E5611C9DA904BACB4DCB93ED7E594804CBCFA680BDE8F3`가 수정 후 portable hash `3CACC50CA9DB23EB8F2E2D0C779756988A3416717DDFB8781703951818BD8EFB`와 불일치하기 때문이다.
- 다음 안전 조치: Main이 current test hash를 progress projection에 재결박하고 연쇄 snapshot/digest를 재계산한 뒤 live checker를 재실행한다. commit, push, WSL, Provider, Telegram, DB, ysna, main은 실행하지 않았다.
- Main 재결박 후 live checker는 `PASS sequence=524 reporting=AUTO_CONTINUE`, 전체 `tests/tooling/test_project_progress.py`는 `169 passed in 717.78s`로 통과했다. `SEQ524_HISTORICAL_SEQ513_CURRENT_BUNDLE_MIX`는 1회 발생 후 해소됐으며 추가 반복은 없다.

### seq524 독립 검토 재작업 1회

- fingerprint `C21_PROVIDER_WSL_AUTH_SEQ524_BINDING_GAPS_R1` 유효 실패 1회: 독립 reviewer가 Important 2건으로 terminal seq514~524 event details와 manifest/digest 선언 metadata의 fail-open을 재현해 commit을 보류했다.
- RED: `-k c21_provider_wsl_auth_reviewed` -> `2 failed, 169 deselected`; GREEN: 동일 focused suite -> `5 passed, 166 deselected`.
- 조치: terminal event canonical SHA-256을 `70237B7C9F71D44330B8F77877DEB17A1D8362EFF362E88EE1D3522969FB1135`로 exact 결박하고, manifest `schema_version/created_at`, digest `schema_version/digest_id/algorithm/created_at/scope`를 exact 검증한다.
- 현재 미충족: 변경된 checker/test hash와 progress snapshot/detached digest 재결박, 전체 tooling 재검증, 독립 재검토. seq1~513 historical evidence와 제품 exact7은 변경하지 않았다.
- 해소 검증: Main 재결박 후 focused `5 passed, 166 deselected`, live checker `PASS sequence=524`, 전체 tooling `171 passed in 711.92s`를 확인했다. checker/test hash와 progress snapshot/detached digest 재결박 및 전체 tooling 미충족은 해소됐다.
- 독립 재검토 최종 판정은 `SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`이며 exact10 record commit을 허용한다. seq514~524의 이전 11개 event details 변조는 `C21_PROVIDER_WSL_AUTH_REVIEW_EVENT_INVALID`, manifest/digest metadata 변조는 각 지정 오류로 모두 fail-closed 거부됨을 확인했다.

### C-21 Provider WSL Git-only candidate start — 플랫폼 승인 대기

- 기준선은 clean `e4cccf3ce99e29005103cea3bd76fa0eede36f28`; seq1~524 historical event/evidence는 변경하지 않았다.
- 계획 초안의 path hash 불일치는 canonical helper로 정정했다: S exact10 `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, 누적 exact107 `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, K exact12 `6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`, 누적 exact109 `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`.
- 시스템 안전 fingerprint `PLATFORM_SEQ527_GOVERNANCE_GATE_APPROVAL_REQUIRED` 2회: 두 writer의 seq527 전용 predicate patch가 지속적 무결성 gate 확장으로 분류돼 차단됐다. 제품 실패 횟수에는 포함하지 않으며 우회하지 않았다.
- 현재 변경은 Work Order 2개, checker path helper, RED 계약 테스트와 이 상태 기록뿐이다. RED `-k git_only_candidate_start`는 `2 failed, 1 passed`; projection predicate/validator가 아직 없어 의도대로 실패한다.
- 재개 조건: 신산님이 seq527 전용 predicate/validator의 구현을 직접 승인하면 subagent가 기존 RED에서 재개한다. 실제 WSL·Docker·DB·Provider·Telegram·push·ysna·main은 아직 실행하지 않는다.

### seq527 start projection 구현·검증 진행

- 판정: `IN_PROGRESS_FINAL_VERIFICATION`. 최신 직접 지시 `계속하자`와 교체된 AGENTS 5.1에 따라 승인된 계획 내부 start projection을 재개했다. 담당은 `developer-primary`, branch `codex/c21-operational-execution`, HEAD `e4cccf3ce99e29005103cea3bd76fa0eede36f28`, upstream `origin/codex/c21-operational-execution`, remote head `ca92b7845eda803cff3c432799642e4f9243d4d6`다.
- 변경 exact set: S exact10 전부만 dirty다. 기존 수정 6개(`docs/WORK_STATUS.md`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`)와 신규 4개(start manifest, detached digest, WorkInstruction, invocation prompt)다. seq1~524 raw event object와 historical evidence는 byte-immutable이다.
- projection: seq527 specialized Git predicate를 일반 projection보다 먼저 적용하고 seq524 full validator를 유지했다. precommit은 HEAD `e4cccf3...` + committed exact103 + dirty start exact10만, postcommit은 그 direct single-parent child + exact107 clean만 허용한다. branch/upstream/remote, base ancestry, exact paths, clean/dirty, candidate ref와 predecessor control을 fail-closed한다.
- lease/event: seq525 `WORKER_LEASE_ISSUED`, seq526 `WRITE_LEASE_ISSUED`, seq527 `PACKAGE_STARTED`를 append했다. active developer write scope는 K exact12/hash `6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`; 이후 누적 exact109 hash는 `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`다.
- canonical path helper 재감사: source exact103=`A46103D23EC42AD4F0431A979601964FA846913555C568DE4947605411787880`, S exact10=`87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, 누적 exact107=`E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, K exact12=`6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`, 누적 exact109=`16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`. 기존 계획 감사의 `E095...`, `14D594...`, `A356...`, `8904...` 값은 범위 의미 변경이 아니라 canonical helper를 쓰지 않은 비의미 계산 오류였으며 위 값으로 정정했다.
- TDD RED: `-k git_only_candidate_start` 최초 `2 failed, 1 passed, 171 deselected in 0.73s`, exit1. fingerprint `C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_UNBOUND_R1` 1회로, 전용 validator 부재와 일반 projection이 seq527 exact103/start10을 구분하지 못한 의도한 원인이다.
- 구현 중 focused: start manifest/digest/progress/handoff materialize 뒤 첫 실행은 `1 failed, 2 passed, 171 deselected in 0.79s`, event canonical order·handoff 마지막 중복 키·latest refs·projection 결박을 보완했다. 다음 실행은 `1 failed, 2 passed, 171 deselected in 0.33s`, last_event_id 축약 오기 1건을 exact PACKAGE_STARTED id로 교정했다. 최종 focused는 `3 passed, 171 deselected in 3.41s`, exit0이다. 각 integration fingerprint는 1회이며 동일 근본 원인 3회가 아니다.
- 전체 tooling 1차: `3 failed, 171 passed in 897.36s`, exit1. `HISTORICAL_BACKUP_ACCEPTANCE_CURRENT_BUNDLE_DRIFT`, `HISTORICAL_OPS_R2_CURRENT_BUNDLE_DRIFT`, `GENERIC_ACTIVE_WI_HASH_KEY_DRIFT` 각 1회다. 앞 두 개는 seq527 current bundle을 과거 validator에 혼합한 fixture 오류라 immutable `e4cccf3...` historical bundle로 분리했고, 마지막은 generic referenced-hash validator가 새 `artifact_path`/`artifact_sha256` alias를 읽도록 최소 보완했다. 제품 실패로 계상하지 않는다.
- fixture 보완 검증: 1차 `1 failed, 2 passed, 171 deselected in 14.49s`에서 같은 historical test 내부 후속 release-rebind current bundle 잔존을 발견했고 같은 historical bundle로 고정했다. 2차 `3 passed, 171 deselected in 14.57s`, exit0이다. 이 잔존 fixture fingerprint도 1회이며 반복 제품 오류가 아니다.
- 도구/편집 절차 오류: D:\tmp sandbox deny, apply_patch batch newline 전달, unified hunk range 문맥 실패, PowerShell quoting 1회, event comma 누락 1회는 모두 제품 실패가 아니며 승인된 direct apply_patch CLI와 JSON parse로 즉시 해소했다. 같은 제품 근본 실패의 유효 반복 횟수는 0이다.
- 실제 Provider 호출, Telegram outbound, WSL, Docker, DB, ysna, main 병합, push는 모두 `NOT_EXECUTED`. commit도 지시대로 `NOT_EXECUTED`다. C-21 accepted=false, C-01 차단, DIR-2 미발생을 유지한다.
- 남은 조치: final checker/test hash와 snapshot/digest/manifest 결박 후 seq527 focused, 전체 tooling fresh, live checker, `git diff --check`, exact10 Git status를 검증한다. 다음 package action은 developer-primary가 lease exact12를 로컬 TDD로 구현하는 것이며 이 start task에서는 실행하지 않는다.

#### seq527 start projection 최종 검증 마감

- 판정: `COMPLETED`. final hash 재결박 뒤 seq527 focused `3 passed, 171 deselected in 3.23s`, exit0; 전체 `tests/tooling/test_project_progress.py` fresh 재실행 `174 passed in 920.81s`, exit0이다.
- live checker: `.venv\Scripts\python.exe scripts/check_project_progress.py` → exit0, `G-05 project progress contract: PASS sequence=527 reporting=AUTO_CONTINUE`.
- 정적·Git 검사: `.venv\Scripts\python.exe -m py_compile scripts/check_project_progress.py tests/tooling/test_project_progress.py` exit0; `git diff --check` exit0. dirty는 S exact10만이며 canonical path-list hash `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`와 일치한다.
- 역사 무결성: HEAD `e4cccf3...`의 progress-events 원본은 `918383` bytes / `6CA5E70011C18974C91116229A137CB9D5366F13114312064AD5EBA80D852AE0`; 현재 seq1~524 event-object prefix는 `918175` bytes / `7976E9A81F28A7293552C4D18556AD506A0450C46B620D28F1B74A112EED2EAA`이며 Git blob에서 추출한 같은 prefix와 byte-equal이다.
- 변경 영향: seq527 start projection과 이후 exact12 write lease만 활성화했다. Provider/Telegram/WSL/Docker/DB/ysna/main/push/commit은 모두 `NOT_EXECUTED`; 해당 실제 검증이나 배포 PASS를 주장하지 않는다.
- rollback: 아직 commit하지 않았으므로 Main이 S exact10 diff를 검토한 뒤 승인하지 않으면 이 exact10만 복구 대상으로 삼는다. 사용자 자료·다른 dirty 경로·historical evidence는 rollback 대상이 아니다.
- 다음 안전 조치: Main의 exact10 diff 검토 후 별도 후속 작업자가 active lease의 K exact12를 로컬 TDD로 구현한다. 이 seq527 start task 자체의 추가 제품 write, commit, push, WSL/외부 호출은 하지 않는다.

#### seq527 Reviewer Important 1 fail-closed 보완

- 인수 사유: 이전 developer의 중단은 usage limit이며 유효한 `FAILURE_REPORT`가 아니다. 동일 제품 근본 실패의 유효 반복 횟수는 계속 `0`이다.
- Reviewer Important 1 재현: seq527 clean postcommit projection에서 Git status 수집값 `None`이 `_working_tree_paths(None) -> []`로 바뀌어 clean direct-child/exact107 projection을 통과할 수 있었다.
- 조치: valid direct-child/exact107 응답과 status `None`을 분리 mock한 collector-boundary 회귀 계약을 유지하고, seq527에만 `GIT_STATUS_COLLECTION_FAILED`를 반환하도록 fail-closed했다. seq524 및 generic/historical projection은 변경하지 않았다.
- 상태: focused GREEN 뒤 관련 historical·전체 tooling·live checker·정적/Git 무결성 재검증을 진행한다. Provider/Telegram/WSL/Docker/DB/ysna/main/commit/push는 계속 `NOT_EXECUTED`다.
- 검증: collector-boundary focused `3 passed, 172 deselected` exit 0, 인접 historical focused exit 0, 전체 `tests/tooling/test_project_progress.py` fresh `175 passed in 884.84s` exit 0, live checker `PASS sequence=527`, `py_compile` exit 0, `git diff --check` exit 0을 확인했다.
- 최종 무결성: Git status 기준 dirty는 S exact10만이며 path-list SHA-256 `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`; 누적 exact107은 `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`; seq1~524 raw event-object prefix `918175` bytes는 HEAD historical blob과 byte-equal이다.
- 완료 범위: seq527 status collection fail-closed 보완과 기존 manifest/digest 결박 정합성만 수정했다. commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 실행하지 않았다.

#### seq527 exact10 CLEAN_REVIEW 마감

- 독립 Reviewer 재검토 판정은 `CLEAN_REVIEW / C0 / I0 / M0`이며 Reviewer Important 1 status-collector fail-closed 결함은 해소됐다.
- 독립 focused 검증은 `11 passed`로 종료했다. 코드 변경이 없는 review 마감이므로 직전 fresh 전체 tooling `175 passed in 884.84s` 결과를 유지하며 전체 suite는 재실행하지 않는다.
- 재확인 대상: live checker `PASS sequence=527`, `py_compile` 및 `git diff --check` exit 0, S exact10 hash `87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2`, cumulative exact107 hash `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`, seq1~524 raw prefix byte-equal을 최종 마감 조건으로 유지한다.
- 범위·상태: 새 event를 append하지 않으며 seq527, `ACTIVE_GIT_ONLY_CANDIDATE_PREPARATION`, S exact10과 C-21 accepted=false/C-01 차단/DIR-2 미발생을 보존한다. commit/push와 WSL/Docker/DB/Provider/Telegram/ysna/main은 `NOT_EXECUTED`다.

## 2026-09-06 C-21 Provider WSL Git-only candidate exact12

- 상태: `IN_PROGRESS`; 시작 기준은 `a6dca0da5a37e64491e91813895268e78ecb78b2`, source parent는 `e4cccf3ce99e29005103cea3bd76fa0eede36f28`이다.
- RED: existing manifest source mismatch와 completion validator 부재를 각각 재현했다. 최소 GREEN은 source/ref contract와 validator 노출까지 확인했다.
- 외부 범위: commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 모두 `NOT_EXECUTED`다.
- 다음 조치: seq528~530 forward-only record와 progress/evidence/digest 재결박 뒤 전체 검증을 수행한다.


### exact12 미완성 인수 및 seq530 플랫폼 승인 심사 차단

- 담당: developer-primary 역할의 developer_c21_candidate_finish. 시작 HEAD a6dca0da5a37e64491e91813895268e78ecb78b2, branch codex/c21-operational-execution, 기존 dirty8을 그대로 인수했다. 이전 INCOMPLETE는 유효 FAILURE_REPORT가 아니며 제품 실패 횟수에 더하지 않는다.
- 인수 검토: CandidateReleaseManifest/guard/test의 역사 seq494 fixture 혼합, seq530 validator의 event details/WI/raw checksum/detached metadata 결박 미완성을 확인했다.
- 새 RED 명령: TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1, .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k git_only_candidate_bound. 실제 결과 exit1, 2 failed/175 deselected/0.42s. 원인은 seq530 Git projection 및 신규 manifest 미완성이다.
- 적용한 변경: tests/tooling의 seq530 mutation/direct-child 계약 테스트와 checker의 seq530 exact107+exact12 pre/postcommit predicate, status collection None 차단, source direct-child path 및 미게시 candidate ref 검사. 전체 seq530 validator와 projection artifact는 아직 미완성이다.
- 플랫폼 fingerprint PLATFORM_SEQ530_INTEGRITY_GATE_APPROVAL_REQUIRED 3회. 1차 terminal/WI/raw/digest 보강 patch가 seq510~513 승인 범위 초과로 거절됐고, 2차 현행 WI exact12를 근거로 제시한 helper 단일 patch도 WI가 사용자 승인으로 인정되지 않아 거절됐다. 3차 사용자 계속하자 및 사용자 제공 AGENTS와 역사 불변 근거를 제시한 3줄 역사 in-memory 변조 거부 patch도 같은 사유로 거절됐다. 모두 실제 codex --codex-run-as-apply-patch를 require_escalated로 요청했으며 실행 전 거절되어 해당 patch는 적용되지 않았다. 이는 제품 실패가 아니고 우회하거나 추가 반복하지 않는다.
- 정확한 최소 차단 patch: validate_c21_provider_wsl_git_only_candidate_projection의 terminal 계산 직전에 if preserved and events[:527] != json.loads(historical)["events"]: preserved = False를 추가하는 변경이다. Main에 3회 사유와 patch를 전달했다.
- 안전한 재개 조건: Main이 seq528~530 checker/progress/evidence/digest 구현에 대한 시스템 승인 경계를 해소하면 같은 dirty8에서 계속한다. 그 전에는 영향 없는 guard와 historical harness 보완을 수행한다. 새 seq528~530 event는 아직 append하지 않았다.
- 실제 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 모두 NOT_EXECUTED이며, 기존 seq1~527 및 historical evidence 원본은 불변이다. 현재 RED 또는 미완성 결과를 PASS/COMPLETED로 표시하지 않는다.


### exact12 인수 후 validator·fixture 보완 및 focused GREEN

- Main이 child의 시스템 승인 거절을 인수하여 checker history guard, seq528~530 expected helper/validator, candidate guard 및 governance materialization을 실제 apply_patch로 적용했다. child에서는 Main 인수 뒤 helper 1회, deploy guard 1회, events append 1회가 각각 추가 거절되어 정확한 patch와 생성 변환을 Main에 전달했고 같은 요청을 반복하지 않았다.
- Main materializer 첫 실행은 expected_terminal 지역변수 누락으로 1회 실패했고 즉시 수정 재실행 exit0으로 해소됐다. live 오류 3종은 events envelope last_sequence=527 잔존, terminal projection metadata 누락으로 seq527 event가 최신 repository event로 선택됨, registry_refs.progress_events hash 잔존이었다. Main이 last_sequence=530, terminal530 exact metadata와 registry hash를 반영했다.
- child 최초 historical deploy focused는 5 failed/82 deselected/19.25s exit1. PATH 첫 bash가 WindowsApps app alias라 return127 및 cp949 reader 오류가 발생했다. 서비스/WSL QA 실행 성공이 아니며 Git Bash exe로 PATH를 고정하고 PYTHONUTF8=1로 교정했다.
- 환경 교정 후 관련 focused는 3 failed/6 passed/78 deselected/47.08s exit1. 원인은 historical guard를 fixture tracked 경로로 복사해 dirty를 만든 점(두 inherited test)과 synthetic stat의 Windows CRLF 출력이었다. historical guard를 fixture repo의 sibling으로 분리하고 Unix fixture write_text에 newline LF를 명시했다. 제품 코드 변경으로 우회하지 않았다.
- 보완 focused session83789는 11 passed/80 deselected/80.13s exit0. 이어 historical READY/cleanup helper도 immutable a6dca0d Git guard로 분리한 focused session50381은 18 passed/73 deselected/103.89s exit0이다.
- 최신 guard 검증은 실제 로컬 Git clone에서 nominal binding PASS, public runtime exit22, branch/upstream drift, failed Git status collection, candidate remote drift, exact12를 유지한 누적109 reversion 거부를 포함한다. 기존 seq494/rollback/cleanup의 역사 계약은 당시 Git blob으로 유지하며 실제 외부 실행 증거로 승격하지 않는다.
- seq1~527 raw prefix byte-equal을 직접 확인했다. 현재 남은 일은 마지막 exact12 잘못된 집합/두 번째 descendant focused, 최종 자료 재결박, full tooling/deploy, shell syntax, py_compile, diff-check 및 exact12/exact109 hash 감사다.
- 모든 오류는 원인별 보완/환경/플랫폼 기록이며 이번 인수의 유효한 FAILURE_REPORT 반복은 0이다. Main 검토·전체 필수 검증이 끝나기 전 C-21 또는 이번 exact12를 최종 완료로 주장하지 않는다.
- 마지막 current guard exact12 집합/second descendant focused(session83888)는 2 passed/91 deselected/15.95s exit0이다. 코드/fixture 및 전체 suite 전 기록을 마감했으며 다음은 Main 재결박 뒤 전체 검증이다. git diff --check exit0.


### seq530 전체 검증 1차 및 테스트-only 잔존 보완

- 최종 재결박 후 live checker는 PASS sequence=530 / AUTO_CONTINUE였고 후보 focused는 7 passed/171 deselected/16.70s exit0(session89317)이었다.
- 전체 fresh 1차 tooling(session19334): 1 failed, 177 passed in 687.94s, exit1. test_c21_wsl_qa_resume_candidate_rebind_separates_ready_from_actual_execution만 실패했다. seq494 historical bundle을 사용하면서 CandidateReleaseManifest만 최신 ROOT에서 읽어 private_push_policy KeyError가 난 참조 혼합이었다. 해당 한 줄을 historical_root로 고정했다.
- 전체 fresh 1차 deploy(session25037): 1 failed, 90 passed, 2 skipped in 680.36s, exit1. test_fresh_no_checkout_clone_reaches_manifest_guard_with_a_clean_worktree만 실패했다. 현재 guard가 exact107 source 검사에서 먼저 거부하는데 과거 manifest contract mismatch 진단을 기대했다. 현재 정확한 candidate source must be the exact107 commit 문구로 기대값 한 줄만 정정했으며 clean-tree/dirty-tree 검증은 유지했다.
- 수정 후 focused(session30131): 2 passed, 2 skipped, 267 deselected in 6.80s, exit0. 두 실패의 원인은 테스트-only 참조/기대 문구이며 제품 checker/guard 추가 변경은 0이다. 최초 full의 실패를 통째 PASS로 재분류하지 않는다.
- SKIP2는 Compose parser 부재와 Git Bash/NTFS의 POSIX0600/0400 mode 표현 불가다. 이 Windows-local slice에서 actual WSL/Docker/DB/Provider/Telegram/ysna/main을 실행하거나 SKIP를 실제 QA PASS로 승격하지 않았다.
- 정적/무결성: Python3파일 py_compile PASS, Git Bash -n guard PASS, diff-check PASS; dirty exact12 SHA6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765, cumulative exact109 SHA16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E, seq1~527 raw prefix931700bytes SHA E8171085938267B003285688E97C76FEC5D2D1173533EED0CBF5BC854C47788F byte-equal을 확인했다. py_compile 임시 출력은 자동 정리되고 잔류0이다.
- 다음 조치: Main 재결박 후 전체 tooling/deploy를 각 fresh 재실행해 최종 GREEN 증거를 남긴다. 현재 accepted=false 및 외부 NOT_EXECUTED 경계는 불변이다.


### seq530 exact12 최종 fresh 검증 마감

- 판정: 로컬 구현/기본 검증 COMPLETED, Main 최종 검토 및 문서 결과 재결박 후 무결성 확인 대기다. C-21 전체 수락 또는 외부 실행 완료를 의미하지 않는다.
- 재결박 후 live checker: .venv/Scripts/python.exe scripts/check_project_progress.py → PASS sequence=530 reporting=AUTO_CONTINUE, exit0. 후보 focused: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k git_only_candidate → 7 passed, 171 deselected in 17.22s, exit0(session33579).
- 전체 fresh tooling: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider → 178 passed in 664.70s, exit0(session67778).
- 전체 fresh deploy: .venv/Scripts/python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -rs -p no:cacheprovider → 91 passed, 2 skipped in 649.93s, exit0(session10125). SKIP2는 Git Bash/NTFS POSIX0600/0400 표현 한계와 Compose parser 부재다. 두 full suite의 실패는 0이나 SKIP를 실제 WSL PASS로 승격하지 않는다.
- 실행 환경: PATH 선두 C:/Program Files/Git/usr/bin, PYTHONUTF8=1, TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1. 두 suite 실행 중 제품/기록 파일은 수정하지 않았다. 테스트가 사용하는 disposable Git fixture만 로컬에서 생성/정리했으며 실제 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 NOT_EXECUTED다.
- 보존 경계: source a6dca0da5a37e64491e91813895268e78ecb78b2와 K exact12 dirty만 유지한다. seq1~527 및 historical evidence를 변경하지 않는다. accepted=false, C-01 차단, DIR-2 미발생, 실행 허가 HOLD는 불변이다.
- 다음 안전 조치: 이 문서 결과 기록을 Main이 manifest/progress/digest에 재결박하고 live checker, diff-check, exact12/exact109 및 역사 raw byte 불변을 최종 확인한다. 코드/테스트는 전체 fresh 실행 이후 변경하지 않았다. 이후 Main이 exact12 diff와 증거를 검토하며 이 child는 commit/push/외부 실행을 하지 않는다.
- rollback: 미커밋 exact12를 그대로 보존해 Main이 승인된 diff 단위로 처리한다. 임의 reset/clean/stash, 다른 dirty 또는 historical evidence 삭제는 하지 않는다. 유효 FAILURE_REPORT 반복은 0이며 초기 실패/환경/플랫폼 오류 기록은 위에 누적 보존했다.


### seq530 Reviewer Important 1 — 손상/누락 evidence fail-closed 재작업

- 인수: 최종 local COMPLETED 뒤 Reviewer가 신규 seq530 validator의 missing/corrupt evidence 예외를 Important1로 제기했다. detached_digest None/list/누락, historical events/progress Git blob 누락·손상, current progress/HANDOFF 누락, CandidateManifest/WI 누락에서 오류 목록 대신 AttributeError/UnboundLocalError/CalledProcessError/JSONDecodeError/FileNotFoundError가 날 수 있다. 동일 지적 첫 재작업이며 유효 FAILURE_REPORT 반복은0이다.
- 원인: 역사 조회/파일 읽기 실패를 기록한 뒤 미초기화 raw 변수를 재사용하고, digest 및 역사 projection의 구조를 확인하지 않은 채 중첩 get/helper를 호출했다. latest evidence hash loop는 IO 예외를 처리하지 않았다.
- TDD: tests/tooling/test_project_progress.py에 malformed digest7행, historical Git missing/invalid JSON/null/list/empty object10행, current events/progress/HANDOFF/CandidateManifest/WI/prompt missing6행의 table-driven adversarial 회귀3개를 추가했다. 실제 파일은 삭제하지 않고 해당 read_bytes/git-show 경계만 mock한다.
- RED 명령: 고정 Git Bash/PYTHONUTF8/TEMP D:/tmp 환경에서 .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'bound_malformed_digest or bound_history_unavailable or bound_missing_files' → 3 failed,178 deselected in2.33s, exit1. 실제 historical 및 progress_raw 미초기화 예외를 확인했다.
- 설계: 역사 필수 입력 오류는 HISTORY_INVALID, digest shape/필수 raw 읽기 실패는 DIGEST_INVALID로 후속 미초기화 사용 전에 반환하고 latest 파일 hash IO 실패는 LATEST_REF_INVALID로 누적한다. 정상 정확 결박 조건과 seq1~527 역사 원본은 변경하지 않는다.
- 플랫폼: checker 최소 patch를 실제 codex --codex-run-as-apply-patch require_escalated로1회 요청했으나 seq510~513 승인 밖 영속 gate 변경이라는 사유로 실행 전 거절됐다. 반복/우회 없이 정확 unified diff를 Main에 전달했다. 이는 제품 실패 횟수에 더하지 않는다.
- 다음 조치: Main 시스템 승인 적용 후 adversarial 전 행과 관련 focused를 확인하고 기록/hash를 재결박한다. Main 지시에 따라 전체 검증 및 독립 재검토를 진행한다. commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 NOT_EXECUTED다.

- Main이 제시한 최소 fail-closed patch를 시스템 승인으로 적용했다. child 재검증에서 adversarial3개/23행은 3 passed,178 deselected in3.02s exit0이다. 누락/손상 입력을 PASS로 처리하지 않고 명시 C21_HISTORY_INVALID/C21_DIGEST_INVALID/C21_LATEST_REF_INVALID를 반환하는 것을 각 행에서 검사했다.
- 관련 focused 명령: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'git_only_candidate and not bound_projection_rejects_mutations' → 9 passed,172 deselected in15.32s exit0(session33975). 현재 기록/코드/test raw hash가 재결박 전이므로 정상 전체 baseline 비교1개는 의도적으로 이 실행에서 제외했다. 이를 전체 candidate 또는 전체 tooling PASS로 주장하지 않는다.
- 정상 전체 candidate 비교와 live checker는 Main의 재결박 직후 실행한다. 이전 full178P/91P2S는 I1 보완 전 증거로 보존하며 최신 코드의 full로 재사용하지 않는다. focused와 독립 Reviewer 재검토가 끝나기 전 전체 suite는 재실행하지 않는다.


### seq530 Reviewer I1 CLEAN_REVIEW 및 최종 전체 검증 마감

- 판정: COMPLETED / CLEAN_REVIEW / C0 / I0 / M0. 독립 Reviewer 최종 판정과 commit 허용은 Main이 전달한 결과다. child가 독립 Reviewer 역할을 수행하거나 자체 승인한 것이 아니다.
- I1 후 재결박 검증: live checker PASS sequence=530 reporting=AUTO_CONTINUE, 정상 baseline 포함 candidate focused10 passed,171 deselected in17.70s exit0(session42329). adversarial23행은 명시 오류 목록을 반환하며 예외가 없다.
- I1 후 전체 fresh tooling 명령: .venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider → 181 passed in664.59s(11:04), exit0(session76370).
- I1 후 전체 fresh deploy 명령: .venv/Scripts/python.exe -m pytest tests/deploy/test_wsl_staging_harness.py -q -rs -p no:cacheprovider → 91 passed,2 skipped in642.84s(10:42), exit0(session43244).
- SKIP 한계: Git Bash/NTFS에서 POSIX0600/0400 mode 표현 불가 및 Compose parser 부재다. Windows-local full 결과이며 실제 WSL/Docker/DB/Provider/Telegram/ysna/main PASS를 의미하지 않는다. Gate의 별도 실제 실행 경계를 넓히거나 SKIP를 PASS로 바꾸지 않았다.
- 환경/불변: Git Bash PATH 선두, PYTHONUTF8=1, TEMP=TMP=D:/tmp, PYTHONDONTWRITEBYTECODE=1. 두 full 실행 중과 종료 결과 보고까지 파일 수정0이며 이후 이 WORK_STATUS/HANDOFF 기록만 수정했다. 코드/테스트는 full 실행 이후 불변이다.
- commit 허용: Main 지시에 따라 승인된 K exact12의 로컬 commit을 허용하는 review 마감 상태로 기록한다. 실제 commit은 child가 실행하지 않았으며 Main의 최종 재결박/무결성 확인 후 수행한다. push 및 WSL/Docker/DB/Provider/Telegram/ysna/main 외부 실행은 계속 NOT_EXECUTED이고 별도 실행 승인 경계를 유지한다.
- 다음 안전 조치: Main이 기록 결과를 manifest/progress/digest에 최종 재결박하고 live checker 및 exact12/exact109/역사 raw 불변을 확인한다. 최종 로컬 commit/후속 조치는 Main이 관리한다. C-21 accepted=false, C-01 차단, DIR-2 미발생은 불변이다.
- 기록 마감 중 도구 wrapper JavaScript 괄호 오류1회(SyntaxError Unexpected token)는 shell 실행 전에 발생했고, 괄호를 바로잡은 동일 문서 patch 재실행 exit0으로 해소했다. 제품/테스트 실패나 파일 손상은 없으며 유효 실패 횟수에 더하지 않는다.


### seq530 Main focused 환경 오류 및 교정 결과

- Main 전달 실행 증거: 첫 focused는 PATH/PYTHONUTF8 고정 누락으로 WindowsApps bash가 선택되어 8 failed(rc127) 및 cp949 reader warnings가 발생했다. 이 결과는 Windows-local launcher/encoding 환경 오류이며 제품 기능 실패나 실제 WSL 실행 증거가 아니다.
- Main이 즉시 PATH 선두 Git Bash, PYTHONUTF8=1, TEMP=TMP=D:/tmp로 고정해 재실행한 결과는 16 passed,258 deselected in79.41s, exit0이다. 최초 오류를 숨기거나 PASS로 바꾸지 않고 교정 실행과 분리해 기록한다.
- Main 지시에 따라 HANDOFF machine independent_focused를 PASS_MAIN_16_AND_REVIEWER_20_ADVERSARIAL로 갱신한다. 이는 Main이 전달한 독립 검증 증거이며 child가 Reviewer20을 직접 실행했다는 뜻은 아니다.
- 이번 보완은 WORK_STATUS/HANDOFF 기록만 변경한다. 코드/테스트는 최종 전체 tooling181P 및 deploy91P2S 이후 불변이다. 외부 실행/commit/push는 child에서 하지 않았고 Main 최종 재결박을 기다린다.


### seq533 Provider WSL execution-resume S 시작 projection

- 시작 기준: `codex/c21-operational-execution` / `e6c562cf07bc2c35e24addb60efa9d90fae08046`, clean이며 parent는 `a6dca0da5a37e64491e91813895268e78ecb78b2`다. seq527 CLEAN_REVIEW C0/I0/M0와 seq530 `commit=NOT_EXECUTED` 사실을 보존한다.
- S exact10은 `0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070`, 후속 K exact14는 `3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B`로 결박한다. 외부 실행, commit, push는 모두 `NOT_EXECUTED`다.
- TDD RED: execution-resume path helper 부재를 AssertionError로 확인했다. GREEN: path helper focused 1 passed. full tooling/checker/py_compile/diff-check는 projection 재결박 전이므로 아직 미실행이다.
- 플랫폼 오류: canonical progress의 active WorkInstruction/lease 전환 patch는 영속 운영 상태 변경으로 2회 거절됐다. 제품 실패가 아니며 해당 오류를 PASS로 승격하지 않는다. Main의 승인 binding 또는 시스템 적용 뒤 seq531~533, handoff/digest, live checker를 재결박한다.
- 미검증: K direct-child commit, Main exact binding, actual current/previous runtime 관측 및 WSL/Docker/DB/Provider/Telegram/ysna/main은 수행하지 않았다. rollback은 미래 dispatch에서 관측해야 하며 추측하지 않는다.

### seq533 S validator writer 인수 및 집중 검증

- 담당 `developer-primary` 역할의 `developer_seq533_validator`; 인수 HEAD `e6c562cf07bc2c35e24addb60efa9d90fae08046`, branch `codex/c21-operational-execution`, 기존 dirty7 보존. 변경은 S exact10 안의 checker/test/WI/prompt/WORK_STATUS/HANDOFF이며 제품·외부 실행·commit/push는 0이다.
- TDD RED: `-k execution_resume` → `4 failed,1 passed,181 deselected`, exit1. 순수 artifact builder와 seq533 validator 부재가 원인이다. 이후 strict JSON, raw header/footer·prefix, 역사 progress 보존, 정확한 manifest raw5/latest6, Git direct-child·scope·ref 수집 계약을 구현했다.
- 로컬 환경 오류 `SEQ533_TMPDIR_SANDBOX_PERMISSION_LOOP` 1개 원인: 첫 일반 권한 테스트와 진단 실행에서 Python tempfile.mkdtemp가 D:/tmp 생성 거부를 재시도했다. 두 실행을 중단하고 faulthandler 1회로 해당 위치를 확인했다. 별도 실행한 진단도 즉시 중단했다. 외부 실행 또는 제품 실패가 아니며 유효 FAILURE_REPORT 횟수에 포함하지 않는다. 승인된 D:/tmp fixture 생성/자동 정리만 require_escalated로 실행해 해소했다.
- 첫 GREEN: `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k execution_resume` → `5 passed,181 deselected in6.68s`, exit0.
- 추가 RED: Git 실행 OSError가 밖으로 전파되고 duplicate/malformed path helper가 없는 것을 `2 failed,185 deselected in1.91s`, exit1로 확인했다. 수집 실패를 `GIT_REQUIRED_COLLECTION_FAILED`로 반환하고 중복/경로 변조를 거부했다.
- 최신 GREEN: 같은 focused 명령 → `6 passed,181 deselected in8.67s`, exit0. 누락/손상/nonobject/duplicate JSON/nonfinite/invalid UTF-8 evidence, duplicate rows, refs/status/ref collection 실패, dirty widen/narrow, second descendant, merge, source parent, 누적 reversion을 확인했다. 실제 WSL/DB/Provider/브라우저 성공 증거가 아니다.
- canonical P/E/D 영속 쓰기는 Main의 기존 동일 원인 플랫폼 거절 3회 후 Main takeover 지시에 따라 이 writer가 시도하지 않았다. Main에 순수 `c21_provider_wsl_execution_resume_start_artifacts`와 정확한 입력 mapping을 전달한다. 현재 machine projection/manifest/digest는 재결박 전이므로 seq533 live checker PASS를 주장하지 않는다.
- 다음 안전 행동: Main이 기록 마감 후 E/P/H/D/M bytes를 재생성하여 apply_patch로 적용하고 live checker, exact10/exact113, historical raw 불변과 독립 검토를 수행한다. S/K의 모든 외부 필드는 NOT_EXECUTED이고 runtime은 K direct-child commit 및 Main exact binding 전까지 차단한다.

#### seq533 공통 복구 계약 보완 및 writer 마감

- 관련 회귀 `-k 'execution_resume or git_only_candidate_start or git_only_candidate_postcommit'`는 `10 passed,177 deselected in22.88s`, exit0이다. 이 결과는 아래 공통 HANDOFF 필드 보완 전 증거이며 최신 전체 tooling PASS로 표시하지 않는다.
- 추가 TDD RED `execution_resume_matches_shared`는 `1 failed,187 deselected in0.97s`, exit1이었다. 새 machine summary에서 기존 공통 validator가 요구하는 baseline/failure/next action/DIR/upstream/projection/base/path 필드8개가 누락돼 실제 불일치를 재현했다. source progress 기준으로 필드를 보존하고 next_safe_action은 K exact14 준비로 맞췄다. Event/reporting/detached/manifest 공통 계약은 유지했다.
- 최종 focused `-k execution_resume`는 `7 passed,181 deselected in8.55s`, exit0이다. source seq530 validator, Git predicate If와 collector 내부 seq530 If의 AST는 불변 True였다. 두 Python 파일의 in-memory compile 및 git diff --check PASS. raw checksum과 portable checksum도 current latest 파일5개에서 일치했다.
- `D:/tmp/anvil-seq533-*` 테스트 fixture 잔류0을 확인했다. canonical P/E/D 쓰기0, commit/push/외부 실행0. 현재 dirty7이며 Main의 5개 artifact 적용 뒤 S exact10이 된다. manifest 초안과 HANDOFF machine block도 같은 builder 결과로 함께 교체해야 한다.
- 완료 판정은 `INCOMPLETE_MAIN_MATERIALIZATION_REQUIRED`다. 구현·집중 계약은 완료했고, canonical 적용/live checker/실제 Git precommit projection/전체 tooling·독립 검토는 Main의 영속 기록 인수 후 검증한다. 열린 제품 finding을 없다고 선언하지 않는다.

#### seq533 Main materialization 후 registry hash 보완

- Main이 S exact10을 적용한 뒤 live checker에서 `PRG_REGISTRY_HASH_MISMATCH` 1건을 전달했다. read-only 진단 결과 `registry_refs.progress_events.sha256`가 source E hash `2B1B29ACF178595EEF3C2C2CEB22BE3529BB61E7BB27567CC9601474C5CE7B36`에 남아 있었고 실제 E hash는 `29DC6F22D130E4AB29FB4683C3883F8490EA713EF1DEB779FB8847C2321CB9EC`이었다.
- 원인 `SEQ533_REGISTRY_EVENTS_HASH_NOT_REBOUND` 1회. builder에서 새 E를 latest refs에만 반영하고 registry 참조를 갱신하지 않은 누락이다. 기존 공통 `_validate_registry_refs`를 공유 복구 계약 테스트에 포함해 `1 failed,187 deselected in1.01s`, exit1로 동일 오류를 재현했다.
- 수정: artifact builder가 generated E의 실제 SHA-256을 `registry_refs.progress_events`에 갱신한다. source의 다른 registry refs는 보존한다. checker/test/이 기록만 수정했고 canonical P/E/D는 쓰지 않았다.
- 최신 GREEN: `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k execution_resume` → `7 passed,181 deselected in8.83s`, exit0. `-k execution_resume_start`는 path helper1개만 선택하므로 전체 seq533 집중 검증으로 사용하지 않는다.
- 다음 안전 조치: Main이 current6 입력으로 E/P/H/D/M을 다시 materialize하고 live checker를 실행한다. live PASS는 아직 확인하지 않았으며 commit/push/외부 실행0을 유지한다.

#### seq533 전체 tooling 3F와 Reviewer I1 재작업

- Main 재결박 후 live checker PASS와 execution_resume7 PASS를 전달받고 파일 수정 없이 fresh full tooling을 실행했다. 명령 `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider`, PYTHONUTF8=1/PYTHONDONTWRITEBYTECODE=1/TEMP=TMP=D:/tmp/PATH Git Bash 선두. 결과 `3 failed,185 passed in565.15s (9:25)`, exit1(session2176). 실행 중 파일 수정0이며 이 실패를 전체 PASS로 대체하지 않는다.
- full 실패 중 `...git_only_candidate_bound_git_projection_is_exact`, `...git_only_candidate_bound_projection_rejects_mutations`는 live seq533 bundle과 historical seq530 source/manifest를 혼합한 fixture 오류였다. 두 테스트를 immutable `e6c562cf07bc2c35e24addb60efa9d90fae08046`의 seq530 bundle/manifest로 옮겼으며 기존 정상·음성 assertion은 보존했다.
- full 나머지 `test_git_and_authority_bindings_are_checked_against_workspace`는 mutated validated_base_commit에 대한 실제 ancestry 수집이 상수 base를 사용해 예상 `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 누락했다. seq533 collector는 repository에 기재된 base로 ancestry를 조회하며, 예상 exact base와의 불일치는 별도 projection 오류로 유지한다.
- Reviewer I1은 public main→load_bundle 경로에서 P/E/M의 nonobject/null/nested corruption이 sequence 전용 validator 앞에서 AttributeError/TypeError를 발생시킨 문제다. 공개 main 테스트로 P/E/M 각각 []/null/nested corruption 총9행을 추가했다. main 경계가 구조 오류를 `LOAD_ERROR:INVALID_STRUCTURE:<error type>`와 exit1로 반환해 traceback 없이 fail-closed하도록 보완했다.
- 수정 전 RED: 공개 main 및 영향3개 선택자는 `4 failed,185 deselected in2.85s`, exit1. 최신 GREEN: `-k 'execution_resume or git_and_authority_bindings_are_checked_against_workspace or git_only_candidate_bound_git_projection_is_exact or git_only_candidate_bound_projection_rejects_mutations'` → `11 passed,178 deselected in21.35s`, exit0(session57492).
- source seq530 validator, Git predicate If, collector 내부 seq530 If의 AST 불변3개 True; in-memory compile/diff-check PASS. runtime 외부 실행·commit/push와 canonical P/E/D 쓰기는 0이다. checker/test/WORK_STATUS/HANDOFF를 마감한 뒤 Main이 기존 pure builder로5 artifacts를 재결박하고 live checker 및 Reviewer I1 독립 재검토를 수행한다. 보완 후 fresh full tooling은 아직 미실행이다.

#### seq533 최종 전체 검증·독립 검토 마감

- 판정: `full_tooling=PASS_189`, `independent_review=CLEAN_REVIEW_C0_I0_M0`, `independent_focused=PASS_REVIEWER_18_MAIN_15`. 독립 Reviewer 결과와 Main15 증거는 Main이 전달한 검토 판정이며 이 writer가 독립 Reviewer를 겸한 결과가 아니다.
- I1 보완·최종 재결박 후 fresh 전체 tooling 명령 `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -rs -p no:cacheprovider` → `189 passed in729.23s (12:09)`, exit0(session81020). Git Bash PATH 선두, PYTHONUTF8=1, PYTHONDONTWRITEBYTECODE=1, TEMP=TMP=D:/tmp를 고정했다. 전체 실행 시작부터 결과 회수까지 파일 수정0, 재실행0이다. 이전 full185P/3F는 보완 전 기록으로 그대로 보존한다.
- Main 전달 독립 증거: Reviewer CLEAN_REVIEW / C0 / I0 / M0, related18과 Main15 PASS. 공개 main malformed P/E/M []/null/nested9행은 exit1/error/no traceback으로 거부한다. Git adversarial은 source/direct-child/extra-parent/second-descendant/ref 수집실패/dirty widen-narrow/cumulative reversion을 거부한다. 검증 전용 잔류0을 확인했다.
- 이번 마감 변경은 `docs/WORK_STATUS.md`, `docs/progress/BUILD_HANDOFF.md` 두 문서뿐이다. 제품·검증 코드와 historical seq1~530은 변경하지 않았다. 세 결과 값은 본문에 기록하며 strict machine summary의 schema 변경은 하지 않는다.
- Main 지시에 따라 seq533 S exact10의 로컬 commit 허용 상태를 기록한다. 실제 commit은 Main이 최종 재결박/live checker/무결성을 확인한 뒤 수행하며 writer는 commit/push를 실행하지 않았다. 이는 K runtime 실행이나 외부 배포 승인으로 확대되지 않는다.
- C-21 accepted=false, C-01 차단, DIR-2 미발생을 유지한다. WSL/Docker/DB/Provider/Telegram/ysna/main/push는 NOT_EXECUTED다. runtime dispatch는 K direct-child commit 및 Main exact binding 전까지 차단한다.
- 다음 안전 행동: Main이 마감된 WORK_STATUS/HANDOFF를 포함한 current6 raw input으로 E/P/H/D/M을 재결박하고 live checker 및 로컬 commit 직전 exact10을 확인한다. 이번 문서 마감 자체를 새로운 실제 WSL/브라우저/DB PASS로 표시하지 않는다.
# 2026-09-06 C-21 Provider WSL execution-resume K exact14

- 담당: `developer-primary`; 상태: `IN_PROGRESS_TDD_GREEN`.
- 기준: branch `codex/c21-operational-execution`, HEAD `d442d4584516e1a673fd2edde55a2fe1330e9394`, 시작 clean.
- lease: worker `worker-lease-c21-provider-wsl-execution-resume-20260906-001`, write `write-lease-c21-provider-wsl-execution-resume-20260906-001`, exact14/hash `3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B`.
- TDD RED: completion repository 전용 테스트가 `_validate_c21_resume_bound_repository` 부재로 exit 1, 1 failed. fingerprint `C21_PROVIDER_WSL_EXECUTION_RESUME_BOUND_MISSING_R1` 1회.
- 환경 오류: `rg.exe` 실행 불가 1회(`ResourceUnavailable`); PowerShell `Select-String`으로 읽기 전용 조사 전환. 제품 오류가 아니다.
- 구현 중: seq534~536 completion builder, exact14/cumulative117 Git predicate, CandidateReleaseManifest/guard runtime-ready 계약.
- 미실행: commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main merge.
- 다음: guard/projection TDD GREEN, 집중 및 전체 tooling/deploy 검증, evidence 재결박, writer lease 회수.

## seq536 writer 실행 중단 및 Main 인수 요청

- 동일 환경 fingerprint `SEQ536_DEPLOY_TEST_PYTHON_CPU_HANG`가 3회 반복됐다.
  1. 기존 no-hardlinks fresh clone 단일 guard test: 60초 초과, 출력 없음, 소유 Python process 종료.
  2. `--shared --no-checkout` 축소 fixture 단일 test: 30초 초과, 출력 없음, 소유 Python process 종료.
  3. pytest를 제거한 직접 module/helper 실행: module 실행 경로에서 30초 초과, 출력 없음, 소유 Python process 종료.
- `ast.parse`와 별도 `exec(compile(...))` module 정의만은 즉시 PASS했고 class 위치는 line 1751, 기존 cleanup class 뒤·state unit class 앞이다. 구문/삽입 위치 오류 증거는 없다.
- PowerShell stderr 진단 로그 생성은 sandbox가 `D:\tmp\seq536-stack.log` 쓰기를 거부해 실행되지 않았다.
- 마지막 성공 검증: completion 단위 `2 passed, 189 deselected`; `bash -n` PASS. `py_compile`은 project `__pycache__` 쓰기 권한 거부로 미검증이다.
- 세 번째 동일 hang 후 Subagent 추가 실행과 canonical P/E/H/D/M materialization을 중단한다. 현재 변경을 보존하고 worker/write lease를 Main takeover로 반환한다.
- commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main merge는 `NOT_EXECUTED`다.

## seq536 Main takeover 원인 확정 및 재개

- 판정: 동일 hang 3회에 따라 어울이 writer를 인수했다. 변경 9경로와 기존 기록은 그대로 보존했다.
- 확인 결과 test module import는 `0.41s`, fixture 생성은 `4.02s`로 정상이며 코드 구조나 clone 자체가 hang 원인이 아니었다.
- 환경 원인 확정: Developer 실행에서는 WindowsApps의 WSL `bash.exe`가 먼저 선택된 경로 불일치가 있었고, Reviewer 비승격 실행에서는 Git Bash 고정 후에도 sandbox가 `tempfile.mkdtemp(D:/tmp)` 쓰기를 재시도하며 정지했다. 단일 원인으로 단정하지 않고 두 환경 조건을 모두 기록한다.
- 교정: 검증 명령의 PATH 선두를 `C:\Program Files\Git\usr\bin`으로 고정하고 D:/tmp fixture 실행을 승인된 escalated 범위에서 수행했다. 같은 단일 guard fixture는 Main `1 passed, 118 deselected in 8.49s`, Reviewer `1 passed in 9.87s`; seq536 guard 3개는 Main `3 passed, 116 deselected in 41.26s`, Reviewer `3 passed, 116 deselected in 43.61s`, 모두 exit0이다.
- 이 교정은 제품·계약 변경이 아니라 검증 실행기 선택 정정이다. 외부 실행·commit·push는 계속 0이며, 다음은 canonical P/E/H/D/M materialization과 전체 회귀 검증이다.
- 첫 materialization live checker는 `EVENT_EFFECT_MISMATCH`, `GIT_REQUIRED_COLLECTION_FAILED`로 실패했다. 원인은 seq536 PACKAGE_COMPLETED에 공통 reducer용 cumulative `exact_allowed_paths`가 없었고, K가 push=NOT_EXECUTED인데 collector가 candidate remote ref 존재를 조기에 강제한 것이었다.
- 수정: completion event에 cumulative exact117을 추가하고, projection pre/postcommit에서는 seq533과 동일하게 candidate ref 수집 성공과 ref 부재를 요구한다. 실제 candidate ref=a6 검증은 미래 runtime guard에만 유지한다.
- 독립 Reviewer I1에 따라 CandidateReleaseManifest raw bytes를 checker 상수 SHA-256으로 고정하여 coherent unauthorized rewrite를 거부한다. rollback allowlist의 미관측 control d442를 제거하고 기존 실제 rollback 계보인 `a6dca0d`, `e4cccf3`를 보존했다.
- 수정 후 live checker는 `PASS sequence=536`이었다. 첫 집중 회귀는 역사 seq533 public-main test가 live seq536 파일을 혼합해 `1 failed,13 passed`였으며, 제품 실패가 아니라 fixture 격리 누락이다. 해당 테스트 입력을 immutable seq533 builder 산출물로 고정했다.
- 첫 전체 tooling은 `191 passed, 1 failed in 933.78s`, 첫 전체 deploy 계약은 `114 passed, 3 failed, 2 skipped in 1144.47s`였다. 병렬 D:/tmp I/O 경합 때문에 시간은 성능 증거로 사용하지 않는다.
- tooling 1F는 seq536 collector가 mutated declared base 대신 상수 base로 ancestry를 조회한 회귀였다. declared base의 형식과 실제 ancestor를 검사하도록 수정했다. deploy 3F는 seq536 test class가 기존 base test를 상속해 중복 실행했고, 역사 seq530 status-failure test 한 곳이 current guard를 source한 fixture 혼합이었다. seq536 class를 독립 TestCase로 바꾸고 역사 test는 immutable seq530 guard를 사용하도록 수정했다.
- 직접 수정 검증 3개는 `3 passed in 23.19s`. seq536 전용 branch/upstream/local HEAD, merge, exact14 widen/narrow, cumulative117 reversion, WI blob tamper, control-ref race/ABA를 보강한 집중 검증은 `7 passed, 93 deselected in 79.40s`, exit0이다.
- 최종 직렬 전체 tooling은 `192 passed in 716.25s`, exit0. 최종 직렬 전체 deploy 계약은 `98 passed, 2 skipped in 743.40s`, exit0이다. skip2는 Windows Git Bash/NTFS에서 POSIX 0600/0400 mode를 표현할 수 없는 항목과 Compose parser 부재이며 실제 WSL PASS로 승격하지 않는다.
- 현재 판정은 로컬 K exact14 구현·계약 검증 완료, `READY_FOR_APPROVED_WSL_QA`다. actual WSL/Docker/DB/Provider/Telegram/ysna/push/main은 모두 `NOT_EXECUTED`; 다음 안전 행동은 exact14/path hash와 누적 exact117을 재확인한 뒤 Main이 K direct-child commit을 만들고 별도 exact binding을 생성하는 것이다.
- HANDOFF builder와 마지막 tooling assertion을 반영한 뒤 fresh 전체 tooling을 다시 실행해 `192 passed in 682.23s`, exit0을 확인했다. 이 실행 중 파일 수정0이다.
- 독립 Reviewer 최종 판정은 `CLEAN_REVIEW / SPEC_PASS / QUALITY_APPROVED / C0 / I0 / M0`, commit 가능이다. 독립 focused는 execution-resume tooling11 PASS와 seq536 guard7 PASS이며 exact14/exact117/history/ref 부재/rollback/raw SHA/dispatch 차단을 재확인했다.

## C-21 Provider WSL exact-binding S 시작 — seq537~539 준비

- 담당: `developer-primary`; 기준 branch/HEAD: `codex/c21-operational-execution` / `3501c37b25274c2c3b406a15bc8a57aa03a162e7`; 시작 clean.
- TDD RED: `pytest ... -k exact_binding_start_contract_is_frozen` → exit 1, `1 failed, 192 deselected`; builder 부재가 의도한 원인이다. fingerprint `C21_PROVIDER_WSL_EXACT_BINDING_START_MISSING_R1`, 1회.
- S exact10 path hash `410EB4E3EB843BFF2FE9D332505445286986BE8572A288DF713E388DAF587B62`; post-S cumulative exact121 hash `8A7D4AA0124FBC49DD67D48DBF10C9CCC586BB43AB4A9A4473604C1E2F43B429`.
- 실측 authority는 WSL `SINSAN`, clean detached runtime `/srv/anvil-wsl/repo@a342d623...`, private `sinsan-develop/Anvil.git`, missing control repo/candidate ref, FF-eligible old control `772afbd...`, PG current/previous `a342d623...`/`324eb169...`, containers 없음, exact two volumes 없음, images 3종 있음, `.env` 0600/필수7 key 각1이다. secret 값은 기록하지 않았다.
- 이번 S의 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 `NOT_EXECUTED`다. 다음 K exact14는 detached runtime 허용, private exact refs/CAS, rollback `a6dca0d...` + observed current `a342d623...`, mutation 전 runtime drift fail-closed를 구현해야 한다.
- TDD GREEN: exact-binding focused `3 passed, 192 deselected`; raw history 보존, exact10/exact121, 후속 K exact14/hash, artifact tamper와 Git direct-child/private authority 거부를 확인했다. `py_compile`, `git diff --check`도 PASS했다.
- 첫 materialization live checker는 `EVENT_EFFECT_MISMATCH`였다. root cause는 seq539 `PACKAGE_STARTED` details에 공통 repository reducer가 요구하는 upstream/projection/base/relation 필드가 누락된 것이다. 이를 재현하는 direct field TDD RED 1건을 추가하고 source projection과 동일한 값으로 보완했다. fingerprint `SEQ539_EVENT_REDUCER_FIELDS_MISSING_R1` 1회.
- 전체 tooling 직렬 실행은 Main이 장시간 무응답으로 중단했다. 중단 전 점 53개만 출력됐고 exit/final summary가 없으므로 PASS로 집계하지 않는다. worktree 전용 잔류 PID `41160`/`8204`만 종료하고 잔류0을 확인했다. `SEQ539_FULL_TOOLING_MAIN_INTERRUPT` 1회는 정식 제품 실패가 아니다.
- 60초 이하 분할 최종 검증: exact-binding focused `3 passed`, 공통 recovery/malformed `2 passed`, live checker `PASS sequence=539`, `py_compile`, `git diff --check`, exact10 hash와 raw seq1~536 prefix 동일성 PASS. full tooling은 `INTERRUPTED_NOT_COUNTED`다.
- canonical exact10만 dirty이며 commit하지 않았다. Developer writer 실행은 완료보고와 함께 Main에 반환한다. 후속 K exact14의 실제 mutation은 Main의 exact binding/dispatch 전까지 금지한다.

### seq539 Main 집중 검증 동일 ancestry 오류 3회 인수

- Main 영향 집중 검증에서 live checker PASS539 뒤 `test_git_and_authority_bindings_are_checked_against_workspace`가 `1 failed, 13 passed, 181 deselected`였다. seq539 collector가 mutated `validated_base_commit` 대신 상수 base로 ancestry를 검사해 `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 누락했다.
- 이 근본 원인은 seq533·seq536에서 이미 각각 교정된 뒤 seq539에 다시 발생해 누적 3회다. 규칙에 따라 Developer 재지시 없이 Main이 직접 writer를 인수했다.
- 수정: repository가 선언한 base의 40자 SHA 형식과 실제 ancestor 관계를 검사한다. 예상 projection 상수 불일치는 기존 `GIT_EXACT_BINDING_PROJECTION_INVALID`로 별도 유지한다.
- 수정 전 실패를 PASS로 대체하지 않는다. 수정 후 동일 영향 테스트와 projection 재결박·전체 tooling을 다시 검증한다.

### seq539 Main 전체 tooling 회귀 보완

- Main ancestry 수정·재결박 후 Codex 번들 Python 집중 검증은 `3 passed, 192 deselected`였다. 시스템 Python 3.14 실행에서는 자식 `git` 캡처 핸들 복제 오류 `WinError 6`가 두 번 발생했으며 제품·계약 실패로 집계하지 않는다.
- fresh 전체 tooling은 `194 passed, 1 failed in 1072.08s`, exit 1이었다. 실패는 `test_c21_provider_wsl_git_only_candidate_bound_status_collection_fails_closed` 한 건이며 fingerprint `SEQ539_STATUS_COLLECTION_ERROR_CODE_REGRESSION_R1`, 오류 횟수 1회다.
- 원인은 seq539 전용 collector가 `git status` 수집 실패를 기존 계약의 `GIT_STATUS_COLLECTION_FAILED` 대신 포괄 오류 `GIT_REQUIRED_COLLECTION_FAILED`로 반환한 회귀다. status 수집을 별도로 검사해 기존 fail-closed 오류 코드를 그대로 유지하도록 수정했다.
- 수정 전 전체 실패는 PASS로 대체하지 않는다. 파생 projection을 다시 결박한 뒤 해당 회귀·집중 계약·live checker를 먼저 검증하고, 최종 fresh 전체 tooling을 재실행한다.
- 독립 Reviewer의 수정 전 최종 판정은 `CLEAN_REVIEW / COMMIT_READY / C0 / I0 / M0`였으나 이 추가 checker 변경 후 재확인이 필요하다. commit·push·WSL·Docker·DB·Provider·Telegram·ysna·main은 계속 `NOT_EXECUTED`다.

### seq539 Main 최종 전체 tooling PASS

- status 수집 오류코드 회귀 보완·projection 재결박 후 live checker는 `PASS sequence=539`, 영향 집중 검증은 `4 passed, 191 deselected`, `git diff --check`는 PASS였다.
- 동일 final diff에 대한 fresh 전체 tooling 명령은 Codex 번들 Python으로 `195 passed in 997.74s (0:16:37)`, exit 0이다. 실행 중 파일 수정은 없었다.
- 이전 `194 passed, 1 failed`는 보완 전 유효 실패 증거로 그대로 보존한다. 이번 PASS는 로컬 tooling 계약만 증명하며 WSL·Docker·DB·Provider·Telegram·ysna 운영 검증으로 승격하지 않는다.
- 다음 안전 행동은 문서 결과를 pure builder로 재결박하고 reviewer가 마지막 checker 변경을 재확인한 뒤 exact10/누적 exact121/history bytes/live checker를 확인하여 seq539 S direct-child commit을 만드는 것이다.
- 최종 Reviewer 재검토는 `COMMIT_READY / C0 / I0 / M0`다. status 수집 실패의 `GIT_STATUS_COLLECTION_FAILED` 보존, exact10/누적 exact121, seq1~536 raw history, deterministic projection, live checker와 diff-check를 재확인했다.
## C-21 seq540~542 Provider WSL exact binding K

- 담당 agent: `developer-primary`; 상태: `IN_PROGRESS_TDD_GREEN`.
- 기준: `71d6747c0b713bedf1a1bc6724a5771d6ae33c60`, exact14 write lease.
- TDD RED: focused 4 FAIL — completion builder, private exact authority, lifecycle validator가 아직 없어서 의도대로 실패했다.
- 반영: private `development` push와 WSL `origin` fetch 권위를 분리하고, clean detached runtime 및 initial/deployed/rolledback tuple을 결박한다.
- analyst 보완: 실제 rollback은 candidate 배포 전 `previous.sha=324eb169...`를 유지하므로 rollback allowlist를 `a6dca0d...`, `a342d623...`, `324eb169...` 3개로 구성한다.
- 오류 횟수: `C21_EXACT_BINDING_COMPLETION_MISSING_R1` 1회(TDD RED), 동일 근본 원인 반복 0회.
- 미실행: commit, push, SSH/WSL mutation, Docker, DB, Provider, Telegram, ysna, main merge.
- 다음 조치: pure seq540~542 projection과 strict checker를 완성하고 focused/full 검증 후 Main에 writer lease를 반환한다.

### seq542 동일 ancestry 오류 반복에 따른 Main 인수

- Developer 확대 회귀는 `14 passed, 285 deselected`, 신규 focused는 `5 passed, 295 deselected`, live checker는 당시 PASS542였다.
- 첫 병렬 전체 결과는 tooling `193 passed, 3 failed in 869.22s`, deploy `100 passed, 2 skipped, 2 failed in 888.65s`였다. 실패 결과는 최종 PASS로 대체하지 않고 그대로 보존한다.
- tooling 3건은 (1) seq536 historical manifest가 current 파일을 읽은 fixture drift `SEQ536_HISTORICAL_GUARD_FIXTURE_DRIFT_R1` 1회, (2) seq542 status 수집 오류코드 회귀 1회, (3) seq542 declared-base ancestry 누락 1회다. Developer가 historical blob 고정, `GIT_STATUS_COLLECTION_FAILED`, declared base 실제 ancestor 검사를 적용했다.
- declared-base ancestry 누락은 seq533·seq536·seq539에 이어 다시 발생한 동일 근본 원인이다. 규칙에 따라 Main이 추가 Developer write를 중단하고 exact14 writer lease를 직접 인수했다. Developer는 `INCOMPLETE_TAKEOVER_PACKET`을 제출했고 실행 중 pytest/python 잔류는 없었다.
- deploy 2건은 legacy Windows fixture에서 mock `stat` 디렉터리를 POSIX Bash PATH로 전달하지 못해 guard 전 `server-only environment mode`로 실패한 환경 fixture 오류였다. Main이 해당 PATH 3곳을 POSIX 목록으로 고정했다. 직렬 재현에서 1건은 새 guard의 오류 문자열이 기존 `candidate source must be the exact107 commit` 계약을 축약한 호환성 회귀로 드러나 기존 문자열을 복원했다.
- Main 보완 후 두 legacy deploy fixture는 `2 passed in 25.87s`, exit 0이다. 외부 commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 `NOT_EXECUTED`다.
- 현재 파생 P/E/H/D/M은 마지막 코드·문서 변경 전 materialization일 수 있으므로 pure builder 재결박이 필요하다. 이후 live checker, 영향 focused, 직렬 전체 tooling/deploy, independent review, exact14/누적 exact125를 다시 검증한다.

### seq542 Main 최종 검증 마감

- Main 보완·재결박 후 live checker는 `PASS sequence=542`, tooling 영향 집중은 `3 passed, 193 deselected`, deploy 영향 집중은 `6 passed, 98 deselected`, diff-check는 PASS였다.
- 동일 final code diff의 직렬 전체 tooling은 `196 passed in 925.73s (0:15:25)`, exit 0이다.
- 동일 final code diff의 직렬 전체 deploy 계약은 `102 passed, 2 skipped in 1043.36s (0:17:23)`, exit 0이다. skip 2건은 Git Bash/NTFS가 POSIX 0600/0400 mode를 표현하지 못하는 항목과 Compose parser가 필요한 WSL 전용 항목이며 실제 WSL PASS로 승격하지 않는다.
- 독립 Reviewer 판정은 `COMMIT_READY / C0 / I0 / M0`다. exact14/누적 exact125, seq1~539 raw history, deterministic projection, private development push와 WSL origin fetch 권위/CAS, a6/a342/324 lifecycle·rollback allowlist, runtime/image drift fail-closed, historical seq536 isolation과 Git 오류코드를 확인했다.
- 다음 안전 행동은 최종 문서 결과를 pure builder로 재결박한 뒤 live checker, exact14/누적 exact125/history, direct-child/clean 상태를 확인하여 seq542 K commit을 생성하는 것이다. 외부 push·WSL/Docker/DB·Provider/Telegram·ysna/main은 여전히 `NOT_EXECUTED`다.

## 2026-09-07 C-21 seq543~548 Provider 제외 WSL verify scope correction

- 담당 agent: `developer-primary` (subagent `/root/developer_seq548_verify_scope`)
- 기준: clean `c330d34ea7d0acc7e423a978f9c558c94c159118`, private control CAS도 동일, candidate ref `a6dca0da5a37e64491e91813895268e78ecb78b2`.
- 상태: exact17 구현 및 seq548 projection 생성 단계.
- 런타임 사실: deploy `PASS`; PG15는 local Provider envelope에서 중단; PG15 SSE/backup `NOT_REACHED`; PG18RC `NOT_STARTED`; local Provider status `ATTEMPTED`; external Provider/billing 및 Telegram `NOT_EXECUTED`.
- TDD RED `C21_WSL_VERIFY_PROVIDER_RUNTIME_SCOPE_LEAK_R1` 1회: `verify.sh`에 `/api/providers` 호출과 Provider 전용 temp/parser/assertion이 남아 focused `1 failed, 1 passed`.
- 조치: 모든 Provider runtime 호출과 전용 parser를 제거하고 auth session, SSE, Last-Event-ID, same-origin, migration, backup/restore는 유지. focused `2 passed`와 `bash -n` PASS.
- 구현 오류 `C21_VERIFY_SCOPE_BUILDER_UNDEFINED_SYMBOL_R1` 1회: 새 builder가 미정의 상수 `C21_RESUME_CANDIDATE`를 참조해 NameError. canonical `C21_RESUME_PARENT`로 수정, 반복 0.
- 테스트 오류 `C21_VERIFY_SCOPE_HISTORY_ASSERTION_R1` 1회: 최초 테스트가 JSON 내부 comma로 history prefix를 잘못 분리. production helper `raw_event_object_prefix_bytes(..., 542)` 비교로 정정, 반복 0.
- hash 산식 차이 `C21_VERIFY_SCOPE_WINDOWS_SORT_HASH_R1` 1회: 승인 hash는 Windows `Sort-Object` 문화권 정렬이고 기존 Python ordinal 정렬과 달랐다. underscore/hyphen collation을 재현한 deterministic helper로 exact17 `78D7...9502`, cumulative131 `984F...574A`를 모두 검증하도록 보완.
- valid failure count: 기존 `2` 유지. 위 항목은 구현·테스트 도구 오류이며 정식 동일 runtime failure로 증분하지 않는다.
- 외부 side effect: commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main 모두 `NOT_EXECUTED`.

### seq548 전체 회귀 및 환경 진단

- API full: `8 passed`.
- deploy full 최초 실행: `27 passed, 1 skipped, 77 failed in 698.76s`.
- 환경 fingerprint `BASH_D_DRIVE_MOUNT_UNAVAILABLE_R1` 2회 확인: 모든 실패가 `/d/tmp/...` 또는 `/d/tmp/.../candidate-manifest-guard.sh` 부재로 exit 127이었다. read-only 진단은 Git Bash cwd `/mnt/d/tmp/anvil-c21-operational-execution`, `/d/tmp=MISSING`, `/d/tmp/.../guard=MISSING`를 확인했다. 제품 assertion failure가 아니며 제품 코드를 이 환경에 맞춰 우회 수정하지 않는다.
- tooling full 최초 실행: `195 passed, 2 failed in 812.52s`.
- `C21_VERIFY_SCOPE_HANDOFF_PATH_FIELDS_R1` 1회: 새 active instruction에 공통 `artifact_path`/`invocation_path`가 없어 historical missing-file test가 KeyError. 두 필드를 canonical 경로로 추가했다.
- `C21_VERIFY_SCOPE_DECLARED_BASE_ANCESTRY_R1` 1회: seq548 전용 Git predicate가 declared base mutation을 전용 projection mismatch로만 거부하고 공통 named error `GIT_VALIDATED_BASE_NOT_ANCESTOR`를 반환하지 않았다. 기존 seq539/542와 동일한 fail-closed ancestry 검사를 추가했다.
- 각 제품/contract fingerprint 반복은 1회이며 수정 후 focused 및 전체 tooling 재검증 대상으로 둔다.

### seq548 동일 fixture 오류 3회 및 Main takeover

- deploy Git Bash 전체 재검증은 `101 passed, 2 skipped, 2 failed in 898.48s`였다. 두 실패는 제품 런타임이 아니라 Windows fixture의 fake `stat`가 `.env` mode를 전달하지 못해 보안 게이트에서 선행 중단한 동일 fingerprint `BASH_ENV_MODE_SHIM_R1`이다.
- 동일 fingerprint는 전체 실행 1회, focused 재현 1회, `echo 600`을 `printf 600`으로 바꾼 뒤 focused 재검증 1회로 총 3회 반복됐다. 프로젝트 규칙에 따라 Developer Subagent는 추가 수정을 중단하고 `FAILURE_REPORT`와 write lease를 Main Agent에 반환했다.
- Main Agent가 writer를 인수했다. 원인은 외부 명령 PATH에 의존한 fake executable이 Git Bash/Windows 경계에서 안정적으로 선택되지 않은 fixture 설계다. 제품 `common.sh`의 mode 검사는 정상적으로 fail-closed했다.
- 조치: 해당 두 테스트의 격리된 control checkout에만 `stat()` shell function을 주입해 POSIX mode 결과를 결정적으로 고정한다. 제품 파일과 실제 WSL 권한 검사는 변경하지 않는다.
- 인수 시 검증 기준: API `8 passed`, tooling `197 passed in 829.99s`, live checker `PASS sequence=548`; deploy 2건은 수정 후 focused 및 전체 재검증이 필요하다.
- commit, push, WSL/Docker/DB, Provider, Telegram, ysna, main은 인수 시점까지 `NOT_EXECUTED`다.
- Main 수정 후 동일 두 테스트는 Git Bash 고정 환경에서 `2 passed in 28.11s`, exit 0이다. `BASH_ENV_MODE_SHIM_R1`은 제품 우회 없이 격리 fixture의 shell function으로 해소됐다.
- final exact17 재결박 후 live checker는 `PASS sequence=548`, 영향 집중 회귀는 `4 passed, 306 deselected in 30.35s`, `git diff --check`는 PASS였다.
- 동일 final diff의 API 전체 검증은 `8 passed in 1.66s`, exit 0이다.
- 동일 final diff의 deploy 전체 검증은 Git Bash 고정 환경에서 `103 passed, 2 skipped in 1224.87s`, exit 0이다. skip 2건은 Windows/NTFS가 POSIX 0600/0400 mode를 표현하지 못하는 항목과 WSL 전용 Compose parser 항목이며 실제 WSL PASS로 승격하지 않는다.
- 동일 final diff의 tooling 전체 검증은 `197 passed in 961.27s`, exit 0이다.
- Reviewer 1차 판정의 Important 1건은 전체 결과가 아직 문서·projection에 결박되지 않았다는 증거 정합성 항목이었다. 위 결과를 WORK_STATUS·validation·report에 기록하고 P/E/H/D/M을 다시 생성한 뒤 재검토한다.
- 다음 조치: final evidence 재결박, live checker·exact17/누적 exact131/history byte 재확인, Reviewer 재검토 후 direct-child commit 준비다.

## 2026-09-07 seq549~554 WSL rollback scope compatibility 시작 및 시스템 승인 대기

- 담당 Agent: `developer-primary` (`developer_seq554_rollback_scope`). 기준선은 clean `dfd75904e3b6ba0f453965607a95d6020bdc4466`이며 write lease는 승인된 exact16에만 한정했다.
- TDD RED: `python -m pytest tests/deploy/test_wsl_staging_harness.py -q -k seq554`는 `3 failed, 105 deselected`였다. fingerprint `C21_WSL_ROLLBACK_SCOPE_COMPAT_R1_RED` 1회이며, 누락된 commit별 scope map, all-target preflight, process-local scope override를 각각 재현한다.
- 현재 변경 파일은 `tests/deploy/test_wsl_staging_harness.py`, `docs/WORK_STATUS.md`뿐이다. manifest·rollback·guard 구현은 적용되지 않았다.
- 시스템 안전 게이트는 `deploy/wsl/CandidateReleaseManifest.json`, `deploy/wsl/rollback.sh`, `deploy/wsl/candidate-manifest-guard.sh`의 rollback permission-scope·계보 계약 변경에 대해 신산님의 직접적인 `seq549~554 C21_WSL_ROLLBACK_SCOPE_COMPAT_R1 구현 승인`을 요구하며 패치를 거부했다. 거부 횟수 1회이며 우회·간접 적용·재시도하지 않았다.
- 승인되어야 할 정확한 범위: candidate/observed/previous commit별 session scope map 결박, 두 PostgreSQL target의 previous·scope·image·Compose render를 mutation 전에 모두 검사, target별 process-local scope override, health 성공 후 marker/receipt 기록, `.env` byte·mode 불변, exact16 direct-child 및 누적 exact137 guard/checker·seq549~554 projection 구현이다.
- 현재 WSL 사실: PG15·PG18RC verify receipt는 PASS다. 최초 rollback 시도는 PG15 old image unhealthy에서 중단되어 current marker는 candidate `a6dca0d`를 유지했고 PG18RC는 candidate healthy이며 mutation은 시작하지 않았다. 이후 표준 redeploy로 두 target 모두 candidate `a6dca0d` healthy 상태로 복구되었고 `.env` byte·mode는 불변이다.
- Provider·Telegram은 `NOT_EXECUTED`; push·ysna·main merge도 이 Subagent 범위에서 `NOT_EXECUTED`다.
- 상태: `INCOMPLETE_WAITING_SYSTEM_EXECUTION_APPROVAL`. 제품 파일 추가 수정 없이 write lease를 반환한다. 정확한 승인 후 동일 기준선에서 RED를 유지한 채 구현을 재개한다.

### seq554 직접 승인 후 제품 구현 및 projection 별도 승인 대기

- 신산님의 직접 승인에 따라 Manifest commit별 scope map, guard 검증, rollback all-target preflight와 process-local scope override를 구현했다.
- focused GREEN: `python -m pytest tests/deploy/test_wsl_staging_harness.py -q -k seq554`는 `3 passed, 105 deselected`; `bash -n deploy/wsl/rollback.sh`, `bash -n deploy/wsl/candidate-manifest-guard.sh`, `git diff --check`도 PASS다.
- 현재 dirty exact 경로는 9개다: 제품 3개, TDD 1개, `WORK_STATUS` 1개, report/validation/WI/prompt 4개. P/E/H/D/M projection과 tooling test는 아직 생성하지 않았다.
- 시스템 안전 게이트는 seq549~554 이벤트·progress·handoff·manifest projection 및 checker lineage/hash/lease predicate 추가가 scope map·guard·rollback 구현 승인보다 넓은 지속적 무결성 게이트 변경이라고 판정해 1회 거부했다. 요구되는 정확한 추가 승인 범위는 `seq549~554 append-only projection 생성과 exact16/direct-child/cumulative exact137 checker 및 계약 테스트 변경`이다.
- 거부 전에 추가했던 미완성 checker routing 2곳은 즉시 원복했다. 현재 `scripts/check_project_progress.py`는 clean이며 정의되지 않은 seq554 함수 참조가 없다.
- 장시간 full test는 시작하지 않았다. Provider·Telegram·WSL runtime·push·ysna·main merge는 계속 `NOT_EXECUTED`다.
- 상태: `INCOMPLETE_WAITING_PROJECTION_GATE_APPROVAL`. 추가 mutation 없이 write lease를 반환한다.

### seq554 projection 재개 시 해시 및 historical 결박 보완

- 추가 직접 승인 후 seq549~554 pure builder/checker를 구현했다.
- focused tooling 최초 실행은 `2 failed, 197 deselected`였다.
- `C21_SEQ554_DECLARED_PATH_HASH_MISMATCH_R1` 1회: architect 전달값 `203A...`/`79C7...`은 승인된 exact16 목록에서 재현되지 않았다. Main 판정에 따라 실제 PowerShell `Sort-Object` + UTF-8 LF 재계산값 direct `27647FE5BBE135FAB147A635D75BF93B7A4EC03E26BA00C2C709402EFB80B841`, cumulative `71F5E29A6F2AFA16219059D9417415DE3F62A515D7145728F21363EFCB4B42FC`를 정본으로 사용한다.
- `C21_SEQ554_HISTORY_HASH_UNBOUND_R1` 1회: pure builder가 전달받은 historical prefix 내부 변조를 parent blob hash와 대조하지 않았다. `dfd75904`의 P/E/H exact byte hash를 선행 검사하도록 보완했다.
- 두 fingerprint 모두 1회이며 동일 오류 3회 조건에 해당하지 않는다.
- materialize 후 live checker 최초 실행은 `EVENT_EFFECT_MISMATCH`, `HANDOFF_BASELINE_MISMATCH`, `HANDOFF_DIR_STATUS_MISMATCH`, `HANDOFF_FAILURE_COUNT_MISMATCH`였다. fingerprint `C21_SEQ554_GENERIC_PROJECTION_FIELDS_R1` 1회이며, seq554 event에 parent remote projection을, HANDOFF에 source baseline·DIR·failure count를 누락한 원인이다. source 정본 값을 추가하고 재materialize한다.
- 두 번째 live checker는 `EVENT_EFFECT_MISMATCH` 1건만 남았다. fingerprint `C21_SEQ554_EVENT_EXACT_ALLOWED_PATHS_R1` 1회이며, event detail의 cumulative 목록에 generic reducer가 요구하는 `exact_allowed_paths` alias가 빠진 원인이다. 동일 cumulative exact137을 alias로 추가한다.
- alias 추가·재materialize 후 live checker는 `G-05 project progress contract: PASS sequence=554 reporting=AUTO_CONTINUE`이다.
- 기존 rollback allowlist fixture 재검증은 Windows `bash.exe` 경계에서 Python `subprocess(env=...)` 값이 전달되지 않아 `/srv/anvil-wsl` 기본값을 사용하며 1회 실패했다. fingerprint `C21_SEQ554_WSLENV_FIXTURE_FORWARDING_R1` 1회다. 제품이 아니라 fixture 호출 경계이므로 승인된 격리 경로 값을 Bash command에 inline으로 전달한다.
- fixture inline 전달 후 candidate scope mismatch가 2회 재현됐다. fingerprint `C21_SEQ554_WINDOWS_PYTHON_CRLF_POLICY_ROWS_R1` 2회이며, Windows Python의 stdout CRLF가 Bash policy row 끝에 남은 것이 원인이다. 실제 WSL과 같은 `python3`를 fixture parser에 사용해 해소했고 approved rollback fixture는 PASS다. 같은 오류 3회 조건에는 도달하지 않았다.

### seq554 full regression 환경 오류 3회 및 Main takeover 반환

- full deploy/tooling을 병렬 시작했으나 `where.exe bash` 결과 첫 실행 파일이 `C:\Users\cyhuh\AppData\Local\Microsoft\WindowsApps\bash.exe`였고 Git Bash는 두 번째 `C:\Program Files\Git\usr\bin\bash.exe`였다.
- 실행 중 deploy에 다수 공통 실패가 나타나 두 pytest를 Ctrl-C로 중단했다. 결과는 `INTERRUPTED_NOT_COUNTED`이며 PASS/FAIL 증거로 승격하지 않는다.
- fingerprint `BASH_D_DRIVE_MOUNT_UNAVAILABLE_R1`은 기존 seq548 기록의 2회에 이번 잘못된 WSL bash 선택 1회를 합쳐 총 3회다.
- 프로젝트 규칙에 따라 Developer Subagent는 추가 재실행·수정을 중단한다. Main Agent가 이 호스트에 실제 존재하는 `C:\Program Files\Git\usr\bin`을 PATH 선두로 고정해 deploy → tooling을 직렬 재검증한다.
- 반환 시 상태: exact16 16/16 생성, seq1~548 historical hash 결박, focused rollback `12 passed`, focused tooling `2 passed`, shell syntax PASS, live checker는 마지막 materialize 시 `PASS sequence=554`였다. 이 WORK_STATUS 추가로 P/E/H/D/M은 재materialize가 필요하다.
- Provider·Telegram·WSL runtime·Docker·DB·push·ysna·main은 `NOT_EXECUTED`다.

### seq554 Main takeover 재개

- Main 실측 `where.exe bash`는 WindowsApps WSL bash가 1순위, `C:\Program Files\Git\usr\bin\bash.exe`가 2순위였으며 `C:\Program Files\Git\bin\bash.exe`는 이 호스트에 없다.
- Main은 검증 프로세스의 PATH 선두를 `C:\Program Files\Git\usr\bin`으로 고정한다. 이 변경은 제품 코드가 아니라 검증 실행기 선택 정정이다.
- 이 기록을 포함한 final exact16 raw 파일로 P/E/H/D/M을 재생성한 뒤 live checker와 focused 검증을 먼저 실행한다.
- Main 재결박 후 live checker `PASS sequence=554`, seq554 focused deploy `3 passed`, focused tooling `2 passed`, rollback/guard `bash -n` 및 diff-check PASS였다.
- Git Bash 고정 전체 deploy 1차는 `104 passed, 2 skipped, 2 failed in 906.19s`였다. 실패는 서로 다른 fixture root다.
  - `C21_SEQ554_HISTORICAL_ROLLBACK_MANIFEST_DRIFT_R1` 1회: historical seq494 guard fixture가 current seq554 rollback parser를 혼합해 scope map이 없는 과거 manifest를 malformed로 거부했다. 해당 테스트는 parent `dfd7590` rollback blob으로 고정하고 새 scope 계약은 seq554 전용 테스트가 검증한다.
  - `C21_SEQ554_ROLLBACK_UNIT_POSIX_MAPPING_R1` 1회: 새 rollback allowlist unit의 `_posix`가 WSL 전용 `/mnt/d`를 고정해 Git Bash에서 script exit127이 발생했다. 공통 Windows fixture 방식대로 `cygpath`를 우선하고 fallback을 `/d`로 수정한다.
- 두 실패는 제품 runtime 실패가 아니며 각각 1회다. 수정 후 두 테스트 focused PASS와 전체 deploy 재검증이 필요하다.
- 두 fixture 수정 후 focused 재검증은 historical fixture PASS, rollback allowlist unit FAIL이었다. 남은 오류는 `C21_SEQ554_WINDOWS_PYTHON_CRLF_POLICY_ROWS_R1`이며 이전 Developer 기록 2회에 이번 Main focused 1회를 합쳐 총 3회다.
- Main takeover 규칙에 따라 policy row transport에서 Windows Python의 CRLF 끝 `\r`만 제거한다. JSON 내부 scope whitespace·중복·순서 검증은 Python parser에서 이미 선행하므로 manifest 정책을 완화하지 않는다. 실제 WSL LF 출력과 `.env`는 변경하지 않는다.
- CRLF transport 보완 후 historical rollback+allowlist focused는 `10 passed in 22.27s`, live checker·rollback `bash -n`·diff-check는 PASS였다.
- 동일 final diff의 Git Bash 고정 전체 deploy 계약은 `106 passed, 2 skipped in 888.04s`, exit 0이다. skip 2건은 Windows/NTFS POSIX mode와 WSL Compose parser 전용 항목이며 실제 WSL rollback PASS로 승격하지 않는다.
- 동일 final diff의 전체 tooling 계약은 `199 passed in 916.77s`, exit 0이다.
- 다음 조치: final 결과를 validation/report에 기록하고 P/E/H/D/M을 재결박한 뒤 exact16/누적 exact137/history/direct-child 계약과 독립 review를 확인한다.

## 2026-09-07 C-21 WSL cleanup guard source R1 — 플랫폼 안전 게이트 BLOCKED

- 기준: branch `codex/c21-operational-execution`, HEAD `797b4d831e384423fdd9a706f9512ffa9dc79bb5`, parent `dfd75904e3b6ba0f453965607a95d6020bdc4466`; 시작 시 clean.
- TDD RED: 실제 `candidate-manifest-guard.sh`를 `cleanup_wsl_test_volumes` 진입 전 1회 source한 뒤 현재 `common.sh`가 다시 source하여 `readonly variable`로 Docker inventory 전에 종료하는 것을 `cleanup_sources_guard_once_then_reaches_inventory`로 재현했다. GREEN 중간 변경은 `common.sh`의 중복 source 1줄 제거와 common-only fixture의 historical guard 명시 source다.
- 현재 dirty 중간 경로: `deploy/wsl/common.sh`, `tests/deploy/test_wsl_staging_harness.py`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`. guard/checker/projection의 최종 구현, 생성 문서, commit은 미수행이다.
- 플랫폼 거부: `C21_WSL_CLEANUP_GUARD_SOURCE_R1_PLATFORM_GUARD_SCOPE_REJECTED` 1회. `candidate-manifest-guard.sh`의 `797b4d8` direct-child exact15 및 base `eef3496` cumulative exact143 결박 변경을 지속적 보안·무결성 통제 변경으로 판정해 명시적 사용자 승인을 요구했다. 우회·간접 적용은 금지됐다.
- resource mutation=0. Provider, Telegram, WSL, Docker, DB, ysna, main, push, cleanup retry는 모두 `NOT_EXECUTED`.
- 필요한 정확한 승인 범위: `deploy/wsl/candidate-manifest-guard.sh`의 source parent `797b4d8` single-direct-child exact15와 cumulative exact143 결박, 그에 종속한 seq555~560 append-only checker/projection/evidence 문서 생성 및 direct-child commit 검증.
- 다음 조치: 신산님의 위 guard/projection 범위 직접 승인 후에만 existing TDD GREEN을 재개하고 validation 2회·inventory 도달·allowlist cleanup/mutation0 실패 경로를 검증한다.

### reviewer fix round 1

- Reviewer `REWORK C0/I2/M2`를 반영 중이다. I1/I2 RED는 status 수집 오류가 generic collection error로 귀결되는 것을 재현했고, collector에 private development URL/control/candidate CAS 및 named status/base-ancestry fail-closed 계약을 추가했다.
- external runtime actions remain `NOT_EXECUTED`; resource mutation remains `0`.

#### reviewer fix round 1 focused 및 first full tooling

- I1/I2 focused tooling은 development private URL/control/candidate CAS, exact `GIT_STATUS_COLLECTION_FAILED`, declared-base ancestry fail-closed와 seq554 immutable `797b4d8` blob fixture 2곳을 포함해 `4 passed, 198 deselected`, exit0이다.
- real cleanup focused는 실제 `cleanup.sh` entrypoint와 real readonly guard를 사용한다. success=`source1/validate2/env1/inventory reached`, first validation failure=`validate1/env0/inventory0/mutation0`, second validation failure=`validate2/env1/inventory0/mutation0`; duplicate real guard source는 readonly 재선언을 실제 재현하고 inventory/mutation0이다. 결과 `4 passed, 109 deselected`, exit0.
- Reviewer 전달 full deploy는 `107 passed, 2 skipped`, exit0이고, pre-fix full tooling은 `198 passed, 2 failed`, exit1이다. 서로 다른 시점의 증거이며 실패를 PASS로 승격하지 않는다.
- fix-round first full tooling은 `199 passed, 3 failed in 632.58s`, exit1이다. 3건 모두 amend 전 committed successor에 reviewer-fix dirty가 남아 발생한 동일 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`; 코드/계약 테스트 실패가 아니라 postcommit 조건 미충족이며 최종 amend 후 전체 tooling을 재실행한다.
- full deploy는 이 round에서 제품 `cleanup.sh`/`common.sh`/guard bytes가 변경되지 않고 checker/test/evidence만 변경됐으므로 재실행하지 않았다. 변경된 cleanup test는 위 real-entrypoint focused로 실행했다.
- Bash syntax와 Python compile은 PASS. amend 전 live checker는 정확히 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`; 최종 amend 전 PASS로 기록하지 않는다. 외부 WSL/Docker/DB/Provider/Telegram/ysna/main/push/cleanup retry는 계속 `NOT_EXECUTED`, resource mutation=0이다.

#### reviewer fix round 1 clean postcommit full tooling

- first amend `9ccc4104988bebdc61da7cb68b42fba502d3b3ff`는 parent `797b4d831e384423fdd9a706f9512ffa9dc79bb5`의 single direct child였고, clean 상태 live checker는 `G-05 project progress contract: PASS sequence=560 reporting=AUTO_CONTINUE`였다.
- 같은 clean postcommit에서 full tooling은 `202 passed in 637.37s`, exit0이다. 이 결과를 final exact15 evidence에 append하고 P/E/H/D/M을 재materialize한 뒤 최종 amend/postcommit checker와 focused 검증을 다시 수행한다.
- 외부 WSL/Docker/DB/Provider/Telegram/ysna/main/push/cleanup retry는 `NOT_EXECUTED`; resource mutation=0을 유지한다.

#### reviewer fix round 1 TDD 및 환경 오류 원장

- `C21_SEQ560_REAL_ENTRYPOINT_REGRESSION_RED` 1회: 새 3개 test는 helper 부재로 `3 failed, 109 deselected`, exit1을 먼저 확인했다. helper 구현 후 real guard/Git을 유지하고 runtime state/image·Docker/stat만 fixture adapter로 격리했다.
- `C21_SEQ560_ENV_WRAPPER_CRLF_R1` 2회: environment-load 횟수를 `declare -f | sed | eval` wrapper로 관찰한 fixture가 MSYS 함수 재구성 경계에서 CR을 유입해 각 `2 failed, 1 passed`, exit1이었다. 실제 loader baseline test는 같은 환경에서 `1 passed`; loader를 감싸지 않고 real loader의 단일 `stat` 호출에서 횟수를 관찰하도록 바꿔 해소했다. 제품 실패가 아니다.
- `C21_SEQ560_DUPLICATE_SOURCE_REGRESSION_RED` 1회: duplicate-source option 부재로 `1 failed`, exit1을 먼저 확인했다. option 구현 후 첫 실행은 실제 historical 순서 `guard source1 → validation1 → env load1 → guard source2 readonly failure`를 보여 assertion 1건이 실패했다. 관찰된 실제 순서로 기대를 교정한 뒤 GREEN이다.
- `C21_SEQ560_DTMP_SANDBOX_MKDTEMP_BLOCKED` 3회: managed sandbox 안에서 `D:\tmp` `tempfile.mkdtemp`가 멈췄고 faulthandler가 정확히 `tempfile.py:mkdtemp`를 지목했다. 이 플랫폼 실행 오류는 정식 제품 failure가 아니며, 승인된 격리 test 실행으로 전환해 해소했다. 중단된 자체 pytest process tree 2개는 종료했고 외부 runtime/resource mutation은 없었다.
- 유효 제품 실패 횟수는 증가하지 않았고 동일 제품 근본 원인 3회 조건은 발생하지 않았다.

## 2026-09-07 seq560 private push 확인 및 WSL 표준 cleanup 실행 승인 대기

- private authority `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 실제 refs는 control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`로 exact 일치한다. candidate는 불변이며 seq560 control private push도 확인됐다.
- WSL exact preflight는 hostname `SINSAN`, user `daon`, `sudo -n` 가능, root `/srv/anvil-wsl`을 확인했다. application repo는 private origin, clean detached HEAD `a6dca0da5a37e64491e91813895268e78ecb78b2`; local runtime refs는 control `797b4d831e384423fdd9a706f9512ffa9dc79bb5`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`였다. active control pointer는 `stage.3012955.4746`, clean HEAD `797b4d831e384423fdd9a706f9512ffa9dc79bb5`였다.
- `/srv/anvil-wsl/.env`는 SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, mode `0600`, owner `root:root`이며 값은 출력하지 않았다. pg15/pg18rc 모두 `current=previous=324eb169fedbce958d2e8cc29362deb7af433677`였다.
- target inventory는 정확히 container 6개(`1dcc08a82fb4`, `9afd95477687`, `fe74e316c36e`, `e8773a61f46e`, `aaac7fe7e54e`, `4cf00905c058`), project network 4개(`f2043a36c089`, `3bf6a1359388`, `fba29146f52b`, `130e79264d48`), exact volume 2개(`anvil-wsl-pg15_anvil-db-data`, `anvil-wsl-pg18rc_anvil-db-data`)다. Compose project/service 및 `WSL_SERVER_TEST_STAGING`/`C21_WSL_ISOLATED_TEST` labels가 허용 계약과 일치했고 두 ready endpoint는 migration head `0013_task_bootstrap_authority`로 ready였다. web image revision은 두 target 모두 `324eb169fedbce958d2e8cc29362deb7af433677`; rollback/verify/pre-migration receipts와 backup evidence 존재를 확인했다.
- mutation 전 unrelated inventory 기준은 container `73`개 / SHA-256 `ac52390889e31eb3e832e5b77ae89e6bbaa8bd8aaaf6e852983f84e8ce9f45c5`, network `26`개 / SHA-256 `105faf480afdec45c4a15dea785bbaa6765c9102cc6e1f51b42d7892b8eb5437`, volume `498`개 / SHA-256 `9d1a7e1bba0f752e1fd9fa696aedd034e226ba662fbdd40e85354ecef39afa69`다. target hash는 container `7dc4375c47d35fbb923bc6cb8ab25dbf7629884b3ce467b07be28aa069df7be4`, network `70e8a0323d6d205949b630af9d53fe0aa2ab7d141886a002b7dea8a6ab068ab3`, volume `d0ae7dc77672af341bf5e4566c0c17273139a71f10d4f1e3cf1e4e5ed717ca79`였다.
- immutable `b2ba821` Git blob bytes의 manifest SHA-256은 `4fedf2ccc05d309099363e336df8107c479f51124f62e98b3bffacdc9f44442a`, cleanup script SHA-256은 `65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d`로 계산했다. active `797b4d8`와 `b2ba821`의 `control-runtime.sh` blob은 동일 `2e0dcb8a20d42488a5f628e573c8b4f0d7547a4e`다.
- 플랫폼 cleanup 실행 거부는 `C21_SEQ560_WSL_CLEANUP_DESTRUCTIVE_APPROVAL_REJECTED` 1회다. private refs fetch + standard control stage publication + 표준 `cleanup.sh` 1회 요청을 정확한 Docker 삭제 범위로 escalation했으나 직접 사용자 삭제 승인이 확인되지 않는다는 이유로 `CreateProcess` 전에 거부됐다. 우회·분할·수동 Docker 삭제·재시도하지 않았다.
- 거부가 process 시작 전이므로 application fetch `0`, control stage publication `0`, `cleanup.sh` invocation `0`, Docker mutation `0`이다. 재조회 결과 application/control/.env/markers와 target container `6`·network `4`·volume `2`는 모두 preflight 상태 그대로다. 이 거부는 제품 failure count에 포함하지 않는다.
- 필요한 직접 승인 문구: `WSL SINSAN의 anvil-wsl-pg15/anvil-wsl-pg18rc containers와 네 개의 해당 project networks 및 exact volumes anvil-wsl-pg15_anvil-db-data, anvil-wsl-pg18rc_anvil-db-data를 표준 cleanup.sh 1회로 삭제하고, b2ba821 control stage publication과 application private refs fetch를 허용한다.`
- 다음 조치: 위 직접 승인 후 동일 read-only CAS preflight를 다시 통과한 경우에만 immutable manifest/control checksum을 고정하여 표준 Git-only control stage publication과 `cleanup.sh`를 정확히 1회 실행한다. 이후 target containers/networks `0`, exact volumes absent, unrelated inventory hash 불변, `.env` hash/mode 불변, application clean detached candidate, active/published control `b2ba821`, receipts/evidence 보존을 검증한다. Provider·Telegram·ysna·main·별도 DB 조작은 계속 금지한다.

## 2026-09-07 C-21 WSL cleanup runtime result seq561~566 기록

- 담당: `developer-primary` (`developer_seq566_cleanup_result`); parent/control `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`; exact12 append-only writer lease.
- Windows `Sort-Object` 재계산은 exact12 `54DE92EBEC20A6897379A2B14FBBA258517A0E6A52A221C6217739B40FA9E0EF`, cumulative149 `F804F93F8F8BE351071EB0CC3674A4EB442BF8D0E74DFF0D65FAD88AD1DE85F2`; ordinal 재계산은 exact12 `63E7070C7D5D018F76DE04A0369B5778F3B58AF2798EA2EC78ED3CFB75645CA0`, cumulative149 `B956DA56B0D6BD17D0918878F1E3F80E672FAE971CEE3E4793A1CE227E0C47C8`로 전달값과 일치했다.
- TDD RED `C21_SEQ566_RUNTIME_RESULT_BUILDER_MISSING_R1` 1회: 신규 builder/validator/collector가 없어 focused tooling `4 failed, 202 deselected`, exit `1`을 확인했다. 이는 예상된 기능 부재이며 제품 runtime failure count를 증가시키지 않는다.
- runtime 사실: cleanup invocation `1`, internal exit `0`, outer wrapper exit `1`; wrapper failure `POST_CLEANUP_UNRELATED_INVENTORY_EQUALITY_ASSERTION`은 cleanup 실패가 아니다. target containers `6→0`, networks `4→0`, exact volumes `2→0`; unrelated global equality false지만 pre-existing missing/changed는 `0/0`이고 차이는 concurrent Daon2/eoul additions or replacements뿐이다.
- application은 clean detached candidate/private origin, control은 active `stage.3558037.6302` clean `b2ba821`/private origin이다. `.env` SHA-256 `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, size443, mode0600, root:root 불변; PG15/PG18RC marker current=previous=`324eb169fedbce958d2e8cc29362deb7af433677`; receipts/evidence hashes와 counts 보존이다.
- 이전 preapproval denial은 process-not-created/mutation0이다. distro-selection과 post-verify `ENV_STAT` quoting damage(exit127, containing block exit0)는 observation error이며 valid failure count는 기존 `2`를 유지한다.
- `PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`은 핵심 require-escalated wrapper와 cleanup env/argv 전문이 유실되어 정확히 재구성할 수 없는 증거 한계다. Reviewer Minor를 `OPEN / UNRESOLVED_EVIDENCE_DETAIL`로 유지하고 결과/hash/exit 보존을 별도 기록한다.
- 정확한 runtime observed timestamp도 보존되지 않았다. `runtime_observed_at_status=UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`, `runtime_observed_at=null`, `runtime_observed_date=2026-09-07`로 기록한다. `recorded_at=2026-09-07T04:00:51.7574180Z`는 materialize 시작 시 로컬 UTC clock을 1회 측정한 값이며 source는 `LOCAL_CLOCK_AT_APPEND_ONLY_RECORDING`이다. 분 단위 실제 cleanup 시각 증거가 남지 않은 비용을 명시한다.
- Provider/Telegram/separate DB/ysna/main은 `NOT_EXECUTED`; `volume_cleanup=EXECUTED_APPROVED`. 이 result package에서 새 WSL/Docker/DB 외부 실행이나 push는 하지 않는다.
- 상태 목표: `READY_FOR_C21_WSL_ACCEPTANCE`, accepted=false, tester `PENDING`, C-01 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2 `NOT_TRIGGERED`, next `INDEPENDENT_C21_WSL_ACCEPTANCE_REVIEW`.

### seq566 Developer 검증 결과

- 초기 RED는 `4 failed, 202 deselected`, exit1; 구현 후 focused GREEN은 `5 passed, 202 deselected`, exit0이다.
- runtime result materialize 후 live checker는 `PASS sequence=566 reporting=AUTO_CONTINUE`; `git diff --check`도 exit0이다.
- 첫 `py_compile`은 managed sandbox가 `scripts/__pycache__` write를 거부해 exit1이었다. 이는 source syntax 실패가 아니며, 파일을 생성하지 않는 direct in-memory compile은 두 변경 Python 파일 모두 PASS/exit0이다.
- 첫 sandbox full tooling은 34% 이후 기존 `D:\tmp tempfile.mkdtemp` stall을 재현해 Ctrl-C로 중단했다. `INTERRUPTED_NOT_COUNTED`이며 PASS 또는 제품 FAIL로 계상하지 않는다. 동일 명령의 승인된 격리 실행은 `207 passed in 1029.51s (0:17:09)`, exit0이다.
- 제품/deploy/guard bytes는 parent `b2ba821`과 동일하므로 deploy full은 재실행하지 않는다. 최종 evidence append 뒤 파생 P/E/H/D/M 재결박과 focused/live/diff/compile만 fresh 재검증한다.
- 첫 result-evidence append와 deterministic 재결박 뒤 precommit focused는 다시 `5 passed, 202 deselected`, live checker sequence566 PASS, diff-check PASS, direct compile PASS다.
- `C21_SEQ566_EVENT_REMOTE_PROJECTION_MISSING_R1` 1회: 최초 live checker의 `EVENT_EFFECT_MISMATCH`는 seq566 완료 Event에 source remote-head projection이 빠진 원인이며 `dispatch_upstream_head`를 immutable source 값으로 추가해 해소했다.
- `C21_SEQ566_PYCOMPILE_CACHE_PERMISSION_R1` 1회와 `C21_SEQ566_SANDBOX_MKDTEMP_STALL_R1` 1회는 각각 pycache write 권한과 알려진 sandbox temp 생성 정지의 환경 오류다. 정식 제품 failure count는 기존 `2`로 유지한다.

## 2026-09-07 C-21 WSL acceptance strict successor seq567~572

- 담당: `developer-primary` (`developer_seq572_wsl_acceptance_strict`); WorkInstruction `WI-C-21-WSL-ACCEPTANCE-STRICT-SUCCESSOR-20260907-001`; parent `bcaeeacd1618461127c2387504e2535a0d54504f`, private control expected `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`, candidate `a6dca0da5a37e64491e91813895268e78ecb78b2`; exact12 append-only writer lease.
- 독립 Tester source는 파일이 아닌 `INDEPENDENT_TESTER_AGENT_REPORT`이며 repository artifact는 `ABSENT`다. 판정 `ACCEPTED_WITH_LIMITATION — C-21 WSL 선행검증 범위에 한정`, findings `C0/I0/M2`를 원문 경계대로 기록한다.
- machine 목표: `acceptance_scope=C21_WSL`, `wsl_acceptance_status=ACCEPTED_WITH_LIMITATION`, `accepted=false`, `c21_acceptance_status=BLOCKED_NOT_ACCEPTED`, C-01 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2 `NOT_TRIGGERED`.
- 열린 limitation: primary wrapper/env/argv fulltext 미보존, exact runtime timestamp null/unavailable, receipt originals/paths 미독립 확인, same-origin HTTP ingress만 확인하고 실제 browser Network 미검증.
- 비승인/미검증: 실제 Provider, Telegram, browser acceptance, ysna, main, C-01 start, push, 외부 실행. 다음은 계획에 따른 사용자 소유의 실제 Provider/Telegram 검증과 실제 브라우저 인수다.
- TDD RED `C21_SEQ566_JSON_SCALAR_TYPE_CONFUSION_R1` 1회: runtime public validator가 `invocation_count=True`, `internal_exit_code=False`, `outer_wrapper_exit_code=1.0`을 정상 정수와 동일하게 비교해 `1 failed`, exit1. 공용 parser/canonical JSON을 바꾸지 않고 C-21 전용 recursive strict comparator로 보완했다.
- TDD RED `C21_SEQ572_STRICT_SUCCESSOR_MISSING_R1` 1회: seq572 builder/validator/collector/routing 부재를 신규 class 6개 test에서 `1 failure, 5 errors`, exit1로 확인했다. 이는 예상된 기능 부재이고 valid product failure count를 증가시키지 않는다.
- 환경 오류 `C21_SEQ572_PYTHON_LAUNCHER_ENV_R1` 3회: `python` 명령 부재, `py -3` 설치 Python 부재, `uv` cache 초기화 access denied였다. 제품 실패가 아니며 bundled workspace Python으로 전환해 TDD RED를 정상 실행했다.
- exact12 Windows/ordinal 재계산은 `9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F` / `495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536`; cumulative155는 `4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C` / `2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D`로 전달값과 일치했다.
- 현재 단계: raw7 작성 완료, seq572 P/E/H/D/M deterministic materialize 및 focused GREEN 전. 제품/deploy/guard bytes는 수정하지 않았다.

### seq572 Developer 검증 결과

- 최초 materialize 후 focused는 `11 passed, 1 failed`, exit1이었다. `C21_SEQ572_EVENT_CONTRACT_FIELDS_R1` 1회로, generic Event 계약이 completion top-level `accepted` 누락을 `EVENT_PAYLOAD_MISSING`, repository projection의 `dispatch_upstream_head` 누락을 `EVENT_EFFECT_MISMATCH`로 검출했다. seq566과 같은 두 필드만 보완해 해소했으며 제품 runtime failure가 아니다.
- 재materialize 후 focused seq566+seq572 public-path tests는 `12 tests in 14.525s`, `OK`, exit0이다.
- live checker 첫 호출은 잘못된 `--root .` 인수 때문에 `--root`를 directory로 해석해 LOAD_ERROR를 냈다. `C21_SEQ572_LIVE_CHECKER_ARGV_R1` 1회 명령 사용 오류이며, 지원되는 positional `.` 호출은 `G-05 project progress contract: PASS sequence=572 reporting=AUTO_CONTINUE`, exit0이다.
- `git diff --check` exit0, 두 Python 파일 direct in-memory compile PASS/exit0, dirty 경로 exact12 일치다.
- 승인된 격리 실행의 full tooling은 `214 tests in 667.571s`, `OK`, exit0이다. 제품/deploy/guard bytes는 parent와 동일하므로 deploy full은 실행하지 않았다.
- 다음: 이 결과가 포함된 raw7로 P/E/H/D/M 최종 재materialize → fresh focused/live/diff/compile → exact12 단일 direct-child commit → clean postcommit checker. push/external execution은 계속 금지한다.

### seq566 public projection 직접 RED 보강

- 완료 전 자체 검토에서 최초 seq566 projection assertion이 current seq572 raw mismatch로도 만족될 수 있음을 발견했다. immutable `bcaeeacd` seq566 artifacts를 synthetic generated-file view로 제공하도록 테스트를 교체했다.
- `C21_SEQ566_PROJECTION_FLOAT_TYPE_CONFUSION_R1` 1회: direct projection에 `event_sequence=566.0`을 넣었을 때 빈 오류 목록을 반환해 `1 failed`, exit1을 정확히 확인했다. supplied progress/events/digest/manifest 비교를 C-21 strict helper에 직접 연결한 뒤 해당 테스트 PASS다.
- 이 테스트/코드 변경으로 앞선 full tooling 결과는 역사 증거로만 유지하고 final raw7 재materialize 뒤 focused 및 full tooling을 다시 실행한다.

### seq572 final full tooling 및 evidence 결박

- direct seq566 projection strict 보강 후 pre-evidence focused는 `12 tests in 18.705s`, `OK`, live checker sequence572 PASS, diff-check PASS다.
- `C21_SEQ572_PYCOMPILE_CACHE_PERMISSION_R1` 1회: `py_compile`이 managed sandbox의 `scripts/__pycache__` 쓰기를 거부해 exit1이었다. source syntax failure가 아니며 파일 생성 없는 direct `compile()`은 두 변경 Python 파일 모두 PASS/exit0이다.
- 승인된 격리 final full tooling은 `214 tests in 680.535s`, `OK`, exit0이다. trace/failure는 없었다.
- 이 결과를 raw7에 기록하고 P/E/H/D/M을 deterministic 재materialize한 뒤 fresh focused/live/diff/compile, exact path/hash/status 검증, exact12 direct-child commit과 clean postcommit checker를 수행한다.
- final full 결과를 반영한 첫 재materialize 뒤 focused는 `12 tests in 16.375s`, `OK`, live checker sequence572 PASS, diff-check PASS, direct `compile()` PASS다.
- 독립 PowerShell 재계산은 dirty exact12 count12와 cumulative155를 확인했고 Windows/ordinal hash가 각각 exact `9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F` / `495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536`, cumulative `4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C` / `2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D`로 계약과 일치했다.
- 위 검증 결과를 마지막 raw7 append로 고정한 뒤 파생 P/E/H/D/M을 한 번 더 재materialize한다. 이후 실행하는 focused/live/diff/compile과 exact path/hash는 precommit 최종 증거이며 추가 evidence append 없이 commit한다.
# 2026-09-07 C-21 Workbench UI rework local 착수

- 담당: `developer-primary`; dispatch base `8d043e39f6066283821abe47b36fa83e5ecff8b5`; 상태 `START_PROJECTION_TDD`.
- 범위: seq573~578 append-only, product exact11, LOCAL-only. Provider/Telegram 실제 호출·WSL·ysna·main·DB/schema/Secret 변경은 제외한다.
- topology: seq573 worker lease → seq574 write lease → seq575 package start → product direct child → seq576 write revoke → seq577 worker revoke → seq578 completion.
- TDD RED: `python -m unittest tests.tooling.test_project_progress.C21WorkbenchUiReworkLocalStartTests`는 builder/metadata 부재로 `1 failure, 1 error`, exit1. 예상된 착수 projection RED이며 제품 오류가 아니다.
- 오류 횟수: 제품 오류 0; 절차상 RED 1(실패 집계 제외). 다음 조치: start projection builder/validator/collector를 최소 구현해 seq575 checkpoint를 결박한다.

- start metadata 첫 GREEN 시도는 기존 checker의 `windows`가 CRLF가 아니라 Windows ordinal(casefold/underscore normalization) 정렬을 뜻한다는 점을 잘못 적용해 `C21_WORKBENCH_UI_LOCAL_PATH_METADATA_INVALID` 2 errors, exit1이었다. 실제 helper 결과로 고정 hash를 정정했다. 제품 오류 0, 절차 오류 1이며 같은 근본원인 반복은 아니다.

- start builder focused는 `2 tests / OK`였으나 첫 live checker에서 event payload/effect 및 HANDOFF 공통 비교 필드 누락을 fail-closed로 검출했다. 기존 event contract의 flat lease payload와 repository effect, HANDOFF 공통 필드를 builder에 추가한다. 제품 오류 0, projection 계약 오류 1이며 같은 근본원인 반복은 아니다.

- seq575 start projection GREEN: focused `2 tests / OK`, live checker `PASS sequence=575 reporting=AUTO_CONTINUE`, `git diff --check` exit0. exact10 start lease와 exact11 product write lease가 ACTIVE이며 다음은 제품 테스트 RED다.

## 2026-09-07 C-21 Workbench UI rework local 제품 구현

- 담당: `developer-primary`; 제품 commit `7eb2cc291bda729e21deebbed86376eac4db7c2b`; parent start checkpoint `72139df2f8cd3c16e1c7c08b26686f675400a2c9`; exact11/path hash `3FD59352816A3CAF316F1EF832C9B206B20363197C4B5887626BA8D964095DFF`.
- TDD RED: Node는 production marker/exports 부재로 실패했고 ASGI는 production root marker 부재로 실패했다. Chromium `--workbench-self-test`는 기능 부재로 required arguments 오류를 반환했다. 모두 승인 범위 기능 부재를 먼저 확인한 예상 RED다.
- GREEN: web 전체 `19/19`, API+agent_team 표준 범위 `193/193`, 신규 실제 headless Chromium 클릭/Network, 기존 SSE self-test와 cross-origin rejection, `git diff --check`, production browser secret/internal-host scan을 통과했다.
- Chromium은 `/api/providers` → UPSTAGE detail/models → GROQ 클릭 → authenticated SSE 2회 흐름을 실제 클릭했다. 요청은 모두 same-origin GET이고 두 번째 SSE에만 `Last-Event-ID: event-ui-1`이 있었다. 설정/연결 테스트/model refresh 버튼 3개는 disabled이며 POST와 fixture API 요청은 없었다.
- 전체 `pytest -q`는 exit2로 PASS가 아니다. 기존 collection 오류 7건: PyYAML 미설치 1, 중복 `test_models`/`test_repository` import mismatch 3, fixture `src` import 부재 3. 제품 변경과 직접 관련된 표준 분리 suite는 위와 같이 PASS했다.
- 오류 원장: Python PATH 명령 부재 1회와 bundled Python의 pytest 부재 1회는 환경 실행 오류다. Chromium disabled button selector ID 부재 1회는 probe assertion 보완 오류이며 실제 버튼은 disabled였다. seq575 checker의 제품 commit 직후 `GIT_DESCENDANT_PATH_SET_MISMATCH` 1회는 start-only predicate가 제품 direct child를 아직 허용하지 않은 lifecycle 공백이다. 유효 제품 실패 0, 동일 근본 원인 3회 없음.
- 제외/미검증: 실제 Provider/Telegram 호출, WSL, ysna, main, DB/schema/Secret 변경과 push는 `NOT_EXECUTED`. 다음은 seq576~578 결과 projection과 독립 Tester 검토다.

## 2026-09-07 C-21 Workbench UI rework local full tooling 판정

- canonical full tooling은 `583 tests in 1136.972s`, `FAILED (failures=19)`, exit1이다. PASS 또는 미검증으로 승격하지 않는다.
- root-cause 분류: A-13 current-root temporal coupling 7, A-14 accepted artifact checksum/current-root coupling 2, G-07 historical authority/current-root coupling 3, Phase G Gate historical baseline/current-root coupling 4, progress historical projection/current-root coupling 2, seq578 validated-base collector fail-open 1이다.
- seq578 collector 1건은 declared `validated_base_commit`이 canonical exact base와 일치하고 현재 HEAD의 ancestor인지 먼저 확인하도록 최소 수정했다. 해당 mutation test를 targeted GREEN으로 재검증한다.
- 나머지 18건은 UI 제품 동작 실패가 아니지만 이번 변경으로 드러난 회귀다. 기존 seq1~572와 historical evidence를 변경하지 않고 별도 historical-fixture reconciliation package에서 immutable commit/file-view fixture로 수정한다. 현재 exact10 lease 밖의 과거 테스트 4개 파일은 이 package에서 수정하지 않았다.
- 따라서 이 package는 `COMPLETED_LOCAL_PENDING_TOOLING_RECONCILIATION`으로 닫고 write/worker lease를 회수한다. 독립 Tester는 reconciliation 완료 전 `BLOCKED_PENDING_TOOLING_RECONCILIATION`이다. 다음 안전 조치는 `C21_WORKBENCH_UI_HISTORICAL_FIXTURE_RECONCILIATION`이다.
- collector 보완 후 focused result 계약은 `3 tests in 3.461s`, `OK`, exit0이다. 이어 start+result projection `5 tests in 2.598s`, `OK`, live checker `PASS sequence=578 reporting=AUTO_CONTINUE`, `git diff --check` exit0을 확인했다. exact10 밖 A-13/A-14/G-07/Phase G 테스트 파일 diff는 0이다.

## 2026-09-07 C-21 historical fixture reconciliation FAILURE_REPORT

- 담당: `developer-primary`; parent `d059e043ff642c9f5eb50da8dda8aaa8f4ed8408`; lineage `C21_WORKBENCH_TOOLING_HISTORICAL_FIXTURE_RECONCILIATION_TEMPORAL_FIXTURE`.
- 승인 범위의 기존 RED 재현은 예상 18건과 달리 현재 `176 tests in 35.789s`, `FAILED (failures=16)`, exit1이었다. 분류는 A-13 7, A-14 2, G-07 3, Phase G 4이며 제품 failure가 아닌 current-root temporal 결합이다.
- 1차 immutable fixture 수정 뒤 `177 tests in 115.147s`, `FAILED (failures=4)`, exit1이었다. A-13 당시 successor 존재 계약 1, A-14 당시 portable hash 계약 1, Phase G의 clean historical HEAD와 당시 progress Git projection 차이 2였다.
- 2차 당시 literal/검증 경계 복원 뒤 `177 tests in 100.147s`, `FAILED (failures=2)`, exit1이었다. A-13/A-14/G-07은 GREEN이지만 Phase G checkpoint manifest가 clean `57703ffc3521287cdd7d54b07bfd7c9001928388` snapshot에서 `GATE_CHECKPOINT_RAW_MISMATCH`, `GATE_CHECKPOINT_TARGET_BYTES_MISMATCH`, `GATE_CHECKPOINT_TARGET_MISMATCH`를 반환한다.
- 동일 temporal-fixture lineage가 세 실행에서 연속 확인되어 프로젝트의 3회 규칙에 따라 추가 수정·재시도·seq579~584 projection materialization·commit을 중단한다. 상태는 `FAILURE_REPORT`; write/worker lease를 Main Agent에 반환한다.
- 현재 변경은 test-only exact4와 본 작업현황 append뿐이다. 제품, historical evidence, historical checker/constants, `scripts/check_g07_baseline.py`는 변경하지 않았다. push/WSL/Provider/Telegram/ysna/main/external side effect는 `NOT_EXECUTED`다.
- Main 인수 지점: Phase G accepted checkpoint가 원래 `HEAD=5ca9c1f` + post-checkpoint dirty projection으로 생성된 계약인지 확인하고, clean `57703ff`를 억지로 현재 hash에 맞추지 말고 materialized historical file-view 또는 전용 collector로 당시 raw view를 재현해야 한다. rollback은 네 test 파일과 이 WORK_STATUS append를 parent `d059e043` 상태로 복원하는 것이다.
## 2026-09-07 C-21 Workbench UI historical fixture reconciliation seq579~584 — Main takeover

- 기준 HEAD `d059e043ff642c9f5eb50da8dda8aaa8f4ed8408`, 제품 commit `7eb2cc291bda729e21deebbed86376eac4db7c2b`, 시작 시 clean이다.
- test-only lease는 A13/A14/G07/Phase-G tooling test 4경로이며 historical evidence·scripts·상수·제품 코드는 불변이다.
- 동일 lineage `C21_WORKBENCH_TOOLING_HISTORICAL_FIXTURE_RECONCILIATION_TEMPORAL_FIXTURE`가 16 → 4 → 2 failures로 3회 이어져 Developer가 중지하고 Main이 인수했다.
- Main 인수 1차는 clean `57703ff`를 사용해 checkpoint manifest가 결박한 transient report bytes를 찾지 못해 Phase-G 2건이 계속 실패했다.
- Git object database와 reachable history에 해당 두 transient blob이 없음을 확인했다. 현재 checker가 사용하는 declaration-only checkpoint 검증과 commit별 frozen root를 결합하는 것이 보존된 계약이다.
- Main 인수 2차는 abbreviated SHA를 full SHA와 직접 비교하여 checkout/clean assertion 2건이 실패했다. 저장소 `rev-parse`로 full SHA를 확인해 교정했다.
- 108-package gate 재계산은 `e59c4a105dab0faae31f43fd75e3ac53f1992ffe`, fenced A-02 start는 `2bd88123e93550db5874b479c82d78d4733fd53f` frozen root에 결박했다.
- Main focused Phase-G 2 tests는 `Ran 2 tests in 12.444s / OK`; exact4 historical modules는 `Ran 177 tests in 97.378s / OK`다.
- 현재 상태는 seq579~584 materialize 및 전체 tooling 전 `IN_PROGRESS`; Provider·Telegram·WSL·ysna·main·push는 `NOT_EXECUTED`다.

### seq584 Main 전체 tooling 1차 및 temporal test 보완

- seq584 exact16/cumulative183 경로 metadata를 Windows/ordinal SHA-256까지 상수로 결박했다. exact16은 `4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0` / `E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90`, cumulative183은 `BCCCA49E2B920D3A4FD4C557792F63204E20708E4897812CB4457DEB5ED7DC3B` / `DFA407A31DBDAD6424B9664ACBFB1F77999D5D746604A20327CFE0E0EA85D91B`이다.
- 명령 오류 `C21_SEQ584_METADATA_FUNCTION_NAME_R1` 1회: 존재하지 않는 `build_*_metadata` 이름을 호출해 `AttributeError`가 발생했고 실제 공개 함수명으로 바로 교정했다. 제품·계약 실패가 아니다.
- 환경 오류 `C21_SEQ584_SANDBOX_MATERIALIZE_PERMISSION_R1` 1회: managed sandbox가 격리 worktree의 generated file write를 거부했다. 승인된 격리 실행으로 동일 builder를 재실행해 5개 파생 산출물을 정상 생성했다.
- pre-full focused는 seq584 2 tests `OK`, historical exact4 `177 tests in 95.725s / OK`, live checker `PASS sequence=584 reporting=AUTO_CONTINUE`, diff-check와 direct compile 모두 PASS다.
- canonical full tooling 1차는 `587 tests in 1072.914s`, `FAILED (failures=2)`, exit1이다. 기존 seq572 strict projection test가 현재 seq584 bundle을 사용한 1건과, provider WSL candidate status fail-closed test가 현재 seq584 Git collector로 라우팅된 1건으로 분류했다.
- 두 테스트를 각각 seq572 generated artifact view와 `e6c562cf07bc2c35e24addb60efa9d90fae08046` historical bundle에 고정했다. public current bundle에 과거 seq572 manifest를 주입하려던 중간 시도 2회는 generic registry/digest 계약과 맞지 않아 실패했고, 중복된 public assertion을 제거하고 seq572 전용 projection의 원래 검증 목적을 유지했다.
- 두 실패의 targeted 최종 재검증은 `Ran 2 tests in 9.478s / OK`다. 동일 제품 오류 3회가 아니며 Main 인수 범위 안에서 historical temporal fixture만 보완했다. 다음은 파생 산출물 재결박 후 canonical full tooling 2차다.
- canonical full tooling 2차는 `Ran 587 tests in 1126.738s / OK`, exit0으로 완료됐다. 앞선 19개 tooling 실패와 1차 잔여 2개 temporal test가 모두 해소됐다.
- 다음은 이 최종 결과를 포함한 raw report/validation/WORK_STATUS 기준으로 seq584 P/E/H/D/M을 마지막 재결박하고, focused/live/determinism/diff/compile 및 exact16 상태를 확인한 뒤 단일 direct-child record commit을 생성하는 것이다.
- 최종 evidence 재결박 전 검증은 historical exact4 `177 tests in 102.320s / OK`, seq584+잔여 회귀 targeted `4 tests in 12.061s / OK`, live checker sequence584 PASS, deterministic regeneration PASS, diff-check PASS, direct compile PASS다.
- dirty set은 exact16과 일치하며 Windows/ordinal hash는 `4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0` / `E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90`다. 이 문구를 포함해 마지막으로 파생 산출물을 재결박한 뒤 read-only precommit 확인만 수행한다.
## 2026-09-07 C-21 Workbench UI WSL Git-only candidate Developer 시작

- 담당: `developer-primary`; 상태: `IN_PROGRESS_TDD_RED_PREPARATION`.
- 시작 branch/HEAD: `codex/c21-operational-execution` / `468b1408f6e817d20d68c46a79ba44dc82cb4b3d`; 시작 worktree clean.
- 범위: seq585~590의 S exact10 및 K exact12 두 direct-child commit. 기존 seq1~584와 historical evidence는 보존한다.
- 실행 제외: push, WSL, Docker, DB, Provider, Telegram, ysna, main은 `NOT_EXECUTED`.
- 환경 오류 원장: `WORKBENCH_WSL_CANDIDATE_RG_WINDOWS_LAUNCH_R1` 1회. Windows `rg.exe` 연결 오류로 검색이 실행되지 않아 PowerShell `Select-String`으로 전환했다. 제품/계약 실패가 아니다.
- TDD RED: `.venv\Scripts\python.exe -m unittest tests.tooling.test_project_progress.C21WorkbenchUiWslGitOnlyCandidateStartTests` → exit 1, `Ran 2 tests`, missing builder/metadata로 예상대로 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_CANDIDATE_START_MISSING_R1` 1회.
- GREEN 보완 오류: 최초 event append helper가 terminal event 내부의 event_id를 footer보다 먼저 치환해 seq584 raw prefix 보존 테스트 1건이 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_EVENT_FOOTER_REPLACE_R1` 1회. footer tail만 치환하도록 수정했다.
- 환경 오류 원장: S generated5 materialize가 sandbox의 `D:\tmp` 쓰기 제한으로 `PermissionError` 1회 발생했다. fingerprint `WORKBENCH_WSL_CANDIDATE_TMP_WRITE_SANDBOX_R1`; 제품/계약 오류가 아니며 같은 명령을 승인된 unrestricted 실행으로 재개한다.
- S live checker 1차는 `EVENT_EFFECT_MISMATCH` 1건으로 실패했다. fingerprint `C21_WORKBENCH_UI_WSL_START_REMOTE_EFFECT_R1`; terminal `PACKAGE_STARTED`에 source projection의 `dispatch_upstream_head`가 누락된 원인이며 동일 관측값을 추가해 보완한다.

### S exact10 completion

- S commit `f0d4bc7badbdae69c2d2b21089667fdcc636518d`는 parent `468b1408f6e817d20d68c46a79ba44dc82cb4b3d`의 단일 direct child다.
- exact10 Windows/ordinal hash는 `6E8FF216E3984D238E6229C489B97B8CBD3E45E7591D4378ED9EA5C4AFE8DFD5` / `E6B5378AA75AE61785AAAF6E5C07695663EA4F3970010750D9DD4D5EA3492275`, cumulative187은 `287B8617A64EC0A33E3F97E20A03E7CB69B66A9C8A1DBCC777E3A16D2F7F3D88` / `1A35F7995A3AE539395E0EC515B240C276433F5AD7F736C28BE0F63182EDC889`이다.
- postcommit live checker `PASS sequence=587 reporting=AUTO_CONTINUE`, focused `2 tests OK`, deterministic generated5 및 diff-check PASS다.
- K seq588~590 exact12 TDD RED를 시작한다. 외부 실행은 계속 `NOT_EXECUTED`다.
- K TDD RED: tooling/deploy focused 실행은 `Ran 6 tests`, 3 failures/1 error로 예상 실패했다. missing bound builder/metadata, 이전 Candidate manifest status/source, active guard 함수 부재가 원인이다. fingerprint `C21_WORKBENCH_UI_WSL_CANDIDATE_BOUND_MISSING_R1` 1회.
- K GREEN 보완: active guard focused 1건이 Windows Git Bash의 기본 `python3` 부재로 exit20이었다. fingerprint `C21_WORKBENCH_UI_WSL_GUARD_TEST_PYTHON_PATH_R1` 1회; 실제 WSL 계약 실패가 아니며 기존 harness 방식대로 현재 interpreter의 POSIX 경로를 `ANVIL_PYTHON`에 주입한다.
- 환경 오류 원장: S/K/deploy 결합 focused 중 Windows subprocess stderr reader의 CP949 decode가 1회 실패해 guard shell이 exit127로 표시됐다. fingerprint `WORKBENCH_WSL_CANDIDATE_CP949_READER_FLAKE_R1`; 동일 테스트 단독 재실행은 즉시 PASS했다. 제품/guard failure로 승격하지 않고 전체 suite에서 재검증한다.
- 전체 deploy 1차는 같은 Windows `cp949` reader 예외가 7회 반복되어 결과가 오염돼 중단했다. fingerprint `WORKBENCH_WSL_CANDIDATE_CP949_READER_FLAKE_R1` 누적 8회. 정식 제품 실패가 아니며 추가 동일 실행을 중단하고 Developer가 직접 `PYTHONUTF8=1`로 프로세스 기본 text encoding을 고정한 뒤 전체 suite를 새로 실행한다.
- UTF-8 전체 deploy 2차는 신규 active guard가 historical exact107 호출까지 가로채 다수 fail을 즉시 재현해 중단했다. fingerprint `C21_WORKBENCH_GUARD_HISTORICAL_DISPATCH_R1` 1회. 기존 active 함수 객체를 seq590 alias로 보존하고 expected candidate가 exact187일 때만 신규 predicate를 적용하도록 수정한다.
- candidate별 guard dispatcher 보완 후 prior guard 27개 중 26개 PASS, 1개는 historical exact107 manifest assertion이 current mutable file을 읽는 시간결합으로 실패했다. fingerprint `C21_WORKBENCH_DEPLOY_HISTORICAL_MANIFEST_FIXTURE_R1` 1회. seq542/seq554를 포함한 historical manifest 검사는 각 accepted commit blob으로 고정한다.
- historical fixture commit 1차 선택에서 exact107 source에 `a6dca0d` 자체 blob을 사용해 실제 source `a342d62`가 반환됐고, seq542는 exact binding 도입 전 `71d6747`을 골라 2건 실패했다. fingerprint `C21_WORKBENCH_HISTORICAL_FIXTURE_COMMIT_SELECTION_R1` 1회. `git log -- deploy/wsl/CandidateReleaseManifest.json` 실측으로 source fixture=`3501c37`, exact binding fixture=`c330d34`, scope map fixture=`797b4d8`로 정정한다.
- 전체 deploy 3차는 non-elevated UTF-8 환경에서 약 30분간 F/E 없이 진행했으나 장기 중복 fixture 구간의 종료를 확인하지 못하고 진단을 위해 중단했다. fingerprint `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 1회. 프로세스는 응답 중이고 CPU가 계속 증가해 idle/hang 증거는 없었다. 중단 결과를 PASS로 쓰지 않으며 같은 fresh 전체 명령을 충분한 시간 동안 다시 실행한다.
- 전체 deploy 재시도도 non-elevated UTF-8 Git Bash에서 약 30분간 F/E 없이 CPU를 계속 사용했으나 진단 목적으로 중단했다. `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 누적 2회이며 PASS가 아니다. elevated 실행은 WSL bash가 Git Bash 형식 `/d/.../.venv/python.exe` 경로를 찾지 못해 exit127이었다(`WORKBENCH_WSL_DEPLOY_ELEVATED_BASH_PATH_R1` 1회, 환경 오류).
- Git global excludes 경고를 줄이려 `core.excludesfile=NUL`을 적용한 시도는 Git이 NUL을 exclude file로 허용하지 않아 실패했다(`WORKBENCH_WSL_GIT_IGNORE_OVERRIDE_NUL_R1` 1회, 명령/환경 오류). repo-local `.gitignore` 절대경로를 프로세스 한정 override로 사용한다.
- 현재 프로세스 확인 중 `Get-CimInstance Win32_Process`는 managed 권한으로 `Access denied`였다(`WORKBENCH_WSL_PROCESS_ENUM_PERMISSION_R1` 1회, 환경 오류). 이 시점에 이어갈 unified test session은 없으며 dirty set은 K exact12와 일치했다.
- 전체 suite 전 active symbol을 직접 검사해 seq590 구현이 파일 중간에 삽입되고 뒤쪽 seq542 historical public 정의가 다시 덮어쓰는 결함을 재현했다. 신규 public-dispatch test는 active 함수에 `C21_WORKBENCH_CANDIDATE`가 없어 1 failure였고 fingerprint `C21_WORKBENCH_GUARD_FINAL_DEFINITION_ORDER_R1` 1회다. 원인은 정의 순서이며, historical final 함수를 alias로 캡처한 뒤 EOF public dispatcher가 exact187만 신규 predicate로 전달하도록 최소 수정했다. 해당 class `Ran 5 tests / OK`로 GREEN이다.
- 다음: repo-local excludes + UTF-8 non-elevated Git Bash로 full deploy를 종료까지 실행하고, 이후 full tooling·Web·API/agent-team을 순차 검증한다.

### K full deploy 동일 장기 실행 3회 — Developer FAILURE_REPORT

- lineage/fingerprint: `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1`. 이번 fresh full deploy는 2026-09-07 23:14:14에 시작해 2시간 00분 이상 실행됐고, 마지막 확인 PID 56280은 CPU 6716.22초, `Responding=True`, single thread, WorkingSet 약 13.6MB였다. F/E/traceback 출력은 0이었으나 종료하지 않아 PASS가 아니다.
- 진행 위치: unittest dot/fixture 출력 순서상 `WslCandidateManifestGuardTests` 23개 중 앞 22개가 완료됐고, 마지막 기존 `test_seq494_public_coherent_resume_or_work_instruction_rewrite_rejected`의 7-scenario temp clone/file snapshot 구간에서 장기 실행했다. 이 테스트는 각 scenario 전후 `repo.rglob("*")`로 `.git` traversal까지 수행한 뒤 파일 선택 단계에서만 `.git`을 제외한다. 신규 seq590 class 실행 전의 기존 harness 병목이다.
- 동일 조건은 앞선 diagnostic 중단 2회에 이어 이번 재개에서 3회째 확인됐다. 프로젝트 규칙에 따라 Developer는 추가 full deploy 재시도와 테스트 성능 수정을 중단하고 Main에게 인계한다. 이번 중단은 exit1이며 PASS로 기록하지 않는다.
- 별도 확인 오류: 테스트 정의 순서 확인용 one-line Python 명령은 quoting 오류로 `SyntaxError` 1회(`WORKBENCH_WSL_TEST_ORDER_COMMAND_QUOTING_R1`), `wmic`은 명령 부재 1회, `tasklist /v`는 Access denied 1회(`WORKBENCH_WSL_PROCESS_COMMANDLINE_DIAGNOSTIC_R1`)였다. 제품 오류가 아니며 더 이상 권한 우회를 시도하지 않았다.
- 완료된 조치: seq590 public guard가 뒤쪽 historical 함수 정의에 덮어써지던 결함은 dedicated RED로 재현하고 EOF dispatcher로 수정했다. `WslWorkbenchUiGitOnlyCandidateContractTests`는 `Ran 5 tests / OK`; dirty 경로는 K exact12와 일치한다.
- 미완료/미검증: full deploy 종료 결과, full tooling, Web 19, API/agent-team 193, 최종 K materialize/determinism/live checker/exact hash, K commit/postcommit은 미완료다. push/WSL/Docker/DB/Provider/Telegram/ysna/main은 계속 `NOT_EXECUTED`다.
- Main 인수 권장안: 기존 test의 non-Git snapshot 의미를 유지하면서 `.git` 디렉터리를 traversal 전에 prune하는 fixture helper로 병목을 제거하고 해당 단일 test를 먼저 시간 측정한 뒤 full deploy를 fresh 실행한다. 변경 범위를 테스트 harness에 한정하고 deploy runtime script는 수정하지 않는다.
- rollback: K dirty exact12 전체를 S commit `f0d4bc7badbdae69c2d2b21089667fdcc636518d`로 되돌리면 된다. S commit 자체는 clean 검증과 seq587 checker PASS를 이미 확보했다.

### K Main takeover — deploy harness 병목 및 실행환경 분리

- 동일 lineage `WORKBENCH_WSL_DEPLOY_LONG_RUNNING_DIAGNOSTIC_R1` 3회 후 Main이 test-only lease를 인수했다. 제품·deploy runtime·historical evidence는 수정하지 않았다.
- 기존 seq494 snapshot comprehension이 `.git`을 파일 선택 단계에서만 제외하여 Git object tree 전체를 순회하던 문제를 `os.walk()`의 directory prune으로 수정했다. 해당 7-scenario 단일 테스트는 기존 2시간 초과 미종료에서 `103.383s / OK`로 단축됐다.
- fixture clone은 source object 복제를 피하는 `git clone --shared`로 제한했고, source HEAD/status가 clone commit 후에도 불변임을 확인하는 격리 회귀 테스트를 추가했다. seq494+격리 targeted는 `2 tests in 64.109s / OK`다.
- cleanup entrypoint fixture도 immutable Git object만 읽고 worktree에서는 `deploy/wsl`만 사용하므로 sparse checkout을 적용했다. 제품 저장소·source object·runtime script는 변경하지 않는다.
- Main verbose full deploy 비상승 실행은 `tempfile.mkdtemp(dir="D:/tmp")`에서 샌드박스 write가 허용되지 않은 채 CPU를 소비하는 환경 대기로 확인됐다. `faulthandler` stack이 `tempfile.py:385 mkdtemp`를 직접 지목했다. fingerprint `WORKBENCH_WSL_TMP_SANDBOX_MKDTEMP_R1` 1회이며 제품/테스트 assertion 실패가 아니다.
- 상승 실행의 기본 PATH는 WSL `bash`를 선택해 Git Bash 경로 `/d/...`를 찾지 못했다. fingerprint `WORKBENCH_WSL_ELEVATED_BASH_SELECTION_R1` 1회. 프로세스 PATH 앞에 `C:\\Program Files\\Git\\usr\\bin`을 고정하여 Git Bash와 D: mount를 명시한다.
- 위 환경 고정 뒤 cleanup duplicate-source 단일 테스트는 `1.865s`에 실행됐으나 dirty precommit fixture가 아직 존재하지 않는 seq590 control commit을 요구해 첫 binding에서 `cleanup-guard control must be a single direct child`로 거부됐다. 이는 commit 전 current HEAD만 clone하는 기존 fixture의 lifecycle 조건이며, exact12 commit 후 full deploy에서 재검증한다. historical expectation이나 guard를 완화하지 않는다.
- K focused tooling+guard는 `7 tests in 1.118s / OK`다. raw `WORK_STATUS`와 test harness 변경 뒤 live checker는 예상대로 `PRG_REFERENCED_HASH_MISMATCH`를 검출했으며, final raw 입력을 반영해 P/E/H/D/M을 deterministic 재materialize한 뒤 다시 실행한다.
- 외부 실행, push, WSL, Docker, DB, Provider, Telegram, ysna, main은 계속 `NOT_EXECUTED`다.

### K final precommit 검증

- final raw 입력 재결박 후 seq590 focused tooling+guard는 `7 tests in 1.105s / OK`, live checker는 `PASS sequence=590 reporting=AUTO_CONTINUE`, deterministic generated5 비교·`git diff --check`·direct Python compile·`bash -n`은 모두 PASS다.
- 제품 회귀는 정확한 표준 명령으로 Web `19/19 PASS`와 API+agent_team `193 passed in 6.53s`를 확인했다. API unittest discovery 0건은 해당 pytest suite의 검증으로 사용하지 않고 환경/명령 선택 기록으로만 남긴다.
- canonical 전체 tooling은 Git Bash PATH·UTF-8·D:\\tmp fixture 권한을 고정한 fresh 실행에서 `591 tests in 995.010s / OK`, exit0으로 완료됐다. 실행 중 제품/문서 mutation은 없었다.
- dirty set은 계약 exact12이며 Windows/ordinal hash `D85669CA2C20EA8481C165F736FD28F017E7291BAFBB3916684A9DF5975EF714` / `4A8A0CED250CE4E9010589C68416BC4C25346F6D2DA46F44034CE92336C6D901`, cumulative189 hash `8A54D4594B30E4CACFD8AB8C54C187CB528735E39305E1503737932023BD786F` / `13D263C508363A6D24622CC015545B965D96F67025EA75B1F1C9C43C5EDBF31A`와 일치했다.
- 이 raw 결과를 마지막으로 P/E/H/D/M에 재결박한 뒤 focused/live/determinism/diff/compile/hash를 read-only로 재확인하고 S commit의 단일 direct-child exact12 commit을 생성한다. commit-bound full deploy는 그 다음 fresh 실행한다.

### K independent review REWORK 및 Main 보완

- 최초 K commit `b9ff3ff118ecce4c744f2803083e45f5aea7ce4e`에 대한 독립 Reviewer 판정은 `REWORK`, Critical 0 / Important 1 / Minor 1이다.
- Important 원인은 새 candidate `f0d4bc7...`가 source/rollback에는 결박됐지만 `runtime_binding.allowed_lifecycle_tuples`와 active `validate_c21_exact_runtime_state`에는 없었던 것이다. 정상 배포 상태 `f0d4bc7:f0d4bc7:324eb169`가 exit23으로 거부되어 verify와 rollback을 막는 실제 계약 결함이다.
- TDD RED는 manifest rollback allowlist 누락과 정상 배포 tuple 거부를 각각 재현해 `2 failures`였다. test helper의 `_posix` 호출 대상 오류 1회는 즉시 교정한 test-author 오류이며 제품 실패 횟수에 포함하지 않는다.
- GREEN은 manifest의 정확한 신규 배포 후/rollback 후 tuple 2개와 rollback allowlist를 추가하고, 새 manifest contract가 runtime binding 전체를 strict equality로 검증하도록 보완했다. active runtime validator도 동일 두 tuple만 추가했다. focused class는 `6 tests in 1.193s / OK`이며 runtime tuple 삭제 변조도 exit20으로 fail-closed다.
- commit-bound full deploy의 기존 cleanup entrypoint 4건은 현재 seq590 manifest와 과거 exact107 candidate를 혼합하는 historical temporal fixture 때문에 같은 binding 실패를 냈다. 테스트 최초 확정 commit `b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`를 control/manifest view로 고정하되 현재 cleanup/common/guard를 계속 실행하도록 수정했고, 관련 4건은 `28.733s / OK`다. historical artifact bytes는 변경하지 않았다.
- Reviewer Minor는 S WorkInstruction의 EOF 빈 줄 1건이다. 이미 검증된 immutable S commit과 계보를 재작성하지 않으며 기능·runtime 영향 없는 기존 diff 경고로 보존한다.
- K는 아직 private push 전이므로 위 exact12 내부 보완과 재결박을 같은 single direct-child commit으로 amend한 뒤 full tooling/deploy와 재검토를 다시 수행한다.

### K commit-bound 재검증

- Reviewer 보완을 포함한 K `ab2483a1f07d90d2763d9038e73a57b176dadd64`는 S `f0d4bc7...`의 단일 direct child, clean exact12이며 postcommit checker sequence590 PASS다.
- commit-bound 전체 deploy harness는 `119 tests in 575.846s / OK (skipped=9)`, exit0이다. SKIP9는 기존 Windows/Git Bash 환경 조건이며 실제 WSL runtime PASS로 승격하지 않는다.
- 보완 후 canonical 전체 tooling 1차는 `591 tests in 969.091s`, error1, exit1이다. 유일 오류는 과거 `test_c21_provider_wsl_exact_binding_completion_is_forward_only`가 현재 seq590 Candidate manifest를 과거 seq542 builder 입력으로 사용해 `C21_EXACT_BINDING_BOUND_CANDIDATE_INVALID`를 낸 temporal fixture다. 제품/runtime/checker 오류로 분류하지 않는다.
- 위 과거 테스트의 raw 입력만 당시 accepted commit `c330d34ea7d0acc7e423a978f9c558c94c159118` Git blob으로 고정했다. historical evidence와 checker는 변경하지 않았고 targeted 재검증은 `1 test in 0.750s / OK`다.
- 이 결과와 exact12 변경을 다시 재결박·amend한 뒤 full tooling을 fresh 재실행하고 독립 Reviewer 재검토를 받는다.

### K final full tooling PASS

- 최종 K `61eff066fcc0693884bf1816eeed14687908f2c9`에서 historical fixture 보완 후 canonical 전체 tooling을 fresh 재실행했다. 결과는 `591 tests in 964.449s / OK`, exit0이며 failure/error/traceback은 0이다.
- 이 PASS를 raw 상태에 마지막으로 기록하고 seq590 P/E/H/D/M을 재결박한 뒤 K를 동일 exact12 single direct-child로 최종 amend한다. 이후 focused/live/determinism/path/hash와 독립 Reviewer만 재확인하며 전체 suite 결과를 과장하지 않는다.

### K independent review 2차 REWORK 및 manifest fail-closed 보완

- 최종 K `744d032256a911ef600686d13dc7a47817156f11` 2차 검토는 runtime tuple 해소를 확인했으나 `REWORK`, Critical 0 / Important 1 / Minor 1이었다.
- Important는 seq590 전용 manifest contract가 `authority.approval_artifact_sha256`, `cleanup.required_labels`, 미승인 최상위 key 변조를 허용한 것이다. TDD RED에서 해당 변조가 rc0으로 통과해 1 failure로 재현됐다.
- seq590 manifest의 최상위 exact key set, authority 전체 canonical SHA-256 `985BF0E357291D002C5081040684667524DDBC1F1DF83EAF01880874A58E03AF`, environment와 cleanup exact object를 전용 contract에 추가했다. runtime/rollback/source/verification/wsl observation의 기존 exact 비교도 유지한다.
- 구현 중 `hashlib` import가 같은 파일의 과거 heredoc에 적용된 위치 오류 1회가 있었고 신규 heredoc으로 즉시 교정했다. historical 함수의 원문 import는 복원했으며 제품 실패가 아니다.
- 보완 focused class는 `6 tests in 1.754s / OK`; authority·cleanup·unknown key·runtime tuple·Telegram evidence 변조를 모두 rc20으로 거부하고 정상 manifest 및 신규 배포/rollback tuple은 통과한다.
- 이 보완은 기존 exact12 경로 안이며 private push 전이다. 재결박·amend 후 전체 deploy/tooling과 독립 검토를 다시 수행한다.

### K manifest fail-closed 최종 full suites

- seq590 manifest fail-closed 보완을 포함한 K `d08ed2585b6c66cb9792f8b52ea6d65b5a8f217e`에서 두 canonical suite를 fresh 병렬 실행했다.
- 전체 deploy harness: `119 tests in 733.993s / OK (skipped=9)`, exit0. 기존 환경 SKIP9 외 failure/error 0이다.
- 전체 tooling: `591 tests in 1214.862s / OK`, exit0. failure/error/traceback 0이다.
- 병렬 실행으로 각 wall time은 직전 순차 실행보다 늘었지만 결과 계약은 모두 PASS다. 이 결과를 마지막 raw 상태에 기록하고 generated5를 재결박한 뒤 exact12 amend·focused/live/determinism·독립 Reviewer를 수행한다.

### WSL exact187 실행 재개 — 접속 경로 확인

- private refs 게시와 재조회 완료 기준은 control `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`다. Provider·Telegram 실제 호출은 제외하고 migration·API·authenticated SSE·Last-Event-ID·same-origin·backup/restore·rollback·승인된 exact cleanup만 수행한다.
- Windows `ssh SINSAN` 시도는 `banner exchange: Connection to UNKNOWN port -1: Connection refused`로 실패했다. fingerprint `C21_WSL_SINSAN_TRANSPORT_SELECTION_R1` 1회. 제품·WSL 장애가 아니라 현재 실행 환경에서 SSH 별칭이 offline 대체값으로 해석된 전송 경로 오류다.
- `wsl.exe --list --verbose`와 `wsl.exe -d Ubuntu -- bash -lc`의 읽기 전용 확인 결과 Ubuntu 배포판이 실행 중이고 내부 hostname은 `SINSAN`, 사용자 `daon`, `/srv/anvil-wsl` 및 `/srv/anvil-wsl/repo`가 존재한다. 이후 표준 WSL 실행은 이 경로로 한정한다.
- 다음: SINSAN 내부 Git·`.env` 존재/hash/mode·application/control/runtime marker·Docker residue를 읽기 전용으로 확인하고, manifest/action checksum을 고정한 control-runtime 순서로 진행한다.
- 첫 preflight 출력의 runtime 경로를 `/runtime/anvil-wsl-pg*`로 잘못 조회하여 marker가 `ABSENT`처럼 표시됐고, image label 출력용 Go-template 인용도 2회 실패했다. fingerprint `C21_WSL_PREFLIGHT_COMMAND_QUOTING_R1` 3회. 이는 읽기 전용 진단 명령 작성 오류이며 제품/runtime 상태가 아니다. 추가 동적 shell 변수를 중단하고 literal 경로로 Main이 직접 확인했다.
- 실제 runtime marker는 PG15/PG18RC 모두 current=`324eb169fedbce958d2e8cc29362deb7af433677`, previous=`324eb169fedbce958d2e8cc29362deb7af433677`; active control=`b2ba82144fa811b4c6cf8673c4113e07ea1d5cfd`; rollback tag `anvil-wsl-web:324eb169...`는 존재한다. application HEAD=`a6dca0d...`, clean detached, private origin exact, 격리 container/network/volume은 0이다.
- private fetch는 지정 deploy key로 exit0이며 control ref=`8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate ref=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`, K parent=S를 재확인했다. immutable manifest SHA-256=`a1bb21983ef5791c5025e8487675801cb824b2066f5c9d9f8dcf092ec1d6d82b`, control-runtime SHA-256=`d0ff497b22851dfc6cb3fa36c761d8bb69ded1cb7a838e81ef55c4a459570097`다.
- `.env` mode=600, SHA-256=`fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`. 필수 7개 변수 이름이 각각 존재하고 값 byte 길이가 49/65/18/16/17/12/53으로 비어 있지 않음을 값 노출 없이 확인했다. 최초 `grep -E '=.+` count 출력은 shell 인용 영향으로 무효였으며 literal `sed` 길이 검사로 교정했다.
- 다음: exact checksum을 환경으로 전달하여 표준 `control-runtime.sh deploy S`를 실행한다. 실패하면 side effect와 상태를 즉시 수집하고 같은 근본 원인 횟수를 누적한다.
- 표준 deploy 실행은 exit0이다. control stage는 K `8fe7b97...`로 게시됐고 application checkout은 S `f0d4bc7...` clean detached로 전환됐다. PG15와 PG18RC에서 DB pull/start/healthy, pre-migration backup+restore-list, candidate image build, Alembic upgrade, web recreate, pinned nginx config test와 ingress start가 모두 완료됐다.
- Docker Compose의 buildx plugin 경고와 migration one-off container의 Tini subreaper 경고가 있었으나 action exit0이며 해당 단계 실패는 없었다. 이는 기능 실패로 승격하지 않고 잔여 운영 개선사항으로 보존한다.
- 다음: immutable verify checksum으로 표준 verify를 실행하여 두 target의 migration head, authenticated SSE, Last-Event-ID, same-origin, backup/restore를 검증한다. Provider·Telegram은 스크립트 계약대로 `NOT_EXECUTED`다.
- 표준 verify는 exit0이다. PG15/PG18RC 모두 canonical test task/run/event 입력, `/auth/session`, authenticated SSE 1건, acknowledged Last-Event-ID 무재생, same-origin ingress, migration head `0013_task_bootstrap_authority`, round-trip dump/restore 및 scratch DB 정리를 완료했다. Provider·Telegram 호출은 수행하지 않았다.
- 다음: rollback checksum과 commit별 test-session scope map을 사용해 두 target을 승인된 previous `324eb169...`로 rollback하고, marker·image·health·migration을 독립 관찰한다.
- 표준 rollback은 exit0이며 두 target 모두 process-local exact3 test-session scope로 web/ingress를 재생성했다. 서버 `.env`는 수정하지 않았다.
- 독립 관찰 결과 PG15/PG18RC의 current/previous marker와 실제 실행 web image revision은 모두 `324eb169...`; 두 `/health/ready`는 `status=ready`, DB `alembic_version`은 `0013_task_bootstrap_authority`다. rollback 중 DB downgrade는 수행하지 않는 계약과 일치한다.
- 다음: S를 재배포하고 동일 표준 verify를 다시 실행한 뒤, 영수증과 `.env` 불변을 확인하고 exact cleanup을 수행한다.
- S 재배포 1차는 PG15 DB가 healthy로 판정되고 image build까지 완료된 뒤 `wsl_compose run --rm anvil-web /opt/venv/bin/alembic upgrade head`에서 `psycopg.errors.ConnectionTimeout`으로 exit1 실패했다. fingerprint `C21_WSL_REDEPLOY_AFTER_ROLLBACK_DB_CONNECT_TIMEOUT_R1` 1회. 첫 deploy·verify·rollback은 성공했으며 이 실패를 전체 WSL 검증 PASS로 기록하지 않는다.
- 실패 시점에는 두 번째 deploy가 PG15 migration 전에서 중단되어 PG18RC에는 이번 재배포 mutation이 시작되지 않았다. Main은 즉시 반복 실행하지 않고 Subagent 읽기 전용 코드 분석과 Main의 runtime marker/container/network/DB log·connectivity 관찰로 원인을 분리한다.
- 다음: side effect 상태와 네트워크 연결성을 보존 조사하고, 표준 runtime을 바꾸지 않는 최소 복구 후 fresh 재배포한다. 동일 근본 원인 3회면 Main 직접 takeover 규칙을 적용한다.
- 조사에서 PG15 DB는 healthy, `pg_isready` local PASS, 기존 rollback web의 DNS `anvil-db=172.21.0.2` 및 실제 SQL `select 1` PASS, DB log에도 crash/restart가 없었다. 반면 동일 S image의 새 Compose one-off는 DNS lookup PASS 후 `pg_isready -h anvil-db -t 5`가 `no response`로 실패했고 Alembic current도 같은 timeout이었다.
- 같은 경계는 재배포 Alembic, one-off Alembic current, one-off TCP readiness에서 3회 확인됐다. `C21_WSL_REDEPLOY_AFTER_ROLLBACK_DB_CONNECT_TIMEOUT_R1` 누적 3회. Main이 직접 인수하며 Subagent는 rollback이 DB/network를 재생성하지 않고 scope override도 DSN과 무관함을 확인했다.
- 최소 복구는 PG15 DB volume과 데이터는 보존하고 정확한 `anvil-db` 컨테이너 endpoint만 Compose force-recreate+healthy로 갱신한 뒤 candidate one-off TCP probe를 재실행하는 것이다. 성공 후 표준 deploy 전체를 fresh 실행한다. 광범위 network/volume 삭제는 하지 않는다.
- PG15 `anvil-db`만 force-recreate+healthy한 뒤에도 candidate one-off `pg_isready`는 DNS resolve 후 `no response`였다. 기존 rollback web은 새 DB endpoint에 즉시 연결되어 DB·alias·password가 정상임을 재확인했다. 따라서 단일 DB endpoint가 아니라 현재 PG15 project bridge의 신규 endpoint forwarding 상태가 원인이다.
- Main 복구 2단계는 승인된 exact PG15 test project의 서비스 3개와 network 2개만 제거·재생성하되 `anvil-wsl-pg15_anvil-db-data` volume과 `/srv/anvil-wsl/.env`, backup/evidence는 보존하는 것이다. 제거 전 network endpoint가 해당 project 서비스 3개뿐임을 확인했다.
- exact PG15 서비스3/network2 제거는 exit0이고 DB volume 존재 및 `.env` mode600을 즉시 재확인했다. 이후 표준 deploy fresh 실행은 PG15 신규 bridge에서 migration one-off 연결을 포함해 통과했고 PG18RC까지 완료되어 전체 exit0이다.
- 판정: 장애 원인은 rollback 후 유지된 PG15 Docker bridge에서 기존 endpoint 간 통신은 되지만 신규 Compose run endpoint의 TCP forwarding이 막힌 런타임 network residue였다. 제품 코드·DB 내용·Secret 변경 없이 exact test network 재생성으로 복구됐다.
- 다음: 표준 verify를 재실행해 최종 candidate 상태를 다시 검증하고, evidence·marker·`.env` hash를 독립 확인한 뒤 exact cleanup한다.
- 복구 후 표준 verify 재실행도 exit0이다. 두 target의 기존 test identifiers는 `ON CONFLICT`로 0건 추가됐고 authenticated SSE/Last-Event-ID/same-origin/backup-restore 결과는 동일하게 PASS다.
- 최종 application은 S clean detached, 두 current marker=S, 두 previous marker=`324eb169...`; `.env` mode600 및 SHA-256 `fecae53b...a79a`로 작업 전과 byte-identical이다. backup·verify·rollback receipt 6개를 literal 경로로 읽고 checksum을 확보했으며 모든 `secret_values=omitted`다. 첫 evidence loop 출력은 shell 변수 인용 오류로 빈 파일명/empty hash가 출력되어 무효 처리했고 literal 경로 확인으로 교정했다(`C21_WSL_PREFLIGHT_COMMAND_QUOTING_R1` 누적4회; 제품 실패 아님).
- 실제 in-app browser에서 PG15 `127.0.0.1:4770/`와 PG18RC `127.0.0.1:4870/` 모두 title `Anvil Provider Workbench`, 9개 Provider/Provider Registry/Run Event UI가 렌더링됨을 확인했다. 브라우저에 test token을 주입하지 않아 Provider 목록은 예상대로 `PERMISSION DENIED`, SSE는 `NOT CONNECTED`; 이를 authenticated browser PASS로 과장하지 않는다. 인증 SSE는 표준 same-origin HTTP verify로 별도 PASS다.
- 다음: 표준 cleanup guard로 승인된 두 Compose project의 서비스·네트워크와 exact volume 2개만 제거하고 residue0, scratch DB0, `.env`/evidence/backup 보존을 확인한다.
- 표준 cleanup은 exit0이다. 독립 사후 관찰에서 PG15/PG18RC Compose container=`0/0`, exact network=`0/0`, exact named volume 합계=`0`이다. restore scratch DB는 verify 단계에서 각각 drop됐고 DB 컨테이너·volume 자체도 승인된 cleanup으로 제거됐다.
- `/srv/anvil-wsl/.env`는 mode600 및 SHA-256 `fecae53b...a79a`로 불변, evidence 6종과 candidate별 backup 디렉터리는 보존됐다. application repo는 S clean detached, runtime control ref=K, candidate ref=S다.
- 현재 live checker의 `C21_WORKBENCH_UI_WSL_BOUND_PROJECTION_INVALID`, `GIT_PRIVATE_AUTHORITY_MISMATCH`, `PRG_REFERENCED_HASH_MISMATCH`는 seq590이 pre-CAS Git-only 상태를 결박한 뒤 실제 CAS·WSL 결과와 raw WORK_STATUS가 추가된 예상 projection drift다. seq590/historical evidence를 수정하지 않고 새 successor event/projection으로 해소한다.
- 다음: 실제 runtime 결과와 네트워크 복구 이력, 제한사항을 새 append-only successor package에 결박하고 focused/full tooling·checker·독립 Reviewer·commit·private CAS push를 수행한다.

### C-21 Workbench UI WSL runtime result successor — seq591~596

- 담당: `developer-primary`; 시작 branch/HEAD: `codex/c21-operational-execution` / `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`.
- 기존 seq1~590과 historical evidence는 byte 불변으로 보존하고, 실제 WSL 실행 결과를 신규 exact12 / cumulative exact195 successor에만 기록한다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k runtime_result` → `2 failed, 1 passed, 224 deselected`, exit1. 신규 builder와 metadata 함수 부재가 의도한 실패 원인이다. fingerprint `C21_WORKBENCH_UI_WSL_RUNTIME_RESULT_UNBOUND_R1` 1회.
- exact12 hash는 Windows `D1965266EBE7DDC3D4D6B0D01A2E71EA276DDFF378B0793E5895E2FB8F07F348`, ordinal `B345B0586EC4A8937238324EAC5F6FC9046C848F9B171B5E6CB6B83DDA9A6346`; cumulative exact195 hash는 Windows `5F63907A3D63D0350B68EC277B9703EB6AB9D0631E583427BADC2D53A1A13F00`, ordinal `CAD44AA61C8F359D0AD5FE19DABD70C4F7BE2106FC9EC4C59BD3E2EBFF89C516`다.
- 첫 GREEN 시도는 신규 Git collector의 괄호 1개 누락으로 compile SyntaxError를 냈다. fingerprint `SEQ596_CHECKER_COLLECTOR_SYNTAX_R1` 1회. 즉시 최소 수정했고 focused `3 passed, 224 deselected`, exit0으로 해소했다. 기본 `py_compile`은 기존 접근 불가 `scripts/__pycache__` 때문에 code compile과 무관한 permission error가 발생하여, 최종 검증은 허용된 별도 pycache 경로로 재실행한다.
- generated progress/event/HANDOFF/detached digest/manifest 5개를 materialize한 뒤 live checker는 `PASS sequence=596 reporting=AUTO_CONTINUE`, focused seq590+596 영향 범위는 `3 passed, 224 deselected`다. builder 2회 byte equality와 historical seq1~590 raw prefix equality도 PASS했다.
- receipt overwrite 경계를 명시했다. pre-migration backup과 verification receipt hash는 final deploy/final verify의 현재 상태만 증명하며, 첫 verify의 독립 file evidence로 주장하지 않는다. rollback receipt는 보존 상태로 별도 결박한다.
- 전체 tooling: `592 passed, 1 failed in 716.23s`, exit1. 실패는 historical `A13RepositoryScanArtifactTests::test_checker_validates_reusable_contract_and_eight_fixtures`의 `PUBLIC_RESULT_SCHEMA_MISMATCH`다. fingerprint `HISTORICAL_A13_MODULE_CACHE_SCHEMA_R1` 1회.
- 위 테스트는 단독 실행하면 `1 passed in 12.84s`, A13 파일 전체에서는 `62 passed, 1 failed in 48.04s`로 재현됐다. historical checker가 같은 process에서 먼저 import된 current `packages.repository_intelligence.ScanResult` module cache를 재사용하여 accepted A-13 schema 대신 현재 확장 schema를 읽는 기존 순서 의존 fixture 문제다. seq596 exact12와 무관하고 exact12 밖 historical test는 변경 금지이므로 수정하지 않는다.
- 미검증 경계: 동일 process 전체 tooling의 clean PASS는 위 기존 historical fixture 실패 때문에 확보하지 못했다. seq596 focused/live/determinism/raw history/exact Git 검증은 별도로 완료하고, 전체 suite를 PASS로 과장하지 않는다.
- 최종 precommit 검증: seq590+596 focused `3 passed, 224 deselected`; live checker `PASS sequence=596 reporting=AUTO_CONTINUE`; in-memory compile, deterministic builder, seq1~590 raw prefix, strict manifest, `git diff --check` 모두 PASS다. Git collector는 K+dirty exact12와 validated base cumulative exact195, private control K/candidate S를 PASS했다.
- 최초 postcommit `git diff --check HEAD^ HEAD`에서 신규 validation/WI/prompt 3개 EOF 여백을 발견했다. fingerprint `SEQ596_NEW_DOC_EOF_BLANK_R1` 1회. 신규 exact12 내부 비의미 포맷 오류이므로 제거하고 generated hashes를 재결박한 뒤 동일 direct-child commit을 amend한다.

### C-21 A13 historical module isolation successor — seq597~602

- 담당: `developer-primary`; 인수 branch/HEAD: `codex/c21-operational-execution` / `6e06810ea02b72e5642da8258cd0ae5fb6d87dc6` (clean).
- 범위: seq1~596, historical evidence, 제품 코드는 불변으로 보존하고 `tests/tooling/test_a13_repository_scan.py`의 historical import만 context-managed isolation한다. `packages`와 `packages.repository_intelligence*` module cache 및 `sys.path`를 성공·예외 모두에서 정확히 복원한다.
- 계획 경계: 신규 exact13, cumulative exact201, seq597~602 lifecycle. Provider·Telegram·WSL·ysna·main·push는 수행하지 않는다.
- 다음: 순서 의존 2-node 재현 테스트와 예외 복원 negative 테스트를 먼저 추가하고 RED를 확인한다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider -k "historical_checker_isolates_package_modules_across_two_nodes or historical_checker_restores_modules_and_path_after_exception"` → `2 failed, 63 deselected`, exit1. 두 테스트 모두 기존 `_historical_checker`가 tuple을 반환하여 context manager protocol을 제공하지 않는 예상 이유로 실패했다. fingerprint `A13_HISTORICAL_IMPORT_ISOLATION_MISSING_R1` 1회.
- 다음: helper를 context manager로 전환하고 historical root를 `sys.path` 최우선에 잠시 설정하며, `packages`/`packages.repository_intelligence*`와 checker module을 `finally`에서 정확히 복원한다.
- GREEN focused: 위 helper를 context manager로 전환하고 6개 historical caller를 context 범위로 제한했다. RED와 동일 명령은 `2 passed, 63 deselected in 24.78s`, exit0이다. 성공 노드 2개 사이와 강제 예외 후 모두 original module identity 및 `sys.path` exact list가 복원됨을 확인했다.
- 다음: A13 파일 전체를 단일 process에서 실행해 기존 `PUBLIC_RESULT_SCHEMA_MISMATCH` 순서 의존성 해소와 회귀를 확인한다.
- A13 전체 GREEN: `.venv\Scripts\python.exe -m pytest tests/tooling/test_a13_repository_scan.py -q -p no:cacheprovider` → `65 passed in 72.01s`, exit0. 기존 전체 실행의 `PUBLIC_RESULT_SCHEMA_MISMATCH`가 재발하지 않았다.
- seq602 projection TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq602` → `2 failed, 227 deselected`, exit1. 신규 builder/metadata가 없는 예상 이유로 실패했다. fingerprint `C21_A13_MODULE_ISOLATION_PROJECTION_UNBOUND_R1` 1회.
- 다음: seq596을 parent로 하는 seq597~602 append-only builder, strict manifest/projection/Git predicate를 추가하고 exact13/cumulative201을 결박한다.
- seq602 focused GREEN: builder, metadata, strict manifest/projection validator, seq602 우선 Git predicate와 manifest routing을 구현했다. `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k seq602` → `2 passed, 227 deselected in 2.21s`, exit0.
- 터미널 상태는 seq596과 동일하게 `READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`, next action은 `INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`이며 acceptance/C-01/DIR-2 차단을 그대로 유지한다.
- 다음: 신규 generated5를 materialize하고 live checker와 byte determinism을 확인한다.
- generated5 최초 materialize는 sandbox가 `D:\tmp` exec write를 거부하여 `PermissionError` exit1이었다. fingerprint `SEQ602_GENERATED_WRITE_SANDBOX_DENIED_R1` 1회. 플랫폼 실행 권한을 정식 요청해 동일 builder를 성공적으로 실행했다.
- 첫 live checker는 `EVENT_EFFECT_MISMATCH`, `GIT_PRIVATE_AUTHORITY_MISMATCH` exit1이었다. fingerprint `SEQ602_EVENT_REMOTE_AND_PRIVATE_CONTROL_BINDING_R1` 1회. seq602 completion event에 seq596의 public upstream projection을 유지하는 `completion_upstream_head`가 없었고, private control ref는 push 금지 경계에서 실제로는 seq590 control `8fe7b97...`을 유지하고 있었다. 실제 권위를 manifest/collector에 정확히 결박해 교정했다.
- 교정 후 generated5 materialize 및 live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`, exit0이다.
- exact13 hash는 Windows `3363F8F3DB4BE55C2D4CC12FCDD60D8EDEEDA46C7385CE87A92FAD6B72FF820A`, ordinal `7EBDAF635BD89CFBFB9B183003613CE433A9929405AF74005DDDF85A5CB0DF42`; cumulative exact201 hash는 Windows `DF0884A6F6AA73738488487E4A8C5181A6022FA4443DDCF1E28B69FA6EA3882D`, ordinal `FF0B9643404E4EA080313E43AD52BC3D356A82710415162B437C2914FFBA8312`다.
- 다음: 정적 metadata hash를 고정한 generated5를 재생성한 뒤 focused/A13 회귀와 전체 tooling을 실행한다.
- metadata hash 고정 후 focused seq596+602는 `4 passed, 225 deselected in 1.68s`, A13 전체는 `65 passed in 88.50s`, live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`로 모두 exit0이다.
- 다음: generated5를 최신 WORK_STATUS hash로 재생성하고 `tests/tooling` 전체를 단일 process에서 실행해 전체 통과를 확인한다.
- 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `597 passed in 1247.18s`, exit0. 기존 기대 595는 seq602 projection 테스트 2개를 전체 수에 포함하지 않은 계산 오류였고, 실제 collection 결과 597로 evidence/contract를 정정했다. fingerprint `SEQ602_TOOLING_EXPECTED_COUNT_CORRECTION_R1` 1회.
- 장시간 테스트 상태 확인 중 `Get-CimInstance Win32_Process`는 OS access denied로 실패했다. fingerprint `SEQ602_PROCESS_COMMANDLINE_DIAGNOSTIC_DENIED_R1` 1회(제품/테스트 실패 아님). `Get-Process`로 worker/launcher의 `Responding=True`와 CPU 증가를 확인했다.
- 다음: 597 evidence 정정 후 generated5를 재생성하고 focused/live/determinism/history/Git 최종 검증을 수행한다.
- 597 evidence 정정 후 seq596+602 focused는 `4 passed, 225 deselected in 1.76s`, live checker는 `PASS sequence=602 reporting=AUTO_CONTINUE`, 모두 exit0이다.
- generated5 2회 byte equality, materialized generated5 equality, seq1~596 raw event object prefix, strict manifest, raw checksum row 12개, exact13/cumulative201 metadata, `git diff --check`는 모두 PASS했다.
- precommit status는 선언된 exact13만 dirty/untracked이며 제품 코드·historical evidence 변경은 0건이다. 다음: WORK_STATUS 최종 hash를 generated5에 재결박하고 quick final verification 후 단일 commit한다.
## 2026-09-08 C-21 A13 historical module isolation CAS publication — seq603~608

- 담당 agent: `developer-primary`; 시작 branch/HEAD: `codex/c21-operational-execution` / `6134e4140d2017536563babc907c631853509ae5`; 시작 worktree clean.
- 실제 private authority read-only 확인: `development=git@github-sinsan-develop:sinsan-develop/Anvil.git`, control `6134e4140d2017536563babc907c631853509ae5`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq603~608 append-only publication projection, exact12/cumulative207, previous control `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`에서 published control `6134e4140d2017536563babc907c631853509ae5`로의 CAS PASS 기록. seq1~602, historical evidence, `tests/tooling/test_a13_repository_scan.py`, 제품 코드는 불변이다.
- TDD RED: `.venv\\Scripts\\python.exe -m pytest tests\\tooling\\test_project_progress.py -q -p no:cacheprovider -k seq608` → `2 failed, 229 deselected`, exit1. 신규 builder/metadata 부재의 예상 실패이며 fingerprint `C21_A13_CAS_PUBLICATION_PROJECTION_UNBOUND_R1` 1회다.
- 외부 push, WSL, ysna, main, Provider, Telegram은 이번 writer 범위에서 `NOT_EXECUTED`다.
- 동일 시스템 안전 검사 거절이 3회 발생했다. fingerprint `SEQ608_CAS_RECEIPT_SAFETY_REJECTION_R1`, 누적 3회. subagent가 Main 메시지로 전달된 실제 tool receipt를 독립 tool receipt로 인정하지 못해 CAS PASS 영구 기록을 거부한 것이며 제품·Git 실행 실패가 아니다.
- 3회 규칙에 따라 `developer-primary` write lease를 회수하고 Main Agent가 인수했다. 인수 시 dirty 경로는 `docs/WORK_STATUS.md`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py` 3개이며 신규 generated artifact는 아직 없었다.
- Main 직접 실행 증거: preflight `git ls-remote` exit0에서 control=`8fe7b975f39990b3d721d27b1a3e9353f891c5c1`, candidate=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`; CAS 명령 `git push development 6134e4140d2017536563babc907c631853509ae5:refs/heads/codex/c21-operational-execution --force-with-lease=refs/heads/codex/c21-operational-execution:8fe7b975f39990b3d721d27b1a3e9353f891c5c1` exit0; postflight `git ls-remote` exit0에서 control=`6134e4140d2017536563babc907c631853509ae5`, candidate=`f0d4bc7badbdae69c2d2b21089667fdcc636518d`다. source=`MAIN_AGENT_DIRECT_TOOL_RECEIPT`, secret/token은 없다.
- 다음: 실제 receipt를 strict manifest에 결박하고 신규 문서와 generated5를 생성한 뒤 GREEN·전체 tooling·독립 review를 수행한다.
- Main 인수 후 신규 문서 4개와 receipt field를 추가하고 generated5를 생성했다. 첫 live checker는 `EVENT_EFFECT_MISMATCH`였으며 fingerprint `SEQ608_COMPLETION_UPSTREAM_EFFECT_R1` 1회다. seq608 완료 Event에 기존 public upstream projection을 유지하는 `completion_upstream_head=ca92b7845eda803cff3c432799642e4f9243d4d6`이 빠진 것이 원인이므로 seq602와 동일한 불변 upstream을 추가했다.
- completion effect 교정 후 focused seq602+608은 `4 passed, 227 deselected`, live checker는 `PASS sequence=608 reporting=AUTO_CONTINUE`로 통과했다.
- sandbox 전체 tooling 실행은 45분 이상 진행된 뒤 장기 fixture에서 정상 기준(직전 약 21분)의 2배를 넘어 Main이 진단을 위해 중단했다. fingerprint `SEQ608_TOOLING_SANDBOX_LONG_RUNNING_R1` 1회. worker는 중단 전까지 `Responding=True`, CPU 증가, 메모리 안정이었으며 제품 실패로 판정하지 않는다.
- `-x` 재실행으로 최초 실패를 분리한 결과 `G06TestAssetContractTests::test_ts_clean_uses_offline_local_typescript_593_and_typechecks`가 Windows npm cache 파일 `stat`에서 `EPERM`으로 실패했다(`1 failed, 255 passed in 110.45s`). fingerprint `SEQ608_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1` 1회. 이는 sandbox가 `C:\Users\cyhuh\AppData\Local\npm-cache` 읽기를 거부한 환경 권한 오류이며 제품·seq608 회귀가 아니다.
- 다음: 동일 canonical 전체 tooling을 권한이 허용된 실행 경계에서 fresh 재실행하고 실제 결과를 기록한다.
- 권한 허용 경계에서 canonical 전체 tooling을 fresh 재실행했다: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `599 passed in 1125.72s (0:18:45)`, exit0. sandbox npm cache EPERM은 재발하지 않았고 failure/error는 0이다.
- 다음: 전체 PASS 증거를 generated5에 재결박하고 focused/live/determinism/history/Git 검증 후 exact12 단일 commit과 독립 review를 수행한다.
- 최종 precommit 검증: isolation+seq602+seq608 focused `6 passed, 290 deselected in 28.34s`; live checker `PASS sequence=608 reporting=AUTO_CONTINUE`; generated5 2회 byte equality와 materialized equality `SEQ608_GENERATED5_DETERMINISTIC_PASS`; `git diff --check` PASS다.
- dirty/untracked 경로는 선언된 exact12와 일치하며 seq1~602 raw prefix, cumulative207, 제품/A13 isolation/historical evidence 불변 계약은 seq608 focused validator가 확인했다. 다음: WORK_STATUS hash를 마지막 재결박 후 단일 direct-child commit을 생성한다.
# 2026-09-08 C-21 Workbench UI WSL authenticated browser probe R1 — seq609~614

- 담당: `developer-primary`; 시작 기준: clean `4ad596f603987f7a87b4396de035fd49ddc274f6`, branch `codex/c21-operational-execution`.
- 범위: exact13 Git-only probe 계약. 제품·배포·DB·Provider·Telegram·WSL·ysna·main은 변경 또는 실행하지 않는다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k 'seq614 or probe_self_test'` → exit 1, `3 failed, 231 deselected`. seq614 builder/metadata 부재 2건과 새 self-test mode 부재가 의도한 실패 원인이다. Playwright eager load가 schema-only self-test보다 먼저 실패한 현상은 새 mode가 runtime dependency 없이 secret-safe receipt schema를 검증해야 한다는 계약으로 함께 고정한다.
- 다음 조치: browser probe env-only mode와 schema-only self-test를 최소 구현하고, seq609~614 append-only projection/checker를 결박한 뒤 집중·전체 검증한다.
- 구현 GREEN: seq614 및 browser 입력 경계 집중 검증 `4 passed, 231 deselected`; 동일 fingerprint 반복 0회다.
- 환경 오류: sandbox 기본 권한에서 `docs/progress/progress-events.json` 생성 projection 쓰기가 `PermissionError`로 1회 거부됐다. 제품/생성기 오류가 아니며 플랫폼의 D:\tmp 쓰기 승격으로 동일 builder를 재실행해 generated5를 기록했다.
- projection 보완: 최초 live checker는 completion Event의 `completion_upstream_head` 누락으로 `EVENT_EFFECT_MISMATCH` 1회였다. predecessor repository remote 값을 명시해 재결박했고 live checker는 `PASS sequence=614 reporting=AUTO_CONTINUE`다. 동일 fingerprint 반복 0회다.
- 추가 TDD RED/GREEN: 상대 screenshot root가 repository 쓰기로 해석될 수 있는 실패를 1회 재현하고 원문 absolute path만 허용하도록 수정했다. seq614/browser 집중 검증은 `5 passed, 231 deselected`다.
- 관련 검증: `node --check tests/browser/c21-network-probe.mjs` exit 0; Web `12 passed`; API `41 passed`; 기존 `--workbench-self-test`는 실제 headless Chromium click/network를 통해 Provider GET 및 SSE Last-Event-ID 재개를 통과했다. Web 시험의 기존 `MODULE_TYPELESS_PACKAGE_JSON` 경고는 제품 오류로 승격하지 않는다.
- actual `--wsl-workbench-auth` WSL 실행과 실제 screenshot 생성은 이 Git-only package에서 `NOT_EXECUTED`다.
- 전체 progress tooling: `.venv\Scripts\python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider` → exit 0, `236 passed in 1009.65s`. 실패 0이다.
- 독립 Reviewer R1: `REWORK / C0 / I3 / M0`. Important 3건은 screenshot root의 승인 temp 경계·비덮어쓰기/정리 계약 부족과 `Last-Event-ID` exact 값 비교 부족이다. exact13 안에서 TDD rework하며 acceptance/runtime 경계는 바꾸지 않는다.
- Main fresh 전체 tooling 기준: `604 passed in 1202.30s`, exit 0. 보완 후 동일 전체 범위를 다시 실행한다.
- Rework TDD RED: temp root/cleanup 및 bad cursor self-test 부재 `2 failed`; manifest 확장 계약 부재 `1 failed`. 서로 다른 root cause 각 1회이며 반복 0회다.
- Rework GREEN: 승인 temp prefix, unique non-existing/exclusive run directory, arbitrary/repository/existing/symlink-junction-reparse-realpath escape 거부, success/failure cleanup receipt, `Last-Event-ID == initial eventId` exact 비교와 missing/stale/wrong negative 계약을 구현했다. 집중 `7 passed, 231 deselected`, Node syntax exit 0이다.
- post-create race 보완 TDD RED/GREEN: 생성 후 symlink/reparse 교체 거부 증거 부재 `1 failed` 후 created run directory realpath를 재검증하고 screenshot buffer를 `wx` exclusive write하도록 수정했다. 집중 `2 passed, 236 deselected`; 동일 fingerprint 반복 0회다.
- Browser negative/actual/schema self-tests: page fetch scope PASS, cross-origin rejection PASS, 실제 headless Workbench Provider click + SSE Last-Event-ID PASS, schema-only root/cursor/screenshot receipt PASS. Web `12 passed`, API `41 passed`, Node syntax/diff-check PASS다.
- Rework generated5를 a4ad8e2 위 dirty 상태에서 임시 확인할 때 live checker는 postcommit clean-only gate에 따라 `GIT_DESCENDANT_RECORD_COMMIT_INVALID` 1회를 반환했다. 이는 a4ad8e2 amend 전 예상된 Git transition이며 final amend 후 clean direct-child에서 재검증한다.

## 2026-09-08 C-21 seq615~620 WSL authenticated browser runtime result R1

- 담당: `developer-primary`; 인수 parent/control `c4f219b214cd6bfd6fabf7fe69e26a8995ae098a`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, validated base `eef349682ff5598e3488c9e75163c5e0a99a0bdb`.
- 단계: preflight `PASS`; deploy attempt 1 `FAIL`; verify/browser PG15/browser PG18RC `NOT_EXECUTED`; cleanup attempt 1 `PASS`; postcondition `PASS`.
- 오류 횟수: runtime invocation lineage `C21_AUTH_BROWSER_CONTROL_REF_MISBOUND` valid failure 1. `ANVIL_CANDIDATE_MANIFEST_REF`를 control-runtime checkout에도 사용하는 현재 인터페이스에 candidate ref를 전달하여 observed checkout `f0d4bc7...`가 trusted control `c4f219b...`와 달랐고 mutation 전 exit3으로 거부됐다.
- WSL preflight: host `SINSAN`, user `daon`, application repo exact candidate/clean, private refs exact, validated base ancestor PASS, `.env` owner root/mode600/hash `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, bootstrap-token name/RUN_IDS/scope name presence 및 `provider:read` scope PASS. 값은 출력하지 않았다.
- immutable hashes: manifest `a1bb21983ef5791c5025e8487675801cb824b2066f5c9d9f8dcf092ec1d6d82b`, control-runtime `d0ff497b22851dfc6cb3fa36c761d8bb69ded1cb7a838e81ef55c4a459570097`, deploy `7b6ee6a02bed857299423f78c73d746b6f8ac8c0cc40e3a611ece06e43e1c1c0`, verify `93e882d35c055535a7d989962fe0ee0ec49b91542eb462b655f1477dd2562a36`, cleanup `65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d`.
- cleanup: 올바른 control ref로 표준 cleanup 1회, exit0. active control exact `c4f219b...`/clean.
- 사후: application repo exact candidate/clean, `.env` mode/hash byte-identical, PG15/PG18RC container0/network0, exact volume2 residue0.
- 비밀 안전성: credential value, token, cookie, header, raw URL은 stdout·문서·event·manifest에 기록하지 않았다. screenshot files/directories/residue도 0이다.
- 미검증: actual deploy/verify, authenticated browser 3 viewport, Provider UI read/GROQ click, SSE/Last-Event-ID. Provider 외부·Telegram·ysna·main·C-01은 제외 유지.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered.
- 다음: control checkout ref와 candidate manifest ref 역할을 분리한 별도 successor runtime attempt를 발행한다. 이번 실패 evidence는 보존한다.
- TDD RED: seq620 focused에서 신규 builder/metadata 부재로 `2 failed, 238 deselected`, exit1을 확인했다. GREEN: strict failure result/checksum/tamper 계약 구현 후 `2 passed, 238 deselected`, exit0이다.
- generated5 최초 materialize는 sandbox의 `D:\tmp` 쓰기 제한으로 `PermissionError` 1회가 발생했다. 제품/생성기 실패가 아니며 승인된 격리 worktree 쓰기 경계에서 동일 권위 생성기를 실행해 생성했다.
- live checker: `G-05 project progress contract: PASS sequence=620 reporting=AUTO_CONTINUE`, exit0.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `608 passed in 1214.47s (0:20:14)`, exit0.
- 용어 경계: WSL browser/API/DB/runtime은 개발단계 검증이다. 사용자 인수·외부 테스트·개발 완료로 승격하지 않는다. 작업계획서 자체 용어 정정은 exact12 밖이므로 후속 별도 projection 대상으로 남긴다.
- final focused seq614+seq620+probe: `9 passed, 231 deselected`, exit0. generated5 두 번 생성 결과 및 materialized bytes 동일 `SEQ620_GENERATED5_DETERMINISTIC_PASS`; `git diff --check` PASS.
- exact 경로는 설계된 12개와 일치하고 cumulative219 hash는 Windows `52936B5F9C6861EE6FAE270F747A6318502747539E8E66B285DA2811612D4E6D`, ordinal `7478D25196E94EB84E45BCE779E685937DB29E5736C8F482A7CD52D6040C40E2`다.
- 진단 오류 원장: sandbox 기본 WSL 호출 `E_ACCESSDENIED` 1회(플랫폼 권한, 승격 후 해소); root 소유 repo의 dubious ownership와 `.env` read denial 1회(전역 설정 변경 없이 command-local `safe.directory`와 기존 sudo read로 해소); sudo가 daon SSH alias/known_hosts를 상속하지 못한 private fetch 실패 2회(직접 `github.com` host와 기존 daon deploy key/known_hosts 명시로 해소); PowerShell/WSL 중첩 변수·quote 진단 명령 실패 2회(고정 literal 명령으로 해소); post-cleanup active-stage 동적 경로 검사 실패 1회(관측 stage literal read-only 검사로 exact control/clean 확인). 이들은 runtime deploy valid failure 횟수에 포함하지 않는다.

## 2026-09-08 C-21 seq621~626 WSL authenticated browser runtime retry result R2

- 담당: `developer-primary`; parent/control `a9243cc9969de58e4b230ff028fca1fe95e14778`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- seq620 independent review `COMMIT_READY C0/I0/M0`와 private CAS publication을 Main으로부터 인수했다. candidate는 불변이다.
- preflight: private control/candidate exact, candidate ancestor of control, application exact candidate/clean, `.env` mode600/hash `fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a`, required names 및 provider:read scope, initial residue0 모두 PASS. 값은 출력하지 않았다.
- attempt 2: `ANVIL_CANDIDATE_MANIFEST_REF=refs/remotes/origin/codex/c21-operational-execution`, trusted control exact a9243cc, EXPECTED candidate exact f0d4bc7로 분리했다.
- deploy `FAIL`, exit128. control stage exact a9243cc 생성 후 application repo의 기존 origin hostname alias를 root 실행이 해석하지 못해 `git fetch origin`에서 mutation 전 중단됐다. fingerprint `APPLICATION_ORIGIN_ALIAS_UNRESOLVED_UNDER_ROOT`, 현재 root cause 1회다.
- 계약에 따라 실패를 재실행하지 않았다. verify/browser PG15/browser PG18RC는 `NOT_EXECUTED`다.
- cleanup: 표준 control-runtime cleanup 정확히 1회, exit0. 사후 application repo exact candidate/clean, env mode/hash byte-identical, PG15/PG18RC container/network 0, exact volume residue0.
- secret 값, token, cookie, header, raw URL, screenshot 파일은 기록·생성하지 않았다. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_2`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered.
- 용어: WSL browser/API/DB/runtime은 개발단계 검증이며 사용자 인수·외부 테스트·개발 완료로 표현하지 않는다.
- 다음: application fetch의 alias 해석 경계를 분석한다. 이번 attempt2 evidence는 보존한다.
- TDD RED: seq626 builder/metadata 부재로 `2 failed, 240 deselected`, exit1.
- TDD GREEN: strict attempt2 failure projection/checker를 구현한 뒤 seq626 focused는 `2 passed, 240 deselected`, seq620 회귀 포함 focused는 `4 passed, 238 deselected`, 모두 exit0이다.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `610 passed in 1176.53s (0:19:36)`, exit0. failure/error는 0이다.
- 다음: 전체 PASS 영수증을 generated5에 재결박하고 focused/live/determinism/exact12/Git 계보를 최종 검증한 뒤 parent a9243cc의 단일 direct-child commit으로 고정한다.
- precommit 최종 검증: seq620+seq626 focused `4 passed, 238 deselected`; live checker `PASS sequence=626 reporting=AUTO_CONTINUE`; generated5 2회 byte equality와 materialized equality `SEQ626_GENERATED5_DETERMINISTIC_PASS`; exact12 Windows/ordinal 및 cumulative225 Windows/ordinal hash 일치; parent a9243cc exact; `git diff --check` PASS다.

## 2026-09-08 C-21 seq627~632 WSL authenticated browser runtime retry R3 result

- 담당: `developer-primary`; parent/control `2d4a2c90fb6f3d4e38ba311f9e13294a8fe67be0`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- Main orchestration 오류 `MAIN_R3_WRONG_WORKDIR_CREATEPROCESS_R1` 1회: canonical worktree가 아닌 잘못된 workdir로 프로세스를 생성하려다 실패했다. 제품·WSL·Git 실행 실패가 아니며 canonical worktree로 교정했다.
- 범위: seq627~632 append-only exact12 projection 및 actual WSL development validation attempt 3. 제품/deploy/probe/WorkPlan/historical 파일은 변경하지 않는다.
- 다음: seq632 strict success/failure projection/checker 계약을 TDD RED로 고정한 뒤 secret-safe preflight와 단일 runtime attempt를 실행한다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -q -p no:cacheprovider -k seq632` → `2 failed, 242 deselected`, exit1. 신규 R3 builder/metadata 부재의 예상 실패이며 fingerprint `C21_AUTH_BROWSER_RUNTIME_R3_PROJECTION_UNBOUND_R1` 1회다.
- 다음: WSL child env에서 explicit `GIT_SSH_COMMAND` presence/exact와 private refs/repo/env/scope/residue를 secret-safe 확인한 뒤 attempt 3을 1회 실행한다.
- 플랫폼 안전 심사 거절 2회는 actual runtime 실행 전 `PLATFORM_SAFETY_REVIEW_REJECTION`으로 분리하며 attempt 3 횟수에 포함하지 않는다. 세 번째 요청은 사용자 중단으로 판정되지 않았고 제품·WSL mutation 증거가 없다.
- actual attempt 3 preflight: host/user `SINSAN`/`daon`, private control/candidate `2d4a2c90...`/`f0d4bc7...`, application candidate/clean, env mode600/hash `FECAE53B...52A79A`, required names/provider:read scope, initial container/network/exact-volume residue `0/0/0`, lock absent가 PASS했다.
- deploy exact1은 control runtime을 표준 `bash script` 호출 대신 직접 실행하여 `/srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh: Permission denied`, exit126으로 application/Docker mutation 전에 실패했다. fingerprint `CONTROL_RUNTIME_DIRECT_EXEC_PERMISSION_DENIED_R3` 유효 실패 1회다. verify/PG15/PG18 authenticated browser는 `NOT_EXECUTED`이며 재실행하지 않았다.
- cleanup exact1도 동일 direct-exec 오류로 exit126/FAIL이다. read-only 사후 관측은 container/network/exact-volume/lock residue `0/0/0/0`, application `f0d4bc7...` clean, env mode/hash byte-identical이다. malformed bash arg1 및 wrong Windows cwd Git discovery2는 preflight orchestration abort이며 runtime mutation0이다. receipt 뒤 `exit 30\\r` 메시지는 PowerShell CRLF 오류로 second attempt가 아니다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_3`; WSL 개발단계 검증 실패이며 accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 다음 안전 조치: 별도 successor에서 `sudo -n env GIT_SSH_COMMAND=... bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh deploy <candidate>`를 사용하고 cleanup도 `bash`로 호출한다.
- 경로 계약 재검산: repository `_c21_path_list_sha`로 exact12 Windows/ordinal `227E0B11...784E4B`/`3FDD92F6...73E3E`, cumulative231 `1701B4B8...65B15`/`4491BC45...EEE6C`가 모두 일치했다. 최초 독립 계산의 경로 입력 오류는 계약 오류로 계상하지 않는다.
- Main의 exact 경로 전달 중 manifest `WORKBENCH_UI_UI`, validation `WORKBEN_UI` 오타 1회는 즉시 정정됐으며 오타 경로 파일은 생성하지 않았다. fingerprint `MAIN_R3_EXACT_PATH_TRANSMISSION_TYPO_R1` 1회다.
- TDD GREEN: seq632 focused `2 passed, 242 deselected`; seq626 회귀 포함 focused `4 passed, 240 deselected`; live checker `PASS sequence=632 reporting=AUTO_CONTINUE`다.
- canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `612 passed in 1060.58s (0:17:40)`, exit0. failure/error는 0이다.
- 다음: 위 fresh 영수증을 generated5에 재결박하고 focused/live/determinism/exact12/Git 계보를 최종 검증한 뒤 parent `2d4a2c9`의 단일 direct-child commit으로 고정한다.
- precommit 최종 검증: seq626+seq632 focused `4 passed, 240 deselected`; live checker `PASS sequence=632 reporting=AUTO_CONTINUE`; generated5 2회 및 materialized bytes 동일 `SEQ632_GENERATED5_DETERMINISTIC_PASS`; exact12/cumulative231 Windows·ordinal hash 일치; parent `2d4a2c9` exact; `git diff --check` PASS다.

## 2026-09-08 C-21 seq633~638 WSL authenticated browser runtime retry R4 result

- 담당: `developer-primary`; parent/control `eafe12a3d64bd0d4f6f91924fcc35a20ab7dd07a`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 시작 상태: branch `codex/c21-operational-execution`, HEAD/upstream private control `eafe12a3d64bd0d4f6f91924fcc35a20ab7dd07a`, tracked worktree clean. seq1~632, attempt1~3, historical evidence는 불변이다.
- 범위: seq633~638 append-only exact12 projection 및 actual WSL development validation attempt 4 정확히 1회. 제품/deploy/probe/WorkPlan은 변경하지 않는다.
- TDD RED: `.venv\Scripts\python.exe -m pytest tests\tooling\test_project_progress.py -q -p no:cacheprovider -k seq638` → `2 failed, 244 deselected`, exit1. 신규 R4 builder/metadata 부재의 예상 실패이며 fingerprint `C21_AUTH_BROWSER_RUNTIME_R4_PROJECTION_UNBOUND_R1` 1회다.
- 다음: strict R4 projection/checker의 최소 구현 후 child `ls-remote`·ref·repo·env·residue preflight를 수행하고, 모든 runtime action을 outermost `sudo -n env`와 explicit `GIT_SSH_COMMAND`, 명시 hash, `bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh <action> f0d4bc7...`로 호출한다.
- 최초 child `ls-remote`는 미등록 residual key `id_ed25519_github_sinsan_develop`을 잘못 지정해 publickey exit1이었다. runtime attempt는 시작되지 않았고, read-only key inventory에서 기존 승인 transport `/home/daon/.ssh/sinsan-develop`을 확인해 교정했다. fingerprint `R4_PREFLIGHT_WRONG_EXISTING_KEY_SELECTION_R1` 1회다.
- env preflight 진단에서 이전 추정 변수명이 실제 `.env` 이름과 달라 silent exit1이 1회 발생했다. 값은 출력하지 않았고 실제 exact6 이름과 `ANVIL_TEST_SESSION_PERMISSION_SCOPES`의 `provider:read` presence로 교정했다. fingerprint `R4_PREFLIGHT_ENV_NAME_ASSUMPTION_R1` 1회다.
- 최종 preflight PASS: host/user `SINSAN/root`, private control/candidate `eafe12a...`/`f0d4bc7...`, application exact candidate/clean, env mode600/hash `FECAE53B...52A79A`, required names exact6/provider:read, initial container/network/exact-volume/lock residue `0/0/0/0`, explicit Git SSH transport와 immutable manifest/action hash presence를 확인했다.
- actual deploy exact1은 outermost `sudo -n env`와 explicit Git SSH transport/hashes, `bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh deploy f0d4bc7...`로 호출했다. control stage는 `eafe12a...`에 결박됐고 application origin fetch 후 exit1 실패했다. 재실행하지 않았으며 verify/PG15/PG18RC authenticated browser는 `NOT_EXECUTED`다.
- read-only lineage 진단: control `eafe12a...` parent는 `2d4a2c9...`, candidate→control은 56 paths다. active guard는 candidate `f0d4bc7...`의 single direct-child exact12를 요구하므로 충돌한다. fingerprint `WORKBENCH_CANDIDATE_CONTROL_DIRECT_CHILD_MISMATCH_R4` 1회이며 확인된 사실과 원인 추론을 구분한다.
- cleanup exact1은 같은 outermost transport로 `bash ... control-runtime.sh cleanup f0d4bc7...`을 호출했으나 전달된 cleanup hash에서 `B` 1자가 누락되어 `trusted control identity format is invalid`, exit1로 mutation 전에 실패했다. 재실행하지 않았다. fingerprint `CONTROL_CLEANUP_HASH_FORMAT_INVALID_R4` 1회다.
- 사후 read-only: application `f0d4bc7...` clean, env mode/hash byte-identical, approved runtime container/network/exact-volume/lock/screenshot residue `0/0/0/0/0`; active control stage1은 `eafe12a...` clean이다. Secret/token/cookie/header/raw URL 값과 screenshot 파일은 생성·기록하지 않았다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_4`; classification `WSL_DEVELOPMENT_VALIDATION`, accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider 외부·Telegram·ysna·main·C-01은 `NOT_EXECUTED`다.
- 실제 결과 TDD RED: seq638 신규 strict failure assertion은 기존 success template 때문에 `1 failed, 2 passed, 244 deselected`, exit1. GREEN에서 deploy/cleanup exact1 실패, 후속 미실행, residue와 경계 계약을 결박해 `3 passed, 244 deselected`, exit0이다.
- 다음 안전 조치: candidate의 single direct-child exact12 immutable runtime control ref를 별도 successor로 발행·결박하고 정확한 cleanup hash를 사용한 새 attempt를 준비한다. 이번 attempt4 evidence는 덮어쓰지 않는다.
- 인수 시 이전 canonical 전체 tooling 실행은 약 70%에서 사용자 중단으로 프로세스가 종료됐다. provisional failure 1건이 화면에 보였으나 최종 traceback·exit code가 없어 `INTERRUPTED_NON_RESULT`로 분류하며 PASS·FAIL·정식 failure 횟수에 포함하지 않는다.
- 인수 후 WSL read-only 재확인: application `f0d4bc7...` clean, active control stage `eafe12a...` clean, publish lock과 Anvil 전용 container/network/지정 volume residue 0. actual deploy/verify/browser/cleanup은 재실행하지 않았다.
- 인수 후 fresh canonical 전체 tooling: `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider` → `615 passed in 793.94s (0:13:13)`, exit0. 실패·오류·skip은 0이다.
- 첫 live checker 인수 호출은 지원하지 않는 `--root` 옵션을 전달해 `--root`가 root 위치 인자로 해석되면서 `LOAD_ERROR`, exit1로 종료됐다. fingerprint `LIVE_CHECKER_ROOT_FLAG_USAGE_R1` 1회이며 제품·projection·runtime 실패가 아니다. 올바른 위치 인자 `.`로 교정한다.
- precommit 최종 검증 준비: seq632+seq638 focused `5 passed, 242 deselected`; 교정 live checker `PASS sequence=638 reporting=AUTO_CONTINUE`; generated5 두 번 생성 및 materialized bytes 동일 `SEQ638_GENERATED5_DETERMINISTIC_PASS`; exact12 Windows/ordinal `3FC15E2C...1218F1`/`55CCC7D5...9742C`, cumulative237 Windows/ordinal `7882E92A...CECE7C`/`7B3AF299...9245D` 일치; parent `eafe12a...` exact; `git diff --check` PASS다.
- 인수 orchestration 오류: sandbox 기본 WSL read `E_ACCESSDENIED` 1회(`FINALIZER_WSL_SANDBOX_READ_DENIED_R1`), PowerShell/WSL 일괄 인용 syntax 오류 1회(`FINALIZER_WSL_POWERSHELL_QUOTING_R1`), D:\tmp generated5 materialize `PermissionError` 1회(`FINALIZER_GENERATED5_SANDBOX_WRITE_DENIED_R1`), 첫 patch의 두 번째 파일 context 불일치 1회(`FINALIZER_PATCH_CONTEXT_MISMATCH_R1`). 모두 제품·projection·actual runtime 실패가 아니며 승인된 격리 경계·분리된 literal 명령·정확한 context로 교정했다. runtime deploy/verify/browser/cleanup은 재실행하지 않았다.
- 최초 direct-child commit 뒤 오류 원장 추가로 dirty한 amend 전환에서 live checker는 의도대로 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`, exit1로 fail-closed했다. 이는 최종 clean amend 전 예상된 Git transition이며 제품·projection 결함이 아니다. 최종 amend 후 clean direct-child에서 재검증한다.
- 독립 review 판정은 `COMMIT_READY / C0 / I0 / M1`이다. M1은 R4 결과 보고서 인수 검증의 tooling/checker/orchestration 관련 블록이 정상 순서 뒤에 역순으로 중복된 비의미 문서 결함이다. 뒤쪽 중복만 제거해 각 사실을 한 번씩 논리 순서로 유지하며 코드·runtime·기존 full tooling `615 PASS` 증거는 변경하거나 재실행하지 않는다.
# C-21 Workbench UI WSL immutable runtime control v2 publication — seq644

- 기준선은 canonical `codex/c21-operational-execution`의 `22ebc0470d4bd9ddef03f763c0197d67c315443e`이며 시작 worktree는 clean이었다. sibling `fb311d456fe3cbb2e8439f39017356ddec6cf266`은 candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`의 sole direct child이고 canonical branch에 merge/cherry-pick하지 않는다.
- 실제 create-only CAS receipt를 append-only 기록한다. preflight에서 `refs/heads/candidates/c21-wsl-runtime-control-v2`는 `ABSENT`, candidate/record는 각각 `f0d4bc7`/`22ebc047`; atomic publication exit 0; postflight는 runtime-control-v2/candidate/record가 각각 `fb311d45`/`f0d4bc7`/`22ebc047`이다.
- sibling exact12/cumulative189 및 manifest raw SHA-256 `3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329`, guard raw SHA-256 `94727D9BF06BC6256B97F1FA7BB8C2E1E383F75EA5D2939A804E0A0B6D22AA19`를 검증한다. reviewer receipt는 `COMMIT_READY / C0 / I0 / M0`다.
- 현재 직접 지시는 실행 증거에 `CURRENT_DIRECTIVE_APPLIED_TO_EXECUTION_EVIDENCE`로 적용한다. Local PC와 WSL-server의 구현·build·unit·static·fixture·API·DB·브라우저·E2E·실제 runtime 검증·문서화·정리는 `DEVELOPMENT`이고 WSL은 외부/사용자 인수 또는 완료 판정이 아니다. Oracle Cloud의 정확한 candidate 배포부터 별도 명시 승인된 `TEST/STAGING/UAT`가 시작된다. `WSL_SERVER_TEST_STAGING`과 cleanup label은 legacy machine identifier로 유지한다.
- 작업계획서의 지속 문구 변경은 안전 게이트가 별도 명시 승인 필요로 판정하여 `PENDING_EXPLICIT_GOVERNANCE_CLASSIFICATION_APPROVAL`로 분리했다. 이 package는 `Anvil_작업계획서_v1.md`를 수정하지 않는다. Main이 잘못된 agent target으로 `send_message`한 orchestration error 1회는 제품 failure가 아니며 같은 오류 반복은 0회다.
- 오류 원장: 초기 dirty path count를 예상 6/실제 7로 잘못 보고한 `SEQ644_DIRTY_PATH_COUNT_REPORT_MISMATCH_R1` 1회, 동일 오류 반복 0회. 첫 full tooling은 69%에서 healthy CPU를 유지했으나 41분 동안 진행률 출력이 고정되어 기준 시간 2배 초과 후 Ctrl+C로 정상 중단했다. `SEQ644_TOOLING_SANDBOX_LONG_RUNNING_R1` 1회이며 제품 failure/PASS로 계상하지 않는다. 후속 `-x`는 `255 passed, 1 failed in 126.20s`; 최초 실패는 npm offline cache `stat`의 sandbox `EPERM`인 `SEQ644_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1`이며 제품 failure가 아니다. 승인된 실행 권한의 canonical full tooling fresh 1회는 `619 passed in 1543.54s`, exit 0이다.
- seq639~644만 append한다. seq1~638, historical evidence, record history, 기존 candidate/control action hash는 변경하지 않는다. Provider·Telegram·WSL runtime·ysna·main·C-01은 `NOT_EXECUTED`; C-21 accepted=false, C-01 blocked, DIR-2 not triggered다.
- terminal status는 `READY_FOR_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION`, 다음 조치는 `EXECUTE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_DEVELOPMENT_VALIDATION_R5`다.

## 2026-09-09 C-21 seq645~650 WSL authenticated browser runtime retry R5 result — 인수

- 담당: `developer-primary`; canonical parent/private record `48c34f8ef514e061f1cfa24e6d9f9f5bc0173bf1`, immutable runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 시작 상태: `D:\tmp\anvil-c21-operational-execution`, branch `codex/c21-operational-execution`, HEAD `48c34f8...`, tracked worktree clean. local immutable ref는 `refs/remotes/development/candidates/c21-wsl-runtime-control-v2`; WSL control repo의 private origin fetch ref는 `refs/remotes/origin/candidates/c21-wsl-runtime-control-v2`다.
- 범위: actual WSL development validation R5 정확히 1회와 seq645~650 append-only exact12 projection. 제품/deploy/probe/WorkPlan, seq1~644, historical/sibling immutable evidence는 변경하지 않는다.
- Main 전달 verify SHA 문자열에 잡문이 섞인 orchestration 오류 `MAIN_R5_VERIFY_SHA_TRANSMISSION_TYPO_R1` 1회가 있었다. 제품=false, runtime=false이며 정확한 유일 값 `93E882D35C055535A7D989962FE0EE0EC49B91542EB462B655F1477DD2562A36`으로 교정했다.
- 첫 읽기 전용 preflight 묶음은 `bash -c` payload의 Windows→WSL argv 인용이 보존되지 않아 빈 remote/path로 해석됐다. fingerprint `R5_PREFLIGHT_WINDOWS_WSL_ARGV_QUOTING_R1` 1회, 제품=false, runtime=false이며 deploy/verify/browser/cleanup action은 0회다. 복합 shell payload를 중단하고 값 비노출 단일 argv 관측으로 분리한다.
- 다음: strict R5 success/failure projection/checker를 TDD RED로 고정한 뒤 secret-safe preflight를 수행한다. runtime은 preflight 전부 PASS일 때 deploy→verify→Windows canonical probe PG15→PG18RC를 각 1회 실행하고 outer finally cleanup을 정확히 1회 수행한다. 실패 시 runtime action은 재실행하지 않는다.
- sandbox 기본 권한의 최초 WSL read는 `E_ACCESSDENIED`로 거절됐다. `R5_PREFLIGHT_WSL_SANDBOX_DENIED_R1` 1회, product=false/runtime=false/action=0이며 승인된 실행 경계에서 같은 read-only preflight를 이어갔다.
- 최종 preflight PASS: child private record/control/candidate exact, application `f0d4bc7...` detached clean, control-runtime SHA `D0FF497B...70097`, `.env` mode600/hash `FECAE53B...52A79A`, required name presence와 exact provider-read scope, 초기 container/network/exact-volume/lock residue0을 확인했다. 값은 출력하지 않았다.
- actual R5는 재실행 없이 정확히 1회 진행했다. deploy exact1 `exit0/PASS`, verify exact1 `exit0/PASS`; PG15 Windows canonical browser exact1은 `exit1/PROBE_ERROR`, PG18RC는 stop-on-first-failure로 `NOT_EXECUTED`; outer-finally cleanup exact1은 `exit0/PASS`다.
- PG15 receipt 원문에 token/sentinel/base URL 및 cookie/header/raw URL 값이 없음을 먼저 확인했다. Node entrypoint와 secret-safe receipt parser는 실행됐으나 `C:\Program Files\nodejs\node_modules\playwright`가 없고 `ANVIL_PLAYWRIGHT_MODULE`·`ANVIL_CHROMIUM_EXECUTABLE` override도 없어 viewport0에서 실패했다. fingerprint `PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5`, category `PLAYWRIGHT_RUNTIME_DEPENDENCY_RESOLUTION`이다. 직전 verify의 API/authenticated SSE/Last-Event-ID/same-origin PASS와 분리되므로 제품 UI/API/SSE 실패로 확정하지 않는다.
- current JSON receipt는 PG15/PG18RC pre-migration backup 2개와 verification 2개만 합계4이며 rollback receipt는0이다. file SHA-256은 `A2A8FB3C...69C36`, `2AC37761...9541`, `96BD2FC8...C8DB2`, `0CE473C5...E4D3B`; image metadata2 SHA는 `18108107...E88B3`, `2E549E4B...32393`이다. backup/evidence는 보존했다.
- post-cleanup application/env/control stage clean, exact container/network/volume/lock residue0이다. repository/history의 기존 versioned PNG 6개는 probe-created mutation이 아니며 exact probe-created evidence/backup/runtime 경로의 screenshot filesystem mutation/residue는0이다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음 안전 조치는 canonical Windows Playwright runtime dependency 경로를 복구한 별도 successor다.
- actual failure TDD: PG15 dependency failure가 verify receipt4를 보존하고 PG18RC를 미실행하는 strict test는 RED `1 failed, 254 deselected` 후 GREEN `4 passed, 251 deselected`다. seq650 builder 부재 test는 RED `1 failed, 255 deselected`이며 strict generated5 구현으로 전환했다.
- Main의 연속 상태요청 두 건에 깨진 문구가 포함됐다. 사용자 정정에 따라 하나의 orchestration error `MAIN_R5_STATUS_TRANSMISSION_TYPO_R1` 1회로만 기록하며 product=false/runtime=false다.
- checker syntax 확인용 `py_compile`은 sandbox가 `scripts/__pycache__` write를 거절해 exit1이었다. 같은 module은 focused pytest에서 정상 import·실행됐으며 `SEQ650_PYCOMPILE_SANDBOX_PYCACHE_DENIED_R1` 1회, product=false/runtime=false다.
- seq644+seq650 focused는 `9 passed, 247 deselected in 2.50s`, live checker는 `PASS sequence=650 reporting=AUTO_CONTINUE`다. generated5는 materialize했고 manifest strict validation과 seq1~644 raw prefix 보존을 확인했다.
- canonical sandbox full tooling은 10분/69%에서 provisional failure1 뒤 traceback 없이 CPU 진행 중이었으나 지시된 장시간 경계에서 Ctrl+C exit1로 중단했다. `SEQ650_TOOLING_SANDBOX_LONG_RUNNING_R1`은 non-result/product=false/runtime=false다.
- 후속 `pytest tests/tooling -q -x -p no:cacheprovider`는 `1 failed, 255 passed in 120.17s`, exit1로 첫 failure를 분리했다. 기존 G06 TypeScript clean fixture의 `npm ci --offline` cache `stat EPERM`이며 fingerprint `SEQ650_TOOLING_NPM_CACHE_SANDBOX_EPERM_R1`, product=false/runtime=false다. 동일 단일 테스트를 권한 허용 경계에서 실행해 `1 passed in 4.14s`, exit0을 확인했다.
- `test_project_progress.py` 전체는 failure 없이 28% 뒤 CPU가 계속 증가했으나 직전 정상 약 12분의 2배인 25분 경계를 넘어 Ctrl+C exit1로 중단했다. `SEQ650_PROJECT_PROGRESS_LONG_RUNNING_R1`은 non-result/product=false/runtime=false이며 장시간 suite는 더 실행하지 않는다. seq644 canonical full `619 passed in 1543.54s`와 fresh focused9/live checker/단일 EPERM elevated PASS를 함께 사용한다.
- 최초 exact12 stage는 linked-worktree Git index가 workspace sandbox 밖에 있어 `index.lock Permission denied`로 중단됐다. `SEQ650_GIT_INDEX_SANDBOX_DENIED_R1` 1회, product=false/runtime=false이며 index mutation0을 확인하고 권한 허용 경계의 동일 exact12 stage로 교정한다.

## 2026-09-09 C-21 seq651~656 WSL authenticated browser runtime retry R6 result — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-execution-fence-epoch-1-4a30f23`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r6-result-write-fence-epoch-1-4a30f23`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `4a30f234745677025a572beb2ec8dcad379ac193`, tracked worktree clean, runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq651~656 append-only exact12와 actual R6 1회. seq1~650/historical evidence, 제품/deploy/probe/WorkPlan, `.env`는 불변이며 install/download/runtime retry는 금지한다.
- 실행 계약: read-only preflight 뒤 deploy1→verify1→PG15 browser1→성공 시 PG18RC browser1, outer-finally cleanup exact1. Playwright module/executable은 Main이 사전 self-test한 기존 경로를 process-local environment에만 주입한다.
- 다음: seq656 성공·실패 projection/checker를 TDD RED로 고정한 뒤 preflight와 actual runtime을 실행한다.
- 최초 전달된 architect hash 4개는 전달된 exact12 경로 집합을 repository `_c21_path_list_sha`로 계산한 값과 불일치했다. fingerprint `MAIN_R6_ARCHITECT_PATH_HASH_CALCULATION_ERROR_R1` 1회, product=false/runtime=false/action=0이다. Main이 독립 재계산 후 경로 집합을 정본으로 확정하고 exact Windows/ordinal `58CE542C...41975`/`2FD1D089...E6DC3`, cumulative255 Windows/ordinal `880C34EB...84786`/`CEEBA7C4...554F6`으로 교정했다.
- R6 read-only preflight 복합 collector는 detached application의 빈 branch 출력을 `.Trim()`하려다 같은 null method error로 2회 중단됐다. fingerprint `DETACHED_BRANCH_EMPTY_OUTPUT_NULL_TRIM` 2회, product=false/runtime=false/action=0이다. 두 번째 실패 뒤 복합 collector를 폐기하고 branch empty는 `symbolic-ref` exit로 확인하는 direct literal 관측 revision으로 전환한다. 동일 오류 3회째면 runtime action0 증거와 TakeoverPacket을 제출하고 중단한다.
- direct literal preflight는 application `f0d4bc7...` detached/clean, control `fb311d45...` clean, private refs exact, `.env` mode600/hash `FECAE53B...52A79A`, required names/provider-read scope, initial residue0, process-local Playwright module/Chromium executable 존재를 확인해 PASS했다. `.env` mutation과 비밀값 출력은 없다.
- actual R6는 단일 PowerShell try/finally에서 정확히 1회 시작했다. deploy action count1은 실제 `exit0/PASS`했고 backup receipt2/image metadata2를 생성했다. 함수가 WSL stdout과 마지막 exit code를 함께 반환해 `$deployExit`가 배열이 되었고 controller가 성공 deploy를 실패로 오분류해 exit1로 종료했다. fingerprint `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6` 1회, product=false/runtime=true다.
- stop-on-first-failure에 따라 verify count0, PG15 browser count0, PG18RC browser count0이다. process-local Playwright/Chromium 값은 browser phase에 도달하지 않아 사용되지 않았고 runtime action 재실행은 0회다. outer-finally cleanup count1은 `exit0/PASS`했다.
- post-cleanup은 application/control stage clean, `.env` byte-identical, exact container/network/volume/lock/probe-created screenshot residue0이다. current R6 JSON은 backup2/verification0/rollback0이고 SHA-256은 `894462E0...7ADAE`, `C02F8A37...72FB5`; image metadata2는 `18108107...E88B3`, `2E549E4B...32393`이다. JSON은 `secret_values=omitted`와 민감 키/raw URL 부재를 원문 비노출로 확인했다.
- seq656 실제 orchestration failure strict TDD는 RED `3 failed, 1 passed, 256 deselected` 뒤 validator key 교정과 R5 회귀 보호를 거쳐 seq650+seq656 focused `10 passed, 251 deselected in 10.20s`, exit0이다.
- 도구 오류 원장: `SEQ656_PYTHON_COMMAND_NOT_FOUND_R1` 1회, `SEQ656_PY_LAUNCHER_NO_PYTHON_R1` 1회, `SEQ656_BUNDLED_PYTHON_PYTEST_MISSING_R1` 1회, `R6_POSTEVIDENCE_WSL_SANDBOX_DENIED_R1` 1회, `R6_RECEIPT_SECRET_SAFE_QUOTE_JQ_UNAVAILABLE_R1` 1회, `SEQ656_PYCOMPILE_SANDBOX_PYCACHE_DENIED_R1` 1회다. 모두 product=false/runtime=false이며 `.venv` focused import 또는 승인된 read-only 경계로 교정했다.
- Main 상태 점검 중 협업 도구 인자 오류 `MAIN_COLLAB_TOOL_ARGUMENT_ERROR`가 3회 연속 발생했다(missing target, target type/name typo, wait timeout type). impact=`NONE`, resolved=`true`, product=false/runtime=false이며 Developer failure/runtime failure count에 포함하지 않는다.
- 판정: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다.
- 다음: generated5를 failure projection으로 materialize하고 focused/live checker/determinism/diff/exact12/direct-child를 검증한다. 다음 runtime은 controller stdout/exit-code 분리 successor 없이는 실행하지 않는다.
- seq651~656 generated5 materialize는 5개 파일을 생성했고 strict manifest raw checksum row11, historical seq1~650 raw event prefix, exact12/cumulative255를 결박했다. live checker는 `PASS sequence=656 reporting=AUTO_CONTINUE`, exit0이다.
- precommit 검증은 seq650+seq656 focused `10 passed, 251 deselected in 10.20s`, generated5 두 번 byte equality/materialized equality PASS, checker source AST parse PASS, `git diff --check` PASS다. dirty/untracked는 선언된 exact12만이며 장시간/full suite는 시작하지 않았다.
- 미검증: verify와 PG15/PG18RC authenticated browser, Provider UI read/GROQ click, SSE/Last-Event-ID, 독립 review. 다음: 최종 WORK_STATUS checksum을 generated5에 재결박하고 동일 focused/checker/determinism/exact12를 fresh 확인한 뒤 parent `4a30f23...`의 단일 direct-child commit을 생성한다. push는 금지한다.

## 2026-09-09 C-21 seq657~662 WSL authenticated browser runtime retry R7 result — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-execution-fence-epoch-1-0e22a1d`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r7-result-write-fence-epoch-1-0e22a1d`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `0e22a1d4e47cdff117b894dd885af816f354a550`, clean worktree, immutable runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq657~662 append-only exact12와 actual R7 1회. seq1~656/historical evidence와 제품/deploy/probe/WorkPlan/`.env`는 불변이다.
- 실행 계약: harmless local native wrapper self-check 뒤 read-only preflight→deploy1→verify1→PG15 browser1→성공 시 PG18RC browser1, outer-finally cleanup 정확히1. 첫 failure 뒤 중단하며 WSL action 재시도는 금지한다.
- 다음: native wrapper stdout/exit 분리 및 seq662 success/failure projection을 TDD RED로 고정한다.
- TDD RED: seq662 focused는 신규 metadata/validator/builder 부재로 `4 failed, 261 deselected`, exit1이었다. metadata와 native wrapper/success-failure validator 최소 구현 후 `3 passed, 1 failed`, 남은 expected failure는 builder 부재뿐이었다.
- harmless local native wrapper self-check는 stdout1/exit0/`Int32`/caller `.ExitCode`/WSL action=false로 PASS했다. R6 `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6`은 actual에서도 재발하지 않아 root status `RESOLVED`다.
- preflight 오류 원장: helper parameter에 PowerShell reserved `$Args`를 사용한 `R7_PREFLIGHT_RESERVED_ARGS_PARAMETER_R1` 1회, control root 자체를 Git repo로 본 `R7_PREFLIGHT_CONTROL_ROOT_REPO_ASSUMPTION_R1` 1회, `%(refname)` format argv 인용을 보존하지 못한 `R7_PREFLIGHT_FOREACH_REF_FORMAT_QUOTING_R1` 1회다. 모두 product=false/runtime=false/action=0이며 서로 다른 fingerprint다.
- Main 지시대로 active stage에 `git rev-parse --git-dir --show-toplevel`과 quoted `git for-each-ref --format='%(refname) %(objectname)'`를 한 번 적용했다. stage root/HEAD/object/clean과 candidate/control refs를 exact 확인했으며 remote-tracking ref 존재 자체를 새 필수 제품 계약으로 만들지 않았다.
- 최종 preflight PASS: application `f0d4bc7...` detached clean, active control `fb311d45...` clean/object present, `.env` mode600/hash `FECAE53B...52A79A`/exact7 names/provider-read scope, initial residue0, probe hash exact, process-local Playwright module/Chromium executable present다. 비밀값과 raw URL은 출력하지 않았다.
- actual R7 단일 실행: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/NONPASS`, PG18RC browser0, outer-finally cleanup1 `exit0/PASS`, runtime retry0. primary fingerprint `BROWSER_ACCEPTANCE_FAILED_R7` 1회다.
- browser receipt JSON parser는 통과했으나 controller가 non-PASS의 세부 parsed JSON/predicate를 보존하지 않았다. diagnostic fingerprint `BROWSER_RECEIPT_NOT_PERSISTED_R7` 1회다. 제품/환경/브라우저 하위 원인은 재실행 없이 분리 불가하므로 추정하지 않는다. verification receipt의 authenticated SSE/Last-Event-ID/same-origin은 두 target 모두 PASS라는 범위만 유지한다.
- current R7 JSON receipt4는 backup2/verification2/rollback0이고 SHA-256은 `CF9EF430...7E90E`, `96BD2FC8...C8DB2`, `9A4B65F9...C612D`, `0CE473C5...E4D3B`; image metadata2는 `18108107...E88B3`, `2E549E4B...32393`이다. 네 JSON 모두 `secret_values=omitted`와 민감 키/raw URL 부재를 원문 비노출로 확인했다.
- post-cleanup application/control clean, `.env` byte-identical, exact container/network/volume/lock/probe-created screenshot residue0이다.
- Main 상태 점검 중 잘못된 interrupt 도구 선택 `MAIN_R7_INTERRUPT_TOOL_SELECTION_ERROR_R1` 1회와 깨진 지시 출력 `MAIN_R7_STATUS_TRANSMISSION_TYPO_R1` 1회가 있었다. impact=`NONE`, saved exact12 변경과 receipt는 intact, checker AST PASS로 복구했으며 product=false/runtime=false다.
- 판정: `FAILED_R7_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다.
- 다음: seq662 failure generated5/checker를 완성한다. R8은 actual 재실행 전에 모든 native stdout/parsed JSON을 secret-safe memory/object에 보존하고 phase exit와 predicate failures를 분리해야 한다.
- seq662 builder/failure projection 구현 후 seq656+662 focused는 `9 passed, 256 deselected in 9.47s`, exit0이다. generated5 materialize와 live checker `PASS sequence=662 reporting=AUTO_CONTINUE`를 확인했다.
- generated5 두 번 byte equality와 materialized equality PASS, exact12 dirty 일치, cumulative261/hash 계약, raw checksum row11, seq1~656 raw event prefix 보존, `git diff --check` PASS다. 장시간/full suite와 runtime 재실행은 시작하지 않았다.
- 다음: 최종 WORK_STATUS checksum을 generated5에 재결박하고 fresh focused/checker/determinism/exact12를 확인한 뒤 parent `0e22a1d...`의 single direct-child commit을 생성한다. push는 미실행으로 유지한다.

## 2026-09-09 C-21 seq663~668 WSL authenticated browser runtime retry R8 result — 인수/lease

- 담당: `developer-primary`; worker/write lease와 execution/write fence epoch1을 parent `a1b67f4` 및 R8 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `a1b67f4f93d06e1b71f5bd05b9f66e404f10a039`, clean worktree, runtime control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- 범위: seq663~668 append-only exact12와 actual R8 1회. seq1~662/historical evidence 및 product/probe/deploy/WorkPlan/`.env`는 불변이다.
- exact12 Windows/ordinal `151561FBBD5EAF89FC25E125D0E205B08ADBA99EADECB1E194D4D0DC0AEB3F25` / `0373683DBDDB9B07FCFBA084F2F9BC164D7326EC3864FE616CE110B2D8FED172`; cumulative267 Windows/ordinal `84F562328BC0C0EA7CEB2C9C15CD0728447140C8F67A7A9A5689973E4834374B` / `6DE6BB7AB87178149F987475196D8EA30997DF57BE025E5F9453AD67DBCF590B`.
- 초기 도구 payload 문법 오류 `R8_INITIAL_TOOL_PAYLOAD_SYNTAX_R1` 1회는 command 실행 전 발생했고 product/runtime/action 영향0이다.
- 다음: separated stdout/stderr/exit와 strict parsed receipt/predicate persistence를 TDD RED로 고정한다.
- TDD RED는 R8 metadata/strict observation validator 부재로 `3 failed, 265 deselected`, exit1; 최소 구현 GREEN은 `3 passed, 265 deselected`, exit0이다. builder 포함 focused는 `4 passed, 265 deselected`, exit0이다.
- local native 분리 self-check는 stdout1/stderr1/exit7을 별도 field로 보존해 PASS했다. sandbox WSL은 `Wsl/Service/E_ACCESSDENIED`였고 `R8_SANDBOX_WSL_E_ACCESSDENIED_R1` 1회, product=false/runtime=false/action=0; 승인된 경계로 교정했다.
- preflight 준비 오류는 결과 serialization 구문 `R8_SELF_CHECK_RESULT_SERIALIZATION_R1` 1회, ProcessStartInfo/native `bash -c` payload split `R8_PREFLIGHT_BASH_C_ARGUMENT_SPLIT_R1` 2회, relative active pointer를 absolute로 오인한 `R8_PREFLIGHT_ACTIVE_POINTER_RELATIVE_PATH_R1` 1회, env path/name 계약 추정 `R8_PREFLIGHT_ENV_CONTRACT_ASSUMPTION_R1` 2회, broad `*.lock`을 controller exact lock으로 본 `R8_PREFLIGHT_BROAD_LOCK_PATTERN_R1` 1회다. 모두 서로 구분된 read-only orchestration 오류이며 product=false/runtime=false/action=0이다.
- 교정 final preflight PASS: application `f0d4bc7...` clean; active `/srv/anvil-wsl/control/stage.1059447.16378` HEAD/ref `fb311d45...` clean; control-runtime SHA exact; `/srv/anvil-wsl/.env` mode600/SHA `FECAE53B...52A79A`, immutable common.sh exact7 names once와 exact provider-read scope; probe SHA `932C996E...0C89`; process-local Playwright/Chromium present; container/network/volume/exact `.publish.lock` residue0다. 값은 출력·저장하지 않았다.
- actual one-shot: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 controller entry1, PG18RC0, outer-finally cleanup1 `exit0/PASS`, retry0. deploy stdout/stderr line `116/101`, SHA `F28B319B...AD68`/`456084BE...770E`; verify `6/4`, `26343A47...C95`/`073BBD58...227A`; cleanup `8/26`, `5B7E9FB1...737`/`D2B51978...6047`만 기록한다.
- PG15는 attempt counter 진입 뒤 secret-safe observation 할당 전 controller exception으로 종료됐다. fingerprint `BROWSER_OBSERVATION_CONTROLLER_EXCEPTION_R8`, diagnostic `BROWSER_RECEIPT_NOT_PERSISTED_R8`이다. native browser process 실행/exit, stdout/stderr line·hash, canonical receipt SHA, secret scan, safe parsed receipt, false predicate exact list는 보존되지 않아 `UNAVAILABLE`이며 추정하지 않는다.
- R7/R8은 동일 `BROWSER_RECEIPT_NOT_PERSISTED` evidence-capture lineage 누적2다. 제품 UI/API/SSE 실패는 확정되지 않았다. developer/runtime validation failure이지만 product failure=false다.
- post-cleanup app `f0d4bc7...` clean, env mode600/SHA byte-identical, control `fb311d45...` clean, container/network/exact-volume/publish-lock residue0. screenshot 저장 환경변수는 주입하지 않았고 probe code memory-only 정책상 filesystem screenshot mutation은 관측되지 않았다.
- current receipt4 backup2/verification2/rollback0 SHA는 `99190AC9...E4F7`, `96BD2FC8...C8DB2`, `A619FDF4...4775`, `0CE473C5...E4D3B`; image metadata2 SHA는 `18108107...E88B3`, `2E549E4B...32393`이다. raw/token/cookie/header/origin/secret literal과 screenshot binary/base64는 파일에 기록하지 않았다.
- focused 호출 payload에 duplicate malformed `yield_time_ms`를 넣은 `R8_FOCUSED_TOOL_ARGUMENT_SYNTAX_R1` 1회는 command 실행 전 도구 오류이며 product=false/runtime=false다. 올바른 호출에서 focused4 PASS했다.
- 첫 generated5 live checker는 seq668 PACKAGE_COMPLETED에 unchanged upstream binding이 빠져 `EVENT_EFFECT_MISMATCH`, exit1이었다. `R8_LIVE_CHECKER_EVENT_EFFECT_BINDING_R1` 1회, product=false/runtime=false이며 `completion_upstream_head`를 기존 repository remote head에 결박한 뒤 checker `PASS sequence=668 reporting=AUTO_CONTINUE`, exit0이다.
- 판정: `FAILED_R8_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음은 seq668 generated5/checker/determinism/single direct-child이며 push와 runtime 재실행은 하지 않는다.
- precommit generated5는 5개 materialize, 두 번 생성 byte equality와 materialized equality PASS다. seq662+668 focused `8 passed, 261 deselected in 1.57s`, live checker `PASS sequence=668 reporting=AUTO_CONTINUE`, `git diff --check` PASS, exact12/cumulative267 hash 계약 일치다. 장시간/full suite는 실행하지 않았다.
- secret-safe read-only scan은 actual credential value exact12 match0, R8 추가 line의 runtime origin literal0, screenshot base640이다. exact12 전체에서 보인 origin literal2는 이번 R8 diff가 아닌 기존 R6 test fixture line이며 새 raw origin 기록이 아니다.
- 미검증: PG15 native browser exit와 predicate, PG18RC browser, 독립 review. 다음: fresh final 동일 검증 뒤 parent `a1b67f4...`의 single direct-child exact12 commit을 생성하고 postcommit 확인한다. push는 금지한다.

## 2026-09-09 C-21 seq669~674 WSL authenticated browser runtime retry R9 final Developer successor — 인수/lease

- 담당: `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-execution-fence-epoch-1-eadba5b`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result-write-fence-epoch-1-eadba5b`를 exact12에 발급했다.
- 기준선: branch `codex/c21-operational-execution`, HEAD/private record `eadba5bad0df3ea4f52e28b847ab20957217b6c5`, clean worktree, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`.
- exact12 Windows/ordinal `C76DF85C02565072777A14B469396E5E56F001BD094051F546A9CF2C6AA3F003` / `E52F1859A1643A060D3D680554B111E54D7DDC7F05C543E0EE39B8F2C50036D5`; cumulative273 Windows/ordinal `BF167099DC8F21AC96258B041C333A9F19DC2426899EB140B48531FFA26A9D45` / `797C222A29F7B7D6F729D6DC2C3F06CE55586705AA0C8C01A6E42D9708806338`.
- 동일 evidence-capture lineage `BROWSER_RECEIPT_NOT_PERSISTED`는 R7+R8 count2다. seq1~668/historical evidence 및 제품/probe/deploy/`.env`는 불변이다.
- 다음: always-return phase envelope의 PASS/PROBE_ERROR/malformed/throwing-transformer synthetic4를 TDD RED/GREEN으로 고정한다. 네 건 모두 통과하기 전 actual runtime action count는0이다.
- synthetic4 TDD RED는 구현 부재로 `5 failed, 269 deselected`, GREEN은 `5 passed, 269 deselected`; PowerShell synthetic4도 case4/one-object4/raw·secret clear4/secret literal0, exit0 PASS했다. harmless local identical call-shape5도 PASS했고 WSL action count0이다.
- 실제 action 전 첫 controller payload는 `Invoke-R9Action'deploy'` tokenization으로 command 전 실패했다. `R9_ACTUAL_CONTROLLER_ACTION_CALL_TOKENIZATION_R1` 1회, product=false/runtime=false/action0이다. 후속 준비 중 서로 다른 pre-dispatch/read-only 오류 `R9_POST_TOKENIZATION_HEREDOC_POWERSHELL_PARSE_R1`, `R9_LOCAL_CALL_SHAPE_INTERPOLATION_PARSE_R1`, `R9_ACTION0_STATE_RECHECK_ESCAPED_SCRIPT_PARSE_R1` 각1회가 있었고 모두 product=false/runtime=false/action0로 교정했다.
- 교정 final preflight PASS: application `f0d4bc7...`/active control `fb311d45...` clean, env mode600/hash byte-identical/exact names+scope, initial residue0, probe/process-local browser dependency exact이다. secret 값은 출력하지 않았다.
- actual one-shot은 deploy1 뒤 safe native metadata의 `stdout_sha256=H native.stdout;stderr_sha256=H native.stderr`에서 `H`가 PowerShell `Get-History` alias로 해석됐다. `R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1` 1회, `ParameterBindingException`, category `GET_HISTORY_ID_CONVERSION_FAILURE`, failure step `SAFE_NATIVE_METADATA_HASH`다. verify/PG15/PG18RC는0, outer-finally cleanup1, retry0이다. deploy/cleanup exit 및 stream metadata는 envelope가 반환되지 않아 `UNAVAILABLE`이고 추정하지 않는다.
- 두 target backup receipt/image metadata 갱신은 deploy terminal boundary 근거다. current receipt SHA는 `140CCCFE...B6A0`, `96BD2FC8...C8DB2`, `17FD2E60...950A`, `0CE473C5...E4D3B`; image metadata는 `18108107...E88B3`, `2E549E4B...32393`이다.
- post-cleanup direct WSL `stat` 인용 1회 오류 `R9_POSTCLEANUP_DIRECT_WSL_STAT_QUOTING_R1`은 read-only false start/product=false/runtime=false다. ProcessStartInfo stdin 교정 관측은 app/control clean, env mode600/SHA byte-identical, container/network/exact-volume/lock residue0를 확인했다.
- 동일 evidence-capture lineage `BROWSER_RECEIPT_NOT_PERSISTED`는 R7+R8+R9 valid failure count3다. 제품 결함은 미확정이며 worker/write lease와 runtime tool ownership을 `REVOKED`, Developer execution을 `STOPPED`로 회수했다. 내부 TakeoverPacket next owner는 `MAIN_AGENT_SEQUENTIAL_TAKEOVER`; Subagent runtime/implementation retry를 금지한다.
- Main 상태 점검 오류 `MAIN_R9_STATUS_TRANSMISSION_TYPO_R1`, `MAIN_R9_COLLAB_TOOL_MISSING_MESSAGE_R1`, `MAIN_R9_READ_ONLY_EXEC_WORKDIR_TYPO_R1` 각1회는 product/runtime/Git impact=`NONE`, 즉시 교정됐고 Developer failure/capture lineage count에 포함하지 않는다.
- builder TDD RED `1 failed, 5 passed, 269 deselected`; seq674 failure projection/lease revoke/TakeoverPacket 구현 후 GREEN `6 passed, 269 deselected`다. 다음은 generated5/checker/determinism/exact12 single direct-child commit이며 runtime 재실행과 push는 금지한다.
- 첫 live checker는 capture lineage count3를 immutable failure ledger 갱신 없이 global `valid_failure_count`에 넣은 projection 때문에 `FAILURE_PROJECTION_MISMATCH`로 fail-closed했다. `R9_LIVE_CHECKER_FAILURE_LEDGER_PROJECTION_R1` 1회, product=false/runtime=false이며 global ledger projection은 역사 그대로 두고 count3를 diagnosis/internal TakeoverPacket에 결박해 교정했다.
- generated5 materialize5와 two-build/materialized equality, seq1~668 raw event prefix 보존 PASS. fresh seq668+674 focused `10 passed, 265 deselected in 1.23s`, live checker `PASS sequence=674 reporting=AUTO_CONTINUE`, exact12/cumulative273 metadata와 `git diff --check` PASS다. 다음은 single direct-child commit과 postcommit 확인이며 runtime 재실행/push/추가 Subagent execution은 금지한다.
- parent `eadba5b...`의 exact12 single direct-child commit을 생성했고 postcommit focused `10 passed, 265 deselected in 1.17s`, checker `PASS sequence=674`, generated5 two-build/materialized equality, direct path12, clean worktree를 확인했다. push/runtime 재실행은0이다. Developer execution은 종료하며 정확한 다음 조치는 `MAIN_AGENT_SEQUENTIAL_TAKEOVER_NO_FURTHER_SUBAGENT_EXECUTION`이다.

## 2026-09-09 C-21 seq675~680 R9 takeover correction — HUMAN_OVERRIDE lease

- 신산님의 명시 HUMAN_OVERRIDE `APPROVAL-20260909-C21-R9-TAKEOVER-CORRECTION-001`에 따라 rejected local commit `5162d358...`을 amend하지 않고 append-only exact13 correction을 시작했다. private remote는 `eadba5bad...`이며 runtime tool 권한은 회수 상태다.
- rejected dirty test precondition은 HEAD blob `ff09e953fc76d90111ea80b3d9b7d6bfe1177b93`, worktree blob `4a680574fcc4717cbf28179cb9817c8b438767df`, diff `9+/6-`, SHA-256 `F76536182CA6476489FA33F505C51669064F2689B998DF508B678FDCD067D492`로 모두 일치했다. apply_patch로 그 hunk만 역적용해 HEAD blob/clean을 복원했다.
- correction worker/write lease와 epoch1 fence를 parent `5162d358...` 및 exact13에 발급했다. exact13 Windows/ordinal `0CF50BDA...CB159` / `66B0CB35...AA9D`; cumulative280 Windows/ordinal `B4052844...EDFC` / `C8EAF5D6...F136`이다.
- reviewer C1/I1 교정: R7 parser PASS/native exit1, R8 native unconfirmed, R9 browser not executed로 단계와 root가 다르다. current correction은 세 exact root를 각1로 고정하고 historical broad grouping을 diagnostic symptom only/superseded로 분류한다. 기존 seq1~674/R9 artifact와 nested takeover packet은 historical bytes로만 보존한다.
- Main 협업 도구 unknown-field 오류 `MAIN_R9_CORRECTION_COLLAB_UNKNOWN_FIELD_R1` 1회는 product/runtime/Git impact=`NONE`, 즉시 교정됐고 Developer failure count에 포함하지 않는다.
- 다음: seq680 strict correction predicate를 RED로 고정하고 deterministic generated5/checker를 구현한다. runtime/WSL/product/external/amend/reset/checkout/clean/stash/force push는 실행하지 않는다.
- architect가 제안한 더 넓은 approval mode/classification으로 draft를 바꾸려던 apply_patch는 안전 심사에서 `governance weakening`으로 1회 거절됐다. `SEQ680_APPROVAL_BINDING_SAFETY_REVIEW_REJECTION_R1`은 product/runtime/Git impact=`NONE`이다. Main의 read-only governance 재검토는 기존 `mode=HUMAN_OVERRIDE`, `classification=R9_TAKEOVER_PROJECTION_CORRECTION_ONLY`가 schema 허용 범위의 더 좁은 least-privilege binding임을 확정했고, 거절된 변경을 재시도하지 않았다.
- seq680 strict predicate TDD RED는 correction constants/builder 부재로 `5 failed, 275 deselected`, exit1이다. builder 대형 append 첫 patch는 tail blank-line context 불일치로 변경0, `SEQ680_BUILDER_APPEND_CONTEXT_MISMATCH_R1` 1회/product=false/runtime=false였고 정확한 anchor로 분리 적용했다.
- metadata/anchors/approval/correction/root-map/lease/events/generated5 builder/manifest validator/Git collector/dispatcher 구현 뒤 seq680 GREEN은 `5 passed, 275 deselected in 7.70s`, exit0이다. 기존 seq674 checker/predicate/test source region strict equality도 포함한다.
- 다음: generated5 materialize, focused seq674+680, live checker, two-build/idempotence/exact13/cumulative280/diff-check 후 parent `5162d358...`의 sole direct-child commit을 생성한다. push 및 runtime/WSL/product/external action은 금지한다.
- generated5 첫 live checker는 correction lease/event contract와 recovery summary 필수 필드가 빠져 `EVENT_PAYLOAD_MISSING`, `HANDOFF_BASELINE_MISMATCH`, `HANDOFF_DIR_STATUS_MISMATCH`, `HANDOFF_FAILURE_COUNT_MISMATCH`, `HANDOFF_REPORTING_DECISION_MISMATCH`로 fail-closed했다. `SEQ680_LIVE_CHECKER_REQUIRED_FIELDS_R1` 1회, product=false/runtime=false이며 기존 seq674를 바꾸지 않고 correction worker/write fencing·path scope·accepted와 handoff baseline/DIR/failure/reporting binding만 보완했다.
- 첫 materialize 재실행은 linked worktree가 workspace sandbox 밖이라 `PermissionError`로 중단됐다. `SEQ680_MATERIALIZE_SANDBOX_DENIED_R1` 1회, generated partial write는 다음 deterministic materialize로 전부 덮였고 product/runtime/Git impact=`NONE`이다. 승인된 exact13 write 경계에서 generated5를 다시 materialize한 뒤 live checker `PASS sequence=680 reporting=AUTO_CONTINUE`, exit0을 확인했다.
- 현재 pending은 seq674+680 focused regression, two-build byte equality/materialize2 idempotence, exact13/cumulative280/diff-check와 sole-parent commit/postcommit이다. runtime/WSL/product/external action count는 계속0이며 push는 금지한다.
- precommit regression은 seq674+680 focused `11 passed, 269 deselected in 3.71s`, live checker `PASS sequence=680 reporting=AUTO_CONTINUE`, exit0이다. generated5 two-build/live byte equality와 materialize2 idempotence, exact13 13/13, cumulative280/4개 hash, historical event/R9 artifact anchors, self-manifest 제외 raw checksum12, `git diff --check`가 모두 PASS했다.
- 미검증: independent review 및 R10 successor 실행. 다음: 이 최종 기록을 generated5에 재결박하고 fresh verification 후 parent `5162d358...`의 sole direct-child commit을 생성한다. runtime/WSL/product/external/push는 실행하지 않는다.

## 2026-09-09 C-21 seq681~686 WSL authenticated browser runtime retry R10 result — 인수/lease

- Main의 seq680 independent review 후 R10 Developer successor 지시를 인수했다. parent/local/private record는 `27406570cbfbb89f19ee3a5d746687125d043d7e`, candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`, immutable control `fb311d456fe3cbb2e8439f39017356ddec6cf266`, branch `codex/c21-operational-execution`, 시작 worktree clean이다.
- 담당 `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-execution-fence-epoch-1-2740657`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-result-write-fence-epoch-1-2740657`를 exact12에 발급했다.
- exact12 Windows/ordinal `A517ED343E5509C56070AC53DFF2FA46DBF6E22AD0F87D4640A09EFBE748F39A` / `BE98A5D1DB7ED066EB01888326947F65E72D87615E0FE076EE2DC6796DE86836`; cumulative286 Windows/ordinal `38CF5747CE85C17EB7DB259E12B86E65B5AB32743E298B3E4A5573D9D33EE335` / `C67C1829358F575C435D47AD3953BDC636DD22F3CFF8CDDF9C2B816F72081ED2`다. seq1~680/historical evidence와 product/probe/deploy/`.env`는 byte-preserve한다.
- 실행 계약은 alias collision0, synthetic4, 동일 `Invoke-R10Process` harmless Node native hash/line/exit self-check, read-only preflight가 모두 PASS한 뒤 deploy1→verify1→PG15 browser1→strict PASS일 때 PG18RC browser1이며 outer-finally cleanup은 deploy 이후 정확히1, retry0이다. 짧은 alias와 `H`는 금지한다.
- Main orchestration 오류 `MAIN_SEQ680_REVIEWER_SPAWN_FORK_TURNS_ARGUMENT_REJECTED_R1` 1회와 `MAIN_SEQ680_CAS_PUSH_WORKDIR_REF_TYPO_SAFETY_BLOCKED_R1` 1회는 모두 external change0, product/runtime/Git impact=`NONE`, corrected다.
- startup read-only에서 `rg.exe`가 Windows execution boundary에서 거절된 `R10_STARTUP_RG_ACCESS_DENIED_R1` 1회와 broad `Get-ChildItem`이 기존 `.pytest_cache` 접근을 거절한 `R10_STARTUP_GCI_PYTEST_CACHE_ACCESS_DENIED_R1` 1회가 있었다. 모두 product/runtime/external action0이며 명시 경로 읽기로 교정했다.
- 다음: seq686 controller envelope/strict runtime validator를 RED로 고정하고 최소 GREEN 구현 후 self-check와 preflight를 수행한다. actual WSL action count는 현재0이다.
- seq686 TDD는 신규 metadata/envelope/native self-check/runtime success-failure validator 부재로 RED `6 failed, 280 deselected` 후 최소 구현 GREEN `6 passed, 280 deselected in 5.96s`, exit0이다. 기존 seq680 checker/test region byte-preserve assertion도 포함한다.
- controller 생성 첫 대형 patch는 hunk line prefix 누락으로 적용 전 거절됐다. fingerprint `R10_CONTROLLER_PATCH_HUNK_PREFIX_MISSING_R1` 1회, product/runtime/WSL/Git impact=`NONE`이며 작은 verified patch로 교정했다.
- 첫 self-check는 함수 scope에서 `$PSCommandPath`가 비어 controller AST source를 찾지 못한 `R10_SELFCHECK_PSCOMMANDPATH_FUNCTION_SCOPE_R1` 1회, 다음 self-check는 harmless Node payload가 LF 대신 literal escape를 출력한 `R10_NATIVE_SELFCHECK_NEWLINE_ESCAPE_R1` 1회였다. 둘 다 product/runtime/WSL impact=`NONE`, WSL action0이며 script-scope path와 실제 LF로 교정했다.
- 최종 controller self-check는 alias collision0/AST parse error0, synthetic4 one-object·secret-safe, harmless Node stdout/stderr 각 line1, SHA `BDF41A72...61058`/`FE050FD6...63F45`, fixed nonzero exit를 모두 PASS했다. actual dispatch용 early return을 제거해 outer-finally 이후 단일 envelope만 반환하고 raw/native/secret clear를 보강한 뒤 동일 self-check를 다시 PASS했다.
- self-check 명령 1회가 필수 `RepoRoot`/`PrivateUrl` 인자를 빠뜨려 process 시작 전 종료됐다. fingerprint `R10_SELFCHECK_REQUIRED_ARGUMENT_OMISSION_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 정확한 두 인자를 넣은 harmless self-check로 교정했으며 WSL action0이다.
- final escalated read-only preflight PASS: local/private parent `2740657...`, application `f0d4bc7...` clean, control `fb311d4...` clean, manifest/control-runtime/probe hash exact, env mode600/hash byte-identical/name+provider-read scope exact, initial residue0, process-local Playwright/Chromium presence를 확인했다. secret 값은 출력하지 않았고 WSL action count0이다.
- 승인된 one-shot actual의 최초 dispatch 요청은 sandbox 밖 실행 검토가 shared WSL service/data 영향에 대한 신산님 명시 승인을 요구해 `CreateProcess` 전에 거절됐다. fingerprint `R10_ACTUAL_PERMISSION_BOUNDARY_REJECTED_R1` 1회, product/runtime/WSL/Git/external impact=`NONE`; deploy/verify/PG15/PG18RC/cleanup 각0, retry0이다. 우회·재요청하지 않고 self-check/preflight 증거와 exact12 draft를 보존하며 Main의 permission-boundary 판정을 기다린다.
- 현재 상태는 `WAITING_EXPLICIT_R10_WSL_EXECUTION_APPROVAL`이다. worker/write lease는 R10 exact12 기록 범위에만 유지되고 runtime 실행은 정지 상태다. dirty path는 `docs/WORK_STATUS.md`, R10 report/WI, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`의 승인 대기 draft뿐이며 제품/probe/deploy/`.env` mutation0이다. 미완료는 실제 deploy/verify/PG15/조건부 PG18RC/cleanup, seq681~686 generated5/checker/determinism/exact12 commit/postcommit이다. 다음 조치는 신산님의 명시 R10 WSL 실행 승인 후 Main이 새 지시를 내리는 것이며 actual 재시도, 새 WSL action, Git commit/push는 그 전까지 금지한다.
- 신산님이 2026-09-09 Asia/Seoul에 response `계속하자`와 exact R10 실행 문구로 `DIRECT_USER_APPROVAL`을 부여했다. approval subject SHA-256은 `723A1D914C3540B7D4FF677C25C25DDA7CFF25ED7CD43ABF1E7D436D8B6426DC`다. scope는 immutable control `fb311d4...`, candidate `f0d4bc7...`, 격리 `anvil-wsl-pg15`/`anvil-wsl-pg18rc`의 deploy1/verify1/PG15 browser1/PG15 strict PASS 시 PG18RC browser1/finally cleanup1이며, 승인된 테스트 container/network/dedicated volume 정리만 포함한다. exclusions는 `.env`, 다른 Docker 자원, Provider/Telegram/Oracle/ysna/main/C-01 변경·실행이다. prior safety rejection은 pre-dispatch/action0으로 유지하고 `WAITING_EXPLICIT_R10_WSL_EXECUTION_APPROVAL`을 해제해 same R10 one-shot을 재개한다.
- 승인 후 재확인한 self-check와 escalated read-only preflight는 모두 PASS했다. app/control/env/residue가 직전 exact state와 같고 wsl action count0이며 deploy/verify/PG15/PG18RC/cleanup 각0임을 확인했다.
- actual R10 one-shot은 정확히 1회 종료했다: deploy1 `exit0/PASS`, verify1 `exit0/PASS`, PG15 browser1 `exit1/FAIL`, PG18RC0 `NOT_EXECUTED`, outer-finally cleanup1 `exit0/PASS`, retry0이다. controller exception은 `NONE`이며 모든 phase raw/secret memory clear를 확인했다.
- PG15 safe receipt는 `result=ACCEPTANCE_FAILED`, `runtime_execution=EXECUTED`, viewport pass2/3, provider read GET only, provider write0, cross-origin0, fixture0, Last-Event-ID exact, secret safety0, screenshot memory-only, filesystem mutation residue0이다. native exit1과 receipt ACCEPTANCE_FAILED는 일치한다. exact persisted false predicates는 `receipt.result==PASS`, `viewports.all_acceptance_predicates==true`, `native.exit_code==0`이다.
- safe transformer가 failing viewport name과 개별 false UI/SSE/accessibility field path를 보존하지 않아 raw가 clear된 뒤 재실행 없이 복구할 수 없다. 추정하지 않고 primary `BROWSER_ACCEPTANCE_FAILED_R10` count1, diagnostic `R10_SAFE_RECEIPT_VIEWPORT_PREDICATE_DETAIL_INSUFFICIENT_R1` count1로 분리한다. 이는 R9 hash alias root와 다른 새 root이며 takeover 조건이 아니다.
- post-cleanup read-only preflight PASS: application `f0d4bc7...`/control `fb311d4...` clean, `.env` mode600/hash `FECAE53B...A79A` byte-identical, exact container/network/dedicated-volume/lock residue0, probe/control/manifest hash exact이다. secret 값은 출력하지 않았다.
- current evidence SHA-256은 PG15/PG18RC backup `52F690C5...E9C3`/`97453E6C...906C`, verification `96BD2FC8...8DB2`/`0CE473C5...4D3B`, image metadata `18108107...E88B3`/`2E549E4B...32393`다. backup/evidence는 보존했다.
- evidence SHA read 첫 명령은 slug에 잘못된 `anvil-wsl-` prefix를 붙여 6개 path not found로 exit1이었다. fingerprint `R10_POSTEVIDENCE_PATH_SLUG_PREFIX_R1` 1회, read-only/product/runtime/WSL state impact=`NONE`; `common.sh`의 exact slug `pg15`/`pg18rc`를 읽어 동일 hash 수집을 교정했다.
- R10 재개 첫 skill read orchestration payload에 malformed JavaScript token이 포함돼 command 실행 전 거절됐다. `R10_SKILL_READ_EXEC_PAYLOAD_SYNTAX_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 올바른 payload로 required skill 3개를 완독했다.
- report typo 교정 첫 patch는 exact line context가 달라 변경0으로 거절됐다. `R10_REPORT_TYPO_PATCH_CONTEXT_MISMATCH_R1` 1회, product/runtime/WSL/Git impact=`NONE`; exact observed line의 작은 patch로 교정했다.
- 판정은 `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R10_WSL_DEVELOPMENT_VALIDATION`; accepted=false, C-21/C-01 blocked, DIR-2 not triggered다. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 `NOT_EXECUTED`다. 다음은 seq686 failure generated5/checker/determinism/exact12 single direct-child이며 runtime 재실행과 push는 금지한다.
- seq686 builder TDD는 from-root builder 부재로 RED `1 failed, 286 deselected` 후 approval/runtime safe result/diagnosis/seq681~686/generated5/manifest/projection/Git collector를 구현해 GREEN `1 passed, 286 deselected`다.
- 첫 focused regression 명령은 파일 경로 뒤에 잘못된 token이 붙어 collection0/exit1이었다. fingerprint `SEQ686_FOCUSED_COMMAND_PATH_TOKEN_TYPO_R1` 1회, product/runtime/WSL/Git impact=`NONE`; 정확한 selector로 `12 passed, 275 deselected in 3.17s`, exit0을 확인했다.
- 첫 live checker는 신규 lease event에 contract alias `fencing_token`/`path_scope`가 없고 PACKAGE_COMPLETED의 `completion_upstream_head`가 repository projection과 달라 `EVENT_PAYLOAD_MISSING`/`EVENT_EFFECT_MISMATCH`, exit1이었다. fingerprint `SEQ686_LIVE_CHECKER_EVENT_CONTRACT_BINDING_R1` 1회, product/runtime/WSL impact=`NONE`; 기존 seq680과 contract를 비교해 exact alias 및 historical upstream head만 보완한 뒤 checker `PASS sequence=686 reporting=AUTO_CONTINUE`, exit0이다.
- generated5는 5개 파일을 materialize했다. 다음은 fresh focused/checker, two-build/materialize idempotence, exact12/cumulative286/diff-check와 single direct-child commit/postcommit이다.
- precommit focused regression은 seq680+seq686 `12 passed, 275 deselected in 3.40s`, live checker `PASS sequence=686 reporting=AUTO_CONTINUE`, `git diff --check` PASS다. dirty/untracked는 선언된 exact12 12/12와 일치한다.
- generated5 two-build byte equality와 live materialized equality, materialize2 idempotence를 확인했다. exact12/cumulative286 Windows·ordinal hash는 각각 `A517ED34...8F39A`/`BE98A5D1...86836`, `38CF5747...EE335`/`C67C1829...1ED2`로 exact다.
- 미검증은 PG18RC browser와 exact failing viewport/field 및 independent review다. 다음은 이 최종 WORK_STATUS를 generated5에 재결박한 뒤 fresh focused/checker/determinism/diff/exact12 검증, parent `2740657...`의 sole direct-child commit과 postcommit이다. runtime 재실행/push는0으로 유지한다.
- fresh final verification은 focused `12 passed, 275 deselected in 3.51s`, live checker `PASS sequence=686`, generated5 two-build/live equality와 manifest raw checksum11 PASS, `git diff --check` PASS, parent HEAD `2740657...`, dirty exact12를 확인했다.
- 임시 controller 정리 첫 시도는 workspace sandbox가 `D:\tmp\anvil-r10-controller-2740657.ps1` 삭제를 거절했다. fingerprint `R10_TEMP_CONTROLLER_CLEANUP_SANDBOX_DENIED_R1` 1회, product/runtime/WSL/Git impact=`NONE`; exact resolved path를 승인된 경계에서 삭제해 residue0을 확인했다. 삭제 대상은 이번 실행용 임시 controller 한 개이며 복구하지 않는다.
- final status 묶음의 한 read-only Git 명령에 불필요한 pathspec token이 붙어 전체 dirty 표시 대신 제한된 clean 문구를 출력했다. fingerprint `SEQ686_FINAL_GIT_STATUS_PATHSPEC_TOKEN_TYPO_R1` 1회, product/runtime/WSL/Git mutation impact=`NONE`; 즉시 plain `git status --short`로 exact12 dirty 12/12와 HEAD `2740657...`을 재확인했다.

## 2026-09-09 C-21 seq687~692 R10 evidence correction — 인수/lease

- Reviewer I1을 수락하고 append-only R10 evidence correction을 시작했다. parent/local HEAD `c8c35cf92e72ea405b1a9171983c26407175c382`, private remote record `27406570cbfbb89f19ee3a5d746687125d043d7e`, 시작 worktree clean이다. seq1~686/R10 unique artifacts/current c8c commit을 보존하며 amend/rewrite/runtime/WSL/product/external action은 금지한다.
- 담당 `developer-primary`; worker lease `worker-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-20260909-001`, execution fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-execution-fence-epoch-1-c8c35cf`; write lease `write-lease-c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-20260909-001`, write fence `c21-workbench-ui-wsl-auth-browser-runtime-retry-r10-evidence-correction-write-fence-epoch-1-c8c35cf`를 exact12에 발급했다.
- exact12 Windows/ordinal `57AB57A282545B4BAC8FE729A04FE315DDDC6E58C69B30086093AFC5B60AC0EB` / `384AFFDE81E005F3882CB839D0E0A0DE4AD44EB64EE21B8DAF18264B132BC8A5`; cumulative292 Windows/ordinal `8F4C7FE3DE09BE70264AB38C01969B8B9B58E1D8C7A8EF572205FB6547FCC9B6` / `D814CFED8C979B0D89F90DA39497675578477C2FC5062585EB21F3480BE3913E`를 repository helper로 재확인했다.
- review 판정은 C0/I1/M0다. historical R10 safe receipt의 `provider_row_count=0`, `groq_detail_clicked=false`는 viewport pass2/3만으로 지지되지 않는다. historical bytes는 그대로 두고 effective projection에서 두 필드만 `UNAVAILABLE_NOT_PERSISTED`로 교정한다. 그 외 safe receipt/false predicates/native exit/result는 strict preserve한다.
- Main의 read-only hash precheck path typo `EVIDENCE_CORE_CORRECTION` 1회는 product/runtime/Git impact=`NONE`이며 exact `R10_EVIDENCE_CORRECTION` path set으로 즉시 helper recompute PASS했다.
- 다음: seq692 predicate를 TDD RED로 고정한 뒤 correction generated5/checker를 구현한다. runtime/WSL/product/external0, push0을 유지한다.
- seq692 TDD RED는 correction API/marker 부재로 `4 failed, 287 deselected`; metadata/anchors/review/effective correction/leases/events/generated5/manifest validator/projection/Git collector/dispatcher 구현 후 GREEN `4 passed, 287 deselected in 4.73s`다.
- generated5 materialize 후 seq686+seq692 focused `11 passed, 280 deselected in 2.54s`, live checker `PASS sequence=692 reporting=AUTO_CONTINUE`, `git diff --check` PASS, dirty/untracked exact12 12/12를 확인했다.
- generated5 two-build byte equality/live equality와 materialize2 idempotence PASS, raw checksum11, exact12/cumulative292 hash exact이다. existing seq686 checker/test region strict equality와 seq1~686/R10 unique artifact anchors도 PASS했다.
- status `READY_R10_EVIDENCE_CORRECTION_FOR_INDEPENDENT_REVIEW`, next `INDEPENDENT_REVIEW_R10_EVIDENCE_CORRECTION_BEFORE_R11`; runtime/WSL/product/external action0, accepted=false다. 다음은 이 final status를 generated5에 재결박하고 fresh verification 후 parent `c8c35cf...`의 sole direct-child commit/postcommit이다. push는 Main이 수행한다.
