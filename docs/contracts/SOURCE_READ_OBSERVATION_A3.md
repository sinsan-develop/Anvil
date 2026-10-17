# A-3 읽기 관측 권한·불변 보고 상세 계약 r2

상태: DESIGN_ONLY / IMPLEMENTATION_NOT_AUTHORIZED. 2026-10-17 Main 어울.
근거: 신산님 승인 계획 FN01/FN06/FN08·UI11, A3_SOURCE_OBSERVATION_DECISION.md, PMO AV3-PMO-A3-READ-OBSERVATION-DESIGN의 13:07:30Z 권장 A 적용 결정. 설계 기준 선택일 뿐 API/SQL·credential/키/native·실제 소스 실행 승인이 아니다.

## 1. 사용자 결과와 완료 경계

UI11에서 정확한 소스 선언 버전·호스트·지정 파일·기한을 사람이 확인하여 읽기 관측을 요청하고, 요청/교환/수신/거절/미확인을 구분해 조회한다. 이 자료는 이후 코딩 Agent의 작업 소스·시작 지점·재개 증거를 결박하기 위한 것이며 Dashboard/일반 관제를 만드는 업무가 아니다.

이번 첫 계약은 FILE 메타데이터 관측의 권한과 보고 수신이다. 내용 읽기/hash, 디렉터리 열거·재귀, Git 명령/metadata 수집, diff, 파일 변경, Agent 실행, 시작 baseline 확정은 포함하지 않는다. 전체 FN01/FN08 요구에서 삭제한 것이 아니라 후속 검증/실행 경계로 남긴다. 메타데이터의 크기/시각만으로 파일 내용 일치·구현 완료를 판정하지 않는다.

- 선언: 기존 source_roots/source_root_versions의 USER_DECLARED/UNVERIFIED.
- 수신 보고: 서명/현재 권한·참조를 확인해 보관한 CONNECTOR_REPORTED. 원문 출처의 진실성·실OS 동작을 자동 증명하지 않는다.
- 실OS 증거: 향후 승인된 Anvil 소유 native 관측 경로의 actual 증거·검증 receipt가 따로 있어야 한다. 서명만으로 CONNECTOR_OBSERVED/write-ready/VERIFIED baseline을 만들지 않는다.
- 본 r2의 모든 사용자/connector 응답은 executionAuthorized=false, agentDispatchPerformed=false, baselineConfirmed=false. 별도 observationPermit가 지정 메타데이터 읽기만 허가하며 Agent 실행권한과 이름/필드를 혼용하지 않는다.

## 2. 공통 자료형·상한·현재성

VersionRef는 기존 정확 id/version/contentHash, Hash는 소문자 SHA256, Instant는 UTC ISO 밀리초, UUID는 기존 validator, wire는 기존 parseWireJson/canonicalJson 규칙을 사용한다. unknown key/중복 wire key/비유한 값/잘못된 Unicode/크기 초과는 거절하고 절단·정규화해 통과시키지 않는다.

