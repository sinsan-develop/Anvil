# A-3 checksum 한정 QA 01 실패·정리 결과

## 판정 → 이유 → 조치

**FAIL / 검사 미도달 / 수동 exact정리 후 독립잔여0**. exactf7bafbcb의 허용 단1회는 CREATE_ISOLATED_PG에서 QA_DOCKER_STEP_FAILED와 QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT로 종료했다. app full46checksum/26벡터·schema46 COMMIT은 미실행이며 PASS가 아니다. 원 실패·자동정리 실패를 그대로 보존한다.

생성 응답을 확보하지 못해 runner containerId는 null이었지만, 별도 읽기에서 이번 label/instance의 실행 중 container를 발견했다. fullID·label·image·실tmpfs·요청/실제 port·단일 network 일치가 입증된 뒤 기존 승인된 이번stack 정리 범위로 두 exact ID만 제거했다. 이 수동 정리가 원 run/cleanupFailure를 성공으로 바꾸지 않는다. 새run·SQL 재실행0, 이번권한도 소진했다.

## 실행 결정·범위

- AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA: PMO가 실제요청turn01a14ad3-8857-73d1-bcd6-c86cf7ee76e0 완료17:06:41Z→17:19:00Z/12분19초·최신4turn 직접답변/중지/거절/수정부재를 확인해 신산님 직접 위임의 정확권장A 전달.
- 고정창2026-10-17T17:19:00Z~19:19:00Z·단1회/연장·자동재시도·fallback0. 원423서비스8범주 실행은 반복하지 않았다.
- WSL-server 정식privateGit /home/daon/deploy/anvil-v3·uid1000/Node24.21.0·exactf7bafbcb1dd5f1a4f5edf45bea25346dab63e0c2 clean.
- 17:21:03Z 생성전 실제4hash·module/46SQLrealpath·45기존manifest/새SQL·daemon/root socket/binary/override0·고정image·새이름/5548부재·기존PG metadata·기한을 검사했다.
- runnerA01C10A3373312106BD3132557DB69691BC4093A44F446F04C09BD931C9384F7 / vectorF5B0BFDB2FAE7407DDAD83792F6F8603D3FC0C33C66436AC6515814FB9147F7F / guardAADBE7241EDCCE87F61EF63AE6A06B9AE80D4E04FA82F1113FBDA8892BBEFDE2 / SQL26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185.

## 정확 명령·원 결과

~~~sh
env ANVIL_A3_PROTOCOL_QA_APPROVAL=AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA ANVIL_A3_PROTOCOL_QA_COMMIT=f7bafbcb1dd5f1a4f5edf45bea25346dab63e0c2 ANVIL_A3_PROTOCOL_QA_SQL_HASH=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_PROTOCOL_QA_EXPIRES_AT=2026-10-17T19:19:00Z ANVIL_A3_PROTOCOL_QA_DAEMON_ID=e3349f1d-dbfc-478a-96d9-295bf6c6839e ANVIL_A3_PROTOCOL_QA_DAEMON_NAME=SINSAN node scripts/qa-source-read-protocol.ts --run-sql-checksum-only
~~~

exit1 원JSON:

