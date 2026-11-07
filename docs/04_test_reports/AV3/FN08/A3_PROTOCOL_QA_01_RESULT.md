# A-3 서비스·실PG protocol QA 01 결과

## 판정 → 이유 → 조치

**서비스/실PG 8범주·26 SQL벡터 확인 / 승인 검수 전체는 미충족 / A-3 전체 미완료**. exact423032bc의 새 격리 PG에서 실행은 exit0·원JSON status PASS/failure:null/cleanupFailure:null이다. 다만 실제 app READ ONLY 검사가 migration **46개 ID와 신규 ID 존재**만 검사하고 checksum열을 조회하지 않았으므로 결정자료의 **app full46checksum 대조는 미실행**이다. runner의 PASS와 이 미충족을 함께 보존하며 이전86 psql PASS를 상속하지 않는다.

Main은 실행 후 코드/증거 대조에서 이 검사 누락을 확인했다. 현재 승인1회는 소진했고 같은창/marker 재실행·원결과 소급PASS는 하지 않는다. 기존 실제 서비스8범주 증거는 유지하되, 누락 검사만 로컬 RED→GREEN으로 보완한 뒤 필요한 새 exact 검증 결정을 분리한다.

## 결정·사전 대조

- PMO AV3-PMO-A3-ISOLATED-PROTOCOL-QA: 직접 요청turn01a14ab9-384b-7a11-ae77-8dbd34315609 completedAt1792255231=2026-10-17T16:40:31Z→16:52:53Z/12분22초·최신7turn 직접답변/중지/거절/수정부재를 PMO가 대조해 신산님 직접 위임의 정확 권장A를 전달했다.
- 고정창2026-10-17T16:52:53Z~18:52:53Z(2026-10-18 01:52:53~03:52:53 KST)·단1회/연장·자동재시도·fallback0. 실제 wall duration은 별도 계측하지 않았으며 추정 수치를 쓰지 않는다.
- WSL-server uid1000/Node24.21.0, 정식 private Git /home/daon/deploy/anvil-v3에서423032bc87793049fad641cb54c0d45754df8860 clean checkout. 후속595349be/65aa91af는 실행하지 않았다.
- 16:54:57Z 사전 대조 exit0: module와46SQL realpath·기존45 manifest/newSQL·origin·HEAD/clean·고정daemon/root socket/root binary/DOCKER override0·image·새이름/5548부재·기존PG metadata/창을 검사했다. 출력의 status필드는 같은 객체의 Git status에 덮여 빈 문자열이었으므로 그 필드를 별도 PASS marker로 해석하지 않는다.
- full SHA256: runner08EAFEDD8AC7E0031779183C6B9B38954FB330501D2491C4AABA5F07A0C7C92F / guardAADBE7241EDCCE87F61EF63AE6A06B9AE80D4E04FA82F1113FBDA8892BBEFDE2 / flow3DAA97940325AA1BFE9FCA334DFC6778F9A4AB5F8A76B87C6A5DFCB31CB763A8 / SQL26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185.
- 준비 SSH 1회는 PowerShell 인용이 잘못되어 ssh.exe 시작 전에 긴 argv 오류로 실패했다. literal 인수로 동일 Git/plan 준비를 정정했고 그 전 원격 작업/actual0이었다. 이를 실제 --run 실패/추가 실행으로 세지 않는다.

## 정확 실행 명령·원 결과

~~~sh
env ANVIL_A3_PROTOCOL_QA_APPROVAL=AV3-PMO-A3-ISOLATED-PROTOCOL-QA ANVIL_A3_PROTOCOL_QA_COMMIT=423032bc87793049fad641cb54c0d45754df8860 ANVIL_A3_PROTOCOL_QA_SQL_HASH=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_PROTOCOL_QA_EXPIRES_AT=2026-10-17T18:52:53Z ANVIL_A3_PROTOCOL_QA_DAEMON_ID=e3349f1d-dbfc-478a-96d9-295bf6c6839e ANVIL_A3_PROTOCOL_QA_DAEMON_NAME=SINSAN node scripts/qa-source-read-protocol.ts --run
~~~

exit0 원JSON:

