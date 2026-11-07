# FN16 기능분류 검토·채택·현재 조회 예산 전달 WI — 2026-10-29

상태: 사전검수 후보/코드GO전. 기준 codex/av3-stage-b 74a8368cc71099384fe9cfb7e06367fc9c688015. 기존 FN16 source-only 승인 안의 한정 전달 보완이다. Main 관리/검수/통합·기존 Primary 단독 구현·기존 Reviewer 읽기다.

## 1. 수정 이유·허용2코드

원 public 조회 이름은 decision/read/current다. readReview는 존재하지 않는다. decision은 실제 readDraft의 원문 보호 뒤 리뷰/채택을 읽고, read는 선택 ACCEPTED review의 추가 근거도 #reviewSources/#basis로 읽는다. 새 수집기에서 이를 metadata 미확인으로 생략하지 않기 위한 선택 budget 전달 선행이다.

- apps/server/modules/projects/project-baselines.ts: decision/read/current/#reviewSources의 optional backupBudget 전달·선택 검사·정확 자체오류 재throw만. 원 SHA256 EBE734B1550602E471923C11EED999CAF1003592783E59E5491DF51B9393083C.
- 신규 tests/unit/FN16/feature-baseline-decision-budget-forwarding.test.ts: 실제 원메서드와 저장/조회 검산을 거치는 합성 반례.

기존 draft history/고정26 query/helper2접점·읽기 알고리즘·0050 activation inventory·기존23조합·다른 source/SQL/정책/권한·새route/operation·보호8 변경0. 실제 FS/DB/키/서비스/Agent·등록/배포·Git/문서 수행자쓰기0이다. 새범용도구/공급자·권위proof를추가하지않는다.

## 2. 동일 예산 전달과 원 의미

선택 budget이 제공된 경로만 진입·await 뒤·해시/결과 계산·성공 반환 전에 기존 assertArtifactBackupReadBudget으로 검사한다. 제공되지 않은 기본 호출의 입력/응답·저장·원 hash/receipt·source 검산은 보존한다. null/잘못된 객체를 생략으로 보고 기본 경로로 우회하지 않는다.

전달선은 decision→readDraft+read, current→read, read→#currentCheck+#reviewSources, #reviewSources→#basis다. 실제 source/evidence와 documents.version/originalText의 모든 반복 읽기는 같은 객체로 누적한다. 기존 실제 검증을 중복 제거하거나더미 성공값으로 대체하지 않는다. #review/#referencedReview/#reviews의 저장 검산·Promise.all 및 latest201/server_sequence 의미는이번단위에서변경하지않는다.

원 read의 추가 review 근거 catch가 AuthFailure<500을CHANGED/UNAVAILABLE로 낮추더라도 helper의 정확 WeakSet predicate가인식한budget입력400/취소·busy409/기한·한도413/회수503은원객체로재throw한다. 기존 일반404/409/412의 원currentCheck의미와 원503/일반예외의 전체실패는보존한다. message/prefix/status만같은외부오류를자체budget오류로인정하지않는다.

## 3. 과거·현재·legacy 구분

원 review의 ACCEPTED/REWORK/BLOCKED/NOT_EXECUTED는 저장 판단이며 자동 인수/실행 허가가 아니다. 채택 snapshot의 contentConfirmed:true는 저장된 명시채택 사실로 유지하되 sourceAuthorization/coverage/execution/dispatch false를 승격하지 않는다. 현재 latest 리뷰·currentCheck·head는 과거 원형/허가 복원과 구분한다.

legacy read의 ref:null/legacyRef/snapshot:null/LEGACY_UNVERIFIED/UNAVAILABLE를 유지한다. legacy 추가계약null열을 최신draft/head로 채우거나 원 content_json 검증 완료로 바꾸지 않는다. current가 legacy head를 거절하는 원503도 유지한다. 과거actor/client를현재OWNER와같게강제하거나현재재인증/정책으로새작성처럼재판정하지않는다.

## 4. RED→GREEN·검수

실제 원save/review/adopt가 만든정합snapshot/hash·선택command/receipt/audit fixture로 신규전달누락RED를먼저확인한다. 실제ProjectBaselines decision/read/current·#reviewSources/#basis와실source/docs/ownedhandle알고리즘을거쳐같은budget이다른원문읽기까지도달하는지검사한다. 단순성공boolean/ref만반환하는대체검증0이다.

정상기본호출/선택호출·legacy빈원문·현재head/ref대조,추가선택review근거의bytes누적·한도/취소/기한/poison503,정확원오류객체재throw·외부동일message의원처리·원무결성503,잘못된옵션의DB조회전거절을확인한다. review추가근거가실제로실행되는MATCHED_METADATA와진입하지않는UNAVAILABLE/CHANGED를구분하여마스킹반례를피한다. 원문read/decoder뒤기한을UTF8/currentCheck성공으로낮추지않는다.

신규시험+직접기존feature-baseline-draft-history 행동/schema·budget전달/reader의해당지정4시험만회귀하며type/diff·원기본의미보존·독립C0/I0후Main집중검증이다. 실제PG/SQL문법/FS/OS권한·키·서비스·Agent·브라우저/전체회귀/build0이다. 실제원문포트와DB는메모리합성으로제한한다.

## 5. 제출·미완료

Primary는정확2hash·RED/GREEN명령exit·오류/미실행을보고후writer해제한다. Main이결과/현황/계획과diff를기록하고같은branch정확allowlist만게시,main/PR/실환경0이다.

이번에는review/adoption/head inventory와q FIFO/병렬pending관리·고정32패턴확장·공개호출등록·기존23을연결하지않는다. 이것들은다음수집단위다. 기존OS pending절대기한/강제회수·약9PB포화한계/전체계획미완료를유지한다.