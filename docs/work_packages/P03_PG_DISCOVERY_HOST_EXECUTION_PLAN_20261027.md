# P03 RO metadata host 제어 실행 후보

2026-10-27 · 담당 p03_discovery_host_control · SOURCE_PREPARATION / NOT_EXECUTION_READY

## 판정과 권한

보존 PG의 구조 metadata 조사에 필요한 host 제어 소스를 준비했다. 실제 복구·DB·사용자 기능 완료가 아니다. source 검수·게시와 정확한 실행 효과 대조 전에는 적용하지 않는다. 이번에는 실제 SSH/WSL/Docker/volume/scanner/PG/DB/Secret/서비스/Agent/PS/C#/Bash 실행, source QA/보호 원장/nonce 생성이 모두 0이다.

기준 branch는 `codex/av3-stage-b`, 시작 HEAD는 `6d584a619c457218d7b40e94e58358264270943a`다. 기준 HEAD에 이 신규 controller가 있다고 주장하지 않는다. 최종 게시 commit의 controller·shell·재사용 canonical parser를 포함한 exact source를 Main이 검수·결박해야 한다.

- 선행 R2: `6FC9A7CB0F6421944C60E7E8987DDF9579B9599F1844935381A58FC7CBE5E860`.
- 원 TEST_ONLY WI: `C08526AAB0FC26BCFD9B00BE6195FC81A67EB044B7B1F0E3700267F773FFC729`.
- Main 내부 제어 보완 WI: `9C4E5936EF733231FEB220D8968C00C69D401D0A01C068A20531681CE1E30CF1`.
- 기존 shell raw: `156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B`.
- 기존 shell/시험/원실행안·provision/guard/native/approval/marker·보호8·정본현황은 수정하지 않았다. 동시 writer는 이 담당 1명이다.

`grant.json`은 비밀 없는 실행 결박 record일 뿐 사람 승인이나 플랫폼 승인 인증서가 아니다. 출력·원장에 `externalUserApprovalVerified=false`를 유지한다. 파일을 만들거나 Node/PID가 존재한다는 사실로 권한을 주장하지 않는다. Main이 최신 직접 지시·기존 승인 범위·플랫폼 정확 심사를 외부에서 대조해야 하며, 현재 그 실행 판정은 없다. 기존 소진 승인/marker02는 재사용하지 않는다.

## 고정 환경과 새로운 준비물

실제 apply 후보는 WSL-server Linux UID1000의 새 Git QA root `/home/daon/anvil-v3-pgdiscovery-20261027-r2-src`와 비밀 없는 원장 root `/home/daon/.local/share/anvil-v3-pgdiscovery-20261027-r2`뿐이다. 두 경로는 아직 생성하지 않았다. 정식 checkout·기존 Secret root를 사용하거나 수정하지 않는다.

실제 Node 후보는 `/opt/node-v24.21.0-linux-x64/bin/node`, 역사 SHA는 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`다. 설치·다른 Node 검색·자동 대체는 없다. Main의 실행 전 fresh 대조가 필요하며 불일치하면 종료한다. import/기본/`--plan`에서는 환경 조회·FS mutation·도구 생성이 없다. CLI는 `--plan`과 `--apply` 외 인자·host/path/image/UID/한도 override를 거절한다.

Main이 수행할 향후 bootstrap은 다음 순서다. 이 문서 작성으로 실행한 것은 아니다.

1. 신규 두 root의 최초 부재·상위 realpath/nonlink/owner/mode를 확인하고 이름·소유·수명·정리 책임을 사전 기록한다.
2. 승인된 private 개발 원격 `git@github-sinsan-develop:sinsan-develop/Anvil.git`에서 최종 게시 exact commit을 새 QA source로 Git 획득한다. archive·복사·working tree 전송·직접 patch는 사용하지 않는다. source의 branch/HEAD·remote·clean·root inode·소유·link·설정을 대조한다.
3. source의 Git config/hook/filter가 임의 프로그램을 실행하지 않는 새 clone임을 Main이 확인한다. controller의 Git 읽기는 global/system config를 사용하지 않고 fsmonitor/hooks 및 optional index lock을 비활성화한다. 이 방어가 임의 악성 Git 설치/config 전체를 인증한다고 주장하지 않는다.
4. 새 원장 root는 UID1000/0700, `grant.json`은 UID1000/0600·단일 hardlink/일반파일로 만든다. 실제 grant/nonce 발급은 현재 0이다. record의 controller hash와 게시 commit은 최종 source 검수 뒤 결박한다.
5. Main이 record의 정확 실행 효과와 외부 권한을 대조한 뒤에만 고정 Node/source의 apply 여부를 결정한다. 현재 이 절차는 실행 준비가 아니다.

grant의 닫힌 필드는 schema1, scope `P03_RO_METADATA_R2`, 고정 branch, exact40hex commit, controller/shell/Node의64hex hash, 새32hex runInstance, issuedAt/expiresAt, totalMs60000, metadataBytes8192, maxCreates1/maxStarts1이다. issuedAt≤현재<expiresAt이고 창은 최대30분이다. 새 runInstance는 비밀·인증 키가 아닌 QA 식별자다. scope·필드·기한·hash·소진·UTF8·중복 JSON 키 불일치는 Docker0이다.

## 자원·명령·시간 경계

helper는 `anvil-v3-pgdiscovery-20261027-r2`, daemon은 역사 `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, image fullID는 `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`다. 원 volume은 `anvil-v3-development-pgdata`, local/project=v3/owner=P03/instance=`dc22a0629e79f259dcd935845e88e58e`다. CreatedAt `2026-10-16T03:53:33+09:00`는 DEVELOPMENT_ENVIRONMENT의 역사 metadata 출처이며 이번 새 관측이 아니다. 매 실행 preflight와 post에서 같은 신원을 fresh 확인해야 한다.

