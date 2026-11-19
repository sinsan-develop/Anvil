import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {readSubnetWindowsReadinessResult} from '../../../scripts/qa-ix01-subnet-observation-windows-readiness-result.ts';

const sourceUrl=new URL('../../../scripts/qa-ix01-subnet-observation-windows-readiness.ps1',import.meta.url);
// 이 PowerShell은 원 소스를 파싱하고 메모리 포트만 평가한다. native 포트/시스템 대상은 호출하지 않는다.
function ram(body:string){
 const source=readFileSync(sourceUrl,'utf8');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE'}
if(@($ast.EndBlock.Statements | Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'AUTO_ENTRY'}
. ([scriptblock]::Create($source))
${body}`;
 const r=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:32768,windowsHide:true});
 assert.equal(r.error,undefined);assert.equal(r.status,0,`synthetic PowerShell exit ${r.status}: ${r.stderr}`);
 return JSON.parse(r.stdout.trim());
}
const fixture=String.raw`
$state=@{wall=1800000000000L;mono=1L;reads=0;opens=0;closes=0;observes=0;events=[Collections.Generic.List[string]]::new();mode='normal';role='';repeat=0}
$owner='S-1-5-21-100-200-300-1001'
$binding=@{attemptId='11111111-1111-4111-8111-111111111111';approvalHash=('a'*64);planHash=('b'*64);sourceHash=('c'*64);issuedAt=1800000000000L;expiresAt=1800000060000L}
$data=[Text.UTF8Encoding]::new($false,$true).GetBytes(('Host WSL-server',' HostName example.invalid',' User fixture',' Port 22',' IdentityFile ~/.ssh/id_ed25519') -join [char]10)
$ports=@{
 Clock={@{wall=$state.wall;mono=$state.mono}};
 Owner={$owner};
 Observe={param($path,$directory,$systemLeaf)
  $state.observes++;$state.events.Add('observe');$state.role=$path
  if($state.mode -eq 'access'){throw 'PRIVATE_ACCESS'}
  $absent=($path -like '*known_hosts*' -or $path -eq 'C:\ProgramData\ssh\ssh_config')
  if($state.mode -eq 'missing-image' -and $systemLeaf){$absent=$true}
  $parent=Split-Path -Parent $path
  $chain=@();while($parent){$chain+=@{path=$parent;reparse=$false;link='';created=1L;attributes=16;aclHash=('d'*64)};$next=Split-Path -Parent $parent;if($next -eq $parent){break};$parent=$next}
  $length=if($systemLeaf){3L}elseif($directory){0L}else{[long]$data.Length}
  if($state.mode -eq 'oversize' -and $systemLeaf){$length=67108865L}
  $o=@{state=if($absent){'ABSENT'}else{'PRESENT'};path=$path;directory=[bool]$directory;reparse=$false;link='';created=1L;modified=1L;attributes=if($directory){16}else{32};length=$length;owner=if($systemLeaf){'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'}else{$owner};aclHash=('d'*64);rules=@(@{sid=$owner;allow=$true;rights=2032127L},@{sid='S-1-5-18';allow=$true;rights=2032127L});parents=$chain}
  if($systemLeaf){$o.rules[0].sid=$o.owner}
  if($state.mode -eq 'link'){$o.reparse=$true}
  if($state.mode -eq 'parent-link'){$o.parents[0].link='SymbolicLink'}
  if($state.mode -eq 'foreign-write'){$o.rules+=@{sid='S-1-5-21-999';allow=$true;rights=2032127L}}
  if($state.mode -eq 'changed' -and $state.opens -gt 0){$o.modified=2L}
  if($state.mode -eq 'deadline'){$state.wall+=60001L;$state.mono+=60001L}
  return $o
 };
 Open={param($path) $state.opens++;$state.events.Add('open');if($state.mode -eq 'open'){throw 'PRIVATE_OPEN'};if($path.EndsWith('ssh.exe')){return [IO.MemoryStream]::new([byte[]](1,2,3))};return [IO.MemoryStream]::new($data)};
 Read={param($stream,$buffer,$count) $state.reads++;$state.events.Add('read');if($state.mode -eq 'read'){throw 'PRIVATE_READ'};if($state.mode -eq 'step-time'){$state.wall+=10001L;$state.mono+=10001L};return $stream.Read($buffer,0,$count)};
 Close={param($stream) $state.closes++;$state.events.Add('close');$stream.Dispose();if($state.mode -eq 'close'){throw 'PRIVATE_CLOSE'}}
}
`;

test('IX01 Windows readiness RAM: 원 PS 파서·8역할·고정 경로·해시 수거, 준비 권위 발급0',()=>{
 const binding={attemptId:'11111111-1111-4111-8111-111111111111',approvalHash:'a'.repeat(64),planHash:'b'.repeat(64),sourceHash:'6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3',issuedAt:1800000000000,expiresAt:1800000060000};
 const r=ram(fixture+String.raw`
$binding.sourceHash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3'
$line=Invoke-Ix01WindowsReadiness -Binding $binding -Ports $ports
@{result=($line|ConvertFrom-Json -AsHashtable);wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line+[char]10));length=[Text.Encoding]::UTF8.GetByteCount($line);opens=$state.opens;closes=$state.closes;events=$state.events}|ConvertTo-Json -Depth 12 -Compress
`);
 assert.equal(r.result.code,'INSPECTION_COLLECTED',JSON.stringify(r));assert.equal(r.result.readiness,'UNCONFIRMED');assert.equal(r.result.files.length,8);assert.equal(r.opens,2);assert.equal(r.closes,2);assert(r.length<=4096);
 assert.deepEqual(r.result.files.map((x:any)=>x.role),['SSH_IMAGE','USER_CONFIG','SYSTEM_CONFIG','USER_TRUST','USER_TRUST_2','SYSTEM_TRUST','SYSTEM_TRUST_2','LEDGER_PARENT']);
 assert(!JSON.stringify(r.result).includes('fixture'));assert(!JSON.stringify(r.result).includes('example.invalid'));assert(!JSON.stringify(r.result).includes('S-1-5'));
 assert.equal(r.result.files[0].sha256,'039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');
 // 재직렬화한 JSON 대신 같은 PS 호출의 원 JSON과 실행안의 LF를 판독한다.
 const wire=Buffer.from(r.wire,'base64');assert.equal(wire.length,r.length+1);assert.equal(wire.at(-1),10);
 const comparison=readSubnetWindowsReadinessResult(wire,binding);
 assert.equal(comparison.status,'COMPARISON_ONLY');
 if(comparison.status!=='COMPARISON_ONLY')assert.fail('원 PS 합성 결과 판독 실패');
 assert.equal(comparison.readiness,'UNCONFIRMED');assert.deepEqual(comparison.binding,binding);
 assert.deepEqual(Object.keys(comparison.identity),['imageSha256','configurationSha256','knownHostsSha256']);
 for(const hash of Object.values(comparison.identity))assert.match(hash,/^[0-9a-f]{64}$/);
 assert.equal(comparison.identity.imageSha256,r.result.files[0].sha256);
});

test('IX01 Windows readiness RAM: 첫 불명·교체·링크·ACL·한도 실패 뒤 다음 읽기0, 원 stream close',()=>{
 const r=ram(fixture+String.raw`
