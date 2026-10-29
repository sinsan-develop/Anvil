# FN16 본인 제어요청·합성 인계 역사 명시 profile 실제 소비 작업지시서 — 2026-10-30

상태: 문서 작성만 허가됨 / 제품 GO 전 Main·독립 사전검수 대상. 기준 HEAD d97a453673222270acb6e3cafd6b8568066f2950, branch codex/av3-stage-b. Main은 범위·기록·검수·통합, 별도 제품 GO 후 Primary는 정확5코드 단독 writer, Reviewer는 읽기 전용이다. 이 문서는 코드·시험·DB·FS·키·서비스·Agent·Git 실행 승인이 아니다.

실행 담당자는 별도 GO 후 executing-plans 또는 Main의 subagent 실행 절차를 적용한다. 문서 위치·한국어 형식·단일 writer·Main의 Git 소유권은 일반 스킬 기본값보다 이 WI를 우선한다.

목표: 이미 완료된 실제 FN15 factory의 본인 제어요청·합성 인계 역사 검산을 기존 Root/원문 consumer의 명시 선택 profile에 실제로 연결한다. 새 standalone 수집기·공개 API·enable boolean·권한 proof를 만들지 않는다.

## 1. 승인 범위·원형·미구현 경계

기존 FUNCTION_WORK FN16의 상태·관계·명령 증거·역사 metadata 수집과 완료된 FN16_CONTROL_HANDOFF_OWN_HISTORY_INVENTORY_IMPLEMENTATION_20261029의 실제 생성 factory/검산 경로를 소비하는 내부 상세화다. 문서 전용 PMO 결정으로 원형 접근 권한을 새로 승인받았다고 인용하지 않는다. 현재 OWNER+본인 requested_by 원범위만 소비한다.

main.ts에는 해당 factory 생성·전달이 없고 enabled 활성0이다. 이번에 main.ts/route/ProjectBackups를 바꾸거나 factory를 자동 생성·ON하지 않는다. 합성 시험 안에서 실제 createControlHandoffPgSource({pool,access,enabled:true})를 생성하는 것과 실제 설치 gate·권한 승인은 구분한다. 공개 사용자 기능·전체 백업·복구·실환경 연결 완료를 주장하지 않는다.

기존 default24, baselineContext26, sourceRootHistory:true의27은 동작·필드·hash·기존 metadata/기한/원문 보호를 보존한다. 보호참조A 미연결, 공유 RO issuer/ABA 미확정, FN15 실제 활성0, 미채택158E10BC 정책을 해제하지 않는다. PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS를 포함한 전체 umbrella notCollected를 삭제하지 않는다.

## 2. 별도 GO 후 정확5코드와 시작 지문

1. apps/server/modules/control-handoff/control-handoff-pg.ts — 시작 SHA256 CAC475BB34B23941D3034BFB877C612DE2AB19CAC9A6F21E704C5736D759634D. factory 생성 provenance·Root 전용 내부 helper와 기존 private read helper의 trailing 제약만 추가한다.
2. apps/server/modules/backups/project-inventory-composition.ts — 시작 SHA256 2521C6D670E5B904E6FE68F8A7008DC964415BE5D63480FF1479B3D67E3E54AA. 실제 provenance 확인·명시 profile·사전 factory 소비·원 결과 검산·전체 회계·제한 데이터 전파.
3. apps/server/modules/backups/artifact-current-verification.ts — 시작 SHA256 6F4E9EB89EF359996FA6DDC4AA4D61F3D8613E9E3FD91B4E7C040CF21A45E422. 닫힌 context 복사·명시 profile 실제 Root 소비·기한/회계 보존. 기본 단일/3자료군/24 및 기존26/소스27 경로 의미 변경0.
4. 신규 tests/unit/FN16/control-handoff-history-profile.test.ts — 실제 생산/읽기·Root·consumer·구성/신원/예산/회수 반례.
5. 신규 tests/unit/FN16/control-handoff-history-profile-schema.test.ts — 실제5표43열·gate·원projection·소비선/기존 경계 정적 대조.

