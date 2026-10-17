# A-3 app checksum 누락 항목 한정 QA 결정 자료

## 판정·필요 결정

**새 실행 미승인/미실행**. 기존423032bc 단1회는 서비스8범주·26벡터/정리0을 확인했으나 app full46checksum 비교는 코드누락으로 미실행이다. 원JSON PASS와 검수미충족은 A3_PROTOCOL_QA_01_RESULT.md에 보존한다. 원1회는 소진했고 새 요청이 그 기록을 덮거나 소급PASS시키지 않는다.

- **권장 A:** 보완한 Node pg/app READ ONLY의46 checksum 비교만 새 빈 격리PG에서 확인한다. 기존 schema46/대상·역할·새4표0행·26벡터는 이 새검사의 선행으로 함께 확인하되, 완료된 service8범주/user/session/host등록·grant/credential/key/token 발급은 **반복하지 않는다**.
- 대안 B: 추가 actual 없이 이번 누락을 UNVERIFIED로 두고, 후속 실제API/연동 검수의 새 결정·새 후보가 이 검사를 포함할 때 확인한다. 자원 재생성은 줄지만 현재 A3 검수충족을 주장할 수 없다.
- 대안 C: 정식 개발DB 적용으로 바로 넘어간다. 현재 누락 검증과 별도 지속DB 승인 경계가 있으므로 권장하지 않고 이번 범위에 포함하지 않는다.

범위/비용·가역성: 신규 일회성 PG tmpfs/일반 bridge와 합성DB bootstrap/migrator/app 역할만 사용·정리한다. 일반 bridge의 기본 외부통신 가능성은 유지되는 위험이며 외부endpoint·실제Agent는 호출하지 않는다. 정식DB/서비스·실제 계정/권한/키/Secret·OS·Oracle/main은 변경하지 않는다.

## 정확 후보·수정 이유

기존 codex/av3-stage-b의 새 준비checkpoint40SHA는 최종 PMO 요청/WORK_STATUS에 고정한다. 과거423032bc/595349be/65aa91af 권한을 자동 승계하지 않는다.

- runner scripts/qa-source-read-protocol.ts SHA256 **A01C10A3373312106BD3132557DB69691BC4093A44F446F04C09BD931C9384F7**.
- vector tests/integration/FN08/source-read-sql-vectors.ts SHA256 **F5B0BFDB2FAE7407DDAD83792F6F8603D3FC0C33C66436AC6515814FB9147F7F**.
- guard scripts/source-read-protocol-qa-guard.ts SHA256 AADBE7241EDCCE87F61EF63AE6A06B9AE80D4E04FA82F1113FBDA8892BBEFDE2·변경0.
- SQL0008 SHA25626A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185·기존46SQL/제품코드/정식runner 변경0.
- CLI **--plan-sql-checksum-only / --run-sql-checksum-only**. marker **AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA**를 기존 ANVIL_A3_PROTOCOL_QA_APPROVAL에 넣고 별도 exact COMMIT/SQL_HASH/EXPIRES_AT/DAEMON_ID/DAEMON_NAME에 결박한다. marker·코드존재는 승인증거가 아니다.
- 실제 service 호출은 이 모드에서 건너뛰며 service:null/syntheticApiCredentialsIssued:false를 기록한다. 기존 --run은 과거기능으로 보존하되 이번 요청에서는 실행하지 않는다.

## 생성 전 자원·보호·정리 계약

| 항목 | 정확 범위 |
|---|---|
| 소유·환경 | Main 어울 / ssh WSL-server·uid1000·정식 Git /home/daon/deploy/anvil-v3 |
| Git | git@github-sinsan-develop:sinsan-develop/Anvil.git·기존branch의 새 승인exact SHA만 fetch/checkout clean·Windows복사/서버patch0 |
| daemon | /usr/bin/docker --host unix:///var/run/docker.sock·root socket/고정binary·DOCKER override0·ID e3349f1d-dbfc-478a-96d9-295bf6c6839e/Name SINSAN |
| image | postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425 / sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f·pull0 |
| 새 자원 | anvil-v3-a3-read-protocol-qa-pg / anvil-v3-a3-read-protocol-qa-net·driver bridge/Internal=false·현재부재이며 생성직전 재확인 |
| DB·port | 새 anvil_v3_a3_read_qa·127.0.0.1:5548:5432 단일publish·기존5546/3830미사용 |
| 저장 | /var/lib/postgresql/data tmpfs256MiB rw/noexec/nosuid·실mount대조·hostbind/volume/기존network·extra network0 |
| label | anvil.project=v3 / anvil.owner=A3_READ_PROTOCOL_QA / 이번 난수 anvil.instance |
| 인증 | 새 합성 bootstrap/migrator/app DB역할·합성난수password 메모리/SQLstdin/필요자식env만. 사용자/session/client/project/policy/host등록/grant/APIcredential/key/token 발급0 |
| 수명 | 결정시 고정 절대창 최대2h·단1회·연장/자동재시도/fallback0 |
| 정리 | fullID·이번project/owner/난수/image/실tmpfs/요청port/network 대조→이번container/net만즉시폐기·별도이름/ID/5548잔여0·기존PG metadata/Git 대조. 실제publish실패만으로정리막지않음. ID/신원불명·응답유실은광범위삭제0·보존/보고, 원failure/cleanupFailure 분리 |
| 제외 | 정식DB45/5546·3830/relay/TLS·실계정/사용자정책·보호키/Secret/인증서·rawstore/source/native/OS·실Agent/Oracle/main·실HTTP/browser인수0 |

## 실제 확인할 항목

1. 생성직전 새승인/절대창·private exact clean·module/46SQLrealpath/hash·socket/binary/daemon/image·새이름/5548부재를 검사한다.
2. 새 빈 PG/합성DB역할로 같은46schema 한COMMIT 뒤 별도 app **BEGIN READ ONLY**에 들어간다.
3. **SELECT id,checksum**의46행을 source manifest의 정확46 ID/hash와 대조하고 중복/누락/추가/알수없는ID·다른checksum을 거절한다. 이어 기존26벡터·새4표0행을 확인한다.
4. report.result.migrationChecksumsVerified=46/vectorCount=26, service:null/syntheticApiCredentialsIssued:false, failure/cleanupFailure null과 phase QA_SQL_CHECKSUM_ONLY_DONE을 확인한다. 실제결과가없으면 PASS로 쓰지 않는다.
5. exact정리/독립잔여0·기존PG fullID/image/started/restart·Gitclean을 대조해 이 새실행 증거만 기록한다. 원423 appchecksum 미실행을 소급 수정하지 않고 서로 다른 대상/증거로 남긴다.

## 로컬 준비 증거·미검증

checksum fixture tuple 표기오류3은제품RED가아니며 정정후실제누락 RED3→GREEN3/801.6535ms·type/diff0, 직접인접12PASS1120.3742ms다. 한정mode미지원 RED2→entry/guard/manifest10PASS1976.0623ms·type/diff0. 기존26벡터의 입력/기대값은 바꾸지 않았다. 실제 새PG/권한/SQL접속·한정mode의실정리/OS·전체기능은 아직 미실행이다.
