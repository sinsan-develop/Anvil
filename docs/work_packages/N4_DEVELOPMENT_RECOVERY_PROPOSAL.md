# 마지막 검증 개발 서비스 복구 — 실행 전 제안

상태: `PROPOSED_NOT_AUTHORIZED`. 실행기 작성·자원 생성·실행 0. Main 어울, 2026-10-18.

## 목적과 현재 사실

신규 제품 후보가 아니라 마지막 검증 source `6781703a8fd7d258aa7f972bb5f81acaf5c3d388`의 API/Web만 복구한다. 현재 개발 후보 branch와 사용자 자료는 유지한다. 계획 개발과 복구 지원은 분리한다.

- Windows3830/5546 LISTEN0, 이전 API54212/relay26052 부재. 정지 원인·주체 미확정.
- WSL 정식 Git `ff0fcd13695ae0affa2fd773dc96667e1d7c88f8` clean. 기존 PG 동일 fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, exited255/finished2026-10-18T05:12:28.197325125Z/OOMfalse/restart0.
- 기존 보호11hash·Node hash 유지, 지정 개발 CA의 실제 사용자 신뢰1·공개 인증서 유효. 비밀값은 읽거나 기록하지 않는다.
- 마지막 source/이전 rollback Git 객체는 있으나 현재 build는 새 후보다. 옛 N4 index/JS/CSS를 즉시 재사용할 수 없고 단순 Node 재시작은 복구가 아니다.
- 기존 N4 명령은 만료·단1회 소진·옛 PID/relay 전제이며 재실행하지 않는다. 기존 launcher도 runtime 존재/relay 부재로 현재 복구 명령이 아니다.

## 새 자원 제안 — 생성 전 별도 정확 허가 필요

1. 로컬 `D:\tmp\anvil-v3-stage-b\recovery-n4-6781703a-01`: 새 빈 owner 현재 사용자/nonlink인 경우만. 마지막 Git source ZIP·읽기 전용 source/build manifest·고정 lock 의존성·후보 build를 위한 **임시 복구 artifact**, 새 개발 정본/branch가 아니다. 실행 source를 담으므로 복구 서비스 사용 중 삭제하지 않는다. 새 전환·검증 또는 CA 만료 전에 서비스 회수 후 정확 정리하며 자동 삭제하지 않는다.
2. 로컬 `.av3-data/runtime-n4-recovery-01`: 보호된 신규 runtime receipt/out/err만. 기존 runtime·실패 기록·인증자료를 덮지 않고 복구 근거로 보존한다. owner/SYSTEM 한정 보호가 필요한 신규 폴더 권한도 실행 허가 대상이다.
3. PG는 위 기존 fullID만 사용한다. network/volume/bind/역할/설정은 기존 그대로이며 새 DB/container/seed/migration/Agent·Oracle/운영은 없다. source 파일을 WSL로 복사·archive 배포하지 않는다.

원 QA 경로 심사 거절·직접 확인 미답변은 이 제안으로 해소하지 않는다. 위 새 경로 허가가 모호하거나 거절되면 생성/대체 경로 재시도 0이다. 새 branch/세션/자동화/정본 재구성도 하지 않는다.

## 실행기를 작성할 경우의 명령·효과 계약

아래는 그대로 실행하는 스크립트가 아니다. 아직 runId·issuedAt·expiresAt·실행기 hash·허가 ref가 없으므로 모든 mutation은 비활성이다. PMO의 업무 배정이 아니라 복구의 정확 승인 경계만 필요하다.

| 단계 | 고정 명령·검사 계약 | 부수효과·거절 조건 |
|---|---|---|
| Source | 기존 local Git에서 `git archive --format=zip --output=<신규 복구 root>/source.zip 6781703a8fd7d258aa7f972bb5f81acaf5c3d388`, 해당 root/source에만 해제 | branch/HEAD 변경0. 생성 전 root 부재·모든 부모 실경로/link·owner·공간 검사. Git tree 경로·파일 hash와 해제본 대조. 현재 dirty 자료 덮기0 |
| Build | exact lock·기존 Node exe SHA256 `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`에서 고정 의존성 설치·기존 `npm run build` | 새 의존성/자동수정0. exact 명령·cache/registry 접근 범위는 패킷 확정 전 고정. npm ci 또는 build 실패면 PG/API 시작0 |
| Asset gate | N4 index SHA256 `1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216`, JS `923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9`, CSS `034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56`와 재현본 exact 대조 | 하나라도 불일치하면 새 후보를 옛 후보라 부르지 않고 중단/보고. 현재 개발 dist/원본 교체0 |
| PG | SSH WSL-server에서 기존 socket의 `docker --host unix:///var/run/docker.sock start <위 fullID>` | 실행 직전 fullID/image·기존 mount/network/port·종료 상태 재대조. 정상 기동/WAL 복구는 디스크를 쓸 수 있으므로 ‘물리 DB쓰기0’라고 주장하지 않음. schema/seed/권한 변경은 없음 |
| DB gate | 기존 app 설정만 소비해 READ ONLY 현재 migration46/ID·checksum·81표 지문을 과거 N4와 대조 | 신규 migration/QA entity/실사용자 쓰기0. 실제 지문이 다르면 보존/보고하며 과거 지문으로 덮지 않음. 불일치 상태 API 시작0 |
| Relay | PG start 후 기존 WSL localhost forwarding의 새 127.0.0.1:5546 소유자/exe/시각 확인 | 옛 PID26052 재사용 금지. 자동 복원되지 않으면 새 SSH tunnel/portproxy/WSL 설정을 대안으로 임의 생성하지 않고 그 단계만 보고 |
| API/Web | 복구 source의 `node --title=<새 runId에 묶인 제목> apps/server/main.ts`를 `Start-Process -WindowStyle Hidden`으로 실행 | exact 기존6환경·NO_ARTIFACT_ROOT만 child에 전달. TLS/auth/DB는 기존 보호 ref. 127.0.0.1:3830만, 기존 파일/CA/계정 변경0. 신규 runtime stdout/stderr·receipt, 새 PID/exe/owner/start/title 기록 |
| 후검사 | strict TLS health200, N4 index/JS/CSS 응답hash, 무자격 보호 API401, 실제 DB READ ONLY 지문·보호hash/새 PID·포트 재대조 | 실제 로그인/원문 저장·Agent·전체 사용자 여정 PASS로 승격하지 않음. 인증 우회·TLS 무시·timeout 확대0 |

## 실패와 복구 한계 — 확정 전 남은 정확 결정

- 이번 생성 API PID/연결만 신원을 재확인해 회수한다. 다른 프로세스·기존 컨테이너/volume/network/데이터/보호 이력 삭제0. 기존 프로세스 메모리를 복원한다고 약속하지 않는다.
- PG start 뒤 후검사/API 실패 시 **기존 PG를 정상 stop해 원 중단 상태로 돌릴지, 컨테이너·데이터를 보존한 running 상태로 둘지** 정확 허가가 필요하다. ‘신규 PID만 회수’와 ‘PG까지 중단 상태 복귀’를 동시에 무조건 성립한다고 쓰지 않는다. 강제 kill·volume 복원·데이터 rollback은 제안하지 않는다.
- 신규 root/권한·의존성 접근/유한 창과 exact 실행기·후검사·정리 명령은 허가 범위 대조 후 Main이 고정하고 독립 읽기 검수를 받는다. 이 문서 작성/검수는 실제 복구 승인이나 원 거절 해제가 아니다.
