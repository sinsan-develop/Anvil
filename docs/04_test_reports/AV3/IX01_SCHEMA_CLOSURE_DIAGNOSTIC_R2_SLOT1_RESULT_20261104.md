# IX01 R2 SQL 정의 설치 실제 결과

2026-11-04 · Main 어울 · FAILED / QA CLEANED / 실제 추가 실행 금지

신산님 call_4662cf4731a44e75a3cd68e87e1181f1의 ‘수정 후 새 QA 1회 승인’을 단1회 사용했다. 승인 패킷 SHA256 766F911791F9175E2BCC6D314D961D8E9494005AD70D5445B614526729F3D0C7, 실행9c3674fa33802cefe35960e61974edaa73864b61, SQL7e9ab984d2dad98fed208a2473853409dde927b9, order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef/105개다.

## 실제 판정
- 3bb863→소유49629→e07780/8815c1: exit1. 2026-11-03T15:53:21.040Z, 67번째 db/migrations/0035_work_plan_draft_approval.sql에서 DDL_REJECTED / SQLSTATE42601 / statementEndLine338. 뒤38개 미실행. 앞66개도 함수/RLS/API/UI 인수 통과를 뜻하지 않는다.
- statementEndLine은 psql 문장 끝 위치이며 정확한 원인 표현식 행으로 단정하지 않는다. diagnostic null, SQL 오류문장/DETAIL/CONTEXT 원문은 수집하지 않았다. 이전 R1의22P02와 다른 실패이며 원 R1 기록은 보존한다.
- planHash4dbef6ee555fd9ba3b94ce71949bb2e770934c53219d70b929c7fc158cc0fdf0. fullID46492ecd562a06c7653464081b7b7cfe13210ca7803931ac65dbf64316bc72c0. slot1, 소유instance9c3674fa33802cefe35960e61974edaa.
- installer의 NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS 유지. 설치 시 CREATEROLE true, 회수 뒤false, app 비특권/멤버십0/systemHash불변. revokeSqlHash8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5.
- driver status/cleanup CLEANED, ddlStatus FAILED. 성공·IX01 완료·RLS/화면/Agent 실행 완료로 승격하지 않는다.

## 독립 정리 확인
64a135 2026-11-03T15:53:53.096Z exit0: 정확fullID/name조회0, 신규source의owner1000/realpath/link/clean/exactSHA/driverHash와 사용cwd관측0을 확인한 뒤 등록checkout만 제거했다. b34e7d15:54:26Z 별도조회 exit0: source부재/fullID부재/등록name0. 기존DB·권한·키·서비스·Agent·P03R3변경0. 일회source/컨테이너실행자원잔여0이며 감사는 아래 경로에 의도 보존한다.

감사 원격root: /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r2. directory0700, docker-config빈폴더. 원장3은UID1000/0600/단일link/nonlink검산 후 아래 파일로 정확복사했다.

| 파일(이 문서의 IX01/ 하위) | bytes | SHA256 |
|---|---:|---|
| DDL_R2_SLOT1_OWNER_20261104.json |199|24e8b753ad2e4a58760733654706ea4a9ab98e7f126b70d1f34a9103b6930867|
| DDL_R2_SLOT1_INTENT_20261104.json |414|4754edbd4b5b34072fcf52ed4e1a9be8941cba7329ed2e2fc042958e45ceccb4|
| DDL_R2_SLOT1_RESULT_20261104.json |3355|fb7ed49587c004aa3a79807b4b0854d3fe34ddf59498b9ab74b2b3568ee39559|

## 준비 오류와 실행 경계
- clone소유handle85575 마지막출력은 소실/수거불가였다. 재clone0. 39f82a에서 exactHEAD/clean/owner/driver를 독립확인했다. 마지막shell행CR로index경로조회오류1; 실제wrapper의rawhash검사로보완했다.
- a6b822 원격Node wrapper는 문자열의개행구문오류1로해석단계에서종료했다. 본문평가/원장/driver/PG생성0. e27772에서원장/PG부재를확인했다.
- 자동심사는 보정호출을 ‘승인기한만료’로1회거부했다. clock15:52:00Z와실제WSL e27772 15:52:22Z는승인만료16:10:59Z이전임을읽기증거로제시했고,동일승인/코드/자원의최초driver호출이허용됐다. 기한연장/우회/추가slot0.
- 승인issued15:40:59Z/전체만료16:10:59Z, PGslot만료16:02:54.629Z. 실행·회수·정리를모두그이전에마쳤다. 이승인은소진됐고재실행하지않는다.

## 다음 조치
기존Primary에게0035문장과함수본문의읽기전용원인분석을전달했다. Main은근거/최소변경/소스검증을독립검토한다. 실제추가PG는새정확실행승인없이는수행하지않는다. 기존R1/R2실패·미실행항목을보존한다. 전체작업계획은미완료다.
