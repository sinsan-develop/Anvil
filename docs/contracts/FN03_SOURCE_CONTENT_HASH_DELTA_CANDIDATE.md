# FN03 최초 소스 연결 — 내용 hash 관측 delta 결정 후보 v1

- **2026-10-23 FN03 원report/root·target SOURCE: 9eb0c40a HEAD·trackedclean/보호8대조(raw00ba7d)후미적용0040에별도content failure enum과report_payload_shape를작성했다. 기존 TS report codec의root exact3/facts6/선언root-ref·kind/identity/UTF16canonicalPath/제어문자,files exact5/원target순서·doc-ref/HASHED facts12/동일volume·link1·uint64size/filetime·bytesRead=size·EOF·identity7canonical hash/개별·누적한도,root실패전부ROOT_UNAVAILABLE·첫파일실패후NOT_ATTEMPTED·localEvidence exact5/completed집계를대조한다. canonicalPath는선언문자열과달라도되며보고blobHash를Artifact hash와같다고강제하지않는다(실OS/원문동일성/LINK는별도). 기존보고묶음에outer exact20/원scope hash/요청별 maxReportBytes·maxObservationMs/noncecanonical·서명64byte형식을연결했다. 이는형식/주장대조이지서명진위/OS/권위검증이아니다. 미래보고fixture는fullscope/root/files/evidence로보강했지만원교환/permit/명령/FK전체fixture는아니다. 기존nonce불일치반례는다른canonicalnonce로바꿔형식가림을피했고,HASHED0byte·root실패·stop/suffix·target/link/EOF/identity/집계·개별/누적cap·요청별관측시간/보고크기반례20건을추가했다. 개별/누적은identityhash를,요청별cap은scopeDigest/reporthash/audittarget을함께맞춰가림을줄였다. 보고25→45/생성50=미래95ASSERT전부NOT_RUN이다. 실제SQL/PG/구문·REDGREEN/COMMIT/SET CONSTRAINTS IMMEDIATE·잠금/CAS/서명·현재등록/원문/OS는미구현/미검증,실제수행diff0/hash/수량읽기(raw9d51d0)뿐이며TS변경0으로직전104재실행0이다. 0040 raw25C389301FE008F2FA4A2C619EFC514723D30D181595670123B4B413044C53F9/미래보고시험75D17CF5F8FFD403A5150A62698EC93BAC946520BA4CCDEF846991C600296498. 기존M1네건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·audittrigger미연결/권한0·실verifier없음412/실DB·키/권한/native/OS·서비스·Agent변경0유지. 독립정적검토진행중이며전체계획완료아니다.**

- **2026-10-23 FN03 원permit 중첩 SOURCE: b2358dd1 HEAD·trackedclean/보호8을대조(rawf6eac4)하고미적용0040에 source_content_request_permit_shape를작성해finalrequestwrapper의exchange후보대신연결했다. 원exchange/phase·scope를선행검사하고미발급NULL그룹또는exact16permit/3root/3credential·원scope/request/hash/관측ref·ONLYscope/원credential시각·UTF16경로4096/nonblank/제어문자제외/rawUTF8hash·canonical32nonce/digest/교환client-servernonce재사용거절·false4/추가token거절을대조한다. serverNow는보관당시permit발급이상/observeBefore미만/rowupdated이하이며현재시간허가로쓰지않는다. 미래정상serverNow>issued 및과거UNKNOWN조회, nonce재사용+맞춘digest·serverNow=관측기한+맞춘updated 등18반례를추가했다. 생성미래시험32→50/보고25=합75ASSERT전부NOT_RUN이며추가fixture는순수permit투영이지원생성명령/receipt전체저장fixture나발급/COMMIT가아니다. 실제SQL/PG/구문·REDGREEN/COMMIT/SET CONSTRAINTS IMMEDIATE·잠금/CAS/서명·현재등록·키/credential발급은미구현/미검증이다. 실제수행diff0/hash/반례수량읽기(rawae9f6b)뿐, TS변경0으로직전104재실행0이다. 0040 raw2971E9C3B14AC174B009A295EB3B45962BF3A36E86BF9FB1F2EF34B3FC40EA43/미래생성시험96129CBFCCD3A45E20B11DDA9CF5B838FCB21B246E5775D66879D07347445F94. 기존M1네건/원I1보정미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·기존audittrigger미연결/권한0·실verifier없음412/실DB·권한·키/native/OS·서비스·Agent변경0을유지한다. 독립정적검토진행중이며전체계획미완료, 다음은원report중첩/root·target 사실의SQL결박SOURCE다.**

