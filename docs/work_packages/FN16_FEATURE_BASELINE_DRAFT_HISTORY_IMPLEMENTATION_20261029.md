# FN16 기능분류 기준선 초안 역사 내부 수집 WI — 2026-10-29

상태: 사전 검수 후보/코드GO전. 기준 codex/av3-stage-b 0f03fd9e933e31d4fea137426b65f917d88f86a7. 기존 FN16 source-only 승인 안의 내부 수집이며 공개 route/권한/SQL 적용/실행 승인이 아니다. Main 관리·검수·통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기 검수다.

## 1. 허용4코드와 목적

- apps/server/modules/projects/project-baselines.ts: 같은 실제 클래스의 readDraftHistoryInventory(access,token,csrf,value,signal), 이 메서드 내부 고정 쿼리 처리·RC/RR·원 보호 조회·최소 projection만 추가. 원 readDraft/#loadDraft/#draft/#receipt/#currentCheck·저장/검토/채택 의미 변경0.
- apps/server/storage/artifact-backup-budget-read.ts: 실제 누적 inputBytes 읽기 전용 조회와 같은 budget의 기한 단축 접점2개만. counter reset/기한 연장/기존 읽기 알고리즘 변경0.
- 신규 tests/unit/FN16/feature-baseline-draft-history.test.ts.
- 신규 tests/unit/FN16/feature-baseline-draft-history-schema.test.ts.

원source SHA: project-baselines 8BA00199D2946FFB382033A9F4314181C999AC8F4AB113DBE4AFB5611CFA8F85, budget helper FC2B044C3976A582E3378B4CEC3C328879D50B563AD8FDB2FC54FB18E66D2BEF. 원조회 전달 선행0f03fd9e를 재작업하지 않는다. 기존23조합·다른 수집기·공개 API/SQL/정책/권한·문서/서버 runtime·보호8 변경0. 실제 FS/DB/키/서비스/Agent 실행0. source 공급자/검증 callback/boolean proof·범용 SQL 도구를 새로 받거나 만들지 않는다.

대상은0015 baseline_drafts7열/baseline_draft_versions9열의 기능분류 초안이며0050 설계변경 적용 inventory와 별개다. source/설계/증거 원문 무결성503을 metadata 미확인으로 생략하지 않는다. 같은 인스턴스의 실제 readDraft/#loadDraft 검증을 호출한다.

## 2. 인증·관측·원문 흐름

기존 readDocumentInventoryInput의 정확projectId/유한 metadataBytes/inputBytes/fileCount/deadlineMs와 필수signal을 검사한다. caller-owned bounded RC에서 같은 access.pool의 실제 authenticateInTransaction(db,token,csrf)를 호출하고 원token/CSRF·DBclock/xid·활성계정/client/세션을 검사한다. 활성 OWNER·동일actor/client/credentialGeneration/session·최소세션기한을 결박한다. 원문 읽기에 현재 재인증·현재 controller/정책/과거actor/client일치를 새 조건으로 요구하지 않는다.

별도 단일 READ ONLY REPEATABLE READ에서 요청 project의 heads/versions 전체를 keyset200으로 읽고 원hash·head/max version·직전exact baseRef·중복/누락을 확인한다. 인증/metadata 권한을 caller 인벤토리나 과거row로 발급하지 않는다. 원조회에는 FN15형 enabled/checksum gate가 없으므로 이를 새 boolean으로 발명하지 않는다. schema/query 실패는 닫고0015/0045 실제 적용을 추정하지 않는다.

원문 IO 전에 exact stored ref와 사전 계수를 재결박하고, bounded RC의 실제 this.readDraft(...,sharedBudget)를 호출한다. 마지막 RC에서도 동일 인증/OWNER·head/list/ref/선택 저장 증빙과 보호 exact read를 재검사한다. RC의 인증·source SHARE 잠금은 RR에 전달하지 않는다. 같은 budget을 전후 전체 읽기에 공유한다. query/connect/commit/rollback/release의 기한/취소와늦은연결회수·회수불명503을 관리한다. 진행 파일IO는 기존협력reader가끝날때까지기다리며 OS절대기한/강제회수는보장하지않는다.

## 3. 원문 전 파일 계수·예산

