# UI03 저장 원본 단계의 연결 한도 정책 읽기 — WI

## 목표·근거
SCREEN_WORK UI03의 선택 단계 ‘환경·결과·조건·한도’를 기존 보호 조회 계약에 연결한다. 현재 StoredNodeDefinition은 limitPolicyRef의 ID/version/hash만 보여주고, readLimitPolicy는 편집 중 수동 참조에서만 소비된다. 새 API·DB·권한 계약 없이 저장된 프로젝트 전용 원본의 정책 값을 명시적으로 열게 한다.

- 기준 codex/av3-stage-b / de497b1b660737f417e6b240944f128c82549155. 제품은 UI06 검수본468b5efe와 동일. FN14 결정안은 미채택 보존한다.
- 기존 Primary 단일 구현, Main 관리·검수·통합, 기존 Reviewer 읽기 검수. Main 동일 코드 수정0, 새 agent/chat/branch·자동화0.
- 실제 DB/권한/키/사용자 파일 조사·서비스·Agent·기존 프로젝트 차단 해제0. API/helper/서버/SQL/편집 buffer·저장·확정·적용·실행 동작은 변경하지 않는다.

## 허용3경로
1. apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx / SHA E8D8F144C5AF4C7CDA8DF77B2CB8B549D54E767D555FA9D54B0AF31349F055E9.
2. apps/web/src/features/methodology-editor/StoredNodeDefinition.tsx / SHA D99B255D66DAC1AD58878541347CDE15EB367B0DB21396271F8C867E85256005.
3. tests/unit/UI03/stored-node-limit-policy.test.ts / 신규 부재 확인 후 작성.
추가 helper/fixture 경로가 꼭 필요하면 정확 근거를 Main에 먼저 제시한다. 기존 테스트를 분해하거나 공통화하는 작업·새 dependency·전역 CSS/설정 변경0.

## 동작
- 저장 원본 source.scope===PROJECT이고 현재 선택 단계/원본이 확인됐을 때만 현재 project/session·원본 fullref·nodeId와 exact limitPolicyRef를 결박해 조회 context를 전달한다. 로딩/오류/공통·시스템 원본/참조 없음은 새 GET0이며 기존 고정 ID 표시는 보존한다.
- 기존 readLimitPolicy(client,projectId,ref)를 ‘연결 한도 정책 원문 보기’ 명시 버튼으로 소비한다. 닫기/재조회·busy/error/빈 참조를 구분하고 조회 중 중복 입력을 막는다. 원 GET·snapshot hash·같은 project·flags false 검산을 유지한다. 최신 head를 대신 조회하거나 다른 정책으로 대체하지 않는다.
- 보관 정책 ID/version/hash·기록 상태 APPLIED/REVOKED·결정/만료 시각과 실제 limits(maxAttempts/maxElapsedMs/maxCalls/maxConcurrentAssignments/maxSpoolBytes/maxOfflineMs·있는 경우 maxCost/currency)를 한국어 표기로 표시한다. 값 없는 비용 한도를 0/무제한으로 만들지 않는다. reason/참조는 보호 응답의 text로만 렌더한다.
- 원보관 상태와 기록 기한을 보여주는 것이며 현재 정책 효력·남은 예산·OS/Agent 강제·실행 허가를 인증하지 않는다고 구분한다. 선택/해제/편집·저장·정책 변경·권한 연산/POST0이다. 기존 NodeBudgetSelection의 편집 기능을 재사용해 원본을 바꾸지 않는다.
- 닫기·노드/방법론 버전·project/user/client·client 객체/공개 mutable transport 변경·이탈 후 느린 JSON/digest·오류를 폐기한다. 렌더된 transport ABA도 분리한다. 기존 원본/편집 입력과 부모 화면 동작은 유지한다. 활성401만 인증 만료 전달,403/404·손상·다른 fullref는 미확인/거절로 표시하고 오래된 성공으로 대체하지 않는다.

## 수행·검수
1. 원본 선택 단계에서 기존 reader 미호출/실제 값 표시 부재의 의미 있는 RED를 actual component/caller로 확인 후 연결한다. 비동기 원문 검산 완료를 기다려 준비오류를 기능RED로 오인하지 않는다.
2. 신규 합성시험은 실제 component/ApiClient/원 decoder와 현재의 소형 메모리 DOM·메모리 bundle 도구를 사용한다. 새 시험 framework/패키지·기존 UI06 시험 공통화/완료검사 반복0. 한계는 명시하며 최소 도구로 검증한다.
3. 정확 과거 정책·회수/기록기한·값/단위·공통/참조없음GET0·다른project/hash/권위true거절·현재401/403·닫기/노드/버전/주체/client/transport·느린digest 폐기·중복GET1/POST0·초안 불변을 확인한다.
4. 기존 직접 영향 FN02/stored-node-definition.test.ts·project-method-web.test.ts, UI11/limit-policy-api.test.ts는 source/fixture 범위를 읽고 필요한 것만 선택한다. type·메모리build·diff를 확인하고 완료된 quota89/UI06 12 검사는 불변이면 반복0.
5. 기존 Operate/12px·원래 위치/컴포넌트 패턴을 유지한다. UI 쓰기 직전 impeccable craft-floor를 읽으며 Main context49c4db는 세션1회 실행 완료다. 도구초기화/PRODUCT/DESIGN 신설·전체 리디자인0. 변경 target2개 detect1회, Main 렌더 검수는 사전등록 합성 자원만 사용한다.
6. Primary는 exact diff/명령·exit·RED→GREEN·지문·오류·미검증을 제출하고 writer 해제한다. Main fresh·독립 C/I0 후 기존 private branch에 소유 파일만 통합한다. 전체 UI03/FN02/Stage B/계획 완료로 확대하지 않는다.
