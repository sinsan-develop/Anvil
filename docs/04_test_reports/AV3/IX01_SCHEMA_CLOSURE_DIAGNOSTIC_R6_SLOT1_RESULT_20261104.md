# IX01 R6 SQL 정의 설치 단1회 결과

판정: **FAILED / CLEANED**. 전체 IX01·Stage B·작업계획서 미완료.

- 담당: Main 어울. 직접 승인: 신산님 “새 R6 QA 1회 승인해” 최신 지시. 새 승인은 이번 slot1에서 소진했다.
- 기준 packet SHA256 69D46F9D19E4BBC1F20A654D883820885DE4D5B110071EC0BEEE79A75E58CFCD, 실행 code435300939597162654f89ab3c85823dd25f31f4b / SQL69bdb75a1db5d3557e55daa03f2415635b100e31.
- 명시105·2376143B·order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef.
- issued2026-11-04T00:47:34.000Z / whole expires01:17:34Z / slot expires01:00:44.810Z. 3b75f6 생성 전 daon1000·SINSAN·Node/image/daemon·경로/컨테이너 부재 확인. docker --config /dev/null의 config 경고3은 사전관측 준비 경고이며 실제 실행은 새 빈 보호 config를 사용했다.
- 1e2cd0/69710 →8ded14: 신규 Git checkout exact43530093·tracked clean·0700·고정3파일 hash 일치.
- 실제 명령: 정제 환경의 /bin/bash --noprofile --norc scripts/qa-ix01-schema-closure.sh --run. 59e49a/49394 →55d128 exit1, 추가 실행0.
- planHash 2b7a50ad2658fd0f936af175066707721fc0cbae2769ba8bfb137b0773e8cc72 / fullID 5dbd92e5451b894eebb70d29e8832c2ca724dcdee44cf879c67b567493da8fe4.
- stage db/migrations/0069_environment_configuration.sql.pending / SQLSTATE 42883 / FUNCTION anvil.environment_approval_scope / statementEndLine 227. 이는 문장 끝이며 정확 오류 원문·원인행 전체는 미수집이다.
- 0039 정의 설치 이후0069까지 진행했으나 이 결과는 해시 함수의 실제 모든 입력 동등성·함수/DML/RLS/API/UI 검증이 아니다. 뒤 정의 및 전체105 설치는 실패/미검증이다.
- 임시 provider ADMIN 회원1→0, 최종 migrator CREATEROLEfalse·systemHash 불변, 회수·컨테이너 정리CLEANED. 원0037 정책/권한·기존 DB/권한/키/서비스/Agent/P03 R3 변경0.
- 8c0820 exactID/name 부재·source clean/UID1000/nonlink·sudo 읽기 전용 proc240/matches0 확인 뒤 등록 source만 삭제. 감사3은 보존.
- c07b3e 별도 SSH 2026-11-04T00:52:23.435Z exact fullID/name/source 부재·감사3 hash 동일, 실행 자원 잔여0. 감사 root는 의도 보존하며 잔여0 분모에서 구분한다.

## 원문 증거

- docs/04_test_reports/AV3/IX01/DDL_R6_SLOT1_OWNER_20261104.json (199B / 5175bf8ca451f3b72015da8a74b52497e03b446ff1f5a7d151bc11db0bc17f85)
- docs/04_test_reports/AV3/IX01/DDL_R6_SLOT1_INTENT_20261104.json (414B / c28f2ef8b8c1db8c87c4deb173a1f8e2e1a1a32c7cffeaa95e974f4f1e426094)
- docs/04_test_reports/AV3/IX01/DDL_R6_SLOT1_RESULT_20261104.json (4463B / af5abce82d87f53f9808d6ea644c7d5a0242796081041c1ec77329fc23629bce)
- docs/04_test_reports/AV3/IX01/DDL_R6_SLOT1_METADATA_20261104.json
- docs/04_test_reports/AV3/IX01/DDL_R6_FINAL_METADATA_20261104.json

## 다음 조치

기존 Primary가0069의함수정의/참조순서를읽기전용조사한다. 미적용 source의최소결함보완은별도정확범위로단일writer에게배정하고독립검수한다. 새 실제QA는소진R6를재사용하지않고새고정코드·실행안·단1회직접결정전금지한다. 기존R1~R5 실패/UNKNOWN·감사와정리이력은그대로보존한다.