Docker는 `/usr/bin/docker --host unix:///var/run/docker.sock`의 고정 argv·shell false만 사용한다. daemon 조회는 `info --format {{json .ID}}`로 ID만 받는다. image/volume/container inspect는 내부에서만 해석하고 원문·Env·Labels·실제 mount 경로를 반환/로그/receipt에 넣지 않는다. named helper와 원 volume 소비자는 `container ls --all --no-trunc`의 닫힌 JSON ID로 확인한다. nonzero/단절/모호한 inspect를 부재로 바꾸지 않는다.

실제 create argv는 `createArguments` 단일 함수에 고정했다. 원 실행안의 isolation을 유지하며 차이는 새 `anvil.instance` label 1개다. 기존 project/owner/runid 3label에 새 runInstance를 추가하여 과거 세대 helper와 구별한다. 총4 label·fullID·CreatedAt·image·UID999:999·entrypoint/argv·networknone/ports0·rootfsRO·capdropALL/no-new-privileges·pids32/memory134217728/NanoCPUs200000000·Mounts1/named-sourceRO/volume-nocopy를 검사한다. UID999는 조사주체이며 실제 PG UID 확정이 아니다. 원 volume의 외부 변경/암묵 생성 race를 제거했다고 주장하지 않는다.

preflight에서 helper literal 부재, image fullID/선언 VOLUME1, 원 volume의 label/createdAt/driver/options와 소비자0을 확인한다. 생성 뒤에는 exact own fullID 외 소비자를 거절한다. createdAt는 grant 창 내부·현재 이전이며 이후 같은 값이어야 한다. mount/Env/신원/소비자 불일치면 start0이고 생성된 미실행 helper도 보존한다.

Config.ExposedPorts는 image의 선언 metadata이며 포트 게시 허가가 아니다. 폐쇄형 parser는 미선언/null·빈 객체·합성 후보 `5432/tcp` 한 개의 빈 선언값만 수락한다. preflight에서 관측한 선언을 run-local로 고정하고 생성/정리의 모든 own 재검사에서 동일성을 대조한다. 추가/유실/값변조 선언은 거절한다. 고정 실제 image가5432를 선언한다고 단정하지 않는다. 실제 HostConfig.PortBindings·NetworkSettings.Ports의 게시0과 networknone 검사는 유지한다.

Env는 미실측 후보를 닫힌 allowlist로 제한했다. image 후보 키/값은 PATH=`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`, LANG=`en_US.utf8`, GOSU_VERSION=`1.19`, PG_MAJOR=`15`, PG_VERSION=`15.18-1.pgdg13+1`, PGDATA=`/var/lib/postgresql/data`다. 이는 실제 image 관측값이라는 주장이 아니다. create에서는 PATH=`/usr/bin:/bin`, LC_ALL=`C`, BASH_ENV/ENV 빈 값으로 고정한다. 생성 container는 위 상속값과 고정 override의 정확 집합만 수락한다. 미실측 값 불일치·예상외 키·NODE_OPTIONS/NODE_PATH·loader/Bash hook·중복 키면 fail-closed다. HOME/CODEX_HOME이나 원 사용자 Secret/계정 환경은 전달/재정의하지 않는다. Docker client는 PATH/LANG/LC_ALL 최소 환경만 쓴다.

