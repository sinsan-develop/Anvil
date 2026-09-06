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
