# FN06 EnvironmentVersion — 참조 공백과 완성 작업 묶음

2026-11-01 / Main 어울 / DESIGN_IN_PROGRESS / 세부 공개·저장 계약 미채택
이 문서는 구현 완료나 새 API·권한·실행 승인이 아니다. 기존 FN06 계획의 환경 기능을 끝내기 위한 실제 공백과 다음 설계·구현 단위를 기록한다.

## 1. 목표와 현재 사실

환경 기능은 개발자가 소스·도구 실행 위치·시험/배포 대상·명령·비밀 참조·허용 범위를 정의하고, 정확 버전으로 저장·조회해 연결 정의와 임무에 사용하는 기능이다. 후보만 저장하거나 빈값만 허용한 것을 이 기능 전체의 완료로 처리하지 않는다.

작업 기준은 WORK_PLAN/FUNCTION_WORK FN06, 설계 §9와 S11, INTERFACES §12.1의 EnvironmentVersion/saveEnvironment다. 완료 FN09 source 체크포인트276f8dcc와 현황77147d83은 재작업하지 않는다.

현재 saveEnvironment는 routes의 ProjectConnectionCandidates로 들어가 ENVIRONMENT_CANDIDATE만 저장한다. 완성형 environment 입력과 실제 host/source/command/Secret 참조는412로 닫힌다. ProjectConnectionDefinitions는 non-null environmentRef의 실제 보호 공급자 부재로 SOURCE_VERIFIER_NOT_CONNECTED412를 유지한다. 한정 대조한 계약·connections·route·generated types·migration에서는 완성형 producer/저장표/고정 reader를 찾지 못했다.

## 2. 정본 원형과 미확정 세부

기존 원형9필드: id,version,sourceRoots,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash.
sourceRoots 항목6필드: sourceRootId,hostId,displayLabel,registeredPathRef,identityRef,permissionScope.

이 필드들을 없애거나 기능 전체를 더 쉬운 후보 모델로 바꾸지 않는다. 다음 세부는 현재 정본에 exact 타입·생산/조회 규칙이 부족하여 아직 구현 기준으로 확정할 수 없다.

| 필드 | 실제 재사용 근거 | 아직 필요한 결박 |
|---|---|---|
| sourceRootId | ProjectSourceRoots.command/read, source_roots/source_root_versions | 어느 source-root full version/hash를 고정하는지 |
| hostId | registerConnector, connectors/connector_registrations, 등록 상태 보호조회 | connector 등록과 source host의 종류/세대/프로젝트 관계 |
| registeredPathRef | db-source-root-version 보호 선언 위치와 source-read snapshot의 canonicalPath가 각각 존재 | 등록경로 ref의 namespace·생산/고정 조회·선언/관측 구분 |
| identityRef | SourceReadProtocol.report→source_snapshots→readSnapshot, volume/fileId/reparse 자료 | 정확 snapshot·root·connector 관계, 보고된 주장/실제 OS 검증 구분 |
| permissionScope | SourceReadScopeV1 읽기 grant, SourceScopeV1 문법·부분집합 | 환경의 원하는 범위와 현재 OS/실행 허가의 별도 판정 |
| executionHostRef | connector 등록 상태 조회 | 실행 host 설정과 실제 호스트 증명의 관계/현재성·회수 |
| targetHostRefs | 후보에 VersionRef 배열 문법만 존재, 값은412 | 시험/배포 target registry·reader·실행 host와의 관계 |
| commandProfileRefs | 후보의 VersionRef 배열 문법만 확인 | 명령 profile 원형·producer·버전 저장·보호 reader |
| secretRefs | 후보의 VersionRef 배열 문법만 확인 | 일반 환경용 보호 참조의 형식·소유·조회·회수 공급자 |
| policyRef | savePermissionPolicy→permission_policies/versions, currentPolicy/read | 현재 정책으로 접근을 검사하면서 저장 당시 정책을 불변 보존하는 규칙 |

source-root는 USER_DECLARED/UNVERIFIED, connector 등록 조회는 REGISTRATION_STATUS_ONLY/grants[], source-read 관측은 CONNECTOR_REPORTED/OS_UNVERIFIED다. 이들을 다른 namespace나 VERIFIED/실행 권위로 조용히 치환하지 않는다. host/source-read 전용 credential은 일반 환경 Secret의 공급자가 아니다. 이 표의 공백은 테스트 이월이 아니라 기능·상세 계약 미완료다.

## 3. 실제 근거 파일

저장소 root 기준이며 사용자/백업 대상 파일이나 실제 키를 조사한 것이 아니다.

- docs/contracts/INTERFACES.md §12.1, docs/work_packages/FUNCTION_WORK.md FN06
- apps/server/modules/projects/routes.ts: saveEnvironment 분기
- apps/server/modules/connections/candidate-input.ts / project-candidates.ts
- apps/server/modules/connections/project-connection-definitions.ts
- apps/server/modules/connections/project-source-roots.ts / db/migrations/0008_source_root_registry.sql
- apps/server/modules/connections/project-registrations.ts / project-registration-reads.ts / db/migrations/0006_host_trust_registrations.sql
- contracts/runtime/source-read-report-v1.ts / source-read-observation-v1.ts
- apps/server/modules/connections/source-read-protocol.ts / source-read-records.ts / db/migrations/0008_source_read_observation.sql
- contracts/runtime/source-scope-v1.ts
- apps/server/modules/access/project-command.ts / db/migrations/0011_authorization.sql

