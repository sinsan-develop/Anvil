# UI06 저장 전 산출물 선택 표시 검증

기준은 병합본 `0c9ab78a`, 개발 브랜치 `codex/av3-ui06-local-selection`, 지시서·현황 체크포인트 `ca87fffc`이다. 지시서 SHA256은 `22A61669339DAD90948BD8E63F04879E50CF09B5EFF2DD599BE42CB060553BC0`이다.

## 구현 결과

같은 단계·양식을 사용하는 A와 B 중 사용자가 고른 B를 빈 초안과 빈 작성틀에서 “저장 전 선택한 산출물 METHOD_ARTIFACT_B · 서버 귀속 미확인”으로 표시했다. 작성틀의 원 양식 섹션 A와 원 단계 참조를 유지했다. 선택 표식과 두 참조를 동결하고 원 준비 버퍼·주체·클라이언트·전송에 결박했다. 편집기가 원 버퍼에서 생성한 제목·본문 등의 변경만 이 표시를 계승한다. 다른 버퍼에 표식이나 필드를 복사하거나 원 버퍼에서 제거한 표식을 되돌렸을 때도 표시가 복원되지 않았다.

프로젝트 GET 대기 중 주체·전송이 바뀌면 적용본 GET을 보내지 않았다. 준비 중 주체가 바뀌었다가 되돌아온 뒤 도착한 200·401에서 이전 초안이나 인증 소실을 통지하지 않았다. 원 편집기 저장 콜백에 메모리 전송으로 409·503·200을 전달했다. 각 경우 업로드와 초안 저장을 각 1회 관측했고, 409에서는 원 입력·보류 명령을, 503에서는 원 불명 상태를, 200에서는 확정 참조를 보존했다. 기존 업로드·저장 키 목록, 본문 해시, 영수증 및 고정 문서 편집 경로를 유지했다.

## 실행 근거

|검증|명령|관측|
|---|---|---|
|직접| `node --experimental-strip-types --test tests/unit/UI06/stage-document-draft.test.ts tests/unit/UI06/form-document-outline.test.ts tests/unit/UI06/editor-api.test.ts tests/unit/UI06/prepared-stage-output-ui.test.ts` |종료 0, 31통과·실패 0·건너뜀 0, 2539.6048ms, `2eb243`|
|인접| `node --experimental-strip-types --test tests/unit/UI04/workspace-stage-document.test.ts tests/unit/UI06/document-upload-approval.test.ts tests/unit/UI06/conflict-api.test.ts tests/unit/UI06/proposal-api.test.ts` |종료 0, 24통과·실패 0·건너뜀 0, 1483.12ms, `2d87ea`. 이후 바뀐 화면 내부 원표식 검산은 위 직접 검사에서 재검증했다.|
|전체 타입| `npm run typecheck` |종료 0, `3564ba→5a9fae`|
|기준선 공백| `git diff --check development/main` |종료 0, `01be17`. 미추적 시험은 `git diff --no-index --check -- /dev/null tests/unit/UI06/prepared-stage-output-ui.test.ts`에서 빈 출력·종료 1(신규 파일 차이), 공백 진단 0.|
|메모리 웹 빌드|직접 시험 안에서 Vite `build`로 실제 편집기·양식·준비 함수를 묶어 React를 RAM DOM에 렌더링|설정 파일·환경 디렉터리·공개 디렉터리 비활성, `write:false`. 파일을 출력하거나 서비스를 띄우지 않았다.|

제품 수정 전 B가 반환되지 않은 직접 실패는 `685691`에서 확인했다. 그보다 앞선 `19e628`은 시험 초기화 순서 문제였다. 작성 중 RAM 화면의 선택 목록 준비를 기다리지 않은 실패(`e7a737`)와 Vite 빌드 반환형 좁힘 누락(`c3871e→5c3b33`)은 시험 코드에서 고쳤다. 사전 검수에서 다른 초안 첫 화면에 B 이식·원 선택 변경이 각각 재현됐다(`b5b39a`, 2실패). 원 객체에서 표식을 없앴다가 복귀시키는 경우도 별도로 재현했다(`e9c218`, 1실패). 위 31건에는 세 반례의 보완 후 결과가 포함된다. 중간 통과 건수를 누적하지 않았다.

## 동결 지문

|파일|SHA256|
|---|---|
|`apps/web/src/features/design-trace/editor-api.ts`|`E51A8BB8865A364B57600C11617156C6A9885DCA1AF4AC6BCB8AD6AABB0047EE`|
|`apps/web/src/features/design-trace/stage-document-draft.ts`|`83CC9E44348711A6E12D55233FC8B4CF7295EC399390774E3D719ECB91DD5E46`|
|`apps/web/src/features/design-trace/form-document-outline.ts`|`E9812E202F425D895A041642D51640D626DD94603F9F7EFBA4DFE04FCCF0F4C5`|
|`apps/web/src/features/design-trace/NewStageDocumentForm.tsx`|`F03320AAC6BE5E27D1523A8C8215907F0A619F5EEE302AC7B8F51E2FA15DBB25`|
|`apps/web/src/features/design-trace/DocumentEditor.tsx`|`EF9F20957CA6B07A5E5B7EAA4F9FF2471FDB18BB7245CDF6FFFF6374D54F9D2E`|
|`tests/unit/UI06/stage-document-draft.test.ts`|`2721B498E5A93D8C9D9E829E7F5C85E3CF4036F028ABBDFF370CCB97435C484B`|
|`tests/unit/UI06/form-document-outline.test.ts`|`0F3901AD2B9E32786A7AC275F6B0C97EAEB72E428C9ADD49710A6098A5369D2F`|
|`tests/unit/UI06/editor-api.test.ts`|`2416D9F6FA79AE33096459C8868B3CEB9A30170B5463E2F593ACEB915EA33B4D`|
|`tests/unit/UI06/prepared-stage-output-ui.test.ts`|`48336E73BF23834D181AD947AF6DEB10E42A7F16F71407A97193C7AF2261B055`|

## 미검증 및 복구

실제 브라우저·운영 서비스·DB·권한·키·사용자 원문·CLI·SDK·Agent·C# 및 추가 원격 조회 실행은 0이다. 버전별 서버 산출물 귀속 계약은 별도 채택 대기다. 이번 변경의 복구 범위는 위 다섯 화면 소스와 네 시험의 차이이며, 통합 후 문제가 생기면 Main이 해당 변경을 정상 되돌리기 한다. 데이터 이관이나 DB 복구는 필요하지 않다. 현황·독립 검수·통합은 Main이 담당한다.
