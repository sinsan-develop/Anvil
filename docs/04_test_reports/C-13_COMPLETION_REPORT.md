# C-13 R2 완료 보고서 — 3차 재작업 최종 ACCEPT

## 판정

`COMPLETED` — fixture/in-memory orchestration 및 실제 public in-memory service 검증 범위.

## 판단 이유

- service는 caller가 직접 구성한 `SealedTakeoverEvidence`를 받지 않고 seal 완료된 exact `TakeoverEvidenceRegistry`만 받는다. trusted host adapter가 봉인한 snapshot을 내부에서 획득·검증하므로 public raw snapshot 우회는 생성자에서 fail-closed된다.
- replay 안전조건에 lifecycle `STOPPED`, worker lease 없음, active write 0, tool 0을 모두 포함한다. 성공 뒤 lease/tool terminal fence가 유지되어 public worker/write/tool 재발급 자체가 거부되며 동일 요청만 안전한 duplicate로 처리한다.
- lease와 tool transaction lock을 takeover commit 동안 함께 유지한다. revoke→4축 postcondition→양쪽 terminal mark→packet/audit publication이 같은 중첩 lock 경계에서 끝나므로 final empty check 뒤 늦은 tool grant가 빠져나갈 수 없다.
- `failure_reports`는 exact built-in tuple만 허용한다. list/list subclass/`None`은 tuple로 정상화해 승인하지 않고 structured rejection하며 packet에는 exact tuple만 저장된다.
- takeover 호출과 독립된 `TakeoverEvidenceRegistry`가 현재 WorkInstruction, diff, test output, checkpoint의 exact reference를 보존하며, 호출자가 같은 takeover 호출에서 제시한 stale self-signed evidence는 승인되지 않는다. 기존 WorkInstruction 인수는 호환용 추가 제약일 뿐이고 생략해도 trusted registry가 단독 authoritative source로 동작한다.
- canonical failure ledger의 정확히 세 실패보고와 trusted reference를 ID, checksum, session, delegation, lineage, kind, NFC, binding hash로 검증하고 packet/audit/hash에 불변 결박한다.
- `TakeoverReferenceBundle`은 failure report 입력을 exact tuple로 defensive snapshot하며, `None`, 잘못된 kind/type, `str` subclass, NFD identifier, checksum/hash 오류를 예외 없이 structured rejection으로 처리한다. 승인 뒤 원본 list를 변경해도 packet/audit/hash는 변하지 않는다.
- lifecycle → lease → tool 전환은 세 public snapshot/restore API로 preflight 및 compensation한다. 각 단계의 injected exception과 silent no-op에서 lifecycle/lease/tool 사전상태가 완전히 복원되고 packet/audit는 0개다.
- 성공 후 실제 lifecycle은 `STOPPED`, active worker/write/tool은 0개이고 packet/audit는 정확히 1개다. 처리 중 예외는 tool→lease→lifecycle 순서로 tombstone을 포함한 exact prestate를 복원하고 packet/audit를 남기지 않는다.
- count<3 no-op, 정확히 count=3, stale fence/lineage, 안전한 replay idempotency, 동시 호출 1 packet/active write 0, `actor=MAIN_AGENT`, `trigger=THIRD_VALID_FAILURE` 계약 및 C-12 연결 회귀를 유지했다.

## 조치

- `TakeoverEvidenceAuthority`, monotonic `sequence`, seal/freeze 및 `SealedTakeoverEvidence.verify()`를 추가하고 service 의존성을 seal 완료 registry로 제한했다. direct snapshot admission은 명시적으로 거부한다.
- `LeaseService.active_worker()`, takeover transaction guard와 terminal tombstone을 추가하고 replay/최종 postcondition에 worker 존재 여부를 포함했다.
- `ToolPermissionRegistry`에 takeover transaction guard와 terminal tombstone을 추가해 grant/reserve를 terminal commit과 직렬화했다.
- actual tool callback 경합과 guard 없는 fake 경합의 rollback 테스트, list/list subclass rejection 테스트를 추가했다.
- `takeover.py`에 immutable reference bundle, 독립 trusted evidence registry, strict validation, 안전 postcondition 및 보상 트랜잭션 coordinator를 구현했다.
- lifecycle, lease, tool registry에 각 서비스 자신의 private state를 캡슐화하는 public takeover snapshot/restore API를 추가했다. takeover coordinator는 private state를 직접 조작하지 않는다.
- actual public service와 C-12 fake 모두 같은 snapshot/stop/revoke/restore 및 성공 postcondition 계약을 검증하도록 테스트를 확장했다.
- 1·2·3차 독립검토 결함을 각각 먼저 RED로 재현하고 GREEN 및 전체 회귀를 완료했다. 최종 독립검토는 `ACCEPT`, blocking `0`이다.

