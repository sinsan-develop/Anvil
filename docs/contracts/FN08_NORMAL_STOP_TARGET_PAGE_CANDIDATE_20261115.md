# FN08 normal 중지 대상 준비·자료 없는 페이지 후보 A

상태: 미채택. 현재 SEND polling 구현과 독립된 다음 계약 후보다. 기존 REQUEST_STOP·normal grant 회수·P3 승인과 달라지는 두 항목만 제안한다. 실제 DB/권한/키/서비스/SDK·Agent 실행은 포함하지 않는다.

## 1. 차이와 대안
현재 합성 STOP은 stopScopeRef를 받아 형상/동일성만 검산한다. normal 생산자와 요청 전 조회가 없으며 normal command page는 START/SEND 자료 descriptor만 허용한다. 따라서 callback ref나 빈 가짜 manifest를 정상 근거로 사용할 수 없다.
A 권장: 현재 유효한 원 EXECUTION grant·원 HUMAN 5tuple을 유지하는 협력적 중지 요청의 준비 조회와 자료 없는 STOP 형상만 추가한다. 변경 규모가 작지만 grant 회수·만료 후에는 사용할 수 없다.
B: 별도 RECOVERY grant/credential·경로로 회수·만료 뒤에도 중지를 전달한다. 기존 dispatch 제안서 §6을 재활용하지만 새 권한 생산·교환 계약이 필요해 이번 A에 포함하지 않는다.

## 2. 중지 대상의 읽기 전용 준비
제안 GET `/api/v1/projects/:projectId/executions/:executionId/stop-target`, 닫힌 query `{generation,grantId,grantVersion,grantHash}`. HUMAN 로그인만 허용하고 connector Bearer·본문·추가 query는 거절한다. 현재 프로젝트 회원/제어·원 grant의 userId/clientId/humanSessionId/credentialGeneration/controlGeneration exact 및 이번 GET의 새 조회 권한 규칙을 다음으로 채택 제안한다. 원 grant/fact의 permissionPolicyRef·intent.budgetPolicyRef/sourceScopes를 정책 선택값으로 고정하고 기존 requestExecutionStop 정책 검사와 같은 현재 head exact/만료 조건을 읽기 전용으로 대조한다. PROJECT budget과 원 sourceScopes도 같은 정책 선택 근거에 포함한다. 원 정책이 개정됐으면 새 정책을 자동 선택하지 않고 거절한다. DENY/REQUIRE_APPROVAL은 기존 거절을 유지하며 승인 소비·새 정책 부여·명령 저장을 하지 않는다. 이 GET 조회 권한이 이미 구현돼 있다는 뜻은 아니다.

서버는 원 저장 grant/원 START command·HUMAN receipt·audit·outbox graph, 등록, 원 논리 session·role binding·binding generation과 normal current/ownership의 저장 근거를 재조회한다. 원 START의 과거 OS ref를 현재 소유 증거로 대체하지 않는다. 외부 current callback은 후보일 뿐이며 기존 normal permit의 current 검산 경계와 원 저장 관계를 다시 검산한다. 기존 permit의 fact.checks.osFence.evidenceRefs 포함 검사는 원 근거 일치 검사일 뿐 현재 ownership head 생산/조회가 아니다. ownershipRef는 원 execution/등록에 결박된 검증된 현재 ownership head의 원 observation fullref로만 선택한다. 그 저장 reader·계보/current 검산 공급자가 없으면 412로 닫고 임의 callback으로 대체하지 않는다. 구현 지시에는 실제 존재하는 reader와 검산 필드를 고정하며, 새로운 저장 권위가 필요하면 별도 delta로 분리한다. PID/SDK SID 또는 임의 JSON을 근거로 만들지 않는다.

준비 결과의 닫힌 target snapshot 제안:
`{kind:'NORMAL_STOP_SCOPE_V1',projectId,executionId,executionGeneration,grantRef,parentStartCommandRef,parentStartEnvelopeHash,executorRegistrationRef,sessionBindingRef,roleBindingRef,bindingGeneration,ownershipRef,mode:'COOPERATIVE_REQUEST_ONLY',forceKillAllowed:false}`.

별도 표/발급 권한을 만들지 않는 결정적 참조: stopScopeRef.id는 namespace=원 START commandId, name=target snapshot의 canonical JSON으로 계산한 UUIDv5이며 version=1, contentHash=SHA256(canonical JSON)이다. UUID는 식별자일 뿐 권한 증명이 아니다. 원 snapshot 내용과 저장 관계의 exact 검산이 필수다. 읽기 시각·만료는 이 식별 snapshot 밖에 둬 같은 현재 대상의 반복 조회가 새 권위를 만들지 않게 한다.