- grant는 프로젝트1/소스 선언1개에만 결박. targets 1~200, 각 {relativePath,kind:FILE,access:READ_ATTRIBUTES,recursive:false}. 상대경로 문법/대소문자 접힘 중복 제한은 SourceScopeV1과 같다(UTF-8≤1024bytes/segment≤255 UTF-16). READ_ATTRIBUTES는 SourceScopeV1의 READ/WRITE와 별도 enum이며 기존 parser를 느슨하게 바꾸지 않는다.
- 요청/고정 scope canonical bytes≤256KiB, 이유1~20000자. 보호 permit 응답≤512KiB, report canonical bytes≤1MiB다. native의 지정 파일 메타데이터 관측은 성공한 permit 수신 뒤 단조 시계로 최대30초·credential 잔여기한 중 짧은 창으로 제한하며 재조회로 진행 중 창을 연장하지 않는다. 파일본문/명령/argv/Secret/임의 예외 문구 필드는 없다. 이30초는 후속 실행 검토용 설계 수치이며 현재 native 실행 허가가 아니다.
- grant 요청 기한은 서버 now 이후·최대2시간·현재 명시 정책 만료 이내. challenge≤2분·grant 잔여 기한 이내. 별도 credential≤5분·grant/정책/원 세션 절대 만료 이내. 실제 승인 창은 이 상한보다 짧게 별도 고정하고 자동 연장하지 않는다.
- 매 HUMAN 명령 및 connector 교환/permit 조회/보고 수신에서 현재 user/session/client·credential_generation, OWNER·project/control_generation, 현 policyRef, 등록/connector generation·TRUSTED·등록 host fingerprint/public key, 최신 DECLARED 소스 ref를 재검사한다.
- 기존 connector_basis_current의 등록 당시 policyRef 결박을 보존한다. 정책 개정으로 등록 기준이 달라지면 옛 등록을 자동 rebind하지 않는다. 필요한 새 정책/재등록/사람 확인은 사용자에게 드러내며 별도 승인·명시 조작으로만 수행한다.
- REQUIRE_APPROVAL은 본 r2 소스 연산의 일회 소비가 아직 없으므로 412 유지, AUTO와 섞어 우회하지 않는다. AUTO 명시 정책과 사용자 요청 자체를 함께 요구한다. DENY/만료 우선이며 실제 사용자 정책 자동 부여0이다.
- 생성 당시 적합성과 현재 유효성은 다르다. GET은 storedState/effectiveState/invalidReasons/observedAt을 분리하고 회수/기준 변경을 숨기기 위해 과거 행을 덮지 않는다.

## 3. HUMAN 요청·철회·조회 (모두 신규 제안 endpoint/연산, 현재 미구현)

기존 POST /api/v1/projects/:projectId/commands envelope를 소비한다.

1. requestSourceReadObservation: targetId=null/expectedVersion=0, payload 정확 키={sourceRootRef,connectorRef,registrationRef,targets,expiresAt,reason}. baselineRefs=[]/approvalRef=null. sourceRootRef는 현재 선언의 exact ref, connectorRef는 현재 등록된 동일 connector generation ref, registrationRef는 동일 프로젝트의 현재 신뢰 등록 exact ref다. 선언 connectorId가 null/다름, 철회/구버전/미등록이면 412/409로 거절하고 임의 host 선택/접속을 하지 않는다.
2. revokeSourceReadObservation: targetId=grantRef.id/expectedVersion=grantRef.version, payload={grantRef,reason}. 현재 OWNER·단독제어·재인증·별도 명시 revoke 정책과 exact grant를 확인한다. 발급 scope는 불변, 명시 회수 기록과 관련 credential의 revoked_at만 한 transaction에 남긴다. 실제 프로세스 강제 종료나 파일 삭제 연산이 아니다.
3. GET /api/v1/projects/:pid/source-read-grants?limit&cursor 및 /source-read-grants/:gid.
4. GET /api/v1/projects/:pid/source-snapshots/:sid/versions/1.

요청 성공은 GRANT_RECORDED, data={grantRef,scopeDigest,storedState:CREATED,scope,observationPermit:NOT_ISSUED}이며 기존 command/receipt/audit와 원자 저장한다. scope는 protocolVersion=1/purpose=SOURCE_READ_OBSERVATION, installationId/projectId, sourceRootRef/connectorRef/registrationRef, pathHintHash, hostFingerprint, HUMAN userId/clientId/credentialGeneration/controlGeneration, policyRef, targets, requestedAt/expiresAt/reason이다. 서버가 exact sourceRootRef의 snapshot 전체 canonical SHA256를 검증한 뒤 해당 declaration.pathHint의 원 UTF-8 SHA256를 pathHintHash로 산출한다. 요청자가 pathHint/hash를 별도 입력하거나 정규화해 치환할 수 없다. scopeDigest=SHA256(canonical scope). grantRef.version=1/contentHash=scopeDigest이며 이후 scope를 바꾸려면 새 명시 grant를 만든다. mutable 상태를 scope hash에 넣지 않는다.

같은 command/hash는 현재 권한을 다시 확인한 뒤 동일 비밀 없는 receipt, 같은 command/다른 hash는409. 회수/효력상실 뒤 원 grant가 재실행되거나 기한을 연장하지 않는다. OWNER만 지정 상대경로·보호 원문 참조를 조회, VIEWER는 grantRef/표시명·대상 수/상태·기한·집계만 조회한다. 타프로젝트 직접 ID는404, 만료 로그인401. cursor는 기존 프로젝트·사용자·정확 filter/limit·기한 결박 패턴을 따르고 limit 기본20/최대50·30분이다.