## 기준 HEAD · branch · status

- 기준/현재 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`
- branch: `codex/c09-execution-backends-r1`
- 시작 control: canonical sequence `901`, `IN_PROGRESS`, actor `developer-primary-c13-r1`, pending approvals `0`; 제품 변경 전 재결박된 `C13StartControlTests` 4건 PASS.
- worker lease: `worker-lease-c13-r1-20260916-001`
- execution fence: `c13-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write lease: `write-lease-c13-r1-20260916-001`
- write fence: `c13-r1-write-fence-epoch-1-234458b5283abafa`
- Main 소유 protected dirty/untracked exact9는 수정·stage·복구하지 않았다: `docs/progress/BUILD_HANDOFF.md`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/work_orders/C-13_INVOCATION_PROMPT.md`, `docs/work_orders/C-13_WORK_INSTRUCTION.md`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/evidence/manifests/C-13_START_MANIFEST.json`, `docs/progress/progress-handoff-detached-digest-c13-start.json`.
- Git stage/commit/push는 수행하지 않았다.

## 기준 문서 hash

- 설계서: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 통합검증매트릭스: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획서: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 운영 거버넌스: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- C-13 WorkInstruction: `50BB663273657CFF0058C394E9FC4CD1E6748C94585054583ADEE52BD4545FFC`
- C-13 invocation prompt: `DA6CD10C97637AACEB6F8B9E07DA2BF7730455A5277EC3430E7F1877D9441379`

## 변경 diff

- `packages/orchestration/takeover.py`: reference/registry, strict fail-closed validation, replay postcondition, atomic coordinator, packet/audit/hash binding.
- `packages/orchestration/developer_lifecycle.py`: lifecycle 및 runner public snapshot/restore.
- `packages/leases/service.py`: worker/write lease public snapshot/restore.
- `packages/tool_gateway/registry.py`: grant/generation/reservation public snapshot/restore.
- `packages/orchestration/__init__.py`: C-13 public reference/registry export.
- `tests/orchestration/test_takeover_c13.py`: 독립검토 5개 결함의 RED/GREEN, actual public service postcondition.
- `tests/orchestration/test_failure_ledger_c12.py`: C-12 canonical candidate와 새 trusted/atomic C-13 fake 계약 연결.
- `tests/leases/test_worker_write_fencing.py`: exact worker/write snapshot/revoke/restore.
- `tests/tool_gateway/test_tool_registry.py`: grant 및 pending reservation snapshot/revoke/restore.
- `docs/04_test_reports/C-13_COMPLETION_REPORT.md`: 본 완료 증거.
- 최종 scoped diff 통계: `10 files changed, 2187 insertions(+), 84 deletions(-)`.

## TDD RED 증거

3차 독립검토 최소 RED 명령:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration/test_takeover_c13.py -q -k "direct_self_signed_snapshot or deterministic_late_grant or concurrent_late_grant"
```

- exit `1`: `3 failed, 44 deselected`.
- caller 구성 raw snapshot이 service admission을 통과했고, final empty check 직후 늦은 tool grant도 packet/audit와 함께 승인됐으며, concurrent grant 경로는 newer tool state 때문에 rollback까지 실패하는 상태를 관찰했다.
- registry-only admission과 lease/tool terminal transaction 적용 후 같은 명령은 exit `0`, `3 passed, 44 deselected`로 GREEN 전환했다.

2차 독립검토 최소 RED 명령:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration/test_takeover_c13.py -q -k "registry_overwrite or resurrected_worker_without or cross_service_regrant or rejects_mutable"
```

