# P03 R3 보호 사본 1회 실행 — 사전검토 제안

2026-10-31 / Primary 어울 / **PROPOSAL · 실제 실행 승인 아님**
이 문서는 정적 제안이다. actual 결정/packet/grant/nonce·issuedAt/expiresAt을 발급하지 않는다. 원격 조회·checkout·preflight를 포함한 실제 준비/자원 생성/복제는 현재 0이다. 승인된 source 구현과 실제 효과 승인을 구분한다.

## 1. 고정 source와 근거
| 항목 | 정확 기준 |
| --- | --- |
| source commit / branch | `8d200333239f1bd7a7e8b6736a1492eb482e2de2` / `codex/av3-stage-b` (최신 HEAD로 대체0) |
| remote | `git@github-sinsan-develop:sinsan-develop/Anvil.git` |
| controller Git LF | `E88B9B1918EBA1B6E2C035C7E7C6D9CF458E778853190CF768516F9F4CFE2703`, 70,478B/CR0 |
| shell Git LF | `8F1C435187ED253CBC1ACAABD430B4B4F891D84EBBC37A3027744A22B44C9BB3`, 58,370B/CR0 |
| R3 source 후보 | `P03_PG_COPY_LIMITED_RISK_R3_BINDING_CANDIDATE_20261028.md`, SHA `94BB0D36438873994003F062A9C18ABC378E9C2382A7D617C45EE411141F0092` |
| source 검수 | Main 130PASS/type/Bash/LF/diff0·독립 C0/I0. 실제 Docker/cp/PG 검증 아님 |
Windows controller raw591B95E0…는 Git LF 지문과 구분한다. 위 LF bytes를 Linux checkout에서도 정확 대조해야 한다. source-only 채택 EF21B4CB/WI E332921F는 실제 실행 권한이 아니다.
기존 절차 근거는 `P03_R2_LIMITED_COPY_ONCE_EXECUTION_DECISION_PACKET_20261028.md` §3~종료절차와 `P03_PG_COPY_EXECUTION_PLAN_20261027.md`다. R2 exact8e9292의 NOT_COMPLETE/create-tools/IDENTITY_UNKNOWN·consumed·cp/PG 미도달 및 후속 helper 회수는 그대로 보존한다. R1/R2 source·소진값을 R3 성공/권한으로 복사하지 않는다.

