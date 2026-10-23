# FN03 최초 소스 연결 — 내용 hash 관측 delta 결정 후보 v1

상태: **SOURCE_IMPLEMENTATION_APPROVED / ACTUAL_EXECUTION_NOT_AUTHORIZED**

2026-10-23 신산님 직접 ‘네 의견대로 승인해’를 §11 권장 B의 source/codec·미적용 SQL·기본 미등록 server/native/UI·합성 검증 범위로 기록한다. 관측 시점의 byte 일치를 채택하되 COMMIT 순간 파일 lease를 보장하지 않는다. 실제 파일 읽기·키/권한·DB 적용·서비스·Agent 실행은 포함하지 않는다. 아래 후보 표현과 원 검토 지적은 결정 전 이력이며 이 단락이 현재 승인 상태다.
2026-10-23 / Project Main 어울 / 기준 codex/av3-stage-b 040548d46bc177c9d98b22fb63e1f2ec7b2cd31b.

## 1. 필요한 사용자 결과와 기존 승인과의 차이

UI06에서 확정 문서의 정확 원본 바이트와 지정 소스 파일의 관측 바이트가 같았음을 근거와 시각을 붙여 연결하고, 원문·파일·옛 버전을 변경하지 않는 것이 목표다. 단순 링크/경로 목록이나 metadata 보고의 hash로 대체하지 않는다.

| 직접 대조한 근거 | 재사용 / 재사용 불가 |
|---|---|
| SOURCE_READ_OBSERVATION_A3 r2 §1/7 | 내용 읽기/hash·FILE_READ_DATA·Git·Agent를 명시 제외. 같은 READ_ATTRIBUTES grant/token/purpose로 바이트를 읽을 수 없다 |
| A3 구현계획/TECH_DECISIONS | 로컬 source·미적용 SQL·합성 후보의 한정 구현 승인과 별도 단발 schema46 적용 이력. 내용 수집/원문 검증의 실행 승인이 아니다 |
| SourceReadReportV1.files.facts | identity/size/time/reparse만 있다. report.contentHash는 canonical 보고서 hash이고 파일 hash가 아니다 |
| ArtifactStore / ProjectDocuments.#artifact | 기존 보호 원본 바이트·SHA256·크기·project 귀속·격리 상태 조회/재해시는 재사용 가능. 업로드된 파일이 현재 지정 root/path의 바이트였음을 증명하지 않는다 |
| importDocument / proposeDocumentChange | 원본/파싱/수정 제안·불변 보존은 재사용 가능. 정규화된 텍스트 hash를 원 파일의 raw-byte hash와 동일시하지 않는다 |
| 0032_document_source_links | 기존 link/event·문서/root 연결 저장 구조는 재사용 가능하나 app의 LINKED INSERT를 명시 REVOKE했고 detach만 허용한다 |
| project-command / detach 시험 | link operation은 현재 등록되지 않았고 기존 정책 parser의 link 거절 반례가 있다. 이번 후보로 이를 바꾸지 않는다 |

기준 raw SHA256:
- A3 문서: 095B5FEFDBB2F903415AE404CC97D50FB585D1696FA6468CBFC91E805464D035
- source-read-report-v1.ts: ECD6182F477969A7D5387222F6FD0E6E659776AA44E703900EAB040F7B42F65D
- 기존 0008 SQL: 26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185
- 기존 0032 SQL: 8A504C962C7D873C08CA2DCC9134CBD9759A8D8F5370D40A548969893FF8322D

새 결정은 기존 FN03 기능을 추가 발명하는 것이 아니라, metadata 접근에서 **내용 읽기·새 서명 대상·LINKED 쓰기 권한**으로 넓히는 계약 차이의 선택이다. 기존 FN06 writer Bv3/PREPARE_CURRENT·D2 컴파일과 다른 범위다.

## 2. 대안과 권장안 — 새 버전/새 표가 필수라고 단정하지 않음

A. 기존 A3 4표를 유형 discriminator로 확장하고 새 codec/권한 분기를 둔다. 기존행 METADATA_V1·옛 guard는 그대로 소비하고 새 CONTENT_HASH_V1만 새 guard를 사용한다. 표 증가가 적지만 credential CHECK/trigger/current reader의 분기 변경이 기존 인증에 영향을 줄 수 있다. 단순 v1 extra field 허용은 금지한다.

