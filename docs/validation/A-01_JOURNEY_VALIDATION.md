# A-01 Journey Validation

## 판정

`AV-UI-005 / STATIC_ONLY / DEVELOPER_COMPLETED_PENDING_INDEPENDENT_TEST`

`AV-FLOW-001`은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 책임은 A-05·B-03·A Gate에 남는다.

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

## 적대 mutation

필수 경로 누락, edge 단절, 승인 우회, 구 hash 재사용, STOP checkpoint 누락, RESUME 중복 실행, 기술 PASS 승격, non-pass 상태 승격, A-01에 `AV-FLOW-001` 재삽입, 사람 actor/subject hash/result 누락 및 문서/catalog drift를 거부하도록 고정했다.

## 증거 한계

이 판정은 Markdown·JSON·SVG와 stdlib validator를 사용한 L7 정적 계약 검증이다. SVG는 1920×1080 정적 render일 뿐 브라우저 screenshot이 아니다. 실제 클릭, API, DB, Event 영속화, same-origin Network, Docker, WSL, Production, 배포와 Release는 모두 `NOT_EXECUTED`다.
