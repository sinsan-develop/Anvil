# FN06 이후 미완료 작업 선행조건 읽기 배정

2026-11-04 · Main 어울 · 코드 writer 추가 없음

현재 FN06 최초 수신 패킷의 source-only 채택에 따라 기존 Primary가 56개 허용 경로를 단독 구현한다. 이 조사는 다음 작업을 미리 준비하기 위한 읽기 전용 지원이며 현재 구현 담당자의 파일을 수정하거나 시험을 중복 실행하지 않는다.

## 담당 A: remaining_execution_dependencies
현재 docs/WORK_STATUS.md, docs/WORK_PLAN.md, docs/contracts/FN06_NATIVE_FIRST_RECEIVE_SOURCE_ADOPTION_20261104.md 및 연결 업무 카드에서 현재 56개 구현 다음에 필요한 실행 연결 업무를 최대 3개 선정한다. 정확한 계획 ID, 실제 미완료 호출선, 선행조건, 기존 승인으로 구현 가능한 범위, 추가 결정이 필요한 차이, 서로 독립인지와 writer 순서를 반환한다. 이미 끝난 과거 검토나 현재 작성 중 S2 코드를 다시 검토하지 않는다. 계약/출력 변경을 스스로 확정하지 않는다.

## 담당 B: remaining_stage_b_dependencies
현재 UI02 source-only 완료 범위와 Stage B 잔여 업무를 대조한다. 현재 FN06 56개와 파일 충돌 없이 나중에 같은 단일 writer에게 줄 수 있는 기존 승인 미완료 구현 업무를 최대 3개 선정한다. 계획 ID, 소비되지 않은 실제 호출선, 증거 파일/행, 명시적 승인과 제외 범위, 착수/검수 선행조건을 반환한다. 새 기능을 발명하거나 이미 완료한 UI02 검사를 다시 실행하지 않는다.

## 공통 제한
코드/시험/SQL/문서 수정, commit/push, 실제 DB/권한/키/서비스/Agent/컴파일/실자료 조사, J3/P03 R3 실행은 0이다. 다른 담당자가 같은 저장소를 사용 중이므로 변경을 되돌리지 않는다. WORK_STATUS와 실제 소스가 다르면 차이를 사실대로 보고한다. 현재 작성 중인 기능의 부재를 확정 결함으로 세지 않는다. 결과는 Main에게만 반환하며 Main이 다음 writer 작업을 선정한다.
## 2차 조사: Stage C~G의 기존 승인 독립 구현

앞선 Stage B/첫 실제 실행 접점 조사는 반환 완료했다. 같은 조사를 반복하지 않는다.

- 담당 A remaining_execution_dependencies: Stage C·D의 FN07~FN13/UI04·05·07·08·09에서 현재 승인된 계약/API가 있으나 소비 호출선이나 화면이 빠진 독립 source 업무를 최대 3개 찾는다.
- 담당 B remaining_stage_b_dependencies: Stage E·F·G의 FN14~FN17 및 IX02~IX08에서 같은 조건의 업무를 최대 3개 찾는다. 검증을 반복하거나 codec만 더 만드는 일을 기능 구현 진도로 선정하지 않는다.

각 후보는 계획 ID·명시 승인/기존 계약·실제 빠진 source 호출선·정확 파일/행·필요한 선행조건·허용 파일의 FN06 충돌 여부를 반환한다. 다른 Stage 배치가 있으면 실제 계획 표를 우선한다. 실제 DB·권한·키·서비스·Agent·컴파일·실자료 조사·J3/P03 R3가 필요한 항목은 source 구현과 실제 실행을 구분한다. 이미 검수된 UI02/codec/profile/과거 이력 화면을 재구현·재시험하지 않는다.

새 공개 API·권한·저장 의미를 임의 채택하지 않는다. 후보가 없으면 조사한 실제 업무와 정확 미충족 선행을 제시한다. Main이 선정하며 현재 Primary의 단독 writer는 유지한다. 코드·문서·SQL 쓰기·시험·원격 조회·실환경 실행은 0이다.
## 3차 담당 A: FN12 보완 후속 후보의 최신 source 대조

기존 FN12_REWORK_SUCCESSOR_LINEAGE_CANDIDATE.md는 2026-10-24 source 기준이며 CHILD_DRAFT_ONLY 등 과거 가정을 포함한다. 이후 FN09 하위 HUMAN 검토/확정·예약과 보관 조회가 승인·구현됐으므로 과거 후보를 그대로 다음 승인 요청으로 올리면 안 된다.

remaining_execution_dependencies는 이 기존 후보 전체와 최신 관련 source/직접 채택 기록을 대조한다. 현재도 실제로 없는 원 보완→후속 임무→새 제출의 구조화된 계보가 무엇인지, 이미 새 하위 HUMAN 계약이 제공하는 부분이 무엇인지 구분한다. 기존 승인만으로 소비 가능한 최소 연결이 있으면 정확 호출선/파일과 보존할 권위를 반환한다. 여전히 새 공개·저장 계약이 필요하면 기존 후보에서 실제 필요한 최소 차이만 반환한다. 오래된 source hash/거절 문구를 현재 사실로 단정하지 않는다.