B. **권장: 새 목적의 병렬 계약과 저장을 분리한다.** 아래 namespace의 protocolVersion=1이며 기존 metadata의 version을 2로 고칠 필요는 없다. 요청/교환/credential, 불변 보고, 검증 receipt, 별도 한정 정책의 4개 후보 표를 두고 기존 0032 링크 저장을 한정 보완한다. 기존 metadata 4표/codec/서명 domain/credential는 무변경이다. 객체가 늘지만 권한 확대와 회귀를 구분하기 쉽다. 아래 이름·열은 **B를 선택할 때의 제안**이지 이미 확정된 schema가 아니다.

C. 기존 Artifact 업로드/수정 제안만 사용한다. 서버 보관 hash 비교에는 유효하지만 현재 source root/path 출처가 없으므로 UNVERIFIED 후보 비교까지만 가능하다. 최초 검증 연결/실제 드리프트 완료의 대체안은 아니다.

이 후보는 B의 source 계약 구현만 결정받는 안이다. 실제 계정/정책·키/credential·파일 읽기·DB 적용·native compile/run·서비스·Agent는 제외한다. A 선택이면 기존 guard/권한의 정확 변경 목록을 먼저 다시 대조한다. A/B 어느 안도 기존 metadata 보고를 내용 관측으로 소급 변환하지 않는다.

## 3. namespace·명령·API·기본 권한

후보 namespace SOURCE_DOCUMENT_CONTENT_HASH_V1, 목적 SOURCE_DOCUMENT_CONTENT_HASH, 파일 access=READ_CONTENT_HASH_ONLY, recursive=false. READ_ATTRIBUTES·SourceScope READ/WRITE·REGISTRATION_STATUS_ONLY·PREPARE_CURRENT는 재사용하지 않는다.

HUMAN 명령 후보:
- defineSourceContentPolicy: 정확 content-policy 개정/회수 기록. 현재 로그인·OWNER·단독 제어·재인증 및 별도 이 계약 관리 권한을 요구한다. OWNER라는 이유만으로 자동 생성/허가하지 않는다. 최초 실제 관리권한 부여는 이번 승인에 포함하지 않는다.
- requestSourceContentHash: targetId=null/expectedVersion=0, payload={sourceRootRef,connectorRef,registrationRef,observerRef,targets,limits,expiresAt,reason}. targets는 {relativePath,documentRef,documentBlobRef}; documentBlobRef는 기존 ArtifactRef 형식이다. 서버가 문서 exact 버전의 content.body와 동일함을 확인한다.
- revokeSourceContentHash: payload={requestRef,reason}. 정확 원 요청/현재 제어·정책 아래 회수 append.
- linkDocumentSource: 기존 INTERFACES의 payload 6키/targetId=null/expectedVersion=0을 유지하되 아래 새 content 근거가 없으면 412. AUTO 전용의 별도 content-policy에서만 허용한다. REQUIRE_APPROVAL은 정확 일회 소비 계약이 없는 동안 닫는다. 기존 detach 정책이 link를 허가하지 않는다.

새 source-only API 후보:
- 기존 /api/v1/projects/:pid/commands의 새 명령 분기. 기본 미등록.
- GET /api/v1/projects/:pid/source-content-requests 및 /:requestId
- GET /api/v1/projects/:pid/source-content-observations/:id/versions/1
- GET /api/v1/projects/:pid/documents/:docId/source-links/:linkId/content-evidence
- POST /api/v1/connectors/:cid/source-content-requests/:rid/exchange
- GET 동일 request 경로의 /permit, POST /reports.
기존 /source-read-*·/source-snapshots와 URL/purpose를 혼용하지 않는다. HTTP 본문≤1MiB·HTTPS 지정 서버·redirect/fallback0·HUMAN CSRF·Bearer/cookie 분리를 유지한다.

별도 content-policy는 HUMAN user/project/허용 operation/targets·기한/한도만 허용한다. DENY/만료 우선·기본 DENY, 정책 없음/회수/다른 project/세대면 거절한다. 기존 범용 materialRules의 v1 link 거절과 기존 정책/등록 binding을 바꾸지 않는다. 현재 기본 로그인/제어·등록/격리 조건과 별도 content-policy를 함께 검사한다. 기존 metadata 정책을 FILE_READ_DATA 허가로 해석하지 않으며, 새 content-plane의 명시적 권한만을 별도로 요구한다. 기존 generic parser에 미지원 link 허용을 추가하지 않는다. 기존 등록에 새 content 능력이 있다고 추정하지 않고 해당 observer의 정확 지원/보호·검증 근거가 없으면 UNAVAILABLE다.

