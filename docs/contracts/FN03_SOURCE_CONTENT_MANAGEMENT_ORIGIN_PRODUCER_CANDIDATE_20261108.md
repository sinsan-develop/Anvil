# FN03 관리 원문 보호 생산자·저장량 귀속 상세 후보

상태: DRAFT / 미채택 / 구현 GO 아님. 기존 계획 FN03의 실제 소스 관측 생산자에 필요한 첫 선행이다. CM01~08의 기존 미등록 SOURCE 형상 승인(WORK_STATUS2128)을 유지하고 §13.4의 새 보호 원문·전용조회·현재 관리 권위·저장량 편입만 구체화한다. 부모 FN03_SOURCE_CONTENT_HASH_DELTA_CANDIDATE.md raw SHA256 746d1fba11afdb94d750955a14f7d465baa5e19b71d8598c2ebdbe7cd738f173. 부모§13.4의 exact9/10·고정 결과/감사·본인 전용 의미를 재정의하지 않는다.

## 1. 첫 단위의 끝과 전체 목표
원 defineSourceContentPolicy 명령의 현재 인증/허가→최신 정책 CAS→관리 정책 event/원 envelope origin/command/receipt/audit와 예약 정산→전용 내부 보호 재조회→기존 inspector의 형상 검산까지를 첫 단위로 제안한다. HTTP 원문 read endpoint는 만들지 않는다. 관측 요청/nonce·credential/native 서명 목적·실파일 내용 관측·관측 포트 read/current·LINK 공급은 이 단위의 성공으로 간주하지 않으며 후속 필수 미완료로 남긴다. inspector의 UNVERIFIED/false를 true로 바꾸지 않는다.

기존 관리 형상과 새 생산 권한은 다르다. 사용자 verified/OWNER 플래그·actor DTO·사용자 GUC·원문 없는 snapshot·단순 정상서명만으로 현재 권위를 발급하지 않는다. 기존 SOURCE_READ_ATTRIBUTES/최초수신의 credential·목적은 내용 읽기 허가로 전용하지 않는다.

## 2. 새 저장·읽기 의미
부모§13.4 exact9 행은 project_id,id,version=1,management_command_id,policy_event_ref,request_json,request_hash,recorded_at,content_hash다. 원 수신 envelope 전체의 canonical 내용과 request hash를 보존한다. snapshot 역생성이나 payload만 저장하지 않는다. 논리 snapshot exact10은 schemaVersion=1,purpose=SOURCE_CONTENT_POLICY_MANAGEMENT_ORIGIN,id,version=1,projectId,managementCommandId,policyEventRef,originalRequest,requestHash,recordedAt. originRef는 기존 RuntimeRefV1이다.

원 envelope≤1MiB·도출 snapshot≤2MiB, 기존 관리 wire4MiB/HTTP본문·CM06결과 exact9는 변경하지 않는다. project+내부 command당 origin1개·event fullref당1개, origin/request hash와 commands.request_hash 동일, 원 관리 command/event/receipt/audit 양방향 완결을 요구한다. 과거 원문 부재는 ORIGIN_ABSENT로 닫고 역생성/덮기0이다.

신규 readSourceContentPolicyManagementOrigin은 내부 보호 reader의 목적이다. 입력 exact3(originRef,policyEventRef,managementCommandId), 로그인/프로젝트/currentclient·세대는 서버의 현재 인증 경계에서 공급한다. 현재 본인 OWNER·같은 client의 단독 제어·재인증·별도 정확 PROJECT AUTO 정책을 모두 요구한다. REQUIRE_APPROVAL은 정확 소비 계약 전 닫는다. 내부 원 envelope는 기존 관리 evidence inspector에만 제공하며 일반 응답 exact5(originRef,policyEventRef,managementCommandId,requestHash,authority=UNVERIFIED)만 허용한다. 일반 files GET/검색/Agent맥락/로그/감사로 원문을 공개하지 않는다. 자동 정책 부여0이다.

## 3. 인증·DB 권위 경계 A후보
기존 AccessRepository.authenticateInTransaction/authenticated의 실제 token digest/CSRF·user/session/client 행 잠금·ACTIVE/회수·자격세대·idle/absolute검사를 재사용한다. 두 관리목적의 진입은 token/CSRF 각각 exact43 base64url non-null을 먼저 요구한다. authenticated의 null CSRF 허용 일반동작은 바꾸지 않는다. 원 actor/session 객체, actorId/clientId/credentialGeneration/authSession.id, primitive 만료·재인증시각, 원 query/PoolClient·실 xid·정확 원명령canonical hash를 실제 인증 callback 안에서만 발급하는 private same-Tx 결박으로 고정하고 callback 종료때 폐기한다. 원메서드/실제callback 밖의 DTO·사용자 GUC·공개 verified 플래그·가짜콜백/원순수inspector를 이 결박으로 바꾸지 않는다.

