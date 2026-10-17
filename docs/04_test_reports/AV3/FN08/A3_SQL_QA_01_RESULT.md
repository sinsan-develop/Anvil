# A-3 격리 SQL QA 01 결과

## 판정 → 이유 → 조치

**FAIL / SQL·전체 A-3 미검증**. 승인된 단1회 runner는 신규 격리 PG 생성 뒤 `QA_SCHEMA`에서 exit1이었다. schema46/SQL벡터·새4표0행 검증에 도달하지 못했다. 원 출력의 SQLSTATE/위치가 없어 직접 원인을 확정하지 않는다. 허용1회 소진으로 재실행/새run/기한연장0, 로컬 진단 보완과 원 실패를 분리한다.

## 결정·후보·실행

- AV3-PMO-A3-ISOLATED-SQL-QA: PMO가 실제게시2026-10-17T15:31:37Z→15:42:34Z/10분57초·새답변/중지/거절/수정부재를 확인한 정확 권장A 전달.
- 고정창: 2026-10-18 00:42:34~02:42:34 KST·단1회, 실제 실행은00:45 KST 부근 종료.
- WSL-server uid1000/Node24.21.0, cwd `/home/daon/deploy/anvil-v3`, private origin exact `8c7d8e4af7760068c7f8461ca1f6fc33f9d92338` clean. 후속3d08c425 시험은 가져와 호출하지 않았다.
- SQL SHA256 `26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185`, runner `AF2A5E77D3B95181B75CFA378BDFFD5BEFA0486E7956C9DA78667223751C69FC`, guard `A272D48E0B524A6B127FAC47949FFF4EC32C7A9100BE0F10CF124CE891103944`, helper `6DA3AC4400D72BBF47209DE2F9CD2C6639670AB313BA317897B6CF80D86E519C`. WSL fullhash 일치.

```sh
env ANVIL_A3_SQL_QA_APPROVAL=AV3-PMO-A3-ISOLATED-SQL-QA ANVIL_A3_SQL_QA_COMMIT=8c7d8e4af7760068c7f8461ca1f6fc33f9d92338 ANVIL_A3_SQL_QA_SQL_HASH=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_SQL_QA_EXPIRES_AT=2026-10-17T17:42:34Z ANVIL_A3_SQL_QA_DAEMON_ID=e3349f1d-dbfc-478a-96d9-295bf6c6839e ANVIL_A3_SQL_QA_DAEMON_NAME=SINSAN node scripts/qa-source-read-sql.ts --run
```

exit1 원문:

```json
{"status":"FAIL","failure":"QA_STEP_FAILED","cleanupFailure":null,"phase":"QA_SCHEMA","diagnostic":{"failure":"QA_STEP_FAILED","pgCode":null,"sqlPosition":null},"report":null,"resourceIdentity":{"containerId":"062ee62c2bd03e0cdb2bf347ba842fc53bdac15fdf797188c9c477d422d51177","networkId":"8a76aa50dab70b61b553159632813f5bd5775280b405d2e74618ccbb849882be","instance":"870722c1d8681b888674fb92b1efbc1b"},"formalDbChanges":0,"actualAgentCalls":0,"actualOsCalls":0}
```

`QA_SCHEMA`는 bootstrap psql 뒤 migrator 접속/BEGIN/advisory lock을 나누지 않는다. migration loop 진입 시 별도 ID phase로 바뀌므로 기존45/신규SQL 본문 실행 증거가 아니다. SQL 결함·제품 오류·internal network의 hostloopback 문제 중 하나로 단정하지 않는다. A-2R 일반 network와 이번 internal network의 차이는 가설 후보다.

## 자원 정리·기존 보존

- daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e / SINSAN / Docker29.1.3, local socket·binary·PG image594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f 확인.
- 생성: anvil-v3-a3-read-sql-qa-pg/internal anvil-v3-a3-read-sql-qa-net/DB anvil_v3_a3_read_qa/loopback5548/tmpfs256MiB. 위 full ID/instance/label/image/mount/port/network 대조 후 finally exact정리, cleanupFailure:null.
- 별도 SSH `docker container ls -a --filter name=anvil-v3-a3-read-sql-qa-pg --format '{{.Names}}'`, `docker network ls --filter name=anvil-v3-a3-read-sql-qa-net --format '{{.Name}}'`, `ss -H -ltn 'sport = :5548'` 모두 exit0/출력없음. 등록 이름/WSL listener 잔여0을 독립 확인했다.
- 기존 anvil-v3-development-pg ID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba·동일 image·StartedAt2026-10-15T18:53:33.435483583Z/running/RestartCount0은 전후 동일하다. 정식 DB SQL·계정·정책·Secret 접속/변경0이며 이 metadata를 DB 전체 schema/데이터 검수로 주장하지 않는다.
- Windows3830·인증서/키/raw store·native/source/Agent·Oracle/main 변경0. 기존 QA image와 원실패 UI06 자료는 삭제하지 않았다.

## 후속

로컬 후속 보완(원 실제 판정과 별개): 알려진 transport/timeout 고정 분류와 connect/BEGIN/lock phase를 추가했다. HostConfig 요청 설정과 별개로 실제 NetworkSettings.Ports의 exact 단일 loopback5548을 실행 전에 확인하며, 포트 미공개만으로 소유 정리가 차단되지 않도록 cleanup에는 기존 identity 검사를 유지한다. 새 포트 검사 부재RED1→GREEN, guard/entry9PASS879.9883ms·fail/skip0/type/diff0. 한정 독립 읽기 C0/I0이며 Minor·실제 접속/정리·원 실패 원인·재실행 승인은 검수 밖이다. runner SHA A26BDF71C3AC909D1071EBA8225B8BC838ED0512B9FAA5B4C596BD9005015414, guard SHA250F1313A277832EDBCCFBDF40AD9999F65E936E43B7A09A3ADD2F4A677D2DD2. SQL은 원 hash 그대로이며 새 실제 실행0이다.

로컬에서 비밀 없는 Node transport code/timeout·SQLSTATE를 분리하고 connect/BEGIN/lock 단계를 좁힌다. 보완의 합성검증을 원 실제 FAIL에 소급하지 않는다. 새 실제 재현은 후보SHA/hash·정확자원·기한·유한1회로 별도 필요한 결정을 받아야 한다. 현재 창이 남아도 --run을 반복하지 않는다. API/현재권한·보고/credential COMMIT/rollback·실TLS/OS/UI11/A-3/Stage는 미완료이며 N3 hostLabel Minor1도 유지한다.
