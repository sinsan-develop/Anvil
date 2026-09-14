# C-11 REWORK 3차 개발 완료보고

## 판정

`COMPLETED` — 독립 Spec/Quality 리뷰의 3차 잔여 blocking 1개(canonical parent content hash 미검증)에 대한 동일 writer REWORK 구현·기본 검증을 완료했다. 이는 제품 후보 제출이며 Main의 재리뷰·canonical 제품 투영·최종 ACCEPTED를 대신하지 않는다.

최초 후보의 APPLY·역계보는 1차에서 교정했다. 1차 후보에 남아 있던 scalar Design/WorkPlan 조합, 누적 diff 과잉 차단, IterationPlan 시각 재사용, 승인 삽입순서 의존, 공개 authority DTO 비교는 2차에서 교정했다. 2차에 남은 WorkPlan/IterationPlan의 형식-valid hash 주입·same-hash parent splice는 이번 3차에서 교정했다. 과거 C-11 완료보고·commit·takeover 주장은 현재 실행 권위로 사용하지 않았다.

## 판단 이유

3차 최소 보완: WorkPlan.create / IterationPlan.create factory와 canonical_payload / validate_content_hash 명시 검증을 추가했다. payload는 artifact_type, artifact_id, revision, parent ID/hash, scope(정렬) 또는 sequence, created_at(UTC ISO)을 포함한다. WorkPlan factory와 실제 parent를 받는 IterationPlan factory는 payload hash를 생성한다. build_execution_plan, generate_work_instruction 및 schedule의 부모 검증 경로가 이 hash를 반드시 재계산한다. 같은 hash로 parent·ID·revision·scope·sequence·생성 시각을 바꾸면 각각 WORK_PLAN_CONTENT_HASH_MISMATCH 또는 ITERATION_PLAN_CONTENT_HASH_MISMATCH로 차단한다. 바깥 ExecutionPlan hash를 재계산해도 부모 hash 검증을 생략하지 않는다.

기존 persistence 직접 생성자의 hash 형식 검증 계약은 유지했다. 명시 canonical factory/validator는 C-11 경로에서만 의무화하며 저장된 hash를 조용히 재작성하지 않는다. 아래 1·2차 교정 계약도 유지한다.

1. write/execute scheduling은 `DESIGN_SPECIFICATION`, `WORK_PLAN`, `WORK_INSTRUCTION`, `EXECUTION_PLAN`의 현재 exact subject ID/hash/type human approval을 모두 요구한다. 기본 종류는 EXECUTION_PLAN이며 APPLY는 `APPROVAL_TYPE_INVALID`다. APPLY 승인만으로는 scheduling할 수 없다. APPLY_APPROVED 이후 사용자 검증·적용 흐름은 구현하지 않았다.
2. `build_execution_plan`은 실제 models.WorkPlan을 필수 입력받는다. Design ID/hash와 WorkPlan ID/hash는 그 artifact에서 파생하며 raw scalar 조합을 받지 않는다. 동결한 source_work_plan, IterationPlan, WI의 전체 계보와 WorkPlan scope를 재검증한다. WI는 실제 IterationPlan ID/hash를, ExecutionPlan은 WI ID/hash를 참조한다. WI 생성은 명시적 UTC created_at이 필수이고 IterationPlan 생성 이전이면 거부한다. WI hash에 실제 생성 시각을 결박하며 ExecutionPlan 생성 이전 승인 우회에 IterationPlan 시각을 재사용하지 않는다.
3. WI에 `prohibited_paths`, `validation_contract`를 명시적 immutable tuple로 추가했다. C-11 WI 생성에는 nonempty validation contract와 실제 RequestAnalysis가 필수다. scope·risk·completion·prohibited actions/paths·egress·analysis hash·parent lineage·validation contract를 canonical WI hash에 묶는다. 기존 B-04 모델 생성 호환을 위해 새 필드의 기본값은 유지하지만, 빈 validation contract인 legacy WI는 C-11 실행계획으로 인정하지 않는다.
4. 실제 diff는 분석 범위와 **completed write Step + 현재 ready write Step** 범위의 교집합에만 허용한다. completed dependency closure 검증을 유지하며 정상 누적 diff는 허용한다. 미래 dependent Step의 경로를 현재 write에서 사용하는 시도는 `SCOPE_EXPANSION_REQUIRED`와 plan-bound ScopeApprovalRequest로 차단한다.
5. `design_baseline_hash`는 RequestAnalysis.baseline_hash와 별개이며 실제 WorkPlan.design_baseline_id/hash에서만 파생한다. Design/WorkPlan artifact의 잘못된 조합은 생성과 schedule 재검증에서 fail closed한다. Design, WorkPlan, WI, ExecutionPlan의 각 exact 승인 검사를 유지한다.
6. scheduler는 exact `PlanningMainAuthorityService`만 authority guard로 인정한다. host-only record_observation이 canonical MainAuthoritySource/Status enum, immutable record, event hash, observed/expires, current fence, actor/plan을 검증·복사한다. 내부 record 중 최신 observed_at을 사용하고 동시각 충돌은 차단한다. guard 결과와 record admission을 immutable audit event로 남긴다. raw MainAuthoritySnapshot·duck type·agent-message source·direct claim·stale·wrong fence·wrong plan·newer terminated record는 차단하며, 과거 ACTIVE를 나중에 주입해도 current를 되돌리지 않는다. 실제 외부 IO는 없다.

