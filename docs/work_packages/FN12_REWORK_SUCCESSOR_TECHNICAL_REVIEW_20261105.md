# FN12 후속 임무 계보 B안 채택 전 기술 검토

- 일자: 2026-11-05. Main 어울, 읽기 검토 담당 remaining_execution_dependencies.
- 판정: 기존 계획의 보완 요청→후속 임무→새 제출 연결을 위한 후보 검토다. B안 미채택·계보 저장 SOURCE_GO0을 유지한다. 기존 제품 결함이나 기존 순수 함수의 수정 GO로 판정하지 않는다.
- 후보 기준: docs/contracts/FN12_REWORK_SUCCESSOR_LINEAGE_CANDIDATE.md r2, 36663B, SHA256 B460F98FDE8360BD532DF73D8E49CC8613AD007DC67CD360B953BA3169FE2B5B.
- 실제 코드 실행·시험·DB/권한/키/서비스/Agent 실행0. 아래는 기존 작업 branch의 source 읽기 근거이며 실제 DB·경쟁 실행 검증이 아니다.

## 1. 도출 규칙과 고정 초안 확정의 충돌

원 확정 임무가 acceptanceCriteria=[A], verificationRequirements=[V]이고, 검수 기준 cA가 A만, cV가 V만 정확히 참조하면 전체 기준 합집합은 원조건을 충족한다. cV만 REWORK/BLOCKED이고 missingItems=['cV']인 선택도 현행 입력에서 허용된다.

- result-criteria.ts:27/35는 개별 기준이 양 필드를 모두 참조할 것을 요구하지 않고 전체 합집합을 검사한다.
- result-rework-input.ts:46은 REWORK/BLOCKED 중 선택한 부분집합을 허용한다.
- rework-successor-input.ts:64/75는 선택한 sources만 각각 도출하고 두 배열의 정확 일치를 요구한다. 위 사례는 acceptanceCriteria=[], verificationRequirements=[V]가 된다. A를 넣으면 CRITERIA_MISMATCH다.
- assignment-input.ts:48 및 project-assignment-confirmations.ts:69는 빈 필수 목록을 REQUIRED_LIST_MISSING/ASSIGNMENT_CONTENT_INCOMPLETE로 거절한다.
- 후보4.2는 고정 v1 개정도 금지하므로 이 유효 입력에서 확정할 수 없는 초안이 생긴다.

채택 전 결정점은 양 목록을 충족하는 선택만 지원해 나머지를 생성 전에 거절할지, 선택 보완 범위와 후속 임무의 필수 내용 보존을 구분할지다. Main 권장은 유효한 기존 보완 요청을 보존하기 위해 두 번째 방향을 상세화하는 것이다. 기존 root 필수조건 완화나 보존 조건의 자동 합격 취급을 권하지 않는다. 이 권장은 채택·구현 승인이 아니다.

## 2. 공유 잠금의 실제 분기와 유한 접점

후보4.1의 connection_candidates head만 잠근다는 설명은 실제 등록 정의 분기를 빠뜨린다. responsible-sessions.ts:217~226은 REGISTERED_DEFINITION이면 보호 reader와 agent_connections.head_version을, 후보 연결이면 connection_candidates head와 만료·현재성을 대조한다.

새 공개 connectionKind를 만들기보다 원 binding snapshot의 기존 kind로 실제 권위 head를 선택해 잠그는 상세가 필요하다. 관련 변경 producer도 같은 조정에 참여해야 한다. 각 실제 함수·잠금 행·순서·동일 Tx·직접 DML 경계를 유한 표로 고정하고 기존 잠금 재사용과 새 참여를 구분한다. 현 조사만으로 기존 구현 전체에 경쟁 결함이 있다고 선언하지 않는다. OS writer 종료·회수는 DB 행 잠금으로 대체하지 않으며 확인 수단이 없으면 신규 경로를 조정불가로 거절한다.

## 3. 저장·정책·계상 상세 미확정

후보6의 quota 접합만으로 새 기록이 collector에 포함되거나 중복이 없다고 입증할 수 없다. origin/link의 실제 열·snapshot·관계 metadata, 기존 draft/result 및 command/receipt/audit의 복제, 소유 분모와 실제 canonical 비용을 먼저 일대일 매핑해야 한다. 그 뒤 actual/held·admission/저장/정산/역완결의 같은 Tx, 같은 command/hash replay 저장/비용 증가0, 충돌·감사 실패 전체 rollback의 정확 접점을 정한다. 새 상한 숫자나 두 새 물리표를 먼저 확정하지 않는다.

후보5.1은 PROJECT MaterialRule만으로 source/origin/binding selector 결박이 생기지 않음을 인정한다. 기존 정책을 유지하는 목적제한 domain guard와 정책 계약 확장 중 어느 방식을 쓸지 명시해야 하며 두 새 operation을 기존 권한으로 자동 허용하지 않는다.

## 4. 유지 가능 항목과 사람 결정

