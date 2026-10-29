# FN16 프로젝트 전체 통제원장 내부 수집 결과 — 2026-10-29

## 판정·기준
Main 신규22합성PASS/type·diff0 및 독립최종C0/I0로 내부source를 인수했다. 실제 DB/백업·원권한 복원·전체FN16 완료가 아니다.
branch codex/av3-stage-b/시작2ff0fbbf9336ad60e8b2d9f729a73f64543d5563. 최종WI docs/work_packages/FN16_PROJECT_CONTROL_LEDGER_INVENTORY_IMPLEMENTATION_20261029.md SHA256 7DE711DCC09F560F6A5EB7BA9EB869787EF6B895CBB2FF68B0BCCCCC58E45919. 초기8407BB6D/09D8987D는보완이력.
신규 project-control-ledger-inventory.ts·행동/schema시험2만변경,기존21collector/helper/SQL·실제DB키계정권한서비스/파일Agent·Git개발자쓰기0. Main관리검수통합/Primary단독구현/Reviewer읽기.

## 변경·검증 한계
PROJECT commands21/동일scope authorization_receipts9/project audit_events16 전체46열을한RR로수집한다. 일반HUMAN_APPLIED/createProject특수형식/명령없는거절·연결·소스관측감사/비APPLIED·미지원형식을분리한다. 기존selected의감사1개/command조건을전체에복사하지않는다. explicitnonnullFK·주체·명령scopeDigest를검사하되생성draftcontext없는특수digest·원request/전체감사chain은미검증으로남긴다. 상태/미지원/nullable행을숨기거나현재권한으로재판정0.
원rowcontent_hash/version이없어정확수집열의정수·시각정규화derivedMetadataHash와개인정보제외projectionHash를별도발급한다. request_hash/범위digest를행checksum이나가짜VersionRef로부르지않는다. rawpayload/result/사람UUID/client/경로·민감원문은반환하지않으며미지원원형은고정shape/hash·issue/NOT_PERFORMED다. known외피손상을fallback으로낮추지않는다.

## 오류·보완·실행 증거
- preflight I1 known결과식별이모호한부분을09D8987D의예약외피5키/생성operation우선으로명시,독립367f89 C0/I0.
- Primary32e80f RED 신규13개0PASS/13FAIL(미구현),ArtifactRef결과version1임시fixture는실persistProjectReceipt의null로보완. c2dc24 최초13P/type0.
- 제품I1 동일command정정감사의rawtarget반환을독립/자체검수로발견,2b5a3a RED뒤비primaryHUMAN감사는UNSUPPORTED/hash·미검증issue로최소보완. 정상primary1+정정1경로/사람ID비노출반례추가. ea5d1b16P/정확46열정수·시각H/모든row·최종RC뒤누적DTO413 확인.
- 회수release오류+동시abort503,ArtifactRef20MiB/200자상한을추가반례로확인. 기존source는수정하지않았다.
- 신규stamp의실PG시간출력정합을Main/Primary가발견해공식자료와대조했다. DB열만offset·fraction0~6 UTC정규화/마이크로초보존,같은instant는같은정규화/다른microsecond는다른hash. Date/string/UTC결과연도1~9999·달력/offset/정밀도/무tz잘못된표현거절. 원문serverReceivedAt는기존isoV1유지. timestampRED313413·연도RED1dfc65·protocolRED3a27a3을보존,최종37f0f0 신규22PASS/0FAIL/505.7326ms/type·diff0.
- Mainf4fdbc: node --test tests/unit/FN16/project-control-ledger-inventory.test.ts tests/unit/FN16/project-control-ledger-inventory-schema.test.ts →22PASS/0FAIL/skip0/499.2992ms/exit0. npm run typecheck/git diff --check exit0/최종3지문일치. 불변21collector전수반복0.
- 독립최종추가범위C0/I0:정정rawtarget차단·knownfallback금지·누적한도/회수503·시간보존/연도범위/프로토콜불변·최종3지문확인. 읽기검수는실시험재실행/실DB증거가아니다.

## 시간 표현 근거
[PostgreSQL15 날짜/시간](https://www.postgresql.org/docs/15/datatype-datetime.html)의정밀도와[REL_15_STABLE JSON소스](https://raw.githubusercontent.com/postgres/postgres/REL_15_STABLE/src/backend/utils/adt/json.c)의JsonEncodeDateTime/TIMESTAMPTZOID·USE_XSD_DATES를읽기대조했다. 실제PG에접속/SQL실행하지않았다. 지원은명시유한4자리양의연도·offset ISO/최대6fraction이며BC/확장연도/infinity등전체PG시간범위지원은아니다. DB열정규화만보완하고다른수집기/프로토콜을암묵변경0.

## 지문·미검증·다음
source1DAD75229D6C12568C6A1E86192C0436F4D54B1CE15F5B77839ACBD047A97AC7,행동A552DBB9B95573BA4987584320E06DE723616ABD5E861FA8A4AC2CE23ADF8D86,schema456E76B93C16619DFA960A0B12A9FDABD979AAF2FB7E9209C8AAE9F9E40B6151.
실제DB/RLS·동시변화/강제실시간상한·키서비스·원payload/현재권한/전체Anvil원장·감사서명chain·원권한복원/archive/UI인수 NOT_RUN. DRAFT/USER_COMMON/인증감사/세션원장은미수집,rawpayload/result NOT_EXPORTED,fullcoverage/restorable/권한복원/실행/dispatch/atomicfalse. 미지원/부재profile을정상건강·전체완료근거로쓰지않는다.
Main만신규3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로checkpoint,rollback은신규3의검토된revert·명령/권한/감사/자료/백업삭제0. 전체WORK_PLAN미완료.