## 4. exact scope / credential / 일회 nonce

고정 scope 키:
protocolVersion, purpose, installationId, projectId, sourceRootRef, connectorRef, registrationRef, observerRef, hostFingerprint, pathHintHash, userId, clientId, credentialGeneration, controlGeneration, basePolicyRef, contentPolicyRef, targets, limits, requestedAt, expiresAt, reason.

scopeDigest=SHA256(canonical UTF-8 scope), requestRef={id,version:1,contentHash:scopeDigest}. root 원문은 기존 방식처럼 서버가 exact 선언 snapshot/hash를 검증한 뒤 보호 permit에만 전달한다. observerRef는 승인된 구현/바이너리의 불변 참조이지 caller가 적은 image hash만이 아니다. URI·pathHint를 실제 root 권위로 자동 승격하지 않는다.

limits 권장 고정값: maxFiles=200, maxFileBytes=2097152(문서 본문2MiB), maxTotalBytes=20971520(20MiB), maxObservationMs=30000, maxReportBytes=1048576. 성공 바이트는 이 한도 이내다. EOF 확인 중 변경 탐지용으로 **요청 전체에서 추가1바이트까지만** 읽고 양수면 즉시 전체 관측 중지/CHANGED; 그 바이트를 전송·저장하지 않는다. 최대 실제 읽기는20MiB+1이며 재시도/재해시로 누적 한도를 초기화하지 않는다. 기존 metadata 200개/30초 상한은 변경하지 않는다.

요청 수명≤10분·현재 세션/양 정책/등록 기한 중 최소, challenge≤60초, 별도 credential≤60초·요청 잔여기한 중 최소다. 실제 수치는 결정 전 제안이며 기존 A3 2시간/2분/5분을 바꾸는 것이 아니다.
- credential scope SOURCE_DOCUMENT_CONTENT_HASH_ONLY, prefix av3sch1_ + random32byte base64url. 서버는 digest만 저장한다. 새 키를 자동 생성하지 않는다.
- preflight 정확 키={protocolVersion:1,purpose:SOURCE_CONTENT_PREFLIGHT,installationId,projectId,connectorRef,registrationRef,observerRef,requestRef,scopeDigest,publicKeyFingerprint,clientNonce,expiresAt}.
- challenge는 위 결박에서 purpose=SOURCE_CONTENT_EXCHANGE, serverNonce32byte·issuedAt를 추가하고 짧은 expiresAt로 고정한다. 동일 preflight만 재조회하고 기한/nonce를 갱신하지 않는다.
- ISSUE는 {step:ISSUE,challengeId,payload,signature}; payload는 원 challenge 전체와 동일해야 한다. 현재 등록/양 정책/주체·서명·한도 검사 뒤 challenge1회 소비/credential digest를 같은 transaction에 저장한다. ISSUE 원문 응답 유실은 RECONCILE_REQUIRED, raw token 재발급/재생0.
- permit은 scope/root/credential 시각과 별도 observationRequestRef·observationNonce32byte/issuedAt/observeBefore를 고정한다. 관측 nonce는 report 수신 transaction에서 한 번만 소비한다. challenge nonce와 다르고, 새 관측/재시도 창을 만들지 않는다.
- 교환 실패 카운트는 현재 등록 key로 유효 서명한 오용만 유한5회에 포함한다. 익명/위조서명은 정상 요청을 잠그지 못한다.
- status-only·A3 credential/서명·다른 request/key·만료·회수·세대 변경은 거절. raw token은 메모리만, argv/env/파일/일반 로그/Git/대화0.

P-256/SHA256 IEEE-P1363 64byte canonical base64url 서명 형식과 canonical serializer는 재사용 가능하다. domain은 각각 ASCII ANVIL_SOURCE_CONTENT_PREFLIGHT_V1 + NUL, ANVIL_SOURCE_CONTENT_EXCHANGE_V1 + NUL, ANVIL_SOURCE_CONTENT_REPORT_V1 + NUL 뒤 canonical payload다. 기존 A3의 LF domain 또는 등록/ownership domain으로 대체하지 않는다. 키 재사용 가능 여부와 purpose 제한 signer의 실제 지원은 미확인이다.