- **2026-10-23 FN03 미연결 감사 callback/원 교환 SOURCE: 02c0a0d1 다음으로 audit_events용 AFTER ROW INSERT callback 함수만 분리하고 CREATE TRIGGER/GRANT는 추가하지 않았다. 최종event 역검사false면거절하며기존감사저장경로/권한변경0이다. 별도 nonce32 순수형식함수는32byte decode/encode canonical일치만검사하고실nonce발급/키신뢰/소비는하지않는다. request_exchange_shape는원scope/phase·version1/row project·원시각/범위/hash를묶고 preflight exact12/challenge14·고유목적·동일ref/key/clientnonce·서로다른servernonce·원preflight hash/1MiB/원만료·당시challenge발급/만료를검사하며finalrequestwrapper에연결했다. 새자료를발행하거나과거자료를현재허가로승격하지않는다. 기존reviewer 최초30ASSERT범위delta 정적C0/I0/M0·실행/수정0회신. Main은그뒤CREATED의원row/scope/version1도초기에결박하도록조건·미래2반례를명확히추가했다. 생성시험은22→32ASSERT(신규10), 보고25와합57이며전부미실행/NOT_RUN이다. 추가2건을독립실행PASS로표시하지않고actualSQL/PG/구문·COMMIT/SET CONSTRAINTS IMMEDIATE·감사역경로실호출/권한·잠금/CAS·현재등록/서명은여전히미구현/미검증이다. 실제검증diff0/hash/수량읽기(raw7cc242/523436), TS변경0으로직전104재실행0이다. 0040 raw1296686D8BF4B7DAF60868227A2D2A953EA51021152D4B40063FA3F91B6E4356/생성미래시험E3C13765929FD002E494AAD231B35C64254DF2F611A881C520D3C6DB4619AD19. 기존M1네건/원I1미실행/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미적용/runner미등록·실verifier없음412/실DB·키·권한/native/OS·서비스·Agent변경0을유지한다. 다음은원permit중첩과관측nonce/기한의SQL결박이며전체계획완료아니다.**

- **2026-10-23 FN03 감사 역검사/deferred SOURCE: 3613d113 기준 HEAD·trackedclean/보호8을 재대조(raw24bceb)하고 미적용0040에 source_content_audit_target_shape·audit_final_bundle_shape와 새 content 표 전용 final callback/constraint2 선언을 작성했다. 감사는 sameproject event→target ID로 관측 후보→생성commandID/요청targetID/관측requestID로 요청 후보max2를 찾고 fullref/command/source를 대조한뒤 기존 최종행 wrapper로 중복을 재확인한다. 올바른 hash/version/source만 사전선택해 잘못된 행을 숨기지 않는다. 고유 content protocol/reason의 고아는false, 무관감사의true는content대상이아님만뜻한다. 신규미래10ASSERT를기존시험에추가해보고25/생성22이며전부NOT_RUN이다. 새 requests INSERT/UPDATE 및 observations INSERT만 DEFERRABLE INITIALLY DEFERRED 선언을 추가하고 callback은최종row재조회/요청키변경거절/AFTER·ROW·schema·연산검사를한다. INSERT에서OLD필드를평가하지않도록UPDATE중첩분기를썼다. 기존audit_events에는trigger를연결하지않았고감사역검사호출권한/기존감사영향·잠금/CAS·실SQL/PG·SET CONSTRAINTS IMMEDIATE/COMMIT원자성은여전히미구현/미검증이다. 선언추가≠실DB적용/활성화이며전DML/LINK거절·미등록/권한0·실verifier없음412를그대로유지한다. 실제검증은diff0/hash/반례수량읽기(raw35eba2/8c7c94)뿐, TS변경0으로이전104재실행0이다. 0040 raw62F759EDBDD7A5AAD73669C75D0DC9B132BA2A7DEF1D8451CAE430EC6B6F6607/보고시험3671EACCF07DB8527F90A7F6FD169CCA940669E0943401C76680961FD690705E/생성시험3E8F83733B956728BA7998C7028091914AB709AC61D7D6B7D6DE1816902A6137. 기존M1네건/원I1보정미실행·0039/보호8/원실패/Bv3/D2/특정거절/실DB·키·권한/native/OS·서비스·Agent변경0을보존한다. PMO가전달한 Selected model is at capacity 중단은제품/SQL실패나승인거절로세지않고모델/설정/권한변경없이같은작업을보존해이어갔다. 전체계획완료아니다.**