$out=@();foreach($mode in @('missing-image','access','link','parent-link','foreign-write','oversize','changed','deadline','open','read','close','step-time')){
 $state.mode=$mode;$state.wall=$binding.issuedAt;$state.mono=1L;$state.opens=0;$state.closes=0;$state.reads=0;$state.observes=0
 $line=Invoke-Ix01WindowsReadiness -Binding $binding -Ports $ports
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes;observes=$state.observes}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const v of r){assert.equal(v.result.code,'UNKNOWN',v.mode);assert(v.opens<=1,v.mode);assert.equal(v.closes,v.opens-(v.mode==='open'?1:0),v.mode);assert(!JSON.stringify(v.result).includes('PRIVATE'));}
});

test('IX01 Windows readiness RAM: Include/custom trust/Match exec·지원 밖 설정은 추가 파일0',()=>{
 const r=ram(fixture+String.raw`
$out=@();foreach($setting in @('Include PRIVATE_PATH','UserKnownHostsFile PRIVATE_PATH','GlobalKnownHostsFile PRIVATE_PATH','KnownHostsCommand PRIVATE_COMMAND','Match exec PRIVATE_COMMAND','ProxyCommand PRIVATE_COMMAND','IdentityAgent PRIVATE_PATH','Host *?',('Host WSL-server'+[char]10+' Unknown PRIVATE_VALUE'))){
 $data=[Text.Encoding]::UTF8.GetBytes($setting);$state.opens=0;$state.closes=0;$state.observes=0
 $line=Invoke-Ix01WindowsReadiness -Binding $binding -Ports $ports
 $out+=@{result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const v of r){assert.equal(v.result.code,'UNKNOWN');assert.equal(v.opens,2);assert.equal(v.closes,2);assert(v.result.files.length<=2);assert(!JSON.stringify(v.result).includes('PRIVATE'));}
});

test('IX01 Windows readiness RAM: 잘못된 결박·기한은 관측0, strict UTF8 및 실제 전체 문자열 한도',()=>{
 const r=ram(fixture+String.raw`
$out=@();foreach($mode in @('attempt','hash','extra','future','expired','window','utf8','config-nul')){
 $q=$binding.Clone();$state.opens=0;$state.closes=0;$state.observes=0
 switch($mode){'attempt'{$q.attemptId='invalid'} 'hash'{$q.planHash='a'*64+[char]10} 'extra'{$q.secret='PRIVATE'} 'future'{$q.issuedAt+=1} 'expired'{$q.expiresAt=$q.issuedAt} 'window'{$q.expiresAt+=1} 'utf8'{$data=[byte[]](255,254)} 'config-nul'{$data=[byte[]](65,0)}}
 $line=Invoke-Ix01WindowsReadiness -Binding $q -Ports $ports
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);observes=$state.observes;opens=$state.opens;closes=$state.closes}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const v of r){assert.equal(v.result.code,'UNKNOWN');if(!['utf8','config-nul'].includes(v.mode))assert.equal(v.observes,0);assert.equal(v.opens,v.closes);}
});