~~~json
{"status":"PASS","failure":null,"cleanupFailure":null,"phase":"QA_FLOW_AFTER_DIRECT_DML_IMMUTABLE_PERMISSION_DENIALS","diagnostic":null,"report":{"commit":"423032bc87793049fad641cb54c0d45754df8860","sqlHash":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","node":"v24.21.0","resource":{"container":"anvil-v3-a3-read-protocol-qa-pg","network":"anvil-v3-a3-read-protocol-qa-net","database":"anvil_v3_a3_read_qa","host":"127.0.0.1","port":5548,"image":"postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425","imageId":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","containerId":"9f6cbf2988654f6b64c9e2792a6a3582ff30c21a58dc352dec280d3687073242","networkId":"73d7188656daefa77d842803329d66ed4ff2683416ba5f0c74f04d161bb46a9b","instance":"d7e81b614459300c60fa3ae55d043f08"},"migration":{"id":"0008_source_read_observation","checksum":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","applied":true},"result":{"cases":["canonical-unicode-crlf-escape-safe-integer","unicode-expansion-supplementary-fold","relative-target-200-201-unicode-duplicates"],"transport":"CALLER_SUPPLIED_ISOLATED_PG","actualSchemaApplication":false,"grantOrCredentialIssued":false,"osVerified":false},"newTablesEmptyBeforeService":4,"service":{"cases":["committed-grant-exchange-permit-report-replay","one-snapshot-preserved","human-report-navigation-viewer-no-raw","explicit-revoke-history-kept","after-snapshot-failure-real-rollback","extra-authority-denied-before-consumption","viewer-grant-write-side-effects-zero","direct-dml-immutable-permission-denials"],"transport":"DIRECT_SERVICE_ACTUAL_PG","nativeOrOsCalls":0,"actualAgentCalls":0,"actualSocketTls":false,"cleanup":"CALLER_MUST_REMOVE_EXACT_EPHEMERAL_STACK"},"syntheticApiCredentialsIssued":true,"actualHumanAccountsTouched":false,"actualHttpTls":false},"resourceIdentity":{"containerId":"9f6cbf2988654f6b64c9e2792a6a3582ff30c21a58dc352dec280d3687073242","networkId":"73d7188656daefa77d842803329d66ed4ff2683416ba5f0c74f04d161bb46a9b","instance":"d7e81b614459300c60fa3ae55d043f08"},"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0}
~~~

## 실제 확인·미충족의 분리

- 새 PG15/전용 일반 bridge Internal=false·단일 loopback5548/tmpfs256MiB·bind/volume/기존network0. 기본egress가능성이 있는 승인 방식이며 외부 endpoint·Agent 호출은 하지 않았다.
- 비관리자 migrator의46 schema 적용/COMMIT 뒤 app 별도 READ ONLY에서26벡터(canonical7/Unicode6/targets13)와4표0행, 이어 direct service→PG8범주를 실행했다. 원 result.actualSchemaApplication:false는 vector함수 자체가 DDL하지 않는다는 필드이며 바깥 migration.applied:true/COMMIT과 분리한다.
- 8범주: grant/exchange/permit/보고/같은명령 replay; 유효 재서명 다른보고409/단일snapshot; OWNER 조회·VIEWER raw0; 완료이력 보존 및 미소비credential회수; 성공snapshot INSERT 직후 정확오류1회→snapshot0/credential미소비/audit원count rollback; extra권한422/미소비; VIEWER403/행수불변; app 직접UPDATE/DELETE42501.
- **미충족:** runSourceReadSqlVectors는 SELECT id만 사용했다. 46개 각각의 checksum을 app READ ONLY에서 재대조했다는 증거가 없으므로 이 gate는 UNVERIFIED다. 적용 source/hash·migrator guard와 이 별도 요구는 동일하지 않다.
- 합성 user2/session/client/project/policy/상태전용등록/readgrant3·합성메모리 P256/서버키/token만 사용했다. password/key/token은 Git/argv/로그/별도파일 원문에 남기지 않았다.
- 실제 HTTP/cookie/CSRF/TLS/browser·모든 교차project/기한/경합 음성·Windows native/OS/DPAPI/실source·Agent·정식DB적용/사용자인수·Oracle/main은 미실행/미완료다.

## 정리·보존

runner의 full ID/이번 project=v3·owner=A3_READ_PROTOCOL_QA·instance/image/실tmpfs/요청port/network 재대조 뒤 exact정리·cleanupFailure:null이다. 16:56:12Z의 단일container 조회도 resource:null이었고, 별도 16:56:31.875Z 독립 조회 exit0:

~~~json
{"check":"INDEPENDENT_POSTCHECK","now":"2026-10-17T16:56:31.875Z","containerIdAbsent":true,"containerNameAbsent":true,"networkIdAbsent":true,"networkNameAbsent":true,"listener5548":"","formalPg":{"id":"e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba","image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","startedAt":"2026-10-15T18:53:33.435483583Z","running":true,"restartCount":0},"head":"423032bc87793049fad641cb54c0d45754df8860","gitStatus":""}
~~~

이번 등록 일회성 stack만 제거했다. 기존 image·개발PG·보호자료는 보존한다.

기존 개발PG metadata는 전후동일이며 정식DB45/5546·3830/relay/TLS·실user/policy/key/Secret·rawstore·native/source/Agent/Oracle/main 변경명령0이다. metadata를 정식DB 전체자료의 완전동일 검수로 확대하지 않는다.

## Main 다음 작업·복구

원8c FAIL/직접원인 미확정·86 psql SQL한정PASS·N3 hostLabel Minor1을 보존한다. Main은 공통Node SQL검증의46 checksum 비교 누락을 좁은TDD로 보완한다. 이번권한/남은창을 재사용하지 않고 보정후보의 필요한 새실행결정을 분리한다. 코드복구는 해당diff의 일반revert 검토이며 DB reset/이력개작은 하지 않는다.
