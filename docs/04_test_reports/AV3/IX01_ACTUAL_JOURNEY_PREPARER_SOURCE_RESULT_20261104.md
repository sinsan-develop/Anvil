# IX01 실제 여정 전용 준비기 source 검수 결과 — 2026-11-04

판정: SOURCE_IMPLEMENTED / 실제 실행 NOT_RUN. 신규 준비기와 합성 검사를 검수했으며 IX01·Stage B·전체 계획 완료가 아니다.

- 담당: 기존 Primary 구현, Main 어울 독립 검수·통합. 기준 HEAD c26751409eac3a3b4800e472f59ec5e5d5a624d3, branch codex/av3-stage-b. 기존 보호 untracked3과 원 source/SQL은 보존했다.
- WI 최초5557F4FB02FE334C79DCBBD041B0358EC34681E3397F137CF9E131102D983415; Main 소유 신규 문서 줄바꿈만 비의미 정정한 최종 SHA256 8f90a9e365c8a40829d69258400ed321a5a6eaa17b44bb01795b9abc84e1cd26. 원문/기능 범위 변경0. PG 절대10분·whole30분·child90초, 실제 실행 제외를 구체화했다.

## 변경 파일과 목적

- scripts/qa-ix01-actual-journey.sh / 40563B / SHA256 15c90b7751bdcaeecbc1738b007bf6082e6b3dd180ec28136a5c565eb689ba0a
- tests/unit/IX01/actual-journey-controller.test.ts / 22277B / SHA256 e602c0147bbe977a246a7b31344f308d547c5912fb83210ff3a1f90bb2a1609a
- docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv / 15807B / SHA256 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd

신규 준비기는 기본/plan/import에서 실제 효과0, 별도 exact opt-in/원문계획 hash/단발 intent를 검사한다. 실제 command builder/parser→동일 controller→actual ports를 연결했다. 원105 SQL 성공 정착 후만 실제 schema_migrations INSERT를 수행하고 순차 SQL/원장 영수증을 보존한다. commit/ledger 공백·자식 nonzero/timeout/signal/출력 불명은 UNKNOWN으로 남겨 후속 DB조회·권한 mutation·삭제·재실행을 하지 않는다. 정확 PG/역할/원 provider·0037 원자 설치/회수와 SCRAM·새 internal network·원 child14/owner7·기한/64KiB 감사를 고정했다. 성공 후 컨테이너/network/artifact만 소유 검산해 정리하며 source/npm 정리는 별도 Main 검산 필요로 표시한다.

## 독립 검토와 보완

- child sourceFiles root package/lock 혼입: parent 지문 검산을 유지하고 기존 child prefix/ext만 전달하도록 보완.
- claim 생성 후 결과 유실: 시도/정착을 분리해 INTENT_UNKNOWN, 기존 intent 재사용/덮어쓰기0.
- PG 생성부터 별도10분 절대기한과 모든 await 뒤 기한을 검사. 기존 전체30분/child90초는 유지.
- legacy systemHash 덮어쓰기 제거, 원 system roles/membership 지문을 보존.
- artifact 부모 디렉터리까지 정확 소유·빈 상태 확인 후 회수하고 source/npm 잔여는 별도로 표시.
-105개 SQL/원장 정착 영수증과 최종 roleEvidence를 비밀 없이 보존.
- npm11.19.1·실행기/package 지문·전용 config/cache와 project npmrc 부재·고정 lockfile을 확인. entrypoint 지문을 전체 npm 코드 closure 증명으로 확대하지 않음.
- 마지막 readiness: 최종 PID1만으로 최초 SQL을 보내던 누락을 수정. pg_isready exit0만 준비 완료,1/2만 기존40회/기한 안에서 준비 상태 조회, 불명은 보존하며 SQL 재시도0.

최종 scoped 코드 검토: Critical0/Important0/미해결 Minor0. 이는 source 범위만의 검토이며 실제 Docker/PG/TCP 권한·저장·서비스/화면 인수를 증명하지 않는다.

## 검증 증거

