# FN03 관리 원문 보호 생산자·저장량 귀속 상세 후보

상태: DRAFT / 미채택 / 구현 GO 아님. 기존 계획 FN03의 실제 소스 관측 생산자에 필요한 첫 선행이다. CM01~08의 기존 미등록 SOURCE 형상 승인(WORK_STATUS2128)을 유지하고 §13.4의 새 보호 원문·전용조회·현재 관리 권위·저장량 편입만 구체화한다. 부모 FN03_SOURCE_CONTENT_HASH_DELTA_CANDIDATE.md raw SHA256 746d1fba11afdb94d750955a14f7d465baa5e19b71d8598c2ebdbe7cd738f173. 부모§13.4의 exact9/10·고정 결과/감사·본인 전용 의미를 재정의하지 않는다.

## 1. 첫 단위의 끝과 전체 목표
원 defineSourceContentPolicy 명령의 현재 인증/허가→최신 정책 CAS→관리 정책 event/원 envelope origin/command/receipt/audit와 예약 정산→전용 내부 보호 재조회→기존 inspector의 형상 검산까지를 첫 단위로 제안한다. HTTP 원문 read endpoint는 만들지 않는다. 관측 요청/nonce·credential/native 서명 목적·실파일 내용 관측·관측 포트 read/current·LINK 공급은 이 단위의 성공으로 간주하지 않으며 후속 필수 미완료로 남긴다. inspector의 UNVERIFIED/false를 true로 바꾸지 않는다.

기존 관리 형상과 새 생산 권한은 다르다. 사용자 verified/OWNER 플래그·actor DTO·사용자 GUC·원문 없는 snapshot·단순 정상서명만으로 현재 권위를 발급하지 않는다. 기존 SOURCE_READ_ATTRIBUTES/최초수신의 credential·목적은 내용 읽기 허가로 전용하지 않는다.

## 2. 새 저장·읽기 의미
부모§13.4 exact9 행은 project_id,id,version=1,management_command_id,policy_event_ref,request_json,request_hash,recorded_at,content_hash다. 원 수신 envelope 전체의 canonical 내용과 request hash를 보존한다. snapshot 역생성이나 payload만 저장하지 않는다. 논리 snapshot exact10은 schemaVersion=1,purpose=SOURCE_CONTENT_POLICY_MANAGEMENT_ORIGIN,id,version=1,projectId,managementCommandId,policyEventRef,originalRequest,requestHash,recordedAt. originRef는 기존 RuntimeRefV1이다.

원 envelope≤1MiB·도출 snapshot≤2MiB, 기존 관리 wire4MiB/HTTP본문·CM06결과 exact9는 변경하지 않는다. project+내부 command당 origin1개·event fullref당1개, origin/request hash와 commands.request_hash 동일, 원 관리 command/event/receipt/audit 양방향 완결을 요구한다. 과거 원문 부재는 ORIGIN_ABSENT로 닫고 역생성/덮기0이다.

신규 readSourceContentPolicyManagementOrigin은 내부 보호 reader의 목적이다. 입력 exact3(originRef,policyEventRef,managementCommandId), 로그인/프로젝트/currentclient·세대는 서버의 현재 인증 경계에서 공급한다. 현재 본인 OWNER·같은 client의 단독 제어·재인증·별도 정확 PROJECT AUTO 정책을 모두 요구한다. REQUIRE_APPROVAL은 정확 소비 계약 전 닫는다. 내부 원 envelope는 기존 관리 evidence inspector에만 제공하며 일반 응답 exact5(originRef,policyEventRef,managementCommandId,requestHash,authority=UNVERIFIED)만 허용한다. 일반 files GET/검색/Agent맥락/로그/감사로 원문을 공개하지 않는다. 자동 정책 부여0이다.

## 3. 인증·DB 권위 경계 검토 상태
현재 AccessRepository의 실제 인증 거래와 기존 목적 한정 DB guard를 재사용할 정확 입력/함수/역할·RPC를 기술 검토 중이다. 이 절은 아직 상세 확정 전이며 본 후보 전체를 실행 가능한 승인 패킷으로 제출하지 않는다. 단순 동일 PoolClient나 app역할, caller의 actor/session 주장만으로 인증/재인증/OWNER를 입증했다고 하지 않는다. 코드/미적용 SQL 작성은 정확한 신뢰 경계·목적별 실행권·원자성 검토와 직접 채택 뒤에만 배정한다.

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

미래5행의 정확 고정 입력으로 상계M을 서버가 도출한다. 가변시각·순번/정수열을 어떤 canonical projection으로 상계하는지 구현 전 확정해야 하며 임의 배수·여유 byte 상수/사용자 비용 입력을 신뢰하지 않는다. plan_json이 원문을 복제하면 R자기비용에도 포함한다. 기존0077 단일part·고정길이ID/hash·정규화시각 패턴의 다음 최소고정점을 목적 검산 뒤 재사용하는 후보이다.