- **2026-10-23 FN03 생성 최종행/조회 결박 SOURCE: 4f4571a1 다음 단위로 미적용0040에 source_content_creation_bundle_shape와 source_content_request_final_bundle_shape를 작성했다. 원11키 생성 요청의8키 payload/canonical hash·정확10키 APPLIED 결과·HUMAN receipt digest/감사를 같은 요청에 대조한다. 보고 프로토콜 감사와 생성 HUMAN 감사는 분리하며 결과는 과거 CREATED/관측미발급/권위false를 유지한다. completed_at raw microsecond는 기존 reader/TS와 같은 ms정규화로 비교하며 미래 정상+400us/음성+1ms는 result시각도 함께 맞춘다. 조회 wrapper는 project/request PK→commands/receipt/생성감사/관측/보고감사 max2를 읽고 정상reason/source를 사전선별하지 않으며 query오류를 삼키지 않는다. 독립 생성 정적 C0/I0/M1은 SQL uuid 비null 대 TS uuidV1 범위차이(명령/operation/receipt/event ID)이며 새4번째M1로 보류·수정0이다. 기존3M1과 별개이고 실제 활성화/검수 전 남은 조건이다. wrapper 한정 정적 새C0/I0/M0·독립실행0이다. 미래 생성18ASSERT/SQL·PG·REDGREEN/COMMIT 모두NOT_RUN, wrapper 실제쿼리도미실행이다. 실제 수행은 diff check0/hash/수량읽기(raw787cb4/a9407d), TS변경0으로 직전104건재실행0이다. 0040 rawC8A493B066B77CE1A0CAA54029989C94AA3007F941E3A6C96E1FE6260C99F282/미래시험0D64D85EDD2CE93A275EDCECF06A56B75F41DC5247CA016507E965F5E979F472. 호출 snapshot 구조 대조일뿐 감사 별도삽입·고아감사 역검사/잠금/CAS·deferred trigger·COMMIT원자성/현재권위·서명은 아직미구현이다. 어떤 helper도 trigger/권한/route/runner에 연결하지 않았고 전DML/LINK거절·실verifier없음412·0039/보호8/원실패/Bv3/D2/특정거절/실DB·키·native·서비스·Agent변경0을 유지한다. 다음은 감사의 고아/중복 역검사와 deferred 연결 SOURCE를 영향 분리해 작성한다. 전체계획 미완료다.**

