# FN06 환경 정의 저장·조회·연결 결박 계약 후보

2026-11-01 / Main 어울 / r4 / ADOPTION_CANDIDATE / NOT_ADOPTED

기존 FN06·설계 §9.2/S11·INTERFACES §12.1의 환경 기능을 구현하기 위한 상세 후보다. 기존 FN09 직접 승인은 이 새 공개·보호 계약의 채택 근거로 사용하지 않는다. 실제 DB·권한·키·서비스·Agent 실행·실사용자/백업 파일 조사는 제외한다.

## 1. 권장안과 대안

A안(권장): 기존 SourceRoot·connector 등록·snapshot·정책 공급자를 재사용하고, 없는 host 선언·명령 profile·비밀 참조 metadata만 생산/불변 저장/보호 조회로 보완한다. 환경을 정확 버전으로 저장·재조회하고 ConnectionDefinition이 실제 환경 reader를 소비한다. 설정 저장은 선언 기능이며 실제 관측·실행 가능 판정과 분리한다.

B안: 기존 후보 저장만 유지하고 전체 환경 기능을 미구현으로 남긴다. 새 계약은 줄지만 사용자 환경 정의·실제 참조 결박이 완성되지 않는다. 이를 FN06 완료로 보고할 수 없다.

모든 종류의 host/path/identity를 별도 registry로 다시 만드는 방식은 기존 자료 중복과 권한 확장을 늘리므로 권장하지 않는다.

## 2. 원형과 참조 의미

Ref는 기존 exact {id,version,contentHash}다. UUID/양의 safe integer/소문자 SHA256 문법과 실제 생산자·프로젝트·부모 관계를 함께 검사한다. 같은 UUID로 namespace를 추정하거나 다른 종류 reader로 fallback하지 않는다.

- ConnectorStatusRef: exact {kind:'CONNECTOR_STATUS',connectorRef:Ref,registrationRef:Ref}. 신규 wrapper이며 내부 Ref는 기존 producer 그대로다. connector version은 generation, registration version은 등록 상태 개정이다. hash는 각각 기존 connectorRef()/registrationRef() 원형으로 검산하고 두 version이 같다고 가정하지 않는다.
- HostDeclarationRef: exact {kind:'HOST_DECLARATION',ref:Ref}.
- HostRef: 위 두 종류의 닫힌 합집합.
- PathRef: exact {kind:'SOURCE_ROOT_DECLARATION',sourceRootRef:Ref,hostRef:HostRef} 또는 {kind:'SOURCE_SNAPSHOT_ROOT_PATH',snapshotRef:Ref,hostRef:HostRef}.
- IdentityRef: exact {kind:'SOURCE_SNAPSHOT_ROOT_IDENTITY',snapshotRef:Ref} 또는 null.
- CommandMetadataRef: exact {kind:'COMMAND_PROFILE_METADATA',ref:Ref}.
- SecretMetadataRef: exact {kind:'SECRET_REFERENCE_METADATA',ref:Ref}.

EnvironmentVersion은 기존 exact9를 유지한다:
{id,version,sourceRoots,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash}.
contentHash는 자기 필드를 제외한 나머지8필드의 기존 canonical hash다.

sourceRoots 항목은 exact6:
{sourceRootId,hostId,displayLabel,registeredPathRef,identityRef,permissionScope}.
sourceRootId/hostId는 UUID, displayLabel은 1~200자다.
permissionScope는 exact {kind:'REQUESTED_SCOPE',targets:[{relativePath,kind:'FILE',access:'READ'|'WRITE',recursive:false}]}다. 기존 상대경로 문법·대소문자 중복 제한을 재사용한다. 이는 원하는 범위이며 관측 READ_ATTRIBUTES grant나 OS 쓰기 권한이 아니다.

sourceRoots 1~200, 전체 targets 1~200, targetHostRefs 0~200, commandProfileRefs 1~200, secretRefs 0~200을 제안한다. 각 종류에서 같은 실제 id 중복은 금지한다. 대상·비밀 참조가 필요 없는 환경의 빈 배열은 정당하지만 빈값만 소비하는 구현으로 전체 기능을 대체하지 않는다.

소스 선언은 실제 SourceRoots.read의 fullref·프로젝트를 검산한다. sourceRootId는 선언 또는 snapshot이 결박한 sourceRootRef.id와 일치해야 한다. hostId는 HostRef가 가리키는 실제 connector 또는 host 선언 id다. 선언에 connectorId가 있으면 동일 connector 관계를 검사한다. connectorId=null이면 배치 관계는 사용자 선언으로만 남긴다.