purpose RPC는 DB의 실제 s/a/c/project·현재세대/idle/absolute·reauth_until·OWNER·단독제어 actor/client/generation/회수·최신 permissionPolicyRef와 정확 PROJECT/HUMAN 별도 AUTO·최소기한을 독립 재검산한다. fn01_active는 현재 DB세션행검사일 뿐 token 소유proof가 아니다. token/CSRF소유의 서버callback 검증과 DB현재행/목적 검증을 결합하며 RPC/GUC만으로 token 인증했다고 하지 않는다. 같은 PoolClient/xid·원명령을 각 await 뒤/반환 전 검산하고 오래된private context를 재사용하지 않는다. 서버 DB credential 탈취까지 차단한다는 주장은 하지 않는다.

전용 read는 쓰기부작용 없는 current검사만 소비한다. fn01_lock_owner는 quota행 INSERT부작용이 있어 read에 사용하지 않는다. 현재 로그인주체와 원기록의 과거actor는 분리하고 과거origin 원 envelope를 현actor로 재구성하지 않는다.

## 4. 관리 행 비용 집합 A후보
내부 원 command ID cid의5개 물리행만 기본비용으로 한 번씩 귀속한다.

|기호|정확 집합|
|---|---|
|O|source_content_policy_management_origins의 같은 project/management_command_id=cid 한 행|
|E|O.policy_event_ref exactfullref 및 management_command_id=cid인 source_content_policy_events 한 행|
|C|같은 project의 commands.id=cid·operation=defineSourceContentPolicy 한 행|
|A|C.authorization_receipt_id와 같고 command_id=cid인 authorization receipt 한 행|
|U|동일 project/cid/operationId·HUMAN_COMMAND/APPLIED·CM audit 한 행|

각 종류 정확1개와5행 관계를 검산하고 누락을0원으로 세지 않는다. c(row)=fn75_cost(fn09_registered_cost_projection(to_jsonb(row)))의 기존 정규화 패턴을 재사용한다. 물리 bigint/DB시각 열만 정규화하고 request_json 내부 숫자·시각 문자열은 바꾸지 않는다. 별도 canonical text 물리열이 없는 exact9에 가상 canonical 원문을 중복 계상하지 않는다. 실제 O.request_json/E.snapshot_json/C.result_ref에 중복 저장되는 내용은 각 물리 위치에서 한 번씩 센다. exact10 snapshot은 도출값이면 별도 비용0이며 저장한다면 그 실복제비용을 포함해야 한다.

B=c(O)+c(E)+c(C)+c(A)+c(U). 이 목적은 승인소비/알림/Artifact/nonce를 생산하지 않으므로 해당 행을 비용집합으로 꾸미지 않는다.

## 5. 새 예약 목적과 유한 고정점 A후보
신규 제안값은 part_kind=SOURCE_CONTENT_POLICY_MANAGEMENT,part_key=management_origin,purpose=SOURCE_CONTENT_POLICY_MANAGEMENT_STORAGE,operation=defineSourceContentPolicy다. 단일 project_storage_reservations R.id는 원 내부 cid와 결박하고 part.id/hash는 새 originRef를 가리킨다. 원 project/actor/client·외부 commandId/requestHash·origin/event/receipt·coverageGeneration·최소 기한을 봉인한다. 이 값은 현재 제품에 등록된 값이 아니다.

미래5행의 정확 고정 입력으로 상계M을 서버가 도출한다. wire/원payload/이미발급한UUID·관계ref·policyhead/previous·본문문자열은 최초await 전에 사본으로 고정하고, 목적별 잠금 후 원event sequence/발급ID/recordedAt 등을 확정해 실제 저장 투영을 만든다. request_json의 날짜/숫자/escaped UTF-8 문자열은 실제값 그대로 두며 가변열 상계 때문에 원payload를 바꾸지 않는다.