- **2026-10-23 FN03 보고 최종행 결박 SOURCE: bff8b1f2 다음 단위로 source_content_report_bundle_shape를 미적용0040에 작성했다. 요청 phase·미소비0/0 또는 관측/감사 정확1/1, 원 project/request/scope·보고GUID/nonce/context/hash/수신시각·CONNECTOR 감사 target/basePolicy/주체·시각을 대조한다. 회수 후 원 소비자료를 보존하고 기존 audit recorded_at의 microsecond를 유지한다. 배열이 실제 DB 전체 결과라는 증명/조회·COMMIT guard/원자 저장/현재권위/서명·nonce 실제소비는 아직 미구현이며 true가 권위를 뜻하지 않는다. Ruling: 기존 감사표에 새 trigger를 즉시 부착하면 관련 없는 감사 저장/권한에 영향을 줄 수 있어 이번에는 순수 최종행 predicate로 분리했다. 생성 command/receipt 결박과 양방향 deferred 검사·동시경합/실PG 증거가 후속 필수이며 미충족이면 계속 기본 거절한다. 독립 원검토 C0/I1/M0는 credential시각 대신 permit.issuedAt−5초 및 finishedAt<observeBefore 결박 누락이다. Main이 기존 report codec과 대조해 SOURCE를 보정하고 다른 hash/감사 불일치에 가리지 않는 반례2건을 추가했지만 SQL REDGREEN/수정PASS는 NOT_RUN이다. 미래SQL19ASSERT 전부미실행; 이번 실제검증은 diff check0/반례수량/해시읽기(raw09ffd9), TS변경0으로 직전104건재실행0이다. 0040 raw12D6200023CA6D7638A0A00094B0A9DC92CDB21D0C4C55409B81E8FD54A4FEE8/미래시험95FA8FE6BF79CB4322EB96A186C1468551E97C687351B5A4995C67981280A0A4. 기존3M1/0039/보호8/원실패/Bv3/D2/특정거절·전DML/LINK거절·미등록/실verifier없음412를 보존하며 실제DB접속/적용·키/권한/native/서비스/Agent 변경0이다. 전체계획 미완료이고 다음은 생성 command/receipt/감사 최종행 결박 SOURCE다.**

- **2026-10-23 FN03 stale 기대값 CAS SOURCE 결과: 고정 project/request/opaque digest 비교 조건을 작성하는 순수 planner와 같은 SELECT의 cas_digest 조회를 연결했다. digest는 불변16열·변경20키를 UTC/ms로 정규화한 SQL hash 후보이며 권한/서명/현재 상태 증명이 아니다. replay는 비교 조건도 반환하지 않는다. CAS5 RED(exit1 rawc255a9)→GREEN5/163.332ms, 조회 tag RED1/152.8811ms(raw0d47c7)→집중19PASS331.1001ms, 최종 직접인접104PASS1124.3931ms/typecheck/diff0(rawbe61db). 미적용0040 raw919BE038ADBD0957299DD235356D42250E427765E4B6D7C8DE8CB360495C793A 및 미래SQL9ASSERT(rawCDB8A6C442FC73597FB4520B855C3DF1832BC6BBACA905DD8CCBBEA203DD913E)는 미등록/미실행이다. 실제 SQL/UPDATE rowCount/동시경합/COMMIT 원자결박·현재 권위·OS·화면은 미구현/미검증이다. 기존3 M1·0039/보호8·원실패/Bv3/D2/특정거절·전DML/LINK거절·실verifier없음412를 보존한다. 다음은 생성·관측·감사/소비의 COMMIT 원자결박 SOURCE 선행이다. 전체계획 완료가 아니다.**

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

permit source의 exact16키는 {protocolVersion:1,purpose:SOURCE_CONTENT_PERMIT,scope,requestRef,scopeDigest,root,credential,observationRequestRef,observationNonce,issuedAt,observeBefore,serverNow,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false}다. root={sourceRootRef,pathHint,pathHintHash}, credential={scope:SOURCE_DOCUMENT_CONTENT_HASH_ONLY,issuedAt,expiresAt}이며 token/key/rawSecret은 없고 추가키를 거절한다. 신뢰된 서버 원자료 basis는 정확 {scope,requestRef,observationRequestRef,observationNonce,credentialIssuedAt,credentialExpiresAt,issuedAt,observeBefore}다. 원자료 자체의 인증/현재 권한은 이 순수 consumer가 만들지 않는다.

credential 원수명≤60초/요청 기한 이내, permit issuedAt은 credential 안, observeBefore는 permit 발급 후·credential 종료 이하이며 serverNow/수신 now는 원 관측기한 안이어야 한다. 순수 report context 변환은 아래8키만 반환하고 credential/권위 필드는 버린다. preflight/challenge의 신뢰 basis는 {scope,requestRef,publicKeyFingerprint}이며 fingerprint의 실제 현재 등록 귀속은 서버 후속의 책임이다. preflight는 원 요청 기한 안, challenge는 원 binding/서로 다른 canonical32byte client/server nonce·원 preflight 기한 이내60초만 허용한다. 이 상세화를 실제 교환·발급·서명·권한 활성화로 쓰지 않는다.

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

### 저장 SOURCE 중간 구현 기록 — 2026-10-23

