# C-09 Main takeover 완료보고 (현재 권위)

## 판정

`ACCEPTED_EXACT20 / SAFE_COMMIT_CANDIDATE_READY` — PMO의 provenance·직접 의존성 기술 권고와 그 권고대로 실행하라는 신산님의 지시에 따라 historical R4/takeover exact18은 불변으로 보존하고, 현재 ACTIVE_MAIN 제품 범위만 exact20으로 최소 교정했다. authoritative·회귀·정적 gate와 독립 spec/quality review에서 blocking Critical/Important 0을 확인했다. 기능·요구사항·중요 위험은 변경하지 않았으며 C-10과 DIR-2는 시작하지 않는다.

## 기준선·보존 상태

- branch: `codex/c09-execution-backends-r1`
- HEAD: `10bbb879fb15ce4fa7b1a750f872c33af3cddf46`
- `development/main...HEAD`: behind 0 / ahead 4
- Main takeover WorkInstruction SHA-256: `FBCFAA024ADD77AE0FE85398C5EAF99A0111F260D7E917EFEDD3226E29124B3C`
- 현재 staged 0, product exact20과 acceptance control exact7을 합친 unstaged exact27 단일 commit 후보다.
- root checkout과 다른 worktree, 사용자 dirty/untracked 파일은 수정·삭제·reset·clean·stash하지 않았다.
- 신규 branch/worktree, push/PR/merge/deploy는 수행하지 않았다.

## exact20 기술 교정

- 포함: `packages/domain/identifiers.py`, `packages/execution_backends/safeio.py`.
- 제외: `packages/domain/__init__.py`, `packages/orchestration/delegation.py`.
- 제외 두 파일은 takeover 이후 추가된 hunk만 HEAD와 비교해 제거했으며 현재 두 파일 모두 `git diff --exit-code`가 0이다. 다른 기존 변경은 덮어쓰지 않았다.
- historical exact18 raw map·manifest·seq1~824는 재작성하지 않았다. checker는 committed control `10bbb879`의 seq824 projection을 immutable 기준으로 검증하고 successor seq825~829만 append한다.
- 이 교정의 근거는 신규 제품 기능·설계 승인이 아니라 `PMO_TECHNICAL_RECOMMENDATION_USER_EXECUTION_DIRECTION`이다.

## Main takeover 보완

1. C-02 operational identifier 계약에 맞게 유효한 Unicode·공백·기호 ID를 보존하고 물리 자원명만 hash component로 분리했다.
2. Git/Docker의 root scope `.`가 모든 하위 dirty/untracked 경로와 충돌하도록 하여 `BASELINE_CONFLICT / USER_DECISION_REQUIRED`를 복구했다.
3. prepare 당시 Git workspace root 물리 identity를 고정하고 모든 read·stat·scandir·scope guard에서 재검증하여 root 교체도 zero-disclosure failure로 닫았다.
4. Git bounded subprocess에 handle별 cancellation을 연결해 kill/reap하고, 정상 종료 시 stdout EOF까지 drain한다.
5. terminal handle과 실제 실행 중 상태를 분리하여 cancel 직후에도 실행이 끝나기 전 workspace destroy를 거부한다.
6. Docker는 inspect 전후 cancellation fence를 확인하고, cancel 중 inspect/control 실패도 단일 FAILED terminal로 수렴시킨다.
7. Docker runner의 비문자 stdout을 문자열로 승격하지 않고 `OUTPUT_SCHEMA_INVALID`로 terminal 처리한다.
8. Docker orphan은 container 제거 후 로컬 cleanup 실패 상태를 기억하여 같은 권위 증거로 재시도할 수 있다.
9. destroy된 workspace ID의 재사용을 `WORKSPACE_ID_RETIRED`로 거부해 tombstone과 새 자원 충돌을 막았다.
10. INSENSITIVE repository의 case policy를 helper envelope에 전달하고 실제 archive spelling을 안전하게 해석한다.
11. path component lookup과 directory walk가 동일 요청의 deadline·누적 entry budget을 공유해 fan-out을 열거 단계에서 차단한다.
12. hostile mapping·receipt·numeric limit·permission revoke·per-handle correlation·canonical receipt 연결 등 기존 corrective axes를 유지했다.

C-10, 신규 write/patch/execute 도구, 신규 backend/API/persistence, WSL/Provider/Secret/외부 실행은 추가하지 않았다.

