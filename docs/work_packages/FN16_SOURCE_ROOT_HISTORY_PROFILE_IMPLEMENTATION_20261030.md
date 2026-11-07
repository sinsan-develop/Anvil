# FN16 소스root 선언 역사 명시 profile·실제 조합 소비 WI — 2026-10-30

상태: WI 문서 작성만 허가됨. 제품 GO 전 Main/독립 사전검수 대상이다. 기준 HEAD c1ca0e6fb3f32959414aab32db54fe4144b342d0 / codex/av3-stage-b. Main 관리·기록·검수·통합, Primary 별도 GO 후 단독 writer, Reviewer 읽기 전용이다. 코드/시험/실DB/파일 IO/키/서비스/Agent/Git 실행 승인이 아니다.

## 1. 기존 범위 근거와 제외

FUNCTION_WORK FN16 §수행의 문서/원문/지식/상태/관계/증거/승인/감사 및 소스 보존과 기존 OWNER read가 이미 반환하는 소스root 선언의 부분집합을 보존하는 내부 상세화다. FUNCTION_WORK SHA256 906D53CA0EC8724C20C54E01D39B38E82D5677D32461957F5FCF081880C290A9. 새 공개 조회/반출형식/DB권한/정책·신뢰 부여가 아니며 문서 전용 PMO 결정의 DOCUMENT_HISTORY_ONLY를 이 표의 직접 승인으로 인용하지 않는다.

원 ProjectSourceRoots SHA0686DCA08F348289B1DC47BE27F320C77883420048D96499853708B191753A7A의 read는 MEMBER에 ref/head/displayName/status, OWNER에 snapshot/기록자/시각/protectedRef도 반환한다. 이번은 활성 OWNER만 허용하고 원형은 잠시 검산한 뒤 익명 metadata만 출력한다. hostLabel/pathHint/displayName/reason/connectorId·actor/client/계정·storage key·protectedRef 원문/원 request/result/snapshot JSON 반출0이다. 원 데이터의 hash가 있어도 원형을 보존했다고 주장하지 않는다.

read/#record의 missing404와 SOURCE_ROOT_INTEGRITY_FAILED503 보호를 그대로 재사용한다. 실패한 ref/snapshot/버전/건수를 성공 unavailable 봉투로 바꾸지 않는다. 현재 connector trust/등록 credential/OS path 접근은 쓰기 시 검사와 별개이며 이 역사 수집에서 조회·재발급하지 않는다. 과거 DECLARED/REVOKED는 그 저장 사실일 뿐 현재 trust·파일 접근 권위가 아니다. 전체 소스파일/미커밋/설정/등록/보호참조·공유RO issuer는 미수집 유지다.

## 2. 별도 GO 시 정확5코드

1. 신규 apps/server/modules/backups/source-root-history-inventory.ts.
2. apps/server/modules/backups/project-inventory-composition.ts (시작156F55AE8CE2EED169FC683C7082F0E4486CE64AD89A26A8E7E3FC02EC1FD450).
3. apps/server/modules/backups/artifact-current-verification.ts (시작6E829EA99644F459BC54FE8E228931D18B6EB0A19B6A8BF0FCCD56247CB8847A).
4. 신규 tests/unit/FN16/source-root-history-profile.test.ts.
5. 신규 tests/unit/FN16/source-root-history-profile-schema.test.ts.

기존 ProjectSourceRoots/input/ProjectBaselines/helper/기타collector·기존 시험·SQL/정책/RLS/role/GRANT/publicRoute/ProjectBackups 변경0이다. Main소유 WORK_STATUS/설계/계획/결과 및 보호8 수정0. Primary는 이 WI 문서1개만 양 root 동일 작성한다. 단순 새 unused wrapper로 완료하지 않고 아래 실제 Root·consumer profile에 같은 단위로 연결한다.

## 3. 기존24/26 보존·명시27 소비

기존 trusted internal baselineContext를 {baselines:ProjectBaselines;csrf:string;sourceRootHistory?:true}로 한정 확장한다. absent context는 기존24, 기존2-key context는 기존26, 정확3-key context에서 sourceRootHistory가 literal true일 때만27이다. 별도25모드/환경 fallback0. literal flag는 수집 profile 선택이며 권한 proof·featuregate 검증·실환경 활성화가 아니다.

