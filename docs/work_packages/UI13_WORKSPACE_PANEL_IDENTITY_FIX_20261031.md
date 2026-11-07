# UI13 실제 화면 중복 패널 — 한정 보완

2026-10-31 / Main 어울 / 기존 UI13 WI7646871F의 실제 QA finding 보완

기준 `fef276ff32c0962204ee5ef1bdd7fcca5c3a3c24`. 메모리 27 PASS와 별개로, 최종5 source hash에 결박한 실제 합성 브라우저에서 단계B·대화 초안·pane 전환·PC 복귀 후 프로젝트 적용 헌법 패널 4개를 관측했다. `desktop.png`와 34d696 snapshot을 보존한다. 시각 QA는 I1 미해결이며 완료가 아니다.

독립 원인 읽기에서 WorkspacePage의 같은 부모 아래 ProjectConstitutionPanel/WorkspaceConversationSources가 동일 project/user/client key를 사용하는 것을 확인했다. 이 충돌과 인과를 같은 행동의 수정 전·후 검증으로 좁힌다. 다른 부모의 ConversationPanel key나 KnowledgePage의 별도 경고는 이번 제품 범위가 아니다.

## 정확 허용 변경

- `apps/web/src/features/workspace/WorkspacePage.tsx` 시작 SHA256 `7E9A4D645369347854ADAFACEBE52924D31E158E816F48A6497D77D54BCE7001`.
- `tests/unit/UI13/mobile-workspace-panes.test.ts` 시작 SHA256 `4F967C1E162B1E9133767E14C80043D8FF882B0359E9E62FA86709EB174519DD`.

기존 Primary 단일 writer가 먼저 시험만 추가한다. 실제 App에서 해당 순서를 반복하고 헌법 패널과 관련 대화 출처 패널이 각각 정확 1개인지를 단언한다. 단계·초안 보존 및 pane 전환 자체 추가 IO0을 유지한다. 기존 8개 기준을 삭제·완화하지 않는다. Main의 실제 반례 확인 후에만 제품 GO한다.

제품은 두 sibling key에 서로 다른 고정 namespace를 붙이는 최소 수정만 허용한다. 기존 project/user/client 부분과 props·순서·mount·pane 상태는 보존하고 전환 때마다 새 key를 만들지 않는다. App/Navigation/CSS/route/API·DB·권한·키·서비스·Agent 실행은 변경하지 않는다.

같은 source 조건의 RED→GREEN과 직접 영향 최종 검증·독립 재검수 후 새 source 지문을 동결한다. 기존 4개 패널 캡처를 정상으로 소급하지 않는다. 새 합성 실제 화면에서도 정확 1개·상태 보존을 확인하고 기존 QA 자원은 원 수명 안에서 정리한다. 원 HTML을 덮지 않고 보완 source에 결박한 새 fixture는 Main의 별도 정확 등록 후 생성한다. 전체 UI13·계획 완료와 분리한다.
