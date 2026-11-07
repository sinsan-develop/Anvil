# IX01 미적용 JSON 추출·차집합 동일 오류군 source 보완
2026-11-03 · Main 어울

SOURCE_ONLY / ACTUAL_PG_NOT_RUN. systematic-debugging의 실제실패분리→같은패턴한정조회→원자료/우선순위대조→최소수정 순서를 적용한다. 기존FN03/FN06/IX01의구현의도보완이며새제품기능·공개API·승인/권한계약을정하지않는다.

## 기준·소유
- source/문서 checkpoint99f91d43162de8871a011e2c505b2ebb4d357821. 3279a1→소유77656/55529b exit0,정확10/rawindex동일/개발privateexact·main/보호3불변·trackedclean이다.
- 기존r4/slot1은0035에서실패·소진·권한회수/QA잔여0/감사보존이며후속SQL은실행되지않았다.0035 source한hunk·현재fixture정합은별도7PASS/PGGREEN미실행으로보존한다. 이보완이원slot의실패행을증명하지않는다.
- 같은Primary만다음정확2경로를writer로사용한다. Main코드쓰기0·다른SQL/제품/시험/index/driver/문서·보호3수정0이며타인변경을되돌리지않는다.
  1. db/migrations/0071_native_preparation_authority.sql.pending — 원SHA167FC4CF61992C4BFA97871089BAFEDD9B22CC6B74DF294C52001DC47D7AA33A/40916B
  2. db/migrations/0072_document_source_observation.sql.pending — 원SHAE561CDADB1BC68E426B6CD8D62417822B549756263463F252A9B032493706B06/78912B
-733166은둘의미적용source/PG·권한검증NOT_RUN주석을읽었다. 실제적용성공/불일치근거발견시면원파일수정중단·반환한다. 원d2/Git/실행하지않은slot후행분모를보존하고historyrewrite0이다.

## 조사 근거·정확 보정
Main7691c2/27c812의한정패턴조회가아래3곳을반환했다. PG15우선순위상 -가JSON추출연산자보다먼저결합하므로JSON추출결과에만괄호를추가한다. 출처 https://www.postgresql.org/docs/15/sql-syntax-lexical.html#SQL-PRECEDENCE.
-0071:61 전: (g->'scope'-'writerHeadRef'-'preparationRef'-'hostPublicKeyFingerprint')
-0071:61 후: ((g->'scope')-'writerHeadRef'-'preparationRef'-'hostPublicKeyFingerprint')
-0072:33 전: p=c.result_ref->'data'->'snapshot'-ARRAY['projectId','kind','state','previousRef','recordedAt'];
-0072:33 후: p=(c.result_ref->'data'->'snapshot')-ARRAY['projectId','kind','state','previousRef','recordedAt'];
-0072:265 전: jsonb_set(normalized,'{sourceLinkRef}',e.snapshot_json->'sourceLinkRef'-'contentHash')
-0072:265 후: jsonb_set(normalized,'{sourceLinkRef}',(e.snapshot_json->'sourceLinkRef')-'contentHash')

제거 목록/정규화결과/원scope equality·signature/current/ref/field/hash·검증/정책/주체/영수증/감사·권한/GRANT/기한/원승인소비조건은그대로다. 바꾸는것은3표현의각괄호2바이트뿐이며regex전파일자동수정/서식/주석추가0이다. 신규권위/허가/guard우회/불명결과PASS0이다.

## 검수
- 시작2지문/고정Gitraw와패턴각1회/총3을대조→3hunk·총6바이트만수정→역치환시각원raw와동일을확인한다. 원0035 SQL7EE0D5D3와시험D9DD840B·원장3은변경하지않는다.
- 기존 tests/unit/FN06/native-preparation-authority-contract.test.ts 및 tests/unit/FN03/document-source-observation.test.ts의읽기/실행경계가pure/synthetic인지먼저확인하고정확2개만선택실행한다. 실제DB/서비스/키/Agent포트가나오면실행전반환한다. 시험수정·기대값/skip/GREEN맞추기0이다.
- SQL만바뀌므로전체UI/build/type회귀반복0, diff/check·전체새지문/정확명령/exit·미실행을반환한다. 현재SQL설치/실제JSON연산/RLS·native/사용자인수·IX01GREEN은NOT_RUN이다.
- 실제PG/DB·role/GRANT·WSL/컨테이너·서비스·키·Agent/P03R3·새실행0이다. 현재구체승인/예산을source보완으로연장하지않는다. 최소source후보만동결/worker반환한다.