Root 양 진입점과 실제 verifyProjectInventoryArtifacts는 첫 await 전 동일 닫힌 descriptor를 복사 고정한다. 2/3키만 허용하고 false/null/숫자/문자열/undefined-present/추가키/symbol/accessor는400·getter0·DB0이다. 실제 repo/class 명목검사·실 token/CSRF/동일identity/OWNER는 그대로 필수다. 소비자가 원 caller context를 await 뒤 다시 읽지 않는다.

sourceRootHistory:true일 때만 기존24 다음 SourceRootHistory 실제 collector를 추가한 뒤 FeatureBaselineDraftHistory/FeatureBaselineDecisionHistory를 기존 순서로 실행한다. 27은 원25+class2이며 각 원24의 순서는 불변이다. 기존27 전용 extra 관측은 실제 새 RR이며 원24의 관측/원hash/원본문을 생략하지 않는다. internal envelope와 후속 실제 consumer가 이27을 그대로 사용하고 공개 DTO에 identity/deadline을 넣지 않는다. profile이 없으면 이 collector 호출/추가 필드/새 namespace/자료 접근이 전혀 없다. 기본24/26 결과·hash·회계·오류경로는 원형대로 유지한다.

## 4. 수집 입력·실제 권한·query 프로토콜

새 collectSourceRootHistoryInventory(rootAccess,token,value,signal)는 명시 Root27의 Root-owned 내부 인증 포트 전용이다. 기존 readDocumentInventoryInput의 projectId/유한 metadataBytes/inputBytes/fileCount/deadlineMs만 사용하며 새 root/path/token/권한 선택 입력은 없다. 실제 호출자는 Root27 한 곳으로 제한한다. Root의 실제 repo/class/CSRF 검사와 contextAuthenticated의 bounded connect·실제 인증·OWNER·최소기한을 필수 선행으로 삼고 처음과 마지막 RC에서 같은 actor/client/generation/session·활성 OWNER·DBclock/최소TTL을 확인한다. 포트는 인증 proof가 아니며 외부 caller의 callback/provider나 형식 boolean으로 대체하지 않는다. raw repo를 직접 넘기는 standalone 실행·callback 전 인증 대기 보장은 지원/검증하지 않는다. 이를 위해 새 권한표식·브랜드·공통 인증 controller·실repo/CSRF 전달 계약을 추가하지 않는다.

자료는 별도 단일 READ ONLY RR에서 조회한다. source_roots/versions에 0008_source_root_registry.sql(원SHA D9D27D2C92E31E6C5E50BF18762786D2CAD2B47A28905BC8F0F15FA2CEC72403)22~25의 app SELECT가 있고 현재 migration source에서 해당 SELECT 철회/읽기RLS를 찾지 못했다. 이는 실제 설치/role 검증이 아니다. 원 기록 trigger의 reauth/controller/current-policy/connector 검사는 쓰기용이며 역사 read에 다시 적용하지 않는다. 읽기에 필요한 SECURITY DEFINER/GRANT/role 변경0이다.

실제 new ProjectSourceRoots(access).read를 bounded RR query port에서 각 저장 버전에 호출한다. 원 #record의 joined-row·이전버전 검사와 projectMember를 우회하지 않는다. 이 read 경로는 FOR UPDATE/SHARE나 파일·키 IO가 없으므로 RO에 잠금 삭제 없이 재사용할 수 있다. 원 class가 만드는 정확 query를 한정 envelope로 치환하고 원 Date/bigint 형태를 복원하여 원 read가 검산하도록 한다. 성공 객체를 공급하는 fake provider/캐시로 원 read를 대신하지 않는다.

RR에는 남은 최소기한 이하 transaction-local statement_timeout/lock_timeout/idle_in_transaction_session_timeout과 유한 readback을 적용한다. 별도 auth의 FOR UPDATE는 RC에서만 수행한다. 자료 SELECT는 LIMIT200·keyset·projectId결박·명시열이며 모든 응답 raw envelope/원read 추가응답/최종DTO bytes를 같은 metadata counter에 누적한다. SQL bigint는 JSON 전에 ::text로 보존하고 raw numeric ORDER BY/LIMIT 뒤 projection에서 문자열화한다. JSON Number가 된 값을 뒤늦게 String으로 복원0이다.

