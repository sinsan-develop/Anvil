# A-01 Workbench 중심 Screen Map

> `E-SHOT_STATIC`: 아래 구조와 동봉 SVG는 정적 screen-map render이며 runtime UI 증거가 아니다.

Workbench shell 안에서 Conversation, Phase Rail, Context/Decision drawer가 유지되고 필요한 panel만 progressive disclosure로 연다. 14단계를 14개 독립 화면으로 강제하지 않는다.

| Screen ID | 화면/패널 | Source artifact | 책임 | 진입 조건 | 이탈 조건 |
|---|---|---|---|---|---|
| SCREEN-WORKBENCH | Workbench Conversation | Intent | 읽기/입력 | Intent 시작 | 후보 보존 |
| SCREEN-PROPOSAL | Proposal Compare | ProposalSet | 읽기/결정 | Intent 존재 | 대안 표시 |
| SCREEN-DECISION | Decision Board | DecisionRequest | 사람 결정 | 대안 준비 | 결정 기록 |
| SCREEN-DESIGN | Design Baseline | DesignDocument | 읽기/승인 | Concept 선택 | hash 결박 |
| SCREEN-PLAN | Plan Workspace | WorkPlan | 읽기/제어 | 기준선 활성 | 계획 검토 가능 |
| SCREEN-APPROVAL | Approval Drawer | WorkInstruction | 사람 승인 | subject hash 고정 | 승인/거부/보완 |
| SCREEN-EXECUTION | Execution Control | StepAttempt | 제어/중단/재개 | 승인 WI와 lease | 구조화 결과 |
| SCREEN-COMPLETION | Completion | CompletionReport | 읽기/검토 | 결과 수집 | 미완료 분리 |
| SCREEN-TEST | Test & Evidence | TestReport | 기술 판정 | 완료 검토 고정 | 기술 판정 기록 |
| SCREEN-VALIDATION | Validation | ProductValidation | 사용자 기능 판정 | criterion/evidence | criterion 결과 |
| SCREEN-DEFECT | Defect Board | DefectAssessment | 분류 결정 | validation 존재 | blocking 명시 |
| SCREEN-RELEASE | Release Decision | ReleaseDecision | 사람 결정 | defect 고정 | 결과 기록 |
| SCREEN-LEARNING | Learning Studio/Journey | LearningCandidate | 검토/승인/rollback | 결정 결과 존재 | 활성/거부 기록 |

설명은 `i` 아이콘의 tooltip/popover로 제공하고 상시 설명 박스를 두지 않는다. 1920×1080, 본문 12px, 작은 설명 10px, 보조 9px, 사이드바 14px, 제목 16px는 후속 A-02 입력이다.

<!-- catalog-ref: SCREEN-WORKBENCH SCREEN-PROPOSAL SCREEN-DECISION SCREEN-DESIGN SCREEN-PLAN SCREEN-APPROVAL SCREEN-EXECUTION SCREEN-COMPLETION SCREEN-TEST SCREEN-VALIDATION SCREEN-DEFECT SCREEN-RELEASE SCREEN-LEARNING AV-UI-005 AV-FLOW-001 RUNTIME_DEFERRED / NOT_EXECUTED -->