## 4. 별도 host proof 교환 — 등록 token 재사용0

신규 POST /api/v1/connectors/:connectorId/source-read-grants/:grantId/exchange.
이 endpoint는 사람 cookie·REGISTRATION_STATUS_ONLY bearer를 권한으로 받지 않는다. 등록된 host public key의 별도 purpose 서명과 현재 grant를 검사한다. 기존 registration-proof payload/endpoint/서명 내용을 수정하지 않는다.

- CHALLENGE 요청 정확 {step:CHALLENGE,preflight,signature}. preflight={protocolVersion:1,purpose:SOURCE_READ_PREFLIGHT,installationId,projectId,connectorId,registrationId,connectorGeneration,grantRef,scopeDigest,publicKeyFingerprint,clientNonce,expiresAt}. clientNonce는 canonical base64url32bytes, expiresAt=고정 grant 기한이다.
- 공개키는 현재 등록된 P-256 SPKI, 지문=기존 DER SHA256. 서명은 SHA256/IEEE-P1363 64bytes의 canonical base64url, 서명 bytes는 UTF-8 canonicalJson(preflight 또는 challenge payload)다. purpose/필드가 다른 새 proof codec이며 기존 HOST_PROOF/EXCHANGE 서명을 받아들이지 않는다. challenge payload의 정확 키는 preflight의12키에 serverNonce/issuedAt를 추가한14키이고 purpose만 SOURCE_READ_EXCHANGE로 바꾸며 expiresAt는 서버가 계산한 짧은 기한이다.
- 서버는 현재성 확인 뒤 purpose=SOURCE_READ_EXCHANGE, preflight와 동일 결박·새 serverNonce32bytes·issuedAt/짧은 expiresAt가 든 challenge를 저장/반환한다. 첫 preflight hash가 고정되며 같은 유효 요청만 동일 challenge를 재조회한다. 다른 nonce/hash·소비/만료 challenge는 재발급/연장하지 않는다.
- ISSUE 요청 정확 {step:ISSUE,challengeId,payload,signature}; payload는 서버 challenge 전체와 canonical byte 동일. challenge 만료·현재성·서명을 다시 확인하고 한 transaction에서 소비/별도 credential hash/감사를 저장한다. 최대5회 실패 뒤 해당 grant의 교환만 잠그고 기존 등록/credential의 횟수·권한을 변경하지 않는다. 단 등록 key로 제출 payload 서명 자체가 유효한 주체의 nonce/기준 불일치만 횟수에 넣는다. 익명·무효서명·추측한grant ID 요청은 상태/실패횟수/감사를 쓰지 않고 거절하여 외부인이5회로 정상요청을 잠그지 못하게 한다. 서명 자체 유효성→현재성/저장 challenge 동일성의 검사를 구분한다.
- raw credential은 새 av3sr1_ + random32bytes base64url, DB에는 SHA256 digest만 저장한다. 응답은 token1회·credentialId/scopeDigest/기한/관측 허가의 정확 범위뿐이다. 로그/브라우저/대화/Git에 raw token을 남기지 않는다.
- ISSUE 응답 유실/중복은 원문 token을 재생/재발급하지 않고409 SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED. 같은 grant의 비밀 없는 상태 조회로 대조하고, 필요하면 사람이 회수·새 grant를 요청한다. 관측을 자동 재실행하지 않는다.
- endpoint별 Origin/HTTPS·본문/시간 제한을 강제하고 redirect/fallback0. 기존 TrustHttpsClient/readProtocolReply는 grants=[]/16KiB를 보장하는 다른 계약이므로 그대로 두고, 새 source-read-https 소비자를 분리한다. CSRF는 HUMAN 명령에서 기존대로 검사하며 Bearer 경로로 쿠키 인증을 우회하지 않는다.

### 4.1 정확한 선언 경로의 보호 전달 — OWNER 조회 확대0

