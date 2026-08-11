# A-04 Phase Rail, Control, Human Intervention, Stop/Resume

- contract_surface_ids: `PHASE_RAIL`, `CONTROL_MODE_CARD`, `HUMAN_INTERVENTION_MAP`, `STOP_RESUME_PANEL`
- classification: `STATIC_ONLY`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- qualifier: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`

## A-01 Phase Rail 소비

`Idea → Design → Plan → Execute → Verify → Validate → Release → Learn`과 `STEP-01`~`STEP-14`를 A-01에서 그대로 소비한다. 정상·거부·보완·중단·재개는 `PATH-NORMAL`, `PATH-REJECT`, `PATH-REVISE`, `PATH-STOP`, `PATH-RESUME`이며 edge ID도 A-01의 `EDGE-01-02`~`EDGE-13-14`, reject/revise, `EDGE-07-STOP`, `EDGE-STOP-RESUME`를 재정의하지 않는다.

Rail 상태는 `CURRENT`, `COMPLETED`, `WAITING`, `BLOCKED`, `STOPPED`, `RESUMING`, `REWORK`다. Human point는 `STEP-03`, `STEP-06`, `STEP-10`, `STEP-12`, `STEP-14`이며 subject_artifact, subject_hash, actor, capability, allowed_decisions, reason, evidence, status, next_action을 표시한다.

## 세 개의 독립 축

- control level: `LIGHT`, `STANDARD`, `CONTROLLED`
- execution strategy: `SINGLE_WORKER`, `DELEGATED`, `PARALLEL_BATCH`
- failure policy: `STOP`, `CONTINUE_INDEPENDENT`, `COLLECT_AND_REVIEW`

세 축을 하나의 mode로 합치지 않는다. ambiguity, migration, auth, secret, payment, production deploy, deletion, shared schema, direction change, unverified input은 항상 `CONTROLLED + STOP`이다. approval과 worker lease 없이 Execute로 자동 진입하지 않으며 mutation에는 write lease도 필요하다.

## Stop/Resume

중단 화면은 interrupted_point, last_completed_step, checkpoint, checkpoint_hash, side_effect_reconciliation, changed_conditions, reason, next_action을 표시한다. 행동은 `safe_resume`, `hold`, `restart`, `discard`다.

safe_resume guard는 동일 subject hash, checkpoint 존재, completed steps 복원, changed conditions 검토, side-effect reconciliation 완료를 모두 요구한다. duplicate execution은 허용하지 않는다. A-03의 tracked dirty/untracked 분리, policy/protected path, `UNKNOWN`/`CONFLICT` fail-closed를 유지한다.

> 이 문서는 `AV-UI-004/005` 정적 소비 계약이다. A-14/A Gate runtime과 Browser/API/DB/deploy는 `NOT_EXECUTED`다.
