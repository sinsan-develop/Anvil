# FN16 선택26 → 실제 원문 consumer 내부 연결 WI — 2026-10-29

상태: 문서 작성 허가만. 제품 GO 전 Main/독립 사전검수 대상이다. 기준 HEAD 514c601c6b5ba972c1682f366fac6e6fa1301175 / codex/av3-stage-b. 기존 승인 FN16의 내부 source·메모리 합성 상세화이며 공개 백업·공적 형식·현재 권한·복원 가능성을 채택하지 않는다. Main은 관리·검수·기록·통합, Primary는 별도 GO 후 단독 writer, Reviewer는 읽기 전용이다.

## 1. 정확 허용 경로와 불변 범위

제품 GO가 따로 발행될 때 허용할 최대4코드는 다음뿐이다.

1. apps/server/modules/backups/project-inventory-composition.ts — 시작 SHA256 2C2B1F5C5A6E5CA7DBF6CE7D648CF56E53AB6AEFD6DE989DABFFAB59A0E5E4EC. 동일 실제 실행본문의 내부 envelope 반환 접점만 추가한다.
2. apps/server/modules/backups/artifact-current-verification.ts — 시작 SHA256 1CD54C6F937D5CB432B879AC9B45FB89BAB5D3F6006F6BE0168525EA9FCBA3A4. 기존 전체조합 consumer의 명시 선택 경로와 그 경로의 제한/현재성/회계만 연결한다.
3. 신규 tests/unit/FN16/feature-baseline-artifact-consumer.test.ts.
4. 신규 tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts.

이 문서만 canonical/source root에 동일 작성한다. WORK_STATUS는 Main 소유이며 Primary 수정0이다. 기존 class/helper/reader/다른 collector/기존 시험·SQL/역할/GRANT·public routes/ProjectBackups/정책158E10BC/보호참조A/FN15 factory 변경0. 실제 DB·키·서비스·Agent·제품 원문 FS IO·Git 쓰기0. 신규 source wrapper만 만들어 미소비로 남기는 방법은 금지한다.

## 2. 기존 기본 경로와 실제 호출선

기존 composeProjectInventory(access,token,value,signal,baselineContext?)의 DTO/hash/기본24 및 선택26 동작은 유지한다. 기존 verifyCurrentArtifact·문서/대화/지식 3자료군 consumer와 context 없는 verifyProjectInventoryArtifacts의 null-CSRF·24조합·현재성·원문 검증 결과는 불변이다.

전체조합 consumer의 새 시그니처만 다음처럼 한정한다.

verifyProjectInventoryArtifacts(access,token,value,reader,signal,baselineContext?:{baselines:ProjectBaselines;csrf:string})

undefined는 원본문 기본 경로다. 선택 context는 실제 new AccessRepository와 new ProjectBaselines, 실제 메모리 owned-handle reader의 정상 fixture로 검증한다. plain provider/callback/proxy/as-cast로 실제 권위를 대체하지 않는다. context는 닫힌 own data descriptor 2개이며 null/추가키/accessor/잘못된 값은 DB 전400, getter 호출0이다. 값은 첫 await 전에 복사 고정한다. instanceof는 명목타입 검사이며 악성 동일 process/prototype 변조 방어를 증명한다고 주장하지 않는다.

선택 모드의 실제 소비선은 verifyProjectInventoryArtifacts → 새 Root 내부 envelope 진입 → 기존24 + 실제 readDraftHistoryInventory + 실제 readDecisionHistoryInventory → 기존 고유 artifact 검증이다. public route/ProjectBackups는 이 context를 주입하지 않는다. 공개 설치·반출·백업 job 활성화가 아니다.

## 3. Root 내부 envelope — DTO와 제한 데이터 분리

새 export는 서버 내부 직접 소비에만 쓰는 composeProjectInventoryForArtifactVerification(access,token,value,signal,baselineContext)로 한정한다. 기존 Root와 동일한 private 실행본문을 재사용하며 별도 collector나 성공 공급자를 만들지 않는다. 기존 composeProjectInventory는 원 DTO만 반환한다. envelope 진입은 선택 context를 필수로 검사하고 실제 Root 실행을 완료한 뒤 다음을 반환한다.

Readonly<{composition: 기존 Root DTO; readConstraints: Readonly<{projectId:string; expectedIdentity:Readonly<{actorId:string;clientId:string;credentialGeneration:number;sessionId:string}>; deadlineMonotonicMs:number}>}>

제한 데이터는 Root의 실제 authenticateInTransaction에서 관측한 identity4와 min(요청 시작 절대기한, 모든 실제 auth TTL, genuine budget 최소 단조기한)만 복사·freeze한다. Root 성공·마지막 직렬화 후 기한 검사까지 통과한 뒤에만 envelope를 생성한다. 제한 데이터/identity/CSRF/token을 composition·compositionHash·resultDigest·로그·오류·공개 DTO·관측 지문에 넣지 않는다. 이 데이터는 후속 사용을 좁히는 값이며 인증 proof·서명·caller가 발급하는 VERIFIED 상태가 아니다. 새 caller 입력으로 identity/deadline을 받지 않는다. 임의 함수 공급자·외부 inventory DTO·mutable out parameter로 이를 대체하지 않는다.