원 read catch가 자체 query의413/409를503으로 감쌀 수 있으므로 같은 query controller의 최초 자체오류를 sticky로 보존하고 실제 원 read 반환/예외 후 다시 검사한다. 진짜 원무결성503을413/성공으로 낮추지 않는다. connect/query/늦은응답/rollback/release를 자기 pending으로 추적·회수하며 UNKNOWN은503 우선이다. cleanup remaining은 순수 산술이고 이미 시작한 query의 handler 부착 전에 throw하지 않는다. driver/OS 강제 회수·현재권한의 중간 ABA 제거는 보장0이다.

RO 종료 후 최종 RC에서 OWNER/신원/최소TTL과 해당 프로젝트의 저장 heads/versions ref·선택증빙 지문을 재대조한다. 관측 clock/현재 policy 유효성/현재 control을 저장 지문에 섞지 않는다. 변화/현재성 미확인은 전체 오류이며 partial성공/건수 노출0. 마지막 직렬화 후/반환 직전 기한·취소·정리불명도 검사한다.

## 5. 정확5표·66열 registry와 순서

원 표20열:

- source_roots (6): project_id,id,head_version,created_by,client_id,created_at. 순서 id ASC, project_id=요청프로젝트.
- source_root_versions (14): project_id,root_id,version,content_hash,declaration_json,status,authority,readiness,reason,actor_id,client_id,command_id,connector_id,created_at. 순서 root_id ASC,version ASC. 해당 프로젝트의 전체 저장 버전만.

선택 증빙46열은 위 versions.command_id에만 결박한다. 전체 command/감사 원장을 다시 수집하는 것이 아니다.

- commands (21): id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at. 순서 id ASC. PROJECT/scope_id=project_id=요청프로젝트,draft_id IS NULL,id=ANY(선택command ids).
- authorization_receipts (9): id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at. 순서 id ASC. PROJECT/scope_id=요청프로젝트,command_id=ANY(선택command ids).
- audit_events (16): project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of. 순서 server_sequence ASC. project_id=요청프로젝트,command_id=ANY(선택command ids).

이외 users/clients/session/control/connector/registration/credential/source files 표를 자료로 수집하지 않는다. 실제 auth/OWNER metadata는 각 원 인증/권한 query에서만 읽고 반환/자료 지문에 포함하지 않는다. 원 read 추가 조회도 위 표의 정확 joined query와 이전 source_root_versions 3열(content_hash,declaration_json,status)로 한정한다. 동일 원열을 재조회해도 metadata 비용을0으로 처리하지 않는다.

## 6. 원형·원명령·선택 증빙 검산

1. heads는 UUID/양의 safe version·한 프로젝트/중복금지, versions는 root별1..head 연속/중복금지·끝head정합·누락head/버전503이다. v1 head created_by/client는 첫 버전 저장 actor/client와 대조한다. 이후 버전 actor가 다르거나 현재 OWNER와 달라도 정상이다. 과거 current-policy/reauth/만료를 다시 판정하지 않는다.
2. 원 snapshot은 {declaration,status,authority,readiness,reason}, H는 기존 canonicalJson/contentHash다. declaration은 hostLabel/displayName/pathHint/reason/connectorId 닫힌 구조다. 원 readRootDeclaration/readSourceRootInput/sourceRootSnapshot·#record를 그대로 재사용해 hash/result/snapshot/protectedRef·connector_id/원입력 형태를 검산한다. protectedRef는 임시 일치검사용이며 출력0이다.
3. v1은 saveSourceRoot/expected0/previousRef null/DECLARED, 이후는 reviseSourceRoot 또는 revokeSourceRoot/expected=v-1/정확 previousRef다. 이전 상태 DECLARED가 필수이며 REVOKED 뒤 revise/revoke나 gap은503. revoke는 이전 declaration을 그대로 유지하고 reason만 자기 원입력과 결박한다. 버전/사건 사이 timestamp 단조·같은 actor 강제0이다.
4. 선택 command는 위 원 op·APPLIED·actor/client=version·양의controlGeneration·정확PROJECT scope와 원 result targetRef를 확인한다. request를 다음 저장 입력으로 재구성할 수 있다: schemaVersion1,projectId,commandId=c.command_id,clientId=c.client_id,controlGeneration=c.control_generation,operation=c.operation,targetId=(v1?null:root_id),expectedVersion=v-1,baselineRefs:[],approvalRef:null,payload. payload는 save/revise의 {declaration,baseRef,reason}, revoke의 {baseRef,reason}. H(재구성request)=c.request_hash를 비교한다. 원 source command가 baselineRefs/일회승인을 거절하므로 이 둘을 임의 nullable로 면제하지 않는다. c.approval_consumption_id/payload_ref,receipt.approval_decision_ref,primary audit.approval_ref는 모두null이다.
5. result는 실제 persistProjectReceipt의 고정10키/값·data의 ref/status=SOURCE_ROOT_VERSION_STORED/snapshot/previousRef/protectedRef와 원serverReceivedAt strict ISO ms를 검산한다. 원 JSON H를 Date 변환/투영으로 바꾸지 않는다.
6. authorization receipt는 c.authorization_receipt_id↔receipt.id/command_id·PROJECT scope·HUMAN user/client·동일 policyRef를 대조한다. scopeDigest=H({projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration:c.control_generation,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:원ref})를 검산한다.
7. 원 primary audit는 선택command의 HUMAN_COMMAND/APPLIED/correction_of null 정확1건이다. actor/client/operation_id/target_ref/policy_ref·scope_digest와 reason_code EXPLICIT_UNVERIFIED_SOURCE_ROOT를 비교한다. 다른 선택 audit·정정행도 누락하지 않되 raw target/주체/자유내용은 출력하지 않고 derived metadata hash·미판정 이유만 보존한다. 원 hash가 없는 audit 행에 VersionRef를 발명하지 않는다. 정정 대상이 선택집합 밖이면 참조만 NOT_PERFORMED로 남기며 다른 자료를 따라 읽지 않는다.
8. c.received_at/receipt.authorized_at/primary audit.recorded_at/version.created_at는 이 producer의 같은 transaction now() 사건이다. c.completed_at도 now(), result.serverReceivedAt는 transaction_timestamp()의 JS ms다. 각 같은 사건 DB timestamp는 정규 UTC micro로 대조하고 result 시각은 해당 DB시각의 ms 절삭 값과 대조한다. v1 head.created_at도 첫 사건과 비교하되 v2 이상과 비교하지 않는다. 다른 사건의 server_sequence는 순서키일 뿐 시각 단조를 요구하지 않는다.

