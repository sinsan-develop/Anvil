# 마지막 검증 개발 서비스 복구 — 실행 전 제안

상태: `PROPOSED_NOT_AUTHORIZED / PATH_GUARD_UNRESOLVED`, r2. 실행기 작성·자원 생성·실행 0. Main 어울, 2026-10-18. 최초 tmp안은 아래 ACL 대조로 철회했고 승인 대상으로 유지하지 않는다.

## 목적과 현재 사실

신규 제품 후보가 아니라 마지막 검증 source `6781703a8fd7d258aa7f972bb5f81acaf5c3d388`의 API/Web만 복구한다. 현재 개발 후보 branch와 사용자 자료는 유지한다. 계획 개발과 복구 지원은 분리한다.

- Windows3830/5546 LISTEN0, 이전 API54212/relay26052 부재. 정지 원인·주체 미확정.
- WSL 정식 Git `ff0fcd13695ae0affa2fd773dc96667e1d7c88f8` clean. 기존 PG 동일 fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, exited255/finished2026-10-18T05:12:28.197325125Z/OOMfalse/restart0.
- 기존 보호11hash·Node hash 유지, 지정 개발 CA의 실제 사용자 신뢰1·공개 인증서 유효. 비밀값은 읽거나 기록하지 않는다.
- 마지막 source/이전 rollback Git 객체는 있으나 현재 build는 새 후보다. 옛 N4 index/JS/CSS를 즉시 재사용할 수 없고 단순 Node 재시작은 복구가 아니다.
- 기존 N4 명령은 만료·단1회 소진·옛 PID/relay 전제이며 재실행하지 않는다. 기존 launcher도 runtime 존재/relay 부재로 현재 복구 명령이 아니다.

## 새 자원 제안 — 생성 전 별도 정확 허가 필요

1. 최초 tmp artifact안은 OTHER 쓰기/삭제 위험 때문에 철회했다. 기존 ACL 수리는 제안하지 않는다. **대체 예외 제안**은 기존 보호 부모 `.av3-data` 아래 신규 `n4-recovery-01/artifacts`와 `n4-recovery-01/runtime`뿐이며 아직 생성하지 않았다. 정확 공식 대상은 `D:\Project\Anvil\.av3-data\n4-recovery-01`이다. 마지막 Git source ZIP·source/build manifest·고정 lock 의존성·후보 build용 artifact이며 새 개발 정본/branch가 아니다. source 사용 중 삭제하지 않고 새 전환·검증 또는 CA 만료 전에 서비스 회수 후 정확 정리한다. runtime receipt/out/err는 복구 근거로 보존한다.
2. `.av3-data`·기존 N4 runtime은 상속 차단/current user+SYSTEM FullControl/nonlink를 실제 확인했으나, 상위 Project/Anvil 및 조사한 사용자 프로필·ProgramData 계열에 OTHER 변경 권한이 남아 있다. **보호 leaf만으로 상위 경로 교체 안전을 증명할 수 없다.** 선택 대안은 기존 ACL을 고치지 않고 정확 ancestor의 교체 방지 handle·source 파일 변경 방지/검증을 서비스 수명 동안 유지하는 guard 후보를 별도 설계·검수하는 것이다. 아직 guard 코드/컴파일/handle 생성0이며 옛 소진 native compile/assembly 허가를 재사용하지 않는다. 이 guard·신규 경로/보호 예외가 확정되기 전에는 대체 root도 실행 불가다. 다른 위치를 안전하다고 추정해 순회·생성하지 않는다.
3. PG는 위 기존 fullID만 사용한다. network/volume/bind/역할/설정은 기존 그대로이며 새 DB/container/seed/migration/Agent·Oracle/운영은 없다. source 파일을 WSL로 복사·archive 배포하지 않는다.