snapshot은 기존 version1을 유지한다. 실제 readSnapshot과 grant 보호조회에서 sourceRootRef·connectorRef·registrationRef·프로젝트를 대조한다. 경로·identity 근거는 report.root.state='OBSERVED'와 facts가 있어야 하며 둘을 함께 지정하면 같은 snapshot이어야 한다. 여전히 CONNECTOR_REPORTED/OS_UNVERIFIED다. identity=null인 선언 저장은 허용하되 해당 값으로 실행 준비는 통과하지 않는다.

## 3. 신규 metadata 세 종류

공통 저장 원형은 exact {id,version,status,definition}, status는 DECLARED|REVOKED다. Ref hash는 이 원형 전체의 canonical hash다. 프로젝트·작성 주체·원명령·원정책·영수증·감사는 별도 보호 wrapper로 결박한다. 개정/회수는 새 불변 버전을 만들고 과거 원형을 변경하지 않는다.

Text(n)은 well-formed Unicode 1~n UTF-16자·제어문자 금지다. Identifier80은 [A-Za-z][A-Za-z0-9_.-]{0,79}. 표시값을 URI·명령·실경로로 해석하지 않는다. 알려진 비밀 표식 검사를 기존 방식으로 적용하되 완전한 탐지라고 주장하지 않는다.

### 3.1 Host 선언

definition exact {label,hostKind,parentHostRef,endpointLabel,policyRef}.
- label Text200, hostKind MACHINE|WSL_DISTRIBUTION|REMOTE_TARGET.
- MACHINE은 parentHostRef=null, endpointLabel은 null 또는 Text200.
- REMOTE_TARGET은 parentHostRef=null, endpointLabel Text200.
- WSL_DISTRIBUTION은 parentHostRef와 배포판 표시 endpointLabel Text200 필수.
- WSL의 parentHostRef는 ConnectorStatusRef 또는 정확 MACHINE 선언 ref만 허용한다. WSL/remote의 중첩 부모·순환은 금지한다. 이는 Main 권장 보완으로, 등록 전에도 원하는 구성을 정의할 수 있게 한다.
- endpointLabel은 사용자 식별 표시이며 접속 주소·비밀·credential 경로가 아니다.
기존 connector로 표현되는 host는 동일 공급자를 사용한다. 선언은 신원 확인·서비스 생성·원격 접속을 수행하지 않는다.

### 3.2 명령 profile

definition exact {label,purpose,hostRef,toolRequirements,program,argsTemplate,workingDirectory,secretSlots,policyRef}.
- label Text200, purpose Text2000, hostRef HostRef, program Text200.
- toolRequirements는 1~20개의 exact {product:Text200,versionRequirement:Text200}; product 중복 금지. 버전 요구 문자열은 설치/호환성 검증 결과가 아니다.
- argsTemplate은 0~200개. exact {kind:'LITERAL',value:0~4096자 문자열} 또는 {kind:'SECRET_SLOT',name:Identifier80}. 모든 문자열은 well-formed/제어문자 제한을 적용한다.
- workingDirectory exact {sourceRootRef:Ref,relativeDirectory:null|상대 디렉터리 표시}. null은 source root 자체다. 기존 상대경로 제한을 재사용하고 절대경로/..를 금지한다.
- secretSlots는 0~50개의 exact {name:Identifier80,secretRef:SecretMetadataRef}; 이름 중복 금지. SECRET_SLOT 참조와 정의는 누락·불필요 항목 없이 대응해야 한다.
이 단계는 프로그램 실행·shell 해석·도구 탐색·인자 치환을 하지 않는다. 실제 비밀값을 LITERAL로 받는 기능이 아니다.

### 3.3 일반 비밀 참조 metadata

definition exact {label,hostRef,providerKind,logicalName,purpose,policyRef}.
label Text200, hostRef HostRef, providerKind='EXECUTOR_MANAGED', logicalName Identifier80, purpose Text2000.
이는 원하는 보관 방식과 논리명을 선언하는 기능이다. 실제 provider 존재/보호 저장소 접근/Secret 가용성은 UNVERIFIED다. 토큰·비밀값·credential 파일 경로·vault locator를 받지 않으며 기존 host/source-read/backup 전용 credential을 재사용하지 않는다.