evidenceRefs는 stored input에서, design body는 exact document_versions metadata의 원 document hash/form/stage/content.body tuple을 먼저 검사해 얻는다. 사전 계수에 documents.version을 호출하면 이미 원문을 읽으므로 금지한다. 같은artifactId의 다른tuple은503, 고유ref fileCount·선언bytes를 IO 전에 제한한다. metadata 없는 자료의 UNAVAILABLE/CHANGED는 실제 원read의 보호 결과로 판정하며 원503을 유실/부분성공으로 바꾸지 않는다.

사전 계수와 실제 documents.version/originalText 재검산은 둘 다 필요하다. 원GET의 source/evidence/문서 읽기를 중복 제거하지 않는다. unique 선언량이 한도 안이어도 반복 실제 읽기로 inputBytes413이 날 수 있다. 실제 사용량은 getter에서 얻고 UNAVAILABLE의 중간 종료를 refs로 역산하거나0으로 기록하지 않는다.

초기 요청/세션최소TTL로 budget을 만들고 이후 더짧아진TTL은같은객체의기한만단축한다. 새 budget 생성으로카운터초기화/기한연장0. timer만으로동기직렬화기한을대체하지않으며모든크기계산/성공반환전최소기한을재검사한다. 두새접점은읽기제한관리일뿐인증/권한proof가아니다.

## 4. 고정26 SQL 패턴과 반환형

아래 식별점의 실제 source SQL 문자열만 허용하며 실제 원 SELECT와 출력alias/정렬/원 LIMIT/SHARE·UPDATE 잠금 의미를 그대로 보존한다. 다른operation 승인candidate 등 미등록query는추측변환하지않고503. 클래스 내부의이수집경로에만사용하고범용SQL도구/공통리팩터로넓히지않는다. 별표는실제migration열로명시확장하며schema시험에서원열/alias누락을검사한다.

| ID | 기존 식별점/출력 | SQL에서 먼저문자열화할bigint | 원 reader용Date복원열 |
|---|---|---|---|
| Q01 | projectMember p.id,p.archived_at,m.participation | 없음 | archived_at |
| Q02 | Q01 FOR UPDATE OF p,m | 없음 | archived_at |
| Q03 | draftsSelect v.*+d.head_version,d.updated_at+원receiptColumns25 | version,head_version,expected_version,control_generation,server_sequence | created_at,updated_at |
| Q04 | project_source_declarations b.*+원command/receipt join FOR SHARE OF b | declaration_version | created_at |
| Q05 | source_declaration_versions s.*+operation/actor_id/command_client/expected_version/result_ref | version,draft_version,expected_version | created_at |
| Q06 | source_snapshots project/id/version=1 | source_root_version,generation | observed_at,finished_at,received_at |
| Q07 | SourceReadRecords.load(lock=false) g.*+created_*/source_* alias | source_root_version,connector_generation,registration_version,credential_generation,control_generation,created_expected_version,source_head_version | created_at,expires_at,revoked_at |
| Q08 | credential id/project/grant/connector/generation/scope/digest/time만(token_digest제외) | connector_generation | issued_at,expires_at,consumed_at |
| Q09 | SOURCE_READ_REPORT_STORED audit EXISTS ok | 없음 | 없음 |
| Q10 | evidence artifacts project/id FOR SHARE | bytes | created_at |
| Q11 | document_versions v.*+d.confirmed_version exact join | version,form_version,confirmed_version | created_at |
| Q12 | project_methodologies application_version DESC LIMIT1 | application_version,source_version | created_at |
| Q13 | document artifact exact id/project/hash/bytes/mediaType | bytes | created_at |
| Q14 | form definition_json exact ref | 없음 | 없음 |
| Q15 | documentReviews r.*+a.server_sequence | target_version,criteria_version,server_sequence | created_at |
| Q16 | document events/confirmation UNION | 없음 | created_at |
| Q17 | document import_id | 없음 | 없음 |
| Q18 | document proposal p.id | 없음 | 없음 |
| Q19 | approval request r.*+원command join | version | expires_at,created_at |
| Q20 | approval decision d.*+원command join | request_version,control_generation,expected_version | decided_at |
| Q21 | approval consumption ac.*+candidate/command/receipt join | policy_version,control_generation,expected_version | consumed_at |
| Q22 | currentPolicy id/head/rules/hash/reason/review_refs/time | head_version | created_at |
| Q23 | approval current control actor/client/generation/revoked_at | generation | revoked_at |
| Q24 | approval clock_timestamp at | 없음 | at |
| Q25 | 신규 RR baseline_drafts7열 project/id keyset | head_version | created_at,updated_at |
| Q26 | 신규 RR baseline_draft_versions9열 project/draft_id/version keyset | version | created_at |