기존 control-handoff-history-inventory.ts(원 SHA B6CA2A0EE35CF04828A5724C3A3A6AC2D25A1D15C3276CD370C0B07B1E463207), 원 request/summary 검산기·store·input·AccessRepository·baseline class·byte helper·다른 수집기·기존 tests·SQL/RLS/role/GRANT·정책·공개 API는 수정0이다. 새 공통 controller/인증 브랜드/범용 SQL 도구/수집기는 만들지 않는다. 보호8·Main WORK_STATUS/설계/계획/현황·Git 쓰기0. 이번 문서 작성 허용은 양 root의 이 WI 한 파일뿐이다.

## 3. 생성 provenance와 오구성 차단

현재 factory는 enabled만 const이며 options.pool/options.access를 호출 때 다시 읽는다. 기존 public forSession/readOwnHistoryInventory의 이 의미는 그대로 보존한다. 새 Root 전용 경로만 생성 순간 고정한 구성으로 실행한다.

control-handoff-pg.ts 모듈 비공개 WeakMap<object,Readonly<OwnedHistorySourceRecord>>를 사용한다. 실제 createControlHandoffPgSource가 반환하는 객체를 key로 그 생성 함수 안에서만 기록한다. 기록은 frozen pool/access 참조·enabled 값·기존 schemaQuery/migrationId/checksum을 사용하는 실제 read 폐쇄함수다. 공개 등록 setter·브랜드 발급·외부 callback·caller가 입력하는 true/검사 완료 proof는 없다. 공개 객체의 method 교체/추가 속성·가변 options의 이후 변경은 Root 전용 호출에 영향을 주지 않는다.

Root 소유 실제 AccessRepository와 pool 객체 참조가 기록의 access/pool과 각각 ===이고, 기록의 access.pool도 고정 pool과 ===인지 토큰/CSRF 전달·connection 이전 확인한다. factory를 만들 때부터 pool A/access B.pool인 오구성도 거절한다. record 부재·복제 객체·동일 메서드 모양·Proxy key·상속/prototype 흉내·타 factory pool/access는 INPUT_INVALID400으로 자료/인증/토큰 전달0이다. 기록을 조회할 때 공개 method/임의 getter를 호출하지 않는다. access.pool이 이후 바뀌면 새 Root 전용 경로는 계속 거절한다.

이 검사는 서버 내부 구성 provenance이며 인증/OWNER 권위를 발급하지 않는다. 악성 동일 process의 모듈 반사·prototype 변조·메모리 변조 방어를 보장하지 않는다. enabled는 기존 생성 설정을 소비할 뿐 새 enable 입력이나 featuregate proof가 아니다. OFF는 아래 실 Root 인증 후 실제 read 폐쇄함수가 기존 CONTROL_REQUEST_NOT_CONNECTED503으로 거절한다.

## 4. 고정 내부 signature와 제한 봉투

새 module-private record/interface의 필드명은 다음 의미로 고정하며 public DTO에는 넣지 않는다.

- OwnedHistorySourceRecord = Readonly<{pool:Pool; access:AccessRepository; enabled:boolean; read:실제 readOwnHistoryFromFactory를 고정 pool/access로 호출하는 폐쇄함수}>. gate는 원 상수만 사용하며 caller override0.
- ExpectedHistoryIdentity = Readonly<{actorId:string;clientId:string;credentialGeneration:number;sessionId:string}>.
- CompositionHistoryReadConstraint = Readonly<{expectedIdentity:ExpectedHistoryIdentity;deadlineMonotonicMs:number}>. 유한 절대 단조기한·양의 safe generation·actorId/clientId/sessionId의 UUID 형식을 검증한다. 입력에 token/CSRF/권한표식은 포함하지 않는다.
- export assertControlHandoffHistorySourceBinding(source:unknown,rootAccess:AccessRepository):void. 위 기록/참조만 검사하고 DB/실권한 검사나 성공 proof를 반환하지 않는다.
- export readControlHandoffHistoryForComposition(source:unknown,rootAccess:AccessRepository,token:string,csrf:string,value:unknown,signal:AbortSignal,constraint:CompositionHistoryReadConstraint):Promise<Readonly<{inventory:Record<string,unknown>;readConstraints:Readonly<{identity:ExpectedHistoryIdentity;deadlineMonotonicMs:number;metadataCharge:number}>}>>.

