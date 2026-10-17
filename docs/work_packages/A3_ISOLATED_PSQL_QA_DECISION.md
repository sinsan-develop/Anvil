# A-3 무공개 포트 psql 격리 검증 결정 자료

## 판정·필요한 결정

**새 실행은 미승인·미실행**이다. 원 8c7d8e4 단1회 실제 FAIL·정리0·권한소진은 A3_SQL_QA_01_RESULT.md에 보존한다. 이전 창이 남아도 재사용하지 않는다. Main이 선정한 다음 선행은 동일 SQL46·canonical/Unicode/targets의 실제 PG 검증이며, 이 문서는 준비 코드가 새 실행 권한을 대신하지 않도록 정확 범위를 고정한다.

- **권장 A**: 아래 별도 새 빈 internal PG를 생성하고, **컨테이너 내부 TCP loopback에 docker exec psql로 접속**해 schema46 1COMMIT·별도 app READ ONLY 벡터26/full checksum/새4표0행만 유한1회 검증·정리한다. host publish·일반 bridge·추가 image/container·소스 복사·network 완화가 없다.
- 대안 B: 기존 Node pg/host loopback5548 방식을 새1회로 재진단한다. 실제 포트 공개 guard는 보완했지만 internal-only publish 문제라면 다시 SQL에 못 도달할 수 있다. 진단을 위한 추가 생성 비용/실패 가능성이 있고 권장하지 않는다.
- 대안 C: actual을 보류하고 SQL·COMMIT 미검증을 유지한다. 정식 DB/서비스에는 반영하지 않고 독립 승인 계획을 계속한다.

가역성: 신규 tmpfs DB/container/internal network만 폐기한다. 기존 DB/서비스/계정·정책·키/Secret·인증서·볼륨/호스트 bind·Oracle/main은 접근·변경하지 않는다. 이 SQL 확인은 Node pg transport·HTTP/TLS·사용자 인증·credential/API transaction/rollback·OS/native/source·Agent 기능 확인이 아니다.

## 후보·실행 결박

기존 branch codex/av3-stage-b의 준비 checkpoint 40 SHA는 최종 PMO 요청에 고정한다. 미게시/dirty/다른 SHA는 실행하지 않는다. 원 코드 후보568e8571의 제품/SQL 의미는 변경하지 않는다.

- SQL0008 SHA256: 26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185 (기존45 SQL/정식 runner diff0).
- qa-source-read-psql.ts: 1D15E66334E5C386BCB2E87E09DE6A03EF3EE7625352C3EB887B8AA360C4B54A.
- source-read-psql-guard.ts: C6FBBB5F5564D2231D23DC150F53116B1A0959D410E7F8A3B67A52172130875E.
- source-read-psql-batches.ts: F8455B9883514BD5B32DB9A216F78A68287803B784F51705FD37683B8A97B0C6.
- 공통 SQL 벡터: 618D58DECDE4FAC3516867C872DC432A66E9F9E0EBFB51AFB10BB7A01F0C47BF.
- 독립 migration helper: 6DA3AC4400D72BBF47209DE2F9CD2C6639670AB313BA317897B6CF80D86E519C.
- 새 marker: AV3-PMO-A3-ISOLATED-SQL-QA-PSQL. ANVIL_A3_PSQL_QA_APPROVAL/COMMIT/SQL_HASH/EXPIRES_AT/DAEMON_ID/DAEMON_NAME로 exact 후보·SQL·유한창/daemon을 대조한다. marker/env는 실제 결정 증거가 아니다.

## 생성 전 자원 계약