metadata의 host·소스·비밀 슬롯 참조와 환경에 선택된 참조의 관계를 같은 Tx에서 실제 reader로 검산한다. 다른 host/project의 명령·Secret을 문자열이 맞는다는 이유로 소비하지 않는다.

## 4. 명령·호환성과 승인

기존 ProjectCommand envelope와 현재 로그인·OWNER·단독 제어·재인증·명시 정책·AUTO/DENY/REQUIRE_APPROVAL·원명령 hash·일회 소비/영수증/감사를 재사용한다. 새 operation과 read 정책은 정확 allowlist delta로 채택해야 하며 실제 사용자 정책을 자동 부여하지 않는다.

신규 쓰기6:
saveEnvironmentHostDeclaration / revokeEnvironmentHostDeclaration
saveCommandProfileMetadata / revokeCommandProfileMetadata
saveSecretReferenceMetadata / revokeSecretReferenceMetadata

각 save payload exact {definition,baseRef,reason}. 최초 targetId=null/expectedVersion=0/baseRef=null, 개정은 정확 baseRef·target/expected CAS. revoke payload exact {baseRef,reason}, 새 REVOKED 버전에 기존 definition을 보존한다. 다른 namespace·후속 세대·서로 다른 payload의 원명령 재사용은 거절한다.

saveEnvironment는 기존 operation을 유지한다. 새 완성형 payload는 exact {environment,baseRef,reason}, environment 입력은 서버 생성 id/version/contentHash를 제외한6필드다. 최초/개정 CAS는 위와 같다. 기존 ENVIRONMENT_CANDIDATE 입력/응답/namespace/승인 의미는 그대로 보존하며 모호한 혼합 payload는 거절한다.

baselineRefs:[], 승인 scope environmentRef:null/sourceScopes:[]/limitsRef:null은 기존 설정 명령 의미를 유지한다. 실제 설정 참조는 완성형 원 payload 전체의 payloadHash에 결박한다. 새 metadata operation의 대상 proof·승인 allowlist는 별도 추가하며 후보의 승인으로 상속하지 않는다.

이번 범위에 EnvironmentVersion 자체 삭제/회수 명령을 새로 만들지 않는다. 과거 버전은 보존하고 참조 개정/회수·정책/접근의 현재 영향은 별도 가용성으로 표시한다. 향후 환경 회수 기능이 필요하면 그 의미를 별도로 정의한다.

## 5. 고정 조회·현재성과 정의 결박

각 프로젝트 /api/v1/projects/:projectId 아래 신규 fixed GET:
- /environment-host-declarations/:id/versions/:version
- /command-profile-metadata/:id/versions/:version
- /secret-reference-metadata/:id/versions/:version
- /environments/:id/versions/:version

선택용 유한 페이지 목록과 cursor를 각 종류에 추가하는 안이며 actor/project/종류/필터에 결박한다. 정확 URL/query/응답 error 목록은 구현 WI 전에 고정한다. 현재 OWNER와 종류별 명시 읽기 정책을 검사하고, 단순 조회에 제어권 보유를 요구하지 않는다. 일반 목록에 실제 경로·내부 주소·비밀 원문을 노출하지 않는다.

fixed 결과는 ref·저장 당시 원형·headVersion·원명령/이력 증빙과 현재 가용성을 분리한다. 과거 ref의 원hash를 현재 head hash로 바꾸지 않는다. 현재 정책은 접근에, 저장 당시 정책/ref는 불변 원증빙에 사용한다. 신선한 쓰기는 현재 head/회수 상태/부모 관계를 검사한다. replay는 현재 보호 뒤 원명령·원결과를 검산하고 최신 head·새 관측을 소급하지 않는다.

기존 RegistrationReads의 원요청자/client/현재 제어 제한을 넓히지 않는다. 환경 역사 조회를 위해 저장 시 검산한 최소 ref/프로젝트/부모 관계 증빙을 보존하고 원증빙에서 무결성을 재검산하는 보호 projection이 필요하다. 현재 등록 상태를 읽을 권한이 없으면 그 상태는 미확인으로 남긴다. 증빙 exact 원형·보호 reader는 후속 상세 확정 대상이며 성공 callback으로 대체하지 않는다.

