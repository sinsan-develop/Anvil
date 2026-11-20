import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base=new URL('../../../',import.meta.url);
const sourceUrl=new URL('scripts/qa-ix01-subnet-observation-identity-path.ps1',base);
function ram(values:readonly unknown[]){
 const source=readFileSync(sourceUrl,'utf8');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$t,[ref]$e)
if($e.Count -ne 0 -or @($a.EndBlock.Statements|Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'SOURCE'}
. ([scriptblock]::Create($source))
$values=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(values)).toString('base64')}'))|ConvertFrom-Json
$out=@();foreach($value in $values){$out+=Read-Ix01IdentityPathSyntax $value};ConvertTo-Json -InputObject $out -Depth 6 -Compress`;
 const r=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:65536,windowsHide:true});
 assert.equal(r.error,undefined);assert.equal(r.status,0,`RAM PowerShell exit ${r.status}`);return JSON.parse(r.stdout.trim());
}
test('IX01 IdentityFile syntax: 정적 Windows drive·인용 공백·tilde 원문 반환0',()=>{
 const inputs=[String.raw`C:\Users\PRIVATE\id`, 'D:/PRIVATE/id','"C:/PRIVATE USER/id"',String.raw`"C:\PRIVATE USER\id"`,'~/.ssh/PRIVATE','"~/.ssh/PRIVATE KEY"','"C:/한글/키 이름"'];
 const rows=ram(inputs);
 rows.forEach((r:any,i:number)=>{assert.equal(r.status,'CLASSIFIED');assert.equal(r.kind,i===4||i===5?'TILDE_PATH':'WINDOWS_DRIVE_PATH');assert.equal(r.reference,'LITERAL');assert.equal(r.readiness,'UNCONFIRMED');assert.deepEqual(Object.keys(r).sort(),['kind','quoted','readiness','reference','schemaVersion','status'].sort());});
 assert.deepEqual(rows.map((r:any)=>r.quoted),[false,false,true,true,false,true,true]);
 assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('한글'));assert(!JSON.stringify(rows).includes('C:'));
});
test('IX01 IdentityFile syntax: token/env·UNC·상대·drive 상대·named home 분리, 확장0',()=>{
 const rows=ram(['~/.ssh/%h','C:/${HOME}/id','~/${NAME}/%Z','C:/%%/id',String.raw`\\server\share\id`,'//server/share/id','id_key','C:id_key','/id_key','~other/.ssh/id','none','C:/a/../id']);
 assert.deepEqual(rows.map((r:any)=>r.kind),['TILDE_PATH','WINDOWS_DRIVE_PATH','TILDE_PATH','WINDOWS_DRIVE_PATH','UNC_PATH','UNC_PATH','RELATIVE_PATH','DRIVE_RELATIVE_PATH','ROOTED_PATH','NAMED_TILDE_PATH','NONE_LITERAL','DOT_SEGMENT_PATH']);
 assert.deepEqual(rows.slice(0,4).map((r:any)=>r.reference),['TOKEN_SYNTAX','ENVIRONMENT_SYNTAX','MIXED_SYNTAX','TOKEN_SYNTAX']);
 for(const r of rows){assert.equal(r.status,'CLASSIFIED');assert.equal(r.readiness,'UNCONFIRMED');}
 assert(!JSON.stringify(rows).includes('server'));assert(!JSON.stringify(rows).includes('HOME'));
});
test('IX01 IdentityFile syntax: 불명 인용/escape·동적 형상·control·상한·장치 경로 거절',()=>{
 const cases:[unknown,string][]=[
  [null,'INPUT_UNCONFIRMED'],[42,'INPUT_UNCONFIRMED'],['','INPUT_UNCONFIRMED'],['x'.repeat(16385),'INPUT_UNCONFIRMED'],['가'.repeat(5462),'INPUT_UNCONFIRMED'],
  ['"C:/PRIVATE','QUOTING_UNCONFIRMED'],["'C:/PRIVATE KEY'",'QUOTING_UNCONFIRMED'],['C:/PRIVATE KEY','QUOTING_UNCONFIRMED'],
  [String.raw`"C:\PRIVATE\"`,'ESCAPE_UNCONFIRMED'],[String.raw`"C:\PRIVATE\"key"`,'ESCAPE_UNCONFIRMED'],
  [String.raw`"C:\PRIVATE\ KEY"`,'ESCAPE_UNCONFIRMED'],
  ['C:/%','TOKEN_UNCONFIRMED'],['C:/%2','TOKEN_UNCONFIRMED'],['C:/${HOME','ENVIRONMENT_UNCONFIRMED'],['C:/$HOME','ENVIRONMENT_UNCONFIRMED'],
  ['C:/PRIVATE\nKEY','TEXT_UNCONFIRMED'],['C:/PRIVATE\0KEY','TEXT_UNCONFIRMED'],['\uFEFFC:/PRIVATE','TEXT_UNCONFIRMED'],
  [String.raw`\\?\C:\PRIVATE`,'NAMESPACE_UNCONFIRMED'],[String.raw`\\.\PRIVATE`,'NAMESPACE_UNCONFIRMED'],['C:/PRIVATE:stream','PATH_UNCONFIRMED'],['C:/PRIVATE*','PATH_UNCONFIRMED'],
 ];
 const rows=ram(cases.map(([value])=>value));
 rows.forEach((r:any,i:number)=>{assert.equal(r.status,'UNKNOWN');assert.equal(r.code,cases[i]![1]);assert.equal(r.readiness,'UNCONFIRMED');assert(!Object.hasOwn(r,'kind'));});
 assert(!JSON.stringify(rows).includes('PRIVATE'));
});
test('IX01 IdentityFile syntax source: 고정 alias/실행 closure 보존, 순수 함수만',()=>{
 const s=readFileSync(sourceUrl,'utf8');assert(!/Get-Item|Get-Content|Get-Acl|Test-Path|Resolve-Path|ExpandEnvironmentVariables|GetEnvironmentVariable|Start-Process|Invoke-Expression|Invoke-WebRequest|File\]::|Directory\]::/.test(s));
 const original=spawnSync('git',['cat-file','blob','1b5232a7f83ab190b3ae7649196f198d0b7469aa:scripts/qa-ix01-subnet-observation-alias-config.ps1'],{cwd:base,windowsHide:true,maxBuffer:65536});
 assert.equal(original.error,undefined);assert.equal(original.status,0);
 assert.equal(createHash('sha256').update(original.stdout).digest('hex'),'eb0b94496e2c28c8c0193c2904cf3477d07b9a18540a673b9739c7d446cdd488');
});
