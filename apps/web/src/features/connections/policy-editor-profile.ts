export type PolicyEditorProfile='CANDIDATE'|'PROJECT_MATERIAL';
export const policyEditorOperations={
 CANDIDATE:[['registerConnection','도구 후보 저장'],['saveEnvironment','환경 후보 저장']],
 PROJECT_MATERIAL:[
  ['uploadArtifact','원문 파일 보관'],['saveDocumentDraft','문서 초안 저장'],['recordContentReview','내용 검토 기록'],['confirmDocument','문서 확정'],
  ['proposeDocumentChange','문서 수정 제안'],['importDocument','문서 가져오기'],['indexDesignDocument','설계 항목 연결'],['saveWorkPlanDraft','작업계획 초안 저장'],
  ['confirmWorkPlan','작업계획 확정'],['proposeDesignChange','설계 변경 요청'],['reviewChangeImpact','변경 영향 검토'],['linkTrace','추적 연결'],
  ['saveKnowledge','헌법·지식 초안 저장'],['appendConversation','대화 원문 보관'],['correctKnowledge','지식 정정'],['excludeKnowledge','지식 제외'],
  ['confirmKnowledge','헌법·지식 확정'],['applyConstitution','헌법 별도 적용'],['requestApproval','일회 승인 요청'],['decideApproval','일회 승인 결정'],
  ['copyMethodology','방법론 복사'],['saveMethodologyDraft','방법론 초안 저장'],['confirmMethodology','방법론 확정'],['applyMethodology','방법론 별도 적용']
 ]
} as const;
