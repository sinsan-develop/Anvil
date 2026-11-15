# UI03/FN02·FN03 검토·확정 사건의 고정 조회 복구

기준 main7b4d6036aef9cec217197f533ad708b3bd4196cc, branch codex/av3-ui03-review-receipt-read. 기존 내용 검토 기록·별도 확정과 보호 GET의 화면 연결 보완이며 새 공개 API·저장 형상·권한·DB 변경은 없다.

## 확인된 오류와 기대 동작

FormReviewPanel/MethodReviewPanel은 검산한 reviewRef 또는 confirmationId를 보존하지 않고 후속 GET 실패 뒤 원명령 POST 재확인만 제공한다. 반대로 GET의 버전이 맞더라도 해당 검토·확정 사건이 없는데 pending을 해제하고 onVerified/기록 확인으로 진행할 수 있다. 원 영수증 사건과 고정 GET을 대조한 뒤에만 완료 표시해야 한다.

원 pending command와 검산된 사건을 동일 FormReviewWork의 명시적 optional 화면 상태로 보존한다. commandId/operation·원 요청·target fullref·주체/client·scope/projectId에 결박한다. recordContentReview는 reviewRef 전체(id/targetRef/criteriaVersion/outcome)와 원 items/reason·reviewer를, 확정은 confirmationId·대상·원 reviewRefs·decidedBy를 기존 GET 본문과 대조한다. 사건이 최신 첫 행이라고 가정하지 않는다. 사건 누락/다름/조회 상한·GET412/503은 pending·원입력·영수증을 보존하며 미확인으로 표시한다. 새 pagination이나 추가 API를 발명하지 않는다.

영수증 검산 뒤 명시 복구는 같은 고정 GET만 수행한다. 원문·해당 사건 대조가 성공하기 전 onVerified·기록 확인·pending 해제·dirty 해제는 하지 않는다. POST 응답 유실이나 사건 영수증 부정형은 기존 동일 원명령 재확인으로 남긴다. 자동 GET/POST, 자동 내용 적합/확정/적용·실행 판정은 금지한다. 최신 검토 기반 별도 확정 조건은 그대로 유지한다.

공통 양식·공통 방법론 및 PROJECT 방법론을 포함한다. PROJECT의 기존 prepare→write→read와 정책·일회승인·preparationId·application 동작을 유지한다. 저장 영수증 뒤 read-only 재조회는 원 prepared request.projectId/현재 projectId·주체·명령과 결박하고 같은 gateway.read만 쓴다. 현재 projectId는 ProjectMethodologyPage에서 내부 prop으로 전달해 재렌더마다 바뀌는 gateway 객체 참조만으로 같은 프로젝트 작업을 무효화하거나 다른 프로젝트를 받아들이지 않는다. 주체/client/transport/CSRF·프로젝트·대상 버전·기준 변경/화면 종료/ABA 뒤 늦은 성공·401은 버퍼·본문·인증 상태에 반영하지 않는다.

## 단일 writer와 정확 허용 5경로

기존 developer_primary만 다음을 수정한다. Main은 문서·검수·Git 통합이며 다른 작성자의 변경을 되돌리지 않는다.
- apps/web/src/features/methodologies/FormReviewPanel.tsx
- apps/web/src/features/methodology-editor/MethodReviewPanel.tsx
- apps/web/src/features/methodologies/form-editor-state.ts
- apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx
- tests/unit/UI03/project-methodology-review-read.test.ts

ProjectMethodologyPage 변경은 MethodReviewPanel에 현재 projectId를 전달하는 한 곳의 내부 prop 연결에 한정한다. source나 보호 GET이 이미 반환하는 projectId를 사용하며 새 서버 필드는 추가하지 않는다. 공유 상태 파일에는 두 패널에 필요한 명시 타입·사건 대조 helper만 추가할 수 있고 일반 프레임워크/불필요한 리팩터·cast 우회는 하지 않는다. 추가 경로가 필요하면 쓰기 전에 Main에 반환한다.

## 검증·제외

실제 두 React 패널의 RAM 시험으로 수정 전 RED를 재현한다. 정상 영수증→GET503/사건없는 정상형상 GET→왕복 자동요청0→명시 GET에서 정확 사건 확인, POST총1·onVerified/pending해제는 정확 일치 후만을 검증한다. 다른 사건/원문hash·review actor/items/reason/criteria·confirmation reviewRefs/actor·부정형 영수증·원POST유실 동일명령 재확인·늦은200/401/프로젝트·주체 교체와 최신 첫 행이 아닌 사건을 구분한다. PROJECT gateway prepare/write/read 원순서 및 복구 read만, 별도 확정 조건·기존 입력·검토 보존을 회귀로 확인한다. 기존 기대값을 낮추지 않는다.

직접/필수 인접 내용검토·공통/PROJECT API 회귀, typecheck·원웹config 메모리빌드·diff/최종지문을 반환한다. 실제 DB/권한/키/서비스/Agent·SDK·실자료·R3 조회/조작은 제외한다. RAM은 실브라우저/served/DB 인수가 아니며 전체 업무 완료가 아니다. rollback은 5파일 한정 diff 역적용이며 실제 사건/사용자 자료는 변경하지 않는다.