| 항목 | 정확 범위 |
|---|---|
| 소유·환경 | Main 어울 / ssh WSL-server·uid1000·정식 Git /home/daon/deploy/anvil-v3 |
| Git | 기존 private git@github-sinsan-develop:sinsan-develop/Anvil.git에서 승인 branch/exact40SHA만 fetch·checkout clean, Windows 복사/서버 patch0 |
| Docker | /usr/bin/docker --host unix:///var/run/docker.sock, root 소유 real socket·고정 binary, nonempty DOCKER_* override 거절 |
| daemon | 기존 관측 ID e3349f1d-dbfc-478a-96d9-295bf6c6839e / SINSAN / Docker29.1.3, 생성 직전 재대조 |
| image | postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425, ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f, pull0 |
| container/network | 새 anvil-v3-a3-read-psql-qa-pg / 새 internal anvil-v3-a3-read-psql-qa-net, 기존/추가 network 연결0 |
| DB·연결 | 새 anvil_v3_a3_read_qa, 컨테이너 내부127.0.0.1:5432만. host publish/host listener0·5546/5548 미사용 |
| data | /var/lib/postgresql/data tmpfs256MiB rw/noexec/nosuid·실mount 대조, host bind/volume0 |
| labels | anvil.project=v3, anvil.owner=A3_READ_SQL_PSQL_QA, 난수 anvil.instance |
| 수명 | 실제 결정시 지정한 절대 유한창 최대2h·단1회, 한 번 검수 후 즉시 exact정리. 연장/재시도/fallback0 |
| 인증 | 새 bootstrap/migrator/app만·합성 난수 비밀번호 메모리/자식env/SQL stdin, Git/argv/로그/파일 원문0. 실 계정·Secret0 |
| psql | 동일 PG image 내 기존 psql, -X/no-password/quiet/no-align/tuples-only, 명시 내부TCP/user/DB·PGCONNECT_TIMEOUT5s, ON_ERROR_STOP/VERBOSITY sqlstate/SHOW_CONTEXT never/ECHO none/file stdin |
| SQL·출력 | migrator에서 고정46 SQL/hash·단일 transaction/lock/COMMIT. 별도 app READ ONLY에서 shared26벡터/full46checksum/새4표0. 성공 고정JSON 단1개·중복키 거절. 오류 SQLSTATE/고정분류만, stdout/stderr/SQL 원문 출력0 |
| 정리 | full ID·owner/project/난수·image/실tmpfs·host publish0·정확 networkID 대조 후 이번 자원만 폐기. 생성 응답 유실도 exact name 조회→full ID/이번 label 확인 없이 삭제0. 불일치/정리 불확실은 보존·원failure와cleanupFailure 분리 보고 |

## 실행·증거 순서

1. 정확 새 결정/후보·SQL/hash·절대 기한을 대조하고 기존/이번 QA 이름 부재, daemon/image·Git/module/46SQL realpath를 확인한다.
2. 신규 internal network·unpublished container만 생성한다. 실제 NetworkSettings.Ports가5432:null·추가port0이고 HostConfig publish0·정확 network만임을 확인한다.
3. 새 PG의 초기 역할/schema만 준비하고 비관리자 migrator를 내부 TCP로 접속한다. 고정46 원 SQL·checksum이 같은 단일 schema transaction을 COMMIT한다.
4. 별도 app 역할 READ ONLY transaction에서 target/version/non-superuser·46 fullchecksum·기존 동일26벡터·새4표0행을 확인한다. 성공JSON은 COMMIT 뒤에만 읽고 기대수치·정확키를 재검사한다.
5. 성공/실패 모두 이번 exact ID/label/image/mount/network/무공개port를 재대조해 정리한다. 별도 조회로 새 이름/네트워크·host listener변화0을 확인한다.
6. 기존 개발PG의 ID/image/started/restart·정식Git clean을 전후 비교한다. 이 metadata를 DB 전체 데이터 검수라고 주장하지 않는다. 정식 DB SQL/data·Windows3830/보호자료·native·Agent·Oracle/main 변경0이다.

## 준비 검증·가설의 한계

- batch 부재RED4→GREEN4, 중복 JSON marker 음성RED1→strict GREEN, entry/무공개port guard 부재RED4→최종 준비9PASS679.4322ms·타입/diff0. 이 수치는 PG/psql/실자원 PASS가 아니다.
- 원 Node 검사 입력·기대값을 변경하지 않도록 원 커밋의 함수를 메모리로 읽어 신규공통 query/params/expected26개 EXACT·기존 assertion 수용을 확인했다(PG0). stripTypeScriptTypes 실험 경고는 보존한다.
- 한 번의 patch는 기존 escape 표기 문맥 불일치로 적용 전 거절됐다. 실제 파일 원문을 읽어 좁은 파일만 정확 patch, 기존 SQL/기준 완화0이다.
- internal-only publish의 [Moby 원 개발자 사례](https://github.com/moby/moby/discussions/53256)는 요청PortBindings와 실제Ports가 다를 수 있다는 가설을 지지하나, Docker29.1.3 원 실패 원인의 실측 증명이 아니다. 해당 버전 raw 소스 조회404는 근거로 쓰지 않는다.
- [PostgreSQL15 psql 공식 문서](https://www.postgresql.org/docs/15/app-psql.html)의 stdin·no-psqlrc·ON_ERROR_STOP·sqlstate·quiet 옵션을 기준으로 준비했다. 공식 문서는 현재 실행환경 PASS가 아니다.
- 원FAIL/소진1회·N3 hostLabel Minor1·실PG/API/served/TLS/native/OS/source/Agent 미검증은 유지한다. 이 문서만으로 새actual/전체 A-3/Stage 완료·main 통합 승인은 없다.
