# A-3 새 빈 격리 SQL 검증 실행 결정 자료

## 판정과 요청

Main이 선정한 다음 선행은 신규 SQL 초안의 실제 파싱/COMMIT·canonical/Unicode/targets 검증이다. 현재는 준비 코드·로컬 합성 검수만 완료했고 실제 PG 실행0이다. 이 문서는 실행 승인 자체가 아니다. PMO의 정확 결정과 별도 플랫폼 안전 확인 뒤에만 수행한다.

- 권장 A: 아래 새 빈 격리 PG에서 **schema/읽기 전용 SQL 벡터만** 1회 검증하고 소유 stack을 폐기한다.
- 대안 B: 실행을 보류하고 SQL/함수·COMMIT은 미검증으로 유지한다. 정식 DB/실서비스에 반영하지 않는다.
- API/현재 인증·grant/credential 실제 발급·보고 원자성/rollback·native/OS·Agent는 이 좁은 시험에서 확인하지 않는다. 전체 A-3 수용과 다르다.

## 정확 후보·승인 결박

- 제품 후보: `568e857121606fae532e783a0b7f4d966aa3c69d` (기존 `codex/av3-stage-b`, private exact 확인).
- 실행 후보: 이 준비 자료와 runner/guard의 후속 checkpoint 40 SHA를 WORK_STATUS·PMO 최종 요청에서 고정한다. 다른 SHA/dirty checkout은 거절한다.
- 신규 SQL: `db/migrations/0008_source_read_observation.sql`, SHA256 `26A7B7828481689D7017836C1ECE2FC5E9F644CB9B8200122EE013E7F52DB185`.
- runner `scripts/qa-source-read-sql.ts` SHA256 `AF2A5E77D3B95181B75CFA378BDFFD5BEFA0486E7956C9DA78667223751C69FC`.
- guard `scripts/source-read-qa-guard.ts` SHA256 `A272D48E0B524A6B127FAC47949FFF4EC32C7A9100BE0F10CF124CE891103944`.
- 신규 migration helper SHA256 `6DA3AC4400D72BBF47209DE2F9CD2C6639670AB313BA317897B6CF80D86E519C`.
- 기존45 SQL·정식 runner는 수정하지 않는다. 신규 helper는 독립 QA에서만 호출하며 정식 자동 적용 경로에 연결하지 않는다.

## 생성 전 자원 계약

| 항목 | 정확 범위 |
|---|---|
| 소유·환경 | Anvil Main 어울 / `ssh WSL-server`, uid1000, Git root `/home/daon/deploy/anvil-v3` |
| Git | 검증된 기존 private origin에서 승인 branch/정확 실행 SHA만 fetch·checkout, 로컬 수정/Windows 복사0 |
| Docker | `/usr/bin/docker --host unix:///var/run/docker.sock`, root 소유 socket, nonempty DOCKER_* override 거절 |
| daemon | 실제 ID `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, Name `SINSAN`, 관측 Docker29.1.3 |
| image | `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`, image ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, pull0 |
| container | 신규 `anvil-v3-a3-read-sql-qa-pg` |
| network | 신규 internal `anvil-v3-a3-read-sql-qa-net`, 기존 network 연결0 |
| DB·port | 신규 `anvil_v3_a3_read_qa`, `127.0.0.1:5548:5432`만 |
| data | 새 container의 `/var/lib/postgresql/data` tmpfs256MiB·rw/noexec/nosuid, host bind/volume0 |
| labels | `anvil.project=v3`, `anvil.owner=A3_READ_SQL_QA`, run마다 난수 `anvil.instance` |
| 수명 | 실행 직전 지정한 유한 기한, 최대2시간/한 번 검증 후 즉시 정리, 기한 연장·fallback0 |
| 임시 인증 | 새 격리 PG 안의 bootstrap/migrator/app 역할·합성 난수 비밀번호만 메모리/자식 env/SQL stdin, 로그/Git/파일 출력0 |
| 산출 | 비밀 없는 단계·SQLSTATE/위치·SHA·full ID/labels·검사 결과·정리 상태만 보고 |

2026-10-17T15:29Z 이전 읽기 확인: Node24.21.0/uid1000, 위 daemon·image/socket·binary 일치, 지정 container/network·5548 listener 부재(exit0). WSL Git은 `0078bdfd19a1dde7922311b47df29b4ab1fb9494` detached clean·정확 private origin이며 **아직 새 후보로 변경하지 않았다**. 초기 stdin SSH 읽기 조회는 출력이 없어 결과로 쓰지 않았고, 개별 읽기 명령의 exit0·값으로 재확인했다. 생성 직전 다시 부재·image/daemon·Git·기한을 확인한다.

## 수행과 미검증

1. 별도 결정·정확 실행 SHA/SQL hash·daemon ID/name·기한을 대조한다. marker/env는 승인 증거를 대신하지 않는다.
2. repo cwd뿐 아니라 실제 runner module·manifest root·46개 SQL의 realpath가 같은 승인 Git에 속하는지 확인한다. 오인/링크·다른 소스/dirty면 생성0.
3. 새 internal network/container만 생성하고 full ID·난수 label·image·실 tmpfs·exact loopback port·network ID를 확인한다.
4. 새 비관리자 migrator로 기존45+신규1을 한 schema transaction에서 적용·COMMIT한다. 정식 개발 DB/기존 role·키·권한에는 접속/수정하지 않는다.
5. app 역할의 READ ONLY transaction에서 canonical UTF-8/CRLF/escape·safe정수, Unicode 확장/보충평면 fold, target200/201·상대경로·중복 음성을 검증하고 신규4표0행을 확인한다.
6. 성공/실패 모두 exact full ID·labels/image/mount/port/network를 다시 대조하고 이번 소유 container/network만 폐기한다. 관리자로 감사/행 DELETE·trigger 해제0. 삭제 검증 불가·신원 불일치면 광범위 삭제하지 않고 정확 잔여·원 failure/cleanupFailure를 분리 보고한다.
7. 별도 read-only 조회로 지정 이름/port 잔여0을 확인하고 WORK_STATUS에 실제 결과를 기록한다.

서버 API/인증·현재성 경합·보고/credential COMMIT/rollback·실제 TLS·native·OS·사용자 인수는 남은 미검증으로 유지한다. 함수의 성공을 전체 R/W 허가·Agent·기준선 확정으로 승격하지 않는다. 현재 Anvil 개발 DB45/보호자료/Windows3830/실서비스/Oracle/main 변경0이다.

## 준비 증거·잔여

- 신규 entry/guard 부재RED→GREEN, 실행 module/daemon 결박 I2건 RED→GREEN, 직접/인접8PASS491.4471ms·타입/diff0.
- 첫 독립 준비 검토 C0/I2/M0 → 지정 보완 scoped C0/I0/M0, 읽기만·actual 재현0.
- 실제 daemon/CLI·resource/PG·정리/중단/timeout은 아직 미검증이다. Docker 환경/현재 context의 대상 변경 가능성은 [공식 Docker context 문서](https://docs.docker.com/reference/cli/docker/context/use/)를 대조하고 환경 override 거절+명시 endpoint로 좁혔다.
- N3 Minor1(보존 초안의 hostLabel 표시)·지연 중 주체/project교체 실제browser 미확인은 별도 이력으로 보존한다.