응답은 `{transport:'NORMAL_PROTECTED',grantRef,sessionBindingRef,stopScopeRef,target,checkedAt,expiresAt,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false}`. `Cache-Control:no-store`. expiresAt은 checkedAt+30초와 기존 HUMAN·grant·current·정책 기한의 최솟값이다. 공개 GET은 원문/Secret·PID/SDK SID를 반환하지 않는다.

기존 requestExecutionStop 명령 payload를 유지하며 제출 때 원 graph/current에서 target/ref를 다시 계산해 exact 대조한다. 준비 조회는 중지 허가가 아니며 조회 결과만으로 실행할 수 없다. grant 회수/만료·등록/원 주체·현재 대상 변경은 거절한다. 다른 OWNER를 허용한 회수 계약을 STOP에 전용하지 않는다. 저장 시 target을 기존 STOP command snapshot에 불변 보관하고 원 HUMAN receipt/audit/outbox와 원자 결박한다. 새 forward 미적용 SQL로 guard/역완결만 보완하며 일반 권한을 열지 않는다.

## 3. 저장·페이지 차이
- 기존 HUMAN 외피 APPLIED. data.status=`NORMAL_STOP_STORED`, snapshot transport=`NORMAL_PROTECTED`, state=`STOP_REQUEST_STORED`; executionAuthorized/dispatchPerformed/writerReleaseVerified 모두 false.
- outbox는 기존 normal kind=`EXECUTION_NORMAL`, state=`PENDING`. destination `{transport,registrationRef,executionId,generation}`, payload `{commandRef,grantRef,envelopeHash}`를 유지하고 정확 STOP graph를 검산한다.
- STOP page item은 `{sequence,commandRef,envelope,materials:null,stopTarget}`이다. stopTarget은 서버 STOP snapshot의 §2 닫힌 target 원형이며 page 생산자가 원 graph를 검산한 뒤 전달한다. REQUEST_STOP만 null/stopTarget을 허용하고 START/SEND는 기존 필드 목록과 descriptor를 유지한다. STOP 소비기는 target의 UUIDv5/SHA256을 재계산해 envelope.stopScopeRef와 exact 대조하고 원 envelope의 프로젝트/실행/세대/등록/session 및 보호된 로컬 원 START/grant·owner와 대조한다. projection 수신 자체가 실제 owner 권위를 만들지 않는다.
- 고정 page receipt entry의 STOP만 `materialsManifestRef:null, materialsDescriptorHash:null`. 기존 START/SEND 저장 영수증은 원형으로 계속 재조회한다. 기존 50건/2MiB·cursor·nonce/서명·정확 등록/세대·기한·replay 보호 유지, STOP 부분 수는0이다.
- 같은 command/hash replay는 원 기록, 다른 hash는 conflict. 결과불명은 reconcile-first이며 새 ID 자동 생성/재전송0. 현재 normal credential은 회수/만료 시 계속 거절한다.

## 4. 실행기와 완료 구분
서버 stopTarget projection으로 검산 입력을 제공하되, 실제 로컬 owner의 원 START command/grant/논리session/현재ownership 결박을 확인할 수 없으면 호출하지 않는다. 기존 REQUEST_STOP 봉투와 STOP_REQUESTED/STOP_UNCONFIRMED 관측/ACK 의미를 재사용한다. 실행기는 원 session owner와 stop target을 검산하고 내구 STOP 시도 선기록 뒤 협력적 중지 요청을 한 번만 전달한다. 원 owner가 없으면 거절하며 합성 owner를 normal 권위로 승격하지 않는다. 결과 유실/재시작은 추가 interrupt0. interrupt 반환은 STOPPED·writer 해제 증거가 아니다. 자동 grant 회수/credential 폐기·강제 kill·실제 owner 생산은 이번 계약이 허용하지 않는다.

## 5. 채택 후 구현·검수 범위
기존 Primary가 코드·미적용 forward SQL·합성시험만 수행하고 Main이 정확 허용목록을 고정한다. 최초 target 조회→기존 명령 저장→자료 없는 page→RAM 수신/단발 중지 요청→미확인 관측 ACK 여정과 원 주체/세대/target/정책·회수/만료·다른 OWNER·replay·위조/null 혼합·부분 저장/결과불명·기존 START/SEND 호환을 검증한다. 실제 DB·권한·키·파일조사·서비스·SDK/Agent 실행은 제외다. 소스 rollback은 정상 revert이며 실제 데이터 변경은 없다. 별도 새 공개/권위가 발견되면 이 후보로 임의 확대하지 않는다.