ConnectionDefinition 새 저장은 non-null environmentRef의 실제 환경 reader를 같은 Tx/주체로 호출해 프로젝트/fullref/hash와 현재 head/참조 가용성을 검사한다. 과거 정의 조회·replay에 fresh 조건을 소급하지 않는다. connector/account/capability의 다른 기존412를 함께 해제하지 않고 NOT_READY·실행 false를 유지한다.

## 6. 저장량·검수와 남은 확정 사항

상한 권장안은 환경+신규 metadata 네 종류 합계 1000개 head/10000버전/64MiB canonical bytes이며, 기존 프로젝트10GiB·지속 예약 원장과 함께 합산한다. 기존 자료를 중복 계산하거나 새 자료를 누락하지 않는 연결을 구현 전에 고정한다. 자동 삭제·기존 프로젝트 차단 해제는 하지 않는다.

검수는 실제 metadata 생산→불변 저장→환경 생산/고정 조회→ConnectionDefinition 소비를 합성 Tx에서 연결한다. 후보/종류 충돌·다른 프로젝트/host·원hash/세대·관측 누락·정책/만료/회수·CAS/replay/일회승인·상한·UNKNOWN/UI 늦은 결과 반례를 확인한다. SQL은 미적용이며 합성/정적 증거를 실제 PG/권한/경합/App/Agent 합격으로 승격하지 않는다.

아직 결정 요청 가능한 최종 exact 계약은 아니다. 다음을 보완해 독립 재검토한다:
1. 새 명령/읽기 정책의 정확 이름·분류와 approval scope 대상 proof.
2. 목록/query·fixed 결과/보호 원증빙·현재 가용성/error DTO.
3. 상한의 기존 원장 합산/회수 accounting와 원형/현재 정책의 보호 projection.
4. 화면 필드·부모 원명령 ACK→POST→receipt/fixed GET·UNKNOWN·ABA 동작 및 허용 파일.

원형/새 metadata/API/보호 의미의 채택 뒤에만 정확 WI를 고정하고 기존 Primary에게 TDD 구현을 맡긴다. 이 후보 작성은 작업계획 완료나 제품 기능 진도가 아니다.

## 7. S11 환경 작성·조회 화면 상세 초안

기존 ConnectionsPage 안에 환경 설정 패널을 연결한다. 기존 후보 작성·연결 정의·등록/소스 관측/권한 화면을 교체하지 않는다.

화면 배치:
- 상단: 환경 버전 선택 목록 / 새 환경 작성 / 현재 선택 버전·hash / 선언 저장 상태.
- 본문 첫 영역: 소스 목록. 기존 소스 선언을 보호 목록에서 선택하고 host·표시명·선언 경로 ref·선택 관측 ref·요청 READ/WRITE 상대경로를 행 단위로 편집한다. identity 관측이 없으면 ‘관측 없음’을 표시한다.
- 본문 둘째 영역: 실행 host 1개, 시험/배포 대상 host 목록. 각 선택에 ‘등록 상태 참조’ 또는 ‘사용자 선언’ 출처를 표시한다. Windows/WSL/원격 역할을 표시하되 경로 자동 변환은 하지 않는다.
- 본문 셋째 영역: 명령 profile·비밀 참조 metadata 선택 목록. 비밀값 입력칸·탐색 버튼·실행 버튼은 만들지 않는다. 필요한 신규 metadata 작성은 같은 패널의 별도 편집 영역에서 처리한다.
- 하단: 변경 이유 / 현재 정책 ref / 원명령 준비 / 필요한 일회 승인 작성·별도 결정 확인 / 저장 또는 같은 원명령 결과 재확인.
- 조회 영역: 저장 당시 원형·선택한 정확 버전·이력과 현재 참조 상태를 구분한다. ‘실행 가능’ 표시로 바꾸지 않는다.
- 연결 정의 영역: 보호 조회한 환경 버전을 명시 선택해 environmentRef에 결박한다. 다른 connector/account/capability 참조의 기존 차단은 유지한다.

신규 host/명령/비밀 metadata 편집은 §3 필드에 대응하는 이름 있는 폼·반복 행·보호 선택을 사용한다. 임의 JSON만 입력하게 하는 화면으로 완료를 대신하지 않는다. 현재값을 보호 조회할 권한이 없으면 선택 불가/미확인 사유를 표시하고 값을 조작해 채우지 않는다.