후자도 먼저 같은 binding 검사를 재수행하고 기록의 read 폐쇄함수만 호출한다. 공개 source.readOwnHistoryInventory를 다시 읽지 않는다. value는 기존 readDocumentInventoryInput의 projectId/limits이며 새 project/actor/role 선택은 없다. 함수/제약은 첫 await 전에 닫힌 descriptor·직접 data property로 복사하고 getter·extra/symbol·기한 NaN/무한/잘못된 identity는400이다. 실제 신원은 이후 원 인증이 만든 값이며 expectedIdentity는 추가 제한일 뿐 인증 대체물이 아니다.

기존 private readOwnHistoryFromFactory에 trailing 선택 constraint를 추가하는 최소 방식으로 원 메서드·gate·auth·metadata 검산을 재사용한다. 기본 호출은 원 결과와 usage/오류 의미 그대로다. 새 경로에서는 최초/최종 실제 authenticateInTransaction 직후, 자료 SELECT 전에 Root의 expectedIdentity4와 정확 일치시킨다. 불일치는401이고 본인 요청표/요약표 SELECT0이다. RR은 최초 RC 실제 identity만 사용한다. projectId는 요청값 하나를 전 phase에 고정한다.

Root 전용 constraint의 절대기한은 함수 진입 전부터 remaining=min(자체 요청기한,Root 절대기한,phase별 실제 auth 최소기한) 산술에 반영한다. connect/인증 FOR UPDATE/기존 gate pending도 여기에 묶고 남은0에서 Math.max로 새 양수 예산을 발명하지 않는다. 실제 clock/세션을 관측할 때마다 기한을 단축만 한다. 성공·최종 DTO 직렬화 뒤 check를 통과한 경우에만 내부 frozen 봉투를 만든다. identity/기한은 공개 inventory/hash/로그/저장에 포함하지 않는다.

기존 public usage.metadataBytes는 최종 inventory DTO canonical 길이라는 뜻을 유지한다. Root 전용 metadataCharge는 실제 phase raw/검산 projection 비용 metadataUsed + 최종 DTO 길이를 safeinteger로 계산한다. DTO 길이를 두 번 누적하지 않고, raw 비용을0/기존 usage에서 역산하지 않는다. 최종 정착 loop가 완료한 실제 n을 사용한다. 이 내부 비용도 같은 최종 한도 검사에 포함한다.

## 5. profile 선택·실행 순서·기존 보존

baselineContext는 기존 {baselines:ProjectBaselines;csrf:string;sourceRootHistory?:true}에 선택 controlHandoffHistorySource?:실factory반환객체만 추가한다. 새 입력 source가 인증을 대신하지 않으며 baselineContext 바깥 별도 control-only25모드를 만들지 않는다.

| 선택 | 실제 component 수 | 원 경계 |
|---|---:|---|
| context 없음 |24|기존 default 완전 보존|
| baselines+csrf |26|기존 선택26 완전 보존|
| 위+sourceRootHistory:true |27|기존 소스root27 완전 보존|
| baselines+csrf+controlHandoffHistorySource |27|새 본인 제어역사만 선택|
| baselines+csrf+sourceRootHistory:true+controlHandoffHistorySource |28|새 명시 결합|

Root 양 진입점/consumer는 첫 await 전에 같은 context를 닫힌 descriptor로 복사한다. 허용 키는 baselines,csrf,sourceRootHistory,controlHandoffHistorySource이고 필수2+선택0..2만 허용한다. sourceRootHistory는 present이면 true만, control source는 present이면 기록된 실제 key만 허용한다. false/null/undefined-present/숫자/가짜객체/extra/symbol/accessor는400·getter0·DB0이다. 값으로 method를 호출해 provenance를 검사하지 않는다. caller가 나중에 options/context/public method를 바꿔도 고정 source/ref/CSRF를 다시 읽지 않는다.

새 control 모드의 실행 순서는 Root 실제 bounded 최초 RC auth/CSRF/OWNER → 실제 factory의 gate+RC/RR/RC history 완결 → 기존24(기존 내부 순서) → 선택 SourceRootHistory(있을 때) → FeatureBaselineDraftHistory → FeatureBaselineDecisionHistory → Root 최종 RC/DTO다. ControlHandoffOwnHistory component는 실행 순서대로 맨 앞에 기록한다. gate OFF/오류면 기존24 및 baseline 반복 원문 IO와 후속 consumer 물리 IO0이다. 원24를 빈 성공으로 대체하지 않으며 factory 자료를 whole ledger로 잘못 읽지 않는다.

