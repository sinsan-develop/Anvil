# IX01 0074 회원 완결식 괄호 source 보완 지시서

2026-11-04 · SOURCE_ONLY · 실제 DB/권한/키/서비스/Agent/WSL/P03 R3 실행 제외

## 근거·변경 분류

R8 새단1회는2ed711에서0074/42601/진단null/문장끝110 FAILED/CLEANED로소진.5aac01 01:44:14.320Z exactID/name/source잔여0/감사보존. 원오류전체미수집이므로직접원인행단정0. 기존Primary읽기와Main0db214/625d82는fn74_membership_complete109행문자열외괄호열기7/닫기8·content_hash뒤닫기1과다를확인했다. 선택105 함수본문748개대응한정읽기에서는추가확정0이나전체SQL parser/PG PASS가아니다.

한문자구문수정과기존raw checksum의정확갱신은기승인미적용SQL/서버source의내부결함보완이며회원권한/공개API/데이터의미변경아니다. 실제schema_migrations·정식DB·서비스에는적용하지않는다.

## 단일 writer·허용3경로

기존Primary만수정·Main동시코드쓰기0. 다른작업자변경/보호untracked3/Backup보존.
1. db/migrations/0074_project_membership_versions.sql.pending (부모33602B/SHA256 67696FDD3695199E2BE3450669D903BD286E6D87FE05361B7B2A75CE58A3EB96)
2. apps/server/modules/projects/project-memberships.ts (membershipChecksum 문자열1개만)
3. tests/unit/FN01/project-membership-schema.test.ts (기존시험보존·직접회귀추가)

## 정확 보완

유일한 ‘contentHash’,old.content_hash))))))); 꼬리의닫는괄호1개만삭제하여old.content_hash))))));로바꾼다. EXISTS/NOT EXISTS·현재회원/version·HUMAN_COMMAND·previousRef/hash·모든거절/ACL/함수/타입/입력/줄바꿈/나머지원문불변. 삭제괄호역삽입부모raw동일을증명한다.

서비스의기존membershipChecksum=67696fdd… 문자열한개를수정SQLraw SHA256정확새값으로갱신한다. checksum조회/행수1/정확비교·64길이검사는그대로이며검사OFF/구hash병행허용/fallback0. 이literal갱신외서버변경0·역치환부모raw동일을증명한다.

수정전신규회귀로해당SQL식괄호불균형RED를확인한다. 수정후문자열내용외괄호대응·원문필드/guard/ACL보존·서비스checksum결박·기존schema/member입력/저장조회직접회귀를수행한다. source시험은실SQL/PG설치증명이아니다. 가짜SQL실행기/형식완화/오류무시/전체재포맷0. 필요noEmit/diff·정확명령/exit/수량/hash/bytes/오류·미검증/writer반환/live0반환. 기존하네스56/환경50/native44반복0. 같은근본오류3회면중단·원인/증거반환.

실제DB/SQL·권한/회원정책적용·키·서비스·Agent·WSL/Docker·실자료·P03R3·새QA실행/시각발급0,Git/새branch/worktree/thread/자동화/외부메시지0. Main독립인수후새SQL/index/실행안고정은별도후속이며새실제QA는새직접결정전금지/소진R8재사용0. 원실패UNKNOWN/감사/전체계획미완료보존.
