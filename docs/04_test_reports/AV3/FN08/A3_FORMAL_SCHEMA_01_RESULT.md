# A-3 정식 개발 schema-only 적용 결과

## 판정 → 이유 → 조치

**정식 개발 DB schema-only 반영 PASS / 사용자 기능·화면·OS 인수 아님.**
exact dbbdf0493e40ae74e713926ec1f0148355100fe5에서 기존45 migration/77표를 보존하며 새 0008_source_read_observation.sql 하나를46번째로 적용했다. 새4표는0행이고 seed/계정·역할 생성/실사용자 정책 자동부여/서비스 교체/실제 Agent·source 접근0이다. 새 표/함수·guard와 기존 app 역할의 새 표 한정 SQL 권한은 승인된 지속 효과이며 보존한다.

## 정확 결정·사전 gate

- AV3-PMO-A3-FORMAL-SCHEMA-ONLY. PMO가 요청turn01a14b08-ff3c-73e3-9dd7-60653b0f91a8 완료2026-10-17T18:05:15Z→실clock18:15:51Z/10분36초·최신4turn 직접답변/중지/거절/수정 부재를 확인해 신산님 직접 위임의 권장A만 전달했다.
- 새 고정창2026-10-17T18:15:51Z~20:15:51Z·단1회. **이번 결정 소진**, 남은 창의 재실행/연장/retry/fallback0. 기존 QA 창을 재사용하지 않았다.
- WSL-server 정식 Git /home/daon/deploy/anvil-v3·uid1000, private exact fetch/checkout clean 후18:18:28.725Z 코드·기한·46SQL realpath·기존 PG fullID/image/StartedAt/restart와 보호 migrator 파일 regular/nonlink/uid1000/mode600/realpath/hash를 대조했다.
- runner DF10173E935224074C2BF29F73ADBD9A984C560B88A4ED1B4DB7CE63158D71CB / guard BFB23E6185A1E6D600050E615998234E9252FBA6A57AE1C0919A2BFF48BDDBEF / test0915F241DC5801A1A739D2D7FC48373B927D31382DD5BFA85FDB822300B0C757 / SQL26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185。
- 보호파일은 승인된 기존 migrator.json 접속에만 사용했고 원문 출력/복사/수정0. 기존 Secret 원문·DB row 원문은 보고서에 포함하지 않는다.

## 명령·원 결과

~~~sh
cd /home/daon/deploy/anvil-v3
env ANVIL_A3_APPLY_APPROVAL=AV3-PMO-A3-FORMAL-SCHEMA-ONLY ANVIL_A3_APPLY_COMMIT=dbbdf0493e40ae74e713926ec1f0148355100fe5 ANVIL_A3_APPROVED_SQL_SHA256=26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185 ANVIL_A3_APPLY_EXPIRES_AT=2026-10-17T20:15:51Z ANVIL_DB_CONFIG=/home/daon/.local/share/anvil-v3-development/migrator.json node scripts/apply-source-read-development.ts --apply-schema-only
~~~

exit0. clientObservedSeconds는 Windows SSH 전체 왕복 관측이며 DB transaction 자체 시간과 구분한다.

