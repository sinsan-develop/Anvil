# IX01 0069 함수 정의 순서 source 보완 지시서

2026-11-04 · SOURCE_ONLY · 실제 DB/권한/키/서비스/Agent/WSL/P03 R3 실행 제외

## 근거와 변경 분류

새 R6 단1회는55d128에서0069/42883/FUNCTION anvil.environment_approval_scope/statementEndLine227로FAILED/CLEANED했다. c07b3e 독립00:52:23.435Z exactID/name/source부재·감사3 hash동일로실행자원잔여0이다. 원실패와미검증범위를유지하고소진R6를재사용하지않는다.

같은Primary 읽기와 Main0f28b3/489964/d8ce70은0069의224~227 alias/new LANGUAGE sql wrapper가761~774의scope정의를앞서참조함을확인했다. scope는466의후보표복합형·453 current-owner·696 target을필요로하므로scope를앞으로옮기지않는다. 442~443의원REVOKE/GRANT는wrapper와함께이동해야한다. 이변경은기존미적용SQL의동일정의/정책을설치가능한순서로배열하는내부결함수정이며새공개API/권한/요구사항변경이아니다. 원문오류전체미수집이므로직접원인행을꾸미지않는다.

## 단일 writer·허용2경로

기존Primary만다음두경로를수정한다. Main은동시코드쓰기0·문서/독립검수/Git을맡는다. 다른작업자의보호untracked3/Backup/기존변경을되돌리지않는다.
1. db/migrations/0069_environment_configuration.sql.pending (부모raw SHA256 398A67744CE47BA543E38D2AF55F5B68A4EFFA67162E340CFF8EB81673B1781D)
2. tests/unit/FN06/environment-configuration-schema.test.ts (기존시험보존·직접순서회귀추가)

## 정확 변경

동일BEGIN~COMMIT안에서224~227의ALTER connection_candidate_approval_target_valid RENAME및새wrapper정의블록과442~443의기존REVOKE/GRANT두문장전체를774뒤·quota_account정의앞으로원문그대로이동한다. 결과는scope정의/ACL→alias→wrapper→기존동일ACL→quota_account→COMMIT순서다. 원함수본문/signature/security/search_path/guard·ACL내용·role·schema/table/데이터·선택105순서는불변이다. stub/check_function_bodies OFF/함수오류무시/권한확대/전체포맷변경0. CRLF/LF를일괄정규화하지않는다. 두블록역이동으로부모raw완전동일을증명한다.

## 검증과 반환

수정전직접순서회귀를RED로재현하고수정후scope선행·alias/wrapper/ACL순서·단일transaction/기존보안본문보존을검사한다. 기존environment-configuration-schema와직접인접environment-versions/environment-resources만우선실행한다. 필요한타입검사/diffcheck·정확명령/exit/수량·bytes/hash·부모역이동동일을반환한다. source/합성검사를실제SQL설치/함수/DML/RLS/API/UI PASS로표현하지않는다. 한정selected105 LANGUAGE sql192개정의이름/순서읽기에서는추가확정사례없었으나overload/relation/type전체완전성증명이아니다. 기존R6하네스전수56재실행0. 같은근본원인3회면중단/증거반환.

실제DB/role/GRANT·SQL실행·키·서비스·Agent·WSL/Docker·실자료·P03R3·새QA실행0, 새branch/worktree/thread/자동화/외부메시지/Git변경0. writer반환/livehandle0와미검증·오류횟수를명시한다. Main독립인수후새SQL기준/실행안결박은별도후속이며새실제QA는새직접결정전금지. 전체계획미완료.
