# A-3 무공개 포트 psql SQL QA 01 결과

## 판정 → 이유 → 조치

**한정 SQL 검증 PASS / 전체 A-3 미완료**. exact86bae1e7의 새 빈 internal PG에서 비관리자 migrator가46 SQL을 한 transaction으로 COMMIT했고, 별도 app READ ONLY에서 같은26벡터/full46checksum/신규4표0행이 통과했다. 실제 단1회는 exit0/9.2276259s, 원 failure/cleanupFailure null이다. 생성 이름과 full ID의 독립 조회에서 잔여0·기존 개발 PG metadata 동일·Git exact clean을 확인했다.

원8c7 QA의 FAIL/권한소진은 그대로다. 이번 실행이 원 실패의 직접 원인을 증명하거나, 실 API·credential 발급/현재성·rollback·Node pg transport·TLS·OS·Agent·제품 인수 PASS를 의미하지 않는다. 새 허용1회도 소진됐으며 같은 창/marker로 재실행하지 않는다.

## 결정·후보

- PMO AV3-PMO-A3-ISOLATED-SQL-QA-PSQL: 신산님 직접10분무응답 위임의 실제요청turn01a14aa1-eb30-7e32-885e-a7739b41c0de 게시완료2026-10-17T16:12:18Z→16:22:38Z/10분20초·후속직접답변/중지/거절/수정부재 대조의 정확권장A.
- 고정창2026-10-17T16:22:38Z~18:22:38Z·최대2h/단1회·연장/재시도/fallback0. actual은16:24Z 부근, 독립사후16:25Z.
- WSL-server uid1000/Node24.21.0, 정식 Git /home/daon/deploy/anvil-v3·private origin에서 exact86bae1e725898c59c39ad6c981980e4ae8b415ae fetch/checkout clean. 후속46f4/4d7 시험/현황은 실행하지 않았다.
- 실행 전 full SHA256 일치:
  - SQL0008 26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185.
  - runner1D15E66334E5C386BCB2E87E09DE6A03EF3EE7625352C3EB887B8AA360C4B54A.
  - guardC6FBBB5F5564D2231D23DC150F53116B1A0959D410E7F8A3B67A52172130875E.
  - batchF8455B9883514BD5B32DB9A216F78A68287803B784F51705FD37683B8A97B0C6.
  - vectors618D58DECDE4FAC3516867C872DC432A66E9F9E0EBFB51AFB10BB7A01F0C47BF.
- daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/SINSAN, root socket/고정binary/module·46SQL realpath·override0·image/name부재와 --plan 대조 후 생성했다.

## 정확 명령·원 결과

정식 Git cwd에서:

~~~sh
env ANVIL_A3_PSQL_QA_APPROVAL=AV3-PMO-A3-ISOLATED-SQL-QA-PSQL ANVIL_A3_PSQL_QA_COMMIT=86bae1e725898c59c39ad6c981980e4ae8b415ae ANVIL_A3_PSQL_QA_SQL_HASH=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_PSQL_QA_EXPIRES_AT=2026-10-17T18:22:38Z ANVIL_A3_PSQL_QA_DAEMON_ID=e3349f1d-dbfc-478a-96d9-295bf6c6839e ANVIL_A3_PSQL_QA_DAEMON_NAME=SINSAN node scripts/qa-source-read-psql.ts --run
~~~

exit0 원JSON:

~~~json
{"status":"PASS","failure":null,"cleanupFailure":null,"phase":"QA_PSQL_READ_ONLY","diagnostic":null,"report":{"commit":"86bae1e725898c59c39ad6c981980e4ae8b415ae","sqlHash":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","node":"v24.21.0","resource":{"container":"anvil-v3-a3-read-psql-qa-pg","network":"anvil-v3-a3-read-psql-qa-net","database":"anvil_v3_a3_read_qa","port":null,"hostPublish":false,"transport":"DOCKER_EXEC_PSQL_CONTAINER_TCP_LOOPBACK","image":"postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425","imageId":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","containerId":"3d3a5aefacc7b296bc8f5f79a07e324ea33eb1d3bfd12b215323eccbf5a899d6","networkId":"ea2f4cc3815d29a8fb5e8faec806c91183ad8a6e62e0b07c55fa10e975c0fc20","instance":"67d7f9b4cdff5e78529edd670123b100"},"migration":{"kind":"A3_PSQL_SCHEMA_COMMITTED","migrations":46},"vectors":{"kind":"A3_PSQL_SQL_VECTORS_DONE","vectors":26,"newTablesEmpty":4},"apiOrCredentialIssued":false,"nodePgTransportVerified":false,"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0},"resourceIdentity":{"containerId":"3d3a5aefacc7b296bc8f5f79a07e324ea33eb1d3bfd12b215323eccbf5a899d6","networkId":"ea2f4cc3815d29a8fb5e8faec806c91183ad8a6e62e0b07c55fa10e975c0fc20","instance":"67d7f9b4cdff5e78529edd670123b100"},"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0}
~~~

## 확인 범위

1. 실제 PG15 이미지594290e9…42f, 새 tmpfs256MiB·rw/noexec/nosuid·host bind/volume0, 단일 새 internal network, 요청/실제 host publish0.
2. 고정46 원 SQL/checksum을 비관리자 migrator 단일transaction에서COMMIT 후 성공marker; app 별도 TCP127.0.0.1:5432 READ ONLY로전체46checksum 조회.
3. 기존과동일 canonical/UTF8/CRLF/escape/safe정수7, Unicode fold6, target200/201·상대경로/중복음성13=26벡터. 신규source_read_grants/source_read_challenges/source_read_credentials/source_snapshots 각0행.
4. 합성 role/password·SQL은 메모리/자식env/stdin·Git/argv/로그원문0. 새 source-read grant/credential/API flow를 호출한 것이 아니다.

## 정리·기존 보존

- runner는 이번 fullcontainer3d3a5aef…899d6/networkea2f4cc3…c0fc20·owner A3_READ_SQL_PSQL_QA/projectv3/난수67d7f9b4cdff5e78529edd670123b100·image/실tmpfs/port/network를 재대조해 exact정리, cleanupFailure:null.
- 별도 SSH의 container/network 이름과 --no-trunc fullID filter조회 모두출력없음/exit0. 독립결과:
~~~json
{"newContainerNameAbsent":true,"newNetworkNameAbsent":true,"newContainerIdAbsent":true,"newNetworkIdAbsent":true,"formalPg":{"id":"e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba","image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","startedAt":"2026-10-15T18:53:33.435483583Z","running":true,"restarts":0},"head":"86bae1e725898c59c39ad6c981980e4ae8b415ae","clean":true,"formalDbSqlCalls":0}
~~~
- 기존 개발PG ID/image/started/running/restart0 전후동일. 기존정식DB45/데이터·실계정policy·키/Secret/TLS/3830·rawstore/native/OS/source/Agent/Oracle/main 변경명령0. metadata를 기존DB 전체schema/데이터 검수로 주장0.
- 신규host listener를 만들지 않았고5546/5548은미사용이다. 원8cQA자원도앞선읽기에서부재. 기존image·동결UI06실패자료는정리대상이아니다.

## 잔여·다음

SQL 파싱·함수·새4표생성·한COMMIT·별도appREADONLY 검증이 해소됐지만 **실제 현재권한·service/HTTP·grant/challenge/credential/report 원자COMMIT/실패rollback·경합·Nodepg/TLS·UI11 사용자/client교체·native/OS/source·Agent**는 여전히 미완료다. N3 hostLabel Minor1도 유지한다.

Main의 다음 미완료 선행은 준비된 source-read-protocol-flow의 격리 실제 서비스/DB 경계다. 기존internal psql 성공을 host/Nodepg 또는 API인증 성공으로 대체하지 않고, 필요한 새정확자원/transport·후보·실권한/합성자료·보호/정리·유한창을 분리해 결정요청한다. 이번1회를 재사용하거나정식DB/서비스를먼저변경하지 않는다.