## 5. native 관측·race·EOF·취소·부분 실패

지정 Windows-local NTFS·정확 root/상대 FILE만. 원 root/중간 directory/file handle을 유지하며 상대 열기, reparse/volume 이탈/비정규파일/링크수≠1/대소문자 중복·ADS/UNC/WSL 추측 mapping을 거절한다. FILE_READ_DATA는 새 권한이며 파일 쓰기/삭제/실행·열거·재귀·Git 호출을 허가하지 않는다.

동일 파일 handle의 identity/크기/수정시각·root 귀속을 전후 대조하고, 처음 길이만큼 순차 청크≤64KiB로 raw-byte SHA256을 계산한 뒤 EOF를 확인한다. 짧은 읽기는 즉시 EOF라 간주하지 않고 0반환/실오류를 구별한다. 길이 증가/감소·identity/시각/경로 교체·예산 초과면 hash를 성공 결과로 내지 않는다. 같은 내용의 CRLF/BOM/UTF-8 정규화0이며 Git blob hash와 다르다. source 내용을 문자열로 만들거나 외부 parser/LLM에 전달하지 않는다.

공유 쓰기/삭제를 거절하는 열기를 시도하되 기존 writable mapping·관리자/커널/악성 동일사용자에 대한 완전 격리를 보장하지 않는다. 재오픈한 같은 path의 metadata만 맞아도 원 파일이라고 하지 않는다. 전후 검사만으로 ABA/관측 도중 악의적 복원까지 절대 배제했다고 하지 않는다. 실제 지원·위협모델을 만족하지 못하면 UNVERIFIED/UNSUPPORTED로 닫는다.

단조 전체30초·최초 permit 잔여기한 중 최소, UTC 역행·취소는 전체 중단. 이미 읽은 바이트를 재사용해 새 관측 창을 만들지 않는다. 타임아웃은 OS I/O/프로세스 종료 증거가 아니며 원 보유 자원 정리 확인과 분리한다. 실패/취소 뒤 다음 파일 열기0·지연 completion 채택0. 모든 target을 같은 순서로 보고하되 미시도 항목도 UNVERIFIED/NOT_ATTEMPTED로 명시한다. 하나라도 실패하면 전체 보고는 부분 결과이며 **어떤 파일도 LINK 근거로 채택하지 않는다**. 자동 재관측/남은 파일 재요청0.

중요한 한계: 이 안은 **명시 관측 시점의 byte 일치**를 기록한다. 파일시스템과 원격PG의 원자 transaction/COMMIT 순간 파일 동일성·이후 불변을 보장하지 않는다. 잠금 해제 후 수정·교체될 수 있다. UI는 관측 시각과 신뢰 범위를 붙이고 상시 현재 MATCH라고 표시하지 않는다. 연결/착수/제출/재개 시 재관측한다. COMMIT 순간까지의 엄밀한 파일 lease를 요구하면 별도 분산 lease/취소·crash 계약을 먼저 결정해야 하며, 이를 조용히 축소해서 링크를 활성화하지 않는다.

## 6. exact report / freshness / 진위 gate

보고 정확 키:
protocolVersion:1, purpose:SOURCE_CONTENT_REPORT, commandId, installationId, projectId, requestRef, scopeDigest, observationRequestRef, observationNonce, connectorRef, registrationRef, observerRef, hostFingerprint, observedAt, finishedAt, root, files, localEvidence, reportHash, signature.

root={state,facts,reasonCode}; 성공 facts={declaredRootRef,kind:DIRECTORY,canonicalPath,volumeSerialHex,fileIdHex,reparse:false}.
files는 target과 동일 개수/순서·각1개로 {relativePath,documentRef,state,facts,reasonCode}.
성공 state=HASHED, facts={kind:REGULAR_FILE,volumeSerialHex,fileIdHex,reparse:false,linkCountDecimal:"1",sizeBytesDecimal,lastWriteFileTimeDecimal,blobHash,bytesReadDecimal,eof:true,identityBeforeHash,identityAfterHash}. 두 identity hash는 고정 metadata(identity/size/time/link/reparse) canonical hash이고 전후 동일이어야 한다. bytesRead는 size와 같아야 한다. 실패 state=MISSING/DENIED/CHANGED/TOO_LARGE/TIMEOUT/CANCELLED/UNVERIFIED, facts=null·고정 code만. raw 내용/예외/argv/임의 path/추가 키는 거절한다.