## 2. 제안 대상6과 현재성
대상 환경은 기존 WSL-server의 daon UID1000/GID1000이다. 아래는 고정 후보값이며 현재 존재/부재·owner/link·공간·도구·daemon·image·원본 상태는 모두 **UNKNOWN / 실행 직전 검산 대상**이다. 다른 환경/이름으로 자동 대체하지 않는다.
| 대상 | literal / 허용 효과·수명 |
| --- | --- |
| sourceRoot | `/home/daon/anvil-v3-pgcopy-20261028-r3-src` — 새 일반 Git checkout, 1000:1000/0700, `.git` 디렉터리·controller 고정 Git 설정. 같은 승인창 안에서만 준비·검산, 정상 확인 후 정확 소유 QA 회수 |
| ledgerRoot | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r3` — 새 1000:1000/0700. grant.json/consumed.json/receipt.jsonl은 0600·regular/nonlink/nlink1·소유 검산. 결과에 관계없이 보존 |
| copyVolume | `anvil-v3-pgdata-recovery-20261028-r3` — 새 local volume 총1. 새 nonce/source-instance label. 성공·실패·부분 사본 모두 보존·자동삭제0 |
| toolsName | `anvil-v3-pgcopy-tools-20261028-r3` — UID999:999/cap0, 원본·사본 volume0, 선언 PGDATA에 private tmpfs |
| initName | `anvil-v3-pgcopy-init-20261028-r3` — UID0:0/CHOWN만, 원본 mount0·새 사본 RW/nocopy. 새 빈 root1곳만 0:0/0755→999:999/0700; 재귀 변경0 |
| copyName | `anvil-v3-pgcopy-20261028-r3` — UID999:999/cap0, 원본 RO/nocopy·새 사본 RW/nocopy·audit private tmpfs32MiB/0700 |
원본은 `anvil-v3-development-pgdata` / instance `dc22a0629e79f259dcd935845e88e58e` / CreatedAt `2026-10-16T03:53:33+09:00`다. 원본/R1/R2 volume·각 ledger를 비우거나 재사용/삭제하지 않는다. 새 R3 사본과 부분 사본 공간은 기존 보존량에 **추가**된다.
고정 daemon=`e3349f1d-dbfc-478a-96d9-295bf6c6839e`, image=`sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`(pull never), Node=`/opt/node-v24.21.0-linux-x64/bin/node`/SHA `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`다. 값만 적혀 있다고 실제 관측 완료가 아니다.
helper 공통은 network none/포트0/read-only rootfs/no-new-privileges/cap-drop ALL/pids32/memory256MiB/CPU0.5이며 role별 create/start 각1·전체3이다. tmpfs 요청은 HostConfig.Tmpfs exact, inspect Mounts는 volume-only exact, 첫 쓰기 전 kernel mountinfo/stat 검산을 유지한다. init/copy 원본RO·NoCopy 및 created/started 검사를 완화하지 않는다.

## 3. 실제 결정 후에만 채울 입력
`actualDecisionRecordSHA, approvedAt, issuedAt, expiresAt, runInstance, gitSha256, dockerSha256, 실행담당/관측담당`은 현재 모두 **PENDING**이다. PENDING은 유효 grant 값이 아니며 현재 파일 생성0이다. decisionSHA는 새 실제 효과·위험을 승인한 정확 기록의 hash여야 한다. 후보/source 승인/옛 grant/nonce/시각으로 대체하지 않는다.
최초 실제 승인부터 준비·실행·QA 목표수명 합계 최대30분이다. expiresAt≤최초승인+30분이며 늦은 source 준비·재관측·실패로 창을 재시작/연장하지 않는다. 원격 exact clone/preflight도 **승인 뒤 같은 창 안에서만** 가능하다. 기존 source fetch에 약12분 걸린 이력은 준비 지연 위험이지 연장 근거가 아니다.
기존 controller가 읽는 입력은 위 ledgerRoot/grant.json이다. closed grant 키는 schema/scope/branch/commit/controllerSha256/shellSha256/nodeSha256/gitSha256/dockerSha256/runInstance/issuedAt/expiresAt/totalMs/sourceMs/reserveMs/stdoutBytes/controlBytes/auditBytes/logicalBytes/maxEntries/maxVolumes/maxCreates/maxStarts/names/policy/candidateSha256/decisionSha256/limitedAcceptance다. grant read 상한은 기존8KiB다. 실제 작성/원자 저장은 현재 수행하지 않는다.
limitedAcceptance는 scope/policy/candidateSha256/runInstance/sourceInstance/copyInstance/commit/controllerSha256/shellSha256/decisionSha256/issuedAt/expiresAt/delta의 닫힌 객체다. top-level과 정확 일치, copyInstance=새runInstance, sourceInstance=고정 원본이다. 기존 delta의 writer=NOT_PROVEN_ACCEPTED_FOR_THIS_RUN, hardQuota=NOT_ENFORCED_ACCEPTED_FOR_THIS_RUN, acl/xattr=UNAVAILABLE_ONLY_BASIC_METADATA_ACCEPTED, numericOwner1001=NEW_EXACT_RUN_RISK_ACCEPTED를 유지한다. 태그는 실제 안전 증명이나 사람 서명이 아니다.

## 4. 지원된 진입명령·단계·STOP
아래 **기존 CLI entry만** 사용한다. 지금 실행하지 않으며 새 launcher/carrier/동적 대상 선택기·수동 cp는 만들지 않는다. protocol `P03_PROTECTED_COPY_LIMITED_RISK_R1`, policy `P03_COPY_LIMITED_RISK_POLICY_R1_20261028`, mode는 그대로다. R1은 protocol 버전이지 옛 자원 재사용 허가가 아니다.
```text
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /opt/node-v24.21.0-linux-x64/bin/node /home/daon/anvil-v3-pgcopy-20261028-r3-src/scripts/p03-pg-copy-host.ts --apply-limited-risk
```
| 순서 | 실제 승인 후 필요한 조치 / 기대 결과 / STOP |
| --- | --- |
| 0 준비 | 최초승인·담당·target6·기한 등록→생성 직전 대상 부재/부모 realpath·owner/mode/link·기존 영향 확인→새 source checkout에 exact commit/branch/remote·Git 설정·LF2·tracked clean 대조. 충돌·dirty·설정/identity 불명은 사용·삭제·변경·경로대체 없이 STOP |
| 1 입력 | 고정 Node의 owner1001/regular/nonlink/nlink1·부모·open 전후 inode/hash·/proc/self/exe, `/usr/bin/git`·`/usr/bin/docker`의 root소유/no group-or-other-write·실경로/지문을 확인해 새 입력에 결박. 새 ledger/grant의 exact owner/mode·create-new·hash 검산. 불명/기한소진은 consume/첫mutation0 |
| 2 기존 CLI 1회 | binding/source/grant 및 daemon/image/원본·consumer0·대상6 부재 검산→첫 Docker mutation 전에 O_EXCL consume/fsync·receipt 기록→새 volume1 생성. 같은 grant 재진입·strict fallback·자동재시도0 |
| 3 helper | tools create/신원/도구·tmpfs 검산→init의 새 빈 root만 초기화→copy fullID/nonce/argv·원본RO·용량/기한 재검산→cp. controller가 각 role 정상 close/종료를 확인해 기존 normal rm. 오류는 현재 phase/error·consume 여부·생성분·pendingIO를 보존, 다른 도구/대상으로 우회0 |
| 4 결과 | source 전후/사본의 bytes·선정 metadata·identity·용량·관측간격·원 cp의 PID/parent/start/fullID·close/회수 증거 검산. 결과 `COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY`, complete=true 및 helpers 정상회수가 전부 확인돼야 제한 복제 성공. exit0 하나만으로 합격0 |
| 5 독립 종료확인 | 정확 helper name/fullID 부재·원/사본 identity/labels/CreatedAt·consumer·ledger 소유/권한/원기록·QA 회수/보존을 한정 읽기 확인. 미실행은 NOT_RUN, 불명은 보존·보고. 독립 담당은 제품 실행/강제정리하지 않음 |
### 4.1 준비 명령 템플릿 — 현재 실행금지
별도 제품 launcher를 추가하지 않고 기존 exact Git/Node 접점으로 아래 **이번 R3에만 한정한 정적 준비 명령안**을 제안한다. Main 기술 권장은 shallow/filter 없이 새 빈 checkout에 고정 branch를 가져와 exact8d200으로 맞추는 것이다. 과거 준비 지연이 반복돼도 승인창 연장/재시작0이다. 기존 root 재사용·reset·원volume 접근0이며, 아래 코드는 현재 검토용 문서일 뿐 실행/구문시험하지 않았다. clone의 remote 이름과 검산은 기존 controller에 맞춰 development로 고정한다. `checkout -B`는 이 시도에서 부재를 확인하고 새로 만든 no-checkout QA에 exact commit/branch를 고정하는 동작에만 한정하며 기존 repository/reset/history rewrite가 아니다. fresh root 조건을 충족하지 않으면 실행하지 않는다.
Main은 실제 실행 결정 후 신뢰된 직접 승인 기록과 그 SHA/최초시각·정확 source/대상/위험4의 일치를 먼저 확인해야 한다. 코드의 hash/시간 형식 검사는 사람 승인의 진위 인증이 아니다. 이 확인이 없거나 PENDING이 남으면 첫 filesystem 변경 전에 STOP한다. 아래 승인입력은 지금 모두 PENDING이며 실제 값/파일을 발급하지 않는다.
```bash
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /bin/bash --noprofile --norc <<'R3_PREP_ONLY'
set -euo pipefail
umask 077
APPROVED_AT=PENDING; ISSUED_AT=PENDING; EXPIRES_AT=PENDING
DECISION_SHA=PENDING; RUN_INSTANCE=PENDING; GIT_SHA=PENDING; DOCKER_SHA=PENDING
# 이 gate 앞/안에는 mkdir/clone/grant 작성이 없다. 승인근거 자체는 Main이 별도 대조한다.
for h in "$DECISION_SHA" "$GIT_SHA" "$DOCKER_SHA"; do [[ $h =~ ^[a-f0-9]{64}$ ]] || exit 1; done
[[ $RUN_INSTANCE =~ ^[a-f0-9]{32}$ ]] || exit 1
for t in "$APPROVED_AT" "$ISSUED_AT" "$EXPIRES_AT"; do
 [[ $t =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$ ]] || exit 1
