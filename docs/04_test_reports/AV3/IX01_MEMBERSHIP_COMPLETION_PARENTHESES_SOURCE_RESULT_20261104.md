# IX01 0074 회원 완결식 source 보완 결과

판정: SOURCE_ONLY 검수·scoped C0/I0/M0. 실제 PG/함수·RLS·회원권한 적용/API/UI는 NOT_RUN.

- 담당 기존Primary·Main어울 독립인수. WI8476f5c473e939fbb8470a8ad779a971d8e8868595fa68474b64cfc03c89c5ea.
- 원R8는0074/42601/진단null/문장끝110 FAILED/CLEANED,5aac01 별도실행자원잔여0/감사보존. 오류원문전체미수집으로실오류직접원인단정0.
- SQL109행old.content_hash뒤닫는괄호1개만삭제:33602→33601B. 서비스membershipChecksum literal1개만정확새raw SHA로동기화했다. 구hash병행허용/검사완화/행수·정확비교·64길이검사변경0.
- db/migrations/0074_project_membership_versions.sql.pending SHA256 E3DBD7FA537705C94CB34BC5D93AA643D6CA4B7E4C6E6C5155F186EE88416941/33601B.
- apps/server/modules/projects/project-memberships.ts SHA256 2A2ACB15E4704F7736D6D46E497C7447CE65153682B24D0419C24C6FF41C3452/17651B.
- tests/unit/FN01/project-membership-schema.test.ts SHA256 4D3E3194822C79E500BC7C2C8B92DF8ADF9DD7800B1D7FB44A0AC12E8E22B6C4/7221B. 기존시험보존·source회귀2추가.
- Primarya27d83 괄호대응RED1/259.6126ms/exit1→68ea7d schema/input/memberships16PASS/skip0/596.4837ms/exit0;673089/760f23 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0.99bad8 두단일hunk·역치환/WI/LF/공백검산0·오류0/writer반환/live0.
- Main67ac96 fresh동일3파일16PASS/skip0/539.768ms·diff0/서비스literal·시험읽기, e44800 부모Git원문기준SQL한문자/서비스정확literal외byte변경0·기존시험prefix동일/hash확인. noEmit은이후코드변경0으로Primary증거재사용·하네스56/환경50/native44반복0.
- 원EXISTS/NOT EXISTS·현재회원/version·HUMAN_COMMAND/previousRef/hash·모든guard/ACL/줄바꿈불변,실schema_migrations/DB/정책/회원/서비스적용0.
- 선택105함수본문748개의문자열/dollar인용/주석제외괄호대응한정읽기추가확정0은전체SQL parser/PG PASS아니다.

실제DB권한키서비스Agent/WSL/P03R3·새QA실행0/소진R8재사용0. 원R1~R8실패UNKNOWN·감사/전체계획미완료보존. rollback은SQL괄호재삽입·이전checksum복원·추가시험2제거이며구raw기준을Git에보존한다. 다음새SQL기준/index/실행안고정후새실제QA는새직접결정전금지.
