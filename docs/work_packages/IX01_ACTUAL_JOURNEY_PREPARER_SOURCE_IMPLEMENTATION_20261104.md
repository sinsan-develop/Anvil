# IX01 실제 저장 여정 전용 준비기 source 구현 계획

목표: 승인된 Stage B/IX01의 실제 API·DB 저장/재조회 시험을 실행할 수 있는 단발 준비기를 작성한다. R9는105개 정의 설치만 완료했고 승인은 소진됐다. 이번 작업은 코드와 합성 시험뿐이며 실제 QA 실행 승인이 아니다.

기준 HEAD c26751409eac3a3b4800e472f59ec5e5d5a624d3, SQL 기준 a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb. 기존 R9 index와 고정105 순서·원문을 보존한다. 과거 FAILED/UNKNOWN·감사 기록은 불변이다.

## 단일 소유·허용 경로
기존 Primary만 신규3경로를 작성한다. Main은 문서·독립 검수·Git만 수행한다. 다른 작업자의 변경과 보호 untracked3을 보존한다.
- scripts/qa-ix01-actual-journey.sh
- tests/unit/IX01/actual-journey-controller.test.ts
- docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv

기존 시험/제품/SQL/R9 driver/권한 계약은 수정하지 않는다. 신규 의존성·범용 실행 framework를 도입하지 않는다. Bash와 내장 Node, 기존 Node test 환경을 사용한다.

## 구조·효과 경계
기본/--plan/순수 import는 파일쓰기·비밀생성·외부명령·자원 효과0이다. 순수 controller와 실제 command builder/parser를 같은 실행선에 연결한다. 합성 ports는 실제 ports와 같은 계약을 소비한다. --run도 정확 외부 실행계획·내용 hash·별도 승인 식별·발급/만료·단발 intent 없이는 거절한다. 실제 source 구현 중 --run, SSH, Docker, npm 설치, DB/권한/키/서비스/Agent 실행은 금지한다.

새 J1 전용 literal 후보(생성0): source /home/daon/anvil-ix01-journey-20261104-j1-qa, PG anvil-ix01-journey-pg-20261104-j1-a1, internal network anvil-ix01-journey-net-20261104-j1-a1, DB anvil_v3_ix01_20261104_j1_a1, artifact /tmp/anvil-v3-ix01-journey-20261104-j1/artifacts, receipt /home/daon/.local/share/anvil-v3-qa-receipts/ix01-journey-20261104-j1. UID1000·owner IX01_JOURNEY_20261104_J1. 임의 대상·fallback은 금지한다.

고정 Node24.22.1 realpath /opt/node-v24.22.1-linux-x64/bin/node 및 SHA e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e, image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f. 자동 pull/build/toolchain 설치0. 정확 최종 execution commit·script/manifest/package/lock raw hash는 후속 실행안에서 동결하며 임의 HEAD를 허용하지 않는다.