done
NODE=/opt/node-v24.21.0-linux-x64/bin/node
# Node를 쓰기 전에 기존 binary/parents를 고정 절대경로 도구로 관측한다.
for entry in '/:0:0:755' '/opt:0:0:755' '/opt/node-v24.21.0-linux-x64:1001:1001:755' '/opt/node-v24.21.0-linux-x64/bin:1001:1001:755'; do
 dir=${entry%%:*}; want=${entry#*:}
 [[ -d $dir && ! -L $dir && $(/usr/bin/readlink -e -- "$dir") == "$dir" ]] || exit 1
 [[ $(/usr/bin/stat -c '%u:%g:%a' -- "$dir") == "$want" ]] || exit 1
done
[[ -f $NODE && ! -L $NODE && $(/usr/bin/readlink -e -- "$NODE") == "$NODE" ]] || exit 1
[[ $(/usr/bin/stat -c '%u:%g:%a:%h' -- "$NODE") == 1001:1001:755:1 ]] || exit 1
before=$(/usr/bin/stat -c '%d:%i:%s:%y:%u:%g:%a:%h' -- "$NODE")
[[ $(/usr/bin/sha256sum -- "$NODE") == "7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c  $NODE" ]] || exit 1
[[ $(/usr/bin/stat -c '%d:%i:%s:%y:%u:%g:%a:%h' -- "$NODE") == "$before" ]] || exit 1
"$NODE" --input-type=module - "$APPROVED_AT" "$ISSUED_AT" "$EXPIRES_AT" "$DECISION_SHA" "$RUN_INSTANCE" "$GIT_SHA" "$DOCKER_SHA" <<'R3_PREP_JS'
import fs from 'node:fs/promises';
import {constants as C} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname,join} from 'node:path';
const [approvedAt,issuedAt,expiresAt,decisionSha256,runInstance,gitSha256,dockerSha256]=process.argv.slice(2);
const src='/home/daon/anvil-v3-pgcopy-20261028-r3-src',ledger='/home/daon/.local/share/anvil-v3-pgcopy-20261028-r3';
const node='/opt/node-v24.21.0-linux-x64/bin/node',commit='8d200333239f1bd7a7e8b6736a1492eb482e2de2',branch='codex/av3-stage-b',remote='git@github-sinsan-develop:sinsan-develop/Anvil.git';
const candidate='94bb0d36438873994003f062a9c18abc378e9c2382a7d617c45ee411141f0092';
const nodeSha='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c';
const pins=[['scripts/p03-pg-copy-host.ts','e88b9b1918eba1b6e2c035c7e7c6d9cf458e778853190cf768516f9f4cfe2703',70478],['scripts/pg-recovery-copy.sh','8f1c435187ed253cbc1acaabd430b4b4f891d84ebbc37a3027744a22b44c9bb3',58370]];
const hash=b=>createHash('sha256').update(b).digest('hex'),ok=(v)=>{if(!v)throw Error('PREPARATION_STOP');};
let phase='INPUT';
const parse=t=>{ok(typeof t==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(t));const n=Date.parse(t);ok(Number.isFinite(n)&&new Date(n).toISOString()===t);return n;};
const a=parse(approvedAt),i=parse(issuedAt),e=parse(expiresAt),wall=Date.now(),start=performance.now();
const guard=()=>ok(Date.now()>=a&&Date.now()<e&&performance.now()-start<e-wall);
ok(process.platform==='linux'&&process.getuid()===1000&&process.getgid()===1000);
ok([decisionSha256,gitSha256,dockerSha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))&&/^[a-f0-9]{32}$/.test(runInstance));
ok(a<=i&&i<=wall&&wall<e&&0<e-a&&e-a<=1800000);guard();
const sameStat=(x,y)=>x.dev===y.dev&&x.ino===y.ino&&x.size===y.size&&x.mtimeNs===y.mtimeNs&&x.ctimeNs===y.ctimeNs;
async function parents(root){for(let p=dirname(root);;p=dirname(p)){guard();const s=await fs.lstat(p);ok(s.isDirectory()&&!s.isSymbolicLink()&&[0,1000].includes(s.uid)&&(s.mode&0o022)===0&&await fs.realpath(p)===p);if(p==='/')break;}}
async function absent(p){try{await fs.lstat(p);throw Error('TARGET_EXISTS');}catch(x){ok(x.code==='ENOENT');}}
async function file(p,owner,expected,limit,mode){guard();const b=await fs.lstat(p,{bigint:true});ok(b.isFile()&&!b.isSymbolicLink()&&b.nlink===1n&&b.uid===BigInt(owner)&&(b.mode&0o022n)===0n&&b.size<=BigInt(limit)&&await fs.realpath(p)===p);if(mode!==undefined)ok((b.mode&0o7777n)===BigInt(mode));
 const h=await fs.open(p,C.O_RDONLY|C.O_NOFOLLOW);let bytes;try{const opened=await h.stat({bigint:true});ok(sameStat(b,opened));bytes=await h.readFile();ok(BigInt(bytes.length)===b.size&&sameStat(b,await h.stat({bigint:true})));}finally{await h.close();}ok(sameStat(b,await fs.lstat(p,{bigint:true}))&&hash(bytes)===expected);guard();return {stat:b,bytes};}
