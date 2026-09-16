# D-02 완료보고

## 1. 판정

- 결과 계약: `COMPLETED` — Developer 구현·기본 검증 완료 주장, Main 독립 검토/ACCEPTED와 구분한다.
- 담당 `developer-primary-d02-r1`, 검증 ID `AV-LRN-002`, `AV-LRN-003`.
- focused **51 passed**, 관련 `knowledge + api` **424 passed**, 각각 exit 0.
- compileall exit 0, tracked diff-check exit 0. 신규 exact6의 no-index 검사에서 whitespace 진단 0건.
- 실제 HTTP/DB/파일 persistence/Provider/browser/network/WSL/Docker/deployment 미실행. D-03 미착수.

## 2. 판단 이유

### 기준선·역할·권한

- 작업 경로: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작·종료 branch: `codex/c09-execution-backends-r1`.
- 시작·종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`.
- canonical seq946: D-01 ACCEPTED 뒤 D-02 exact6 worker/write ACTIVE. 07:44:10 KST에 직접 확인했다.
- worker `worker-lease-d02-r1-20260916-001`, execution fence `d02-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write `write-lease-d02-r1-20260916-001`, write fence `d02-r1-write-fence-epoch-1-234458b5283abafa`.
- 양 lease 발효/만료: `2026-09-16T07:36:00+09:00` / `2026-09-16T19:36:00+09:00`.
- 시작 Git 상태는 기존 C-13~C-15/D-01 및 Main control dirty/untracked 보존 상태였다. `packages/knowledge/__init__.py`는 D-01 기존 untracked 산출물이며 export를 추가했을 뿐 기존 내용을 삭제하지 않았다. D-02 나머지 5개는 신규 파일이다.
- 원본 `D:\tmp\anvil-main-integration`과 Main 소유 progress/HANDOFF/events/checker/WI/prompt에 쓰지 않았다. require_escalated·승인 UI·Git mutation 없음.

기준 문서:

| 문서 | SHA256 / 직접 읽은 구간 |
|---|---|
| D-02_WORK_INSTRUCTION.md | `2350678782E65B3AFC7EBF6DFBED54634C297CDE2D60BA29451BFF6A212A3775`, 전체 |
| D-02_INVOCATION_PROMPT.md | `8DE0A961652CDB23C89569988E63BCB434003BF61EC25B60CD2BCB029CD0D4F3`, 전체 |
| Anvil_설계서_v2.md | active baseline `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`; 이번 36.4~36.4.1·47.12 재확인, 48~49 운영·학습 우선순위는 D-01 때 읽은 동일 기준선 |
| Anvil_작업계획서_v1.md | D-02: 같은 Session의 새 Task/Run마다 immutable snapshot, 진행 중 snapshot 불변, revoked source 신규 snapshot 차단 |
| Anvil_통합검증매트릭스_v1.md | AV-LRN-002/003 직접 매핑, D-02 소유 및 다음 Task/Run부터 적용 경계 |
| AGENTS·governance·developer definition·테스트계획 | 같은 세션에 읽은 역할·exact scope·TDD·독립 검토·조용한 학습 금지 경계 유지 |

### 구현과 검증 대응