전체 preflight부터 receipt/cleanup까지 **단일 monotonic 60초 deadline**이다. 단계마다 reset하지 않는다. create/start 직전 잔여57.5초가 없으면 실행하지 않는다. 내부 shell55초와 정리 reserve2.5초를 동시에 확보하는 보수적 기준이다. 실제 준비/기록 비용이 이 예산에 맞는지는 미실측이며 자동으로 기한을 늘리지 않는다.

FS/Git/consume/receipt await도 같은 deadline으로 경합시키고 전후 재검사한다. 실제 FS adapter의 각 연속 작업도 deadline 전후를 검사한다. 늦게 완료된 open은 원 handle을 닫고 다음 쓰기·create/start/rm을 수행하지 않는다. 이미 시작한 kernel IO의 취소/소거는 보장하지 않는다. consume/write 결과가 불명하면 consumed=null·consumeAttempted/pendingIO·보존 필요로 구별한다. 미관측을 false로 합성하지 않는다.

metadata의 raw stdout+stderr 합계는8192 bytes다. control/Git 출력은 단일 호출262144 bytes로 별도 제한한다. inspect의 구조화 정의/소유/제한을 확인하기 위한 control 한도이며 metadata 예산을262144로 늘린 것이 아니다. stdout/stderr 원문·예외 message를 오류에 붙이지 않는다. 폐쇄 오류코드/phase/attempt·exit/signal·close관측만 보존한다. metadata는 원 shell의9개 tool path/hash·숫자 account/root·집계 schema만 strict JSON으로 받으며 partial/failure/중복키/추가키/잘못된UTF8/수치상한을 거절한다. 기존 순수 `contracts/canonical.ts::parseWireJson`을 재사용하고 원 파일은 수정하지 않았다.

## 단발·수집·정리·불명 보존

첫 Docker mutation 전에 `consumed.json`을 O_EXCL/CreateNew·0600으로 생성하고 파일/부모 directory를 sync한다. 삭제/초기화/재시도하지 않는다. `receipt.jsonl`도 처음엔 CreateNew, 이후 같은 inode/owner/mode/nlink를 확인해 append+sync한다. 원장에는 비밀 없는 고정 facts만 쓰고 그 상한은65536 bytes다. 쓰기 불명은 성공으로 덮지 않는다.

create는1회, 반환64hex fullID만 채택한다. 같은 fullID의 start도1회며 exact Git shell blob의 raw bytes만 stdin으로 보낸다. 임의 script/workingcopy/CRLF변환·archive·재시작은 없다. start 출력 정상성과 helper 정상종료·정리·원 volume 보존 관측은 각각 별개다.

시간/출력/stream/close 불명에서는 두 종류의 TERM을 구별한다.

- **Docker/Git client:** 이 controller가 받은 원 spawn handle에만 SIGTERM 최대1과 해당 stdin/stdout/stderr destroy를 요청한다. PID 검색·전역 kill·SIGKILL·unref·새 daemon은 없다. 정상 close를 이미 관측한 client에는 TERM0이다. timeout/overflow의 요청 뒤 close가 미확인이면 clientCloseUnconfirmed를 남긴다.
- **helper:** 남은 같은 예산 내 fresh daemon·exact fullID/4label/생성시각/image/정의가 맞고 running인 자기 helper에만 Docker의 정상 TERM1을 요청한다. 다른 Name/ID·신원불명에는0이다. 종료를 확인하지 못하면 rm0이다.

client TERM이 helper 종료를 증명하지 않으며 kernel 대기·미완료 IO·host process/pipe가60초에 강제 종료된다고 약속하지 않는다. 불명 자원/원장/원 source는 보존하고 Main이 exact observed facts로 다음 행동을 판단한다. deadline 이후 새 정리/receipt mutation은 시작하지 않는다.