## TDD와 최종 검증

- 신규 blocking 회귀 첫 RED: 12개 선택 중 `11 failed, 1 passed`.
- 1차 GREEN: `12 passed in 21.65s`.
- 전체 회귀 1차: `99 passed, 4 failed`; case-policy 테스트 계약, protected override signature, timeout polling을 보완했다.
- 추가 Docker cancel/lookup RED: `2 failed` → `2 passed in 2.34s`.
- Docker 전체: `26 passed in 41.54s`.
- C-09 authoritative:
  - `python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py`
  - fresh exit 0, `106 passed in 198.75s`.
- C08/A13 regression: fresh exit 0, `85 passed in 103.74s`.
- C08/A13 command: `python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py`.
- C13 regression: fresh exit 0, `5 passed in 0.51s`.
- C13 command: `python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py`.
- C02 regression: fresh exit 0, `126 passed in 0.52s`.
- C02 command: `python -B -m pytest -q -p no:cacheprovider tests/domain/test_identifiers.py tests/orchestration/test_delegation_packet.py`.
- exact20 control: `python -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k C09MainTakeoverControlTests`, fresh exit 0, `9 passed, 434 deselected in 36.71s`.
- seq829 acceptance control RED: builder 부재로 `2 failed, 443 deselected`; 구현 후 GREEN `2 passed, 443 deselected`.
- seq829 관련 재검증: 기존 takeover 9 + acceptance 2 + generic Git authority 1, `12 passed, 433 deselected in 53.35s`.
- 전체 `tests/tooling/test_project_progress.py` 보강 실행은 `439 passed, 6 failed in 2068.36s`로 완전 PASS가 아니다. 그중 seq829 관련 2건은 위 12 PASS로 수정·재검증했다. 남은 C03 historical WI hash 3건과 C04 historical Git collector reason-code 1건은 변경 없는 committed HEAD `10bbb879` clean local clone에서도 동일하게 `4 failed in 18.65s`로 재현되어 C-09 acceptance 수정 범위 밖의 기존 failure로 분리했다.
- compileall: fresh exit 0.
- `git diff --check`: fresh exit 0.
- 독립 spec review: `PASS — Critical 0 / Important 0 / Minor 1`; 실행 명령 누락 Minor는 이 보고서에서 해소했다.
- 독립 quality review: `PASS — Critical 0 / Important 0 / Minor 1`; backend authorize 전 거절 시 pending permission reservation 누적 가능성은 비차단 잔여 위험으로 기록한다.
- progress checker:
  - `python -B scripts/check_project_progress.py`
  - fresh exit 0, `G-05 project progress contract: PASS sequence=829 reporting=AUTO_CONTINUE`.
  - `python -B scripts/check_project_progress.py --c09-final-acceptance-mode=WORKTREE_CANDIDATE`
  - fresh exit 0, `G-05 project progress contract: PASS sequence=829 reporting=AUTO_CONTINUE`.

## Canonical acceptance successor

