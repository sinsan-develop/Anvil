# C-30R2 WorkInstruction — Task 1 계약 고정

## 판정과 현재 범위

이 지시서는 승인된 C30R2 계획의 Task 1만 실행한다. 제품 구현 완료나 C30 formal E2E 합격이 아니다.
권위 계획: `docs/superpowers/plans/2026-09-19-c30r2-durable-owner.md`.
기존 C22–C24 owner 의미와 C29 console의 default 503 fail-closed를 보존한다.
Task 2–4 구현/DB/HTTP/browser/restart 실행 및 release 판단은 이 문서 발행만으로 허용되지 않는다.

현재 writer: developer-primary-c30r2.
확인한 dispatch HEAD: `2a962ec888e8749b9e50a4f3d76ee811fa7978f0`, branch `codex/c09-execution-backends-r1`.
통제 baseline: `c7ab95b41279dd93fd43d979489889dd8d94c2cc`, sequence 1289.
worker: `worker-lease-c30r2-20260919-001`, execution fence `c30r2-execution-fence-epoch-1-c7ab95b`.
write: `write-lease-c30r2-20260919-001`, write fence `c30r2-write-fence-epoch-1-c7ab95b`.
epoch 1; worker window 2026-09-19T18:30:00+09:00–2026-09-20T06:30:00+09:00,
write window 18:30:01–06:30:01. mutation 직전 current canonical projection을 다시 확인한다.
Main의 progress/events 수정은 별도 소유이며 변경하거나 되돌리지 않는다.

Task1 write exact3:

1. `docs/work_orders/C-30R2_WORK_INSTRUCTION.md`
2. `docs/work_orders/C-30R2_INVOCATION_PROMPT.md`
3. `tests/integration/test_c30r2_contract.py`

제품 persistence/runtime/migration/auth 파일, 기존 report, progress/HANDOFF/checker 변경 금지.
Git stage/commit/push, DB/WSL/Docker/Provider/Telegram/Kakao/Oracle/운영 실행 금지.
계획의 Task1 commit 단계는 Main 소유이며 Developer는 수행하지 않는다.

## Task2 진입 전 Main 결정 필요

계획은 신규 `0015_agent_team_owner`를 제안하지만 canonical C30 release target은
`0013_task_bootstrap_authority`다. 0013에는 이 owner schema가 없다.
0015 구현·적용으로 release0013 증거를 충족했다고 주장할 수 없다.
Task2 전 Main이 migration/release target 관계와 검증 대상을 명시적으로 결정해야 한다.
현재는 `MAIN_DECISION_REQUIRED_BEFORE_TASK2`; `upgrade head`, 0014/0015 적용,
release manifest target 변경을 하지 않는다.

기존 RolePolicyService/RoleResultService/RoleTeamOrchestrator/MoA는 프로세스 로컬 authority이며
공개 durable export/restore 계약이 없다. 아래 DTO는 앞으로의 저장 계약이지 기존 restore 지원 주장이 아니다.
opaque JSON roundtrip이나 DTO introspection은 실제 owner 복원 증거가 아니다.
Task2/3는 검증된 공개 export/restore seam 및 exact owner 타입 제약을 Main 범위 결정으로 해결해야 하며,
재등록으로 revoked/spent/replay 상태를 초기화하거나 generic DB proxy를 owner로 가장하지 않는다.

## 공통 값·해시 계약

아래 여섯 DTO는 frozen + slots dataclass이며 정확히 열거된 필드만 가진다.
입력 검사는 deepcopy/hash/JSON/decimal 또는 사용자 callback 실행 전에 exact builtin 타입·크기·shape부터 수행한다.
custom Mapping/iterable/scalar subclass, mutable tzinfo, datetime subclass와 임의 객체 복원/pickle은 금지한다.
출력과 저장 값은 caller와 detached이며 frozen 우회 변조가 canonical row를 바꾸지 않는다.