원 QA 경로 심사 거절·직접 확인 미답변은 이 제안으로 해소하지 않는다. 위 새 경로 허가가 모호하거나 거절되면 생성/대체 경로 재시도 0이다. 새 branch/세션/자동화/정본 재구성도 하지 않는다.

## 실행기를 작성할 경우의 명령·효과 계약

아래는 그대로 실행하는 스크립트가 아니다. 아직 runId·issuedAt·expiresAt·실행기 hash·허가 ref가 없으므로 모든 mutation은 비활성이다. PMO의 업무 배정이 아니라 복구의 정확 승인 경계만 필요하다.

| 단계 | 고정 명령·검사 계약 | 부수효과·거절 조건 |
|---|---|---|
| Source | 기존 local Git에서 `git archive --format=zip --output=<신규 복구 root>/source.zip 6781703a8fd7d258aa7f972bb5f81acaf5c3d388`, 해당 root/source에만 해제 | branch/HEAD 변경0. 생성 전 root 부재·모든 부모 실경로/link·owner·공간 검사. Git tree 경로·파일 hash와 해제본 대조. 현재 dirty 자료 덮기0 |
| Build | exact lock·기존 Node exe SHA256 `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`에서 아래 고정 의존성 명령·기존 `npm run build` | 새 의존성/자동수정0. 설치·build 실패면 PG/API 시작0. 실제 install/cache/registry 접근은 새 허가 전0 |
| Asset gate | N4 index SHA256 `1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216`, JS `923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9`, CSS `034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56`와 재현본 exact 대조 | 하나라도 불일치하면 새 후보를 옛 후보라 부르지 않고 중단/보고. 현재 개발 dist/원본 교체0 |
| PG | SSH WSL-server에서 기존 socket의 `docker --host unix:///var/run/docker.sock start <위 fullID>` | 실행 직전 fullID/image·기존 mount/network/port·종료 상태 재대조. 정상 기동/WAL 복구는 디스크를 쓸 수 있으므로 ‘물리 DB쓰기0’라고 주장하지 않음. schema/seed/권한 변경은 없음 |
| DB gate | 기존 app 설정만 소비해 READ ONLY 현재 migration46/ID·checksum·81표 지문을 과거 N4와 대조 | 신규 migration/QA entity/실사용자 쓰기0. 실제 지문이 다르면 보존/보고하며 과거 지문으로 덮지 않음. 불일치 상태 API 시작0 |
| Relay | PG start 후 기존 WSL localhost forwarding의 새 127.0.0.1:5546 소유자/exe/시각 확인 | 옛 PID26052 재사용 금지. 자동 복원되지 않으면 새 SSH tunnel/portproxy/WSL 설정을 대안으로 임의 생성하지 않고 그 단계만 보고 |
| API/Web | 복구 source의 `node --title=<새 runId에 묶인 제목> apps/server/main.ts`를 `Start-Process -WindowStyle Hidden`으로 실행 | exact 기존6환경·NO_ARTIFACT_ROOT만 child에 전달. TLS/auth/DB는 기존 보호 ref. 127.0.0.1:3830만, 기존 파일/CA/계정 변경0. 신규 runtime stdout/stderr·receipt, 새 PID/exe/owner/start/title 기록 |
| 후검사 | strict TLS health200, N4 index/JS/CSS 응답hash, 무자격 보호 API401, 실제 DB READ ONLY 지문·보호hash/새 PID·포트 재대조 | 실제 로그인/원문 저장·Agent·전체 사용자 여정 PASS로 승격하지 않음. 인증 우회·TLS 무시·timeout 확대0 |

## 실패와 복구 한계 — 확정 전 남은 정확 결정

