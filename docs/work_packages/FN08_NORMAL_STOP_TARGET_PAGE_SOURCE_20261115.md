# FN08 normal STOP 대상·저장·페이지 source 작업지시

기준 main38388a92f186e1cd1359714e79d7f77a988975ce, branch codex/av3-fn08-normal-stop-target. 신산님 직접 채택 계약 FN08_NORMAL_STOP_TARGET_PAGE_CANDIDATE_20261115.md SHA2562E6445077CDD2A02C00367EAEF08E40AE33E4DB46077EC4BC18785D1156CAC0F를 구현한다. 후보 원 hash는 보존하고 이 문서로 채택을 결박한다. 기존 developer_primary만 제품 writer, Main 문서·검수·통합이다.

## 현재 근거와 필수 제한
현재 SyntheticPgOwnershipCurrentResolver는 SYNTHETIC_ONLY/BASIS_ONLY/currentAuthorityVerified:false다. native-preparation-ownership-return은 BOOTSTRAP_PREPARED만 수용하며 native anchor에는 논리 session/role ref가 없다. ACTIVE head만으로 CURRENT·RUNNING 소유를 증명할 수 없다. 이들은 normal 현재 권위가 아니다. 이번 구현은 승인된 소비 경계이며 없는 CURRENT 생산·수용·resume·세션 결박 권위를 새로 만들지 않는다. 현재 reader/원 계보가 없으면 GET 및 STOP 저장은 412로 거절한다. 임의 current callback이나 test fixture를 제품 normal 권위로 등록하지 않는다. 역사 저장 reader의 존재하는 exact 관계만 검산하며 부족한 필드는 미확인으로 남긴다. RAM 시험의 긍정 codec/저장 형상 증거를 실제 normal STOP 성공으로 표시하지 않는다.

## 허용 경로
제품9:
- contracts/runtime/normal-stop-target-v1.ts (신규)
- apps/server/modules/executions/normal-stop-target.ts (신규)
- apps/server/modules/executions/normal-stop-command.ts (신규)
- apps/server/app.ts
- apps/server/modules/projects/routes.ts
- apps/server/modules/executions/normal-command-pages.ts
- apps/connector/runtime/normal-start-material-consumer.ts
- apps/connector/runtime/normal-protected-get-client.ts
- db/migrations/0098_normal_stop_target_page.sql.pending (신규)
시험13:
- tests/unit/FN08/normal-stop-target.test.ts (신규)
- tests/unit/FN08/normal-stop-command.test.ts (신규)
- tests/unit/FN08/normal-stop-sql.test.ts (신규)
- tests/unit/FN08/normal-stop-target-page-journey.test.ts (신규)
- tests/unit/FN08/normal-command-pages.test.ts
- tests/unit/FN08/normal-command-pages-journey.test.ts
- tests/unit/FN08/normal-start-material-consumer.test.ts
- tests/unit/FN09/execution-start-origin-fixture.ts: 선택형 normalStopPolicy=false 기본 보존, 신규 STOP 시험의 원 START 생성 전 정책 구성만. 기존 원행 재해시/검사 우회 금지.
- tests/unit/FN08/normal-instruction-dispatch-fixture.ts: 기존 SEND item의 operation/nonnull 명시 assertion narrowing만.
- tests/unit/FN08/normal-start-materials-journey.test.ts: 기존 START item의 operation/nonnull 명시 assertion narrowing만.
- tests/unit/FN08/normal-instruction-durable-journey.test.ts: 원 SEND operation/nonnull assertion narrowing만.
- tests/unit/FN08/normal-instruction-intake.test.ts: 원 SEND operation/nonnull assertion narrowing만.
- tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts: 원 SEND operation/nonnull assertion narrowing만.
타입 호환 한정1:
- apps/connector/runtime/normal-start-polling.ts: STOP 미실행 거절을 유지하는 union 분기만. interrupt/내구 STOP/polling 실행은 이번 단위에서 구현하지 않는다.

총23경로(r4). 공유 코드베이스 다른 변경은 보존하고 목록 밖 필요는 Main에 정확 이유를 제출한다. Git·Main 문서 쓰기0. 새 공개 delta·권한 생산·실환경 실행0.