- ID/fence: exact nonempty str, 최대 128 UTF-8 bytes. 표시 문자열을 authority로 추정하지 않는다.
- generation/owner_version/auth_generation: exact int (bool 제외), 1 이상. 최초 CAS expected_version만 0 허용.
- hash: `sha256:` + lowercase hexadecimal 64자. 입력의 실제 canonical bytes에서 재계산한다.
- canonical JSON: builtin-only, 중복 key/NaN/Infinity 불허, sort_keys=True, separators=(',', ':'), ensure_ascii=False, UTF-8.
- tuple: immutable bounded tuple, nested 값도 검증. principal_mappings 최대 64개; permissions 최대 32개, sorted unique.
- timestamp: exact builtin timezone.utc datetime; UTC offset만 같은 custom tzinfo는 거부. ISO 출력은 microsecond 고정 UTC.
- nullable 필드는 write_fence와 moa만이다. load 메서드의 expected_version만 optional이다.
- outer hash는 해당 hash 필드 하나를 제외한 모든 필드의 canonical representation으로 계산한다.
  nested DTO는 필드 이름/value로, tuple은 JSON array로, timestamp는 위 ISO 규칙으로 변환한다.
- 오류에는 입력값·cookie·CSRF·secret·raw auth token·raw transcript를 포함하지 않는다.

## OwnerBinding / component / snapshot

OwnerBinding identity key는 (project_id, environment_id, session_id, assignment_id)다.
generation 외 모든 actor/context/workspace/baseline/target/assignment hash/execution fence/write fence가 current row와 exact 일치해야 한다.
같은 actor라도 session/context/target/fence가 다르면 거부하며 다른 run/session으로 묵시적 재결박하지 않는다.
write_fence=None은 읽기 전용 mapping뿐이며 mutation 권한으로 해석하지 않는다.

OwnerComponent.kind는 ROLE_POLICY / ROLE_RESULTS / TEAM / MOA 중 해당 snapshot 필드에 맞는 값이다.
schema_version은 1. canonical_json은 component당 최대 256 KiB, snapshot 합계 최대 1 MiB.
content_hash는 canonical_json UTF-8 bytes의 SHA256이다. unknown version/kind, missing 필수 component를 거부한다.
policy/results/team은 필수 OwnerComponent이고 moa는 해당 owner가 없을 때만 None.
실제 component payload의 allowed schema와 export/restore는 후속 owner 통합 검증 전까지 NOT_INTEGRATED다.

OwnerSnapshot.binding은 OwnerBinding, owner_version은 identity key에 대해 generation이 바뀌어도 단조 증가한다.
principal_mappings는 PrincipalMapping tuple이며 mapping_hash 기준 정렬/중복 금지, 동일 binding에 결박한다.
created_at < expires_at이고 DB UTC 현재 시각이 expiry 이상이면 fail-closed다.
snapshot hash는 binding/version/component hashes/mappings/timestamps 전부 결박한다.

## PrincipalMapping

principal_actor_id는 binding.actor_id와 exact 일치한다. principal_role은 서버의 authenticated session role을 그대로 소비하며
HUMAN/approval로 승격하지 않는다. permissions는 서버 session 권한의 부분집합이며 console 읽기는 `tasks:read`를 요구한다.
auth_session_hash는 원 cookie가 아닌 서버 검증 session identity hash, auth_generation은 인증 owner의 현재 generation이다.
issued_at/expires_at은 인증 session 유효창을 넓힐 수 없다. mapping_hash는 모든 mapping 필드를 결박한다.

request body/header/path의 actor/session/fence 주장으로 mapping을 생성하지 않는다.
서버가 인증한 session + 현재 persisted assignment에서 host가 만든 mapping만 받는다.
현재 SessionPrincipal에 없는 context/assignment/fence를 임의 기본값으로 채우지 않는다.
이 계약은 principal actor의 동일 assignment 조회만 정의하며 cross-actor operator delegation은 정의하지 않는다.
해시 일치 자체가 인증은 아니다. 후속 runtime은 authenticated principal/current auth_generation을 확인한 후 repository를 호출해야 한다.

