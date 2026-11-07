# IX01 0071 감사식 괄호 source 보완 지시서

2026-11-04 · SOURCE_ONLY · 실제 SQL/DB·권한·키·서비스·Agent·WSL/P03 R3 실행 제외

## 근거·범위

새R7직접승인은90d8c2에서0071/42601/diagnosticnull/statementEndLine87 FAILED/CLEANED로소진됐다. c12a6a 별도01:23:10.015Z exactID/name/source부재·감사hash동일/실행자원잔여0을확인했다. 원실패/UNKNOWN·감사보존. 오류원문전체미수집이므로실오류직접원인행확정0.

기존Primary읽기와Main7dc1cd는0071함수54~87의74행auditRef비교식끝이correction_of))))로닫혀따옴표내용외열기4/닫기5임을확인했다. 기존3중jsonb_build_object/ownership_content_hash호출의닫기3개가필요하다. 이는기승인미적용SQL의명백한한문자내부구문결함수정이며새공개API/데이터/권한정책변경이아니다.

## 단일 writer·허용2경로

기존Primary만다음2경로를수정한다. Main동시코드쓰기0. 다른작업자의변경·보호untracked3·Backup을되돌리지않는다.
1. db/migrations/0071_native_preparation_authority.sql.pending (부모40918B,raw/Git동일SHA256 11DCE811B5B912E51348DB8C7F17970C9EDB391E6B4C895B88E0E34AED5C0DA4)
2. tests/unit/FN06/native-preparation-sql-delimiters-source.test.ts 신규

## 정확 보완·검증

유일한문자열 ‘correctionOf’,au.correction_of)))) THEN RETURN false;END IF; 의닫는괄호1개만삭제하여correction_of)))로바꾼다. 감사필드/JSON·canonical/hash입력·시각·원명령/receipt/approval/writer검산·거절/ACL/원자transaction·줄바꿈·나머지원문불변. 원문전체재포맷/함수stub/검산OFF/에러무시/권한확대0. 역삽입으로부모raw40918B완전동일을증명한다.

수정전신규source시험에서해당감사식의괄호불균형을RED로재현한다. 문자열따옴표내용을제외한해당표현의균형과필드/hash/단일transaction·다른원문보존을확인하며SQL을흉내내는가짜실행기로PG GREEN을주장하지않는다. 직접 native-preparation-authority-contract/native-preparation-store와신규시험만우선실행·필요타입/diffcheck·정확명령/exit/수량/hash/bytes·오류횟수반환. 기존R7하네스56/환경50반복0. 같은닫기과다구조는관련감사식의좁은읽기로한정대조가능하나전체105구문완전성으로과장하지않는다. 같은근본오류3회면중단/증거반환.

실제DB/SQL·role/GRANT·키·서비스·Agent·WSL/Docker·실자료·P03R3·새QA실행/시각발급0. Git/새branch/worktree/thread/자동화/외부메시지0. 소유2파일diff/역삽입동일·미검증·writer반환/live0을제출한다. Main독립인수뒤새SQL기준/진단안결박은별도이며소진R7승인재사용금지·새실제QA는새직접결정전금지. 전체계획미완료.
