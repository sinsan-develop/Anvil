import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const sourceUrl=new URL('../../../scripts/qa-ix01-subnet-observation-alias-config.ps1',import.meta.url);
function ram(cases:readonly {user:string|null;system:string|null}[],classifyIdentityPaths=false,diagnosticOnly=false){
 const source=readFileSync(sourceUrl,'utf8')+(classifyIdentityPaths?'\n'+readFileSync(new URL('../../../scripts/qa-ix01-subnet-observation-identity-path.ps1',import.meta.url),'utf8'):'');
 const input=Buffer.from(JSON.stringify(cases)).toString('base64');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE'}
if(@($ast.EndBlock.Statements | Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'AUTO_ENTRY'}
. ([scriptblock]::Create($source))
$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}'))|ConvertFrom-Json
$out=@();foreach($case in $cases){
 $user=$null;$system=$null
 if($null -ne $case.user){$user=[Text.Encoding]::UTF8.GetBytes($case.user)}
 if($null -ne $case.system){$system=[Text.Encoding]::UTF8.GetBytes($case.system)}
 $out+=Read-Ix01SubnetAliasConfig -UserBytes $user -SystemBytes $system ${classifyIdentityPaths?'-ClassifyIdentityPaths':''} ${diagnosticOnly?'-DiagnosticOnly':''}
}
ConvertTo-Json -InputObject $out -Depth 10 -Compress`;
 const r=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:65536,windowsHide:true});
 assert.equal(r.error,undefined);assert.equal(r.status,0,`synthetic PowerShell exit ${r.status}`);
 return JSON.parse(r.stdout.trim());
}

test('IX01 alias config RAM: 고정 alias·전역/user/system 첫 값, 출력 권위와 원문0',()=>{
 const [r]=ram([{user:'User fixture\nHost WSL-server\n HostName example.invalid\n Port 2222\nHost *\n User ignored\n Port 22',system:'Host *\n Port 23\n IdentitiesOnly yes'}]);
 assert.equal(r.status,'ALIAS_SUBSET');assert.equal(r.readiness,'UNCONFIRMED');assert.equal(r.userKind,'NON_ROOT_LITERAL');
 assert.deepEqual(r.fields,[{key:'hostname',role:'USER_CONFIG',line:3},{key:'user',role:'USER_CONFIG',line:1},{key:'port',role:'USER_CONFIG',line:4},{key:'identitiesonly',role:'SYSTEM_CONFIG',line:3}]);
 assert(!JSON.stringify(r).includes('fixture'));assert(!JSON.stringify(r).includes('example.invalid'));assert(!JSON.stringify(r).includes('2222'));
});

test('IX01 alias config RAM: 명시 IdentityFile 분류 연결의 정적 경로와 미확인 경계',()=>{
 const paths=[String.raw`C:\PRIVATE\id`,'D:/PRIVATE/id','"C:/PRIVATE USER/id"',String.raw`"C:\PRIVATE USER\id"`,'~/.ssh/id','"~/.ssh/PRIVATE KEY"',
  '~/.ssh/%h','C:/${HOME}/id',String.raw`\\PRIVATE_SERVER\PRIVATE\id`,'//PRIVATE_SERVER/PRIVATE/id','PRIVATE/id','C:PRIVATE','~other/id',String.raw`"C:\PRIVATE\ KEY"`];
 const rows=ram(paths.map(path=>({user:`Host WSL-server\n IdentityFile ${path}`,system:null})),true);
 rows.forEach((r:any,i:number)=>{assert.equal(r.status,i<6?'ALIAS_SUBSET':'UNKNOWN');assert.equal(r.readiness,'UNCONFIRMED');if(i<6)assert.deepEqual(r.fields,[{key:'identityfile',role:'USER_CONFIG',line:2}]);else assert.equal(r.code,'PATH_UNCONFIRMED');});
 const [duplicate]=ram([{user:'IdentityFile C:/PRIVATE/id',system:'IdentityFile ~/.ssh/id'}],true);
 assert.equal(duplicate.code,'IDENTITY_SET_UNCONFIRMED');assert.equal(duplicate.role,'SYSTEM_CONFIG');assert.equal(duplicate.line,1);
 assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('HOME'));
});

test('IX01 alias config RAM: Host 패턴·부정·비대상 무해 값·system scope 초기화',()=>{
 const rows=ram([
  {user:'Host other\n IdentityFile C:\\PRIVATE\\key\n Port unsupported\nHost wsl-?erver\n User fixture',system:'Port 22'},
  {user:'Host * !wsl-server\n User root\nHost WSL-SERVER other\n User fixture',system:null},
  {user:'Host !other\n User root',system:null},
  {user:'Host *\n User root\nHost WSL-server\n User fixture',system:null},
  {user:null,system:null},
  {user:'Host other\n ServerAliveInterval 60\nHost WSL-server\n User fixture',system:null},
  {user:'Host '+'*'.repeat(127)+'x\n User root\nHost '+'*?'.repeat(63)+'x\n User root\nHost WSL-server\n User fixture',system:null},
 ]);
 assert.equal(rows[0].status,'ALIAS_SUBSET');assert.deepEqual(rows[0].fields,[{key:'user',role:'USER_CONFIG',line:5},{key:'port',role:'SYSTEM_CONFIG',line:1}]);
 assert.equal(rows[1].userKind,'NON_ROOT_LITERAL');assert.equal(rows[1].fields[0].line,4);
 assert.equal(rows[2].userKind,'UNSET');assert.deepEqual(rows[2].fields,[]);
 assert.equal(rows[3].userKind,'ROOT_LITERAL');assert.equal(rows[3].readiness,'UNCONFIRMED');
 assert.equal(rows[4].status,'ALIAS_SUBSET');assert.equal(rows[4].userKind,'UNSET');
 assert.equal(rows[5].status,'ALIAS_SUBSET');assert.equal(rows[5].userKind,'NON_ROOT_LITERAL');
 assert.equal(rows[6].status,'ALIAS_SUBSET');assert.equal(rows[6].userKind,'NON_ROOT_LITERAL');assert.equal(rows[6].fields[0].line,6);
});

test('IX01 alias config RAM: 효과·미지원·형상·경로·누적 식별자 구분과 첫 실패',()=>{
 const cases=[
  ['Host other\nInclude PRIVATE','INCLUDE_UNCONFIRMED'],
  ['Host other\nMatch exec PRIVATE','MATCH_UNCONFIRMED'],
  ['Host other\nProxyCommand PRIVATE','EFFECT_UNCONFIRMED'],
  ['Host WSL-server\nLocalCommand PRIVATE','EFFECT_UNCONFIRMED'],
  ['UserKnownHostsFile PRIVATE','CUSTOM_SCOPE_UNCONFIRMED'],
  ['UnknownOption PRIVATE','UNSUPPORTED_DIRECTIVE'],
  ['Host WSL-server\nServerAliveInterval 60','UNSUPPORTED_DIRECTIVE'],
  ['Host','MALFORMED_CONFIG'],
  ['Host [wsl]','UNSUPPORTED_HOST_PATTERN'],
  ['Host WSL-server\nPort 0','MALFORMED_VALUE'],
  ['Host WSL-server\nIdentityFile C:\\PRIVATE\\key','PATH_UNCONFIRMED'],
  ['IdentityFile ~/.ssh/../key','PATH_UNCONFIRMED'],
  ['IdentityFile ~/.ssh/a\nIdentityFile ~/.ssh/b','IDENTITY_SET_UNCONFIRMED'],
  ['Include PRIVATE\nMatch exec PRIVATE','INCLUDE_UNCONFIRMED'],
  ['\uFEFFHost WSL-server','TEXT_UNCONFIRMED'],
  ['#'+'x'.repeat(65536),'INPUT_UNCONFIRMED'],
 ] as const;
 const rows=ram(cases.map(([user])=>({user,system:null})));
 rows.forEach((r:any,i:number)=>{assert.equal(r.status,'UNKNOWN');assert.equal(r.code,cases[i]![1]);assert.equal(r.readiness,'UNCONFIRMED');assert(!JSON.stringify(r).includes('PRIVATE'));assert(!Object.hasOwn(r,'fields'));});
});

test('IX01 alias diagnostic RAM: 일반 미지원 일괄·scope·16개 상한·원문0',()=>{
 const rows=ram([
  {user:'PRIVATEKEY PRIVATE\nHost other\nOtherPrivate PRIVATE\nHost WSL-server\nThirdPrivate PRIVATE',system:'FourthPrivate PRIVATE'},
  {user:Array.from({length:20},()=> 'PrivateOption PRIVATE').join('\n'),system:null},
 ],false,true);
 assert.equal(rows[0].status,'UNKNOWN');assert.equal(rows[0].code,'UNSUPPORTED_DIRECTIVE');assert.equal(rows[0].readiness,'UNCONFIRMED');
 assert.deepEqual(rows[0].diagnostics,[{role:'USER_CONFIG',line:1,code:'UNSUPPORTED_DIRECTIVE',applicable:true},{role:'USER_CONFIG',line:3,code:'UNSUPPORTED_DIRECTIVE',applicable:false},{role:'USER_CONFIG',line:5,code:'UNSUPPORTED_DIRECTIVE',applicable:true},{role:'SYSTEM_CONFIG',line:1,code:'UNSUPPORTED_DIRECTIVE',applicable:true}]);
 assert.equal(rows[0].additional,false);assert.equal(rows[1].diagnostics.length,16);assert.equal(rows[1].additional,true);assert.equal(rows[1].status,'UNKNOWN');
 assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('Private'));assert(!Object.hasOwn(rows[0],'fields'));
});

test('IX01 alias diagnostic RAM: 고정 scalar 구분은 비교만·기본 거절 보존',()=>{
 const user='ServerAliveInterval 3\nServerAliveCountMax 2\nLogLevel ERROR';
 const [r]=ram([{user,system:null}],false,true);
 assert.equal(r.status,'COMPARISON_ONLY');assert.equal(r.readiness,'UNCONFIRMED');assert.equal(r.additional,false);
 assert.deepEqual(r.diagnostics.map((x:any)=>x.code),['CARRIER_FIXED_SERVER_ALIVE_INTERVAL','CARRIER_FIXED_SERVER_ALIVE_COUNT_MAX','CARRIER_FIXED_LOG_LEVEL']);
 assert.equal(r.diagnostics.length,3);assert(r.diagnostics.every((x:any)=>x.applicable));assert(!Object.hasOwn(r,'fields'));
 const [old]=ram([{user,system:null}]);assert.equal(old.code,'UNSUPPORTED_DIRECTIVE');assert(!Object.hasOwn(old,'diagnostics'));
});

test('IX01 alias diagnostic RAM: 효과/범위/모호한 값 이후 추론과 system 처리0',()=>{
 const stops=[['Include PRIVATE','INCLUDE_UNCONFIRMED'],['Match exec PRIVATE','MATCH_UNCONFIRMED'],['ProxyCommand PRIVATE','EFFECT_UNCONFIRMED'],['HostKeyAlias PRIVATE','CUSTOM_SCOPE_UNCONFIRMED'],['Host [broken]','UNSUPPORTED_HOST_PATTERN'],['ServerAliveInterval "3"','MALFORMED_VALUE'],['ServerAliveCountMax 2147483648','MALFORMED_VALUE'],['LogLevel PRIVATE','MALFORMED_VALUE'],['OtherPrivate "unterminated','MALFORMED_VALUE']] as const;
 const rows=ram(stops.map(([stop])=>({user:'FirstPrivate PRIVATE\n'+stop+'\nLastPrivate PRIVATE',system:'SystemPrivate PRIVATE'})),false,true);
 rows.forEach((r:any,i:number)=>{assert.equal(r.status,'UNKNOWN');assert.equal(r.code,stops[i]![1]);assert.equal(r.role,'USER_CONFIG');assert.equal(r.line,2);assert.equal(r.diagnostics.length,1);assert.equal(r.additional,false);assert(!JSON.stringify(r).includes('PRIVATE'));});
});

test('IX01 alias config source: 순수 입력·자동 진입/실제 파일·키·명령 호출0',()=>{
 const s=readFileSync(sourceUrl,'utf8');
 assert(!/Get-Content|Get-Item|Get-Acl|Test-Path|Start-Process|Invoke-Expression|Invoke-WebRequest|Add-Type|\.ReadAll|\.WriteAll|Resolve-Path/i.test(s));
 assert(s.includes('Read-Ix01SubnetAliasConfig'));assert(s.includes('UNCONFIRMED'));assert(s.includes('RegexOptions]::NonBacktracking'));
});
