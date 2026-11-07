# UI13 모바일 주 작업 영역 전환

2026-10-31 / Main 어울 / TEST_ONLY → Main RED 확인 → PRODUCT_GO

## 승인 기준과 현재 누락

설계 §11.14·§12.3, SCREEN_WORK UI13, 승인 시안 `docs/design/prototypes/core-workflow/index.html` 6·36행(SHA256 `8B76BDE3EC24FBF37EBD53CF459D454C820098E1097171E60789C1AAC47A51D4`)을 따른다. 하단 네 탐색 중 대화·절차·문서/결과는 같은 Workspace의 표시만 바꾸고, 승인은 별도 화면으로 간다. 내부 탭을 추가하거나 화면을 재설계하지 않는다.

현재 앞 세 탐색은 다른 route로 이동하며 Workspace의 선택 단계 등 local state를 잃는다. 기존 App의 임무·대화 buffer 보존 구조와 상세 route는 재작성하지 않는다. 기준은 `codex/av3-stage-b`, 직전 검수 commit `eee88797aa84ea255f09d2462abc3eeb07d0790f`다. 기존 Primary만 코드를 쓴다.

신산님 최신 직접지시로 제품 소스·시험 읽기는 허용됐다. 실제 사용자 자료·백업 대상 조사, DB·권한·키·서비스·Agent 실행과 기존 프로젝트 차단 해제는 계속 제외한다. 새 API·DTO·저장·권한·route 계약은 만들지 않는다.

## 허용 경로와 시작 지문

| 경로 | SHA256 |
|---|---|
| apps/web/src/App.tsx | EE1DE470C2F17D96D4469389A1989C3C8301ECE1D3099015CDFA2B711944F335 |
| apps/web/src/features/workspace/WorkspacePage.tsx | E298F66D3DE058ED591D0A2E3B8B611754EA5EB806A85B640DEA6D18CACCC44A |
| apps/web/src/features/mobile/MobileNavigation.tsx | AD2840FBF601B8760E94774C7B91819513C398B85E5C08075931C02DB1EB68B1 |
| apps/web/src/features/mobile/mobile.css | 19B2BFDB5856A207DBF47EF8B7ADCCFCA127FBE497956387A37149EF367DB988 |
| tests/unit/UI13/mobile-workspace-panes.test.ts | 신규·부재 확인 후 작성 |

처음에는 신규 시험 한 파일만 수정한다. 제품 네 파일은 Main이 실제 행동 RED와 지문 불변을 확인한 뒤 별도 GO해야 수정한다. 기존 시험·설정·의존성·SQL·다른 dirty/보호3은 변경하지 않는다.

## 구현 계약

- 내부 pane은 `chat`, `steps`, `docs` 세 값이다. App이 project/user/client 소유 문맥에 결박해 관리한다. 문맥이 다르면 첫 render부터 기본 chat이며 이전 pane을 순간 채택하지 않는다. 프로젝트·주체 전환 뒤 복귀를 포함해 초기화하고 기존 사용자 buffer는 삭제하지 않는다.
- 기존 하단 MobileNavigation만 사용한다. 앞 세 항목은 명시 callback으로 pane을 바꾸며 같은 mobile home에서는 route 변경·재조회·POST가 없다. 승인 항목은 기존 정확 anchor를 보존한다. mobile 상세 화면에서 앞 세 항목을 누르면 기존 mobile home으로 돌아와 고른 pane을 표시한다. 새 pane URL이나 history schema를 추가하지 않는다.
- WorkspacePage는 optional mobilePane을 받아 기존 절차·총괄 작업·자료 영역을 계속 mount한 채 표시만 바꾼다. 모바일 home은 총괄 작업/대화가 기본이다. 숨긴 영역의 버튼이 접근성 트리·탭 순서에 남지 않게 하고 기존 스타일의 display 규칙이 hidden을 무효화하지 않도록 한다.
- 모바일 route의 기존 mobile-content 범위에서만 적용하며 해당 route는 넓은 화면에서도 같은 동작을 한다. 일반 PC workspace는 prop 미지정으로 기존 세 영역·동작을 유지한다. 선택 stage·임무 초안·대화 입력·UNKNOWN 원명령과 조회/전송 중 state를 같은 프로젝트의 세 pane 전환 중 보존한다. 그 전환 때문에 컴포넌트를 새 key로 mount하거나 자동 송신하지 않는다.
- 기존 방법론·문서·승인·결과 상세 링크와 route를 삭제하지 않는다. 승인 화면 왕복까지 Workspace 전체를 keepalive하는 기능은 추가하지 않는다. 실제 Agent 연결을 구현한 것처럼 표시하지 않는다.
- `impeccable`의 기존 Operate 컨텍스트를 유지하며 실제 UI 수정 직전 craft-floor를 읽는다. 색·글꼴·새 도구·공통화·설명박스·다른 레이아웃 변경은 금지한다.

## 검수와 단계

1. TEST_ONLY: 실제 MobileNavigation·WorkspacePage·기존 API/decoder·ReactDOM을 메모리 DOM/합성 transport로 실행한다. 가능하면 실제 App 경유도 확인하고, 대체 composition이면 실제 App 검수와 한계를 분리한다. 현재 callback/pane 미연결로 인한 행동 실패를 보여준다. 단순 부재 import·타입오류·문자열 token 검사만으로 제품 RED라고 하지 않는다.
2. 필수 정상 흐름: 기본 대화와 하단 네 항목, 절차에서 stage 선택→문서/결과에서 같은 stage 자료→대화 입력·불명 원명령 유지, 앞 세 항목 왕복 중 같은 route/mount·추가 GET/POST0. 기존 명시 동작이 원래 수행하는 요청과 탭 전환의 추가 요청을 구분한다.
3. project/user/client 교체 후 기본 대화·선택 단계 초기화, 이전 buffer 자동 송신0. 승인 정확 deep-link·기존 방법론/문서 상세 링크·PC 세 영역 표시 불변을 확인한다. 가능하면 Enter 동작과 선택 상태·숨긴 영역 접근성도 확인한다.
4. Main fresh RED 후 PRODUCT_GO: 네 제품 파일의 최소 내부 연결만 구현한다. source/type/시험의 기존 기준은 낮추지 않는다. 최종 신규 행동검사와 직접 영향받는 기존 mobile navigation/routes·workspace reader를 선택해 한 번 묶고 type·메모리 build·diff를 수행한다.
5. root/gate/native/global/소유 MessageChannel을 회수하고 열린 process/session을 남기지 않는다. 현재는 메모리검증만 허용하며 브라우저·서버·파일 산출물·QA 자원을 만들기 전 Main에 정확 대상·수명·정리 계획을 제시한다. 실제 서비스·DB·키·Agent를 사용하지 않는다.
6. writer는 시작/최종 지문·diff·실제 RED/GREEN 명령/exit·준비오류·미검증·QA/handle 상태를 반환한다. Main은 독립 검수·필요한 최종 실행 후 소유 경로만 통합한다. 실제 브라우저 시각·served·DB·사용자 인수는 수행한 증거가 생기기 전 미검증이다. 전체 UI13·Stage·계획 완료로 승격하지 않는다.

rollback은 소유 commit의 정상 revert이며 실제 DB·서비스 복구 명령은 없다.