DB timestamp는 승인된 parser와 같은 4자리 양의연도/offset/최대6fraction UTC 정규화·micro 보존을 새 파일 private 함수로 사용한다(새 공통화0). 원 read용 Date는 동일 시각의 ms 표현으로만 전달하고 rawmicro는 그 전에 정규화된 출력/derived metadata hash에 보존한다. 원 protocol result.serverReceivedAt는 별도 strict ISO ms 검사이며 DB parser로 완화0이다. 실제 PG 검증은 아니다.

## 7. 익명 DTO·원hash와 투영hash

새 kind SOURCE_ROOT_HISTORY_INVENTORY_V1,scope PROJECT_SOURCE_ROOT_DECLARATION_HISTORY_ONLY다. 원projection은 정확 kind,projectId,roots,versions,evidence,issues,externalDependencies의8필드로 고정하고 inventoryHash=H(원projection)다. 반환에는 observation(실RR·전후RC),usage(metadataBytes/inputBytes0/fileCount0),선언 false/NOT_PERFORMED와 rawSnapshot/declaredPaths/connectorMetadata=NOT_EXPORTED를 별도로 둔다.

roots는 rootId/headVersion/최초 ref·생성시각/익명 작성주체만, versions는 ref/previousRef/status/authority USER_DECLARED/readiness UNVERIFIED/생성시각/익명주체/원command id/선택증거만 허용한다. 원 snapshot을 반환하지 않는다. H(snapshot)=원ref.contentHash와 별도로 각 익명projectionHash를 계산한다. evidence는 원 command id/external commandId·operation·정확targetRef/requestHash/정의된 authorizationReceiptRef 및 audit eventId/sequence/derivedMetadataHash·국소 검증범위만이다. 과거 actor/client 원문과 원 policy rules·복구 가능한 permission을 반환하지 않는다.

자유 문자열/경로/connectorId를 단순 rename해서 내보내지 않는다. 알려진 Secret 표식 검사와 원 input validator를 통과 못하면 원문 없는 고정503으로 닫고 원문을 오류/stack/cause에 덧붙이지 않는다. 완전한 비밀 탐지를 주장하지 않는다. 원권한복원/current trust/OS access/원문 bytes/백업/restorable/전체coverage/실행허가는 모두false 또는 NOT_PERFORMED다.

## 8. 실 Root provider·출처 한정 연결