| 계약 | 구현·증거 |
|---|---|
| Session snapshot | session ID, scope, SOUL/USER/MEMORY/PROJECT_INSTRUCTION/SKILL_CATALOG refs의 ID/version/hash, source_hashes, catalog hash, UTC created_at, canonical content hash |
| Task/Run snapshot | session snapshot hash, task/run/revision ID, source entry/version/hash·activation ID/actor/activated_at, current instruction versions, catalog hash, blocked-source evidence, revision authorization lineage |
| 모든 새 Task/Run 별도 생성 | ID와 source cutoff를 canonical payload/hash에 결박. 같은 session Task A/B, 같은 Task의 Run B/C가 서로 다른 snapshot을 받음 |
| next-run-only | publish 이후 기존 JSON snapshot을 수정하지 않음. pending→activation은 다음 create에서만 반영. 정확한 activation 시각부터 포함하고 이전 create는 future reason으로 제외 |
| 선택 거부 | PENDING/INACTIVE/REVOKED/QUARANTINED, source REVOKED/QUARANTINED, activation 없음/미래를 `blocked_sources`에 reason+source ID/version/hash로 기록. 더 높은 pending version이 있으면 과거 ACTIVE를 되살리지 않고 SUPERSEDED reason 유지 |
| resume | 기존 raw snapshot만 조회, live catalog를 읽지 않음. 동일 task/run/hash는 byte-equivalent projection, wrong hash/owner/scope는 거부. API는 resume에 catalog/sources 주입을 허용하지 않음 |
| 새 Task revision | 같은 task 새 revision은 host authorize_revision 원장의 exact session/task/from/to/scope·actor·half-open validity를 검사. 승인 없는 revision과 과거 revision 재생성 거부. 승인 이후 같은 revision의 다음 Run에도 authorization lineage 유지 |
| 시간과 원장 | catalog 시각 regression/동시각 다른 publication 거부. Session/catalog보다 이른 create, 같은 Task의 backdated Run 거부. revision grant는 issued <= now < expires |
| immutable·결정성 | internal canonical JSON strings + frozen DTO/deep mapping/tuple 재구성. 입력 순서·mutable input·object.__setattr__·JSON 응답 mutation이 내부 hash/기존 내용에 영향을 주지 않음 |
| fail-closed schema | source kind/scope/status/hash/version/aware time 검증. source/base identity+version의 다른 hash 재결박과 duplicate identity 거부. D-01 scanner를 읽기 전용 재사용하여 credential-shaped 문자열 거부, 값 비노출 reason만 반환 |
| 직렬화·replay | repository+scope 단위 request ID 원장 및 RLock. 동일 요청 동시 8개는 canonical 1개/REPLAY 7개; 서로 다른 request ID로 같은 Run 생성도 canonical 1개/EXISTS 7개. 실패 요청은 ID를 소비하지 않음. 새 API adapter로 replay 초기화 불가 |
| API trust boundary | create/get-session, create/get/resume-task-run만 제공. scope는 host 생성 때 고정. publish/activation actor/revision grant를 payload로 제공하는 경로 없음 |

## 3. 조치·검증 증거

### 변경 경로 — exact6

| 경로 | 변경 전 → 후 |
|---|---|
| packages/knowledge/__init__.py | 기존 D-01 exports 유지 → snapshot 4개 타입/저장소 export 추가 |
| packages/knowledge/snapshots.py | 없음 → typed immutable snapshot·host publication/revision authorization·source cutoff·replay repository |
| packages/api/learning_snapshots.py | 없음 → strict scope-bound in-process request/response adapter |
| tests/knowledge/test_snapshots_d02.py | 없음 → core 불변성·source·cutoff·revision·scope·시간·동시성 적대 검증 |
| tests/api/test_learning_snapshots_d02.py | 없음 → 정상 조회/resume·payload 권한/metadata 주입·scope/replay·값 비노출 검증 |
| docs/04_test_reports/D-02_COMPLETION_REPORT.md | 없음 → 본 보고 |

최종 SHA256:

- knowledge/__init__.py: `30D5C3F7825730752B978C084C3632ADAF830778265D4363F0B8656FB00463A5`
- snapshots.py: `42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F`
- learning_snapshots.py: `DAACA8097D6213A5F1E616EDEC7188D585DD54D3A0DFE93C80151264C9ACB6C5`
- test_snapshots_d02.py: `4093CC2901A1DDC82305E6C429828A252B27B66D8248FA9F939CF181EA2F8315`
- test_learning_snapshots_d02.py: `741CC51AC1B2CA389988B1A6F6183771F4F6A9019A2DF2EB62E81081A6198848`

D-01 memory.py 최종 hash는 `D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7`로 D-01 R2 accepted 결과와 동일하다. D-01 구현과 기존 테스트를 수정하지 않았다.

### 정확한 명령·exit·결과

모든 명령은 위 격리 작업 경로에서 기존 Python 3.13.9 venv 실행 파일을 사용했다. 설치·환경 변경 없음.

