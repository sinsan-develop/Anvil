# FN02 백업 사전 metadata 관측 — dump·복원·DDL 미실행

2026-10-20 / Main 어울 / branch codex/av3-stage-b.

## 판정

**OBSERVED_READINESS_METADATA_ONLY**. 도구/filesystem과 별도 migrator READ ONLY metadata를 각각 새 범위에서1회 확인했다. 실제 backup/restore/46→53/기존0012 거절 해소·사용자 기능 완료는 아니다. `dumpCapability: UNVERIFIED`, `executionAllowed: false`를 유지한다.

## 범위·source·로컬 검수

- 도구창 issued11:46:07Z/expires11:56:07Z(20:46:07~20:56:07KST),DB창 issued11:57:38Z/expires12:07:38Z(20:57:38~21:07:38KST)/신규접속마감12:05:08Z. 각1회/새판정·옛metadata허가 재사용/연장/retry0. 실제부족정보 확인만이며 인간의새backup/DDL직접결정은아직없다.
- DB source `95086727a8247e24490fa9493ff459de86238548`·reader05177F8B7E69B50FBEC17032630CD67C2D80BC44BBA8045FBC08703BC832C598·시험D1EF43BF53A4333CABA2E3FF1B9BF076E72830B93C40037F94F6C8B59A4F8F37·당시계약2BBF774AA0361AC5347AF5983B741D7FE9A4E80444D8869013B88DEBEF0913C8. 당시 계약 본문은95086727에보존했다.
- helper4함수부재RED127.2656ms→4PASS283.7163ms,caller1부재RED286.8225ms→전체5PASS1038.7087ms/typecheck0/--plan0·독립C0/I0/M0. fake정상/오류·Windows잘못된binding/쓰기mode거절과실DB의증거를구분한다.

## 도구·filesystem 실제 관측

11:48:04.600026Z(20:48KST) 실행exit0,daemon/안전정의/두version/복원이름부재각exit0. 기존PG에생성한짧은version프로세스2개외새resource0·SQL/config/Env/본문/로그0.

| 관측 | 실제 값 |
|---|---|
|pg_dump / pg_restore|둘 다 PostgreSQL15.18, Debian15.18-1.pgdg13+1|
|Node24.21.0 SHA256|7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c|
|/usr/bin/docker SHA256|7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b|
|보호root metadata|/home/daon/.local/share/anvil-v3-development, UID1000/0700/realpath/nonlink|
|가용 bytes|550560096256 — 공간 예약이나 dump 가능성 판정 아님|
|backup/복원container 이름|schema-adoption-01 / anvil-v3-schema-restore-verify-pg-01 둘 다 부재|

## DB READ ONLY 실제 관측

- 새Git `/home/daon/deploy/anvil-v3-fn02-readiness-01`와tmp `/tmp/anvil-v3-fn02-readiness-01/npm-cache`의부재/부모realpath/nonlink/owner·Nodehash확인후daon0700으로만생성했다. private95086727 shallow Git/clean·readerhash일치·lockfile `npm ci --ignore-scripts --no-audit --no-fund --cache <전용cache>` exit0/102packages. npm버전notice는자동업데이트하지않았다.
- `/opt/node-v24.21.0-linux-x64/bin/node scripts/fn02-backup-readiness.ts --read-only`를외부30초상한/발급expires로1회실행했다. 기존보호migrator.json O_NOFOLLOW·UID/mode/nlink/size검사후메모리소비/configHash a78daab0ab2d7f947091727803f6509730f2a01e0e0cbce423d8836990616497만출력·비밀원문/DSN/rawstderr0.
- BEGIN READ ONLY/timeout설정→고정migrator/DB·PG15/nonSuper/noBypass/noCreate신원→현재DBsize→다른connection의count/active/unknown만→anvil/anvil_qa표의owner/SELECT/RLS count만→COMMIT/close성공후출력. exit0/stderrBytes0. 본문·계정행/query텍스트·추가manifest/DDL/DML/seed0. 정확조회시각을따로stdout에출력하지않았으며발급창·전후기한검사안의1회관측이다.

| metadata | 실제 값 |
|---|---:|
|databaseBytes|18505063|
|otherConnections / activeConnections / unknownConnections|0 / 0 / 0|
|tables|81|
|nonOwnedTables / unreadableTables / rlsTables|0 / 0 / 0|

- 기존 PG fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba/image594290e9/daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e·StartedAt2026-10-20T11:21:54.792276193Z/running/안전정의개별필드는전후동일,rawhash양쪽1eb2552cc06201624d8ac4d983dc42871b2c700625399910bbb8d7bf4794a597이다. 앞선Mounts배열순서raw차이이력은별도결과서에서보존한다.

## 회수·한계·다음

- exactGit/source·clean/UID1000·nonlink/같은device·lsof열린process0·전체파일hash/inode/size/mtime를대조한뒤개별unlink·빈rmdir로등록두경로만회수했다. 7386files/1060directories/13links/191540500bytes,inventorySHA256 89cb54802c9845a63ed980e35f315c5474a7e6c6143e18039ba4b9159af5a080. 별도SSHexit0으로두경로부재/backup경로부재·PG같은ID/image/StartedAt running보존·3830=0/5546=1확인했다. 보호root/config·공유경로는회수하지않았다.
- 정상client.end()의resolve/성공후출력은확인했으나close실패·만료·OS파일교체/프로세스중단의실제음성은이실행으로증명하지않는다. 정상집계도일시적writer0의지속/DB전체객체완전성/pg_dump의실제접근가능성과복원성공을인증하지않는다. 기존46manifest도재조회하지않았다.
- 다음필수범위는민감dump의별도직접결정·consistent snapshot과보존fingerprint결박·분리PG의역할/ACL포함실제복원·원본기존컬럼projection보존비교·정식한TX7SQL/COMMITUNKNOWN의정확실행안이다. 기존0012실행거절과backup/restore/권한DDL경계를유지하며새직접결정전실행0이다.