M은 아래 정규화 투영의 canonical 비용 합이다. 고정 참조의 UUID는36문자/hash는64문자이며 실제 원필드값을 사용한다. 아직 정해지지 않은 물리 DB시각 열은 기존 projection의 UTC `YYYY-MM-DDTHH:mm:ss.ffffffZ` 정확27문자와 동일 길이인 예약용시각으로만 비용 계산한다. 실제 정산시 그 투영 형식/길이를 다시 검산하고 범위를 벗어나면 거절한다. 이 비용용 값은 저장 원문·이벤트·서명·허가 증거로 소비하거나 게시하지 않는다.

- E.sequence는 기존0040 CHECK의 1..9007199254740991 상계로 비용을 잡되 실제 event/snapshot/원문은 정확 현재sequence를 보존한다. root물리 sequence와 snapshot내sequence는 각각 실제 저장위치의 비용으로 한 번씩 잡는다.
- U.server_sequence 등 실제 bigint 순번의 decimal 길이는 schema의 양수 bigint 상계9223372036854775807의19자리로 잡는다. 실제 projection이 string으로 정규화되는 열은 string 비용, 안전정수 숫자로 유지되는 열은 숫자 비용을 사용한다. 키 전체를 무작정 변환하지 않는다.
- nullable previous_ref/원실제policy/generated이전ID·version·hash, C/A/U의 nullable 필드는 해당 고정명령이 실제로 저장할 분기를 사용한다. 실제 물리 generated 열도 to_jsonb(row)에 포함하며 가상 snapshot 비용과 혼동하지 않는다.
- 원문/관계/상태·결과의 미정 필드가 위 정해진 길이/범위로 상계되지 않으면 source producer는 아직 준비 불가로 거절하며 임의 배수·여유상수·caller비용값으로 채우지 않는다. 실제 B≤M을 정산과 deferred완결에서 재검산한다.

plan_json에 원문을 복제하면 그 bytes를 R자기비용에 포함한다. 기존0077 단일part·고정길이ID/hash·정규화시각 패턴의 다음 최소고정점을 목적 검산 뒤 재사용하는 후보이다.

- 예약 r = 최소고정점[M + max(c(R_RESERVED(r)),c(R_IO_STARTED(r)),c(R_SETTLED(r,r)))]
- 정산 s = 최소고정점[B + c(R_SETTLED(r,s))]
- B≤M,s≤r,안전정수·유한수렴·총상한을 검산한다. plan/planHash/coverageGeneration 봉인을 확인하고 정산값으로 과거 plan을 다시 쓰지 않는다. 정수decimal길이 고정점의 유한 수렴/상한 경계는 구현 합성시험에서 증명해야 한다.

## 6. 기존10GiB 계정식과 중복0 A후보
기존 U=무필터SETTLED settled_bytes합+기존FN15/FN75/FN76 actual, H=RESERVED/IO_STARTED/UNKNOWN reserved_bytes합+기존future, O6=기존fn09_registered_other_bytes의6표 비용을 보존한다.

예약은 U+H+r+O6≤10737418240, 정산은 U+s+H-r+O6≤10737418240, account.used+=s/held-=r다. 기존 TD03 project10GiB의 동일분모에 관리 metadata를 편입하는 의미가 신규 채택 대상이다. 새 관리 actual을 U에 따로 더하지 않고 기존FN75/FN76 collector에 같은C/A/U를 다시 넣지 않는다. 새actual helper는 R정산액/역완결 확인용이며 project 소계가 아니다.

같은 PoolClient/Tx에서 account FOR UPDATE→U/H/O6/coverage→R reserve/IO_STARTED→O/E/C/A/U저장→실B/settle→양방향deferred complete→COMMIT 순서다. 정산/완결이 없으면 부분성공을 게시하지 않는다. 정상replay는 현재 허가 뒤 기존 불변결과와 정산proof만 읽고 추가R/charge0,COMMIT불명은 원ID/hash의 명시 재확인만 허용하고 새명령/자동재시도·삭제0이다. 과거비용은 불변관계로 검산하며 현재정책변경으로 과거plan을 재작성하지 않는다.

## 7. 목적 한정 SQL·구현 경계 A후보
현재 migration최대0082를 확인했다. 신규0083_source_content_policy_management_origins.sql.pending은 착수직전 부재/번호충돌을 확인하고 이 목적에만 예약한다. 원0040파일은 수정하지 않는다. 관리event와새origin만 새forward의 명시purpose guard로 열고 requests/observations/verifications/LINK의 권한0·false정책·차단trigger는 그대로 유지한다.