helper rm은 정상 exited/ExitCode0/OOMfalse/FinishedAt과 exact identity를 다시 확인한 경우만 동일 fullID에1회 한다. `-f`/`-v`/volume삭제0이다. created 미실행·비정상 종료·외부세대·미종료는 보존한다. rm 성공 뒤 helper 목록 부재와 원 volume 같은 신원을 별도 확인한다. metadata가 정상이더라도 정리/부재/원 volume 관측이 불명이면 complete=false다. preflight 원 volume 관측과 정리 후 관측 필드를 분리하고 원보존 필요true는 오류 때문에 false로 바꾸지 않는다.

source QA/root·원장·receipt는 controller가 일괄삭제하지 않는다. Main의 별도 종료 절차에서 최초부재/같은inode/owner/Git exact/예상외 파일·link0 근거로 새 source QA만 정확 정리한다. consumed/receipt는 인수·감사 근거로 보존한다. 원 volume/정식 서비스/Secret/기존 repo/다른 프로젝트는 변경하지 않는다.

## 검증·미검증·rollback

Main fresh RED e18418은 source 전 신규4건 모두 HOST_CONTROL_SOURCE_MISSING/exit1이었다. 이후 Main이 daemon 조회를 ID1로 좁히도록 지시했고 동일 WI 안에서 구현했다. 초기 확장15건은197.973ms/15PASS·0FAIL·skip0이었다. 첫 타입 검사 fixture 타입2건, 추가 반례 fixture 타입1건을 최소 보정했고 제품 동작 실패로 세지 않는다. 동일 근본 원인3회는 없다.

현재 검증은 신규 명시 Node unit·타입·구문·diff와 fake FS/Git/Docker/clock·실제 adapter handler에 fake child를 넣은 합성 증거뿐이다. 실제 factory의 Linux FS 소유/원장 내구성·child OS TERM/pipe 종료·새QA bootstrap·Docker endpoint/도구/image/Env·원volume/실metadata·PG/DB/사용자인수는 NOT_RUN이다. 실제 실행 준비나 sourceQA 생성 완료로 승격하지 않는다. 완료 시 최종 소스/시험 raw hash와 정확 명령/결과는 Main에 별도 동결 보고한다.

독립 최종 검수 I1 round1은 consume/receipt 비용이 이전 시작 예산 검사를 지난 뒤 실제 create/start를 허용한다는 지적이다. TEST_ONLY 반례2개를 추가해 직전 receipt가 now2501/잔여57499ms로 진행하도록 했고 담당 afb5b0은18PASS/2FAIL·228.7761ms/exit1, Main fresh f869a7은18PASS/2FAIL·236.0281ms/exit1로 실제 mutation1≠기대0을 확인했다. Main GO 뒤 실제 create/start 호출 바로 앞에 동일57.5초 guard를 각각1줄 추가했다. 소진/이미 생성된 helper 보존·기존 한도·기대값은 유지한다. 보완 전 Main4332ab의18PASS·231.6903ms와 fdbdb0 타입/구문 증거를 보완 후 증거로 재사용하지 않는다.

예산 보완 후 담당 c87fb8은20PASS/0FAIL·245.8286ms/exit0, 7befb2 타입0이었다. 이어 Main은 R2/WI의 publish0가 Config.ExposedPorts 선언 부재를 뜻하지 않음을 확인했다. TEST_ONLY 추가4건에서 담당2813a2는22PASS/2FAIL·231.4983ms/exit1, Main fresh f0b877은22PASS/2FAIL·244.9727ms/exit1로 동일5432tcp선언의 잘못된 거절과 선언유실의 잘못된 수락을 확인했다. Main GO 뒤 폐쇄선언 검사·run-local 동일성만 최소 보완했다. 원18건·예산2건·실제 게시0 기대값은 유지하며 실제 image 조회는0이다.

남은 조건은 독립 C/I0·Main 최종 소스검수/지문·private exact 게시, 새QA의 안전한 Git/도구/root/record 준비, 미실측 Env/부트스트랩의 정확 대조, 최신 직접 지시와 플랫폼 심사를 통한 실제 효과 판정이다. 그 전 apply0을 유지한다.

rollback은 이번 소유 신규3파일을 검토된 정상 revert로 되돌리는 것이다. 원자료/승인/marker/원장/volume·서비스를 삭제해 되돌리지 않는다. 담당은 정본현황/WI를 수정하지 않으며 Main이 이 증거·오류·미진을 누적 기록한다.