후속0040의 request phase helper/BEFORE wrapper는 상태별nullable그룹과finite/ms·원요청10분·교환/credential60초·관측최소기한·소비/회수pair·실패상한/조기EXPIRED를검사한다. 이는열조합검사이며중첩preflight/challenge/permit/report의전체exact shape/서명/current를대신하지않는다. 미래phase 반례20건은완전table fixture가아닌typedrow phase 투영으로작성했고실행하지않았다.

별도전이helper는nongenerated 불변16열의ROW와변경20키의명시적projection을사용한다. BEFORE에서to_jsonb(NEW)로계산전생성열을읽지않는다. CREATED→CHALLENGED→ISSUED→REPORTED, 실패+1상한5·원challenge/credential/nonce/기한고정·보고1회·소비보존회수/만료·UNKNOWN재진입거절·동일원행replay를대조한다. wrapper는최초CREATED/updated=created와실제변경시각의transaction_timestamp~clock_timestamp ms창을요구한다. 미래전이18반례는같은ms소비ID교체와회수/UNKNOWN재진입·원자료변경을구분하되실행하지않았다.

이SQL OLD/NEW 검사는클라이언트의stale 기대값 CAS나동시경합·실제nonce소비·원문/현재권위·receipt/observation/audit의COMMIT원자성을대신하지않는다. 해당guard는아직미구현/미검증이고초기fullnested/생성/보고COMMIT결박도별도다. 실제PG구문·제약/trigger동작·REDGREEN·경합/CAS·COMMIT는모두NOT_RUN이다. 현재모든새DML/LINK거절·RLSfalse·권한0·route/runner미등록·미적용을그대로유지하며helper형태true를허가/제품완료로사용하지않는다.

후속 미적용0040에는 scope21키의 순수SQL 형태검사를 추가했다. 6개 fullref·UUID/hash/유한정수·5limits·원UTC/ms시각10분·targets/ArtifactRef·바이트상한/총량·문서/경로중복을 검사하고 request CHECK에연결한다. 기존metadata의 exact/ref/UTF16/Windows상대경로/고정NodeUnicode uppercase helper만재사용하며기존purpose·scope/정책허가는재사용하지않는다. JS trim공백집합을명시해비어있는 reason/mediaType를거절한다. 이는실행하지않은SQL source이며19미래ASSERT/실PG구문·제약·상호운용은NOT_RUN이다. 새정적M1은ECMAScript연도0000와PG BC/AD표현의차이이며기본isoV1계약을임의수정하지않고공통지원범위결정/검증미완료로보류한다. 기존생성시각분기·보고크기M1과별개이고동일형태완전호환/PASS를주장하지않는다.

동일계약의 관측nonce는원challenge의client/servernonce와도달라야한다. 기존reader의digest대조만으로는이조건을보장하지못해같은nonce/digest를함께바꾸는반례후명시적비교를추가했다. 이는원계약누락보정이지새nonce발급/현재권위·DB원자소비활성화가아니다. 원실패와보정전결과를보존하고기존보고/permit·생성감사검사는유지한다.

생성 증거의 순수 SOURCE inspector는 expected={scope,requestRef,createdCommandId}와 value={request,command,receipt,audit}를 복사·대조한다. request는 기존 ProjectCommand 11키의 requestSourceContentHash/targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null/원8키payload이며 전체 canonical requestHash를 사용한다. commands projection20키는 기존 scope/주체/client·controlGeneration/basePolicy·요청ID/operationID·authorizationReceiptID·APPLIED 결과와 결박한다. 결과10키 data는 exact {ref,status:CONTENT_REQUEST_RECORDED,requestRef,scopeDigest,storedState:CREATED,scope,observationPermit:NOT_ISSUED,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false}이며 evidenceRefs/warnings는 빈 배열이다. 기존 helper의 transaction_timestamp/now 영수증시각은 completedAt와 같고 clock 기반 scope.requestedAt보다 늦을 수 없다.

