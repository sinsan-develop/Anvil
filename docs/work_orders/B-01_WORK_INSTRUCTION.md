# B-01 WorkInstruction — Framework-independent domain state core

- artifact_id: `WI-B-01-20260813-001`
- package/status: `B-01 / READY`
- executor: `developer-primary-b01`
- baseline_git_commit: `11b79b98f9a7c042f897f090a75d3f912e436d60`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_a_gate_manifest_sha256: `F192F7257A678E728C163094A05E858B3970EBE17F50415DA6F6C892D2AD052C`
- assigned: `AV-STAT-001`, `AV-STAT-002`, `AV-STAT-003`
- environment: `ENV-LOCAL`

## 목적과 완료 조건

`packages/domain`에 framework-independent ID, enum, immutable Event, Run state와 pure Reducer core를 구현한다. 설계서 §27.1의 정상 전이 11건은 조건과 산출물 계약을 충족할 때만 허용하고, §27.2 및 정의되지 않은 전이는 fail-closed 한다. 정상·금지 전이를 table-driven test로 검증하고 각 정상 전이의 필수 산출물 종류가 보존됨을 증명한다.

## 구현 계약

- Python 표준 라이브러리만 사용한다. apps, 다른 package, FastAPI, Pydantic, SQLAlchemy, Alembic, psycopg, provider/Docker SDK를 import하지 않는다.
- ID는 종류가 구분되고 비어 있거나 공백뿐인 값을 거부한다.
- phase/status/Event type은 문자열 자유 입력 대신 enum으로 고정한다.
- Event는 immutable이며 event id, aggregate id, sequence, type, occurred_at, actor와 payload를 보존한다.
- Reducer는 입력 state를 변경하지 않는 pure function이어야 한다. sequence 역행·중복, 정의되지 않은 전이, 조건/필수 artifact 누락은 명시적 domain error로 거부한다.
- `USER_VALIDATION → APPLY_PENDING`은 동일 target hash의 ProductValidation 완료, blocking defect 0, 인증된 사람의 RELEASE 결정이 모두 있어야 한다. 위험 하향이나 승인 대체를 임의 구현하지 않는다.
- DB/Event Store/API/checkpointer/LangGraph adapter는 B-01 범위 밖이다. 실제 API·DB·provider·WSL·production·deploy를 실행하지 않는다.

## Developer exact file-level write allowlist

- `packages/domain/__init__.py`
- `packages/domain/identifiers.py`
- `packages/domain/states.py`
- `packages/domain/events.py`
- `packages/domain/reducer.py`
- `tests/domain/test_identifiers.py`
- `tests/domain/test_state_transitions.py`
- `tests/domain/test_reducer.py`
- `docs/validation/B-01_DOMAIN_CORE_VALIDATION.md`
- `docs/evidence/manifests/B-01_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-01_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, WorkInstruction, 다른 package/app, dependencies/config, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. allowlist, baseline, execution/write fencing token과 authority hash를 먼저 검증한다.
2. ID invalid input, 정상 11전이, 금지/unknown 전이, sequence duplicate·역행, 조건·artifact 누락, reducer immutability를 테스트로 먼저 작성하고 intended RED를 기록한다.
3. 최소 구현 후 focused domain tests, dependency boundary checker, 기존 tooling 전체를 실행한다.
4. EvidenceManifest는 exact 11 paths, raw checksum, target hash, self-reference false를 고정한다.
5. CompletionReport에 변경 파일·diff·명령/exit code·미실행 범위·잔여 위험·rollback을 기록한다.
6. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-01 acceptance, B-02 시작, API/DB/runtime 검증은 이 WorkInstruction 범위가 아니다.