test('IX01 Windows readiness source: 외부 명령/쓰기·자동 진입0, 원 읽기 포트에만 OS 접근',()=>{
 const s=readFileSync(sourceUrl,'utf8');
 assert(!/Start-Process|Invoke-Expression|Add-Type|Set-Acl|WriteAll|WriteAllText|CreateDirectory|Remove-Item|Get-ChildItem|Get-Process|Invoke-WebRequest|ssh\s+-[GVG]/i.test(s));
 assert(s.includes('FileMode]::Open'));assert(s.includes('FileAccess]::Read'));assert(s.includes('FileShare]::Read'));assert(s.includes('8192'));assert(s.includes('UNKNOWN'));
});

test('IX01 Windows readiness RAM: 공개 trust subset·UTF8·행/본문 경계, 원문 반환0',()=>{
 const r=ram(fixture+String.raw`
$algorithm=[Text.Encoding]::ASCII.GetBytes('ssh-ed25519')
$blob=[byte[]]::new(4+$algorithm.Length+1);$blob[3]=[byte]$algorithm.Length;[Array]::Copy($algorithm,0,$blob,4,$algorithm.Length)
$trust='fixture.invalid ssh-ed25519 '+[Convert]::ToBase64String($blob)
$out=@();foreach($text in @($trust,('# public comment'+[char]10+$trust),($trust+' '+('x'*16384)),(('x'+[char]10)*4097),('fixture.invalid ssh-rsa '+[Convert]::ToBase64String($blob)),('fixture.invalid ssh-ed25519 NOTBASE64!'),([string][char]0xFEFF+$trust))){
 $bytes=[Text.Encoding]::UTF8.GetBytes($text);$out+=Get-Ix01ReadinessTextVerdict $bytes 'TRUST'
}
ConvertTo-Json -InputObject $out -Compress
`);
 assert.deepEqual(r,['SUBSET_ONLY','SUBSET_ONLY','TEXT_UNCONFIRMED','TEXT_UNCONFIRMED','TRUST_UNCONFIRMED','TRUST_UNCONFIRMED','TEXT_UNCONFIRMED']);
});

test('IX01 Windows readiness RAM: 원 결박 복사·짧은 읽기/길이 변경·close 지연 이후 후속0',()=>{
 const r=ram(fixture+String.raw`
$out=@();foreach($mode in @('mutate','short','extra-byte','close-late','clock-backward','parent-omitted','ledger-acl')){
 $state.wall=1800000000000L;$state.mono=1L;$state.opens=0;$state.closes=0;$state.observes=0
 $q=$binding.Clone();$p=$ports.Clone();$originalObserve=$ports.Observe;$originalClose=$ports.Close;$state.originalBinding=$q
 if($mode -eq 'mutate'){$p.Owner={$state.originalBinding.planHash='f'*64;$state.originalBinding.expiresAt=1L;return $owner}}
 if($mode -eq 'short'){$p.Read={param($stream,$buffer,$count) return 0}}
 if($mode -eq 'extra-byte'){$p.Read={param($stream,$buffer,$count) return $count}}
 if($mode -eq 'close-late'){$p.Close={param($stream) &$originalClose $stream;$state.wall+=10001L;$state.mono+=10001L}}
 if($mode -eq 'clock-backward'){$p.Observe={param($path,$dir,$leaf) $v=&$originalObserve $path $dir $leaf;$state.mono=0L;return $v}}
 if($mode -eq 'parent-omitted'){$p.Observe={param($path,$dir,$leaf) $v=&$originalObserve $path $dir $leaf;$v.parents=@();return $v}}
 if($mode -eq 'ledger-acl'){$p.Observe={param($path,$dir,$leaf) $v=&$originalObserve $path $dir $leaf;if($dir){$v.rules=@($v.rules[0])};return $v}}
 $line=Invoke-Ix01WindowsReadiness -Binding $q -Ports $p
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes;observes=$state.observes}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const v of r){assert.equal(v.result.code,v.mode==='mutate'?'INSPECTION_COLLECTED':'UNKNOWN',v.mode);assert.equal(v.opens,v.closes,v.mode);if(v.mode==='mutate'){assert.equal(v.result.binding.planHash,'b'.repeat(64));assert.equal(v.result.binding.expiresAt,1800000060000);}else if(v.mode!=='ledger-acl')assert(v.opens<=1,v.mode);}
});
