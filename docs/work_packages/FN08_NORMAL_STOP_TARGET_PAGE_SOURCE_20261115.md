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
시험7:
- tests/unit/FN08/normal-stop-target.test.ts (신규)
- tests/unit/FN08/normal-stop-command.test.ts (신규)
- tests/unit/FN08/normal-stop-sql.test.ts (신규)
- tests/unit/FN08/normal-stop-target-page-journey.test.ts (신규)
- tests/unit/FN08/normal-command-pages.test.ts
- tests/unit/FN08/normal-command-pages-journey.test.ts
- tests/unit/FN08/normal-start-material-consumer.test.ts
타입 호환 한정1:
- apps/connector/runtime/normal-start-polling.ts: STOP 미실행 거절을 유지하는 union 분기만. interrupt/내구 STOP/polling 실행은 이번 단위에서 구현하지 않는다.

총17경로. 공유 코드베이스 다른 변경은 보존하고 목록 밖 필요는 Main에 정확 이유를 제출한다. Git·Main 문서 쓰기0. 새 공개 delta·권한 생산·실환경 실행0.

## 구현 순서와 수용 기준
1. 닫힌 target codec의 exact keys/type·UUIDv5(원 START namespace)/canonical SHA256과 봉투 결박을 고정벡터·위조/추가필드 반례로 TDD한다. ref는 식별자이며 권위가 아님을 유지한다.
2. GET stop-target 닫힌 query·HUMAN 로그인/원5tuple·원 grant/정책/budget/sourceScopes·START graph/등록 검사. 현재 head 개정·만료·DENY/REQUIRE_APPROVAL·다른 OWNER·connector Bearer·본문/추가 query 거절, 승인 소비0. 현재 검증 공급자 부재/PREPARED만 존재는412. 최신 소유의 검증 자료 원천을 찾을 수 없으면 성공 경로 활성화 금지, 미완료를 구체적으로 제출한다.
3. 기존 requestExecutionStop payload·HUMAN 외피 유지. 승인 계약 normal snapshot/status/outbox·target 재검산·receipt/audit 원자성·동일 replay/다른hash conflict/COMMIT UNKNOWN을 source로 연결한다. 기존 synthetic STOP·원 SQL은 보존. 0098은 미적용 guard/역완결만, 일반 권한 추가0. 정확 SQL checksum 연결 파일이 필요하면 Main에 먼저 보고한다.
4. REQUEST_STOP page만 materials:null/stopTarget, receipt material2필드null. START/SEND 원키·형상·재조회·50건/2MiB·cursor/서명/등록/기한 보호 보존. consumer는 projection UUID/hash와 원 envelope/context를 검산하고 원 로컬 owner 검산 전 실행0. STOP 자료 GET0. 기본 START/SEND polling은 STOP을 실행하지 않고 거절한다.
5. 직접 영향·인접 시험, typecheck, diffcheck, 각 파일 지문과 정확 명령·실패이력·미완료를 제출한다. 실제 owner없는 양성 종단/실행 성공 주장은 금지한다. Main 독립 검수 후 source통합한다.

## 제외와 후속
실제 DB·권한 부여·키·사용자 파일 조사·설치·서비스·SDK/Agent/C# 실행0. CURRENT 생산·원 retained resume·세션 결박과 STOP 내구시도/private owner interrupt/관측 ACK는 후속 별도 단위이며 이번17경로에 섞지 않는다. 정상 소스 revert로 복구하며 실제 데이터 rollback은 없다.
