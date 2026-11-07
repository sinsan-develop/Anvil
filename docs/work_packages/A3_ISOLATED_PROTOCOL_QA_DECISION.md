# A-3 서비스·실PG protocol 격리 QA 결정 자료

최신 실행 상태(2026-10-18): exact423032bc의 PMO16:52:53Z 결정에 따른 단1회는 서비스/실PG8범주·26벡터 PASS/정리·독립잔여0으로 종료됐지만 app full46checksum 비교가 미실행이라 결정 검수 전체는 미충족이다. 실행후 코드대조에서 누락을 확인했으며 원JSON PASS와 별도로 기록한다. 아래 미승인/생성전 문장은 당시이력이고 이번1회도소진·같은창/marker재실행0이다. 원문·제외·정리는 docs/04_test_reports/AV3/FN08/A3_PROTOCOL_QA_01_RESULT.md를 따른다. 후속 로컬 checksum 보완은 원 실행의 소급PASS나 새actual권한이 아니다.

## 판정·필요 결정

ACTUAL_NOT_AUTHORIZED. 원8c SQL QA FAIL, 후속86 psql 한정SQL PASS·정리0는 별도 이력이며 각 단1회 권한은 소진됐다. 이번 새 권한을 대신하지 않는다. Main이 선정한 다음 미완료는 실제 현재권한·새 허가/보고의 COMMIT·실패 rollback이며, 준비된 direct service→PG8범주만 새 빈 QA에서 확인한다.

- **권장 A**: 새 일반 user-defined bridge와 host loopback5548 전용 새PG에서 Node pg/direct service 합성8범주를 단1회 검증·exact정리한다.
- 대안 B: internal network를 유지하고 별도 Node QA image/container에 정확 소스/의존성을 구성한다. host port는 없지만 신규 image/build/소스 전달·추가 container 계약이 필요하고 준비 범위가 더 크다. 현재 후보는 이 방식을 구현하지 않는다.
- 대안 C: actual을 보류하고 SQL 한정PASS·service/권한/rollback 미검증을 유지한다. 정식 DB·서비스 반영/기능 사용가능 판정 없이 독립 승인 작업을 계속한다.

**새 위험/승인 경계**: 권장A의 새bridge는 internal이 아니므로 기본 egress 가능성이 있다. host publish는127.0.0.1:5548만이며 공인/다른 interface를 열지 않는다. PG에는 실제 사용자/Secret·소스 내용 없이 합성 자료만 두고 외부 endpoint/Agent 호출0이다. 기존 network/firewall/DNS/서비스 정의는 고치지 않는다. 앞선internal-only/psql 승인을 일반bridge나 새합성 credential 실행 권한으로 재해석하지 않고 정확 새결정을 요청한다.

## 정확 후보·hash

기존 codex/av3-stage-b의 최종 준비 checkpoint40SHA는 WORK_STATUS/PMO 최종 요청에 고정한다. dirty/다른module/다른SQL/기한·daemon 불일치면 생성0이다.

- runner scripts/qa-source-read-protocol.ts SHA25608EAFEDD8AC7E0031779183C6B9B38954FB330501D2491C4AABA5F07A0C7C92F.
- guard scripts/source-read-protocol-qa-guard.ts SHA256AADBE7241EDCCE87F61EF63AE6A06B9AE80D4E04FA82F1113FBDA8892BBEFDE2.
- flow tests/integration/FN08/source-read-protocol-flow.ts SHA2563DAA97940325AA1BFE9FCA334DFC6778F9A4AB5F8A76B87C6A5DFCB31CB763A8.
- SQL0008 SHA25626A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185·기존45SQL/정식runner/제품API코드변경0.
- 새 marker AV3-PMO-A3-ISOLATED-PROTOCOL-QA 및 ANVIL_A3_PROTOCOL_QA_APPROVAL/COMMIT/SQL_HASH/EXPIRES_AT/DAEMON_ID/DAEMON_NAME를 사용한다. 코드 marker는 승인 증거가 아니다.

## 생성 전 정확 자원 계약