새 profile에서만 SourceRootHistory.versions[].ref를 SOURCE_ROOT_DECLARATION namespace로 공급한다. 고정 원storage ref뿐이며 connector/registration/credential/source-observation ref를 대신 만들지 않는다.

PermissionPolicy의 external('SOURCE_ROOT',s.sourceRootRef)와 ResultReviewHistory의 externalRef('SOURCE_ROOT_REFERENCE',source.sourceRootRef)는 실제 DTO지만, readSourceScopesV1은 범용 VersionRef 형태만 검사한다. source_root_versions에 대한 원 producer 결박은 없다. SourceReadGrants가 별도 프로토콜에서 ProjectSourceRoots.read로 검산하는 사실은 이 두 producer의 의미 동등성 근거가 아니다. 따라서 두 generic kind를 SOURCE_ROOT_DECLARATION에 전역/국소 alias하거나 exact/부재/hash충돌 판정하지 않는다. 선언과의 의미 연결은 NOT_COLLECTED로 남기며 각 dependency의 기존 wire status(EXTERNAL_UNSUPPORTED 등)도 그대로 보존한다. 새 literal status/현재권한/원 row 손상을 발명하지 않는다. 자체 SourceRootHistory.versions의 명시 저장 row/ref만 신규 고유 namespace에 공급하여 자체 ref 무결성·중복·hash를 확인한다.

원global missing의 CONNECTION_REGISTRATION_SOURCE_ROOT_SETTINGS와 SOURCE_AND_UNCOMMITTED_FILES 등 umbrella는 삭제0이다. 이 단위는 선언 metadata 일부뿐이며 전체 등록/설정/실파일 수집이 아니다. profile이 없는24/26의 원 dependency 판정은 변경0이다. 새 collector는 실제 artifact ref/bytes를 추가하지 않으므로 D/B/V·file 보수상한 의미는 불변이다. metadata는 새 collector raw응답/추가원read/DTO+Root/consumer 최종DTO까지 누적하고 단계 reset0이다. 원hash/관측·최소TTL/미수집·false·close503 우선순위가 실제27 consumer로 전달돼야 한다.

## 9. 합성 생산자·직접 검수

별도 GO 뒤 신규2시험만 먼저 작성하여 새 profile/수집 부재 RED를 남긴다. 실제 new AccessRepository/ProjectSourceRoots/ProjectBaselines와 가능한 실제 save→revise→revoke 생산자를 사용한다. 원 command/receipt/audit/source_root 5표가 Root의 전체원장·정책참조·새collector에서 같은 저장 상태를 보게 한다. actor가 바뀐 과거 개정도 현재 OWNER와 구분하여 정상이다. 보조 joined-row stub이 불가피하면 그 호출선 시험은 완전 저장표 통합 증거와 분리하며 더미 성공 검증으로 기준을 맞추지 않는다.

필수: 기본24/기존26 결과·hash·count 불변과 명시27 실제 Root/consumer 소비, true외false/type/extra/accessor·나중 caller변조 DB0, 실제 CSRF/전후 OWNER·신원 상실 자료/IO0, 원snapshot/hash/request/result/scope/receipt/audit·revoke뒤수정·missing/gap/중복/뒤page 오류503, 정상200/다음page(원도메인상 가능 경우), 타프로젝트/원path/host/PII/connector/Secret 비노출, 자체 선언 row/ref 무결성·중복·독립재봉인 hash충돌, 두 generic sourceRoot kind에 우연히 같은 id/version/hash를 넣어도 선언 provider로 해결하지 않음·기존 wire status 유지, 알려지지 않은 kind 미수집, PG micro/offset·ms protocol/시간역전 정상, 충분한 한도/최종metadata·취소/기한/초기실패 뒤후속0, pending/rollback/release 불명+동시cancel503/단발자기회수, root 기한의consumer IO/최종DTO 전파다. 기존 고유원문 후속open1/transaction0와 class 반복RC내IO를 혼동하지 않는다.

신규 행동 prefix='source root history profile ',신규schema prefix='sourceRootHistoryProfileSchema '로 고정한다. 실행 예정 명령:

node --test --test-name-pattern="source root history profile |sourceRootHistoryProfileSchema |feature composition actual context|feature composition default context|featureArtifactConsumerSchema |feature artifact consumer actual26|feature artifact consumer postRoot OWNER|projectArtifacts 실제24|projectArtifacts 빈 실제조합|projectArtifactsSchema" tests/unit/FN16/source-root-history-profile.test.ts tests/unit/FN16/source-root-history-profile-schema.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts
npm run typecheck
git diff --check