async function root(p,pin){const s=await fs.lstat(p);ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===1000&&(s.mode&0o7777)===0o700&&await fs.realpath(p)===p);if(pin)ok(s.dev===pin.dev&&s.ino===pin.ino);await parents(p);return s;}
async function syncDir(p){const d=await fs.open(p,C.O_RDONLY|C.O_DIRECTORY|C.O_NOFOLLOW);try{await d.sync();}finally{await d.close();}guard();}
async function rootTool(p,pin){for(const dir of ['/','/usr','/usr/bin']){guard();const s=await fs.lstat(dir);ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===0&&(s.mode&0o022)===0&&await fs.realpath(dir)===dir);}return file(p,0,pin,268435456);}
const gitEnv={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:'/usr/bin/ssh -oBatchMode=yes -oStrictHostKeyChecking=yes -oUpdateHostKeys=no'};
async function git(args){guard();await rootTool('/usr/bin/git',gitSha256);return await new Promise((resolve,reject)=>{
 const child=spawn('/usr/bin/git',['--no-optional-locks','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null',...args],{env:gitEnv,stdio:['ignore','pipe','pipe'],shell:false});
 const out=[];let count=0,err=0,failed=false;child.on('error',()=>{failed=true;});child.stdout.on('data',b=>{count+=b.length;if(count<=262144)out.push(b);else failed=true;});child.stderr.on('data',b=>{err+=b.length;if(err)failed=true;});
 const timer=setInterval(()=>{try{guard();}catch{failed=true;phase='GIT_OUTCOME_UNKNOWN_PRESERVE';}},250);
 child.on('close',async(code,signal)=>{clearInterval(timer);try{guard();ok(!failed&&code===0&&!signal&&err===0);await rootTool('/usr/bin/git',gitSha256);resolve(Buffer.concat(out));}catch{reject(Error('GIT_STOP_PRESERVE'));}});
 });}