- Primary19302e: 신규 source 부재 RED0P1F. 첫 TAP fixture ok1 누락/타입 추론 오류는 준비 오류2로 분리하고 합격 기준은 유지.
- Primary54071f focused20PASS/skip0,55b5f0 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0,4985a9 Git Bash --noprofile --norc -n scripts/qa-ix01-actual-journey.sh exit0.
- Mainfec5fd fresh20PASS/skip0/251.2347ms. 추가 readiness helper 부재 RED2(a735cf), 실제 finalServer 포트 행동 RED1(ef519d) 뒤 보정.
- Primaryd18641 최종23PASS/skip0/425.4535ms,389c99 Bash 구문 exit0,1bd983 readiness 역치환 부모 raw 동일·기존20/manifest 불변. 타입 구조 불변으로 기존 noEmit 재사용.
- Main899158: node --test tests/unit/IX01/actual-journey-controller.test.ts fresh23PASS/skip0/489.9279ms·diff check exit0, 최종 실제 포트의 readiness 소비선 독립 확인.
- Maina59c0c: R9 row/Git SQL raw105 hash/bytes 동일·2376141B·순서09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef. Windows7파일 줄바꿈 차이/내용 차이0. 초기 읽기 가정 오류2는 정정했으며 파일 normalization0.
- Main57e8dc: 보호3/R9 driver/기존 integration 지문 불변. Main 문서 CRLF suffix 오류는 b89c05에서 소유 추가분만 정정·기존 prefix 보존.

## 미검증·다음 실행 경계

실제 npm 설치/Docker/PG·새 인증/권한·DML/RLS/API/재접속·QA 실행은 NOT_RUN이다. Main94d5f3의 기존 npm 공개 metadata 읽기는 별도 관측일 뿐 실행 승인이 아니다. R9 grant는 정의 설치로 소진됐고 재사용하지 않는다. 다음은 새 전용 J1 자원·exact commit·실제 ledger/seed/auth/TCP/artifact/child·오류 시 보존·정리·감사 범위를 동결한 별도 단1회 실행 결정이다. 기존 DB·키·서비스·실 Agent/P03 R3·운영/Oracle는 제외한다.

기존 대표 시험1건이 통과해도 내장 방법론 종류별/3생성경로·화면/서비스 재시작·실 브라우저/전체 IX01의 나머지 조건은 남는다. 목업·합성 PASS를 해당 인수로 승격하지 않는다.

rollback: 실제 실행 전 source-only 신규3 경로를 다음 일반 Git commit에서 되돌릴 수 있다. 기존 SQL/원문/실패·UNKNOWN·감사와 사용자 자료는 수정하지 않는다. 실제 자원 rollback은 아직 실행하지 않은 별도 실행안의 정확 정리/UNKNOWN 보존 절차로만 판단한다.

## 후속 안전 진단 보완 r2

수정 사유: 3ef48264의 child nonzero는 고정 실패 위치까지 모두 버렸으므로 UNKNOWN 뒤 추가조회 금지 상태에서 후속 검수가 막힐 수 있었다. 변경 전 classify 결과만 저장 → 변경 후 같은 classify 합격/실패 기준을 보존하고, preflight에서 원35006B/SHA87B70EEB의 bounds를 고정한 뒤 캡처 TAP에서 {line,column,code} 또는null만 감사에 남긴다. ERR_ASSERTION을 포함한 총14개 명시 코드 집합만 허용하고 임의원문·경로·메시지·SQL/body/token/DSN은 반환하지 않는다. 힌트는 실제 PG원인이나 성공 증명이 아니다. 불명 뒤 파일/DB 재조회·mutation·삭제·재실행0을 유지한다.

- 최종 script43795B SHA207C073F29EEDAB7E4E21D08D50C0A317ED6BE52B1BEFCEE9B402B62F18645D6; unit27346B SHA420DDF0EF780160636609D4DD4645E6E24873D8C469F68AC9B8D162E92D1080D. 원23시험 prefix·고정 actual시험/R9driver/index는 불변이다.
- Primary98d2e0 RED0PASS3FAIL→361223 GREEN27PASS/skip0/607.8108ms,22deaa raw/hash·범위검산0. 마지막 병렬 noEmit/Bash 출력은 소실되어 원 호출 결과 UNKNOWN으로 보존한다. 후보문서 길이준비 오류2는 쓰기 전 종료/실환경과 분리했다.
- Mainfcaf0f 해당 읽기 검사 프로세스 수0 확인 후 독립 fresh27PASS/skip0/531.5802ms와 실제 diff 검수. 추가DB/파일조회 없는 사전bounds→공유parser→actual child포트→controller감사 소비선을 확인했다.
- Mainf756ff 독립 noEmit exit0/9.161932초. b35b5a Git Bash sandbox는 NtCreateDirectoryObject\BaseNamedObjects의0xC0000022로 시작 실패(exit -1073741502), 스크립트 구문/제품 실패로 판정하지 않음.09216b 같은 -n만 정상 사용자 문맥으로 실행해 exit0/1.5303664초 확인. 실제 Bash본문/QA 실행0.
- 최종 scoped C0/I0/M0·실제 npm/PG/DML/RLS/API/재접속/브라우저 NOT_RUN. r1 검수는 당시 source의 증거로 보존하며 최종 실행안은 새 code SHA로만 동결한다.