factory의 RC-RR-RC는 자기 pool에서 자기 트랜잭션/자기 pending/자기 release를 소유한다. Root는 그 메서드 내부 q를 중첩 timer로 감싸거나 같은 client의 timeout을 다시 덮지 않는다. Root 최초 RC는 닫은 후 factory를 호출한다. factory 반환의 숨은 최소기한을 Root authDeadline/resourceDeadline에 즉시 min으로 반영하며 shared baseline budget 생성/단축·Root 후속 pending/consumer 제한 봉투에도 전파한다. 새 source를 사용하지 않는24/26/소스27에는 이 비용·기한·필드·출처를 추가하지 않는다.

## 6. 원5표43열·정렬·보호 projection

다음 registry는 기존 readOwnControlHandoffHistoryRows 그대로이며 신규 선택 조회를 늘리지 않는다. 모든 SELECT에 project_id=요청project. 요청은 requested_by=실제actor를 SQL 선필터한다. 요약과 증빙은 이 본인 요청에서 도달한 ref/id만 읽는다. 원 client가 현재 읽는 client와 달라도 본인 자료면 정상이다.

|표|정확 열|정렬/선택|
|---|---|---|
|control_handoff_source_requests(11)|project_id,id,version,content_hash,snapshot_json,metadata_json,requested_by,client_id,source_command_id,created_at,expires_at|id,version ASC·본인만|
|control_handoff_source_summaries(11)|project_id,request_id,request_version,request_hash,version,content_hash,body_json,metadata_json,source_command_id,observed_at,valid_until|request_id,version ASC·본인 request_id=ANY|
|control_handoff_source_commands(15)|command_id,project_id,operation,actor_id,client_id,request_id,request_version,request_hash,summary_version,summary_hash,base_control_json,command_json,command_hash,payload_hash,created_at|command_id ASC·도달 source_command_id=ANY|
|control_handoff_source_receipts(3)|command_id,project_id,body_json|command_id ASC·같은 source_command_id|
|control_handoff_source_audits(3)|command_id,project_id,body_json|command_id ASC·같은 source_command_id|

200 keyset·응답201거절·정확 row envelope/metadata 상한/원 hash 검산은 기존 collector가 소유한다. 개인 자료/다른 프로젝트/타 requested_by/CONTROLLER 타인 목록을 OWNER라는 이유로 합치지 않는다. 본인 요청0이면 summary/evidence도0이며 타인 존재건수·시각·원문을 알려주지 않는다.

기존 원projection은 정확 {kind,projectId,requests,summaries,evidence,issues,externalDependencies}, inventoryHash=H(canonicalJson(원projection))다. Root는 이7필드를 그대로 검산한다. requests[].ref는 원 requestRef/version1, summaries[].ref는 원 summaryRef이며 requestRef 연결을 유지한다. 원 command_json H/원 payload H·원 request snapshot H·summary H와 selected receipt/audit 의미 검산은 verifiedBundle/verifyStoredControlHandoffHistoryBundle을 그대로 거친다. 원 hash가 없는 receipt/audit에 가짜 VersionRef를 만들지 않고 receiptDerivedHash/auditDerivedHash만 보존한다.

snapshot/metadata/body/원command/targetActor/targetClient/baseControl/actor/client/token/CSRF/digest·정책·nonce/계정·경로 원문을 새 DTO/ref/declaration/hash 대상으로 반출하지 않는다. 기존 고정오류/민감 표식 차단을 성공 unavailable 봉투로 바꾸지 않는다. 직접 요청 취소/승인/소비·제어권 실제 전이/lease/grant/세션 복원은0이다.

DB timestamp는 기존 private stamp의 offset/UTC·최대6fraction·양의4자리 연도 정규화를 그대로 사용한다. 원protocol snapshot.createdAt/expiresAt/body.observedAt/validUntil/command.createdAt의 strict ISO ms 요구와 DB timestamp를 혼동하지 않는다. 이 단위에서 원형 시각 검산을 느슨하게 바꾸거나 과거 requestExpiresAt를 현재 now와 비교해 역사 조회를 막지 않는다. 기존 fingerprint는 정규 DB시각/실저장 원형만이며 매번 바뀌는 관측 clock을 동일성 조건에 넣지 않는다. 실제 PG 형식/SQL 설치 검증은 미실행이다.