Q07의 source_read_basis_current와 다른operation candidate는실제 readSnapshot 호출선에없으므로이번패턴에넣지않는다. 원schema의추가bigint/top-levelDate가위목록에누락된것을발견하면임의타입변환하지않고 Main에근거를보고한후정확목록을보완한다. 이표만으로 실제DB문법/동작 검증이라고하지않는다.

각 data SELECT는 명시projection→bounded envelope→원 rowtype 복원을 거친다. SQL에서 bigint를 ::text로 만든 뒤 JSON으로 옮긴다. JSON.parse Number 이후 String변환으로정밀도가보존됐다고하지않는다. JSON열의recordedAt/request/decision/서버시각등protocol문자열과hash는재귀변환하지않는다. top-level필요Date만원pg의ms표현으로복원하되 rawDB microsecond 표현은metadata지문으로별도보존한다. bool/UUID/정수·NULL/alias는원형유지,부재열을정상값으로합성0.

원row/검증DTO/최종직렬화누적을metadataBytes에합산한다. 한도를넘으면전체413이며부분행/잘린배열을원reader에성공으로주지않는다. 반환뒤DTO만측정하고SQL반환량제한이라고주장하지않는다. 인증sessionFORUPDATE·DBclock/xid와트랜잭션/timeout제어는이data변환대상이아닌별도원형경로다.

## 5. 원 catch 마스킹과 지문

수집기가만든q제한/취소/기한오류는정확로컬소유집합과sticky최초오류슬롯에보존한다. 원.#draft가503으로포장하거나.#currentCheck가UNAVAILABLE로반환해도원호출직후sticky재검사로성공0·원자체오류실패다. 회수불명sticky503은더우선한다. 실제원문/저장무결성503을messageprefix로자체오류라고분류하지않는다. 원함수catch를전역수정하지않는다.

지문대상은 storedheads/versions/ref/hash·선택명령/receipt/audit/승인저장관계와원readDraft의storedsnapshot/ref다. clock/observedAt·현재policy/control관측·계산expired/currentCheck는stored지문에서제외한다. 현재OWNER/세션은별도보안검사이며과거actor/만료된소비승인에현재허가를다시요구하지않는다.

recordedAt/result.serverReceivedAt은transaction_timestamp를JSDate로읽은ms문자열이다. rawversion/command/receipt DB시각은microsecond이며0015의date_trunc(milliseconds,transaction_timestamp())관계만근거로쓴다. 무조건strict동일/일괄반올림0. 원readDraft가row created_at를recordedAt와직접대조하지않는미검증도보존한다.

## 6. 출력·반례·완료 범위

출력은원VersionRef/headmetadata·익명provenance/선택증빙hash·고정currentCheck상태/원hash와한정issues/dependencies다. 자유문장/source snapshot/actor/client/경로/원문/인증값반출0. 원state의불명/UNAVAILABLE를PASS로바꾸지않는다. metadata/inputBytes/fileCount의정확usage와최종inventoryHash를계산하고직렬화후기한검사,부분결과0이다. atomicSnapshotVerified/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed false와전체미수집/기존23미연결을유지한다. 전체원장수집/현재권한복원/원형백업완료라고하지않는다.

실제모듈/메서드부재RED먼저,같은원save/read/protectedsource/docs를거치는정합합성fixture로검증한다. 최초/개정/옛버전/다른과거actor·빈목록·200+1,원hash/baseRef/head/명령receipt/audit/선택승인null·nonnull·불일치,원UNAVAILABLE/CHANGED/503,사전bodymetadata와실두read,bytes누적/unique fileCount/tuple충돌을확인한다. metadata q413이#receipt/#draft와#basis/#currentCheck에각가려지는반례·q409·회수503우선·unknownquery·Date/BigInt/JSONprotocol·rawmicro보존·동적clock지문제외·후반세션기한단축/usage카운터불변·최종직렬화기한을검사한다.

신규2+직접전달9/reader17 회귀·type/diff·독립C0/I0후Main집중확인이다. 실제FS/DB/OS권한·서비스·키·Agent·SQL실적용/문법검증·브라우저·전체회귀/build0. Primary는정확4hash/명령exit/REDGREEN·오류/미검증을제출후writer해제한다. Main이결과/현황/계획을기록하고같은branch정확allowlist만게시,main/PR/실환경0이다. OS절대기한/강제회수·약9PB극단한계는이전기록대로유지하고실행ready로승격하지않는다.