## Generation / revocation / fence / restart

최초 generation=1, successor는 current+1만 host 등록으로 허용한다.
revocation은 identity key의 revoked_through_generation 단조 high-water이며 삭제/rollback/재등록으로 낮출 수 없다.
superseded/expired/revoked generation의 capture/receipt exact replay도 authority를 부활시키지 못한다.
current execution fence와 write fence(또는 읽기전용 None)를 매 소비 시 검증한다.
캐시는 authority source가 아니다. repository 재생성 후 committed row/current generation/high-water/hash만으로 조회한다.
missing component/hash drift/unknown schema면 projection 없음.
프로세스 재시작 시 실제 Role/Team/MoA 복원은 후속 통합 테스트가 통과하기 전 NOT_INTEGRATED다.

## Repository 메서드·transaction 계약

예정 module: `packages.persistence.agent_team_owner_repository`.
class: `SqlAlchemyAgentTeamOwnerRepository`.
모든 메서드는 positional `self, session` 뒤 아래 인자가 keyword-only다.
session은 caller가 관리하는 active SQLAlchemy transaction이며 repository는 commit/session factory/network를 소유하지 않는다.
성공 반환은 caller transaction 안의 결과일 뿐 commit 전 durable 성공이 아니다.
mutation의 catch 가능한 실패는 savepoint/동등 원자 경계로 해당 연산 전체를 원복한다.
current row/version/revocation/DB UTC를 같은 transaction에서 검사하고 row lock/CAS로 mixed snapshot을 차단한다.
예정 DB adapter를 in-memory/mock으로 대체해 atomic/restart PASS로 표시하지 않는다.

| 메서드 | keyword-only 인자 | 결과와 조건 |
| --- | --- | --- |
| save_owner_snapshot | snapshot: OwnerSnapshot, expected_version: int, request_id: str | OwnerSnapshot; 최초 absent는 expected_version=0, 새 version=expected+1. successor CAS exact. current exact request+payload replay만 동일 값, 다른 payload 충돌. 과거 replay로 current 교체 금지. |
| load_current_owner | binding: OwnerBinding, principal: PrincipalMapping, expected_version: int 또는 None (기본 None) | OwnerSnapshot 또는 None; 해당 identity가 없으면 None, 존재하지만 stale/revoked/권한불일치는 구조화 오류. current auth/hash/version/time 검증 뒤 detached 반환. |
| revoke_generation | binding: OwnerBinding, expected_version: int, request_id: str, reason: str | RevocationReceipt; current exact binding/version에만 CAS, version+1/high-water/audit 원자 변경. stale binding으로 새 generation revoke 금지. |
| save_receipt | binding: OwnerBinding, principal: PrincipalMapping, receipt: ProjectionReceipt, expected_version: int | ProjectionReceipt; current owner snapshot/version/hash 및 principal 재검사, (identity, request_id)와 receipt_id 유일성. 같은 요청/hash replay만 동일 값. |
| load_receipt | binding: OwnerBinding, principal: PrincipalMapping, request_id: str | ProjectionReceipt 또는 None; 없는 request만 None. 조회 때도 current authority 검사, 다른 owner/version/hash 또는 revoked 후 old receipt 거부. |

snapshot request ledger는 request_id와 canonical 요청 hash를 저장한다.
snapshot exact replay가 초기 expected_version과 달라도 current snapshot과 동일하고 authority가 현재 유효할 때만 허용한다.
receipt replay도 stale generation/version을 우회하는 fast path를 갖지 않는다.
revoke replay는 같은 revocation 결과만 반환하며 새로운 권한/추가 high-water 변경을 만들지 않는다.

