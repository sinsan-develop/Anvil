# UI10 보관 공유요청의 원 지식 읽기 전용 미리보기 작업지시서 r2

목표: 보관 공유요청에 기록된 정확 원 지식 버전을 출발 프로젝트의 기존 보호 GET으로 명시 조회한다. 요청 보관은 실제 공유가 아니며 새 공유/대상 쓰기를 구현하지 않는다.
기준 HEAD27b79b7c6414e865a0ec23cff293e7c3eab70d0e·기존codex/av3-stage-b. Main 관리·검수·통합, 기존 Primary 단일 writer/Reviewer 읽기 검수. 신산님 현 전체WORK_PLAN 수행 지시·계획내 구현/테스트 재승인 불필요 및 project AGENTS10/17/§5.1·PMO§6에 따른 Stage B UI10/FN05 내부 조회 표시 누락 보완이다.

## 기존 계약·증거

기존 A안 직접승인 call_84af3084e4294486a1514f370614dbb3/item0, 후보 F60EEE63D28E65949B41BEA1F67D5B70F61767F84141E67A9F1CCBAC8A226B47와 docs/work_packages/FN05_KNOWLEDGE_SHARE_REQUEST_IMPLEMENTATION.md를 따른다. 출발측 본인 보관·보호 조회만이며 공유 B issuer/대상 쓰기·권한 추가0.
Main49e133/507d05: 기존 패널 상세는 versionRefs를 문자열로만 표시한다. 부모 inspect는 selected를 바꿔 패널 rawKey/상세·목록을 초기화한다. 독립·Primary 읽기 대조에 따라 부모를 바꾸지 않고 패널 내부 미리보기+기존 readKnowledge를 재사용한다. 이 reader(api.ts66)는 현재 출발 project의 보호 GET 후 정확 ref·entry hash·원 body bytes/hash·보호 상태를 검산한다. snapshot이나 client flag를 접근 허가로 쓰지 않는다.

## 정확 허용 코드3경로

1. apps/web/src/features/knowledge/KnowledgeShareRequestPanel.tsx — 시작5D428AA0E51830FDE2C03B52F39551ECFB50ED75D0D30292EC9A56662D09E09F. 필요하면 같은 파일 내부 읽기 전용 컴포넌트만 추가.
2. tests/browser/UI10/knowledge-share-request-dom-harness.tsx — 시작5971BEADEC1228C28AA9F4FBC4ADA378B16C1DD88167D1933C6849F7795A11A7. 원 지식 GET 지연/거절/불일치의 합성 fault 선택지 및 서로 다른 정상 고정 요청2건의 선택적 fixture·정확 id/hash 상세 lookup만 추가, 기존 NORMAL 기본동작·입력/버퍼·문맥교체 의미 보존. 기본 입력에서 두 요청을 자동 생성하지 않으며 선택적 QA seed일 때만 사용한다.
3. tests/browser/UI10/knowledge-share-request-original-dom.test.ts — 신규 집중 시험. 기존 dom.test.ts의 과거 QA 경로/승인/실행은 재사용하지 않는다.

KnowledgePage/api/reader/server/SQL·다른 화면·기존 시험파일·의존성·환경/배포 설정 수정0. 신규 source helper/범용 프레임워크/컴포넌트 추출0. WI/계획/현황/결과는 Main 소유. 새/불확실경로는 목록→동일경로Leaf→본문 순서, 추측 조회금지/필요자료는Main요청.

## 동작·장벽

- METADATA_ELIGIBLE의 현재 보호 조회된 요청 상세에서만 각 정확 versionRef를 명시 선택할 수 있다. UNAVAILABLE에는 원문 버튼/참조·목적 추가 노출0.
- 기존 readKnowledge(client,현재 출발 projectId,정확 ref)만 호출한다. title/ref/state/body를 텍스트로 표시하고 body를 HTML/Markdown script로 실행하지 않는다. 편집/확정/헌법 적용/실제공유·Agent전달·다운로드·대상 프로젝트 조회/쓰기0. 과거 버전/제안/사용 제외 상태를 현재확정/전달가능으로 승격하지 않는다.
- 읽기 상태는 panel key·client identity·requestRef id/version/hash·knowledgeRef id/version/hash에 결박한다. 원래 selected/부모 view/공유 작성 buffer·원명령을 변경하지 않는다. key에는 기존 내부 문맥이 있으므로 DOM/로그로 출력하지 않는다.
- 요청 재조회/상세 전환·미리보기 닫기·주체/client/project/control 문맥 변경 시 본문을 즉시 숨기고 늦은 응답/오류를 폐기한다. 원문 재조회/실패도 이전 body를 숨긴다. 본문·ref/hash/보호 검산 실패는 fail closed,403은 읽기 거절/401만 기존 인증 상실 통지이다. 저장 요청 자체가 원문 접근권한 증명이 아니다.
- 새로운 미리보기의 pending/닫기·실패가 원 공유요청의 미전송/미확인 명령을 삭제·바꾸거나 자동 재전송하지 않는다. 원 요청 상세/목록의 문맥을 끊지 않고 선택한 원문과 현재 보관 요청이 혼동되지 않게 표시한다.