## 7. Root 요약·ref·metadata·consumer 회계

component 이름 ControlHandoffOwnHistory, kind CONTROL_HANDOFF_OWN_HISTORY_INVENTORY_V1, scope OWN_CONTROL_REQUEST_AND_SYNTHETIC_SUMMARY_HISTORY_ONLY로 고정한다. observation은 원 child에 없으므로 이 명시 profile component에만 null/observationExport=NOT_EXPORTED로 한정하며 기존24 관측 요구를 완화하지 않는다. rowCounts는 requests/summaries/evidence/issues/externalDependencies의 실제 길이만, originalHash는 원 inventoryHash, resultDigest는 H(실제 child DTO)다. actor/client/제어요청 원문·현재 control 상태를 요약에 추가하지 않는다.

requests[].ref는 CONTROL_HANDOFF_SOURCE_REQUEST, summaries[].ref는 CONTROL_HANDOFF_SOURCE_SYNTHETIC_SUMMARY라는 고유 namespace로만 공급한다. summary.requestRef는 원 request namespace의 명시 관계로 존재/일치 검산하되 원 row에서 없는 ref를 발명하지 않는다. 같은 id/version이라도 두 namespace를 합치지 않는다. 기존 PROJECT 명령의 APPROVAL_REQUEST/ROLE/CONTROL/QUEUE 등 generic dependency와 자동 alias0이다. 여기 source_command_id는 FN15 전용 원장이며 ProjectControlLedger commands.id와 같은 증거라고 가정하지 않는다. 원복구 권위·현재 제어권 proof는 없다.

원 선언 controlGenerationTransitions=NOT_RECORDED,currentAuthorityVerification/blobVerification=NOT_PERFORMED와 fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/controlTransferred/atomicSnapshotVerified=false를 요약에도 보존한다. 각 summary의 realCollectorsConnected/acceptanceEnabled/executionAuthorized/controlTransferred=false를 따로 확인한다. SYNTHETIC_ONLY/원 safetyState는 저장된 합성 판단이며 실제 세대 전이 원장은 존재하지 않는다는 한계를 없애지 않는다.

새 child의 inputBytes/fileCount는0이므로 D(24고유선언),B(기준선 실반복읽기),V(후속고유실검증)의 원뜻과 D+B≤G,V≤D,B+V≤G,보수 file upper bound는 그대로다. control metadataCharge를 전체 Root used에서 한 번 차감하고 잔여0이면 뒤 child/원문 IO 전에413이다. 공개 child usage.metadataBytes는 원 DTO 크기 뜻을 유지한다. 새 Root 모드의 resourceAccounting.metadataAccounting만 해당 비용의 명시 descriptor로 구분하고 compositionHash에 결박한다. 비용 관측값은 인증 proof가 아니며 최종 metadata 고정점/기한 검사를 생략하지 않는다. old26/소스27 descriptor는 원값 그대로다.

실 consumer는 선택된27 또는28의 실제 Root envelope를 받아 같은 identity·단축기한·공유 D/B/V accounting으로 원 후속 current artifact/conversation 검사와 고유 open1을 수행한다. 기준선 class의 RC내 반복 IO와 후속 물리 IO중 transaction0을 구분한다. 초기 UNKNOWN/격리·대화 exact bodytuple·공유ref 차단우선·최종 모든 현재성·close 불명503·최종 직렬화 후 check는 그대로다. control history는 새로운 artifact/provider를 만들지 않는다.

## 8. 기한·취소·회수와 실패 기준

유한 요청기한은 consumer 시작부터 Root→factory→Root 나머지→후속 IO→최종 직렬화까지 단조 감소한다. factory가 관측한 더 짧은 session TTL은 남은 모든 DBpending/statement와 원문 budget/IO/최종 반환에 반영한다. 수집 phase마다 counter/deadline을 재생성해 예산을 연장하지 않는다. 기존 helper/일반 controller 알고리즘은 수정하지 않는다.

factory 기존 q/own phase의 tracked handler·late connection/release·ROLLBACK/COMMIT/기존 cleanup 오류 의미를 보존한다. 실행중 pending을 Promise.race로 버리고 성공/다음 SELECT를 시작하지 않는다. 회수 불명503은 동시에 취소409/기한413보다 우선이다. 실제 rollback/release가 실패한 증거와 외부 guard가503으로 포장된 것만은 구분한다. 해제 대상은 자기 client1회, 이미 pending인 쿼리는 handler로 관측하며 최종 성공0이다. OS/드라이버 pending의 절대시간 종료를 보장하지 않는다.