localEvidence={kind:NATIVE_CONTENT_HASH_REPORT,observerRef,ownedProcessRef,observationRequestRef,completed:true|false}. 이 값 자체는 진위를 증명하지 않는다. reportHash는 signature/reportHash 제외 보고 전체의 canonical UTF-8 SHA256이다. 보고 서명 바이트는 ASCII `ANVIL_SOURCE_CONTENT_REPORT_V1` + 단일 NUL + canonical UTF-8 JSON `{protocolVersion:1,purpose:"SOURCE_CONTENT_REPORT_PROOF",installationId,projectId,connectorRef,registrationRef,observerRef,requestRef,scopeDigest,observationRequestRef,observationNonce,reportHash}`로 고정한다. Ref는 정확 {id,version,contentHash}, 나머지 식별자는 scope의 문자열이며 reportHash/scopeDigest는 소문자 64자리 hex다. 서버는 원 저장 scope/permit에서 값과 타입을 재구성하고 보고 값을 신뢰해 덮어쓰지 않는다. 현재 세대는 scopeDigest로 결박하고 수신/소비 때 원 scope와 현재 상태를 다시 비교한다. preflight/exchange는 각 고유 NUL domain 뒤 signature 없는 원 payload 전체를 canonical 직렬화한다. 동일서명·다른nonce 또는 파일 hash만 잘라 서명한 것은 거절한다.

서버 now로 만료/회수/현재 주체·정책·등록·root 버전을 검사하고 receivedAt은 서버가 정한다. 보고 구간≤30초, 주장 시계 오차±5초 안에서 issuedAt−5초≤observedAt≤finishedAt≤receivedAt+5초, receivedAt<모든 만료시각을 요구한다. 성공 관측의 native 단조 기한은 별도 검사다. LINK 사용 시 server receivedAt부터≤30초·원 요청/observer 검증 기한 중 최소이며 연장0. 이 freshness는 위 관측 이후 race를 없애는 증명이 아니다.

수신 성공은 CONTENT_REPORT_STORED/CONNECTOR_REPORTED/OS_UNVERIFIED일 뿐이다. 채택에는 **서버가 보유한 approved observer 구현/바이너리·원 factory/정확 요청/nonce/권한·실제 지원 gate와 current verifier가 낸 별도 검증 receipt**가 필요하다. protected signer는 원 native 결과→scope/nonce 조립 경계를 통해서만 사용하고 caller hash/임의 signer callback echo를 받지 않는다. 실제 concrete verifier/보호 채널·목적 제한 signer가 없으면 receipt 발행0/LINK 412다. 서명 유효성·바이너리 hash·native flag 하나만으로 OS 진위/현재 권위를 만들지 않는다. 관리자/커널·보호 주체 침해 제외를 포함한 실제 신뢰 가정은 실행 검토에서 명시하며 아직 충족됐다고 하지 않는다.

## 7. 서버 문서 결박·LINK 원자성·옛 이력

### 순수 codec 상세화 기록 — 2026-10-23 Main 비의미 보완

승인 부모 raw SHA256 11AB746A30809096F22F52E73A8C3F15C2EA8793A635AA988B10335DC209066F의 범위/권한/한도는 유지한다. context는 정확 {scope,declaredPathHint,requestRef,observationRequestRef,observationNonce,issuedAt,observeBefore,receivedAt}이며 보호 permit의 원 선언 declaredPathHint UTF-8 hash만 scope.pathHintHash와 비교한다. handle에서 관측한 canonicalPath는 별도 주장이고 선언 문자열과 같다고 요구하지 않는다. 원 root ref/identity·실제 handle 귀속과 진위는 별도 current verifier 미연결 경계다. context는 한 번 복사한 값을 검증/서명 바이트 조립에 함께 사용한다.

root 성공 state=OBSERVED, 파일 성공=HASHED, 실패 facts=null로 고정한다. identityBeforeHash/identityAfterHash는 정확 {kind,volumeSerialHex,fileIdHex,reparse,linkCountDecimal,sizeBytesDecimal,lastWriteFileTimeDecimal}의 canonical hash이며 전후 같고 보고 facts에도 맞아야 한다. EOF=true/bytesRead=size·uint64·단일 링크/같은 volume·파일/합계 한도를 대조한다. 성공 파일 hash/길이가 문서 Artifact와 다르더라도 관측 주장은 보관 가능하며 실제 LINK의 문서 raw 일치는 §7 서버 단계에서 별도로 거절한다.

