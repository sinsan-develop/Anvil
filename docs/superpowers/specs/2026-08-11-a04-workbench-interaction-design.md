# A-04 Session Workbench 정적 상호작용 설계

## 목적

A-04는 Session Workbench, Conversation Request, Context Drawer, Phase Rail, Control Mode, Human Intervention, Stop/Resume 화면의 정적 field/state/edge 계약을 확정한다. 실제 브라우저·API·DB·실행 runtime은 구현하지 않는다.

## 판정 경계

- package verdict: `STATIC_CONTRACT_PASS`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- `AV-UI-004`: A-04 정적 interaction contract, A-14/A Gate 실제 판정
- `AV-UI-005`: A-01 accepted journey/rail의 정적 소비·회귀, A Gate 통합 판정

## predecessor

- A-01: Idea→ReleaseDecision→Learn journey, macro rail, normal/reject/revise/stop/resume edge와 STEP-03/06/10/12/14 human points
- A-02: 1920×1080, typography/layout/semantic color, i-tooltip/popover, on-demand 360px drawer
- A-03: Project/branch/baseline/environment, dirty/untracked, policy/protected path, permission/unknown/conflict 상태

선행 artifact의 ID·의미·hash를 재정의하지 않고 참조한다.

## canonical surfaces

1. `WORKBENCH_SESSION_SHELL`
   - top context: project, branch, baseline, environment
   - panes: Conversation, Current Work, Evidence·Decision
   - controls: stop, revision request, plan approve, apply approve, discard
2. `CONVERSATION_REQUEST`
   - objective, acceptance_criteria, included_scope, excluded_scope, protected_scope, assumptions, questions
   - confirm/edit/reject/hold/view evidence, request reanalysis, confirm requirements
3. `CONTEXT_DRAWER`
   - impact, source/evidence/hash, decision history, reason, next action
   - on-demand only; keyboard/focus/Escape/focus-return
4. `PHASE_RAIL`
   - Idea, Design, Plan, Execute, Verify, Validate, Release, Learn
   - A-01 14-step mapping과 CURRENT/COMPLETED/WAITING/BLOCKED/STOPPED/RESUMING/REWORK
5. `CONTROL_MODE_CARD`
   - control level, execution strategy, failure policy를 분리
6. `HUMAN_INTERVENTION_MAP`
   - STEP-03/06/10/12/14, subject/hash/actor/capability/decisions/reason/evidence/status/next action
7. `STOP_RESUME_PANEL`
   - interrupted point, checkpoint/hash, side-effect reconciliation, changed conditions
   - safe resume/hold/restart/discard

## 핵심 guard

- requirements confirm: objective 존재, acceptance criterion 1개 이상, unanswered mandatory question 0, assumptions 전부 user-confirmed
- agent guess는 confirmed fact가 아니며 결과·위험을 바꾸면 질문으로 전환
- high-risk ambiguity/migration/auth/secret/payment/prod deploy/deletion/shared schema/direction change/unverified input은 `CONTROLLED + STOP`
- approval/lease 없이 Execute 자동 진입 금지
- resume은 same hash/checkpoint/completed steps restored/no duplicate execution/side-effect reconciliation이 모두 필요
- WAITING/BLOCKED/INTERRUPTED/SKIPPED를 completed/success로 표시 금지
- error는 draft/input을 보존하고 reason+next_action을 제공

## 역할·권한

- Project view와 control/mode/approval/apply 권한을 분리한다.
- view-only는 mutation control disabled + reason/next action이다.
- safe stop, resume, discard, apply, approve는 서로 다른 action/capability다.
- secret, raw internal endpoint, localhost, unauthorized full path, shell/CLI를 기본 UI에 노출하지 않는다.

## required artifacts

- `docs/architecture/a04/A-04_WORKBENCH_CATALOG.json`
- `A-04_SESSION_WORKBENCH.md`, `A-04_CONVERSATION_CONTEXT.md`, `A-04_PHASE_RAIL_CONTROL.md`
- `A-04_WORKBENCH_STATIC_RENDER.svg`, `A-04_CONTROL_STATIC_RENDER.svg`
- checker/test/fixtures, validation, evidence manifest, completion report

## hostile verification

검증기는 AV·runtime owner·qualifier, predecessor hashes, top context, requirement guards, rail/edges/human points, mode/strategy/failure-policy separation, high-risk stop, resume guards, permission separation, A-02 tokens/drawer, A-03 dirty/untracked/unknown/conflict, static qualifier, manifest raw/target/self-reference를 fail-closed stable reason code로 검증한다.

## 금지

`apps/**`, `packages/**`, dependencies, API/DB/runtime/browser/Playwright, 권위 문서, A-01~03 accepted evidence, 기존 Event 소급 수정, Developer commit/push를 금지한다.