신규 GET /api/v1/connectors/:cid/source-read-grants/:gid/permit은 해당 grant의 미소비·현재 유효한 av3sr1_ credential만 받는다. HUMAN cookie·기존 상태조회 token·다른 grant/connector token은 허용하지 않는다. 매 조회에서 §2의 현재성·exact sourceRootRef·scopeDigest와 token 기한을 검사하고 Cache-Control:no-store로만 반환한다. 기존 OWNER source-roots GET을 connector에게 열거나 등록의 grants=[]를 바꾸지 않는다.

응답의 정확 키는 {protocolVersion:1,grantRef,scopeDigest,scope,root,issuedAt,expiresAt,serverNow,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false}이다. root={sourceRootRef,pathHint,pathHintHash}. scope는 저장된 고정 scope, issuedAt/expiresAt는 credential의 최초 발급/만료 시각, serverNow는 응답 생성 서버 시각이다. 재조회로 credential·grant·진행 중 관측의 기한을 늘리지 않는다. sourceRootRef는 scope와 동일하고 pathHintHash는 scope.pathHintHash 및 원 pathHint UTF-8 SHA256와 같아야 한다.

전달 주체인 서버가 sourceRootRef.id/version으로 읽은 불변 snapshot 전체 hash와 DECLARED·connector 귀속을 먼저 대조한다. connector는 TLS의 지정 Anvil 서버 응답에서 grantRef.contentHash=scopeDigest=SHA256(canonical scope), 정확한 설치/프로젝트/connector·등록·세대·host 결박과 경로 hash를 확인한다. 전체 snapshot을 받지 않으므로 sourceRootRef의 전체 hash를 connector가 독립 재계산했다고 주장하지 않는다. 그 부분은 서버의 exact snapshot 검증과 scope에 포함된 경로 hash의 결박이다. mismatch/조회 실패/회수/구버전/만료는 관측 시작 금지이며 로컬 설정·환경변수·별도 경로·일반 receipt로 대체하지 않는다.

native 최초 root 선택의 단일 입력은 검증한 permit.root.pathHint의 원 문자열이다. Windows-local 절대경로 문법·지원 파일시스템에 맞지 않으면 미지원으로 거절하며 WSL 경로나 상대경로를 추측·변환하지 않는다. 선언 경로 전달은 OS 경로의 존재·정체성·안전을 증명하지 않으며 §7 handle 검증이 여전히 필요하다. 반환 canonicalPath를 새 root 입력으로 재사용하지 않는다.

명시 요청 미리보기에서 **선언의 정확 root 경로, 대상 상대경로, 이번 관측 이유와 고정 scope가 지정 connector에 전달됨**을 표시한다. 원 선언의 다른 hostLabel/displayName/reason·snapshot 전체는 전달하지 않는다. raw token·pathHint·permit 원문은 VIEWER/일반 receipt·오류·감사·로그/argv/환경/평문 스풀에 넣지 않고 허가된 connector 메모리에서만 소비한다. 관측 종료·만료 시 메모리 참조를 폐기하되 런타임 메모리의 물리적 완전 소거를 보장했다고 주장하지 않는다.

## 5. report 수신·불변 결과

신규 POST /api/v1/connectors/:cid/source-read-grants/:gid/reports.
Authorization: Bearer av3sr1_…만 허용하며 상태조회 token/cookie/다른 grant token은401/404. payload={protocolVersion:1,commandId,grantRef,scopeDigest,connectorRef,hostFingerprint,observedAt,finishedAt,root,files,localEvidence,contentHash,signature}.