현재 standalone는 statement_timeout만 설정하는 원 경로다. 이번 read 제약은 기존 timeout 설정의 remaining을 정확 min에 묶으며 원 default에 lock/idle/readback을 임의 추가하지 않는다. 새 history read에 실제 lock/idle 추가나 원구조 변경이 필요하다고 발견하면 근거를 Main에 보고하고 WI 재검수 전 추가하지 않는다. gate·auth pending은 원 tracked/caller-owned RC로 유한 관측한다. Root의 기존 자체3설정/readback과 factory 소유 설정을 동일 client에 중첩 적용하지 않는다.

## 9. 정합 합성 생산자와 필수 반례

별도 GO 후 신규 시험2를 먼저 작성하고 실제 profile/내부접점 부재 RED를 보존한다. 실제 new AccessRepository/new ProjectBaselines·실 createControlHandoffPgSource와 실제 request/summary 저장기를 가능한 원 forSession port로 실행하여 요청/command/receipt/audit5표를 만든다. 같은 프로젝트·같은 실제 pool/access·같은 메모리 저장상태를 Root/전체원장/기준선/원문 consumer가 보게 한다. FN15 전용 원장과 PROJECT 원장은 실제 다른 표임을 지키고, 공유표를 무조건[]로 돌려 정상 경로를 만드는 우회0이다. 보조 원형 fixture가 필요한 경우 원 bundle/hash/명령 증빙을 전부 정합화하고 실제 생산자 정상과 구분한다.

필수 검수는 다음과 같다.

- [ ] 부재 RED → 실제27/명시28 Root 및 실제 memory-owned reader consumer 성공. default24/26/기존 소스27은 source/key/비용/순서/관측 없이 그대로이고 새0행 wrapper로 완료하지 않는다.
- [ ] actual factory key만 통과. cloned/prototype/plain method callback/외부 bool·다른 pool·같은 pool 다른 access·처음부터 불일치 access.pool·사후 pool변경은 토큰/CSRF 전달0·connect0. options의 pool/access/enable를 생성 뒤 바꾸거나 public method/getter를 교체해도 고정 read만 호출하고 공개 getter0이다. fake source 검사는 실제 인증을 대체하지 않는다.
- [ ] OFF/스키마 없음/checksum 오류는 Root 실제 auth는 수행하되 history/기존24/기준선 원문/후속 IO는 수행하지 않고503. caller가 enabled:true를 context로 주거나 extra/accessor/source undefined-present는400·getter0·DB0이다.
- [ ] Root actual identity와 factory actual identity mismatch는 own 자료 SELECT0·401. 최초/최종 OWNER 상실404·다른 credential/session401, 타 requested_by는 SQL에서 제외·건수/요약0. 본인 다른 유효 client 작성 자료와 이미 만료된 과거 요청은 정상이다.
- [ ] 원 request/summary/command/payload/receipt/audit H·선택 ref/주체/summary fourfalse·원1micro 불일치·원5표 hash/FK손상은503. 원 protocol과 DB stamp를 섞지 않는다. 실제 명령/원형 민감문구는 결과/오류/요약/내부 제한 데이터 hash에 노출0이다.
- [ ] 요청 namespace/합성 summary namespace 동일 shape가 섞이지 않으며 explicit 관계만 확인. generic ref 우연일치로 provider를 발명하지 않는다. 전체 umbrella/세대전이 미기록/미판정/false는 보존한다.
- [ ] metadataCharge가 최종 child DTO보다 큰 정상에서 정확 전체 비용을 Root가 차감한다. DTO만 차감하면 통과하는 경계는 실패해야 한다. 최종 DTO 고정점 이후 한도/기한초과 성공0, 잔여0 뒤 child/원문 IO0, D/B/V·file값은 control metadata 유무로 바뀌지 않는다.
- [ ] factory에서 더 짧은 TTL을 실제 관측한 뒤 Root 후속 empty metadata/기준선/후속 물리read/최종DTO 중 만료 시 성공0이다. Root 요청기한보다 긴 factory 입력으로 연장0. identity/minTTL은 공개 DTO/hash/로그에 없다.
- [ ] auth pending/late connect·RR 자료 pending·최종RC pending·rollback/release 불명+동시cancel은503/성공0/자기 client1회 처리·pending 관측. 실제 Root 인증과 gate를 타는 trace를 확인하고 callback 성공 stub로 대체하지 않는다.
- [ ] 최종 consumer는 초기 격리/UNKNOWN·원bodytuple·공유ref·마지막현재성·고유 open1/후속IO중 transaction0을 보존한다. baseline RC 반복 IO와 혼동하지 않는다.

