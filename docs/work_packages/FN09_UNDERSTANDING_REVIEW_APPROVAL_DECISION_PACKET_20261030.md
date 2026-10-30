# FN09 이해검토 원명령 일회 승인 연결 — 결정안 r1

상태 DRAFT / NOT_ADOPTED / 코드 GO0. 작성 Main 어울, 기준 제품 checkpoint83c7df1953d231c57a20aa4169914caebaf4ff04 이후 UI05 이력 조회 구현은 별도 진행 중이다. WORK_PLAN FN09/FN11/UI05/UI08의 기존 이해검토 승인 미연결을 구체화하며 실제 Agent 수행이나 이해 정확성 자동 판정을 추가하지 않는다.

## 결정·대안
- A 권장: 기존 HUMAN reviewUnderstanding의 원명령·6항목 판단 전체를 승인 후보로 보호 보관/조회하고 별도 일회 결정 후 정확 원명령만 명시 재개하는 source/UI/미적용 SQL·합성 검증을 구현한다. 아래 대상 표현과 원형 결박을 이 연산에만 채택한다.
- B: 기존 AUTO 저장·이력 조회와 REQUIRE_APPROVAL 차단을 유지한다. 이 필수 승인 연결은 미완료로 남으며 기존 AUTO를 재개발해 완료로 대신하지 않는다.
현재 UI05 A안과 이전 FN09 prepareExecution A안은 reviewUnderstanding를 포함하지 않는다. 기존 명시 제외와 새 후보/보호 조회/승인 소비·저장 의미 변경이 있어 별도 채택이 필요하다. 실제 DB·키·서비스·Agent 실행은 두 안 모두 제외한다.

## 현재 근거
- executions/execution-understanding.ts의 readRequest는 targetId=executionId, expectedVersion=양수 executionGeneration, baselineRefs=[], approvalRef=null만 허용한다. Input은 bundleRef/responseRef/subjectBindingRef/criteriaVersion1/items6/reason, 각 item은 code/sourceRefs/responsePartRefs/judgement/reason이다.
- Current.scope는 projectId/executionId/executionGeneration이며 권위 있는 fullExecutionRef contentHash가 없다. SYNTHETIC_ONLY 제공자·전후 currentBinding/수신/6기준 대조를 수행한다. 웹 결과에 executionRef hash가 있다는 이유로 서버의 실제 실행 hash로 승격하지 않는다.
- access/project-command.ts87은 REQUIRE_APPROVAL 또는 non-null approvalRef의 reviewUnderstanding를 EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED로 거절한다. 기존 history 원형 decoder와 execution-understanding-store.ts의 JOIN은 null approval 형태를 전제한다.
- 기존 UI05는 이전 이해검토의 고정 근거를 소비해 사람이 판단을 새로 작성하고 동일 불명 원명령·입력을 보존한다. 현재 보호 history GET은 아직 저장하지 않은 승인 후보를 보여주는 계약이 아니다.