prefix가 실제 assertion 이름에 매치하는지 확인하고 무매치 파일 smoke를 PASS수로 쓰지 않는다. 기존24/26 fixture의 default count/phase를 새27에 맞춘다는 이유로 바꾸지 않는다. 기존 전체수집기/67/48/58/201 전수 반복0이다. Main fresh와 독립 C0/I0 뒤에 source 단위 합격이며 실제DB/RLS/FS·등록/trust·전체백업·복원·사용자인수는 NOT_RUN이다.

같은 근본원인 실패를 무변경 재실행하지 않고 최초 원인/수정/횟수를 제출한다. 3회면 Main에게 정식 원인보고·범위 재검토, 조건 완화0이다. 최종 정확5지문/명령exit/실assertion·미실행·남은공백 후 writer 해제한다. rollback은 이 명시profile/source delta의 정상 source revert이며 기본24/26·실자료·계정/키/DB·서비스 변경0이다.

## 10. 사전검수에서 확정할 열린점

- 두 generic sourceRoot kind의 선언 저장소 결박은 입증되지 않았다. 의미 연결 NOT_COLLECTED 및 기존 wire status를 고정 보존하며, 전역/국소 alias·우연히 동일한 ref를 이용한 해결은 금지한다. 신규 SOURCE_ROOT_DECLARATION provider는 자체 저장 row/ref에만 한정한다.
- 원 same-event micro/JS ms 대조는 위 실제 producer/DEFAULT now() 근거의 동일 사건에만 적용한다. 원형이 없는 가짜 requestHash를 생성하거나 모든 과거시각 단조를 가정하지 않는다.
- 원 ProjectSourceRoots.read 호출에 필요한 bounded join·이전버전 query 복원은 새 collector 안에서만 수행한다. 기존 메서드/SQL 수정이 필요해지면 먼저 정확 근거와 허용범위 차이를 Main에 보고한다. 제품 GO 전 이 문서의 준비 상태를 실제 구현/현재 자료 조회 PASS로 바꾸지 않는다.

## r2 — 사전 Important1: 형태와 저장소 의미 결박 구분

부모 WI SHA256 4475728E1293F49AFE40E06CE2C708CE905B17183858F2D32DED3D10A5532341. contracts/runtime/source-scope-v1.ts:14는 refV1(sourceRootRef)만 검사하며 두 원 producer는 source_root_versions를 대조하지 않는다. 같은 field/parser를 쓴다는 사실만으로 선언 namespace에 연결했던 §8/10의 추론을 제외했다. 두 generic dependency는 의미 미수집과 원 wire status를 유지하며 동일 id/version/hash도 해결 근거로 쓰지 않는 반례로 바꿨다. 자체 선언 provider·원 row/ref 검산은 유지한다. 다른 범위/5코드/66열/한도·원보호/제품GO0 조건 변경0이다. 이 r2도 문서 작성·검수 단계이며 코드/시험/실환경 실행 허가가 아니다.
## r3 — Root-owned 내부 호출선의 인증 선행 한정

부모 WI SHA256 40A5B7D0F868E4083B2354C1CCAD2520C7B785C63698BB8E4C452D6424FCCAF4. 구현 전 실제 접점을 확인한 결과 새 collector는 Root의 pool/authenticated guard를 받으며 별도 raw repo의 authenticateInTransaction을 호출하는 API가 아니다. 명시27의 실제 contextAuthenticated 경유만 지원하는 내부 단위로 좁혔다. standalone raw repo의 connect/auth-lock 선행기한을 구현/검증했다고 주장하지 않는다. 실제 Root27 호출자는 신뢰된 서버 내부 소유선이며 이 선행을 boolean/명목 브랜드로 증명하지 않는다. 신규 파일의 internal 주석/타입·실제 호출자 한 곳과 정상·인증 pending·최소기한 반례로 해당 소비선을 고정한다. callback 자체를 성공 공급자로 만든 fixture는 허용하지 않는다. 원 SourceRoots.read·RR/최종RC·회수503·기존24/26/5코드/66열·원형 비반출·실환경 제외는 불변이다. Main과 독립 읽기에서 이 한정은 기존 신뢰모델에 맞고 새 권한/공개계약 확대가 아님을 확인했다.
