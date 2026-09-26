# F-18 R30 OIDC Principal Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. Check each `- [ ]` step.

**Goal:** 검증된 OIDC 신원과 서버측 신뢰 권한 매핑을 교차 확인해 기존 `SessionPrincipal`을 생성하는 내부 fail-closed 계약을 만든다.

**Architecture:** `OidcCodeFlow.complete()`가 만든 `OidcIdentity`를 입력으로 받되 신원 자체의 검증을 이 모듈이 대신했다고 주장하지 않는다. 서버측 resolver가 issuer+subject에 결박한 binding을 반환하고, 명시적 환경 policy의 역할·권한·프로젝트·환경 상한과 대조한다. 미등록·불일치·범위 초과·step-up 미충족은 redacted 오류로 거부한다. 영속 store와 API route는 별도 Stage다.

**Tech Stack:** Python 3.12, dataclass/Protocol, pytest, 기존 Anvil `OidcIdentity`와 `SessionPrincipal`.

**Spec:** `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md` 단계3, `docs/WORK_STATUS.md` R30 범위 확정.

## Global Constraints

- 동일 `codex/f18-wsl-ops` branch의 단일 writer, 제품 exact3는 `packages/api/oidc_principal.py`, `tests/api/test_oidc_principal.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. Main은 통제 파일만 별도 소유한다.
- `LocalTestSessionService`를 OIDC 증거로 쓰지 않는다. ID token의 role/project/scope claim으로 권한을 부여하지 않고 resolver가 반환한 신원 결박만 신뢰한다.
- 새 공개 API·DB schema·migration·Secret·issuer network/egress·브라우저 route·Compose를 추가하지 않는다. 기존 OIDC 검증·API 계약을 변경하지 않는다.
- 로컬 단위 테스트는 WSL 실제 issuer/API/브라우저 또는 F-18 합격 증거가 아니다. Production은 `NOT_EXECUTED`다.

## Review Focus

- 존재하지 않는 subject, resolver 오류 또는 잘못된 반환 타입은 신원·credential 원문 없는 단일 오류로 거부하는가.
- identity/binding/policy의 issuer·subject 불일치, 공백·와일드카드 값은 거부하는가.
- binding의 role·permissions·project_ids·environment_ids가 policy 상한 밖이거나 비어 있으면 거부하는가.
- `step_up_required=True` binding에 `step_up_verified=False` identity는 거부하는가.
- 성공 principal의 권한은 오직 서버측 binding의 policy 이내 값이며 전달된 CSRF token이 정확히 보존되는가.

## Task 1: OIDC 신원·권한 결박

**Files:** Create `packages/api/oidc_principal.py`; create `tests/api/test_oidc_principal.py`; append `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:**

- `OidcPrincipalBinding(issuer, subject, actor_id, actor_role, permissions, project_ids, environment_ids, step_up_required)`는 immutable dataclass다. `permissions`, `project_ids`, `environment_ids`는 `frozenset[str]`다.
- `OidcPrincipalPolicy(issuer, allowed_roles, allowed_permissions, allowed_project_ids, allowed_environment_ids)`는 immutable dataclass이고 각 allowlist는 `frozenset[str]`다.
- `OidcPrincipalResolver.resolve(issuer: str, subject: str) -> OidcPrincipalBinding | None`는 서버측 조회 port다.
- `bind_oidc_principal(identity: OidcIdentity, *, resolver: OidcPrincipalResolver, policy: OidcPrincipalPolicy, csrf_token: str) -> SessionPrincipal`. 모든 오류는 `OidcPrincipalRejected('OIDC_PRINCIPAL_NOT_AUTHORIZED')`로 redacted/fail-closed 처리한다.

- [ ] **Step 1: RED 테스트 작성.** 정상 issuer+subject·policy 내부 binding이 정확한 `SessionPrincipal`을 만드는 테스트와 Review Focus의 5개 거부 유형을 각각 분리 작성한다. 검증된 신원이라는 전제와 이 adapter가 token을 재검증하지 않는다는 한계를 테스트/보고서에 명시한다. 기대 결과는 production helper로 만들지 않는다.
- [ ] **Step 2: RED 관측.** `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/api/test_oidc_principal.py`의 새 모듈/함수 부재로 인한 실패를 기록한다. 실제 오류가 환경/import 오타라면 수정 후 의도한 RED를 다시 확인한다.
- [ ] **Step 3: 최소 구현.** exact 서명대로 순수 adapter를 작성한다. identity/binding/policy의 필수 문자열·집합 타입·비어 있지 않음·와일드카드 부재, identity/binding/policy issuer와 subject의 exact 일치, binding scope의 policy 부분집합, step-up boolean 충족을 확인한다. resolver 예외도 같은 redacted 거부로 감싼다. `SessionPrincipal` 외 side effect는 없다.
- [ ] **Step 4: GREEN·회귀.** 신규 테스트, `tests/api/test_oidc_code_flow.py tests/api/test_oidc_identity.py tests/api/test_oidc_issuer_transport.py tests/api/test_local_session.py tests/api/test_runtime_app.py`, `git diff --check`를 실행한다. 전체 `pytest`도 한 번 시도하고 기존 collection 오류를 신규 실패와 구분한다. 해당 환경에서 typecheck/lint가 구성돼 있으면 실행하고 결과를 기록한다.
- [ ] **Step 5: 제품 증거·commit.** 시작 HEAD/branch/status, 기준 hash, exact3 diff, RED/GREEN 및 회귀 명령·exit·실제 결과, 미검증 WSL/실제 issuer/API/browser/Production, rollback을 보고서에 누적한다. exact3만 commit한다. Main이 독립 검토·push·G-05 후 후속 Stage를 판단한다.

## Rollback

R30 exact3 제품 commit만 정상 revert한다. 기존 OIDC flow/verifier/transport, runtime, DB와 WSL 공유 자원은 변경하지 않는다.