ProjectionReceipt.menu는 기존 C29 MENUS와 동일한 team/moa/sns/adapters 중 하나다.
response_json은 bounded 공개 projection canonical JSON(최대 64 KiB), raw program/auth/secret/transcript 없음.
response_hash는 response_json bytes, content_hash는 나머지 receipt 필드 전체를 결박한다.
request_hash는 binding/principal mapping hash/menu/정규화된 query를 결박하며 request ID만으로 payload를 신뢰하지 않는다.
receipt.owner_snapshot_hash 및 owner_version은 실제 조회된 단일 committed/current snapshot과 exact 일치한다.
RevocationReceipt.reason은 고정 allowlisted reason(OWNER_REVOKED, ASSIGNMENT_SUPERSEDED, SESSION_REVOKED)만 허용한다.

OwnerContractError는 ValueError의 하위형이며 `.code`와 str(error)는 오류 코드만 반환한다.
허용 코드: OWNER_INPUT_INVALID, OWNER_HASH_MISMATCH, OWNER_NOT_CURRENT, OWNER_REVOKED,
OWNER_EXPIRED, STALE_FENCING_TOKEN, OWNER_VERSION_CONFLICT, PRINCIPAL_BINDING_MISMATCH,
RECEIPT_REPLAY_CONFLICT, OWNER_COMPONENT_MISSING, OWNER_RESTART_UNVERIFIED, TRANSACTION_REQUIRED.
오류를 성공 빈 projection으로 바꾸지 않는다.

## 테스트 단계와 미검증

Task1 최초 RED: WI 없는 contract_fixture 18개와 repository 없는 product_contract 12개를 실제 실패로 확인한다.
문서 작성 후 contract_fixture 18개만 GREEN이어야 한다. product_contract 12개는 실제 module 미구현 RED로 남겨 Task2 인수점으로 사용한다.
skip/xfail/fake repository로 이 RED를 숨기지 않는다. 전체 명령 exit1은 예정된 Task1 증거이며 formal FAILURE_REPORT가 아니다.

후속 Task2 필수 behavior RED: insert/load, current+1 및 역행 거부, revoke→새 repository→stale 거부,
각 session/context/target/fence 불일치, expiry DB clock, 두 connection 동일 CAS winner1, mixed snapshot0,
receipt same/different request replay, committed restart replay, alias/hash tamper, callback0, partial rollback,
unknown schema/component missing, principal request mint 거부.
이는 이번 introspection/fixture tests가 이미 검증한 행동이 아니다.
DB/HTTP/browser/actual owner restore/provider/production은 모두 NOT_EXECUTED 또는 NOT_INTEGRATED.

## Machine-readable contract (synthetic fixture only)

아래 fixture hash는 계약 checksum 테스트용이며 실제 assignment/approval/DB 증거가 아니다.