- root={state,facts,reasonCode}, state는 아래 파일과 같은5종이다. OBSERVED일 때만 facts={declaredRootRef,kind:DIRECTORY,canonicalPath,volumeSerialHex,fileIdHex,reparse:false}/reasonCode=null이다. root 실패는 facts=null·고정 이유이며 모든 파일을 UNVERIFIED/ROOT_UNAVAILABLE로 반환하고 실제 자식 열기0이다. canonicalPath는 OWNER 보호 자료이며 기본 목록/감사/일반 오류에 반사하지 않는다. 서버는 report 경로를 다음 파일 접근 인자로 사용하거나 선언 위치를 치환하지 않는다.
- files는 grant targets와 동일 순서/정확 상대경로 수·각1개이며 {relativePath,state,facts,reasonCode}. state=OBSERVED/MISSING/DENIED/CHANGED/UNVERIFIED. OBSERVED만 facts={kind:REGULAR_FILE,volumeSerialHex,fileIdHex,sizeBytesDecimal,lastWriteFileTimeDecimal,reparse:false}, reasonCode=null. 나머지는 facts=null이다. MISSING=PATH_NOT_FOUND, DENIED=ACCESS_DENIED/REPARSE_DENIED/OUTSIDE_ROOT/NOT_REGULAR_FILE, CHANGED=IDENTITY_CHANGED, UNVERIFIED=OBSERVER_UNAVAILABLE/UNSUPPORTED_FILESYSTEM/TIME_LIMIT_REACHED/ROOT_UNAVAILABLE만 허용한다. root DIRECTORY의 NOT_REGULAR_FILE은 ROOT_KIND_INVALID로 구분한다. raw 예외/OS path/출력은 금지한다.
- volumeSerialHex=소문자16hex, fileIdHex=32hex. 파일크기/FILETIME은 uint64 범위의 canonical 십진 문자열(0 또는 선행0 없는 수); JS Number로 손실 변환하지 않는다. 알려진 항목만 허용하며 extra property·directory/recursive·내용/diff/gitFacts는422.
- localEvidence={kind:NATIVE_METADATA_REPORT|OBSERVER_UNAVAILABLE,observerProtocolVersion:1,observerImageHash:Hash|null,ownedProcessRef:VersionRef|null}. 이 필드/서명은 connector의 보고이며 native 실행/OS 안전의 서버 독립 증명이라고 취급하지 않는다.
- contentHash는 signature/contentHash를 제외한 전체 payload canonical hash. 서명 bytes는 UTF-8의 고정 prefix ANVIL_V3_SOURCE_READ_RESULT와 LF1개 뒤 canonicalJson({protocolVersion:1,purpose:SOURCE_READ_RESULT,installationId,projectId,connectorId,connectorGeneration,grantRef,scopeDigest,contentHash})를 결합한 것이다. 설치/프로젝트/주체·세대는 서버 grant의 값이며 report 값으로 교체하지 않는다. 동일 bytes/key의 중복은 기존 snapshotRef/receipt, 다른 hash는409·원 기록 보존이다.
- 수신 직전 현재성·grant/credential 기한을 서버 시각으로 검사한다. 이미 기한 경과/회수/소스 개정이면 canonical 결과를 성공 저장하지 않는다. client observedAt을 바꿔 늦은 제출을 통과시키지 않는다. connector는 전송 실패 자료를 평문 스풀에 자동 보관하지 않고 메모리에서 같은 승인 창 동안만 재확인한다. 만료/회수 시 재수신·새부작용은 금지하며 비밀 없는 실패/해시만 남긴다.
- 보고 시각은 connector의 주장이고 receivedAt은 transaction에서 정한 서버 수신 시각이다. 허용 시계 오차 δ=30000ms로 고정하며 credential.issuedAt−δ ≤ observedAt ≤ finishedAt ≤ receivedAt+δ, finishedAt−observedAt ≤30000ms를 모두 요구한다. 서버는 receivedAt < credential.expiresAt 및 receivedAt < grant.expiresAt·현재 정책/세션 기한을 **오차 없이** 검사한다. 보고를 서버 시각으로 조용히 보정하거나 미래/발급 전 시각을 성공으로 저장하지 않는다. 불가능한 순서·범위는422 SOURCE_READ_TIME_INVALID로 거절·snapshot/소비 부작용0이며 UI에는 보고 미수신/시계 확인 필요를 구분한다. 이 시각검사는 실제 관측 시작·종료의 독립 OS 증명이 아니며 permit 수신 후 단조 시계30초 제한은 connector의 별도 책임이다. 한 grant의 재조회/전송 재시도로 새 관측 창을 자동 시작하지 않는다.
- 한 grant에는 결과1건만 저장한다. 요청 command/보고 commandId·scope hash·불변 결과/audit를 원자 COMMIT하고 credential consumed_at을 기록한다. 소비 후에는 현재 유효성 확인을 거친 같은 report hash의 비밀 없는 receipt 재조회만 가능하다.
- report 수신 성공=REPORT_STORED, evidenceClass=CONNECTOR_REPORTED, osVerification=UNVERIFIED, snapshotRef/observedSummary를 반환한다. 불완전/거절 파일은 그대로 집계하고 EMPTY/누락을 전체성공으로 바꾸지 않는다. 어떤 수신도 source 선언·현재 baseline/Agent readiness를 수정하지 않는다.
- 향후 별도 실OS verifier/검증 receipt를 구현·검증하기 전 이 snapshotRef는 SourceScopeV1의 신뢰 관측/확정 baseline으로 소비할 수 없다. 실제 검증이 생겨도 기존 보고를 덮지 않고 별도 증거/판정을 연결한다.