역할 후보는 anvil_v3_source_content_management_owner, NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS다. 앱의 직접/간접 membership·SET ROLE 경로0, 표소유자는 되지 않고 정확purpose RPC만 소유한다. 함수 search_path=pg_catalog 고정, 소유권이전용 schema CREATE는 이전즉시회수한다. FORCE RLS/기존false정책은 유지하고 이 새역할에만 policy_events/origin SELECT·INSERT와 역할 한정 허용정책을 추가한다. 일반 app/PUBLIC의 원문 SELECT/DML/TRUNCATE0, UPDATE/DELETE 불변·TRUNCATE거절 유지다.

0040의 무조건거절 함수 전체를 완화하지 않는다. policy_events의 source_content_unavailable trigger 한개만 새forward에서 명시 INSERT purposeguard로 교체한다. guard는 정확 schema/table/INSERT·실행역할·원project/current목적 및 command/event/origin 관계를 검산한다. 다른표·동작의 거절은 보존한다. 순환관계는 정확unique/FK·deferred complete로 최종5행과R의 양방향 완결을 검사하고 누락/부분COMMIT을 거절한다.

내부helper PUBLIC/app EXECUTE0이며 새역할은 필요한 정확 helper만 호출한다. 기존fn01_active(uuid,uuid,uuid)의 EXECUTE를 새역할에만 허용하는 기존FN15 선례를 재사용하며 app에는 넓히지 않는다. 잠금의 FOR UPDATE에 필요한 project/control의 정확열 UPDATE권한은 새역할에만 최소로 부여하는 미적용DDL을 고정한다. SELECT권한만으로 행잠금이 된다고 가정하지 않는다. 실제 권한 부여는 하지 않는다.

신규purpose RPC는 원sessionId/actorId/clientId/projectId·현재control/permissionPolicyRef·expected xid를 실제callback에서 유도받고 current검산한다. define producer에는 원ProjectCommand와 미리발급한IDs를, read에는 원 exact3선택만 추가한다. 원command.receipt/audit/event/origin·quota별 단발fence의 관계를 검사한다. 정확SQL함수시그니처/열ACL은 코드쓰기전 WI에 일관되게 동결하고 그 기술검수와 독립검토를 완료해야 한다. 이 명칭/ACL후보가 실제 설치됐다고 하지 않는다.

기존변경후보는 access/project-command.ts·projects/routes.ts·projects/project-storage-quota.ts·Web connections/policy-editor-profile.ts다. 신규는 documents의 origin-input/origin-store/project-source-content-policy-management,0083 및 입력/service/Tx/schema/quota시험이다. 최종허용목록은 이 목적에 고정하며 실제관측·키목적 등 새의미를 끼워넣지 않는다. 보호조회 HTTP endpoint는 이번범위에 없으며 기존commands의관리producer와서버내부reader만 구현후보다.

## 8. 대안·검수·복구
A권장은 위 DB보호원문+단일원명령비용 귀속이다. 원문/CAS/receipt/audit를 같은Tx로 검산하고 일반Artifact노출을 피하지만 새보호조회권한/metadata비용·SQL설계가 필요하다. B비공개ArtifactStore는 파일보호를 재사용하나 일반GET격리·DB/FS게시실패/COMMIT불명·복제비용 경계가 추가된다. C현상유지는 새계약효과가 없지만 실제관리/관측producer미완료를 해소하지 않는다. 어느안도 일반참가자에 원문을 공개하거나실파일/키를 자동허용하지 않는다.

필수합성여정은 실제보호클래스와인증경계→본인AUTO관리→원문/event/C/A/U·예약정착→내부보호재조회→기존UNVERIFIED형상검산이다. 타인/세대·회수/만료/DENY/재인증·latestCAS·원문/hash·누락/중복orphan·정산초과/중복계상·rollback/replay/UNKNOWN추가효과0을 검사한다. 실제PG/ACL/COMMIT·native키/OS를 합성으로 증명하지 않는다.

자동삭제OFF·민감표식은성공origin소비를닫고원문없는거절감사로분리한다. 완전탐지라고하지않고자동마스킹/파기·키교체0이다. rollback은 신규producer/주입을기본미구성으로되돌리고원문·보고·감사를보존하며DROP/과거JSON재작성/UNKNOWN정리0이다. 실제DB/권한부여/키/서비스/Agent/SSH/실자료조사·OS내용관측/nonce서명·J3/P03실행은 이 후보의범위밖이다.