고정 실패 이유는 MISSING:PATH_NOT_FOUND, DENIED:ACCESS_DENIED/REPARSE_DENIED/OUTSIDE_ROOT/NOT_REGULAR_FILE/ROOT_KIND_INVALID/HARDLINK_DENIED, CHANGED:IDENTITY_CHANGED/LENGTH_CHANGED, TOO_LARGE:FILE_LIMIT_REACHED/TOTAL_LIMIT_REACHED, TIMEOUT:TIME_LIMIT_REACHED, CANCELLED:CANCEL_REQUESTED, UNVERIFIED:OBSERVER_UNAVAILABLE/UNSUPPORTED_FILESYSTEM/ROOT_UNAVAILABLE/NOT_ATTEMPTED다. root 실패 뒤 파일은 모두 UNVERIFIED/ROOT_UNAVAILABLE, 첫 파일 실패 뒤 남은 파일은 UNVERIFIED/NOT_ATTEMPTED만 허용한다. completed는 root/file 전체 성공 여부와 같아야 한다. raw 예외/본문은 받지 않는다.

이 codec의 60초 관측 permit 기한/30초 주장 구간·서버 만료 검사는 실제 단조 I/O 예산·nonce 소비·서명 진위가 아니다. 서명 필드는 canonical 64byte P1363 모양만 검사하고 검증된 서명이라고 하지 않는다. root 경로/identity·native evidence도 주장 수용일 뿐이다. 모든 보고는 CONNECTOR_REPORTED/OS_UNVERIFIED로만 취급하고 current verifier 미구현 상태에서 LINK 412를 해제하지 않는다.

최초 지원은 확정 문서 exact 버전의 content.body ArtifactRef와 소스 raw bytes의 일치다. 서버가 같은 project의 보호 Artifact 원본을 읽어 hash/길이를 재확인하고 QUARANTINED/누락/잘못된 저장키/다른 버전은 거절한다. 파싱·정규화된 파생 텍스트나 임의 import 후보를 원 raw 파일과 자동 동일시하지 않는다. 서버 본문과 다르면 최초 link는 CONTENT_MISMATCH로 거절한다. 차이 수집/제안·별도 분리는 기존 FN03/FN04의 후속이며 이번 hash-only 보고에 원문 송신 기능은 없다.

linkDocumentSource는 한 서버 transaction에서 project 제어→현재 정책/등록/root/doc→원 content 요청/보고/검증 receipt를 고정 순서로 잠그고, exact ref/hash/경로/현재성·미소비/기한을 재검사한다. 원문 재해시 후 최종 주체/세대·기한을 다시 검사하며 늦은 성공0. 전체 보고가 성공한 경우에만 report의 target별 검증 계보를 발행한다. 각 계보는 (observationRef,targetIndex,relativePath,documentRef)를 고정하고 최초 양성 receipt는 한 번만 생성한다. 회수/무효는 predecessor를 둔 새 버전이며 최신 버전이 회수·만료되면 과거 양성으로 fallback하지 않는다. 같은 보고/target의 재양성 발행은 금지하고 새 관측을 요구한다. 해당 target의 양성 verification Ref 하나는 링크 head의 same-project UNIQUE provenance로 한 번만 소비한다. report는 최대200 target의 개별 LINK를 허용하되 요청 전체를 첫 LINK에서 소진하지 않는다. 동일 원 명령은 기존 receipt만 반환하고 다른 명령의 재소비는409다. 명령/authorization receipt/audit·LINKED v1/event/head와 이 target 소비를 원자 저장한다. 중간 실패 rollback·COMMIT 응답유실 UNKNOWN/동일 원명령 재조회만, 새 INSERT 자동 반복0.

기존 sourceSnapshotRef payload 키는 유지하되 새 LINK에는 **새 content observation의 정확 Ref**만 허용하고 metadata snapshot Ref는412다. 옛 링크/metadata Ref는 변환하거나 VERIFIED로 올리지 않는다. 대상 typed namespace는 새 content-evidence 조회에서 명시한다. 기존 snapshot/event 형식·DETACHED v2 이력은 보존하며 새 검증 ref는 head의 별도 불변 provenance 열·same-project FK로 연결한다. 보호 provenance가 없거나 legacy이면 UNVERIFIED다. 검증 ref가 snapshot hash에 직접 포함되지 않는 이 설계의 한계를 guard/FK/immutable receipt 대조로 보완하며, 기존 event 재해시/overwrite0이다.