## 6. 제안 SQL·권한·감사 책임 (미생성·미적용)

후보 migration ID/파일: 0008_source_read_observation / db/migrations/0008_source_read_observation.sql.
현재45개의 SQL·checksum은 보존하고 새1건이면46개다. 기존 A-2R source_roots의 의미/행과 connector_credentials의 REGISTRATION_STATUS_ONLY CHECK를 고치지 않는다. 새 schema-only runner의 선행은45개이며 A-2R의44목록을 그대로 복제해 누락시키지 않는다.

| 새 표 | 열/키·불변 조건 |
|---|---|
| source_read_grants | project_id/id PK,version=1,source_root_id/source_root_version,source_root_hash,connector_id/connector_generation,registration_id/registration_version,requested_by/client_id/session_id/credential_generation/control_generation,policy_ref,scope_json/scope_digest,created_command_id UNIQUE(project_id,command),created_at/expires_at,revoked_at?/revoke_command_id?,exchange_failures0..5. same-project source version/connector/registration/command FK·user/client FK, scope 정확 키·hash·기한·현재 명령receipt 일치 guard. scope/원 발급 필드 UPDATE/DELETE 불가, 회수·실패횟수만 해당 감사/현재 명령에서 허용 |
| source_read_challenges | id PK,project_id/grant_id UNIQUE,preflight_digest,payload_json,created_at/expires_at,consumed_at?,proof_signature?,failed_attempts0..5. same-project grant FK. payload/nonce/기한 불변, 동일 proof 소비/실패 증가 외 UPDATE 불가·DELETE 불가 |
| source_read_credentials | id PK,project_id/grant_id UNIQUE,connector_id/connector_generation,token_digest UNIQUE,scope=SOURCE_OBSERVE_READ_ONLY,scope_digest,issued_at/expires_at,revoked_at?,consumed_at?. same-project grant/connector FK. raw token0, 최초 scope/digest 불변·연장0, 현재교환/소비/회수 audit에만 상태 UPDATE |
| source_snapshots | project_id/id/version=1 PK,grant_id UNIQUE,report_command_id UNIQUE(project_id,command),source_root_id/source_root_version,connector_id/generation,scope_digest,report_json/content_hash,signature,observed_at/finished_at/received_at,evidence_class=CONNECTOR_REPORTED,os_verification=UNVERIFIED. same-project source version/grant/connector FK. INSERT는 exact scope/토큰소비/감사와 결박·UPDATE/DELETE 모든 역할에서 거절 |

app 역할은 필요한 SELECT/INSERT·명시 상태 UPDATE만 받는다. 새 grant scope/보고 payload의 정확 키·JSON 타입·canonical hash와 §5의 발급/보고/수신 시각 관계를 Node와 SQL 양쪽에서 확인한다. pathHintHash는 exact source snapshot의 원 경로로 대조하고 permit은 별도 저장본/경로 원문 복제 없이 현재 원본과 고정 scope에서 구성한다. scope 변경이나 report extra key가 후속 조회503을 만들 수 없게 한다. 감사 source_kind=SOURCE_OBSERVATION_PROTOCOL, 명령/결과/교환/회수에 안전한 ref/hash/고정 이유만 남기며 raw token·nonce proof payload·경로·filename 목록·원문은 남기지 않는다. 기존 HUMAN command/receipt/audit는 기존 서버 transaction을 소비하며 무자격 직접 DML/가짜 session setting만으로 guard가 통과해서는 안 된다.