## A의 한정 계약
1. 기존 requestApproval의 이해검토 전용 후보에 정확 원 ProjectCommand 전체를 보관한다. schemaVersion/projectId/commandId/clientId/controlGeneration/operation/targetId/expectedVersion/baselineRefs/approvalRef=null/payload를 모두 결박한다. 6판단과 근거/이유·모든 ref를 포함하며 기존 문법·비밀 표식 거절·2MiB 한도는 유지한다. 원 후보 전체는 requestApproval 원payload와 그 hash에도 포함하여 자기 봉인 후보만으로 원형 권위를 대체하지 않는다. 요청과 후보 보관은 같은 transaction, 불변 원형 보호 GET은 hash/주체/명령/대상 tuple를 검산한다.
2. 대상 표현: 이 연산만 ActionScope.targetRef=null은 '실행 원형 hash 미보유'를 뜻하고 expectedVersion은 양수 executionGeneration이다. 대상이 없거나 버전0이라는 뜻이 아니다. candidateCommandId→불변 원command(targetId=executionId/expectedVersion)→원요청 hash로 정확 실행 tuple를 간접 결박한다. generic targetId==targetRef.id 예외는 reviewUnderstanding에만 적용하며, 대신 보관 원command/요청/candidate/hash/tuple를 모든 경계에서 정확 비교한다. 다른 연산의 null·0/targetRef 의미는 바꾸지 않는다. 새 executionTarget 전역 필드·가짜 fullExecutionRef/contentHash 생성0.
3. 후보의 approvalRef=null 원command hash와 결정 후 실제 approvalRef를 결박한 실행 command hash를 구분한다. 소비 시 승인ref만 정확 추가되고 나머지 target/세대/기준/전체payload/commandId가 동일한지 검산한다. 다른 명령·실행·세대·client/control/후보/만료·회수·재사용은 거절하며 DENY와 현재 정책을 유지한다. 과거 만료/거절/소비 원형 조회와 현재 소비 적격성은 분리한다.
4. 기존 HUMAN 인증·현재 제어·명시 정책·동일 원명령 replay→전후 currentBinding/부분수신/기준 재대조→일회 소비/receipt/audit→understanding_reviews append를 같은 transaction으로 묶는다. 현재 공급자 미지원/원문 미확인·응답 근거 불일치이면 승인이 있어도 거절한다. SYNTHETIC_ONLY는 실제 실행 존재·현재성·응답 출처의 증명이 아니고 두 false를 유지한다. 실제 WORK dispatch/재개는 열지 않는다.
5. 기존 NULL AUTO 이력을 보존하고 parser/클라이언트 decoder/PG 보호 조회를 AUTO·승인 두 원형으로 정확 검산한다. 신규 미적용 forward SQL은 후보↔요청·결정↔소비↔원명령/receipt/audit↔검토원문·sequence/previousRef/currentBinding의 최종 양방향 완결·불변성을 보호한다. consume 시점에 review행이 아직 없음을 고려해 선행검사/최종deferred검사를 분리한다. 기존 적용SQL/과거 자료 수정0, 실제 SQL 실행0.
6. UI08에 원 실행ID·generation/원형hash 미보유·6판단/근거·전체 이유·원명령hash·실제 실행 허가 아님을 표시한다. UI05 기존 판단/불명 명령을 보존하고 별도 결정 후 같은 원명령에만 결박하여 명시 재개한다. current user/client/control/정확후보·sameclientABA·late json/digest/403에서 과거본문 숨김, 자동 전송/자동 승인·Agent 실행0.

## 검증·미검증·가역성
- 실제 기존 class·공유 메모리 transaction/ApiClient/실 DOM 합성transport에서 요청→전체후보보호GET→별도결정→정확원명령소비→이력재조회/replay, AUTO 보존, 위조·다른대상/세대·정합재봉인 후보·부분실패·원payload/승인ref 차이·만료/회수와 current/수신/6기준 실패를 RED→GREEN 검증한다. 후보·소비·이력 원문 양방향 누락/사후변경 반례와 SQL source 검사를 분리한다.
- 해당 코드/타입/build/직접 인접 회귀·독립 C/I·Main fresh·정확 QA 회수·기존 branch private 게시. 채택 후 정확 파일·현재 HEAD·WI·QA 이름/owner/수명/정리를 먼저 고정하며 기존 단일 Primary가 구현한다.
- 실제 인증/DB BEGIN·COMMIT/RLS·경합/HTTP API·served·실 응답/부분수신 공급자·OS/Agent·사용자인수는 NOT_RUN. 실제 DB·키/Secret·인증서·정책/권한·서비스·Agent/Job/비용·Oracle운영/실 기준전환은 제외한다. FN06 HUMAN R2 등 타계약 채택0.
- source는 한정 commit revert로 복구 가능하며 실제 DB/runtime를 변경하지 않으므로 환경 rollback 없음. 기존 실패/보호자료/main과 다른branch를 보존한다. 문서 게시/추천은 채택이 아니다.