PlanningApprovalService의 기존 B-04 경계는 유지했다. 추가 exact guard는 삽입순서가 아니라 subject/type별 최대 approved_at 기록을 선택한다. 최대 시각의 기록이 둘 이상이면 deterministic fail-closed한다. 더 최신 revoked/superseded/other-hash 뒤 과거 ACTIVE를 재삽입해도 이전 승인으로 후퇴하지 않는다. `approved_at <= at < expires_at`를 검사하며, WI 생성 ≤ WI 승인 ≤ ExecutionPlan 생성 ≤ ExecutionPlan 승인의 시간 계보도 검사한다. subagent agreement는 authenticated human record가 아니다.

기존 immutable 분석·Step·plan, hash 재검증, canonical path/protected/unsafe/hard-risk 거부, dependency state, mixed read-only scheduling, receipt 결정성·IO0 회귀를 유지했다.

## 조치와 기준선

- 작업 공간: `D:\tmp\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작/현재 HEAD: `312e193a6b3b399d9bc36368b82bec137be328b0`
- parent / 승인 baseline: `002ebea5409eb9fa32cde045f92f4b1b69b587ed`
- 최초 제품 시작 status: clean; seq875 start control PASS 이후 Main 별도 제품 지시.
- 3차 REWORK 인수/현재 status: 직전 후보 dirty 8개를 보존했으며 동일 8개 허용 파일만 수정했다. stage/commit/push하지 않았다.
- WI: `WI-C-11-20260914-002`, SHA-256 `42CE4BDC9911C7E2D3CA779810D825C58113EF23C13433C137BABD57998C4C61`
- Invocation SHA-256: `74E77F0CE3830098FEA50701CDBA926F7A1CA70E078EF01EB358E062F3C23162`
- Design SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- WorkPlan SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- Matrix SHA-256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- TestPlan SHA-256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 위 6개 문서 hash는 1차 REWORK에서 재확인했고 2·3차에는 해당 문서 파일을 수정하지 않았다.
- worker: `worker-lease-c11-20260914-001` / `c11-execution-fence-epoch-1-002ebea5409eb9fa`
- write: `write-lease-c11-20260914-001` / `c11-write-fence-epoch-1-32cde045f92f4b1b`
- canonical ACTIVE dual lease/token/path scope 재확인. 3차 시작 clock 확인 2026-09-15 07:30 KST, 최종 checker/clock 확인 07:36 KST; 만료 10:15 KST 전 수행했다.
- control/progress/HANDOFF/manifest/checker/tooling 및 C-08~C-10 제품 파일 mutation 없음. 외부 실행·새 agent·C-12 시작 없음.

## 변경 파일과 diff

| 파일 | 변경 요약 |
|---|---|
| packages/planning/planner.py | canonical WorkPlan/IterationPlan payload 재계산을 생성·schedule 모두 강제; 기존 계보·scope·authority 계약 유지 |
| packages/planning/models.py | WorkPlan/IterationPlan canonical factory·payload·validator; 기존 persistence 생성자 유지; WI immutable 계약 유지 |
| packages/planning/service.py | approved_at 최신/동시각 fail-closed 승인, PlanningMainAuthorityService 내부 control record·canonical enum·local immutable audit |
| packages/planning/__init__.py | 새 순수 planner·authority 계약 export |
| packages/orchestration/__init__.py | 동일 순수 서비스 export |
| tests/planning/test_c11_planner.py | 8개 기존 테스트의 실제 lineage·WI/EP approval·authority fixture 교정 |
| tests/planning/test_c11_admission.py | 최초 후보 54개 + 1차 46개 + 2차 28개 + 3차 19개 = 147개 parameterized 검증. 기존 models contract 확장 회귀도 이 허용 파일에 추가 |
| docs/04_test_reports/C-11_COMPLETION_REPORT.md | 현재 REWORK 판정·실행 증거·미검증 경계 갱신 |

검토 명령: `git diff -- packages/planning packages/orchestration tests/planning tests/orchestration docs/04_test_reports/C-11_COMPLETION_REPORT.md`. 신규 untracked `tests/planning/test_c11_admission.py`는 별도로 전체 파일을 검토해야 한다. 나머지 7개는 tracked modification이다.

공개 HTTP/API 또는 DB schema 변경은 없다. 순수 내부 planner 생성 호출은 actual IterationPlan/WI/Design hash를 명시하도록 교정했으며, 잘못된 역계보 호출 호환은 유지하지 않는다. B-04 승인 API/모델 기본 동작은 관련 회귀로 확인했다.

## 3차 RED → GREEN 실제 명령과 결과

모든 Python 명령은 해당 Windows worktree에서 로컬 fixture로 실행했다. 외부 runtime·네트워크를 실행하지 않았다.

| 단계 / 정확한 명령 | exit | 실제 결과 |
|---|---:|---|
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py -k rework3 --disable-warnings -ra` — 최초 RED | 1 | 3 failed / 128 deselected: same-hash WorkPlan Design parent, IterationPlan parent/sequence splice 허용 |
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py tests/planning/test_c11_planner.py tests/planning/test_models.py --disable-warnings -ra` | 0 | 140 passed, 0.59s; canonical fixture 전환 및 legacy model 계약 유지 |
| 위 `-k rework3` 명령 — 추가 적대 포함 최종 | 0 | 19 passed / 128 deselected, 0.16s |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration --disable-warnings -ra` — 최종 | 0 | 660 passed, 1 warning, 1.71s |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration tests/repository_intelligence tests/action_policy tests/tool_gateway -ra --tb=short` — 최종 | 0 | 980 passed, 1 warning, 2.18s |
| `python -B -m compileall -q packages/planning packages/orchestration tests/planning tests/orchestration` | 0 | 출력 없음, 성공 |
| `git diff --check` | 0 | whitespace 오류 없음 |
| `python -B scripts/check_project_progress.py` | 1 | `C11_START_GIT_INVALID`, 제품 dirty와 start-only gate 불일치의 예상 차단 |

3차 의도 RED 외 추가 오류는 없었다. 허용 dirty 8개를 유지하기 위해 기존 test_models.py는 수정하지 않았고, canonical model 계약 확장 검증을 test_c11_admission.py에 추가했다. 이전 persistence 직접 생성자 회귀는 원래 test_models.py 그대로 통과했다. 3차 실제 수정은 models.py, planner.py, test_c11_admission.py, test_c11_planner.py, 이 보고서의 5개이며 다른 dirty 3개는 보존했다.

### 2차 REWORK 실행 이력 — 현재 합격 증거 아님


| 단계 / 정확한 명령 | exit | 실제 결과 |
|---|---:|---|
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py -k rework2 --disable-warnings -ra` — 최초 RED | 1 | 6 failed / 100 deselected: WorkPlan 미결박, 정상 누적 diff 거부, WI created_at 부재, revoked/superseded 이후 과거 ACTIVE 재삽입, raw authority DTO 허용 |
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py -k 'rework2_work_plan or rework2_completed or rework2_wi_requires' --disable-warnings -ra` | 0 | 3 passed / 103 deselected |
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py -k rework2_old --disable-warnings -ra` | 0 | 2 passed / 104 deselected |
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py tests/planning/test_c11_planner.py --disable-warnings -ra` | 0 | 114 passed, 0.53s |
| 위 `-k rework2` 명령 — 추가 적대 포함 최종 | 0 | 28 passed / 100 deselected, 0.16s |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration --disable-warnings -ra` — 최종 | 0 | 641 passed, 1 warning, 1.59s |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration tests/repository_intelligence tests/action_policy tests/tool_gateway -ra --tb=short` — 최종 | 0 | 961 passed, 1 warning, 2.09s |
| `python -B -m compileall -q packages/planning packages/orchestration tests/planning tests/orchestration` | 0 | 출력 없음, 성공 |
| `git diff --check` | 0 | whitespace 오류 없음 |
| `python -B scripts/check_project_progress.py` | 1 | `C11_START_GIT_INVALID`, start-only exact9와 제품 dirty 불일치의 예상 차단 |

기본 basetemp에서 테스트가 성공하여 별도 temp 경로 변경은 필요하지 않았다. 2차에서 의도 RED 6건 이후 추가 제품/fixture 오류는 없었다.

### 1차 REWORK 실행 이력 — 현재 합격 증거 아님


| 단계 / 정확한 명령 | exit | 실제 결과 |
|---|---:|---|
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py -k rework --disable-warnings -ra` — 첫 RED | 1 | 5 failed / 54 deselected; APPLY 허용, 미래 Step scope 허용, Main 자기 주장 read/write 허용, source WI 필드 부재 |
| `python -B -m pytest -q -p no:cacheprovider tests/planning/test_c11_admission.py tests/planning/test_c11_planner.py --disable-warnings -ra` — 첫 GREEN | 0 | 67 passed, 0.50s |
| 위 `-k rework` 명령 — 시간 계보 추가 RED | 1 | 2 failed / 38 passed / 54 deselected; 늦은 WI 승인·이른 EP 승인 허용 |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration --disable-warnings -ra` — 중간 GREEN | 0 | 607 passed, 1 warning, 1.96s |
| 위 `-k rework` 명령 — 추가 경계 fixture 점검 | 1 | 2 failed / 44 passed / 54 deselected; 테스트가 WI 생성 이전 승인을 넣어 APPROVAL_LINEAGE_INVALID를 먼저 발생시킴. fixture만 교정 |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration --disable-warnings -ra` — 최종 | 0 | 613 passed, 1 warning, 1.60s |
| `python -B -m pytest -q -p no:cacheprovider tests/planning tests/orchestration tests/repository_intelligence tests/action_policy tests/tool_gateway -ra --tb=short` — 최종 | 0 | 933 passed, 1 warning, 2.57s |
| `python -B -m compileall -q packages/planning packages/orchestration tests/planning tests/orchestration` | 0 | 출력 없음, 성공 |
| `git diff --check` | 0 | whitespace 오류 없음 |
| `python -B scripts/check_project_progress.py` — 제품 dirty | 1 | `C11_START_GIT_INVALID`; seq875 exact9 start-only gate의 예상 차단. PASS가 아님 |