SQL의 scope/report hash는 canonical UTF-8를 사용한다. 신규 SQL 전용 source_read_canonical_json은 정확 필드 검사 뒤 ASCII key를 C 정렬·배열 순서 보존·공백0·JSON string escape·null/boolean·유한 safe 정수만 직렬화한다. uint64는 위 십진 문자열 그대로다. jsonb::text의 임의 공백/순서나 Node 계산값만으로 동일성을 주장하지 않고 Unicode/CRLF/escape/정수 경계 벡터를 실제PG에서 대조한다. P-256 서명 검증은 Node 책임이며 SQL 가드를 독립 암호검증기로 주장하지 않는다.

SQL 본문/호출별 가드·상태전이의 구현 diff/hash는 다음 실행 승인 패킷에서 확정한다. 본 문서의 표를 실행 SQL 파일 생성·DB 적용·기존 권한 변경의 승인으로 취급하지 않는다.

## 7. Windows 관측·보호 설계와 지원 경계

첫 actual 후보는 승인된 새 Windows-local NTFS 합성 root에서 지정 FILE의 메타데이터만 확인한다. UNC/WSL mapping/FAT/네트워크/디바이스/디렉터리 재귀/내용/Git는 미지원 상태로 거절한다. 이후 실제 소스/WSL 매핑·Git/dirty 수집은 계획의 별도 범위로 남기고 이번 PASS로 대신하지 않는다.

native 소비자는 Node 문자열 realpath 검사만으로 안전하다고 주장하지 않는다. root/중간 directory handle을 유지하며 한 경로 segment씩 기존 객체만 상대 열기, reparse/다른 volume·root 이탈·alias/정체성 변경을 거절하는 경로를 검증해야 한다. FILE_READ_ATTRIBUTES와 필요한 traverse/control만 요청하며 FILE_READ_DATA/EXECUTE/쓰기/삭제·디렉터리 열거·Git 프로세스는 요청하지 않는다. 열기·속성·정체성·최종경로를 같은 handle에서 확인하고 닫는다. 일반 프로세스/기존 helper/서비스를 종료하지 않는다.

[NtCreateFile 공식 문서](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile)는 RootDirectory 상대 열기·FILE_OPEN·접근권·reparse 처리의 API 근거다. [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info)와 [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew)는 handle의 정체성/경로 조회 근거다. 이 문서 확인은 Windows 빌드·파일시스템/공유권한·경합의 actual PASS가 아니다. flag 조합/중간경로 교체·rename/삭제/링크/외부 경로의 실제 음성을 통과하기 전 observer 사용을 차단한다. 기존 OwnershipHost·CS1504/한시 QA 실패·부족한 OS gate를 재해석하거나 해소한 것으로 쓰지 않는다.

보호 private key의 생성·ACL/DPAPI·실서명 사용과 새 실행파일/컴파일·native probe는 별도 실행 승인 대상이다. 기존 등록 public key 형식·지문 결박은 재사용할 수 있지만 기존 secret 파일/상태조회 credential을 복사·확장하지 않는다. raw 관측 token은 승인된 native 소유 메모리 안에서만 전달하고 자식 argv/환경·일반 log/콘솔·파일에는 넣지 않는다. 현재 TrustHttpsClient나 ProtectedStore의 보호 계약을 임의 완화하지 않는다.

## 8. 화면·검수·오류

UI11의 source 선언 상세에 별도 ‘읽기 관측 요청’ 섹션을 둔다. 호스트/선언 exact version/hash·실제 전달 경로/파일목록·이번 관측 이유/scope의 지정 connector 전달·기한·수집 범위·비수집 항목을 미리 표시하고 명시 저장만 수행한다. grant 준비/교환 미완료/결과미확인/보고수신·OS미확인/시계 확인 필요/회수·만료를 구분하며 ‘실행 가능’으로 바꾸지 않는다. VIEWER는 요청/회수 버튼·경로/파일목록을 받지 않는다. 같은 명령 재확인·dirty/pending 보존과 다른 프로젝트/사용자/client 교체·늦은 응답 무효화를 기존 UI11 패턴으로 적용한다.

