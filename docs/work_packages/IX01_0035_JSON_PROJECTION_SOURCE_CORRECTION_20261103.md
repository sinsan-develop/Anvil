# IX01 0035 JSON 추출·차집합 결합 source 최소 보정
2026-11-03 · Main 어울

판정: SOURCE_ONLY / ACTUAL_REEXECUTION_NOT_AUTHORIZED. 기존 작업계획 FN04/FN11·IX01의 기능 연결을 막는 구현 오류 보완이다. 새 기능·공개 API·승인/권한 계약을 추가하지 않는다.

## 근거·소유
- 기준 source c84bdad14b1888281be2ee116031d573f9016193, 현재 문서 checkpoint54971005ff298ffcba6c22475edfc70225187135. Main 소유 실제 QA 결과/기록과 원장 증거는 pending docs이며 건드리지 않는다.
- r4 slot1 실제 정의 설치가0035에서22P02로거절됐고권한회수/정리완료·74adbd별도잔여0이다. 실제실행승인은소진됐으며 다른slot/새PG/동일명령 재실행0이다.
- source0035 SHA F6B3F1ACEA0A590DBEC86994EDE796E9661BCF058715B8DBDC6E60AF21C8F1CA, d2 고정본/Git/실패원장으로 보존한다. 주석/WI/현황은미적용후보·PG미검증이고기존실제builder도0035제외다. 모든환경미적용을보장하지않는다. 실제적용성공근거가발견되면원파일수정중단/반환한다.
- 같은 기존 Primary만 db/migrations/0035_work_plan_draft_approval.sql **정확1경로 writer**이다. Main은 같은 SQL 쓰기0, 제품/시험/다른SQL/index/driver/설정/문서/보호3 쓰기0이다. 타인변경을되돌리지않는다.

## 원인·변경 전후
- 0035:155의 JSON 추출 결과에서 -ARRAY로 metadata를 제거하려는 표현을 명시 괄호로 묶는다. PG15 공식우선순위는 이항 -가 기타연산자보다앞선다. 출처 https://www.postgresql.org/docs/15/sql-syntax-lexical.html#SQL-PRECEDENCE.
- 기존: (c.result_ref->'data'->'workPlan'-ARRAY['ref','status','dependencies','issues','relationalProjection'])
- 변경: ((c.result_ref->'data'->'workPlan')-ARRAY['ref','status','dependencies','issues','relationalProjection'])
- 이것이 이번slot의정확실패행이라고확정하지않는다. 원psql문장/행을수집하지않았고실제원인/수정후설치는NOT_RUN이다. 정적의도/우선순위 보완과실제확정을구분한다.
- 변경은 이 표현1곳의 괄호만이다. JSON제거목록/원payload equality·주체/정책/기한·receipt/audit·원승인소비/lock/권한/GRANT·guard는변경하지않는다. 범위밖동일패턴/다른표현자동수정0이다.

## 검수·반환
1. 시작HASH/단일패턴출현수1/실제diff를확인하고위1hunk만보정한다. 역치환하면시작rawbytes/SHA와완전히같아야한다. Git역사나고정d2를rewrite하지않는다.
2. 기존 tests/unit/FN11/work-plan-approval-consumption.test.ts의현재semantic양성/거절/소비검사를선택실행한다. 새 정규식/source형상 assert만추가해PG GREEN처럼보이지않는다. 시험파일수정0이며기대값완화0이다.
3. 기존 실제 DDL harness의 slot1 실패는원실행증거로보존한다. 수정후PG GREEN을현재실행할승인은없으므로NOT_RUN으로남긴다. 정의설치시험을fakeSQL해석기로대체하지않는다. SQL만바뀌므로전체UI/build/TS회귀반복0이다.
4. diff/check·새rawhash·변경전후1hunk/역치환동일·정확집중명령/exit·미검증/handle0·동결반환한다. 실제DB·role/GRANT·키·서비스·Agent·WSL/컨테이너/실자료·P03R3/새실행0이다.