부모가 원명령을 보관했다는 ACK를 받은 후에만 POST한다. POST 전 준비/정책/선택 조회 실패는 초안 편집을 유지한다. 실제 POST 이후 결과 불명은 원 commandId/payload를 보존하고 새 명령 자동 생성·재전송을 하지 않는다. 영수증이 있으면 후속 fixed GET 실패와 저장 실패를 구분한다. 사용자/client/project/transport·로그인 세대·화면 요청이 달라진 늦은 응답은 거절한다.

이 화면 초안은 source-only 구현을 위한 기준 제안이다. 실제 App/브라우저·사용자 인수 검증은 실행하지 않았다.

## 8. r2 보완 — 정확 조회·승인·역사 증빙·용량 연결

r1의 §6 미정1~3은 아래 권장 계약으로 구체화한다. §7은 화면 기준이다. 여전히 NOT_ADOPTED이며 세부 SQL 함수/OID와 허용 파일은 채택 후 WI에서 고정한다.

### 8.1 읽기 정책과 승인 대상 proof

신규 읽기 operation은 readEnvironmentHostDeclaration, readCommandProfileMetadata, readSecretReferenceMetadata, readEnvironmentVersion 네 개다. 각 종류의 목록/fixed GET에 동일하게 적용한다. 현재 OWNER와 유효한 명시 AUTO를 요구하고 DENY·읽기 REQUIRE_APPROVAL은 닫는다. 실제 사용자 정책을 자동 생성/부여하지 않는다.

신규 쓰기6은 기존 ProjectApprovals 소비 allowlist에 정확 추가한다. saveEnvironment는 이미 후보 쓰기 operation에 포함돼 있으므로 이름을 바꾸지 않는다. 요청·별도 결정·authorize 단계에서 같은 대상 proof를 사용한다:
- 최초 save: target null/expected0/baseRef null.
- 개정/회수: 정확 namespace/project/baseRef/hash·현재 head·미회수 상태.
- 완성형 환경: 후보와 닫힌 분기로 구분한 환경 대상 proof.
저장에서는 선택 참조·부모 관계와 proof를 다시 검산하고 기존 receipt→audit→일회 소비를 연결한다. 소비 후 replay에는 현재 보호·원 consumption/명령 hash를 검사하고 fresh head를 소급하지 않는다. 원 payload hash 전체 결박과 baselineRefs[]/environmentRef null/sourceScopes[]/limitsRef null은 §4를 유지한다.

### 8.2 목록·고정 조회와 오류

§5의 네 collection에 목록 GET을 추가한다. query는 limit?/cursor?만 허용한다. limit은 정수문자열1~200/기본50, cursor는 기존4096자 이하다. 생성시각 내림차순/id 내림차순이며 cursor를 actor/client/project/collection/현재 읽기정책 ref/limit에 서명 결박한다. 목록은 동일 snapshot 보장이 아니며 observedAt을 표시한다.

목록 결과 exact:
{projectId,kind,items:[{ref,label,status}],hasMore,nextCursor,observedAt}.
kind는 ENVIRONMENT_HOST_DECLARATION|COMMAND_PROFILE_METADATA|SECRET_REFERENCE_METADATA|ENVIRONMENT_VERSION의 닫힌 값이다. metadata label/status는 원형대로, 환경 label/status는 null이다. 환경은 id/version과 선택 소스 표시로 구분한다. 목록에 경로·프로그램 인자·비밀 논리명·등록 scope를 노출하지 않는다.

fixed GET은 query0, UUID/양의 safe version을 검사한다. 결과 exact:
{projectId,kind,ref,snapshot,historyVerification,current,executionEligible,dispatchPerformed,observedAt}.
historyVerification='STORED_CONFIGURATION_VERIFIED', executionEligible=false, dispatchPerformed=false.
current exact:
{headVersion,configurationCurrentness,issues,checkedAt}.
configurationCurrentness는 MATCHED|CHANGED|UNAVAILABLE. issues는 {code,target} 배열이며 target은 비밀 없는 정확 typed ref 또는 null이다. code는 HEAD_CHANGED|REFERENCE_REVOKED|REFERENCE_CHANGED|POLICY_CHANGED|CURRENT_REFERENCE_UNAVAILABLE|OBSERVATION_UNVERIFIED로 제한한다.
이 값은 설정/참조의 보관 무결성과 현재 상태만 나타낸다. OS 검증·실행 적합성이나 등록 전이 전체 검증을 뜻하지 않는다. 관측 미확인은 current 이슈와 화면에 드러내되 설정 저장 자체를 막지 않는다.