try{
 phase='READONLY_PRECONDITIONS';await parents(src);await parents(ledger);await absent(src);await absent(ledger);
 // Node 기동 전 shell 관측에 더해 실제 기동 binary/부모와 open 전후를 재확인한다.
 for(const [p,uid,gid,mode]of [['/',0,0,0o755],['/opt',0,0,0o755],['/opt/node-v24.21.0-linux-x64',1001,1001,0o755],['/opt/node-v24.21.0-linux-x64/bin',1001,1001,0o755]]){const s=await fs.lstat(p);ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===uid&&s.gid===gid&&(s.mode&0o7777)===mode&&await fs.realpath(p)===p);}
 const nf=await file(node,1001,nodeSha,268435456,0o755),self=await fs.stat('/proc/self/exe',{bigint:true});ok(nf.stat.gid===1001n&&await fs.realpath('/proc/self/exe')===node&&sameStat(nf.stat,self));
 for(const p of ['/','/usr','/usr/bin']){const s=await fs.lstat(p);ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===0&&(s.mode&0o022)===0&&await fs.realpath(p)===p);}
 await rootTool('/usr/bin/git',gitSha256);await rootTool('/usr/bin/docker',dockerSha256);guard();
 phase='FRESH_SOURCE';await absent(src);await fs.mkdir(src,{mode:0o700});const sp=await root(src);await syncDir(dirname(src));
 await git(['clone','--quiet','--no-checkout','--single-branch','--origin','development','--branch',branch,remote,src]);await root(src,sp);
 await git(['-C',src,'checkout','--quiet','-B',branch,commit]);await root(src,sp);
 const gd=await fs.lstat(join(src,'.git'));ok(gd.isDirectory()&&!gd.isSymbolicLink()&&gd.uid===1000&&(gd.mode&0o022)===0&&await fs.realpath(join(src,'.git'))===join(src,'.git'));
 phase='EXACT_SOURCE_CHECK';const q=async args=>(await git(['-C',src,...args])).toString('utf8');
 ok((await q(['rev-parse','HEAD'])).trim()===commit&&(await q(['branch','--show-current'])).trim()===branch&&(await q(['remote','get-url','development'])).trim()===remote&&(await q(['status','--porcelain=v1','--untracked-files=all']))==='');
 for(const [path,digest,length]of pins){const blob=await git(['-C',src,'show','HEAD:'+path]),f=await file(join(src,path),1000,digest,length);ok(blob.length===length&&hash(blob)===digest&&f.bytes.equals(blob)&&!blob.includes(13));}
 phase='FRESH_LEDGER';await parents(ledger);await absent(ledger);await fs.mkdir(ledger,{mode:0o700});const lp=await root(ledger);await syncDir(dirname(ledger));
 const scope='P03_PROTECTED_COPY_LIMITED_RISK_R1',policy='P03_COPY_LIMITED_RISK_POLICY_R1_20261028';
 const acceptance={scope,policy,candidateSha256:candidate,runInstance,sourceInstance:'dc22a0629e79f259dcd935845e88e58e',copyInstance:runInstance,commit,controllerSha256:pins[0][1],shellSha256:pins[1][1],decisionSha256,issuedAt,expiresAt,delta:{writerFullyControlled:'NOT_PROVEN_ACCEPTED_FOR_THIS_RUN',hardQuota:'NOT_ENFORCED_ACCEPTED_FOR_THIS_RUN',acl:'UNAVAILABLE_ONLY_BASIC_METADATA_ACCEPTED',xattr:'UNAVAILABLE_ONLY_BASIC_METADATA_ACCEPTED',numericOwner1001:'NEW_EXACT_RUN_RISK_ACCEPTED'}};
 const grant={schema:1,scope,branch,commit,controllerSha256:pins[0][1],shellSha256:pins[1][1],nodeSha256:nodeSha,gitSha256,dockerSha256,runInstance,issuedAt,expiresAt,totalMs:600000,sourceMs:500000,reserveMs:25000,stdoutBytes:16384,controlBytes:262144,auditBytes:33554432,logicalBytes:268435456,maxEntries:100000,maxVolumes:1,maxCreates:3,maxStarts:3,names:{source:'anvil-v3-development-pgdata',copy:'anvil-v3-pgdata-recovery-20261028-r3',tools:'anvil-v3-pgcopy-tools-20261028-r3',init:'anvil-v3-pgcopy-init-20261028-r3',helper:'anvil-v3-pgcopy-20261028-r3'},policy,candidateSha256:candidate,decisionSha256,limitedAcceptance:acceptance};
 const bytes=Buffer.from(JSON.stringify(grant)+'\n');ok(bytes.length<=8192);guard();await root(src,sp);await root(ledger,lp);await absent(join(ledger,'grant.json'));await absent(join(ledger,'consumed.json'));await absent(join(ledger,'receipt.jsonl'));
 phase='GRANT_CREATE_NEW';const h=await fs.open(join(ledger,'grant.json'),C.O_WRONLY|C.O_CREAT|C.O_EXCL|C.O_NOFOLLOW,0o600);try{const s=await h.stat();ok(s.isFile()&&s.uid===1000&&s.nlink===1&&(s.mode&0o7777)===0o600);await h.writeFile(bytes);await h.sync();}finally{await h.close();}await syncDir(ledger);
 await file(join(ledger,'grant.json'),1000,hash(bytes),8192,0o600);await root(src,sp);await root(ledger,lp);guard();
 // Main 기술제안: entry 전 최대 total600초의 허가 잔여를 확보한다. 제품 limit은 바꾸지 않는다.
 ok(e-Date.now()>=600000);process.stdout.write('R3_PREPARATION_CONFIRMED_ENTRY_NOT_RUN\n');
}catch{process.stderr.write('R3_PREPARATION_STOP_PRESERVE:'+phase+'\n');process.exitCode=1;}
R3_PREP_JS
R3_PREP_ONLY
```
기존 SSH alias/인증·원격 host 신뢰가 비대화식으로 이미 설정돼 있어야 하며, clone를 위해 새 known_hosts/키·인증설정·권한을 만들거나 고치지 않는다. 준비 Git의 GIT_SSH_COMMAND는 위 고정 옵션만 사용해 대화형 인증·자동 host 신뢰 추가/갱신을 허용하지 않는다. `/usr/bin/ssh`의 기존 설치·신원은 승인 후 확인할 UNKNOWN 전제이며 부재/불명이면 STOP, 새 설치·새 키·신뢰 수정0이다. 키 경로·내용을 읽어 출력하지 않으며 실제 CLI/controller·grant schema는 바꾸지 않는다. 이 전제는 Main의 승인 후 사전관측 대상이며 해결되지 않으면 clone0/STOP이다. 입력미충족 거절·실제 Node/부모·rootTool 검산이 모두 끝나기 전 source/ledger mkdir도 없다.
위 코드는 검토 후보이며 현재 실행하지 않는다. 코드가 순조롭게 끝나도 entry를 자동 호출하지 않는다. Main은 정확 source/입력·현재 승인 잔여·현장 전제를 재대조한 뒤 §4의 기존 entry 한 번만 별도로 실행한다.

## 5. 사람이 판단할 잔여 위험4와 유한 한도
1. **복사 중 다른 writer가 없다는 보장은 없다.** Docker consumer0·원본RO·복사 전후 bytes/metadata 일치도 모든 외부 writer 부재나 같은 시점의 정상 DB snapshot을 증명하지 않는다. 복사 성공 후에도 DB 정합성은 미확인이다.
2. **디스크를 강제로 제한한 quota가 아니다.** 검사 사이 증가·공유 공간 고갈·중단 지연이 가능하다. 새/부분 R3 사본이 원/R1/R2 보존 공간에 추가된다. 관측 상한을 강제격리나 0손실 보장으로 표시하지 않는다.
3. **ACL/xattr를 못 보는 경우를 제한 수락한다.** 도구 미설치/필요기능 미지원일 때만 미확인을 수락한다. 존재하는 속성·조회 오류·부분출력·stderr·보존 실패는 계속 거절하며 복사 성공으로 덮지 않는다.
4. **Node 소유자1001·loader 경합이 남는다.** owner/hash/실행파일 전후검사를 해도 검증과 실행 사이 바뀔 가능성을 완전히 제거하지 못한다. 옛 run의 수락을 새 실행에 자동 승계하지 않는다.
불수락이면 실행0이며 writer 통제·격리/quota·신뢰 loader 등의 필요한 대안을 별도 결정한다. 현재 검증됐다고 가정하지 않는다.
기존 한도는 전체 monotonic600초/source500초/회수reserve25초·copy 시작 잔여525초 이상, 논리256MiB/할당관측512MiB guard/entries100000, 예상 max(logical,allocated)+32MiB 및 free reserve128MiB/inodes entries+100이다. audit tmpfs32MiB/stdout16KiB/control256KiB·최대10초 관측간격을 같은 최초 deadline에서 유지한다. 위반/불명 시 정확 원cp identity만 확인해 TERM최대1·유한wait/회수, 부분보존이다. SIGKILL/force/무제한 retry0이며 OS/daemon/IO 불명을600초 내 강제회수한다고 보장하지 않는다.

## 6. 소유 정리·보존·rollback·결정 범위
controller가 정상 종료/실close·exited/ExitCode0/FinishedAt·fullID/name/nonce/image/설정이 모두 일치한 자기 helper만 기존 normal rm하고 부재를 확인한다. Main 후속은 그 수행 결과의 독립 재관측이며 반복 rm 권한이 아니다. 잔여/신원·종료 불명은 보존하고 별도 exact 정리 결정을 요청한다. created 수락은 rm 허가가 아니며 불명/다른 신원은 보존한다. init 빈 사본 root의 명시 변경 외 기존 파일/서비스/권한을 바꾸지 않는다. source QA는 정확 resolved literal·owner·전체link·소유자료/사용중0을 확인한 뒤 소유분만 회수하고 별도 부재확인한다. 대상 밖·새 자료·불명은 삭제0이다.
원본/R1/R2와 새 R3의 성공·실패·부분 volume 및 grant/consumed/receipt ledger는 보존한다. 원장 O_EXCL/fsync·동일inode append·원 bytes 보존을 유지한다. 최대30분 목표수명 안 회수 불명이면 임의 연장/강제삭제 없이 잔여·owner·이유·정확 후속조치를 보고한다. rollback은 기존 서비스 미변경/원본과 부분사본·기록 보존이며 volume/ledger 삭제·원본 복원·승인 재사용이 아니다.
이번에 요청할 실제 결정은 **고정 R3 source/대상6의 새1회·추가 volume1·같은 최초30분 안 준비/복제·위험4·정상정리/불명보존·후속 한정 읽기확인**뿐이다. PG 기동/SQL/schema/정식DB·서비스·권한/Secret·Agent 실행, 기존 프로젝트 차단 해제는 제외한다. 제한 사본 성공은 정식 환경 복구·IX01·전체 P03/WORK_PLAN 완료가 아니다.
최초승인 30분은 준비+실행 허가 및 일회 QA 목표창이고 controller 내부 total600/source500초와 별개다. 단계별로 어느 창도 재시작하지 않는다. 보존 volume/ledger는 30분 자동삭제 대상이 아니다. Git 준비가 늦거나 child close/IO/cleanup이 불명이면 STOP·보존하며 템플릿도 강제종료나 기한 내 회수를 보장하지 않는다. 기존 bootstrap 도구/readlink/stat/sha256sum과 Node/부모·Git/Docker의 실제 신원·소유·공간 전제는 현재 UNKNOWN이며 승인 뒤 첫쓰기 전 확인해야 한다. 해결되지 않으면 Node 준비/entry0이다.
남은 전제는 이 정적 템플릿의 독립 검토, 새 실제 결정기록·동적 입력, 승인 뒤 실제 현장 관측이다. sourceRoot/ledger 및 부분 grant가 생긴 뒤 실패하면 해당 시도의 소유 QA만 별도 소유/링크·사용중0 검산 후 회수 판단하며 자동 retry/덮기/삭제0이다. grant/consumed/receipt·원/R1/R2/새R3 volume은 보존한다. 이 문서만으로 이를 충족하거나 actual 권한을 발급하지 않는다.