<!-- C30R2_CONTRACT_BEGIN -->
```json
{
  "schema": "c30r2_owner_contract/v1",
  "dto_fields": {
    "OwnerBinding": [
      "project_id",
      "environment_id",
      "session_id",
      "assignment_id",
      "generation",
      "actor_id",
      "context_id",
      "workspace_id",
      "baseline_hash",
      "target_hash",
      "assignment_hash",
      "execution_fence",
      "write_fence"
    ],
    "OwnerComponent": [
      "kind",
      "schema_version",
      "canonical_json",
      "content_hash"
    ],
    "PrincipalMapping": [
      "binding",
      "auth_session_hash",
      "auth_generation",
      "principal_actor_id",
      "principal_role",
      "permissions",
      "issued_at",
      "expires_at",
      "mapping_hash"
    ],
    "OwnerSnapshot": [
      "binding",
      "owner_version",
      "policy",
      "results",
      "team",
      "moa",
      "principal_mappings",
      "created_at",
      "expires_at",
      "content_hash"
    ],
    "ProjectionReceipt": [
      "receipt_id",
      "request_id",
      "request_hash",
      "binding",
      "owner_version",
      "owner_snapshot_hash",
      "principal_mapping_hash",
      "menu",
      "response_json",
      "response_hash",
      "created_at",
      "content_hash"
    ],
    "RevocationReceipt": [
      "binding",
      "revoked_through_generation",
      "owner_version",
      "revoked_at",
      "reason",
      "request_id",
      "request_hash",
      "content_hash"
    ]
  },
  "methods": {
    "save_owner_snapshot": [
      "snapshot",
      "expected_version",
      "request_id"
    ],
    "load_current_owner": [
      "binding",
      "principal",
      "expected_version"
    ],
    "revoke_generation": [
      "binding",
      "expected_version",
      "request_id",
      "reason"
    ],
    "save_receipt": [
      "binding",
      "principal",
      "receipt",
      "expected_version"
    ],
    "load_receipt": [
      "binding",
      "principal",
      "request_id"
    ]
  },
  "invariants": {
    "generation": {
      "start": 1,
      "step": 1,
      "rollback": "DENY",
      "revocation": "MONOTONIC_HIGH_WATER"
    },
    "fence": {
      "execution": "EXACT_CURRENT",
      "write": "EXACT_CURRENT_OR_READONLY_NULL",
      "clock": "DATABASE_UTC"
    },
    "restart": {
      "source": "COMMITTED_ROWS_ONLY",
      "cache_authority": false,
      "missing_component": "DENY"
    },
    "receipt": {
      "same_request": "EXACT_REPLAY",
      "different_payload": "DENY",
      "recheck_current_authority": true
    },
    "principal": {
      "source": "SERVER_AUTHENTICATED_SESSION",
      "permission": "tasks:read",
      "request_mint": false
    },
    "transaction": {
      "owner": "CALLER",
      "repository_commit": false,
      "partial_publish": false
    }
  },
  "binding_fixture": {
    "project_id": "fixture-project",
    "environment_id": "fixture-environment",
    "session_id": "fixture-session",
    "assignment_id": "fixture-assignment",
    "generation": 1,
    "actor_id": "fixture-reader",
    "context_id": "fixture-context",
    "workspace_id": "fixture-workspace",
    "baseline_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "target_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    "assignment_hash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    "execution_fence": "fixture-execution-epoch-1",
    "write_fence": null
  },
  "binding_fixture_hash": "sha256:e62012e114172f5f53d1a68bf5df8c05ad8fc204f78aaca357b854fd11abe3ff"
}
```
<!-- C30R2_CONTRACT_END -->

## 검증·rollback

명령은 canonical cwd에서 Python `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B`를 사용한다.
pytest flags: `-m pytest -q -p no:cacheprovider tests/integration/test_c30r2_contract.py --tb=short`.
fixture만은 `-k contract_fixture`, 제품 인수 RED는 `-k product_contract`.
test 소스 builtin compile 및 `git diff --check`를 별도 확인한다.
완료보고는 exact3 hash/명령/exit/수치와 미검증을 Main에 전달한다. report/progress 파일은 Task1 scope 밖이므로 작성하지 않는다.
rollback은 Main이 exact3 신규 산출물만 검토 후 제거/개정하는 방식이며 기존 제품/dirty/control은 보존한다.

## Task1 실행 증거

- 최초 RED: 위 전체 pytest 명령 exit 1, 30 failed in 0.35s. WI 미정의 18개 / repository 미구현 12개.
- 문서 정의 후 fixture 명령: 같은 명령에 `-k contract_fixture`, exit 0, 18 passed / 12 deselected in 0.04s.
- 문서 정의 후 전체 명령: exit 1, 12 failed / 18 passed in 0.31s. 실패는 모두 `C30R2_REPOSITORY_NOT_IMPLEMENTED`.
- skip/xfail 0, 제품 파일 mutation 0. 이 수치는 계약 문서/서명 fixture 검증이며 실제 DB 행동 검증이 아니다.
- Task1 상태: COMPLETED (계약 정의와 예정된 RED 인계만). Task2 이후 제품 구현 및 formal E2E는 NOT_EXECUTED.
- formal FAILURE_REPORT 0. control projection의 초기 lease 중복/불일치는 Main이 보정했으며 제품 실패로 집계하지 않는다.
