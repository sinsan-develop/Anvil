export type PolicyEditorProfile='CANDIDATE'|'PROJECT_MATERIAL'|'PROJECT_PREPARATION'|'PROJECT_RESULTS'|'PROJECT_LIMITS'|'PROJECT_SOURCE_DECLARATIONS'|'PROJECT_SOURCE_OBSERVATIONS'|'PROJECT_BASELINES'|'PROJECT_HOST_TRUST';
export const policyEditorOperations={
 CANDIDATE:[['registerConnection','도구 후보 저장'],['saveEnvironment','환경 후보 저장']],
 PROJECT_MATERIAL:[
  ['exportProject','선택 문서 원본 1개 반출'],['uploadArtifact','원문 파일 보관'],['saveDocumentDraft','문서 초안 저장'],['recordContentReview','내용 검토 기록'],['confirmDocument','문서 확정'],
  ['proposeDocumentChange','문서 수정 제안'],['importDocument','문서 가져오기'],['detachDocumentSource','문서 소스 연결 해제'],['indexDesignDocument','설계 항목 연결'],['saveWorkPlanDraft','작업계획 초안 저장'],
  ['confirmWorkPlan','작업계획 확정'],['proposeDesignChange','설계 변경 요청'],['reviewChangeImpact','변경 영향 검토'],['activateDesignChange','설계 변경 별도 적용'],['linkTrace','추적 연결'],
  ['saveKnowledge','헌법·지식 초안 저장'],['appendConversation','대화 원문 보관'],['correctKnowledge','지식 정정'],['excludeKnowledge','지식 제외'],
  ['confirmKnowledge','헌법·지식 확정'],['applyConstitution','헌법 별도 적용'],['requestApproval','일회 승인 요청'],['decideApproval','일회 승인 결정'],
  ['copyMethodology','방법론 복사'],['saveMethodologyDraft','방법론 초안 저장'],['confirmMethodology','방법론 확정'],['applyMethodology','방법론 별도 적용'],['markNotificationRead','알림 읽음 표시']
 ],
 PROJECT_PREPARATION:[
  ['prepareAssignment','임무 초안 저장'],['reviewAssignmentContent','임무 내용 검토'],['confirmAssignment','임무 별도 확정'],['buildTaskContext','임무 맥락 구성'],
  ['defineProjectRole','프로젝트 책임 역할 정의'],['bindResponsibleSession','책임 세션 예약'],['prepareExecution','실행 준비 기록'],['reviewUnderstanding','임무 이해 검토']
 ],
 PROJECT_LIMITS:[['applyLimitPolicy','한도 정책 작성·개정'],['revokeLimitPolicy','한도 정책 회수']],
 PROJECT_SOURCE_DECLARATIONS:[['saveSourceRoot','위치 선언 등록'],['reviseSourceRoot','위치 선언 개정'],['revokeSourceRoot','위치 선언 철회']],
 PROJECT_SOURCE_OBSERVATIONS:[['requestSourceReadObservation','읽기 관측 허가 요청'],['revokeSourceReadObservation','읽기 관측 허가 회수']],
 PROJECT_BASELINES:[['saveBaselineDraft','시작 기준선 초안 저장'],['reviewBaselineContent','시작 기준선 내용 검토'],['confirmBaseline','시작 기준선 별도 확정']],
 PROJECT_HOST_TRUST:[['registerConnector','신뢰 등록 요청'],['confirmConnectorRegistration','신뢰 지문 승인·거절'],['revokeConnector','신뢰 등록 회수']],
 PROJECT_RESULTS:[
  ['submitResult','결과 제출 등록'],['saveResultCriteria','결과 검수 기준 저장'],['evaluateResult','결과 검토 기록'],['requestRework','보완 요청 기록']
 ]
} as const;
