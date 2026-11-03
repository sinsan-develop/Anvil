# IX01 R4 slot1 실제 정의 설치 진단 결과

2026-11-04 · ACTUAL_DDL_FAILED · 추가 실행 금지

## 판정·실행 결박

새 R4 단1회는 Main 7282d2에서 exit1로 종료했다. 결과는 status=CLEANED / ddlStatus=FAILED / cleanup=CLEANED이다. 정의 설치 전체 성공이나 IX01 합격이 아니다. 원 R3 ROLE_PRISTINE/UNKNOWN은 별도 이력으로 보존하며 R4 실패로 대체하지 않는다.

- 실행 code: cd6b832289716e686d263b7f62a80a18499fb566
- SQL sourceHead: 0a647daa66103ada3bd5e949b64f407c3e7b5687
- 승인 packet SHA256: 6B77E436A84EE1710CDBA57806A0A2828DE146E9620F90DB3596F7A8027FF32E
- slot1 / instance cd6b832289716e686d263b7f62a80a18
- planHash e5b5bd6cb51ed78262c979e21390c3600ffd72fd2f6a58ce1b49c50ac774fa7b
- fullID e5fc0201acd0aaef43015748a2675395cca43f6d39acf245613f6d1c93f513c4
- issuedAt 2026-11-03T23:28:00.000Z / 전체 기한 2026-11-03T23:58:00.000Z
- slotExpiresAt 2026-11-03T23:43:14.472Z
- 결과 관측 2026-11-03T23:33:26.643Z
- stage db/migrations/0037_provider_session_claims.sql.pending / SQLSTATE42501 / statementEndLine22 / diagnostic=null

22행은 첫 provider_owner_preflight DO문 종료 위치이며 정확 원인행이나 오류 메시지를 수집한 것이 아니다. 0037의 CREATE TABLE은23행부터다. SQLSTATE만으로 개별 RAISE 메시지를 확정하지 않는다.

## 실제 도달·미도달

최종 PID1 관측·기존 ready·목표 DB pristine 역할 검산·bootstrap·installer 검산을 통과했다. 명시105의0037 이전 prefix가 정착했고0037의 첫 preflight에서 실패했다. 0037의 테이블/함수 정의와 이후 SQL은 미도달이다. 이후 역할/RLS/API/UI·전체 IX01/사용자인수는 검증하지 않았다.

beforeRevoke의 installer CREATEROLE=true에서 afterRevoke=false로 바뀌었고 systemHash는 db45d2b43a1646fb5fb8f4140ea5e983b7d8b81aac408fec98a77b6b57129c81로 불변이다. 별도 membership은0이며 revokeSqlHash 8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5이다. bootstrapSqlHash 56655e52ea2fc4cf23473084990b94320f527ea81997b644ccbdf3b712c472e5이다. provider 전용 writer 역할은 before/afterBootstrap 및 beforeRevoke의 비시스템 역할 목록에 없다.

## 원인 한정·다음 경계

Primary 읽기와 Main639695는0037:5~22의 별도 NOLOGIN/NOINHERIT owner·migrator 임시 ADMIN membership 선행, 같은 migration transaction 요구가 현 IX01 실행 준비에 없음을 확인했다. 기존 scripts/provider-claim-schema-isolated-qa.ts:19는 정확 역할 준비를,20은0037 전체 BEGIN/COMMIT을 명시한다. 현재 실패와 정합한 source 선행 누락이며 실제 오류 원문이 없어 직접 메시지는 미확정이다. SQL guard/권한을 완화하지 않는다. 다음 source 후보는 IX01_PROVIDER_OWNER_SETUP_SOURCE_CANDIDATE_20261104.md이며 아직 구현/실제 실행 승인 아니다.

## 정리·감사 보존

driver 결과는 컨테이너 stop/rm CLEANED를 기록했다. Main의 후속 source 정리 b48723은 EACCES를 만나 삭제 전에 중단했다. 이를 정리 성공으로 세지 않았다. 이후 Main cc32c1의 sudo 읽기 검산으로 감사 실물3의 bytes/hash를 확인하고,66fb69에서 정확 source clean·소유 프로세스 한정 scanned227/matched0을 확인한 뒤 등록한 R4 source만 삭제했다. 다른 프로세스 전역 부재를 뜻하지 않는다. Main5b5593의 2026-11-03T23:36:19.225Z 별도 SSH 관측은 정확 fullID/name/source 부재와 감사3 hash 동일을 확인했다. 로컬 DDL_R4_FINAL_METADATA_20261104.json(raw SHA256 4831F64CB0A25B1B59AFD0AD4179167F444316D5CA18F90A5423FD560A7F24C8)의 실물·시각·부재3값·감사3 hash를 대조해 인수했다. 이 정확 R4 실행자원 범위에서 최종 독립 잔여0이다. Main3de8b3은 local mirror6의 byte 동일·보호 untracked3 불변·afterRevoke CREATEROLE=false와 systemHash 동일을 추가 검산했다.

로컬 METADATA는 2026-11-03T23:34:52.353Z에 sourceExists=true, scanned246/matches0를 기록한 이전 읽기 스냅샷이다. 이후66fb69 source 삭제 증거와 시점을 혼동하지 않는다. 아래 사본의 실제 bytes/hash를 읽어 그 METADATA records와 각각 동일함을 검산했다. 원격 실물 검산은 Main cc32c1의 증거이며 Primary가 재접속한 것이 아니다.

| 감사 원본의 로컬 보존 사본 | bytes | SHA256 |
|---|---:|---|
|docs/04_test_reports/AV3/IX01/DDL_R4_SLOT1_OWNER_20261104.json|199|e38fc39d2759a8c8b9dd1300e4aba98b139554cb1a7b28fdb81237bbbbf3c311|
|docs/04_test_reports/AV3/IX01/DDL_R4_SLOT1_INTENT_20261104.json|414|a6a0806734a344077812fbf0ab9624093ccd99e534fa7af85855449dece75447|
|docs/04_test_reports/AV3/IX01/DDL_R4_SLOT1_RESULT_20261104.json|3361|71f719757d0c9e9a9b7b06afc56be86ccc6df8b1dbdf4bfa5740574f2f504940|

## 미검증·실행 소유

실제 실행·회수·source 정리는 Main 단독 소유다. 이번 Primary는 로컬 원본/소스 읽기와 신규 문서2 작성만 수행했다. 실제 SSH/DB/role/키/서비스/Agent/P03R3·새 QA/재실행0이다. 기존 DB·사용자권한·키·서비스는 변경하지 않았고 감사 원본3과 R1/R2 실패·R3 UNKNOWN을 보존한다. 전체 작업계획은 미완료다.
