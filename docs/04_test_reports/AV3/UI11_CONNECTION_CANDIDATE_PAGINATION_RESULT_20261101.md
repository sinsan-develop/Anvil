# UI11 후보 목록 이전·실패 페이지 탐색 source 검수

판정: **한정 source 구현·핵심 합성 동작 확인**, 전체 UI11·실환경 인수는 미완료.

- 기준: control/private 320e09ce2f8702ead1ce8d1c28c3d5933194a1c0, codex/av3-stage-b. WI UI11_CONNECTION_CANDIDATE_PAGINATION_SOURCE_IMPLEMENTATION_20261101.md SHA256 04AA5FB7FD89A52F7B9CA74459279465F2FB9101C81CE0E095D0D5EED3B57C44. 기존 INTERFACES 후보GET kind/limit/cursor 사용, 새 API/SQL/권한 계약0.
- 기존: 다음 페이지만 열리고 실패하면 요청 cursor를 잃었다. 변경: 성공한 cursor 이력과 아직 성공하지 않은 target을 분리해 이전 페이지 및 같은 실패 페이지의 명시 재조회를 지원한다. 목록은 고정 snapshot으로 표시하지 않는다.
- scope는 project/user/clientId/CSRF/kind/API 객체/transport를 대조하며 옛 응답·늦은401·관측 ABA를 폐기한다. 상세도 detailOwner로 결박해 새 문맥 첫 commit부터 옛 원문을 숨긴다. 후보 초안·PENDING/UNKNOWN 원명령·부모 buffer 불변/POST0, NOT_READY/NOT_RECHECKED 유지.

## 변경·검증
단일 기존 Primary가 아래2만 구현했고 Main은 제품 write0, 독립 Reviewer는 읽기0변경이다.

| 파일 | 최종 SHA256 |
|---|---|
| apps/web/src/features/connections/ConnectionsPage.tsx | 0E97C1EC9140F03D3B11577B37B559E5C37A293DC00903AD87786339C793499C |
| tests/unit/UI11/connection-candidate-pagination.test.ts | 71DABCD40292B66733198D80E0E69D30D33785A58637C4D78DB9C1F585293A29 |

- 실제 React 첫 RED 0b9e26: 첫→다음 GET 뒤 이전 버튼0≠1, exit1. 상세 지적도 정상 보호fixture로 열린 원문을 확인한 뒤 API 교체 첫 commit에서 노출 RED fd3872→detailOwner 최소 보완218a76 GREEN. 단순 loader 실패를 제품 RED로 세지 않았다.
- Primary 최종3578c4 신규7+기존candidateAPI8=15PASS/0FAIL/SKIP,1370.96ms. Main a153fe/ae26cb 같은15조건 fresh **15PASS**,0FAIL/CANCEL/SKIP/TODO,2250.3268ms, 시작·끝2지문 동일.
- 정확 명령: 고정 Node24.22.1로 `node --test tests/unit/UI11/connection-candidate-pagination.test.ts tests/unit/UI11/candidate-api.test.ts`; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`; `git diff --check`. 모두 exit0.
- 실제 React 메모리DOM·기존 API/보호decoder·Vite write:false/envDir:false로 왕복/실패 동일cursor/UNKNOWN byte보존/주체·API·CSRF·filter ABA/무렌더transport·unmount/옛401·현재401/중복클릭/상세첫commit을 확인했다. native 브라우저 입력·시각 검수가 아니다.
- 독립 정확2 최종 **C0/I0**, 시작·끝지문 동일. 새 계약/기존 작성·명령 helper 변경0. protected untracked3과 관련 없는 변경을 보존한다.
- 준비 오류는 virtual-entry해석·parser인자·native digest 완료전단언·tsc의 config누락 help출력4건이다. 올바른 기존 명령/시험 준비로 교정했고 마지막 정확검사0이다. 동일 제품 근본원인3회 실패가 아니다.

## 미검증·복구
실브라우저/레이아웃·실API/DB·현재 사용자 정책·서비스·Agent·설치/사용자인수는 NOT_RUN. QA 디렉터리·실네트워크·실DB/권한/키/서비스/Agent 실행0, live handle0. 전체 계획 완료·merge를 주장하지 않는다. 복구는 이 한정 제품2 commit의 정상 revert로 수행할 수 있으며 사용자 dirty·보호 untracked·DB를 reset하지 않는다. 다음 독립 업무를 기존 Primary가 읽기 대조하고 Main이 범위를 고정한다.
