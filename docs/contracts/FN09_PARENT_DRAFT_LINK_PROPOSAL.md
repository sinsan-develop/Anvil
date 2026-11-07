# FN09 부모 연결 하위 임무 초안 — 한정 후속 제안

상태: PROPOSED / NOT_ADOPTED. 기준45fef94b. 기존 FN09 제한 A의 parentAssignmentRef=null/ASSIGNMENT_PARENT_NOT_CONNECTED 및0012 저장 guard를 아직 변경하지 않는다. 이 문서는 코드·SQL 적용 승인이나 실제 하위 Agent 위임이 아니다.

## 필요한 차이

승인 설계 §7.1/계획 FN09의 부모 범위 내 하위 임무가 현재 입력·저장 양쪽에서 차단돼 있다. 기존 prepareAssignment envelope의 definition.parentAssignmentRef를 null 또는 같은 프로젝트의 정확 내용확정 임무 fullref로 검증해 보존하는 코드·새 미적용 forward SQL·UI04 입력/저장/재조회 소비를 한정 구현한다. 기존 null 초안·초안/확정 ref 구별과 과거 버전은 보존한다. 실제 DB 적용·정식 서비스·권한 부여·배정/Agent 호출·자격/예산/현재 writer 허가는 제외한다.

## 안전 경계·검수

- 현재 HUMAN/제어/명시 prepareAssignment 정책·DENY/기한·CAS/같은 명령/감사는 그대로다. 부모 참조는 권한을 상속하지 않는다. child도 ready/executionAuthorized/dispatchPerformed=false다.
- 부모는 같은 project의 내용확정 원문/hash·영수증/감사와 해당 초안/head/최신 내용검토를 서버에서 읽어 대조한다. 없는/다른project/변조/stale/자기참조·잘못된 상태는 저장 전에 거절한다. 초기 한 단계(parent의 parent=null)만 지원해 순환/재귀를 추측하지 않는다.
- exact 동일 필드는 taskRef.applicationRef·planRef·nodeId, environmentRef·budgetRef·recordingPolicyRef다(null도 exact 동일). child taskCode는 같은 확정 plan에 실제 존재하는 업무여야 하며 부모 taskCode와 같게 만들 필요는 없다. baselineRefs·requiredCapabilities는 부모의 exact 원소 부분집합, allowedScopes는 기존 SourceScopeV1 FILE의 root/mapping/observation/baseline fullref와 target path/access가 같은 부분집합이다. WRITE→READ 포함이나 경로 대소문자 동등성을 추정하지 않는다. child에도 기존 필수 baseline/계획·업무/설계 대조를 별도로 적용하고 부모의 실제 권한을 상속하지 않는다. 자유 문장의 목적·산출/완료조건은 사람이 별도 검토·확정하며 실제 OS/권한/내용의 범위 충족은 미검증이다.
- 부모 currentness는 같은 transaction에서 기존 parent draft/current·내용확정 원문/receipt/audit·최신 ACCEPTED 검토와 confirmedRef 전체 일치로 대조한다. 부모 head와 관련 기준의 동시 변경을 잠금/SQL 집행으로 생성·개정 COMMIT까지 차단하거나 실패시킨다. 실제 잠금/COMMIT/MVCC는 별도 검증 전 미확인이다. 나중에 부모/기준이 바뀌어도 과거 child 버전을 삭제하지 않고, 새 저장/검토/확정은 부모 currentness를 다시 검사해 stale이면 거절한다.
- 이번 단계에서 부모 연결 child는 초안 저장/개정·조회만 허용한다. child 내용 검토/확정·명시 bindResponsibleSession·실행 준비/START·SEND도 이번 채택으로 열지 않는다. 공유 parser의 nonnull 허용만으로 후속 경로가 열리지 않도록, 해당 서버 변경 경로와 직접 저장 SQL에 parentAssignmentRef nonnull의 명시 거절·양성 root/null 회귀 및 child 거절 음성을 포함한다. 거절 시 child review/confirmation·role/session/binding·preparation/execution/전달 저장0을 확인한다. 이미 있거나 관리자에 의해 삽입된 nonnull 확정본도 후속 허가 근거로 쓰지 않는다. 후속 계약 채택 전에는 UI에서도 검토/확정·배정/실행 버튼을 열지 않고 이유를 표시한다.
- 쓰기 side effect는 초안 새 version/receipt·감사뿐이다. 기존 parent=null 임무의 검토/확정·배정 동작과 과거 확정본은 변경하지 않는다. 부모 연결 child의 실제 delegateSubtask/책임세션 배정·writer/Agent 생성은 차단하며, 동시 writer 안전을 초안 저장 성공으로 주장하지 않는다.
- 새 SQL은 과거0012를 수정하지 않고 부모 exact 귀속·불변version/receipt/head 완결성을 보호하는 미적용 후보로 작성한다. 양성/다른project/옛부모/범위확대/같은command replay/기존null 회귀를 code fakeDB·DOM에서 검사하고 실제PG/COMMIT/MVCC는 별도다.
- UI04에서 현재 확정 부모를 명시 선택→고정 부모 원문 조회/명시 partial scope→초안 명령 준비/별도저장→정확 재조회다. 저장과 내용 검토·확정·실제 배정은 분리한다. 미확인 원명령/원입력 보존·사용자/client/project 격리·늦은응답 숨김을 유지한다.

## 선택

A 권장: 위 코드·미적용 SQL·화면 소비와 합성 검수까지 채택한다. 실제 DB/서비스/Agent 제외·현재 제한거절 유지. 장점은 계획상 하위 임무 저장 누락을 구현하고 실행 권한 확대를 피함. 단점은 실제 사용 가능은 후속 적용 검수 전 미확인이다. 코드 rollback은 후속 revert이며 기존 SQL/원문은 보존한다.

B 보류: 기존 null/412를 유지하고 이 단위를 구현하지 않는다. 실제 하위 임무는 미구현으로 남기며 별도 실제 배정/실행을 우회하지 않는다.
