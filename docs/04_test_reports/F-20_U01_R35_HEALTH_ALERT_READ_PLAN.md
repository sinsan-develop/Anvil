# F-20/U-01 R35 Health·Critical 읽기 화면 정합화 계획

## 판정과 범위

승인된 설계 §29.2와 작업계획 U-01의 기존 Dashboard GET 자료를 화면에 정직하게 연결한다. R34 종료 seq2010, worker/write lease 없음, 기존 `codex/f18-wsl-ops` 한 브랜치가 기준이다. 이는 새 기능·공개 API·권한·DB schema·지속 데이터 계약을 만들지 않는 UI-only 절편이다. 기존 R34 세 Run 상태 카드와 Critical 저장 기록 페이지, same-origin 경계를 보존한다.

## 표시 계약

1. Health 여섯 카드(Database, Queue, Worker, LLM Providers, Execution Backends, Artifact Store)는 기존 Dashboard `health` 각 component의 상태·마지막 점검 시각·오류 수를 동일한 원칙으로 표시한다. Database의 별도 readiness와 LLM Providers의 등록 수는 독립 정보로만 병기하고, 이를 health 정상 판정으로 승격하지 않는다. `source_gaps`, 미관측, 위조·불완전·미래 시각, 상위 조회 실패는 `UNKNOWN`/`UNAVAILABLE`로 닫고 0 오류·정상으로 만들지 않는다. 상세 링크는 실제 활성 route로 안전하게 연결되는 경우에만 표시한다. U-10 미구현 route나 내부 URL은 링크로 만들지 않는다.
2. Critical Alerts는 기존 저장 GET에 이미 포함된 `impact`, `next_action`을 각 경고의 원인·대상과 함께 읽기 전용 텍스트로 표시한다. API가 확인한 값만 표시하고 HTML·URL·내부 주소를 실행하거나 링크로 변환하지 않는다. 저장 기록 부분 조회, 권한 철회, 오류, 비어 있음, 취소/재연결 상태는 이전 보호 데이터를 남기거나 확인 성공으로 바꾸지 않는다.
3. Project/Environment/오늘·7일·30일 필터, Critical 확인 쓰기, Gate·예상비용·baseline 현재 수치, 장애 재개는 이번 절편에서 만들지 않는다. 해당 미완료 상태와 C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`를 유지한다.

## 단일 writer와 검증 순서

1. Main은 기준 문서 hash·clean Git·G-05·seq2010 no-lease를 확인하고 정확한 WorkInstruction/Invocation 및 dual lease를 append-only로 발급한다. 전에는 제품 write가 없다.
2. `developer-primary` 한 명이 기존 Console 테스트에 Health source 구분과 Critical 영향·다음 행동의 예상 RED를 추가하고, `App.tsx`의 최소 변경으로 GREEN을 만든다. 필요할 때 기존 formal browser harness의 API↔DOM assertion만 보완한다.
3. 정상/미관측/source gap/불완전·미래·비밀/권한거부·재조회·부분 페이지, R34 Run 카드와 기존 Health/Next Actions 회귀를 검증한다. Console 전체, 브라우저 문법/audit, typecheck/lint/build, 관련 Python 비 opt-in, G-05, diff check를 실행한다. 실제 browser/Network는 Main이 동일 SHA로 WSL-server 격리 PG15/OIDC/HTTPS/Chromium에서 확인한다.
4. Main이 독립 diff/spec 검토에서 Critical/Important 0을 확인한 뒤 기존 branch에 checkpoint/private push한다. WSL-server 전용 리소스는 생성 전 대상·수명·정리 방법을 현황에 기록하고, 완료/실패 후 신원을 확인해 정확한 리소스만 제거한다. 결과·현황과 append-only 종료 통제로 lease를 회수한다.

## 완료 한계와 rollback

이 절편 PASS는 Health 표시와 Critical 읽기 문구만 증명한다. U-01 독립 Tester 전량 `ACCEPTED` 및 F-20 수락 전에는 main 병합·새 branch·Production/ysna 작업을 하지 않는다. 회귀 시 R35의 지정 제품 diff만 정상 Git revert하며 이전 Event prefix·R34 증거·사용자 자료를 보존한다.
