# A-01 Journey Validation

## 판정

`AV-UI-005 / STATIC_ONLY / DEVELOPER_COMPLETED_PENDING_INDEPENDENT_TEST`

`AV-FLOW-001`은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 책임은 A-05·B-03·A Gate에 남는다.

## Revision 2 — A01-TST-BLK-001 보완

- `approval_boundary.human_approval_required_for`를 순서 독립 exact 집합 `FUNCTION_SCOPE_CHANGE`, `REQUIREMENT_CHANGE`, `IMPORTANT_RISK_CHANGE`로 고정했다.
- 다섯 canonical decision의 ID·step·actor·subject·hash 필요 여부·allowed results·reject/revise target을 fixture와 validator literal의 exact contract로 비교한다.
- Concept, WorkInstruction, Release의 reject/revise 결과를 machine-readable edge와 `PATH-REJECT`/`PATH-REVISE` outcome binding에 연결했다.
- 모든 reject/revise target은 존재하는 STEP, TERMINAL 또는 명시된 비상태 결과여야 한다.
- approval guard 제거, Concept unknown revise target, `EDGE-12-REJECT` 삭제, Concept allowed results 축소의 네 hostile mutation을 먼저 실행해 4/4 RED를 관찰한 뒤 4/4 GREEN으로 전환했다.
- Revision 1 manifest와 독립 TestReport는 수정하지 않고 successor EvidenceManifest R2가 predecessor SHA를 결박한다.

## 검증 대상

- 14 canonical 단계와 Workbench progressive disclosure screen map
- Idea·Design·Plan·Execute·Verify·Validate·Release·Learn Phase Rail
- `PATH-NORMAL`, `PATH-REJECT`, `PATH-REVISE`, `PATH-STOP`, `PATH-RESUME`
- 사람 actor, approval subject hash, 허용 전이, 거부·보완 결과
- 기술검증·ProductValidation·DefectAssessment·ReleaseDecision·Learning 분리
- 정적 SVG render의 `E-SHOT_STATIC_NOT_RUNTIME_UI` 한정자

## TDD 관찰

1. validator와 artifact 부재 상태에서 `test_a01_journey`가 checker 미구현으로 FAIL/ERROR하는 RED를 관찰했다.
2. 최소 catalog·문서·checker 구현 뒤 5/5 GREEN을 관찰했다.
3. fixture·manifest 계약을 먼저 추가한 뒤 fixture와 validation/completion 부재로 1 FAIL/1 ERROR RED를 관찰했다.
4. fixture를 구현한 뒤 manifest/report 부재 1 FAIL만 남는 것을 관찰했다.
5. 독립 finding의 hostile mutation 네 건이 기존 validator에서 오류 `[]`로 false-pass하는 RED를 재현했다.
6. exact approval·decision·target·edge·path validator를 추가한 뒤 동일 네 건이 stable reason code로 거부되는 GREEN을 관찰했다.

## 적대 mutation

필수 경로 누락, edge 단절, 승인 우회, 구 hash 재사용, STOP checkpoint 누락, RESUME 중복 실행, 기술 PASS 승격, non-pass 상태 승격, A-01에 `AV-FLOW-001` 재삽입, 사람 actor/subject hash/result 누락 및 문서/catalog drift를 거부하도록 고정했다.

## 증거 한계

이 판정은 Markdown·JSON·SVG와 stdlib validator를 사용한 L7 정적 계약 검증이다. SVG는 1920×1080 정적 render일 뿐 브라우저 screenshot이 아니다. 실제 클릭, API, DB, Event 영속화, same-origin Network, Docker, WSL, Production, 배포와 Release는 모두 `NOT_EXECUTED`다.