동일본문 factoring은 이 반환 분리에 필요한 최소만 허용한다. 원24/26 원projection·원 hash·false/미수집을 변경하지 않는다. 기존 module 외 새 공통 SQL/controller 도구·구조 개편0이다.

## 4. 전체 시작기한과 후속 실제 재인증

consumer는 요청 검증 직후 첫 await 전에 자기 monotonic 시작과 유한 전체 절대기한을 고정한다. Root에는 그 잔여시간만 전달한다. 선택 모드에서 Root를 먼저 완료하므로 원 consumer 최초 scope.boundary를 먼저 실행하지 않지만, 이는 인증 생략이 아니라 Root의 실제 CSRF 인증·OWNER·현재 동일 신원·유한 caller-owned RC로 대체하는 것이다. Root 이전에 무제한 access.authenticated를 호출하지 않는다.

Root 반환 뒤 후속 scope는 실제 access 인스턴스와 원 token/CSRF를 사용한다. readConstraints와 같은 identity4인지 실제 authenticateInTransaction 결과를 매번 비교하고 OWNER/프로젝트 활성·DB clock·세션 최소기한을 재검사한다. expectedIdentity 일치만으로 auth를 대신하지 않는다. Root에서 관측한 더 짧은 기한을 후속 실제 auth가 길다고 연장하지 않는다. 모든 remaining은 min(consumer 최초 절대기한, Root 내부 최소기한, 이후 실제 auth 최소기한)이다.

후속 선택 경로의 RC 인증은 consumer 내부의 한정 caller-owned bounded controller에서 수행한다. 실제 access.pool·authenticateInTransaction과 BEGIN RC/유한 statement·lock·idle timeout/readback을 사용한다. 기존 metered/guarded wrapper를 실제 repo라고 cast해 Root에 주지 않는다. 원 metadata envelope/회계는 같은 정확 자료쿼리에서 유지하되 인증 권위를 query callback으로 공급하지 않는다. 현재성 query callback은 내부 실제 bounded RC 안에서만 실행한다.

connect/BEGIN/auth lock/query/COMMIT/ROLLBACK/release는 자기 pending에 handler를 붙여 관측하며 늦은 연결은 정확히 한 번 폐기한다. timer 계산은 순수 산술로 유지하여 이미 시작된 query의 handler 부착 전에 throw하지 않는다. 취소/기한 뒤 실제 회수 불명·close 실패·poison은503 우선이다. 자기 작업 외 연결/handle을 닫지 않는다. 마지막 DTO 직렬화 후/반환 직전에도 전체·Root 최소기한을 검사한다. cooperative 한계이며 driver/OS pending의 강제 종료·절대 회수 보장0이다.

## 5. 직렬 phase 자원 회계

G는 고정 원요청 inputBytes, D는 실제 Root 기존24 고유 선언 bytes, B는 실제 class2의 반복 읽기 합계, V는 후속 기존 고유 artifact verifier가 실제 검증 완료한 bytes다. 실제 Root 결과의 검수된 resourceAccounting/usage alias와 compositionHash를 대조하고 아래를 안전정수/overflow 검사와 함께 결박한다.

- Root가 D+B≤G를 검산한다. baselineReadBytes=B, inputBudgetCharge=D+B, 기존 inputBytes=D다.
- 후속 exact ARTIFACT 참조 집합을 다시 구성하여 고유 선언 합계가 D와 같음을 확인한다. 공유 tuple 충돌은503이며 가짜 ref 추가0이다.
- 후속 V는 검증 성공한 고유 ref bytes의 합계이고 V≤D다. 다음 파일을 열기 전에 V+해당 bytes≤G-B를 검사한다. 마지막에 B+V≤G를 재검사한다.
- D는 후속 고유 읽기의 사전예약 상한이므로 D+B+V처럼 같은 예약을 중복 차감하지 않는다. 차단된 파일은 V에 성공 bytes로 올리지 않는다. Root class 내부의 동일 genuine counter는 그대로이고 class 사이 reset/재생성0이다. 이 후속 consumer까지 같은 genuine 객체를 공유했다고 주장하지 않는다.
- 기존 usage.inputBytes/fileCount/verifiedBytes 의미는 유지한다. 선택 모드에만 별도 phaseAccounting으로 D/B/V/실합계와 측정 의미를 명시하고 Root의 compositionHash·resourceAccounting을 함께 보존한다. 외부 측정값·caller boolean으로 검산하지 않는다. 이는 내부 선택 결과이며 공적 backup format 채택이 아니다.
- 파일은 Root의 기존24 고유수+양 class 고유수 합계인 보수상한을 검산·보존한다. 후속 원문 verifier는 기존24 고유 ref만1회씩 열므로 그 수를 Root 보수상한에 다시 더하지 않는다. class2 전체 중복 제거/전역 physical open1이라고 주장하지 않는다.
- metadata는 Root의 실제 보고 metadata + 이후 bounded 현재성/대화 조회 + 검증 DTO + 최종 consumer DTO다. Root의 metadataAccounting 선언을 보존하고 단계를0으로 reset하지 않는다. auth/token/CSRF 원문을 자료 지문에 넣지 않는다. 유한 잔여0은 양수 하위 입력을 발명하거나 조용히 생략해 성공시키지 않는다. 마지막 정확한도 성공은 유지한다.

