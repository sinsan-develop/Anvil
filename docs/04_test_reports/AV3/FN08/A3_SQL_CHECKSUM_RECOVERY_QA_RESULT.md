# A-3 checksum 복구 후보 한정 QA 결과

## 판정 → 이유 → 조치

**한정 PASS / 자원 정리·독립 잔여0**. 별도 승인된 exact ef19390c788cbf764ef5b5849540833222c1db07의 새 격리 PG에서 schema46 COMMIT·app READ ONLY 정확46 ID/checksum·기존26벡터·새4표0행을 확인했다. service:null·API credential 미발급으로 완료된 서비스8범주는 반복하지 않았다. 정식 DB/실제 HTTP·TLS·브라우저·OS·Agent 기능 또는 전체 A3/Stage 완료 증거는 아니다.

- 결정: AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA-RECOVERY. PMO 실제 요청 turn01a14aeb-d87e-7f51-bd88-3a98144984cc 완료17:33:19Z→실clock17:45:50Z/12분31초·최신4turn 직접답변/중지/거절/수정 부재를 확인해 전달한 정확 권장A.
- 새 고정창2026-10-17T17:45:50Z~19:45:50Z·단1회. **이번 결정 소진**. 연장·자동재시도·fallback·과거 f7 권한 승계0. env marker는 실행 식별자일 뿐 승인 증거가 아니다.
- WSL-server 정식 Git /home/daon/deploy/anvil-v3·uid1000·Node24.21.0. 17:47:37.943Z 생성 직전 private exact clean·46SQL/module realpath/hash·root Docker binary/socket·override0·daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e/SINSAN·image·새 이름/5548 부재·기존 PG·기한을 대조했다.
- runner C1703B4EA5E75518AD515C4E21EE8BD57FAD9CCC78DF7718C82792DDEEB39AF7 / guard D50B8C0E3B6E5BAE234D57B4B812258B00F7BEA8A1C8D51047171E17059A576D / vector F5B0BFDB2FAE7407DDAD83792F6F8603D3FC0C33C66436AC6515814FB9147F7F / SQL 26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185.

## 정확 명령·원 결과

~~~sh
env ANVIL_A3_PROTOCOL_QA_APPROVAL=AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA ANVIL_A3_PROTOCOL_QA_COMMIT=ef19390c788cbf764ef5b5849540833222c1db07 ANVIL_A3_PROTOCOL_QA_SQL_HASH=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_PROTOCOL_QA_EXPIRES_AT=2026-10-17T19:45:50Z ANVIL_A3_PROTOCOL_QA_DAEMON_ID=e3349f1d-dbfc-478a-96d9-295bf6c6839e ANVIL_A3_PROTOCOL_QA_DAEMON_NAME=SINSAN node scripts/qa-source-read-protocol.ts --run-sql-checksum-only
~~~

exit0. 아래 clientObservedSeconds는 Windows SSH 전체 왕복 Stopwatch이며 서버 시험 자체 시간과 구분한다.