- 예약 r = 최소고정점[M + max(c(R_RESERVED(r)),c(R_IO_STARTED(r)),c(R_SETTLED(r,r)))]
- 정산 s = 최소고정점[B + c(R_SETTLED(r,s))]
- B≤M,s≤r,안전정수·유한수렴·총상한을 검산한다. plan/planHash/coverageGeneration 봉인을 확인하고 정산값으로 과거 plan을 다시 쓰지 않는다.

## 6. 기존10GiB 계정식과 중복0 A후보
기존 U=무필터SETTLED settled_bytes합+기존FN15/FN75/FN76 actual, H=RESERVED/IO_STARTED/UNKNOWN reserved_bytes합+기존future, O6=기존fn09_registered_other_bytes의6표 비용을 보존한다.

예약은 U+H+r+O6≤10737418240, 정산은 U+s+H-r+O6≤10737418240, account.used+=s/held-=r다. 기존 TD03 project10GiB의 동일분모에 관리 metadata를 편입하는 의미가 신규 채택 대상이다. 새 관리 actual을 U에 따로 더하지 않고 기존FN75/FN76 collector에 같은C/A/U를 다시 넣지 않는다. 새actual helper는 R정산액/역완결 확인용이며 project 소계가 아니다.

같은 PoolClient/Tx에서 account FOR UPDATE→U/H/O6/coverage→R reserve/IO_STARTED→O/E/C/A/U저장→실B/settle→양방향deferred complete→COMMIT 순서다. 정산/완결이 없으면 부분성공을 게시하지 않는다. 정상replay는 현재 허가 뒤 기존 불변결과와 정산proof만 읽고 추가R/charge0,COMMIT불명은 원ID/hash의 명시 재확인만 허용하고 새명령/자동재시도·삭제0이다. 과거비용은 불변관계로 검산하며 현재정책변경으로 과거plan을 재작성하지 않는다.

## 7. SQL·구현 후보와 아직 미정인 기술
현재 migration최대0082를 확인했다. 신규0083_source_content_policy_management_origins.sql.pending은 착수 직전 부재/번호 충돌을 확인한 뒤만 예약한다. 기존0040 원문은 보존하고 전체 SOURCE_CONTENT를 개방하지 않는다. 새forward가 원 정책event DML guard와 목적 한정 producer를 어떻게 연결할지 exact함수/ACL·순환FK·deferred검사와 함께 먼저 고정한다. 일반 app/PUBLIC 직접SELECT/DML·generic reserve로 새 내부목적을 생산하는 경로를 닫는다. helper EXECUTE와고정search_path·소유역할은 아직 기술 검토 대상이며 확정됐다고 하지 않는다.

기존변경후보는 access/project-command.ts·projects/routes.ts·projects/project-storage-quota.ts·Web connections/policy-editor-profile.ts다. 신규는 documents의 origin-input/origin-store/project-source-content-policy-management,0083 및 입력/service/Tx/schema/quota시험이다. 최종허용목록/WI는 기술검토와채택후해당목적에고정하며임의다른경로수정0이다.

## 8. 대안·검수·복구
A권장은 위 DB보호원문+단일원명령비용 귀속이다. 원문/CAS/receipt/audit를 같은Tx로 검산하고 일반Artifact노출을 피하지만 새보호조회권한/metadata비용·SQL설계가 필요하다. B비공개ArtifactStore는 파일보호를 재사용하나 일반GET격리·DB/FS게시실패/COMMIT불명·복제비용 경계가 추가된다. C현상유지는 새계약효과가 없지만 실제관리/관측producer미완료를 해소하지 않는다. 어느안도 일반참가자에 원문을 공개하거나실파일/키를 자동허용하지 않는다.

필수합성여정은 실제보호클래스와인증경계→본인AUTO관리→원문/event/C/A/U·예약정착→내부보호재조회→기존UNVERIFIED형상검산이다. 타인/세대·회수/만료/DENY/재인증·latestCAS·원문/hash·누락/중복orphan·정산초과/중복계상·rollback/replay/UNKNOWN추가효과0을 검사한다. 실제PG/ACL/COMMIT·native키/OS를 합성으로 증명하지 않는다.

자동삭제OFF·민감표식은성공origin소비를닫고원문없는거절감사로분리한다. 완전탐지라고하지않고자동마스킹/파기·키교체0이다. rollback은 신규producer/주입을기본미구성으로되돌리고원문·보고·감사를보존하며DROP/과거JSON재작성/UNKNOWN정리0이다. 실제DB/권한부여/키/서비스/Agent/SSH/실자료조사·OS내용관측/nonce서명·J3/P03실행은 이 후보의범위밖이다.
