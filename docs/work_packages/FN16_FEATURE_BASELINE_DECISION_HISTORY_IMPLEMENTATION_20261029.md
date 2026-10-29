# FN16 기능분류 검토·채택·head 이력 내부 수집 WI — 2026-10-29

상태: 사전검수 후보/코드 GO 전. 계획 FN16 source-only 승인 범위, 기준 codex/av3-stage-b f97700a582e884b7cf8b6cf820c55d4f7c3896fc. Main 관리·검수·통합, 기존 Primary 단독 구현, 기존 Reviewer 읽기 검수. 실제 키·DB·서비스·Agent·파일 IO 변경/실행0, 합성만 수행한다.

## 1. 한정 업무와 허용 코드3

- apps/server/modules/projects/project-baselines.ts: 동일 실제 인스턴스의 내부 readDecisionHistoryInventory(access,token,csrf,value,signal) sibling 추가. 원 class hash376393618EE4744F55A92564AACD817588025359436AC052FDB3E599CE5DFE3B.
- 신규 tests/unit/FN16/feature-baseline-decision-history.test.ts.
- 신규 tests/unit/FN16/feature-baseline-decision-history-schema.test.ts.

기존 readDraftHistoryInventory의 로컬26 adapter는 외부 재사용 접점이 없다. 이를 재작성/일반화하거나 익명 DTO를 원 권위로 삼지 않는다. 새 sibling의 고정32 adapter/phase에서 실제 this.decision/read/current/readDraft·#referencedReview와 기존 보호 함수/예산 helper를 재사용한다. 새공급자/권위proof·일반SQL도구·새route/operation·미적용SQL·0050 activation·기존23 연결·보호8·다른파일 수정0. Main만 WI/결과/WORK_PLAN/WORK_STATUS·Git을 관리한다.

## 2. 수집3표·정확30열·과거 의미

- baseline_content_reviews11: project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id,created_at. bigint draft_version; Date created_at. reviewRef는 version1/H(review_json), 모든 저장 outcome을 보존한다.
- project_baselines15: id,project_id,version,source_snapshot_ref,content_json,content_hash,created_by,created_at,baseline_kind,draft_id,draft_version,command_id,client_id,source_snapshot_version,source_snapshot_hash. bigint version/draft_version/source_snapshot_version; Date created_at. source snapshot version 등 nullable은 null을 유지한다. legacy LEFT JOIN의 receipt bigint도 nullable이다.
- baseline_heads4: project_id,baseline_id,baseline_version,baseline_hash. bigint baseline_version.

리뷰는 review_id keyset, 채택은 version,id keyset으로 각200+후속 페이지를 유한 수집한다. 채택 버전은 프로젝트 전체 MAX+1이므로 legacy7 뒤 현대8을 허용한다. 연속1시작/개수=최대 가정0. head는0 또는1이고 실제 current 결과와 정확 ref를 대조한다. legacy head의 원503/불일치 거절을 유지한다.

legacy read의 ref:null/legacyRef/snapshot:null/LEGACY_UNVERIFIED/UNAVAILABLE를 보존한다. 원 content_json 무결성·현재 기준·복원 가능으로 승격하지 않는다. modern contentConfirmed:true는 과거 명시채택 저장 사실만 보존한다. review ACCEPTED도 자동 인수·실행허가가 아니며 현재 review/currentCheck·과거 snapshot·현재 head를 분리한다.

## 3. 실제 보호 경로·고정32·트랜잭션

입력은 기존 readDocumentInventoryInput의 정확 범위/유한 한도를 재사용한다. 인입 신호·실 AccessRepository·로그인/CSRF·현재 OWNER/비보관·세션/client 동일성·최소기한을 기존 caller-owned bounded RC에서 확인한다. 순서는 RC 보호원검산→RO REPEATABLE READ metadata→RC 동일 원검산/재인증이다. 실제 승인 row FOR SHARE는 RC에서만 수행한다. RO RR에 원 reader를 실행하거나 일반 access.authenticated callback의 잠금 뒤 기한 빈틈을 만들지 않는다.

고정32는 기존 실제 reader의 data24 + 추가 data5 + RR3이다(기존 draft RR2는 새 collector에 재수집하지 않음). 추가 data5는 reviewsSelect exact review ID, reviewsSelect draft/version server_sequence DESC LIMIT201, baselinesSelect exact ID/version, baselinesSelect draft/version, baseline_heads project 조회다. RR3은 위3표 명시 열 keyset이다. 각 SQL/별표 확장열/alias/중복열·nullable bigint·날짜를 실제 schema와 원 producer/reader로 대조한다. bigint는 SQL에서 JSON 이전 text로, protocol JSON 숫자는 원형으로, 날짜는 기존 reader가 기대하는 Date로 복원한다. raw microseconds는 변환 전 관측지문으로 남길 뿐 복원가능 시각 원본이라고 주장하지 않는다. 현재 clock/auth/session/credential은 저장동일성 지문·반출 metadata에서 제외한다.