~~~json
{"status":"PASS","failure":null,"cleanupFailure":null,"phase":"QA_SQL_CHECKSUM_ONLY_DONE","diagnostic":null,"report":{"commit":"ef19390c788cbf764ef5b5849540833222c1db07","sqlHash":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","node":"v24.21.0","scope":"SQL_CHECKSUM_ONLY_QA","resource":{"container":"anvil-v3-a3-read-protocol-qa-pg","network":"anvil-v3-a3-read-protocol-qa-net","database":"anvil_v3_a3_read_qa","host":"127.0.0.1","port":5548,"image":"postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425","imageId":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","containerId":"09b2b7a5f95de36feabf5a2961f6f6bd5a0404716c7398902749ee16a1a87f58","networkId":"85c8fd35de94213a6d1f1361f690134f8a969d065b8c033963d695ec6465512c","instance":"4def414a8393ee1f77eb137445c744ba"},"migration":{"id":"0008_source_read_observation","checksum":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","applied":true},"result":{"cases":["canonical-unicode-crlf-escape-safe-integer","unicode-expansion-supplementary-fold","relative-target-200-201-unicode-duplicates"],"migrationChecksumsVerified":46,"vectorCount":26,"transport":"CALLER_SUPPLIED_ISOLATED_PG","actualSchemaApplication":false,"grantOrCredentialIssued":false,"osVerified":false},"newTablesEmptyBeforeService":4,"service":null,"syntheticApiCredentialsIssued":false,"actualHumanAccountsTouched":false,"actualHttpTls":false},"resourceIdentity":{"containerId":"09b2b7a5f95de36feabf5a2961f6f6bd5a0404716c7398902749ee16a1a87f58","networkId":"85c8fd35de94213a6d1f1361f690134f8a969d065b8c033963d695ec6465512c","instance":"4def414a8393ee1f77eb137445c744ba"},"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0}
{"sshExitCode":0,"clientObservedSeconds":6.4962455}
~~~

result.actualSchemaApplication:false는 벡터 함수의 역할 표시다. 외부 runner의 migration.applied:true/COMMIT과 구분하며 벡터 함수가 DDL을 실행했다고 주장하지 않는다.

## 정확 정리·독립 확인

신규 이름 anvil-v3-a3-read-protocol-qa-pg/net·DB anvil_v3_a3_read_qa·일반 bridge/Internal=false·tmpfs256MiB·127.0.0.1:5548:5432만 사용했다. 외부통신이 가능한 일반 bridge 위험을 숨기지 않고 실제 외부 호출0·host bind/volume/기존 network 연결0을 유지했다. 합성 DB 역할/password만 메모리/stdin/필요 env로 사용했으며 user/session/project/policy/host/grant/API credential/key/token 생성0이다.

원 JSON의 container/network fullID·이번 instance/소유 label/name/image·실 tmpfs/요청 port/network를 재대조한 후 exact 정리했다. 별도 SSH 조회 exit0:

~~~json
{"check":"INDEPENDENT_POSTCHECK","now":"2026-10-17T17:48:35.132Z","containerIdAbsent":true,"containerNameAbsent":true,"networkIdAbsent":true,"networkNameAbsent":true,"listener5548":"","formalPg":{"id":"e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba","image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","startedAt":"2026-10-15T18:53:33.435483583Z","running":true,"restartCount":0},"head":"ef19390c788cbf764ef5b5849540833222c1db07","gitStatus":""}
~~~

정식 PG fullID/image/StartedAt/restart 불변·running true와 WSL exact clean을 확인했다. 정식 DB45/5546·기존3830/relay/TLS·계정/정책/key/Secret/인증서/rawstore/source/native/OS/Agent/Oracle/main 변경0이다.

## 남은 미검증·원 이력 보존

- 이번 정상 생성은 응답유실 recovery branch를 실제 발생시키지 않았다. 해당 branch는 로컬14시험·독립 C0/I0/M1 범위이며 실장애 회수 검증을 주장하지 않는다.
- 과거 생성 실패 직접원인은 미확정. 회복된 pg_isready 진단 잔존 Minor1도 이월한다.
- 원8c actual FAIL, 86 psql 한정 PASS, 423 서비스8범주 PASS와 checksum 검사 누락, f7 생성 FAIL/자동 cleanupFailure·별도 수동정리0은 그대로 보존한다.
- 정식 개발 DB는45이며46 적용·실제 API/served browser/OS·Agent 연결은 미완료다.
- 복구: 이번 QA 전용 자원은 제거돼 재사용하지 않는다. 기존 개발 DB/서비스 복원 조치가 필요한 변경은 하지 않았다. 로컬 source는 ef19390c에 보존한다.
- 다음 업무는 Main이 N4의 정식 schema46 반영 준비·필요 결정으로 선정한다. PMO에 다음 업무 배정을 요청하지 않으며, 지속 DB 변경은 새 정확 승인 전 실행하지 않는다.