동일 근본 원인3회는 유효 FAILURE_REPORT 조건/계보와 fixture 선택 오류를 구분하여 Main에 즉시 정식 보고하고 같은명령 반복0이다. 기준 완화·예상값만 변경·원 거절을 success/UNAVAILABLE로 바꾸지 않는다. Main 직접 코드 인수는 별도 지시 없이 선언하지 않는다.

## 10. 정확 검증 범위·증거·rollback

신규 행동 prefix='control handoff history profile ',신규 schema prefix='controlHandoffHistoryProfileSchema '로 고정한다. 기존 직접 최소 회귀는 standalone actual factory 정상/gate/최종직렬화, 기존 default24/선택26 정상, 기존 소스27 실제 consumer만 선택한다. 옛 전체201/48/58/67·앞선 standalone 전체를 반복하지 않는다. 파일명·실test prefix와 매치 개수를 실행 전 확인하고 Node 파일 smoke를 실제 assertion PASS로 합산하지 않는다.

예정 최종 명령(제품 GO 후에만):

```powershell
node --test --test-name-pattern="control handoff history profile |controlHandoffHistoryProfileSchema |own control history actual factory gate|own control history OFF schema checksum|own control history final DTO serialization|feature composition actual context adds two real histories|feature composition default context absent|feature artifact consumer actual26 and repeated|source root history profile true is consumed by real artifact consumer" tests/unit/FN16/control-handoff-history-profile.test.ts tests/unit/FN16/control-handoff-history-profile-schema.test.ts tests/unit/FN16/control-handoff-history-inventory.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/source-root-history-profile.test.ts
npm run typecheck
git diff --check
```

신규 부재 RED/경계 반례 RED→GREEN의 정확 명령/exit/실assertion PASS·FAIL·SKIP/시간·실행handle과 도구 실패/원인·변경점을 기록한다. 동일 본문 지문에서 이미 확인된 범위는 불필요 반복하지 않고, 수행자 결과와 Main fresh/독립검수 증거를 단일 전수 실행처럼 합산하지 않는다. Main이 최종5지문/범위 diff/원 factory public본문·원 collector/hash·기본24/26/소스27 의미 보존과 독립 C0/I0를 확인한 뒤 게시한다. 수행자는 문서/Git을 쓰지 않는다.

rollback은 Main이 별도로 관리하는 검증 checkpoint와 이번5경로 변경만으로 한정한다. dirty/untracked·보호8·타인작업을 reset/clean하지 않고 factory root 선택을 끄더라도 public route/main.ts 실제 활성은 본래0인 사실을 유지한다. 실제 키/DB/서비스/파일·Agent·권한·migration·운영·Oracle·실백업/복구 검증은 NOT_RUN이다.

## 11. 사전검수 열린점과 제품 GO 조건

이 문서가 확정한 방향은 비공개 actual factory 생성 기록을 통한 내부 provenance 결박이다. 실제 auth/OWNER는 기존 코드가 계속 판단한다. 새 보안 브랜드·callback 공급자·genuine이라는 이름만의 표식으로 검증을 대체할 여지는 없다.

구현 사전 대조에서 (a) 원 forSession 실제 생산자와 Root 공유 메모리표의 정합 fixture가5파일 안에 성립하지 않거나 (b) 원 cleanup semantics를 유지하면서 추가 절대기한의 pending 회수가 불가능하거나 (c) factory 원projection/43열과 실제 source가 다르면 정확 근거를 Main/Reviewer에 보고한다. 필요한 변경을 임의로 원 collector/helper/API/SQL로 넓히지 않는다. 독립 사전 C0/I0·Main 원source 지문/범위 확인 뒤 별도 제품 TDD GO가 있어야 구현한다.