| 항목 | 범위 |
|---|---|
| 소유/환경 | Main 어울 / WSL-server uid1000·정식privateGit /home/daon/deploy/anvil-v3 |
| Git | git@github-sinsan-develop:sinsan-develop/Anvil.git·기존branch 승인exactSHA만fetch/checkout clean·Windows복사/서버patch0 |
| daemon | /usr/bin/docker --host unix:///var/run/docker.sock·root소유socket·고정binary·nonempty DOCKER_*override0, ID e3349f1d-dbfc-478a-96d9-295bf6c6839e / SINSAN |
| image | postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425·ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f·pull0 |
| 신규stack | anvil-v3-a3-read-protocol-qa-pg / anvil-v3-a3-read-protocol-qa-net(driver bridge/Internal=false), 기존/추가network연결0 |
| DB/port | 새 anvil_v3_a3_read_qa / host127.0.0.1:5548:5432만·정식5546/제품3830미사용. 요청PortBindings와 실제NetworkSettings.Ports 단일loopback을 실행전검사 |
| data | /var/lib/postgresql/data tmpfs256MiB rw/noexec/nosuid·실mount검사·hostbind/volume0 |
| labels | anvil.project=v3 / anvil.owner=A3_READ_PROTOCOL_QA / 난수 anvil.instance |
| 수명 | 결정시 고정 절대창 최대2h·단1회·연장/자동재시도/fallback0·성공/실패즉시정리 |
| 임시역할/인증 | 새DB bootstrap/migrator/app·합성난수비밀번호. 사용자2(OWNER/VIEWER)·세션/client·프로젝트1·AUTO정책1·host등록1·source선언1·읽기grant3/그별도교환·메모리 P256/서버키·서명/임시token만. 실제계정/policy/key/Secret0 |
| 비밀보호 | 합성rawpassword/token/key는메모리/SQLstdin/필요자식env·Git/보고/argv/로그/별도파일원문0 |
| 정리 | fullID/이번owner·project·난수/image/실tmpfs/요청port/networkID·일반bridge재대조→이번container/net만폐기. 실제publish실패만으로정리차단0. 신원불일치/응답유실로ID미확정·정리불확실은광범위삭제하지않고보존/원failure·cleanupFailure분리·정확보고 |

## 수행 범위·실행 전후

1. 새 정확결정/기한·private exact SHA clean·실module/46SQLrealpath/hash·고정daemon/image·이름/port5548부재를 대조한다. 기존개발PG metadata/정식Git와사후대조하며기존DB SQL/data는조회·변경하지않는다.
2. 새 일반bridge/PG/tmpfs만 만들고 실제 단일loopback5548을 확인한다. 비관리자migrator로46schema 한COMMIT·별도appREADONLY26벡터/신규4표0행을 같은새대상에서 확인한다. 이전다른대상PASS를상속하지않는다.
3. 합성로그인·재인증/제어·AUTO정책·상태전용등록발급(grants변경0)을 선행한 뒤 direct service→실PG에서 아래8범주를 실행한다.
4. 완료/실패 모두 이번 fullID/label/image/tmpfs/요청port/network 검증 후 exact폐기, 별도container/network이름/fullID·5548listener잔여0을확인한다. 기존PG ID/image/started/restart동일·Gitclean과작업현황을남긴다.

## 8범주·합격 기준 (현재 미실행)

1. 새grant/교환/permit/UNVERIFIED observer-unavailable 보고·같은명령/같은보고 재확인, 권한/원snapshot·비밀없는receipt를원자저장한다. 실제OS 관측 성공으로승격0.
2. 새command/hash로 **유효하게 다시서명한 다른 보고**는 정확409 SOURCE_READ_REPORT_CONFLICT·원snapshot1보존이다. 잘못된hash/서명의422만으로충돌검증PASS하지않는다.
3. OWNER snapshotRef이동·VIEWER보호원문없음.
4. 보고완료grant회수는원snapshot이력유지, 별도의미소비grant도회수해revoked_at존재/consumed_at:null·permit401/412를확인한다. 이미소비된token실패만으로회수효과PASS하지않는다.
5. **성공한 snapshot INSERT 직후 정확1회 주입오류**가 발생한 것을 확인한 다음 snapshot0/credential미소비/audit원count의실제ROLLBACK을확인한다. 그앞단auth/SQL오류는해당PASS가아니다.
6. executionAuthorized extra키422·credential미소비.
7. VIEWER grant쓰기403·행수증가0.
8. app직접snapshotUPDATE/DELETE·scopeUPDATE·credentialDELETE42501, guard해제/관리자감사행삭제0.

이번실행은소유자실제브라우저·cookie/CSRF/HTTP/TLS, 교차project/기한/경합모든음성, source파일내용/OS/native/DPAPI·실제Agent·정식개발DB적용/사용자인수·Oracle/main을포함하지않는다. prepared direct service를HTTP E2E라고부르지않는다.

## 준비 검수·미검증

- 신규entry/guard부재RED4→GREEN4/1315.8152ms·type/diff0.
- 독립읽기C0/I2: 실제publish실패가cleanup까지막음 / rollback주입전실패도PASS가능. I1직접RED1·faulthelper부재RED2→Main보정후직접7PASS1371.8705ms/type/diff0. 보정은독립actual재현/C0I0재검수라고쓰지않는다.
- Main추가대조: 기존 broad보고변조assert는유효재서명409로, 이미소비된token회수는미소비grant회수/DBrevoked_at까지확인하도록준비했다. 아직서비스8범주PASS가아니다.
- 현재새actual자원/계정/credential0. 원8cFAIL/86한정SQLPASS·각권한소진·N3hostLabel Minor1·실제user/client교체/서비스/TLS/OS/Agent미검증을유지한다.