현재 접근 실패는 원문을 반환하지 않는다. 접근은 허용되나 현재 참조 상태를 읽을 수 없으면 과거 snapshot과 UNAVAILABLE을 구분한다. 과거 ref/hash를 현행 head로 바꾸지 않는다.

기존 오류 envelope exact6(code,message,requestId,targetId,retryDisposition,details)는 그대로다. 신규 업무 오류는 422 ENVIRONMENT_INPUT_INVALID, 409 ENVIRONMENT_VERSION_CONFLICT, 412 ENVIRONMENT_REFERENCE_UNAVAILABLE, 429 ENVIRONMENT_STORAGE_LIMIT_REACHED, 503 ENVIRONMENT_INTEGRITY_FAILED로 고정한다. 기존401/403/404/413은 그대로 유지한다. 다른 프로젝트/namespace의 조회는 NOT_FOUND404로 숨긴다. POST 판독불가·503·연결 유실은 UNKNOWN이며 자동 재전송하지 않는다. 화면에서는 status/code/envelope의 닫힌 조합을 대조하고 모순/부분 응답은 명확 거절로 낮추지 않는다.

### 8.3 등록 관계의 저장 당시 증빙

기존 RegistrationReads 보호를 넓히지 않고 저장 시 실제 보호조회 성공으로 얻은 다음 최소 projection을 보존한다:
{connectorRef,registrationRef,projectId,connectorId,registrationId,connectorGeneration,registrationVersion,registrationState,scopeProjection,scopeDigest,createdCommandProof,authorizationReceiptProof,auditProof,capturedAt,contentHash}.

scopeProjection은 기존 trustScopeProjection의 정확 원형이며 host/source 관계를 검산한다. contentHash는 자기 필드 제외 projection의 canonical hash다. 두 Ref는 기존 각 producer 함수로 검산하며 generation과 상태개정 동일성을 가정하지 않는다.

createdCommandProof는 원명령 server ID·외부 commandId·operation·requestHash와 비밀 없는 resultRef hash의 결박만 보존한다. authorizationReceiptProof/auditProof는 그 명령·주체/client/project·정책·APPLIED 결과에 해당하는 최소 원필드/원행 hash를 보존한다. 임의 raw resultRef/영수증/감사 JSON 전체를 반환하지 않는다. 정확 필드 allowlist와 hash 검산 함수는 WI 전에 source 대조로 고정한다. 코드·token·credential·public key 원문은 이 증빙에 포함하지 않는다.

원 등록 request의 reason 등을 복원해 전체 requestHash를 재계산할 수 있다고 확인하지 못했으므로 그렇게 주장하지 않는다. 이 증빙은 환경 저장 당시 실제 보호 조회가 검산한 관계를 환경 원명령·영수증·감사와 함께 불변 보관한 자료다. 등록 과거 상태 전이 전체나 현재 host 신뢰를 새로 보증하지 않는다. 환경 역사조회는 이 제한된 증빙의 무결성을 검산하고, 현재 등록 조회의 원client/제어 조건을 충족하지 못하면 현재 상태만 UNAVAILABLE로 표시한다.

### 8.4 기존 용량 원장과의 합산

기존 quota_complete가 대조하는 SETTLED 사용량과 RESERVED/IO_STARTED/UNKNOWN 예약량을 유지한다. 환경 metadata를 ARTIFACT/CHECKPOINT로 위장해 새 예약을 넣지 않는다.

같은 프로젝트 부모 잠금과 VERIFIED 원장 검산 아래 총량을 다음과 같이 계산하는 계약이다:
기존 used+held + 연결 정의 전체 canonical bytes + 등록 정의 HUMAN 보고 canonical bytes + 환경/신규 metadata 네 종류 전체 버전 canonical bytes + 새 보존 증빙 projection bytes ≤ 10GiB.

네 종류의 1000head/10000버전/64MiB 제한에는 회수 버전·새 보존 증빙 bytes를 포함한다. 기존 SourceRoot/connector/snapshot/정책 원문을 복사하지 않은 참조는 다시 청구하지 않는다. 새 복사 projection은 한 번만 청구한다. 논리 회수는 원문 삭제가 아니므로 bytes 환급0이다.

