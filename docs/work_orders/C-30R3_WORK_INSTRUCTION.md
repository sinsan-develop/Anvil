# C-30R3 WorkInstruction — Task1 typed owner component 계약

## 판정·범위

이 지시서는 `docs/superpowers/plans/2026-09-19-c30r3-owner-component-restore.md`의
Task1 계약 고정만 수행한다. Task2 제품 adapter, Task3 runtime wiring, Task4 formal 검증은 별도 lease 대상이다.
Task1 fixture GREEN은 실제 owner 복원·재시작·PG15·브라우저·C30 인수가 아니다.

확인한 baseline HEAD는 `101a93a7b2fc37ec805274da7616f16e6a95683e`,
branch는 `codex/c09-execution-backends-r1`이다. 시작 시 dirty 0이었다.
Main control 후속 commit `cfbf83a042f40067b93a018d4e3660e290bdcef1`은 baseline 변경이 아니다.
worker/write: `worker-lease-c30r3-task1-20260919-001` / `write-lease-c30r3-task1-20260919-001`.
execution/write fences: `c30r3-task1-execution-fence-epoch-1-101a93a` /
`c30r3-task1-write-fence-epoch-1-101a93a`.
확인 window: 2026-09-19T21:30:00+09:00–2026-09-20T09:30:00+09:00, epoch1 ACTIVE.

write exact2:

1. `docs/work_orders/C-30R3_WORK_INSTRUCTION.md`
2. `tests/integration/test_c30r3_owner_component_contract.py`

제품, schema/migration, runtime, progress/HANDOFF/report, 기존 manifest 변경 금지.
stage/commit/push 및 DB/WSL/HTTP/browser/provider 실행 금지. 계획의 commit 단계는 Main 소유다.

## 공개 타입와 메서드

후속 adapter 모듈은 `packages.agent_team.owner_component_restore`다. 현재 구현된 것으로 간주하지 않는다.
두 DTO는 frozen+slots dataclass, 정확한 필드 외 입력 거부, 입력/출력과 내부 상태가 detached여야 한다.

`OwnerComponentPayload`:

- component_type: exact str, ROLE_POLICY | ROLE_RESULTS | TEAM | MOA.
- schema_version: exact str `owner-component/v1`.
- assignment_id: exact str. binding.assignment_id와 동일.
- owner_version: exact int, bool 제외, 1 이상.
- binding: 정확한 C30R2 `OwnerBinding`; wire에서는 아래 13개 필드의 exact dict.
- payload: exact dict, 정확히 constructor/state. 아래 명시적 typed codec만 사용한다.
- component_hash: `sha256:`+lowercase hex64. 다른 모든 필드의 canonical wire JSON 해시.

`OwnerComponentBundle`:

- binding: detached exact OwnerBinding.
- owner_version: current persisted version, exact int >=1.
- owner_snapshot_hash, principal_mapping_hash: 저장된 정본과 동일한 재계산 SHA256.
- component_hashes: exact tuple[str,str,str,str], ROLE_POLICY/ROLE_RESULTS/TEAM/MOA 순서.
- restored_at: exact builtin datetime, timezone.utc, caller alias와 분리. subclass/custom tzinfo 금지.
- receipt_hash: 위 metadata의 canonical JSON 해시(이 필드 및 owner 인스턴스 제외).
- policy/results/team/moa: 각각 exact RolePolicyService/RoleResultService/RoleTeamOrchestrator/MoADeliberation.

Bundle frozen은 owner 서비스의 정상 상태변화를 금지한다는 뜻이 아니다. 4종 서비스는 한 bundle 내에서
동일 policy/results/team을 참조하지만 원 서비스·다른 restore 결과와 mutable state를 공유하지 않는다.
generic dict/proxy, 원래 객체 반환, 타입 이름에 따른 임의 import/getattr/pickle 복원 금지.
receipt_hash는 복원 당시 provenance이며 서비스 변경 후 상태의 현재 해시/인증으로 사용할 수 없다.