필수 좁은 검수:
1. 타 프로젝트/VIEWER/만료/옛 client·generation·소스 철회/개정·policy 교체/재등록 필요: 부작용0·원 이력 보존.
2. 상태조회 token·등록 HOST_PROOF 서명 재사용·다른 purpose/hash/nonce·만료·6번째 실패·ISSUE 응답 유실: 새권한/재발급0.
3. 같은 grant/report bytes 중복1건, 다른hash409, 결과 INSERT 중단 전체 rollback, extra키/JSON 타입/SQL 직접 DML 거절.
4. target200 경계/201거절·글자/바이트·상대경로/대소문자중복·메타데이터만·누락/불완전 보고·본문/diff/git 주입 거절.
5. 실제 native는 별도 QA에서 reparse/중간경로 교체·열린 handle 정체성/외부 경로·기한/중단·process/handle 정리0. 문서/순수 시험을 이 PASS로 승격0.
6. UI 명시 요청→exact receipt/목록·report 조회→회수, GET/출처와 사용자 buffer 보존. 서버 PG committed QA와 합성 browser·실 served 여정을 각각 구별.
7. permit의 정확 source snapshot/hash→scope pathHintHash→원 경로 전달·단일 native 입력; 잘못된 token/주체·snapshot/hash·구버전/철회/만료·TLS/조회 실패에서 관측 시작0. VIEWER/receipt/감사/로그 경로 비노출과 기존 OWNER API·상태token 무확장을 확인한다.
8. observedAt>finishedAt·credential 발급 전−30초 밖·서버 수신 후+30초 밖·관측구간30초 초과는422/rollback, 정확 경계/30초 이내 오차는 주장 시각 그대로 보존한다. observedAt을 과거로 둬도 서버 만료 시각과 같은/지난 수신은412이며 허용오차로 연장하지 않는다. receivedAt은 서버 값이고 caller 주입/extra key를 거절한다.

고정 오류군: SOURCE_READ_INPUT_INVALID(422), SOURCE_READ_TIME_INVALID(422), SOURCE_READ_SCOPE_DENIED(403), SOURCE_READ_BASIS_CHANGED(412), SOURCE_READ_EXPIRED(412), SOURCE_READ_PROOF_INVALID(412), SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED(409), SOURCE_READ_REPORT_CONFLICT(409), SOURCE_READ_INTEGRITY_FAILED(503), SOURCE_READ_OS_UNVERIFIED(412). 기존 auth401/직접타project404/정확버전409를 유지하고 raw 메시지·경로를 반사하지 않는다.

## 9. 구현·실행 승인 분리와 복구

다음 논리 단위는 기존 FN/UI 안의 checkpoint이지 새 최종 업무 ID가 아니다.
- 서버 요청/현재권한·새4표/가드/보고·조회 + committed 격리 PG와 실패 rollback.
- UI11의 명시 관측 요청/조회/회수와 기존 buffer 연결 + 후보 browser.
- 새 Windows metadata observer/보호 교환·actual 합성 root 음성 + 이후 별도 승인된 실제 소스/신뢰 증거·기준선 연결.

현재는 이 문서/연결 계약만 검토한다. 실행 요청에는 그때의 exact commit/SQL hash·신규4표/46번째migration·등록QA root/PG image/container/net/port/owner/수명/정리·새 native source/build/helper hash·유한 창·보호자료/복구 원본·사전/사후 gate를 제시해야 한다. literal 자원이 승인되기 전 임의 경로/port/계정·Secret을 만들지 않는다.

격리 PG는 새 빈 자원에 현재45+새1 SQL을 실제COMMIT·정확 QA 후 stack 전체 폐기한다. trigger/권한을 풀어 감사행을 삭제하지 않는다. 정식 DB schema-only/새4표0행은 별도 결정이며 현45checksum/기존 전체표 구조·행수/fingerprint·서비스/보호자료를 전후 대조한다. commit 전 실패는 transaction rollback, commit 뒤 문제는 신규자료 보존·기능 닫기·forward repair이며 DROP/reset0. credential 유실은 같은 raw token 복원이나 조용한 재발급이 아니라 명시 회수/새 요청이다. grant 회수는 서버권한을 차단하는 것이며 이미 열린 OS handle이 실제 닫혔다고 주장하지 않는다.

후속 A3 실행 전까지 A-1 dispatch false·A-2R 선언 UNVERIFIED·현재 서비스/등록/DB45/키/권한을 유지한다.
