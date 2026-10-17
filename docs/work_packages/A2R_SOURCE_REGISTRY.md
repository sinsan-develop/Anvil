# A-2R 소스 위치 등록·버전·철회 구현 계획
> **Agent 작업자:** Main 단일 writer가 executing-plans·TDD로 이어간다. 추가 세션/자동화·병렬 writer는 만들지 않는다.
**목표:** UI11에서 사용자 선언 소스 위치를 등록·개정·철회하고 정확 과거 버전을 조회한다.
**구조/기술:** 기존 React/TypeScript·Node/Fastify·PG15의 로그인/제어/정책/명령·감사 경로를 소비한다. 새 source_roots/source_root_versions만 저장하고 실행기·실제 파일 접근에는 연결하지 않는다.
**기준:** WORK_PLAN FN01/FN08·UI11, 설계 §9.1~2/11.12, WORK_STATUS A-2R 제안·PMO11:57:30Z 정확 권장안 결정. 시작2d2a11c5a6ddb950931b738785c1c4415eec4839 clean.
## 공통 경계
- USER_DECLARED/UNVERIFIED와 executionAuthorized=false를 고정. 경로는 보호된 선언 문자열이며 파일 접근/정규화·관측0.
- 현재 OWNER·client/제어세대·재인증·AUTO 명시정책·CAS·명령hash·감사. DENY 우선, REQUIRE_APPROVAL은 기존 소비가 미연결이라412 유지.
- GET은 현재 프로젝트 멤버십, OWNER 원문/VIEWER 표시명·버전·미확인/철회 상태만. 다른 project404.
- snapshot은 {declaration,status,authority,readiness,reason}, declaration은 {hostLabel,displayName,pathHint,reason,connectorId:null|UUID}. 정확 기존 ref가 개정/철회의 baseRef다.
- 과거 버전 UPDATE/DELETE 금지·root DELETE 금지, 철회는 새 REVOKED 버전. 철회 후 개정은 거절하며 새 등록은 별도 명시 연산이다.
- 기존44 SQL·데이터·등록credential/정책 불변. 새0008_source_root_registry.sql 1건·schema-only runner만 정식DB 적용 후보.
## 검수 초점
1. 과거 hash/다른project base·동일명령 다른본문·옛head: 409/404와 버전 불변.
2. OWNER/VIEWER·만료/옛client·무정책/DENY/REQUIRE_APPROVAL: 원문 누출/자동권한0.
3. 중간실패: 각 실제 transaction rollback. 실제 commit 검증을 외부 rollback으로 숨기지 않음.
4. 철회/과거이력·secret표식·선택connector 교차/미등록: 거절과 이력 보존.
5. 후보 UI의 late/이동·dirty/pending·동일명령 재확인, 명시 개정/철회와 가짜실행완료 금지.
## Task 1 — 서버 계약·불변 DB
파일: connections/source-root-input.ts·project-source-roots.ts 신규, projects/routes.ts·access/project-command.ts·scripts/migrate-development.ts 최소연결, migration0008 신규. runner의 고정ID 목록/적용을 별도 source-root-migration.ts로 두어 schema-only 분기를 unit 검증한다.
입출력: readSourceRootInput(operation,payload), sourceRootSnapshot(input,oldDeclaration?), ProjectSourceRoots.command/read/list. payload 등록/개정={declaration,baseRef,reason}, 철회={baseRef,reason}. 등록baseRef=null, 개정/철회 정확 ref와 envelope target/expected 일치. 기존 authorizeMaterial/persistProjectReceipt 재사용.
- [ ] unit 입력/범위·schema-only 실행순서·checksum 충돌 RED 확인.
- [ ] 입력·3연산/조회·guards·명시 runner 구현→직접/인접unit·타입 GREEN.
- [ ] 실제DB 시험은 Task3 Git exact의 격리PG에서 정상/거절/rollback·guards로 검증. 이 단계는 SQL 파일만으로 DB PASS가 아니다.
## Task 2 — UI11 원본 등록·개정·철회/이력
파일: connections/source-roots-api.ts·SourceRootsPanel.tsx 신규, ConnectionsPage.tsx 최소연결·직접unit/browser.
- [ ] 후보 browser의 버튼부재 RED→현재 OWNER 제어/정책 검사·현재ref로 명시 개정/철회/과거 버전 조회.
- [ ] 입력·버전/hash·거절/동일명령·미확인·VIEWER 원문0·늦은응답/이동을 직접/인접·type/build로 확인.
- [ ] 서버/화면을 한정 독립 검수, C/I는 RED→GREEN 보정, Minor/미검증은 사실 기록.
## Task 3 — exact Git 격리PG 검증·schema-only 적용
- [ ] private 기존branch의 안전checkpoint를 WSL Git exact로 가져온 뒤 새 container anvil-v3-a2r-registry-qa-pg / network anvil-v3-a2r-registry-qa-net / DB anvil_v3_a2r_registry_qa / loopback5547를 사전등록·부재/소유·정확 PG15 image/label/mount/수명으로 고정한다. Windows 임시root D:\tmp\anvil-v3-stage-b\a2r-registry-01만 사용하며 추가 WSL 임시경로는 만들기 전에 별도 literal 등록한다.
- [ ] 새 QA-only 비밀은 메모리/등록 보호경로만·원문 출력0. 기존auth/DB비밀·계정/CA 재사용·변경0. 실제 HTTP는 전용 listener/TLS를 사전등록하며 불가능하면 inject/API·격리PG만으로 표시한다.
- [ ] 같은44+새1 SQL을 실제COMMIT하고 사용자/정책·정상 등록/개정/철회/과거조회·타project/VIEWER/만료/옛세대/DENY·멱등/CAS·중간실패를 검증한다. guards 비활성/관리자행DELETE0.
- [ ] QA 연결/서버 종료→생성 exact container/network/data/temp만 폐기→별도 잔여0.
- [ ] 정식DB는 직전 기존구조/행수/서버fingerprint·44checksum·보호runtime baseline, 검수한 exact 새SQL/hash만 schema-only(seed0·실제QA행0) 적용, 새2표0행/기존불변 대조. 플랫폼거절이면 반복/우회0·PMO에 정확 사유 보고.
- [ ] 신규4계약 문서/현황·exact SHA/오류·미검증·복구 기록. 서비스23836/3830/Agent/OS파일/Oracle/main 변경0. 실패rollback·성공후문제는 새자료보존/기능닫기·forward 보정이며 DROP/reset0.