```python
restore_owner_components(snapshot: OwnerSnapshot, principal: PrincipalMapping,
                         *, session_factory, now: datetime) -> OwnerComponentBundle
export_owner_components(bundle: OwnerComponentBundle) -> tuple[OwnerComponentPayload, ...]
```

session_factory는 서버 설정으로 주입된 SQLAlchemy Session context factory만 허용한다.
request가 callable을 주입할 경로는 없다. now는 owner DTO 유효기간 비교용이며 DB UTC 권위를 대체하지 않는다.
export는 serialization-only: 행 저장, current 인증, 새 세대·권한·request receipt 발급을 하지 않는다.
export 결과가 유효한 hash여도 다음 restore는 repository current authority를 반드시 다시 검사한다.
bundle constructor를 직접 호출해 서비스/해시를 넣는 행위가 host-issued restore authority가 되지 않는다.

## 직렬화·해시·닫힌 중첩 schema

모든 입력은 deepcopy/JSON/hash/DTO constructor 이전에 exact builtin type/shape/bound를 검사한다.
wire는 None/bool/int/str/list/dict만 허용한다. float, NaN/Infinity, bytes, tuple/set, custom Mapping,
scalar/container subclass, callable, datetime 객체, magic hook은 wire에서 거부한다.
datetime은 exact UTC ISO8601 문자열로, enum은 owner가 선언한 exact value로, tuple/set은 정렬된 list로
변환한다. Decimal은 기존 owner의 canonical decimal 문자열을 사용하며 숫자 float 변환은 금지한다.
dict key는 exact str. JSON 중복 key 금지. sort_keys=True, separators=(',', ':'), ensure_ascii=False,
allow_nan=False, UTF-8. 해시 입력에서 제외되는 것은 가장 바깥 component_hash 하나뿐이다.
중첩 content_hash/assignment_hash/seal은 제외하지 않고 원래 owner 규칙으로 각각 재검산한다.

상한: depth24, ID/fence128 UTF-8 bytes, list/map1024 entries(기존 owner 상한이 더 작으면 그 상한),
개별 문자열262144 bytes, component canonical bytes262144, 전체 OwnerSnapshot1048576.
4개 component는 정확히 한 번씩 존재해야 한다. duplicate ID/field/record 또는 unknown schema 거부.
빈 state fixture는 wire shape 예제일 뿐 restore 가능 상태가 아니다. mandatory assignment, seals,
Team plan, MoA identity가 빠지면 `COMPONENT_STATE_INCOMPLETE`로 거부한다.

binding 필드: project_id, environment_id, session_id, assignment_id, generation, actor_id, context_id,
workspace_id, baseline_hash, target_hash, assignment_hash, execution_fence, write_fence.
위 13개 필드는 C30R2 OwnerBinding 필드와 exact 일치한다.
모든 component binding == snapshot.binding == principal.binding. principal actor/auth generation,
permission(tasks:read), mapping hash와 유효기간은 C30R2 repository owner 규칙으로 추가 확인한다.

payload.constructor의 닫힌 필드:

- ROLE_POLICY: session_id, baseline_hash, target_hash, implementation_actor, implementation_context,
  implementation_workspace, implementation_context_hash, parent_permission, parent_egress, parent_budget.
- ROLE_RESULTS: policy_component_hash.
- TEAM: session, policy_component_hash, results_component_hash, parent_task_id, target_hash, deadline.
- MOA: team_component_hash, quorum, deadline, identity.

component 연결 hash는 앞선 component와 exact 일치한다. MoA identity는 현재 Team session/target/plan_hash를
결박한다. 모든 task binding assignment는 policy registry의 exact assignment/definition/packet/hash/fence와
동일해야 한다. selected assignment가 맞아도 foreign nested assignment, result/evidence context/target,
team session/target/baseline 또는 MoA identity가 다르면 거부한다.

payload.state의 닫힌 root 필드는 아래 machine contract에 고정한다. map은 JSON에서
`[{"key": ..., "value": ...}]` sorted unique key entries로 표현해 tuple-key의 손실/충돌을 막는다.
set은 sorted unique list, audit/events는 순서 보존 list다. key/value wrapper의 추가 필드는 거부한다.
복합 key는 정확한 owner tuple 길이의 list이며 component/field별 typed codec에서 검사한다.

