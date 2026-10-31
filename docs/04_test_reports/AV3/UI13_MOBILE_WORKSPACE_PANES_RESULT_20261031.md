# UI13 모바일 주 작업 영역 전환 — source 검수

2026-10-31 / Main 어울 / source 구현·메모리 핵심 동작 확인, 실제 시각 QA 진행 전

## 기준·구현

승인 시안 `docs/design/prototypes/core-workflow/index.html` SHA256 `8B76BDE3EC24FBF37EBD53CF459D454C820098E1097171E60789C1AAC47A51D4`, WI `UI13_MOBILE_WORKSPACE_PANES_IMPLEMENTATION_20261031.md` SHA256 `7646871F6A949A2E27188F746C063CD12268374E3832A774CB6DB9B9BE8D8E75`, control `5f1670ed19f3bf594d7d409e49af75654b4f07e4`를 기준으로 기존 Primary가 구현하고 Main이 검수·통합한다.

- 기존 하단 네 탐색 하나를 유지했다. 앞 세 항목은 동일 Workspace의 대화·절차·자료 표시만 바꾸며 기존 컴포넌트를 계속 mount한다. 승인과 기존 방법론·문서 상세 경로는 보존했다.
- App의 project/user/client 소유 문맥에 pane을 결박하고 다른 문맥의 첫 render부터 chat으로 초기화한다. 일반 PC workspace는 기존 세 영역을 표시한다.
- 기존 임무·대화 buffer, API/DTO·routes·권한·SQL은 변경하지 않았다. 내부 탭·새 저장·Agent 연결을 추가하지 않았다.

## 실제 검증

Main `667678`: 동결 시험 `3D72840C…`로 실제 App의 기본 대화에서 절차가 숨겨지지 않는 행동 RED를 확인했다. 0 PASS/1 FAIL, native exit1, 746.5041ms. 제품 네 파일의 시작 지문은 불변이었다. wrapper exit0은 예상 RED 확인이며 제품 PASS가 아니다.

Main `4f03d3`: 고정 Node의 아래 다섯 파일 단일 실행에서 **27 PASS / FAIL0 / SKIP0 / CANCEL0 / TODO0**, exit0, 1129.4494ms.

```text
node --test tests/unit/UI13/mobile-workspace-panes.test.ts
  tests/unit/UI00/mobile-approval-navigation.test.ts
  tests/unit/UI00/routes.test.ts
  tests/unit/UI04/methodology-application.test.ts
  tests/unit/UI04/workspace-stage-document.test.ts
```

실제 명령은 줄바꿈 없이 위 인자를 전달했다. 수행자의 중간 24 PASS/신규 준비2 FAIL과 최종 신규8 PASS는 별도 실행이며 최종27과 합산하지 않는다.

- 실제 App: 기본 chat·하단 네 항목, 앞 세 전환의 같은 route/mount·추가 요청0, project/user/client 전환·복귀 초기화, 승인 exact 상세→mobile home의 선택 pane 복귀.
- 실제 Workspace+MobileNavigation의 명시 composition 두 경우: 기존 `newAssignmentDraft`, `newConversation`, `prepareConversation`으로 만든 임무 초안·대화 draft/UNKNOWN 원명령·body/canonical bytes 및 선택 단계 보존. 이 두 경우는 App buffer 저장 종단 시험이 아니다.
- 일반 PC 세 영역·기존 상세 링크, 실제 React 이벤트의 modifier/비기본 버튼/기취소 클릭 기본 동작 보존. `detail=0` click은 확인했으나 물리 키보드 Enter는 아직 미검증이다.
- Main `a1066a`: 타입 검사·diff exit0, Vite 메모리 build(write:false) 출력3/모듈487. 디스크 build 산출물 없음. 독립 최종 같은 지문 C0/I0/M0.

## 동결 지문

| 파일 | SHA256 |
|---|---|
| apps/web/src/App.tsx | A671D1A20CF20BE1A484D00EC96D9AAC6A119C86FBF30E6D7B17A254288CBCA0 |
| apps/web/src/features/workspace/WorkspacePage.tsx | 7E9A4D645369347854ADAFACEBE52924D31E158E816F48A6497D77D54BCE7001 |
| apps/web/src/features/mobile/MobileNavigation.tsx | BE01680B4EB8157EF4ABD108C668F8B7EC01096DFD1F47DABAF95584DECF9EFE |
| apps/web/src/features/mobile/mobile.css | 5DE25856855D3C2E3D77158DA7D2ADE4C7F3647FC5675812F1D6AD6F88C94669 |
| tests/unit/UI13/mobile-workspace-panes.test.ts | 4F967C1E162B1E9133767E14C80043D8FF882B0359E9E62FA86709EB174519DD |

## 오류·미검증·복구

- 독립 Minor1의 무조건 preventDefault는 실제 Ctrl 이벤트 RED 후 Navigation guard만 보정해 해소했다. 기존 기대값을 낮추지 않았다.
- 메모리 hashchange 누락1과 중복 준비 버튼 삽입1원인은 시험 준비 오류로 보존한다. 제품 행동 RED와 구분한다.
- 기존 Workspace 자식의 중복 React key 경고는 Main 최종 실행에서 46회다. 경고를 숨기지 않았으며 이번 scope에서 임의로 수정하지 않았다. 현재 기능 검수와 별개로 후속 결함 후보에 남긴다.
- 수행자 detect는 regex 두 대상만 실행했고 parsed page 규칙은 미실행이다. 기존 engine/pin 경고를 보존했으며 도구·설정을 변경하지 않았다.
- 메모리 root/container·전역 listener/native descriptor·소유 MessageChannel 회수 및 Node 정상 종료를 확인했다. 신규 시험은 브라우저·listener·지속 QA를 만들지 않는다.
- 실제 브라우저 CSS·접근성 트리·키보드·시각 검증은 아직 미실행이다. 별도 사전등록한 합성 file HTML QA에서 확인할 예정이며 원서버·DB/실권한·사용자 인수는 그 QA와도 구분한다.
- 사용자 자료/백업 대상 조사, DB·권한·키·실서비스·Agent 실행, 기존 프로젝트 차단 해제는 수행하지 않았다. 전체 UI13·Stage·작업계획은 미완료다.
- 제품/시험5+결과·WORK_PLAN·WORK_STATUS의 소유8경로만 통합한다. 보호3은 보존하며 rollback은 소유 commit 정상 revert다. 실제 DB rollback/배포/PR 병합은 없다.