## 순서·보호 계약
1. 전체 승인 발급 후30분 기한·exact Git commit/clean·SQL105 원문/hash/order/2376141B·Node/image/daemon·UID·새 literal 경로 부재·부모 owner/realpath/nonlink를 검산한다. 중간 symlink와 기존 namespace를 거절한다. /tmp 부모만 root sticky1777의 명시 예외이며 새 하위는 UID1000/0700이다. 보호 receipt의 기존 intent는 중복 실행을 거절한다.
2. 단발 intent를 원자 exclusive 생성한 후만 효과를 시작한다. 신규 QA 소유 디렉터리/빈 전용 npm·Docker config/cache만 사용한다. 고정 package-lock의 npm ci --ignore-scripts --no-audit --no-fund를 정제 환경과 전용 user/global config로 수행하며 기존 사용자 npmrc/토큰·cache를 읽지 않는다. lifecycle script/설치 fallback0. 성공 여부와 설치 소유 범위를 확인한다.
3. PG는 network none·host publish0·named volume0·새 tmpfs로 시작한다. R9의 원 provider owner·0037만 atomic transaction·0066/0073 선행 역할·정확 회수 검사를 보존한다. 원문 SQL을 바꾸거나 전체를 transaction으로 다시 감싸지 않는다. 명시105를 배열 순서대로 실행한다.
4. 각 SQL 성공 정착 뒤에만 실제 anvil.schema_migrations(id,checksum)에 해당 원문 값을 기록한다. 0000이 표를 생성한 다음부터 기록한다. 실패/미정착 SQL의 원장 기록0. SQL commit 후 ledger 기록 실패는 UNKNOWN 공백이며 재설치/보충/재개0. 최종 ledger 집합과 순차 영수증을 별개로 검산한다.
5. 신규 QA에서만 합성 bootstrap/app/migrator password 각64hex를 사용한다. 값은 argv/보고/감사/raw stderr에 출력하지 않는다. 네트워크 격리 중 SCRAM host 인증·password 설정·HBA를 검산하고 설치용 CREATEROLE/임시 ADMIN membership을 회수한 뒤 새 --internal network를 생성/연결한다. host trust·기존 network 연결·임의 IP fallback은 금지한다. exact ID/name/label/Internal·no publish·단일 전용 PG172.16~31 IP를 검산한다. 실제 자격증명과 권한 설정은 미래 별도 실행 승인 대상이다.
6. 새 artifact root0700/owner.json0600의 기존7키 계약과 계획14키·sourceFiles 원문지문·migrations ordered hash를 기존 실제 integration에 전달한다. 기존 test90초/plan최대10분과 전체30분 중 짧은 기한을 사용하며 정리 여유를 확보한다. 기존 test를 직접 소비한다: tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts. 원 key/token/ref·재접속/음성·guard를 그대로 유지한다. shell output 최대64KiB, SQL raw diagnostics는 저장/출력하지 않는다.
7. child exit0만으로 성공 처리하지 않는다. TAP 요약 tests1/pass1/fail0/cancelled0/skipped0/todo0·출력 완전성·deadline·현재 소유 및 최종 역할 메타데이터 검산 뒤에만 명확 성공으로 판정한다. nonzero/timeout/signal/output overflow/receipt 유실은 고정 TEST_NONZERO/TEST_TIMEOUT/TEST_SIGNAL/TEST_OUTPUT_UNKNOWN 코드의 UNKNOWN이다. 이후 DB조회·권한 mutation·네트워크/컨테이너/파일 삭제·재실행0. 자식 자신의 finally는 원 app/pool 종료만 수행한다. 부모가 불명 결과를 정리 성공으로 바꾸지 않는다.
8. 명확 성공과 정확 owner/fullID/image/mount/network/process 정착 확인 후만 등록 QA를 정상 종료·회수한다. 실패도 확정인지 불명인지 구분하며 안전하지 않으면 보존한다. 감사 owner/intent/result는 보호 보존한다. 현재 runner cwd인 source checkout은 부모가 지우지 않고 Main의 별도 process0 검산 후 정리 대상으로 남긴다. 실행 자원과 source/npm 잔여를 따로 보고한다.

## 검증·작업 순서
- [ ] 신규 unit RED를 먼저 작성/실행하고 최소 구현한다. 순수 ports만 주입하며 외부 실행0이다.
- [ ] SQL 실패/불명 ledger0, commit→ledger 공백 UNKNOWN/no retry,105 순서/raw hash/0037 원자 옵션, 원 역할 회수 이전 child0, 잘못된 IP/root/owner/plan/deadline child0을 검산한다.
- [ ] 기본/plan/import effect0, intent 재사용 거절, 모든 child UNKNOWN 뒤 후속 효과0, 명확 성공의 exact cleanup 순서와 소유 불일치 보존을 검산한다. 실제 builder/parser가 실제 port/controller에서 소비되는 선도 검수한다.
- [ ] focused unit·필요 typecheck·Bash 문법·diff만 실행한다. 기존 불변 시험 반복·실제 integration opt-in·새 실행 시각 발급0.
- [ ] 정확 diff/hash/명령/exit/오류 횟수/미검증·writer 반환/live0을 Main에 제출한다. 미완성 adapter/TODO/효과 없는 포트를 실제 준비 완료로 보고하지 않는다.

현재 실제 PG/DML/RLS/API 여정·네트워크/합성 인증·브라우저·OS process restart는 NOT_RUN이다. 기존 대표 시험의 methods[0]은 내장3방법론 전체를 증명하지 않으며 IX01/전체 계획 완료로 승격하지 않는다. 실제 실행안·정확 자원·비밀 없는 감사와 새 직접 결정은 source 검수 후 별도로 동결한다.
