# U-01 정상 요청 생성의 선행 등록 공백과 최소 보완안

## 확인된 상태

2026-10-14, 기준 `codex/u01-dashboard-r2` HEAD `5578ba27945ff994f4c363fb2173b5fa75c51da0`. 정식 source C20/manifest M20와 DB0021은 유지된다. 신산님은 별도 검증용 Task에서 정상 요청1건을 생성해 화면까지 확인하는 작업을 지시했다.

선택 조합 `anvil-wsl-development / wsl-development`에서 정식 `SqlAlchemyTaskBootstrapRepository.resolve_create_authority`는 None이다. 이 조합의 design_baselines0/Task0/approval_requests0, 전역 Task1/Run1이며 모두 읽기만 했다. 프로젝트·환경 등록과 repository mapping은 별도다.

Task 생성 repository는 구현돼 있으나 저장소 mapping과 상위 기준선/WorkPlan/Iteration/WI를 실제 승인 원본에서 영속 등록하는 정상 adapter는 없다. `DesignArtifactRepository`/`PlanningRepository`는 Protocol이고 설계 서비스는 메모리 모델이다. 단일 기존 Primary의 독립 읽기 조사도 일치했다. C20 registrar/producer는 이 저장된 계보를 검증·소비하며 생성하지 않는다. 따라서 **정식 요청 생성 전 경로는 부분 구현**이다. 단순 추가 검증 이월이 아니다.

## 승인 경계

기존 Task별 내부 Main 권위 승인은 요청 생성만 허용하며 설계 기준선의 승인 원본을 새로 인정하거나 다른 주체의 등록 권한을 자동 부여하지 않는다. reader의 dashboard:read를 확대하지 않는다. fixture의 HUMAN 승인·가짜 해시를 정식 DB에 넣거나 요청 행을 직접 INSERT해 정상 경로라고 보고하지 않는다.

## 권고 A — 이 조합과 검증 Task에 한정된 내부 정상 등록

- 실제 기존 private Anvil repository와 `wsl-development`의 mapping을 정상 영속 adapter로 연결한다. 기존 mapping이 다르면 덮어쓰지 않고 conflict로 거부한다.
- 승인된 `Anvil_설계서_v2.md` SHA256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, `Anvil_작업계획서_v1.md` `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`와 기존 원장/Task 내부권위 승인 두 건을 읽기 검증하는 source binding을 명시한다. 새 typed artifact의 canonical hash와 원 문서 file hash는 구분한다.
- 내부 Main의 **이번 정확 조합·검증용 Task에 한정된 등록 권위**로 상위 계보를 보관한다. 임의 prompt를 human approval로 승격하거나 실행 승인용 approval_records/authenticated_human을 생성하지 않는다. 기존 승인 원본을 바꾸거나 다른 Task에 권위를 자동 전파하지 않는다.
- 기존 정상 Task bootstrap → typed 계획 생성·검증 → 기존 Task 권위 registrar → 기존 요청 producer로 실제 요청1건을 저장한다. DB 감사와 인가 GET/UI의 동일 request/Task/plan hash·기간/재조회/로그아웃을 확인한다. 요청·감사 이력은 자동 삭제하지 않고 검증 Task임을 식별 가능하게 보존한다. 임시 실행 권위는 검증 후 회수한다.
- 공개 POST/메뉴, reader 권한, 신규 외부 로그인·Secret, 사람 승인·반려, Run 생성·실행·재개, Oracle/Production는 제외한다. 기존 Task1/Run1은 수정하지 않는다.
- 상세 파일·원본 검증·감사·멱등/위조 거부·회수 계약은 승인 뒤 최소 WI에 고정하고 유효 dual lease의 단일 Primary가 TDD한다. 로컬→private→WSL exact SHA 순서를 유지한다. 기존 완료 빌드/백업/광범위 검사를 반복하지 않는다.

## 대안과 필요한 결정

A는 정상 생성에 빠진 기능을 보완하므로 권고한다. B는 현 화면의 빈 원장 조회만 유지하는 것으로, 실제 요청 생성은 미구현으로 남긴다. 기존 Task를 재사용하거나 승인된 것처럼 꾸민 fixture를 주입하는 우회는 대안으로 삼지 않는다.

**권고 A의 한정된 내부 등록 기능과 원본 인정 범위를 승인할지** 결정이 필요하다. 승인 전에는 새 WI/lease·제품 코드·DB 자료/권한·서버 변경 없이 공백과 제안만 기록한다. 전체 U-01 NOT_ACCEPTED/Release DEFER와 이전 반영 성공·실패 이력은 유지한다.