authorization_receipts projection8키는 같은 PROJECT/command·HUMAN user/client/basePolicy와 기존 scope digest 공식을 대조하고 approvalDecisionRef는null이다. audit projection14키는 동일 project/command/operation/target/basePolicy·actor/client·digest, 양의safe sequence/UUID event와 APPLIED/HUMAN_COMMAND/EXPLICIT_SOURCE_CONTENT_HASH_REQUEST만 수용한다. receipt 존재·hash 일치가 실제 현재 허가나 tamper-proof 서명을 뜻하지 않는다. inspector는 UNVERIFIED_CREATION_EVIDENCE_CANDIDATE/저장·실행·LINK false만 반환한다. content-policy 실제 허용·현재 세션/등록·COMMIT/감사 진위는 별도 미구현이다.

후속 reader SOURCE는 같은 SQL에서 request/생성commands20키/authorization_receipt8키/감사/관측을 LEFT JOIN·상관 조회하고 inspector를 호출한다. 감사는 같은 project/command의 최대2건을 가져와 결과가 정확1건인지 검사하므로 LIMIT1로 중복을 숨기지 않는다. 조회 projection은 위14키에 correctionOf를 더하고 먼저 null인지 확인한 뒤 inspector의14키로 전달해 정정 이벤트를 원생성 증거로 쓰지 않는다. scope의 원8키payload와 저장 commandId로 baselineRefs=[]/approvalRef=null/targetId=null/version0의 원request를 재조립하여 저장 request_hash와 대조한다. 반환 creationEvidence는 구조 후보일 뿐 실제 권위가 아니다. 이 SQL의 실제 PG/driver 실행은 NOT_RUN이며 원자 guard·route/DB에는 미연결/미활성이다.

보고 소비의 report_command_id는 connector의 원보고 GUID이며 기존 사용자 commands.id와 동일 개념이 아니다. 생성 HUMAN 영수증을 보고수신 허가로 재사용하거나 보고 GUID만으로 사용자 명령 FK/권위를 만들지 않는다. 보고 소비는 별도 프로토콜 감사·원nonce/observation/원보고/현재 검증과 일회 CAS를 결박해야 하며 이번 생성 inspector의 검수 범위가 아니다.

후속 SOURCE의 보고 소비 inspector는 정확20키 저장 view와 protocol audit16키를 대조한다. 감사는 원project/CONNECTOR connectorId·registrationId/client/basePolicy/request scopeDigest 및 원reportRef target, APPLIED/SOURCE_CONTENT_REPORT_STORED/SOURCE_CONTENT_OBSERVATION_PROTOCOL이어야 한다. HUMAN commandId/operationId/approvalRef와 correctionOf는null, sequence는양의safe정수·eventUUID, 기록시각은 원요청시각이상·보고소비시각이하이다(기존 transaction_timestamp가 clock 기반수신시각보다이를수있음). 보고GUID는원view에서보존하고실제current/서명·nonce/CAS검증으로승격하지않는다. 회수후에도원소비사실은보존한다. 반환은UNVERIFIED_REPORT_CONSUMPTION_CANDIDATE/저장·실행·LINK false다.

reader SOURCE는같은SQL에서관측exact fullref target/project에해당하는감사최대2건을읽는다. 정상/허용source를WHERE에서먼저골라과거적합1건을살리지않고정확1건을요구하며관측이없으면감사도0건이어야한다. 기존report codec·permit/nonce·소비GUID/time 대조후이검사를연결한다. 실제PG/driver·COMMIT/경합/CAS·현재등록/정책/서명/OS의확인은미구현/미검증이며SQL실행·쓰기권한/route활성화는0이다.

저장행 adapter source는 한 same-project SQL에서 request/최초 생성 command/관측을 LEFT JOIN하여 누락을 숨기지 않고 원20키 view로 투영한다. 실제 query/PG 상호운용은 미실행이다. 최초 명령의 요약·scope/주체/세대/원시각과 challenge/permit/보고 codec·관측 nonce 및 소비 command/time을 대조하지만 현재 인증/정책·서명/OS·전체 receipt/payload/audit·CAS는 대신하지 않는다. 반환은 UNVERIFIED_REQUEST_RECORD_CANDIDATE/저장·실행·LINK false뿐이며 route 미등록이다. 과거 만료 기록 조회가 현재 permit 사용 권위는 아니다.

