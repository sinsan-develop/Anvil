# 정식 개발 PG 단발 기동·스키마 metadata 조회 — 실행 범위 후보

2026-10-20 / Main 어울 / FN02 정식 반영 선행 확인. 이 문서 작성은 실행 승인이 아니다. 기존 소진 PG_ONLY_START_ONCE나 과거 API/Web 거절을 재사용하지 않는다.

## 목적·현재 상태

- 마지막 보존 migration46과 신규 helper의 선행52/최종53을 구분한다. 현재 live manifest는 미확인이다. 누락6개 자동 적용·0031 적용·옛 checksum 교체는 하지 않는다.
- PG는 마지막 관측 exited/ExitCode0/OOMKilledfalse, 종료 주체·원인은 미확정이다. 다른 소비자의 영향 여부를 생성/기동 직전 다시 확인하고 불명확하면 실행하지 않는다.
- 현재 코드/가짜 DB 시험은 조회 경계만 검증한다. 실제 스키마 정의 인증·사용자 기능 PASS가 아니다.

## 고정 대상·불변 비교

- WSL-server / daon UID1000 / `/usr/bin/docker --host unix:///var/run/docker.sock`.
- daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e` / SINSAN.
- PG full ID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba` / `anvil-v3-development-pg`.
- image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` / PG15.18.
- network `anvil-v3-development`, ID `d3253166eb1adc16fad8a22948b99321238860a74233e3e6318be027f248504e`; volume `anvil-v3-development-pgdata`, mount `/var/lib/postgresql/data`.
- 보호 bind `/home/daon/.local/share/anvil-v3-development/bootstrap-password` → `/run/secrets/bootstrap-password`, read-only. 비밀 내용·Config.Env 출력/조회는 하지 않는다.
- host port `127.0.0.1:5546` → `5432/tcp`, restart `no`; labels anvil.owner=P03, anvil.project=v3, anvil.instance=dc22a0629e79f259dcd935845e88e58e.
- 정규화 불변 정의 SHA256 `1eb2552cc06201624d8ac4d983dc42871b2c700625399910bbb8d7bf4794a597`: Id/Name/Image/Mounts/NetworkMode/PortBindings/RestartPolicy/NetworkIDs/anvil.* labels를 sorted compact JSON으로 비교한다. runtime IP/PID/StartedAt은 불변 hash에서 제외하고 별도 기록한다.

## 실행·수명·실패

1. 최종 source를 기존 private branch에 게시하고 정확 SHA/문서·source hash와 실행 결정 근거를 기록한 뒤에만 실행한다. 발급 시 issued/expires를 literal로 기록하며 전체 window 최대20분, 갱신·재시도0이다. 현재 발급 전이다.
2. exited 상태·불변 정의·owner·mount/link·network 소비자·5546/3830 listener를 확인한다. 다른 상태/대상 불일치 시 start0. 위 full ID에 `docker start` 한 번만 허용하는 범위다. DB 정상 시작에는 WAL/복구/통계 등의 내부 쓰기가 발생할 수 있어 물리 DB 쓰기0이라고 주장하지 않는다.
3. ready 관찰 최대120초: 동일 ID의 state 및 원문을 전송하지 않는 새 startup ready-log marker만 사용한다. 접속/조회 성공과 구분한다. 새 서비스·healthcheck·port/network 정의 변경0.
4. 이 실행이 시작한 동일 자원이120초 안에 ready가 되지 않으면 identity/소유 확인 후 정상 SIGTERM 단1회, 최대15초 관찰한다. force kill·재시작·자동 재시도0. 소유/상태 불명확하면 보존하고 정확 사실을 보고한다. PG ready 후 조회만 실패한 경우에는 PG를 자동 중지하지 않는다.
5. 정상 ready PG는 후속 개발용으로 보존한다. 일회 조회 경로/cache 잔여0과 PG 보존을 구분한다. 성공을 전체 서비스/기능 복구로 보고하지 않는다.

## 읽기 계약

- 새 전용 Git checkout `/home/daon/deploy/anvil-v3-schema-read-probe-01`, 임시 npm cache `/tmp/anvil-v3-schema-read-probe-01/npm-cache`. 생성 전 두 상위 전용 경로의 부재·realpath·link·소유를 재확인한다. 소유 daon,0700, 수명20분/정리2분. 기존 정식 checkout·공유 cache는 변경하지 않는다.
- private 기존 branch의 최종 exact SHA를 Git으로만 가져오고 clean을 확인한다. Node24.21.0, lockfile 기반 `npm ci --ignore-scripts --no-audit --no-fund --cache <위 경로>`만 사용한다. Windows 소스 복사·archive·서버 patch0.
- 실행 파일 `scripts/development-schema-probe.ts --read-only`. Linux UID1000/고정 Git root/module path/private origin/clean/exact SHA/유한 window를 검사한다. 비어 있지 않은 PG*·대체 config·NODE_OPTIONS/NODE_PATH는 거절한다.
- 보호 config는 `/home/daon/.local/share/anvil-v3-development/app.json` 한 개만 기존 권한으로 읽는다. parent/file realpath·nonlink·UID1000·owner-only mode·file nlink1·최대8192bytes 확인, O_NOFOLLOW로 열고 finally close한다. 인증정보는 메모리에서만 사용하며 DSN·password·오류 원문은 출력하지 않는다. 신규 credential·다른 역할 fallback0.
- 고정 기존 app role `anvil_v3_app`, DB `anvil_v3_development`, loopback5546. connect5초/query5초/lock1초/idleTX10초, 조회 프로세스 전체30초 상한. 매 비동기 경계 전후·보호 open/read·connect·COMMIT 응답 후·최종 출력 직전 만료를 검사한다. 만료 시 새 작업0, rollback/close만 시도한다.
- `BEGIN READ ONLY` → SET LOCAL timeout → database/current_user/serverVersion/readonly/superuser/bypass 신원 → `anvil.schema_migrations`의 id/checksum → 고정8개 pg_class/pg_attribute metadata → 동일 manifest 재조회/동일성 → COMMIT. 정확 SQL은 소스 `developmentSchemaProbeSql`에 고정한다.
- 고정 object: assignment_drafts, execution_preparations, agent_sessions, executions, execution_grants, writer_claims, execution_commands, project_methodologies. 이름/kind와 application_command_id 컬럼 존재 여부만 읽는다.
- 제품 본문·계정/credential 테이블 행·Secret 조회0, seed/DDL/DML/권한변경0. 접속·통계·서버 운영 로그 효과까지0이라고 주장하지 않는다. 출력은 OBSERVED_METADATA_ONLY 또는 비밀 없는 고정 실패 코드이며 인증/기능 PASS가 아니다.

## 정리·기록·제외

- 성공/실패 모두 전용 Git/cache만 exact 경로·owner·nonlink·process0·Git/hash 목록 확인 후 개별 파일/링크와 빈 디렉터리 순서로 회수한다. broad recursive delete0. 별도 SSH 조회로 두 전용 경로 부재·다른 container/서비스 불변·PG 실제 상태를 확인한다.
- source/private exact SHA·발급/만료·start 횟수·불변 정의 전후·read-only 결과/migration ID-checksum·원 오류/미실행·정리 근거를 WORK_STATUS에 남긴다. 관측 후에도 누락6개/0031의 실제 채택·반영·복구는 별도 정확 범위다.
- 기존 특정 실행 거절은 우회하지 않는다. 새 정확 실행이 안전심사에서 거절되면 명령/대상/원 거절을 PMO에 보고하고 동일 재시도·대체 경로 실행0. OS/ACL·Secret/cert·API/Web·Agent 호출·운영/Oracle 변경0.