- ROLE_POLICY: assignments→RoleAssignment, assignment_seals→hash, definitions→[version,hash],
  revoked→assignment ID 집합, spent→BudgetLimits, requests→[request_hash,RoleDecision], audits→RoleDecision.
  write/code leases→TestWriteLease/CodeWriteLease, 해당 seals→hash, revoked→lease ID 집합.
- ROLE_RESULTS: captures→RoleEvidence, seals→hash, results→owner의 복합 result key와 hash, audits→RoleResultReceipt.
- TEAM: bindings→TeamTaskBinding; tasks/boxes/events는 현 C23 owner의 task/mailbox/event schema를 그대로
  보존. spent int, cancelled bool, replay→[request_hash,TeamSnapshot], plan_hash hash, last_at UTC 문자열.
- MOA: records→[(kind,record_id),(hash,payload_json)] owner registry, proposals/critiques/syntheses→ID와
  canonical payload_json. 별도 seals/requests registry는 현 owner에 없으므로 만들지 않는다.

중첩 DTO는 기존 정확한 dataclass init 필드 allowlist와 필드 타입을 재사용한다. init=False content_hash도
wire에서 값으로 결박하지만 constructor 주입하지 않고 재계산 비교한다. DTO descriptor/class name은
untrusted wire에 받지 않는다. C23 동적 record와 C24 JSON 내부는 해당 owner가 실제 발행한 schema의
필드/타입/ID 관계를 typed codec별로 검사하며 임의 JSON 통과나 `__dict__.update`로 hydration하지 않는다.
현재 public export/restore seam은 없다. Task2는 이 닫힌 codec와 explicit adapter를 구현해야 하며,
현재 owner에 없는 공개 hydration을 이미 지원한다고 주장하지 않는다. 필요한 scope 변경은 Main이 결정한다.

## current authority, revocation, atomicity, replay

restore 순서:

1. exact DTO/모든 wire shape·bound를 callback 없이 확인하고 detached local capture.
2. outer snapshot/mapping/component 및 모든 nested seal 재계산. binding/버전/4종 연결 검사.
3. session_factory의 transaction에서 `load_current_owner(binding=..., principal=..., expected_version=...)`.
   저장된 snapshot과 입력 exact hash·canonical bytes 일치, current generation/fences/expiry/revocation 확인.
   요청 header/query/body 또는 hash만으로 principal을 만들지 않는다.
4. validated payload로 임시 실제 owner 4종을 dependency 순서로 구성. revoked/spent/replay/audits를
   보존하며 register_assignment/register_plan 재실행으로 권위를 부활시키거나 부작용을 재연하지 않는다.
5. publication 전에 별도 current repository 재검증 및 captured bytes/seals 재검산. 중간 revoke/supersede/
   fence drift/expiry/row mutation이면 bundle0. 첫 검사 성공을 권위 cache로 사용하지 않는다.
6. 모든 검증 성공 후 bundle 한 개만 반환. 부분 구성 오류 시 임시 객체 폐기, 저장소/receipt mutation0.

revoked_through_generation high-water는 단조. superseded generation, 시계 역행으로 만료된 권위,
execution_fence mismatch, write_fence mismatch를 거부한다. read-only는 current binding의 write_fence가
실제로 None일 때만 None을 허용하며 값이 있는 것을 None으로 낮추는 것은 거부한다.

메서드에는 caller request_id가 없다. 계획의 duplicate restore request는
`(snapshot.content_hash, principal.mapping_hash, owner_version, component_hashes)`의 deterministic identity를
뜻한다. 동일 identity 재호출도 repository를 재검증하고 새 detached 객체를 반환한다. durable request
row를 추가하지 않는다. 같은 current identity의 다른 bytes는 hash/binding drift로 거부한다.
복원 시각이 달라지면 receipt_hash는 달라질 수 있으므로 object/receipt byte equality를 idempotency로
주장하지 않는다. 실제 menu request/receipt replay는 기존 C30R2 repository가 계속 소유한다.