~~~json
{"status":"PASS","commit":"dbbdf0493e40ae74e713926ec1f0148355100fe5","migration":{"id":"0008_source_read_observation","checksum":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","applied":true},"legacyMigrations":45,"appliedMigrations":46,"existingTables":77,"legacyBaselineHash":"33b75c68d3633f431aa13727f1e186efbf6e002dfecada12e1a85c2e7b3c4760","newTables":["source_read_grants","source_read_challenges","source_read_credentials","source_snapshots"],"newTableRows":0,"seeded":0,"usersCreated":0,"serviceChanges":0,"sourceFileAccess":0,"actualAgentCalls":0,"actualHttpTls":false}
{"sshExitCode":0,"clientObservedSeconds":3.3295601}
~~~

단일 transaction/advisory lock 안에서 정확45 ID/checksum·옛77표 논리구조/권한과 행수/fingerprint를 저장했다. 새 SQL 뒤77표의 논리구조/권한, schema_migrations를 제외한76표의 행수/fingerprint 불변·새4표0·정확46 ID/checksum을 검사했다. schema_migrations는 새1행 증가를 허용하고 전체 지문 불변 검사에서는 제외하므로 과거 적용시각 열의 개별 불변을 별도 실측했다고 주장하지 않는다. COMMIT 뒤 별도 migrator connection의 READ ONLY transaction으로 같은 검수를 통과했다. 내부 FK trigger는 새 참조에 수반되므로 옛 논리표 계약과 구분한다.

## 독립 사후 확인

별도 SSH READ ONLY에서 migration46/새 checksum/새4표0행만 확인했다. 옛77표 전체 검사를 반복하지 않았다. 기존 PG metadata/보호 config hash·Git clean 대조 exit0:

~~~json
{"status":"INDEPENDENT_FORMAL_POSTCHECK_PASS","now":"2026-10-17T18:19:38.526Z","migrations":46,"newChecksum":"26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185","newTables":[{"name":"source_read_grants","count":0},{"name":"source_read_challenges","count":0},{"name":"source_read_credentials","count":0},{"name":"source_snapshots","count":0}],"configHashUnchanged":true,"pg":{"id":"e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba","image":"sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f","startedAt":"2026-10-15T18:53:33.435483583Z","running":true,"restartCount":0},"head":"dbbdf0493e40ae74e713926ec1f0148355100fe5","gitStatus":""}
~~~

Windows 별도조회 exit0:
~~~json
{"status":"WINDOWS_POSTCHECK_PASS","protectedHashesUnchanged":10,"node":23836,"relay":26052,"listener":"127.0.0.1:3830","now":"2026-10-17T18:19:33.8511123+00:00"}
~~~

auth/db-app·개발 CA/leaf/key/receipt·기존 runtime receipt 등 보호10파일 hash가 적용 전과 같고, Node23836/relay26052의 executable·정확 시작 UTC ticks·단일 loopback3830 소유를 대조했다. 프로세스를 재시작하거나 Web bundle을 교체하지 않았다.

## 잔여·복구·다음 기능

- 새 migration/4표/함수·한정 SQL권한은 개발용 지속자료로 보존한다. 일회성 PG/network/계정/fixture·폴더를 새로 생성하지 않아 정리 대상0이며 기존 QA 자원을 재생성하지 않았다.
- COMMIT 응답유실/UNKNOWN·rollback 실패·timeout·소켓 종료 실패 branch는 이번 정상실행에서 발생하지 않았다. 로컬11PASS·독립 scoped C0/I0/M0와 실제 정상 반영 증거를 구분한다.
- 과거 격리 FAIL/원인 미확정·Minor1은 그대로 보존한다. 실제 정식 HUMAN grant/보고·HTTP/TLS/served UI/OS·Agent·전체 A3/Stage/사용자 인수는 미완료다.
- 현재3830은 원 Node/기존 bundle이다. DB 반영만으로 새 UI/기능을 사용할 수 있다고 보고하지 않는다.
- 복구: COMMIT 후 자동 drop/과거SQL rollback/reset0. 후속 오류는 상태·원자료를 보존하고 별도 forward 보완 결정을 요청한다. 이번 성공은 기존 자료/서비스 복원을 필요로 하는 변경을 하지 않았다.
- Main 다음 선정: 새 API·UI11/기존 Stage B 화면 후보를 정식 개발 서비스에 연결하기 위한 정확한 코드/asset·환경/원문 보관소 참조·교체/복구 준비를 대조한다. 기존 SERVED02 플랫폼 거절을 재사용/우회하지 않으며 서비스 교체·실제 계정/권한/QA 여정은 필요한 정확 범위를 PMO에 요청한다. PMO의 다음 업무 배정 대기가 아니다.