- `docs/progress/progress-events.json`은 seq1~824 raw event object bytes를 보존하고 seq825~829 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED → INDEPENDENT_TEST_JUDGMENT_RECORDED → MAIN_PACKAGE_ACCEPTED`만 append한다.
- `docs/progress/build-progress.json`과 `docs/progress/BUILD_HANDOFF.md`는 C-09 `ACCEPTED`, active agent/worker/write lease 없음, C-10 `READY_NOT_STARTED_PER_USER_DIRECTION`, DIR-2 `NOT_REACHED`를 canonical 상태로 기록한다.
- `docs/evidence/manifests/C-09_FINAL_ACCEPTANCE_MANIFEST.json`은 product exact20 경로/hash, 106/85/5/126 및 control 9, compile/diff PASS, 독립 spec/quality blocking 0, actual Docker/WSL/external 미검증을 결박한다.
- acceptance control exact7은 manifest, detached digest, progress, events, HANDOFF, checker, checker test다. 신규 governance layer·branch·WorkInstruction은 만들지 않았다.

## 미검증·다음 경계

- actual Docker daemon/CLI, Linux container, WSL, DB/API/UI/browser, Provider, SSH/network/deploy/Secret은 `NOT_EXECUTED`/`NOT_ACCESSED`다.
- Docker 증거는 injected fake runner와 순수 helper fixture의 계약 증거이며 실제 Docker runtime PASS가 아니다.
- local Git 증거는 pytest 소유 임시 repository의 integration 증거이며 운영/WSL 성공 주장이 아니다.
- commit 후보는 unstaged product exact20 + acceptance control exact7 = exact27 한 경계로 보존돼 있다. staged 0, commit 미수행이며 historical seq1~824는 재작성하지 않았다.
- 비차단 잔여 위험: backend authorize 전 거절된 장기 세션의 pending permission reservation 정리 정책은 후속 범위에서 검토한다.
- C-10은 `READY_NOT_STARTED_PER_USER_DIRECTION`으로 시작하지 않았고 DIR-2는 `NOT_REACHED`다.

---

# 이전 R4 완료보고 (역사적 참고용, 현재 판정으로 사용 금지)


# C-09 R4 제품 재작업 완료보고

## 판정

`COMPLETED` — epoch3 Primary Developer의 exact18 구현과 자체 검증이 완료됐다. 독립 Reviewer와 Main final acceptance 전이므로 C-09 `ACCEPTED`는 선언하지 않는다.

## 기준선과 실행 권한

- branch/dispatch HEAD: `codex/c09-execution-backends-r1` / `85d72196eaafe3e458f8aea7016df94f810df086`
- parent: `74f9878de521a6bc5a2c4f5165332c76edfc1354`
- R4 WorkInstruction SHA-256: `7BFDD939DADE6D2605D6185ED1ACE03C6D5C6FED8E3123BA6792120C5268B2B3`
- R4 invocation SHA-256: `6E934F12E5B3D4D5C6536C4CAB2030953415726CE212F87A4535120A3D605616`
- R4 start manifest SHA-256: `098DC75E0A748652E76DC43392B028E842AEB0A3995F3FFD5F99093899D86778`
- worker token: `c09-execution-backends-r4-execution-fence-epoch-3-a84e19276fc34db5`
- write token: `c09-execution-backends-r4-write-fence-epoch-3-3c91b6e5087a4fd2`
- product exact18 path hash: `AC308DAC4396006ABA4FFD3CCDB44FA90063F787C88EAA9F7E6B86E541D0887F`
- 시작 checker: `PASS sequence=814 reporting=AUTO_CONTINUE`; 제품 stage/commit/push는 수행하지 않았다.

## R4 corrective cluster 구현 결과

1. Docker helper 입력을 operation/arguments와 trusted `repository_id`, approved baseline, manifest hash, canonical target scopes, output/time limits를 포함하는 canonical authority envelope로 고정했다.
2. replay 조회, payload conflict, request-ID uniqueness와 RUNNING 등록을 한 lock transaction으로 원자화했다. 동시 동일 요청 loser는 winner terminal을 기다린 뒤 같은 immutable handle/receipt를 받고 실제 IO는 1회다.
3. caller-facing cancel/stream/collect의 run/session/workspace owner identity를 완전한 exact match로 강제한다. missing/partial/cross-owner는 fail-closed한다.
4. Docker cancel은 workspace container를 stop하지 않고 handle 전용 `anvil-read-tool-cancel` control만 호출한다. 다른 handle과 retained workspace의 후속 read를 보존한다.
5. 모든 terminal 상태에 repository/baseline/manifest/scopes, owner, operation/path, idempotency, requested/started/completed, limits, result/error digest를 담은 `ExecutionReceipt`와 SHA-256을 생성한다. handle, terminal event, inline artifact와 Gateway audit가 receipt를 참조한다.
6. Gateway는 canonical tool output schema를 실제 bounded handle result에 적용하며 malformed output은 `OUTPUT_SCHEMA_INVALID`와 audit 1건으로 거부한다.
7. Git status/diff는 streaming hard cap, search는 deadline/file/cumulative byte/output cap, symbols는 deadline과 row별 encoded output cap을 IO 중 조기 적용한다.
8. caller `verified_baseline_manifest_hash` self-attestation을 제거했다. backend가 소유한 public manifest bytes authority를 `(repository_id, approved_baseline)`로 조회하고 실제 SHA-256 일치 후에만 prepare한다.
9. non-Mapping ToolRequest arguments는 raw exception 없이 schema denial audit 1건, backend IO 0으로 종료한다.
10. permission은 consumable per-session reservation을 사용한다. registry lock은 generation/grant 검증과 IO mark의 짧은 원자 구간에서만 잡고 장기 backend IO에는 유지하지 않는다. stale/revoked token은 IO 0이다.
11. workspace state를 lock 아래 `ACTIVE→DISPOSING→DESTROYED`로 전환한다. execute/admission은 ACTIVE만 허용하고 cleanup 실패 시 ACTIVE로 rollback한다.
12. Docker image digest는 exact 64 hex만 허용한다. prepare 실패 orphan은 endpoint digest/expected ownership/error/receipt hash를 immutable public accessor로 제공하며 trusted disposal authority의 recovery seam을 둔다.
13. host read는 root-to-leaf reparse 검사와 safe-target 선택 뒤 open/fstat physical identity 재검증을 사용한다. duplicate/nested physical workspace mapping registry도 fail-closed한다.

기존 source/common-dir zero mutation, opaque ID와 managed containment, 24h retention/trusted disposal, Docker create→inspect→start→inspect, exact owned mount/resource/network 검증, canonical five-tool registry, B-09 legacy adapter, C-13 permission registry public 계약과 pytest basename 해결은 유지했다.

## TDD RED → GREEN과 오류 이력

- focused hostile RED: `13 failed, 20 passed in 104.37s`. 13개 corrective cluster를 각각 재현했다.
- 첫 구현 후 `3 failed, 30 passed in 93.87s`: manifest validation precedence, Docker unsafe fixture의 baseline 변수 순서, orphan evidence 필드 3개 fingerprint가 각 1회 발생했다. 근본 원인을 분리 수정해 `33 passed in 100.77s`로 전환했다.
- physical hostile 추가 RED: mapping registry 미구현 import와 safe-target 후 교체 race를 고정했다. 구현 후 `2 passed, 19 deselected in 4.10s`였다.
- authoritative 최종: `49 passed in 108.20s`.
- 정식 `FAILURE_REPORT`: 0. 동일 fingerprint 연속 3회: 없음. 각 구현 오류 fingerprint 반복 횟수는 1회다.

## 검증 결과

- `python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py`
  - fresh exit 0, `49 passed in 108.20s`; 추가 import flag 없음.
- `python -B -m pytest -q -p no:cacheprovider tests/repository_intelligence tests/tooling/test_a13_repository_scan.py`
  - fresh exit 0, `85 passed in 133.73s`.
- `python -B -m pytest -q -p no:cacheprovider tests/orchestration/test_takeover_c13.py`
  - fresh exit 0, `5 passed in 0.74s`.
- `python -B -m compileall -q packages/paths packages/execution_backends packages/tool_gateway tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py`: exit 0.
- `git diff --check`: exit 0.
- `python -B scripts/check_project_progress.py --c09-r4-mode=ACTIVE_R4`: exit 0, `PASS sequence=814 reporting=AUTO_CONTINUE`.
- manifest 대비 product exact18 count/hash 일치, outside product diff 0, staged 0, latest pytest owned workspace/store/worktree residue 0.

## 미실행·잔여 경계

- actual Docker daemon/CLI, WSL, DB/API/UI/browser, Provider/Telegram, SSH/network/deploy/Secret은 `NOT_EXECUTED`/`NOT_ACCESSED`다.
- Docker 증거는 stateful injected fake의 concrete argv/inspect/state/handle control contract evidence이며 actual runtime PASS가 아니다.
- local Git 증거는 pytest 소유 temp fixture에서 수행한 integration evidence이며 운영/WSL repository 성공 주장이 아니다.
- 실제 Windows 8.3 short path는 현재 fixture 경로에서 기능 가용 evidence를 만들지 않았으며 actual 8.3 PASS로 주장하지 않는다.
- 독립 Reviewer blocking0 및 final EvidenceManifest/checker acceptance는 Main 후속 control 단계가 소유한다. C-10은 `NOT_READY`, DIR-2는 `NOT_REACHED`다.

## 변경·rollback·handoff

- R4 manifest의 product exact18만 변경했다. control/progress/HANDOFF/checker/work order/manifest/history/ignored progress 수정과 stage/commit/push는 0이다.
- rollback은 Main이 독립 승인 후 product commit을 만든 경우 정상 `git revert`로 수행한다. 외부 자원과 DB rollback은 없다.
- inline artifact `PRESERVE`는 workspace destroy 뒤에도 owner-bound handle로 검증 가능하며 `DELETE` authority만 bytes/reference를 제거한다.
