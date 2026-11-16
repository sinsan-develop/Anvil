# UI06 저장 전 로컬 산출물 선택 보존 작업지시서

## 기준·허용 범위

WORK_PLAN UI06/FN03의 단계 산출물 선택→빈 초안/작성틀 준비·표시 중 기존 계약 내부를 완결한다. PMO는 원래 표시 목표의 재승인을 요구하지 않았고, 새 stageOutputItem/save/GET/audit/0099 계약은 별도 직접 채택 경계라고 확인했다. 그 후보5039D14A는 미채택으로 유지한다. 기준 main0c9ab78a(PR152의 미채택 후보 보존), 현재 codex/av3-ui06-local-selection. CLI 관측 질문은 아직 답변 전이며 실제 조회0이다.

기존 developer_primary가 단일 제품 writer다. Main은 관리·검수·통합·현황을 맡고 다른 작성자의 변경을 되돌리지 않는다. 기존 RAM44b42a는 선택itemId 소실을 재현했으며 저장 귀속 기능의 합격이 아니다. 이번은 로컬 선택 의미를 복구하는 부분 구현이며 버전별 서버 귀속이나 전체 UI06 완료로 보고하지 않는다.

## 정확 변경 소유

제품(모두 apps/web/src/features/design-trace/):
1. editor-api.ts — DocumentBuffer의 선택적인 UI 전용 preparedStageOutput 타입만 추가. newDocument/editDocument의 서버 형상, PendingDocumentSave·본문 hash·명령 serializer의 기존 wire 목록은 유지한다.
2. stage-document-draft.ts — 원 적용본/노드/선택 OUTPUT/양식/주체·client·제어세대 검산 뒤 선택 컨텍스트를 복사해 초안에 보존한다.
3. form-document-outline.ts — 2차 양식·같은 세대를 확인한 작성틀에도 같은 로컬 선택을 보존한다. 양식 section.itemId는 원 의미 그대로다.
4. NewStageDocumentForm.tsx — 원 API client/노출된 전송 포트, 주체/project/scope/선택·요청 ticket에 load/prepare 결과 채택을 결박한다. props/선택의 ABA·늦은 응답·401 뒤 이전 준비를 되살리지 않는다. 범용 새 상태관리나 다른 화면 변경은 하지 않는다.
5. DocumentEditor.tsx — 일치하는 새 미저장 초안(documentId=null/baseVersion=0)에서만 '저장 전 선택한 산출물 … · 서버 귀속 미확인'으로 표시한다. 서버의 고정 귀속·권한·완료 증거가 아니다.

시험: tests/unit/UI06/stage-document-draft.test.ts, form-document-outline.test.ts, editor-api.test.ts 및 새 tests/unit/UI06/prepared-stage-output-ui.test.ts. 결과: docs/04_test_reports/AV3/UI06_LOCAL_STAGE_OUTPUT_SELECTION_RESULT_20261116.md. 다른 제품/시험 경로가 꼭 필요하면 정확한 이유를 Main에게 먼저 반환한다. Main 현황/Git을 수정하지 않는다.

## 동작·회귀 경계

- 로컬 컨텍스트는 선택 당시 project/사용자/client/제어세대·적용 fullref·node/item·form fullref를 보존한다. 같은 문맥의 제목·본문·양식 섹션 편집은 보존하며, 다른 stage/form/주체/project·API client·외부 buffer로 옮겨 붙이지 않는다. 가변 호출자 필드로 서버 권위를 발급하지 않는다.
- stage 변경·충돌/저장 불명·저장 성공·고정 문서/제안 반영 등 준비 의미가 끝나면 해당 로컬 표식만 폐기한다. 단순 숨김 뒤 A→B→A나 입력 변경으로 부활시키지 않는다. 기존 stageNodeRef/savedRef/pending/본문·업로드·승인·검토·확정 기록은 삭제하지 않는다.
- 준비 중 props 변경·닫힘·인증 소실/late 응답은 기존 작성 중 문서에 이전 item을 붙이지 않는다. 항목 소실을 숨기기 위해 일반 문서/단계 저장을 막거나, 저장 성공을 항목 귀속 성공으로 바꾸지 않는다.
- save/upload/승인 요청의 JSON과 closed-key 검사·현재 명령/기한·hash/영수증·CAS·UNKNOWN 처리에는 preparedStageOutput을 보내지 않는다. 새 stageOutputItem/응답 필드·auditreason/SQL·DB 적용·새 공개 계약·권한 변경은 0이다.

## 최소 검수

같은 노드·같은 양식 A/B 중 B를 선택해 빈 초안과 작성틀 준비·표시, 제목/본문 편집 뒤 B 보존, 양식 section A 불변을 실제 제품 함수/RAM component로 관측한다. 선택/주체/project/단계·양식·client 변경·늦은 준비·ABA·409/503/저장성공·고정 문서 읽기 후 marker0과 원 입력/실패 상태 보존을 확인한다. 기존 pending/upload/save exact-key·본문 hash·영수증 불변을 검증한다. RAM component는 실제 browser/served 사용자 인수로 표시하지 않는다.

변경 직접·인접 시험, root 타입, 필요한 메모리 web build/공백을 선택한다. 서버/desktop/기존 spool 전수를 반복하지 않는다. 새 설치·도구 도입·실제 서비스/DB/키/권한/SDK·CLI·Agent/C# 실행·사용자 파일 조사·추가 SSH/SDK 조회는 제외한다. 결과에 정확 source 지문·명령/exit·오류/보완·미검증·rollback을 기록하고 제품 동결/쓰기 반환한다. 독립 C/I 검수 뒤 Main이 commit/push·PR/Broker·병합본 집중 smoke·정리를 수행한다.
