# IX01 0035 JSON 추출 결과 결합 source 보완 결과
2026-11-03 · Main 어울 / 기존 Primary 구현

판정: **SOURCE_CORRECTED / FOCUSED_SYNTHETIC_PASS / ACTUAL_PG_GREEN_NOT_RUN**. slot1 실제DDL 실패를 PASS로 바꾸거나 직접 원인을 확정하지 않는다.

## 기준·변경
- WI r1 A80F69F3→r2 CBB458FB→r3 B40636D8425F3AF9FD745F2C71C5F6A87941E9E97E25ED373C8C32C02BB42BAB. 단일 Primary가 SQL1 뒤 시험1로 순차 writer를 반환했으며 Main 제품/시험 쓰기0이다.
- db/migrations/0035_work_plan_draft_approval.sql: 원F6B3F1ACEA0A590DBEC86994EDE796E9661BCF058715B8DBDC6E60AF21C8F1CA → 새7EE0D5D3DF15101F2DB9C5EE0584712A78CD7D3B1CC6427F6AE64507CF31698D. JSON추출결과를먼저괄호로묶는2바이트/한hunk만변경했다.
- 전: (c.result_ref->'data'->'workPlan'-ARRAY['ref','status','dependencies','issues','relationalProjection'])
- 후: ((c.result_ref->'data'->'workPlan')-ARRAY['ref','status','dependencies','issues','relationalProjection'])
- JSON제거목록/원payload equality·정책/주체/기한·원승인소비·receipt/audit·GRANT/guard는동일하다. 원d2/Git/원장/실제실패는보존하며실DB적용0이다. 실제적용성공증거발견시원migration수정경계를재판단한다.
- tests/unit/FN11/work-plan-approval-consumption.test.ts SHA D9DD840B4392195E67833EE91B81804EB5861F15ABAF32AC67148190EB4DBC6E. 기존양성fixture에현재명시requestApproval AUTO·동일actor/client의유효authSession과exact알림capacity포트만정합했다. 기존SAVE_REQUIRE_APPROVAL/DENY·payload/hash/ref/영수증단언은보존했다. 실제사용자/세션/정책권한부여0이다.
- 새반례는requestApproval규칙누락·명시DENY에서현재403·요청/후보/소비쓰기0이다. 정상요청은원request→후보→알림INSERT와원명령/요청hash·정확cap args를검산한다. 생산guard/알림실패시요청거절/cap10000을바꾸거나대체하지않았다.

## 검증 이력
- Primary b5768d: 역치환시시작raw/SHA완전동일 exit0,274aad 한hunk/diff0. Main c713d4/db5801이변경전후와동결지문을독립읽었다.
- 53d692 최초5PASS/1FAIL/skip0/733.1403ms: 현재requestApproval자체허가없는fixture로403. e29cd7 신규정책음성1PASS 뒤74e745 6PASS/1FAIL/657.5796ms: 별도알림capacity/authSessionfixture누락503. 둘을소급PASS로표시하지않는다.
- Primary9f8e27 최종7PASS/0FAIL/skip0/1165.8702ms·deb0b3→b5055a noEmit0·d3ef60 diff0,본인livehandle0.
- **Main b49e21** node --test tests/unit/FN11/work-plan-approval-consumption.test.ts, exit0/7PASS/0FAIL/skip0/973.6067ms. 실제SQL파일을읽거나PG에설치하지않는현재semantic회귀검사다.
- **Main2d5f21** node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json, exit0/6.7212초. Main db5801 실제fixture diff에서삭제/우회/기대값약화0·기존조건+추가음성을확인했다.
- source한정검수에서미해결Critical/Important0이며이판정은실제PG/인증/보안/서비스인수가아니다. 실제DDL RED slot1과다음PG GREEN은별개다.

## 미검증·다음
- 현재source의PG정의설치/JSON연산실제동작·원22P02정확실패행은NOT_RUN/미확정이다. 기존53/105전체·IX01/실서비스·사용자인수·계획완료가아니다.
- 같은우선순위문제의한정읽기7691c2/27c812에서0071:61과0072:33/265의추가3표현을발견했다.733166에서둘의미적용source주석/원지문을확인했다. 해당source2는이작업에서수정하지않았고별도정확범위로관리한다.
- 새실제QA는r4/slot1승인이소진돼자동재실행하지않는다. code/SQL/index·자원·단발허가를새로고정한뒤에만실제수정후검증이가능하다. 기존DB/키/권한/서비스/Agent/P03R3변경0이다.
- rollback은새source수정의정상Git revert이며원raw는고정d2/history에있다. force/reset·사용자dirty/원장삭제0. Main은정확소유분만기존branch에보존하고계속한다.