파일/PG 원자성은 위 §5 한계 그대로다. 새 byte 관측으로 현재 등록/정책·writer/Agent 실행권한·확정 baseline이 생기지 않는다.

## 8. 저장 대안과 B의 정확 변경 후보

A(혼합형)는 기존4표에 관측 kind·신규 CHECK/guard·분기 reader를 추가하는 forward 변경이 필요하다. 기존 SQL 파일을 수정하지 않아도 적용된 기존 인증/표의 행위 변경이므로 별도 승인이 필요하다. 새 표가 반드시 필요하다는 주장은 아니다.

B(격리형) 후보4표:
1. source_content_requests: PK(project_id,id),version1,scope_json/hash·created_command/주체/세대/양policy·source/등록/observer exact refs·원 기한. 같은 행의 교환 상태에 preflight hash/challenge payload·nonce/발급·만료·proof/실패0..5, credential digest/scope/발급·만료/회수/보고소비 command를 보유한다. 연결 소비는 요청 단위가 아니라 아래 target별 검증 provenance로 관리한다. scope/최초 자료 불변, 허용 상태 전이만 guard; raw token0·자동 재발급0.
2. source_content_observations: PK(project_id,id,version1), request_id UNIQUE, report_command UNIQUE, report_json/hash/signature·관측/수신 시각·집계. immutable CONNECTOR_REPORTED/OS_UNVERIFIED, 요청·동일 project refs FK. UPDATE/DELETE0.
3. source_content_verifications: PK(project_id,id,version), exact observation/request/observer implementation refs·targetIndex/relativePath/documentRef·검증 시각/기한/판정/고정 이유/근거 refs. 계보당 양성 version1은 한 번만 허용하고 (project,observation,targetIndex)의 양성 계보 UNIQUE를 강제한다. 회수/invalid는 exact predecessor를 둔 새 버전 append이며 최신 버전부터 판단하고 과거 양성 fallback/동일 보고 재양성은 금지한다. 검증 주체는 서버의 실제 current verifier만이며 caller flag/DB row 존재는 권위가 아니다. link 소비는 링크 head의 양성 Ref UNIQUE provenance와 명령/audit를 동일 transaction에서 결박한다.
4. source_content_policy_events: project 단위 순차 버전의 append-only 한정 정책/회수 이력. subject/허용3연산/targets/상한·현재 controller/재인증·관리 허가·정확 predecessor ref. project lock+기대 버전 CAS로 최신 이력 자체를 먼저 확정한다. 최신이 회수/만료/DENY이면 거절하고 오래된 AUTO로 fallback하지 않는다.  generic materialRules/기존정책 head를 바꾸지 않는다. 최초 실제 관리권한 부여는 별도이며 default deny다.

추가 forward 보완: document_source_links에 nullable content_verification_ref를 새 provenance로 추가하고 새 LINK만 NOT_NULL·exact receipt/doc/root/blob/observation/target binding을 강제한다. (project_id,양성 verification의 id/version/contentHash)에 UNIQUE를 두어 target별 소비를 보존한다. detach 후에도 provenance를 지우거나 재사용하지 않으며 소비만을 위한 다섯 번째 표는 추가하지 않는다. 기존 SELECT·detach 권한은 보존하고 INSERT는 새 link 전용 guard/현재 명령·receipt·별도정책이 모두 있을 때만 한정 허용한다. 새 정책 관리·권한·new target INSERT의 app 권한은 명백한 delta이며 실제 부여0이다.

미적용 SQL의 번호는 source inventory 충돌검사로 정하되 실제 실행 manifest·DB 적용은 별도다. 승인된 source/미적용 SQL 작성과 실제 표/열/함수 생성·권한 부여를 구분한다. source-only rollback은 미등록 유지·일반 revert, 실제 적용 후는 append 회수/forward repair다. DROP/기존행 변환/reset/force0. 위4표/열은 source 구현 기준인 B의 범위이며 실제 schema 적용 승인이 아니다.

## 9. egress·목적·보존·노출