각 참조 draft에는 실제 decision/readDraft의 source/doc/bytes 보호가 선행한다. 저장된 모든 review는 동일 인스턴스 #referencedReview의 원 파싱/hash/draft/actor·command/receipt/audit/선택승인으로 검산하고 RR ref/snapshot과 대조한다. 최근201 공개리뷰만 확인하고 더 오래된 저장 review를 검수됐다고 하지 않는다. 모든 modern adoption은 실제 read, head는 실제 current와 대조한다. 원 메서드 내부 latest201·정렬·기준 관계는 변경하지 않는다. 원검산을 boolean/ref 가짜공급자로 대체하지 않는다.

## 4. 병렬 원검산·한도·실패

원 #reviews의 Promise.all은 유지한다. 같은 client의 새 q는 FIFO로 직렬화하고, 최초 실패 이후 큐의 새 실제 DB 호출을 막는다. 원 Promise.all이 먼저 reject하더라도 owned queued/in-flight 결과를 관측/회수하기 전에 COMMIT/release/성공을 만들지 않는다. 알려진 실패 sticky를 원 catch 포장/낮춤 뒤에도 보존한다. 미종료/회수 불명은503 우선이며 늦은 연결/결과는 정확 자기 client만 폐기·관측한다. OS/driver의 절대 강제회수 보장으로 표현하지 않는다.

metadata는 SQL 반환 전 각 페이지뿐 아니라 누적 SUM+첫 초과 행으로 한도를 감시하고 parser/반환/최종 DTO 직렬화 후까지 확인한다. statement/lock/idle·최소세션기한을 유한 제한한다. byte 사전계수는 draft 기본 evidence/설계body와 채택이 선택한 ACCEPTED review 추가근거의 정확 tuple을 합치되 상충 tuple/과대는 실제 IO 전에 전체 거절한다. 파일 수는 unique, 실제 반복 원문 bytes는 동일 budget 누적이며 최종 readArtifactBackupReadUsage를 사용한다. 뒤 세션 확인에서 기한은 tighten만 하고 counter를 초기화하지 않는다.

미채택/선택되지 않은 review 근거는 원 decision이 현재 bytes를 검증하지 않는다. 이를 byte PASS로 만들지 않는다. 반대로 선택된 review의 actual read 추가근거를 생략하지 않는다. UNAVAILABLE/CHANGED를 원 의미로 보존하되 직접 helper budget400/409/413/503은 성공으로 낮추지 않는다. 새 관측 순서·clock/currentCheck가 아닌 저장 PK/ref별 정규화 지문으로 전후 변경을 검사한다.

## 5. 산출·false·검증

출력은 인증된 해당 프로젝트의 review ref/저장 outcome, adoption ref/과거 채택 상태, head ref와 현재 관측·원 metadata/provenance 지문 등 필요한 opaque metadata만 보존한다. 원 이유/body/source 경로·actor/client/session/credential 원문을 반출하지 않는다. 전체 원형 백업이라고 하지 않는다. scope FEATURE_BASELINE_DECISION_HISTORY_ONLY, atomicSnapshotVerified/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false와 미수집 범위를 유지한다. 과거 채택의 contentConfirmed만 정확 저장사실로 구분한다.

RED→GREEN은 메서드/고정32 부재부터 시작하고 실제 save→review→confirm의 원 hash/command/receipt·nonnull 선택승인/source/evidence/문서 검산을 거친다. 정상/빈3표·모든review outcome·201+keyset·옛 actor/소비승인·legacy7+modern8 및 gap·현재head/ref·중복/변조/한도·raw microseconds/nullable bigint·기한/취소·FIFO 실제 동시 query0/최초 실패 뒤 새실행0/queued pending 관측/회수불명503·metadata RC/RR 변경과 원정렬·unique 사전계수 및 실제 반복bytes를 분리 검증한다. 미검수 private DTO나 저장 ref만 맞추는 성공 fixture0이다.

새2시험+직접 decision-budget 전달11/FN01 기본9를 우선 회귀한다. 기존 draft 수집기/helper 변경0이면 이미 확인된58건 전체를 매번 재실행하지 않는다. type/diff 및 독립 C0/I0 뒤 Main 집중 검증·정확hash/명령/오류/미검증을 기록한다. fixture/정적 SQL 검사는 실제 PG 구문/DB·FS·키/서비스·Agent/브라우저/백업복원/사용자 인수가 아니다. 코드 완료 뒤에도 전체 FN16/WORK_PLAN 미완료다.