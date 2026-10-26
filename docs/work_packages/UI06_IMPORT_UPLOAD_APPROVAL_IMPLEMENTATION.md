# FN03/FN11/UI06 가져오기 업로드 일회 승인 후 재개

## 승인된 업무와 실제 누락

WORK_PLAN Stage B FN03/FN11/UI06, FUNCTION_WORK FN03의 원본 가져오기·명시 채택과 FN11의 정확 명령 일회 승인 소비, 기존 INTERFACES.md uploadArtifact 계약(§364~368)을 소비한다. 서버 project-files/project-command의 승인 결박·소비는 이미 있다. 현재 import-api.ts continueDocumentImport는 upload.approvalRef 비null을 거절하고 업로드 화면에 승인 요청·기존 ID 결박이 없다. REQUIRE_APPROVAL 정책에서 가져오기 진행이 막히는 화면/클라이언트 처리 누락을 보완한다. 새 API/SQL/권한 정책·실제 DB 적용이 아니다.

## 담당·파일 경계

Main 어울 관리·독립 검수·통합, 새 단일 구현 subagent 담당. UI10 writer는 해제됐으며 N4/기존 UI02 보완은 동결이다. 기준 checkpoint e1a1f491, 현 UI10 소스5 및 Main문서 dirty·보호 미추적8을 보존한다.

- apps/web/src/features/design-trace/import-api.ts
- apps/web/src/features/design-trace/DocumentImport.tsx
- 신규 apps/web/src/features/design-trace/import-upload-approval.ts
- 신규 apps/web/src/features/design-trace/ImportUploadApprovalEditor.tsx
- 신규 tests/unit/UI06/import-upload-approval.test.ts
- 신규 tests/browser/UI06/import-upload-approval.spec.ts 및 동일 prefix harness.tsx

기존 document-upload-approval/DocumentUploadApprovalEditor·decisions API/policy reader는 읽고 소비하되 수정하지 않는다. CREATED_ORIGINAL 함수/분기와 기존 UPLOAD/PNG wire·target·bytes·명령 replay 의미는 필요한 승인 ref 연결 외 보존한다. UI10/N4/서버/공통계약/SQL·정식DB·권한·Secret·서비스·실제 Agent·다른 파일·문서/Git mutation은 담당 범위 밖이다.

## 사용자 흐름·보호 조건

1. 파일 선택만으로 업로드하지 않는다. 명시 후보 생성에서 uploadArtifact의 유효 JSON APPROVAL_REQUIRED/412를 받았고, prior uncertain이 없으며 아직 record/candidate가 없는 정확 원 업로드에만 승인 준비를 제공한다. 단절/HTML/5xx/결과 미확인·이미 후속 단계에는 새 결박 금지다.
2. 기존 승인 요청 또는 정확 요청 ID 조회·결박을 제공한다. 원 commandId/주체·client·제어세대·프로젝트·bytes/hash/mediaType·편집 대상과 양식을 고정한다. 현재 정책 REQUIRE_APPROVAL/현재 제어·기한·승인결정/미소비를 기존 보호 GET로 다시 확인하며 DENY/회수/만료/다른 요청·명령/불일치를 거절한다.
3. 요청·결정 조회·결박만으로 업로드하지 않는다. 사용자가 명시적으로 같은 업로드를 재개하며 원 bytes/commandId를 보존한다. 새 유료 호출/Agent 실행0이다.
4. 업로드 승인 ref는 정확 uploadArtifact에만 유효하다. 후속 record={...u,operation:'importDocument'} 생성 시 approvalRef:null을 명시하고 저장·importDocument·CREATED_ORIGINAL·PNG 채택 승인으로 전파하지 않는다. 다른 operation에 승인 지원을 추가하지 않는다.
5. GET/요청/결박의 지연과 user/client/CSRF/ApiClient/세대·프로젝트/편집대상/양식/버퍼 ABA는 이전 표시와 결박을 무효화하되 입력·원명령·미확인 상태·요청 이력을 보존한다. 명확한 최초 거절과 prior unknown을 구분한다. 필요 기능을 기존 저장 승인 폼에 가짜 DocumentBuffer로 전달하는 우회는 금지한다.
6. 이미 저장한 업로드 receipt 뒤 재진입은 동일 명령 확인이며 새 업로드/소비를 만들지 않는다. 기존 가져오기 후보·별도 명시 채택과 PNG 첨부 target 검사는 보존한다.

## TDD·검수·인계

제품 전 결박/재개 부재의 직접 unit RED→명확412→정확승인→원bytes/command재개 GREEN. 다른command/hash/주체/client/세대·만료/소비/DENY·uncertain·지연ABA를 거절한다. 후속 import 명령 approvalRef null·자동 전송0을 직접 시험한다. 기존 import/업로드 승인·생성 귀속 원문/PNG 직접 회귀·typecheck·메모리제품build/diff만 수행하고 기대완화0이다.

실제 Page 합성 DOM spec은 기존 ApiClient/validator·명시 요청/결박/재개·원입력/원명령 보존을 소비한다. 담당은 spec/harness만 작성하며 Main 사전등록 전 브라우저/임시자원 생성0이다. 실제 DB/transaction·서비스/정책 적용·사용자 인수·실Agent는 NOT_RUN으로 구분한다.

정확 변경목록/SHA·RED/GREEN 명령/exit·미검증·rollback과 writer해제를 제출하고 Main 독립 검수 후 통합한다. 전체 FN03/FN11/UI06·Stage/작업계획 완료로 승격하지 않는다.
