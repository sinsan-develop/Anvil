# A-01 전체 사용자 Journey

> 판정 범위: `AV-UI-005 / STATIC_ONLY`  
> Runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`  
> `AV-FLOW-001` 책임: `A-05`, `B-03`, `A Gate`

이 문서는 아이디어에서 ReleaseDecision과 학습 활성화까지 사용자가 보는 정적 여정을 확정한다. 실제 클릭, API, DB, Event 영속화, 브라우저 Network는 구현하거나 실행하지 않았다.

## Canonical 단계

| ID | 단계 | 목적 | 입력 | 결과 | 다음 안전 행동 |
|---|---|---|---|---|---|
| STEP-01 | Idea Capture | 원문과 Intent 후보 분리 | user utterance | intent candidate | 가정 명확화 |
| STEP-02 | Clarify & Alternatives | 대안·가정·미결정 비교 | intent candidate | proposal set | 사람 결정 요청 |
| STEP-03 | Concept Decision | 선택·보류·거부·보완 | proposal set | concept decision | 선택 시 기준선, 거부 시 종료 |
| STEP-04 | Design Baseline | 설계 hash 고정 | concept decision | design baseline | 계획 작성 |
| STEP-05 | Work Planning | 실행 단위 분해 | design baseline | work plan | WI 승인 요청 |
| STEP-06 | WorkInstruction Approval | 범위·금지·검증 승인 | work plan | approved WI | 승인 뒤만 실행 |
| STEP-07 | Execution | Step·Subagent·checkpoint 제어 | approved WI | structured result | 완료 검토 |
| STEP-08 | Completion Review | delivered와 incomplete 분리 | structured result | completion review | 기술 검증 |
| STEP-09 | Technical Test | 실행 범위의 기술 판정 | completion review | test result | 제품 검증 요청 |
| STEP-10 | Product Validation | criterion별 사용자 기능 판정 | test result | product validation | defect 분류 |
| STEP-11 | Defect Assessment | blocking 분류 | product validation | defect assessment | ReleaseDecision 요청 |
| STEP-12 | Release Decision | RELEASE/REWORK/DEFER/REJECT | defect assessment | release decision | 결정 결과 학습 |
| STEP-13 | Learning Review | 성공·실패·교정 후보 검토 | release decision | learning candidate | 활성 평가 |
| STEP-14 | Skill·Hook Activation | 평가·승인·rollback 계보 | learning candidate | activation decision | 감사 계보 보존 |

## 다섯 end-to-end 경로

- `PATH-NORMAL`: 승인 hash와 유효 lease를 확인한 뒤 실행하고, 기술검증·ProductValidation·DefectAssessment·ReleaseDecision을 각각 거친 후 학습한다.
- `PATH-REJECT`: Concept 또는 ReleaseDecision의 `REJECT`는 종료 또는 새 Intent만 허용한다. 실행은 자동 개방되지 않는다.
- `PATH-REVISE`: 보완 대상 artifact를 새 revision/hash로 만들고 영향 분석 후 필요한 승인을 다시 받는다. 구 hash 재사용은 금지한다.
- `PATH-STOP`: 사용자 pause/cancel, quota 또는 안전 차단 시 checkpoint, 완료 단계, 중단 이유, 다음 안전 행동을 기록한다.
- `PATH-RESUME`: 동일 artifact hash와 checkpoint를 복원하고 완료 단계를 건너뛰어 중복 실행 없이 재개한다.

`NOT_EXECUTED`, `BLOCKED`, `SKIPPED`, fixture는 PASS가 아니다. `COMPLETED`, `FAILURE_REPORT`, `INCOMPLETE`, `BLOCKED`, `CANCELLED`는 서로 다른 결과다.

<!-- catalog-ref: STEP-01 STEP-02 STEP-03 STEP-04 STEP-05 STEP-06 STEP-07 STEP-08 STEP-09 STEP-10 STEP-11 STEP-12 STEP-13 STEP-14 PATH-NORMAL PATH-REJECT PATH-REVISE PATH-STOP PATH-RESUME AV-UI-005 AV-FLOW-001 RUNTIME_DEFERRED / NOT_EXECUTED -->