기존 child HUMAN 내용 기능·root 소비 경계, 순수 재료의 NOT_STORED/storageVerified=false, draft→origin 및 manifest→receipt→result→link의 비순환 순서, 같은 Tx/fullref/현재 인증 뒤 보호 replay, 역사 조회와 신규 실행 권위 분리는 유지 가능하다. 손상을 NOT_LINKED로 숨기지 않는 GET과 권위 flag=false도 유지한다.

고정 v1 개정 금지·원보완당 후속 하나·변경 시 새 보완이라는 제품 제한, 두 operation/두 GET·저장 배치·AUTO/DENY 전용 제한은 별도 채택 결정이다. 위 충돌과 잠금·계상 상세가 닫히기 전에는 승인 질문을 구현 가능 패킷으로 제시하지 않는다. FN06은 기존 단일 Primary가 계속 구현한다.

## 5. 읽은 핵심 source 지문

아래는 검토자가 실제 읽은 파일의 추가 현재 지문이다. 후보 지문과 구분하며 실행 증거로 사용하지 않는다.

| 저장소 루트 기준 경로 | SHA256 |
|---|---|
| apps/server/modules/results/result-criteria.ts | FC91F7561861A057C91D184AEAFDD4D6D6A3D8F77FB9AE90F9870394E8433FED |
| apps/server/modules/results/result-rework-input.ts | 2778AE829C370ABC9C8713852A963E420FB40B66CA40F78FDF67A7F00EDF0096 |
| apps/server/modules/results/rework-successor-input.ts | E8E65A497A69684289D7AE7B2287F6DB5237C8652F535C5AC1FE738AAB081A46 |
| apps/server/modules/assignments/assignment-input.ts | 40093629F092FEB4BB8D661420B3985E8A9D93B72F37B6D290DF3995663D9ECF |
| apps/server/modules/assignments/project-assignment-confirmations.ts | CF590A5B1D413C3205B54D634D4925E0801CEE8C7B55CB6DF4E99EF6A6EEDCE2 |
| apps/server/modules/assignments/responsible-sessions.ts | 851513EADAAE8E2F9310907F08D5C472881E6E6C7AB27C13FC43C40D189F0295 |
## 6. 저장·collector 직접 매핑의 추가 읽기 결과

A가 직접 소비선만 대조했다. 신규 계보 저장을 구현하거나 기존 일반 저장 전체의 결함으로 판정하지 않는다.

| 논리 대상 | 현재 실제 저장 | 현재 계상과 필요한 상세 |
|---|---|---|
| 후속 draft | ProjectAssignmentDrafts.save의 assignment_drafts/assignment_draft_versions 및 공통 receipt | 현재 목적별 합산에 일반 draft는 없다. 새 후속 draft 소유 projection과 일반 draft 전체 소급 편입을 구분한다 |
| 후속 result | ProjectResultSubmissions.submit의 result_submissions와 공통 receipt | 현재 일반 result 합산은 없다. 새 후속 result 실제 행과 관계 metadata의 소유를 명시한다 |
| command/receipt/audit | persistProjectReceipt가 commands.result_ref·authorization_receipts·audit_events를 같은 Tx에 저장 | FN75는 setup reservation, FN76은 receive 소유 부분집합만 수집한다. 새 두 operation을 자동 편입하지 않는다 |
| origin/link | 현재 순수 재료만 있고 실제 계보 저장 producer/물리 배치는 미정 | 실제 행·관계와 양방향 완결·계상 projection을 저장안 채택 뒤 닫는다 |

실제 복제 비용과 중복 계상은 다르다. draft snapshot은 version_json과 command result_ref.data.snapshot에, result manifest는 result_submissions.snapshot_json.manifest와 command result_ref.data.manifest에 각각 실제 저장된다. 원 command body 전체를 재보관하지 않으므로 그 전체 비용을 command 행에 가산하지 않는다. 후보 originRef도 fullref 복제이지 origin snapshot 전체 복제라고 임의 확대하지 않는다.

0076 quota_complete_before_source는 SETTLED reservation+FN15/FN75/FN76 actual과 RESERVED/IO_STARTED/UNKNOWN+각 future를 합산한다. fn76_project_quota_settle도 같은 기존 분모+변경 전 FN76 소계와 account를 정확 비교한다. 따라서 새 FN12 소계를 더한다면 합산 함수 한 곳만 고쳐서는 안 된다. 신규 소계의 admission/정산/역완결 기준선과 기존 목적별 정산이 양립해야 한다. 이 관측은 작성 중0076 raw B07341DD9A8FF035536DB6C4ABAA7C4F6C72B7C358D8EF20039B51D84E120BD1 기준이며 FN06 수정 지시가 아니다.

ProjectStorageQuota.parts와 quota_plan_valid는 지정 kind/operation만 허용하고 FN15 reserve도 전용이다. 새 FN12를 기존 kind로 위장하지 않는다. 두 신규 쓰기가 같은 Tx에서 끝나는지 외부 미래 효과가 있는지 정하기 전에는 새 held나 외부 IO를 필수로 정하지 않는다. 기존 projectReplay의 현재 인증·허가 뒤 원 operation/hash 비교·원 result_ref 반환은 저장 증가0의 재사용 접점이지만 origin/link 중복 방지는 별도 관계 완결이 필요하다. 기존 deferred guard도 collector가 모르는 새 기록 누락을 자동 발견하지 않는다.

