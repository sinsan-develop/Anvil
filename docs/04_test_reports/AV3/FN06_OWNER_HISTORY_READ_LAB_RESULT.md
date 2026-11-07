# FN06 OWNER 이력 조회 한정 검증 결과

## 판정

수정 후 새 격리 PG의 OWNER 인증 API→기존 Webreader 조회를 확인했다. 실제 served 브라우저·실Agent/Provider 관측과는 다르다. 전체 FN06·Stage·작업계획은 미완료다.

|실행|실제 결과|정리|
|---|---|---|
|b42aae6b 최초 HISTORY_READ|exit1·Webreader 목록 GET 소비 경계 실패, 원인 미확정|독립 SSH 잔여0·정식3 불변|
|d07916c3 원 query 전달 진단|exit1·CLAIM_OWNER_SESSION_LEDGER_LOCK_FORBIDDEN; 지정 session/command 잠금 SELECT에서42501|독립 SSH 잔여0·정식3 불변|
|ad5cd1d2 최소수정 HISTORY_READ|exit0·정상seed1회→OWNER목록/정확receipt·타인/무쿠키거절·조회6원장무변경|독립 SSH exit0·exactID/ownerlabel/root/runner잔여0·정식3 fullID/image/StartedAt불변|

ad5 PG 1e1ff7ceca16163be7cac4234dad6ddf327d4196b79eb040462fb625858ab05d / net 0b5b2dc3c9c5b71b3c98e4e899f1264052b8ca0f191d8be1e126fde35a21c62f / run732681fcf4f8a1604ea4cd2c22d108b0. child phaseDONE/failurenull·rawfiles2/dirs5·close0/rootCleanupFailedfalse·runnerfailurefalse/cleanupFailurefalse·bootstrap0safe1path0이다.

실측 marker는 FN06_OWNER_HISTORY_LIST_RECEIPT_SAME_ORIGIN / FN06_HISTORY_OUTSIDER_NOCOOKIE_DENIED / FN06_HISTORY_GET_NO_LEDGER_WRITE / FN06_NORMAL_REGISTRATION_RESERVATION_SIGNED_START이다. base59/pendingEB4 등록0·명시합성sourceOS·actualProvider/currentOSfalse/formalApplyReadyfalse/formalDbChanges0/actualAgentCalls0을 유지했다. schema/ATOMIC/replaycase 반복0이다.

d079 PG ca7ff199545635ffefdf4a70c7884bbc694209a3a24d0d1aaeb23b6faac85196 / net a6f8e6d0ee0e5efbf8deb56470841e849e29b5004cb35ebf92f2088d5cbe250a / run6de3b6b270050e985acb11afaafcc26a.
child close0/rootCleanupFailedfalse·runner failuretrue/cleanupFailurefalse·bootstrap status1/safe1/path0.
원 SQL/인자는 변경하지 않았으며 원 오류·본문·cookie·키를 출력하지 않았다.

## 원인과 보완

0016의 예약 원장은 고유키·UPDATE/DELETE 권한 회수와 INSERT외 불변 trigger로 보호된다. 기존 이력 조회는 이 원장에도 FOR SHARE를 요청했다. commands의 완전불변은 가정하지 않는다.

ad5cd1d2d909a50508331fad866dd0f685ccc579는 **FOR SHARE OF s,c → FOR SHARE OF c**만 변경했다. 현재 사용자·세션·client·project/member 잠금, OWNER 검사·hash/정확원예약/명령 APPLIED·반복 현재성·기존30초응답창은 유지한다. 새 GRANT·migration·서비스/Secret 변경0이다.

최소권한 반례 RED→GREEN 및 command잠금 보존 반례 RED→GREEN. 최종 store/HTTP/history/page/client26 PASS1313.3869ms·typecheck/diff0·독립 C0/I0/M0. 이는 통제 DB경계/HTTP와 source 검증이며 수정후 실제 PG/served 브라우저 PASS가 아니다.

## 다음과 제외

이 한정 조회 검증은 추가 반복하지 않는다. 실제 화면·실Agent/native/Provider 연결·nonOWNER 현재책임관계와 전체 계획은 남아 있다. 다음은 독립 구현 가능한 FN10 절차 진행과 승인/대기 연결 공백을 기존 source·계획으로 대조한다. 정식 DB·서비스·비용/P2/P3 제외는 유지한다.