안정 오류 분류: BUILTIN_REQUIRED, INPUT_BOUND_EXCEEDED, COMPONENT_SHAPE, COMPONENT_TYPE,
COMPONENT_SCHEMA, COMPONENT_HASH_MISMATCH, COMPONENT_STATE_INCOMPLETE, OWNER_BINDING_MISMATCH,
OWNER_VERSION, OWNER_AUTHORITY_STALE, COMPONENT_CONSTRUCTION_FAILED. 기존 repository 오류는 원인 분류를
보존하되 raw payload/credential/SQL을 메시지에 넣지 않는다. 실패시 외부 IO0/partial bundle0.

## 검증·후속 경계

Task1 테스트는 문서 machine schema를 소비하는 fixture oracle이다. 실제 owner 복원 보안/DB race를
검증한 것이 아니다. Task2에는 반드시 실제 4종 owner state roundtrip, stale/revoked/fence before-construction,
nested resigned foreign assignment, cross-component mismatch, partial construction failure, detached mutation,
재시작 후 revoked/spent/replay 유지, final authority TOCTOU를 RED→GREEN으로 별도 실행한다.
Task3는 durable authenticated principal resolver/runtime wiring을 별도로 검증한다.
0015 구현은 있어도 release0013에 해당 tables는 없다. Task4 전 Main이 격리 검증 migration 대상과 release
목표 관계를 결정해야 한다. 여기서는 0013 변경/0015 적용을 하지 않으며 formal PG15/browser/restart는
NOT_EXECUTED, product restore/runtime durable 연결은 NOT_IMPLEMENTED/NOT_INTEGRATED다.
rollback은 이 exact2 신규 파일만 Main이 검토해 제거/revert하며 원본 state/history/schema는 건드리지 않는다.

## 기계 판독 계약

<!-- C30R3_CONTRACT_BEGIN -->
```json
{
  "payload_fields": ["component_type", "schema_version", "assignment_id", "owner_version", "binding", "payload", "component_hash"],
  "components": ["ROLE_POLICY", "ROLE_RESULTS", "TEAM", "MOA"],
  "state_fields": {
    "ROLE_POLICY": ["assignments", "assignment_seals", "definitions", "revoked", "spent", "requests", "audits", "write_leases", "write_seals", "write_revoked", "code_leases", "code_seals", "code_revoked"],
    "ROLE_RESULTS": ["captures", "seals", "results", "audits"],
    "TEAM": ["bindings", "tasks", "boxes", "events", "spent", "cancelled", "replay", "plan_hash", "last_at"],
    "MOA": ["records", "proposals", "critiques", "syntheses"]
  },
  "bundle_fields": ["binding", "owner_version", "owner_snapshot_hash", "principal_mapping_hash", "component_hashes", "restored_at", "receipt_hash", "policy", "results", "team", "moa"],
  "owner_types": ["RolePolicyService", "RoleResultService", "RoleTeamOrchestrator", "MoADeliberation"],
  "methods": {
    "restore_owner_components": ["snapshot", "principal", "*", "session_factory", "now"],
    "export_owner_components": ["bundle"]
  },
  "invariants": {
    "authority": "REPOSITORY_CURRENT_BEFORE_CONSTRUCTION_AND_BEFORE_PUBLICATION",
    "revocation": "MONOTONIC_HIGH_WATER_NO_REREGISTRATION",
    "fences": "EXACT_EXECUTION_AND_WRITE_OR_READONLY_NULL",
    "atomicity": "ALL_FOUR_OR_NONE_NO_EXTERNAL_IO",
    "replay": "DETERMINISTIC_IDENTITY_NO_AUTHORITY_CACHE",
    "export": "SERIALIZATION_ONLY_NOT_AUTHENTICATION",
    "release": "0013_UNCHANGED_0015_NOT_APPLIED",
    "evidence": "FIXTURE_ONLY_NOT_RESTORE_OR_FORMAL_ACCEPTANCE"
  }
}
```
<!-- C30R3_CONTRACT_END -->