COMMAND_MAP.md는 이 프로젝트 개발·시험 명령표이며 환경 command-profile registry가 아니다. 한도 정책·backup 전용 참조를 command/Secret 공급자로 치환하지 않는다.

## 4. 한 기능을 완성할 작업 단위

아래는 원래 기능을 작게 숨기는 대체안이 아니라 의존성을 분리한 완성 순서다. 상세 계약이 결정되기 전 제품/SQL 구현을 시작하지 않는다.

### EV-A 참조 공급자와 보호 계약

각 참조의 exact namespace/id/version/hash·소유 프로젝트/host·원문·생산 명령/고정 조회·현재성/회수·정책·이력·상한을 먼저 구체화한다. 재사용 가능한 실제 source/connector/관측/정책 producer는 그대로 소비하고 없는 path/identity binding·target host·command profile·일반 Secret 참조의 producer/reader를 실제 기능으로 계획한다.

설정 자료를 저장하는 것과 OS 진위/실행 허가를 분리한다. provenance·미확인 상태를 유지하고, 실제 실행에 필요한 증거가 없으면 후속 실행은 닫힌다. 실제 Secret 원문 생성/조회·보호 저장소 변경은 현재 제외다. 참조 메타데이터의 새 public/data 계약도 정확하게 검토·채택해야 한다.

검수는 producer→불변 저장→고정 보호 reader의 실제 소비, 다른 프로젝트·namespace·hash/세대·회수/기한·정책 실패, 권위 승격 금지를 포함한다. 진위 공급자가 없으면 그 기능을 미구현으로 남기며 bool/stub으로 통과시키지 않는다.

### EV-B EnvironmentVersion 저장·조회

기존 원형9/항목6을 기준으로 입력·생성/수정 CAS·canonical/hash 범위·명령/정책/감사·버전/현재 head/폐기·정확 fixed GET/history·저장량을 확정하고 producer/forward SQL·보호 reader를 구현한다. 현재 접근 정책과 과거 원정책/원자료를 분리한다. replay는 현재 보호 뒤 원결과만 검산하고 fresh 조건을 소급하지 않는다.

없는 참조·틀린 관계를 문자열 패턴만으로 유효 처리하지 않는다. sourceRoots를 모두 빈값으로 만들거나 필수 host를 null로 바꾸어 정상 경로를 만든 것을 전체 구현으로 판단하지 않는다. 일회 승인·호환성/별도 결정이 필요한 부분은 구체적 delta로 고정한다.

### EV-C 화면·연결 정의의 실제 소비

S11의 환경 작성/명시 참조 선택→저장→고정 조회/오류 복구를 연결하고, 실제 환경 reader가 생긴 뒤 ConnectionDefinition의 environmentRef를 같은 Tx/주체의 정확 환경 원형에 결박한다. 원문/임무·buffer·UNKNOWN/영수증·문맥 ABA를 보존한다. sourceRoots/host/profile/Secret이 채워진 정상 사례를 구현·검수한다.

실제 capability 측정·Agent 실행·등록 정의 예약의 실행 준비 전환은 자동으로 열지 않는다. 환경 설정 저장은 실행 허가가 아니며 기존 계획의 실제 연동/인수 미완료를 숨기지 않는다.

## 5. 상세 계약에서 필요한 결정

각 질문은 데이터 형식 선택이 아니라 실제 보호·호환성 의미를 고정하기 위한 것이다.

1. 선언/보고/실측/권한을 각 참조에서 어떻게 표시·검산하고, 어느 증거가 있어야 다음 단계에 사용할 수 있는가.
2. sourceRoots·host·path/identity·target·profile·Secret ref의 exact 형식과 실제 provider를 어떻게 결박하는가.
3. 새 쓰기/고정 조회와 현재 정책·과거 이력·기한/회수·저장량·일회 승인 의미는 무엇인가.
4. 기존 후보 저장 계약을 보존하면서 완성형 saveEnvironment를 구분하는 exact 입력·응답/SQL·UI는 무엇인가.

Main은 구체 delta를 설계하고 독립 검토 후 PMO에 필요한 결정·지원만 요청한다. PMO의 다음 작업 배정을 기다리는 흐름이 아니다. 기존 일반 구현 승인과 새 public/보호/권한 계약 채택을 혼동하지 않는다. 이 문서를 포괄적인 구현 승인으로 사용하지 않는다.

## 6. 현재 실행 경계

현재 산출물은 제품 미구현과 참조 계약 공백의 분석/작업분해다. 완료된 FN09 검사·UI01/03 조사는 반복하지 않았으며 제품/시험/SQL 쓰기·실제 DB/권한/키/서비스/Agent·실사용자/백업 파일 조사0이다. 전체 EnvironmentVersion·FN06·WORK_PLAN은 미완료다.