경고는 기존 Starlette formparsers.py:12의 `PendingDeprecationWarning: Please use import python_multipart instead` 1건이다. dependency는 변경하지 않았다.

직전 후보의 567/887 PASS는 이번 REWORK 완료 증거로 재사용하지 않는다. 직전 후보 TDD의 최초 35건 및 보완 7/4/2/1건 RED 기록은 이전 시도 이력이며, 1차 표는 당시 실제 실행 이력이며, 현재 3차 판정은 660/980 및 3차 표의 증거만 사용한다.

## 검증 ID와 오류 집계

- AV-SAFE-001: 독립 Design/WorkPlan/WI/EP exact human approval, 누락·wrong hash·latest stale binding·APPLY·미래·만료·시간 역계보 거부.
- AV-SAFE-019: outside/sibling prefix, 미래 dependent Step 경로, malformed/wildcard diff, scope request hash binding.
- AV-AGT-024: Main 없음·비활성, authority 없음·stale·future·terminated·spoof·wrong fence·duck type를 read/write 모두 거부.
- AV-AGT-028 / AV-FLOW-016: subagent role/agreement와 human approval 분리; Design hash 독립 결박; 실제 WI lineage·prohibited/validation 계약 tamper 거부.
- IO0: 기존 read 허용 및 새로운 stale-fence blocked evaluator를 subprocess/socket/open spy로 검증. 실제 dispatch는 수행하지 않는다.
- 3차 의도 RED fingerprint `C11-PARENT-CANONICAL-HASH-SPLICE`: 3건, 모두 GREEN. 19개 회귀는 부모 2종의 모든 canonical 필드 변형, explicit payload hash/정렬 결정성, legacy 생성자 호환, outer plan 재hash 뒤 부모 재검증·IO0·blocked receipt 결정성을 포함한다.
- 2차 의도 RED fingerprint `C11-REVIEW2-PARENT-TIME-CURRENT-AUTHORITY`: 6건, 모두 GREEN. 추가 적대 28건에는 WorkPlan 변형 4종, 미래 누적 diff 2종, WI 시각 3종, 승인/authority 시간순 재삽입·동시각 충돌·raw source 거부·감사 동결을 포함한다.
- 1차 REWORK 의도 RED fingerprint `C11-REVIEW-AUTHORITY-LINEAGE-SCOPE`: 5건, `C11-APPROVAL-CHRONOLOGY`: 2건. 모두 GREEN.
- fixture 오류 fingerprint `C11-BOUNDARY-FIXTURE-PREDATES-WI`: 2건, 원인은 테스트의 다른 승인 계보가 먼저 무효였음. 잘못된 fixture만 교정, 제품 guard 완화 없음.
- 도구 오류 `APPLY_PATCH-NUMBERED-HUNK`: 1건. 파일 적용 전 거부되었고 정상 hunk 문법으로 재작성했다. 제품 오류/정식 FAILURE_REPORT에 합산하지 않는다.
- 독립리뷰 REWORK는 1·2차에 이어 이번 잔여 1건의 3차를 인수했다. 이 작업 중 별도 정식 FAILURE_REPORT 제출은 0회이며 과거 실패/takeover 횟수를 추측해 합산하지 않는다.
- canonical checker 차단은 1·2차 각 1회에 이어 이번 3차에서도 1회 재확인했다. Main 후속 projection 없이 이를 우회하거나 PASS로 표시하지 않았다.