## 7. 공유 잠금의 유한 직접 접점

B가 실제 producer와 현재 SQL 보호를 읽어 다음처럼 구분했다. 공통 Tx는 AccessRepository.authenticated의 같은 PoolClient BEGIN/body/COMMIT 또는 ROLLBACK이다. currentProjectController의 FOR UPDATE OF p,m은 JOIN 잠금이며 분리된 project→member 획득 순서의 증거는 아니다.

| 대상 | 현재 직접 producer·접점 | 채택 전 경계 |
|---|---|---|
| 인증/session | AccessRepository의 identity·reauthenticate/changePassword/logout, user/session/client 잠금 | 기존 충돌 잠금 재사용과 전체 회수 순서 검증을 구분 |
| 참여권 | ProjectMemberships.save→membershipManager/Base, project/member JOIN→control→policy→대상 멤버 user_id순 잠금 | 후보 공통 순서와 실제 복수 멤버 순서 조정 필요 |
| control | ControlAcceptance.run의 project→member→control과 이전 tuple CAS | DB CAS를 OS writer 회수로 대체하지 않음 |
| 정책 | ProjectPolicyRepository.command/currentPolicy의 controller 뒤 head SHARE/개정 UPDATE | 승격을 포함한 유한 순서 확인 필요 |
| 후보 연결 | ProjectConnectionCandidates.command의 controller→policy→head UPDATE→append | 기존 mutation 잠금과 새 SHARE의 충돌 조정 재사용 가능 |
| 등록 정의 | ProjectConnectionDefinitions.command의 controller→policy→head v1/version INSERT | 불변 head와 project mutex·재조회 재사용이 우선이다. 앱 UPDATE를 새로 열거나 FOR SHARE를 기계적으로 추가하지 않음 |
| root draft | ProjectAssignmentDrafts.save/current, 부모가 있으면 parent head 먼저 UPDATE | 복수 draft UUID순 후보와 실제 순서를 조정 |
| 내용 검토/확정 | ProjectAssignmentConfirmations의 current 검산과 append, SQL project→draft 잠금 | 고정 v1/최신 검토의 새 계보 관계는 별도 guard 필요 |
| 역할/binding | ResponsibleSessions.define/bind의 controller→draft/role/stage→종류별 연결→최신 binding→append | 최신 binding 조회 자체는 무잠금. 공통 project mutex 참여와 INSERT guard를 재사용할지 상세화 |
| result/review/rework | 각 ProjectResult 저장, rework는 project UPDATE 뒤 binding/draft/application 재대조 | 원 보완 fullref는 불변 원행이다. 새 보완 append와 같은 원보완 계보 중복을 구분 |
| 방법론 | ProjectMethodologies.apply의 controller→application/이력→정의 head→append | 이력 있는 전환의 현재 거절을 새 지원으로 확대하지 않음 |
| 실행/queue/grant | 기존 queue command의 controller 뒤 append와 recovery/revocation store | 기존 INSERT 잠금만으로 상태 UPDATE/stop/recovery/직접 DML 전체 참여를 증명하지 않음 |

0065는 앱 SELECT/INSERT만 허용하고 등록 정의 불변 head와 project 공통잠금을 사용한다고 명시한다. connection_definition_insert는 UPDATE/DELETE를 거절한다. 따라서 앞2절의 등록 정의 잠금 상세는 권한을 늘리는 row SHARE를 뜻하지 않는다. 원 binding의 기존 kind로 권위 저장을 구분하고 실제 project mutex와 불변 head 재대조를 먼저 재사용해야 한다.

관리자·구버전 서버·직접 DML·프로젝트 보관/실행 상태 변경까지 같은 프로토콜 참여가 증명된 것은 아니다. 미확정 경계가 닫히기 전 REWORK_COORDINATION_UNAVAILABLE 거절을 유지하는 조건은 남는다. 새 operation/API/물리 저장/상한/권한을 채택하지 않는다.

## 8. 조사 오류와 증거 한계

B의 조회 b07299는 미확인 파일명2개를 사용해 도구 exit1이었다. 원 명령:

```powershell
rg -n 'async |FOR UPDATE|INSERT INTO|UPDATE ' apps/server/modules/executions/project-executions.ts apps/server/modules/executions/project-execution-commands.ts | Select-Object -First 8
```

원 stderr:

```text
rg: apps/server/modules/executions/project-executions.ts: 지정된 파일을 찾을 수 없습니다. (os error 2)
rg: apps/server/modules/executions/project-execution-commands.ts: 지정된 파일을 찾을 수 없습니다. (os error 2)
```

개별 rg 종료코드는 별도 수거하지 않았으며 ACL 오류가 아니다. 실패 조회는 기술 근거에서 제외하고 실제 경로는 rg --files로 확인했다. 재실행·권한 변경0이다. Main은 이후 FN06 검수 대상을 이미 확인된 정확 source/시험/SQL 경로로 한정해 재발 방법을 중단했다. 이 보고의 모든 결과는 source 읽기이며 실행·DB·경쟁 검증이 아니다.