환경 자료가 있는 프로젝트의 이후 정의·보고·account/reservation 변경도 같은 총량을 보호해야 한다. 기존 capacity의 agent_connections 부재 조기RETURN은 새 환경 자료도 없을 때만 기존 의미를 유지한다. 환경만 존재하는 프로젝트를 합산에서 누락하지 않는다. 관련 없는 기존 프로젝트에 새 거절을 퍼뜨리거나 UNVERIFIED 원장을 자동 VERIFIED로 바꾸지 않는다.

### 8.5 구현 지시 전 마지막 고정 항목

위 계약의 채택 여부를 묻기 전 최소 증빙 proof의 exact allowlist/hash 검산과 issue target/ref의 응답 원형을 독립 검토한다. 후보의 public/data/보호 delta를 채택한 뒤 WI에서 정확 허용파일·forward SQL/trigger chain·TDD·한정 인접회귀를 고정한다. 실제 DB·사용자정책·키·파일조사·서비스·Agent 실행은 계속 제외한다. 이 후보를 implementation GO로 사용하지 않는다.

## 9. r3 원증빙·응답 세부 고정

§8.3의 세 proof는 다음 exact 필드만 보존한다. 원 행의 다른 필드나 raw JSON 전체를 묵시적으로 복사하지 않는다. 각 proof의 contentHash는 자기 필드 제외 canonical hash이며 이 hash는 원 요청 전체 재구성 검증을 뜻하지 않는다.

- createdCommandProof:
{id,projectId,actorId,clientId,operation,externalCommandId,operationId,state,expectedVersion,controlGeneration,policyRef,requestHash,resultHash,authorizationReceiptId,approvalConsumptionId,completedAt,contentHash}.
operation은 registerConnector, state는 APPLIED다. resultHash는 원 result_ref canonical hash이며 원 result_ref 자체를 projection에 복사하지 않는다.
- authorizationReceiptProof:
{id,scopeKind,scopeId,commandId,subjectRef,policyRef,scopeDigest,approvalDecisionId,authorizedAt,contentHash}.
scopeKind는 PROJECT, scopeId는 같은 project다. subjectRef는 기존 원형 그대로 보호 검산하며 원명령 actor/client와 일치해야 한다. approvalDecisionId는 실제 원자료대로 UUID 또는 null이다.
- auditProof:
{projectId,serverSequence,eventId,actorRef,clientId,commandId,operationId,targetRef,policyRef,approvalRef,outcome,reasonCode,scopeDigest,recordedAt,sourceKind,correctionOf,contentHash}.
outcome은 APPLIED다. 원명령·프로젝트·주체/client·정책·target이 기존 생성 감사의 의미와 맞아야 한다. 해당 생성 감사는 정확1행이어야 하고 부재/다중/불일치면 무결성 실패다. 반례 시험에서 정당한 다른 감사 이벤트를 잘못 생성 감사로 수용하지 않는다.

이름 변경은 저장 projection에서만 적용한다. 실제 공급자는 commands.id/project_id/actor_id/client_id/operation/command_id/operation_id/state/expected_version/control_generation/policy_ref/request_hash/result_ref/authorization_receipt_id/approval_consumption_id/completed_at, authorization_receipts의 기존9필드(추가 contentHash 포함 projection10필드), audit_events의 기존 필드다. bigint는 기존 API 규칙과 동일한 유한 decimal 문자열로, 시각은 ISO UTC로 정규화한다. nullable 원필드는 임의 값으로 채우지 않는다. 기존 생성 경로에서 실제 성립하는 nullable 조합·subject/target ref는 구현 전 코드/fixture 대조로 닫고 시험한다.

scopeProjection은 trustScopeProjection의 exact 결과:
{kind,installationId,projectId,subject:{kind,userId,clientId,credentialGeneration,controlGeneration},policyRef,expectedHostFingerprint,hostLabel,expiresAt,credentialScope,grants}.
kind=HOST_TRUST_REGISTRATION, credentialScope=REGISTRATION_STATUS_ONLY, grants=[]를 유지한다. 소스의 기존 hash식과 연결 생성 결과/영수증/감사를 함께 검산한다. capture된 registrationState/세대와 별개인 현재 상태는 원형을 덮어쓰지 않는다.

저장된 projection의 과거 조회는 환경 접근 정책 아래 서버 내부에서 원명령·원행/보관 projection의 무결성을 검산하는 새 보호 소비다. 기존 등록 상태 GET의 권한 자체는 변경하지 않는다. 이 신규 내부 소비와 OWNER 환경 역사조회 허용을 채택 대상 보안 delta에 명시한다. 현재 host 신뢰·원credential 가용성·과거 상태 전이 전체 검증은 제공하지 않는다.