- 이번 생성 API PID/연결만 신원을 재확인해 회수한다. 다른 프로세스·기존 컨테이너/volume/network/데이터/보호 이력 삭제0. 기존 프로세스 메모리를 복원한다고 약속하지 않는다.
- PG start 뒤 후검사/API 실패 시 **기존 PG를 정상 stop해 원 중단 상태로 돌릴지, 컨테이너·데이터를 보존한 running 상태로 둘지** 정확 허가가 필요하다. 대상은 이번 run이 exited 기준에서 직접 시작한 위 동일 fullID로 한정한다. 다른 run/사람이 변경했거나 실행 소유를 확인하지 못하면 stop하지 않는다. ‘신규 PID만 회수’와 ‘PG까지 중단 상태 복귀’를 동시에 무조건 성립한다고 쓰지 않는다.
- 설치된 Docker stop은 `--signal`/`--timeout`을 지원하며 기존 PG StopSignal은 SIGINT다(읽기 확인). 유한 timeout은 경과 후 SIGKILL하므로 **`docker stop --timeout=15`를 강제 종료 없는 명령이라 제시하지 않는다.** [Docker 공식 stop 문서](https://docs.docker.com/reference/cli/docker/container/stop/) 참조. 강제 종료 없는 대안은 `docker --host unix:///var/run/docker.sock container stop --signal=SIGTERM --timeout=-1 <위 fullID>`다. runner의 관측은15초로 제한하되 daemon의 정상 종료 대기는 무기한일 수 있다. 15초 안에 종료를 확인하지 못하면 STOP_UNCONFIRMED/실패로 보존·보고하고 SIGKILL/재시도/volume 복원·삭제를 하지 않는다. 따라서 유한 관측과 실제 유한 종료 보장을 구분하며 이 한계를 허가 질문에 포함해야 한다. 이 명령도 아직 미실행/미승인이다.
- 신규 root/권한·의존성 접근/유한 창과 exact 실행기·후검사·정리 명령은 허가 범위 대조 후 Main이 고정하고 독립 읽기 검수를 받는다. 이 문서 작성/검수는 실제 복구 승인이나 원 거절 해제가 아니다.

## 의존성 접근 고정안 — 실제 설치/전송 0

- 마지막 source의 package-lock v3 SHA256 `ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6`를 Git 객체에서 읽었다. packages146·resolved origin은 `https://registry.npmjs.org` 하나·전부 integrity 필드가 있다. Node24.18.0/npm11.12.1이며 source engines와 일치한다.
- 기존 `C:\Users\cyhuh\AppData\Local\npm-cache/_cacache`는 metadata상65개만 존재, 단순 OS/CPU 적합102개 중65개다. cache 바이트 integrity는 실행하지 않았고 offline 설치 가능이라고 주장하지 않는다. 기존 cache를 쓰거나 통째로 복사하지 않는다. install script 표식은 macOS용 fsevents1개였고 **모든 install/lifecycle script를 비활성**으로 제안한다.
- 허가를 구할 명령은 새 보호 artifact/source cwd의 `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --cache=<허가된 artifact>/npm-cache --userconfig=<허가된 artifact>/empty-user.npmrc --globalconfig=<허가된 artifact>/empty-global.npmrc`다. 빈 config2개·cache도 신규 대상이며 미생성이다. parent NPM_CONFIG_*·proxy/credential·NODE_OPTIONS/NODE_PATH/비표준 TLS override는 child에 승계하지 않고 고정 Node/npm만 사용하도록 정확 runner 계약을 검수한다.
- 전송은 lock에 있는 공개 패키지 이름/버전·정확 tarball/필요 registry metadata 요청과 기본 도구/OS 식별 정보만이며 프로젝트 원문/소스·실제 계정/Secret·audit POST는 제외한다. 응답 integrity는 npm lock 검사·정확 build/hash gate로 검증한다. registry의 접속로그 보관은 외부 운영정책이며 Anvil이 삭제한다고 보장하지 않는다. 설치 후 root script는 읽어 확인한 `build`(typecheck+고정 Vite)만 실행한다. lock 개정·upgrade/fund/audit fix·postinstall·유료 서비스·새 trust는 없다.
