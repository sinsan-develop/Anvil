# FN16 정책·승인 DB 시간 경계 보완 작업지시서 — 2026-10-29

기준 codex/av3-stage-b 542f6d49942b0ce27951cd416524e5697a7ed69d. Main80250e/7a647a·fb624f/1bae6e/91a749 및Primaryb783b4/ae4e55·독립실source대조로두stamp만실PG JSON offset/6fraction을isoV1(.sssZ)로거절하는정적결함을확인했다. 실제PG 실행실패를주장하지않는다. 전체수집기재작업/공통화가아닌두DB변환경계의한정수정이다. Main관리검수통합/Primary단독writer/독립읽기. preflight전GO아님.

## 허용4경로·시작 지문
- apps/server/modules/backups/permission-policy-inventory.ts:497630CF99BCD0A0A158088E8955689A5134F8A7F4089FC03FE885C6A0C5B046
- apps/server/modules/backups/approval-history-inventory.ts:DFC5E55516894F588FFDCF1009C7A20CBBB6F19860D9E895E51228AF4FDD2E86
- tests/unit/FN16/permission-policy-inventory.test.ts
- tests/unit/FN16/approval-history-inventory.test.ts
다른source/21조합/helper/schema시험·SQL/의존성/Git개발자쓰기0·실제키DB서비스/계정권한/파일IO0. 보호8/사용자자료보존. 158E10후보미채택/API/현재권한/원형복원계약불변.

## 정확 보완
1. 두source의비공개DB열stamp만검수된project-control-ledger-inventory.ts(1DAD7522)와같은엄격PG ISO정규화로교체한다. 새공통모듈/타파일import/구조개편0. Date/string입력·UTC변환결과연도1..9999/유효Gregorian달력·Z또는±HH:MM(≤15:59)·fraction0~6검사,UTC결과최소3~최대6유효fraction보존. 기존.sssZ는동일출력,마이크로초절삭/잘못된날짜보정0. infinity/BCE/확장연도/무timezone/7fraction등미지원은고정503. 신규ledger소스/그기능은변경하지않는다.
2. policy의result.serverReceivedAt는기존isoV1(.sssZ)직접검사로분리하고rule.expiresAt의기존isoV1을유지한다. policy/버전created_at·commandreceived/completed·receipt/audit시각DB열만정규화범위를넓힌다. 원rules/reason/reviewRefs hash/명시원shape/PII투영·nullable·과거만료/주체/시각역전·허가증빙을바꾸지않는다.
3. approval의request_json.createdAt/decision_json.decidedAt/result.serverReceivedAt는isoV1을명시선검사한다. details.expiresAt의기존isoV1유지. 최초요청/결정원문을수정하지않고DB열과canonical정확시각일치·내용hash를그대로검사한다. producer가원snapshot.sssZ를DBcreated_at/decided_at에명시INSERT하므로1microsecond차이는계속503이다. expiry도원details와DB열의정확canonical일치유지. consumption/receipt/audit등독립DB시각의미세정밀도는보존하되독립사건단조·하한을추가하지않는다.
4. 원문프로토콜의잘못된offset/6fraction을DB열변환허용과혼동해통과시키지않는다. 결과·projection에동등DB형식이정규화되며원contentHash/원request/decision JSON은불변이다. 반례의원문을재봉인하더라도프로토콜위반은503,검사기준완화0.

## 필수 TDD·검수
먼저기존두행동시험에PG DB형식정상반례를추가해RED를보존한뒤같은담당이수정한다. 두source모두offset동등값/동일fraction표현PASS·6자리정밀도보존/서로다른microsecond해시분리·원contentHash불변,잘못된달력/offset/무tz/7fraction/Date와UTC변환양의연도경계거절을확인한다. approval의원문연결DB열은동등offset PASS/1micro차이503,원문과직접연결없는consumption 등은6자리정상보존. 두sourceprotocol시각의offset/6자리재봉인음성도반드시확인한다.
신규원인에직접관련된기존behavior/schema(정책11·승인15)와고정21조합·원문연결직접영향41개를함께검사한다. 정확대상은permission-policy-inventory.test.ts/schema,approval-history-inventory.test.ts/schema,project-inventory-composition.test.ts/schema,project-inventory-artifact-verification.test.ts/schema의8파일뿐이다. 다른완료collector/브라우저·부하전수반복0. typecheck/diff·4지문·Mainfresh같은집중범위/독립C/I0뒤Main만허용4+WI/결과/WORK_STATUS/WORK_PLAN 정확8경로checkpoint한다.
실제PG/RLS/운영·DB키서비스·전체archive/원형복원/UI인수 NOT_RUN·전체WORK_PLAN미완료. 실패를환경문제로숨기거나old합성PASS를실PGPASS로바꾸지않는다. rollback은두stamp/프로토콜검사보완과해당시험의검토된revert이며자료/승인/키삭제0.

## 공식자료·보완 분류
PostgreSQL15 datetime 정밀도와JSON의ISO시간인코딩은 https://www.postgresql.org/docs/15/datatype-datetime.html / https://raw.githubusercontent.com/postgres/postgres/REL_15_STABLE/src/backend/utils/adt/json.c 의JsonEncodeDateTime·USE_XSD_DATES로대조했다. 이WI는기존FN16내부수집의DB출력호환버그교정이며새기능/공개API/권한범위확대0이다. 실제실행증거와지원4자리양의연도유한표현의한계를별도로유지한다.