이번 작업은 채택 전 읽기 검토이며 새 B안 채택·수정 문서·제품 구현 지시가 아니다. 쓰기/시험/실환경/원격 실행0. 현재 Primary의 FN06 구현과 단일 writer는 유지한다. 파일은 실제 목록에서 찾고 추정 경로나 Windows glob을 반복 사용하지 않는다. 불확실한 결과는 누락으로 승격하지 않는다.
## 4차 담당 A: 기존 FN12 후보의 사실 정정안 준비

현재 FN06 Primary 구현은 계속한다. 담당 remaining_execution_dependencies는 이미 읽은 docs/contracts/FN12_REWORK_SUCCESSOR_LINEAGE_CANDIDATE.md와 최신 HUMAN source의 차이를 기준으로, 기존 후보를 다시 검토할 때 필요한 정확 정정안을 텍스트로만 반환한다.
- 과거 child 설명을 현재 내용검토/별도확정/과거조회와 root-only 실행/예약으로 나눠 바로잡는다. 이미 있는 순수 rework-successor-input/rework-origin-material은 재구현하지 않는다.
- 기존 제안의 원보완→고정 후속 root draft→새 제출 계보에 필요한 공개 입력/조회·불변 원장·정책 selector·기존 root 검토/확정/예약/일반제출 우회 방지 접점을 현재 실제 함수/타입과 대조한다.
- 과거 후보의 어떤 절/타입/수치/호출선이 그대로 유효하고 무엇이 실제로 달라졌는지 구체 문장 수정안과 근거를 반환한다. 두 operation/두 GET/두 표를 증명 없이 필수 최소안이라고 확정하지 않는다. 기존 제안의 수치/한계는 그 출처를 표시하고 새 상한·필드·권한 의미를 임의로 정하지 않는다.
- 새 Source 구현 허용목록이나 migration 번호는 아직 확정하지 않는다. 현재 FN06이 수정 중인 project-command 등 공통 파일의 baseline을 미래 고정본인 것처럼 쓰지 않는다. 실제 제품 source/문서는 변경하지 않는다.

이는 현재 미채택 후보의 최신성 정리이며 새로운 B안 선택·계약 채택·제품 구현 GO가 아니다. Main은 반환을 검토한 뒤 필요한 정확 결정만 별도 상정한다. 새 인터뷰를 반복하거나 이미 합의된 제품 목적/방법론을 다시 정의하지 않는다. 코드·문서·SQL 쓰기/시험/DB/권한/키/서비스/Agent/컴파일/실자료/원격 실행은0이다. 경로는 실제 목록과 기존 확인 경로만 사용한다.
## 2026-11-05 FN12 미채택 B안 기술 정합의 후행 읽기 준비

담당 A remaining_execution_dependencies에게 r2 사실 정정과 별개인 B 제안 자체의 기술 정합 검토를 배정한다. 대상은 docs/contracts/FN12_REWORK_SUCCESSOR_LINEAGE_CANDIDATE.md의 두 operation/계보 GET, 원본 계보·연결 임무 guard·공유 잠금/원자성·현재성/replay와 고정 초안 개정 제한이다. 기존 승인된 root/child HUMAN 내용·등록 정의 예약·순수 재료를 다시 구현하지 않고 후속 임무→새 제출 연결 공백의 필요/최소 계약과 순환·우회·검수 불가능 조건을 구분한다.

기존 r2 사실 검수·Stage 전체 소비 survey는 반복하지 않는다. 필요한 기존 source는 실제 참조/import 경로로만 확인하며 추정 조회하지 않는다. 결과는 채택 전 수정 쟁점·기술상 유지 가능 항목·사람 결정점으로 반환한다. 코드/SQL/문서 쓰기·시험·Git·실제 DB/권한/키/서비스/Agent 실행0이다. 새 source GO0과 미채택을 유지하고 FN06 단일 Primary의 승인 구현은 계속한다.
## 2026-11-05 FN12 기술 쟁점 수거와 후행 유한 접점 분배

A의 채택 전 기술 검토를 docs/work_packages/FN12_REWORK_SUCCESSOR_TECHNICAL_REVIEW_20261105.md(SHA256 2C09AD4B3E1C60D0653846EABFDE7843C23A9974E1A583EDEC4E8BA50D751CA3)에 보존했다. 검증 전용 missingItem의 빈 acceptance 도출과 기존 확정 충돌, REGISTERED_DEFINITION 잠금 분기 누락, 물리 저장/collector·domain guard 상세 미정이 쟁점이다. 기존 제품 결함이나 Source 구현 GO로 판정하지 않고 B 미채택을 유지한다.
A는 origin/link 논리 기록·기존 draft/result/command/receipt/audit의 실제 저장/collector를 일대일 매핑한다. B는 후보4.1의 실제 변경 producer·권위 head·잠금 모드/순서·동일 Tx·직접 DML 보호를 유한 접점표로 반환한다. 기존 재사용/새 조정/미정을 구분하고 신규 물리표·열·숫자·상한·공개 계약을 선택하지 않는다. 완료된 사실 검수/Stage 소비 survey와 FN06 parser 검사는 반복하지 않는다. 모두 읽기만 하며 파일/SQL 쓰기·시험/Git·실제 DB/권한/키/서비스/Agent 실행0이다. FN06 단일 Primary의 기존 구현을 계속하고 FN12 SOURCE_GO0을 유지한다.