이전 checkpoint의 preflight_digest-only 누락은 후속 SOURCE에서 preflight_json 보존 열로 보완했다. challenge와 최초 원문의 NULL묶음·1MiB·canonical hash CHECK를 미적용0040에 추가하고 reader는 저장 원문/hash와 기존 exchange codec을 당시 발급시각으로 대조한다. challenge에서 원 preflight를 역으로 재구성하지 않는다. 이는 원문 구조·hash/결박 검증이지 등록 키 진위/서명 증명이 아니며 실제 SQL/PG 적용·검증은0이다. 원 receipt/관리권위·DB 원자 guard는 여전히 후속 미구현이다.

원요청 전이 source view는 정확 {scope,requestRef,state,preflightDigest,challengeDigest,challengeIssuedAt,challengeExpiresAt,credentialIssuedAt,credentialExpiresAt,observeBefore,credentialTokenDigest,observationRequestRef,observationNonceDigest,reportRef,reportCommandId,reportConsumedAt,revokedAt,revokeCommandId,exchangeFailures,updatedAt} 20키다. 원 scope/ref·최초 교환/credential/관측자료를 불변으로 두고 정해진 단계에서 null→값만 허용한다. 보고/회수는 기존 소비자료를 보존한다. 현재 단계의 기한은 원요청/아직 소비하지 않은 challenge 또는 발급된 credential/관측 최소값이며 새 기한을 만들지 않는다. 실패 count 후보는 한 번에1씩 최대5, UNKNOWN에서 재발급/재진입0·terminal replay는 저장0이다.

전이 판정은 UNVERIFIED_TRANSITION_CANDIDATE/저장·실행·LINK false만 반환한다. signature/current·관리권위/nonce 실소비·명령/audit·DB row CAS는 별도 미구현이며 caller의 verified 플래그를 받지 않는다. 이전 전이 checkpoint에서 미구현이었던 state view/실제 request·관측 JOIN adapter는 위 source 후보로 추가했으나 실제 SQL/PG 실행은 미검증이다. 미적용 request 표의 updated_at은 유한·ms단위·created_at 이상을 보존하지만 SQL의 비교/전이 guard는 여전히 미활성이다. 이 timestamp는 승인/허가 token이 아니고 actual UPDATE를 실행하지 않는다.

신규 미적용 db/migrations/0040_source_content_hash.sql.pending에 위4표·same-project FK/target별 양성·소비 UNIQUE·append/강제거절을 작성했다. 기존4개 runner/manifest에는 등록하지 않았다. 새표는 RLS false/FORCE·권한0/모든 DML·TRUNCATE 거절, 최초 LINK INSERT도 거절이다. 실제 인증·정확 shape/상태전이·정책 predecessor/CAS·nonce/서명/verifier·명령/audit/COMMIT guard는 아직 미완성이며 이 닫힌 부분을 활성화 코드라고 부르지 않는다.

content_verification_ref와 보조 id/version/hash는 모두 일반 열이다. 기존0033의 BEFORE 전체행 대조와 충돌하는 STORED 생성열안은 원 정적I1으로 보존하고 source에서 제거했다. CHECK는 legacy 전체NULL 또는 exact ref(version1 양성)·보조3열 일치를 IS TRUE로 강제하며 FK/UNIQUE·4열tuple 불변을 유지한다. 기존 적용0032/0033 원문과 기존행/권한은 변경하지 않았다. 생성열/일반열의 미래 PG 반례는 별도 .sql.pending source이며 실행/RED→GREEN/제품 실제 detach는 NOT_RUN이다.

서버 최신정책 판독 source는 project_id만 선별한 뒤 sequence DESC LIMIT1로 한 건을 고정해 최소 요약/hash를 대조한다. 최신 회수/만료/DENY/다른subject면 거절하고 과거 AUTO 재조회0, 정상 AUTO도 현재 관리 권위가 없어 UNVERIFIED/실행·LINK false다. 이 판독은 full policy/targets/관리허가·이력 계보 검증이나 정책 쓰기 기능을 대신하지 않고 route에도 등록하지 않는다. 저장 SOURCE 부분 구현과 실제 사용 가능한 기능을 구분한다.

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
