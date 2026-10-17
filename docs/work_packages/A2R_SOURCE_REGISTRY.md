# A-2R 소스 위치 등록·버전·철회 구현 계획
> **Agent 작업자:** Main 단일 writer가 executing-plans·TDD로 이어간다. 추가 세션/자동화·병렬 writer는 만들지 않는다.
**목표:** UI11에서 사용자 선언 소스 위치를 등록·개정·철회하고 정확 과거 버전을 조회한다.
**구조/기술:** 기존 React/TypeScript·Node/Fastify·PG15의 로그인/제어/정책/명령·감사 경로를 소비한다. 새 source_roots/source_root_versions만 저장하고 실행기·실제 파일 접근에는 연결하지 않는다.
**기준:** WORK_PLAN FN01/FN08·UI11, 설계 §9.1~2/11.12, WORK_STATUS A-2R 제안·PMO11:57:30Z 정확 권장안 결정. 시작2d2a11c5a6ddb950931b738785c1c4415eec4839 clean.

## 2026-10-17 한정 실행 결과

- Task1: 입력/route/schema-only·Web 직접 및 인접 unit23PASS/typecheck0. 실제 새 PG15의 정상·권한·버전/멱등·rollback/불변가드 11범주를 b5c3c74d에서 확인했다. snapshot 추가키 허용은 실제 RED→최소SQL보완→같은음성 GREEN이며 비문자열reason도 거절했다.
- Task2: 후보 API합성 browser는 원 4PASS+기대코드 보정 뒤 VIEWER1PASS, build117modules다. 원 독립C0/I1/M1 뒤 Main 보완을 구분한다. 실제 서비스 게시/실제 화면→정식DB는 미검증이며 전체 UI11/FN08 완료가 아니다.
- Task3: 같은 exact SQL d9d27d2c92e31e6c5e50bf18762786d2cad2b47a28905bc8f0f15fa2cec72403을 정식 개발DB에 schema-only 적용했다. 기존44checksum/75표 구조·권한·행수/내용fingerprint 보존·현재45migration/신규2표0행·seed0/계정·서비스변경0. 별도 READ ONLY와 보호8hash·23836/3830 불변을 확인했다. WSL QA container/network/tmpfs/5547 및 Windows 임시9파일/7dir 정리·독립잔여0. 최초 tmpfs 필드오류/정리 실패·새SQL CASE 구문 오류와 원 snapshot 음성 실패는 WORK_STATUS에 보존했다.
- 다음 경계: 소스 선언 등록은 실제파일 접근/허가·관측/시작 기준선 확정과 다르다. Main이 FN01/FN08의 다음 A-3 계약을 대조하고 별도 실행승인이 필요한 지점만 PMO에 결정·지원 요청한다. PMO 다음업무 배정 대기는 없다.
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