## 미검증 경계·잔여 위험·다음 조치

- 기존 persistence의 임의 content_hash를 canonical hash로 자동 변환·승인하지 않는다. 그런 legacy artifact는 C-11 진입에서 거부된다. 실제 저장 artifact를 새 canonical factory로 재발행한다면 hash 변경에 따른 human approval/child lineage 재결박이 필요하며, 해당 DB migration·운영 승인은 이번에 실행하지 않았다.

- PlanningMainAuthorityService.record_observation은 기존 B-04 승인 service와 동일한 수준의 **trusted embedding-host admission 경계**다. 공개 DTO 두 개 일치로 scheduling할 수 없고 service의 내부 current record만 검증한다. production host는 agent payload가 record admission을 직접 호출할 수 없도록 분리하고 event provenance·실제 liveness를 인증해야 한다. 본 in-memory adapter 자체는 cryptographic identity나 실제 process liveness 증거가 아니다.
- PlanningApprovalService 기록 admission은 기존 B-04 trusted boundary다. 실제 human 인증, 영속 저장소, event provenance, 사용자 검증 후 APPLY_APPROVED 전이는 이번 범위 밖이며 실행하지 않았다.
- 경로 검증은 IO 없는 lexical/case/prefix 검증이다. 실제 junction/symlink/physical path identity와 실행 직전 정책 재검사는 C-09/C-10 실행 경계 책임이다.
- permission/egress 값은 동결 snapshot hash binding이다. 실제 live policy 공급·네트워크·Secret manager·DB/API/browser/Provider/WSL/Docker/deployment는 미검증·미실행이다.
- ScopeApprovalRequest는 pending request seam이며 scope 확대 자체를 승인하지 않는다.
- seq875 progress/HANDOFF/control은 Main 소유로 미갱신. Main이 현재 8개 제품 diff·검증을 후속 투영에 묶고 독립 Spec/Quality 재리뷰 후 최종 판정·commit을 수행해야 한다.
- commit 또는 후속 작업 전에 lease 만료를 재확인한다. C-12 미착수.

## rollback

복구 기준은 시작 commit `312e193a6b3b399d9bc36368b82bec137be328b0`이다. 3차 REWORK 이전 후보 8개 dirty를 폐기하거나 reset/stash하지 않고 동일 writer가 허용 파일을 보완했다. 현재 미커밋 전체 diff를 먼저 보존한 뒤 Main 승인 아래 선택적 역패치 또는 후속 revert로 복구한다. force/history rewrite/clean/delete는 수행하지 않았다.
