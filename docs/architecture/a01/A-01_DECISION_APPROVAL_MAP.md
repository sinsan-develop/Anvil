# A-01 Decision·Approval Map

| Decision ID | 단계 | Actor | 승인/결정 대상 | Hash | 허용 결과 | 거부·보완 결과 |
|---|---|---|---|---|---|---|
| DEC-CONCEPT | STEP-03 | human-owner | ProposalSet | 필수 | SELECT/HOLD/REJECT/REVISE | 종료 또는 STEP-02 |
| DEC-WI-APPROVAL | STEP-06 | human-owner 또는 standing-approved-main | WorkInstruction | 필수 | APPROVE/REJECT/REVISE | 실행 닫힘 또는 STEP-05 |
| DEC-PRODUCT-VALIDATION | STEP-10 | human-owner | ProductValidation | 필수 | PASS/FAIL/INCOMPLETE | STEP-11 defect 분류 |
| DEC-RELEASE | STEP-12 | human-owner | ReleaseDecision | 필수 | RELEASE/REWORK/DEFER/REJECT | 종료 또는 STEP-04 새 revision |
| DEC-ACTIVATION | STEP-14 | human-owner | SkillOrHookCandidate | 필수 | ACTIVATE/REJECT/ROLLBACK | 비활성 보존 또는 STEP-13 |

신산님 승인이 필요한 변화는 `FUNCTION_SCOPE_CHANGE`, `REQUIREMENT_CHANGE`, `CRITICAL_RISK_CHANGE`뿐이다. 승인된 범위 안의 Package 분해, WorkInstruction 발행, Subagent 배정, 독립 검증, 비의미 revision, 재작업, commit/push는 Main Agent가 진행한다. 사람은 언제든 pause, steer, cancel, 직접 작업 또는 Agent 교체를 지시할 수 있다.

승인은 actor와 subject artifact hash에 결박한다. REWORK는 영향 artifact의 새 hash와 영향 분석을 요구하며 이전 승인을 암묵적으로 재사용하지 않는다.

<!-- catalog-ref: DEC-CONCEPT DEC-WI-APPROVAL DEC-PRODUCT-VALIDATION DEC-RELEASE DEC-ACTIVATION STEP-03 STEP-06 STEP-10 STEP-12 STEP-14 AV-UI-005 AV-FLOW-001 RUNTIME_DEFERRED / NOT_EXECUTED -->