## 구현 순서와 수용 기준
1. 닫힌 target codec의 exact keys/type·UUIDv5(원 START namespace)/canonical SHA256과 봉투 결박을 고정벡터·위조/추가필드 반례로 TDD한다. ref는 식별자이며 권위가 아님을 유지한다.
2. GET stop-target 닫힌 query·HUMAN 로그인/원5tuple·원 grant/정책/budget/sourceScopes·START graph/등록 검사. 현재 head 개정·만료·DENY/REQUIRE_APPROVAL·다른 OWNER·connector Bearer·본문/추가 query 거절, 승인 소비0. 현재 검증 공급자 부재/PREPARED만 존재는412. 최신 소유의 검증 자료 원천을 찾을 수 없으면 성공 경로 활성화 금지, 미완료를 구체적으로 제출한다.
3. 기존 requestExecutionStop payload·HUMAN 외피 유지. 승인 계약 normal snapshot/status/outbox·target 재검산·receipt/audit 원자성·동일 replay/다른hash conflict/COMMIT UNKNOWN을 source로 연결한다. 기존 synthetic STOP·원 SQL은 보존. 0098은 미적용 guard/역완결만, 일반 권한 추가0. 정확 SQL checksum 연결 파일이 필요하면 Main에 먼저 보고한다.
4. REQUEST_STOP page만 materials:null/stopTarget, receipt material2필드null. START/SEND 원키·형상·재조회·50건/2MiB·cursor/서명/등록/기한 보호 보존. consumer는 projection UUID/hash와 원 envelope/context를 검산하고 원 로컬 owner 검산 전 실행0. STOP 자료 GET0. 기본 START/SEND polling은 STOP을 실행하지 않고 거절한다.
5. 직접 영향·인접 시험, typecheck, diffcheck, 각 파일 지문과 정확 명령·실패이력·미완료를 제출한다. 실제 owner없는 양성 종단/실행 성공 주장은 금지한다. Main 독립 검수 후 source통합한다.

## 제외와 후속
실제 DB·권한 부여·키·사용자 파일 조사·설치·서비스·SDK/Agent/C# 실행0. CURRENT 생산·원 retained resume·세션 결박과 STOP 내구시도/private owner interrupt/관측 ACK는 후속 별도 단위이며 이번17경로에 섞지 않는다. 정상 소스 revert로 복구하며 실제 데이터 rollback은 없다.

## r2 내부 시험 범위 보완
기존 fixture 원 정책은 STOP을 허용하지 않아 GET이 정당한403에서 거절된다. 원 승인 계약을 시험하기 위해 선택형 RAM 정책 생성1경로만 추가한다. 실제 권한/DB 변경은 없으며 기본 fixture·기존 시험 의미는 보존한다. r1 SHA D9252FE93A14B6412818694AA400CD630C4DEB5E5668777569BD9DAF6D7E11D0와 채택 계약 hash는 이력이다.

## r3 union 직접 영향 시험 보완
STOP 전용 null union 추가로 기존 fixture·START 자료 여정의 선택 item 타입을 명시 검산한다. 두 시험 경로만 추가하며 cast로 null을 숨기거나 기존 기대/거절을 완화하지 않는다. r2 SHA3A8A9996FCF9A3C6CE930F08F292C01A3CEFD56C80F9D576C61342405E71EBDE 보존.

## r4 추가 직접 타입 영향
중앙 fixture 외 직접 페이지 재조회 시험3개에 원 START/SEND operation·nonnull 명시 assertion만 보완한다. 제품 계약·정상/거절 기대는 변경하지 않는다. r3 SHA0F9114FA07E32775553052BAC941F369D5C3431DDAAC9341084FAA76E6EEFD51 보존.

## r5 SQL·Node 검산 책임 한정
기존 PG에는 SHA256 내장 사용만 확인됐으며 UUIDv5용 SHA1 extension 권위는 없다. 새 extension/public.digest 또는 순수 PL/pgSQL 암호 알고리즘을 추가하지 않는다. UUIDv5는 기존 Node crypto로 원 START envelope.commandId에 결박해 생산·최종 조회 검산한다. SQL은 기존 SHA256와 원 START/receipt/audit/outbox 관계의 저장 graph 검사만 수행하고 정상 신규쓰기 최종 false를 보존한다. SQL이 UUIDv5까지 독립 검산했다고 주장하지 않으며 Node 최종 검산 없이 STOP page/target을 반환하지 않는다. 공개 계약·권한 변화0, r4 SHA54E9F07F241A108847F498E72026FB91B105E6C6B7A773E597D7DCB2D279ED3B 이력보존.