로컬 지정 connector→같은 사용자 소유 Anvil API만. payload는 §6의 정확 root/file metadata·상대경로/문서 refs·바이트 길이/파일 SHA256·scope/nonce·observer/서명이다. **파일 본문·파생 텍스트·diff·Git/다른 프로젝트·Secret 원문 송신0**. hash도 짧은/알려진 내용 추측·파일 존재 fingerprint를 노출할 수 있음을 미리 알리고 대상/목적/수신 서버를 명시한다. 이후 원문 수집은 별도 기존 import 절차·허가·격리 검사를 거친다.

scope의 예상 문서 hash를 알고 있다는 이유로 observer의 echo를 원관측이라 하지 않는다. protected native/provider 검증 gate가 필수다. 소스 변경 중 비밀을 새로 포함할 수 있고 hash-only는 완전 비밀 탐지가 아니다. QUARANTINED 서버 자료는 미리 거절하되 unknown secret 탐지 완료를 주장하지 않는다.

OWNER만 경로/개별hash/원보고를 보호 조회, VIEWER는 refs/상태/집계/관측시각만. 일반 감사/로그/Git/대화에는 안전한 ref·집계/고정 이유만. native 청크는 메모리만/평문 스풀·본문 파일0, 정리/만료 시 참조와 버퍼를 회수하되 물리적 완전 소거는 보장하지 않는다. 서버 불변 보고/검증/정책·링크 이력은 기존 감사 보존 정책을 따르고 자동 삭제0. credential digest와 소진 상태는 감사 보존하되 raw token은 보존하지 않는다.

## 10. 필수 검증과 지원 제한

- 순수: v1/A3/등록 서명 거절 회귀, exact keys/중복 key·type/Unicode/size, scope/fullref/다른project·세대·현재정책/회수·nonce 일회/서명 재사용·기한·clock/부분 결과·추가 권위 거절.
- raw bytes: empty/BOM/CRLF/동일 size 다른 내용·독립 SHA256, 2MiB/누적20MiB/추가1byte·201파일·파일중복/EOF/짧은 읽기/증가·축소·동일 path 교체·reparse/alias/다른 volume·memory-mapped/외부 writer 위협의 실제 지원 범위.
- 내구/서버: artifact quarantine/hash/길이·문서 구버전·nonce/검증/명령/CAS 경합·위조 session setting/DML·current verifier 없음·COMMIT 유실/rollback·Node/PG canonical 동일성. 실제 PG 증거 전 적용/수용0.
- native/보호: 원 factory/file handle·observer/binary·signer purpose·TLS/server identity·늦은 completion/취소·해시중단/정확 자원정리·허가종료. 각 실제 실행은 exact source/자원/기한의 별도 결정 전 NOT_RUN.
- UI06: 문서/파일/목적/egress·관측시각·신뢰 한계 preview→명시 요청→partial/expired/UNKNOWN 구분→새 content receipt가 있는 경우만 LINK 준비. 기존 source history/list/detach/승인·buffer·늦은 응답·타 project 격리 유지.
- hash-only로 COLLECT_PROPOSAL 원문 수집, 자동 덮기/확정·Agent 실행·baseline VERIFIED는 지원하지 않는다. 실제 content verifier 부재·허용 위협범위 밖이면 UNAVAILABLE/UNVERIFIED이며 이를 추후 테스트로 숨기지 않는다.

## 11. 지금 요청하는 결정과 비승인 범위

채택된 권장 범위: **B 병렬 source 계약의 source/codec/미적용 forward SQL·기본 미등록 server/native/UI·합성 검증까지 구현한다.** 링크 실제 쓰기/정책 생성·새 키/credential 사용·파일 읽기/OS/native compile·DB 적용/서비스 반영·Agent/비용·Oracle·main은 포함하지 않는다. 실제 단계는 exact 구현/QA 근거가 준비될 때만 별도 효과를 요청한다.

채택한 의미는 §5의 관측 시점 일치·사후변경 재관측 경계다. COMMIT 순간까지의 강한 파일 lease는 미지원이며 필요하면 별도 분산 lease 계약을 보완한다. 이 선택도 actual verifier/등록 권위·QA를 생략하는 승인이 아니다.

전체계획 완료/전체 대기 전환이 아니며 Main은 영향 없는 승인 작업을 계속 선정한다. 기존 Bv3와 D2·플랫폼 특정 거절을 이 후보로 우회하지 않는다.
