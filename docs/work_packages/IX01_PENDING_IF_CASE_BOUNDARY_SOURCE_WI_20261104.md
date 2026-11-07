# IX01 미적용 IF/CASE 경계 동일 원인군 보정 지시

2026-11-04 · Main 어울 · SOURCE_ONLY

기준SQL dc067a1cb1b0df81317f6dfc0f830ca19891335b, R2 실제실패는0035/42601/statementEndLine338·원문오류미수집이다. 0035의2B보정은이미별도검수됐다. 다음7개는같은PL/pgSQL IF조건의parenlevel0 CASE가종료THEN과충돌하는정적문제다. PG15공식 pl_gram.y의expr_until_then/read_sql_construct 근거는0035결과보고를따른다. 실제R2원인/이후설치성공을추정하지않는다.

| 정확허용 경로(db/migrations/) | 행 | 부모SHA256 |
|---|---:|---|
|0042_draft_artifact_storage.sql.pending|184|76D16C972339359B839ADA8A27A466C1F60873B5734FC37303F042B75C2CAA87|
|0047_stage_start_one_time_approval.sql.pending|135|2A276689E6490AF3C35A6369CA0E15DFE9135C596BC2A5E83B89E0E89CF22630|
|0053_backup_references.sql.pending|152|570031EA7B666F1AC82F65D7C804E3A217611453ED61D30BA2A27D706588D0FE|
|0057_capability_reports_human_claim.sql.pending|117|47D0929B41A61824DE29E10B83CDF5DF345E6D08F690A17710780331AC94415A|
|0067_definition_capability_reports.sql.pending|97|33A8A80A7F149B09DAF6CC99DF1E2D4CB56083E8C2231AE391BDB1C43EB98CCB|
|0069_environment_configuration.sql.pending|200|56FD565CAF8B5AD0EBDB58302B7ABA1A0EDC4BD1ABB6D599C1581129CD9257E6|
|0072_document_source_observation.sql.pending|309|8DB0B4C11655EC41D11F56DF90C77DE6D96FE5EF940B531CA3661F86DCFBCD23|

먼저명시105내기타IF/ELSIF직접CASE가있는지같은원인군만읽기로확인한다. 추가확정항목은보고후allowlist를갱신하며범위를임의확대하지않는다. SELECT/EXISTS괄호안·LANGUAGE sql·RETURN/대입CASE는제외한다. 각CASE…END만괄호2B로감싸7파일합계14B/7hunk로제한한다. 분기·값·정책·권한·주체·승인·감사·비밀검사는보존한다. 기존적용성공/과거사용증거가발견되면과거SQL수정전Main에보고한다.

Primary단일writer. Main동일SQL쓰기0. 타인변경/보호3/0035/원R1R2index・원장・driver・미완R3source3보존. 새로운실DB/role/권한/키/파일조사/WSL/컨테이너/서비스/Agent/P03R3실행0.

검수는before각1개/부모rawhash/한파일한hunk+2B/역치환부모raw완전동일/diffcheck를 확인한다。문자열기대값복제시험을추가하지않고실제PG구문재현은NOT_RUN으로분리한다. 기존Node시험이SQL을읽지않으면설치GREEN근거로쓰지않는다. writer반환후Main독립검수/새SQLcheckpoint/새R3결박순서이며중간R3index를최종으로사용하지않는다.


## r2 — 동일 원인군 추가4표현
Primary71e2e4는명시105의PL/pgSQL556함수/IF·ELSIF2973조건을읽기선별하고실제문맥대조했다. PG parser 실행은아니다. Main06ec16/cbb602는추가4문맥을독립확인했다. 총허용10파일/11표현/+22B로갱신한다. 이외조건/값/정책/권한/원문변경금지와실제실행제외는동일하다.

| 추가 정확경로(db/migrations/) | 행 | 부모SHA256 |
|---|---:|---|
|0041_control_handoff_source.sql.pending|269~271|C6BD081FC7A70F8EAA68AC673CCE6F8E41549D98F2C3E5BB3C22833874B0E522|
|0054_backup_installation_resources.sql.pending|246|8CC95B9DAB5B900DC44EB3FE6819CDC8B5ACE3D8DAE18223B48F32AA2DD8C0A7|
|0068_registered_definition_reservations.sql.pending|148/178|158E7DAABC85870D9C42C19CD38312B7DAE9609589200B8B3BC6D32A7F48054D|

0068만2hunk/+4B,다른9파일1hunk/+2B. 괄호외raw는완전히보존한다. 같은원인군최소내부보정이며새제품/공개계약결정이아니다. 미완R3source3는보존한뒤새SQLcheckpoint결박으로별도갱신한다.
