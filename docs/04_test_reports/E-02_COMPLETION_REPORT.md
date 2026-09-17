# E-02 Developer 완료보고

## 판정

- 결과 계약: `COMPLETED` (Developer 구현·기본 검증 완료; Main 독립 합격 판정 아님).
- 기준: `codex/c09-execution-backends-r1`, 시작/현재 HEAD `99861ccb18fb9555ddbfb6ef8c4c9b79fc46c449`. 시작 clean, predecessor seq1071/E-01 ACCEPTED. Git stage/commit/push 없음.
- canonical start: seq1072 WI →1073 worker lease →1074 write lease →1075 PACKAGE_STARTED. E-02 IN_PROGRESS, E-03 NOT_READY, pending approval 없음. 기존 seq1~1071 raw event prefix 보존은 start-control test/checker로 검증.
- worker `worker-lease-e02-r1-20260917-001`, execution fence `e02-r1-execution-fence-epoch-1-99861ccb18fb9555`.
- write `write-lease-e02-r1-20260917-001`, write fence `e02-r1-write-fence-epoch-1-ddbfb6ef8c4c9b79`.
- lease window `2026-09-17T09:36:00+09:00`~`2026-09-17T21:36:00+09:00`; 최종 검사 host `2026-09-17T09:55:20+09:00`에서 유효.
- 최초 구현 오류 fingerprint: test-first missing implementation 52건, fixture parent permission hash mismatch(초기 52건 공통 원인), 보강 RED 4건 및 5건. 최초 Developer 완료 시 정식 실패 0이었으며, 독립 검토 후 아래 R1 REWORK count1로 정정한다. 내부 RED/fixture 수정은 별도 정식 failure로 계산하지 않음.

## 판단 이유

### 기준 문서 SHA256

- 설계: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 계획: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 매트릭스: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- E-02 WI: `B77E357A06239673E46C8959AEBC91BF831313AECBF4AF8FA9702DD8ED5806B6`
- E-02 invocation: `102190D70C51670858D78CFADDC950159D451D376C714DA59C81655E68A36F69`

### 구현 및 diff

제품 exact6:

1. `packages/agent_team/__init__.py`: 기존 exports 보존, handoff DTO/service additive export.
2. `packages/agent_team/handoff.py`: host-only capture registry, immutable RoleHandoff/v1, D→R→T predecessor/current authority, 실제 artifact metadata/bytes checksum·size·media 검증, bounded projection 및 explicit resolve, idempotency/conflict fail-closed.
3. `packages/api/role_handoff.py`: host-bound framework-neutral create/project/resolve adapter. 권위 mint 및 실행/합격 전이 없음.
4. `tests/agent_team/test_handoff_e02.py`: domain·authority·tamper·replay·원자성·미검증 경계 적대 테스트.
5. `tests/api/test_role_handoff_e02.py`: API authority 주입 거부, raw 기본 비노출, explicit resolve, publish 후 reread 실패 회귀.
6. `docs/04_test_reports/E-02_COMPLETION_REPORT.md`: 본 보고.

start control exact9(제품 scope와 분리):

- `docs/work_orders/E-02_WORK_INSTRUCTION.md`
- `docs/work_orders/E-02_INVOCATION_PROMPT.md`
- `docs/evidence/manifests/E-02_START_MANIFEST.json`
- `docs/progress/progress-handoff-detached-digest-e02-start.json`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/BUILD_HANDOFF.md`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`

허용 dirty 집합은 위 exact15. control checker는 exact9 control 및 optional product exact6 외 변경, 역사 prefix 변경, foreign HEAD/lease/manifest를 거부한다. 제품 완료 acceptance event는 작성하지 않았다.

`packages.artifacts.evidence.EvidenceManifest`와 `RawArtifactChecksum`, ArtifactStore read/metadata, Developer lifecycle RawResultArtifact, ResultEnvelope validation, E-01 current RolePolicyService/RoleResultService를 재사용한다. Release Gate용 `packages.verification.gates.EvidenceManifest` 변경·seal 발급 없음. 필수 manifest 정보가 없는 입력은 거부하며 제품 코드에서 임의 hash를 채우지 않는다.

### 정확한 검증 명령과 결과