- exit `1`: `4 failed, 37 deselected in 0.56s`.
- exact list bundle 승인, service 생성 뒤 registry overwrite로 forged bundle 승인, worker-only resurrection replay의 `DUPLICATE_TAKEOVER`, tool revoke callback의 worker/write 재발급 뒤 packet 1개 승인 상태를 각각 관찰했다.
- 구현 후 authority/sequence/seal, actual/fake 경합 및 list subclass까지 확장한 focused 회귀가 모두 PASS했다.

1차 독립검토 최소 결함 재현 명령:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration/test_takeover_c13.py -q -k "self_sign or none_failure or defensively or exact_nfc or step_failure or resurrected or stops_releases"
```

- exit `1`: `13 failed, 25 deselected in 0.90s`.
- stale arbitrary diff/test 승인, `failure_reports=None`의 `TypeError`, 외부 list mutation에 따른 packet 변경, NFD/`str` subclass 승인, 세 mutation 단계의 exception 전파 및 silent no-op 승인, resurrected capability replay duplicate 승인, 성공 lifecycle `STOP_REQUESTED` 잔류를 각각 관찰했다.

Public service snapshot RED:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/leases/test_worker_write_fencing.py::test_takeover_snapshot_revoke_and_restore_preserves_exact_worker_and_writes tests/tool_gateway/test_tool_registry.py::test_takeover_snapshot_revoke_and_restore_preserves_grant_and_pending_reservation -q
```

- 최초 exit `1`: public snapshot API 부재로 `2 failed`.
- 구현 후 exit `0`: `2 passed in 0.07s`.

위 13개 defect subset은 구현 후 같은 명령에서 exit `0`, `13 passed, 25 deselected in 0.47s`로 GREEN 전환했다. C-12 연결은 새 trusted registry가 없는 기존 fake에서 먼저 `1 failed, 17 passed`를 관찰한 뒤 public transaction fake로 갱신하여 18 PASS로 전환했다.

## 정확한 검증 명령 · exit · 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration/test_takeover_c13.py -q` | 0 | `47 passed in 1.10s` |
| `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration/test_failure_ledger_c12.py -q` | 0 | `18 passed in 0.60s` |
| `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/orchestration -q` | 0 | `561 passed in 2.36s` |
| `$env:PYTHONDONTWRITEBYTECODE='1'; .\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/leases tests/tool_gateway -q` | 0 | `29 passed, 1 skipped in 0.16s` |
| 독립검토자가 같은 범위의 마지막 3개, C-13, C-12, orchestration+leases+tool gateway를 재실행 | 0 | `ACCEPT`, blocking `0`; `3`, `47`, `18`, `590 passed, 1 skipped` |
| OS temp의 신규 exact 경로를 검증·생성하고 `$env:PYTHONPYCACHEPREFIX`로 지정한 뒤 `.\.venv\Scripts\python.exe -m compileall -q packages tests`; 생성 파일 수 확인 후 해당 temp만 `Remove-Item -LiteralPath ... -Recurse -Force` | 0 | `compile_exit=0 files=356 exists_after=False` |
| `git diff --check -- packages/orchestration/takeover.py packages/orchestration/__init__.py packages/orchestration/developer_lifecycle.py packages/leases/service.py packages/tool_gateway/registry.py tests/orchestration/test_takeover_c13.py tests/orchestration/test_failure_ledger_c12.py tests/leases/test_worker_write_fencing.py tests/tool_gateway/test_tool_registry.py docs/04_test_reports/C-13_COMPLETION_REPORT.md` | 0 | 출력 없음 |

Global checker는 제품 dirty 이전 canonical sequence 901에서 PASS했다. 현재 제품 diff가 있는 상태의 `C13_START_GIT_INVALID`는 예상 exact-scope gate 상태이며 제품 기능 실패로 승격하지 않는다.

## 오류 횟수