## 6. IO와 원문 보호 의미

선택26의 class2는 원 보호 read를 재사용하며 검산 RC 안에서 반복 원문 IO를 수행한다. 이는 이미 채택된 class 계약이며 이번에 transaction 밖으로 옮기거나 기본 원조회 검사를 삭제하지 않는다.

그 뒤 고유 artifact verifier는 boundary가 COMMIT/release를 마친 다음 reader를 연다. 이 후속 physical open 동안 DB transaction0·같은 고유 artifact open1을 입증한다. class 반복 IO와 후속 open 수를 별도 계수하고 전체모드의 모든 IO가 transaction 밖/전체 open1이라는 보고0이다.

최초 UNKNOWN/SUSPECTED/격리 issue와 파생 issue를 원형과 구분하여 보존한다. 뒤 현재 상태가 NO_KNOWN으로 바뀌어도 최초 차단을 지우지 않으며 같은 artifact를 다른 자료가 공유해도 후속 IO0이다. 원 CONVERSATION_MESSAGE의 정확 저장 hash·sequence·conversation/body tuple 재결박과 최종 전체 현재성 검사를 유지한다. 원 ref/state/bytes/hash/inspection 불일치, 실제 auth/OWNER 상실, 원검산503, metadata/query 실패·기한·취소·회수 실패는 성공으로 바꾸지 않는다. class의 UNAVAILABLE·과거 contentConfirmed·legacy는 권한/현재 합격으로 승격하지 않는다. fullProjectCoverage/restorable/atomicSnapshotVerified/authorizationRestoration/executionAuthorized/dispatchPerformed=false·전체 미수집·blob 한계는 유지한다.

## 7. TDD·검수·동결

별도 제품 GO 뒤 실제 선택 소비 접점 부재 RED를 먼저 남긴다. 신규 행동 시험 prefix는 정확히 'feature artifact consumer ', 신규 schema 시험 prefix는 'featureArtifactConsumerSchema '로 고정한다. 실제 new repo/class와 actual save/review/confirm·원 source/docs·메모리 owned handle을 사용하는 기본 정상 fixture에서 기존24와 feature가 공유하는 commands/authorization_receipts/audit_events/artifacts를 같은 저장 상태로 보게 한다. unused 표만 빈 응답이며 임의 SQL 성공/전체[] fallback0이다. 보조 joined-row 호출선은 완전 보조표 통합 증거와 구분한다.

필수 반례는 실제26 생산 결과의 직접 소비·내부 제한 데이터 비반출/원 DTO/hash 유지, default24 불변, malformed context/accessor DB0, 실 CSRF·Root 이후 identity/OWNER 변경 자료조회0, Root 관측 짧은 TTL의 후속 pending/SQL/최종 직렬화 전파, late 회수/close503, D+B와 B+V 정확한도·다음 초과 IO0·metadata 최종한도·파일 보수상한, 최초 격리/UNKNOWN 공유 뒤 해제에도 후속 IO0, 원 body/hash/최종 상태 변경, class RC내 반복 IO와 후속 transaction0/open1의 구분이다. class 미확인/legacy/과거 채택을 현재 권위로 보고하지 않는다.

실행 예정의 정확 선택 명령은 아래다. 새 시험 제목이 prefix에 실제 매치함을 먼저 정적으로 확인하며 무매치 파일 smoke를 assertion PASS로 계산하지 않는다.

node --test --test-name-pattern="feature artifact consumer |featureArtifactConsumerSchema |feature composition actual context|feature composition default context|projectArtifacts 실제24|projectArtifacts 빈 실제조합|projectArtifactsSchema" tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts
npm run typecheck
git diff --check

기존 단일/3자료군 consumer 본문이 불변인지 diff로 확인하고, 실제 영향이 발견되면 해당 이름의 최소 회귀를 Main이 지정한다. 기존 전체201/48/58/67 및 class/helper 전수 반복0이다. 새 근본 원인 실패를 동일 무변경 명령 반복으로 숨기지 않는다. Main fresh 실행과 수행자 결과를 분리하고 독립 C0/I0 뒤에만 source 단위 합격이다.

Primary는 정확4경로 변경 여부·시작/최종 SHA·명령/exit·RED/GREEN·오류 원인/횟수·미실행과 writer 해제를 보고한다. Main이 WORK_STATUS/계획/결과·정확 Git 게시를 소유한다. rollback은 이 내부 선택 delta를 정상 source revert하는 것이며 기본24/실자료/계정/키/DB·서비스 변경0이다. 이 단위 완료는 source 내부 실제 소비 연결일 뿐 public caller/실제 FS·DB·전체 백업·복원·사용자인수가 아니다.
