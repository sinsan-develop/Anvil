# UI06 과거 작업계획 검토·확정 이력 조회 — 실행 WI

## 목표·승인 근거
SCREEN_WORK UI06의 공식 산출물 검수/승인·버전 이력과 FUNCTION_WORK FN04 historical_evidence_remains_readable을 완성한다. 기존 GET/decoder가 과거 exact ref를 지원하지만 WorkPlanVersionHistory는 과거 원문만 표시하고 검토·확정 이력 조회를 연결하지 않는다. 승인된 계획 안의 읽기 UI 연결이며 새 공개 API/data/정책·재승인을 만들지 않는다.

- branch codex/av3-stage-b / 시작 HEAD2de6496f70c36b67a0878eb497480ee630c32187, 제품 b8e8bc1f와 동일. Main 소유 FN14 미채택 결정안은 보존한다.
- 기존 Primary 단일 code writer, Main 관리·검수·통합, 기존 Reviewer 읽기 검수. 새로운 agent/chat/branch/QA·자동화 생성0.
- 실제 DB/권한/키/사용자 파일 조사·서비스·Agent 실행·기존 프로젝트 차단 해제0. 서버/API/helper/SQL·부모 편집 buffer/최신 계획 이력·기존 비교/원문 기능은 불변.

## 허용 코드2
1. apps/web/src/features/design-trace/WorkPlanVersionHistory.tsx — 시작SHA45F0AD4DB4519E2D11E5E9BDFE1F9D3350023820C146C69B494ED81E990B5F46.
2. tests/unit/UI06/work-plan-history-decision.test.ts — 신규, 부재 확인 후 작성.
추가 helper나 fixture 경로가 필수면 기존 도구로 불가능한 구체 근거를 Main에 먼저 제출해 내부 allowlist를 고정한다. 패키지/전역CSS/설정 변경0.

## 실제 동작
- 과거 원문 value의 정확 ref/document/design/screenReviewRefs에 기존 readWorkPlanDecision을 연결한다. 명시적 ‘이 버전 검토·확정 이력 조회’와 닫기/재조회, loading/error/empty를 제공한다. 자동 GET/POST·검토/확정/개정/실행 버튼0.
- 계획 v1의 이력은 최신 v2 이력과 분리한다. 조회한 ref/headVersion/confirmedVersion·관측시각, 과거 확정 유무와 현재 유효성 false를 구분해 표시한다. 과거 확인을 현재 적용·실행 허가로 승격하지 않는다.
- 확정 당시 confirmation.reviewRefs는 현재 contentReviews 목록과 별도로 표시한다. 현재 목록에 없다고 확정 당시 ref를 숨기거나 최신 검토로 치환하지 않는다. 검토 outcome/사람/기준 항목·이유·근거는 받은 보호 응답에서 한국어로 표시하고 untrusted text는 React escaping을 유지한다.
- 닫기·버전 입력/선택·project/user/client/ApiClient·mutable transport 변경·이탈 후 old 요청/느린 JSON 결과와 오류·401 callback이 새 화면에 도착하지 않게 한다. client.transport는 공개 mutable이므로 객체 동일성만으로 가드하지 않는다. 기존 원문 조회/비교·부모 편집 입력은 보존한다.
- 401은 해당 현재 활성 요청에서만 onAuthenticationLost, 403/404·손상 응답은 미확인/거절로 표시한다. 과거 결과로 대체·성공 승격0, 원 ref가 다르면 decoder 거절을 유지한다. 중복 조회 클릭은 요청 중 막고 명시적 재조회로만 새 조회한다.

## 구현·검수
1. 기존 UI의 과거버전 decision GET 미호출/표시 부재를 실제 component 경로의 RED로 확인한다. 기존 API/서버/계약을 수정하지 않고 연결해 GREEN으로 만든다.
2. 실제 component/button/effect와 transport를 소비하는 합성시험으로 v2/v1 분리·과거확정/현재무효·확정당시 reviewRef·없음·401/403/손상·중복·닫기/전환/느린JSON·POST0을 확인한다. source 문자열 검사만으로 행동 PASS를 주장하지 않는다. 새 dependency·실 DB/HTTP 서버/키0, 메모리 bundle/대역만 사용한다.
3. 기존 직접 영향 work-plan-decision.test.ts/work-plan-pane-keys.test.ts 등은 현재 fixture/실행범위를 읽고 필요한 것만 한 번 실행한다. type·메모리build·diff 확인, 기존 완료89 quota 검사는 변경 없으므로 반복0.
4. 기존 Operate 화면/12px·컴포넌트 패턴 유지. Main이 impeccable context49c4db를1회 실행했고 scoped fix로 PRODUCT/DESIGN 신설/도구초기화는 불필요하다. Primary는 UI 쓰기 직전 skill reference/craft-floor.md를 읽고 오류/빈상태/접근성·focus를 범위 안에서 보완한다. 최종 변경 target detect1회와 한 번의 렌더 검수를 묶어 수행한다. 실제 DOM/브라우저 도구 자원이 필요하면 Main이 정확 사전등록한 뒤 진행한다. 미실행 시각/브라우저는 명시한다.
5. Primary는 정확 diff/명령·exit·RED→GREEN·미검증·오류횟수·지문을 제출하고 writer를 해제한다. Main fresh 검증·독립 C/I0 후 같은 branch에 commit/private push한다. 전체 UI06/Stage B/WORK_PLAN 완료로 확대하지 않는다.