§8.2 issue.target은 null 또는 exact {kind,ref}다. kind는 ENVIRONMENT_VERSION|HOST_DECLARATION|COMMAND_PROFILE_METADATA|SECRET_REFERENCE_METADATA|SOURCE_ROOT_DECLARATION|SOURCE_SNAPSHOT|CONNECTOR_STATUS|PERMISSION_POLICY. ref는 실제 해당 공급자의 Ref이며 connector의 version 의미를 유지한다. reason 원문·경로·주체/credential 상세를 issue에 넣지 않는다.

configurationCurrentness의 우선순위는 현재 참조/상태 조회가 불가능하면 UNAVAILABLE, 가능한 범위에서 head/회수/정책/선택 참조 변화가 있으면 CHANGED, 설정 참조가 같으면 MATCHED다. OBSERVATION_UNVERIFIED만 존재하는 경우 MATCHED와 함께 표시할 수 있으며 OS 검증/실행 허가를 뜻하지 않는다.

명령 profile의 workingDirectory.sourceRootRef와 secretSlots의 ref는 환경에서 선택한 정확 sourceRootRef/secretRefs에 포함돼야 한다. 선택 host와의 관계도 검산한다. 필요한 슬롯이나 ref가 없는 상태를 빈 배열로 대체하지 않는다. 동종 id 중복·서로 다른 부모·이름만 같은 참조는 거절한다.

이 r3는 공개/보호/저장 계약의 채택 후보이며 구현 실행안이 아니다. 검토 지적을 보완한 뒤 PMO에 A/B의 차이와 정확 source-only 채택 범위를 전달한다.

## 10. r4 사실 대조 보정과 결정 대상

기존 Primary와 독립 Reviewer의 실제 생산형 대조로 다음을 고정한다. §9의 미정 nullable/생성 감사 의미는 이 절을 따른다.

- 생성 감사 target은 최초 registrationRef(version1,state CREATED)다. connectorRef나 현재 상태개정 ref로 바꾸지 않는다. 같은 project/command에 sourceKind=HUMAN_COMMAND, reasonCode=EXPLICIT_STATUS_ONLY_HOST_REGISTRATION, outcome=APPLIED, correctionOf=null을 만족하는 정확 원행1개를 검산한다.
- receipt.subjectRef는 exact {kind:'HUMAN',userId,clientId}, audit.actorRef는 exact {kind:'HUMAN',userId}다. 생성 경로의 policyRef/commandId/operationId/client/target/scopeDigest는 non-null이다. AUTO는 command.approvalConsumptionId/receipt.approvalDecisionId/audit.approvalRef가 모두 null이고, 일회승인은 원 소비행·결정·승인 객체와 각각 실제 관계를 검사한다.
- resultHash는 저장된 commands.result_ref의 canonical hash다. 일회코드를 포함한 최초 HTTP 반환을 hash하지 않는다. 저장본 oneTimeCode=null을 검산하고 코드·secretDisposition을 proof로 복사하지 않는다.
- registration scopeDigest와 receipt/audit scopeDigest는 다른 원형의 hash다. 각각 기존 producer 규칙으로 검산하고 서로 같다고 요구하지 않는다.
- 용량에서 환경/metadata canonical bytes는 원형 bytes만, 별도 증빙 bytes는 wrapper의 추가 projection만 한 번 합산한다. 동일 projection을 두 계산에 넣지 않는다. 기존0067 함수/호출선과 서버 정의/보고 사전계산을 함께 보완하며 기존 SQL을 고쳐 적용하지 않는다.

결정 요청 범위는 A안의 신규 metadata3·환경 버전 저장/조회·기존 연결 정의의 환경 ref 소비를 위한 상세 계약과 코드·화면·새 미적용 forward SQL·합성 검증이다. 공개 명령/읽기정책/내부 보호 projection·유한 상한 delta는 이 후보에 명시한 내용이다. 실제 사용자 정책 부여·DB 적용·권한/키/서비스/실Agent 실행·실자료 조사·현재 프로젝트 차단 해제는 포함하지 않는다.

Main은 채택 후 정확 허용 파일/원형/필수 한정검증/복구를 WI로 고정하고 기존 Primary 단일 writer에게 지시한다. 이 문서가 채택되더라도 source-only 검수를 실제 연결/전체FN06/계획 완료로 보고하지 않는다.