~~~json
{"status":"FAIL","failure":"QA_DOCKER_STEP_FAILED","cleanupFailure":"QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT","phase":"CREATE_ISOLATED_PG","diagnostic":{"failure":"QA_DOCKER_STEP_FAILED","pgCode":null,"sqlPosition":null,"connectionCode":null},"report":null,"resourceIdentity":{"containerId":null,"networkId":"03988350ee1999ca17af6a23c7b76127782159fa887f77da6459391c55a7d960","instance":"23f9d84092549cb8f6f0e626042dcd51"},"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0}
~~~

Windows client에서 SSH 전체를 Stopwatch로 관측한 값(서버 시험만의 시간이 아님):

~~~json
{"sshExitCode":1,"clientObservedSeconds":48.3494619}
~~~

직접 원인: Docker 단계 실패라는 고정 분류만 남았다. 현재 wrapper가 원 exec 오류의 code/signal/status를 버려 timeout·daemon오류 등을 구분할 직접 증거가 없다. timeout이라고 확정하지 않는다. 실제 container가 생성됐으나 그 응답/ID 확보 실패 뒤 finally가 network만 제거하려 하며 container identity를 회수하지 못한 **자동정리 경로의 결함**은 코드와 잔여물로 확인했다. 이를 제품/SQL checksum 실패로 바꾸지 않는다.

## 잔여 식별·수동 exact정리

- 17:22:20Z 별도 읽기: container1972071ba5971c0302e037a44efe7a99e0c239f91074399e334b6eaa38a988a0·running·started2026-10-17T17:21:44.66114635Z·project=v3/owner=A3_READ_PROTOCOL_QA/instance23f9d84092549cb8f6f0e626042dcd51·image594290…42f·단일127.0.0.1:5548.
- 17:23:08Z 추가 읽기 exit0: network03988350ee1999ca17af6a23c7b76127782159fa887f77da6459391c55a7d960·이름 anvil-v3-a3-read-protocol-qa-net·bridge/Internal=false·같은label/instance·연결container는 이번fullID1개뿐. container이름/단일networkID·요청/실제publish·PublishAllPorts:false·Mounts:[]·HostConfig.Tmpfs 정확256MiB와 /proc/mounts 실제tmpfs rw/nosuid/noexec/size262144k를 대조했다.
- 17:23:40Z 정리 직전 fixeddaemon/root socket/binary/override0·fullID/이번label/name·image/실tmpfs/요청port/network를 다시 검사하고 container fullID rm -f → 그 network의동일label/ID/bridge/empty를다시확인→network fullID rm만 실행했다. 이름/glob·공유root·기존자원 삭제0.
- 원 DB tmpfs 자료는 이번 실패한 합성시험의 일회성 내용만 제거했다. 실제 사용자 자료가 아니며 복구를 위한 보존 대상이 아니다. 고정image·시험코드/실패근거는 남아 있다.

~~~json
{"action":"EXACT_MANUAL_QA_CLEANUP","now":"2026-10-17T17:23:40.445Z","removedContainerId":"1972071ba5971c0302e037a44efe7a99e0c239f91074399e334b6eaa38a988a0","removedNetworkId":"03988350ee1999ca17af6a23c7b76127782159fa887f77da6459391c55a7d960","instance":"23f9d84092549cb8f6f0e626042dcd51","originalRunStatus":"FAIL","originalCleanupFailurePreserved":true,"dbVerificationRetried":false}
~~~

별도17:24:01Z 조회 exit0:

~~~json
{"check":"INDEPENDENT_POSTCHECK","now":"2026-10-17T17:24:01.459Z","containerIdAbsent":true,"containerNameAbsent":true,"networkIdAbsent":true,"networkNameAbsent":true,"listener5548":"","formalPg":{"id":"e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba","image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","startedAt":"2026-10-15T18:53:33.435483583Z","running":true,"restartCount":0},"head":"f7bafbcb1dd5f1a4f5edf45bea25346dab63e0c2","gitStatus":""}
~~~

## 미검증·Main 다음 작업

원423 service8범주/정리0와 원checksum미실행,86 psql SQL한정PASS·8cFAIL/직접원인미확정·Minor1은 보존한다. 이번새단1회는 gate에 못 도달했으며 full46checksum/이새모드 실제거절·service미호출·전체수용은 미검증이다. 제품·기존SQL46/정식DB45/5546·3830/relay/TLS·실계정/권한/policy/key/Secret/cert·source/native/OS/Agent·Oracle/main 변경0이다.

Main은 새실자원 없이 생성응답유실의 exact identity 회수/정리 및 비밀없는 Docker code/signal/exit 분류를 좁은로컬TDD로 보완한다. 다른instance/image/network/port/mount·불명ID를 삭제하지 않는 거절은 유지한다. 실제 생성의 원인이 확정되지 않은 상태에서 timeout연장·새run·권한재사용을 하지 않는다.