cwd는 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, 아래 `PY`는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`의 약기다. 모든 pytest는 로컬 fixture/in-memory 검증이다.

| 명령 | exit / 실제 결과 |
|---|---|
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E02StartControlTests --tb=short` | RED 1: 2 failed, 612 deselected (1.70s); 초기 GREEN 0: 2 passed (10.63s); 최종 0: 2 passed, 612 deselected (11.36s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py --tb=short` | 초기 RED 1: 52 failed (1.58s, 구현 없음); fixture parent binding 수정 후 첫 GREEN 52 passed; 최종 0: 61 passed (1.87s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py --tb=short -x` | 0: 첫 GREEN 52 passed (1.55s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py -k 'lifecycle_payload or recipient_packet or reread_store' --tb=short` | RED 1: 4 failed, 52 deselected (1.28s); 후속 전체 focused 0: 56 passed (1.78s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py -k 'tester_resolve or projection_text or preserves_source' --tb=short` | RED 1: 5 failed, 37 deselected (1.05s); 위 최종 focused 61 passed에서 모두 해소 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/artifacts tests/api/test_c04_delegation_lifecycle.py tests/api/test_role_handoff_e02.py --tb=short` | 0: 805 passed (5.26s); 직전 보강 전 800 passed (5.65s) |
| `PY -B scripts/check_project_progress.py` | 0: `G-05 project progress contract: PASS sequence=1075 reporting=AUTO_CONTINUE` |
| `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/handoff.py packages/api/role_handoff.py tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0: 출력 없음 |
| `git diff --check` | 0: 출력 없음 |
| `git rev-parse HEAD` | 0: 기준 HEAD 불변 |

RED 보강 해소: raw lifecycle payload의 저장 hash 뒤 변조 탐지, recipient run/step lineage 일치, API publish 후 fallible store 재조회 제거, R→T consumption에서 predecessor 및 Developer source 재검증, manifest projection 문자열 상한 및 source_status/skipped/unverified 경계 명시. 기존 schema/TeamOrchestrator/permission 계약은 관련 805 회귀에서 유지됐다.

## 조치

- Main 독립 spec/quality 검증으로 전달한다. Developer 보고 자체를 Reviewer/Tester PASS 또는 Main acceptance로 쓰지 않는다.
- NOT_EXECUTED/NOT_INTEGRATED: 실제 HTTP routing/서버, U-05 UI, Provider, DB, network, OS worker, DAG/parallel, 브라우저/배포/Release/Apply. Store 테스트는 memory adapter이며 실제 filesystem adapter 운용 검증이 아니다.
- host-only capture는 명시적 in-process trust seam이다. 운영 인증·영속 registry·멀티프로세스 동시성은 구현/검증하지 않았다. fixture의 real-mode evidence는 계약 검사용일 뿐 실제 독립 worker 실행을 증명하지 않는다.
- 기본 projection은 bounded summary/refs/구조화 상태만 제공한다. 원문은 current recipient authority 및 manifest/artifact membership 재검사 후 명시적 resolve에서만 bytes로 제공한다. fixture/mock/static/build/SKIPPED/BLOCKED를 실제 PASS로 승격하지 않는다.
- rollback: Main이 미커밋 exact15 diff를 보존한 뒤 E-02에 속한 변경만 기준 commit과 대조하여 되돌릴 수 있다. 실행된 외부 부작용/DB migration은 없다. 이 작업에서는 reset/delete/stash/commit/push를 실행하지 않았다.
- progress/HANDOFF는 승인된 start seq1075까지만 갱신했다. 완료/독립 판정/lease revoke/acceptance는 Main 소유이며 아직 미작성이다.

## R1 독립 검토 재작업 (최신 판정)

### 판정

`COMPLETED` — 요청된 재작업 구현·Developer 검증 완료. 독립 재검토/최종 acceptance는 Main 소유다. valid failure lineage `E02-ARTIFACT-TOCTOU-001`, 같은 REWORK count **1**. 추가 `E02-SOURCE-AUTHORITY-TOCTOU-002`, bounded toolchain/projection 및 predecessor causality findings를 동일 round에 포함했다. count를 별도로 증가시키지 않았다.

### 판단 이유

- 실제 RED: adapter가 받은 frozen metadata를 강제 변조하면 기존 `_read`가 바뀐 hash/size를 검증 기준으로 사용했다. capture/check/resolve 3경로 × bytes/id/media/storage/project/run/step/actor 8변형 24건과 마지막 read의 source manifest 변조 1건을 고정했다.
- `_read`는 호출 전 모든 metadata 필드의 immutable expected tuple과 hash/size를 보존하고 adapter에는 detached copy만 준다. 호출 후 원 metadata/전달 copy/반환 bytes를 각각 원 snapshot과 비교한다. resolve는 canonical source seal, published ArtifactRef, manifest row, handoff seal 및 current authority도 반환 직전에 재검사한다. canonical metadata alias는 adapter에 전달되지 않는다.
- source 권위는 `초기 E01 validation → artifact I/O → final pure source/predecessor/recipient fence → publish/return` 순서다. 마지막 fence는 store I/O, budget 소비, E01 감사 추가/결과 등록을 하지 않는다. E01에 이미 등록된 exact result/evidence/hash 및 assignment의 current record를 읽기 전용으로 대조한다. callback revoke/source/evidence 변조는 partial handoff 없이 차단한다.
- 기본 context 상한: toolchain 최대32항목, key64 UTF-8 bytes, value256 UTF-8 bytes, key+value 합4096 UTF-8 bytes. manifest는 constructor에서 승인한 exact tuple만 허용한다. 기본 projection은 canonical compact JSON UTF-8 **32768 bytes**를 넘으면 `PROJECTION_TOO_LARGE`; publish 전에 렌더링 상한을 검증하므로 실패 시 partial handoff 0. 임의 truncation은 하지 않는다.
- R→T Reviewer source/result host capture(`source.issued_at`), 독립 evidence capture, manifest 시작/종료 및 artifact 생성 시각은 D→R predecessor `issued_at` 이상이어야 한다. 이전 시각은 `PREDECESSOR_CAUSALITY_MISMATCH`. **같은 시각은 coarse host clock 해상도를 고려해 허용**하며 정상 D→R/R→T 테스트가 이 경계를 검증한다. source/result 자체의 별도 timestamp 필드를 기존 E01 schema에 임의로 추가하지 않았다.
- 마지막 predecessor artifact read에서 predecessor/handoff를 변조하는 추가 RED2건도 재현하고, project/resolve 반환 전 seal 재검사로 차단했다.

### 조치·검증

이번 round 변경은 product exact6 중 `packages/agent_team/handoff.py`, `tests/agent_team/test_handoff_e02.py`, 본 보고 3개뿐이다. control/progress/WI 및 나머지 제품은 변경하지 않았다. 원래 exact15 dirty 집합을 유지한다.

`PY`와 cwd는 위와 동일하다.

| 정확한 명령 | exit / 실제 결과 |
|---|---|
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py -k 'toctou or final_store or toolchain_context or aggregate_bound or predecessor_causality' --tb=short` | RED 1: 36 failed, 42 deselected (2.31s), 모두 기대된 미거부 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py -k store_callback --tb=short` | RED 1: 3 failed, 2 passed, 78 deselected (1.14s); revoke/source/evidence 미거부 재현, predecessor/developer는 기존 차단 유지 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py -k last_predecessor --tb=short` | RED 1: 2 failed, 83 deselected (1.43s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py --tb=short` | GREEN 0: **104 passed (3.25s)**; 직전 102 passed (2.79s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/artifacts tests/api/test_c04_delegation_lifecycle.py tests/api/test_role_handoff_e02.py --tb=short` | 0: **848 passed (8.13s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E02StartControlTests --tb=short` | 0: **2 passed, 612 deselected (3.00s)** |
| `PY -B scripts/check_project_progress.py` | 0: PASS sequence=1075 reporting=AUTO_CONTINUE |
| `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/handoff.py packages/api/role_handoff.py tests/agent_team/test_handoff_e02.py tests/api/test_role_handoff_e02.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0: 출력 없음 |
| `git diff --check` | 0: 출력 없음 |

미검증/잔여 위험 및 rollback은 최초 보고와 동일하다. 실제 외부 실행은 없고 malicious/buggy Store callback은 in-memory fault injection이다. Python 프로세스 전체를 장악한 악성 host에 대한 sandbox를 주장하지 않는다. 현재 E01 private canonical result/evidence registry의 읽기 전용 최종 fence를 사용하므로 owner 내부 구조 변경 시 관련 회귀를 재실행해야 한다. 제품 API/owner schema는 변경하지 않았다. commit/push/E-03 실행 없음.