## TDD·최소 검증

- [ ] HEAD/제품·harness 시작hash·신규시험 부재·문서dirty Main소유/보호8 확인. 038839에서새QA/시험부재를확인했지만생성직전다시확인한다.
- [ ] 실제 KnowledgePage/Panel/ApiClient·기존 보호 reader를 통과한 명시 원문 버튼 부재 RED를 먼저 확보한다. reader/parser나 부모를 fake로 대체하지 않는다.
- [ ] 제품1파일에 한정 미리보기·상태 장벽을 구현한다. harness 추가 fault는 기본 NORMAL에서 기존 동작과 동일해야 한다.
- [ ] 정확 원문·요청/지식 ref 표시/추가 GET만·XSS 텍스트, UNAVAILABLE 비노출, wrong ref/body/hash/보호 상태 거절·403/401 뒤 이전 body 제거, request 교체·닫기·client/user/project/ABA 전환과 늦은 body 폐기, 부모 selected·미전송/미확인 원명령 전체 불변을 실제 합성 DOM에서 확인한다. 실행한 정확 문맥과 미실행을 구분한다.
- [ ] harness의 기존 NORMAL 보호 GET/공유 보관·문맥 기본동작을 신규 한정 회귀로 확인한다. 기존 구 QA script를 무승인 재실행하거나 옛 결과를 새PASS로 쓰지 않는다. 정상 source와 preview 권한은 실제 공통 reader의 현재 검사이고 harness의 상태flag를 제품허가로 넘기지 않는다.
- [ ] npm run typecheck·필요 build·git diff --check와 신규한정 DOM 시험만 수행한다. Node test의 여러 subtest/조건/1부모 결과를 명확히 분리한다. 제품/환경 불변 재검사0.
- [ ] Primary 분리 RED/GREEN/명령/exit·최종3hash·build/harness지문·오류·미검증/회수증거 제출 후 writer해제. Main fresh 한정검증·독립C/I·정확QA회수/별도부재 후 코드3+문서4만게시. 전체Stage게이트전PR/main병합0.

## QA 사전등록·경계

신규 D:/tmp/anvil-v3-stage-b/ui10-share-request-original-20261030-01, Windows owner Main/Primary, 하위temp/results·필요한 파생 synthetic bundle. 기존 Edge/Playwright/Vite만 사용(설치0), 서버/listener/포트0·Vite in-process build와 route.fulfill만. 생성 전 부재/realpath/link/owner/기존 영향 확인. Primary필수검증과Main독립검증은 순차적으로만실행하고 각실행은 새빈자기root를만들어생성후30분이내정리한다. 기존자원부재/잔여0확인전동명재생성0,수명연장/다른QA삭제0. 실제키·DB·서비스·Agent·권한·인증서/Oracle·제품자료FS/공유B·대상쓰기 변경0. 실제 DB/served/사용자인수·전체 UI10/FN05/WORK_PLAN은 NOT_RUN/미완료다. 기존 P03 R2/미채택158E 경계는 유지한다.
확인된 자기 browser/runner 정상종료·exact 절대경로/owner/link 확인뒤 자기 root만 회수·별도부재확인. 검증 증거를 회수하고 불명 process 종료/ACL변경0. 심사거절은 정확원문·미실행을즉시 Main보고·근거없는반복/우회0. 같은근본오류3회연속은해당단계중단/예외판단,무관작업은계속. rollback은해당단위정상Git revert·실제자료/보호8보존.

## r2 사전 이행성 보완
- 부모WI172B0BA5의실제request전환시험은기존단일requestId harness만으로재현할수없음을Primary가확인했다. 정확고정요청2건의선택적seed/id/hash lookup만같은harness에명시허용한다. 두요청은기존실제snapshot형식·지문을검산하고같은출발지식ref를공유해도되며요청id/hash는구분한다. 새제품API/권한/기본NORMAL동작변경0,기준완화/필수request전환생략0이다.
