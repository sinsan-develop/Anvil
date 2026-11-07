# IX01 수정 SQL의 단발 진단 r2 — 소스 준비
2026-11-04 · Main 어울

SOURCE_ONLY / ACTUAL_EXECUTION_NOT_AUTHORIZED

## 목적과 경계
첫 실행은0035 정의 설치에서22P02로 종료했고 권한 회수·QA 정리와 감사 보존까지 끝났다. 그 승인은 소진됐다. 이번에는 수정된 미적용 SQL 세 파일을 기준으로 새 실행안을 검토할 수 있도록 준비한다. 실제 PG 재실행·권한 부여는 하지 않는다.
기존 IX01의 설치 오류 확인을 위한 내부 검증 준비다. 제품 공개 API·데이터·로그인/승인/권한 계약을 추가하지 않으며 기존 실패를 통과로 바꾸지 않는다. source 준비 자체를 기능 구현·IX01 완료로 계산하지 않는다.

## 기준과 담당
- 기준 commit:7e9ab984d2dad98fed208a2473853409dde927b9.99e108에서 private exact/clean·main/보호3 불변을 확인했다.
- 기존 Primary만 다음3경로를 수정한다. Main은 같은 코드를 쓰지 않는다. 타인 변경·Main 문서·원장3·보호3은 보존한다.
  1. scripts/qa-ix01-schema-closure.sh
  2. tests/unit/IX01/schema-closure-controller.test.ts
  3. 신규 docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R2.tsv
- SQL 원문과 기존 r1 index(DC8B5FC0)는 수정하지 않는다. 새 의존성/도구·branch·세션·자동화를 만들지 않는다.

## 새 실행안 고정 값 — 아직 미승인
- SQL baseline:7e9ab984d2dad98fed208a2473853409dde927b9.
- 신규 source:/home/daon/anvil-ix01-ddl-20261104-r2-qa.
- 신규 감사 root:/home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r2 및 빈 docker-config.
- 신규 container:anvil-ix01-ddl-pg-20261104-r2-a1, DB:anvil_v3_ix01_ddl_20261104_r2_a1, owner label:IX01_DDL_20261104_R2.
- 향후 요청은 slot1 단1회다. 코드의 일반 slot 제약을 우회해2/3을 실행하지 않는다. 원 r1 감사·자원명을 재사용하거나 과거 QA를 조사/정리하지 않는다.
- daemon/image/UID·Node 지문·Unix-only/noSecret·networknone/port0·mount/권한·lognone·소유검산·기한·UNKNOWN 보존·role 회수/정리 기준은 유지한다. 이번 실제 환경 확인도 하지 않는다.

## 구현
1. 기존 driver/unit의 고정 baseline·자원명·index 참조를 r2 값으로 정합한다. 검사 기준·역할 권한·SQLSTATE 분류/다음slot 조건·원 기한/한도는 완화하지 않는다. 실패한 r1 코드는 Git과 실제 결과로 보존한다.
2. 고정 Git의 tracked SQL106개를 raw blob으로 읽어 새 index를 만든다. 표시 정렬은 적용 순서가 아니다. 기존 대비 원문 delta는0035/0071/0072 세 개·총8바이트이며 나머지103개는 hash/bytes가 같아야 한다.0031 중복 원형은 표시 목록에 보존한다.
3. 명시 선택105 경로·순서는 기존과 같고 orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef다. 새 selected SQL 합계2376115B. 원 schema_migrations 완료값/가짜 기록·본문 전처리/inline SQL·전체 자동 선택0이다.
4. 첫 오류에서 위치가 남지 않았던 진단 공백만 보완한다. 검증된 단일 ERROR줄에 psql:<stdin>:N: 접두가 있으면 유한한 양의 정수 statementEndLine만 추출한다. 이는 psql이 보고한 SQL 문장 끝 위치이며 함수 내부 원인 행이라고 하지 않는다. 접두가 없거나 모호하면null이다.
5. 원 SQLSTATE/실패 분류를 유지한다. 오류문장/DETAIL/CONTEXT/SQL본문/사용자값/Secret은 계속 버린다. 로그·감사 생략/원문 노출·일반예외 출력0이다. 새 숫자는 내부 QA 보고용이며 제품 공개 API 변경이 아니다.

## 최소 검증
- 기존34개 controller 경계를 보존하고 과거r1 baseline/cwd가 r2에서 claim/create 전 거절되는 반례를 추가한다.
- statementEndLine 유효/누락/잘못된 접두·상한/출력유실에서 원문 노출0·기존 SQLSTATE/UNKNOWN/cleanup·다음slot 판정 불변을 검산한다. 실제 psql builder/parser 소비선을 함께 쓴다.
- Node 순수/synthetic unit·필요한 타입·Bash 구문·diff/index 산술만 한다. 실제 --run/PG/role·원장/WSL/컨테이너·키·서비스·Agent/P03R3·실자료0이다.
- source3 최종 hash·diff·index/선택 합계/SQL delta·명령/exit/실제 미검증·livehandle0을 반환하고 동결한다. Main 독립 검수·private 게시 뒤 새 실제 실행 질문을 구체화한다.