Main은독립diff/집중결과를대조해기존branch에보존한다. 후속실제검증은다른정확source/자원/단발허가안으로만진행하며이보정자체를IX01·전체계획완료나DB적용으로세지않는다.

## r2 — 집중 시험의 기존 승인 요청 정책 fixture 정합
- Primary는SQL1hunk만보정/역치환동일로반환했다. SQL SHA7EE0D5D3DF15101F2DB9C5EE0584712A78CD7D3B1CC6427F6AE64507CF31698D는동결하며이번추가수정대상이아니다.
- 53d692 집중6개는5PASS/1FAIL/skip0/733.1403ms/exit1이다. 원payload요청보관시험에서현재ProjectApprovals.request:80의requestApproval자체authorizeMaterial검사가PROJECT_OPERATION_DENIED403으로거절했다. fixture는saveWorkPlanDraft만허용해요청자체허가가없다. Main c713d4가실제시험/guard를읽어확인했다. SQL설치시험이아니고시험코드는0035파일을읽거나설치하지않는다.
- 기존현재생산guard를유지하며같은Primary에 tests/unit/FN11/work-plan-approval-consumption.test.ts **정확1시험 writer**만추가한다. 제품/SQL/권한검사/기대값/정책계약변경0이다.
- 정상요청fixture는원requestApproval의명시ALLOW를정확같은주체·project·기한으로추가하고hash/snapshot연쇄를실제기존helper로다시계산한다. saveWorkPlanDraft의REQUIRE_APPROVAL/DENY·기존모든음성은유지한다. 실제사용자권한부여가아닌합성자료만이다.
- 동시에requestApproval규칙누락및명시DENY는현재403·후보/요청/소비쓰기0으로거절하는의미반례를추가한다. 올바른원payload보관의기존assert를삭제/약화하지않고기존현재검사를추측한fake우회로대체하지않는다.
- 먼저기존양성RED를보존하고신규거절반례가효과없이동작하는지확인한뒤정합한다. 예상밖다른현재계약/생산SQL접점이필요하면임의genericquery성공/fallback0으로반환한다. 실제PG/RLS/GREEN은여전히NOT_RUN이다.
- focused전체+정확타입영향이있는root noEmit/diff·변경파일지문을검수하고동결반환한다. SQL단일hunk불변/원장3/Main문서·보호3보존/실제DB·키·권한·WSL·서비스·Agent0이다.

## r3 — 같은 집중 시험의 현재 알림·인증 합성 포트 정합
- 74e745는6PASS/1FAIL/skip0/657.5796ms이며남은NOTIFICATION_STORAGE_FAILED503을보존한다. 새요청자체권한의누락/DENY반례e29cd7은쓰기0으로통과했다. 양성request 허가의실제정책enum은AUTO이며r2의ALLOW는일반허용개념이었다. 새enum/계약을만들지않는다.
- Main은rg실제반환 apps/server/modules/notifications/approval-notification-producer.ts와기존FN17알림 transaction 시험을읽어정확cap함수·authSession검사와fixture누락을확인했다. 생산자의권한/현재세션/저장·cap10000·요청과알림동일transaction기준은유지한다.
- 같은Primary의시험writer1경로만유지한다. 기존FN17 notification-fixture/producer·request-transaction의채택된synthetic authSession 형식과유효기한을같은주체/client/세대로제공하고, 정확 SELECT anvil.assert_approval_notification_capacity($1)·args=[pid]만성공응답하는합성분기를보완한다. 실제세션/정책/권한부여0이다.
- 일반SELECT/default성공/알림생산자대체/세션검사우회·skip0. 기존원payload/원receipt·hash연쇄assert와request정책누락/DENY쓰기0반례를유지한다. 정상요청에서capacity호출과원요청/후보뒤알림INSERT를확인해포트가실제소비됐음을검산한다. source SQL의PG GREEN으로세지않는다.
- 다른누락계약이더나오면임의확장하지않고정확반환한다. 실제SQL/PG/role/WSL·서비스·키·Agent·새QA0, SQL7EE0D5D3동결/형상assert추가0, 같은focused7개/타입/diff와지문·원실패이력만반환한다.