| 단계 | 명령 | exit / 실제 결과 |
|---|---|---|
| 최초 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_snapshots_d02.py::test_session_and_task_bind_sources_versions_hashes --tb=short` | 1 / 1 failed, D02_SNAPSHOT_CONTRACT_NOT_IMPLEMENTED, 0.12s |
| 기본 GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_snapshots_d02.py tests/api/test_learning_snapshots_d02.py --tb=short` | 0 / 41 passed, 1.02s |
| 보강 RED | 위 두 focused 파일 `--tb=short` 명령 | 1 / 3 failed, 48 passed, 1.06s |
| 보강 GREEN | 위 두 focused 파일 `--tb=short` 명령 | 0 / 51 passed, 0.92s |
| 최종 focused | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_snapshots_d02.py tests/api/test_learning_snapshots_d02.py --disable-warnings -ra` | 0 / 51 passed, 0.98s |
| 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 424 passed, 6.68s |
| 컴파일 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| tracked diff | `git diff --check` | 0 / 출력 없음 |
| 신규 내용 whitespace | `git diff --no-index --check -- NUL <각 D-02 exact6 경로>` | 각 1 / NUL 대비 신규 내용 차이 exit, whitespace 진단 0건. tracked diff-check exit 0과 구분 |

compileall 생성 bytecode는 검증 부산물이며 source 변경이 아니다. 일반 테스트는 `-B`, `no:cacheprovider`로 실행했다. 동시성 테스트는 동일 프로세스의 ThreadPoolExecutor만 사용했고 외부 서버·DB·네트워크·프로세스를 시작하지 않았다.

### 오류 fingerprint·횟수

- `D02_SNAPSHOT_CONTRACT_NOT_IMPLEMENTED`: 의도된 첫 stub RED 1개.
- `D02_BASE_HASH_REBIND`: 기존 base identity/version의 다른 hash를 재등록할 수 있었음 → base hash 원장 검증 추가.
- `D02_REVISION_LINEAGE_LOSS`: 새 revision 뒤 다음 Run에서 authorization이 빠졌음 → Task current revision의 원장 참조 보존.
- `D02_BACKDATED_RUN`: 같은 Task의 후속 Run 시각을 뒤로 만들 수 있었음 → current Task 생성 시각 기준 monotonic guard.
- 보강 RED 3개는 각각 한 번 재현 후 GREEN. 유효 FAILURE_REPORT 0, 정식 실패 3회 인수 조건 아님.
- 최종 focused/related 실패·skip 0. Git status의 사용자 전역 ignore 접근 경고는 기존 관측 환경 경고이며 제품 오류와 구분한다.
- 기존 C-01 snapshot 실패 1/DB skip 8은 해당 verification suite 미실행이므로 해소 또는 재검증 성공으로 주장하지 않는다.

### 미검증·잔여 위험

- HTTP 인증·실제 인간 승인 workflow·DB transaction·파일 persistence·crash 복구·분산 원장: **NOT_EXECUTED / NOT_IMPLEMENTED IN D-02**. API는 in-process adapter이며 authenticated host만 생성해야 한다.
- host-only `publish`/`authorize_revision` 호출 권한을 비신뢰 transport/agent에 노출하면 안 된다. 이 seam은 전달된 activation/source 상태와 metadata를 검증할 뿐 실제 승인 actor를 인증하거나 원격 source artifact 내용을 재계산하지 않는다.
- source content hash는 host-verified artifact의 lowercase SHA256 reference다. Session SOUL/USER/MEMORY source의 actual 텍스트를 읽거나 실행 context에 dispatch하지 않는다. reference projection의 고정/선택을 검증한 결과이며 실제 LLM runtime 주입 검증이 아니다.
- Source revocation 영향 전파/삭제 원장/긴급 safety Hook revision/approval activation workflow는 D-03/D-06 등 후속 범위다. 현재 publication에 제공된 source status를 판단하며, 과거 Run snapshot은 감사 이력으로 보존한다.
- catalog는 host가 제공한 current publication이며 snapshot 생성 시각에 유효한 source/activation을 판정한다. 이미 만든 snapshot은 live 변경을 반영하지 않는다. replay·직렬화는 repository 인스턴스 수명 안에서 보장하며 process 재시작/분산 node 간 보장은 아니다.
- D-01의 finite secret scan은 재사용했지만 모든 비밀/PII/난독화 검출을 보장하지 않는다. host 검증·curation 경계 유지.

### rollback·Main 인계

- Main이 후보 exact6과 현재 hash를 보존한 뒤 신규 D-02 5개 파일을 제외하고 knowledge/__init__.py의 D-02 export 추가만 되돌리면 D-01 상태로 복구할 수 있다. D-01 exports·memory.py·기존 dirty를 reset/clean/광역 삭제하지 않는다.
- 실제 rollback·Git stage/commit/push·원본 worktree로 복사는 하지 않았다.
- progress/HANDOFF/events/checker/WI/prompt는 **Main 소유·미갱신**. 결과 검토와 통제 projection 갱신은 Main에게 인계한다.
- D-02가 독립 ACCEPTED되기 전 D-03이나 이후 작업을 시작하지 않는다.