- 동일 근본 원인의 정식 `FAILURE_REPORT`: 0회.
- 의도한 TDD RED는 오류 횟수에서 제외한다.
- 3차 독립검토 재작업에서 Subagent 구현 도구 안전분류 오탐 2회 후 Main takeover로 전환했다. 이는 정식 제품 실패 횟수에 포함하지 않는다.
- 전체 C-13 R2 구현/검증 중 worker 오류: 5회, 모두 서로 다른 국소 원인이며 수정 후 재검증했다.
  1. C-12 tuple property 호출 오용 1회.
  2. 최초 compileall용 `D:\tmp` cache ACL 거부 1회.
  3. lease snapshot 복원에서 존재하지 않는 `scope` 속성 사용 1회; `conflict_scope_key`로 수정.
  4. C-12 fake 검증에서 `audit_events` 대신 실제 public `audits`를 사용해야 했던 오용 1회.
  5. 독립검토 재작업 전체 compileall용 `D:\tmp` cache ACL 거부 1회; OS temp의 검증된 exact 하위 경로로 재실행해 PASS.

## 미검증

- 실제 DB/API/browser/provider/network/Secret/WSL/Docker/deployment는 금지 범위라 실행하지 않았다.
- PostgreSQL 18 의존 테스트 1건은 환경변수 미설정으로 SKIP이며 실행 PASS로 표시하지 않는다.
- public snapshot/restore와 coordinator의 in-memory 원자성을 검증했지만 다중 프로세스 persistence transaction은 이번 범위가 증명하지 않는다.
- 전체 저장소 pytest는 실행하지 않았다. 요구된 전체 orchestration과 관련 lease/tool 전체를 실행했다.
- 기존 `__pycache__`는 보호 대상으로 삭제하지 않았다. 이번 compileall은 repo 밖 격리 temp만 생성·삭제하여 새 bytecode residue를 남기지 않았다.

## 위험

- coordinator는 자신의 lock과 lease/tool transaction lock을 packet/audit publish까지 유지해 worker/write/tool mutation window를 닫는다. lifecycle의 순수 조회는 별도 service lock이라 중간 `STOPPED` 상태를 순간 관찰할 수 있지만, 최종 4축 postcondition 및 terminal mark 이전에는 packet/audit를 발행하지 않고 위반 시 snapshot rollback한다.
- trusted evidence registry와 coordinator는 현재 프로세스 내부 `RLock` 경계다. 향후 영속 저장소로 교체될 때 expectation publication과 takeover commit의 storage transaction 계약을 동일하게 유지해야 한다.
- reference는 artifact 식별자와 sha256을 결박하므로 상위 artifact 저장소가 해당 checksum 원문을 불변 조회할 수 있어야 완전한 감사 재현이 가능하다.
- 호환 인수 `expected_work_instruction_*`는 authoritative source가 아니며, supplied 시 trusted bundle에 대한 추가 assertion으로만 작동한다.
- global checker는 제품 dirty 동안 의도적으로 실패하므로 Main 검토·통합 전 새 start manifest를 합격 근거로 사용할 수 없다.

## rollback

- Git mutation을 하지 않았으므로 Main이 승인된 10개 경로의 본 worker diff만 폐기하면 된다.
- protected exact9는 Main 소유이며 rollback 대상에 포함하지 않는다.
- rollback 시 독립 trusted evidence, malformed structured rejection, lifecycle/lease/tool compensation, unsafe replay 방지가 함께 사라지므로 product와 연동 테스트를 한 경계로 되돌려야 한다.

## token · lease 준수

- execution/write token과 lease ID가 canonical sequence 901의 활성 값과 일치함을 확인했다. Subagent 반환 뒤 기존 `HUMAN_OVERRIDE_TAKEOVER` 승인 범위에서 Main이 단일 writer로 인수했다.
- Subagent가 제품 write를 중지하고 lease를 반환한 뒤 Main이 B1/B2와 검증·보고를 완료했으며 동시 writer는 없었다.
- 변경은 승인된 정확한 10개 경로에만 있으며 protected exact9와 기타 파일을 수정·stage·복구하지 않았다.
- takeover coordinator는 lifecycle/lease/tool의 public snapshot/restore 및 query API만 사용하며 private state 접근을 확장하지 않았다.
- 외부 실행·DB/API/browser/provider/network/Secret/WSL/Docker/deployment, 추가 권한 요청/escalation, Git stage/commit/push를 수행하지 않았다.
