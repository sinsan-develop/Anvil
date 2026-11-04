# IX01 R5 slot1 실제 정의 설치 진단 결과

2026-11-04 · ACTUAL_DDL_FAILED · 승인 소진 / 재실행 금지

## 판정·실행 결박
신산님 call_b4accb1d737a4e4f891c4550dba796b8 ‘새 R5 QA 1회 승인’을 Main이 수행했다. a1d2f7 exit1, status=CLEANED/ddlStatus=FAILED/cleanup=CLEANED이다. 원R4의0037 실패를 PASS로 소급하지 않으며 원R3 UNKNOWN/R1·R2 실패도 보존한다. 이번0037 정의 설치 통과는 전체105/ownership/RLS/API/UI/IX01 합격이 아니다.

- 실행code21e9f48e538684c250c823be3af320c0c7f2f13b / SQL sourceHead0a647daa66103ada3bd5e949b64f407c3e7b5687.
- 승인packet316376EC23ACD159E9031705B5F28A5B35078CD171DFE141AA8DAE67055EEF8A.
- slot1/instance21e9f48e538684c250c823be3af320c0.
- issuedAt2026-11-04T00:07:40.000Z / expiresAt00:37:40.000Z / slotExpiresAt00:21:20.440Z.
- planHash9c2dc77f66faea4e54b816d5d62528abeeed24eaf923dd50b8d8a9fdbf5c7cb1.
- fullIDf76f781bb4882ceabd8e192fcbb30ec36a307c5d6f573524036291f348ee4cf8.
- 결과 관측:2026-11-04T00:11:28.745Z.
- stage db/migrations/0039_ownership_authority.sql.pending / SQLSTATE42883 / diagnostic FUNCTION digest / statementEndLine100.

## 도달·역할 회수
최종PID1/목표DB pristine·bootstrap/installer 검산을 통과했다. 선택0037은 고정 원문으로 psql single-transaction 실행을 마쳤다. provider owner는 NOLOGIN/NOINHERIT·비특권이고 afterBootstrap에 migrator 임시 ADMIN membership1이 보인다.0037 성공 후 beforeRevoke membership0, afterRevoke migrator CREATEROLE=false를 확인했다. systemHash는 모든 단계 db45d2b43a1646fb5fb8f4140ea5e983b7d8b81aac408fec98a77b6b57129c81로 동일하다.

선택bootstrapSqlHash0b7ce826447419a613ad2076036a6ccf47bbccebf37e5ab0acf391126d83d69a와 실제 소비 원문이 고정packet과 일치한다. 원SQL이 provider membership을 이미 회수해 마지막 revokeSqlHash는 membership 추가회수 없는8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5다.

이후0039의ownership_content_hash 정의에서 digest 함수를 해석하지 못했다.100은 함수 정의 문장 끝 위치이고 정확 내부 오류행/원문 메시지를 직접 수집한 것은 아니다.0039 정의 전체 및 뒤의 SQL은 미완료다. 함수 실제 호출/DML/ACL/RLS·제품여정은 미검증이다.

## 실행·정리 증거
-32acf5 local/private3ca8ff3b exact·trackedclean/보호3·packet316376EC 불변.
-1b0a28 00:08:34Z daon1000/SINSAN/새source·receipt·name부재/고정Node e32e2d16/image594290/daemon e3349f1d 일치.
-f8c366/소유75916→1f1aa2 00:10:19Z exact21e9f48e·clean·uid1000/0700·driverEE1795DA/testD078D025/indexD6B4.
-a1d2f7 actual 단1회 exit1/확정FAILED 뒤 역할회수·stop/rm CLEANED. 자동재실행0.
-2a450d 00:12:42.527Z exactfullID/name부재·sourceclean/소유·sudo 읽기전용proc230/match0 확인 후 등록한 새source만 제거. 권한변경0·감사3 raw보존.
-82c265 00:14:07.488Z 별도SSH exactfullID/name/source부재·감사3해시일치. 실행자원잔여0/감사root 의도보존.

| 감사 원본 사본 | bytes | SHA256 |
|---|---:|---|
|DDL_R5_SLOT1_OWNER_20261104.json|199|346bfc797e1d547d1b3fd9213b0aa952a00e63e6d8fe5e07e80c48b3a9ea50ea|
|DDL_R5_SLOT1_INTENT_20261104.json|414|af0b248aa7ce62f2c6b7cc73f119e0f698997233dd75e1b696eefe3854be82e0|
|DDL_R5_SLOT1_RESULT_20261104.json|4061|af8e8ab33d89530ae30d4e9994738ed2990b55b2bc5125b8fa4a14cd14987b88|

원본 사본·metadata/final metadata는 docs/04_test_reports/AV3/IX01/ 아래에 있다. 원격감사root /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r5 는 삭제하지 않는다.

## 원인 한정·후속 source 범위
Primary의 선택105 한정읽기와 Mainf0b511/ee4466/30bf1e는 실제 digest 호출이0039:99/250 두 곳이고 pgcrypto/digest 제공 선행이 없음을 확인했다.0017:312~313은 같은 canonical UTF8 bytes를 이미 builtin sha256로 처리한다. 함수 의존 누락은42883/FUNCTION digest와 정합하지만 원 오류문구/정확 내부 오류행은 미확정이다.

PG15 공식 [binary string SHA256](https://www.postgresql.org/docs/15/functions-binarystring.html)과 [pgcrypto digest](https://www.postgresql.org/docs/15/pgcrypto.html)는 binary bytes의 SHA256 bytea 반환을 정의한다. 같은 bytea/encodehex·nonce decode·guard를 보존하는 두 표현의 pg_catalog.sha256 사용을 기존계획 내 source-only 호환 보완으로 WI36BD1564에 고정했다. 확장설치·검색경로확대·사용자권한 변경은 하지 않는다. 현재 보완 구현·검수는 별도 진행 중이고 실제 PG 성공 증거가 아니다.

현재 R5 실행승인은 소진됐다. 새 SQL baseline/index/namespace·정확실행안과 새 직접승인 전 추가QA0이다. 기존 DB·권한·키·서비스·Agent·실자료·P03R3 변경0. 작업계획 전체는 미완료다.
